import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const UniformMotionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("uniform-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let velocity = 5;
  let showTrail = 1;
  let gridScale = 1;

  let ballX = 0;
  const trail: { x: number; t: number }[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    ballX = 0;
    trail.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    velocity = params.velocity ?? 5;
    showTrail = Math.round(params.showTrail ?? 1);
    gridScale = params.gridScale ?? 1;

    ballX += velocity * dt;
    trail.push({ x: ballX, t: time });

    // Reset when ball goes off screen
    const maxDist = width * 0.7 / (gridScale * 5);
    if (ballX > maxDist) {
      ballX = 0;
      trail.length = 0;
    }

    if (trail.length > 500) trail.splice(0, trail.length - 500);

    time += dt;
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1a1a2e");
    bg.addColorStop(1, "#16213e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const trackY = height * 0.25;
    const trackLeft = width * 0.1;
    const trackRight = width * 0.9;
    const trackW = trackRight - trackLeft;
    const pxPerUnit = gridScale * 5;

    // Track
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trackLeft, trackY);
    ctx.lineTo(trackRight, trackY);
    ctx.stroke();

    // Distance markers
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let d = 0; d <= trackW / pxPerUnit; d += 10) {
      const x = trackLeft + d * pxPerUnit;
      if (x > trackRight) break;
      ctx.beginPath();
      ctx.moveTo(x, trackY - 5);
      ctx.lineTo(x, trackY + 5);
      ctx.stroke();
      ctx.fillText(`${d}m`, x, trackY + 18);
    }

    // Ball on track
    const drawX = trackLeft + ballX * pxPerUnit;
    if (drawX <= trackRight) {
      // Trail
      if (showTrail && trail.length > 1) {
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < trail.length - 1; i++) {
          const tx = trackLeft + trail[i].x * pxPerUnit;
          if (tx <= trackRight) {
            ctx.beginPath();
            ctx.arc(tx, trackY, 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(52,152,219,${i / trail.length * 0.3})`;
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // Ball
      const grad = ctx.createRadialGradient(drawX - 3, trackY - 3, 0, drawX, trackY, 12);
      grad.addColorStop(0, "#74b9ff");
      grad.addColorStop(1, "#2980b9");
      ctx.beginPath();
      ctx.arc(drawX, trackY, 12, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Velocity arrow
      ctx.beginPath();
      ctx.moveTo(drawX + 16, trackY);
      ctx.lineTo(drawX + 16 + velocity * 3, trackY);
      ctx.strokeStyle = "#e74c3c";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(drawX + 16 + velocity * 3, trackY);
      ctx.lineTo(drawX + 10 + velocity * 3, trackY - 5);
      ctx.lineTo(drawX + 10 + velocity * 3, trackY + 5);
      ctx.closePath();
      ctx.fillStyle = "#e74c3c";
      ctx.fill();
    }

    // Distance-Time graph
    const gx = width * 0.1;
    const gw = width * 0.35;
    const gy = height * 0.45;
    const gh = height * 0.45;

    drawGraph(gx, gy, gw, gh, "Distance-Time", "t (s)", "d (m)", (t: number) => velocity * t, "#3498db");

    // Velocity-Time graph
    const g2x = width * 0.55;
    drawGraph(g2x, gy, gw, gh, "Velocity-Time", "t (s)", "v (m/s)", () => velocity, "#e74c3c");

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Uniform Motion (Constant Velocity)", width / 2, 22);

    // Info
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`v = ${velocity.toFixed(1)} m/s | d = v × t = ${(velocity * time).toFixed(1)} m | t = ${time.toFixed(1)} s`, width / 2, height - 10);
  }

  function drawGraph(gx: number, gy: number, gw: number, gh: number, title: string, xLabel: string, yLabel: string, fn: (t: number) => number, color: string): void {
    // Background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(gx - 10, gy - 20, gw + 30, gh + 35, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, gx + gw / 2, gy - 6);

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xLabel, gx + gw / 2, gy + gh + 14);
    ctx.save();
    ctx.translate(gx - 8, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Plot
    const maxT = Math.max(5, time);
    const maxVal = fn(maxT) * 1.2 || 10;

    ctx.beginPath();
    for (let i = 0; i <= gw; i++) {
      const t = (i / gw) * maxT;
      const val = fn(t);
      const py = gy + gh - (val / maxVal) * gh;
      if (i === 0) ctx.moveTo(gx + i, py);
      else ctx.lineTo(gx + i, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Current point
    const curX = gx + (time / maxT) * gw;
    const curY = gy + gh - (fn(time) / maxVal) * gh;
    ctx.beginPath();
    ctx.arc(curX, Math.max(gy, curY), 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function reset(): void {
    time = 0;
    ballX = 0;
    trail.length = 0;
  }

  function destroy(): void {
    trail.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Uniform Motion: velocity=${velocity} m/s, distance=${(velocity * time).toFixed(1)} m, ` +
      `time=${time.toFixed(1)} s. Constant velocity → linear d-t graph, flat v-t graph.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default UniformMotionFactory;
