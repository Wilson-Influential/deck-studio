// Adds a `thumb` field (pointing at library-assets/thumbs/...) to every raster asset.
// Run from the Deck Studio repo root: node tools/add-thumbs-to-library.mjs
import fs from 'node:fs';
const path = 'library.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));
const RASTER = /\.(png|jpe?g|webp)$/i;
let n = 0;
for (const a of db.assets || []) {
  if (a.src && RASTER.test(a.src) && a.src.startsWith('library-assets/')) {
    a.thumb = a.src.replace('library-assets/', 'library-assets/thumbs/');
    n++;
  } else {
    delete a.thumb;
  }
}
fs.writeFileSync(path, JSON.stringify(db, null, 2) + '\n');
console.log(`Set thumb on ${n} raster assets.`);
