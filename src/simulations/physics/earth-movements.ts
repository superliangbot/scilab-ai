import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EarthMovementsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("earth-movements") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let timeScale = 1;
  let axialTilt = 23.44;
  let showOrbits = 1;
  let showAxis = 1;

  const EARTH_RADIUS = 20;
  const ORBIT_RADIUS_X = 0; // set in init
  const ORBIT_RADIUS_Y = 0;
  let orbitRx = 0;
  let orbitRy = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    orbitRx = Math.min(width, height) * 0.35;
    orbitRy = orbitRx * 0.4; // elliptical perspective
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 1;
    axialTilt = params.axialTilt ?? 23.44;
    showOrbits = params.showOrbits ?? 1;
    showAxis = params.showAxis ?? 1;
    time += dt * timeScale;
  }

  function drawEarth(cx: number, cy: number, rotAngle: number, tilt: number, label: string, season: string): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Axial tilt
    const tiltRad = (tilt * Math.PI) / 180;

    // Earth sphere
    const earthGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, EARTH_RADIUS);
    earthGrad.addColorStop(0, "#5dade2");
    earthGrad.addColorStop(0.4, "#2e86c1");
    earthGrad.addColorStop(1, "#1a5276");
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(0, 0, EARTH_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Land masses (simple)
    ctx.fillStyle = "rgba(76,175,80,0.6)";
    const landOffset = rotAngle * 2;
    for (let i = 0; i < 3; i++) {
      const a = landOffset + i * 2.1;
      const lx = EARTH_RADIUS * 0.5 * Math.cos(a);
      const ly = EARTH_RADIUS * 0.3 * Math.sin(a * 0.7);
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Day/night terminator
    ctx.fillStyle = "rgba(0,0,30,0.4)";
    ctx.beginPath();
    ctx.arc(0, 0, EARTH_RADIUS, -Math.PI / 2, Math.PI / 2);
    ctx.fill();

    // Axis of rotation
    if (showAxis) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      const axisLen = EARTH_RADIUS + 15;
      ctx.beginPath();
      ctx.moveTo(-axisLen * Math.sin(tiltRad), -axisLen * Math.cos(tiltRad));
      ctx.lineTo(axisLen * Math.sin(tiltRad), axisLen * Math.cos(tiltRad));
      ctx.stroke();
      ctx.setLineDash([]);

      // North pole marker
      ctx.fillStyle = "#ff4444";
      ctx.beginPath();
      ctx.arc(
        -(EARTH_RADIUS + 8) * Math.sin(tiltRad),
        -(EARTH_RADIUS + 8) * Math.cos(tiltRad),
        3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 0, EARTH_RADIUS + 30);
    ctx.fillStyle = "rgba(255,200,100,0.8)";
    ctx.fillText(season, 0, EARTH_RADIUS + 44);

    ctx.restore();
  }

  function render(): void {
    // Space background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (let i = 0; i < 150; i++) {
      const sx = (i * 137.5) % width;
      const sy = (i * 97.3 + i * 13.7) % height;
      const b = 0.2 + ((i * 7) % 80) / 100;
      ctx.fillStyle = `rgba(255,255,255,${b})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const sunX = width / 2;
    const sunY = height / 2;

    // Draw orbit path
    if (showOrbits) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(sunX, sunY, orbitRx, orbitRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Orbital angle (1 revolution = 1 year, time in seconds)
    const orbitalAngle = (time * 0.3) % (Math.PI * 2);
    const rotationAngle = time * 10; // Earth rotation (much faster)

    // Draw back-half of orbit Earths first (behind sun)
    const positions = [
      { angle: 0, label: "Mar 21", season: "Spring (N)" },
      { angle: Math.PI / 2, label: "Jun 21", season: "Summer (N)" },
      { angle: Math.PI, label: "Sep 21", season: "Autumn (N)" },
      { angle: (3 * Math.PI) / 2, label: "Dec 21", season: "Winter (N)" },
    ];

    // Draw current Earth position
    const earthX = sunX + orbitRx * Math.cos(orbitalAngle);
    const earthY = sunY + orbitRy * Math.sin(orbitalAngle);

    // Sunlight rays toward Earth
    ctx.strokeStyle = "rgba(255,220,50,0.15)";
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      const angle = Math.atan2(earthY - sunY, earthX - sunX);
      ctx.lineTo(
        sunX + (orbitRx + 30) * Math.cos(angle + i * 0.05),
        sunY + (orbitRy + 30) * Math.sin(angle + i * 0.05)
      );
      ctx.stroke();
    }

    // Draw seasonal position markers
    for (const pos of positions) {
      const px = sunX + orbitRx * Math.cos(pos.angle);
      const py = sunY + orbitRy * Math.sin(pos.angle);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(pos.label, px, py - 30);
    }

    // Draw Sun
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 60);
    sunGlow.addColorStop(0, "rgba(255,220,50,0.8)");
    sunGlow.addColorStop(0.3, "rgba(255,180,30,0.4)");
    sunGlow.addColorStop(1, "rgba(255,150,0,0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 60, 0, Math.PI * 2);
    ctx.fill();

    const sunBody = ctx.createRadialGradient(sunX - 3, sunY - 3, 0, sunX, sunY, 22);
    sunBody.addColorStop(0, "#fff8dc");
    sunBody.addColorStop(0.5, "#FFD700");
    sunBody.addColorStop(1, "#FF8C00");
    ctx.fillStyle = sunBody;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sun", sunX, sunY + 35);

    // Draw Earth at current orbital position
    const currentSeason = orbitalAngle < Math.PI / 4 || orbitalAngle > 7 * Math.PI / 4
      ? "Spring (N)"
      : orbitalAngle < 3 * Math.PI / 4
        ? "Summer (N)"
        : orbitalAngle < 5 * Math.PI / 4
          ? "Autumn (N)"
          : "Winter (N)";

    drawEarth(earthX, earthY, rotationAngle, axialTilt, "Earth", currentSeason);

    // Rotation arrow around Earth
    ctx.strokeStyle = "rgba(100,200,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(earthX, earthY, EARTH_RADIUS + 5, 0, Math.PI * 1.5);
    ctx.stroke();
    // Arrowhead
    const arrowAngle = Math.PI * 1.5;
    const arrowR = EARTH_RADIUS + 5;
    const ax = earthX + arrowR * Math.cos(arrowAngle);
    const ay = earthY + arrowR * Math.sin(arrowAngle);
    ctx.fillStyle = "rgba(100,200,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + 6, ay + 3);
    ctx.lineTo(ax + 3, ay - 5);
    ctx.fill();

    // Orbital direction arrow
    ctx.strokeStyle = "rgba(255,200,100,0.4)";
    ctx.lineWidth = 1;
    const orbArrowAngle = orbitalAngle + 0.3;
    const orbAx = sunX + orbitRx * Math.cos(orbArrowAngle);
    const orbAy = sunY + orbitRy * Math.sin(orbArrowAngle);
    ctx.beginPath();
    ctx.moveTo(orbAx, orbAy);
    ctx.lineTo(orbAx - 8, orbAy - 5);
    ctx.moveTo(orbAx, orbAy);
    ctx.lineTo(orbAx + 2, orbAy - 8);
    ctx.stroke();

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 260, 80, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Earth's Movements", 16, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#ccc";
    const orbDeg = ((orbitalAngle * 180) / Math.PI).toFixed(0);
    ctx.fillText(`Orbital position: ${orbDeg}°`, 16, 46);
    ctx.fillText(`Axial tilt: ${axialTilt.toFixed(1)}°`, 16, 62);
    ctx.fillText(`Rotation: ${(rotationAngle % 360).toFixed(0)}°  |  Season: ${currentSeason}`, 16, 78);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const orbitalAngle = (time * 0.3) % (Math.PI * 2);
    const orbDeg = ((orbitalAngle * 180) / Math.PI).toFixed(0);
    return (
      `Earth Movements: orbital angle=${orbDeg}°, axial tilt=${axialTilt.toFixed(1)}°, ` +
      `time scale=${timeScale}×. ` +
      `Earth rotates on its axis (24h period) while orbiting the Sun (365.25 day period). ` +
      `The 23.44° axial tilt causes seasons: when N hemisphere tilts toward sun → summer, away → winter. ` +
      `Revolution speed ≈ 29.8 km/s, rotation speed ≈ 465 m/s at equator.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    orbitRx = Math.min(width, height) * 0.35;
    orbitRy = orbitRx * 0.4;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EarthMovementsFactory;
