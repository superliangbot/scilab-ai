import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Point {
  x: number;
  y: number;
}

const KochCurveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("koch-curve") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let iterations = 3;
  let showSnowflake = 1; // 0 = single curve, 1 = full snowflake
  let colorMode = 0; // 0 = single color, 1 = depth-based
  let animateGrowth = 0;

  let cachedIterations = -1;
  let cachedSnowflake = -1;
  let cachedPoints: Point[] = [];

  function kochSubdivide(points: Point[]): Point[] {
    const result: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      const a: Point = { x: p1.x + dx / 3, y: p1.y + dy / 3 };
      const b: Point = { x: p1.x + dx / 2 - (dy * Math.sqrt(3)) / 6, y: p1.y + dy / 2 + (dx * Math.sqrt(3)) / 6 };
      const c: Point = { x: p1.x + (2 * dx) / 3, y: p1.y + (2 * dy) / 3 };

      result.push(p1, a, b, c);
    }
    result.push(points[points.length - 1]);
    return result;
  }

  function generateKoch(n: number, snowflake: boolean): Point[] {
    let points: Point[];

    const cx = width / 2;
    const cy = height * 0.48;
    const size = Math.min(width * 0.75, height * 0.6);

    if (snowflake) {
      // Equilateral triangle
      const h = (size * Math.sqrt(3)) / 2;
      const topY = cy - h * 0.4;
      points = [
        { x: cx - size / 2, y: topY + h },
        { x: cx + size / 2, y: topY + h },
        { x: cx, y: topY },
        { x: cx - size / 2, y: topY + h },
      ];
    } else {
      points = [
        { x: cx - size / 2, y: cy + 40 },
        { x: cx + size / 2, y: cy + 40 },
      ];
    }

    for (let i = 0; i < n; i++) {
      points = kochSubdivide(points);
    }

    return points;
  }

  function computeLength(points: Point[]): number {
    let len = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(dt: number, params: Record<string, number>) {
      iterations = Math.round(params.iterations ?? 3);
      showSnowflake = params.showSnowflake ?? 1;
      colorMode = params.colorMode ?? 0;
      animateGrowth = params.animateGrowth ?? 0;

      const iter = Math.min(iterations, 6);
      const snow = Math.round(showSnowflake);

      if (iter !== cachedIterations || snow !== cachedSnowflake) {
        cachedPoints = generateKoch(iter, snow > 0.5);
        cachedIterations = iter;
        cachedSnowflake = snow;
      }

      time += dt;
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Koch ${showSnowflake > 0.5 ? "Snowflake" : "Curve"} — Iteration ${Math.min(iterations, 6)}`, width / 2, 22);

      if (cachedPoints.length < 2) return;

      // Determine how many points to draw (animation)
      let drawCount = cachedPoints.length;
      if (animateGrowth > 0.5) {
        const progress = (time * 0.3) % 1;
        drawCount = Math.floor(progress * cachedPoints.length);
        drawCount = Math.max(2, drawCount);
      }

      // Draw the fractal
      if (colorMode > 0.5) {
        // Color segments by depth
        const segPerIter = Math.max(1, Math.floor(drawCount / Math.max(iterations, 1)));
        for (let i = 0; i < drawCount - 1; i++) {
          const hue = (i / drawCount) * 360;
          ctx.strokeStyle = `hsl(${hue}, 70%, 60%)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cachedPoints[i].x, cachedPoints[i].y);
          ctx.lineTo(cachedPoints[i + 1].x, cachedPoints[i + 1].y);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = "#4fc3f7";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cachedPoints[0].x, cachedPoints[0].y);
        for (let i = 1; i < drawCount; i++) {
          ctx.lineTo(cachedPoints[i].x, cachedPoints[i].y);
        }
        ctx.stroke();
      }

      // Fill for snowflake
      if (showSnowflake > 0.5 && drawCount === cachedPoints.length) {
        ctx.fillStyle = "rgba(79, 195, 247, 0.08)";
        ctx.beginPath();
        ctx.moveTo(cachedPoints[0].x, cachedPoints[0].y);
        for (let i = 1; i < cachedPoints.length; i++) {
          ctx.lineTo(cachedPoints[i].x, cachedPoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Show iteration levels side by side (small)
      const previewY = height * 0.78;
      const previewH = height * 0.12;
      const previewW = width / 7;

      ctx.fillStyle = "#aaa";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Iteration progression:", width / 2, previewY - 8);

      for (let n = 0; n <= Math.min(iterations, 5); n++) {
        const px = width * 0.08 + n * previewW;
        const pts = generateKoch(n, showSnowflake > 0.5);

        // Find bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }

        const sx = (previewW - 10) / Math.max(maxX - minX, 1);
        const sy = previewH / Math.max(maxY - minY, 1);
        const s = Math.min(sx, sy) * 0.8;

        ctx.strokeStyle = n === iterations ? "#ffeb3b" : "#4fc3f7";
        ctx.lineWidth = n === iterations ? 1.5 : 0.8;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const x = px + (pts[i].x - (minX + maxX) / 2) * s + previewW / 2;
          const y = previewY + (pts[i].y - (minY + maxY) / 2) * s + previewH / 2;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = n === iterations ? "#ffeb3b" : "#888";
        ctx.font = "9px sans-serif";
        ctx.fillText(`n=${n}`, px + previewW / 2, previewY + previewH + 12);
      }

      // Info
      const pathLength = computeLength(cachedPoints);
      const theoreticalRatio = Math.pow(4 / 3, iterations);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Segments: ${cachedPoints.length - 1} | Path length ratio: (4/3)^${iterations} = ${theoreticalRatio.toFixed(2)}× | Fractal dimension: log4/log3 ≈ 1.26`, width / 2, height - 8);
    },
    reset() {
      time = 0;
      cachedIterations = -1;
      cachedSnowflake = -1;
    },
    destroy() {},
    getStateDescription(): string {
      const numSegments = cachedPoints.length - 1;
      const theoreticalRatio = Math.pow(4 / 3, iterations);
      return `Koch ${showSnowflake > 0.5 ? "snowflake" : "curve"} at iteration ${iterations}: ${numSegments} segments. Each iteration replaces middle third of each segment with two sides of an equilateral triangle. Path length grows by 4/3 each iteration (${theoreticalRatio.toFixed(2)}× original). Fractal dimension ≈ 1.26, between a line (1D) and a plane (2D).`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      cachedIterations = -1;
    },
  };

  return engine;
};

export default KochCurveFactory;
