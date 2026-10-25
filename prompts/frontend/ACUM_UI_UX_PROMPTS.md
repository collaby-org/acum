# ACUM — OpenCode Orchestrator Prompt Library (Frontend — Mobile & Desktop Browsers Only)

## How to use these prompts

Before every step:

1. Open the existing ACUM repository in OpenCode.
2. Confirm the working directory is the repository root.
3. Make sure `prompts/frontend/ACUM_UI_UX_MASTER.md` exists.
4. Paste only the prompt for the step you are authorising.
5. Review the orchestrator's report and inspect the actual changes.
6. Do not run the next prompt until the current step passes its acceptance gate.

The master specification (`prompts/frontend/ACUM_UI_UX_MASTER.md`) is mandatory for every step.

---

# PROMPT 1 — READ-ONLY REPOSITORY AUDIT

Read and follow `prompts/frontend/ACUM_UI_UX_MASTER.md` completely.

You are authorised to perform **Step 1 only: the read-only repository audit**.

My existing Next.js Romanian live TV platform works, but the frontend looks outdated and doesn't feel like a modern streaming app. The visual system, consistency, UX and component architecture need a complete redesign focused on **mobile and desktop browsers only** (TV is a separate app in `monorepo/tv/`).

Before making any changes, I need you to understand the real application.

## Your task

Inspect the repository (`monorepo/frontend/`) and map the complete frontend, including all discovered routes, layouts, shared components, CSS dependencies, forms, tables, pagination, data fetching, authentication, WebSockets, API integrations, tests and user journeys.

Identify the actual responsibilities of the existing components. In particular, determine which parts are presentation-only and which contain behaviour or integration logic.

For any CSS files, identify their imports, dependencies, global selectors, shared styles and the pages or components that consume them. Do not assume a selector is unused simply because it is not easy to find.

Document the current behaviour of pagination, sorting, filtering, live updates, loading states, errors and form submission wherever relevant.

Identify the areas most likely to break if redesigned carelessly.

## Restrictions

- Do not edit application code.
- Do not modify or delete CSS.
- Do not install or upgrade dependencies.
- Do not change configuration.
- Do not redesign any page.
- Do not replace working components.
- Do not guess about architecture that you cannot verify.
- Do not reference TV, smart TV, Tizen, webOS, Android TV or any TV-specific concerns. This frontend is for mobile and desktop browsers only.

You may create the audit documentation required by the master specification.

## Deliverables

Create and populate:

- `docs/ui-ux/ROUTE_INVENTORY.md`
- `docs/ui-ux/FUNCTIONALITY_MAP.md`
- `docs/ui-ux/COMPONENT_MIGRATION_MAP.md`
- `docs/ui-ux/USER_JOURNEYS.md`
- `docs/ui-ux/REGRESSION_CHECKLIST.md`
- `docs/ui-ux/RISK_REGISTER.md`
- `docs/ui-ux/MIGRATION_LOG.md`

Update `prompts/frontend/ACUM_UI_UX_MASTER.md` only if an actual repository fact requires a documented clarification. Do not change its core safeguards.

## Finish by reporting

- The actual routes discovered.
- The purpose and dependencies of any CSS files.
- The most fragile components and user journeys.
- How pagination and live data currently work.
- The recommended representative page for Step 3.
- The safest migration order.
- Available build, lint, type-check and test commands.
- Any missing information that requires my decision.

Stop after the audit. Wait for my approval before implementing anything.

---

# PROMPT 2 — CREATE THE IMPLEMENTABLE ACUM DESIGN SYSTEM

Read `prompts/frontend/ACUM_UI_UX_MASTER.md` and all relevant outputs from Step 1.

You are authorised to perform **Step 2 only: define the new design system and implementation plan**.

The goal is to replace the outdated visual system with a coherent ACUM interface built primarily with Tailwind CSS, shadcn/ui and Lucide React, while retaining the existing application architecture where appropriate. This is for **mobile and desktop browsers only**.

## First, establish the source of truth

Inspect the existing ACUM brand assets and approved brand direction. Use the exact approved colours, typography and logo. Do not invent new brand colours if the approved values are available.

Inspect the installed versions of Next.js, React, Tailwind CSS and relevant UI libraries. Determine the safest compatible approach before proposing dependency changes.

