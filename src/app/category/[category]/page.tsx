import { notFound } from "next/navigation";
import { categories } from "@/lib/domain";
import { Marketplace } from "@/components/marketplace";
export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) { const { category } = await params; const item = categories.find(c => c.id === category); if (!item) notFound(); return <Marketplace category={item.id} />; }
