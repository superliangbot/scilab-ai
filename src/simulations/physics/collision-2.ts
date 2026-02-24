import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Collision 2 — Stacked Ball Drop
 * A light ball (ping pong) sits on top of a heavy ball (golf ball).
 * When dropped, the heavy ball bounces off the floor first, then collides
 * with the lighter ball, transferring momentum and launching it much higher.
 * Conservation of momentum: m1·v1 + m2·v2 = m1·v1' + m2·v2'
 */

const Collision2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("collision-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let mass1 = 5; // heavy (bottom) ball
  let mass2 = 1; // light (top) ball
  let dropHeight = 70; // % of canvas
  let elasticity = 0.95;

  const g = 600; // px/s² gravity

  // Ball state
  let r1 = 20;
  let r2 = 12;
  let y1 = 0; // heavy ball centre y
  let y2 = 0; // light ball centre y
  let vy1 = 0;
  let vy2 = 0;
  let floorY = 0;
  let maxHeight = 0;
  let phase: "ready" | "falling" | "bounced" = "ready";

  function initPositions() {
    r1 = Math.max(12, Math.min(width, height) * 0.04);
    r2 = r1 * 0.6;
    floorY = height * 0.88;
    const startY = height * (1 - dropHeight / 100) * 0.9 + height * 0.05;
    y1 = startY;
    y2 = y1 - r1 - r2 - 2;
    vy1 = 0;
    vy2 = 0;
    maxHeight = 0;
    phase = "ready";
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initPositions();
  }

  function update(dt: number, params: Record<string, number>): void {
    mass1 = params.mass1 ?? 5;
    mass2 = params.mass2 ?? 1;
    dropHeight = params.dropHeight ?? 70;
    elasticity = params.elasticity ?? 0.95;

    const step = Math.min(dt, 0.02);

    if (phase === "ready") {
      // Start falling after a short delay
      if (time > 0.3) phase = "falling";
    }

    if (phase === "falling" || phase === "bounced") {
      // Gravity
      vy1 += g * step;
      vy2 += g * step;

      y1 += vy1 * step;
      y2 += vy2 * step;

      // Heavy ball hits floor
      if (y1 + r1 > floorY) {
        y1 = floorY - r1;
        vy1 = -vy1 * elasticity;
        phase = "bounced";
      }

      // Ball-ball collision (heavy ball going up, light ball coming down)
      const dist = y1 - r1 - (y2 + r2);
      if (dist < 0 && vy1 < vy2) {
        // Elastic collision along 1D
        const e = elasticity;
        const m1 = mass1;
        const m2 = mass2;
        const v1 = vy1;
        const v2 = vy2;
        const newVy1 = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
        const newVy2 = ((m2 - e * m1) * v2 + (1 + e) * m1 * v1) / (m1 + m2);
        vy1 = newVy1;
        vy2 = newVy2;
        // Separate
        y2 = y1 - r1 - r2 - 1;
      }

      // Light ball hits floor (edge case)
      if (y2 + r2 > floorY) {
        y2 = floorY - r2;
        vy2 = -vy2 * elasticity;
      }

      // Ceiling bounce
      if (y2 - r2 < 0) {
        y2 = r2;
        vy2 = Math.abs(vy2) * elasticity;
      }

      // Track max height of light ball
      const heightFromFloor = floorY - y2 - r2;
      if (heightFromFloor > maxHeight) maxHeight = heightFromFloor;
    }

    time += step;
  }

  function drawBall(y: number, r: number, color1: string, color2: string, label: string) {
    const x = width / 2;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `${Math.max(9, r * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Floor
    ctx.fillStyle = "rgba(100,120,160,0.3)";
    ctx.fillRect(0, floorY, width, height - floorY);
    ctx.strokeStyle = "rgba(150,180,220,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(width, floorY);
    ctx.stroke();

    // Velocity arrows
    const x = width / 2;
    const arrowScale = 0.15;
    if (Math.abs(vy1) > 5) {
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + r1 + 10, y1);
      ctx.lineTo(x + r1 + 10, y1 + vy1 * arrowScale);
      ctx.stroke();
      // Arrowhead
      const tipY = y1 + vy1 * arrowScale;
      const dir = vy1 > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x + r1 + 10, tipY);
      ctx.lineTo(x + r1 + 5, tipY - dir * 6);
      ctx.lineTo(x + r1 + 15, tipY - dir * 6);
      ctx.closePath();
      ctx.fillStyle = "#60a5fa";
      ctx.fill();
    }
    if (Math.abs(vy2) > 5) {
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r2 - 10, y2);
      ctx.lineTo(x - r2 - 10, y2 + vy2 * arrowScale);
      ctx.stroke();
      const tipY = y2 + vy2 * arrowScale;
      const dir = vy2 > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x - r2 - 10, tipY);
      ctx.lineTo(x - r2 - 5, tipY - dir * 6);
      ctx.lineTo(x - r2 - 15, tipY - dir * 6);
      ctx.closePath();
      ctx.fillStyle = "#f87171";
      ctx.fill();
    }

    // Draw balls
    drawBall(y1, r1, "#93c5fd", "#1e40af", `${mass1}`);
    drawBall(y2, r2, "#fca5a5", "#991b1b", `${mass2}`);

    // Info panel
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 220, 95, 6);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.fillText("Stacked Ball Drop", 16, 24);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Heavy ball: m=${mass1}, v=${vy1.toFixed(0)} px/s`, 16, 42);
    ctx.fillText(`Light ball: m=${mass2}, v=${vy2.toFixed(0)} px/s`, 16, 58);
    ctx.fillText(`Mass ratio: ${(mass1 / mass2).toFixed(1)}:1`, 16, 74);
    ctx.fillText(`Max height of light ball: ${maxHeight.toFixed(0)} px`, 16, 90);
    ctx.restore();

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Stacked Ball Collision — Momentum Transfer", width / 2, height - 8);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    initPositions();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Stacked ball drop: heavy ball (m=${mass1}) and light ball (m=${mass2}), mass ratio ${(mass1 / mass2).toFixed(1)}:1. ` +
      `Phase: ${phase}. Heavy ball velocity: ${vy1.toFixed(0)} px/s, light ball velocity: ${vy2.toFixed(0)} px/s. ` +
      `Max height of light ball: ${maxHeight.toFixed(0)} px. ` +
      `The lighter ball bounces much higher because the heavier ball transfers disproportionate momentum during elastic collision.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initPositions();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Collision2Factory;
