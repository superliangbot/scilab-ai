import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "fireworks",
  title: "Fireworks",
  category: "physics",
  description:
    "Fireworks physics with metal-salt flame colors — see how different elements create colorful bursts.",
  longDescription:
    "Fireworks get their colors from metal salts. When heated, electrons jump to higher energy levels and emit photons at characteristic wavelengths as they fall back: sodium (Na) → yellow, strontium (Sr) → red, barium (Ba) → green, copper (Cu) → blue. This simulation launches rockets that burst into particles with colors matching real pyrotechnic chemistry, following projectile motion under gravity.",
  parameters: [
    { key: "launchRate", label: "Launch Rate", min: 0.5, max: 5, step: 0.5, defaultValue: 2, unit: "/s" },
    { key: "gravity", label: "Gravity", min: 2, max: 15, step: 0.5, defaultValue: 9.81, unit: "m/s²" },
    { key: "burstSize", label: "Burst Size", min: 20, max: 100, step: 5, defaultValue: 50 },
    { key: "trailLength", label: "Trail Length", min: 0, max: 1, step: 0.1, defaultValue: 0.5 },
  ],
  thumbnailColor: "#1e1b4b",
};

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  trail: { x: number; y: number }[];
}

interface Rocket {
  x: number; y: number;
  vx: number; vy: number;
  fuseTime: number;
  element: string;
  color: string;
  trail: { x: number; y: number }[];
}

const ELEMENTS: { name: string; color: string; glow: string }[] = [
  { name: "Na (Sodium)", color: "#fbbf24", glow: "rgba(251,191,36,0.4)" },
  { name: "Sr (Strontium)", color: "#ef4444", glow: "rgba(239,68,68,0.4)" },
  { name: "Ba (Barium)", color: "#22c55e", glow: "rgba(34,197,94,0.4)" },
  { name: "Cu (Copper)", color: "#3b82f6", glow: "rgba(59,130,246,0.4)" },
  { name: "K (Potassium)", color: "#c084fc", glow: "rgba(192,132,252,0.4)" },
  { name: "Ca (Calcium)", color: "#f97316", glow: "rgba(249,115,22,0.4)" },
  { name: "Cs (Cesium)", color: "#ec4899", glow: "rgba(236,72,153,0.4)" },
];

const FireworksFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let launchRate = 2;
  let gravity = 9.81;
  let burstSize = 50;
  let trailLength = 0.5;

  let rockets: Rocket[] = [];
  let particles: Particle[] = [];
  let timeSinceLaunch = 0;
  let activeElements: string[] = [];

  function launchRocket() {
    const elem = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    rockets.push({
      x: W * (0.2 + Math.random() * 0.6),
      y: H,
      vx: (Math.random() - 0.5) * 40,
      vy: -(200 + Math.random() * 150),
      fuseTime: 0.8 + Math.random() * 0.6,
      element: elem.name,
      color: elem.color,
      trail: [],
    });
  }

  function burst(rocket: Rocket) {
    const elem = ELEMENTS.find(e => e.name === rocket.element)!;
    const count = burstSize;
    activeElements.push(rocket.element);
    if (activeElements.length > 5) activeElements.shift();

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 60 + Math.random() * 80;
      particles.push({
        x: rocket.x,
        y: rocket.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: elem.color,
        life: 1.5 + Math.random() * 1,
        maxLife: 2.5,
        size: 2 + Math.random() * 2,
        trail: [],
      });
    }

    // Inner burst with slight color variation
    for (let i = 0; i < count / 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 40;
      particles.push({
        x: rocket.x,
        y: rocket.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: "#fff",
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 1.5,
        trail: [],
      });
    }
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    launchRate = params.launchRate ?? 2;
    gravity = params.gravity ?? 9.81;
    burstSize = params.burstSize ?? 50;
    trailLength = params.trailLength ?? 0.5;
    time += dt;

    timeSinceLaunch += dt;
    if (timeSinceLaunch > 1 / launchRate) {
      launchRocket();
      timeSinceLaunch = 0;
    }

    // Update rockets
    const gScale = gravity * 10;
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 10) r.trail.shift();
      r.x += r.vx * dt;
      r.vy += gScale * dt * 0.3;
      r.y += r.vy * dt;
      r.fuseTime -= dt;

      if (r.fuseTime <= 0 || r.vy > 0) {
        burst(r);
        rockets.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.trail.push({ x: p.x, y: p.y });
      const maxTrail = Math.floor(trailLength * 15) + 1;
      if (p.trail.length > maxTrail) p.trail.shift();
      p.vx *= 0.98;
      p.vy += gScale * dt * 0.5;
      p.vy *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0 || p.y > H + 20) {
        particles.splice(i, 1);
      }
    }
  }

  function render() {
    // Fade effect for trails
    ctx.fillStyle = "rgba(5,5,20,0.25)";
    ctx.fillRect(0, 0, W, H);

    // Stars
    if (time < 0.1) {
      ctx.fillStyle = "rgba(5,5,20,1)";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`;
        ctx.fillRect(Math.random() * W, Math.random() * H * 0.7, 1.5, 1.5);
      }
    }

    // Ground
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, H - 30, W, 30);

    // City silhouette
    ctx.fillStyle = "#111128";
    const buildings = [0.05, 0.12, 0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.84, 0.92];
    for (const bx of buildings) {
      const bh = 30 + Math.sin(bx * 47) * 40 + 20;
      const bw = W * 0.06;
      ctx.fillRect(bx * W - bw / 2, H - 30 - bh, bw, bh);
    }

    // Draw rockets
    for (const r of rockets) {
      // Trail
      for (let j = 0; j < r.trail.length; j++) {
        const alpha = j / r.trail.length;
        ctx.fillStyle = `rgba(255,200,100,${alpha * 0.6})`;
        ctx.fillRect(r.trail[j].x - 1, r.trail[j].y - 1, 2, 2);
      }
      // Head
      ctx.fillStyle = "#fff";
      ctx.fillRect(r.x - 1.5, r.y - 3, 3, 6);
    }

    // Draw particles
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      // Trail
      for (let j = 0; j < p.trail.length; j++) {
        const ta = (j / p.trail.length) * alpha * 0.4;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = ta;
        ctx.fillRect(p.trail[j].x - p.size / 2, p.trail[j].y - p.size / 2, p.size, p.size);
      }
      // Particle
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Glow
      if (alpha > 0.3) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", ",0.1)").replace("rgb", "rgba");
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Fireworks — Metal-Salt Emission Colors", W / 2, 24);

    // Legend
    ctx.textAlign = "left";
    ctx.font = "11px sans-serif";
    const lx = 10, ly = 44;
    for (let i = 0; i < ELEMENTS.length; i++) {
      ctx.fillStyle = ELEMENTS[i].color;
      ctx.fillRect(lx, ly + i * 16, 10, 10);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(ELEMENTS[i].name, lx + 16, ly + i * 16 + 9);
    }
  }

  function reset() {
    time = 0;
    rockets = [];
    particles = [];
    timeSinceLaunch = 0;
    activeElements = [];
    ctx.fillStyle = "#050514";
    ctx.fillRect(0, 0, W, H);
  }

  function destroy() {}

  function getStateDescription(): string {
    return `Fireworks simulation with ${rockets.length} rockets in flight and ${particles.length} burst particles. Launch rate: ${launchRate}/s, gravity: ${gravity} m/s². Active elements: ${activeElements.length > 0 ? activeElements.join(", ") : "none yet"}. Colors come from metal salts: Na→yellow, Sr→red, Ba→green, Cu→blue, K→purple, Ca→orange.`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FireworksFactory;
