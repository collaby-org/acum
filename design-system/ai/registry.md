# Component registry

What exists today, and where it lives. A component that is not in this file
does not exist — add it here in the same commit that adds it.

## Primitives (`src/components/ui/`)

| Component | File | Variants | Used by |
| --------- | ---- | -------- | ------- |
| `Button` | `ui/button.tsx` | primary, secondary, ghost, outline, live · sm, md, lg, icon, icon-sm | hero, player modal, browse, footer |
| `Badge` | `ui/badge.tsx` | default, live, signal, solid, outline · xs, sm, md | hero, player modal, footer |
| `Dialog` | `ui/dialog.tsx` | Radix primitives · `hideClose` variant | player modal |

Primitives follow the shadcn contract: `cn()` from `@/lib/utils`, `cva`
variant recipes, a `data-slot` attribute on the root element, and `asChild`
support on `Button`.

## Product components (`src/components/`)

| Component | File | Server/Client | Purpose |
| --------- | ---- | ------------- | ------- |
| `Browse` | `browse.tsx` | client | The app island: search, favourites, view switching |
| `Header` | `header.tsx` | client | Sticky nav, wordmark, search field, favourites toggle |
| `Hero` | `hero.tsx` | client | Featured channel block |
| `ChannelRail` | `channel-rail.tsx` | client | Horizontal rail with edge arrows |
| `ChannelCard` | `channel-card.tsx` | client | Poster card with logo bug and favourite toggle |
| `PlayerModal` | `player-modal.tsx` | client | Iframe player dialog |
| `Footer` | `footer.tsx` | server | Site footer |

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

## Adding a component

1. Check the shadcn registry first — do not rebuild what exists.
2. Put a reusable primitive in `src/components/ui/` with the shadcn
   contract.
3. Put a product component in `src/components/`.
4. Add the row to this file in the same commit.
5. Add the token you need to `src/app/globals.css` if you introduced one,
   and note it in `design-system/DESIGN_SYSTEM.md`.
