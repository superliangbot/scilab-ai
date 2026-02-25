import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Planet {
  name: string;
  orbitRadius: number; // AU (helio), scaled for display
  period: number; // years
  color: string;
  size: number;
  angle: number;
}

const GeocentricHeliocentricFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("geocentrism-and-heliocentrism") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let timeScale = 1;
  let viewMode = 0; // 0=heliocentric, 1=geocentric
  let showOrbits = 1;
  let showTrails = 1;

  // Simplified solar system (inner planets)
  const planets: Planet[] = [
    { name: "Mercury", orbitRadius: 0.39, period: 0.24, color: "#9e9e9e", size: 4, angle: 0 },
    { name: "Venus", orbitRadius: 0.72, period: 0.62, color: "#ffcc80", size: 6, angle: Math.PI * 0.7 },
    { name: "Earth", orbitRadius: 1.0, period: 1.0, color: "#42a5f5", size: 7, angle: Math.PI * 1.2 },
    { name: "Mars", orbitRadius: 1.52, period: 1.88, color: "#ef5350", size: 5, angle: Math.PI * 0.3 },
    { name: "Jupiter", orbitRadius: 2.5, period: 5.2, color: "#d4a574", size: 10, angle: Math.PI * 1.8 },
  ];

  // Trail history for geocentric view
  const geoTrails: Map<string, Array<{ x: number; y: number }>> = new Map();
  const MAX_TRAIL = 600;

  function reset(): void {
    time = 0;
    planets[0].angle = 0;
    planets[1].angle = Math.PI * 0.7;
    planets[2].angle = Math.PI * 1.2;
    planets[3].angle = Math.PI * 0.3;
    planets[4].angle = Math.PI * 1.8;
    geoTrails.clear();
    for (const p of planets) {
      geoTrails.set(p.name, []);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function getHelioPos(planet: Planet): { x: number; y: number } {
    const scale = Math.min(W, H) * 0.15;
    return {
      x: planet.orbitRadius * scale * Math.cos(planet.angle),
      y: planet.orbitRadius * scale * Math.sin(planet.angle),
    };
  }

  function update(dt: number, params: Record<string, number>): void {
    const newTS = params.timeScale ?? 1;
    const newVM = params.viewMode ?? 0;
    const newSO = params.showOrbits ?? 1;
    const newST = params.showTrails ?? 1;

    timeScale = newTS;
    if (newVM !== viewMode) {
      viewMode = newVM;
      for (const [, trail] of geoTrails) trail.length = 0;
    }
    showOrbits = newSO;
    showTrails = newST;

    time += dt * timeScale;

    // Update planet angles
    for (const p of planets) {
      const angularVel = (2 * Math.PI) / (p.period * 365.25 * 86400);
      p.angle += angularVel * dt * timeScale * 86400 * 365.25;
    }

    // Record geocentric trails
    if (showTrails >= 0.5 && viewMode >= 0.5) {
      const earthPos = getHelioPos(planets[2]); // Earth
      for (const p of planets) {
        if (p.name === "Earth") continue;
        const pos = getHelioPos(p);
        const geoX = pos.x - earthPos.x;
        const geoY = pos.y - earthPos.y;
        const trail = geoTrails.get(p.name)!;
        trail.push({ x: geoX, y: geoY });
        if (trail.length > MAX_TRAIL) trail.shift();
      }
    }
  }

  function drawBackground(): void {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, W, H);

    const rng = (s: number) => {
      let v = s;
      return () => { v = (v * 16807) % 2147483647; return v / 2147483647; };
    };
    const rand = rng(77);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHeliocentricView(): void {
    const cx = W * 0.35;
    const cy = H * 0.5;
    const scale = Math.min(W, H) * 0.15;

    // Title
    ctx.fillStyle = "#ffa726";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Heliocentric (Copernicus)", cx, 25);

    // Sun
    const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
    sunGrad.addColorStop(0, "#fff59d");
    sunGrad.addColorStop(0.5, "#ffb300");
    sunGrad.addColorStop(1, "#ff8f00");
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Glow
    const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 40);
    glowGrad.addColorStop(0, "rgba(255, 183, 0, 0.3)");
    glowGrad.addColorStop(1, "rgba(255, 183, 0, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.fillText("Sun", cx, cy + 25);

    // Orbits and planets
    for (const p of planets) {
      const r = p.orbitRadius * scale;

      if (showOrbits >= 0.5) {
        ctx.strokeStyle = `${p.color}30`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      const px = cx + r * Math.cos(p.angle);
      const py = cy + r * Math.sin(p.angle);

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.name, px, py - p.size - 4);
    }
  }

  function drawGeocentricView(): void {
    const cx = W * 0.75;
    const cy = H * 0.5;
    const scale = Math.min(W, H) * 0.15;

    // Title
    ctx.fillStyle = "#42a5f5";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Geocentric (Ptolemy)", cx, 25);

    // Earth at center
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#42a5f5";
    ctx.fill();
    ctx.fillStyle = "#42a5f5";
    ctx.font = "10px sans-serif";
    ctx.fillText("Earth", cx, cy + 18);

    const earthPos = getHelioPos(planets[2]);

    for (const p of planets) {
      if (p.name === "Earth") continue;

      const helioPos = getHelioPos(p);
      const geoX = helioPos.x - earthPos.x;
      const geoY = helioPos.y - earthPos.y;

      const px = cx + geoX;
      const py = cy + geoY;

      // Draw trail (retrograde motion path)
      if (showTrails >= 0.5) {
        const trail = geoTrails.get(p.name);
        if (trail && trail.length > 1) {
          ctx.strokeStyle = `${p.color}40`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i < trail.length; i++) {
            const tx = cx + trail[i].x;
            const ty = cy + trail[i].y;
            if (i === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
          }
          ctx.stroke();
        }
      }

      // Planet
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.name, px, py - p.size - 4);
    }

    // Sun in geocentric view
    const sunHelioX = 0;
    const sunHelioY = 0;
    const sunGeoX = sunHelioX - earthPos.x;
    const sunGeoY = sunHelioY - earthPos.y;
    const sx = cx + sunGeoX;
    const sy = cy + sunGeoY;

    const sunGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
    sunGrad.addColorStop(0, "#fff59d");
    sunGrad.addColorStop(1, "#ff8f00");
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();
    ctx.fillStyle = "#ffa726";
    ctx.font = "9px sans-serif";
    ctx.fillText("Sun", sx, sy - 14);
  }

  function drawDivider(): void {
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(W * 0.55, 40);
    ctx.lineTo(W * 0.55, H - 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawInfo(): void {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(W * 0.05, H - 80, W * 0.9, 65, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Geocentrism vs Heliocentrism",
      W * 0.5, H - 62
    );

    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#ccc";
    ctx.fillText(
      "Left: Sun-centered model (Copernicus, 1543) — simple circular orbits. " +
      "Right: Earth-centered model (Ptolemy) — planets show retrograde motion loops.",
      W * 0.5, H - 44
    );
    ctx.fillStyle = "#ffa726";
    ctx.font = "10px sans-serif";
    ctx.fillText(
      `Year: ${(time / (365.25 * 86400)).toFixed(2)}  |  Speed: ${timeScale}×`,
      W * 0.5, H - 26
    );
  }

  function render(): void {
    drawBackground();
    drawHeliocentricView();
    drawDivider();
    drawGeocentricView();
    drawInfo();
  }

  function destroy(): void {
    geoTrails.clear();
  }

  function getStateDescription(): string {
    const year = time / (365.25 * 86400);
    const earthAngle = ((planets[2].angle * 180) / Math.PI) % 360;
    const marsAngle = ((planets[3].angle * 180) / Math.PI) % 360;
    return (
      `Geocentrism vs Heliocentrism comparison. Year: ${year.toFixed(2)}, speed: ${timeScale}×. ` +
      `Left: Heliocentric (Copernican) model — Sun at center, planets in circular orbits. ` +
      `Right: Geocentric (Ptolemaic) model — Earth at center, other bodies orbit Earth. ` +
      `Earth angle: ${earthAngle.toFixed(0)}°, Mars angle: ${marsAngle.toFixed(0)}°. ` +
      `In the geocentric view, superior planets (Mars, Jupiter) show retrograde motion loops — ` +
      `this led Ptolemy to propose epicycles. Copernicus showed these are simply apparent motions ` +
      `caused by Earth overtaking outer planets.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GeocentricHeliocentricFactory;
