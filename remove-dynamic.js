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
      const old = 'export const dynamic = "error";\n\n';
      if (s.includes(old)) {
        s = s.replace(old, '');
        fs.writeFileSync(p, s);
        count++;
        console.log('Removed dynamic=error:', p);
      }
    }
  }
}
walk(dir);
console.log('Removed from', count, 'pages');
