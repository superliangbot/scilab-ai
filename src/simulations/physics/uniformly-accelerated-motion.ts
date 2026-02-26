import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const UniformlyAcceleratedMotionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("uniformly-accelerated-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let acceleration = 9.81;
  let initialVelocity = 0;
  let showVectors = 1;

  let ballY = 0;
  let ballVelocity = 0;
  const trail: { y: number; t: number; v: number }[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    ballY = 0;
    ballVelocity = 0;
    trail.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    acceleration = params.acceleration ?? 9.81;
    initialVelocity = params.initialVelocity ?? 0;
    showVectors = Math.round(params.showVectors ?? 1);

    ballVelocity = initialVelocity + acceleration * time;
    ballY = initialVelocity * time + 0.5 * acceleration * time * time;

    trail.push({ y: ballY, t: time, v: ballVelocity });
    if (trail.length > 600) trail.splice(0, trail.length - 600);

    // Reset at bottom
    const maxDist = height * 0.5;
    const pxPerM = 3;
    if (ballY * pxPerM > maxDist) {
      time = -dt;
      ballY = 0;
      ballVelocity = initialVelocity;
      trail.length = 0;
    }

    time += dt;
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1a1a2e");
    bg.addColorStop(1, "#0f3460");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const pxPerM = 3;
    const colX = width * 0.15;
    const topY = height * 0.12;

    // Drop column
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(colX, topY);
    ctx.lineTo(colX, topY + height * 0.55);
    ctx.stroke();

    // Ruler marks
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let m = 0; m <= 50; m += 5) {
      const y = topY + m * pxPerM;
      if (y > topY + height * 0.55) break;
      ctx.beginPath();
      ctx.moveTo(colX - 8, y);
      ctx.lineTo(colX + 8, y);
      ctx.stroke();
      ctx.fillText(`${m}m`, colX - 12, y + 3);
    }

    // Ball
    const drawY = topY + ballY * pxPerM;
    if (drawY < topY + height * 0.55) {
      // Trail
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < trail.length; i += 3) {
        const ty = topY + trail[i].y * pxPerM;
        if (ty < topY + height * 0.55) {
          ctx.beginPath();
          ctx.arc(colX, ty, 10, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(231,76,60,${i / trail.length * 0.3})`;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Ball
      const grad = ctx.createRadialGradient(colX - 3, drawY - 3, 0, colX, drawY, 12);
      grad.addColorStop(0, "#ff7675");
      grad.addColorStop(1, "#d63031");
      ctx.beginPath();
      ctx.arc(colX, drawY, 12, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Velocity arrow
      if (showVectors) {
        const arrowLen = Math.min(ballVelocity * 2, 80);
        if (arrowLen > 2) {
          ctx.beginPath();
          ctx.moveTo(colX, drawY + 14);
          ctx.lineTo(colX, drawY + 14 + arrowLen);
          ctx.strokeStyle = "#00cec9";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(colX, drawY + 14 + arrowLen);
          ctx.lineTo(colX - 5, drawY + 8 + arrowLen);
          ctx.lineTo(colX + 5, drawY + 8 + arrowLen);
          ctx.closePath();
          ctx.fillStyle = "#00cec9";
          ctx.fill();

          ctx.fillStyle = "#00cec9";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`v = ${ballVelocity.toFixed(1)} m/s`, colX + 18, drawY + 14 + arrowLen / 2);
        }

        // Acceleration arrow (constant)
        ctx.beginPath();
        ctx.moveTo(colX - 25, drawY);
        ctx.lineTo(colX - 25, drawY + 30);
        ctx.strokeStyle = "#fdcb6e";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(colX - 25, drawY + 30);
        ctx.lineTo(colX - 29, drawY + 24);
        ctx.lineTo(colX - 21, drawY + 24);
        ctx.closePath();
        ctx.fillStyle = "#fdcb6e";
        ctx.fill();
        ctx.fillStyle = "#fdcb6e";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("a", colX - 30, drawY + 18);
      }
    }

    // Distance-Time graph (parabolic)
    const gx = width * 0.35;
    const gw = width * 0.28;
    const gy = height * 0.12;
    const gh = height * 0.35;

    drawGraph(gx, gy, gw, gh, "Distance-Time", "t (s)", "d (m)",
      (t: number) => initialVelocity * t + 0.5 * acceleration * t * t, "#e74c3c");

    // Velocity-Time graph (linear)
    const g2x = width * 0.68;
    drawGraph(g2x, gy, gw, gh, "Velocity-Time", "t (s)", "v (m/s)",
      (t: number) => initialVelocity + acceleration * t, "#00cec9");

    // Formulas panel
    const panelY = height * 0.55;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(width * 0.35, panelY, width * 0.6, 80, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Uniformly Accelerated Motion", width * 0.38, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`v = v₀ + at = ${initialVelocity.toFixed(1)} + ${acceleration.toFixed(2)}×${time.toFixed(2)} = ${ballVelocity.toFixed(2)} m/s`, width * 0.38, panelY + 38);
    ctx.fillText(`d = v₀t + ½at² = ${ballY.toFixed(2)} m`, width * 0.38, panelY + 56);
    ctx.fillText(`a = ${acceleration.toFixed(2)} m/s² (constant)`, width * 0.38, panelY + 72);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Uniformly Accelerated Motion", width / 2, 24);
  }

  function drawGraph(gx: number, gy: number, gw: number, gh: number, title: string, xLabel: string, yLabel: string, fn: (t: number) => number, color: string): void {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(gx - 10, gy - 15, gw + 25, gh + 30, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, gx + gw / 2, gy - 3);

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xLabel, gx + gw / 2, gy + gh + 12);

    const maxT = Math.max(3, time + 1);
    const maxVal = fn(maxT) * 1.1 || 10;

    ctx.beginPath();
    for (let i = 0; i <= gw; i++) {
      const t = (i / gw) * maxT;
      const val = fn(t);
      const py = gy + gh - (val / maxVal) * gh;
      if (i === 0) ctx.moveTo(gx + i, Math.max(gy, py));
      else ctx.lineTo(gx + i, Math.max(gy, py));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const curX = gx + (time / maxT) * gw;
    const curY = gy + gh - (fn(time) / maxVal) * gh;
    ctx.beginPath();
    ctx.arc(curX, Math.max(gy, curY), 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function reset(): void {
    time = 0;
    ballY = 0;
    ballVelocity = initialVelocity;
    trail.length = 0;
  }

  function destroy(): void {
    trail.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Uniformly Accelerated Motion: a=${acceleration} m/s², v₀=${initialVelocity} m/s, ` +
      `v=${ballVelocity.toFixed(2)} m/s, d=${ballY.toFixed(2)} m, t=${time.toFixed(2)} s. ` +
      `Parabolic d-t graph, linear v-t graph.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default UniformlyAcceleratedMotionFactory;
