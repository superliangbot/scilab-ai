import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const Pulley3Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pulley-3") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let loadMass = 10;
  let numPulleys = 3;
  let effortForce = 0;
  let pullDistance = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    loadMass = params.loadMass ?? 10;
    numPulleys = Math.round(params.numPulleys ?? 3);
    effortForce = params.effortForce ?? 0;
    time += dt;

    const weight = loadMass * 9.81;
    const ma = numPulleys * 2; // mechanical advantage for compound pulley
    const requiredForce = weight / ma;
    pullDistance = Math.max(0, (effortForce - requiredForce) * 0.3 * time);
    pullDistance = Math.min(pullDistance, 100);
  }

  function drawPulley(cx: number, cy: number, radius: number, isFixed: boolean): void {
    // Bracket for fixed pulleys
    if (isFixed) {
      ctx.fillStyle = "#555";
      ctx.fillRect(cx - 3, cy - radius - 20, 6, 20);
      ctx.fillStyle = "#666";
      ctx.fillRect(cx - 12, cy - radius - 22, 24, 6);
    }

    // Pulley wheel
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, radius);
    grad.addColorStop(0, "#bbb");
    grad.addColorStop(1, "#666");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Groove
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Axle
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ceiling
    ctx.fillStyle = "#444";
    ctx.fillRect(0, 0, width, 15);
    ctx.fillStyle = "#555";
    ctx.fillRect(0, 13, width, 4);

    const weight = loadMass * 9.81;
    const ma = numPulleys * 2;
    const requiredForce = weight / ma;
    const pulleyR = 18;
    const centerX = width * 0.45;

    // Calculate pulley positions
    const fixedY = 50;
    const movableBaseY = height * 0.45 + Math.max(0, -pullDistance * 0.3);
    const spacing = 60;

    // Draw rope and pulleys
    ctx.strokeStyle = "#cc9944";
    ctx.lineWidth = 2.5;

    const fixedPulleys: { x: number; y: number }[] = [];
    const movablePulleys: { x: number; y: number }[] = [];

    for (let i = 0; i < numPulleys; i++) {
      const fx = centerX - (numPulleys - 1) * spacing / 2 + i * spacing;
      fixedPulleys.push({ x: fx, y: fixedY + 30 });

      const mx = fx;
      movablePulleys.push({ x: mx, y: movableBaseY + 30 });
    }

    // Draw ropes threading through pulleys
    let ropeX = fixedPulleys[0].x - pulleyR - 10;
    let ropeY = height * 0.8;

    ctx.beginPath();
    ctx.moveTo(ropeX, ropeY);

    for (let i = 0; i < numPulleys; i++) {
      // Up to fixed pulley
      ctx.lineTo(fixedPulleys[i].x - (i === 0 ? pulleyR : 0), fixedPulleys[i].y);
      // Down to movable pulley
      ctx.lineTo(movablePulleys[i].x, movablePulleys[i].y);
      // Up to next fixed (or end)
      if (i < numPulleys - 1) {
        ctx.lineTo(fixedPulleys[i + 1].x, fixedPulleys[i + 1].y);
      }
    }
    // Free end goes up to ceiling
    ctx.lineTo(movablePulleys[numPulleys - 1].x + pulleyR + 20, fixedY);
    ctx.strokeStyle = "#cc9944";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw pulleys
    for (const fp of fixedPulleys) {
      drawPulley(fp.x, fp.y, pulleyR, true);
    }
    for (const mp of movablePulleys) {
      drawPulley(mp.x, mp.y, pulleyR, false);
    }

    // Draw load attached to movable pulleys
    const loadCenterX = centerX;
    const loadY = movableBaseY + 60;

    // Connecting bar between movable pulleys
    if (movablePulleys.length > 1) {
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(movablePulleys[0].x, movablePulleys[0].y + pulleyR);
      ctx.lineTo(movablePulleys[numPulleys - 1].x, movablePulleys[numPulleys - 1].y + pulleyR);
      ctx.stroke();
    }

    // Hook
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(loadCenterX, movableBaseY + 48);
    ctx.lineTo(loadCenterX, loadY - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(loadCenterX, loadY - 5, 5, 0, Math.PI, false);
    ctx.stroke();

    // Load box
    const boxW = 60;
    const boxH = 50;
    const loadGrad = ctx.createLinearGradient(loadCenterX - boxW / 2, loadY, loadCenterX + boxW / 2, loadY + boxH);
    loadGrad.addColorStop(0, "#cc4444");
    loadGrad.addColorStop(1, "#882222");
    ctx.fillStyle = loadGrad;
    ctx.beginPath();
    ctx.roundRect(loadCenterX - boxW / 2, loadY, boxW, boxH, 5);
    ctx.fill();
    ctx.strokeStyle = "#aa3333";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${loadMass} kg`, loadCenterX, loadY + boxH / 2 + 5);

    // Weight arrow
    ctx.strokeStyle = "rgba(255, 100, 100, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(loadCenterX, loadY + boxH + 5);
    ctx.lineTo(loadCenterX, loadY + boxH + 35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(loadCenterX, loadY + boxH + 35);
    ctx.lineTo(loadCenterX - 5, loadY + boxH + 28);
    ctx.moveTo(loadCenterX, loadY + boxH + 35);
    ctx.lineTo(loadCenterX + 5, loadY + boxH + 28);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`W = ${weight.toFixed(1)} N`, loadCenterX + 40, loadY + boxH + 25);

    // Effort force arrow on free end
    const effortX = movablePulleys[numPulleys - 1].x + pulleyR + 20;
    ctx.strokeStyle = "rgba(100, 200, 100, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(effortX, fixedY + 60);
    ctx.lineTo(effortX, fixedY + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(effortX, fixedY + 10);
    ctx.lineTo(effortX - 5, fixedY + 17);
    ctx.moveTo(effortX, fixedY + 10);
    ctx.lineTo(effortX + 5, fixedY + 17);
    ctx.stroke();
    ctx.fillStyle = "rgba(100, 200, 100, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`F = ${effortForce.toFixed(1)} N`, effortX + 15, fixedY + 40);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(width * 0.65, height * 0.55, width * 0.32, height * 0.38, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const panelX = width * 0.67;
    let py = height * 0.6;

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Compound Pulley System", panelX, py);
    py += 25;

    const infoLines = [
      [`Pulleys:`, `${numPulleys}`],
      [`Mechanical Adv:`, `${ma}x`],
      [`Load Weight:`, `${weight.toFixed(1)} N`],
      [`Min Effort:`, `${requiredForce.toFixed(1)} N`],
      [`Applied Force:`, `${effortForce.toFixed(1)} N`],
      [`Status:`, effortForce >= requiredForce ? "Lifting!" : "Too little force"],
    ];

    ctx.font = "12px system-ui, sans-serif";
    for (const [label, value] of infoLines) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.textAlign = "left";
      ctx.fillText(label, panelX, py);
      ctx.fillStyle = "rgba(180, 220, 255, 0.9)";
      ctx.textAlign = "right";
      ctx.fillText(value, width * 0.95, py);
      py += 22;
    }

    // Formula
    py += 10;
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.font = "bold 12px 'SF Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`F = W / MA`, panelX, py);
    ctx.fillText(`F = ${weight.toFixed(1)} / ${ma} = ${requiredForce.toFixed(1)} N`, panelX, py + 18);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Compound Pulley System", width / 2, height - 20);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    pullDistance = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const weight = loadMass * 9.81;
    const ma = numPulleys * 2;
    const requiredForce = weight / ma;
    return (
      `Compound pulley system with ${numPulleys} pulleys. ` +
      `Load mass: ${loadMass} kg (weight: ${weight.toFixed(1)} N). ` +
      `Mechanical advantage: ${ma}x. Required effort force: ${requiredForce.toFixed(1)} N. ` +
      `Applied force: ${effortForce.toFixed(1)} N. ` +
      `${effortForce >= requiredForce ? "The load is being lifted." : "Insufficient force to lift the load."} ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Pulley3Factory;
