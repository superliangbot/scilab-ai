import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ───────────────────────────────────────────────
const P0 = 101325; // sea level pressure (Pa)
const M_AIR = 0.029; // molar mass of dry air (kg/mol)
const R_GAS = 8.314; // ideal gas constant (J/(mol·K))
const kB = 1.380649e-23; // Boltzmann constant (J/K)
const PARTICLE_MASS_KG = 4.81e-26; // effective air molecule mass (~29 g/mol / Avogadro)

// ─── Column geometry constants ───────────────────────────────────────
const COL_MARGIN_TOP = 50;
const COL_MARGIN_BOTTOM = 50;
const COL_MARGIN_LEFT = 80;
const COL_MARGIN_RIGHT = 120; // room for pressure bar

// ─── Virtual column height in meters ─────────────────────────────────
const COLUMN_HEIGHT_M = 20000; // 20 km virtual column

// ─── Particle type ───────────────────────────────────────────────────
interface Particle {
  x: number; // pixel position
  y: number; // pixel position
  vx: number; // pixel velocity
  vy: number; // pixel velocity
  radius: number;
}

// ─── Factory ─────────────────────────────────────────────────────────
const AtmosphericPressureFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("atmospheric-pressure") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let gravity = 9.81;
  let temperature = 288;
  let numParticles = 100;

  // Particles
  let particles: Particle[] = [];

  // Pressure measurement
  let wallHitsBottom = 0;
  let wallHitsTop = 0;
  let frameCount = 0;
  let measuredPressureBottom = 0;
  let measuredPressureTop = 0;
  const MEASURE_WINDOW = 60;
  let pressureSamplesBottom: number[] = [];
  let pressureSamplesTop: number[] = [];

  function containerBounds() {
    const left = COL_MARGIN_LEFT;
    const right = width - COL_MARGIN_RIGHT;
    const top = COL_MARGIN_TOP;
    const bottom = height - COL_MARGIN_BOTTOM;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  // Scale height for barometric formula
  function scaleHeight(): number {
    // H = RT/(Mg) in meters
    return (R_GAS * temperature) / (M_AIR * gravity);
  }

  // Barometric formula: P(h) = P0 * exp(-Mgh/(RT))
  function pressureAtHeight(hMeters: number): number {
    return P0 * Math.exp((-M_AIR * gravity * hMeters) / (R_GAS * temperature));
  }

  // Map column pixel y to altitude in meters
  function pixelToAltitude(py: number): number {
    const bounds = containerBounds();
    const fraction = 1 - (py - bounds.top) / bounds.height; // 0 at bottom, 1 at top
    return fraction * COLUMN_HEIGHT_M;
  }

  function altitudeToPixelY(alt: number): number {
    const bounds = containerBounds();
    const fraction = alt / COLUMN_HEIGHT_M;
    return bounds.bottom - fraction * bounds.height;
  }

  // Thermal speed in pixels per frame-step
  function thermalSpeedPx(): number {
    // v_rms = sqrt(3kT/m) in m/s
    const vRms = Math.sqrt((3 * kB * temperature) / PARTICLE_MASS_KG);
    // Scale: map ~500 m/s (at 300K) to ~3 px/frame
    return (vRms / 500) * 3;
  }

  // Gravity in pixel units per frame (acceleration)
  function gravityPx(): number {
    // Scale gravity so particles visibly settle but still bounce
    // At g=9.81, we want moderate downward pull
    return (gravity / 9.81) * 0.15;
  }

  function mbComponent(): number {
    // Box-Muller for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function createParticle(): Particle {
    const bounds = containerBounds();
    const radius = 3;

    // Distribute according to barometric formula using rejection sampling
    let py: number;
    let attempts = 0;
    do {
      py = bounds.top + radius + Math.random() * (bounds.height - 2 * radius);
      const alt = pixelToAltitude(py);
      const prob = Math.exp((-M_AIR * gravity * alt) / (R_GAS * temperature));
      if (Math.random() < prob) break;
      attempts++;
    } while (attempts < 200);

    if (attempts >= 200) {
      // fallback: near bottom
      py = bounds.bottom - radius - Math.random() * bounds.height * 0.2;
    }

    const speed = thermalSpeedPx();
    return {
      x: bounds.left + radius + Math.random() * (bounds.width - 2 * radius),
      y: py,
      vx: mbComponent() * speed * 0.5,
      vy: mbComponent() * speed * 0.5,
      radius,
    };
  }

  function spawnParticles(): void {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push(createParticle());
    }
  }

  function rescaleSpeeds(oldTemp: number, newTemp: number): void {
    if (oldTemp <= 0) return;
    const factor = Math.sqrt(newTemp / oldTemp);
    for (const p of particles) {
      p.vx *= factor;
      p.vy *= factor;
    }
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
    const newGravity = params.gravity ?? gravity;
    const newTemp = params.temperature ?? temperature;
    const newNum = Math.round(params.numParticles ?? numParticles);

    // Handle temperature change
    if (newTemp !== temperature) {
      rescaleSpeeds(temperature, newTemp);
      temperature = newTemp;
    }

    gravity = newGravity;

    // Handle particle count
    if (newNum !== numParticles) {
      if (newNum > numParticles) {
        for (let i = numParticles; i < newNum; i++) {
          particles.push(createParticle());
        }
      } else {
        particles.length = newNum;
      }
      numParticles = newNum;
    }

    time += dt;

    const dtClamped = Math.min(dt, 0.05);
    const substeps = 3;
    const subDt = dtClamped / substeps;
    const frameFraction = subDt / (1 / 60);
    const bounds = containerBounds();
    const gPx = gravityPx();

    let hitsBottom = 0;
    let hitsTop = 0;

    for (let step = 0; step < substeps; step++) {
      for (const p of particles) {
        // Apply gravity (downward = positive y direction on screen)
        p.vy += gPx * frameFraction;

        // Brownian jitter
        const jitter = thermalSpeedPx() * 0.05;
        p.vx += (Math.random() - 0.5) * jitter;
        p.vy += (Math.random() - 0.5) * jitter;

        // Move
        p.x += p.vx * frameFraction;
        p.y += p.vy * frameFraction;

        // Wall collisions (elastic bounce)
        // Left wall
        if (p.x - p.radius < bounds.left) {
          p.x = bounds.left + p.radius;
          p.vx = Math.abs(p.vx);
        }
        // Right wall
        if (p.x + p.radius > bounds.right) {
          p.x = bounds.right - p.radius;
          p.vx = -Math.abs(p.vx);
        }
        // Top wall
        if (p.y - p.radius < bounds.top) {
          p.y = bounds.top + p.radius;
          const dvy = Math.abs(p.vy);
          p.vy = dvy;
          hitsTop += 2 * dvy;
        }
        // Bottom wall (ground)
        if (p.y + p.radius > bounds.bottom) {
          p.y = bounds.bottom - p.radius;
          const dvy = Math.abs(p.vy);
          p.vy = -dvy;
          hitsBottom += 2 * dvy;
        }
      }
    }

    // Pressure measurement
    pressureSamplesBottom.push(hitsBottom);
    pressureSamplesTop.push(hitsTop);
    if (pressureSamplesBottom.length > MEASURE_WINDOW) pressureSamplesBottom.shift();
    if (pressureSamplesTop.length > MEASURE_WINDOW) pressureSamplesTop.shift();

    measuredPressureBottom =
      pressureSamplesBottom.reduce((a, b) => a + b, 0) / pressureSamplesBottom.length;
    measuredPressureTop =
      pressureSamplesTop.reduce((a, b) => a + b, 0) / pressureSamplesTop.length;
    frameCount++;
  }

  function render(): void {
    if (!ctx) return;
    const bounds = containerBounds();

    // ── Background gradient ─────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // ── Title ───────────────────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Atmospheric Pressure Column", width / 2, 28);

    // ── Container background with density gradient ──
    // Gradient: denser (brighter) at bottom, sparser (darker) at top
    const colGrad = ctx.createLinearGradient(0, bounds.top, 0, bounds.bottom);
    colGrad.addColorStop(0, "rgba(20, 30, 60, 0.4)");
    colGrad.addColorStop(0.5, "rgba(30, 50, 90, 0.5)");
    colGrad.addColorStop(1, "rgba(40, 70, 120, 0.6)");
    ctx.fillStyle = colGrad;
    ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);

    // ── Container border ────────────────────────────
    ctx.strokeStyle = "rgba(100, 150, 220, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

    // ── Draw altitude labels on left ────────────────
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "right";
    const altSteps = [0, 2000, 5000, 8000, 10000, 15000, 20000];
    for (const alt of altSteps) {
      const y = altitudeToPixelY(alt);
      if (y >= bounds.top && y <= bounds.bottom) {
        ctx.fillText(`${(alt / 1000).toFixed(0)} km`, bounds.left - 8, y + 3);
        // Tick
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bounds.left - 3, y);
        ctx.lineTo(bounds.left, y);
        ctx.stroke();
        // Horizontal guide
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.moveTo(bounds.left, y);
        ctx.lineTo(bounds.right, y);
        ctx.stroke();
      }
    }

    // ── Draw particles ──────────────────────────────
    const maxSpd = thermalSpeedPx() * 3;
    for (const p of particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const t = Math.min(speed / maxSpd, 1);

      // Color: blue (slow) to cyan to yellow to red (fast)
      let r: number, g: number, b: number;
      if (t < 0.33) {
        const s = t / 0.33;
        r = Math.round(40 + 40 * s);
        g = Math.round(100 + 155 * s);
        b = 255;
      } else if (t < 0.66) {
        const s = (t - 0.33) / 0.33;
        r = Math.round(80 + 175 * s);
        g = 255;
        b = Math.round(255 - 180 * s);
      } else {
        const s = (t - 0.66) / 0.34;
        r = 255;
        g = Math.round(255 - 200 * s);
        b = Math.round(75 - 75 * s);
      }

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
      ctx.fill();
    }

    // ── Pressure gradient bar (right side) ──────────
    const barLeft = bounds.right + 16;
    const barWidth = 24;
    const barTop = bounds.top;
    const barBottom = bounds.bottom;
    const barHeight = barBottom - barTop;

    // Draw gradient bar
    const pressGrad = ctx.createLinearGradient(0, barTop, 0, barBottom);
    pressGrad.addColorStop(0, "rgba(60, 100, 200, 0.2)"); // low pressure at top
    pressGrad.addColorStop(0.5, "rgba(100, 160, 255, 0.5)");
    pressGrad.addColorStop(1, "rgba(200, 100, 80, 0.9)"); // high pressure at bottom
    ctx.fillStyle = pressGrad;
    ctx.fillRect(barLeft, barTop, barWidth, barHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barLeft, barTop, barWidth, barHeight);

    // Label
    ctx.save();
    ctx.translate(barLeft + barWidth + 14, barTop + barHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PRESSURE", 0, 0);
    ctx.restore();

    // Pressure values at different heights
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    const pressureAlts = [0, 5000, 10000, 15000, 20000];
    for (const alt of pressureAlts) {
      const pVal = pressureAtHeight(alt);
      const y = altitudeToPixelY(alt);
      if (y >= barTop && y <= barBottom) {
        // Tick mark on bar
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(barLeft, y);
        ctx.lineTo(barLeft + barWidth, y);
        ctx.stroke();
        // Value
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillText(`${(pVal / 1000).toFixed(1)} kPa`, barLeft + barWidth + 4, y + 3);
      }
    }

    // ── Ground label ────────────────────────────────
    ctx.fillStyle = "rgba(100, 160, 80, 0.5)";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ground (Sea Level)", (bounds.left + bounds.right) / 2, bounds.bottom + 16);

    // ── Data panel ──────────────────────────────────
    const panelY = bounds.bottom + 30;
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    const col1 = 12;

    // Row 1: Parameters
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`g = ${gravity.toFixed(2)} m/s\u00B2`, col1, panelY);
    ctx.fillStyle = "#34d399";
    ctx.fillText(`T = ${temperature.toFixed(0)} K`, col1 + 160, panelY);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Particles: ${numParticles}`, col1 + 300, panelY);

    // Row 2: Pressures
    const row2Y = panelY + 18;
    const H = scaleHeight();
    ctx.fillStyle = "#f472b6";
    ctx.fillText(`Scale height H = RT/(Mg) = ${(H / 1000).toFixed(1)} km`, col1, row2Y);

    // Row 3: Formula
    const row3Y = panelY + 36;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillText(
      "P(h) = P\u2080 \u00D7 exp(-Mgh / RT)  |  P\u2080 = 101.325 kPa",
      col1,
      row3Y
    );

    // ── Time display ────────────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    frameCount = 0;
    pressureSamplesBottom = [];
    pressureSamplesTop = [];
    measuredPressureBottom = 0;
    measuredPressureTop = 0;
    spawnParticles();
  }

  function destroy(): void {
    particles = [];
    pressureSamplesBottom = [];
    pressureSamplesTop = [];
  }

  function getStateDescription(): string {
    const H = scaleHeight();
    const pGround = pressureAtHeight(0);
    const p5km = pressureAtHeight(5000);
    const p10km = pressureAtHeight(10000);
    return (
      `Atmospheric Pressure simulation: g=${gravity.toFixed(2)} m/s², T=${temperature} K, ` +
      `${numParticles} particles. Scale height H = ${(H / 1000).toFixed(1)} km. ` +
      `Pressure at ground: ${(pGround / 1000).toFixed(1)} kPa, ` +
      `at 5 km: ${(p5km / 1000).toFixed(1)} kPa, ` +
      `at 10 km: ${(p10km / 1000).toFixed(1)} kPa. ` +
      `Barometric formula: P(h) = P₀ × exp(-Mgh/RT). Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    // Reposition particles inside new bounds
    const bounds = containerBounds();
    for (const p of particles) {
      p.x = Math.max(bounds.left + p.radius, Math.min(bounds.right - p.radius, p.x));
      p.y = Math.max(bounds.top + p.radius, Math.min(bounds.bottom - p.radius, p.y));
    }
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default AtmosphericPressureFactory;
