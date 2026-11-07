const ROW_PATTERN: {
    phrase: "code" | "label";
    row: string;
}[] = [
    {
        phrase: "code",
        row: "animate-marquee-slow text-white/[0.11] [animation-delay:-6s]",
    },
    {
        phrase: "label",
        row: "animate-marquee-reverse-slow text-white/[0.075] [animation-delay:-31s]",
    },
    {
        phrase: "code",
        row: "animate-marquee-reverse-slow text-white/[0.08] [animation-delay:-14s]",
    },
    {
        phrase: "label",
        row: "animate-marquee-slow text-white/[0.11] [animation-delay:-47s]",
    },
    {
        phrase: "code",
        row: "animate-marquee-slow text-white/[0.075] [animation-delay:-22s]",
    },
    {
        phrase: "label",
        row: "animate-marquee-reverse-slow text-white/[0.11] [animation-delay:-9s]",
    },
    {
        phrase: "code",
        row: "animate-marquee-reverse-slow text-white/[0.105] [animation-delay:-38s]",
    },
    {
        phrase: "label",
        row: "animate-marquee-slow text-white/[0.08] [animation-delay:-17s]",
    },
];
const COPIES_PER_SET = 6;
export function ErrorBackgroundMarquee({ code, label, }: {
    code: string;
    label: string;
}) {
    return (<div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div className="absolute inset-0 flex flex-col justify-between py-[6vh]">
        {ROW_PATTERN.map((entry, index) => (<div key={index} className={`flex w-max items-center whitespace-nowrap font-display text-[clamp(2.25rem,7vw,5.5rem)] font-bold uppercase leading-none tracking-tight motion-reduce:animate-none ${entry.row}`}>
            
            {[0, 1].map((copy) => (<span key={copy} className="flex shrink-0">
                {Array.from({ length: COPIES_PER_SET }, (_, i) => (<span key={i} className="px-[0.3em]">
                    {entry.phrase === "code" ? code : label}
                  </span>))}
              </span>))}
          </div>))}
      </div>
    </div>);
}
