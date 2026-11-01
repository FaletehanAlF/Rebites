import type { Metadata } from "next";
import AuthCenteredShell from "@/app/components/auth/auth-centered-shell";
import ForgotPasswordForm from "@/app/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Lupa Kata Sandi - ReBites",
  description:
    "Atur ulang kata sandi akun ReBites Anda untuk kembali ke marketplace kuliner surplus.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCenteredShell
      imageSrc="/hero-makanan.avif"
      variant="buyer"
      title={
        <>
          Lupa Kata
          <br />
          Sandi?
        </>
      }
      description="Tidak apa-apa jika lupa. Kami kirimkan tautan reset ke emailmu agar kamu bisa segera kembali menikmati makanan surplus terbaik."
    >
      <ForgotPasswordForm />
    </AuthCenteredShell>
  );
}
