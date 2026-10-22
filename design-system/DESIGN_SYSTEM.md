# ACUM design system

The implemented system, as it exists in the code. Tokens live in
`src/app/globals.css` under `@theme`; this document explains them and the
rules the UI follows.

## Direction

A dark interface that behaves like a set of physical objects lit in a dark
room — Apple TV's "Now Playing", not a landing page.

Three rules carry the whole system:

1. **Depth comes from light, not from borders.** Surfaces are near-black and
   cool. Separation is made by translucency, a specular top edge and a
   coloured bloom. A 1px grey frame around every box is the thing to avoid.
2. **Motion is physical.** Springs, not linear easing. Things lift, settle and
   overshoot by a hair. Nothing bounces cartoonously; nothing is instant.
3. **Colour belongs to the channel.** The one warm accent is the brand; every
   other colour in a scene is derived from the channel's own family hue.

## Identity

**ACUM** is Romanian for *now*, and *now* is the whole premise: what is on
now, what is trending now, how many people are watching now. The name has no
diacritics, so the identity survives the strip that English keyboards apply.

### The mark

A capital **A** — the first letter of the name — with a bright **rail** running
out of it to the right. The rail is the playhead: the position of *now* on the
programme guide. The A stays intact; the rail passes behind it and emerges.

| Property | Value |
| -------- | ----- |
| Shape | `M12 88 L50 14 L88 88 L70 88 L50 49 L30 88 Z` — a 16-unit chevron on a 100 grid |
| Rail | `x 59, y 54, 33 × 12, r 6`, drawn *behind* the A so the letter is never cut |
| Gold | `#FFE7B0 → #F7B733 → #DE9206 → #9C6600` down the A, `#D98F04 → #FFF3D4` along the rail |
| Component | `AcumMark` in `src/components/brand/acum-mark.tsx` |
| Source of truth | `scripts/build-icons.mjs` — the mark is drawn once, everything else composes it |

The mark is the one hand-drawn shape in the product. It is a brand mark, not
an icon, so it does not come from lucide — every other icon does.

### The wordmark

The Romanian word, set in the display face (Space Grotesk 700), tracked
`0.16em`, in `--color-ink`. It is type, not a picture: it is never redrawn,
never outlined and never given a gradient.

The mark and the wordmark are the same letter. The mark is the A, drawn; the
wordmark is the A, set.

### Where it appears

| Surface | Treatment |
| ------- | --------- |
| Header | The mark in a 36px dark glass tile, the wordmark beside it |
| Footer | The same tile and wordmark, then a giant watermark the page ends on |
| App icon | The mark alone on a near-black rounded tile, 60% of the canvas |
| Maskable icon | The same, at 46%, inside the 80% safe zone, full bleed |
| Apple touch icon | The same, at 56%, square — iOS applies its own mask |
| Favicon | A flatter variant, the mark at 76%, no bloom — it is read at 16 pixels |
| Open Graph card | `public/brand/og.png`, 1200 × 630 |

The old identity — a gold rounded square with a television glyph — is gone.
Nothing in the product uses it.

### The rules

1. The wordmark is set in the display face, never drawn.
2. The mark is never redrawn by hand; `scripts/build-icons.mjs` is the source.
3. The mark is always gold, on a dark field. Never the other way round.
4. The name is written **ACUM**, in caps, in every surface that shows it.
5. One accent colour. Gold is the brand. Red means "live" and nothing else.

## Colour

### Surfaces

| Token | Value | Use |
| ----- | ----- | ---- |
| `--color-canvas` | `#04050a` | Page background |
| `--color-canvas-raised` | `#080a12` | Footer, modal surfaces |
| `--color-surface` | `#0d0f16` | Card fallback |
| `--color-surface-2` | `#14161e` | Raised controls |
| `--color-surface-3` | `#1d202a` | Scrollbar thumb on hover |

Each step up adds a touch more blue. Nothing in the stack is neutral grey.

### Ink

| Token | Value | Use |
| ----- | ----- | ---- |
| `--color-ink` | `#f4f6fb` | Primary text |
| `--color-ink-muted` | `#949cb2` | Secondary text, captions |
| `--color-ink-faint` | `#5f687d` | Tertiary text, disabled icons |

