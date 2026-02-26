import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Sierpinski Triangle — demonstrates the classic fractal using both
 * recursive subdivision and the chaos game (random point) method.
 */

interface ChaosPoint {
  x: number;
  y: number;
}

const SierpinskiTriangleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sierpinski-triangle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let recursionDepth = 6;
  let method = 0; // 0 = recursive, 1 = chaos game
  let colorful = 1;
  let animSpeed = 1;

  // Chaos game state
  let chaosPoints: ChaosPoint[] = [];
  let chaosX = 0;
  let chaosY = 0;
  let pointsPerFrame = 50;

  // Triangle vertices
  let v1 = { x: 0, y: 0 };
  let v2 = { x: 0, y: 0 };
  let v3 = { x: 0, y: 0 };

  function setupVertices(): void {
    const margin = 40;
    const size = Math.min(width, height) - margin * 2;
    const cx = width / 2;
    v1 = { x: cx, y: margin };
    v2 = { x: cx - size / 2, y: margin + size * Math.sin(Math.PI / 3) };
    v3 = { x: cx + size / 2, y: margin + size * Math.sin(Math.PI / 3) };
    chaosX = cx;
    chaosY = (v1.y + v2.y + v3.y) / 3;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    setupVertices();
    chaosPoints = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    recursionDepth = Math.round(params.recursionDepth ?? 6);
    method = params.method ?? 0;
    colorful = params.colorful ?? 1;
    animSpeed = params.animSpeed ?? 1;

    const step = Math.min(dt, 0.033);
    time += step;

    // Chaos game: add points each frame
    if (method >= 0.5) {
      const numNew = Math.round(pointsPerFrame * animSpeed);
      for (let i = 0; i < numNew && chaosPoints.length < 50000; i++) {
        const r = Math.floor(Math.random() * 3);
        const target = r === 0 ? v1 : r === 1 ? v2 : v3;
        chaosX = (chaosX + target.x) / 2;
        chaosY = (chaosY + target.y) / 2;
        chaosPoints.push({ x: chaosX, y: chaosY });
      }
    }
  }

  function drawTriangleRecursive(
    ax: number, ay: number,
    bx: number, by: number,
    cx: number, cy: number,
    depth: number,
    maxDepth: number
  ): void {
    if (depth >= maxDepth) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
      ctx.closePath();

      if (colorful >= 0.5) {
        const hue = (depth / maxDepth) * 240 + ((ax + by) * 0.1) % 120;
        ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.85)`;
      } else {
        ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
      }
      ctx.fill();
      return;
    }

    // Midpoints
    const mx1 = (ax + bx) / 2;
    const my1 = (ay + by) / 2;
    const mx2 = (bx + cx) / 2;
    const my2 = (by + cy) / 2;
    const mx3 = (ax + cx) / 2;
    const my3 = (ay + cy) / 2;

    // Recurse into 3 sub-triangles (skip middle)
    drawTriangleRecursive(ax, ay, mx1, my1, mx3, my3, depth + 1, maxDepth);
    drawTriangleRecursive(mx1, my1, bx, by, mx2, my2, depth + 1, maxDepth);
    drawTriangleRecursive(mx3, my3, mx2, my2, cx, cy, depth + 1, maxDepth);
  }

  function render(): void {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    if (method < 0.5) {
      // Recursive method
      drawTriangleRecursive(
        v1.x, v1.y,
        v2.x, v2.y,
        v3.x, v3.y,
        0, recursionDepth
      );

      // Outline
      ctx.strokeStyle = "rgba(100, 180, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y);
      ctx.lineTo(v2.x, v2.y);
      ctx.lineTo(v3.x, v3.y);
      ctx.closePath();
      ctx.stroke();
    } else {
      // Chaos game method
      // Draw vertices
      ctx.fillStyle = "#ff4444";
      for (const v of [v1, v2, v3]) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw accumulated points
      for (let i = 0; i < chaosPoints.length; i++) {
        const p = chaosPoints[i];
        if (colorful >= 0.5) {
          const hue = (i / chaosPoints.length) * 300;
          ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
        } else {
          ctx.fillStyle = "rgba(100, 180, 255, 0.6)";
        }
        ctx.fillRect(p.x, p.y, 1.2, 1.2);
      }

      // Current point
      ctx.fillStyle = "#ffcc33";
      ctx.beginPath();
      ctx.arc(chaosX, chaosY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 260, 105, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Sierpinski Triangle", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

    if (method < 0.5) {
      ctx.fillText(`Method: Recursive subdivision`, 20, 46);
      ctx.fillText(`Depth: ${recursionDepth} (${Math.pow(3, recursionDepth)} triangles)`, 20, 62);
      ctx.fillText(`Fractal dimension: log3/log2 ≈ 1.585`, 20, 78);
      ctx.fillText(`Self-similar at every scale`, 20, 94);
      ctx.fillText(`Area → 0 as depth → ∞`, 20, 110);
    } else {
      ctx.fillText(`Method: Chaos Game`, 20, 46);
      ctx.fillText(`Points plotted: ${chaosPoints.length.toLocaleString()}`, 20, 62);
      ctx.fillText(`Rule: pick random vertex, go halfway`, 20, 78);
      ctx.fillText(`Fractal emerges from randomness!`, 20, 94);
      ctx.fillText(`Hausdorff dimension ≈ 1.585`, 20, 110);
    }
  }

  function reset(): void {
    time = 0;
    chaosPoints = [];
    setupVertices();
  }

  function destroy(): void {
    chaosPoints = [];
  }

  function getStateDescription(): string {
    if (method < 0.5) {
      return (
        `Sierpinski Triangle (Recursive): Depth=${recursionDepth}, ` +
        `${Math.pow(3, recursionDepth)} filled triangles. ` +
        `Fractal dimension ≈ 1.585. Time: ${time.toFixed(1)}s.`
      );
    }
    return (
      `Sierpinski Triangle (Chaos Game): ${chaosPoints.length} points plotted. ` +
      `Each step: pick random vertex, move halfway. ` +
      `The fractal emerges from random iteration. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupVertices();
    if (method >= 0.5) {
      chaosPoints = []; // Reset chaos game on resize
    }
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SierpinskiTriangleFactory;
