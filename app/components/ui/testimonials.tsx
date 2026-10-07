"use client";
import React from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

export type TestimonialItem = {
  name: string;
  role: string;
  quote: string;
  rating: number;
  photo: string;
};

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: TestimonialItem[];
  duration?: number;
}) => {
  return (
    <div className={`overflow-hidden ${props.className ?? ""}`}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 bg-transparent pb-6"
      >
        {[...new Array(2).fill(0)].map((_, index) => (
          <React.Fragment key={index}>
            {props.testimonials.map((t, i) => (
              <div
                className="max-w-xs w-full rounded-3xl border border-border bg-white p-8 shadow-[0_10px_30px_-24px_rgba(27,77,50,0.3)]"
                key={`${t.name}-${i}`}
              >
                <div className="flex items-center gap-1">
                  {Array.from({ length: t.rating }).map((_, s) => (
                    <Star
                      key={s}
                      className="h-4 w-4 fill-caramel text-caramel"
                    />
                  ))}
                </div>
                <div className="mt-4 text-sm leading-relaxed text-foreground/80">
                  &ldquo;{t.quote}&rdquo;
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <img
                    width={40}
                    height={40}
                    src={t.photo}
                    alt={t.name}
                    className="h-10 w-10 rounded-full border border-caramel/30 object-cover"
                  />
                  <div className="flex flex-col">
                    <div className="font-display text-base font-medium leading-5 tracking-tight text-primary">
                      {t.name}
                    </div>
                    <div className="mt-0.5 font-sans text-xs leading-5 tracking-tight text-muted-foreground">
                      {t.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
