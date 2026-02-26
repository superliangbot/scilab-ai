import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const OnTheTableFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("on-the-table") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let mass = 2; // kg
  let friction = 0.3; // coefficient of friction
  let appliedForce = 15; // Newtons
  let angle = 0; // angle of applied force above horizontal (degrees)

  // Physics state
  let posX = 0;
  let velX = 0;
  let accX = 0;
  let isMoving = false;

  // Derived forces
  let normalForce = 0;
  let gravitationalForce = 0;
  let frictionForce = 0;
  let netForce = 0;
  let appliedForceX = 0;
  let appliedForceY = 0;

  const GRAVITY = 9.81;
  const TABLE_Y_RATIO = 0.5;

  // Position tracking for displacement display
  let initialPosX = 0;
  let displacement = 0;

  function computeForces(): void {
    gravitationalForce = mass * GRAVITY;
    const angleRad = (angle * Math.PI) / 180;
    appliedForceX = appliedForce * Math.cos(angleRad);
    appliedForceY = appliedForce * Math.sin(angleRad);

    // Normal force = mg - Fy (vertical component of applied force lifts object)
    normalForce = Math.max(0, gravitationalForce - appliedForceY);

    // Max static/kinetic friction
    const maxFriction = friction * normalForce;

    if (!isMoving) {
      // Check if applied force overcomes static friction
      if (Math.abs(appliedForceX) > maxFriction) {
        isMoving = true;
        frictionForce = maxFriction * (appliedForceX > 0 ? -1 : 1);
      } else {
        frictionForce = -appliedForceX; // Static friction matches applied force
      }
    } else {
      // Kinetic friction
      frictionForce = velX > 0 ? -maxFriction : velX < 0 ? maxFriction : 0;
    }

    netForce = appliedForceX + frictionForce;
    accX = netForce / mass;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    posX = 0;
    velX = 0;
    accX = 0;
    isMoving = false;
    displacement = 0;
    initialPosX = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    mass = params.mass ?? 2;
    friction = params.friction ?? 0.3;
    appliedForce = params.appliedForce ?? 15;
    angle = params.angle ?? 0;

    time += dt;
    computeForces();

    if (isMoving) {
      velX += accX * dt;
      posX += velX * dt;

      // Stop if velocity is very small and friction opposes motion
      if (Math.abs(velX) < 0.01 && Math.abs(netForce) < 0.01) {
        velX = 0;
        isMoving = false;
      }

      // Limit position to table
      if (posX > 200) posX = 200;
      if (posX < -100) posX = -100;
    }

    displacement = posX - initialPosX;
  }

  function drawTable(): void {
    const tableY = height * TABLE_Y_RATIO;

    // Table surface
    const tableGrad = ctx.createLinearGradient(0, tableY, 0, tableY + 30);
    tableGrad.addColorStop(0, "#92400e");
    tableGrad.addColorStop(0.3, "#78350f");
    tableGrad.addColorStop(1, "#451a03");
    ctx.fillStyle = tableGrad;
    ctx.fillRect(30, tableY, width - 60, 30);

    // Table top highlight
    ctx.fillStyle = "rgba(161, 98, 7, 0.4)";
    ctx.fillRect(30, tableY, width - 60, 3);

    // Table legs
    ctx.fillStyle = "#78350f";
    ctx.fillRect(60, tableY + 30, 12, 100);
    ctx.fillRect(width - 72, tableY + 30, 12, 100);

    // Wood grain
    ctx.strokeStyle = "rgba(120, 53, 15, 0.3)";
    ctx.lineWidth = 0.5;
    for (let y = tableY + 5; y < tableY + 25; y += 6) {
      ctx.beginPath();
      ctx.moveTo(35, y);
      for (let x = 35; x < width - 35; x += 20) {
        ctx.lineTo(x + 10, y + Math.sin(x * 0.02) * 2);
      }
      ctx.stroke();
    }
  }

  function drawBlock(): void {
    const tableY = height * TABLE_Y_RATIO;
    const blockW = 60 + mass * 5;
    const blockH = 40 + mass * 3;
    const blockX = width * 0.35 + posX * 2 - blockW / 2;
    const blockY = tableY - blockH;

    // Block shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(blockX + 5, blockY + 5, blockW, blockH);

    // Block
    const blockGrad = ctx.createLinearGradient(blockX, blockY, blockX + blockW, blockY + blockH);
    blockGrad.addColorStop(0, "#3b82f6");
    blockGrad.addColorStop(0.5, "#2563eb");
    blockGrad.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = blockGrad;
    ctx.fillRect(blockX, blockY, blockW, blockH);

    // Block edge highlight
    ctx.strokeStyle = "rgba(147, 197, 253, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(blockX, blockY, blockW, blockH);

    // Mass label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mass} kg`, blockX + blockW / 2, blockY + blockH / 2);

    const centerX = blockX + blockW / 2;
    const centerY = blockY + blockH / 2;

    // Force vectors
    const forceScale = 2.5;

    // Gravity (down)
    drawForceArrow(centerX, centerY, centerX, centerY + gravitationalForce * forceScale, "#ef4444", "mg");

    // Normal force (up)
    drawForceArrow(centerX + 5, centerY, centerX + 5, centerY - normalForce * forceScale, "#22c55e", "N");

    // Applied force
    if (appliedForce > 0) {
      const angleRad = (angle * Math.PI) / 180;
      const fx = centerX + appliedForce * forceScale * Math.cos(angleRad);
      const fy = centerY - appliedForce * forceScale * Math.sin(angleRad);
      drawForceArrow(centerX, centerY, fx, fy, "#fbbf24", "F");
    }

    // Friction force
    if (Math.abs(frictionForce) > 0.1) {
      drawForceArrow(
        centerX, centerY + blockH / 2 - 5,
        centerX + frictionForce * forceScale, centerY + blockH / 2 - 5,
        "#a78bfa", "f"
      );
    }

    // Net force
    if (Math.abs(netForce) > 0.1) {
      drawForceArrow(
        centerX, blockY - 15,
        centerX + netForce * forceScale * 2, blockY - 15,
        "#f97316", "Fnet"
      );
    }
  }

  function drawForceArrow(
    x1: number, y1: number, x2: number, y2: number,
    color: string, label: string
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 3) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    const headLen = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    const labelX = (x1 + x2) / 2 + dy / len * 12;
    const labelY = (y1 + y2) / 2 - dx / len * 12;
    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX, labelY);
  }

  function drawFBD(): void {
    // Free body diagram in corner
    const fbdX = width * 0.78;
    const fbdY = height * 0.08;
    const fbdSize = 100;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(fbdX - 15, fbdY - 15, fbdSize + 70, fbdSize + 50, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Free Body Diagram", fbdX + fbdSize / 2 + 15, fbdY);

    const cx = fbdX + fbdSize / 2 + 15;
    const cy = fbdY + fbdSize / 2 + 10;

    // Block
    ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
    ctx.fillRect(cx - 15, cy - 12, 30, 24);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 15, cy - 12, 30, 24);

    const scale = 1.5;

    // mg down
    drawForceArrow(cx, cy, cx, cy + gravitationalForce * scale, "#ef4444", "mg");

    // N up
    drawForceArrow(cx + 3, cy, cx + 3, cy - normalForce * scale, "#22c55e", "N");

    // F applied
    if (appliedForce > 0) {
      const angleRad = (angle * Math.PI) / 180;
      drawForceArrow(cx, cy,
        cx + appliedForce * scale * Math.cos(angleRad),
        cy - appliedForce * scale * Math.sin(angleRad),
        "#fbbf24", "F"
      );
    }

    // friction
    if (Math.abs(frictionForce) > 0.1) {
      drawForceArrow(cx, cy + 8, cx + frictionForce * scale, cy + 8, "#a78bfa", "f");
    }
  }

  function drawInfoPanel(): void {
    const panelX = 15;
    const panelY = height * 0.65;
    const panelW = width * 0.55;
    const panelH = height * 0.3;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Forces on the Table", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    let y = panelY + 38;
    const lineH = 16;

    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Weight (mg): ${gravitationalForce.toFixed(2)} N ↓`, panelX + 10, y); y += lineH;
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`Normal Force (N): ${normalForce.toFixed(2)} N ↑`, panelX + 10, y); y += lineH;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Applied Force: ${appliedForce.toFixed(1)} N at ${angle}° (Fx=${appliedForceX.toFixed(2)}, Fy=${appliedForceY.toFixed(2)})`, panelX + 10, y); y += lineH;
    ctx.fillStyle = "#a78bfa";
    ctx.fillText(`Friction (f = μN): ${Math.abs(frictionForce).toFixed(2)} N ${frictionForce < 0 ? "←" : "→"}  (μ=${friction})`, panelX + 10, y); y += lineH;
    ctx.fillStyle = "#f97316";
    ctx.fillText(`Net Force: ${netForce.toFixed(2)} N → Acceleration: ${accX.toFixed(2)} m/s²`, panelX + 10, y); y += lineH;

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Velocity: ${velX.toFixed(2)} m/s  |  Displacement: ${displacement.toFixed(2)} m`, panelX + 10, y); y += lineH;

    ctx.fillStyle = isMoving ? "#22c55e" : "#ef4444";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(isMoving ? "Object is MOVING" : "Object is STATIONARY (static friction balances applied force)", panelX + 10, y);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#1e293b");
    bgGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Floor
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, height * TABLE_Y_RATIO + 130, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Forces On The Table — Newton's Laws", width / 2, 28);

    drawTable();
    drawBlock();
    drawFBD();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    posX = 0;
    velX = 0;
    accX = 0;
    isMoving = false;
    displacement = 0;
    initialPosX = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `On The Table: mass=${mass} kg, applied force=${appliedForce} N at ${angle}°, μ=${friction}. ` +
      `Weight=${gravitationalForce.toFixed(2)} N, Normal=${normalForce.toFixed(2)} N, ` +
      `Friction=${Math.abs(frictionForce).toFixed(2)} N, Net force=${netForce.toFixed(2)} N. ` +
      `Acceleration=${accX.toFixed(2)} m/s², velocity=${velX.toFixed(2)} m/s. ` +
      `Object is ${isMoving ? "moving" : "stationary"}. ` +
      `Demonstrates Newton's 2nd law (F=ma) and friction (f=μN).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default OnTheTableFactory;
