// Original author Bowen Ni, Shino Kurian, Michael Lorton.
// RxJS Modifications mgechev.
// NgRx Modifications Tim Deschryver

import * as Lint from 'tslint';
import * as ts from 'typescript';
import chalk from 'chalk';
import {
  replacePipeableOperators,
  addOperatorsToImport,
} from './pipeableRuleUtils';

export class Rule extends Lint.Rules.TypedRule {
  static metadata: Lint.IRuleMetadata = {
    ruleName: 'ngrx-effects-operators',
    description: 'use ngrx effects pipeable operators',
    optionsDescription: '',
    options: null,
    typescriptOnly: true,
    type: 'functionality',
  };
  static FAILURE_STRING = 'use ngrx effects pipeable operators.';
  static NGRX_MODULE = '@ngrx/effects';
  static NGRX_OPERATORS = new Set(['ofType']);

  applyWithProgram(
    sourceFile: ts.SourceFile,
    program: ts.Program,
  ): Lint.RuleFailure[] {
    console.log(
      chalk.gray(
        `[${Rule.metadata.ruleName}]: analyzing ${sourceFile.fileName}`,
      ),
    );

    return this.applyWithFunction(sourceFile, ctx => {
      this.walk(ctx, program);
      if (ctx.failures.length) {
        addOperatorsToImport({
          ctx,
          ngrxModule: Rule.NGRX_MODULE,
          ngrxOperators: Rule.NGRX_OPERATORS,
        });
      }
    });
  }

  private walk(ctx: Lint.WalkContext<void>, program: ts.Program) {
    replacePipeableOperators({
      ctx,
      program,
      failureString: Rule.FAILURE_STRING,
      ngrxModule: Rule.NGRX_MODULE,
      ngrxOperators: Rule.NGRX_OPERATORS,
    });
  }
}
