import Image from "next/image";
import type { ReactNode } from "react";

interface AuthCenteredShellProps {
  imageSrc: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
  imageAlt?: string;
  variant?: "seller" | "buyer";
}

export default function AuthCenteredShell({
  imageSrc,
  title,
  description,
  children,
  variant = "buyer",
}: AuthCenteredShellProps) {
  const isSeller = variant === "seller";

  return (
    <main className="relative flex h-screen w-full items-center justify-center overflow-hidden overscroll-none bg-primary p-3 sm:p-4 lg:p-6 supports-[height:100dvh]:h-[100dvh] touch-none">
      {}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover"
          priority
        />
        {}
        {isSeller ? (
          <>
            <div className="absolute inset-0 bg-primary/85" />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(10,30,24,0.55)_0%,rgba(6,20,16,0.78)_55%,rgba(3,12,10,0.94)_100%)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-primary/68" />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(10,30,24,0.38)_0%,rgba(6,20,16,0.62)_55%,rgba(3,12,10,0.88)_100%)]" />
          </>
        )}
        <div className="absolute inset-0 opacity-[0.025] [background-image:radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      {}
      <div className="relative flex max-h-[calc(100svh-24px)] w-full max-w-[1080px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-white shadow-[0_28px_80px_rgba(0,0,0,0.55),0_4px_24px_rgba(0,0,0,0.35)] supports-[height:100dvh]:max-h-[calc(100dvh-24px)] sm:max-h-[calc(100svh-32px)] sm:supports-[height:100dvh]:max-h-[calc(100dvh-32px)] lg:max-h-[calc(100svh-48px)] lg:supports-[height:100dvh]:max-h-[calc(100dvh-48px)] lg:rounded-[24px]">
        <div className="grid max-h-full gap-0 overflow-hidden lg:grid-cols-[1.05fr_1fr]">
          {}
          <div className="relative hidden min-h-[560px] max-h-[calc(100dvh-64px)] flex-col justify-between overflow-hidden rounded-[16px] bg-primary lg:m-2 lg:flex lg:max-h-[calc(100dvh-64px)]">
            <div className="absolute inset-0">
              <Image
                src={imageSrc}
                alt=""
                fill
                className="object-cover"
                priority
              />
              {isSeller ? (
                <>
                  <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(15,46,36,0.68)_0%,rgba(15,46,36,0.42)_46%,rgba(8,24,18,0.9)_100%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/75 via-transparent to-primary/25" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(15,46,36,0.52)_0%,rgba(15,46,36,0.30)_46%,rgba(8,24,18,0.78)_100%)]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-primary/15" />
                </>
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay [background-image:url('data:image/svg+xml,%3Csvg%20viewBox=%270%200%20200%20200%27%20xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter%20id=%27n%27%3E%3CfeTurbulence%20type=%27fractalNoise%27%20baseFrequency=%270.85%27%20numOctaves=%273%27/%3E%3C/filter%3E%3Crect%20width=%27100%25%27%20height=%27100%25%27%20filter=%27url(%23n)%27/%3E%3C/svg%3E')]" />

            <div className="relative z-10 flex items-center gap-2.5 p-8 xl:p-10">
              <Image
                src="/logo.avif"
                alt="ReBites"
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-white/20"
              />
              <span className="font-display text-[17px] font-semibold tracking-tight text-white">
                ReBites
              </span>
            </div>

            <div className="relative z-10 p-8 xl:p-10">
              <h1 className="max-w-[20rem] font-display text-[2.35rem] font-bold leading-[0.95] tracking-[-0.03em] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] xl:text-[2.55rem]">
                {title}
              </h1>
              <p className="mt-4 max-w-[22rem] font-sans text-[13px] leading-relaxed text-white/75">
                {description}
              </p>
              <p className="mt-5 font-sans text-[11px] font-medium tracking-wide text-white/60">
                {isSeller ? "Your journey starts here." : "Hemat enak, selamatkan bumi."}
              </p>
            </div>
          </div>

          {}
          <div className="flex max-h-[calc(100dvh-24px)] flex-col overflow-hidden bg-white px-6 py-6 sm:px-8 sm:py-7 lg:max-h-[calc(100dvh-48px)] lg:px-8 lg:py-7 xl:px-10 xl:py-8">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
