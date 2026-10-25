# ACUM — TV QR Authentication Flow Specification

## Overview

The TV app uses a **QR code authentication flow** because TV remotes cannot easily input email/password. The user scans a QR code with their phone, authenticates on the frontend website, and the TV automatically detects the session and redirects to the home directory.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TV APP (monorepo/tv/)                   │
│  https://tv.acum-weld.vercel.app                                │
│                                                                 │
│  1. User opens /tv                                              │
│  2. Not signed in → show QR Login screen                        │
│  3. Generate QR code: acum-weld.vercel.app/tv-link?code=XXXX   │
│  4. Display QR code + countdown (5 min)                         │
│  5. Poll /api/auth/confirm-tv every 1.5s                        │
│  6. Detect session → redirect to /tv                            │
└─────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Scan QR
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (monorepo/frontend/)              │
│  https://acum-weld.vercel.app                                   │
│                                                                 │
│  1. Phone opens /tv-link?code=XXXX                              │
│  2. Show "Confirm login to ACUM TV"                             │
│  3. User logs in / registers                                    │
│  4. POST /api/auth/confirm-tv { code, tv_id }                   │
│  5. Backend sets tv-session cookie                              │
│  6. Show "Connected! TV will log in."                           │
└─────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Backend sets cookie
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Supabase)                         │
│                                                                 │
│  - Validate code                                                │
│  1. Validate user session                                       │
│  2. Create tv-session cookie                                    │
│  3. Associate with tv_id                                        │
│  4. Expire after 5 minutes (code) / 30 days (session)          │
└─────────────────────────────────────────────────────────────────┘
```

## Detailed Flow

### Phase 1: TV Generates QR Code

**TV App** (`monorepo/tv/src/app/auth/qrcode/page.tsx`):

1. On mount, check if user is signed in
2. If not signed in:
   a. Generate `tv_id` (store in localStorage if not exists)
   b. Generate 8-character code: `ACUM-XXXXXX`
   c. Store code in temporary storage (in-memory or short-lived DB)
   d. Set expiry: 5 minutes from now
   e. Generate QR code image URL: `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=https://acum-weld.vercel.app/tv-link?code=ACUM-XXXXXX&tv_id=<tv_id>`
   f. Display QR code + instructions
   g. Start countdown timer (5:00 → 0:00)
   h. Start polling `/api/auth/confirm-tv` every 1.5 seconds

**Poll Request:**
```
GET /api/auth/confirm-tv
Cookies: tv-session (if previously set)
```

**Poll Response:**
```json
// Not yet confirmed
{ "ok": false }

// Confirmed
{ "ok": true, "user": { "id": "uuid", "name": "Ion Popescu", "email": "ion@example.com", "plan": "free" } }
```

### Phase 2: Phone Scans & Authenticates

**Frontend Page** (`monorepo/frontend/src/app/tv-link/page.tsx`):

1. Extract `code` and `tv_id` from URL query params
2. Show page:
   - Title: "Autentificare TV ACUM"
   - Text: "Scanează acest cod pe telefonul tău pentru a te autentifica pe TV."
   - Device info: "Dispozitiv: Samsung UE65AU9007KXXU"
   - Two buttons: "Autentificare" (if not logged in) or "Confirmare" (if logged in)
3. If user not logged in:
   - Show login form: email + password
   - Show register link: "Nu ai cont? Creează cont"
4. If user logged in:
   - Show "Confirmare" button: "Confirmă autentificarea pe TV"
5. On confirmation:
   a. `POST /api/auth/confirm-tv` with `{ code: "ACUM-XXXXXX", tv_id: "<tv_id>" }`
   b. Backend validates code, creates session
   c. Frontend shows: "✅ Conectat! TV-ul se va autentifica automat."

**Confirm Request:**
```
POST /api/auth/confirm-tv
Content-Type: application/json
Body: { "code": "ACUM-XXXXXX", "tv_id": "tv_abc123" }
```

**Confirm Response:**
```json
// Success
{ "ok": true }

// Error: invalid code
{ "error": "invalid_code" }

// Error: expired code
{ "error": "expired" }

// Error: user not authenticated
{ "error": "not_authenticated" }
```

### Phase 3: Backend Creates TV Session

**Backend Route** (`/api/auth/confirm-tv`):

