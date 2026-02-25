import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Coupled Oscillators: Normal Modes and Energy Transfer
 * Demonstrates:
 * - Normal mode frequencies: ω₁ and ω₂
 * - Energy transfer between oscillators
 * - Beat phenomena when masses are different
 * - Symmetric and antisymmetric modes
 * - Mode superposition and phase relationships
 */

interface Oscillator {
  mass: number;
  position: number; // displacement from equilibrium (m)
  velocity: number; // m/s
  x: number; // screen x position
  y: number; // screen y position
}

interface NormalMode {
  frequency: number; // rad/s
  amplitude1: number; // relative amplitude for mass 1
  amplitude2: number; // relative amplitude for mass 2
  phase: number; // initial phase
  name: string;
}

const CoupledOscillatorsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("coupled-oscillators") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical parameters
  let mass1 = 1.0; // kg
  let mass2 = 1.0; // kg
  let k1 = 25; // spring constant for left spring (N/m)
  let k2 = 25; // spring constant for coupling spring (N/m)
  let k3 = 25; // spring constant for right spring (N/m)
  let damping = 0.02; // damping coefficient

  // Visualization parameters
  let showModes = 1;
  let showEnergy = 1;
  let exciteMode = 0; // 0=manual, 1=symmetric, 2=antisymmetric

  // System state
  let oscillators: [Oscillator, Oscillator] = [{
    mass: 1.0,
    position: 0,
    velocity: 0,
    x: 0,
    y: 0
  }, {
    mass: 1.0,
    position: 0,
    velocity: 0,
    x: 0,
    y: 0
  }];

  // Normal modes
  let normalModes: [NormalMode, NormalMode] = [{
    frequency: 0,
    amplitude1: 0,
    amplitude2: 0,
    phase: 0,
    name: "Symmetric"
  }, {
    frequency: 0,
    amplitude1: 0,
    amplitude2: 0,
    phase: 0,
    name: "Antisymmetric"
  }];

  // History for plotting
  let positionHistory: Array<{time: number, pos1: number, pos2: number}> = [];
  let energyHistory: Array<{time: number, ke1: number, ke2: number, pe: number}> = [];
  const MAX_HISTORY = 150;

  // Layout parameters
  let wallX = 0;
  let equilibriumSpacing = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;

    wallX = width * 0.15;
    equilibriumSpacing = width * 0.25;

    // Initialize oscillator positions
    oscillators[0].x = wallX + equilibriumSpacing;
    oscillators[0].y = height * 0.4;
    oscillators[1].x = wallX + 2 * equilibriumSpacing;
    oscillators[1].y = height * 0.4;

    resetSystem();
  }

  function resetSystem(): void {
    oscillators[0].position = 0;
    oscillators[0].velocity = 0;
    oscillators[1].position = 0;
    oscillators[1].velocity = 0;
    
    positionHistory = [];
    energyHistory = [];
    time = 0;
    
    calculateNormalModes();
  }

  function calculateNormalModes(): void {
    // For two masses connected by three springs:
    // m₁ẍ₁ = -k₁x₁ - k₂(x₁ - x₂)
    // m₂ẍ₂ = -k₃x₂ - k₂(x₂ - x₁)
    
    // Normal mode analysis: assume solutions of form x₁ = A₁e^(iωt), x₂ = A₂e^(iωt)
    // This gives: (k₁ + k₂ - m₁ω²)A₁ - k₂A₂ = 0
    //             -k₂A₁ + (k₂ + k₃ - m₂ω²)A₂ = 0
    
    // For identical masses and springs (symmetric case):
    if (Math.abs(mass1 - mass2) < 0.01 && Math.abs(k1 - k3) < 0.01) {
      // Symmetric mode: both masses move together
      normalModes[0].frequency = Math.sqrt(k1 / mass1);
      normalModes[0].amplitude1 = 1;
      normalModes[0].amplitude2 = 1;
      normalModes[0].name = "Symmetric (in-phase)";

      // Antisymmetric mode: masses move opposite
      normalModes[1].frequency = Math.sqrt((k1 + 2*k2) / mass1);
      normalModes[1].amplitude1 = 1;
      normalModes[1].amplitude2 = -1;
      normalModes[1].name = "Antisymmetric (out-of-phase)";
    } else {
      // General case - solve characteristic equation
      const a = mass1 * mass2;
      const b = -(mass1*(k2+k3) + mass2*(k1+k2));
      const c = k1*k2 + k1*k3 + k2*k3;
      
      const discriminant = b*b - 4*a*c;
      if (discriminant >= 0) {
        const omega1_sq = (-b + Math.sqrt(discriminant)) / (2*a);
        const omega2_sq = (-b - Math.sqrt(discriminant)) / (2*a);
        
        normalModes[0].frequency = Math.sqrt(Math.max(0, omega1_sq));
        normalModes[1].frequency = Math.sqrt(Math.max(0, omega2_sq));

        // Calculate amplitude ratios
        if (normalModes[0].frequency > 0) {
          normalModes[0].amplitude1 = 1;
          normalModes[0].amplitude2 = k2 / (k2 + k3 - mass2 * omega1_sq);
          normalModes[0].name = "Mode 1 (lower freq)";
        }
        
        if (normalModes[1].frequency > 0) {
          normalModes[1].amplitude1 = 1;
          normalModes[1].amplitude2 = k2 / (k2 + k3 - mass2 * omega2_sq);
          normalModes[1].name = "Mode 2 (higher freq)";
        }
      }
    }
  }

  function exciteNormalMode(modeIndex: number, amplitude: number = 0.1): void {
    const mode = normalModes[modeIndex];
    
    oscillators[0].position = amplitude * mode.amplitude1;
    oscillators[0].velocity = 0;
    oscillators[1].position = amplitude * mode.amplitude2;
    oscillators[1].velocity = 0;
    
    positionHistory = [];
    energyHistory = [];
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    // Update parameters
    const newMass1 = params.mass1 ?? 1.0;
    const newMass2 = params.mass2 ?? 1.0;
    const newK1 = params.k1 ?? 25;
    const newK2 = params.k2 ?? 25;
    const newK3 = params.k3 ?? 25;
    damping = params.damping ?? 0.02;
    showModes = params.showModes ?? 1;
    showEnergy = params.showEnergy ?? 1;
    const newExciteMode = Math.round(params.exciteMode ?? 0);

    // Check if parameters changed
    if (newMass1 !== mass1 || newMass2 !== mass2 || 
        newK1 !== k1 || newK2 !== k2 || newK3 !== k3) {
      mass1 = newMass1;
      mass2 = newMass2;
      k1 = newK1;
      k2 = newK2;
      k3 = newK3;
      
      oscillators[0].mass = mass1;
      oscillators[1].mass = mass2;
      
      calculateNormalModes();
    }

    // Handle mode excitation
    if (newExciteMode !== exciteMode) {
      exciteMode = newExciteMode;
      if (exciteMode === 1) {
        exciteNormalMode(0, 0.1); // Symmetric mode
      } else if (exciteMode === 2) {
        exciteNormalMode(1, 0.1); // Antisymmetric mode
      }
    }

    // Physics integration using Runge-Kutta 4th order
    const step = Math.min(dt, 0.01);
    
    function derivatives(pos1: number, vel1: number, pos2: number, vel2: number) {
      // Forces on mass 1: -k₁x₁ - k₂(x₁ - x₂)
      const force1 = -k1 * pos1 - k2 * (pos1 - pos2) - damping * vel1;
      const accel1 = force1 / mass1;
      
      // Forces on mass 2: -k₃x₂ - k₂(x₂ - x₁)
      const force2 = -k3 * pos2 - k2 * (pos2 - pos1) - damping * vel2;
      const accel2 = force2 / mass2;
      
      return { dx1: vel1, dv1: accel1, dx2: vel2, dv2: accel2 };
    }

    const k1_derivs = derivatives(
      oscillators[0].position, oscillators[0].velocity,
      oscillators[1].position, oscillators[1].velocity
    );
    
    const k2_derivs = derivatives(
      oscillators[0].position + k1_derivs.dx1 * step/2,
      oscillators[0].velocity + k1_derivs.dv1 * step/2,
      oscillators[1].position + k1_derivs.dx2 * step/2,
      oscillators[1].velocity + k1_derivs.dv2 * step/2
    );
    
    const k3_derivs = derivatives(
      oscillators[0].position + k2_derivs.dx1 * step/2,
      oscillators[0].velocity + k2_derivs.dv1 * step/2,
      oscillators[1].position + k2_derivs.dx2 * step/2,
      oscillators[1].velocity + k2_derivs.dv2 * step/2
    );
    
    const k4_derivs = derivatives(
      oscillators[0].position + k3_derivs.dx1 * step,
      oscillators[0].velocity + k3_derivs.dv1 * step,
      oscillators[1].position + k3_derivs.dx2 * step,
      oscillators[1].velocity + k3_derivs.dv2 * step
    );

    // Update positions and velocities
    oscillators[0].position += (step/6) * (k1_derivs.dx1 + 2*k2_derivs.dx1 + 2*k3_derivs.dx1 + k4_derivs.dx1);
    oscillators[0].velocity += (step/6) * (k1_derivs.dv1 + 2*k2_derivs.dv1 + 2*k3_derivs.dv1 + k4_derivs.dv1);
    oscillators[1].position += (step/6) * (k1_derivs.dx2 + 2*k2_derivs.dx2 + 2*k3_derivs.dx2 + k4_derivs.dx2);
    oscillators[1].velocity += (step/6) * (k1_derivs.dv2 + 2*k2_derivs.dv2 + 2*k3_derivs.dv2 + k4_derivs.dv2);

    time += step;

    // Record history
    positionHistory.push({
      time: time,
      pos1: oscillators[0].position,
      pos2: oscillators[1].position
    });

    // Calculate energies
    const ke1 = 0.5 * mass1 * oscillators[0].velocity * oscillators[0].velocity;
    const ke2 = 0.5 * mass2 * oscillators[1].velocity * oscillators[1].velocity;
    const pe1 = 0.5 * k1 * oscillators[0].position * oscillators[0].position;
    const pe_coupling = 0.5 * k2 * Math.pow(oscillators[0].position - oscillators[1].position, 2);
    const pe3 = 0.5 * k3 * oscillators[1].position * oscillators[1].position;
    const totalPE = pe1 + pe_coupling + pe3;

    energyHistory.push({
      time: time,
      ke1: ke1,
      ke2: ke2,
      pe: totalPE
    });

    // Trim history
    if (positionHistory.length > MAX_HISTORY) positionHistory.shift();
    if (energyHistory.length > MAX_HISTORY) energyHistory.shift();

    // Update screen positions
    const pixelsPerMeter = 200;
    oscillators[0].x = wallX + equilibriumSpacing + oscillators[0].position * pixelsPerMeter;
    oscillators[1].x = wallX + 2 * equilibriumSpacing + oscillators[1].position * pixelsPerMeter;
  }

  function drawSystem(): void {
    const massSize = 25;
    const wallHeight = 100;
    const springY = height * 0.4;

    // Wall
    ctx.fillStyle = "#374151";
    ctx.fillRect(wallX - 15, springY - wallHeight/2, 15, wallHeight);
    
    // Wall shading
    const wallGrad = ctx.createLinearGradient(wallX - 15, 0, wallX, 0);
    wallGrad.addColorStop(0, "#6b7280");
    wallGrad.addColorStop(1, "#374151");
    ctx.fillStyle = wallGrad;
    ctx.fillRect(wallX - 15, springY - wallHeight/2, 15, wallHeight);

    // Draw springs
    drawSpring(wallX, springY, oscillators[0].x - massSize, 12, "#64748b");
    drawSpring(oscillators[0].x + massSize, springY, oscillators[1].x - massSize, 12, "#ef4444");
    drawSpring(oscillators[1].x + massSize, springY, wallX + 3 * equilibriumSpacing, 12, "#64748b");

    // Draw masses
    oscillators.forEach((osc, i) => {
      // Mass shadow
      ctx.beginPath();
      ctx.roundRect(osc.x - massSize + 3, springY - massSize + 3, massSize * 2, massSize * 2, 6);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fill();

      // Mass body
      const massGrad = ctx.createLinearGradient(
        osc.x - massSize, springY - massSize,
        osc.x + massSize, springY + massSize
      );
      massGrad.addColorStop(0, i === 0 ? "#3b82f6" : "#10b981");
      massGrad.addColorStop(1, i === 0 ? "#1e40af" : "#047857");

      ctx.beginPath();
      ctx.roundRect(osc.x - massSize, springY - massSize, massSize * 2, massSize * 2, 6);
      ctx.fillStyle = massGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mass labels
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`m${i+1}`, osc.x, springY - 5);
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`${osc.mass.toFixed(1)}kg`, osc.x, springY + 8);

      // Velocity arrows
      if (Math.abs(osc.velocity) > 0.02) {
        const vScale = 150;
        const vLength = osc.velocity * vScale;
        const arrowY = springY - 40;

        ctx.beginPath();
        ctx.moveTo(osc.x, arrowY);
        ctx.lineTo(osc.x + vLength, arrowY);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Arrowhead
        if (Math.abs(vLength) > 5) {
          const dir = osc.velocity > 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(osc.x + vLength, arrowY);
          ctx.lineTo(osc.x + vLength - dir * 8, arrowY - 4);
          ctx.lineTo(osc.x + vLength - dir * 8, arrowY + 4);
          ctx.closePath();
          ctx.fillStyle = "#ef4444";
          ctx.fill();
        }

        // Velocity label
        ctx.fillStyle = "#ef4444";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`v = ${osc.velocity.toFixed(2)} m/s`, osc.x + vLength/2, arrowY - 8);
      }
    });

    // Equilibrium positions
    const eqPositions = [wallX + equilibriumSpacing, wallX + 2 * equilibriumSpacing];
    eqPositions.forEach((pos, i) => {
      ctx.strokeStyle = "rgba(156, 163, 175, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pos, springY - 60);
      ctx.lineTo(pos, springY + 60);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Spring constants labels
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`k₁=${k1}`, wallX + equilibriumSpacing/2, springY + 50);
    ctx.fillText(`k₂=${k2}`, wallX + 1.5*equilibriumSpacing, springY + 50);
    ctx.fillText(`k₃=${k3}`, wallX + 2.5*equilibriumSpacing, springY + 50);
  }

  function drawSpring(x1: number, y: number, x2: number, coils: number, color: string): void {
    const springLength = x2 - x1;
    const coilWidth = 15;
    const steps = coils * 4;

    ctx.beginPath();
    ctx.moveTo(x1, y);

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + t * springLength;
      const coilPhase = (i % 4) * Math.PI / 2;
      const springY = y + Math.sin(coilPhase) * coilWidth;
      ctx.lineTo(x, springY);
    }

    ctx.lineTo(x2, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawPositionGraph(): void {
    const graphX = width * 0.05;
    const graphY = height * 0.6;
    const graphW = width * 0.4;
    const graphH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(graphX, graphY, graphW, graphH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Position vs Time", graphX + graphW/2, graphY + 18);

    if (positionHistory.length < 2) return;

    // Plot area
    const plotX = graphX + 40;
    const plotY = graphY + 25;
    const plotW = graphW - 60;
    const plotH = graphH - 40;

    // Find ranges
    const timeRange = Math.max(5, positionHistory[positionHistory.length - 1].time - positionHistory[0].time);
    let maxPos = 0;
    positionHistory.forEach(entry => {
      maxPos = Math.max(maxPos, Math.abs(entry.pos1), Math.abs(entry.pos2));
    });
    maxPos = Math.max(0.05, maxPos * 1.1);

    // Grid
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = plotY + (i/4) * plotH;
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
    }
    ctx.stroke();

    // Plot position curves
    function plotCurve(getData: (entry: any) => number, color: string, label: string): void {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      for (let i = 0; i < positionHistory.length; i++) {
        const entry = positionHistory[i];
        const value = getData(entry);
        const screenX = plotX + ((entry.time - positionHistory[0].time) / timeRange) * plotW;
        const screenY = plotY + plotH/2 - (value / maxPos) * plotH/2;

        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, plotX, plotY - 8 + (label === "x₁" ? 0 : 12));
    }

    plotCurve(entry => entry.pos1, "#3b82f6", "x₁");
    plotCurve(entry => entry.pos2, "#10b981", "x₂");

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time (s)", plotX + plotW/2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(plotX - 25, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Position (m)", 0, 0);
    ctx.restore();
  }

  function drawNormalModes(): void {
    if (!showModes) return;

    const modesX = width * 0.55;
    const modesY = height * 0.05;
    const modesW = width * 0.4;
    const modesH = height * 0.4;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(modesX, modesY, modesW, modesH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Normal Modes", modesX + modesW/2, modesY + 20);

    normalModes.forEach((mode, index) => {
      const modeY = modesY + 50 + index * 120;
      
      // Mode name and frequency
      ctx.fillStyle = index === 0 ? "#3b82f6" : "#ef4444";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(mode.name, modesX + 15, modeY);
      
      ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(`ω = ${mode.frequency.toFixed(2)} rad/s`, modesX + 15, modeY + 18);
      ctx.fillText(`f = ${(mode.frequency / (2*Math.PI)).toFixed(2)} Hz`, modesX + 15, modeY + 32);
      ctx.fillText(`T = ${mode.frequency > 0 ? (2*Math.PI/mode.frequency).toFixed(2) : '∞'} s`, modesX + 15, modeY + 46);

      // Mode visualization
      const vizX = modesX + 200;
      const vizY = modeY + 25;
      const spacing = 60;

      // Mode masses (relative positions)
      const maxAmplitude = Math.max(Math.abs(mode.amplitude1), Math.abs(mode.amplitude2));
      const scale = 30 / (maxAmplitude || 1);
      
      const pos1 = mode.amplitude1 * scale;
      const pos2 = mode.amplitude2 * scale;

      // Springs
      drawSpring(vizX - spacing, vizY, vizX + pos1 - 10, 8, "#64748b");
      drawSpring(vizX + pos1 + 10, vizY, vizX + spacing + pos2 - 10, 8, "#64748b");

      // Masses
      ctx.fillStyle = index === 0 ? "#3b82f6" : "#ef4444";
      ctx.beginPath();
      ctx.roundRect(vizX + pos1 - 10, vizY - 8, 20, 16, 4);
      ctx.fill();
      
      ctx.beginPath();
      ctx.roundRect(vizX + spacing + pos2 - 10, vizY - 8, 20, 16, 4);
      ctx.fill();

      // Amplitude values
      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`A₁=${mode.amplitude1.toFixed(2)}`, vizX + pos1, vizY + 25);
      ctx.fillText(`A₂=${mode.amplitude2.toFixed(2)}`, vizX + spacing + pos2, vizY + 25);
    });

    // Mode superposition info
    if (normalModes[0].frequency > 0 && normalModes[1].frequency > 0) {
      const beatFreq = Math.abs(normalModes[1].frequency - normalModes[0].frequency) / (2 * Math.PI);
      
      ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Beat frequency: ${beatFreq.toFixed(2)} Hz`, modesX + 15, modesY + modesH - 45);
      ctx.fillText(`Beat period: ${beatFreq > 0 ? (1/beatFreq).toFixed(1) : '∞'} s`, modesX + 15, modesY + modesH - 25);
    }
  }

  function drawEnergy(): void {
    if (!showEnergy) return;

    const energyX = width * 0.55;
    const energyY = height * 0.55;
    const energyW = width * 0.4;
    const energyH = height * 0.35;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(energyX, energyY, energyW, energyH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy Distribution", energyX + energyW/2, energyY + 20);

    if (energyHistory.length < 2) return;

    // Plot area
    const plotX = energyX + 40;
    const plotY = energyY + 30;
    const plotW = energyW - 60;
    const plotH = energyH - 60;

    // Find energy range
    let maxEnergy = 0;
    energyHistory.forEach(entry => {
      const total = entry.ke1 + entry.ke2 + entry.pe;
      maxEnergy = Math.max(maxEnergy, total);
    });
    maxEnergy = Math.max(0.01, maxEnergy * 1.1);

    const timeRange = Math.max(5, energyHistory[energyHistory.length - 1].time - energyHistory[0].time);

    // Plot energy curves
    function plotEnergy(getData: (entry: any) => number, color: string, label: string): void {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      for (let i = 0; i < energyHistory.length; i++) {
        const entry = energyHistory[i];
        const energy = getData(entry);
        const screenX = plotX + ((entry.time - energyHistory[0].time) / timeRange) * plotW;
        const screenY = plotY + plotH - (energy / maxEnergy) * plotH;

        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = color;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, plotX, plotY - 8 + (label === "KE₁" ? 0 : (label === "KE₂" ? 12 : 24)));
    }

    plotEnergy(entry => entry.ke1, "#3b82f6", "KE₁");
    plotEnergy(entry => entry.ke2, "#10b981", "KE₂");
    plotEnergy(entry => entry.pe, "#f59e0b", "PE");
    plotEnergy(entry => entry.ke1 + entry.ke2 + entry.pe, "#e2e8f0", "Total");

    // Current energy values
    if (energyHistory.length > 0) {
      const current = energyHistory[energyHistory.length - 1];
      const total = current.ke1 + current.ke2 + current.pe;

      ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      
      const lines = [
        `KE₁: ${current.ke1.toFixed(4)} J`,
        `KE₂: ${current.ke2.toFixed(4)} J`,
        `PE: ${current.pe.toFixed(4)} J`,
        `Total: ${total.toFixed(4)} J`
      ];

      lines.forEach((line, i) => {
        ctx.fillText(line, energyX + 15, energyY + energyH - 60 + i * 15);
      });
    }
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Draw components
    drawSystem();
    drawPositionGraph();
    drawNormalModes();
    drawEnergy();

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = `bold ${Math.max(18, width * 0.028)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Coupled Oscillators", width/2, 30);

    // Subtitle
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = `${Math.max(12, width * 0.018)}px system-ui, sans-serif`;
    ctx.fillText("Normal Modes & Energy Transfer", width/2, 50);

    // Time display
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(2)} s`, 20, height - 15);
  }

  function reset(): void {
    resetSystem();
  }

  function destroy(): void {
    positionHistory = [];
    energyHistory = [];
  }

  function getStateDescription(): string {
    const totalKE = energyHistory.length > 0 ? energyHistory[energyHistory.length - 1].ke1 + energyHistory[energyHistory.length - 1].ke2 : 0;
    const totalPE = energyHistory.length > 0 ? energyHistory[energyHistory.length - 1].pe : 0;
    const totalEnergy = totalKE + totalPE;

    return (
      `Coupled Oscillators: m₁=${mass1}kg, m₂=${mass2}kg, k₁=${k1}N/m, k₂=${k2}N/m, k₃=${k3}N/m. ` +
      `Normal modes: ω₁=${normalModes[0].frequency.toFixed(2)}rad/s, ω₂=${normalModes[1].frequency.toFixed(2)}rad/s. ` +
      `Current: x₁=${oscillators[0].position.toFixed(3)}m, x₂=${oscillators[1].position.toFixed(3)}m. ` +
      `Velocities: v₁=${oscillators[0].velocity.toFixed(3)}m/s, v₂=${oscillators[1].velocity.toFixed(3)}m/s. ` +
      `Energy: Total=${totalEnergy.toFixed(4)}J (KE=${totalKE.toFixed(4)}J, PE=${totalPE.toFixed(4)}J). ` +
      `Demonstrates mode superposition, beat phenomena, and energy exchange between oscillators.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    wallX = width * 0.15;
    equilibriumSpacing = width * 0.25;
    
    oscillators[0].x = wallX + equilibriumSpacing;
    oscillators[0].y = height * 0.4;
    oscillators[1].x = wallX + 2 * equilibriumSpacing;
    oscillators[1].y = height * 0.4;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CoupledOscillatorsFactory;