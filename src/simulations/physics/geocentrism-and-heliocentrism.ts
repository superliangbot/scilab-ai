import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface CelestialBody {
  name: string;
  color: string;
  radius: number;
  orbitRadius: number;
  period: number; // in Earth years
  angle: number;
}

const GeoHelioFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("geocentrism-and-heliocentrism") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let model = 0; // 0 = heliocentric, 1 = geocentric
  let timeScale = 1;
  let showLabels = 1;
  let showOrbits = 1;

  // Heliocentric data (orbit radius in px, period in years)
  const planets: CelestialBody[] = [
    { name: "Mercury", color: "#a8a29e", radius: 3, orbitRadius: 40, period: 0.241, angle: 0 },
    { name: "Venus", color: "#fde68a", radius: 5, orbitRadius: 65, period: 0.615, angle: Math.PI / 4 },
    { name: "Earth", color: "#3b82f6", radius: 5, orbitRadius: 95, period: 1.0, angle: Math.PI / 2 },
    { name: "Mars", color: "#ef4444", radius: 4, orbitRadius: 130, period: 1.881, angle: Math.PI },
    { name: "Jupiter", color: "#f59e0b", radius: 10, orbitRadius: 180, period: 11.86, angle: Math.PI * 1.5 },
    { name: "Saturn", color: "#d4a574", radius: 8, orbitRadius: 230, period: 29.46, angle: Math.PI * 0.3 },
  ];

  // Moon
  const moonOrbitRadius = 15;
  const moonPeriod = 0.0748; // ~27.3 days
  let moonAngle = 0;

  let elapsedYears = 0;

  function initState() {
    time = 0;
    elapsedYears = 0;
    planets[0].angle = 0;
    planets[1].angle = Math.PI / 4;
    planets[2].angle = Math.PI / 2;
    planets[3].angle = Math.PI;
    planets[4].angle = Math.PI * 1.5;
    planets[5].angle = Math.PI * 0.3;
    moonAngle = 0;
  }

  function drawBackground() {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    const rng = (s: number) => {
      let x = Math.sin(s) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 200; i++) {
      const sx = rng(i * 7.1) * width;
      const sy = rng(i * 13.3) * height;
      const sr = rng(i * 3.7) * 1 + 0.3;
      ctx.globalAlpha = 0.3 + rng(i * 11.1) * 0.4;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHeliocentricModel() {
    const cx = width / 2;
    const cy = height / 2;

    // Sun at center
    drawSun(cx, cy);

    // Planet orbits and positions
    for (const planet of planets) {
      if (showOrbits > 0.5) {
        ctx.strokeStyle = planet.color + "30";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, planet.orbitRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const px = cx + Math.cos(planet.angle) * planet.orbitRadius;
      const py = cy + Math.sin(planet.angle) * planet.orbitRadius;

      drawPlanet(px, py, planet);

      // Moon for Earth
      if (planet.name === "Earth") {
        const mx = px + Math.cos(moonAngle) * moonOrbitRadius;
        const my = py + Math.sin(moonAngle) * moonOrbitRadius;
        ctx.fillStyle = "#d1d5db";
        ctx.beginPath();
        ctx.arc(mx, my, 2, 0, Math.PI * 2);
        ctx.fill();
        if (showLabels > 0.5) {
          ctx.fillStyle = "#9ca3af";
          ctx.font = "9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Moon", mx, my - 5);
        }
      }
    }

    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HELIOCENTRIC MODEL", cx, 45);
    ctx.fillStyle = "#7c3aed";
    ctx.font = "12px sans-serif";
    ctx.fillText("(Copernicus, 1543)", cx, 62);
  }

  function drawGeocentricModel() {
    const cx = width / 2;
    const cy = height / 2;

    // Earth at center
    const earth = planets[2];
    drawPlanet(cx, cy, { ...earth, radius: 8 });

    // Moon orbit
    if (showOrbits > 0.5) {
      ctx.strokeStyle = "#d1d5db30";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const mx = cx + Math.cos(moonAngle) * 25;
    const my = cy + Math.sin(moonAngle) * 25;
    ctx.fillStyle = "#d1d5db";
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fill();

    // In geocentric view, compute positions relative to Earth
    const earthAngle = planets[2].angle;

    for (const planet of planets) {
      if (planet.name === "Earth") continue;

      // Position relative to Earth
      const relAngle = planet.angle - earthAngle;

      // For geocentric model, use epicycles to explain retrograde motion
      let geoRadius: number;
      let geoAngle: number;

      if (planet.name === "Mercury" || planet.name === "Venus") {
        // Inner planets: epicycle around deferent that follows Sun
        const sunRelAngle = -earthAngle;
        const epicycleRadius = planet.orbitRadius * 0.8;
        const deferentRadius = planets[2].orbitRadius * 0.9;

        const sx = Math.cos(sunRelAngle) * deferentRadius;
        const sy = Math.sin(sunRelAngle) * deferentRadius;

        const px = sx + Math.cos(planet.angle * 3) * epicycleRadius * 0.3;
        const py = sy + Math.sin(planet.angle * 3) * epicycleRadius * 0.3;

        geoRadius = Math.sqrt(px * px + py * py);
        geoAngle = Math.atan2(py, px);
      } else {
        // Outer planets: simple orbit at scale
        geoRadius = planet.orbitRadius;
        geoAngle = relAngle;
      }

      if (showOrbits > 0.5) {
        ctx.strokeStyle = planet.color + "20";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, geoRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const ppx = cx + Math.cos(geoAngle) * geoRadius;
      const ppy = cy + Math.sin(geoAngle) * geoRadius;

      if (planet.name === "Sun" as string) {
        drawSun(ppx, ppy);
      } else {
        drawPlanet(ppx, ppy, planet);
      }
    }

    // Draw Sun orbiting Earth in geocentric model
    const sunGeoRadius = planets[2].orbitRadius;
    const sunGeoAngle = -earthAngle;
    if (showOrbits > 0.5) {
      ctx.strokeStyle = "#fbbf2430";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, sunGeoRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const sx = cx + Math.cos(sunGeoAngle) * sunGeoRadius;
    const sy = cy + Math.sin(sunGeoAngle) * sunGeoRadius;
    drawSun(sx, sy);

    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GEOCENTRIC MODEL", cx, 45);
    ctx.fillStyle = "#7c3aed";
    ctx.font = "12px sans-serif";
    ctx.fillText("(Ptolemy, ~150 AD)", cx, 62);
  }

  function drawSun(x: number, y: number) {
    const r = 14;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    glow.addColorStop(0, "rgba(250, 204, 21, 0.4)");
    glow.addColorStop(1, "rgba(250, 204, 21, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, r);
    grad.addColorStop(0, "#fef08a");
    grad.addColorStop(0.6, "#fbbf24");
    grad.addColorStop(1, "#b45309");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    if (showLabels > 0.5) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Sun", x, y + r + 12);
    }
  }

  function drawPlanet(x: number, y: number, planet: CelestialBody) {
    const grad = ctx.createRadialGradient(x - planet.radius * 0.3, y - planet.radius * 0.3, 0, x, y, planet.radius);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, planet.color);
    grad.addColorStop(1, planet.color + "88");
    ctx.beginPath();
    ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    if (showLabels > 0.5) {
      ctx.fillStyle = planet.color;
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(planet.name, x, y - planet.radius - 4);
    }
  }

  function drawLegend() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Geocentrism vs Heliocentrism", width / 2, 24);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Year ${elapsedYears.toFixed(1)}  |  Speed: ${timeScale.toFixed(1)}×`, width / 2, height - 15);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      model = params.model ?? 0;
      timeScale = params.timeScale ?? 1;
      showLabels = params.showLabels ?? 1;
      showOrbits = params.showOrbits ?? 1;

      time += dt;
      elapsedYears += dt * timeScale * 0.5;

      // Update planet angles
      for (const planet of planets) {
        const angularVelocity = (2 * Math.PI) / planet.period;
        planet.angle += angularVelocity * dt * timeScale * 0.5;
      }

      // Moon
      moonAngle += (2 * Math.PI / moonPeriod) * dt * timeScale * 0.5;
    },

    render() {
      drawBackground();
      if (model < 0.5) {
        drawHeliocentricModel();
      } else {
        drawGeocentricModel();
      }
      drawLegend();
    },

    reset() {
      initState();
    },

    destroy() {},

    getStateDescription(): string {
      const modelName = model < 0.5 ? "Heliocentric (Sun-centered)" : "Geocentric (Earth-centered)";
      return `Geocentrism & Heliocentrism: Showing ${modelName} model. Year ${elapsedYears.toFixed(1)}. The heliocentric model places the Sun at center with planets in elliptical orbits. The geocentric model places Earth at center, requiring epicycles to explain retrograde motion. Copernicus proposed heliocentrism in 1543.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default GeoHelioFactory;
