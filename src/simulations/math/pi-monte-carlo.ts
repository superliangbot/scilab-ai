import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Point {
  x: number;
  y: number;
  inside: boolean;
  age: number;
}

const PiMonteCarlo: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pi-monte-carlo") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let samplesPerSecond = 100;
  let showAllPoints = 1;
  let animationSpeed = 1;
  let resetData = 0;

  // Monte Carlo state
  let points: Point[] = [];
  let totalSamples = 0;
  let insideCircle = 0;
  let currentPi = 0;
  let piHistory: number[] = [];
  let errorHistory: number[] = [];

  // Visual settings
  const SQUARE_SIZE = 200;
  const SQUARE_X = width * 0.15;
  const SQUARE_Y = height * 0.5 - SQUARE_SIZE / 2;
  const MAX_POINTS_DISPLAY = 2000;
  const MAX_HISTORY = 500;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    resetSimulation();
  }

  function resetSimulation() {
    points = [];
    totalSamples = 0;
    insideCircle = 0;
    currentPi = 0;
    piHistory = [];
    errorHistory = [];
  }

  function update(dt: number, params: Record<string, number>) {
    samplesPerSecond = params.samplesPerSecond ?? samplesPerSecond;
    showAllPoints = Math.round(params.showAllPoints ?? showAllPoints);
    animationSpeed = params.animationSpeed ?? animationSpeed;
    
    if (Math.round(params.resetData ?? resetData) !== resetData) {
      resetData = Math.round(params.resetData ?? resetData);
      if (resetData === 1) {
        resetSimulation();
      }
    }

    time += dt;

    // Generate new random points
    const pointsToGenerate = Math.floor(samplesPerSecond * animationSpeed * dt);
    
    for (let i = 0; i < pointsToGenerate; i++) {
      generateRandomPoint();
    }

    // Update point aging for visual effects
    points.forEach(point => {
      point.age += dt;
    });

    // Limit displayed points for performance
    if (points.length > MAX_POINTS_DISPLAY) {
      points = points.slice(-MAX_POINTS_DISPLAY);
    }

    // Calculate current π estimate
    if (totalSamples > 0) {
      currentPi = 4 * insideCircle / totalSamples;
      
      // Store history periodically
      if (totalSamples % 10 === 0) {
        piHistory.push(currentPi);
        errorHistory.push(Math.abs(currentPi - Math.PI));
        
        if (piHistory.length > MAX_HISTORY) {
          piHistory.shift();
          errorHistory.shift();
        }
      }
    }
  }

  function generateRandomPoint() {
    // Generate random point in unit square [-1, 1] × [-1, 1]
    const x = Math.random() * 2 - 1;
    const y = Math.random() * 2 - 1;
    
    // Check if point is inside unit circle
    const distanceSquared = x * x + y * y;
    const inside = distanceSquared <= 1;
    
    points.push({
      x: x,
      y: y,
      inside: inside,
      age: 0
    });
    
    totalSamples++;
    if (inside) {
      insideCircle++;
    }
  }

  function drawSquareAndCircle() {
    // Draw unit square
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.strokeRect(SQUARE_X, SQUARE_Y, SQUARE_SIZE, SQUARE_SIZE);
    
    // Fill square with dark background
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.fillRect(SQUARE_X, SQUARE_Y, SQUARE_SIZE, SQUARE_SIZE);
    
    // Draw unit circle
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      SQUARE_X + SQUARE_SIZE / 2, 
      SQUARE_Y + SQUARE_SIZE / 2,
      SQUARE_SIZE / 2, 
      0, 
      Math.PI * 2
    );
    ctx.stroke();
    
    // Fill circle with translucent color
    ctx.fillStyle = "rgba(34, 211, 238, 0.1)";
    ctx.fill();
    
    // Coordinate labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    
    // Corner coordinates
    ctx.fillText("(-1, 1)", SQUARE_X - 10, SQUARE_Y - 5);
    ctx.fillText("(1, 1)", SQUARE_X + SQUARE_SIZE + 10, SQUARE_Y - 5);
    ctx.fillText("(-1, -1)", SQUARE_X - 10, SQUARE_Y + SQUARE_SIZE + 15);
    ctx.fillText("(1, -1)", SQUARE_X + SQUARE_SIZE + 10, SQUARE_Y + SQUARE_SIZE + 15);
    
    // Center
    ctx.fillText("(0, 0)", SQUARE_X + SQUARE_SIZE/2, SQUARE_Y + SQUARE_SIZE/2 + 20);
  }

  function drawPoints() {
    if (!showAllPoints && points.length > 200) {
      // Show only recent points for performance
      const recentPoints = points.slice(-200);
      drawPointSet(recentPoints);
    } else {
      drawPointSet(points);
    }
  }

  function drawPointSet(pointSet: Point[]) {
    pointSet.forEach(point => {
      // Convert from unit coordinates to screen coordinates
      const screenX = SQUARE_X + (point.x + 1) * SQUARE_SIZE / 2;
      const screenY = SQUARE_Y + (-point.y + 1) * SQUARE_SIZE / 2;
      
      // Color based on inside/outside circle
      const alpha = Math.max(0.3, 1 - point.age * 0.5);
      if (point.inside) {
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
      }
      
      // Point size based on age
      const size = Math.max(1, 2.5 - point.age);
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawStatistics() {
    const statsX = SQUARE_X + SQUARE_SIZE + 40;
    const statsY = SQUARE_Y;
    
    // Background box
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(statsX - 10, statsY - 10, 200, 180);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(statsX - 10, statsY - 10, 200, 180);
    
    // Title
    ctx.fillStyle = "#22d3ee";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Statistics", statsX, statsY + 15);
    
    // Stats
    ctx.font = "12px monospace";
    const lineHeight = 20;
    let currentY = statsY + 40;
    
    const stats = [
      { label: "Total samples:", value: totalSamples.toLocaleString(), color: "#e2e8f0" },
      { label: "Inside circle:", value: insideCircle.toLocaleString(), color: "#22c55e" },
      { label: "Outside circle:", value: (totalSamples - insideCircle).toLocaleString(), color: "#ef4444" },
      { label: "Ratio (π/4):", value: totalSamples > 0 ? (insideCircle / totalSamples).toFixed(6) : "0", color: "#fbbf24" },
      { label: "π estimate:", value: currentPi.toFixed(6), color: "#22d3ee" },
      { label: "Actual π:", value: Math.PI.toFixed(6), color: "#94a3b8" },
      { label: "Error:", value: totalSamples > 0 ? Math.abs(currentPi - Math.PI).toFixed(6) : "0", color: "#f472b6" },
      { label: "Error %:", value: totalSamples > 0 ? (Math.abs(currentPi - Math.PI) / Math.PI * 100).toFixed(3) + "%" : "0%", color: "#f472b6" }
    ];
    
    stats.forEach(stat => {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(stat.label, statsX, currentY);
      ctx.fillStyle = stat.color;
      ctx.fillText(stat.value, statsX + 100, currentY);
      currentY += lineHeight;
    });
  }

  function drawConvergenceGraph() {
    if (piHistory.length < 2) return;
    
    const graphX = 50;
    const graphY = height - 150;
    const graphW = width - 100;
    const graphH = 80;
    
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(graphX - 5, graphY - 5, graphW + 10, graphH + 20);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX - 5, graphY - 5, graphW + 10, graphH + 20);
    
    // Target line (π)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const piY = graphY + graphH/2;
    ctx.beginPath();
    ctx.moveTo(graphX, piY);
    ctx.lineTo(graphX + graphW, piY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // π label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText("π", graphX - 10, piY + 3);
    
    // Pi estimate curve
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    piHistory.forEach((piEst, index) => {
      const x = graphX + (index / (piHistory.length - 1)) * graphW;
      // Scale around π
      const yOffset = (piEst - Math.PI) * 1000; // Amplify small differences
      const y = piY - yOffset;
      
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Graph labels
    ctx.fillStyle = "#22d3ee";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("π Convergence", graphX, graphY - 10);
    
    // Current value
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "right";
    ctx.fillText(`Current: ${currentPi.toFixed(6)}`, graphX + graphW, graphY - 10);
  }

  function drawFormula() {
    const formulaX = 50;
    const formulaY = 50;
    
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(formulaX - 10, formulaY - 10, 300, 100);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(formulaX - 10, formulaY - 10, 300, 100);
    
    // Title
    ctx.fillStyle = "#22d3ee";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Monte Carlo Method for π", formulaX, formulaY + 15);
    
    // Formula
    ctx.font = "12px monospace";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Area of circle = πr² = π (for r = 1)", formulaX, formulaY + 35);
    ctx.fillText("Area of square = 4 (for side = 2)", formulaX, formulaY + 50);
    ctx.fillText("Ratio = π/4", formulaX, formulaY + 65);
    
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("π ≈ 4 × (points inside circle) / (total points)", formulaX, formulaY + 80);
  }

  function drawLegend() {
    const legendX = SQUARE_X;
    const legendY = SQUARE_Y + SQUARE_SIZE + 30;
    
    // Inside circle
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(legendX + 10, legendY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#22c55e";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Inside circle", legendX + 20, legendY + 4);
    
    // Outside circle
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(legendX + 130, legendY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.fillText("Outside circle", legendX + 140, legendY + 4);
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    
    drawFormula();
    drawSquareAndCircle();
    drawPoints();
    drawStatistics();
    drawConvergenceGraph();
    drawLegend();
  }

  function reset() {
    time = 0;
    resetSimulation();
  }

  function getStateDescription(): string {
    if (totalSamples === 0) {
      return "Monte Carlo π estimation: starting simulation.";
    }
    
    const accuracy = totalSamples > 0 ? Math.abs(currentPi - Math.PI) / Math.PI * 100 : 100;
    return `Monte Carlo π estimation: ${totalSamples.toLocaleString()} samples, π ≈ ${currentPi.toFixed(6)} (error: ${accuracy.toFixed(3)}%). Law of large numbers in action!`;
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

export default PiMonteCarlo;