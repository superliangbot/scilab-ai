import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SuperpositionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("superposition") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let amp1 = 1;
  let freq1 = 1;
  let amp2 = 1;
  let freq2 = 1.5;

  // Wave sampling
  const NUM_POINTS = 500;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function waveY(amplitude: number, frequency: number, x: number, t: number): number {
    const k = (2 * Math.PI * frequency) / 100; // wavenumber scaled
    const omega = 2 * Math.PI * frequency;
    return amplitude * Math.sin(k * x - omega * t);
  }

  function update(dt: number, params: Record<string, number>): void {
    amp1 = params.amplitude1 ?? 1;
    freq1 = params.frequency1 ?? 1;
    amp2 = params.amplitude2 ?? 1;
    freq2 = params.frequency2 ?? 1.5;
    time += dt;
  }

  function drawWave(
    yFunc: (x: number) => number,
    yCenter: number,
    scale: number,
    color: string,
    lineWidth: number = 2
  ): void {
    const margin = width * 0.05;
    const waveWidth = width * 0.9;

    ctx.beginPath();
    for (let i = 0; i <= NUM_POINTS; i++) {
      const xNorm = i / NUM_POINTS;
      const xCanvas = margin + xNorm * waveWidth;
      const xWave = xNorm * waveWidth;
      const y = yCenter - yFunc(xWave) * scale;
      if (i === 0) ctx.moveTo(xCanvas, y);
      else ctx.lineTo(xCanvas, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function drawCenterLine(yCenter: number): void {
    const margin = width * 0.05;
    ctx.beginPath();
    ctx.moveTo(margin, yCenter);
    ctx.lineTo(width - margin, yCenter);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#080c1a");
    bgGrad.addColorStop(1, "#0e1428");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const margin = width * 0.05;
    const maxAmp = Math.max(amp1, amp2, amp1 + amp2, 0.1);
    const sectionH = height / 3;
    const waveScale = sectionH * 0.3 / maxAmp;

    // Section labels and dividers
    const sections = [
      { label: "Wave 1", color: "#4da6ff", yCenter: sectionH * 0.5 },
      { label: "Wave 2", color: "#ff6b9d", yCenter: sectionH * 1.5 },
      { label: "Superposition (y₁ + y₂)", color: "#66ffaa", yCenter: sectionH * 2.5 },
    ];

    // Divider lines
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(margin, sectionH * i);
      ctx.lineTo(width - margin, sectionH * i);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw center lines
    for (const sec of sections) {
      drawCenterLine(sec.yCenter);
    }

    // Draw Wave 1
    drawWave(
      (x) => waveY(amp1, freq1, x, time),
      sections[0].yCenter,
      waveScale,
      sections[0].color,
      2.5
    );

    // Draw Wave 2
    drawWave(
      (x) => waveY(amp2, freq2, x, time),
      sections[1].yCenter,
      waveScale,
      sections[1].color,
      2.5
    );

    // Draw Superposition
    // Also shade constructive/destructive regions
    const waveWidth = width * 0.9;
    const superYCenter = sections[2].yCenter;

    // Fill constructive (green) and destructive (red) regions
    for (let i = 0; i < NUM_POINTS; i++) {
      const xNorm = i / NUM_POINTS;
      const xWave = xNorm * waveWidth;
      const y1 = waveY(amp1, freq1, xWave, time);
      const y2 = waveY(amp2, freq2, xWave, time);
      const ySum = y1 + y2;
      const xCanvas = margin + xNorm * waveWidth;

      // Check if constructive or destructive
      const sameSign = (y1 > 0 && y2 > 0) || (y1 < 0 && y2 < 0);
      const intensity = Math.abs(ySum) / (amp1 + amp2 + 0.001);

      if (sameSign) {
        ctx.fillStyle = `rgba(100, 255, 170, ${intensity * 0.08})`;
      } else {
        ctx.fillStyle = `rgba(255, 100, 100, ${intensity * 0.08})`;
      }

      const barH = Math.abs(ySum) * waveScale;
      ctx.fillRect(xCanvas, superYCenter - barH / 2, waveWidth / NUM_POINTS + 1, barH);
    }

    // Draw ghost traces of individual waves in superposition section
    drawWave(
      (x) => waveY(amp1, freq1, x, time),
      superYCenter,
      waveScale,
      "rgba(77, 166, 255, 0.25)",
      1
    );
    drawWave(
      (x) => waveY(amp2, freq2, x, time),
      superYCenter,
      waveScale,
      "rgba(255, 107, 157, 0.25)",
      1
    );

    // Draw resultant wave
    drawWave(
      (x) => waveY(amp1, freq1, x, time) + waveY(amp2, freq2, x, time),
      superYCenter,
      waveScale,
      sections[2].color,
      3
    );

    // Section labels
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const sec of sections) {
      ctx.fillStyle = sec.color;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(sec.label, margin + 4, sec.yCenter - sectionH * 0.45);
    }

    // Info panel
    const panelW = 220;
    const panelH = 200;
    const panelX = width - margin - panelW;
    const panelY = 12;

    ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 200, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let ty = panelY + 14;
    const lx = panelX + 12;

    ctx.fillStyle = "#8cb4ff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("Superposition Principle", lx, ty);
    ty += 22;

    ctx.fillStyle = "#ffd966";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("y_total = y₁ + y₂", lx, ty);
    ty += 22;

    ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`y₁ = ${amp1.toFixed(1)} sin(${freq1.toFixed(1)}·2πt)`, lx, ty);
    ty += 18;
    ctx.fillText(`y₂ = ${amp2.toFixed(1)} sin(${freq2.toFixed(1)}·2πt)`, lx, ty);
    ty += 22;

    ctx.fillStyle = "#66ffaa";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Max amplitude: ${(amp1 + amp2).toFixed(1)}`, lx, ty);
    ty += 18;

    const beatFreq = Math.abs(freq1 - freq2);
    ctx.fillText(`Beat freq: ${beatFreq.toFixed(2)} Hz`, lx, ty);
    ty += 18;

    // Interference indicator
    const sampleY1 = waveY(amp1, freq1, width * 0.45, time);
    const sampleY2 = waveY(amp2, freq2, width * 0.45, time);
    const sameSign = (sampleY1 > 0 && sampleY2 > 0) || (sampleY1 < 0 && sampleY2 < 0);
    ctx.fillStyle = sameSign ? "#66ffaa" : "#ff6666";
    ctx.fillText(
      `Center: ${sameSign ? "Constructive" : "Destructive"}`,
      lx,
      ty
    );
    ty += 18;

    ctx.fillStyle = "rgba(200, 220, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`f₁/f₂ = ${(freq1 / freq2).toFixed(3)}`, lx, ty);

    // Time
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 14);

    // Legend at bottom
    ctx.textAlign = "center";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(100, 255, 170, 0.6)";
    ctx.fillText("■ Constructive interference", width * 0.35, height - 14);
    ctx.fillStyle = "rgba(255, 100, 100, 0.6)";
    ctx.fillText("■ Destructive interference", width * 0.65, height - 14);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const beatFreq = Math.abs(freq1 - freq2);
    return (
      `Wave Superposition: Wave 1 (A=${amp1.toFixed(1)}, f=${freq1.toFixed(1)} Hz) + ` +
      `Wave 2 (A=${amp2.toFixed(1)}, f=${freq2.toFixed(1)} Hz). ` +
      `Max combined amplitude = ${(amp1 + amp2).toFixed(1)}. ` +
      `Beat frequency = ${beatFreq.toFixed(2)} Hz. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SuperpositionFactory;
