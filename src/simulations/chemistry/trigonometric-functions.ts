import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TrigonometricFunctionsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("trigonometric-functions") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let angle = 0;
  let speed = 1;
  let showTan = 0;
  let amplitude = 1;

  // Trail for graph
  const sinTrail: { angle: number; value: number }[] = [];
  const cosTrail: { angle: number; value: number }[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    sinTrail.length = 0;
    cosTrail.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    speed = params.speed ?? 1;
    showTan = Math.round(params.showTan ?? 0);
    amplitude = params.amplitude ?? 1;

    angle += dt * speed;
    if (angle > Math.PI * 20) angle -= Math.PI * 20;

    sinTrail.push({ angle, value: Math.sin(angle) * amplitude });
    cosTrail.push({ angle, value: Math.cos(angle) * amplitude });

    // Keep only last ~600 points
    if (sinTrail.length > 600) sinTrail.splice(0, sinTrail.length - 600);
    if (cosTrail.length > 600) cosTrail.splice(0, cosTrail.length - 600);

    time += dt;
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a2e");
    bg.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Layout: unit circle on left, graph on right
    const circleR = Math.min(width * 0.2, height * 0.3);
    const cx = width * 0.25;
    const cy = height * 0.45;

    // Unit circle
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
    ctx.stroke();

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(cx - circleR - 20, cy);
    ctx.lineTo(cx + circleR + 20, cy);
    ctx.moveTo(cx, cy - circleR - 20);
    ctx.lineTo(cx, cy + circleR + 20);
    ctx.stroke();

    // Radius line
    const px = cx + Math.cos(angle) * circleR;
    const py = cy - Math.sin(angle) * circleR;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Point on circle
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Sin line (vertical, red)
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cos line (horizontal, blue)
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, cy);
    ctx.strokeStyle = "#3498db";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Tan line (if enabled)
    if (showTan && Math.abs(Math.cos(angle)) > 0.01) {
      const tanVal = Math.tan(angle);
      const tanY = cy - tanVal * circleR;
      const clampedY = Math.max(cy - circleR * 2, Math.min(cy + circleR * 2, tanY));
      ctx.beginPath();
      ctx.moveTo(cx + circleR, cy);
      ctx.lineTo(cx + circleR, clampedY);
      ctx.strokeStyle = "#2ecc71";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Angle arc
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, -angle, angle > 0);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Angle label
    const angleDeg = ((angle % (Math.PI * 2)) / Math.PI * 180);
    const displayDeg = ((angleDeg % 360) + 360) % 360;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`θ = ${displayDeg.toFixed(1)}°`, cx + 25, cy - 5);

    // Graph area
    const graphX = width * 0.45;
    const graphW = width * 0.5;
    const graphY = height * 0.15;
    const graphH = height * 0.65;
    const graphCy = graphY + graphH / 2;

    // Graph axes
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphCy);
    ctx.lineTo(graphX + graphW, graphCy);
    ctx.moveTo(graphX, graphY);
    ctx.lineTo(graphX, graphY + graphH);
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    for (let v = -1; v <= 1; v += 0.5) {
      const gy = graphCy - v * (graphH / 2) * 0.9;
      ctx.beginPath();
      ctx.moveTo(graphX, gy);
      ctx.lineTo(graphX + graphW, gy);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("1", graphX - 4, graphCy - (graphH / 2) * 0.9 + 4);
    ctx.fillText("-1", graphX - 4, graphCy + (graphH / 2) * 0.9 + 4);
    ctx.fillText("0", graphX - 4, graphCy + 4);

    // Draw sin trail
    if (sinTrail.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < sinTrail.length; i++) {
        const t = i / sinTrail.length;
        const gx = graphX + t * graphW;
        const gy = graphCy - sinTrail[i].value * (graphH / 2) * 0.9;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw cos trail
    if (cosTrail.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < cosTrail.length; i++) {
        const t = i / cosTrail.length;
        const gx = graphX + t * graphW;
        const gy = graphCy - cosTrail[i].value * (graphH / 2) * 0.9;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.strokeStyle = "#3498db";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Connection lines from circle to graph
    const sinY = graphCy - Math.sin(angle) * amplitude * (graphH / 2) * 0.9;
    const cosY = graphCy - Math.cos(angle) * amplitude * (graphH / 2) * 0.9;

    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(231,76,60,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(graphX + graphW, sinY);
    ctx.stroke();

    ctx.strokeStyle = "rgba(52,152,219,0.4)";
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(graphX + graphW, cosY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`sin(θ) = ${(Math.sin(angle) * amplitude).toFixed(3)}`, graphX + 10, graphY + 16);
    ctx.fillStyle = "#3498db";
    ctx.fillText(`cos(θ) = ${(Math.cos(angle) * amplitude).toFixed(3)}`, graphX + 10, graphY + 34);
    if (showTan) {
      ctx.fillStyle = "#2ecc71";
      const tanV = Math.abs(Math.cos(angle)) > 0.01 ? Math.tan(angle) : NaN;
      ctx.fillText(`tan(θ) = ${isNaN(tanV) ? "undefined" : (tanV * amplitude).toFixed(3)}`, graphX + 10, graphY + 52);
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Trigonometric Functions", width / 2, 25);

    // Formula
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("(cos θ, sin θ) are coordinates on the unit circle", width / 2, height - 15);
  }

  function reset(): void {
    time = 0;
    angle = 0;
    sinTrail.length = 0;
    cosTrail.length = 0;
  }

  function destroy(): void {
    sinTrail.length = 0;
    cosTrail.length = 0;
  }

  function getStateDescription(): string {
    const deg = ((angle % (Math.PI * 2)) / Math.PI * 180 + 360) % 360;
    return (
      `Trigonometric Functions: θ = ${deg.toFixed(1)}°. ` +
      `sin(θ) = ${Math.sin(angle).toFixed(3)}, cos(θ) = ${Math.cos(angle).toFixed(3)}. ` +
      `Amplitude: ${amplitude}, Speed: ${speed}×. Show tan: ${showTan ? "yes" : "no"}.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TrigonometricFunctionsFactory;
