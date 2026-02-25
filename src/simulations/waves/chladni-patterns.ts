import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const ChladniPatterns: SimulationFactory = () => {
  const config = getSimConfig("chladni-patterns")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let frequency = 500; // Hz
  let plateSize = 0.3; // meters
  let plateThickness = 0.001; // meters
  let dampingFactor = 0.05;
  let time = 0;
  let plateShape = 0; // 0=square, 1=circle, 2=rectangle
  let excitationX = 0.8; // normalized position 0-1
  let excitationY = 0.8; // normalized position 0-1

  // Simulation grid
  const gridRes = 100;
  let displacement: Float32Array = new Float32Array(gridRes * gridRes);
  let velocity: Float32Array = new Float32Array(gridRes * gridRes);
  let nodeSand: Float32Array = new Float32Array(gridRes * gridRes);
  
  // Wave properties
  const waveSpeed = 1000; // m/s in the plate
  let wavelength = 0;
  let nodePattern: number[][] = [];

  // Particle animation
  let particles: { x: number; y: number; vx: number; vy: number; onNode: boolean }[] = [];
  const numParticles = 800;

  // Colors
  const BG = "#0f172a";
  const PLATE_COLOR = "#1e293b";
  const NODE_COLOR = "#f59e0b";
  const ANTINODE_COLOR = "#ef4444";
  const SAND_COLOR = "#92400e";
  const EXCITATION_COLOR = "#10b981";
  const VIBRATION_POS = "#3b82f6";
  const VIBRATION_NEG = "#dc2626";
  const GRID_COLOR = "rgba(148, 163, 184, 0.1)";
  const TEXT_COLOR = "#e2e8f0";

  function computePhysics(dt: number, params: Record<string, number>) {
    frequency = Math.max(20, Math.min(5000, params.frequency ?? frequency));
    plateSize = params.plateSize ?? plateSize;
    dampingFactor = params.dampingFactor ?? dampingFactor;
    plateShape = Math.floor(params.plateShape ?? plateShape);
    excitationX = Math.max(0, Math.min(1, params.excitationX ?? excitationX));
    excitationY = Math.max(0, Math.min(1, params.excitationY ?? excitationY));

    time += dt;
    wavelength = waveSpeed / frequency;

    // Update wave equation on the plate
    updateWaveEquation(dt);
    
    // Update particle positions
    updateParticles(dt);
    
    // Calculate node pattern for visualization
    calculateNodePattern();
  }

  function updateWaveEquation(dt: number) {
    const dx = plateSize / gridRes;
    const c = waveSpeed;
    const omega = 2 * Math.PI * frequency;
    
    // Apply excitation at specified point
    const exciteI = Math.floor(excitationX * gridRes);
    const exciteJ = Math.floor(excitationY * gridRes);
    const exciteIdx = exciteJ * gridRes + exciteI;
    
    // Add driving force at excitation point
    if (isValidPoint(exciteI, exciteJ)) {
      velocity[exciteIdx] += 0.5 * Math.sin(omega * time) * dt;
    }

    // Update wave equation: ∂²u/∂t² = c²∇²u - 2γ∂u/∂t
    for (let j = 1; j < gridRes - 1; j++) {
      for (let i = 1; i < gridRes - 1; i++) {
        const idx = j * gridRes + i;
        
        if (!isValidPoint(i, j)) continue;
        
        // Laplacian (finite difference)
        const laplacian = (displacement[(j) * gridRes + (i-1)] + 
                          displacement[(j) * gridRes + (i+1)] + 
                          displacement[(j-1) * gridRes + (i)] + 
                          displacement[(j+1) * gridRes + (i)] - 
                          4 * displacement[idx]) / (dx * dx);
        
        // Wave equation with damping
        const acceleration = c * c * laplacian - 2 * dampingFactor * velocity[idx];
        
        velocity[idx] += acceleration * dt;
        displacement[idx] += velocity[idx] * dt;
      }
    }

    // Apply boundary conditions (fixed edges)
    applyBoundaryConditions();
  }

  function isValidPoint(i: number, j: number): boolean {
    const centerX = gridRes / 2;
    const centerY = gridRes / 2;
    const x = i - centerX;
    const y = j - centerY;
    const radius = gridRes / 2 - 1;

    switch (plateShape) {
      case 0: // Square
        return i >= 1 && i < gridRes - 1 && j >= 1 && j < gridRes - 1;
      
      case 1: // Circle
        return (x * x + y * y) <= radius * radius && i >= 1 && i < gridRes - 1 && j >= 1 && j < gridRes - 1;
      
      case 2: // Rectangle
        const rectW = gridRes * 0.8;
        const rectH = gridRes * 0.6;
        return Math.abs(x) <= rectW / 2 && Math.abs(y) <= rectH / 2 && i >= 1 && i < gridRes - 1 && j >= 1 && j < gridRes - 1;
      
      default:
        return true;
    }
  }

  function applyBoundaryConditions() {
    // Fix displacement at boundaries to zero
    for (let i = 0; i < gridRes; i++) {
      displacement[0 * gridRes + i] = 0; // Top
      displacement[(gridRes-1) * gridRes + i] = 0; // Bottom
      displacement[i * gridRes + 0] = 0; // Left
      displacement[i * gridRes + (gridRes-1)] = 0; // Right
      
      velocity[0 * gridRes + i] = 0;
      velocity[(gridRes-1) * gridRes + i] = 0;
      velocity[i * gridRes + 0] = 0;
      velocity[i * gridRes + (gridRes-1)] = 0;
    }

    // For circular plate, fix points outside the circle
    if (plateShape === 1) {
      const centerX = gridRes / 2;
      const centerY = gridRes / 2;
      const radius = gridRes / 2 - 1;

      for (let j = 0; j < gridRes; j++) {
        for (let i = 0; i < gridRes; i++) {
          const x = i - centerX;
          const y = j - centerY;
          if (x * x + y * y > radius * radius) {
            displacement[j * gridRes + i] = 0;
            velocity[j * gridRes + i] = 0;
          }
        }
      }
    }
  }

  function calculateNodePattern() {
    // Calculate time-averaged displacement to find nodes and antinodes
    const threshold = 0.001;
    
    for (let j = 0; j < gridRes; j++) {
      for (let i = 0; i < gridRes; i++) {
        const idx = j * gridRes + i;
        if (!isValidPoint(i, j)) {
          nodeSand[idx] = 0;
          continue;
        }
        
        // Check if this point is a node (low vibration amplitude)
        const currentAmplitude = Math.abs(displacement[idx]);
        
        // Accumulate sand at nodes over time
        if (currentAmplitude < threshold) {
          nodeSand[idx] = Math.min(1, nodeSand[idx] + 0.01);
        } else {
          // Sand is scattered away from antinodes
          nodeSand[idx] *= 0.995;
        }
      }
    }
  }

  function updateParticles(dt: number) {
    // Initialize particles if empty
    if (particles.length === 0) {
      initializeParticles();
    }

    for (const particle of particles) {
      // Get local displacement and velocity
      const i = Math.floor(particle.x * gridRes);
      const j = Math.floor(particle.y * gridRes);
      
      if (i >= 0 && i < gridRes && j >= 0 && j < gridRes && isValidPoint(i, j)) {
        const idx = j * gridRes + i;
        const localVel = velocity[idx];
        const localDisp = displacement[idx];
        
        // Particles move toward nodes (low vibration areas)
        const isNode = Math.abs(localDisp) < 0.005 && Math.abs(localVel) < 0.1;
        
        if (isNode) {
          // Stick to nodes
          particle.vx *= 0.9;
          particle.vy *= 0.9;
          particle.onNode = true;
        } else {
          // Get pushed away from antinodes
          const pushStrength = Math.abs(localDisp) * 100;
          const pushAngle = Math.random() * 2 * Math.PI;
          particle.vx += pushStrength * Math.cos(pushAngle) * dt;
          particle.vy += pushStrength * Math.sin(pushAngle) * dt;
          particle.onNode = false;
        }
      }

      // Update position
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;

      // Keep within bounds
      if (particle.x < 0 || particle.x > 1 || particle.y < 0 || particle.y > 1) {
        particle.x = Math.max(0, Math.min(1, particle.x));
        particle.y = Math.max(0, Math.min(1, particle.y));
        particle.vx = 0;
        particle.vy = 0;
      }

      // Check plate shape bounds
      if (!isValidNormalizedPoint(particle.x, particle.y)) {
        // Reflect or reset particle
        particle.x = Math.random();
        particle.y = Math.random();
        particle.vx = 0;
        particle.vy = 0;
      }
    }
  }

  function isValidNormalizedPoint(x: number, y: number): boolean {
    const centerX = 0.5;
    const centerY = 0.5;
    const dx = x - centerX;
    const dy = y - centerY;

    switch (plateShape) {
      case 0: // Square
        return x >= 0 && x <= 1 && y >= 0 && y <= 1;
      
      case 1: // Circle
        return (dx * dx + dy * dy) <= 0.25;
      
      case 2: // Rectangle
        return Math.abs(dx) <= 0.4 && Math.abs(dy) <= 0.3;
      
      default:
        return true;
    }
  }

  function initializeParticles() {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
      let x, y;
      do {
        x = Math.random();
        y = Math.random();
      } while (!isValidNormalizedPoint(x, y));
      
      particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        onNode: false
      });
    }
  }

  function drawPlate() {
    const plateX = width * 0.1;
    const plateY = height * 0.1;
    const plateW = width * 0.6;
    const plateH = height * 0.6;

    // Draw plate background
    ctx.fillStyle = PLATE_COLOR;
    
    switch (plateShape) {
      case 0: // Square
        ctx.fillRect(plateX, plateY, plateW, plateH);
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 2;
        ctx.strokeRect(plateX, plateY, plateW, plateH);
        break;
      
      case 1: // Circle
        const centerX = plateX + plateW / 2;
        const centerY = plateY + plateH / 2;
        const radius = Math.min(plateW, plateH) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      
      case 2: // Rectangle
        const rectW = plateW * 0.8;
        const rectH = plateH * 0.6;
        const rectX = plateX + (plateW - rectW) / 2;
        const rectY = plateY + (plateH - rectH) / 2;
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.strokeStyle = "#374151";
        ctx.lineWidth = 2;
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        break;
    }
  }

  function drawVibrationField() {
    const plateX = width * 0.1;
    const plateY = height * 0.1;
    const plateW = width * 0.6;
    const plateH = height * 0.6;

    // Draw displacement field as colored regions
    const imageData = ctx.createImageData(plateW, plateH);
    const data = imageData.data;

    for (let j = 0; j < plateH; j++) {
      for (let i = 0; i < plateW; i++) {
        const gridI = Math.floor((i / plateW) * gridRes);
        const gridJ = Math.floor((j / plateH) * gridRes);
        
        if (gridI >= 0 && gridI < gridRes && gridJ >= 0 && gridJ < gridRes && 
            isValidPoint(gridI, gridJ)) {
          
          const idx = gridJ * gridRes + gridI;
          const disp = displacement[idx];
          const maxDisp = 0.01;
          const normalized = Math.max(-1, Math.min(1, disp / maxDisp));
          
          const pixelIdx = (j * plateW + i) * 4;
          
          if (normalized > 0) {
            // Positive displacement - blue
            data[pixelIdx] = Math.floor(30 + normalized * 100);     // R
            data[pixelIdx + 1] = Math.floor(64 + normalized * 100); // G
            data[pixelIdx + 2] = Math.floor(175 + normalized * 80); // B
          } else {
            // Negative displacement - red
            data[pixelIdx] = Math.floor(220 - normalized * 80);     // R
            data[pixelIdx + 1] = Math.floor(38 - normalized * 38);  // G
            data[pixelIdx + 2] = Math.floor(38 - normalized * 38);  // B
          }
          data[pixelIdx + 3] = Math.floor(100 + Math.abs(normalized) * 155); // Alpha
        } else {
          // Outside plate - transparent
          const pixelIdx = (j * plateW + i) * 4;
          data[pixelIdx + 3] = 0;
        }
      }
    }

    ctx.putImageData(imageData, plateX, plateY);
  }

  function drawSandParticles() {
    const plateX = width * 0.1;
    const plateY = height * 0.1;
    const plateW = width * 0.6;
    const plateH = height * 0.6;

    ctx.fillStyle = SAND_COLOR;
    
    for (const particle of particles) {
      const x = plateX + particle.x * plateW;
      const y = plateY + particle.y * plateH;
      
      if (particle.onNode) {
        // Larger particles at nodes
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Smaller moving particles
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawExcitationPoint() {
    const plateX = width * 0.1;
    const plateY = height * 0.1;
    const plateW = width * 0.6;
    const plateH = height * 0.6;

    const exciteX = plateX + excitationX * plateW;
    const exciteY = plateY + excitationY * plateH;

    // Draw excitation point
    ctx.fillStyle = EXCITATION_COLOR;
    ctx.beginPath();
    ctx.arc(exciteX, exciteY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw vibration indication
    const vibrationRadius = 3 + 2 * Math.sin(2 * Math.PI * frequency * time * 0.001);
    ctx.strokeStyle = EXCITATION_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(exciteX, exciteY, Math.abs(vibrationRadius), 0, Math.PI * 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = EXCITATION_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Exciter", exciteX, exciteY - 15);
  }

  function drawInfoPanel() {
    const panelX = width * 0.75;
    const panelY = height * 0.1;
    const panelW = width * 0.23;
    const panelH = height * 0.6;

    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 10;
    let textY = panelY + 20;
    const lineHeight = 16;

    ctx.fillStyle = "#a855f7";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Chladni Patterns", textX, textY);
    textY += lineHeight + 8;

    const shapes = ["Square", "Circle", "Rectangle"];
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText(`Plate: ${shapes[plateShape]}`, textX, textY);
    textY += lineHeight;

    ctx.fillText(`Size: ${(plateSize * 100).toFixed(0)} cm`, textX, textY);
    textY += lineHeight;

    ctx.fillText(`Frequency: ${frequency.toFixed(0)} Hz`, textX, textY);
    textY += lineHeight;

    ctx.fillText(`Wavelength: ${(wavelength * 1000).toFixed(1)} mm`, textX, textY);
    textY += lineHeight + 8;

    ctx.fillText("Excitation Point:", textX, textY);
    textY += lineHeight;
    ctx.fillText(`X: ${(excitationX * 100).toFixed(0)}%`, textX, textY);
    textY += lineHeight;
    ctx.fillText(`Y: ${(excitationY * 100).toFixed(0)}%`, textX, textY);
    textY += lineHeight + 8;

    ctx.fillStyle = SAND_COLOR;
    ctx.fillText("Sand Particles:", textX, textY);
    textY += lineHeight;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("• Collect at nodes", textX, textY);
    textY += 12;
    ctx.fillText("• Scattered from", textX, textY);
    textY += 12;
    ctx.fillText("  antinodes", textX + 2, textY);
    textY += lineHeight + 8;

    // Mode information
    ctx.fillStyle = NODE_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText("Standing Wave Mode", textX, textY);
    textY += lineHeight + 5;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("Nodes: Zero motion", textX, textY);
    textY += 12;
    ctx.fillText("Antinodes: Max motion", textX, textY);
    textY += 12;
    ctx.fillText("Pattern depends on:", textX, textY);
    textY += 12;
    ctx.fillText("• Frequency", textX, textY);
    textY += 12;
    ctx.fillText("• Plate geometry", textX, textY);
    textY += 12;
    ctx.fillText("• Boundary conditions", textX, textY);
  }

  function drawWaveEquation() {
    const eqX = width * 0.1;
    const eqY = height * 0.75;

    ctx.fillStyle = "#a855f7";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("2D Wave Equation:", eqX, eqY);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText("∂²u/∂t² = c²(∂²u/∂x² + ∂²u/∂y²) - 2γ∂u/∂t", eqX, eqY + 20);
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText("where u = displacement, c = wave speed, γ = damping", eqX, eqY + 35);
    ctx.fillText(`Wave speed in plate: c = ${waveSpeed} m/s`, eqX, eqY + 50);
    ctx.fillText(`Damping coefficient: γ = ${dampingFactor.toFixed(3)}`, eqX, eqY + 65);

    // Resonance info
    ctx.fillStyle = "#f59e0b";
    ctx.font = "12px monospace";
    ctx.fillText("Resonant Modes:", eqX + 350, eqY);
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("Different frequencies create", eqX + 350, eqY + 20);
    ctx.fillText("different standing wave patterns.", eqX + 350, eqY + 32);
    ctx.fillText("Sand reveals the node lines", eqX + 350, eqY + 44);
    ctx.fillText("where vibration is minimal.", eqX + 350, eqY + 56);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      displacement.fill(0);
      velocity.fill(0);
      nodeSand.fill(0);
      particles = [];
      initializeParticles();
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawPlate();
      drawVibrationField();
      drawSandParticles();
      drawExcitationPoint();
      drawInfoPanel();
      drawWaveEquation();
    },

    reset() {
      time = 0;
      displacement.fill(0);
      velocity.fill(0);
      nodeSand.fill(0);
      particles = [];
      initializeParticles();
    },

    destroy() {
      // Clean up arrays
      displacement = new Float32Array(0);
      velocity = new Float32Array(0);
      nodeSand = new Float32Array(0);
      particles = [];
    },

    getStateDescription(): string {
      const shapes = ["square", "circular", "rectangular"];
      const particlesOnNodes = particles.filter(p => p.onNode).length;
      
      return (
        `Chladni pattern simulation on ${shapes[plateShape]} plate: ${(plateSize * 100).toFixed(0)} cm size, ` +
        `vibrating at ${frequency.toFixed(0)} Hz (wavelength ${(wavelength * 1000).toFixed(1)} mm). ` +
        `Excitation point at (${(excitationX * 100).toFixed(0)}%, ${(excitationY * 100).toFixed(0)}%). ` +
        `${particlesOnNodes}/${numParticles} sand particles collected at nodes. ` +
        `Standing wave patterns form when the plate resonates, creating nodes (no motion) and antinodes (maximum motion). ` +
        `Sand particles migrate to nodes where vibration is minimal, revealing the wave pattern geometry.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default ChladniPatterns;