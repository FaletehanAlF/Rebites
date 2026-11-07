const TOPBAR_OFFSET = 76;
export function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el)
        return;
    const top = el.getBoundingClientRect().top + window.scrollY - TOPBAR_OFFSET;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";
    window.scrollTo({ top, behavior });
}
