/**
 * Smooth-scroll to a landing-page section.
 *
 * The landing page runs under Lenis (`SmoothScroll`), which takes over the
 * scroll container and disables the browser's native `scroll-behavior: smooth`
 * via `.lenis.lenis-smooth { scroll-behavior: auto !important }`. Delegating to
 * `window.__lenis` keeps in-page links animated, while the `scrollIntoView`
 * fallback keeps them working when Lenis is off (reduced motion) or before the
 * client bundle has hydrated.
 */
export function scrollToSection(id: string, offset = -96): void {
  if (typeof document === 'undefined') return;

  const el = document.getElementById(id);
  if (!el) return;

  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(el, { offset, duration: 1 });
    return;
  }

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Click handler for links shaped like `/#section-id` that may be rendered on
 * any marketing page.
 *
 * When the target section is on the *current* page the jump is animated in
 * place (Lenis-aware). When it is not — e.g. `/#cara-kerja` clicked from
 * `/fitur` — the handler does nothing and lets the `<Link>` navigate, so the
 * browser lands on `/` and scrolls to the section itself.
 */
export function handleSectionLinkClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  id: string,
): void {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(id)) return;

  event.preventDefault();
  scrollToSection(id);
}
