import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  mass: number;
  radius: number;
  color: string;
  glowColor: string;
  trail: Array<{ x: number; y: number }>;
  label: string;
}

const GravityOrbitsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gravity-orbits") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let bodies: Body[] = [];

  // Cached parameters
  let G = 2;
  let trailLength = 200;
  let timeStepMultiplier = 1;

  // Softening parameter to prevent infinite forces at close distances
  const SOFTENING = 4;

  function createDefaultBodies(): void {
    const cx = width / 2;
    const cy = height / 2;

    bodies = [
      // Central massive body (star)
      {
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
        mass: 2000,
        radius: 22,
        color: "#fbbf24",
        glowColor: "rgba(251, 191, 36, 0.3)",
        trail: [],
        label: "Star",
      },
      // Orbiting body 1 (inner planet)
      {
        x: cx + 120,
        y: cy,
        vx: 0,
        vy: -computeOrbitalSpeed(2000, 120),
        ax: 0,
        ay: 0,
        mass: 10,
        radius: 8,
        color: "#3b82f6",
        glowColor: "rgba(59, 130, 246, 0.3)",
        trail: [],
        label: "Planet 1",
      },
      // Orbiting body 2 (mid planet)
      {
        x: cx - 200,
        y: cy,
        vx: 0,
        vy: computeOrbitalSpeed(2000, 200),
        ax: 0,
        ay: 0,
        mass: 25,
        radius: 11,
        color: "#ef4444",
        glowColor: "rgba(239, 68, 68, 0.3)",
        trail: [],
        label: "Planet 2",
      },
      // Orbiting body 3 (outer planet)
      {
        x: cx,
        y: cy - 300,
        vx: computeOrbitalSpeed(2000, 300),
        vy: 0,
        ax: 0,
        ay: 0,
        mass: 15,
        radius: 9,
        color: "#10b981",
        glowColor: "rgba(16, 185, 129, 0.3)",
        trail: [],
        label: "Planet 3",
      },
    ];
  }

  function computeOrbitalSpeed(centralMass: number, distance: number): number {
    // v = sqrt(G * M / r) for circular orbit
    return Math.sqrt((G * centralMass) / distance);
  }

  function computeAccelerations(): void {
    // Reset accelerations
    for (const body of bodies) {
      body.ax = 0;
      body.ay = 0;
    }

    // Compute gravitational force between every pair
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy + SOFTENING * SOFTENING;
        const dist = Math.sqrt(distSq);
        const force = (G * a.mass * b.mass) / distSq;

        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;

        a.ax += fx / a.mass;
        a.ay += fy / a.mass;
        b.ax -= fx / b.mass;
        b.ay -= fy / b.mass;
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    createDefaultBodies();
    computeAccelerations();
  }

  function update(dt: number, params: Record<string, number>): void {
    G = params.gravity ?? 2;
    trailLength = Math.round(params.trailLength ?? 200);
    timeStepMultiplier = params.timeStep ?? 1;

    // Use a fixed-step integrator with timeStep multiplier
    const effectiveDt = dt * timeStepMultiplier;

    // Velocity Verlet integration
    // Step 1: update positions using current velocity and acceleration
    for (const body of bodies) {
      body.x += body.vx * effectiveDt + 0.5 * body.ax * effectiveDt * effectiveDt;
      body.y += body.vy * effectiveDt + 0.5 * body.ay * effectiveDt * effectiveDt;
    }

    // Step 2: save old accelerations, compute new ones
    const oldAccels = bodies.map((b) => ({ ax: b.ax, ay: b.ay }));
    computeAccelerations();

    // Step 3: update velocities using average of old and new accelerations
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      body.vx += 0.5 * (oldAccels[i].ax + body.ax) * effectiveDt;
      body.vy += 0.5 * (oldAccels[i].ay + body.ay) * effectiveDt;
    }

    // Update trails
    for (const body of bodies) {
      body.trail.push({ x: body.x, y: body.y });
      if (body.trail.length > trailLength) {
        body.trail.splice(0, body.trail.length - trailLength);
      }
    }

    time += effectiveDt;
  }

  function drawStarfield(): void {
    // Deterministic starfield
    ctx.save();
    const seed = 42;
    let rng = seed;
    function pseudoRandom(): number {
      rng = (rng * 16807 + 0) % 2147483647;
      return rng / 2147483647;
    }

    for (let i = 0; i < 120; i++) {
      const sx = pseudoRandom() * width;
      const sy = pseudoRandom() * height;
      const brightness = 0.2 + pseudoRandom() * 0.6;
      const size = 0.5 + pseudoRandom() * 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTrails(): void {
    for (const body of bodies) {
      if (body.trail.length < 2) continue;

      const len = body.trail.length;
      for (let i = 1; i < len; i++) {
        const alpha = (i / len) * 0.7;
        const lineWidth = 0.5 + (i / len) * 2;
        ctx.beginPath();
        ctx.moveTo(body.trail[i - 1].x, body.trail[i - 1].y);
        ctx.lineTo(body.trail[i].x, body.trail[i].y);
        ctx.strokeStyle = body.color.replace(")", `, ${alpha})`).replace("rgb", "rgba");
        // Handle hex colors
        const r = parseInt(body.color.slice(1, 3), 16);
        const g = parseInt(body.color.slice(3, 5), 16);
        const b = parseInt(body.color.slice(5, 7), 16);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  }

  function drawBody(body: Body): void {
    const { x, y, radius, color, glowColor } = body;

    // Outer glow
    const outerGlow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 4);
    outerGlow.addColorStop(0, glowColor);
    outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.beginPath();
    ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Inner glow ring
    const innerGlow = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 2);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    innerGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
    innerGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = innerGlow;
    ctx.fill();

    // Body sphere with shading
    const bodyGrad = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius
    );
    bodyGrad.addColorStop(0, "#ffffff");
    bodyGrad.addColorStop(0.25, color);
    // Darker shade
    const dr = Math.max(0, r - 60);
    const dg = Math.max(0, g - 60);
    const db = Math.max(0, b - 60);
    bodyGrad.addColorStop(1, `rgb(${dr}, ${dg}, ${db})`);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Subtle rim highlight
    ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(body.label, x, y + radius + 16);
  }

  function render(): void {
    // Deep space background
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, "#0f0f2e");
    bgGrad.addColorStop(0.5, "#080820");
    bgGrad.addColorStop(1, "#020210");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Starfield
    drawStarfield();

    // Draw trails behind bodies
    drawTrails();

    // Draw bodies (central body last so it renders on top)
    // Sort by mass ascending so larger bodies draw on top
    const sortedBodies = [...bodies].sort((a, b) => a.mass - b.mass);
    for (const body of sortedBodies) {
      drawBody(body);
    }

    // Info overlay
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 180, 30, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `t = ${time.toFixed(1)}s | ${bodies.length} bodies | G = ${G.toFixed(1)}`,
      20,
      30
    );
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    createDefaultBodies();
    computeAccelerations();
  }

  function destroy(): void {
    bodies = [];
  }

  function getStateDescription(): string {
    const bodyDescs = bodies.map((b) => {
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      return `${b.label} (mass=${b.mass}, pos=(${b.x.toFixed(0)}, ${b.y.toFixed(0)}), speed=${speed.toFixed(1)})`;
    });
    return (
      `Gravity Orbits: ${bodies.length} bodies, G=${G}, time=${time.toFixed(1)}s. ` +
      `Bodies: ${bodyDescs.join("; ")}`
    );
  }

  function resize(w: number, h: number): void {
    // Recenter bodies if the canvas size changed significantly
    const dx = (w - width) / 2;
    const dy = (h - height) / 2;
    for (const body of bodies) {
      body.x += dx;
      body.y += dy;
      for (const point of body.trail) {
        point.x += dx;
        point.y += dy;
      }
    }
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default GravityOrbitsFactory;
