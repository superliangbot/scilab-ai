import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Charge {
  x: number;
  y: number;
  magnitude: number;
  color: string;
}

const EquipotentialSurfaces: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("equipotential-surfaces") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let charge1Magnitude = 3;
  let charge2Magnitude = -3;
  let separation = 200;
  let showFieldLines = 1;

  // Charges
  let charges: Charge[] = [];

  const CENTER_X = width * 0.5;
  const CENTER_Y = height * 0.5;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    updateCharges();
  }

  function updateCharges() {
    charges = [
      {
        x: CENTER_X - separation / 2,
        y: CENTER_Y,
        magnitude: charge1Magnitude,
        color: charge1Magnitude > 0 ? "#ef4444" : "#3b82f6"
      },
      {
        x: CENTER_X + separation / 2,
        y: CENTER_Y,
        magnitude: charge2Magnitude,
        color: charge2Magnitude > 0 ? "#ef4444" : "#3b82f6"
      }
    ];
  }

  function update(dt: number, params: Record<string, number>) {
    charge1Magnitude = params.charge1Magnitude ?? charge1Magnitude;
    charge2Magnitude = params.charge2Magnitude ?? charge2Magnitude;
    separation = params.separation ?? separation;
    showFieldLines = Math.round(params.showFieldLines ?? showFieldLines);

    time += dt;
    updateCharges();
  }

  function calculatePotential(x: number, y: number): number {
    let potential = 0;
    
    charges.forEach(charge => {
      const dx = x - charge.x;
      const dy = y - charge.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 1) { // Avoid singularity
        potential += charge.magnitude / distance;
      }
    });
    
    return potential;
  }

  function drawEquipotentialLines() {
    const potentialLevels = [-0.1, -0.05, -0.02, 0, 0.02, 0.05, 0.1];
    
    potentialLevels.forEach((level, index) => {
      const alpha = level === 0 ? 1.0 : 0.6;
      const color = level > 0 ? `rgba(239, 68, 68, ${alpha})` : 
                   level < 0 ? `rgba(59, 130, 246, ${alpha})` :
                   `rgba(148, 163, 184, ${alpha})`;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = level === 0 ? 2 : 1;
      
      // Trace equipotential contours
      traceContour(level);
    });
  }

  function traceContour(targetPotential: number) {
    const tolerance = 0.01;
    const step = 3;
    
    ctx.beginPath();
    let pathStarted = false;
    
    for (let y = 50; y < height - 50; y += step) {
      for (let x = 50; x < width - 50; x += step) {
        const potential = calculatePotential(x, y);
        
        if (Math.abs(potential - targetPotential) < tolerance) {
          if (!pathStarted) {
            ctx.moveTo(x, y);
            pathStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
    }
    
    if (pathStarted) {
      ctx.stroke();
    }
  }

  function drawFieldLines() {
    if (!showFieldLines) return;

    // Field lines from positive charges
    charges.forEach(charge => {
      if (charge.magnitude > 0) {
        const numLines = Math.floor(Math.abs(charge.magnitude) * 8);
        
        for (let i = 0; i < numLines; i++) {
          const angle = (i / numLines) * 2 * Math.PI;
          traceFieldLine(charge.x, charge.y, angle);
        }
      }
    });
  }

  function traceFieldLine(startX: number, startY: number, startAngle: number) {
    ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    let x = startX + 15 * Math.cos(startAngle);
    let y = startY + 15 * Math.sin(startAngle);
    ctx.moveTo(x, y);
    
    const stepSize = 3;
    const maxSteps = 200;
    
    for (let step = 0; step < maxSteps; step++) {
      // Calculate electric field at current point
      let Ex = 0, Ey = 0;
      
      charges.forEach(charge => {
        const dx = x - charge.x;
        const dy = y - charge.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
          const field = charge.magnitude / (distance * distance);
          Ex += field * dx / distance;
          Ey += field * dy / distance;
        }
      });
      
      const fieldMag = Math.sqrt(Ex * Ex + Ey * Ey);
      if (fieldMag < 0.001) break;
      
      // Normalize and step
      Ex /= fieldMag;
      Ey /= fieldMag;
      
      x += Ex * stepSize;
      y += Ey * stepSize;
      
      // Check bounds
      if (x < 0 || x > width || y < 0 || y > height) break;
      
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    
    // Arrow head
    if (x > 0 && x < width && y > 0 && y < height) {
      const arrowSize = 3;
      let Ex = 0, Ey = 0;
      
      charges.forEach(charge => {
        const dx = x - charge.x;
        const dy = y - charge.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
          const field = charge.magnitude / (distance * distance);
          Ex += field * dx / distance;
          Ey += field * dy / distance;
        }
      });
      
      const fieldMag = Math.sqrt(Ex * Ex + Ey * Ey);
      if (fieldMag > 0.001) {
        Ex /= fieldMag;
        Ey /= fieldMag;
        
        ctx.fillStyle = "rgba(34, 211, 238, 0.6)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - arrowSize * (Ex + Ey), y - arrowSize * (Ey - Ex));
        ctx.lineTo(x - arrowSize * (Ex - Ey), y - arrowSize * (Ey + Ex));
        ctx.fill();
      }
    }
  }

  function drawCharges() {
    charges.forEach(charge => {
      // Charge body
      const radius = Math.abs(charge.magnitude) * 3 + 8;
      
      ctx.fillStyle = charge.color;
      ctx.beginPath();
      ctx.arc(charge.x, charge.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Charge border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Charge sign and magnitude
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const sign = charge.magnitude > 0 ? "+" : "−";
      ctx.fillText(sign + Math.abs(charge.magnitude), charge.x, charge.y);
    });
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Equipotential Surfaces", 20, 30);

    // Information
    ctx.font = "12px monospace";
    const infoLines = [
      "",
      "Equipotential lines connect points",
      "of equal electric potential V",
      "",
      `Q₁ = ${charge1Magnitude} μC`,
      `Q₂ = ${charge2Magnitude} μC`,
      `Separation = ${separation} px`,
      "",
      "Properties:",
      "• Electric field ⊥ equipotentials",
      "• No work done along equipotential",
      "• Field strength ∝ line density",
      "• V = kQ/r for point charge"
    ];

    let y = 50;
    infoLines.forEach(line => {
      if (line.includes("Q₁") || line.includes("Q₂")) {
        ctx.fillStyle = "#fbbf24";
      } else if (line.includes("•")) {
        ctx.fillStyle = "#94a3b8";
      } else if (line.includes("Properties") || line.includes("Equipotential")) {
        ctx.fillStyle = "#22d3ee";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 13;
    });
  }

  function drawPotentialScale() {
    const scaleX = width - 80;
    const scaleY = 100;
    const scaleH = 200;
    const scaleW = 20;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(scaleX - 25, scaleY - 10, scaleW + 50, scaleH + 20);

    // Gradient scale
    const gradient = ctx.createLinearGradient(scaleX, scaleY, scaleX, scaleY + scaleH);
    gradient.addColorStop(0, "#ef4444");
    gradient.addColorStop(0.5, "#6b7280");
    gradient.addColorStop(1, "#3b82f6");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(scaleX, scaleY, scaleW, scaleH);
    
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(scaleX, scaleY, scaleW, scaleH);

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("+V", scaleX + scaleW + 5, scaleY + 5);
    ctx.fillText("0V", scaleX + scaleW + 5, scaleY + scaleH/2 + 3);
    ctx.fillText("-V", scaleX + scaleW + 5, scaleY + scaleH + 3);
    
    ctx.textAlign = "center";
    ctx.fillText("Potential", scaleX + scaleW/2, scaleY - 15);
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawEquipotentialLines();
    drawFieldLines();
    drawCharges();
    drawInfo();
    drawPotentialScale();
  }

  function reset() {
    time = 0;
    updateCharges();
  }

  function getStateDescription(): string {
    return `Equipotential surfaces for charges Q₁=${charge1Magnitude}μC, Q₂=${charge2Magnitude}μC separated by ${separation}px. Shows electric potential and field line relationships.`;
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

export default EquipotentialSurfaces;