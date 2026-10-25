# ACUM — Master UI/UX Redesign Specification (Frontend Only)

## 1. Mission

Completely redesign the existing **ACUM** Next.js frontend into a premium, modern, award-worthy Netflix-style TV streaming experience for mobile and TV browsers.

The existing application works, but its visual design and CSS architecture need improvement. It needs a coherent design system and a deliberately engineered user experience that feels like a native TV app.

The objective is not to put a new coat of paint on every old component. The objective is to replace the legacy presentation layer with a coherent, modern design system and a deliberately engineered user experience.

The finished platform must feel fast, precise, elegant, responsive and trustworthy. Every page must feel like part of the same product.

## 2. The central rule: replace the presentation, preserve the product

**Discard the old visual design. Preserve the existing working functionality.**

The old CSS, visual styling, obsolete presentation components and inconsistent interaction patterns are not the design standard for the new product. Replace them when their replacement is implemented and verified.

However, the following are valuable existing assets and must not be casually discarded:

- Business logic and domain rules.
- Authentication and session handling.
- API contracts and API clients.
- Channel management and streaming behaviour.
- Stream URLs, stream resolution and fallback behaviour.
- Backend validation and error semantics.
- WebSocket connections, subscriptions and reconnection behaviour.
- Existing data-fetching and state-management logic.
- Permissions, access controls and security checks.
- Routing, query parameters and deep links.
- Working forms, validation rules and confirmation requirements.
- Existing product features and user journeys.
- Useful tests, schemas, types and integration contracts.

A visual component may be replaced completely if its responsibilities are understood and its existing behaviour is preserved through tested adapters, hooks, service functions or other suitable architecture.

Do not assume that preserving a file is more important than preserving its behaviour. Do not assume that replacing a file is safe merely because the new page looks better.

## 3. Brand and visual direction

The product is ACUM — Romanian live TV, ad-free, no account required.

Use the approved ACUM identity, logo, colours, typography and visual direction.

- Discover and reuse the authoritative brand assets and colour values.
- Do not invent replacement brand colours.
- Do not create a second, competing design direction.
- Use brand accents deliberately rather than decorating every component.
- Maintain a premium, restrained visual identity.
- Do not copy another platform's proprietary assets or exact interface.
- Reference Netflix for quality, information hierarchy and interaction patterns, while producing a coherent ACUM design.

The visual quality should come from composition, typography, spacing, contrast, hierarchy, interaction quality and consistency—not excessive gradients, glows, shadows or animation.

## 4. Required technology direction

Prefer the following technology where it is compatible with the existing project:

- Next.js and the existing supported rendering architecture.
- TypeScript with strict, useful types.
- Tailwind CSS as the primary styling system.
- shadcn/ui as the foundation for accessible, reusable interface primitives.
- Lucide React for consistent interface icons.
- The existing charting library if it already satisfies the application's requirements.
- Existing data-fetching, authentication, routing and state-management libraries unless a migration is justified.

Inspect the installed versions and configuration before changing dependencies.

Do not install duplicate libraries or upgrade the entire application simply to use the latest versions.

Do not assume that installing shadcn/ui automatically redesigns the application. Components must be configured, composed, styled and integrated into the real product.

Use semantic design tokens and reusable variants. Avoid scattered arbitrary values and one-off component styling.

## 5. Build a coherent design system

Establish one authoritative system for:

- Brand and semantic colours.
- Backgrounds, surfaces, borders and text.
- Typography, weights, line heights and numerals.
- Spacing, containers, grids and responsive breakpoints.
- Border radii, shadows, focus indicators and elevation.
- Buttons, links, inputs, selects and validation.
- Cards, tabs, dropdowns, dialogs, drawers and tooltips.
- Notifications, confirmations, loading skeletons and empty states.
- Navigation, application shell and mobile menus.
- Animation duration, easing and reduced-motion behaviour.
- TV-specific patterns: D-pad navigation, cursor hiding, overscan safe areas, remote focus loops.

Use consistent component APIs and variants. Do not build a different button, input, table or modal for every page.

Do not force every screen into the same generic card layout. Choose the most appropriate presentation for the information and task.

## 6. Design standards by product area

### Channel directory and catalogue

The directory must prioritise discovery, scanability and TV navigation.

