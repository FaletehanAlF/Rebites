'use client';
import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, MapPin, Store, User, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { QuickActionsRow } from './QuickActionsRow';
import { useSellerPlan } from '@/lib/seller-plan';
import { getSellerUmkm } from '@/lib/product-storage';
import { supabase } from '@/lib/supabase';
import { getSellerStoreSettings, setStoreOpen, STORE_SETTINGS_UPDATED_EVENT, } from '@/lib/store-settings-storage';
import { useEffect, useState } from 'react';
export function StoreCard() {
    const { plan } = useSellerPlan();
    const [isOpen, setIsOpen] = useState(true);
    const [businessName, setBusinessName] = useState<string | null>(null);
    const [storeId, setStoreId] = useState<string | null>(null);
    const [storeSlug, setStoreSlug] = useState<string | null>(null);
    const [ownerName, setOwnerName] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        getSellerUmkm().then((umkm) => {
            if (cancelled)
                return;
            setBusinessName(umkm?.businessName ?? null);
            setStoreId(umkm?.id ?? null);
            setStoreSlug(umkm?.slug ?? null);
        });
        supabase.auth.getSession().then(({ data }) => {
            if (cancelled)
                return;
            const user = data.session?.user;
            if (!user)
                return;
            const metaName = user.user_metadata?.full_name;
            if (typeof metaName === 'string' && metaName.trim()) {
                setOwnerName(metaName.trim());
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        const refresh = () => {
            getSellerStoreSettings().then((settings) => {
                if (settings)
                    setIsOpen(settings.isOpen);
            });
        };
        refresh();
        window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
        return () => {
            window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
        };
    }, []);
    const handleToggleOpen = () => {
        const next = !isOpen;
        setStoreOpen(next).then((ok) => {
            if (ok)
                setIsOpen(next);
        });
    };
    const storeName = businessName ?? '';
    const displayedOwner = ownerName ?? '';
    return (<Card className="overflow-hidden p-0">
      
      <div className="flex items-center justify-between px-5 pb-0 pt-5 sm:px-6">
        <h2 className="text-sm font-bold text-foreground">Profil Toko</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
          <span className="h-3 w-3 rounded-full bg-primary"/>
          Paket {plan.label}
        </span>
      </div>

      
      <div className="relative mx-4 mt-4 overflow-hidden rounded-2xl bg-primary sm:mx-5">
        
        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-secondary/[0.08]"/>
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-secondary/[0.05]"/>

        <div className="relative p-5 sm:p-6">
          
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/15 backdrop-blur-sm">
                <Store className="h-5 w-5 text-primary-foreground"/>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
                  ReBites Partner
                </p>
                <p className="mt-0.5 font-display text-[15px] font-medium leading-tight text-primary-foreground">
                  {storeName || 'Nama Toko'}
                </p>
              </div>
            </div>
            <button type="button" onClick={handleToggleOpen} aria-pressed={isOpen} className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all', isOpen
            ? 'bg-secondary/20 text-primary-foreground hover:bg-secondary/30'
            : 'bg-primary text-white hover:bg-primary-dark')}>
              <span className={cn('relative inline-flex h-4 w-7 items-center rounded-full transition-colors', isOpen ? 'bg-secondary/30' : 'bg-foreground/20')}>
                <span className={cn('absolute h-2.5 w-2.5 rounded-full transition-all', isOpen ? 'left-3.5 bg-white' : 'left-0.5 bg-foreground')}/>
              </span>
              {isOpen ? 'Buka' : 'Tutup'}
            </button>
          </div>

          
          {plan.verifiedBadge && (<div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-1">
              <BadgeCheck className="h-3.5 w-3.5 text-primary"/>
              <span className="text-[10px] font-semibold text-primary-foreground/80">Terverifikasi</span>
            </div>)}

          
          <div className="my-4 h-px bg-secondary/10"/>

          
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/10">
                <User className="h-3.5 w-3.5 text-primary-foreground/70"/>
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-primary-foreground/50">Pemilik</p>
                <p className="text-xs font-semibold text-primary-foreground">{displayedOwner || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/10">
                <MapPin className="h-3.5 w-3.5 text-primary-foreground/70"/>
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-primary-foreground/50">Toko</p>
                <p className="text-xs font-semibold text-primary-foreground">
                  {storeSlug ? `/${storeSlug}` : 'Belum diatur'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      
      <div className="px-5 pt-4 sm:px-6">
        <Link href={`/detail/toko?id=${storeSlug ?? storeId ?? ''}`} className="group inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-xs font-semibold text-foreground transition-all hover:border-border hover:bg-muted">
          <Store className="h-3.5 w-3.5 text-primary transition-transform group-hover:scale-110"/>
          Lihat Profil Toko
          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"/>
        </Link>
      </div>

      <div className="px-5 pb-5 pt-3 sm:px-6">
        <QuickActionsRow />
      </div>
    </Card>);
}
