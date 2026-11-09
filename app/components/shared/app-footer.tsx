"use client";
import Image from "next/image";
import Link from "next/link";
import { Github } from "lucide-react";

interface AppFooterLink {
    label: string;
    href: string;
}

const DEFAULT_LINKS: AppFooterLink[] = [
    { label: "Kategori makanan", href: "/home#kategori" },
    { label: "Riwayat pesanan", href: "/riwayatPesanan" },
    { label: "Kebijakan privasi", href: "/privacy" },
    { label: "Syarat penggunaan", href: "/terms" },
];

const SELLER_LINKS: AppFooterLink[] = [
    { label: "Dashboard", href: "/dashboard/penjual" },
    { label: "Pesanan masuk", href: "/dashboard/penjual/pesanan" },
    { label: "Menu saya", href: "/dashboard/penjual/menu" },
    { label: "Profil toko", href: "/dashboard/penjual/pengaturan" },
    { label: "Kebijakan privasi", href: "/privacy" },
    { label: "Syarat penggunaan", href: "/terms" },
];

const ADMIN_LINKS: AppFooterLink[] = [
    { label: "Dashboard", href: "/dashboard/admin" },
    { label: "Pesanan", href: "/dashboard/admin/pesanan" },
    { label: "Pengguna", href: "/dashboard/admin/pengguna" },
    { label: "Kebijakan privasi", href: "/privacy" },
    { label: "Syarat penggunaan", href: "/terms" },
];

const FOOTER_FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary";

const SOCIALS = [
    {
        label: "WhatsApp ReBites",
        href: 'https://wa.me/6281219010664',
        Icon: WhatsAppIcon,
    },
    {
        label: "GitHub ReBites",
        href: 'https://github.com/kayy-eci/Rebitesss-GTNIC2026',
        Icon: Github,
    },
];

function WhatsAppIcon({ className }: {
    className?: string;
}) {
    return (<svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>);
}

interface AppFooterProps {
    role?: "buyer" | "seller" | "admin";
    hasMobileBottomNav?: boolean;
}

export function AppFooter({ role = "buyer", hasMobileBottomNav = false }: AppFooterProps) {
    const links = DEFAULT_LINKS;
    return (<footer data-nav="neutral" className={hasMobileBottomNav ? "border-t border-border pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0" : "border-t border-border"}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-8">
        <Link href={role === "seller" ? "/dashboard/penjual" : role === "admin" ? "/dashboard/admin" : "/home"} aria-label="ReBites, kembali ke beranda" className={`inline-flex w-fit items-center gap-2.5 rounded-lg ${FOOTER_FOCUS}`}>
          <Image src="/logo.avif" alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover ring-1 ring-border"/>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Re<span className="font-light italic">Bites</span>
          </span>
        </Link>

        <nav aria-label="Tautan footer" className="flex flex-wrap items-center gap-x-5 gap-y-0.5">
          {links.map((link) => (<Link key={link.href} href={link.href} className={`inline-flex min-h-[44px] items-center font-sans text-[13px] text-muted-foreground transition-colors duration-150 hover:text-primary ${FOOTER_FOCUS}`}>
              {link.label}
            </Link>))}
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()} ReBites. Dibuat oleh tim ReBites — SMK Taruna Bhakti.
          </p>

          <div className="flex items-center gap-2">
            {SOCIALS.map(({ label, href, Icon }) => (<a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <Icon className="h-4 w-4"/>
              </a>))}
          </div>
        </div>
      </div>
    </footer>);
}
