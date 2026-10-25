# ACUM — Netflix TV App Flow & Architecture Reference

## 1. Netflix TV App: How It Works

Netflix on TV is a **remote-first, 10-foot experience**. Every design decision optimises for:
- **D-pad navigation** (no mouse, no touch)
- **Cursor hidden** (remote only)
- **Focus rings visible** (high contrast, always on)
- **Large text** (readable from 3 meters / 10 feet)
- **Big touch targets** (easy to press with remote)
- **Full-screen video** (immersive, no chrome)
- **Auto-play** (content starts when selected)
- **Back navigation** (remote Back key works everywhere)

---

## 2. Netflix TV Screens & Flow

### Screen 1: Profile Selector ("Who's watching?")
- Grid of profile avatars
- "Add Profile" (+) button
- "Manage Profiles" button
- D-pad navigates between profiles horizontally
- Enter selects profile → loads home

### Screen 2: Home (Netflix-style catalog)
```
┌─────────────────────────────────────────────────────────┐
│  [Logo]    Home  Series  Films  My List  [Profile]     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         FEATURED / HERO BANNER                   │   │
│  │  [Channel Logo]  [Channel Name]                 │   │
│  │  ▶ Redă acum   [Info]                           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  În direct acum                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│  │PRO  │ │ANT 1│ │KANAL│ │    │ │    │  [▶ scroll]   │   │
│  │LIVE │ │LIVE │ │LIVE │ │    │ │    │               │   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘               │
│                                                         │
│  Toate canalele                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│  │PRO  │ │ANT1 │ │KANAL│ │    │ │    │  [▶ scroll]   │   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Screen 3: Channel Detail (click channel)
```
┌─────────────────────────────────────────────────────────┐
│  [Back]  [Channel Name]  [Settings]                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         VIDEO PLAYER (preview, auto-play)        │   │
│  │                                                  │   │
│  │  [LIVE] [Category]                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Channel Name]                                         │
│  [Description text...]                                  │
│                                                         │
│  [▶ Redă acum]  [Lista mea]  [Mai multe]                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Screen 4: Full-Screen Player (click "Redă acum")
```
┌─────────────────────────────────────────────────────────┐
│  [Back]                    [Channel Name]  [Settings]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                   │   │
│  │              FULL SCREEN VIDEO                    │   │
│  │                                                   │   │
│  │                                                   │   │
│  │                                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [⏮]  [⏯]  [⏭]   [🔇] [🔊] [CC] [⚙] [⛶]                 │
│                                                         │
│  [LIVE] [Channel Name]                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Screen 5: QR Login (signed out)
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│           Autentificare pe TV                           │
│                                                         │
│  Scanează codul QR cu telefonul pentru a te             │
│  autentifica pe acest dispozitiv.                       │
│                                                         │
│           ┌─────────────────┐                           │
│           │   [QR CODE]     │                           │
│           │                 │                           │
│           └─────────────────┘                           │
│                                                         │
│  Scanează cu camera telefonului                         │
│                                                         │
│  Sesiune expiră în 5:00                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Navigation Map

```
[Profile Selector] ──Enter──> [Home Directory]
                                    │
                                    ├──Enter (channel)──> [Channel Detail]
                                    │                                    │
                                    │                                    ├──Enter ("Redă acum")──> [Full-Screen Player]
                                    │                                    │
                                    │                                    └──Back──> [Home Directory]
                                    │
                                    └──Back──> [Profile Selector]

[QR Login] ──Phone Auth──> [Home Directory]   (auto-redirect)
[Channel Detail] ──Back──> [Home Directory]
[Full-Screen Player] ──Back──> [Channel Detail]
```

---

## 4. Keyboard / Remote Mapping

| Key | Home | Channel Detail | Full Player | QR Login |
|-----|------|----------------|-------------|----------|
| Arrow Up | Navigate rows up | Navigate | Hide controls | - |
| Arrow Down | Navigate rows down | Navigate | Show controls | - |
| Arrow Left | Navigate left | Navigate | Skip back 10s | - |
| Arrow Right | Navigate right | Navigate | Skip forward 30s | - |
| Enter | Open channel | Open detail / play | Toggle play/pause | - |
| Back | - | Back to home | Back to detail | - |
| Space | - | - | Toggle play/pause | - |
| M | - | - | Toggle mute | - |
| I | - | - | Toggle info | - |

---

## 5. Animations & Motion (Netflix TV Style)

### Focus Transitions
- Card scales from 1.0 → 1.15 on focus (300ms, ease-out)
- Focus ring appears: 2px → 4px red ring
- Card shadow increases: `shadow-md` → `shadow-2xl`
- Other cards dim slightly (opacity 0.8 → 0.6)

### Page Transitions
- Slide left → right (new page slides in from right)
- Slide right → left (Back, previous page slides in from left)
- Duration: 300ms, ease-out
- Fade overlay between pages (black overlay, 200ms)

### Player Controls
- Controls fade in on any remote input (200ms)
- Controls fade out after 3 seconds of inactivity (500ms)
- Play/pause toggle: instant (no animation)
- Volume slider: smooth slider movement

### Loading States
- Channel cards: skeleton shimmer (pulse animation, 1.5s cycle)
- Player: black screen + spinner (centered, 2s max)
- Page navigation: fade overlay, no content flash

### Rules
- Motion must never block user action
- No animations during critical flows (login, playback)
- Respect `prefers-reduced-motion` (disable all animations)
- No parallax, bouncing, or scroll-triggered decoration

---

## 6. TV App Pages & Requirements

### Required Pages

| Page | Route | Purpose | Remote Keys |
|------|-------|---------|-------------|
| Profile Selector | `/tv/profiles` | Choose profile | Enter select, Back exit |
| Home / Catalog | `/tv` | Channel directory, hero banner | D-pad, Enter, Back |
| Channel Detail | `/tv/canal/[id]` | Channel info, preview, play | Enter play, Back |
| Full Player | `/tv/canal/[id]/player` | Full-screen video | Play/pause, skip, volume, Back |
| QR Login | `/tv/auth/qrcode` | QR code for phone auth | - |
| Search | `/tv/search` | Search channels | D-pad, Enter |
| Settings | `/tv/settings` | Quality, captions, audio | D-pad, Enter |

### Page Components

#### TVNav (sticky top bar)
- ACUM logo (left)
- Navigation: Home, Series, Films, My List
- Profile avatar (right)
- Search icon (right)
- Fixed height: 64px
- Background: black with slight blur

#### TVHero (featured banner)
- Full-width background image (featured channel)
- Gradient overlay (black, transparent bottom-right)
- Channel logo + name (left side)
- "Redă acum" button (primary, gold/red)
- "Info" button (secondary, outline)
- Auto-play trailer on focus (optional)

#### TVChannelRow (horizontal scroll)
- Row title (left, above cards)
- Scrollable row of channel cards
- Edge fade gradient (right side)
- Prev/Next buttons (appear on hover/focus, optional for remote)

#### TVChannelCard
- Channel logo (square, rounded corners)
- Channel name (below logo)
- Status badge: "Live" (red) or "Offline" (grey)
- Current show name (small, below name)
- Focus ring: 4px red ring on focus
- Scale up: 1.15x on focus

#### TVPlayer
- Video fills entire viewport
- Controls overlay (bottom, semi-transparent black)
- Info overlay (top-left: channel name, LIVE indicator)
- Controls: play/pause, skip back 10s, skip forward 30s, volume, quality, captions, settings, fullscreen
- Controls auto-hide after 3s inactivity
- Controls reappear on any input

#### TVLoginScreen (QR)
- Large QR code (centre)
- Text: "Scan to log in to ACUM TV on this screen"
- Countdown timer: "Session expires in 5:00"
- Alternative: "Continue on phone" (alphanumeric code)
- Auto-redirect on successful auth

---

## 7. QR Auth Flow (A-to-Z)

### Architecture
- **TV App** (`monorepo/tv/`) → displays QR code, polls for session
- **Frontend** (`monorepo/frontend/`) → at `https://acum-weld.vercel.app/tv-link?code=XXXX` handles phone authentication
- **Backend** (Supabase) → validates user, creates TV session cookie
- **TV Session** → cookie `tv-session` scoped to TV domain

### Flow Diagram

