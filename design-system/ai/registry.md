# Component registry

What exists today, and where it lives. A component that is not in this file
does not exist — add it here in the same commit that adds it.

## Primitives (`src/components/ui/`)

| Component | File | Variants | Used by |
| --------- | ---- | -------- | ------- |
| `Button` | `ui/button.tsx` | primary, secondary, ghost, outline, live · sm, md, lg, icon, icon-sm | hero, player modal, browse, header |
| `Badge` | `ui/badge.tsx` | default, live, signal, solid, outline · xs, sm, md | hero, player modal, footer |
| `Dialog` | `ui/dialog.tsx` | Radix primitives · `hideClose` variant | player modal |

Primitives follow the shadcn contract: `cn()` from `@/lib/utils`, `cva`
variant recipes, a `data-slot` attribute on the root element, and `asChild`
support on `Button`.

## Product components (`src/components/`)

| Component | File | Server/Client | Purpose |
| --------- | ---- | ------------- | ------- |
| `Browse` | `browse.tsx` | client | The app island: search, favourites, view switching |
| `Header` | `header.tsx` | client | Glass nav bar, wordmark, search field, favourites toggle |
| `Hero` | `hero.tsx` | client | Featured channel: light field, glass screen, staged entrance |
| `ChannelRail` | `channel-rail.tsx` | client | Horizontal rail with edge arrows |
| `ChannelCard` | `channel-card.tsx` | client | Poster card with logo bug and favourite toggle |
| `PlayerModal` | `player-modal.tsx` | client | Iframe player dialog |
| `Footer` | `footer.tsx` | server | Statement, navigation, wordmark watermark |

## Shell contracts

The components in `src/components/` that the shell owns are wired by
`browse.tsx`. Their public props are fixed — the integrator matches them, not
the other way round.

### `Hero`

| Prop | Type | Notes |
| ---- | ---- | ----- |
| `channel` | `Channel` (`@/data/types`) | The featured channel |
| `liveCount` | `number` | Channels currently live |
| `totalCount` | `number` | Channels in the catalogue |
| `isFavorite` | `boolean` | Whether the featured channel is saved |
| `onPlay` | `(channel: Channel) => void` | Opens the player |
| `onToggleFavorite` | `(channel: Channel) => void` | Saves or unsaves |
| `onBrowse` | `() => void` | Scrolls to the rails |

No new props were added.

### `Header`

| Prop | Type | Notes |
| ---- | ---- | ----- |
| `query` | `string` | Current search text |
| `onQueryChange` | `(value: string) => void` | |
| `favoritesCount` | `number` | Rendered in a live-count badge that pops on change |
| `favoritesActive` | `boolean` | Whether the favourites view is on |
| `onToggleFavorites` | `() => void` | |

No new props were added.

### `Footer`

Takes no props. The copyright year is cached with `"use cache"`, so the page
stays static.

## Libraries

| Library | Used for | Rule |
| ------- | --------- | ---- |
| `lucide-react` | every icon | The only icon set. No inline SVG. |
| `canvas-confetti` | celebration particles | Only on a user action. Respects reduced motion. |
| `@radix-ui/react-dialog` | player modal | Accessibility comes from Radix, not from hand-rolled key handling. |
| `@radix-ui/react-slot` | `Button asChild` | — |

## Not used

- No animation library. CSS transitions and keyframes only.
- No state library. `useState` plus `useSyncExternalStore` for favourites.
- No chart, map or form library. There is nothing to chart, map or submit.
- No analytics, no tag manager, no consent banner. There is nothing to
  collect and therefore nothing to ask about.
- No icon font, no SVG sprite, no image sprites.

## FX layer

The shell's effects are CSS utilities in `src/app/globals.css`, declared with
`@utility`, so they compose with variants and need no import. The full list
with signatures lives in `design-system/DESIGN_SYSTEM.md` under **FX
utilities**. The ones a component should reach for first:

- `fx-glass` / `fx-glass-bar` — a surface that reads as glass.
- `fx-specular` — a light band that crosses once on hover or focus.
- `fx-sweep` — the same band on a slow loop.
- `fx-grain` / `fx-scanline` / `fx-vignette` — the broadcast texture stack.
- `fx-lift` / `fx-lift-lg` / `fx-press` — the physical hover and press states.
- `fx-live-eye` — the breathing live indicator.
- `fx-divider` — a hairline that fades at both ends.
- `mask-edges` — the horizontal rail edge fade.

## Adding a component

1. Check the shadcn registry first — do not rebuild what exists.
2. Put a reusable primitive in `src/components/ui/` with the shadcn
   contract.
3. Put a product component in `src/components/`.
4. Add the row to this file in the same commit.
5. Add the token you need to `src/app/globals.css` if you introduced one,
   and note it in `design-system/DESIGN_SYSTEM.md`.
6. Reach for an existing FX utility before writing a new effect. If you do
   add one, it is an `@utility`, it is prefixed `fx-`, and it has no layout
   side effects.
