# Branch workflow

`dev` is the integration branch for ongoing development. `main` is the release branch.

## Normal development

1. Implement work on an issue branch when isolation is useful.
2. Merge completed work into `dev`.
3. Keep `dev` green: typecheck, tests, library build and demo build must pass.

## Releasing `dev` to `main`

1. Confirm `dev` is up to date with `main`.
2. Open and merge the release PR from `dev` to `main`.
3. After the release merge, immediately bring the resulting `main` history back into `dev`.
4. Verify `main...dev` reports `dev` as ahead (or identical), never behind/diverged.

The post-release synchronization is required even when the release merge does not change file contents. A merge commit created on `main` still changes branch ancestry, and leaving that commit outside `dev` makes later release comparisons diverge.

Use a normal merge or fast-forward where applicable. Do not force-push or rewrite shared branch history to reconcile `main` and `dev`.

## Before the next release

Run the same validation enforced by CI:

```bash
npm run typecheck
npm run typecheck:demo
npm test
npm run build
npm run build:demo
```
