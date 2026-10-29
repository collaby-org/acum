# ACUM TV — the ten-foot design layer

This is the design system of the **television** build. It is a layer *on top of*
the shared ACUM system ([`../../../design-system`](../../../design-system)), not a
replacement for it: the tokens, the `fx-*` utilities, the glass recipe, the
easing curves and the rule that depth comes from light rather than borders all
come from there and are used here unchanged.

What a television changes is not the vocabulary. It is the *distance*, the
*input device*, and *what focus means*.

```
 Shared layer (root)            This layer
──────────────────────      ─────────────────────────────────────
 Tokens, fx-*, easing  ──▶  A 10-foot type scale
 Glass, bloom, vignette      A focus ring that is a light, not an outline
 The brand mark, one accent   Safe area and overscan
                              The cursor rule
                              The D-pad engine
```

Three facts drive every decision in this file:

1. **The user is three metres away.** A 16px paragraph is a rumour at that
   distance and a 1px outline is invisible.
2. **There is no pointer.** Everything is reached with four arrows and a select
   button, so focus is not a state — it is the only way to exist on screen.
3. **The screen crops what it is given.** A set overscans two percent; a phone
   has a notch and a home indicator. Anything in the outer edge is not there.

---

## The tokens

Declared with `@theme` inside the integration block of
[`src/app/globals.css`](../src/app/globals.css), so the shared layer above them
stays reviewable and self-contained.

### Type — the ten-foot scale

| Token | Use |
| ----- | --- |
| `--text-tv-micro` | Chips, badges, captions on a control |
| `--text-tv-caption` | Nav items, button labels, counts |
| `--text-tv-body` | Body copy, the hero's "what is on now" |
| `--text-tv-lead` | Row titles, section headings |
| `--text-tv-title` | The hero's second line |
| `--text-tv-hero` | The channel name. Past five rem: it is a room. |

The scale *starts* where the web scale ends. Body copy is 19px; the hero goes
past `5rem`. A TV row is read across a sofa, so a row title at `20px` would be a
smudge.

### Focus light

| Token | Value | Use |
| ----- | ----- | --- |
| `--tv-ring-size` | `3px` | The gold bar's thickness |
| `--tv-ring-gap` | `4px` | The dark gap that holds it off the element |
| `--tv-card-scale` | `1.09` | How far a card grows towards the viewer |
| `--tv-row-dim` | `0.42` | The opacity the rest of the row falls to |

### Layout

| Token | Value | Use |
| ----- | ----- | --- |
| `--tv-gutter` | `clamp(1.5rem, 3.4vw, 4rem)` | The page gutter: wider than the web's, because the edges of a panel are cut off on a real set |
| `--tv-nav-height` | `5rem` | The navigation bar, which clears the safe area of every panel |

---

## The focus ring

The single most important thing in this layer. A remote has no hover — a D-pad
cannot point at anything without landing on it — so the ring is the only
feedback the user has that the thing under it is the thing they are on.

`tv-focus-ring` is a **stack of shadows**, not an outline:

```css
box-shadow:
  0 0 0 4px   rgb(4 5 10 / 0.9),                          /* the grip: a dark gap */
  0 0 0 7px   var(--color-signal),                        /* the bar itself */
  0 0 0 15px  rgb(242 167 27 / 0.28),                     /* the bloom */
  var(--shadow-e3);                                       /* and its elevation */
```

It is a shadow rather than an outline for two reasons: it is drawn outside the
element without moving anything, and it can carry a bloom, which an outline
cannot. The dark gap is what makes it read as a ring rather than a smear — the
element's own artwork never touches the bar.

