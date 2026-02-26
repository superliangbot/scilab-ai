import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagnetFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnet") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let magnetStrength = 5;
  let numFieldLines = 12;
  let showCompass = 1;
  let magnetAngle = 0;

  // Magnet geometry (in canvas coordinates)
  const MAGNET_HALF_LENGTH = 60;
  const MAGNET_HALF_WIDTH = 20;

  // Compass needle grid
  interface CompassNeedle {
    x: number;
    y: number;
    angle: number;
    strength: number;
  }
  let compassNeedles: CompassNeedle[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    buildCompassGrid();
  }

  function buildCompassGrid(): void {
    compassNeedles = [];
    const spacing = 50;
    const cx = width / 2;
    const cy = height / 2;
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Skip needles inside the magnet body
        if (dist < MAGNET_HALF_LENGTH + 15) continue;
        compassNeedles.push({ x, y, angle: 0, strength: 0 });
      }
    }
  }

  // Compute magnetic dipole field at point (px, py) given magnet at center
  // with moment along angle magnetAngle
  function dipoleField(px: number, py: number): { bx: number; by: number } {
    const cx = width / 2;
    const cy = height / 2;
    const dx = px - cx;
    const dy = py - cy;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    if (r < 5) return { bx: 0, by: 0 };

    const r5 = r2 * r2 * r;
    const angleRad = (magnetAngle * Math.PI) / 180;
    // Magnetic moment direction
    const mx = Math.cos(angleRad) * magnetStrength;
    const my = Math.sin(angleRad) * magnetStrength;

    // B = (mu0/4pi) * (3(m.r)r/r^5 - m/r^3)
    // We use arbitrary units for visualization
    const mDotR = mx * dx + my * dy;
    const scale = 500;
    const bx = scale * (3 * mDotR * dx / r5 - mx / (r2 * r));
    const by = scale * (3 * mDotR * dy / r5 - my / (r2 * r));

    return { bx, by };
  }

  function update(dt: number, params: Record<string, number>): void {
    magnetStrength = params.magnetStrength ?? 5;
    numFieldLines = Math.round(params.numFieldLines ?? 12);
    showCompass = params.showCompass ?? 1;
    magnetAngle = params.magnetAngle ?? 0;
    time += dt;

    // Update compass needle orientations
    if (showCompass >= 0.5) {
      for (const needle of compassNeedles) {
        const field = dipoleField(needle.x, needle.y);
        const mag = Math.sqrt(field.bx * field.bx + field.by * field.by);
        needle.strength = mag;
        if (mag > 0.0001) {
          needle.angle = Math.atan2(field.by, field.bx);
        }
      }
    }
  }

  function traceFieldLine(startX: number, startY: number, forward: boolean): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    let x = startX;
    let y = startY;
    const stepSize = 3;
    const maxSteps = 500;
    const cx = width / 2;
    const cy = height / 2;

    for (let i = 0; i < maxSteps; i++) {
      points.push({ x, y });
      const field = dipoleField(x, y);
      const mag = Math.sqrt(field.bx * field.bx + field.by * field.by);
      if (mag < 0.00001) break;

      const dir = forward ? 1 : -1;
      const nx = x + dir * (field.bx / mag) * stepSize;
      const ny = y + dir * (field.by / mag) * stepSize;

      // Stop if out of canvas
      if (nx < -20 || nx > width + 20 || ny < -20 || ny > height + 20) break;

      // Stop if returned close to magnet center
      const dCx = nx - cx;
      const dCy = ny - cy;
      if (i > 10 && Math.sqrt(dCx * dCx + dCy * dCy) < MAGNET_HALF_LENGTH * 0.5) break;

      x = nx;
      y = ny;
    }

    return points;
  }

  function drawArrowOnPath(points: { x: number; y: number }[], color: string): void {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Draw arrow heads at intervals
    const arrowInterval = Math.floor(points.length / 3);
    if (arrowInterval < 2) return;
    for (let k = 1; k <= 2; k++) {
      const idx = Math.min(k * arrowInterval, points.length - 2);
      const px = points[idx].x;
      const py = points[idx].y;
      const dx = points[idx + 1].x - points[idx].x;
      const dy = points[idx + 1].y - points[idx].y;
      const ang = Math.atan2(dy, dx);
      const arrowSize = 6;

      ctx.beginPath();
      ctx.moveTo(px + Math.cos(ang) * arrowSize, py + Math.sin(ang) * arrowSize);
      ctx.lineTo(
        px + Math.cos(ang + 2.5) * arrowSize,
        py + Math.sin(ang + 2.5) * arrowSize
      );
      ctx.lineTo(
        px + Math.cos(ang - 2.5) * arrowSize,
        py + Math.sin(ang - 2.5) * arrowSize
      );
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function drawMagnet(): void {
    const cx = width / 2;
    const cy = height / 2;
    const angleRad = (magnetAngle * Math.PI) / 180;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angleRad);

    // North pole (right half) - red
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(0, -MAGNET_HALF_WIDTH, MAGNET_HALF_LENGTH, MAGNET_HALF_WIDTH * 2);
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -MAGNET_HALF_WIDTH, MAGNET_HALF_LENGTH, MAGNET_HALF_WIDTH * 2);

    // South pole (left half) - blue
    ctx.fillStyle = "#3498db";
    ctx.fillRect(-MAGNET_HALF_LENGTH, -MAGNET_HALF_WIDTH, MAGNET_HALF_LENGTH, MAGNET_HALF_WIDTH * 2);
    ctx.strokeStyle = "#2980b9";
    ctx.lineWidth = 2;
    ctx.strokeRect(-MAGNET_HALF_LENGTH, -MAGNET_HALF_WIDTH, MAGNET_HALF_LENGTH, MAGNET_HALF_WIDTH * 2);

    // Labels
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", MAGNET_HALF_LENGTH / 2, 0);
    ctx.fillText("S", -MAGNET_HALF_LENGTH / 2, 0);

    // Divider line
    ctx.beginPath();
    ctx.moveTo(0, -MAGNET_HALF_WIDTH);
    ctx.lineTo(0, MAGNET_HALF_WIDTH);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function drawCompassNeedles(): void {
    if (showCompass < 0.5) return;

    let maxStrength = 0;
    for (const n of compassNeedles) {
      if (n.strength > maxStrength) maxStrength = n.strength;
    }
    if (maxStrength === 0) maxStrength = 1;

    for (const needle of compassNeedles) {
      const len = 14;
      const alpha = Math.min(1, 0.3 + 0.7 * (needle.strength / maxStrength));

      ctx.save();
      ctx.translate(needle.x, needle.y);
      ctx.rotate(needle.angle);

      // Red tip (north-seeking)
      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.lineTo(-2, -3);
      ctx.lineTo(-2, 3);
      ctx.closePath();
      ctx.fillStyle = `rgba(231, 76, 60, ${alpha})`;
      ctx.fill();

      // White tail (south-seeking)
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(2, -3);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fillStyle = `rgba(200, 200, 220, ${alpha})`;
      ctx.fill();

      // Center pivot
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150, 150, 150, ${alpha})`;
      ctx.fill();

      ctx.restore();
    }
  }

  function render(): void {
    // Dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const angleRad = (magnetAngle * Math.PI) / 180;

    // Draw field lines starting from N pole, traced forward
    // and from S pole traced backward (to complete loops)
    for (let i = 0; i < numFieldLines; i++) {
      const fraction = (i + 0.5) / numFieldLines;
      const spreadAngle = (fraction - 0.5) * Math.PI * 0.8;

      // Start near N pole surface
      const nStartX = cx + Math.cos(angleRad) * (MAGNET_HALF_LENGTH + 3) +
        Math.cos(angleRad + Math.PI / 2) * Math.sin(spreadAngle) * MAGNET_HALF_WIDTH * 0.8;
      const nStartY = cy + Math.sin(angleRad) * (MAGNET_HALF_LENGTH + 3) +
        Math.sin(angleRad + Math.PI / 2) * Math.sin(spreadAngle) * MAGNET_HALF_WIDTH * 0.8;

      const forwardPoints = traceFieldLine(nStartX, nStartY, true);

      // Color gradient along lines: warm near N, cool near S
      const lineAlpha = 0.6 + 0.4 * Math.abs(fraction - 0.5) * 2;
      const lineColor = `rgba(100, 200, 255, ${lineAlpha * 0.7})`;
      drawArrowOnPath(forwardPoints, lineColor);

      // Also trace from S pole backward to complete loops on other side
      const sStartX = cx - Math.cos(angleRad) * (MAGNET_HALF_LENGTH + 3) +
        Math.cos(angleRad + Math.PI / 2) * Math.sin(spreadAngle) * MAGNET_HALF_WIDTH * 0.8;
      const sStartY = cy - Math.sin(angleRad) * (MAGNET_HALF_LENGTH + 3) +
        Math.sin(angleRad + Math.PI / 2) * Math.sin(spreadAngle) * MAGNET_HALF_WIDTH * 0.8;

      const backwardPoints = traceFieldLine(sStartX, sStartY, false);
      drawArrowOnPath(backwardPoints, lineColor);
    }

    // Draw compass needles
    drawCompassNeedles();

    // Draw the magnet on top
    drawMagnet();

    // Info text
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Strength: ${magnetStrength.toFixed(1)} T  |  Angle: ${magnetAngle.toFixed(0)}°`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    buildCompassGrid();
  }

  function destroy(): void {
    compassNeedles = [];
  }

  function getStateDescription(): string {
    return (
      `Bar Magnet: strength=${magnetStrength} T, angle=${magnetAngle}°, ` +
      `${numFieldLines} field lines shown. ` +
      `Compass needles ${showCompass >= 0.5 ? "visible" : "hidden"} (${compassNeedles.length} total). ` +
      `Field lines emanate from N pole (red) and curve to S pole (blue), ` +
      `following the magnetic dipole field pattern B = (mu0/4pi)(3(m.r)r - m)/r^3.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    buildCompassGrid();
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

export default MagnetFactory;
