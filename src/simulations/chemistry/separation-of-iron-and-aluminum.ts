import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Separation of Iron and Aluminum — demonstrates magnetic separation of iron from
 * aluminum using a magnet. Iron is ferromagnetic and attracted; aluminum is not.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "iron" | "aluminum";
  radius: number;
  attracted: boolean;
}

const SeparationOfIronAndAluminumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("separation-of-iron-and-aluminum") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let magnetStrength = 7;
  let ironCount = 15;
  let aluminumCount = 15;
  let magnetY = 0.3;

  let particles: Particle[] = [];
  let magnetX = 0;
  let magnetPosY = 0;

  function createParticles(): void {
    particles = [];
    const mixX = width * 0.3;
    const mixY = height * 0.65;
    const spread = 80;

    for (let i = 0; i < ironCount; i++) {
      particles.push({
        x: mixX + (Math.random() - 0.5) * spread,
        y: mixY + (Math.random() - 0.5) * spread * 0.5,
        vx: 0,
        vy: 0,
        type: "iron",
        radius: 6 + Math.random() * 3,
        attracted: false,
      });
    }
    for (let i = 0; i < aluminumCount; i++) {
      particles.push({
        x: mixX + (Math.random() - 0.5) * spread,
        y: mixY + (Math.random() - 0.5) * spread * 0.5,
        vx: 0,
        vy: 0,
        type: "aluminum",
        radius: 6 + Math.random() * 3,
        attracted: false,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    magnetX = width * 0.5;
    magnetPosY = height * magnetY;
    time = 0;
    createParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    magnetStrength = params.magnetStrength ?? 7;
    const newIron = Math.round(params.ironCount ?? 15);
    const newAlum = Math.round(params.aluminumCount ?? 15);
    magnetY = params.magnetY ?? 0.3;

    if (newIron !== ironCount || newAlum !== aluminumCount) {
      ironCount = newIron;
      aluminumCount = newAlum;
      createParticles();
    }

    magnetPosY = height * magnetY;
    magnetX = width * 0.5;

    const step = Math.min(dt, 0.033);
    time += step;

    const gravity = 200;
    const floorY = height * 0.82;

    for (const p of particles) {
      // Gravity
      p.vy += gravity * step;

      if (p.type === "iron") {
        // Magnetic force on iron
        const dx = magnetX - p.x;
        const dy = magnetPosY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = 30;

        if (dist > minDist) {
          const force = (magnetStrength * 5000) / (dist * dist);
          p.vx += (force * dx / dist) * step;
          p.vy += (force * dy / dist) * step;
        }

        p.attracted = dist < 80;

        // Stick to magnet if very close
        if (dist < 35) {
          p.vx *= 0.8;
          p.vy *= 0.8;
          // Gentle pull
          p.vx += dx * 0.5 * step;
          p.vy += dy * 0.5 * step;
        }
      } else {
        p.attracted = false;
      }

      // Damping
      p.vx *= 0.97;
      p.vy *= 0.97;

      p.x += p.vx * step;
      p.y += p.vy * step;

      // Floor collision
      if (p.y + p.radius > floorY) {
        p.y = floorY - p.radius;
        p.vy = -Math.abs(p.vy) * 0.3;
        p.vx *= 0.9;
      }

      // Wall collisions
      if (p.x - p.radius < 0) { p.x = p.radius; p.vx = Math.abs(p.vx) * 0.5; }
      if (p.x + p.radius > width) { p.x = width - p.radius; p.vx = -Math.abs(p.vx) * 0.5; }
      if (p.y - p.radius < 0) { p.y = p.radius; p.vy = Math.abs(p.vy) * 0.5; }
    }

    // Simple particle-particle collision
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minD = a.radius + b.radius;
        if (dist < minD && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minD - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
        }
      }
    }
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1a1a2e");
    bg.addColorStop(1, "#16213e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const floorY = height * 0.82;

    // Table/surface
    ctx.fillStyle = "#3a2f25";
    ctx.fillRect(0, floorY, width, height - floorY);
    ctx.strokeStyle = "rgba(100, 80, 60, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(width, floorY);
    ctx.stroke();

    // Magnetic field lines (faint)
    ctx.save();
    ctx.strokeStyle = `rgba(100, 150, 255, ${magnetStrength * 0.02})`;
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      for (let r = 30; r < 150; r += 2) {
        const fx = magnetX + r * Math.cos(a + Math.sin(r * 0.02) * 0.3);
        const fy = magnetPosY + r * Math.sin(a + Math.sin(r * 0.02) * 0.3);
        if (r === 30) ctx.moveTo(fx, fy);
        else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Magnet
    const magW = 60;
    const magH = 25;

    // N pole (red)
    ctx.fillStyle = "#cc3333";
    ctx.beginPath();
    ctx.roundRect(magnetX - magW / 2, magnetPosY - magH / 2, magW / 2, magH, [5, 0, 0, 5]);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", magnetX - magW / 4, magnetPosY + 5);

    // S pole (blue)
    ctx.fillStyle = "#3344cc";
    ctx.beginPath();
    ctx.roundRect(magnetX, magnetPosY - magH / 2, magW / 2, magH, [0, 5, 5, 0]);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.fillText("S", magnetX + magW / 4, magnetPosY + 5);

    // Magnet glow
    const mGlow = ctx.createRadialGradient(magnetX, magnetPosY, 10, magnetX, magnetPosY, 60);
    mGlow.addColorStop(0, `rgba(150, 100, 255, ${magnetStrength * 0.03})`);
    mGlow.addColorStop(1, "rgba(150, 100, 255, 0)");
    ctx.fillStyle = mGlow;
    ctx.beginPath();
    ctx.arc(magnetX, magnetPosY, 60, 0, Math.PI * 2);
    ctx.fill();

    // Particles
    for (const p of particles) {
      if (p.type === "iron") {
        const grad = ctx.createRadialGradient(p.x - p.radius * 0.3, p.y - p.radius * 0.3, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, "#999");
        grad.addColorStop(1, "#444");
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createRadialGradient(p.x - p.radius * 0.3, p.y - p.radius * 0.3, 0, p.x, p.y, p.radius);
        grad.addColorStop(0, "#ddd");
        grad.addColorStop(1, "#aab");
        ctx.fillStyle = grad;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = p.type === "iron" ? "rgba(255, 255, 255, 0.8)" : "rgba(50, 50, 50, 0.8)";
      ctx.font = "bold 7px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.type === "iron" ? "Fe" : "Al", p.x, p.y + 3);
    }

    // Separation containers labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const ironAttracted = particles.filter((p) => p.type === "iron" && p.attracted).length;
    ctx.fillText(`Iron attracted: ${ironAttracted}/${ironCount}`, magnetX, magnetPosY - 25);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 280, 105, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Separation of Iron & Aluminum", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("Iron (Fe) is ferromagnetic → attracted to magnet", 20, 46);
    ctx.fillText("Aluminum (Al) is paramagnetic → NOT attracted", 20, 62);
    ctx.fillText("Magnetic separation sorts materials by property", 20, 78);
    ctx.fillText(`Magnet strength: ${magnetStrength.toFixed(0)}/10`, 20, 94);
    ctx.fillText(`Fe: ${ironCount}, Al: ${aluminumCount}`, 20, 110);
  }

  function reset(): void {
    time = 0;
    createParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const ironAttracted = particles.filter((p) => p.type === "iron" && p.attracted).length;
    return (
      `Separation of Iron & Aluminum: Magnet strength=${magnetStrength.toFixed(0)}/10. ` +
      `${ironCount} Fe particles, ${aluminumCount} Al particles. ` +
      `${ironAttracted} iron pieces attracted to magnet. ` +
      `Iron is ferromagnetic; aluminum is not. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SeparationOfIronAndAluminumFactory;
