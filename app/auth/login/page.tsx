import type { Metadata } from "next";
import AuthSplitShell from "@/app/components/auth/auth-split-shell";
import AuthForm from "@/app/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Masuk — ReBites",
  description:
    "Masuk ke akun ReBites untuk mengakses dasbor kurasi marketplace kuliner surplus.",
};

export default function LoginPage() {
  return (
    <AuthSplitShell
      imageSrc="/hero-makanan.avif"
      imageAlt="Makanan surplus ReBites"
      variant="buyer"
      overlayText={{
        headline: "Selamatkan Pangan.",
        description:
          "Masuk untuk menemukan makanan surplus enak dengan harga miring. Hemat, enak, berkelanjutan.",
      }}
    >
      <AuthForm
        mode="signin"
        title="Selamat Datang Kembali"
        subtitle="Masukkan kredensial Anda untuk melanjutkan."
        submitLabel="Masuk"
        redirectTo="/home"
        bottomHint={{
          text: "Belum punya akun?",
          linkText: "Daftar di sini",
          href: "/auth/register",
        }}
      />
    </AuthSplitShell>
  );
}
