import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Sierpinski Curve — draws the Sierpinski arrowhead curve, a fractal that
 * approximates the Sierpinski triangle as a single continuous path.
 */

const SierpinskiCurveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sierpinski-curve") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let recursionDepth = 5;
  let lineWidth = 1.5;
  let animSpeed = 1;
  let colorMode = 0;

  let points: { x: number; y: number }[] = [];
  let drawProgress = 0;

  function generateSierpinskiCurve(depth: number): void {
    points = [];
    const margin = 40;
    const size = Math.min(width, height) - margin * 2;
    const startX = (width - size) / 2;
    const startY = height - margin;

    let x = startX;
    let y = startY;
    let angle = 0;
    const len = size / Math.pow(2, depth);

    points.push({ x, y });

    function forward(d: number): void {
      x += d * Math.cos((angle * Math.PI) / 180);
      y -= d * Math.sin((angle * Math.PI) / 180);
      points.push({ x, y });
    }

    function left(a: number): void {
      angle += a;
    }

    function right(a: number): void {
      angle -= a;
    }

    function curveA(n: number): void {
      if (n === 0) {
        forward(len);
        return;
      }
      curveB(n - 1);
      left(60);
      curveA(n - 1);
      left(60);
      curveB(n - 1);
    }

    function curveB(n: number): void {
      if (n === 0) {
        forward(len);
        return;
      }
      curveA(n - 1);
      right(60);
      curveB(n - 1);
      right(60);
      curveA(n - 1);
    }

    if (depth % 2 === 0) {
      curveA(depth);
    } else {
      left(60);
      curveB(depth);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    drawProgress = 0;
    generateSierpinskiCurve(Math.round(recursionDepth));
  }

  function update(dt: number, params: Record<string, number>): void {
    const newDepth = Math.round(params.recursionDepth ?? 5);
    lineWidth = params.lineWidth ?? 1.5;
    animSpeed = params.animSpeed ?? 1;
    colorMode = params.colorMode ?? 0;

    if (newDepth !== recursionDepth) {
      recursionDepth = newDepth;
      generateSierpinskiCurve(recursionDepth);
      drawProgress = 0;
    }

    const step = Math.min(dt, 0.033);
    time += step;

    // Animate drawing
    if (drawProgress < 1) {
      drawProgress = Math.min(1, drawProgress + animSpeed * step * 0.3);
    }
  }

  function hslColor(t: number): string {
    if (colorMode < 0.5) {
      // Rainbow
      return `hsl(${t * 360}, 80%, 60%)`;
    } else if (colorMode < 1.5) {
      // Fire
      const h = t * 60; // red to yellow
      return `hsl(${h}, 90%, ${50 + t * 20}%)`;
    } else {
      // Ice
      const h = 180 + t * 60;
      return `hsl(${h}, 70%, ${40 + t * 30}%)`;
    }
  }

  function render(): void {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    if (points.length < 2) return;

    const numToDraw = Math.max(2, Math.floor(points.length * drawProgress));

    // Draw the curve
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw segments with color gradient
    for (let i = 1; i < numToDraw; i++) {
      const t = i / points.length;
      ctx.strokeStyle = hslColor(t);
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }

    // Glow at current drawing point
    if (drawProgress < 1 && numToDraw > 0) {
      const tip = points[numToDraw - 1];
      const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 15);
      glow.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 250, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Sierpinski Arrowhead Curve", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Recursion depth: ${recursionDepth}`, 20, 46);
    ctx.fillText(`Segments: ${points.length - 1}`, 20, 62);
    ctx.fillText(`A space-filling fractal curve`, 20, 78);
    ctx.fillText(`Progress: ${(drawProgress * 100).toFixed(0)}%`, 20, 94);
  }

  function reset(): void {
    time = 0;
    drawProgress = 0;
  }

  function destroy(): void {
    points = [];
  }

  function getStateDescription(): string {
    return (
      `Sierpinski Arrowhead Curve: Depth=${recursionDepth}, ${points.length - 1} segments. ` +
      `Draw progress: ${(drawProgress * 100).toFixed(0)}%. ` +
      `A fractal curve that fills the Sierpinski triangle. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    generateSierpinskiCurve(recursionDepth);
    drawProgress = 1; // Show full on resize
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SierpinskiCurveFactory;
