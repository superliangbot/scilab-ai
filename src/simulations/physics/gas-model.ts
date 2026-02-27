import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const GasModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("gas-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let tempA = 300;
  let tempB = 300;
  let particlesA = 20;
  let particlesB = 20;

  let pA: Particle[] = [];
  let pB: Particle[] = [];
  let partitionX = 0.5; // fraction of container width
  let partitionLocked = 1;

  // Container geometry
  let boxLeft = 0;
  let boxRight = 0;
  let boxTop = 0;
  let boxBot = 0;

  let pressureA = 0;
  let pressureB = 0;
  let volumeA = 0;
  let volumeB = 0;

  function initState() {
    time = 0;
    partitionX = 0.5;
    pressureA = 0;
    pressureB = 0;
    computeLayout();
    createParticles();
  }

  function computeLayout() {
    boxLeft = 60;
    boxRight = width - 60;
    boxTop = 100;
    boxBot = height - 120;
  }

  function createParticles() {
    pA = [];
    pB = [];
    const boxW = boxRight - boxLeft;
    const boxH = boxBot - boxTop;
    const dividerX = boxLeft + boxW * partitionX;

    const speedA = Math.sqrt(tempA / 300) * 60;
    for (let i = 0; i < particlesA; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.3 + Math.random() * 0.7) * speedA;
      pA.push({
        x: boxLeft + 10 + Math.random() * (dividerX - boxLeft - 20),
        y: boxTop + 10 + Math.random() * (boxH - 20),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }

    const speedB = Math.sqrt(tempB / 300) * 60;
    for (let i = 0; i < particlesB; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.3 + Math.random() * 0.7) * speedB;
      pB.push({
        x: dividerX + 10 + Math.random() * (boxRight - dividerX - 20),
        y: boxTop + 10 + Math.random() * (boxH - 20),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
  }

  function updatePartition(dt: number) {
    if (partitionLocked > 0.5) return;

    // Partition moves based on pressure difference
    const boxW = boxRight - boxLeft;
    const pDiff = pressureA - pressureB;
    partitionX += pDiff * 0.0001 * dt;
    partitionX = Math.max(0.15, Math.min(0.85, partitionX));
  }

  function updateParticleGroup(particles: Particle[], leftBound: number, rightBound: number, temp: number, dt: number): number {
    const r = 4;
    const speedFactor = Math.sqrt(temp / 300);
    let wallHits = 0;

    for (const p of particles) {
      p.x += p.vx * dt * speedFactor;
      p.y += p.vy * dt * speedFactor;

      if (p.x - r < leftBound) { p.x = leftBound + r; p.vx = Math.abs(p.vx); wallHits++; }
      if (p.x + r > rightBound) { p.x = rightBound - r; p.vx = -Math.abs(p.vx); wallHits++; }
      if (p.y - r < boxTop) { p.y = boxTop + r; p.vy = Math.abs(p.vy); wallHits++; }
      if (p.y + r > boxBot) { p.y = boxBot - r; p.vy = -Math.abs(p.vy); wallHits++; }
    }

    // Particle-particle collisions
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r * 2 && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (dvn > 0) {
            a.vx -= dvn * nx;
            a.vy -= dvn * ny;
            b.vx += dvn * nx;
            b.vy += dvn * ny;
          }
        }
      }
    }

    return wallHits;
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawContainers() {
    const boxW = boxRight - boxLeft;
    const dividerX = boxLeft + boxW * partitionX;

    // Chamber A background
    const tempNormA = Math.min(1, (tempA - 200) / 300);
    ctx.fillStyle = `rgba(${Math.round(59 + tempNormA * 180)}, ${Math.round(130 - tempNormA * 80)}, ${Math.round(246 - tempNormA * 200)}, 0.1)`;
    ctx.fillRect(boxLeft, boxTop, dividerX - boxLeft, boxBot - boxTop);

    // Chamber B background
    const tempNormB = Math.min(1, (tempB - 200) / 300);
    ctx.fillStyle = `rgba(${Math.round(59 + tempNormB * 180)}, ${Math.round(130 - tempNormB * 80)}, ${Math.round(246 - tempNormB * 200)}, 0.1)`;
    ctx.fillRect(dividerX, boxTop, boxRight - dividerX, boxBot - boxTop);

    // Container border
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxLeft, boxTop, boxW, boxBot - boxTop);

    // Partition
    ctx.fillStyle = partitionLocked > 0.5 ? "#94a3b8" : "#f59e0b";
    ctx.fillRect(dividerX - 3, boxTop, 6, boxBot - boxTop);

    // Labels
    ctx.fillStyle = "#60a5fa";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("A", boxLeft + (dividerX - boxLeft) / 2, boxTop - 10);

    ctx.fillStyle = "#f87171";
    ctx.fillText("B", dividerX + (boxRight - dividerX) / 2, boxTop - 10);
  }

  function drawParticles() {
    const boxW = boxRight - boxLeft;
    const dividerX = boxLeft + boxW * partitionX;

    // Particles A
    const colorA = tempA < 300 ? "#60a5fa" : tempA < 400 ? "#fbbf24" : "#ef4444";
    for (const p of pA) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = colorA;
      ctx.fill();
    }

    // Particles B
    const colorB = tempB < 300 ? "#60a5fa" : tempB < 400 ? "#fbbf24" : "#ef4444";
    for (const p of pB) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = colorB;
      ctx.fill();
    }
  }

  function drawVolumeScale() {
    const scaleY = boxBot + 15;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxLeft, scaleY);
    ctx.lineTo(boxRight, scaleY);
    ctx.stroke();

    const boxW = boxRight - boxLeft;
    const dividerX = boxLeft + boxW * partitionX;

    ctx.fillStyle = "#60a5fa";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`V_A = ${volumeA.toFixed(1)} L`, boxLeft + (dividerX - boxLeft) / 2, scaleY + 16);

    ctx.fillStyle = "#f87171";
    ctx.fillText(`V_B = ${volumeB.toFixed(1)} L`, dividerX + (boxRight - dividerX) / 2, scaleY + 16);
  }

  function drawDataPanel() {
    const py = height - 70;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(10, py, width - 20, 60, 8);
    ctx.fill();

    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    const x1 = 20;
    const x2 = width / 2 + 10;

    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`A: n=${particlesA}  T=${tempA}K  P=${pressureA.toFixed(2)}  V=${volumeA.toFixed(1)}L`, x1, py + 20);

    ctx.fillStyle = "#f87171";
    ctx.fillText(`B: n=${particlesB}  T=${tempB}K  P=${pressureB.toFixed(2)}  V=${volumeB.toFixed(1)}L`, x1, py + 40);

    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText(`P_A/P_B = ${(pressureA / (pressureB || 1)).toFixed(2)}`, width - 20, py + 20);
    ctx.fillText(`V_A/V_B = ${(volumeA / (volumeB || 1)).toFixed(2)}  (nT_A)/(nT_B) = ${((particlesA * tempA) / (particlesB * tempB || 1)).toFixed(2)}`, width - 20, py + 40);
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Kinetic Molecular Model of Gases", width / 2, 28);

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Partition: ${partitionLocked > 0.5 ? "Locked" : "Free"}  |  PV = nRT  |  V_ratio = (n₁T₁):(n₂T₂)`, width / 2, 50);
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
      const newTA = params.tempA ?? 300;
      const newTB = params.tempB ?? 300;
      const newNA = Math.round(params.particlesA ?? 20);
      const newNB = Math.round(params.particlesB ?? 20);
      partitionLocked = params.lockPartition ?? 1;

      if (newNA !== particlesA || newNB !== particlesB) {
        particlesA = newNA;
        particlesB = newNB;
        tempA = newTA;
        tempB = newTB;
        initState();
        return;
      }

      // Rescale velocities for temperature changes
      if (Math.abs(newTA - tempA) > 1) {
        const ratio = Math.sqrt(newTA / tempA);
        for (const p of pA) { p.vx *= ratio; p.vy *= ratio; }
        tempA = newTA;
      }
      if (Math.abs(newTB - tempB) > 1) {
        const ratio = Math.sqrt(newTB / tempB);
        for (const p of pB) { p.vx *= ratio; p.vy *= ratio; }
        tempB = newTB;
      }

      time += dt;

      const boxW = boxRight - boxLeft;
      const dividerX = boxLeft + boxW * partitionX;

      // Update particles
      const hitsA = updateParticleGroup(pA, boxLeft, dividerX - 3, tempA, dt);
      const hitsB = updateParticleGroup(pB, dividerX + 3, boxRight, tempB, dt);

      // Estimate pressures
      volumeA = ((dividerX - boxLeft) / (boxRight - boxLeft)) * 10;
      volumeB = ((boxRight - dividerX) / (boxRight - boxLeft)) * 10;

      pressureA = (particlesA * tempA) / (volumeA * 100 + 1);
      pressureB = (particlesB * tempB) / (volumeB * 100 + 1);

      updatePartition(dt);
    },

    render() {
      drawBackground();
      drawContainers();
      drawParticles();
      drawVolumeScale();
      drawDataPanel();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {
      pA = [];
      pB = [];
    },

    getStateDescription(): string {
      return `Gas Model: Two-chamber system. A: n=${particlesA}, T=${tempA}K, V=${volumeA.toFixed(1)}L, P=${pressureA.toFixed(2)}. B: n=${particlesB}, T=${tempB}K, V=${volumeB.toFixed(1)}L, P=${pressureB.toFixed(2)}. Partition ${partitionLocked > 0.5 ? "locked" : "free"}. Volume ratio = (n₁T₁):(n₂T₂).`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      computeLayout();
    },
  };
};

export default GasModelFactory;
