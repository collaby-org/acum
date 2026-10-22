# Propunere design — filtru A→Z /canale (ACUM)

Stare: DOAR DESIGN. Fără commit, fără edit de cod. Working tree: D:\Work\Romanian TV Live.

## Problema confirmată din recon

- `browse.tsx` (l. 62, 165–179): `letter` controlează filtrul; `selectLetter` setează `letter` și face `catalogueRef.current?.scrollIntoView({behavior:"smooth", block:"start"})`. Aceasta este o singură scrollare spre grilă — dar dacă butoanele de literă erau anterior legate și de una din `channel-rail` (rafturile orizontale pe categorie) și de grila de jos, apar două scrolluri concurente.
- `channel-index.tsx` (l. 30–151): banda sticky A→Z există deja, cu `fx-glass-bar`, butoane `onChange`, `aria-controls="toate-canalele"`. Butoanele nu fac scroll — doar filtrează.
- `channel-rail.tsx` (l. 86–131, 196–230): rafturile orizontale au propriul scroll (wheel → scroll lateral). Dacă butonul de literă declanșează și scroll pe aceste rafturi, competează cu scrollul grilei.
- `header.tsx` (l. 79–86): logo-ul leagă `/canale` când `account.signedIn`; dacă suntem pe `/canale`, leagă `#top`. Confirmat — nu se modifică.

## Decizie de design: opțiunea B (curată, fără salt)

Nu o dublă scrollare, nici un salt la fiecare literă. Se păstrează banda sticky A→Z (`channel-index`) ca singur control de filtrare; grila de jos (`toate-canalele`) se actualizează fără a sări.

### Ce se schimbă (doar design / comportament, nu structură)

1. Elimină `scrollIntoView` din `selectLetter` în `browse.tsx` (l. 170–178). Filtrul rămâne; pagina nu se mișcă.
2. Păstrează banda sticky (`channel-index`) la `top-16` / `top-[72px]` cu `fx-glass-bar`; butoanele rămân `role="list"`, `aria-pressed`, navigare tastatură (`ArrowRight/Left`).
3. Grila (`catalogueRef`) primește un `key={letter ?? "toate"}` (deja existent, l. 396); animația `animate-fade-up` rămâne pentru tranzisția filtrului.
4. Rafturile de categorie (`ChannelRail`, `channel-rail.tsx`) rămân independente — scroll orizontal local, fără legătură cu litera.
5. Header: logo `/canale` la sign-in rămâne; niciun alt link modificat.

### De ce nu opțiunea A (filtru stabil, fără rail)?

Railul sticky există, e testat (`channel-index.tsx` l. 83–146), are accesibilitate completă și se potrivește cu `fx-glass-bar`. A-l elimina ar sărăci navigarea pe un catalog de 100+ canale. Problema nu era railul, ci saltul dublu.

### Tokeni și stil — reutilizare strictă (fără emoji)

- **Culoare**: `--color-signal` `#f2a71b` pentru starea activă a butoanelor de literă (`chipClass` l. 73–81, `border-signal/60 bg-signal/15 text-signal-bright`). Niciun alt accent.
- **Sticlă**: `fx-glass-bar` (`channel-index` l. 89) — blur 28px, gradient translucid, specular top `inset 0 1px 0 rgb(255 255 255 / .13)`.
- **Tipografie**: display `Space Grotesk` 700 pentru titlu (`font-display`); UI `Inter` pentru etichete (l. 125–140 din `DESIGN_SYSTEM.md`). Etichetă de secțiune: `text-[11px] uppercase tracking-[0.22em] text-signal/85`.
- **Formă**: butoane rotunjite `rounded-lg`, înălțime `h-11`, dimensiune minimă `min-w-11`; chip-uri cu count integrat (`aria-label` cu plural `plural()` din `lib/utils`).
- **Romană, fără emoji**: eticheta railului este `Ordonează: A–Z`; titlul grilei `Toate canalele`; descrierea filtrului `Numai canalele care încep cu „${activeBucket.label}”`. Niciun emoji — doar `lucide` (`Radio` l. 4 din `browse.tsx`) pentru iconița secțiunii.
- **Accesibilitate**: `aria-label="Index alfabetic al canalelor"`; `aria-pressed` pe fiecare buton; `aria-controls="toate-canalele"`; `tabIndex` rotativ (`focus` la poziția curentă); `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal`.

### Comportament propus (fără salt)

- Utilizator apasă `A`: `letter = "A"`; grila filtrează la canalele care încep cu A; pagina rămâne la poziția curentă (nu salt la `catalogueRef`).
- Utilizator apasă `Toate`: `letter = null`; grila revine la tot; tot fără salt.
- Navigare tastatură (`ArrowRight/Left`) rămâne pe rail, nu afectează scrollul paginii.
- Sub `prefers-reduced-motion: reduce`, animația filtrului se oprește (`motion-reduce:animate-none` deja pe grid, l. 397).

## Dovezi din fișiere (fără edit)

| Fișier | Linie / fragment | Ce arată |
|---|---|---|
| `src/components/header.tsx` | 79–86 | Logo linkează `/canale` la `signedIn`; `#top` dacă deja pe `/canale`. |
| `src/components/browse.tsx` | 62, 117–120, 165–179 | `letter` state; `selectLetter` + `scrollIntoView`; grila cu `key={letter}` și `animate-fade-up`. |
| `src/components/channel-index.tsx` | 30–151 | Banda sticky, `fx-glass-bar`, `chipClass`, `aria-controls`, navigare tastatură, `plural()`. |
| `src/components/channel-rail.tsx` | 86–131, 196–230 | Raft orizontal cu scroll local (wheel → scrollLeft); independent de filtrul alfabetic. |
| `design-system/DESIGN_SYSTEM.md` | 77–118, 125–140, 233–244 | Tokeni `signal`, `fx-glass-bar`, `ease-spring`, tipografie, reguli pentru română și accesibilitate. |

## Concluzie și următorul pas

Propunem păstrarea railului sticky A→Z (`channel-index`) și eliminarea saltului `scrollIntoView` din `selectLetter` în `browse.tsx`. Asta rezolvă competiția dintre scrollul de categorie și scrollul grilei, fără a elimina controlul de filtrare. Designul rămâne serios, românesc, reperat pe tokenii ACUM (`signal` aur, sticlă, Space Grotesk), fără emoji, fără commit.

Recomandare: implementare de către sesiunea principală pe working tree-ul comun (`D:\Work\Romanian TV Live`), cu verificare `before-and-after` pe `browse.tsx` și `channel-index.tsx`.
