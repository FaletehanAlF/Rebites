import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, getCategoryBySlug } from "@/lib/categories";
import CategoryView from "@/app/components/makanan-category/category-view";

interface CategoryPageProps {
  params: { category: string };
}

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.id }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const category = getCategoryBySlug(params.category);
  if (!category) {
    return { title: "Kategori tidak ditemukan - ReBites" };
  }
  return {
    title: `${category.name} - ReBites`,
    description: category.description,
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = getCategoryBySlug(params.category);
  if (!category) {
    notFound();
  }
  return <CategoryView slug={category.id} name={category.name} />;
}
