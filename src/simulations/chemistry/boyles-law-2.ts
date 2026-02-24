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

// ─── PV data point for graph ────────────────────────────────────────
interface PVPoint {
  P: number;
  V: number;
}

// ─── Weight block visual ────────────────────────────────────────────
interface WeightBlock {
  mass: number;
  color: string;
  label: string;
}

const WEIGHT_COLORS = [
  "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#e11d48",
];

// ─── Factory ────────────────────────────────────────────────────────
const BoylesLaw2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("boyles-law-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (cached)
  let weightMass = 0; // kg of weights on piston
  let temperature = 300; // K
  let numParticles = 40;
  let showGraph = 1;

  // Derived state
  let particles: Particle[] = [];
  let currentPressure = 1; // atm
  let currentVolume = 1; // relative

  // Piston area in m² (for real physics formula)
  const PISTON_AREA = 0.01; // m²
  const ATM_PA = 101325; // 1 atm in Pa
  const g = 9.81;

  // Reference state
  const V_REF = 1.0; // reference volume at 1 atm
  const P_REF = 1.0; // 1 atm baseline (atmosphere alone)

  // PV graph data
  let pvPoints: PVPoint[] = [];
  const MAX_PV_POINTS = 100;

  // Piston animation
  let pistonYTarget = 0;
  let pistonYCurrent = 0;

  // Speed scaling: at 300K v_rms(N2) ~ 517 m/s => ~3px/frame
  const SPEED_SCALE = 3.0 / 517;

  // Cylinder geometry (vertical)
  const CYL_LEFT_FRAC = 0.08;
  const CYL_RIGHT_FRAC = 0.42;
  const CYL_BOTTOM_FRAC = 0.88;
  const CYL_TOP_FRAC = 0.12; // topmost the piston can go
  const PISTON_HEIGHT = 14;

  function cylLeft(): number { return W * CYL_LEFT_FRAC; }
  function cylRight(): number { return W * CYL_RIGHT_FRAC; }
  function cylBottom(): number { return H * CYL_BOTTOM_FRAC; }
  function cylTopMin(): number { return H * CYL_TOP_FRAC; }
  function cylWidth(): number { return cylRight() - cylLeft(); }

  // ── Helpers ───────────────────────────────────────────────────────
  function computePressure(mass: number): number {
    // P = 1 + (g * m) / (A * 101325)  in atm
    return P_REF + (g * mass) / (PISTON_AREA * ATM_PA);
  }

  function computeVolume(P: number): number {
    // Boyle's Law: PV = k => V = k/P at constant T
    const k = P_REF * V_REF;
    return k / P;
  }

  function computePistonY(): number {
    // Map volume to piston position
    // At max volume (P=1 atm, mass=0), piston at top
    // At min volume, piston near bottom
    const maxVolume = V_REF; // at 1 atm
    const minVolume = computeVolume(computePressure(50)); // at max weight
    const bottom = cylBottom();
    const top = cylTopMin() + 60; // leave room for weights above piston

    const volFrac = (currentVolume - minVolume) / (maxVolume - minVolume);
    const clampedFrac = Math.max(0, Math.min(1, volFrac));
    return bottom - clampedFrac * (bottom - top);
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

  function gasBounds() {
    const left = cylLeft() + 4;
    const right = cylRight() - 4;
    const bottom = cylBottom() - 4;
    const top = pistonYCurrent + PISTON_HEIGHT + 2;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  function createParticle(): Particle {
    const bounds = gasBounds();
    const r = 3;
    return {
      x: bounds.left + r + Math.random() * Math.max(10, bounds.width - 2 * r),
      y: bounds.top + r + Math.random() * Math.max(10, bounds.height - 2 * r),
      vx: mbSpeedComponent() * SPEED_SCALE,
      vy: mbSpeedComponent() * SPEED_SCALE,
      radius: r,
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

  function getWeightBlocks(totalMass: number): WeightBlock[] {
    const blocks: WeightBlock[] = [];
    // Each block is 5 kg
    const blockMass = 5;
    const count = Math.round(totalMass / blockMass);
    for (let i = 0; i < count; i++) {
      blocks.push({
        mass: blockMass,
        color: WEIGHT_COLORS[i % WEIGHT_COLORS.length],
        label: `${blockMass}kg`,
      });
    }
    // Handle remainder
    const remainder = totalMass - count * blockMass;
    if (Math.abs(remainder) > 0.1) {
      blocks.push({
        mass: remainder,
        color: WEIGHT_COLORS[count % WEIGHT_COLORS.length],
        label: `${remainder}kg`,
      });
    }
    return blocks;
  }

  // Graph bounds
  function graphBounds() {
    const left = W * 0.52;
    const right = W - 30;
    const top = H * 0.12;
    const bottom = H * 0.62;
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
      currentPressure = computePressure(weightMass);
      currentVolume = computeVolume(currentPressure);
      pistonYTarget = computePistonY();
      pistonYCurrent = pistonYTarget;
      spawnParticles();
      pvPoints = [];
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newWeight = params.weightMass ?? weightMass;
      const newTemp = params.temperature ?? temperature;
      const newNum = Math.round(params.numParticles ?? numParticles);
      showGraph = Math.round(params.showGraph ?? 1);

      // Temperature change
      if (newTemp !== temperature) {
        rescaleSpeeds(temperature, newTemp);
        temperature = newTemp;
      }

      // Weight change -> pressure change -> volume change
      weightMass = newWeight;
      currentPressure = computePressure(weightMass);
      currentVolume = computeVolume(currentPressure);

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

      // Smooth piston animation
      pistonYTarget = computePistonY();
      const pistonSpeed = 8;
      pistonYCurrent += (pistonYTarget - pistonYCurrent) * Math.min(1, pistonSpeed * dtClamped);

      // Physics substeps
      const substeps = 3;
      const subDt = dtClamped / substeps;
      const frameFraction = subDt / (1 / 60);
      const bounds = gasBounds();

      for (let step = 0; step < substeps; step++) {
        for (const p of particles) {
          p.x += p.vx * frameFraction;
          p.y += p.vy * frameFraction;

          // Wall collisions
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
        }
      }

      // Record PV point (throttled)
      if (pvPoints.length === 0 || Math.abs(pvPoints[pvPoints.length - 1].P - currentPressure) > 0.03) {
        pvPoints.push({ P: currentPressure, V: currentVolume });
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
      ctx.fillText("Boyle's Law: Weighted Piston", W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "P = 1 + mg/A\u00B7101325 atm  |  PV = constant at constant T",
        W / 2,
        48
      );

      const cLeft = cylLeft();
      const cRight = cylRight();
      const cBottom = cylBottom();
      const cWidth = cylWidth();

      // ── Cylinder walls ──────────────────────────────
      // Back wall (dark)
      ctx.fillStyle = "#1a2235";
      ctx.fillRect(cLeft, cylTopMin() - 20, cWidth, cBottom - cylTopMin() + 24);

      // Left wall
      const wallGrad = ctx.createLinearGradient(cLeft - 6, 0, cLeft + 6, 0);
      wallGrad.addColorStop(0, "#475569");
      wallGrad.addColorStop(0.5, "#94a3b8");
      wallGrad.addColorStop(1, "#475569");
      ctx.fillStyle = wallGrad;
      ctx.fillRect(cLeft - 6, cylTopMin() - 20, 8, cBottom - cylTopMin() + 24);

      // Right wall
      ctx.fillStyle = wallGrad;
      ctx.fillRect(cRight - 2, cylTopMin() - 20, 8, cBottom - cylTopMin() + 24);

      // Bottom wall
      const bottomGrad = ctx.createLinearGradient(0, cBottom, 0, cBottom + 8);
      bottomGrad.addColorStop(0, "#94a3b8");
      bottomGrad.addColorStop(1, "#475569");
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(cLeft - 6, cBottom, cWidth + 12, 8);

      // ── Gas particles ───────────────────────────────
      const bounds = gasBounds();
      const maxSpd = vRms() * SPEED_SCALE * 2.5;
      for (const p of particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const t = Math.min(speed / maxSpd, 1);

        let r: number, gVal: number, b: number;
        if (t < 0.5) {
          const s = t / 0.5;
          r = Math.round(30 + 80 * s);
          gVal = Math.round(180 + 75 * s);
          b = Math.round(255 - 80 * s);
        } else {
          const s = (t - 0.5) / 0.5;
          r = Math.round(110 + 145 * s);
          gVal = Math.round(255 - 130 * s);
          b = Math.round(175 - 175 * s);
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${gVal},${b})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${gVal},${b}, 0.3)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ── Piston ──────────────────────────────────────
      const pistonY = pistonYCurrent;
      const pistonGrad = ctx.createLinearGradient(0, pistonY, 0, pistonY + PISTON_HEIGHT);
      pistonGrad.addColorStop(0, "#94a3b8");
      pistonGrad.addColorStop(0.3, "#cbd5e1");
      pistonGrad.addColorStop(0.7, "#94a3b8");
      pistonGrad.addColorStop(1, "#64748b");
      ctx.fillStyle = pistonGrad;
      ctx.fillRect(cLeft + 1, pistonY, cWidth - 2, PISTON_HEIGHT);

      // Piston border
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(cLeft + 1, pistonY, cWidth - 2, PISTON_HEIGHT);

      // Grip lines on piston
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 0.8;
      for (let gx = cLeft + 12; gx < cRight - 8; gx += 8) {
        ctx.beginPath();
        ctx.moveTo(gx, pistonY + 3);
        ctx.lineTo(gx, pistonY + PISTON_HEIGHT - 3);
        ctx.stroke();
      }

      // ── Weight blocks on piston ─────────────────────
      const blocks = getWeightBlocks(weightMass);
      const blockHeight = 18;
      const blockWidth = cWidth * 0.6;
      const blockX = cLeft + (cWidth - blockWidth) / 2;

      for (let i = 0; i < blocks.length; i++) {
        const blockY = pistonY - (i + 1) * blockHeight;
        const block = blocks[i];

        // Block body
        const blkGrad = ctx.createLinearGradient(0, blockY, 0, blockY + blockHeight);
        blkGrad.addColorStop(0, block.color);
        blkGrad.addColorStop(0.5, block.color + "cc");
        blkGrad.addColorStop(1, block.color + "88");
        ctx.fillStyle = blkGrad;
        ctx.beginPath();
        ctx.roundRect(blockX, blockY, blockWidth, blockHeight - 2, 3);
        ctx.fill();

        // Block border
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(blockX, blockY, blockWidth, blockHeight - 2, 3);
        ctx.stroke();

        // Block label
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(block.label, blockX + blockWidth / 2, blockY + blockHeight / 2 + 2);
      }

      // Weight total label
      if (weightMass > 0) {
        const topBlock = pistonY - blocks.length * blockHeight;
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Total: ${weightMass} kg`, blockX + blockWidth / 2, topBlock - 8);
      }

      // Pressure arrow pointing down on piston
      const arrowX = cRight + 20;
      const arrowLen = Math.min(40, 10 + weightMass * 0.6);
      ctx.beginPath();
      ctx.moveTo(arrowX, pistonY - 5);
      ctx.lineTo(arrowX, pistonY + arrowLen);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(arrowX, pistonY + arrowLen);
      ctx.lineTo(arrowX - 5, pistonY + arrowLen - 8);
      ctx.lineTo(arrowX + 5, pistonY + arrowLen - 8);
      ctx.closePath();
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "left";
      ctx.fillText(`P = ${currentPressure.toFixed(2)} atm`, arrowX + 8, pistonY + arrowLen / 2);

      // ── PV Graph ────────────────────────────────────
      if (showGraph) {
        const gb = graphBounds();

        // Graph background
        ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
        ctx.beginPath();
        ctx.roundRect(gb.left, gb.top, gb.width, gb.height, 6);
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(gb.left, gb.top, gb.width, gb.height, 6);
        ctx.stroke();

        // Graph title
        ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.textAlign = "center";
        ctx.fillText("PV Diagram (Boyle's Law Hyperbola)", (gb.left + gb.right) / 2, gb.top - 8);

        // Axes labels
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText("Volume (V)", (gb.left + gb.right) / 2, gb.bottom + 16);

        ctx.save();
        ctx.translate(gb.left - 14, (gb.top + gb.bottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillText("Pressure (P)", 0, 0);
        ctx.restore();

        // Graph range
        const k = P_REF * V_REF;
        const Pmin = 0.8;
        const Pmax = 6;
        const Vmin = k / Pmax;
        const Vmax = k / Pmin;

        // Draw theoretical Boyle's Law curve: P = k/V
        ctx.beginPath();
        ctx.strokeStyle = "#475569";
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

        // Label on curve
        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "left";
        const labelV = Vmax * 0.7;
        const labelP = k / labelV;
        const labelPx = gb.left + ((labelV - Vmin) / (Vmax - Vmin)) * gb.width;
        const labelPy = gb.bottom - ((labelP - Pmin) / (Pmax - Pmin)) * gb.height;
        ctx.fillText("PV = const", labelPx + 5, labelPy - 5);

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
          const py = gb.bottom - ((currentPressure - Pmin) / (Pmax - Pmin)) * gb.height;
          if (px >= gb.left && px <= gb.right && py >= gb.top && py <= gb.bottom) {
            const glow = ctx.createRadialGradient(px, py, 0, px, py, 14);
            glow.addColorStop(0, "rgba(56, 189, 248, 0.5)");
            glow.addColorStop(1, "rgba(56, 189, 248, 0)");
            ctx.beginPath();
            ctx.arc(px, py, 14, 0, Math.PI * 2);
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

        // Volume ticks
        ctx.textAlign = "center";
        for (let v = Math.ceil(Vmin * 10) / 10; v <= Vmax; v += 0.2) {
          const px = gb.left + ((v - Vmin) / (Vmax - Vmin)) * gb.width;
          if (px >= gb.left && px <= gb.right) {
            ctx.beginPath();
            ctx.moveTo(px, gb.bottom);
            ctx.lineTo(px, gb.bottom + 4);
            ctx.strokeStyle = "#475569";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillText(v.toFixed(1), px, gb.bottom + 14);
          }
        }

        // Pressure ticks
        ctx.textAlign = "right";
        for (let p = Math.ceil(Pmin); p <= Pmax; p += 1) {
          const py = gb.bottom - ((p - Pmin) / (Pmax - Pmin)) * gb.height;
          if (py >= gb.top && py <= gb.bottom) {
            ctx.beginPath();
            ctx.moveTo(gb.left, py);
            ctx.lineTo(gb.left - 4, py);
            ctx.strokeStyle = "#475569";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillText(p.toFixed(0), gb.left - 6, py + 3);
          }
        }
      }

      // ── Data panel ──────────────────────────────────
      const dpX = W * 0.52;
      const dpY = H * 0.68;
      ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
      ctx.beginPath();
      ctx.roundRect(dpX, dpY, W - dpX - 20, H - dpY - 15, 6);
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(dpX, dpY, W - dpX - 20, H - dpY - 15, 6);
      ctx.stroke();

      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Boyle's Law Data", dpX + 12, dpY + 18);

      ctx.font = "11px 'Inter', system-ui, sans-serif";

      ctx.fillStyle = "#f472b6";
      ctx.fillText(`Weight on piston: ${weightMass} kg`, dpX + 12, dpY + 38);

      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Pressure: P = ${currentPressure.toFixed(3)} atm`, dpX + 12, dpY + 56);

      ctx.fillStyle = "#34d399";
      ctx.fillText(`Volume: V = ${currentVolume.toFixed(4)} (relative)`, dpX + 12, dpY + 74);

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`PV = ${(currentPressure * currentVolume).toFixed(4)} = const`, dpX + 12, dpY + 92);

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Temperature: ${temperature} K (constant)`, dpX + 12, dpY + 110);

      ctx.fillStyle = "#c084fc";
      const vrms = vRms();
      ctx.fillText(`v_rms = ${Math.round(vrms)} m/s`, dpX + 12, dpY + 128);

      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${numParticles} particles`, dpX + 12, dpY + 146);

      // Formula
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("P = 1 + mg/(A\u00D7101325) atm", dpX + 12, dpY + 166);
      ctx.fillText(`A = ${PISTON_AREA} m\u00B2, g = ${g} m/s\u00B2`, dpX + 12, dpY + 180);

      // Time
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      weightMass = config.parameters.find((p) => p.key === "weightMass")!.defaultValue;
      temperature = config.parameters.find((p) => p.key === "temperature")!.defaultValue;
      numParticles = config.parameters.find((p) => p.key === "numParticles")!.defaultValue;
      showGraph = config.parameters.find((p) => p.key === "showGraph")!.defaultValue;
      currentPressure = computePressure(weightMass);
      currentVolume = computeVolume(currentPressure);
      pistonYTarget = computePistonY();
      pistonYCurrent = pistonYTarget;
      pvPoints = [];
      time = 0;
      spawnParticles();
    },

    destroy() {
      particles = [];
      pvPoints = [];
    },

    getStateDescription(): string {
      const vrms = vRms();
      return (
        `Boyle's Law (Weighted Piston): ${weightMass} kg on piston. ` +
        `P = ${currentPressure.toFixed(3)} atm, V = ${currentVolume.toFixed(4)} (relative). ` +
        `T = ${temperature} K (constant), ${numParticles} particles. ` +
        `PV = ${(currentPressure * currentVolume).toFixed(4)} (constant). ` +
        `v_rms = ${Math.round(vrms)} m/s. ` +
        `Formula: P = 1 + mg/(A*101325) atm, A = ${PISTON_AREA} m\u00B2. ` +
        `Adding weight increases pressure, decreasing volume by Boyle's Law.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      pistonYTarget = computePistonY();
      pistonYCurrent = pistonYTarget;
      const bounds = gasBounds();
      for (const p of particles) {
        p.x = Math.max(bounds.left + p.radius, Math.min(bounds.right - p.radius, p.x));
        p.y = Math.max(bounds.top + p.radius, Math.min(bounds.bottom - p.radius, p.y));
      }
    },
  };

  return engine;
};

export default BoylesLaw2Factory;
