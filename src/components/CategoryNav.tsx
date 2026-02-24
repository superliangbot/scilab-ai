"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { categories } from "@/simulations/registry";

export default function CategoryNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      <Link
        href="/"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          pathname === "/"
            ? "bg-[var(--color-primary)] text-white"
            : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
        }`}
      >
        All
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.key}
          href={`/category/${cat.key}`}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            pathname === `/category/${cat.key}`
              ? "text-white"
              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
          }`}
          style={
            pathname === `/category/${cat.key}`
              ? { backgroundColor: cat.color }
              : undefined
          }
        >
          <span>{cat.icon}</span>
          {cat.label}
        </Link>
      ))}
    </nav>
  );
}
