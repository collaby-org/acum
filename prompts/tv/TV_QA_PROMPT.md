# ACUM — TV Frontend QA / Bug & Error Checklist Prompt

## Objective

Perform a complete audit of the ACUM TV frontend (`monorepo/tv/`) to find and fix all errors, bugs, mistakes, and UX flow issues. Match Netflix TV app quality for Samsung, LG, TCL, Sony smart TVs.

## Scope

- `monorepo/tv/` only.
- Do not touch frontend (`monorepo/frontend/`).
- Do not touch Supabase (`supabase/`).
- Do not touch TV wrapper projects (`tizen-tv/`, `webos-tv/`, `android-tv/`).

## Part A: Build & TypeScript

Run these commands and record results:

```bash
cd monorepo/tv
npm run build
npm run typecheck
npm run lint
```

**Fix all:**
- TypeScript errors (zero tolerance).
- Lint errors (zero tolerance).
- Build failures (zero tolerance).

## Part B: TV-Specific UI/UX Bugs (Netflix TV App Standard)

### Remote Navigation (D-Pad)

- [ ] **All focusable elements reachable**: Every button, link, card must be reachable via arrow keys.
- [ ] **Focus rings visible**: 4px solid `#E50914` ring on all focused elements.
- [ ] **Focus loops**: Last item in row → first item, first item → last item.
- [ ] **No focus traps**: User cannot get stuck on any element.
- [ ] **Enter key**: Activates focused element (plays channel, opens menu, etc.).
- [ ] **Back key**: Exits current page/layer.
- [ ] **Focus persistence**: Focus returns to correct element when navigating back.

### Cursor Management

- [ ] **Cursor hidden on TV**: When screen width > 1024px AND pointer is coarse, cursor must be hidden.
- [ ] **Cursor visible on desktop/mobile browsers**: When pointer is fine, cursor must be visible.
- [ ] **Cursor reappears**: On any mouse movement, cursor must reappear immediately.

### Layout & Overscan

- [ ] **Safe area padding**: Critical content must not be within 60px of screen edges.
- [ ] **No horizontal scroll**: Content must fit within screen width on TV.
- [ ] **No cut-off content**: Channel cards, player controls, text must not be cut off.
- [ ] **Text readable from 3 meters**: Minimum font size 1rem for body, 2rem for titles.

### Player Page (TV-Optimised)

- [ ] **Auto-play**: Video must start automatically when channel selected.
- [ ] **Full-screen**: Video must fill entire viewport.
- [ ] **Controls overlay**: Play/pause, skip back/forward 10s, volume, quality selector.
- [ ] **Controls auto-hide**: After 3 seconds of no input, controls fade out.
- [ ] **Controls reappear**: On any remote input, controls must reappear.
- [ ] **Stream failover**: When source dies, must switch to next available source automatically.
- [ ] **Error states**: Stream failure must show error message with "Try again" button.
- [ ] **Live indicator**: Red dot + "LIVE" text on live channels.
- [ ] **Channel info**: Channel name, current show, category must display correctly.

### Channel Directory (TV Home)

- [ ] **Hero banner**: Featured channel with background image, title, play button.
- [ ] **Horizontal rows**: Channels in scrollable horizontal rows.
- [ ] **Row categories**: "Live Now", "News", "Sports", "Movies", "Series", etc.
- [ ] **Card scaling**: Cards scale up (1.15x) on focus.
- [ ] **Edge fade**: Cards fade at row edges to indicate scrollable content.
- [ ] **Live badges**: Red "LIVE" indicator on live channels.

### QR Login Screen

- [ ] **QR code**: Large, scannable QR code in centre of screen.
- [ ] **Countdown timer**: Shows remaining time (5 minutes).
- [ ] **Alternative**: "Continue on phone" option with alphanumeric code.
- [ ] **Auto-redirect**: When phone authenticates, TV redirects to home directory.
- [ ] **Polling**: TV polls `/api/auth/confirm-tv` every 1.5 seconds.
- [ ] **Expired code**: Show "Refresh code" button when expired.

### Search Screen

- [ ] **Full-screen search**: Search takes over full screen.
- [ ] **Large text input**: Easy to navigate with D-pad.
- [ ] **Search results**: Display channel cards matching search query.
- [ ] **Empty state**: Show message when no results found.

## Part C: Performance (TV)

- [ ] **Initial load**: Home page must load in < 2s on typical TV connection.
- [ ] **Channel switch**: Must switch channels in < 500ms.
- [ ] **Video start**: Must start playing in < 2s from channel selection.
- [ ] **Image loading**: Channel logos must lazy load.
- [ ] **Bundle size**: JavaScript bundle must be reasonable for TV devices.

## Part D: Errors to Fix Immediately

List each error found with:
1. File path and line number.
2. Error description.
3. Expected behaviour.
4. Severity (Critical / High / Medium / Low).
5. Fix applied.

## Deliverables

1. `docs/qa/TV_BUG_REPORT.md` — Complete list of all bugs found and fixed.
2. `docs/qa/TV_CHECKLIST.md` — Checklist with pass/fail for each item above.
3. `docs/qa/TV_TEST_RESULTS.md` — Build, typecheck, lint results.
4. All fixes committed to `monorepo/tv/`.

## Success Criteria

- Build passes with zero errors.
- TypeScript passes with zero errors.
- Lint passes with zero errors.
- D-pad navigation works end-to-end on all screens.
- Focus rings visible on all focusable elements.
- Focus loops at row edges work correctly.
- Cursor hidden on TV screens, visible on desktop.
- Full-screen player works with remote controls.
- QR auth flow completes end-to-end.
- Stream failover works when source dies.
- All critical bugs fixed.
- All high-priority bugs fixed.