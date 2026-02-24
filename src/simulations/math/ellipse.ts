import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EllipseFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ellipse") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let semiMajor = 200; // a (pixels)
  let eccentricity = 0.6; // e
  let traceAngle = 45; // degrees — position of pen point

  // Derived values
  let cx = 0;
  let cy = 0;
  let a = 200;
  let b = 160;
  let c = 120; // focal distance

  function computeDerived(): void {
    cx = W / 2;
    cy = H / 2;
    a = semiMajor;
    c = a * eccentricity;
    b = Math.sqrt(a * a - c * c);
  }

  function getPointOnEllipse(angleDeg: number): { x: number; y: number } {
    const theta = (angleDeg * Math.PI) / 180;
    return {
      x: cx + a * Math.cos(theta),
      y: cy + b * Math.sin(theta),
    };
  }

  function init(canv: HTMLCanvasElement): void {
    canvas = canv;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    computeDerived();
  }

  function update(dt: number, params: Record<string, number>): void {
    semiMajor = params.semiMajor ?? 200;
    eccentricity = params.eccentricity ?? 0.6;
    traceAngle = params.traceAngle ?? 45;
    computeDerived();
    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawAxes(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    // Horizontal axis
    ctx.beginPath();
    ctx.moveTo(cx - a - 40, cy);
    ctx.lineTo(cx + a + 40, cy);
    ctx.stroke();

    // Vertical axis
    ctx.beginPath();
    ctx.moveTo(cx, cy - b - 40);
    ctx.lineTo(cx, cy + b + 40);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("x", cx + a + 30, cy + 15);
    ctx.fillText("y", cx + 10, cy - b - 25);

    ctx.restore();
  }

  function drawEllipse(): void {
    ctx.save();

    // Ellipse path
    ctx.beginPath();
    ctx.ellipse(cx, cy, a, b, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Semi-transparent fill
    ctx.fillStyle = "rgba(56, 189, 248, 0.05)";
    ctx.fill();

    ctx.restore();
  }

  function drawFoci(): void {
    const f1x = cx - c;
    const f2x = cx + c;

    // Focus 1
    ctx.beginPath();
    ctx.arc(f1x, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Focus 2
    ctx.beginPath();
    ctx.arc(f2x, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F₁", f1x, cy + 22);
    ctx.fillText("F₂", f2x, cy + 22);

    // Center point
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("O", cx, cy + 15);
  }

  function drawTracePoint(): void {
    const pt = getPointOnEllipse(traceAngle);
    const f1x = cx - c;
    const f2x = cx + c;

    // Lines from foci to point
    ctx.save();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    // F1 to point
    ctx.beginPath();
    ctx.moveTo(f1x, cy);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    // F2 to point
    ctx.beginPath();
    ctx.moveTo(f2x, cy);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    // Distance labels
    const d1 = Math.sqrt((pt.x - f1x) ** 2 + (pt.y - cy) ** 2);
    const d2 = Math.sqrt((pt.x - f2x) ** 2 + (pt.y - cy) ** 2);

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";

    // d1 label
    const mid1x = (f1x + pt.x) / 2;
    const mid1y = (cy + pt.y) / 2;
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`d₁ = ${d1.toFixed(0)}`, mid1x - 15, mid1y - 8);

    // d2 label
    const mid2x = (f2x + pt.x) / 2;
    const mid2y = (cy + pt.y) / 2;
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`d₂ = ${d2.toFixed(0)}`, mid2x + 15, mid2y - 8);

    // Trace point (pen)
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#22c55e";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pen label
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("P", pt.x, pt.y - 14);

    // Sum label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`d₁ + d₂ = ${(d1 + d2).toFixed(0)} = 2a = ${(2 * a).toFixed(0)}`, cx, cy + b + 40);
  }

  function drawDimensions(): void {
    ctx.save();

    // Semi-major axis line
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // a dimension
    ctx.beginPath();
    ctx.moveTo(cx, cy - b - 25);
    ctx.lineTo(cx + a, cy - b - 25);
    ctx.stroke();
    ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`a = ${a.toFixed(0)}`, cx + a / 2, cy - b - 30);

    // b dimension
    ctx.beginPath();
    ctx.moveTo(cx + a + 20, cy);
    ctx.lineTo(cx + a + 20, cy - b);
    ctx.stroke();
    ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
    ctx.save();
    ctx.translate(cx + a + 30, cy - b / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`b = ${b.toFixed(0)}`, 0, 0);
    ctx.restore();

    // c dimension (focal distance)
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.beginPath();
    ctx.moveTo(cx, cy + 25);
    ctx.lineTo(cx + c, cy + 25);
    ctx.stroke();
    ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText(`c = ${c.toFixed(0)}`, cx + c / 2, cy + 38);

    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawEquation(): void {
    ctx.save();
    const pw = 300;
    const ph = 100;
    const px = 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Ellipse", px + 12, py + 22);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`x²/${(a * a).toFixed(0)} + y²/${(b * b).toFixed(0)} = 1`, px + 12, py + 44);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`e = c/a = ${eccentricity.toFixed(2)}`, px + 12, py + 64);
    ctx.fillText(`c² = a² − b² = ${(a * a).toFixed(0)} − ${(b * b).toFixed(0)} = ${(c * c).toFixed(0)}`, px + 12, py + 80);

    ctx.restore();
  }

  function drawKeplerNote(): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    const pw = 260;
    const ph = 40;
    const px = W - pw - 15;
    const py = H - ph - 15;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 6);
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Kepler's 1st Law: Planets orbit in ellipses", px + 10, py + 16);
    ctx.fillText("with the Sun at one focus.", px + 10, py + 30);
    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawAxes();
    drawEllipse();
    drawDimensions();
    drawFoci();
    drawTracePoint();
    drawEquation();
    drawKeplerNote();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const pt = getPointOnEllipse(traceAngle);
    const f1x = cx - c;
    const f2x = cx + c;
    const d1 = Math.sqrt((pt.x - f1x) ** 2 + (pt.y - cy) ** 2);
    const d2 = Math.sqrt((pt.x - f2x) ** 2 + (pt.y - cy) ** 2);
    return (
      `Ellipse: semi-major a=${a.toFixed(0)}, semi-minor b=${b.toFixed(0)}, ` +
      `focal distance c=${c.toFixed(0)}, eccentricity e=${eccentricity.toFixed(2)}. ` +
      `Pen at angle ${traceAngle.toFixed(0)}°: d₁=${d1.toFixed(0)}, d₂=${d2.toFixed(0)}, ` +
      `d₁+d₂=${(d1 + d2).toFixed(0)} = 2a=${(2 * a).toFixed(0)} (constant). ` +
      `Equation: x²/a² + y²/b² = 1. An ellipse is the locus of points where the sum of distances to two foci is constant.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
    computeDerived();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EllipseFactory;
