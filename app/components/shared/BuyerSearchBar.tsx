"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { formatRupiah } from "@/lib/data";
import { suggestFoods } from "@/lib/food-search";
import { SmartImage } from "./SmartImage";
const MAX_SUGGESTIONS = 6;
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";
function Highlighted({ name, index, length }: {
    name: string;
    index: number;
    length: number;
}) {
    if (index <= 0)
        return <>{name}</>;
    return (<>
      {name.slice(0, index)}
      <span className="text-primary">{name.slice(index, index + length)}</span>
      {name.slice(index + length)}
    </>);
}
export function BuyerSearchBar({ className }: {
    className?: string;
}) {
    const router = useRouter();
    const { foodItems, loading } = useCatalog();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const listId = useId();
    const trimmed = query.trim();
    const suggestions = useMemo(() => suggestFoods(foodItems, trimmed, MAX_SUGGESTIONS), [foodItems, trimmed]);
    const expanded = open && trimmed.length > 0;
    useEffect(() => {
        setActiveIndex(-1);
    }, [trimmed]);
    useEffect(() => {
        if (!open)
            return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node))
                setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open]);
    const openDetail = (id: string) => {
        setOpen(false);
        setQuery("");
        setActiveIndex(-1);
        router.push(`/detail/product?id=${encodeURIComponent(id)}`);
    };
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
            return;
        }
        if (suggestions.length === 0)
            return;
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (current + 1) % suggestions.length);
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            const target = suggestions[activeIndex] ?? suggestions[0];
            if (target)
                openDetail(target.id);
        }
    };
    return (<div ref={rootRef} className={cn("relative w-full", className)}>
      <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" strokeWidth={2} aria-hidden/>
        <input ref={inputRef} type="search" value={query} onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
        }} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} placeholder="Cari nama makanan" aria-label="Cari nama makanan" role="combobox" aria-expanded={expanded} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} className="h-10 w-full rounded-2xl border border-primary bg-white pl-10 pr-9 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 [&::-webkit-search-cancel-button]:hidden"/>
        {trimmed && (<button type="button" aria-label="Hapus pencarian" onClick={() => {
                setQuery("");
                setOpen(false);
                inputRef.current?.focus();
            }} className={cn("absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-primary", FOCUS_RING)}>
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden/>
          </button>)}
      </form>

      {expanded && (<div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[75] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_60px_-30px_rgba(27,77,50,0.55)]">
          {suggestions.length > 0 ? (<ul id={listId} role="listbox" aria-label="Saran makanan" className="max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain p-1.5">
              {suggestions.map((item, index) => (<li key={item.id} role="none">
                  <button id={`${listId}-${index}`} type="button" role="option" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => openDetail(item.id)} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-150", index === activeIndex ? "bg-accent" : "bg-transparent", FOCUS_RING)}>
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
                      <SmartImage src={item.image} alt="" sizes="44px"/>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-[13px] font-semibold text-foreground">
                        <Highlighted name={item.name} index={item.matchIndex} length={trimmed.length}/>
                      </span>
                      <span className="block truncate font-sans text-[11px] text-muted-foreground">
                        {item.vendorName}
                      </span>
                    </span>
                    <span className="shrink-0 font-sans text-[12px] font-bold text-primary">
                      {formatRupiah(item.price)}
                    </span>
                  </button>
                </li>))}
            </ul>) : (<p className="px-4 py-6 text-center font-sans text-xs leading-relaxed text-muted-foreground">
              {loading
                ? "Memuat makanan…"
                : `Belum ada makanan yang cocok dengan "${trimmed}".`}
            </p>)}
        </div>)}
    </div>);
}
