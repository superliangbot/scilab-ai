import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const IntegralFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("integral") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let divisions = 10;
  let funcType = 0; // 0=speed-time, 1=accel-time, 2=force-time, 3=force-distance
  let lowerBound = 1;
  let upperBound = 5;

  const funcNames = ["v(t) — Speed vs Time", "a(t) — Acceleration vs Time", "F(t) — Force vs Time", "F(x) — Force vs Distance"];
  const resultNames = ["Distance (m)", "Δv (m/s)", "Impulse (N·s)", "Work (J)"];
  const yLabels = ["v (m/s)", "a (m/s²)", "F (N)", "F (N)"];
  const xLabels = ["t (s)", "t (s)", "t (s)", "x (m)"];

  function f(x: number): number {
    switch (Math.round(funcType)) {
      case 0: return 2 + 3 * Math.sin(x * 0.8) + x * 0.3;
      case 1: return 1.5 * Math.cos(x * 0.6) + 0.5;
      case 2: return 5 * Math.exp(-0.3 * x) * Math.sin(x);
      case 3: return 3 + 2 * Math.sin(x * 1.2) - 0.2 * x;
      default: return Math.sin(x) + 2;
    }
  }

  function integrate(a: number, b: number, n: number): number {
    const dx = (b - a) / n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += f(a + i * dx) * dx;
    }
    return sum;
  }

  function exactIntegral(a: number, b: number): number {
    return integrate(a, b, 1000);
  }

  function toCanvasX(val: number, minX: number, maxX: number, px: number, pw: number): number {
    return px + ((val - minX) / (maxX - minX)) * pw;
  }

  function toCanvasY(val: number, minY: number, maxY: number, py: number, ph: number): number {
    return py + ph - ((val - minY) / (maxY - minY)) * ph;
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(dt: number, params: Record<string, number>) {
      divisions = Math.max(1, Math.round(params.divisions ?? 10));
      funcType = params.funcType ?? 0;
      lowerBound = params.lowerBound ?? 1;
      upperBound = params.upperBound ?? 5;
      if (upperBound <= lowerBound) upperBound = lowerBound + 0.5;
      time += dt;
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Definite Integral — Area Under the Curve", width / 2, 22);

      const fIdx = Math.round(funcType);
      ctx.fillStyle = "#aaa";
      ctx.font = "13px sans-serif";
      ctx.fillText(funcNames[fIdx] || funcNames[0], width / 2, 42);

      // Plot area
      const px = width * 0.12;
      const py = 55;
      const pw = width * 0.78;
      const ph = height * 0.55;

      // Compute range
      const xMin = 0;
      const xMax = Math.max(upperBound + 1, 7);
      let yMin = 0;
      let yMax = 0;
      for (let x = xMin; x <= xMax; x += 0.1) {
        const val = f(x);
        if (val < yMin) yMin = val;
        if (val > yMax) yMax = val;
      }
      yMin = Math.min(yMin - 1, -1);
      yMax = yMax + 1;

      // Grid and axes
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(px, py, pw, ph);

      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (let x = Math.ceil(xMin); x <= xMax; x++) {
        const cx = toCanvasX(x, xMin, xMax, px, pw);
        ctx.beginPath();
        ctx.moveTo(cx, py);
        ctx.lineTo(cx, py + ph);
        ctx.stroke();
        ctx.fillStyle = "#888";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(x.toString(), cx, py + ph + 14);
      }
      for (let y = Math.ceil(yMin); y <= yMax; y += Math.ceil((yMax - yMin) / 5)) {
        const cy = toCanvasY(y, yMin, yMax, py, ph);
        ctx.beginPath();
        ctx.moveTo(px, cy);
        ctx.lineTo(px + pw, cy);
        ctx.stroke();
        ctx.fillStyle = "#888";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(y.toFixed(0), px - 5, cy + 4);
      }
      ctx.setLineDash([]);

      // Zero line
      const zeroY = toCanvasY(0, yMin, yMax, py, ph);
      ctx.strokeStyle = "#777";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, zeroY);
      ctx.lineTo(px + pw, zeroY);
      ctx.stroke();

      // Draw rectangles (Riemann sum)
      const dx = (upperBound - lowerBound) / divisions;
      for (let i = 0; i < divisions; i++) {
        const xi = lowerBound + i * dx;
        const yi = f(xi);
        const cx1 = toCanvasX(xi, xMin, xMax, px, pw);
        const cx2 = toCanvasX(xi + dx, xMin, xMax, px, pw);
        const cyTop = toCanvasY(yi, yMin, yMax, py, ph);

        ctx.fillStyle = yi >= 0 ? "rgba(76, 175, 80, 0.35)" : "rgba(244, 67, 54, 0.35)";
        ctx.fillRect(cx1, Math.min(cyTop, zeroY), cx2 - cx1, Math.abs(cyTop - zeroY));
        ctx.strokeStyle = yi >= 0 ? "rgba(76, 175, 80, 0.7)" : "rgba(244, 67, 54, 0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx1, Math.min(cyTop, zeroY), cx2 - cx1, Math.abs(cyTop - zeroY));
      }

      // Draw curve
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = xMin + (i / 200) * (xMax - xMin);
        const y = f(x);
        const cx = toCanvasX(x, xMin, xMax, px, pw);
        const cy = toCanvasY(y, yMin, yMax, py, ph);
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      }
      ctx.stroke();

      // Bound markers
      const lx = toCanvasX(lowerBound, xMin, xMax, px, pw);
      const ux = toCanvasX(upperBound, xMin, xMax, px, pw);
      ctx.strokeStyle = "#e040fb";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, py);
      ctx.lineTo(lx, py + ph);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ux, py);
      ctx.lineTo(ux, py + ph);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#e040fb";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`a=${lowerBound.toFixed(1)}`, lx, py - 5);
      ctx.fillText(`b=${upperBound.toFixed(1)}`, ux, py - 5);

      // Axis labels
      ctx.fillStyle = "#aaa";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(xLabels[fIdx] || "x", px + pw / 2, py + ph + 28);
      ctx.save();
      ctx.translate(px - 30, py + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yLabels[fIdx] || "y", 0, 0);
      ctx.restore();

      // Results
      const riemannSum = integrate(lowerBound, upperBound, divisions);
      const exact = exactIntegral(lowerBound, upperBound);
      const error = Math.abs(riemannSum - exact);

      const infoY = py + ph + 40;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.05, infoY, width * 0.9, 70);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`∫ f(x) dx from ${lowerBound.toFixed(1)} to ${upperBound.toFixed(1)}`, width / 2, infoY + 18);
      ctx.fillText(`Riemann Sum (${divisions} rectangles): ${riemannSum.toFixed(4)} ${resultNames[fIdx]}`, width / 2, infoY + 38);

      ctx.fillStyle = "#4caf50";
      ctx.fillText(`Exact value ≈ ${exact.toFixed(4)} | Error = ${error.toFixed(4)} (${((error / Math.abs(exact + 0.001)) * 100).toFixed(2)}%)`, width / 2, infoY + 58);
    },
    reset() {
      time = 0;
    },
    destroy() {},
    getStateDescription(): string {
      const fIdx = Math.round(funcType);
      const riemannSum = integrate(lowerBound, upperBound, divisions);
      const exact = exactIntegral(lowerBound, upperBound);
      return `Integral visualization: ${funcNames[fIdx]}. Computing ∫f(x)dx from ${lowerBound} to ${upperBound} with ${divisions} rectangles. Riemann sum=${riemannSum.toFixed(4)}, exact≈${exact.toFixed(4)}. Result represents ${resultNames[fIdx]}. More divisions → better approximation.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default IntegralFactory;
