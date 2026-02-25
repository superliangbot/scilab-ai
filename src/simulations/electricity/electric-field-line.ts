import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectricFieldLineFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electric-field-line") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let charge1 = 3; // positive
  let charge2 = -3; // negative
  let lineCount = 16;
  let showVectors = 1;

  // Charge positions
  let q1x = 0;
  let q1y = 0;
  let q2x = 0;
  let q2y = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    q1x = width * 0.3;
    q1y = height * 0.5;
    q2x = width * 0.7;
    q2y = height * 0.5;
  }

  function update(dt: number, params: Record<string, number>): void {
    charge1 = params.charge1 ?? 3;
    charge2 = params.charge2 ?? -3;
    lineCount = Math.round(params.lineCount ?? 16);
    showVectors = params.showVectors ?? 1;
    time += dt;
  }

  // Calculate electric field at point (px, py)
  // NOTE: This calculates RELATIVE field strength for visualization
  // The Coulomb constant k = 1/(4πε₀) ≈ 8.99×10⁹ N⋅m²/C² is factored out
  // Actual field would be: E = k × (q/r²)
  function fieldAt(px: number, py: number): { ex: number; ey: number } {
    let ex = 0;
    let ey = 0;
    const charges = [
      { x: q1x, y: q1y, q: charge1 },
      { x: q2x, y: q2y, q: charge2 },
    ];

    for (const c of charges) {
      const dx = px - c.x;
      const dy = py - c.y;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      if (r < 5) continue;
      const E = c.q / r2; // Relative field strength (k factored out for visualization)
      ex += E * (dx / r);
      ey += E * (dy / r);
    }

    return { ex, ey };
  }

  // Trace a field line from starting point
  function traceFieldLine(startX: number, startY: number, forward: boolean): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    let x = startX;
    let y = startY;
    const step = forward ? 3 : -3;
    const maxSteps = 500;

    for (let i = 0; i < maxSteps; i++) {
      points.push({ x, y });

      const { ex, ey } = fieldAt(x, y);
      const mag = Math.sqrt(ex * ex + ey * ey);
      if (mag < 1e-6) break;

      x += (ex / mag) * step;
      y += (ey / mag) * step;

      // Stop if out of bounds
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) break;

      // Stop if very close to a negative charge (field line ends there)
      const d1 = Math.sqrt((x - q1x) ** 2 + (y - q1y) ** 2);
      const d2 = Math.sqrt((x - q2x) ** 2 + (y - q2y) ** 2);
      if (d1 < 12 || d2 < 12) {
        points.push({ x, y });
        break;
      }
    }

    return points;
  }

  function drawFieldLine(points: { x: number; y: number }[], color: string): void {
    if (points.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw arrowheads along the line
    const arrowInterval = Math.floor(points.length / 4);
    if (arrowInterval > 0) {
      for (let i = arrowInterval; i < points.length - 1; i += arrowInterval) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const angle = Math.atan2(dy, dx);
        const headLen = 6;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(
          points[i].x - headLen * Math.cos(angle - 0.4),
          points[i].y - headLen * Math.sin(angle - 0.4)
        );
        ctx.lineTo(
          points[i].x - headLen * Math.cos(angle + 0.4),
          points[i].y - headLen * Math.sin(angle + 0.4)
        );
        ctx.fill();
      }
    }
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1e";
    ctx.fillRect(0, 0, width, height);

    // Draw field intensity map (subtle background color)
    const gridStep = 12;
    for (let gx = 0; gx < width; gx += gridStep) {
      for (let gy = 0; gy < height; gy += gridStep) {
        const { ex, ey } = fieldAt(gx + gridStep / 2, gy + gridStep / 2);
        const mag = Math.sqrt(ex * ex + ey * ey);
        const intensity = Math.min(1, mag * 50);
        ctx.fillStyle = `rgba(30,30,80,${intensity * 0.3})`;
        ctx.fillRect(gx, gy, gridStep, gridStep);
      }
    }

    // Draw field vectors (grid of small arrows)
    if (showVectors) {
      const vStep = 40;
      for (let gx = vStep; gx < width; gx += vStep) {
        for (let gy = vStep; gy < height; gy += vStep) {
          const { ex, ey } = fieldAt(gx, gy);
          const mag = Math.sqrt(ex * ex + ey * ey);
          if (mag < 1e-5) continue;

          const arrowLen = Math.min(15, mag * 200);
          const nx = ex / mag;
          const ny = ey / mag;

          ctx.strokeStyle = `rgba(100,150,255,${Math.min(0.4, mag * 30)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + nx * arrowLen, gy + ny * arrowLen);
          ctx.stroke();
        }
      }
    }

    // Trace and draw field lines
    // Start lines from positive charges
    const lineColor = "rgba(100,200,255,0.7)";

    // Lines from charge 1
    if (charge1 > 0) {
      const numLines = Math.round(lineCount * Math.abs(charge1) / (Math.abs(charge1) + Math.abs(charge2)));
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        const startR = 15;
        const sx = q1x + startR * Math.cos(angle);
        const sy = q1y + startR * Math.sin(angle);
        const pts = traceFieldLine(sx, sy, true);
        drawFieldLine(pts, lineColor);
      }
    } else if (charge1 < 0) {
      const numLines = Math.round(lineCount * Math.abs(charge1) / (Math.abs(charge1) + Math.abs(charge2)));
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        const startR = 15;
        const sx = q1x + startR * Math.cos(angle);
        const sy = q1y + startR * Math.sin(angle);
        const pts = traceFieldLine(sx, sy, false);
        drawFieldLine(pts.reverse(), lineColor);
      }
    }

    // Lines from charge 2
    if (charge2 > 0) {
      const numLines = Math.round(lineCount * Math.abs(charge2) / (Math.abs(charge1) + Math.abs(charge2)));
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        const startR = 15;
        const sx = q2x + startR * Math.cos(angle);
        const sy = q2y + startR * Math.sin(angle);
        const pts = traceFieldLine(sx, sy, true);
        drawFieldLine(pts, lineColor);
      }
    } else if (charge2 < 0 && charge1 <= 0) {
      // Only draw from charge2 if charge1 is not positive (avoid double-drawing)
      const numLines = Math.round(lineCount * Math.abs(charge2) / (Math.abs(charge1) + Math.abs(charge2)));
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        const startR = 15;
        const sx = q2x + startR * Math.cos(angle);
        const sy = q2y + startR * Math.sin(angle);
        const pts = traceFieldLine(sx, sy, false);
        drawFieldLine(pts.reverse(), lineColor);
      }
    }

    // Draw charges
    for (const charge of [{ x: q1x, y: q1y, q: charge1 }, { x: q2x, y: q2y, q: charge2 }]) {
      const isPositive = charge.q > 0;
      const color = isPositive ? "#ff4444" : "#4444ff";

      // Glow
      const glow = ctx.createRadialGradient(charge.x, charge.y, 0, charge.x, charge.y, 35);
      glow.addColorStop(0, isPositive ? "rgba(255,80,80,0.3)" : "rgba(80,80,255,0.3)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(charge.x, charge.y, 35, 0, Math.PI * 2);
      ctx.fill();

      // Charge body
      const grad = ctx.createRadialGradient(charge.x - 3, charge.y - 3, 0, charge.x, charge.y, 18);
      grad.addColorStop(0, isPositive ? "#ff8888" : "#8888ff");
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(charge.x, charge.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isPositive ? "+" : "−", charge.x, charge.y);
      ctx.textBaseline = "alphabetic";

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "11px system-ui, sans-serif";
      const sign = charge.q > 0 ? "+" : "";
      ctx.fillText(`q = ${sign}${charge.q}`, charge.x, charge.y + 30);
    }

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 280, 90, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Electric Field Lines", 16, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#ccc";
    ctx.fillText("Lines: + charge → − charge", 16, 46);
    ctx.fillText("Density ∝ field strength", 16, 62);
    ctx.fillText("E = kq/r² (Coulomb's Law)", 16, 78);

    const chargeSep = Math.sqrt((q2x - q1x) ** 2 + (q2y - q1y) ** 2);
    ctx.fillStyle = "#888";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Separation: ${chargeSep.toFixed(0)}px`, 16, 92);

    // Rules
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Field lines start at (+) and end at (−) charges. They never cross.", width / 2, height - 10);
  }

  function reset(): void {
    time = 0;
    q1x = width * 0.3;
    q1y = height * 0.5;
    q2x = width * 0.7;
    q2y = height * 0.5;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const sep = Math.sqrt((q2x - q1x) ** 2 + (q2y - q1y) ** 2);
    const midField = fieldAt((q1x + q2x) / 2, (q1y + q2y) / 2);
    const midMag = Math.sqrt(midField.ex ** 2 + midField.ey ** 2);
    return (
      `Electric Field Lines: charge1=${charge1 > 0 ? "+" : ""}${charge1}, ` +
      `charge2=${charge2 > 0 ? "+" : ""}${charge2}, ${lineCount} field lines. ` +
      `Separation=${sep.toFixed(0)}px, midpoint field magnitude≈${midMag.toFixed(4)}. ` +
      `Field lines start at positive charges and end at negative charges. ` +
      `Line density indicates field strength. E = kq/r² (Coulomb's law).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    q1x = width * 0.3;
    q1y = height * 0.5;
    q2x = width * 0.7;
    q2y = height * 0.5;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectricFieldLineFactory;
