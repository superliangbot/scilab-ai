import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ───────────────────────────────────────────────
const kB = 1.380649e-23; // Boltzmann constant (J/K)
const R_GAS = 8.314; // ideal gas constant (J/(mol*K))
const N_A = 6.022e23; // Avogadro's number
const PARTICLE_MASS_KG = 4.65e-26; // ~N2 molar mass 28 g/mol in kg

// ─── Rendering helpers ───────────────────────────────────────────────
function speedToColor(speed: number, maxSpeed: number): string {
  const t = Math.min(speed / maxSpeed, 1);
  // blue -> cyan -> green -> yellow -> red
  if (t < 0.25) {
    const s = t / 0.25;
    return `rgb(${Math.round(30 + 0 * s)}, ${Math.round(80 + 175 * s)}, 255)`;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return `rgb(${Math.round(30 + 100 * s)}, 255, ${Math.round(255 - 120 * s)})`;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return `rgb(${Math.round(130 + 125 * s)}, ${Math.round(255 - 80 * s)}, ${Math.round(135 - 135 * s)})`;
  } else {
    const s = (t - 0.75) / 0.25;
    return `rgb(255, ${Math.round(175 - 175 * s)}, 0)`;
  }
}

function roundSig(value: number, digits: number): string {
  if (value === 0) return "0";
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  if (magnitude >= digits) return Math.round(value).toString();
  return value.toPrecision(digits);
}

