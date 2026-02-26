import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface WindParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "cold" | "warm";
  alpha: number;
}

const WeatherFrontsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("weather-fronts") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let frontType = 0; // 0=cold front, 1=warm front
  let windSpeed = 1;
  let showTemp = 1;

  let particles: WindParticle[] = [];

  function createParticles(): void {
    particles = [];
    const n = 120;
    for (let i = 0; i < n; i++) {
      const isCold = i < n / 2;
      particles.push({
        x: isCold ? Math.random() * width * 0.4 : width * 0.5 + Math.random() * width * 0.5,
        y: height * 0.3 + Math.random() * height * 0.5,
        vx: isCold ? 20 + Math.random() * 30 : -10 + Math.random() * 15,
        vy: (Math.random() - 0.5) * 10,
        type: isCold ? "cold" : "warm",
        alpha: 0.5 + Math.random() * 0.5,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    createParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    frontType = Math.round(params.frontType ?? 0);
    windSpeed = params.windSpeed ?? 1;
    showTemp = Math.round(params.showTemperature ?? 1);

    const frontX = width * 0.45 + Math.sin(time * 0.3) * 20;

    for (const p of particles) {
      if (frontType === 0) {
        // Cold front: cold air advances, pushes warm air up steeply
        if (p.type === "cold") {
          p.vx = 20 * windSpeed + Math.sin(time + p.y * 0.02) * 5;
          p.vy = (Math.random() - 0.5) * 5;
          if (p.x > frontX) {
            p.vy -= 15; // cold air undercuts
          }
        } else {
          p.vx = -5 + Math.sin(time * 0.5) * 3;
          if (p.x < frontX + 30) {
            p.vy = -20 * windSpeed; // warm air forced up steeply
          } else {
            p.vy *= 0.95;
          }
        }
      } else {
        // Warm front: warm air slides over cold, gentle slope
        if (p.type === "warm") {
          p.vx = 15 * windSpeed + Math.sin(time + p.y * 0.02) * 3;
          if (p.x > frontX - 50) {
            p.vy = -8 * windSpeed; // warm air rises gently
          }
        } else {
          p.vx = -3;
          p.vy = (Math.random() - 0.5) * 3;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wrap around
      if (p.x > width + 20) { p.x = -10; p.y = height * 0.3 + Math.random() * height * 0.5; }
      if (p.x < -20) { p.x = width + 10; p.y = height * 0.3 + Math.random() * height * 0.5; }
      if (p.y < height * 0.05) { p.y = height * 0.05; p.vy = Math.abs(p.vy) * 0.5; }
      if (p.y > height * 0.85) { p.y = height * 0.85; p.vy = -Math.abs(p.vy) * 0.5; }
    }

    time += dt;
  }

  function drawClouds(cx: number, cy: number, w: number, h: number, color: string): void {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(time * 2 + cx * 0.01) * 0.1;
    const grad = ctx.createRadialGradient(cx, cy, w * 0.1, cx, cy, w);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function render(): void {
    // Sky gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#4a90d9");
    bg.addColorStop(0.6, "#87CEEB");
    bg.addColorStop(1, "#7a6b4e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Ground
    ctx.fillStyle = "#5d4e37";
    ctx.fillRect(0, height * 0.85, width, height * 0.15);

    const frontX = width * 0.45;
    const frontName = frontType === 0 ? "Cold Front" : "Warm Front";

    // Temperature zones
    if (showTemp) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      // Cold zone
      ctx.fillStyle = "#3498db";
      ctx.fillRect(0, height * 0.2, frontX, height * 0.65);
      // Warm zone
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(frontX, height * 0.2, width - frontX, height * 0.65);
      ctx.restore();

      ctx.fillStyle = "rgba(52,152,219,0.8)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("COLD AIR", frontX / 2, height * 0.9);
      ctx.fillStyle = "rgba(231,76,60,0.8)";
      ctx.fillText("WARM AIR", frontX + (width - frontX) / 2, height * 0.9);
    }

    // Front line
    ctx.beginPath();
    ctx.moveTo(frontX, height * 0.15);
    ctx.lineTo(frontX, height * 0.85);
    ctx.strokeStyle = frontType === 0 ? "#3498db" : "#e74c3c";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Front symbols
    const symbolCount = 8;
    for (let i = 0; i < symbolCount; i++) {
      const sy = height * 0.2 + (i / symbolCount) * height * 0.6;
      if (frontType === 0) {
        // Cold front: blue triangles pointing right
        ctx.beginPath();
        ctx.moveTo(frontX, sy - 6);
        ctx.lineTo(frontX + 12, sy);
        ctx.lineTo(frontX, sy + 6);
        ctx.closePath();
        ctx.fillStyle = "#3498db";
        ctx.fill();
      } else {
        // Warm front: red semicircles pointing right
        ctx.beginPath();
        ctx.arc(frontX, sy, 6, -Math.PI / 2, Math.PI / 2);
        ctx.fillStyle = "#e74c3c";
        ctx.fill();
      }
    }

    // Cloud formations
    if (frontType === 0) {
      // Cold front: tall cumulonimbus clouds
      drawClouds(frontX + 20, height * 0.15, 60, 40, "rgba(200,200,210,0.8)");
      drawClouds(frontX + 40, height * 0.2, 50, 30, "rgba(180,180,200,0.7)");
      drawClouds(frontX + 10, height * 0.25, 70, 35, "rgba(160,160,180,0.6)");

      // Rain drops
      ctx.fillStyle = "rgba(100,150,255,0.6)";
      for (let i = 0; i < 20; i++) {
        const rx = frontX + 5 + Math.random() * 50;
        const ry = height * 0.3 + ((time * 100 + i * 30) % (height * 0.55));
        ctx.beginPath();
        ctx.ellipse(rx, ry, 1, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Warm front: gentle stratus clouds, wide and thin
      drawClouds(frontX - 60, height * 0.18, 120, 20, "rgba(220,220,230,0.6)");
      drawClouds(frontX - 20, height * 0.22, 100, 18, "rgba(200,200,220,0.5)");
      drawClouds(frontX + 40, height * 0.26, 80, 15, "rgba(190,190,210,0.4)");

      // Light drizzle
      ctx.fillStyle = "rgba(100,150,255,0.3)";
      for (let i = 0; i < 10; i++) {
        const rx = frontX - 60 + Math.random() * 100;
        const ry = height * 0.3 + ((time * 60 + i * 40) % (height * 0.55));
        ctx.beginPath();
        ctx.ellipse(rx, ry, 0.8, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Wind particles
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.type === "cold"
        ? `rgba(100,180,255,${p.alpha * 0.5})`
        : `rgba(255,150,100,${p.alpha * 0.5})`;
      ctx.fill();

      // Wind trail
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      ctx.strokeStyle = p.type === "cold"
        ? `rgba(100,180,255,${p.alpha * 0.3})`
        : `rgba(255,150,100,${p.alpha * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Weather Fronts: ${frontName}`, width / 2, 25);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height * 0.05, 240, 55, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    if (frontType === 0) {
      ctx.fillText("Cold front: Cold air undercuts warm air", 22, height * 0.05 + 18);
      ctx.fillText("Steep uplift → tall clouds, heavy rain", 22, height * 0.05 + 34);
    } else {
      ctx.fillText("Warm front: Warm air slides over cold", 22, height * 0.05 + 18);
      ctx.fillText("Gentle slope → stratus clouds, drizzle", 22, height * 0.05 + 34);
    }
  }

  function reset(): void {
    time = 0;
    createParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    return (
      `Weather Fronts: ${frontType === 0 ? "Cold" : "Warm"} front, wind speed ${windSpeed}×. ` +
      `Cold fronts bring steep uplift and heavy rain; warm fronts bring gentle ascent and drizzle. ` +
      `${particles.length} wind particles. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default WeatherFrontsFactory;
