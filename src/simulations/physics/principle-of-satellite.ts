import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PrincipleOfSatelliteFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("principle-of-satellite") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let stars: Array<{ x: number; y: number; b: number }> = [];

  // Parameters
  let launchSpeed = 6; // km/s
  let showTrail = 1;

  // Constants
  const G = 6.674e-11;
  const M = 5.972e24; // Earth mass kg
  const R_EARTH = 6371; // km
  const ORBITAL_V = 7.91; // km/s circular orbit at surface
  const ESCAPE_V = 11.19; // km/s escape velocity

  // Projectile state
  let projX = 0;
  let projY = 0;
  let projVx = 0;
  let projVy = 0;
  let trail: Array<{ x: number; y: number }> = [];
  let launched = false;
  let crashed = false;
  let escaped = false;

  // Layout
  let earthCX = 0, earthCY = 0, earthR = 0;
  let scale = 1; // pixels per km

  function layout() {
    earthCX = width * 0.5;
    earthCY = height * 0.55;
    earthR = Math.min(width, height) * 0.2;
    scale = earthR / R_EARTH;
  }

  function genStars() {
    stars = [];
    for (let i = 0; i < Math.floor(width * height / 800); i++) {
      stars.push({ x: Math.random() * width, y: Math.random() * height, b: 0.2 + Math.random() * 0.7 });
    }
  }

  function launchProjectile() {
    // Launch from top of Earth, horizontally
    projX = 0; // km offset from Earth center (relative coords)
    projY = -R_EARTH; // at surface, top
    projVx = launchSpeed; // horizontal km/s
    projVy = 0;
    trail = [];
    launched = true;
    crashed = false;
    escaped = false;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    layout();
    genStars();
    launchProjectile();
  }

  function update(dt: number, params: Record<string, number>) {
    const newSpeed = params.launchSpeed ?? 6;
    showTrail = params.showTrail ?? 1;

    if (Math.abs(newSpeed - launchSpeed) > 0.1) {
      launchSpeed = newSpeed;
      launchProjectile();
    }
    launchSpeed = newSpeed;

    if (!launched || crashed || escaped) {
      // Auto relaunch
      time += dt;
      if (crashed || escaped) {
        if (time > 2) {
          launchProjectile();
          time = 0;
        }
        return;
      }
    }

    // Physics simulation (multiple substeps for accuracy)
    const substeps = 20;
    const subDt = dt * 300 / substeps; // time scaling for visual speed

    for (let s = 0; s < substeps; s++) {
      const r = Math.sqrt(projX * projX + projY * projY);

      if (r < R_EARTH) {
        crashed = true;
        break;
      }

      if (r > R_EARTH * 10) {
        escaped = true;
        break;
      }

      // Gravitational acceleration: a = -GM/r² toward center
      // Using km and km/s units, GM = 398600 km³/s²
      const GM_km = 398600;
      const a = -GM_km / (r * r);
      const ax = a * (projX / r);
      const ay = a * (projY / r);

      projVx += ax * subDt;
      projVy += ay * subDt;
      projX += projVx * subDt;
      projY += projVy * subDt;
    }

    // Record trail
    trail.push({ x: projX, y: projY });
    if (trail.length > 2000) trail.shift();

    time += dt;
  }

  function toScreen(px: number, py: number): { sx: number; sy: number } {
    return { sx: earthCX + px * scale, sy: earthCY + py * scale };
  }

  function render() {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.b * (0.6 + 0.4 * Math.sin(time * 2 + s.x))})`;
      ctx.fill();
    }

    // Earth
    const eGrad = ctx.createRadialGradient(earthCX - earthR * 0.2, earthCY - earthR * 0.2, 0, earthCX, earthCY, earthR);
    eGrad.addColorStop(0, "#4488cc");
    eGrad.addColorStop(0.4, "#3366aa");
    eGrad.addColorStop(0.8, "#224488");
    eGrad.addColorStop(1, "#112244");
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, earthR, 0, Math.PI * 2);
    ctx.fillStyle = eGrad;
    ctx.fill();

    // Continent hints
    ctx.save();
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, earthR, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      const ca = i * 1.5 + 0.3;
      ctx.beginPath();
      ctx.arc(earthCX + earthR * 0.4 * Math.cos(ca), earthCY + earthR * 0.3 * Math.sin(ca), earthR * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(50,160,80,0.2)";
      ctx.fill();
    }
    ctx.restore();

    // Atmosphere glow
    const atmoGrad = ctx.createRadialGradient(earthCX, earthCY, earthR * 0.95, earthCX, earthCY, earthR * 1.08);
    atmoGrad.addColorStop(0, "rgba(100,150,255,0.15)");
    atmoGrad.addColorStop(1, "rgba(100,150,255,0)");
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, earthR * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = atmoGrad;
    ctx.fill();

    // Cannon on top of Earth
    const cannonAngle = -Math.PI / 2; // top
    const cannonX = earthCX + Math.cos(cannonAngle) * earthR;
    const cannonY = earthCY + Math.sin(cannonAngle) * earthR;
    ctx.save();
    ctx.translate(cannonX, cannonY);
    // Cannon body (pointing right/horizontal)
    ctx.fillStyle = "#555";
    ctx.fillRect(0, -5, 20, 10);
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#666";
    ctx.fill();
    ctx.restore();

    // Trail
    if (showTrail >= 0.5 && trail.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const { sx, sy } = toScreen(trail[i].x, trail[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }

      let trailColor: string;
      if (launchSpeed < ORBITAL_V * 0.95) trailColor = "rgba(255,100,100,0.6)";
      else if (launchSpeed < ORBITAL_V * 1.05) trailColor = "rgba(100,255,100,0.6)";
      else if (launchSpeed < ESCAPE_V) trailColor = "rgba(255,200,50,0.6)";
      else trailColor = "rgba(200,100,255,0.6)";

      ctx.strokeStyle = trailColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Projectile
    if (launched && !crashed && !escaped) {
      const { sx, sy } = toScreen(projX, projY);
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4444";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,100,100,0.3)";
      ctx.fill();
    }

    // Status
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    if (crashed) {
      ctx.fillStyle = "rgba(255,100,100,0.8)";
      ctx.fillText("Crashed — Suborbital trajectory", width / 2, height * 0.08);
    } else if (escaped) {
      ctx.fillStyle = "rgba(200,100,255,0.8)";
      ctx.fillText("Escaped Earth's gravity!", width / 2, height * 0.08);
    } else {
      let trajectory = "Suborbital";
      if (launchSpeed >= ORBITAL_V * 0.95 && launchSpeed < ORBITAL_V * 1.05) trajectory = "Circular orbit";
      else if (launchSpeed >= ORBITAL_V * 1.05 && launchSpeed < ESCAPE_V) trajectory = "Elliptical orbit";
      else if (launchSpeed >= ESCAPE_V) trajectory = "Escape trajectory";
      ctx.fillText(`Trajectory: ${trajectory}`, width / 2, height * 0.08);
    }

    // Speed indicator panel
    const panelX = width * 0.02;
    const panelY = height * 0.12;
    const panelW = width * 0.3;
    const panelH = height * 0.35;

    ctx.fillStyle = "rgba(10,10,30,0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(11, height * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    const tx = panelX + 12;
    let ty = panelY + 22;
    ctx.fillText(`Launch: ${launchSpeed.toFixed(1)} km/s`, tx, ty); ty += 24;

    // Reference speeds
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.fillText("Reference velocities:", tx, ty); ty += 18;

    const refs = [
      { v: ORBITAL_V, label: "Circular orbit", color: "rgba(100,255,100,0.7)" },
      { v: ESCAPE_V, label: "Escape velocity", color: "rgba(200,100,255,0.7)" },
    ];

    for (const ref of refs) {
      ctx.fillStyle = ref.color;
      ctx.fillText(`${ref.label}: ${ref.v.toFixed(2)} km/s`, tx, ty);
      ty += 18;
    }

    ty += 8;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
    const lines = [
      "< 7.9 km/s: Falls back (suborbital)",
      "≈ 7.9 km/s: Circular orbit",
      "7.9-11.2: Elliptical orbit",
      "> 11.2 km/s: Escapes Earth",
    ];
    for (const line of lines) {
      ctx.fillText(line, tx, ty);
      ty += 15;
    }

    // Speed bar
    const barX = width * 0.35;
    const barY = height * 0.88;
    const barW = width * 0.55;
    const barH = 16;

    ctx.fillStyle = "rgba(30,30,50,0.8)";
    ctx.fillRect(barX - 5, barY - 5, barW + 10, barH + 25);

    // Bar gradient
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barGrad.addColorStop(0, "#ff4444");
    barGrad.addColorStop(ORBITAL_V / 14, "#44ff44");
    barGrad.addColorStop(ESCAPE_V / 14, "#aa44ff");
    barGrad.addColorStop(1, "#ff44ff");
    ctx.fillStyle = barGrad;
    ctx.fillRect(barX, barY, barW, barH);

    // Current speed marker
    const markerX = barX + (launchSpeed / 14) * barW;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(markerX - 5, barY - 3);
    ctx.lineTo(markerX + 5, barY - 3);
    ctx.lineTo(markerX, barY + 3);
    ctx.closePath();
    ctx.fill();

    // Bar labels
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(8, height * 0.012)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("0", barX, barY + barH + 12);
    ctx.fillText(`${ORBITAL_V.toFixed(1)}`, barX + (ORBITAL_V / 14) * barW, barY + barH + 12);
    ctx.fillText(`${ESCAPE_V.toFixed(1)}`, barX + (ESCAPE_V / 14) * barW, barY + barH + 12);
    ctx.fillText("14", barX + barW, barY + barH + 12);
    ctx.fillText("km/s", barX + barW + 20, barY + barH + 12);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Newton's Cannonball — Principle of Satellite", width / 2, height - 10);
  }

  function reset() {
    time = 0;
    launchProjectile();
  }

  function destroy() {
    stars = [];
    trail = [];
  }

  function getStateDescription(): string {
    let orbit = "suborbital";
    if (launchSpeed >= ORBITAL_V * 0.95 && launchSpeed < ORBITAL_V * 1.05) orbit = "circular";
    else if (launchSpeed >= ORBITAL_V * 1.05 && launchSpeed < ESCAPE_V) orbit = "elliptical";
    else if (launchSpeed >= ESCAPE_V) orbit = "escape";
    const r = Math.sqrt(projX * projX + projY * projY);
    return `Satellite | v=${launchSpeed.toFixed(1)}km/s | Orbit: ${orbit} | Altitude: ${(r - R_EARTH).toFixed(0)}km | v_orbital=${ORBITAL_V}km/s | v_escape=${ESCAPE_V}km/s | ${crashed ? "CRASHED" : escaped ? "ESCAPED" : "In flight"}`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout(); genStars();
    launchProjectile();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PrincipleOfSatelliteFactory;
