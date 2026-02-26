import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ProjectileFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("projectile") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let launchAngle = 45;
  let launchSpeed = 30;
  let gravity = 9.81;
  let showTrail = 1;

  const trail: { x: number; y: number }[] = [];
  let projX = 0;
  let projY = 0;
  let vx = 0;
  let vy = 0;
  let landed = false;

  const SCALE = 8; // pixels per meter
  const GROUND_Y_FRAC = 0.85;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    resetProjectile();
  }

  function resetProjectile(): void {
    const angleRad = (launchAngle * Math.PI) / 180;
    vx = launchSpeed * Math.cos(angleRad);
    vy = -launchSpeed * Math.sin(angleRad);
    projX = 0;
    projY = 0;
    landed = false;
    trail.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevAngle = launchAngle;
    const prevSpeed = launchSpeed;
    const prevGravity = gravity;

    launchAngle = params.launchAngle ?? 45;
    launchSpeed = params.launchSpeed ?? 30;
    gravity = params.gravity ?? 9.81;
    showTrail = params.showTrail ?? 1;

    if (prevAngle !== launchAngle || prevSpeed !== launchSpeed || prevGravity !== gravity) {
      resetProjectile();
      time = 0;
    }

    if (!landed) {
      time += dt;
      vy += gravity * dt;
      projX += vx * dt;
      projY += vy * dt;

      if (projY >= 0 && time > 0.05) {
        projY = 0;
        landed = true;
      }

      trail.push({ x: projX, y: projY });
      if (trail.length > 2000) trail.shift();
    }
  }

  function toScreen(mx: number, my: number): { sx: number; sy: number } {
    const groundY = height * GROUND_Y_FRAC;
    const originX = width * 0.08;
    return { sx: originX + mx * SCALE, sy: groundY + my * SCALE };
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1e3a");
    bgGrad.addColorStop(0.7, "#1a2a4a");
    bgGrad.addColorStop(1, "#2a3a2a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const groundY = height * GROUND_Y_FRAC;
    const originX = width * 0.08;

    // Ground
    ctx.fillStyle = "#2a4a2a";
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = "rgba(100, 200, 100, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let m = 0; m <= 200; m += 10) {
      const sx = originX + m * SCALE;
      if (sx > width) break;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, groundY);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${m}m`, sx, groundY + 15);
    }
    for (let m = 0; m <= 100; m += 10) {
      const sy = groundY - m * SCALE;
      if (sy < 0) break;
      ctx.beginPath();
      ctx.moveTo(originX, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
      if (m > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${m}m`, originX - 5, sy + 4);
      }
    }

    // Draw theoretical parabola (dotted)
    const angleRad = (launchAngle * Math.PI) / 180;
    const v0x = launchSpeed * Math.cos(angleRad);
    const v0y = launchSpeed * Math.sin(angleRad);
    const totalTime = (2 * v0y) / gravity;
    const range = v0x * totalTime;
    const maxH = (v0y * v0y) / (2 * gravity);

    ctx.strokeStyle = "rgba(255, 200, 100, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let t = 0; t <= totalTime; t += 0.05) {
      const mx = v0x * t;
      const my = -(v0y * t - 0.5 * gravity * t * t);
      const s = toScreen(mx, my);
      if (t === 0) ctx.moveTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw trail
    if (showTrail && trail.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const s = toScreen(trail[i].x, trail[i].y);
        if (i === 0) ctx.moveTo(s.sx, s.sy);
        else ctx.lineTo(s.sx, s.sy);
      }
      ctx.strokeStyle = "rgba(100, 200, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Trail dots
      for (let i = 0; i < trail.length; i += 5) {
        const s = toScreen(trail[i].x, trail[i].y);
        ctx.beginPath();
        ctx.arc(s.sx, s.sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 200, 255, 0.5)";
        ctx.fill();
      }
    }

    // Draw launcher
    ctx.save();
    ctx.translate(originX, groundY);
    ctx.rotate(-angleRad);
    ctx.fillStyle = "#888";
    ctx.fillRect(-5, -4, 40, 8);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(originX, groundY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#666";
    ctx.fill();
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw projectile
    const ps = toScreen(projX, projY);
    const glowGrad = ctx.createRadialGradient(ps.sx, ps.sy, 0, ps.sx, ps.sy, 20);
    glowGrad.addColorStop(0, "rgba(255, 100, 50, 0.4)");
    glowGrad.addColorStop(1, "rgba(255, 100, 50, 0)");
    ctx.beginPath();
    ctx.arc(ps.sx, ps.sy, 20, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    const ballGrad = ctx.createRadialGradient(ps.sx - 2, ps.sy - 2, 0, ps.sx, ps.sy, 7);
    ballGrad.addColorStop(0, "#ffcc66");
    ballGrad.addColorStop(1, "#cc6600");
    ctx.beginPath();
    ctx.arc(ps.sx, ps.sy, 7, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Velocity vector
    if (!landed) {
      const currentVx = vx;
      const currentVy = vy;
      const vScale = 1.5;
      ctx.beginPath();
      ctx.moveTo(ps.sx, ps.sy);
      ctx.lineTo(ps.sx + currentVx * vScale, ps.sy + currentVy * vScale);
      ctx.strokeStyle = "rgba(255, 100, 100, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Arrowhead
      const vAngle = Math.atan2(currentVy, currentVx);
      ctx.beginPath();
      ctx.moveTo(ps.sx + currentVx * vScale, ps.sy + currentVy * vScale);
      ctx.lineTo(
        ps.sx + currentVx * vScale - 8 * Math.cos(vAngle - 0.3),
        ps.sy + currentVy * vScale - 8 * Math.sin(vAngle - 0.3)
      );
      ctx.moveTo(ps.sx + currentVx * vScale, ps.sy + currentVy * vScale);
      ctx.lineTo(
        ps.sx + currentVx * vScale - 8 * Math.cos(vAngle + 0.3),
        ps.sy + currentVy * vScale - 8 * Math.sin(vAngle + 0.3)
      );
      ctx.stroke();
    }

    // Max height marker
    const maxHScreen = toScreen(range / 2, -maxH);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, maxHScreen.sy);
    ctx.lineTo(width * 0.9, maxHScreen.sy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Max height: ${maxH.toFixed(1)}m`, maxHScreen.sx + 10, maxHScreen.sy - 5);

    // Range marker
    const rangeScreen = toScreen(range, 0);
    ctx.fillStyle = "rgba(100, 255, 100, 0.5)";
    ctx.beginPath();
    ctx.moveTo(rangeScreen.sx, groundY - 8);
    ctx.lineTo(rangeScreen.sx - 4, groundY);
    ctx.lineTo(rangeScreen.sx + 4, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(100, 255, 100, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Range: ${range.toFixed(1)}m`, rangeScreen.sx, groundY + 30);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 220, 100, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Projectile Motion", 20, 30);
    ctx.font = "12px 'SF Mono', monospace";
    ctx.fillStyle = "rgba(180, 220, 255, 0.9)";
    ctx.fillText(`v₀ = ${launchSpeed.toFixed(1)} m/s  θ = ${launchAngle.toFixed(0)}°`, 20, 50);
    ctx.fillText(`Range = ${range.toFixed(2)} m`, 20, 68);
    ctx.fillText(`Max H = ${maxH.toFixed(2)} m`, 20, 86);
    ctx.fillText(`T = ${totalTime.toFixed(2)} s`, 20, 104);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    resetProjectile();
  }

  function destroy(): void { trail.length = 0; }

  function getStateDescription(): string {
    const angleRad = (launchAngle * Math.PI) / 180;
    const v0y = launchSpeed * Math.sin(angleRad);
    const v0x = launchSpeed * Math.cos(angleRad);
    const totalTime = (2 * v0y) / gravity;
    const range = v0x * totalTime;
    const maxH = (v0y * v0y) / (2 * gravity);
    return (
      `Projectile motion: launch speed ${launchSpeed} m/s at ${launchAngle}°, g = ${gravity} m/s². ` +
      `Range = ${range.toFixed(2)} m, max height = ${maxH.toFixed(2)} m, flight time = ${totalTime.toFixed(2)} s. ` +
      `Current position: (${projX.toFixed(1)}, ${(-projY).toFixed(1)}) m. ${landed ? "Landed." : "In flight."} ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ProjectileFactory;
