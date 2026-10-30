import type { Metadata } from "next";
import AuthCenteredShell from "@/app/components/auth/auth-centered-shell";
import BuatSandiBaruForm from "@/app/components/auth/buat-sandi-baru-form";

export const metadata: Metadata = {
  title: "Buat Kata Sandi Baru - ReBites",
  description:
    "Tentukan kata sandi baru untuk akun ReBites Anda dan lanjutkan misi menyelamatkan makanan surplus.",
};

export default function BuatSandiBaruPage() {
  return (
    <AuthCenteredShell
      imageSrc="/hero-makanan.avif"
      variant="buyer"
      title={
        <>
          Buat Kata
          <br />
          Sandi Baru
        </>
      }
      description="Tautan reset kamu sudah terverifikasi. Buat kata sandi baru agar akun ReBites-mu kembali aman dan siap dipakai."
    >
      <BuatSandiBaruForm />
    </AuthCenteredShell>
  );
}
