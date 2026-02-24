import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface BuoyObject {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  mass: number; // grams
  volume: number; // cm^3
  density: number; // g/cm^3
  sideLen: number; // visual side length px
  color: string;
  label: string;
}

const FLUID_DENSITY = 1.0; // water: 1 g/cm^3
const g = 9.81; // m/s^2

const BuoyancyComparisonFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("buoyancy-comparison") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let mass1 = 800; // g
  let volume1 = 1000; // cm^3
  let mass2 = 1500; // g
  let volume2 = 1000; // cm^3

  // Objects
  let obj1: BuoyObject;
  let obj2: BuoyObject;

  // Wave animation
  let wavePhase = 0;

  // Container geometry fractions
  const TANK_LEFT_FRAC = 0.06;
  const TANK_RIGHT_FRAC = 0.62;
  const WATER_SURFACE_FRAC = 0.32;
  const TANK_BOTTOM_FRAC = 0.82;
  const BASE_SIDE = 55;

  function tankLeft(): number { return width * TANK_LEFT_FRAC; }
  function tankRight(): number { return width * TANK_RIGHT_FRAC; }
  function waterSurfaceY(): number { return height * WATER_SURFACE_FRAC; }
  function tankBottom(): number { return height * TANK_BOTTOM_FRAC; }

  function computeEquilibriumY(obj: BuoyObject): number {
    const wY = waterSurfaceY();
    const bottom = tankBottom();
    const side = obj.sideLen;
    const rho = obj.density;

    if (rho <= FLUID_DENSITY) {
      // Floats: fraction submerged = rho_obj / rho_fluid
      const fracSub = rho / FLUID_DENSITY;
      // Center Y: water surface + (fracSub - 0.5) * side
      return wY + (fracSub - 0.5) * side;
    } else {
      // Sinks to bottom
      return bottom - side / 2;
    }
  }

  function createObjects(): void {
    const tLeft = tankLeft();
    const tRight = tankRight();
    const tankW = tRight - tLeft;

    const density1 = mass1 / volume1; // g/cm^3
    const density2 = mass2 / volume2;

    obj1 = {
      x: tLeft + tankW * 0.3,
      y: waterSurfaceY() - BASE_SIDE,
      vy: 0,
      targetY: 0,
      mass: mass1,
      volume: volume1,
      density: density1,
      sideLen: BASE_SIDE,
      color: "#3b82f6",
      label: "Object 1",
    };

    obj2 = {
      x: tLeft + tankW * 0.7,
      y: waterSurfaceY() - BASE_SIDE,
      vy: 0,
      targetY: 0,
      mass: mass2,
      volume: volume2,
      density: density2,
      sideLen: BASE_SIDE,
      color: "#ef4444",
      label: "Object 2",
    };

    obj1.targetY = computeEquilibriumY(obj1);
    obj2.targetY = computeEquilibriumY(obj2);
  }

  function drawArrow(
    x1: number, y1: number, x2: number, y2: number,
    color: string, label: string
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 3) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    const headLen = 9;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = dy > 0 ? "right" : "left";
    const offX = dy > 0 ? -8 : 8;
    ctx.fillText(label, (x1 + x2) / 2 + offX, (y1 + y2) / 2);
    ctx.restore();
  }

  function drawForces(obj: BuoyObject): void {
    const half = obj.sideLen / 2;
    const wY = waterSurfaceY();

    // Weight (gravity) force
    const weightForce = obj.mass * g / 1000; // in N (mass in g -> kg)

    // Submerged fraction
    let fracSub = 0;
    if (obj.y + half > wY) {
      fracSub = Math.min(1, (obj.y + half - wY) / obj.sideLen);
    }

    // Buoyancy force: rho_fluid * V_submerged * g
    // V_submerged = fracSub * volume in cm^3 -> m^3 (1e-6)
    const buoyancyForce = FLUID_DENSITY * 1000 * (fracSub * obj.volume * 1e-6) * g;

    // Scale for display
    const maxForce = Math.max(weightForce, buoyancyForce, 0.1);
    const arrowScale = (height * 0.12) / maxForce;

    // Weight arrow (blue, down)
    const wLen = weightForce * arrowScale;
    drawArrow(
      obj.x - half * 0.4, obj.y,
      obj.x - half * 0.4, obj.y + wLen,
      "rgba(96, 165, 250, 0.9)", "W"
    );

    // Buoyancy arrow (green, up)
    if (fracSub > 0) {
      const bLen = buoyancyForce * arrowScale;
      drawArrow(
        obj.x + half * 0.4, obj.y,
        obj.x + half * 0.4, obj.y - bLen,
        "rgba(74, 222, 128, 0.9)", "F_b"
      );
    }

    // Net force arrow (red)
    const netForce = buoyancyForce - weightForce;
    const netLen = Math.abs(netForce) * arrowScale;
    if (netLen > 3) {
      const dir = netForce > 0 ? -1 : 1;
      drawArrow(
        obj.x, obj.y,
        obj.x, obj.y + dir * netLen,
        "rgba(248, 113, 113, 0.8)", "Net"
      );
    }
  }

  function drawObject(obj: BuoyObject): void {
    const half = obj.sideLen / 2;
    const x = obj.x - half;
    const y = obj.y - half;
    const wY = waterSurfaceY();

    const rr = parseInt(obj.color.slice(1, 3), 16);
    const gg = parseInt(obj.color.slice(3, 5), 16);
    const bb = parseInt(obj.color.slice(5, 7), 16);

    // Glow
    const glow = ctx.createRadialGradient(obj.x, obj.y, half * 0.3, obj.x, obj.y, half * 2.5);
    glow.addColorStop(0, `rgba(${rr}, ${gg}, ${bb}, 0.15)`);
    glow.addColorStop(1, `rgba(${rr}, ${gg}, ${bb}, 0)`);
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, half * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Body
    const bodyGrad = ctx.createLinearGradient(x, y, x + obj.sideLen, y + obj.sideLen);
    bodyGrad.addColorStop(0, `rgba(${Math.min(255, rr + 50)}, ${Math.min(255, gg + 50)}, ${Math.min(255, bb + 50)}, 0.9)`);
    bodyGrad.addColorStop(0.5, `rgba(${rr}, ${gg}, ${bb}, 0.9)`);
    bodyGrad.addColorStop(1, `rgba(${Math.max(0, rr - 40)}, ${Math.max(0, gg - 40)}, ${Math.max(0, bb - 40)}, 0.9)`);

    ctx.beginPath();
    ctx.roundRect(x, y, obj.sideLen, obj.sideLen, 5);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Underwater tint
    if (obj.y + half > wY) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, Math.max(wY, y), obj.sideLen, obj.y + half - Math.max(wY, y));
      ctx.clip();
      ctx.fillStyle = "rgba(20, 80, 180, 0.2)";
      ctx.fillRect(x, Math.max(wY, y), obj.sideLen, obj.y + half - Math.max(wY, y));
      ctx.restore();
    }

    // Density label
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `bold ${Math.max(10, obj.sideLen * 0.2)}px 'Inter', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${obj.density.toFixed(2)}`, obj.x, obj.y - 1);
    ctx.font = `${Math.max(8, obj.sideLen * 0.15)}px 'Inter', system-ui, sans-serif`;
    ctx.fillText("g/cm\u00B3", obj.x, obj.y + obj.sideLen * 0.2);

    // Label above
    ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, 0.95)`;
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(obj.label, obj.x, y - 10);

    // Status label below
    const status = obj.density <= FLUID_DENSITY ? "FLOATS" : "SINKS";
    const statusColor = obj.density <= FLUID_DENSITY ? "#4ade80" : "#f87171";
    ctx.fillStyle = statusColor;
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillText(status, obj.x, obj.y + half + 16);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    wavePhase = 0;
    createObjects();
  }

  function update(dt: number, params: Record<string, number>): void {
    mass1 = params.mass1 ?? 800;
    volume1 = params.volume1 ?? 1000;
    mass2 = params.mass2 ?? 1500;
    volume2 = params.volume2 ?? 1000;

    obj1.mass = mass1;
    obj1.volume = volume1;
    obj1.density = mass1 / volume1;
    obj2.mass = mass2;
    obj2.volume = volume2;
    obj2.density = mass2 / volume2;

    // Reposition X
    const tLeft = tankLeft();
    const tRight = tankRight();
    const tankW = tRight - tLeft;
    obj1.x = tLeft + tankW * 0.3;
    obj2.x = tLeft + tankW * 0.7;

    obj1.targetY = computeEquilibriumY(obj1);
    obj2.targetY = computeEquilibriumY(obj2);

    // Spring-damper
    const springK = 8;
    const damping = 4;

    for (const obj of [obj1, obj2]) {
      const displacement = obj.y - obj.targetY;
      const springForce = -springK * displacement;
      const dampForce = -damping * obj.vy;
      const accel = springForce + dampForce;
      obj.vy += accel * dt;
      obj.y += obj.vy * dt;

      const half = obj.sideLen / 2;
      const bottom = tankBottom();
      if (obj.y + half > bottom) {
        obj.y = bottom - half;
        obj.vy = -obj.vy * 0.3;
      }
      const minY = waterSurfaceY() - obj.sideLen * 1.2;
      if (obj.y - half < minY) {
        obj.y = minY + half;
        obj.vy = 0;
      }
    }

    wavePhase += dt * 1.5;
    time += dt;
  }

  function render(): void {
    if (!ctx) return;

    // ── Background ──────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.3, "#0d1025");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // ── Title ───────────────────────────────────────
    ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Buoyancy Comparison", width / 2, 28);

    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      "Archimedes: F_b = \u03C1_fluid \u00D7 V_submerged \u00D7 g  |  Floats if \u03C1_obj < \u03C1_fluid",
      width / 2, 48
    );

    const tLeft = tankLeft();
    const tRight = tankRight();
    const wY = waterSurfaceY();
    const tBottom = tankBottom();

    // ── Water body ──────────────────────────────────
    const waterGrad = ctx.createLinearGradient(0, wY, 0, tBottom);
    waterGrad.addColorStop(0, "rgba(20, 100, 200, 0.45)");
    waterGrad.addColorStop(0.5, "rgba(15, 70, 160, 0.55)");
    waterGrad.addColorStop(1, "rgba(10, 40, 100, 0.65)");

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tLeft, wY);
    for (let x = tLeft; x <= tRight; x += 2) {
      const wave = Math.sin(x * 0.02 + wavePhase) * 3 + Math.sin(x * 0.035 + wavePhase * 1.3) * 2;
      ctx.lineTo(x, wY + wave);
    }
    ctx.lineTo(tRight, tBottom + 5);
    ctx.lineTo(tLeft, tBottom + 5);
    ctx.closePath();
    ctx.fillStyle = waterGrad;
    ctx.fill();

    // Surface highlight
    ctx.beginPath();
    for (let x = tLeft; x <= tRight; x += 2) {
      const wave = Math.sin(x * 0.02 + wavePhase) * 3 + Math.sin(x * 0.035 + wavePhase * 1.3) * 2;
      if (x === tLeft) ctx.moveTo(x, wY + wave);
      else ctx.lineTo(x, wY + wave);
    }
    ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Caustics
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 10; i++) {
      const cx = tLeft + (Math.sin(i * 1.7 + wavePhase * 0.8) * 0.5 + 0.5) * (tRight - tLeft);
      const cy = wY + 30 + (Math.cos(i * 2.3 + wavePhase * 0.5) * 0.5 + 0.5) * (tBottom - wY - 50);
      const r = 18 + Math.sin(i + wavePhase) * 8;
      const caustic = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      caustic.addColorStop(0, "rgba(100, 200, 255, 1)");
      caustic.addColorStop(1, "rgba(100, 200, 255, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = caustic;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── Tank walls ──────────────────────────────────
    ctx.strokeStyle = "rgba(150, 200, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tLeft, wY - 50);
    ctx.lineTo(tLeft, tBottom + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tRight, wY - 50);
    ctx.lineTo(tRight, tBottom + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tLeft, tBottom + 5);
    ctx.lineTo(tRight, tBottom + 5);
    ctx.stroke();

    // Glass reflection
    ctx.strokeStyle = "rgba(200, 230, 255, 0.08)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(tLeft + 4, wY - 40);
    ctx.lineTo(tLeft + 4, tBottom);
    ctx.stroke();

    // Fluid density label
    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Water: \u03C1 = ${FLUID_DENSITY.toFixed(1)} g/cm\u00B3`, tLeft + 10, wY + 22);

    // ── Objects ─────────────────────────────────────
    drawObject(obj1);
    drawObject(obj2);
    drawForces(obj1);
    drawForces(obj2);

    // ── Info panel (right side) ─────────────────────
    const panelX = width * 0.65;
    const panelY = height * 0.1;
    const panelW = width * 0.32;
    const panelH = height * 0.82;

    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();

    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Buoyancy Analysis", panelX + 12, panelY + 22);

    let ly = panelY + 46;
    const lineH = 18;

    // Object 1 info
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Object 1", panelX + 12, ly);
    ly += lineH;

    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Mass: ${mass1} g`, panelX + 12, ly); ly += lineH;
    ctx.fillText(`Volume: ${volume1} cm\u00B3`, panelX + 12, ly); ly += lineH;
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`Density: ${(mass1 / volume1).toFixed(3)} g/cm\u00B3`, panelX + 12, ly); ly += lineH;

    const status1 = mass1 / volume1 <= FLUID_DENSITY ? "Floats" : "Sinks";
    const fracSub1 = mass1 / volume1 <= FLUID_DENSITY
      ? `${((mass1 / volume1 / FLUID_DENSITY) * 100).toFixed(1)}% submerged`
      : "100% submerged";
    ctx.fillStyle = mass1 / volume1 <= FLUID_DENSITY ? "#4ade80" : "#f87171";
    ctx.fillText(`Status: ${status1} (${fracSub1})`, panelX + 12, ly); ly += lineH;

    // Weight and buoyancy
    const w1 = (mass1 / 1000) * g;
    const vSub1 = mass1 / volume1 <= FLUID_DENSITY ? (mass1 / volume1 / FLUID_DENSITY) * volume1 : volume1;
    const fb1 = FLUID_DENSITY * 1000 * (vSub1 * 1e-6) * g;
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`Weight: ${w1.toFixed(3)} N`, panelX + 12, ly); ly += lineH;
    ctx.fillStyle = "#4ade80";
    ctx.fillText(`Buoyancy: ${fb1.toFixed(3)} N`, panelX + 12, ly); ly += lineH;
    ctx.fillStyle = "#f87171";
    ctx.fillText(`Net: ${(fb1 - w1).toFixed(3)} N`, panelX + 12, ly); ly += lineH + 8;

    // Object 2 info
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Object 2", panelX + 12, ly);
    ly += lineH;

    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Mass: ${mass2} g`, panelX + 12, ly); ly += lineH;
    ctx.fillText(`Volume: ${volume2} cm\u00B3`, panelX + 12, ly); ly += lineH;
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`Density: ${(mass2 / volume2).toFixed(3)} g/cm\u00B3`, panelX + 12, ly); ly += lineH;

    const status2 = mass2 / volume2 <= FLUID_DENSITY ? "Floats" : "Sinks";
    const fracSub2 = mass2 / volume2 <= FLUID_DENSITY
      ? `${((mass2 / volume2 / FLUID_DENSITY) * 100).toFixed(1)}% submerged`
      : "100% submerged";
    ctx.fillStyle = mass2 / volume2 <= FLUID_DENSITY ? "#4ade80" : "#f87171";
    ctx.fillText(`Status: ${status2} (${fracSub2})`, panelX + 12, ly); ly += lineH;

    const w2 = (mass2 / 1000) * g;
    const vSub2 = mass2 / volume2 <= FLUID_DENSITY ? (mass2 / volume2 / FLUID_DENSITY) * volume2 : volume2;
    const fb2 = FLUID_DENSITY * 1000 * (vSub2 * 1e-6) * g;
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`Weight: ${w2.toFixed(3)} N`, panelX + 12, ly); ly += lineH;
    ctx.fillStyle = "#4ade80";
    ctx.fillText(`Buoyancy: ${fb2.toFixed(3)} N`, panelX + 12, ly); ly += lineH;
    ctx.fillStyle = "#f87171";
    ctx.fillText(`Net: ${(fb2 - w2).toFixed(3)} N`, panelX + 12, ly); ly += lineH + 10;

    // Formulas
    ctx.fillStyle = "#64748b";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillText("Archimedes' Principle:", panelX + 12, ly); ly += 14;
    ctx.fillText("F_b = \u03C1_fluid \u00D7 V_sub \u00D7 g", panelX + 12, ly); ly += 14;
    ctx.fillText("W = m \u00D7 g", panelX + 12, ly); ly += 14;
    ctx.fillText("Float if \u03C1_obj < \u03C1_fluid", panelX + 12, ly); ly += 14;
    ctx.fillText("Fraction sub = \u03C1_obj / \u03C1_fluid", panelX + 12, ly);

    // Legend
    const legY = height * 0.86;
    ctx.fillStyle = "rgba(15, 20, 40, 0.75)";
    ctx.beginPath();
    ctx.roundRect(panelX, legY, panelW, 50, 6);
    ctx.fill();

    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";

    // Weight arrow legend
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(panelX + 12, legY + 10, 16, 3);
    ctx.fillText("W = Weight (mg)", panelX + 34, legY + 15);

    // Buoyancy arrow legend
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(panelX + 12, legY + 24, 16, 3);
    ctx.fillText("F_b = Buoyancy", panelX + 34, legY + 29);

    // Net arrow legend
    ctx.fillStyle = "#f87171";
    ctx.fillRect(panelX + 12, legY + 38, 16, 3);
    ctx.fillText("Net = F_b - W", panelX + 34, legY + 43);

    // Time
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 6);
  }

  function reset(): void {
    time = 0;
    wavePhase = 0;
    mass1 = config.parameters.find((p) => p.key === "mass1")!.defaultValue;
    volume1 = config.parameters.find((p) => p.key === "volume1")!.defaultValue;
    mass2 = config.parameters.find((p) => p.key === "mass2")!.defaultValue;
    volume2 = config.parameters.find((p) => p.key === "volume2")!.defaultValue;
    createObjects();
  }

  function destroy(): void {
    // No persistent resources
  }

  function getStateDescription(): string {
    const d1 = mass1 / volume1;
    const d2 = mass2 / volume2;
    const s1 = d1 <= FLUID_DENSITY ? "floating" : "sinking";
    const s2 = d2 <= FLUID_DENSITY ? "floating" : "sinking";
    const frac1 = d1 <= FLUID_DENSITY ? ((d1 / FLUID_DENSITY) * 100).toFixed(1) : "100";
    const frac2 = d2 <= FLUID_DENSITY ? ((d2 / FLUID_DENSITY) * 100).toFixed(1) : "100";
    return (
      `Buoyancy Comparison: Water density = ${FLUID_DENSITY} g/cm\u00B3. ` +
      `Object 1: mass=${mass1}g, volume=${volume1}cm\u00B3, density=${d1.toFixed(3)} g/cm\u00B3, ${s1}, ${frac1}% submerged. ` +
      `Object 2: mass=${mass2}g, volume=${volume2}cm\u00B3, density=${d2.toFixed(3)} g/cm\u00B3, ${s2}, ${frac2}% submerged. ` +
      `Archimedes: F_b = \u03C1_fluid \u00D7 V_sub \u00D7 g. An object floats when \u03C1_obj < \u03C1_fluid. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createObjects();
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default BuoyancyComparisonFactory;
