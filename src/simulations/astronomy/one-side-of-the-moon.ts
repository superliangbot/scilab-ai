import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const OneSideOfTheMoonFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("one-side-of-the-moon") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Orbital state
  let orbitalAngle = 0;
  let moonRotationAngle = 0;
  let trail: Array<{ x: number; y: number; age: number }> = [];

  // Cached parameters
  let orbitalSpeed = 1;
  let showTrail = 1;
  let tidalLock = 1;
  let moonRotationSpeed = 1;

  // Constants
  const ORBITAL_PERIOD_BASE = 10; // seconds for one full orbit at speed=1
  const TRAIL_MAX = 200;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    orbitalAngle = 0;
    moonRotationAngle = 0;
    trail = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    orbitalSpeed = params.orbitalSpeed ?? 1;
    showTrail = params.showTrail ?? 1;
    tidalLock = params.tidalLock ?? 1;
    moonRotationSpeed = params.moonRotationSpeed ?? 1;

    time += dt;

    const angularVelocity = (2 * Math.PI * orbitalSpeed) / ORBITAL_PERIOD_BASE;
    orbitalAngle += angularVelocity * dt;

    if (tidalLock >= 0.5) {
      // Tidal lock: rotation matches orbital rate exactly
      moonRotationAngle = orbitalAngle;
    } else {
      // Free rotation at its own rate
      const rotVelocity = (2 * Math.PI * moonRotationSpeed) / ORBITAL_PERIOD_BASE;
      moonRotationAngle += rotVelocity * dt;
    }

    // Build trail
    const cx = width / 2;
    const cy = height / 2;
    const orbitRadius = Math.min(width, height) * 0.3;
    const mx = cx + Math.cos(orbitalAngle) * orbitRadius;
    const my = cy + Math.sin(orbitalAngle) * orbitRadius;

    trail.push({ x: mx, y: my, age: 0 });
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].age += dt;
      if (trail[i].age > 8) {
        trail.splice(i, 1);
      }
    }
    if (trail.length > TRAIL_MAX) {
      trail.splice(0, trail.length - TRAIL_MAX);
    }
  }

  function drawStarfield(): void {
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    // Subtle stars
    const rng = (seed: number) => {
      const x = Math.sin(seed) * 43758.5453;
      return x - Math.floor(x);
    };
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = 0; i < 120; i++) {
      const sx = rng(i * 7.3) * width;
      const sy = rng(i * 13.7) * height;
      const r = rng(i * 3.1) * 1.2 + 0.3;
      const flicker = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 0.8 + i));
      ctx.globalAlpha = flicker * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawOrbitPath(): void {
    const cx = width / 2;
    const cy = height / 2;
    const orbitRadius = Math.min(width, height) * 0.3;

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(100, 140, 200, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawTrail(): void {
    if (showTrail < 0.5 || trail.length < 2) return;

    ctx.save();
    for (let i = 1; i < trail.length; i++) {
      const alpha = Math.max(0, 1 - trail[i].age / 8) * 0.6;
      ctx.strokeStyle = `rgba(180, 200, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEarth(): void {
    const cx = width / 2;
    const cy = height / 2;
    const earthRadius = Math.min(width, height) * 0.07;

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, earthRadius * 0.8, cx, cy, earthRadius * 3);
    glow.addColorStop(0, "rgba(60, 130, 255, 0.15)");
    glow.addColorStop(1, "rgba(60, 130, 255, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, earthRadius * 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Earth body
    const earthGrad = ctx.createRadialGradient(
      cx - earthRadius * 0.3, cy - earthRadius * 0.3, earthRadius * 0.1,
      cx, cy, earthRadius
    );
    earthGrad.addColorStop(0, "#5b9bd5");
    earthGrad.addColorStop(0.4, "#2e7d32");
    earthGrad.addColorStop(0.7, "#1565c0");
    earthGrad.addColorStop(1, "#0d3b66");
    ctx.beginPath();
    ctx.arc(cx, cy, earthRadius, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Earth", cx, cy + earthRadius + 6);
  }

  function drawMoon(): void {
    const cx = width / 2;
    const cy = height / 2;
    const orbitRadius = Math.min(width, height) * 0.3;
    const moonRadius = Math.min(width, height) * 0.04;

    const mx = cx + Math.cos(orbitalAngle) * orbitRadius;
    const my = cy + Math.sin(orbitalAngle) * orbitRadius;

    // Moon glow
    const moonGlow = ctx.createRadialGradient(mx, my, moonRadius * 0.5, mx, my, moonRadius * 2.5);
    moonGlow.addColorStop(0, "rgba(200, 200, 220, 0.12)");
    moonGlow.addColorStop(1, "rgba(200, 200, 220, 0)");
    ctx.beginPath();
    ctx.arc(mx, my, moonRadius * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = moonGlow;
    ctx.fill();

    // Moon body
    const moonGrad = ctx.createRadialGradient(
      mx - moonRadius * 0.3, my - moonRadius * 0.3, moonRadius * 0.1,
      mx, my, moonRadius
    );
    moonGrad.addColorStop(0, "#d4d4d8");
    moonGrad.addColorStop(0.6, "#a1a1aa");
    moonGrad.addColorStop(1, "#71717a");
    ctx.beginPath();
    ctx.arc(mx, my, moonRadius, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // Crater details
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, moonRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(80, 80, 90, 0.3)";
    const craters = [
      { dx: -0.3, dy: -0.2, r: 0.2 },
      { dx: 0.2, dy: 0.3, r: 0.15 },
      { dx: 0.4, dy: -0.1, r: 0.12 },
    ];
    for (const c of craters) {
      // Crater positions rotate with the moon
      const cx2 = Math.cos(moonRotationAngle) * c.dx - Math.sin(moonRotationAngle) * c.dy;
      const cy2 = Math.sin(moonRotationAngle) * c.dx + Math.cos(moonRotationAngle) * c.dy;
      ctx.beginPath();
      ctx.arc(mx + cx2 * moonRadius, my + cy2 * moonRadius, c.r * moonRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Reference marker (red dot) - always at the "Earth-facing side" initially
    // Marker is at angle 0 in moon's local frame
    const markerLocalX = -1; // Points toward Earth when tidal locked at angle=0
    const markerLocalY = 0;
    const rotatedX = Math.cos(moonRotationAngle) * markerLocalX - Math.sin(moonRotationAngle) * markerLocalY;
    const rotatedY = Math.sin(moonRotationAngle) * markerLocalX + Math.cos(moonRotationAngle) * markerLocalY;
    const markerX = mx + rotatedX * moonRadius * 0.75;
    const markerY = my + rotatedY * moonRadius * 0.75;

    // Marker glow
    ctx.beginPath();
    ctx.arc(markerX, markerY, moonRadius * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(markerX, markerY, moonRadius * 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 80, 80, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw a line from Earth to Moon showing tidal connection
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "rgba(255, 200, 80, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Arrow showing Moon rotation direction
    const arrowAngle = moonRotationAngle + Math.PI / 2;
    const arrowDist = moonRadius + 12;
    const arrowX = mx + Math.cos(orbitalAngle) * arrowDist;
    const arrowY = my + Math.sin(orbitalAngle) * arrowDist;
    const arrowTipX = arrowX + Math.cos(arrowAngle) * 8;
    const arrowTipY = arrowY + Math.sin(arrowAngle) * 8;

    ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, moonRadius + 8, orbitalAngle - 0.5, orbitalAngle + 0.5);
    ctx.stroke();

    // Tiny arrowhead
    ctx.beginPath();
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(arrowTipX - 4 * Math.cos(arrowAngle - 0.6), arrowTipY - 4 * Math.sin(arrowAngle - 0.6));
    ctx.stroke();
  }

  function drawInfoPanel(): void {
    ctx.save();

    const panelW = 240;
    const panelH = 120;
    const panelX = 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Tidal Locking", panelX + 12, panelY + 10);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

    const orbPeriod = (ORBITAL_PERIOD_BASE / orbitalSpeed).toFixed(1);
    let rotPeriod: string;
    if (tidalLock >= 0.5) {
      rotPeriod = orbPeriod;
    } else {
      rotPeriod = (ORBITAL_PERIOD_BASE / moonRotationSpeed).toFixed(1);
    }

    ctx.fillText(`Orbital period: ${orbPeriod} s`, panelX + 12, panelY + 32);
    ctx.fillText(`Rotation period: ${rotPeriod} s`, panelX + 12, panelY + 48);

    const locked = tidalLock >= 0.5;
    ctx.fillStyle = locked ? "rgba(80, 220, 120, 0.9)" : "rgba(255, 120, 80, 0.9)";
    ctx.fillText(`Tidal lock: ${locked ? "ON" : "OFF"}`, panelX + 12, panelY + 68);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    if (locked) {
      ctx.fillText("Red dot always faces Earth", panelX + 12, panelY + 88);
      ctx.fillText("(rotation period = orbital period)", panelX + 12, panelY + 102);
    } else {
      ctx.fillText("Red dot rotates independently", panelX + 12, panelY + 88);
      ctx.fillText("(rotation period ≠ orbital period)", panelX + 12, panelY + 102);
    }

    ctx.restore();
  }

  function drawLegend(): void {
    ctx.save();

    const lx = width - 200;
    const ly = height - 50;

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Red dot legend
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 80, 80, 0.9)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Reference point on Moon", lx + 10, ly);

    ctx.fillText("The Moon takes ~27.3 days per orbit & rotation", lx - 30, ly + 18);

    ctx.restore();
  }

  function render(): void {
    drawStarfield();
    drawOrbitPath();
    drawTrail();
    drawEarth();
    drawMoon();
    drawInfoPanel();
    drawLegend();
  }

  function reset(): void {
    time = 0;
    orbitalAngle = 0;
    moonRotationAngle = 0;
    trail = [];
  }

  function destroy(): void {
    trail = [];
  }

  function getStateDescription(): string {
    const locked = tidalLock >= 0.5;
    const orbPeriod = (ORBITAL_PERIOD_BASE / orbitalSpeed).toFixed(1);
    const rotPeriod = locked
      ? orbPeriod
      : (ORBITAL_PERIOD_BASE / moonRotationSpeed).toFixed(1);

    return (
      `Tidal locking simulation. The Moon orbits Earth with orbital period ${orbPeriod}s ` +
      `and rotation period ${rotPeriod}s. ` +
      `Tidal lock is ${locked ? "ON — the same side always faces Earth (rotation = orbital period)" : "OFF — the Moon rotates independently so different sides face Earth"}. ` +
      `The red marker shows which part of the Moon faces Earth. ` +
      `In reality, the Moon is tidally locked to Earth: its rotation period equals its orbital period (~27.3 days), ` +
      `so we always see the same hemisphere from Earth.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default OneSideOfTheMoonFactory;
