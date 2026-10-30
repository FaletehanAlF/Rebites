import type { Metadata } from "next";
import AuthCenteredShell from "@/app/components/auth/auth-centered-shell";
import PenjualLoginForm from "@/app/components/auth/penjual-login-form";

export const metadata: Metadata = {
  title: "Masuk Penjual - ReBites",
  description:
    "Masuk sebagai penjual ReBites dengan email, nama toko, dan password untuk mengelola dashboard toko.",
};

export default function PenjualLoginPage() {
  return (
    <AuthCenteredShell
      imageSrc="/penjual-login.avif"
      variant="seller"
      title={
        <>
          Rasa enak,
          <br />
          dampak baik.
        </>
      }
      description="Kelola toko surplus Anda. Masuk untuk memantau pesanan, stok, dan laporan penjualan."
    >
      <PenjualLoginForm />
    </AuthCenteredShell>
  );
}
