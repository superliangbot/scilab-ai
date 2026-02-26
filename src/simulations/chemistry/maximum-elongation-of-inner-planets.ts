import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const MaximumElongationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("maximum-elongation-of-inner-planets") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let planetType = 0; // 0 = Mercury, 1 = Venus
  let timeScale = 1;
  let showElongationLine = 1;
  let showOrbits = 1;

  // Orbital data (AU and orbital period in Earth years)
  const PLANETS = [
    { name: "Mercury", radius: 0.387, period: 0.2408, color: "#b0b0b0", size: 6 },
    { name: "Venus", radius: 0.723, period: 0.6152, color: "#e8c56d", size: 10 },
  ];

  const EARTH = { radius: 1.0, period: 1.0, color: "#4a9eff", size: 10 };
  const SUN = { color: "#ffdd44", size: 18 };

  // Maximum elongation angles
  const MAX_ELONGATION = [
    { planet: "Mercury", angle: 18, min: 18, max: 28 },
    { planet: "Venus", angle: 46, min: 45, max: 47 },
  ];

  let currentElongation = 0;
  let maxElongationReached = 0;

  function auToPixels(au: number): number {
    const scale = Math.min(W, H) * 0.35;
    return au * scale;
  }

  function planetAngle(period: number): number {
    return ((2 * Math.PI * time) / period);
  }

  function planetPos(orbitalRadius: number, period: number): { x: number; y: number } {
    const angle = planetAngle(period);
    return {
      x: W / 2 + auToPixels(orbitalRadius) * Math.cos(angle),
      y: H / 2 + auToPixels(orbitalRadius) * Math.sin(angle),
    };
  }

  function calcElongation(): number {
    const planet = PLANETS[planetType];
    const earthPos = planetPos(EARTH.radius, EARTH.period);
    const pPos = planetPos(planet.radius, planet.period);
    const sunPos = { x: W / 2, y: H / 2 };

    // Elongation = angle at Earth between Sun and Planet
    const dx1 = sunPos.x - earthPos.x;
    const dy1 = sunPos.y - earthPos.y;
    const dx2 = pPos.x - earthPos.x;
    const dy2 = pPos.y - earthPos.y;

    const dot = dx1 * dx2 + dy1 * dy2;
    const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (mag1 === 0 || mag2 === 0) return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return (Math.acos(cosAngle) * 180) / Math.PI;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      maxElongationReached = 0;
    },

    update(dt: number, params: Record<string, number>) {
      planetType = Math.round(params.planetType ?? 0);
      timeScale = params.timeScale ?? 1;
      showElongationLine = params.showElongationLine ?? 1;
      showOrbits = params.showOrbits ?? 1;

      if (planetType < 0) planetType = 0;
      if (planetType > 1) planetType = 1;

      time += dt * timeScale * 0.5;
      currentElongation = calcElongation();
      if (currentElongation > maxElongationReached) {
        maxElongationReached = currentElongation;
      }
    },

    render() {
      if (!ctx) return;
      const planet = PLANETS[planetType];

      // Background - space
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
      bg.addColorStop(0, "#0a0a2e");
      bg.addColorStop(1, "#000010");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 137.5) % W);
        const sy = ((i * 97.3 + 50) % H);
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Maximum Elongation of Inner Planets", W / 2, 28);

      const sunX = W / 2;
      const sunY = H / 2;

      // Draw orbits
      if (showOrbits) {
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Planet orbit
        ctx.beginPath();
        ctx.arc(sunX, sunY, auToPixels(planet.radius), 0, Math.PI * 2);
        ctx.stroke();

        // Earth orbit
        ctx.beginPath();
        ctx.arc(sunX, sunY, auToPixels(EARTH.radius), 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
      }

      // Planet positions
      const earthPos = planetPos(EARTH.radius, EARTH.period);
      const pPos = planetPos(planet.radius, planet.period);

      // Draw elongation lines
      if (showElongationLine) {
        // Earth to Sun line
        ctx.beginPath();
        ctx.moveTo(earthPos.x, earthPos.y);
        ctx.lineTo(sunX, sunY);
        ctx.strokeStyle = "rgba(74, 158, 255, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Earth to Planet line
        ctx.beginPath();
        ctx.moveTo(earthPos.x, earthPos.y);
        ctx.lineTo(pPos.x, pPos.y);
        ctx.strokeStyle = `rgba(232, 197, 109, 0.4)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Elongation arc at Earth
        const angleToSun = Math.atan2(sunY - earthPos.y, sunX - earthPos.x);
        const angleToPlanet = Math.atan2(pPos.y - earthPos.y, pPos.x - earthPos.x);
        ctx.beginPath();
        ctx.arc(earthPos.x, earthPos.y, 30, Math.min(angleToSun, angleToPlanet), Math.max(angleToSun, angleToPlanet));
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label elongation angle
        const midAngle = (angleToSun + angleToPlanet) / 2;
        const labelX = earthPos.x + 45 * Math.cos(midAngle);
        const labelY = earthPos.y + 45 * Math.sin(midAngle);
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.fillStyle = "#ff6b6b";
        ctx.textAlign = "center";
        ctx.fillText(`${currentElongation.toFixed(1)}°`, labelX, labelY);
      }

      // Draw Sun
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, SUN.size * 3);
      sunGlow.addColorStop(0, "rgba(255, 221, 68, 0.6)");
      sunGlow.addColorStop(1, "rgba(255, 221, 68, 0)");
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, SUN.size * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sunX, sunY, SUN.size, 0, Math.PI * 2);
      ctx.fillStyle = SUN.color;
      ctx.fill();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#ffdd44";
      ctx.textAlign = "center";
      ctx.fillText("Sun", sunX, sunY + SUN.size + 14);

      // Draw Earth
      ctx.beginPath();
      ctx.arc(earthPos.x, earthPos.y, EARTH.size, 0, Math.PI * 2);
      ctx.fillStyle = EARTH.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#4a9eff";
      ctx.fillText("Earth", earthPos.x, earthPos.y + EARTH.size + 14);

      // Draw inner planet
      ctx.beginPath();
      ctx.arc(pPos.x, pPos.y, planet.size, 0, Math.PI * 2);
      ctx.fillStyle = planet.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = planet.color;
      ctx.fillText(planet.name, pPos.x, pPos.y + planet.size + 14);

      // Info panel
      const panelY = H - 70;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      const maxE = MAX_ELONGATION[planetType];
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Planet: ${planet.name}`, 16, panelY);
      ctx.fillStyle = "#ff6b6b";
      ctx.fillText(`Current Elongation: ${currentElongation.toFixed(1)}°`, 16, panelY + 20);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Max Observed: ${maxElongationReached.toFixed(1)}°`, 16, panelY + 40);

      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Theoretical Max: ~${maxE.min}°–${maxE.max}°`, W - 16, panelY);
      ctx.fillText(`Orbital Period: ${planet.period.toFixed(3)} yr`, W - 16, panelY + 20);
      ctx.fillText(`Orbital Radius: ${planet.radius} AU`, W - 16, panelY + 40);

      // Explanation
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(
        "Maximum elongation = greatest angular separation of an inner planet from the Sun as seen from Earth",
        W / 2, H - 10
      );
    },

    reset() {
      time = 0;
      maxElongationReached = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const planet = PLANETS[planetType];
      return (
        `Maximum Elongation simulation: Viewing ${planet.name} from Earth. ` +
        `Current elongation: ${currentElongation.toFixed(1)}°. ` +
        `Maximum observed this session: ${maxElongationReached.toFixed(1)}°. ` +
        `Theoretical max for ${planet.name}: ~${MAX_ELONGATION[planetType].min}°–${MAX_ELONGATION[planetType].max}°. ` +
        `${planet.name} orbits at ${planet.radius} AU with period ${planet.period} years.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MaximumElongationFactory;
