import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "water" | "solute";
  radius: number;
}

const OsmosisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("osmosis") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let soluteConcentration = 20;
  let membranePermeability = 0.5;
  let temperature = 37;
  let numParticles = 50;

  // Particles
  let particles: Particle[] = [];
  let waterLevelLeft = 0; // offset from center (positive = higher)
  let waterLevelRight = 0;

  // Container geometry
  const CONTAINER_MARGIN = 0.1;
  const CONTAINER_TOP = 0.15;
  const CONTAINER_BOTTOM = 0.82;
  const MEMBRANE_X = 0.5;

  function getContainerBounds() {
    const left = width * CONTAINER_MARGIN;
    const right = width * (1 - CONTAINER_MARGIN);
    const top = height * CONTAINER_TOP;
    const bottom = height * CONTAINER_BOTTOM;
    const memX = width * MEMBRANE_X;
    return { left, right, top, bottom, memX };
  }

  function createParticles(): void {
    particles = [];
    const { left, right, top, bottom, memX } = getContainerBounds();
    const padding = 8;

    // Left side: only water particles
    const leftWaterCount = Math.floor(numParticles * 0.6);
    for (let i = 0; i < leftWaterCount; i++) {
      particles.push({
        x: left + padding + Math.random() * (memX - left - 2 * padding),
        y: top + padding + Math.random() * (bottom - top - 2 * padding),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        type: "water",
        radius: 3,
      });
    }

    // Right side: water and solute particles
    const rightTotal = numParticles - leftWaterCount;
    const soluteCount = Math.floor(rightTotal * (soluteConcentration / 100));
    const rightWaterCount = rightTotal - soluteCount;

    for (let i = 0; i < rightWaterCount; i++) {
      particles.push({
        x: memX + padding + Math.random() * (right - memX - 2 * padding),
        y: top + padding + Math.random() * (bottom - top - 2 * padding),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        type: "water",
        radius: 3,
      });
    }

    for (let i = 0; i < soluteCount; i++) {
      particles.push({
        x: memX + padding + Math.random() * (right - memX - 2 * padding),
        y: top + padding + Math.random() * (bottom - top - 2 * padding),
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        type: "solute",
        radius: 5,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    waterLevelLeft = 0;
    waterLevelRight = 0;
    createParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    soluteConcentration = params.soluteConcentration ?? 20;
    membranePermeability = params.membranePermeability ?? 0.5;
    temperature = params.temperature ?? 37;
    numParticles = params.numParticles ?? 50;

    time += dt;

    const { left, right, top, bottom, memX } = getContainerBounds();
    const speedFactor = 0.5 + (temperature - 20) / 60; // higher temp = faster

    for (const p of particles) {
      // Apply Brownian-like motion
      p.vx += (Math.random() - 0.5) * speedFactor * 3 * dt;
      p.vy += (Math.random() - 0.5) * speedFactor * 3 * dt;

      // Damping
      p.vx *= 0.98;
      p.vy *= 0.98;

      // Speed limit
      const maxSpeed = 60 * speedFactor;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      p.x += p.vx * dt * 30;
      p.y += p.vy * dt * 30;

      // Container wall collisions
      if (p.x - p.radius < left) { p.x = left + p.radius; p.vx = Math.abs(p.vx); }
      if (p.x + p.radius > right) { p.x = right - p.radius; p.vx = -Math.abs(p.vx); }
      if (p.y - p.radius < top) { p.y = top + p.radius; p.vy = Math.abs(p.vy); }
      if (p.y + p.radius > bottom) { p.y = bottom - p.radius; p.vy = -Math.abs(p.vy); }

      // Membrane interaction
      const distToMembrane = Math.abs(p.x - memX);
      if (distToMembrane < p.radius + 4) {
        if (p.type === "solute") {
          // Solute cannot pass through membrane
          if (p.x < memX) {
            p.x = memX - p.radius - 4;
            p.vx = -Math.abs(p.vx);
          } else {
            p.x = memX + p.radius + 4;
            p.vx = Math.abs(p.vx);
          }
        } else {
          // Water can pass with probability based on permeability
          // Osmotic drive: water moves toward higher solute concentration (right side)
          const rightSolute = particles.filter(pp => pp.type === "solute" && pp.x > memX).length;
          const leftSolute = particles.filter(pp => pp.type === "solute" && pp.x < memX).length;
          const concDiff = rightSolute - leftSolute;

          let passChance = membranePermeability * 0.3 * dt;
          // Bias toward the side with more solute
          if (p.x < memX && concDiff > 0) {
            passChance *= 1 + concDiff * 0.3;
          } else if (p.x > memX && concDiff < 0) {
            passChance *= 1 + Math.abs(concDiff) * 0.3;
          }

          if (Math.random() < passChance) {
            // Allow crossing
            if (p.x < memX) {
              p.x = memX + p.radius + 5;
              p.vx = Math.abs(p.vx) * 0.5;
            } else {
              p.x = memX - p.radius - 5;
              p.vx = -Math.abs(p.vx) * 0.5;
            }
          } else {
            // Bounce
            if (p.x < memX) {
              p.x = memX - p.radius - 4;
              p.vx = -Math.abs(p.vx);
            } else {
              p.x = memX + p.radius + 4;
              p.vx = Math.abs(p.vx);
            }
          }
        }
      }
    }

    // Compute water level difference based on water distribution
    const leftWater = particles.filter(p => p.type === "water" && p.x < memX).length;
    const rightWater = particles.filter(p => p.type === "water" && p.x > memX).length;
    const totalWater = leftWater + rightWater;
    if (totalWater > 0) {
      const targetLevelDiff = ((rightWater - leftWater) / totalWater) * 40;
      waterLevelRight += (targetLevelDiff - waterLevelRight) * dt * 0.5;
      waterLevelLeft = -waterLevelRight;
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a1628");
    bgGrad.addColorStop(1, "#0d1f3c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawContainer(): void {
    const { left, right, top, bottom, memX } = getContainerBounds();

    ctx.save();

    // Water fill - left side
    const leftGrad = ctx.createLinearGradient(left, top, left, bottom);
    leftGrad.addColorStop(0, "rgba(40, 100, 200, 0.08)");
    leftGrad.addColorStop(1, "rgba(40, 100, 200, 0.2)");
    ctx.fillStyle = leftGrad;
    ctx.fillRect(left, top + waterLevelLeft, memX - left, bottom - top - waterLevelLeft);

    // Water fill - right side
    const rightGrad = ctx.createLinearGradient(memX, top, memX, bottom);
    rightGrad.addColorStop(0, "rgba(40, 100, 200, 0.08)");
    rightGrad.addColorStop(1, "rgba(40, 100, 200, 0.25)");
    ctx.fillStyle = rightGrad;
    ctx.fillRect(memX, top + waterLevelRight, right - memX, bottom - top - waterLevelRight);

    // Container outline
    ctx.strokeStyle = "rgba(120, 170, 230, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, right - left, bottom - top);

    // Membrane (dashed line)
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255, 200, 80, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(memX, top);
    ctx.lineTo(memX, bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Membrane pore indicators
    const poreCount = 8;
    for (let i = 1; i < poreCount; i++) {
      const py = top + (bottom - top) * (i / poreCount);
      ctx.beginPath();
      ctx.arc(memX, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 200, 80, 0.3)";
      ctx.fill();
    }

    // Labels
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.fillText("Low solute", (left + memX) / 2, top - 6);
    ctx.fillStyle = "rgba(255, 120, 100, 0.8)";
    ctx.fillText("High solute", (memX + right) / 2, top - 6);

    ctx.fillStyle = "rgba(255, 200, 80, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Semipermeable Membrane", memX, top - 20);

    // Water level indicators
    if (Math.abs(waterLevelLeft - waterLevelRight) > 2) {
      ctx.strokeStyle = "rgba(80, 200, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);

      // Left level line
      const leftLevelY = top + waterLevelLeft;
      ctx.beginPath();
      ctx.moveTo(left + 5, leftLevelY);
      ctx.lineTo(memX - 5, leftLevelY);
      ctx.stroke();

      // Right level line
      const rightLevelY = top + waterLevelRight;
      ctx.beginPath();
      ctx.moveTo(memX + 5, rightLevelY);
      ctx.lineTo(right - 5, rightLevelY);
      ctx.stroke();

      ctx.setLineDash([]);
    }

    // Direction arrow showing net water movement
    const leftWater = particles.filter(p => p.type === "water" && p.x < memX).length;
    const rightWater = particles.filter(p => p.type === "water" && p.x > memX).length;
    const rightSolute = particles.filter(p => p.type === "solute" && p.x > memX).length;

    if (rightSolute > 0) {
      const arrowY = bottom + 20;
      ctx.fillStyle = "rgba(80, 200, 255, 0.6)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Net water flow →", memX, arrowY);

      // Arrow
      ctx.strokeStyle = "rgba(80, 200, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(memX - 50, arrowY + 8);
      ctx.lineTo(memX + 40, arrowY + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(memX + 40, arrowY + 8);
      ctx.lineTo(memX + 32, arrowY + 4);
      ctx.moveTo(memX + 40, arrowY + 8);
      ctx.lineTo(memX + 32, arrowY + 12);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawParticles(): void {
    ctx.save();

    for (const p of particles) {
      if (p.type === "water") {
        // Small blue circle
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2);
        glow.addColorStop(0, "rgba(80, 160, 255, 0.8)");
        glow.addColorStop(1, "rgba(80, 160, 255, 0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 180, 255, 0.9)";
        ctx.fill();
      } else {
        // Larger solute particle (red/green mix)
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2);
        glow.addColorStop(0, "rgba(255, 100, 80, 0.5)");
        glow.addColorStop(1, "rgba(255, 100, 80, 0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        const soluteGrad = ctx.createRadialGradient(
          p.x - 1, p.y - 1, 0, p.x, p.y, p.radius
        );
        soluteGrad.addColorStop(0, "rgba(255, 140, 100, 0.95)");
        soluteGrad.addColorStop(1, "rgba(200, 60, 60, 0.9)");
        ctx.fillStyle = soluteGrad;
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 200, 180, 0.3)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();

    const panelW = 240;
    const panelH = 130;
    const panelX = 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Osmosis", panelX + 12, panelY + 10);

    ctx.font = "11px system-ui, sans-serif";

    // Count particles on each side
    const { memX } = getContainerBounds();
    const leftWater = particles.filter(p => p.type === "water" && p.x < memX).length;
    const rightWater = particles.filter(p => p.type === "water" && p.x > memX).length;
    const rightSolute = particles.filter(p => p.type === "solute" && p.x > memX).length;
    const leftSolute = particles.filter(p => p.type === "solute" && p.x < memX).length;

    const leftConc = leftWater + leftSolute > 0
      ? ((leftSolute / (leftWater + leftSolute)) * 100).toFixed(1) : "0.0";
    const rightConc = rightWater + rightSolute > 0
      ? ((rightSolute / (rightWater + rightSolute)) * 100).toFixed(1) : "0.0";

    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.fillText(`Left conc: ${leftConc}%`, panelX + 12, panelY + 32);

    ctx.fillStyle = "rgba(255, 120, 100, 0.8)";
    ctx.fillText(`Right conc: ${rightConc}%`, panelX + 12, panelY + 50);

    // Osmotic pressure: pi = iMRT (simplified approximation)
    // Using concentration difference as a proxy
    const concDiff = Math.abs(parseFloat(rightConc) - parseFloat(leftConc));
    const R = 8.314; // J/(mol*K)
    const T = temperature + 273.15; // Kelvin
    const osmoticPressure = concDiff * 0.01 * R * T * 0.1; // simplified kPa

    ctx.fillStyle = "rgba(255, 200, 80, 0.8)";
    ctx.fillText(`Osmotic pressure: ${osmoticPressure.toFixed(1)} kPa`, panelX + 12, panelY + 68);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    const levelDiff = Math.abs(waterLevelRight - waterLevelLeft).toFixed(1);
    ctx.fillText(`Water level diff: ${levelDiff} px`, panelX + 12, panelY + 86);
    ctx.fillText(`Temperature: ${temperature} °C`, panelX + 12, panelY + 104);

    ctx.restore();
  }

  function drawLegend(): void {
    ctx.save();

    const lx = width - 180;
    const ly = height - 48;

    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Water legend
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100, 180, 255, 0.9)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Water molecule (H₂O)", lx + 10, ly);

    // Solute legend
    ctx.beginPath();
    ctx.arc(lx, ly + 18, 5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 120, 80, 0.9)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Solute particle", lx + 10, ly + 18);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawContainer();
    drawParticles();
    drawInfoPanel();
    drawLegend();
  }

  function reset(): void {
    time = 0;
    waterLevelLeft = 0;
    waterLevelRight = 0;
    createParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const { memX } = getContainerBounds();
    const leftWater = particles.filter(p => p.type === "water" && p.x < memX).length;
    const rightWater = particles.filter(p => p.type === "water" && p.x > memX).length;
    const rightSolute = particles.filter(p => p.type === "solute" && p.x > memX).length;

    return (
      `Osmosis simulation showing water transport across a semipermeable membrane. ` +
      `Solute concentration: ${soluteConcentration}%. Membrane permeability: ${membranePermeability}. ` +
      `Temperature: ${temperature} °C. ` +
      `Left side: ${leftWater} water molecules. Right side: ${rightWater} water + ${rightSolute} solute particles. ` +
      `Water moves from low solute (left) to high solute (right) concentration via osmosis. ` +
      `The semipermeable membrane allows water to pass but blocks larger solute molecules. ` +
      `Higher temperature increases molecular motion. Osmotic pressure drives water toward the concentrated side.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default OsmosisFactory;
