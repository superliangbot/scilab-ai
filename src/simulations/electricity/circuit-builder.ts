import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface Charge {
  /** Progress along the circuit path, 0..1 */
  t: number;
  /** For parallel circuits: which branch (0 = branch with R1, 1 = branch with R2) */
  branch: number;
}

const CircuitBuilder: SimulationFactory = () => {
  const config = getSimConfig("circuit-builder")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let voltage = 9;
  let resistance1 = 10;
  let resistance2 = 20;
  let circuitType = 0; // 0 = series, 1 = parallel
  let totalResistance = 0;
  let current = 0;
  let power = 0;
  let vDrop1 = 0;
  let vDrop2 = 0;

  // Animation
  let time = 0;
  const charges: Charge[] = [];
  const NUM_CHARGES_SERIES = 18;
  const NUM_CHARGES_PARALLEL = 24;

  // Colors
  const BG_COLOR = "#0f172a";
  const WIRE_COLOR = "#475569";
  const WIRE_HIGHLIGHT = "#64748b";
  const BATTERY_POS = "#ef4444";
  const BATTERY_NEG = "#3b82f6";
  const RESISTOR_COLOR = "#f59e0b";
  const CHARGE_COLOR = "#22d3ee";
  const CHARGE_GLOW = "rgba(34, 211, 238, 0.3)";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#94a3b8";
  const ARROW_COLOR = "#34d399";

  function initCharges() {
    charges.length = 0;
    const n = circuitType === 0 ? NUM_CHARGES_SERIES : NUM_CHARGES_PARALLEL;
    for (let i = 0; i < n; i++) {
      charges.push({
        t: i / n,
        branch: circuitType === 1 ? (i % 2) : 0,
      });
    }
  }

  function computePhysics(params: Record<string, number>) {
    voltage = params.voltage ?? voltage;
    resistance1 = params.resistance1 ?? resistance1;
    resistance2 = params.resistance2 ?? resistance2;
    circuitType = params.circuitType !== undefined ? Math.round(params.circuitType) : circuitType;

    if (circuitType === 0) {
      // Series
      totalResistance = resistance1 + resistance2;
    } else {
      // Parallel
      totalResistance = (resistance1 * resistance2) / (resistance1 + resistance2);
    }

    current = voltage / totalResistance;
    power = voltage * current;

    if (circuitType === 0) {
      // Series: voltage divides proportionally
      vDrop1 = current * resistance1;
      vDrop2 = current * resistance2;
    } else {
      // Parallel: same voltage across both
      vDrop1 = voltage;
      vDrop2 = voltage;
    }
  }

  // --- Path definitions for series and parallel circuits ---
  // All coordinates are in normalized space, mapped to canvas later.
  // The circuit is centered in the canvas.

  function getCircuitBounds() {
    const margin = 60;
    const left = margin;
    const right = width - margin;
    const top = margin + 40;
    const bottom = height - margin - 60;
    return { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
  }

  /** Returns a point along the series circuit path, t in [0,1] */
  function getSeriesPoint(t: number): { x: number; y: number } {
    const b = getCircuitBounds();
    const w = b.right - b.left;
    const h = b.bottom - b.top;

    // Path segments and their proportional lengths:
    // 0.00-0.10: Battery (left side, bottom to top)
    // 0.10-0.35: Top wire left to R1
    // 0.35-0.45: R1 (zigzag)
    // 0.45-0.55: Wire between R1 and R2
    // 0.55-0.65: R2 (zigzag)
    // 0.65-0.90: Top wire R2 to right, then right side down
    // 0.90-1.00: Bottom wire right to left (back to battery)

    // Simplified rectangular path:
    // Left side (battery): bottom-left to top-left
    // Top wire: top-left to top-right (with R1 and R2 inline)
    // Right side: top-right to bottom-right
    // Bottom wire: bottom-right to bottom-left

    const perimeter = 2 * w + 2 * h;
    const dist = t * perimeter;

    // Left side going up
    if (dist < h) {
      return { x: b.left, y: b.bottom - dist };
    }
    // Top going right
    if (dist < h + w) {
      return { x: b.left + (dist - h), y: b.top };
    }
    // Right side going down
    if (dist < h + w + h) {
      return { x: b.right, y: b.top + (dist - h - w) };
    }
    // Bottom going left
    return { x: b.right - (dist - 2 * h - w), y: b.bottom };
  }

  /** Returns a point along a parallel circuit path */
  function getParallelPoint(t: number, branch: number): { x: number; y: number } {
    const b = getCircuitBounds();
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const branchSep = h * 0.3; // vertical separation of branches from center

    // Parallel path:
    // 0.00-0.12: Battery (left side, bottom to top)
    // 0.12-0.20: Wire from top-left to split point
    // 0.20-0.50: branch path (top or bottom) with resistor
    // 0.50-0.58: Wire from merge to top-right
    // 0.58-0.80: Right side down
    // 0.80-1.00: Bottom wire back

    const splitX = b.left + w * 0.3;
    const mergeX = b.left + w * 0.7;
    const branchY = branch === 0 ? b.cy - branchSep : b.cy + branchSep;

    // Simplified: left up, across top-left, branch (fork down/up, across, fork back), across top-right, right down, bottom across
    const segments = [
      { len: h, name: "left-up" },           // 0
      { len: w * 0.3, name: "top-to-split" }, // 1
      { len: branchSep + (b.top - b.cy + branchSep < 0 ? b.cy - b.top : branchSep), name: "fork-down" }, // 2
      { len: mergeX - splitX, name: "branch-across" }, // 3
      { len: branchSep + (b.top - b.cy + branchSep < 0 ? b.cy - b.top : branchSep), name: "fork-up" }, // 4
      { len: w * 0.3, name: "merge-to-right" }, // 5
      { len: h, name: "right-down" },          // 6
      { len: w, name: "bottom-across" },        // 7
    ];

    // Recalculate actual segment lengths for consistent perimeter
    const totalLen = segments.reduce((s, seg) => s + seg.len, 0);
    let dist = t * totalLen;

    // Segment 0: Left side going up
    if (dist < segments[0].len) {
      const frac = dist / segments[0].len;
      return { x: b.left, y: b.bottom - frac * h };
    }
    dist -= segments[0].len;

    // Segment 1: Top to split point
    if (dist < segments[1].len) {
      const frac = dist / segments[1].len;
      return { x: b.left + frac * (splitX - b.left), y: b.top };
    }
    dist -= segments[1].len;

    // Segment 2: Fork from split to branch y
    if (dist < segments[2].len) {
      const frac = dist / segments[2].len;
      return { x: splitX, y: b.top + frac * (branchY - b.top) };
    }
    dist -= segments[2].len;

    // Segment 3: Branch across (with resistor in middle)
    if (dist < segments[3].len) {
      const frac = dist / segments[3].len;
      return { x: splitX + frac * (mergeX - splitX), y: branchY };
    }
    dist -= segments[3].len;

    // Segment 4: Fork from branch y back to top
    if (dist < segments[4].len) {
      const frac = dist / segments[4].len;
      return { x: mergeX, y: branchY + frac * (b.top - branchY) };
    }
    dist -= segments[4].len;

    // Segment 5: Merge to right
    if (dist < segments[5].len) {
      const frac = dist / segments[5].len;
      return { x: mergeX + frac * (b.right - mergeX), y: b.top };
    }
    dist -= segments[5].len;

    // Segment 6: Right side going down
    if (dist < segments[6].len) {
      const frac = dist / segments[6].len;
      return { x: b.right, y: b.top + frac * h };
    }
    dist -= segments[6].len;

    // Segment 7: Bottom going left
    const frac = Math.min(dist / segments[7].len, 1);
    return { x: b.right - frac * w, y: b.bottom };
  }

  // --- Drawing helpers ---

  function drawBattery(x: number, yTop: number, yBottom: number) {
    const cy = (yTop + yBottom) / 2;
    const gapH = 18;
    const longW = 24;
    const shortW = 14;

    // Wires to battery
    ctx.strokeStyle = WIRE_HIGHLIGHT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x, cy - gapH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, cy + gapH);
    ctx.lineTo(x, yBottom);
    ctx.stroke();

    // Positive plate (longer, thinner, top)
    ctx.strokeStyle = BATTERY_POS;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - longW / 2, cy - gapH);
    ctx.lineTo(x + longW / 2, cy - gapH);
    ctx.stroke();

    // Negative plate (shorter, thicker, bottom)
    ctx.strokeStyle = BATTERY_NEG;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - shortW / 2, cy + gapH);
    ctx.lineTo(x + shortW / 2, cy + gapH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = BATTERY_POS;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("+", x, cy - gapH - 8);
    ctx.fillStyle = BATTERY_NEG;
    ctx.fillText("-", x, cy + gapH + 18);
  }

  function drawResistorZigzag(x1: number, y1: number, x2: number, y2: number, label: string, value: string) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;
    // Perpendicular
    const px = -uy;
    const py = ux;

    const zigCount = 6;
    const zigAmplitude = 10;
    const resistorLen = Math.min(len * 0.6, 60);
    const startFrac = (len - resistorLen) / 2;
    const endFrac = startFrac + resistorLen;

    ctx.strokeStyle = WIRE_HIGHLIGHT;
    ctx.lineWidth = 3;

    // Wire to start of zigzag
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * startFrac, y1 + uy * startFrac);
    ctx.stroke();

    // Zigzag
    ctx.strokeStyle = RESISTOR_COLOR;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const sx = x1 + ux * startFrac;
    const sy = y1 + uy * startFrac;
    ctx.moveTo(sx, sy);

    for (let i = 0; i < zigCount; i++) {
      const frac1 = (i + 0.25) / zigCount;
      const frac2 = (i + 0.75) / zigCount;
      const frac3 = (i + 1) / zigCount;
      const sign = i % 2 === 0 ? 1 : -1;

      ctx.lineTo(
        sx + ux * resistorLen * frac1 + px * zigAmplitude * sign,
        sy + uy * resistorLen * frac1 + py * zigAmplitude * sign
      );
      ctx.lineTo(
        sx + ux * resistorLen * frac2 - px * zigAmplitude * sign,
        sy + uy * resistorLen * frac2 - py * zigAmplitude * sign
      );
      if (i < zigCount - 1) {
        ctx.lineTo(
          sx + ux * resistorLen * frac3 + px * zigAmplitude * (i % 2 === 0 ? -1 : 1),
          sy + uy * resistorLen * frac3 + py * zigAmplitude * (i % 2 === 0 ? -1 : 1)
        );
      }
    }

    const ex = x1 + ux * endFrac;
    const ey = y1 + uy * endFrac;
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Wire from end of zigzag
    ctx.strokeStyle = WIRE_HIGHLIGHT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Label
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Offset label perpendicular to the wire
    const labelOffset = 22;
    ctx.fillText(label, midX + px * labelOffset, midY + py * labelOffset);
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "12px monospace";
    ctx.fillText(value, midX + px * (labelOffset + 16), midY + py * (labelOffset + 16));
  }

  function drawArrow(x: number, y: number, angle: number, size: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = ARROW_COLOR;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.5, -size * 0.5);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(-size * 0.5, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCharge(x: number, y: number) {
    // Glow
    ctx.fillStyle = CHARGE_GLOW;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    // Dot
    ctx.fillStyle = CHARGE_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSeriesCircuit() {
    const b = getCircuitBounds();
    const w = b.right - b.left;
    const h = b.bottom - b.top;

    // Draw wires (the full rectangular loop)
    ctx.strokeStyle = WIRE_COLOR;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Left side wire (battery segment handled by drawBattery)
    // Top wire
    ctx.beginPath();
    ctx.moveTo(b.left, b.top);
    ctx.lineTo(b.right, b.top);
    ctx.stroke();

    // Right side wire
    ctx.beginPath();
    ctx.moveTo(b.right, b.top);
    ctx.lineTo(b.right, b.bottom);
    ctx.stroke();

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(b.right, b.bottom);
    ctx.lineTo(b.left, b.bottom);
    ctx.stroke();

    // Battery on left side
    drawBattery(b.left, b.top, b.bottom);

    // Two resistors on top wire in series
    const r1Start = b.left + w * 0.2;
    const r1End = b.left + w * 0.45;
    const r2Start = b.left + w * 0.55;
    const r2End = b.left + w * 0.8;

    drawResistorZigzag(r1Start, b.top, r1End, b.top, "R1", `${resistance1}\u03A9`);
    drawResistorZigzag(r2Start, b.top, r2End, b.top, "R2", `${resistance2}\u03A9`);

    // Voltage drop labels below each resistor
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`V = ${vDrop1.toFixed(2)}V`, (r1Start + r1End) / 2, b.top + 52);
    ctx.fillText(`V = ${vDrop2.toFixed(2)}V`, (r2Start + r2End) / 2, b.top + 52);

    // Current direction arrows on the wire
    // Top wire (left to right = conventional current from + terminal)
    drawArrow(b.left + w * 0.1, b.top - 12, 0, 8);
    drawArrow(b.left + w * 0.5, b.top - 12, 0, 8);
    drawArrow(b.left + w * 0.9, b.top - 12, 0, 8);
    // Right side (top to bottom)
    drawArrow(b.right + 12, b.top + h * 0.5, Math.PI / 2, 8);
    // Bottom wire (right to left)
    drawArrow(b.left + w * 0.5, b.bottom + 12, Math.PI, 8);
    // Left side (bottom to top, through battery)
    drawArrow(b.left - 12, b.top + h * 0.2, -Math.PI / 2, 8);
  }

  function drawParallelCircuit() {
    const b = getCircuitBounds();
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const branchSep = h * 0.3;
    const splitX = b.left + w * 0.3;
    const mergeX = b.left + w * 0.7;
    const branchY1 = b.cy - branchSep;
    const branchY2 = b.cy + branchSep;

    ctx.strokeStyle = WIRE_COLOR;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Top wire: left to split
    ctx.beginPath();
    ctx.moveTo(b.left, b.top);
    ctx.lineTo(splitX, b.top);
    ctx.stroke();

    // Split down to branch 1 (upper)
    ctx.beginPath();
    ctx.moveTo(splitX, b.top);
    ctx.lineTo(splitX, branchY1);
    ctx.stroke();

    // Split down to branch 2 (lower)
    ctx.beginPath();
    ctx.moveTo(splitX, b.top);
    ctx.lineTo(splitX, branchY2);
    ctx.stroke();

    // Branch 1 horizontal (drawn by resistor)
    // Branch 2 horizontal (drawn by resistor)

    // Merge from branch 1 back up
    ctx.beginPath();
    ctx.moveTo(mergeX, branchY1);
    ctx.lineTo(mergeX, b.top);
    ctx.stroke();

    // Merge from branch 2 back up
    ctx.beginPath();
    ctx.moveTo(mergeX, branchY2);
    ctx.lineTo(mergeX, b.top);
    ctx.stroke();

    // Top wire: merge to right
    ctx.beginPath();
    ctx.moveTo(mergeX, b.top);
    ctx.lineTo(b.right, b.top);
    ctx.stroke();

    // Right side wire
    ctx.beginPath();
    ctx.moveTo(b.right, b.top);
    ctx.lineTo(b.right, b.bottom);
    ctx.stroke();

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(b.right, b.bottom);
    ctx.lineTo(b.left, b.bottom);
    ctx.stroke();

    // Battery on left side
    drawBattery(b.left, b.top, b.bottom);

    // Resistors on each branch
    drawResistorZigzag(splitX, branchY1, mergeX, branchY1, "R1", `${resistance1}\u03A9`);
    drawResistorZigzag(splitX, branchY2, mergeX, branchY2, "R2", `${resistance2}\u03A9`);

    // Current labels on branches
    const i1 = voltage / resistance1;
    const i2 = voltage / resistance2;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`I = ${i1.toFixed(2)}A`, (splitX + mergeX) / 2, branchY1 - 28);
    ctx.fillText(`I = ${i2.toFixed(2)}A`, (splitX + mergeX) / 2, branchY2 - 28);

    // Current direction arrows
    drawArrow(b.left + w * 0.15, b.top - 12, 0, 8);
    drawArrow(b.left + w * 0.85, b.top - 12, 0, 8);
    drawArrow(b.right + 12, b.cy, Math.PI / 2, 8);
    drawArrow(b.left + w * 0.5, b.bottom + 12, Math.PI, 8);
    drawArrow(b.left - 12, b.cy - h * 0.2, -Math.PI / 2, 8);

    // Arrows on branches
    drawArrow((splitX + mergeX) / 2 - 40, branchY1 - 8, 0, 6);
    drawArrow((splitX + mergeX) / 2 - 40, branchY2 - 8, 0, 6);
  }

  function drawInfoPanel() {
    const panelX = 16;
    const panelY = height - 52;
    const panelW = width - 32;
    const panelH = 44;

    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();

    ctx.font = "13px monospace";
    ctx.textBaseline = "middle";
    const y = panelY + panelH / 2;
    const spacing = panelW / 5;

    // Circuit type label
    ctx.fillStyle = "#818cf8";
    ctx.textAlign = "center";
    ctx.fillText(circuitType === 0 ? "SERIES" : "PARALLEL", panelX + spacing * 0.5, y);

    // R total
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`R\u209C = ${totalResistance.toFixed(2)}\u03A9`, panelX + spacing * 1.5, y);

    // Current
    ctx.fillStyle = CHARGE_COLOR;
    ctx.fillText(`I = ${current.toFixed(3)}A`, panelX + spacing * 2.5, y);

    // Power
    ctx.fillStyle = "#f472b6";
    ctx.fillText(`P = ${power.toFixed(2)}W`, panelX + spacing * 3.5, y);

    // Voltage
    ctx.fillStyle = BATTERY_POS;
    ctx.fillText(`V = ${voltage.toFixed(1)}V`, panelX + spacing * 4.5, y);
  }

  function drawTitle() {
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Ohm's Law: V = IR", 16, 12);

    if (circuitType === 0) {
      ctx.fillText("Series: R\u209C = R\u2081 + R\u2082", 16, 28);
    } else {
      ctx.fillText("Parallel: 1/R\u209C = 1/R\u2081 + 1/R\u2082", 16, 28);
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initCharges();
    },

    update(dt: number, params: Record<string, number>) {
      const prevType = circuitType;
      computePhysics(params);

      // Re-initialize charges if circuit type changed
      if (Math.round(prevType) !== Math.round(circuitType)) {
        initCharges();
      }

      time += dt;

      // Move charges: speed proportional to current
      // Normalize speed so max current (~24A) gives a reasonable visual speed
      const speed = (current / 24) * 0.4;

      for (const charge of charges) {
        charge.t += speed * dt;
        if (charge.t > 1) charge.t -= 1;
        if (charge.t < 0) charge.t += 1;
      }
    },

    render() {
      // Clear
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      // Draw circuit
      if (circuitType === 0) {
        drawSeriesCircuit();
      } else {
        drawParallelCircuit();
      }

      // Draw animated charges
      for (const charge of charges) {
        let pt: { x: number; y: number };
        if (circuitType === 0) {
          pt = getSeriesPoint(charge.t);
        } else {
          pt = getParallelPoint(charge.t, charge.branch);
        }
        drawCharge(pt.x, pt.y);
      }

      // Info panel
      drawInfoPanel();
      drawTitle();
    },

    reset() {
      time = 0;
      initCharges();
    },

    destroy() {
      // No external resources to clean up
    },

    getStateDescription(): string {
      const typeStr = circuitType === 0 ? "series" : "parallel";
      return (
        `Circuit Builder: ${typeStr} circuit with V=${voltage}V, R1=${resistance1}\u03A9, R2=${resistance2}\u03A9. ` +
        `Total resistance=${totalResistance.toFixed(2)}\u03A9, Current=${current.toFixed(3)}A, ` +
        `Power=${power.toFixed(2)}W. Voltage drops: V1=${vDrop1.toFixed(2)}V, V2=${vDrop2.toFixed(2)}V.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default CircuitBuilder;
