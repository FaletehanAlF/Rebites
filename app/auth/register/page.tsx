import type { Metadata } from "next";
import AuthCenteredShell from "@/app/components/auth/auth-centered-shell";
import AuthForm from "@/app/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Daftar - ReBites",
  description:
    "Buat akun untuk bergabung dengan marketplace kuliner surplus ReBites.",
};

export default function RegisterPage() {
  return (
    <AuthCenteredShell
      imageSrc="/hero-makanan.avif"
      variant="buyer"
      title={
        <>
          Gabung, Temukan
          <br />
          Kejutan Surplus.
        </>
      }
      description="Buat akun dan mulai berburu kuliner surplus favoritmu. Hemat, enak, berkelanjutan."
    >
      <AuthForm
        mode="signup"
        title={
          <>
            Buat Akun
            <br />
            Baru
          </>
        }
        subtitle="Daftar untuk bergabung dengan marketplace kami."
        submitLabel="Buat Akun"
        redirectTo="/home"
        bottomHint={{
          text: "Sudah punya akun?",
          linkText: "Masuk",
          href: "/auth/login",
        }}
      />
    </AuthCenteredShell>
  );
}
