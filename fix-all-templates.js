const fs = require('fs');
const s = fs.readFileSync('src/components/tv/tv-directory.tsx', 'utf8');
let lines = s.split('\n');

// Line 49 (index 48) - Landing page header
lines[48] = lines[48].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Lines 54-56 (indices 53-55) - Landing page nav
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Line 234 (index 233) - TV Auth QR header
lines[233] = lines[233].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Line 315 (index 314) - TV Auth flow header
lines[314] = lines[314].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Line 344 (index 343) - Profile picker
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

fs.writeFileSync('src/components/tv/tv-directory.tsx', lines.join('\n'));
console.log('Fixed all template literals in className');