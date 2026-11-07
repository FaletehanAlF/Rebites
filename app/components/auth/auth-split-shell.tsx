import Image from "next/image";
import type { ReactNode } from "react";
import { AuthScrollLock } from "./auth-scroll-lock";
interface AuthSplitShellProps {
    title?: ReactNode;
    subtitle?: string;
    children: ReactNode;
    imageSrc: string;
    imageAlt?: string;
    variant?: "buyer" | "seller";
    overlayText?: {
        headline: ReactNode;
        description: string;
    };
}
export default function AuthSplitShell({ title, subtitle, children, imageSrc, imageAlt = "", variant = "buyer", overlayText, }: AuthSplitShellProps) {
    const isSeller = variant === "seller";
    return (<main className="relative flex h-[100dvh] min-h-0 w-full items-stretch overflow-hidden bg-[#FAFAF8]">
      <AuthScrollLock />

      
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="auth-wave-clip" clipPathUnits="objectBoundingBox">
            <path d="M0,0 L1,0 C0.88,0.06 0.79,0.13 0.81,0.25 C0.83,0.37 0.99,0.43 0.98,0.55 C0.97,0.67 0.79,0.71 0.81,0.83 C0.83,0.92 0.94,0.96 1,1 L0,1 Z"/>
          </clipPath>
        </defs>
      </svg>

      
      <div className="relative hidden w-[52%] shrink-0 overflow-hidden bg-[#FAFAF8] lg:block">
        <div className="absolute inset-0" style={{ clipPath: "url(#auth-wave-clip)" }}>
          <Image src={imageSrc} alt={imageAlt} fill className="object-cover" priority sizes="52vw"/>
          
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A1E18]/70 via-[#0A1E18]/35 to-[#0A1E18]/10"/>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A1E18]/70 via-transparent to-[#0A1E18]/20"/>
          
          <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:22px_22px]"/>
        </div>

        <div className="relative z-10 flex h-full flex-col px-10 pt-9 xl:px-14 xl:pt-11">
          
          <div className="flex items-center gap-3">
            <Image src="/logo.avif" alt="ReBites" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover shadow-lg ring-1 ring-white/20"/>
            <span className="font-display text-xl font-semibold tracking-tight text-white">
              ReBites
            </span>
          </div>

          
          <div className="flex flex-1 flex-col justify-end pb-14">
            <div className="max-w-md">
              {overlayText && (<>
                  <h1 className="font-display text-[1.9rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white [text-shadow:0_4px_30px_rgba(0,0,0,0.5)] xl:text-[2.35rem]">
                    {overlayText.headline}
                  </h1>
                  <p className="mt-5 max-w-sm font-sans text-[15px] leading-relaxed text-white/80">
                    {overlayText.description}
                  </p>
                </>)}
            </div>
            <div className="mt-8 flex items-center">
              <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
                {isSeller ? "Marketplace Kuliner UMKM" : "Food Rescue"}
              </span>
            </div>
          </div>
        </div>
      </div>

      
      <div className="flex w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-gradient-to-r from-[#FAFAF8] via-[#FAFAF8] to-[#F1F5EA] px-6 py-8 sm:px-10 md:px-14 lg:h-full lg:w-[48%] lg:flex-none lg:px-12 lg:py-10 xl:px-16 xl:py-12">
        <div className="mx-auto flex w-full min-w-0 max-w-[380px] flex-col lg:my-auto">
          {(title || subtitle) && (<div className="mb-6 flex-shrink-0">
              <h1 className="font-display text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-[#0A1E18]">
                {title}
              </h1>
              {subtitle && (<p className="mt-2 font-sans text-[13px] leading-relaxed text-[#5C6B5A]">
                  {subtitle}
                </p>)}
            </div>)}
          <div className="flex min-h-0 flex-col">
            {children}
          </div>
        </div>
      </div>
    </main>);
}
