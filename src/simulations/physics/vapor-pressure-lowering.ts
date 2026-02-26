import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "water" | "solute" | "vapor";
}

const VaporPressureLoweringFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("vapor-pressure-lowering") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let soluteConc = 0.2;
  let temperature = 80;
  let showLabels = 1;

  // Two beakers: pure water (left) and solution (right)
  let pureParticles: Particle[] = [];
  let solnParticles: Particle[] = [];

  let pureVaporCount = 0;
  let solnVaporCount = 0;

  function beakerBounds(side: "left" | "right"): { x: number; y: number; w: number; h: number; waterY: number } {
    const bw = width * 0.3;
    const bh = height * 0.4;
    const bx = side === "left" ? width * 0.1 : width * 0.55;
    const by = height * 0.35;
    const waterY = by + bh * 0.3;
    return { x: bx, y: by, w: bw, h: bh, waterY };
  }

  function createParticles(): void {
    pureParticles = [];
    solnParticles = [];
    pureVaporCount = 0;
    solnVaporCount = 0;

    const pureB = beakerBounds("left");
    const solnB = beakerBounds("right");

    // Pure water particles
    for (let i = 0; i < 40; i++) {
      pureParticles.push({
        x: pureB.x + 10 + Math.random() * (pureB.w - 20),
        y: pureB.waterY + Math.random() * (pureB.h - (pureB.waterY - pureB.y) - 10),
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        type: "water",
      });
    }

    // Solution particles
    const numSolute = Math.round(soluteConc * 30);
    const numWater = 40 - numSolute;
    for (let i = 0; i < numWater; i++) {
      solnParticles.push({
        x: solnB.x + 10 + Math.random() * (solnB.w - 20),
        y: solnB.waterY + Math.random() * (solnB.h - (solnB.waterY - solnB.y) - 10),
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        type: "water",
      });
    }
    for (let i = 0; i < numSolute; i++) {
      solnParticles.push({
        x: solnB.x + 10 + Math.random() * (solnB.w - 20),
        y: solnB.waterY + Math.random() * (solnB.h - (solnB.waterY - solnB.y) - 10),
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        type: "solute",
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

  function updateParticles(particles: Particle[], bounds: ReturnType<typeof beakerBounds>, dt: number, issolution: boolean): number {
    let vaporCount = 0;
    const evapRate = (temperature / 100) * 0.02;
    const soluteBlock = issolution ? soluteConc * 0.7 : 0;

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.type === "vapor") {
        p.vy -= 15 * dt; // float up
        p.x += Math.sin(time * 3 + p.y * 0.1) * dt * 10;
        if (p.y < bounds.y - 50) {
          // Reset as water
          p.type = "water";
          p.x = bounds.x + 10 + Math.random() * (bounds.w - 20);
          p.y = bounds.waterY + Math.random() * 20;
          p.vy = Math.random() * 20;
        }
        vaporCount++;
      } else if (p.type === "water") {
        // Chance to evaporate
        if (p.y < bounds.waterY + 5 && Math.random() < evapRate * dt && Math.random() > soluteBlock) {
          p.type = "vapor";
          p.vy = -30 - Math.random() * 20;
          p.vx = (Math.random() - 0.5) * 15;
          vaporCount++;
          continue;
        }

        // Bounce in liquid region
        if (p.x < bounds.x + 5) { p.x = bounds.x + 5; p.vx = Math.abs(p.vx); }
        if (p.x > bounds.x + bounds.w - 5) { p.x = bounds.x + bounds.w - 5; p.vx = -Math.abs(p.vx); }
        if (p.y < bounds.waterY) { p.y = bounds.waterY; p.vy = Math.abs(p.vy); }
        if (p.y > bounds.y + bounds.h - 5) { p.y = bounds.y + bounds.h - 5; p.vy = -Math.abs(p.vy); }
      } else {
        // Solute - stays in liquid
        if (p.x < bounds.x + 5) { p.x = bounds.x + 5; p.vx = Math.abs(p.vx); }
        if (p.x > bounds.x + bounds.w - 5) { p.x = bounds.x + bounds.w - 5; p.vx = -Math.abs(p.vx); }
        if (p.y < bounds.waterY) { p.y = bounds.waterY; p.vy = Math.abs(p.vy); }
        if (p.y > bounds.y + bounds.h - 5) { p.y = bounds.y + bounds.h - 5; p.vy = -Math.abs(p.vy); }
      }
    }
    return vaporCount;
  }

  function update(dt: number, params: Record<string, number>): void {
    const newConc = params.soluteConcentration ?? 0.2;
    temperature = params.temperature ?? 80;
    showLabels = Math.round(params.showLabels ?? 1);

    if (Math.abs(newConc - soluteConc) > 0.05) {
      soluteConc = newConc;
      createParticles();
    }
    soluteConc = newConc;

    const pureB = beakerBounds("left");
    const solnB = beakerBounds("right");

    pureVaporCount = updateParticles(pureParticles, pureB, dt, false);
    solnVaporCount = updateParticles(solnParticles, solnB, dt, true);

    time += dt;
  }

  function drawBeaker(bounds: ReturnType<typeof beakerBounds>, label: string): void {
    const { x, y, w, h, waterY } = bounds;

    // Water fill
    ctx.fillStyle = "rgba(52,152,219,0.2)";
    ctx.fillRect(x, waterY, w, y + h - waterY);

    // Beaker outline
    ctx.strokeStyle = "rgba(200,220,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y);
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, y - 8);
  }

  function drawParticle(p: Particle): void {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.type === "solute" ? 5 : 3, 0, Math.PI * 2);
    if (p.type === "water") {
      ctx.fillStyle = "rgba(100,180,255,0.7)";
    } else if (p.type === "solute") {
      ctx.fillStyle = "rgba(231,76,60,0.8)";
    } else {
      ctx.fillStyle = "rgba(200,230,255,0.5)";
    }
    ctx.fill();
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1a1a2e");
    bg.addColorStop(1, "#16213e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Vapor Pressure Lowering", width / 2, 25);

    const pureB = beakerBounds("left");
    const solnB = beakerBounds("right");

    drawBeaker(pureB, "Pure Water");
    drawBeaker(solnB, `Solution (${(soluteConc * 100).toFixed(0)}% solute)`);

    // Draw particles
    for (const p of pureParticles) drawParticle(p);
    for (const p of solnParticles) drawParticle(p);

    // Vapor pressure indicators
    const pureVP = temperature * 0.5;
    const solnVP = pureVP * (1 - soluteConc); // Raoult's law: P = P₀ × χ_solvent

    if (showLabels) {
      // Arrows showing vapor escape
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Vapor P = ${pureVP.toFixed(1)} mmHg`, pureB.x + pureB.w / 2, pureB.y - 25);
      ctx.fillText(`Vapor P = ${solnVP.toFixed(1)} mmHg`, solnB.x + solnB.w / 2, solnB.y - 25);

      // Evaporation rate arrows
      const arrowH1 = pureVP * 0.6;
      const arrowH2 = solnVP * 0.6;

      ctx.strokeStyle = "rgba(100,200,255,0.5)";
      ctx.lineWidth = 2;
      // Pure water arrows
      for (let i = 0; i < 3; i++) {
        const ax = pureB.x + pureB.w * (0.25 + i * 0.25);
        ctx.beginPath();
        ctx.moveTo(ax, pureB.waterY);
        ctx.lineTo(ax, pureB.waterY - arrowH1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, pureB.waterY - arrowH1);
        ctx.lineTo(ax - 4, pureB.waterY - arrowH1 + 8);
        ctx.lineTo(ax + 4, pureB.waterY - arrowH1 + 8);
        ctx.closePath();
        ctx.fillStyle = "rgba(100,200,255,0.5)";
        ctx.fill();
      }

      // Solution arrows (shorter)
      for (let i = 0; i < 3; i++) {
        const ax = solnB.x + solnB.w * (0.25 + i * 0.25);
        ctx.beginPath();
        ctx.moveTo(ax, solnB.waterY);
        ctx.lineTo(ax, solnB.waterY - arrowH2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax, solnB.waterY - arrowH2);
        ctx.lineTo(ax - 4, solnB.waterY - arrowH2 + 8);
        ctx.lineTo(ax + 4, solnB.waterY - arrowH2 + 8);
        ctx.closePath();
        ctx.fillStyle = "rgba(100,200,255,0.5)";
        ctx.fill();
      }
    }

    // Legend
    const ly = height * 0.82;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(15, ly, width - 30, 70, 8);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "left";
    ctx.fillText("Raoult's Law: P = P₀ · χ_solvent", 28, ly + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(`P₀ (pure) = ${pureVP.toFixed(1)} mmHg | P (solution) = ${solnVP.toFixed(1)} mmHg`, 28, ly + 36);
    ctx.fillText("Solute particles (red) block water molecules from escaping the surface.", 28, ly + 52);

    // Legend dots
    ctx.beginPath();
    ctx.arc(width - 100, ly + 20, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100,180,255,0.8)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Water", width - 92, ly + 24);

    ctx.beginPath();
    ctx.arc(width - 100, ly + 38, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(231,76,60,0.8)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Solute", width - 92, ly + 42);
  }

  function reset(): void {
    time = 0;
    createParticles();
  }

  function destroy(): void {
    pureParticles = [];
    solnParticles = [];
  }

  function getStateDescription(): string {
    const pureVP = temperature * 0.5;
    const solnVP = pureVP * (1 - soluteConc);
    return (
      `Vapor Pressure Lowering: T=${temperature}°C, solute concentration=${(soluteConc * 100).toFixed(0)}%. ` +
      `Pure water VP=${pureVP.toFixed(1)} mmHg, Solution VP=${solnVP.toFixed(1)} mmHg. ` +
      `Raoult's Law: P = P₀ · χ_solvent. Active vapor: pure=${pureVaporCount}, solution=${solnVaporCount}.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default VaporPressureLoweringFactory;
