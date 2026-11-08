const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
export interface SiteUrlInput {
    configuredUrl: string | null | undefined;
    requestOrigin: string | null;
    isProduction: boolean;
}
export interface SiteUrlResult {
    url: string;
    replacedConfiguredPort: boolean;
    missingInProduction: boolean;
}
function normalize(url: string | null | undefined): string | null {
    const trimmed = url?.trim().replace(/\/$/, '');
    return trimmed ? trimmed : null;
}
function hostOf(origin: string): string | null {
    try {
        return new URL(origin).hostname.toLowerCase();
    }
    catch {
        return null;
    }
}
function portOf(origin: string): string | null {
    try {
        const parsed = new URL(origin);
        return parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    }
    catch {
        return null;
    }
}
export function resolveSiteUrl({ configuredUrl, requestOrigin, isProduction, }: SiteUrlInput): SiteUrlResult {
    const configured = normalize(configuredUrl);
    if (isProduction) {
        return {
            url: configured ?? 'http://localhost:3000',
            replacedConfiguredPort: false,
            missingInProduction: configured === null,
        };
    }
    const origin = requestOrigin ? normalize(requestOrigin) : null;
    if (!configured) {
        return {
            url: origin ?? 'http://localhost:3000',
            replacedConfiguredPort: false,
            missingInProduction: false,
        };
    }
    if (!origin) {
        return { url: configured, replacedConfiguredPort: false, missingInProduction: false };
    }
    const configuredHost = hostOf(configured);
    const originHost = hostOf(origin);
    if (!configuredHost || !originHost) {
        return { url: configured, replacedConfiguredPort: false, missingInProduction: false };
    }
    const bothLocal = LOCAL_HOSTS.has(configuredHost) && LOCAL_HOSTS.has(originHost);
    if (bothLocal && portOf(configured) !== portOf(origin)) {
        return { url: origin, replacedConfiguredPort: true, missingInProduction: false };
    }
    return { url: configured, replacedConfiguredPort: false, missingInProduction: false };
}
export function requestOriginFrom(req: Request): string | null {
    try {
        const url = new URL(req.url);
        const host = req.headers.get('host') ?? url.host;
        if (!host)
            return null;
        const protocol = url.protocol.replace(':', '') || 'http';
        return `${protocol}://${host}`;
    }
    catch {
        return null;
    }
}
