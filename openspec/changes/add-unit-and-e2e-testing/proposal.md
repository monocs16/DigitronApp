## Why

The project has zero automated tests. The only "E2E test" on record is a manual walkthrough documented in markdown (commit a154d68). Critical business logic — the service-order state machine, role-permission matrix, and budget gates — can silently break on any refactor. Adding a test suite now, before the codebase grows further, gives fast feedback on regressions and makes future changes safe to ship.

## What Changes

- Install and configure **Vitest** as the unit/component test runner (Bun-native, works without a server)
- Install and configure **Playwright** for end-to-end tests that drive a real browser against the local Supabase stack
- Write unit tests for all pure lib functions: state machine, access-control matrix, zod schemas, i18n helpers
- Write Playwright E2E tests covering the full happy-path service-order flow (8 stages) and the two main role scenarios (admin and technician)
- Add `test`, `test:unit`, and `test:e2e` npm scripts
- Add a Playwright fixture for authenticated sessions (admin and technician roles) against the local seed

## Capabilities

### New Capabilities

- `unit-testing`: Vitest configuration, test utilities, and unit/component tests for all pure business-logic modules (`state-machine`, `access`, `digitron`, zod schemas, `OrderStageStepper`)
- `e2e-testing`: Playwright configuration, auth fixtures seeded from local Supabase, and scenario tests for the full order flow and role-gated access

### Modified Capabilities

*(none — no existing spec requirements change)*

## Impact

**Code touched**
- New: `vitest.config.ts`, `playwright.config.ts`
- New: `src/lib/__tests__/` — unit tests for `state-machine.ts`, `access.ts`, `digitron.ts`
- New: `src/components/__tests__/` — component tests for `OrderStageStepper`, `StageBadge`, form dialogs
- New: `e2e/` — Playwright tests and fixtures
- New: `e2e/fixtures/auth.ts` — pre-authenticated browser contexts for admin and technician roles
- Modified: `package.json` — add test scripts and dev dependencies

**Dependencies added**
- `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/user-event` (unit/component)
- `@playwright/test` (E2E)

**Infrastructure**
- E2E tests require the local Supabase stack running (`supabase start`) and the seed admin present; they run in isolation against a known DB state
- Unit tests have no external dependencies and run in milliseconds

**Not in scope**
- CI pipeline integration (can follow as a separate change once tests are stable)
- Coverage enforcement thresholds (can be added once baseline is measured)
- Visual regression / screenshot diffing
