# NgRx TSLint

TSLint rules for NgRx.
Heavily based on [ReactiveX/rxjs-tslint](https://github.com/ReactiveX/rxjs-tslint)

## Table of Contents

- [Rules](#rules)
  - [ngrx-store-operators](#ngrx-store-operators)
  - [ngrx-effects-operators](#ngrx-effects-operators)
  - [ngrx-chained-pipes](#ngrx-chained-pipes)
- [Usage](#usage)
- [LICENSE](#license)

## Rules

### ngrx-store-operators

Migrates the `select` function to its pipeable equivalent.

```ts
BEFORE: import { Store } from '@ngrx/store';

this.animals = this.store.select(getWildAnimals);

AFTER: import { Store, select } from '@ngrx/store';

this.animals = this.store.pipe(select(getWildAnimals));
```

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
  "rulesDirectory": ["node_modules/ngrx-tslint"],
  "rules": {
    "ngrx-store-operators": true,
    "ngrx-effects-operators": true,
    "ngrx-chained-pipes": true
  }
}
```

## License

MIT
