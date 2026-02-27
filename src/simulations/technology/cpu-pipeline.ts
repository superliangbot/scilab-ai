import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── CPU Instruction ──────────────────────────────────────────
interface Instruction {
  id: number;
  opcode: string;
  operand1: string;
  operand2?: string;
  result?: string;
  currentStage: number; // -1=not started, 0-4=pipeline stages
  cycleEntered: number;
  color: string;
}

// ─── Pipeline stage ──────────────────────────────────────────
interface PipelineStage {
  name: string;
  shortName: string;
  instruction: Instruction | null;
  stalled: boolean;
}

// ─── Factory ────────────────────────────────────────────────
const CPUPipelineFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cpu-pipeline") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // CPU State
  let instructions: Instruction[] = [];
  let pipeline: PipelineStage[] = [];
  let currentCycle = 0;
  let isRunning = false;
  let stepDelay = 0;
  let completedInstructions = 0;
  let totalCycles = 0;

  // Parameters
  let clockSpeed = 2; // cycles per second
  let enableHazardDetection = 1;
  let instructionSet = 0; // 0=Simple, 1=Complex

  const STAGE_WIDTH = 120;
  const STAGE_HEIGHT = 80;
  const STAGE_SPACING = 20;

  const INSTRUCTION_COLORS = [
    "#fbbf24", "#f87171", "#34d399", "#60a5fa", "#a78bfa",
    "#fb7185", "#34d399", "#fbbf24", "#60a5fa", "#f87171"
  ];

  const simpleInstructions = [
    { opcode: "ADD", operand1: "R1", operand2: "R2", result: "R3" },
    { opcode: "SUB", operand1: "R3", operand2: "R1", result: "R4" },
    { opcode: "MUL", operand1: "R2", operand2: "R4", result: "R5" },
    { opcode: "LOAD", operand1: "M[100]", result: "R6" },
    { opcode: "STORE", operand1: "R5", operand2: "M[200]" },
    { opcode: "AND", operand1: "R6", operand2: "R1", result: "R7" },
    { opcode: "OR", operand1: "R7", operand2: "R2", result: "R8" },
    { opcode: "JMP", operand1: "Label1" }
  ];

  const complexInstructions = [
    { opcode: "FMUL", operand1: "F1", operand2: "F2", result: "F3" },
    { opcode: "FADD", operand1: "F3", operand2: "F1", result: "F4" },
    { opcode: "DIV", operand1: "R1", operand2: "R2", result: "R3" },
    { opcode: "SQRT", operand1: "F4", result: "F5" },
    { opcode: "CACHE", operand1: "M[500]", result: "R6" },
    { opcode: "BRANCH", operand1: "R6", operand2: "Label2" },
    { opcode: "CALL", operand1: "Function1" },
    { opcode: "RET", operand1: "Stack" }
  ];

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    
    initializePipeline();
    loadInstructions();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
  }

  function initializePipeline(): void {
    pipeline = [
      { name: "Instruction Fetch", shortName: "IF", instruction: null, stalled: false },
      { name: "Instruction Decode", shortName: "ID", instruction: null, stalled: false },
      { name: "Execute", shortName: "EX", instruction: null, stalled: false },
      { name: "Memory Access", shortName: "MEM", instruction: null, stalled: false },
      { name: "Write Back", shortName: "WB", instruction: null, stalled: false }
    ];
  }

  function loadInstructions(): void {
    instructions = [];
    const instructionTemplates = instructionSet === 0 ? simpleInstructions : complexInstructions;
    
    for (let i = 0; i < 8; i++) {
      const template = instructionTemplates[i % instructionTemplates.length];
      const instruction: Instruction = {
        id: i + 1,
        opcode: template.opcode,
        operand1: template.operand1,
        operand2: template.operand2,
        result: template.result,
        currentStage: -1,
        cycleEntered: -1,
        color: INSTRUCTION_COLORS[i % INSTRUCTION_COLORS.length]
      };
      instructions.push(instruction);
    }
    
    reset();
  }

  function reset(): void {
    currentCycle = 0;
    completedInstructions = 0;
    totalCycles = 0;
    isRunning = false;
    stepDelay = 0;
    
    // Clear pipeline
    for (const stage of pipeline) {
      stage.instruction = null;
      stage.stalled = false;
    }
    
    // Reset instruction states
    for (const instruction of instructions) {
      instruction.currentStage = -1;
      instruction.cycleEntered = -1;
    }
  }

  function stepClock(): void {
    currentCycle++;
    totalCycles++;
    
    // Check for hazards
    detectHazards();
    
    // Process pipeline stages in reverse order (WB -> IF)
    for (let stage = pipeline.length - 1; stage >= 0; stage--) {
      if (!pipeline[stage].stalled) {
        processStage(stage);
      }
    }
    
    // Check if all instructions completed
    if (completedInstructions >= instructions.length) {
      isRunning = false;
    }
  }

  function detectHazards(): void {
    if (!enableHazardDetection) {
      // Clear all stalls
      for (const stage of pipeline) {
        stage.stalled = false;
      }
      return;
    }
    
    // Simple data hazard detection (RAW - Read After Write)
    const decodeInstr = pipeline[1].instruction; // ID stage
    const executeInstr = pipeline[2].instruction; // EX stage
    const memoryInstr = pipeline[3].instruction; // MEM stage
    
    // Check for data dependency
    let hazardDetected = false;
    
    if (decodeInstr && executeInstr) {
      if (hasDataDependency(decodeInstr, executeInstr)) {
        pipeline[0].stalled = true; // Stall IF
        pipeline[1].stalled = true; // Stall ID
        hazardDetected = true;
      }
    }
    
    if (decodeInstr && memoryInstr && !hazardDetected) {
      if (hasDataDependency(decodeInstr, memoryInstr)) {
        pipeline[0].stalled = true; // Stall IF
        pipeline[1].stalled = true; // Stall ID
        hazardDetected = true;
      }
    }
    
    if (!hazardDetected) {
      // Clear stalls
      pipeline[0].stalled = false;
      pipeline[1].stalled = false;
    }
    
    // Always clear later stages
    pipeline[2].stalled = false;
    pipeline[3].stalled = false;
    pipeline[4].stalled = false;
  }

  function hasDataDependency(instr1: Instruction, instr2: Instruction): boolean {
    // Check if instr1 reads from a register that instr2 writes to
    const instr1Reads = [instr1.operand1, instr1.operand2].filter(op => op && op.startsWith('R'));
    const instr2Writes = instr2.result;
    
    if (instr2Writes && instr2Writes.startsWith('R')) {
      return instr1Reads.includes(instr2Writes);
    }
    
    return false;
  }

  function processStage(stageIndex: number): void {
    const stage = pipeline[stageIndex];
    
    if (stageIndex === pipeline.length - 1) {
      // Write Back stage - complete instruction
      if (stage.instruction) {
        completedInstructions++;
        stage.instruction = null;
      }
    } else if (stageIndex === 0) {
      // Instruction Fetch - get next instruction
      if (!stage.instruction) {
        const nextInstr = instructions.find(instr => instr.currentStage === -1);
        if (nextInstr) {
          nextInstr.currentStage = 0;
          nextInstr.cycleEntered = currentCycle;
          stage.instruction = nextInstr;
        }
      } else {
        // Move instruction to next stage
        const instr = stage.instruction;
        instr.currentStage = 1;
        pipeline[1].instruction = instr;
        stage.instruction = null;
      }
    } else {
      // Middle stages - move instruction forward
      if (stage.instruction && !pipeline[stageIndex + 1].instruction) {
        const instr = stage.instruction;
        instr.currentStage = stageIndex + 1;
        pipeline[stageIndex + 1].instruction = instr;
        stage.instruction = null;
      }
      
      // Bring in instruction from previous stage
      if (!stage.instruction && pipeline[stageIndex - 1].instruction) {
        const instr = pipeline[stageIndex - 1].instruction;
        instr.currentStage = stageIndex;
        stage.instruction = instr;
        pipeline[stageIndex - 1].instruction = null;
      }
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const newClockSpeed = params.clockSpeed ?? 2;
    const newHazardDetection = params.enableHazardDetection ?? 1;
    const newInstructionSet = params.instructionSet ?? 0;
    
    clockSpeed = newClockSpeed;
    enableHazardDetection = newHazardDetection;
    
    if (newInstructionSet !== instructionSet) {
      instructionSet = newInstructionSet;
      loadInstructions();
    }

    // Auto-run pipeline
    if (completedInstructions < instructions.length) {
      if (!isRunning) {
        isRunning = true;
      }
    }

    if (isRunning) {
      stepDelay += dt;
      if (stepDelay >= 1000 / clockSpeed) {
        stepClock();
        stepDelay = 0;
      }
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    // Draw pipeline stages
    drawPipelineStages();
    
    // Draw instruction queue
    drawInstructionQueue();
    
    // Draw performance metrics
    drawMetrics();
    
    // Draw clock and cycle info
    drawClockInfo();
  }

  function drawPipelineStages(): void {
    const startX = 50;
    const startY = 200;
    
    for (let i = 0; i < pipeline.length; i++) {
      const stage = pipeline[i];
      const x = startX + i * (STAGE_WIDTH + STAGE_SPACING);
      const y = startY;
      
      // Stage box
      ctx.fillStyle = stage.stalled ? "#fed7d7" : "#e2e8f0";
      ctx.fillRect(x, y, STAGE_WIDTH, STAGE_HEIGHT);
      
      ctx.strokeStyle = stage.stalled ? "#f56565" : "#cbd5e0";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, STAGE_WIDTH, STAGE_HEIGHT);
      
      // Stage label
      ctx.fillStyle = "#2d3748";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(stage.shortName, x + STAGE_WIDTH/2, y - 5);
      ctx.font = "10px sans-serif";
      ctx.fillText(stage.name, x + STAGE_WIDTH/2, y + STAGE_HEIGHT + 15);
      
      // Instruction in stage
      if (stage.instruction) {
        const instr = stage.instruction;
        
        // Instruction box
        ctx.fillStyle = instr.color;
        const instrBox = {
          x: x + 5,
          y: y + 5,
          w: STAGE_WIDTH - 10,
          h: STAGE_HEIGHT - 10
        };
        ctx.fillRect(instrBox.x, instrBox.y, instrBox.w, instrBox.h);
        
        ctx.strokeStyle = "#2d3748";
        ctx.lineWidth = 1;
        ctx.strokeRect(instrBox.x, instrBox.y, instrBox.w, instrBox.h);
        
        // Instruction text
        ctx.fillStyle = "#2d3748";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`#${instr.id}`, instrBox.x + instrBox.w/2, instrBox.y + 15);
        ctx.font = "10px monospace";
        ctx.fillText(instr.opcode, instrBox.x + instrBox.w/2, instrBox.y + 30);
        
        if (instr.operand2) {
          ctx.fillText(`${instr.operand1},${instr.operand2}`, instrBox.x + instrBox.w/2, instrBox.y + 45);
        } else {
          ctx.fillText(instr.operand1, instrBox.x + instrBox.w/2, instrBox.y + 45);
        }
        
        if (instr.result) {
          ctx.fillText(`→${instr.result}`, instrBox.x + instrBox.w/2, instrBox.y + 58);
        }
      }
      
      // Stall indicator
      if (stage.stalled) {
        ctx.fillStyle = "#f56565";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("STALL", x + STAGE_WIDTH/2, y + STAGE_HEIGHT/2);
      }
    }
  }

  function drawInstructionQueue(): void {
    const queueX = 50;
    const queueY = 50;
    const instrWidth = 80;
    const instrHeight = 30;
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Instruction Queue:", queueX, queueY - 10);
    
    // Show first 8 instructions in queue
    for (let i = 0; i < Math.min(8, instructions.length); i++) {
      const instr = instructions[i];
      const x = queueX + i * (instrWidth + 5);
      const y = queueY;
      
      // Instruction status color
      let bgColor = "#e2e8f0"; // Not started
      if (instr.currentStage >= 0 && instr.currentStage < 5) {
        bgColor = instr.color; // In pipeline
      } else if (instr.currentStage === 5) {
        bgColor = "#c6f6d5"; // Completed
      }
      
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, instrWidth, instrHeight);
      
      ctx.strokeStyle = "#cbd5e0";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, instrWidth, instrHeight);
      
      // Instruction text
      ctx.fillStyle = "#2d3748";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`#${instr.id}`, x + instrWidth/2, y + 12);
      ctx.fillText(instr.opcode, x + instrWidth/2, y + 24);
    }
  }

  function drawMetrics(): void {
    const metricsX = 50;
    const metricsY = 350;
    
    // Performance calculations
    const idealCycles = instructions.length; // Without pipeline
    const actualCycles = totalCycles > 0 ? totalCycles : currentCycle;
    const throughput = completedInstructions / Math.max(1, actualCycles);
    const efficiency = idealCycles > 0 ? (completedInstructions / idealCycles) : 0;
    const speedup = actualCycles > 0 ? (instructions.length * pipeline.length) / actualCycles : 0;
    
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    
    ctx.fillText("Performance Metrics:", metricsX, metricsY);
    ctx.font = "12px sans-serif";
    ctx.fillText(`Instructions Completed: ${completedInstructions}/${instructions.length}`, metricsX, metricsY + 25);
    ctx.fillText(`Clock Cycles: ${currentCycle}`, metricsX, metricsY + 45);
    ctx.fillText(`Throughput: ${throughput.toFixed(3)} instr/cycle`, metricsX, metricsY + 65);
    ctx.fillText(`Pipeline Efficiency: ${(efficiency * 100).toFixed(1)}%`, metricsX, metricsY + 85);
    
    ctx.fillText(`Hazard Detection: ${enableHazardDetection ? 'ON' : 'OFF'}`, metricsX + 250, metricsY + 25);
    ctx.fillText(`Instruction Set: ${instructionSet ? 'Complex' : 'Simple'}`, metricsX + 250, metricsY + 45);
    ctx.fillText(`Clock Speed: ${clockSpeed} Hz`, metricsX + 250, metricsY + 65);
    
    // Stall statistics
    const stalledStages = pipeline.filter(stage => stage.stalled).length;
    if (stalledStages > 0) {
      ctx.fillStyle = "#f56565";
      ctx.fillText(`Pipeline Stalls: ${stalledStages}`, metricsX + 250, metricsY + 85);
    }
  }

  function drawClockInfo(): void {
    const clockX = W - 150;
    const clockY = 50;
    const clockRadius = 30;
    
    // Clock circle
    ctx.fillStyle = isRunning ? "#fbbf24" : "#e2e8f0";
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockRadius, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.strokeStyle = "#2d3748";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Clock hand
    const handAngle = (currentCycle % 4) * (Math.PI / 2) - Math.PI / 2;
    const handLength = clockRadius * 0.7;
    const handX = clockX + Math.cos(handAngle) * handLength;
    const handY = clockY + Math.sin(handAngle) * handLength;
    
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(handX, handY);
    ctx.strokeStyle = "#2d3748";
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Cycle number
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Cycle ${currentCycle}`, clockX, clockY + clockRadius + 20);
    
    // Status
    ctx.font = "12px sans-serif";
    ctx.fillStyle = isRunning ? "#16a34a" : "#6b7280";
    ctx.fillText(isRunning ? "RUNNING" : "STOPPED", clockX, clockY + clockRadius + 35);
  }

  function getStateDescription(): string {
    const stallCount = pipeline.filter(stage => stage.stalled).length;
    const instructionSetName = instructionSet ? "complex" : "simple";
    
    return `CPU Pipeline Simulation: ${pipeline.length}-stage pipeline processing ${instructionSetName} instructions. ` +
           `Cycle ${currentCycle}, ${completedInstructions}/${instructions.length} instructions completed. ` +
           `${stallCount > 0 ? `${stallCount} stages stalled due to hazards. ` : ''}` +
           `Hazard detection: ${enableHazardDetection ? 'enabled' : 'disabled'}. ` +
           `Clock: ${clockSpeed} Hz`;
  }

  function destroy(): void {
    // Cleanup if needed
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

export default CPUPipelineFactory;