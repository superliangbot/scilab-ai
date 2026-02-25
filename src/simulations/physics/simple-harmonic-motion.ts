import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Simple Harmonic Motion: x(t) = A·cos(ωt + φ)
 * Comprehensive demonstration showing:
 * - Position, velocity, and acceleration vs time
 * - Energy conservation (KE ↔ PE)
 * - Phase relationships between x, v, and a
 * - Phasor diagram (rotating vector representation)
 */

const SimpleHarmonicMotionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("simple-harmonic-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let amplitude = 0.1; // meters
  let frequency = 1.0; // Hz
  let phaseShift = 0; // radians
  let showVelocity = 1;
  let showAcceleration = 1;

  // Derived quantities
  let omega = 0; // angular frequency (rad/s)
  let period = 0; // period (s)

  // History for graphs
  let positionHistory: Array<{t: number, x: number}> = [];
  let velocityHistory: Array<{t: number, v: number}> = [];
  let accelerationHistory: Array<{t: number, a: number}> = [];
  const MAX_HISTORY_TIME = 8; // seconds

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    positionHistory = [];
    velocityHistory = [];
    accelerationHistory = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    amplitude = params.amplitude ?? 0.1;
    frequency = params.frequency ?? 1.0;
    phaseShift = (params.phaseShift ?? 0) * Math.PI / 180; // convert degrees to radians
    showVelocity = params.showVelocity ?? 1;
    showAcceleration = params.showAcceleration ?? 1;

    omega = 2 * Math.PI * frequency;
    period = 1 / frequency;

    time += dt;

    // Calculate SHM quantities at current time
    const position = amplitude * Math.cos(omega * time + phaseShift);
    const velocity = -amplitude * omega * Math.sin(omega * time + phaseShift);
    const acceleration = -amplitude * omega * omega * Math.cos(omega * time + phaseShift);

    // Record history
    const now = { t: time, x: position };
    const nowV = { t: time, v: velocity };
    const nowA = { t: time, a: acceleration };

    positionHistory.push(now);
    velocityHistory.push(nowV);
    accelerationHistory.push(nowA);

    // Trim old history
    const cutoff = time - MAX_HISTORY_TIME;
    positionHistory = positionHistory.filter(p => p.t > cutoff);
    velocityHistory = velocityHistory.filter(v => v.t > cutoff);
    accelerationHistory = accelerationHistory.filter(a => a.t > cutoff);
  }

  function getCurrentValues() {
    const position = amplitude * Math.cos(omega * time + phaseShift);
    const velocity = -amplitude * omega * Math.sin(omega * time + phaseShift);
    const acceleration = -amplitude * omega * omega * Math.cos(omega * time + phaseShift);
    
    return { position, velocity, acceleration };
  }

  function drawOscillator(): void {
    const oscY = height * 0.2;
    const centerX = width * 0.5;
    const pixelsPerMeter = 800; // visual scale
    
    const { position, velocity, acceleration } = getCurrentValues();
    const massX = centerX + position * pixelsPerMeter;

    // Reference line (equilibrium)
    ctx.strokeStyle = "rgba(156, 163, 175, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX, oscY - 30);
    ctx.lineTo(centerX, oscY + 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // Track line
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - amplitude * pixelsPerMeter - 20, oscY);
    ctx.lineTo(centerX + amplitude * pixelsPerMeter + 20, oscY);
    ctx.stroke();

    // Amplitude markers
    ctx.fillStyle = "rgba(156, 163, 175, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("-A", centerX - amplitude * pixelsPerMeter, oscY + 25);
    ctx.fillText("+A", centerX + amplitude * pixelsPerMeter, oscY + 25);
    ctx.fillText("0", centerX, oscY + 25);

    // Mass
    const massRadius = 15;
    const massGrad = ctx.createRadialGradient(massX - 5, oscY - 5, 0, massX, oscY, massRadius);
    massGrad.addColorStop(0, "#fbbf24");
    massGrad.addColorStop(1, "#d97706");

    ctx.beginPath();
    ctx.arc(massX, oscY, massRadius, 0, Math.PI * 2);
    ctx.fillStyle = massGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Velocity vector
    if (showVelocity && Math.abs(velocity) > 0.01) {
      const vScale = 150; // visual scale for velocity
      const vLength = velocity * vScale;
      
      ctx.beginPath();
      ctx.moveTo(massX, oscY - 35);
      ctx.lineTo(massX + vLength, oscY - 35);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrowhead
      if (Math.abs(vLength) > 5) {
        const dir = velocity > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(massX + vLength, oscY - 35);
        ctx.lineTo(massX + vLength - dir * 8, oscY - 40);
        ctx.lineTo(massX + vLength - dir * 8, oscY - 30);
        ctx.closePath();
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      }

      // Label
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = velocity > 0 ? "left" : "right";
      ctx.fillText(`v`, massX + vLength + (velocity > 0 ? 5 : -5), oscY - 40);
    }

    // Acceleration vector
    if (showAcceleration && Math.abs(acceleration) > 0.1) {
      const aScale = 60; // visual scale for acceleration
      const aLength = acceleration * aScale;
      
      ctx.beginPath();
      ctx.moveTo(massX, oscY + 35);
      ctx.lineTo(massX + aLength, oscY + 35);
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrowhead
      if (Math.abs(aLength) > 5) {
        const dir = acceleration > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(massX + aLength, oscY + 35);
        ctx.lineTo(massX + aLength - dir * 8, oscY + 30);
        ctx.lineTo(massX + aLength - dir * 8, oscY + 40);
        ctx.closePath();
        ctx.fillStyle = "#8b5cf6";
        ctx.fill();
      }

      // Label
      ctx.fillStyle = "#8b5cf6";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = acceleration > 0 ? "left" : "right";
      ctx.fillText(`a`, massX + aLength + (acceleration > 0 ? 5 : -5), oscY + 45);
    }
  }

  function drawGraphs(): void {
    const graphX = width * 0.05;
    const graphY = height * 0.35;
    const graphW = width * 0.4;
    const graphH = height * 0.55;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.roundRect(graphX, graphY, graphW, graphH, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Position, Velocity & Acceleration vs Time", graphX + graphW/2, graphY + 18);

    // Graph area
    const plotX = graphX + 40;
    const plotY = graphY + 35;
    const plotW = graphW - 60;
    const plotH = (graphH - 60) / 3;

    // Time axis
    const maxTime = Math.max(5, time + 1);
    const minTime = Math.max(0, time - MAX_HISTORY_TIME);
    const timeRange = maxTime - minTime;

    function plotGraph(data: Array<{t: number, x: number}>, yOffset: number, color: string, label: string, maxVal: number): void {
      const currentPlotY = plotY + yOffset * (plotH + 10);
      
      // Grid
      ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(plotX, currentPlotY);
      ctx.lineTo(plotX + plotW, currentPlotY);
      ctx.moveTo(plotX, currentPlotY + plotH/2);
      ctx.lineTo(plotX + plotW, currentPlotY + plotH/2);
      ctx.moveTo(plotX, currentPlotY + plotH);
      ctx.lineTo(plotX + plotW, currentPlotY + plotH);
      ctx.stroke();

      // Data line
      if (data.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        for (let i = 0; i < data.length; i++) {
          const point = data[i];
          const screenX = plotX + ((point.t - minTime) / timeRange) * plotW;
          const screenY = currentPlotY + plotH/2 - (point.x / maxVal) * plotH/2;
          
          if (i === 0) ctx.moveTo(screenX, screenY);
          else ctx.lineTo(screenX, screenY);
        }
        ctx.stroke();
      }

      // Labels
      ctx.fillStyle = color;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, plotX, currentPlotY - 5);

      // Y-axis values
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${maxVal.toFixed(2)}`, plotX - 5, currentPlotY + 3);
      ctx.fillText("0", plotX - 5, currentPlotY + plotH/2 + 3);
      ctx.fillText(`${(-maxVal).toFixed(2)}`, plotX - 5, currentPlotY + plotH + 3);
    }

    // Plot position, velocity, acceleration
    const maxPos = Math.max(amplitude * 1.1, 0.05);
    const maxVel = Math.max(amplitude * omega * 1.1, 0.1);
    const maxAcc = Math.max(amplitude * omega * omega * 1.1, 0.5);

    plotGraph(positionHistory, 0, "#fbbf24", "Position (m)", maxPos);
    if (showVelocity) plotGraph(velocityHistory, 1, "#ef4444", "Velocity (m/s)", maxVel);
    if (showAcceleration) plotGraph(accelerationHistory, 2, "#8b5cf6", "Acceleration (m/s²)", maxAcc);
  }

  function drawPhasorDiagram(): void {
    const phasorX = width * 0.75;
    const phasorY = height * 0.65;
    const radius = 80;

    // Background circle
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(phasorX, phasorY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Axes
    ctx.beginPath();
    ctx.moveTo(phasorX - radius - 10, phasorY);
    ctx.lineTo(phasorX + radius + 10, phasorY);
    ctx.moveTo(phasorX, phasorY - radius - 10);
    ctx.lineTo(phasorX, phasorY + radius + 10);
    ctx.stroke();

    // Phasor (rotating vector)
    const angle = omega * time + phaseShift;
    const endX = phasorX + radius * Math.cos(angle);
    const endY = phasorY - radius * Math.sin(angle); // negative for screen coordinates

    ctx.beginPath();
    ctx.moveTo(phasorX, phasorY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.arc(endX, endY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    // Projection lines
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX, phasorY);
    ctx.moveTo(endX, endY);
    ctx.lineTo(phasorX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Phasor Diagram", phasorX, phasorY - radius - 25);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText(`ω = ${omega.toFixed(2)} rad/s`, phasorX - radius, phasorY + radius + 20);
    ctx.fillText(`φ = ${(phaseShift * 180 / Math.PI).toFixed(0)}°`, phasorX - radius, phasorY + radius + 35);
  }

  function drawEquations(): void {
    const eqX = width * 0.55;
    const eqY = height * 0.35;

    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.font = `${Math.max(14, width * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "left";

    const { position, velocity, acceleration } = getCurrentValues();

    ctx.fillText("Simple Harmonic Motion", eqX, eqY);
    ctx.font = `${Math.max(12, width * 0.018)}px system-ui, sans-serif`;
    
    ctx.fillText(`x(t) = A cos(ωt + φ) = ${position.toFixed(4)} m`, eqX, eqY + 25);
    ctx.fillText(`v(t) = -Aω sin(ωt + φ) = ${velocity.toFixed(4)} m/s`, eqX, eqY + 45);
    ctx.fillText(`a(t) = -Aω² cos(ωt + φ) = ${acceleration.toFixed(4)} m/s²`, eqX, eqY + 65);

    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`A = ${amplitude.toFixed(3)} m`, eqX, eqY + 90);
    ctx.fillText(`f = ${frequency.toFixed(2)} Hz`, eqX, eqY + 105);
    ctx.fillText(`T = ${period.toFixed(2)} s`, eqX, eqY + 120);
    ctx.fillText(`ω = 2πf = ${omega.toFixed(2)} rad/s`, eqX, eqY + 135);
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Draw components
    drawOscillator();
    drawGraphs();
    drawPhasorDiagram();
    drawEquations();

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Simple Harmonic Motion", width/2, 25);

    // Time display
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(2)} s`, 20, height - 15);
  }

  function reset(): void {
    time = 0;
    positionHistory = [];
    velocityHistory = [];
    accelerationHistory = [];
  }

  function destroy(): void {
    positionHistory = [];
    velocityHistory = [];
    accelerationHistory = [];
  }

  function getStateDescription(): string {
    const { position, velocity, acceleration } = getCurrentValues();
    
    return (
      `Simple Harmonic Motion: A=${amplitude.toFixed(3)} m, f=${frequency.toFixed(2)} Hz, ` +
      `φ=${(phaseShift * 180 / Math.PI).toFixed(0)}°, T=${period.toFixed(2)} s, ω=${omega.toFixed(2)} rad/s. ` +
      `Current: t=${time.toFixed(2)} s, x=${position.toFixed(4)} m, v=${velocity.toFixed(4)} m/s, ` +
      `a=${acceleration.toFixed(4)} m/s². Phase relationships: v leads x by 90°, a leads v by 90°.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SimpleHarmonicMotionFactory;