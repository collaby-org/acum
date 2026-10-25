# ACUM — Frontend (monorepo/frontend)

[![CI](https://github.com/collaby-org/acum/actions/workflows/ci.yml/badge.svg)](https://github.com/collaby-org/acum/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16.4.2-000?logo=next.js)
![React](https://img.shields.io/badge/React-19.3-087ea4?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)
![Lucide](https://img.shields.io/badge/Icons-Lucide-red)
![License](https://img.shields.io/badge/license-MIT-10b981)
![Channels](https://img.shields.io/badge/Channels-156-red)
![Families](https://img.shields.io/badge/Families-74-red)
![Feeds](https://img.shields.io/badge/Feeds-370-red)
![Build](https://img.shields.io/badge/Build-passing-brightgreen)

**ACUM — TV live românesc, fără reclame și fără cont.**  
Frontend-ul web al platformei ACUM, deschis la `https://acum-weld.vercel.app/`.  
Încludesc și pagina TV-native `/tv` (design inspirat de Netflix pentru televiizoare smart).

---

## 1. Ce este acest pachet

Acesta este frontend-ul Next.js al ACUM — un directory de televiziune live românească, fără reclame și fără cont necesar pentru vizionare. Include:

- **Homepage** — hero canal live + grilă de canale + căutare + favorite
- **`/canale`** — hero + rails categorice
- **`/canale/toate`** — director complet al tuturor canalelor
- **`/canal/[id]`** — panoul propriu-zis al fiecărui canal (preview live, info, play)
- **`/tv`** — interfață TV-native (Netflix-style): D-pad, cursor ascuns, ecran plin, QR login
- **`/auth/qrcode`** — ecran de autentificare TV prin cod QR (telefon scanează, confirmează, TV se loghează)
- **`/preturi`, `/conturi`, `/ghid`, `/azi`, `/maine`, `/trending`, …**

---

## 2. Fluxul QR (TV ←→ Telefoane ←→ TV)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TV APP  →  mongolez  →  FRONTEND                       │
└─────────────────────────────────────────────────────────────────────────────┘

   PASUL 1: TV arată codul QR
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                 │
   │              Autentificare pe TV                                │
   │                                                                 │
   │   Scanează codul QR cu telefonul pentru a te                    │
   │   autentifica pe acest dispozitiv.                              │
   │                                                                 │
   │           ┌─────────────────┐                                   │
   │           │   [ QR CODE ]   │                                   │
   │           └─────────────────┘                                   │
   │                                                                 │
   │   Sesiune expiră în 5:00                                        │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Scanează cu telefonul
                                     ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                      TELEFON (browser)                          │
   │                                                                 │
   │   https://acum-weld.vercel.app/tv-link?code=ACUM-XXXXXX         │
   │                                                                 │
   │   Autentificare pe TV                                           │
   │   Confirmă că dorești să te autentific pe acest TV.             │
   │                                                                 │
   │   [Autentificare]   [Crează cont]                               │
   │                                                                 │
   │   ✅ Conectat! TV-ul se va autentifica automat.                │
   └─────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Backend setează tv-session cookie
                                     ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                      TV (polling /api/auth/confirm-tv)          │
   │                                                                 │
   │   Se conectează automat → redirect către /tv                    │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
```

### Rutele de autentificare TV

| Rută | Ce face |
|------|---------|
| `/auth/qrcode` | Ecran QR pe TV (code + polling) |
| `/auth/qrcode?mode=phone` | Formular de login / înregistrare pe telefon |
| `/api/auth/confirm-tv` (POST) | Telefonul confirmă sesiunea TV |
| `/api/auth/confirm-tv` (GET) | TV-ul poll-ează și detectează sesiunea |

**Cookie:** `tv-session` (HttpOnly, Secure, SameSite=lax, 30 de zile)

---

## 3. Tehnologie

| Stratură | Tehnologie | Versiune |
|----------|-----------|----------|
| Framework | Next.js | 16.4.2 |
| Interfață | React | 19.3.0 |
| Stil | Tailwind CSS | 4 |
| Tipare | TypeScript | 5 |
| Pictograme | Lucide React | 1.60.0 |
| Player | hls.js | 1.7.3 |
| Fonturi | Space Grotesk + Inter | — |

---

## 4. Rute

| Rută | Ce face |
|------|---------|
| `/` | Hero + rails + grid (pagina principală) |
| `/canale` | Hero + rails categorice |
| `/canale/toate` | Director complet (grilă) |
| `/canale/grupate` | Canale grupate după familie |
| `/canal/[id]` | Panoul canalului (preview live) |
| `/tv` | TV-native: directory, sticky video, QR login, D-pad |
| `/auth/qrcode` | QR login (TV) |
| `/ghid` | Ghidul TV interactiv |
| `/azi` | Programul de astăzi |
| `/maine` | Programul de mâine |
| `/trending` | Ce este popular acum |
| `/preturi` | Abonamente |
| `/conturi` | Autentificare / cont |

---

## 5. Dezvoltare

```bash
# Clone
git clone https://github.com/collaby-org/acum.git
cd acum/monorepo/frontend

# Dependențe
npm install

# Variabile de mediu (opțional, pentru Admin / desk)
cp .env.example .env

# Dezvoltare
npm run dev          # http://localhost:3000

# Verificări
npm run lint         # ESLint (flat config)
npm run typecheck    # next typegen && tsc --noEmit
npm run build        # Turbopack production build

# Verificări runtime
npm run verify:player    # un clic → imagine în mișcare, fără popup, fără gazdă de reclamă
npm run verify:fallback  # omrești primul server → următorul ia relay-ul
npm run verify:ui        # walk the app, capture docs/reviews/
```

---

## 6. Pipeline-ul datelor

```
scripts/           →  build-time pipeline (Node, fără dep. externe)
data/              →  committed snapshots (channels.raw.json, embed-health.json, ...)
src/app/           →  route-uri, layout, API handlers, design tokens
src/components/    →  UI (client island + server components)
src/components/ui/ →  shadcn-style primitives
src/data/          →  catalogul generat (canale.ts)
src/lib/           →  status metadata, paletă, navigare, stream
src/hooks/         →  favorite, recentmente văzute, player state machine
public/logos/      →  194 logo-uri canal
public/fonts/      →  Space Grotesk + Inter (self-hostate)
public/icons/      →  PWA icons
design-system/     →  tokeni, componente, mișcare
docs/              →  living docs
docs/specs/        →  decizii de arhitectură
```

---

## 7. Documentație

- [docs/project-doc.md](docs/project-doc.md) — ce este proiectul și cum e construit
- [docs/system_diagram.md](docs/system_diagram.md) — diagrama de arhitectură
- [docs/tech_stack.md](docs/tech_stack.md) — pinerile versiunilor
- [docs/targets.md](docs/targets.md) — scop și bară de calitate
- [docs/roadmap.md](docs/roadmap.md) — ce urmează
- [docs/changelog.md](docs/changelog.md) — istoricul lansărilor
- [docs/specs/catalogue-model.md](docs/specs/catalogue-model.md) — de ce o singură intrare pe canal
- [docs/specs/player-architecture.md](docs/specs/player-architecture.md) — cum funcționează playerul
- [design-system/DESIGN_SYSTEM.md](design-system/DESIGN_SYSTEM.md) — tokeni, componente, mișcare
- [docs/tv/NETFLIX_TV_APP_FLOW.md](docs/tv/NETFLIX_TV_APP_FLOW.md) — fluxul TV (Netflix-style)
- [docs/tv/QR_AUTH_FLOW.md](docs/tv/QR_AUTH_FLOW.md) — fluxul de autentificare QR A-to-Z
- [prompts/frontend/ACUM_UI_UX_MASTER.md](prompts/frontend/ACUM_UI_UX_MASTER.md) — master spec UI/UX
- [prompts/frontend/ACUM_UI_UX_PROMPTS.md](prompts/frontend/ACUM_UI_UX_PROMPTS.md) — 7 prompt-uri de implementare
- [prompts/frontend/FRONTEND_QA_PROMPT.md](prompts/frontend/FRONTEND_QA_PROMPT.md) — checklist QA / bug-uri
- [prompts/tv/TV_FRONTEND_PROMPT.md](prompts/tv/TV_FRONTEND_PROMPT.md) — prompt industrial pentru TV app
- [prompts/tv/TV_QA_PROMPT.md](prompts/tv/TV_QA_PROMPT.md) — checklist QA pentru TV
- [AGENTS.md](AGENTS.md) — contractul pentru agenți și contribuitori
- [CONTRIBUTING.md](CONTRIBUTING.md) — cum contributi

---

## 8. Reguli de UI / design

- **Lucide doar** pentru pictograme — niciun emoji în interfață
- **Copie română**, serioasă, fără emoji
- Apple / Netflix-clean: dark, spațiu, tipografie, contrast
- `.env` numai prin unelte de env, niciodată în git
- PWA numai (fără APK / magazin de aplicații)
- Desktop / mobil nedevățați de `/tv`

---

## 9. Securitate

Vezi [politica de securitate](.github/SECURITY.md).  
Rapportezi vulnerabilități privat prin [formularul GitHub](https://github.com/collaby-org/acum/security/advisories/new).

---

## 10. Licență

MIT — vezi [LICENSE](LICENSE).

Canalele aparțin respectivei deținătoare. ACUM indexează adresele publice de embed publicate de sursă și reîntoarce linkuri spre ea.

---

> **ACUM** — TV live românesc, fără reclame, fără cont. Doar TV.
