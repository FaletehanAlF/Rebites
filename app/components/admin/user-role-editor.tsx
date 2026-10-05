'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  AdminUsersApiError,
  updateAdminUserRole,
  type AllowedUserRole,
} from '@/lib/admin-users';

const ROLE_OPTIONS: { value: AllowedUserRole; label: string }[] = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'umkm', label: 'UMKM' },
  { value: 'admin', label: 'Admin' },
];

export function UserRoleEditor({
  userId,
  currentRole,
  onChanged,
}: {
  userId: string | null;
  currentRole: string | null;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<AllowedUserRole>('buyer');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  const dirty = selected !== currentRole;

  const handleSave = async () => {
    if (!userId || saving) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updateAdminUserRole(userId, selected);
      setConfirming(false);
      setFeedback({ kind: 'success', text: `Role berhasil diubah menjadi ${selected}.` });
      onChanged();
    } catch (err) {
      if (err instanceof AdminUsersApiError && err.status === 409) {
        setConfirming(false);
      }
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Gagal mengubah role.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Kelola Role
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-sage-500">Role saat ini:</span>
          <Badge variant="secondary" className="font-bold">
            {currentRole ?? '-'}
          </Badge>
        </div>
        <div>
          <label
            htmlFor="role-select"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-900"
          >
            Role baru
          </label>
          <select
            id="role-select"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value as AllowedUserRole);
              setConfirming(false);
              setFeedback(null);
            }}
            className="w-full appearance-none rounded-xl border border-sage-100 bg-white px-4 py-3 text-sm text-charcoal-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-sage-500">
            Perubahan role tidak memengaruhi kepemilikan toko pengguna.
          </p>
        </div>

        {feedback && (
          <p
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className={
              feedback.kind === 'error'
                ? 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600'
                : 'flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700'
            }
          >
            {feedback.kind === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {feedback.text}
          </p>
        )}

        <div>
          <Button
            type="button"
            size="sm"
            disabled={!userId || saving || (!dirty && !confirming)}
            onClick={() => void handleSave()}
          >
            {saving ? 'Menyimpan...' : confirming ? 'Klik untuk konfirmasi' : 'Simpan Role'}
          </Button>
          {confirming && !saving && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
          )}
          {confirming && !saving && (
            <p className="mt-2 text-[11px] font-medium text-caramel">
              Ubah role menjadi “{selected}”? Tindakan ini dicatat di riwayat.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
