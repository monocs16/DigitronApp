# Initialize the Harness in a New Project

Use this guide after copying `harness-lidr-sdd` into your project.

## 1. Copy the harness

### New project (harness is the base)

```bash
cp -R /path/to/harness-lidr-sdd/ /path/to/my-project/
cd /path/to/my-project
git init   # if starting fresh
```

### Existing project (merge harness in)

```bash
TARGET=/path/to/my-existing-project
HARNESS=/path/to/harness-lidr-sdd

cp -R "$HARNESS/ai-specs"     "$TARGET/"
cp -R "$HARNESS/openspec"     "$TARGET/"
cp -R "$HARNESS/.cursor"      "$TARGET/"
cp -R "$HARNESS/.claude"      "$TARGET/"
cp -R "$HARNESS/.codegraph"   "$TARGET/"
cp    "$HARNESS/AGENTS.md"    "$TARGET/"
cp    "$HARNESS/CLAUDE.md"    "$TARGET/"

mkdir -p "$TARGET/docs"
cp "$HARNESS/docs/base-standards.md" \
   "$HARNESS/docs/documentation-standards.md" \
   "$HARNESS/docs/openspec-tasks-mandatory-steps.md" \
   "$HARNESS/docs/backend-standards.md" \
   "$HARNESS/docs/frontend-standards.md" \
   "$TARGET/docs/"
```

Merge `.gitignore` entries for harness runtime paths:

```
tmp/
.worktrees/
.mcp.json
```

---

## 2. Understand what is harness vs project-specific

### Harness (copy as-is, same in every project)

These files define **how AI agents work**. You rarely change them per feature.

```
ai-specs/          # agents, skills, scripts
.cursor/           # Cursor rules, commands, skills
.claude/           # Claude commands, skills, worktree scripts
openspec/config.yaml
openspec/schemas/
AGENTS.md
CLAUDE.md
docs/base-standards.md
docs/documentation-standards.md
docs/openspec-tasks-mandatory-steps.md
```

### Project-specific (you create or customize per project)

These files define **what your application is**. Agents read them when implementing features.

| File                                  | Purpose                           | When to create                       |
| ------------------------------------- | --------------------------------- | ------------------------------------ |
| `docs/api-spec.yml`                   | REST/API contracts                | Before first backend feature         |
| `docs/data-model.md`                  | Domain entities and relationships | Before first data model work         |
| `docs/development_guide.md`           | How to run, test, deploy the app  | When the app is runnable             |
| `docs/backend-standards.md`           | Backend conventions               | Customize from harness copy          |
| `docs/frontend-standards.md`          | Frontend conventions              | Customize from harness copy          |
| `openspec/specs/<capability>/spec.md` | Capability requirements           | Created by OpenSpec as features land |
| `openspec/changes/<change>/`          | Active feature work               | Created per change via `opsx:new`    |

---

## 3. Customize for your project

### 3.1 `openspec/config.yaml`

Replace the LTI example context with your project:

```yaml
context: |
  Tech stack: <!-- your stack -->
  Architecture: <!-- your architecture -->
  Domain: <!-- your product -->
  All code, comments, documentation, and technical artifacts must be in English

  Project specs: read and apply docs/base-standards.md, docs/backend-standards.md,
  docs/frontend-standards.md, docs/api-spec.yml, docs/data-model.md
```

Update `rules` if your testing or branch naming conventions differ.

### 3.2 `docs/backend-standards.md` and `docs/frontend-standards.md`

The harness ships with LTI examples (Express, Prisma, React). Edit these to match your stack, folder structure, and testing tools.

### 3.3 `ai-specs/agents/*.md`

Adjust agent personas if your stack differs from the defaults (Node/Express/Prisma backend, React frontend).

### 3.4 Project documentation (create these)

**`docs/api-spec.yml`** — OpenAPI spec for your endpoints. Agents use it to keep API changes consistent.

**`docs/data-model.md`** — entities, fields, relationships. Agents use it when changing the database or domain layer.

**`docs/development_guide.md`** — prerequisites, env setup, how to run backend/frontend, how to run tests. For humans and agents doing manual verification.

You can start with empty stubs and fill them as the project grows:

```bash
# Minimal stubs to unblock agents
touch docs/api-spec.yml docs/data-model.md docs/development_guide.md
```

---

## 4. Verify the harness works

```bash
# Install OpenSpec CLI
npm install -g @fission-ai/openspec
openspec --version

# Confirm schema is available
openspec schemas
```

In Cursor or Claude Code:

1. Open the project
2. Run `/opsx:onboard` for a guided first change cycle
3. Or run `/opsx:new my-first-feature` to start manually

---

## 5. Day-to-day usage

| Step                | Command / skill | What happens                                     |
| ------------------- | --------------- | ------------------------------------------------ |
| Enrich a user story | `enrich-us`     | Jira ticket → implementation-ready spec          |
| Start a change      | `/opsx:new`     | Creates `openspec/changes/<name>/`               |
| Generate artifacts  | `/opsx:ff`      | proposal → specs → design → tasks                |
| Implement           | `/opsx:apply`   | Agent works through `tasks.md`                   |
| Verify              | `/opsx:verify`  | Checks implementation vs specs                   |
| Archive             | `/opsx:archive` | Moves change to archive, syncs `openspec/specs/` |

Project-specific docs (`api-spec.yml`, `data-model.md`) are updated by agents during implementation when endpoints or models change — see `docs/documentation-standards.md`.

---

## 6. Checklist

- [ ] Harness folders copied into project
- [ ] `openspec/config.yaml` updated with your project context
- [ ] `docs/backend-standards.md` and `docs/frontend-standards.md` adapted to your stack
- [ ] `docs/api-spec.yml` created
- [ ] `docs/data-model.md` created
- [ ] `docs/development_guide.md` created
- [ ] OpenSpec CLI installed
- [ ] `/opsx:onboard` completed or first change started
