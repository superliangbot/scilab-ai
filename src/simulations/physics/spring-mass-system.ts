import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Spring-Mass System with Damping
 * Advanced oscillator showing:
 * - Underdamped, critically damped, and overdamped motion
 * - Quality factor and damping coefficient effects
 * - Energy dissipation over time
 * - Phase space plots (position vs velocity)
 */

interface OscillatorState {
  position: number;
  velocity: number;
  time: number;
}

const SpringMassSystemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spring-mass-system") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical parameters
  let mass = 1.0; // kg
  let springConstant = 25; // N/m
  let dampingCoeff = 0.5; // N·s/m
  let initialDisp = 0.15; // initial displacement (m)
  let showPhaseSpace = 1;

  // System state
  let position = 0;
  let velocity = 0;

  // Derived quantities
  let omega0 = 0; // natural frequency
  let gamma = 0; // damping parameter
  let omegaD = 0; // damped frequency
  let zeta = 0; // damping ratio
  let dampingType = ""; // underdamped/critical/overdamped

  // History tracking
  let stateHistory: OscillatorState[] = [];
  let phaseHistory: Array<{x: number, v: number}> = [];
  const MAX_HISTORY = 300;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    position = initialDisp;
    velocity = 0;
    stateHistory = [];
    phaseHistory = [];
    updateDerivedQuantities();
  }

  function updateDerivedQuantities(): void {
    omega0 = Math.sqrt(springConstant / mass);
    gamma = dampingCoeff / (2 * mass);
    zeta = gamma / omega0;
    
    if (zeta < 1) {
      // Underdamped
      omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      dampingType = "Underdamped";
    } else if (zeta === 1) {
      // Critically damped
      omegaD = 0;
      dampingType = "Critically Damped";
    } else {
      // Overdamped
      omegaD = omega0 * Math.sqrt(zeta * zeta - 1);
      dampingType = "Overdamped";
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    const newMass = params.mass ?? 1.0;
    const newK = params.springConstant ?? 25;
    const newDamping = params.dampingCoeff ?? 0.5;
    const newInitDisp = params.initialDisp ?? 0.15;
    showPhaseSpace = params.showPhaseSpace ?? 1;

    // Check if parameters changed
    if (newMass !== mass || newK !== springConstant || newDamping !== dampingCoeff || newInitDisp !== initialDisp) {
      mass = newMass;
      springConstant = newK;
      dampingCoeff = newDamping;
      initialDisp = newInitDisp;
      updateDerivedQuantities();
      
      // Reset simulation
      time = 0;
      position = initialDisp;
      velocity = 0;
      stateHistory = [];
      phaseHistory = [];
    }

    // Physics integration using RK4 for accuracy
    const step = Math.min(dt, 0.01);
    
    function derivatives(x: number, v: number): {dx: number, dv: number} {
      const springForce = -springConstant * x;
      const dampingForce = -dampingCoeff * v;
      const acceleration = (springForce + dampingForce) / mass;
      return { dx: v, dv: acceleration };
    }

    // RK4 integration
    const k1 = derivatives(position, velocity);
    const k2 = derivatives(position + k1.dx * step/2, velocity + k1.dv * step/2);
    const k3 = derivatives(position + k2.dx * step/2, velocity + k2.dv * step/2);
    const k4 = derivatives(position + k3.dx * step, velocity + k3.dv * step);

    position += (step/6) * (k1.dx + 2*k2.dx + 2*k3.dx + k4.dx);
    velocity += (step/6) * (k1.dv + 2*k2.dv + 2*k3.dv + k4.dv);

    time += step;

    // Record history
    stateHistory.push({ position, velocity, time });
    phaseHistory.push({ x: position, v: velocity });
    
    if (stateHistory.length > MAX_HISTORY) stateHistory.shift();
    if (phaseHistory.length > MAX_HISTORY) phaseHistory.shift();
  }

  function getAnalyticalSolution(t: number): {x: number, v: number} {
    const A = initialDisp; // initial displacement
    const v0 = 0; // initial velocity
    
    if (zeta < 1) {
      // Underdamped: x(t) = A * e^(-γt) * cos(ωD*t + φ)
      const envelope = A * Math.exp(-gamma * t);
      const phase = Math.atan2(gamma * A, omegaD * A);
      const x = envelope * Math.cos(omegaD * t + phase);
      const v = -envelope * (gamma * Math.cos(omegaD * t + phase) + omegaD * Math.sin(omegaD * t + phase));
      return { x, v };
    } else if (zeta === 1) {
      // Critically damped: x(t) = (A + v0*t) * e^(-γt)
      const x = (A + v0 * t) * Math.exp(-gamma * t);
      const v = (v0 - gamma * (A + v0 * t)) * Math.exp(-gamma * t);
      return { x, v };
    } else {
      // Overdamped: x(t) = A * e^(-γt) * cosh(ωD*t)
      const envelope = A * Math.exp(-gamma * t);
      const x = envelope * Math.cosh(omegaD * t);
      const v = envelope * (-gamma * Math.cosh(omegaD * t) + omegaD * Math.sinh(omegaD * t));
      return { x, v };
    }
  }

  function drawOscillator(): void {
    const oscY = height * 0.25;
    const centerX = width * 0.3;
    const pixelsPerMeter = 400;
    const massX = centerX + position * pixelsPerMeter;

    // Wall
    ctx.fillStyle = "#374151";
    ctx.fillRect(centerX - 150, oscY - 60, 20, 120);

    // Spring
    const springCoils = 12;
    const springLength = Math.abs(massX - (centerX - 130));
    const coilWidth = 20;

    ctx.beginPath();
    ctx.moveTo(centerX - 130, oscY);
    
    for (let i = 1; i < springCoils * 4; i++) {
      const t = i / (springCoils * 4);
      const x = centerX - 130 + t * springLength;
      const coilPhase = (i % 4) * Math.PI / 2;
      const y = oscY + Math.sin(coilPhase) * coilWidth;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(massX, oscY);

    const springColor = position > 0 ? "#ef4444" : "#3b82f6";
    ctx.strokeStyle = springColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Mass
    const massSize = 25;
    const massGrad = ctx.createRadialGradient(massX - 5, oscY - 5, 0, massX, oscY, massSize);
    massGrad.addColorStop(0, "#fbbf24");
    massGrad.addColorStop(1, "#d97706");

    ctx.beginPath();
    ctx.roundRect(massX - massSize, oscY - massSize, massSize * 2, massSize * 2, 6);
    ctx.fillStyle = massGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mass label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${mass}kg`, massX, oscY + 5);

    // Velocity arrow
    if (Math.abs(velocity) > 0.01) {
      const vScale = 100;
      const vLength = velocity * vScale;
      
      ctx.beginPath();
      ctx.moveTo(massX, oscY - 40);
      ctx.lineTo(massX + vLength, oscY - 40);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.stroke();

      if (Math.abs(vLength) > 5) {
        const dir = velocity > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(massX + vLength, oscY - 40);
        ctx.lineTo(massX + vLength - dir * 8, oscY - 45);
        ctx.lineTo(massX + vLength - dir * 8, oscY - 35);
        ctx.closePath();
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      }

      ctx.fillStyle = "#ef4444";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`v = ${velocity.toFixed(2)} m/s`, massX + vLength/2, oscY - 50);
    }

    // Position indicator
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`x = ${position.toFixed(3)} m`, massX, oscY + 45);
  }

  function drawTimeGraph(): void {
    const graphX = width * 0.05;
    const graphY = height * 0.45;
    const graphW = width * 0.4;
    const graphH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.roundRect(graphX, graphY, graphW, graphH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${dampingType} Motion`, graphX + graphW/2, graphY + 15);

    // Plot area
    const plotX = graphX + 35;
    const plotY = graphY + 25;
    const plotW = graphW - 50;
    const plotH = graphH - 40;

    // Grid
    ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = plotY + (i / gridLines) * plotH;
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
    }
    ctx.stroke();

    // Plot numerical solution
    if (stateHistory.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;

      const maxTime = Math.max(5, time);
      const maxPos = Math.max(0.2, initialDisp * 1.2);

      for (let i = 0; i < stateHistory.length; i++) {
        const state = stateHistory[i];
        const screenX = plotX + (state.time / maxTime) * plotW;
        const screenY = plotY + plotH/2 - (state.position / maxPos) * plotH/2;
        
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
    }

    // Plot analytical solution for comparison
    if (time > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);

      const maxTime = Math.max(5, time);
      const maxPos = Math.max(0.2, initialDisp * 1.2);
      const steps = 100;

      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * maxTime;
        const analytical = getAnalyticalSolution(t);
        const screenX = plotX + (t / maxTime) * plotW;
        const screenY = plotY + plotH/2 - (analytical.x / maxPos) * plotH/2;
        
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Envelope for underdamped case
    if (zeta < 1 && time > 0) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();

      const maxTime = Math.max(5, time);
      const maxPos = Math.max(0.2, initialDisp * 1.2);
      const steps = 50;

      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * maxTime;
        const envelope = initialDisp * Math.exp(-gamma * t);
        const screenX = plotX + (t / maxTime) * plotW;
        const screenY = plotY + plotH/2 - (envelope / maxPos) * plotH/2;
        
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      
      for (let i = steps; i >= 0; i--) {
        const t = (i / steps) * maxTime;
        const envelope = -initialDisp * Math.exp(-gamma * t);
        const screenX = plotX + (t / maxTime) * plotW;
        const screenY = plotY + plotH/2 - (envelope / maxPos) * plotH/2;
        ctx.lineTo(screenX, screenY);
      }
      
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Legend
    ctx.fillStyle = "#3b82f6";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Numerical", plotX, plotY - 8);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Analytical", plotX + 60, plotY - 8);
  }

  function drawPhaseSpace(): void {
    if (!showPhaseSpace) return;

    const phaseX = width * 0.55;
    const phaseY = height * 0.45;
    const phaseW = width * 0.4;
    const phaseH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.roundRect(phaseX, phaseY, phaseW, phaseH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Phase Space (v vs x)", phaseX + phaseW/2, phaseY + 15);

    // Plot area
    const plotX = phaseX + 35;
    const plotY = phaseY + 25;
    const plotW = phaseW - 50;
    const plotH = phaseH - 40;

    // Axes
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH/2);
    ctx.lineTo(plotX + plotW, plotY + plotH/2);
    ctx.moveTo(plotX + plotW/2, plotY);
    ctx.lineTo(plotX + plotW/2, plotY + plotH);
    ctx.stroke();

    // Plot phase trajectory
    if (phaseHistory.length > 1) {
      const maxPos = Math.max(0.2, initialDisp * 1.2);
      const maxVel = Math.max(0.5, initialDisp * omega0 * 1.2);

      // Trail (fading)
      for (let i = 1; i < phaseHistory.length; i++) {
        const point = phaseHistory[i];
        const alpha = (i / phaseHistory.length) * 0.6;
        
        const screenX = plotX + plotW/2 + (point.x / maxPos) * plotW/2;
        const screenY = plotY + plotH/2 - (point.v / maxVel) * plotH/2;
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.fill();
      }

      // Current point
      if (phaseHistory.length > 0) {
        const current = phaseHistory[phaseHistory.length - 1];
        const screenX = plotX + plotW/2 + (current.x / maxPos) * plotW/2;
        const screenY = plotY + plotH/2 - (current.v / maxVel) * plotH/2;
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      }
    }

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Position (m)", plotX + plotW/2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(plotX - 20, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Velocity (m/s)", 0, 0);
    ctx.restore();
  }

  function drawParameters(): void {
    const paramX = width * 0.05;
    const paramY = height * 0.75;

    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";

    const lines = [
      `Mass m = ${mass.toFixed(1)} kg`,
      `Spring k = ${springConstant.toFixed(1)} N/m`,
      `Damping c = ${dampingCoeff.toFixed(2)} N·s/m`,
      `Natural frequency ω₀ = ${omega0.toFixed(2)} rad/s`,
      `Damping ratio ζ = ${zeta.toFixed(3)}`,
      `Quality factor Q = ${(1/(2*zeta)).toFixed(1)}`,
      zeta < 1 ? `Damped frequency ωD = ${omegaD.toFixed(2)} rad/s` : "",
    ].filter(Boolean);

    lines.forEach((line, i) => {
      ctx.fillText(line, paramX, paramY + i * 18);
    });
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Draw components
    drawOscillator();
    drawTimeGraph();
    drawPhaseSpace();
    drawParameters();

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Damped Spring-Mass System", width/2, 25);

    // Time
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`t = ${time.toFixed(2)} s`, width - 20, height - 10);

    // Energy calculation
    const kineticEnergy = 0.5 * mass * velocity * velocity;
    const potentialEnergy = 0.5 * springConstant * position * position;
    const totalEnergy = kineticEnergy + potentialEnergy;

    ctx.textAlign = "left";
    ctx.fillText(`Energy: KE = ${kineticEnergy.toFixed(3)} J, PE = ${potentialEnergy.toFixed(3)} J, Total = ${totalEnergy.toFixed(3)} J`, 20, height - 10);
  }

  function reset(): void {
    time = 0;
    position = initialDisp;
    velocity = 0;
    stateHistory = [];
    phaseHistory = [];
  }

  function destroy(): void {
    stateHistory = [];
    phaseHistory = [];
  }

  function getStateDescription(): string {
    const kineticEnergy = 0.5 * mass * velocity * velocity;
    const potentialEnergy = 0.5 * springConstant * position * position;
    
    return (
      `Damped Spring-Mass System: m=${mass}kg, k=${springConstant} N/m, c=${dampingCoeff} N·s/m. ` +
      `ζ=${zeta.toFixed(3)} (${dampingType}), ω₀=${omega0.toFixed(2)} rad/s. ` +
      `Current: t=${time.toFixed(2)}s, x=${position.toFixed(4)}m, v=${velocity.toFixed(4)}m/s. ` +
      `Energy: KE=${kineticEnergy.toFixed(3)}J, PE=${potentialEnergy.toFixed(3)}J. ` +
      `Demonstrates oscillatory behavior with energy dissipation through damping.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpringMassSystemFactory;