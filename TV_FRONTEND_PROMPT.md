# ACUM — TV Frontend: Complete Industrial-Grade Redesign Prompt

## Objective

Build a Netflix-quality native-feel TV application in `monorepo/tv/` by copying the frontend from `monorepo/frontend/` and completely rewriting it for TV-native interaction: D-pad navigation, cursor hiding, overscan-safe layout, remote focus loops, full-screen player, QR login flow, and industrial-grade transitions.

## Architecture

- **`monorepo/frontend/`** — Desktop/mobile web app at `https://acum-weld.vercel.app/` (already built).
- **`monorepo/tv/`** — Separate TV app, deployed independently on Vercel as a standalone website.
- **Auth flow**: TV shows QR code → user scans with phone → phone opens frontend website to authenticate → TV gets session (via QR auth bridge).
- **No shared state between TV and frontend** — they communicate only via the QR auth flow.

## Phase 1: Copy Frontend → TV

1. Copy `monorepo/frontend/` to `monorepo/tv/`.
2. Remove all files NOT needed for a TV app (channel detail pages not related to TV viewing, admin pages, settings pages that don't make sense on TV).
3. Keep only: channel directory, channel list, player page, login/QR screen, search, and TV-optimised navigation.
4. Strip out desktop-only CSS, mouse-dependent interactions, hover states that don't translate to remote.

## Phase 2: TV-Override All Styling (Netflix TV Style)

### TV-Specific Design System

Create `design-system/` with:

**Colours:**
- Background: `#000000` (pure black)
- Surface: `#141414` (Netflix black)
- Surface elevated: `#181818`
- Text primary: `#FFFFFF`
- Text secondary: `#B3B3B3`
- Accent red: `#E50914`
- Border: `#333333`

**Typography:**
- Font: Inter or system sans-serif
- H1: 3rem, bold, tight tracking
- H2: 2rem, bold
- Body: 1rem
- Small: 0.875rem

**Layout:**
- Safe area: 60px padding on all sides (TV overscan)
- Max content width: 1920px, centred
- Row gap: 40px
- Item gap: 20px

### Components to Build

1. **TVNav** — Sticky top bar: ACUM logo, Home, Search, Profile. Fixed height, no hover states.
2. **TVHero** — Full-width featured channel card with background image, title, "Play" and "Info" buttons. Auto-plays trailer on focus.
3. **TVChannelRow** — Horizontal scrollable row of channel cards. Cards scale up on focus (1.15x). Edge fade on scroll. Live indicator badge.
4. **TVChannelCard** — Channel logo, name, status badge (Live/Offline), current show name. Focus ring: 4px red ring.
5. **TVPlayer** — Full-screen video player with: play/pause, skip back/forward 10s, volume, quality selector, info overlay. Controls auto-hide after 3s of inactivity.
6. **TVLoginScreen** — QR code display, countdown timer, "Continue on phone" option. No keyboard input on TV.
7. **TVSearchScreen** — Full-screen search with large text input optimised for D-pad.
8. **TVCategoryRow** — Category rows: "Live Now", "News", "Sports", "Movies", "Series", etc.

### Focus Management

- Every focusable element must show a visible focus ring (4px solid `#E50914`).
- D-pad navigation: Up/Down/Left/Right moves focus between rows and items.
- Enter key selects/activates focused element.
- Back key exits current page/layer.
- Focus loops at row edges: last item → first item, first item → last item.
- Focus rings must remain visible at all times (no hover-only states).

### Cursor Management

- Hide cursor on TV-sized screens (width > 1024px AND coarse pointer).
- Show cursor on desktop/mobile browsers.
- Reappear cursor immediately on any mouse movement.

### Full-Screen Player

- Video fills entire viewport.
- Controls overlay on bottom, semi-transparent black gradient.
- Info overlay top-left: channel name, "Live" indicator.
- Controls auto-hide after 3 seconds of no input.
- Volume slider, quality selector (Auto, 1080p, 720p, 480p), captions toggle.
- Skip back 10s, skip forward 30s buttons.

### Transitions

- Page transitions: slide left/right (like Netflix).
- Focus scale: 1.0 → 1.15 on focus, 300ms ease.
- Modal/fullscreen: fade in/out, 200ms.
- No layout shifts during loading.

## Phase 3: Auth Flow (QR Code)

### TV Side (`monorepo/tv/`)

1. **Login screen**: Large QR code in centre. Text: "Scan to log in to ACUM TV on this screen."
2. **Countdown**: "Session expires in 5:00" — counts down from 5 minutes.
3. **Alternative**: "Continue on phone" → shows short alphanumeric code to enter at `acum-weld.vercel.app/tv-link`.
4. **Auto-redirect**: Once phone authenticates, TV redirects to channel directory.

### QR Code Generation

- QR contains: `https://acum-weld.vercel.app/tv-link?code=<unique_code>&tv_id=<device_id>`
- Code is 8 characters, expires after 5 minutes.
- TV polls `/api/auth/confirm-tv` every 1.5 seconds.
- When code is confirmed, TV redirects to home directory.

### Phone Side (Frontend Website)

- User scans QR → opens `https://acum-weld.vercel.app/tv-link?code=<code>`
- User logs in/registers on frontend.
- Backend confirms TV session → TV auto-redirects.

## Phase 4: Industrial-Grade Requirements

### Error Handling

- Stream fails → show fallback message with "Try again" button.
- Stream dies mid-playback → auto-switch to next available source (failover chain).
- QR expired → show "Refresh code" button.
- Network lost → show "No connection" overlay with retry.

### Loading States

- Channel cards: skeleton placeholder while loading logos.
- Player: black screen with spinner, then fade in video.
- Page transitions: fade overlay, no content flash.

### Accessibility

- All focusable elements have aria-labels.
- Screen reader announces channel name on focus.
- Reduced motion respected (disable animations if `prefers-reduced-motion`).
- High contrast mode respected.

### Performance

- Initial load: hero + first row visible in < 1s.
- Channel switch: < 300ms to show new channel info.
- Video start: < 2s from click to playing.
- Lighthouse score: 90+ on mobile, 95+ on desktop.

## Phase 5: Testing Checklist

- [ ] D-pad navigation works on all screens
- [ ] Focus rings visible on all focusable elements
- [ ] Focus loops at row edges
- [ ] Cursor hidden on TV screens, visible on desktop
- [ ] Full-screen player works with remote controls
- [ ] QR code login flow completes end-to-end
- [ ] Stream failover works when source dies
- [ ] Auto-hide controls after 3s inactivity
- [ ] No layout shifts during loading
- [ ] Build passes with zero errors
- [ ] Lighthouse score 90+ mobile, 95+ desktop

## Deliverables

1. Complete `monorepo/tv/` application (all source files).
2. `monorepo/tv/README.md` — setup, deploy, auth flow instructions.
3. `monorepo/tv/.github/workflows/ci.yml` — CI for TV app.
4. `monorepo/tv/package.json` — dependencies and scripts.
5. All TypeScript types defined and passing.
6. All lint rules passing.
7. Build succeeds with zero errors.

## Files to Create/Modify

### Create:
- `monorepo/tv/package.json`
- `monorepo/tv/next.config.ts`
- `monorepo/tv/tsconfig.json`
- `monorepo/tv/tailwind.config.ts`
- `monorepo/tv/src/app/layout.tsx`
- `monorepo/tv/src/app/page.tsx` — Channel directory (Netflix home)
- `monorepo/tv/src/app/canal/[id]/page.tsx` — Channel detail + player
- `monorepo/tv/src/app/auth/login/page.tsx` — QR login screen
- `monorepo/tv/src/components/TVNav.tsx`
- `monorepo/tv/src/components/TVHero.tsx`
- `monorepo/tv/src/components/TVChannelRow.tsx`
- `monorepo/tv/src/components/TVChannelCard.tsx`
- `monorepo/tv/src/components/TVPlayer.tsx`
- `monorepo/tv/src/components/TVLoginScreen.tsx`
- `monorepo/tv/src/components/TVSearchScreen.tsx`
- `monorepo/tv/src/components/TVCategoryRow.tsx`
- `monorepo/tv/src/components/TVFocusRing.tsx`
- `monorepo/tv/src/components/TVSafeArea.tsx`
- `monorepo/tv/src/lib/stream.ts`
- `monorepo/tv/src/lib/auth.ts`
- `monorepo/tv/src/lib/qr.ts`
- `monorepo/tv/src/hooks/use-remote-nav.ts`
- `monorepo/tv/src/hooks/use-cursor.ts`
- `monorepo/tv/src/hooks/use-focus-loop.ts`
- `monorepo/tv/.github/workflows/ci.yml`
- `monorepo/tv/README.md`

### Copy & Modify from frontend:
- Channel data structure (adapt for TV)
- Stream resolution logic (adapt for TV player)
- Auth configuration (adapt for QR flow)
- Brand colours (adapt to Netflix black theme)

## Success Criteria

- TV app builds with zero TypeScript errors.
- TV app lints with zero errors.
- D-pad navigation works end-to-end on all screens.
- QR auth flow completes end-to-end.
- Full-screen player works with remote controls.
- Cursor management works correctly (hidden on TV, visible on desktop).
- All transitions are smooth, no layout shifts.
- Industrial-grade error handling and loading states.
- Accessible: screen reader support, high contrast, reduced motion.