import Header from "@/components/Header";
import CategoryNav from "@/components/CategoryNav";
import SimBrowser from "@/components/SimBrowser";
import type { Category } from "@/simulations/types";

interface CategoryPageProps {
  params: Promise<{ cat: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { cat } = await params;
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <CategoryNav />
        </div>
        <SimBrowser category={cat as Category} />
      </main>
    </div>
  );
}
