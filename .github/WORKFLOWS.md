# `.github/` — workflows, automation and repository health

Everything in this folder is advisory infrastructure. **Nothing here deploys
anything**, and no workflow in it is a required check — a red bot must never
stop a developer.

---

## ⚠️ Read this first: Actions is currently blocked by billing

This is a **private repository on the GitHub Free plan**, so GitHub-hosted
runners are metered, and the account's Actions minutes are currently blocked.
Every job therefore fails instantly with:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

This happens **before any step executes**, which is why 40 consecutive runs
across 11 workflows have produced zero successes. It is an **account billing
state**, and no edit to any file in this folder can resolve it. Fix it in
*Settings → Billing and licensing*.

The same plan restriction means **branch protection is unavailable** — GitHub
gates it behind Pro. There is therefore no enforcement mechanism on `main`;
the only guard on the frozen V1 tree is the prose in [`AGENTS.md`](../AGENTS.md).

To make CI genuinely free once billing is resolved, register a
**self-hosted runner** (self-hosted runners consume no GitHub-hosted minutes)
or reduce what runs. The configuration below is already trimmed for cost.

### Verified again on this branch — 2026-10-18

Re-checked rather than taken on trust. `gh run list` shows **12 of the last 12
runs failing**, and the most recent CI run (`39130459398`) has all four jobs —
Backend, Frontend, Vault, Frozen V1 — concluded `failure` with **no steps
reported at all** and `log not found`. That is the signature of the billing
block: jobs that never start, as distinct from jobs that run and fail. So every
"blocking" label in this file is currently **nominal**.

**What that means for a change to `ci.yml`:** editing it is correct and
necessary, but it **gates nothing today**. The backend job was given a real
MySQL service and the suite was promoted off `php artisan test` to
`php vendor/bin/phpunit --no-coverage` — 500 tests that pass locally in 44s and
could never have passed before, because there was no database for them to run
against. Treat that as **prepared, not active**: it becomes real on the first
successful run after billing is resolved.

### The one gate that does not need GitHub

Because CI is inert, the only automated signal on this branch is what a
developer runs:

| Suite | Command | Result on this branch |
| --- | --- | --- |
| Backend | `php vendor\bin\phpunit --no-coverage` | 500 tests, 2889 assertions, 2 skipped, **44s** |
| Client — session | `yarn test:session` | **8/8** |
| Client — render loops | `yarn test:render-loops` | **exit 0**, 0 renders in the drain |
| Types | `yarn tsc --noEmit` | **exit 0** |

Those four are recorded in PR #34's body and issue #36 so a reviewer is not
told "CI is green" when no CI ran.

**Correction on record:** an earlier note in this work said `php artisan test`
"mis-resolves". That was wrong — it runs the same 500 tests, just with a verbose
reporter, and it printed real `PASS` lines when run. The genuine problem with
that step was never the command; it was that there was no database, and that it
was `continue-on-error`.

---

## 1. Workflows

Fourteen files. `ci.yml` is the only one that gates anything.

### The gate

| File | Trigger | What it does | Cost controls |
| --- | --- | --- | --- |
| [`ci.yml`](workflows/ci.yml) | PR (V2/V1 paths only), push to `main`, manual | Four jobs: **backend**, **frontend**, **vault**, **frozen-V1 syntax** | `paths:` filters skip irrelevant PRs entirely; `concurrency` cancels superseded runs; every uncertain step is `continue-on-error` |

Blocking vs advisory was decided by what had actually been **run green** —
not by optimism:

| Job | Blocking | Advisory |
| --- | --- | --- |
| Backend | `composer validate --strict`, `php -l` over the whole tree, boot smoke test (`artisan route:list`) | `php artisan test`, Pint |
| Frontend | — | `yarn lint`, `tsc --noEmit` |
| Vault | `typecheck`, `lint`, 62 contract tests | — |
| Frozen V1 | `php -l` only | — |

Notes on the non-obvious choices:

- **The boot smoke test earns its place.** `php -l` cannot see an undefined
  constant or a fatal class load in a route file; booting the framework can.
  That is precisely the defect class that shipped 16 HTTP 500s.
- **V1 gets no `composer install`.** It hard-requires a private
  `type: vcs` package, which a CI token cannot read. `php -l` needs no
  autoloader, so the frozen tree still cannot be silently syntax-broken.
- **The frontend job is fully advisory.** ESLint over the tree is slow and has
  known findings. It reports; it does not block.
- This workflow replaced `ci-backend.yml`, `ci-frontend.yml` and
  `ci-vault.yml`, which between them covered **only the frozen V1 tree** while
  the production code received no compile, lint or test signal at all.

### Review bots — all advisory, all credential-gated

