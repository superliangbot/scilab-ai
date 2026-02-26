import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Grid cell types ──────────────────────────────────────────
enum CellType {
  EMPTY = 0,
  WALL = 1,
  START = 2,
  GOAL = 3,
  PATH = 4,
  OPEN = 5,
  CLOSED = 6
}

// ─── A* Node ──────────────────────────────────────────────
interface AStarNode {
  x: number;
  y: number;
  g: number; // distance from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: AStarNode | null;
}

// ─── Factory ────────────────────────────────────────────────────────
const AStarPathfindingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("astar-pathfinding") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Grid dimensions
  const GRID_COLS = 25;
  const GRID_ROWS = 20;
  let cellWidth = 0;
  let cellHeight = 0;

  // State
  let grid: CellType[][] = [];
  let openSet: AStarNode[] = [];
  let closedSet: AStarNode[] = [];
  let path: AStarNode[] = [];
  let currentNode: AStarNode | null = null;
  let isSearching = false;
  let searchComplete = false;
  let stepDelay = 0;

  // Algorithm parameters
  let heuristic = 0; // 0=Manhattan, 1=Euclidean, 2=Diagonal
  let speed = 5;
  let allowDiagonal = 0;

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    
    initializeGrid();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
    cellWidth = W / GRID_COLS;
    cellHeight = H / GRID_ROWS;
  }

  function initializeGrid(): void {
    // Initialize empty grid
    grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(CellType.EMPTY));
    
    // Add some walls
    for (let i = 0; i < 50; i++) {
      const x = Math.floor(Math.random() * GRID_COLS);
      const y = Math.floor(Math.random() * GRID_ROWS);
      if (x !== 2 && y !== 2 && x !== GRID_COLS-3 && y !== GRID_ROWS-3) {
        grid[y][x] = CellType.WALL;
      }
    }

    // Set start and goal
    grid[2][2] = CellType.START;
    grid[GRID_ROWS-3][GRID_COLS-3] = CellType.GOAL;

    reset();
  }

  function reset(): void {
    openSet = [];
    closedSet = [];
    path = [];
    currentNode = null;
    isSearching = false;
    searchComplete = false;
    
    // Clear previous search visualization
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (grid[y][x] === CellType.OPEN || grid[y][x] === CellType.CLOSED || grid[y][x] === CellType.PATH) {
          grid[y][x] = CellType.EMPTY;
        }
      }
    }
    
    // Restore start and goal
    grid[2][2] = CellType.START;
    grid[GRID_ROWS-3][GRID_COLS-3] = CellType.GOAL;

    // Start search
    startSearch();
  }

  function startSearch(): void {
    openSet = [{
      x: 2,
      y: 2,
      g: 0,
      h: calculateHeuristic(2, 2, GRID_COLS-3, GRID_ROWS-3),
      f: 0,
      parent: null
    }];
    openSet[0].f = openSet[0].g + openSet[0].h;
    isSearching = true;
  }

  function calculateHeuristic(x1: number, y1: number, x2: number, y2: number): number {
    if (heuristic === 0) { // Manhattan
      return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    } else if (heuristic === 1) { // Euclidean
      return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
    } else { // Diagonal (Chebyshev)
      return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
    }
  }

  function getNeighbors(node: AStarNode): { x: number; y: number; cost: number }[] {
    const neighbors: { x: number; y: number; cost: number }[] = [];
    const directions = allowDiagonal ? 
      [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]] :
      [[-1,0], [1,0], [0,-1], [0,1]];
    
    for (const [dx, dy] of directions) {
      const x = node.x + dx;
      const y = node.y + dy;
      
      if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS && 
          grid[y][x] !== CellType.WALL) {
        const cost = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
        neighbors.push({ x, y, cost });
      }
    }
    
    return neighbors;
  }

  function stepSearch(): void {
    if (openSet.length === 0) {
      isSearching = false;
      return; // No path found
    }

    // Find node with lowest f score
    let bestIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIndex].f) {
        bestIndex = i;
      }
    }

    currentNode = openSet.splice(bestIndex, 1)[0];
    closedSet.push(currentNode);

    // Visualize closed node
    if (grid[currentNode.y][currentNode.x] === CellType.EMPTY) {
      grid[currentNode.y][currentNode.x] = CellType.CLOSED;
    }

    // Check if we reached the goal
    if (currentNode.x === GRID_COLS-3 && currentNode.y === GRID_ROWS-3) {
      // Reconstruct path
      path = [];
      let temp = currentNode;
      while (temp) {
        path.unshift(temp);
        temp = temp.parent;
      }
      
      // Visualize path
      for (const node of path) {
        if (grid[node.y][node.x] !== CellType.START && grid[node.y][node.x] !== CellType.GOAL) {
          grid[node.y][node.x] = CellType.PATH;
        }
      }
      
      isSearching = false;
      searchComplete = true;
      return;
    }

    // Check neighbors
    const neighbors = getNeighbors(currentNode);
    for (const neighbor of neighbors) {
      // Skip if in closed set
      if (closedSet.some(node => node.x === neighbor.x && node.y === neighbor.y)) {
        continue;
      }

      const tentativeG = currentNode.g + neighbor.cost;
      
      // Check if in open set
      const existingNode = openSet.find(node => node.x === neighbor.x && node.y === neighbor.y);
      
      if (!existingNode) {
        // Add to open set
        const newNode: AStarNode = {
          x: neighbor.x,
          y: neighbor.y,
          g: tentativeG,
          h: calculateHeuristic(neighbor.x, neighbor.y, GRID_COLS-3, GRID_ROWS-3),
          f: 0,
          parent: currentNode
        };
        newNode.f = newNode.g + newNode.h;
        openSet.push(newNode);
        
        // Visualize open node
        if (grid[neighbor.y][neighbor.x] === CellType.EMPTY) {
          grid[neighbor.y][neighbor.x] = CellType.OPEN;
        }
      } else if (tentativeG < existingNode.g) {
        // Update existing node
        existingNode.g = tentativeG;
        existingNode.f = existingNode.g + existingNode.h;
        existingNode.parent = currentNode;
      }
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    heuristic = params.heuristic ?? 0;
    speed = params.speed ?? 5;
    allowDiagonal = params.allowDiagonal ?? 0;

    if (isSearching) {
      stepDelay += dt;
      if (stepDelay >= 1 / speed) {
        stepSearch();
        stepDelay = 0;
      }
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    // Draw grid
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const cellX = x * cellWidth;
        const cellY = y * cellHeight;
        
        // Cell color based on type
        switch (grid[y][x]) {
          case CellType.EMPTY:
            ctx.fillStyle = "#ffffff";
            break;
          case CellType.WALL:
            ctx.fillStyle = "#2d3748";
            break;
          case CellType.START:
            ctx.fillStyle = "#48bb78";
            break;
          case CellType.GOAL:
            ctx.fillStyle = "#ed8936";
            break;
          case CellType.PATH:
            ctx.fillStyle = "#4299e1";
            break;
          case CellType.OPEN:
            ctx.fillStyle = "#68d391";
            break;
          case CellType.CLOSED:
            ctx.fillStyle = "#fc8181";
            break;
        }
        
        ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
        
        // Grid lines
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, cellWidth, cellHeight);
      }
    }

    // Draw current node highlight
    if (currentNode && isSearching) {
      ctx.strokeStyle = "#2d3748";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        currentNode.x * cellWidth + 2,
        currentNode.y * cellHeight + 2,
        cellWidth - 4,
        cellHeight - 4
      );
    }

    // Draw legend
    drawLegend();
  }

  function drawLegend(): void {
    const legendX = 10;
    const legendY = H - 150;
    const boxSize = 15;
    const spacing = 25;

    const legend = [
      { color: "#48bb78", label: "Start" },
      { color: "#ed8936", label: "Goal" },
      { color: "#2d3748", label: "Wall" },
      { color: "#68d391", label: "Open Set" },
      { color: "#fc8181", label: "Closed Set" },
      { color: "#4299e1", label: "Path" }
    ];

    ctx.font = "12px sans-serif";
    for (let i = 0; i < legend.length; i++) {
      const y = legendY + i * spacing;
      
      ctx.fillStyle = legend[i].color;
      ctx.fillRect(legendX, y, boxSize, boxSize);
      
      ctx.fillStyle = "#2d3748";
      ctx.fillText(legend[i].label, legendX + boxSize + 8, y + 12);
    }

    // Algorithm info
    const heuristicNames = ["Manhattan", "Euclidean", "Diagonal"];
    ctx.fillStyle = "#4a5568";
    ctx.font = "14px sans-serif";
    ctx.fillText(`Heuristic: ${heuristicNames[heuristic]}`, legendX + 120, legendY + 15);
    ctx.fillText(`Diagonal: ${allowDiagonal ? "Yes" : "No"}`, legendX + 120, legendY + 35);
    ctx.fillText(`Open: ${openSet.length}`, legendX + 120, legendY + 55);
    ctx.fillText(`Closed: ${closedSet.length}`, legendX + 120, legendY + 75);
    if (path.length > 0) {
      ctx.fillText(`Path Length: ${path.length}`, legendX + 120, legendY + 95);
    }
  }

  function getStateDescription(): string {
    const heuristicNames = ["Manhattan", "Euclidean", "Diagonal"];
    return `A* Pathfinding Algorithm: Finding optimal path from start (green) to goal (orange). ` +
           `Using ${heuristicNames[heuristic]} heuristic. Open set: ${openSet.length} nodes, ` +
           `Closed set: ${closedSet.length} nodes. ${searchComplete ? `Path found with ${path.length} steps!` : isSearching ? 'Searching...' : 'Ready to search.'}`;
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

export default AStarPathfindingFactory;