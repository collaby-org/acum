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
      if (s.includes('export default async function') && !s.includes('await connection()')) {
        const importMatch = s.match(/^(import.*;\n)+/m);
        if (importMatch) {
          const end = importMatch.index + importMatch[0].length;
          s = s.slice(0, end) + '\n  await connection();\n' + s.slice(end);
          fs.writeFileSync(p, s);
          count++;
          console.log('Added connection():', p);
        }
      }
    }
  }
}
walk(dir);
console.log('Added connection() to', count, 'pages');
