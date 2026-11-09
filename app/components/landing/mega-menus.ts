import type { LucideIcon } from 'lucide-react';
import { Eye, ShoppingBag, Store, Users } from 'lucide-react';

/**
 * Konfigurasi mega-menu navbar publik.
 *
 * Setiap item menunjuk ke tujuan nyata — halaman, section id, atau
 * `/tentang-kami#anchor` yang memang ada di markup — jadi tidak ada
 * navigasi rusak yang bisa muncul dari menu.
 */
export interface MegaMenuLink {
  label: string;
  href: string;
  description: string;
  icon?: LucideIcon;
}

export interface MegaMenuGroup {
  /** Kunci stabil untuk state open + panel id */
  id: string;
  /** Label pada pemicu navbar */
  triggerLabel: string;
  /** Label panel untuk `aria-labelledby` */
  panelTitle: string;
  /** Judul grup opsional (di atas baris item) */
  groupLabel?: string;
  items: MegaMenuLink[];
}

/**
 * Panel desktop di navbar publik. Hanya untuk halaman yang section-nya
 * benar-benar ada — `fitur` memakai dua section (`#pembeli`, `#umkm`),
 * `dampak` memakai tiga, dan `tentang-kami` memakai dua anchor.
 */
export const MEGA_MENUS: MegaMenuGroup[] = [
  {
    id: 'tentang-kami',
    triggerLabel: 'Tentang Kami',
    panelTitle: 'Navigasi halaman Tentang Kami',
    groupLabel: 'Cepat ke bagian halaman',
    items: [
      {
        label: 'Visi & Misi',
        href: '/tentang-kami#visi-misi',
        description: 'Arah dan komitmen ReBites untuk menuntaskan food waste di satu kota.',
        icon: Eye,
      },
      {
        label: 'Tim Leadership',
        href: '/tentang-kami#tim-leadership',
        description: 'Ketiga orang di balik ReBites, lengkap dengan peran dan detail kontak.',
        icon: Users,
      },
    ],
  },
  {
    id: 'fitur',
    triggerLabel: 'Fitur Unggulan',
    panelTitle: 'Navigasi halaman Fitur Unggulan',
    groupLabel: 'Apa yang bisa dilakukan di ReBites',
    items: [
      {
        label: 'Fitur untuk Pembeli',
        href: '/fitur#pembeli',
        description: 'Telusuri katalog surplus, bandingkan harga, pesan, dan ikuti sampai selesai.',
        icon: ShoppingBag,
      },
      {
        label: 'Fitur untuk UMKM',
        href: '/fitur#umkm',
        description: 'Daftarkan usaha, tawarkan menu surplus, dan kelola pesanan dari dashboard.',
        icon: Store,
      },
    ],
  },
  {
    id: 'dampak',
    triggerLabel: 'Dampak',
    panelTitle: 'Navigasi halaman Dampak',
    groupLabel: 'Cerita di balik setiap pesanan',
    items: [
      {
        label: 'Narasi',
        href: '/dampak#narrasi',
        description: 'Kenapa dampaknya dimulai dari satu warung dan satu orang, bukan angka besar.',
      },
      {
        label: 'Tiga Hasil',
        href: '/dampak#hasil',
        description: 'Makanan tidak terbuang, pendapatan UMKM naik, pembeli hemat — dalam satu pesanan.',
      },
      {
        label: 'Rantai',
        href: '/dampak#rantai',
        description: 'Alur pendek: UMKM menawarkan, pembeli memesan, makanan berpindah tangan.',
      },
    ],
  },
];
