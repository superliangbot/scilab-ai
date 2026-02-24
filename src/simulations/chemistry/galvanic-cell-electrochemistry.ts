import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Electrode {
  metal: string;
  ion: string;
  concentration: number; // M
  standardPotential: number; // V
  color: string;
  ionColor: string;
  electrons: number; // electrons in half reaction
}

interface Electron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

const GalvanicCellElectrochemistryFactory: SimulationFactory = () => {
  const config = getSimConfig("galvanic-cell-electrochemistry") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let anodeType = 0; // index into electrode types
  let cathodeType = 1;
  let anodeConcentration = 1.0; // M
  let cathodeConcentration = 1.0; // M
  let temperature = 298; // K
  let showElectrons = 1;
  let loadResistance = 10; // ohms

  // Available electrode types
  const electrodeTypes: Electrode[] = [
    { metal: "Zn", ion: "Zn²⁺", concentration: 1.0, standardPotential: -0.76, color: "#94a3b8", ionColor: "#e2e8f0", electrons: 2 },
    { metal: "Cu", ion: "Cu²⁺", concentration: 1.0, standardPotential: 0.34, color: "#f59e0b", ionColor: "#3b82f6", electrons: 2 },
    { metal: "Ag", ion: "Ag⁺", concentration: 1.0, standardPotential: 0.80, color: "#e5e7eb", ionColor: "#94a3b8", electrons: 1 },
    { metal: "Pb", ion: "Pb²⁺", concentration: 1.0, standardPotential: -0.13, color: "#6b7280", ionColor: "#9ca3af", electrons: 2 },
    { metal: "Fe", ion: "Fe²⁺", concentration: 1.0, standardPotential: -0.44, color: "#ef4444", ionColor: "#fca5a5", electrons: 2 },
    { metal: "Mg", ion: "Mg²⁺", concentration: 1.0, standardPotential: -2.37, color: "#d1d5db", ionColor: "#f3f4f6", electrons: 2 },
  ];

  // State
  let anode: Electrode;
  let cathode: Electrode;
  let cellVoltage = 0;
  let current = 0;
  let electrons: Electron[] = [];
  let timeHistory: { time: number; voltage: number; current: number }[] = [];

  // Constants
  const R = 8.314; // J/(mol⋅K)
  const F = 96485; // C/mol
  const n = 2; // electrons (simplified)

  function initializeCell() {
    anode = { ...electrodeTypes[anodeType] };
    cathode = { ...electrodeTypes[cathodeType] };
    anode.concentration = anodeConcentration;
    cathode.concentration = cathodeConcentration;
    
    // Ensure anode has lower reduction potential
    if (anode.standardPotential > cathode.standardPotential) {
      [anode, cathode] = [cathode, anode];
    }
    
    calculateCellProperties();
    electrons = [];
  }

  function calculateCellProperties() {
    // Nernst equation: E = E° - (RT/nF) * ln(Q)
    const T = temperature;
    
    // Standard cell potential
    const E_standard = cathode.standardPotential - anode.standardPotential;
    
    // Reaction quotient Q = [products]/[reactants]
    // For M → M^n+ + ne^- (anode) and M^n+ + ne^- → M (cathode)
    // Q = [M^n+_anode]/[M^n+_cathode]
    const Q = anode.concentration / cathode.concentration;
    
    // Cell potential (Nernst equation)
    const nernstFactor = (R * T) / (n * F);
    cellVoltage = E_standard - nernstFactor * Math.log(Q);
    
    // Current using Ohm's law (simplified)
    current = Math.max(0, cellVoltage / loadResistance);
    
    // Store history
    if (timeHistory.length > 200) timeHistory.shift();
    timeHistory.push({ time: time, voltage: cellVoltage, current: current });
  }

  function createElectron() {
    if (electrons.length > 15) return;
    
    // Electrons flow from anode to cathode through external circuit
    electrons.push({
      x: W * 0.2, // Start at anode
      y: H * 0.25,
      vx: 100, // pixels per second
      vy: 0,
      age: 0,
    });
  }

  function updateElectrons(dt: number) {
    for (let i = electrons.length - 1; i >= 0; i--) {
      const electron = electrons[i];
      
      electron.x += electron.vx * dt;
      electron.y += electron.vy * dt;
      electron.age += dt;
      
      // Follow wire path
      if (electron.x < W * 0.4) {
        // Moving up from anode
        electron.vy = -50;
      } else if (electron.x < W * 0.6) {
        // Moving horizontally at top
        electron.vy = 0;
      } else {
        // Moving down to cathode
        electron.vy = 50;
      }
      
      // Remove electrons that reach cathode or are too old
      if (electron.x > W * 0.8 || electron.age > 10) {
        electrons.splice(i, 1);
      }
    }
  }

  function drawElectrodes() {
    const anodeX = W * 0.15;
    const cathodeX = W * 0.7;
    const electrodeY = H * 0.4;
    const electrodeW = 30;
    const electrodeH = 120;
    
    // Anode (negative electrode)
    const anodeGrad = ctx.createLinearGradient(anodeX, electrodeY, anodeX + electrodeW, electrodeY);
    anodeGrad.addColorStop(0, "#ffffff");
    anodeGrad.addColorStop(0.5, anode.color);
    anodeGrad.addColorStop(1, anode.color + "80");
    
    ctx.fillStyle = anodeGrad;
    ctx.fillRect(anodeX, electrodeY, electrodeW, electrodeH);
    ctx.strokeStyle = anode.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(anodeX, electrodeY, electrodeW, electrodeH);
    
    // Anode label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(anode.metal, anodeX + electrodeW/2, electrodeY + electrodeH/2);
    
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px monospace";
    ctx.fillText("(−)", anodeX + electrodeW/2, electrodeY - 10);
    ctx.fillText("Anode", anodeX + electrodeW/2, electrodeY - 25);
    
    // Cathode (positive electrode)
    const cathodeGrad = ctx.createLinearGradient(cathodeX, electrodeY, cathodeX + electrodeW, electrodeY);
    cathodeGrad.addColorStop(0, "#ffffff");
    cathodeGrad.addColorStop(0.5, cathode.color);
    cathodeGrad.addColorStop(1, cathode.color + "80");
    
    ctx.fillStyle = cathodeGrad;
    ctx.fillRect(cathodeX, electrodeY, electrodeW, electrodeH);
    ctx.strokeStyle = cathode.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(cathodeX, electrodeY, electrodeW, electrodeH);
    
    // Cathode label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(cathode.metal, cathodeX + electrodeW/2, electrodeY + electrodeH/2);
    
    ctx.fillStyle = "#3b82f6";
    ctx.font = "12px monospace";
    ctx.fillText("(+)", cathodeX + electrodeW/2, electrodeY - 10);
    ctx.fillText("Cathode", cathodeX + electrodeW/2, electrodeY - 25);
  }

  function drawSolutions() {
    const anodeBeakerX = W * 0.05;
    const cathodeBeakerX = W * 0.6;
    const beakerY = H * 0.35;
    const beakerW = 100;
    const beakerH = 140;
    
    // Anode beaker
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(anodeBeakerX, beakerY, beakerW, beakerH);
    
    // Anode solution
    const anodeSolutionGrad = ctx.createLinearGradient(
      anodeBeakerX, beakerY,
      anodeBeakerX + beakerW, beakerY + beakerH
    );
    anodeSolutionGrad.addColorStop(0, anode.ionColor + "80");
    anodeSolutionGrad.addColorStop(1, anode.ionColor);
    
    ctx.fillStyle = anodeSolutionGrad;
    ctx.fillRect(anodeBeakerX + 2, beakerY + 20, beakerW - 4, beakerH - 22);
    
    // Cathode beaker
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(cathodeBeakerX, beakerY, beakerW, beakerH);
    
    // Cathode solution
    const cathodeSolutionGrad = ctx.createLinearGradient(
      cathodeBeakerX, beakerY,
      cathodeBeakerX + beakerW, beakerY + beakerH
    );
    cathodeSolutionGrad.addColorStop(0, cathode.ionColor + "80");
    cathodeSolutionGrad.addColorStop(1, cathode.ionColor);
    
    ctx.fillStyle = cathodeSolutionGrad;
    ctx.fillRect(cathodeBeakerX + 2, beakerY + 20, beakerW - 4, beakerH - 22);
    
    // Solution labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${anode.concentration.toFixed(2)} M ${anode.ion}`, anodeBeakerX + beakerW/2, beakerY + 15);
    ctx.fillText(`${cathode.concentration.toFixed(2)} M ${cathode.ion}`, cathodeBeakerX + beakerW/2, beakerY + 15);
    
    // Draw ions in solution (animated)
    for (let i = 0; i < 8; i++) {
      const anodeIonX = anodeBeakerX + 10 + (i % 3) * 30 + Math.sin(time * 2 + i) * 5;
      const anodeIonY = beakerY + 40 + Math.floor(i / 3) * 30 + Math.cos(time * 3 + i) * 3;
      
      ctx.fillStyle = anode.ionColor;
      ctx.beginPath();
      ctx.arc(anodeIonX, anodeIonY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      const cathodeIonX = cathodeBeakerX + 10 + (i % 3) * 30 + Math.sin(time * 2.5 + i) * 5;
      const cathodeIonY = beakerY + 40 + Math.floor(i / 3) * 30 + Math.cos(time * 2.5 + i) * 3;
      
      ctx.fillStyle = cathode.ionColor;
      ctx.beginPath();
      ctx.arc(cathodeIonX, cathodeIonY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSaltBridge() {
    const bridgeX1 = W * 0.25;
    const bridgeX2 = W * 0.55;
    const bridgeY = H * 0.6;
    const bridgeH = 40;
    
    // U-shaped salt bridge
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bridgeX1, H * 0.5);
    ctx.lineTo(bridgeX1, bridgeY);
    ctx.quadraticCurveTo(W * 0.4, bridgeY + bridgeH, bridgeX2, bridgeY);
    ctx.lineTo(bridgeX2, H * 0.5);
    ctx.stroke();
    
    // Salt bridge interior (KCl solution)
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bridgeX1, H * 0.52);
    ctx.lineTo(bridgeX1, bridgeY - 5);
    ctx.quadraticCurveTo(W * 0.4, bridgeY + bridgeH - 10, bridgeX2, bridgeY - 5);
    ctx.lineTo(bridgeX2, H * 0.52);
    ctx.stroke();
    
    // Salt bridge label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Salt Bridge", W * 0.4, bridgeY + bridgeH + 15);
    ctx.fillText("(KCl)", W * 0.4, bridgeY + bridgeH + 28);
    
    // Ion movement in salt bridge
    const numIons = 6;
    for (let i = 0; i < numIons; i++) {
      const t = (time * 0.5 + i * 0.3) % 2; // 0 to 2
      let ionX, ionY;
      
      if (t < 1) {
        // Moving from left to right along top curve
        const progress = t;
        ionX = bridgeX1 + progress * (bridgeX2 - bridgeX1);
        ionY = bridgeY - 5 - Math.sin(progress * Math.PI) * 10;
      } else {
        // Moving from right to left along bottom curve  
        const progress = t - 1;
        ionX = bridgeX2 - progress * (bridgeX2 - bridgeX1);
        ionY = bridgeY + 5 + Math.sin(progress * Math.PI) * 10;
      }
      
      // Alternate between K+ and Cl-
      ctx.fillStyle = i % 2 === 0 ? "#3b82f6" : "#ef4444";
      ctx.beginPath();
      ctx.arc(ionX, ionY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawExternalCircuit() {
    const wireY = H * 0.25;
    
    // Wires
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 4;
    
    // Top horizontal wire
    ctx.beginPath();
    ctx.moveTo(W * 0.2, wireY);
    ctx.lineTo(W * 0.75, wireY);
    ctx.stroke();
    
    // Left vertical wire (from anode)
    ctx.beginPath();
    ctx.moveTo(W * 0.2, wireY);
    ctx.lineTo(W * 0.2, H * 0.4);
    ctx.stroke();
    
    // Right vertical wire (to cathode)
    ctx.beginPath();
    ctx.moveTo(W * 0.75, wireY);
    ctx.lineTo(W * 0.75, H * 0.4);
    ctx.stroke();
    
    // Voltmeter
    const voltmeterX = W * 0.45;
    const voltmeterY = wireY - 30;
    const voltmeterSize = 40;
    
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(voltmeterX, voltmeterY, voltmeterSize, voltmeterSize);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(voltmeterX, voltmeterY, voltmeterSize, voltmeterSize);
    
    ctx.fillStyle = "#10b981";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("V", voltmeterX + voltmeterSize/2, voltmeterY + 15);
    ctx.fillText(`${cellVoltage.toFixed(2)}`, voltmeterX + voltmeterSize/2, voltmeterY + 30);
    
    // Connecting wires to voltmeter
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(voltmeterX, voltmeterY + voltmeterSize/2);
    ctx.lineTo(voltmeterX - 20, voltmeterY + voltmeterSize/2);
    ctx.lineTo(voltmeterX - 20, wireY);
    ctx.stroke();
    
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(voltmeterX + voltmeterSize, voltmeterY + voltmeterSize/2);
    ctx.lineTo(voltmeterX + voltmeterSize + 20, voltmeterY + voltmeterSize/2);
    ctx.lineTo(voltmeterX + voltmeterSize + 20, wireY);
    ctx.stroke();
    
    // Load resistor
    const resistorX = W * 0.6;
    const resistorY = wireY - 15;
    const resistorW = 30;
    const resistorH = 10;
    
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(resistorX, resistorY, resistorW, resistorH);
    ctx.stroke();
    
    // Zigzag inside resistor
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = resistorX + 3 + (resistorW - 6) * i / 4;
      const y = resistorY + resistorH/2 + (i % 2 === 0 ? -3 : 3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${loadResistance}Ω`, resistorX + resistorW/2, resistorY - 5);
    
    // Current indicator
    ctx.fillStyle = "#22d3ee";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`I = ${(current * 1000).toFixed(1)} mA`, W * 0.8, wireY - 5);
  }

  function drawElectrons() {
    if (!showElectrons) return;
    
    for (const electron of electrons) {
      const alpha = Math.max(0.3, 1 - electron.age / 5);
      
      // Glow effect
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(electron.x, electron.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Electron core
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
      ctx.beginPath();
      ctx.arc(electron.x, electron.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHalfReactions() {
    const panelX = W * 0.02;
    const panelY = H * 0.02;
    const panelW = W * 0.35;
    const panelH = H * 0.2;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    let y = panelY + 20;
    
    ctx.fillText("Half Reactions:", panelX + 10, y);
    y += 20;
    
    // Anode reaction (oxidation)
    ctx.fillStyle = "#ef4444";
    const anodeReaction = `${anode.metal} → ${anode.ion} + ${anode.electrons}e⁻`;
    ctx.fillText(`Anode: ${anodeReaction}`, panelX + 10, y);
    y += 18;
    
    // Cathode reaction (reduction)
    ctx.fillStyle = "#3b82f6";
    const cathodeReaction = `${cathode.ion} + ${cathode.electrons}e⁻ → ${cathode.metal}`;
    ctx.fillText(`Cathode: ${cathodeReaction}`, panelX + 10, y);
    y += 20;
    
    // Overall reaction
    ctx.fillStyle = "#10b981";
    const overallReaction = `${anode.metal} + ${cathode.ion} → ${cathode.metal} + ${anode.ion}`;
    ctx.fillText(`Overall: ${overallReaction}`, panelX + 10, y);
    y += 18;
    
    // Standard potentials
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px monospace";
    ctx.fillText(`E°(anode) = ${anode.standardPotential.toFixed(2)} V`, panelX + 10, y);
    y += 16;
    ctx.fillText(`E°(cathode) = ${cathode.standardPotential.toFixed(2)} V`, panelX + 10, y);
    y += 16;
    ctx.fillText(`E°(cell) = ${(cathode.standardPotential - anode.standardPotential).toFixed(2)} V`, panelX + 10, y);
  }

  function drawGraph() {
    const graphX = W * 0.4;
    const graphY = H * 0.7;
    const graphW = W * 0.55;
    const graphH = H * 0.25;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Cell Voltage vs Time", graphX + graphW/2, graphY + 15);
    
    if (timeHistory.length > 1) {
      const maxTime = Math.max(...timeHistory.map(h => h.time));
      const minTime = Math.min(...timeHistory.map(h => h.time));
      const timeRange = maxTime - minTime || 1;
      
      const maxVoltage = Math.max(...timeHistory.map(h => h.voltage), 2);
      const minVoltage = 0;
      
      // Voltage curve
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < timeHistory.length; i++) {
        const point = timeHistory[i];
        const x = graphX + 20 + ((point.time - minTime) / timeRange) * (graphW - 40);
        const y = graphY + graphH - 20 - ((point.voltage - minVoltage) / (maxVoltage - minVoltage)) * (graphH - 40);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Nernst equation display
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Nernst Equation:", graphX + 5, graphY + graphH - 25);
    ctx.fillText("E = E° - (RT/nF)ln(Q)", graphX + 5, graphY + graphH - 10);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeCell();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      anodeType = Math.round(Math.max(0, Math.min(5, params.anodeType ?? anodeType)));
      cathodeType = Math.round(Math.max(0, Math.min(5, params.cathodeType ?? cathodeType)));
      anodeConcentration = Math.max(0.01, Math.min(5.0, params.anodeConcentration ?? anodeConcentration));
      cathodeConcentration = Math.max(0.01, Math.min(5.0, params.cathodeConcentration ?? cathodeConcentration));
      temperature = Math.max(250, Math.min(350, params.temperature ?? temperature));
      showElectrons = Math.round(params.showElectrons ?? showElectrons);
      loadResistance = Math.max(1, Math.min(100, params.loadResistance ?? loadResistance));
      
      // Reinitialize if electrode types changed
      if (anodeType !== anode || cathodeType !== cathode) {
        initializeCell();
      } else {
        anode.concentration = anodeConcentration;
        cathode.concentration = cathodeConcentration;
        calculateCellProperties();
      }
      
      time += dt;
      
      // Create electrons based on current flow
      if (showElectrons && current > 0 && Math.random() < current * 5) {
        createElectron();
      }
      
      updateElectrons(dt);
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Galvanic Cell (Electrochemistry)", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Redox reactions and electrical energy", W / 2, 50);

      // Draw cell components
      drawSolutions();
      drawElectrodes();
      drawSaltBridge();
      drawExternalCircuit();
      if (showElectrons) {
        drawElectrons();
      }
      
      // Information panels
      drawHalfReactions();
      drawGraph();

      // Current status
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`T = ${temperature}K`, W - 10, 20);
      ctx.fillText(`Cell EMF = ${cellVoltage.toFixed(3)} V`, W - 10, 35);
      ctx.fillText(`Current = ${(current * 1000).toFixed(2)} mA`, W - 10, 50);

      // Equations
      ctx.fillStyle = "#22d3ee";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("ΔG° = -nFE°  |  ΔG = ΔG° + RT ln(Q)", W / 2, H - 5);
    },

    reset() {
      time = 0;
      electrons = [];
      timeHistory = [];
      initializeCell();
    },

    destroy() {},

    getStateDescription(): string {
      return `Galvanic cell: ${anode.metal}|${anode.ion}(${anode.concentration}M)||${cathode.ion}(${cathode.concentration}M)|${cathode.metal}. ` +
             `Anode: ${anode.metal} → ${anode.ion} + ${anode.electrons}e⁻ (E° = ${anode.standardPotential}V). ` +
             `Cathode: ${cathode.ion} + ${cathode.electrons}e⁻ → ${cathode.metal} (E° = ${cathode.standardPotential}V). ` +
             `Cell voltage: ${cellVoltage.toFixed(3)}V, current: ${(current*1000).toFixed(2)}mA at ${temperature}K. ` +
             `Demonstrates electrochemical cells, Nernst equation, and electron flow.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default GalvanicCellElectrochemistryFactory;