1. Validate request body: `code` and `tv_id` present
2. Look up code in temporary storage
3. Check code not expired (5 minutes)
4. Check code not already used
5. Validate user session (from phone's cookies)
6. Create `tv-session` cookie:
   - Value: encrypted JWT with user ID + tv_id
   - Domain: `.vercel.app`
   - Path: `/`
   - HttpOnly: true
   - Secure: true
   - SameSite: lax
   - Max-Age: 2592000 (30 days)
7. Mark code as used
8. Return `{ ok: true }`

### Phase 4: TV Detects Session & Redirects

**TV App Poll Loop:**

1. Every 1.5 seconds, `GET /api/auth/confirm-tv`
2. Include cookies (tv-session if set by phone)
3. If response `{ ok: true }`:
   a. Stop polling
   b. Store user session in localStorage
   c. Redirect to `/tv` (home directory)
4. If response `{ ok: false }`:
   a. Continue polling
5. If countdown reaches 0:
   a. Stop polling
   b. Show "Codul a expirat. Reîmprospătează." button
   c. User can generate new QR code

---

## 10. API Specification

### POST /api/auth/confirm-tv

**Request:**
```http
POST /api/auth/confirm-tv HTTP/1.1
Content-Type: application/json
Cookie: sb-access-token=... (phone's session)

{
  "code": "ACUM-XXXXXX",
  "tv_id": "tv_abc123def456"
}
```

**Success Response:**
```http
HTTP/1.1 200 OK
Set-Cookie: tv-session=eyJ...; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/

{
  "ok": true
}
```

**Error Responses:**
```http
HTTP/1.1 400 Bad Request
{ "error": "invalid_code" }

HTTP/1.1 400 Bad Request
{ "error": "expired" }

HTTP/1.1 401 Unauthorized
{ "error": "not_authenticated" }
```

### GET /api/auth/confirm-tv

**Request:**
```http
GET /api/auth/confirm-tv HTTP/1.1
Cookie: tv-session=eyJ... (if TV session exists)
```

**Success Response (session exists):**
```http
HTTP/1.1 200 OK
{
  "ok": true,
  "user": {
    "id": "user_uuid",
    "name": "Ion Popescu",
    "email": "ion@example.com",
    "plan": "free"
  }
}
```

**Error Response (no session):**
```http
HTTP/1.1 200 OK
{ "ok": false }
```

---

## 10. TV Session Management

### tv-session Cookie

| Property | Value |
|----------|-------|
| Name | `tv-session` |
| Domain | `.vercel.app` |
| Path | `/` |
| HttpOnly | true |
| Secure | true |
| SameSite | lax |
| Max-Age | 2592000 (30 days) |
| Value | Encrypted JWT: `{ userId, tvId, issuedAt, expiresAt }` |

### TV Session Storage (localStorage)

```json
{
  "tv_user": {
    "id": "user_uuid",
    "name": "Ion Popescu",
    "email": "ion@example.com",
    "plan": "free"
  },
  "tv_session_valid": true,
  "tv_session_expires_at": "2026-11-22T12:00:00Z"
}
```

### TV Auth State

The TV app checks auth state on every page load:
1. Check localStorage for `tv_user`
2. If exists and not expired → show home directory
3. If missing or expired → show QR login screen
4. On every navigation, re-verify session with `/api/auth/confirm-tv` (GET)

---

## 11. Error Scenarios & Handling

| Scenario | TV Shows | Phone Shows | Resolution |
|----------|----------|-------------|------------|
| Invalid QR code | "Cod invalid. Scanează din nou." | "Cod invalid" | Generate new QR |
| Expired code (5 min) | "Codul a expirat. Reîmprospătează." | "Cod expirat" | Generate new QR |
| User not logged in (phone) | (waits) | Login form | User logs in |
| Network error | "Încercați din nou" button | "Încercați din nou" button | Retry |
| Session confirmed | Auto-redirect to `/tv` | "Conectat! TV-ul se autentifică." | Success |
| TV session expired | Show QR login again | - | Re-scan QR |
| Multiple TVs | Each TV has unique tv_id | Each QR is device-specific | Independent sessions |

---

## 12. Security Considerations

1. **Code entropy**: 8-character alphanumeric code (36^8 ≈ 2.8 trillion combinations)
2. **Code expiry**: 5 minutes maximum
3. **One-time use**: Code can only be used once
4. **TV binding**: Code is bound to specific `tv_id`
5. **HttpOnly cookie**: `tv-session` cannot be read by JavaScript
6. **Secure flag**: Cookie only sent over HTTPS
7. **SameSite=lax**: Prevents CSRF from other sites
8. **No sensitive data in QR**: QR only contains URL with code, not user credentials

---

## 13. Files to Implement

### Frontend (`monorepo/frontend/`)
- `src/app/tv-link/page.tsx` — Phone landing page for TV auth
- `src/app/api/auth/confirm-tv/route.ts` — POST + GET handlers

### TV App (`monorepo/tv/`)
- `src/app/auth/qrcode/page.tsx` — QR login screen
- `src/lib/auth.ts` — TV auth logic (polling, session check)
- `src/lib/qr.ts` — QR code generation
- `src/hooks/use-tv-auth.ts` — React hook for TV auth state

### Backend (Supabase)
- SQL migration for TV sessions (optional, can use in-memory)
- Auth provider configuration (Google, email/password)

---

## 14. Testing Checklist

### QR Flow
- [ ] QR code generates with correct URL
- [ ] QR code is scannable (test with phone camera)
- [ ] Phone page loads with correct code
- [ ] Phone login form works
- [ ] Phone registration form works
- [ ] Confirmation button sends POST request
- [ ] Backend validates code
- [ ] Backend sets tv-session cookie
- [ ] TV polls and detects session
- [ ] TV auto-redirects to `/tv`
- [ ] TV is signed in after redirect
- [ ] Expired code shows error
- [ ] Invalid code shows error
- [ ] Network error shows retry button
- [ ] Countdown timer works (5:00 → 0:00)
- [ ] Multiple TVs can have independent sessions

### TV App
- [ ] D-pad navigation works on all screens
- [ ] Focus rings visible on all focusable elements
- [ ] Focus loops at row edges
- [ ] Cursor hidden on TV screens
- [ ] Full-screen player works with remote
- [ ] Channel switch works
- [ ] Stream failover works
- [ ] Auto-play works

---

## 15. Success Criteria

- [ ] QR auth flow completes end-to-end in < 30 seconds
- [ ] TV redirects to `/tv` after phone authentication
- [ ] TV maintains session for 30 days
- [ ] No errors in browser console
- [ ] All API endpoints return correct status codes
- [ ] Error messages are in Romanian
- [ ] Accessible: screen reader announces QR code purpose