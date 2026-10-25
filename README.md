# ACUM — TV Live Română, Fără Reclame, Fără Cont

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

**ACUM — Televiziune live românească, fără reclame și fără cont.**  
O direcție de canale TV live în stilul Netflix, construită din adresele publice de embed ale canalelor românești.

---

## 2. Ce este ACUM

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        📺 ACUM — TV LIVE ROMÂNESC                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │   🎬 HERO    │  │   📡 LIVE    │  │   🔍 CAUTĂ   │  │   ❤️ FAVORIT   │   │
│   │   (Acum la   │  │   CANALE     │  │   (canale,   │  │   (favorite    │   │
│   │    TV)       │  │   (sticky)   │  │   categorii) │  │   recente)     │   │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
    │                    PLAYER: 0 reclame, 0 popupuri, 0 tracking      │
    │   HLS stream → proxy propriu → video direct, fără ad-uri          │
    └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   🇷🇴 Română  •  📱 Responsive  •  📺 PWA (instalabil)                    │
│   ⚡ Sub-șoaptă  •  🔒 Fără cont  •  🚫 Zero reclame                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Caracteristici cheie

- **Un click și vezi.** Apasă pe un canal — imaginea pornește. Fără poster, fără "click to start", fără tour de două ecrane.
- **Player propriu.** Nu e chrome-ul sursei. Scrubber live-edge-locked, volum, Picture-in-Picture, fullscreen, indicator de "LIVE" care respira.
- **Zero reclame.** Sursele sursă apelează `aclib.runPop()`, care arunge reclame în ferestre noi. ACUM servește pagina sursă cu toate scripturile de reclamă și următoare eliminate, sub un `sandbox` CSP, și stream-lează media prin proxy propriu. În logurile de rețea: zero gazde de reclamă, zero popupuri.
- **Un singur intrare pe canal.** Sursa listează același difuzor pe mai multe servere ("Antena 1 S1", "Antena 1 S2 HD", "Antena 1 S3"). ACUM le împarte într-un singur canal cu o listă de servere, și când un feed moare, trece automat la următorul.
- **Găsești orice, repede.** Cautare clasificată, insensibilă la diacritice, și bară A→Z.
- **Niciun cont.** Favoritele și ultimele văzute rămân în `localStorage`.
- **Instalabil.** PWA cu shell offline, icoane reale și chrome de siguranță pentru ecranuri — se comporță ca o aplicație pe telefon și TV.
- **Niciun analytics, niciun tracker, niciun script de reclamă propriu.** Interfața spune "0 reclame" pentru că este adevărat.

---

## 3. Arhitectura (fluxuri de date)

```mermaid
graph TB
    subgraph "Build Time (Node, fără server la runtime)"
        direction TB
        
        A[cool-etv.net<br/>meniu + canale] -->|scrape-channels.mjs<br/>74 familii / 203 pagini| B[data/channels.raw.json<br/>comisă]
        
        C[gazde embed<br/>105 URL-uri unice] -->|check-embeds.mjs<br/>Referer-gated, seriat| D[data/embed-health.json<br/>comisă]
        
        E[panouri player] -->|resolve-streams.mjs<br/>headless Edge| F[data/resolved-streams.json<br/>comisă]
        
        G[taxonomia] -->|channel-taxonomy.json<br/>nume, grupe| G2[scripts/build-dataset.mjs]
        
        B --> G2
        D --> G2
        F --> G2
        
        G2 --> H[src/data/channels.ts<br/>203 feeduri → N canale]
        
        H --> I[public/logos/<br/>194 logo-uri PNG]
    end
    
    subgraph "Runtime (browser)"
        direction TB
        
        J[Browser] -->|poate| K[src/app/page.tsx<br/>server]
        K -->|props| L[<Browse><br/>client island]
        
        L -->|props| M[<Hero>]
        L -->|props| N[<Rail>]
        L -->|props| O[<ChannelIndex>]
        L -->|props| P[<SearchPanel>]
        
        M --> Q[<ChannelCard>]
        N --> Q
        
        Q -->|click| R[<Player><br/>modal]
        
        R -->|GET /api/stream?t=…| S[<api/stream><br/>relay upstream]
        R -->|GET /api/player?u=…| T[<api/player><br/>pagina upstream]
        
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

## 4. Tehnologie (stivă reală)

| Stratură | Tehnologie | Versiune | Rol |
|----------|-----------|----------|-----|
| Framework | Next.js | 16.4.2 | App Router, Turbopack |
| Interfață | React | 19.3.0 | Client island + server components |
| Stil | Tailwind CSS | 4 | Tokene de design, utilitare |
| Tipare | TypeScript | 5 | Siguranță de tip strict |
| Pictograme | Lucide React | 1.60.0 | Doar pictograme Lucide |
| Player | hls.js | 1.7.3 | Fluxuri HLS, failover |
| Stil bază | shadcn/ui | — | Componente primitive |
| Fonturi | Space Grotesk + Inter | — | Self-hostate, fără CDN |

---

## 5. Cum rulezi

```bash
# 1. Clone
git clone https://github.com/collaby-org/acum.git
cd acum

