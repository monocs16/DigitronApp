---
description: Claude-specific entry point for Digitron App. It supplements AGENTS.md and the canonical engineering and business-flow documentation.
alwaysApply: true
---

# CLAUDE.md — Digitron App

This file contains Claude-specific working rules. It does **not** replace the project sources of truth. Read these first:

1. [`AGENTS.md`](./AGENTS.md) — security, Supabase client boundaries, commands, and completion checklist.
2. [`ENGINEERING.md`](./ENGINEERING.md) — current architecture, data access, database invariants, testing, and deployment.
3. [`docs/service-order-flow.md`](./docs/service-order-flow.md) — canonical order lifecycle and actors.
4. [`docs/data-model.md`](./docs/data-model.md) and [`README.md`](./README.md) — entities, permissions, setup, and user-facing capabilities.

## Current Project Context

- Digitron is a Spanish-language internal service-order application built with React 19, TanStack Start/Router/Query, Supabase Postgres/Auth/Storage, RLS, and Tailwind/shadcn.
- Normal CRUD follows `component → TanStack Query → src/lib/repositories/* → supabase-js → Supabase Data API/PostgREST`. For example, `/equipment` calls `equipmentRepository.getAll()`; there is no custom REST route for that read.
- Sensitive workflow operations use authenticated TanStack `createServerFn` handlers. User administration is the only current application workflow that uses service role and must remain server-only; the one-off historical import is privileged tooling, not browser code.
- The active order path uses `awaiting_withdrawal`, not the removed `delivered` value. A rejected estimate remains pending pickup; delivery records `received_by` and closes the order.
- Schema-dependent code and its migration are one deploy unit. Apply migrations locally and remotely and regenerate `src/integrations/supabase/types.ts` before deploying code that selects new fields such as `equipment.description`.
- The parts catalog includes optional `location`, `datasheet`, `nte_substitute`, and `image` metadata. Technicians read safe fields from the RLS tables `parts_technician` and `order_parts_technician`; these are trigger-maintained read models, not security-definer views, and must never include stock, unit cost, supplier, or commercial snapshots.
- Never turn a failed query into an empty collection. Repositories propagate errors; screens distinguish loading, legitimate empty data, and failure, and provide an actionable retry.
- Only quoted parts recalculate `budgets.parts_cost`. Recording a used part requires a quoted line and stock, and must preserve the approved budget.
- `/reports` is a configurable RLS-scoped order list, not the former summary dashboard. `OrderReportBuilder` owns header selection/order and typed client-side filters; the visible order must remain identical in CSV, SpreadsheetML/Excel, and PDF exports. The report seed is local-only and rejects non-loopback targets.
- Production CD runs quality checks, E2E against local Supabase, then deploys to Vercel. Cloudflare Workers remains a supported alternate build.

## 1. Core Principles

- **Small tasks, one at a time**: Always work in baby steps, one at a time. Never go forward more than one step.
- **Test-Driven Development**: Start with failing tests for any new functionality (TDD), according to the task details.
- **Type Safety**: All code must be fully typed.
- **Clear Naming**: Use clear, descriptive names for all variables and functions.
- **Incremental Changes**: Prefer incremental, focused changes over large, complex modifications.
- **Question Assumptions**: Always question assumptions and inferences.
- **Pattern Detection**: Detect and highlight repeated code patterns.

## 2. Language Standards

- Use English for code identifiers, technical comments, log/error strings, schemas, configuration, scripts, commit messages, and test names.
- The product UI is Spanish-first. Add reusable visible copy through i18n and keep `src/locales/es.ts` and `src/locales/en.ts` aligned.
- Preserve the established language of an existing document. `AGENTS.md`, `ENGINEERING.md`, and `README.md` are currently Spanish operational guides; do not introduce mixed-language paragraphs into them. New standalone technical documentation follows [`docs/documentation-standards.md`](./docs/documentation-standards.md).

## 3. Specific standards

For detailed standards and guidelines specific to different areas of the project, refer to:

