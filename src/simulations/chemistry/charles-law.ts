import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ──────────────────────────────────────────────
const kB = 1.380649e-23; // Boltzmann constant (J/K)
const PARTICLE_MASS_KG = 4.65e-26; // ~N2

// ─── Particle ───────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// ─── VT data point for graph ────────────────────────────────────────
interface VTPoint {
  T: number;
  V: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const CharlesLawFactory: SimulationFactory = () => {
  const config = getSimConfig("charles-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let temperature = 300; // K
  let pressure = 1; // atm (constant)
  let numParticles = 40;

  let particles: Particle[] = [];
  let currentVolume = 1; // relative

  // Reference: at 300K, V = V_ref
  const T_REF = 300;
  const V_REF = 1.0;

  // VT graph data
  let vtPoints: VTPoint[] = [];
  const MAX_VT_POINTS = 80;

  // Speed scale
  const SPEED_SCALE = 3.0 / 517; // v_rms(N2,300K) ~ 517 m/s => 3 px/frame

  // ── Helpers ───────────────────────────────────────────────────────
  function computeVolume(T: number): number {
    // Charles's Law: V/T = constant at constant P
    // V_ref / T_ref = V / T  =>  V = V_ref * T / T_ref
    return V_REF * (T / T_REF);
  }

  function containerBounds() {
    const topMargin = 70;
    const bottomBase = 430;
    const leftMargin = 40;

    // Container height changes with volume (vertical piston)
    const maxHeight = bottomBase - topMargin;
    const volFrac = currentVolume / computeVolume(600); // normalized to max temperature
    const containerHeight = Math.max(40, maxHeight * Math.min(volFrac, 1));
    const containerWidth = 280;
    const bottom = bottomBase;
    const top = bottom - containerHeight;

    return {
      left: leftMargin,
      right: leftMargin + containerWidth,
      top,
      bottom,
      width: containerWidth,
      height: containerHeight,
    };
  }

  function mbSpeedComponent(): number {
    const sigma = Math.sqrt((kB * temperature) / PARTICLE_MASS_KG);
    const u1 = Math.random();
    const u2 = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function vRms(): number {
    return Math.sqrt((3 * kB * temperature) / PARTICLE_MASS_KG);
  }

  function createParticle(): Particle {
    const bounds = containerBounds();
    const r = 3;
    return {
      x: bounds.left + r + Math.random() * (bounds.width - 2 * r),
      y: bounds.top + r + Math.random() * (bounds.height - 2 * r),
      vx: mbSpeedComponent() * SPEED_SCALE,
      vy: mbSpeedComponent() * SPEED_SCALE,
      radius: r,
    };
  }

  function spawnParticles() {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push(createParticle());
    }
  }

  function rescaleSpeeds(oldTemp: number, newTemp: number) {
    if (oldTemp <= 0) return;
    const factor = Math.sqrt(newTemp / oldTemp);
    for (const p of particles) {
      p.vx *= factor;
      p.vy *= factor;
    }
  }

  function graphBounds() {
    const left = W * 0.48;
    const right = W - 30;
    const top = 70;
    const bottom = H - 130;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  // Temperature to color
  function tempToColor(T: number): string {
    // 0K = deep blue, 300K = cyan/green, 600K = red/orange
    const t = Math.min(T / 600, 1);
    if (t < 0.33) {
      const s = t / 0.33;
      return `rgb(${Math.round(20 + 20 * s)}, ${Math.round(30 + 120 * s)}, ${Math.round(200 + 55 * s)})`;
    } else if (t < 0.66) {
      const s = (t - 0.33) / 0.33;
      return `rgb(${Math.round(40 + 180 * s)}, ${Math.round(150 + 105 * s)}, ${Math.round(255 - 130 * s)})`;
    } else {
      const s = (t - 0.66) / 0.34;
      return `rgb(255, ${Math.round(255 - 180 * s)}, ${Math.round(125 - 125 * s)})`;
    }
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      currentVolume = computeVolume(temperature);
      spawnParticles();
      vtPoints = [];
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newTemp = params.temperature ?? temperature;
      const newPressure = params.pressure ?? pressure;
      const newNum = Math.round(params.numParticles ?? numParticles);

      // Temperature change
      if (newTemp !== temperature) {
        rescaleSpeeds(temperature, newTemp);
        temperature = newTemp;
      }

      pressure = newPressure;

      // Volume adjusts with temperature (Charles's Law)
      // Also adjust for pressure: V = V_ref * T / T_ref / P
      currentVolume = computeVolume(temperature) / pressure;

      // Particle count
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

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      const substeps = 3;
      const subDt = dtClamped / substeps;
      const frameFraction = subDt / (1 / 60);
      const bounds = containerBounds();

      for (let step = 0; step < substeps; step++) {
        for (const p of particles) {
          p.x += p.vx * frameFraction;
          p.y += p.vy * frameFraction;

          if (p.x - p.radius < bounds.left) {
            p.x = bounds.left + p.radius;
            p.vx = Math.abs(p.vx);
          }
          if (p.x + p.radius > bounds.right) {
            p.x = bounds.right - p.radius;
            p.vx = -Math.abs(p.vx);
          }
          if (p.y - p.radius < bounds.top) {
            p.y = bounds.top + p.radius;
            p.vy = Math.abs(p.vy);
          }
          if (p.y + p.radius > bounds.bottom) {
            p.y = bounds.bottom - p.radius;
            p.vy = -Math.abs(p.vy);
          }

          // Clamp inside after volume change
          if (p.y - p.radius < bounds.top) p.y = bounds.top + p.radius;
        }
      }

      // Record VT point
      if (vtPoints.length === 0 || Math.abs(vtPoints[vtPoints.length - 1].T - temperature) > 5) {
        vtPoints.push({ T: temperature, V: currentVolume });
        if (vtPoints.length > MAX_VT_POINTS) vtPoints.shift();
      }
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Charles's Law: V/T = constant (at constant P)", W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "V\u2081/T\u2081 = V\u2082/T\u2082  |  Volume is directly proportional to temperature  |  V \u2192 0 as T \u2192 0 K",
        W / 2,
        48
      );

      const bounds = containerBounds();

      // ── Container ───────────────────────────────────
      // Temperature-dependent background color
      const tFrac = Math.min(temperature / 600, 1);
      const bgR = Math.round(20 + 30 * tFrac);
      const bgG = Math.round(25 + 5 * tFrac);
      const bgB = Math.round(50 - 20 * tFrac);
      ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
      ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);

      // Fixed walls (left, right, bottom)
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bounds.left, bounds.top);
      ctx.lineTo(bounds.left, bounds.bottom);
      ctx.lineTo(bounds.right, bounds.bottom);
      ctx.lineTo(bounds.right, bounds.top);
      ctx.stroke();

      // ── Piston (top wall, moves with volume) ────────
      const pistonH = 12;
      const pistonGrad = ctx.createLinearGradient(0, bounds.top - pistonH, 0, bounds.top);
      pistonGrad.addColorStop(0, "#475569");
      pistonGrad.addColorStop(0.5, "#94a3b8");
      pistonGrad.addColorStop(1, "#64748b");
      ctx.fillStyle = pistonGrad;
      ctx.fillRect(bounds.left, bounds.top - pistonH, bounds.width, pistonH);

      // Piston grip lines
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      for (let gx = bounds.left + 10; gx < bounds.right - 8; gx += 10) {
        ctx.beginPath();
        ctx.moveTo(gx, bounds.top - pistonH + 3);
        ctx.lineTo(gx, bounds.top - 3);
        ctx.stroke();
      }

      // Piston rod
      const rodX = (bounds.left + bounds.right) / 2;
      ctx.fillStyle = "#64748b";
      ctx.fillRect(rodX - 4, bounds.top - pistonH - 30, 8, 30);

      // Weight on piston (constant pressure)
      ctx.fillStyle = "#475569";
      ctx.fillRect(rodX - 20, bounds.top - pistonH - 36, 40, 10);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(rodX - 20, bounds.top - pistonH - 36, 40, 10);

      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(`P = ${pressure.toFixed(1)} atm`, rodX, bounds.top - pistonH - 40);

      // ── Heat source at bottom ───────────────────────
      const flameY = bounds.bottom + 8;
      const flameIntensity = Math.min(temperature / 600, 1);
      for (let fi = 0; fi < 7; fi++) {
        const fx = bounds.left + 20 + fi * ((bounds.width - 40) / 6);
        const fOff = Math.sin(time * 8 + fi * 1.2) * 3;
        const fh = 8 + flameIntensity * 15;
        const grad = ctx.createRadialGradient(fx, flameY, 0, fx, flameY - fh / 2, fh);
        grad.addColorStop(0, `rgba(255, 200, 50, ${0.3 + flameIntensity * 0.6})`);
        grad.addColorStop(0.5, `rgba(255, 80, 20, ${0.2 + flameIntensity * 0.4})`);
        grad.addColorStop(1, "rgba(255, 50, 0, 0)");
        ctx.beginPath();
        ctx.ellipse(fx, flameY + fOff, 5, fh * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Temperature label below flames
      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = tempToColor(temperature);
      ctx.textAlign = "center";
      ctx.fillText(`T = ${temperature} K`, (bounds.left + bounds.right) / 2, flameY + 22);

      // Absolute zero indicator
      if (temperature <= 100) {
        ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#60a5fa";
        ctx.fillText(
          temperature <= 50 ? "Near absolute zero! Volume approaches zero." : "Very cold - low molecular motion",
          (bounds.left + bounds.right) / 2,
          flameY + 38
        );
      }

      // ── Particles ───────────────────────────────────
      const maxSpd = vRms() * SPEED_SCALE * 2.5;
      for (const p of particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const t = maxSpd > 0 ? Math.min(speed / maxSpd, 1) : 0;

        const color = tempToColor(t * 600);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 1, 0, Math.PI * 2);
        ctx.strokeStyle = color.replace("rgb", "rgba").replace(")", ", 0.3)");
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── VT Graph ────────────────────────────────────
      const gb = graphBounds();

      ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
      ctx.fillRect(gb.left, gb.top, gb.width, gb.height);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(gb.left, gb.top, gb.width, gb.height);

      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.fillText("V-T Diagram (Charles's Law)", (gb.left + gb.right) / 2, gb.top - 8);

      // Axis labels
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Temperature (K)", (gb.left + gb.right) / 2, gb.bottom + 16);

      ctx.save();
      ctx.translate(gb.left - 12, (gb.top + gb.bottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Volume (V)", 0, 0);
      ctx.restore();

      // Graph range
      const Tmin = 0;
      const Tmax = 650;
      const Vmin = 0;
      const Vmax = computeVolume(600) / 0.5 + 0.2; // max V at max T, min P

      // Theoretical line: V = V_ref * T / T_ref / P  (passes through origin!)
      ctx.beginPath();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i <= 100; i++) {
        const T = (i / 100) * Tmax;
        const V = (V_REF * T / T_REF) / pressure;
        const px = gb.left + (T / Tmax) * gb.width;
        const py = gb.bottom - (V / Vmax) * gb.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Label the theoretical line
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText("V/T = const", gb.right - 60, gb.top + 15);

      // Absolute zero marker
      const zeroX = gb.left;
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.moveTo(zeroX, gb.top);
      ctx.lineTo(zeroX, gb.bottom);
      ctx.strokeStyle = "#60a5fa40";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#60a5fa";
      ctx.textAlign = "left";
      ctx.fillText("0 K", zeroX + 3, gb.bottom - 4);

      // Plot VT points
      for (let i = 0; i < vtPoints.length; i++) {
        const pt = vtPoints[i];
        const px = gb.left + (pt.T / Tmax) * gb.width;
        const py = gb.bottom - (pt.V / Vmax) * gb.height;

        if (px >= gb.left && px <= gb.right && py >= gb.top && py <= gb.bottom) {
          const alpha = 0.3 + 0.7 * (i / vtPoints.length);
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
          ctx.fill();
        }
      }

      // Current point
      {
        const px = gb.left + (temperature / Tmax) * gb.width;
        const py = gb.bottom - (currentVolume / Vmax) * gb.height;
        if (px >= gb.left && px <= gb.right && py >= gb.top && py <= gb.bottom) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, 12);
          glow.addColorStop(0, "rgba(52, 211, 153, 0.5)");
          glow.addColorStop(1, "rgba(52, 211, 153, 0)");
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#34d399";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Axis ticks
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";

      for (let T = 0; T <= Tmax; T += 100) {
        const px = gb.left + (T / Tmax) * gb.width;
        ctx.beginPath();
        ctx.moveTo(px, gb.bottom);
        ctx.lineTo(px, gb.bottom + 4);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillText(T.toString(), px, gb.bottom + 14);
      }

      // ── Data panel ──────────────────────────────────
      const dpY = H - 105;
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#34d399";
      ctx.fillText(`V = ${currentVolume.toFixed(3)} (relative)`, 30, dpY);

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`T = ${temperature} K`, 30, dpY + 18);

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`P = ${pressure.toFixed(1)} atm (constant)`, 30, dpY + 36);

      ctx.fillStyle = "#f472b6";
      const vtRatio = temperature > 0 ? currentVolume / temperature : 0;
      ctx.fillText(`V/T = ${vtRatio.toFixed(5)} = constant`, 30, dpY + 54);

      ctx.fillStyle = "#c084fc";
      const vrms = vRms();
      ctx.fillText(`v_rms = ${Math.round(vrms)} m/s`, 30, dpY + 72);

      // Insight
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      let insight: string;
      if (temperature <= 100) {
        insight = "Near absolute zero: molecules nearly stationary, volume approaches zero";
      } else if (temperature >= 500) {
        insight = "High temperature: fast molecules push piston up, volume increases";
      } else {
        insight = "Charles's Law: V and T are directly proportional at constant pressure";
      }
      ctx.fillText(insight, 250, dpY + 54);

      // Time
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      temperature = config.parameters.find((p) => p.key === "temperature")!.defaultValue;
      pressure = config.parameters.find((p) => p.key === "pressure")!.defaultValue;
      numParticles = config.parameters.find((p) => p.key === "numParticles")!.defaultValue;
      currentVolume = computeVolume(temperature) / pressure;
      vtPoints = [];
      time = 0;
      spawnParticles();
    },

    destroy() {
      particles = [];
      vtPoints = [];
    },

    getStateDescription(): string {
      const vrms = vRms();
      const vtRatio = temperature > 0 ? currentVolume / temperature : 0;
      return (
        `Charles's Law simulation: T=${temperature} K, V=${currentVolume.toFixed(3)} (relative), ` +
        `P=${pressure.toFixed(1)} atm (constant), ${numParticles} particles. ` +
        `V/T = ${vtRatio.toFixed(5)} (should be constant at fixed P). ` +
        `v_rms = ${Math.round(vrms)} m/s. ` +
        `Charles's Law: volume is directly proportional to temperature at constant pressure. ` +
        `At absolute zero (0 K), an ideal gas would have zero volume.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      const bounds = containerBounds();
      for (const p of particles) {
        p.x = Math.max(bounds.left + p.radius, Math.min(bounds.right - p.radius, p.x));
        p.y = Math.max(bounds.top + p.radius, Math.min(bounds.bottom - p.radius, p.y));
      }
    },
  };

  return engine;
};

export default CharlesLawFactory;
