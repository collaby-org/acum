const fs = require('fs');
const s = fs.readFileSync('src/components/tv/tv-directory.tsx', 'utf8');
let lines = s.split('\n');

// Fix line 624 (index 623)
lines[623] = lines[623].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Fix lines 629-632 (indices 628-631)
lines[628] = lines[628].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[629] = lines[629].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[630] = lines[630].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[631] = lines[631].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

fs.writeFileSync('src/components/tv/tv-directory.tsx', lines.join('\n'));
console.log('Fixed template literals in nav');