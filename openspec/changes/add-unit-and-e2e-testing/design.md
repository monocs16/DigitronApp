## Context

The project has no automated tests. The only test coverage was a manual E2E walkthrough documented
in markdown (commit a154d68). The core business logic lives in three pure lib modules:

- `src/lib/state-machine.ts` — stage transition graph and role/gate guards
- `src/lib/access.ts` — role-to-module permission matrix and helper functions
- `src/lib/digitron.ts` — domain type constants and label helpers

These modules have zero external dependencies and are trivially unit-testable. The frontend forms and
order-detail page carry integration complexity (Supabase, TanStack Query) that requires a different
strategy.

The runtime is Bun + Vite. The backend is Supabase (local Docker stack) with RLS. There are no
Express controllers or custom server processes — just Supabase + TanStack Start server functions
deployed on Cloudflare Workers.

---

## Goals / Non-Goals

**Goals:**

- Unit test all pure lib functions in `src/lib/` with Vitest (fast, Bun-native)
- E2E test the critical service-order happy path (all 8 stages) with Playwright against the local
  Supabase stack
- E2E test role-gated access (admin vs technician flows)
- Minimal configuration friction — tests run with a single command

**Non-Goals:**

- Component tests for UI elements (deferred — requires jsdom + render setup complexity)
- Visual regression / screenshot diffing
- CI pipeline integration (covered by a future change)
- Coverage thresholds enforcement (will follow once baseline is measured)
- Testing server functions deployed to Cloudflare (environment too complex for this change)

---

## Decisions

### 1. Test runner: Vitest over Jest

**Decision**: Vitest

**Rationale**: Vitest is Vite-native and shares the same config pipeline as the app, meaning it
reads the project's `tsconfig.json`, path aliases (`@/`), and environment without extra bridging.
Jest requires Babel or ts-jest, neither of which fits cleanly in a Bun+Vite project. Vitest also
runs in Bun natively and is significantly faster for isolated unit tests.

**Alternative considered**: Bun's built-in test runner (`bun test`). It's zero-config but lacks
Vite plugin integration, making `@/` alias resolution and any Vite-transform-dependent code fail
without extra setup. Vitest is the right choice at this project scale.

### 2. E2E runner: Playwright over Cypress

**Decision**: Playwright (`@playwright/test`)

**Rationale**: Playwright supports all major browsers including WebKit (Safari), has first-class
TypeScript support without extra config, and ships its own test runner with parallelism and retries
built in. The fixture system (`test.extend`) is well-suited for pre-authenticated browser contexts.
Cypress would require an additional auth plugin, has worse TypeScript DX, and is slower on headless
runs.

### 3. Supabase isolation strategy

**Decision**: Unit tests mock nothing (pure functions only). E2E tests hit the real local Supabase
stack seeded with known data.

**Rationale**: The lib modules being unit-tested have no I/O. Mocking Supabase for unit tests adds
no value and creates false confidence. E2E tests need real RLS enforcement — if RLS policy is
misconfigured, only a real DB hit will catch it.

**Risk**: E2E tests require `supabase start` to be running. The test command will fail fast if the
local stack is down (Playwright's `baseURL` check will produce a clear error).

### 4. Auth fixture approach

**Decision**: Use Playwright's `storageState` to persist authenticated sessions for `admin` and
`technician` roles. A global setup script logs in each user via the app's login page and saves the
storage state JSON to `e2e/fixtures/`.

**Rationale**: Re-authenticating before each test is slow and brittle. `storageState` snapshots the
browser's cookies and localStorage after login and re-uses them instantly in subsequent tests.

### 5. Vitest config isolation

**Decision**: Create a dedicated `vitest.config.ts` that extends the Vite config rather than adding
a `test` block to `vite.config.ts`.

**Rationale**: Keeps the build config clean. The `vite.config.ts` is used by Cloudflare Workers
deployment — injecting test config there risks side effects. Extending it in `vitest.config.ts`
shares plugins and aliases without polluting build config.

---

## Risks / Trade-offs

- **E2E flakiness on async UI** → Playwright's `waitForResponse` and `expect(locator).toBeVisible()`
  auto-wait up to the configured timeout. Test selectors should target `data-testid` attributes or
  accessible roles, not CSS classes that may change.

- **Local Supabase seed drift** → E2E tests assert against specific seed data (admin user, sample
  order). If the seed changes, tests break. Mitigation: seed script is pinned to a known state in
  `supabase/seed.sql`; document which records E2E tests depend on.

- **Vitest + React 19 + TanStack Router** → Component tests are deferred precisely because the
  render environment for React 19 with TanStack Router requires additional setup (RouterContext
  provider, QueryClient wrapper). Starting with pure lib unit tests avoids this entirely.

- **`@/` alias in Vitest** → Must explicitly configure `resolve.alias` in `vitest.config.ts`;
  otherwise imports fail. Solved by extending the Vite config that already defines the alias.

---

## Migration Plan

1. Install test dependencies (devDependencies only)
2. Create `vitest.config.ts`
3. Create `playwright.config.ts`
4. Create `e2e/global-setup.ts` for auth storage state generation
5. Write unit tests for `state-machine.ts`, `access.ts`, `digitron.ts`
6. Write E2E happy-path test
7. Add `test`, `test:unit`, `test:e2e` scripts to `package.json`

No rollback needed — all additions are dev tooling that does not touch production code.

---

## Open Questions

- Should the E2E `global-setup.ts` create test users via Supabase admin API or rely on
  `supabase/seed.sql`? → Decision: rely on seed SQL for now; the admin seed user exists already.
- Do we need a separate Playwright project for mobile viewport? → Deferred to a future change.
