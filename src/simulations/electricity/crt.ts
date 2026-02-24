import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Electron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  trail: Array<{ x: number; y: number }>;
}

const CRTFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("crt") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let horizontalVoltage = 0;
  let verticalVoltage = 0;
  let acceleratingVoltage = 2000;
  let beamCurrent = 5;

  // Electron beam particles
  let electrons: Electron[] = [];
  let emitTimer = 0;

  // Screen dot position (calculated analytically)
  let screenDotX = 0;
  let screenDotY = 0;
  let screenGlow = 0;

  // CRT tube geometry (fractions of canvas)
  const TUBE_LEFT = 0.06;
  const TUBE_RIGHT = 0.94;
  const TUBE_TOP = 0.18;
  const TUBE_BOT = 0.72;
  const CATHODE_X = 0.10;
  const HPLATE_START = 0.32;
  const HPLATE_END = 0.44;
  const VPLATE_START = 0.50;
  const VPLATE_END = 0.62;
  const SCREEN_X = 0.90;

  // Physics constants (arbitrary scale for visualization)
  const ELECTRON_CHARGE = 1.6e-19;
  const ELECTRON_MASS = 9.109e-31;
  const PLATE_LENGTH_M = 0.03; // 3 cm plate length
  const PLATE_SEP_M = 0.02;   // 2 cm plate separation
  const SCREEN_DIST_M = 0.15;  // 15 cm cathode to screen

  function calcDeflection(plateVoltage: number): number {
    // Deflection: y = (qEL / 2mv^2) * (L/2 + D)
    // E = V_plate / d (electric field between plates)
    // v = sqrt(2qVa / m) (velocity from accelerating voltage)
    const v = Math.sqrt((2 * ELECTRON_CHARGE * acceleratingVoltage) / ELECTRON_MASS);
    const E = plateVoltage / PLATE_SEP_M;
    const L = PLATE_LENGTH_M;
    const D = SCREEN_DIST_M * 0.4; // distance from plates to screen
    return (ELECTRON_CHARGE * E * L) / (2 * ELECTRON_MASS * v * v) * (L / 2 + D);
  }

  function tubeX(frac: number): number { return W * frac; }
  function tubeY(frac: number): number { return H * frac; }
  function centerY(): number { return (tubeY(TUBE_TOP) + tubeY(TUBE_BOT)) / 2; }

  function emitElectron(): void {
    const cx = tubeX(CATHODE_X);
    const cy = centerY();
    const v = Math.sqrt((2 * ELECTRON_CHARGE * acceleratingVoltage) / ELECTRON_MASS);
    // Scale velocity to canvas space (pixels per second)
    const pixelVelocity = (tubeX(SCREEN_X) - tubeX(CATHODE_X)) / 0.8;

    electrons.push({
      x: cx,
      y: cy + (Math.random() - 0.5) * 4,
      vx: pixelVelocity,
      vy: 0,
      active: true,
      trail: [{ x: cx, y: cy }],
    });
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTubeEnvelope(): void {
    const lx = tubeX(TUBE_LEFT);
    const rx = tubeX(TUBE_RIGHT);
    const ty = tubeY(TUBE_TOP);
    const by = tubeY(TUBE_BOT);
    const neckW = (by - ty) * 0.3;
    const neckEnd = tubeX(0.22);

    ctx.strokeStyle = "rgba(120, 140, 180, 0.35)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Top edge: narrow neck then flaring cone
    ctx.moveTo(lx, centerY() - neckW / 2);
    ctx.lineTo(neckEnd, centerY() - neckW / 2);
    ctx.lineTo(tubeX(0.30), ty + 10);
    ctx.lineTo(rx, ty);
    // Screen face (right side)
    ctx.lineTo(rx, by);
    // Bottom edge
    ctx.lineTo(tubeX(0.30), by - 10);
    ctx.lineTo(neckEnd, centerY() + neckW / 2);
    ctx.lineTo(lx, centerY() + neckW / 2);
    ctx.closePath();
    ctx.stroke();

    // Faint fill
    ctx.fillStyle = "rgba(80, 100, 140, 0.04)";
    ctx.fill();

    // Vacuum label
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VACUUM", tubeX(0.50), tubeY(TUBE_TOP) + 16);
  }

  function drawCathode(): void {
    const cx = tubeX(CATHODE_X);
    const cy = centerY();
    const h = 30;

    // Heater filament
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const fy = cy - h / 2 + (i / 5) * h;
      ctx.moveTo(cx - 8, fy);
      ctx.lineTo(cx - 4, fy + (i % 2 === 0 ? 3 : -3));
      ctx.lineTo(cx, fy);
    }
    ctx.stroke();

    // Cathode surface
    ctx.fillStyle = "rgba(180, 80, 60, 0.8)";
    ctx.fillRect(cx - 2, cy - h / 2, 6, h);

    // Glow from heated cathode
    const glow = ctx.createRadialGradient(cx + 4, cy, 0, cx + 4, cy, 25);
    glow.addColorStop(0, "rgba(255, 120, 60, 0.25)");
    glow.addColorStop(1, "rgba(255, 60, 20, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 25, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255, 200, 150, 0.8)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CATHODE", cx, cy + h / 2 + 14);
    ctx.fillText(`${acceleratingVoltage}V`, cx, cy + h / 2 + 26);
  }

  function drawDeflectionPlates(
    startFrac: number, endFrac: number, voltage: number,
    label: string, isVertical: boolean
  ): void {
    const sx = tubeX(startFrac);
    const ex = tubeX(endFrac);
    const cy = centerY();
    const plateSep = (tubeY(TUBE_BOT) - tubeY(TUBE_TOP)) * 0.35;

    // Top plate
    const topY = cy - plateSep / 2;
    const botY = cy + plateSep / 2;
    const plateThick = 4;

    const posColor = voltage >= 0 ? "rgba(239, 68, 68, 0.7)" : "rgba(59, 130, 246, 0.7)";
    const negColor = voltage >= 0 ? "rgba(59, 130, 246, 0.7)" : "rgba(239, 68, 68, 0.7)";

    // Top plate
    ctx.fillStyle = posColor;
    ctx.fillRect(sx, topY - plateThick, ex - sx, plateThick);
    // Bottom plate
    ctx.fillStyle = negColor;
    ctx.fillRect(sx, botY, ex - sx, plateThick);

    // Electric field lines between plates
    if (Math.abs(voltage) > 2) {
      const numLines = 5;
      const midX = (sx + ex) / 2;
      const fieldDir = voltage > 0 ? 1 : -1;
      for (let i = 0; i < numLines; i++) {
        const fx = sx + (i + 0.5) * (ex - sx) / numLines;
        ctx.strokeStyle = `rgba(180, 130, 255, ${Math.min(0.5, Math.abs(voltage) / 100 * 0.4)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(fx, topY);
        ctx.lineTo(fx, botY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrow in middle
        const arrowY = cy + fieldDir * 6;
        ctx.fillStyle = `rgba(180, 130, 255, ${Math.min(0.6, Math.abs(voltage) / 100 * 0.5)})`;
        ctx.beginPath();
        ctx.moveTo(fx, arrowY + fieldDir * 5);
        ctx.lineTo(fx - 3, arrowY - fieldDir * 2);
        ctx.lineTo(fx + 3, arrowY - fieldDir * 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Voltage labels
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = posColor;
    ctx.fillText(voltage >= 0 ? `+${Math.abs(voltage).toFixed(0)}V` : `${voltage.toFixed(0)}V`, (sx + ex) / 2, topY - plateThick - 6);
    ctx.fillStyle = negColor;
    ctx.fillText(voltage >= 0 ? `-${Math.abs(voltage).toFixed(0)}V` : `+${Math.abs(voltage).toFixed(0)}V`, (sx + ex) / 2, botY + plateThick + 14);

    // Plate label
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText(label, (sx + ex) / 2, botY + plateThick + 28);
  }

  function drawPhosphorScreen(): void {
    const sx = tubeX(SCREEN_X);
    const ty = tubeY(TUBE_TOP);
    const by = tubeY(TUBE_BOT);

    // Screen surface
    ctx.fillStyle = "rgba(40, 60, 40, 0.5)";
    ctx.fillRect(sx - 3, ty, 8, by - ty);
    ctx.strokeStyle = "rgba(100, 200, 100, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 3, ty, 8, by - ty);

    // Phosphor coating texture
    for (let y = ty; y < by; y += 6) {
      ctx.fillStyle = `rgba(80, 180, 80, ${0.05 + Math.random() * 0.03})`;
      ctx.fillRect(sx - 2, y, 6, 5);
    }

    // Glowing dot where beam hits
    if (screenGlow > 0.01) {
      const dotY = screenDotY;
      const dotSize = 4 + screenGlow * 8;

      // Outer glow
      const glow1 = ctx.createRadialGradient(sx, dotY, 0, sx, dotY, dotSize * 4);
      glow1.addColorStop(0, `rgba(100, 255, 100, ${screenGlow * 0.3})`);
      glow1.addColorStop(0.5, `rgba(80, 200, 80, ${screenGlow * 0.1})`);
      glow1.addColorStop(1, "rgba(0, 200, 0, 0)");
      ctx.fillStyle = glow1;
      ctx.beginPath();
      ctx.arc(sx, dotY, dotSize * 4, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright dot
      const glow2 = ctx.createRadialGradient(sx, dotY, 0, sx, dotY, dotSize);
      glow2.addColorStop(0, `rgba(220, 255, 220, ${screenGlow * 0.9})`);
      glow2.addColorStop(0.5, `rgba(100, 255, 100, ${screenGlow * 0.6})`);
      glow2.addColorStop(1, `rgba(50, 200, 50, ${screenGlow * 0.1})`);
      ctx.fillStyle = glow2;
      ctx.beginPath();
      ctx.arc(sx, dotY, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = "rgba(100, 255, 100, 0.6)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PHOSPHOR", sx, by + 14);
    ctx.fillText("SCREEN", sx, by + 26);
  }

  function drawElectrons(): void {
    for (const e of electrons) {
      if (!e.active) continue;

      // Draw trail
      if (e.trail.length > 1) {
        ctx.strokeStyle = "rgba(80, 180, 255, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(e.trail[0].x, e.trail[0].y);
        for (let i = 1; i < e.trail.length; i++) {
          ctx.lineTo(e.trail[i].x, e.trail[i].y);
        }
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
      }

      // Draw electron particle
      const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 6);
      glow.addColorStop(0, "rgba(100, 200, 255, 0.8)");
      glow.addColorStop(1, "rgba(50, 100, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInfoPanel(): void {
    const panelH = 58;
    const panelY = H - panelH - 6;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, W - 16, panelH, 6);
    ctx.fill();

    const fs = Math.max(10, Math.min(12, W / 60));
    ctx.font = `${fs}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const y1 = panelY + 14;
    const y2 = panelY + 30;
    const y3 = panelY + 46;

    // Compute real deflection
    const hDeflect = calcDeflection(horizontalVoltage);
    const vDeflect = calcDeflection(verticalVoltage);
    const v = Math.sqrt((2 * ELECTRON_CHARGE * acceleratingVoltage) / ELECTRON_MASS);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`V_accel = ${acceleratingVoltage}V`, 16, y1);
    ctx.fillText(`V_horiz = ${horizontalVoltage.toFixed(0)}V`, 16 + W * 0.22, y1);
    ctx.fillText(`V_vert = ${verticalVoltage.toFixed(0)}V`, 16 + W * 0.44, y1);

    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.fillText(`v_e = ${(v / 1e6).toFixed(1)} Mm/s`, 16, y2);
    ctx.fillText(`Horiz deflect = ${(hDeflect * 1000).toFixed(2)}mm`, 16 + W * 0.22, y2);
    ctx.fillText(`Vert deflect = ${(vDeflect * 1000).toFixed(2)}mm`, 16 + W * 0.44, y2);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText("Deflection: y = (qEL/2mv\u00B2)(L/2 + D)   |   F = qE   |   KE = qV_a", 16, y3);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    electrons = [];
    emitTimer = 0;
    screenGlow = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    horizontalVoltage = params.horizontalVoltage ?? 0;
    verticalVoltage = params.verticalVoltage ?? 0;
    acceleratingVoltage = params.acceleratingVoltage ?? 2000;
    beamCurrent = params.beamCurrent ?? 5;

    time += dt;

    // Emit electrons at a rate proportional to beam current
    emitTimer += dt;
    const emitInterval = 0.12 / beamCurrent;
    while (emitTimer >= emitInterval) {
      emitTimer -= emitInterval;
      emitElectron();
    }

    // Update electron positions
    const cathodeX = tubeX(CATHODE_X);
    const screenX = tubeX(SCREEN_X);
    const hpStart = tubeX(HPLATE_START);
    const hpEnd = tubeX(HPLATE_END);
    const vpStart = tubeX(VPLATE_START);
    const vpEnd = tubeX(VPLATE_END);
    const cy = centerY();
    const plateSep = (tubeY(TUBE_BOT) - tubeY(TUBE_TOP)) * 0.35;

    // Normalized deflection for display
    const maxDeflectPx = plateSep / 2 * 0.85;
    const hDeflectNorm = Math.max(-1, Math.min(1, horizontalVoltage / 100));
    const vDeflectNorm = Math.max(-1, Math.min(1, verticalVoltage / 100));

    for (const e of electrons) {
      if (!e.active) continue;

      e.x += e.vx * dt;

      // Apply deflection force when between horizontal plates
      if (e.x >= hpStart && e.x <= hpEnd) {
        e.vy += (verticalVoltage / 100) * 800 * dt;
      }
      // Apply deflection force when between vertical plates
      if (e.x >= vpStart && e.x <= vpEnd) {
        e.vy += (horizontalVoltage / 100) * 800 * dt;
      }

      e.y += e.vy * dt;

      // Add trail point
      if (e.trail.length === 0 || Math.abs(e.x - e.trail[e.trail.length - 1].x) > 8) {
        e.trail.push({ x: e.x, y: e.y });
        if (e.trail.length > 40) e.trail.shift();
      }

      // Hit screen
      if (e.x >= screenX) {
        e.active = false;
        screenDotX = screenX;
        screenDotY = e.y;
        screenGlow = Math.min(1, screenGlow + 0.15);
      }

      // Out of bounds
      if (e.y < tubeY(TUBE_TOP) || e.y > tubeY(TUBE_BOT)) {
        e.active = false;
      }
    }

    // Decay screen glow
    screenGlow *= 0.97;

    // Analytical screen dot position (for when beam is steady)
    screenDotY = cy + vDeflectNorm * maxDeflectPx + hDeflectNorm * maxDeflectPx * 0.5;

    // Remove old inactive electrons
    electrons = electrons.filter(e => e.active || e.trail.length > 0);
    if (electrons.length > 80) {
      electrons = electrons.slice(-60);
    }
  }

  function render(): void {
    if (!ctx || W === 0 || H === 0) return;

    drawBackground();
    drawTubeEnvelope();
    drawCathode();
    drawDeflectionPlates(HPLATE_START, HPLATE_END, verticalVoltage, "V-DEFLECT", false);
    drawDeflectionPlates(VPLATE_START, VPLATE_END, horizontalVoltage, "H-DEFLECT", true);
    drawPhosphorScreen();
    drawElectrons();
    drawInfoPanel();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Cathode Ray Tube (CRT)", 12, 8);
  }

  function reset(): void {
    time = 0;
    electrons = [];
    emitTimer = 0;
    screenGlow = 0;
  }

  function destroy(): void {
    electrons = [];
  }

  function getStateDescription(): string {
    const v = Math.sqrt((2 * ELECTRON_CHARGE * acceleratingVoltage) / ELECTRON_MASS);
    const hDeflect = calcDeflection(horizontalVoltage);
    const vDeflect = calcDeflection(verticalVoltage);
    return (
      `Cathode Ray Tube: Accelerating voltage = ${acceleratingVoltage}V, ` +
      `electron velocity = ${(v / 1e6).toFixed(1)} Mm/s. ` +
      `Horizontal deflection voltage = ${horizontalVoltage.toFixed(0)}V (deflection = ${(hDeflect * 1000).toFixed(2)}mm). ` +
      `Vertical deflection voltage = ${verticalVoltage.toFixed(0)}V (deflection = ${(vDeflect * 1000).toFixed(2)}mm). ` +
      `Beam current = ${beamCurrent}. ` +
      `The CRT works by thermionic emission from a heated cathode. Electrons are accelerated by V_a, ` +
      `then deflected by electric fields between plate pairs (F = qE). ` +
      `Deflection formula: y = (qEL/2mv\u00B2)(L/2 + D). ` +
      `The beam strikes a phosphor-coated screen producing a visible green dot.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
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

export default CRTFactory;
