import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const AdditionOfForce2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("addition-of-force-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let force1 = 8;
  let force2 = 8;
  let angle = 60;
  let showResultant = 1;

  // Scale: pixels per Newton for force vectors
  const SCALE = 14;

  function degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    force1 = params.force1 ?? 8;
    force2 = params.force2 ?? 8;
    angle = params.angle ?? 60;
    showResultant = params.showResultant ?? 1;
  }

  /** Draw an arrowhead at the tip */
  function drawArrowhead(
    tipX: number,
    tipY: number,
    canvasAngle: number,
    size: number,
    color: string
  ): void {
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(canvasAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.4);
    ctx.lineTo(-size * 0.65, 0);
    ctx.lineTo(-size, size * 0.4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  /** Draw a vector arrow from (x1,y1) to (x2,y2) */
  function drawVector(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth: number,
    arrowSize: number
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const a = Math.atan2(dy, dx);
    const shortenBy = arrowSize * 0.6;
    const endX = x2 - (shortenBy * dx) / len;
    const endY = y2 - (shortenBy * dy) / len;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
    drawArrowhead(x2, y2, a, arrowSize, color);
  }

  /** Draw a dashed line */
  function drawDashedLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lineWidth: number
  ): void {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** Draw the stick-figure person pulling the block */
  function drawFigure(
    blockCX: number,
    blockCY: number,
    blockW: number,
    blockH: number,
    halfAngleRad: number
  ): void {
    // Person stands to the right of the block
    const figureX = blockCX + blockW * 0.5 + 20;
    const figureY = blockCY;

    // Head
    const headR = Math.min(width, height) * 0.028;
    const headCY = figureY - headR * 3.2;
    ctx.beginPath();
    ctx.arc(figureX, headCY, headR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 200, 180, 0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 160, 140, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes
    const eyeOffset = headR * 0.3;
    ctx.fillStyle = "rgba(40, 40, 60, 0.8)";
    ctx.beginPath();
    ctx.arc(figureX - eyeOffset, headCY - headR * 0.1, headR * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(figureX + eyeOffset, headCY - headR * 0.1, headR * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.beginPath();
    ctx.arc(figureX, headCY + headR * 0.1, headR * 0.35, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.strokeStyle = "rgba(40, 40, 60, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Body (torso)
    const bodyTopY = headCY + headR;
    const bodyBottomY = figureY + headR * 1.0;
    ctx.beginPath();
    ctx.moveTo(figureX, bodyTopY);
    ctx.lineTo(figureX, bodyBottomY);
    ctx.strokeStyle = "rgba(100, 140, 200, 0.8)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();

    // Legs
    const legLen = headR * 1.8;
    ctx.beginPath();
    ctx.moveTo(figureX, bodyBottomY);
    ctx.lineTo(figureX - headR * 0.6, bodyBottomY + legLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(figureX, bodyBottomY);
    ctx.lineTo(figureX + headR * 0.6, bodyBottomY + legLen);
    ctx.stroke();

    // Feet
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(figureX - headR * 0.6, bodyBottomY + legLen);
    ctx.lineTo(figureX - headR * 0.6 - headR * 0.3, bodyBottomY + legLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(figureX + headR * 0.6, bodyBottomY + legLen);
    ctx.lineTo(figureX + headR * 0.6 + headR * 0.3, bodyBottomY + legLen);
    ctx.stroke();

    // Shoulder position
    const shoulderY = bodyTopY + headR * 0.5;

    // Arms extend from shoulders toward the block at +-halfAngle
    // Upper arm goes from shoulder toward the block edge
    const armLen = Math.max(30, Math.sqrt(
      (blockCX - figureX) * (blockCX - figureX) +
      (blockCY - shoulderY) * (blockCY - shoulderY)
    ) * 0.8);

    // Arm 1 (upper) - angles upward
    const arm1EndX = figureX - armLen * Math.cos(halfAngleRad * 0.5);
    const arm1EndY = shoulderY - armLen * Math.sin(halfAngleRad * 0.5);

    // Arm 2 (lower) - angles downward
    const arm2EndX = figureX - armLen * Math.cos(halfAngleRad * 0.5);
    const arm2EndY = shoulderY + armLen * Math.sin(halfAngleRad * 0.5);

    // Draw arms
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(220, 200, 180, 0.85)";

    // Arm 1
    ctx.beginPath();
    ctx.moveTo(figureX, shoulderY);
    ctx.lineTo(arm1EndX, arm1EndY);
    ctx.stroke();

    // Hand 1 (small circle)
    ctx.beginPath();
    ctx.arc(arm1EndX, arm1EndY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 200, 180, 0.9)";
    ctx.fill();

    // Arm 2
    ctx.beginPath();
    ctx.moveTo(figureX, shoulderY);
    ctx.lineTo(arm2EndX, arm2EndY);
    ctx.stroke();

    // Hand 2 (small circle)
    ctx.beginPath();
    ctx.arc(arm2EndX, arm2EndY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 200, 180, 0.9)";
    ctx.fill();
  }

  /** Draw the rectangular block */
  function drawBlock(cx: number, cy: number, bw: number, bh: number): void {
    // Block shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2 + 3, cy - bh / 2 + 3, bw, bh, 4);
    ctx.fill();

    // Block body
    const blockGrad = ctx.createLinearGradient(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2);
    blockGrad.addColorStop(0, "#5a7a9a");
    blockGrad.addColorStop(0.5, "#4a6a8a");
    blockGrad.addColorStop(1, "#3a5a7a");
    ctx.fillStyle = blockGrad;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 4);
    ctx.fill();

    // Block border
    ctx.strokeStyle = "rgba(150, 180, 210, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 4);
    ctx.stroke();

    // Block label
    ctx.fillStyle = "rgba(200, 220, 240, 0.8)";
    ctx.font = `bold ${Math.max(10, Math.min(bw, bh) * 0.28)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Block", cx, cy);
  }

  /** Draw angle arc */
  function drawAngleArc(
    ox: number,
    oy: number,
    startAngleRad: number,
    endAngleRad: number,
    radius: number,
    color: string,
    label: string
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ox, oy, radius, startAngleRad, endAngleRad, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const midRad = (startAngleRad + endAngleRad) / 2;
    const labelR = radius + 14;
    const lx = ox + labelR * Math.cos(midRad);
    const ly = oy + labelR * Math.sin(midRad);

    ctx.fillStyle = color;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }

  function render(): void {
    // Dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(0.5, "#0d1525");
    bgGrad.addColorStop(1, "#0a0e1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Half angle in radians
    const halfAngleRad = degToRad(angle / 2);

    // Block position (left-center area)
    const blockCX = width * 0.35;
    const blockCY = height * 0.5;
    const blockW = Math.min(width * 0.12, 80);
    const blockH = Math.min(height * 0.1, 55);

    // Force attachment point (right edge of block)
    const attachX = blockCX + blockW / 2;
    const attachY = blockCY;

    // Force 1 direction (upper): angle = -halfAngle from horizontal (rightward)
    const f1Angle = -halfAngleRad; // canvas coords: negative y is up
    const f1EndX = attachX + force1 * SCALE * Math.cos(f1Angle);
    const f1EndY = attachY + force1 * SCALE * Math.sin(f1Angle);

    // Force 2 direction (lower): angle = +halfAngle from horizontal
    const f2Angle = halfAngleRad;
    const f2EndX = attachX + force2 * SCALE * Math.cos(f2Angle);
    const f2EndY = attachY + force2 * SCALE * Math.sin(f2Angle);

    // Resultant using the law of cosines: R = sqrt(F1^2 + F2^2 + 2*F1*F2*cos(theta))
    const thetaRad = degToRad(angle);
    const resultantMag = Math.sqrt(
      force1 * force1 + force2 * force2 + 2 * force1 * force2 * Math.cos(thetaRad)
    );

    // Resultant direction: compute by vector addition
    const rx = force1 * Math.cos(f1Angle) + force2 * Math.cos(f2Angle);
    const ry = force1 * Math.sin(f1Angle) + force2 * Math.sin(f2Angle);
    const rEndX = attachX + rx * SCALE;
    const rEndY = attachY + ry * SCALE;

    // Parallelogram construction: the 4th corner
    const paraX = f1EndX + (f2EndX - attachX);
    const paraY = f1EndY + (f2EndY - attachY);

    // Draw parallelogram dashed lines
    drawDashedLine(f1EndX, f1EndY, paraX, paraY, "rgba(16, 185, 129, 0.3)", 1.5);
    drawDashedLine(f2EndX, f2EndY, paraX, paraY, "rgba(59, 130, 246, 0.3)", 1.5);

    // Draw the figure (person)
    drawFigure(blockCX, blockCY, blockW, blockH, halfAngleRad);

    // Draw the block
    drawBlock(blockCX, blockCY, blockW, blockH);

    // Draw force vectors with glow
    // Force 1 (blue)
    ctx.save();
    ctx.shadowColor = "rgba(59, 130, 246, 0.4)";
    ctx.shadowBlur = 8;
    drawVector(attachX, attachY, f1EndX, f1EndY, "#3b82f6", 3.5, 14);
    ctx.restore();

    // Force 2 (green)
    ctx.save();
    ctx.shadowColor = "rgba(16, 185, 129, 0.4)";
    ctx.shadowBlur = 8;
    drawVector(attachX, attachY, f2EndX, f2EndY, "#10b981", 3.5, 14);
    ctx.restore();

    // Resultant (red) if enabled
    if (showResultant >= 0.5) {
      ctx.save();
      ctx.shadowColor = "rgba(239, 68, 68, 0.4)";
      ctx.shadowBlur = 12;
      drawVector(attachX, attachY, rEndX, rEndY, "#ef4444", 4, 16);
      ctx.restore();
    }

    // Force labels
    // F1 label
    const f1MidX = (attachX + f1EndX) / 2;
    const f1MidY = (attachY + f1EndY) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    const f1Label = `F\u2081 = ${force1.toFixed(1)} N`;
    ctx.font = "bold 12px system-ui, sans-serif";
    const f1Metrics = ctx.measureText(f1Label);
    ctx.beginPath();
    ctx.roundRect(f1MidX - f1Metrics.width / 2 - 4, f1MidY - 20, f1Metrics.width + 8, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#60a5fa";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f1Label, f1MidX, f1MidY - 12);
    ctx.restore();

    // F2 label
    const f2MidX = (attachX + f2EndX) / 2;
    const f2MidY = (attachY + f2EndY) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    const f2Label = `F\u2082 = ${force2.toFixed(1)} N`;
    ctx.font = "bold 12px system-ui, sans-serif";
    const f2Metrics = ctx.measureText(f2Label);
    ctx.beginPath();
    ctx.roundRect(f2MidX - f2Metrics.width / 2 - 4, f2MidY + 6, f2Metrics.width + 8, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#34d399";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f2Label, f2MidX, f2MidY + 14);
    ctx.restore();

    // Resultant label
    if (showResultant >= 0.5) {
      const rMidX = (attachX + rEndX) / 2;
      const rMidY = (attachY + rEndY) / 2;
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      const rLabel = `R = ${resultantMag.toFixed(2)} N`;
      ctx.font = "bold 12px system-ui, sans-serif";
      const rMetrics = ctx.measureText(rLabel);
      const rLabelOffsetX = ry >= 0 ? -20 : 20;
      ctx.beginPath();
      ctx.roundRect(
        rMidX + rLabelOffsetX - rMetrics.width / 2 - 4,
        rMidY - 8,
        rMetrics.width + 8,
        16,
        3
      );
      ctx.fill();
      ctx.fillStyle = "#f87171";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(rLabel, rMidX + rLabelOffsetX, rMidY);
      ctx.restore();
    }

    // Draw angle arc between the two forces
    if (angle > 0 && angle < 180) {
      drawAngleArc(
        attachX,
        attachY,
        f1Angle,
        f2Angle,
        Math.min(40, force1 * SCALE * 0.35, force2 * SCALE * 0.35),
        "rgba(255, 255, 255, 0.5)",
        `${angle.toFixed(0)}\u00B0`
      );
    }

    // Attachment point dot
    ctx.beginPath();
    ctx.arc(attachX, attachY, 5, 0, Math.PI * 2);
    const dotGrad = ctx.createRadialGradient(attachX - 1, attachY - 1, 0, attachX, attachY, 5);
    dotGrad.addColorStop(0, "#ffffff");
    dotGrad.addColorStop(0.5, "#cbd5e1");
    dotGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = dotGrad;
    ctx.fill();

    // Animated pulse on the resultant (subtle)
    if (showResultant >= 0.5) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 2));
      ctx.beginPath();
      ctx.arc(rEndX, rEndY, 6 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 * pulse})`;
      ctx.fill();
    }

    // --- Info panel ---
    ctx.save();
    const panelW = 260;
    const panelH = 155;
    const panelX = width - panelW - 14;
    const panelY = 14;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();

    let textY = panelY + 22;
    const textX = panelX + 14;
    const lineH = 18;

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Addition of Forces (Figure)", textX, textY);
    textY += lineH + 4;

    ctx.font = "12px system-ui, sans-serif";

    // F1 info
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`F\u2081 = ${force1.toFixed(1)} N`, textX, textY);
    textY += lineH;

    // F2 info
    ctx.fillStyle = "#34d399";
    ctx.fillText(`F\u2082 = ${force2.toFixed(1)} N`, textX, textY);
    textY += lineH;

    // Angle
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`\u03B8 = ${angle.toFixed(0)}\u00B0`, textX, textY);
    textY += lineH;

    // Separator
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(textX, textY - 8);
    ctx.lineTo(panelX + panelW - 14, textY - 8);
    ctx.stroke();

    // Resultant
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(`R = ${resultantMag.toFixed(2)} N`, textX, textY);
    textY += lineH;

    // Formula
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("R = \u221A(F\u2081\u00B2 + F\u2082\u00B2 + 2\u00B7F\u2081\u00B7F\u2082\u00B7cos\u03B8)", textX, textY);

    ctx.restore();

    // Bottom-left label
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Parallelogram Law \u2014 Visual Figure Pulling Object", 14, height - 14);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No resources to clean up
  }

  function getStateDescription(): string {
    const thetaRad = degToRad(angle);
    const resultantMag = Math.sqrt(
      force1 * force1 + force2 * force2 + 2 * force1 * force2 * Math.cos(thetaRad)
    );

    return (
      `Addition of Forces (Figure Pulling): ` +
      `F1 = ${force1.toFixed(1)} N, F2 = ${force2.toFixed(1)} N, ` +
      `Angle between forces: ${angle.toFixed(0)} deg. ` +
      `Resultant: R = ${resultantMag.toFixed(2)} N. ` +
      `Formula: R = sqrt(F1^2 + F2^2 + 2*F1*F2*cos(theta)). ` +
      `As the angle increases from 0 to 180 deg, the resultant decreases from (F1+F2) to |F1-F2|. ` +
      `Parallelogram method of vector addition is shown.`
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

export default AdditionOfForce2Factory;
