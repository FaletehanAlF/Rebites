"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertTriangle, ImageIcon, LocateFixed, Store, Trash2 } from "lucide-react";
import { SellerShell } from "@/app/components/dashboard-penjual/SellerShell";
import { Card } from "@/app/components/dashboard-penjual/Card";
import {
  getSellerStoreSettings,
  updateStoreSettings,
  STORE_SETTINGS_UPDATED_EVENT,
} from "@/lib/store-settings-storage";
import { SELLER_STATUS_UPDATED_EVENT } from "@/hooks/use-seller-status";
import { supabase } from "@/lib/supabase";
import { parseCoordinatePairInput } from "@/lib/location-validation";
import { resolveFormCoordinates } from "@/lib/delivery-map-plan";
import {
  requestDeviceLocation,
  type DeviceLocationReason,
} from "@/lib/device-location";

/** Peta pemilih dimuat hanya saat halaman pengaturan dirender (MapLibre berat). */
const LocationPickerMap = dynamic(
  () => import("@/app/components/shared/location-picker-map"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] animate-pulse rounded-xl border border-sage-100 bg-cream-100 sm:h-[260px]" />
    ),
  }
);

function inputClass() {
  return "w-full rounded-xl border border-border bg-white px-3 py-1.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary";
}

export default function PengaturanTokoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [openHours, setOpenHours] = useState("");
  // origin foundation (opsional, NULL untuk data legacy).
  const [postalCode, setPostalCode] = useState("");
  const [storePhone, setStorePhone] = useState("");
  // koordinat toko (GPS/manual, opsional). Kosong = belum diketahui.
  const [storeLatInput, setStoreLatInput] = useState("");
  const [storeLngInput, setStoreLngInput] = useState("");
  const [gpsStatus, setGpsStatus] = useState<
      "idle" | "requesting" | "ok" | DeviceLocationReason
    >("idle");
    const [imageUrl, setImageUrl] = useState("");
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Nilai marker peta: difilter lewat helper yang sama dengan peta Tahap A,
      // sehingga pasangan setengah/tidak sah tidak pernah menjadi marker.
      const storePickerPoint = resolveFormCoordinates(
    storeLatInput,
    storeLngInput,
    parseCoordinatePairInput
  );
      const storePickerLat = storePickerPoint?.latitude ?? null;
      const storePickerLng = storePickerPoint?.longitude ?? null;
    // Koordinat saat halaman dimuat — untuk tombol "Kembalikan".
    const [savedPair, setSavedPair] = useState<{ lat: number | null; lng: number | null }>({
      lat: null,
      lng: null,
    });

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const settings = await getSellerStoreSettings();
      if (cancelled) return;
      setStoreName(settings?.storeName ?? "");
      setDescription(settings?.description ?? "");
      setAddress(settings?.address ?? "");
      setPostalCode(settings?.postalCode ?? "");
      setStorePhone(settings?.phone ?? "");
      setStoreLatInput(
        typeof settings?.latitude === "number" ? String(settings.latitude) : ""
      );
      setStoreLngInput(
        typeof settings?.longitude === "number" ? String(settings.longitude) : ""
      );
      // Simpan koordinat tersimpan untuk tombol "Kembalikan". Membuka halaman
      // ini TIDAK mengubah nilai apa pun.
      setSavedPair({
        lat: typeof settings?.latitude === "number" ? settings.latitude : null,
        lng: typeof settings?.longitude === "number" ? settings.longitude : null,
      });
      setImageUrl(settings?.image ?? "");
      setOpenHours(settings?.openHours ?? "");
      setLoading(false);
    };
    load();
    // Sync jika ada update dari Topbar / tab lain (instant)
    const onStoreUpdated = () => {
      void load();
    };
    window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, onStoreUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, onStoreUpdated);
    };
  }, []);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 2MB.");
      return;
    }
    setError("");
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // isi koordinat dari perangkat (GPS). Ditolak/tidak tersedia ->
  // pengguna tetap bisa mengisi manual (fallback, tanpa nilai karangan).
  async function handleUseDeviceLocation() {
    setGpsStatus("requesting");
    const result = await requestDeviceLocation();
    if (!result.ok) {
      setGpsStatus(result.reason);
      return;
    }
    setStoreLatInput(result.latitude.toFixed(6));
    setStoreLngInput(result.longitude.toFixed(6));
    setGpsStatus("ok");
  }

  async function handleSave() {
    setMessage("");
    setError("");

    if (!storeName.trim()) {
      setError("Nama toko wajib diisi.");
      return;
    }
    if (!openHours.trim()) {
      setError("Jam operasional wajib diisi. Contoh: 09.00–21.00");
      return;
    }
    if (!/^\d{1,2}\.\d{2}\s*[–-]\s*\d{1,2}\.\d{2}$/.test(openHours.trim())) {
      setError("Format jam operasional tidak valid. Contoh: 09.00–21.00");
      return;
    }
    // kode pos opsional; jika diisi harus 5 digit. String kosong = NULL.
    const postalTrimmed = postalCode.trim();
    if (postalTrimmed !== '' && !/^[0-9]{5}$/.test(postalTrimmed)) {
      setError("Kode pos toko harus 5 digit angka (cth. 16424). Kosongkan jika belum tahu.");
      return;
    }
    // telepon toko opsional; jika diisi minimal 9 digit.
    const phoneTrimmed = storePhone.trim();
    if (phoneTrimmed !== '' && !/^[0-9+\-\s]{9,16}$/.test(phoneTrimmed)) {
      setError("Nomor telepon toko tidak valid (9–16 digit). Kosongkan jika belum ada.");
      return;
    }
    // koordinat opsional — dua-duanya atau tidak sama sekali; tidak
    // pernah menyimpan setengah pasangan atau nilai karangan.
    const coordinatePair = parseCoordinatePairInput(storeLatInput, storeLngInput);
    if (!coordinatePair.ok) {
      setError(coordinatePair.error);
      return;
    }

    setSaving(true);
    try {
      let finalImage = imageUrl;
      if (logoFile) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user.id;
        if (!uid) throw new Error("Sesi berakhir. Silakan masuk kembali.");

        const ext = (logoFile.name.split(".").pop() ?? "png").toLowerCase();
        
        const path = `logos/${uid}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("umkm-logos")
          .upload(path, logoFile, {
            contentType: logoFile.type || "image/png",
          });
        if (uploadError) {
          
          throw new Error(
            `Gagal mengunggah logo: ${uploadError.message}`
          );
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("umkm-logos").getPublicUrl(path);
        finalImage = publicUrl;
      }

      const trimmedOpenHours = openHours.trim();
      const ok = await updateStoreSettings({
        storeName: storeName.trim(),
        description: description.trim(),
        address: address.trim(),
        image: finalImage || undefined,
        openHours: trimmedOpenHours,
        // kosong -> NULL (legacy aman).
        postalCode: postalTrimmed === '' ? null : postalTrimmed,
        phone: phoneTrimmed === '' ? null : phoneTrimmed,
        // koordinat toko (NULL = belum diketahui).
        latitude: coordinatePair.latitude,
        longitude: coordinatePair.longitude,
      });
      if (!ok) throw new Error("Gagal menyimpan pengaturan toko.");

      // UI sync: jangan hilangkan data setelah save, tetap tampil di form
      setImageUrl(finalImage);
      setOpenHours(trimmedOpenHours);
      setStoreName(storeName.trim());
      setDescription(description.trim());
      setAddress(address.trim());
      setPostalCode(postalTrimmed);
      setStorePhone(phoneTrimmed);
      setStoreLatInput(
        coordinatePair.latitude === null ? "" : String(coordinatePair.latitude)
      );
      setStoreLngInput(
        coordinatePair.longitude === null ? "" : String(coordinatePair.longitude)
      );
      setLogoFile(null);
      setLogoPreview(null);
      setMessage("Pengaturan toko tersimpan. Perubahan langsung tampil di beranda & Detail Toko.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStore() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user.id;
      if (!uid) throw new Error("Sesi berakhir. Silakan masuk kembali.");

      const { error: delError } = await supabase
        .from("umkm_profiles")
        .delete()
        .eq("user_id", uid);
      if (delError) throw new Error(delError.message);

      window.dispatchEvent(new Event(SELLER_STATUS_UPDATED_EVENT));
      router.replace("/home");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setDeleting(false);
    }
  }

  return (
    <SellerShell>
      <div className="mx-auto max-w-3xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Pengaturan
        </p>
        <h1 className="mt-0.5 font-display text-[clamp(1.5rem,3vw,2rem)] font-medium leading-tight tracking-[-0.02em] text-primary">
          Pengaturan Toko
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Identitas toko ini ditampilkan di marketplace dan halaman Detail Toko.
        </p>

        <Card className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <form
              className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSave();
              }}
              noValidate
            >
              <div>
                <label
                  htmlFor="settings-store-name"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Nama Toko
                </label>
                <input
                  id="settings-store-name"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Nama usaha kamu"
                  className={inputClass()}
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor="settings-description"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Deskripsi Toko
                </label>
                <textarea
                  id="settings-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan tentang usaha kamu..."
                  className={`${inputClass()} resize-none`}
                />
              </div>

              <div>
                <label
                  htmlFor="settings-address"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Alamat Toko
                </label>
                <input
                  id="settings-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. contoh no. 123"
                  className={inputClass()}
                />
              </div>

              <div>
                <label
                  htmlFor="settings-postal-code"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-sage-500"
                >
                  Kode Pos Toko{" "}
                  <span className="normal-case text-charcoal-500/60">(opsional)</span>
                </label>
                <input
                  id="settings-postal-code"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="cth. 16424"
                  inputMode="numeric"
                  maxLength={5}
                  className={inputClass()}
                />
                <p className="mt-1 text-[10px] text-charcoal-500/60">
                  5 digit. Dibutuhkan untuk ongkir ekspedisi nantinya.
                </p>
              </div>

              <div>
                <label
                  htmlFor="settings-phone"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-sage-500"
                >
                  Telepon Toko{" "}
                  <span className="normal-case text-charcoal-500/60">(opsional)</span>
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className={inputClass()}
                />
                <p className="mt-1 text-[10px] text-charcoal-500/60">
                  Untuk kontak kurir pengiriman nantinya.
                </p>
              </div>

              <div className="rounded-xl border border-sage-100 bg-cream-50/60 p-3.5 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">
                    Koordinat Toko{" "}
                    <span className="normal-case text-charcoal-500/60">(opsional)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleUseDeviceLocation()}
                    disabled={gpsStatus === "requesting"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                    {gpsStatus === "requesting" ? "Meminta izin…" : "Gunakan lokasi saat ini"}
                  </button>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-charcoal-500/60">
                  Dipakai untuk simulasi pengiriman dan akurasi ongkir (kurir instan).
                  Gunakan GPS saat berada di lokasi toko, atau isi manual. Kosongkan
                  jika belum tahu — jangan asal isi.
                </p>
                {gpsStatus === "denied" && (
                  <p className="mt-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 ring-1 ring-red-200">
                    Izin lokasi ditolak. Isi koordinat manual di bawah.
                  </p>
                )}
                {gpsStatus === "unavailable" && (
                  <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 ring-1 ring-amber-200">
                    Lokasi perangkat tidak tersedia saat ini. Isi koordinat manual
                    di bawah.
                  </p>
                )}
                {gpsStatus === "ok" && (
                  <p className="mt-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary ring-1 ring-primary/20">
                    Koordinat terisi dari perangkat. Periksa lalu simpan.
                  </p>
                )}
                <div className="mt-2">
                  <LocationPickerMap
                    latitude={storePickerLat}
                    longitude={storePickerLng}
                    initialLatitude={savedPair.lat}
                    initialLongitude={savedPair.lng}
                    onPick={(lat, lng) => {
                      setStoreLatInput(lat.toFixed(6));
                      setStoreLngInput(lng.toFixed(6));
                      setGpsStatus("idle");
                    }}
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="settings-latitude"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-sage-500"
                    >
                      Latitude
                    </label>
                    <input
                      id="settings-latitude"
                      type="text"
                      inputMode="decimal"
                      value={storeLatInput}
                      onChange={(e) => setStoreLatInput(e.target.value)}
                      placeholder="cth. -6.20000"
                      className={inputClass()}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="settings-longitude"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-sage-500"
                    >
                      Longitude
                    </label>
                    <input
                      id="settings-longitude"
                      type="text"
                      inputMode="decimal"
                      value={storeLngInput}
                      onChange={(e) => setStoreLngInput(e.target.value)}
                      placeholder="cth. 106.81667"
                      className={inputClass()}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="settings-open-hours"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Jam Operasional <span className="text-destructive">*</span>
                </label>
                <input
                  id="settings-open-hours"
                  type="text"
                  value={openHours}
                  onChange={(e) => setOpenHours(e.target.value)}
                  placeholder="09.00–21.00"
                  aria-required="true"
                  required
                  className={inputClass()}
                />
                <p className="mt-1 text-[10px] text-muted-foreground/60">
                  Wajib diisi. Contoh: 09.00–21.00
                </p>
              </div>

              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Logo / Foto Toko
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-border bg-secondary">
                    {logoPreview || imageUrl ? (
                      
                      <img
                        src={logoPreview ?? imageUrl}
                        alt="Logo toko"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="rounded-md border border-border bg-secondary px-3 py-1.5 text-[10px] font-medium text-primary transition-colors hover:bg-muted/40"
                    >
                      {logoFile ? "Ganti Logo" : "Pilih Logo"}
                    </button>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                      PNG/JPG, maks 2MB
                    </p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="text-[12px] text-destructive lg:col-span-2">
                  {error}
                </p>
              )}
              {message && (
                <p role="status" className="flex items-center gap-1.5 text-[12px] text-primary lg:col-span-2">
                  <Store className="h-3.5 w-3.5" />
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 lg:col-span-2"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </form>
          )}
        </Card>

        {}
        <Card className="mt-4 border-destructive/25">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-sm font-semibold text-destructive">
                Hapus Toko
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Menghapus toko akan menghilangkan seluruh menu, pesanan,
                ulasan, pengikut, dan langganan yang terhubung dengannya.
                Tindakan ini <strong className="text-destructive">tidak dapat
                dibatalkan</strong>. Akun kamu tetap ada dan bisa mendaftarkan
                toko baru kapan saja.
              </p>

              {deleteError && (
                <p
                  role="alert"
                  className="mt-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
                >
                  {deleteError}
                </p>
              )}

              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError("");
                    setConfirmingDelete(true);
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-md border border-destructive/35 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Toko
                </button>
              ) : (
                <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive/10 p-3">
                  <p className="text-[12px] font-semibold text-destructive">
                    Yakin ingin menghapus toko{" "}
                    {storeName ? `“${storeName}”` : "ini"} secara permanen?
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDeleteStore()}
                      className="inline-flex items-center gap-2 rounded-md bg-destructive px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting ? "Menghapus..." : "Ya, Hapus Permanen"}
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-md border border-destructive/25 bg-white px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </SellerShell>
  );
}
