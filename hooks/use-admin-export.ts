'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { downloadAdminExport, isAbortError } from '@/lib/admin-export';
import { redirectIfSessionExpired } from '@/app/components/admin/admin-session';
export interface AdminExportFeedback {
    tone: 'success' | 'info' | 'error';
    message: string;
}
export interface UseAdminExportOptions {
    url: string;
    noun: string;
}
export interface UseAdminExportResult {
    exporting: boolean;
    feedback: AdminExportFeedback | null;
    startExport: () => void;
}
export function useAdminExport({ url, noun, }: UseAdminExportOptions): UseAdminExportResult {
    const router = useRouter();
    const abortRef = useRef<AbortController | null>(null);
    const [exporting, setExporting] = useState(false);
    const [feedback, setFeedback] = useState<AdminExportFeedback | null>(null);
    useEffect(() => {
        const controller = abortRef.current;
        if (!controller) {
            setFeedback(null);
            return;
        }
        abortRef.current = null;
        controller.abort();
        setFeedback({
            tone: 'info',
            message: 'Ekspor dibatalkan karena filter berubah. Jalankan ekspor lagi untuk filter terbaru.',
        });
    }, [url]);
    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);
    const startExport = useCallback(() => {
        void (async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            setExporting(true);
            setFeedback(null);
            try {
                const result = await downloadAdminExport({ url, signal: controller.signal, fallbackMessage: `Gagal membuat ekspor ${noun}.` });
                if (abortRef.current === controller)
                    abortRef.current = null;
                if (controller.signal.aborted)
                    return;
                if (!result.downloaded) {
                    setFeedback({
                        tone: 'info',
                        message: `Tidak ada ${noun} yang cocok dengan filter saat ini. Berkas Excel tidak dibuat.`,
                    });
                    return;
                }
                setFeedback({
                    tone: 'success',
                    message: result.rows > 0
                        ? `${result.rows.toLocaleString('id-ID')} ${noun} diunduh sebagai Excel.`
                        : 'Berkas Excel berhasil diunduh.',
                });
            }
            catch (err) {
                if (isAbortError(err))
                    return;
                const handled = await redirectIfSessionExpired((err as {
                    status?: number;
                })?.status ?? 0, router, () => setFeedback({ tone: 'error', message: 'Tidak dapat menghubungi server data. Coba lagi.' }));
                if (handled)
                    return;
                if ((err as {
                    status?: number;
                })?.status === 403) {
                    setFeedback({ tone: 'error', message: `Ekspor ${noun} hanya untuk admin.` });
                    return;
                }
                setFeedback({
                    tone: 'error',
                    message: err instanceof Error ? err.message : `Gagal membuat ekspor ${noun}.`,
                });
            }
            finally {
                if (abortRef.current === controller)
                    abortRef.current = null;
                setExporting(false);
            }
        })();
    }, [noun, router, url]);
    return { exporting, feedback, startExport };
}
