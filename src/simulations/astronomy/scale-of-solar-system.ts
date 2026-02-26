import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Scale of Solar System — demonstrates the vast distances in the solar system.
 * Shows planets at correct relative distances and sizes with zoom control.
 */

interface PlanetData {
  name: string;
  distAU: number; // distance from Sun in AU
  radiusKm: number;
  color: string;
  ringColor?: string;
}

const ScaleOfSolarSystemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("scale-of-solar-system") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let zoomLevel = 1;
  let showLabels = 1;
  let scaleMode = 0; // 0 = distance scale, 1 = size scale
  let scrollPos = 0;

  const planets: PlanetData[] = [
    { name: "Mercury", distAU: 0.387, radiusKm: 2440, color: "#b0a090" },
    { name: "Venus", distAU: 0.723, radiusKm: 6052, color: "#e8c070" },
    { name: "Earth", distAU: 1.0, radiusKm: 6371, color: "#4488cc" },
    { name: "Mars", distAU: 1.524, radiusKm: 3390, color: "#cc6644" },
    { name: "Jupiter", distAU: 5.203, radiusKm: 69911, color: "#cc9966", ringColor: "rgba(180,160,120,0.3)" },
    { name: "Saturn", distAU: 9.537, radiusKm: 58232, color: "#ddcc88", ringColor: "rgba(200,180,130,0.5)" },
    { name: "Uranus", distAU: 19.19, radiusKm: 25362, color: "#88ccdd" },
    { name: "Neptune", distAU: 30.07, radiusKm: 24622, color: "#4466cc" },
  ];

  const sunRadiusKm = 696340;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    scrollPos = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    zoomLevel = params.zoomLevel ?? 1;
    showLabels = params.showLabels ?? 1;
    scaleMode = params.scaleMode ?? 0;
    scrollPos = params.scrollPos ?? 0;

    const step = Math.min(dt, 0.033);
    time += step;
  }

  function render(): void {
    // Background: deep space
    ctx.fillStyle = "#020208";
    ctx.fillRect(0, 0, width, height);

    // Stars
    const seed = 42;
    let rng = seed;
    function prng(): number {
      rng = (rng * 16807) % 2147483647;
      return rng / 2147483647;
    }
    for (let i = 0; i < 150; i++) {
      const sx = prng() * width;
      const sy = prng() * height;
      const bright = 0.2 + prng() * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${bright})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + prng(), 0, Math.PI * 2);
      ctx.fill();
    }

    const cy = height / 2;
    const sunX = 50 - scrollPos * 100;

    if (scaleMode < 0.5) {
      // Distance scale mode
      const pixelsPerAU = (width - 100) * zoomLevel / 10;

      // Sun
      const sunR = Math.max(8, (sunRadiusKm / 150e6) * pixelsPerAU * 50);
      const sunGrad = ctx.createRadialGradient(sunX, cy, 0, sunX, cy, sunR);
      sunGrad.addColorStop(0, "#ffffcc");
      sunGrad.addColorStop(0.3, "#ffdd44");
      sunGrad.addColorStop(0.7, "#ff8800");
      sunGrad.addColorStop(1, "rgba(255, 100, 0, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, cy, sunR, 0, Math.PI * 2);
      ctx.fill();

      // Planets
      for (const p of planets) {
        const px = sunX + p.distAU * pixelsPerAU;
        if (px < -50 || px > width + 50) continue;

        // Planet size (exaggerated for visibility)
        const pr = Math.max(3, Math.sqrt(p.radiusKm / 2000) * 3);

        // Rings if applicable
        if (p.ringColor) {
          ctx.strokeStyle = p.ringColor;
          ctx.lineWidth = pr * 0.4;
          ctx.beginPath();
          ctx.ellipse(px, cy, pr * 2.2, pr * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        const grad = ctx.createRadialGradient(px - pr * 0.3, cy - pr * 0.3, 0, px, cy, pr);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, "#222222");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, cy, pr, 0, Math.PI * 2);
        ctx.fill();

        if (showLabels >= 0.5) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(p.name, px, cy + pr + 15);
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.fillText(`${p.distAU} AU`, px, cy + pr + 27);
        }
      }

      // AU scale bar
      const scaleBarAU = 1;
      const scaleBarPx = scaleBarAU * pixelsPerAU;
      const sbY = height - 30;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2 - scaleBarPx / 2, sbY);
      ctx.lineTo(width / 2 + scaleBarPx / 2, sbY);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${scaleBarAU} AU = 150 million km`, width / 2, sbY - 8);
    } else {
      // Size scale mode: show planets at correct relative sizes
      const maxR = Math.min(width, height) * 0.25;
      const sizeScale = maxR / sunRadiusKm * zoomLevel;

      // Sun (might be huge)
      const sunR = sunRadiusKm * sizeScale;
      if (sunR > 1) {
        const sunGrad = ctx.createRadialGradient(width / 2, cy, 0, width / 2, cy, Math.min(sunR, width));
        sunGrad.addColorStop(0, "#ffffcc");
        sunGrad.addColorStop(0.5, "#ffaa33");
        sunGrad.addColorStop(1, "rgba(255, 80, 0, 0)");
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(width / 2, cy, Math.min(sunR, width), 0, Math.PI * 2);
        ctx.fill();
      }

      // Planets in a row below
      let px = 60;
      const py = height - 80;
      for (const p of planets) {
        const pr = Math.max(2, p.radiusKm * sizeScale);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();

        if (showLabels >= 0.5) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.font = "8px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(p.name, px, py + pr + 12);
        }

        px += Math.max(pr * 2.5, 40);
      }
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 260, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Scale of the Solar System", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("1 AU = 150 million km (Earth-Sun distance)", 20, 46);
    ctx.fillText("Neptune is 30 AU from the Sun", 20, 62);
    ctx.fillText("Light takes 8 min to reach Earth", 20, 78);
    ctx.fillText(scaleMode < 0.5 ? "Mode: Distance scale" : "Mode: Size comparison", 20, 94);
  }

  function reset(): void {
    time = 0;
    scrollPos = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Scale of Solar System: Zoom=${zoomLevel.toFixed(1)}×. ` +
      `Mode: ${scaleMode < 0.5 ? "distance" : "size"}. ` +
      `Shows 8 planets from Mercury (0.387 AU) to Neptune (30.07 AU). ` +
      `1 AU = 150 million km. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ScaleOfSolarSystemFactory;
