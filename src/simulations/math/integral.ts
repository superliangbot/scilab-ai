import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IntegralFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("integral") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;

  // Parameters
  let divisions = 10;
  let lowerBound = 0;
  let upperBound = 5;
  let funcType = 0; // 0=quadratic, 1=sine, 2=cubic, 3=linear

  // Draggable control points for custom curve
  const controlPts = [
    { x: 0, y: 1 },
    { x: 1.5, y: 3 },
    { x: 3, y: 2 },
    { x: 4.5, y: 4 },
    { x: 6, y: 1 },
  ];

  function f(x: number): number {
    switch (funcType) {
      case 0: return 0.3 * x * x; // quadratic
      case 1: return 2 + 2 * Math.sin(x * 1.2); // sine wave
      case 2: return 0.05 * x * x * x - 0.3 * x * x + x + 1; // cubic
      case 3: return 0.5 * x + 1; // linear
      default: return 0.3 * x * x;
    }
  }

  function funcName(): string {
    switch (funcType) {
      case 0: return "f(x) = 0.3x²";
      case 1: return "f(x) = 2 + 2sin(1.2x)";
      case 2: return "f(x) = 0.05x³ - 0.3x² + x + 1";
      case 3: return "f(x) = 0.5x + 1";
      default: return "f(x)";
    }
  }

  function trueIntegral(): number {
    // Numerical integration with many rectangles for "true" value
    const n = 1000;
    const dx = (upperBound - lowerBound) / n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const x = lowerBound + (i + 0.5) * dx;
      sum += f(x) * dx;
    }
    return sum;
  }

  function riemannSum(): number {
    const dx = (upperBound - lowerBound) / divisions;
    let sum = 0;
    for (let i = 0; i < divisions; i++) {
      const x = lowerBound + (i + 0.5) * dx; // midpoint rule
      sum += f(x) * dx;
    }
    return sum;
  }

  // Coordinate transforms
  const MARGIN = { left: 60, right: 30, top: 60, bottom: 80 };
  let plotW = 0;
  let plotH = 0;
  let xMin = -0.5;
  let xMax = 7;
  let yMin = -0.5;
  let yMax = 8;

  function toCanvasX(x: number): number {
    return MARGIN.left + ((x - xMin) / (xMax - xMin)) * plotW;
  }
  function toCanvasY(y: number): number {
    return MARGIN.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      plotW = width - MARGIN.left - MARGIN.right;
      plotH = height - MARGIN.top - MARGIN.bottom;
    },
    update(_dt: number, params: Record<string, number>) {
      divisions = Math.max(1, Math.round(params.divisions ?? 10));
      lowerBound = params.lowerBound ?? 0;
      upperBound = params.upperBound ?? 5;
      funcType = Math.round(params.funcType ?? 0);
      if (upperBound <= lowerBound) upperBound = lowerBound + 0.5;

      plotW = width - MARGIN.left - MARGIN.right;
      plotH = height - MARGIN.top - MARGIN.bottom;

      // Adjust y range based on function values
      let maxY = 0;
      for (let x = xMin; x <= xMax; x += 0.1) {
        maxY = Math.max(maxY, Math.abs(f(x)));
      }
      yMax = maxY * 1.3 + 1;
    },
    render() {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      drawAxes();
      drawRiemannRectangles();
      drawFunction();
      drawInfo();
    },
    reset() {},
    destroy() {},
    getStateDescription(): string {
      const trueVal = trueIntegral();
      const approxVal = riemannSum();
      const err = Math.abs(trueVal - approxVal);
      return `Definite integral of ${funcName()} from ${lowerBound.toFixed(1)} to ${upperBound.toFixed(1)}. ` +
        `Using ${divisions} Riemann sum rectangles (midpoint rule). ` +
        `Approximate area = ${approxVal.toFixed(4)}, True integral ≈ ${trueVal.toFixed(4)}, Error = ${err.toFixed(4)}. ` +
        `More subdivisions → better approximation, demonstrating the fundamental concept of integration.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      plotW = width - MARGIN.left - MARGIN.right;
      plotH = height - MARGIN.top - MARGIN.bottom;
    },
  };

  function drawAxes() {
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;

    // X axis
    const y0 = toCanvasY(0);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y0);
    ctx.lineTo(MARGIN.left + plotW, y0);
    ctx.stroke();

    // Y axis
    const x0 = toCanvasX(0);
    ctx.beginPath();
    ctx.moveTo(x0, MARGIN.top);
    ctx.lineTo(x0, MARGIN.top + plotH);
    ctx.stroke();

    // Grid and labels
    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(9, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";

    // X ticks
    for (let x = 0; x <= xMax; x += 1) {
      const cx = toCanvasX(x);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, MARGIN.top);
      ctx.lineTo(cx, MARGIN.top + plotH);
      ctx.stroke();
      ctx.fillText(x.toString(), cx, y0 + 16);
    }

    // Y ticks
    ctx.textAlign = "right";
    const yStep = yMax > 10 ? 2 : 1;
    for (let y = 0; y <= yMax; y += yStep) {
      const cy = toCanvasY(y);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, cy);
      ctx.lineTo(MARGIN.left + plotW, cy);
      ctx.stroke();
      ctx.fillText(y.toFixed(0), MARGIN.left - 8, cy + 4);
    }

    // Axis labels
    ctx.fillStyle = "#1e293b";
    ctx.font = `${Math.max(11, width * 0.016)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("x", MARGIN.left + plotW + 15, y0 + 4);
    ctx.fillText("y", toCanvasX(0) - 4, MARGIN.top - 10);
  }

  function drawRiemannRectangles() {
    const dx = (upperBound - lowerBound) / divisions;

    for (let i = 0; i < divisions; i++) {
      const xLeft = lowerBound + i * dx;
      const xMid = xLeft + dx / 2;
      const h = f(xMid);

      const cx1 = toCanvasX(xLeft);
      const cx2 = toCanvasX(xLeft + dx);
      const cy0 = toCanvasY(0);
      const cyH = toCanvasY(Math.max(h, 0));

      const rectW = cx2 - cx1;
      const rectH = cy0 - cyH;

      // Fill
      ctx.fillStyle = h >= 0
        ? `rgba(59, 130, 246, ${0.25 + 0.15 * Math.sin(i)})`
        : `rgba(239, 68, 68, 0.3)`;
      ctx.fillRect(cx1, cyH, rectW, rectH);

      // Border
      ctx.strokeStyle = "rgba(59, 130, 246, 0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx1, cyH, rectW, rectH);

      // Show midpoint dot
      if (divisions <= 20) {
        ctx.fillStyle = "#1d4ed8";
        ctx.beginPath();
        ctx.arc(toCanvasX(xMid), toCanvasY(h), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bound markers
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    const aX = toCanvasX(lowerBound);
    const bX = toCanvasX(upperBound);
    ctx.beginPath();
    ctx.moveTo(aX, MARGIN.top);
    ctx.lineTo(aX, MARGIN.top + plotH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bX, MARGIN.top);
    ctx.lineTo(bX, MARGIN.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels a, b
    ctx.fillStyle = "#dc2626";
    ctx.font = `bold ${Math.max(11, width * 0.015)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`a=${lowerBound.toFixed(1)}`, aX, MARGIN.top + plotH + 30);
    ctx.fillText(`b=${upperBound.toFixed(1)}`, bX, MARGIN.top + plotH + 30);
  }

  function drawFunction() {
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let first = true;
    for (let px = 0; px <= plotW; px += 1) {
      const x = xMin + (px / plotW) * (xMax - xMin);
      const y = f(x);
      const cx = MARGIN.left + px;
      const cy = toCanvasY(y);
      if (first) { ctx.moveTo(cx, cy); first = false; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  function drawInfo() {
    const trueVal = trueIntegral();
    const approxVal = riemannSum();
    const error = Math.abs(trueVal - approxVal);
    const errorPct = trueVal !== 0 ? (error / Math.abs(trueVal)) * 100 : 0;

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Definite Integral — Riemann Sum Approximation", width / 2, 25);

    // Function name
    ctx.fillStyle = "#1e40af";
    ctx.font = `${Math.max(12, width * 0.017)}px sans-serif`;
    ctx.fillText(funcName(), width / 2, 45);

    // Results panel
    const panelX = width - 220;
    const panelY = MARGIN.top + 10;
    ctx.fillStyle = "rgba(241, 245, 249, 0.95)";
    ctx.fillRect(panelX, panelY, 200, 100);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 200, 100);

    ctx.textAlign = "left";
    ctx.font = `${Math.max(10, width * 0.014)}px monospace`;
    ctx.fillStyle = "#1e293b";
    ctx.fillText(`n = ${divisions} rectangles`, panelX + 10, panelY + 20);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`Σ ≈ ${approxVal.toFixed(4)}`, panelX + 10, panelY + 38);
    ctx.fillStyle = "#059669";
    ctx.fillText(`∫ = ${trueVal.toFixed(4)}`, panelX + 10, panelY + 56);
    ctx.fillStyle = "#dc2626";
    ctx.fillText(`Error: ${error.toFixed(4)} (${errorPct.toFixed(1)}%)`, panelX + 10, panelY + 74);

    // Formula at bottom
    ctx.fillStyle = "#475569";
    ctx.font = `${Math.max(11, width * 0.015)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("∫ₐᵇ f(x)dx = F(b) - F(a) ≈ Σ f(xᵢ)·Δx", width / 2, height - 10);
  }
};

export default IntegralFactory;
