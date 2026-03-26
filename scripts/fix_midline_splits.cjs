const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('Usage: node fix_midline_splits.cjs <file>'); process.exit(1); }
const orig = fs.readFileSync(p, 'utf8');
fs.writeFileSync(p + '.bak', orig, 'utf8');
let lines = orig.split('\n');
let i = 0;
while (i < lines.length - 1) {
  const a = lines[i];
  const b = lines[i+1];
  const aLast = a.slice(-1);
  const bFirst = b.charAt(0);
  // If a ends with an alnum or underscore and b starts with alnum/underscore
  // and a does not end with a space or punctuation that would naturally break
  if (/[_A-Za-z0-9]$/.test(aLast) && /^[_A-Za-z0-9]/.test(bFirst)) {
    // Merge lines
    lines[i] = a + b;
    lines.splice(i+1, 1);
    // don't increment i, check again in case of multiple splits
  } else {
    i++;
  }
}
const out = lines.join('\n');
fs.writeFileSync(p, out, 'utf8');
console.log('Fixed file written and backup saved to', p + '.bak');
