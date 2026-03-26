const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('Usage: node print_lines.cjs <file>'); process.exit(1); }
const txt = fs.readFileSync(p, 'utf8');
const lines = txt.split(/\n/);
for (let i = 0; i < lines.length; i++) {
  console.log(String(i+1).padStart(4, ' ') + ': ' + lines[i]);
}