// ─── Particle type ───────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// ─── Factory ─────────────────────────────────────────────────────────
const GasLawsFactory: SimulationFactory = () => {
  const config = getSimConfig("gas-laws") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Simulation state
  let particles: Particle[] = [];
  let temperature = 300;
  let volumePct = 60;
  let numParticles = 80;

  // Container geometry (pixel space)
  const CONTAINER_MARGIN_TOP = 60;
  const CONTAINER_MARGIN_BOTTOM = 80;
  const CONTAINER_MARGIN_LEFT = 60;
  const CONTAINER_MARGIN_RIGHT = 60;
  const PISTON_WIDTH = 18;

  // Pressure tracking
  let wallImpulseAccum = 0; // accumulated impulse on walls per frame window
  let measuredPressure = 0;
  let pressureSamples: number[] = [];
  const PRESSURE_WINDOW = 60; // number of frames to average over

  // Speed scale factor — maps physical m/s into px/frame at 60 fps.
  // We choose a factor so that at 300 K the average speed looks reasonable on screen.
  // v_avg(300K, N2) ~ 476 m/s. We want that to appear as ~3 px per frame at 60 fps.
  const SPEED_SCALE = 3.0 / 476;

  // ── Helpers ──────────────────────────────────────────────────────
  function containerBounds() {
    // Right wall moves with volume; left wall is the piston side.
    const fullWidth = W - CONTAINER_MARGIN_LEFT - CONTAINER_MARGIN_RIGHT - PISTON_WIDTH;
    const containerWidth = fullWidth * (volumePct / 100);
    const left = CONTAINER_MARGIN_LEFT + PISTON_WIDTH;
    const right = left + containerWidth;
    const top = CONTAINER_MARGIN_TOP;
    const bottom = H - CONTAINER_MARGIN_BOTTOM;
    return { left, right, top, bottom, width: containerWidth, height: bottom - top };
  }

  /** Maxwell-Boltzmann speed for a single component (1D Gaussian) */
  function mbSpeedComponent(): number {
    // Box-Muller transform for normal distribution with sigma = sqrt(kT/m)
    const sigma = Math.sqrt((kB * temperature) / PARTICLE_MASS_KG);
    const u1 = Math.random() || Number.MIN_VALUE; // Guard against log(0)
    const u2 = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function averageSpeed(): number {
    // Maxwell-Boltzmann average speed = sqrt(8 kT / (pi m))
    return Math.sqrt((8 * kB * temperature) / (Math.PI * PARTICLE_MASS_KG));
  }

  function maxReasonableSpeed(): number {
    // ~3x the most probable speed for color mapping
    const vp = Math.sqrt((2 * kB * temperature) / PARTICLE_MASS_KG);
    return vp * 3;
  }

  function createParticle(): Particle {
    const bounds = containerBounds();
    const radius = 3;
    const x = bounds.left + radius + Math.random() * (bounds.width - 2 * radius);
    const y = bounds.top + radius + Math.random() * (bounds.height - 2 * radius);
    const vxPhys = mbSpeedComponent();
    const vyPhys = mbSpeedComponent();
    return {
      x,
      y,
      vx: vxPhys * SPEED_SCALE,
      vy: vyPhys * SPEED_SCALE,
      radius,
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

  // ── Engine ───────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      spawnParticles();
    },

    update(dt: number, params: Record<string, number>) {
      const newTemp = params.temperature ?? temperature;
      const newVol = params.volume ?? volumePct;
      const newNum = Math.round(params.numParticles ?? numParticles);

      // Handle temperature change — rescale velocities
      if (newTemp !== temperature) {
        rescaleSpeeds(temperature, newTemp);
        temperature = newTemp;
      }

      volumePct = newVol;

      // Handle particle count change
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

      // Clamp dt to avoid spiral of death
      const dtClamped = Math.min(dt, 0.05);
      const substeps = 3;
      const subDt = dtClamped / substeps;
      // We work at 60 fps as reference; each substep fraction of frame
      const frameFraction = subDt / (1 / 60);
      const bounds = containerBounds();

      let impulseThisFrame = 0;

      for (let step = 0; step < substeps; step++) {
        for (const p of particles) {
          // Move
          p.x += p.vx * frameFraction;
          p.y += p.vy * frameFraction;

          // Wall collisions
          // Left wall (piston)
          if (p.x - p.radius < bounds.left) {
            p.x = bounds.left + p.radius;
            const dvx = Math.abs(p.vx);
            p.vx = dvx;
            // impulse = 2 m |vx| (in pixel-mass units)
            impulseThisFrame += 2 * dvx;
          }
          // Right wall
          if (p.x + p.radius > bounds.right) {
            p.x = bounds.right - p.radius;
            const dvx = Math.abs(p.vx);
            p.vx = -dvx;
            impulseThisFrame += 2 * dvx;
          }
          // Top wall
          if (p.y - p.radius < bounds.top) {
            p.y = bounds.top + p.radius;
            const dvy = Math.abs(p.vy);
            p.vy = dvy;
            impulseThisFrame += 2 * dvy;
          }
          // Bottom wall
          if (p.y + p.radius > bounds.bottom) {
            p.y = bounds.bottom - p.radius;
            const dvy = Math.abs(p.vy);
            p.vy = -dvy;
            impulseThisFrame += 2 * dvy;
          }

          // Keep particles inside after volume change squeezes them
          if (p.x - p.radius < bounds.left) p.x = bounds.left + p.radius;
          if (p.x + p.radius > bounds.right) p.x = bounds.right - p.radius;
        }
      }

      // Accumulate pressure samples
      wallImpulseAccum = impulseThisFrame;
      pressureSamples.push(wallImpulseAccum);
      if (pressureSamples.length > PRESSURE_WINDOW) {
        pressureSamples.shift();
      }
      const avgImpulse =
        pressureSamples.reduce((a, b) => a + b, 0) / pressureSamples.length;
      // Measured pressure ~ total impulse / perimeter (arbitrary units scaled to match)
      const perimeter = 2 * (bounds.width + bounds.height);
      measuredPressure = perimeter > 0 ? (avgImpulse / perimeter) * 1000 : 0;
    },

    render() {
      if (!ctx) return;
      const bounds = containerBounds();

      // ── Background ───────────────────────────────
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // ── Title ────────────────────────────────────
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Ideal Gas Law  PV = nRT", W / 2, 30);

      // ── Container background ────────────────────
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);

      // Container border
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

      // ── Piston (left side) ──────────────────────
      const pistonX = bounds.left - PISTON_WIDTH;
      const pistonGrad = ctx.createLinearGradient(pistonX, 0, bounds.left, 0);
      pistonGrad.addColorStop(0, "#475569");
      pistonGrad.addColorStop(0.3, "#94a3b8");
      pistonGrad.addColorStop(0.7, "#94a3b8");
      pistonGrad.addColorStop(1, "#64748b");
      ctx.fillStyle = pistonGrad;
      ctx.fillRect(pistonX, bounds.top, PISTON_WIDTH, bounds.height);

      // Piston grip lines
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      for (let gy = bounds.top + 15; gy < bounds.bottom - 10; gy += 12) {
        ctx.beginPath();
        ctx.moveTo(pistonX + 4, gy);
        ctx.lineTo(bounds.left - 4, gy);
        ctx.stroke();
      }

      // Piston handle / rod
      const handleY = (bounds.top + bounds.bottom) / 2;
      ctx.fillStyle = "#64748b";
      ctx.fillRect(pistonX - 30, handleY - 6, 32, 12);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(pistonX - 30, handleY - 6, 32, 12);

      // ── Wall labels ─────────────────────────────
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Piston", pistonX + PISTON_WIDTH / 2, bounds.bottom + 16);

      // ── Particles ───────────────────────────────
      const maxSpd = maxReasonableSpeed() * SPEED_SCALE;
      for (const p of particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const color = speedToColor(speed, maxSpd);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Subtle glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ── Speed legend ────────────────────────────
      const legendX = W - 50;
      const legendY = bounds.top + 10;
      const legendH = 120;
      const legendW = 12;
      const legendGrad = ctx.createLinearGradient(0, legendY + legendH, 0, legendY);
      legendGrad.addColorStop(0, speedToColor(0, 1));
      legendGrad.addColorStop(0.25, speedToColor(0.25, 1));
      legendGrad.addColorStop(0.5, speedToColor(0.5, 1));
      legendGrad.addColorStop(0.75, speedToColor(0.75, 1));
      legendGrad.addColorStop(1, speedToColor(1, 1));
      ctx.fillStyle = legendGrad;
      ctx.fillRect(legendX, legendY, legendW, legendH);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, legendY, legendW, legendH);

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText("Fast", legendX + legendW + 4, legendY + 8);
      ctx.fillText("Slow", legendX + legendW + 4, legendY + legendH - 2);

      // ── Data panel (bottom) ─────────────────────
      const panelY = H - CONTAINER_MARGIN_BOTTOM + 14;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      // Theoretical PV = nRT values
      const n_moles = numParticles / N_A; // extremely small, but consistent
      const V_m3_ideal = (volumePct / 100) * 1e-24; // arbitrary small volume
      const P_ideal = (n_moles * R_GAS * temperature) / V_m3_ideal;

      // Measured pressure (simulation units)
      const col1 = 20;
      const col2 = W / 2 + 10;

      // Row 1
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`T = ${temperature} K`, col1, panelY);
      ctx.fillStyle = "#34d399";
      ctx.fillText(`V = ${volumePct}%`, col1 + 150, panelY);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`n = ${numParticles} particles`, col1 + 280, panelY);

      // Row 2
      const row2Y = panelY + 20;
      const vAvg = averageSpeed();
      ctx.fillStyle = "#f472b6";
      ctx.fillText(
        `v_avg = ${roundSig(vAvg, 3)} m/s  (Maxwell-Boltzmann)`,
        col1,
        row2Y
      );

      // Row 3
      const row3Y = panelY + 40;
      ctx.fillStyle = "#c084fc";
      ctx.fillText(
        `Measured P (sim) = ${roundSig(measuredPressure, 4)} arb. units`,
        col1,
        row3Y
      );
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        `Ideal P = nRT/V = ${roundSig(P_ideal, 3)} Pa`,
        col2,
        row3Y
      );

      // Relationship note
      const row4Y = panelY + 58;
      ctx.fillStyle = "#64748b";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      const note =
        volumePct < 40
          ? "Low volume => high pressure (Boyle's Law: P inversely proportional to V)"
          : temperature > 600
            ? "High temperature => fast particles => high pressure (Gay-Lussac's Law)"
            : "PV = nRT  |  Pressure rises with T and n, falls with V";
      ctx.fillText(note, col1, row4Y);
    },

    reset() {
      temperature = config.parameters.find((p) => p.key === "temperature")!.defaultValue;
      volumePct = config.parameters.find((p) => p.key === "volume")!.defaultValue;
      numParticles = config.parameters.find((p) => p.key === "numParticles")!.defaultValue;
      pressureSamples = [];
      wallImpulseAccum = 0;
      measuredPressure = 0;
      spawnParticles();
    },

    destroy() {
      particles = [];
      pressureSamples = [];
    },

    getStateDescription(): string {
      const vAvg = averageSpeed();
      return (
        `Gas Laws simulation: ${numParticles} particles at T=${temperature} K, ` +
        `V=${volumePct}%, measured pressure=${roundSig(measuredPressure, 3)} (arb. units). ` +
        `Average molecular speed (Maxwell-Boltzmann) = ${roundSig(vAvg, 3)} m/s. ` +
        `Ideal gas law: PV=nRT.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      // Reposition particles to be inside new container bounds
      const bounds = containerBounds();
      for (const p of particles) {
        p.x = Math.max(bounds.left + p.radius, Math.min(bounds.right - p.radius, p.x));
        p.y = Math.max(bounds.top + p.radius, Math.min(bounds.bottom - p.radius, p.y));
      }
    },
  };

  return engine;
};

export default GasLawsFactory;
