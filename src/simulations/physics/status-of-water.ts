import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Three States of Water (Ice, Liquid, Steam)
 * Demonstrates:
 * - Side-by-side comparison of molecular arrangements
 * - How temperature determines which state is active
 * - Crystal lattice vs loose packing vs free particles
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
}

const StatusOfWaterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("status-of-water") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 25;
  let pressure = 1;
  let zoom = 1;

  // Particles for each state
  let iceParticles: Particle[] = [];
  let liquidParticles: Particle[] = [];
  let gasParticles: Particle[] = [];

  function createParticles(cx: number, cy: number, count: number, spread: number): Particle[] {
    const particles: Particle[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const bx = cx - spread / 2 + (col / cols) * spread;
      const by = cy - spread / 2 + (row / cols) * spread;
      particles.push({
        x: bx, y: by,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        baseX: bx, baseY: by,
      });
    }
    return particles;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    resetParticles();
  }

  function resetParticles(): void {
    const containerW = (width - 80) / 3;
    const cy = height * 0.52;
    const x1 = 30 + containerW / 2;
    const x2 = 40 + containerW + containerW / 2;
    const x3 = 50 + containerW * 2 + containerW / 2;
    const count = 20;
    const spread = 70 * zoom;

    iceParticles = createParticles(x1, cy, count, spread);
    liquidParticles = createParticles(x2, cy, count, spread);
    gasParticles = createParticles(x3, cy, count, spread);
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    temperature = params.temperature ?? 25;
    pressure = params.pressure ?? 1;
    zoom = params.zoom ?? 1;
    time += step;

    const containerW = (width - 80) / 3;
    const cy = height * 0.52;
    const hw = containerW * 0.4;
    const hh = 70;

    // Ice: vibrate in lattice
    iceParticles.forEach((p) => {
      const amp = 1.0 + Math.max(0, temperature + 30) * 0.02;
      p.x = p.baseX + Math.sin(time * 6 + p.baseX * 0.1) * amp;
      p.y = p.baseY + Math.cos(time * 6 + p.baseY * 0.1) * amp;
    });

    // Liquid: move with cohesion
    const x2 = 40 + containerW + containerW / 2;
    liquidParticles.forEach((p) => {
      p.vx += (Math.random() - 0.5) * 100 * step;
      p.vy += (Math.random() - 0.5) * 100 * step + 20 * step;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.x += p.vx * step;
      p.y += p.vy * step;

      if (p.x < x2 - hw + 5) { p.x = x2 - hw + 5; p.vx *= -0.5; }
      if (p.x > x2 + hw - 5) { p.x = x2 + hw - 5; p.vx *= -0.5; }
      if (p.y < cy - hh + 5) { p.y = cy - hh + 5; p.vy *= -0.5; }
      if (p.y > cy + hh - 5) { p.y = cy + hh - 5; p.vy *= -0.5; }
    });

    // Gas: fast bouncing
    const x3 = 50 + containerW * 2 + containerW / 2;
    gasParticles.forEach((p) => {
      p.vx += (Math.random() - 0.5) * 200 * step;
      p.vy += (Math.random() - 0.5) * 200 * step;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x += p.vx * step;
      p.y += p.vy * step;

      const gHw = hw + 10;
      const gHh = hh + 10;
      if (p.x < x3 - gHw) { p.x = x3 - gHw; p.vx = Math.abs(p.vx); }
      if (p.x > x3 + gHw) { p.x = x3 + gHw; p.vx = -Math.abs(p.vx); }
      if (p.y < cy - gHh) { p.y = cy - gHh; p.vy = Math.abs(p.vy); }
      if (p.y > cy + gHh) { p.y = cy + gHh; p.vy = -Math.abs(p.vy); }
    });
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(1, "#162032");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.024)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Three States of Water", width / 2, 28);

    // Temperature display
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(`Temperature: ${temperature.toFixed(0)} \u00B0C   |   Pressure: ${pressure.toFixed(2)} atm`, width / 2, 52);

    const containerW = (width - 80) / 3;
    const cy = height * 0.52;

    // Determine active state
    const activeState = temperature <= 0 ? "ice" : temperature >= 100 ? "gas" : "liquid";

    drawContainer(30, cy, containerW, "Solid (Ice)", "#93c5fd", activeState === "ice", iceParticles, "ice");
    drawContainer(40 + containerW, cy, containerW, "Liquid (Water)", "#3b82f6", activeState === "liquid", liquidParticles, "liquid");
    drawContainer(50 + containerW * 2, cy, containerW, "Gas (Steam)", "#c084fc", activeState === "gas", gasParticles, "gas");

    // Info panel at bottom
    drawInfoPanel();
  }

  function drawContainer(
    x: number, cy: number, w: number, label: string,
    color: string, isActive: boolean, particles: Particle[], state: string
  ): void {
    const hw = w * 0.45;
    const hh = 75;

    // Container background
    ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(x, cy - hh - 30, w, hh * 2 + 60, 10);
    ctx.fill();

    if (isActive) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = isActive ? color : "#64748b";
    ctx.font = `bold 14px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2, cy - hh - 10);

    if (isActive) {
      ctx.fillStyle = "#22d3ee";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText("ACTIVE", x + w / 2, cy - hh - 25);
    }

    // Inner container box
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w / 2 - hw, cy - hh, hw * 2, hh * 2);

    // Draw molecules
    const centerX = x + w / 2;
    particles.forEach((p) => {
      drawWaterMolecule(p.x, p.y, state, isActive ? 1 : 0.4);
    });

    // Draw bonds for ice
    if (state === "ice") {
      ctx.strokeStyle = isActive ? "rgba(147, 197, 253, 0.25)" : "rgba(147, 197, 253, 0.1)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 25) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.setLineDash([]);
    }

    // Description
    ctx.fillStyle = isActive ? "rgba(226, 232, 240, 0.8)" : "rgba(148, 163, 184, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (state === "ice") {
      ctx.fillText("Ordered crystal lattice", x + w / 2, cy + hh + 18);
      ctx.fillText("Fixed positions, vibrating", x + w / 2, cy + hh + 30);
    } else if (state === "liquid") {
      ctx.fillText("Loosely packed molecules", x + w / 2, cy + hh + 18);
      ctx.fillText("Sliding past each other", x + w / 2, cy + hh + 30);
    } else {
      ctx.fillText("Widely spaced, fast-moving", x + w / 2, cy + hh + 18);
      ctx.fillText("No fixed shape or volume", x + w / 2, cy + hh + 30);
    }
  }

  function drawWaterMolecule(x: number, y: number, state: string, alpha: number): void {
    const oRadius = 4 * zoom;
    const hRadius = 2.5 * zoom;
    const bondLen = 5 * zoom;
    const rotSpeed = state === "gas" ? 3 : state === "liquid" ? 1 : 0.2;
    const angle = time * rotSpeed + x * 0.05 + y * 0.03;

    // Oxygen
    ctx.beginPath();
    ctx.arc(x, y, oRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
    ctx.fill();

    // Hydrogens
    const h1x = x + Math.cos(angle + 0.9) * bondLen;
    const h1y = y + Math.sin(angle + 0.9) * bondLen;
    const h2x = x + Math.cos(angle - 0.9) * bondLen;
    const h2y = y + Math.sin(angle - 0.9) * bondLen;

    ctx.beginPath();
    ctx.arc(h1x, h1y, hRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(h2x, h2y, hRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bonds
    ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(h1x, h1y);
    ctx.moveTo(x, y);
    ctx.lineTo(h2x, h2y);
    ctx.stroke();
  }

  function drawInfoPanel(): void {
    const px = 20;
    const py = height - 90;
    const pw = width - 40;
    const ph = 75;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Molecular Properties Comparison", px + 15, py + 18);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    const col1 = px + 15;
    const col2 = px + pw * 0.35;
    const col3 = px + pw * 0.65;

    ctx.fillStyle = "#93c5fd";
    ctx.fillText("Ice: Fixed shape, fixed volume", col1, py + 38);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("Water: No fixed shape, fixed volume", col2, py + 38);
    ctx.fillStyle = "#c084fc";
    ctx.fillText("Steam: No fixed shape/volume", col3, py + 38);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Strong H-bonds, crystalline", col1, py + 55);
    ctx.fillText("Weak H-bonds, fluid", col2, py + 55);
    ctx.fillText("No bonds, free particles", col3, py + 55);
  }

  function reset(): void {
    time = 0;
    resetParticles();
  }

  function destroy(): void {
    iceParticles = [];
    liquidParticles = [];
    gasParticles = [];
  }

  function getStateDescription(): string {
    const active = temperature <= 0 ? "solid (ice)" : temperature >= 100 ? "gas (steam)" : "liquid (water)";
    return (
      `Three states of water shown side by side at T=${temperature}\u00B0C, P=${pressure}atm. ` +
      `Active state: ${active}. Ice has ordered crystal lattice with hydrogen bonds. ` +
      `Liquid has loose packing with molecules sliding. Gas has fast, widely spaced molecules.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    resetParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StatusOfWaterFactory;
