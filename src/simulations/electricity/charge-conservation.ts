import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Charge particle ────────────────────────────────────────────────
interface ChargeParticle {
  /** Progress along circuit path, 0..1 */
  t: number;
  /** For parallel: 0 = branch R1, 1 = branch R2 */
  branch: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const ChargeConservationFactory: SimulationFactory = () => {
  const config = getSimConfig("charge-conservation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let circuitType = 0; // 0 = series, 1 = parallel
  let voltage = 3; // V
  let resistance1 = 10; // Ω
  let resistance2 = 10; // Ω

  // Derived
  let totalResistance = 0;
  let totalCurrent = 0;
  let current1 = 0;
  let current2 = 0;

  // Charge particles
  const charges: ChargeParticle[] = [];
  const NUM_CHARGES_SERIES = 20;
  const NUM_CHARGES_PARALLEL = 28;

  function computePhysics() {
    if (circuitType === 0) {
      // Series: R_total = R1 + R2, I same everywhere
      totalResistance = resistance1 + resistance2;
      totalCurrent = voltage / totalResistance;
      current1 = totalCurrent;
      current2 = totalCurrent;
    } else {
      // Parallel: 1/R_total = 1/R1 + 1/R2, currents split
      totalResistance = (resistance1 * resistance2) / (resistance1 + resistance2);
      totalCurrent = voltage / totalResistance;
      current1 = voltage / resistance1;
      current2 = voltage / resistance2;
    }
  }

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

  // ── Circuit geometry ──────────────────────────────────────────────
  function circuitBounds() {
    const margin = 60;
    return {
      left: margin,
      right: W - margin,
      top: margin + 55,
      bottom: H - margin - 100,
      cx: W / 2,
      cy: (margin + 55 + H - margin - 100) / 2,
    };
  }

  function getSeriesPoint(t: number): { x: number; y: number } {
    const b = circuitBounds();
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const perimeter = 2 * w + 2 * h;
    const dist = ((t % 1) + 1) % 1 * perimeter;

    // Left side going up
    if (dist < h) return { x: b.left, y: b.bottom - dist };
    // Top going right
    if (dist < h + w) return { x: b.left + (dist - h), y: b.top };
    // Right side going down
    if (dist < 2 * h + w) return { x: b.right, y: b.top + (dist - h - w) };
    // Bottom going left
    return { x: b.right - (dist - 2 * h - w), y: b.bottom };
  }

  function getParallelPoint(t: number, branch: number): { x: number; y: number } {
    const b = circuitBounds();
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const branchSep = h * 0.28;
    const splitX = b.left + w * 0.3;
    const mergeX = b.left + w * 0.7;
    const branchY = branch === 0 ? b.cy - branchSep : b.cy + branchSep;
    const forkH = Math.abs(branchY - b.top);

    const segments = [h, w * 0.3, forkH, mergeX - splitX, forkH, w * 0.3, h, w];
    const totalLen = segments.reduce((s, v) => s + v, 0);
    let dist = ((t % 1) + 1) % 1 * totalLen;

    // 0: Left side up
    if (dist < segments[0]) return { x: b.left, y: b.bottom - dist };
    dist -= segments[0];
    // 1: Top to split
    if (dist < segments[1]) return { x: b.left + (dist / segments[1]) * (splitX - b.left), y: b.top };
    dist -= segments[1];
    // 2: Fork down to branch
    if (dist < segments[2]) return { x: splitX, y: b.top + (dist / segments[2]) * (branchY - b.top) };
    dist -= segments[2];
    // 3: Branch across
    if (dist < segments[3]) return { x: splitX + (dist / segments[3]) * (mergeX - splitX), y: branchY };
    dist -= segments[3];
    // 4: Fork back up
    if (dist < segments[4]) return { x: mergeX, y: branchY + (dist / segments[4]) * (b.top - branchY) };
    dist -= segments[4];
    // 5: Merge to right
    if (dist < segments[5]) return { x: mergeX + (dist / segments[5]) * (b.right - mergeX), y: b.top };
    dist -= segments[5];
    // 6: Right side down
    if (dist < segments[6]) return { x: b.right, y: b.top + (dist / segments[6]) * h };
    dist -= segments[6];
    // 7: Bottom left
    const frac = Math.min(dist / segments[7], 1);
    return { x: b.right - frac * w, y: b.bottom };
  }

  // ── Drawing helpers ───────────────────────────────────────────────

  function drawBattery(x: number, yTop: number, yBot: number) {
    const cy = (yTop + yBot) / 2;
    const gap = 16;

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, cy - gap); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, cy + gap); ctx.lineTo(x, yBot); ctx.stroke();

    // Positive plate
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 12, cy - gap); ctx.lineTo(x + 12, cy - gap); ctx.stroke();

