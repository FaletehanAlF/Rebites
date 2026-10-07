"use client";

import {
  type CSSProperties,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

function useGSAP(
  callback: () => void | (() => void),
  options?: {
    dependencies?: unknown[];
    scope?: { current: Element | null } | Element | null;
  },
) {
  const deps = options?.dependencies ?? [];
  const scope = options?.scope;

  const ctxRef = useRef<gsap.Context | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    const el =
      scope && typeof scope === "object" && "current" in scope
        ? scope.current
        : (scope as Element | null);

    ctxRef.current = gsap.context(() => { }, el ?? undefined);

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;

      ctxRef.current?.revert();
      ctxRef.current = null;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ctxRef.current) return;

    cleanupRef.current?.();

    const ret = ctxRef.current.add(callback);

    cleanupRef.current = typeof ret === "function" ? ret : undefined;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  if (typeof window === "undefined") {
    return () => { };
  }

  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);

  mediaQueryList.addEventListener("change", callback);

  return () => {
    mediaQueryList.removeEventListener("change", callback);
  };
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
}

function getServerReducedMotionSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
}

type Step = {
  id: string;
  title: string;
  content: string;
  image: string;
};

type SplitTextInstance = InstanceType<typeof SplitText>;

export type TimelineProps = {
  title?: string;
  periodLabel?: string;
  textColor?: string;
  mutedTextColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  duration?: number;
  scrollDuration?: number;
};

const topSteps: Step[] = [
  {
    id: "step-1",
    title: "Pelaku UMKM Mendaftar & Mengunggah",
    content:
      "Pelaku UMKM mendaftar akun, melengkapi profil usaha, lalu mengunggah makanan surplus yang masih layak konsumsi beserta harga, stok, dan waktu penjualannya.",
    image: "/penjual-login.jpg",
  },
  {
    id: "step-3",
    title: "Pilih Metode Penerimaan Pesanan",
    content:
      "Pembeli memilih metode penerimaan pesanan, yaitu diantar atau diambil langsung di lokasi penjual, serta memilih metode pembayaran.",
    image: "/penerimaan.jpg",
  },
];

const bottomSteps: Step[] = [
  {
    id: "step-2",
    title: "Pembeli Mencari & Memesan",
    content:
      "Pembeli mencari dan melihat detail produk surplus di sekitarnya, lalu menentukan jumlah pembelian dan menambahkan catatan pesanan.",
    image: "/pembeli-mencaro.jpg",
  },
  {
    id: "step-4",
    title: "Makanan Berhasil Diselamatkan!",
    content:
      "Nikmati makanan berkualitas dengan harga yang lebih terjangkau, sekaligus membantu mengurangi food waste dan food loss di Indonesia.",
    image: "/terselamatkan.jpg",
  },
];

const allSteps: Step[] = [
  topSteps[0],
  bottomSteps[0],
  topSteps[1],
  bottomSteps[1],
];

