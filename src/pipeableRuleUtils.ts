// Original author Bowen Ni, Shino Kurian, Michael Lorton.
// RxJS Modifications mgechev.
// NgRx Modifications Tim Deschryver

import * as Lint from 'tslint';
import * as tsutils from 'tsutils';
import * as ts from 'typescript';
import { isObservable, returnsObservable } from './utils';

export function replacePipeableOperators({
  ctx,
  program,
  ngrxOperators,
  ngrxModule,
  failureString,
}: {
  ctx: Lint.WalkContext<void>;
  program: ts.Program;
  ngrxOperators: Set<string>;
  ngrxModule: string;
  failureString: string;
}) {
  const sourceFile = ctx.sourceFile;
  const typeChecker = program.getTypeChecker();

  /**
   * Returns true if the grandfather of the {@link node} is a call expression of
   * an NgRx instance operator.
   */
  function isAncestorNgrxOperatorCall(
    node: ts.Node,
    typeChecker: ts.TypeChecker,
  ): boolean {
    // If this is the only operator in the chain.
    if (!node.parent) {
      return false;
    }
    // Do not overstep the boundary of an arrow function.
    if (ts.isArrowFunction(node.parent)) {
      return false;
    }
    if (!node.parent.parent) {
      return false;
    }
    return isNgrxInstanceOperatorCallExpression(
      node.parent.parent,
      typeChecker,
    );
  }

  /**
   * Recursively generates {@link Lint.Replacement} to convert a chained NgRx call
   * expression to an expression using pipeable NgRx operators.
   *
   * @param currentNode The node in the chained expression being processed
   * @param lastNode The last node of the chained expression
   * @param operatorsToImport Collects the operators encountered in the expression
   * so far
   * @param notStart Whether the {@link currentNode} is the first expression in
   * the chain.
   */
  function replaceWithPipeableOperators(
    currentNode: ts.Node,
    lastNode: ts.Node,
    notStart = false,
  ): Lint.Replacement[] {
    // Reached the root of the expression, nothing to replace.
    if (!currentNode.parent || !currentNode.parent.parent) {
      return [];
    }
    // For an arbitrary expression like
    // foo.do(console.log).map( x =>2*x).do(console.log).switchMap( y => z);
    // if currentNode is foo.do(console.log),
    // immediateParent = foo.do(console.log).map
    const immediateParent = currentNode.parent;
    const immediateParentText = immediateParent.getText();
    const identifierStart = immediateParentText.lastIndexOf('.');
    const identifierText = immediateParentText.slice(identifierStart + 1);

    // Generates a replacement that would replace .map with map using absolute
    // position of the text to be replaced.
    const operatorReplacement = Lint.Replacement.replaceFromTo(
      immediateParent.getEnd() - identifierText.length - 1,
      immediateParent.getEnd(),
      identifierText,
    );
    // parentNode = foo.do(console.log).map( x =>2*x)
    const parentNode = currentNode.parent.parent;
    const moreReplacements =
      parentNode === lastNode
        ? [
            Lint.Replacement.appendText(
              parentNode.getEnd(),
              notStart ? ',)' : ')',
            ),
          ]
        : replaceWithPipeableOperators(parentNode, lastNode, true);
    // Generates a replacement for adding a ',' after the call expression
    const separatorReplacements = notStart
      ? [Lint.Replacement.appendText(currentNode.getEnd(), ',')]
      : [];
    return [operatorReplacement, ...separatorReplacements, ...moreReplacements];
  }

  /**
   * Returns the last chained NgRx call expression by walking up the AST.
   *
   * <p> For an expression like foo.map(Fn).switchMap(Fn) - the function starts
   * with node = foo. node.parent - represents the property expression foo.map and
   * node.parent.parent represents the call expression foo.map().
   *
   */
  function findLastObservableExpression(
    node: ts.Node,
    typeChecker: ts.TypeChecker,
  ): ts.Node {
    let currentNode = node;
    while (isAncestorNgrxOperatorCall(currentNode, typeChecker)) {
      currentNode = currentNode.parent!.parent!;
    }
    return currentNode;
  }

  /**
   * Returns true if the identifier of the current expression is an NgRx instance
   * operator like map, switchMap etc.
   */
  function isNgrxInstanceOperator(node: ts.PropertyAccessExpression) {
    return (
      'Observable' !== node.expression.getText() &&
      ngrxOperators.has(node.name.getText())
    );
  }
  /**
   * Returns true if {@link node} is a call expression containing an NgRx instance
   * operator and returns an observable. eg map(fn), switchMap(fn)
   */
  function isNgrxInstanceOperatorCallExpression(
    node: ts.Node,
    typeChecker: ts.TypeChecker,
  ) {
    // Expression is of the form fn()
    if (!tsutils.isCallExpression(node)) {
      return false;
    }
    // Expression is of the form foo.fn
    if (!tsutils.isPropertyAccessExpression(node.expression)) {
      return false;
    }
    // fn is one of NgRx instance operators
    if (!isNgrxInstanceOperator(node.expression)) {
      return false;
    }
    // fn(): k. Checks if k is an observable. Required to distinguish between
    // array operators with same name as NgRx operators.
    if (!returnsObservable(node, typeChecker)) {
      return false;
    }
    return true;
  }

  function checkPatchableOperatorUsage(node: ts.Node): void {
    // Navigate up the expression tree until a call expression with an NgRx
    // operator is found.
    // If the parent expression is also an NgRx operator call expression,
    // continue.
    // If not, then verify that the parent is indeed an observable.
    // files the node with the expression 'foo'.
    // Using the example above, the traversal would stop at 'foo'.
    if (!isNgrxInstanceOperatorCallExpression(node, typeChecker)) {
      return ts.forEachChild(node, checkPatchableOperatorUsage);
    }

    const immediateParent = (node as ts.CallExpression)
      .expression as ts.PropertyAccessExpression;

    // Get the preceeding expression (specific child node) to which the
    // current node was chained to. If node represents text like
    // foo.do(console.log).map( x =>2*x), then preceedingNode would have the
    // text foo.do(console.log).
    const preceedingNode = immediateParent.expression;

    // If the preceeding node is also an NgRx call then continue traversal.
    if (isNgrxInstanceOperatorCallExpression(preceedingNode, typeChecker)) {
      return ts.forEachChild(node, checkPatchableOperatorUsage);
    }

    if (
      !isObservable(typeChecker.getTypeAtLocation(preceedingNode), typeChecker)
    ) {
      return ts.forEachChild(node, checkPatchableOperatorUsage);
    }

    const failureStart =
      immediateParent.getStart(sourceFile) +
      immediateParent.getText(sourceFile).lastIndexOf('.');
    const lastNode = findLastObservableExpression(preceedingNode, typeChecker);
    const failureEnd = lastNode.getEnd();
    const pipeReplacement = Lint.Replacement.appendText(
      preceedingNode.getEnd(),
      '.pipe(',
    );
    const operatorReplacements = replaceWithPipeableOperators(
      preceedingNode,
      lastNode,
    );
    const allReplacements = [pipeReplacement, ...operatorReplacements];

    ctx.addFailure(failureStart, failureEnd, failureString, allReplacements);
    return ts.forEachChild(node, checkPatchableOperatorUsage);
  }
  return ts.forEachChild(ctx.sourceFile, checkPatchableOperatorUsage);
}

