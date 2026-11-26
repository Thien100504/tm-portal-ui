# CI pipeline

Workflow: `.github/workflows/ci.yml`. Branch flow: feature branch → PR into `develop` → release PR `develop` → `main` (squash) → tag `vX.Y.Z`.

## What runs where

| Job | PR → `develop` | PR → `main` (release) | push `develop` | push `main` / tag `v*` |
|---|---|---|---|---|
| Lint, format and build | always | always | always | always |
| API contract | only if `src/**/*.js(x)`, `scripts/check-api-contract.mjs` or `ci.yml` changed | always | – | – |
| Docker image | – | – | – | always |

The `Detect changes` job compares the PR merge commit with its first parent. Release PRs skip the filter on purpose: everything that ships to `main` gets the full check.

## API contract

`scripts/check-api-contract.mjs` finds every API call in `src/` (`api.get/post/put/patch/delete(...)` and `fetch(...)` to the API) and checks that the method and path exist in the portal-api OpenAPI spec. Path parameters match by position, so `/tasks/${id}` matches `/api/v1/tasks/{task_id}`; query strings are ignored. The job generates the spec from `tm-portal-api@develop`.

portal-api runs the same script the other way round: an API PR that renames or removes an endpoint the UI still calls fails there.

Run it locally (from a portal-api checkout next to this repo):

```bash
python -c "import json; from app.main import app; json.dump(app.openapi(), open('openapi.json', 'w'))"
node ../tm-portal-ui/scripts/check-api-contract.mjs --openapi openapi.json --src ../tm-portal-ui/src
```

Add `--report-only` to print mismatches without failing.

## Why this check exists

The API and the UI live in separate repos and are released separately, so nothing stopped an endpoint the UI calls from being renamed, removed or changing method until users hit a 404/405. The first run found no mismatches (94 calls). Database checks live in portal-api (see its `docs/ci.md`), and the 2026-11-26 Kanban drag offset fix (v1.0.3) is the kind of bug only a browser test would catch; that full-stack test was deferred because of its cost.
