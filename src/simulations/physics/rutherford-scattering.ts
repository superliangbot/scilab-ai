import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface AlphaParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  active: boolean;
  deflected: boolean;
}

const RutherfordScatteringFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rutherford-scattering") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let particles: AlphaParticle[] = [];
  let spawnTimer = 0;

  // Physics constants (scaled for visual clarity)
  const Z_gold = 79; // atomic number of gold
  const Z_alpha = 2; // alpha particle charge
  const k_coulomb = 800; // scaled Coulomb constant

  let nucleusX = 0;
  let nucleusY = 0;
  let nucleusCharge = 79;
  let particleEnergy = 5;
  let spawnRate = 0.3;
  let beamWidth = 150;

  function createParticle(): AlphaParticle {
    const yOffset = (Math.random() - 0.5) * beamWidth;
    const speed = 150 + particleEnergy * 30;
    return {
      x: -20,
      y: nucleusY + yOffset,
      vx: speed,
      vy: 0,
      trail: [],
      active: true,
      deflected: false,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    nucleusX = width * 0.6;
    nucleusY = height / 2;
    time = 0;
    particles = [];
    spawnTimer = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    nucleusCharge = params.nucleusCharge ?? 79;
    particleEnergy = params.particleEnergy ?? 5;
    spawnRate = params.spawnRate ?? 0.3;
    beamWidth = params.beamWidth ?? 150;

    const step = Math.min(dt, 0.033);
    time += step;

    // Spawn new particles
    spawnTimer += step;
    if (spawnTimer >= spawnRate && particles.length < 60) {
      spawnTimer = 0;
      particles.push(createParticle());
    }

    // Update particles
    const kEff = k_coulomb * nucleusCharge / Z_gold;
    for (const p of particles) {
      if (!p.active) continue;

      // Coulomb force from nucleus
      const dx = p.x - nucleusX;
      const dy = p.y - nucleusY;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      const minR = 8;

      if (r > minR) {
        const force = (kEff * Z_alpha) / Math.max(r2, 400);
        const fx = force * dx / r;
        const fy = force * dy / r;
        p.vx += fx * step;
        p.vy += fy * step;
      }

      p.x += p.vx * step;
      p.y += p.vy * step;

      // Track trail
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 120) p.trail.shift();

      // Check if deflected significantly
      if (Math.abs(p.vy) > 20) p.deflected = true;

      // Remove if off screen
      if (p.x > width + 50 || p.x < -100 || p.y < -100 || p.y > height + 100) {
        p.active = false;
      }
    }

    // Clean up inactive
    particles = particles.filter((p) => p.active);
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a1e");
    bg.addColorStop(1, "#0d1025");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Gold foil representation (thin vertical line)
    ctx.save();
    ctx.strokeStyle = "rgba(255, 215, 0, 0.15)";
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.moveTo(nucleusX, 0);
    ctx.lineTo(nucleusX, height);
    ctx.stroke();
    ctx.restore();

    // Nucleus glow
    const glow = ctx.createRadialGradient(nucleusX, nucleusY, 0, nucleusX, nucleusY, 60);
    glow.addColorStop(0, "rgba(255, 215, 0, 0.4)");
    glow.addColorStop(0.5, "rgba(255, 150, 0, 0.1)");
    glow.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(nucleusX, nucleusY, 60, 0, Math.PI * 2);
    ctx.fill();

    // Nucleus
    const nGrad = ctx.createRadialGradient(nucleusX - 3, nucleusY - 3, 0, nucleusX, nucleusY, 10);
    nGrad.addColorStop(0, "#ffd700");
    nGrad.addColorStop(0.7, "#ff8c00");
    nGrad.addColorStop(1, "#cc6600");
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(nucleusX, nucleusY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 200, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Particle trails and particles
    for (const p of particles) {
      // Trail
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const alpha = (i / p.trail.length) * 0.6;
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.strokeStyle = p.deflected
            ? `rgba(255, 80, 80, ${alpha})`
            : `rgba(100, 200, 255, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Particle
      const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 4);
      pGrad.addColorStop(0, p.deflected ? "#ff6666" : "#88ddff");
      pGrad.addColorStop(1, p.deflected ? "#cc3333" : "#4488cc");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beam source indicator
    ctx.fillStyle = "rgba(100, 200, 255, 0.3)";
    ctx.fillRect(0, nucleusY - beamWidth / 2, 15, beamWidth);
    ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(8, nucleusY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("α beam", 0, 0);
    ctx.restore();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 250, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Rutherford Scattering", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Nucleus charge: Z = ${nucleusCharge}`, 20, 46);
    ctx.fillText(`Particle energy: ${particleEnergy.toFixed(1)} MeV`, 20, 62);
    ctx.fillText(`F = kZ₁Z₂/r² (Coulomb repulsion)`, 20, 78);
    const deflected = particles.filter((p) => p.deflected).length;
    ctx.fillText(`Deflected: ${deflected}/${particles.length}`, 20, 94);
  }

  function reset(): void {
    time = 0;
    particles = [];
    spawnTimer = 0;
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const deflected = particles.filter((p) => p.deflected).length;
    return (
      `Rutherford Scattering: Alpha particles fired at gold foil (Z=${nucleusCharge}). ` +
      `${particles.length} active particles, ${deflected} significantly deflected. ` +
      `Energy: ${particleEnergy.toFixed(1)} MeV. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    const oldNX = nucleusX;
    const oldNY = nucleusY;
    nucleusX = w * 0.6;
    nucleusY = h / 2;
    const dx = nucleusX - oldNX;
    const dy = nucleusY - oldNY;
    for (const p of particles) {
      p.x += dx;
      p.y += dy;
      for (const t of p.trail) {
        t.x += dx;
        t.y += dy;
      }
    }
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RutherfordScatteringFactory;
