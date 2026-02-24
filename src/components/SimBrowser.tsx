"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { SimulationConfig, Category } from "@/simulations/types";
import { simulationConfigs, categories } from "@/simulations/registry";

interface SimBrowserProps {
  category?: Category;
}

export default function SimBrowser({ category }: SimBrowserProps) {
  const [search, setSearch] = useState("");

  const filteredSims = useMemo(() => {
    let sims = category
      ? simulationConfigs.filter((s) => s.category === category)
      : simulationConfigs;

    if (search.trim()) {
      const q = search.toLowerCase();
      sims = sims.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }

    return sims;
  }, [category, search]);

  const categoryInfo = category
    ? categories.find((c) => c.key === category)
    : null;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-tertiary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search simulations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition"
        />
      </div>

      {categoryInfo && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span>{categoryInfo.icon}</span>
            {categoryInfo.label}
          </h2>
        </div>
      )}

      {/* Grid */}
      {filteredSims.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          <p className="text-lg">No simulations found.</p>
          <p className="text-sm mt-1">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSims.map((sim) => (
            <SimCard key={sim.slug} sim={sim} />
          ))}
        </div>
      )}
    </div>
  );
}

function SimCard({ sim }: { sim: SimulationConfig }) {
  const cat = categories.find((c) => c.key === sim.category);

  return (
    <Link
      href={`/sim/${sim.slug}`}
      className="group block rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-primary)] transition-all hover:shadow-lg hover:shadow-[var(--color-primary)]/10 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div
        className="h-36 flex items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: sim.thumbnailColor + "22" }}
      >
        <span className="text-5xl group-hover:scale-110 transition-transform">
          {sim.icon}
        </span>
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at 30% 70%, ${sim.thumbnailColor}, transparent 70%)`,
          }}
        />
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
            {sim.title}
          </h3>
        </div>
        <span
          className="inline-block text-xs px-2 py-0.5 rounded-full mb-2 font-medium"
          style={{
            backgroundColor: (cat?.color ?? "#666") + "22",
            color: cat?.color ?? "#666",
          }}
        >
          {cat?.label ?? sim.category}
        </span>
        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
          {sim.description}
        </p>
      </div>
    </Link>
  );
}
