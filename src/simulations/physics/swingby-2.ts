import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const Swingby2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("swingby-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let planet1Mass = 3;
  let planet2Mass = 7;
  let launchSpeed = 2;
  let showTrajectory = 1;

  // Constants
  const G = 400;
  const starMass = 50;

  // State
  let starX = 0;
  let starY = 0;
  let planet1Angle = 0;
  let planet2Angle = 0;
  let planet1OrbitR = 0;
  let planet2OrbitR = 0;

  // Spacecraft
  let scX = 0;
  let scY = 0;
  let scVx = 0;
  let scVy = 0;
  let scTrail: { x: number; y: number; speed: number }[] = [];
  let initialSpeed = 0;
  let currentSpeed = 0;
  let maxSpeed = 0;

  // Flyby tracking
  let flyby1Done = false;
  let flyby2Done = false;
  let speedAtFlyby1 = 0;
  let speedAfterFlyby1 = 0;
  let speedAtFlyby2 = 0;
  let speedAfterFlyby2 = 0;
  let closestDist1 = Infinity;
  let closestDist2 = Infinity;

  // Direct trajectory comparison
  let directEnergy = 0;
  let swingbyEnergy = 0;

  function resetSpacecraft(): void {
    const speed = launchSpeed * 15;
    scX = starX - planet1OrbitR * 0.7;
    scY = starY + planet1OrbitR * 0.5;
    scVx = speed * Math.cos(-0.6);
    scVy = speed * Math.sin(-0.6);
    initialSpeed = speed; currentSpeed = speed; maxSpeed = speed;
    scTrail = [];
    flyby1Done = false; flyby2Done = false;
    speedAtFlyby1 = 0; speedAfterFlyby1 = 0;
    speedAtFlyby2 = 0; speedAfterFlyby2 = 0;
    closestDist1 = Infinity; closestDist2 = Infinity;
    directEnergy = 0.5 * speed * speed;
    swingbyEnergy = directEnergy;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;

    starX = width * 0.45;
    starY = height * 0.5;
    planet1OrbitR = Math.min(width, height) * 0.18;
    planet2OrbitR = Math.min(width, height) * 0.36;
    planet1Angle = Math.PI * 0.8;
    planet2Angle = Math.PI * 1.6;

    resetSpacecraft();
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevP1 = planet1Mass;
    const prevP2 = planet2Mass;
    const prevSpd = launchSpeed;

    planet1Mass = params.planet1Mass ?? 3;
    planet2Mass = params.planet2Mass ?? 7;
    launchSpeed = params.launchSpeed ?? 2;
    showTrajectory = params.showTrajectory ?? 1;

    if (
      Math.abs(prevP1 - planet1Mass) > 0.01 ||
      Math.abs(prevP2 - planet2Mass) > 0.01 ||
      Math.abs(prevSpd - launchSpeed) > 0.01
    ) {
      resetSpacecraft();
    }

    // Planets orbit at different rates (Kepler: T^2 proportional to r^3)
    const p1Speed = 0.5;
    const p2Speed = 0.5 * Math.pow(planet1OrbitR / planet2OrbitR, 1.5);
    planet1Angle += p1Speed * dt;
    planet2Angle += p2Speed * dt;

    const p1x = starX + planet1OrbitR * Math.cos(planet1Angle);
    const p1y = starY + planet1OrbitR * Math.sin(planet1Angle);
    const p2x = starX + planet2OrbitR * Math.cos(planet2Angle);
    const p2y = starY + planet2OrbitR * Math.sin(planet2Angle);

    // Gravitational forces on spacecraft
    const applyGravity = (bx: number, by: number, mass: number, softening: number) => {
      const ddx = bx - scX, ddy = by - scY;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy) + softening;
      const f = (G * mass) / (dist * dist);
      scVx += (f * ddx) / dist * dt;
      scVy += (f * ddy) / dist * dt;
      return dist;
    };
    applyGravity(starX, starY, starMass, 10);
    const dist1 = applyGravity(p1x, p1y, planet1Mass * 20, 5);
    const dist2 = applyGravity(p2x, p2y, planet2Mass * 20, 5);

    scX += scVx * dt;
    scY += scVy * dt;

    currentSpeed = Math.sqrt(scVx * scVx + scVy * scVy);
    if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;
    swingbyEnergy = 0.5 * currentSpeed * currentSpeed;

    // Track flybys
    if (dist1 < closestDist1) { closestDist1 = dist1; speedAtFlyby1 = currentSpeed; }
    if (dist1 < planet1OrbitR * 0.3 && !flyby1Done) flyby1Done = true;
    if (flyby1Done && dist1 > planet1OrbitR * 0.5 && speedAfterFlyby1 === 0) speedAfterFlyby1 = currentSpeed;
    if (dist2 < closestDist2) { closestDist2 = dist2; speedAtFlyby2 = currentSpeed; }
    if (dist2 < planet2OrbitR * 0.2 && !flyby2Done && flyby1Done) flyby2Done = true;
    if (flyby2Done && dist2 > planet2OrbitR * 0.3 && speedAfterFlyby2 === 0) speedAfterFlyby2 = currentSpeed;

    // Trail
    if (scTrail.length === 0 || time % 0.04 < dt) {
      scTrail.push({ x: scX, y: scY, speed: currentSpeed });
      if (scTrail.length > 800) scTrail.shift();
    }

    // Reset if off-screen
    if (scX > width * 1.3 || scX < -width * 0.3 || scY > height * 1.5 || scY < -height * 0.5) {
      resetSpacecraft();
    }

    time += dt;
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, lw: number = 2): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    const hl = Math.min(7, len * 0.3);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hl * Math.cos(angle - 0.35), y2 - hl * Math.sin(angle - 0.35));
    ctx.lineTo(x2 - hl * Math.cos(angle + 0.35), y2 - hl * Math.sin(angle + 0.35));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }

  function render(): void {
    // Dark space gradient
    const bgGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, width);
    bgGrad.addColorStop(0, "#100e20");
    bgGrad.addColorStop(1, "#04040c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Orbit paths
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(100, 180, 255, 0.12)";
    ctx.beginPath();
    ctx.arc(starX, starY, planet1OrbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 150, 100, 0.12)";
    ctx.beginPath();
    ctx.arc(starX, starY, planet2OrbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Star
    const starGlow = ctx.createRadialGradient(starX, starY, 0, starX, starY, 30);
    starGlow.addColorStop(0, "#ffffc8");
    starGlow.addColorStop(0.4, "rgba(255, 200, 50, 0.6)");
    starGlow.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.beginPath(); ctx.arc(starX, starY, 30, 0, Math.PI * 2);
    ctx.fillStyle = starGlow; ctx.fill();
    ctx.beginPath(); ctx.arc(starX, starY, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8e0"; ctx.fill();

    // Planet 1 (inner)
    const p1x = starX + planet1OrbitR * Math.cos(planet1Angle);
    const p1y = starY + planet1OrbitR * Math.sin(planet1Angle);
    const p1r = 6 + planet1Mass * 1.0;

    const p1Grad = ctx.createRadialGradient(p1x - 2, p1y - 2, 0, p1x, p1y, p1r);
    p1Grad.addColorStop(0, "#aaccff");
    p1Grad.addColorStop(1, "#3366aa");
    ctx.beginPath();
    ctx.arc(p1x, p1y, p1r, 0, Math.PI * 2);
    ctx.fillStyle = p1Grad;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("P1", p1x, p1y - p1r - 5);

    // Planet 2 (outer)
    const p2x = starX + planet2OrbitR * Math.cos(planet2Angle);
    const p2y = starY + planet2OrbitR * Math.sin(planet2Angle);
    const p2r = 6 + planet2Mass * 1.0;

    const p2Grad = ctx.createRadialGradient(p2x - 2, p2y - 2, 0, p2x, p2y, p2r);
    p2Grad.addColorStop(0, "#ffccaa");
    p2Grad.addColorStop(1, "#aa5533");
    ctx.beginPath();
    ctx.arc(p2x, p2y, p2r, 0, Math.PI * 2);
    ctx.fillStyle = p2Grad;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("P2", p2x, p2y - p2r - 5);

    // Spacecraft trail
    if (showTrajectory && scTrail.length > 1) {
      for (let i = 1; i < scTrail.length; i++) {
        const t = scTrail[i];
        const prev = scTrail[i - 1];
        const speedRatio = t.speed / (maxSpeed + 1);
        const alpha = (i / scTrail.length) * 0.7;
        const r = Math.floor(50 + speedRatio * 205);
        const g = Math.floor(255 * (1 - speedRatio * 0.7));
        const b = Math.floor(255 * (1 - speedRatio));

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // Spacecraft
    const scAngle = Math.atan2(scVy, scVx);
    ctx.save();
    ctx.translate(scX, scY);
    ctx.rotate(scAngle);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fillStyle = "#e8e8e8";
    ctx.fill();
    ctx.restore();

    // Velocity vector
    if (showTrajectory) {
      const vScale = 0.6;
      drawArrow(scX, scY, scX + scVx * vScale, scY + scVy * vScale, "#66ff88", 1.5);
    }

    // Info panel
    const panelX = 10;
    const panelY = 10;
    const panelW = 210;
    const panelH = 310;

    ctx.fillStyle = "rgba(5, 8, 18, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 120, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let ty = panelY + 14;
    const lx = panelX + 12;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#bb99ff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("Multi-Flyby Slingshot", lx, ty);
    ty += 22;

    ctx.fillStyle = "#ffd966";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Voyager Grand Tour Concept", lx, ty);
    ty += 20;

    ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Launch: ${launchSpeed.toFixed(1)} km/s`, lx, ty);
    ty += 16;
    ctx.fillText(`Current: ${(currentSpeed / 15).toFixed(1)} km/s`, lx, ty);
    ty += 16;
    ctx.fillText(`Max: ${(maxSpeed / 15).toFixed(1)} km/s`, lx, ty);
    ty += 22;

    // Flyby info helper
    const drawFlybyInfo = (label: string, color: string, done: boolean, prevDone: boolean,
      spdAt: number, spdAfter: number) => {
      ctx.fillStyle = color;
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText(label, lx, ty);
      ty += 16;
      ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
      ctx.font = "11px system-ui, sans-serif";
      if (done && spdAfter > 0) {
        const dv = spdAfter - spdAt;
        ctx.fillText(`${(spdAt / 15).toFixed(1)} → ${(spdAfter / 15).toFixed(1)} km/s`, lx, ty);
        ty += 14;
        ctx.fillStyle = dv > 0 ? "#66ffaa" : "#ff8888";
        ctx.fillText(`ΔV: ${dv > 0 ? "+" : ""}${(dv / 15).toFixed(1)} km/s`, lx, ty);
      } else {
        ctx.fillText(prevDone ? "Approaching..." : "Waiting...", lx, ty);
      }
      ty += 18;
    };
    drawFlybyInfo("Flyby 1 (P1):", "#8cb4ff", flyby1Done, true, speedAtFlyby1, speedAfterFlyby1);
    drawFlybyInfo("Flyby 2 (P2):", "#ffaa88", flyby2Done, flyby1Done, speedAtFlyby2, speedAfterFlyby2);

    // Energy comparison
    ctx.fillStyle = "#ff9966";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Energy Comparison:", lx, ty);
    ty += 16;
    ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    const energyRatio = swingbyEnergy / (directEnergy + 0.001);
    ctx.fillText(`KE ratio: ${energyRatio.toFixed(2)}×`, lx, ty);

    // Time
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 14);

    ctx.textAlign = "right"; ctx.fillStyle = "rgba(200, 220, 255, 0.4)";
    ctx.fillText("Trail: blue=slow, red=fast", width - 12, height - 14);
  }

  function reset(): void {
    time = 0;
    planet1Angle = Math.PI * 0.8;
    planet2Angle = Math.PI * 1.6;
    resetSpacecraft();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const dv1 = speedAfterFlyby1 > 0 ? (speedAfterFlyby1 - speedAtFlyby1) / 15 : 0;
    const dv2 = speedAfterFlyby2 > 0 ? (speedAfterFlyby2 - speedAtFlyby2) / 15 : 0;
    return (
      `Multi-Flyby Slingshot: P1 mass=${planet1Mass}, P2 mass=${planet2Mass}, ` +
      `launch=${launchSpeed} km/s. Current speed=${(currentSpeed / 15).toFixed(1)} km/s. ` +
      `Flyby 1: ${flyby1Done ? `ΔV=${dv1.toFixed(1)} km/s` : "pending"}. ` +
      `Flyby 2: ${flyby2Done ? `ΔV=${dv2.toFixed(1)} km/s` : "pending"}. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    starX = width * 0.45;
    starY = height * 0.5;
    planet1OrbitR = Math.min(width, height) * 0.18;
    planet2OrbitR = Math.min(width, height) * 0.36;
    resetSpacecraft();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Swingby2Factory;
