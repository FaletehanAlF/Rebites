
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { Lottie } from "lottie-react";
import { Button } from "@/app/components/ui/button";

function LottieIllustration({ src, label }: { src: string; label: string }) {
  return (
    <div role="img" aria-label={label} className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden sm:aspect-[3/2]">
      <Lottie src={src} autoplay loop className="h-auto w-full" />
    </div>
  );
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-cream-50">
      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <section className="mx-auto flex w-full max-w-xl flex-col items-center text-center">

          {/* Illustration */}
          <div className="mb-1 w-full max-w-[300px] sm:max-w-[340px]">
            <LottieIllustration
              src="/lottie_animation/not-found.json"
              label="Ilustrasi halaman tidak ditemukan"
            />
          </div>

          {/* Heading */}
          <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal-900 sm:text-3xl">
            Waduh, halaman tidak ditemukan!
          </h1>

          {/* Description */}
          <p className="mt-3 max-w-md text-sm leading-7 text-stone sm:text-base">
            Sepertinya halaman yang kamu cari tidak tersedia,
            sudah dipindahkan, atau alamatnya kurang tepat.
            Tenang, masih banyak makanan enak di ReBites.
          </p>

          {/* Actions */}
          <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/home">
                <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                Kembali ke Beranda
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Landing Page
              </Link>
            </Button>
          </div>

          {/* Footer */}
          <p className="mt-12 text-xs text-stone">
            ReBites — Selamatkan makanan, nikmati kebaikan.
          </p>

        </section>
      </div>
    </main>
  );
}
