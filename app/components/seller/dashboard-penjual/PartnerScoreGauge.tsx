'use client';

import { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { FilterDropdown } from './FilterDropdown';
import { useCountUp } from './useCountUp';
import { useSellerAnalytics } from '@/hooks/seller/use-seller-analytics';

const SIZE = 150;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PartnerScoreGauge() {
  const [period, setPeriod] = useState('30-hari');
  const reduced = useReducedMotion();
  const { partnerScores, periodOptions } = useSellerAnalytics();
  const data =
    partnerScores[period] ?? partnerScores['30-hari'] ?? {
      label: '30 Hari',
      score: 0,
      deltaPercent: 0,
    };
  const options = periodOptions.length > 0
    ? periodOptions
    : [{ value: '30-hari', label: '30 Hari' }];
  const { ref, value } = useCountUp(data.score);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(svgRef, { once: true, margin: '-10% 0px' });

  const dashOffset = CIRCUMFERENCE * (1 - data.score / 100);

  return (
    <section aria-label={`Skor Mitra ${data.score} persen`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">Skor Mitra</h3>
        <FilterDropdown
          value={period}
          onChange={setPeriod}
          options={options}
          ariaLabel="Pilih rentang waktu skor"
        />
      </div>

      <div className="relative mx-auto mt-2 h-[150px] w-[150px]">
        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-hidden
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={STROKE}
          />
          {reduced ? (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          ) : (
            <motion.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={
                inView
                  ? { strokeDashoffset: dashOffset }
                  : { strokeDashoffset: CIRCUMFERENCE }
              }
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.15 }}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-[30px] font-medium leading-none tracking-tight text-primary">
            <span ref={ref}>{value}%</span>
          </p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">Skor Mitra</p>
        </div>
      </div>

      <p className="mt-3 text-center text-xs font-medium text-foreground">
        Tokomu mengungguli{' '}
        <span className="font-bold text-primary">{data.score}%</span> toko lain bulan ini
      </p>
      <p className="mt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Berdasarkan kecepatan respons, tingkat keterjualan, dan ulasan pelanggan
      </p>
      <p className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-primary">
        <TrendingUp className="h-3.5 w-3.5" />
        +{data.deltaPercent}% dari bulan lalu
      </p>
    </section>
  );
}
