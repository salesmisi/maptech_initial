import fs from 'fs';
import path from 'path';

const file = process.argv[2] || path.join('storage','app','public','course-content','Kk82iNEZdoRSjjvxulqopY2f3WBfCvSB5g7MxtrY.pdf');
const buf = fs.readFileSync(file);
const s = buf.toString('latin1');

const fontRegex = /\/Font\s*<<[\s\S]*?>>/g;
const nameRegex = /\/([A-Za-z0-9._-]+)\s+<<[\s\S]*?\/BaseFont\s*\/([A-Za-z0-9\+\-_.]+)/g;

const fonts = new Set();
let m;
while ((m = nameRegex.exec(s)) !== null) {
  fonts.add(m[2]);
}

// Fallback search for /FontName
const fontNameRegex = /\/FontName\s*\/([A-Za-z0-9\+\-_.]+)/g;
while ((m = fontNameRegex.exec(s)) !== null) {
  fonts.add(m[1]);
}

console.log('PDF:', file);
if (fonts.size === 0) {
  console.log('No font names found with simple regex — PDF may be rasterized or uses indirect font names.');
} else {
  console.log('Fonts found:');
  for (const f of fonts) console.log(' -', f);
}
