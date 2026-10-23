const fs = require('fs');
const path = require('path');

const dir = path.join('src', 'app');
let removed = 0;
let added = 0;

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'page.tsx') {
      let s = fs.readFileSync(p, 'utf8');
      const orig = s;
      
      // Remove "await connection();" lines
      s = s.replace(/  await connection\(\);\n/g, '');
      removed += (orig.match(/await connection\(\)/g) || []).length;
      
      // Add dynamic = "force-dynamic" after imports if page is async
      if (s.includes('export default async function') && !s.includes('export const dynamic')) {
        const importMatch = s.match(/^(import.*;\n)+/m);
        if (importMatch) {
          const end = importMatch.index + importMatch[0].length;
          s = s.slice(0, end) + '\nexport const dynamic = "force-dynamic";\n' + s.slice(end);
          added++;
        }
      }
      
      if (s !== orig) fs.writeFileSync(p, s);
    }
  }
}
walk(dir);
console.log('Removed connection() from', removed, 'occurrences');
console.log('Added force-dynamic to', added, 'pages');
