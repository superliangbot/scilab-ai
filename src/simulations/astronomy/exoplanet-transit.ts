import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const exoplanet_transitFactory: SimulationFactory = () => {
  const config = getSimConfig("exoplanet-transit")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  // State
  let planetRadius = 0.1;
  let orbitalPeriod = 3;
  let inclination = 89;
  let stellarRadius = 1;

  // Light curve history
  const lightCurve: number[] = [];
  const maxCurvePoints = 400;

  function getOrbitalPosition(t: number): { x: number; y: number; z: number } {
    const angularVel = (2 * Math.PI) / (orbitalPeriod * 4); // speed up for visualization
    const angle = angularVel * t;
    const incRad = (inclination * Math.PI) / 180;
    // Semi-major axis in visual units
    const a = 2.5;
    return {
      x: a * Math.cos(angle),
      y: a * Math.sin(angle) * Math.sin(incRad),
      z: a * Math.sin(angle) * Math.cos(incRad),
    };
  }

  function computeBrightness(pos: { x: number; y: number; z: number }): number {
    // Only dims when planet is in front of star (z > 0 means behind)
    if (pos.z < 0) {
      // Planet is in front
      const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      const rStar = stellarRadius;
      const rPlanet = planetRadius;
      if (dist >= rStar + rPlanet) return 1.0; // no overlap
      if (dist + rPlanet <= rStar) {
        // fully inside star disk
        return 1.0 - (rPlanet / rStar) ** 2;
      }
      // partial overlap
      const r1 = rStar, r2 = rPlanet, d = dist;
      const part1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
      const part2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
      const part3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
      const overlapArea = part1 + part2 - part3;
      return 1.0 - overlapArea / (Math.PI * r1 * r1);
    }
    return 1.0;
  }

  function drawStar(cx: number, cy: number, radius: number, brightness: number) {
    // Limb darkening effect
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const b = brightness;
    grad.addColorStop(0, `rgba(255, ${Math.floor(240 * b)}, ${Math.floor(180 * b)}, 1)`);
    grad.addColorStop(0.7, `rgba(255, ${Math.floor(200 * b)}, ${Math.floor(120 * b)}, 1)`);
    grad.addColorStop(1, `rgba(200, ${Math.floor(140 * b)}, ${Math.floor(60 * b)}, 0.8)`);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.6);
    glow.addColorStop(0, `rgba(255, 200, 100, ${0.3 * b})`);
    glow.addColorStop(1, "rgba(255, 200, 100, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }

  function drawPlanet(cx: number, cy: number, radius: number) {
    const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
    grad.addColorStop(0, "#6b8cce");
    grad.addColorStop(0.7, "#3a5a8c");
    grad.addColorStop(1, "#1a2a4c");
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function drawLightCurve() {
    const graphX = W * 0.05;
    const graphY = H * 0.65;
    const graphW = W * 0.9;
    const graphH = H * 0.3;

    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // Labels
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Light Curve (Relative Brightness vs Time)", graphX + graphW / 2, graphY - 8);

    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.fillText("1.00", graphX - 5, graphY + 12);
    const minB = 1 - (planetRadius / stellarRadius) ** 2;
    ctx.fillText(minB.toFixed(3), graphX - 5, graphY + graphH - 5);

    // Grid lines
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const gy = graphY + (graphH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(graphX, gy);
      ctx.lineTo(graphX + graphW, gy);
      ctx.stroke();
    }

    // Plot
    if (lightCurve.length > 1) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const minVal = Math.min(...lightCurve) - 0.001;
      const maxVal = 1.001;
      for (let i = 0; i < lightCurve.length; i++) {
        const px = graphX + (i / maxCurvePoints) * graphW;
        const py = graphY + graphH - ((lightCurve[i] - minVal) / (maxVal - minVal)) * graphH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Transit depth annotation
    const depth = (planetRadius / stellarRadius) ** 2 * 100;
    ctx.font = "12px Arial";
    ctx.fillStyle = "#facc15";
    ctx.textAlign = "left";
    ctx.fillText(`Transit depth: ${depth.toFixed(2)}% (Rp/Rs = ${(planetRadius / stellarRadius).toFixed(3)})`, graphX + 10, graphY + graphH - 10);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c;
      ctx = c.getContext("2d")!;
      W = c.width;
      H = c.height;
      time = 0;
      lightCurve.length = 0;
    },
    update(dt, params) {
      planetRadius = params.planetRadius ?? planetRadius;
      orbitalPeriod = params.orbitalPeriod ?? orbitalPeriod;
      inclination = params.inclination ?? inclination;
      stellarRadius = params.stellarRadius ?? stellarRadius;
      time += dt;

      const pos = getOrbitalPosition(time);
      const brightness = computeBrightness(pos);
      lightCurve.push(brightness);
      if (lightCurve.length > maxCurvePoints) lightCurve.shift();
    },
    render() {
      // Background
      ctx.fillStyle = "#0a0a1f";
      ctx.fillRect(0, 0, W, H);

      // Stars background
      const rng = (seed: number) => ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
      for (let i = 0; i < 80; i++) {
        const sx = rng(i * 1.1) * W;
        const sy = rng(i * 2.3) * H * 0.6;
        const sr = rng(i * 3.7) * 1.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + rng(i * 4.1) * 0.5})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      const pos = getOrbitalPosition(time);
      const brightness = computeBrightness(pos);

      // Star
      const starCx = W / 2;
      const starCy = H * 0.28;
      const starVisualR = Math.min(W, H) * 0.12 * stellarRadius;

      drawStar(starCx, starCy, starVisualR, brightness);

      // Planet (only draw if in front or at sides)
      const planetVisualR = starVisualR * (planetRadius / stellarRadius);
      const planetScreenX = starCx + pos.x * starVisualR * 0.9;
      const planetScreenY = starCy + pos.y * starVisualR * 0.9;

      if (pos.z < 0.3) {
        drawPlanet(planetScreenX, planetScreenY, planetVisualR);
      }

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Exoplanet Transit Detection", W / 2, 28);

      // Info
      ctx.font = "13px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText(`Orbital Period: ${orbitalPeriod.toFixed(1)} days`, 15, H * 0.55);
      ctx.fillText(`Inclination: ${inclination.toFixed(1)}°`, 15, H * 0.55 + 18);
      ctx.fillText(`Brightness: ${(brightness * 100).toFixed(2)}%`, W - 180, H * 0.55);

      // Light curve
      drawLightCurve();

      // Formula
      ctx.font = "11px monospace";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("ΔF/F = (Rp/Rs)²", W / 2, H - 5);
    },
    reset() {
      time = 0;
      lightCurve.length = 0;
    },
    destroy() {},
    getStateDescription() {
      const pos = getOrbitalPosition(time);
      const brightness = computeBrightness(pos);
      const transiting = brightness < 0.999;
      const depth = (1 - brightness) * 100;
      return `Exoplanet transit: planet radius ${planetRadius.toFixed(2)} R☉, orbital period ${orbitalPeriod.toFixed(1)} days, inclination ${inclination.toFixed(1)}°. ${transiting ? `Currently transiting — brightness dip: ${depth.toFixed(2)}%` : "Planet not currently transiting."}`;
    },
    resize(w, h) {
      W = w;
      H = h;
    },
  };
  return engine;
};

export default exoplanet_transitFactory;
