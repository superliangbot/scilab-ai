import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Molecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "H2" | "O2" | "H2O" | "e-";
  opacity: number;
  region: "anode" | "membrane" | "cathode" | "circuit";
}

const FuelCellFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("fuel-cell") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let hydrogenRate = 5;
  let oxygenRate = 3;
  let temperature = 80;

  let molecules: Molecule[] = [];
  let electronFlow = 0;
  let waterProduced = 0;
  let voltage = 0;

  function initState() {
    time = 0;
    molecules = [];
    electronFlow = 0;
    waterProduced = 0;
    voltage = 0;

    // Initial hydrogen molecules on anode side
    for (let i = 0; i < 20; i++) {
      molecules.push(createMolecule("H2", "anode"));
    }
    // Initial oxygen molecules on cathode side
    for (let i = 0; i < 10; i++) {
      molecules.push(createMolecule("O2", "cathode"));
    }
  }

  function createMolecule(type: Molecule["type"], region: Molecule["region"]): Molecule {
    const cellLeft = width * 0.15;
    const cellRight = width * 0.85;
    const membrane = width * 0.5;
    const topY = height * 0.2;
    const botY = height * 0.75;

    let x = 0, y = 0;
    if (region === "anode") {
      x = cellLeft + Math.random() * (membrane - cellLeft - 20);
      y = topY + Math.random() * (botY - topY);
    } else if (region === "cathode") {
      x = membrane + 20 + Math.random() * (cellRight - membrane - 20);
      y = topY + Math.random() * (botY - topY);
    } else {
      x = membrane;
      y = topY + Math.random() * (botY - topY);
    }

    return {
      x, y,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      type,
      opacity: 1,
      region,
    };
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0c1222");
    grad.addColorStop(1, "#1a2332");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawFuelCell() {
    const cellLeft = width * 0.15;
    const cellRight = width * 0.85;
    const membrane = width * 0.5;
    const topY = height * 0.2;
    const botY = height * 0.75;

    // Anode chamber
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(cellLeft, topY, membrane - cellLeft, botY - topY);

    // Cathode chamber
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(membrane, topY, cellRight - membrane, botY - topY);

    // Cell border
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(cellLeft, topY, cellRight - cellLeft, botY - topY);

    // Membrane (PEM)
    ctx.fillStyle = "rgba(168, 85, 247, 0.3)";
    ctx.fillRect(membrane - 4, topY, 8, botY - topY);
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 1;
    ctx.strokeRect(membrane - 4, topY, 8, botY - topY);

    // Electrodes
    ctx.fillStyle = "#64748b";
    ctx.fillRect(cellLeft, topY, 6, botY - topY); // Anode
    ctx.fillRect(cellRight - 6, topY, 6, botY - topY); // Cathode

    // Labels
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ANODE (−)", (cellLeft + membrane) / 2, topY - 8);

    ctx.fillStyle = "#ef4444";
    ctx.fillText("CATHODE (+)", (membrane + cellRight) / 2, topY - 8);

    ctx.fillStyle = "#a855f7";
    ctx.font = "12px sans-serif";
    ctx.fillText("PEM", membrane, topY - 8);

    // Hydrogen input arrow
    ctx.fillStyle = "#60a5fa";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("H₂ in →", cellLeft - 5, topY + 30);

    // Oxygen input arrow
    ctx.fillStyle = "#f87171";
    ctx.textAlign = "left";
    ctx.fillText("← O₂ in", cellRight + 5, topY + 30);

    // Water output
    ctx.fillStyle = "#22d3ee";
    ctx.textAlign = "left";
    ctx.fillText("← H₂O out", cellRight + 5, botY - 10);

    // External circuit (electron path)
    drawCircuit(cellLeft, cellRight, topY);
  }

  function drawCircuit(cellLeft: number, cellRight: number, topY: number) {
    const wireY = topY - 40;

    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cellLeft + 3, topY);
    ctx.lineTo(cellLeft + 3, wireY);
    ctx.lineTo(cellRight - 3, wireY);
    ctx.lineTo(cellRight - 3, topY);
    ctx.stroke();

    // Light bulb
    const bulbX = (cellLeft + cellRight) / 2;
    const bulbR = 12;
    ctx.beginPath();
    ctx.arc(bulbX, wireY, bulbR, 0, Math.PI * 2);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glow based on electron flow
    const brightness = Math.min(1, electronFlow / 10);
    if (brightness > 0.1) {
      const glow = ctx.createRadialGradient(bulbX, wireY, 0, bulbX, wireY, bulbR * 3);
      glow.addColorStop(0, `rgba(250, 204, 21, ${brightness * 0.6})`);
      glow.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bulbX, wireY, bulbR * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(250, 204, 21, ${brightness})`;
      ctx.beginPath();
      ctx.arc(bulbX, wireY, bulbR * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Electron arrows along wire
    ctx.fillStyle = "#fbbf24";
    const numArrows = 5;
    for (let i = 0; i < numArrows; i++) {
      const frac = ((time * 0.5 + i / numArrows) % 1);
      const totalLen = (cellRight - cellLeft) * 2;
      const pos = frac * totalLen;
      let ex: number, ey: number;
      if (pos < cellRight - cellLeft) {
        ex = cellLeft + 3 + pos;
        ey = wireY;
      } else {
        ex = cellRight - 3;
        ey = wireY;
      }
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("e⁻", ex, ey - 5);
    }

    ctx.fillStyle = "#f59e0b";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("e⁻ flow →", (cellLeft + cellRight) / 2, wireY - 16);
  }

  function drawMolecules() {
    for (const mol of molecules) {
      if (mol.opacity <= 0) continue;
      ctx.globalAlpha = mol.opacity;

      if (mol.type === "H2") {
        // Blue circles
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(mol.x - 4, mol.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mol.x + 4, mol.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mol.x - 4, mol.y);
        ctx.lineTo(mol.x + 4, mol.y);
        ctx.stroke();
      } else if (mol.type === "O2") {
        // Red circles
        ctx.fillStyle = "#f87171";
        ctx.beginPath();
        ctx.arc(mol.x - 5, mol.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mol.x + 5, mol.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fca5a5";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mol.x - 5, mol.y);
        ctx.lineTo(mol.x + 5, mol.y);
        ctx.stroke();
      } else if (mol.type === "H2O") {
        // Water: oxygen red + two hydrogen blue
        ctx.fillStyle = "#f87171";
        ctx.beginPath();
        ctx.arc(mol.x, mol.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(mol.x - 6, mol.y + 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mol.x + 6, mol.y + 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (mol.type === "e-") {
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(mol.x, mol.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }
  }

  function drawReactions() {
    const botY = height * 0.75;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";

    // Anode reaction
    ctx.fillStyle = "#93c5fd";
    ctx.fillText("2H₂ → 4H⁺ + 4e⁻", width * 0.32, botY + 25);

    // Cathode reaction
    ctx.fillStyle = "#fca5a5";
    ctx.fillText("O₂ + 4H⁺ + 4e⁻ → 2H₂O", width * 0.68, botY + 25);

    // Overall
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px monospace";
    ctx.fillText("Overall: 2H₂ + O₂ → 2H₂O + Energy", width / 2, botY + 50);
  }

  function drawStats() {
    const px = 10;
    const py = height - 100;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(px, py, 200, 90, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Voltage: ${voltage.toFixed(2)} V`, px + 10, py + 20);
    ctx.fillText(`Current: ${electronFlow.toFixed(1)} mA`, px + 10, py + 38);
    ctx.fillText(`H₂O produced: ${waterProduced.toFixed(0)} molecules`, px + 10, py + 56);
    ctx.fillText(`Temp: ${temperature}°C`, px + 10, py + 74);
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Hydrogen Fuel Cell", width / 2, 24);
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
      hydrogenRate = params.hydrogenRate ?? 5;
      oxygenRate = params.oxygenRate ?? 3;
      temperature = params.temperature ?? 80;

      time += dt;

      const cellLeft = width * 0.15;
      const cellRight = width * 0.85;
      const membrane = width * 0.5;
      const topY = height * 0.2;
      const botY = height * 0.75;

      // Add new hydrogen molecules
      if (Math.random() < hydrogenRate * dt * 0.3) {
        molecules.push(createMolecule("H2", "anode"));
      }

      // Add new oxygen molecules
      if (Math.random() < oxygenRate * dt * 0.3) {
        molecules.push(createMolecule("O2", "cathode"));
      }

      // Fuel cell voltage depends on temperature
      voltage = 0.6 + 0.4 * Math.min(1, hydrogenRate / 10) * Math.min(1, oxygenRate / 8);
      electronFlow = voltage * 10 * (temperature / 100);

      // Update molecules
      const speed = 1 + temperature / 100;
      for (const mol of molecules) {
        mol.vx += (Math.random() - 0.5) * 20 * speed;
        mol.vy += (Math.random() - 0.5) * 20 * speed;
        mol.vx *= 0.95;
        mol.vy *= 0.95;
        mol.x += mol.vx * dt;
        mol.y += mol.vy * dt;

        // Boundary logic based on region
        if (mol.region === "anode") {
          if (mol.x < cellLeft + 10) { mol.x = cellLeft + 10; mol.vx *= -1; }
          if (mol.x > membrane - 10) {
            // H2 near membrane → split into H+ (passes through)
            if (mol.type === "H2" && Math.random() < 0.02 * dt) {
              mol.type = "e-";
              mol.region = "circuit";
              // Create an H+ that passes through membrane
              molecules.push({
                x: membrane + 10,
                y: mol.y,
                vx: 30,
                vy: (Math.random() - 0.5) * 20,
                type: "H2O",
                opacity: 0,
                region: "cathode",
              });
              waterProduced += 0.5;
            } else {
              mol.x = membrane - 10;
              mol.vx *= -1;
            }
          }
        } else if (mol.region === "cathode") {
          if (mol.x < membrane + 10) { mol.x = membrane + 10; mol.vx *= -1; }
          if (mol.x > cellRight - 10) { mol.x = cellRight - 10; mol.vx *= -1; }

          // O2 near membrane → form water
          if (mol.type === "O2" && mol.x < membrane + 40 && Math.random() < 0.01 * dt) {
            mol.type = "H2O";
            mol.opacity = 1;
            waterProduced += 1;
          }

          // Fade in H2O
          if (mol.type === "H2O" && mol.opacity < 1) {
            mol.opacity = Math.min(1, mol.opacity + dt);
          }
        }

        // Vertical bounds
        if (mol.y < topY + 5) { mol.y = topY + 5; mol.vy *= -1; }
        if (mol.y > botY - 5) { mol.y = botY - 5; mol.vy *= -1; }
      }

      // Remove excess molecules
      if (molecules.length > 200) {
        molecules = molecules.filter(m => m.opacity > 0 || m.type !== "H2O");
        if (molecules.length > 200) {
          molecules = molecules.slice(-180);
        }
      }
    },

    render() {
      drawBackground();
      drawFuelCell();
      drawMolecules();
      drawReactions();
      drawStats();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {
      molecules = [];
    },

    getStateDescription(): string {
      const h2Count = molecules.filter(m => m.type === "H2").length;
      const o2Count = molecules.filter(m => m.type === "O2").length;
      const h2oCount = molecules.filter(m => m.type === "H2O" && m.opacity > 0.5).length;
      return `Fuel Cell: H₂=${h2Count}, O₂=${o2Count}, H₂O=${h2oCount}. Voltage: ${voltage.toFixed(2)}V, Current: ${electronFlow.toFixed(1)}mA. Temperature: ${temperature}°C. Total water produced: ${waterProduced.toFixed(0)}. Reaction: 2H₂ + O₂ → 2H₂O + electrical energy.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default FuelCellFactory;
