# Agent Commands

Slash-commands and their scope: who may invoke them, when in the task lifecycle, and what each owns. Source of truth for behavior is `AGENTS.md` plus each skill in `.agents/skills/`; this file is the index.

## Gate order

`/scope` → `/audit` (if context missing, human-only) → `/architect` spec → `/develop` (small `/ralph-loop` slices) → `/test` (+ `/debug` on failure) → `/check verify` → Kodus loop → commit → rebase → push → PR (`/check review`, then `/document`, `/unslop` on prose) → `/review` + `/pr-agent` + Kodus to zero → present URL. `/sync` last, human-only.

## Commands

| Command | Scope (who / when) | What it does | Owns |
|---|---|---|---|
| `/scope [what]` | Agent or user, task start; bare `/scope` = replan/reconcile | Turns an idea into a coarse living plan (`plan`), enrolls one feature (`add`), or reconciles after shipping (`replan`). Seeds WHAT, never HOW; never picks tools | `docs/scope/` |
| `/audit [area]` | **HUMAN-ONLY.** Only with explicit user authorization in that same task; never auto-chained. Run when project context is missing or stale | Bootstraps/fills `AGENTS.md` (root + nested) from codebase analysis; gap-fills only, never overwrites curated content | `AGENTS.md` files (+ thin `CLAUDE.md` pointers) |
| `/architect` | Agent when a load-bearing decision is unmade, or user designing; `/develop` routes here when a decision is owed | Structured discovery → build spec in `docs/specs/`. Modes: `FEATURE`, `ARCHITECTURE`, `ENHANCEMENT`, `CROSS-CUTTING` | `docs/specs/` (all spec files) |
| `/new-feature` | Agent, beginning of every task before any code (established projects) | Fresh Git worktree branched from `origin/main`; one worktree + one branch per task/agent | Worktree + branch |
| `/develop` | Agent, build step; reads spec + `AGENTS.md` | Builds UI and/or backend from the spec. Gates to `/architect` if something load-bearing is undecided. Only spec touch: the `**Status**:` line | App code (+ scope status ticks) |
| `/ralph-loop` | Agent, inside `/develop` for well-defined verifiable slices | Small autonomous build slices with verification per slice | Slice output |
| `/debug` | Agent, anytime: failing test, failing `/check verify`, wrong behavior | Reproduce → localize → hypothesize → test → fix → verify loop; minimal fix, hands the regression test to `/test`. No features, no extra refactors | The fix |
| `/test` | Agent, after implementing or changing code | Writes the suite for uncommitted changes (happy path, edge cases, error states); reads/creates `test-preferences.json` | Test files + `test-preferences.json` |
| `/check verify` | Agent, after `/develop`, before merge | Drives the real app to prove behavior against the spec (every acceptance criterion, every surface). Read-only on code | No durable files (failures point to `/debug` / `/develop`) |
| `/check review` | Agent, after verify, before PR prose | Senior code review by a fresh model (not the one that wrote the code); findings ranked by severity | `docs/reviews/` |
| `/review` | Agent, ship step (opencode review); also PR-Agent's review command | Auto-reviews the diff and fixes code findings | Review fixes |
| `/pr-agent` | Agent, on every PR before presenting the URL | `/review` → fix actionable findings → re-trigger until clean; `/improve` and `/ask` as needed | PR comments to zero |
| `/pr-agent-setup` | Agent, once per new repo | Bootstraps the PR-Agent Action preset pair | Repo PR-Agent config |
| `/unslop` | Agent, before committing, posting, or sending | Removes AI tells from human-read text (commits, PR prose, docs, comments); leaves untouched prose alone | The cleaned text |
| `/document pr\|changelog\|release-note\|postmortem` | Agent, after the change is green (runs after living-docs update) | Drafts prose from the real diff: PR title/body, `CHANGELOG.md` entry, `docs/releases/<v>.md`, `docs/postmortems/<date>-<slug>.md`. Never invents | PR text, changelog, release notes, postmortems |
| `/sync` | **HUMAN-ONLY.** Only with explicit user authorization in that same task; never auto-chained after `/document` or merge. Run after a change, around merge | Reconciles `AGENTS.md`, scope, and spec statuses with repo evidence (surgical edits: adds lines, rewrites single lines it owns); flags stale specs | Maintenance of `AGENTS.md` / scope / spec statuses |
| `/oc` | User, on GitHub (issue/PR comments) | Invokes opencode in GitHub Actions (mentions, auto review, triage, scheduled checks) | CI-side agent runs |
| `/loop` | Agent, only to watch something over time (e.g. poll a flaky test) | Re-runs a command on an interval. Not the `/debug` investigation loop | Observations |

## Skill-backed gates (no slash form; agent loads the skill)

| Skill | Scope (who / when) | What it does |
|---|---|---|
| `kodus-review` | Agent, after implementing, before every commit | Local-first loop: stage → `kodus review --staged` → fix valid → tests → re-run until clean. Bar: nothing commits until clean; CLI missing → say so, never fake it |
| `living-docs` | Agent, task start (check-first) and after each task | Maintains `docs/` (`changelog.md`, `system_diagram.md`, `targets.md`, `roadmap.md`, `tech_stack.md`, `project-doc.md`). Stale docs are a bug |
| `design-system` | Agent, start of any UI work | Adopt existing `design-system/` (follow, extend, never replace) or generate from intent; tokens → primitives → components → patterns → pages |

## Input skills (content only; ours own the gates)

`feature-forge` → `/scope`, `spec-miner` → `/audit`, `architecture-designer` → `/architect`, `debugging-wizard` → `/debug`, `test-master` → `/test`, `code-reviewer` → `kodus-review` / `/review`, `code-documenter` → `/document`, `security-reviewer` → Kodus gate. Load per the `AGENTS.md` skill-routing table; match the repo's pinned versions, never latest idioms on legacy code.

## Hard locks

- `/audit`, `/sync`, and any skill editing `AGENTS.md`: one lock — never without explicit user authorization in that same task, never auto-chained. `AGENTS.md` is never edited by AI without user consent.
- Never build on `main`; never commit to `main`; `--force-with-lease` on your own branch only.
- Do not merge unless told to. Keep the worktree until merge/close.
