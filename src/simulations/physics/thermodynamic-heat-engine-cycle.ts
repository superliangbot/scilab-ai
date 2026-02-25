import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Thermodynamic Heat Engine Cycle
 * Shows Carnot, Otto, and Diesel cycles with P-V diagrams
 * Efficiency η = 1 - Tc/Th for Carnot cycle
 * Work output W = ∮ P dV (area inside P-V curve)
 */

const ThermodynamicHeatEngineCycleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("thermodynamic-heat-engine-cycle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Engine parameters
  let cycleType = 0; // 0=Carnot, 1=Otto, 2=Diesel
  let hotTemp = 600; // K
  let coldTemp = 300; // K
  let compressionRatio = 8;
  let animationSpeed = 1;

  let cyclePhase = 0; // Current position in cycle (0-1)
  let currentState = { P: 1, V: 1, T: 300 };
  
  const cycleHistory: Array<{ P: number; V: number; T: number; phase: string }> = [];

  // P-V diagram dimensions
  const PV_X = 50;
  const PV_Y = 50;
  const PV_WIDTH = 300;
  const PV_HEIGHT = 200;

  function calculateCarnotCycle(phase: number) {
    // Carnot cycle: Isothermal expansion → Adiabatic expansion → Isothermal compression → Adiabatic compression
    const V1 = 1, V2 = 2.5, V3 = 4, V4 = 1.6;
    const P1 = hotTemp / V1, P2 = hotTemp / V2, P3 = coldTemp / V3, P4 = coldTemp / V4;
    
    let P, V, T, phaseName;
    
    if (phase < 0.25) {
      // Isothermal expansion at Th
      const t = phase / 0.25;
      V = V1 + (V2 - V1) * t;
      T = hotTemp;
      P = T / V;
      phaseName = "Isothermal Expansion (Hot)";
    } else if (phase < 0.5) {
      // Adiabatic expansion
      const t = (phase - 0.25) / 0.25;
      V = V2 + (V3 - V2) * t;
      const gamma = 1.4;
      T = hotTemp * Math.pow(V2 / V, gamma - 1);
      P = T / V;
      phaseName = "Adiabatic Expansion";
    } else if (phase < 0.75) {
      // Isothermal compression at Tc
      const t = (phase - 0.5) / 0.25;
      V = V3 + (V4 - V3) * t;
      T = coldTemp;
      P = T / V;
      phaseName = "Isothermal Compression (Cold)";
    } else {
      // Adiabatic compression
      const t = (phase - 0.75) / 0.25;
      V = V4 + (V1 - V4) * t;
      const gamma = 1.4;
      T = coldTemp * Math.pow(V4 / V, gamma - 1);
      P = T / V;
      phaseName = "Adiabatic Compression";
    }
    
    return { P, V, T, phaseName };
  }

  function calculateOttoCycle(phase: number) {
    // Otto cycle: Adiabatic compression → Isochoric heating → Adiabatic expansion → Isochoric cooling
    const V1 = compressionRatio, V2 = 1;
    const gamma = 1.4;
    
    let P, V, T, phaseName;
    
    if (phase < 0.25) {
      // Adiabatic compression
      const t = phase / 0.25;
      V = V1 + (V2 - V1) * t;
      T = coldTemp * Math.pow(V1 / V, gamma - 1);
      P = T / V;
      phaseName = "Adiabatic Compression";
    } else if (phase < 0.5) {
      // Isochoric heating (constant volume)
      const t = (phase - 0.25) / 0.25;
      V = V2;
      T = coldTemp * Math.pow(compressionRatio, gamma - 1) + t * (hotTemp - coldTemp * Math.pow(compressionRatio, gamma - 1));
      P = T / V;
      phaseName = "Isochoric Heating (Ignition)";
    } else if (phase < 0.75) {
      // Adiabatic expansion
      const t = (phase - 0.5) / 0.25;
      V = V2 + (V1 - V2) * t;
      T = hotTemp * Math.pow(V2 / V, gamma - 1);
      P = T / V;
      phaseName = "Adiabatic Expansion (Power)";
    } else {
      // Isochoric cooling (constant volume)
      const t = (phase - 0.75) / 0.25;
      V = V1;
      const T_start = hotTemp * Math.pow(V2 / V1, gamma - 1);
      T = T_start + t * (coldTemp - T_start);
      P = T / V;
      phaseName = "Isochoric Cooling (Exhaust)";
    }
    
    return { P, V, T, phaseName };
  }

  function calculateDieselCycle(phase: number) {
    // Diesel cycle: Adiabatic compression → Isobaric heating → Adiabatic expansion → Isochoric cooling
    const V1 = compressionRatio, V2 = 1, V3 = 2;
    const gamma = 1.4;
    
    let P, V, T, phaseName;
    
    if (phase < 0.25) {
      // Adiabatic compression
      const t = phase / 0.25;
      V = V1 + (V2 - V1) * t;
      T = coldTemp * Math.pow(V1 / V, gamma - 1);
      P = T / V;
      phaseName = "Adiabatic Compression";
    } else if (phase < 0.5) {
      // Isobaric heating (constant pressure)
      const t = (phase - 0.25) / 0.25;
      const P_const = coldTemp * Math.pow(compressionRatio, gamma - 1) / V2;
      P = P_const;
      V = V2 + (V3 - V2) * t;
      T = P * V;
      phaseName = "Isobaric Heating (Fuel Injection)";
    } else if (phase < 0.75) {
      // Adiabatic expansion
      const t = (phase - 0.5) / 0.25;
      V = V3 + (V1 - V3) * t;
      const T_start = coldTemp * Math.pow(compressionRatio, gamma - 1) * (V3 / V2);
      T = T_start * Math.pow(V3 / V, gamma - 1);
      P = T / V;
      phaseName = "Adiabatic Expansion (Power)";
    } else {
      // Isochoric cooling
      const t = (phase - 0.75) / 0.25;
      V = V1;
      const T_start = coldTemp * Math.pow(compressionRatio, gamma - 1) * (V3 / V2) * Math.pow(V3 / V1, gamma - 1);
      T = T_start + t * (coldTemp - T_start);
      P = T / V;
      phaseName = "Isochoric Cooling (Exhaust)";
    }
    
    return { P, V, T, phaseName };
  }

  function getCurrentCycleState(phase: number) {
    switch (cycleType) {
      case 0: return calculateCarnotCycle(phase);
      case 1: return calculateOttoCycle(phase);
      case 2: return calculateDieselCycle(phase);
      default: return calculateCarnotCycle(phase);
    }
  }

  function drawPVDiagram() {
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(PV_X, PV_Y, PV_WIDTH, PV_HEIGHT);
    
    // Axes
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(PV_X, PV_Y, PV_WIDTH, PV_HEIGHT);
    
    // Axis labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Volume", PV_X + PV_WIDTH / 2, PV_Y + PV_HEIGHT + 25);
    
    ctx.save();
    ctx.translate(PV_X - 20, PV_Y + PV_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Pressure", 0, 0);
    ctx.restore();
    
    // Draw complete cycle path
    if (cycleHistory.length > 10) {
      const maxP = Math.max(...cycleHistory.map(s => s.P));
      const minP = Math.min(...cycleHistory.map(s => s.P));
      const maxV = Math.max(...cycleHistory.map(s => s.V));
      const minV = Math.min(...cycleHistory.map(s => s.V));
      
      const pRange = maxP - minP || 1;
      const vRange = maxV - minV || 1;
      
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      cycleHistory.forEach((state, i) => {
        const x = PV_X + ((state.V - minV) / vRange) * PV_WIDTH;
        const y = PV_Y + PV_HEIGHT - ((state.P - minP) / pRange) * PV_HEIGHT;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Current state point
      const currentX = PV_X + ((currentState.V - minV) / vRange) * PV_WIDTH;
      const currentY = PV_Y + PV_HEIGHT - ((currentState.P - minP) / pRange) * PV_HEIGHT;
      
      ctx.beginPath();
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    
    for (let i = 1; i < 5; i++) {
      const x = PV_X + (i / 5) * PV_WIDTH;
      const y = PV_Y + (i / 5) * PV_HEIGHT;
      
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

  function drawEngineSchematic() {
    const engineX = 400;
    const engineY = 100;
    const cylinderWidth = 120;
    const cylinderHeight = 200;
    
    // Cylinder
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.strokeRect(engineX, engineY, cylinderWidth, cylinderHeight);
    
    // Piston
    const pistonY = engineY + cylinderHeight * (1 - (currentState.V - 0.5) / 3);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(engineX + 5, pistonY - 15, cylinderWidth - 10, 30);
    
    // Piston rod
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(engineX + cylinderWidth / 2, pistonY);
    ctx.lineTo(engineX + cylinderWidth / 2, engineY + cylinderHeight + 50);
    ctx.stroke();
    
    // Gas particles visualization
    const numDots = Math.floor(currentState.V * 20);
    const gasArea = pistonY - engineY;
    
    ctx.fillStyle = `hsl(${Math.max(0, Math.min(360, (currentState.T - 200) * 0.5))}, 70%, 60%)`;
    
    for (let i = 0; i < numDots; i++) {
      const x = engineX + 10 + Math.random() * (cylinderWidth - 20);
      const y = engineY + 10 + Math.random() * (gasArea - 20);
      
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Temperature indicator
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`T = ${currentState.T.toFixed(0)} K`, engineX + cylinderWidth / 2, engineY - 10);
  }

  function calculateEfficiency(): number {
    switch (cycleType) {
      case 0: // Carnot
        return 1 - coldTemp / hotTemp;
      case 1: // Otto
        const gamma = 1.4;
        return 1 - 1 / Math.pow(compressionRatio, gamma - 1);
      case 2: // Diesel (simplified)
        return 1 - 1 / Math.pow(compressionRatio, 0.4);
      default:
        return 0;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    cycleHistory.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    cycleType = Math.round(params.cycleType ?? 0);
    hotTemp = params.hotTemp ?? 600;
    coldTemp = params.coldTemp ?? 300;
    compressionRatio = params.compressionRatio ?? 8;
    animationSpeed = params.animationSpeed ?? 1;

    time += dt * animationSpeed;
    cyclePhase = (time * 0.2) % 1; // Complete cycle every 5 seconds

    const state = getCurrentCycleState(cyclePhase);
    currentState = {
      P: state.P,
      V: state.V,
      T: state.T
    };

    // Record cycle history
    cycleHistory.push({
      P: currentState.P,
      V: currentState.V,
      T: currentState.T,
      phase: state.phaseName
    });

    // Keep only recent history for smooth cycle display
    if (cycleHistory.length > 200) {
      cycleHistory.shift();
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawPVDiagram();
    drawEngineSchematic();

    const cycleNames = ["Carnot Cycle", "Otto Cycle (Gasoline)", "Diesel Cycle"];
    const currentCycleName = cycleNames[cycleType] || "Unknown Cycle";
    const efficiency = calculateEfficiency() * 100;
    
    const state = getCurrentCycleState(cyclePhase);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, height - 200, 350, 180);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Heat Engine Cycle", 20, height - 175);
    
    ctx.font = "14px system-ui, sans-serif";
    const cycleColors = ["#10b981", "#f59e0b", "#ef4444"];
    ctx.fillStyle = cycleColors[cycleType];
    ctx.fillText(currentCycleName, 20, height - 150);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Current Phase: ${state.phaseName}`, 20, height - 125);
    ctx.fillText(`P = ${currentState.P.toFixed(2)} atm`, 20, height - 105);
    ctx.fillText(`V = ${currentState.V.toFixed(2)} L`, 20, height - 85);
    ctx.fillText(`T = ${currentState.T.toFixed(0)} K`, 20, height - 65);
    
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Theoretical Efficiency: ${efficiency.toFixed(1)}%`, 20, height - 40);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Hot Reservoir: ${hotTemp} K`, 20, height - 20);
    ctx.fillText(`Cold Reservoir: ${coldTemp} K`, 150, height - 20);

    // Cycle info panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 300, 10, 290, 140);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Thermodynamic Cycles:", width - 290, 30);
    
    ctx.fillStyle = "#10b981";
    ctx.fillText("Carnot: Most efficient (ideal)", width - 290, 50);
    ctx.fillText("η = 1 - Tc/Th", width - 290, 65);
    
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("Otto: Gasoline engines", width - 290, 85);
    ctx.fillText("η = 1 - 1/r^(γ-1)", width - 290, 100);
    
    ctx.fillStyle = "#ef4444";
    ctx.fillText("Diesel: Compression ignition", width - 290, 120);
    ctx.fillText("Higher efficiency than Otto", width - 290, 135);

    // Work output visualization
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Work Output = ∮ P dV (Area inside P-V curve)", width / 2, height - 30);
    ctx.fillText("Efficiency = Work Out / Heat In", width / 2, height - 15);
  }

  function reset(): void {
    time = 0;
    cyclePhase = 0;
    cycleHistory.length = 0;
  }

  function destroy(): void {
    cycleHistory.length = 0;
  }

  function getStateDescription(): string {
    const cycleNames = ["Carnot", "Otto", "Diesel"];
    const currentCycleName = cycleNames[cycleType];
    const efficiency = (calculateEfficiency() * 100).toFixed(1);
    const state = getCurrentCycleState(cyclePhase);
    
    return (
      `${currentCycleName} Heat Engine: Th=${hotTemp}K, Tc=${coldTemp}K, efficiency=${efficiency}%. ` +
      `Current state: ${state.phaseName}, P=${currentState.P.toFixed(2)}atm, V=${currentState.V.toFixed(2)}L, T=${currentState.T.toFixed(0)}K. ` +
      `${cycleType === 1 || cycleType === 2 ? `Compression ratio=${compressionRatio}. ` : ''}` +
      `P-V diagram shows thermodynamic cycle with work output = area enclosed by curve.`
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

export default ThermodynamicHeatEngineCycleFactory;