import type { LucideIcon } from 'lucide-react';
import { Eye, ShoppingBag, Store, Users } from 'lucide-react';

export interface MegaMenuLink {
  label: string;
  href: string;
  description: string;
  icon?: LucideIcon;
}

export interface MegaMenuGroup {
  id: string;
  triggerLabel: string;
  panelTitle: string;
  groupLabel?: string;
  items: MegaMenuLink[];
}

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
