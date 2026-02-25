import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Adiabatic Gas Process
 * No heat transfer: Q = 0, so ΔU = -W
 * Adiabatic law: PVᵞ = constant, TVᵞ⁻¹ = constant
 * Shows compression heating and expansion cooling
 */

const AdiabaticGasProcessFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("adiabatic-gas-process") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Process parameters
  let initialPressure = 1; // atm
  let initialVolume = 2; // L
  let initialTemperature = 300; // K
  let gamma = 1.4; // Heat capacity ratio (diatomic gas)
  let processType = 0; // 0=compression, 1=expansion, 2=oscillation

  let currentState = { P: 1, V: 2, T: 300 };
  let targetVolume = 1;
  let processSpeed = 1;

  // Gas molecules for visualization
  const molecules: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    speed: number;
  }> = [];

  const CYLINDER_X = 100;
  const CYLINDER_Y = 150;
  const CYLINDER_WIDTH = 200;
  const MAX_CYLINDER_HEIGHT = 300;

  // P-V diagram
  const PV_X = 350;
  const PV_Y = 100;
  const PV_WIDTH = 250;
  const PV_HEIGHT = 200;
  
  const pvHistory: Array<{ P: number; V: number }> = [];

  function initializeMolecules() {
    molecules.length = 0;
    const numMolecules = Math.floor(currentState.V * 30);
    
    for (let i = 0; i < numMolecules; i++) {
      const speed = Math.sqrt(currentState.T / 300) * 2;
      
      molecules.push({
        x: CYLINDER_X + 10 + Math.random() * (CYLINDER_WIDTH - 20),
        y: CYLINDER_Y + 10 + Math.random() * (getCylinderHeight() - 20),
        vx: (Math.random() - 0.5) * speed * 100,
        vy: (Math.random() - 0.5) * speed * 100,
        speed: speed
      });
    }
  }

  function getCylinderHeight(): number {
    return Math.max(50, currentState.V / 3 * MAX_CYLINDER_HEIGHT);
  }

  function calculateAdiabaticState(volume: number): { P: number; T: number } {
    // Adiabatic relations: PVᵞ = constant, TVᵞ⁻¹ = constant
    const constant1 = initialPressure * Math.pow(initialVolume, gamma);
    const constant2 = initialTemperature * Math.pow(initialVolume, gamma - 1);
    
    const P = constant1 / Math.pow(volume, gamma);
    const T = constant2 / Math.pow(volume, gamma - 1);
    
    return { P, T };
  }

  function updateMolecules(dt: number) {
    const cylinderHeight = getCylinderHeight();
    const speedScale = Math.sqrt(currentState.T / 300);
    
    molecules.forEach((molecule, i) => {
      // Scale velocity based on temperature
      const currentSpeed = molecule.speed * speedScale;
      const velocityMagnitude = Math.sqrt(molecule.vx * molecule.vx + molecule.vy * molecule.vy);
      
      if (velocityMagnitude > 0) {
        molecule.vx = (molecule.vx / velocityMagnitude) * currentSpeed * 100;
        molecule.vy = (molecule.vy / velocityMagnitude) * currentSpeed * 100;
      }
      
      // Update positions
      molecule.x += molecule.vx * dt;
      molecule.y += molecule.vy * dt;
      
      // Wall collisions
      if (molecule.x <= CYLINDER_X + 5) {
        molecule.x = CYLINDER_X + 5;
        molecule.vx = Math.abs(molecule.vx);
      }
      if (molecule.x >= CYLINDER_X + CYLINDER_WIDTH - 5) {
        molecule.x = CYLINDER_X + CYLINDER_WIDTH - 5;
        molecule.vx = -Math.abs(molecule.vx);
      }
      if (molecule.y <= CYLINDER_Y + 5) {
        molecule.y = CYLINDER_Y + 5;
        molecule.vy = Math.abs(molecule.vy);
      }
      if (molecule.y >= CYLINDER_Y + cylinderHeight - 5) {
        molecule.y = CYLINDER_Y + cylinderHeight - 5;
        molecule.vy = -Math.abs(molecule.vy);
      }
    });
    
    // Add or remove molecules based on volume change
    const targetNumMolecules = Math.floor(currentState.V * 30);
    
    while (molecules.length < targetNumMolecules) {
      const speed = Math.sqrt(currentState.T / 300) * 2;
      molecules.push({
        x: CYLINDER_X + 10 + Math.random() * (CYLINDER_WIDTH - 20),
        y: CYLINDER_Y + 10 + Math.random() * (cylinderHeight - 20),
        vx: (Math.random() - 0.5) * speed * 100,
        vy: (Math.random() - 0.5) * speed * 100,
        speed: speed
      });
    }
    
    while (molecules.length > targetNumMolecules) {
      molecules.pop();
    }
  }

  function drawCylinder() {
    const cylinderHeight = getCylinderHeight();
    
    // Cylinder walls
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    
    // Bottom
    ctx.beginPath();
    ctx.moveTo(CYLINDER_X, CYLINDER_Y + cylinderHeight);
    ctx.lineTo(CYLINDER_X + CYLINDER_WIDTH, CYLINDER_Y + cylinderHeight);
    ctx.stroke();
    
    // Sides
    ctx.beginPath();
    ctx.moveTo(CYLINDER_X, CYLINDER_Y);
    ctx.lineTo(CYLINDER_X, CYLINDER_Y + cylinderHeight);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(CYLINDER_X + CYLINDER_WIDTH, CYLINDER_Y);
    ctx.lineTo(CYLINDER_X + CYLINDER_WIDTH, CYLINDER_Y + cylinderHeight);
    ctx.stroke();
    
    // Piston
    const pistonY = CYLINDER_Y + cylinderHeight - 10;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(CYLINDER_X - 5, pistonY, CYLINDER_WIDTH + 10, 20);
    
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(CYLINDER_X - 5, pistonY, CYLINDER_WIDTH + 10, 20);
    
    // Piston rod
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(CYLINDER_X + CYLINDER_WIDTH / 2, pistonY + 20);
    ctx.lineTo(CYLINDER_X + CYLINDER_WIDTH / 2, CYLINDER_Y + MAX_CYLINDER_HEIGHT + 50);
    ctx.stroke();
    
    // Gas color based on temperature
    const tempRatio = (currentState.T - 200) / (600 - 200);
    const hue = Math.max(0, Math.min(240, 240 - tempRatio * 240)); // Blue to red
    
    ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.3)`;
    ctx.fillRect(CYLINDER_X + 1, CYLINDER_Y + 1, CYLINDER_WIDTH - 2, cylinderHeight - 12);
    
    // Temperature and pressure indicators
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`P = ${currentState.P.toFixed(2)} atm`, CYLINDER_X + CYLINDER_WIDTH / 2, CYLINDER_Y - 30);
    ctx.fillText(`V = ${currentState.V.toFixed(2)} L`, CYLINDER_X + CYLINDER_WIDTH / 2, CYLINDER_Y - 10);
    ctx.fillText(`T = ${currentState.T.toFixed(0)} K`, CYLINDER_X + CYLINDER_WIDTH / 2, pistonY + 35);
  }

  function drawMolecules() {
    molecules.forEach(molecule => {
      const speedFactor = molecule.speed * Math.sqrt(currentState.T / 300);
      const size = 2 + speedFactor * 0.5;
      
      // Color based on speed
      const hue = Math.min(60, speedFactor * 30);
      ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
      
      ctx.beginPath();
      ctx.arc(molecule.x, molecule.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Velocity vectors (sample)
      if (Math.random() < 0.05) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(molecule.x, molecule.y);
        ctx.lineTo(molecule.x + molecule.vx * 0.02, molecule.y + molecule.vy * 0.02);
        ctx.stroke();
      }
    });
  }

  function drawPVDiagram() {
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(PV_X, PV_Y, PV_WIDTH, PV_HEIGHT);
    
    // Axes
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(PV_X, PV_Y, PV_WIDTH, PV_HEIGHT);
    
    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Volume (L)", PV_X + PV_WIDTH / 2, PV_Y + PV_HEIGHT + 20);
    
    ctx.save();
    ctx.translate(PV_X - 20, PV_Y + PV_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Pressure (atm)", 0, 0);
    ctx.restore();
    
    // Adiabatic curve
    const maxV = 4, minV = 0.5, maxP = 8, minP = 0;
    
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let v = minV; v <= maxV; v += 0.1) {
      const state = calculateAdiabaticState(v);
      const x = PV_X + ((v - minV) / (maxV - minV)) * PV_WIDTH;
      const y = PV_Y + PV_HEIGHT - ((state.P - minP) / (maxP - minP)) * PV_HEIGHT;
      
      if (v === minV) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Process history
    if (pvHistory.length > 1) {
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      pvHistory.forEach((point, i) => {
        const x = PV_X + ((point.V - minV) / (maxV - minV)) * PV_WIDTH;
        const y = PV_Y + PV_HEIGHT - ((point.P - minP) / (maxP - minP)) * PV_HEIGHT;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
    
    // Current point
    const currentX = PV_X + ((currentState.V - minV) / (maxV - minV)) * PV_WIDTH;
    const currentY = PV_Y + PV_HEIGHT - ((currentState.P - minP) / (maxP - minP)) * PV_HEIGHT;
    
    ctx.beginPath();
    ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    
    for (let i = 1; i < 4; i++) {
      const x = PV_X + (i / 4) * PV_WIDTH;
      const y = PV_Y + (i / 4) * PV_HEIGHT;
      
      ctx.beginPath();
      ctx.moveTo(x, PV_Y);
      ctx.lineTo(x, PV_Y + PV_HEIGHT);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(PV_X, y);
      ctx.lineTo(PV_X + PV_WIDTH, y);
      ctx.stroke();
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentState = { P: initialPressure, V: initialVolume, T: initialTemperature };
    initializeMolecules();
    pvHistory.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    initialPressure = params.initialPressure ?? 1;
    initialVolume = params.initialVolume ?? 2;
    initialTemperature = params.initialTemperature ?? 300;
    gamma = params.gamma ?? 1.4;
    processType = Math.round(params.processType ?? 0);
    processSpeed = params.processSpeed ?? 1;

    time += dt * processSpeed;

    // Update target volume based on process type
    if (processType === 0) {
      // Compression
      targetVolume = initialVolume * 0.3;
    } else if (processType === 1) {
      // Expansion
      targetVolume = initialVolume * 1.8;
    } else {
      // Oscillation
      targetVolume = initialVolume + Math.sin(time * 0.5) * initialVolume * 0.4;
    }

    // Gradually change volume toward target
    const volumeChange = (targetVolume - currentState.V) * dt * 0.5;
    currentState.V = Math.max(0.3, Math.min(4, currentState.V + volumeChange));

    // Calculate new pressure and temperature using adiabatic relations
    const newState = calculateAdiabaticState(currentState.V);
    currentState.P = newState.P;
    currentState.T = newState.T;

    updateMolecules(dt);

    // Record P-V history
    pvHistory.push({ P: currentState.P, V: currentState.V });
    if (pvHistory.length > 300) {
      pvHistory.shift();
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawCylinder();
    drawMolecules();
    drawPVDiagram();

    const processNames = ["Compression", "Expansion", "Oscillation"];

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 280, 180);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Adiabatic Gas Process", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Q = 0 (No Heat Transfer)`, 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Process: ${processNames[processType]}`, 20, 80);
    ctx.fillText(`γ (gamma) = ${gamma}`, 20, 100);
    
    ctx.fillText("Adiabatic Laws:", 20, 125);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`PVᵞ = ${(initialPressure * Math.pow(initialVolume, gamma)).toFixed(2)}`, 20, 145);
    ctx.fillText(`TVᵞ⁻¹ = ${(initialTemperature * Math.pow(initialVolume, gamma - 1)).toFixed(1)}`, 20, 165);

    // Work done
    const workDone = (initialPressure * Math.pow(initialVolume, gamma) / (1 - gamma)) * 
                    (Math.pow(currentState.V, 1 - gamma) - Math.pow(initialVolume, 1 - gamma));
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 280, height - 160, 270, 140);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Adiabatic Process Properties:", width - 270, height - 135);
    ctx.fillText("• No heat exchange (Q = 0)", width - 270, height - 115);
    ctx.fillText("• ΔU = -W (internal energy = -work)", width - 270, height - 95);
    ctx.fillText("• Compression → heating", width - 270, height - 75);
    ctx.fillText("• Expansion → cooling", width - 270, height - 55);
    ctx.fillText(`• Work done: ${workDone.toFixed(2)} atm·L`, width - 270, height - 35);

    // Temperature change indicator
    const tempChange = currentState.T - initialTemperature;
    ctx.fillStyle = tempChange > 0 ? "#ef4444" : "#3b82f6";
    ctx.fillText(`ΔT = ${tempChange.toFixed(0)} K`, width - 270, height - 15);
  }

  function reset(): void {
    time = 0;
    currentState = { P: initialPressure, V: initialVolume, T: initialTemperature };
    initializeMolecules();
    pvHistory.length = 0;
  }

  function destroy(): void {
    molecules.length = 0;
    pvHistory.length = 0;
  }

  function getStateDescription(): string {
    const processNames = ["compression", "expansion", "oscillating"];
    const tempChange = currentState.T - initialTemperature;
    const workDone = (initialPressure * Math.pow(initialVolume, gamma) / (1 - gamma)) * 
                    (Math.pow(currentState.V, 1 - gamma) - Math.pow(initialVolume, 1 - gamma));
    
    return (
      `Adiabatic process: ${processNames[processType]} with γ=${gamma}. No heat transfer (Q=0). ` +
      `State: P=${currentState.P.toFixed(2)}atm, V=${currentState.V.toFixed(2)}L, T=${currentState.T.toFixed(0)}K. ` +
      `Temperature change ΔT=${tempChange.toFixed(0)}K, work done W=${workDone.toFixed(2)}atm·L. ` +
      `Follows adiabatic laws: PVᵞ=constant, TVᵞ⁻¹=constant. Molecular kinetic energy changes with temperature.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default AdiabaticGasProcessFactory;