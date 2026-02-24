import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Constant Velocity Motion
 * Object moves at constant speed. Position-time graph (linear) and
 * velocity-time graph (horizontal line) update in real time.
 * Newton's 1st law: ΣF = 0 → constant velocity.
 */

const ConstantVelocityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("constant-velocity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let velocity = 5; // m/s
  let showGraphs = 1;
  let showMarkers = 1;
  let totalTime = 10; // s

  let position = 0; // m
  let markers: { t: number; x: number }[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    position = 0;
    markers = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    velocity = params.velocity ?? 5;
    showGraphs = params.showGraphs ?? 1;
    showMarkers = params.showMarkers ?? 1;
    totalTime = params.totalTime ?? 10;

    const step = Math.min(dt, 0.033);
    position += velocity * step;

    // Record marker every 1 second
    if (markers.length === 0 || time - markers[markers.length - 1].t >= 1) {
      markers.push({ t: time, x: position });
    }

    // Reset when past total time
    if (time > totalTime) {
      time = 0;
      position = 0;
      markers = [];
    }

    time += step;
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const roadY = height * 0.22;
    const roadH = 40;
    const graphArea = showGraphs >= 1;

    // ── Road ──
    ctx.fillStyle = "rgba(60,70,90,0.5)";
    ctx.fillRect(0, roadY, width, roadH);
    // Centre line
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = "rgba(255,255,100,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, roadY + roadH / 2);
    ctx.lineTo(width, roadY + roadH / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance markers on road
    const maxDist = velocity * totalTime;
    const pxPerMeter = (width - 40) / maxDist;

    if (showMarkers >= 1) {
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "center";
      for (let d = 0; d <= maxDist; d += Math.max(1, Math.round(maxDist / 10))) {
        const x = 20 + d * pxPerMeter;
        ctx.fillText(`${d}m`, x, roadY + roadH + 14);
        ctx.beginPath();
        ctx.moveTo(x, roadY + roadH);
        ctx.lineTo(x, roadY + roadH + 4);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Position markers (dots where the object was each second)
    if (showMarkers >= 1) {
      for (const m of markers) {
        const mx = 20 + m.x * pxPerMeter;
        ctx.beginPath();
        ctx.arc(mx, roadY + roadH / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100,200,255,0.4)";
        ctx.fill();
      }
    }

    // Moving object (car-like)
    const objX = 20 + position * pxPerMeter;
    const objW = 30;
    const objH = 18;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.roundRect(objX - objW / 2, roadY + roadH / 2 - objH / 2, objW, objH, 4);
    ctx.fill();
    // Wheels
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(objX - 8, roadY + roadH / 2 + objH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(objX + 8, roadY + roadH / 2 + objH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Velocity arrow
    if (velocity !== 0) {
      const arrowLen = 30;
      const dir = velocity > 0 ? 1 : -1;
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(objX + dir * objW / 2 + 4, roadY + roadH / 2 - objH / 2 - 8);
      ctx.lineTo(objX + dir * objW / 2 + 4 + dir * arrowLen, roadY + roadH / 2 - objH / 2 - 8);
      ctx.stroke();
      ctx.beginPath();
      const tipX = objX + dir * objW / 2 + 4 + dir * arrowLen;
      const tipY = roadY + roadH / 2 - objH / 2 - 8;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - dir * 6, tipY - 4);
      ctx.lineTo(tipX - dir * 6, tipY + 4);
      ctx.closePath();
      ctx.fillStyle = "#60a5fa";
      ctx.fill();
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillStyle = "#93c5fd";
      ctx.textAlign = "center";
      ctx.fillText(`v = ${velocity} m/s`, objX + dir * (objW / 2 + arrowLen / 2), roadY + roadH / 2 - objH / 2 - 20);
    }

    // ── Graphs ──
    if (graphArea) {
      const gLeft = width * 0.08;
      const gRight = width * 0.48;
      const gTop = height * 0.48;
      const gBottom = height * 0.88;
      const gW = gRight - gLeft;
      const gH = gBottom - gTop;

      // Position-time graph
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(gLeft, gTop, gW, gH);
      ctx.strokeStyle = "rgba(150,180,220,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(gLeft, gTop, gW, gH);

      // Axes
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "rgba(200,210,240,0.6)";
      ctx.textAlign = "center";
      ctx.fillText("Position vs Time", gLeft + gW / 2, gTop - 6);
      ctx.fillText("t (s)", gLeft + gW / 2, gBottom + 14);
      ctx.save();
      ctx.translate(gLeft - 14, gTop + gH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("x (m)", 0, 0);
      ctx.restore();

      // Position line (linear)
      ctx.beginPath();
      const tFrac = Math.min(1, time / totalTime);
      ctx.moveTo(gLeft, gBottom);
      ctx.lineTo(gLeft + tFrac * gW, gBottom - (position / maxDist) * gH);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Current point
      ctx.beginPath();
      ctx.arc(gLeft + tFrac * gW, gBottom - (position / maxDist) * gH, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();

      // Velocity-time graph (right)
      const g2Left = width * 0.56;
      const g2Right = width * 0.92;
      const g2W = g2Right - g2Left;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(g2Left, gTop, g2W, gH);
      ctx.strokeStyle = "rgba(150,180,220,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(g2Left, gTop, g2W, gH);

      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "rgba(200,210,240,0.6)";
      ctx.textAlign = "center";
      ctx.fillText("Velocity vs Time", g2Left + g2W / 2, gTop - 6);
      ctx.fillText("t (s)", g2Left + g2W / 2, gBottom + 14);

      // Horizontal velocity line
      const vFrac = Math.min(1, Math.abs(velocity) / 50);
      const vy = gBottom - vFrac * gH;
      ctx.beginPath();
      ctx.moveTo(g2Left, vy);
      ctx.lineTo(g2Left + tFrac * g2W, vy);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#ef4444";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`v = ${velocity} m/s`, g2Left + 6, vy - 6);
    }

    // Info
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 200, 52, 6);
    ctx.fill();
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.fillText("Constant Velocity Motion", 16, 24);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`x = ${position.toFixed(1)} m | t = ${time.toFixed(1)} s`, 16, 40);
    ctx.fillText(`ΣF = 0 → v = constant`, 16, 54);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    position = 0;
    markers = [];
  }

  function destroy(): void { markers = []; }

  function getStateDescription(): string {
    return (
      `Constant Velocity: v = ${velocity} m/s, position = ${position.toFixed(1)} m, time = ${time.toFixed(1)} s. ` +
      `Newton's 1st law: an object in motion stays in motion at constant velocity when net force = 0. ` +
      `The position-time graph is linear (slope = velocity). The velocity-time graph is a horizontal line.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ConstantVelocityFactory;
