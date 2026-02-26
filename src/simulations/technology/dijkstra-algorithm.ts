import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Graph node ──────────────────────────────────────────
interface GraphNode {
  id: number;
  x: number;
  y: number;
  distance: number;
  previous: GraphNode | null;
  visited: boolean;
}

// ─── Graph edge ──────────────────────────────────────────
interface GraphEdge {
  from: number;
  to: number;
  weight: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const DijkstraAlgorithmFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("dijkstra-algorithm") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  // Graph state
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];
  let unvisited: Set<number> = new Set();
  let currentNode: number = 0;
  let targetNode: number = 0;
  let isRunning = false;
  let stepDelay = 0;
  let pathFound = false;
  let shortestPath: number[] = [];

  // Parameters
  let numNodes = 8;
  let speed = 3;
  let graphType = 0; // 0=random, 1=grid, 2=circular

  const NODE_RADIUS = 25;
  const COLORS = {
    unvisited: "#e2e8f0",
    current: "#fbbf24",
    visited: "#34d399",
    target: "#f87171",
    path: "#3b82f6"
  };

  function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    ctx = canvas.getContext("2d")!;
    resize(canvas.width, canvas.height);
    generateGraph();
  }

  function resize(width: number, height: number): void {
    W = width;
    H = height;
  }

  function generateGraph(): void {
    nodes = [];
    edges = [];
    
    // Generate nodes based on graph type
    if (graphType === 0) { // Random
      generateRandomGraph();
    } else if (graphType === 1) { // Grid
      generateGridGraph();
    } else { // Circular
      generateCircularGraph();
    }

    reset();
  }

  function generateRandomGraph(): void {
    const margin = 80;
    
    // Create nodes at random positions
    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        id: i,
        x: margin + Math.random() * (W - 2 * margin),
        y: margin + Math.random() * (H - 2 * margin),
        distance: Infinity,
        previous: null,
        visited: false
      });
    }

    // Create edges (sparse connectivity)
    for (let i = 0; i < numNodes; i++) {
      for (let j = i + 1; j < numNodes; j++) {
        const dist = Math.sqrt((nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2);
        if (dist < 150 || Math.random() < 0.3) {
          const weight = Math.floor(dist / 10);
          edges.push({ from: i, to: j, weight });
        }
      }
    }
  }

  function generateGridGraph(): void {
    const cols = Math.ceil(Math.sqrt(numNodes));
    const rows = Math.ceil(numNodes / cols);
    const cellW = (W - 100) / cols;
    const cellH = (H - 100) / rows;
    
    // Create grid nodes
    let nodeId = 0;
    for (let row = 0; row < rows && nodeId < numNodes; row++) {
      for (let col = 0; col < cols && nodeId < numNodes; col++) {
        nodes.push({
          id: nodeId,
          x: 50 + col * cellW + cellW / 2,
          y: 50 + row * cellH + cellH / 2,
          distance: Infinity,
          previous: null,
          visited: false
        });
        nodeId++;
      }
    }

    // Create grid edges
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const nodeId = row * cols + col;
        if (nodeId >= numNodes) break;
        
        // Right edge
        if (col < cols - 1 && nodeId + 1 < numNodes) {
          edges.push({ from: nodeId, to: nodeId + 1, weight: Math.floor(1 + Math.random() * 9) });
        }
        
        // Down edge
        if (row < rows - 1 && nodeId + cols < numNodes) {
          edges.push({ from: nodeId, to: nodeId + cols, weight: Math.floor(1 + Math.random() * 9) });
        }
      }
    }
  }

  function generateCircularGraph(): void {
    const centerX = W / 2;
    const centerY = H / 2;
    const radius = Math.min(W, H) / 3;
    
    // Create nodes in a circle
    for (let i = 0; i < numNodes; i++) {
      const angle = (2 * Math.PI * i) / numNodes;
      nodes.push({
        id: i,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        distance: Infinity,
        previous: null,
        visited: false
      });
    }

    // Create edges (each node connects to neighbors and some random connections)
    for (let i = 0; i < numNodes; i++) {
      // Connect to next node in circle
      const next = (i + 1) % numNodes;
      edges.push({ from: i, to: next, weight: Math.floor(1 + Math.random() * 9) });
      
      // Random connections
      if (Math.random() < 0.4) {
        const target = Math.floor(Math.random() * numNodes);
        if (target !== i && !edges.some(e => (e.from === i && e.to === target) || (e.from === target && e.to === i))) {
          edges.push({ from: i, to: target, weight: Math.floor(5 + Math.random() * 15) });
        }
      }
    }
  }

  function reset(): void {
    // Reset all nodes
    for (const node of nodes) {
      node.distance = Infinity;
      node.previous = null;
      node.visited = false;
    }
    
    // Set start and target
    currentNode = 0;
    targetNode = nodes.length - 1;
    
    // Initialize algorithm
    nodes[currentNode].distance = 0;
    unvisited = new Set(nodes.map(n => n.id));
    isRunning = false;
    pathFound = false;
    shortestPath = [];
    stepDelay = 0;
  }

  function startAlgorithm(): void {
    if (!isRunning && !pathFound) {
      isRunning = true;
    }
  }

  function stepAlgorithm(): void {
    if (unvisited.size === 0 || nodes[currentNode].distance === Infinity) {
      isRunning = false;
      return;
    }

    // Visit current node
    nodes[currentNode].visited = true;
    unvisited.delete(currentNode);

    // Check if we reached the target
    if (currentNode === targetNode) {
      reconstructPath();
      isRunning = false;
      pathFound = true;
      return;
    }

    // Update distances to neighbors
    for (const edge of edges) {
      let neighbor = -1;
      if (edge.from === currentNode && unvisited.has(edge.to)) {
        neighbor = edge.to;
      } else if (edge.to === currentNode && unvisited.has(edge.from)) {
        neighbor = edge.from;
      }
      
      if (neighbor !== -1) {
        const altDistance = nodes[currentNode].distance + edge.weight;
        if (altDistance < nodes[neighbor].distance) {
          nodes[neighbor].distance = altDistance;
          nodes[neighbor].previous = nodes[currentNode];
        }
      }
    }

    // Find next unvisited node with minimum distance
    let minDistance = Infinity;
    let nextNode = -1;
    for (const nodeId of unvisited) {
      if (nodes[nodeId].distance < minDistance) {
        minDistance = nodes[nodeId].distance;
        nextNode = nodeId;
      }
    }

    if (nextNode !== -1) {
      currentNode = nextNode;
    } else {
      isRunning = false;
    }
  }

  function reconstructPath(): void {
    shortestPath = [];
    let node = nodes[targetNode];
    
    while (node !== null) {
      shortestPath.unshift(node.id);
      node = node.previous;
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const newNumNodes = params.numNodes ?? 8;
    const newSpeed = params.speed ?? 3;
    const newGraphType = params.graphType ?? 0;
    
    if (newNumNodes !== numNodes || newGraphType !== graphType) {
      numNodes = newNumNodes;
      graphType = newGraphType;
      generateGraph();
    }
    
    speed = newSpeed;

    // Auto-start after reset
    if (!isRunning && !pathFound && unvisited.has(currentNode)) {
      stepDelay += dt;
      if (stepDelay >= 500) { // Small delay before starting
        startAlgorithm();
      }
    }

    if (isRunning) {
      stepDelay += dt;
      if (stepDelay >= 1 / speed) {
        stepAlgorithm();
        stepDelay = 0;
      }
    }
  }

  function render(): void {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(0, 0, W, H);

    // Draw edges
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 2;
    
    for (const edge of edges) {
      const from = nodes[edge.from];
      const to = nodes[edge.to];
      
      // Highlight path edges
      if (shortestPath.includes(edge.from) && shortestPath.includes(edge.to) &&
          Math.abs(shortestPath.indexOf(edge.from) - shortestPath.indexOf(edge.to)) === 1) {
        ctx.strokeStyle = COLORS.path;
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = "#cbd5e0";
        ctx.lineWidth = 2;
      }
      
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      
      // Draw edge weight
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(midX, midY, 12, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = "#2d3748";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.weight.toString(), midX, midY + 3);
    }

    // Draw nodes
    for (const node of nodes) {
      // Node color
      let color = COLORS.unvisited;
      if (node.id === targetNode) {
        color = COLORS.target;
      } else if (node.id === currentNode) {
        color = COLORS.current;
      } else if (node.visited) {
        color = COLORS.visited;
      }
      
      // Path highlight
      if (shortestPath.includes(node.id)) {
        ctx.strokeStyle = COLORS.path;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, NODE_RADIUS + 3, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      // Node circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Node label and distance
      ctx.fillStyle = "#2d3748";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.id.toString(), node.x, node.y - 2);
      
      if (node.distance !== Infinity) {
        ctx.font = "10px sans-serif";
        ctx.fillText(node.distance.toString(), node.x, node.y + 10);
      }
    }

    // Draw info panel
    drawInfoPanel();
  }

  function drawInfoPanel(): void {
    const panelX = 10;
    const panelY = 10;
    const panelW = 250;
    const panelH = 120;
    
    // Panel background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#cbd5e0";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    // Info text
    ctx.fillStyle = "#2d3748";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "left";
    
    const graphTypes = ["Random", "Grid", "Circular"];
    ctx.fillText(`Graph Type: ${graphTypes[graphType]}`, panelX + 10, panelY + 20);
    ctx.fillText(`Nodes: ${numNodes}`, panelX + 10, panelY + 40);
    ctx.fillText(`Current: ${currentNode}`, panelX + 10, panelY + 60);
    ctx.fillText(`Target: ${targetNode}`, panelX + 10, panelY + 80);
    
    if (pathFound && shortestPath.length > 0) {
      ctx.fillText(`Path: ${nodes[targetNode].distance}`, panelX + 10, panelY + 100);
    } else {
      ctx.fillText(`Unvisited: ${unvisited.size}`, panelX + 10, panelY + 100);
    }
    
    // Legend
    const legendX = panelX + 130;
    const legendItems = [
      { color: COLORS.current, label: "Current" },
      { color: COLORS.target, label: "Target" },
      { color: COLORS.visited, label: "Visited" },
      { color: COLORS.path, label: "Path" }
    ];
    
    ctx.font = "11px sans-serif";
    for (let i = 0; i < legendItems.length; i++) {
      const y = panelY + 20 + i * 20;
      
      ctx.fillStyle = legendItems[i].color;
      ctx.beginPath();
      ctx.arc(legendX, y - 3, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = "#2d3748";
      ctx.fillText(legendItems[i].label, legendX + 12, y);
    }
  }

  function getStateDescription(): string {
    const graphTypes = ["random", "grid", "circular"];
    return `Dijkstra's Algorithm: Finding shortest path in a ${graphTypes[graphType]} graph with ${numNodes} nodes. ` +
           `${pathFound ? `Path found! Distance: ${nodes[targetNode].distance}` : isRunning ? `Processing node ${currentNode}, ${unvisited.size} unvisited` : 'Ready to start'}`;
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

export default DijkstraAlgorithmFactory;