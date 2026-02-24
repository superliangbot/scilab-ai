import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ───────────────────────────────────────────────
const M_AIR = 0.029; // molar mass of air (kg/mol)
const g0 = 9.81; // gravitational acceleration (m/s²)
const R_GAS = 8.314; // ideal gas constant (J/(mol·K))
const T_SEA = 288; // reference temperature at sea level (K)

// ─── Atmospheric layer definitions ───────────────────────────────────
interface AtmosphereLayer {
  name: string;
  minAlt: number; // km
  maxAlt: number; // km
  color: string; // base RGBA for layer tint
}

const LAYERS: AtmosphereLayer[] = [
  { name: "Troposphere", minAlt: 0, maxAlt: 12, color: "rgba(70, 130, 230, 0.25)" },
  { name: "Stratosphere", minAlt: 12, maxAlt: 50, color: "rgba(100, 60, 200, 0.20)" },
  { name: "Mesosphere", minAlt: 50, maxAlt: 80, color: "rgba(40, 20, 100, 0.18)" },
  { name: "Thermosphere", minAlt: 80, maxAlt: 700, color: "rgba(10, 5, 40, 0.12)" },
];

// ─── Temperature profile (ISA-based) ────────────────────────────────
function temperatureAtAltitude(h: number): number {
  // h in km, returns degrees Celsius
  if (h <= 12) {
    // Troposphere: lapse rate -6.5°C/km
    return 15 - 6.5 * h;
  } else if (h <= 20) {
    // Tropopause: isothermal
    return -56.5;
  } else if (h <= 50) {
    // Stratosphere: warming due to ozone absorption
    return -56.5 + ((h - 20) / 30) * 54; // -56.5 to -2.5
  } else if (h <= 80) {
    // Mesosphere: cooling
    return -2.5 - ((h - 50) / 30) * 83.7; // -2.5 to -86.2
  } else if (h <= 120) {
    // Thermosphere: rapid heating
    return -86.2 + ((h - 80) / 40) * 686.2; // -86.2 to 600
  } else {
    return 600;
  }
}

// ─── Barometric density formula ──────────────────────────────────────
function relativeDensity(h: number): number {
  // Barometric formula: n(h) = n₀ × exp(-Mgh / RT)
  // h in km -> convert to meters
  const hMeters = h * 1000;
  return Math.exp((-M_AIR * g0 * hMeters) / (R_GAS * T_SEA));
}

// ─── Particle type ───────────────────────────────────────────────────
interface MoleculeParticle {
  x: number; // normalized 0-1 across column width
  y: number; // altitude in km
  vx: number;
  vy: number;
  size: number;
  hue: number; // for color variation
}

