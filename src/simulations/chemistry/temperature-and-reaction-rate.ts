import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TemperatureAndReactionRateFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("temperature-and-reaction-rate") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800, height = 600, time = 0;
  let temperature = 300, activationEnergy = 40, numParticles = 50;

  interface Particle { x: number; y: number; vx: number; vy: number; speed: number; flash: number; }
  let particles: Particle[] = [];
  let reactionCount = 0;
  let reactionFlashes: Array<{ x: number; y: number; life: number }> = [];
  const R = 8.314, A = 1e13;

  function bounds() { return { x: 20, y: 50, w: width * 0.45, h: height * 0.5 }; }

  function mbSpeed(): number {
    const sigma = Math.sqrt(1.38e-23 * temperature / 4.65e-26);
    const u1 = Math.random(), u2 = Math.random();
    return Math.abs(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)) * sigma * 1e-9 * 80;
  }

  function initParticles(): void {
    particles = []; reactionCount = 0; reactionFlashes = [];
    const b = bounds();
    for (let i = 0; i < numParticles; i++) {
      const speed = mbSpeed(), angle = Math.random() * Math.PI * 2;
      particles.push({ x: b.x + 10 + Math.random() * (b.w - 20), y: b.y + 10 + Math.random() * (b.h - 20),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, flash: 0 });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!;
    width = canvas.width; height = canvas.height; time = 0;
    initParticles();
  }

  function rateConstant(): number { return A * Math.exp((-activationEnergy * 1000) / (R * temperature)); }

  function update(dt: number, params: Record<string, number>): void {
    const newNum = Math.round(params.numParticles ?? 50);
    if (newNum !== numParticles) { numParticles = newNum; initParticles(); }
    temperature = params.temperature ?? 300;
    activationEnergy = params.activationEnergy ?? 40;
    time += dt;
    const b = bounds(), scaledDt = dt * 1.5;

    for (const p of particles) {
      p.speed = mbSpeed();
      const cs = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (cs > 0.01) { const r = p.speed / cs; p.vx = p.vx * 0.95 + p.vx * r * 0.05; p.vy = p.vy * 0.95 + p.vy * r * 0.05; }
      p.x += p.vx * scaledDt; p.y += p.vy * scaledDt;
      if (p.x < b.x + 5) { p.x = b.x + 5; p.vx = Math.abs(p.vx); }
      if (p.x > b.x + b.w - 5) { p.x = b.x + b.w - 5; p.vx = -Math.abs(p.vx); }
      if (p.y < b.y + 5) { p.y = b.y + 5; p.vy = Math.abs(p.vy); }
      if (p.y > b.y + b.h - 5) { p.y = b.y + b.h - 5; p.vy = -Math.abs(p.vy); }
      p.speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (p.flash > 0) p.flash -= dt * 3;
    }

    const eaT = activationEnergy * 0.6;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 12) {
          if (particles[i].speed + particles[j].speed > eaT) {
            reactionCount++; particles[i].flash = 1; particles[j].flash = 1;
            reactionFlashes.push({ x: (particles[i].x + particles[j].x) / 2, y: (particles[i].y + particles[j].y) / 2, life: 0.5 });
          }
          const nx = dx / dist, ny = dy / dist;
          const dot = (particles[i].vx - particles[j].vx) * nx + (particles[i].vy - particles[j].vy) * ny;
          if (dot > 0) { particles[i].vx -= dot * nx; particles[i].vy -= dot * ny; particles[j].vx += dot * nx; particles[j].vy += dot * ny; }
        }
      }
    }
    for (let i = reactionFlashes.length - 1; i >= 0; i--) { reactionFlashes[i].life -= dt; if (reactionFlashes[i].life <= 0) reactionFlashes.splice(i, 1); }
  }

  function drawMaxwellBoltzmann(): void {
    const gX = width * 0.52, gY = 50, gW = width * 0.44, gH = height * 0.42;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(gX - 5, gY - 5, gW + 10, gH + 40, 6); ctx.fill();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Maxwell-Boltzmann Energy Distribution", gX + gW / 2, gY + 10);

    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(gX + 30, gY + gH - 15); ctx.lineTo(gX + gW - 10, gY + gH - 15);
    ctx.moveTo(gX + 30, gY + gH - 15); ctx.lineTo(gX + 30, gY + 20); ctx.stroke();
    ctx.fillStyle = "#94a3b8"; ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Kinetic Energy", gX + gW / 2, gY + gH + 20);
    ctx.save(); ctx.translate(gX + 12, gY + gH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("Fraction of molecules", 0, 0); ctx.restore();

    const maxE = 150, steps = 100, plotW = gW - 50, plotH = gH - 45, baseY = gY + gH - 15, startX = gX + 30;
    const kT = 1.38e-23 * temperature * 6.022e23 / 1000;
    let maxVal = 0; const values: number[] = [];
    for (let i = 0; i <= steps; i++) { const E = (i / steps) * maxE; const val = Math.sqrt(E) * Math.exp(-E / (kT * 8)); values.push(val); if (val > maxVal) maxVal = val; }

    const eaFrac = activationEnergy / maxE, eaX = startX + eaFrac * plotW;
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(eaX, baseY); ctx.lineTo(eaX, gY + 25); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#ef4444"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Ea", eaX, gY + 22);

    if (maxVal > 0) {
      ctx.fillStyle = "rgba(239,68,68,0.15)"; ctx.beginPath(); ctx.moveTo(eaX, baseY);
      for (let i = 0; i <= steps; i++) { const px = startX + (i / steps) * plotW; if (px >= eaX) ctx.lineTo(px, baseY - (values[i] / maxVal) * plotH); }
      ctx.lineTo(startX + plotW, baseY); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= steps; i++) { const px = startX + (i / steps) * plotW, py = baseY - (maxVal > 0 ? (values[i] / maxVal) * plotH : 0); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.stroke();
  }

  function drawInfoPanel(): void {
    const pX = 10, pY = height * 0.62, pW = width - 20, pH = height * 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(pX, pY, pW, pH, 8); ctx.fill();
    ctx.textAlign = "left"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Arrhenius Equation & Reaction Kinetics", pX + 12, pY + 20);
    ctx.font = "bold 13px system-ui, sans-serif"; ctx.fillStyle = "#fbbf24";
    ctx.fillText("k = A * exp(-Ea / RT)", pX + 12, pY + 42);

    const k = rateConstant(), y0 = pY + 62, lH = 17, col2 = pX + pW * 0.52;
    ctx.font = "11px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Temperature (T): ${temperature} K  (${(temperature - 273.15).toFixed(1)} C)`, pX + 12, y0);
    ctx.fillText(`Activation Energy (Ea): ${activationEnergy} kJ/mol`, col2, y0);
    ctx.fillText(`Rate Constant (k): ${k.toExponential(3)} s^-1`, pX + 12, y0 + lH);
    ctx.fillText(`Pre-exponential Factor (A): ${A.toExponential(1)} s^-1`, col2, y0 + lH);
    ctx.fillText(`Gas Constant (R): ${R.toFixed(3)} J/(mol*K)`, pX + 12, y0 + lH * 2);
    ctx.fillText(`Successful Collisions: ${reactionCount}`, col2, y0 + lH * 2);

    const k10 = A * Math.exp((-activationEnergy * 1000) / (R * (temperature + 10)));
    ctx.fillStyle = "#67e8f9"; ctx.fillText(`Rate at T+10K: ${k10.toExponential(3)} s^-1  (ratio: ${(k10 / k).toFixed(2)}x)`, pX + 12, y0 + lH * 3);
    ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Higher T shifts Maxwell-Boltzmann right, more molecules exceed Ea. ~10 C rise roughly doubles rate.", pX + 12, y0 + lH * 4 + 4);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#1e293b"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
    ctx.fillText("Temperature and Reaction Rate", width / 2, 30);

    const b = bounds();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "rgba(30,41,59,0.6)"; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#94a3b8"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Reaction Container", b.x + b.w / 2, b.y + b.h + 15);

    for (const f of reactionFlashes) {
      const r = (1 - f.life / 0.5) * 20 + 5;
      const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      glow.addColorStop(0, `rgba(251,191,36,${f.life * 1.5})`); glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
    }

    const eaT = activationEnergy * 0.6;
    for (const p of particles) {
      const sr = Math.min(p.speed / (eaT * 1.5), 1);
      const r = sr < 0.5 ? 0 : Math.floor((sr - 0.5) * 2 * 255);
      const g = sr < 0.5 ? Math.floor(sr * 2 * 255) : Math.floor((1 - (sr - 0.5) * 2) * 255);
      const bl = sr < 0.5 ? Math.floor((1 - sr * 2) * 255) : 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.flash > 0 ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${bl},${p.flash > 0 ? 1 : 0.85})`; ctx.fill();
      if (p.flash > 0) {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
        glow.addColorStop(0, `rgba(251,191,36,${p.flash * 0.5})`); glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
      }
    }

    const legX = b.x + 5, legY = b.y + b.h - 15, legW = 80;
    const legGrad = ctx.createLinearGradient(legX, 0, legX + legW, 0);
    legGrad.addColorStop(0, "#3b82f6"); legGrad.addColorStop(0.5, "#22c55e"); legGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = legGrad; ctx.fillRect(legX, legY, legW, 6);
    ctx.fillStyle = "#94a3b8"; ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.fillText("Slow", legX, legY + 14);
    ctx.textAlign = "right"; ctx.fillText("Fast", legX + legW, legY + 14);

    drawMaxwellBoltzmann();
    drawInfoPanel();
  }

  function reset(): void { time = 0; reactionCount = 0; reactionFlashes = []; initParticles(); }
  function destroy(): void { particles = []; reactionFlashes = []; }

  function getStateDescription(): string {
    const k = rateConstant();
    return `Temperature & Reaction Rate: T=${temperature} K, Ea=${activationEnergy} kJ/mol. ` +
      `Rate constant k=${k.toExponential(3)} s^-1 (Arrhenius: k=A*exp(-Ea/RT)). ` +
      `${numParticles} particles, ${reactionCount} successful collisions. ` +
      `Higher temperature shifts Maxwell-Boltzmann distribution to higher energies, increasing the fraction exceeding Ea.`;
  }

  function resize(w: number, h: number): void { width = w; height = h; }
  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TemperatureAndReactionRateFactory;
