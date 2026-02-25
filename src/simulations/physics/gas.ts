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
  mass: number;
  radius: number;
  color: string;
}

const GasFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gas") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let numParticles = 80;
  let temperature = 300;
  let containerWidth = 80;
  let showVectors = 0;

  const particles: Particle[] = [];
  let pressure = 0;
  let wallCollisions = 0;
  let collisionTimer = 0;
  const kB = 1.38e-23;

  // Speed distribution histogram
  const speedBins: number[] = new Array(20).fill(0);
  let avgSpeed = 0;
  let rmsSpeed = 0;

  function containerBounds() {
    const cw = (containerWidth / 100) * W * 0.5;
    const ch = H * 0.55;
    const cx = W * 0.05;
    const cy = H * 0.08;
    return { x: cx, y: cy, w: cw, h: ch };
  }

  function initParticles(): void {
    particles.length = 0;
    const cb = containerBounds();
    const speed = Math.sqrt((3 * kB * temperature) / (4.65e-26)) * 0.00002; // scaled for display

    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const s = speed * (0.5 + Math.random());
      particles.push({
        x: cb.x + 15 + Math.random() * (cb.w - 30),
        y: cb.y + 15 + Math.random() * (cb.h - 30),
        vx: s * Math.cos(angle),
        vy: s * Math.sin(angle),
        mass: 1,
        radius: 3,
        color: `hsl(${200 + Math.random() * 40}, 70%, 60%)`,
      });
    }
  }

  function reset(): void {
    time = 0;
    wallCollisions = 0;
    collisionTimer = 0;
    pressure = 0;
    speedBins.fill(0);
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
    const newN = Math.round(params.numParticles ?? 80);
    const newT = params.temperature ?? 300;
    const newCW = params.containerWidth ?? 80;
    const newSV = params.showVectors ?? 0;

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
    containerWidth = newCW;
    showVectors = newSV;

    time += dt;
    collisionTimer += dt;

    const cb = containerBounds();
    let frameCollisions = 0;

    // Update particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Wall collisions
      if (p.x - p.radius < cb.x) {
        p.x = cb.x + p.radius;
        p.vx = Math.abs(p.vx);
        frameCollisions++;
      }
      if (p.x + p.radius > cb.x + cb.w) {
        p.x = cb.x + cb.w - p.radius;
        p.vx = -Math.abs(p.vx);
        frameCollisions++;
      }
      if (p.y - p.radius < cb.y) {
        p.y = cb.y + p.radius;
        p.vy = Math.abs(p.vy);
        frameCollisions++;
      }
      if (p.y + p.radius > cb.y + cb.h) {
        p.y = cb.y + cb.h - p.radius;
        p.vy = -Math.abs(p.vy);
        frameCollisions++;
      }
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
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dvn = dvx * nx + dvy * ny;

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
          }
        }
      }
    }

    wallCollisions += frameCollisions;

    // Calculate pressure: P = F/A, F = momentum transfer rate
    if (collisionTimer > 0.5) {
      const perimeter = 2 * (cb.w + cb.h);
      pressure = (wallCollisions * avgSpeed * 0.1) / (perimeter * collisionTimer);
      wallCollisions = 0;
      collisionTimer = 0;
    }

    // Speed distribution
    speedBins.fill(0);
    let totalSpeed = 0;
    let totalSpeedSq = 0;
    const maxSpeedBin = 500;

    for (const p of particles) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      totalSpeed += speed;
      totalSpeedSq += speed * speed;
      const binIdx = Math.min(19, Math.floor((speed / maxSpeedBin) * 20));
      speedBins[binIdx]++;
    }
    avgSpeed = totalSpeed / Math.max(particles.length, 1);
    rmsSpeed = Math.sqrt(totalSpeedSq / Math.max(particles.length, 1));
  }

  function drawContainer(): void {
    const cb = containerBounds();

    // Container walls
    ctx.strokeStyle = "#78909c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(cb.x, cb.y, cb.w, cb.h);
    ctx.stroke();

    // Piston (right wall) - movable
    const pistonX = cb.x + cb.w;
    ctx.fillStyle = "#546e7a";
    ctx.fillRect(pistonX - 6, cb.y, 12, cb.h);

    // Hatch pattern on piston
    ctx.strokeStyle = "#37474f";
    ctx.lineWidth = 1;
    for (let i = 0; i < cb.h; i += 8) {
      ctx.beginPath();
      ctx.moveTo(pistonX - 6, cb.y + i);
      ctx.lineTo(pistonX + 6, cb.y + i + 8);
      ctx.stroke();
    }
  }

  function drawParticles(): void {
    const cb = containerBounds();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cb.x, cb.y, cb.w, cb.h);
    ctx.clip();

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      if (showVectors >= 0.5) {
        const scale = 0.05;
        ctx.strokeStyle = "rgba(255,100,100,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * scale, p.y + p.vy * scale);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawSpeedDistribution(): void {
    const gx = W * 0.58;
    const gy = H * 0.08;
    const gw = W * 0.38;
    const gh = H * 0.35;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Speed Distribution", gx + gw / 2, gy + 6);

    const px = gx + 35;
    const py = gy + 28;
    const pw = gw - 50;
    const ph = gh - 45;
    const maxBin = Math.max(...speedBins, 1);
    const barW = pw / speedBins.length;

    // Bars
    for (let i = 0; i < speedBins.length; i++) {
      const barH = (speedBins[i] / maxBin) * ph;
      const hue = 200 + (i / speedBins.length) * 60;
      ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.7)`;
      ctx.fillRect(px + i * barW, py + ph - barH, barW - 1, barH);
    }

    // Maxwell-Boltzmann theoretical curve
    const scaledTemp = temperature * 0.001;
    ctx.strokeStyle = "#ffa726";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < speedBins.length; i++) {
      const v = ((i + 0.5) / speedBins.length) * 500;
      const fv = v * Math.exp(-(v * v) / (2 * scaledTemp * 50000));
      const normalizedFv = (fv / (scaledTemp * 150)) * ph * numParticles * 0.08;
      const y = py + ph - Math.min(normalizedFv, ph);
      if (i === 0) ctx.moveTo(px + (i + 0.5) * barW, y);
      else ctx.lineTo(px + (i + 0.5) * barW, y);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Speed", px + pw / 2, py + ph + 12);
  }

  function drawInfo(): void {
    const px = W * 0.58;
    const py = H * 0.5;
    const pw = W * 0.38;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, H * 0.42, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Gas Properties", px + 10, py + 8);

    ctx.font = "12px monospace";
    const items = [
      { label: "Particles", value: `${numParticles}`, color: "#42a5f5" },
      { label: "Temperature", value: `${temperature} K`, color: "#ef5350" },
      { label: "Avg Speed", value: `${avgSpeed.toFixed(1)} u`, color: "#66bb6a" },
      { label: "RMS Speed", value: `${rmsSpeed.toFixed(1)} u`, color: "#ab47bc" },
      { label: "Pressure", value: `${pressure.toFixed(2)} u`, color: "#ffa726" },
      { label: "Container", value: `${containerWidth}%`, color: "#78909c" },
    ];

    let y = py + 30;
    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillText(`${item.label}:`, px + 10, y);
      ctx.fillStyle = "#fff";
      ctx.fillText(item.value, px + 130, y);
      y += 20;
    }

    y += 10;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px sans-serif";
    ctx.fillText("Kinetic Theory of Gases:", px + 10, y);
    y += 16;
    ctx.font = "10px monospace";
    ctx.fillText("PV = NkT", px + 10, y);
    y += 14;
    ctx.fillText("KE = ³⁄₂ kT", px + 10, y);
    y += 14;
    ctx.fillText("v_rms = √(3kT/m)", px + 10, y);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1b2838");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Ideal Gas Simulation", W / 2, H - 30);

    drawContainer();
    drawParticles();
    drawSpeedDistribution();
    drawInfo();
  }

  function destroy(): void {
    particles.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Ideal Gas Simulation: ${numParticles} particles at T=${temperature} K. ` +
      `Container width: ${containerWidth}%. ` +
      `Average speed: ${avgSpeed.toFixed(1)}, RMS speed: ${rmsSpeed.toFixed(1)}. ` +
      `Relative pressure: ${pressure.toFixed(2)}. ` +
      `Demonstrates kinetic molecular theory: PV=NkT, particles move randomly, ` +
      `collide elastically, and speed distribution follows Maxwell-Boltzmann.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GasFactory;
