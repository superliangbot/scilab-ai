import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

const KineticTheoryModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("kinetic-theory-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 300; // K
  let numParticles = 40;
  let pistonY = 0;
  let pistonDragging = false;
  let gravity = 0;

  const particles: Particle[] = [];
  let pressure = 0;
  let wallCollisions = 0;
  let collisionTimer = 0;
  const volumeHistory: number[] = [];
  const pressureHistory: number[] = [];
  const maxHistory = 150;

  // Container bounds
  let containerLeft = 0;
  let containerRight = 0;
  let containerTop = 0;
  let containerBottom = 0;

  function initParticles() {
    particles.length = 0;
    const baseSpeed = Math.sqrt(temperature / 300) * 120;
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = baseSpeed * (0.5 + Math.random());
      particles.push({
        x: containerLeft + 10 + Math.random() * (containerRight - containerLeft - 20),
        y: pistonY + 10 + Math.random() * (containerBottom - pistonY - 20),
        vx: spd * Math.cos(angle),
        vy: spd * Math.sin(angle),
        radius: 4,
        color: `hsl(${200 + Math.random() * 40}, 70%, 60%)`,
      });
    }
  }

  function updateBounds() {
    containerLeft = width * 0.15;
    containerRight = width * 0.65;
    containerTop = height * 0.1;
    containerBottom = height * 0.8;
    pistonY = containerTop + (containerBottom - containerTop) * 0.15;
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      updateBounds();
      initParticles();

      canvas.addEventListener("mousedown", (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const my = (e.clientY - rect.top) * (height / rect.height);
        if (Math.abs(my - pistonY) < 15) pistonDragging = true;
      });
      canvas.addEventListener("mousemove", (e: MouseEvent) => {
        if (!pistonDragging) return;
        const rect = canvas.getBoundingClientRect();
        const my = (e.clientY - rect.top) * (height / rect.height);
        pistonY = Math.max(containerTop + 20, Math.min(containerBottom - 40, my));
      });
      canvas.addEventListener("mouseup", () => { pistonDragging = false; });
    },
    update(dt: number, params: Record<string, number>) {
      temperature = params.temperature ?? 300;
      const newNum = Math.round(params.numParticles ?? 40);
      gravity = params.gravity ?? 0;

      if (newNum !== numParticles) {
        numParticles = newNum;
        initParticles();
      }

      time += dt;
      collisionTimer += dt;

      // Speed scaling based on temperature
      const targetSpeed = Math.sqrt(temperature / 300) * 120;

      let frameCollisions = 0;

      for (const p of particles) {
        // Gravity
        p.vy += gravity * 50 * dt;

        // Gradual speed adjustment toward target
        const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (currentSpeed > 0) {
          const factor = 1 + (targetSpeed / currentSpeed - 1) * 0.02;
          p.vx *= factor;
          p.vy *= factor;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Wall collisions
        if (p.x - p.radius < containerLeft) { p.x = containerLeft + p.radius; p.vx = Math.abs(p.vx); frameCollisions++; }
        if (p.x + p.radius > containerRight) { p.x = containerRight - p.radius; p.vx = -Math.abs(p.vx); frameCollisions++; }
        if (p.y - p.radius < pistonY) { p.y = pistonY + p.radius; p.vy = Math.abs(p.vy); frameCollisions++; }
        if (p.y + p.radius > containerBottom) { p.y = containerBottom - p.radius; p.vy = -Math.abs(p.vy); frameCollisions++; }
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
            // Elastic collision
            const nx = dx / dist;
            const ny = dy / dist;
            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const dvDotN = dvx * nx + dvy * ny;
            if (dvDotN > 0) {
              a.vx -= dvDotN * nx;
              a.vy -= dvDotN * ny;
              b.vx += dvDotN * nx;
              b.vy += dvDotN * ny;
            }
            // Separate
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
          }
        }
      }

      wallCollisions += frameCollisions;

      // Pressure measurement every 0.2s
      if (collisionTimer >= 0.2) {
        const volume = (containerRight - containerLeft) * (containerBottom - pistonY);
        const wallPerimeter = 2 * ((containerRight - containerLeft) + (containerBottom - pistonY));
        pressure = wallCollisions / (wallPerimeter * collisionTimer) * 1000;
        wallCollisions = 0;
        collisionTimer = 0;

        volumeHistory.push(volume / 1000);
        pressureHistory.push(pressure);
        if (volumeHistory.length > maxHistory) volumeHistory.shift();
        if (pressureHistory.length > maxHistory) pressureHistory.shift();
      }
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Kinetic Theory of Gases", width / 2, 22);

      // Container
      ctx.fillStyle = "rgba(200, 230, 255, 0.05)";
      ctx.fillRect(containerLeft, pistonY, containerRight - containerLeft, containerBottom - pistonY);
      ctx.strokeStyle = "#546e7a";
      ctx.lineWidth = 2;
      ctx.strokeRect(containerLeft, pistonY, containerRight - containerLeft, containerBottom - pistonY);

      // Piston
      const pistonH = 12;
      ctx.fillStyle = "#78909c";
      ctx.fillRect(containerLeft, pistonY - pistonH / 2, containerRight - containerLeft, pistonH);
      ctx.strokeStyle = "#90a4ae";
      ctx.lineWidth = 1;
      ctx.strokeRect(containerLeft, pistonY - pistonH / 2, containerRight - containerLeft, pistonH);

      // Piston handle
      const handleX = (containerLeft + containerRight) / 2;
      ctx.fillStyle = "#607d8b";
      ctx.fillRect(handleX - 5, pistonY - pistonH / 2 - 25, 10, 25);

      ctx.fillStyle = "#aaa";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("↕ drag piston", handleX, pistonY - pistonH / 2 - 28);

      // Particles
      for (const p of particles) {
        const speedRatio = Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 200;
        const hue = 220 - speedRatio * 180; // blue→red
        p.color = `hsl(${Math.max(0, Math.min(220, hue))}, 80%, 55%)`;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Motion blur trail
        ctx.strokeStyle = p.color + "40";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      }

      // Graph area
      const gx = width * 0.7;
      const gy = height * 0.12;
      const gw = width * 0.27;
      const gh = height * 0.3;

      // Volume graph
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = "#444";
      ctx.strokeRect(gx, gy, gw, gh);

      if (volumeHistory.length > 1) {
        const maxV = Math.max(...volumeHistory) * 1.2;
        ctx.strokeStyle = "#4fc3f7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < volumeHistory.length; i++) {
          const x = gx + (i / maxHistory) * gw;
          const y = gy + gh - (volumeHistory[i] / maxV) * gh;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#4fc3f7";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Volume", gx + 4, gy + 14);

      // Pressure graph
      const gy2 = gy + gh + 15;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(gx, gy2, gw, gh);
      ctx.strokeStyle = "#444";
      ctx.strokeRect(gx, gy2, gw, gh);

      if (pressureHistory.length > 1) {
        const maxP = Math.max(...pressureHistory) * 1.2 + 1;
        ctx.strokeStyle = "#ff9800";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < pressureHistory.length; i++) {
          const x = gx + (i / maxHistory) * gw;
          const y = gy2 + gh - (pressureHistory[i] / maxP) * gh;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "#ff9800";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Pressure", gx + 4, gy2 + 14);

      // Stats
      const avgSpeed = particles.reduce((s, p) => s + Math.sqrt(p.vx * p.vx + p.vy * p.vy), 0) / Math.max(particles.length, 1);
      const volume = ((containerRight - containerLeft) * (containerBottom - pistonY)) / 1000;

      const infoY = height * 0.84;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.05, infoY, width * 0.9, 50);
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`T = ${temperature.toFixed(0)} K | N = ${particles.length} | Avg speed = ${avgSpeed.toFixed(0)} px/s`, width / 2, infoY + 18);
      ctx.fillText(`Volume ∝ ${volume.toFixed(1)} | Pressure ∝ ${pressure.toFixed(1)} | Higher T → faster particles → more pressure`, width / 2, infoY + 38);
    },
    reset() {
      time = 0;
      wallCollisions = 0;
      collisionTimer = 0;
      volumeHistory.length = 0;
      pressureHistory.length = 0;
      updateBounds();
      initParticles();
    },
    destroy() {},
    getStateDescription(): string {
      const avgSpeed = particles.reduce((s, p) => s + Math.sqrt(p.vx * p.vx + p.vy * p.vy), 0) / Math.max(particles.length, 1);
      return `Kinetic theory model: ${particles.length} gas particles at T=${temperature}K. Average speed=${avgSpeed.toFixed(0)}. Pressure∝${pressure.toFixed(1)}. Particles collide elastically with walls and each other. Higher temperature = faster particles = more wall collisions = higher pressure. Compressing the piston reduces volume and increases pressure.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      updateBounds();
    },
  };

  return engine;
};

export default KineticTheoryModelFactory;
