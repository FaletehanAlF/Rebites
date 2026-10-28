/**
 * Ilustrasi motor pengantaran ReBites (SVG lokal, tanpa aset eksternal).
 *
 * Aturan yang dijaga:
 * - Ini ILUSTRASI STATE, bukan peta dan bukan indikator posisi. Tidak ada
 *   elemen yang bergerak/berdenyut permanen, agar tidak terbaca sebagai
 *   "kurir sedang bergerak" ketika data GPS belum ada.
 * - Warna memakai token proyek (primary/sage) via `currentColor` dan kelas
 *   Tailwind, sehingga ilustrasi ikut tema tanpa palet paralel.
 * - Dekoratif: `aria-hidden`, teks penjelas selalu disediakan pemanggil.
 */

export type CourierIllustrationTone = 'neutral' | 'active' | 'done';

const TONE_CLASSES: Record<CourierIllustrationTone, { body: string; accent: string; ground: string }> = {
  // `neutral` tetap redup (state belum bergerak) tetapi harus terbaca:
  // sage-500/60 sebelumnya membuat garis nyaris hilang di atas cream-50.
  neutral: { body: 'text-sage-600', accent: 'text-sage-100', ground: 'text-cream-200' },
  active: { body: 'text-primary', accent: 'text-primary/15', ground: 'text-sage-100' },
  done: { body: 'text-green-600', accent: 'text-green-50', ground: 'text-sage-100' },
};

export function DeliveryCourierIllustration({
  tone = 'neutral',
  className,
}: {
  tone?: CourierIllustrationTone;
  className?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <svg
      viewBox="0 0 120 72"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Latar lembut: lingkaran datar, bukan glow.
          fillOpacity eksplisit (bukan modifier alpha pada currentColor) agar
          tetap terang walau token warna tidak mendukung alpha. */}
      <circle cx="88" cy="22" r="14" className={t.accent} fill="currentColor" fillOpacity="0.35" />
      {/* Garis tanah. */}
      <line
        x1="6"
        y1="62"
        x2="114"
        y2="62"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={t.ground}
      />

      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className={t.body}>
        {/* Roda belakang, roda depan. */}
        <circle cx="27" cy="50" r="11" />
        <circle cx="93" cy="50" r="11" />
        <circle cx="27" cy="50" r="3.5" />
        <circle cx="93" cy="50" r="3.5" />

        {/* Rangka + tangki. */}
        <path d="M27 50 L45 38 L72 38 L93 50" />
        <path d="M45 38 L45 30 L60 30 L60 38" />
        <path d="M60 30 L74 30 L80 38" />

        {/* Setang + sokbreker depan. */}
        <path d="M86 30 L93 50" />
        <path d="M82 26 L94 22" />

        {/* Jok. */}
        <path d="M40 30 L56 30" strokeWidth="3.5" />

        {/* Kotak pengantaran di belakang. */}
        <rect x="10" y="30" width="18" height="16" rx="3" />
        <path d="M19 30 L19 24 L28 38" opacity="0.55" />
      </g>
    </svg>
  );
}
