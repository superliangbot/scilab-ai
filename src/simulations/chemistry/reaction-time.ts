import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Bubble { x: number; y: number; vy: number; radius: number; alpha: number; wobble: number; }
interface Chunk { x: number; y: number; radius: number; rate: number; }

const ReactionTimeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("reaction-time") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600, time = 0;
  let temperature = 40, particleSize = 3, stirring = 0, concentration = 1.0;
  let bubbles: Bubble[] = [], chunks: Chunk[] = [];
  let dissolutionPct = 0, totalMass = 0, remainingMass = 0, stirAngle = 0;

  const bL = () => W * 0.15, bR = () => W * 0.60, bT = () => H * 0.12, bB = () => H * 0.88;
  const liqTop = () => bT() + 30;

  function dissolveSpeed(): number {
    return (1 + (temperature - 10) / 35) * (6 / Math.max(particleSize, 0.5)) * (1 + stirring * 0.4) * Math.max(0.2, 2.0 - concentration) * 0.6;
  }

  function createTablet(): void {
    chunks = []; bubbles = []; dissolutionPct = 0; time = 0; totalMass = 0;
    const cx = (bL() + bR()) / 2, cy = bB() - 50, baseR = 4 + particleSize * 4;
    const n = Math.max(3, Math.round(18 / particleSize));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, d = i === 0 ? 0 : baseR * 0.6 * (0.5 + Math.random() * 0.5);
      const r = baseR * (0.3 + Math.random() * 0.5);
      chunks.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.5, radius: r, rate: 0.8 + Math.random() * 0.4 });
      totalMass += r * r;
    }
    remainingMass = totalMass;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!; W = canvas.width; H = canvas.height; createTablet();
  }

  function update(dt: number, params: Record<string, number>): void {
    const nT = params.temperature ?? 40, nS = params.particleSize ?? 3;
    const nSt = params.stirring ?? 0, nC = params.concentration ?? 1.0;
    if (Math.abs(nS - particleSize) > 0.5) { particleSize = nS; temperature = nT; stirring = nSt; concentration = nC; createTablet(); return; }
    temperature = nT; particleSize = nS; stirring = nSt; concentration = nC;
    const step = Math.min(dt, 0.033), spd = dissolveSpeed();
    stirAngle += stirring * 3 * step;
    remainingMass = 0;
    for (let i = chunks.length - 1; i >= 0; i--) {
      const ch = chunks[i];
      ch.radius -= spd * ch.rate * step * 0.4;
      if (stirring > 0) { ch.x += Math.cos(stirAngle + i) * stirring * 0.3 * step; ch.y += Math.sin(stirAngle + i) * stirring * 0.15 * step; }
      if (Math.random() < spd * step * 0.8 && ch.radius > 0.5) {
        bubbles.push({ x: ch.x + (Math.random() - 0.5) * ch.radius * 2, y: ch.y - ch.radius * (0.5 + Math.random() * 0.5),
          vy: -(30 + Math.random() * 60 + temperature * 0.5), radius: 1 + Math.random() * 3, alpha: 0.5 + Math.random() * 0.4, wobble: Math.random() * Math.PI * 2 });
      }
      if (ch.radius <= 0.3) chunks.splice(i, 1); else remainingMass += ch.radius * ch.radius;
    }
    dissolutionPct = totalMass > 0 ? Math.min(100, ((totalMass - remainingMass) / totalMass) * 100) : 100;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.y += b.vy * step; b.wobble += 5 * step; b.x += Math.sin(b.wobble) * 0.5; b.alpha -= step * 0.3;
      if (b.y < liqTop() || b.alpha <= 0) bubbles.splice(i, 1);
    }
    if (bubbles.length > 200) bubbles.splice(0, bubbles.length - 200);
    time += step;
  }

  function drawBeaker(): void {
    const L = bL(), R = bR(), T = bT(), B = bB(), lt = liqTop();
    const hue = 200 - dissolutionPct * 0.8;
    const lg = ctx.createLinearGradient(L, lt, L, B);
    lg.addColorStop(0, `hsla(${hue},60%,55%,0.18)`); lg.addColorStop(1, `hsla(${hue},50%,35%,0.35)`);
    ctx.fillStyle = lg; ctx.fillRect(L + 4, lt, R - L - 8, B - lt);
    if (temperature > 50) { ctx.fillStyle = `rgba(239,68,68,${(temperature - 50) / 30 * 0.06})`; ctx.fillRect(L + 4, lt, R - L - 8, B - lt); }
    ctx.strokeStyle = "rgba(148,163,184,0.6)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B + 4); ctx.lineTo(R, B + 4); ctx.lineTo(R, T); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(L - 8, T); ctx.lineTo(L + 12, T); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R - 12, T); ctx.lineTo(R + 8, T); ctx.stroke();
    ctx.strokeStyle = `hsla(${hue},60%,60%,0.4)`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(L + 5, lt); ctx.lineTo(R - 5, lt); ctx.stroke();
    // Graduation marks
    ctx.strokeStyle = "rgba(148,163,184,0.25)"; ctx.lineWidth = 1; ctx.font = "8px system-ui,sans-serif"; ctx.fillStyle = "rgba(148,163,184,0.4)"; ctx.textAlign = "left";
    for (let i = 1; i <= 4; i++) { const my = B - (B - lt) * (i / 5); ctx.beginPath(); ctx.moveTo(L + 5, my); ctx.lineTo(L + 18, my); ctx.stroke(); ctx.fillText(`${i * 50}`, L + 20, my + 3); }
  }

  function drawTablet(): void {
    for (const ch of chunks) {
      const g = ctx.createRadialGradient(ch.x - ch.radius * 0.3, ch.y - ch.radius * 0.3, 0, ch.x, ch.y, ch.radius);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#e2e8f0"); g.addColorStop(1, "#94a3b8");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ch.x, ch.y, ch.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(100,116,139,0.5)"; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(dissolveSpeed() * 0.05, 0.5)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ch.x, ch.y, ch.radius + 2, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawBubbles(): void {
    for (const b of bubbles) {
      const g = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, 0, b.x, b.y, b.radius);
      g.addColorStop(0, `rgba(255,255,255,${b.alpha * 0.6})`); g.addColorStop(1, `rgba(150,200,255,${b.alpha * 0.1})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawStirIndicator(): void {
    if (stirring <= 0) return;
    const cx = (bL() + bR()) / 2, cy = (liqTop() + bB()) / 2, r = 30 + stirring * 8;
    ctx.strokeStyle = `rgba(147,197,253,${0.15 + stirring * 0.06})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, stirAngle, stirAngle + Math.PI * 1.5); ctx.stroke();
    const ea = stirAngle + Math.PI * 1.5, ax = cx + Math.cos(ea) * r, ay = cy + Math.sin(ea) * r;
    ctx.fillStyle = `rgba(147,197,253,${0.2 + stirring * 0.08})`;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(ea + 0.5) * 8, ay + Math.sin(ea + 0.5) * 8);
    ctx.lineTo(ax + Math.cos(ea - 0.5) * 8, ay + Math.sin(ea - 0.5) * 8); ctx.closePath(); ctx.fill();
  }

  function drawInfoPanel(): void {
    const px = W * 0.64, py = H * 0.08, pw = W * 0.33, ph = H * 0.84;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 13px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Dissolution Monitor", px + 14, py + 24);
    ctx.font = "11px system-ui,sans-serif"; ctx.fillStyle = "#94a3b8"; let y = py + 50; const lh = 22;
    ctx.fillText(`Elapsed Time: ${time.toFixed(1)} s`, px + 14, y); y += lh;
    ctx.fillText(`Temperature: ${temperature.toFixed(0)} \u00B0C`, px + 14, y); y += lh;
    ctx.fillText(`Particle Size: ${particleSize.toFixed(1)} mm`, px + 14, y); y += lh;
    ctx.fillText(`Stirring Speed: ${stirring.toFixed(1)}`, px + 14, y); y += lh;
    ctx.fillText(`Concentration: ${concentration.toFixed(2)} mol/L`, px + 14, y); y += lh;
    ctx.fillText(`Dissolve Rate: ${dissolveSpeed().toFixed(2)}x`, px + 14, y); y += lh;
    ctx.fillText(`Chunks: ${chunks.length}  Bubbles: ${bubbles.length}`, px + 14, y); y += lh + 8;
    // Progress bar
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 12px system-ui,sans-serif"; ctx.fillText("Dissolution Progress", px + 14, y); y += 18;
    const bw = pw - 28;
    ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(px + 14, y, bw, 20, 6); ctx.fill();
    const pct = dissolutionPct / 100;
    if (pct > 0) { ctx.fillStyle = "#06b6d4"; ctx.beginPath(); ctx.roundRect(px + 14, y, bw * pct, 20, 6); ctx.fill(); }
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 10px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`${dissolutionPct.toFixed(1)}%`, px + 14 + bw / 2, y + 14); y += 30;
    ctx.textAlign = "left";
    if (dissolutionPct >= 99.5) {
      ctx.fillStyle = "#10b981"; ctx.font = "bold 12px system-ui,sans-serif"; ctx.fillText("REACTION COMPLETE", px + 14, y);
      ctx.font = "10px system-ui,sans-serif"; ctx.fillStyle = "#94a3b8"; ctx.fillText(`Completed in ${time.toFixed(1)} s`, px + 14, y + 16);
    } else { ctx.fillStyle = "#fbbf24"; ctx.font = "11px system-ui,sans-serif"; ctx.fillText("Reaction in progress...", px + 14, y); }
    y += 36; ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px system-ui,sans-serif"; ctx.fillText("Factor Effects:", px + 14, y); y += 16;
    ctx.font = "9px system-ui,sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText("\u2191 Temperature \u2192 Faster dissolving", px + 14, y); y += 14;
    ctx.fillText("\u2193 Particle size \u2192 More surface area", px + 14, y); y += 14;
    ctx.fillText("\u2191 Stirring \u2192 Better solvent contact", px + 14, y);
  }

  function drawThermometer(): void {
    const tx = bL() - 28, tT = bT() + 30, tB = bB() - 10, tH = tB - tT, frac = (temperature - 10) / 70, fH = tH * frac;
    ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(tx - 4, tT, 8, tH, 4); ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
    const tg = ctx.createLinearGradient(tx, tB - fH, tx, tB);
    tg.addColorStop(0, "#ef4444"); tg.addColorStop(1, "#b91c1c");
    ctx.fillStyle = tg; ctx.beginPath(); ctx.roundRect(tx - 3, tB - fH, 6, fH, 3); ctx.fill();
    ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(tx, tB + 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`${temperature}\u00B0C`, tx - 10, tB - fH + 4);
  }

  function render(): void {
    if (!ctx) return;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a"); bg.addColorStop(1, "#1e293b"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 16px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Reaction Time (Dissolution)", W * 0.375, H * 0.06);
    ctx.font = "11px system-ui,sans-serif"; ctx.fillStyle = "#64748b"; ctx.fillText("Dissolving a tablet in water", W * 0.375, H * 0.10);
    drawBeaker(); drawStirIndicator(); drawTablet(); drawBubbles(); drawThermometer(); drawInfoPanel();
  }

  function reset(): void { time = 0; createTablet(); }
  function destroy(): void { chunks = []; bubbles = []; }

  function getStateDescription(): string {
    return `Reaction Time: T=${temperature}\u00B0C, size=${particleSize}mm, stirring=${stirring}, conc=${concentration} mol/L. ` +
      `Dissolution: ${dissolutionPct.toFixed(1)}%, chunks: ${chunks.length}, bubbles: ${bubbles.length}. Time: ${time.toFixed(1)}s.`;
  }

  function resize(w: number, h: number): void { W = w; H = h; }
  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ReactionTimeFactory;
