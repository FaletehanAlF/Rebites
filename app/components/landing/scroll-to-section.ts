export function scrollToSection(id: string, offset = -96): void {
    if (typeof document === 'undefined')
        return;
    const el = document.getElementById(id);
    if (!el)
        return;
    const lenis = window.__lenis;
    if (lenis) {
        lenis.scrollTo(el, { offset, duration: 1 });
        return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Klik link `/#section-id`: target di halaman saat ini di-scroll dengan animasi
// (Lenis-aware); tidak ada targetnya → biarkan <Link> menavigasi.
export function handleSectionLinkClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  id: string,
): void {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(id)) return;

  event.preventDefault();
  scrollToSection(id);
}