`tv-focus-ring-soft` is the variant for a control that already carries a light
of its own (the hero's gold button). It replaces that light instead of fighting
it.

`tv-focusable` is the base every TV focusable wears: the transition, the press
scale, and no outline. Two utilities setting different properties compose, where
a Tailwind `transition-*` class and a `transition` utility would fight over
whichever one the stylesheet emitted last.

`tv-card-focus` sets the transform only — the card grows to `--tv-card-scale`.

## The row gives way

```
[data-tv-rail]:has([data-tv-focus]:focus) [data-tv-focus]:not(:focus) {
  opacity: var(--tv-row-dim);
}
```

This is `:has()` doing in the engine what a hundred lines of state would do in
JavaScript. It cannot fall out of step with the DOM the user is actually looking
at, because it *is* that DOM.

The `:not(:focus)` is not decoration, it is load-bearing: `:has()` inherits the
specificity of its most specific argument, so the dim rule scores `(0,4,0)`
against the focus rule's `(0,3,0)`. Without the exclusion the **focused** card
dims along with its siblings, which is exactly backwards.

## Safe area

`tv-safe-area` and `tv-safe-area-block` read `env(safe-area-inset-*)` and take
whichever is larger, the gutter or the inset. `viewport-fit=cover` is what makes
those insets real, and the root layout already declares it.

The gutter is deliberately a little wider than the web's, because the outer two
percent of a panel is not on a real screen.

## The cursor rule

```
The cursor is absent until a pointer actually moves.
```

One sentence, and it is enforced by one attribute on the document element:

```css
html[data-tv-cursor="remote"] * { cursor: none !important; }
```

The attribute is written in the server-rendered markup of the root layout, so a
television **never sees a frame with an arrow on it** — the state is true before
the first byte, not after the first component mount.

- The server renders `data-tv-cursor="remote"`.
- A genuine mouse movement (`pointerType: "mouse"`, real position change) flips
  it to `"mouse"`, and the cursor's own natural styles come back.
- Any keypress flips it back to `"remote"`.

Only the hiding rule is written. Forcing `cursor: auto` on every element would
out-specify the `cursor-pointer` utility, and a link that does not look clickable
is worse than a hidden cursor.

A touch is not a mouse and it is not a D-pad either — it is the one input that
must not wake the cursor on a device that has both, so `pointerdown` with
`pointerType: "touch"` resets it too.

## The D-pad engine

`src/hooks/use-remote-nav.ts`. One `keydown` listener on `window` and a DOM
contract:

| Attribute | On | Meaning |
| --------- | -- | ------- |
| `data-tv-nav="root"` | the page | The outermost scope; answers when nothing is focused yet |
| `data-tv-nav` | a rail, the bar | An inner scope |
| `data-tv-nav="bar"` | the nav bar | Fixed, so it is not a child of the scrolling content |
| `data-tv-focus` | every focusable | What a keypress can land on |
| `data-tv-loop="x"` | a rail | The row wraps horizontally |

**Focus is the browser's, not ours.** There is no `selectedIndex` in React
state, no re-render per press, and no synthetic `click` on Enter. Every
focusable is a real `<button>` or `<a>`; the engine only decides *which one* the
next arrow lands on. Everything that follows from real focus comes free and
stays correct: the browser's own focus styling, `scrollIntoView`, Enter
activating a button, and a screen reader announcing a link as a link.

**How the target is chosen.** Geometry. A candidate must lie in the direction of
travel — anything level with or behind the focused element is rejected — and
among the survivors the closest straight-ahead one wins, with a penalty for how
far off-axis it sits. So from a card, "right" is the card next to it and never
the row below; "down" is the card below and never the one three rows down that
happens to be closer in x.

**The scope chain is walked from the innermost outwards.** Left and right inside
a rail are answered by the rail, which wraps. Up and down fall through it to the
page scope when the row has nothing above or below. The fixed navigation bar is
appended to the chain even though it is not an ancestor of the content, so a
press of "down" from a bar item still reaches the rails.

**The wrap is per axis, and that is the whole trick.** `"x"` wraps the
horizontal axis and nothing else: a vertical key must *fall out of* a rail, or
the row would trap the user inside itself — every "down" would land back on the
row's first card and everything below would be unreachable. The root scope sets
no loop at all, because a page you cannot scroll off is a page you cannot leave.

**Enter is deliberately absent.** The browser activates a focused button on
Enter and follows a focused link. Handling it here would only duplicate that, and
badly — in the one case, a text field, where it must not fire at all.

**The keys a remote spells "Back" with** differ by platform (`Escape`,
`GoBack`, `BrowserBack`, `XF86Back`, `Back`), so all of them are handled, and the
browser's own history step is stopped when the app answers Back itself.

## The row must not lose the user

`src/hooks/use-focus-loop.ts`. A rail's contents are not static: the channel
list arrives after first paint, a live status turns over, a row empties, a search
narrows what is left. Any of those re-renders the cards, and a card that
re-renders out from under a focused element takes the focus with it — it
unmounts, focus drops to `<body>`, and the arrow keys stop working entirely. On a
television that is the worst failure there is: a remote with a dead D-pad looks
exactly like a broken app, and there is no mouse to click out of it.

So the row remembers where the user was, **by position**, and puts them back
when the cards change. Position rather than channel: the user said "I am looking
at the fourth thing here", and after a re-render the fourth thing here is what
they should still be looking at.

The guard that makes it a net instead of a hook: a row that has never held focus
must never take it. The observer fires on first paint, when React has just
inserted the cards and focus is nowhere near the rail — and without the guard
the last rail to mutate would put focus in itself before the user has pressed a
single key.

## Components

`src/components/tv/`.

| Component | File | What it is |
| --------- | ---- | ---------- |
| `TVFocusable` | `focusable.tsx` | The one primitive. An element marked `data-tv-focus`, wearing the ring, always a real button or `a` |
| `TVChannelCard` | `card.tsx` | The catalogue card's screen, at TV scale, one target, Enter plays it |
| `TVChannelRow` | `rail.tsx` | A row that wraps and remembers where you were |
| `TVHero` | `hero.tsx` | The banner. Two buttons, and the first thing focused wins |
| `TVNav` | `nav.tsx` | The bar. Mark, five destinations, nothing else |
| `TVSafeArea` | `safe-area.tsx` | The inset |
| `TVShell` | `shell.tsx` | Mounts the engine and the cursor rule, and is the root scope |
| `TVDirectory` | `directory.tsx` | The `/tv` page: one banner, then rows |

### What the card does *not* have

No favourite toggle, no hover-only title, no link to a plan hiding in a corner.
A remote cannot hover, so a hover affordance is a dead end; the two controls a
card can honestly offer are *play it* and nothing else. The favourite toggle and
the upgrade prompt belong to the channel's own screen, which is where the D-pad
sends you.

### Why rows and not a grid

A website can afford a grid of two hundred cards, because a pointer crosses a
grid quickly. A D-pad cannot — it crosses a *list* quickly and is miserable in a
grid. So `/tv` is a banner and rows, and every row is a rail that wraps.

## Accessibility

- Every interactive element has an accessible name. The card's is spoken as
  *"Vizionează Kiss TV, live acum"*, which is the visual card said in words.
- The ring replaces the web's thin 2px outline, and is visible on `:focus` as
  well as `:focus-visible`: on a television those are the same event.
- Status is never colour alone — every badge carries a text label.
- The reduced-motion rule from the shared layer collapses every animation, and
  the card's focus scale goes too, so a reduced-motion row is truly still.

## What this layer deliberately does not do

- **No state library, no animation library, no spatial-navigation library.** One
  `keydown` listener and a query selector do this with no dependencies, and they
  do it with the browser's own focus, which cannot get out of step with the DOM.
- **No virtual focus.** A "selected index" kept in React would re-render the
  screen on every press, fight the browser's own focus handling, and break the
  moment a real `<input>` needs the arrow keys.
- **No per-page focus memory that survives a route change.** That belongs to the
  router, and it is a later phase.
- **No player controls.** The full-screen player is its own phase; this layer
  builds what it navigates with.
