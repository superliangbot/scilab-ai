import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const OhmsLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ohms-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let voltage = 9; // Volts
  let resistance = 100; // Ohms
  let showGraph = 1;
  let showElectrons = 1;

  // Derived
  let currentAmps = 0;
  let power = 0;

  // Electron flow animation
  interface Electron {
    t: number; // position along circuit path [0, 1]
    speed: number;
  }
  let electrons: Electron[] = [];
  const NUM_ELECTRONS = 30;

  // Circuit layout
  const CIRCUIT = {
    left: 0.15,
    right: 0.65,
    top: 0.2,
    bottom: 0.55,
  };

  function initElectrons(): void {
    electrons = [];
    for (let i = 0; i < NUM_ELECTRONS; i++) {
      electrons.push({
        t: i / NUM_ELECTRONS,
        speed: 0,
      });
    }
  }

  function getCircuitPoint(t: number): { x: number; y: number } {
    const left = width * CIRCUIT.left;
    const right = width * CIRCUIT.right;
    const top = height * CIRCUIT.top;
    const bottom = height * CIRCUIT.bottom;
    const w = right - left;
    const h = bottom - top;
    const perimeter = 2 * w + 2 * h;

    let d = t * perimeter;

    if (d < w) {
      // Top: left to right
      return { x: left + d, y: top };
    }
    d -= w;
    if (d < h) {
      // Right: top to bottom
      return { x: right, y: top + d };
    }
    d -= h;
    if (d < w) {
      // Bottom: right to left
      return { x: right - d, y: bottom };
    }
    d -= w;
    // Left: bottom to top
    return { x: left, y: bottom - d };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initElectrons();
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 9;
    resistance = params.resistance ?? 100;
    showGraph = params.showGraph ?? 1;
    showElectrons = params.showElectrons ?? 1;

    time += dt;

    // Ohm's Law
    currentAmps = voltage / Math.max(resistance, 0.1);
    power = voltage * currentAmps;

    // Update electrons
    const electronSpeed = currentAmps * 0.01;
    for (const e of electrons) {
      e.speed = electronSpeed;
      e.t += e.speed * dt;
      if (e.t > 1) e.t -= 1;
      if (e.t < 0) e.t += 1;
    }
  }

  function drawCircuit(): void {
    const left = width * CIRCUIT.left;
    const right = width * CIRCUIT.right;
    const top = height * CIRCUIT.top;
    const bottom = height * CIRCUIT.bottom;
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;

    // Wires
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;

    // Top wire (with switch gap)
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.stroke();

    // Right wire
    ctx.beginPath();
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.stroke();

    // Left wire
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(left, top);
    ctx.stroke();

    // Battery (left side)
    const battY = midY;
    const battH = 30;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(left - 15, battY - battH, 30, battH * 2);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left - 12, battY - 8);
    ctx.lineTo(left + 12, battY - 8);
    ctx.stroke();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left - 6, battY + 8);
    ctx.lineTo(left + 6, battY + 8);
    ctx.stroke();

    // Battery labels
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", left, battY - 18);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("−", left, battY + 24);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(`${voltage.toFixed(1)} V`, left - 50, battY + 5);

    // Resistor (top, centered)
    const resX = midX;
    const resY = top;
    const resW = 60;
    const resH = 16;

    ctx.fillStyle = "#1e293b";
    ctx.fillRect(resX - resW / 2, resY - resH / 2, resW, resH);

    // Zigzag resistor symbol
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(resX - resW / 2, resY);
    const zigzags = 6;
    for (let i = 0; i < zigzags; i++) {
      const zx = resX - resW / 2 + ((i + 0.5) / zigzags) * resW;
      const zy = resY + (i % 2 === 0 ? -resH / 2 + 2 : resH / 2 - 2);
      ctx.lineTo(zx, zy);
    }
    ctx.lineTo(resX + resW / 2, resY);
    ctx.stroke();

    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${resistance} Ω`, resX, resY - 20);

    // Ammeter (bottom, centered)
    const amX = midX;
    const amY = bottom;
    ctx.beginPath();
    ctx.arc(amX, amY, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", amX, amY);

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${(currentAmps * 1000).toFixed(1)} mA`, amX, amY + 30);

    // Voltmeter (right side)
    const vmX = right + 40;
    const vmY = midY;
    ctx.beginPath();
    ctx.arc(vmX, vmY, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("V", vmX, vmY);

    // Voltmeter leads (dashed)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(vmX, vmY - 18);
    ctx.lineTo(vmX, top);
    ctx.lineTo(right, top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(vmX, vmY + 18);
    ctx.lineTo(vmX, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "11px system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${voltage.toFixed(1)} V`, vmX + 30, vmY);

    // Current flow arrow
    ctx.fillStyle = "#22c55e";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("I →", midX + 60, top - 10);
    ctx.fillText("← I", midX - 60, bottom + 20);
  }

  function drawElectrons(): void {
    if (showElectrons < 1) return;

    for (const e of electrons) {
      const pos = getCircuitPoint(e.t);

      // Electron glow
      const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 8);
      glow.addColorStop(0, "rgba(59, 130, 246, 0.4)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Electron dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#60a5fa";
      ctx.fill();
    }
  }

  function drawOhmsLawTriangle(): void {
    const triX = width * 0.82;
    const triY = height * 0.2;
    const triSize = 60;

    // Triangle
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(triX, triY - triSize * 0.6);
    ctx.lineTo(triX - triSize * 0.6, triY + triSize * 0.4);
    ctx.lineTo(triX + triSize * 0.6, triY + triSize * 0.4);
    ctx.closePath();
    ctx.stroke();

    // Horizontal divider
    ctx.beginPath();
    ctx.moveTo(triX - triSize * 0.4, triY - triSize * 0.05);
    ctx.lineTo(triX + triSize * 0.4, triY - triSize * 0.05);
    ctx.stroke();

    // Vertical divider
    ctx.beginPath();
    ctx.moveTo(triX, triY - triSize * 0.05);
    ctx.lineTo(triX, triY + triSize * 0.35);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("V", triX, triY - triSize * 0.2);

    ctx.fillStyle = "#22c55e";
    ctx.fillText("I", triX - triSize * 0.25, triY + triSize * 0.25);

    ctx.fillStyle = "#f59e0b";
    ctx.fillText("R", triX + triSize * 0.25, triY + triSize * 0.25);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Ohm's Law", triX, triY - triSize * 0.7);
  }

  function drawGraph(): void {
    if (showGraph < 1) return;

    const gx = width * 0.68;
    const gy = height * 0.45;
    const gw = width * 0.28;
    const gh = height * 0.35;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("V-I Characteristic", gx + gw / 2, gy + 16);

    const plotLeft = gx + 40;
    const plotRight = gx + gw - 15;
    const plotTop = gy + 28;
    const plotBottom = gy + gh - 25;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("I (mA)", gx + gw / 2, plotBottom + 18);
    ctx.save();
    ctx.translate(gx + 14, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("V (Volts)", 0, 0);
    ctx.restore();

    // V-I line for current resistance
    const maxI = 20 / Math.max(resistance, 1) * 1000; // mA at 20V
    const maxV = 20;

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotTop);
    ctx.stroke();

    // Slope label
    ctx.fillStyle = "#22c55e";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`slope = 1/R = ${(1000 / resistance).toFixed(2)} mS`, plotLeft + 5, plotTop + 15);

    // Current operating point
    const opI = currentAmps * 1000; // mA
    const opX = plotLeft + (opI / Math.max(maxI, 0.01)) * plotW;
    const opY = plotBottom - (voltage / maxV) * plotH;

    ctx.beginPath();
    ctx.arc(Math.min(opX, plotRight), Math.max(opY, plotTop), 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Axis numbers
    ctx.fillStyle = "#64748b";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const v = (i / 4) * maxV;
      const py = plotBottom - (i / 4) * plotH;
      ctx.textAlign = "right";
      ctx.fillText(v.toFixed(0), plotLeft - 4, py + 3);
    }
    for (let i = 0; i <= 4; i++) {
      const iVal = (i / 4) * maxI;
      const px = plotLeft + (i / 4) * plotW;
      ctx.textAlign = "center";
      ctx.fillText(iVal.toFixed(0), px, plotBottom + 10);
    }
  }

  function drawInfoPanel(): void {
    const panelX = 15;
    const panelY = height * 0.72;
    const panelW = width * 0.48;
    const panelH = height * 0.24;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("V = I × R", panelX + 10, panelY + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 42;
    const lineH = 17;

    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Voltage (V) = ${voltage.toFixed(1)} V`, panelX + 10, y); y += lineH;
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`Resistance (R) = ${resistance} Ω`, panelX + 10, y); y += lineH;
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`Current (I) = V/R = ${(currentAmps * 1000).toFixed(2)} mA`, panelX + 10, y); y += lineH;
    ctx.fillStyle = "#a78bfa";
    ctx.fillText(`Power (P) = V×I = ${(power * 1000).toFixed(2)} mW`, panelX + 10, y); y += lineH + 3;

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Ohm's Law: V = IR, I = V/R, R = V/I", panelX + 10, y);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Ohm's Law — V = IR", width / 2, 28);

    drawCircuit();
    drawElectrons();
    drawOhmsLawTriangle();
    drawGraph();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    initElectrons();
  }

  function destroy(): void {
    electrons = [];
  }

  function getStateDescription(): string {
    return (
      `Ohm's Law: V=${voltage.toFixed(1)} V, R=${resistance} Ω. ` +
      `Current I = V/R = ${(currentAmps * 1000).toFixed(2)} mA. ` +
      `Power P = VI = ${(power * 1000).toFixed(2)} mW. ` +
      `Shows circuit with battery, resistor, ammeter, and voltmeter. ` +
      `V = IR is the fundamental relationship between voltage, current, and resistance.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default OhmsLawFactory;
