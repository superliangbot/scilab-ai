import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TaylorSeries: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("taylor-series") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let functionType = 0; // 0=sin, 1=cos, 2=exp, 3=ln(1+x)
  let numTerms = 5;
  let centerPoint = 0;
  let animationSpeed = 1;

  const GRAPH_X = 100;
  const GRAPH_Y = height * 0.15;
  const GRAPH_W = width - 200;
  const GRAPH_H = height * 0.7;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    functionType = Math.round(params.functionType ?? functionType);
    numTerms = params.numTerms ?? numTerms;
    centerPoint = params.centerPoint ?? centerPoint;
    animationSpeed = params.animationSpeed ?? animationSpeed;
    
    time += dt * animationSpeed;
  }

  function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  }

  function getFunction(x: number): number {
    switch (functionType) {
      case 0: return Math.sin(x); // sin(x)
      case 1: return Math.cos(x); // cos(x)
      case 2: return Math.exp(x); // e^x
      case 3: return Math.log(1 + x); // ln(1+x)
      default: return Math.sin(x);
    }
  }

  function getTaylorApproximation(x: number, terms: number): number {
    const h = x - centerPoint;
    let sum = 0;

    switch (functionType) {
      case 0: // sin(x) = sin(a) + cos(a)h - sin(a)h²/2! - cos(a)h³/3! + ...
        for (let n = 0; n < terms; n++) {
          const sinDerivative = Math.sin(centerPoint + n * Math.PI/2);
          sum += (sinDerivative * Math.pow(h, n)) / factorial(n);
        }
        break;
      
      case 1: // cos(x) = cos(a) - sin(a)h - cos(a)h²/2! + sin(a)h³/3! + ...
        for (let n = 0; n < terms; n++) {
          const cosDerivative = Math.cos(centerPoint + n * Math.PI/2);
          sum += (cosDerivative * Math.pow(h, n)) / factorial(n);
        }
        break;
      
      case 2: // e^x = e^a(1 + h + h²/2! + h³/3! + ...)
        const expA = Math.exp(centerPoint);
        for (let n = 0; n < terms; n++) {
          sum += (expA * Math.pow(h, n)) / factorial(n);
        }
        break;
      
      case 3: // ln(1+x) = x - x²/2 + x³/3 - x⁴/4 + ... (for x > -1)
        if (centerPoint === 0) {
          for (let n = 1; n <= terms; n++) {
            sum += Math.pow(-1, n+1) * Math.pow(x, n) / n;
          }
        }
        break;
    }

    return sum;
  }

  function drawAxes() {
    // X-axis
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(GRAPH_X, GRAPH_Y + GRAPH_H/2);
    ctx.lineTo(GRAPH_X + GRAPH_W, GRAPH_Y + GRAPH_H/2);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(GRAPH_X + GRAPH_W/2, GRAPH_Y);
    ctx.lineTo(GRAPH_X + GRAPH_W/2, GRAPH_Y + GRAPH_H);
    ctx.stroke();

    // Tick marks and labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    
    for (let i = -3; i <= 3; i++) {
      const x = GRAPH_X + GRAPH_W/2 + i * GRAPH_W/6;
      ctx.beginPath();
      ctx.moveTo(x, GRAPH_Y + GRAPH_H/2 - 5);
      ctx.lineTo(x, GRAPH_Y + GRAPH_H/2 + 5);
      ctx.stroke();
      
      if (i !== 0) {
        ctx.fillText(i.toString(), x, GRAPH_Y + GRAPH_H/2 + 18);
      }
    }
  }

  function drawFunction() {
    // Original function
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let px = 0; px <= GRAPH_W; px++) {
      const x = (px / GRAPH_W - 0.5) * 6; // Map to [-3, 3]
      const y = getFunction(x);
      const screenY = GRAPH_Y + GRAPH_H/2 - y * GRAPH_H/6;
      
      if (px === 0) {
        ctx.moveTo(GRAPH_X + px, screenY);
      } else {
        ctx.lineTo(GRAPH_X + px, screenY);
      }
    }
    ctx.stroke();

    // Taylor approximations
    const colors = ["#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
    
    for (let term = 1; term <= Math.min(numTerms, 5); term++) {
      ctx.strokeStyle = colors[term - 1];
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let px = 0; px <= GRAPH_W; px++) {
        const x = (px / GRAPH_W - 0.5) * 6;
        const y = getTaylorApproximation(x, term);
        const screenY = GRAPH_Y + GRAPH_H/2 - y * GRAPH_H/6;
        
        // Clamp to visible area
        const clampedY = Math.max(GRAPH_Y, Math.min(GRAPH_Y + GRAPH_H, screenY));
        
        if (px === 0) {
          ctx.moveTo(GRAPH_X + px, clampedY);
        } else {
          ctx.lineTo(GRAPH_X + px, clampedY);
        }
      }
      ctx.stroke();
    }

    // Center point indicator
    const centerX = GRAPH_X + GRAPH_W/2 + centerPoint * GRAPH_W/6;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(centerX, GRAPH_Y + GRAPH_H/2 - getFunction(centerPoint) * GRAPH_H/6, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLegend() {
    const legendX = width - 180;
    const legendY = 50;

    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(legendX - 10, legendY - 10, 170, 200);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 10, legendY - 10, 170, 200);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Taylor Series", legendX, legendY + 15);

    // Function name
    const functionNames = ["sin(x)", "cos(x)", "e^x", "ln(1+x)"];
    ctx.fillStyle = "#22c55e";
    ctx.font = "12px monospace";
    ctx.fillText(`f(x) = ${functionNames[functionType]}`, legendX, legendY + 35);

    // Terms
    const colors = ["#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
    ctx.font = "10px monospace";
    
    for (let i = 0; i < Math.min(numTerms, 5); i++) {
      ctx.fillStyle = colors[i];
      ctx.fillText(`T${i+1}(x)`, legendX, legendY + 55 + i * 15);
    }

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Center: a = ${centerPoint}`, legendX, legendY + 140);
    ctx.fillText(`Terms: ${numTerms}`, legendX, legendY + 155);

    // Error indicator
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.fillText("More terms = better", legendX, legendY + 175);
    ctx.fillText("approximation", legendX, legendY + 185);
  }

  function drawFormula() {
    const formulaX = 50;
    const formulaY = height - 80;

    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(formulaX - 10, formulaY - 10, width - 100, 60);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(formulaX - 10, formulaY - 10, width - 100, 60);

    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Taylor Series Formula:", formulaX, formulaY + 15);

    ctx.fillStyle = "#fbbf24";
    ctx.fillText("f(x) = f(a) + f'(a)(x-a) + f''(a)(x-a)²/2! + f'''(a)(x-a)³/3! + ...", formulaX, formulaY + 35);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.fillText("Approximates any smooth function as a polynomial around point a", formulaX, formulaY + 50);
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawAxes();
    drawFunction();
    drawLegend();
    drawFormula();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Taylor Series Approximation", 20, 25);
  }

  function reset() {
    time = 0;
  }

  function getStateDescription(): string {
    const functionNames = ["sin(x)", "cos(x)", "e^x", "ln(1+x)"];
    return `Taylor series for ${functionNames[functionType]} centered at ${centerPoint} with ${numTerms} terms. Shows polynomial approximation convergence.`;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy: () => {},
    getStateDescription,
    resize: (w: number, h: number) => { width = w; height = h; }
  };
};

export default TaylorSeries;