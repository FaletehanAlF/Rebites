import type { Metadata } from "next";
import AuthSplitShell from "@/app/components/auth/auth-split-shell";
import AuthForm from "@/app/components/auth/auth-form";
export const metadata: Metadata = {
    title: "Daftar — ReBites",
    description: "Buat akun untuk bergabung dengan marketplace kuliner surplus ReBites.",
};
export default function RegisterPage() {
    return (<AuthSplitShell imageSrc="/hero-makanan.avif" imageAlt="Makanan surplus ReBites" variant="buyer" overlayText={{
            headline: "Gabung, Temukan.",
            description: "Buat akun dan mulai berburu kuliner surplus favoritmu. Hemat, enak, berkelanjutan.",
        }}>
      <AuthForm mode="signup" title="Buat Akun Baru" subtitle="Daftar untuk bergabung dengan marketplace kami." submitLabel="Buat Akun" redirectTo="/home" bottomHint={{
            text: "Sudah punya akun?",
            linkText: "Masuk",
            href: "/auth/login",
        }}/>
    </AuthSplitShell>);
}
