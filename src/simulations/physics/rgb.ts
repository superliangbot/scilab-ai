import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * RGB – Additive Color Mixing
 * Three overlapping light circles (Red, Green, Blue) demonstrate additive
 * colour mixing. Where two overlap you see Cyan, Magenta, or Yellow;
 * where all three overlap the result is White. Sliders control each
 * channel's intensity (0-255). Cone-cell sensitivity diagram at top.
 */

const RGBFactory = (): SimulationEngine => {
  const config = getSimConfig("rgb") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let red = 255;
  let green = 255;
  let blue = 255;
  let spread = 50;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>): void {
    red = Math.round(params.red ?? 255);
    green = Math.round(params.green ?? 255);
    blue = Math.round(params.blue ?? 255);
    spread = params.spread ?? 50;
    time += dt;
  }

  /* ---- helpers ---- */
  function drawLightCircle(cx: number, cy: number, radius: number, r: number, g: number, b: number): void {
    // Use 'lighter' composite to achieve additive blending
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.7)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSwatchBar(x: number, y: number, w: number, h: number, label: string, value: number, color: string): void {
    // Background track
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();

    // Filled portion
    const fillW = (value / 255) * w;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, fillW, h, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(11, W * 0.013)}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${label}: ${value}`, x + 6, y + h / 2);
  }

  function drawConeSensitivity(cx: number, y0: number, bw: number, bh: number): void {
    // Mini diagram showing cone cell sensitivity curves
    const left = cx - bw / 2;
    ctx.save();

    // Background
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.beginPath();
    ctx.roundRect(left, y0, bw, bh, 6);
    ctx.fill();

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(left, y0, bw, bh, 6);
    ctx.stroke();

    // Title
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(9, W * 0.011)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Cone Cell Sensitivity", cx, y0 + 14);

    // Draw sensitivity curves
    const gx = left + 10;
    const gw = bw - 20;
    const gy = y0 + 22;
    const gh = bh - 30;

    // Wavelength axis 380-700nm
    const curves = [
      { peak: 440, sigma: 30, color: "rgba(80,120,255," },  // S cone (blue)
      { peak: 530, sigma: 40, color: "rgba(80,220,80," },   // M cone (green)
      { peak: 570, sigma: 45, color: "rgba(255,80,80," },   // L cone (red)
    ];

    for (const curve of curves) {
      ctx.beginPath();
      ctx.strokeStyle = curve.color + "0.9)";
      ctx.lineWidth = 1.5;
      for (let px = 0; px <= gw; px++) {
        const wl = 380 + (px / gw) * 320;
        const val = Math.exp(-0.5 * ((wl - curve.peak) / curve.sigma) ** 2);
        const py = gy + gh - val * gh;
        if (px === 0) ctx.moveTo(gx + px, py);
        else ctx.lineTo(gx + px, py);
      }
      ctx.stroke();

      // Fill under curve
      ctx.fillStyle = curve.color + "0.15)";
      ctx.beginPath();
      for (let px = 0; px <= gw; px++) {
        const wl = 380 + (px / gw) * 320;
        const val = Math.exp(-0.5 * ((wl - curve.peak) / curve.sigma) ** 2);
        const py = gy + gh - val * gh;
        if (px === 0) ctx.moveTo(gx + px, py);
        else ctx.lineTo(gx + px, py);
      }
      ctx.lineTo(gx + gw, gy + gh);
      ctx.lineTo(gx, gy + gh);
      ctx.closePath();
      ctx.fill();
    }

    // Axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(8, W * 0.009)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("380nm", gx, gy + gh + 10);
    ctx.textAlign = "right";
    ctx.fillText("700nm", gx + gw, gy + gh + 10);

    ctx.restore();
  }

  /* ---- main render ---- */
  function render(): void {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    const fs = Math.max(12, W * 0.02);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, W * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Additive Color Mixing (RGB)", W / 2, 28);

    // --- Cone sensitivity diagram (top right) ---
    const sensW = Math.min(220, W * 0.28);
    const sensH = Math.min(100, H * 0.16);
    drawConeSensitivity(W - sensW / 2 - 12, 8, sensW, sensH);

    // --- Three overlapping light circles ---
    const centerX = W * 0.45;
    const centerY = H * 0.46;
    const radius = Math.min(W, H) * 0.22;
    const offset = (spread / 100) * radius * 0.7;

    // Positions arranged in equilateral triangle
    const angle120 = (2 * Math.PI) / 3;
    const topAngle = -Math.PI / 2;
    const rPos = { x: centerX + offset * Math.cos(topAngle), y: centerY + offset * Math.sin(topAngle) };
    const gPos = { x: centerX + offset * Math.cos(topAngle + angle120), y: centerY + offset * Math.sin(topAngle + angle120) };
    const bPos = { x: centerX + offset * Math.cos(topAngle + 2 * angle120), y: centerY + offset * Math.sin(topAngle + 2 * angle120) };

    // Save composite and use additive blending
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    drawLightCircle(rPos.x, rPos.y, radius, red, 0, 0);
    drawLightCircle(gPos.x, gPos.y, radius, 0, green, 0);
    drawLightCircle(bPos.x, bPos.y, radius, 0, 0, blue);

    ctx.restore();

    // Labels on each light
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelDist = radius + 18;

    ctx.fillStyle = `rgb(${red},60,60)`;
    ctx.fillText("R", rPos.x + (rPos.x - centerX) * 0.1, rPos.y - labelDist * 0.3);
    ctx.fillStyle = `rgb(60,${green},60)`;
    ctx.fillText("G", gPos.x - labelDist * 0.35, gPos.y + 8);
    ctx.fillStyle = `rgb(60,60,${blue})`;
    ctx.fillText("B", bPos.x + labelDist * 0.35, bPos.y + 8);

    // Overlap labels
    ctx.font = `${Math.max(10, W * 0.012)}px sans-serif`;
    ctx.fillStyle = "#cbd5e1";

    // R+G = Yellow
    const rgMid = { x: (rPos.x + gPos.x) / 2, y: (rPos.y + gPos.y) / 2 };
    if (red > 30 && green > 30) {
      ctx.fillStyle = `rgb(${Math.min(255, red)},${Math.min(255, green)},0)`;
      ctx.fillText("Yellow", rgMid.x - offset * 0.6, rgMid.y);
    }

    // R+B = Magenta
    const rbMid = { x: (rPos.x + bPos.x) / 2, y: (rPos.y + bPos.y) / 2 };
    if (red > 30 && blue > 30) {
      ctx.fillStyle = `rgb(${Math.min(255, red)},0,${Math.min(255, blue)})`;
      ctx.fillText("Magenta", rbMid.x + offset * 0.6, rbMid.y);
    }

    // G+B = Cyan
    const gbMid = { x: (gPos.x + bPos.x) / 2, y: (gPos.y + bPos.y) / 2 };
    if (green > 30 && blue > 30) {
      ctx.fillStyle = `rgb(0,${Math.min(255, green)},${Math.min(255, blue)})`;
      ctx.fillText("Cyan", gbMid.x, gbMid.y + offset * 0.5);
    }

    // Center = White (all three)
    if (red > 30 && green > 30 && blue > 30) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(11, W * 0.014)}px sans-serif`;
      ctx.fillText("White", centerX, centerY + 2);
    }

    // --- Channel bars (right side) ---
    const barX = W * 0.74;
    const barW = W * 0.22;
    const barH = 22;
    const barGap = 34;
    const barY0 = H * 0.3;

    drawSwatchBar(barX, barY0, barW, barH, "R", red, "#ef4444");
    drawSwatchBar(barX, barY0 + barGap, barW, barH, "G", green, "#22c55e");
    drawSwatchBar(barX, barY0 + 2 * barGap, barW, barH, "B", blue, "#3b82f6");

    // Combined swatch
    const swatchY = barY0 + 3 * barGap + 6;
    const swatchSize = Math.min(barW, 60);
    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.beginPath();
    ctx.roundRect(barX + barW / 2 - swatchSize / 2, swatchY, swatchSize, swatchSize, 8);
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(barX + barW / 2 - swatchSize / 2, swatchY, swatchSize, swatchSize, 8);
    ctx.stroke();

    // Hex value
    const hex = `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`.toUpperCase();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(11, W * 0.014)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(hex, barX + barW / 2, swatchY + swatchSize + 18);

    // --- Info panel (bottom) ---
    const infoY = H - 70;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.beginPath();
    ctx.roundRect(10, infoY, W - 20, 60, 8);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, W * 0.012)}px sans-serif`;
    ctx.textAlign = "left";
    const lx = 20;
    ctx.fillText(`Additive mixing: Red(${red}) + Green(${green}) + Blue(${blue})`, lx, infoY + 18);
    ctx.fillText(`Result: ${hex}  |  R+G = Yellow  |  R+B = Magenta  |  G+B = Cyan  |  R+G+B = White`, lx, infoY + 36);

    // Pulsing glow around combined swatch
    const pulse = 0.5 + 0.5 * Math.sin(time * 2);
    ctx.shadowColor = `rgba(${red},${green},${blue},${0.3 + pulse * 0.3})`;
    ctx.shadowBlur = 15 + pulse * 10;
    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.beginPath();
    ctx.arc(barX + barW / 2, swatchY + swatchSize / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // nothing
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  function getStateDescription(): string {
    const hex = `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`.toUpperCase();
    return (
      `RGB Additive Color Mixing. ` +
      `R=${red}, G=${green}, B=${blue} → ${hex}. ` +
      `Three overlapping light circles demonstrate additive mixing: ` +
      `R+G=Yellow, R+B=Magenta, G+B=Cyan, R+G+B=White. ` +
      `Human cone cells have peak sensitivities near 440nm (S/blue), 530nm (M/green), 570nm (L/red).`
    );
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RGBFactory;
