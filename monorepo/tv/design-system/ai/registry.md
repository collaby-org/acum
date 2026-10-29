# Component registry — the TV build

What exists in [`monorepo/tv`](../..) today, and where it lives. A component
that is not in this file does not exist — add it here in the same commit that
adds it.

The shared ACUM system (the token set, the `fx-*` utilities, the brand mark, the
glass recipe) lives in [`../../../design-system`](../../../design-system) and is
used here unchanged. This file covers the **ten-foot layer**: what the television
adds on top.

## Primitives (`src/components/tv/`)

| Component | File | Notes |
| --------- | ---- | ----- |
| `TVFocusable` | `focusable.tsx` | The one primitive. An element marked `data-tv-focus`, wearing the ring, always a real `<button>` or `<a>`. `asChild` follows the app's `Button` contract. |
| `TVSafeArea` | `safe-area.tsx` | The inset: `tv-safe-area`, plus the block edges on request. No layout of its own — it is a `div` with a class. |

`TVFocusable` also exports the two pieces of the row contract, so a component
never re-spells them:

| Export | What it is |
| ------ | ---------- |
| `TV_FOCUSABLE_CLASS` | The class string every TV focusable wears, before its ring |
| `TV_RING` | `full` (a card), `soft` (a control that carries its own light), or `none` |
| `TV_RAIL_CLASS` | The class string a rail wears |
| `TV_RAIL_PROPS` | The data attributes a rail carries — read by the engine and by the CSS |

## Product components (`src/components/tv/`)

| Component | File | Server/Client | Purpose |
| --------- | ---- | ------------- | ------- |
| `TVChannelCard` | `card.tsx` | client | The catalogue card's screen, at TV scale. One target; Enter plays it. |
| `TVChannelRow` | `rail.tsx` | client | A row that wraps horizontally and remembers where the user was |
| `TVHero` | `hero.tsx` | client | The banner. Two buttons, and the first thing focused wins |
| `TVNav` | `nav.tsx` | server | The bar: the mark and five destinations |
| `TVShell` | `shell.tsx` | client | Mounts the D-pad and the cursor rule; it is the root navigation scope |
| `TVDirectory` | `directory.tsx` | client | The `/tv` page itself: one banner, then rows |

`TVChannelCard` composes `ChannelScreen` from `@/components/channel-card`. The
still, the broadcast bug, the family's rim of light and the status chip are the
shared card's, unchanged — a television changes what is *around* it.

## Hooks (`src/hooks/`)

| Hook | File | What it does |
| ---- | ---- | ------------ |
| `useRemoteNavigation` | `use-remote-nav.ts` | The D-pad. One `window` keydown listener; geometric spatial navigation over `[data-tv-nav]` scopes; real DOM focus. |
| `useFocusLoop` | `use-focus-loop.ts` | The row must not lose the user: restores a rail's focus position when its cards re-render, and only ever in a rail that has held focus. |
| `useRemoteCursor` | `use-remote-cursor.ts` | The cursor rule. The cursor is absent until a pointer actually moves. |

## The DOM contract

Worth writing down, because it is the whole interface between the engine and the
components:

| Attribute | On | Meaning |
| --------- | -- | ------- |
| `data-tv-nav="root"` | the page | The outermost scope; answers a keypress when nothing is focused yet |
| `data-tv-nav` | a rail | An inner navigation scope |
| `data-tv-nav="bar"` | the nav bar | Fixed, so it is not a child of the scrolling content |
| `data-tv-focus` | every focusable | What a keypress can land on |
| `data-tv-loop="x"` | a rail | The row wraps horizontally |
| `data-tv-rail` | a rail | Where the sibling dimming applies |
| `data-tv-cursor` | `<html>` | `"remote"` (absent) or `"mouse"` (present). Written in server markup. |
| `data-tv-hero` | the banner | Marks the hero's own subtree |
| `data-tv-safe-area` | an inset | Marks an inset |

## The focus contract reaches everywhere

`data-tv-focus` is not only for the components in `src/components/tv/`. Any
interactive element a television can put on screen — the PWA install prompt, the
update notice — carries it too, because a button a remote cannot reach is a
button the user cannot dismiss, and on a device with no pointer there is no other
way out. The attribute is inert on the phone: nothing there listens for it.

## Utilities (declared in `src/app/globals.css`)

| Utility | What it does |
| ------- | ------------ |
| `tv-focusable` | The base every focusable wears: the transition, the press, no outline |
| `tv-focus-ring` | The gold ring: a dark grip, a gold bar, a bloom, elevation |
| `tv-focus-ring-soft` | The same, without the elevation — for a control that carries its own light |
| `tv-card-focus` | The card grows towards the viewer under focus |
| `tv-safe-area` | The gutter, widened by the safe-area insets |
| `tv-safe-area-block` | The same on the block edges |
| `tv-rail` | A horizontal scroller with no scrollbar and contained overscroll |

All are `@utility` in the stylesheet, so they compose with variants and need no
import. `[data-tv-focus] { scroll-margin-top }` clears the fixed bar when a key
presses something up the page.

## Libraries

| Library | Used for | Rule |
| ------- | --------- | ---- |
| `lucide-react` | every icon | The only icon set. The brand mark is the one exception — it is a mark, not an icon. |
| `@radix-ui/react-slot` | `TVFocusable asChild` | — |

Same rule as the shared system: no animation library, no state library, no
spatial-navigation library. One `keydown` listener does this with the browser's
own focus, which cannot get out of step with the DOM.

## Adding a component

1. Check the shadcn registry first — do not rebuild what exists.
2. Put a reusable primitive in `src/components/tv/` with the `TVFocusable`
   contract: a real element, `data-tv-focus`, an accessible name.
3. Put a product component in `src/components/tv/`.
4. Add the row to this file in the same commit.
5. Add the token you need to `@theme` inside the integration block of
   `src/app/globals.css`, and note it in
   [`../design-system/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).
6. Reach for an existing utility before writing a new effect. If you do add one,
   it is an `@utility`, it is prefixed `tv-`, and it has no layout side effects.
