const fs = require('fs');
const s = fs.readFileSync('src/components/tv/tv-directory.tsx', 'utf8');
const lines = s.split('\n');
lines.forEach((line, i) => {
  if (line.includes('${')) {
    console.log(i + 1, line.trim());
  }
});