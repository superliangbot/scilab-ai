import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface EddyLoop {
  x: number;
  y: number;
  radius: number;
  current: number;
  angle: number;
  rotationSpeed: number;
}

const EddyCurrents: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("eddy-currents") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let magnetSpeed = 2;
  let conductorType = 0; // 0 = solid, 1 = slotted
  let showCurrents = 1;
  let magnetStrength = 1;

  // Magnet position
  let magnetX = width * 0.2;
  let magnetY = height * 0.4;
  let magnetVx = 0;

  // Conductor properties
  const CONDUCTOR_X = width * 0.6;
  const CONDUCTOR_Y = height * 0.4;
  const CONDUCTOR_WIDTH = 120;
  const CONDUCTOR_HEIGHT = 160;

  // Eddy current loops
  const eddyLoops: EddyLoop[] = [];
  const maxLoops = 20;

  // Forces and damping
  let eddyForce = 0;
  let powerDissipated = 0;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    magnetX = width * 0.2;
    initEddyLoops();
  }

  function initEddyLoops() {
    eddyLoops.length = 0;
    
    // Create circular eddy current loops throughout the conductor
    const loopsPerRow = 4;
    const loopsPerCol = 5;
    
    for (let row = 0; row < loopsPerCol; row++) {
      for (let col = 0; col < loopsPerRow; col++) {
        const x = CONDUCTOR_X - CONDUCTOR_WIDTH/2 + (CONDUCTOR_WIDTH * (col + 0.5)) / loopsPerRow;
        const y = CONDUCTOR_Y - CONDUCTOR_HEIGHT/2 + (CONDUCTOR_HEIGHT * (row + 0.5)) / loopsPerCol;
        
        eddyLoops.push({
          x,
          y,
          radius: 15 + Math.random() * 10,
          current: 0,
          angle: Math.random() * Math.PI * 2,
          rotationSpeed: 0
        });
      }
    }
  }

  function update(dt: number, params: Record<string, number>) {
    magnetSpeed = params.magnetSpeed ?? magnetSpeed;
    conductorType = Math.round(params.conductorType ?? conductorType);
    showCurrents = Math.round(params.showCurrents ?? showCurrents);
    magnetStrength = params.magnetStrength ?? magnetStrength;

    time += dt;

    // Move magnet with simple harmonic motion
    const omega = magnetSpeed * 0.8;
    magnetX = width * 0.4 + Math.cos(time * omega) * width * 0.15;
    magnetVx = -omega * Math.sin(time * omega) * width * 0.15;

    // Calculate magnetic field strength at each eddy loop
    let totalPower = 0;
    let totalForce = 0;

    eddyLoops.forEach(loop => {
      // Distance from magnet to loop
      const dx = loop.x - magnetX;
      const dy = loop.y - magnetY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Magnetic field strength (inverse square law approximation)
      const fieldStrength = magnetStrength / (1 + distance * 0.01);
      
      // Rate of flux change (proportional to magnet velocity and field gradient)
      const fluxChangeRate = magnetVx * fieldStrength * 0.1;
      
      // Induced current in loop (Faraday's law)
      const resistance = 1.0; // Ohm
      loop.current = fluxChangeRate / resistance;
      
      // Current decay in slotted conductor
      if (conductorType === 1) {
        loop.current *= 0.3; // Reduced current due to slots breaking current paths
      }
      
      // Rotation due to current
      loop.rotationSpeed = loop.current * 2;
      loop.angle += loop.rotationSpeed * dt;
      
      // Power dissipated (I²R losses)
      const power = loop.current * loop.current * resistance;
      totalPower += power;
      
      // Force on magnet due to eddy currents (Lenz's law - opposes motion)
      const force = loop.current * fieldStrength * 0.1;
      totalForce += force;
    });

    eddyForce = totalForce;
    powerDissipated = totalPower;
  }

  function drawMagnet() {
    const magnetW = 60;
    const magnetH = 100;

    // Magnet shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(magnetX - magnetW/2 + 3, magnetY - magnetH/2 + 3, magnetW, magnetH);

    // North pole (red)
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(magnetX - magnetW/2, magnetY - magnetH/2, magnetW/2, magnetH);
    
    // South pole (blue)
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(magnetX, magnetY - magnetH/2, magnetW/2, magnetH);

    // Pole labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("N", magnetX - magnetW/4, magnetY - 10);
    ctx.fillText("S", magnetX + magnetW/4, magnetY - 10);

    // Motion indicator
    if (Math.abs(magnetVx) > 5) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 3;
      const arrowY = magnetY + magnetH/2 + 20;
      const arrowLength = 30;
      
      ctx.beginPath();
      if (magnetVx > 0) {
        // Moving right
        ctx.moveTo(magnetX - arrowLength/2, arrowY);
        ctx.lineTo(magnetX + arrowLength/2, arrowY);
        ctx.moveTo(magnetX + arrowLength/2, arrowY);
        ctx.lineTo(magnetX + arrowLength/2 - 8, arrowY - 6);
        ctx.moveTo(magnetX + arrowLength/2, arrowY);
        ctx.lineTo(magnetX + arrowLength/2 - 8, arrowY + 6);
      } else {
        // Moving left
        ctx.moveTo(magnetX + arrowLength/2, arrowY);
        ctx.lineTo(magnetX - arrowLength/2, arrowY);
        ctx.moveTo(magnetX - arrowLength/2, arrowY);
        ctx.lineTo(magnetX - arrowLength/2 + 8, arrowY - 6);
        ctx.moveTo(magnetX - arrowLength/2, arrowY);
        ctx.lineTo(magnetX - arrowLength/2 + 8, arrowY + 6);
      }
      ctx.stroke();
      
      // Speed label
      ctx.fillStyle = "#22d3ee";
      ctx.font = "12px monospace";
      ctx.fillText(`v = ${(magnetVx/10).toFixed(1)} m/s`, magnetX, arrowY + 20);
    }

    // Magnetic field lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const startX = magnetX + Math.cos(angle) * 40;
      const startY = magnetY + Math.sin(angle) * 40;
      const endX = magnetX + Math.cos(angle) * 80;
      const endY = magnetY + Math.sin(angle) * 80;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawConductor() {
    // Main conductor body
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(
      CONDUCTOR_X - CONDUCTOR_WIDTH/2,
      CONDUCTOR_Y - CONDUCTOR_HEIGHT/2,
      CONDUCTOR_WIDTH,
      CONDUCTOR_HEIGHT
    );

    // Border
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 3;
    ctx.strokeRect(
      CONDUCTOR_X - CONDUCTOR_WIDTH/2,
      CONDUCTOR_Y - CONDUCTOR_HEIGHT/2,
      CONDUCTOR_WIDTH,
      CONDUCTOR_HEIGHT
    );

    // If slotted conductor, draw slots
    if (conductorType === 1) {
      ctx.fillStyle = "#0f172a"; // Background color
      const slotWidth = 8;
      const slotSpacing = CONDUCTOR_WIDTH / 6;
      
      for (let i = 0; i < 5; i++) {
        const slotX = CONDUCTOR_X - CONDUCTOR_WIDTH/2 + slotSpacing + i * slotSpacing;
        ctx.fillRect(
          slotX - slotWidth/2,
          CONDUCTOR_Y - CONDUCTOR_HEIGHT/2,
          slotWidth,
          CONDUCTOR_HEIGHT
        );
      }
    }

    // Label
    ctx.fillStyle = "#1f2937";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      conductorType === 0 ? "Solid Conductor" : "Slotted Conductor",
      CONDUCTOR_X,
      CONDUCTOR_Y + CONDUCTOR_HEIGHT/2 + 25
    );

    // Material properties
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px monospace";
    ctx.fillText("Copper (σ = 5.8×10⁷ S/m)", CONDUCTOR_X, CONDUCTOR_Y + CONDUCTOR_HEIGHT/2 + 40);
  }

  function drawEddyCurrents() {
    if (!showCurrents) return;

    eddyLoops.forEach(loop => {
      if (Math.abs(loop.current) < 0.01) return;

      // Current loop
      const intensity = Math.min(Math.abs(loop.current) * 5, 1);
      const alpha = intensity * 0.8 + 0.2;
      
      ctx.strokeStyle = loop.current > 0 
        ? `rgba(34, 211, 238, ${alpha})` 
        : `rgba(244, 114, 182, ${alpha})`;
      ctx.lineWidth = Math.max(1, intensity * 3);
      
      ctx.beginPath();
      ctx.arc(loop.x, loop.y, loop.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Current direction arrows
      if (Math.abs(loop.current) > 0.05) {
        const numArrows = 4;
        ctx.fillStyle = ctx.strokeStyle;
        
        for (let i = 0; i < numArrows; i++) {
          const angle = loop.angle + (i / numArrows) * Math.PI * 2;
          const arrowX = loop.x + Math.cos(angle) * loop.radius;
          const arrowY = loop.y + Math.sin(angle) * loop.radius;
          
          const arrowDirection = angle + (loop.current > 0 ? Math.PI/2 : -Math.PI/2);
          
          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(arrowDirection);
          
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-3, -3);
          ctx.lineTo(-1, 0);
          ctx.lineTo(-3, 3);
          ctx.fill();
          
          ctx.restore();
        }
      }

      // Current magnitude (for strongest currents)
      if (Math.abs(loop.current) > 0.1) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          Math.abs(loop.current).toFixed(2),
          loop.x,
          loop.y + 2
        );
      }
    });
  }

  function drawEffects() {
    // Heat visualization (power dissipation)
    if (powerDissipated > 0.01) {
      const heatIntensity = Math.min(powerDissipated * 10, 1);
      const heatAlpha = heatIntensity * 0.3;
      
      ctx.fillStyle = `rgba(239, 68, 68, ${heatAlpha})`;
      ctx.fillRect(
        CONDUCTOR_X - CONDUCTOR_WIDTH/2,
        CONDUCTOR_Y - CONDUCTOR_HEIGHT/2,
        CONDUCTOR_WIDTH,
        CONDUCTOR_HEIGHT
      );
      
      // Heat particles
      for (let i = 0; i < Math.floor(heatIntensity * 20); i++) {
        const x = CONDUCTOR_X + (Math.random() - 0.5) * CONDUCTOR_WIDTH;
        const y = CONDUCTOR_Y - CONDUCTOR_HEIGHT/2 + Math.random() * CONDUCTOR_HEIGHT;
        const size = 1 + Math.random() * 2;
        
        ctx.fillStyle = `rgba(255, 165, 0, ${0.3 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Force arrow showing electromagnetic braking
    if (Math.abs(eddyForce) > 0.01) {
      const forceLength = Math.min(Math.abs(eddyForce) * 100, 60);
      const forceY = CONDUCTOR_Y - CONDUCTOR_HEIGHT/2 - 30;
      
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(CONDUCTOR_X, forceY);
      
      if (eddyForce > 0) {
        // Force opposing motion (leftward if magnet moving right)
        ctx.lineTo(CONDUCTOR_X - forceLength, forceY);
        ctx.moveTo(CONDUCTOR_X - forceLength, forceY);
        ctx.lineTo(CONDUCTOR_X - forceLength + 10, forceY - 5);
        ctx.moveTo(CONDUCTOR_X - forceLength, forceY);
        ctx.lineTo(CONDUCTOR_X - forceLength + 10, forceY + 5);
      } else {
        ctx.lineTo(CONDUCTOR_X + forceLength, forceY);
        ctx.moveTo(CONDUCTOR_X + forceLength, forceY);
        ctx.lineTo(CONDUCTOR_X + forceLength - 10, forceY - 5);
        ctx.moveTo(CONDUCTOR_X + forceLength, forceY);
        ctx.lineTo(CONDUCTOR_X + forceLength - 10, forceY + 5);
      }
      ctx.stroke();
      
      // Force label
      ctx.fillStyle = "#ef4444";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Braking Force", CONDUCTOR_X, forceY - 15);
      ctx.fillText(`F = ${Math.abs(eddyForce).toFixed(3)} N`, CONDUCTOR_X, forceY - 3);
    }
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Eddy Currents", 20, 30);

    // Physics explanation
    ctx.font = "11px monospace";
    const infoLines = [
      "Moving magnetic field induces circular currents",
      "in conducting material (Faraday's law)",
      "",
      `Power dissipated: ${powerDissipated.toFixed(4)} W`,
      `Electromagnetic force: ${Math.abs(eddyForce).toFixed(4)} N`,
      "",
      "Applications:",
      "• Electromagnetic braking",
      "• Induction heating",
      "• Metal separation",
      "• Vibration damping"
    ];

    let y = 50;
    infoLines.forEach(line => {
      if (line.includes("Power") || line.includes("force")) {
        ctx.fillStyle = "#fbbf24";
      } else if (line.includes("•")) {
        ctx.fillStyle = "#34d399";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 13;
    });

    // Comparison panel
    const panelX = width - 300;
    const panelY = height - 200;
    const panelW = 280;
    const panelH = 160;
    
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#22d3ee";
    ctx.font = "14px monospace";
    ctx.fillText("Solid vs Slotted Conductor:", panelX + 10, panelY + 20);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px monospace";
    const comparison = [
      "",
      "Solid conductor:",
      "• Large eddy current loops",
      "• Strong electromagnetic braking",
      "• High power losses",
      "",
      "Slotted conductor:",
      "• Broken current paths",
      "• Reduced eddy currents",
      "• Less braking, less heating",
      "• Used in transformers, motors"
    ];

    let panelY2 = panelY + 40;
    comparison.forEach(line => {
      if (line.includes("Solid") || line.includes("Slotted")) {
        ctx.fillStyle = "#fbbf24";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, panelX + 10, panelY2);
      panelY2 += 12;
    });
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawConductor();
    drawEddyCurrents();
    drawEffects();
    drawMagnet();
    drawInfo();
  }

  function reset() {
    time = 0;
    magnetX = width * 0.2;
    initEddyLoops();
  }

  function getStateDescription(): string {
    const conductorTypeStr = conductorType === 0 ? "solid" : "slotted";
    return `Eddy currents in ${conductorTypeStr} conductor. Power dissipated: ${powerDissipated.toFixed(3)} W. Braking force: ${Math.abs(eddyForce).toFixed(3)} N.`;
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

export default EddyCurrents;