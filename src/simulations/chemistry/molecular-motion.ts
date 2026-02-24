import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ───────────────────────────────────────────────
const kB = 1.380649e-23; // Boltzmann constant (J/K)

// ─── Molecule types ──────────────────────────────────────────────────
interface MoleculeType {
  name: string;
  mass: number; // kg per molecule
  color: string; // base tint used in legend
  radiusFactor: number; // multiplied by moleculeSize param
}

const MOLECULE_TYPES: MoleculeType[] = [
  {
    name: "H\u2082",
    mass: 3.32e-27, // 2 g/mol
    color: "#60a5fa",
    radiusFactor: 0.7,
  },
  {
    name: "N\u2082",
    mass: 4.65e-26, // 28 g/mol
    color: "#34d399",
    radiusFactor: 1.0,
  },
  {
    name: "CO\u2082",
    mass: 7.31e-26, // 44 g/mol
    color: "#fbbf24",
    radiusFactor: 1.3,
  },
];

// ─── Particle type ───────────────────────────────────────────────────
interface Molecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  typeIndex: number; // index into MOLECULE_TYPES
}

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

// ─── Rendering helpers ───────────────────────────────────────────────
function speedToColor(speed: number, maxSpeed: number): string {
  const t = Math.min(speed / maxSpeed, 1);
  // cool blue -> green -> yellow -> hot red
  if (t < 0.2) {
    const s = t / 0.2;
    const r = Math.round(20 + 20 * s);
    const g = Math.round(60 + 100 * s);
    const b = Math.round(180 + 75 * s);
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.45) {
    const s = (t - 0.2) / 0.25;
    const r = Math.round(40 + 40 * s);
    const g = Math.round(160 + 95 * s);
    const b = Math.round(255 - 140 * s);
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.7) {
    const s = (t - 0.45) / 0.25;
    const r = Math.round(80 + 175 * s);
    const g = 255;
    const b = Math.round(115 - 115 * s);
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.7) / 0.3;
    const r = 255;
    const g = Math.round(255 - 200 * s);
    const b = Math.round(30 * (1 - s));
    return `rgb(${r},${g},${b})`;
  }
}

function roundSig(value: number, digits: number): string {
  if (value === 0) return "0";
  return value.toPrecision(digits);
}

