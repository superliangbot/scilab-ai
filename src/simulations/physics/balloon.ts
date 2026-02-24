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
  { name: "Hydrogen",      formula: "H\u2082", molarMass: 2,  color: "#e8e8f0", glowColor: "rgba(232,232,240,0.25)" },
  { name: "Helium",        formula: "He",       molarMass: 4,  color: "#fbbf24", glowColor: "rgba(251,191,36,0.25)" },
  { name: "Nitrogen",      formula: "N\u2082",  molarMass: 28, color: "#60a5fa", glowColor: "rgba(96,165,250,0.25)" },
  { name: "Air",           formula: "Air",      molarMass: 29, color: "#94a3b8", glowColor: "rgba(148,163,184,0.25)" },
  { name: "Oxygen",        formula: "O\u2082",  molarMass: 32, color: "#f87171", glowColor: "rgba(248,113,113,0.25)" },
  { name: "Argon",         formula: "Ar",       molarMass: 40, color: "#a78bfa", glowColor: "rgba(167,139,250,0.25)" },
  { name: "Carbon Dioxide", formula: "CO\u2082", molarMass: 44, color: "#9ca3af", glowColor: "rgba(156,163,175,0.25)" },
];

// ---- Particle type ----------------------------------------------------------
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ---- Atmosphere particle (outside balloon) ----------------------------------
interface AtmParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ---- Physics constants ------------------------------------------------------
const R_GAS = 8.314;       // J/(mol*K)
const g_ACCEL = 9.81;      // m/s^2
const P_ATM = 101325;      // Pa
const M_AIR = 0.029;       // kg/mol (air molar mass)
const M_MEMBRANE = 0.003;  // kg, balloon membrane mass