// ─── Factory ─────────────────────────────────────────────────────────
const AtmosphereFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("atmosphere") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let altitude = 0; // viewing altitude in km
  let numParticles = 100;
  let showTemperature = 1;

  // Particles
  let particles: MoleculeParticle[] = [];

  // View range: we show a window of altitudes centered around the altitude param
  const VIEW_RANGE = 120; // always show 0-120km

  function spawnParticles(): void {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push(createParticle());
    }
  }

  function createParticle(): MoleculeParticle {
    // Distribute particles with exponentially decreasing density
    // Use inverse transform sampling for exponential distribution
    // but cap at our view range
    let alt: number;
    const scaleHeight = (R_GAS * T_SEA) / (M_AIR * g0) / 1000; // ~8.5 km
    // Rejection sampling with barometric formula
    let attempts = 0;
    do {
      alt = Math.random() * VIEW_RANGE;
      attempts++;
    } while (Math.random() > relativeDensity(alt) && attempts < 100);
    if (attempts >= 100) alt = Math.random() * 5; // fallback: put near ground

    return {
      x: Math.random(),
      y: alt,
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.01,
      size: 2 + Math.random() * 2,
      hue: 180 + Math.random() * 60, // cyan to blue-ish
    };
  }

  function altToScreenY(alt: number): number {
    // Map altitude to screen Y (top = high altitude, bottom = low altitude)
    const margin = 40;
    const drawHeight = height - 2 * margin;
    return margin + drawHeight * (1 - alt / VIEW_RANGE);
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
    altitude = params.altitude ?? 0;
    const newNum = Math.round(params.numParticles ?? 100);
    showTemperature = params.showTemperature ?? 1;

    // Adjust particle count
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

    // Update particle positions (Brownian motion)
    for (const p of particles) {
      // Speed decreases with altitude (less energy at higher, colder regions)
      const tempK = temperatureAtAltitude(p.y) + 273.15;
      const speedFactor = Math.sqrt(Math.max(tempK, 50) / T_SEA);

      p.x += p.vx * speedFactor * dt * 60; // Scale by dt for frame-rate independence  
      p.y += p.vy * speedFactor * dt * 60;

      // Random jitter (scaled by dt)
      p.vx += (Math.random() - 0.5) * 0.01 * dt * 60;
      p.vy += (Math.random() - 0.5) * 0.005 * dt * 60;

      // Damping
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Boundaries
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
      if (p.x > 1) { p.x = 1; p.vx = -Math.abs(p.vx); }
      if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
      if (p.y > VIEW_RANGE) { p.y = VIEW_RANGE; p.vy = -Math.abs(p.vy); }
    }
  }

  function render(): void {
    if (!ctx) return;

    // ── Background gradient ─────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const margin = 40;
    const columnLeft = 80;
    const columnRight = showTemperature >= 0.5 ? width - 180 : width - 60;
    const columnWidth = columnRight - columnLeft;

    // ── Draw atmospheric layer backgrounds ──────────
    for (const layer of LAYERS) {
      const yTop = altToScreenY(Math.min(layer.maxAlt, VIEW_RANGE));
      const yBottom = altToScreenY(layer.minAlt);
      const layerGrad = ctx.createLinearGradient(0, yTop, 0, yBottom);
      layerGrad.addColorStop(0, layer.color);
      layerGrad.addColorStop(1, layer.color.replace(/[\d.]+\)$/, "0.05)"));
      ctx.fillStyle = layerGrad;
      ctx.fillRect(columnLeft, yTop, columnWidth, yBottom - yTop);
    }

    // ── Draw layer boundaries and labels ────────────
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    const boundaries = [
      { alt: 12, label: "Tropopause (12 km)" },
      { alt: 50, label: "Stratopause (50 km)" },
      { alt: 80, label: "Mesopause (80 km)" },
    ];
    for (const b of boundaries) {
      const y = altToScreenY(b.alt);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.moveTo(columnLeft, y);
      ctx.lineTo(columnRight, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(b.label, columnLeft - 6, y + 3);
    }
    ctx.setLineDash([]);

    // ── Layer name labels ───────────────────────────
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    const layerLabels = [
      { name: "TROPOSPHERE", alt: 6, color: "rgba(100, 180, 255, 0.6)" },
      { name: "STRATOSPHERE", alt: 31, color: "rgba(140, 100, 255, 0.6)" },
      { name: "MESOSPHERE", alt: 65, color: "rgba(100, 60, 200, 0.5)" },
      { name: "THERMOSPHERE", alt: 100, color: "rgba(80, 40, 150, 0.5)" },
    ];
    for (const ll of layerLabels) {
      const y = altToScreenY(ll.alt);
      ctx.fillStyle = ll.color;
      ctx.fillText(ll.name, (columnLeft + columnRight) / 2, y);
    }

    // ── Draw altitude scale on the left ─────────────
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "right";
    for (let a = 0; a <= 120; a += 10) {
      const y = altToScreenY(a);
      ctx.fillText(`${a} km`, columnLeft - 28, y + 4);
      // Small tick mark
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(columnLeft - 4, y);
      ctx.lineTo(columnLeft, y);
      ctx.stroke();
    }

    // ── Draw current altitude indicator ─────────────
    const indicatorY = altToScreenY(altitude);
    ctx.strokeStyle = "#ffaa00";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(columnLeft, indicatorY);
    ctx.lineTo(columnRight, indicatorY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Altitude indicator arrow and label
    ctx.fillStyle = "#ffaa00";
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Viewing: ${altitude.toFixed(1)} km`, columnRight + 6, indicatorY - 8);

    // Show temperature at current altitude
    const tempAtAlt = temperatureAtAltitude(altitude);
    ctx.fillStyle = "#ff8866";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillText(`T = ${tempAtAlt.toFixed(1)}°C`, columnRight + 6, indicatorY + 8);

    // Show density at current altitude
    const density = relativeDensity(altitude);
    ctx.fillStyle = "#66ccff";
    ctx.fillText(`Density: ${(density * 100).toFixed(2)}%`, columnRight + 6, indicatorY + 22);

    // ── Draw particles ──────────────────────────────
    for (const p of particles) {
      const sx = columnLeft + p.x * columnWidth;
      const sy = altToScreenY(p.y);

      // Particle opacity decreases with altitude
      const dens = relativeDensity(p.y);
      const alpha = Math.max(0.15, Math.min(1, dens * 2));

      // Color shifts with temperature
      const tempC = temperatureAtAltitude(p.y);
      const tempNorm = (tempC + 90) / 690; // normalize roughly -86 to 600
      // Cool = blue, warm = orange/red
      const r = Math.round(80 + tempNorm * 175);
      const g_val = Math.round(150 - tempNorm * 60);
      const b = Math.round(255 - tempNorm * 200);

      ctx.beginPath();
      ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g_val}, ${b}, ${alpha})`;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(sx, sy, p.size + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g_val}, ${b}, ${alpha * 0.2})`;
      ctx.fill();
    }

    // ── Column border ───────────────────────────────
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(columnLeft, margin, columnWidth, height - 2 * margin);

    // ── Ground ──────────────────────────────────────
    const groundY = altToScreenY(0);
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 20);
    groundGrad.addColorStop(0, "rgba(60, 100, 40, 0.8)");
    groundGrad.addColorStop(1, "rgba(40, 70, 25, 0)");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(columnLeft, groundY, columnWidth, 20);
    ctx.fillStyle = "rgba(100, 160, 80, 0.6)";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ground Level", (columnLeft + columnRight) / 2, groundY + 14);

    // ── Temperature profile graph (right side) ──────
    if (showTemperature >= 0.5) {
      const graphLeft = columnRight + 20;
      const graphRight = width - 20;
      const graphTop = margin;
      const graphBottom = height - margin;
      const graphWidth = graphRight - graphLeft;
      const graphHeight = graphBottom - graphTop;

      // Graph background
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(graphLeft, graphTop, graphWidth, graphHeight);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(graphLeft, graphTop, graphWidth, graphHeight);

      // Title
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Temperature", graphLeft + graphWidth / 2, graphTop - 6);

      // Temperature axis: -90°C to 600°C
      const tMin = -90;
      const tMax = 650;

      const tempToX = (t: number): number => {
        return graphLeft + ((t - tMin) / (tMax - tMin)) * graphWidth;
      };

      // Grid lines for temperature
      ctx.font = "8px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.textAlign = "center";
      for (const tVal of [-50, 0, 100, 300, 600]) {
        const x = tempToX(tVal);
        ctx.beginPath();
        ctx.moveTo(x, graphTop);
        ctx.lineTo(x, graphBottom);
        ctx.stroke();
        ctx.fillText(`${tVal}°`, x, graphBottom + 12);
      }

      // Draw temperature curve
      ctx.beginPath();
      ctx.strokeStyle = "#ff6644";
      ctx.lineWidth = 2;
      let first = true;
      for (let a = 0; a <= 120; a += 0.5) {
        const t = temperatureAtAltitude(a);
        const x = tempToX(t);
        const y = altToScreenY(a);
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Mark current altitude on the graph
      const currentTemp = temperatureAtAltitude(altitude);
      const markX = tempToX(currentTemp);
      const markY = altToScreenY(altitude);
      ctx.beginPath();
      ctx.arc(markX, markY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffaa00";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ── Title ───────────────────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth's Atmospheric Layers", width / 2, 20);

    // ── Formula annotation ──────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Barometric: n(h) = n\u2080 \u00D7 exp(-Mgh / RT)", 12, height - 30);

    // ── Time display ────────────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    spawnParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const tempC = temperatureAtAltitude(altitude);
    const dens = relativeDensity(altitude);
    let layerName = "Thermosphere";
    for (const l of LAYERS) {
      if (altitude >= l.minAlt && altitude < l.maxAlt) {
        layerName = l.name;
        break;
      }
    }
    return (
      `Atmosphere simulation: viewing altitude ${altitude.toFixed(1)} km (${layerName}). ` +
      `Temperature at this altitude: ${tempC.toFixed(1)}°C. ` +
      `Relative air density: ${(dens * 100).toFixed(2)}% of sea level. ` +
      `${numParticles} particles displayed. ` +
      `Layers: Troposphere (0-12km), Stratosphere (12-50km), Mesosphere (50-80km), Thermosphere (80-700km). ` +
      `Barometric formula: n(h) = n₀ × exp(-Mgh/RT). Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default AtmosphereFactory;
