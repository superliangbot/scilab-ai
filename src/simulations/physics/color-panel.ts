import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Color Panel
 * Displays solid colour backgrounds for science experiments.
 * Eight fundamental colours: R, Y, G, C, B, M, Black, White.
 * Auto-cycle mode changes colour every few seconds.
 */

const COLORS: { name: string; hex: string; wavelength: string }[] = [
  { name: "Red", hex: "#FF0000", wavelength: "~620-750 nm" },
  { name: "Yellow", hex: "#FFFF00", wavelength: "~570-590 nm" },
  { name: "Green", hex: "#00FF00", wavelength: "~495-570 nm" },
  { name: "Cyan", hex: "#00FFFF", wavelength: "~490-520 nm" },
  { name: "Blue", hex: "#0000FF", wavelength: "~450-495 nm" },
  { name: "Magenta", hex: "#FF00FF", wavelength: "(non-spectral)" },
  { name: "Black", hex: "#000000", wavelength: "No light" },
  { name: "White", hex: "#FFFFFF", wavelength: "All wavelengths" },
];

const ColorPanelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("color-panel") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let colorIndex = 0;
  let autoCycle = 0;
  let cycleSpeed = 3;
  let showInfo = 1;

  let lastSwitch = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    lastSwitch = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    colorIndex = Math.round(params.colorIndex ?? 0) % COLORS.length;
    autoCycle = params.autoCycle ?? 0;
    cycleSpeed = params.cycleSpeed ?? 3;
    showInfo = params.showInfo ?? 1;

    if (autoCycle >= 1) {
      if (time - lastSwitch > cycleSpeed) {
        colorIndex = (colorIndex + 1) % COLORS.length;
        lastSwitch = time;
      }
    }

    time += dt;
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function render(): void {
    const color = COLORS[colorIndex] || COLORS[0];
    ctx.fillStyle = color.hex;
    ctx.fillRect(0, 0, width, height);

    if (showInfo >= 1) {
      const rgb = hexToRgb(color.hex);
      const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
      const textColor = lum > 128 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
      const subtextColor = lum > 128 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";

      ctx.save();
      ctx.font = `bold ${Math.max(20, width * 0.06)}px system-ui, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(color.name, width / 2, height / 2 - 30);

      ctx.font = `${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
      ctx.fillStyle = subtextColor;
      ctx.fillText(color.hex, width / 2, height / 2 + 10);
      ctx.fillText(`RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`, width / 2, height / 2 + 35);
      ctx.fillText(color.wavelength, width / 2, height / 2 + 58);

      // Color swatches at bottom
      const swatchSize = Math.min(width / 10, 40);
      const totalW = COLORS.length * (swatchSize + 4);
      const startX = (width - totalW) / 2;
      const swatchY = height - swatchSize - 15;

      for (let i = 0; i < COLORS.length; i++) {
        const sx = startX + i * (swatchSize + 4);
        ctx.fillStyle = COLORS[i].hex;
        ctx.fillRect(sx, swatchY, swatchSize, swatchSize);
        ctx.strokeStyle = i === colorIndex ? textColor : (lum > 128 ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)");
        ctx.lineWidth = i === colorIndex ? 3 : 1;
        ctx.strokeRect(sx, swatchY, swatchSize, swatchSize);
      }

      // Auto-cycle indicator
      if (autoCycle >= 1) {
        ctx.font = `${Math.max(10, width * 0.018)}px system-ui, sans-serif`;
        ctx.fillStyle = subtextColor;
        ctx.textAlign = "center";
        ctx.fillText(`Auto-cycling every ${cycleSpeed}s`, width / 2, swatchY - 8);
      }

      ctx.restore();
    }
  }

  function reset(): void { time = 0; lastSwitch = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const color = COLORS[colorIndex] || COLORS[0];
    return (
      `Color Panel: displaying ${color.name} (${color.hex}). ` +
      `Wavelength: ${color.wavelength}. Auto-cycle: ${autoCycle >= 1 ? "on" : "off"}. ` +
      `This tool provides pure colour backgrounds for optics experiments and colour perception studies.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ColorPanelFactory;
