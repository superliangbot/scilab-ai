import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const GraphOfCharlesLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("graph-of-charles-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let temperature = 300; // K
  let pressure = 1; // atm (constant)
  let moles = 1;
  let showAbsoluteZero = 1;

  // Gas constant
  const R = 0.0821; // L·atm/(mol·K)

  // Current volume (Charles' Law: V = nRT/P)
  let volume = 0;

  // Particles for visualization
  const particles: Particle[] = [];
  const NUM_PARTICLES = 40;

  // Data points collected
  const dataPoints: Array<{ T: number; V: number }> = [];

  function computeVolume(): number {
    return (moles * R * temperature) / Math.max(pressure, 0.01);
  }

  function containerBounds() {
    const vol = computeVolume();
    const maxVol = (moles * R * 600) / pressure;
    const frac = vol / maxVol;
    const maxH = H * 0.5;
    const ch = maxH * frac;
    const cw = W * 0.22;
    return {
      x: W * 0.06,
      y: H * 0.1 + (maxH - ch),
      w: cw,
      h: Math.max(ch, 30),
    };
  }

  function initParticles(): void {
    particles.length = 0;
    const cb = containerBounds();
    const speed = Math.sqrt(temperature) * 0.5;
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: cb.x + 5 + Math.random() * (cb.w - 10),
        y: cb.y + 5 + Math.random() * (cb.h - 10),
        vx: speed * Math.cos(angle) * (0.5 + Math.random()),
        vy: speed * Math.sin(angle) * (0.5 + Math.random()),
      });
    }
  }

  function reset(): void {
    time = 0;
    volume = computeVolume();
    dataPoints.length = 0;
    initParticles();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newT = params.temperature ?? 300;
    const newP = params.pressure ?? 1;
    const newN = params.moles ?? 1;
    const newSAZ = params.showAbsoluteZero ?? 1;

    if (newP !== pressure || newN !== moles) {
      pressure = newP;
      moles = newN;
      reset();
    }

    if (newT !== temperature) {
      const ratio = Math.sqrt(newT / Math.max(temperature, 1));
      for (const p of particles) {
        p.vx *= ratio;
        p.vy *= ratio;
      }
      temperature = newT;
      volume = computeVolume();
    }
    showAbsoluteZero = newSAZ;

    time += dt;

    const cb = containerBounds();

    // Move particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < cb.x + 3) { p.x = cb.x + 3; p.vx = Math.abs(p.vx); }
      if (p.x > cb.x + cb.w - 3) { p.x = cb.x + cb.w - 3; p.vx = -Math.abs(p.vx); }
      if (p.y < cb.y + 3) { p.y = cb.y + 3; p.vy = Math.abs(p.vy); }
      if (p.y > cb.y + cb.h - 3) { p.y = cb.y + cb.h - 3; p.vy = -Math.abs(p.vy); }

      p.x = Math.max(cb.x + 3, Math.min(cb.x + cb.w - 3, p.x));
      p.y = Math.max(cb.y + 3, Math.min(cb.y + cb.h - 3, p.y));
    }

    // Record data point
    const lastPt = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1] : null;
    if (!lastPt || Math.abs(lastPt.T - temperature) > 2) {
      dataPoints.push({ T: temperature, V: volume });
      if (dataPoints.length > 200) dataPoints.shift();
    }
  }

  function drawContainer(): void {
    const cb = containerBounds();
    const maxVol = (moles * R * 600) / pressure;
    const maxH = H * 0.5;

    // Container outline (fixed width, variable height)
    ctx.strokeStyle = "#546e7a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cb.x, H * 0.1, cb.w, maxH);
    ctx.stroke();

    // Gas fill
    ctx.fillStyle = "rgba(66, 165, 245, 0.15)";
    ctx.fillRect(cb.x, cb.y, cb.w, cb.h);

    // Piston (top of gas)
    ctx.fillStyle = "#455a64";
    ctx.fillRect(cb.x - 3, cb.y - 5, cb.w + 6, 10);
    ctx.fillStyle = "#78909c";
    for (let i = 0; i < cb.w; i += 10) {
      ctx.fillRect(cb.x + i, cb.y - 3, 5, 6);
    }

    // Weight on piston showing constant pressure
    ctx.fillStyle = "#37474f";
    ctx.fillRect(cb.x + cb.w * 0.2, cb.y - 30, cb.w * 0.6, 22);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`P=${pressure} atm`, cb.x + cb.w / 2, cb.y - 15);

    // Volume label
    ctx.fillStyle = "#42a5f5";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`V = ${volume.toFixed(2)} L`, cb.x + cb.w / 2, H * 0.1 + maxH + 18);

    // Temperature indicator (flames/ice)
    const tempFrac = temperature / 600;
    if (tempFrac > 0.3) {
      for (let i = 0; i < 4; i++) {
        const fx = cb.x + cb.w * (0.15 + i * 0.25);
        const fy = H * 0.1 + maxH + 5;
        const flameH = 8 + tempFrac * 18 + Math.sin(time * 6 + i * 2) * 4;
        const grad = ctx.createLinearGradient(fx, fy + flameH, fx, fy);
        grad.addColorStop(0, "rgba(255, 87, 34, 0)");
        grad.addColorStop(0.5, `rgba(255, ${Math.floor(100 + tempFrac * 100)}, 0, 0.5)`);
        grad.addColorStop(1, "rgba(255, 235, 59, 0.7)");
        ctx.beginPath();
        ctx.moveTo(fx - 4, fy + flameH);
        ctx.quadraticCurveTo(fx, fy, fx + 4, fy + flameH);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
  }

  function drawParticles(): void {
    const cb = containerBounds();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cb.x, cb.y, cb.w, cb.h);
    ctx.clip();

    for (const p of particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSpeed = Math.sqrt(600) * 1.5;
      const frac = Math.min(speed / maxSpeed, 1);
      const r = Math.floor(50 + frac * 200);
      const g = Math.floor(120 + (1 - frac) * 60);
      const b = Math.floor(240 - frac * 180);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawVTGraph(): void {
    const gx = W * 0.35;
    const gy = H * 0.05;
    const gw = W * 0.6;
    const gh = H * 0.55;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Charles' Law: V vs T (at constant P)", gx + gw / 2, gy + 18);

    const px = gx + 55;
    const py = gy + 38;
    const pw = gw - 75;
    const ph = gh - 60;

    // Temperature range: include absolute zero if enabled
    const tMin = showAbsoluteZero >= 0.5 ? -273.15 : 0;
    const tMax = 650;
    const tRange = tMax - tMin;

    const maxV = (moles * R * 600) / Math.max(pressure, 0.01) * 1.1;

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let t = 0; t <= 600; t += 100) {
      const x = px + ((t - tMin) / tRange) * pw;
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x, py + ph);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${t}K`, x, py + ph + 12);
    }

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature (K)", px + pw / 2, py + ph + 28);
    ctx.save();
    ctx.translate(px - 38, py + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Volume (L)", 0, 0);
    ctx.restore();

    // Absolute zero line
    if (showAbsoluteZero >= 0.5) {
      const azX = px + ((0 - tMin) / tRange) * pw;
      // Also show -273.15°C point
      const azLineX = px + ((-273.15 - tMin) / tRange) * pw;
      ctx.strokeStyle = "rgba(100, 181, 246, 0.5)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(azLineX, py);
      ctx.lineTo(azLineX, py + ph);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#42a5f5";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("0 K", azLineX, py - 6);
      ctx.fillText("(-273.15°C)", azLineX, py - 18);
    }

    // Theoretical Charles' Law line: V = (nR/P) * T
    // This is a straight line through origin (0K, 0L)
    ctx.strokeStyle = "rgba(255, 152, 0, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = Math.max(0, tMin); t <= tMax; t += 5) {
      const v = (moles * R * t) / Math.max(pressure, 0.01);
      const x = px + ((t - tMin) / tRange) * pw;
      const y = py + ph - (v / maxV) * ph;
      if (t === Math.max(0, tMin)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Extrapolation to absolute zero (dashed)
    if (showAbsoluteZero >= 0.5) {
      ctx.strokeStyle = "rgba(255, 152, 0, 0.3)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const x0 = px + ((0 - tMin) / tRange) * pw;
      const y0 = py + ph;
      const x1 = px + ((100 - tMin) / tRange) * pw;
      const v1 = (moles * R * 100) / Math.max(pressure, 0.01);
      const y1 = py + ph - (v1 / maxV) * ph;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Data points
    for (const dp of dataPoints) {
      const x = px + ((dp.T - tMin) / tRange) * pw;
      const y = py + ph - (dp.V / maxV) * ph;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#66bb6a";
      ctx.fill();
    }

    // Current state point
    const curX = px + ((temperature - tMin) / tRange) * pw;
    const curY = py + ph - (volume / maxV) * ph;
    ctx.beginPath();
    ctx.arc(curX, curY, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ff5722";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Legend
    ctx.fillStyle = "#ffa726";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("— V = nRT/P (Charles' Law)", px + 5, py + 12);
    ctx.fillStyle = "#66bb6a";
    ctx.fillText("● Measured points", px + 5, py + 24);
  }

  function drawInfo(): void {
    const ix = W * 0.35;
    const iy = H * 0.64;
    const iw = W * 0.6;
    const ih = H * 0.32;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(ix, iy, iw, ih, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Charles' Law (Jacques Charles, 1787)", ix + 15, iy + 18);

    ctx.font = "12px monospace";
    let y = iy + 40;

    ctx.fillStyle = "#ffa726";
    ctx.fillText("V₁/T₁ = V₂/T₂   (at constant pressure)", ix + 15, y);
    y += 22;
    ctx.fillStyle = "#42a5f5";
    ctx.fillText(`V = nRT/P = ${moles}×${R}×${temperature}/${pressure} = ${volume.toFixed(2)} L`, ix + 15, y);
    y += 22;

    ctx.fillStyle = "#ccc";
    ctx.font = "11px sans-serif";
    ctx.fillText(`Temperature: ${temperature} K (${(temperature - 273.15).toFixed(1)}°C)`, ix + 15, y);
    y += 18;
    ctx.fillText(`Pressure: ${pressure} atm (constant)`, ix + 15, y);
    y += 18;
    ctx.fillText(`Moles: ${moles} mol`, ix + 15, y);
    y += 22;

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px sans-serif";
    ctx.fillText("Volume is directly proportional to temperature at constant pressure.", ix + 15, y);
    y += 14;
    ctx.fillText("Extrapolating to V=0 gives absolute zero: −273.15°C = 0 K.", ix + 15, y);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1a2940");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawContainer();
    drawParticles();
    drawVTGraph();
    drawInfo();
  }

  function destroy(): void {
    particles.length = 0;
    dataPoints.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Charles' Law Graph: V vs T at constant pressure. ` +
      `T=${temperature}K (${(temperature - 273.15).toFixed(1)}°C), P=${pressure} atm, n=${moles} mol. ` +
      `Volume = nRT/P = ${volume.toFixed(2)} L. ` +
      `Charles' Law states V₁/T₁ = V₂/T₂ at constant pressure. ` +
      `The V-T graph is a straight line that extrapolates to V=0 at absolute zero (0 K = −273.15°C).`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GraphOfCharlesLawFactory;
