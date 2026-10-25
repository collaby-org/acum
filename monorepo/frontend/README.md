# ACUM — Frontend (monorepo/frontend)

[![CI](https://github.com/collaby-org/acum/actions/workflows/ci.yml/badge.svg)](https://github.com/collaby-org/acum/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16.4.2-000?logo=next.js)
![React](https://img.shields.io/badge/React-19.3-087ea4?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)
![Lucide Icons](https://img.shields.io/badge/Icons-Lucide-red)
![License](https://img.shields.io/badge/license-MIT-10b981)
![Channels](https://img.shields.io/badge/Channels-156%20live-red)
![Families](https://img.shields.io/badge/Families-74-red)
![Feeds](https://img.shields.io/badge/Feeds-370-red)
![Build](https://img.shields.io/badge/Build-passing-brightgreen)
![PWA](https://img.shields.io/badge/PWA-ready-blue)

---

## 1. What is ACUM Frontend

ACUM is a Romanian live TV streaming platform — no ads. Free tier: 120 minutes daily. Paid plans remove the limit.  
Deployed at: **https://acum-weld.vercel.app/**  
Includes the `/tv` route (Netflix-style TV-native experience).

---

## 1. What is this package

This is the Next.js frontend of ACUM — a Romanian live TV streaming platform, no ads, free tier: 120 minutes daily. Includes:

- **Homepage** — hero live channel + channel grid + search + favorites
- **`/canale`** — hero + categorical rails
- **`/canale/toate`** — full directory of all channels
- **`/canal/[id]`** — channel panel (live preview, info, play)
- **`/tv`** — TV-native interface (Netflix-style): D-pad, cursor hiding, full-screen player, QR login
- **`/auth/qrcode`** — TV QR login page (phone scans, authenticates, TV auto-logs in)
- **`/preturi`, `/conturi`, `/ghid`, `/azi`, `/maine`, `/trending`, …**

---

## 2. Architecture (Data Flow)

```mermaid
graph TB
    subgraph "Build Time (Node, no server at runtime)"
        direction TB
        
        A[cool-etv.net<br/>menu + channels] -->|scrape-channels.mjs<br/>74 families / 203 pages| B[data/channels.raw.json<br/>committed]
        
        C[embed hosts<br/>105 unique URLs] -->|check-embeds.mjs<br/>Referer-gated, serial| D[data/embed-health.json<br/>committed]
        
        E[player panels] -->|resolve-streams.mjs<br/>headless Edge| F[data/resolved-streams.json<br/>committed]
        
        G[taxonomy] -->|channel-taxonomy.json<br/>names, groups| G2[scripts/build-dataset.mjs]
        
        B --> G2
        D --> G2
        F --> G2
        
        G2 --> I[src/data/channels.ts<br/>203 feeds → N channels<br/>each with server list]
        
        H[public/logos/<br/>194 PNG logos]
    end
    
    subgraph "Runtime (browser)"
        direction TB
        
        J[Browser] -->|can play| K[src/app/page.tsx<br/>server]
        K -->|props| L[<Browse><br/>client island]
        
        L -->|props| M[<Hero>]
        L -->|props| N[<Rail>]
        L -->|props| O[<ChannelIndex>]
        L -->|props| P[<SearchPanel>]
        
        M --> Q[<ChannelCard>]
        N --> Q
        
        Q -->|click| R[<Player><br/>modal]
        
        R -->|GET /api/stream?t=…| S[<api/stream><br/>upstream relay]
        R -->|GET /api/player?u=…| T[<api/player><br/>upstream page]
        
        S --> U[cool-etv.net<br/>HLS manifests]
        T --> U
    end
    
    style A fill:#e1f5e1
    style B fill:#e1f5e1
    style J fill:#fff3e0
    style K fill:#fff3e0
    style L fill:#fff3e0
    style R fill:#ffe0e0
    style S fill:#ffebee
    style T fill:#ffebee
    style U fill:#ffebee
```

---

## 2. Technology Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Framework | Next.js | 16.4.2 | App Router, Turbopack |
| Interface | React | 19.3.0 | Client island + server components |
| Styling | Tailwind CSS | 4 | Design tokens, utilities |
| Types | TypeScript | 5 | Strict type safety |
| Icons | Lucide React | 1.60.0 | Lucide icons only |
| Player | hls.js | 1.7.3 | HLS streams, failover |
| Base UI | shadcn/ui | — | Primitive components |
| Fonts | Space Grotesk + Inter | — | Self-hosted, no CDN |
| Auth | Supabase | — | Auth, plans, limits |

---

## 2. Pages and Routes

| Route | Purpose |
|-------|---------|
| `/` | Hero + rails + grid (homepage) |
| `/canale` | Hero + categorical rails |
| `/canale/toate` | Full channel directory (grid) |
| `/canale/grupate` | Channels grouped by family |
| `/canal/[id]` | Channel panel (live preview, info, play) |
| `/tv` | TV-native interface (Netflix-style): D-pad, cursor hiding, full-screen player, QR login |
| `/auth/qrcode` | TV QR login page (phone scans, authenticates, TV auto-logs in) |
| `/preturi` | Subscriptions (your plan if signed in) |
| `/conturi` | Sign in / account |
| `/ghid` | Interactive TV guide |
| `/azi` | Today's program |
| `/maine` | Tomorrow's program |
| `/trending` | What's trending now |
| `/preturi` | Subscriptions |
| `/conturi` | Sign in / account |

---

## 2. Technology Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| Framework | Next.js | 16.4.2 | App Router, Turbopack |
| Interface | React | 19.3.0 | Client island + server components |
| Styling | Tailwind CSS | 4 | Design tokens, utilities |
| Types | TypeScript | 5 | Strict type safety |
| Icons | Lucide React | 1.60.0 | Lucide icons only |
| Player | hls.js | 1.7.3 | HLS streams, failover |
| Base UI | shadcn/ui | — | Primitive components |
| Fonts | Space Grotesk + Inter | — | Self-hosted, no CDN |
| Auth | Supabase | — | Auth, plans, limits |

---

## 3. How to Develop

```bash
# 1. Clone
git clone https://github.com/collaby-org/acum.git
cd acum/monorepo/frontend

# 2. Dependencies
npm install

# 3. Environment variables (optional, for Admin/desk)
cp .env.example .env

# 4. Development
npm run dev            # http://localhost:3000

# 4. Checks
npm run lint           # ESLint (flat config)
npm run typecheck      # next typegen && tsc --noEmit
npm run build          # Turbopack production build

# 5. Runtime checks
npm run verify:player    # one click → moving image, no popup, no ad host
npm run verify:fallback  # kill first server → next one takes relay
npm run verify:ui        # walk the app, capture docs/reviews/
```

---

## 4. How the Catalog is Built

The pipeline runs at build time, with no external dependencies at runtime:

```bash
npm run data:scrape    # cool-etv.net  → data/channels.raw.json
npm run data:probe     # liveness probe  → data/embed-health.json
npm run data:resolve   # headless Edge, HLS URLs → data/resolved-streams.json
npm run data:build     # merge + logos   → src/data/channels.ts
```

`scripts/channel-taxonomy.json` is the editorial layer: the source obfuscates labels (`HB0 R0` = HBO, `Ant 1` = Antena 1, `L00K Tv` = LOOK TV), so each family and feed gets a corrected Romanian display name and category.

`src/data/channels.ts` is generated — **do not edit by hand**.

---

## 4. The Referer Gate (Why the Proxy Exists)

Upstream media hosts sit behind a Cloudflare `Referer` allowlist. With the correct referer they serve a real player; with any other they answer `301 → google.com`. A browser cannot set a `Referer`, so the stream is relayed through `/api/stream`. Full measurement is in [docs/specs/player-architecture.md](docs/specs/player-architecture.md).

---

## 4. Pages and Routes

| Route | Purpose |
|-------|---------|
| `/` | Hero + rails + grid (homepage) |
| `/canale` | Hero + categorical rails |
| `/canale/toate` | Full channel directory (grid) |
| `/canale/grupate` | Channels grouped by family |
| `/canal/[id]` | Channel panel (live preview, info, play) |
| `/tv` | TV-native: directory, sticky video, QR login, D-pad |
| `/auth/qrcode` | QR login (TV scans) |
| `/auth/qrcode?mode=phone` | Mobile login/register form |
| `/ghid` | Interactive TV guide |
| `/azi` | Today's program |
| `/maine` | Tomorrow's program |
| `/trending` | What's trending now |
| `/preturi` | Subscriptions |
| `/conturi` | Sign in / account |

---

## 3. Installation (PWA — Mobile Only)

ACUM is a PWA **for mobile phones only**:

- Open in your phone browser
- Browser menu → "Install application" / "Add to home screen"
- Opens as a native app, without browser chrome
- **TV app is a separate native app** (`monorepo/tv/`) deployed separately on Vercel

---

## 5. Documentation

| Document | Contents |
|----------|----------|
| [docs/project-doc.md](docs/project-doc.md) | What the project is and how it's built |
| [docs/system_diagram.md](docs/system_diagram.md) | Architecture (diagrams) |
| [docs/tech_stack.md](docs/tech_stack.md) | Pinned versions |
| [docs/targets.md](docs/targets.md) | Scope and quality bar |
| [docs/roadmap.md](docs/roadmap.md) | What's next |
| [docs/changelog.md](docs/changelog.md) | Release history |
| [docs/specs/catalogue-model.md](docs/specs/catalogue-model.md) | Why one entry per channel |
| [docs/specs/player-architecture.md](docs/specs/player-architecture.md) | How the player works |
| [design-system/DESIGN_SYSTEM.md](design-system/DESIGN_SYSTEM.md) | Tokens, components, motion |
| [prompts/frontend/ACUM_UI_UX_MASTER.md](prompts/frontend/ACUM_UI_UX_MASTER.md) | Frontend UI/UX master spec |
| [prompts/frontend/FRONTEND_QA_PROMPT.md](prompts/frontend/FRONTEND_QA_PROMPT.md) | Frontend QA checklist |
| [prompts/tv/TV_FRONTEND_PROMPT.md](prompts/tv/TV_FRONTEND_PROMPT.md) | TV app industrial prompt |
| [prompts/tv/TV_QA_PROMPT.md](prompts/tv/TV_QA_PROMPT.md) | TV QA checklist |
| [AGENTS.md](AGENTS.md) | Contract for agents and contributors |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

---

## 6. Contributing

Every change goes through a pull request. The PR template asks for evidence and `version: before → after`.

Rules:
- **Lucide icons only** (no emoji in UI)
- **Romanian copy**, serious, no emoji
- **`.env` only via env tools**, never in git
- **PWA only** (no APK / store)
- **Desktop / mobile untouched by `/tv`**

---

## 7. Security

See the [security policy](.github/SECURITY.md).  
Report vulnerabilities privately via [GitHub's security advisory form](https://github.com/collaby-org/acum/security/advisories/new).

---

## 8. License

MIT — see [LICENSE](LICENSE).

The channels belong to their respective owners. ACUM indexes public embed addresses published by the source and links back to them.

---

> **ACUM** — Now is now. No ads. 120 minutes free daily. Paid plans unlimited.