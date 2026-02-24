import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const AdditionOfForceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("addition-of-force") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let mag1 = 8;
  let ang1 = 30;
  let mag2 = 6;
  let ang2 = 120;

  // Scale: pixels per Newton
  const SCALE = 18;

  // Grid settings
  const GRID_SPACING = 36; // pixels between grid lines (2N increments)

  function degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  function radToDeg(rad: number): number {
    return (rad * 180) / Math.PI;
  }

  /** Compute the endpoint of a vector in canvas coordinates (y-up) */
  function vectorEndpoint(
    ox: number,
    oy: number,
    magnitude: number,
    angleDeg: number
  ): { x: number; y: number } {
    const rad = degToRad(angleDeg);
    return {
      x: ox + magnitude * SCALE * Math.cos(rad),
      y: oy - magnitude * SCALE * Math.sin(rad), // canvas y is flipped
    };
  }

  /** Draw an arrowhead at (tipX, tipY) pointing in the direction given by canvasAngle (in canvas coords) */
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
    ctx.lineTo(-size, -size * 0.45);
    ctx.lineTo(-size * 0.7, 0);
    ctx.lineTo(-size, size * 0.45);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  /** Draw a thick vector arrow from (x1,y1) to (x2,y2) with an arrowhead */
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

    const angle = Math.atan2(dy, dx);

    // Draw the line (shortened slightly so arrow doesn't overlap)
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

    // Draw arrowhead
    drawArrowhead(x2, y2, angle, arrowSize, color);
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
    ctx.beginPath();
    ctx.setLineDash([6, 5]);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** Draw the subtle grid background */
  function drawGrid(originX: number, originY: number): void {
    ctx.save();

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = originX % GRID_SPACING; x < width; x += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = originY % GRID_SPACING; y < height; y += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Axis lines (brighter)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;

    // X-axis
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(width, originY);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Axis tick marks and labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";

    // X-axis ticks (every 2 grid spacings = every 4N)
    for (let x = originX + GRID_SPACING * 2; x < width; x += GRID_SPACING * 2) {
      const nVal = Math.round((x - originX) / SCALE);
      ctx.fillText(`${nVal}`, x, originY + 14);
    }
    for (let x = originX - GRID_SPACING * 2; x > 0; x -= GRID_SPACING * 2) {
      const nVal = Math.round((x - originX) / SCALE);
      ctx.fillText(`${nVal}`, x, originY + 14);
    }

    // Y-axis ticks
    ctx.textAlign = "right";
    for (let y = originY - GRID_SPACING * 2; y > 0; y -= GRID_SPACING * 2) {
      const nVal = Math.round((originY - y) / SCALE);
      ctx.fillText(`${nVal}`, originX - 8, y + 4);
    }
    for (let y = originY + GRID_SPACING * 2; y < height; y += GRID_SPACING * 2) {
      const nVal = Math.round((originY - y) / SCALE);
      ctx.fillText(`${nVal}`, originX - 8, y + 4);
    }

    ctx.restore();
  }

  /** Draw an angle arc between two angles at the origin */
  function drawAngleArc(
    ox: number,
    oy: number,
    startAngleDeg: number,
    endAngleDeg: number,
    radius: number,
    color: string,
    label: string
  ): void {
    // Convert to canvas angles (y-flipped): canvas angle = -math angle
    let startRad = -degToRad(startAngleDeg);
    let endRad = -degToRad(endAngleDeg);

    // Ensure we draw the shorter arc
    // In canvas coordinates, angles go clockwise, so we need start < end for CCW arc
    // We want to draw from startAngleDeg to endAngleDeg (the angular span between them)
    if (startRad > endRad) {
      [startRad, endRad] = [endRad, startRad];
    }

    // If the arc is more than PI, swap and use the other direction
    if (endRad - startRad > Math.PI) {
      [startRad, endRad] = [endRad, startRad + Math.PI * 2];
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(ox, oy, radius, startRad, endRad, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label at the midpoint of the arc
    const midRad = (startRad + endRad) / 2;
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

  /** Draw a label along a vector, offset to one side */
  function drawVectorLabel(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    label: string,
    color: string,
    offsetPx: number
  ): void {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    // Normal perpendicular to the vector (rotated 90 degrees left)
    const nx = -dy / len;
    const ny = dx / len;

    const lx = mx + nx * offsetPx;
    const ly = my + ny * offsetPx;

    ctx.save();
    ctx.fillStyle = color;
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Subtle background for readability
    const metrics = ctx.measureText(label);
    const padding = 4;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(
      lx - metrics.width / 2 - padding,
      ly - 8 - padding / 2,
      metrics.width + padding * 2,
      16 + padding,
      4
    );
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillText(label, lx, ly);
    ctx.restore();
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
    mag1 = params.magnitude1 ?? 8;
    ang1 = params.angle1 ?? 30;
    mag2 = params.magnitude2 ?? 6;
    ang2 = params.angle2 ?? 120;
  }

  function render(): void {
    // Dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(0.5, "#0d1525");
    bgGrad.addColorStop(1, "#0a0e1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Origin at center of canvas
    const ox = width / 2;
    const oy = height / 2;

    // Draw grid
    drawGrid(ox, oy);

    // Compute vector endpoints
    const f1End = vectorEndpoint(ox, oy, mag1, ang1);
    const f2End = vectorEndpoint(ox, oy, mag2, ang2);

    // Compute resultant
    const rx = mag1 * Math.cos(degToRad(ang1)) + mag2 * Math.cos(degToRad(ang2));
    const ry = mag1 * Math.sin(degToRad(ang1)) + mag2 * Math.sin(degToRad(ang2));
    const rMag = Math.sqrt(rx * rx + ry * ry);
    let rAngle = radToDeg(Math.atan2(ry, rx));
    if (rAngle < 0) rAngle += 360;

    const rEnd = {
      x: ox + rx * SCALE,
      y: oy - ry * SCALE,
    };

    // Parallelogram completion point (tip of F1 + F2 offset, or tip of F2 + F1 offset)
    // From F1 tip, draw a line parallel to F2
    const paraFromF1 = {
      x: f1End.x + (f2End.x - ox),
      y: f1End.y + (f2End.y - oy),
    };
    // From F2 tip, draw a line parallel to F1
    const paraFromF2 = {
      x: f2End.x + (f1End.x - ox),
      y: f2End.y + (f1End.y - oy),
    };

    // --- Draw parallelogram dashed lines ---
    // From tip of F1 to the resultant tip (parallel to F2)
    drawDashedLine(
      f1End.x,
      f1End.y,
      paraFromF1.x,
      paraFromF1.y,
      "rgba(16, 185, 129, 0.35)",
      1.5
    );
    // From tip of F2 to the resultant tip (parallel to F1)
    drawDashedLine(
      f2End.x,
      f2End.y,
      paraFromF2.x,
      paraFromF2.y,
      "rgba(59, 130, 246, 0.35)",
      1.5
    );

    // --- Draw subtle glow behind the resultant ---
    ctx.save();
    ctx.shadowColor = "rgba(239, 68, 68, 0.3)";
    ctx.shadowBlur = 12;
    drawVector(ox, oy, rEnd.x, rEnd.y, "#ef4444", 4, 16);
    ctx.restore();

    // --- Draw Force 1 (blue) ---
    drawVector(ox, oy, f1End.x, f1End.y, "#3b82f6", 3.5, 14);

    // --- Draw Force 2 (green) ---
    drawVector(ox, oy, f2End.x, f2End.y, "#10b981", 3.5, 14);

    // --- Draw Resultant (red) on top ---
    drawVector(ox, oy, rEnd.x, rEnd.y, "#ef4444", 4, 16);

    // --- Labels on vectors ---
    drawVectorLabel(
      ox,
      oy,
      f1End.x,
      f1End.y,
      `F\u2081 = ${mag1.toFixed(1)} N`,
      "#60a5fa",
      -16
    );
    drawVectorLabel(
      ox,
      oy,
      f2End.x,
      f2End.y,
      `F\u2082 = ${mag2.toFixed(1)} N`,
      "#34d399",
      -16
    );
    drawVectorLabel(
      ox,
      oy,
      rEnd.x,
      rEnd.y,
      `R = ${rMag.toFixed(1)} N`,
      "#f87171",
      16
    );

    // --- Draw angle arcs ---
    // Angle of F1 from x-axis
    drawAngleArc(ox, oy, 0, ang1, 35, "rgba(96, 165, 250, 0.7)", `${ang1.toFixed(0)}\u00B0`);

    // Angle of F2 from x-axis
    drawAngleArc(ox, oy, 0, ang2, 45, "rgba(52, 211, 153, 0.7)", `${ang2.toFixed(0)}\u00B0`);

    // Angle between F1 and F2
    const angleBetween = Math.abs(ang2 - ang1);
    const angleBetweenDisplay = angleBetween > 180 ? 360 - angleBetween : angleBetween;
    drawAngleArc(
      ox,
      oy,
      ang1,
      ang2,
      55,
      "rgba(255, 255, 255, 0.4)",
      `${angleBetweenDisplay.toFixed(0)}\u00B0`
    );

    // --- Draw the origin point ---
    ctx.beginPath();
    ctx.arc(ox, oy, 6, 0, Math.PI * 2);
    const originGrad = ctx.createRadialGradient(ox - 1, oy - 1, 0, ox, oy, 6);
    originGrad.addColorStop(0, "#ffffff");
    originGrad.addColorStop(0.5, "#cbd5e1");
    originGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = originGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Info panel ---
    ctx.save();
    const panelW = 230;
    const panelH = 140;
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
    ctx.fillText("Addition of Forces", textX, textY);
    textY += lineH + 4;

    ctx.font = "12px system-ui, sans-serif";

    // F1 info
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`F\u2081 = ${mag1.toFixed(1)} N  at  ${ang1.toFixed(0)}\u00B0`, textX, textY);
    textY += lineH;

    // F2 info
    ctx.fillStyle = "#34d399";
    ctx.fillText(`F\u2082 = ${mag2.toFixed(1)} N  at  ${ang2.toFixed(0)}\u00B0`, textX, textY);
    textY += lineH;

    // Separator
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(textX, textY - 6);
    ctx.lineTo(panelX + panelW - 14, textY - 6);
    ctx.stroke();
    textY += 4;

    // Resultant info
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(`R = ${rMag.toFixed(2)} N`, textX, textY);
    textY += lineH;

    ctx.fillStyle = "#f87171";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`\u03B8\u1D63 = ${rAngle.toFixed(1)}\u00B0`, textX, textY);

    // Components
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(`  (R\u2093=${rx.toFixed(1)}, R\u1D67=${ry.toFixed(1)})`, textX + 62, textY);

    ctx.restore();

    // --- Title label bottom-left ---
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Parallelogram Law of Vector Addition", 14, height - 14);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No resources to clean up
  }

  function getStateDescription(): string {
    const rx = mag1 * Math.cos(degToRad(ang1)) + mag2 * Math.cos(degToRad(ang2));
    const ry = mag1 * Math.sin(degToRad(ang1)) + mag2 * Math.sin(degToRad(ang2));
    const rMag = Math.sqrt(rx * rx + ry * ry);
    let rAngle = radToDeg(Math.atan2(ry, rx));
    if (rAngle < 0) rAngle += 360;
    const angleBetween = Math.abs(ang2 - ang1);
    const angleBetweenDisplay = angleBetween > 180 ? 360 - angleBetween : angleBetween;

    return (
      `Addition of Forces (Vector Addition): ` +
      `F1=${mag1.toFixed(1)} N at ${ang1.toFixed(0)} deg, ` +
      `F2=${mag2.toFixed(1)} N at ${ang2.toFixed(0)} deg. ` +
      `Angle between forces: ${angleBetweenDisplay.toFixed(0)} deg. ` +
      `Resultant: R=${rMag.toFixed(2)} N at ${rAngle.toFixed(1)} deg. ` +
      `Components: Rx=${rx.toFixed(2)} N, Ry=${ry.toFixed(2)} N. ` +
      `Using parallelogram law of vector addition: R = F1 + F2.`
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

export default AdditionOfForceFactory;
