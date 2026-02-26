import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface DiffusionParticle {
  x: number;
  y: number;
  absorbed: boolean;
  alpha: number;
}

const WhyAreCellsSmallFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("why-are-cells-small") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let cellSize = 1; // 1 = small, 2 = medium, 3 = large
  let diffusionSpeed = 1;
  let showRatio = 1;

  let particlesSmall: DiffusionParticle[] = [];
  let particlesMed: DiffusionParticle[] = [];
  let particlesLarge: DiffusionParticle[] = [];

  function createParticles(cx: number, cy: number, radius: number, count: number): DiffusionParticle[] {
    const parts: DiffusionParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = radius + 10 + Math.random() * 30;
      parts.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        absorbed: false,
        alpha: 1,
      });
    }
    return parts;
  }

  function initParticles(): void {
    const cy = height * 0.45;
    const r1 = 30;
    const r2 = 55;
    const r3 = 85;

    particlesSmall = createParticles(width * 0.2, cy, r1, 30);
    particlesMed = createParticles(width * 0.5, cy, r2, 30);
    particlesLarge = createParticles(width * 0.8, cy, r3, 30);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initParticles();
  }

  function updateParticles(particles: DiffusionParticle[], cx: number, cy: number, radius: number, dt: number): number {
    let absorbed = 0;
    for (const p of particles) {
      if (p.absorbed) {
        absorbed++;
        continue;
      }

      // Move toward cell (diffusion)
      const dx = cx - p.x;
      const dy = cy - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      p.x += (dx / dist) * diffusionSpeed * 30 * dt + (Math.random() - 0.5) * 20 * dt;
      p.y += (dy / dist) * diffusionSpeed * 30 * dt + (Math.random() - 0.5) * 20 * dt;

      // Check absorption at membrane
      const newDist = Math.sqrt((cx - p.x) ** 2 + (cy - p.y) ** 2) || 1;
      if (newDist <= radius + 3) {
        p.absorbed = true;
        p.x = cx + (p.x - cx) / newDist * (radius - 5);
        p.y = cy + (p.y - cy) / newDist * (radius - 5);
        absorbed++;
      }
    }
    return absorbed;
  }

  function update(dt: number, params: Record<string, number>): void {
    diffusionSpeed = params.diffusionSpeed ?? 1;
    showRatio = Math.round(params.showRatio ?? 1);

    const cy = height * 0.45;

    updateParticles(particlesSmall, width * 0.2, cy, 30, dt);
    updateParticles(particlesMed, width * 0.5, cy, 55, dt);
    updateParticles(particlesLarge, width * 0.8, cy, 85, dt);

    time += dt;
  }

  function drawCell(cx: number, cy: number, radius: number, label: string, particles: DiffusionParticle[]): void {
    // Cell membrane
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    const memGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius);
    memGrad.addColorStop(0, "rgba(46,204,113,0.1)");
    memGrad.addColorStop(0.9, "rgba(46,204,113,0.15)");
    memGrad.addColorStop(1, "rgba(46,204,113,0.4)");
    ctx.fillStyle = memGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(46,204,113,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Nucleus
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(155,89,182,0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(155,89,182,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Particles
    let absorbedCount = 0;
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = p.absorbed
        ? "rgba(52,152,219,0.7)"
        : "rgba(231,76,60,0.8)";
      ctx.fill();
      if (p.absorbed) absorbedCount++;
    }

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy - radius - 12);

    // SA:V ratio
    if (showRatio) {
      const sa = 4 * Math.PI * radius * radius;
      const vol = (4 / 3) * Math.PI * radius * radius * radius;
      const ratio = sa / vol;

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`SA/V = ${ratio.toFixed(2)}`, cx, cy + radius + 16);
      ctx.fillText(`Absorbed: ${absorbedCount}/${particles.length}`, cx, cy + radius + 30);
    }
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a2e");
    bg.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Why Are Cells Small?", width / 2, 24);

    const cy = height * 0.45;

    drawCell(width * 0.2, cy, 30, "Small Cell", particlesSmall);
    drawCell(width * 0.5, cy, 55, "Medium Cell", particlesMed);
    drawCell(width * 0.8, cy, 85, "Large Cell", particlesLarge);

    // SA:V ratio comparison bar chart
    const chartY = height * 0.75;
    const chartH = height * 0.18;
    const barW = 40;
    const radii = [30, 55, 85];
    const labels = ["Small", "Medium", "Large"];
    const colors = ["#2ecc71", "#f1c40f", "#e74c3c"];

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(width * 0.1, chartY - 15, width * 0.8, chartH + 30, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Surface Area / Volume Ratio", width / 2, chartY - 2);

    for (let i = 0; i < 3; i++) {
      const r = radii[i];
      const ratio = 3 / r; // simplified SA/V for sphere = 3/r
      const barHeight = ratio * chartH * 10;
      const bx = width * (0.25 + i * 0.25) - barW / 2;
      const by = chartY + chartH - barHeight;

      ctx.fillStyle = colors[i];
      ctx.fillRect(bx, by, barW, barHeight);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(labels[i], bx + barW / 2, chartY + chartH + 14);
      ctx.fillText(`${(3 / r).toFixed(2)}`, bx + barW / 2, by - 5);
    }

    // Explanation
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Smaller cells have higher SA/V → more efficient nutrient exchange per unit volume", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    initParticles();
  }

  function destroy(): void {
    particlesSmall = [];
    particlesMed = [];
    particlesLarge = [];
  }

  function getStateDescription(): string {
    const absSmall = particlesSmall.filter((p) => p.absorbed).length;
    const absMed = particlesMed.filter((p) => p.absorbed).length;
    const absLarge = particlesLarge.filter((p) => p.absorbed).length;
    return (
      `Why Are Cells Small: Comparing 3 cell sizes. SA/V ratios: ` +
      `small=${(3 / 30).toFixed(3)}, medium=${(3 / 55).toFixed(3)}, large=${(3 / 85).toFixed(3)}. ` +
      `Absorbed nutrients: small=${absSmall}/30, medium=${absMed}/30, large=${absLarge}/30. ` +
      `Smaller cells absorb more efficiently. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default WhyAreCellsSmallFactory;
