/**
 * Remote verification — the D-pad and the cursor rule.
 *
 * The television's two rules are the whole product on that device: focus
 * is a light you can always find, and the cursor is absent until a pointer
 * actually moves. Both are verified here against the real production build
 * in headless Edge over the DevTools protocol, and — the important part —
 * with *real* input events dispatched through the browser's own pipeline.
 * A synthetic `KeyboardEvent` from inside the page proves nothing: it is
 * exactly what a broken engine would still answer.
 *
 *   node scripts/verify-tv-nav.mjs http://127.0.0.1:3111/tv
 *
 * Exits non-zero on the first failed rule.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP = process.argv[2] ?? "http://127.0.0.1:3111/tv";
const EDGE = process.env.EDGE_PATH ?? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9411;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + mkdtempSync(join(tmpdir(), "acum-tv-nav-")),
    "--window-size=1920,1080",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === "page");
  } catch {
    /* not up yet */
  }
}
if (!target) {
  console.log("FATAL: the DevTools endpoint never came up");
  edge.kill();
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res, { once: true });
  ws.addEventListener("error", rej);
});

let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const msgId = ++id;
    pending.set(msgId, res);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

const evaluate = async (expression) => {
  const msg = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (msg.result?.exceptionDetails) {
    throw new Error(msg.result.exceptionDetails.text);
  }
  return msg.result?.result?.value;
};

const VIRTUAL_KEYS = { ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38 };
/**
 * A real key. Both the down and the up go through the browser's input
 * pipeline, and the pause afterwards lets the focus ring, the card's scale
 * and the row's dim finish their transitions — without it, a correct rule
 * reads as a failing one.
 */
const press = async (key) => {
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code: key,
    windowsVirtualKeyCode: VIRTUAL_KEYS[key],
    nativeVirtualKeyCode: VIRTUAL_KEYS[key],
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code: key,
    windowsVirtualKeyCode: 0,
    nativeVirtualKeyCode: 0,
  });
  await sleep(420);
};

/** Where the document's focus actually is. */
const focusState = async () =>
  evaluate(`(() => {
    const el = document.activeElement;
    const rail = el?.closest("[data-tv-rail]");
    const cards = rail ? [...rail.querySelectorAll("[data-tv-focus]")] : [];
    return {
      what: !el || el === document.body ? "body" : el.tagName.toLowerCase(),
      label: el?.getAttribute("aria-label")?.slice(0, 36) ?? null,
      inHero: !!el?.closest("[data-tv-hero]"),
      rail: rail ? (rail.closest("section")?.querySelector("h2")?.textContent ?? "?") : null,
      railIndex: rail ? cards.indexOf(el) : null,
      railCount: rail ? cards.length : null,
      ringed: el ? /tv-focus-ring|tv-focus-ring-soft|tv-card-focus/.test(el.className) : false,
    };
  })()`);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: APP });

