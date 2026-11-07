export const ARTICLE_COVERS_BUCKET = 'article-images';
export const COVER_IMAGE_ERROR = 'Cover image harus menggunakan gambar yang di-upload melalui ReBites. URL gambar dari website lain tidak diperbolehkan.';
export function isArticleCoverUrl(value: unknown, supabaseUrl: string | undefined | null): boolean {
    if (value === undefined || value === null)
        return true;
    if (typeof value !== 'string')
        return false;
    const url = value.trim();
    if (!url)
        return true;
    const base = (supabaseUrl ?? '').trim().replace(/\/+$/, '');
    if (!base)
        return false;
    const prefix = `${base}/storage/v1/object/public/${ARTICLE_COVERS_BUCKET}/`;
    return url.startsWith(prefix) && url.length > prefix.length;
}
