import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Additive Color Mixing (Light)
 * Three overlapping circles of Red, Green, Blue light demonstrate
 * additive colour mixing: R+G=Yellow, R+B=Magenta, G+B=Cyan, R+G+B=White.
 * Cone cells in the retina respond to these three primaries.
 */

const ColorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("color") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let redIntensity = 255;
  let greenIntensity = 255;
  let blueIntensity = 255;
  let separation = 50;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    redIntensity = Math.round(params.redIntensity ?? 255);
    greenIntensity = Math.round(params.greenIntensity ?? 255);
    blueIntensity = Math.round(params.blueIntensity ?? 255);
    separation = params.separation ?? 50;
    time += dt;
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.48;
    const radius = Math.min(width, height) * 0.22;
    const sep = radius * (separation / 100) * 0.7;

    // Three circle positions (equilateral triangle)
    const circles: { x: number; y: number; r: number; g: number; b: number; label: string }[] = [
      { x: cx, y: cy - sep, r: redIntensity, g: 0, b: 0, label: "Red" },
      { x: cx - sep * 0.866, y: cy + sep * 0.5, r: 0, g: greenIntensity, b: 0, label: "Green" },
      { x: cx + sep * 0.866, y: cy + sep * 0.5, r: 0, g: 0, b: blueIntensity, label: "Blue" },
    ];

    // Use additive blending (lighter composite operation)
    ctx.globalCompositeOperation = "lighter";

    for (const c of circles) {
      const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
      grad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},1)`);
      grad.addColorStop(0.6, `rgba(${c.r},${c.g},${c.b},0.7)`);
      grad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
      ctx.beginPath();
      ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";

    // Labels for each circle
    ctx.save();
    ctx.font = `bold ${Math.max(11, width * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    for (const c of circles) {
      const labelY = c === circles[0] ? c.y - radius * 0.7 : c.y + radius * 0.8;
      ctx.fillStyle = `rgb(${Math.max(c.r, 80)},${Math.max(c.g, 80)},${Math.max(c.b, 80)})`;
      ctx.fillText(c.label, c.x, labelY);
    }
    ctx.restore();

    // Combination labels
    ctx.save();
    ctx.font = `${Math.max(10, width * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.7)";

    // R+G = Yellow
    const rg = { x: (circles[0].x + circles[1].x) / 2, y: (circles[0].y + circles[1].y) / 2 };
    ctx.fillStyle = "#ffff00";
    ctx.fillText("R+G = Yellow", rg.x - sep * 0.5, rg.y);

    // R+B = Magenta
    const rb = { x: (circles[0].x + circles[2].x) / 2, y: (circles[0].y + circles[2].y) / 2 };
    ctx.fillStyle = "#ff00ff";
    ctx.fillText("R+B = Magenta", rb.x + sep * 0.5, rb.y);

    // G+B = Cyan
    const gb = { x: (circles[1].x + circles[2].x) / 2, y: (circles[1].y + circles[2].y) / 2 };
    ctx.fillStyle = "#00ffff";
    ctx.fillText("G+B = Cyan", gb.x, gb.y + sep * 0.3);

    // R+G+B = White (centre)
    ctx.fillStyle = "#fff";
    ctx.fillText("R+G+B = White", cx, cy + 4);
    ctx.restore();

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Additive Color Mixing (Light)", width / 2, 24);
    ctx.font = `${Math.max(10, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160,180,220,0.5)";
    ctx.fillText("Three types of cone cells in the retina respond to R, G, B light", width / 2, 42);
    ctx.restore();

    // Info panel
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, height - 65, 180, 55, 6);
    ctx.fill();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ff6666";
    ctx.fillText(`Red: ${redIntensity}`, 16, height - 48);
    ctx.fillStyle = "#66ff66";
    ctx.fillText(`Green: ${greenIntensity}`, 16, height - 33);
    ctx.fillStyle = "#6666ff";
    ctx.fillText(`Blue: ${blueIntensity}`, 16, height - 18);
    ctx.restore();
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Additive Color Mixing: R=${redIntensity}, G=${greenIntensity}, B=${blueIntensity}. ` +
      `Separation: ${separation}%. ` +
      `Additive mixing: R+G=Yellow, R+B=Magenta, G+B=Cyan, R+G+B=White. ` +
      `This is how screens and the human eye work — three primary colours of light combine to create all visible colours.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ColorFactory;
