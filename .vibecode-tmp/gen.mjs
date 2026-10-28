import { buildXlsx } from '../lib/xlsx.ts';
import { writeFileSync } from 'node:fs';

const buf = buildXlsx({
  name: 'Laporan',
  columns: [
    { header: 'ID Laporan', width: 38 },
    { header: 'Dibuat (WIB)', width: 20 },
    { header: 'Deskripsi', width: 60, wrap: true },
    { header: 'Status', width: 12 },
    { header: 'Tingkat', width: 10 },
    { header: 'Pelapor', width: 24, wrap: true },
  ],
  rows: [
    ['a1b2c3d4-0000-1111-2222-333344445555', '27/10/2026 14:30', 'Toko mengirim pesanan yang tidak sesuai dengan deskripsi. Pembeli sudah menghubungi penjual namun tidak ada respons selama tiga hari berturut-turut, sehingga pembeli meminta pengembalian dana.', 'Terbuka', 'Tinggi', 'Budi Santoso'],
    ['e5f6a7b8-1111-2222-3333-444455556666', '26/10/2026 09:15', 'Konten & <script> "kutip" \'apostrof\'', 'Selesai', 'Rendah', 'Siti Rahayu'],
    ['c9d0e1f2-2222-3333-4444-555566667777', '25/10/2026 08:00', '', 'Ditinjau', 'Sedang', ''],
  ],
});
writeFileSync('.vibecode-tmp/uji.xlsx', buf);
console.log('ukuran:', buf.length, 'byte');
