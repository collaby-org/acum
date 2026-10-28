/**
 * Temporary shim: the generated catalogue has to carry the two fields the
 * channel model now declares, or the build fails. The dataset builder
 * should emit them; until it does, this adds them in place.
 *
 *   node scripts/patch-catalogue-fields.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const manifest = JSON.parse(
  await readFile(resolve(ROOT, "data/posters.json"), "utf8"),
);
const posters = new Map(
  Object.entries(manifest.posters ?? {}).map(([id, entry]) => [
    id,
    `/posters/${entry.file}`,
  ]),
);

const file = resolve(ROOT, "src/data/channels.ts");
let source = await readFile(file, "utf8");

// Every channel gets both fields, whatever it has today.
let count = 0;
source = source.replace(
  /^(\s*)"servers": \[$/gm,
  (match, indent) => {
    count += 1;
    return `${indent}"views": null,\n${indent}"poster": null,\n${indent}"servers": [`;
  },
);

// The stills the capture run has already produced.
let withPoster = 0;
for (const [id, poster] of posters) {
  const pattern = new RegExp(
    `("id": "${id}",\\n(?:[^\\n]*\\n)*?\\s*)"poster": null,`,
  );
  if (pattern.test(source)) {
    source = source.replace(pattern, `$1"poster": "${poster}",`);
    withPoster += 1;
  }
}

await writeFile(file, source, "utf8");
console.log(`patched ${count} channels, ${withPoster} posters`);
