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
export function SmartImage({ src, alt, className, sizes, priority, }: SmartImageProps) {
    const [failed, setFailed] = useState(false);
    const resolved = resolveImageSrc(src);
    if (!resolved || failed) {
        return (<div className={cn('flex h-full w-full items-center justify-center bg-muted', className)}>
        <Leaf className="h-12 w-12 text-primary/35" strokeWidth={1.25}/>
      </div>);
    }
    return (<Image src={src} alt={alt} fill sizes={sizes ?? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'} priority={priority} onError={() => setFailed(true)} className={cn('object-cover', className)}/>);
}