```
┌─────────────┐     Scan QR      ┌──────────────────┐     Authorise     ┌─────────────┐
│   TV App    │ ───────────────> │   Phone Browser  │ ────────────────> │  Frontend   │
│  (monorepo/ │  QR code shows   │  (acum-weld.ver- │   Login / Reg     │   (web)     │
│   tv/)      │  code + URL      │  cel.app/tv-link │  Confirm session  │             │
└─────────────┘                  │  ?code=XXXX      │  → Set cookie     └─────────────┘
                                 │                  │  → Redirect TV    │
                                 └──────────────────┘     └─────────────┘
                                           │                       │
                                           │   Set tv-session      │
                                           │   cookie (SameSite)   │
                                           ▼                       ▼
                                 ┌──────────────────┐     ┌─────────────┐
                                 │   Phone shows    │     │   TV polls  │
                                 │   "Success"      │     │   /api/auth │
                                 │   page           │     │   /confirm- │
                                 └──────────────────┘     │   -tv       │
                                                          │   every 1.5s│
                                                          └─────────────┘
                                                                     │
                                                                     ▼
                                                          ┌─────────────┐
                                                          │  TV detects │
                                                          │  session    │
                                                          │  → Redirect │
                                                          │  to /tv     │
                                                          └─────────────┘
```

### Step-by-Step Flow

#### Step 1: TV Shows QR Code
1. User opens TV app at `/tv`
2. If not signed in, show QR login screen
3. TV generates unique 8-character code: `ACUM-XXXX`
4. QR code encodes: `https://acum-weld.vercel.app/tv-link?code=ACUM-XXXX&tv_id=<device_id>`
5. TV displays QR code large in centre of screen
6. TV starts polling `/api/auth/confirm-tv` every 1.5 seconds
7. Countdown timer: "Session expires in 5:00" (counts down)

#### Step 2: Phone Scans QR
1. User opens phone camera
2. Scans QR code
3. Phone browser opens: `https://acum-weld.vercel.app/tv-link?code=ACUM-XXXX`
4. Frontend page loads (`/tv-link` route)
5. Shows: "Confirm login to ACUM TV on [Device Name]"
6. Shows: "Continue" button or login form if not logged in

#### Step 3: Phone Authenticates
1. User taps "Continue" (if already logged in) OR logs in/registers
2. Frontend sends request to backend: `POST /api/auth/confirm-tv`
3. Body: `{ code: "ACUM-XXXX", tv_id: "<device_id>" }`
4. Backend validates code against stored session
5. Backend validates user session (from phone cookies)
6. Backend creates TV session: sets cookie `tv-session` with user data
7. Backend returns: `{ ok: true }`

#### Step 4: Phone Shows Confirmation
1. Frontend receives `{ ok: true }`
2. Shows: "✅ Connected! Your TV will now log in automatically."
3. Phone user can close browser

#### Step 5: TV Detects Session
1. TV polls `/api/auth/confirm-tv` (GET) every 1.5 seconds
2. Request includes cookies (tv-session if set)
3. Backend checks if tv-session cookie exists for this device
4. If found: returns `{ ok: true, user: {...} }`
5. TV receives confirmation
6. TV stops polling
7. TV redirects to `/tv` (home directory)
8. TV is now signed in

### API Endpoints

#### `POST /api/auth/confirm-tv`
```
Request:
  Content-Type: application/json
  Body: { code: string, tv_id: string }

Response (success):
  { ok: true }

Response (error):
  { error: "invalid_code" | "expired" | "not_authenticated" }
```

#### `GET /api/auth/confirm-tv`
```
Request:
  Cookies: tv-session (if set)

Response (not confirmed yet):
  { ok: false }

Response (confirmed):
  { ok: true, user: { id, name, email, plan } }
```

### Cookie: tv-session
- Name: `tv-session`
- Value: encrypted session token
- Domain: `.vercel.app` (or TV domain)
- Path: `/`
- HttpOnly: true
- Secure: true
- SameSite: lax
- Max-Age: 2592000 (30 days)

### Device Registration
- TV generates `tv_id` on first launch (stored in localStorage)
- tv_id sent with QR code and poll requests
- Backend associates tv-session with tv_id