### Light, not borders

| Token | Value | Use |
| ----- | ----- | ---- |
| `--color-hairline` | `rgb(255 255 255 / 0.07)` | Default 1px rule |
| `--color-hairline-strong` | `rgb(255 255 255 / 0.14)` | Hover rule, input border |
| `--color-edge-specular` | `rgb(255 255 255 / 0.18)` | Lit top edge of a glass slab |
| `--color-veil` | `rgb(255 255 255 / 0.05)` | Translucent fill of a glass slab |

### Accent and status

| Token | Value | Use |
| ----- | ----- | ---- |
| `--color-signal` | `#f2a71b` | Brand gold — primary button, focus ring, eyebrow labels |
| `--color-signal-bright` | `#ffc95e` | Hover state of the primary button |
| `--color-signal-deep` | `#a56d00` | Gradient end of the wordmark chip |
| `--color-signal-ink` | `#1a1000` | Text on gold |
| `--color-live` | `#ff3b47` | Live dot, live lens |
| `--color-live-soft` | `#ff8b93` | Live label text |

Gold is the brand. Red means "live" and nothing else.

> Tailwind v4 tree-shakes theme variables: a token reaches the final CSS only
> when it is referenced by a utility or by a `var()` in `globals.css`. Adding a
> token to `@theme` is enough — using it is what publishes it.

## Typography

| Role | Face | Weights |
| ---- | ---- | ------- |
| Display | Space Grotesk | 500, 600, 700 |
| UI | Inter | 400–700 (variable) |

Both are self-hosted in `public/fonts/` with `latin` and `latin-ext` subsets,
so Romanian diacritics (`ș ț ă î`) render without a CDN request.

- Display face for channel names, headings and the wordmark.
- Display type is tight: `tracking-[-0.035em]` at hero size.
- The hero headline is a two-stop gradient (`from-white to-white/[0.78]`,
  `bg-clip-text`), never flat white.
- Eyebrow labels are 11px, uppercase, `tracking-[0.22em]`, in `--color-signal/85`.
- Body copy is 15–16px with relaxed leading.

### Type scale in use

| Element | Size | Tracking |
| ------- | ---- | -------- |
| Hero headline | `clamp(2.5rem, 6.6vw, 5rem)` | `-0.035em` |
| Screen title | `clamp(1.5rem, 3.2vw, 2.35rem)` | `-0.025em` |
| Footer statement | `clamp(1.5rem, 2.6vw, 2.1rem)` | `-0.02em` |
| Section heading | `20px → 26px` | `-0.01em` |
| Body | `15px → 16px` | normal |
| Eyebrow / chip label | `10px – 11px` uppercase | `0.14em – 0.24em` |

## Spacing and shape

- Page gutter: 16px mobile, 32px `sm`, 48px `lg`.
- Content max width: 1800px.
- Card radius: 14px (`--radius-card`). Hero screen: 24px mobile, 28px `sm`.
  Buttons: fully round. Dialogs: 16px.
- Card width: 248px mobile, 272px `sm`.

## Elevation

Four steps. Each is deeper, softer and less opaque than the last.

| Token | Value | Use |
| ----- | ----- | ---- |
| `--shadow-e1` | `0 1px 2px rgb(0 0 0 / .55), 0 4px 12px -4px rgb(0 0 0 / .45)` | Resting chip |
| `--shadow-e2` | `0 12px 30px -12px rgb(0 0 0 / .72), 0 2px 8px -2px rgb(0 0 0 / .5)` | Glass slab, floating control |
| `--shadow-e3` | `0 24px 56px -16px rgb(0 0 0 / .82), 0 8px 20px -8px rgb(0 0 0 / .55)` | Raised card, panel |
| `--shadow-e4` | `0 48px 104px -30px rgb(0 0 0 / .92), 0 18px 44px -18px rgb(0 0 0 / .6)` | Hero screen, modal |
| `--shadow-glow` | `0 18px 50px -16px rgb(242 167 27 / .6)` | Gold glow on the primary action |
| `--shadow-glow-live` | `0 10px 30px -12px rgb(255 59 71 / .65)` | Live indicator |

