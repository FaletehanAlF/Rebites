/**
 * Penentuan base URL aplikasi untuk redirect pembayaran.
 *
 * Modul ini sengaja TANPA dependensi (tidak mengimpor Supabase/Next) supaya
 * aturannya dapat diuji langsung dengan `node --test`.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export interface SiteUrlInput {
  /** Nilai NEXT_PUBLIC_SITE_URL apa adanya (boleh kosong). */
  configuredUrl: string | null | undefined;
  /** Origin request yang sedang diproses, mis. "http://localhost:3000". */
  requestOrigin: string | null;
  isProduction: boolean;
}

export interface SiteUrlResult {
  url: string;
  /**
   * true bila konfigurasi sengaja diabaikan karena menunjuk host lokal dengan
   * port berbeda dari server yang sedang melayani request.
   */
  replacedConfiguredPort: boolean;
  /** true bila tidak ada NEXT_PUBLIC_SITE_URL sama sekali di production. */
  missingInProduction: boolean;
}

function normalize(url: string | null | undefined): string | null {
  const trimmed = url?.trim().replace(/\/$/, '');
  return trimmed ? trimmed : null;
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function portOf(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    return parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  } catch {
    return null;
  }
}

/**
 * Production selalu memakai NEXT_PUBLIC_SITE_URL: origin request berasal dari
 * Host header yang dapat dipalsukan, dan memakainya untuk URL pembayaran
 * berarti membuka jalur open redirect.
 *
 * Di luar production, konfigurasi yang menunjuk host lokal dengan port
 * berbeda diabaikan demi origin request. Ini kasus yang sangat mudah terjadi:
 * port `next dev` berubah, sementara NEXT_PUBLIC_SITE_URL masih menyimpan port
 * lama — browser lalu diarahkan ke port mati dan menampilkan
 * ERR_CONNECTION_REFUSED tepat setelah pembayaran berhasil.
 */
export function resolveSiteUrl({
  configuredUrl,
  requestOrigin,
  isProduction,
}: SiteUrlInput): SiteUrlResult {
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

/** Origin request dari objek Request (URL + Host header). */
export function requestOriginFrom(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const host = req.headers.get('host') ?? url.host;
    if (!host) return null;
    const protocol = url.protocol.replace(':', '') || 'http';
    return `${protocol}://${host}`;
  } catch {
    return null;
  }
}
