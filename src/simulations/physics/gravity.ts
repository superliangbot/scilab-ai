import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
  name: string;
  fixed: boolean;
}

const GravityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gravity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let G = 500; // Gravitational constant (scaled for visual)
  let mass1 = 100;
  let mass2 = 50;
  let initialDistance = 200;
  let showForceVectors = 1;

  const MAX_TRAIL = 500;
  let bodies: Body[] = [];
  let gravitationalPE = 0;
  let totalKE = 0;

  // Force/energy history
  const energyHistory: Array<{ t: number; ke: number; pe: number; total: number }> = [];

  function initBodies(): void {
    const cx = W * 0.4;
    const cy = H * 0.45;

    // Set up two bodies in a binary orbit
    const totalMass = mass1 + mass2;
    const d = initialDistance;

    // Position bodies relative to center of mass
    const x1 = cx - (mass2 / totalMass) * d;
    const x2 = cx + (mass1 / totalMass) * d;

    // Orbital velocity for circular orbit
    const orbitalV = Math.sqrt(G * totalMass / d) * 0.5;
    const v1 = orbitalV * (mass2 / totalMass);
    const v2 = orbitalV * (mass1 / totalMass);

    bodies = [
      {
        x: x1, y: cy, vx: 0, vy: v1,
        mass: mass1, radius: Math.max(8, Math.sqrt(mass1) * 1.5),
        color: "#42a5f5", trail: [], name: "Body 1", fixed: false,
      },
      {
        x: x2, y: cy, vx: 0, vy: -v2,
        mass: mass2, radius: Math.max(6, Math.sqrt(mass2) * 1.5),
        color: "#ef5350", trail: [], name: "Body 2", fixed: false,
      },
    ];
  }

  function reset(): void {
    time = 0;
    energyHistory.length = 0;
    initBodies();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newG = params.G ?? 500;
    const newM1 = params.mass1 ?? 100;
    const newM2 = params.mass2 ?? 50;
    const newD = params.initialDistance ?? 200;
    const newSF = params.showForceVectors ?? 1;

    if (newG !== G || newM1 !== mass1 || newM2 !== mass2 || newD !== initialDistance) {
      G = newG;
      mass1 = newM1;
      mass2 = newM2;
      initialDistance = newD;
      reset();
      return;
    }
    showForceVectors = newSF;

    time += dt;

    const a = bodies[0];
    const b = bodies[1];

    // Calculate gravitational force
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = a.radius + b.radius;

    if (dist > minDist) {
      const force = (G * a.mass * b.mass) / (dist * dist);
      const fx = force * (dx / dist);
      const fy = force * (dy / dist);

      // Apply forces (F = ma → a = F/m)
      a.vx += (fx / a.mass) * dt;
      a.vy += (fy / a.mass) * dt;
      b.vx -= (fx / b.mass) * dt;
      b.vy -= (fy / b.mass) * dt;
    } else {
      // Elastic collision
      const nx = dx / Math.max(dist, 0.01);
      const ny = dy / Math.max(dist, 0.01);
      const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (dvn > 0) {
        const mSum = a.mass + b.mass;
        a.vx -= (2 * b.mass / mSum) * dvn * nx;
        a.vy -= (2 * b.mass / mSum) * dvn * ny;
        b.vx += (2 * a.mass / mSum) * dvn * nx;
        b.vy += (2 * a.mass / mSum) * dvn * ny;
      }
    }

    // Update positions
    for (const body of bodies) {
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.trail.push({ x: body.x, y: body.y });
      if (body.trail.length > MAX_TRAIL) body.trail.shift();
    }

    // Calculate energies
    const va = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
    const vb = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    totalKE = 0.5 * a.mass * va * va + 0.5 * b.mass * vb * vb;
    gravitationalPE = -(G * a.mass * b.mass) / Math.max(dist, 1);
    const totalEnergy = totalKE + gravitationalPE;

    if (energyHistory.length === 0 || time - energyHistory[energyHistory.length - 1].t > 0.1) {
      energyHistory.push({ t: time, ke: totalKE, pe: gravitationalPE, total: totalEnergy });
      if (energyHistory.length > 200) energyHistory.shift();
    }
  }

  function drawBackground(): void {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, W, H);

    const rng = (s: number) => {
      let v = s;
      return () => { v = (v * 16807) % 2147483647; return v / 2147483647; };
    };
    const rand = rng(42);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, rand() * 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBodies(): void {
    for (const body of bodies) {
      // Trail
      if (body.trail.length > 1) {
        for (let i = 1; i < body.trail.length; i++) {
          const alpha = (i / body.trail.length) * 0.5;
          ctx.strokeStyle = body.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(body.trail[i - 1].x, body.trail[i - 1].y);
          ctx.lineTo(body.trail[i].x, body.trail[i].y);
          ctx.stroke();
        }
      }

      // Body
      const grad = ctx.createRadialGradient(
        body.x - body.radius * 0.3, body.y - body.radius * 0.3, body.radius * 0.2,
        body.x, body.y, body.radius
      );
      grad.addColorStop(0, lighten(body.color, 40));
      grad.addColorStop(1, body.color);
      ctx.beginPath();
      ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = body.color;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${body.name} (m=${body.mass})`, body.x, body.y - body.radius - 8);
    }

    // Force vectors
    if (showForceVectors >= 0.5 && bodies.length === 2) {
      const a = bodies[0];
      const b = bodies[1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const force = (G * a.mass * b.mass) / (dist * dist);
        const scale = Math.min(60, force * 0.001);
        const nx = dx / dist;
        const ny = dy / dist;

        // Force on body 1 (toward body 2)
        drawArrow(a.x, a.y, a.x + nx * scale, a.y + ny * scale, "#ffa726", 2);
        // Force on body 2 (toward body 1)
        drawArrow(b.x, b.y, b.x - nx * scale, b.y - ny * scale, "#ffa726", 2);

        // Force label
        ctx.fillStyle = "#ffa726";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`F = ${force.toFixed(1)}`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 15);

        // Distance line
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(`r = ${dist.toFixed(0)}`, (a.x + b.x) / 2, (a.y + b.y) / 2 + 8);
      }
    }
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(dy, dx);
    const headLen = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function lighten(hex: string, amount: number): string {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `rgb(${r},${g},${b})`;
  }

  function drawEnergyGraph(): void {
    const gx = W * 0.62;
    const gy = 15;
    const gw = W * 0.35;
    const gh = H * 0.35;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy Conservation", gx + gw / 2, gy + 14);

    if (energyHistory.length < 2) return;

    const px = gx + 35;
    const py = gy + 28;
    const pw = gw - 50;
    const ph = gh - 45;

    const allE = energyHistory.flatMap((d) => [d.ke, d.pe, d.total]);
    const eMax = Math.max(...allE) * 1.1;
    const eMin = Math.min(...allE) * 1.1;
    const eRange = Math.max(eMax - eMin, 1);

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    const tMin = energyHistory[0].t;
    const tMax = energyHistory[energyHistory.length - 1].t;
    const tRange = Math.max(tMax - tMin, 1);

    function drawLine(data: number[], color: string): void {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = px + ((energyHistory[i].t - tMin) / tRange) * pw;
        const y = py + ph - ((data[i] - eMin) / eRange) * ph;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    drawLine(energyHistory.map((d) => d.ke), "#ef5350");
    drawLine(energyHistory.map((d) => d.pe), "#42a5f5");
    drawLine(energyHistory.map((d) => d.total), "#fff");

    // Legend
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ef5350";
    ctx.fillText("KE", px + 5, py + 10);
    ctx.fillStyle = "#42a5f5";
    ctx.fillText("PE", px + 30, py + 10);
    ctx.fillStyle = "#fff";
    ctx.fillText("Total", px + 55, py + 10);
  }

  function drawInfo(): void {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 220, 120, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Newton's Gravity", 20, 28);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#ffa726";
    ctx.fillText("F = G·m₁·m₂/r²", 20, 48);
    ctx.fillStyle = "#ccc";
    ctx.font = "11px monospace";
    ctx.fillText(`G = ${G}`, 20, 66);
    ctx.fillText(`KE = ${totalKE.toFixed(0)}`, 20, 82);
    ctx.fillText(`PE = ${gravitationalPE.toFixed(0)}`, 20, 98);
    ctx.fillText(`Total = ${(totalKE + gravitationalPE).toFixed(0)}`, 20, 114);
  }

  function render(): void {
    drawBackground();
    drawBodies();
    drawEnergyGraph();
    drawInfo();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Gravitational Attraction — Newton's Law of Universal Gravitation", W / 2, H - 10);
  }

  function destroy(): void {
    bodies = [];
    energyHistory.length = 0;
  }

  function getStateDescription(): string {
    const a = bodies[0];
    const b = bodies[1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const force = (G * a.mass * b.mass) / (dist * dist + 1);
    return (
      `Gravitational Attraction: G=${G}, m₁=${a.mass}, m₂=${b.mass}. ` +
      `Distance: ${dist.toFixed(0)}. Force: ${force.toFixed(1)}. ` +
      `KE=${totalKE.toFixed(0)}, PE=${gravitationalPE.toFixed(0)}, Total=${(totalKE + gravitationalPE).toFixed(0)}. ` +
      `Newton's Law: F = G·m₁·m₂/r². ` +
      `Energy is conserved: KE + PE = constant. ` +
      `Bodies orbit their common center of mass.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GravityFactory;
