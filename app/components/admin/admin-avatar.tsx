'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { avatarInitials } from '@/lib/admin-avatar';
import { cn } from '@/lib/utils';
const UKURAN = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-24 w-24',
} as const;
const UKURAN_HURUF = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-3xl',
} as const;
export type AdminAvatarSize = keyof typeof UKURAN;
export function AdminAvatar({ src, name, email, size = 'md', className, }: {
    src?: string | null;
    name?: string | null;
    email?: string | null;
    size?: AdminAvatarSize;
    className?: string;
}) {
    return (<Avatar className={cn(UKURAN[size], 'ring-1 ring-black/5', className)}>
      {src ? (<AvatarImage src={src} alt="" referrerPolicy="no-referrer"/>) : null}
      <AvatarFallback aria-hidden className={cn('bg-primary/10 font-display font-bold text-primary', UKURAN_HURUF[size])}>
        {avatarInitials(name, email)}
      </AvatarFallback>
    </Avatar>);
}
