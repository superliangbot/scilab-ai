"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { SimulationEngine } from "@/simulations/types";

interface SimCanvasProps {
  engine: SimulationEngine | null;
  params: Record<string, number>;
  isRunning: boolean;
}

export default function SimCanvas({ engine, params, isRunning }: SimCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [initialized, setInitialized] = useState(false);

  // Initialize engine on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = Math.max(400, rect.width * 0.5);

    engine.init(canvas);
    engine.resize(canvas.width, canvas.height);
    setInitialized(true);

    return () => {
      engine.destroy();
      setInitialized(false);
    };
  }, [engine]);

  // Handle resize
  useEffect(() => {
    if (!engine || !initialized) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const height = Math.max(400, width * 0.5);
        canvas.width = width;
        canvas.height = height;
        engine.resize(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [engine, initialized]);

  // Animation loop
  const animate = useCallback(
    (time: number) => {
      if (!engine || !initialized) return;

      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05); // Cap at 50ms
      lastTimeRef.current = time;

      if (isRunning) {
        engine.update(dt, params);
      }
      engine.render();
      animFrameRef.current = requestAnimationFrame(animate);
    },
    [engine, params, isRunning, initialized],
  );

  useEffect(() => {
    if (!initialized) return;
    lastTimeRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animate, initialized]);

  return (
    <div ref={containerRef} className="sim-canvas-container" style={{ minHeight: 400 }}>
      <canvas ref={canvasRef} />
      {!engine && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-400">Loading simulation...</p>
          </div>
        </div>
      )}
    </div>
  );
}
