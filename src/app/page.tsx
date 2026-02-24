import Header from "@/components/Header";
import CategoryNav from "@/components/CategoryNav";
import SimBrowser from "@/components/SimBrowser";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">
            <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
              Interactive Science Lab
            </span>
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Explore physics, chemistry, astronomy, and more through interactive
            simulations with an AI tutor to guide your learning.
          </p>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <CategoryNav />
        </div>

        {/* Simulation Grid */}
        <SimBrowser />
      </main>
    </div>
  );
}
