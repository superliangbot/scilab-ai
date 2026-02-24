import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface ChargeParticle {
  /** Progress along the circuit path, 0..1 */
  t: number;
}

const Ammeter: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ammeter") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let current = 2.5;
  let range = 1; // 0 = 500mA, 1 = 5A
  let showInternal = 1;
  let batteryVoltage = 9;

  // Smooth needle animation
  let displayNeedle = 0; // current needle angle (smoothly approaches target)
  let targetNeedle = 0;

  // Charge particles
  const charges: ChargeParticle[] = [];
  const NUM_CHARGES = 20;

  // Coil animation
  let coilDeflection = 0;

  // Colors
  const BG = "#0f172a";
  const METER_FACE = "#1a1a2e";
  const METER_RING = "#4a5568";
  const NEEDLE_COLOR = "#ef4444";
  const SCALE_COLOR = "#e2e8f0";
  const SCALE_DIM = "#94a3b8";
  const WIRE_COLOR = "#475569";
  const WIRE_HIGHLIGHT = "#64748b";
  const CHARGE_COLOR = "#22d3ee";
  const CHARGE_GLOW = "rgba(34, 211, 238, 0.3)";
  const BATTERY_POS = "#ef4444";
  const BATTERY_NEG = "#3b82f6";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#94a3b8";
  const RESISTOR_COLOR = "#f59e0b";
  const MAGNET_N = "#ef4444";
  const MAGNET_S = "#3b82f6";
  const COIL_COLOR = "#f59e0b";
  const SPRING_COLOR = "#a78bfa";
  const SHUNT_COLOR = "#10b981";

  function initCharges() {
    charges.length = 0;
    for (let i = 0; i < NUM_CHARGES; i++) {
      charges.push({ t: i / NUM_CHARGES });
    }
  }

  function computePhysics(params: Record<string, number>) {
    current = params.current ?? current;
    range = params.range !== undefined ? Math.round(params.range) : range;
    showInternal = params.showInternal !== undefined ? Math.round(params.showInternal) : showInternal;
    batteryVoltage = params.voltage ?? batteryVoltage;

    // Clamp current to selected range
    const maxCurrent = range === 0 ? 0.5 : 5;
    const clampedCurrent = Math.min(current, maxCurrent);

    // Needle target: map current to angle
    // Scale goes from -90deg (left, 0 current) to +90deg (right, max current)
    // We use -80 to +80 to keep within the arc
    targetNeedle = (clampedCurrent / maxCurrent) * 160 - 80;

    // Coil deflection proportional to current
    coilDeflection = (clampedCurrent / maxCurrent) * 35; // degrees
  }

  function getCircuitPoint(t: number): { x: number; y: number } {
    // Circuit layout in the bottom half of the canvas
    const topY = height * 0.55;
    const botY = height * 0.90;
    const leftX = width * 0.1;
    const rightX = width * 0.9;
    const w = rightX - leftX;
    const h = botY - topY;

    const perimeter = 2 * w + 2 * h;
    const dist = ((t % 1) + 1) % 1 * perimeter;

    // Bottom wire: left to right
    if (dist < w) {
      return { x: leftX + dist, y: botY };
    }
    // Right side: bottom to top
    if (dist < w + h) {
      return { x: rightX, y: botY - (dist - w) };
    }
    // Top wire: right to left
    if (dist < 2 * w + h) {
      return { x: rightX - (dist - w - h), y: topY };
    }
    // Left side: top to bottom
    return { x: leftX, y: topY + (dist - 2 * w - h) };
  }

  // --- Drawing the Meter Face (top half) ---

  function drawMeterFace() {
    const cx = width * 0.5;
    const cy = height * 0.28;
    const radius = Math.min(width, height) * 0.23;

    // Outer bezel (glass-like effect)
    const bezelGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius * 1.1);
    bezelGrad.addColorStop(0, "#6b7280");
    bezelGrad.addColorStop(0.5, "#374151");
    bezelGrad.addColorStop(1, "#1f2937");
    ctx.fillStyle = bezelGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.fill();

    // Chrome ring
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring highlight
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.05, 0, Math.PI * 2);
    ctx.stroke();

    // Meter face background
    const faceGrad = ctx.createRadialGradient(cx, cy - radius * 0.2, 0, cx, cy, radius);
    faceGrad.addColorStop(0, "#f8fafc");
    faceGrad.addColorStop(0.8, "#e2e8f0");
    faceGrad.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw scale arc and tick marks
    drawScale(cx, cy, radius);

    // Draw needle
    drawNeedle(cx, cy, radius);

    // Glass reflection effect
    const glassGrad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.35, 0, cx, cy, radius);
    glassGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    glassGrad.addColorStop(0.4, "rgba(255, 255, 255, 0.05)");
    glassGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // "A" label
    ctx.fillStyle = "#1e293b";
    ctx.font = `bold ${radius * 0.14}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", cx, cy + radius * 0.55);

    // DC symbol (solid line with dashes below)
    const dcY = cy + radius * 0.4;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8, dcY);
    ctx.lineTo(cx + 8, dcY);
    ctx.stroke();
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(cx - 8, dcY + 4);
    ctx.lineTo(cx + 8, dcY + 4);
    ctx.stroke();
    ctx.setLineDash([]);

    // Terminal markers
    ctx.fillStyle = BATTERY_POS;
    ctx.font = `bold ${radius * 0.1}px monospace`;
    ctx.fillText("+", cx - radius * 0.35, cy + radius * 0.75);
    ctx.fillStyle = BATTERY_NEG;
    ctx.fillText("\u2013", cx + radius * 0.35, cy + radius * 0.75);

    // Terminal dots
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(cx - radius * 0.35, cy + radius * 0.85, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d4ed8";
    ctx.beginPath();
    ctx.arc(cx + radius * 0.35, cy + radius * 0.85, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawScale(cx: number, cy: number, radius: number) {
    const maxCurrent = range === 0 ? 0.5 : 5;
    const scaleRadius = radius * 0.78;
    const innerScaleRadius = radius * 0.65;

    // The scale arc spans from -80deg to +80deg measured from top (12 o'clock)
    // In canvas coords: angle measured from bottom center
    // Start angle = 200deg, End angle = 340deg (in standard canvas radians)
    const startAngle = Math.PI * 1.25; // 225 degrees
    const endAngle = Math.PI * -0.25;  // -45 degrees (= 315 degrees)
    const totalSweep = Math.PI * 1.5;  // Not used directly; we compute manually

    // We define our scale so that 0 current = left end, max = right end
    // Angles: from 220deg to 320deg (relative to center)
    const scaleStart = (210 * Math.PI) / 180; // 210 degrees
    const scaleEnd = (330 * Math.PI) / 180;   // 330 degrees
    const scaleSweep = scaleEnd - scaleStart;  // 120 degrees

    // Draw the arc line
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, scaleRadius, scaleStart, scaleEnd);
    ctx.stroke();

    // Outer scale (primary range)
    const numMajor = range === 0 ? 5 : 5; // 5 major divisions
    const numMinor = 5; // minor divisions between major ticks
    const totalTicks = numMajor * numMinor;

    for (let i = 0; i <= totalTicks; i++) {
      const frac = i / totalTicks;
      const angle = scaleStart + frac * scaleSweep;
      const isMajor = i % numMinor === 0;
      const majorIndex = i / numMinor;

      const outerR = scaleRadius;
      const innerR = isMajor ? scaleRadius - radius * 0.1 : scaleRadius - radius * 0.05;

      const x1 = cx + Math.cos(angle) * outerR;
      const y1 = cy + Math.sin(angle) * outerR;
      const x2 = cx + Math.cos(angle) * innerR;
      const y2 = cy + Math.sin(angle) * innerR;

      ctx.strokeStyle = isMajor ? "#1e293b" : "#64748b";
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Major tick number (outer scale)
      if (isMajor) {
        const value = (majorIndex / numMajor) * maxCurrent;
        const labelR = scaleRadius + radius * 0.08;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;

        ctx.fillStyle = "#1e293b";
        ctx.font = `bold ${radius * 0.09}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (range === 0) {
          ctx.fillText((value * 1000).toFixed(0), lx, ly);
        } else {
          ctx.fillText(value.toFixed(1), lx, ly);
        }
      }
    }

    // Inner scale (secondary range)
    const secondaryMax = range === 0 ? 5 : 0.5;
    const secondaryLabel = range === 0 ? "A" : "mA";
    const numMajor2 = 5;
    const numMinor2 = 5;
    const totalTicks2 = numMajor2 * numMinor2;

    for (let i = 0; i <= totalTicks2; i++) {
      const frac = i / totalTicks2;
      const angle = scaleStart + frac * scaleSweep;
      const isMajor = i % numMinor2 === 0;
      const majorIndex = i / numMinor2;

      const outerR = innerScaleRadius;
      const innerR = isMajor ? innerScaleRadius - radius * 0.07 : innerScaleRadius - radius * 0.035;

      const x1 = cx + Math.cos(angle) * outerR;
      const y1 = cy + Math.sin(angle) * outerR;
      const x2 = cx + Math.cos(angle) * innerR;
      const y2 = cy + Math.sin(angle) * innerR;

      ctx.strokeStyle = isMajor ? "#64748b" : "#94a3b8";
      ctx.lineWidth = isMajor ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (isMajor) {
        const value = (majorIndex / numMajor2) * secondaryMax;
        const labelR = innerScaleRadius - radius * 0.12;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;

        ctx.fillStyle = "#64748b";
        ctx.font = `${radius * 0.065}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (range === 0) {
          ctx.fillText(value.toFixed(1), lx, ly);
        } else {
          ctx.fillText((value * 1000).toFixed(0), lx, ly);
        }
      }
    }

    // Scale unit labels
    ctx.fillStyle = "#334155";
    ctx.font = `${radius * 0.07}px monospace`;
    ctx.textAlign = "center";

    const unitAngle1 = scaleStart + scaleSweep * 0.85;
    ctx.fillText(
      range === 0 ? "mA" : "A",
      cx + Math.cos(unitAngle1) * (scaleRadius + radius * 0.16),
      cy + Math.sin(unitAngle1) * (scaleRadius + radius * 0.16)
    );

    const unitAngle2 = scaleStart + scaleSweep * 0.15;
    ctx.fillText(
      range === 0 ? "A" : "mA",
      cx + Math.cos(unitAngle2) * (innerScaleRadius - radius * 0.2),
      cy + Math.sin(unitAngle2) * (innerScaleRadius - radius * 0.2)
    );
  }

  function drawNeedle(cx: number, cy: number, radius: number) {
    // Needle angle: displayNeedle is in degrees, -80 to +80
    // Map to canvas angle: -80 => scaleStart, +80 => scaleEnd
    const scaleStart = (210 * Math.PI) / 180;
    const scaleSweep = (120 * Math.PI) / 180;

    const needleFrac = (displayNeedle + 80) / 160;
    const needleAngle = scaleStart + needleFrac * scaleSweep;

    const needleLen = radius * 0.72;
    const tailLen = radius * 0.15;

    const tipX = cx + Math.cos(needleAngle) * needleLen;
    const tipY = cy + Math.sin(needleAngle) * needleLen;
    const tailX = cx - Math.cos(needleAngle) * tailLen;
    const tailY = cy - Math.sin(needleAngle) * tailLen;

    // Needle shadow
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tailX + 1, tailY + 2);
    ctx.lineTo(tipX + 1, tipY + 2);
    ctx.stroke();

    // Needle body (tapered)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(needleAngle);

    // Tapered needle shape
    ctx.fillStyle = NEEDLE_COLOR;
    ctx.beginPath();
    ctx.moveTo(needleLen, 0);
    ctx.lineTo(needleLen * 0.1, -1.8);
    ctx.lineTo(-tailLen, -2.5);
    ctx.lineTo(-tailLen, 2.5);
    ctx.lineTo(needleLen * 0.1, 1.8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Center pivot
    ctx.fillStyle = "#374151";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.025, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Drawing the Internal Mechanism / Circuit (bottom half) ---

  function drawCircuit() {
    const topY = height * 0.55;
    const botY = height * 0.90;
    const leftX = width * 0.1;
    const rightX = width * 0.9;
    const midX = width * 0.5;

    // Battery position (left side)
    const battX = leftX;
    const battTopY = topY;
    const battBotY = botY;

    // Resistor position (top wire, left portion)
    const rStartX = leftX + (rightX - leftX) * 0.12;
    const rEndX = leftX + (rightX - leftX) * 0.35;

    // Ammeter position (top wire, right portion)
    const ammStartX = leftX + (rightX - leftX) * 0.55;
    const ammEndX = leftX + (rightX - leftX) * 0.85;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw wires
    ctx.strokeStyle = WIRE_COLOR;
    ctx.lineWidth = 3;

    // Top wire: left to resistor start
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(rStartX, topY);
    ctx.stroke();

    // Top wire: resistor end to ammeter start
    ctx.beginPath();
    ctx.moveTo(rEndX, topY);
    ctx.lineTo(ammStartX, topY);
    ctx.stroke();

    // Top wire: ammeter end to right
    ctx.beginPath();
    ctx.moveTo(ammEndX, topY);
    ctx.lineTo(rightX, topY);
    ctx.stroke();

    // Right side wire
    ctx.beginPath();
    ctx.moveTo(rightX, topY);
    ctx.lineTo(rightX, botY);
    ctx.stroke();

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(rightX, botY);
    ctx.lineTo(leftX, botY);
    ctx.stroke();

    // Left side wire (battery connections)
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(leftX, topY + (botY - topY) * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(leftX, botY - (botY - topY) * 0.3);
    ctx.lineTo(leftX, botY);
    ctx.stroke();

    // Draw battery
    drawBattery(leftX, topY + (botY - topY) * 0.3, botY - (botY - topY) * 0.3);

    // Draw resistor
    drawResistor(rStartX, topY, rEndX, topY);

    // Draw ammeter symbol on circuit
    drawAmmeterSymbol(ammStartX, topY, ammEndX, topY);

    // Current direction arrows
    if (current > 0.01) {
      drawCurrentArrow((rStartX + rEndX) / 2, topY - 14, 0);
      drawCurrentArrow(rightX + 12, (topY + botY) / 2, Math.PI / 2);
      drawCurrentArrow((leftX + rightX) / 2, botY + 12, Math.PI);
      drawCurrentArrow(leftX - 12, (topY + botY) / 2, -Math.PI / 2);
    }

    // Labels
    const resistance = current > 0.001 ? batteryVoltage / current : Infinity;
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`R = ${resistance === Infinity ? "\u221E" : resistance.toFixed(1) + "\u03A9"}`, (rStartX + rEndX) / 2, topY + 20);
    ctx.fillText(`V = ${batteryVoltage.toFixed(1)}V`, leftX - 30, (topY + botY) / 2);
    ctx.fillStyle = CHARGE_COLOR;
    ctx.fillText(`I = ${current.toFixed(2)}A`, (ammStartX + ammEndX) / 2, topY + 20);
  }

  function drawBattery(x: number, yTop: number, yBottom: number) {
    const cy = (yTop + yBottom) / 2;
    const gapH = 12;
    const longW = 20;
    const shortW = 12;

    // Positive plate (top)
    ctx.strokeStyle = BATTERY_POS;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - longW / 2, cy - gapH);
    ctx.lineTo(x + longW / 2, cy - gapH);
    ctx.stroke();

    // Negative plate (bottom)
    ctx.strokeStyle = BATTERY_NEG;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - shortW / 2, cy + gapH);
    ctx.lineTo(x + shortW / 2, cy + gapH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = BATTERY_POS;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("+", x + longW / 2 + 10, cy - gapH + 4);
    ctx.fillStyle = BATTERY_NEG;
    ctx.fillText("\u2013", x + shortW / 2 + 10, cy + gapH + 4);
  }

  function drawResistor(x1: number, y1: number, x2: number, y2: number) {
    const len = x2 - x1;
    const zigCount = 6;
    const zigAmplitude = 8;
    const resistorLen = len * 0.6;
    const startX = x1 + (len - resistorLen) / 2;
    const endX = startX + resistorLen;

    // Lead wires
    ctx.strokeStyle = WIRE_HIGHLIGHT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(startX, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(endX, y1);
    ctx.lineTo(x2, y1);
    ctx.stroke();

    // Zigzag
    ctx.strokeStyle = RESISTOR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, y1);
    for (let i = 0; i < zigCount; i++) {
      const px1 = startX + (resistorLen * (i + 0.25)) / zigCount;
      const px2 = startX + (resistorLen * (i + 0.75)) / zigCount;
      const sign = i % 2 === 0 ? -1 : 1;
      ctx.lineTo(px1, y1 + zigAmplitude * sign);
      ctx.lineTo(px2, y1 - zigAmplitude * sign);
    }
    ctx.lineTo(endX, y1);
    ctx.stroke();
  }

  function drawAmmeterSymbol(x1: number, y1: number, x2: number, y2: number) {
    const cx = (x1 + x2) / 2;
    const cy = y1;
    const r = 14;

    // Lead wires
    ctx.strokeStyle = WIRE_HIGHLIGHT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(cx - r, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + r, cy);
    ctx.lineTo(x2, y1);
    ctx.stroke();

    // Circle
    ctx.strokeStyle = CHARGE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(34, 211, 238, 0.1)";
    ctx.fill();

    // "A" letter
    ctx.fillStyle = CHARGE_COLOR;
    ctx.font = "bold 14px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", cx, cy);
  }

  function drawCurrentArrow(x: number, y: number, angle: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawInternalMechanism() {
    // Show internal structure of the ammeter between the circuit and the meter face
    const mechX = width * 0.5;
    const mechY = height * 0.48;
    const mechW = width * 0.35;
    const mechH = height * 0.12;

    // Background box
    ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mechX - mechW / 2, mechY - mechH / 2, mechW, mechH, 6);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("INTERNAL MECHANISM", mechX, mechY - mechH / 2 - 4);

    const centerY = mechY;

    // Draw magnets (N and S poles)
    const magnetW = mechW * 0.08;
    const magnetH = mechH * 0.7;
    const magnetLeftX = mechX - mechW * 0.32;
    const magnetRightX = mechX + mechW * 0.32;

    // North pole (left)
    ctx.fillStyle = MAGNET_N;
    ctx.fillRect(magnetLeftX - magnetW / 2, centerY - magnetH / 2, magnetW, magnetH);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", magnetLeftX, centerY);

    // South pole (right)
    ctx.fillStyle = MAGNET_S;
    ctx.fillRect(magnetRightX - magnetW / 2, centerY - magnetH / 2, magnetW, magnetH);
    ctx.fillStyle = "#fff";
    ctx.fillText("S", magnetRightX, centerY);

    // Draw coil between magnets (deflected based on current)
    const coilW = mechW * 0.35;
    const coilH = mechH * 0.5;
    const deflectAngle = (coilDeflection * Math.PI) / 180;

    ctx.save();
    ctx.translate(mechX, centerY);
    ctx.rotate(deflectAngle);

    // Coil rectangle
    ctx.strokeStyle = COIL_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(-coilW / 2, -coilH / 2, coilW, coilH);

    // Coil windings (horizontal lines inside)
    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
    ctx.lineWidth = 1;
    const numWindings = 4;
    for (let i = 1; i < numWindings; i++) {
      const wy = -coilH / 2 + (coilH * i) / numWindings;
      ctx.beginPath();
      ctx.moveTo(-coilW / 2, wy);
      ctx.lineTo(coilW / 2, wy);
      ctx.stroke();
    }

    ctx.restore();

    // Draw spring (connects coil to frame)
    const springStartX = mechX + coilW / 2 * Math.cos(deflectAngle);
    const springStartY = centerY + coilW / 2 * Math.sin(deflectAngle);
    const springEndX = mechX + mechW * 0.42;
    const springEndY = centerY - mechH * 0.25;

    ctx.strokeStyle = SPRING_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(springStartX, springStartY);

    const springSegments = 8;
    const springAmp = 4;
    for (let i = 1; i <= springSegments; i++) {
      const frac = i / springSegments;
      const sx = springStartX + (springEndX - springStartX) * frac;
      const sy = springStartY + (springEndY - springStartY) * frac;
      const offset = (i % 2 === 0 ? 1 : -1) * springAmp * (1 - Math.abs(frac - 0.5) * 2);
      ctx.lineTo(sx, sy + offset);
    }
    ctx.stroke();

    // Spring label
    ctx.fillStyle = SPRING_COLOR;
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("spring", springEndX + 3, springEndY);

    // Shunt resistor (shown below the coil area)
    const shuntY = centerY + mechH * 0.3;
    const shuntStartX = mechX - mechW * 0.2;
    const shuntEndX = mechX + mechW * 0.2;

    ctx.strokeStyle = SHUNT_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(shuntStartX, shuntY);
    const shuntZigs = 5;
    const shuntAmp = 3;
    for (let i = 0; i < shuntZigs; i++) {
      const fx1 = shuntStartX + ((shuntEndX - shuntStartX) * (i + 0.25)) / shuntZigs;
      const fx2 = shuntStartX + ((shuntEndX - shuntStartX) * (i + 0.75)) / shuntZigs;
      const sign = i % 2 === 0 ? -1 : 1;
      ctx.lineTo(fx1, shuntY + shuntAmp * sign);
      ctx.lineTo(fx2, shuntY - shuntAmp * sign);
    }
    ctx.lineTo(shuntEndX, shuntY);
    ctx.stroke();

    // Shunt label
    ctx.fillStyle = SHUNT_COLOR;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("shunt R", mechX, shuntY + 12);

    // Connection lines from shunt to coil (parallel)
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(shuntStartX, shuntY);
    ctx.lineTo(mechX - coilW / 2, centerY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shuntEndX, shuntY);
    ctx.lineTo(mechX + coilW / 2, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Magnetic field lines (dashed, between magnets)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const numFieldLines = 3;
    for (let i = 0; i < numFieldLines; i++) {
      const fy = centerY - mechH * 0.25 + (mechH * 0.5 * i) / (numFieldLines - 1);
      ctx.beginPath();
      ctx.moveTo(magnetLeftX + magnetW / 2, fy);
      ctx.lineTo(magnetRightX - magnetW / 2, fy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // B-field arrow label
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("B-field \u2192", mechX, centerY - mechH / 2 + 10);
  }

  function drawCharges() {
    for (const charge of charges) {
      const pt = getCircuitPoint(charge.t);
      // Glow
      ctx.fillStyle = CHARGE_GLOW;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fill();
      // Dot
      ctx.fillStyle = CHARGE_COLOR;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInfoPanel() {
    const panelX = 12;
    const panelY = height - 42;
    const panelW = width - 24;
    const panelH = 34;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.stroke();

    const y = panelY + panelH / 2;
    const spacing = panelW / 5;

    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Range
    ctx.fillStyle = "#818cf8";
    ctx.fillText(range === 0 ? "RANGE: 500mA" : "RANGE: 5A", panelX + spacing * 0.5, y);

    // Current reading
    const maxCurrent = range === 0 ? 0.5 : 5;
    const clampedCurrent = Math.min(current, maxCurrent);
    ctx.fillStyle = CHARGE_COLOR;
    if (range === 0) {
      ctx.fillText(`I = ${(clampedCurrent * 1000).toFixed(1)}mA`, panelX + spacing * 1.5, y);
    } else {
      ctx.fillText(`I = ${clampedCurrent.toFixed(2)}A`, panelX + spacing * 1.5, y);
    }

    // Torque equation
    ctx.fillStyle = COIL_COLOR;
    ctx.fillText("\u03B8 = NBIA/k", panelX + spacing * 2.5, y);

    // Battery voltage
    ctx.fillStyle = BATTERY_POS;
    ctx.fillText(`V = ${batteryVoltage.toFixed(1)}V`, panelX + spacing * 3.5, y);

    // Overrange warning
    if (current > maxCurrent) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("OVERRANGE!", panelX + spacing * 4.5, y);
    } else {
      ctx.fillStyle = TEXT_DIM;
      const deflPct = ((clampedCurrent / maxCurrent) * 100).toFixed(0);
      ctx.fillText(`Defl: ${deflPct}%`, panelX + spacing * 4.5, y);
    }
  }

  function drawTitle() {
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Analog Ammeter: Torque = NBIA, balanced by spring k\u03B8", 12, 8);
    ctx.fillText("Shunt R allows large current measurement", 12, 22);
  }

  // ---- Engine interface ----

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      displayNeedle = -80;
      initCharges();
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(params);
      time += dt;

      // Smooth needle animation (exponential ease)
      const needleSpeed = 4.0; // higher = faster response
      displayNeedle += (targetNeedle - displayNeedle) * Math.min(1, needleSpeed * dt);

      // Move charge particles: speed proportional to current
      const speed = (current / 5) * 0.35;
      for (const charge of charges) {
        charge.t += speed * dt;
        if (charge.t > 1) charge.t -= 1;
        if (charge.t < 0) charge.t += 1;
      }
    },

    render() {
      // Clear with dark background
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      // Top half: meter face
      drawMeterFace();

      // Bottom half: circuit and internal mechanism
      if (showInternal) {
        drawInternalMechanism();
      }

      drawCircuit();
      drawCharges();
      drawInfoPanel();
      drawTitle();

      // Overrange red flash
      const maxCurrent = range === 0 ? 0.5 : 5;
      if (current > maxCurrent) {
        const flash = 0.1 + 0.05 * Math.sin(time * 8);
        ctx.fillStyle = `rgba(239, 68, 68, ${flash})`;
        ctx.fillRect(0, 0, width, height);
      }
    },

    reset() {
      time = 0;
      displayNeedle = -80;
      initCharges();
    },

    destroy() {
      // No external resources to clean up
    },

    getStateDescription(): string {
      const maxCurrent = range === 0 ? 0.5 : 5;
      const clampedCurrent = Math.min(current, maxCurrent);
      const deflection = (clampedCurrent / maxCurrent) * 100;
      const overrange = current > maxCurrent;
      const rangeStr = range === 0 ? "500mA" : "5A";

      return (
        `Ammeter simulation: Range=${rangeStr}, Current=${current.toFixed(2)}A, ` +
        `Battery=${batteryVoltage.toFixed(1)}V. ` +
        `Needle deflection=${deflection.toFixed(0)}%. ` +
        `${showInternal ? "Internal mechanism visible: moving coil in magnetic field with shunt resistor." : "Internal mechanism hidden."} ` +
        `${overrange ? "WARNING: Current exceeds selected range!" : ""} ` +
        `Physics: Torque=NBIA balanced by spring torque=k\u03B8. At equilibrium \u03B8 is proportional to current.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default Ammeter;