## Define the design system

Create a concrete specification for:

- Brand, semantic and surface colour tokens.
- Typography, spacing, responsive containers and breakpoints.
- Buttons, inputs, selects, forms and validation.
- Tables, pagination, sorting, filters and data.
- Cards, tabs, dropdowns, dialogs, drawers and tooltips.
- Navigation and the shared application shell.
- Loading skeletons, errors, empty states and notifications.
- Icons and consistent Lucide usage.
- Focus, keyboard interaction, contrast and reduced motion.
- Animation duration, easing and allowed interaction patterns.
- Trading, Launchpad, onboarding and wallet-specific UX patterns.

Do not use a generic design system that makes every page look like the same card grid. Directory pages must remain information-dense; onboarding must be guided.

## Plan the component architecture

Map existing components to proposed shared components. Identify which components should be reused, replaced, split or retained as adapters around existing logic.

Define how old CSS will be replaced incrementally. Do not remove the old CSS in this step.

Explain how Tailwind and shadcn/ui will coexist with the current project during migration, without uncontrolled global changes.

Define measurable performance checks for initial rendering, navigation, interaction responsiveness, layout stability and heavy components. Do not promise that all network requests will complete in under one second.

## Deliverables

Populate:

- `docs/ui-ux/DESIGN_SYSTEM.md`
- `docs/ui-ux/COMPONENT_MIGRATION_MAP.md`
- `docs/ui-ux/USER_JOURNEYS.md`
- `docs/ui-ux/REGRESSION_CHECKLIST.md`

If the project lacks approved brand values or another essential decision, document the exact question and stop for clarification.

Do not migrate pages, modify application styling or install dependencies yet.

Finish with a proposed representative page, a component implementation order and an explicit list of decisions requiring approval. Wait for my approval.

---

# PROMPT 3 — BUILD ONE REPRESENTATIVE PAGE AND PROVE THE SYSTEM

Read the master specification and all relevant audit and design documents.

You are authorised to perform **Step 3 only: implement one representative page**.

The purpose is to prove that the new ACUM design system works in the actual application before it is rolled out.

Use the representative page selected during the audit unless there is a documented technical reason to change it.

## Before editing

Identify the exact route, its dependencies, its existing behaviour and its current styling imports.

Establish a baseline with screenshots, tests or other available evidence. Record the existing functionality that must continue working.

Create a small implementation plan for the selected route.

## Implementation

Build the selected page using the approved design system, Tailwind CSS, shadcn/ui and Lucide React where appropriate and compatible.

Replace the old presentation of this page rather than layering endless new overrides on top of its existing styling.

However, do not delete shared legacy CSS that other routes still depend on.

Preserve real data, forms, pagination, navigation, API calls, WebSocket updates, loading behaviour and error handling.

Separate presentation from behaviour where necessary. Reuse existing hooks, services and domain logic instead of rewriting them without reason.

Implement responsive layouts and meaningful loading, empty, error and success states.

Do not use mock data to make the page appear finished. Do not leave decorative controls that do nothing.

## Validate

Run the available relevant build, type-check, lint and test commands.

Use browser automation if available. Inspect the actual page at desktop and mobile sizes.

Test its real interactions, inspect console errors and failed requests, and compare the result against the baseline.

Check that the new design system is reusable and that the page has not broken other routes through global CSS changes.

## Deliverables

- The implemented representative page.
- Any shared components genuinely required for it.
- `docs/ui-ux/MIGRATION_LOG.md`
- `docs/ui-ux/REGRESSION_CHECKLIST.md`

Report all changed files, checks performed, known issues and screenshot evidence where available.

Do not migrate additional routes.

If the design is not good enough or functionality has regressed, correct it before requesting approval to continue.

Stop and wait for my approval.

---

# PROMPT 4 — REBUILD THE SHARED FOUNDATION AND COMMON COMPONENTS

Read the master specification and the approved results of Steps 1–3.

You are authorised to perform **Step 4 only: migrate the shared application foundation and common components in controlled batches**.

The representative page has established the design direction. Now extend the validated system to the rest of the application shell and reusable interface components.

## Scope

Use the actual component inventory to determine which items belong in this step. Typical candidates include:

- Application shell and page containers.
- Desktop and mobile navigation.
- Headers, menus and account controls.
- Buttons, links, inputs and form primitives.
- Tabs, dialogs, drawers, dropdowns and tooltips.
- Shared tables, pagination, sorting and filtering controls.
- Loading skeletons, empty states, alerts and notifications.
- Shared responsive utilities and design tokens.

Do not assume every item exists or has the same dependencies.

## Migration method

Work in small batches. Before each batch, list the components, consumers, dependencies and tests required.

Replace the old visual implementation with the approved shared components where appropriate. Keep existing business logic and data connections intact.

For pagination and tables, preserve the actual pagination model, query parameters, page-size behaviour, filters, sorting, total counts and loading/error states. Do not replace server-side pagination with loading all records into the browser.

Do not make a new global stylesheet or a second parallel design system. Do not hide unresolved legacy CSS problems beneath increasingly specific overrides.

Avoid broad CSS deletions. Remove a rule only when its consumers and replacement have been established.

After each batch, run the relevant checks and inspect affected routes.

## Deliverables

Update:

- `docs/ui-ux/COMPONENT_MIGRATION_MAP.md`
- `docs/ui-ux/ROUTE_INVENTORY.md`
- `docs/ui-ux/REGRESSION_CHECKLIST.md`
- `docs/ui-ux/MIGRATION_LOG.md`

Report exactly which shared components have been migrated, which remain, what behaviour has been tested and what risks remain.

Do not start a complete page migration outside the authorised shared foundation.

Stop after this step and wait for approval.

---

# PROMPT 5 — REDESIGN CHANNEL DIRECTORY AND PLAYER PAGES

Read the master specification and the latest migration documentation.

You are authorised to perform **Step 5 only: migrate the discovered channel directory, player and streaming interfaces in controlled batches**.

This is a presentation and UX migration. It is not permission to rewrite the streaming engine.

## Identify the real routes

Use `docs/ui-ux/ROUTE_INVENTORY.md` and `docs/ui-ux/FUNCTIONALITY_MAP.md` to identify the actual pages in scope.

Include the relevant channel lists, channel details, player pages, categories, guides, favourites and recently watched where they exist.

Do not invent missing features or silently omit existing ones.

## Channel directory design requirements

Channel directory screens must be fast, readable and browser-friendly.

- Keep channel data visible and easy to compare.
- Use clear numeric alignment and consistent formatting.
- Avoid unnecessary decoration and excessive whitespace.
- Make channel selection and playback management immediately accessible.
- Use subtle state changes rather than distracting animation.
- Ensure live updates do not cause disruptive layout shifts.
- Never delay a channel action for a transition.
- Preserve the existing player and stream behaviour unless a separately approved change is necessary.

## Player design requirements

The player must be immersive and browser-optimized.

- Keep video playback prominent and distraction-free.
- Make channel name, status, quality and current show legible.
- Preserve live updates and make changes understandable.
- Use clear play/pause, volume, quality and fullscreen controls.
- Keep playback controls immediately usable with mouse/touch.
- Never delay playback controls for transitions.
- Preserve the existing stream and player behaviour unless a separately approved change is necessary.

## Pagination and live data

For every table or list, verify:

- Correct records for the current page.
- Correct total count and page count.
- Sorting and filtering interactions.
- Page-size changes.
- Empty results.
- Loading and error recovery.
- Live update behaviour.
- URL and query-parameter behaviour, where applicable.

Do not replace real data with fixtures outside appropriate tests.

## Batch controls

Migrate one logical group at a time. Record the affected routes and run the relevant tests before proceeding to the next group.

Update the route inventory, regression checklist and migration log.

Stop and investigate any unexplained change in values, API behaviour, permissions or stream state.

Finish with a report of all migrated routes, tests, unresolved issues and outstanding routes. Wait for approval before proceeding.

---

# PROMPT 6 — REDESIGN ONBOARDING, AUTH AND COMPLETE THE USER EXPERIENCE

Read the master specification and the latest route, component and journey documentation.

You are authorised to perform **Step 6 only: migrate the remaining product areas and implement approved UX improvements and motion**.

## Scope