## The glass recipe

A glass surface is never a flat translucent box. It is four stacked layers:

1. a translucent white gradient fill (8% → 2.5%),
2. `backdrop-filter: blur(24px) saturate(160%)`,
3. an inset **specular top edge** (`inset 0 1px 0 rgb(255 255 255 / .13)`) and an
   inset bottom shade, so the slab has a lit edge and a shadowed underside,
4. an outer shadow from the elevation ladder.

`fx-glass` applies all four. `fx-glass-bar` is the navigation variant (darker
fill, 28px blur). `fx-edge` is the hairline ring with a lit top edge, for
surfaces that already have their own background.

## Procedural colour

`src/lib/channel-meta.ts` derives a palette from the channel's family, so
siblings stay related and families stay distinct:

- Each category has a base hue (Generaliste 26°, Știri 212°, Sport 142°,
  Filme 276°, Copii 192°, Documentare 164°, Muzică 322°).
- A family hash shifts the hue by ±13°, so no two families collide.
- `posterPalette()` returns `hue`, `from`, `via`, `to`, `glow`. The hero builds
  its own gradients from the raw `hue` so the screen can carry a second and
  third hue (a complement in the bottom-right corner).

**Light is screen-blended.** Ambient colour layers use `mix-blend-screen`, not
normal alpha. A bright hue at 50% alpha over a dark navy reads as mud; the
same hue screen-blended stays luminous.

## FX utilities

Defined with `@utility` in `src/app/globals.css`, so they compose with
variants (`hover:fx-lift`) and need no import.

| Class | What it does |
| ----- | ------------ |
| `fx-glass` | Translucent fill + 24px backdrop blur + saturate + inset specular edge + `--shadow-e2` |
| `fx-glass-bar` | Darker translucent fill + 28px backdrop blur, for nav bars over live content |
| `fx-edge` | `inset 0 1px 0` lit top edge + `inset 0 0 0 1px` hairline ring |
| `fx-sheen` | `::before` gradient falling from the top edge onto a surface |
| `fx-specular` | A specular band that crosses the element once on `:hover` / `:focus-visible` (1s, expo-out). Clips with `overflow: hidden` |
| `fx-sweep` | The same band on a 7.5s loop, for hero glass. Painted at `z-index: 1`; put content at `z-[2]` |
| `fx-grain` | Fractal-noise film grain tile (180px). Pair with an opacity and a blend mode |
| `fx-scanline` | Broadcast scanlines, 4px period. Almost subliminal on its own |
| `fx-vignette` | Radial vignette that closes the frame |
| `fx-bloom` | Coloured radial bloom. Set `--fx-bloom-color` on the element |
| `fx-lift` | Hover lift: `-6px` translate + `1.015` scale on a 420ms spring; `-2px` pressed |
| `fx-lift-lg` | The same, `-10px` / `1.025` on a 520ms spring — for hero-scale surfaces |
| `fx-press` | `scale(0.965)` on `:active` |
| `fx-live-eye` | `::after` halo behind a live dot, breathing on `breathe` |
| `fx-halo` | The same halo, static opacity, for a dot that already pulses |
| `fx-text-glow` | `text-shadow` bloom. Set `--fx-glow-color` on the element |
| `fx-divider` | A 1px rule that fades out at both ends |
| `fx-hide-scrollbar` | Scrollable, no scrollbar |
| `mask-edges` | Horizontal rail edge fade (kept from the previous system) |
| `no-mask` | Cancels `mask-edges` |
| `grain` | Legacy dot-grid grain, kept for surfaces that predate `fx-grain` |

## Motion

| Rule | Value |
| ---- | ----- |
| Hover lift | 420ms, `cubic-bezier(0.22, 1.14, 0.36, 1)` — spring, slight overshoot |
| Press | `scale(0.965)`, spring curve |
| Hero entrance | `rise` — 900ms expo-out, 26px travel, 6px blur, staggered 40 → 420ms |
| Small entrance | `fade-up` — 550ms expo-out, 16px travel |
| Pop | `scale-in` — 240ms spring |
| Specular sweep | 7.5s loop, expo-in-out, visible 10%–66% of the cycle |
| Live dot | 1.9s pulse ring |
| Live lens | 4.4s breathe (`scale` 0.86 → 1.18) |
| Ambient drift | 24s alternate, 3% translate + 9% scale |

