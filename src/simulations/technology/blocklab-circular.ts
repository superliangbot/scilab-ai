import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const BlocklabCircularFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("blocklab-circular") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let orbitRadius = 100;  // px
  let angularSpeed = 3;   // rad/s
  let mass = 1;           // kg
  let showVectors = 1;

  // Current angle
  let theta = 0;

  // Layout
  let dividerX = 0;
  let simCx = 0;
  let simCy = 0;
  let blockPanelX = 0;
  let blockPanelW = 0;

  // Block definitions (visual code blocks)
  interface CodeBlock {
    label: string;
    color: string;
    borderColor: string;
    lines: string[];
  }

  function getBlocks(): CodeBlock[] {
    const v = (angularSpeed * orbitRadius).toFixed(1);
    const ac = (angularSpeed * angularSpeed * orbitRadius).toFixed(1);
    const fc = (mass * angularSpeed * angularSpeed * orbitRadius).toFixed(1);
    const period = ((2 * Math.PI) / angularSpeed).toFixed(2);

    return [
      {
        label: "SET RADIUS",
        color: "rgba(59, 130, 246, 0.25)",
        borderColor: "#3b82f6",
        lines: [`radius = ${orbitRadius} px`],
      },
      {
        label: "SET ANGULAR SPEED",
        color: "rgba(168, 85, 247, 0.25)",
        borderColor: "#a855f7",
        lines: [`\u03C9 = ${angularSpeed.toFixed(1)} rad/s`],
      },
      {
        label: "COMPUTE VELOCITY",
        color: "rgba(34, 197, 94, 0.25)",
        borderColor: "#22c55e",
        lines: [`v = \u03C9 \u00D7 r`, `v = ${v} px/s`],
      },
      {
        label: "COMPUTE ACCELERATION",
        color: "rgba(245, 158, 11, 0.25)",
        borderColor: "#f59e0b",
        lines: [`a_c = \u03C9\u00B2 \u00D7 r = v\u00B2/r`, `a_c = ${ac} px/s\u00B2`],
      },
      {
        label: "COMPUTE FORCE",
        color: "rgba(239, 68, 68, 0.25)",
        borderColor: "#ef4444",
        lines: [`F_c = m \u00D7 a_c`, `F_c = ${fc} N`],
      },
      {
        label: "COMPUTE PERIOD",
        color: "rgba(6, 182, 212, 0.25)",
        borderColor: "#06b6d4",
        lines: [`T = 2\u03C0/\u03C9`, `T = ${period} s`],
      },
    ];
  }

  function computeLayout(): void {
    // Left 35%: code blocks, right 65%: simulation
    blockPanelX = 10;
    blockPanelW = width * 0.33;
    dividerX = blockPanelW + 20;
    simCx = dividerX + (width - dividerX) / 2;
    simCy = height * 0.48;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    theta = 0;
    computeLayout();
  }

  function update(dt: number, params: Record<string, number>): void {
    orbitRadius = params.radius ?? 100;
    angularSpeed = params.speed ?? 3;
    mass = params.mass ?? 1;
    showVectors = params.showVectors ?? 1;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;
    theta += angularSpeed * dtClamped;
    if (theta > Math.PI * 200) theta -= Math.PI * 200;
  }

  // -- Rendering --

  function renderBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#0d0d24");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function renderDivider(): void {
    const grad = ctx.createLinearGradient(dividerX, height * 0.05, dividerX, height * 0.95);
    grad.addColorStop(0, "rgba(255, 255, 255, 0)");
    grad.addColorStop(0.2, "rgba(255, 255, 255, 0.1)");
    grad.addColorStop(0.5, "rgba(255, 255, 255, 0.15)");
    grad.addColorStop(0.8, "rgba(255, 255, 255, 0.1)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.moveTo(dividerX, height * 0.05);
    ctx.lineTo(dividerX, height * 0.95);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function renderCodeBlocks(): void {
    const blocks = getBlocks();
    const startY = 50;
    const blockH = 50;
    const gap = 8;
    const bw = Math.min(blockPanelW - 20, 260);

    // Title
    const titleFs = Math.max(12, Math.min(width, height) * 0.02);
    ctx.font = `bold ${titleFs}px 'Inter', system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Code Blocks", blockPanelX, 14);

    ctx.font = `${Math.max(9, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillText("Visual program for circular motion", blockPanelX, 14 + titleFs + 4);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const by = startY + i * (blockH + gap);

      // Block body
      ctx.fillStyle = block.color;
      ctx.beginPath();
      ctx.roundRect(blockPanelX, by, bw, blockH, 6);
      ctx.fill();

      // Block border
      ctx.strokeStyle = block.borderColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(blockPanelX, by, bw, blockH, 6);
      ctx.stroke();

      // Notch at top (block connector)
      if (i > 0) {
        ctx.fillStyle = block.borderColor;
        ctx.beginPath();
        ctx.roundRect(blockPanelX + 20, by - 3, 30, 6, 2);
        ctx.fill();
      }

      // Notch at bottom (block connector)
      if (i < blocks.length - 1) {
        ctx.fillStyle = block.borderColor;
        ctx.beginPath();
        ctx.roundRect(blockPanelX + 20, by + blockH - 3, 30, 6, 2);
        ctx.fill();
      }

      // Block label
      const labelFs = Math.max(9, Math.min(width, height) * 0.014);
      ctx.font = `bold ${labelFs}px 'Inter', system-ui, sans-serif`;
      ctx.fillStyle = block.borderColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(block.label, blockPanelX + 8, by + 6);

      // Block content lines
      ctx.font = `${Math.max(9, Math.min(width, height) * 0.013)}px 'Inter', system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      for (let j = 0; j < block.lines.length; j++) {
        ctx.fillText(block.lines[j], blockPanelX + 12, by + 6 + labelFs + 4 + j * (labelFs + 2));
      }
    }

    // Execution arrow
    const arrowX = blockPanelX + bw + 8;
    const arrowStartY = startY + 10;
    const arrowEndY = startY + blocks.length * (blockH + gap) - gap - 10;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowStartY);
    ctx.lineTo(arrowX, arrowEndY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow head
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowEndY + 6);
    ctx.lineTo(arrowX - 4, arrowEndY);
    ctx.lineTo(arrowX + 4, arrowEndY);
    ctx.closePath();
    ctx.fill();

    // Running indicator
    const indicatorY = arrowStartY + ((time * 30) % (arrowEndY - arrowStartY));
    ctx.beginPath();
    ctx.arc(arrowX, indicatorY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#22c55e";
    ctx.fill();
  }

  function renderCircularMotion(): void {
    const cx = simCx;
    const cy = simCy;
    const r = orbitRadius;

    // Title
    const titleFs = Math.max(12, Math.min(width, height) * 0.02);
    ctx.font = `bold ${titleFs}px 'Inter', system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Circular Motion Simulation", cx, 14);

    // Orbit circle (dashed)
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100, 200, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center point
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fill();

    // Radius line from center to object
    const objX = cx + r * Math.cos(theta);
    const objY = cy + r * Math.sin(theta);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(objX, objY);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Radius label
    const midX = (cx + objX) / 2;
    const midY = (cy + objY) / 2;
    const labelFs = Math.max(9, Math.min(width, height) * 0.013);
    ctx.font = `${labelFs}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`r = ${orbitRadius}`, midX - 10, midY - 5);

    // Object trail (fading arc behind the object)
    const trailLen = Math.PI * 0.8;
    const trailSegments = 40;
    for (let i = 0; i < trailSegments; i++) {
      const t0 = theta - trailLen * (i / trailSegments);
      const t1 = theta - trailLen * ((i + 1) / trailSegments);
      const alpha = (1 - i / trailSegments) * 0.4;
      const lw = (1 - i / trailSegments) * 3;

      ctx.beginPath();
      ctx.arc(cx, cy, r, t1, t0);
      ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    // Object glow
    const objGlow = ctx.createRadialGradient(objX, objY, 0, objX, objY, 25);
    objGlow.addColorStop(0, "rgba(59, 130, 246, 0.3)");
    objGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.beginPath();
    ctx.arc(objX, objY, 25, 0, Math.PI * 2);
    ctx.fillStyle = objGlow;
    ctx.fill();

    // Object body
    const objR = 10;
    const bodyGrad = ctx.createRadialGradient(
      objX - objR * 0.3, objY - objR * 0.3, 0,
      objX, objY, objR
    );
    bodyGrad.addColorStop(0, "#ffffff");
    bodyGrad.addColorStop(0.3, "#3b82f6");
    bodyGrad.addColorStop(1, "#1e3a8a");
    ctx.beginPath();
    ctx.arc(objX, objY, objR, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mass label on object
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `bold ${Math.max(8, objR * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mass}kg`, objX, objY);

    // Vectors
    if (showVectors >= 0.5) {
      renderVectors(cx, cy, objX, objY);
    }
  }

  function renderVectors(cx: number, cy: number, objX: number, objY: number): void {
    const v = angularSpeed * orbitRadius;
    const ac = angularSpeed * angularSpeed * orbitRadius;

    // Scale vectors for visual clarity
    const maxVecLen = Math.min(width, height) * 0.18;
    const vScale = Math.min(maxVecLen / Math.max(v, 1), 1.5);
    const aScale = Math.min(maxVecLen / Math.max(ac, 1), 0.8);

    // Tangential velocity vector (perpendicular to radius, tangent to circle)
    const vTangentX = -Math.sin(theta); // perpendicular to radius outward
    const vTangentY = Math.cos(theta);
    const vLen = v * vScale;

    const vEndX = objX + vTangentX * vLen;
    const vEndY = objY + vTangentY * vLen;

    // Draw velocity arrow
    ctx.strokeStyle = "rgba(34, 197, 94, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(objX, objY);
    ctx.lineTo(vEndX, vEndY);
    ctx.stroke();

    // Velocity arrowhead
    const vAngle = Math.atan2(vTangentY, vTangentX);
    ctx.beginPath();
    ctx.moveTo(vEndX, vEndY);
    ctx.lineTo(vEndX - 10 * Math.cos(vAngle - 0.4), vEndY - 10 * Math.sin(vAngle - 0.4));
    ctx.moveTo(vEndX, vEndY);
    ctx.lineTo(vEndX - 10 * Math.cos(vAngle + 0.4), vEndY - 10 * Math.sin(vAngle + 0.4));
    ctx.stroke();

    // Velocity label
    ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`v = ${v.toFixed(1)}`, vEndX + vTangentX * 12, vEndY + vTangentY * 12 - 2);

    // Centripetal acceleration vector (pointing toward center)
    const acDirX = cx - objX;
    const acDirY = cy - objY;
    const acDirLen = Math.sqrt(acDirX * acDirX + acDirY * acDirY);
    if (acDirLen > 0) {
      const acNx = acDirX / acDirLen;
      const acNy = acDirY / acDirLen;
      const aLen = ac * aScale;

      const aEndX = objX + acNx * aLen;
      const aEndY = objY + acNy * aLen;

      // Draw acceleration arrow (dashed)
      ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(objX, objY);
      ctx.lineTo(aEndX, aEndY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Acceleration arrowhead
      const aAngle = Math.atan2(acNy, acNx);
      ctx.beginPath();
      ctx.moveTo(aEndX, aEndY);
      ctx.lineTo(aEndX - 10 * Math.cos(aAngle - 0.4), aEndY - 10 * Math.sin(aAngle - 0.4));
      ctx.moveTo(aEndX, aEndY);
      ctx.lineTo(aEndX - 10 * Math.cos(aAngle + 0.4), aEndY - 10 * Math.sin(aAngle + 0.4));
      ctx.stroke();

      // Acceleration label
      ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`a_c = ${ac.toFixed(1)}`, aEndX + acNx * 16, aEndY + acNy * 16);

      // Force vector (same direction as acceleration but different magnitude label)
      const fc = mass * ac;
      // Show force label near the acceleration arrow base
      ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
      ctx.font = "bold 10px system-ui, sans-serif";
      const fLabelX = objX + acNx * aLen * 0.5 + acNy * 16;
      const fLabelY = objY + acNy * aLen * 0.5 - acNx * 16;
      ctx.fillText(`F_c = ${fc.toFixed(1)} N`, fLabelX, fLabelY);
    }
  }

  function renderInfoPanel(): void {
    const v = angularSpeed * orbitRadius;
    const ac = angularSpeed * angularSpeed * orbitRadius;
    const fc = mass * ac;
    const period = (2 * Math.PI) / angularSpeed;

    const panelW = Math.min(240, (width - dividerX) * 0.6);
    const panelH = 130;
    const panelX = simCx - panelW / 2;
    const panelY = height - panelH - 16;

    // Panel background
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();

    const fs = Math.max(10, Math.min(width, height) * 0.015);
    const lineH = fs + 5;
    const px = panelX + 10;
    let py = panelY + 8;

    ctx.font = `bold ${fs}px 'Inter', system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Circular Motion Physics", px, py);
    py += lineH + 2;

    ctx.font = `${Math.max(9, fs - 1)}px system-ui, sans-serif`;

    ctx.fillStyle = "#22c55e";
    ctx.fillText(`v = \u03C9r = ${v.toFixed(1)} px/s`, px, py);
    py += lineH;

    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`a_c = \u03C9\u00B2r = ${ac.toFixed(1)} px/s\u00B2`, px, py);
    py += lineH;

    ctx.fillStyle = "#ef4444";
    ctx.fillText(`F_c = mv\u00B2/r = ${fc.toFixed(1)} N`, px, py);
    py += lineH;

    ctx.fillStyle = "#06b6d4";
    ctx.fillText(`T = 2\u03C0r/v = ${period.toFixed(3)} s`, px, py);
    py += lineH;

    ctx.fillStyle = "#a855f7";
    ctx.fillText(`\u03C9 = ${angularSpeed.toFixed(1)} rad/s  |  m = ${mass} kg`, px, py);
  }

  function renderVectorLegend(): void {
    if (showVectors < 0.5) return;

    const legendX = dividerX + 14;
    const legendY = height - 50;
    const fs = Math.max(9, Math.min(width, height) * 0.013);

    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Velocity legend
    ctx.strokeStyle = "rgba(34, 197, 94, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
    ctx.fillText("Velocity (tangent)", legendX + 24, legendY);

    // Acceleration legend
    ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 18);
    ctx.lineTo(legendX + 20, legendY + 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(245, 158, 11, 0.85)";
    ctx.fillText("Centripetal accel. (inward)", legendX + 24, legendY + 18);
  }

  function renderHUD(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, width - 10, height - 6);
  }

  function render(): void {
    renderBackground();
    renderDivider();

    // Left panel: code blocks
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, dividerX, height);
    ctx.clip();
    renderCodeBlocks();
    ctx.restore();

    // Right panel: simulation
    ctx.save();
    ctx.beginPath();
    ctx.rect(dividerX, 0, width - dividerX, height);
    ctx.clip();
    renderCircularMotion();
    renderInfoPanel();
    renderVectorLegend();
    ctx.restore();

    renderHUD();
  }

  function reset(): void {
    time = 0;
    theta = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const v = angularSpeed * orbitRadius;
    const ac = angularSpeed * angularSpeed * orbitRadius;
    const fc = mass * ac;
    const period = (2 * Math.PI) / angularSpeed;

    return (
      `BlockLab Circular Motion | ` +
      `radius=${orbitRadius}px, \u03C9=${angularSpeed.toFixed(1)} rad/s, mass=${mass} kg | ` +
      `v = \u03C9r = ${v.toFixed(1)} px/s | ` +
      `a_c = \u03C9\u00B2r = ${ac.toFixed(1)} px/s\u00B2 | ` +
      `F_c = mv\u00B2/r = ${fc.toFixed(1)} N | ` +
      `Period T = 2\u03C0/\u03C9 = ${period.toFixed(3)} s | ` +
      `Vectors: ${showVectors >= 0.5 ? "shown" : "hidden"} | ` +
      `Time: ${time.toFixed(1)}s`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
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

export default BlocklabCircularFactory;