---

## 8. Frontend Routes (for TV Auth)

| Route | Purpose |
|-------|---------|
| `/tv-link?code=XXXX` | Phone landing page for TV auth |
| `/tv-link?code=XXXX&tv_id=YYY` | Phone landing with device ID |
| `/api/auth/confirm-tv` (POST) | Confirm TV session from phone |
| `/api/auth/confirm-tv` (GET) | TV polls for session confirmation |

## 9. TV App Routes

| Route | Purpose | Auth Required |
|-------|---------|---------------|
| `/tv` | Channel directory (Netflix home) | Yes |
| `/tv/canal/[id]` | Channel detail + preview | Yes |
| `/tv/canal/[id]/player` | Full-screen player | Yes |
| `/tv/auth/qrcode` | QR login screen | No |
| `/tv/search` | Search channels | Yes |
| `/tv/settings` | Quality, captions, audio | Yes |
| `/tv/profiles` | Profile selector | No |

---

## 10. Error Handling

| Error | TV Shows | Phone Shows |
|-------|----------|-------------|
| Invalid QR code | "Cod invalid. Scanarea din nou." | "Cod invalid" |
| Expired QR code | "Codul a expirat. Reîmprospătează." | "Cod expirat" |
| Not authenticated | "Vă rugă să vă autentificați." | "Vă rugă să vă autentificați." |
| Network error | "Încercați din nou" button | "Încercați din nou" button |
| Session confirmed | Auto-redirect to `/tv` | "Conectat! TV-ul se va autentifica." |

---

## 11. Implementation Checklist

### TV App (`monorepo/tv/`)
- [ ] Channel directory page (`/tv`)
- [ ] Channel detail page (`/tv/canal/[id]`)
- [ ] Full-screen player (`/tv/canal/[id]/player`)
- [ ] QR login screen (`/tv/auth/qrcode`)
- [ ] Search page (`/tv/search`)
- [ ] Settings page (`/tv/settings`)
- [ ] Profile selector (`/tv/profiles`)
- [ ] TVNav component
- [ ] TVHero component
- [ ] TVChannelRow component
- [ ] TVChannelCard component
- [ ] TVPlayer component
- [ ] TVLoginScreen component
- [ ] TVSearchScreen component
- [ ] TVCategoryRow component
- [ ] TVFocusRing component
- [ ] TVSafeArea component
- `use-remote-nav` hook
- `use-cursor` hook
- `use-focus-loop` hook
- `stream.ts` library
- `auth.ts` library (QR polling)
- `qr.ts` library (QR generation)

### Frontend (`monorepo/frontend/`)
- [ ] `/tv-link?code=XXXX` page
- [ ] `/api/auth/confirm-tv` POST route
- [ ] `/api/auth/confirm-tv` GET route
- [ ] TV session cookie handling
- [ ] Phone confirmation page

### Backend (Supabase)
- [ ] TV session storage
- [ ] QR code validation
- [ ] User authentication
- [ ] Session expiry (5 minutes)

---

## 11. Testing the Flow

### Manual Test
1. Open TV app at `https://tv.acum-weld.vercel.app/tv`
2. If not signed in, QR login screen appears
3. Scan QR with phone
4. Phone opens `https://acum-weld.vercel.app/tv-link?code=XXXX`
5. Phone logs in (or is already logged in)
6. Phone taps "Continue"
7. Phone shows "Connected!"
8. TV automatically redirects to `/tv` (home directory)
9. TV is now signed in
10. Select channel → preview plays
11. Click "Redă acum" → full-screen player
12. Use remote: Back exits player, Back exits detail, Back exits to home

### Automated Test
- [ ] Build passes with zero errors
- [ ] TypeScript passes with zero errors
- [ ] Lint passes with zero errors
- [ ] QR generation works
- [ ] QR polling works
- [ ] Session confirmation works
- [ ] Auto-redirect works
- [ ] D-pad navigation works on all screens
- [ ] Focus rings visible
- [ ] Focus loops at row edges
- [ ] Cursor hidden on TV, visible on desktop
- [ ] Full-screen player works with remote
- [ ] Stream failover works
- [ ] Error handling works (invalid code, expired, network)
