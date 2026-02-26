import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PythagoreanTheoremFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pythagorean-theorem") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let sideA = 3;
  let sideB = 4;
  let animPhase = 50;

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
    animPhase = params.animPhase ?? 50;
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const c = Math.sqrt(sideA * sideA + sideB * sideB);
    const scale = Math.min(width, height) * 0.08 / Math.max(sideA, sideB, c) * Math.max(sideA, sideB, c) * 0.15;
    const scaleFactor = Math.min(width * 0.7, height * 0.6) / (c + Math.max(sideA, sideB)) * 0.65;

    const cx = width * 0.5;
    const cy = height * 0.5;

    // Draw the right triangle
    const triAx = cx - sideB * scaleFactor / 2;
    const triAy = cy + sideA * scaleFactor / 2;
    const triBx = cx + sideB * scaleFactor / 2;
    const triBy = cy + sideA * scaleFactor / 2;
    const triCx = cx - sideB * scaleFactor / 2;
    const triCy = cy - sideA * scaleFactor / 2;

    // Triangle
    ctx.beginPath();
    ctx.moveTo(triAx, triAy);
    ctx.lineTo(triBx, triBy);
    ctx.lineTo(triCx, triCy);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right angle marker
    const markerSize = 12;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(triAx + markerSize, triAy);
    ctx.lineTo(triAx + markerSize, triAy - markerSize);
    ctx.lineTo(triAx, triAy - markerSize);
    ctx.stroke();

    // Square on side a (vertical side) - left
    const phase = animPhase / 100;
    const aSquareAlpha = 0.5 + phase * 0.3;
    ctx.fillStyle = `rgba(255, 100, 100, ${aSquareAlpha * 0.3})`;
    ctx.strokeStyle = `rgba(255, 100, 100, ${aSquareAlpha})`;
    ctx.lineWidth = 1.5;
    const aLen = sideA * scaleFactor;
    ctx.beginPath();
    ctx.rect(triAx - aLen, triCy, aLen, aLen);
    ctx.fill();
    ctx.stroke();

    // Fill with small grid squares to show area
    const gridSize = aLen / sideA;
    ctx.strokeStyle = `rgba(255, 100, 100, ${aSquareAlpha * 0.3})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= sideA; i++) {
      ctx.beginPath();
      ctx.moveTo(triAx - aLen + i * gridSize, triCy);
      ctx.lineTo(triAx - aLen + i * gridSize, triCy + aLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(triAx - aLen, triCy + i * gridSize);
      ctx.lineTo(triAx, triCy + i * gridSize);
      ctx.stroke();
    }

    // Label a²
    ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`a² = ${(sideA * sideA).toFixed(0)}`, triAx - aLen / 2, triCy + aLen / 2 + 6);

    // Square on side b (horizontal side) - bottom
    const bLen = sideB * scaleFactor;
    ctx.fillStyle = `rgba(100, 100, 255, ${aSquareAlpha * 0.3})`;
    ctx.strokeStyle = `rgba(100, 100, 255, ${aSquareAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(triAx, triAy, bLen, bLen);
    ctx.fill();
    ctx.stroke();

    // Grid for b²
    const gridSizeB = bLen / sideB;
    ctx.strokeStyle = `rgba(100, 100, 255, ${aSquareAlpha * 0.3})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= sideB; i++) {
      ctx.beginPath();
      ctx.moveTo(triAx + i * gridSizeB, triAy);
      ctx.lineTo(triAx + i * gridSizeB, triAy + bLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(triAx, triAy + i * gridSizeB);
      ctx.lineTo(triAx + bLen, triAy + i * gridSizeB);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(100, 100, 255, 0.9)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(`b² = ${(sideB * sideB).toFixed(0)}`, triAx + bLen / 2, triAy + bLen / 2 + 6);

    // Square on hypotenuse c
    const cLen = c * scaleFactor;
    const hypAngle = Math.atan2(triCy - triBy, triCx - triBx);
    const perpAngle = hypAngle - Math.PI / 2;

    const cX0 = triBx;
    const cY0 = triBy;
    const cX1 = triCx;
    const cY1 = triCy;
    const cX2 = triCx + cLen * Math.cos(perpAngle);
    const cY2 = triCy + cLen * Math.sin(perpAngle);
    const cX3 = triBx + cLen * Math.cos(perpAngle);
    const cY3 = triBy + cLen * Math.sin(perpAngle);

    ctx.fillStyle = `rgba(100, 255, 100, ${aSquareAlpha * 0.2})`;
    ctx.strokeStyle = `rgba(100, 255, 100, ${aSquareAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cX0, cY0);
    ctx.lineTo(cX1, cY1);
    ctx.lineTo(cX2, cY2);
    ctx.lineTo(cX3, cY3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(100, 255, 100, 0.9)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(
      `c² = ${(c * c).toFixed(1)}`,
      (cX0 + cX1 + cX2 + cX3) / 4,
      (cY0 + cY1 + cY2 + cY3) / 4 + 6
    );

    // Side labels on the triangle
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
    ctx.textAlign = "right";
    ctx.fillText(`a = ${sideA.toFixed(1)}`, triAx - 8, (triAy + triCy) / 2);

    ctx.fillStyle = "rgba(100, 100, 255, 0.9)";
    ctx.textAlign = "center";
    ctx.fillText(`b = ${sideB.toFixed(1)}`, (triAx + triBx) / 2, triAy + 18);

    ctx.fillStyle = "rgba(100, 255, 100, 0.9)";
    const hypMidX = (triBx + triCx) / 2;
    const hypMidY = (triBy + triCy) / 2;
    ctx.textAlign = "left";
    ctx.fillText(`c = ${c.toFixed(2)}`, hypMidX + 8, hypMidY);

    // Formula display
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, height * 0.02, width * 0.9, 45, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 200, 100, 0.95)";
    ctx.font = "bold 18px 'SF Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("a² + b² = c²", width / 2, height * 0.02 + 22);

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "14px 'SF Mono', monospace";
    ctx.fillText(
      `${sideA.toFixed(1)}² + ${sideB.toFixed(1)}² = ${(sideA * sideA).toFixed(1)} + ${(sideB * sideB).toFixed(1)} = ${(c * c).toFixed(1)} = ${c.toFixed(2)}²`,
      width / 2, height * 0.02 + 42
    );

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const c = Math.sqrt(sideA * sideA + sideB * sideB);
    return (
      `Pythagorean Theorem visualization: a = ${sideA}, b = ${sideB}, c = ${c.toFixed(3)}. ` +
      `a² = ${(sideA * sideA).toFixed(1)}, b² = ${(sideB * sideB).toFixed(1)}, c² = ${(c * c).toFixed(1)}. ` +
      `a² + b² = ${(sideA * sideA + sideB * sideB).toFixed(1)} = c². ` +
      `Squares drawn on each side show area equivalence. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PythagoreanTheoremFactory;
