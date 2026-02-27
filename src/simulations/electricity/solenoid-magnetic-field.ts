import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SolenoidMagneticField: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("solenoid-magnetic-field") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let current = 2; // Amperes
  let turns = 10; // Number of turns
  let length = 200; // Solenoid length in pixels
  let showFieldLines = 1;

  // Magnetic field strength
  let fieldStrength = 0;

  const SOLENOID_X = width * 0.4;
  const SOLENOID_Y = height * 0.5;
  const SOLENOID_RADIUS = 40;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    current = params.current ?? current;
    turns = params.turns ?? turns;
    length = params.length ?? length;
    showFieldLines = Math.round(params.showFieldLines ?? showFieldLines);

    time += dt;

    // Calculate magnetic field inside solenoid
    // B = μ₀ × n × I, where n = turns per unit length
    const mu0 = 4 * Math.PI * 1e-7; // Permeability of free space
    const n = turns / (length * 0.01); // turns per meter
    fieldStrength = mu0 * n * current; // Tesla
  }

  function drawSolenoid() {
    const startX = SOLENOID_X - length/2;
    const endX = SOLENOID_X + length/2;

    // Solenoid coils
    ctx.strokeStyle = current > 0 ? "#f59e0b" : "#6b7280";
    ctx.lineWidth = 3;

    for (let i = 0; i < turns; i++) {
      const x = startX + (i / (turns - 1)) * length;
      
      // Top half of coil
      ctx.beginPath();
      ctx.arc(x, SOLENOID_Y - SOLENOID_RADIUS/2, SOLENOID_RADIUS/2, Math.PI, 0);
      ctx.stroke();
      
      // Bottom half of coil
      ctx.beginPath();
      ctx.arc(x, SOLENOID_Y + SOLENOID_RADIUS/2, SOLENOID_RADIUS/2, 0, Math.PI);
      ctx.stroke();
    }

    // Current flow indicators
    if (current > 0.1) {
      const flowPhase = time * 5;
      
      for (let i = 0; i < turns; i++) {
        const x = startX + (i / (turns - 1)) * length;
        
        // Current direction arrows
        const arrowPhase = flowPhase + i * 0.5;
        const arrowY = SOLENOID_Y + 15 * Math.sin(arrowPhase);
        
        ctx.fillStyle = "#22d3ee";
        ctx.save();
        ctx.translate(x, arrowY);
        
        // Arrow pointing in current direction
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-3, -3);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-3, 3);
        ctx.fill();
        
        ctx.restore();
      }
    }

    // Solenoid axis
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(startX - 20, SOLENOID_Y);
    ctx.lineTo(endX + 20, SOLENOID_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMagneticField() {
    if (!showFieldLines || current < 0.1) return;

    const startX = SOLENOID_X - length/2;
    const endX = SOLENOID_X + length/2;
    
    // Inside field lines (uniform)
    ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
    ctx.lineWidth = 2;
    
    for (let i = 0; i < 8; i++) {
      const y = SOLENOID_Y - 30 + (60 * i / 7);
      
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
      
      // Field direction arrows
      for (let j = 0; j < 3; j++) {
        const arrowX = startX + length * (0.25 + j * 0.25);
        
        ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
        ctx.beginPath();
        ctx.moveTo(arrowX + 6, y);
        ctx.lineTo(arrowX - 3, y - 2);
        ctx.lineTo(arrowX - 1, y);
        ctx.lineTo(arrowX - 3, y + 2);
        ctx.fill();
      }
    }

    // Outside field lines (curved back)
    ctx.strokeStyle = "rgba(34, 197, 94, 0.4)";
    ctx.lineWidth = 1.5;
    
    for (let i = 0; i < 6; i++) {
      const offset = 50 + i * 15;
      
      // Top curved field lines
      ctx.beginPath();
      ctx.moveTo(endX, SOLENOID_Y);
      ctx.bezierCurveTo(
        endX + offset/2, SOLENOID_Y - offset,
        startX - offset/2, SOLENOID_Y - offset,
        startX, SOLENOID_Y
      );
      ctx.stroke();
      
      // Bottom curved field lines
      ctx.beginPath();
      ctx.moveTo(endX, SOLENOID_Y);
      ctx.bezierCurveTo(
        endX + offset/2, SOLENOID_Y + offset,
        startX - offset/2, SOLENOID_Y + offset,
        startX, SOLENOID_Y
      );
      ctx.stroke();
    }

    // N and S pole indicators
    ctx.fillStyle = "#ef4444";
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("S", startX - 30, SOLENOID_Y + 5);
    
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("N", endX + 30, SOLENOID_Y + 5);
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Solenoid Magnetic Field", 20, 30);

    // Parameters and calculations
    ctx.font = "12px monospace";
    const infoLines = [
      "",
      `Current: ${current.toFixed(1)} A`,
      `Turns: ${turns}`,
      `Length: ${length} px`,
      `Turn density: ${(turns / length * 100).toFixed(1)} turns/cm`,
      "",
      `Magnetic field inside:`,
      `B = μ₀ × n × I`,
      `B = ${(fieldStrength * 1000).toFixed(2)} mT`,
      "",
      "Properties:",
      "• Uniform field inside",
      "• Field strength ∝ current",
      "• Field strength ∝ turn density",
      "• Negligible field outside"
    ];

    let y = 50;
    infoLines.forEach(line => {
      if (line.includes("Current") || line.includes("field inside")) {
        ctx.fillStyle = "#22d3ee";
      } else if (line.includes("mT")) {
        ctx.fillStyle = "#22c55e";
      } else if (line.includes("•")) {
        ctx.fillStyle = "#94a3b8";
      } else if (line.includes("B =")) {
        ctx.fillStyle = "#fbbf24";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 15;
    });
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawMagneticField();
    drawSolenoid();
    drawInfo();
  }

  function reset() {
    time = 0;
  }

  function getStateDescription(): string {
    return `Solenoid with ${turns} turns, length ${length}px, current ${current}A. Magnetic field inside: ${(fieldStrength * 1000).toFixed(2)} mT. Demonstrates uniform field generation.`;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy: () => {},
    getStateDescription,
    resize: (w: number, h: number) => { width = w; height = h; }
  };
};

export default SolenoidMagneticField;