- Keep channel data easy to scan.
- Make channel name, status, quality, family and current show legible.
- Preserve live updates and make changes understandable without distracting flashes.
- Use clear positive, negative, neutral, warning and unavailable states.
- Keep channel entry and playback management immediately usable.
- Never make users wait for an animation before playing a channel.
- Avoid excessive motion, decorative effects and unnecessary layout shifts.
- Preserve accurate numeric formatting and channel identification.
- Make pagination, filtering, sorting and page-size behaviour reliable and understandable.

### Player page

The player must prioritise immersion, TV controls and clear information.

- Keep video playback prominent and distraction-free.
- Make channel name, status, quality and current show legible.
- Preserve live updates and make changes understandable.
- Use clear play/pause, volume, quality and fullscreen controls.
- Keep playback controls immediately usable with a remote.
- Never make users wait for an animation before playing or pausing.
- Avoid excessive motion, decorative effects and unnecessary layout shifts.
- Preserve accurate numeric formatting and stream information.
- Make pagination, filtering and sorting of related content reliable.

### Onboarding and account management

- Use logical, clearly labelled steps.
- Show progress when a journey genuinely has multiple stages.
- Preserve entered data where appropriate when moving between steps.
- Provide inline validation and clear error recovery.
- Explain what information is needed and why, when the product can substantiate that explanation.
- Make security-sensitive actions deliberate and understandable.
- Provide confirmation when an action is actually completed.
- Avoid unnecessary steps, confusing navigation and unexplained redirects.

## 7. TV-specific design patterns

### Remote-first navigation

- All interactive elements must be reachable via D-pad arrow keys.
- Focus rings must be visible and high-contrast on all focusable elements.
- Enter/Back keys must work consistently throughout the app.
- Focus must not get trapped or lost when navigating between pages.
- Focus loops must be implemented at list edges (last → first, first → last).

### Cursor hiding

- Hide mouse cursor on TV-sized screens (coarse pointer).
- Show cursor on desktop/mobile browsers.
- The cursor should reappear when the user moves the mouse.

### Safe areas

- Add safe-area padding for TV overscan (5-10% of edges).
- Ensure critical content is not cut off on TV screens.

### Focus loops

- Implement focus loops at row/list edges.
- When focus reaches the last item in a row, wrap to the first.
- When focus reaches the first item, wrap to the last.

## 8. Micro-interactions and motion

Use purposeful motion, not motion everywhere.

Suitable uses may include:

- Subtle hover and pressed states.
- Clear focus and selection transitions.
- Small feedback animations when a state changes.
- Smooth but quick dialogs, drawers and menus.
- Guided transitions between related onboarding steps.
- Lightweight skeleton shimmer, if it does not distract.
- A subtle confirmation animation after an authoritative successful action.

Rules:

- Motion must not delay user actions.
- Never block channel selection, playback or navigation while an animation runs.
- Avoid animations that cause layout shifts or obscure channel data.
- Do not animate every number update.
- Avoid excessive parallax, bouncing, spinning, glowing or scroll-triggered decoration.
- Respect the user's reduced-motion preference.
- Provide sensible fallbacks for unsupported effects.
- Use consistent duration and easing tokens.
- Keep transitions lightweight and performant.

## 9. Performance requirements

The interface should feel immediate and responsive.

Target sub-second perceived responsiveness for common local interactions where technically achievable. Treat this as an engineering goal, not a guaranteed result for server-dependent operations.

- Do not delay rendering of usable controls while decorative assets load.
- Keep the initial application shell lightweight.
- Use appropriate Next.js rendering, code splitting and lazy loading.
- Load heavy modules when appropriate.
- Avoid unnecessary client-side JavaScript.
- Prevent unnecessary rerenders and duplicated subscriptions.
- Clean up event listeners and WebSocket subscriptions correctly.
- Avoid layout shifts during loading.
- Use skeletons when they help users understand the shape of genuinely loading content.
- Do not show fake skeleton delays for data that is already available.
- Use optimistic updates only where safe, reversible and consistent with the actual data model.
- Measure performance before and after changes using the tools available in the repository.

A visual redesign cannot guarantee sub-second API responses or backend processing. Report frontend rendering, interaction latency and network/backend latency separately when possible.

## 10. Pagination, tables and layout stability

Pagination and container positioning currently work reasonably well. Preserve their behaviour as a baseline, then improve them deliberately.

