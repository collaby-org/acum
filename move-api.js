const fs = require('fs');
const path = require('path');

const srcDir = path.join('src', 'app', 'api');
const dstDir = path.join('src', 'server', 'api');

function walk(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) walk(s, d);
    else if (e.name === 'route.ts') {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      fs.unlinkSync(s);
      console.log('Moved:', s, '→', d);
    }
  }
  // Remove empty directories
  const remaining = fs.readdirSync(src);
  if (remaining.length === 0) {
    fs.rmdirSync(src);
    console.log('Removed empty dir:', src);
  }
}

walk(srcDir, dstDir);
console.log('Done');
