const fs = require('fs');
const path = require('path');

const dir = path.join('src', 'app');
let count = 0;

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'page.tsx') {
      let s = fs.readFileSync(p, 'utf8');
      if (s.includes('await connection()') && !s.includes('export const dynamic')) {
        // Add after imports, before the first export or comment block
        const insert = 'export const dynamic = "error";\n\n';
        // Find position after the last import or JSDoc comment
        const importMatch = s.match(/^(import.*;\n)+/m);
        if (importMatch) {
          const end = importMatch.index + importMatch[0].length;
          s = s.slice(0, end) + '\n' + insert + s.slice(end);
        } else {
          s = insert + s;
        }
        fs.writeFileSync(p, s);
        count++;
        console.log('Patched:', p);
      }
    }
  }
}
walk(dir);
console.log('Patched', count, 'page files');