Before replacing any table or pagination component, document:

- Whether pagination is server-side or client-side.
- How total counts are obtained.
- Whether page size is configurable.
- How filters and sorting interact with pagination.
- What happens when data changes or a page becomes invalid.
- Whether pagination state is encoded in the URL.
- Loading, empty, error and retry behaviour.
- Any backend limits or query parameters.

Do not replace server-side pagination with loading the entire dataset into the browser.

Do not create decorative pagination controls that do not work.

Do not change page counts, result counts or displayed records just to make the layout look better.

Use consistent containers and responsive layouts, but do not introduce excessive whitespace into dense interfaces.

## 11. Non-negotiable implementation safeguards

Before changing a component, identify its responsibilities and dependencies.

- Make small, reviewable changes.
- Keep unrelated changes out of each migration.
- Do not perform blind global replacements.
- Do not delete CSS files at the start.
- Do not rewrite all routes in one operation.
- Do not replace real data with mock data.
- Do not leave placeholder buttons or dead links.
- Do not silently remove functionality.
- Do not bypass TypeScript errors using widespread `any`, unsafe casts or disabled checks.
- Do not weaken authentication, validation, permissions or financial controls.
- Do not alter database schemas or backend contracts as a side effect of frontend work.
- Do not create parallel legacy and new component systems without a documented migration plan.
- Do not claim tests passed without running them.
- Do not start the next migration phase while the current phase has unresolved critical failures.

If the application architecture prevents a safe change, stop and explain the blocker before attempting a risky workaround.

## 12. Required staged workflow

Execute only the step authorised by the latest user prompt.

### Step 1: Read-only audit
Map routes, components, CSS dependencies, user journeys, data flows and regression risks. Do not modify application code.

### Step 2: Design system
Specify the implementation-ready ACUM design system and migration architecture. Do not migrate the whole application.

### Step 3: Representative page
Build one carefully chosen page and prove the system, interactions and responsive behaviour.

### Step 4: Shared foundation
Migrate the application shell and shared components in controlled batches.

### Step 5: Channel directory and player areas
Migrate channel directory, player and streaming interfaces in controlled batches.

### Step 6: Journeys and experience polish
Migrate onboarding, account flows and remaining pages. Complete appropriate motion and interaction work.

### Step 7: Legacy retirement and final QA
Remove obsolete CSS only after dependency checks and successful replacements. Validate the whole application.

## 13. Required documentation

Maintain these artifacts as the project evolves:

- `docs/ui-ux/ROUTE_INVENTORY.md`
- `docs/ui-ux/FUNCTIONALITY_MAP.md`
- `docs/ui-ux/DESIGN_SYSTEM.md`
- `docs/ui-ux/COMPONENT_MIGRATION_MAP.md`
- `docs/ui-ux/USER_JOURNEYS.md`
- `docs/ui-ux/REGRESSION_CHECKLIST.md`
- `docs/ui-ux/MIGRATION_LOG.md`
- `docs/ui-ux/RISK_REGISTER.md`
- `docs/ui-ux/FINAL_QA_REPORT.md`

Create additional documents only when they provide useful information.

## 14. Mandatory checkpoint after every step

At the end of each step, report:

1. What was inspected or changed.
2. Files created, changed, moved or deleted.
3. Routes and components affected.
4. Existing functionality verified.
5. Commands actually run and their results.
6. Browser checks and screenshots completed, if applicable.
7. Outstanding issues and risks.
8. Any deviations from the master specification.
9. Whether the acceptance criteria were met.
10. The exact recommended next step.

Do not automatically proceed to the next step.

Wait for explicit user authorisation before continuing.

## 15. Definition of done

ACUM frontend is ready only when:

- The complete required route inventory is accounted for.
- The new design system is consistently applied.
- Legacy presentation has been replaced where intended.
- Existing functionality and important user journeys remain intact.
- Pagination, filtering, sorting and live updates behave correctly.
- Forms, errors, loading states and confirmations work.
- The responsive experience is verified (mobile + TV).
- Motion is purposeful, accessible and non-blocking.
- Performance is measured rather than guessed.
- Obsolete CSS is removed only when proven safe.
- Critical regression tests pass.
- Remaining limitations are clearly documented.

The objective is a complete, cohesive and premium redesign of the real working platform—not a collection of attractive mockups.