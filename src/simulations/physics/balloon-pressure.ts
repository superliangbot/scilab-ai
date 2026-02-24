import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ---- Gas data ---------------------------------------------------------------
interface GasInfo {
  name: string;
  molarMass: number; // g/mol
  color: string;
  glowColor: string;
}

const GASES: GasInfo[] = [
  { name: "Helium (He)",       molarMass: 4,  color: "#fbbf24", glowColor: "rgba(251,191,36,0.3)" },
  { name: "Air",               molarMass: 29, color: "#94a3b8", glowColor: "rgba(148,163,184,0.3)" },
  { name: "CO\u2082",          molarMass: 44, color: "#9ca3af", glowColor: "rgba(156,163,175,0.3)" },
  { name: "Hydrogen (H\u2082)", molarMass: 2,  color: "#e8e8f0", glowColor: "rgba(232,232,240,0.3)" },
  { name: "Argon (Ar)",        molarMass: 40, color: "#a78bfa", glowColor: "rgba(167,139,250,0.3)" },
];

// ---- Particle type ----------------------------------------------------------
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ---- Physics constants ------------------------------------------------------
const R_GAS = 8.314;        // J/(mol*K)
const g_ACCEL = 9.81;       // m/s^2
const P_ATM = 101325;       // Pa (1 atm)
const M_AIR = 0.029;        // kg/mol (air)
const GAMMA_RUBBER = 0.025; // N/m surface tension of rubber membrane
const M_MEMBRANE = 0.003;   // kg, mass of balloon membrane

