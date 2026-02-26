import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TorricellisExperimentFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("torricellis-experiment") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let waterHeight = 0.8; // m
  let holeHeight = 0.2; // m
  let holeSize = 2; // mm
  let gravity = 9.81;

  let currentWaterLevel = 0.8;

  interface WaterParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    age: number;
  }

  let particles: WaterParticle[] = [];
  let lastParticleTime = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentWaterLevel = waterHeight;
    particles = [];
    lastParticleTime = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    waterHeight = params.waterHeight ?? 0.8;
    holeHeight = params.holeHeight ?? 0.2;
    holeSize = params.holeSize ?? 2;
    gravity = params.gravity ?? 9.81;
    time += dt;

    // Torricelli: v = sqrt(2g(h_water - h_hole))
    const effectiveHead = Math.max(0, currentWaterLevel - holeHeight);
    const exitVelocity = Math.sqrt(2 * gravity * effectiveHead);

    // Water level drops over time (simplified)
    // A_tank * dh/dt = -A_hole * v_exit
    // Assume tank cross section is large, hole is small
    const tankArea = 0.1; // m² (0.316m × 0.316m tank)
    const holeArea = Math.PI * (holeSize / 2000) * (holeSize / 2000); // m²
    const dhdt = -(holeArea / tankArea) * exitVelocity;
    currentWaterLevel = Math.max(holeHeight, currentWaterLevel + dhdt * dt);

    // Spawn water particles from the hole
    const particleInterval = 0.03;
    if (effectiveHead > 0.001 && time - lastParticleTime > particleInterval) {
      lastParticleTime = time;
      particles.push({
        x: 0, // will be positioned in render coordinates
        y: 0,
        vx: exitVelocity,
        vy: 0,
        age: 0,
      });
    }

    // Update particles (projectile motion)
    for (const p of particles) {
      p.age += dt;
      p.vy += gravity * dt; // falls under gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Remove old particles
    particles = particles.filter((p) => p.age < 3 && p.y < 5);
    if (particles.length > 300) {
      particles = particles.slice(particles.length - 300);
    }
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#1a1a2e");
    bgGrad.addColorStop(0.5, "#16213e");
    bgGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Torricelli's Experiment", width / 2, 24);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Fluid exit velocity: v = √(2gh)", width / 2, 42);

    // Coordinate system: container on the left side
    // Scale: 1 meter = containerScale pixels
    const containerScale = height * 0.45;
    const containerLeft = width * 0.12;
    const containerWidth = width * 0.2;
    const groundY = height * 0.72; // ground level (h=0 in real coords)
    const containerBottom = groundY;
    const containerTop = containerBottom - waterHeight * containerScale;
    const containerH = waterHeight * containerScale;

    // === Container ===
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    const holeY = containerBottom - holeHeight * containerScale;
    const holeSizePx = Math.max(4, holeSize * 2);
    // Left wall, bottom, right wall with hole gap
    ctx.beginPath(); ctx.moveTo(containerLeft, containerTop - 20); ctx.lineTo(containerLeft, containerBottom);
    ctx.lineTo(containerLeft + containerWidth, containerBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(containerLeft + containerWidth, containerTop - 20);
    ctx.lineTo(containerLeft + containerWidth, holeY - holeSizePx / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(containerLeft + containerWidth, holeY + holeSizePx / 2);
    ctx.lineTo(containerLeft + containerWidth, containerBottom); ctx.stroke();

    // Hole indicator
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(containerLeft + containerWidth - 2, holeY - holeSizePx / 2, 6, holeSizePx);

    // === Water in container ===
    const waterLevelY = containerBottom - currentWaterLevel * containerScale;
    if (currentWaterLevel > 0) {
      const waterGrad = ctx.createLinearGradient(containerLeft, waterLevelY, containerLeft, containerBottom);
      waterGrad.addColorStop(0, "rgba(59,130,246,0.6)");
      waterGrad.addColorStop(1, "rgba(29,78,216,0.8)");
      ctx.fillStyle = waterGrad;
      ctx.fillRect(containerLeft + 2, waterLevelY, containerWidth - 2, containerBottom - waterLevelY);

      // Water surface highlight
      ctx.strokeStyle = "rgba(147,197,253,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(containerLeft + 2, waterLevelY);
      ctx.lineTo(containerLeft + containerWidth - 2, waterLevelY);
      ctx.stroke();
    }

    // Height markers
    ctx.strokeStyle = "rgba(148,163,184,0.4)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(containerLeft - 30, waterLevelY); ctx.lineTo(containerLeft, waterLevelY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(containerLeft - 30, holeY); ctx.lineTo(containerLeft, holeY); ctx.stroke();

    // h (effective head) bracket
    if (currentWaterLevel > holeHeight + 0.01) {
      ctx.strokeStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(containerLeft - 20, waterLevelY);
      ctx.lineTo(containerLeft - 20, holeY);
      ctx.stroke();
      // Arrow heads
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(containerLeft - 24, waterLevelY + 6);
      ctx.lineTo(containerLeft - 20, waterLevelY);
      ctx.lineTo(containerLeft - 16, waterLevelY + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(containerLeft - 24, holeY - 6);
      ctx.lineTo(containerLeft - 20, holeY);
      ctx.lineTo(containerLeft - 16, holeY - 6);
      ctx.stroke();

      ctx.fillStyle = "#f59e0b";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("h", containerLeft - 26, (waterLevelY + holeY) / 2 + 3);
    }
    ctx.setLineDash([]);

    // Height labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${currentWaterLevel.toFixed(2)} m`, containerLeft - 34, waterLevelY + 3);
    ctx.fillText(`${holeHeight.toFixed(2)} m`, containerLeft - 34, holeY + 3);

    // === Water jet (projectile path) ===
    const effectiveHead = Math.max(0, currentWaterLevel - holeHeight);
    const exitV = Math.sqrt(2 * gravity * effectiveHead);
    const holeWorldX = 0;
    const holeWorldY = 0;

    // Draw particles
    const jetStartX = containerLeft + containerWidth + 4;
    const jetStartY = holeY;

    ctx.fillStyle = "rgba(59,130,246,0.7)";
    for (const p of particles) {
      const px = jetStartX + p.x * containerScale;
      const py = jetStartY + p.y * containerScale;
      if (px < 0 || px > width || py > groundY + 10) continue;
      const alpha = Math.max(0.1, 1 - p.age * 0.5);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw theoretical parabolic trajectory
    if (effectiveHead > 0.01) {
      ctx.strokeStyle = "rgba(250,204,21,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      let first = true;
      for (let t = 0; t < 2; t += 0.01) {
        const px = jetStartX + exitV * t * containerScale;
        const py = jetStartY + 0.5 * gravity * t * t * containerScale;
        if (py > groundY) break;
        if (px > width) break;
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // === Ground ===
    ctx.fillStyle = "#1c1917"; ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(width, groundY); ctx.stroke();
    ctx.strokeStyle = "rgba(120,53,15,0.2)"; ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 15) {
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x - 8, groundY + 12); ctx.stroke();
    }

    // Landing distance marker
    if (effectiveHead > 0.01) {
      const fallHeight = holeHeight; // height of hole above ground
      const flightTime = Math.sqrt(2 * fallHeight / gravity);
      const landingDist = exitV * flightTime;

      const landX = jetStartX + landingDist * containerScale;
      if (landX < width - 20) {
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(jetStartX, groundY + 5);
        ctx.lineTo(landX, groundY + 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(landX - 5, groundY + 2);
        ctx.lineTo(landX, groundY + 5);
        ctx.lineTo(landX - 5, groundY + 8);
        ctx.stroke();

        ctx.fillStyle = "#4ade80";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`R = ${landingDist.toFixed(3)} m`, (jetStartX + landX) / 2, groundY + 20);
      }
    }

    // === Velocity arrow at the hole ===
    if (effectiveHead > 0.01) {
      const arrowLen = Math.min(exitV * 30, width * 0.15);
      ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(jetStartX, jetStartY); ctx.lineTo(jetStartX + arrowLen, jetStartY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(jetStartX + arrowLen, jetStartY);
      ctx.lineTo(jetStartX + arrowLen - 8, jetStartY - 5); ctx.moveTo(jetStartX + arrowLen, jetStartY);
      ctx.lineTo(jetStartX + arrowLen - 8, jetStartY + 5); ctx.stroke();
      ctx.fillStyle = "#ef4444"; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(`v = ${exitV.toFixed(2)} m/s`, jetStartX + arrowLen + 8, jetStartY - 5);
    }

    // === Formulas panel (upper right) ===
    const fmX = width * 0.55;
    const fmY = 55;
    const fmW = width * 0.42;
    const fmH = height * 0.3;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(fmX, fmY, fmW, fmH, 8);
    ctx.fill();

    let ty = fmY + 20;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Torricelli's Theorem", fmX + 12, ty); ty += 22;

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "13px monospace";
    ctx.fillText("v = √(2gh)", fmX + 12, ty); ty += 22;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("From Bernoulli's Principle:", fmX + 12, ty); ty += 16;

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "11px monospace";
    ctx.fillText("P + ½ρv² + ρgh = const", fmX + 12, ty); ty += 22;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    const head = Math.max(0, currentWaterLevel - holeHeight);
    ctx.fillText(`h = ${head.toFixed(3)} m`, fmX + 12, ty); ty += 16;
    ctx.fillText(`g = ${gravity} m/s²`, fmX + 12, ty); ty += 16;
    ctx.fillText(`v = √(2 × ${gravity} × ${head.toFixed(3)}) = ${exitV.toFixed(2)} m/s`, fmX + 12, ty);

    // === Calculations panel (lower right) ===
    const cpX = width * 0.55;
    const cpY = fmY + fmH + 15;
    const cpW = width * 0.42;
    const cpH = height * 0.26;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(cpX, cpY, cpW, cpH, 8);
    ctx.fill();

    let cy2 = cpY + 20;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Projectile Motion", cpX + 12, cy2); cy2 += 22;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";

    const fallH = holeHeight;
    const flightT = fallH > 0 ? Math.sqrt(2 * fallH / gravity) : 0;
    const landDist = exitV * flightT;

    ctx.fillText(`x(t) = v × t = ${exitV.toFixed(2)} × t`, cpX + 12, cy2); cy2 += 16;
    ctx.fillText(`y(t) = ½gt² = ½ × ${gravity} × t²`, cpX + 12, cy2); cy2 += 20;

    ctx.fillStyle = "#4ade80";
    ctx.fillText(`Fall height: ${fallH.toFixed(2)} m`, cpX + 12, cy2); cy2 += 16;
    ctx.fillText(`Flight time: ${flightT.toFixed(3)} s`, cpX + 12, cy2); cy2 += 16;
    ctx.fillText(`Landing dist: ${landDist.toFixed(3)} m`, cpX + 12, cy2); cy2 += 16;

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Water level: ${currentWaterLevel.toFixed(3)} m (draining)`, cpX + 12, cy2);
  }

  function reset(): void {
    time = 0;
    currentWaterLevel = waterHeight;
    particles = [];
    lastParticleTime = 0;
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const effectiveHead = Math.max(0, currentWaterLevel - holeHeight);
    const exitV = Math.sqrt(2 * gravity * effectiveHead);
    const flightT = holeHeight > 0 ? Math.sqrt(2 * holeHeight / gravity) : 0;
    const landDist = exitV * flightT;

    return (
      `Torricelli's Experiment: water level=${currentWaterLevel.toFixed(3)} m, ` +
      `hole height=${holeHeight} m, effective head h=${effectiveHead.toFixed(3)} m. ` +
      `Exit velocity v=√(2gh)=${exitV.toFixed(2)} m/s. ` +
      `Projectile: flight time=${flightT.toFixed(3)} s, landing distance=${landDist.toFixed(3)} m. ` +
      `Based on Bernoulli's principle: P + ½ρv² + ρgh = constant. ` +
      `The water level is slowly draining, reducing exit velocity over time.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TorricellisExperimentFactory;
