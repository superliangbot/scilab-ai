import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "water" | "solute" | "ion_pos" | "ion_neg";
  color: string;
  dissolved: boolean;
  radius: number;
}

const DissolutionFactory = (): SimulationEngine => {
  const config = getSimConfig("dissolution-process") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};
  let particles: Particle[] = [];
  let dissolvedCount = 0;

  const soluteTypes = [
    { name: "Ink", color: "#1e1e1e", ionicPos: null, ionicNeg: null },
    { name: "NaCl", color: "#94a3b8", ionicPos: "#ec4899", ionicNeg: "#22c55e" },
    { name: "CuSO₄", color: "#3b82f6", ionicPos: "#f97316", ionicNeg: "#06b6d4" },
    { name: "KMnO₄", color: "#7c3aed", ionicPos: "#94a3b8", ionicNeg: "#a855f7" },
  ];

  function createParticles(): void {
    particles = [];
    dissolvedCount = 0;

    const waterRegion = {
      left: width * 0.1,
      right: width * 0.9,
      top: height * 0.25,
      bottom: height * 0.85,
    };

    // Water molecules
    const numWater = 60;
    for (let i = 0; i < numWater; i++) {
      particles.push({
        x: waterRegion.left + Math.random() * (waterRegion.right - waterRegion.left),
        y: waterRegion.top + Math.random() * (waterRegion.bottom - waterRegion.top),
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        type: "water",
        color: "#60a5fa",
        dissolved: false,
        radius: 3,
      });
    }

    // Solute crystal (cluster at top center)
    const soluteType = Math.round(currentParams.soluteType ?? 0);
    const solute = soluteTypes[soluteType];
    const crystalCenterX = width / 2;
    const crystalTopY = waterRegion.top + 10;

    const numSolute = 20;
    const crystalRows = 4;
    const crystalCols = 5;

    for (let r = 0; r < crystalRows; r++) {
      for (let c = 0; c < crystalCols; c++) {
        if (r * crystalCols + c >= numSolute) break;
        const x = crystalCenterX - (crystalCols * 12) / 2 + c * 12 + (r % 2) * 6;
        const y = crystalTopY + r * 10;

        if (solute.ionicPos && solute.ionicNeg) {
          // Ionic compound: alternate positive and negative ions
          const isPos = (r + c) % 2 === 0;
          particles.push({
            x, y,
            vx: 0, vy: 0,
            type: isPos ? "ion_pos" : "ion_neg",
            color: isPos ? solute.ionicPos : solute.ionicNeg,
            dissolved: false,
            radius: 5,
          });
        } else {
          particles.push({
            x, y,
            vx: 0, vy: 0,
            type: "solute",
            color: solute.color,
            dissolved: false,
            radius: 5,
          });
        }
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    createParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const oldType = Math.round(currentParams.soluteType ?? 0);
    currentParams = params;
    const newType = Math.round(params.soluteType ?? 0);
    if (oldType !== newType) createParticles();

    const temperature = params.temperature ?? 25;
    const stirring = params.stirring ?? 0;
    const speedFactor = Math.sqrt((temperature + 273) / 300);

    const waterRegion = {
      left: width * 0.1,
      right: width * 0.9,
      top: height * 0.25,
      bottom: height * 0.85,
    };

    dissolvedCount = 0;

    for (const p of particles) {
      if (p.type === "water" || p.dissolved) {
        // Thermal motion
        p.vx += (Math.random() - 0.5) * 60 * dt * speedFactor;
        p.vy += (Math.random() - 0.5) * 60 * dt * speedFactor;

        // Stirring adds rotational flow
        if (stirring > 0) {
          const dx = p.x - width / 2;
          const dy = p.y - (waterRegion.top + waterRegion.bottom) / 2;
          p.vx += -dy * stirring * 0.005;
          p.vy += dx * stirring * 0.005;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Boundary
        if (p.x < waterRegion.left) { p.x = waterRegion.left; p.vx = Math.abs(p.vx); }
        if (p.x > waterRegion.right) { p.x = waterRegion.right; p.vx = -Math.abs(p.vx); }
        if (p.y < waterRegion.top) { p.y = waterRegion.top; p.vy = Math.abs(p.vy); }
        if (p.y > waterRegion.bottom) { p.y = waterRegion.bottom; p.vy = -Math.abs(p.vy); }

        // Speed limit
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpeed = 60 * speedFactor;
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        if (p.dissolved) dissolvedCount++;
      } else {
        // Undissolved solute: check for dissolution
        // Probability increases with temperature and water proximity
        let nearWater = 0;
        for (const w of particles) {
          if (w.type === "water") {
            const dx = p.x - w.x;
            const dy = p.y - w.y;
            if (dx * dx + dy * dy < 400) nearWater++;
          }
        }

        const dissolveProbability = nearWater * 0.001 * speedFactor * dt * (1 + stirring * 0.5);
        if (Math.random() < dissolveProbability) {
          p.dissolved = true;
          p.vx = (Math.random() - 0.5) * 30 * speedFactor;
          p.vy = (Math.random() - 0.5) * 30 * speedFactor;
          p.radius = 4;
        } else {
          // Slight gravity for undissolved particles
          p.vy += 5 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (p.y > waterRegion.bottom - 5) {
            p.y = waterRegion.bottom - 5;
            p.vy = 0;
          }
        }
      }
    }

    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const soluteType = Math.round(currentParams.soluteType ?? 0);
    const temperature = currentParams.temperature ?? 25;

    const waterRegion = {
      left: width * 0.1,
      right: width * 0.9,
      top: height * 0.25,
      bottom: height * 0.85,
    };

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Dissolution Process — ${soluteTypes[soluteType].name} in Water`, width / 2, 28);

    // Beaker
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(waterRegion.left - 5, waterRegion.top - 10);
    ctx.lineTo(waterRegion.left - 5, waterRegion.bottom + 5);
    ctx.lineTo(waterRegion.right + 5, waterRegion.bottom + 5);
    ctx.lineTo(waterRegion.right + 5, waterRegion.top - 10);
    ctx.stroke();

    // Water fill
    const dissolvedRatio = dissolvedCount / Math.max(1, particles.filter(p => p.type !== "water").length);
    const soluteColor = soluteTypes[soluteType].color;
    const waterAlpha = 0.15 + dissolvedRatio * 0.25;

    const waterGrad = ctx.createLinearGradient(0, waterRegion.top, 0, waterRegion.bottom);
    waterGrad.addColorStop(0, `rgba(96, 165, 250, 0.1)`);
    waterGrad.addColorStop(1, `rgba(96, 165, 250, ${waterAlpha})`);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(waterRegion.left, waterRegion.top, waterRegion.right - waterRegion.left, waterRegion.bottom - waterRegion.top);

    // Dissolved color tint
    if (dissolvedRatio > 0.01) {
      ctx.fillStyle = soluteColor;
      ctx.globalAlpha = dissolvedRatio * 0.15;
      ctx.fillRect(waterRegion.left, waterRegion.top, waterRegion.right - waterRegion.left, waterRegion.bottom - waterRegion.top);
      ctx.globalAlpha = 1;
    }

    // Draw water molecules
    for (const p of particles) {
      if (p.type === "water") {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Draw solute particles
    for (const p of particles) {
      if (p.type === "water") continue;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.dissolved ? 0.8 : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Ion labels
      if (p.type === "ion_pos" && p.dissolved) {
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${6}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", p.x, p.y);
      } else if (p.type === "ion_neg" && p.dissolved) {
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${6}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("−", p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }
    ctx.textBaseline = "alphabetic";

    // Info panel
    const totalSolute = particles.filter(p => p.type !== "water").length;
    const panelX = 15;
    const panelY = height - 85;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 250, 70);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 250, 70);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`Solute: ${soluteTypes[soluteType].name}`, panelX + 10, panelY + 18);
    ctx.fillText(`Temperature: ${temperature.toFixed(0)}°C`, panelX + 10, panelY + 38);
    ctx.fillText(`Dissolved: ${dissolvedCount}/${totalSolute} (${(dissolvedRatio * 100).toFixed(0)}%)`, panelX + 10, panelY + 58);

    // Legend
    const legX = width - 160;
    const legY = height - 85;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(legX, legY, 145, 70);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(legX, legY, 145, 70);

    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("● Water (H₂O)", legX + 10, legY + 18);
    ctx.fillStyle = soluteTypes[soluteType].color;
    ctx.fillText("● Solute", legX + 10, legY + 36);
    if (soluteTypes[soluteType].ionicPos) {
      ctx.fillStyle = soluteTypes[soluteType].ionicPos!;
      ctx.fillText("● Cation (+)", legX + 10, legY + 52);
      ctx.fillStyle = soluteTypes[soluteType].ionicNeg!;
      ctx.fillText("● Anion (−)", legX + 10, legY + 66);
    }

    // Temperature indicator
    const tempBarX = waterRegion.right + 20;
    const tempBarY = waterRegion.top;
    const tempBarH = waterRegion.bottom - waterRegion.top;
    const tempBarW = 15;

    // Thermometer
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(tempBarX, tempBarY, tempBarW, tempBarH);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(tempBarX, tempBarY, tempBarW, tempBarH);

    const tempFill = (temperature - 0) / 100;
    const tempFillH = tempFill * tempBarH;
    const tempGrad = ctx.createLinearGradient(0, tempBarY + tempBarH, 0, tempBarY);
    tempGrad.addColorStop(0, "#3b82f6");
    tempGrad.addColorStop(0.5, "#f59e0b");
    tempGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = tempGrad;
    ctx.fillRect(tempBarX + 2, tempBarY + tempBarH - tempFillH, tempBarW - 4, tempFillH);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${temperature.toFixed(0)}°C`, tempBarX + tempBarW / 2, tempBarY - 5);
  }

  function reset(): void {
    time = 0;
    dissolvedCount = 0;
    createParticles();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const soluteType = Math.round(currentParams.soluteType ?? 0);
    const temperature = currentParams.temperature ?? 25;
    const totalSolute = particles.filter(p => p.type !== "water").length;
    const ratio = dissolvedCount / Math.max(1, totalSolute);

    return `Dissolution simulation: ${soluteTypes[soluteType].name} dissolving in water at ${temperature.toFixed(0)}°C. ${dissolvedCount}/${totalSolute} particles dissolved (${(ratio * 100).toFixed(0)}%). Dissolution occurs when solvent molecules (water) interact with solute particles through intermolecular forces, overcoming the lattice energy holding the solid together. Higher temperature increases molecular kinetic energy, speeding dissolution. Ionic compounds like NaCl dissociate into individual ions (Na⁺ and Cl⁻) surrounded by water molecules (hydration shells).`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DissolutionFactory;
