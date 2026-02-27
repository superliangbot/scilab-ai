import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const GasInVariousConditionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gas-in-various-condition") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 300; // Kelvin
  let volumePercent = 50;
  let numParticles = 30;

  let particlesA: Particle[] = [];
  let particlesB: Particle[] = [];
  let pressureA = 0;
  let pressureB = 0;
  let collisionsA = 0;
  let collisionsB = 0;

  // Container geometry
  let containerW = 0;
  let containerH = 0;
  let pistonYA = 0;
  let pistonYB = 0;

  function initState() {
    time = 0;
    collisionsA = 0;
    collisionsB = 0;
    pressureA = 0;
    pressureB = 0;

    recomputeLayout();

    particlesA = createParticles(numParticles, "A");
    particlesB = createParticles(numParticles, "B");
  }

  function recomputeLayout() {
    containerW = (width - 80) / 2 - 20;
    containerH = height - 200;
    pistonYA = 100 + containerH * (1 - volumePercent / 100);
    pistonYB = 100 + containerH * (1 - volumePercent / 100);
  }

  function createParticles(n: number, _side: string): Particle[] {
    const speedScale = Math.sqrt(temperature / 300) * 80;
    const particles: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.3 + Math.random() * 0.7) * speedScale;
      particles.push({
        x: 20 + Math.random() * (containerW - 40),
        y: Math.random() * (containerH * volumePercent / 100 - 20),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
    return particles;
  }

  function updateParticles(particles: Particle[], pistonY: number, offsetX: number, tempK: number): number {
    const r = 4;
    const speedScale = Math.sqrt(tempK / 300);
    let wallHits = 0;
    const containerTop = pistonY;
    const containerBot = 100 + containerH;
    const containerLeft = offsetX;
    const containerRight = offsetX + containerW;

    for (const p of particles) {
      p.x += p.vx * (1 / 60) * speedScale;
      p.y += p.vy * (1 / 60) * speedScale;

      // Wall collisions
      if (p.x - r < 0) {
        p.x = r;
        p.vx = Math.abs(p.vx);
        wallHits++;
      }
      if (p.x + r > containerW) {
        p.x = containerW - r;
        p.vx = -Math.abs(p.vx);
        wallHits++;
      }
      if (p.y + (containerTop - 100) < r) {
        p.y = r - (containerTop - 100);
        p.vy = Math.abs(p.vy);
        wallHits++;
      }
      if (p.y + 100 + r > containerBot) {
        p.y = containerBot - 100 - r;
        p.vy = -Math.abs(p.vy);
        wallHits++;
      }
    }

    return wallHits;
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0c1222");
    grad.addColorStop(1, "#1a2740");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawContainer(offsetX: number, pistonY: number, particles: Particle[], label: string, tempK: number, pressure: number) {
    const containerBot = 100 + containerH;

    // Container walls
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, 100, containerW, containerH);

    // Active volume
    ctx.fillStyle = "rgba(59, 130, 246, 0.06)";
    ctx.fillRect(offsetX, pistonY, containerW, containerBot - pistonY);

    // Piston
    const pistonGrad = ctx.createLinearGradient(offsetX, pistonY - 8, offsetX, pistonY + 8);
    pistonGrad.addColorStop(0, "#94a3b8");
    pistonGrad.addColorStop(0.5, "#64748b");
    pistonGrad.addColorStop(1, "#475569");
    ctx.fillStyle = pistonGrad;
    ctx.fillRect(offsetX, pistonY - 6, containerW, 12);

    // Piston handle
    ctx.fillStyle = "#475569";
    ctx.fillRect(offsetX + containerW / 2 - 3, pistonY - 30, 6, 24);
    ctx.fillRect(offsetX + containerW / 2 - 15, pistonY - 32, 30, 6);

    // Draw particles
    const tempColor = tempK < 300 ? "#60a5fa" : tempK < 500 ? "#fbbf24" : "#ef4444";
    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, pistonY, containerW, containerBot - pistonY);
    ctx.clip();

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(offsetX + p.x, pistonY + p.y - (pistonY - 100) + 6, 4, 0, Math.PI * 2);
      ctx.fillStyle = tempColor;
      ctx.fill();
    }
    ctx.restore();

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, offsetX + containerW / 2, 85);

    // Measurements
    const volFrac = (containerBot - pistonY) / containerH;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";

    const my = containerBot + 20;
    ctx.fillText(`T = ${tempK.toFixed(0)} K (${(tempK - 273).toFixed(0)}°C)`, offsetX + containerW / 2, my);
    ctx.fillText(`V = ${(volFrac * 10).toFixed(1)} L`, offsetX + containerW / 2, my + 16);
    ctx.fillText(`P = ${pressure.toFixed(2)} atm`, offsetX + containerW / 2, my + 32);
    ctx.fillText(`n = ${numParticles} particles`, offsetX + containerW / 2, my + 48);
  }

  function drawPVTInfo() {
    const py = height - 50;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Ideal Gas Law: PV = nRT", width / 2, py);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      "Higher T → faster molecules → more wall collisions → higher P  |  Smaller V → more collisions → higher P",
      width / 2, py + 20
    );
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Gas in Various Conditions", width / 2, 28);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText("Compare gas behavior at different temperatures", width / 2, 50);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      const newTemp = params.temperature ?? 300;
      const newVol = params.volume ?? 50;
      const newN = Math.round(params.numParticles ?? 30);

      if (newN !== numParticles) {
        numParticles = newN;
        temperature = newTemp;
        volumePercent = newVol;
        initState();
        return;
      }

      temperature = newTemp;
      volumePercent = newVol;
      recomputeLayout();

      time += dt;

      // Container A: at set temperature
      const hitsA = updateParticles(particlesA, pistonYA, 40, temperature);
      collisionsA += hitsA;

      // Container B: at higher temperature (1.5x)
      const tempB = temperature * 1.5;
      const hitsB = updateParticles(particlesB, pistonYB, width / 2 + 20, tempB);
      collisionsB += hitsB;

      // Pressure proportional to collisions per unit time
      const decay = 0.95;
      pressureA = pressureA * decay + hitsA * (1 - decay) * 0.5;
      pressureB = pressureB * decay + hitsB * (1 - decay) * 0.5;

      // PV = nRT estimation
      const volA = volumePercent / 100;
      pressureA = (numParticles * temperature) / (volA * 1000 + 1);
      pressureB = (numParticles * tempB) / (volA * 1000 + 1);
    },

    render() {
      drawBackground();
      const tempB = temperature * 1.5;
      drawContainer(40, pistonYA, particlesA, `Container A (${temperature.toFixed(0)} K)`, temperature, pressureA);
      drawContainer(width / 2 + 20, pistonYB, particlesB, `Container B (${tempB.toFixed(0)} K)`, tempB, pressureB);
      drawPVTInfo();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {
      particlesA = [];
      particlesB = [];
    },

    getStateDescription(): string {
      const tempB = temperature * 1.5;
      return `Gas in Various Conditions: Two containers with ${numParticles} particles each. Container A: T=${temperature}K, P=${pressureA.toFixed(2)} atm. Container B: T=${tempB.toFixed(0)}K, P=${pressureB.toFixed(2)} atm. Volume: ${volumePercent}%. Demonstrates PV=nRT — higher temperature means faster molecules and higher pressure.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      recomputeLayout();
    },
  };
};

export default GasInVariousConditionFactory;
