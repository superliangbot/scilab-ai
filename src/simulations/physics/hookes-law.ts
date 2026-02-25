import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Hooke's Law: F = -kx
 * Interactive demonstration of spring force, showing:
 * - Linear relationship between displacement and force
 * - Elastic potential energy: PE = ½kx²
 * - Oscillatory motion when released
 * - Force vectors and energy conservation
 */

const HookesLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("hookes-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical parameters
  let springConstant = 50; // N/m
  let mass = 1.0; // kg
  let damping = 0.05; // damping coefficient
  let showVectors = 1;

  // State variables
  let position = 0; // displacement from equilibrium (meters)
  let velocity = 0; // m/s
  let isDragging = false;
  let equilibriumX = 0; // equilibrium position on screen

  // Animation trails
  let forceHistory: number[] = [];
  let energyHistory: number[] = [];
  const MAX_HISTORY = 100;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    equilibriumX = width * 0.5;
    position = 0;
    velocity = 0;
    forceHistory = [];
    energyHistory = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    springConstant = params.springConstant ?? 50;
    mass = params.mass ?? 1.0;
    damping = params.damping ?? 0.05;
    showVectors = params.showVectors ?? 1;

    if (!isDragging) {
      // Physics simulation using Hooke's Law: F = -kx
      const springForce = -springConstant * position;
      const dampingForce = -damping * velocity;
      const totalForce = springForce + dampingForce;

      // F = ma => a = F/m
      const acceleration = totalForce / mass;

      // Euler integration
      const step = Math.min(dt, 0.016); // cap timestep
      velocity += acceleration * step;
      position += velocity * step;

      // Record history
      forceHistory.push(springForce);
      energyHistory.push(0.5 * springConstant * position * position);
      if (forceHistory.length > MAX_HISTORY) forceHistory.shift();
      if (energyHistory.length > MAX_HISTORY) energyHistory.shift();
    }

    time += dt;
  }

  function drawSpring(x1: number, y: number, x2: number, coils: number = 12): void {
    ctx.beginPath();
    ctx.moveTo(x1, y);

    const springLength = x2 - x1;
    const coilWidth = Math.min(30, Math.abs(springLength) / coils * 0.8);
    const steps = coils * 4; // 4 points per coil

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + t * springLength;
      const coilPhase = (i % 4) * Math.PI / 2;
      const coilY = y + Math.sin(coilPhase) * coilWidth;
      ctx.lineTo(x, coilY);
    }

    ctx.lineTo(x2, y);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawMass(x: number, y: number): void {
    const massSize = 30 + mass * 10; // size proportional to mass

    // Mass shadow
    ctx.beginPath();
    ctx.rect(x - massSize/2 + 3, y - massSize/2 + 3, massSize, massSize);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fill();

    // Main mass
    const grad = ctx.createLinearGradient(x - massSize/2, y - massSize/2, x + massSize/2, y + massSize/2);
    grad.addColorStop(0, "#3b82f6");
    grad.addColorStop(1, "#1e40af");

    ctx.beginPath();
    ctx.roundRect(x - massSize/2, y - massSize/2, massSize, massSize, 6);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mass label
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(10, massSize * 0.25)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mass}kg`, x, y);
  }

  function drawForceVector(x: number, y: number, force: number): void {
    if (!showVectors || Math.abs(force) < 0.1) return;

    const scale = 2; // pixels per Newton
    const arrowLength = force * scale;
    const arrowX = x + arrowLength;

    // Force arrow
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(arrowX, y);
    ctx.strokeStyle = force > 0 ? "#ef4444" : "#10b981";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Arrowhead
    if (Math.abs(arrowLength) > 10) {
      const dir = force > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(arrowX, y);
      ctx.lineTo(arrowX - dir * 10, y - 6);
      ctx.lineTo(arrowX - dir * 10, y + 6);
      ctx.closePath();
      ctx.fillStyle = force > 0 ? "#ef4444" : "#10b981";
      ctx.fill();
    }

    // Force magnitude label
    ctx.fillStyle = force > 0 ? "#ef4444" : "#10b981";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = force > 0 ? "left" : "right";
    ctx.fillText(`F = ${force.toFixed(1)}N`, arrowX + (force > 0 ? 5 : -5), y - 15);
  }

  function drawGraph(): void {
    const graphX = width * 0.05;
    const graphY = height * 0.05;
    const graphW = width * 0.25;
    const graphH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(graphX, graphY, graphW, graphH, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Force vs Displacement", graphX + graphW/2, graphY + 18);

    // Axes
    const plotX = graphX + 30;
    const plotY = graphY + 30;
    const plotW = graphW - 50;
    const plotH = graphH - 50;

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.moveTo(plotX + plotW/2, plotY);
    ctx.lineTo(plotX + plotW/2, plotY + plotH);
    ctx.stroke();

    // Plot F = -kx line
    const maxDisp = 0.2; // meters
    ctx.beginPath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    for (let i = 0; i <= plotW; i += 2) {
      const x = (i / plotW - 0.5) * 2 * maxDisp;
      const force = -springConstant * x;
      const screenX = plotX + i;
      const maxForce = springConstant * maxDisp;
      const screenY = plotY + plotH/2 - (force / maxForce) * plotH/2;
      if (i === 0) ctx.moveTo(screenX, screenY);
      else ctx.lineTo(screenX, screenY);
    }
    ctx.stroke();

    // Current position marker
    const currentX = plotX + plotW/2 + (position / maxDisp) * plotW/2;
    const currentForce = -springConstant * position;
    const maxForce = springConstant * maxDisp;
    const currentY = plotY + plotH/2 - (currentForce / maxForce) * plotH/2;

    ctx.beginPath();
    ctx.arc(currentX, currentY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // Labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("x", plotX + plotW/2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(plotX - 15, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("F", 0, 0);
    ctx.restore();
  }

  function drawEnergyBar(): void {
    const barX = width * 0.05;
    const barY = height * 0.35;
    const barW = width * 0.25;
    const barH = height * 0.15;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy", barX + barW/2, barY + 18);

    // Calculate energies
    const kineticEnergy = 0.5 * mass * velocity * velocity;
    const potentialEnergy = 0.5 * springConstant * position * position;
    const totalEnergy = kineticEnergy + potentialEnergy;

    const maxE = Math.max(20, totalEnergy * 1.2); // J

    // Energy bars
    const barInnerH = barH - 50;
    const keHeight = (kineticEnergy / maxE) * barInnerH;
    const peHeight = (potentialEnergy / maxE) * barInnerH;

    // Kinetic energy bar
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(barX + 20, barY + barH - 15 - keHeight, 30, keHeight);
    
    // Potential energy bar  
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(barX + 60, barY + barH - 15 - peHeight, 30, peHeight);

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("KE", barX + 35, barY + barH - 5);
    ctx.fillText("PE", barX + 75, barY + barH - 5);
    
    // Values
    ctx.textAlign = "left";
    ctx.fillText(`KE: ${kineticEnergy.toFixed(1)}J`, barX + 100, barY + 35);
    ctx.fillText(`PE: ${potentialEnergy.toFixed(1)}J`, barX + 100, barY + 50);
    ctx.fillText(`Total: ${totalEnergy.toFixed(1)}J`, barX + 100, barY + 65);
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Main simulation area
    const simY = height * 0.5;
    const wallX = width * 0.4;
    const pixelsPerMeter = 200; // screen pixels per meter
    const massX = equilibriumX + position * pixelsPerMeter;

    // Wall
    ctx.fillStyle = "#374151";
    ctx.fillRect(wallX - 15, simY - 100, 15, 200);
    
    // Wall shading
    const wallGrad = ctx.createLinearGradient(wallX - 15, 0, wallX, 0);
    wallGrad.addColorStop(0, "#6b7280");
    wallGrad.addColorStop(1, "#374151");
    ctx.fillStyle = wallGrad;
    ctx.fillRect(wallX - 15, simY - 100, 15, 200);

    // Draw spring
    drawSpring(wallX, simY, massX, 10);

    // Draw mass
    drawMass(massX, simY);

    // Draw force vector
    const springForce = -springConstant * position;
    drawForceVector(massX, simY - 50, springForce);

    // Equilibrium line
    ctx.strokeStyle = "rgba(156, 163, 175, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(equilibriumX, simY - 80);
    ctx.lineTo(equilibriumX, simY + 80);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw analysis panels
    drawGraph();
    drawEnergyBar();

    // Physics equations
    ctx.fillStyle = "rgba(226, 232, 240, 0.6)";
    ctx.font = `${Math.max(12, width * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Hooke's Law: F = -kx", width * 0.7, height * 0.15);
    ctx.fillText(`k = ${springConstant} N/m`, width * 0.7, height * 0.18);

    // Current values
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "left";
    const infoX = width * 0.65;
    ctx.fillText(`Position: x = ${position.toFixed(3)} m`, infoX, height * 0.25);
    ctx.fillText(`Velocity: v = ${velocity.toFixed(3)} m/s`, infoX, height * 0.28);
    ctx.fillText(`Force: F = ${springForce.toFixed(1)} N`, infoX, height * 0.31);
    ctx.fillText(`Period: T = ${(2 * Math.PI * Math.sqrt(mass / springConstant)).toFixed(2)} s`, infoX, height * 0.34);

    // Instructions
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Drag the mass to stretch the spring", width/2, height - 25);
  }

  function reset(): void {
    time = 0;
    position = 0;
    velocity = 0;
    forceHistory = [];
    energyHistory = [];
  }

  function destroy(): void {
    forceHistory = [];
    energyHistory = [];
  }

  function getStateDescription(): string {
    const springForce = -springConstant * position;
    const period = 2 * Math.PI * Math.sqrt(mass / springConstant);
    const kineticEnergy = 0.5 * mass * velocity * velocity;
    const potentialEnergy = 0.5 * springConstant * position * position;

    return (
      `Hooke's Law: k=${springConstant} N/m, m=${mass} kg. ` +
      `Current: x=${position.toFixed(3)} m, v=${velocity.toFixed(3)} m/s, F=${springForce.toFixed(1)} N. ` +
      `Period T=${period.toFixed(2)} s. ` +
      `Energy: KE=${kineticEnergy.toFixed(1)} J, PE=${potentialEnergy.toFixed(1)} J, ` +
      `Total=${(kineticEnergy + potentialEnergy).toFixed(1)} J. ` +
      `Linear restoring force demonstrates fundamental harmonic motion.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    equilibriumX = width * 0.5;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default HookesLawFactory;