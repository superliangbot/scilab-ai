import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  highlighted: boolean;
}

const GasModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gas-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let numParticles = 50;
  let temperature = 300;
  let wallGap = 0; // 0=closed, >0 = gap in middle wall for diffusion
  let trackedParticle = 1; // whether to highlight one particle

  const particles: Particle[] = [];
  let totalKE = 0;
  let collisionCount = 0;
  let meanFreePath = 0;

  // Tracked particle trail
  const trail: Array<{ x: number; y: number }> = [];
  const MAX_TRAIL = 500;

  // Collision rate history
  const collisionHistory: Array<{ t: number; rate: number }> = [];
  let lastCollisionCheck = 0;
  let intervalCollisions = 0;

  function containerBounds() {
    return {
      x: W * 0.05,
      y: H * 0.08,
      w: W * 0.55,
      h: H * 0.6,
    };
  }

  function initParticles(): void {
    particles.length = 0;
    trail.length = 0;
    const cb = containerBounds();
    const baseSpeed = Math.sqrt(temperature) * 0.7;

    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.3 + Math.random() * 1.4);
      particles.push({
        x: cb.x + 10 + Math.random() * (cb.w - 20),
        y: cb.y + 10 + Math.random() * (cb.h - 20),
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        radius: 4,
        highlighted: i === 0,
      });
    }
  }

  function reset(): void {
    time = 0;
    totalKE = 0;
    collisionCount = 0;
    meanFreePath = 0;
    collisionHistory.length = 0;
    lastCollisionCheck = 0;
    intervalCollisions = 0;
    initParticles();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newN = Math.round(params.numParticles ?? 50);
    const newT = params.temperature ?? 300;
    const newGap = params.wallGap ?? 0;
    const newTrack = params.trackedParticle ?? 1;

    if (newN !== numParticles) {
      numParticles = newN;
      reset();
      return;
    }

    if (newT !== temperature) {
      const ratio = Math.sqrt(newT / Math.max(temperature, 1));
      for (const p of particles) {
        p.vx *= ratio;
        p.vy *= ratio;
      }
      temperature = newT;
    }
    wallGap = newGap;
    trackedParticle = newTrack;

    time += dt;

    const cb = containerBounds();
    let frameCollisions = 0;
    totalKE = 0;

    // Update particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wall collisions
      if (p.x - p.radius < cb.x) { p.x = cb.x + p.radius; p.vx = Math.abs(p.vx); }
      if (p.x + p.radius > cb.x + cb.w) { p.x = cb.x + cb.w - p.radius; p.vx = -Math.abs(p.vx); }
      if (p.y - p.radius < cb.y) { p.y = cb.y + p.radius; p.vy = Math.abs(p.vy); }
      if (p.y + p.radius > cb.y + cb.h) { p.y = cb.y + cb.h - p.radius; p.vy = -Math.abs(p.vy); }

      // Middle wall (if gap is not full opening)
      if (wallGap < 90) {
        const wallX = cb.x + cb.w / 2;
        const gapSize = (wallGap / 100) * cb.h;
        const gapTop = cb.y + (cb.h - gapSize) / 2;
        const gapBottom = gapTop + gapSize;

        if (Math.abs(p.x - wallX) < p.radius + 2) {
          if (p.y < gapTop || p.y > gapBottom) {
            if (p.x < wallX) {
              p.x = wallX - p.radius - 2;
              p.vx = -Math.abs(p.vx);
            } else {
              p.x = wallX + p.radius + 2;
              p.vx = Math.abs(p.vx);
            }
          }
        }
      }

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      totalKE += 0.5 * speed * speed;
    }

    // Particle-particle collisions
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;

          if (dvn > 0) {
            a.vx -= dvn * nx;
            a.vy -= dvn * ny;
            b.vx += dvn * nx;
            b.vy += dvn * ny;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            frameCollisions++;
          }
        }
      }
    }

    collisionCount += frameCollisions;
    intervalCollisions += frameCollisions;

    // Track highlighted particle
    if (trackedParticle >= 0.5 && particles.length > 0) {
      trail.push({ x: particles[0].x, y: particles[0].y });
      if (trail.length > MAX_TRAIL) trail.shift();
    }

    // Collision rate
    if (time - lastCollisionCheck > 0.3) {
      const rate = intervalCollisions / (time - lastCollisionCheck);
      collisionHistory.push({ t: time, rate });
      if (collisionHistory.length > 100) collisionHistory.shift();
      intervalCollisions = 0;
      lastCollisionCheck = time;
    }

    // Mean free path estimate
    const density = numParticles / (cb.w * cb.h);
    const sigma = 2 * 4; // 2 * particle radius
    meanFreePath = 1 / (Math.sqrt(2) * Math.PI * sigma * density + 0.001);
  }

  function drawContainer(): void {
    const cb = containerBounds();

    ctx.fillStyle = "rgba(15, 25, 40, 0.7)";
    ctx.strokeStyle = "#546e7a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cb.x, cb.y, cb.w, cb.h);
    ctx.fill();
    ctx.stroke();

    // Middle wall with gap
    if (wallGap < 90) {
      const wallX = cb.x + cb.w / 2;
      const gapSize = (wallGap / 100) * cb.h;
      const gapTop = cb.y + (cb.h - gapSize) / 2;
      const gapBottom = gapTop + gapSize;

      ctx.strokeStyle = "#78909c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wallX, cb.y);
      ctx.lineTo(wallX, gapTop);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wallX, gapBottom);
      ctx.lineTo(wallX, cb.y + cb.h);
      ctx.stroke();

      if (wallGap > 0) {
        ctx.fillStyle = "rgba(76, 175, 80, 0.2)";
        ctx.fillRect(wallX - 3, gapTop, 6, gapSize);
      }
    }
  }

  function drawParticles(): void {
    const cb = containerBounds();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cb.x, cb.y, cb.w, cb.h);
    ctx.clip();

    // Trail for tracked particle
    if (trackedParticle >= 0.5 && trail.length > 1) {
      ctx.strokeStyle = "rgba(255, 152, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        if (i === 0) ctx.moveTo(trail[i].x, trail[i].y);
        else ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
    }

    for (const p of particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSpeed = Math.sqrt(temperature) * 2;
      const frac = Math.min(speed / maxSpeed, 1);

      if (p.highlighted && trackedParticle >= 0.5) {
        // Highlighted particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 152, 0, 0.2)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 1, 0, Math.PI * 2);
        ctx.fillStyle = "#ff9800";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        const hue = 220 - frac * 160;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawCollisionGraph(): void {
    const gx = W * 0.63;
    const gy = H * 0.08;
    const gw = W * 0.34;
    const gh = H * 0.28;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Collision Rate", gx + gw / 2, gy + 14);

    if (collisionHistory.length < 2) return;

    const px = gx + 30;
    const py = gy + 25;
    const pw = gw - 45;
    const ph = gh - 40;

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    const maxRate = Math.max(...collisionHistory.map((d) => d.rate), 1);
    const tMin = collisionHistory[0].t;
    const tMax = collisionHistory[collisionHistory.length - 1].t;
    const tRange = Math.max(tMax - tMin, 1);

    ctx.strokeStyle = "#42a5f5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < collisionHistory.length; i++) {
      const x = px + ((collisionHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph - (collisionHistory[i].rate / maxRate) * ph;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawInfo(): void {
    const px = W * 0.63;
    const py = H * 0.4;
    const pw = W * 0.34;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, H * 0.32, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Gas Model Statistics", px + 10, py + 16);

    ctx.font = "11px monospace";
    let y = py + 35;
    const items = [
      { label: "Particles", value: `${numParticles}`, color: "#42a5f5" },
      { label: "Temperature", value: `${temperature} K`, color: "#ef5350" },
      { label: "Total KE", value: `${totalKE.toFixed(0)}`, color: "#66bb6a" },
      { label: "Avg KE/particle", value: `${(totalKE / Math.max(numParticles, 1)).toFixed(1)}`, color: "#ffa726" },
      { label: "Collisions", value: `${collisionCount}`, color: "#ab47bc" },
      { label: "Mean free path", value: `${meanFreePath.toFixed(1)} px`, color: "#78909c" },
    ];

    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillText(item.label + ":", px + 10, y);
      ctx.fillStyle = "#fff";
      ctx.fillText(item.value, px + 140, y);
      y += 18;
    }

    y += 8;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.fillText("KE ∝ T (Kinetic Molecular Theory)", px + 10, y);
    y += 14;
    ctx.fillText("λ = 1/(√2·π·d²·n/V)", px + 10, y);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0e27");
    grad.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Kinetic Gas Model", W / 2, H - 15);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("Elastic collisions • Random motion • Temperature ∝ Kinetic Energy", W / 2, H - 2);

    drawContainer();
    drawParticles();
    drawCollisionGraph();
    drawInfo();
  }

  function destroy(): void {
    particles.length = 0;
    trail.length = 0;
    collisionHistory.length = 0;
  }

  function getStateDescription(): string {
    const avgKE = totalKE / Math.max(numParticles, 1);
    return (
      `Kinetic Gas Model: ${numParticles} particles at T=${temperature}K. ` +
      `Total KE=${totalKE.toFixed(0)}, avg KE/particle=${avgKE.toFixed(1)}. ` +
      `Total collisions: ${collisionCount}. Mean free path: ${meanFreePath.toFixed(1)}px. ` +
      `Wall gap: ${wallGap}%. ` +
      `Demonstrates kinetic molecular theory: particles in constant random motion, ` +
      `elastic collisions, temperature proportional to average kinetic energy.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GasModelFactory;
