import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Cold & Warm Water — Ink Diffusion
 * Two side-by-side containers (cold vs hot water) with ink particles.
 * Demonstrates that diffusion is faster at higher temperatures because
 * molecules have greater kinetic energy (KE = ½mv², v_rms ∝ √T).
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isInk: boolean;
}

const ColdWarmWaterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cold-warm-water") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let coldTemp = 5;
  let hotTemp = 80;
  let numParticles = 60;
  let inkDrops = 8;

  let coldParticles: Particle[] = [];
  let hotParticles: Particle[] = [];

  const MARGIN = 0.06;
  const GAP = 0.04;

  function containerBounds(side: "left" | "right") {
    const m = width * MARGIN;
    const g = width * GAP / 2;
    const cW = (width - m * 2 - g * 2) / 2;
    const top = height * 0.18;
    const bottom = height * 0.82;
    const left = side === "left" ? m : m + cW + g * 2;
    return { left, top, right: left + cW, bottom, w: cW, h: bottom - top };
  }

  function speedForTemp(t: number): number {
    // v_rms ∝ √T (scaled for visual effect)
    return Math.sqrt(Math.max(1, t + 273) / 273) * 80;
  }

  function spawnParticles(bounds: { left: number; top: number; right: number; bottom: number; w: number; h: number }, temp: number, nParticles: number, nInk: number): Particle[] {
    const particles: Particle[] = [];
    const speed = speedForTemp(temp);
    // Water particles
    for (let i = 0; i < nParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random());
      particles.push({
        x: bounds.left + Math.random() * bounds.w,
        y: bounds.top + Math.random() * bounds.h,
        vx: s * Math.cos(angle),
        vy: s * Math.sin(angle),
        isInk: false,
      });
    }
    // Ink particles — start clustered near top centre
    const inkCx = bounds.left + bounds.w / 2;
    const inkCy = bounds.top + bounds.h * 0.15;
    for (let i = 0; i < nInk; i++) {
      const angle = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.5);
      particles.push({
        x: inkCx + (Math.random() - 0.5) * 12,
        y: inkCy + (Math.random() - 0.5) * 12,
        vx: s * Math.cos(angle),
        vy: s * Math.sin(angle),
        isInk: true,
      });
    }
    return particles;
  }

  function updateParticles(particles: Particle[], bounds: ReturnType<typeof containerBounds>, temp: number, dt: number) {
    const speed = speedForTemp(temp);
    const r = 3;
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x - r < bounds.left) { p.x = bounds.left + r; p.vx = Math.abs(p.vx); }
      if (p.x + r > bounds.right) { p.x = bounds.right - r; p.vx = -Math.abs(p.vx); }
      if (p.y - r < bounds.top) { p.y = bounds.top + r; p.vy = Math.abs(p.vy); }
      if (p.y + r > bounds.bottom) { p.y = bounds.bottom - r; p.vy = -Math.abs(p.vy); }
    }

    // Simple collisions between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[j].x - particles[i].x;
        const dy = particles[j].y - particles[i].y;
        const d2 = dx * dx + dy * dy;
        const minD = r * 2;
        if (d2 < minD * minD && d2 > 0) {
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const dvn = (particles[i].vx - particles[j].vx) * nx + (particles[i].vy - particles[j].vy) * ny;
          if (dvn > 0) {
            particles[i].vx -= dvn * nx;
            particles[i].vy -= dvn * ny;
            particles[j].vx += dvn * nx;
            particles[j].vy += dvn * ny;
          }
          const overlap = minD - d;
          particles[i].x -= nx * overlap * 0.5;
          particles[i].y -= ny * overlap * 0.5;
          particles[j].x += nx * overlap * 0.5;
          particles[j].y += ny * overlap * 0.5;
        }
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    const lb = containerBounds("left");
    const rb = containerBounds("right");
    coldParticles = spawnParticles(lb, coldTemp, numParticles, inkDrops);
    hotParticles = spawnParticles(rb, hotTemp, numParticles, inkDrops);
  }

  function update(dt: number, params: Record<string, number>): void {
    const newCold = params.coldTemp ?? 5;
    const newHot = params.hotTemp ?? 80;
    const newNum = Math.round(params.numParticles ?? 60);
    const newInk = Math.round(params.inkDrops ?? 8);

    if (newNum !== numParticles || newInk !== inkDrops) {
      numParticles = newNum;
      inkDrops = newInk;
      coldTemp = newCold;
      hotTemp = newHot;
      const lb = containerBounds("left");
      const rb = containerBounds("right");
      coldParticles = spawnParticles(lb, coldTemp, numParticles, inkDrops);
      hotParticles = spawnParticles(rb, hotTemp, numParticles, inkDrops);
    }
    coldTemp = newCold;
    hotTemp = newHot;

    const step = Math.min(dt, 0.033);
    const lb = containerBounds("left");
    const rb = containerBounds("right");
    updateParticles(coldParticles, lb, coldTemp, step);
    updateParticles(hotParticles, rb, hotTemp, step);
    time += step;
  }

  function drawContainer(bounds: ReturnType<typeof containerBounds>, label: string, temp: number, particles: Particle[]) {
    // Water background
    const tFrac = Math.min(1, Math.max(0, temp / 100));
    const bR = Math.round(30 + tFrac * 80);
    const bG = Math.round(60 + (1 - tFrac) * 100);
    const bB = Math.round(180 - tFrac * 120);
    ctx.fillStyle = `rgba(${bR},${bG},${bB},0.25)`;
    ctx.fillRect(bounds.left, bounds.top, bounds.w, bounds.h);

    // Glass outline
    ctx.strokeStyle = "rgba(150,180,220,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(bounds.left, bounds.top, bounds.w, bounds.h);

    // Particles
    for (const p of particles) {
      if (p.isInk) {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8);
        glow.addColorStop(0, "rgba(20, 20, 80, 0.5)");
        glow.addColorStop(1, "rgba(20, 20, 80, 0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10, 10, 100, 0.85)";
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${100 + tFrac * 155}, ${120 - tFrac * 60}, ${200 - tFrac * 150}, 0.5)`;
        ctx.fill();
      }
    }

    // Label
    ctx.save();
    ctx.font = `bold ${Math.max(12, bounds.w * 0.07)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(220,230,250,0.8)";
    ctx.fillText(label, bounds.left + bounds.w / 2, bounds.top - 8);
    ctx.font = `${Math.max(10, bounds.w * 0.055)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(180,200,240,0.6)";
    ctx.fillText(`${temp}°C`, bounds.left + bounds.w / 2, bounds.bottom + 18);
    ctx.restore();
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const lb = containerBounds("left");
    const rb = containerBounds("right");
    drawContainer(lb, "Cold Water", coldTemp, coldParticles);
    drawContainer(rb, "Hot Water", hotTemp, hotParticles);

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Ink Diffusion in Cold vs Hot Water", width / 2, height - 10);
    ctx.restore();

    // Time
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 8, height - 8);
  }

  function reset(): void {
    time = 0;
    const lb = containerBounds("left");
    const rb = containerBounds("right");
    coldParticles = spawnParticles(lb, coldTemp, numParticles, inkDrops);
    hotParticles = spawnParticles(rb, hotTemp, numParticles, inkDrops);
  }

  function destroy(): void { coldParticles = []; hotParticles = []; }

  function getStateDescription(): string {
    return (
      `Ink diffusion: cold water at ${coldTemp}°C vs hot water at ${hotTemp}°C. ` +
      `${numParticles} water molecules + ${inkDrops} ink particles per container. ` +
      `Ink diffuses faster in hot water because molecules have greater kinetic energy (v_rms ∝ √T). ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ColdWarmWaterFactory;
