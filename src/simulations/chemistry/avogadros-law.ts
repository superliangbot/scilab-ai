import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ---- Gas data ---------------------------------------------------------------
interface GasInfo {
  name: string;
  formula: string;
  molarMass: number; // g/mol
  color: string;
  glowColor: string;
}

const GASES: GasInfo[] = [
  { name: "Hydrogen",       formula: "H\u2082",  molarMass: 2,  color: "#e8e8f0", glowColor: "rgba(232,232,240,0.35)" },
  { name: "Oxygen",         formula: "O\u2082",  molarMass: 32, color: "#ef4444", glowColor: "rgba(239,68,68,0.35)" },
  { name: "Nitrogen",       formula: "N\u2082",  molarMass: 28, color: "#3b82f6", glowColor: "rgba(59,130,246,0.35)" },
  { name: "Carbon Dioxide", formula: "CO\u2082", molarMass: 44, color: "#9ca3af", glowColor: "rgba(156,163,175,0.35)" },
];

// ---- Particle type ----------------------------------------------------------
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ---- Factory ----------------------------------------------------------------
const AvogadrosLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("avogadros-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters (cached)
  let molecules1 = 20;
  let molecules2 = 10;
  let temperature = 300;
  let gasType = 1;

  // Particle arrays for each balloon
  let particles1: Particle[] = [];
  let particles2: Particle[] = [];

  // Physics helpers
  const R_GAS = 8.314; // J/(mol*K)
  const kB = 1.380649e-23;

  /** Characteristic speed proportional to sqrt(T / M) */
  function charSpeed(molarMass: number, temp: number): number {
    // scale so it looks good on-screen (pixels / second)
    return 120 * Math.sqrt(temp / (molarMass * 100));
  }

  /** Volume (in arbitrary visual units) proportional to n at constant T,P */
  function balloonRadius(n: number): number {
    // V proportional to n => radius proportional to n^(1/3) (3D) but we show as 2D oval
    // For visual clarity use a linear-ish scaling
    const baseRadius = Math.min(width, height) * 0.1;
    const scale = Math.min(width, height) * 0.004;
    return baseRadius + scale * n;
  }

  function createParticles(count: number, cx: number, cy: number, rx: number, ry: number): Particle[] {
    const gas = GASES[gasType] ?? GASES[1];
    const speed = charSpeed(gas.molarMass, temperature);
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      // place randomly inside ellipse
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.85;
      const px = cx + Math.cos(angle) * rx * r;
      const py = cy + Math.sin(angle) * ry * r;
      const va = Math.random() * Math.PI * 2;
      arr.push({ x: px, y: py, vx: Math.cos(va) * speed, vy: Math.sin(va) * speed });
    }
    return arr;
  }

  function balloonCenter(index: 0 | 1): { cx: number; cy: number } {
    const cx = index === 0 ? width * 0.28 : width * 0.72;
    const cy = height * 0.38;
    return { cx, cy };
  }

  function spawnAll(): void {
    const r1 = balloonRadius(molecules1);
    const r1y = r1 * 0.85;
    const c1 = balloonCenter(0);
    particles1 = createParticles(molecules1, c1.cx, c1.cy, r1, r1y);

    const r2 = balloonRadius(molecules2);
    const r2y = r2 * 0.85;
    const c2 = balloonCenter(1);
    particles2 = createParticles(molecules2, c2.cx, c2.cy, r2, r2y);
  }

  function updateParticles(
    particles: Particle[],
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    dt: number
  ): void {
    const gas = GASES[gasType] ?? GASES[1];
    const speed = charSpeed(gas.molarMass, temperature);

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Bounce off ellipse boundary: check if particle is outside
      const dx = (p.x - cx) / rx;
      const dy = (p.y - cy) / ry;
      const dist2 = dx * dx + dy * dy;

      if (dist2 > 1) {
        // Reflect: compute normal at ellipse surface
        const nx = dx / rx;
        const ny = dy / ry;
        const nLen = Math.sqrt(nx * nx + ny * ny);
        const nnx = nx / nLen;
        const nny = ny / nLen;

        // Reflect velocity
        const dot = p.vx * nnx + p.vy * nny;
        p.vx -= 2 * dot * nnx;
        p.vy -= 2 * dot * nny;

        // Push back inside
        const scale = 1 / Math.sqrt(dist2);
        p.x = cx + (p.x - cx) * scale * 0.98;
        p.y = cy + (p.y - cy) * scale * 0.98;
      }

      // Gently adjust speed toward target to maintain correct energy
      const curSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (curSpeed > 0.01) {
        const targetSpeed = speed * (0.6 + Math.random() * 0.8);
        const blend = 0.02;
        const newSpeed = curSpeed * (1 - blend) + targetSpeed * blend;
        const ratio = newSpeed / curSpeed;
        p.vx *= ratio;
        p.vy *= ratio;
      }
    }
  }

  // ---- Engine methods -------------------------------------------------------

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    spawnAll();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newM1 = Math.round(params.molecules1 ?? molecules1);
    const newM2 = Math.round(params.molecules2 ?? molecules2);
    const newTemp = params.temperature ?? temperature;
    const newGas = Math.round(params.gasType ?? gasType);

    const needRespawn =
      newM1 !== molecules1 ||
      newM2 !== molecules2 ||
      newGas !== gasType;

    molecules1 = newM1;
    molecules2 = newM2;
    temperature = newTemp;
    gasType = Math.max(0, Math.min(3, newGas));

    if (needRespawn) {
      spawnAll();
    }

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    const r1 = balloonRadius(molecules1);
    const r1y = r1 * 0.85;
    const c1 = balloonCenter(0);
    updateParticles(particles1, c1.cx, c1.cy, r1, r1y, dtClamped);

    const r2 = balloonRadius(molecules2);
    const r2y = r2 * 0.85;
    const c2 = balloonCenter(1);
    updateParticles(particles2, c2.cx, c2.cy, r2, r2y, dtClamped);
  }

  function drawBalloon(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    particles: Particle[],
    label: string,
    n: number
  ): void {
    const gas = GASES[gasType] ?? GASES[1];

    // Balloon glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * 1.4);
    glow.addColorStop(0, gas.glowColor);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.4, ry * 1.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Balloon body
    const balloonGrad = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.25, 0, cx, cy, Math.max(rx, ry));
    balloonGrad.addColorStop(0, "rgba(60,70,100,0.7)");
    balloonGrad.addColorStop(0.7, "rgba(30,35,60,0.8)");
    balloonGrad.addColorStop(1, "rgba(20,22,40,0.9)");
    ctx.fillStyle = balloonGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Balloon outline
    ctx.strokeStyle = "rgba(150,160,200,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Highlight
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.15, cy - ry * 0.2, rx * 0.6, ry * 0.35, -0.3, -0.5, 1.2);
    ctx.stroke();

    // String / knot
    const knotY = cy + ry;
    ctx.fillStyle = "rgba(180,180,200,0.8)";
    ctx.beginPath();
    ctx.moveTo(cx - 4, knotY);
    ctx.lineTo(cx + 4, knotY);
    ctx.lineTo(cx, knotY + 8);
    ctx.closePath();
    ctx.fill();

    // Hanging string
    ctx.strokeStyle = "rgba(180,180,200,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, knotY + 8);
    const stringEnd = Math.min(knotY + 80, height - 50);
    // Slight curve
    ctx.bezierCurveTo(cx - 6, knotY + 30, cx + 6, knotY + 55, cx, stringEnd);
    ctx.stroke();

    // Particles
    const pRadius = 3;
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = gas.color;
      ctx.fill();

      // Tiny glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, pRadius + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = gas.glowColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label above balloon
    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy - ry - 20);

    // n label
    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`n = ${n} molecules`, cx, cy - ry - 6);
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const gas = GASES[gasType] ?? GASES[1];

    // Title
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Avogadro's Law: V/n = constant (at constant T, P)", width / 2, 28);

    // Gas type indicator
    ctx.font = "14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = gas.color;
    ctx.fillText(`Gas: ${gas.formula} (${gas.name}, M = ${gas.molarMass} g/mol)`, width / 2, 50);

    // Draw balloons
    const r1 = balloonRadius(molecules1);
    const r1y = r1 * 0.85;
    const c1 = balloonCenter(0);
    drawBalloon(c1.cx, c1.cy, r1, r1y, particles1, "Balloon 1", molecules1);

    const r2 = balloonRadius(molecules2);
    const r2y = r2 * 0.85;
    const c2 = balloonCenter(1);
    drawBalloon(c2.cx, c2.cy, r2, r2y, particles2, "Balloon 2", molecules2);

    // Volume calculations
    // V proportional to n at constant T, P (Avogadro's Law)
    // We use arbitrary volume units proportional to the visual radius cubed
    const V1 = molecules1; // V proportional to n
    const V2 = molecules2;
    const ratio1 = V1 / molecules1;
    const ratio2 = V2 / molecules2;

    // Info panel
    const panelY = height * 0.72;

    ctx.font = "bold 15px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.fillText("Avogadro's Law: V \u221D n  (at constant T, P)", width / 2, panelY);

    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";

    // Show V/n for each balloon
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(
      `Balloon 1: V\u2081 \u221D n\u2081 = ${molecules1}    |    Balloon 2: V\u2082 \u221D n\u2082 = ${molecules2}`,
      width / 2,
      panelY + 22
    );

    // V1/n1 = V2/n2 demonstration
    ctx.fillStyle = "#34d399";
    ctx.fillText(
      `V\u2081/n\u2081 = ${ratio1.toFixed(2)}    =    V\u2082/n\u2082 = ${ratio2.toFixed(2)}    (constant at fixed T, P)`,
      width / 2,
      panelY + 44
    );

    // Temperature
    ctx.fillStyle = "#f472b6";
    ctx.fillText(`T = ${temperature} K`, width / 2, panelY + 66);

    // Molar volume at STP note
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    const molarVol = (R_GAS * temperature) / 101325; // m^3/mol at 1 atm
    ctx.fillText(
      `Molar volume at 1 atm: V_m = RT/P = ${(molarVol * 1000).toFixed(2)} L/mol`,
      width / 2,
      panelY + 88
    );

    // Particle speed note
    const speed = charSpeed(gas.molarMass, temperature);
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      `Particle speed \u221D \u221A(T/M) | heavier molecules move slower`,
      width / 2,
      panelY + 106
    );

    // Equation box
    const eqX = width / 2;
    const eqY = panelY + 130;
    ctx.strokeStyle = "rgba(100,116,139,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(eqX - 160, eqY - 14, 320, 28, 6);
    ctx.stroke();

    ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#c084fc";
    ctx.textAlign = "center";
    ctx.fillText("V\u2081 / n\u2081 = V\u2082 / n\u2082 = V_m = RT / P = const.", eqX, eqY + 4);

    // Time display at bottom-left
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    spawnAll();
  }

  function destroy(): void {
    particles1 = [];
    particles2 = [];
  }

  function getStateDescription(): string {
    const gas = GASES[gasType] ?? GASES[1];
    const molarVol = (R_GAS * temperature) / 101325;
    return (
      `Avogadro's Law simulation: Gas=${gas.formula} (M=${gas.molarMass} g/mol). ` +
      `Balloon 1: n\u2081=${molecules1} molecules. Balloon 2: n\u2082=${molecules2} molecules. ` +
      `T=${temperature} K. At constant T and P, V is proportional to n. ` +
      `Molar volume at 1 atm = ${(molarVol * 1000).toFixed(2)} L/mol. ` +
      `V\u2081/n\u2081 = V\u2082/n\u2082 (Avogadro's Law). ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    spawnAll();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default AvogadrosLawFactory;
