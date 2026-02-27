import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectromagneticInduction: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electromagnetic-induction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let magnetSpeed = 2;
  let coilTurns = 10;
  let magnetStrength = 1;
  let showFieldLines = 1;

  // Magnet position and velocity
  let magnetX = width * 0.2;
  let magnetVx = 0;

  // Induced EMF and current
  let inducedEMF = 0;
  let inducedCurrent = 0;
  let fluxLinkage = 0;

  // Graph data for flux and EMF
  const fluxHistory: number[] = [];
  const emfHistory: number[] = [];
  const maxHistory = 200;

  const COIL_X = width * 0.6;
  const COIL_Y = height * 0.4;
  const COIL_RADIUS = 80;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    magnetX = width * 0.2;
    magnetVx = 0;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    magnetSpeed = params.magnetSpeed ?? magnetSpeed;
    coilTurns = params.coilTurns ?? coilTurns;
    magnetStrength = params.magnetStrength ?? magnetStrength;
    showFieldLines = Math.round(params.showFieldLines ?? showFieldLines);

    time += dt;

    // Move magnet with simple harmonic motion
    const omega = magnetSpeed * 0.5;
    magnetX = width * 0.4 + Math.sin(time * omega) * width * 0.25;
    magnetVx = omega * Math.cos(time * omega) * width * 0.25;

    // Calculate magnetic flux through coil using distance-based approximation
    const distance = Math.abs(magnetX - COIL_X);
    const fluxDensity = magnetStrength / (1 + distance * 0.01);
    const area = Math.PI * COIL_RADIUS * COIL_RADIUS * 0.0001; // m²
    const flux = fluxDensity * area; // Weber
    fluxLinkage = flux * coilTurns;

    // Calculate induced EMF using Faraday's law: EMF = -dΦ/dt
    if (fluxHistory.length > 1) {
      const prevFlux = fluxHistory[fluxHistory.length - 1];
      const dFluxDt = (fluxLinkage - prevFlux) / dt;
      inducedEMF = -dFluxDt;
    }

    // Calculate current (assuming 1Ω resistance)
    inducedCurrent = inducedEMF / 1.0;

    // Store history
    fluxHistory.push(fluxLinkage);
    emfHistory.push(inducedEMF);
    if (fluxHistory.length > maxHistory) {
      fluxHistory.shift();
      emfHistory.shift();
    }
  }

  function drawMagnet() {
    const magnetW = 60;
    const magnetH = 120;

    // North pole (left side)
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(magnetX - magnetW/2, COIL_Y - magnetH/2, magnetW/2, magnetH);
    
    // South pole (right side)
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(magnetX, COIL_Y - magnetH/2, magnetW/2, magnetH);

    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("N", magnetX - magnetW/4, COIL_Y - 10);
    ctx.fillText("S", magnetX + magnetW/4, COIL_Y - 10);

    // Motion indicator
    if (Math.abs(magnetVx) > 1) {
      ctx.fillStyle = "#22d3ee";
      const arrowY = COIL_Y + magnetH/2 + 20;
      if (magnetVx > 0) {
        // Moving right
        ctx.beginPath();
        ctx.moveTo(magnetX - 15, arrowY);
        ctx.lineTo(magnetX + 15, arrowY);
        ctx.lineTo(magnetX + 10, arrowY - 5);
        ctx.moveTo(magnetX + 15, arrowY);
        ctx.lineTo(magnetX + 10, arrowY + 5);
        ctx.stroke();
      } else {
        // Moving left
        ctx.beginPath();
        ctx.moveTo(magnetX + 15, arrowY);
        ctx.lineTo(magnetX - 15, arrowY);
        ctx.lineTo(magnetX - 10, arrowY - 5);
        ctx.moveTo(magnetX - 15, arrowY);
        ctx.lineTo(magnetX - 10, arrowY + 5);
        ctx.stroke();
      }
    }
  }

  function drawCoil() {
    // Coil windings
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    
    const turns = Math.floor(coilTurns);
    for (let i = 0; i < turns; i++) {
      const y = COIL_Y - COIL_RADIUS + (2 * COIL_RADIUS * i / (turns - 1));
      ctx.beginPath();
      ctx.arc(COIL_X, y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Coil leads (wires)
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(COIL_X + 20, COIL_Y - COIL_RADIUS);
    ctx.lineTo(COIL_X + 80, COIL_Y - COIL_RADIUS);
    ctx.moveTo(COIL_X + 20, COIL_Y + COIL_RADIUS);
    ctx.lineTo(COIL_X + 80, COIL_Y + COIL_RADIUS);
    ctx.stroke();

    // Current flow indicators
    if (Math.abs(inducedCurrent) > 0.01) {
      ctx.fillStyle = inducedCurrent > 0 ? "#22d3ee" : "#f472b6";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`I = ${inducedCurrent.toFixed(3)} A`, COIL_X + 90, COIL_Y);
      
      // Current direction arrows
      const arrowSize = 4;
      for (let i = 0; i < turns; i++) {
        const y = COIL_Y - COIL_RADIUS + (2 * COIL_RADIUS * i / (turns - 1));
        const angle = inducedCurrent > 0 ? 0 : Math.PI;
        const arrowX = COIL_X + 35;
        
        ctx.save();
        ctx.translate(arrowX, y);
        ctx.rotate(angle);
        ctx.fillStyle = inducedCurrent > 0 ? "#22d3ee" : "#f472b6";
        ctx.beginPath();
        ctx.moveTo(arrowSize, 0);
        ctx.lineTo(-arrowSize, -arrowSize);
        ctx.lineTo(-arrowSize/2, 0);
        ctx.lineTo(-arrowSize, arrowSize);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawFieldLines() {
    if (!showFieldLines) return;

    const numLines = 8;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let i = 0; i < numLines; i++) {
      const y = COIL_Y - 80 + (160 * i / (numLines - 1));
      
      // Field lines from N to S
      ctx.beginPath();
      ctx.moveTo(magnetX - 30, y);
      
      // Curved field lines
      const cp1x = magnetX + 60;
      const cp1y = y - 20;
      const cp2x = magnetX + 100;
      const cp2y = y + 20;
      
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, magnetX + 30, y);
      ctx.stroke();
      
      // Field direction arrows
      ctx.setLineDash([]);
      const midX = magnetX + 50;
      ctx.save();
      ctx.translate(midX, y);
      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-2, -3);
      ctx.lineTo(-2, 3);
      ctx.fill();
      ctx.restore();
      ctx.setLineDash([4, 4]);
    }
    
    ctx.setLineDash([]);
  }

  function drawGraphs() {
    const graphX = 50;
    const graphY = height - 200;
    const graphW = width - 100;
    const graphH = 80;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(graphX - 10, graphY - 10, graphW + 20, graphH + 40);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX - 10, graphY - 10, graphW + 20, graphH + 40);

    // Flux linkage graph
    if (fluxHistory.length > 1) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < fluxHistory.length; i++) {
        const x = graphX + (i / fluxHistory.length) * graphW;
        const y = graphY + graphH/2 - fluxHistory[i] * 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // EMF graph
    if (emfHistory.length > 1) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < emfHistory.length; i++) {
        const x = graphX + (i / emfHistory.length) * graphW;
        const y = graphY + graphH/2 - emfHistory[i] * 200;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Graph labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Flux Linkage (blue) & EMF (orange)", graphX, graphY - 15);
    
    // Zero line
    ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH/2);
    ctx.lineTo(graphX + graphW, graphY + graphH/2);
    ctx.stroke();
  }

  function drawInfo() {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";

    const infoY = 30;
    const lineHeight = 20;

    ctx.fillText("Electromagnetic Induction - Faraday's Law", 20, infoY);
    ctx.fillText(`Flux Linkage: ${fluxLinkage.toFixed(4)} Wb·turns`, 20, infoY + lineHeight);
    ctx.fillText(`Induced EMF: ${inducedEMF.toFixed(4)} V`, 20, infoY + 2*lineHeight);
    ctx.fillText(`EMF = -dΦ/dt (Faraday's Law)`, 20, infoY + 3*lineHeight);

    // Lenz's law indicator
    if (Math.abs(inducedCurrent) > 0.01) {
      const lenzDirection = magnetVx > 0 ? "opposes approach" : "opposes departure";
      ctx.fillText(`Lenz's Law: Current ${lenzDirection}`, 20, infoY + 4*lineHeight);
    }
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawFieldLines();
    drawMagnet();
    drawCoil();
    drawGraphs();
    drawInfo();
  }

  function reset() {
    time = 0;
    magnetX = width * 0.2;
    fluxHistory.length = 0;
    emfHistory.length = 0;
  }

  function getStateDescription(): string {
    return `Moving magnet induces EMF in coil. Current flux: ${fluxLinkage.toFixed(4)} Wb·turns, EMF: ${inducedEMF.toFixed(4)} V. Demonstrates Faraday's law and Lenz's law.`;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy: () => {},
    getStateDescription,
    resize: (w: number, h: number) => { width = w; height = h; }
  };
};

export default ElectromagneticInduction;