import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ThreePrimaryColorsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("three-primary-colors") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let red = 255;
  let green = 255;
  let blue = 255;
  let mode = 0; // 0 = additive, 1 = subtractive

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    red = params.red ?? 255;
    green = params.green ?? 255;
    blue = params.blue ?? 255;
    mode = params.mode ?? 0;
    time += dt;
  }

  function toHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
  }

  function drawAdditiveCircles(cx: number, cy: number, radius: number): void {
    const offY = radius * 0.35;
    const offX = radius * 0.3;

    // Positions for R, G, B circles
    const circles = [
      { x: cx, y: cy - offY, r: red, g: 0, b: 0, label: "Red" },
      { x: cx - offX, y: cy + offY * 0.7, r: 0, g: green, b: 0, label: "Green" },
      { x: cx + offX, y: cy + offY * 0.7, r: 0, g: 0, b: blue, label: "Blue" },
    ];

    // Use globalCompositeOperation for additive blending
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const c of circles) {
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},1)`);
      grad.addColorStop(0.7, `rgba(${c.r},${c.g},${c.b},0.8)`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Labels
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const c of circles) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      const ly = c.y < cy ? c.y - radius - 10 : c.y + radius + 15;
      ctx.fillText(c.label, c.x, ly);
    }

    // Mixed color labels
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    // R+G = Yellow
    ctx.fillText("R+G=Yellow", cx - offX * 0.5, cy - offY * 0.6);
    // R+B = Magenta
    ctx.fillText("R+B=Magenta", cx + offX * 1.4, cy + offY * 0.1);
    // G+B = Cyan
    ctx.fillText("G+B=Cyan", cx - offX * 1.4, cy + offY * 0.1);
    // Center = White
    ctx.fillText("R+G+B=White", cx, cy + 5);
  }

  function drawSubtractiveCircles(cx: number, cy: number, radius: number): void {
    const offY = radius * 0.35;
    const offX = radius * 0.3;

    // CMY from RGB: C = 255 - R, M = 255 - G, Y = 255 - B
    const c = 255 - red;
    const m = 255 - green;
    const y = 255 - blue;

    const circles = [
      { x: cx, y: cy - offY, color: `rgb(0,${255 - c},${255 - c})`, label: `Cyan (${c})` },
      { x: cx - offX, y: cy + offY * 0.7, color: `rgb(${255 - m},0,${255 - m})`, label: `Magenta (${m})` },
      { x: cx + offX, y: cy + offY * 0.7, color: `rgb(${255 - y},${255 - y},0)`, label: `Yellow (${y})` },
    ];

    // Subtractive: draw with multiply-like effect
    ctx.save();

    // White background for subtractive
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.globalCompositeOperation = "multiply";

    const cyanCol = [0, 255 - c, 255 - c];
    const magCol = [255 - m, 0, 255 - m];
    const yelCol = [255 - y, 255 - y, 0];
    const colors = [cyanCol, magCol, yelCol];

    for (let i = 0; i < circles.length; i++) {
      const ci = circles[i];
      const col = colors[i];
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.beginPath();
      ctx.arc(ci.x, ci.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Labels
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const ci of circles) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const ly = ci.y < cy ? ci.y - radius - 10 : ci.y + radius + 15;
      ctx.fillText(ci.label, ci.x, ly);
    }

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("C+M=Blue", cx - offX * 0.5, cy - offY * 0.6);
    ctx.fillText("M+Y=Red", cx + offX * 1.4, cy + offY * 0.1);
    ctx.fillText("C+Y=Green", cx - offX * 1.4, cy + offY * 0.1);
    ctx.fillText("C+M+Y=Black", cx, cy + 5);
  }

  function drawColorSpectrum(): void {
    const barX = width * 0.06;
    const barY = height - 50;
    const barW = width * 0.88;
    const barH = 18;

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.roundRect(barX - 5, barY - 20, barW + 10, barH + 35, 6);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Visible Light Spectrum (380nm - 780nm)", barX + barW / 2, barY - 6);

    // Draw spectrum
    for (let i = 0; i < barW; i++) {
      const wavelength = 380 + (i / barW) * 400;
      let r = 0, g = 0, b = 0;
      if (wavelength < 440) {
        r = -(wavelength - 440) / (440 - 380);
        b = 1;
      } else if (wavelength < 490) {
        g = (wavelength - 440) / (490 - 440);
        b = 1;
      } else if (wavelength < 510) {
        g = 1;
        b = -(wavelength - 510) / (510 - 490);
      } else if (wavelength < 580) {
        r = (wavelength - 510) / (580 - 510);
        g = 1;
      } else if (wavelength < 645) {
        r = 1;
        g = -(wavelength - 645) / (645 - 580);
      } else {
        r = 1;
      }
      // Intensity dropoff at edges
      let factor = 1;
      if (wavelength < 420) factor = 0.3 + 0.7 * (wavelength - 380) / 40;
      else if (wavelength > 700) factor = 0.3 + 0.7 * (780 - wavelength) / 80;
      ctx.fillStyle = `rgb(${Math.round(r * factor * 255)},${Math.round(g * factor * 255)},${Math.round(b * factor * 255)})`;
      ctx.fillRect(barX + i, barY, 1, barH);
    }

    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#1a1a2e");
    bgGrad.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Three Primary Colors", width / 2, 24);

    const modeLabel = mode === 0 ? "Additive (Light) Mixing" : "Subtractive (Pigment) Mixing";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(modeLabel, width / 2, 42);

    // Draw overlapping circles
    const circleRadius = Math.min(width, height) * 0.18;
    const circleCX = width * 0.35;
    const circleCY = height * 0.42;

    if (mode === 0) {
      drawAdditiveCircles(circleCX, circleCY, circleRadius);
    } else {
      drawSubtractiveCircles(circleCX, circleCY, circleRadius);
    }

    // === Info Panel (right side) ===
    const panelX = width * 0.62;
    const panelY = 55;
    const panelW = width * 0.35;
    const panelH = height * 0.55;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    let ty = panelY + 22;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Color Values", panelX + 12, ty); ty += 24;

    // RGB values
    ctx.font = "12px monospace";
    ctx.fillStyle = "#f87171";
    ctx.fillText(`Red:   ${Math.round(red)}`, panelX + 12, ty); ty += 18;
    ctx.fillStyle = "#4ade80";
    ctx.fillText(`Green: ${Math.round(green)}`, panelX + 12, ty); ty += 18;
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`Blue:  ${Math.round(blue)}`, panelX + 12, ty); ty += 24;

    // Combined color
    const hexColor = toHex(red, green, blue);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Hex: ${hexColor}`, panelX + 12, ty); ty += 18;
    ctx.fillText(`RGB(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`, panelX + 12, ty); ty += 24;

    // Color preview swatch
    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.beginPath();
    ctx.roundRect(panelX + 12, ty, panelW - 24, 30, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ty += 44;

    // Formulas
    ctx.fillStyle = "#a5b4fc";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(mode === 0 ? "Additive Mixing:" : "Subtractive Mixing:", panelX + 12, ty); ty += 20;

    ctx.font = "11px monospace";
    ctx.fillStyle = "#94a3b8";
    if (mode === 0) {
      ctx.fillText("R + G = Yellow", panelX + 12, ty); ty += 16;
      ctx.fillText("R + B = Magenta", panelX + 12, ty); ty += 16;
      ctx.fillText("G + B = Cyan", panelX + 12, ty); ty += 16;
      ctx.fillText("R + G + B = White", panelX + 12, ty); ty += 16;
    } else {
      ctx.fillText("C + M = Blue", panelX + 12, ty); ty += 16;
      ctx.fillText("C + Y = Green", panelX + 12, ty); ty += 16;
      ctx.fillText("M + Y = Red", panelX + 12, ty); ty += 16;
      ctx.fillText("C + M + Y = Black", panelX + 12, ty); ty += 16;
    }

    // Intensity bars
    ty += 8;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Channel Intensity:", panelX + 12, ty); ty += 16;

    const barW = panelW - 40;
    const barH = 10;
    // Red bar
    ctx.fillStyle = "rgba(248,113,113,0.3)";
    ctx.fillRect(panelX + 12, ty, barW, barH);
    ctx.fillStyle = "#f87171";
    ctx.fillRect(panelX + 12, ty, barW * (red / 255), barH);
    ty += 16;
    // Green bar
    ctx.fillStyle = "rgba(74,222,128,0.3)";
    ctx.fillRect(panelX + 12, ty, barW, barH);
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(panelX + 12, ty, barW * (green / 255), barH);
    ty += 16;
    // Blue bar
    ctx.fillStyle = "rgba(96,165,250,0.3)";
    ctx.fillRect(panelX + 12, ty, barW, barH);
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(panelX + 12, ty, barW * (blue / 255), barH);

    // Spectrum bar at bottom
    drawColorSpectrum();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const modeStr = mode === 0 ? "additive (light)" : "subtractive (pigment)";
    const hexColor = toHex(red, green, blue);
    return (
      `Three Primary Colors: Mode=${modeStr}. R=${Math.round(red)}, G=${Math.round(green)}, B=${Math.round(blue)}. ` +
      `Hex=${hexColor}. ` +
      `Additive mixing combines light: R+G=Yellow, R+B=Magenta, G+B=Cyan, R+G+B=White. ` +
      `Subtractive mixing uses pigments: C+M=Blue, C+Y=Green, M+Y=Red, C+M+Y=Black.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ThreePrimaryColorsFactory;
