import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TidalForceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("tidal-force") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let moonDistance = 1;
  let moonMass = 1;
  let earthRotation = 1;
  let showForceVectors = 1;

  // Constants (scaled for visualization)
  const G = 6.674e-11;
  const EARTH_RADIUS = 6.371e6; // m
  const MOON_MASS_REAL = 7.342e22; // kg
  const MOON_DIST_REAL = 3.844e8; // m

  let moonAngle = 0;
  let earthAngle = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    moonAngle = 0;
    earthAngle = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    moonDistance = params.moonDistance ?? 1;
    moonMass = params.moonMass ?? 1;
    earthRotation = params.earthRotation ?? 1;
    showForceVectors = params.showForceVectors ?? 1;
    time += dt;

    // Moon orbits Earth: period ~27.3 days, scaled for visualization
    const orbitSpeed = 0.15; // radians per second for visual
    moonAngle += orbitSpeed * dt;

    // Earth rotates
    earthAngle += earthRotation * 0.5 * dt;
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#050520");
    bgGrad.addColorStop(0.5, "#0a0a30");
    bgGrad.addColorStop(1, "#050520");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    const rng = (seed: number) => {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 80; i++) {
      const sx = rng(i) * width;
      const sy = rng(i + 100) * height;
      const brightness = 0.3 + rng(i + 200) * 0.7;
      ctx.fillStyle = `rgba(255,255,255,${brightness * 0.5})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Tidal Force", width / 2, 24);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Differential gravitational force from the Moon", width / 2, 42);

    // Earth and Moon positions
    const earthCX = width * 0.38;
    const earthCY = height * 0.48;
    const earthR = Math.min(width, height) * 0.13;
    const moonOrbitR = earthR * 3.5 * moonDistance;
    const moonR = earthR * 0.27;

    const moonCX = earthCX + Math.cos(moonAngle) * moonOrbitR;
    const moonCY = earthCY + Math.sin(moonAngle) * moonOrbitR;

    // Moon orbit path
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, moonOrbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // === Draw tidal bulges on Earth ===
    const bulgeAngle = moonAngle; // bulges align toward/away from Moon
    const bulgeStrength = (moonMass / (moonDistance * moonDistance * moonDistance)) * 0.25;
    const bulgeNear = earthR * (1 + bulgeStrength);
    const bulgePerp = earthR * (1 - bulgeStrength * 0.5);

    // Draw ocean layer with tidal bulge (ellipse oriented toward Moon)
    ctx.save();
    ctx.translate(earthCX, earthCY);
    ctx.rotate(bulgeAngle);

    // Ocean (tidal bulge)
    ctx.beginPath();
    ctx.ellipse(0, 0, bulgeNear, bulgePerp, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(59,130,246,0.3)";
    ctx.fill();
    ctx.strokeStyle = "rgba(96,165,250,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Earth body
    ctx.beginPath();
    ctx.arc(0, 0, earthR * 0.92, 0, Math.PI * 2);
    const earthGrad = ctx.createRadialGradient(-earthR * 0.2, -earthR * 0.2, 0, 0, 0, earthR * 0.92);
    earthGrad.addColorStop(0, "#4ade80");
    earthGrad.addColorStop(0.5, "#16a34a");
    earthGrad.addColorStop(1, "#14532d");
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Simple continent shapes
    ctx.save();
    ctx.rotate(earthAngle);
    ctx.fillStyle = "rgba(34,197,94,0.5)";
    ctx.beginPath();
    ctx.arc(earthR * 0.3, -earthR * 0.2, earthR * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-earthR * 0.4, earthR * 0.3, earthR * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // === Force vectors at points on Earth's surface ===
    if (showForceVectors) {
      const numPoints = 16;
      const scaledMoonMass = MOON_MASS_REAL * moonMass;
      const scaledMoonDist = MOON_DIST_REAL * moonDistance;

      // Average gravitational acceleration at Earth center
      const aCenter = G * scaledMoonMass / (scaledMoonDist * scaledMoonDist);

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const px = earthCX + Math.cos(angle) * earthR;
        const py = earthCY + Math.sin(angle) * earthR;

        // Vector from this point to Moon
        const dx = moonCX - px;
        const dy = moonCY - py;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;

        // Gravitational acceleration at this point (toward Moon)
        const distMeters = (dist / moonOrbitR) * scaledMoonDist;
        const aPoint = G * scaledMoonMass / (distMeters * distMeters);

        // Tidal force = local gravity - center gravity (differential)
        // Approximate: project along and perpendicular to Moon direction
        const dxMoon = moonCX - earthCX;
        const dyMoon = moonCY - earthCY;
        const distMoon = Math.sqrt(dxMoon * dxMoon + dyMoon * dyMoon) || 1;
        const moonDirX = dxMoon / distMoon;
        const moonDirY = dyMoon / distMoon;

        // Tidal acceleration components
        const tideX = aPoint * dirX - aCenter * moonDirX;
        const tideY = aPoint * dirY - aCenter * moonDirY;
        const tideMag = Math.sqrt(tideX * tideX + tideY * tideY);

        // Scale for display
        const arrowScale = earthR * 4 / aCenter;
        const ax = tideX * arrowScale;
        const ay = tideY * arrowScale;
        const arrowLen = Math.sqrt(ax * ax + ay * ay);

        if (arrowLen > 1) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + ax, py + ay);
          ctx.stroke();

          // Arrowhead
          const aAngle = Math.atan2(ay, ax);
          ctx.beginPath();
          ctx.moveTo(px + ax, py + ay);
          ctx.lineTo(px + ax - 6 * Math.cos(aAngle - 0.4), py + ay - 6 * Math.sin(aAngle - 0.4));
          ctx.moveTo(px + ax, py + ay);
          ctx.lineTo(px + ax - 6 * Math.cos(aAngle + 0.4), py + ay - 6 * Math.sin(aAngle + 0.4));
          ctx.stroke();
        }
      }
    }

    // Label tidal bulges
    ctx.fillStyle = "#60a5fa";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    const nearX = earthCX + Math.cos(bulgeAngle) * (bulgeNear + 15);
    const nearY = earthCY + Math.sin(bulgeAngle) * (bulgeNear + 15);
    ctx.fillText("Near-side bulge", nearX, nearY);
    const farX = earthCX + Math.cos(bulgeAngle + Math.PI) * (bulgeNear + 15);
    const farY = earthCY + Math.sin(bulgeAngle + Math.PI) * (bulgeNear + 15);
    ctx.fillText("Far-side bulge", farX, farY);

    // Earth label
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Earth", earthCX, earthCY + earthR + 18);

    // === Draw Moon ===
    const moonGrad = ctx.createRadialGradient(moonCX - moonR * 0.3, moonCY - moonR * 0.3, 0, moonCX, moonCY, moonR);
    moonGrad.addColorStop(0, "#e2e8f0");
    moonGrad.addColorStop(0.7, "#94a3b8");
    moonGrad.addColorStop(1, "#64748b");
    ctx.beginPath();
    ctx.arc(moonCX, moonCY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // Moon craters
    ctx.fillStyle = "rgba(100,116,139,0.5)";
    ctx.beginPath();
    ctx.arc(moonCX + moonR * 0.2, moonCY - moonR * 0.1, moonR * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonCX - moonR * 0.3, moonCY + moonR * 0.2, moonR * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Moon", moonCX, moonCY + moonR + 14);

    // === Info panel ===
    const panelX = width * 0.68;
    const panelY2 = height * 0.7;
    const panelW = width * 0.3;
    const panelH = height * 0.28;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY2, panelW, panelH, 8);
    ctx.fill();

    let ty = panelY2 + 18;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Tidal Force", panelX + 10, ty); ty += 22;

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "11px monospace";
    ctx.fillText("F_tidal = 2GMmΔr / r³", panelX + 10, ty); ty += 18;
    ctx.fillText("F ∝ M / r³", panelX + 10, ty); ty += 22;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    const scaledMoonDist2 = MOON_DIST_REAL * moonDistance;
    const tidalAccel = 2 * G * MOON_MASS_REAL * moonMass * EARTH_RADIUS / (scaledMoonDist2 * scaledMoonDist2 * scaledMoonDist2);
    ctx.fillText(`Distance: ${(moonDistance).toFixed(2)}x (${(scaledMoonDist2 / 1e6).toFixed(0)} km)`, panelX + 10, ty); ty += 16;
    ctx.fillText(`Mass: ${moonMass.toFixed(1)}x`, panelX + 10, ty); ty += 16;
    ctx.fillText(`Tidal accel: ${(tidalAccel * 1e6).toFixed(3)} μm/s²`, panelX + 10, ty); ty += 16;

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Inverse cube law: halving", panelX + 10, ty); ty += 14;
    ctx.fillText("distance → 8× stronger tides", panelX + 10, ty);
  }

  function reset(): void {
    time = 0;
    moonAngle = 0;
    earthAngle = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const scaledMoonDist = MOON_DIST_REAL * moonDistance;
    const tidalAccel = 2 * G * MOON_MASS_REAL * moonMass * EARTH_RADIUS / (scaledMoonDist * scaledMoonDist * scaledMoonDist);
    return (
      `Tidal Force: Moon distance=${moonDistance.toFixed(2)}× (${(scaledMoonDist / 1e6).toFixed(0)} km), ` +
      `Moon mass=${moonMass.toFixed(1)}×. Tidal acceleration=${(tidalAccel * 1e6).toFixed(3)} μm/s². ` +
      `The tidal force follows an inverse cube law: ΔF = 2GMmΔr/r³. ` +
      `Two tidal bulges form on opposite sides of Earth — one facing the Moon (stronger pull) ` +
      `and one on the far side (weaker pull, inertia dominates).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TidalForceFactory;
