import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LenzLaw: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lenz-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let magnetSpeed = 1.5;
  let magnetDirection = 1; // 1 = approaching, -1 = receding
  let showCurrentDirection = 1;
  let showForces = 1;

  // Magnet and ring positions
  let magnetY = height * 0.2;
  let magnetVy = 0;
  const RING_X = width * 0.5;
  const RING_Y = height * 0.6;
  const RING_RADIUS = 60;

  // Physics state
  let flux = 0;
  let inducedEMF = 0;
  let inducedCurrent = 0;
  let magneticForce = 0;

  // Visual effects
  let currentDirection = 1; // 1 = clockwise, -1 = counterclockwise
  let forceDirection = 1; // 1 = repulsive, -1 = attractive

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    magnetY = height * 0.2;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    magnetSpeed = params.magnetSpeed ?? magnetSpeed;
    magnetDirection = Math.round(params.magnetDirection) === 0 ? 1 : -1;
    showCurrentDirection = Math.round(params.showCurrentDirection ?? showCurrentDirection);
    showForces = Math.round(params.showForces ?? showForces);

    time += dt;

    // Move magnet towards or away from ring
    const targetY = magnetDirection > 0 ? RING_Y - 150 : height * 0.1;
    const distance = targetY - magnetY;
    magnetVy = distance * magnetSpeed * 0.01;
    magnetY += magnetVy * dt * 60;

    // Calculate magnetic flux through ring (simplified)
    const distanceToRing = Math.abs(magnetY - RING_Y);
    const fluxDensity = 1.0 / (1 + distanceToRing * 0.005);
    flux = fluxDensity * Math.PI * RING_RADIUS * RING_RADIUS * 0.0001;

    // Apply Lenz's law
    if (magnetVy > 0.1) {
      // Magnet approaching - flux increasing
      inducedEMF = 0.5;
      // Current creates field opposing flux increase
      currentDirection = magnetDirection > 0 ? -1 : 1;
      // Force opposes motion (repulsive when approaching)
      forceDirection = -magnetDirection;
    } else if (magnetVy < -0.1) {
      // Magnet receding - flux decreasing  
      inducedEMF = -0.5;
      // Current creates field opposing flux decrease
      currentDirection = magnetDirection > 0 ? 1 : -1;
      // Force opposes motion (attractive when receding)
      forceDirection = magnetDirection;
    } else {
      inducedEMF = 0;
      currentDirection = 0;
      forceDirection = 0;
    }

    inducedCurrent = inducedEMF;
    magneticForce = Math.abs(inducedCurrent) * 0.1;

    // Periodic motion
    if (magnetDirection > 0 && magnetY > RING_Y - 120) {
      magnetDirection = -1;
    } else if (magnetDirection < 0 && magnetY < height * 0.15) {
      magnetDirection = 1;
    }
  }

  function drawMagnet() {
    const magnetW = 50;
    const magnetH = 30;

    // Magnet body
    ctx.fillStyle = "#64748b";
    ctx.fillRect(RING_X - magnetW/2, magnetY - magnetH/2, magnetW, magnetH);

    // North pole (top)
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(RING_X - magnetW/2, magnetY - magnetH/2, magnetW, magnetH/2);
    
    // South pole (bottom)
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(RING_X - magnetW/2, magnetY, magnetW, magnetH/2);

    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("N", RING_X, magnetY - 8);
    ctx.fillText("S", RING_X, magnetY + 12);

    // Motion arrow
    if (Math.abs(magnetVy) > 0.5) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      const arrowX = RING_X + magnetW/2 + 20;
      const arrowLength = 25;
      
      if (magnetVy > 0) {
        // Moving down
        ctx.moveTo(arrowX, magnetY - arrowLength/2);
        ctx.lineTo(arrowX, magnetY + arrowLength/2);
        ctx.moveTo(arrowX, magnetY + arrowLength/2);
        ctx.lineTo(arrowX - 5, magnetY + arrowLength/2 - 5);
        ctx.moveTo(arrowX, magnetY + arrowLength/2);
        ctx.lineTo(arrowX + 5, magnetY + arrowLength/2 - 5);
      } else {
        // Moving up
        ctx.moveTo(arrowX, magnetY + arrowLength/2);
        ctx.lineTo(arrowX, magnetY - arrowLength/2);
        ctx.moveTo(arrowX, magnetY - arrowLength/2);
        ctx.lineTo(arrowX - 5, magnetY - arrowLength/2 + 5);
        ctx.moveTo(arrowX, magnetY - arrowLength/2);
        ctx.lineTo(arrowX + 5, magnetY - arrowLength/2 + 5);
      }
      ctx.stroke();
    }

    // Magnetic field lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    const fieldLines = 6;
    for (let i = 0; i < fieldLines; i++) {
      const angle = (i / fieldLines) * Math.PI * 2;
      const startX = RING_X + Math.cos(angle) * 35;
      const startY = magnetY + Math.sin(angle) * 35;
      const endX = RING_X + Math.cos(angle) * 100;
      const endY = magnetY + Math.sin(angle) * 100;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawConductingRing() {
    // Ring structure
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(RING_X, RING_Y, RING_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Inner edge
    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(RING_X, RING_Y, RING_RADIUS - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(RING_X, RING_Y, RING_RADIUS + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Current flow indicators
    if (showCurrentDirection && Math.abs(inducedCurrent) > 0.01) {
      const numArrows = 8;
      ctx.fillStyle = inducedCurrent > 0 ? "#22d3ee" : "#f472b6";
      
      for (let i = 0; i < numArrows; i++) {
        const angle = (i / numArrows) * Math.PI * 2;
        const arrowX = RING_X + Math.cos(angle) * RING_RADIUS;
        const arrowY = RING_Y + Math.sin(angle) * RING_RADIUS;
        
        // Arrow direction based on current direction and Lenz's law
        const arrowAngle = angle + (currentDirection > 0 ? Math.PI/2 : -Math.PI/2);
        
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(arrowAngle);
        
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 4);
        ctx.fill();
        
        ctx.restore();
      }

      // Current magnitude label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        `I = ${Math.abs(inducedCurrent).toFixed(2)} A`,
        RING_X, RING_Y + 5
      );
      
      ctx.fillText(
        currentDirection > 0 ? "Clockwise" : "Counterclockwise",
        RING_X, RING_Y + 20
      );
    }
  }

  function drawForces() {
    if (!showForces || Math.abs(magneticForce) < 0.01) return;

    // Force on magnet
    const forceLength = magneticForce * 100;
    const forceX = RING_X - 80;
    const forceStartY = magnetY;
    
    ctx.strokeStyle = forceDirection > 0 ? "#ef4444" : "#22d3ee";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(forceX, forceStartY);
    
    if (forceDirection > 0) {
      // Repulsive force - arrow pointing away
      ctx.lineTo(forceX, forceStartY - forceLength);
      ctx.moveTo(forceX, forceStartY - forceLength);
      ctx.lineTo(forceX - 5, forceStartY - forceLength + 10);
      ctx.moveTo(forceX, forceStartY - forceLength);
      ctx.lineTo(forceX + 5, forceStartY - forceLength + 10);
    } else {
      // Attractive force - arrow pointing toward ring
      ctx.lineTo(forceX, forceStartY + forceLength);
      ctx.moveTo(forceX, forceStartY + forceLength);
      ctx.lineTo(forceX - 5, forceStartY + forceLength - 10);
      ctx.moveTo(forceX, forceStartY + forceLength);
      ctx.lineTo(forceX + 5, forceStartY + forceLength - 10);
    }
    ctx.stroke();

    // Force label
    ctx.fillStyle = forceDirection > 0 ? "#ef4444" : "#22d3ee";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      forceDirection > 0 ? "Repulsive" : "Attractive",
      forceX, forceStartY - forceLength - 15
    );
    ctx.fillText("Force", forceX, forceStartY - forceLength - 5);

    // Force on ring (Newton's 3rd law)
    const ringForceY = RING_Y + RING_RADIUS + 30;
    ctx.strokeStyle = forceDirection > 0 ? "#22d3ee" : "#ef4444";
    ctx.beginPath();
    ctx.moveTo(RING_X, ringForceY);
    
    if (forceDirection > 0) {
      // Ring experiences downward force
      ctx.lineTo(RING_X, ringForceY + forceLength/2);
      ctx.moveTo(RING_X, ringForceY + forceLength/2);
      ctx.lineTo(RING_X - 5, ringForceY + forceLength/2 - 10);
      ctx.moveTo(RING_X, ringForceY + forceLength/2);
      ctx.lineTo(RING_X + 5, ringForceY + forceLength/2 - 10);
    } else {
      // Ring experiences upward force
      ctx.lineTo(RING_X, ringForceY - forceLength/2);
      ctx.moveTo(RING_X, ringForceY - forceLength/2);
      ctx.lineTo(RING_X - 5, ringForceY - forceLength/2 + 10);
      ctx.moveTo(RING_X, ringForceY - forceLength/2);
      ctx.lineTo(RING_X + 5, ringForceY - forceLength/2 + 10);
    }
    ctx.stroke();
  }

  function drawInfo() {
    // Title and explanation
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Lenz's Law Demonstration", 20, 30);

    ctx.font = "12px monospace";
    const infoLines = [
      "\"The induced current flows in such a direction",
      "that its magnetic field opposes the change",
      "in flux that produced it.\"",
      "",
      `Flux: ${flux.toFixed(4)} Wb`,
      `EMF: ${inducedEMF.toFixed(3)} V`,
      `Current: ${inducedCurrent.toFixed(3)} A`,
      "",
      magnetVy > 0.1 ? "Flux INCREASING → Current opposes" :
      magnetVy < -0.1 ? "Flux DECREASING → Current opposes" :
      "No flux change → No current"
    ];

    let y = 55;
    infoLines.forEach(line => {
      if (line.includes("INCREASING") || line.includes("DECREASING")) {
        ctx.fillStyle = "#fbbf24";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 15;
    });

    // Right side info panel
    const panelX = width - 250;
    const panelY = 20;
    
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(panelX - 10, panelY - 10, 240, 180);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 10, panelY - 10, 240, 180);

    ctx.fillStyle = "#22d3ee";
    ctx.font = "14px monospace";
    ctx.fillText("Physics:", panelX, panelY + 15);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px monospace";
    const physicsInfo = [
      "• Faraday's Law: EMF = -dΦ/dt",
      "• Lenz's Law: I_induced opposes ΔΦ",
      "• Conservation of energy",
      "• F = BIL (magnetic force)",
      "",
      "When magnet approaches:",
      "• Flux increases",
      "• Induced current creates N pole",
      "• Repulsive force opposes motion",
      "",
      "When magnet recedes:",
      "• Flux decreases", 
      "• Induced current creates S pole",
      "• Attractive force opposes motion"
    ];

    let panelLineY = panelY + 35;
    physicsInfo.forEach(line => {
      ctx.fillText(line, panelX, panelLineY);
      panelLineY += 12;
    });
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawMagnet();
    drawConductingRing();
    drawForces();
    drawInfo();
  }

  function reset() {
    time = 0;
    magnetY = height * 0.2;
    magnetDirection = 1;
  }

  function getStateDescription(): string {
    const motion = magnetVy > 0.1 ? "approaching" : magnetVy < -0.1 ? "receding" : "stationary";
    const currentDesc = currentDirection > 0 ? "clockwise" : currentDirection < 0 ? "counterclockwise" : "no";
    return `Magnet ${motion}, ${currentDesc} current induced. Lenz's law: induced effects oppose the change causing them.`;
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

export default LenzLaw;