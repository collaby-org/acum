# ACUM — Frontend QA / Bug & Error Checklist Prompt

## Objective

Perform a complete audit of the ACUM frontend (`monorepo/frontend/`) to find and fix all errors, bugs, mistakes, and UX flow issues. Match Netflix-style quality for mobile and TV browsers.

## Scope

- `monorepo/frontend/` only.
- Do not touch TV app (`monorepo/tv/`) or TV apps (`tizen-tv/`, `webos-tv/`, `android-tv/`).
- Do not touch Supabase (`supabase/`).

## Part A: Build & TypeScript

Run these commands and record results:

```bash
cd monorepo/frontend
npm run build
npm run typecheck
npm run lint
```

**Fix all:**
- TypeScript errors (zero tolerance).
- Lint errors (zero tolerance).
- Build failures (zero tolerance).
- Warnings should be reviewed and fixed where they indicate real issues.

## Part B: UI/UX Bugs (Netflix-Style Standard)

### Layout & Styling

- [ ] **Inconsistent spacing**: Check margins, padding, gaps across all pages. Must use consistent design tokens.
- [ ] **Broken responsive layouts**: Test mobile (375px), tablet (768px), desktop (1920px). No horizontal scroll, no cut-off content.
- [ ] **Misaligned elements**: Buttons, inputs, cards must align to grid.
- [ ] **Colour inconsistencies**: Text colours must match design system (primary `#FFFFFF`, secondary `#B3B3B3`, accent red `#E50914`).
- [ ] **Missing focus rings**: All focusable elements must show visible focus rings.
- [ ] **Hover states missing**: Interactive elements must have hover states (desktop) or focus states (TV/remote).

### Navigation & Routing

- [ ] **Broken links**: Every `<a>` and `<Link>` must resolve to an existing page.
- [ ] **Wrong routing**: Deep links must work (e.g., `/canal/[id]` must load the correct channel).
- [ ] **Back button behaviour**: Browser back must return to previous page state.
- [ ] **Deep linking**: Sharing a channel URL must open that channel directly.

### Channel Directory

- [ ] **Channel cards**: Logo, name, status badge, category must display correctly.
- [ ] **Live badge**: Must show red "LIVE" indicator only on live channels.
- [ ] **Offline channels**: Must show correct status, not "Live".
- [ ] **Missing logos**: Fallback (initials or placeholder) must show when logo is missing.
- [ ] **Category filtering**: Filtering by category must work correctly.
- [ ] **Search**: Search must return correct results, handle empty results gracefully.

### Player Page

- [ ] **Auto-play**: Video must start automatically when page loads.
- [ ] **Play/pause**: Must toggle correctly.
- [ ] **Volume**: Must adjust and persist.
- [ ] **Fullscreen**: Must enter and exit fullscreen correctly.
- [ ] **Stream failover**: When source dies, must switch to next available source.
- [ ] **Error states**: Stream failure must show error message with retry option.
- [ ] **Live indicator**: Must show red "LIVE" dot on live channels.

### Auth & Account

- [ ] **Login form**: Validation must work (email format, password length).
- [ ] **Register form**: Validation must work, confirm password must match.
- [ ] **Error messages**: Must be clear, in Romanian, not technical jargon.
- [ ] **Session persistence**: User must stay logged in on refresh.
- [ ] **Logout**: Must clear session and redirect to home.
- [ ] **QR login**: QR code must generate correctly, polling must work.

### Forms & Validation

- [ ] **Empty states**: Forms must show validation errors when submitted empty.
- [ ] **Error messages**: Must be in Romanian, clear, actionable.
- [ ] **Success states**: Must show confirmation after successful action.
- [ ] **Loading states**: Must show spinner/skeleton during async operations.

## Part C: TV-Specific Issues (Frontend Viewed on TV)

- [ ] **Cursor visibility**: Cursor must be hidden on TV-sized screens (coarse pointer).
- [ ] **D-pad navigation**: All focusable elements must be reachable via arrow keys.
- [ ] **Focus rings**: Must be visible and high-contrast on TV screens.
- [ ] **Overscan**: Critical content must not be cut off on TV edges.
- [ ] **Remote controls**: Enter/Back keys must work correctly.
- [ ] **Text size**: Must be readable from 3 meters away (TV viewing distance).
- [ ] **Touch targets**: Minimum 44px for touch targets on mobile.

## Part D: Performance

- [ ] **Initial load**: Home page must load in < 2s on 3G.
- [ ] **Channel switch**: Must switch channels in < 500ms.
- [ ] **Image loading**: Channel logos must load efficiently (lazy loading, correct sizes).
- [ ] **Bundle size**: JavaScript bundle must be reasonable (< 500KB gzipped).
- [ ] **Unused dependencies**: Remove unused packages.

## Part E: Accessibility

- [ ] **Screen readers**: All interactive elements must have aria-labels.
- [ ] **Keyboard navigation**: All functions must be reachable via keyboard.
- [ ] **Colour contrast**: Text must meet WCAG AA contrast ratios.
- [ ] **Reduced motion**: Must respect `prefers-reduced-motion`.
- [ ] **Language**: All user-facing text must be in Romanian.

## Part E: Content & Copy

- [ ] **Romanian copy**: All user-facing text must be in Romanian.
- [ ] **No emojis**: User-facing copy must not contain emojis.
- [ ] **Serious tone**: Copy must be serious, professional, no marketing hype.
- [ ] **Consistent terminology**: Same terms used throughout (canal, live, categorie, etc.).
- [ ] **No placeholder text**: No "Lorem ipsum", "Coming soon", or unfinished copy.

## Part F: Assets & Media

- [ ] **Logos**: All channel logos must exist and load.
- [ ] **Posters**: All programme posters must exist and load.
- [ ] **Favicon**: Must exist and display correctly.
- [ ] **PWA icons**: Must exist for installable PWA.
- [ ] **OG image**: Must exist for social sharing.

## Part G: Errors to Fix Immediately

List each error found with:
1. File path and line number.
2. Error description.
3. Expected behaviour.
4. Severity (Critical / High / Medium / Low).
5. Fix applied.

## Deliverables

1. `docs/qa/FRONTEND_BUG_REPORT.md` — Complete list of all bugs found and fixed.
2. `docs/qa/FRONTEND_CHECKLIST.md` — Checklist with pass/fail for each item above.
3. `docs/qa/FRONTEND_TEST_RESULTS.md` — Build, typecheck, lint results.
4. All fixes committed to `monorepo/frontend/`.

## Success Criteria

- Build passes with zero errors.
- TypeScript passes with zero errors.
- Lint passes with zero errors (warnings acceptable if documented).
- All critical bugs fixed.
- All high-priority bugs fixed.
- Medium bugs documented with plan to fix.
- Low bugs documented optionally.