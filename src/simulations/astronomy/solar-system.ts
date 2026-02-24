import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Planet {
  name: string;
  color: string;
  orbitRadiusAU: number; // in AU
  periodYears: number;   // orbital period in Earth years
  drawRadius: number;    // visual radius in pixels
  angle: number;         // current orbital angle in radians
}

const SolarSystemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("solar-system") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0; // time in simulation-years

  // Starfield
  let stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Current parameters
  let timeScale = 5;
  let zoom = 1;
  let showOrbits = 1;
  let showLabels = 1;

  // Planet data with real ratios
  const planets: Planet[] = [
    { name: "Mercury", color: "#a0a0a0", orbitRadiusAU: 0.39, periodYears: 0.24,   drawRadius: 3,  angle: 0 },
    { name: "Venus",   color: "#e8cda0", orbitRadiusAU: 0.72, periodYears: 0.615,  drawRadius: 5,  angle: 0 },
    { name: "Earth",   color: "#4488ff", orbitRadiusAU: 1.0,  periodYears: 1.0,    drawRadius: 5,  angle: 0 },
    { name: "Mars",    color: "#ff4422", orbitRadiusAU: 1.52, periodYears: 1.88,   drawRadius: 4,  angle: 0 },
    { name: "Jupiter", color: "#ffaa44", orbitRadiusAU: 5.2,  periodYears: 11.86,  drawRadius: 12, angle: 0 },
    { name: "Saturn",  color: "#ddbb66", orbitRadiusAU: 9.54, periodYears: 29.46,  drawRadius: 10, angle: 0 },
    { name: "Uranus",  color: "#88ccdd", orbitRadiusAU: 19.2, periodYears: 84.01,  drawRadius: 7,  angle: 0 },
    { name: "Neptune", color: "#4466ff", orbitRadiusAU: 30.06,periodYears: 164.8,  drawRadius: 7,  angle: 0 },
  ];

  // Initial random angles so planets don't all start aligned
  const initialAngles = planets.map(() => Math.random() * Math.PI * 2);

  function generateStars(): void {
    stars = [];
    const count = Math.floor((width * height) / 800);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        brightness: 0.3 + Math.random() * 0.7,
        size: 0.5 + Math.random() * 1.5,
      });
    }
  }

  /** Convert AU to screen pixels, centered on canvas. Neptune must fit. */
  function auToPixels(au: number): number {
    const maxAU = 32; // slightly more than Neptune
    const maxRadius = Math.min(width, height) * 0.44;
    return (au / maxAU) * maxRadius * zoom;
  }

  function getPlanetScreenPos(planet: Planet): { x: number; y: number } {
    const cx = width / 2;
    const cy = height / 2;
    const r = auToPixels(planet.orbitRadiusAU);
    return {
      x: cx + r * Math.cos(planet.angle),
      y: cy + r * Math.sin(planet.angle),
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    // Reset planet angles
    for (let i = 0; i < planets.length; i++) {
      planets[i].angle = initialAngles[i];
    }
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 5;
    zoom = params.zoom ?? 1;
    showOrbits = params.showOrbits ?? 1;
    showLabels = params.showLabels ?? 1;

    // dt is in seconds; convert to simulation years
    // 1 second of real time = timeScale years of simulation time
    const dtYears = dt * timeScale;
    time += dtYears;

    // Update planet angles using Kepler's 3rd law: angular velocity = 2*PI / periodYears
    for (const planet of planets) {
      const angularVelocity = (2 * Math.PI) / planet.periodYears;
      planet.angle += angularVelocity * dtYears;
    }
  }

  function renderStars(): void {
    for (const star of stars) {
      // Gentle twinkling
      const twinkle = 0.7 + 0.3 * Math.sin(time * 40 + star.x * 0.1 + star.y * 0.13);
      const alpha = star.brightness * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  function renderSun(): void {
    const cx = width / 2;
    const cy = height / 2;
    const sunRadius = 16 * Math.sqrt(zoom);

    // Outer corona glow (multiple layers)
    for (let i = 4; i >= 0; i--) {
      const r = sunRadius + i * 12 * zoom;
      const gradient = ctx.createRadialGradient(cx, cy, sunRadius * 0.3, cx, cy, r);
      gradient.addColorStop(0, `rgba(255, 255, 200, ${0.06 - i * 0.01})`);
      gradient.addColorStop(0.5, `rgba(255, 200, 50, ${0.04 - i * 0.007})`);
      gradient.addColorStop(1, "rgba(255, 150, 0, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Sun body gradient
    const sunGrad = ctx.createRadialGradient(
      cx - sunRadius * 0.2, cy - sunRadius * 0.2, 0,
      cx, cy, sunRadius
    );
    sunGrad.addColorStop(0, "#ffffee");
    sunGrad.addColorStop(0.3, "#ffee44");
    sunGrad.addColorStop(0.7, "#ffcc00");
    sunGrad.addColorStop(1, "#ff9900");
    ctx.beginPath();
    ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Sun label
    if (showLabels >= 0.5) {
      ctx.fillStyle = "rgba(255, 255, 200, 0.8)";
      ctx.font = `bold ${Math.max(11, 13 * zoom)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Sun", cx, cy + sunRadius + 6);
    }
  }

  function renderOrbits(): void {
    if (showOrbits < 0.5) return;

    const cx = width / 2;
    const cy = height / 2;

    ctx.lineWidth = 0.6;
    for (const planet of planets) {
      const r = auToPixels(planet.orbitRadiusAU);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, 0.12)`;
      ctx.stroke();
    }
  }

  function renderPlanets(): void {
    for (const planet of planets) {
      const pos = getPlanetScreenPos(planet);
      const r = planet.drawRadius * Math.max(0.6, Math.sqrt(zoom));

      // Planet glow
      const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 3.5);
      glow.addColorStop(0, planet.color + "55");
      glow.addColorStop(1, planet.color + "00");
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Planet body
      const grad = ctx.createRadialGradient(
        pos.x - r * 0.3, pos.y - r * 0.3, 0,
        pos.x, pos.y, r
      );
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.35, planet.color);
      grad.addColorStop(1, shadeColor(planet.color, -40));
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Saturn's ring
      if (planet.name === "Saturn") {
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, r * 2.2, r * 0.6, Math.PI * 0.1, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(221, 187, 102, 0.5)";
        ctx.lineWidth = Math.max(1.5, r * 0.25);
        ctx.stroke();
      }

      // Label
      if (showLabels >= 0.5) {
        ctx.fillStyle = `rgba(255, 255, 255, 0.75)`;
        ctx.font = `${Math.max(9, 11 * Math.sqrt(zoom))}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(planet.name, pos.x, pos.y - r - 4);
      }
    }
  }

  /** Darken/lighten a hex color by percent. Negative = darken. */
  function shadeColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(2.55 * percent)));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(2.55 * percent)));
    const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(2.55 * percent)));
    return `rgb(${r},${g},${b})`;
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, "#0a0a20");
    bgGrad.addColorStop(1, "#000008");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    renderStars();
    renderOrbits();
    renderSun();
    renderPlanets();

    // HUD: elapsed time
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Elapsed: ${time.toFixed(2)} Earth years`, 10, height - 10);
  }

  function reset(): void {
    time = 0;
    for (let i = 0; i < planets.length; i++) {
      planets[i].angle = initialAngles[i];
    }
  }

  function destroy(): void {
    stars = [];
  }

  function getStateDescription(): string {
    const descriptions = planets.map((p) => {
      const angleDeg = ((p.angle % (2 * Math.PI)) * 180 / Math.PI).toFixed(1);
      const pos = getPlanetScreenPos(p);
      return `${p.name}: angle=${angleDeg} deg, orbit=${p.orbitRadiusAU}AU, period=${p.periodYears}yr`;
    });
    return (
      `Solar System Simulation | Time: ${time.toFixed(2)} Earth years | ` +
      `TimeScale: ${timeScale}x, Zoom: ${zoom}x | ` +
      `Planet positions: ${descriptions.join("; ")}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    generateStars();
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

export default SolarSystemFactory;
