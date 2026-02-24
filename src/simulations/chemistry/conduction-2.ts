import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Conduction 2 — Particle-Level Heat Transfer
 * Two adjacent solid blocks (hot & cold) with lattice particles connected
 * by springs (Hooke's law). Vibrations propagate from hot to cold side.
 * Demonstrates conduction at the molecular level.
 */

interface LatticePoint {
  x0: number; // equilibrium x
  y0: number; // equilibrium y
  x: number;
  y: number;
  vx: number;
  vy: number;
  temp: number;
}

const Conduction2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("conduction-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let hotTemp = 80;
  let coldTemp = 10;
  let springK = 500;
  let damping = 0.98;

  const ROWS = 8;
  const COLS = 16;
  let points: LatticePoint[] = [];

  function createLattice() {
    points = [];
    const marginX = width * 0.1;
    const marginY = height * 0.2;
    const areaW = width - marginX * 2;
    const areaH = height - marginY * 2;
    const spacingX = areaW / (COLS - 1);
    const spacingY = areaH / (ROWS - 1);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x0 = marginX + c * spacingX;
        const y0 = marginY + r * spacingY;
        const isHot = c < COLS / 2;
        const temp = isHot ? hotTemp : coldTemp;
        const vibAmp = temp * 0.05;
        points.push({
          x0, y0,
          x: x0 + (Math.random() - 0.5) * vibAmp,
          y: y0 + (Math.random() - 0.5) * vibAmp,
          vx: (Math.random() - 0.5) * temp * 0.5,
          vy: (Math.random() - 0.5) * temp * 0.5,
          temp,
        });
      }
    }
  }

  function getIdx(r: number, c: number): number { return r * COLS + c; }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    createLattice();
  }

  function update(dt: number, params: Record<string, number>): void {
    hotTemp = params.hotTemp ?? 80;
    coldTemp = params.coldTemp ?? 10;
    springK = params.springK ?? 500;
    damping = params.damping ?? 0.98;

    const step = Math.min(dt, 0.016);

    // Spring forces between neighbours (Hooke's law: F = -k·Δx)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = getIdx(r, c);
        const p = points[i];

        // Restore to equilibrium
        const dx0 = p.x - p.x0;
        const dy0 = p.y - p.y0;
        p.vx -= springK * dx0 * step;
        p.vy -= springK * dy0 * step;

        // Neighbour coupling
        const neighbours: number[] = [];
        if (r > 0) neighbours.push(getIdx(r - 1, c));
        if (r < ROWS - 1) neighbours.push(getIdx(r + 1, c));
        if (c > 0) neighbours.push(getIdx(r, c - 1));
        if (c < COLS - 1) neighbours.push(getIdx(r, c + 1));

        for (const ni of neighbours) {
          const n = points[ni];
          const dx = p.x - n.x;
          const dy = p.y - n.y;
          const restDx = p.x0 - n.x0;
          const restDy = p.y0 - n.y0;
          const stretchX = dx - restDx;
          const stretchY = dy - restDy;
          p.vx -= springK * 0.3 * stretchX * step;
          p.vy -= springK * 0.3 * stretchY * step;
        }

        // Damping
        p.vx *= Math.pow(damping, step * 60);
        p.vy *= Math.pow(damping, step * 60);
      }
    }

    // Integrate position & compute temperature
    for (const p of points) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.temp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 2;
    }

    // Heat diffusion between neighbours
    const diffRate = 0.3 * step;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = getIdx(r, c);
        if (c < COLS - 1) {
          const j = getIdx(r, c + 1);
          const dTemp = (points[j].temp - points[i].temp) * diffRate;
          // Transfer KE
          const transfer = dTemp * 0.3;
          const angle1 = Math.atan2(points[i].vy, points[i].vx);
          const angle2 = Math.atan2(points[j].vy, points[j].vx);
          if (transfer > 0) {
            points[i].vx += Math.cos(angle2) * transfer;
            points[i].vy += Math.sin(angle2) * transfer;
          } else {
            points[j].vx += Math.cos(angle1) * Math.abs(transfer);
            points[j].vy += Math.sin(angle1) * Math.abs(transfer);
          }
        }
      }
    }

    time += step;
  }

  function tempToColor(t: number): string {
    const frac = Math.min(1, t / 80);
    if (frac < 0.5) {
      const s = frac / 0.5;
      return `rgb(${Math.round(30 + 220 * s)}, ${Math.round(80 + 80 * s)}, ${Math.round(220 - 180 * s)})`;
    }
    const s = (frac - 0.5) / 0.5;
    return `rgb(255, ${Math.round(160 - 120 * s)}, ${Math.round(40 - 30 * s)})`;
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a1a");
    bg.addColorStop(1, "#10102a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Draw bonds
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = getIdx(r, c);
        const p = points[i];
        if (c < COLS - 1) {
          const n = points[getIdx(r, c + 1)];
          ctx.strokeStyle = "rgba(100,140,200,0.15)";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
        if (r < ROWS - 1) {
          const n = points[getIdx(r + 1, c)];
          ctx.strokeStyle = "rgba(100,140,200,0.15)";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    const pr = Math.max(3, Math.min(width, height) * 0.012);
    for (const p of points) {
      const color = tempToColor(p.temp);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr * 2.5);
      glow.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",0.3)"));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Labels
    ctx.save();
    ctx.font = `bold ${Math.max(12, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("Hot", width * 0.25, height * 0.12);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("Cold", width * 0.75, height * 0.12);
    ctx.restore();

    // Divider
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(150,180,220,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, height * 0.15);
    ctx.lineTo(width / 2, height * 0.85);
    ctx.stroke();
    ctx.setLineDash([]);

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Heat Conduction — Particle Model", width / 2, height - 10);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 8, height - 8);
  }

  function reset(): void {
    time = 0;
    createLattice();
  }

  function destroy(): void { points = []; }

  function getStateDescription(): string {
    return (
      `Heat Conduction (particle model): ${ROWS}×${COLS} lattice. ` +
      `Hot side: ${hotTemp}°C, cold side: ${coldTemp}°C. Spring constant: ${springK}. ` +
      `Heat transfers via molecular vibrations propagating through spring-coupled lattice points. ` +
      `Hooke's law: F = -kx governs interatomic forces. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createLattice();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Conduction2Factory;
