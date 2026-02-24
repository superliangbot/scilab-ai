import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const Photosynthesis: SimulationFactory = () => {
  const config = getSimConfig("photosynthesis")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Environmental parameters
  let lightIntensity = 80; // percentage
  let co2Concentration = 400; // ppm
  let temperature = 25; // Celsius
  let waterAvailability = 90; // percentage
  let time = 0;

  // Molecules and particles
  interface Molecule {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "CO2" | "H2O" | "O2" | "glucose" | "photon";
    age: number;
    size: number;
  }

  const molecules: Molecule[] = [];
  const MAX_MOLECULES = 200;

  // Plant structure
  const LEAF_X = width * 0.3;
  const LEAF_Y = height * 0.4;
  const LEAF_WIDTH = 200;
  const LEAF_HEIGHT = 120;
  const CHLOROPLAST_SIZE = 8;
  
  // Photosynthesis metrics
  let photosynthesisRate = 0;
  let oxygenProduced = 0;
  let glucoseProduced = 0;
  let co2Consumed = 0;
  let waterConsumed = 0;

  // Colors
  const BG_COLOR = "#87ceeb"; // sky blue
  const LEAF_COLOR = "#22c55e";
  const CHLOROPLAST_COLOR = "#16a34a";
  const SUN_COLOR = "#fbbf24";
  const PHOTON_COLOR = "#fde047";
  const CO2_COLOR = "#6b7280";
  const H2O_COLOR = "#3b82f6";
  const O2_COLOR = "#ef4444";
  const GLUCOSE_COLOR = "#f97316";
  const TEXT_COLOR = "#1f2937";
  const TEXT_DIM = "#6b7280";

  function createMolecule(x: number, y: number, type: Molecule["type"]): Molecule {
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      type,
      age: 0,
      size: type === "photon" ? 2 : type === "glucose" ? 6 : 4,
    };
  }

  function updatePhotosynthesisRate() {
    // Simplified photosynthesis rate calculation
    // Rate depends on light, CO2, temperature, and water
    
    // Light limitation (0-1)
    const lightFactor = Math.min(1, lightIntensity / 100);
    
    // CO2 limitation (Michaelis-Menten-like)
    const co2Factor = co2Concentration / (co2Concentration + 200);
    
    // Temperature factor (optimal around 25°C)
    const tempFactor = Math.max(0, 1 - Math.abs(temperature - 25) / 30);
    
    // Water limitation
    const waterFactor = Math.min(1, waterAvailability / 100);
    
    photosynthesisRate = lightFactor * co2Factor * tempFactor * waterFactor * 100;
  }

  function updateMolecules(dt: number) {
    // Add photons from sun
    if (Math.random() < lightIntensity * 0.01 * dt) {
      if (molecules.length < MAX_MOLECULES) {
        molecules.push(createMolecule(
          Math.random() * width,
          -10,
          "photon"
        ));
      }
    }
    
    // Add CO2 from atmosphere
    if (Math.random() < co2Concentration * 0.001 * dt) {
      if (molecules.length < MAX_MOLECULES) {
        molecules.push(createMolecule(
          Math.random() * width,
          Math.random() * height * 0.3,
          "CO2"
        ));
      }
    }
    
    // Add water from roots
    if (Math.random() < waterAvailability * 0.01 * dt) {
      if (molecules.length < MAX_MOLECULES) {
        molecules.push(createMolecule(
          LEAF_X + Math.random() * LEAF_WIDTH,
          LEAF_Y + LEAF_HEIGHT + 10,
          "H2O"
        ));
      }
    }
    
    // Update existing molecules
    for (let i = molecules.length - 1; i >= 0; i--) {
      const molecule = molecules[i];
      molecule.age += dt;
      
      // Move molecules
      molecule.x += molecule.vx * dt;
      molecule.y += molecule.vy * dt;
      
      // Photosynthesis reactions in chloroplasts
      if (isInLeaf(molecule.x, molecule.y)) {
        if (molecule.type === "photon") {
          // Photons absorbed by chloroplasts
          molecules.splice(i, 1);
          continue;
        } else if (molecule.type === "CO2" && Math.random() < photosynthesisRate * 0.01 * dt) {
          // CO2 consumption
          molecules.splice(i, 1);
          co2Consumed++;
          
          // Chance to produce glucose (simplified - requires 6 CO2)
          if (Math.random() < 0.2) {
            molecules.push(createMolecule(
              molecule.x + (Math.random() - 0.5) * 20,
              molecule.y + (Math.random() - 0.5) * 20,
              "glucose"
            ));
            glucoseProduced++;
          }
          continue;
        } else if (molecule.type === "H2O" && Math.random() < photosynthesisRate * 0.01 * dt) {
          // Water consumption
          molecules.splice(i, 1);
          waterConsumed++;
          
          // Produce oxygen
          molecules.push(createMolecule(
            molecule.x + (Math.random() - 0.5) * 20,
            molecule.y + (Math.random() - 0.5) * 20,
            "O2"
          ));
          oxygenProduced++;
          continue;
        }
      }
      
      // Remove molecules that are too old or off-screen
      if (molecule.age > 10 || 
          molecule.x < -50 || molecule.x > width + 50 || 
          molecule.y < -50 || molecule.y > height + 50) {
        molecules.splice(i, 1);
      }
    }
  }

  function isInLeaf(x: number, y: number): boolean {
    // Simple elliptical leaf shape
    const centerX = LEAF_X + LEAF_WIDTH / 2;
    const centerY = LEAF_Y + LEAF_HEIGHT / 2;
    
    const dx = (x - centerX) / (LEAF_WIDTH / 2);
    const dy = (y - centerY) / (LEAF_HEIGHT / 2);
    
    return dx * dx + dy * dy <= 1;
  }

  function drawSun() {
    const sunX = width * 0.85;
    const sunY = height * 0.15;
    const sunRadius = 40;
    
    // Sun glow based on light intensity
    const alpha = lightIntensity / 100;
    const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 1.5);
    gradient.addColorStop(0, `rgba(253, 224, 71, ${alpha})`);
    gradient.addColorStop(1, `rgba(253, 224, 71, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Sun body
    ctx.fillStyle = SUN_COLOR;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Sun rays
    ctx.strokeStyle = SUN_COLOR;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const startRadius = sunRadius + 10;
      const endRadius = sunRadius + 25;
      
      ctx.beginPath();
      ctx.moveTo(
        sunX + Math.cos(angle) * startRadius,
        sunY + Math.sin(angle) * startRadius
      );
      ctx.lineTo(
        sunX + Math.cos(angle) * endRadius,
        sunY + Math.sin(angle) * endRadius
      );
      ctx.stroke();
    }
  }

  function drawLeaf() {
    const centerX = LEAF_X + LEAF_WIDTH / 2;
    const centerY = LEAF_Y + LEAF_HEIGHT / 2;
    
    // Leaf body (elliptical)
    ctx.fillStyle = LEAF_COLOR;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, LEAF_WIDTH / 2, LEAF_HEIGHT / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Leaf outline
    ctx.strokeStyle = "#15803d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, LEAF_WIDTH / 2, LEAF_HEIGHT / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // Leaf veins
    ctx.strokeStyle = "#15803d";
    ctx.lineWidth = 1;
    
    // Main vein
    ctx.beginPath();
    ctx.moveTo(centerX, LEAF_Y);
    ctx.lineTo(centerX, LEAF_Y + LEAF_HEIGHT);
    ctx.stroke();
    
    // Side veins
    for (let i = 1; i <= 3; i++) {
      const y = LEAF_Y + (i / 4) * LEAF_HEIGHT;
      const veinLength = LEAF_WIDTH * (0.3 - i * 0.05);
      
      ctx.beginPath();
      ctx.moveTo(centerX - veinLength, y);
      ctx.lineTo(centerX + veinLength, y);
      ctx.stroke();
    }
    
    // Chloroplasts
    ctx.fillStyle = CHLOROPLAST_COLOR;
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(LEAF_WIDTH, LEAF_HEIGHT) * 0.3;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      if (isInLeaf(x, y)) {
        ctx.beginPath();
        ctx.arc(x, y, CHLOROPLAST_SIZE, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawMolecules() {
    for (const molecule of molecules) {
      let color = "";
      let symbol = "";
      
      switch (molecule.type) {
        case "photon":
          color = PHOTON_COLOR;
          symbol = "⚡";
          break;
        case "CO2":
          color = CO2_COLOR;
          symbol = "C";
          break;
        case "H2O":
          color = H2O_COLOR;
          symbol = "W";
          break;
        case "O2":
          color = O2_COLOR;
          symbol = "O";
          break;
        case "glucose":
          color = GLUCOSE_COLOR;
          symbol = "G";
          break;
      }
      
      // Molecule circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(molecule.x, molecule.y, molecule.size, 0, Math.PI * 2);
      ctx.fill();
      
      // Molecule symbol
      if (molecule.size > 3) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(symbol, molecule.x, molecule.y);
      }
    }
  }

  function drawChemicalEquation() {
    const equationY = height * 0.85;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Main equation
    ctx.fillText("6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂", width / 2, equationY);
    
    // Component labels
    ctx.font = "12px monospace";
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Carbon dioxide + Water + Light → Glucose + Oxygen", width / 2, equationY + 20);
  }

  function drawPhotosynthesisStages() {
    const stageX = 50;
    const stageY = height * 0.15;
    const lineH = 20;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(stageX - 10, stageY - 10, 250, lineH * 8 + 20);
    
    ctx.strokeStyle = "rgba(107, 114, 128, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(stageX - 10, stageY - 10, 250, lineH * 8 + 20);
    
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let y = stageY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Photosynthesis Stages:", stageX, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    
    ctx.fillText("1. Light Reactions (Thylakoids):", stageX, y);
    y += lineH;
    ctx.fillText("   • Light absorbed by chlorophyll", stageX, y);
    y += lineH;
    ctx.fillText("   • Water split to release O₂", stageX, y);
    y += lineH;
    ctx.fillText("   • Energy stored in ATP & NADPH", stageX, y);
    y += lineH;
    
    ctx.fillText("2. Calvin Cycle (Stroma):", stageX, y);
    y += lineH;
    ctx.fillText("   • CO₂ fixed into organic molecules", stageX, y);
    y += lineH;
    ctx.fillText("   • Glucose produced using ATP", stageX, y);
  }

  function drawEnvironmentalFactors() {
    const factorX = width - 280;
    const factorY = 50;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(factorX - 10, factorY - 10, 270, lineH * 10 + 20);
    
    ctx.strokeStyle = "rgba(107, 114, 128, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(factorX - 10, factorY - 10, 270, lineH * 10 + 20);
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = factorX;
    let y = factorY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Environmental Factors", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    
    ctx.fillText(`Light Intensity: ${lightIntensity.toFixed(0)}%`, x, y);
    y += lineH;
    
    ctx.fillText(`CO₂ Concentration: ${co2Concentration.toFixed(0)} ppm`, x, y);
    y += lineH;
    
    ctx.fillText(`Temperature: ${temperature.toFixed(1)}°C`, x, y);
    y += lineH;
    
    ctx.fillText(`Water Availability: ${waterAvailability.toFixed(0)}%`, x, y);
    y += lineH;
    
    ctx.fillStyle = photosynthesisRate > 50 ? "#22c55e" : photosynthesisRate > 20 ? "#fbbf24" : "#ef4444";
    ctx.fillText(`Photosynthesis Rate: ${photosynthesisRate.toFixed(1)}%`, x, y);
    y += lineH * 1.5;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Products Generated:", x, y);
    y += lineH;
    
    ctx.fillText(`O₂ Released: ${oxygenProduced}`, x, y);
    y += lineH;
    
    ctx.fillText(`Glucose Made: ${glucoseProduced}`, x, y);
    y += lineH;
    
    ctx.fillText(`CO₂ Consumed: ${co2Consumed}`, x, y);
  }

  function drawMoleculeCounter() {
    const counts = {
      photon: molecules.filter(m => m.type === "photon").length,
      CO2: molecules.filter(m => m.type === "CO2").length,
      H2O: molecules.filter(m => m.type === "H2O").length,
      O2: molecules.filter(m => m.type === "O2").length,
      glucose: molecules.filter(m => m.type === "glucose").length
    };
    
    const counterX = 50;
    const counterY = height - 120;
    const lineH = 16;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(counterX - 10, counterY - 10, 200, lineH * 6 + 20);
    
    ctx.strokeStyle = "rgba(107, 114, 128, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(counterX - 10, counterY - 10, 200, lineH * 6 + 20);
    
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = counterX;
    let y = counterY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Molecule Count:", x, y);
    y += lineH;
    
    const moleculeTypes = [
      { type: "photon", color: PHOTON_COLOR, symbol: "⚡", name: "Photons" },
      { type: "CO2", color: CO2_COLOR, symbol: "C", name: "CO₂" },
      { type: "H2O", color: H2O_COLOR, symbol: "W", name: "H₂O" },
      { type: "O2", color: O2_COLOR, symbol: "O", name: "O₂" },
      { type: "glucose", color: GLUCOSE_COLOR, symbol: "G", name: "Glucose" }
    ];
    
    for (const mol of moleculeTypes) {
      ctx.fillStyle = mol.color;
      ctx.fillRect(x, y + 3, 10, 10);
      
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(`${mol.name}: ${counts[mol.type as keyof typeof counts]}`, x + 15, y);
      y += lineH;
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      lightIntensity = params.lightIntensity ?? lightIntensity;
      co2Concentration = params.co2Concentration ?? co2Concentration;
      temperature = params.temperature ?? temperature;
      waterAvailability = params.waterAvailability ?? waterAvailability;
      
      time += dt;
      
      updatePhotosynthesisRate();
      updateMolecules(dt);
    },

    render() {
      // Sky background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#87ceeb");
      gradient.addColorStop(1, "#e0f2ff");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Draw sun
      drawSun();
      
      // Draw leaf
      drawLeaf();
      
      // Draw molecules
      drawMolecules();
      
      // Draw chemical equation
      drawChemicalEquation();
      
      // Draw information panels
      drawPhotosynthesisStages();
      drawEnvironmentalFactors();
      drawMoleculeCounter();
    },

    reset() {
      time = 0;
      molecules.length = 0;
      oxygenProduced = 0;
      glucoseProduced = 0;
      co2Consumed = 0;
      waterConsumed = 0;
      photosynthesisRate = 0;
    },

    destroy() {
      molecules.length = 0;
    },

    getStateDescription(): string {
      const moleculeCounts = {
        photons: molecules.filter(m => m.type === "photon").length,
        co2: molecules.filter(m => m.type === "CO2").length,
        water: molecules.filter(m => m.type === "H2O").length,
        oxygen: molecules.filter(m => m.type === "O2").length,
        glucose: molecules.filter(m => m.type === "glucose").length
      };
      
      return (
        `Photosynthesis: Converting light energy into chemical energy. ` +
        `Environmental conditions - Light: ${lightIntensity}%, CO₂: ${co2Concentration}ppm, ` +
        `Temperature: ${temperature}°C, Water: ${waterAvailability}%. ` +
        `Photosynthesis rate: ${photosynthesisRate.toFixed(1)}%. ` +
        `Active molecules - Photons: ${moleculeCounts.photons}, CO₂: ${moleculeCounts.co2}, ` +
        `H₂O: ${moleculeCounts.water}, O₂: ${moleculeCounts.oxygen}, Glucose: ${moleculeCounts.glucose}. ` +
        `Products generated: ${oxygenProduced} O₂, ${glucoseProduced} glucose. ` +
        `Process: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default Photosynthesis;