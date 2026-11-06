const SENSITIVE_KEY = /password|token|secret|authorization|cookie|api[_-]?key|session|private[_-]?key|credential/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? '[masked]' : sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Sanitasi + pretty-print metadata JSONB agar aman ditampilkan di UI. */
export function formatMetadataSafe(metadata: unknown): string {
  try {
    return JSON.stringify(sanitizeValue(metadata ?? {}, 0), null, 2);
  } catch {
    return '{}';
  }
}
