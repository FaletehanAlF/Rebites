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
