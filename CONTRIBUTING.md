# Contributing to VIZOR

Thanks for helping keep the channel list accurate.

VIZOR is a static, account-free directory of Romanian live TV channels. It
has no backend: the channel catalogue is a generated TypeScript module
committed to the repository, and the app is a static Next.js export.

## Getting set up

```bash
npm install
npm run dev
```

Node.js 20.9+ is required (Next.js 16).

## Before you open a pull request

```bash
npm run lint       # ESLint flat config
npx tsc --noEmit   # type check
npm run build      # Turbopack production build
```

All three must pass. CI runs the same three commands.

## Changing the channel list

Never edit `src/data/channels.ts` by hand — it is generated. Edit
`scripts/channel-taxonomy.json` (display names, categories) and re-run the
pipeline:

```bash
node scripts/scrape-channels.mjs   # -> data/channels.raw.json
node scripts/check-embeds.mjs      # -> data/embed-health.json
node scripts/build-dataset.mjs      # -> src/data/channels.ts + public/logos/
```

Commit the regenerated files together with the taxonomy change so the diff
tells the whole story.

## Pull requests

Every change lands through a pull request — never a direct push to `main`.

- One topic per pull request.
- Fill in the template: what changed, the evidence, and
  `version: before → after`.
- Bump `package.json` `version` and `docs/VERSION` in the same commit as the
  change: feature or architecture → minor, fix or docs or chore → patch,
  breaking → major.
- Add a `docs/changelog.md` entry in the same commit.
- Update the living docs in `docs/` when your change makes them stale.

## Style

- Icons: `lucide-react` only.
- Components: shadcn-first; extend the primitives in `src/components/ui/`.
- Colours: use the tokens in `src/app/globals.css`, not literal hex values.
- Copy: the interface is in Romanian. Keep it plain and diacritic-correct.
- Motion: subtle by default; respect `prefers-reduced-motion`.

## Reporting a broken channel

Open an issue with the channel name and what you saw. Embed hosts go down
and come back; the `status` field in the dataset is refreshed by
`scripts/check-embeds.mjs`, so a "broken" report is often already recorded.

## Security

Report vulnerabilities privately — see `SECURITY.md`. Do not open a public
issue for a security problem.
