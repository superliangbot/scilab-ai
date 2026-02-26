import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PythagorasTreeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pythagoras-tree") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let depth = 10;
  let branchAngle = 45;
  let sizeRatio = 0.7;
  let colorShift = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    depth = Math.round(params.depth ?? 10);
    branchAngle = params.branchAngle ?? 45;
    sizeRatio = params.sizeRatio ?? 0.7;
    colorShift = params.colorShift ?? 0;
    time += dt;
  }

  function drawSquare(
    x: number, y: number, size: number, angle: number,
    currentDepth: number, maxDepth: number
  ): void {
    if (currentDepth > maxDepth || size < 1) return;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Four corners of the square
    const x0 = x;
    const y0 = y;
    const x1 = x + size * cos;
    const y1 = y - size * sin;
    const x2 = x1 - size * sin;
    const y2 = y1 - size * cos;
    const x3 = x - size * sin;
    const y3 = y - size * cos;

    // Color based on depth
    const hue = (currentDepth / maxDepth) * 120 + colorShift;
    const lightness = 30 + (currentDepth / maxDepth) * 30;
    const alpha = 0.7 + (1 - currentDepth / maxDepth) * 0.3;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();

    ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}%, ${alpha})`;
    ctx.fill();
    ctx.strokeStyle = `hsla(${hue}, 70%, ${lightness + 20}%, ${alpha * 0.5})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Top edge midpoint and triangle apex for branching
    const angleLeft = angle + (branchAngle * Math.PI) / 180;
    const angleRight = angle - ((90 - branchAngle) * Math.PI) / 180;

    const leftSize = size * sizeRatio * Math.sin((branchAngle * Math.PI) / 180);
    const rightSize = size * sizeRatio * Math.cos((branchAngle * Math.PI) / 180);

    // Triangle apex point
    const brAngle = (branchAngle * Math.PI) / 180;
    const apexX = x3 + leftSize * Math.cos(angle + brAngle);
    const apexY = y3 - leftSize * Math.sin(angle + brAngle);

    // Draw triangle connecting squares
    if (currentDepth < maxDepth) {
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(apexX, apexY);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue + 60}, 60%, ${lightness + 10}%, ${alpha * 0.5})`;
      ctx.fill();
    }

    // Left branch
    drawSquare(x3, y3, leftSize, angle + brAngle, currentDepth + 1, maxDepth);

    // Right branch
    drawSquare(apexX, apexY, rightSize, angle - (Math.PI / 2 - brAngle), currentDepth + 1, maxDepth);
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw tree
    const baseSize = Math.min(width, height) * 0.12;
    const startX = width / 2 - baseSize / 2;
    const startY = height * 0.88;

    drawSquare(startX, startY, baseSize, 0, 0, depth);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pythagoras Tree Fractal", width / 2, 28);

    ctx.fillStyle = "rgba(180, 220, 255, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(
      `Depth: ${depth}  |  Branch angle: ${branchAngle.toFixed(0)}°  |  Size ratio: ${sizeRatio.toFixed(2)}`,
      width / 2, 48
    );

    // Explanation
    ctx.fillStyle = "rgba(180, 220, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Each square branches into two squares via a right triangle (a² + b² = c²)", width / 2, height - 35);

    // Total squares count
    const totalSquares = Math.pow(2, depth + 1) - 1;
    ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
    ctx.font = "12px 'SF Mono', monospace";
    ctx.fillText(`Total squares: ${totalSquares}`, width / 2, height - 18);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const totalSquares = Math.pow(2, depth + 1) - 1;
    return (
      `Pythagoras Tree fractal: recursion depth ${depth}, branch angle ${branchAngle}°, ` +
      `size ratio ${sizeRatio.toFixed(2)}. Total squares: ${totalSquares}. ` +
      `Each square at level n branches into two smaller squares forming a right triangle, ` +
      `demonstrating a² + b² = c² geometrically. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PythagorasTreeFactory;
