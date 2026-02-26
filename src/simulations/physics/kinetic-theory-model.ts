import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const KineticTheoryModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("kinetic-theory-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 300; // K
  let particleCount = 40;
  let pistonY = 0; // y position of piston (top wall)
  let showGraph = 1;

  let particles: Particle[] = [];
  let pressure = 0; // measured from collisions
  let wallHits = 0;
  let wallHitTimer = 0;

  // Container
  let containerLeft = 0;
  let containerRight = 0;
  let containerBottom = 0;

  // Volume history for graph
  let volumeHistory: number[] = [];
  let pressureHistory: number[] = [];
  const historyLen = 200;

  function initParticles() {
    particles = [];
    const speed = Math.sqrt(temperature) * 2;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: containerLeft + 20 + Math.random() * (containerRight - containerLeft - 40),
        y: pistonY + 20 + Math.random() * (containerBottom - pistonY - 40),
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        radius: 4,
      });
    }
  }

  function updateBounds() {
    containerLeft = width * 0.15;
    containerRight = width * 0.65;
    containerBottom = height * 0.85;
    if (pistonY < height * 0.12) pistonY = height * 0.12;
    if (pistonY > containerBottom - 40) pistonY = containerBottom - 40;
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      pistonY = height * 0.2;
      updateBounds();
      initParticles();
    },
    update(dt: number, params: Record<string, number>) {
      const newTemp = params.temperature ?? 300;
      const newCount = Math.round(params.particleCount ?? 40);
      const pistonPos = params.pistonPosition ?? 30;
      showGraph = params.showGraph ?? 1;

      // Piston position from parameter (0=top, 100=bottom)
      const newPistonY = height * 0.12 + (pistonPos / 100) * (containerBottom - height * 0.12 - 50);

      if (newCount !== particleCount) {
        particleCount = newCount;
        pistonY = newPistonY;
        updateBounds();
        initParticles();
      }

      // Adjust speed if temperature changed
      if (Math.abs(newTemp - temperature) > 1) {
        const ratio = Math.sqrt(newTemp / Math.max(temperature, 1));
        for (const p of particles) {
          p.vx *= ratio;
          p.vy *= ratio;
        }
        temperature = newTemp;
      }

      pistonY = newPistonY;
      updateBounds();

      const dtc = Math.min(dt, 0.03);
      time += dtc;
      wallHitTimer += dtc;

      let hits = 0;
      const containerW = containerRight - containerLeft;
      const containerH = containerBottom - pistonY;

      for (const p of particles) {
        p.x += p.vx * dtc;
        p.y += p.vy * dtc;

        // Wall collisions
        if (p.x - p.radius < containerLeft) {
          p.x = containerLeft + p.radius;
          p.vx = Math.abs(p.vx);
          hits++;
        }
        if (p.x + p.radius > containerRight) {
          p.x = containerRight - p.radius;
          p.vx = -Math.abs(p.vx);
          hits++;
        }
        if (p.y - p.radius < pistonY) {
          p.y = pistonY + p.radius;
          p.vy = Math.abs(p.vy);
          hits++;
        }
        if (p.y + p.radius > containerBottom) {
          p.y = containerBottom - p.radius;
          p.vy = -Math.abs(p.vy);
          hits++;
        }

        // Particle-particle collisions
        for (const q of particles) {
          if (p === q) continue;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = p.radius + q.radius;
          if (dist < minDist && dist > 0) {
            // Elastic collision
            const nx = dx / dist;
            const ny = dy / dist;
            const dvx = p.vx - q.vx;
            const dvy = p.vy - q.vy;
            const dvn = dvx * nx + dvy * ny;
            if (dvn > 0) {
              p.vx -= dvn * nx;
              p.vy -= dvn * ny;
              q.vx += dvn * nx;
              q.vy += dvn * ny;
            }
            // Separate
            const overlap = minDist - dist;
            p.x -= nx * overlap * 0.5;
            p.y -= ny * overlap * 0.5;
            q.x += nx * overlap * 0.5;
            q.y += ny * overlap * 0.5;
          }
        }
      }

      wallHits += hits;
      if (wallHitTimer > 0.1) {
        pressure = wallHits / wallHitTimer / (2 * (containerW + containerH));
        wallHits = 0;
        wallHitTimer = 0;
      }

      // Record history
      const volume = containerW * containerH;
      volumeHistory.push(volume);
      pressureHistory.push(pressure);
      if (volumeHistory.length > historyLen) { volumeHistory.shift(); pressureHistory.shift(); }
    },
    render() {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#1e293b";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Kinetic Theory of Gases", width / 2, 24);

      // Container
      ctx.fillStyle = "#e0f2fe";
      ctx.fillRect(containerLeft, pistonY, containerRight - containerLeft, containerBottom - pistonY);
      ctx.strokeStyle = "#0369a1";
      ctx.lineWidth = 3;
      ctx.strokeRect(containerLeft, pistonY, containerRight - containerLeft, containerBottom - pistonY);

      // Piston (top, movable)
      ctx.fillStyle = "#64748b";
      ctx.fillRect(containerLeft - 5, pistonY - 12, containerRight - containerLeft + 10, 14);
      ctx.fillStyle = "#475569";
      ctx.fillRect(containerLeft - 5, pistonY - 12, containerRight - containerLeft + 10, 4);

      // Piston handle
      const pistonCx = (containerLeft + containerRight) / 2;
      ctx.fillStyle = "#94a3b8";
      ctx.fillRect(pistonCx - 4, pistonY - 30, 8, 20);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(pistonCx - 15, pistonY - 34, 30, 6);

      // Particles
      for (const p of particles) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpeed = Math.sqrt(temperature) * 4;
        const t = Math.min(speed / maxSpeed, 1);

        // Color: blue (slow) → yellow (medium) → red (fast)
        const r = Math.floor(t * 255);
        const g = Math.floor((1 - Math.abs(t - 0.5) * 2) * 200);
        const b = Math.floor((1 - t) * 255);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1e293b80";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Info panel
      const volume = (containerRight - containerLeft) * (containerBottom - pistonY);
      const avgSpeed = particles.reduce((s, p) => s + Math.sqrt(p.vx * p.vx + p.vy * p.vy), 0) / Math.max(particles.length, 1);

      ctx.fillStyle = "#1e293b";
      ctx.font = `${Math.max(11, width * 0.015)}px monospace`;
      ctx.textAlign = "left";
      const ix = containerRight + 20;
      let iy = height * 0.15;
      ctx.fillText(`T = ${temperature.toFixed(0)} K`, ix, iy); iy += 18;
      ctx.fillText(`N = ${particleCount}`, ix, iy); iy += 18;
      ctx.fillText(`P ≈ ${(pressure * 100).toFixed(1)}`, ix, iy); iy += 18;
      ctx.fillText(`V ∝ ${(volume / 1000).toFixed(1)}`, ix, iy); iy += 18;
      ctx.fillText(`⟨v⟩ = ${avgSpeed.toFixed(0)} px/s`, ix, iy);

      // Graph
      if (showGraph) {
        drawGraph(ix - 10, height * 0.48, width - ix - 5, height * 0.4);
      }

      // Color legend
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#3b82f6";
      ctx.fillText("Slow", containerLeft + 20, containerBottom + 14);
      ctx.fillStyle = "#eab308";
      ctx.fillText("Medium", (containerLeft + containerRight) / 2, containerBottom + 14);
      ctx.fillStyle = "#ef4444";
      ctx.fillText("Fast", containerRight - 20, containerBottom + 14);
    },
    reset() {
      time = 0;
      volumeHistory = [];
      pressureHistory = [];
      wallHits = 0;
      wallHitTimer = 0;
      initParticles();
    },
    destroy() {},
    getStateDescription(): string {
      const volume = (containerRight - containerLeft) * (containerBottom - pistonY);
      const avgSpeed = particles.reduce((s, p) => s + Math.sqrt(p.vx * p.vx + p.vy * p.vy), 0) / Math.max(particles.length, 1);
      return `Kinetic theory model: ${particleCount} particles at T=${temperature}K. ` +
        `Volume∝${(volume / 1000).toFixed(1)}, Pressure≈${(pressure * 100).toFixed(1)}. ` +
        `Average speed=${avgSpeed.toFixed(0)}px/s. ` +
        `Higher temperature increases particle speed. Smaller volume (piston down) increases pressure. ` +
        `Demonstrates ideal gas behavior: PV∝NkT.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      updateBounds();
    },
  };

  function drawGraph(gx: number, gy: number, gw: number, gh: number) {
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pressure (blue) & Volume (orange) vs Time", gx + gw / 2, gy + 12);

    const maxP = Math.max(1, ...pressureHistory) * 1.2 * 100;
    const maxV = Math.max(1, ...volumeHistory) * 1.2;
    const cy = gy + gh / 2;

    const drawLine = (data: number[], maxVal: number, color: string) => {
      if (data.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = gx + (i / historyLen) * gw;
        const val = data === pressureHistory ? data[i] * 100 : data[i];
        const y = gy + gh - 10 - (val / maxVal) * (gh - 20);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawLine(pressureHistory, maxP, "#3b82f6");
    drawLine(volumeHistory, maxV, "#f59e0b");
  }
};

export default KineticTheoryModelFactory;
