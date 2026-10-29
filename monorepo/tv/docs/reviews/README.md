# Verification evidence — the TV build

The television build is proved by driving the real production build in headless
Edge over the DevTools protocol, and by sending **real** key and pointer events
through the browser's own input pipeline — not synthetic JavaScript events. A
focus engine that only answers a `dispatchEvent` of its own making is not
proved, so every assertion below comes from `Input.dispatchKeyEvent` and
`Input.dispatchMouseEvent`.

```bash
npm run build
npx next start --port 3111
npm run verify:nav -- http://127.0.0.1:3111/tv
```

The Supabase keys must be in the build or the client bundle throws by design:
the catalogue is static, but every card reads the account to decide whether to
name the plans.

## The screenshots

Taken at 1920×1080, each after a real keypress.

| File | What it shows |
| ---- | ------------- |
| `tv-home-rest.png` | The page at rest: nothing focused, and **no cursor** — the cursor rule's starting state, served in the markup. |
| `tv-home-hero-focus.png` | The first press. The hero's own action carries the ring: a dark gap, a gold bar, a bloom. This is why the banner's primary action is the first thing a remote lands on. |
| `tv-home-row-focus.png` | Down into the rows. A card ringed and grown towards the viewer, with its siblings dimmed to `--tv-row-dim` — `:has()` in the engine, no JavaScript, so it cannot fall out of step with the DOM. |
| `tv-home-row-scrolled.png` | Deep in the rows. The rail has scrolled the focused card into the middle, and the row behind it has fallen back into the dark. |

## The D-pad assertions

Twenty checks, each read back out of the live document:

```
PASS  cursor starts absent                — data-tv-cursor=remote
PASS  focus starts on the body, not a card — activeElement=body
PASS  first press reaches the hero         — label="Redă Antena 1 acum"
PASS  down leaves the hero for a row       — Generaliste 0/20
PASS  right moves along the row            — 0 -> 1
PASS  left moves back along the row        — 1 -> 0
PASS  down moves to a lower row            — Generaliste -> Știri
PASS  up moves to a higher row             — Știri -> Generaliste
PASS  left wraps at the row edge           — Știri 0 -> 18 of 19
PASS  right wraps at the row edge          — 18 -> 0
PASS  focused element is ringed            — ringed=true
PASS  focus paints the gold ring           — box-shadow: 0 0 0 4px rgb(4 5 10/.9),
                                                     0 0 0 7px rgb(242 167 27),
                                                     0 0 0 15px rgb(242 167 27/.28)
PASS  siblings dim, the focused does not  — focused=1 sibling=0.42
PASS  focused card is scaled               — matrix(1.09, 0, 0, 1.09, 0, 0)
PASS  mouse reveals the cursor             — data-tv-cursor=mouse
PASS  D-pad takes the cursor away          — data-tv-cursor=remote
PASS  focused card is on screen            — visible=true
PASS  Back key reaches history             — history.back called=true
PASS  click activates the focused card     — click fired=true
PASS  Enter key activates the card         — enter produced click=true

RESULT: 20/20 passed
```

The last two are the point of the whole design: the engine never handles Enter.
The browser activates a focused button on its own, and something that cannot get
out of step with the DOM is the thing to build a remote interface on.