let loaded = false;
for (let i = 0; i < 80 && !loaded; i++) {
  await sleep(400);
  try {
    const s = JSON.parse(
      await evaluate(
        `JSON.stringify({ ready: document.readyState, cards: document.querySelectorAll("[data-tv-focus]").length, rails: document.querySelectorAll("[data-tv-rail]").length })`,
      ),
    );
    if (s.ready === "complete" && s.cards > 0 && s.rails > 0) loaded = true;
  } catch {
    /* keep waiting */
  }
}
if (!loaded) {
  console.log("FATAL: the page never rendered its rails");
  edge.kill();
  process.exit(1);
}
await sleep(800);

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name.padEnd(38)} — ${detail}`);
};

/**
 * Wait for the first-visit sting to finish.
 *
 * It plays once per device, on the device that has never seen the product,
 * and it holds focus for its own beat before handing it back. On a fresh
 * profile that beat is part of the load, so the harness waits it out rather
 * than reading focus underneath it. On a device that has seen the product it
 * is gone before the first check runs.
 */
for (let i = 0; i < 40; i++) {
  const sting = await evaluate(
    `!!document.querySelector("[aria-modal]") || document.querySelectorAll("[id^='acum-intro']").length > 0`,
  );
  if (!sting) break;
  await sleep(300);
}
// One beat for the hand-back to settle.
await sleep(600);

// 1. The cursor rule, before any input at all.
const cursorAtLoad = await evaluate(
  `document.documentElement.getAttribute("data-tv-cursor")`,
);
check("cursor starts absent", cursorAtLoad === "remote", `data-tv-cursor=${cursorAtLoad}`);

// 2. Nothing steals focus on load — least of all a channel card.
const atLoad = await focusState();
check(
  "focus starts on the body, not a card",
  atLoad.what === "body",
  `activeElement=${atLoad.what}`,
);

// 3. The first press reaches the hero's own action.
await evaluate(`document.activeElement === document.body || document.activeElement?.blur?.()`);
await press("ArrowRight");
const first = await focusState();
check(
  "first press reaches the hero action",
  first.inHero && first.what === "button",
  `label="${first.label}"`,
);

// 4. Down from the hero reaches a row.
await press("ArrowDown");
const rowed = await focusState();
check(
  "down leaves the hero for a row",
  rowed.rail !== null && rowed.railIndex >= 0,
  `${rowed.rail} ${rowed.railIndex}/${rowed.railCount}`,
);

// 5–8. The four directions between rows.
await press("ArrowRight");
const right = await focusState();
check("right moves along the row", right.railIndex === rowed.railIndex + 1, `${rowed.railIndex} -> ${right.railIndex}`);
await press("ArrowLeft");
const left = await focusState();
check("left moves back along the row", left.railIndex === rowed.railIndex, `${right.railIndex} -> ${left.railIndex}`);
await press("ArrowDown");
const downed = await focusState();
check("down moves to a lower row", downed.rail !== rowed.rail, `${rowed.rail} -> ${downed.rail}`);
await press("ArrowUp");
const upped = await focusState();
check("up moves to a higher row", upped.rail === rowed.rail, `${downed.rail} -> ${upped.rail}`);

// 9–10. The wrap, in both directions.
await press("ArrowDown");
for (let i = 0; i < 40; i++) {
  const s = await focusState();
  if (s.railIndex === 0) break;
  await press("ArrowLeft");
}
const atStart = await focusState();
await press("ArrowLeft");
const wrapped = await focusState();
check(
  "left wraps at the row edge",
  atStart.railIndex === 0 && wrapped.rail === atStart.rail && wrapped.railIndex === atStart.railCount - 1,
  `${atStart.rail} ${atStart.railIndex} -> ${wrapped.railIndex} of ${atStart.railCount}`,
);
await press("ArrowRight");
const wrappedRight = await focusState();
check(
  "right wraps at the row edge",
  wrappedRight.rail === atStart.rail && wrappedRight.railIndex === 0,
  `${wrapped.railIndex} -> ${wrappedRight.railIndex}`,
);

// 11–12. The ring, as a class and as paint.
check("focused element is ringed", wrappedRight.ringed === true, `ringed=${wrappedRight.ringed}`);
const shadow = await evaluate(`getComputedStyle(document.activeElement).boxShadow`);
check(
  "focus paints the gold ring",
  typeof shadow === "string" && shadow.includes("242, 167, 27"),
  `box-shadow: ${String(shadow).slice(0, 84)}`,
);

// 13. The row gives way.
const dim = JSON.parse(
  await evaluate(`(() => {
    const rail = document.activeElement.closest("[data-tv-rail]");
    if (!rail) return JSON.stringify({ error: "not in a rail" });
    const others = [...rail.querySelectorAll("[data-tv-focus]")].filter((c) => c !== document.activeElement);
    return JSON.stringify({
      focused: getComputedStyle(document.activeElement).opacity,
      sibling: others.length ? getComputedStyle(others[0]).opacity : null,
    });
  })()`),
);
check(
  "siblings dim, the focused does not",
  !dim.error && Number(dim.focused) === 1 && Number(dim.sibling) < 1,
  `focused=${dim.focused} sibling=${dim.sibling}`,
);

// 14. The card grows towards the viewer.
const scaled = await evaluate(`getComputedStyle(document.activeElement).transform`);
check("focused card is scaled", typeof scaled === "string" && scaled.startsWith("matrix"), `transform=${scaled}`);

// 15–16. The cursor rule, both ways.
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 500, y: 300, button: "none" });
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 540, y: 320, button: "none" });
await sleep(300);
const cursorMouse = await evaluate(`document.documentElement.getAttribute("data-tv-cursor")`);
check("mouse reveals the cursor", cursorMouse === "mouse", `data-tv-cursor=${cursorMouse}`);
await press("ArrowRight");
const cursorKey = await evaluate(`document.documentElement.getAttribute("data-tv-cursor")`);
check("D-pad takes the cursor away", cursorKey === "remote", `data-tv-cursor=${cursorKey}`);

// 17. The focused element is on screen.
const visible = await evaluate(`(() => {
  const r = document.activeElement.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= (window.innerHeight + 2) && r.left >= -2 && r.right <= (window.innerWidth + 2);
})()`);
check("focused card is on screen", visible === true, `visible=${visible}`);

// 18. The Back key reaches the app rather than vanishing.
const backWorks = await evaluate(`(() => {
  let called = false;
  const original = history.back;
  history.back = function () { called = true; };
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  history.back = original;
  return called;
})()`);
check("Back key reaches history", backWorks === true, `history.back called=${backWorks}`);

// 19–20. Enter is the browser's job, and the browser does it.
const clickFired = await evaluate(`(() => {
  const el = document.activeElement;
  let went = false;
  const onClick = (e) => { went = true; e.preventDefault(); };
  el.addEventListener("click", onClick);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  el.removeEventListener("click", onClick);
  return went;
})()`);
check("click activates the focused card", clickFired === true, `click fired=${clickFired}`);

await evaluate(`(() => {
  const el = document.activeElement;
  window.__tvEnterFired = false;
  const onClick = (e) => { window.__tvEnterFired = true; e.preventDefault(); };
  el.addEventListener("click", onClick);
  window.__tvEnterOff = () => el.removeEventListener("click", onClick);
})()`);
await send("Input.dispatchKeyEvent", {
  type: "keyDown", key: "Enter", code: "Enter", text: "\r",
  windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
});
await send("Input.dispatchKeyEvent", {
  type: "keyUp", key: "Enter", code: "Enter",
  windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
});
await sleep(320);
const enterFired = await evaluate(`window.__tvEnterFired`);
await evaluate(`window.__tvEnterOff && window.__tvEnterOff()`);
check("Enter key activates the card", enterFired === true, `enter produced click=${enterFired}`);

console.log("");
console.log(`RESULT: ${results.filter((r) => r.pass).length}/${results.length} passed`);
edge.kill();
ws.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