Every bot below has a job-level `if:` that tests for its own credentials, so
when the key is absent the job **skips** — green, and costing zero minutes —
instead of failing. Each also has a `concurrency` group with
`cancel-in-progress`, so pushing N commits to a PR costs 1 run rather than N.

| File | Runs only if | Third-party service | Notes |
| --- | --- | --- | --- |
| [`kodus-review.yml`](workflows/kodus-review.yml) | `KODUS_TEAM_KEY` + `KODUS_API_URL` | **Kodus Cloud — paid** | Advisory. Not a gate. |
| [`pr-agent.yml`](workflows/pr-agent.yml) | `LLM_API_KEY` + `LLM_API_BASE` | NVIDIA NIM | Primary DeepSeek V4.1 Flash; fallbacks GLM 5.3 Flash, Step 5 Preview. |
| [`openrabbit.yml`](workflows/openrabbit.yml) | `LLM_API_KEY` + `LLM_API_BASE` | NVIDIA NIM | DeepSeek V4.1 Flash. `edited` trigger removed - it re-ran a full review on every PR title/body save. |
| [`opencode.yml`](workflows/opencode.yml) | `LLM_API_KEY` + `LLM_API_BASE` | NVIDIA NIM (`integrate.api.nvidia.com/v1`) | `/oc` or `/opencode` mention, collaborators only. |
| [`opencode-review.yml`](workflows/opencode-review.yml) | `LLM_API_KEY` + `LLM_API_BASE` | same | Same-repo only, no bots. |
| [`opencode-triage.yml`](workflows/opencode-triage.yml) | `LLM_API_KEY` + `LLM_API_BASE` | same | New issues only. |
| [`opencode-scheduled.yml`](workflows/opencode-scheduled.yml) | `LLM_API_KEY` + `LLM_API_BASE` | same | Weekly health check. `contents: write` reduced to `read`. |

The four `opencode` workflows rotate a **four-model NVIDIA ladder** as the
primary (DeepSeek V4.1 Flash, GLM 5.3 Flash, Step 5 Preview, Nemotron 3.5
Super VL 120B) and retry the remaining three entries through `if: failure()`
steps with a skip-if-already-primary guard, so one failed or rate-limited
model never burns the other three runners.

### Scanners and hygiene

| File | Trigger | What it does |
| --- | --- | --- |
| [`secret-scan.yml`](workflows/secret-scan.yml) | PR + push to `main` | Uses the `zricethezav/gitleaks` **CLI**, not `gitleaks/gitleaks-action`. The action requires a `GITLEAKS_LICENSE` on organisation repositories and declares no inputs at all; the CLI needs no licence. Advisory: a finding is red in the log, never a blocked merge. |
| [`codeql.yml`](workflows/codeql.yml) | push/PR + weekly Mon 06:37 | CodeQL for `php` + `javascript-typescript`. `autobuild` runs on the JS leg only — the PHP extractor has no build step. The weekly scan has its own concurrency group so a push to `main` can no longer cancel it. Requires GHAS on a private repo. |
| [`labeler.yml`](workflows/labeler.yml) | `pull_request_target` | Applies labels from [`labeler.yml`](labeler.yml). `sync-labels` is **off** — with it on, every sync deleted any label a human had applied by hand. |
| [`stale.yml`](workflows/stale.yml) | daily 06:34 | Stale at 30 days, closed at 60. Exempt: `keep`, `security`, `pinned`. |

> `dependency-review.yml` was **deleted**. The action reads a lockfile at the
> repository root; this monorepo keeps every lockfile in a subdirectory and has
> no root lockfile, so it reported zero changed dependencies and passed
> trivially on every PR while auditing none of the known advisories. A security
> gate that looks healthy and is inert is worse than no gate.

### Action pinning

**Every** action in **every** workflow is pinned to a full 40-character commit
SHA with a trailing version comment — `actions/checkout` (v7.0.1),
`actions/setup-node` (v7.1.0 / v4.4.0), `github/codeql-action` (v4.39.0),
`shivammathur/setup-php` (v2.40.0), `actions/labeler` (v7.0.0),
`actions/stale` (v11.0.0), `actions/upload-artifact` (v4.6.2),
`anomalyco/opencode` (v2.0.9), `aryanbrite/openrabbit` (v0.9.1),
`the-pr-agent/pr-agent` (v0.48.0). A floating tag is a version nobody
reviewed: the tag can be moved, and the SHA is the code that actually runs.
Dependabot bumps the SHA and the version comment together, and
`node ~/.agents/skills/repo-standards/scripts/standards.mjs --check .` fails
the moment a `uses:` is not a SHA.

---

## 2. Configuration files

