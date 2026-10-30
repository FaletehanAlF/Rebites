import type { Metadata } from "next";
import AuthCenteredShell from "@/app/components/auth/auth-centered-shell";
import PenjualRegisterForm from "@/app/components/auth/penjual-register-form";

export const metadata: Metadata = {
  title: "Daftar Penjual - ReBites",
  description:
    "Buat akun penjual untuk bergabung dengan marketplace kuliner surplus ReBites.",
};

export default function RegisterPenjualPage() {
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
      description="Bergabunglah dengan marketplace kami yang menghubungkan pencinta kuliner dengan makanan surplus berkualitas. Kurangi limbah makanan dengan indah."
    >
      <PenjualRegisterForm />
    </AuthCenteredShell>
  );
}
