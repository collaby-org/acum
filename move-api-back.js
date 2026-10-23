const fs = require('fs');
const path = require('path');

const srcDir = path.join('src', 'server', 'api');
const dstDir = path.join('src', 'app', 'api');

function walk(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) walk(s, d);
    else if (e.name === 'route.ts') {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      console.log('Moved back:', s, '→', d);
    }
  }
}

walk(srcDir, dstDir);
console.log('Done moving API routes back to app/api/');
