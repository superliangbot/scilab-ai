import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DragonCurveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("dragon-curve") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let order = 12;
  let animateSpeed = 2;
  let colorMode = 0;

  // Dragon curve points cache
  let points: { x: number; y: number }[] = [];
  let currentOrder = -1;
  let drawProgress = 0;

  // Generate dragon curve sequence of turns: R and L
  function generateTurns(n: number): number[] {
    // 1 = right, -1 = left
    let turns: number[] = [];
    for (let i = 0; i < n; i++) {
      const newTurns: number[] = [];
      for (let j = turns.length - 1; j >= 0; j--) {
        newTurns.push(-turns[j]);
      }
      turns = [...turns, 1, ...newTurns];
    }
    return turns;
  }

  function generatePoints(n: number): { x: number; y: number }[] {
    const turns = generateTurns(n);
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    let dx = 1;
    let dy = 0;

    for (const turn of turns) {
      // Move forward
      const last = pts[pts.length - 1];
      pts.push({ x: last.x + dx, y: last.y + dy });

      // Turn
      if (turn === 1) {
        // Right turn: (dx,dy) -> (dy, -dx)
        const tmp = dx;
        dx = dy;
        dy = -tmp;
      } else {
        // Left turn: (dx,dy) -> (-dy, dx)
        const tmp = dx;
        dx = -dy;
        dy = tmp;
      }
    }
    // Final point
    const last = pts[pts.length - 1];
    pts.push({ x: last.x + dx, y: last.y + dy });

    return pts;
  }

  function rebuildCurve(): void {
    const clampedOrder = Math.min(Math.round(order), 18);
    if (clampedOrder !== currentOrder) {
      points = generatePoints(clampedOrder);
      currentOrder = clampedOrder;
      drawProgress = 0;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentOrder = -1;
    drawProgress = 0;
    rebuildCurve();
  }

  function update(dt: number, params: Record<string, number>): void {
    order = params.order ?? 12;
    animateSpeed = params.animateSpeed ?? 2;
    colorMode = params.colorMode ?? 0;
    time += dt;

    rebuildCurve();

    // Animate drawing
    const totalSegments = points.length - 1;
    const segmentsPerSecond = totalSegments * (animateSpeed / 10);
    drawProgress += segmentsPerSecond * dt;
    if (drawProgress > totalSegments) drawProgress = totalSegments;
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    if (points.length < 2) return;

    // Compute bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const pw = maxX - minX || 1;
    const ph = maxY - minY || 1;
    const margin = 40;
    const scaleX = (width - 2 * margin) / pw;
    const scaleY = (height - 2 * margin) / ph;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - pw * scale) / 2 - minX * scale;
    const offsetY = (height - ph * scale) / 2 - minY * scale;

    function toScreen(p: { x: number; y: number }): { x: number; y: number } {
      return { x: p.x * scale + offsetX, y: p.y * scale + offsetY };
    }

    const segsToDraw = Math.floor(drawProgress);
    const totalSegs = points.length - 1;

    // Draw curve
    ctx.lineWidth = Math.max(1, 2 - currentOrder * 0.1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (colorMode === 0) {
      // Rainbow gradient along curve
      for (let i = 0; i < segsToDraw; i++) {
        const p1 = toScreen(points[i]);
        const p2 = toScreen(points[i + 1]);
        const hue = (i / totalSegs) * 360;
        ctx.strokeStyle = `hsl(${hue}, 80%, 55%)`;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    } else if (colorMode === 1) {
      // Depth coloring
      for (let i = 0; i < segsToDraw; i++) {
        const p1 = toScreen(points[i]);
        const p2 = toScreen(points[i + 1]);
        const depth = Math.floor(Math.log2(i + 1));
        const hue = (depth * 30) % 360;
        ctx.strokeStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    } else {
      // Single color with glow
      ctx.strokeStyle = "rgba(100,180,255,0.3)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i <= segsToDraw && i < points.length; i++) {
        const p = toScreen(points[i]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      ctx.strokeStyle = "#44aaff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= segsToDraw && i < points.length; i++) {
        const p = toScreen(points[i]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // Draw head point if still animating
    if (segsToDraw < totalSegs && segsToDraw > 0) {
      const head = toScreen(points[segsToDraw]);
      ctx.beginPath();
      ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 230, 72, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Dragon Curve", 16, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#ccc";
    ctx.fillText(`Order: ${currentOrder}`, 16, 46);
    ctx.fillText(`Segments: ${segsToDraw} / ${totalSegs}`, 16, 62);
    const pct = ((segsToDraw / totalSegs) * 100).toFixed(0);
    ctx.fillText(`Progress: ${pct}%`, 130, 46);

    // Note about self-avoidance
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("The dragon curve is self-similar and never self-intersects", width / 2, height - 10);
  }

  function reset(): void {
    time = 0;
    drawProgress = 0;
  }

  function destroy(): void {
    points = [];
  }

  function getStateDescription(): string {
    const totalSegs = points.length - 1;
    const segsToDraw = Math.floor(drawProgress);
    return (
      `Dragon Curve: order=${currentOrder}, total segments=${totalSegs}, ` +
      `drawn=${segsToDraw} (${((segsToDraw / totalSegs) * 100).toFixed(0)}%). ` +
      `Color mode: ${colorMode === 0 ? "rainbow" : colorMode === 1 ? "depth" : "single"}. ` +
      `The dragon curve is a fractal created by recursive paper folding. ` +
      `At order n, it has 2^n segments. It is self-similar and never crosses itself.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DragonCurveFactory;
