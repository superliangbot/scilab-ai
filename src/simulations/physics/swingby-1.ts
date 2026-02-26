import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const Swingby1Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("swingby-1") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let planetMass = 5;
  let approachSpeed = 3;
  let approachAngle = 30;
  let showVectors = 1;

  // Constants
  const G = 400; // gravitational constant (scaled for simulation)
  const starMass = 50;

  // State
  let starX = 0;
  let starY = 0;
  let planetAngle = 0;
  let planetOrbitRadius = 0;

  // Spacecraft state
  let scX = 0;
  let scY = 0;
  let scVx = 0;
  let scVy = 0;
  let scTrail: { x: number; y: number; speed: number }[] = [];
  let initialSpeed = 0;
  let currentSpeed = 0;
  let maxSpeed = 0;
  let deltaV = 0;
  let hasPassedPlanet = false;
  let preSwingSpeed = 0;
  let postSwingSpeed = 0;

  function resetSpacecraft(): void {
    const angleRad = (approachAngle * Math.PI) / 180;
    // Start spacecraft from left side
    scX = width * 0.08;
    scY = starY - Math.tan(angleRad) * (starX - scX) + height * 0.1;
    const speed = approachSpeed * 15;
    scVx = speed * Math.cos(angleRad);
    scVy = speed * Math.sin(angleRad);
    initialSpeed = Math.sqrt(scVx * scVx + scVy * scVy);
    currentSpeed = initialSpeed;
    maxSpeed = initialSpeed;
    scTrail = [];
    hasPassedPlanet = false;
    preSwingSpeed = initialSpeed;
    postSwingSpeed = initialSpeed;
    deltaV = 0;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;

    starX = width * 0.45;
    starY = height * 0.55;
    planetOrbitRadius = Math.min(width, height) * 0.28;
    planetAngle = Math.PI;

    resetSpacecraft();
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevPlanetMass = planetMass;
    const prevSpeed = approachSpeed;
    const prevAngle = approachAngle;

    planetMass = params.planetMass ?? 5;
    approachSpeed = params.approachSpeed ?? 3;
    approachAngle = params.approachAngle ?? 30;
    showVectors = params.showVectors ?? 1;

    // Reset if params changed significantly
    if (
      Math.abs(prevPlanetMass - planetMass) > 0.01 ||
      Math.abs(prevSpeed - approachSpeed) > 0.01 ||
      Math.abs(prevAngle - approachAngle) > 0.1
    ) {
      resetSpacecraft();
    }

    // Planet orbits the star
    const planetOrbitalSpeed = 0.3;
    planetAngle += planetOrbitalSpeed * dt;
    const planetX = starX + planetOrbitRadius * Math.cos(planetAngle);
    const planetY = starY + planetOrbitRadius * Math.sin(planetAngle);

    // Gravitational forces on spacecraft
    // From star
    const dxStar = starX - scX;
    const dyStar = starY - scY;
    const distStar = Math.sqrt(dxStar * dxStar + dyStar * dyStar) + 10;
    const fStar = (G * starMass) / (distStar * distStar);
    scVx += (fStar * dxStar) / distStar * dt;
    scVy += (fStar * dyStar) / distStar * dt;

    // From planet
    const dxP = planetX - scX;
    const dyP = planetY - scY;
    const distP = Math.sqrt(dxP * dxP + dyP * dyP) + 5;
    const fPlanet = (G * planetMass * 20) / (distP * distP);
    scVx += (fPlanet * dxP) / distP * dt;
    scVy += (fPlanet * dyP) / distP * dt;

    // Update position
    scX += scVx * dt;
    scY += scVy * dt;

    currentSpeed = Math.sqrt(scVx * scVx + scVy * scVy);
    if (currentSpeed > maxSpeed) maxSpeed = currentSpeed;

    // Track closest approach to planet
    if (distP < planetOrbitRadius * 0.5 && !hasPassedPlanet) {
      preSwingSpeed = currentSpeed;
    }
    if (distP < planetOrbitRadius * 0.3) {
      hasPassedPlanet = true;
    }
    if (hasPassedPlanet && distP > planetOrbitRadius * 0.5) {
      postSwingSpeed = currentSpeed;
      deltaV = postSwingSpeed - preSwingSpeed;
    }

    // Trail
    if (scTrail.length === 0 || time % 0.05 < dt) {
      scTrail.push({ x: scX, y: scY, speed: currentSpeed });
      if (scTrail.length > 600) scTrail.shift();
    }

    // Reset spacecraft if it goes off screen
    if (scX > width * 1.2 || scX < -width * 0.2 || scY > height * 1.5 || scY < -height * 0.5) {
      resetSpacecraft();
    }

    time += dt;
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, lw: number = 2): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();

    const headLen = Math.min(8, len * 0.3);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.35), y2 - headLen * Math.sin(angle - 0.35));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.35), y2 - headLen * Math.sin(angle + 0.35));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function render(): void {
    // Dark background gradient (space)
    const bgGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, width);
    bgGrad.addColorStop(0, "#0f0f20");
    bgGrad.addColorStop(1, "#050510");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Planet orbit path
    ctx.beginPath();
    ctx.arc(starX, starY, planetOrbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100, 150, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw star
    const starGlow = ctx.createRadialGradient(starX, starY, 0, starX, starY, 40);
    starGlow.addColorStop(0, "rgba(255, 255, 200, 1)");
    starGlow.addColorStop(0.3, "rgba(255, 200, 50, 0.8)");
    starGlow.addColorStop(0.7, "rgba(255, 150, 0, 0.2)");
    starGlow.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.beginPath();
    ctx.arc(starX, starY, 40, 0, Math.PI * 2);
    ctx.fillStyle = starGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(starX, starY, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8e0";
    ctx.fill();

    // Draw planet
    const planetX = starX + planetOrbitRadius * Math.cos(planetAngle);
    const planetY = starY + planetOrbitRadius * Math.sin(planetAngle);
    const planetR = 8 + planetMass * 1.2;

    const planetGlow = ctx.createRadialGradient(planetX, planetY, 0, planetX, planetY, planetR * 3);
    planetGlow.addColorStop(0, "rgba(100, 150, 255, 0.4)");
    planetGlow.addColorStop(1, "rgba(100, 150, 255, 0)");
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetR * 3, 0, Math.PI * 2);
    ctx.fillStyle = planetGlow;
    ctx.fill();

    const pGrad = ctx.createRadialGradient(planetX - 2, planetY - 2, 0, planetX, planetY, planetR);
    pGrad.addColorStop(0, "#8bb8ff");
    pGrad.addColorStop(1, "#3366aa");
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
    ctx.fillStyle = pGrad;
    ctx.fill();

    // Draw spacecraft trail (colored by speed)
    if (scTrail.length > 1) {
      for (let i = 1; i < scTrail.length; i++) {
        const t = scTrail[i];
        const prev = scTrail[i - 1];
        const speedRatio = t.speed / (maxSpeed + 1);
        const alpha = (i / scTrail.length) * 0.8;

        // Color: blue (slow) to red (fast)
        const r = Math.floor(50 + speedRatio * 205);
        const g = Math.floor(100 * (1 - speedRatio));
        const b = Math.floor(255 * (1 - speedRatio));

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw spacecraft
    const scAngle = Math.atan2(scVy, scVx);
    ctx.save();
    ctx.translate(scX, scY);
    ctx.rotate(scAngle);

    // Body
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fillStyle = "#e0e0e0";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Velocity vector
    if (showVectors) {
      const vScale = 0.8;
      drawArrow(scX, scY, scX + scVx * vScale, scY + scVy * vScale, "#44ff88", 2);

      ctx.fillStyle = "#44ff88";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(
        `v = ${(currentSpeed / 15).toFixed(1)} km/s`,
        scX + scVx * vScale + 5,
        scY + scVy * vScale
      );
    }

    // Info panel
    const panelX = 12;
    const panelY2 = 12;
    const panelW = 200;
    const panelH = 260;

    ctx.fillStyle = "rgba(5, 8, 18, 0.88)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY2, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 200, 150, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let ty = panelY2 + 14;
    const lx = panelX + 12;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#88ddaa";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("Gravitational Slingshot", lx, ty);
    ty += 24;

    ctx.fillStyle = "#ffd966";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Physics:", lx, ty);
    ty += 18;

    ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("F = GMm/r²", lx, ty);
    ty += 16;
    ctx.fillText("Energy conserved in", lx, ty);
    ty += 14;
    ctx.fillText("planet's frame", lx, ty);
    ty += 22;

    ctx.fillStyle = "#66ffaa";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Velocity:", lx, ty);
    ty += 18;

    ctx.fillStyle = "rgba(200, 220, 255, 0.85)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Initial: ${(initialSpeed / 15).toFixed(1)} km/s`, lx, ty);
    ty += 16;
    ctx.fillText(`Current: ${(currentSpeed / 15).toFixed(1)} km/s`, lx, ty);
    ty += 16;
    ctx.fillText(`Max: ${(maxSpeed / 15).toFixed(1)} km/s`, lx, ty);
    ty += 20;

    if (hasPassedPlanet && deltaV !== 0) {
      ctx.fillStyle = deltaV > 0 ? "#66ffaa" : "#ff6666";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillText(
        `ΔV: ${deltaV > 0 ? "+" : ""}${(deltaV / 15).toFixed(1)} km/s`,
        lx,
        ty
      );
      ty += 18;

      const ratio = ((postSwingSpeed / (preSwingSpeed + 0.01)) * 100 - 100);
      ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(`Speed change: ${ratio > 0 ? "+" : ""}${ratio.toFixed(1)}%`, lx, ty);
    }

    // Speed color legend at bottom
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 14);

    // Trail legend
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(200, 220, 255, 0.5)";
    ctx.fillText("Trail: blue=slow  red=fast", width - 12, height - 14);
  }

  function reset(): void {
    time = 0;
    planetAngle = Math.PI;
    resetSpacecraft();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Gravitational Slingshot: Planet mass=${planetMass}, ` +
      `approach speed=${approachSpeed} km/s, angle=${approachAngle}°. ` +
      `Current speed=${(currentSpeed / 15).toFixed(1)} km/s, ` +
      `max speed=${(maxSpeed / 15).toFixed(1)} km/s. ` +
      `${hasPassedPlanet ? `ΔV=${(deltaV / 15).toFixed(1)} km/s after flyby.` : "Approaching planet."} ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    starX = width * 0.45;
    starY = height * 0.55;
    planetOrbitRadius = Math.min(width, height) * 0.28;
    resetSpacecraft();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Swingby1Factory;
