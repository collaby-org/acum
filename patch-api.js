const fs = require('fs');
const path = require('path');
const dir = 'src/app/api';
let count = 0;
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'route.ts') {
      let s = fs.readFileSync(p, 'utf8');
      if (!s.includes('export const dynamic')) {
        const insert = 'export const dynamic = "force-static";\n\n';
        const importMatch = s.match(/^(import.*;\n)+/m);
        if (importMatch) {
          const end = importMatch.index + importMatch[0].length;
          s = s.slice(0, end) + '\n' + insert + s.slice(end);
        } else {
          s = insert + s;
        }
        fs.writeFileSync(p, s);
        count++;
      }
    }
  }
}
walk(dir);
console.log('Patched ' + count + ' route files');
