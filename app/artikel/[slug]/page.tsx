"use client";
import { useParams } from "next/navigation";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { ArtikelDetailView } from "@/app/components/artikel/artikel-detail-view";
export default function ArtikelDetailPage() {
    const params = useParams();
    const slug = typeof params.slug === "string" ? params.slug : "";
    return (<BuyerShell>
      <main className="min-h-screen bg-cream-50 pb-28 pt-4 sm:pt-6 lg:pb-12 lg:pt-8">
        <ArtikelDetailView slug={slug} backHref="/artikel" backLabel="Semua Artikel"/>
      </main>
    </BuyerShell>);
}
