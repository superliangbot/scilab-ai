import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * General Comparison of Solid, Liquid, and Gas
 * Demonstrates:
 * - Particle behavior in each state
 * - Effect of temperature on particle motion
 * - Intermolecular forces (strong in solid, moderate in liquid, none in gas)
 * - Three containers side by side with realistic particle dynamics
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  color: string;
}

const StatusSolidLiquidGasFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("status-solid-liquid-gas") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 300;
  let particleCount = 30;
  let showLabels = 1;
  let interactionStrength = 1;

  let solidParticles: Particle[] = [];
  let liquidParticles: Particle[] = [];
  let gasParticles: Particle[] = [];

  const colors = [
    "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399",
    "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#e2e8f0",
  ];

  function createParticlesForState(
    cx: number, cy: number, count: number, containerW: number, containerH: number, state: string
  ): Particle[] {
    const particles: Particle[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const spacing = Math.min(containerW * 0.8 / cols, containerH * 0.6 / rows);

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const bx = cx - (cols * spacing) / 2 + col * spacing + spacing / 2;
      const by = cy - (rows * spacing) / 2 + row * spacing + spacing / 2 + (state === "solid" ? 10 : 0);

      const speed = state === "gas" ? 80 : state === "liquid" ? 30 : 0;
      particles.push({
        x: bx + (Math.random() - 0.5) * (state === "solid" ? 2 : 20),
        y: by + (Math.random() - 0.5) * (state === "solid" ? 2 : 20),
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        baseX: bx,
        baseY: by,
        color: colors[i % colors.length],
      });
    }
    return particles;
  }

  function getContainerLayout(): { x: number; cy: number; w: number; h: number }[] {
    const gap = 15;
    const cw = (width - gap * 4) / 3;
    const ch = height * 0.52;
    const cy = height * 0.48;
    return [
      { x: gap, cy, w: cw, h: ch },
      { x: gap * 2 + cw, cy, w: cw, h: ch },
      { x: gap * 3 + cw * 2, cy, w: cw, h: ch },
    ];
  }

  function initParticles(): void {
    const layout = getContainerLayout();
    const count = Math.round(particleCount);
    solidParticles = createParticlesForState(
      layout[0].x + layout[0].w / 2, layout[0].cy, count, layout[0].w, layout[0].h, "solid"
    );
    liquidParticles = createParticlesForState(
      layout[1].x + layout[1].w / 2, layout[1].cy, count, layout[1].w, layout[1].h, "liquid"
    );
    gasParticles = createParticlesForState(
      layout[2].x + layout[2].w / 2, layout[2].cy, count, layout[2].w, layout[2].h, "gas"
    );
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    temperature = params.temperature ?? 300;
    const newCount = Math.round(params.particleCount ?? 30);
    showLabels = params.showLabels ?? 1;
    interactionStrength = params.interactionStrength ?? 1;

    if (newCount !== particleCount) {
      particleCount = newCount;
      initParticles();
    }

    time += step;

    const layout = getContainerLayout();
    const tempFactor = temperature / 300;

    // Update solid particles: vibrate in place
    updateSolid(step, layout[0], tempFactor);
    // Update liquid particles: move with cohesion
    updateLiquid(step, layout[1], tempFactor);
    // Update gas particles: free bouncing
    updateGas(step, layout[2], tempFactor);
  }

  function updateSolid(dt: number, layout: { x: number; cy: number; w: number; h: number }, tempFactor: number): void {
    const vibAmp = 2 * tempFactor * interactionStrength;
    solidParticles.forEach((p) => {
      p.x = p.baseX + Math.sin(time * 8 + p.baseX * 0.5) * vibAmp;
      p.y = p.baseY + Math.cos(time * 8 + p.baseY * 0.5) * vibAmp;
    });
  }

  function updateLiquid(dt: number, layout: { x: number; cy: number; w: number; h: number }, tempFactor: number): void {
    const cx = layout.x + layout.w / 2;
    const hw = layout.w * 0.42;
    const hh = layout.h * 0.42;
    const topY = layout.cy - hh;
    const bottomY = layout.cy + hh;
    const leftX = cx - hw;
    const rightX = cx + hw;

    liquidParticles.forEach((p) => {
      // Random thermal agitation
      p.vx += (Math.random() - 0.5) * 120 * tempFactor * dt;
      p.vy += (Math.random() - 0.5) * 120 * tempFactor * dt;

      // Gravity pull
      p.vy += 40 * dt;

      // Intermolecular attraction (cohesion)
      liquidParticles.forEach((other) => {
        if (other === p) return;
        const dx = other.x - p.x;
        const dy = other.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5 && dist < 30) {
          const force = interactionStrength * 0.3 / dist;
          p.vx += dx * force * dt;
          p.vy += dy * force * dt;
        }
        // Repulsion at close range
        if (dist > 0 && dist < 8) {
          const repel = interactionStrength * 5 / (dist * dist);
          p.vx -= dx * repel * dt;
          p.vy -= dy * repel * dt;
        }
      });

      p.vx *= 0.96;
      p.vy *= 0.96;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Container walls
      if (p.x < leftX + 4) { p.x = leftX + 4; p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x > rightX - 4) { p.x = rightX - 4; p.vx = -Math.abs(p.vx) * 0.5; }
      if (p.y < topY + 4) { p.y = topY + 4; p.vy = Math.abs(p.vy) * 0.5; }
      if (p.y > bottomY - 4) { p.y = bottomY - 4; p.vy = -Math.abs(p.vy) * 0.5; }
    });
  }

  function updateGas(dt: number, layout: { x: number; cy: number; w: number; h: number }, tempFactor: number): void {
    const cx = layout.x + layout.w / 2;
    const hw = layout.w * 0.42;
    const hh = layout.h * 0.42;
    const topY = layout.cy - hh;
    const bottomY = layout.cy + hh;
    const leftX = cx - hw;
    const rightX = cx + hw;

    gasParticles.forEach((p) => {
      p.vx += (Math.random() - 0.5) * 200 * tempFactor * dt;
      p.vy += (Math.random() - 0.5) * 200 * tempFactor * dt;

      // Speed limit based on temperature
      const maxSpeed = 80 * tempFactor;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      p.vx *= 0.99;
      p.vy *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Elastic wall collisions
      if (p.x < leftX + 4) { p.x = leftX + 4; p.vx = Math.abs(p.vx); }
      if (p.x > rightX - 4) { p.x = rightX - 4; p.vx = -Math.abs(p.vx); }
      if (p.y < topY + 4) { p.y = topY + 4; p.vy = Math.abs(p.vy); }
      if (p.y > bottomY - 4) { p.y = bottomY - 4; p.vy = -Math.abs(p.vy); }
    });
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(15, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("States of Matter: Solid, Liquid, Gas", width / 2, 25);

    // Temperature display
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(`Temperature: ${temperature.toFixed(0)} K`, width / 2, 44);

    const layout = getContainerLayout();

    drawContainerWithParticles(layout[0], "Solid", solidParticles, "#93c5fd", "#1e3a5f");
    drawContainerWithParticles(layout[1], "Liquid", liquidParticles, "#3b82f6", "#1e3050");
    drawContainerWithParticles(layout[2], "Gas", gasParticles, "#c084fc", "#2d1b4e");

    if (showLabels) drawPropertyTable();
  }

  function drawContainerWithParticles(
    layout: { x: number; cy: number; w: number; h: number },
    label: string, particles: Particle[],
    accentColor: string, bgColor: string
  ): void {
    const cx = layout.x + layout.w / 2;
    const hw = layout.w * 0.45;
    const hh = layout.h * 0.45;

    // Container background
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(layout.x + 5, layout.cy - layout.h / 2, layout.w - 10, layout.h, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = accentColor;
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, layout.cy - hh - 18);

    // Inner container walls
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - hw, layout.cy - hh, hw * 2, hh * 2);

    // Particles
    const radius = 5;
    particles.forEach((p) => {
      // Glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}22`;
      ctx.fill();

      // Particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(p.x - 1, p.y - 1, 0, p.x, p.y, radius);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, p.color);
      grad.addColorStop(1, `${p.color}88`);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // Draw bonds for solid
    if (label === "Solid") {
      ctx.strokeStyle = "rgba(147, 197, 253, 0.2)";
      ctx.lineWidth = 1;
      particles.forEach((p, i) => {
        particles.forEach((q, j) => {
          if (j <= i) return;
          const dx = p.baseX - q.baseX;
          const dy = p.baseY - q.baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 30) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        });
      });
    }

    // Description under container
    if (showLabels) {
      ctx.fillStyle = "rgba(226, 232, 240, 0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      if (label === "Solid") {
        ctx.fillText("Fixed positions", cx, layout.cy + hh + 16);
        ctx.fillText("Vibrating in lattice", cx, layout.cy + hh + 28);
      } else if (label === "Liquid") {
        ctx.fillText("Close together", cx, layout.cy + hh + 16);
        ctx.fillText("Flowing freely", cx, layout.cy + hh + 28);
      } else {
        ctx.fillText("Far apart", cx, layout.cy + hh + 16);
        ctx.fillText("Rapid random motion", cx, layout.cy + hh + 28);
      }
    }
  }

  function drawPropertyTable(): void {
    const tx = 15;
    const ty = height - 75;
    const tw = width - 30;
    const th = 65;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 6);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";

    const col1 = tx + tw * 0.12;
    const col2 = tx + tw * 0.37;
    const col3 = tx + tw * 0.62;
    const col4 = tx + tw * 0.87;

    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Property", col1, ty + 15);
    ctx.fillStyle = "#93c5fd";
    ctx.fillText("Solid", col2, ty + 15);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("Liquid", col3, ty + 15);
    ctx.fillStyle = "#c084fc";
    ctx.fillText("Gas", col4, ty + 15);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Shape", col1, ty + 32);
    ctx.fillText("Volume", col1, ty + 46);
    ctx.fillText("Spacing", col1, ty + 60);

    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Fixed", col2, ty + 32);
    ctx.fillText("Fixed", col2, ty + 46);
    ctx.fillText("Very close", col2, ty + 60);

    ctx.fillText("Flows", col3, ty + 32);
    ctx.fillText("Fixed", col3, ty + 46);
    ctx.fillText("Close", col3, ty + 60);

    ctx.fillText("Fills container", col4, ty + 32);
    ctx.fillText("Fills container", col4, ty + 46);
    ctx.fillText("Far apart", col4, ty + 60);
  }

  function reset(): void {
    time = 0;
    initParticles();
  }

  function destroy(): void {
    solidParticles = [];
    liquidParticles = [];
    gasParticles = [];
  }

  function getStateDescription(): string {
    return (
      `States of matter comparison at T=${temperature}K with ${particleCount} particles per state. ` +
      `Solid: particles vibrate in fixed lattice positions with strong intermolecular forces. ` +
      `Liquid: particles move with some cohesion, moderate forces. ` +
      `Gas: particles bounce freely off walls with negligible forces. ` +
      `Interaction strength: ${interactionStrength.toFixed(1)}x.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StatusSolidLiquidGasFactory;
