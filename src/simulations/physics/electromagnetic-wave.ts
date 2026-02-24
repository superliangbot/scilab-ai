import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const ElectromagneticWaveFactory: SimulationFactory = () => {
  const config = getSimConfig("electromagnetic-wave")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  // Wave state
  let phaseOffset = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    phaseOffset = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    const frequency = params.frequency ?? 1.5;
    time += dt;
    phaseOffset += dt * frequency * Math.PI * 2;
  }

  function render(): void {
    const wavelength = currentParams.wavelength ?? 4;
    const amplitude = currentParams.amplitude ?? 1.0;
    const frequency = currentParams.frequency ?? 1.5;
    const showBField = (currentParams.showBField ?? 1) >= 0.5;

    // Dark background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.48;
    const scale = Math.min(width, height);

    // 3D projection parameters
    const axisLen = width * 0.38;
    const ampScale = scale * 0.15 * amplitude;
    const zTilt = 0.45; // perspective foreshortening for Z axis
    const zAngle = Math.PI / 6; // 30 degrees below horizontal for Z

    // Number of wave cycles visible
    const numPoints = 300;
    const waveLen = axisLen * 2 / wavelength; // pixels per wavelength unit
    const totalLen = axisLen * 2;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Electromagnetic Wave", width / 2, Math.max(24, height * 0.05));

    // --- Draw coordinate axes ---
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    // X axis (propagation direction) - horizontal
    const xStart = cx - axisLen * 1.05;
    const xEnd = cx + axisLen * 1.05;
    ctx.strokeStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(xStart, cy);
    ctx.lineTo(xEnd, cy);
    ctx.stroke();
    drawArrowhead(ctx, xEnd, cy, 0, "#64748b");

    // Y axis (E field) - vertical
    const yTop = cy - ampScale * 1.3;
    const yBot = cy + ampScale * 1.3;
    ctx.strokeStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(cx - axisLen * 1.05, cy);
    ctx.moveTo(cx - axisLen, yTop);
    ctx.lineTo(cx - axisLen, yBot);
    ctx.stroke();
    drawArrowhead(ctx, cx - axisLen, yTop, -Math.PI / 2, "#64748b");

    // Z axis (B field) - projected at angle
    if (showBField) {
      const zLen = ampScale * 1.3;
      const zEndX = cx - axisLen + Math.cos(zAngle) * zLen * zTilt;
      const zEndY = cy + Math.sin(zAngle) * zLen * zTilt;
      const zEndXn = cx - axisLen - Math.cos(zAngle) * zLen * zTilt;
      const zEndYn = cy - Math.sin(zAngle) * zLen * zTilt;
      ctx.strokeStyle = "#64748b";
      ctx.beginPath();
      ctx.moveTo(zEndXn, zEndYn);
      ctx.lineTo(zEndX, zEndY);
      ctx.stroke();
      drawArrowhead(ctx, zEndX, zEndY, zAngle, "#64748b");

      // Z axis label
      ctx.fillStyle = "#60a5fa";
      ctx.font = `bold ${Math.max(11, width * 0.016)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("z (B)", zEndX + 14, zEndY + 14);
    }

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = `bold ${Math.max(11, width * 0.016)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("x (propagation)", xEnd - 40, cy + 20);

    ctx.fillStyle = "#f87171";
    ctx.fillText("y (E)", cx - axisLen - 20, yTop + 5);

    // --- Compute wave points ---
    const ePoints: { x: number; y: number }[] = [];
    const bPoints: { x: number; y: number; bx: number; by: number }[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const xPos = cx - axisLen + t * totalLen;
      const wavePhase = (t * totalLen / waveLen) * Math.PI * 2 - phaseOffset;
      const sinVal = Math.sin(wavePhase);

      // E field: oscillates in Y (vertical)
      ePoints.push({
        x: xPos,
        y: cy - sinVal * ampScale,
      });

      // B field: oscillates in Z (projected)
      if (showBField) {
        const bDisp = sinVal * ampScale * zTilt;
        bPoints.push({
          x: xPos + Math.cos(zAngle) * bDisp,
          y: cy + Math.sin(zAngle) * bDisp,
          bx: xPos,
          by: cy,
        });
      }
    }

    // --- Draw B field filled area (behind E field) ---
    if (showBField && bPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(bPoints[0].bx, bPoints[0].by);
      for (let i = 0; i < bPoints.length; i++) {
        ctx.lineTo(bPoints[i].x, bPoints[i].y);
      }
      ctx.lineTo(bPoints[bPoints.length - 1].bx, bPoints[bPoints.length - 1].by);
      ctx.closePath();
      ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
      ctx.fill();

      // B field wave line
      ctx.beginPath();
      ctx.moveTo(bPoints[0].x, bPoints[0].y);
      for (let i = 1; i < bPoints.length; i++) {
        ctx.lineTo(bPoints[i].x, bPoints[i].y);
      }
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // B field vertical lines (field vectors) every ~20 pixels
      const bVecSpacing = Math.max(1, Math.floor(numPoints / 30));
      for (let i = 0; i < bPoints.length; i += bVecSpacing) {
        const dx = bPoints[i].x - bPoints[i].bx;
        const dy = bPoints[i].y - bPoints[i].by;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag > 2) {
          ctx.strokeStyle = "rgba(59, 130, 246, 0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bPoints[i].bx, bPoints[i].by);
          ctx.lineTo(bPoints[i].x, bPoints[i].y);
          ctx.stroke();
        }
      }
    }

    // --- Draw E field filled area ---
    ctx.beginPath();
    ctx.moveTo(ePoints[0].x, cy);
    for (let i = 0; i < ePoints.length; i++) {
      ctx.lineTo(ePoints[i].x, ePoints[i].y);
    }
    ctx.lineTo(ePoints[ePoints.length - 1].x, cy);
    ctx.closePath();
    ctx.fillStyle = "rgba(248, 113, 113, 0.10)";
    ctx.fill();

    // E field wave line
    ctx.beginPath();
    ctx.moveTo(ePoints[0].x, ePoints[0].y);
    for (let i = 1; i < ePoints.length; i++) {
      ctx.lineTo(ePoints[i].x, ePoints[i].y);
    }
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // E field vertical lines (field vectors)
    const eVecSpacing = Math.max(1, Math.floor(numPoints / 30));
    for (let i = 0; i < ePoints.length; i += eVecSpacing) {
      const dy = ePoints[i].y - cy;
      if (Math.abs(dy) > 2) {
        ctx.strokeStyle = "rgba(248, 113, 113, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ePoints[i].x, cy);
        ctx.lineTo(ePoints[i].x, ePoints[i].y);
        ctx.stroke();
      }
    }

    // --- Wavelength annotation ---
    // Find one full wavelength along the top of the E wave
    const lambdaPx = waveLen;
    const annoY = cy - ampScale * 1.15;
    const annoX1 = cx - axisLen + totalLen * 0.15;
    const annoX2 = annoX1 + lambdaPx;

    if (annoX2 < xEnd - 20) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);

      // Left vertical tick
      ctx.beginPath();
      ctx.moveTo(annoX1, annoY - 8);
      ctx.lineTo(annoX1, annoY + 8);
      ctx.stroke();

      // Right vertical tick
      ctx.beginPath();
      ctx.moveTo(annoX2, annoY - 8);
      ctx.lineTo(annoX2, annoY + 8);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(annoX1, annoY);
      ctx.lineTo(annoX2, annoY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Lambda label
      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${Math.max(13, width * 0.018)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("\u03BB", (annoX1 + annoX2) / 2, annoY - 10);
    }

    // --- Propagation arrow ---
    const propArrowY = cy + ampScale * 1.25;
    const propArrowX1 = cx - axisLen * 0.3;
    const propArrowX2 = cx + axisLen * 0.3;
    ctx.strokeStyle = "rgba(163, 230, 53, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(propArrowX1, propArrowY);
    ctx.lineTo(propArrowX2, propArrowY);
    ctx.stroke();
    drawArrowhead(ctx, propArrowX2, propArrowY, 0, "rgba(163, 230, 53, 0.8)");

    ctx.fillStyle = "rgba(163, 230, 53, 0.8)";
    ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("direction of propagation", (propArrowX1 + propArrowX2) / 2, propArrowY + 16);

    // --- Info panel ---
    const panelW = Math.min(280, width * 0.38);
    const panelH = showBField ? 120 : 105;
    const panelX = 12;
    const panelY = height - panelH - 12;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.stroke();

    const fontSize = Math.max(11, width * 0.014);
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    const lineH = fontSize + 5;

    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`c = 3.00 \u00D7 10\u2078 m/s`, panelX + 10, infoY);
    infoY += lineH;

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`\u03BB = ${wavelength.toFixed(1)} units`, panelX + 10, infoY);
    infoY += lineH;

    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`f = ${frequency.toFixed(1)} Hz (visual)`, panelX + 10, infoY);
    infoY += lineH;

    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`A = ${amplitude.toFixed(2)}`, panelX + 10, infoY);
    infoY += lineH;

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`c = \u03BBf`, panelX + 10, infoY);
    infoY += lineH;

    if (showBField) {
      ctx.fillStyle = "#60a5fa";
      ctx.fillText("E \u22A5 B \u22A5 propagation", panelX + 10, infoY);
    }

    // --- Legend ---
    const legX = width - Math.min(200, width * 0.28);
    const legY = height - 60;
    const legFontSize = Math.max(11, width * 0.014);

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(legX - 8, legY - 14, Math.min(190, width * 0.26), showBField ? 52 : 30, 6);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(legX - 8, legY - 14, Math.min(190, width * 0.26), showBField ? 52 : 30, 6);
    ctx.stroke();

    ctx.font = `${legFontSize}px sans-serif`;
    ctx.textAlign = "left";

    // E field legend line
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legX, legY);
    ctx.lineTo(legX + 20, legY);
    ctx.stroke();
    ctx.fillStyle = "#f87171";
    ctx.fillText("Electric field (E)", legX + 28, legY + 4);

    if (showBField) {
      // B field legend line
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(legX, legY + 22);
      ctx.lineTo(legX + 20, legY + 22);
      ctx.stroke();
      ctx.fillStyle = "#60a5fa";
      ctx.fillText("Magnetic field (B)", legX + 28, legY + 26);
    }

    // --- Equation at bottom ---
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      "E(x,t) = E\u2080 sin(kx \u2212 \u03C9t)    B(x,t) = B\u2080 sin(kx \u2212 \u03C9t)    c = 1/\u221A(\u03BC\u2080\u03B5\u2080)",
      width / 2,
      height - 8,
    );
  }

  function drawArrowhead(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    color: string,
  ): void {
    const size = 8;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    c.lineTo(
      x + Math.cos(angle + 2.5) * size * 0.7,
      y + Math.sin(angle + 2.5) * size * 0.7,
    );
    c.lineTo(
      x + Math.cos(angle - 2.5) * size * 0.7,
      y + Math.sin(angle - 2.5) * size * 0.7,
    );
    c.closePath();
    c.fill();
  }

  function reset(): void {
    time = 0;
    phaseOffset = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const wavelength = currentParams.wavelength ?? 4;
    const amplitude = currentParams.amplitude ?? 1.0;
    const frequency = currentParams.frequency ?? 1.5;
    const showBField = (currentParams.showBField ?? 1) >= 0.5;

    return (
      `Electromagnetic wave simulation: wavelength=${wavelength.toFixed(1)} units, ` +
      `amplitude=${amplitude.toFixed(2)}, visual frequency=${frequency.toFixed(1)} Hz, ` +
      `B field ${showBField ? "visible" : "hidden"}. ` +
      `An electromagnetic wave consists of oscillating electric (E) and magnetic (B) fields ` +
      `perpendicular to each other and to the direction of propagation. ` +
      `E and B are in phase, satisfying Maxwell's equations. ` +
      `The wave travels at the speed of light c = 3\u00D710\u2078 m/s in vacuum, ` +
      `where c = \u03BBf. The fields are related by E = cB. ` +
      `The wave carries energy described by the Poynting vector S = (1/\u03BC\u2080)(E \u00D7 B).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectromagneticWaveFactory;
