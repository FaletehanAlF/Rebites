import type { Metadata } from "next";
import AuthSplitShell from "@/app/components/auth/auth-split-shell";
import ForgotPasswordForm from "@/app/components/auth/forgot-password-form";
export const metadata: Metadata = {
    title: "Lupa Kata Sandi — ReBites",
    description: "Atur ulang kata sandi akun ReBites Anda untuk kembali ke marketplace kuliner surplus.",
};
export default function ForgotPasswordPage() {
    return (<AuthSplitShell imageSrc="/hero-makanan.avif" imageAlt="Makanan surplus ReBites" variant="buyer" overlayText={{
            headline: "Lupa Kata Sandi?",
            description: "Tidak apa-apa jika lupa. Kami kirimkan tautan reset ke emailmu agar kamu bisa segera kembali menikmati makanan surplus terbaik.",
        }}>

      <ForgotPasswordForm />

    </AuthSplitShell>);
}
