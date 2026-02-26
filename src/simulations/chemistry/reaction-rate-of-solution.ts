import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle { x: number; y: number; vx: number; vy: number; radius: number; type: "reactant" | "product"; hue: number; }
interface Flash { x: number; y: number; age: number; }

const ReactionRateOfSolutionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("reaction-rate-of-solution") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600, time = 0;
  let temperature = 300, concentration = 5, surfaceArea = 5, catalystPresent = 0;
  let particles: Particle[] = [], flashes: Flash[] = [];
  let reactionCount = 0, reactionRate = 0, reactionHistory: number[] = [];

  const bL = () => W * 0.1 + 20, bR = () => W * 0.6 - 20;
  const bT = () => H * 0.15 + 40, bB = () => H * 0.88 - 20;
  const baseSpeed = () => 40 + (temperature - 200) * 0.5;
  const actEnergy = () => catalystPresent ? 27 : 60;

  function createParticles(): void {
    particles = []; flashes = []; reactionCount = 0; reactionRate = 0; reactionHistory = [];
    const num = Math.round(concentration * 12), speed = baseSpeed(), r = 3 + (surfaceArea / 10) * 4;
    for (let i = 0; i < num; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      particles.push({ x: bL() + Math.random() * (bR() - bL()), y: bT() + Math.random() * (bB() - bT()),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s, radius: r, type: "reactant", hue: 210 + Math.random() * 30 });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!; W = canvas.width; H = canvas.height; time = 0; createParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const nT = params.temperature ?? 300, nC = params.concentration ?? 5, nS = params.surfaceArea ?? 5, nCat = Math.round(params.catalystPresent ?? 0);
    const needReset = Math.round(nC) !== Math.round(concentration) || nCat !== catalystPresent;
    temperature = nT; concentration = nC; surfaceArea = nS; catalystPresent = nCat;
    if (needReset) { createParticles(); time = 0; }
    const step = Math.min(dt, 0.033), speed = baseSpeed();
    let frameReactions = 0;
    for (const p of particles) {
      const cs = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (cs > 0) { const r = speed * (0.4 + Math.random() * 0.6) / cs; p.vx = p.vx * 0.98 + p.vx * r * 0.02; p.vy = p.vy * 0.98 + p.vy * r * 0.02; }
      p.radius = 3 + (surfaceArea / 10) * 4;
      p.x += p.vx * step; p.y += p.vy * step;
      if (p.x - p.radius < bL()) { p.x = bL() + p.radius; p.vx = Math.abs(p.vx); }
      if (p.x + p.radius > bR()) { p.x = bR() - p.radius; p.vx = -Math.abs(p.vx); }
      if (p.y - p.radius < bT()) { p.y = bT() + p.radius; p.vy = Math.abs(p.vy); }
      if (p.y + p.radius > bB()) { p.y = bB() - p.radius; p.vy = -Math.abs(p.vy); }
    }
    const ea = actEnergy();
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.sqrt(dx * dx + dy * dy), md = a.radius + b.radius;
        if (dist < md && dist > 0) {
          const ol = (md - dist) / 2, nx = dx / dist, ny = dy / dist;
          a.x -= nx * ol; a.y -= ny * ol; b.x += nx * ol; b.y += ny * ol;
          const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (dvn > 0) { a.vx -= dvn * nx; a.vy -= dvn * ny; b.vx += dvn * nx; b.vy += dvn * ny; }
          if (a.type === "reactant" && b.type === "reactant") {
            if (0.5 * dvn * dvn > ea * 0.01 || Math.random() < 0.002 * (temperature / 300)) {
              b.type = "product"; b.hue = 140 + Math.random() * 20;
              flashes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, age: 0 });
              frameReactions++; reactionCount++;
            }
          }
        }
      }
    }
    for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].age += step; if (flashes[i].age > 0.6) flashes.splice(i, 1); }
    reactionHistory.push(frameReactions);
    if (reactionHistory.length > 60) reactionHistory.shift();
    reactionRate = reactionHistory.reduce((a, b) => a + b, 0) / Math.max(reactionHistory.length, 1) / Math.max(step, 0.001);
    time += step;
  }

  function drawBeaker(): void {
    const L = W * 0.1, R = W * 0.6, T = H * 0.15, B = H * 0.88;
    const lg = ctx.createLinearGradient(L, T + 30, L, B);
    lg.addColorStop(0, "rgba(56, 189, 248, 0.15)"); lg.addColorStop(1, "rgba(14, 165, 233, 0.25)");
    ctx.fillStyle = lg; ctx.fillRect(L + 5, T + 30, R - L - 10, B - T - 30);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B + 5); ctx.lineTo(R, B + 5); ctx.lineTo(R, T); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(L - 8, T); ctx.lineTo(L + 15, T); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R - 15, T); ctx.lineTo(R + 8, T); ctx.stroke();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(L + 6, T + 30); ctx.lineTo(R - 6, T + 30); ctx.stroke();
  }

  function drawParticles(): void {
    for (const p of particles) {
      const c = p.type === "reactant" ? `hsla(${p.hue},75%,55%,0.9)` : `hsla(${p.hue},70%,50%,0.9)`;
      const bg = ctx.createRadialGradient(p.x - p.radius * 0.3, p.y - p.radius * 0.3, 0, p.x, p.y, p.radius);
      bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.4, c); bg.addColorStop(1, p.type === "reactant" ? "#1e40af" : "#065f46");
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of flashes) {
      ctx.strokeStyle = `rgba(250,204,21,${1 - f.age / 0.6})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + f.age * 30, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawEnergyDiagram(): void {
    const dx = W * 0.64, dy = H * 0.05, dw = W * 0.33, dh = H * 0.38;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, 8); ctx.fill();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 12px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Activation Energy Diagram", dx + dw / 2, dy + 18);
    const pL = dx + 30, pR = dx + dw - 15, pT = dy + 30, pB = dy + dh - 20;
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pL, pT); ctx.lineTo(pL, pB); ctx.lineTo(pR, pB); ctx.stroke();
    const rY = pB - (pB - pT) * 0.25, prodY = pB - (pB - pT) * 0.15, ea = actEnergy();
    const peakY = pB - (pB - pT) * (0.25 + ea / 120);
    // Uncatalyzed
    ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 50; i++) {
      const t = i / 50, x = pL + t * (pR - pL);
      let y = t < 0.15 ? rY : t < 0.5 ? rY - (rY - peakY) * Math.sin(((t - 0.15) / 0.35) * Math.PI / 2) : t < 0.7 ? peakY + (prodY - peakY) * Math.sin(((t - 0.5) / 0.2) * Math.PI / 2) : prodY;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (catalystPresent) {
      const cpY = pB - (pB - pT) * (0.25 + 27 / 120);
      ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath();
      for (let i = 0; i <= 50; i++) {
        const t = i / 50, x = pL + t * (pR - pL);
        let y = t < 0.15 ? rY : t < 0.5 ? rY - (rY - cpY) * Math.sin(((t - 0.15) / 0.35) * Math.PI / 2) : t < 0.7 ? cpY + (prodY - cpY) * Math.sin(((t - 0.5) / 0.2) * Math.PI / 2) : prodY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = "#94a3b8"; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Ea = ${ea.toFixed(0)} kJ/mol`, pL + 5, pT + 12);
    if (catalystPresent) { ctx.fillStyle = "#10b981"; ctx.fillText("+ Catalyst", pL + 5, pT + 24); }
  }

  function drawInfoPanel(): void {
    const px = W * 0.64, py = H * 0.47, pw = W * 0.33, ph = H * 0.50;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 12px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Reaction Statistics", px + 12, py + 22);
    const nR = particles.filter(p => p.type === "reactant").length, nP = particles.filter(p => p.type === "product").length;
    ctx.font = "11px system-ui,sans-serif"; let y = py + 44; const lh = 20;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Time: ${time.toFixed(1)} s`, px + 12, y); y += lh;
    ctx.fillText(`Temperature: ${temperature.toFixed(0)} K`, px + 12, y); y += lh;
    ctx.fillText(`Concentration: ${concentration.toFixed(1)} mol/L`, px + 12, y); y += lh;
    ctx.fillStyle = "#3b82f6"; ctx.fillText(`Reactants: ${nR}`, px + 12, y); y += lh;
    ctx.fillStyle = "#10b981"; ctx.fillText(`Products: ${nP}`, px + 12, y); y += lh;
    ctx.fillStyle = "#fbbf24"; ctx.fillText(`Reactions: ${reactionCount}  Rate: ${reactionRate.toFixed(1)}/s`, px + 12, y); y += lh + 6;
    const pct = particles.length > 0 ? nP / particles.length : 0;
    ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(px + 12, y, pw - 24, 14, 4); ctx.fill();
    if (pct > 0) { ctx.fillStyle = "#10b981"; ctx.beginPath(); ctx.roundRect(px + 12, y, (pw - 24) * pct, 14, 4); ctx.fill(); }
    ctx.fillStyle = "#e2e8f0"; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${(pct * 100).toFixed(1)}% complete`, px + pw / 2, y + 10);
  }

  function render(): void {
    if (!ctx) return;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a"); bg.addColorStop(1, "#1e293b"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 16px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Reaction Rate of Solution", W * 0.35, H * 0.07);
    ctx.font = "11px system-ui,sans-serif"; ctx.fillStyle = "#64748b";
    ctx.fillText("Factors affecting chemical reaction rates", W * 0.35, H * 0.11);
    drawBeaker(); drawParticles(); drawEnergyDiagram(); drawInfoPanel();
  }

  function reset(): void { time = 0; createParticles(); }
  function destroy(): void { particles = []; flashes = []; }

  function getStateDescription(): string {
    const nR = particles.filter(p => p.type === "reactant").length, nP = particles.filter(p => p.type === "product").length;
    return `Reaction Rate of Solution: T=${temperature}K, conc=${concentration} mol/L, surfaceArea=${surfaceArea}x, catalyst=${catalystPresent ? "yes" : "no"}. ` +
      `Reactants: ${nR}, Products: ${nP}, Total: ${reactionCount}. Rate: ${reactionRate.toFixed(1)}/s. Ea=${actEnergy()} kJ/mol. Time: ${time.toFixed(1)}s.`;
  }

  function resize(w: number, h: number): void { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ReactionRateOfSolutionFactory;
