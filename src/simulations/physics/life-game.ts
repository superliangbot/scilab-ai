import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LifeGameFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("life-game") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let gridCols = 64;
  let gridRows = 40;
  let speed = 5; // generations per second
  let initialDensity = 0.3;

  let grid: boolean[][] = [];
  let generation = 0;
  let aliveCells = 0;
  let stepAccum = 0;

  // History for population graph
  const popHistory: number[] = [];
  const MAX_HISTORY = 200;

  function createGrid(cols: number, rows: number): boolean[][] {
    const g: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      g[r] = [];
      for (let c = 0; c < cols; c++) {
        g[r][c] = false;
      }
    }
    return g;
  }

  function randomize() {
    grid = createGrid(gridCols, gridRows);
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        grid[r][c] = Math.random() < initialDensity;
      }
    }
    generation = 0;
    popHistory.length = 0;
    countAlive();
  }

  function countAlive() {
    aliveCells = 0;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (grid[r][c]) aliveCells++;
      }
    }
  }

  function countNeighbors(r: number, c: number): number {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = (r + dr + gridRows) % gridRows;
        const nc = (c + dc + gridCols) % gridCols;
        if (grid[nr][nc]) count++;
      }
    }
    return count;
  }

  function step() {
    const newGrid = createGrid(gridCols, gridRows);
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const n = countNeighbors(r, c);
        if (grid[r][c]) {
          // Alive: survives with 2 or 3 neighbors
          newGrid[r][c] = n === 2 || n === 3;
        } else {
          // Dead: born with exactly 3 neighbors
          newGrid[r][c] = n === 3;
        }
      }
    }
    grid = newGrid;
    generation++;
    countAlive();
    popHistory.push(aliveCells);
    if (popHistory.length > MAX_HISTORY) popHistory.shift();
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    randomize();
  }

  function update(dt: number, params: Record<string, number>) {
    const newCols = Math.round(params.gridSize ?? 64);
    const newDensity = params.initialDensity ?? 0.3;
    speed = params.speed ?? 5;

    if (newCols !== gridCols || newDensity !== initialDensity) {
      gridCols = newCols;
      gridRows = Math.round(newCols * 0.625);
      initialDensity = newDensity;
      randomize();
    }

    const dtClamped = Math.min(dt, 0.1);
    time += dtClamped;

    // Step at the configured speed
    stepAccum += dtClamped * speed;
    while (stepAccum >= 1) {
      step();
      stepAccum -= 1;
    }
  }

  function render() {
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Conway's Game of Life", W / 2, 24);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Generation: ${generation} | Alive: ${aliveCells} / ${gridCols * gridRows} | Speed: ${speed} gen/s`, W / 2, 42);

    // Grid area
    const gridLeft = 20;
    const gridTop = 52;
    const gridW = W - 40;
    const gridH = H - 150;
    const cellW = gridW / gridCols;
    const cellH = gridH / gridRows;

    // Draw grid background
    ctx.fillStyle = "#111827";
    ctx.fillRect(gridLeft, gridTop, gridW, gridH);

    // Draw cells
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (grid[r][c]) {
          const cx = gridLeft + c * cellW;
          const cy = gridTop + r * cellH;

          // Color based on neighbor count for visual interest
          const n = countNeighbors(r, c);
          let color: string;
          if (n <= 1) color = "#ef4444"; // about to die (underpopulation)
          else if (n <= 3) color = "#10b981"; // healthy
          else color = "#f59e0b"; // about to die (overpopulation)

          ctx.fillStyle = color;
          ctx.fillRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
        }
      }
    }

    // Grid lines (only if cells are large enough)
    if (cellW > 4) {
      ctx.strokeStyle = "rgba(30, 41, 59, 0.5)";
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= gridCols; c++) {
        ctx.beginPath();
        ctx.moveTo(gridLeft + c * cellW, gridTop);
        ctx.lineTo(gridLeft + c * cellW, gridTop + gridH);
        ctx.stroke();
      }
      for (let r = 0; r <= gridRows; r++) {
        ctx.beginPath();
        ctx.moveTo(gridLeft, gridTop + r * cellH);
        ctx.lineTo(gridLeft + gridW, gridTop + r * cellH);
        ctx.stroke();
      }
    }

    // Border
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gridLeft, gridTop, gridW, gridH);

    // Population graph
    const graphY = gridTop + gridH + 10;
    const graphH2 = H - graphY - 35;
    const graphW2 = W * 0.6;
    const graphL = 20;

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(graphL, graphY, graphW2, graphH2);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphL, graphY, graphW2, graphH2);

    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText("Population over time", graphL + 5, graphY + 11);

    if (popHistory.length > 1) {
      const maxPop = Math.max(...popHistory, 1);
      ctx.beginPath();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < popHistory.length; i++) {
        const px = graphL + (i / MAX_HISTORY) * graphW2;
        const py = graphY + graphH2 - (popHistory[i] / maxPop) * (graphH2 - 15);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Rules panel
    const rulesX = graphL + graphW2 + 15;
    const rulesW = W - rulesX - 20;

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(rulesX, graphY, rulesW, graphH2);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(rulesX, graphY, rulesW, graphH2);

    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Rules:", rulesX + 8, graphY + 14);

    ctx.font = "9px system-ui, sans-serif";
    const rules = [
      { color: "#ef4444", text: "< 2 neighbors → dies (underpop)" },
      { color: "#10b981", text: "2-3 neighbors → survives" },
      { color: "#f59e0b", text: "> 3 neighbors → dies (overpop)" },
      { color: "#3b82f6", text: "Dead + 3 neighbors → born" },
    ];
    let ry = graphY + 28;
    for (const rule of rules) {
      ctx.fillStyle = rule.color;
      ctx.fillRect(rulesX + 8, ry - 6, 8, 8);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(rule.text, rulesX + 22, ry);
      ry += 14;
    }

    // Bottom info
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "center";
    ctx.fillText("Cellular automaton by John Conway (1970) — complex patterns emerge from simple rules", W / 2, H - 8);
  }

  function reset() {
    randomize();
    time = 0;
    stepAccum = 0;
  }

  function destroy() {
    grid = [];
    popHistory.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Conway's Game of Life: ${gridCols}×${gridRows} grid, Generation ${generation}. ` +
      `Alive cells: ${aliveCells} / ${gridCols * gridRows} (${((aliveCells / (gridCols * gridRows)) * 100).toFixed(1)}%). ` +
      `Speed: ${speed} gen/s. Rules: underpopulation (<2), survival (2-3), overpopulation (>3), birth (exactly 3). ` +
      `Demonstrates emergent complexity from simple local rules.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LifeGameFactory;
