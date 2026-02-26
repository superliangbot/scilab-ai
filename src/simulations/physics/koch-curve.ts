import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const KochCurveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("koch-curve") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;

  let order = 3;
  let showTriangle = 1; // 1=snowflake (3 sides), 0=single curve
  let colorMode = 0; // 0=solid, 1=depth-colored

  interface Point { x: number; y: number; }

  function kochPoints(p1: Point, p2: Point, depth: number): Point[] {
    if (depth === 0) return [p1, p2];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    const a: Point = { x: p1.x + dx / 3, y: p1.y + dy / 3 };
    const b: Point = { x: p1.x + dx * 2 / 3, y: p1.y + dy * 2 / 3 };

    // Peak of equilateral triangle
    const peak: Point = {
      x: (p1.x + p2.x) / 2 + (dy * Math.sqrt(3)) / 6,
      y: (p1.y + p2.y) / 2 - (dx * Math.sqrt(3)) / 6,
    };

    const left = kochPoints(p1, a, depth - 1);
    const upLeft = kochPoints(a, peak, depth - 1);
    const upRight = kochPoints(peak, b, depth - 1);
    const right = kochPoints(b, p2, depth - 1);

    // Merge, removing duplicates at joins
    return [...left.slice(0, -1), ...upLeft.slice(0, -1), ...upRight.slice(0, -1), ...right];
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },
    update(_dt: number, params: Record<string, number>) {
      order = Math.max(0, Math.min(7, Math.round(params.order ?? 3)));
      showTriangle = params.showTriangle ?? 1;
      colorMode = Math.round(params.colorMode ?? 0);
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(showTriangle ? "Koch Snowflake" : "Koch Curve", width / 2, 24);

      const cx = width / 2;
      const cy = height * 0.52;
      const size = Math.min(width, height) * 0.6;

      if (showTriangle) {
        // Three sides of equilateral triangle
        const h = size * Math.sqrt(3) / 2;
        const p1: Point = { x: cx - size / 2, y: cy + h / 3 };
        const p2: Point = { x: cx + size / 2, y: cy + h / 3 };
        const p3: Point = { x: cx, y: cy - 2 * h / 3 };

        drawKochSide(p1, p2, order);
        drawKochSide(p2, p3, order);
        drawKochSide(p3, p1, order);
      } else {
        const p1: Point = { x: cx - size / 2, y: cy + 30 };
        const p2: Point = { x: cx + size / 2, y: cy + 30 };
        drawKochSide(p1, p2, order);
      }

      // Info panel
      const numSegments = showTriangle ? 3 * Math.pow(4, order) : Math.pow(4, order);
      const sideLength = size / Math.pow(3, order);
      const totalLength = numSegments * sideLength;
      const originalLength = showTriangle ? size * 3 : size;

      ctx.fillStyle = "#94a3b8";
      ctx.font = `${Math.max(11, width * 0.015)}px monospace`;
      ctx.textAlign = "left";
      const ix = 15;
      let iy = height - 70;
      ctx.fillText(`Order: ${order}`, ix, iy); iy += 16;
      ctx.fillText(`Segments: ${numSegments.toLocaleString()}`, ix, iy); iy += 16;
      ctx.fillText(`Length ratio: ${(totalLength / originalLength).toFixed(3)}× = (4/3)^${order}`, ix, iy); iy += 16;
      ctx.fillText(`Each iteration: segments ×4, length ×(4/3)`, ix, iy);

      // Dimension info
      ctx.fillStyle = "#818cf8";
      ctx.textAlign = "right";
      const dim = Math.log(4) / Math.log(3);
      ctx.fillText(`Fractal dimension: log4/log3 ≈ ${dim.toFixed(4)}`, width - 15, height - 12);
    },
    reset() {},
    destroy() {},
    getStateDescription(): string {
      const numSegments = showTriangle ? 3 * Math.pow(4, order) : Math.pow(4, order);
      const dim = Math.log(4) / Math.log(3);
      return `Koch ${showTriangle ? "snowflake" : "curve"} at order ${order}. ` +
        `${numSegments.toLocaleString()} line segments. Length grows by factor 4/3 each iteration. ` +
        `Fractal dimension = log(4)/log(3) ≈ ${dim.toFixed(4)}. ` +
        `The Koch curve has infinite length but encloses finite area. ` +
        `It is self-similar: any part looks like the whole when magnified.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawKochSide(p1: Point, p2: Point, depth: number) {
    const pts = kochPoints(p1, p2, depth);

    if (colorMode === 0) {
      // Solid color
      ctx.strokeStyle = "#60a5fa";
      ctx.lineWidth = Math.max(1, 2 - depth * 0.2);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    } else {
      // Rainbow gradient along path
      for (let i = 0; i < pts.length - 1; i++) {
        const t = i / (pts.length - 1);
        const hue = t * 300;
        ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
        ctx.lineWidth = Math.max(1, 2 - depth * 0.2);
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }
    }
  }
};

export default KochCurveFactory;