Use the actual route inventory. Include relevant onboarding, registration, verification, account settings, security, favourites, recently watched, help pages and other remaining product areas.

Do not assume every listed feature exists.

## Onboarding and account journeys

Create logical, guided journeys with clear steps, progress indicators where useful, inline validation, helpful errors and reliable recovery.

Preserve form state where appropriate and prevent accidental loss of user input.

Do not remove existing verification or security requirements to make a flow appear simpler.

## Motion and micro-interactions

Apply the motion rules in `docs/ui-ux/DESIGN_SYSTEM.md`.

Use subtle hover and focus states, quick transitions, appropriate loading feedback, guided step transitions and meaningful confirmation animations.

Keep streaming interactions restrained. More expressive motion is appropriate in discovery and milestone completion when it improves the experience.

Never make an animation a prerequisite for an action. Respect reduced-motion preferences and avoid unnecessary layout shifts.

## Final route coverage

Compare all discovered routes with the route inventory. Migrate remaining required routes or explicitly document why a route is blocked or excluded.

Update:

- `docs/ui-ux/USER_JOURNEYS.md`
- `docs/ui-ux/ROUTE_INVENTORY.md`
- `docs/ui-ux/REGRESSION_CHECKLIST.md`
- `docs/ui-ux/MIGRATION_LOG.md`

Test complete journeys rather than isolated screens.

Do not delete the old CSS files in this step unless a small, specific deletion has been proven safe and is required for a completed migration.

Stop and report what is complete, what remains and which journeys have been verified. Wait for approval.

---

# PROMPT 7 — RETIRE LEGACY CSS AND COMPLETE FINAL QA

Read the master specification and every relevant migration artifact.

You are authorised to perform **Step 7 only: verify the completed migration, remove proven-obsolete styling and perform the final regression audit**.

This is not an opportunity to start a new redesign or make large unreviewed changes.

## Part A: Prove the new system covers the application

Compare the final application against the route inventory, functionality map, component migration map and user journeys.

Identify any routes or components that still depend on the old visual system.

Confirm that their replacement is complete before deleting shared CSS.

## Part B: Retire legacy CSS safely

Inspect any original CSS files and their imports, consumers, global selectors, dynamically applied classes and indirect dependencies.

For each candidate deletion:

1. Identify the old rule and its consumers.
2. Confirm the new implementation replaces its intended visual responsibility.
3. Confirm no unrelated route depends on the old rule.
4. Remove a small batch.
5. Run the appropriate checks.
6. Inspect affected routes in the browser.
7. Restore or correct the change if regressions appear.

Do not delete all files blindly. Do not rely only on line counts or static search results to determine whether styling is unused.

Remove obsolete overrides, duplicate styling and unnecessary compatibility code only when it is safe.

## Part C: Run final QA

Run the available:

- Production build.
- TypeScript checks.
- Linting.
- Unit and integration tests.
- End-to-end tests.
- Route and navigation checks.
- Pagination and table tests.
- Responsive and visual checks.
- Accessibility checks.
- Performance measurements.

Use safe test environments for consequential workflows. Do not execute real streams merely to test the interface.

Verify authentication, permissions, API contracts, live data, stream formatting, order management, wallet flows, forms, loading states and error handling.

Use browser automation where available. Report actual results, not assumed results.

## Part D: Performance

Measure what can be measured. Distinguish frontend rendering and interaction responsiveness from server, API and network latency.

Check unnecessary JavaScript, heavy components, layout shifts, unnecessary rerenders and duplicated subscriptions.

Do not claim sub-second loading unless the measurement and its scope support the claim.

## Part E: Final report

Update `docs/ui-ux/FINAL_QA_REPORT.md`, `docs/ui-ux/REGRESSION_CHECKLIST.md` and `docs/ui-ux/MIGRATION_LOG.md`.

The report must include:

- Route coverage.
- Files removed and retained.
- Build, type-check, lint and test results.
- Verified user journeys.
- Pagination and live-data verification.
- Responsive and accessibility findings.
- Performance measurements and their limitations.
- Known issues and untested areas.
- Any financial, security or functional regressions.
- A clear release recommendation.

Do not mark the redesign complete while critical regressions remain or important routes are unverified.

Stop after the report. Do not proceed into unrelated work.