import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Conduction 3 — Metal vs Wood Handles
 * Heat from a flame conducts along two pot handles: one metal (high k),
 * one wood (low k). Particle colours show temperature propagation.
 * Fourier's law: q = -k·dT/dx
 */

interface HandlePoint {
  x: number;
  y: number;
  temp: number;
}

const MATERIALS: { name: string; k: number; color: string }[] = [
  { name: "Metal (Iron)", k: 80, color: "#94a3b8" },
  { name: "Wood", k: 0.15, color: "#a0845c" },
];

const Conduction3Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("conduction-3") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let heatOn = 1;
  let showTemps = 1;
  let material1 = 0; // Metal
  let material2 = 1; // Wood

  const SEGMENTS = 20;
  let handle1: HandlePoint[] = [];
  let handle2: HandlePoint[] = [];
  const T_AMBIENT = 20;
  const T_FLAME = 200;

  function createHandles() {
    handle1 = [];
    handle2 = [];
    const startX = width * 0.3;
    const endX = width * 0.85;
    const y1 = height * 0.35;
    const y2 = height * 0.65;
    const segW = (endX - startX) / SEGMENTS;

    for (let i = 0; i <= SEGMENTS; i++) {
      handle1.push({ x: startX + i * segW, y: y1, temp: T_AMBIENT });
      handle2.push({ x: startX + i * segW, y: y2, temp: T_AMBIENT });
    }
  }

  function updateHandle(handle: HandlePoint[], k: number, dt: number) {
    const dx = handle.length > 1 ? handle[1].x - handle[0].x : 1;
    const alpha = k * 0.01; // thermal diffusivity (scaled)

    // Boundary condition: first segment heated by flame
    if (heatOn >= 1) {
      handle[0].temp += (T_FLAME - handle[0].temp) * Math.min(1, alpha * 2 * dt);
    }

    // Heat equation: dT/dt = alpha * d²T/dx²
    const newTemps: number[] = [];
    for (let i = 0; i < handle.length; i++) {
      if (i === 0) {
        newTemps.push(handle[i].temp);
        continue;
      }
      const left = handle[i - 1].temp;
      const right = i < handle.length - 1 ? handle[i + 1].temp : handle[i].temp;
      const curr = handle[i].temp;
      const d2T = (left - 2 * curr + right) / (dx * dx);
      let newT = curr + alpha * d2T * dt * dx * dx;

      // Cooling to ambient
      newT += (T_AMBIENT - newT) * 0.005 * dt;
      newTemps.push(Math.max(T_AMBIENT, Math.min(T_FLAME, newT)));
    }

    for (let i = 0; i < handle.length; i++) {
      handle[i].temp = newTemps[i];
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    createHandles();
  }

  function update(dt: number, params: Record<string, number>): void {
    heatOn = params.heatOn ?? 1;
    showTemps = params.showTemps ?? 1;
    material1 = Math.round(params.material1 ?? 0) % MATERIALS.length;
    material2 = Math.round(params.material2 ?? 1) % MATERIALS.length;

    const step = Math.min(dt, 0.033);
    updateHandle(handle1, MATERIALS[material1].k, step);
    updateHandle(handle2, MATERIALS[material2].k, step);
    time += step;
  }

  function tempToColor(t: number): string {
    const frac = Math.min(1, Math.max(0, (t - T_AMBIENT) / (T_FLAME - T_AMBIENT)));
    if (frac < 0.33) {
      const s = frac / 0.33;
      return `rgb(${Math.round(40 + 180 * s)}, ${Math.round(80 + 80 * s)}, ${Math.round(200 - 150 * s)})`;
    } else if (frac < 0.66) {
      const s = (frac - 0.33) / 0.33;
      return `rgb(${Math.round(220 + 35 * s)}, ${Math.round(160 + 60 * s)}, ${Math.round(50 - 30 * s)})`;
    }
    const s = (frac - 0.66) / 0.34;
    return `rgb(255, ${Math.round(220 - 120 * s)}, ${Math.round(20 + 30 * s)})`;
  }

  function drawHandle(handle: HandlePoint[], mat: typeof MATERIALS[0], labelY: number) {
    const segW = handle.length > 1 ? handle[1].x - handle[0].x : 20;
    const hH = Math.max(16, height * 0.05);

    // Handle body
    for (let i = 0; i < handle.length; i++) {
      const p = handle[i];
      ctx.fillStyle = tempToColor(p.temp);
      ctx.fillRect(p.x - segW / 2, p.y - hH / 2, segW + 1, hH);
    }

    // Outline
    const startX = handle[0].x - segW / 2;
    const endX = handle[handle.length - 1].x + segW / 2;
    ctx.strokeStyle = "rgba(150,180,220,0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, handle[0].y - hH / 2, endX - startX, hH);

    // Temperature readings
    if (showTemps >= 1) {
      ctx.font = `${Math.max(9, width * 0.014)}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.textAlign = "center";
      const indices = [0, Math.floor(handle.length / 2), handle.length - 1];
      for (const idx of indices) {
        ctx.fillText(`${handle[idx].temp.toFixed(0)}°C`, handle[idx].x, handle[idx].y + hH / 2 + 14);
      }
    }

    // Material label
    ctx.font = `bold ${Math.max(11, width * 0.018)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.8)";
    ctx.textAlign = "left";
    ctx.fillText(mat.name, endX + 10, handle[0].y + 5);
    ctx.font = `${Math.max(9, width * 0.013)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(180,200,230,0.5)";
    ctx.fillText(`k = ${mat.k} W/m·K`, endX + 10, handle[0].y + 20);
  }

  function drawFlame() {
    const fx = handle1[0].x - 30;
    const y1 = handle1[0].y;
    const y2 = handle2[0].y;
    const cy = (y1 + y2) / 2;

    if (heatOn < 1) return;

    // Flame glow
    for (let i = 0; i < 5; i++) {
      const fh = 20 + Math.sin(time * 10 + i * 1.5) * 8;
      const fy = cy + (Math.random() - 0.5) * (y2 - y1) * 0.5;
      const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fh);
      grad.addColorStop(0, "rgba(255,200,50,0.5)");
      grad.addColorStop(0.5, "rgba(255,100,20,0.2)");
      grad.addColorStop(1, "rgba(255,50,0,0)");
      ctx.beginPath();
      ctx.arc(fx, fy, fh, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Pot body
    ctx.fillStyle = "rgba(80,80,80,0.6)";
    ctx.beginPath();
    ctx.roundRect(fx - 25, y1 - 25, 50, y2 - y1 + 50, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(150,150,150,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `${Math.max(9, width * 0.013)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,200,100,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Heat", fx, cy + 4);
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    drawFlame();
    drawHandle(handle1, MATERIALS[material1], height * 0.35);
    drawHandle(handle2, MATERIALS[material2], height * 0.65);

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Heat Conduction — Material Comparison", width / 2, 24);
    ctx.font = `${Math.max(10, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160,180,220,0.5)";
    ctx.fillText("Fourier's Law: q = −k·dT/dx   |   Higher k → faster heat transfer", width / 2, 42);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 8, height - 8);
  }

  function reset(): void {
    time = 0;
    createHandles();
  }

  function destroy(): void { handle1 = []; handle2 = []; }

  function getStateDescription(): string {
    const m1 = MATERIALS[material1];
    const m2 = MATERIALS[material2];
    const tip1 = handle1[handle1.length - 1]?.temp ?? T_AMBIENT;
    const tip2 = handle2[handle2.length - 1]?.temp ?? T_AMBIENT;
    return (
      `Heat Conduction comparison: ${m1.name} (k=${m1.k}) tip temp: ${tip1.toFixed(0)}°C, ` +
      `${m2.name} (k=${m2.k}) tip temp: ${tip2.toFixed(0)}°C. ` +
      `Heat source: ${heatOn >= 1 ? "on" : "off"}. ` +
      `Metal conducts heat ~500× faster than wood, explaining why metal handles feel hotter.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createHandles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Conduction3Factory;
