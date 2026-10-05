
const XENDIT_API_BASE = 'https://api.xendit.co';

export interface CreateInvoiceParams {
  externalId: string;
  amount: number;
  payerEmail: string | null;
  description: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  customerName?: string;
}

export interface XenditInvoice {
  id: string;
  external_id: string;
  amount: number;
  status: string;
  invoice_url: string;
  expiry_date: string;
}

function getSecretKey(): string {
  const raw = process.env.XENDIT_SECRET_KEY?.trim();
  if (!raw) throw new Error('Missing env: XENDIT_SECRET_KEY');
  return raw;
}

export function getCallbackToken(): string | null {
  const raw =
    process.env.XENDIT_CALLBACK_TOKEN?.trim() ||
    process.env.XENDIT_WEBHOOK_TOKEN?.trim() ||
    null;
  return raw || null;
}

export async function createXenditInvoice(
  params: CreateInvoiceParams
): Promise<XenditInvoice> {
  const secret = getSecretKey();
  
  const auth = Buffer.from(`${secret}:`).toString('base64');

  const body: Record<string, unknown> = {
    external_id: params.externalId,
    amount: params.amount,
    description: params.description,
    currency: 'IDR',
    
    invoice_duration: 3600,
    success_redirect_url: params.successRedirectUrl,
    failure_redirect_url: params.failureRedirectUrl,
  };

  if (params.payerEmail) {
    body.payer_email = params.payerEmail;
  }
  if (params.customerName) {
    body.customer = { given_names: params.customerName };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${XENDIT_API_BASE}/v2/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('Xendit timeout (10s) - coba lagi');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      (json as { message?: string })?.message ??
      (json as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message ??
      (json as { error_code?: string })?.error_code ??
      `Xendit error ${res.status}`;
    // Production-safe: jangan log body (berisi payer_email/PII) —
    // cukup external_id + status + pesan.
    console.error('[xendit] create invoice failed', {
      status: res.status,
      external_id: params.externalId,
      message: msg,
    });
    throw new Error(msg);
  }

  console.log('[xendit] invoice created', {
    external_id: params.externalId,
    amount: params.amount,
    invoice_url: (json as XenditInvoice).invoice_url,
  });

  return json as XenditInvoice;
}

export async function getXenditInvoice(
  invoiceId: string
): Promise<XenditInvoice & { payment_method?: string; payment_channel?: string }> {
  const secret = getSecretKey();
  const auth = Buffer.from(`${secret}:`).toString('base64');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${XENDIT_API_BASE}/v2/invoices/${encodeURIComponent(invoiceId)}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('Xendit timeout (10s) - coba lagi');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json as { message?: string })?.message ??
      `Xendit error ${res.status}`;
    throw new Error(msg);
  }
  return json as XenditInvoice & { payment_method?: string; payment_channel?: string };
}