    // Negative plate
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - 8, cy + gap); ctx.lineTo(x + 8, cy + gap); ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", x, cy - gap - 8);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("-", x, cy + gap + 16);

    // Voltage label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillText(`${voltage}V`, x - 28, cy + 4);
  }

  function drawResistorZigzag(
    x1: number, y1: number,
    x2: number, y2: number,
    label: string, valueStr: string
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;

    const zigCount = 6;
    const zigAmp = 10;
    const rLen = Math.min(len * 0.6, 60);
    const start = (len - rLen) / 2;
    const end = start + rLen;

    // Wire to resistor
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * start, y1 + uy * start);
    ctx.stroke();

    // Zigzag
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const sx = x1 + ux * start;
    const sy = y1 + uy * start;
    ctx.moveTo(sx, sy);
    for (let i = 0; i < zigCount; i++) {
      const f1 = (i + 0.25) / zigCount;
      const f2 = (i + 0.75) / zigCount;
      const sign = i % 2 === 0 ? 1 : -1;
      ctx.lineTo(sx + ux * rLen * f1 + px * zigAmp * sign, sy + uy * rLen * f1 + py * zigAmp * sign);
      ctx.lineTo(sx + ux * rLen * f2 - px * zigAmp * sign, sy + uy * rLen * f2 - py * zigAmp * sign);
    }
    const ex = x1 + ux * end;
    const ey = y1 + uy * end;
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Wire from resistor
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Labels
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, mx + px * 22, my + py * 22);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillText(valueStr, mx + px * 36, my + py * 36);
  }

  function drawAmmeterReading(x: number, y: number, label: string, currentVal: number, highlight: boolean) {
    const r = 22;
    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = highlight ? "rgba(34, 211, 238, 0.15)" : "rgba(15, 23, 42, 0.8)";
    ctx.fill();
    ctx.strokeStyle = highlight ? "#22d3ee" : "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    // "A" symbol
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("A", x, y - 2);

    // Current value
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillText(`${currentVal.toFixed(3)}A`, x, y + 14);

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillText(label, x, y - r - 6);
  }

  function drawChargeParticle(x: number, y: number) {
    ctx.fillStyle = "rgba(34, 211, 238, 0.3)";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSeriesCircuit() {
    const b = circuitBounds();
    const w = b.right - b.left;

    // Wires
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.beginPath(); ctx.moveTo(b.left, b.top); ctx.lineTo(b.right, b.top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.right, b.top); ctx.lineTo(b.right, b.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.right, b.bottom); ctx.lineTo(b.left, b.bottom); ctx.stroke();

    drawBattery(b.left, b.top, b.bottom);

    // Resistors on top wire
    const r1s = b.left + w * 0.18;
    const r1e = b.left + w * 0.42;
    const r2s = b.left + w * 0.58;
    const r2e = b.left + w * 0.82;
    drawResistorZigzag(r1s, b.top, r1e, b.top, "R\u2081", `${resistance1}\u03A9`);
    drawResistorZigzag(r2s, b.top, r2e, b.top, "R\u2082", `${resistance2}\u03A9`);

    // Ammeter readings
    drawAmmeterReading(b.left + w * 0.09, b.top, "A\u2081 (before R\u2081)", totalCurrent, true);
    drawAmmeterReading(b.left + w * 0.50, b.top + 45, "A\u2082 (between)", totalCurrent, true);
    drawAmmeterReading(b.left + w * 0.91, b.top, "A\u2083 (after R\u2082)", totalCurrent, true);

    // Current arrows
    ctx.fillStyle = "#34d399";
    const arrowY = b.top - 18;
    for (const ax of [b.left + w * 0.15, b.left + w * 0.50, b.left + w * 0.85]) {
      ctx.save();
      ctx.translate(ax, arrowY);
      ctx.beginPath();
      ctx.moveTo(7, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParallelCircuit() {
    const b = circuitBounds();
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    const branchSep = h * 0.28;
    const splitX = b.left + w * 0.3;
    const mergeX = b.left + w * 0.7;
    const by1 = b.cy - branchSep;
    const by2 = b.cy + branchSep;

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    // Top wire segments
    ctx.beginPath(); ctx.moveTo(b.left, b.top); ctx.lineTo(splitX, b.top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mergeX, b.top); ctx.lineTo(b.right, b.top); ctx.stroke();

    // Fork wires
    ctx.beginPath(); ctx.moveTo(splitX, b.top); ctx.lineTo(splitX, by1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(splitX, b.top); ctx.lineTo(splitX, by2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mergeX, by1); ctx.lineTo(mergeX, b.top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mergeX, by2); ctx.lineTo(mergeX, b.top); ctx.stroke();

    // Right side and bottom
    ctx.beginPath(); ctx.moveTo(b.right, b.top); ctx.lineTo(b.right, b.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.right, b.bottom); ctx.lineTo(b.left, b.bottom); ctx.stroke();

    drawBattery(b.left, b.top, b.bottom);

    // Resistors on branches
    drawResistorZigzag(splitX, by1, mergeX, by1, "R\u2081", `${resistance1}\u03A9`);
    drawResistorZigzag(splitX, by2, mergeX, by2, "R\u2082", `${resistance2}\u03A9`);

    // Ammeter readings: total before split, branch 1, branch 2, total after merge
    drawAmmeterReading(b.left + w * 0.15, b.top, "A (total)", totalCurrent, true);
    drawAmmeterReading((splitX + mergeX) / 2, by1 - 35, "A\u2081 (branch 1)", current1, false);
    drawAmmeterReading((splitX + mergeX) / 2, by2 + 35, "A\u2082 (branch 2)", current2, false);
    drawAmmeterReading(b.left + w * 0.85, b.top, "A (total)", totalCurrent, true);

    // Kirchhoff label
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `I_{total} = I\u2081 + I\u2082 = ${current1.toFixed(3)} + ${current2.toFixed(3)} = ${totalCurrent.toFixed(3)} A`,
      W / 2, b.bottom + 30
    );
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      computePhysics();
      initCharges();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const prevType = circuitType;

      circuitType = Math.round(params.circuitType ?? circuitType);
      voltage = params.voltage ?? voltage;
      resistance1 = params.resistance1 ?? resistance1;
      resistance2 = params.resistance2 ?? resistance2;

      computePhysics();

      if (prevType !== circuitType) {
        initCharges();
      }

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      // Move charges proportional to current
      const maxCurrent = 12 / 5; // max voltage / min resistance
      const speedFactor = (totalCurrent / maxCurrent) * 0.4;

      for (const ch of charges) {
        if (circuitType === 1) {
          // In parallel, each branch has different speed proportional to its current
          const branchCurrent = ch.branch === 0 ? current1 : current2;
          const branchSpeed = (branchCurrent / maxCurrent) * 0.4;
          ch.t += branchSpeed * dtClamped;
        } else {
          ch.t += speedFactor * dtClamped;
        }
        if (ch.t > 1) ch.t -= 1;
      }
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Charge Conservation in Circuits", W / 2, 28);

      // Subtitle
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      if (circuitType === 0) {
        ctx.fillText(
          "Series Circuit: I_{total} = I\u2081 = I\u2082  (current is the same everywhere)",
          W / 2, 46
        );
      } else {
        ctx.fillText(
          "Parallel Circuit: I_{total} = I\u2081 + I\u2082  (current splits at branches)",
          W / 2, 46
        );
      }

      // Draw circuit
      if (circuitType === 0) {
        drawSeriesCircuit();
      } else {
        drawParallelCircuit();
      }

      // Draw charge particles
      for (const ch of charges) {
        let pt: { x: number; y: number };
        if (circuitType === 0) {
          pt = getSeriesPoint(ch.t);
        } else {
          pt = getParallelPoint(ch.t, ch.branch);
        }
        drawChargeParticle(pt.x, pt.y);
      }

      // Info panel
      const panelY = H - 95;
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fillRect(12, panelY, W - 24, 85);
      ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(12, panelY, W - 24, 85);

      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#818cf8";
      ctx.fillText(circuitType === 0 ? "Mode: SERIES" : "Mode: PARALLEL", 24, panelY + 18);

      ctx.fillStyle = "#ef4444";
      ctx.fillText(`V = ${voltage} V`, 180, panelY + 18);

      ctx.fillStyle = "#f59e0b";
      ctx.fillText(`R\u2081 = ${resistance1} \u03A9,  R\u2082 = ${resistance2} \u03A9`, 280, panelY + 18);

      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`I_{total} = V / R_{total} = ${voltage} / ${totalResistance.toFixed(2)} = ${totalCurrent.toFixed(3)} A`, 24, panelY + 38);

      if (circuitType === 0) {
        ctx.fillStyle = "#34d399";
        ctx.fillText(
          `R_{total} = R\u2081 + R\u2082 = ${resistance1} + ${resistance2} = ${totalResistance.toFixed(1)} \u03A9`,
          24, panelY + 56
        );
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(
          `Conservation: I\u2081 = I\u2082 = I_{total} = ${totalCurrent.toFixed(3)} A  (current is conserved in series)`,
          24, panelY + 74
        );
      } else {
        ctx.fillStyle = "#34d399";
        ctx.fillText(
          `R_{total} = (R\u2081\u00D7R\u2082)/(R\u2081+R\u2082) = ${totalResistance.toFixed(2)} \u03A9`,
          24, panelY + 56
        );
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(
          `Conservation: I\u2081 + I\u2082 = ${current1.toFixed(3)} + ${current2.toFixed(3)} = ${totalCurrent.toFixed(3)} A = I_{total}`,
          24, panelY + 74
        );
      }

      // Time
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 4);
    },

    reset() {
      circuitType = config.parameters.find((p) => p.key === "circuitType")!.defaultValue;
      voltage = config.parameters.find((p) => p.key === "voltage")!.defaultValue;
      resistance1 = config.parameters.find((p) => p.key === "resistance1")!.defaultValue;
      resistance2 = config.parameters.find((p) => p.key === "resistance2")!.defaultValue;
      computePhysics();
      initCharges();
      time = 0;
    },

    destroy() {
      charges.length = 0;
    },

    getStateDescription(): string {
      const typeStr = circuitType === 0 ? "Series" : "Parallel";
      if (circuitType === 0) {
        return (
          `Charge Conservation simulation: ${typeStr} circuit. ` +
          `V=${voltage} V, R\u2081=${resistance1} \u03A9, R\u2082=${resistance2} \u03A9. ` +
          `R_total = R\u2081 + R\u2082 = ${totalResistance.toFixed(1)} \u03A9. ` +
          `I_total = V/R = ${totalCurrent.toFixed(3)} A. ` +
          `In a series circuit, current is the same at every point: I\u2081 = I\u2082 = I_total = ${totalCurrent.toFixed(3)} A. ` +
          `Charge is conserved — no charge is created or destroyed.`
        );
      }
      return (
        `Charge Conservation simulation: ${typeStr} circuit. ` +
        `V=${voltage} V, R\u2081=${resistance1} \u03A9, R\u2082=${resistance2} \u03A9. ` +
        `R_total = ${totalResistance.toFixed(2)} \u03A9. ` +
        `I_total = ${totalCurrent.toFixed(3)} A. ` +
        `Current splits: I\u2081 = ${current1.toFixed(3)} A, I\u2082 = ${current2.toFixed(3)} A. ` +
        `I\u2081 + I\u2082 = ${totalCurrent.toFixed(3)} A = I_total. Charge is conserved at junctions (Kirchhoff's Current Law).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default ChargeConservationFactory;
