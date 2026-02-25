import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const RippleTank: SimulationFactory = () => {
  const config = getSimConfig("ripple-tank")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let waveSpeed = 100;
  let wavelength = 50;
  let amplitude = 20;
  let time = 0;
  let showReflection = true;
  let showRefraction = true;

  // Water simulation
  const tankWidth = 600;
  const tankHeight = 400;
  let waterGrid: number[][] = [];
  let prevGrid: number[][] = [];
  const gridSize = 100;

  // Wave sources
  let sources: { x: number; y: number; active: boolean; phase: number }[] = [];
  
  // Barriers and obstacles
  let barriers: { x: number; y: number; width: number; height: number }[] = [];
  let shallowRegions: { x: number; y: number; width: number; height: number; depth: number }[] = [];

  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const WATER_DEEP = "#1e3a8a";
  const WATER_SHALLOW = "#3b82f6";
  const WAVE_COLOR = "#06b6d4";
  const BARRIER_COLOR = "#374151";
  const SOURCE_COLOR = "#ef4444";
  const TEXT_COLOR = "#e2e8f0";

  function initializeWater() {
    waterGrid = [];
    prevGrid = [];
    
    for (let i = 0; i < gridSize; i++) {
      waterGrid[i] = [];
      prevGrid[i] = [];
      for (let j = 0; j < gridSize; j++) {
        waterGrid[i][j] = 0;
        prevGrid[i][j] = 0;
      }
    }
    
    // Initialize wave sources
    sources = [
      { x: 0.2, y: 0.3, active: true, phase: 0 },
      { x: 0.2, y: 0.7, active: true, phase: 0 }
    ];
    
    // Initialize barriers (for reflection)
    barriers = [
      { x: 0.7, y: 0.2, width: 0.05, height: 0.6 }
    ];
    
    // Initialize shallow regions (for refraction)
    shallowRegions = [
      { x: 0.4, y: 0.1, width: 0.2, height: 0.8, depth: 0.5 }
    ];
  }

  function updateWaveEquation(dt: number) {
    const newGrid: number[][] = [];
    const c = waveSpeed / 100; // Wave speed factor
    const dtFactor = (c * dt) ** 2;
    
    for (let i = 0; i < gridSize; i++) {
      newGrid[i] = [];
      for (let j = 0; j < gridSize; j++) {
        newGrid[i][j] = 0;
      }
    }
    
    // Apply wave equation: ∂²u/∂t² = c²∇²u
    for (let i = 1; i < gridSize - 1; i++) {
      for (let j = 1; j < gridSize - 1; j++) {
        const laplacian = 
          waterGrid[i-1][j] + waterGrid[i+1][j] + 
          waterGrid[i][j-1] + waterGrid[i][j+1] - 
          4 * waterGrid[i][j];
        
        // Check if we're in a shallow region (different wave speed)
        let localC = c;
        const x = i / gridSize;
        const y = j / gridSize;
        
        for (const region of shallowRegions) {
          if (x >= region.x && x <= region.x + region.width &&
              y >= region.y && y <= region.y + region.height) {
            localC = c * Math.sqrt(region.depth); // Shallow water wave speed
            break;
          }
        }
        
        const localDtFactor = (localC * dt) ** 2;
        newGrid[i][j] = 2 * waterGrid[i][j] - prevGrid[i][j] + localDtFactor * laplacian;
        
        // Apply damping
        newGrid[i][j] *= 0.999;
      }
    }
    
    // Apply boundary conditions (reflection from barriers)
    if (showReflection) {
      for (const barrier of barriers) {
        const startI = Math.floor(barrier.x * gridSize);
        const endI = Math.floor((barrier.x + barrier.width) * gridSize);
        const startJ = Math.floor(barrier.y * gridSize);
        const endJ = Math.floor((barrier.y + barrier.height) * gridSize);
        
        for (let i = startI; i <= endI && i < gridSize; i++) {
          for (let j = startJ; j <= endJ && j < gridSize; j++) {
            newGrid[i][j] = 0; // Hard boundary
          }
        }
      }
    }
    
    // Add sources
    sources.forEach(source => {
      if (source.active) {
        const sourceI = Math.floor(source.x * gridSize);
        const sourceJ = Math.floor(source.y * gridSize);
        
        if (sourceI >= 0 && sourceI < gridSize && sourceJ >= 0 && sourceJ < gridSize) {
          const freq = waveSpeed / wavelength;
          newGrid[sourceI][sourceJ] += amplitude * Math.sin(2 * Math.PI * freq * time + source.phase);
        }
      }
    });
    
    // Update grids
    prevGrid = waterGrid.map(row => [...row]);
    waterGrid = newGrid;
  }

  function drawWaterTank() {
    const tankX = (width - tankWidth) / 2;
    const tankY = (height - tankHeight) / 2;
    
    // Tank walls
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.strokeRect(tankX, tankY, tankWidth, tankHeight);
    
    // Draw shallow regions first
    shallowRegions.forEach(region => {
      const x = tankX + region.x * tankWidth;
      const y = tankY + region.y * tankHeight;
      const w = region.width * tankWidth;
      const h = region.height * tankHeight;
      
      ctx.fillStyle = WATER_SHALLOW;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      
      ctx.strokeStyle = "#60a5fa";
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    });
    
    // Draw water waves
    const cellWidth = tankWidth / gridSize;
    const cellHeight = tankHeight / gridSize;
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const waveHeight = waterGrid[i][j];
        const intensity = Math.abs(waveHeight) / amplitude;
        
        if (intensity > 0.05) {
          const x = tankX + i * cellWidth;
          const y = tankY + j * cellHeight;
          
          const alpha = Math.min(intensity, 1);
          const color = waveHeight > 0 ? 
            `rgba(6, 182, 212, ${alpha * 0.7})` : 
            `rgba(59, 130, 246, ${alpha * 0.7})`;
          
          ctx.fillStyle = color;
          ctx.fillRect(x, y, cellWidth, cellHeight);
        }
      }
    }
    
    // Draw barriers
    barriers.forEach(barrier => {
      const x = tankX + barrier.x * tankWidth;
      const y = tankY + barrier.y * tankHeight;
      const w = barrier.width * tankWidth;
      const h = barrier.height * tankHeight;
      
      ctx.fillStyle = BARRIER_COLOR;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    });
    
    // Draw wave sources
    sources.forEach(source => {
      if (source.active) {
        const x = tankX + source.x * tankWidth;
        const y = tankY + source.y * tankHeight;
        
        ctx.fillStyle = SOURCE_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Pulsing ring
        const pulseRadius = 15 + 10 * Math.sin(2 * Math.PI * (waveSpeed / wavelength) * time);
        ctx.strokeStyle = SOURCE_COLOR;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }

  function drawWaveRays() {
    // Draw wave ray paths to show refraction
    if (!showRefraction) return;
    
    const tankX = (width - tankWidth) / 2;
    const tankY = (height - tankHeight) / 2;
    
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([3, 3]);
    
    // Draw a few representative ray paths
    sources.forEach((source, index) => {
      const startX = tankX + source.x * tankWidth;
      const startY = tankY + source.y * tankHeight;
      
      // Draw ray going through shallow region
      const shallowRegion = shallowRegions[0];
      if (shallowRegion) {
        const boundaryX = tankX + shallowRegion.x * tankWidth;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        // Before shallow region (normal angle)
        const angle1 = Math.PI / 6; // 30 degrees
        ctx.lineTo(boundaryX, startY + (boundaryX - startX) * Math.tan(angle1));
        
        // In shallow region (refracted angle)
        const n1 = 1; // Deep water
        const n2 = Math.sqrt(shallowRegion.depth); // Shallow water
        const angle2 = Math.asin((n1 / n2) * Math.sin(angle1));
        
        const boundaryRightX = tankX + (shallowRegion.x + shallowRegion.width) * tankWidth;
        const midY = startY + (boundaryX - startX) * Math.tan(angle1);
        ctx.lineTo(boundaryRightX, midY + (boundaryRightX - boundaryX) * Math.tan(angle2));
        
        ctx.stroke();
      }
    });
    
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawControls() {
    const controlX = 20;
    const controlY = 20;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(controlX, controlY, 180, 100);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(controlX, controlY, 180, 100);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Ripple Tank", controlX + 10, controlY + 20);
    
    ctx.font = "10px monospace";
    ctx.fillText(`Speed: ${waveSpeed}px/s`, controlX + 10, controlY + 40);
    ctx.fillText(`λ: ${wavelength}px`, controlX + 10, controlY + 55);
    ctx.fillText(`f: ${(waveSpeed/wavelength).toFixed(1)}Hz`, controlX + 10, controlY + 70);
    
    ctx.fillStyle = showReflection ? "#10b981" : "#6b7280";
    ctx.fillText("Reflection", controlX + 10, controlY + 85);
  }

  function drawLegend() {
    const legendX = width - 200;
    const legendY = height - 150;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(legendX, legendY, 180, 130);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(legendX, legendY, 180, 130);
    
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    
    // Wave sources
    ctx.fillStyle = SOURCE_COLOR;
    ctx.beginPath();
    ctx.arc(legendX + 15, legendY + 20, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("Wave Sources", legendX + 25, legendY + 25);
    
    // Barriers
    ctx.fillStyle = BARRIER_COLOR;
    ctx.fillRect(legendX + 10, legendY + 35, 10, 10);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Barriers", legendX + 25, legendY + 44);
    
    // Shallow regions
    ctx.fillStyle = WATER_SHALLOW;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(legendX + 10, legendY + 55, 10, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Shallow Water", legendX + 25, legendY + 64);
    
    // Wave crests/troughs
    ctx.fillStyle = WAVE_COLOR;
    ctx.fillRect(legendX + 10, legendY + 75, 10, 5);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(legendX + 10, legendY + 80, 10, 5);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Crests/Troughs", legendX + 25, legendY + 84);
    
    // Effects shown
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Effects:", legendX + 10, legendY + 100);
    ctx.fillText("• Interference", legendX + 10, legendY + 115);
  }

  function drawInterferencePattern() {
    // Show interference maxima and minima lines
    if (sources.length >= 2) {
      const tankX = (width - tankWidth) / 2;
      const tankY = (height - tankHeight) / 2;
      
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      
      // Calculate interference pattern
      const s1 = sources[0];
      const s2 = sources[1];
      
      if (s1.active && s2.active) {
        const separation = Math.sqrt((s2.x - s1.x) ** 2 + (s2.y - s1.y) ** 2) * tankWidth;
        
        // Draw a few hyperbolic interference lines
        for (let n = -3; n <= 3; n++) {
          if (n === 0) continue;
          
          ctx.beginPath();
          let started = false;
          
          for (let t = 0; t < Math.PI * 2; t += 0.1) {
            const pathDiff = n * wavelength;
            // Simplified hyperbola drawing
            const r = Math.abs(pathDiff) / 2;
            const x = tankX + (0.5 + r * Math.cos(t) / tankWidth) * tankWidth;
            const y = tankY + (0.5 + r * Math.sin(t) / tankWidth) * tankHeight;
            
            if (x >= tankX && x <= tankX + tankWidth && y >= tankY && y <= tankY + tankHeight) {
              if (!started) {
                ctx.moveTo(x, y);
                started = true;
              } else {
                ctx.lineTo(x, y);
              }
            }
          }
          ctx.stroke();
        }
      }
      
      ctx.globalAlpha = 1;
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initializeWater();
    },

    update(dt: number, params: Record<string, number>) {
      waveSpeed = params.waveSpeed ?? waveSpeed;
      wavelength = params.wavelength ?? wavelength;
      amplitude = params.amplitude ?? amplitude;
      showReflection = (params.showReflection ?? 1) > 0.5;
      showRefraction = (params.showRefraction ?? 1) > 0.5;

      time += dt;
      updateWaveEquation(dt);
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawWaterTank();
      drawWaveRays();
      drawInterferencePattern();
      drawControls();
      drawLegend();
    },

    reset() {
      time = 0;
      initializeWater();
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      return `Ripple tank simulation showing wave propagation, interference, reflection, and refraction. Two sources create interference patterns while barriers and shallow regions demonstrate wave behavior changes.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default RippleTank;