"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
export const CATALOG_SEARCH_EVENT = "rebites:catalog-search";
export function BuyerSearchBar({ className, autoFocus = false, onSubmitted, }: {
    className?: string;
    autoFocus?: boolean;
    onSubmitted?: () => void;
}) {
    const [query, setQuery] = useState("");
    const [placeholder, setPlaceholder] = useState("Cari makanan atau toko");
    const router = useRouter();
    const pathname = usePathname();
    const inputRef = useRef<HTMLInputElement>(null);
    const trimmed = query.trim();
    useEffect(() => {
        if (autoFocus)
            inputRef.current?.focus();
    }, [autoFocus]);
    useEffect(() => {
        const mobile = window.matchMedia("(max-width: 639px)");
        const apply = () => setPlaceholder(mobile.matches ? "Cari makanan…" : "Cari makanan atau toko");
        apply();
        mobile.addEventListener("change", apply);
        return () => mobile.removeEventListener("change", apply);
    }, []);
    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const target = trimmed
            ? `/makanan?q=${encodeURIComponent(trimmed)}`
            : "/makanan";
        if (pathname === "/makanan") {
            window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT, { detail: trimmed }));
            window.history.replaceState(null, "", target);
        }
        else {
            router.push(target);
        }
        onSubmitted?.();
    };
    return (<form role="search" onSubmit={submit} className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden/>
      <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label="Cari makanan atau toko" className="h-10 w-full rounded-full border border-border bg-secondary pl-10 pr-9 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"/>
      {trimmed && (<button type="button" aria-label="Hapus pencarian" onClick={() => {
                setQuery("");
                inputRef.current?.focus();
            }} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white">
          <X className="h-3.5 w-3.5" aria-hidden/>
        </button>)}
    </form>);
}
