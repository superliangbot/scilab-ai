"use client";

import type { SimulationParameter } from "@/simulations/types";

interface SimControlsProps {
  parameters: SimulationParameter[];
  values: Record<string, number>;
  onChange: (key: string, value: number) => void;
  isRunning: boolean;
  onToggleRun: () => void;
  onReset: () => void;
}

export default function SimControls({
  parameters,
  values,
  onChange,
  isRunning,
  onToggleRun,
  onReset,
}: SimControlsProps) {
  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-[var(--color-text)]">Controls</h3>
        <div className="flex gap-2">
          <button
            onClick={onToggleRun}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isRunning
                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Play
              </span>
            )}
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {parameters.map((param) => (
          <div key={param.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[var(--color-text-secondary)]">
                {param.label}
              </label>
              <span className="text-xs font-mono text-[var(--color-primary)]">
                {values[param.key]?.toFixed(
                  param.step < 1 ? Math.max(1, -Math.floor(Math.log10(param.step))) : 0,
                )}
                {param.unit ? ` ${param.unit}` : ""}
              </span>
            </div>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={values[param.key] ?? param.defaultValue}
              onChange={(e) => onChange(param.key, parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
