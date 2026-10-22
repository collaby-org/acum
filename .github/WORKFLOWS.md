# Workflows

This repository treats two checks as required. The advisory jobs below
inform the review but never gate it, and they are credential-gated: each one
skips itself when its token or key is unset and continues on error when it
runs.

## Required

- `ci.yml` runs install, lint, type-check, and build on every pull request and
  on every push to the default branch. A step whose command is empty is
  skipped, so a repository without a lint script is not red for a missing
  script.
- `secret-scan.yml` runs gitleaks on every pull request, on every push to the
  default branch, and once a week. A leak fails the job. The report is
  uploaded as an artifact even when the job fails. The gitleaks version is
  pinned in the workflow, and every action is pinned to a commit.

## Scheduled

- `stills.yml` takes the stills of the shows that are on, twice an hour, and
  opens a pull request when the pictures changed. It runs on a **self-hosted**
  runner on purpose: the upstreams refuse requests from datacenter networks,
  so a GitHub-hosted runner cannot reach a single one of them and every
  channel would come back a miss. The runner needs the app built and started
  on port 3115 — the job does that itself.
- `security-audit.yml` runs `npm audit --package-lock-only` daily (and on
  demand) at the repository root, parses the counts with `jq`, and writes a
  compact table to the job summary. It needs no install, no issue comments,
  and no state branch, and it is `continue-on-error`: findings inform, they
  never block.

## Advisory

These jobs are credential-gated and continue-on-error; when the credential is
missing they skip themselves. The workflow file they run from stays either
way:

- `kodus-review.yml` runs the Kodus review when `KODUS_TEAM_KEY` exists.
- `pr-agent.yml` runs PR-Agent when `LLM_API_KEY` exists.
- `openrabbit.yml` runs when its own credential exists.
- `opencode.yml`, `opencode-review.yml`, `opencode-scheduled.yml`, and
  `opencode-triage.yml` are the opencode GitHub integration's fleet; each
  skips when its token is unset.
- `codeql.yml` runs CodeQL (TypeScript only) on pushes, pull requests, and a
  weekly schedule; it authenticates with the automatic `GITHUB_TOKEN`.
- `labeler.yml` applies labels from `.github/labeler.yml` on pull requests,
  with `sync-labels: false` so hand-applied labels are never removed.
- `stale.yml` marks and closes stale issues and pull requests.

Advisory jobs inform the review. They never replace the local gate:
`/check verify` and the Kodus loop run before the commit, and the local code
review runs on the final HEAD, after the rebase and before the pull request.

## Forks and secrets

Pull requests from forks never receive repository secrets. GitHub runs the
workflow from the base branch and withholds `GITHUB_TOKEN` permissions and all
secrets, so the advisory jobs skip themselves. Required jobs must therefore
pass without any secret. Never add a secret to a required job.
