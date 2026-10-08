import { CATEGORIES } from '@/lib/categories';

/**
 * Seam band that closes the hero: a slow marquee of the eight real culinary
 * categories from `lib/categories.ts` (the same source that owns the
 * `/makanan/[category]` routes). Pure CSS animation; the global
 * `prefers-reduced-motion` rule freezes it into a static row.
 *
 * The band is `aria-hidden`: the same categories are announced as real,
 * focusable links in `#rekomendasi`, so screen readers would otherwise hear
 * the list twice.
 */
export function CategoryMarquee() {
  const copy = (
    <ul className="flex shrink-0 items-center">
      {CATEGORIES.map((category) => (
        <li
          key={category.id}
          className="flex items-center whitespace-nowrap font-secondary text-[11px] font-medium uppercase tracking-[0.22em] text-white/80"
        >
          {category.name}
          <span aria-hidden className="mx-6 text-white/30">
            &bull;
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      aria-hidden
      className="overflow-hidden border-t border-white/10 bg-primary-dark"
    >
      {/* Two identical copies + zero gap between them: `translateX(-50%)`
          lands exactly on the seam, so the loop never jumps. */}
      <div className="flex w-max animate-marquee py-3.5 motion-reduce:animate-none">
        {copy}
        {copy}
      </div>
    </div>
  );
}
