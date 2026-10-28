import { readFileSync, writeFileSync, globSync } from 'node:fs';
const files = globSync(['app/**/*.tsx','app/**/*.ts','lib/**/*.ts']);
let n = 0;
for (const f of files) {
  const o = readFileSync(f, 'utf8');
  let s = o
    .replace(/backLabel="Dasbor Admin"/g, 'backLabel="Dashboard Admin"')
    .replace(/Kembali ke Dasbor/g, 'Kembali ke Dashboard')
    .replace(/label: 'Dasbor'/g, "label: 'Dashboard'")
    .replace(/title: 'Dasbor'/g, "title: 'Dashboard'")
    .replace(/title="Dasbor"/g, 'title="Dashboard"');
  if (s !== o) { writeFileSync(f, s); n++; }
}
console.log('file diubah:', n);
