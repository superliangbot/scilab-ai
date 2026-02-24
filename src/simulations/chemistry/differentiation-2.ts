import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const Differentiation2Factory = (): SimulationEngine => {
  const config = getSimConfig("differentiation-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  const funcNames = ["y = ax", "y = ax²", "y = a·ln(x)", "y = a·eˣ", "y = a·sin(x)", "y = a·cos(x)"];

  function f(x: number, funcType: number, a: number): number {
    switch (funcType) {
      case 0: return a * x;
      case 1: return a * x * x;
      case 2: return x > 0 ? a * Math.log(x) : NaN;
      case 3: return a * Math.exp(x);
      case 4: return a * Math.sin(x);
      case 5: return a * Math.cos(x);
      default: return a * x;
    }
  }

  function fPrime(x: number, funcType: number, a: number): number {
    switch (funcType) {
      case 0: return a;
      case 1: return 2 * a * x;
      case 2: return x > 0 ? a / x : NaN;
      case 3: return a * Math.exp(x);
      case 4: return a * Math.cos(x);
      case 5: return -a * Math.sin(x);
      default: return a;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const funcType = Math.round(currentParams.funcType ?? 1);
    const a = currentParams.amplitude ?? 1;
    const markerX = currentParams.markerX ?? 2;
    const dx = currentParams.deltaX ?? 1;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Differentiation — Tangent Line Approach", width / 2, 28);

    // Determine ranges
    let xRange: [number, number] = [-5, 5];
    let yRange: [number, number] = [-5, 5];
    if (funcType === 2) { xRange = [0.1, 6]; yRange = [-3, 4]; }
    else if (funcType === 3) { xRange = [-3, 3]; yRange = [-1, Math.min(20, a * Math.exp(3))]; }
    else if (funcType === 1) { yRange = [-2, Math.min(30, a * 25)]; }

    // Graph area - full width
    const margin = 40;
    const gx = margin;
    const gy = 55;
    const gw = width - margin * 2;
    const gh = height * 0.6;

    // Graph background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    const toPixelX = (x: number) => gx + (x - xRange[0]) / (xRange[1] - xRange[0]) * gw;
    const toPixelY = (y: number) => gy + gh - (y - yRange[0]) / (yRange[1] - yRange[0]) * gh;

    // Grid
    ctx.strokeStyle = "#33415544";
    ctx.lineWidth = 0.5;
    const xStep = (xRange[1] - xRange[0]) / 10;
    const yStep = (yRange[1] - yRange[0]) / 8;
    for (let x = Math.ceil(xRange[0] / xStep) * xStep; x <= xRange[1]; x += xStep) {
      ctx.beginPath();
      ctx.moveTo(toPixelX(x), gy);
      ctx.lineTo(toPixelX(x), gy + gh);
      ctx.stroke();
    }
    for (let y = Math.ceil(yRange[0] / yStep) * yStep; y <= yRange[1]; y += yStep) {
      ctx.beginPath();
      ctx.moveTo(gx, toPixelY(y));
      ctx.lineTo(gx + gw, toPixelY(y));
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    if (yRange[0] <= 0 && yRange[1] >= 0) {
      ctx.beginPath();
      ctx.moveTo(gx, toPixelY(0));
      ctx.lineTo(gx + gw, toPixelY(0));
      ctx.stroke();
    }
    if (xRange[0] <= 0 && xRange[1] >= 0) {
      ctx.beginPath();
      ctx.moveTo(toPixelX(0), gy);
      ctx.lineTo(toPixelX(0), gy + gh);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    for (let x = Math.ceil(xRange[0]); x <= xRange[1]; x += 1) {
      if (x === 0) continue;
      ctx.fillText(x.toString(), toPixelX(x), gy + gh + 15);
    }
    ctx.textAlign = "right";
    for (let y = Math.ceil(yRange[0]); y <= yRange[1]; y += Math.ceil(yStep)) {
      if (y === 0) continue;
      ctx.fillText(y.toString(), gx - 5, toPixelY(y) + 4);
    }

    // Function curve
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= gw; i++) {
      const x = xRange[0] + (i / gw) * (xRange[1] - xRange[0]);
      const y = f(x, funcType, a);
      if (isNaN(y) || !isFinite(y)) { started = false; continue; }
      const px = toPixelX(x);
      const py = toPixelY(y);
      if (py < gy - 20 || py > gy + gh + 20) { started = false; continue; }
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Secant line (Δy/Δx) - showing dx approach
    const fA = f(markerX, funcType, a);
    const fB = f(markerX + dx, funcType, a);
    if (!isNaN(fA) && !isNaN(fB) && isFinite(fA) && isFinite(fB)) {
      const pxA = toPixelX(markerX);
      const pyA = toPixelY(fA);
      const pxB = toPixelX(markerX + dx);
      const pyB = toPixelY(fB);

      // Delta x bracket
      ctx.strokeStyle = "#22c55e88";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(pxA, pyA);
      ctx.lineTo(pxB, pyA);
      ctx.stroke();
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(pxB, pyA);
      ctx.lineTo(pxB, pyB);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels for Δx and Δy
      ctx.fillStyle = "#22c55e";
      ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Δx", (pxA + pxB) / 2, pyA + 15);
      ctx.textAlign = "left";
      ctx.fillText("Δy", pxB + 5, (pyA + pyB) / 2 + 4);

      // Secant line (full extension)
      const secantSlope = (fB - fA) / dx;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      const ext = (xRange[1] - xRange[0]) * 0.4;
      ctx.beginPath();
      ctx.moveTo(toPixelX(markerX - ext), toPixelY(fA + secantSlope * (-ext)));
      ctx.lineTo(toPixelX(markerX + ext + dx), toPixelY(fA + secantSlope * (ext + dx)));
      ctx.stroke();

      // Point B
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(pxB, pyB, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tangent line at marker
    const slope = fPrime(markerX, funcType, a);
    if (!isNaN(slope) && isFinite(slope) && !isNaN(fA)) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      const ext = (xRange[1] - xRange[0]) * 0.3;
      ctx.beginPath();
      ctx.moveTo(toPixelX(markerX - ext), toPixelY(fA + slope * (-ext)));
      ctx.lineTo(toPixelX(markerX + ext), toPixelY(fA + slope * ext));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Marker point A
    if (!isNaN(fA) && isFinite(fA)) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(toPixelX(markerX), toPixelY(fA), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Info panel below graph
    const panelY = gy + gh + 25;
    const panelH = height - panelY - 10;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(gx, panelY, gw, panelH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, panelY, gw, panelH);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(12, width * 0.016)}px monospace`;
    ctx.textAlign = "left";

    const secantSlope = dx > 0.001 && !isNaN(fB) ? ((fB - fA) / dx) : slope;
    const leftCol = gx + 15;
    const rightCol = gx + gw / 2 + 15;
    const lineH = Math.min(22, panelH / 5);

    ctx.fillText(`Function: ${funcNames[funcType]}`, leftCol, panelY + lineH);
    ctx.fillText(`x = ${markerX.toFixed(2)}`, leftCol, panelY + lineH * 2);
    ctx.fillText(`f(x) = ${fA.toFixed(4)}`, leftCol, panelY + lineH * 3);

    ctx.fillStyle = "#22c55e";
    ctx.fillText(`Δx = ${dx.toFixed(3)}`, rightCol, panelY + lineH);
    ctx.fillText(`Δy/Δx = ${secantSlope.toFixed(4)}`, rightCol, panelY + lineH * 2);

    ctx.fillStyle = "#ef4444";
    ctx.fillText(`dy/dx = ${slope.toFixed(4)}`, rightCol, panelY + lineH * 3);

    // Comparison note
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.fillText("As Δx → 0, the secant line (green) approaches the tangent (red)", leftCol, panelY + lineH * 4.2);

    // Legend
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("● f(x)", gx + gw - 200, gy + 18);
    ctx.fillStyle = "#22c55e";
    ctx.fillText("● Secant", gx + gw - 140, gy + 18);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("● Tangent", gx + gw - 70, gy + 18);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const funcType = Math.round(currentParams.funcType ?? 1);
    const a = currentParams.amplitude ?? 1;
    const markerX = currentParams.markerX ?? 2;
    const dx = currentParams.deltaX ?? 1;
    const fA = f(markerX, funcType, a);
    const fB = f(markerX + dx, funcType, a);
    const slope = fPrime(markerX, funcType, a);
    const secantSlope = dx > 0.001 ? (fB - fA) / dx : slope;

    return `Differentiation tangent approach: ${funcNames[funcType]} with a=${a.toFixed(1)}. At x=${markerX.toFixed(2)}: f(x)=${fA.toFixed(4)}, true derivative dy/dx=${slope.toFixed(4)}, secant approximation Δy/Δx=${secantSlope.toFixed(4)} with Δx=${dx.toFixed(3)}. The key concept: as Δx approaches 0, the secant line approaches the tangent line, and Δy/Δx approaches dy/dx. This is the fundamental definition of a derivative: lim(Δx→0) [f(x+Δx)-f(x)]/Δx.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Differentiation2Factory;
