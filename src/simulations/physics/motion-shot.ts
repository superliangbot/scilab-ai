import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MotionShotFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("motion-shot") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let launchAngle = 45;
  let initialSpeed = 25;
  let gravity = 9.81;
  let numFrames = 12;

  // Motion frames
  interface Frame {
    t: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }
  let frames: Frame[] = [];
  let totalFlightTime = 0;
  let maxRange = 0;
  let maxHeight = 0;

  const MARGIN = { left: 60, right: 40, top: 50, bottom: 60 };

  function computeTrajectory(): void {
    const rad = (launchAngle * Math.PI) / 180;
    const v0x = initialSpeed * Math.cos(rad);
    const v0y = initialSpeed * Math.sin(rad);
    totalFlightTime = (2 * v0y) / gravity;
    maxRange = v0x * totalFlightTime;
    maxHeight = (v0y * v0y) / (2 * gravity);

    if (totalFlightTime < 0.01) totalFlightTime = 0.01;
    if (maxRange < 0.1) maxRange = 1;
    if (maxHeight < 0.1) maxHeight = 1;

    frames = [];
    const dt = totalFlightTime / Math.max(numFrames - 1, 1);
    for (let i = 0; i < numFrames; i++) {
      const t = i * dt;
      frames.push({
        t,
        x: v0x * t,
        y: v0y * t - 0.5 * gravity * t * t,
        vx: v0x,
        vy: v0y - gravity * t,
      });
    }
  }

  function simToCanvas(sx: number, sy: number): { cx: number; cy: number } {
    const drawW = width - MARGIN.left - MARGIN.right;
    const drawH = height - MARGIN.top - MARGIN.bottom;
    const scaleX = drawW / (maxRange * 1.15);
    const scaleY = drawH / (maxHeight * 1.5);
    const scale = Math.min(scaleX, scaleY);
    return {
      cx: MARGIN.left + sx * scale,
      cy: height - MARGIN.bottom - sy * scale,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeTrajectory();
  }

  function update(dt: number, params: Record<string, number>): void {
    launchAngle = params.launchAngle ?? 45;
    initialSpeed = params.initialSpeed ?? 25;
    gravity = params.gravity ?? 9.81;
    numFrames = Math.round(params.numFrames ?? 12);
    time += dt;
    computeTrajectory();
  }

  function drawGrid(): void {
    const { cy: groundY } = simToCanvas(0, 0);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
    ctx.lineWidth = 1;

    // Horizontal grid
    const yStep = maxHeight > 10 ? Math.ceil(maxHeight / 5) : Math.ceil(maxHeight * 2) / 2;
    for (let yVal = 0; yVal <= maxHeight * 1.4; yVal += yStep) {
      const { cy } = simToCanvas(0, yVal);
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, cy);
      ctx.lineTo(width - MARGIN.right, cy);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(yVal.toFixed(1) + " m", MARGIN.left - 8, cy + 3);
    }

    // Vertical grid
    const xStep = maxRange > 10 ? Math.ceil(maxRange / 8) : Math.ceil(maxRange * 2) / 2;
    for (let xVal = 0; xVal <= maxRange * 1.1; xVal += xStep) {
      const { cx } = simToCanvas(xVal, 0);
      ctx.beginPath();
      ctx.moveTo(cx, MARGIN.top);
      ctx.lineTo(cx, groundY);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(xVal.toFixed(1), cx, groundY + 15);
    }

    // Axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, MARGIN.top);
    ctx.lineTo(MARGIN.left, groundY);
    ctx.lineTo(width - MARGIN.right, groundY);
    ctx.stroke();
  }

  function drawTrajectoryPath(): void {
    ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const rad = (launchAngle * Math.PI) / 180;
    const v0x = initialSpeed * Math.cos(rad);
    const v0y = initialSpeed * Math.sin(rad);
    let first = true;
    for (let t = 0; t <= totalFlightTime; t += totalFlightTime / 100) {
      const sx = v0x * t;
      const sy = v0y * t - 0.5 * gravity * t * t;
      const { cx, cy } = simToCanvas(sx, Math.max(sy, 0));
      if (first) { ctx.moveTo(cx, cy); first = false; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFrames(): void {
    const visibleCount = Math.min(
      frames.length,
      Math.floor((time / totalFlightTime) * frames.length) + 1
    );

    for (let i = 0; i < visibleCount && i < frames.length; i++) {
      const f = frames[i];
      const { cx, cy } = simToCanvas(f.x, Math.max(f.y, 0));
      const alpha = 0.3 + 0.7 * (i / Math.max(frames.length - 1, 1));

      // Motion blur trail (afterimage)
      if (i > 0) {
        const prev = frames[i - 1];
        const { cx: px, cy: py } = simToCanvas(prev.x, Math.max(prev.y, 0));
        const grad = ctx.createLinearGradient(px, py, cx, cy);
        grad.addColorStop(0, `rgba(251, 191, 36, 0)`);
        grad.addColorStop(1, `rgba(251, 191, 36, ${alpha * 0.3})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }

      // Ball with glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
      glow.addColorStop(0, `rgba(251, 191, 36, ${alpha * 0.3})`);
      glow.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      const ballGrad = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, 8);
      ballGrad.addColorStop(0, "#fff");
      ballGrad.addColorStop(0.3, `rgba(251, 191, 36, ${alpha})`);
      ballGrad.addColorStop(1, `rgba(180, 100, 0, ${alpha})`);
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Velocity vector
      const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      const vScale = 1.5;
      const endX = cx + f.vx * vScale;
      const endY = cy - f.vy * vScale;

      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(-(endY - cy), endX - cx);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 6 * Math.cos(angle - 0.4), endY + 6 * Math.sin(angle - 0.4));
      ctx.lineTo(endX - 6 * Math.cos(angle + 0.4), endY + 6 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.fill();

      // Frame label
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${f.t.toFixed(2)}s`, cx, cy + 18);
    }
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(0.7, "#1e293b");
    bgGrad.addColorStop(1, "#1a3020");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground
    const { cy: groundY } = simToCanvas(0, 0);
    ctx.fillStyle = "#1e3a1e";
    ctx.fillRect(0, groundY, width, height - groundY);

    drawGrid();
    drawTrajectoryPath();
    drawFrames();

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Motion Shot — Multi-Exposure Photography", width / 2, 28);

    // Info panel
    const panelW = 210;
    const panelX = width - panelW - 12;
    const panelY = 40;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, 110, 6);
    ctx.fill();

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`Angle: ${launchAngle.toFixed(1)}°`, panelX + 10, panelY + 18);
    ctx.fillText(`Speed: ${initialSpeed.toFixed(1)} m/s`, panelX + 10, panelY + 34);
    ctx.fillText(`Max Height: ${maxHeight.toFixed(2)} m`, panelX + 10, panelY + 50);
    ctx.fillText(`Range: ${maxRange.toFixed(2)} m`, panelX + 10, panelY + 66);
    ctx.fillText(`Flight Time: ${totalFlightTime.toFixed(2)} s`, panelX + 10, panelY + 82);
    ctx.fillText(`Frames: ${numFrames}`, panelX + 10, panelY + 98);
  }

  function reset(): void {
    time = 0;
    computeTrajectory();
  }

  function destroy(): void {
    frames = [];
  }

  function getStateDescription(): string {
    return (
      `Motion Shot: angle=${launchAngle}°, speed=${initialSpeed} m/s, g=${gravity} m/s². ` +
      `${numFrames} exposure frames over ${totalFlightTime.toFixed(2)}s flight. ` +
      `Max height: ${maxHeight.toFixed(2)} m, range: ${maxRange.toFixed(2)} m. ` +
      `Shows multi-exposure stroboscopic photograph of projectile motion with velocity vectors.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MotionShotFactory;
