"use client";
import { CalendarDays } from "lucide-react";
import type { ProductDetail, Review } from "@/app/components/detail-product/data";
import { Avatar } from "./avatar";
import { Stars } from "./stars";
import { StaggerGroup, StaggerItem } from "./anim";
export function ReviewSection({ reviews, product, }: {
    reviews: Review[];
    product: ProductDetail;
}) {
    return (<section id="ulasan" className="scroll-mt-28 pt-20">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-sans text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            Apa Kata Mereka
          </h2>
          <p className="mt-2 max-w-md font-secondary text-sm leading-relaxed text-muted-foreground">
            Ulasan asli dari orang-orang yang sudah menyelamatkan porsi hari
            ini.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-border bg-white px-6 py-4">
          <span className="font-display text-5xl font-semibold leading-none text-foreground">
            {product.rating.toFixed(1)}
          </span>
          <div>
            <Stars rating={product.rating} size={16}/>
            <p className="mt-1 font-secondary text-xs text-muted-foreground">
              {product.reviewCount} ulasan terverifikasi
            </p>
          </div>
        </div>
      </div>

      <StaggerGroup className="mt-8 grid gap-4 md:grid-cols-3" stagger={0.1}>
        {reviews.map((review) => (<StaggerItem key={review.id} className="h-full">
            <article className="flex h-full flex-col rounded-2xl border border-border bg-white p-6">
              <div className="flex items-center gap-3">
                <Avatar name={review.reviewerName} src={review.avatar} className="h-11 w-11"/>
                <div className="min-w-0">
                  <p className="truncate font-sans text-sm font-semibold text-foreground">
                    {review.reviewerName}
                  </p>
                  <p className="flex items-center gap-1 font-secondary text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3"/>
                    {review.date}
                  </p>
                </div>
              </div>
              <Stars rating={review.rating} className="mt-4"/>
              <p className="mt-2 font-secondary text-sm leading-relaxed text-muted-foreground">
                {review.comment}
              </p>
            </article>
          </StaggerItem>))}
      </StaggerGroup>
    </section>);
}
