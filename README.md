# NgRx TSLint

TSLint rules for NgRx.
Heavily based on [ReactiveX/rxjs-tslint](https://github.com/ReactiveX/rxjs-tslint)

## Table of Contents

- [NgRx TSLint](#ngrx-tslint)
  - [Table of Contents](#table-of-contents)
  - [Rules](#rules)
    - [ngrx-effects-operators](#ngrx-effects-operators)
    - [ngrx-chained-pipes](#ngrx-chained-pipes)
  - [Usage](#usage)
  - [License](#license)

## Rules

### ngrx-effects-operators

Migrates the `ofType` function to its pipeable equivalent.

```ts
BEFORE:
import { Effect, Actions } from '@ngrx/effects';

@Effect()
search = this.actions.ofType<SearchAnimals>(SEARCH_ANIMALS).pipe(
    debounceTime(3000),
    switchMap(...),
  );

AFTER:
import { Effect, Actions, ofType } from '@ngrx/effects';

@Effect()
search = this.actions.pipe(
    ofType<SearchAnimals>(SEARCH_ANIMALS),
    debounceTime(3000),
    switchMap(...),
  );
```

### ngrx-chained-pipes

Because the rules above will create a new `pipe` chain you may end up with multiple pipes, this rule will combine both pipe chains.

```ts
BEFORE:
this.store.pipe(select(...)).pipe(map(...))

AFTER:
this.store.pipe(select(...), map(...))
```

## Usage

```json
{
  "rulesDirectory": ["node_modules/ngrx-tslint-oftype"],
  "rules": {
    "ngrx-effects-operators": true,
    "ngrx-chained-pipes": true
  }
}
```

## License

MIT
