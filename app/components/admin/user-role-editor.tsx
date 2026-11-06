'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { AdminSelect } from './admin-controls';
import { labelPeran } from './admin-format';
import { useAdminMe } from '@/hooks/use-admin-me';
import {
  AdminUsersApiError,
  updateAdminUserRole,
  type AllowedUserRole,
} from '@/lib/admin-users';
import { RoleRequestsApiError, createRoleRequest } from '@/lib/role-requests';

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Pilih peran' },
  { value: 'buyer', label: 'Pembeli' },
  { value: 'umkm', label: 'UMKM' },
  { value: 'admin', label: 'Admin' },
];

type RoleSelection = AllowedUserRole | '';

function normalisasiPeran(role: string | null): RoleSelection {
  return role === 'buyer' || role === 'umkm' || role === 'admin' ? role : '';
}

const REASON_MAX = 500;

/**
 * Editor peran dengan gating izin (Super Admin Approval System):
 * - Super Admin (env SUPER_ADMIN_USER_ID): kontrol perubahan langsung.
 * - Admin tim: form AJUKAN PERMINTAAN yang diputuskan Super Admin lewat
 *   halaman Permintaan Role; tidak ada kontrol yang mengubah role langsung.
 * - Akun Super Admin: read-only (dilindungi, anti-lockout).
 * - Target ber-peran admin: admin tim tidak dapat mengajukan (read-only).
 * Otorisasi sebenarnya tetap di server
 * (PATCH /api/admin/users/:id/role dan POST /api/admin/role-requests).
 */
