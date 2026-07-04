# Backend v2 Playwright Lifecycle

## Observed Problem

During Backend v2 local validation, full Playwright shards sometimes failed with `ERR_CONNECTION_REFUSED` against `http://127.0.0.1:4173/`. Targeted reruns passed after manually clearing port `4173`, which isolated the issue as local preview lifecycle instability rather than a Backend v2 business assertion failure.

## Probable Cause

The previous Playwright `webServer` used:

```text
npm run build && npm run preview -- --host 127.0.0.1 --port 4173
```

On Windows, long shard runs could leave an npm/Vite preview process behind or lose the preview child process while tests were still running. That caused two failure modes:

- a stale listener on port `4173` blocked the next run;
- the preview server disappeared mid-shard, creating cascaded `ERR_CONNECTION_REFUSED` failures.

## Applied Solution

Playwright now uses a dedicated Node static server:

```text
node scripts/cleanup-playwright-preview.mjs && npm run build && node scripts/serve-playwright-preview.mjs
```

The server:

- serves the built `dist/` artifact under `/NIMR-SAV-PRO/`;
- exposes `/__nimr_playwright_health` for Playwright readiness;
- avoids the Vite preview npm wrapper during E2E;
- keeps host `127.0.0.1` and port `4173`.

The cleanup script:

- inspects port `4173`;
- stops only command lines that match `serve-playwright-preview.mjs`, `vite preview`, or npm preview on that port;
- leaves unrelated processes untouched and prints what it did.

## Commands

Recommended local commands:

```bash
npm run test:e2e:clean
npm run test:e2e:shard1
npm run test:e2e:shard2
npm run test:e2e:shard3
```

The original direct commands remain valid:

```bash
npx playwright test --shard=1/3 --reporter=line
npx playwright test --shard=2/3 --reporter=line
npx playwright test --shard=3/3 --reporter=line
```

If a local run is interrupted, run `npm run test:e2e:clean` before retrying.

## Infra Failure vs Business Failure

Infrastructure failure:

- `ERR_CONNECTION_REFUSED`
- port `4173` already used
- failure at `page.goto("/")` or `page.reload()` before app assertions

Business failure:

- selector exists but content is wrong;
- expected button/state/message is missing;
- localStorage/app state assertion fails.

Only business failures should be treated as Backend v2 regressions.

## Limits

Windows process inspection relies on `netstat.exe` and PowerShell `Get-CimInstance`. On non-Windows systems the cleanup script falls back to `lsof` and `ps` when available.

GitHub Actions remains the final source of truth after push. Local stabilization reduces noise, but CI still validates the clean runner environment.

## Decision

GO Playwright local lifecycle stabilization.

NO GO commit/push until lint, unit tests, build, QA, targeted E2E, and full shards are green or a remaining instability is clearly isolated and accepted.
