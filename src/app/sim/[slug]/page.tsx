"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import SimCanvas from "@/components/SimCanvas";
import SimControls from "@/components/SimControls";
import AITutor from "@/components/AITutor";
import { getSimConfig, loadSimulation, categories } from "@/simulations/registry";
import type { SimulationEngine, SimulationConfig } from "@/simulations/types";

interface SimPageProps {
  params: Promise<{ slug: string }>;
}

export default function SimulationPage({ params }: SimPageProps) {
  const { slug } = use(params);
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [engine, setEngine] = useState<SimulationEngine | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [isRunning, setIsRunning] = useState(true);
  const engineRef = useRef<SimulationEngine | null>(null);

  // Load config and simulation
  useEffect(() => {
    const cfg = getSimConfig(slug);
    if (!cfg) return;

    setConfig(cfg);

    // Set default params
    const defaults: Record<string, number> = {};
    cfg.parameters.forEach((p) => {
      defaults[p.key] = p.defaultValue;
    });
    setParamValues(defaults);

    // Load simulation engine
    loadSimulation(slug).then((factory) => {
      if (factory) {
        const eng = factory();
        engineRef.current = eng;
        setEngine(eng);
      }
    });

    return () => {
      engineRef.current = null;
    };
  }, [slug]);

  const handleParamChange = useCallback((key: string, value: number) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    if (engine) {
      engine.reset();
    }
    if (config) {
      const defaults: Record<string, number> = {};
      config.parameters.forEach((p) => {
        defaults[p.key] = p.defaultValue;
      });
      setParamValues(defaults);
    }
    setIsRunning(true);
  }, [engine, config]);

  const getStateDescription = useCallback(() => {
    if (!engineRef.current) return "Simulation not loaded";
    return engineRef.current.getStateDescription();
  }, []);

  if (!config) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">Simulation Not Found</h1>
          <p className="text-[var(--color-text-secondary)] mb-4">
            The simulation &quot;{slug}&quot; doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="text-[var(--color-primary)] hover:underline"
          >
            Back to all simulations
          </Link>
        </div>
      </div>
    );
  }

  const cat = categories.find((c) => c.key === config.category);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-4">
          <Link href="/" className="hover:text-[var(--color-text)] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/category/${config.category}`}
            className="hover:text-[var(--color-text)] transition-colors"
          >
            {cat?.label ?? config.category}
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text)]">{config.title}</span>
        </nav>

        {/* Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <span>{config.icon}</span>
            {config.title}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {config.description}
          </p>
        </div>

        {/* Layout: Canvas + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <SimCanvas
              engine={engine}
              params={paramValues}
              isRunning={isRunning}
            />
          </div>

          {/* Sidebar: Controls + Info */}
          <div className="space-y-4">
            <SimControls
              parameters={config.parameters}
              values={paramValues}
              onChange={handleParamChange}
              isRunning={isRunning}
              onToggleRun={() => setIsRunning((r) => !r)}
              onReset={handleReset}
            />

            {/* Info Panel */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-2 text-[var(--color-text)]">
                About This Simulation
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {config.longDescription}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* AI Tutor */}
      <AITutor
        simulationTitle={config.title}
        simulationDescription={config.longDescription}
        getStateDescription={getStateDescription}
      />
    </div>
  );
}