// ─── Factory ─────────────────────────────────────────────────────────
const MolecularMotionFactory: SimulationFactory = () => {
  const config = getSimConfig("molecular-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // State
  let molecules: Molecule[] = [];
  let temperature = 300;
  let numMolecules = 100;
  let moleculeSize = 4;

  // Container layout
  const MARGIN_TOP = 50;
  const MARGIN_BOTTOM = 20;
  const MARGIN_LEFT = 20;
  const HISTOGRAM_WIDTH_FRAC = 0.28; // fraction of canvas width for histogram panel

  // Pressure tracking
  let wallImpulseAccum = 0;
  let pressureSamples: number[] = [];
  const PRESSURE_WINDOW = 60;
  let measuredPressure = 0;

  // Speed scale: map physical speeds to pixel speeds.
  // v_avg(300 K, N2) ~ 476 m/s => ~3 px/frame at 60 fps.
  const SPEED_SCALE = 3.0 / 476;

  // ── Layout helpers ─────────────────────────────────────────────
  function containerBounds(): Rect {
    const histW = W * HISTOGRAM_WIDTH_FRAC;
    const right = W - histW - 10;
    return {
      left: MARGIN_LEFT,
      right,
      top: MARGIN_TOP,
      bottom: H - MARGIN_BOTTOM,
      width: right - MARGIN_LEFT,
      height: H - MARGIN_BOTTOM - MARGIN_TOP,
    };
  }

  function histogramBounds(): Rect {
    const histW = W * HISTOGRAM_WIDTH_FRAC - 20;
    const left = W - histW - 10;
    return {
      left,
      right: W - 10,
      top: MARGIN_TOP + 30,
      bottom: H - MARGIN_BOTTOM - 50,
      width: histW,
      height: H - MARGIN_BOTTOM - 50 - (MARGIN_TOP + 30),
    };
  }

  // ── Physics helpers ────────────────────────────────────────────
  /** Box-Muller: one component of velocity drawn from Maxwell-Boltzmann */
  function mbSpeedComponent(mass: number): number {
    const sigma = Math.sqrt((kB * temperature) / mass);
    const u1 = Math.random() || Number.MIN_VALUE; // Guard against log(0)
    const u2 = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Upper bound for speed color mapping (based on lightest molecule) */
  function maxReasonableSpeed(): number {
    const lightMass = MOLECULE_TYPES[0].mass;
    const vp = Math.sqrt((2 * kB * temperature) / lightMass);
    return vp * 2.5 * SPEED_SCALE;
  }

  function createMolecule(): Molecule {
    const bounds = containerBounds();
    const typeIndex = Math.floor(Math.random() * MOLECULE_TYPES.length);
    const mt = MOLECULE_TYPES[typeIndex];
    const radius = moleculeSize * mt.radiusFactor;
    const x = bounds.left + radius + Math.random() * (bounds.width - 2 * radius);
    const y = bounds.top + radius + Math.random() * (bounds.height - 2 * radius);
    const vxPhys = mbSpeedComponent(mt.mass);
    const vyPhys = mbSpeedComponent(mt.mass);
    return {
      x,
      y,
      vx: vxPhys * SPEED_SCALE,
      vy: vyPhys * SPEED_SCALE,
      radius,
      typeIndex,
    };
  }

  function spawnMolecules() {
    molecules = [];
    for (let i = 0; i < numMolecules; i++) {
      molecules.push(createMolecule());
    }
  }

  function rescaleSpeeds(oldTemp: number, newTemp: number) {
    if (oldTemp <= 0) return;
    const factor = Math.sqrt(newTemp / oldTemp);
    for (const m of molecules) {
      m.vx *= factor;
      m.vy *= factor;
    }
  }

  function resizeParticles(newSize: number) {
    const bounds = containerBounds();
    for (const m of molecules) {
      const mt = MOLECULE_TYPES[m.typeIndex];
      m.radius = newSize * mt.radiusFactor;
      m.x = Math.max(bounds.left + m.radius, Math.min(bounds.right - m.radius, m.x));
      m.y = Math.max(bounds.top + m.radius, Math.min(bounds.bottom - m.radius, m.y));
    }
  }

  /** Elastic collision between two molecules (mass-weighted) */
  function resolveCollision(a: Molecule, b: Molecule) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = a.radius + b.radius;
    if (dist >= minDist || dist === 0) return;

    const nx = dx / dist;
    const ny = dy / dist;

    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const dvn = dvx * nx + dvy * ny;

    if (dvn <= 0) return; // already separating

    const mA = MOLECULE_TYPES[a.typeIndex].mass;
    const mB = MOLECULE_TYPES[b.typeIndex].mass;
    const totalMass = mA + mB;

    // Elastic impulse scalar
    const impulse = (2 * dvn) / totalMass;

    a.vx -= impulse * mB * nx;
    a.vy -= impulse * mB * ny;
    b.vx += impulse * mA * nx;
    b.vy += impulse * mA * ny;

    // Separate overlapping molecules
    const overlap = minDist - dist;
    const sepA = overlap * (mB / totalMass) + 0.5;
    const sepB = overlap * (mA / totalMass) + 0.5;
    a.x -= nx * sepA;
    a.y -= ny * sepA;
    b.x += nx * sepB;
    b.y += ny * sepB;
  }

  // ── Render sub-routines (closures over ctx, molecules, etc.) ───
  function renderHistogram(hb: Rect, maxSpd: number) {
    // Title
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("Speed Distribution", (hb.left + hb.right) / 2, hb.top - 10);

    // Background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(hb.left, hb.top, hb.width, hb.height);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(hb.left, hb.top, hb.width, hb.height);

    // Build histogram bins
    const numBins = 20;
    const bins: number[] = new Array(numBins).fill(0);
    const binWidth = maxSpd / numBins;

    for (const m of molecules) {
      const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      const binIndex = Math.min(Math.floor(speed / binWidth), numBins - 1);
      bins[binIndex]++;
    }

    const maxBin = Math.max(...bins, 1);
    const barW = hb.width / numBins;

    for (let i = 0; i < numBins; i++) {
      const barH = (bins[i] / maxBin) * (hb.height - 20);
      const bx = hb.left + i * barW;
      const by = hb.bottom - barH;
      const midSpeed = (i + 0.5) * binWidth;
      const color = speedToColor(midSpeed, maxSpd);

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(bx + 1, by, barW - 2, barH);
      ctx.globalAlpha = 1;
    }

    // Overlay theoretical Maxwell-Boltzmann curve for N2
    // Our simulation is 2D, so use the 2D M-B distribution:
    //   f(v) = (m / kT) * v * exp(-m v^2 / (2 kT))
    const n2Mass = MOLECULE_TYPES[1].mass;
    const curvePoints: { cx: number; cy: number }[] = [];
    let maxCurveVal = 0;
    const curveSteps = 100;
    for (let i = 0; i <= curveSteps; i++) {
      const vPixel = (i / curveSteps) * maxSpd;
      const vReal = vPixel / SPEED_SCALE; // convert back to m/s
      const fv =
        (n2Mass / (kB * temperature)) *
        vReal *
        Math.exp((-n2Mass * vReal * vReal) / (2 * kB * temperature));
      if (fv > maxCurveVal) maxCurveVal = fv;
      curvePoints.push({ cx: vPixel, cy: fv });
    }

    if (maxCurveVal > 0) {
      const scaleFactor = (hb.height - 20) / maxCurveVal;
      ctx.beginPath();
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      for (let i = 0; i < curvePoints.length; i++) {
        const px = hb.left + (curvePoints[i].cx / maxSpd) * hb.width;
        const py = hb.bottom - curvePoints[i].cy * scaleFactor;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Axis labels
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Speed \u2192", (hb.left + hb.right) / 2, hb.bottom + 14);
    ctx.textAlign = "left";
    ctx.fillText("slow", hb.left + 4, hb.bottom + 14);
    ctx.textAlign = "right";
    ctx.fillText("fast", hb.right - 4, hb.bottom + 14);

    // Curve legend
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText("--- M-B theory (N\u2082)", hb.left + 4, hb.bottom + 28);
  }

  function renderDataPanel(bounds: Rect) {
    const px = bounds.left + 8;
    let py = bounds.top + 18;
    const lineH = 17;

    // Semi-transparent backdrop for readability
    ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
    ctx.fillRect(bounds.left + 2, bounds.top + 2, 210, lineH * 7 + 6);

    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";

    // Temperature
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`T = ${temperature} K`, px, py);
    py += lineH;

    // Average KE = 3/2 kT
    const avgKE = 1.5 * kB * temperature;
    ctx.fillStyle = "#f472b6";
    ctx.fillText(
      `Avg KE = \u00BE kT = ${roundSig(avgKE * 1e21, 3)} \u00D7 10\u207B\u00B2\u00B9 J`,
      px,
      py
    );
    py += lineH;

    // Average speed per molecule type (Maxwell-Boltzmann: v_avg = sqrt(8kT/pi*m))
    for (const mt of MOLECULE_TYPES) {
      const vAvg = Math.sqrt((8 * kB * temperature) / (Math.PI * mt.mass));
      ctx.fillStyle = mt.color;
      ctx.fillText(`v\u0305(${mt.name}) = ${Math.round(vAvg)} m/s`, px, py);
      py += lineH;
    }

    // Measured pressure
    ctx.fillStyle = "#c084fc";
    ctx.fillText(`P(sim) = ${roundSig(measuredPressure, 3)} arb.`, px, py);
    py += lineH;

    // Molecule count
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${numMolecules} molecules`, px, py);
  }

  function renderLegend(hb: Rect) {
    const ly = hb.bottom + 44;
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("Molecule Types", hb.left + hb.width / 2, ly);

    const typeW = hb.width / MOLECULE_TYPES.length;
    for (let i = 0; i < MOLECULE_TYPES.length; i++) {
      const mt = MOLECULE_TYPES[i];
      const cx = hb.left + i * typeW + typeW / 2;
      const cy = ly + 18;

      // Sample circle
      const r = moleculeSize * mt.radiusFactor;
      ctx.beginPath();
      ctx.arc(cx - 20, cy, Math.max(r, 2), 0, Math.PI * 2);
      ctx.fillStyle = mt.color;
      ctx.fill();

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      const massGmol = Math.round(mt.mass * 6.022e23 * 1000);
      ctx.fillText(`${mt.name} (${massGmol}g)`, cx - 12, cy + 4);
    }
  }

  // ── Engine ─────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      spawnMolecules();
    },

    update(dt: number, params: Record<string, number>) {
      const newTemp = params.temperature ?? temperature;
      const newNum = Math.round(params.numMolecules ?? numMolecules);
      const newSize = params.moleculeSize ?? moleculeSize;

      // Temperature change -- rescale velocities to match new thermal distribution
      if (newTemp !== temperature) {
        rescaleSpeeds(temperature, newTemp);
        temperature = newTemp;
      }

      // Molecule size change
      if (newSize !== moleculeSize) {
        moleculeSize = newSize;
        resizeParticles(newSize);
      }

      // Molecule count change
      if (newNum !== numMolecules) {
        if (newNum > numMolecules) {
          for (let i = numMolecules; i < newNum; i++) {
            molecules.push(createMolecule());
          }
        } else {
          molecules.length = newNum;
        }
        numMolecules = newNum;
      }

      const dtClamped = Math.min(dt, 0.05);
      const substeps = 3;
      const subDt = dtClamped / substeps;
      const frameFraction = subDt / (1 / 60);
      const bounds = containerBounds();

      let impulseThisFrame = 0;

      for (let step = 0; step < substeps; step++) {
        // Move molecules
        for (const m of molecules) {
          m.x += m.vx * frameFraction;
          m.y += m.vy * frameFraction;
        }

        // Inter-molecule elastic collisions (O(n^2) brute force, fine for n <= 300)
        for (let i = 0; i < molecules.length; i++) {
          for (let j = i + 1; j < molecules.length; j++) {
            resolveCollision(molecules[i], molecules[j]);
          }
        }

        // Wall collisions (elastic bounce + impulse tracking)
        for (const m of molecules) {
          if (m.x - m.radius < bounds.left) {
            m.x = bounds.left + m.radius;
            impulseThisFrame += 2 * Math.abs(m.vx);
            m.vx = Math.abs(m.vx);
          }
          if (m.x + m.radius > bounds.right) {
            m.x = bounds.right - m.radius;
            impulseThisFrame += 2 * Math.abs(m.vx);
            m.vx = -Math.abs(m.vx);
          }
          if (m.y - m.radius < bounds.top) {
            m.y = bounds.top + m.radius;
            impulseThisFrame += 2 * Math.abs(m.vy);
            m.vy = Math.abs(m.vy);
          }
          if (m.y + m.radius > bounds.bottom) {
            m.y = bounds.bottom - m.radius;
            impulseThisFrame += 2 * Math.abs(m.vy);
            m.vy = -Math.abs(m.vy);
          }
        }
      }

      // Rolling-window pressure measurement
      wallImpulseAccum = impulseThisFrame;
      pressureSamples.push(wallImpulseAccum);
      if (pressureSamples.length > PRESSURE_WINDOW) {
        pressureSamples.shift();
      }
      const avgImpulse =
        pressureSamples.reduce((a, b) => a + b, 0) / pressureSamples.length;
      const perimeter = 2 * (bounds.width + bounds.height);
      measuredPressure = perimeter > 0 ? (avgImpulse / perimeter) * 1000 : 0;
    },

    render() {
      if (!ctx) return;
      const bounds = containerBounds();
      const histBounds = histogramBounds();

      // ── Background ──────────────────────────────
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(
        "Molecular Motion  \u2014  Kinetic Molecular Theory",
        W / 2,
        28
      );

      // Subtitle
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Avg KE = \u00BE kT  |  Maxwell-Boltzmann speed distribution", W / 2, 44);

      // ── Container ───────────────────────────────
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

      // ── Molecules ───────────────────────────────
      const maxSpd = maxReasonableSpeed();
      for (const m of molecules) {
        const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
        const color = speedToColor(speed, maxSpd);

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Subtle outline for depth
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius + 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Histogram panel ─────────────────────────
      renderHistogram(histBounds, maxSpd);

      // ── Data overlay ────────────────────────────
      renderDataPanel(bounds);

      // ── Molecule type legend ────────────────────
      renderLegend(histBounds);
    },

    reset() {
      temperature =
        config.parameters.find((p) => p.key === "temperature")!.defaultValue;
      numMolecules =
        config.parameters.find((p) => p.key === "numMolecules")!.defaultValue;
      moleculeSize =
        config.parameters.find((p) => p.key === "moleculeSize")!.defaultValue;
      pressureSamples = [];
      wallImpulseAccum = 0;
      measuredPressure = 0;
      spawnMolecules();
    },

    destroy() {
      molecules = [];
      pressureSamples = [];
    },

    getStateDescription(): string {
      const avgKE = 1.5 * kB * temperature;
      const speeds = MOLECULE_TYPES.map((mt) => {
        const v = Math.sqrt((8 * kB * temperature) / (Math.PI * mt.mass));
        return `${mt.name}: ${Math.round(v)} m/s`;
      }).join(", ");
      return (
        `Molecular Motion simulation: ${numMolecules} molecules at T=${temperature} K. ` +
        `Average KE = ${roundSig(avgKE, 3)} J. ` +
        `Average speeds: ${speeds}. ` +
        `Measured pressure = ${roundSig(measuredPressure, 3)} (arb. units). ` +
        `Molecule types: H\u2082, N\u2082, CO\u2082 with different masses and sizes.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      const bounds = containerBounds();
      for (const m of molecules) {
        m.x = Math.max(
          bounds.left + m.radius,
          Math.min(bounds.right - m.radius, m.x)
        );
        m.y = Math.max(
          bounds.top + m.radius,
          Math.min(bounds.bottom - m.radius, m.y)
        );
      }
    },
  };

  return engine;
};

export default MolecularMotionFactory;
