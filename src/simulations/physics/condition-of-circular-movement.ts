import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Condition of Circular Movement
 * Shows that constant-speed circular motion requires a centripetal force
 * perpendicular to velocity at all times. Users adjust the angle between
 * force and velocity to see how the trajectory changes.
 * When force ⊥ velocity → circular orbit (speed constant, direction changes).
 */

const ConditionCircularFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("condition-of-circular-movement") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let forceAngle = 90; // angle between force and velocity (°)
  let forceMagnitude = 150;
  let speed = 100;
  let showTrail = 1;

  // Object state
  let ox = 0;
  let oy = 0;
  let vx = 0;
  let vy = 0;
  let trail: { x: number; y: number }[] = [];

  function initState() {
    ox = width * 0.5;
    oy = height * 0.5;
    vx = speed;
    vy = 0;
    trail = [];
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initState();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newAngle = params.forceAngle ?? 90;
    const newForce = params.forceMagnitude ?? 150;
    const newSpeed = params.speed ?? 100;
    showTrail = params.showTrail ?? 1;

    if (newAngle !== forceAngle || newSpeed !== speed) {
      forceAngle = newAngle;
      speed = newSpeed;
      forceMagnitude = newForce;
      initState();
      time = 0;
      return;
    }
    forceAngle = newAngle;
    forceMagnitude = newForce;
    speed = newSpeed;

    const step = Math.min(dt, 0.02);

    // Velocity direction
    const vMag = Math.sqrt(vx * vx + vy * vy);
    if (vMag < 0.01) return;
    const vdx = vx / vMag;
    const vdy = vy / vMag;

    // Force direction: rotate velocity vector by forceAngle
    const rad = forceAngle * Math.PI / 180;
    const fdx = vdx * Math.cos(rad) - vdy * Math.sin(rad);
    const fdy = vdx * Math.sin(rad) + vdy * Math.cos(rad);

    // Apply force (F = ma, a = F/m, assume m=1)
    const fx = fdx * forceMagnitude;
    const fy = fdy * forceMagnitude;

    vx += fx * step;
    vy += fy * step;

    // If force is perpendicular (90°), maintain constant speed
    if (Math.abs(forceAngle) === 90) {
      const newMag = Math.sqrt(vx * vx + vy * vy);
      if (newMag > 0) {
        vx = vx / newMag * speed;
        vy = vy / newMag * speed;
      }
    }

    ox += vx * step;
    oy += vy * step;

    // Wrap around
    if (ox < 0) ox += width;
    if (ox > width) ox -= width;
    if (oy < 0) oy += height;
    if (oy > height) oy -= height;

    // Trail
    trail.push({ x: ox, y: oy });
    if (trail.length > 500) trail.shift();

    time += step;
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Draw trail
    if (showTrail >= 1 && trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const alpha = i / trail.length * 0.6;
        const dx = trail[i].x - trail[i - 1].x;
        const dy = trail[i].y - trail[i - 1].y;
        // Skip wrap-around segments
        if (Math.abs(dx) > width / 2 || Math.abs(dy) > height / 2) continue;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Object
    const objR = Math.max(8, Math.min(width, height) * 0.02);
    const grad = ctx.createRadialGradient(ox - objR * 0.2, oy - objR * 0.2, 0, ox, oy, objR);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(0.5, "#60a5fa");
    grad.addColorStop(1, "#1e40af");
    ctx.beginPath();
    ctx.arc(ox, oy, objR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Velocity vector (blue arrow)
    const vMag = Math.sqrt(vx * vx + vy * vy);
    if (vMag > 1) {
      const vLen = 50;
      const vdx = vx / vMag;
      const vdy = vy / vMag;
      const tipX = ox + vdx * vLen;
      const tipY = oy + vdy * vLen;
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // Arrowhead
      const perpX = -vdy;
      const perpY = vdx;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - vdx * 10 + perpX * 5, tipY - vdy * 10 + perpY * 5);
      ctx.lineTo(tipX - vdx * 10 - perpX * 5, tipY - vdy * 10 - perpY * 5);
      ctx.closePath();
      ctx.fillStyle = "#3b82f6";
      ctx.fill();

      // Force vector (red arrow)
      const rad = forceAngle * Math.PI / 180;
      const fdx = vdx * Math.cos(rad) - vdy * Math.sin(rad);
      const fdy = vdx * Math.sin(rad) + vdy * Math.cos(rad);
      const fLen = 40;
      const fTipX = ox + fdx * fLen;
      const fTipY = oy + fdy * fLen;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(fTipX, fTipY);
      ctx.stroke();
      const fPerpX = -fdy;
      const fPerpY = fdx;
      ctx.beginPath();
      ctx.moveTo(fTipX, fTipY);
      ctx.lineTo(fTipX - fdx * 10 + fPerpX * 5, fTipY - fdy * 10 + fPerpY * 5);
      ctx.lineTo(fTipX - fdx * 10 - fPerpX * 5, fTipY - fdy * 10 - fPerpY * 5);
      ctx.closePath();
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      // Labels
      ctx.font = `bold ${Math.max(10, width * 0.016)}px system-ui, sans-serif`;
      ctx.fillStyle = "#60a5fa";
      ctx.textAlign = "left";
      ctx.fillText("v (velocity)", tipX + 6, tipY - 4);
      ctx.fillStyle = "#f87171";
      ctx.fillText("F (force)", fTipX + 6, fTipY - 4);

      // Angle arc
      ctx.beginPath();
      const arcR = 20;
      const startAngle = Math.atan2(vdy, vdx);
      const endAngle = Math.atan2(fdy, fdx);
      ctx.arc(ox, oy, arcR, startAngle, endAngle, forceAngle < 0);
      ctx.strokeStyle = "rgba(255,200,50,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,200,50,0.8)";
      ctx.fillText(`${forceAngle}°`, ox + arcR + 4, oy - 4);
    }

    // Info panel
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 260, 85, 6);
    ctx.fill();
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.fillText("Condition of Circular Movement", 16, 24);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Force-Velocity angle: ${forceAngle}°`, 16, 42);
    const trajectory = Math.abs(forceAngle) === 90 ? "Circular (constant speed)" :
      Math.abs(forceAngle) < 90 ? "Spiral outward (speeding up)" : "Spiral inward (slowing down)";
    ctx.fillText(`Trajectory: ${trajectory}`, 16, 58);
    ctx.fillText(`Speed: ${vMag.toFixed(0)} px/s`, 16, 74);
    ctx.fillText(`Time: ${time.toFixed(1)}s`, 16, 88);
    ctx.restore();

    // Bottom formula
    ctx.save();
    ctx.font = `${Math.max(10, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160,180,220,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("Circular motion requires F ⊥ v (centripetal force)", width / 2, height - 8);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    initState();
  }

  function destroy(): void { trail = []; }

  function getStateDescription(): string {
    const vMag = Math.sqrt(vx * vx + vy * vy);
    const trajectory = Math.abs(forceAngle) === 90 ? "circular" :
      Math.abs(forceAngle) < 90 ? "spiral outward" : "spiral inward";
    return (
      `Condition of Circular Movement: force-velocity angle = ${forceAngle}°. ` +
      `Trajectory: ${trajectory}. Speed: ${vMag.toFixed(0)} px/s. ` +
      `At 90°, force is centripetal — it changes direction but not speed, producing uniform circular motion. ` +
      `Any other angle changes both speed and direction.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initState();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ConditionCircularFactory;
