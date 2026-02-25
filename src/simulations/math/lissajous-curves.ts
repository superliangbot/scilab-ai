import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const LissajousCurves: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lissajous-curves") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let freqX = 2;
  let freqY = 3;
  let phaseShift = 0;
  let amplitude = 150;

  // Animation state
  let trail: TrailPoint[] = [];
  const maxTrailLength = 500;

  const CENTER_X = width * 0.5;
  const CENTER_Y = height * 0.5;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    trail = [];
  }

  function update(dt: number, params: Record<string, number>) {
    freqX = params.freqX ?? freqX;
    freqY = params.freqY ?? freqY;
    phaseShift = params.phaseShift ?? phaseShift;
    amplitude = params.amplitude ?? amplitude;

    time += dt;

    // Calculate current position
    const x = CENTER_X + amplitude * Math.sin(freqX * time);
    const y = CENTER_Y + amplitude * Math.sin(freqY * time + phaseShift);

    // Add to trail
    trail.push({ x, y, age: 0 });
    if (trail.length > maxTrailLength) {
      trail.shift();
    }

    // Age trail points
    trail.forEach(point => {
      point.age += dt;
    });
  }

  function drawLissajousCurve() {
    // Draw complete curve
    ctx.strokeStyle = "rgba(34, 211, 238, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let t = 0; t <= Math.PI * 2 * Math.max(freqX, freqY); t += 0.01) {
      const x = CENTER_X + amplitude * Math.sin(freqX * t);
      const y = CENTER_Y + amplitude * Math.sin(freqY * t + phaseShift);
      
      if (t === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw animated trail
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i-1];
        const curr = trail[i];
        const alpha = Math.max(0, 1 - curr.age * 2);
        
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.stroke();
      }
    }

    // Current position
    if (trail.length > 0) {
      const current = trail[trail.length - 1];
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(current.x, current.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAxes() {
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(50, CENTER_Y);
    ctx.lineTo(width - 50, CENTER_Y);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(CENTER_X, 50);
    ctx.lineTo(CENTER_X, height - 50);
    ctx.stroke();
    
    ctx.setLineDash([]);
  }

  function drawInfo() {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Lissajous Curves", 20, 30);

    ctx.font = "12px monospace";
    const infoLines = [
      "",
      `x = A·sin(${freqX}t)`,
      `y = A·sin(${freqY}t + ${phaseShift.toFixed(2)})`,
      "",
      `Frequency ratio: ${freqX}:${freqY}`,
      `Phase shift: ${(phaseShift * 180 / Math.PI).toFixed(0)}°`,
      "",
      "Applications:",
      "• Audio engineering",
      "• Signal analysis", 
      "• Oscilloscope patterns",
      "• Mechanical vibrations"
    ];

    let y = 50;
    infoLines.forEach(line => {
      if (line.includes("x =") || line.includes("y =")) {
        ctx.fillStyle = "#22d3ee";
      } else if (line.includes("ratio") || line.includes("shift")) {
        ctx.fillStyle = "#fbbf24";
      } else if (line.includes("•")) {
        ctx.fillStyle = "#94a3b8";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 15;
    });
  }

  function drawParameterSpace() {
    const gridX = width - 200;
    const gridY = 100;
    const gridSize = 150;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(gridX - 10, gridY - 10, gridSize + 20, gridSize + 60);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(gridX - 10, gridY - 10, gridSize + 20, gridSize + 60);

    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Common Ratios", gridX + gridSize/2, gridY - 15);

    // Draw mini Lissajous patterns for common ratios
    const ratios = [
      {fx: 1, fy: 1, phase: 0, label: "1:1"},
      {fx: 2, fy: 1, phase: 0, label: "2:1"},
      {fx: 3, fy: 2, phase: 0, label: "3:2"},
      {fx: 1, fy: 1, phase: Math.PI/2, label: "1:1 π/2"}
    ];

    ratios.forEach((ratio, index) => {
      const miniX = gridX + (index % 2) * gridSize/2 + gridSize/4;
      const miniY = gridY + Math.floor(index / 2) * gridSize/2 + gridSize/4;
      const miniSize = 30;

      // Draw mini curve
      ctx.strokeStyle = ratio.fx === freqX && ratio.fy === freqY && 
        Math.abs(ratio.phase - phaseShift) < 0.1 ? "#22c55e" : "#6b7280";
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let t = 0; t <= Math.PI * 2 * Math.max(ratio.fx, ratio.fy); t += 0.1) {
        const x = miniX + miniSize * Math.sin(ratio.fx * t);
        const y = miniY + miniSize * Math.sin(ratio.fy * t + ratio.phase);
        
        if (t === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(ratio.label, miniX, miniY + miniSize + 15);
    });
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawAxes();
    drawLissajousCurve();
    drawInfo();
    drawParameterSpace();
  }

  function reset() {
    time = 0;
    trail = [];
  }

  function getStateDescription(): string {
    return `Lissajous curve with frequency ratio ${freqX}:${freqY}, phase shift ${(phaseShift * 180/Math.PI).toFixed(0)}°. Parametric equations x = A·sin(${freqX}t), y = A·sin(${freqY}t + φ).`;
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

export default LissajousCurves;