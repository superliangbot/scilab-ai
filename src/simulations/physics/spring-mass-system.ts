import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Mass {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
}

const SpringMassSystemFactory: SimulationFactory = () => {
  const config = getSimConfig("spring-mass-system") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let springConstant = 10;
  let mass1Value = 2;
  let dampingCoefficient = 0.1;
  let amplitude = 50;

  // State
  let mass1: Mass = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    mass: 2,
    radius: 20,
  };

  let equilibriumX = W * 0.5;
  let springRestLength = 100;
  let energyHistory: number[] = [];
  let positionHistory: { x: number; t: number }[] = [];

  function init() {
    equilibriumX = W * 0.5;
    mass1.x = equilibriumX + amplitude;
    mass1.y = H * 0.5;
    mass1.vx = 0;
    mass1.vy = 0;
    mass1.mass = mass1Value;
    energyHistory = [];
    positionHistory = [];
  }

  function computePhysics(dt: number) {
    // Spring force: F = -kx (Hooke's law)
    const displacement = mass1.x - equilibriumX;
    const springForce = -springConstant * displacement;
    
    // Damping force: F = -bv
    const dampingForce = -dampingCoefficient * mass1.vx;
    
    // Total force
    const totalForce = springForce + dampingForce;
    
    // Acceleration: a = F/m
    const acceleration = totalForce / mass1.mass;
    
    // Update velocity and position
    mass1.vx += acceleration * dt;
    mass1.x += mass1.vx * dt;
    
    // Calculate energies
    const kineticEnergy = 0.5 * mass1.mass * mass1.vx * mass1.vx;
    const potentialEnergy = 0.5 * springConstant * displacement * displacement;
    const totalEnergy = kineticEnergy + potentialEnergy;
    
    // Store history for graphs
    if (energyHistory.length > 300) energyHistory.shift();
    energyHistory.push(totalEnergy);
    
    if (positionHistory.length > 500) positionHistory.shift();
    positionHistory.push({ x: displacement, t: time });
  }

  function drawSpring(x1: number, y1: number, x2: number, y2: number) {
    const coils = 12;
    const amplitude = 15;
    const length = Math.abs(x2 - x1);
    
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    for (let i = 0; i <= coils; i++) {
      const t = i / coils;
      const x = x1 + t * (x2 - x1);
      const offset = i === 0 || i === coils ? 0 : amplitude * Math.sin(i * Math.PI);
      ctx.lineTo(x, y1 + offset);
    }
    
    ctx.stroke();
    
    // Spring attachment point
    ctx.fillStyle = "#374151";
    ctx.fillRect(x1 - 5, y1 - 20, 10, 40);
  }

  function drawMass(mass: Mass) {
    // Mass body
    const gradient = ctx.createRadialGradient(
      mass.x - 5, mass.y - 5, 0,
      mass.x, mass.y, mass.radius
    );
    gradient.addColorStop(0, "#fbbf24");
    gradient.addColorStop(1, "#f59e0b");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(mass.x, mass.y, mass.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Mass label
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mass.mass.toFixed(1)}kg`, mass.x, mass.y);
  }

  function drawGraphs() {
    const graphX = W * 0.05;
    const graphY = H * 0.7;
    const graphW = W * 0.4;
    const graphH = H * 0.25;
    
    // Position vs time graph
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    if (positionHistory.length > 1) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < positionHistory.length; i++) {
        const point = positionHistory[i];
        const x = graphX + (i / positionHistory.length) * graphW;
        const y = graphY + graphH * 0.5 - (point.x / 100) * graphH * 0.4;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Position vs Time", graphX + graphW * 0.5, graphY - 5);
    
    // Energy graph
    const energyGraphX = W * 0.55;
    if (energyHistory.length > 1) {
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.fillRect(energyGraphX, graphY, graphW, graphH);
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.strokeRect(energyGraphX, graphY, graphW, graphH);
      
      const maxEnergy = Math.max(...energyHistory, 100);
      
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < energyHistory.length; i++) {
        const energy = energyHistory[i];
        const x = energyGraphX + (i / energyHistory.length) * graphW;
        const y = graphY + graphH - (energy / maxEnergy) * graphH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Total Energy vs Time", energyGraphX + graphW * 0.5, graphY - 5);
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      init();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      springConstant = params.springConstant ?? springConstant;
      mass1Value = params.mass ?? mass1Value;
      dampingCoefficient = params.damping ?? dampingCoefficient;
      amplitude = params.amplitude ?? amplitude;
      
      // Update mass value if changed
      if (mass1.mass !== mass1Value) {
        mass1.mass = mass1Value;
      }
      
      time += dt;
      computePhysics(dt);
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
      ctx.fillText("Spring-Mass System", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Simple Harmonic Motion: F = -kx", W / 2, 50);

      // Draw fixed wall
      ctx.fillStyle = "#374151";
      ctx.fillRect(50, H * 0.3, 20, H * 0.4);
      
      // Hatching pattern for wall
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = H * 0.3 + (H * 0.4 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(70, y);
        ctx.lineTo(75, y + 5);
        ctx.stroke();
      }

      // Draw spring
      drawSpring(70, H * 0.5, mass1.x - mass1.radius, mass1.y);

      // Draw mass
      drawMass(mass1);

      // Draw equilibrium position indicator
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(equilibriumX, H * 0.3);
      ctx.lineTo(equilibriumX, H * 0.7);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "#ef4444";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Equilibrium", equilibriumX, H * 0.25);

      // Draw velocity vector
      if (Math.abs(mass1.vx) > 0.1) {
        const arrowScale = 2;
        const arrowEndX = mass1.x + mass1.vx * arrowScale;
        
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mass1.x, mass1.y - mass1.radius - 10);
        ctx.lineTo(arrowEndX, mass1.y - mass1.radius - 10);
        ctx.stroke();
        
        // Arrowhead
        const arrowSize = 8;
        const direction = mass1.vx > 0 ? 1 : -1;
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.moveTo(arrowEndX, mass1.y - mass1.radius - 10);
        ctx.lineTo(arrowEndX - direction * arrowSize, mass1.y - mass1.radius - 10 - arrowSize/2);
        ctx.lineTo(arrowEndX - direction * arrowSize, mass1.y - mass1.radius - 10 + arrowSize/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "#22d3ee";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`v=${mass1.vx.toFixed(1)}m/s`, mass1.x + mass1.vx * arrowScale * 0.5, mass1.y - mass1.radius - 25);
      }

      // Draw force vector
      const displacement = mass1.x - equilibriumX;
      const springForce = -springConstant * displacement;
      if (Math.abs(springForce) > 0.1) {
        const forceScale = 0.1;
        const forceEndX = mass1.x + springForce * forceScale;
        
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mass1.x, mass1.y + mass1.radius + 10);
        ctx.lineTo(forceEndX, mass1.y + mass1.radius + 10);
        ctx.stroke();
        
        // Arrowhead
        const arrowSize = 8;
        const direction = springForce > 0 ? 1 : -1;
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.moveTo(forceEndX, mass1.y + mass1.radius + 10);
        ctx.lineTo(forceEndX - direction * arrowSize, mass1.y + mass1.radius + 10 - arrowSize/2);
        ctx.lineTo(forceEndX - direction * arrowSize, mass1.y + mass1.radius + 10 + arrowSize/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = "#10b981";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`F=${springForce.toFixed(1)}N`, mass1.x + springForce * forceScale * 0.5, mass1.y + mass1.radius + 35);
      }

      // Draw information panel
      const panelX = W * 0.02;
      const panelY = H * 0.02;
      const panelW = W * 0.25;
      const panelH = H * 0.2;
      
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX, panelY, panelW, panelH);
      
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      let infoY = panelY + 20;
      
      ctx.fillText(`k = ${springConstant.toFixed(1)} N/m`, panelX + 10, infoY);
      infoY += 18;
      ctx.fillText(`m = ${mass1.mass.toFixed(1)} kg`, panelX + 10, infoY);
      infoY += 18;
      ctx.fillText(`b = ${dampingCoefficient.toFixed(2)} kg/s`, panelX + 10, infoY);
      infoY += 18;
      
      const period = 2 * Math.PI * Math.sqrt(mass1.mass / springConstant);
      const frequency = 1 / period;
      
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`T = ${period.toFixed(2)} s`, panelX + 10, infoY);
      infoY += 18;
      ctx.fillText(`f = ${frequency.toFixed(2)} Hz`, panelX + 10, infoY);
      
      // Equations
      ctx.fillStyle = "#fbbf24";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("F = -kx - bv", W * 0.13, H * 0.36);
      ctx.fillText("T = 2π√(m/k)", W * 0.13, H * 0.39);

      // Draw graphs
      drawGraphs();

      // Current values display
      const displacement = mass1.x - equilibriumX;
      const kineticEnergy = 0.5 * mass1.mass * mass1.vx * mass1.vx;
      const potentialEnergy = 0.5 * springConstant * displacement * displacement;
      
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`x = ${displacement.toFixed(1)} m`, W * 0.75, H * 0.15);
      ctx.fillText(`v = ${mass1.vx.toFixed(1)} m/s`, W * 0.75, H * 0.18);
      ctx.fillText(`KE = ${kineticEnergy.toFixed(1)} J`, W * 0.75, H * 0.21);
      ctx.fillText(`PE = ${potentialEnergy.toFixed(1)} J`, W * 0.75, H * 0.24);
      ctx.fillText(`Total = ${(kineticEnergy + potentialEnergy).toFixed(1)} J`, W * 0.75, H * 0.27);
    },

    reset() {
      time = 0;
      init();
    },

    destroy() {},

    getStateDescription(): string {
      const displacement = mass1.x - equilibriumX;
      const period = 2 * Math.PI * Math.sqrt(mass1.mass / springConstant);
      const frequency = 1 / period;
      
      return `Spring-mass system with k=${springConstant}N/m, m=${mass1.mass}kg, damping=${dampingCoefficient}kg/s. ` +
             `Current displacement: ${displacement.toFixed(1)}m, velocity: ${mass1.vx.toFixed(1)}m/s. ` +
             `Natural period: ${period.toFixed(2)}s, frequency: ${frequency.toFixed(2)}Hz. ` +
             `Demonstrates simple harmonic motion governed by Hooke's law F=-kx with damping.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default SpringMassSystemFactory;