export default function HowItWorks({
  title = "Cara Kerja ReBites",
  periodLabel = "4 langkah mudah",
  textColor = "hsl(40 30% 96%)",
  mutedTextColor = "hsl(40 30% 96% / 0.7)",
  activeColor = "#C8A882",
  backgroundColor = "hsl(148 41% 23%)",
  duration,
  scrollDuration = 1.2,
}: TimelineProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const wholeSliderRef = useRef<HTMLDivElement>(null);

  const reducedMotion = usePrefersReducedMotion();

  const animationDuration = duration ?? scrollDuration;
  const normalizedDuration = Math.max(0.2, animationDuration);

  const sectionStyle: CSSProperties = {
    color: textColor,
    backgroundColor,
  };

  const activeStyle: CSSProperties = {
    backgroundColor: activeColor,
  };

  const mutedTextStyle: CSSProperties = {
    color: mutedTextColor,
  };

  /*
   * Main horizontal slider animation.
   */
  useGSAP(
    () => {
      const section = sectionRef.current;
      const slider = wholeSliderRef.current;

      if (!section || !slider) {
        return;
      }

      const isMobile = window.innerWidth < 600;

      const slidePercent = isMobile ? -57 : -65;
      const lineWidth = isMobile ? "65%" : "98%";

      const lineStart = isMobile ? "top 30%" : "top 25%";
      const slideEnd = isMobile ? "82% 50%" : "92% bottom";
      const lineEnd = isMobile ? "80% 50%" : "92% bottom";

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: slideEnd,
          scrub: true,
        },
        defaults: {
          ease: "none",
        },
      });

      tl.fromTo(
        slider,
        {
          xPercent: 0,
        },
        {
          xPercent: slidePercent,
        },
      );

      /*
       * Reduced motion:
       * tetap tampilkan timeline tanpa animasi.
       */
      if (reducedMotion) {
        gsap.set(".journey-line", {
          width: lineWidth,
        });

        return;
      }

      gsap.to(".journey-line", {
        width: lineWidth,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: lineStart,
          end: lineEnd,
          scrub: true,
        },
      });

      /*
       * Sync GSAP ScrollTrigger dengan Lenis
       * jika tersedia di aplikasi.
       */
      const lenis = window.__lenis;

      const update = () => {
        ScrollTrigger.update();
      };

      lenis?.on("scroll", update);

      return () => {
        lenis?.off("scroll", update);
      };
    },
    {
      dependencies: [reducedMotion],
      scope: sectionRef,
    },
  );

  /*
   * Step animations:
   * - vertical line
   * - dot
   * - title
   * - description
   */
  useGSAP(
    () => {
      const section = sectionRef.current;

      if (!section) {
        return;
      }

      if (reducedMotion) {
        allSteps.forEach((item) => {
          gsap.set(`.jl-${item.id}`, {
            scaleY: 1,
          });

          gsap.set(`.jd-${item.id}`, {
            scale: 1,
          });

          gsap.set(`.title-${item.id}`, {
            opacity: 1,
            clearProps: "transform",
          });

          gsap.set(`.description-${item.id}`, {
            opacity: 1,
            clearProps: "transform",
          });
        });

        return;
      }

      allSteps.forEach((item) => {
        gsap.set(`.jl-${item.id}`, {
          scaleY: 0,
          transformOrigin: "bottom bottom",
        });

        gsap.set(`.jd-${item.id}`, {
          scale: 0,
        });

        gsap.set(`.title-${item.id}`, {
          opacity: 1,
        });

        gsap.set(`.description-${item.id}`, {
          opacity: 1,
        });
      });

      const titleSplits: Partial<
        Record<string, SplitTextInstance>
      > = {};

      const descriptionSplits: Partial<
        Record<string, SplitTextInstance>
      > = {};

      /*
       * Split title dan description menjadi lines.
       */
      allSteps.forEach((item) => {
        titleSplits[item.id] = new SplitText(
          `.title-${item.id}`,
          {
            type: "chars, words, lines",
            mask: "lines",
          },
        );

        descriptionSplits[item.id] = new SplitText(
          `.description-${item.id}`,
          {
            type: "chars, words, lines",
            mask: "lines",
          },
        );
      });

      const createItemTimeline = (
        item: Step,
        startPos: number,
        endPos: number,
      ) => {
        const lineSelector = `.jl-${item.id}`;
        const dotSelector = `.jd-${item.id}`;

        const titleLines =
          titleSplits[item.id]?.lines ?? [];

        const descriptionLines =
          descriptionSplits[item.id]?.lines ?? [];

        const isTop = topSteps.some(
          (topItem) => topItem.id === item.id,
        );

        if (!isTop) {
          gsap.set(lineSelector, {
            transformOrigin: "top top",
          });
        }

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: `${startPos}% 30%`,
            end: `${endPos}% 50%`,
            scrub: true,
          },
        });

        timeline
          .to(lineSelector, {
            scaleY: 1,
            duration: normalizedDuration * 0.4,
          })
          .to(
            dotSelector,
            {
              scale: 1,
              duration: normalizedDuration * 0.4,
            },
            "<",
          )
          .fromTo(
            titleLines,
            {
              y: 100,
            },
            {
              y: 0,
              delay: -0.8 * normalizedDuration,
              duration: normalizedDuration,
              stagger: 0.02,
              ease: "power2.out",
            },
          )
          .fromTo(
            descriptionLines,
            {
              y: 100,
            },
            {
              y: 0,
              duration: normalizedDuration,
              stagger: 0.02,
              ease: "power2.out",
            },
            "<",
          );

        return timeline;
      };

      const positions: ReadonlyArray<
        readonly [number, number]
      > =
        window.innerWidth < 600
          ? [
            [18, 30],
            [36, 48],
            [56, 68],
            [72, 84],
          ]
          : [
            [8, 28],
            [30, 48],
            [50, 70],
            [68, 88],
          ];

      allSteps.forEach((item, index) => {
        const [startPos, endPos] = positions[index];

        createItemTimeline(
          item,
          startPos,
          endPos,
        );
      });

      const handleResize = () => {
        ScrollTrigger.refresh();
      };

      window.addEventListener(
        "resize",
        handleResize,
      );

      return () => {
        Object.values(titleSplits).forEach(
          (split) => split?.revert?.(),
        );

        Object.values(descriptionSplits).forEach(
          (split) => split?.revert?.(),
        );

        window.removeEventListener(
          "resize",
          handleResize,
        );
      };
    },
    {
      dependencies: [
        normalizedDuration,
        reducedMotion,
      ],
      scope: sectionRef,
    },
  );

  return (
    <section
      ref={sectionRef}
      id="cara-kerja"
      data-nav="green"
      className="relative h-[200vw] w-full max-[600px]:h-[400vh]"
      style={sectionStyle}
    >
      <div className="sticky top-[0%] h-screen w-screen overflow-hidden pt-[10%] max-[600px]:top-[5%]">
        <div
          ref={wholeSliderRef}
          className="mr-[2vw] flex h-[30vw] w-[200vw] items-center gap-[5vw] px-[5vw] max-[600px]:h-[80vh] max-[600px]:w-[600vw] max-[600px]:px-[7vw]"
        >
          {/* First image */}
          <div className="h-full w-[30vw] overflow-hidden rounded-[1vw] max-[600px]:h-[65vw] max-[600px]:w-[85vw] max-[600px]:rounded-[5vw]">
            <img
              src="/penjual-login.jpg"
              alt="Cara kerja ReBites"
              draggable={false}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="relative h-full w-full">
            {/* Main journey line */}
            <div className="absolute left-0 top-1/2 flex h-fit w-full translate-y-[-50%] items-center">
              <div
                className="h-[.8vw] w-[.8vw] rounded-full max-[600px]:h-[2vw] max-[600px]:w-[2vw]"
                style={activeStyle}
              />

              <div
                className="journey-line h-px w-[0%] rounded-full"
                style={activeStyle}
              />

              <div
                className="h-[.8vw] w-[.8vw] rounded-full max-[600px]:h-[2vw] max-[600px]:w-[2vw]"
                style={activeStyle}
              />
            </div>

            {/* Top steps */}
            <div className="flex h-1/2 w-full items-center justify-start gap-[.5vw]">
              <div className="h-full w-[20%] pt-[2vw] max-[600px]:h-fit max-[600px]:pt-[5vw]">
                <h2 className="w-[65%] text-[2.2vw] leading-[1.05] max-[600px]:text-[8.5vw]">
                  {title}
                </h2>
              </div>

              <div className="flex h-full w-full gap-x-[35vw] max-[600px]:gap-x-[45vw]">
                {topSteps.map((item) => (
                  <div
                    key={`top-${item.id}`}
                    className="relative h-full w-[40vw] px-[3vw] max-[600px]:flex max-[600px]:w-[70vw] max-[600px]:flex-col max-[600px]:px-[7vw]"
                  >
                    {/* Vertical line + dot */}
                    <div className="absolute bottom-0 left-0 top-0 h-full w-full">
                      <div
                        className={`jd-${item.id} relative aspect-square h-[1vw] w-[1vw] translate-x-[-50%] rounded-full max-[600px]:h-[2.5vw] max-[600px]:w-[2.5vw]`}
                        style={activeStyle}
                      />

                      <div
                        className={`jl-${item.id} h-[94%] w-px origin-bottom rounded-full`}
                        style={activeStyle}
                      />
                    </div>

                    {/* Content */}
                    <div className="mt-[-1vw] space-y-[1vw] max-[600px]:mt-[-2vw]">
                      <h4
                        className={`title-${item.id} text-[1.7vw] leading-[1.15] max-[600px]:text-[6.4vw]`}
                      >
                        {item.title}
                      </h4>

                      <p
                        className={`description-${item.id} w-[90%] text-[1vw] leading-[1.4] max-[600px]:w-[90%] max-[600px]:text-[4.8vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom steps */}
            <div className="flex h-1/2 w-full items-center justify-start">
              <div className="h-full w-[34%] pt-[2vw] max-[600px]:w-[30%] max-[600px]:pt-[5vw]">
                <p
                  className="text-[1.2vw] leading-[1.3] max-[600px]:text-[4.2vw]"
                  style={mutedTextStyle}
                >
                  {periodLabel}
                </p>
              </div>

              <div className="ml-[7vw] flex h-full w-full gap-x-[35vw] max-[600px]:ml-[7vw] max-[600px]:gap-x-[50vw]">
                {bottomSteps.map((item) => (
                  <div
                    key={`bottom-${item.id}`}
                    className="relative h-full w-[40vw] px-[3vw] max-[600px]:w-[70vw] max-[600px]:px-[7vw]"
                  >
                    {/* Vertical line + dot */}
                    <div className="absolute bottom-[-1%] left-0 h-full w-full">
                      <div
                        className={`jl-${item.id} h-[94%] w-px origin-top rounded-full max-[600px]:h-full`}
                        style={activeStyle}
                      />

                      <div
                        className={`jd-${item.id} relative aspect-square h-[1vw] w-[1vw] translate-x-[-50%] rounded-full max-[600px]:h-[2.5vw] max-[600px]:w-[2.5vw]`}
                        style={activeStyle}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex h-full w-full flex-col justify-end space-y-[1vw]">
                      <h4
                        className={`title-${item.id} text-[1.7vw] leading-[1.15] max-[600px]:text-[6.4vw]`}
                      >
                        {item.title}
                      </h4>

                      <p
                        className={`description-${item.id} w-[90%] text-[1vw] leading-[1.4] max-[600px]:w-[90%] max-[600px]:text-[4.8vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}