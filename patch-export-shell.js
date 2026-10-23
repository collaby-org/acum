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
      if (s.includes('await connection()')) {
        // Replace "await connection();" with a build-phase guard
        const old = '  await connection();\n';
        const replacement = `  // During static export, no database is available — return a shell
  if (process.env.NEXT_PHASE === 'export') {
    return <div data-export-shell>…</div>;
  }
  await connection();
`;
        if (s.includes(old)) {
          s = s.replace(old, replacement);
          fs.writeFileSync(p, s);
          count++;
          console.log('Patched:', p);
        } else {
          console.log('SKIP (no exact match):', p);
        }
      }
    }
  }
}
walk(dir);
console.log('Patched', count, 'page files');
