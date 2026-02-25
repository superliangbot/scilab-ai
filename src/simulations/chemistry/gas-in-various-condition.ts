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

const GasInVariousConditionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gas-in-various-condition") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let temperature = 300; // K
  let pressure = 1; // atm
  let volume = 50; // percentage of max
  let gasType = 0; // 0=ideal, 1=real (van der Waals)

  const NUM_PARTICLES = 60;
  const particles: Particle[] = [];

  // Derived values
  let computedV = 0;
  let computedP = 0;
  let computedT = 0;

  // PV diagram data
  const pvData: Array<{ p: number; v: number }> = [];

  function containerBounds() {
    const maxW = W * 0.35;
    const h = H * 0.5;
    const cw = maxW * (volume / 100);
    return {
      x: W * 0.08,
      y: H * 0.15,
      w: Math.max(cw, 40),
      h: h,
    };
  }

  function initParticles(): void {
    particles.length = 0;
    const cb = containerBounds();
    const speed = Math.sqrt(temperature) * 0.8;
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: cb.x + 10 + Math.random() * (cb.w - 20),
        y: cb.y + 10 + Math.random() * (cb.h - 20),
        vx: speed * Math.cos(angle) * (0.5 + Math.random()),
        vy: speed * Math.sin(angle) * (0.5 + Math.random()),
      });
    }
  }

  function reset(): void {
    time = 0;
    pvData.length = 0;
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
    const newV = params.volume ?? 50;
    const newGT = params.gasType ?? 0;

    if (newT !== temperature) {
      const ratio = Math.sqrt(newT / Math.max(temperature, 1));
      for (const p of particles) {
        p.vx *= ratio;
        p.vy *= ratio;
      }
      temperature = newT;
    }

    if (newV !== volume || newP !== pressure || newGT !== gasType) {
      pressure = newP;
      volume = newV;
      gasType = newGT;
    }

    time += dt;

    const cb = containerBounds();

    // Move particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wall bounces
      if (p.x < cb.x + 3) { p.x = cb.x + 3; p.vx = Math.abs(p.vx); }
      if (p.x > cb.x + cb.w - 3) { p.x = cb.x + cb.w - 3; p.vx = -Math.abs(p.vx); }
      if (p.y < cb.y + 3) { p.y = cb.y + 3; p.vy = Math.abs(p.vy); }
      if (p.y > cb.y + cb.h - 3) { p.y = cb.y + cb.h - 3; p.vy = -Math.abs(p.vy); }

      // Clamp positions inside container
      p.x = Math.max(cb.x + 3, Math.min(cb.x + cb.w - 3, p.x));
      p.y = Math.max(cb.y + 3, Math.min(cb.y + cb.h - 3, p.y));
    }

    // Particle-particle collisions
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 6 && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (dvn > 0) {
            a.vx -= dvn * nx;
            a.vy -= dvn * ny;
            b.vx += dvn * nx;
            b.vy += dvn * ny;
          }
        }
      }
    }

    // Compute gas state
    // Ideal gas: PV = nRT
    const n = NUM_PARTICLES / 20; // moles (scaled)
    const R = 0.0821; // L·atm/(mol·K)
    computedV = volume;
    computedT = temperature;

    if (gasType < 0.5) {
      // Ideal gas
      computedP = (n * R * temperature) / Math.max(volume * 0.1, 0.01);
    } else {
      // Van der Waals: (P + a*n²/V²)(V - nb) = nRT
      const a = 1.36; // for N₂-like gas
      const b = 0.0387;
      const Vm = Math.max(volume * 0.1, 0.1);
      computedP = (n * R * temperature) / (Vm - n * b) - (a * n * n) / (Vm * Vm);
      computedP = Math.max(0, computedP);
    }

    // Record PV data
    if (pvData.length === 0 || Math.abs(pvData[pvData.length - 1].v - computedV) > 0.5) {
      pvData.push({ p: computedP, v: computedV });
      if (pvData.length > 200) pvData.shift();
    }
  }

  function drawContainer(): void {
    const cb = containerBounds();

    // Container body
    ctx.fillStyle = "rgba(20, 30, 50, 0.7)";
    ctx.strokeStyle = "#546e7a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cb.x, cb.y, cb.w, cb.h);
    ctx.fill();
    ctx.stroke();

    // Piston (right wall)
    ctx.fillStyle = "#455a64";
    ctx.fillRect(cb.x + cb.w - 4, cb.y, 8, cb.h);
    ctx.fillStyle = "#78909c";
    for (let i = 0; i < cb.h; i += 12) {
      ctx.fillRect(cb.x + cb.w - 2, cb.y + i, 4, 6);
    }

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`V = ${volume}%`, cb.x + cb.w / 2, cb.y + cb.h + 15);
  }

  function drawParticles(): void {
    const cb = containerBounds();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cb.x, cb.y, cb.w, cb.h);
    ctx.clip();

    for (const p of particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSpeed = Math.sqrt(temperature) * 2;
      const frac = Math.min(speed / maxSpeed, 1);
      // Color from blue (slow) to red (fast)
      const r = Math.floor(60 + frac * 195);
      const g = Math.floor(100 + (1 - frac) * 80);
      const b = Math.floor(240 - frac * 180);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPVDiagram(): void {
    const gx = W * 0.52;
    const gy = H * 0.08;
    const gw = W * 0.44;
    const gh = H * 0.4;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("P-V Diagram", gx + gw / 2, gy + 14);

    const px = gx + 45;
    const py = gy + 30;
    const pw = gw - 60;
    const ph = gh - 50;

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Volume", px + pw / 2, py + ph + 14);
    ctx.save();
    ctx.translate(px - 28, py + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Pressure", 0, 0);
    ctx.restore();

    if (pvData.length < 2) return;

    const maxP = Math.max(...pvData.map((d) => d.p), 0.1) * 1.2;
    const maxV = 105;

    // Draw isotherms for reference
    const n = NUM_PARTICLES / 20;
    const R = 0.0821;
    ctx.setLineDash([3, 3]);
    const temps = [200, 300, 400];
    for (const t of temps) {
      ctx.strokeStyle = `rgba(255,255,255,${t === Math.round(temperature) ? 0.5 : 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let v = 5; v <= 100; v += 2) {
        const pCalc = (n * R * t) / Math.max(v * 0.1, 0.01);
        const dx = px + (v / maxV) * pw;
        const dy = py + ph - (Math.min(pCalc, maxP) / maxP) * ph;
        if (v === 5) ctx.moveTo(dx, dy);
        else ctx.lineTo(dx, dy);
      }
      ctx.stroke();
      // Label
      const labelV = 85;
      const labelP = (n * R * t) / Math.max(labelV * 0.1, 0.01);
      ctx.fillStyle = `rgba(255,255,255,${t === Math.round(temperature) ? 0.6 : 0.2})`;
      ctx.font = "9px monospace";
      ctx.fillText(`${t}K`, px + (labelV / maxV) * pw + 15, py + ph - (Math.min(labelP, maxP) / maxP) * ph);
    }
    ctx.setLineDash([]);

    // Current state point
    const cx = px + (computedV / maxV) * pw;
    const cy = py + ph - (Math.min(computedP, maxP) / maxP) * ph;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ff5722";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawStateInfo(): void {
    const px = W * 0.52;
    const py = H * 0.52;
    const pw = W * 0.44;
    const ph = H * 0.42;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Gas State", px + 10, py + 16);

    ctx.font = "12px monospace";
    let y = py + 38;
    const items = [
      { label: "Temperature", value: `${temperature} K (${(temperature - 273.15).toFixed(0)}°C)`, color: "#ef5350" },
      { label: "Volume", value: `${volume}%`, color: "#42a5f5" },
      { label: "Pressure", value: `${computedP.toFixed(2)} atm`, color: "#66bb6a" },
      { label: "Gas Model", value: gasType < 0.5 ? "Ideal Gas" : "Van der Waals", color: "#ab47bc" },
    ];

    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillText(item.label + ":", px + 10, y);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "right";
      ctx.fillText(item.value, px + pw - 15, y);
      ctx.textAlign = "left";
      y += 24;
    }

    y += 15;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("Gas Laws:", px + 10, y);
    y += 18;
    ctx.font = "11px monospace";
    ctx.fillStyle = "#42a5f5";
    ctx.fillText("Boyle:    P₁V₁ = P₂V₂ (const T)", px + 10, y);
    y += 16;
    ctx.fillStyle = "#ef5350";
    ctx.fillText("Charles:  V₁/T₁ = V₂/T₂ (const P)", px + 10, y);
    y += 16;
    ctx.fillStyle = "#66bb6a";
    ctx.fillText("Gay-Lussac: P₁/T₁ = P₂/T₂ (const V)", px + 10, y);
    y += 16;
    ctx.fillStyle = "#ffa726";
    ctx.fillText("Combined: PV = nRT", px + 10, y);

    if (gasType >= 0.5) {
      y += 20;
      ctx.fillStyle = "#ab47bc";
      ctx.font = "10px monospace";
      ctx.fillText("Van der Waals:", px + 10, y);
      y += 14;
      ctx.fillText("(P + an²/V²)(V - nb) = nRT", px + 10, y);
    }
  }

  function drawConditionLabels(): void {
    const cb = containerBounds();
    // Temperature indicator (flame/ice)
    const tempFrac = (temperature - 100) / 800;
    if (tempFrac > 0.5) {
      // Flames under container
      for (let i = 0; i < 5; i++) {
        const fx = cb.x + cb.w * (0.15 + i * 0.18);
        const fy = cb.y + cb.h + 5;
        const flameH = 10 + tempFrac * 20 + Math.sin(time * 8 + i) * 5;
        const grad = ctx.createLinearGradient(fx, fy + flameH, fx, fy);
        grad.addColorStop(0, "rgba(255, 87, 34, 0)");
        grad.addColorStop(0.5, "rgba(255, 152, 0, 0.6)");
        grad.addColorStop(1, "rgba(255, 235, 59, 0.8)");
        ctx.beginPath();
        ctx.moveTo(fx - 5, fy + flameH);
        ctx.quadraticCurveTo(fx, fy, fx + 5, fy + flameH);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1a2940");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Gas in Various Conditions", W / 2, H - 10);

    drawContainer();
    drawParticles();
    drawConditionLabels();
    drawPVDiagram();
    drawStateInfo();
  }

  function destroy(): void {
    particles.length = 0;
    pvData.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Gas in Various Conditions: T=${temperature}K, V=${volume}%, P=${computedP.toFixed(2)} atm. ` +
      `Gas model: ${gasType < 0.5 ? "Ideal" : "Van der Waals"}. ` +
      `${NUM_PARTICLES} particles simulated. ` +
      `Ideal gas law: PV=nRT. ` +
      `Increasing temperature increases particle speed and pressure. ` +
      `Decreasing volume increases pressure (Boyle's Law). ` +
      `Van der Waals correction accounts for intermolecular forces and particle volume.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GasInVariousConditionFactory;
