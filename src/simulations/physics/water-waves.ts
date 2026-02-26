import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface WaterParticle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  depth: number; // 0 = surface, 1 = bottom
}

const WaterWavesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("water-waves") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let wavelength = 80;
  let amplitude = 25;
  let waterDepth = 0.7;
  let speed = 1;

  let particles: WaterParticle[] = [];

  function createParticles(): void {
    particles = [];
    const cols = 25;
    const rows = 8;
    const startX = width * 0.05;
    const endX = width * 0.95;
    const surfaceY = height * 0.35;
    const bottomY = height * 0.35 + height * waterDepth * 0.5;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const depth = r / (rows - 1);
        particles.push({
          baseX: startX + (c / (cols - 1)) * (endX - startX),
          baseY: surfaceY + depth * (bottomY - surfaceY),
          x: 0,
          y: 0,
          depth,
        });
      }
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
    wavelength = params.wavelength ?? 80;
    amplitude = params.amplitude ?? 25;
    waterDepth = params.waterDepth ?? 0.7;
    speed = params.speed ?? 1;

    const k = (2 * Math.PI) / wavelength;
    const omega = speed * k * 30;

    // Circular/elliptical orbits for water particles
    for (const p of particles) {
      const depthFactor = Math.exp(-k * p.depth * waterDepth * 100);
      const phase = k * p.baseX - omega * time;

      // In deep water: circular orbits
      // In shallow water: elliptical (horizontal elongated)
      const hAmp = amplitude * depthFactor;
      const vAmp = amplitude * depthFactor * Math.min(1, waterDepth);

      p.x = p.baseX + hAmp * Math.cos(phase);
      p.y = p.baseY - vAmp * Math.sin(phase);
    }

    time += dt;
  }

  function render(): void {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.35);
    sky.addColorStop(0, "#87CEEB");
    sky.addColorStop(1, "#B0E0E6");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.35);

    // Water background
    const water = ctx.createLinearGradient(0, height * 0.35, 0, height);
    water.addColorStop(0, "#1a6b99");
    water.addColorStop(0.5, "#0f4c75");
    water.addColorStop(1, "#0a2647");
    ctx.fillStyle = water;
    ctx.fillRect(0, height * 0.35, width, height * 0.65);

    // Animated surface wave
    const surfaceY = height * 0.35;
    const k = (2 * Math.PI) / wavelength;
    const omega = speed * k * 30;

    ctx.beginPath();
    ctx.moveTo(0, surfaceY);
    for (let x = 0; x <= width; x += 2) {
      const phase = k * x - omega * time;
      const y = surfaceY - amplitude * Math.sin(phase);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();

    const waveFill = ctx.createLinearGradient(0, surfaceY - amplitude, 0, height);
    waveFill.addColorStop(0, "rgba(30,120,180,0.8)");
    waveFill.addColorStop(0.3, "rgba(20,80,140,0.9)");
    waveFill.addColorStop(1, "rgba(10,38,71,0.95)");
    ctx.fillStyle = waveFill;
    ctx.fill();

    // Surface highlights
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const phase = k * x - omega * time;
      const y = surfaceY - amplitude * Math.sin(phase);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw particles with orbit trails
    for (const p of particles) {
      const depthFactor = Math.exp(-k * p.depth * waterDepth * 100);
      const hAmp = amplitude * depthFactor;
      const vAmp = amplitude * depthFactor * Math.min(1, waterDepth);

      // Draw orbit ellipse
      if (hAmp > 2) {
        ctx.beginPath();
        ctx.ellipse(p.baseX, p.baseY, hAmp, vAmp, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - p.depth)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Draw particle
      const alpha = 0.3 + 0.7 * (1 - p.depth);
      const size = 3 - p.depth * 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, size), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,230,255,${alpha})`;
      ctx.fill();
    }

    // Duck on surface
    const duckX = width * 0.5;
    const duckPhase = k * duckX - omega * time;
    const duckY = surfaceY - amplitude * Math.sin(duckPhase) - 12;

    // Duck body
    ctx.beginPath();
    ctx.ellipse(duckX, duckY, 14, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#f1c40f";
    ctx.fill();

    // Duck head
    ctx.beginPath();
    ctx.arc(duckX + 10, duckY - 8, 7, 0, Math.PI * 2);
    ctx.fill();

    // Duck beak
    ctx.beginPath();
    ctx.moveTo(duckX + 16, duckY - 8);
    ctx.lineTo(duckX + 22, duckY - 7);
    ctx.lineTo(duckX + 16, duckY - 5);
    ctx.closePath();
    ctx.fillStyle = "#e67e22";
    ctx.fill();

    // Duck eye
    ctx.beginPath();
    ctx.arc(duckX + 12, duckY - 10, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();

    // Title
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Water Waves", width / 2, 22);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height - 70, width - 20, 60, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`λ = ${wavelength}px | A = ${amplitude}px | Depth factor = ${waterDepth.toFixed(1)}`, 22, height - 50);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Particles move in circular orbits (deep) or elliptical orbits (shallow).", 22, height - 32);
    ctx.fillText("The wave transmits energy, but water particles return to their positions.", 22, height - 16);
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
      `Water Waves: λ=${wavelength}px, amplitude=${amplitude}px, depth=${waterDepth}. ` +
      `${particles.length} water particles showing orbital motion. ` +
      `Deep water → circular orbits, shallow → elliptical. Speed: ${speed}×. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default WaterWavesFactory;
