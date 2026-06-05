import fs from 'fs';
import path from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractText(filePath, pageNum = 1) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const strings = content.items.map(i => i.str).join(' ');
  return strings;
}

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));

(async () => {
  try {
    const file = process.argv[2] || path.join(__dirname, '..', 'storage', 'app', 'public', 'course-content', 'Kk82iNEZdoRSjjvxulqopY2f3WBfCvSB5g7MxtrY.pdf');
    console.log('Reading', file);
    const text = await extractText(file, 1);
    console.log('First page text snippet:\n', text.slice(0, 1000));
  } catch (err) {
    console.error('Error:', err);
    process.exit(2);
  }
})();
