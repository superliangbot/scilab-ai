import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Coriolis Effect
 * A projectile is launched on a rotating globe. The Coriolis force deflects it:
 *   F_coriolis = -2m(ω × v)
 * Northern hemisphere: deflection to the right.
 * Southern hemisphere: deflection to the left.
 */

const CoriolisEffectFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("coriolis-effect") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let hemisphere = 0; // 0=North, 1=South
  let launchAngle = 0; // degrees from north
  let rotationSpeed = 1;
  let showVectors = 1;

  // Globe & projectile
  let globeAngle = 0;
  let projX = 0;
  let projY = 0;
  let projVx = 0;
  let projVy = 0;
  let trail: { x: number; y: number }[] = [];
  let straightTrail: { x: number; y: number }[] = [];
  let launched = false;
  let launchTime = 0;

  const PROJ_SPEED = 120; // px/s

  function globeCenter(): { cx: number; cy: number; r: number } {
    const r = Math.min(width, height) * 0.32;
    return { cx: width / 2, cy: height * 0.5, r };
  }

  function initProjectile() {
    const { cx, cy, r } = globeCenter();
    // Start from latitude ~45° on the visible face
    const startR = r * 0.1;
    projX = cx;
    projY = cy - (hemisphere === 0 ? startR : -startR);
    const rad = launchAngle * Math.PI / 180;
    projVx = PROJ_SPEED * Math.sin(rad);
    projVy = -PROJ_SPEED * Math.cos(rad) * (hemisphere === 0 ? 1 : -1);
    trail = [{ x: projX, y: projY }];
    straightTrail = [{ x: projX, y: projY }];
    launched = false;
    launchTime = 0;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    globeAngle = 0;
    initProjectile();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newHemi = Math.round(params.hemisphere ?? 0);
    const newAngle = params.launchAngle ?? 0;
    rotationSpeed = params.rotationSpeed ?? 1;
    showVectors = params.showVectors ?? 1;

    if (newHemi !== hemisphere || newAngle !== launchAngle) {
      hemisphere = newHemi;
      launchAngle = newAngle;
      initProjectile();
      time = 0;
      return;
    }

    const step = Math.min(dt, 0.025);
    const { cx, cy, r } = globeCenter();

    // Rotate globe
    globeAngle += rotationSpeed * 0.3 * step;

    // Launch projectile after short delay
    if (!launched && time > 0.5) {
      launched = true;
      launchTime = time;
    }

    if (launched) {
      // Coriolis acceleration: a_c = -2ω × v
      // In 2D top-down view:
      // Northern hemisphere: deflect right (ω positive)
      // Southern hemisphere: deflect left (ω negative)
      const omega = rotationSpeed * 0.5 * (hemisphere === 0 ? 1 : -1);
      const ax = 2 * omega * projVy;
      const ay = -2 * omega * projVx;

      projVx += ax * step;
      projVy += ay * step;
      projX += projVx * step;
      projY += projVy * step;

      trail.push({ x: projX, y: projY });
      if (trail.length > 500) trail.shift();

      // Straight line trail (no Coriolis — reference path)
      const elapsed = time - launchTime;
      const rad = launchAngle * Math.PI / 180;
      const sx = trail[0].x + PROJ_SPEED * Math.sin(rad) * elapsed;
      const sy = trail[0].y + (-PROJ_SPEED * Math.cos(rad) * (hemisphere === 0 ? 1 : -1)) * elapsed;
      straightTrail.push({ x: sx, y: sy });
      if (straightTrail.length > 500) straightTrail.shift();

      // Stop if projectile leaves globe
      const dx = projX - cx;
      const dy = projY - cy;
      if (dx * dx + dy * dy > r * r * 1.1) {
        // Freeze — don't update further
        projVx = 0;
        projVy = 0;
      }
    }

    time += step;
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const { cx, cy, r } = globeCenter();

    // Globe
    const globeGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    globeGrad.addColorStop(0, hemisphere === 0 ? "#1e3a5f" : "#1e3a5f");
    globeGrad.addColorStop(0.7, "#0f2647");
    globeGrad.addColorStop(1, "#0a1a35");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = globeGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(100,160,220,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Grid lines (meridians/parallels)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = "#6096c8";
    ctx.lineWidth = 1;
    // Latitude circles
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * i / 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Longitude lines
    for (let a = 0; a < 360; a += 30) {
      const rad = (a + globeAngle * 50) * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
      ctx.stroke();
    }
    ctx.restore();

    // Rotation arrow
    ctx.save();
    const arrowR = r + 15;
    const startA = -0.3;
    const endA = 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, arrowR, startA, endA);
    ctx.strokeStyle = "rgba(100,200,100,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Arrowhead
    const tipA = endA;
    const tipX = cx + arrowR * Math.cos(tipA);
    const tipY = cy + arrowR * Math.sin(tipA);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 8, tipY - 6);
    ctx.lineTo(tipX - 3, tipY + 6);
    ctx.closePath();
    ctx.fillStyle = "rgba(100,200,100,0.5)";
    ctx.fill();
    ctx.restore();

    // Straight reference trail (dashed)
    if (straightTrail.length > 1) {
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < straightTrail.length; i++) {
        if (i === 0) ctx.moveTo(straightTrail[i].x, straightTrail[i].y);
        else ctx.lineTo(straightTrail[i].x, straightTrail[i].y);
      }
      ctx.strokeStyle = "rgba(200,200,200,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Actual trail (curved by Coriolis)
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const alpha = i / trail.length;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(255, 100, 80, ${alpha * 0.8})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }

    // Projectile
    if (trail.length > 0) {
      const px = projX;
      const py = projY;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#f87171";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Velocity vector
      if (showVectors >= 1 && (projVx !== 0 || projVy !== 0)) {
        const vLen = 30;
        const vMag = Math.sqrt(projVx * projVx + projVy * projVy) || 1;
        const vnx = projVx / vMag;
        const vny = projVy / vMag;
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + vnx * vLen, py + vny * vLen);
        ctx.stroke();
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#93c5fd";
        ctx.textAlign = "left";
        ctx.fillText("v", px + vnx * vLen + 4, py + vny * vLen);
      }
    }

    // Label
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Coriolis Effect", width / 2, 24);
    ctx.font = `${Math.max(10, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160,180,220,0.5)";
    ctx.fillText("F_coriolis = −2m(ω × v)  |  " + (hemisphere === 0 ? "Northern: deflects right" : "Southern: deflects left"), width / 2, 42);
    ctx.restore();

    // Info panel
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, height - 80, 210, 68, 6);
    ctx.fill();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Hemisphere: ${hemisphere === 0 ? "Northern" : "Southern"}`, 16, height - 62);
    ctx.fillText(`Launch angle: ${launchAngle}°`, 16, height - 46);
    ctx.fillText(`Rotation speed: ${rotationSpeed}×`, 16, height - 30);
    ctx.fillStyle = "rgba(255,100,80,0.7)";
    ctx.fillText("― Actual path", 16, height - 14);
    ctx.fillStyle = "rgba(200,200,200,0.5)";
    ctx.fillText("--- Expected (no Coriolis)", 110, height - 14);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    globeAngle = 0;
    initProjectile();
  }

  function destroy(): void { trail = []; straightTrail = []; }

  function getStateDescription(): string {
    return (
      `Coriolis Effect: ${hemisphere === 0 ? "Northern" : "Southern"} hemisphere. ` +
      `Launch angle: ${launchAngle}°. Rotation speed: ${rotationSpeed}×. ` +
      `The Coriolis force (F = -2mω×v) deflects moving objects ${hemisphere === 0 ? "rightward" : "leftward"} ` +
      `relative to their motion direction. This explains why hurricanes rotate ` +
      `${hemisphere === 0 ? "counter-clockwise" : "clockwise"} and affects trade winds, ocean currents, and artillery trajectories.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initProjectile();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CoriolisEffectFactory;