// ---- Factory ----------------------------------------------------------------
const BalloonFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("balloon") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let gasType = 1; // default: Helium
  let temperature = 300;
  let balloonRadius = 25; // cm
  let numParticles = 40;

  // Balloon vertical position (animated)
  let balloonY = 0;
  let balloonVy = 0;

  // Particles inside the balloon
  let gasParticles: Particle[] = [];

  // Atmosphere particles outside
  let atmParticles: AtmParticle[] = [];

  // ---- Physics calculations -------------------------------------------------
  function gasDensity(molarMassKg: number, T: number): number {
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
    const gas = GASES[gasType] ?? GASES[1];
    const molarMassKg = gas.molarMass / 1000;
    const rhoGas = gasDensity(molarMassKg, T);
    const V = balloonVolume(radiusCm);
    return (rhoGas * V + M_MEMBRANE) * g_ACCEL;
  }

  function netForce(T: number, radiusCm: number): number {
    return buoyancyForce(T, radiusCm) - weightForce(T, radiusCm);
  }

  // ---- Particle speed based on temperature and molar mass -------------------
  function charSpeed(molarMass: number): number {
    // v_rms proportional to sqrt(T/M)
    return 80 * Math.sqrt(temperature / (molarMass * 30));
  }

  // ---- Balloon rendering parameters ----------------------------------------
  function getBalloonRx(): number {
    return Math.min(width, height) * (0.06 + balloonRadius * 0.004);
  }

  function getBalloonRy(): number {
    return getBalloonRx() * 0.85;
  }

  // ---- Particle creation & update -------------------------------------------
  function createGasParticles(cx: number, cy: number, rx: number, ry: number): Particle[] {
    const gas = GASES[gasType] ?? GASES[1];
    const speed = charSpeed(gas.molarMass);
    const arr: Particle[] = [];
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.82;
      const px = cx + Math.cos(angle) * rx * r;
      const py = cy + Math.sin(angle) * ry * r;
      const va = Math.random() * Math.PI * 2;
      arr.push({ x: px, y: py, vx: Math.cos(va) * speed, vy: Math.sin(va) * speed });
    }
    return arr;
  }

  function createAtmParticles(): AtmParticle[] {
    const arr: AtmParticle[] = [];
    const count = Math.floor(numParticles * 0.6);
    const airSpeed = charSpeed(29); // air molar mass = 29
    for (let i = 0; i < count; i++) {
      const px = Math.random() * width;
      const py = Math.random() * height;
      const va = Math.random() * Math.PI * 2;
      arr.push({ x: px, y: py, vx: Math.cos(va) * airSpeed * 0.5, vy: Math.sin(va) * airSpeed * 0.5 });
    }
    return arr;
  }

  function updateGasParticles(cx: number, cy: number, rx: number, ry: number, dt: number): void {
    const gas = GASES[gasType] ?? GASES[1];
    const targetSpeed = charSpeed(gas.molarMass);
    for (const p of gasParticles) {
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
        p.x = cx + (p.x - cx) * scale * 0.97;
        p.y = cy + (p.y - cy) * scale * 0.97;
      }

      // Gently adjust speed toward target
      const curSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (curSpeed > 0.01) {
        const blend = 0.02;
        const desired = targetSpeed * (0.6 + Math.random() * 0.8);
        const newSpeed = curSpeed * (1 - blend) + desired * blend;
        const ratio = newSpeed / curSpeed;
        p.vx *= ratio;
        p.vy *= ratio;
      }
    }
  }

  function updateAtmParticles(dt: number, cx: number, cy: number, rx: number, ry: number): void {
    const airSpeed = charSpeed(29) * 0.5;
    for (const p of atmParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap around screen edges
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      if (p.y > height + 10) p.y = -10;

      // Bounce off balloon (stay outside)
      const dx = (p.x - cx) / (rx + 6);
      const dy = (p.y - cy) / (ry + 6);
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 1 && dist2 > 0.01) {
        const scale = 1 / Math.sqrt(dist2);
        p.x = cx + (p.x - cx) * scale * 1.05;
        p.y = cy + (p.y - cy) * scale * 1.05;
        // Reflect velocity
        const nx = dx;
        const ny = dy;
        const nLen = Math.sqrt(nx * nx + ny * ny);
        if (nLen > 0) {
          const nnx = nx / nLen;
          const nny = ny / nLen;
          const dot = p.vx * nnx + p.vy * nny;
          if (dot < 0) {
            p.vx -= 2 * dot * nnx;
            p.vy -= 2 * dot * nny;
          }
        }
      }

      // Gentle speed adjustment
      const curSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (curSpeed > 0.01) {
        const blend = 0.01;
        const desired = airSpeed * (0.6 + Math.random() * 0.8);
        const newSpeed = curSpeed * (1 - blend) + desired * blend;
        const ratio = newSpeed / curSpeed;
        p.vx *= ratio;
        p.vy *= ratio;
      }
    }
  }

  // ---- Drawing helpers ------------------------------------------------------
  function drawSkyGround(): void {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, "#0a0a1a");
    skyGrad.addColorStop(0.55, "#10102a");
    skyGrad.addColorStop(0.85, "#1a1a3a");
    skyGrad.addColorStop(1, "#1e3a1e");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground
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
    if (length < 2) return;
    const sign = direction === "up" ? -1 : 1;
    const endY = y + sign * length;
    const arrowSize = 8;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, endY);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, endY + sign * arrowSize);
    ctx.lineTo(x - arrowSize * 0.6, endY);
    ctx.lineTo(x + arrowSize * 0.6, endY);
    ctx.closePath();
    ctx.fill();

    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = direction === "up" ? "bottom" : "top";
    ctx.fillText(label, x, endY + sign * (arrowSize + 4));
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
    const rx = getBalloonRx();
    const ry = getBalloonRy();
    gasParticles = createGasParticles(width / 2, balloonY, rx, ry);
    atmParticles = createAtmParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newGas = Math.max(0, Math.min(6, Math.round(params.gasType ?? gasType)));
    const newTemp = params.temperature ?? temperature;
    const newRadius = params.balloonRadius ?? balloonRadius;
    const newNum = Math.round(params.numParticles ?? numParticles);

    const gasChanged = newGas !== gasType;
    const numChanged = newNum !== numParticles;
    const radiusChanged = Math.abs(newRadius - balloonRadius) > 0.5;

    gasType = newGas;
    temperature = newTemp;
    balloonRadius = newRadius;
    numParticles = newNum;

    if (gasChanged || numChanged || radiusChanged) {
      const rx = getBalloonRx();
      const ry = getBalloonRy();
      gasParticles = createGasParticles(width / 2, balloonY, rx, ry);
    }

    if (numChanged) {
      atmParticles = createAtmParticles();
    }

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // Balloon physics: net force -> acceleration -> motion
    const Fnet = netForce(temperature, balloonRadius);
    const gas = GASES[gasType] ?? GASES[1];
    const molarMassKg = gas.molarMass / 1000;
    const rhoGas = gasDensity(molarMassKg, temperature);
    const V = balloonVolume(balloonRadius);
    const totalMass = Math.max(rhoGas * V + M_MEMBRANE, 0.0001);

    const accel = Fnet / totalMass; // m/s^2
    const pixelAccel = accel * 15; // visual scaling

    balloonVy -= pixelAccel * dtClamped; // screen y is inverted
    balloonVy *= 0.995; // damping

    balloonY += balloonVy * dtClamped * 60;

    // Clamp balloon position
    const groundY = height * 0.88;
    const rx = getBalloonRx();
    const ry = getBalloonRy();
    const topLimit = ry + 50;
    const bottomLimit = groundY - ry - 10;

    if (balloonY < topLimit) {
      balloonY = topLimit;
      balloonVy = Math.max(balloonVy, 0);
    }
    if (balloonY > bottomLimit) {
      balloonY = bottomLimit;
      balloonVy = Math.min(balloonVy, 0);
    }

    // Update particles
    const cx = width / 2;
    updateGasParticles(cx, balloonY, rx, ry, dtClamped);
    updateAtmParticles(dtClamped, cx, balloonY, rx, ry);
  }

  function render(): void {
    drawSkyGround();

    const gas = GASES[gasType] ?? GASES[1];
    const cx = width / 2;
    const cy = balloonY;
    const rx = getBalloonRx();
    const ry = getBalloonRy();

    // Title
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Balloon Buoyancy", cx, 14);

    // Gas info
    ctx.font = "14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = gas.color;
    ctx.fillText(
      `Gas: ${gas.name} (${gas.formula})  |  M = ${gas.molarMass} g/mol`,
      cx, 38
    );

    // Atmosphere particles (drawn behind balloon)
    for (const p of atmParticles) {
      // Skip particles that would overlap the balloon body
      const dx = (p.x - cx) / (rx + 4);
      const dy = (p.y - cy) / (ry + 4);
      if (dx * dx + dy * dy < 1) continue;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
      ctx.fill();
    }

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
    balloonGrad.addColorStop(0, "rgba(70,80,120,0.55)");
    balloonGrad.addColorStop(0.7, "rgba(40,45,80,0.7)");
    balloonGrad.addColorStop(1, "rgba(25,28,50,0.8)");
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
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.15, cy - ry * 0.2, rx * 0.5, ry * 0.3, -0.3, -0.5, 1.0);
    ctx.stroke();

    // Gas particles inside balloon
    const pRadius = 2.5;
    for (const p of gasParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = gas.color;
      ctx.fill();
    }

    // Knot at bottom of balloon
    const knotY = cy + ry;
    ctx.fillStyle = "rgba(180,180,200,0.8)";
    ctx.beginPath();
    ctx.moveTo(cx - 4, knotY);
    ctx.lineTo(cx + 4, knotY);
    ctx.lineTo(cx, knotY + 8);
    ctx.closePath();
    ctx.fill();

    // String
    const groundY = height * 0.88;
    ctx.strokeStyle = "rgba(180,180,200,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, knotY + 8);
    ctx.bezierCurveTo(cx - 5, knotY + 30, cx + 5, groundY - 30, cx, groundY);
    ctx.stroke();

    // Force arrows
    const Fb = buoyancyForce(temperature, balloonRadius);
    const Fw = weightForce(temperature, balloonRadius);
    const Fnet_val = Fb - Fw;

    const maxArrow = 80;
    const forceScale = maxArrow / Math.max(Fb, Fw, 0.001);

    // Buoyancy arrow (green, up)
    const buoyLen = Math.min(Fb * forceScale, maxArrow);
    drawForceArrow(cx - rx - 30, cy, buoyLen, "#22c55e", `F_b = ${Fb.toFixed(4)} N`, "up");

    // Weight arrow (red, down)
    const weightLen = Math.min(Fw * forceScale, maxArrow);
    drawForceArrow(cx + rx + 30, cy, weightLen, "#ef4444", `W = ${Fw.toFixed(4)} N`, "down");

    // Net force arrow
    const netColor = Fnet_val > 0 ? "#22c55e" : "#ef4444";
    const netDir: "up" | "down" = Fnet_val > 0 ? "up" : "down";
    const netLen = Math.min(Math.abs(Fnet_val) * forceScale * 2, maxArrow);
    if (netLen > 3) {
      drawForceArrow(cx, cy, netLen, netColor, `F_net = ${Fnet_val.toFixed(4)} N`, netDir);
    }

    // Status
    ctx.font = "bold 15px 'Inter', system-ui, sans-serif";
    const statusColor = Fnet_val > 0 ? "#22c55e" : "#ef4444";
    const statusText = Fnet_val > 0
      ? "\u2191 Balloon rises (buoyant)"
      : "\u2193 Balloon sinks (heavy)";
    ctx.fillStyle = statusColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(statusText, cx, height * 0.55);

    // Info panel
    renderInfoPanel(Fb, Fw, Fnet_val);

    // Time
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 10);
  }

  function renderInfoPanel(Fb: number, Fw: number, Fnet_val: number): void {
    const gas = GASES[gasType] ?? GASES[1];
    const molarMassKg = gas.molarMass / 1000;
    const rhoGas = gasDensity(molarMassKg, temperature);
    const rhoAir = gasDensity(M_AIR, temperature);
    const V = balloonVolume(balloonRadius);

    const panelX = 14;
    const panelY = height * 0.60;
    const lineH = 17;

    ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Forces & Densities", panelX, panelY);

    ctx.font = "12px 'Inter', system-ui, sans-serif";
    let row = 1;

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `\u03C1_air = PM/(RT) = ${rhoAir.toFixed(4)} kg/m\u00B3`,
      panelX, panelY + lineH * row
    );
    row++;

    ctx.fillStyle = gas.color;
    ctx.fillText(
      `\u03C1_gas = PM/(RT) = ${rhoGas.toFixed(4)} kg/m\u00B3  (M=${gas.molarMass} g/mol)`,
      panelX, panelY + lineH * row
    );
    row++;

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `V = (4/3)\u03C0r\u00B3 = ${(V * 1e6).toFixed(1)} cm\u00B3  (r = ${balloonRadius} cm)`,
      panelX, panelY + lineH * row
    );
    row++;

    ctx.fillStyle = "#22c55e";
    ctx.fillText(
      `F_b = \u03C1_air \u00D7 V \u00D7 g = ${Fb.toFixed(4)} N`,
      panelX, panelY + lineH * row
    );
    row++;

    ctx.fillStyle = "#ef4444";
    ctx.fillText(
      `W = (\u03C1_gas \u00D7 V + m_membrane) \u00D7 g = ${Fw.toFixed(4)} N`,
      panelX, panelY + lineH * row
    );
    row++;

    const netColor = Fnet_val > 0 ? "#22c55e" : "#ef4444";
    ctx.fillStyle = netColor;
    ctx.fillText(
      `F_net = ${Fnet_val.toFixed(4)} N  \u2192  ${Fnet_val > 0 ? "RISES" : "SINKS"}`,
      panelX, panelY + lineH * row
    );

    // Right-side equation summary
    const eqX = width - 14;
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#c084fc";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("F_b = \u03C1_air \u00D7 V \u00D7 g", eqX, panelY);

    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("W = (\u03C1_gas \u00D7 V + m) \u00D7 g", eqX, panelY + lineH);
    ctx.fillText("\u03C1 = PM / (RT)  (ideal gas)", eqX, panelY + lineH * 2);
    ctx.fillText(`T = ${temperature} K`, eqX, panelY + lineH * 3);
  }

  function reset(): void {
    time = 0;
    balloonY = height * 0.45;
    balloonVy = 0;
    const rx = getBalloonRx();
    const ry = getBalloonRy();
    gasParticles = createGasParticles(width / 2, balloonY, rx, ry);
    atmParticles = createAtmParticles();
  }

  function destroy(): void {
    gasParticles = [];
    atmParticles = [];
  }

  function getStateDescription(): string {
    const gas = GASES[gasType] ?? GASES[1];
    const Fb = buoyancyForce(temperature, balloonRadius);
    const Fw = weightForce(temperature, balloonRadius);
    const Fnet_val = Fb - Fw;
    const molarMassKg = gas.molarMass / 1000;
    const rhoGas = gasDensity(molarMassKg, temperature);
    const rhoAir = gasDensity(M_AIR, temperature);
    return (
      `Balloon Buoyancy: Gas=${gas.name} (${gas.formula}, M=${gas.molarMass} g/mol). ` +
      `T=${temperature} K, r=${balloonRadius} cm. ` +
      `\u03C1_air=${rhoAir.toFixed(4)} kg/m\u00B3, \u03C1_gas=${rhoGas.toFixed(4)} kg/m\u00B3. ` +
      `Buoyancy=${Fb.toFixed(4)} N, Weight=${Fw.toFixed(4)} N, Net=${Fnet_val.toFixed(4)} N. ` +
      `Balloon ${Fnet_val > 0 ? "rises" : "sinks"}. ` +
      `Gas options: H\u2082(2), He(4), N\u2082(28), Air(29), O\u2082(32), Ar(40), CO\u2082(44). ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    const rx = getBalloonRx();
    const ry = getBalloonRy();
    gasParticles = createGasParticles(width / 2, balloonY, rx, ry);
    atmParticles = createAtmParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default BalloonFactory;
