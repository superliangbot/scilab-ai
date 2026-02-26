import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface AlphaParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
  active: boolean;
  closestApproach: number;
}

const RutherfordScatteringSizeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rutherford-scattering-and-size-of-nucleus") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let particles: AlphaParticle[] = [];
  let spawnTimer = 0;

  let nucleusX = 0;
  let nucleusY = 0;
  let kineticEnergy = 5; // MeV
  let nucleusCharge = 79;
  let showDistanceOfClosestApproach = 1;
  let beamSpread = 120;

  // The key concept: distance of closest approach d = kZ₁Z₂e² / (½mv²)
  // At closest approach, all KE converts to PE
  // d ∝ 1/E for head-on collision
  const k_scaled = 600;

  function distanceOfClosestApproach(): number {
    // d = k * Z_nucleus * Z_alpha / KE (scaled)
    return (k_scaled * nucleusCharge * 2) / (kineticEnergy * 50);
  }

  function createParticle(): AlphaParticle {
    const yOff = (Math.random() - 0.5) * beamSpread;
    const speed = 120 + kineticEnergy * 25;
    return {
      x: -10,
      y: nucleusY + yOff,
      vx: speed,
      vy: 0,
      trail: [],
      active: true,
      closestApproach: Infinity,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    nucleusX = width * 0.55;
    nucleusY = height / 2;
    time = 0;
    particles = [];
    spawnTimer = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    kineticEnergy = params.kineticEnergy ?? 5;
    nucleusCharge = params.nucleusCharge ?? 79;
    showDistanceOfClosestApproach = params.showDistanceOfClosestApproach ?? 1;
    beamSpread = params.beamSpread ?? 120;

    const step = Math.min(dt, 0.033);
    time += step;

    spawnTimer += step;
    if (spawnTimer >= 0.35 && particles.length < 50) {
      spawnTimer = 0;
      particles.push(createParticle());
    }

    const kEff = k_scaled * nucleusCharge / 79;
    for (const p of particles) {
      if (!p.active) continue;

      const dx = p.x - nucleusX;
      const dy = p.y - nucleusY;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);

      // Track closest approach
      if (r < p.closestApproach) p.closestApproach = r;

      if (r > 5) {
        const force = (kEff * 2) / Math.max(r2, 300);
        p.vx += (force * dx / r) * step;
        p.vy += (force * dy / r) * step;
      }

      p.x += p.vx * step;
      p.y += p.vy * step;

      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 100) p.trail.shift();

      if (p.x > width + 50 || p.x < -80 || p.y < -80 || p.y > height + 80) {
        p.active = false;
      }
    }

    particles = particles.filter((p) => p.active);
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#080820");
    bg.addColorStop(1, "#0c0c28");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Distance of closest approach circle
    const dca = distanceOfClosestApproach();
    if (showDistanceOfClosestApproach >= 0.5) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(255, 200, 50, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(nucleusX, nucleusY, dca, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = "rgba(255, 200, 50, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`d = ${dca.toFixed(1)} (closest approach)`, nucleusX, nucleusY - dca - 8);
      ctx.restore();
    }

    // Nucleus glow
    const glow = ctx.createRadialGradient(nucleusX, nucleusY, 0, nucleusX, nucleusY, 50);
    glow.addColorStop(0, "rgba(255, 180, 0, 0.35)");
    glow.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(nucleusX, nucleusY, 50, 0, Math.PI * 2);
    ctx.fill();

    // Nucleus
    const nucR = Math.max(6, 8 * Math.cbrt(nucleusCharge / 79));
    const nGrad = ctx.createRadialGradient(nucleusX - 2, nucleusY - 2, 0, nucleusX, nucleusY, nucR);
    nGrad.addColorStop(0, "#ffe066");
    nGrad.addColorStop(0.6, "#ff9900");
    nGrad.addColorStop(1, "#aa5500");
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(nucleusX, nucleusY, nucR, 0, Math.PI * 2);
    ctx.fill();

    // Particles
    for (const p of particles) {
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const alpha = (i / p.trail.length) * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.strokeStyle = `rgba(100, 180, 255, ${alpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 3.5);
      pg.addColorStop(0, "#aaddff");
      pg.addColorStop(1, "#4488cc");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 280, 105, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Rutherford Scattering — Nucleus Size", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`KE = ${kineticEnergy.toFixed(1)} MeV, Z = ${nucleusCharge}`, 20, 46);
    ctx.fillText(`d = kZ₁Z₂e²/KE (closest approach)`, 20, 62);
    ctx.fillText(`d ≈ ${dca.toFixed(1)} scaled units`, 20, 78);
    ctx.fillText(`Higher energy → closer to nucleus → smaller d`, 20, 94);
    ctx.fillText(`This gives an UPPER BOUND on nuclear radius`, 20, 110);
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
    const dca = distanceOfClosestApproach();
    return (
      `Rutherford Scattering & Nucleus Size: KE=${kineticEnergy.toFixed(1)} MeV, Z=${nucleusCharge}. ` +
      `Distance of closest approach: ${dca.toFixed(1)} units. ` +
      `${particles.length} active alpha particles. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    nucleusX = w * 0.55;
    nucleusY = h / 2;
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RutherfordScatteringSizeFactory;
