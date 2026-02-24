import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ProjectileMotionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("projectile-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physics parameters (cached from params)
  let launchAngle = 45;
  let initialVelocity = 40;
  let gravity = 9.81;
  let mass = 1;

  // Computed trajectory values
  let totalFlightTime = 0;
  let maxRange = 0;
  let maxHeight = 0;

  // Trail of positions the projectile has been at
  const trail: Array<{ x: number; y: number }> = [];

  // Whether projectile has landed
  let landed = false;

  // Coordinate transform: simulation meters -> canvas pixels
  // We keep a margin for the UI
  const MARGIN_LEFT = 70;
  const MARGIN_BOTTOM = 50;
  const MARGIN_TOP = 40;
  const MARGIN_RIGHT = 40;

  function computeTrajectoryMetrics(): void {
    const angleRad = (launchAngle * Math.PI) / 180;
    const v0x = initialVelocity * Math.cos(angleRad);
    const v0y = initialVelocity * Math.sin(angleRad);
    totalFlightTime = (2 * v0y) / gravity;
    maxRange = v0x * totalFlightTime;
    maxHeight = (v0y * v0y) / (2 * gravity);

    // Clamp for edge cases
    if (maxRange < 0.01) maxRange = 1;
    if (maxHeight < 0.01) maxHeight = 1;
    if (totalFlightTime < 0.001) totalFlightTime = 0.001;
  }

  function simToCanvas(sx: number, sy: number): { cx: number; cy: number } {
    const drawW = width - MARGIN_LEFT - MARGIN_RIGHT;
    const drawH = height - MARGIN_TOP - MARGIN_BOTTOM;

    // Scale so the full trajectory fits, with some padding
    const scaleX = drawW / (maxRange * 1.15);
    const scaleY = drawH / (maxHeight * 1.35);
    const scale = Math.min(scaleX, scaleY);

    const cx = MARGIN_LEFT + sx * scale;
    const cy = height - MARGIN_BOTTOM - sy * scale;
    return { cx, cy };
  }

  function getProjectilePos(t: number): { x: number; y: number } {
    const angleRad = (launchAngle * Math.PI) / 180;
    const v0x = initialVelocity * Math.cos(angleRad);
    const v0y = initialVelocity * Math.sin(angleRad);
    const x = v0x * t;
    const y = v0y * t - 0.5 * gravity * t * t;
    return { x, y: Math.max(y, 0) };
  }

  function getVelocity(t: number): { vx: number; vy: number } {
    const angleRad = (launchAngle * Math.PI) / 180;
    const vx = initialVelocity * Math.cos(angleRad);
    const vy = initialVelocity * Math.sin(angleRad) - gravity * t;
    return { vx, vy };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    trail.length = 0;
    landed = false;
  }

  function update(dt: number, params: Record<string, number>): void {
    const newAngle = params.angle ?? 45;
    const newVelocity = params.velocity ?? 40;
    const newGravity = params.gravity ?? 9.81;
    const newMass = params.mass ?? 1;

    // If parameters changed, reset the simulation
    if (
      newAngle !== launchAngle ||
      newVelocity !== initialVelocity ||
      newGravity !== gravity ||
      newMass !== mass
    ) {
      launchAngle = newAngle;
      initialVelocity = newVelocity;
      gravity = newGravity;
      mass = newMass;
      time = 0;
      trail.length = 0;
      landed = false;
    }

    computeTrajectoryMetrics();

    if (!landed) {
      time += dt;
      if (time >= totalFlightTime) {
        time = totalFlightTime;
        landed = true;
      }
      const pos = getProjectilePos(time);
      trail.push({ x: pos.x, y: pos.y });
    }
  }

  function drawGrid(): void {
    ctx.save();

    // Determine nice grid spacing
    function niceStep(range: number, targetSteps: number): number {
      const rough = range / targetSteps;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
      const residual = rough / magnitude;
      let nice: number;
      if (residual <= 1.5) nice = 1;
      else if (residual <= 3.5) nice = 2;
      else if (residual <= 7.5) nice = 5;
      else nice = 10;
      return nice * magnitude;
    }

    const xStep = niceStep(maxRange, 6);
    const yStep = niceStep(maxHeight, 4);

    // Draw vertical grid lines (x-axis)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let x = 0; x <= maxRange * 1.15; x += xStep) {
      const { cx, cy: _cy } = simToCanvas(x, 0);
      const { cy: top } = simToCanvas(x, maxHeight * 1.35);
      ctx.beginPath();
      ctx.moveTo(cx, height - MARGIN_BOTTOM);
      ctx.lineTo(cx, top);
      ctx.stroke();

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${x.toFixed(x >= 100 ? 0 : 1)}m`, cx, height - MARGIN_BOTTOM + 18);
    }

    // Draw horizontal grid lines (y-axis)
    for (let y = 0; y <= maxHeight * 1.35; y += yStep) {
      const { cx: _left, cy } = simToCanvas(0, y);
      const { cx: right } = simToCanvas(maxRange * 1.15, y);
      ctx.beginPath();
      ctx.moveTo(MARGIN_LEFT, cy);
      ctx.lineTo(right, cy);
      ctx.stroke();

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${y.toFixed(y >= 100 ? 0 : 1)}m`, MARGIN_LEFT - 8, cy + 4);
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawFullTrajectoryGhost(): void {
    // Draw the full parabolic path as a faint guide
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * totalFlightTime;
      const pos = getProjectilePos(t);
      const { cx, cy } = simToCanvas(pos.x, pos.y);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawTrail(): void {
    if (trail.length < 2) return;
    ctx.save();

    // Draw filled trail as series of dots with fading opacity
    for (let i = 0; i < trail.length; i++) {
      const alpha = 0.15 + 0.6 * (i / trail.length);
      const radius = 2 + (i / trail.length) * 2;
      const { cx, cy } = simToCanvas(trail[i].x, trail[i].y);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.fill();
    }

    // Solid trail line
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const { cx, cy } = simToCanvas(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawVelocityVector(px: number, py: number, vx: number, vy: number): void {
    ctx.save();
    const { cx, cy } = simToCanvas(px, py);

    // Scale the vector for visual display
    const speed = Math.sqrt(vx * vx + vy * vy);
    const scaleFactor = 40 / (initialVelocity || 1);
    const dvx = vx * scaleFactor;
    const dvy = -vy * scaleFactor; // Flip y for canvas

    // Total velocity vector
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dvx, cy + dvy);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dvy, dvx);
    const arrowLen = 10;
    ctx.beginPath();
    ctx.moveTo(cx + dvx, cy + dvy);
    ctx.lineTo(
      cx + dvx - arrowLen * Math.cos(angle - 0.4),
      cy + dvy - arrowLen * Math.sin(angle - 0.4)
    );
    ctx.moveTo(cx + dvx, cy + dvy);
    ctx.lineTo(
      cx + dvx - arrowLen * Math.cos(angle + 0.4),
      cy + dvy - arrowLen * Math.sin(angle + 0.4)
    );
    ctx.stroke();

    // Horizontal component (vx)
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dvx, cy);
    ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Vertical component (vy)
    ctx.beginPath();
    ctx.moveTo(cx + dvx, cy);
    ctx.lineTo(cx + dvx, cy + dvy);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.setLineDash([]);

    // Speed label
    ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`v = ${speed.toFixed(1)} m/s`, cx + dvx + 8, cy + dvy - 4);

    ctx.restore();
  }

  function drawMarkers(): void {
    ctx.save();

    // Max height marker
    const angleRad = (launchAngle * Math.PI) / 180;
    const v0x = initialVelocity * Math.cos(angleRad);
    const timeAtMaxHeight = (initialVelocity * Math.sin(angleRad)) / gravity;
    const xAtMaxHeight = v0x * timeAtMaxHeight;
    const { cx: mhCx, cy: mhCy } = simToCanvas(xAtMaxHeight, maxHeight);

    // Dashed line down to ground from max height
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const { cy: groundCy } = simToCanvas(xAtMaxHeight, 0);
    ctx.moveTo(mhCx, mhCy);
    ctx.lineTo(mhCx, groundCy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Max height label
    ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`H = ${maxHeight.toFixed(1)}m`, mhCx, mhCy - 12);

    // Range marker
    const { cx: rangeCx, cy: rangeCy } = simToCanvas(maxRange, 0);
    const { cx: originCx, cy: originCy } = simToCanvas(0, 0);

    // Range arrow
    ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originCx, originCy + 20);
    ctx.lineTo(rangeCx, rangeCy + 20);
    ctx.stroke();

    // Arrowheads on range
    ctx.beginPath();
    ctx.moveTo(rangeCx, rangeCy + 20);
    ctx.lineTo(rangeCx - 8, rangeCy + 14);
    ctx.moveTo(rangeCx, rangeCy + 20);
    ctx.lineTo(rangeCx - 8, rangeCy + 26);
    ctx.stroke();

    // Range label
    ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`R = ${maxRange.toFixed(1)}m`, (originCx + rangeCx) / 2, originCy + 36);

    ctx.restore();
  }

  function drawLauncher(): void {
    const { cx, cy } = simToCanvas(0, 0);
    const angleRad = (launchAngle * Math.PI) / 180;
    const launcherLen = 30;

    ctx.save();

    // Draw the launcher tube
    ctx.translate(cx, cy);
    ctx.rotate(-angleRad);
    ctx.fillStyle = "#555";
    ctx.fillRect(0, -4, launcherLen, 8);
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, -4, launcherLen, 8);
    ctx.restore();

    // Base
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#444";
    ctx.fill();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Angle arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 25, -angleRad, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${launchAngle}\u00B0`, cx + 28, cy - 6);
    ctx.restore();
  }

  function render(): void {
    computeTrajectoryMetrics();

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(0.7, "#132040");
    bgGrad.addColorStop(1, "#1a3020");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground
    const { cy: groundY } = simToCanvas(0, 0);
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    groundGrad.addColorStop(0, "#2d5016");
    groundGrad.addColorStop(0.3, "#1e3a0e");
    groundGrad.addColorStop(1, "#0f1f05");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Ground line
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.strokeStyle = "rgba(100, 200, 80, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw grid
    drawGrid();

    // Draw full trajectory ghost
    drawFullTrajectoryGhost();

    // Draw markers
    drawMarkers();

    // Draw trail
    drawTrail();

    // Draw launcher
    drawLauncher();

    // Draw projectile
    const pos = getProjectilePos(time);
    const { cx, cy } = simToCanvas(pos.x, pos.y);

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25);
    glow.addColorStop(0, "rgba(239, 68, 68, 0.5)");
    glow.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Projectile body
    const ballGrad = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 8);
    ballGrad.addColorStop(0, "#fff");
    ballGrad.addColorStop(0.3, "#ef4444");
    ballGrad.addColorStop(1, "#991b1b");
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Velocity vector (only while in flight)
    if (!landed) {
      const vel = getVelocity(time);
      drawVelocityVector(pos.x, pos.y, vel.vx, vel.vy);
    }

    // Info panel top-right
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    const panelW = 190;
    const panelH = 100;
    const panelX = width - panelW - 12;
    const panelY = 12;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Projectile Motion", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Time: ${time.toFixed(2)}s / ${totalFlightTime.toFixed(2)}s`, panelX + 10, panelY + 40);
    ctx.fillText(`Max Height: ${maxHeight.toFixed(1)} m`, panelX + 10, panelY + 56);
    ctx.fillText(`Range: ${maxRange.toFixed(1)} m`, panelX + 10, panelY + 72);

    const currentSpeed = Math.sqrt(
      getVelocity(time).vx ** 2 + getVelocity(time).vy ** 2
    );
    ctx.fillText(`Speed: ${currentSpeed.toFixed(1)} m/s`, panelX + 10, panelY + 88);

    ctx.restore();

    // Landed text
    if (landed) {
      ctx.save();
      ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LANDED", width / 2, height - MARGIN_BOTTOM - 20);
      ctx.restore();
    }
  }

  function reset(): void {
    time = 0;
    trail.length = 0;
    landed = false;
  }

  function destroy(): void {
    trail.length = 0;
  }

  function getStateDescription(): string {
    const pos = getProjectilePos(time);
    const vel = getVelocity(time);
    const speed = Math.sqrt(vel.vx ** 2 + vel.vy ** 2);
    return (
      `Projectile Motion: angle=${launchAngle} deg, v0=${initialVelocity} m/s, ` +
      `g=${gravity} m/s^2, mass=${mass} kg. ` +
      `Time: ${time.toFixed(2)}s. Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) m. ` +
      `Speed: ${speed.toFixed(1)} m/s. ` +
      `Max height: ${maxHeight.toFixed(1)} m, Range: ${maxRange.toFixed(1)} m. ` +
      `Flight time: ${totalFlightTime.toFixed(2)}s. ${landed ? "Landed." : "In flight."}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default ProjectileMotionFactory;
