import { argv } from 'optimist';
import { join } from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

if (!argv.p) {
  console.log(
    chalk.red('Provide path to your `tsconfig` file using the `-p` flag.'),
  );
  process.exit(1);
}

const command =
  '"' +
  join(__dirname, 'node_modules', '.bin', 'tslint') +
  '"' +
  ' -c ' +
  '"' +
  join(__dirname, 'ngrx-6-to-7-migrate.json') +
  '"' +
  ' -p ' +
  '"' +
  argv.p +
  '"' +
  ' --fix';

const migrate = () => {
  const errors = execSync(command).toString() || '';
  if (errors.indexOf('WARNING:') >= 0) {
    return errors + migrate();
  }
  return '';
};

process.stdout.write(
  chalk.yellow(
    'Running the automatic migrations. Please, be patient and wait until the execution completes.\n',
  ),
);

const errors = migrate();
if (errors) {
  process.stdout.write(
    chalk.blue('Found and fixed the following deprecations:\n'),
  );
  process.stdout.write(chalk.yellow(`\n${errors}`));
} else {
  process.stdout.write(chalk.blue('Cannot find any possible migrations\n'));
}
