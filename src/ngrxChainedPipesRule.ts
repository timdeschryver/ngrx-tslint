// Original author Bowen Ni, Shino Kurian, Michael Lorton.
// RxJS Modifications mgechev.
// NgRx Modifications Tim Deschryver

import * as Lint from 'tslint';
import * as tsutils from 'tsutils';
import * as ts from 'typescript';
import chalk from 'chalk';
import { isObservable, returnsObservable } from './utils';

export class Rule extends Lint.Rules.TypedRule {
  static metadata: Lint.IRuleMetadata = {
    ruleName: 'ngrx-chained-pipes',
    description: 'checks if pipes are chained.',
    optionsDescription: '',
    options: null,
    typescriptOnly: true,
    type: 'functionality',
  };
  static FAILURE_STRING = 'prefer having no pipes chained.';

  applyWithProgram(
    sourceFile: ts.SourceFile,
    program: ts.Program,
  ): Lint.RuleFailure[] {
    console.log(
      chalk.gray(
        `[${Rule.metadata.ruleName}]: analyzing ${sourceFile.fileName}`,
      ),
    );
    return this.applyWithFunction(sourceFile, ctx => this.walk(ctx, program));
  }

  private walk(ctx: Lint.WalkContext<void>, program: ts.Program) {
    const typeChecker = program.getTypeChecker();

    function checkPatchableOperatorUsage(node: ts.Node): void {
      // Navigate up the expression tree until a call expression with an rxjs pipe
      // operator is found.
      // If the parent expression is also an rxjs pipe operator call expression,
      // continue.
      // If not, then verify that the parent is indeed an observable.
      // files the node with the expression 'foo'.
      // Using the example above, the traversal would stop at 'foo'.
      if (!isPipeInstanceOperatorCallExpression(node, typeChecker)) {
        return ts.forEachChild(node, checkPatchableOperatorUsage);
      }
      const immediateParent = (node as ts.CallExpression)
        .expression as ts.PropertyAccessExpression;
      // Get the preceeding expression (specific child node) to which the
      // current node was chained to. If node represents text like
      // foo.do(console.log).map( x =>2*x), then preceedingNode would have the
      // text foo.do(console.log).
      const preceedingNode = immediateParent.expression;
      // If the preceeding node is also an RxJS pipe call then continue traversal.
      if (isPipeInstanceOperatorCallExpression(preceedingNode, typeChecker)) {
        return ts.forEachChild(node, checkPatchableOperatorUsage);
      }

      if (
        !isObservable(
          typeChecker.getTypeAtLocation(preceedingNode),
          typeChecker,
        )
      ) {
        return ts.forEachChild(node, checkPatchableOperatorUsage);
      }

      const pipes = findLastObservableExpression(preceedingNode, typeChecker);
      if (pipes.length === 0) {
        return ts.forEachChild(node, checkPatchableOperatorUsage);
      }

      const [firstNode, secondNode] = pipes;
      if (firstNode.getStart() !== secondNode.getStart()) {
        return ts.forEachChild(node, checkPatchableOperatorUsage);
      }

      // only continue if the next operator is a pipe
      if (
        !secondNode
          .getText()
          .substring(firstNode.getEnd() - secondNode.getStart())
          .trim()
          .startsWith('.pipe')
      ) {
        return ts.forEachChild(node, checkPatchableOperatorUsage);
      }

      const failureStart = firstNode.getStart();
      const failureEnd = secondNode.getEnd();

      // replace pipe(a).pipe(b) with pipe(a, b)
      // also check if first pipe ends with , - replace pipe(a,).pipe(b) with pipe(a, b)
      const pipeReplacement = Lint.Replacement.replaceFromTo(
        firstNode.getEnd() - 1,
        firstNode.getEnd() +
          secondNode
            .getText()
            .substring(firstNode.getEnd() - secondNode.getStart())
            .indexOf('.pipe(') +
          6,
        firstNode
          .getText()
          .substring(0, firstNode.getEnd() - firstNode.getStart() - 1)
          .trim()
          .endsWith(',')
          ? ''
          : ',',
      );

      ctx.addFailure(
        failureStart,
        failureEnd,
        Rule.FAILURE_STRING,
        pipeReplacement,
      );
      return ts.forEachChild(node, checkPatchableOperatorUsage);
    }
    return ts.forEachChild(ctx.sourceFile, checkPatchableOperatorUsage);
  }
}

/**
 * Returns true if the identifier of the current expression is an RxJS pipe instance operator
 */
function isPipeInstanceOperator(node: ts.PropertyAccessExpression) {
  return (
    'Observable' !== node.expression.getText() && node.name.getText() === 'pipe'
  );
}

/**
 * Returns true if {@link node} is a call expression containing an RxJS pipe instance operator
 */
function isPipeInstanceOperatorCallExpression(
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
  // fn is one of RxJs instance operators
  if (!isPipeInstanceOperator(node.expression)) {
    return false;
  }
  // fn(): k. Checks if k is an observable. Required to distinguish between
  // array operators with same name as RxJs operators.
  if (!returnsObservable(node, typeChecker)) {
    return false;
  }
  return true;
}

/**
 * Returns true if the grandfather of the {@link node} is a call expression of
 * an RxJs pipe instance operator.
 */
function isAncestorPipeOperatorCall(
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
  return isPipeInstanceOperatorCallExpression(node.parent.parent, typeChecker);
}

function findLastObservableExpression(
  node: ts.Node,
  typeChecker: ts.TypeChecker,
): ts.Node[] {
  let currentNode = node;
  let first = true;
  while (isAncestorPipeOperatorCall(currentNode, typeChecker)) {
    if (first) {
      currentNode = currentNode.parent!.parent!;
      first = false;
    }
    return [currentNode, currentNode.parent!.parent!];
  }
  return [];
}
