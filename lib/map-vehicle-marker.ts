/**
 * Ikon kendaraan untuk peta pengantaran.
 *
 * Fungsi MURNI: hanya menyusun string markup, tanpa DOM, tanpa peta, tanpa
 * jaringan. Dipisah dari komponen peta supaya bentuk ikonnya bisa diperiksa
 * dan diuji tanpa browser.
 *
 * Kedalaman datang dari bayangan di tanah plus "dinding" berwarna lebih gelap
 * di bawah siluet atas — jadi terlihat bervolume, tetapi tetap gambar datar:
 * semua warna solid (tanpa gradien) dan tanpa WebGL/model 3D. Biaya per frame
 * animasi tetap satu `transform` + satu `opacity`.
 *
 * Ikon digambar menghadap KE ATAS (utara = 0 derajat), jadi pemanggil bisa
 * memutarnya dengan `rotate(<derajat searah jarum jam dari utara>)` pada
 * elemen `[data-vehicle-inner]`. Bayangan sengaja berada DI LUAR elemen yang
 * diputar: kalau ikut berputar, arah bayangannya berubah-ubah.
 *
 * Keadaan "sedang berjalan" bukan urusan modul ini: pemanggil menyetel
 * `transform` pada `[data-vehicle-root]` dan skala/opasitas
 * `[data-vehicle-shadow]` (lihat `applyVehicleMotionState`), dan transisi di
 * markup ini yang menghaluskannya.
 */

/** Ukuran sprite dalam piksel CSS; pemanggil memakainya untuk anker marker. */
export const VEHICLE_MARKER_WIDTH = 40;
export const VEHICLE_MARKER_HEIGHT = 52;

/** Hijau ReBites — sama dengan warna garis rute di komponen peta. */
const GREEN = '#1B6B3A';
/** Sisi gelap: dinding kedalaman dan setang. */
const GREEN_SIDE = '#123B22';
/** Bagian tergelap: roda dan grip. */
const GREEN_WHEEL = '#0E2E1B';
/** Jaket/bahu pengendara. */
const RIDER = '#EDE9DC';
/** Helm. */
const RIDER_LIGHT = '#F7F5EF';
/** Visor — penanda arah hadap selain lampu depan. */
const INK = '#1E2A22';

export function buildVehicleMarkerHtml(): string {
  return `
<div data-vehicle-root style="position:relative;width:${VEHICLE_MARKER_WIDTH}px;height:${VEHICLE_MARKER_HEIGHT}px;pointer-events:none;will-change:transform,opacity;transition:transform 260ms cubic-bezier(0.23,1,0.32,1)">
  <span data-vehicle-shadow aria-hidden="true" style="position:absolute;left:50%;top:50%;width:26px;height:15px;transform:translate(-50%,-30%);border-radius:9999px;background:${GREEN_WHEEL};opacity:.26;transition:transform 260ms cubic-bezier(0.23,1,0.32,1),opacity 260ms cubic-bezier(0.23,1,0.32,1)"></span>
  <div data-vehicle-inner aria-hidden="true" style="position:absolute;inset:0;transform-origin:50% 50%;transition:transform 140ms linear">
    <svg width="${VEHICLE_MARKER_WIDTH}" height="${VEHICLE_MARKER_HEIGHT}" viewBox="0 0 40 52" fill="none">
      <!-- Roda depan (atas) dan roda belakang (bawah) -->
      <rect x="16.5" y="2" width="7" height="11" rx="3.2" fill="${GREEN_WHEEL}"/>
      <rect x="16.5" y="40" width="7" height="10" rx="3.2" fill="${GREEN_WHEEL}"/>
      <!-- Dinding kedalaman, digeser 2px ke bawah dari permukaan atas -->
      <rect x="13" y="9" width="14" height="14" rx="6" fill="${GREEN_SIDE}"/>
      <rect x="14.5" y="33" width="11" height="12" rx="5" fill="${GREEN_SIDE}"/>
      <!-- Permukaan atas bodi -->
      <rect x="13" y="7" width="14" height="14" rx="6" fill="${GREEN}"/>
      <rect x="15.5" y="17" width="9" height="12" rx="4" fill="${GREEN}"/>
      <rect x="14.5" y="31" width="11" height="12" rx="5" fill="${GREEN}"/>
      <!-- Lampu depan: penanda arah paling jelas dari atas -->
      <rect x="17.4" y="7.4" width="5.2" height="2.6" rx="1.3" fill="${RIDER_LIGHT}"/>
      <!-- Setang dan grip di ujungnya -->
      <rect x="9.5" y="10.5" width="21" height="3" rx="1.5" fill="${GREEN_SIDE}"/>
      <circle cx="10.8" cy="12" r="2" fill="${GREEN_WHEEL}"/>
      <circle cx="29.2" cy="12" r="2" fill="${GREEN_WHEEL}"/>
      <!-- Lengan pengendara menuju setang -->
      <path d="M15.4 30.5 L11.6 14.4" stroke="${RIDER}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M24.6 30.5 L28.4 14.4" stroke="${RIDER}" stroke-width="2.6" stroke-linecap="round"/>
      <!-- Bahu, helm, dan visor yang menghadap arah jalan -->
      <ellipse cx="20" cy="32" rx="7" ry="6" fill="${RIDER}"/>
      <circle cx="20" cy="28.6" r="4.8" fill="${RIDER_LIGHT}"/>
      <rect x="17.2" y="24.6" width="5.6" height="3.2" rx="1.6" fill="${INK}"/>
    </svg>
  </div>
</div>`.trim();
}

/**
 * Gaya visual keadaan kendaraan: sedang berjalan atau berhenti.
 *
 * Dipisah sebagai fungsi murni supaya nilai yang dipakai aplikasi dan nilai
 * yang diperiksa bisa berasal dari satu sumber — salinan yang melenceng
 * membuat motor terlihat "melayang" hanya di satu tempat.
 *
 * Saat berjalan badan sedikit terangkat dari bayangannya, dan bayangannya
 * menjauh sambil meredup. Terjemahan `+2px` pada bayangan menahan bayangan
 * tetap di tanah ketika root naik `-2px`, sehingga jarak keduanya bertambah.
 * Hanya `transform` dan `opacity` — tidak ada properti layout.
 */
export function vehicleMotionStyles(moving: boolean): {
  root: string;
  shadow: string;
  shadowOpacity: string;
} {
  return {
    root: moving ? 'translateY(-2px)' : 'translateY(0)',
    shadow: moving
      ? 'translate(-50%,-30%) translateY(2px) scale(1.18)'
      : 'translate(-50%,-30%) scale(1)',
    shadowOpacity: moving ? '0.15' : '0.26',
  };
}