export function UserRoleEditor({
  userId,
  currentRole,
  targetIsSuperAdmin = false,
  onChanged,
}: {
  userId: string | null;
  currentRole: string | null;
  targetIsSuperAdmin?: boolean;
  onChanged: () => void;
}) {
  const {
    loading: accessLoading,
    me,
    status: accessStatus,
    errorMessage: accessError,
    retry: retryAccess,
  } = useAdminMe();
  // Jangan pernah mengawali pilihan dengan peran lain. Sebelumnya nilai awal
  // selalu 'buyer', sehingga membuka pengguna UMKM/admin membuat form terlihat
  // berubah dan menekan Simpan tanpa mengubah apa pun bisa menurunkan peran.
  const [selected, setSelected] = useState<RoleSelection>(() =>
    normalisasiPeran(currentRole)
  );
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );
  // State form permintaan (admin tim).
  const [reason, setReason] = useState('');
  const [requestConfirming, setRequestConfirming] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);

  useEffect(() => {
    setSelected(normalisasiPeran(currentRole));
    setConfirming(false);
    setRequestConfirming(false);
  }, [currentRole, userId]);

  useEffect(() => {
    setFeedback(null);
    setReason('');
  }, [userId]);

  const viewerIsSuperAdmin = me?.isSuperAdmin === true;
  const dirty = selected !== '' && selected !== currentRole;

  const handleSave = async () => {
    if (!userId || !selected || saving) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateAdminUserRole(userId, selected);
      setConfirming(false);
      setFeedback({
        kind: 'success',
        text: `Peran berhasil diubah menjadi ${labelPeran(selected)}.`,
      });
      onChanged();
    } catch (err) {
      if (err instanceof AdminUsersApiError && err.status === 409) {
        setConfirming(false);
      }
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah peran.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRequest = async () => {
    if (!userId || !selected || requestSaving) return;
    if (!requestConfirming) {
      setRequestConfirming(true);
      return;
    }
    setRequestSaving(true);
    setFeedback(null);
    try {
      await createRoleRequest(userId, selected, reason.trim());
      setRequestConfirming(false);
      setReason('');
      setFeedback({
        kind: 'success',
        text: `Permintaan perubahan ke ${labelPeran(selected)} terkirim. Super Admin akan meninjau permintaan ini.`,
      });
      onChanged();
    } catch (err) {
      if (err instanceof RoleRequestsApiError && err.status === 409) {
        setRequestConfirming(false);
      }
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengirim permintaan.',
      });
    } finally {
      setRequestSaving(false);
    }
  };

  // Penentuan mode kontrol (server tetap penentu akhir).
  const accessFailed = accessStatus === 'error';
  let restrictedNote: string | null = null;
  let showDirectControl = false;
  let showRequestForm = false;
  if (!accessLoading) {
    if (targetIsSuperAdmin) {
      restrictedNote =
        'Akun ini adalah Super Admin. Perannya tidak dapat diubah atau didemosi.';
    } else if (accessFailed) {
      // Pemeriksaan GAGAL — bukan "bukan admin". Blok error + retry dirender
      // terpisah; jangan tampilkan penolakan hak akses yang menyesatkan.
      restrictedNote = null;
    } else if (!me) {
      restrictedNote = 'Perubahan peran hanya dapat dilakukan oleh admin.';
    } else if (viewerIsSuperAdmin) {
      showDirectControl = true;
    } else if (me.superAdminConfigured === false) {
      restrictedNote =
        'Pengajuan belum aktif: Super Admin belum dikonfigurasi (SUPER_ADMIN_USER_ID) di server.';
    } else if (currentRole === 'admin') {
      restrictedNote =
        'Perubahan peran akun admin hanya dapat dilakukan Super Admin secara langsung.';
    } else {
      showRequestForm = true;
    }
  }

  const feedbackBlock = feedback ? (
    <p
      role={feedback.kind === 'error' ? 'alert' : 'status'}
      className={
        feedback.kind === 'error'
          ? 'rounded-[var(--radius)] border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive'
          : 'flex items-center gap-1.5 rounded-[var(--radius)] border border-success/25 bg-success/5 px-4 py-3 text-sm font-medium text-success'
      }
    >
      {feedback.kind === 'success' && (
        <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
      )}
      {feedback.text}
    </p>
  ) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert aria-hidden className="h-4 w-4 text-primary" />
          Kelola peran
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-sage-500">Peran saat ini:</span>
          <Badge variant="secondary" className="font-bold">
            {labelPeran(currentRole)}
          </Badge>
          {targetIsSuperAdmin && (
            <Badge variant="warning" className="font-bold">
              Super Admin
            </Badge>
          )}
        </div>

        {accessLoading ? (
          <p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
            Memeriksa izin…
          </p>
        ) : accessFailed && !targetIsSuperAdmin ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-warning/25 bg-warning/5 px-4 py-3 text-sm font-medium text-charcoal-700"
          >
            <span className="min-w-0 flex-1">
              {accessError} Status Super Admin belum dapat dipastikan, jadi kontrol
              perubahan peran disembunyikan.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={retryAccess}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5" />
              Coba lagi
            </Button>
          </div>
        ) : restrictedNote ? (
          <p className="rounded-[var(--radius)] border border-border bg-cream-50 px-4 py-3 text-sm font-medium text-charcoal-700">
            {restrictedNote}
          </p>
        ) : showDirectControl ? (
          <>
            <div>
              {/* Label ditampilkan oleh AdminSelect sendiri (label di atas kontrol),
                  jadi tidak ada label ganda di sini. */}
              <AdminSelect
                value={selected}
                label="Peran baru"
                options={ROLE_OPTIONS}
                className="sm:w-full"
                onChange={(value) => {
                  setSelected(value as RoleSelection);
                  setConfirming(false);
                  setFeedback(null);
                }}
              />
              <p className="mt-1.5 text-xs text-sage-500">
                Perubahan peran tidak memengaruhi kepemilikan toko pengguna.
              </p>
            </div>

            {feedbackBlock}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={!userId || !selected || saving || (!dirty && !confirming)}
                  onClick={() => void handleSave()}
                >
                  {saving
                    ? 'Menyimpan…'
                    : confirming
                      ? 'Klik untuk konfirmasi'
                      : 'Simpan peran'}
                </Button>
                {confirming && !saving && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                  >
                    Batal
                  </Button>
                )}
              </div>
              {confirming && !saving && (
                <p className="mt-2 text-xs font-medium text-warning-strong">
                  Ubah peran menjadi “{labelPeran(selected)}”? Tindakan ini dicatat di riwayat.
                </p>
              )}
            </div>
          </>
        ) : showRequestForm ? (
          <>
            <div>
              <AdminSelect
                value={selected}
                label="Peran yang diminta"
                options={ROLE_OPTIONS}
                className="sm:w-full"
                onChange={(value) => {
                  setSelected(value as RoleSelection);
                  setRequestConfirming(false);
                  setFeedback(null);
                }}
              />
              <p className="mt-1.5 text-xs text-sage-500">
                Perubahan peran tidak memengaruhi kepemilikan toko pengguna.
              </p>
            </div>

            <div>
              <Textarea
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value.slice(0, REASON_MAX));
                  setRequestConfirming(false);
                }}
                placeholder="Alasan permintaan (opsional)…"
                aria-label="Alasan permintaan"
                maxLength={REASON_MAX}
                disabled={requestSaving}
                className="min-h-[80px] rounded-[var(--radius)] border-border bg-white text-sm"
              />
              <p className="mt-1 text-xs text-sage-500">
                {reason.length}/{REASON_MAX} karakter
              </p>
            </div>

            {feedbackBlock}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={!userId || !selected || requestSaving || !dirty}
                  onClick={() => void handleRequest()}
                >
                  <Send aria-hidden className="h-4 w-4" />
                  {requestSaving
                    ? 'Mengirim…'
                    : requestConfirming
                      ? 'Klik untuk konfirmasi'
                      : 'Ajukan permintaan'}
                </Button>
                {requestConfirming && !requestSaving && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRequestConfirming(false)}
                  >
                    Batal
                  </Button>
                )}
              </div>
              {requestConfirming && !requestSaving && (
                <p className="mt-2 text-xs font-medium text-warning-strong">
                  Ajukan perubahan ke “{labelPeran(selected)}”? Permintaan akan diputuskan
                  Super Admin.
                </p>
              )}
            </div>

            <p className="text-xs text-sage-500">
              Status permintaan dapat dilihat di{' '}
              <Link
                href="/dashboard/admin/permintaan-role"
                className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                Permintaan Role
              </Link>
              .
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