// ---- Factory ----------------------------------------------------------------
const BalloonPressureFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("balloon-pressure") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let gasType = 0;
  let temperature = 300;
  let balloonRadius = 25; // cm
  let numParticles = 40;

  // Balloon vertical position (animated)
  let balloonY = 0;
  let balloonVy = 0;

  // Particles inside the balloon
  let particles: Particle[] = [];

  // ---- Physics calculations -------------------------------------------------
  function gasDensity(molarMassKg: number, T: number): number {
    // ideal gas: rho = P * M / (R * T)
    return (P_ATM * molarMassKg) / (R_GAS * T);
  }

  function balloonVolume(radiusCm: number): number {
    const r = radiusCm / 100; // m
    return (4 / 3) * Math.PI * r * r * r;
  }

  function buoyancyForce(T: number, radiusCm: number): number {
    const rhoAir = gasDensity(M_AIR, T);
    const V = balloonVolume(radiusCm);
    return rhoAir * V * g_ACCEL;
  }

  function weightForce(T: number, radiusCm: number): number {
    const gas = GASES[gasType] ?? GASES[0];
    const molarMassKg = gas.molarMass / 1000;
    const rhoGas = gasDensity(molarMassKg, T);
    const V = balloonVolume(radiusCm);
    return (rhoGas * V + M_MEMBRANE) * g_ACCEL;
  }

  function internalPressureExcess(radiusCm: number): number {
    // Young-Laplace: dP = 2*gamma/r
    const r = radiusCm / 100;
    return (2 * GAMMA_RUBBER) / r;
  }

  function netForce(T: number, radiusCm: number): number {
    return buoyancyForce(T, radiusCm) - weightForce(T, radiusCm);
  }

  // ---- Particle helpers -----------------------------------------------------
  function charSpeed(): number {
    const gas = GASES[gasType] ?? GASES[0];
    return 100 * Math.sqrt(temperature / (gas.molarMass * 50));
  }

  function createParticles(cx: number, cy: number, rx: number, ry: number): Particle[] {
    const speed = charSpeed();
    const arr: Particle[] = [];
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.85;
      const px = cx + Math.cos(angle) * rx * r;
      const py = cy + Math.sin(angle) * ry * r;
      const va = Math.random() * Math.PI * 2;
      arr.push({ x: px, y: py, vx: Math.cos(va) * speed, vy: Math.sin(va) * speed });
    }
    return arr;
  }

  function updateParticlesPhysics(
    cx: number, cy: number, rx: number, ry: number, dt: number
  ): void {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Bounce off ellipse boundary
      const dx = (p.x - cx) / rx;
      const dy = (p.y - cy) / ry;
      const dist2 = dx * dx + dy * dy;
      if (dist2 > 1) {
        const nx = dx / rx;
        const ny = dy / ry;
        const nLen = Math.sqrt(nx * nx + ny * ny);
        const nnx = nx / nLen;
        const nny = ny / nLen;
        const dot = p.vx * nnx + p.vy * nny;
        p.vx -= 2 * dot * nnx;
        p.vy -= 2 * dot * nny;
        const scale = 1 / Math.sqrt(dist2);
        p.x = cx + (p.x - cx) * scale * 0.98;
        p.y = cy + (p.y - cy) * scale * 0.98;
      }

      // Gently adjust speed
      const curSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const targetSpeed = charSpeed() * (0.6 + Math.random() * 0.8);
      if (curSpeed > 0.01) {
        const blend = 0.02;
        const newSpeed = curSpeed * (1 - blend) + targetSpeed * blend;
        const ratio = newSpeed / curSpeed;
        p.vx *= ratio;
        p.vy *= ratio;
      }
    }
  }

  // ---- Rendering helpers ----------------------------------------------------
  function drawSkyGround(): void {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, "#0a0a1a");
    skyGrad.addColorStop(0.6, "#10102a");
    skyGrad.addColorStop(0.85, "#1a1a3a");
    skyGrad.addColorStop(1, "#1e3a1e");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground plane
    const groundY = height * 0.88;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    groundGrad.addColorStop(0, "#1a3a1e");
    groundGrad.addColorStop(0.3, "#15301a");
    groundGrad.addColorStop(1, "#0d200f");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Ground line
    ctx.strokeStyle = "rgba(60,120,60,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Small grass tufts
    ctx.strokeStyle = "rgba(60,140,60,0.4)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const gx = (i / 30) * width + Math.sin(i * 7) * 15;
      const gy = groundY;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 2, gy - 5 - Math.abs(Math.sin(i * 3)) * 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 2, gy - 4 - Math.abs(Math.cos(i * 5)) * 4);
      ctx.stroke();
    }
  }

  function drawForceArrow(
    x: number, y: number, length: number, color: string, label: string, direction: "up" | "down"
  ): void {
    const sign = direction === "up" ? -1 : 1;
    const endY = y + sign * length;
    const arrowSize = 8;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, endY);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, endY + sign * arrowSize);
    ctx.lineTo(x - arrowSize * 0.6, endY);
    ctx.lineTo(x + arrowSize * 0.6, endY);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(label, x, endY + sign * (arrowSize + 14));
  }

  // ---- Engine methods -------------------------------------------------------

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    balloonY = height * 0.45;
    balloonVy = 0;
    const rx = Math.min(width, height) * 0.14;
    const ry = rx * 0.9;
    particles = createParticles(width / 2, balloonY, rx, ry);
  }

  function update(dt: number, params: Record<string, number>): void {
    const newGas = Math.round(params.gasType ?? gasType);
    const newTemp = params.temperature ?? temperature;
    const newRadius = params.balloonRadius ?? balloonRadius;
    const newNum = Math.round(params.numParticles ?? numParticles);

    const gasChanged = newGas !== gasType;
    const numChanged = newNum !== numParticles;

    gasType = Math.max(0, Math.min(4, newGas));
    temperature = newTemp;
    balloonRadius = newRadius;
    numParticles = newNum;

    if (gasChanged || numChanged) {
      const rx = Math.min(width, height) * (0.06 + balloonRadius * 0.004);
      const ry = rx * 0.9;
      particles = createParticles(width / 2, balloonY, rx, ry);
    }

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // Balloon motion based on net force
    const Fnet = netForce(temperature, balloonRadius);
    // Mass of gas + membrane
    const gas = GASES[gasType] ?? GASES[0];
    const molarMassKg = gas.molarMass / 1000;
    const rhoGas = gasDensity(molarMassKg, temperature);
    const V = balloonVolume(balloonRadius);
    const totalMass = rhoGas * V + M_MEMBRANE;

    const accel = Fnet / totalMass; // m/s^2
    // Convert to pixel acceleration (scale factor)
    const pixelAccel = accel * 15; // scale for visual effect

    balloonVy -= pixelAccel * dtClamped; // positive y is down on screen
    balloonVy *= 0.995; // slight damping

    balloonY += balloonVy * dtClamped * 60;

    // Clamp balloon position
    const groundY = height * 0.88;
    const rx = Math.min(width, height) * (0.06 + balloonRadius * 0.004);
    const ry = rx * 0.9;
    const topLimit = ry + 60;
    const bottomLimit = groundY - ry - 10;

    if (balloonY < topLimit) {
      balloonY = topLimit;
      balloonVy = Math.max(balloonVy, 0);
    }
    if (balloonY > bottomLimit) {
      balloonY = bottomLimit;
      balloonVy = Math.min(balloonVy, 0);
    }

    // Update particles relative to balloon center
    const cx = width / 2;
    updateParticlesPhysics(cx, balloonY, rx, ry, dtClamped);
  }

  function render(): void {
    drawSkyGround();

    const gas = GASES[gasType] ?? GASES[0];
    const cx = width / 2;
    const cy = balloonY;
    const rx = Math.min(width, height) * (0.06 + balloonRadius * 0.004);
    const ry = rx * 0.9;

    // Title
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Balloon Pressure & Buoyancy", width / 2, 28);

    // Gas info
    ctx.font = "14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = gas.color;
    ctx.fillText(`Gas: ${gas.name}  (M = ${gas.molarMass} g/mol)`, width / 2, 50);

    // Balloon glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * 1.5);
    glow.addColorStop(0, gas.glowColor);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.5, ry * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Balloon body
    const balloonGrad = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.2, 0, cx, cy, Math.max(rx, ry));
    balloonGrad.addColorStop(0, "rgba(70,80,120,0.6)");
    balloonGrad.addColorStop(0.7, "rgba(40,45,80,0.75)");
    balloonGrad.addColorStop(1, "rgba(25,28,50,0.85)");
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

    // Highlight arc
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.15, cy - ry * 0.2, rx * 0.5, ry * 0.3, -0.3, -0.5, 1.0);
    ctx.stroke();

    // Particles inside
    const pRadius = 2.5;
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = gas.color;
      ctx.fill();
    }

    // Knot
    const knotY = cy + ry;
    ctx.fillStyle = "rgba(180,180,200,0.8)";
    ctx.beginPath();
    ctx.moveTo(cx - 4, knotY);
    ctx.lineTo(cx + 4, knotY);
    ctx.lineTo(cx, knotY + 8);
    ctx.closePath();
    ctx.fill();

    // String
    ctx.strokeStyle = "rgba(180,180,200,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, knotY + 8);
    const groundY = height * 0.88;
    ctx.bezierCurveTo(cx - 5, knotY + 30, cx + 5, groundY - 30, cx, groundY);
    ctx.stroke();

    // Force arrows
    const Fb = buoyancyForce(temperature, balloonRadius);
    const Fw = weightForce(temperature, balloonRadius);
    const Fnet = Fb - Fw;

    const maxArrow = 80;
    const forceScale = maxArrow / Math.max(Fb, Fw, 0.001);

    // Buoyancy arrow (green, up)
    const buoyLen = Math.min(Fb * forceScale, maxArrow);
    drawForceArrow(cx - rx - 30, cy, buoyLen, "#22c55e", `F_b = ${Fb.toFixed(4)} N`, "up");

    // Weight arrow (red, down)
    const weightLen = Math.min(Fw * forceScale, maxArrow);
    drawForceArrow(cx + rx + 30, cy, weightLen, "#ef4444", `F_w = ${Fw.toFixed(4)} N`, "down");

    // Net force indicator
    const netColor = Fnet > 0 ? "#22c55e" : "#ef4444";
    const netDir: "up" | "down" = Fnet > 0 ? "up" : "down";
    const netLen = Math.min(Math.abs(Fnet) * forceScale * 2, maxArrow);
    if (netLen > 3) {
      drawForceArrow(cx, cy, netLen, netColor, `F_net = ${Fnet.toFixed(4)} N`, netDir);
    }

    // Physics panel
    const panelX = 16;
    const panelY = height * 0.60;
    const lineH = 18;

    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.fillText("Forces & Pressure", panelX, panelY);

    ctx.font = "12px 'Inter', system-ui, sans-serif";
    let row = 0;

    const molarMassKg = gas.molarMass / 1000;
    const rhoGas = gasDensity(molarMassKg, temperature);
    const rhoAir = gasDensity(M_AIR, temperature);
    const V = balloonVolume(balloonRadius);
    const dP = internalPressureExcess(balloonRadius);

    row++;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`\u03C1_air = PM_air/(RT) = ${rhoAir.toFixed(4)} kg/m\u00B3`, panelX, panelY + lineH * row);

    row++;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`\u03C1_gas = PM_gas/(RT) = ${rhoGas.toFixed(4)} kg/m\u00B3`, panelX, panelY + lineH * row);

    row++;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`V = (4/3)\u03C0r\u00B3 = ${(V * 1e6).toFixed(2)} cm\u00B3  (r = ${balloonRadius} cm)`, panelX, panelY + lineH * row);

    row++;
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`Buoyancy = \u03C1_air \u00D7 V \u00D7 g = ${Fb.toFixed(4)} N`, panelX, panelY + lineH * row);

    row++;
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Weight = (\u03C1_gas \u00D7 V + m_membrane) \u00D7 g = ${Fw.toFixed(4)} N`, panelX, panelY + lineH * row);

    row++;
    ctx.fillStyle = netColor;
    ctx.fillText(
      `Net force = ${Fnet.toFixed(4)} N  \u2192  ${Fnet > 0 ? "RISES (buoyant)" : "SINKS (heavy)"}`,
      panelX,
      panelY + lineH * row
    );

    row++;
    ctx.fillStyle = "#c084fc";
    ctx.fillText(
      `Young-Laplace: \u0394P = 2\u03B3/r = ${dP.toFixed(2)} Pa  (internal pressure excess)`,
      panelX,
      panelY + lineH * row
    );

    // Right-side equation box
    const eqX = width - 16;
    ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#c084fc";
    ctx.textAlign = "right";
    ctx.fillText("\u0394P = 2\u03B3 / r", eqX, panelY);

    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("F_buoyancy = \u03C1_air \u00D7 V \u00D7 g", eqX, panelY + lineH);
    ctx.fillText("F_weight = (\u03C1_gas \u00D7 V + m) \u00D7 g", eqX, panelY + lineH * 2);
    ctx.fillText("\u03C1 = PM / (RT)  (ideal gas)", eqX, panelY + lineH * 3);

    // Status label
    ctx.font = "bold 15px 'Inter', system-ui, sans-serif";
    const statusColor = Fnet > 0 ? "#22c55e" : "#ef4444";
    const statusText = Fnet > 0 ? "\u2191 Balloon rises (lighter than air)" : "\u2193 Balloon sinks (heavier than air)";
    ctx.fillStyle = statusColor;
    ctx.textAlign = "center";
    ctx.fillText(statusText, width / 2, height * 0.55);

    // Time display at bottom-left
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    balloonY = height * 0.45;
    balloonVy = 0;
    const rx = Math.min(width, height) * (0.06 + balloonRadius * 0.004);
    const ry = rx * 0.9;
    particles = createParticles(width / 2, balloonY, rx, ry);
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const gas = GASES[gasType] ?? GASES[0];
    const Fb = buoyancyForce(temperature, balloonRadius);
    const Fw = weightForce(temperature, balloonRadius);
    const Fnet = Fb - Fw;
    const dP = internalPressureExcess(balloonRadius);
    return (
      `Balloon Pressure simulation: Gas=${gas.name} (M=${gas.molarMass} g/mol). ` +
      `T=${temperature} K, r=${balloonRadius} cm. ` +
      `Buoyancy=${Fb.toFixed(4)} N, Weight=${Fw.toFixed(4)} N, Net=${Fnet.toFixed(4)} N. ` +
      `Balloon ${Fnet > 0 ? "rises" : "sinks"}. ` +
      `Young-Laplace excess pressure \u0394P=${dP.toFixed(2)} Pa. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    const rx = Math.min(width, height) * (0.06 + balloonRadius * 0.004);
    const ry = rx * 0.9;
    particles = createParticles(width / 2, balloonY, rx, ry);
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default BalloonPressureFactory;
