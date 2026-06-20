## 1. Dependencies and Tooling Setup

- [ ] 1.1 Install Vitest, @vitest/ui, jsdom, @testing-library/react, @testing-library/user-event as devDependencies
- [ ] 1.2 Install @playwright/test as devDependency
- [ ] 1.3 Install Playwright browsers (`bunx playwright install chromium`)
- [ ] 1.4 Create `vitest.config.ts` extending Vite config with jsdom environment and `@/` alias resolution
- [ ] 1.5 Create `playwright.config.ts` with baseURL, two projects (admin/technician), globalSetup, and storageState paths
- [ ] 1.6 Add `test:unit`, `test:e2e`, and `test` scripts to `package.json`

## 2. Unit Tests — State Machine

- [ ] 2.1 Create `src/lib/__tests__/state-machine.test.ts`
- [ ] 2.2 Test all valid stage transitions return `true` from `canTransition`
- [ ] 2.3 Test invalid (skipped) transitions return `false`
- [ ] 2.4 Test unauthorized role returns `false`
- [ ] 2.5 Test `super` role bypasses actor restrictions for valid transitions
- [ ] 2.6 Test `repair` gate blocks when `budgetApproved = false`
- [ ] 2.7 Test `delivered` gate blocks when `balanceSettled = false`
- [ ] 2.8 Test unassigned technician gets empty `allowedNextStages`
- [ ] 2.9 Test `closed` stage returns empty allowed next stages for all roles

## 3. Unit Tests — Access Matrix

- [ ] 3.1 Create `src/lib/__tests__/access.test.ts`
- [ ] 3.2 Test `administrativo` has `edit` on `clientes`
- [ ] 3.3 Test `tecnico` cannot read `clientes`
- [ ] 3.4 Test multi-role composite picks the highest level
- [ ] 3.5 Test `super` has `edit` on all modules (parameterized over `MODULES`)
- [ ] 3.6 Test empty roles array returns `none`

## 4. Unit Tests — Domain Constants and Helpers

- [ ] 4.1 Create `src/lib/__tests__/digitron.test.ts`
- [ ] 4.2 Test `getStageLabel` returns `t("stage.<stage>")` via pass-through mock
- [ ] 4.3 Test `getRoleLabel` returns `t("roles.<role>")` via pass-through mock
- [ ] 4.4 Test `getDecisionLabel` returns `t("decision.<decision>")` via pass-through mock
- [ ] 4.5 Test unknown string input falls back to the raw string without throwing

## 5. E2E Auth Setup

- [ ] 5.1 Create `e2e/` directory and `e2e/fixtures/` directory with `.gitkeep`
- [ ] 5.2 Create `e2e/global-setup.ts` that logs in as admin and saves `admin-state.json`
- [ ] 5.3 Extend `e2e/global-setup.ts` to log in as technician and save `technician-state.json`
- [ ] 5.4 Add `e2e/fixtures/*.json` to `.gitignore` (credentials, not to be committed)
- [ ] 5.5 Verify global-setup runs before tests and both state files are generated

## 6. E2E Tests — Admin Happy Path

- [ ] 6.1 Create `e2e/tests/order-flow.spec.ts`
- [ ] 6.2 Test admin creates a new order and lands on detail page at `intake` stage
- [ ] 6.3 Test admin advances `intake` → `evaluation`
- [ ] 6.4 Test admin advances `evaluation` → `budget`
- [ ] 6.5 Test admin fills budget, approves, → `customer_decision`
- [ ] 6.6 Test admin starts repair → `repair` stage
- [ ] 6.7 Test admin registers payment → `payment` then `delivered`
- [ ] 6.8 Test admin closes order → `closed`, no further actions shown

## 7. E2E Tests — Technician Role Gates

- [ ] 7.1 Create `e2e/tests/technician-access.spec.ts`
- [ ] 7.2 Test technician can view detail of an order assigned to them
- [ ] 7.3 Test technician does NOT see "Move to Evaluation" action on `intake` orders
- [ ] 7.4 Test technician can submit evaluation (diagnosis) on assigned `evaluation` order

## 8. Verification

- [ ] 8.1 Run `bun run test:unit` — all unit tests pass
- [ ] 8.2 Run `bun run test:e2e` with local Supabase running — all E2E tests pass
- [ ] 8.3 Run `bun run tsc --noEmit` — zero TypeScript errors
