import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Oscillator {
  x: number;
  y: number;
  vx: number;
  vy: number;
  amplitude: number;
  frequency: number;
  phase: number;
  mass: number;
  springConstant: number;
  damping: number;
  driven: boolean;
  drivingFrequency: number;
  drivingAmplitude: number;
}

interface HistoryPoint {
  time: number;
  position: number;
  velocity: number;
  acceleration: number;
  energy: number;
}

const SimpleHarmonicMotionFactory: SimulationFactory = () => {
  const config = getSimConfig("simple-harmonic-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let amplitude = 80;
  let frequency = 0.5; // Hz
  let damping = 0.1;
  let drivingForce = 0;
  let drivingFrequency = 0.5;
  let showPhaseSpace = 1;
  let motionType = 0; // 0=free, 1=damped, 2=driven

  // State
  let oscillator: Oscillator;
  let history: HistoryPoint[] = [];
  let equilibriumX: number;
  let equilibriumY: number;

  function initializeOscillator() {
    equilibriumX = W * 0.25;
    equilibriumY = H * 0.4;
    
    oscillator = {
      x: equilibriumX + amplitude,
      y: equilibriumY,
      vx: 0,
      vy: 0,
      amplitude: amplitude,
      frequency: frequency,
      phase: 0,
      mass: 1, // kg
      springConstant: 4 * Math.PI * Math.PI * frequency * frequency, // ω² = k/m
      damping: damping,
      driven: drivingForce > 0,
      drivingFrequency: drivingFrequency,
      drivingAmplitude: drivingForce,
    };
    
    history = [];
  }

  function updatePhysics(dt: number) {
    const osc = oscillator;
    
    // Displacement from equilibrium
    const displacement = osc.x - equilibriumX;
    
    // Forces
    let totalForce = 0;
    
    // Spring restoring force: F = -kx
    const springForce = -osc.springConstant * displacement;
    totalForce += springForce;
    
    // Damping force: F = -bv
    let dampingForce = 0;
    if (motionType >= 1) {
      dampingForce = -osc.damping * osc.vx;
      totalForce += dampingForce;
    }
    
    // Driving force: F = F₀cos(ωₜ)
    let drivingForceValue = 0;
    if (motionType === 2) {
      drivingForceValue = osc.drivingAmplitude * Math.cos(2 * Math.PI * osc.drivingFrequency * time);
      totalForce += drivingForceValue;
    }
    
    // Acceleration: a = F/m
    const acceleration = totalForce / osc.mass;
    
    // Update velocity and position
    osc.vx += acceleration * dt;
    osc.x += osc.vx * dt;
    
    // Calculate energy
    const kineticEnergy = 0.5 * osc.mass * osc.vx * osc.vx;
    const potentialEnergy = 0.5 * osc.springConstant * displacement * displacement;
    const totalEnergy = kineticEnergy + potentialEnergy;
    
    // Store history
    if (history.length > 500) history.shift();
    history.push({
      time: time,
      position: displacement,
      velocity: osc.vx,
      acceleration: acceleration,
      energy: totalEnergy,
    });
    
    // Update oscillator parameters for display
    const currentAmplitude = Math.sqrt(displacement * displacement + (osc.vx / (2 * Math.PI * osc.frequency)) ** 2);
    osc.amplitude = currentAmplitude;
  }

  function drawSpring(x1: number, y1: number, x2: number, y2: number) {
    const coils = 15;
    const amplitude = 12;
    const length = Math.abs(x2 - x1);
    
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    for (let i = 0; i <= coils; i++) {
      const t = i / coils;
      const x = x1 + t * (x2 - x1);
      const offset = (i === 0 || i === coils) ? 0 : amplitude * Math.sin(i * Math.PI);
      ctx.lineTo(x, y1 + offset);
    }
    
    ctx.stroke();
  }

  function drawMass(x: number, y: number) {
    const size = 25;
    
    // Mass body
    const gradient = ctx.createRadialGradient(x - 8, y - 8, 0, x, y, size);
    gradient.addColorStop(0, "#3b82f6");
    gradient.addColorStop(1, "#1e40af");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x - size/2, y - size/2, size, size);
    
    ctx.strokeStyle = "#1e3a8a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    
    // Mass label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("m", x, y);
  }

  function drawForceVectors(x: number, y: number) {
    const displacement = x - equilibriumX;
    const scale = 0.02;
    
    // Spring force (restoring)
    const springForce = -oscillator.springConstant * displacement;
    if (Math.abs(springForce) > 0.1) {
      const endX = x + springForce * scale;
      
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - 40);
      ctx.lineTo(endX, y - 40);
      ctx.stroke();
      
      // Arrowhead
      const arrowSize = 6;
      const direction = springForce > 0 ? 1 : -1;
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.moveTo(endX, y - 40);
      ctx.lineTo(endX - direction * arrowSize, y - 40 - 3);
      ctx.lineTo(endX - direction * arrowSize, y - 40 + 3);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = "#10b981";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`F_spring`, x + springForce * scale * 0.5, y - 50);
    }
    
    // Damping force
    if (motionType >= 1 && Math.abs(oscillator.vx) > 0.1) {
      const dampingForce = -oscillator.damping * oscillator.vx;
      const endX = x + dampingForce * scale * 10;
      
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 40);
      ctx.lineTo(endX, y + 40);
      ctx.stroke();
      
      ctx.fillStyle = "#ef4444";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("F_damping", x + dampingForce * scale * 5, y + 55);
    }
    
    // Driving force
    if (motionType === 2) {
      const drivingForceValue = oscillator.drivingAmplitude * Math.cos(2 * Math.PI * oscillator.drivingFrequency * time);
      if (Math.abs(drivingForceValue) > 0.1) {
        const endX = x + drivingForceValue * scale * 5;
        
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + 60);
        ctx.lineTo(endX, y + 60);
        ctx.stroke();
        
        ctx.fillStyle = "#8b5cf6";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("F_driving", x + drivingForceValue * scale * 2.5, y + 75);
      }
    }
  }

  function drawEquilibriumPosition() {
    // Equilibrium line
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(equilibriumX, equilibriumY - 60);
    ctx.lineTo(equilibriumX, equilibriumY + 60);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = "#ef4444";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Equilibrium", equilibriumX, equilibriumY - 70);
  }

  function drawPositionGraph() {
    const graphX = W * 0.45;
    const graphY = H * 0.1;
    const graphW = W * 0.5;
    const graphH = H * 0.35;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Position vs Time", graphX + graphW / 2, graphY + 15);
    
    if (history.length > 1) {
      // Find bounds
      const maxPos = Math.max(...history.map(h => Math.abs(h.position)), 1);
      const minTime = Math.min(...history.map(h => h.time));
      const maxTime = Math.max(...history.map(h => h.time));
      const timeRange = maxTime - minTime || 1;
      
      // Draw position curve
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const x = graphX + 20 + ((point.time - minTime) / timeRange) * (graphW - 40);
        const y = graphY + graphH/2 - (point.position / maxPos) * (graphH - 60) * 0.4;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Draw velocity curve
      const maxVel = Math.max(...history.map(h => Math.abs(h.velocity)), 1);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const x = graphX + 20 + ((point.time - minTime) / timeRange) * (graphW - 40);
        const y = graphY + graphH/2 - (point.velocity / maxVel) * (graphH - 60) * 0.2;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Legend
      ctx.fillStyle = "#22d3ee";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Position", graphX + 5, graphY + 30);
      
      ctx.fillStyle = "#10b981";
      ctx.fillText("Velocity", graphX + 5, graphY + 45);
    }
    
    // Axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX + 20, graphY + 25);
    ctx.lineTo(graphX + 20, graphY + graphH - 15);
    ctx.lineTo(graphX + graphW - 20, graphY + graphH - 15);
    ctx.stroke();
  }

  function drawPhaseSpace() {
    if (!showPhaseSpace) return;
    
    const phaseX = W * 0.45;
    const phaseY = H * 0.5;
    const phaseW = W * 0.25;
    const phaseH = H * 0.45;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(phaseX, phaseY, phaseW, phaseH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(phaseX, phaseY, phaseW, phaseH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Phase Space", phaseX + phaseW / 2, phaseY + 15);
    
    if (history.length > 1) {
      const maxPos = Math.max(...history.map(h => Math.abs(h.position)), 1);
      const maxVel = Math.max(...history.map(h => Math.abs(h.velocity)), 1);
      
      // Draw phase trajectory
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const x = phaseX + phaseW/2 + (point.position / maxPos) * (phaseW - 40) * 0.4;
        const y = phaseY + phaseH/2 - (point.velocity / maxVel) * (phaseH - 40) * 0.4;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Current point
      if (history.length > 0) {
        const current = history[history.length - 1];
        const x = phaseX + phaseW/2 + (current.position / maxPos) * (phaseW - 40) * 0.4;
        const y = phaseY + phaseH/2 - (current.velocity / maxVel) * (phaseH - 40) * 0.4;
        
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(phaseX + 20, phaseY + 25);
    ctx.lineTo(phaseX + 20, phaseY + phaseH - 15);
    ctx.lineTo(phaseX + phaseW - 20, phaseY + phaseH - 15);
    ctx.stroke();
    
    // Center lines
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(phaseX + phaseW/2, phaseY + 25);
    ctx.lineTo(phaseX + phaseW/2, phaseY + phaseH - 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(phaseX + 20, phaseY + phaseH/2);
    ctx.lineTo(phaseX + phaseW - 20, phaseY + phaseH/2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Position", phaseX + phaseW/2, phaseY + phaseH - 5);
    
    ctx.save();
    ctx.translate(phaseX + 10, phaseY + phaseH/2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Velocity", 0, 0);
    ctx.restore();
  }

  function drawEnergyGraph() {
    const energyX = W * 0.72;
    const energyY = H * 0.5;
    const energyW = W * 0.25;
    const energyH = H * 0.45;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(energyX, energyY, energyW, energyH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(energyX, energyY, energyW, energyH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Energy", energyX + energyW / 2, energyY + 15);
    
    if (history.length > 1) {
      const maxEnergy = Math.max(...history.map(h => h.energy), 1);
      const minTime = Math.min(...history.map(h => h.time));
      const maxTime = Math.max(...history.map(h => h.time));
      const timeRange = maxTime - minTime || 1;
      
      // Total energy
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const x = energyX + 20 + ((point.time - minTime) / timeRange) * (energyW - 40);
        const y = energyY + energyH - 25 - (point.energy / maxEnergy) * (energyH - 50);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Kinetic energy
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const ke = 0.5 * oscillator.mass * point.velocity * point.velocity;
        const x = energyX + 20 + ((point.time - minTime) / timeRange) * (energyW - 40);
        const y = energyY + energyH - 25 - (ke / maxEnergy) * (energyH - 50);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Potential energy
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const pe = 0.5 * oscillator.springConstant * point.position * point.position;
        const x = energyX + 20 + ((point.time - minTime) / timeRange) * (energyW - 40);
        const y = energyY + energyH - 25 - (pe / maxEnergy) * (energyH - 50);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Legend
      ctx.fillStyle = "#ef4444";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Total", energyX + 5, energyY + 30);
      
      ctx.fillStyle = "#10b981";
      ctx.fillText("Kinetic", energyX + 5, energyY + 42);
      
      ctx.fillStyle = "#8b5cf6";
      ctx.fillText("Potential", energyX + 5, energyY + 54);
    }
  }

  function drawInfoPanel() {
    const panelX = W * 0.02;
    const panelY = H * 0.55;
    const panelW = W * 0.4;
    const panelH = H * 0.4;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    const motionTypes = ["Free Oscillation", "Damped Oscillation", "Driven Oscillation"];
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    
    ctx.fillText(`Mode: ${motionTypes[motionType]}`, panelX + 10, infoY);
    infoY += 25;
    
    // Current parameters
    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px monospace";
    ctx.fillText(`Frequency: ${frequency.toFixed(2)} Hz`, panelX + 10, infoY);
    infoY += 18;
    ctx.fillText(`Period: ${(1/frequency).toFixed(2)} s`, panelX + 10, infoY);
    infoY += 18;
    ctx.fillText(`ω = ${(2 * Math.PI * frequency).toFixed(2)} rad/s`, panelX + 10, infoY);
    infoY += 18;
    
    if (motionType >= 1) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Damping: ${damping.toFixed(3)}`, panelX + 10, infoY);
      infoY += 18;
    }
    
    if (motionType === 2) {
      ctx.fillStyle = "#8b5cf6";
      ctx.fillText(`Drive freq: ${drivingFrequency.toFixed(2)} Hz`, panelX + 10, infoY);
      infoY += 18;
      ctx.fillText(`Drive amp: ${drivingForce.toFixed(1)}`, panelX + 10, infoY);
      infoY += 18;
    }
    
    // Current values
    if (history.length > 0) {
      const current = history[history.length - 1];
      
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`Position: ${current.position.toFixed(1)} px`, panelX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Velocity: ${current.velocity.toFixed(1)} px/s`, panelX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Acceleration: ${current.acceleration.toFixed(1)} px/s²`, panelX + 10, infoY);
      infoY += 20;
      
      // Energy
      const ke = 0.5 * oscillator.mass * current.velocity * current.velocity;
      const pe = 0.5 * oscillator.springConstant * current.position * current.position;
      
      ctx.fillStyle = "#10b981";
      ctx.fillText(`KE: ${ke.toFixed(1)} J`, panelX + 10, infoY);
      infoY += 16;
      
      ctx.fillStyle = "#8b5cf6";
      ctx.fillText(`PE: ${pe.toFixed(1)} J`, panelX + 10, infoY);
      infoY += 16;
      
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Total: ${(ke + pe).toFixed(1)} J`, panelX + 10, infoY);
      infoY += 20;
    }
    
    // Equations
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("Equations:", panelX + 10, infoY);
    infoY += 14;
    
    ctx.fillText("x(t) = A cos(ωt + φ)", panelX + 10, infoY);
    infoY += 12;
    ctx.fillText("v(t) = -Aω sin(ωt + φ)", panelX + 10, infoY);
    infoY += 12;
    ctx.fillText("a(t) = -Aω² cos(ωt + φ)", panelX + 10, infoY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeOscillator();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      amplitude = params.amplitude ?? amplitude;
      frequency = params.frequency ?? frequency;
      damping = params.damping ?? damping;
      drivingForce = params.drivingForce ?? drivingForce;
      drivingFrequency = params.drivingFrequency ?? drivingFrequency;
      showPhaseSpace = Math.round(params.showPhaseSpace ?? showPhaseSpace);
      motionType = Math.round(params.motionType ?? motionType);
      motionType = Math.max(0, Math.min(2, motionType));
      
      // Update oscillator parameters
      oscillator.frequency = frequency;
      oscillator.springConstant = 4 * Math.PI * Math.PI * frequency * frequency;
      oscillator.damping = damping;
      oscillator.drivingFrequency = drivingFrequency;
      oscillator.drivingAmplitude = drivingForce;
      oscillator.driven = motionType === 2;
      
      time += dt;
      updatePhysics(dt);
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
      ctx.fillText("Simple Harmonic Motion", W / 2, 30);
      
      const motionTypes = ["Free", "Damped", "Driven"];
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${motionTypes[motionType]} oscillation analysis`, W / 2, 50);

      // Draw physical system
      // Fixed wall
      ctx.fillStyle = "#374151";
      ctx.fillRect(50, equilibriumY - 40, 20, 80);
      
      // Hatching for wall
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const y = equilibriumY - 30 + i * 10;
        ctx.beginPath();
        ctx.moveTo(70, y);
        ctx.lineTo(75, y + 5);
        ctx.stroke();
      }
      
      // Spring
      drawSpring(70, equilibriumY, oscillator.x - 12, oscillator.y);
      
      // Mass
      drawMass(oscillator.x, oscillator.y);
      
      // Equilibrium position
      drawEquilibriumPosition();
      
      // Force vectors
      drawForceVectors(oscillator.x, oscillator.y);
      
      // Graphs
      drawPositionGraph();
      if (showPhaseSpace) {
        drawPhaseSpace();
        drawEnergyGraph();
      }
      drawInfoPanel();
      
      // Show resonance condition for driven oscillation
      if (motionType === 2) {
        const isResonance = Math.abs(drivingFrequency - frequency) < 0.05;
        if (isResonance) {
          ctx.fillStyle = "#ef4444";
          ctx.font = "14px monospace";
          ctx.textAlign = "center";
          ctx.fillText("RESONANCE!", W / 2, H - 20);
        }
      }
    },

    reset() {
      time = 0;
      initializeOscillator();
    },

    destroy() {},

    getStateDescription(): string {
      const motionTypes = ["free", "damped", "driven"];
      const current = history.length > 0 ? history[history.length - 1] : null;
      
      let description = `Simple harmonic motion: ${motionTypes[motionType]} oscillation at ${frequency.toFixed(2)}Hz. `;
      
      if (current) {
        description += `Current position: ${current.position.toFixed(1)}px, velocity: ${current.velocity.toFixed(1)}px/s. `;
        const ke = 0.5 * oscillator.mass * current.velocity * current.velocity;
        const pe = 0.5 * oscillator.springConstant * current.position * current.position;
        description += `Energy: KE=${ke.toFixed(1)}J, PE=${pe.toFixed(1)}J, Total=${(ke+pe).toFixed(1)}J. `;
      }
      
      if (motionType >= 1) {
        description += `Damping coefficient: ${damping.toFixed(3)}. `;
      }
      
      if (motionType === 2) {
        description += `Driving frequency: ${drivingFrequency.toFixed(2)}Hz, amplitude: ${drivingForce.toFixed(1)}. `;
        if (Math.abs(drivingFrequency - frequency) < 0.05) {
          description += "At resonance - maximum amplitude response!";
        }
      }
      
      return description;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default SimpleHarmonicMotionFactory;