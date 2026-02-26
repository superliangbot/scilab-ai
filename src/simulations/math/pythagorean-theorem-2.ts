import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PythagoreanTheorem2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pythagorean-theorem-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let sideA = 3;
  let sideB = 4;
  let proofPhase = 50;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    sideA = params.sideA ?? 3;
    sideB = params.sideB ?? 4;
    proofPhase = params.proofPhase ?? 50;
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const c = Math.sqrt(sideA * sideA + sideB * sideB);
    const phase = proofPhase / 100; // 0 to 1

    // Proof by rearrangement: two squares of side (a+b)
    // Left: four triangles + c² square in center
    // Right: four triangles + a² + b² squares

    const totalSide = sideA + sideB;
    const scale = Math.min(width * 0.35, height * 0.55) / totalSide;
    const leftCx = width * 0.27;
    const rightCx = width * 0.73;
    const cy = height * 0.48;

    const sA = sideA * scale;
    const sB = sideB * scale;
    const sTotal = totalSide * scale;

    // Draw left square arrangement
    drawArrangement1(leftCx - sTotal / 2, cy - sTotal / 2, sA, sB, sTotal, 1 - phase * 0.3);

    // Draw right square arrangement
    drawArrangement2(rightCx - sTotal / 2, cy - sTotal / 2, sA, sB, sTotal, 0.5 + phase * 0.5);

    // Arrow between
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + phase * 0.4})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(width * 0.45, cy);
    ctx.lineTo(width * 0.55, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + phase * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(width * 0.55 + 6, cy);
    ctx.lineTo(width * 0.55 - 3, cy - 5);
    ctx.lineTo(width * 0.55 - 3, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("rearrange", width / 2, cy - 10);

    // Labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("(a + b)² = 4·½ab + c²", leftCx, cy + sTotal / 2 + 25);
    ctx.fillText("(a + b)² = 4·½ab + a² + b²", rightCx, cy + sTotal / 2 + 25);

    // Title
    ctx.fillStyle = "rgba(255, 200, 100, 0.95)";
    ctx.font = "bold 18px 'SF Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("a² + b² = c²", width / 2, 30);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText("Proof by Rearrangement", width / 2, 52);

    // Numerical values
    ctx.fillStyle = "rgba(180, 220, 255, 0.7)";
    ctx.font = "13px 'SF Mono', monospace";
    ctx.fillText(
      `a = ${sideA.toFixed(1)}, b = ${sideB.toFixed(1)}, c = ${c.toFixed(2)}  |  ` +
      `${sideA.toFixed(1)}² + ${sideB.toFixed(1)}² = ${(sideA * sideA + sideB * sideB).toFixed(1)} = ${c.toFixed(2)}²`,
      width / 2, height - 30
    );

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function drawArrangement1(ox: number, oy: number, sA: number, sB: number, sTotal: number, alpha: number): void {
    // Big square outline
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, sTotal, sTotal);

    // Four right triangles, leaving a tilted c² square in the center
    const triangles = [
      [ox, oy + sA, ox, oy, ox + sB, oy], // top-left
      [ox + sB, oy, ox + sTotal, oy, ox + sTotal, oy + sA], // top-right (adjusted)
      [ox + sTotal, oy + sA, ox + sTotal, oy + sTotal, ox + sA, oy + sTotal], // bottom-right
      [ox + sA, oy + sTotal, ox, oy + sTotal, ox, oy + sA], // bottom-left (adjusted)
    ];

    // Actually let me compute the proper vertices for the rearrangement proof
    // In the first arrangement: big square (a+b)², with four triangles at corners
    // Triangle vertices: (0,a), (b,0), and the corners
    const p1 = { x: ox, y: oy + sA };
    const p2 = { x: ox + sB, y: oy };
    const p3 = { x: ox + sTotal, y: oy + sB };
    const p4 = { x: ox + sA, y: oy + sTotal };

    // Draw four triangles
    const triSets = [
      [ox, oy, p2.x, p2.y, p1.x, p1.y],
      [ox + sTotal, oy, p3.x, p3.y, p2.x, p2.y],
      [ox + sTotal, oy + sTotal, p4.x, p4.y, p3.x, p3.y],
      [ox, oy + sTotal, p1.x, p1.y, p4.x, p4.y],
    ];

    const triColors = [
      `rgba(255, 100, 100, ${alpha * 0.5})`,
      `rgba(100, 200, 255, ${alpha * 0.5})`,
      `rgba(255, 200, 100, ${alpha * 0.5})`,
      `rgba(100, 255, 150, ${alpha * 0.5})`,
    ];

    for (let i = 0; i < 4; i++) {
      const t = triSets[i];
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      ctx.lineTo(t[2], t[3]);
      ctx.lineTo(t[4], t[5]);
      ctx.closePath();
      ctx.fillStyle = triColors[i];
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Central c² square
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fillStyle = `rgba(200, 150, 255, ${alpha * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(200, 150, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = `rgba(200, 150, 255, ${alpha * 0.9})`;
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("c²", (p1.x + p2.x + p3.x + p4.x) / 4, (p1.y + p2.y + p3.y + p4.y) / 4 + 6);
  }

  function drawArrangement2(ox: number, oy: number, sA: number, sB: number, sTotal: number, alpha: number): void {
    // Big square outline
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, sTotal, sTotal);

    // Four triangles packed along the diagonal, leaving a² and b² exposed
    // Top-left triangle
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + sB, oy);
    ctx.lineTo(ox, oy + sA);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 100, 100, ${alpha * 0.5})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Top-right triangle (rotated, adjacent)
    ctx.beginPath();
    ctx.moveTo(ox + sB, oy);
    ctx.lineTo(ox + sTotal, oy);
    ctx.lineTo(ox + sTotal, oy + sB);
    ctx.closePath();
    ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.5})`;
    ctx.fill();
    ctx.stroke();

    // Bottom-right triangle
    ctx.beginPath();
    ctx.moveTo(ox + sTotal, oy + sB);
    ctx.lineTo(ox + sTotal, oy + sTotal);
    ctx.lineTo(ox + sA, oy + sTotal);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.5})`;
    ctx.fill();
    ctx.stroke();

    // Bottom-left triangle
    ctx.beginPath();
    ctx.moveTo(ox, oy + sA);
    ctx.lineTo(ox + sA, oy + sTotal);
    ctx.lineTo(ox, oy + sTotal);
    ctx.closePath();
    ctx.fillStyle = `rgba(100, 255, 150, ${alpha * 0.5})`;
    ctx.fill();
    ctx.stroke();

    // a² square (bottom-left area)
    ctx.fillStyle = `rgba(255, 100, 100, ${alpha * 0.25})`;
    ctx.fillRect(ox, oy + sA, sA, sA);
    ctx.strokeStyle = `rgba(255, 100, 100, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy + sA, sA, sA);

    ctx.fillStyle = `rgba(255, 100, 100, ${alpha * 0.9})`;
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("a²", ox + sA / 2, oy + sA + sA / 2 + 6);

    // b² square (top-right area)
    ctx.fillStyle = `rgba(100, 100, 255, ${alpha * 0.25})`;
    ctx.fillRect(ox + sA, oy, sB, sB);
    ctx.strokeStyle = `rgba(100, 100, 255, ${alpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + sA, oy, sB, sB);

    ctx.fillStyle = `rgba(100, 100, 255, ${alpha * 0.9})`;
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("b²", ox + sA + sB / 2, oy + sB / 2 + 6);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const c = Math.sqrt(sideA * sideA + sideB * sideB);
    return (
      `Pythagorean Theorem proof by rearrangement. a = ${sideA}, b = ${sideB}, c = ${c.toFixed(3)}. ` +
      `Two (a+b)² squares, each containing four identical right triangles of area ½ab. ` +
      `Left: remaining area = c² (tilted square). Right: remaining area = a² + b². ` +
      `Since both squares are the same size with the same triangles, c² = a² + b². ` +
      `Proof phase: ${proofPhase}%. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PythagoreanTheorem2Factory;
