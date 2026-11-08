export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
export const AVATAR_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export const AVATAR_HELP_TEXT = 'JPG, PNG, atau WebP · maks 2 MB';
export interface AvatarCandidate {
    name?: unknown;
    type?: unknown;
    size?: unknown;
}
export function avatarFileError(file: AvatarCandidate | null | undefined): string | null {
    if (!file || typeof file !== 'object') {
        return 'Field `file` wajib diisi.';
    }
    const type = typeof file.type === 'string' ? file.type.trim().toLowerCase() : '';
    if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(type)) {
        return 'Format file harus JPG, JPEG, PNG, atau WebP.';
    }
    const size = typeof file.size === 'number' && Number.isFinite(file.size) ? file.size : null;
    if (size === null) {
        return 'Ukuran berkas tidak dapat dibaca.';
    }
    if (size <= 0) {
        return 'Berkas kosong tidak dapat dipakai sebagai foto.';
    }
    if (size > AVATAR_MAX_BYTES) {
        return 'Ukuran file maksimal 2MB.';
    }
    return null;
}
export function avatarExtension(file: AvatarCandidate): string {
    const name = typeof file.name === 'string' ? file.name : '';
    const fromName = name.split('.').pop()?.toLowerCase() ?? '';
    if ((AVATAR_ALLOWED_EXTENSIONS as readonly string[]).includes(fromName)) {
        return fromName === 'jpeg' ? 'jpg' : fromName;
    }
    if (file.type === 'image/png')
        return 'png';
    if (file.type === 'image/webp')
        return 'webp';
    return 'jpg';
}
export function avatarInitials(name?: string | null, email?: string | null): string {
    const nama = typeof name === 'string' ? name.trim() : '';
    if (nama) {
        const huruf = nama
            .split(/\s+/)
            .slice(0, 2)
            .map((bagian) => Array.from(bagian)[0]?.toUpperCase() ?? '')
            .join('');
        if (huruf)
            return huruf;
    }
    const surel = typeof email === 'string' ? email.trim() : '';
    const depan = surel.split('@')[0]?.trim() ?? '';
    return Array.from(depan)[0]?.toUpperCase() ?? 'A';
}
