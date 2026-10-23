const fs = require('fs');
const s = fs.readFileSync('src/components/tv/tv-directory.tsx', 'utf8');
const lines = s.split('\n');
lines[473] = '          )}';
fs.writeFileSync('src/components/tv/tv-directory.tsx', lines.join('\n'));
console.log('Fixed line 474');