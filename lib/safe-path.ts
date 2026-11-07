const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
export function isSafeInternalPath(path: string | null | undefined): path is string {
    if (typeof path !== 'string' || path.length === 0)
        return false;
    if (path[0] !== '/')
        return false;
    if (path.startsWith('//'))
        return false;
    if (path.includes('\\'))
        return false;
    if (CONTROL_CHARS.test(path))
        return false;
    const lower = path.toLowerCase();
    if (lower.includes('%5c'))
        return false;
    if (lower.startsWith('/%2f'))
        return false;
    return true;
}
