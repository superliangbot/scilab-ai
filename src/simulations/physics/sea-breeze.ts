import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Sea Breeze — demonstrates daytime sea breeze and nighttime land breeze
 * caused by differential heating of land and water.
 */

interface AirParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
}

const SeaBreezeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sea-breeze") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let sunIntensity = 7;
  let timeOfDay = 0; // 0 = day, 1 = night
  let windStrength = 5;
  let particleCount = 80;

  let particles: AirParticle[] = [];
  let landTemp = 30;
  let seaTemp = 20;

  function createParticles(): void {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: 50 + Math.random() * (height * 0.5),
        vx: 0,
        vy: 0,
        alpha: 0.3 + Math.random() * 0.4,
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
    sunIntensity = params.sunIntensity ?? 7;
    timeOfDay = params.timeOfDay ?? 0;
    windStrength = params.windStrength ?? 5;
    const newCount = Math.round(params.particleCount ?? 80);
    if (newCount !== particleCount) {
      particleCount = newCount;
      createParticles();
    }

    const step = Math.min(dt, 0.033);
    time += step;

    // Temperature model
    const isDay = timeOfDay < 0.5;
    if (isDay) {
      landTemp = 25 + sunIntensity * 3; // land heats fast
      seaTemp = 18 + sunIntensity * 0.5; // water heats slow
    } else {
      landTemp = 15 - sunIntensity * 0.3; // land cools fast
      seaTemp = 18 + sunIntensity * 0.3; // water retains heat
    }

    const midX = width / 2;
    const groundY = height * 0.7;
    const tempDiff = landTemp - seaTemp;

    // Wind circulation
    for (const p of particles) {
      const isOverLand = p.x > midX;
      const heightFrac = 1 - p.y / groundY;

      // Circulation: warm air rises, cool air sinks
      // Day: land is warmer → air rises over land, sinks over sea, surface wind sea→land
      // Night: sea is warmer → air rises over sea, sinks over land, surface wind land→sea
      const circStrength = (windStrength / 5) * Math.abs(tempDiff) * 0.15;

      if (p.y > groundY * 0.3) {
        // Lower atmosphere: horizontal flow
        if (isDay) {
          // Sea breeze: surface wind from sea to land
          p.vx += circStrength * step * 30;
        } else {
          // Land breeze: surface wind from land to sea
          p.vx -= circStrength * step * 30;
        }
      } else {
        // Upper atmosphere: return flow (opposite direction)
        if (isDay) {
          p.vx -= circStrength * step * 20;
        } else {
          p.vx += circStrength * step * 20;
        }
      }

      // Vertical: warm side → rise, cool side → sink
      if (isOverLand) {
        if (isDay) {
          p.vy -= circStrength * step * 15; // rise over warm land
        } else {
          p.vy += circStrength * step * 10; // sink over cool land
        }
      } else {
        if (isDay) {
          p.vy += circStrength * step * 10; // sink over cool sea
        } else {
          p.vy -= circStrength * step * 15; // rise over warm sea
        }
      }

      // Damping
      p.vx *= 0.98;
      p.vy *= 0.98;

      p.x += p.vx * step;
      p.y += p.vy * step;

      // Wrap horizontally
      if (p.x < 0) p.x += width;
      if (p.x > width) p.x -= width;

      // Clamp vertically
      if (p.y < 20) { p.y = 20; p.vy = Math.abs(p.vy) * 0.5; }
      if (p.y > groundY - 5) { p.y = groundY - 5; p.vy = -Math.abs(p.vy) * 0.5; }
    }
  }

  function render(): void {
    const groundY = height * 0.7;
    const midX = width / 2;
    const isDay = timeOfDay < 0.5;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    if (isDay) {
      sky.addColorStop(0, "#1a6dd4");
      sky.addColorStop(1, "#87ceeb");
    } else {
      sky.addColorStop(0, "#0a0a2a");
      sky.addColorStop(1, "#1a1a40");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, groundY);

    // Sun or Moon
    if (isDay) {
      const sunY = 40 + (1 - sunIntensity / 10) * 30;
      const sunGrad = ctx.createRadialGradient(width * 0.5, sunY, 0, width * 0.5, sunY, 40);
      sunGrad.addColorStop(0, "#ffffcc");
      sunGrad.addColorStop(0.5, "#ffdd44");
      sunGrad.addColorStop(1, "rgba(255, 200, 0, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(width * 0.5, sunY, 40, 0, Math.PI * 2);
      ctx.fill();

      // Sun rays (heat arrows down)
      ctx.strokeStyle = "rgba(255, 200, 0, 0.2)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.5 + 30 * Math.cos(angle), sunY + 30 * Math.sin(angle));
        ctx.lineTo(width * 0.5 + 55 * Math.cos(angle), sunY + 55 * Math.sin(angle));
        ctx.stroke();
      }
    } else {
      // Stars
      const seed = 99;
      let rng = seed;
      function prng(): number { rng = (rng * 16807) % 2147483647; return rng / 2147483647; }
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + prng() * 0.5})`;
        ctx.beginPath();
        ctx.arc(prng() * width, prng() * groundY * 0.8, 0.5 + prng(), 0, Math.PI * 2);
        ctx.fill();
      }
      // Moon
      ctx.fillStyle = "#eeeedd";
      ctx.beginPath();
      ctx.arc(width * 0.7, 50, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sea (left half)
    const seaGrad = ctx.createLinearGradient(0, groundY, 0, height);
    seaGrad.addColorStop(0, "#1a5599");
    seaGrad.addColorStop(1, "#0a2a55");
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, groundY, midX, height - groundY);

    // Waves
    ctx.strokeStyle = "rgba(100, 180, 255, 0.3)";
    ctx.lineWidth = 1;
    for (let w = 0; w < 3; w++) {
      ctx.beginPath();
      for (let x = 0; x < midX; x += 2) {
        const y = groundY + 5 + w * 12 + Math.sin(x * 0.03 + time * 2 + w) * 3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Land (right half)
    const landGrad = ctx.createLinearGradient(0, groundY, 0, height);
    landGrad.addColorStop(0, isDay ? "#8B7355" : "#4a3a25");
    landGrad.addColorStop(0.3, isDay ? "#6B8E23" : "#2a4a1a");
    landGrad.addColorStop(1, "#3a2a1a");
    ctx.fillStyle = landGrad;
    ctx.fillRect(midX, groundY, width - midX, height - groundY);

    // Coastline
    ctx.strokeStyle = "rgba(200, 190, 150, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midX, groundY);
    ctx.lineTo(midX, height);
    ctx.stroke();

    // Temperature indicators
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(midX - 80, groundY + 10, 70, 25, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(midX + 10, groundY + 10, 70, 25, 5);
    ctx.fill();

    ctx.fillStyle = "#66bbff";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${seaTemp.toFixed(0)}°C`, midX - 45, groundY + 27);
    ctx.fillStyle = "#ff8844";
    ctx.fillText(`${landTemp.toFixed(0)}°C`, midX + 45, groundY + 27);

    // Air particles (as arrows/wind indicators)
    for (const p of particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const angle = Math.atan2(p.vy, p.vx);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);

      const len = Math.min(speed * 0.3, 12);
      ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * Math.min(speed / 20, 1)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(len, 0);
      ctx.lineTo(len - 3, -2);
      ctx.moveTo(len, 0);
      ctx.lineTo(len - 3, 2);
      ctx.stroke();

      ctx.restore();
    }

    // Wind direction arrow (large)
    const arrowY = groundY - 30;
    const arrowDir = isDay ? 1 : -1; // positive = rightward (sea→land for day)
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 100, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(midX - 40 * arrowDir, arrowY);
    ctx.lineTo(midX + 40 * arrowDir, arrowY);
    ctx.lineTo(midX + 30 * arrowDir, arrowY - 8);
    ctx.moveTo(midX + 40 * arrowDir, arrowY);
    ctx.lineTo(midX + 30 * arrowDir, arrowY + 8);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 100, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isDay ? "Sea Breeze" : "Land Breeze", midX, arrowY - 14);
    ctx.restore();

    // Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SEA", midX / 2, groundY + 50);
    ctx.fillText("LAND", midX + (width - midX) / 2, groundY + 50);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 260, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(isDay ? "Sea Breeze (Daytime)" : "Land Breeze (Nighttime)", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    if (isDay) {
      ctx.fillText("Land heats faster → warm air rises", 20, 46);
      ctx.fillText("Cool sea air flows in to replace it", 20, 62);
    } else {
      ctx.fillText("Land cools faster → cool air sinks", 20, 46);
      ctx.fillText("Warm sea air rises, land air flows out", 20, 62);
    }
    ctx.fillText(`ΔT = ${Math.abs(landTemp - seaTemp).toFixed(1)}°C`, 20, 78);
    ctx.fillText("Specific heat: water > land", 20, 94);
  }

  function reset(): void {
    time = 0;
    createParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const isDay = timeOfDay < 0.5;
    return (
      `Sea Breeze: ${isDay ? "Daytime sea breeze" : "Nighttime land breeze"}. ` +
      `Land temp: ${landTemp.toFixed(0)}°C, Sea temp: ${seaTemp.toFixed(0)}°C. ` +
      `ΔT = ${Math.abs(landTemp - seaTemp).toFixed(1)}°C. ` +
      `${particles.length} air particles. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SeaBreezeFactory;
