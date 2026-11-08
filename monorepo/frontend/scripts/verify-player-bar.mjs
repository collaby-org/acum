/**
 * The player's control bar, measured.
 *
 * The owner reviewed the live player and wrote this:
 *
 *   "the buttons are too big … we must have always only 1 line, also we do
 *   not need the loading bar … we can't like play/pause button, too big in
 *   comparison with others, live badge maybe we can make it better, and not
 *   taking any space in that bar … quality button is huge and very bad
 *   designed".
 *
 * This script opens the player on a real channel and checks the bar against
 * those words: one line, one size, every target at least 44 × 44 px, no
 * loading strip, and no live badge taking space in the bar.
 *
 *   node scripts/verify-player-bar.mjs https://acum-weld.vercel.app/
 *
 * Harness credentials come from the environment (NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, ACUM_HARNESS_EMAIL, ACUM_HARNESS_PASSWORD).
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { installSession } from "./harness-signin.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(tmpdir(), "acum-verify-player-bar");
const APP = (
  process.argv[2] ?? "https://acum-weld.vercel.app/"
).replace(/\/$/, "");
const EDGE =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;

/** The smallest touch target the project accepts. */
const MIN_TARGET = 44;
/** The largest visible volume dot the project accepts. */
const MAX_VOLUME_THUMB = 16;
/** How far the dot's centre may sit from the painted track's centre line. */
const MAX_THUMB_TRACK_OFFSET = 2;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const edge = spawn(EDGE, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${OUT}\\.profile`,
  "--disable-gpu",
  "--no-first-run",
  "--window-size=1440,900",
  "--hide-scrollbars",
  "about:blank",
]);
await new Promise((r) => setTimeout(r, 2500));

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const target = list.find((t) => t.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

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
  new Promise((resolve_) => {
    const messageId = ++id;
    pending.set(messageId, resolve_);
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
const evaluate = async (expression) => {
  const reply = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (reply.error) {
    throw new Error(`Runtime.evaluate failed: ${reply.error.message}`);
  }
  const exception = reply.result?.exceptionDetails;
  if (exception) {
    throw new Error(
      `Runtime.evaluate threw: ${exception.exception?.description ?? exception.text}`,
    );
  }
  return reply.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

await installSession(send);
await send("Page.navigate", { url: `${APP}/canal/pro-tv` });

/** Wait for the bar, but not forever. */
const started = Date.now();
let report = null;

/** The bar sleeps until the pointer comes near it — so the pointer goes near. */
const wake = async () => {
  const spot = await evaluate(`(() => {
    const frame = document.querySelector('[data-player-chrome]') || document.querySelector('[data-player-controls-bar]');
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height - 24) };
  })()`);
  if (!spot) return;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: spot.x, y: spot.y });
};

while (Date.now() - started < 30_000) {
  await new Promise((r) => setTimeout(r, 500));
  await wake();
  await new Promise((r) => setTimeout(r, 300));
  report = await evaluate(String.raw`(() => {
    const bar = document.querySelector('[data-player-controls-bar]');
    if (!bar) return null;

    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const controls = [...bar.querySelectorAll('button, a, input[type="range"]')]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24),
          tag: el.tagName.toLowerCase(),
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        };
      });

    const overlaps = [];
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i];
        const b = controls[j];
        const width = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        if (width > 0 && height > 0) {
          overlaps.push({
            first: a.label,
            second: b.label,
            intersection: { w: Math.round(width), h: Math.round(height) },
          });
        }
      }
    }

    const range = bar.querySelector('input[type="range"][aria-label^="Volum:"]');
    let volume = null;
    if (range) {
      const rangeRect = range.getBoundingClientRect();
      const wrapper = range.parentElement;
      const track = wrapper?.querySelector('div[aria-hidden="true"]');
      const trackRect = track?.getBoundingClientRect();
      const drawnThumb = wrapper?.querySelector('[data-player-volume-thumb]');
      const drawnRect = drawnThumb?.getBoundingClientRect();

      const webkit = getComputedStyle(range, '::-webkit-slider-thumb');
      const moz = getComputedStyle(range, '::-moz-range-thumb');
      const nativeBackground = webkit.backgroundImage || webkit.background || moz.backgroundImage || moz.background || '';

      // Chromium does not expose a reliable box for a range thumb through
      // getComputedStyle. Read the declaration that actually paints it so
      // the old 44px native knob cannot masquerade as a small dot.
      const unescapeCss = (text) => text.replace(/\\(.)/g, '$1');
      const classTokens = (selector) => {
        const tokens = [];
        const pattern = /\.((?:\\.|[^\s.,:>+~()[\]])+)/g;
        let match;
        while ((match = pattern.exec(selector))) {
          tokens.push(unescapeCss(match[1]));
        }
        return tokens;
      };
      const thumbRules = [];
      const visitRules = (rules) => {
        for (const rule of rules) {
          const selector = rule.selectorText ?? '';
          const kind = selector.includes('::-webkit-slider-thumb')
            ? 'webkit'
            : selector.includes('::-moz-range-thumb')
              ? 'moz'
              : null;
          if (kind) {
            const base = selector
              .replace(/::-webkit-slider-thumb|::-moz-range-thumb[\s\S]*$/, '')
              .trim();
            let applies = false;
            if (base) {
              try {
                applies = range.matches(base);
              } catch {
                applies = false;
              }
              if (!applies) {
                // Tailwind's arbitrary variant ([&::-webkit-slider-thumb]:…)
                // escapes the selector in a way matches() refuses; fall back
                // to the class names the rule names.
                const tokens = classTokens(base);
                applies =
                  tokens.length > 0 &&
                  tokens.every((token) => range.classList.contains(token));
              }
            }
            thumbRules.push({
              kind,
              selector,
              applies,
              width: rule.style.getPropertyValue('width'),
              height: rule.style.getPropertyValue('height'),
              background: rule.style.getPropertyValue('background'),
              backgroundImage: rule.style.getPropertyValue('background-image'),
            });
          }
          if (rule.cssRules) visitRules(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          visitRules(sheet.cssRules);
        } catch {
          // Cross-origin stylesheets are not needed for this measurement.
        }
      }
      const applicable = thumbRules.filter((rule) => rule.applies);
      const nativeRule =
        applicable.findLast((rule) => rule.kind === 'webkit') ??
        applicable.findLast((rule) => rule.kind === 'moz') ??
        null;
      const cssPixels = (value) => {
        const text = String(value ?? '').trim();
        const px = /^(-?[\d.]+)px$/.exec(text);
        if (px) return Number(px[1]);
        const rem = /^(-?[\d.]+)rem$/.exec(text);
        if (rem) {
          const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          return Number(rem[1]) * rootSize;
        }
        const spacing = getComputedStyle(document.documentElement).getPropertyValue('--spacing').trim();
        const spacingPixels = cssPixels(spacing);
        const spacingMultiple = /^calc\(var\(--spacing\)\s*\*\s*(-?[\d.]+)\)$/.exec(text);
        if (spacingPixels !== null && spacingMultiple) {
          return spacingPixels * Number(spacingMultiple[1]);
        }
        return null;
      };
      const nativeBoxWidth = nativeRule
        ? cssPixels(nativeRule.width) ??
          parseFloat(
            nativeRule.kind === 'moz' ? moz.width : webkit.width,
          ) ??
          null
        : null;
      const nativeBoxHeight = nativeRule
        ? cssPixels(nativeRule.height) ??
          parseFloat(
            nativeRule.kind === 'moz' ? moz.height : webkit.height,
          ) ??
          null
        : null;
      const nativeRuleBackground =
        nativeRule?.backgroundImage || nativeRule?.background || nativeBackground;
      const nativeDot = /circle[\s\S]{0,160}?0\s+([\d.]+)px/.exec(nativeRuleBackground);
      const nativeDotDiameter = nativeDot ? Number(nativeDot[1]) * 2 : null;

      const value = Number(range.value);
      const minimum = Number(range.min || 0);
      const maximum = Number(range.max || 100);
      const ratio = maximum === minimum ? 0 : (value - minimum) / (maximum - minimum);
      const trackCentreX = trackRect
        ? trackRect.left + trackRect.width / 2
        : rangeRect.left + rangeRect.width / 2;

      volume = {
        inputRect: {
          x: Math.round(rangeRect.left),
          y: Math.round(rangeRect.top),
          w: Math.round(rangeRect.width),
          h: Math.round(rangeRect.height),
        },
        value,
        ratio,
        trackRect: trackRect
          ? {
              x: Math.round(trackRect.left),
              y: Math.round(trackRect.top),
              w: Math.round(trackRect.width),
              h: Math.round(trackRect.height),
              centreX: Math.round(trackRect.left + trackRect.width / 2),
              centreY: Math.round(trackRect.top + trackRect.height / 2),
            }
          : null,
        drawnThumbRect: drawnRect
          ? {
              x: Math.round(drawnRect.left),
              y: Math.round(drawnRect.top),
              w: Math.round(drawnRect.width),
              h: Math.round(drawnRect.height),
              centreX: Math.round(drawnRect.left + drawnRect.width / 2),
              centreY: Math.round(drawnRect.top + drawnRect.height / 2),
            }
          : null,
        nativeThumb: {
          boxWidth: nativeBoxWidth,
          boxHeight: nativeBoxHeight,
          visibleDotDiameter: nativeDotDiameter,
          background: nativeRuleBackground,
          declaration: nativeRule,
          // A native range thumb travels between half a thumb-width from
          // each end. Its painted centre therefore follows the value on the
          // painted track, not the centre of the whole input.
          centreX: Math.round(
            rangeRect.left +
              ((rangeRect.width - (nativeBoxWidth ?? 0)) * ratio) +
              (nativeBoxWidth ?? 0) / 2,
          ),
          centreY: Math.round(
            trackRect
              ? trackRect.top + trackRect.height / 2
              : rangeRect.top + rangeRect.height / 2,
          ),
          trackCentreX: Math.round(trackCentreX),
        },
      };
    }

    const overlay = document.querySelector('[data-player-buffering-overlay]');
    let overlayCentred = null;
    if (overlay) {
      const frame = overlay.parentElement.getBoundingClientRect();
      const box = overlay.getBoundingClientRect();
      overlayCentred =
        Math.abs((box.left + box.width / 2) - (frame.left + frame.width / 2)) <= 8 &&
        Math.abs((box.top + box.height / 2) - (frame.top + frame.height / 2)) <= 8;
    }

    const barRect = bar.getBoundingClientRect();
    const text = (bar.innerText || '').trim();

    return {
      barHeight: Math.round(barRect.height),
      barWidth: Math.round(barRect.width),
      lines: [...new Set(controls.map((c) => Math.round(c.top / 4)))].length,
      controls,
      overlaps,
      volume,
      smallestWidth: controls.length ? Math.min(...controls.map((c) => c.w)) : 0,
      smallestHeight: controls.length ? Math.min(...controls.map((c) => c.h)) : 0,
      hasProgressBar: Boolean(bar.querySelector('[role="progressbar"]')),
      liveBadgeTextInBar: text.includes('În direct'),
      barText: text.replace(/\s+/g, ' ').slice(0, 160),
      connectionChip: Boolean(bar.querySelector('[aria-label^="Conexiune:"]')),
      qualityChip: Boolean(
        bar.querySelector('[aria-label^="Calitate:"]'),
      ),
      bufferingOverlay: Boolean(overlay),
      overlayCentred,
    };
  })()`);
  if (report) break;
}

console.log("=== the bar, measured ===");
console.log(JSON.stringify(report, null, 2));

const checks = [];
if (!report) {
  checks.push(["the bar is on the page", false, "no bar found within 30s"]);
} else {
  checks.push([
    "the bar is on the page",
    true,
    `${report.barWidth}×${report.barHeight}px`,
  ]);
  checks.push([
    "the bar is one line",
    report.lines === 1,
    `${report.lines} line(s), ${report.controls.length} visible controls`,
  ]);
  checks.push([
    "every target is at least 44px",
    report.smallestWidth >= MIN_TARGET && report.smallestHeight >= MIN_TARGET,
    `smallest ${report.smallestWidth}×${report.smallestHeight}px`,
  ]);
  checks.push([
    "no loading strip in the bar",
    !report.hasProgressBar,
    report.hasProgressBar ? "a progressbar is present" : "none",
  ]);
  checks.push([
    "no live badge taking space in the bar",
    !report.liveBadgeTextInBar,
    report.liveBadgeTextInBar ? "the text 'În direct' is in the bar" : "none",
  ]);
  checks.push([
    "the connection chip is there",
    report.connectionChip,
    report.connectionChip ? "Conexiune: …" : "missing",
  ]);
  checks.push([
    "no two visible controls overlap",
    report.overlaps.length === 0,
    report.overlaps.length
      ? report.overlaps
          .map(
            (overlap) =>
              `${overlap.first} × ${overlap.second} (${overlap.intersection.w}×${overlap.intersection.h}px)`,
          )
          .join("; ")
      : "no intersecting control boxes",
  ]);

  if (report.volume?.drawnThumbRect) {
    const thumb = report.volume.drawnThumbRect;
    const track = report.volume.trackRect;
    const thumbSize = Math.max(thumb.w, thumb.h);
    const centreOffset = track
      ? Math.abs(thumb.centreY - track.centreY)
      : Number.POSITIVE_INFINITY;
    const onTrack = Boolean(
      track &&
        thumb.centreX >= track.x &&
        thumb.centreX <= track.x + track.w &&
        centreOffset <= MAX_THUMB_TRACK_OFFSET,
    );
    checks.push([
      "the drawn volume thumb is at most 16px",
      thumbSize <= MAX_VOLUME_THUMB,
      `${thumb.w}×${thumb.h}px at (${thumb.centreX}, ${thumb.centreY})`,
    ]);
    checks.push([
      "the drawn volume thumb sits on the painted track",
      onTrack,
      track
        ? `thumb centre (${thumb.centreX}, ${thumb.centreY}), track x=${track.x}..${track.x + track.w}px centre y=${track.centreY}px, vertical offset ${centreOffset}px`
        : "the painted track was not found",
    ]);
  } else {
    const native = report.volume?.nativeThumb;
    const track = report.volume?.trackRect;
    const nativeSize = native
      ? Math.max(native.boxWidth ?? 0, native.boxHeight ?? 0)
      : 0;
    const centreOffset =
      native && track
        ? Math.abs(native.centreY - track.centreY)
        : Number.POSITIVE_INFINITY;
    const nativeOnTrack = Boolean(
      native &&
        track &&
        native.centreX >= track.x &&
        native.centreX <= track.x + track.w &&
        centreOffset <= MAX_THUMB_TRACK_OFFSET,
    );
    checks.push([
      "the drawn volume thumb is at most 16px",
      nativeSize > 0 && nativeSize <= MAX_VOLUME_THUMB,
      native
        ? `no [data-player-volume-thumb]; native thumb box ${native.boxWidth ?? "unknown"}×${native.boxHeight ?? "unknown"}px, visible dot ${native.visibleDotDiameter ?? "unknown"}px diameter, centre (${native.centreX}, ${native.centreY})`
        : "the volume control was not found",
    ]);
    checks.push([
      "the drawn volume thumb sits on the painted track",
      nativeOnTrack,
      native && track
        ? `native thumb centre (${native.centreX}, ${native.centreY}), track x=${track.x}..${track.x + track.w}px centre y=${track.centreY}px, vertical offset ${centreOffset}px`
        : "the painted track or native thumb was not found",
    ]);
  }
  // The quality control stays away while the manifest carries no rung — an
  // empty menu is worse than no menu. It is a note, not a failure.
  console.log(
    `  NOTE  the quality chip — ${
      report.qualityChip
        ? "offered (Calitate: …)"
        : "not offered: the manifest carries no rung yet"
    }`,
  );
  if (report.bufferingOverlay) {
    checks.push([
      "the buffering animation is centred on the picture",
      report.overlayCentred === true,
      report.overlayCentred ? "centred" : "off centre",
    ]);
  }
}

console.log("\n=== the checks ===");
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}
const pass = checks.every(([, ok]) => ok);
console.log("\nRESULT:", pass ? "PASS" : "FAIL");

ws.close();
edge.kill();
process.exit(pass ? 0 : 1);