- [Agent Guide](./AGENTS.md) - mandatory repository-specific safety and workflow rules
- [Engineering Guide](./ENGINEERING.md) - architecture, Supabase boundaries, database invariants, testing, and deployment
- [Service Order Flow](./docs/service-order-flow.md) — **canonical business process diagram**. Any work touching stage transitions, role gating, UI actions, or server functions must consult this first. Update it before changing implementation.
- [Data Model](./docs/data-model.md) - entities and permission model
- [Backend Standards](./docs/backend-standards.md) - API development, database patterns, testing, security and backend best practices
- [Frontend Standards](./docs/frontend-standards.md) - React components, UI/UX guidelines, and frontend architecture
- [Documentation Standards](./docs/documentation-standards.md) - Technical documentation structure, formatting, and maintenance guidelines, including AI standards like this document
- [OpenSpec Tasks Mandatory Steps](./docs/openspec-tasks-mandatory-steps.md) - Required checklist and execution rules when creating or updating OpenSpec `tasks.md` files
- [Code Review Log](./docs/code-review-log.md) - Living journal of code reviews: per-review entries anchored to commit SHAs, SOLID compliance matrix, architecture baseline, and action items. Append a new entry here after every `/code-review` or `/code-auditing` run.

Repository-specific verification takes precedence over generic examples:

- Run `pnpm run ci:check` for every implementation change.
- Run `pnpm run test:e2e` for auth, RLS, migrations, routing, or service-order workflow changes.
- In order-detail E2E tests, expand collapsible modules with the shared helpers and scope locators to the relevant card.
- Seed trigger-owned data in dependency order. In particular, create a scenario-specific budget before quoted parts because the quoted-part trigger can create/upsert that budget.
- Verify the affected deployment target with `pnpm run build:vercel` or `pnpm run build`.

## 4. Project Skills

- Skills live in `ai-specs/skills`.
- When a request matches a skill, load and follow the corresponding `SKILL.md` automatically before continuing.
- Also load any referenced files in the skill folder (for example, `references/*.md`) when the skill requires them.

## 5. Planning Model Requirement

Planning workflows must run with Opus high reasoning.

This requirement applies to:

- `enrich-us`
- `openspec-ff-change`
- `openspec-continue-change`

Before starting any of these workflows, verify the session is using Opus high reasoning. If it is not, **self-correct** by adding `"model": "claude-opus-4-7"` to `.claude/settings.json` (use the `update-config` skill or edit directly), then continue — do not stop and ask the user. Do the same to come back to sonnet medium for any other step.

## 6. Symlink Integrity and Multi-Agent Portability

- **Canonical Source**: Keep reusable artifacts in `ai-specs` as the canonical source. Agent-specific paths (such as `.claude` and `.cursor`) should reference them through symlinks when possible.
- **Update Safety**: Whenever a file is renamed, moved, or its suffix changes, verify and update all symlinks that target it before considering the change complete.
- **New Artifact Linking**: Whenever creating a new artifact that requires multi-agent exposure (for example new agents or skills in `ai-specs`), create the corresponding symlinks from the expected agent-specific reference paths.
- **External Customization Review**: Whenever customization is introduced outside `ai-specs`, evaluate whether it should be moved into `ai-specs` and replaced with symlinks from the original locations.
- **Completion Gate**: A change is incomplete if it leaves broken symlinks, stale targets, or duplicated canonical artifacts across agent-specific folders.

## 7. Mandatory OpenSpec Artifact Updates for Post-Apply Changes

When a new fix/change request appears after `opsx:apply` (or `/apply`) and before `opsx:archive` (or `/archive`), agents must treat it as a spec update first, not as an informal "fix this quickly". It's the core principle of openspec, documentation is the source of truth.

Required order:

1. Update the current OpenSpec change artifacts that are affected (for example: scenarios, requirements/specs, and `tasks.md`). Don't add tasks as "bugfixes" but as part of the initial design, thus in the proper section
2. If artifact regeneration is needed, run the corresponding OpenSpec step (`opsx:continue`, `opsx:ff`, or equivalent) before coding.
3. Implement code only after artifacts reflect the new request.
4. Re-run verification against the updated artifacts before archiving.

Do not apply direct code-only fixes in this window without updating OpenSpec artifacts.
