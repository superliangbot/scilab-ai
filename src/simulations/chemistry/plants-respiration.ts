import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PlantsRespirationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("plants-respiration") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let dayNight = 75; // 0=night, 100=full day
  let organism = 0; // 0=plant, 1=animal

  // Particles for gas exchange visualization
  let particles: Array<{
    x: number; y: number; vx: number; vy: number;
    type: "O2" | "CO2"; dir: "in" | "out"; life: number;
  }> = [];
  let spawnTimer = 0;

  function getSunIntensity(): number {
    return dayNight / 100;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particles = [];
    spawnTimer = 0;
  }

  function spawnParticle(type: "O2" | "CO2", dir: "in" | "out") {
    const baseX = width * 0.5;
    const baseY = height * 0.45;
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 20;

    if (dir === "out") {
      particles.push({
        x: baseX + Math.cos(angle) * 20,
        y: baseY + Math.sin(angle) * 15,
        vx: Math.cos(angle) * (20 + Math.random() * 15),
        vy: Math.sin(angle) * (20 + Math.random() * 15) - 10,
        type, dir, life: 3 + Math.random() * 2,
      });
    } else {
      particles.push({
        x: baseX + Math.cos(angle) * dist * 3,
        y: baseY + Math.sin(angle) * dist * 2,
        vx: -Math.cos(angle) * (15 + Math.random() * 10),
        vy: -Math.sin(angle) * (15 + Math.random() * 10),
        type, dir, life: 3 + Math.random() * 2,
      });
    }
  }

  function update(dt: number, params: Record<string, number>) {
    dayNight = params.dayNight ?? 75;
    organism = params.organism ?? 0;

    const sun = getSunIntensity();
    spawnTimer += dt;

    const spawnRate = 0.15;
    while (spawnTimer > spawnRate) {
      spawnTimer -= spawnRate;

      if (organism < 0.5) {
        // Plant
        // Photosynthesis: CO2 in, O2 out (scales with sunlight)
        if (Math.random() < sun * 0.8) {
          spawnParticle("CO2", "in");
          spawnParticle("O2", "out");
        }
        // Respiration: O2 in, CO2 out (always, but less than photosynthesis during day)
        if (Math.random() < 0.3) {
          spawnParticle("O2", "in");
          spawnParticle("CO2", "out");
        }
      } else {
        // Animal: only respiration
        if (Math.random() < 0.6) {
          spawnParticle("O2", "in");
          spawnParticle("CO2", "out");
        }
      }
    }

    // Update particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      // Fade out near edges
      p.vx *= 0.995;
      p.vy *= 0.995;
    }
    particles = particles.filter((p) => p.life > 0 && p.x > -20 && p.x < width + 20 && p.y > -20 && p.y < height + 20);
    if (particles.length > 200) particles.splice(0, particles.length - 200);

    time += dt;
  }

  function drawPlant() {
    const baseX = width * 0.5;
    const baseY = height * 0.7;

    // Stem
    ctx.strokeStyle = "#2d8a2d";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX - 5, baseY - 60, baseX, baseY - 120);
    ctx.stroke();

    // Leaves
    const leaves = [
      { angle: -0.6, y: -40, size: 1 },
      { angle: 0.5, y: -60, size: 1.1 },
      { angle: -0.4, y: -80, size: 0.9 },
      { angle: 0.3, y: -95, size: 1 },
    ];

    for (const leaf of leaves) {
      ctx.save();
      ctx.translate(baseX, baseY + leaf.y);
      ctx.rotate(leaf.angle);
      ctx.scale(leaf.size, leaf.size);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(20, -12, 40, -8, 50, 0);
      ctx.bezierCurveTo(40, 8, 20, 12, 0, 0);
      ctx.fillStyle = "#3da63d";
      ctx.fill();
      ctx.strokeStyle = "#2d8a2d";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Leaf vein
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(45, 0);
      ctx.strokeStyle = "rgba(45,138,45,0.5)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();
    }

    // Stomata hint (small dots on leaf undersides)
    ctx.fillStyle = "rgba(100,200,100,0.3)";
    for (let i = 0; i < 5; i++) {
      const sx = baseX + 15 + Math.random() * 20;
      const sy = baseY - 50 - Math.random() * 50;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pot
    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.moveTo(baseX - 30, baseY);
    ctx.lineTo(baseX + 30, baseY);
    ctx.lineTo(baseX + 25, baseY + 40);
    ctx.lineTo(baseX - 25, baseY + 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6B3410";
    ctx.fillRect(baseX - 32, baseY - 2, 64, 8);

    // Soil
    ctx.fillStyle = "#5a3a1a";
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + 4, 27, 6, 0, 0, Math.PI);
    ctx.fill();
  }

  function drawAnimal() {
    const cx = width * 0.5;
    const cy = height * 0.55;

    // Simple animal (cat-like shape)
    // Body
    ctx.fillStyle = "#c8a060";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 40, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(cx + 35, cy - 10, 18, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(cx + 25, cy - 25);
    ctx.lineTo(cx + 30, cy - 40);
    ctx.lineTo(cx + 38, cy - 25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 38, cy - 25);
    ctx.lineTo(cx + 43, cy - 40);
    ctx.lineTo(cx + 50, cy - 25);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 12, 2, 0, Math.PI * 2);
    ctx.arc(cx + 42, cy - 12, 2, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = "#d88";
    ctx.beginPath();
    ctx.arc(cx + 36, cy - 5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.strokeStyle = "#c8a060";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy);
    ctx.quadraticCurveTo(cx - 55, cy - 30, cx - 45, cy - 45);
    ctx.stroke();

    // Legs
    ctx.fillStyle = "#c8a060";
    for (const lx of [cx - 20, cx - 8, cx + 12, cx + 24]) {
      ctx.fillRect(lx - 3, cy + 20, 6, 18);
    }

    // Breathing animation
    const breathe = Math.sin(time * 2) * 0.05;
    ctx.save();
    ctx.translate(cx + 50, cy - 5);
    // Nostrils exhale
    if (breathe > 0) {
      ctx.fillStyle = "rgba(200,200,255,0.3)";
      ctx.beginPath();
      ctx.arc(5, 0, 3 + breathe * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render() {
    const sun = getSunIntensity();

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (sun > 0.5) {
      skyGrad.addColorStop(0, `rgba(${100 + sun * 80},${150 + sun * 80},${220},1)`);
      skyGrad.addColorStop(1, `rgba(${180 + sun * 50},${220 + sun * 30},${200},1)`);
    } else {
      const n = sun * 2; // 0 to 1
      skyGrad.addColorStop(0, `rgba(${Math.floor(n * 60)},${Math.floor(n * 30)},${Math.floor(40 + n * 40)},1)`);
      skyGrad.addColorStop(1, `rgba(${Math.floor(n * 80)},${Math.floor(n * 50)},${Math.floor(30 + n * 50)},1)`);
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground
    ctx.fillStyle = sun > 0.3 ? "#4a8c3a" : "#1a3a1a";
    ctx.fillRect(0, height * 0.78, width, height * 0.22);

    // Sun/Moon
    if (sun > 0.2) {
      const sunX = width * 0.15 + sun * width * 0.2;
      const sunY = height * 0.12 + (1 - sun) * height * 0.15;
      const sGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 50);
      sGrad.addColorStop(0, "rgba(255,240,100,0.9)");
      sGrad.addColorStop(0.5, "rgba(255,220,50,0.3)");
      sGrad.addColorStop(1, "rgba(255,200,50,0)");
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
      ctx.fillStyle = "#ffe040";
      ctx.fill();
    } else {
      const moonX = width * 0.8;
      const moonY = height * 0.15;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#e8e8d0";
      ctx.fill();
    }

    // Draw organism
    if (organism < 0.5) {
      drawPlant();
    } else {
      drawAnimal();
    }

    // Draw gas particles
    for (const p of particles) {
      const alpha = Math.min(1, p.life / 1.5);
      const isO2 = p.type === "O2";
      const color = isO2 ? `rgba(80,140,255,${alpha})` : `rgba(200,120,60,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`;
      ctx.font = "8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.type, p.x, p.y);
    }

    // Arrow indicators
    const arrowY = height * 0.3;
    const arrowX = width * 0.5;

    if (organism < 0.5) {
      // Plant arrows
      // Photosynthesis (day only)
      if (sun > 0.2) {
        ctx.fillStyle = `rgba(80,140,255,${sun * 0.7})`;
        ctx.font = `bold ${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText(`O₂ →`, arrowX + 100, arrowY - 20);
        ctx.fillStyle = `rgba(200,120,60,${sun * 0.7})`;
        ctx.textAlign = "left";
        ctx.fillText(`← CO₂`, arrowX - 100, arrowY - 20);

        ctx.fillStyle = `rgba(100,255,100,${sun * 0.5})`;
        ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("Photosynthesis", arrowX, arrowY - 40);
      }

      // Respiration (always)
      ctx.fillStyle = "rgba(80,140,255,0.4)";
      ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("← O₂", arrowX - 100, arrowY + 10);
      ctx.fillStyle = "rgba(200,120,60,0.4)";
      ctx.textAlign = "right";
      ctx.fillText("CO₂ →", arrowX + 100, arrowY + 10);
      ctx.fillStyle = "rgba(255,200,100,0.4)";
      ctx.textAlign = "center";
      ctx.fillText("Respiration", arrowX, arrowY + 28);
    } else {
      // Animal: respiration only
      ctx.fillStyle = "rgba(80,140,255,0.6)";
      ctx.font = `bold ${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("← O₂", arrowX - 80, arrowY);
      ctx.fillStyle = "rgba(200,120,60,0.6)";
      ctx.textAlign = "right";
      ctx.fillText("CO₂ →", arrowX + 80, arrowY);
      ctx.fillStyle = "rgba(255,200,100,0.5)";
      ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Respiration (continuous)", arrowX, arrowY + 20);
    }

    // Net gas exchange info
    const infoY = height * 0.85;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(width * 0.1, infoY, width * 0.8, height * 0.12, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "center";

    if (organism < 0.5) {
      if (sun > 0.5) {
        ctx.fillText("Day: Photosynthesis > Respiration → Net O₂ release, CO₂ absorption", width / 2, infoY + 18);
      } else if (sun > 0.2) {
        ctx.fillText("Dim light: Photosynthesis ≈ Respiration → Compensation point", width / 2, infoY + 18);
      } else {
        ctx.fillText("Night: Only Respiration → Net O₂ absorption, CO₂ release", width / 2, infoY + 18);
      }
    } else {
      ctx.fillText("Animals: Respiration only (day & night) → O₂ in, CO₂ out", width / 2, infoY + 18);
    }

    // Title
    ctx.fillStyle = sun > 0.5 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Plant Respiration & Photosynthesis", width / 2, 25);
  }

  function reset() {
    time = 0;
    particles = [];
    spawnTimer = 0;
  }

  function destroy() { particles = []; }

  function getStateDescription(): string {
    const sun = getSunIntensity();
    const org = organism < 0.5 ? "Plant" : "Animal";
    return `Plants Respiration | Organism: ${org} | Light: ${(sun * 100).toFixed(0)}% | ` +
      `${organism < 0.5 ? (sun > 0.5 ? "Net photosynthesis" : sun > 0.2 ? "Compensation point" : "Net respiration") : "Respiration only"}`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PlantsRespirationFactory;
