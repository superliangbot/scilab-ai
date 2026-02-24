import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ──────────────────────────────────────────────
const kB = 1.380649e-23; // Boltzmann constant (J/K)
const R_GAS = 8.314; // ideal gas constant J/(mol*K)
const PARTICLE_MASS_KG = 4.65e-26; // ~N2

// ─── Particle ───────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// ─── PV data point for graph ────────────────────────────────────────
interface PVPoint {
  P: number;
  V: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const BoylesLawFactory: SimulationFactory = () => {
  const config = getSimConfig("boyles-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (cached)
  let pressure = 1; // atm
  const temperature = 300; // K (constant for Boyle's Law)
  let numParticles = 40;

  // Derived state
  let particles: Particle[] = [];
  let currentVolume = 1; // arbitrary units, derived from pressure

  // Reference state: at P=1 atm, V=V_ref
  const V_REF = 1.0; // reference volume at 1 atm
  const P_REF = 1.0; // reference pressure

  // PV graph data
  let pvPoints: PVPoint[] = [];
  const MAX_PV_POINTS = 80;

  // Pressure measurement from wall collisions
  let wallImpulseAccum = 0;
  let pressureSamples: number[] = [];
  const PRESSURE_WINDOW = 60;
  let measuredPressure = 0;

  // Speed scaling: at 300K v_rms(N2) ~ 517 m/s => ~3px/frame
  const SPEED_SCALE = 3.0 / 517;

  // Container geometry
  const CONTAINER_TOP = 70;
  const CONTAINER_BOTTOM_MAX = 420;
  const CONTAINER_LEFT = 40;
  const CONTAINER_RIGHT_MAX = 480; // maximum right wall position

  // ── Helpers ───────────────────────────────────────────────────────
  function computeVolume(P: number): number {
    // Boyle's Law: PV = k => V = k/P
    // At P_REF, V = V_REF, so k = P_REF * V_REF
    const k = P_REF * V_REF;
    return k / P;
  }

  function containerBounds() {
    // Volume maps to container width
    const maxWidth = CONTAINER_RIGHT_MAX - CONTAINER_LEFT;
    const volFrac = currentVolume / (V_REF * (P_REF / 0.5)); // max volume at min pressure (0.5 atm)
    const containerWidth = Math.max(60, maxWidth * Math.min(volFrac, 1));
    const right = CONTAINER_LEFT + containerWidth;
    return {
      left: CONTAINER_LEFT,
      right,
      top: CONTAINER_TOP,
      bottom: CONTAINER_BOTTOM_MAX,
      width: containerWidth,
      height: CONTAINER_BOTTOM_MAX - CONTAINER_TOP,
    };
  }

  function mbSpeedComponent(): number {
    const sigma = Math.sqrt((kB * temperature) / PARTICLE_MASS_KG);
    const u1 = Math.random() || Number.MIN_VALUE; // Guard against log(0)
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

  // Graph bounds
  function graphBounds() {
    const left = W * 0.58;
    const right = W - 30;
    const top = 70;
    const bottom = H - 100;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      currentVolume = computeVolume(pressure);
      spawnParticles();
      pvPoints = [];
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newPressure = params.pressure ?? pressure;
      const newNum = Math.round(params.numParticles ?? numParticles);

      // Pressure change -> volume change (Boyle's Law)
      pressure = newPressure;
      currentVolume = computeVolume(pressure);

      // Particle count change
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

      let impulseThisFrame = 0;

      for (let step = 0; step < substeps; step++) {
        for (const p of particles) {
          p.x += p.vx * frameFraction;
          p.y += p.vy * frameFraction;

          // Wall collisions
          if (p.x - p.radius < bounds.left) {
            p.x = bounds.left + p.radius;
            impulseThisFrame += 2 * Math.abs(p.vx);
            p.vx = Math.abs(p.vx);
          }
          if (p.x + p.radius > bounds.right) {
            p.x = bounds.right - p.radius;
            impulseThisFrame += 2 * Math.abs(p.vx);
            p.vx = -Math.abs(p.vx);
          }
          if (p.y - p.radius < bounds.top) {
            p.y = bounds.top + p.radius;
            impulseThisFrame += 2 * Math.abs(p.vy);
            p.vy = Math.abs(p.vy);
          }
          if (p.y + p.radius > bounds.bottom) {
            p.y = bounds.bottom - p.radius;
            impulseThisFrame += 2 * Math.abs(p.vy);
            p.vy = -Math.abs(p.vy);
          }

          // Clamp inside after volume change
          if (p.x + p.radius > bounds.right) p.x = bounds.right - p.radius;
          if (p.x - p.radius < bounds.left) p.x = bounds.left + p.radius;
        }
      }

      // Pressure measurement
      wallImpulseAccum = impulseThisFrame;
      pressureSamples.push(wallImpulseAccum);
      if (pressureSamples.length > PRESSURE_WINDOW) pressureSamples.shift();
      const avgImpulse = pressureSamples.reduce((a, b) => a + b, 0) / pressureSamples.length;
      const perimeter = 2 * (bounds.width + bounds.height);
      measuredPressure = perimeter > 0 ? (avgImpulse / perimeter) * 1000 : 0;

      // Record PV point (throttled)
      if (pvPoints.length === 0 || Math.abs(pvPoints[pvPoints.length - 1].P - pressure) > 0.05) {
        pvPoints.push({ P: pressure, V: currentVolume });
        if (pvPoints.length > MAX_PV_POINTS) pvPoints.shift();
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
      ctx.fillText("Boyle's Law: PV = constant (at constant T)", W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "P\u2081V\u2081 = P\u2082V\u2082  |  v_rms = \u221A(3kT/m)  |  Pressure \u00D7 Volume = constant at fixed temperature",
        W / 2,
        48
      );

      const bounds = containerBounds();

      // ── Container ───────────────────────────────────
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);

      // Container walls
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      // Draw three fixed walls (top, bottom, left) and one moving wall (right = piston)
      ctx.beginPath();
      ctx.moveTo(bounds.left, bounds.top);
      ctx.lineTo(bounds.left, bounds.bottom);
      ctx.lineTo(bounds.right, bounds.bottom);
      ctx.moveTo(bounds.left, bounds.top);
      ctx.lineTo(bounds.right, bounds.top);
      ctx.stroke();

      // ── Piston (right wall) ─────────────────────────
      const pistonW = 14;
      const pistonGrad = ctx.createLinearGradient(bounds.right, 0, bounds.right + pistonW, 0);
      pistonGrad.addColorStop(0, "#64748b");
      pistonGrad.addColorStop(0.4, "#94a3b8");
      pistonGrad.addColorStop(0.6, "#94a3b8");
      pistonGrad.addColorStop(1, "#475569");
      ctx.fillStyle = pistonGrad;
      ctx.fillRect(bounds.right, bounds.top, pistonW, bounds.height);

      // Piston grip lines
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      for (let gy = bounds.top + 12; gy < bounds.bottom - 8; gy += 10) {
        ctx.beginPath();
        ctx.moveTo(bounds.right + 3, gy);
        ctx.lineTo(bounds.right + pistonW - 3, gy);
        ctx.stroke();
      }

      // Piston rod
      const rodY = (bounds.top + bounds.bottom) / 2;
      ctx.fillStyle = "#64748b";
      ctx.fillRect(bounds.right + pistonW, rodY - 5, 25, 10);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(bounds.right + pistonW, rodY - 5, 25, 10);

      // Pressure arrow
      const arrowX = bounds.right + pistonW + 30;
      ctx.beginPath();
      ctx.moveTo(arrowX + 20, rodY);
      ctx.lineTo(arrowX, rodY);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(arrowX, rodY);
      ctx.lineTo(arrowX + 8, rodY - 5);
      ctx.lineTo(arrowX + 8, rodY + 5);
      ctx.closePath();
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "left";
      ctx.fillText(`P = ${pressure.toFixed(1)} atm`, arrowX + 2, rodY - 10);

      // ── Particles ───────────────────────────────────
      const maxSpd = vRms() * SPEED_SCALE * 2.5;
      for (const p of particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const t = Math.min(speed / maxSpd, 1);

        // Color: cool cyan -> warm orange
        let r: number, g: number, b: number;
        if (t < 0.5) {
          const s = t / 0.5;
          r = Math.round(30 + 80 * s);
          g = Math.round(180 + 75 * s);
          b = Math.round(255 - 80 * s);
        } else {
          const s = (t - 0.5) / 0.5;
          r = Math.round(110 + 145 * s);
          g = Math.round(255 - 130 * s);
          b = Math.round(175 - 175 * s);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b}, 0.3)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── PV Graph ────────────────────────────────────
      const gb = graphBounds();

      // Graph background
      ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
      ctx.fillRect(gb.left, gb.top, gb.width, gb.height);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(gb.left, gb.top, gb.width, gb.height);

      // Graph title
      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      ctx.fillText("PV Diagram (Boyle's Law)", (gb.left + gb.right) / 2, gb.top - 8);

      // Axes labels
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Volume (V)", (gb.left + gb.right) / 2, gb.bottom + 16);

      ctx.save();
      ctx.translate(gb.left - 12, (gb.top + gb.bottom) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Pressure (P)", 0, 0);
      ctx.restore();

      // Draw theoretical Boyle's Law curve: P = k/V
      const k = P_REF * V_REF;
      const Pmin = 0.5;
      const Pmax = 4;
      const Vmin = k / Pmax;
      const Vmax = k / Pmin;

      ctx.beginPath();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i <= 100; i++) {
        const v = Vmin + (i / 100) * (Vmax - Vmin);
        const p = k / v;
        const px = gb.left + ((v - Vmin) / (Vmax - Vmin)) * gb.width;
        const py = gb.bottom - ((p - Pmin) / (Pmax - Pmin)) * gb.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Plot recorded PV points
      for (let i = 0; i < pvPoints.length; i++) {
        const pt = pvPoints[i];
        const px = gb.left + ((pt.V - Vmin) / (Vmax - Vmin)) * gb.width;
        const py = gb.bottom - ((pt.P - Pmin) / (Pmax - Pmin)) * gb.height;

        if (px >= gb.left && px <= gb.right && py >= gb.top && py <= gb.bottom) {
          const alpha = 0.3 + 0.7 * (i / pvPoints.length);
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.fill();
        }
      }

      // Current point (highlighted)
      {
        const px = gb.left + ((currentVolume - Vmin) / (Vmax - Vmin)) * gb.width;
        const py = gb.bottom - ((pressure - Pmin) / (Pmax - Pmin)) * gb.height;
        if (px >= gb.left && px <= gb.right && py >= gb.top && py <= gb.bottom) {
          // Glow
          const glow = ctx.createRadialGradient(px, py, 0, px, py, 12);
          glow.addColorStop(0, "rgba(56, 189, 248, 0.5)");
          glow.addColorStop(1, "rgba(56, 189, 248, 0)");
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#38bdf8";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Axis tick marks
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";

      for (let v = Math.ceil(Vmin * 10) / 10; v <= Vmax; v += 0.3) {
        const px = gb.left + ((v - Vmin) / (Vmax - Vmin)) * gb.width;
        ctx.beginPath();
        ctx.moveTo(px, gb.bottom);
        ctx.lineTo(px, gb.bottom + 4);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillText(v.toFixed(1), px, gb.bottom + 14);
      }

      ctx.textAlign = "right";
      for (let p = Pmin; p <= Pmax; p += 0.5) {
        const py = gb.bottom - ((p - Pmin) / (Pmax - Pmin)) * gb.height;
        ctx.beginPath();
        ctx.moveTo(gb.left, py);
        ctx.lineTo(gb.left - 4, py);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillText(p.toFixed(1), gb.left - 6, py + 3);
      }

      // ── Data panel ──────────────────────────────────
      const dpY = H - 85;
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`P = ${pressure.toFixed(2)} atm`, 30, dpY);

      ctx.fillStyle = "#34d399";
      ctx.fillText(`V = ${currentVolume.toFixed(3)} (relative)`, 30, dpY + 18);

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`PV = ${(pressure * currentVolume).toFixed(3)} = constant`, 30, dpY + 36);

      ctx.fillStyle = "#f472b6";
      ctx.fillText(`T = ${temperature} K (constant)`, 30, dpY + 54);

      ctx.fillStyle = "#c084fc";
      const vrms = vRms();
      ctx.fillText(`v_rms = \u221A(3kT/m) = ${Math.round(vrms)} m/s`, 250, dpY);

      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${numParticles} particles  |  PV = nRT`, 250, dpY + 18);

      // Verification
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        `Verification: P\u2081V\u2081 = ${(P_REF * V_REF).toFixed(3)}, P\u2082V\u2082 = ${(pressure * currentVolume).toFixed(3)} \u2248 constant \u2713`,
        250,
        dpY + 36
      );

      // Time
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      pressure = config.parameters.find((p) => p.key === "pressure")!.defaultValue;
      numParticles = config.parameters.find((p) => p.key === "numParticles")!.defaultValue;
      currentVolume = computeVolume(pressure);
      pvPoints = [];
      pressureSamples = [];
      wallImpulseAccum = 0;
      measuredPressure = 0;
      time = 0;
      spawnParticles();
    },

    destroy() {
      particles = [];
      pvPoints = [];
      pressureSamples = [];
    },

    getStateDescription(): string {
      const vrms = vRms();
      return (
        `Boyle's Law simulation: P=${pressure.toFixed(2)} atm, V=${currentVolume.toFixed(3)} (relative), ` +
        `T=${temperature} K (constant), ${numParticles} particles. ` +
        `PV = ${(pressure * currentVolume).toFixed(3)} (should be constant). ` +
        `v_rms = ${Math.round(vrms)} m/s from Maxwell-Boltzmann. ` +
        `Boyle's Law: at constant temperature, PV = constant, so doubling pressure halves volume.`
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

export default BoylesLawFactory;
