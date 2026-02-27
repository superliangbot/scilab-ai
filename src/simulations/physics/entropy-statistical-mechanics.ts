import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Entropy and Statistical Mechanics
 * S = k ln(W) where W is the number of microstates
 * Visualizes particle distribution, mixing, and the tendency toward maximum entropy
 * Shows reversible vs irreversible processes
 */

const EntropyStatisticalMechanicsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("entropy-statistical-mechanics") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // System parameters
  let numParticles = 200;
  let temperature = 300; // Kelvin
  let containerType = 0; // 0=two compartments, 1=single container
  let barrierRemoved = false;

  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: 0 | 1; // Two types of particles
    mass: number;
  }> = [];

  const CONTAINER_WIDTH = 500;
  const CONTAINER_HEIGHT = 300;
  const CONTAINER_X = 100;
  const CONTAINER_Y = 100;

  let entropyHistory: number[] = [];
  let timeHistory: number[] = [];

  function initializeParticles() {
    particles.length = 0;
    barrierRemoved = false;
    entropyHistory.length = 0;
    timeHistory.length = 0;

    const speedScale = Math.sqrt(temperature / 300) * 2;

    for (let i = 0; i < numParticles; i++) {
      const type = i < numParticles / 2 ? 0 : 1;
      const mass = type === 0 ? 1 : 1.2;
      
      let x, y;
      
      if (containerType === 0) {
        // Two compartments initially separated
        if (type === 0) {
          x = CONTAINER_X + Math.random() * (CONTAINER_WIDTH / 2 - 20);
        } else {
          x = CONTAINER_X + CONTAINER_WIDTH / 2 + 20 + Math.random() * (CONTAINER_WIDTH / 2 - 20);
        }
      } else {
        // Single container
        x = CONTAINER_X + 20 + Math.random() * (CONTAINER_WIDTH - 40);
      }
      
      y = CONTAINER_Y + 20 + Math.random() * (CONTAINER_HEIGHT - 40);
      
      // Maxwell-Boltzmann velocity distribution
      const vx = (Math.random() - 0.5) * speedScale * 100;
      const vy = (Math.random() - 0.5) * speedScale * 100;
      
      particles.push({ x, y, vx, vy, type, mass });
    }
  }

  function calculateEntropy(): number {
    // Divide space into grid cells and count particles in each
    const gridSize = 25;
    const cellsX = Math.floor(CONTAINER_WIDTH / gridSize);
    const cellsY = Math.floor(CONTAINER_HEIGHT / gridSize);
    
    const cellCounts = Array(cellsX * cellsY).fill(0);
    
    particles.forEach(p => {
      const cellX = Math.floor((p.x - CONTAINER_X) / gridSize);
      const cellY = Math.floor((p.y - CONTAINER_Y) / gridSize);
      
      if (cellX >= 0 && cellX < cellsX && cellY >= 0 && cellY < cellsY) {
        cellCounts[cellY * cellsX + cellX]++;
      }
    });
    
    // Calculate entropy using Boltzmann's formula approximation
    let entropy = 0;
    const totalParticles = particles.length;
    
    cellCounts.forEach(count => {
      if (count > 0) {
        const probability = count / totalParticles;
        entropy -= probability * Math.log(probability);
      }
    });
    
    return entropy; // Normalized entropy
  }

  function updateParticles(dt: number) {
    const speedScale = Math.sqrt(temperature / 300);
    
    particles.forEach((p, i) => {
      // Apply thermal motion scaling
      p.vx *= (0.99 + 0.02 * speedScale);
      p.vy *= (0.99 + 0.02 * speedScale);
      
      // Update positions
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // Container boundaries
      if (p.x <= CONTAINER_X + 5) {
        p.x = CONTAINER_X + 5;
        p.vx = Math.abs(p.vx) * 0.8;
      }
      if (p.x >= CONTAINER_X + CONTAINER_WIDTH - 5) {
        p.x = CONTAINER_X + CONTAINER_WIDTH - 5;
        p.vx = -Math.abs(p.vx) * 0.8;
      }
      if (p.y <= CONTAINER_Y + 5) {
        p.y = CONTAINER_Y + 5;
        p.vy = Math.abs(p.vy) * 0.8;
      }
      if (p.y >= CONTAINER_Y + CONTAINER_HEIGHT - 5) {
        p.y = CONTAINER_Y + CONTAINER_HEIGHT - 5;
        p.vy = -Math.abs(p.vy) * 0.8;
      }
      
      // Barrier in the middle (if not removed)
      if (!barrierRemoved && containerType === 0) {
        const barrierX = CONTAINER_X + CONTAINER_WIDTH / 2;
        
        if (Math.abs(p.x - barrierX) < 10) {
          if (p.x < barrierX) {
            p.x = barrierX - 10;
            p.vx = -Math.abs(p.vx) * 0.8;
          } else {
            p.x = barrierX + 10;
            p.vx = Math.abs(p.vx) * 0.8;
          }
        }
      }
      
      // Particle collisions
      for (let j = i + 1; j < particles.length; j++) {
        const other = particles[j];
        const dx = p.x - other.x;
        const dy = p.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 8) {
          // Simple elastic collision
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);
          
          // Rotate velocities
          const v1x = p.vx * cos + p.vy * sin;
          const v1y = p.vy * cos - p.vx * sin;
          const v2x = other.vx * cos + other.vy * sin;
          const v2y = other.vy * cos - other.vx * sin;
          
          // Conservation of momentum (1D collision in rotated frame)
          const newV1x = ((p.mass - other.mass) * v1x + 2 * other.mass * v2x) / (p.mass + other.mass);
          const newV2x = ((other.mass - p.mass) * v2x + 2 * p.mass * v1x) / (p.mass + other.mass);
          
          // Rotate back
          p.vx = newV1x * cos - v1y * sin;
          p.vy = v1y * cos + newV1x * sin;
          other.vx = newV2x * cos - v2y * sin;
          other.vy = v2y * cos + newV2x * sin;
          
          // Separate particles
          const overlap = 8 - distance;
          const separationX = dx / distance * overlap * 0.5;
          const separationY = dy / distance * overlap * 0.5;
          
          p.x += separationX;
          p.y += separationY;
          other.x -= separationX;
          other.y -= separationY;
        }
      }
    });
  }

  function drawContainer() {
    // Container walls
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.strokeRect(CONTAINER_X, CONTAINER_Y, CONTAINER_WIDTH, CONTAINER_HEIGHT);
    
    // Barrier (if present)
    if (!barrierRemoved && containerType === 0) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(CONTAINER_X + CONTAINER_WIDTH / 2, CONTAINER_Y);
      ctx.lineTo(CONTAINER_X + CONTAINER_WIDTH / 2, CONTAINER_Y + CONTAINER_HEIGHT);
      ctx.stroke();
    }
    
    // Grid for entropy visualization
    ctx.strokeStyle = "rgba(100, 116, 139, 0.1)";
    ctx.lineWidth = 1;
    const gridSize = 25;
    
    for (let x = CONTAINER_X; x <= CONTAINER_X + CONTAINER_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, CONTAINER_Y);
      ctx.lineTo(x, CONTAINER_Y + CONTAINER_HEIGHT);
      ctx.stroke();
    }
    
    for (let y = CONTAINER_Y; y <= CONTAINER_Y + CONTAINER_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(CONTAINER_X, y);
      ctx.lineTo(CONTAINER_X + CONTAINER_WIDTH, y);
      ctx.stroke();
    }
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.type === 0 ? 3 : 4, 0, Math.PI * 2);
      
      if (p.type === 0) {
        ctx.fillStyle = "#3b82f6"; // Blue particles
      } else {
        ctx.fillStyle = "#ef4444"; // Red particles
      }
      
      ctx.fill();
      
      // Velocity visualization
      if (Math.random() < 0.1) {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.05, p.y + p.vy * 0.05);
        ctx.stroke();
      }
    });
  }

  function drawEntropyGraph() {
    if (entropyHistory.length < 2) return;
    
    const graphX = width - 250;
    const graphY = height - 200;
    const graphWidth = 200;
    const graphHeight = 120;
    
    // Graph background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);
    
    // Plot entropy over time
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const maxEntropy = Math.max(...entropyHistory);
    const minEntropy = Math.min(...entropyHistory);
    const entropyRange = maxEntropy - minEntropy || 1;
    
    entropyHistory.forEach((entropy, i) => {
      const x = graphX + (i / (entropyHistory.length - 1)) * graphWidth;
      const y = graphY + graphHeight - ((entropy - minEntropy) / entropyRange) * graphHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Entropy vs Time", graphX, graphY - 5);
    
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`S = ${entropyHistory[entropyHistory.length - 1]?.toFixed(3) || 0}`, graphX, graphY + graphHeight + 15);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initializeParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newNumParticles = Math.round(params.numParticles ?? 200);
    temperature = params.temperature ?? 300;
    const newContainerType = Math.round(params.containerType ?? 0);
    
    if (newNumParticles !== numParticles || newContainerType !== containerType) {
      numParticles = newNumParticles;
      containerType = newContainerType;
      initializeParticles();
    }

    time += dt;
    
    // Remove barrier after some time for demonstration
    if (containerType === 0 && time > 3 && !barrierRemoved) {
      barrierRemoved = true;
    }

    updateParticles(dt);
    
    // Record entropy periodically
    if (Math.floor(time * 10) % 5 === 0 && timeHistory.length < 1000) {
      const entropy = calculateEntropy();
      entropyHistory.push(entropy);
      timeHistory.push(time);
      
      if (entropyHistory.length > 500) {
        entropyHistory.shift();
        timeHistory.shift();
      }
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawContainer();
    drawParticles();
    drawEntropyGraph();

    const currentEntropy = calculateEntropy();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 300, 200);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Entropy & Statistical Mechanics", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText(`S = k ln(W)`, 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Current Entropy: ${currentEntropy.toFixed(3)}`, 20, 80);
    ctx.fillText(`Temperature: ${temperature} K`, 20, 100);
    ctx.fillText(`Particles: ${numParticles}`, 20, 120);
    
    const systemType = containerType === 0 ? "Two Compartments" : "Single Container";
    ctx.fillText(`System: ${systemType}`, 20, 140);
    
    if (containerType === 0) {
      const barrierStatus = barrierRemoved ? "Removed" : "Present";
      ctx.fillStyle = barrierRemoved ? "#f59e0b" : "#ef4444";
      ctx.fillText(`Barrier: ${barrierStatus}`, 20, 160);
    }
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Blue: Type A particles`, 20, 180);
    ctx.fillText(`Red: Type B particles`, 20, 195);

    // Second law of thermodynamics info
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 280, 10, 270, 120);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Second Law of Thermodynamics:", width - 270, 30);
    ctx.fillText("• Entropy of isolated system increases", width - 270, 50);
    ctx.fillText("• Heat flows from hot to cold", width - 270, 70);
    ctx.fillText("• Processes tend toward equilibrium", width - 270, 90);
    ctx.fillText("• Statistical tendency, not absolute", width - 270, 110);

    // Formula explanation
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("S = k ln(W) where W = number of possible microstates", width / 2, height - 20);
    ctx.fillText("Higher entropy = more disorder = more possible arrangements", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    initializeParticles();
  }

  function destroy(): void {
    particles.length = 0;
    entropyHistory.length = 0;
    timeHistory.length = 0;
  }

  function getStateDescription(): string {
    const currentEntropy = calculateEntropy();
    const systemType = containerType === 0 ? "compartmentalized" : "single container";
    const barrierStatus = barrierRemoved ? "barrier removed" : "barrier present";
    
    return (
      `Entropy System: ${numParticles} particles in ${systemType}, T=${temperature}K. ` +
      `Current entropy S=${currentEntropy.toFixed(3)}. ` +
      `${containerType === 0 ? barrierStatus + ', ' : ''}` +
      `Demonstrates Second Law of Thermodynamics - entropy increases in isolated systems. ` +
      `Particle mixing shows statistical tendency toward maximum entropy state.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
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

export default EntropyStatisticalMechanicsFactory;