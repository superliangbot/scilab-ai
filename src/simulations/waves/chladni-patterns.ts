import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const ChladniPatterns: SimulationFactory = () => {
  const config = getSimConfig("chladni-patterns")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let frequency = 1000; // Hz
  let plateSize = 300;
  let dampening = 0.98;
  let time = 0;
  let modeM = 2; // m,n mode numbers for standing wave patterns
  let modeN = 1;

  // Plate simulation
  let plateGrid: number[][] = [];
  let sandParticles: { x: number; y: number; vx: number; vy: number }[] = [];
  const gridSize = 50;

  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const PLATE_COLOR = "#1e293b";
  const VIBRATION_COLOR = "#3b82f6";
  const SAND_COLOR = "#fbbf24";
  const NODE_COLOR = "#ef4444";
  const TEXT_COLOR = "#e2e8f0";

  function initializePlate() {
    plateGrid = [];
    sandParticles = [];
    
    // Initialize 2D array for plate vibration
    for (let i = 0; i < gridSize; i++) {
      plateGrid[i] = [];
      for (let j = 0; j < gridSize; j++) {
        plateGrid[i][j] = 0;
      }
    }
    
    // Initialize sand particles randomly distributed
    const numParticles = 200;
    for (let i = 0; i < numParticles; i++) {
      sandParticles.push({
        x: Math.random() * plateSize,
        y: Math.random() * plateSize,
        vx: 0,
        vy: 0
      });
    }
  }

  function updatePlateVibration() {
    const centerX = width / 2;
    const centerY = height / 2;
    const plateLeft = centerX - plateSize / 2;
    const plateTop = centerY - plateSize / 2;
    
    // Calculate standing wave pattern based on modes
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = i / (gridSize - 1); // 0 to 1
        const y = j / (gridSize - 1); // 0 to 1
        
        // Chladni plate modes: sin(mπx) * sin(nπy) or cos(mπx) * cos(nπy)
        const spatialPattern = Math.sin(modeM * Math.PI * x) * Math.sin(modeN * Math.PI * y);
        const temporalOscillation = Math.cos(2 * Math.PI * frequency * time / 1000);
        
        plateGrid[i][j] = spatialPattern * temporalOscillation * 0.3;
      }
    }
  }

  function updateSandParticles() {
    const centerX = width / 2;
    const centerY = height / 2;
    const plateLeft = centerX - plateSize / 2;
    const plateTop = centerY - plateSize / 2;
    
    sandParticles.forEach(particle => {
      // Convert particle position to grid coordinates
      const gridX = Math.floor((particle.x / plateSize) * (gridSize - 1));
      const gridY = Math.floor((particle.y / plateSize) * (gridSize - 1));
      
      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
        const vibration = plateGrid[gridX][gridY];
        const vibrationForce = Math.abs(vibration) * 50;
        
        // Sand particles accumulate at nodes (low vibration areas)
        if (Math.abs(vibration) < 0.05) {
          // This is a nodal line - particles tend to stay here
          particle.vx *= 0.9;
          particle.vy *= 0.9;
        } else {
          // High vibration - push particles away
          const angle = Math.random() * Math.PI * 2;
          particle.vx += Math.cos(angle) * vibrationForce * 0.1;
          particle.vy += Math.sin(angle) * vibrationForce * 0.1;
        }
        
        // Apply damping
        particle.vx *= dampening;
        particle.vy *= dampening;
        
        // Update positions
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Keep particles within the plate
        particle.x = Math.max(0, Math.min(plateSize, particle.x));
        particle.y = Math.max(0, Math.min(plateSize, particle.y));
      }
    });
  }

  function drawPlate() {
    const centerX = width / 2;
    const centerY = height / 2;
    const plateLeft = centerX - plateSize / 2;
    const plateTop = centerY - plateSize / 2;
    
    // Draw plate base
    ctx.fillStyle = PLATE_COLOR;
    ctx.fillRect(plateLeft, plateTop, plateSize, plateSize);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(plateLeft, plateTop, plateSize, plateSize);
    
    // Draw vibration visualization
    const cellSize = plateSize / gridSize;
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const vibration = plateGrid[i][j];
        const intensity = Math.abs(vibration);
        
        if (intensity > 0.01) {
          const alpha = Math.min(intensity * 2, 1);
          const color = vibration > 0 ? 
            `rgba(59, 130, 246, ${alpha})` : 
            `rgba(239, 68, 68, ${alpha})`;
          
          ctx.fillStyle = color;
          ctx.fillRect(
            plateLeft + i * cellSize,
            plateTop + j * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }
    
    // Draw nodal lines more prominently
    ctx.strokeStyle = NODE_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    
    for (let i = 0; i < gridSize - 1; i++) {
      for (let j = 0; j < gridSize - 1; j++) {
        const vibration = plateGrid[i][j];
        if (Math.abs(vibration) < 0.02) {
          ctx.strokeRect(
            plateLeft + i * cellSize,
            plateTop + j * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSandParticles() {
    const centerX = width / 2;
    const centerY = height / 2;
    const plateLeft = centerX - plateSize / 2;
    const plateTop = centerY - plateSize / 2;
    
    ctx.fillStyle = SAND_COLOR;
    sandParticles.forEach(particle => {
      const screenX = plateLeft + particle.x;
      const screenY = plateTop + particle.y;
      
      ctx.beginPath();
      ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawVibrationSource() {
    const sourceX = width / 2 + plateSize / 2 + 30;
    const sourceY = height / 2;
    
    // Draw vibration source (bow or speaker)
    ctx.fillStyle = "#64748b";
    ctx.fillRect(sourceX, sourceY - 20, 40, 40);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.strokeRect(sourceX, sourceY - 20, 40, 40);
    
    // Vibration indicator
    const vibrationOffset = 5 * Math.sin(2 * Math.PI * frequency * time / 1000);
    ctx.strokeStyle = VIBRATION_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY + vibrationOffset);
    ctx.lineTo(sourceX - 15, sourceY + vibrationOffset);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Bow/Speaker", sourceX + 20, sourceY + 50);
  }

  function drawModePattern() {
    const patternX = 30;
    const patternY = height - 180;
    const patternSize = 100;
    
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(patternX, patternY, patternSize, patternSize);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(patternX, patternY, patternSize, patternSize);
    
    // Draw theoretical nodal pattern
    const resolution = 20;
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = i / (resolution - 1);
        const y = j / (resolution - 1);
        
        const pattern = Math.sin(modeM * Math.PI * x) * Math.sin(modeN * Math.PI * y);
        
        if (Math.abs(pattern) < 0.1) {
          ctx.fillStyle = NODE_COLOR;
          ctx.fillRect(
            patternX + (i / resolution) * patternSize,
            patternY + (j / resolution) * patternSize,
            patternSize / resolution,
            patternSize / resolution
          );
        }
      }
    }
    
    // Label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Mode (${modeM},${modeN})`, patternX + patternSize/2, patternY - 10);
  }

  function drawInfoPanel() {
    const panelX = width - 280;
    const panelY = 20;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(panelX, panelY, 260, 200);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(panelX, panelY, 260, 200);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Chladni Patterns", panelX + 10, panelY + 20);
    
    ctx.font = "11px monospace";
    ctx.fillText("Standing waves on a 2D plate", panelX + 10, panelY + 45);
    ctx.fillText("create nodal lines where sand", panelX + 10, panelY + 60);
    ctx.fillText("particles accumulate.", panelX + 10, panelY + 75);
    
    ctx.fillText(`Frequency: ${frequency} Hz`, panelX + 10, panelY + 100);
    ctx.fillText(`Mode: (${modeM}, ${modeN})`, panelX + 10, panelY + 115);
    
    ctx.fillText("Discovered by Ernst Chladni", panelX + 10, panelY + 140);
    ctx.fillText("(1756-1827)", panelX + 10, panelY + 155);
    
    ctx.fillStyle = NODE_COLOR;
    ctx.fillText("Red areas: Nodal lines", panelX + 10, panelY + 175);
    ctx.fillStyle = VIBRATION_COLOR;
    ctx.fillText("Blue areas: Antinodes", panelX + 10, panelY + 190);
  }

  function drawFrequencySpectrum() {
    const specX = 30;
    const specY = height - 350;
    const specW = 150;
    const specH = 100;
    
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(specX, specY, specW, specH);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(specX, specY, specW, specH);
    
    // Draw frequency response peaks
    const numModes = 6;
    for (let i = 1; i <= numModes; i++) {
      const modeFreq = i * 200 + 300; // Simplified frequency calculation
      const amplitude = 1 / i; // Higher modes have lower amplitude
      
      const x = specX + (modeFreq / 2000) * specW;
      const barHeight = amplitude * specH * 0.8;
      const y = specY + specH - barHeight;
      
      ctx.fillStyle = i === Math.floor(frequency / 200) ? VIBRATION_COLOR : "#64748b";
      ctx.fillRect(x - 3, y, 6, barHeight);
    }
    
    // Current frequency indicator
    const currentX = specX + (frequency / 2000) * specW;
    ctx.strokeStyle = SAND_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, specY);
    ctx.lineTo(currentX, specY + specH);
    ctx.stroke();
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Resonant Modes", specX + specW/2, specY - 5);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initializePlate();
    },

    update(dt: number, params: Record<string, number>) {
      frequency = params.frequency ?? frequency;
      modeM = Math.round(params.modeM ?? modeM);
      modeN = Math.round(params.modeN ?? modeN);
      dampening = params.dampening ?? dampening;

      time += dt;
      updatePlateVibration();
      updateSandParticles();
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawPlate();
      drawSandParticles();
      drawVibrationSource();
      drawModePattern();
      drawInfoPanel();
      drawFrequencySpectrum();
    },

    reset() {
      time = 0;
      initializePlate();
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      return `Chladni patterns show standing wave modes (${modeM},${modeN}) on a vibrating plate at ${frequency} Hz. Sand particles collect at nodal lines where vibration amplitude is minimal, revealing the wave pattern geometry.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default ChladniPatterns;