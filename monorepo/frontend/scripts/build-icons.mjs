/**
 * The ACUM icon set.
 *
 *   node scripts/build-icons.mjs
 *
 * The mark is drawn here, once, and everything else is a composition of it:
 * the app icon, the maskable icon, the Apple touch icon, the favicon and the
 * standalone SVG.
 *
 * The mark is a capital A — the first letter of ACUM — with a bright rail
 * running out of it to the right. The rail is the playhead: the position of
 * "now" on the programme guide. The A stays intact; the rail passes behind
 * it and emerges.
 *
 * Needs `sharp`, which Next.js already ships as an optional dependency.
 * The generated files are committed, so this only has to run when the mark
 * itself changes.
 */
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ICONS = resolve(ROOT, "public/icons");
const APP = resolve(ROOT, "src/app");

/* ------------------------------------------------------------------ *
 * The mark, in a 100x100 space.
 * ------------------------------------------------------------------ */

/** The A: a pointed chevron, 16 units thick, sitting on the baseline. */
const CHEVRON = "M12 88 L50 14 L88 88 L70 88 L50 49 L30 88 Z";

/** The rail: the playhead, hidden behind the A, emerging to the right. */
const RAIL = { x: 59, y: 54, w: 33, h: 12, r: 6 };

const DEFS = `
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#121724"/>
      <stop offset="0.55" stop-color="#080B14"/>
      <stop offset="1" stop-color="#04050A"/>
    </linearGradient>
    <radialGradient id="bloom" cx="0.5" cy="0.60" r="0.55">
      <stop offset="0" stop-color="#F2A71B" stop-opacity="0.22"/>
      <stop offset="0.5" stop-color="#F2A71B" stop-opacity="0.07"/>
      <stop offset="1" stop-color="#F2A71B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE7B0"/>
      <stop offset="0.38" stop-color="#F7B733"/>
      <stop offset="0.72" stop-color="#DE9206"/>
      <stop offset="1" stop-color="#9C6600"/>
    </linearGradient>
    <linearGradient id="rail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#D98F04"/>
      <stop offset="0.55" stop-color="#FFC95E"/>
      <stop offset="1" stop-color="#FFF3D4"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
  </defs>`;

const MARK = `
  <rect x="${RAIL.x}" y="${RAIL.y}" width="${RAIL.w}" height="${RAIL.h}" rx="${RAIL.r}" fill="url(#rail)"/>
  <path d="${CHEVRON}" fill="url(#gold)"/>`;

const svg = (body, size = 512) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${DEFS}${body}</svg>`;

/** Places the mark in the canvas, centred, scaled to `scale`. */
const place = (scale, dy = -1) => {
  const t = (100 - 100 * scale) / 2;
  return `<g transform="translate(${t} ${t + dy}) scale(${scale})">${MARK}</g>`;
};

/** The app icon — "any" purpose: a rounded tile with the mark on it. */
const iconAny = () =>
  svg(`
  <rect width="100" height="100" rx="22.5" fill="url(#field)"/>
  <rect width="100" height="100" rx="22.5" fill="url(#bloom)"/>
  ${place(0.6)}
  <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="22" fill="none" stroke="url(#rim)" stroke-width="1.2"/>`);

/** The maskable icon: full bleed, the mark kept inside the 80% safe zone. */
const iconMaskable = () =>
  svg(`
  <rect width="100" height="100" fill="url(#field)"/>
  <rect width="100" height="100" fill="url(#bloom)"/>
  ${place(0.46)}`);

/** The Apple touch icon: a plain square, iOS applies its own mask. */
const iconApple = () =>
  svg(`
  <rect width="100" height="100" fill="url(#field)"/>
  <rect width="100" height="100" fill="url(#bloom)"/>
  ${place(0.56)}`);

/** The favicon: flat, larger mark, less bloom — it is read at 16 pixels. */
const iconFavicon = () =>
  svg(`
  <rect width="100" height="100" rx="18" fill="#0A0D16"/>
  <rect width="100" height="100" rx="18" fill="url(#bloom)"/>
  ${place(0.76)}`);

/** The mark on its own, transparent, for the interface and for the docs. */
const markOnly = () => svg(MARK);

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

async function png(source, size, file) {
  await sharp(Buffer.from(source)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(`[icon] ${file.replace(ROOT + "\\", "")}`);
}

/** A PNG-in-ICO container. Every browser that matters reads it. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  await mkdir(ICONS, { recursive: true });

  const any = iconAny();
  const maskable = iconMaskable();
  const apple = iconApple();
  const favicon = iconFavicon();

  await png(any, 192, resolve(ICONS, "icon-192.png"));
  await png(any, 512, resolve(ICONS, "icon-512.png"));
  await png(maskable, 192, resolve(ICONS, "maskable-192.png"));
  await png(maskable, 512, resolve(ICONS, "maskable-512.png"));
  await png(apple, 180, resolve(ICONS, "apple-touch-icon.png"));

  await writeFile(resolve(ICONS, "acum-mark.svg"), markOnly(), "utf8");
  console.log("[icon] public/icons/acum-mark.svg");

  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    const data = await sharp(Buffer.from(favicon)).resize(size, size).png().toBuffer();
    images.push({ size, data });
  }
  await writeFile(resolve(APP, "favicon.ico"), ico(images));
  console.log("[icon] src/app/favicon.ico");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
