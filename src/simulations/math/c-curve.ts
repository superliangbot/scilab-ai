import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CCurveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("c-curve") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let iterations = 10;
  let colorScheme = 0;
  let lineWidth = 1;
  let animate = 1;

  // Animation state
  let animatedLevel = 0;
  let cachedPoints: Array<{ x: number; y: number }> = [];
  let cachedIterations = -1;
  let cachedWidth = -1;
  let cachedHeight = -1;

  // Color schemes
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
        // Purple to pink
        const r = Math.floor(120 + t * 135);
        const g = Math.floor(40 + t * 80);
        const b = Math.floor(200 + t * 55);
        return `rgb(${r},${g},${b})`;
      }
      default:
        return "rgb(200,200,255)";
    }
  }

  /**
   * Generate Levy C curve points iteratively.
   *
   * The Levy C curve replaces each segment AB with two segments AC, CB where
   * C is the apex of a right isosceles triangle built on AB. The right angle
   * is at C, so each new segment has length |AB|/sqrt(2), and C is offset at
   * 45 degrees from the original segment direction.
   *
   * Construction: given segment from P1 to P2,
   *   midpoint M = (P1+P2)/2
   *   C = M + rotate90(P2 - M)   [same as the standard construction]
   *
   * Actually: for the Levy C curve, C is the apex of the right isosceles
   * triangle with hypotenuse P1P2, where the right angle is at C.
   * C = midpoint + perpendicular offset of half the length.
   * This is: C.x = (P1.x+P2.x)/2 - (P2.y-P1.y)/2
   *          C.y = (P1.y+P2.y)/2 + (P2.x-P1.x)/2
   *
   * This produces the standard Levy C curve.
   */
  function generateLevyCCurve(level: number): Array<{ x: number; y: number }> {
    // Scale and center the initial segment
    const scale = Math.min(width, height) * 0.3;
    const cx = width * 0.5;
    const cy = height * 0.55;

    // Initial horizontal segment
    const x1 = cx - scale * 0.5;
    const y1 = cy;
    const x2 = cx + scale * 0.5;
    const y2 = cy;

    let points: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }, { x: x2, y: y2 }];

    for (let i = 0; i < level; i++) {
      const newPoints: Array<{ x: number; y: number }> = [points[0]];
      for (let j = 0; j < points.length - 1; j++) {
        const p1 = points[j];
        const p2 = points[j + 1];

        // Apex of right isosceles triangle on P1P2 with right angle at C
        // C = midpoint + perpendicular * half-length
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;

        // Perpendicular (rotate P1->P2 by 90 degrees, scale to half)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        const px = mx - dy / 2;
        const py = my + dx / 2;

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
    cachedWidth = -1;
    cachedHeight = -1;
    cachedPoints = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;

    iterations = Math.round(params.iterations ?? 10);
    colorScheme = Math.round(params.colorScheme ?? 0);
    lineWidth = params.lineWidth ?? 1;
    animate = Math.round(params.animate ?? 1);

    // Animate towards target level
    if (animate) {
      if (animatedLevel < iterations) {
        animatedLevel += dt * 3;
        if (animatedLevel > iterations) animatedLevel = iterations;
      } else if (animatedLevel > iterations) {
        animatedLevel -= dt * 5;
        if (animatedLevel < iterations) animatedLevel = iterations;
      }
    } else {
      animatedLevel = iterations;
    }

    // Regenerate points if parameters changed
    const targetLevel = Math.floor(animatedLevel);
    const safeLevel = Math.min(targetLevel, 16);
    if (safeLevel !== cachedIterations || width !== cachedWidth || height !== cachedHeight) {
      cachedPoints = generateLevyCCurve(safeLevel);
      cachedIterations = safeLevel;
      cachedWidth = width;
      cachedHeight = height;
    }
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    // ── Background ──────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
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

    // Determine how many segments to draw (animation)
    let drawCount: number;
    if (animate) {
      const progress = Math.min(1, time * 0.4);
      drawCount = Math.max(2, Math.floor(totalSegments * progress));
      drawCount = Math.min(drawCount, totalSegments);
    } else {
      drawCount = totalSegments;
    }

    // Draw the fractal
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Glow layer
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = lineWidth + 3;
    ctx.shadowColor = getColor(0.5, colorScheme);
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(cachedPoints[0].x, cachedPoints[0].y);
    for (let i = 1; i <= drawCount; i++) {
      ctx.lineTo(cachedPoints[i].x, cachedPoints[i].y);
    }
    ctx.strokeStyle = getColor(0.5, colorScheme);
    ctx.stroke();
    ctx.restore();

    // Main colored segments (batched for performance)
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

    // Animated tip glow if building
    if (animate && drawCount < totalSegments && drawCount > 0) {
      const tip = cachedPoints[drawCount];
      const glowGrad = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 18);
      glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
      glowGrad.addColorStop(0.3, getColor(drawCount / totalSegments, colorScheme));
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();
    }

    // ── Info overlay ────────────────────────────────
    drawOverlay(drawCount, totalSegments);
  }

  function drawOverlay(drawn: number, total: number): void {
    const scale = Math.min(width / 700, height / 500);
    const fontSize = Math.max(10, Math.round(12 * scale));
    const currentLevel = Math.floor(animatedLevel);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `bold ${fontSize + 4}px 'Inter', system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("L\u00E9vy C Curve", 12, 10);

    ctx.font = `${fontSize}px 'Inter', system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillText("Right isosceles triangle replacement", 12, 32);

    // Description (top right)
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = `${Math.max(9, fontSize - 2)}px 'Inter', system-ui, sans-serif`;
    ctx.fillText("Each segment \u2192 2 at 45\u00B0 (right isosceles)", width - 12, 14);
    ctx.fillText(`New length = original / \u221A2`, width - 12, 30);

    // Stats panel (bottom)
    const panelY = height - 64;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, 420, 56, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const numSegments = Math.pow(2, currentLevel);
    ctx.fillText(
      `Level: ${currentLevel}/${iterations}  |  Segments: 2^${currentLevel} = ${numSegments.toLocaleString()}`,
      16,
      panelY + 16
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(
      `Hausdorff dim: 2.0  |  Segment length: 1/\u221A2^${currentLevel}  |  t = ${time.toFixed(1)}s`,
      16,
      panelY + 38
    );
  }

  function reset(): void {
    time = 0;
    animatedLevel = 0;
    cachedIterations = -1;
    cachedWidth = -1;
    cachedHeight = -1;
    cachedPoints = [];
  }

  function destroy(): void {
    cachedPoints = [];
  }

  function getStateDescription(): string {
    const currentLevel = Math.floor(animatedLevel);
    const numSegments = Math.pow(2, currentLevel);
    const schemeNames = ["Electric Blue", "Fire", "Rainbow", "Purple-Pink"];

    return (
      `L\u00E9vy C Curve: Level ${currentLevel} of ${iterations}. ` +
      `${numSegments.toLocaleString()} line segments. ` +
      `The L\u00E9vy C curve replaces each segment with two segments forming a right isosceles triangle, ` +
      `where the right angle is at the apex and each new segment has length original/\u221A2. ` +
      `Hausdorff dimension = 2 (space-filling). ` +
      `Color scheme: ${schemeNames[colorScheme] ?? "Unknown"}. ` +
      `Line width: ${lineWidth}px. Animation: ${animate ? "on" : "off"}. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    cachedIterations = -1;
    cachedWidth = -1;
    cachedHeight = -1;
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

export default CCurveFactory;
