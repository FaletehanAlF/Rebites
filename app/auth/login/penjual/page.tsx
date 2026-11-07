import type { Metadata } from "next";
import AuthSplitShell from "@/app/components/auth/auth-split-shell";
import PenjualLoginForm from "@/app/components/auth/penjual-login-form";
export const metadata: Metadata = {
    title: "Masuk Penjual — ReBites",
    description: "Masuk sebagai penjual ReBites untuk mengelola toko dan berjualan makanan surplus.",
};
export default function LoginPenjualPage() {
    return (<AuthSplitShell imageSrc="/hero-makanan.avif" imageAlt="ReBites — Makanan surplus" variant="buyer" overlayText={{
            headline: "Masuk sebagai Penjual",
            description: "Masuk untuk mengelola toko, mengatur menu, dan mulai berjualan makanan surplus.",
        }}>
      <PenjualLoginForm />
    </AuthSplitShell>);
}
