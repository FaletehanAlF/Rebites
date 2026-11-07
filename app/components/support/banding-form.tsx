'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, Copy, Loader2, ShieldQuestion } from 'lucide-react';
import { SUPPORT_MESSAGE_MAX, formatAppealCode, isValidSupportEmail, } from '@/lib/support';
export const BANDING_CODE_STORAGE_KEY = 'rebites-banding-code';
interface AppealApiError {
    error?: string;
}
export function BandingForm() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [code, setCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [copyNote, setCopyNote] = useState('');
    const copyTimer = useRef<number | null>(null);
    useEffect(() => {
        return () => {
            if (copyTimer.current !== null)
                window.clearTimeout(copyTimer.current);
        };
    }, []);
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting)
            return;
        setError('');
        const emailTrim = email.trim();
        const messageTrim = message.trim();
        if (!isValidSupportEmail(emailTrim)) {
            setError('Tulis alamat email akunmu dengan lengkap, mis. nama@email.com.');
            return;
        }
        if (!messageTrim) {
            setError('Ceritakan dulu alasan bandingmu.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/support/appeal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailTrim, message: messageTrim }),
            });
            const json = (await res.json().catch(() => null)) as (AppealApiError & {
                code?: string;
            }) | null;
            if (!res.ok || !json?.code) {
                setError(json?.error ??
                    'Banding belum bisa dikirim sekarang. Coba lagi beberapa menit lagi.');
                return;
            }
            const received = json.code;
            try {
                window.sessionStorage.setItem(BANDING_CODE_STORAGE_KEY, received);
            }
            catch {
            }
            setCode(received);
        }
        catch {
            setError('Tidak dapat menghubungi server ReBites. Periksa koneksimu, lalu coba lagi.');
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleCopy = async () => {
        if (!code)
            return;
        try {
            await navigator.clipboard.writeText(code);
            setCopyNote('');
            setCopied(true);
            if (copyTimer.current !== null)
                window.clearTimeout(copyTimer.current);
            copyTimer.current = window.setTimeout(() => setCopied(false), 2500);
        }
        catch {
            setCopied(false);
            setCopyNote('Peramban menolak menyalin otomatis. Salin manual kode di atas.');
        }
    };
    if (code) {
        return (<div className="rounded-2xl border border-success/30 bg-success/[0.06] p-6 sm:p-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-success/15">
          <Check aria-hidden className="h-5 w-5 text-success"/>
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-charcoal-900">
          Banding terkirim
        </h1>
        <p className="mt-2 max-w-prose font-sans text-[15px] leading-relaxed text-charcoal-700">
          Admin ReBites akan meninjau bandingmu. Simpan kode di bawah — kode ini
          satu-satunya cara memeriksa status banding dan mengirim keterangan
          tambahan.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white px-5 py-4">
          <p className="font-display text-xl font-bold tracking-[0.08em] text-primary tabular-nums sm:text-2xl" aria-label="Kode banding">
            {formatAppealCode(code)}
          </p>
          <button type="button" onClick={() => void handleCopy()} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3.5 font-sans text-[12px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {copied ? (<Check aria-hidden className="h-3.5 w-3.5"/>) : (<Copy aria-hidden className="h-3.5 w-3.5"/>)}
            {copied ? 'Tersalin' : 'Salin kode'}
          </button>
        </div>
        {copyNote && (<p role="status" className="mt-2 font-sans text-[12px] leading-relaxed text-warning-strong">
            {copyNote}
          </p>)}

        <p className="mt-3 flex items-start gap-2 font-sans text-[13px] leading-relaxed text-charcoal-700">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong"/>
          Kode hanya ditampilkan sekali di layar ini. Bila kode hilang, kirim
          banding baru — kode lama tidak dapat dikembalikan.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/banding/status" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Cek status banding
            <ArrowRight aria-hidden className="h-4 w-4"/>
          </Link>
          <Link href="/auth/login" className="font-sans text-[13px] font-semibold text-primary underline underline-offset-4">
            Kembali ke halaman masuk
          </Link>
        </div>
      </div>);
    }
    return (<div>
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-3.5 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
        <ShieldQuestion aria-hidden className="h-3.5 w-3.5"/>
        Banding akun
      </span>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
        Tidak bisa masuk karena akun diblokir?
      </h1>
      <p className="mt-3 max-w-prose font-sans text-[15px] leading-relaxed text-muted-foreground">
        Ceritakan dari sini. Banding dikirim ke admin ReBites lewat jalur resmi,
        tanpa perlu bisa login — dan kamu akan menerima kode untuk memantau
        statusnya.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="banding-email" className="block font-sans text-sm font-semibold text-charcoal-900">
            Email akun yang diblokir
          </label>
          <input id="banding-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value.slice(0, 254))} placeholder="nama@email.com" className="mt-1.5 h-11 w-full rounded-lg border border-border bg-white px-3.5 font-sans text-[15px] text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"/>
          <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
            Pakai email yang sama dengan akunmu agar banding tersambung ke akun
            yang benar.
          </p>
        </div>

        <div>
          <label htmlFor="banding-message" className="block font-sans text-sm font-semibold text-charcoal-900">
            Alasan banding
          </label>
          <textarea id="banding-message" value={message} onChange={(event) => setMessage(event.target.value.slice(0, SUPPORT_MESSAGE_MAX))} rows={6} maxLength={SUPPORT_MESSAGE_MAX} placeholder="Jelaskan kenapa kamu merasa blokir ini keliru, dan sertakan keterangan yang bisa membantu admin memeriksa." className="mt-1.5 w-full rounded-lg border border-border bg-white px-3.5 py-3 font-sans text-[15px] leading-relaxed text-foreground outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"/>
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            {message.trim().length}/{SUPPORT_MESSAGE_MAX} karakter
          </p>
        </div>

        {error && (<p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 font-sans text-[13px] leading-relaxed text-destructive">
            {error}
          </p>)}

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={submitting} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 font-sans text-[13px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-70">
            {submitting ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : null}
            {submitting ? 'Mengirim…' : 'Kirim banding'}
          </button>
          <Link href="/banding/status" className="font-sans text-[13px] font-semibold text-primary underline underline-offset-4">
            Sudah punya kode banding?
          </Link>
        </div>
      </form>
    </div>);
}
