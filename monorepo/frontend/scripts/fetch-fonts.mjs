/**
 * Downloads the two brand fonts (Space Grotesk for display, Inter for UI) from
 * Google Fonts and stores them locally, so the app never depends on a font CDN
 * at runtime and the build never needs the network.
 *
 *   node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../public/fonts");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const FAMILIES = [
  {
    name: "Space Grotesk",
    query: "family=Space+Grotesk:wght@500;600;700",
    slug: "space-grotesk",
  },
  { name: "Inter", query: "family=Inter:wght@400..700", slug: "inter" },
];

/** Romanian needs latin (ă, î) and latin-ext (ș, ț). */
const KEEP_SUBSETS = new Set(["latin", "latin-ext"]);

await mkdir(OUT, { recursive: true });

const manifest = [];

for (const family of FAMILIES) {
  const cssUrl = `https://fonts.googleapis.com/css2?${family.query}&display=swap`;
  const css = await (await fetch(cssUrl, { headers: { "user-agent": UA } })).text();

  const blocks = [
    ...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g),
  ];

  for (const [, subset, body] of blocks) {
    if (!KEEP_SUBSETS.has(subset)) continue;

    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1].trim() ?? "400";
    const style = /font-style:\s*([^;]+);/.exec(body)?.[1].trim() ?? "normal";
    const url = /url\((https:\/\/[^)]+\.woff2)\)/.exec(body)?.[1];
    const unicodeRange =
      /unicode-range:\s*([^;]+);/.exec(body)?.[1].trim() ?? "";
    if (!url) continue;

    const file = `${family.slug}-${weight.replace(/\s+/g, "-")}-${subset}.woff2`;
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    await writeFile(resolve(OUT, file), bytes);
    manifest.push({
      family: family.name,
      weight,
      style,
      subset,
      file,
      unicodeRange,
      bytes: bytes.length,
    });
    console.log(
      `[fonts] ${file} (${subset}, ${weight}, ${(bytes.length / 1024).toFixed(1)} kB)`,
    );
  }
}

await writeFile(
  resolve(OUT, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);
console.log(`[fonts] ${manifest.length} files in src/app/fonts`);
