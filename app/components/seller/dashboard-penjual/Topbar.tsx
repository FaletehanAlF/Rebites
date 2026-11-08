'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, Menu, Store } from 'lucide-react';
import {
  getSellerStoreSettings,
  STORE_SETTINGS_UPDATED_EVENT,
} from '@/lib/store-settings-storage';
import { useCurrentUser } from '@/lib/current-user';
import { useNotifications } from '@/hooks/use-notifications';

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const [storeName, setStoreName] = useState('');
  const [storeImage, setStoreImage] = useState('');
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const { userId } = useCurrentUser();
  
  const { unreadCount } = useNotifications(userId, 'seller');

  useEffect(() => {
    const refresh = () => {
      getSellerStoreSettings().then((settings) => {
        setStoreName(settings?.storeName ?? '');
        setStoreImage(settings?.image ?? '');
        setImageLoadFailed(false);
      });
    };
    refresh();
    window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5 lg:px-10">
        { }
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Buka menu navigasi"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        { }
        <Link href="/dashboard/penjual" className="flex items-center gap-2">
          {storeImage && !imageLoadFailed ? (
            <Image
              src={storeImage}
              alt={storeName ? `Logo ${storeName}` : 'Logo toko'}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
              onError={() => setImageLoadFailed(true)}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white">
              <Store className="h-4 w-4" />
            </div>
          )}
          <span className="text-sm font-bold text-foreground">
            {storeName || '-'}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/dashboard/penjual/notifikasi"
            aria-label={`Notifikasi${unreadCount > 0 ? ` (${unreadCount} belum dibaca)` : ''}`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-primary shadow-sm transition-colors duration-200 hover:border-primary hover:bg-primary-dark hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
