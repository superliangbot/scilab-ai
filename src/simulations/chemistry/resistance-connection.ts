import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ResistanceConnectionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("resistance-connection") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let voltage = 9;
  let resistance1 = 10;
  let resistance2 = 20;
  let connectionType = 0; // 0 = series, 1 = parallel

  // Computed values
  let totalResistance = 0;
  let totalCurrent = 0;
  let voltageR1 = 0;
  let voltageR2 = 0;
  let currentR1 = 0;
  let currentR2 = 0;

  interface FlowDot { progress: number; path: number; speed: number; }
  let flowDots: FlowDot[] = [];
  const NUM_DOTS = 20;

  function computeCircuit(): void {
    if (connectionType === 0) {
      // Series
      totalResistance = resistance1 + resistance2;
      totalCurrent = voltage / totalResistance;
      currentR1 = totalCurrent;
      currentR2 = totalCurrent;
      voltageR1 = totalCurrent * resistance1;
      voltageR2 = totalCurrent * resistance2;
    } else {
      // Parallel
      totalResistance = (resistance1 * resistance2) / (resistance1 + resistance2);
      totalCurrent = voltage / totalResistance;
      currentR1 = voltage / resistance1;
      currentR2 = voltage / resistance2;
      voltageR1 = voltage;
      voltageR2 = voltage;
    }
  }

  function initDots(): void {
    flowDots = [];
    for (let i = 0; i < NUM_DOTS; i++) {
      if (connectionType === 0) {
        flowDots.push({ progress: i / NUM_DOTS, path: 0, speed: 1 });
      } else {
        // Distribute dots between branches proportional to current
        const branch = Math.random() < currentR1 / totalCurrent ? 1 : 2;
        flowDots.push({ progress: i / NUM_DOTS, path: branch, speed: 1 });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeCircuit();
    initDots();
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 9;
    resistance1 = params.resistance1 ?? 10;
    resistance2 = params.resistance2 ?? 20;
    const newType = Math.round(params.connectionType ?? 0);

    if (newType !== connectionType) {
      connectionType = newType;
      computeCircuit();
      initDots();
    } else {
      computeCircuit();
    }

    time += dt;

    // Animate flow dots
    const dotSpeed = totalCurrent * 0.02;
    for (const dot of flowDots) {
      dot.progress += dt * dotSpeed * 0.5;
      if (dot.progress > 1) dot.progress -= 1;
      if (dot.progress < 0) dot.progress += 1;
    }
  }

  // Circuit path helpers
  function getSeriesPath(progress: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height / 2;
    const w = width * 0.35;
    const h = height * 0.3;

    // Path: bottom-left -> left -> top-left -> R1 -> top-right -> R2 -> right -> bottom-right -> battery -> bottom-left
    const segments = [
      { x: cx - w, y: cy + h }, // 0: bottom-left
      { x: cx - w, y: cy - h }, // 1: top-left
      { x: cx - w * 0.3, y: cy - h }, // 2: before R1
      { x: cx + w * 0.3, y: cy - h }, // 3: after R1, before R2 area
      { x: cx + w, y: cy - h }, // 4: top-right
      { x: cx + w, y: cy + h }, // 5: bottom-right
      { x: cx - w, y: cy + h }, // 6: back to start (battery at bottom)
    ];

    const numSeg = segments.length - 1;
    const segIdx = Math.floor(progress * numSeg);
    const segT = (progress * numSeg) - segIdx;
    const s = segments[segIdx];
    const e = segments[Math.min(segIdx + 1, numSeg)];

    return { x: s.x + (e.x - s.x) * segT, y: s.y + (e.y - s.y) * segT };
  }

  function getParallelPath(progress: number, branch: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height / 2;
    const w = width * 0.35;
    const h = height * 0.3;
    const branchOffset = height * 0.1;

    const yOff = branch === 1 ? -branchOffset : branchOffset;

    const segments = [
      { x: cx - w, y: cy + h },     // bottom-left (battery)
      { x: cx - w, y: cy },          // left junction
      { x: cx - w, y: cy + yOff },   // branch start
      { x: cx - w * 0.3, y: cy + yOff }, // before R
      { x: cx + w * 0.3, y: cy + yOff }, // after R
      { x: cx + w, y: cy + yOff },   // branch end
      { x: cx + w, y: cy },          // right junction
      { x: cx + w, y: cy + h },      // bottom-right
      { x: cx - w, y: cy + h },      // back to battery
    ];

    const numSeg = segments.length - 1;
    const segIdx = Math.floor(progress * numSeg);
    const segT = (progress * numSeg) - segIdx;
    const s = segments[segIdx];
    const e = segments[Math.min(segIdx + 1, numSeg)];

    return { x: s.x + (e.x - s.x) * segT, y: s.y + (e.y - s.y) * segT };
  }

  function drawBattery(x: number, y: number): void {
    // Battery symbol
    const bw = 20;
    const bh = 30;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;

    // Long plate (positive)
    ctx.beginPath();
    ctx.moveTo(x - bw, y - 6);
    ctx.lineTo(x + bw, y - 6);
    ctx.stroke();

    // Short plate (negative)
    ctx.beginPath();
    ctx.moveTo(x - bw * 0.6, y + 6);
    ctx.lineTo(x + bw * 0.6, y + 6);
    ctx.stroke();

    // + and - labels
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "center";
    ctx.fillText("+", x + bw + 10, y - 3);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("-", x + bw + 10, y + 10);

    // Voltage label
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`${voltage.toFixed(1)} V`, x, y + 25);
  }

  function drawResistor(x: number, y: number, value: number, label: string, vDrop: number, current: number): void {
    const rw = 50;
    const rh = 16;

    // Zigzag resistor symbol
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - rw, y);
    const zigCount = 6;
    const zigW = (rw * 2) / zigCount;
    for (let i = 0; i < zigCount; i++) {
      const zx = x - rw + (i + 0.5) * zigW;
      const zy = y + (i % 2 === 0 ? -rh : rh);
      ctx.lineTo(zx, zy);
    }
    ctx.lineTo(x + rw, y);
    ctx.stroke();

    // Resistor box background
    ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
    ctx.fillRect(x - rw, y - rh - 2, rw * 2, rh * 2 + 4);

    // Label
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(`${label}: ${value} \u03A9`, x, y - rh - 8);

    // Values below
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`V = ${vDrop.toFixed(2)} V`, x, y + rh + 14);
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`I = ${current.toFixed(3)} A`, x, y + rh + 27);
  }

  function drawWire(x1: number, y1: number, x2: number, y2: number): void {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function drawSeriesCircuit(): void {
    const cx = width / 2, cy = height / 2, w = width * 0.35, h = height * 0.3;
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 2;
    drawWire(cx - w, cy + h, cx - w, cy - h);
    drawWire(cx - w, cy - h, cx + w, cy - h);
    drawWire(cx + w, cy - h, cx + w, cy + h);
    drawWire(cx + w, cy + h, cx - w, cy + h);
    drawBattery(cx, cy + h);
    drawResistor(cx - w * 0.35, cy - h, resistance1, "R1", voltageR1, currentR1);
    drawResistor(cx + w * 0.35, cy - h, resistance2, "R2", voltageR2, currentR2);
    ctx.fillStyle = "#22c55e"; ctx.font = "16px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("\u2192", cx, cy - h - 25);
    ctx.fillText("\u2190", cx, cy + h + 35);
  }

  function drawParallelCircuit(): void {
    const cx = width / 2, cy = height / 2, w = width * 0.35, h = height * 0.3;
    const bo = height * 0.1;
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 2;
    drawWire(cx - w, cy + h, cx - w, cy - bo);
    drawWire(cx - w, cy - bo, cx - w, cy + bo);
    drawWire(cx + w, cy + h, cx + w, cy - bo);
    drawWire(cx + w, cy - bo, cx + w, cy + bo);
    drawWire(cx - w, cy - bo, cx + w, cy - bo);
    drawWire(cx - w, cy + bo, cx + w, cy + bo);
    drawWire(cx + w, cy + h, cx - w, cy + h);
    for (const jx of [cx - w, cx + w]) {
      for (const jy of [cy - bo, cy + bo]) {
        ctx.fillStyle = "#fbbf24"; ctx.beginPath();
        ctx.arc(jx, jy, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawBattery(cx, cy + h);
    drawResistor(cx, cy - bo, resistance1, "R1", voltageR1, currentR1);
    drawResistor(cx, cy + bo, resistance2, "R2", voltageR2, currentR2);
  }

  function drawFlowDots(): void {
    ctx.fillStyle = "#22c55e";
    for (const dot of flowDots) {
      let pos: { x: number; y: number };
      if (connectionType === 0) {
        pos = getSeriesPath(dot.progress);
      } else {
        pos = getParallelPath(dot.progress, dot.path);
      }

      const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 6);
      glow.addColorStop(0, "rgba(34, 197, 94, 0.8)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInfoPanel(): void {
    const panelX = 10;
    const panelY = 10;
    const panelW = 220;
    const panelH = 130;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText(connectionType === 0 ? "Series Connection" : "Parallel Connection", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 38;
    const lh = 16;

    if (connectionType === 0) {
      ctx.fillText(`R_total = R1 + R2 = ${totalResistance.toFixed(1)} \u03A9`, panelX + 10, y); y += lh;
    } else {
      ctx.fillText(`1/R = 1/R1 + 1/R2`, panelX + 10, y); y += lh;
      ctx.fillText(`R_total = ${totalResistance.toFixed(2)} \u03A9`, panelX + 10, y); y += lh;
    }

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`V = ${voltage.toFixed(1)} V`, panelX + 10, y); y += lh;

    ctx.fillStyle = "#22c55e";
    ctx.fillText(`I_total = ${totalCurrent.toFixed(3)} A`, panelX + 10, y); y += lh;

    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Ohm's Law: V = I \u00D7 R", panelX + 10, y);
  }

  function drawTitle(): void {
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Resistance Connection \u2014 Ohm's Law (V = IR)", width / 2, height - 20);
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    if (connectionType === 0) {
      drawSeriesCircuit();
    } else {
      drawParallelCircuit();
    }

    drawFlowDots();
    drawInfoPanel();
    drawTitle();
  }

  function reset(): void {
    time = 0;
    computeCircuit();
    initDots();
  }

  function destroy(): void {
    flowDots = [];
  }

  function getStateDescription(): string {
    const typeLabel = connectionType === 0 ? "Series" : "Parallel";
    return (
      `Resistance Connection (${typeLabel}): V=${voltage}V, R1=${resistance1}\u03A9, R2=${resistance2}\u03A9. ` +
      `Total resistance: ${totalResistance.toFixed(2)}\u03A9. Total current: ${totalCurrent.toFixed(3)}A. ` +
      `Voltage across R1: ${voltageR1.toFixed(2)}V (I1=${currentR1.toFixed(3)}A), ` +
      `Voltage across R2: ${voltageR2.toFixed(2)}V (I2=${currentR2.toFixed(3)}A). ` +
      (connectionType === 0
        ? `Series: R_total = R1 + R2, same current flows through both resistors.`
        : `Parallel: 1/R_total = 1/R1 + 1/R2, same voltage across both resistors.`)
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ResistanceConnectionFactory;
