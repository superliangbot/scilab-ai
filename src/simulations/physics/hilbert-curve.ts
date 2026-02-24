import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HilbertCurveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("hilbert-curve") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let order = 4;
  let drawSpeed = 50; // points per second
  let colorMode = 0; // 0=rainbow, 1=single

  let points: { x: number; y: number }[] = [];
  let drawnCount = 0;

  function hilbert(order: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const n = 1 << order; // 2^order

    for (let i = 0; i < n * n; i++) {
      let rx: number, ry: number, s: number;
      let tx = 0, ty = 0;
      let d = i;
      for (s = 1; s < n; s *= 2) {
        rx = (d / 2) & 1;
        ry = ((d + rx) ^ (d >> 1)) & 1;
        // Rotate
        if (ry === 0) {
          if (rx === 1) {
            tx = s - 1 - tx;
            ty = s - 1 - ty;
          }
          const temp = tx;
          tx = ty;
          ty = temp;
        }
        tx += s * rx;
        ty += s * ry;
        d = Math.floor(d / 4);
      }
      pts.push({ x: tx / (n - 1), y: ty / (n - 1) });
    }

    return pts;
  }

  function generatePoints() {
    points = hilbert(order);
    drawnCount = 0;
  }

  function hslToRgb(h: number, s: number, l: number): string {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    const r = Math.round(f(0) * 255);
    const g = Math.round(f(8) * 255);
    const b = Math.round(f(4) * 255);
    return `rgb(${r},${g},${b})`;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      generatePoints();
    },

    update(dt: number, params: Record<string, number>) {
      const newOrder = Math.round(params.order ?? 4);
      const newSpeed = params.drawSpeed ?? 50;
      const newColorMode = params.colorMode ?? 0;

      if (newOrder !== order) {
        order = newOrder;
        generatePoints();
      }
      drawSpeed = newSpeed;
      colorMode = newColorMode;

      // Animate drawing
      if (drawnCount < points.length) {
        drawnCount = Math.min(points.length, drawnCount + drawSpeed * dt);
      }

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Hilbert Space-Filling Curve", width / 2, 28);

      // Info
      const totalPoints = points.length;
      ctx.fillStyle = "#889";
      ctx.font = "12px monospace";
      ctx.fillText(`Order: ${order}  |  Points: ${Math.floor(drawnCount)}/${totalPoints}  |  Grid: ${1 << order}×${1 << order}`, width / 2, 48);

      if (points.length < 2) return;

      // Draw area
      const margin = 60;
      const size = Math.min(width - margin * 2, height - margin * 2 - 40);
      const offsetX = (width - size) / 2;
      const offsetY = 60 + (height - size - 80) / 2;

      // Background grid
      const gridN = 1 << order;
      const cellSize = size / gridN;
      ctx.strokeStyle = "rgba(40,50,70,0.3)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= gridN; i++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + i * cellSize, offsetY);
        ctx.lineTo(offsetX + i * cellSize, offsetY + size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + size, offsetY + i * cellSize);
        ctx.stroke();
      }

      // Draw the curve
      const count = Math.floor(drawnCount);
      ctx.lineWidth = Math.max(1.5, 4 - order * 0.5);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (colorMode === 0) {
        // Rainbow mode - draw segment by segment
        for (let i = 1; i < count; i++) {
          const hue = (i / totalPoints) * 360;
          ctx.strokeStyle = hslToRgb(hue, 0.8, 0.55);
          ctx.beginPath();
          ctx.moveTo(
            offsetX + points[i - 1].x * size,
            offsetY + points[i - 1].y * size
          );
          ctx.lineTo(
            offsetX + points[i].x * size,
            offsetY + points[i].y * size
          );
          ctx.stroke();
        }
      } else {
        // Single color mode
        ctx.strokeStyle = "#44aaff";
        ctx.shadowColor = "#44aaff";
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(
          offsetX + points[0].x * size,
          offsetY + points[0].y * size
        );
        for (let i = 1; i < count; i++) {
          ctx.lineTo(
            offsetX + points[i].x * size,
            offsetY + points[i].y * size
          );
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw current point
      if (count > 0 && count < totalPoints) {
        const cp = points[count - 1];
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(offsetX + cp.x * size, offsetY + cp.y * size, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Start/End markers
      if (points.length > 0) {
        ctx.fillStyle = "#44ff88";
        ctx.beginPath();
        ctx.arc(offsetX + points[0].x * size, offsetY + points[0].y * size, 5, 0, Math.PI * 2);
        ctx.fill();

        if (count >= totalPoints) {
          ctx.fillStyle = "#ff4444";
          ctx.beginPath();
          ctx.arc(offsetX + points[totalPoints - 1].x * size, offsetY + points[totalPoints - 1].y * size, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Progress
      const progress = (drawnCount / totalPoints) * 100;
      ctx.fillStyle = "#556";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${progress.toFixed(1)}% drawn  |  A space-filling curve visits every point in a square`, width / 2, height - 12);
    },

    reset() {
      time = 0;
      drawnCount = 0;
    },

    destroy() {
      points = [];
    },

    getStateDescription() {
      return `Hilbert curve order ${order}: ${Math.floor(drawnCount)}/${points.length} points drawn on a ${1 << order}×${1 << order} grid. The Hilbert curve is a continuous fractal space-filling curve that visits every cell in a square grid.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HilbertCurveFactory;
