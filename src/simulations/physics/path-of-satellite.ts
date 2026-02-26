import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface TrailPoint {
  x: number;
  y: number;
  vMag: number;
}

const PathOfSatelliteFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("path-of-satellite") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Constants (scaled for simulation)
  const G_REAL = 6.674e-11;
  const M_EARTH = 5.972e24;
  const R_EARTH = 6.371e6; // meters
  const SCALE = 1.8e-5; // meters to pixels
  const GM_BASE = G_REAL * M_EARTH;

  // Satellite state (in real units: meters, m/s)
  let sx = 0;
  let sy = 0;
  let svx = 0;
  let svy = 0;

  // Tracking
  let trail: TrailPoint[] = [];
  let orbitType = "suborbital";
  let maxAlt = 0;
  let minAlt = Infinity;
  let period = 0;
  let hasCompletedOrbit = false;
  let startAngle = 0;
  let prevAngle = 0;
  let totalAngle = 0;
  let crashed = false;

  // Params cache
  let launchVelocity = 7.9;
  let launchAngle = 0;
  let earthMassMult = 1;
  let showVectors = 1;

  function centerX(): number { return width / 2; }
  function centerY(): number { return height / 2; }
  function earthRadiusPx(): number { return R_EARTH * SCALE; }

  function launchSatellite(): void {
    const GM = GM_BASE * earthMassMult;
    const launchR = R_EARTH + 200000; // 200 km altitude
    const angleRad = (launchAngle * Math.PI) / 180;
    const vMs = launchVelocity * 1000; // km/s to m/s

    // Position at right side of Earth, at launch altitude
    sx = launchR;
    sy = 0;

    // Velocity: tangential (perpendicular to radius) + radial component from angle
    // angle=0 means purely tangential (prograde), angle=90 means purely radial (upward)
    svx = -vMs * Math.sin(angleRad); // radial outward component (along x) becomes -sin for tangent
    svy = vMs * Math.cos(angleRad);  // tangential component

    trail = [];
    orbitType = "calculating...";
    maxAlt = 0;
    minAlt = Infinity;
    hasCompletedOrbit = false;
    totalAngle = 0;
    prevAngle = Math.atan2(sy, sx);
    startAngle = prevAngle;
    crashed = false;

    // Determine orbit type from energy
    const r = Math.sqrt(sx * sx + sy * sy);
    const v = Math.sqrt(svx * svx + svy * svy);
    const specificEnergy = 0.5 * v * v - GM / r;
    const vCircular = Math.sqrt(GM / r);
    const vEscape = Math.sqrt(2 * GM / r);

    if (v >= vEscape * 0.99) {
      orbitType = "escape";
    } else if (Math.abs(v - vCircular) / vCircular < 0.05) {
      orbitType = "circular";
    } else if (specificEnergy < 0) {
      // Check if periapsis is below Earth surface
      const L = r * v; // approximate specific angular momentum
      const a = -GM / (2 * specificEnergy);
      const e = Math.sqrt(1 + (2 * specificEnergy * L * L) / (GM * GM));
      const rPeri = a * (1 - e);
      if (rPeri < R_EARTH) {
        orbitType = "suborbital";
      } else {
        orbitType = "elliptical";
      }
      if (a > 0) {
        period = 2 * Math.PI * Math.sqrt((a * a * a) / GM);
      }
    } else {
      orbitType = "escape";
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    launchSatellite();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newLV = params.launchVelocity ?? 7.9;
    const newLA = params.launchAngle ?? 0;
    const newEM = params.earthMass ?? 1;
    showVectors = params.showVectors ?? 1;

    if (newLV !== launchVelocity || newLA !== launchAngle || newEM !== earthMassMult) {
      launchVelocity = newLV;
      launchAngle = newLA;
      earthMassMult = newEM;
      time = 0;
      launchSatellite();
      return;
    }

    if (crashed) return;

    const GM = GM_BASE * earthMassMult;
    const step = Math.min(dt, 0.033);
    // Use many sub-steps for numerical stability (Verlet integration)
    const subSteps = 80;
    const subDt = step * 300 / subSteps; // time acceleration

    for (let i = 0; i < subSteps; i++) {
      const r = Math.sqrt(sx * sx + sy * sy);
      if (r < R_EARTH) {
        crashed = true;
        if (orbitType !== "escape") orbitType = "suborbital";
        break;
      }

      // Gravitational acceleration
      const aFactor = -GM / (r * r * r);
      const ax = aFactor * sx;
      const ay = aFactor * sy;

      // Velocity Verlet
      svx += ax * subDt;
      svy += ay * subDt;
      sx += svx * subDt;
      sy += svy * subDt;

      // Track altitude extremes
      const alt = r - R_EARTH;
      if (alt > maxAlt) maxAlt = alt;
      if (alt < minAlt) minAlt = alt;

      // Track total angle swept
      const angle = Math.atan2(sy, sx);
      let dAngle = angle - prevAngle;
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
      if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
      totalAngle += dAngle;
      prevAngle = angle;

      if (Math.abs(totalAngle) >= 2 * Math.PI && !hasCompletedOrbit) {
        hasCompletedOrbit = true;
      }
    }

    // Record trail
    const v = Math.sqrt(svx * svx + svy * svy);
    const px = centerX() + sx * SCALE;
    const py = centerY() - sy * SCALE;
    trail.push({ x: px, y: py, vMag: v });
    if (trail.length > 2000) trail.splice(0, trail.length - 2000);

    // Escape detection
    const rDist = Math.sqrt(sx * sx + sy * sy);
    if (rDist > R_EARTH * 15) {
      crashed = true; // out of view
    }

    time += step;
  }

  function render(): void {
    // Dark space background
    const bgGrad = ctx.createRadialGradient(centerX(), centerY(), 0, centerX(), centerY(), Math.max(width, height));
    bgGrad.addColorStop(0, "#0a0a2e");
    bgGrad.addColorStop(1, "#000008");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    const rng = (s: number) => { let x = Math.sin(s) * 43758.5453; return x - Math.floor(x); };
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 120; i++) {
      ctx.beginPath();
      ctx.arc(rng(i * 3.1) * width, rng(i * 7.7) * height, rng(i * 1.3) * 1.2 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = centerX();
    const cy = centerY();
    const er = earthRadiusPx();

    // Draw orbit trail
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const alpha = 0.2 + 0.8 * (i / trail.length);
        let color: string;
        if (orbitType === "escape") color = `rgba(255,100,100,${alpha})`;
        else if (orbitType === "circular") color = `rgba(100,255,100,${alpha})`;
        else if (orbitType === "elliptical") color = `rgba(100,180,255,${alpha})`;
        else color = `rgba(255,200,80,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Draw Earth
    const earthGrad = ctx.createRadialGradient(cx - er * 0.3, cy - er * 0.3, er * 0.1, cx, cy, er);
    earthGrad.addColorStop(0, "#4db8ff");
    earthGrad.addColorStop(0.4, "#2196F3");
    earthGrad.addColorStop(0.7, "#1565C0");
    earthGrad.addColorStop(1, "#0D47A1");
    ctx.beginPath();
    ctx.arc(cx, cy, er, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Atmosphere glow
    const atmoGrad = ctx.createRadialGradient(cx, cy, er * 0.9, cx, cy, er * 1.15);
    atmoGrad.addColorStop(0, "rgba(100,180,255,0.2)");
    atmoGrad.addColorStop(1, "rgba(100,180,255,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, er * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = atmoGrad;
    ctx.fill();

    // Draw satellite
    if (!crashed || orbitType === "suborbital") {
      const satX = cx + sx * SCALE;
      const satY = cy - sy * SCALE;

      // Satellite glow
      const satGlow = ctx.createRadialGradient(satX, satY, 0, satX, satY, 12);
      satGlow.addColorStop(0, "rgba(255,255,200,0.8)");
      satGlow.addColorStop(1, "rgba(255,255,200,0)");
      ctx.beginPath();
      ctx.arc(satX, satY, 12, 0, Math.PI * 2);
      ctx.fillStyle = satGlow;
      ctx.fill();

      // Satellite body
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(satX, satY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Solar panels
      ctx.strokeStyle = "#66bbff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(satX - 10, satY);
      ctx.lineTo(satX + 10, satY);
      ctx.stroke();

      // Vectors
      if (showVectors >= 0.5 && !crashed) {
        const GM = GM_BASE * earthMassMult;
        const r = Math.sqrt(sx * sx + sy * sy);
        const vScale = 0.008;
        const aFactor = GM / (r * r);
        const fScale = 0.0000025;

        // Velocity vector (green)
        ctx.beginPath();
        ctx.moveTo(satX, satY);
        ctx.lineTo(satX + svx * vScale, satY - svy * vScale);
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Arrowhead
        const vAngle = Math.atan2(-svy * vScale, svx * vScale);
        ctx.beginPath();
        ctx.moveTo(satX + svx * vScale, satY - svy * vScale);
        ctx.lineTo(satX + svx * vScale - 8 * Math.cos(vAngle - 0.4), satY - svy * vScale - 8 * Math.sin(vAngle - 0.4));
        ctx.moveTo(satX + svx * vScale, satY - svy * vScale);
        ctx.lineTo(satX + svx * vScale - 8 * Math.cos(vAngle + 0.4), satY - svy * vScale - 8 * Math.sin(vAngle + 0.4));
        ctx.stroke();

        // Gravity vector (red, points toward Earth)
        const gx = (-sx / r) * aFactor * fScale;
        const gy = (sy / r) * aFactor * fScale;
        ctx.beginPath();
        ctx.moveTo(satX, satY);
        ctx.lineTo(satX + gx, satY + gy);
        ctx.strokeStyle = "#ff4444";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Mark apogee/perigee for elliptical orbits
    if (orbitType === "elliptical" && hasCompletedOrbit) {
      const apogeeR = (R_EARTH + maxAlt) * SCALE;
      const perigeeR = (R_EARTH + minAlt) * SCALE;

      ctx.fillStyle = "rgba(255,100,100,0.7)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Apogee", cx + apogeeR + 15, cy - 5);
      ctx.beginPath();
      ctx.arc(cx + apogeeR, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(100,255,100,0.7)";
      ctx.fillText("Perigee", cx - perigeeR - 15, cy - 5);
      ctx.beginPath();
      ctx.arc(cx - perigeeR, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Info panel
    drawInfoPanel();

    // Legend
    drawLegend();
  }

  function drawInfoPanel(): void {
    const panelW = 250;
    const panelH = 115;
    const px = 10;
    const py = 10;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Satellite Orbital Mechanics", px + 10, py + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";

    const v = Math.sqrt(svx * svx + svy * svy) / 1000; // m/s to km/s
    const r = Math.sqrt(sx * sx + sy * sy);
    const alt = (r - R_EARTH) / 1000; // meters to km

    let typeColor = "#ffcc44";
    if (orbitType === "circular") typeColor = "#00ff88";
    else if (orbitType === "elliptical") typeColor = "#66aaff";
    else if (orbitType === "escape") typeColor = "#ff6666";

    ctx.fillText(`Velocity: ${v.toFixed(2)} km/s`, px + 10, py + 40);
    ctx.fillStyle = typeColor;
    ctx.fillText(`Orbit: ${orbitType}`, px + 10, py + 56);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Altitude: ${alt.toFixed(0)} km`, px + 10, py + 72);

    if (period > 0 && (orbitType === "elliptical" || orbitType === "circular")) {
      const periodMin = period / 60;
      ctx.fillText(`Period: ${periodMin.toFixed(1)} min`, px + 10, py + 88);
    } else {
      ctx.fillText(`Period: N/A`, px + 10, py + 88);
    }

    if (crashed && orbitType === "suborbital") {
      ctx.fillStyle = "#ff6666";
      ctx.fillText("Crashed into Earth!", px + 10, py + 104);
    } else if (crashed && orbitType === "escape") {
      ctx.fillStyle = "#ffaa44";
      ctx.fillText("Escaped Earth's gravity", px + 10, py + 104);
    }
  }

  function drawLegend(): void {
    const lx = width - 180;
    const ly = height - 70;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, 170, 60, 8);
    ctx.fill();

    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.fillStyle = "#00ff88";
    ctx.fillText("-- Velocity vector", lx + 10, ly + 16);
    ctx.fillStyle = "#ff4444";
    ctx.fillText("-- Gravity vector", lx + 10, ly + 32);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("v_circ = \u221A(GM/r)  v_esc = \u221A(2GM/r)", lx + 10, ly + 50);
  }

  function reset(): void {
    time = 0;
    launchSatellite();
  }

  function destroy(): void {
    trail = [];
  }

  function getStateDescription(): string {
    const v = Math.sqrt(svx * svx + svy * svy) / 1000;
    const r = Math.sqrt(sx * sx + sy * sy);
    const alt = (r - R_EARTH) / 1000;
    const periodMin = period > 0 ? (period / 60).toFixed(1) : "N/A";
    return (
      `Satellite Orbit simulation. Launch velocity: ${launchVelocity} km/s, ` +
      `launch angle: ${launchAngle}\u00B0, Earth mass: ${earthMassMult}\u00D7M\u2295. ` +
      `Orbit type: ${orbitType}. Current velocity: ${v.toFixed(2)} km/s. ` +
      `Altitude: ${alt.toFixed(0)} km. Period: ${periodMin} min. ` +
      `Apogee: ${(maxAlt / 1000).toFixed(0)} km, Perigee: ${(minAlt / 1000).toFixed(0)} km. ` +
      `Time: ${time.toFixed(1)}s. ${crashed ? "Satellite has " + (orbitType === "escape" ? "escaped." : "crashed.") : "In flight."}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    trail = [];
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

export default PathOfSatelliteFactory;