/**
 * Generates replacements to remove imports for patched operators.
 */
export function addOperatorsToImport({
  ctx,
  ngrxModule,
  ngrxOperators,
}: {
  ctx: Lint.WalkContext<void>;
  ngrxModule: string;
  ngrxOperators: Set<string>;
}) {
  const sourceFile = ctx.sourceFile;
  for (const importStatement of sourceFile.statements.filter(
    tsutils.isImportDeclaration,
  )) {
    if (!importStatement.importClause) {
      continue;
    }
    if (!importStatement.importClause.namedBindings) {
      continue;
    }
    if (!tsutils.isNamedImports(importStatement.importClause.namedBindings)) {
      continue;
    }
    if (!tsutils.isLiteralExpression(importStatement.moduleSpecifier)) {
      continue;
    }
    const moduleSpecifier = importStatement.moduleSpecifier.text;
    if (!moduleSpecifier.startsWith(ngrxModule)) {
      continue;
    }

    const namedImports = importStatement.importClause.namedBindings
      .getText(ctx.sourceFile)
      .slice(1, -1)
      .trim();
    const operatorsToImport = new Set<string>();
    for (const operator of Array.from(ngrxOperators)) {
      if (!namedImports.includes(operator)) {
        operatorsToImport.add(operator);
      }
    }

    if (operatorsToImport.size > 0) {
      const operatorsString = Array.from(operatorsToImport).join(', ');
      const fix = Lint.Replacement.replaceNode(
        importStatement.importClause!.namedBindings,
        `{ ${namedImports}, ${operatorsString} }`,
      );
      ctx.addFailureAtNode(
        importStatement,
        `should import ${operatorsString} from ${ngrxModule}`,
        [fix],
      );
      break;
    }
  }
}
