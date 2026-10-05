'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CreditCard,
  History,
  Newspaper,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
} from 'lucide-react';
import { useRequireAdmin } from '@/hooks/use-require-admin';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';

const COMING_SOON_MODULES: {
  icon: typeof Newspaper;
  title: string;
  description: string;
}[] = [];

export default function AdminDashboardPage() {
  const { loading, isAdmin } = useRequireAdmin();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    // Redirect ditangani hook (ke /auth/login atau /).
    return null;
  }

  return (
    <div className="min-h-screen bg-cream-50 font-sans text-charcoal-900">
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Beranda
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
              Admin
            </p>
            <h1 className="mt-1 font-display text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold tracking-tight text-primary">
              Admin Dashboard
            </h1>
            <p className="mt-1 max-w-xl text-sm text-sage-500">
              Halaman ini digunakan untuk mengelola dan memantau ReBites.
            </p>
          </div>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
            Mode Admin
          </Badge>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="flex flex-col border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <Badge variant="default">Aktif</Badge>
              </div>
              <CardTitle className="mt-4">Moderasi Produk</CardTitle>
              <CardDescription>
                Tinjau dan verifikasi produk yang dikirim oleh UMKM.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Link href="/dashboard/admin/moderasi">
                <Button type="button" size="sm">
                  Buka Moderasi
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <History className="h-5 w-5" />
                </span>
                <Badge variant="default">Aktif</Badge>
              </div>
              <CardTitle className="mt-4">Riwayat Moderasi</CardTitle>
              <CardDescription>
                Lihat riwayat approve dan reject produk.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Link href="/dashboard/admin/riwayat">
                <Button type="button" size="sm">
                  Buka Riwayat
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="h-5 w-5" />
                </span>
                <Badge variant="default">Aktif</Badge>
              </div>
              <CardTitle className="mt-4">Manajemen UMKM</CardTitle>
              <CardDescription>
                Kelola data dan status verifikasi toko UMKM.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Link href="/dashboard/admin/umkm">
                <Button type="button" size="sm">
                  Buka UMKM
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <Badge variant="default">Aktif</Badge>
              </div>
              <CardTitle className="mt-4">Manajemen Pengguna</CardTitle>
              <CardDescription>
                Pantau pengguna terdaftar beserta peran dan status tokonya.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Link href="/dashboard/admin/pengguna">
                <Button type="button" size="sm">
                  Buka Pengguna
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CreditCard className="h-5 w-5" />
                </span>
                <Badge variant="default">Aktif</Badge>
              </div>
              <CardTitle className="mt-4">Manajemen Langganan</CardTitle>
              <CardDescription>
                Pantau subscription UMKM, status database, dan status efektif periodenya.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Link href="/dashboard/admin/langganan">
                <Button type="button" size="sm">
                  Buka Langganan
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <Badge variant="default">Aktif</Badge>
              </div>
              <CardTitle className="mt-4">Manajemen Pesanan</CardTitle>
              <CardDescription>
                Pantau pesanan, pembayaran, status operasional, dan pengiriman.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Link href="/dashboard/admin/pesanan">
                <Button type="button" size="sm">
                  Buka Pesanan
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="flex flex-col border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Newspaper className="h-5 w-5" />
                </span>
                <Badge variant="default">Aktif</Badge>
              </div>
              <CardTitle className="mt-4">Artikel</CardTitle>
              <CardDescription>
                Kelola konten artikel ReBites.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter>
              <Link href="/dashboard/admin/artikel">
                <Button type="button" size="sm">
                  Buka Artikel
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {COMING_SOON_MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.title}
                aria-disabled="true"
                className="flex flex-col opacity-80"
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-100 text-charcoal-500">
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge variant="secondary">Segera Hadir</Badge>
                  </div>
                  <CardTitle className="mt-4">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1" />
                <CardFooter>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled
                    aria-disabled="true"
                  >
                    Segera Hadir
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
