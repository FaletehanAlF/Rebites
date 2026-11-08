import type { Metadata } from "next";
import AuthSplitShell from "@/app/components/auth/auth-split-shell";
import PenjualRegisterForm from "@/app/components/auth/penjual-register-form";
export const metadata: Metadata = {
    title: "Daftar Penjual — ReBites",
    description: "Daftar sebagai penjual ReBites untuk bergabung dengan marketplace kuliner surplus.",
};
export default function RegisterPenjualPage() {
    return (<AuthSplitShell imageSrc="/hero-makanan.avif" imageAlt="ReBites — Makanan surplus" variant="buyer" overlayText={{
            headline: "Daftar sebagai Penjual",
            description: "Buat akun penjual dan mulai berjualan makanan surplus di ReBites.",
        }}>
      <PenjualRegisterForm />
    </AuthSplitShell>);
}
