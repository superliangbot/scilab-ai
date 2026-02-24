import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DifferentiationFactory = (): SimulationEngine => {
  const config = getSimConfig("differentiation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  // Function types: 0=ax, 1=ax², 2=a·ln(x), 3=a·eˣ, 4=a·sin(x), 5=a·cos(x)
  const funcNames = ["y = ax", "y = ax²", "y = a·ln(x)", "y = a·eˣ", "y = a·sin(x)", "y = a·cos(x)"];
  const derivNames = ["y' = a", "y' = 2ax", "y' = a/x", "y' = a·eˣ", "y' = a·cos(x)", "y' = -a·sin(x)"];

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

  function drawGraph(
    gx: number, gy: number, gw: number, gh: number,
    fn: (x: number) => number, color: string, label: string,
    xRange: [number, number], yRange: [number, number],
    markerX?: number
  ): void {
    // Background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    const toPixelX = (x: number) => gx + (x - xRange[0]) / (xRange[1] - xRange[0]) * gw;
    const toPixelY = (y: number) => gy + gh - (y - yRange[0]) / (yRange[1] - yRange[0]) * gh;

    // Grid
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 0.5;
    const xStep = (xRange[1] - xRange[0]) / 8;
    const yStep = (yRange[1] - yRange[0]) / 6;

    for (let x = Math.ceil(xRange[0] / xStep) * xStep; x <= xRange[1]; x += xStep) {
      const px = toPixelX(x);
      ctx.beginPath();
      ctx.moveTo(px, gy);
      ctx.lineTo(px, gy + gh);
      ctx.stroke();
    }
    for (let y = Math.ceil(yRange[0] / yStep) * yStep; y <= yRange[1]; y += yStep) {
      const py = toPixelY(y);
      ctx.beginPath();
      ctx.moveTo(gx, py);
      ctx.lineTo(gx + gw, py);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    // X axis
    if (yRange[0] <= 0 && yRange[1] >= 0) {
      const y0 = toPixelY(0);
      ctx.beginPath();
      ctx.moveTo(gx, y0);
      ctx.lineTo(gx + gw, y0);
      ctx.stroke();
    }
    // Y axis
    if (xRange[0] <= 0 && xRange[1] >= 0) {
      const x0 = toPixelX(0);
      ctx.beginPath();
      ctx.moveTo(x0, gy);
      ctx.lineTo(x0, gy + gh);
      ctx.stroke();
    }

    // Function curve
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    const steps = gw;
    for (let i = 0; i <= steps; i++) {
      const x = xRange[0] + (i / steps) * (xRange[1] - xRange[0]);
      const y = fn(x);
      if (isNaN(y) || !isFinite(y) || y < yRange[0] - 10 || y > yRange[1] + 10) {
        started = false;
        continue;
      }
      const px = toPixelX(x);
      const py = toPixelY(y);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Marker point
    if (markerX !== undefined) {
      const my = fn(markerX);
      if (!isNaN(my) && isFinite(my)) {
        const px = toPixelX(markerX);
        const py = toPixelY(my);
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Value label
        ctx.fillStyle = "#fbbf24";
        ctx.font = `${Math.max(10, width * 0.013)}px monospace`;
        ctx.textAlign = "left";
        ctx.fillText(`(${markerX.toFixed(1)}, ${my.toFixed(2)})`, px + 8, py - 8);
      }
    }

    // Label
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(label, gx + 10, gy + 20);
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const funcType = Math.round(currentParams.funcType ?? 0);
    const a = currentParams.amplitude ?? 1;
    const markerX = currentParams.markerX ?? 1;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Differentiation — Function and Derivative", width / 2, 28);

    // Function name
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.fillText(`Function: ${funcNames[funcType]}  |  Derivative: ${derivNames[funcType]}`, width / 2, 50);

    // Determine ranges based on function type
    let xRange: [number, number] = [-5, 5];
    let yRange: [number, number] = [-5, 5];

    if (funcType === 2) {
      xRange = [0.1, 6];
      yRange = [-3, 4];
    } else if (funcType === 3) {
      xRange = [-3, 3];
      yRange = [-1, Math.max(5, a * Math.exp(3))];
      yRange[1] = Math.min(yRange[1], 20);
    } else if (funcType === 1) {
      yRange = [-2, Math.max(5, a * 25)];
      yRange[1] = Math.min(yRange[1], 30);
    }

    // Layout: two side-by-side graphs
    const margin = 20;
    const gap = 15;
    const graphW = (width - margin * 2 - gap) / 2;
    const graphH = height - 100;
    const graphY = 65;

    // Original function graph
    drawGraph(
      margin, graphY, graphW, graphH,
      (x) => f(x, funcType, a),
      "#38bdf8", `f(x) = ${funcNames[funcType].split("= ")[1]}`,
      xRange, yRange,
      markerX
    );

    // Derivative graph
    let dyRange: [number, number] = [-5, 5];
    if (funcType === 1) dyRange = [-10 * Math.abs(a), 10 * Math.abs(a)];
    if (funcType === 3) dyRange = [yRange[0], yRange[1]];

    drawGraph(
      margin + graphW + gap, graphY, graphW, graphH,
      (x) => fPrime(x, funcType, a),
      "#f97316", `f'(x) = ${derivNames[funcType].split("= ")[1]}`,
      xRange, dyRange,
      markerX
    );

    // Tangent line on the original function
    const fVal = f(markerX, funcType, a);
    const slope = fPrime(markerX, funcType, a);
    if (!isNaN(slope) && isFinite(slope) && !isNaN(fVal)) {
      // Draw tangent on original graph
      const toPixelX = (x: number) => margin + (x - xRange[0]) / (xRange[1] - xRange[0]) * graphW;
      const toPixelY = (y: number) => graphY + graphH - (y - yRange[0]) / (yRange[1] - yRange[0]) * graphH;

      ctx.strokeStyle = "#ef444488";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      const tLen = (xRange[1] - xRange[0]) * 0.3;
      const x1 = markerX - tLen;
      const x2 = markerX + tLen;
      const y1 = fVal + slope * (x1 - markerX);
      const y2 = fVal + slope * (x2 - markerX);
      ctx.moveTo(toPixelX(x1), toPixelY(y1));
      ctx.lineTo(toPixelX(x2), toPixelY(y2));
      ctx.stroke();
      ctx.setLineDash([]);

      // Slope value label
      ctx.fillStyle = "#ef4444";
      ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
      ctx.textAlign = "right";
      ctx.fillText(`slope = ${slope.toFixed(3)}`, margin + graphW - 10, graphY + graphH - 10);
    }
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const funcType = Math.round(currentParams.funcType ?? 0);
    const a = currentParams.amplitude ?? 1;
    const markerX = currentParams.markerX ?? 1;
    const slope = fPrime(markerX, funcType, a);

    return `Differentiation simulation: Showing ${funcNames[funcType]} with a=${a.toFixed(1)}. At x=${markerX.toFixed(1)}, the derivative (slope of tangent) is ${slope.toFixed(3)}. The derivative ${derivNames[funcType]} represents the instantaneous rate of change. In physics, differentiation connects position→velocity→acceleration. The left graph shows the original function, the right shows its derivative.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DifferentiationFactory;
