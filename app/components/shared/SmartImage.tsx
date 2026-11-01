'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveImageSrc } from '@/lib/image-path';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function SmartImage({
  src,
  alt,
  className,
  sizes,
  priority,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  // Titik penyesuaian untuk path lama dari database. `products.image_url` masih
  // menyimpan nama JPG/WebP lama, sedangkan berkasnya kini AVIF; tanpa baris
  // ini setiap produk hasil seed akan tampil sebagai gambar rusak.
  const resolved = resolveImageSrc(src);

  if (!resolved || failed) {
    // Permukaan datar, bukan gradient: gradient pada bidang besar menambah
    // lapisan komposit saat digulir dan tidak menambah informasi apa pun.
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-muted',
          className
        )}
      >
        <Leaf className="h-12 w-12 text-primary/35" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      // Without sizes, fill images imply 100vw and the browser downloads the
      // largest srcset variant even for thumbnails. The default matches the
      // responsive grids this component is used in.
      sizes={sizes ?? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}
