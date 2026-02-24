import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * CMYK Decomposer
 * Decomposes an RGB colour into its CMYK printing components and displays
 * four quadrants (Cyan, Magenta, Yellow, Key/Black) alongside the original.
 * Uses the standard conversion:
 *   K = 1 − max(R',G',B')
 *   C = (1−R'−K)/(1−K)   M = (1−G'−K)/(1−K)   Y = (1−B'−K)/(1−K)
 */

const CMYKDecomposerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cmyk-decomposer") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Params
  let red = 200;
  let green = 100;
  let blue = 50;
  let showValues = 1;

  // Derived CMYK
  let C = 0;
  let M = 0;
  let Y = 0;
  let K = 0;

  function rgbToCmyk(r: number, g: number, b: number) {
    const rp = r / 255;
    const gp = g / 255;
    const bp = b / 255;
    const k = 1 - Math.max(rp, gp, bp);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
    return {
      c: (1 - rp - k) / (1 - k),
      m: (1 - gp - k) / (1 - k),
      y: (1 - bp - k) / (1 - k),
      k,
    };
  }

  function update(dt: number, params: Record<string, number>): void {
    red = Math.round(params.red ?? 200);
    green = Math.round(params.green ?? 100);
    blue = Math.round(params.blue ?? 50);
    showValues = params.showValues ?? 1;
    const cmyk = rgbToCmyk(red, green, blue);
    C = cmyk.c;
    M = cmyk.m;
    Y = cmyk.y;
    K = cmyk.k;
    time += dt;
  }

  function drawQuadrant(
    x: number, y: number, w: number, h: number,
    label: string, value: number, fillR: number, fillG: number, fillB: number
  ) {
    // Background of the channel colour
    ctx.fillStyle = `rgb(${fillR},${fillG},${fillB})`;
    ctx.fillRect(x, y, w, h);

    // Label
    ctx.save();
    ctx.font = `bold ${Math.max(14, w * 0.08)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const lum = 0.299 * fillR + 0.587 * fillG + 0.114 * fillB;
    ctx.fillStyle = lum > 128 ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)";
    ctx.fillText(label, x + w / 2, y + 8);

    if (showValues >= 1) {
      ctx.font = `${Math.max(12, w * 0.06)}px system-ui, sans-serif`;
      ctx.fillText(`${(value * 100).toFixed(1)}%`, x + w / 2, y + 8 + w * 0.1);
    }
    ctx.restore();
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const margin = 10;
    const topH = height * 0.32;
    const bottomH = height - topH - margin * 3;

    // ── Original colour swatch (top center) ──
    const swatchW = width - margin * 2;
    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.beginPath();
    ctx.roundRect(margin, margin, swatchW, topH, 8);
    ctx.fill();

    // Original colour label
    ctx.save();
    const lum = 0.299 * red + 0.587 * green + 0.114 * blue;
    ctx.fillStyle = lum > 128 ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
    ctx.font = `bold ${Math.max(14, width * 0.03)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`RGB(${red}, ${green}, ${blue})`, width / 2, margin + topH / 2 - 12);
    ctx.font = `${Math.max(11, width * 0.022)}px system-ui, sans-serif`;
    ctx.fillText("Original Colour", width / 2, margin + topH / 2 + 12);
    ctx.restore();

    // ── Four CMYK quadrants (bottom) ──
    const qW = (width - margin * 3) / 2;
    const qH = (bottomH - margin) / 2;
    const baseY = topH + margin * 2;

    // Cyan channel: white paper tinted with cyan ink amount
    const cR = Math.round(255 * (1 - C));
    const cG = 255;
    const cB = 255;
    drawQuadrant(margin, baseY, qW, qH, "Cyan (C)", C, cR, cG, cB);

    // Magenta channel
    const mR = 255;
    const mG = Math.round(255 * (1 - M));
    const mB = 255;
    drawQuadrant(margin * 2 + qW, baseY, qW, qH, "Magenta (M)", M, mR, mG, mB);

    // Yellow channel
    const yR = 255;
    const yG = 255;
    const yB = Math.round(255 * (1 - Y));
    drawQuadrant(margin, baseY + qH + margin, qW, qH, "Yellow (Y)", Y, yR, yG, yB);

    // Key (Black) channel
    const kV = Math.round(255 * (1 - K));
    drawQuadrant(margin * 2 + qW, baseY + qH + margin, qW, qH, "Key / Black (K)", K, kV, kV, kV);

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("CMYK Decomposer", width / 2, height - 6);
    ctx.restore();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `CMYK Decomposer: RGB(${red},${green},${blue}) → ` +
      `C=${(C * 100).toFixed(1)}% M=${(M * 100).toFixed(1)}% ` +
      `Y=${(Y * 100).toFixed(1)}% K=${(K * 100).toFixed(1)}%. ` +
      `CMYK is a subtractive colour model used in printing. K = 1 − max(R',G',B').`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CMYKDecomposerFactory;
