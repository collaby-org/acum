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
      const old = '  await connection();\n';
      if (s.includes(old)) {
        s = s.replace(old, '  // connection() omitted for static export\n');
        fs.writeFileSync(p, s);
        count++;
        console.log('Removed connection():', p);
      }
    }
  }
}
walk(dir);
console.log('Removed connection() from', count, 'pages');
