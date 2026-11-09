// Data demo, bukan pelanggan nyata. Ganti isi `TESTIMONIALS` saat data riil tersedia.
export type TestimonialAudience = 'Pembeli' | 'UMKM';

export interface Testimonial {
  name: string;
  role: string;
  audience: TestimonialAudience;
  quote: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Dimas A.',
    role: 'Pembeli — Beji, Kota Depok',
    audience: 'Pembeli',
    quote:
      'Saya biasanya baru tahu makanan surplus dari warung sekitar sudah hampir habis. Di ReBites saya bisa lihat duluan menu yang masih tersedia, jadi tidak perlu menebak-nebak.',
  },
  {
    name: 'Sri Wahyuni',
    role: 'Penjual nasi rumahan — Margonda, Kota Depok',
    audience: 'UMKM',
    quote:
      'Kalau menjelang tutup masih ada nasi sisa, dulu saya sudah bingung mau diapakan. Sekarang saya unggah pagi hari, dan biasanya habis sebelum jam tutup.',
  },
  {
    name: 'Ananda P.',
    role: 'Pembeli — Kukusan, Kota Depok',
    audience: 'Pembeli',
    quote:
      'Yang bikin saya balik bukan cuma harganya. Saya jadi tahu siapa yang masaknya, dan porsinya tetap seperti pesan langsung di tempatnya.',
  },
  {
    name: 'Hendra S.',
    role: 'Penjual roti — Sawangan, Kota Depok',
    audience: 'UMKM',
    quote:
      'Dashboard-nya tidak bikin pusing: isi nama menu, harga, sisa stok. Pesanan masuk langsung kelihatan, jadi saya bisa siapkan tanpa bolak-balik cek HP.',
  },
];
