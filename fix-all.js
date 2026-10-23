const fs = require('fs');
const s = fs.readFileSync('src/components/tv/tv-directory.tsx', 'utf8');
let lines = s.split('\n');

// Fix template literals in className (landing page header)
lines[48] = lines[48].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Landing page nav
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// TV Auth QR header
lines[233] = lines[233].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// TV Auth flow header
lines[314] = lines[314].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Profile picker
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// Landing page nav (lines 54-56)
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Nav in TVDirectory (line 624, 629-632)
lines[623] = lines[623].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');
lines[628] = lines[628].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[629] = lines[629].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[630] = lines[630].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[631] = lines[631].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Profile picker (line 344)
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// FOCUSED_CARD template literal
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Nav in TVDirectory
lines[623] = lines[623].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');
lines[628] = lines[628].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[629] = lines[629].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[630] = lines[630].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[631] = lines[631].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Profile picker (line 344)
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// FOCUSED_CARD template literal (line 403)
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Fix line 474: change "))}" to ")}"
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '          ))}') {
    lines[i] = '          )}';
    console.log('Fixed line', i + 1);
    break;
  }
}

// Fix FOCUSED_CARD template literal (line 403)
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Fix nav in TVDirectory (lines 624, 629-632)
lines[623] = lines[623].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');
lines[628] = lines[628].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[629] = lines[629].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[630] = lines[630].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[631] = lines[631].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Profile picker (line 344)
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// FOCUSED_CARD template literal (line 403)
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Landing page header
lines[48] = lines[48].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Landing page nav
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Landing page nav (duplicate)
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Landing page nav (duplicate)
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Landing page nav (duplicate)
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Landing page header
lines[48] = lines[48].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Landing page nav
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// TV Auth QR header
lines[233] = lines[233].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// TV Auth flow header
lines[314] = lines[314].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Profile picker
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// FOCUSED_CARD template literal
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Fix line 474: change "))}" to ")}"
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '          ))}') {
    lines[i] = '          )}';
    console.log('Fixed line', i + 1);
    break;
  }
}

// Fix FOCUSED_CARD template literal (line 403)
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Fix nav in TVDirectory
lines[623] = lines[623].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');
lines[628] = lines[628].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[629] = lines[629].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[630] = lines[630].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[631] = lines[631].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Profile picker
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// FOCUSED_CARD template literal (line 403)
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Landing page header
lines[48] = lines[48].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Landing page nav
lines[53] = lines[53].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[54] = lines[54].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[55] = lines[55].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// TV Auth QR header
lines[233] = lines[233].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// TV Auth flow header
lines[314] = lines[314].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');

// Profile picker
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// FOCUSED_CARD template literal
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Fix line 474: change "))}" to ")}"
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '          ))}') {
    lines[i] = '          )}';
    console.log('Fixed line', i + 1);
    break;
  }
}

// Fix FOCUSED_CARD template literal (line 403)
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

// Fix nav in TVDirectory
lines[623] = lines[623].replace('from-[${NETFLIX_RED}]', 'from-red-600').replace('to-[#B81D24]', 'to-red-700');
lines[628] = lines[628].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[629] = lines[629].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[630] = lines[630].replace('text-[${NETFLIX_GREY}]', 'text-white/70');
lines[631] = lines[631].replace('text-[${NETFLIX_GREY}]', 'text-white/70');

// Profile picker
lines[343] = lines[343].replace('text-[${NETFLIX_RED}]', 'text-red-600');

// FOCUSED_CARD template literal (line 403)
lines[402] = lines[402].replace('ring-[${NETFLIX_RED}]', 'ring-red-600');

fs.writeFileSync('src/components/tv/tv-directory.tsx', lines.join('\n'));
console.log('All fixes applied');