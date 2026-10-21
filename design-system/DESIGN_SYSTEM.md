# VIZOR design system

The implemented system, as it exists in the code. Tokens live in
`src/app/globals.css` under `@theme`; this document explains them and the
rules the UI follows.

## Direction

A dark, cinematic interface that reads like a broadcast control room rather
than a consumer app. Near-black surfaces, one warm accent, and channel
identity carried by the real channel logo instead of invented artwork.

The rule that keeps it from looking generic: **the channel's own logo is the
artwork**. Each card is a 16:9 "screen" with a broadcast bug in the corner —
the real logo at its native 40×20 — over a procedurally coloured backdrop
derived from the channel's family. No stock photography, no gradient soup.

## Colour

### Surfaces

| Token | Value | Use |
| ----- | ----- | ---- |
| `--color-canvas` | `#06070a` | Page background |
| `--color-canvas-raised` | `#0b0d13` | Modal, footer |
| `--color-surface` | `#10131b` | Card fallback |
| `--color-surface-2` | `#171b25` | Card base, raised controls |
| `--color-surface-3` | `#333a4b` | Scrollbar thumb on hover |

### Ink

| Token | Value | Use |
| ----- | ----- | ---- |
| `--color-ink` | `#f2f4f8` | Primary text |
| `--color-ink-muted` | `#949cad` | Secondary text, captions |
| `--color-ink-faint` | `#616a7b` | Tertiary text, disabled icons |

### Accent and status

| Token | Value | Use |
| ----- | ----- | ---- |
| `--color-signal` | `#f0a500` | Brand gold — primary button, focus ring, eyebrow labels |
| `--color-signal-bright` | `#ffc247` | Hover state of the primary button |
| `--color-signal-deep` | `#b87900` | Pressed state, deep accents |
| `--color-live` | `#ff3b47` | Live badge dot |

### Hairlines

`--color-hairline` is `rgba(255,255,255,0.07)`. Borders are hairlines, never
solid greys.

## Typography

| Role | Face | Weights |
| ---- | ---- | ------- |
| Display | Space Grotesk | 500, 600, 700 |
| UI | Inter | 400–700 (variable) |

Both are self-hosted in `public/fonts/` with `latin` and `latin-ext`
subsets, so Romanian diacritics (`ș ț ă î`) render without a CDN request.

- Display face for channel names, headings and the wordmark.
- Tracking is tight on large display type (`tracking-[-0.03em]`).
- Eyebrow labels are 11px, uppercase, `tracking-[0.22em]`, in
  `--color-signal/85`.
- Body copy is 15–16px with relaxed leading.

## Spacing and shape

- Page gutter: 16px mobile, 32px `sm`, 48px `lg`.
- Content max width: 1800px.
- Card radius: 14px (`--radius-card`). Modals: 16px. Buttons: fully round.
- Card width: 248px mobile, 272px `sm`.

## Procedural colour

`src/lib/channel-meta.ts` derives a poster palette from the channel's
family, so siblings stay related and families stay distinct:

- Each category has a base hue (Generaliste 26°, Știri 212°, Sport 142°,
  Filme 276°, Copii 192°, Documentare 164°, Muzică 322°).
- A family hash shifts the hue by ±13°, so no two families collide.
- The card backdrop is three layers: a radial from the top left, a glow from
  the bottom right, and a linear base.

## Components

| Component | File | Notes |
| --------- | ---- | ----- |
| Button | `src/components/ui/button.tsx` | `cva` variants: primary, secondary, ghost, outline, live. Supports `asChild`. |
| Badge | `src/components/ui/badge.tsx` | Variants: default, live, signal, solid, outline. |
| Dialog | `src/components/ui/dialog.tsx` | Radix-backed. Focus trap, escape, scroll lock. |
| Card | `src/components/channel-card.tsx` | Poster, logo bug, status chip, favourite toggle. |
| Rail | `src/components/channel-rail.tsx` | Horizontal scroller with edge arrows that hide at the ends. |
| Hero | `src/components/hero.tsx` | Featured channel, typographic, with a floating screen mock. |
| Player | `src/components/player-modal.tsx` | Iframe stage, status notice, copy-link and source actions. |

## Motion

| Rule | Value |
| ---- | ----- |
| Hover lift | 300 ms, `cubic-bezier(0.22, 1, 0.36, 1)` |
| Card hover | `-1px` translate + `1.03` scale, 300 ms |
| Entrance | 600 ms fade-up, 14px travel |
| Live dot | 1.9 s pulse ring |
| Celebration | canvas-confetti, three emitters plus a ribbon rain |

**Motion is invisible or meaningful.** Nothing moves to decorate. The
celebration burst is the one loud moment, and it fires on a real user action
— adding a channel to favourites — not on page load.

Every animation is disabled under `prefers-reduced-motion: reduce`, and the
particle system checks the same media query before it fires.

## Accessibility

- Every interactive element has an accessible name.
- Focus is visible: a 2px `--color-signal` ring with a 2px offset.
- The card is a real `<button>`; the favourite toggle is a separate button
  with `aria-pressed`.
- The player modal is a Radix dialog: focus is trapped and restored, escape
  closes it.
- Status is never colour alone — every badge carries a text label.
- The live dot animation is decorative and marked `aria-hidden`.

## Icons

`lucide-react` only. Icons sit at 16px in controls and 24px+ in feature
slots, with a stroke width that matches the type weight.

## Rules of thumb

1. Add a token before you add a hex value.
2. Use the real channel logo; do not invent artwork.
3. One accent colour. Gold is the brand. Red means "live" and nothing else.
4. Romanian copy, correct diacritics, plain sentences.
5. If a motion does not explain something, delete it.
