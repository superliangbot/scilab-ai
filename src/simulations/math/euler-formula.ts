import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EulerFormula: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("euler-formula") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let frequency = 1; // Frequency of rotation
  let showComponents = 1; // Show sin/cos projections
  let showSpiral = 1; // Show exponential spiral
  let amplitude = 100; // Visual amplitude

  // Animation state
  let theta = 0; // Current angle
  let trailPoints: Array<{x: number, y: number, age: number}> = [];
  let projectionHistory: Array<{cos: number, sin: number, age: number}> = [];
  const maxTrail = 200;
  const maxHistory = 300;

  const CENTER_X = width * 0.3;
  const CENTER_Y = height * 0.5;
  const GRAPH_X = width * 0.55;
  const GRAPH_Y = height * 0.3;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    theta = 0;
    trailPoints = [];
    projectionHistory = [];
  }

  function update(dt: number, params: Record<string, number>) {
    frequency = params.frequency ?? frequency;
    showComponents = Math.round(params.showComponents ?? showComponents);
    showSpiral = Math.round(params.showSpiral ?? showSpiral);
    amplitude = params.amplitude ?? amplitude;

    time += dt;
    theta = time * frequency * 2 * Math.PI;

    // Calculate current position on unit circle
    const x = CENTER_X + amplitude * Math.cos(theta);
    const y = CENTER_Y - amplitude * Math.sin(theta); // Negative for screen coordinates

    // Add to trail
    trailPoints.push({ x, y, age: 0 });
    if (trailPoints.length > maxTrail) {
      trailPoints.shift();
    }

    // Update trail ages
    trailPoints.forEach(point => {
      point.age += dt;
    });

    // Add to projection history
    projectionHistory.push({
      cos: Math.cos(theta),
      sin: Math.sin(theta),
      age: 0
    });
    if (projectionHistory.length > maxHistory) {
      projectionHistory.shift();
    }

    // Update history ages
    projectionHistory.forEach(point => {
      point.age += dt;
    });
  }

  function drawUnitCircle() {
    // Unit circle
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, amplitude, 0, Math.PI * 2);
    ctx.stroke();

    // Axes
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    // Horizontal axis
    ctx.beginPath();
    ctx.moveTo(CENTER_X - amplitude - 20, CENTER_Y);
    ctx.lineTo(CENTER_X + amplitude + 20, CENTER_Y);
    ctx.stroke();
    
    // Vertical axis
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y - amplitude - 20);
    ctx.lineTo(CENTER_X, CENTER_Y + amplitude + 20);
    ctx.stroke();
    
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Real", CENTER_X + amplitude + 30, CENTER_Y + 5);
    ctx.fillText("Imaginary", CENTER_X - 5, CENTER_Y - amplitude - 25);

    // Unit markings
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("1", CENTER_X + amplitude, CENTER_Y + 15);
    ctx.fillText("-1", CENTER_X - amplitude, CENTER_Y + 15);
    ctx.fillText("i", CENTER_X - 10, CENTER_Y - amplitude);
    ctx.fillText("-i", CENTER_X - 15, CENTER_Y + amplitude);
  }

  function drawRotatingVector() {
    const currentX = CENTER_X + amplitude * Math.cos(theta);
    const currentY = CENTER_Y - amplitude * Math.sin(theta);

    // Vector from origin to current point
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    // Arrow head
    const arrowAngle = theta + Math.PI;
    const arrowSize = 8;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(
      currentX + arrowSize * Math.cos(arrowAngle + 0.5),
      currentY - arrowSize * Math.sin(arrowAngle + 0.5)
    );
    ctx.lineTo(
      currentX + arrowSize * Math.cos(arrowAngle - 0.5),
      currentY - arrowSize * Math.sin(arrowAngle - 0.5)
    );
    ctx.fill();

    // Current point
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Components (projections)
    if (showComponents) {
      // Horizontal component (real part)
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(CENTER_X, currentY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      // Vertical component (imaginary part)
      ctx.strokeStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(currentX, CENTER_Y);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      ctx.setLineDash([]);

      // Component labels
      ctx.fillStyle = "#22c55e";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`cos(${theta.toFixed(2)})`, (CENTER_X + currentX) / 2, currentY + 15);
      
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`sin(${theta.toFixed(2)})`, currentX + 20, (CENTER_Y + currentY) / 2);
    }

    // Trail
    if (showSpiral) {
      ctx.strokeStyle = "rgba(34, 211, 238, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      trailPoints.forEach((point, index) => {
        const alpha = Math.max(0, 1 - point.age * 2);
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.globalAlpha = alpha;
          ctx.lineTo(point.x, point.y);
        }
      });
      
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
  }

  function drawWaveforms() {
    const graphW = 200;
    const graphH = 80;
    const graphSpacing = 100;

    // Cosine wave
    drawWaveform(
      GRAPH_X, GRAPH_Y,
      graphW, graphH,
      "cos(ωt)", "#22c55e",
      projectionHistory.map(p => p.cos)
    );

    // Sine wave
    drawWaveform(
      GRAPH_X, GRAPH_Y + graphSpacing,
      graphW, graphH,
      "sin(ωt)", "#ef4444",
      projectionHistory.map(p => p.sin)
    );

    // Complex exponential (3D-like projection)
    if (showSpiral) {
      drawComplexWave(
        GRAPH_X, GRAPH_Y + 2 * graphSpacing,
        graphW, graphH
      );
    }
  }

  function drawWaveform(x: number, y: number, w: number, h: number, 
                        label: string, color: string, data: number[]) {
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);

    // Zero line
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.beginPath();
    ctx.moveTo(x, y + h/2);
    ctx.lineTo(x + w, y + h/2);
    ctx.stroke();

    // Waveform
    if (data.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      data.forEach((value, index) => {
        const plotX = x + (index / (data.length - 1)) * w;
        const plotY = y + h/2 - value * h/2 * 0.8;
        
        if (index === 0) {
          ctx.moveTo(plotX, plotY);
        } else {
          ctx.lineTo(plotX, plotY);
        }
      });
      
      ctx.stroke();
    }

    // Current value indicator
    const currentValue = data[data.length - 1] || 0;
    const currentY = y + h/2 - currentValue * h/2 * 0.8;
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + w, currentY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = color;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(label, x, y - 10);

    // Current value
    ctx.font = "10px monospace";
    ctx.fillText(`${currentValue.toFixed(3)}`, x + w - 50, y - 10);
  }

  function drawComplexWave(x: number, y: number, w: number, h: number) {
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);

    // Complex exponential spiral projection
    if (projectionHistory.length > 1) {
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      projectionHistory.forEach((point, index) => {
        const t = index / (projectionHistory.length - 1);
        const plotX = x + t * w;
        // Project 3D spiral onto 2D (showing real and imaginary components combined)
        const combined = point.cos + point.sin * 0.5; // Pseudo-3D effect
        const plotY = y + h/2 - combined * h/4;
        
        if (index === 0) {
          ctx.moveTo(plotX, plotY);
        } else {
          ctx.lineTo(plotX, plotY);
        }
      });
      
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("e^(iωt)", x, y - 10);
  }

  function drawFormulas() {
    const formulaX = 50;
    const formulaY = 50;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(formulaX - 10, formulaY - 10, 350, 120);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(formulaX - 10, formulaY - 10, 350, 120);

    // Title
    ctx.fillStyle = "#22d3ee";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Euler's Formula", formulaX, formulaY + 15);

    // Main formula
    ctx.fillStyle = "#fbbf24";
    ctx.font = "14px monospace";
    ctx.fillText("e^(iθ) = cos(θ) + i·sin(θ)", formulaX, formulaY + 40);

    // Current values
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    const cosValue = Math.cos(theta);
    const sinValue = Math.sin(theta);
    
    ctx.fillText(`θ = ${theta.toFixed(3)} rad = ${(theta * 180/Math.PI).toFixed(1)}°`, formulaX, formulaY + 60);
    ctx.fillText(`cos(θ) = ${cosValue.toFixed(3)}`, formulaX, formulaY + 75);
    ctx.fillText(`sin(θ) = ${sinValue.toFixed(3)}`, formulaX, formulaY + 90);
    
    // Complex number representation
    const sign = sinValue >= 0 ? "+" : "-";
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`e^(i·${theta.toFixed(3)}) = ${cosValue.toFixed(3)} ${sign} i·${Math.abs(sinValue).toFixed(3)}`, formulaX, formulaY + 105);
  }

  function drawComplexPlane() {
    const planeX = width - 150;
    const planeY = 100;
    const planeRadius = 60;

    // Background circle
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.beginPath();
    ctx.arc(planeX, planeY, planeRadius + 10, 0, Math.PI * 2);
    ctx.fill();

    // Unit circle
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(planeX, planeY, planeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Axes
    ctx.strokeStyle = "#6b7280";
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(planeX - planeRadius - 5, planeY);
    ctx.lineTo(planeX + planeRadius + 5, planeY);
    ctx.moveTo(planeX, planeY - planeRadius - 5);
    ctx.lineTo(planeX, planeY + planeRadius + 5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current complex number
    const realPart = Math.cos(theta);
    const imagPart = -Math.sin(theta); // Negative for screen coordinates
    const pointX = planeX + realPart * planeRadius;
    const pointY = planeY + imagPart * planeRadius;

    // Vector
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(planeX, planeY);
    ctx.lineTo(pointX, pointY);
    ctx.stroke();

    // Point
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath();
    ctx.arc(pointX, pointY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Angle arc
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(planeX, planeY, planeRadius * 0.3, 0, -theta, true);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Complex Plane", planeX, planeY + planeRadius + 25);
    ctx.fillText("Re", planeX + planeRadius + 15, planeY + 5);
    ctx.fillText("Im", planeX - 5, planeY - planeRadius - 10);
  }

  function drawSpecialValues() {
    const specialX = width - 200;
    const specialY = 250;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(specialX - 10, specialY - 10, 180, 200);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(specialX - 10, specialY - 10, 180, 200);

    // Title
    ctx.fillStyle = "#34d399";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Special Values:", specialX, specialY + 15);

    const specials = [
      { angle: "0", exp: "e^(i·0) = 1", color: "#22c55e" },
      { angle: "π/2", exp: "e^(i·π/2) = i", color: "#3b82f6" },
      { angle: "π", exp: "e^(i·π) = -1", color: "#ef4444" },
      { angle: "3π/2", exp: "e^(i·3π/2) = -i", color: "#f59e0b" },
      { angle: "2π", exp: "e^(i·2π) = 1", color: "#22c55e" }
    ];

    ctx.font = "10px monospace";
    specials.forEach((special, index) => {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`θ = ${special.angle}:`, specialX, specialY + 35 + index * 20);
      ctx.fillStyle = special.color;
      ctx.fillText(special.exp, specialX, specialY + 48 + index * 20);
    });

    // Euler's identity highlight
    ctx.fillStyle = "#ec4899";
    ctx.font = "11px monospace";
    ctx.fillText("Euler's Identity:", specialX, specialY + 150);
    ctx.font = "12px monospace";
    ctx.fillText("e^(iπ) + 1 = 0", specialX, specialY + 165);
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.fillText("\"Most beautiful formula", specialX, specialY + 180);
    ctx.fillText("in mathematics\"", specialX, specialY + 190);
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawFormulas();
    drawUnitCircle();
    drawRotatingVector();
    drawWaveforms();
    drawComplexPlane();
    drawSpecialValues();
  }

  function reset() {
    time = 0;
    theta = 0;
    trailPoints = [];
    projectionHistory = [];
  }

  function getStateDescription(): string {
    const degrees = (theta * 180 / Math.PI) % 360;
    const realPart = Math.cos(theta);
    const imagPart = Math.sin(theta);
    return `Euler's formula: e^(i·${theta.toFixed(3)}) = ${realPart.toFixed(3)} + i·${imagPart.toFixed(3)}. Angle: ${degrees.toFixed(1)}°. Unity on the complex circle.`;
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

export default EulerFormula;