| File | Purpose |
| --- | --- |
| [`dependabot.yml`](dependabot.yml) | **Now covers V2, which it previously ignored entirely.** Weekly for `composer` (Core-V2) and `npm` (Vault-V2), weekly `yarn` for the client, monthly for actions. V1 entries are monthly and cannot be verified by CI (see the installer caveat). `next`/`react`/`react-dom` majors are ignored — those are deliberate, tested migrations. |
| [`labeler.yml`](labeler.yml) | Path rules for the labeler. **Added V2 patterns**; previously every PR against the production tree was left unlabelled. |
| [`codeql-config.yml`](codeql-config.yml) | CodeQL `paths-ignore`. |
| [`pull_request_template.md`](pull_request_template.md) | PR checklist: scope, test evidence, no secrets, changelog. |
| [`CODEOWNERS`](CODEOWNERS) | **Active.** One rule covers every file (`* @collaby-org`), so every pull request asks the only account that can review it. Replace the handle with a team the moment one exists - a CODEOWNERS file that names nobody valid asks nobody. |
| [`SECURITY.md`](SECURITY.md) | Private disclosure. **Fill in the contact placeholder.** |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contributor workflow. |

---

## 3. Issue forms

YAML Issue Forms under [`ISSUE_TEMPLATE/`](ISSUE_TEMPLATE/): bug, feature,
docs, chore/general, security, plus `config.yml`. Blank issues stay enabled.

---

## 4. Secrets

Set via **Settings → Secrets and variables → Actions**. Names only — never
commit values.

| Secret | Used by | Currently defined? |
| --- | --- | --- |
| `GITHUB_TOKEN` | Everything | automatic |
| `KODUS_API_URL`, `KODUS_TEAM_KEY` | `kodus-review.yml` | yes |
| `LLM_API_KEY`, `LLM_API_BASE` | `pr-agent.yml`, `openrabbit.yml`, all four `opencode*.yml` | yes - NVIDIA key + `https://integrate.api.nvidia.com/v1` |

Since 2026-10-23 every model-facing bot runs on one NVIDIA key plus endpoint:
`LLM_API_KEY` = the NVIDIA key, `LLM_API_BASE` =
`https://integrate.api.nvidia.com/v1`. Kodus Cloud model routing is
dashboard-side (see [`docs/kodus-providers.md`](../../docs/kodus-providers.md)).
`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_DEEPSEEK_KEY` and
`NVIDIA_GLM_KEY` were deleted - nothing references them any more.

---

## 5. Maintenance

- GitHub disables scheduled workflows after **60 days of repository
  inactivity**, silently. If `stale`, `codeql` or `opencode-scheduled` stop
  appearing, that is why.
- Budget the weekly cron jobs (`stale`, `codeql`, `opencode-scheduled`) before
  re-enabling any credential-gated bot.
- When adding a workflow, give it: a `paths:` filter, a `concurrency` group, a
  `timeout-minutes` cap, and a credential gate if it needs a key.

## 6. Kept and rejected patterns (2026-10-20 recon)

An audit of pingdotgg/t3code's automation produced a short keep-list and a
longer reject-list. Recorded here so the next audit does not re-litigate them.

Kept:

- Scheduled jobs fire off minute zero - GitHub queues the world's `:00`
  crons first, so minutes 1-59 start sooner. New times: `stale` daily 06:34,
  `gitleaks` weekly Mon 06:12, `codeql` weekly Mon 06:37,
  `opencode-scheduled` weekly Mon 09:23.
- `pull_request_target` stays payload-only: the one current occurrence
  (`openrabbit.yml`) never checks out the PR head, and its boundary comment
  moves with it. Anything that must execute PR code belongs on
  `pull_request` (read-only token, no secrets) plus a `workflow_run`
  publisher that loads only default-branch code.
- Repeatable bot posts (previews, reports, rollups) edit one sticky comment
  keyed by an HTML marker instead of accumulating new comments.
- A suppression directive (`@ts-ignore`, `eslint-disable`, ...) needs an
  adjacent reason; the directive itself is not an explanation.
- PR evidence names its gaps: the template asks for what the author could
  not check, and agent work names its model and harness.
- A future workflow or skill with write authority loads its policy from the
  trusted default branch at run time and fails closed on a missing or
  malformed file; PR text, labels and comments cannot change policy.

Rejected (and why):

- A consolidated `Check` gate job - branch protection is unavailable on our
  plan, so it would gate nothing.
- Vouch ledgers and trust labels - labels never gate anything here.
- Deeper diff-based CI gating - `ci.yml` already path-filters, consolidates
  its three lanes and cancels in-progress; extra structure buys nothing
  while Actions is billing-blocked.
- Review-agent specs, devcontainer mirroring, vendored reference checkouts,
  nightly-release doctrine and the mobile/Electron/Effect stack machinery -
  not our surface.
