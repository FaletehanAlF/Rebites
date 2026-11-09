import type { Metadata } from "next";
import AuthSplitShell from "@/app/components/auth/auth-split-shell";
import BuatSandiBaruForm from "@/app/components/auth/buat-sandi-baru-form";
export const metadata: Metadata = {
    title: "Buat Kata Sandi Baru — ReBites",
    description: "Tentukan kata sandi baru untuk akun ReBites Anda dan lanjutkan misi menyelamatkan makanan surplus.",
};
export default function BuatSandiBaruPage() {
    return (<AuthSplitShell imageSrc="/hero-makanan.avif" imageAlt="Makanan surplus ReBites" variant="buyer" overlayText={{
            headline: "Buat Kata Sandi Baru",
            description: "Tautanmu terverifikasi. Tentukan kata sandi baru untuk akun ReBites-mu.",
        }}>

      <BuatSandiBaruForm />

    </AuthSplitShell>);
}