# 2. Dependențe
npm install

# 3. Variabile de mediu (doar dacă vrei Admin / desk)
cp .env.example .env   # completă: SUPABASE_URL, SUPABASE_ANON_KEY, etc.

# 4. Dezvoltare
npm run dev            # http://localhost:3000

# 5. Verificări
npm run lint           # ESLint (flat config)
npm run typecheck      # next typegen && tsc --noEmit
npm run build          # Turbopack production build

# 6. Verificări runtime
npm run verify:player    # un clic → imagine în mișcare, fără popup, fără gazdă de reclamă
npm run verify:fallback  # omrești primul server → următorul ia relay-ul
npm run verify:ui        # walk the app, capture docs/reviews/
```

---

## 6. Cum e construit catalogul (pipeline)

Pipeline-ul Rulează în build time, fără dependențe externe la runtime:

```bash
npm run data:scrape    # cool-etv.net  → data/channels.raw.json
npm run data:probe     # probă de viață  → data/embed-health.json
npm run data:resolve   # Edge headless, URL-uri HLS → data/resolved-streams.json
npm run data:build     # merge + logo-uri   → src/data/channels.ts
```

`scripts/channel-taxonomy.json` este stratul editorial: sursa obfuscă etichetele (`HB0 R0` = HBO, `Ant 1` = Antena 1, `L00K Tv` = LOOK TV), astfel fiecare familie și feed primește un nume românesc corect și o categorie.

`src/data/channels.ts` este generat — **nu editați cu mâna**.

---

## 7. Portaria Referer (de ce există proxy-ul)

Gazdele media upstream se află în spatele unei liste `Referer` pe Cloudflare. Cu refererul corect servesc un player real; cu orice altul răspund `301 → google.com`. Un browser nu poate seta un `Referer`, deci fluxul este relayat prin `/api/stream`. Măsura completă este în [docs/specs/player-architecture.md](docs/specs/player-architecture.md).

---

## 8. Paginile și rutele

| Rută | Ce face |
|------|---------|
| `/` | Hero + rails + grid (pagina principală) |
| `/canale/[categorie]` | Canal după categorie |
| `/canale/toate` | Toate canalele (director complet) |
| `/canal/[id]` | Pagina propriu-zisă a canalului (panou, live) |
| `/ghid` | Ghidul TV interactiv |
| `/azi` | Programul de astăzi |
| `/maine` | Programul de mâine |
| `/trending` | Ce este popular acum |
| `/preturi` | Abonamente (planul tău dacă ești autentificat) |
| `/conturi` | Autentificare / cont |
| `/admin` | Panoul admin (desk) |

---

## 9. Instalare (PWA)

ACUM este o PWA:

- Deschide în browser pe telefon sau TV
- Meniu browser → "Instalează aplicația" / "Adaugă la ecranul principal"
- Se deschide ca o aplicație nativă, fără bara de browsă
- Pe TV: `/tv` se deschide ca o aplicație nativă (dacă browserul TV suportă instalare)

---

## 10. Documentație

| Document | Ce conține |
|----------|------------|
| [docs/project-doc.md](docs/project-doc.md) | Ce este proiectul și cum e construit |
| [docs/system_diagram.md](docs/system_diagram.md) | Arhitectura (diagrame) |
| [docs/tech_stack.md](docs/tech_stack.md) | Pinerile versiunilor |
| [docs/targets.md](docs/targets.md) | Scop și bară de calitate |
| [docs/roadmap.md](docs/roadmap.md) | Ce urmează |
| [docs/changelog.md](docs/changelog.md) | Istoricul lansărilor |
| [docs/specs/catalogue-model.md](docs/specs/catalogue-model.md) | De ce o singură intrare pe canal |
| [docs/specs/player-architecture.md](docs/specs/player-architecture.md) | Cum funcționează playerul |
| [design-system/DESIGN_SYSTEM.md](design-system/DESIGN_SYSTEM.md) | Tokene, componente, mișcare |
| [AGENTS.md](AGENTS.md) | Contractul pentru agenți și contribuitori |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Cum contributi |

---

## 11. Contribuire

Fiecare modificare trece printr-un pull request. Șablonul PR cere dovezi și `version: before → after`.

Reguli:
- **Lucide doar** pentru pictograme (niciun emoji în interfață)
- **Copie română**, serioasă, fără emoji
- **`.env` numai prin unelte de env**, niciodată în git
- **PWA numai** (fără APK / magazin de aplicații)
- **Desktop / mobil nedevățați de `/tv`**

---

## 12. Securitate

Vezi [politica de securitate](.github/SECURITY.md).  
Rapportezi vulnerabilități privat prin [formularul GitHub](https://github.com/collaby-org/acum/security/advisories/new).

---

## 13. Licență

MIT — vezi [LICENSE](LICENSE).

Canalele aparțin respectivei deținătoare. ACUM indexează adresele publice de embed publicate de sursă și reîntoarce linkuri spre ea.

---

> **ACUM** — acum este acum. Fără reclame. Fără cont. Doar TV.
