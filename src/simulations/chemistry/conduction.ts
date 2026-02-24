import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Conduction — Basic Heat Transfer Between Two Materials
 * Two compartments of different temperatures in contact.
 * Adjustable ratio slider controls relative amounts of each material.
 * Shows particle-level vibrations transferring energy and temperature
 * equilibrating over time. Graph tracks temperature vs time.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  temp: number;
  side: "hot" | "cold";
}

const ConductionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("conduction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let hotTemp = 80;
  let coldTemp = 10;
  let ratio = 50; // % of container that is hot side
  let conductivity = 5;

  let particles: Particle[] = [];
  const NUM_PARTICLES = 80;

  // Temperature history
  let hotHistory: number[] = [];
  let coldHistory: number[] = [];
  const MAX_HISTORY = 200;

  function containerBounds() {
    const m = width * 0.08;
    return {
      left: m,
      top: height * 0.12,
      right: width - m,
      bottom: height * 0.62,
      w: width - m * 2,
      h: height * 0.5,
    };
  }

  function dividerX(): number {
    const b = containerBounds();
    return b.left + b.w * (ratio / 100);
  }

  function speedForTemp(t: number): number {
    return Math.sqrt(Math.max(1, t + 273) / 273) * 60;
  }

  function spawnParticles() {
    particles = [];
    const b = containerBounds();
    const dx = dividerX();
    const nHot = Math.round(NUM_PARTICLES * (ratio / 100));
    const nCold = NUM_PARTICLES - nHot;

    for (let i = 0; i < nHot; i++) {
      const s = speedForTemp(hotTemp);
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x: b.left + Math.random() * (dx - b.left),
        y: b.top + Math.random() * b.h,
        vx: s * Math.cos(a) * (0.5 + Math.random()),
        vy: s * Math.sin(a) * (0.5 + Math.random()),
        temp: hotTemp,
        side: "hot",
      });
    }
    for (let i = 0; i < nCold; i++) {
      const s = speedForTemp(coldTemp);
      const a = Math.random() * Math.PI * 2;
      particles.push({
        x: dx + Math.random() * (b.right - dx),
        y: b.top + Math.random() * b.h,
        vx: s * Math.cos(a) * (0.5 + Math.random()),
        vy: s * Math.sin(a) * (0.5 + Math.random()),
        temp: coldTemp,
        side: "cold",
      });
    }

    hotHistory = [];
    coldHistory = [];
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    spawnParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newHot = params.hotTemp ?? 80;
    const newCold = params.coldTemp ?? 10;
    const newRatio = params.ratio ?? 50;
    conductivity = params.conductivity ?? 5;

    if (newHot !== hotTemp || newCold !== coldTemp || newRatio !== ratio) {
      hotTemp = newHot;
      coldTemp = newCold;
      ratio = newRatio;
      spawnParticles();
      time = 0;
      return;
    }

    const step = Math.min(dt, 0.025);
    const b = containerBounds();
    const r = 3;

    // Move particles
    for (const p of particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;

      if (p.x - r < b.left) { p.x = b.left + r; p.vx = Math.abs(p.vx); }
      if (p.x + r > b.right) { p.x = b.right - r; p.vx = -Math.abs(p.vx); }
      if (p.y - r < b.top) { p.y = b.top + r; p.vy = Math.abs(p.vy); }
      if (p.y + r > b.bottom) { p.y = b.bottom - r; p.vy = -Math.abs(p.vy); }
    }

    // Collisions — heat transfer
    const collR = r * 3 * (conductivity / 5);
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[j].x - particles[i].x;
        const dy = particles[j].y - particles[i].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < collR * collR && d2 > 0) {
          // Transfer energy (temperature equilibration)
          const avgTemp = (particles[i].temp + particles[j].temp) / 2;
          const rate = 0.1 * conductivity * step;
          particles[i].temp += (avgTemp - particles[i].temp) * rate;
          particles[j].temp += (avgTemp - particles[j].temp) * rate;

          // Adjust speeds to match temperature
          const sp_i = speedForTemp(particles[i].temp);
          const sp_j = speedForTemp(particles[j].temp);
          const mag_i = Math.sqrt(particles[i].vx ** 2 + particles[i].vy ** 2) || 1;
          const mag_j = Math.sqrt(particles[j].vx ** 2 + particles[j].vy ** 2) || 1;
          particles[i].vx *= sp_i / mag_i;
          particles[i].vy *= sp_i / mag_i;
          particles[j].vx *= sp_j / mag_j;
          particles[j].vy *= sp_j / mag_j;

          // Elastic bounce
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const dvn = (particles[i].vx - particles[j].vx) * nx + (particles[i].vy - particles[j].vy) * ny;
          if (dvn > 0) {
            particles[i].vx -= dvn * nx * 0.5;
            particles[i].vy -= dvn * ny * 0.5;
            particles[j].vx += dvn * nx * 0.5;
            particles[j].vy += dvn * ny * 0.5;
          }
        }
      }
    }

    // Record average temperatures
    let sumHot = 0, nHot = 0, sumCold = 0, nCold = 0;
    for (const p of particles) {
      if (p.side === "hot") { sumHot += p.temp; nHot++; }
      else { sumCold += p.temp; nCold++; }
    }
    hotHistory.push(nHot > 0 ? sumHot / nHot : hotTemp);
    coldHistory.push(nCold > 0 ? sumCold / nCold : coldTemp);
    if (hotHistory.length > MAX_HISTORY) hotHistory.shift();
    if (coldHistory.length > MAX_HISTORY) coldHistory.shift();

    time += step;
  }

  function tempColor(t: number): string {
    const frac = Math.min(1, Math.max(0, (t - 5) / 85));
    if (frac < 0.5) {
      const s = frac / 0.5;
      return `rgb(${Math.round(30 + 200 * s)},${Math.round(80 + 100 * s)},${Math.round(220 - 170 * s)})`;
    }
    const s = (frac - 0.5) / 0.5;
    return `rgb(255,${Math.round(180 - 140 * s)},${Math.round(50 - 40 * s)})`;
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const b = containerBounds();

    // Container
    ctx.fillStyle = "rgba(30,50,80,0.3)";
    ctx.fillRect(b.left, b.top, b.w, b.h);
    ctx.strokeStyle = "rgba(150,180,220,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.w, b.h);

    // Divider line (faint)
    const dx = dividerX();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(150,180,220,0.25)";
    ctx.beginPath();
    ctx.moveTo(dx, b.top);
    ctx.lineTo(dx, b.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Particles
    for (const p of particles) {
      const color = tempColor(p.temp);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Temperature graph
    const gLeft = b.left;
    const gTop = b.bottom + 20;
    const gW = b.w;
    const gH = height - gTop - 30;

    if (gH > 30) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(gLeft, gTop, gW, gH);
      ctx.strokeStyle = "rgba(150,180,220,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(gLeft, gTop, gW, gH);

      // Hot line
      if (hotHistory.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < hotHistory.length; i++) {
          const x = gLeft + (i / MAX_HISTORY) * gW;
          const y = gTop + gH - ((hotHistory[i] - 5) / 85) * gH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Cold line
      if (coldHistory.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < coldHistory.length; i++) {
          const x = gLeft + (i / MAX_HISTORY) * gW;
          const y = gTop + gH - ((coldHistory[i] - 5) / 85) * gH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Labels
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Hot: ${hotHistory[hotHistory.length - 1]?.toFixed(1) ?? ""}°C`, gLeft + gW - 4, gTop + 14);
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`Cold: ${coldHistory[coldHistory.length - 1]?.toFixed(1) ?? ""}°C`, gLeft + gW - 4, gTop + 28);
    }

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Heat Conduction", width / 2, height - 8);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    spawnParticles();
  }

  function destroy(): void { particles = []; hotHistory = []; coldHistory = []; }

  function getStateDescription(): string {
    const avgHot = hotHistory.length > 0 ? hotHistory[hotHistory.length - 1] : hotTemp;
    const avgCold = coldHistory.length > 0 ? coldHistory[coldHistory.length - 1] : coldTemp;
    return (
      `Heat Conduction: hot side avg ${avgHot.toFixed(1)}°C, cold side avg ${avgCold.toFixed(1)}°C. ` +
      `Ratio: ${ratio}% hot. Conductivity: ${conductivity}. ` +
      `Heat transfers from hot to cold via molecular collisions until thermal equilibrium. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    spawnParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ConductionFactory;
