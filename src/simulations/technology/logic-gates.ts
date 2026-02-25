import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const LogicGates: SimulationFactory = () => {
  const config = getSimConfig("logic-gates")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Logic gate states
  let inputA = false;
  let inputB = false;
  let clockSpeed = 2; // Hz
  let autoMode = false;
  let time = 0;

  // Gate types and their outputs
  const gateTypes = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"] as const;
  type GateType = typeof gateTypes[number];

  interface LogicGate {
    type: GateType;
    x: number;
    y: number;
    width: number;
    height: number;
    inputA?: boolean;
    inputB?: boolean;
    output: boolean;
  }

  const gates: LogicGate[] = [];
  const GATE_WIDTH = 80;
  const GATE_HEIGHT = 50;

  // Colors
  const BG_COLOR = "#0f172a";
  const GATE_COLOR = "#374151";
  const GATE_ACTIVE_COLOR = "#4f46e5";
  const INPUT_HIGH_COLOR = "#10b981";
  const INPUT_LOW_COLOR = "#6b7280";
  const OUTPUT_HIGH_COLOR = "#ef4444";
  const OUTPUT_LOW_COLOR = "#6b7280";
  const WIRE_COLOR = "#9ca3af";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function initializeGates() {
    gates.length = 0;
    
    const startX = 50;
    const startY = 80;
    const cols = 3;
    const spacingX = (width - 2 * startX) / (cols - 1);
    const spacingY = 70;
    
    for (let i = 0; i < gateTypes.length; i++) {
      const col = Math.floor(i / 3);
      const row = i % 3;
      
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      
      gates.push({
        type: gateTypes[i],
        x: x - GATE_WIDTH / 2,
        y: y - GATE_HEIGHT / 2,
        width: GATE_WIDTH,
        height: GATE_HEIGHT,
        output: false
      });
    }
  }

  function calculateGateOutput(gate: LogicGate, a: boolean, b: boolean): boolean {
    switch (gate.type) {
      case "AND": return a && b;
      case "OR": return a || b;
      case "NOT": return !a;
      case "NAND": return !(a && b);
      case "NOR": return !(a || b);
      case "XOR": return a !== b;
      case "XNOR": return a === b;
      default: return false;
    }
  }

  function updateGates() {
    for (const gate of gates) {
      if (gate.type === "NOT") {
        gate.output = calculateGateOutput(gate, inputA, false);
      } else {
        gate.output = calculateGateOutput(gate, inputA, inputB);
      }
    }
  }

  function drawWire(startX: number, startY: number, endX: number, endY: number, active: boolean) {
    ctx.strokeStyle = active ? INPUT_HIGH_COLOR : WIRE_COLOR;
    ctx.lineWidth = active ? 3 : 2;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Add signal flow animation
    if (active) {
      const progress = (time * 5) % 1;
      const pulseX = startX + (endX - startX) * progress;
      const pulseY = startY + (endY - startY) * progress;
      
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(pulseX, pulseY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInputTerminal(x: number, y: number, label: string, state: boolean) {
    // Terminal circle
    ctx.fillStyle = state ? INPUT_HIGH_COLOR : INPUT_LOW_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = TEXT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
    
    // State value
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state ? "1" : "0", x, y);
    
    // Label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, y + 20);
  }

  function drawGate(gate: LogicGate) {
    const centerX = gate.x + gate.width / 2;
    const centerY = gate.y + gate.height / 2;
    
    // Gate body
    ctx.fillStyle = gate.output ? GATE_ACTIVE_COLOR : GATE_COLOR;
    ctx.fillRect(gate.x, gate.y, gate.width, gate.height);
    
    ctx.strokeStyle = TEXT_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(gate.x, gate.y, gate.width, gate.height);
    
    // Gate type label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(gate.type, centerX, centerY - 5);
    
    // Input connections
    if (gate.type !== "NOT") {
      // Two input gate
      drawWire(20, centerY - 10, gate.x, centerY - 10, inputA);
      drawWire(20, centerY + 10, gate.x, centerY + 10, inputB);
      
      // Input labels inside gate
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("A", gate.x + 5, centerY - 10);
      ctx.fillText("B", gate.x + 5, centerY + 10);
    } else {
      // Single input gate
      drawWire(20, centerY, gate.x, centerY, inputA);
      
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("A", gate.x + 5, centerY);
    }
    
    // Output connection
    drawWire(gate.x + gate.width, centerY, gate.x + gate.width + 30, centerY, gate.output);
    
    // Output terminal
    const outputX = gate.x + gate.width + 45;
    ctx.fillStyle = gate.output ? OUTPUT_HIGH_COLOR : OUTPUT_LOW_COLOR;
    ctx.beginPath();
    ctx.arc(outputX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Output value
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(gate.output ? "1" : "0", outputX, centerY);
    
    // Gate symbol overlay (simplified)
    ctx.strokeStyle = TEXT_DIM;
    ctx.lineWidth = 1;
    
    switch (gate.type) {
      case "AND":
        // Curved right edge for AND gate
        ctx.beginPath();
        ctx.arc(gate.x + gate.width - 15, centerY, 15, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        break;
      
      case "OR":
        // Curved input edge for OR gate
        ctx.beginPath();
        ctx.arc(gate.x - 5, centerY, 20, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        break;
      
      case "NOT":
        // Triangle for NOT gate
        ctx.beginPath();
        ctx.moveTo(gate.x + 10, centerY - 10);
        ctx.lineTo(gate.x + 10, centerY + 10);
        ctx.lineTo(gate.x + gate.width - 15, centerY);
        ctx.closePath();
        ctx.stroke();
        
        // Inversion bubble
        ctx.beginPath();
        ctx.arc(gate.x + gate.width - 8, centerY, 3, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case "NAND":
        // AND symbol with inversion bubble
        ctx.beginPath();
        ctx.arc(gate.x + gate.width - 18, centerY, 12, -Math.PI/2, Math.PI/2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gate.x + gate.width - 6, centerY, 3, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case "NOR":
        // OR symbol with inversion bubble
        ctx.beginPath();
        ctx.arc(gate.x - 5, centerY, 17, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gate.x + gate.width - 6, centerY, 3, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case "XOR":
        // Double curved input edge
        ctx.beginPath();
        ctx.arc(gate.x - 5, centerY, 20, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gate.x - 10, centerY, 20, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        break;
        
      case "XNOR":
        // XOR symbol with inversion bubble
        ctx.beginPath();
        ctx.arc(gate.x - 5, centerY, 20, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gate.x - 10, centerY, 20, -Math.PI/3, Math.PI/3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gate.x + gate.width - 6, centerY, 3, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
  }

  function drawTruthTable() {
    const tableX = width - 280;
    const tableY = height - 200;
    const cellWidth = 35;
    const cellHeight = 20;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(tableX - 10, tableY - 10, 270, 180);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX - 10, tableY - 10, 270, 180);
    
    // Table header
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.fillText("Truth Table", tableX + 100, tableY - 5);
    
    // Column headers
    const headers = ["A", "B", "AND", "OR", "NOT A", "XOR", "NAND"];
    for (let i = 0; i < headers.length; i++) {
      const x = tableX + i * cellWidth + cellWidth / 2;
      const y = tableY + 15;
      
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(headers[i], x, y);
    }
    
    // Truth table rows
    const inputs = [[false, false], [false, true], [true, false], [true, true]];
    
    for (let row = 0; row < inputs.length; row++) {
      const [a, b] = inputs[row];
      const y = tableY + 35 + row * cellHeight;
      
      // Highlight current input combination
      if (a === inputA && b === inputB) {
        ctx.fillStyle = "rgba(79, 70, 229, 0.3)";
        ctx.fillRect(tableX, y - cellHeight/2, headers.length * cellWidth, cellHeight);
      }
      
      const values = [
        a ? "1" : "0",
        b ? "1" : "0",
        (a && b) ? "1" : "0",
        (a || b) ? "1" : "0",
        (!a) ? "1" : "0",
        (a !== b) ? "1" : "0",
        (!(a && b)) ? "1" : "0"
      ];
      
      for (let col = 0; col < values.length; col++) {
        const x = tableX + col * cellWidth + cellWidth / 2;
        
        // Color code the values
        if (col < 2) {
          ctx.fillStyle = values[col] === "1" ? INPUT_HIGH_COLOR : INPUT_LOW_COLOR;
        } else {
          ctx.fillStyle = values[col] === "1" ? OUTPUT_HIGH_COLOR : OUTPUT_LOW_COLOR;
        }
        
        ctx.font = "11px monospace";
        ctx.fillText(values[col], x, y);
      }
    }
  }

  function drawControls() {
    const controlsX = 20;
    const controlsY = height - 120;
    
    // Control panel background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(controlsX - 10, controlsY - 10, 200, 100);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(controlsX - 10, controlsY - 10, 200, 100);
    
    // Input terminals
    drawInputTerminal(controlsX + 20, controlsY + 20, "Input A", inputA);
    drawInputTerminal(controlsX + 60, controlsY + 20, "Input B", inputB);
    
    // Mode indicator
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(autoMode ? "Auto Mode" : "Manual Mode", controlsX + 100, controlsY);
    
    if (autoMode) {
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.fillText(`Clock: ${clockSpeed.toFixed(1)} Hz`, controlsX + 100, controlsY + 15);
    } else {
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.fillText("Click inputs to toggle", controlsX + 100, controlsY + 15);
    }
    
    // Instructions
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.fillText("Press SPACE for auto mode", controlsX, controlsY + 70);
  }

  function drawInfoPanel() {
    const panelX = 20;
    const panelY = 20;
    const lineH = 16;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX - 10, panelY - 10, 300, lineH * 4 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 10, panelY - 10, 300, lineH * 4 + 20);
    
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX;
    let y = panelY;
    
    ctx.fillStyle = "#4f46e5";
    ctx.fillText("Logic Gates Simulation", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Fundamental building blocks of digital circuits", x, y);
    y += lineH;
    
    ctx.fillText("Each gate performs a Boolean logic operation", x, y);
    y += lineH;
    
    ctx.fillText("Combine gates to create complex digital systems", x, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      
      initializeGates();
      updateGates();
      
      // Event handlers
      canvas.addEventListener('click', (e) => {
        if (autoMode) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking input A
        const inputAX = 40;
        const inputAY = height - 100;
        if (Math.sqrt((x - inputAX)**2 + (y - inputAY)**2) < 20) {
          inputA = !inputA;
          updateGates();
        }
        
        // Check if clicking input B
        const inputBX = 80;
        const inputBY = height - 100;
        if (Math.sqrt((x - inputBX)**2 + (y - inputBY)**2) < 20) {
          inputB = !inputB;
          updateGates();
        }
      });
      
      document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          autoMode = !autoMode;
        }
      });
    },

    update(dt: number, params: Record<string, number>) {
      clockSpeed = params.clockSpeed ?? clockSpeed;
      autoMode = (params.autoMode ?? 0) > 0.5;
      
      time += dt;
      
      if (autoMode) {
        // Auto cycle through input combinations
        const cycleTime = 1 / clockSpeed;
        const phase = Math.floor(time / cycleTime) % 4;
        
        switch (phase) {
          case 0: inputA = false; inputB = false; break;
          case 1: inputA = false; inputB = true; break;
          case 2: inputA = true; inputB = false; break;
          case 3: inputA = true; inputB = true; break;
        }
        
        updateGates();
      }
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw info panel
      drawInfoPanel();
      
      // Draw all logic gates
      for (const gate of gates) {
        drawGate(gate);
      }
      
      // Draw truth table
      drawTruthTable();
      
      // Draw controls
      drawControls();
    },

    reset() {
      time = 0;
      inputA = false;
      inputB = false;
      autoMode = false;
      updateGates();
    },

    destroy() {
      // Remove event listeners
      document.removeEventListener('keydown', () => {});
    },

    getStateDescription(): string {
      const activeGates = gates.filter(g => g.output).length;
      
      return (
        `Logic Gates: Digital building blocks performing Boolean operations. ` +
        `Current inputs: A=${inputA ? '1' : '0'}, B=${inputB ? '1' : '0'}. ` +
        `${activeGates}/${gates.length} gates outputting HIGH (1). ` +
        `Mode: ${autoMode ? `Auto-cycling at ${clockSpeed}Hz` : 'Manual control'}. ` +
        `Gates shown: AND (both inputs), OR (either input), NOT (inverts), ` +
        `NAND (NOT-AND), NOR (NOT-OR), XOR (exclusive-or), XNOR (exclusive-nor). ` +
        `Truth table shows all possible input/output combinations.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      initializeGates();
    },
  };

  return engine;
};

export default LogicGates;