import type { Metadata } from "next";
import AuthCenteredShell from "@/app/components/auth/auth-centered-shell";
import AuthForm from "@/app/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Masuk - ReBites",
  description:
    "Masuk ke akun ReBites untuk mengakses dasbor kurasi marketplace kuliner surplus.",
};

export default function LoginPage() {
  return (
    <AuthCenteredShell
      imageSrc="/hero-makanan.avif"
      variant="buyer"
      title={
        <>
          Selamatkan
          <br />
          Pangan.
        </>
      }
      description="Masuk untuk temukan makanan surplus enak dengan harga miring. Hemat enak, selamatkan bumi."
    >
      <AuthForm
        mode="signin"
        title={
          <>
            Selamat Datang
            <br />
            Kembali
          </>
        }
        subtitle="Masukkan kredensial Anda untuk melanjutkan."
        submitLabel="Masuk"
        redirectTo="/home"
        bottomHint={{
          text: "Belum punya akun?",
          linkText: "Daftar di sini",
          href: "/auth/register",
        }}
      />
    </AuthCenteredShell>
  );
}