### Easing tokens

| Token | Curve | Use |
| ----- | ----- | ---- |
| `--ease-spring` | `cubic-bezier(0.22, 1.14, 0.36, 1)` | Anything the finger touches |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances |
| `--ease-swift` | `cubic-bezier(0.4, 0, 0.2, 1)` | Continuous loops |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Sweeps, drifts |

**Motion is invisible or meaningful.** Nothing moves to decorate. The
celebration burst is the one loud moment, and it fires on a real user action
— adding a channel to favourites — not on page load.

Every animation is disabled under `prefers-reduced-motion: reduce`.

## Components

| Component | File | Notes |
| --------- | ---- | ----- |
| Button | `src/components/ui/button.tsx` | `cva` variants: primary, secondary, ghost, outline, live. Supports `asChild`. |
| AcumMark | `src/components/brand/acum-mark.tsx` | The brand mark. The only hand-drawn shape in the product. |
| Badge | `src/components/ui/badge.tsx` | Variants: default, live, signal, solid, outline. |
| Dialog | `src/components/ui/dialog.tsx` | Radix-backed. Focus trap, escape, scroll lock. |
| Header | `src/components/header.tsx` | Glass bar that solidifies on scroll, wordmark, growing search field, favourites with a live count. |
| Hero | `src/components/hero.tsx` | Featured channel: staged entrance, light field, glass screen with a live lens and a wall clock. |
| Footer | `src/components/footer.tsx` | Statement, two link columns, a fading divider and a giant wordmark watermark. |
| Card | `src/components/channel-card.tsx` | Poster, logo bug, status chip, favourite toggle. |
| Rail | `src/components/channel-rail.tsx` | Horizontal scroller with edge arrows that hide at the ends. |
| Player | `src/components/player-modal.tsx` | Iframe stage, status notice, copy-link and source actions. |

### The hero screen

The signature surface. A 16:9 panel of glass:

- a four-stop gradient built from the channel's family hue plus a complement,
- a raking key light from the top-left corner,
- scanlines, film grain and a vignette, in that order,
- a glass boundary: `inset 0 1px 0 rgb(255 255 255 / .3)` plus a hairline ring,
- the real channel logo on a dark ident tile, the name in the display face,
- a breathing live lens at the top-left and a wall clock at the top-right,
- the `fx-sweep` band crossing on a 7.5s loop,
- a coloured pool of light under the panel, so it sits on the page.

## Accessibility

- Every interactive element has an accessible name.
- Focus is visible: a 2px `--color-signal` ring with a 3px offset.
- The card is a real `<button>`; the favourite toggle is a separate button
  with `aria-pressed`.
- The player modal is a Radix dialog: focus is trapped and restored, escape
  closes it.
- Status is never colour alone — every badge carries a text label.
- The live dot animation is decorative and marked `aria-hidden`.
- The wall clock renders `--:--` on the server and fills in after mount, so
  the server and client markup always agree.

## Icons

`lucide-react` only. Icons sit at 16px in controls and 24px+ in feature
slots, with a stroke width that matches the type weight.

The one exception is the brand mark, `AcumMark`, which is a hand-drawn shape
and not an icon. It is the product's name reduced to one gesture; it is drawn
once, in `src/components/brand/acum-mark.tsx`, and reused everywhere.

## Rules of thumb

1. Add a token before you add a hex value.
2. Use the real channel logo; do not invent artwork.
3. One accent colour. Gold is the brand. Red means "live" and nothing else.
4. Light before borders. If a surface needs to separate, add a specular edge
   and a bloom, not an outline.
5. Screen-blend the ambient colour; normal alpha turns it to mud.
6. Romanian copy, correct diacritics, plain sentences.
7. If a motion does not explain something, delete it.
