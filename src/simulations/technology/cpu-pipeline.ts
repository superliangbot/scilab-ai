import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface Instruction {
  id: number;
  mnemonic: string;
  operands: string;
  opcode: string;
  stage: PipelineStage;
  cycle: number;
  stall: boolean;
  hazardType?: 'data' | 'control' | 'structural';
  completed: boolean;
}

type PipelineStage = 'fetch' | 'decode' | 'execute' | 'memory' | 'writeback' | 'completed';

const CPUPipeline: SimulationFactory = () => {
  const config = getSimConfig("cpu-pipeline")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Pipeline parameters
  let clockSpeed = 2.0; // Hz (slow for visualization)
  let pipelineWidth = 5; // stages
  let branchPrediction = 1; // enabled
  let forwardingEnabled = 1; // enabled
  let time = 0;
  let cycle = 0;
  let lastClock = 0;

  // Processor state
  let instructions: Instruction[] = [];
  let pipeline: (Instruction | null)[] = [null, null, null, null, null]; // IF, ID, EX, MEM, WB
  let pc = 0; // program counter
  let registers = new Array(8).fill(0);
  let instructionQueue: Instruction[] = [];
  let completedInstructions: Instruction[] = [];

  // Statistics
  let totalCycles = 0;
  let stallCycles = 0;
  let branchMispredictions = 0;

  // Colors
  const BG = "#0f172a";
  const FETCH_COLOR = "#ef4444";
  const DECODE_COLOR = "#f59e0b";
  const EXECUTE_COLOR = "#10b981";
  const MEMORY_COLOR = "#3b82f6";
  const WRITEBACK_COLOR = "#8b5cf6";
  const STALL_COLOR = "#64748b";
  const HAZARD_COLOR = "#dc2626";
  const TEXT_COLOR = "#e2e8f0";
  const PANEL_BG = "rgba(30, 41, 59, 0.9)";

  const STAGE_COLORS = {
    fetch: FETCH_COLOR,
    decode: DECODE_COLOR,
    execute: EXECUTE_COLOR,
    memory: MEMORY_COLOR,
    writeback: WRITEBACK_COLOR,
    completed: "#6b7280"
  };

  function initializeInstructions() {
    // Sample RISC-V-like instruction set
    const sampleProgram = [
      { mnemonic: "ADDI", operands: "x1, x0, #10", opcode: "0x20010013" },
      { mnemonic: "ADDI", operands: "x2, x0, #20", opcode: "0x20020013" },
      { mnemonic: "ADD", operands: "x3, x1, x2", opcode: "0x002081b3" },
      { mnemonic: "SUB", operands: "x4, x3, x1", opcode: "0x40118233" },
      { mnemonic: "BEQ", operands: "x1, x2, loop", opcode: "0x00208463" },
      { mnemonic: "LW", operands: "x5, 0(x1)", opcode: "0x0000a283" },
      { mnemonic: "SW", operands: "x5, 4(x2)", opcode: "0x00512223" },
      { mnemonic: "MUL", operands: "x6, x1, x2", opcode: "0x022080b3" },
      { mnemonic: "ADDI", operands: "x1, x1, #1", opcode: "0x00108093" },
      { mnemonic: "BLT", operands: "x1, x7, loop", opcode: "0x00714c63" }
    ];

    instructionQueue = sampleProgram.map((inst, index) => ({
      id: index,
      mnemonic: inst.mnemonic,
      operands: inst.operands,
      opcode: inst.opcode,
      stage: 'fetch' as PipelineStage,
      cycle: 0,
      stall: false,
      completed: false
    }));
  }

  function computePhysics(dt: number, params: Record<string, number>) {
    clockSpeed = Math.max(0.1, Math.min(10, params.clockSpeed ?? clockSpeed));
    branchPrediction = params.branchPrediction ?? branchPrediction;
    forwardingEnabled = params.forwardingEnabled ?? forwardingEnabled;

    time += dt;

    // Clock edge detection
    const clockPeriod = 1 / clockSpeed;
    if (time - lastClock >= clockPeriod) {
      advancePipeline();
      lastClock = time;
      cycle++;
      totalCycles++;
    }
  }

  function advancePipeline() {
    // Process pipeline stages in reverse order to avoid conflicts
    
    // Writeback stage (WB)
    if (pipeline[4]) {
      const instr = pipeline[4];
      instr.stage = 'completed';
      instr.completed = true;
      completedInstructions.push(instr);
      pipeline[4] = null;
    }

    // Memory stage (MEM)
    if (pipeline[3]) {
      const instr = pipeline[3];
      
      // Simulate memory operations
      if (instr.mnemonic === 'LW' || instr.mnemonic === 'SW') {
        // Memory access - can cause stalls in real processors
        if (Math.random() < 0.1) { // 10% chance of memory stall
          instr.stall = true;
          instr.hazardType = 'structural';
          stallCycles++;
          return; // Don't advance this instruction
        }
      }
      
      instr.stage = 'writeback';
      pipeline[4] = instr;
      pipeline[3] = null;
    }

    // Execute stage (EX)
    if (pipeline[2]) {
      const instr = pipeline[2];
      
      // Check for data hazards
      if (hasDataHazard(instr)) {
        if (!forwardingEnabled) {
          instr.stall = true;
          instr.hazardType = 'data';
          stallCycles++;
          return;
        }
      }
      
      // Handle branch instructions
      if (instr.mnemonic === 'BEQ' || instr.mnemonic === 'BLT') {
        const isTaken = Math.random() < 0.5; // Random branch outcome
        const predicted = branchPrediction > 0.5;
        
        if (isTaken !== predicted) {
          // Branch misprediction - flush pipeline
          branchMispredictions++;
          flushPipeline();
          pc = isTaken ? pc + 4 : pc - 4; // Simplified branch target
          return;
        }
      }
      
      instr.stage = 'memory';
      pipeline[3] = instr;
      pipeline[2] = null;
    }

    // Decode stage (ID)
    if (pipeline[1]) {
      const instr = pipeline[1];
      
      // Check for structural hazards (resource conflicts)
      if (hasStructuralHazard(instr)) {
        instr.stall = true;
        instr.hazardType = 'structural';
        stallCycles++;
        return;
      }
      
      instr.stage = 'execute';
      pipeline[2] = instr;
      pipeline[1] = null;
    }

    // Fetch stage (IF)
    if (pipeline[0]) {
      const instr = pipeline[0];
      instr.stage = 'decode';
      pipeline[1] = instr;
      pipeline[0] = null;
    }

    // Fetch new instruction
    if (instructionQueue.length > 0 && pc < instructionQueue.length) {
      const newInstr = { ...instructionQueue[pc] };
      newInstr.cycle = cycle;
      pipeline[0] = newInstr;
      pc++;
    }
  }

  function hasDataHazard(instr: Instruction): boolean {
    // Simplified data hazard detection
    // Check if this instruction depends on previous instructions still in pipeline
    if (instr.mnemonic === 'ADD' || instr.mnemonic === 'SUB' || instr.mnemonic === 'MUL') {
      // Check if source registers are being written by previous instructions
      for (let i = 1; i < 4; i++) {
        if (pipeline[i] && pipeline[i]!.mnemonic.includes('ADDI')) {
          return true; // Simplified check
        }
      }
    }
    return false;
  }

  function hasStructuralHazard(instr: Instruction): boolean {
    // Simplified structural hazard detection
    // Multiple instructions trying to use the same functional unit
    if (instr.mnemonic === 'MUL') {
      // Check if another multiply is in execute stage
      return pipeline[2] && pipeline[2].mnemonic === 'MUL';
    }
    return false;
  }

  function flushPipeline() {
    // Clear IF and ID stages on branch misprediction
    pipeline[0] = null;
    pipeline[1] = null;
  }

  function drawPipelineStages() {
    const stageWidth = width * 0.15;
    const stageHeight = height * 0.12;
    const startX = width * 0.05;
    const startY = height * 0.15;

    const stages = [
      { name: "Fetch\n(IF)", color: FETCH_COLOR },
      { name: "Decode\n(ID)", color: DECODE_COLOR },
      { name: "Execute\n(EX)", color: EXECUTE_COLOR },
      { name: "Memory\n(MEM)", color: MEMORY_COLOR },
      { name: "Writeback\n(WB)", color: WRITEBACK_COLOR }
    ];

    // Draw pipeline stages
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const x = startX + i * (stageWidth + 10);
      const y = startY;

      // Stage box
      ctx.fillStyle = stage.color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, y, stageWidth, stageHeight);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = stage.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, stageWidth, stageHeight);

      // Stage label
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = stage.name.split('\n');
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + stageWidth / 2, y + stageHeight / 2 + (lineIndex - 0.5) * 15);
      });

      // Current instruction in this stage
      const instr = pipeline[i];
      if (instr) {
        ctx.fillStyle = instr.stall ? STALL_COLOR : TEXT_COLOR;
        ctx.font = "10px monospace";
        ctx.fillText(instr.mnemonic, x + stageWidth / 2, y + stageHeight + 15);
        ctx.fillText(instr.operands, x + stageWidth / 2, y + stageHeight + 28);

        // Hazard indicator
        if (instr.stall && instr.hazardType) {
          ctx.fillStyle = HAZARD_COLOR;
          ctx.font = "8px monospace";
          ctx.fillText(`${instr.hazardType.toUpperCase()} HAZARD`, x + stageWidth / 2, y + stageHeight + 41);
        }
      }

      // Pipeline arrows
      if (i < stages.length - 1) {
        ctx.strokeStyle = TEXT_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + stageWidth, y + stageHeight / 2);
        ctx.lineTo(x + stageWidth + 10, y + stageHeight / 2);
        ctx.stroke();

        // Arrow head
        ctx.fillStyle = TEXT_COLOR;
        ctx.beginPath();
        ctx.moveTo(x + stageWidth + 10, y + stageHeight / 2);
        ctx.lineTo(x + stageWidth + 5, y + stageHeight / 2 - 3);
        ctx.lineTo(x + stageWidth + 5, y + stageHeight / 2 + 3);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawInstructionQueue() {
    const queueX = width * 0.02;
    const queueY = height * 0.35;
    const queueW = width * 0.3;
    const queueH = height * 0.4;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(queueX, queueY, queueW, queueH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(queueX, queueY, queueW, queueH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Instruction Queue", queueX + queueW / 2, queueY + 20);

    // Instructions
    let y = queueY + 40;
    const lineHeight = 16;

    ctx.font = "10px monospace";
    ctx.textAlign = "left";

    // Header
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("PC", queueX + 5, y);
    ctx.fillText("Instruction", queueX + 30, y);
    ctx.fillText("Status", queueX + 150, y);
    y += lineHeight + 5;

    // Instructions
    const startIndex = Math.max(0, pc - 5);
    const endIndex = Math.min(instructionQueue.length, startIndex + 15);

    for (let i = startIndex; i < endIndex; i++) {
      const instr = instructionQueue[i];
      const isCurrentPC = i === pc - 1;
      const isInPipeline = pipeline.some(p => p && p.id === instr.id);

      // Highlight current PC
      if (isCurrentPC) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.fillRect(queueX + 2, y - 12, queueW - 4, lineHeight);
      }

      // PC
      ctx.fillStyle = isCurrentPC ? "#3b82f6" : TEXT_COLOR;
      ctx.fillText(i.toString().padStart(3, '0'), queueX + 5, y);

      // Instruction
      ctx.fillStyle = isInPipeline ? "#fbbf24" : TEXT_COLOR;
      ctx.fillText(`${instr.mnemonic} ${instr.operands}`, queueX + 30, y);

      // Status
      if (instr.completed) {
        ctx.fillStyle = "#10b981";
        ctx.fillText("DONE", queueX + 150, y);
      } else if (isInPipeline) {
        const pipeInstr = pipeline.find(p => p && p.id === instr.id);
        if (pipeInstr) {
          ctx.fillStyle = STAGE_COLORS[pipeInstr.stage];
          ctx.fillText(pipeInstr.stage.toUpperCase(), queueX + 150, y);
        }
      } else if (i >= pc) {
        ctx.fillStyle = "#6b7280";
        ctx.fillText("WAIT", queueX + 150, y);
      }

      y += lineHeight;
      if (y > queueY + queueH - 10) break;
    }
  }

  function drawPipelineDiagram() {
    const diagramX = width * 0.35;
    const diagramY = height * 0.35;
    const diagramW = width * 0.62;
    const diagramH = height * 0.25;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(diagramX, diagramY, diagramW, diagramH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(diagramX, diagramY, diagramW, diagramH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Pipeline Timeline", diagramX + diagramW / 2, diagramY + 20);

    // Timeline
    const timelineY = diagramY + 40;
    const cellWidth = 25;
    const cellHeight = 15;
    const maxInstructions = 10;
    const maxCycles = 20;

    // Draw headers
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#9ca3af";

    // Cycle headers
    for (let c = 0; c < Math.min(maxCycles, cycle + 5); c++) {
      const x = diagramX + 50 + c * cellWidth;
      ctx.fillText(c.toString(), x + cellWidth / 2, timelineY - 5);
    }

    // Instruction timeline
    const recentInstructions = [...pipeline.filter(p => p), ...completedInstructions.slice(-8)];
    recentInstructions.forEach((instr, index) => {
      if (!instr || index >= maxInstructions) return;

      const y = timelineY + index * (cellHeight + 2);

      // Instruction label
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = "left";
      ctx.font = "8px monospace";
      ctx.fillText(`${instr.mnemonic}`, diagramX + 5, y + cellHeight - 2);

      // Pipeline stages over time
      for (let c = instr.cycle; c <= instr.cycle + 4; c++) {
        if (c >= maxCycles) break;

        const x = diagramX + 50 + c * cellWidth;
        const stageIndex = c - instr.cycle;
        const stages: PipelineStage[] = ['fetch', 'decode', 'execute', 'memory', 'writeback'];
        
        if (stageIndex < stages.length) {
          const stage = stages[stageIndex];
          ctx.fillStyle = STAGE_COLORS[stage];
          ctx.fillRect(x, y, cellWidth - 1, cellHeight - 1);

          // Stage abbreviation
          const abbrevs = { fetch: 'IF', decode: 'ID', execute: 'EX', memory: 'MEM', writeback: 'WB' };
          ctx.fillStyle = "#000";
          ctx.font = "7px monospace";
          ctx.textAlign = "center";
          ctx.fillText(abbrevs[stage], x + cellWidth / 2, y + cellHeight - 3);
        }
      }

      // Stall indicators
      if (instr.stall) {
        ctx.fillStyle = STALL_COLOR;
        ctx.fillRect(diagramX + 50 + (instr.cycle + 1) * cellWidth, y, cellWidth - 1, cellHeight - 1);
        ctx.fillStyle = "#fff";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("STALL", diagramX + 50 + (instr.cycle + 1) * cellWidth + cellWidth / 2, y + cellHeight - 3);
      }
    });
  }

  function drawStatistics() {
    const statsX = width * 0.02;
    const statsY = height * 0.78;
    const statsW = width * 0.96;
    const statsH = height * 0.2;

    // Panel background
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(statsX, statsY, statsW, statsH);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(statsX, statsY, statsW, statsH);

    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Performance Statistics", statsX + statsW / 2, statsY + 20);

    // Statistics in columns
    const col1X = statsX + 20;
    const col2X = statsX + statsW / 4;
    const col3X = statsX + statsW / 2;
    const col4X = statsX + 3 * statsW / 4;
    const statY = statsY + 45;

    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    // Column 1: Basic stats
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Execution:", col1X, statY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Cycle: ${cycle}`, col1X, statY + 18);
    ctx.fillText(`PC: ${pc}`, col1X, statY + 36);
    ctx.fillText(`Clock: ${clockSpeed.toFixed(1)}Hz`, col1X, statY + 54);

    // Column 2: Performance
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Performance:", col2X, statY);
    ctx.fillStyle = TEXT_COLOR;
    
    const cpi = totalCycles > 0 ? totalCycles / Math.max(completedInstructions.length, 1) : 0;
    ctx.fillText(`CPI: ${cpi.toFixed(2)}`, col2X, statY + 18);
    
    const ipc = cpi > 0 ? 1 / cpi : 0;
    ctx.fillText(`IPC: ${ipc.toFixed(2)}`, col2X, statY + 36);
    
    const stallRate = totalCycles > 0 ? (stallCycles / totalCycles) * 100 : 0;
    ctx.fillText(`Stall: ${stallRate.toFixed(1)}%`, col2X, statY + 54);

    // Column 3: Hazards
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Hazards:", col3X, statY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Stalls: ${stallCycles}`, col3X, statY + 18);
    ctx.fillText(`Branches: ${branchMispredictions}`, col3X, statY + 36);
    ctx.fillText(`Forwarding: ${forwardingEnabled ? 'ON' : 'OFF'}`, col3X, statY + 54);

    // Column 4: Configuration
    ctx.fillStyle = "#9ca3af";
    ctx.fillText("Configuration:", col4X, statY);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(`Stages: ${pipelineWidth}`, col4X, statY + 18);
    ctx.fillText(`Branch Pred: ${branchPrediction ? 'ON' : 'OFF'}`, col4X, statY + 36);
    ctx.fillText(`Completed: ${completedInstructions.length}`, col4X, statY + 54);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      cycle = 0;
      lastClock = 0;
      pc = 0;
      totalCycles = 0;
      stallCycles = 0;
      branchMispredictions = 0;
      pipeline = [null, null, null, null, null];
      completedInstructions = [];
      initializeInstructions();
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawPipelineStages();
      drawInstructionQueue();
      drawPipelineDiagram();
      drawStatistics();
    },

    reset() {
      time = 0;
      cycle = 0;
      lastClock = 0;
      pc = 0;
      totalCycles = 0;
      stallCycles = 0;
      branchMispredictions = 0;
      pipeline = [null, null, null, null, null];
      completedInstructions = [];
      initializeInstructions();
    },

    destroy() {
      instructions = [];
      instructionQueue = [];
      completedInstructions = [];
      pipeline = [null, null, null, null, null];
    },

    getStateDescription(): string {
      const cpi = totalCycles > 0 ? totalCycles / Math.max(completedInstructions.length, 1) : 0;
      const ipc = cpi > 0 ? 1 / cpi : 0;
      const stallRate = totalCycles > 0 ? (stallCycles / totalCycles) * 100 : 0;
      
      return (
        `CPU pipeline simulation: ${pipelineWidth}-stage pipeline at ${clockSpeed}Hz. ` +
        `Cycle ${cycle}, PC=${pc}, ${completedInstructions.length} instructions completed. ` +
        `Performance: CPI=${cpi.toFixed(2)}, IPC=${ipc.toFixed(2)}, Stall rate=${stallRate.toFixed(1)}%. ` +
        `${stallCycles} stall cycles, ${branchMispredictions} branch mispredictions. ` +
        `${forwardingEnabled ? "Data forwarding enabled" : "No forwarding"}. ` +
        `Demonstrates instruction-level parallelism, hazard detection, and pipeline optimization techniques.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default CPUPipeline;