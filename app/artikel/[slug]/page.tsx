"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Newspaper } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { Skeleton } from "@/app/components/ui/skeleton";
import { SmartImage } from "@/app/components/shared/SmartImage";
interface PublicArticleDetail {
    id: string;
    title: string | null;
    slug: string | null;
    excerpt: string | null;
    content: string | null;
    cover_image: string | null;
    category: string | null;
    tags: string[] | null;
    published_at: string | null;
    created_at: string | null;
}
const formatDate = (iso: string | null | undefined) => {
    if (!iso)
        return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return "-";
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};
function renderContent(content: string): JSX.Element[] {
    return content
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0)
        .map((block, i) => (<p key={i} className="whitespace-pre-line leading-relaxed">
        {block}
      </p>));
}
export default function ArtikelDetailPage() {
    const params = useParams();
    const slug = typeof params.slug === "string" ? params.slug : "";
    const [article, setArticle] = useState<PublicArticleDetail | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const load = useCallback(async () => {
        if (!slug) {
            setStatus("not-found");
            return;
        }
        setStatus("loading");
        setErrorMsg("");
        try {
            const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
            if (res.status === 404) {
                setStatus("not-found");
                return;
            }
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                throw new Error(json?.error ?? "Gagal memuat artikel.");
            }
            const json = (await res.json().catch(() => null)) as {
                article?: PublicArticleDetail;
            } | null;
            if (!json || !json.article) {
                throw new Error("Respons artikel tidak valid.");
            }
            setArticle(json.article);
            setStatus("ready");
        }
        catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Gagal memuat artikel.");
            setStatus("error");
        }
    }, [slug]);
    useEffect(() => {
        load();
    }, [load]);
    useEffect(() => {
        if (status === "ready" && article?.title) {
            document.title = `${article.title} - ReBites`;
            const excerpt = article.excerpt?.trim();
            if (excerpt) {
                let meta = document.querySelector('meta[name="description"]');
                if (!meta) {
                    meta = document.createElement("meta");
                    meta.setAttribute("name", "description");
                    document.head.appendChild(meta);
                }
                meta.setAttribute("content", excerpt.slice(0, 160));
            }
        }
        else if (status === "not-found") {
            document.title = "Artikel tidak ditemukan - ReBites";
        }
    }, [status, article]);
    return (<BuyerShell>
      <main className="min-h-screen bg-cream-50 pb-28 pt-4 sm:pt-6 lg:pb-12 lg:pt-8">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-charcoal-500 transition-colors hover:bg-white hover:text-primary">
            <ArrowLeft className="h-4 w-4"/>
            Semua Artikel
          </Link>

          {status === "loading" && (<div role="status" aria-label="Memuat artikel" className="mt-4 space-y-4">
              <Skeleton className="h-6 w-28 rounded-full"/>
              <Skeleton className="h-9 w-3/4 rounded-xl"/>
              <Skeleton className="h-9 w-1/2 rounded-xl"/>
              <Skeleton className="h-5 w-40 rounded-lg"/>
              <Skeleton className="aspect-[16/9] w-full rounded-2xl"/>
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-4 w-full rounded-lg"/>))}
              </div>
            </div>)}

          {status === "not-found" && (<div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-sage-200 bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-sage-500">
                <Newspaper className="h-6 w-6"/>
              </span>
              <p className="mt-4 font-sans text-sm font-bold text-charcoal-900">
                Artikel tidak ditemukan
              </p>
              <p className="mt-1 max-w-xs font-inter text-xs text-stone">
                Artikel mungkin belum dipublish, sudah diarsipkan, atau alamatnya salah.
              </p>
              <Link href="/artikel" className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
                Kembali ke Artikel
              </Link>
            </div>)}

          {status === "error" && (<div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-sage-200 bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-sage-500">
                <Newspaper className="h-6 w-6"/>
              </span>
              <p className="mt-4 font-sans text-sm font-bold text-charcoal-900">
                Gagal memuat artikel
              </p>
              <p className="mt-1 max-w-xs font-inter text-xs text-stone">{errorMsg}</p>
              <div className="mt-4 flex items-center gap-2">
                <button type="button" onClick={load} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
                  Coba lagi
                </button>
                <Link href="/artikel" className="rounded-full border border-border/70 bg-white px-5 py-2 text-sm font-semibold text-charcoal-900">
                  Kembali ke Artikel
                </Link>
              </div>
            </div>)}

          {status === "ready" && article && (<article className="mt-4">
              {article.category?.trim() && (<span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {article.category.trim()}
                </span>)}
              <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-charcoal-900 sm:text-3xl">
                {article.title ?? "-"}
              </h1>
              {article.excerpt?.trim() && (<p className="mt-3 text-base leading-relaxed text-stone">
                  {article.excerpt.trim()}
                </p>)}
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-stone">
                <CalendarDays className="h-3.5 w-3.5"/>
                {formatDate(article.published_at)}
              </p>

              <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-sage-100">
                <SmartImage src={article.cover_image ?? ""} alt={article.title ? `Cover ${article.title}` : "Cover artikel"} sizes="(min-width: 768px) 768px, 100vw" priority/>
              </div>

              <div className="mt-6 space-y-4 text-[15px] text-charcoal-900 sm:text-base">
                {article.content?.trim()
                ? renderContent(article.content)
                : (<p className="text-sm text-stone">Konten artikel belum tersedia.</p>)}
              </div>

              {Array.isArray(article.tags) && article.tags.length > 0 && (<div className="mt-8 flex flex-wrap gap-2">
                  {article.tags.map((tag) => (<span key={tag} className="rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-medium text-charcoal-900">
                      #{tag}
                    </span>))}
                </div>)}
            </article>)}
        </div>
      </main>
    </BuyerShell>);
}
