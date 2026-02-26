import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const WavePropagationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("wave-propagation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let waveSpeed = 100;
  let dampingFactor = 0.995;
  let gridDensity = 30;
  let sourceFreq = 2;

  // 2D grid of displacement values
  let grid: number[][] = [];
  let gridPrev: number[][] = [];
  let cols = 0;
  let rows = 0;
  let cellSize = 0;

  function initGrid(): void {
    cols = gridDensity;
    rows = Math.round(gridDensity * (height / width));
    cellSize = width / cols;

    grid = [];
    gridPrev = [];
    for (let r = 0; r < rows; r++) {
      grid.push(new Array(cols).fill(0));
      gridPrev.push(new Array(cols).fill(0));
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initGrid();
  }

  function update(dt: number, params: Record<string, number>): void {
    waveSpeed = params.waveSpeed ?? 100;
    dampingFactor = params.damping ?? 0.995;
    sourceFreq = params.sourceFreq ?? 2;

    const newDensity = Math.round(params.gridDensity ?? 30);
    if (newDensity !== gridDensity) {
      gridDensity = newDensity;
      initGrid();
    }

    // Point source at center
    const sr = Math.floor(rows / 2);
    const sc = Math.floor(cols / 2);
    const sourceVal = Math.sin(2 * Math.PI * sourceFreq * time) * 2;
    grid[sr][sc] = sourceVal;

    // 2D wave equation with finite differences
    const c2 = (waveSpeed * dt) * (waveSpeed * dt) / (cellSize * cellSize);
    const clamped = Math.min(c2, 0.4); // stability

    const newGrid: number[][] = [];
    for (let r = 0; r < rows; r++) {
      newGrid.push(new Array(cols).fill(0));
      for (let c = 0; c < cols; c++) {
        if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
          newGrid[r][c] = 0; // fixed boundary
          continue;
        }

        const laplacian = grid[r + 1][c] + grid[r - 1][c] + grid[r][c + 1] + grid[r][c - 1] - 4 * grid[r][c];
        newGrid[r][c] = 2 * grid[r][c] - gridPrev[r][c] + clamped * laplacian;
        newGrid[r][c] *= dampingFactor;
      }
    }

    gridPrev = grid;
    grid = newGrid;

    time += dt;
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a2e";
    ctx.fillRect(0, 0, width, height);

    // Draw wave field as color map
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = grid[r][c];
        const intensity = Math.min(1, Math.abs(val));

        let red = 0;
        let green = 0;
        let blue = 30;

        if (val > 0) {
          red = Math.round(intensity * 200);
          green = Math.round(intensity * 100);
          blue = 30 + Math.round(intensity * 80);
        } else {
          blue = 30 + Math.round(intensity * 200);
          green = Math.round(intensity * 80);
        }

        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize + 1, cellSize + 1);
      }
    }

    // Grid overlay
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize);
      ctx.lineTo(width, r * cellSize);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize, 0);
      ctx.lineTo(c * cellSize, height);
      ctx.stroke();
    }

    // Source indicator
    const srcX = Math.floor(cols / 2) * cellSize + cellSize / 2;
    const srcY = Math.floor(rows / 2) * cellSize + cellSize / 2;
    ctx.beginPath();
    ctx.arc(srcX, srcY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Wave Propagation (2D)", width / 2, 22);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height - 55, width - 20, 45, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Wave speed: ${waveSpeed} | Frequency: ${sourceFreq} Hz | Damping: ${dampingFactor}`, 22, height - 36);
    ctx.fillText("2D wave equation: ∂²u/∂t² = c² (∂²u/∂x² + ∂²u/∂y²)", 22, height - 18);
  }

  function reset(): void {
    time = 0;
    initGrid();
  }

  function destroy(): void {
    grid = [];
    gridPrev = [];
  }

  function getStateDescription(): string {
    return (
      `Wave Propagation: ${cols}×${rows} grid, wave speed=${waveSpeed}, ` +
      `source frequency=${sourceFreq}Hz, damping=${dampingFactor}. ` +
      `Central point source emitting circular waves. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initGrid();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default WavePropagationFactory;
