import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Electromagnetic Induction Loop
 * Faraday's Law: ε = -dΦ/dt where Φ = B·A·cos(θ)
 * Shows conducting loop moving through magnetic field, generating EMF
 * Demonstrates motional EMF and induced current direction (Lenz's law)
 */

const ElectromagneticInductionLoopFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electromagnetic-induction-loop") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // System parameters
  let magneticFieldStrength = 0.5; // Tesla
  let loopRadius = 60; // pixels
  let loopVelocity = 50; // pixels/second
  let loopResistance = 1; // Ohm
  let fieldDirection = 1; // 1 = into page, -1 = out of page

  let loopX = 100;
  let loopY = 200;
  let loopVx = 50;

  // Magnetic field regions
  const fieldRegions = [
    { x: 300, y: 100, width: 200, height: 300, strength: 0.8, direction: 1 },
    { x: 600, y: 50, width: 150, height: 400, strength: -0.6, direction: -1 }
  ];

  let currentFlux = 0;
  let inducedEMF = 0;
  let inducedCurrent = 0;
  let fluxHistory: number[] = [];
  let emfHistory: number[] = [];
  let timeHistory: number[] = [];

  function calculateMagneticFlux(): number {
    let totalFlux = 0;
    
    fieldRegions.forEach(region => {
      // Check if loop intersects with field region
      const loopLeft = loopX - loopRadius;
      const loopRight = loopX + loopRadius;
      const loopTop = loopY - loopRadius;
      const loopBottom = loopY + loopRadius;
      
      const regionLeft = region.x;
      const regionRight = region.x + region.width;
      const regionTop = region.y;
      const regionBottom = region.y + region.height;
      
      // Find intersection area
      const intersectLeft = Math.max(loopLeft, regionLeft);
      const intersectRight = Math.min(loopRight, regionRight);
      const intersectTop = Math.max(loopTop, regionTop);
      const intersectBottom = Math.min(loopBottom, regionBottom);
      
      if (intersectLeft < intersectRight && intersectTop < intersectBottom) {
        // Approximate intersection area as rectangle
        const intersectWidth = intersectRight - intersectLeft;
        const intersectHeight = intersectBottom - intersectTop;
        const intersectArea = intersectWidth * intersectHeight;
        
        // Convert to proper units and calculate flux
        const areaM2 = intersectArea / 10000; // pixels² to m²
        totalFlux += region.strength * areaM2;
      }
    });
    
    return totalFlux;
  }

  function drawMagneticField() {
    fieldRegions.forEach((region, index) => {
      // Field region background
      if (region.strength > 0) {
        ctx.fillStyle = "rgba(255, 0, 0, 0.15)"; // Into page (red)
      } else {
        ctx.fillStyle = "rgba(0, 0, 255, 0.15)"; // Out of page (blue)
      }
      
      ctx.fillRect(region.x, region.y, region.width, region.height);
      
      // Field symbols
      const symbolSize = 12;
      const spacing = 30;
      
      ctx.fillStyle = region.strength > 0 ? "#ef4444" : "#3b82f6";
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "center";
      
      for (let x = region.x + spacing; x < region.x + region.width; x += spacing) {
        for (let y = region.y + spacing; y < region.y + region.height; y += spacing) {
          if (region.strength > 0) {
            // Cross symbol (⊗) - field into page
            ctx.beginPath();
            ctx.arc(x, y, symbolSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x - symbolSize / 3, y - symbolSize / 3);
            ctx.lineTo(x + symbolSize / 3, y + symbolSize / 3);
            ctx.moveTo(x - symbolSize / 3, y + symbolSize / 3);
            ctx.lineTo(x + symbolSize / 3, y - symbolSize / 3);
            ctx.stroke();
          } else {
            // Dot symbol (⊙) - field out of page
            ctx.beginPath();
            ctx.arc(x, y, symbolSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      
      // Field strength label
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(`B = ${Math.abs(region.strength).toFixed(1)} T`, 
                   region.x + region.width / 2, region.y + 15);
    });
  }

  function drawConductingLoop() {
    // Loop circle
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(loopX, loopY, loopRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Current direction indicator (if current > 0)
    if (Math.abs(inducedCurrent) > 0.01) {
      const arrowCount = 8;
      const arrowRadius = loopRadius + 15;
      const currentColor = inducedCurrent > 0 ? "#10b981" : "#ef4444";
      
      ctx.strokeStyle = currentColor;
      ctx.fillStyle = currentColor;
      ctx.lineWidth = 2;
      
      for (let i = 0; i < arrowCount; i++) {
        const angle = (i / arrowCount) * Math.PI * 2;
        const x1 = loopX + Math.cos(angle) * arrowRadius;
        const y1 = loopY + Math.sin(angle) * arrowRadius;
        
        // Arrow direction based on current direction (Lenz's law)
        const direction = inducedCurrent > 0 ? 1 : -1;
        const arrowAngle = angle + direction * Math.PI / 2;
        
        const arrowLength = 12;
        const x2 = x1 + Math.cos(arrowAngle) * arrowLength;
        const y2 = y1 + Math.sin(arrowAngle) * arrowLength;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        // Arrowhead
        const headAngle = arrowAngle + Math.PI;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 + Math.cos(headAngle - 0.5) * 6, y2 + Math.sin(headAngle - 0.5) * 6);
        ctx.lineTo(x2 + Math.cos(headAngle + 0.5) * 6, y2 + Math.sin(headAngle + 0.5) * 6);
        ctx.closePath();
        ctx.fill();
      }
    }
    
    // Velocity vector
    if (Math.abs(loopVx) > 5) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(loopX, loopY - loopRadius - 30);
      ctx.lineTo(loopX + loopVx * 2, loopY - loopRadius - 30);
      ctx.stroke();
      
      // Velocity arrow
      const vDir = loopVx > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(loopX + loopVx * 2, loopY - loopRadius - 30);
      ctx.lineTo(loopX + loopVx * 2 - vDir * 10, loopY - loopRadius - 35);
      ctx.lineTo(loopX + loopVx * 2 - vDir * 10, loopY - loopRadius - 25);
      ctx.closePath();
      ctx.fill();
      
      // Velocity label
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`v = ${Math.abs(loopVx).toFixed(0)} px/s`, loopX, loopY - loopRadius - 45);
    }
  }

  function drawEMFGraph() {
    if (emfHistory.length < 2) return;
    
    const graphX = width - 250;
    const graphY = height - 200;
    const graphWidth = 200;
    const graphHeight = 120;
    
    // Graph background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);
    
    // Plot EMF over time
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const maxEMF = Math.max(0.1, Math.max(...emfHistory.map(Math.abs)));
    
    emfHistory.forEach((emf, i) => {
      const x = graphX + (i / (emfHistory.length - 1)) * graphWidth;
      const y = graphY + graphHeight / 2 - (emf / maxEMF) * (graphHeight / 2);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Zero line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphHeight / 2);
    ctx.lineTo(graphX + graphWidth, graphY + graphHeight / 2);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Induced EMF", graphX, graphY - 5);
    
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`ε = ${inducedEMF.toFixed(3)} V`, graphX, graphY + graphHeight + 15);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    fluxHistory.length = 0;
    emfHistory.length = 0;
    timeHistory.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    magneticFieldStrength = params.magneticFieldStrength ?? 0.5;
    loopRadius = params.loopRadius ?? 60;
    loopVelocity = params.loopVelocity ?? 50;
    loopResistance = params.loopResistance ?? 1;
    fieldDirection = Math.sign(params.fieldDirection ?? 1) || 1;

    time += dt;
    
    // Update field regions with current parameters
    fieldRegions[0].strength = magneticFieldStrength * fieldDirection;
    fieldRegions[1].strength = -magneticFieldStrength * 0.8 * fieldDirection;
    
    // Update loop position
    loopVx = loopVelocity * Math.sin(time * 0.3); // Oscillating motion
    loopX += loopVx * dt;
    
    // Keep loop in bounds
    if (loopX < loopRadius || loopX > width - loopRadius) {
      loopVx *= -1;
      loopX = Math.max(loopRadius, Math.min(width - loopRadius, loopX));
    }

    // Calculate magnetic flux
    const newFlux = calculateMagneticFlux();
    
    // Calculate induced EMF using Faraday's law
    if (fluxHistory.length > 0) {
      const dFlux = newFlux - currentFlux;
      const dTime = dt;
      inducedEMF = -dFlux / dTime; // Faraday's law: ε = -dΦ/dt
    }
    
    currentFlux = newFlux;
    
    // Calculate induced current using Ohm's law
    inducedCurrent = inducedEMF / loopResistance;

    // Record history
    fluxHistory.push(currentFlux);
    emfHistory.push(inducedEMF);
    timeHistory.push(time);
    
    // Limit history length
    if (fluxHistory.length > 300) {
      fluxHistory.shift();
      emfHistory.shift();
      timeHistory.shift();
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawMagneticField();
    drawConductingLoop();
    drawEMFGraph();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 300, 200);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Electromagnetic Induction", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText("Faraday's Law: ε = -dΦ/dt", 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Magnetic Flux: Φ = ${currentFlux.toFixed(4)} Wb`, 20, 80);
    ctx.fillText(`Induced EMF: ε = ${inducedEMF.toFixed(3)} V`, 20, 100);
    ctx.fillText(`Induced Current: I = ${inducedCurrent.toFixed(3)} A`, 20, 120);
    ctx.fillText(`Loop Resistance: R = ${loopResistance} Ω`, 20, 140);
    ctx.fillText(`Loop Velocity: v = ${loopVx.toFixed(1)} px/s`, 20, 160);
    
    // Lenz's law indicator
    const lenzDirection = inducedCurrent > 0 ? "CCW" : "CW";
    ctx.fillStyle = inducedCurrent > 0 ? "#10b981" : "#ef4444";
    ctx.fillText(`Current Direction: ${lenzDirection} (Lenz's Law)`, 20, 180);

    // Field legend
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 200, 10, 190, 120);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Magnetic Field:", width - 190, 30);
    
    ctx.fillStyle = "#ef4444";
    ctx.fillText("⊗ Into page (positive B)", width - 190, 50);
    
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("⊙ Out of page (negative B)", width - 190, 70);
    
    ctx.fillStyle = "#ffffff";
    ctx.fillText("Lenz's Law:", width - 190, 95);
    ctx.fillText("Induced current opposes", width - 190, 110);
    ctx.fillText("the change in flux", width - 190, 125);

    // Formulas
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Φ = B·A·cos(θ) | ε = -dΦ/dt | I = ε/R", width / 2, height - 20);
    ctx.fillText("Moving conductor generates EMF opposing flux change", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    loopX = 100;
    loopVx = loopVelocity;
    currentFlux = 0;
    inducedEMF = 0;
    inducedCurrent = 0;
    fluxHistory.length = 0;
    emfHistory.length = 0;
    timeHistory.length = 0;
  }

  function destroy(): void {
    fluxHistory.length = 0;
    emfHistory.length = 0;
    timeHistory.length = 0;
  }

  function getStateDescription(): string {
    const lenzDirection = inducedCurrent > 0 ? "counterclockwise" : "clockwise";
    
    return (
      `Electromagnetic Induction: conducting loop (R=${loopResistance}Ω) moving through magnetic field B=${magneticFieldStrength}T. ` +
      `Current flux Φ=${currentFlux.toFixed(4)}Wb generates EMF ε=${inducedEMF.toFixed(3)}V and current I=${inducedCurrent.toFixed(3)}A. ` +
      `Loop velocity v=${loopVx.toFixed(1)}px/s, current flows ${lenzDirection} by Lenz's law. ` +
      `Faraday's law ε=-dΦ/dt demonstrates electromagnetic induction principles.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default ElectromagneticInductionLoopFactory;