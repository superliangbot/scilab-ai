import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CCurveFractalFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("c-curve-fractal") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let iterations = 10;
  let colorScheme = 0;
  let lineWidth = 1;
  let rotation = 0;

  // Animation state
  let animatedLevel = 0; // smoothly transitions to target iterations
  let cachedPoints: Array<{ x: number; y: number }> = [];
  let cachedIterations = -1;
  let cachedRotation = -1;

  // Color schemes: each returns an [r, g, b] string for a given t in [0,1]
  function getColor(t: number, scheme: number): string {
    switch (scheme) {
      case 0: {
        // Electric blue to cyan to white
        const r = Math.floor(30 + t * 225);
        const g = Math.floor(100 + t * 155);
        const b = Math.floor(200 + t * 55);
        return `rgb(${r},${g},${b})`;
      }
      case 1: {
        // Fire: red to orange to yellow
        const r = Math.floor(200 + t * 55);
        const g = Math.floor(t * 220);
        const b = Math.floor(t * t * 80);
        return `rgb(${r},${g},${b})`;
      }
      case 2: {
        // Rainbow cycling
        const hue = (t * 360 + time * 30) % 360;
        return `hsl(${hue}, 85%, 60%)`;
      }
      case 3: {
        // Green matrix
        const r = Math.floor(t * 80);
        const g = Math.floor(100 + t * 155);
        const b = Math.floor(t * 100);
        return `rgb(${r},${g},${b})`;
      }
      default:
        return `rgb(200,200,255)`;
    }
  }

  /**
   * Generate C-curve points iteratively.
   * Start with a single segment, then recursively replace each segment.
   * For a segment P1->P2, find point P = M + rotate90(P2-M) where M = midpoint.
   * Replace P1->P2 with P1->P, P->P2.
   */
  function generateCCurve(level: number, rotDeg: number): Array<{ x: number; y: number }> {
    // Start with a horizontal segment centered in the canvas
    const scale = Math.min(width, height) * 0.35;
    const cx = width / 2;
    const cy = height / 2;
    const rotRad = (rotDeg * Math.PI) / 180;

    // Initial segment
    const x1 = cx - scale * 0.5 * Math.cos(rotRad);
    const y1 = cy - scale * 0.5 * Math.sin(rotRad);
    const x2 = cx + scale * 0.5 * Math.cos(rotRad);
    const y2 = cy + scale * 0.5 * Math.sin(rotRad);

    let points: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }, { x: x2, y: y2 }];

    for (let i = 0; i < level; i++) {
      const newPoints: Array<{ x: number; y: number }> = [points[0]];
      for (let j = 0; j < points.length - 1; j++) {
        const p1 = points[j];
        const p2 = points[j + 1];

        // Midpoint
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;

        // Vector from midpoint to P2
        const dx = p2.x - mx;
        const dy = p2.y - my;

        // Rotate 90 degrees (counterclockwise): (dx, dy) -> (-dy, dx)
        const px = mx + (-dy);
        const py = my + dx;

        newPoints.push({ x: px, y: py });
        newPoints.push(p2);
      }
      points = newPoints;
    }

    return points;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    animatedLevel = 0;
    cachedIterations = -1;
    cachedRotation = -1;
    cachedPoints = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;

    iterations = Math.round(params.iterations ?? 10);
    colorScheme = Math.round(params.colorScheme ?? 0);
    lineWidth = params.lineWidth ?? 1;
    rotation = params.rotation ?? 0;

    // Animate towards target level
    if (animatedLevel < iterations) {
      animatedLevel += dt * 3; // builds up ~3 levels per second
      if (animatedLevel > iterations) animatedLevel = iterations;
    } else if (animatedLevel > iterations) {
      animatedLevel -= dt * 5;
      if (animatedLevel < iterations) animatedLevel = iterations;
    }

    // Regenerate points if parameters changed
    const targetLevel = Math.floor(animatedLevel);
    if (targetLevel !== cachedIterations || rotation !== cachedRotation) {
      // Clamp to safe level to avoid excessive computation
      const safeLevel = Math.min(targetLevel, 18);
      cachedPoints = generateCCurve(safeLevel, rotation);
      cachedIterations = targetLevel;
      cachedRotation = rotation;
    }
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 0.5;
    const gridStep = 50;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (cachedPoints.length < 2) return;

    const totalSegments = cachedPoints.length - 1;

    // Animate drawing: reveal segments progressively within the current level
    const levelFraction = animatedLevel - Math.floor(animatedLevel);
    const segmentsToShow = Math.floor(totalSegments * (Math.floor(animatedLevel) === iterations ? 1 : 0.5 + levelFraction * 0.5));
    const visibleCount = Math.min(
      Math.max(2, Math.floor(totalSegments * Math.min(1, time * 0.5))),
      totalSegments
    );
    const drawCount = Math.min(visibleCount, totalSegments);

    // Draw the fractal with colored segments
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow layer
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = lineWidth + 3;
    ctx.shadowColor = getColor(0.5, colorScheme);
    ctx.shadowBlur = 15;

    ctx.beginPath();
    ctx.moveTo(cachedPoints[0].x, cachedPoints[0].y);
    for (let i = 1; i <= drawCount; i++) {
      ctx.lineTo(cachedPoints[i].x, cachedPoints[i].y);
    }
    ctx.strokeStyle = getColor(0.5, colorScheme);
    ctx.stroke();
    ctx.restore();

    // Main colored segments
    // For performance, batch segments with similar colors
    const batchSize = Math.max(1, Math.floor(drawCount / 256));

    for (let i = 0; i < drawCount; i += batchSize) {
      const end = Math.min(i + batchSize, drawCount);
      const t = i / totalSegments;

      ctx.beginPath();
      ctx.moveTo(cachedPoints[i].x, cachedPoints[i].y);
      for (let j = i + 1; j <= end; j++) {
        ctx.lineTo(cachedPoints[j].x, cachedPoints[j].y);
      }

      ctx.strokeStyle = getColor(t, colorScheme);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    // Draw animated tip glow if still building
    if (drawCount < totalSegments && drawCount > 0) {
      const tip = cachedPoints[drawCount];
      const glowGrad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 20);
      glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      glowGrad.addColorStop(0.3, getColor(drawCount / totalSegments, colorScheme));
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }

    // Info overlay
    drawOverlay(drawCount, totalSegments);
  }

  function drawOverlay(drawn: number, total: number): void {
    const scale = Math.min(width / 700, height / 500);
    const fontSize = Math.max(10, Math.round(12 * scale));

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `bold ${fontSize + 2}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("C-Curve Fractal", 12, 10);

    // Stats panel
    const panelY = height - 56;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, 360, 48, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const currentLevel = Math.floor(animatedLevel);
    ctx.fillText(
      `Level: ${currentLevel}/${iterations}  Segments: ${total.toLocaleString()}`,
      16,
      panelY + 14
    );
    ctx.fillText(
      `Hausdorff dim: 2.0  Rotation: ${rotation}\u00B0  t = ${time.toFixed(1)}s`,
      16,
      panelY + 34
    );

    // Dimension explanation (top right)
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = `${Math.max(9, fontSize - 2)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("Each segment \u2192 2 segments at 90\u00B0", width - 12, 14);
    ctx.fillText(`2^${currentLevel} = ${Math.pow(2, currentLevel).toLocaleString()} segments`, width - 12, 30);
  }

  function reset(): void {
    time = 0;
    animatedLevel = 0;
    cachedIterations = -1;
    cachedRotation = -1;
    cachedPoints = [];
  }

  function destroy(): void {
    cachedPoints = [];
  }

  function getStateDescription(): string {
    const currentLevel = Math.floor(animatedLevel);
    const numSegments = Math.pow(2, currentLevel);
    const schemeNames = ["Electric Blue", "Fire", "Rainbow", "Green Matrix"];

    return (
      `C-Curve Fractal: Level ${currentLevel} of ${iterations}. ` +
      `${numSegments.toLocaleString()} line segments. ` +
      `The C-curve has Hausdorff dimension 2, meaning it is space-filling. ` +
      `Each iteration replaces every segment with two segments at 90 degree angles through the midpoint. ` +
      `Color scheme: ${schemeNames[colorScheme] ?? "Unknown"}. ` +
      `Line width: ${lineWidth}. Rotation: ${rotation} degrees. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    cachedIterations = -1;
    cachedRotation = -1;
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

export default CCurveFractalFactory;
