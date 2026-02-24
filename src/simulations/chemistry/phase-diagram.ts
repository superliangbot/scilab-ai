import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: "solid" | "liquid" | "gas";
  energy: number;
}

interface PhaseData {
  name: string;
  triplePoint: { T: number; P: number };
  criticalPoint: { T: number; P: number };
  normalBoiling: number; // K
  normalMelting: number; // K
  color: { solid: string; liquid: string; gas: string };
}

const PhaseDiagramFactory: SimulationFactory = () => {
  const config = getSimConfig("phase-diagram") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let temperature = 273; // K
  let pressure = 1; // atm
  let substance = 0;
  let showParticles = 1;
  let animatePhase = 1;

  // Available substances
  const substances: PhaseData[] = [
    {
      name: "Water",
      triplePoint: { T: 273.16, P: 0.006 },
      criticalPoint: { T: 647, P: 221 },
      normalBoiling: 373,
      normalMelting: 273,
      color: { solid: "#7dd3fc", liquid: "#0284c7", gas: "#e0f2fe" },
    },
    {
      name: "Carbon Dioxide",
      triplePoint: { T: 216.6, P: 5.2 },
      criticalPoint: { T: 304, P: 74 },
      normalBoiling: 195, // Sublimes at 1 atm
      normalMelting: 195,
      color: { solid: "#f3f4f6", liquid: "#6b7280", gas: "#f9fafb" },
    },
    {
      name: "Nitrogen",
      triplePoint: { T: 63.2, P: 0.125 },
      criticalPoint: { T: 126, P: 34 },
      normalBoiling: 77,
      normalMelting: 63,
      color: { solid: "#ddd6fe", liquid: "#8b5cf6", gas: "#f5f3ff" },
    },
  ];

  // State
  let currentSubstance: PhaseData;
  let particles: Particle[] = [];
  let currentPhase: "solid" | "liquid" | "gas" = "solid";
  let transitionProgress = 0;

  function initializeSystem() {
    currentSubstance = substances[substance];
    particles = [];
    
    // Create particles
    const numParticles = 80;
    for (let i = 0; i < numParticles; i++) {
      particles.push(createParticle());
    }
    
    updatePhase();
  }

  function createParticle(): Particle {
    const containerX = W * 0.05;
    const containerY = H * 0.3;
    const containerW = W * 0.4;
    const containerH = H * 0.4;
    
    return {
      x: containerX + 20 + Math.random() * (containerW - 40),
      y: containerY + 20 + Math.random() * (containerH - 40),
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      phase: "solid",
      energy: 1 + Math.random() * 0.5,
    };
  }

  function determinePhase(T: number, P: number): "solid" | "liquid" | "gas" {
    const tp = currentSubstance.triplePoint;
    const cp = currentSubstance.criticalPoint;
    
    if (T < tp.T) {
      return "solid";
    } else if (T > cp.T || P < tp.P) {
      return "gas";
    } else {
      // Simplified liquid region
      const vaporPressure = calculateVaporPressure(T);
      return P > vaporPressure ? "liquid" : "gas";
    }
  }

  function calculateVaporPressure(T: number): number {
    // Simplified Clausius-Clapeyron equation
    const A = 8.07; // Substance-specific constant
    const B = 1730.6; // Substance-specific constant
    return Math.pow(10, A - B/T) * 0.1; // Convert to atm
  }

  function updatePhase() {
    const newPhase = determinePhase(temperature, pressure);
    
    if (newPhase !== currentPhase) {
      currentPhase = newPhase;
      transitionProgress = 0;
    }
    
    // Update particle properties based on phase
    const avgEnergy = getAverageEnergy(temperature);
    const targetSpeed = getTargetSpeed(currentPhase, temperature);
    
    for (const particle of particles) {
      particle.phase = currentPhase;
      particle.energy = avgEnergy * (0.8 + Math.random() * 0.4);
      
      // Adjust velocities based on phase
      const currentSpeed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      const speedRatio = targetSpeed / (currentSpeed || 1);
      
      particle.vx *= speedRatio;
      particle.vy *= speedRatio;
    }
  }

  function getAverageEnergy(T: number): number {
    return T / 100; // Simplified
  }

  function getTargetSpeed(phase: string, T: number): number {
    const baseSpeed = Math.sqrt(T / 10);
    
    switch (phase) {
      case "solid": return baseSpeed * 0.3;
      case "liquid": return baseSpeed * 0.7;
      case "gas": return baseSpeed * 1.2;
      default: return baseSpeed;
    }
  }

  function updateParticles(dt: number) {
    const containerX = W * 0.05;
    const containerY = H * 0.3;
    const containerW = W * 0.4;
    const containerH = H * 0.4;
    
    for (const particle of particles) {
      // Update position
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      
      // Phase-specific behavior
      if (particle.phase === "solid") {
        // Oscillate around fixed positions
        particle.vx *= 0.95;
        particle.vy *= 0.95;
        
        // Add small oscillations
        particle.vx += (Math.random() - 0.5) * 5;
        particle.vy += (Math.random() - 0.5) * 5;
        
      } else if (particle.phase === "liquid") {
        // Medium mobility, stick to bottom
        const gravity = 50;
        particle.vy += gravity * dt;
        
        // Viscous damping
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        
      } else if (particle.phase === "gas") {
        // High mobility, fill container
        // No additional forces, just bouncing
      }
      
      // Container boundaries
      if (particle.x <= containerX + 5) {
        particle.x = containerX + 5;
        particle.vx = Math.abs(particle.vx) * 0.8;
      }
      if (particle.x >= containerX + containerW - 5) {
        particle.x = containerX + containerW - 5;
        particle.vx = -Math.abs(particle.vx) * 0.8;
      }
      if (particle.y <= containerY + 5) {
        particle.y = containerY + 5;
        particle.vy = Math.abs(particle.vy) * 0.8;
      }
      if (particle.y >= containerY + containerH - 5) {
        particle.y = containerY + containerH - 5;
        particle.vy = -Math.abs(particle.vy) * 0.8;
      }
      
      // Particle-particle interactions
      for (const other of particles) {
        if (other === particle) continue;
        
        const dx = other.x - particle.x;
        const dy = other.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10 && distance > 0) {
          const force = (10 - distance) * 0.1;
          const fx = -(dx / distance) * force;
          const fy = -(dy / distance) * force;
          
          particle.vx += fx;
          particle.vy += fy;
        }
      }
    }
  }

  function drawPhaseDiagram() {
    const diagramX = W * 0.52;
    const diagramY = H * 0.05;
    const diagramW = W * 0.45;
    const diagramH = H * 0.6;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(diagramX, diagramY, diagramW, diagramH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(diagramX, diagramY, diagramW, diagramH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${currentSubstance.name} Phase Diagram`, diagramX + diagramW/2, diagramY + 20);
    
    // Axes setup
    const axisX = diagramX + 40;
    const axisY = diagramY + diagramH - 40;
    const plotW = diagramW - 80;
    const plotH = diagramH - 80;
    
    // Temperature and pressure ranges
    const minT = 50;
    const maxT = Math.max(currentSubstance.criticalPoint.T * 1.2, 500);
    const minP = 0.001;
    const maxP = Math.max(currentSubstance.criticalPoint.P * 1.5, 100);
    
    // Axes
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(axisX, diagramY + 40);
    ctx.lineTo(axisX, axisY);
    ctx.lineTo(axisX + plotW, axisY);
    ctx.stroke();
    
    // Phase regions
    drawPhaseRegions(axisX, axisY, plotW, plotH, minT, maxT, minP, maxP);
    
    // Phase boundaries
    drawPhaseBoundaries(axisX, axisY, plotW, plotH, minT, maxT, minP, maxP);
    
    // Critical point
    const cpX = axisX + ((currentSubstance.criticalPoint.T - minT) / (maxT - minT)) * plotW;
    const cpY = axisY - (Math.log(currentSubstance.criticalPoint.P) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
    
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(cpX, cpY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#ef4444";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Critical Point", cpX + 8, cpY - 5);
    
    // Triple point
    const tpX = axisX + ((currentSubstance.triplePoint.T - minT) / (maxT - minT)) * plotW;
    const tpY = axisY - (Math.log(currentSubstance.triplePoint.P) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
    
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(tpX, tpY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#10b981";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Triple Point", tpX + 8, tpY + 10);
    
    // Current state point
    const stateX = axisX + ((temperature - minT) / (maxT - minT)) * plotW;
    const stateY = axisY - (Math.log(pressure) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
    
    ctx.strokeStyle = "#fbbf24";
    ctx.fillStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(stateX, stateY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Temperature (K)", axisX + plotW/2, axisY + 25);
    
    ctx.save();
    ctx.translate(axisX - 25, diagramY + 40 + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Pressure (atm)", 0, 0);
    ctx.restore();
    
    // Tick marks
    ctx.fillStyle = "#94a3b8";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    
    for (let i = 0; i <= 4; i++) {
      const T = minT + (maxT - minT) * i / 4;
      const x = axisX + (i / 4) * plotW;
      ctx.fillText(T.toFixed(0), x, axisY + 15);
    }
    
    ctx.textAlign = "right";
    const pressures = [0.1, 1, 10, 100];
    for (const P of pressures) {
      if (P >= minP && P <= maxP) {
        const y = axisY - (Math.log(P) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
        ctx.fillText(P.toString(), axisX - 5, y + 3);
      }
    }
  }

  function drawPhaseRegions(axisX: number, axisY: number, plotW: number, plotH: number, minT: number, maxT: number, minP: number, maxP: number) {
    // Solid region
    ctx.fillStyle = currentSubstance.color.solid + "40";
    ctx.beginPath();
    ctx.moveTo(axisX, axisY);
    
    const tp = currentSubstance.triplePoint;
    const tpX = axisX + ((tp.T - minT) / (maxT - minT)) * plotW;
    const tpY = axisY - (Math.log(tp.P) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
    
    ctx.lineTo(tpX, tpY);
    ctx.lineTo(axisX, tpY);
    ctx.closePath();
    ctx.fill();
    
    // Label
    ctx.fillStyle = currentSubstance.color.solid;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SOLID", axisX + plotW * 0.15, axisY - plotH * 0.1);
    
    // Liquid region
    ctx.fillStyle = currentSubstance.color.liquid + "40";
    ctx.beginPath();
    ctx.moveTo(tpX, tpY);
    
    const cp = currentSubstance.criticalPoint;
    const cpX = axisX + ((cp.T - minT) / (maxT - minT)) * plotW;
    const cpY = axisY - (Math.log(cp.P) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
    
    // Simplified liquid region
    ctx.lineTo(cpX, cpY);
    ctx.lineTo(cpX, axisY - plotH);
    ctx.lineTo(axisX, axisY - plotH);
    ctx.lineTo(axisX, tpY);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = currentSubstance.color.liquid;
    ctx.fillText("LIQUID", axisX + plotW * 0.3, axisY - plotH * 0.6);
    
    // Gas region
    ctx.fillStyle = currentSubstance.color.gas + "40";
    ctx.beginPath();
    ctx.moveTo(tpX, axisY);
    ctx.lineTo(axisX + plotW, axisY);
    ctx.lineTo(axisX + plotW, tpY);
    ctx.lineTo(cpX, cpY);
    ctx.lineTo(tpX, tpY);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = currentSubstance.color.gas;
    ctx.fillText("GAS", axisX + plotW * 0.7, axisY - plotH * 0.2);
  }

  function drawPhaseBoundaries(axisX: number, axisY: number, plotW: number, plotH: number, minT: number, maxT: number, minP: number, maxP: number) {
    const tp = currentSubstance.triplePoint;
    const cp = currentSubstance.criticalPoint;
    
    const tpX = axisX + ((tp.T - minT) / (maxT - minT)) * plotW;
    const tpY = axisY - (Math.log(tp.P) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
    const cpX = axisX + ((cp.T - minT) / (maxT - minT)) * plotW;
    const cpY = axisY - (Math.log(cp.P) - Math.log(minP)) / (Math.log(maxP) - Math.log(minP)) * plotH;
    
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    
    // Sublimation curve (solid-gas)
    ctx.beginPath();
    ctx.moveTo(axisX, axisY - plotH * 0.9);
    ctx.lineTo(tpX, tpY);
    ctx.stroke();
    
    // Fusion curve (solid-liquid)
    ctx.beginPath();
    ctx.moveTo(tpX, tpY);
    ctx.lineTo(axisX, axisY - plotH);
    ctx.stroke();
    
    // Vaporization curve (liquid-gas)
    ctx.beginPath();
    ctx.moveTo(tpX, tpY);
    ctx.quadraticCurveTo(cpX * 0.7 + tpX * 0.3, cpY * 0.3 + tpY * 0.7, cpX, cpY);
    ctx.stroke();
  }

  function drawContainer() {
    const containerX = W * 0.05;
    const containerY = H * 0.3;
    const containerW = W * 0.4;
    const containerH = H * 0.4;
    
    // Container walls
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.strokeRect(containerX, containerY, containerW, containerH);
    
    // Phase label
    ctx.fillStyle = currentSubstance.color[currentPhase];
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(currentPhase.toUpperCase(), containerX + containerW/2, containerY - 10);
    
    // Thermometer
    const thermX = containerX - 30;
    const thermY = containerY + 20;
    const thermH = containerH - 40;
    
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(thermX - 3, thermY, 6, thermH);
    ctx.beginPath();
    ctx.arc(thermX, thermY + thermH, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${temperature.toFixed(0)}K`, thermX, thermY - 5);
    
    // Pressure gauge
    const gaugeX = containerX + containerW + 20;
    const gaugeY = containerY + 20;
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 25, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = "#22d3ee";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${pressure.toFixed(2)}`, gaugeX, gaugeY);
    ctx.fillText("atm", gaugeX, gaugeY + 10);
  }

  function drawParticles() {
    if (!showParticles) return;
    
    for (const particle of particles) {
      const size = currentPhase === "solid" ? 4 : currentPhase === "liquid" ? 3 : 2;
      const color = currentSubstance.color[particle.phase];
      const alpha = currentPhase === "gas" ? "80" : "ff";
      
      // Particle glow (for gas phase)
      if (currentPhase === "gas") {
        ctx.fillStyle = color + "40";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Particle body
      ctx.fillStyle = color + alpha;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeSystem();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newSubstance = Math.round(Math.max(0, Math.min(2, params.substance ?? substance)));
      if (newSubstance !== substance) {
        substance = newSubstance;
        initializeSystem();
      }
      
      temperature = Math.max(50, Math.min(800, params.temperature ?? temperature));
      pressure = Math.max(0.01, Math.min(200, params.pressure ?? pressure));
      showParticles = Math.round(params.showParticles ?? showParticles);
      animatePhase = Math.round(params.animatePhase ?? animatePhase);
      
      time += dt;
      
      if (animatePhase) {
        updateParticles(dt);
      }
      
      updatePhase();
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Phase Diagrams", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("States of matter and phase transitions", W / 2, 50);

      // Draw components
      drawContainer();
      if (showParticles && animatePhase) {
        drawParticles();
      }
      drawPhaseDiagram();

      // Current state info
      const infoY = H * 0.75;
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(W * 0.52, infoY, W * 0.45, H * 0.2);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(W * 0.52, infoY, W * 0.45, H * 0.2);
      
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      let y = infoY + 20;
      
      ctx.fillText("Current State:", W * 0.52 + 10, y);
      y += 18;
      
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Temperature: ${temperature.toFixed(0)} K`, W * 0.52 + 10, y);
      y += 16;
      ctx.fillText(`Pressure: ${pressure.toFixed(2)} atm`, W * 0.52 + 10, y);
      y += 16;
      
      ctx.fillStyle = currentSubstance.color[currentPhase];
      ctx.fillText(`Phase: ${currentPhase.toUpperCase()}`, W * 0.52 + 10, y);
      y += 18;
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      const tp = currentSubstance.triplePoint;
      const cp = currentSubstance.criticalPoint;
      
      ctx.fillText(`Triple Point: ${tp.T.toFixed(1)}K, ${tp.P.toFixed(3)}atm`, W * 0.52 + 10, y);
      y += 14;
      ctx.fillText(`Critical Point: ${cp.T.toFixed(0)}K, ${cp.P.toFixed(0)}atm`, W * 0.52 + 10, y);
    },

    reset() {
      time = 0;
      initializeSystem();
    },

    destroy() {},

    getStateDescription(): string {
      const tp = currentSubstance.triplePoint;
      const cp = currentSubstance.criticalPoint;
      
      return `Phase diagram for ${currentSubstance.name} at ${temperature.toFixed(0)}K and ${pressure.toFixed(2)}atm. ` +
             `Current phase: ${currentPhase}. Triple point: ${tp.T.toFixed(1)}K, ${tp.P.toFixed(3)}atm. ` +
             `Critical point: ${cp.T.toFixed(0)}K, ${cp.P.toFixed(0)}atm. ` +
             `${showParticles ? `${particles.length} particles showing molecular motion in ${currentPhase} phase. ` : ""}` +
             `Demonstrates phase transitions, critical phenomena, and P-T relationships.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default PhaseDiagramFactory;