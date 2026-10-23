const fs = require('fs');
const path = require('path');

const dirs = ['src/app', 'src/components'];
let instantRemoved = 0;
let cacheRemoved = 0;

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      let s = fs.readFileSync(p, 'utf8');
      const orig = s;
      // Remove "export const instant = false;" lines
      s = s.replace(/export const instant = false;\n/g, '');
      instantRemoved += (orig.match(/export const instant = false;/g) || []).length;
      // Remove standalone "use cache"; directives (with or without semicolon)
      s = s.replace(/"use cache";?\n/g, '');
      cacheRemoved += (orig.match(/"use cache"/g) || []).length;
      if (s !== orig) fs.writeFileSync(p, s);
    }
  }
}

for (const d of dirs) walk(d);
console.log('Removed instant:', instantRemoved, '| use cache:', cacheRemoved);
