import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface TrailDot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const ParabolicMotionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("parabolic-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let launchAngle = 45;
  let initialVelocity = 30;
  let gravity = 9.8;
  let showVectors = 1;

  // State
  let ballX = 0;
  let ballY = 0;
  let ballVx = 0;
  let ballVy = 0;
  let launched = false;
  let landed = false;
  let flightTime = 0;
  let trail: TrailDot[] = [];
  let trailTimer = 0;

  // Computed physics values
  let maxHeight = 0;
  let range = 0;
  let totalFlightTime = 0;

  // Coordinate system
  const GROUND_MARGIN = 60;
  const LEFT_MARGIN = 80;
  const SCALE = 6; // pixels per meter

  function worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: LEFT_MARGIN + wx * SCALE,
      y: height - GROUND_MARGIN - wy * SCALE,
    };
  }

  function computePhysics(): void {
    const rad = (launchAngle * Math.PI) / 180;
    const v0x = initialVelocity * Math.cos(rad);
    const v0y = initialVelocity * Math.sin(rad);
    maxHeight = (v0y * v0y) / (2 * gravity);
    totalFlightTime = (2 * v0y) / gravity;
    range = v0x * totalFlightTime;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    launchAngle = params.launchAngle ?? 45;
    initialVelocity = params.initialVelocity ?? 30;
    gravity = params.gravity ?? 9.8;
    showVectors = params.showVectors ?? 1;

    computePhysics();

    const step = Math.min(dt, 0.033);

    if (!launched) {
      const rad = (launchAngle * Math.PI) / 180;
      ballVx = initialVelocity * Math.cos(rad);
      ballVy = initialVelocity * Math.sin(rad);
      ballX = 0;
      ballY = 0;
      flightTime = 0;
      trail = [];
      launched = true;
      landed = false;
    }

    if (launched && !landed) {
      flightTime += step;
      const rad = (launchAngle * Math.PI) / 180;
      const v0x = initialVelocity * Math.cos(rad);
      const v0y = initialVelocity * Math.sin(rad);

      ballX = v0x * flightTime;
      ballY = v0y * flightTime - 0.5 * gravity * flightTime * flightTime;
      ballVx = v0x;
      ballVy = v0y - gravity * flightTime;

      // Trail dots every 0.05s
      trailTimer += step;
      if (trailTimer >= 0.05) {
        trailTimer = 0;
        trail.push({ x: ballX, y: ballY, vx: ballVx, vy: ballVy });
      }

      if (ballY <= 0 && flightTime > 0.1) {
        ballY = 0;
        landed = true;
        // Restart after a pause
        setTimeout(() => {
          launched = false;
        }, 1500);
      }
    }

    time += step;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(0.7, "#101828");
    bgGrad.addColorStop(1, "#1a2410");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGround(): void {
    const groundY = height - GROUND_MARGIN;

    // Ground fill
    ctx.fillStyle = "#1a3a1a";
    ctx.fillRect(0, groundY, width, GROUND_MARGIN);

    // Ground line
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Grid lines (horizontal distance markers)
    ctx.strokeStyle = "rgba(74, 222, 128, 0.15)";
    ctx.lineWidth = 1;
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "rgba(74, 222, 128, 0.4)";
    ctx.textAlign = "center";
    for (let m = 0; m <= 120; m += 10) {
      const sx = LEFT_MARGIN + m * SCALE;
      if (sx > width - 10) break;
      ctx.beginPath();
      ctx.moveTo(sx, groundY);
      ctx.lineTo(sx, groundY + 6);
      ctx.stroke();
      ctx.fillText(`${m}m`, sx, groundY + 16);
    }
  }

  function drawTrajectoryArc(): void {
    if (range <= 0) return;
    const rad = (launchAngle * Math.PI) / 180;
    const v0x = initialVelocity * Math.cos(rad);
    const v0y = initialVelocity * Math.sin(rad);

    ctx.strokeStyle = "rgba(251, 191, 36, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * totalFlightTime;
      const wx = v0x * t;
      const wy = v0y * t - 0.5 * gravity * t * t;
      const s = worldToScreen(wx, Math.max(wy, 0));
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMarkers(): void {
    const groundY = height - GROUND_MARGIN;

    // Max height marker
    const peakX = range / 2;
    const peakScreen = worldToScreen(peakX, maxHeight);
    ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(peakScreen.x, groundY);
    ctx.lineTo(peakScreen.x, peakScreen.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`H = ${maxHeight.toFixed(1)}m`, peakScreen.x, peakScreen.y - 10);

    // Range marker
    const rangeScreen = worldToScreen(range, 0);
    if (rangeScreen.x < width - 20) {
      ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LEFT_MARGIN, groundY + 25);
      ctx.lineTo(rangeScreen.x, groundY + 25);
      ctx.stroke();

      // Arrowheads
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(LEFT_MARGIN, groundY + 25);
      ctx.lineTo(LEFT_MARGIN + 6, groundY + 22);
      ctx.lineTo(LEFT_MARGIN + 6, groundY + 28);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rangeScreen.x, groundY + 25);
      ctx.lineTo(rangeScreen.x - 6, groundY + 22);
      ctx.lineTo(rangeScreen.x - 6, groundY + 28);
      ctx.fill();

      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`R = ${range.toFixed(1)}m`, (LEFT_MARGIN + rangeScreen.x) / 2, groundY + 40);
    }
  }

  function drawTrailDots(): void {
    for (let i = 0; i < trail.length; i++) {
      const dot = trail[i];
      const s = worldToScreen(dot.x, dot.y);
      const alpha = 0.3 + 0.7 * (i / trail.length);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
      ctx.fill();
    }
  }

  function drawArrow(x: number, y: number, dx: number, dy: number, color: string, label: string): void {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - 8 * Math.cos(angle - 0.35), y + dy - 8 * Math.sin(angle - 0.35));
    ctx.lineTo(x + dx - 8 * Math.cos(angle + 0.35), y + dy - 8 * Math.sin(angle + 0.35));
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + dx * 0.5 + 12 * Math.cos(angle + Math.PI / 2), y + dy * 0.5 + 12 * Math.sin(angle + Math.PI / 2));
  }

  function drawBall(): void {
    const s = worldToScreen(ballX, ballY);

    // Velocity vectors
    if (showVectors >= 1 && launched) {
      const vecScale = 1.5;
      // Horizontal velocity (constant)
      drawArrow(s.x, s.y, ballVx * vecScale, 0, "#22d3ee", `Vx=${ballVx.toFixed(1)}`);
      // Vertical velocity (changing)
      drawArrow(s.x, s.y, 0, -ballVy * vecScale, "#f472b6", `Vy=${ballVy.toFixed(1)}`);
      // Resultant velocity
      const speed = Math.sqrt(ballVx * ballVx + ballVy * ballVy);
      drawArrow(s.x, s.y, ballVx * vecScale, -ballVy * vecScale, "#fbbf24", `V=${speed.toFixed(1)}`);
    }

    // Ball glow
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 20);
    glow.addColorStop(0, "rgba(251, 191, 36, 0.4)");
    glow.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.beginPath();
    ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Ball body
    const ballGrad = ctx.createRadialGradient(s.x - 3, s.y - 3, 0, s.x, s.y, 10);
    ballGrad.addColorStop(0, "#fff8dc");
    ballGrad.addColorStop(0.5, "#fbbf24");
    ballGrad.addColorStop(1, "#b45309");
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawLauncher(): void {
    const origin = worldToScreen(0, 0);
    const rad = (launchAngle * Math.PI) / 180;
    const launcherLen = 40;

    // Launcher barrel
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.rotate(-rad);
    ctx.fillStyle = "#475569";
    ctx.fillRect(0, -5, launcherLen, 10);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -5, launcherLen, 10);
    ctx.restore();

    // Base
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#64748b";
    ctx.fill();

    // Angle arc
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 30, -rad, 0);
    ctx.stroke();
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${launchAngle}\u00B0`, origin.x + 34, origin.y - 8);
  }

  function drawInfoPanel(): void {
    const panelW = 230;
    const panelH = 130;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Parabolic Motion", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#22d3ee";
    let y = panelY + 38;
    const lh = 16;
    ctx.fillText(`Vx = ${ballVx.toFixed(1)} m/s (constant)`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#f472b6";
    ctx.fillText(`Vy = ${ballVy.toFixed(1)} m/s`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#a855f7";
    ctx.fillText(`Max Height = ${maxHeight.toFixed(1)} m`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Range = ${range.toFixed(1)} m`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Flight Time = ${totalFlightTime.toFixed(2)} s`, panelX + 10, y); y += lh;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`t = ${flightTime.toFixed(2)} s`, panelX + 10, y);
  }

  function drawFormulas(): void {
    const panelW = 240;
    const panelH = 55;
    const panelX = width - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("y = x\u00B7tan(\u03B8) - gx\u00B2/(2v\u00B2cos\u00B2\u03B8)", panelX + 10, panelY + 20);
    ctx.fillText("R = v\u00B2sin(2\u03B8)/g    H = v\u00B2sin\u00B2(\u03B8)/(2g)", panelX + 10, panelY + 40);
  }

  function render(): void {
    drawBackground();
    drawGround();
    drawTrajectoryArc();
    drawMarkers();
    drawTrailDots();
    drawLauncher();
    drawBall();
    drawInfoPanel();
    drawFormulas();
  }

  function reset(): void {
    time = 0;
    flightTime = 0;
    launched = false;
    landed = false;
    trail = [];
    trailTimer = 0;
    ballX = 0;
    ballY = 0;
    ballVx = 0;
    ballVy = 0;
    computePhysics();
  }

  function destroy(): void {
    trail = [];
  }

  function getStateDescription(): string {
    const speed = Math.sqrt(ballVx * ballVx + ballVy * ballVy);
    return (
      `Parabolic Motion: angle=${launchAngle}\u00B0, v0=${initialVelocity} m/s, g=${gravity} m/s\u00B2. ` +
      `Max height=${maxHeight.toFixed(1)}m, range=${range.toFixed(1)}m, flight time=${totalFlightTime.toFixed(2)}s. ` +
      `Current: Vx=${ballVx.toFixed(1)}, Vy=${ballVy.toFixed(1)}, speed=${speed.toFixed(1)} m/s. ` +
      `t=${flightTime.toFixed(2)}s. ${landed ? "Landed." : "In flight."}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ParabolicMotionFactory;
