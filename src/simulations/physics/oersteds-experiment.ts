import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const OerstedsExperimentFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("oersteds-experiment") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let current = 5; // Amperes
  let wireDirection = 1; // 1 = left to right, -1 = right to left
  let compassDistance = 60; // px from wire
  let showFieldLines = 1;

  // Compass needle state
  let needleAngle = 0; // degrees from north
  let needleVelocity = 0;
  const NEEDLE_DAMPING = 0.92;
  const NEEDLE_SPRING = 5;

  // Wire position
  const WIRE_Y_RATIO = 0.4;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    needleAngle = 0;
    needleVelocity = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    current = params.current ?? 5;
    wireDirection = params.wireDirection ?? 1;
    compassDistance = params.compassDistance ?? 60;
    showFieldLines = params.showFieldLines ?? 1;

    time += dt;

    // Calculate target needle angle based on magnetic field
    // Right-hand rule: current flowing right -> field points toward screen above wire, out below
    // Below the wire (compass position): field direction
    const fieldStrength = current * wireDirection / Math.max(compassDistance, 10);
    const targetAngle = Math.atan2(fieldStrength, 0.5) * (180 / Math.PI); // mix of earth field and wire field

    // Damped spring physics for needle
    const angleError = targetAngle - needleAngle;
    const torque = NEEDLE_SPRING * angleError;
    needleVelocity += torque * dt;
    needleVelocity *= NEEDLE_DAMPING;
    needleAngle += needleVelocity * dt;
  }

  function drawWire(): void {
    const wireY = height * WIRE_Y_RATIO;

    // Wire (horizontal)
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(30, wireY);
    ctx.lineTo(width - 30, wireY);
    ctx.stroke();

    // Wire sheen
    ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(30, wireY);
    ctx.lineTo(width - 30, wireY);
    ctx.stroke();

    // Current direction arrows
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";

    const arrowDir = wireDirection > 0 ? "→" : "←";
    for (let i = 0; i < 5; i++) {
      const x = 100 + i * (width - 200) / 4;
      ctx.fillText(`I ${arrowDir}`, x, wireY - 15);
    }

    // Current label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(`Current: ${current.toFixed(1)} A`, width / 2, wireY - 35);

    // Battery at one end
    const battX = wireDirection > 0 ? 40 : width - 40;
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(battX - 8, wireY - 15, 16, 30);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px system-ui";
    ctx.fillText(wireDirection > 0 ? "+" : "-", battX, wireY - 2);

    // Other terminal
    const battX2 = wireDirection > 0 ? width - 40 : 40;
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(battX2 - 8, wireY - 15, 16, 30);
    ctx.fillStyle = "#fff";
    ctx.fillText(wireDirection > 0 ? "-" : "+", battX2, wireY - 2);
  }

  function drawMagneticFieldLines(): void {
    if (showFieldLines < 1) return;

    const wireY = height * WIRE_Y_RATIO;

    // Concentric circles around wire (cross-section view shown as field lines)
    const radii = [30, 60, 100, 150, 210];

    for (const r of radii) {
      ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 - r * 0.001})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);

      // Draw circular field line (shown from side as ellipses)
      ctx.beginPath();
      ctx.ellipse(width / 2, wireY, r * 2, r, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Direction arrows on field lines (using right-hand rule)
      const dir = wireDirection > 0 ? 1 : -1;
      const numArrows = 4;
      for (let a = 0; a < numArrows; a++) {
        const angle = (a / numArrows) * Math.PI * 2;
        const ax = width / 2 + r * 2 * Math.cos(angle);
        const ay = wireY + r * Math.sin(angle);

        // Tangent direction (perpendicular to radius)
        const tx = -Math.sin(angle) * dir;
        const ty = Math.cos(angle) * dir;

        ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
        ctx.beginPath();
        ctx.moveTo(ax + tx * 8, ay + ty * 8);
        ctx.lineTo(ax + tx * 4 - ty * 4, ay + ty * 4 + tx * 4);
        ctx.lineTo(ax + tx * 4 + ty * 4, ay + ty * 4 - tx * 4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Cross/dot symbols for field direction (field going into/out of screen)
    ctx.font = "20px system-ui, sans-serif";
    ctx.textAlign = "center";

    // Above wire
    for (let i = 0; i < 3; i++) {
      const x = width * 0.3 + i * width * 0.2;
      const y = wireY - 50 - i * 5;
      ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
      ctx.fillText(wireDirection > 0 ? "⊗" : "⊙", x, y);
    }

    // Below wire
    for (let i = 0; i < 3; i++) {
      const x = width * 0.3 + i * width * 0.2;
      const y = wireY + 50 + i * 5;
      ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
      ctx.fillText(wireDirection > 0 ? "⊙" : "⊗", x, y);
    }

    // Labels
    ctx.fillStyle = "#60a5fa";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(wireDirection > 0 ? "B into page ⊗" : "B out of page ⊙", width * 0.15, wireY - 70);
    ctx.fillText(wireDirection > 0 ? "B out of page ⊙" : "B into page ⊗", width * 0.15, wireY + 90);
  }

  function drawCompass(): void {
    const wireY = height * WIRE_Y_RATIO;
    const compassX = width / 2;
    const compassY = wireY + compassDistance;
    const compassRadius = 40;

    // Compass body
    const compGrad = ctx.createRadialGradient(compassX, compassY, 0, compassX, compassY, compassRadius + 5);
    compGrad.addColorStop(0, "#f8fafc");
    compGrad.addColorStop(0.85, "#e2e8f0");
    compGrad.addColorStop(1, "#94a3b8");
    ctx.beginPath();
    ctx.arc(compassX, compassY, compassRadius + 5, 0, Math.PI * 2);
    ctx.fillStyle = compGrad;
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner face
    ctx.beginPath();
    ctx.arc(compassX, compassY, compassRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Cardinal directions
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "#334155";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", compassX, compassY - compassRadius + 12);
    ctx.fillText("S", compassX, compassY + compassRadius - 12);
    ctx.fillText("E", compassX + compassRadius - 12, compassY);
    ctx.fillText("W", compassX - compassRadius + 12, compassY);

    // Tick marks
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2 - Math.PI / 2;
      const len = i % 9 === 0 ? 8 : i % 3 === 0 ? 5 : 3;
      const inner = compassRadius - len;
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = i % 9 === 0 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(compassX + inner * Math.cos(angle), compassY + inner * Math.sin(angle));
      ctx.lineTo(compassX + compassRadius * Math.cos(angle), compassY + compassRadius * Math.sin(angle));
      ctx.stroke();
    }

    // Needle
    const needleRad = (needleAngle * Math.PI) / 180 - Math.PI / 2;
    const needleLen = compassRadius * 0.75;

    // Red (north) half
    ctx.beginPath();
    ctx.moveTo(compassX + Math.cos(needleRad) * needleLen, compassY + Math.sin(needleRad) * needleLen);
    ctx.lineTo(compassX + Math.cos(needleRad + Math.PI / 2) * 4, compassY + Math.sin(needleRad + Math.PI / 2) * 4);
    ctx.lineTo(compassX + Math.cos(needleRad - Math.PI / 2) * 4, compassY + Math.sin(needleRad - Math.PI / 2) * 4);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // White (south) half
    ctx.beginPath();
    ctx.moveTo(compassX - Math.cos(needleRad) * needleLen, compassY - Math.sin(needleRad) * needleLen);
    ctx.lineTo(compassX + Math.cos(needleRad + Math.PI / 2) * 4, compassY + Math.sin(needleRad + Math.PI / 2) * 4);
    ctx.lineTo(compassX + Math.cos(needleRad - Math.PI / 2) * 4, compassY + Math.sin(needleRad - Math.PI / 2) * 4);
    ctx.closePath();
    ctx.fillStyle = "#e2e8f0";
    ctx.fill();

    // Center pin
    ctx.beginPath();
    ctx.arc(compassX, compassY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#475569";
    ctx.fill();

    // Deflection label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Deflection: ${needleAngle.toFixed(1)}°`, compassX, compassY + compassRadius + 25);

    // Distance label
    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Distance from wire: ${compassDistance} px`, compassX, compassY + compassRadius + 40);
  }

  function drawInfoPanel(): void {
    const panelX = 15;
    const panelY = height * 0.75;
    const panelW = width - 30;
    const panelH = height * 0.22;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Oersted's Experiment (1820)", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 38;
    const lineH = 15;

    ctx.fillText(`Current (I): ${current.toFixed(1)} A flowing ${wireDirection > 0 ? "left to right →" : "right to left ←"}`, panelX + 10, y); y += lineH;
    ctx.fillText(`Compass needle deflection: ${needleAngle.toFixed(1)}° from magnetic north`, panelX + 10, y); y += lineH;

    const fieldStrength = (4 * Math.PI * 1e-7 * current) / (2 * Math.PI * compassDistance * 0.01);
    ctx.fillText(`Magnetic field at compass: B = μ₀I/(2πr) ≈ ${(fieldStrength * 1e6).toFixed(1)} μT`, panelX + 10, y); y += lineH + 3;

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Discovery: An electric current produces a magnetic field that deflects a compass needle.", panelX + 10, y); y += 14;
    ctx.fillText("Right-hand rule: Thumb points in current direction → fingers curl in direction of magnetic field.", panelX + 10, y);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Oersted's Experiment — Current & Magnetism", width / 2, 28);

    drawMagneticFieldLines();
    drawWire();
    drawCompass();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    needleAngle = 0;
    needleVelocity = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const fieldStrength = (4 * Math.PI * 1e-7 * current) / (2 * Math.PI * compassDistance * 0.01);
    return (
      `Oersted's Experiment: Current=${current} A flowing ${wireDirection > 0 ? "right" : "left"}. ` +
      `Compass ${compassDistance} px below wire, deflected ${needleAngle.toFixed(1)}° from north. ` +
      `Magnetic field B = μ₀I/(2πr) ≈ ${(fieldStrength * 1e6).toFixed(1)} μT. ` +
      `Demonstrates that electric current creates a magnetic field (discovered by Hans Christian Oersted, 1820).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default OerstedsExperimentFactory;
