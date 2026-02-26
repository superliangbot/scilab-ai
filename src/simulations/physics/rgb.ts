import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * RGB Additive Color Mixing
 * Simulates additive RGB color mixing with three overlapping colored circles.
 * Uses globalCompositeOperation = "lighter" for true additive blending.
 * R+G = Yellow, R+B = Magenta, G+B = Cyan, R+G+B = White.
 */

const RGBFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rgb") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let red = 255;
  let green = 255;
  let blue = 255;
  let circleSize = 120;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    red = Math.round(Math.min(255, Math.max(0, params.red ?? 255)));
    green = Math.round(Math.min(255, Math.max(0, params.green ?? 255)));
    blue = Math.round(Math.min(255, Math.max(0, params.blue ?? 255)));
    circleSize = Math.min(200, Math.max(50, params.circleSize ?? 120));
    time += dt;
  }

  function toHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
    return (
      "#" +
      clamp(r).toString(16).padStart(2, "0") +
      clamp(g).toString(16).padStart(2, "0") +
      clamp(b).toString(16).padStart(2, "0")
    );
  }

  function drawChannelBar(
    x: number,
    y: number,
    barW: number,
    barH: number,
    value: number,
    color: string,
    label: string
  ): void {
    // Background track
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.fill();

    // Filled portion
    const fillW = (value / 255) * barW;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, fillW, barH, 4);
    ctx.fill();

    // Label
    ctx.save();
    ctx.font = `bold ${Math.max(11, barH * 0.65)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`${label}: ${value}`, x + 6, y + barH / 2);
    ctx.restore();
  }

  function render(): void {
    // Dark background for additive mixing visibility
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(14, width * 0.028)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("RGB Additive Color Mixing", width / 2, 10);
    ctx.restore();

    // Circle layout
    const cx = width / 2;
    const cy = height * 0.42;
    const radius = Math.min(circleSize, Math.min(width, height) * 0.25);
    const sep = radius * 0.55;

    // Three circle positions (equilateral triangle)
    const positions = [
      { x: cx, y: cy - sep, r: red, g: 0, b: 0, label: "Red" },
      { x: cx - sep * 0.866, y: cy + sep * 0.5, r: 0, g: green, b: 0, label: "Green" },
      { x: cx + sep * 0.866, y: cy + sep * 0.5, r: 0, g: 0, b: blue, label: "Blue" },
    ];

    // Draw overlapping circles with additive blending
    ctx.globalCompositeOperation = "lighter";

    for (const circle of positions) {
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${circle.r},${circle.g},${circle.b})`;
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";

    // Overlap labels
    ctx.save();
    ctx.font = `bold ${Math.max(10, width * 0.017)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // R+G overlap (Yellow)
    const rgX = (positions[0].x + positions[1].x) / 2;
    const rgY = (positions[0].y + positions[1].y) / 2;
    ctx.fillStyle = "#ffff00";
    ctx.fillText("Yellow", rgX - sep * 0.45, rgY);

    // R+B overlap (Magenta)
    const rbX = (positions[0].x + positions[2].x) / 2;
    const rbY = (positions[0].y + positions[2].y) / 2;
    ctx.fillStyle = "#ff00ff";
    ctx.fillText("Magenta", rbX + sep * 0.45, rbY);

    // G+B overlap (Cyan)
    const gbX = (positions[1].x + positions[2].x) / 2;
    const gbY = (positions[1].y + positions[2].y) / 2;
    ctx.fillStyle = "#00ffff";
    ctx.fillText("Cyan", gbX, gbY + sep * 0.4);

    // Center (White)
    ctx.fillStyle = "#ffffff";
    ctx.fillText("White", cx, cy + 2);

    ctx.restore();

    // Labels for each primary circle
    ctx.save();
    ctx.font = `bold ${Math.max(11, width * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    for (const c of positions) {
      const offY = c === positions[0] ? c.y - radius - 10 : c.y + radius + 14;
      ctx.fillStyle = `rgb(${Math.max(c.r, 100)},${Math.max(c.g, 100)},${Math.max(c.b, 100)})`;
      ctx.fillText(c.label, c.x, offY);
    }
    ctx.restore();

    // Channel bars at the bottom
    const barMargin = 16;
    const barH = Math.max(18, height * 0.035);
    const barW = width - barMargin * 2;
    const barStartY = height - barH * 3 - barMargin * 2 - 55;

    drawChannelBar(barMargin, barStartY, barW, barH, red, "rgba(220,50,50,0.8)", "R");
    drawChannelBar(barMargin, barStartY + barH + 4, barW, barH, green, "rgba(50,180,50,0.8)", "G");
    drawChannelBar(barMargin, barStartY + barH * 2 + 8, barW, barH, blue, "rgba(60,60,220,0.8)", "B");

    // Combined color swatch and hex code
    const swatchY = barStartY + barH * 3 + 16;
    const swatchH = Math.max(28, height * 0.045);
    const combinedHex = toHex(red, green, blue);

    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.beginPath();
    ctx.roundRect(barMargin, swatchY, barW * 0.4, swatchH, 6);
    ctx.fill();

    // Border for the swatch
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(barMargin, swatchY, barW * 0.4, swatchH, 6);
    ctx.stroke();

    // Hex code text
    ctx.save();
    ctx.font = `bold ${Math.max(13, height * 0.025)}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(
      `${combinedHex.toUpperCase()}  |  RGB(${red}, ${green}, ${blue})`,
      barMargin + barW * 0.4 + 12,
      swatchY + swatchH / 2
    );
    ctx.restore();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const hex = toHex(red, green, blue);
    return (
      `RGB Additive Color Mixing: R=${red}, G=${green}, B=${blue} (${hex.toUpperCase()}). ` +
      `Circle radius: ${circleSize}px. ` +
      `Additive mixing of light: R+G=Yellow, R+B=Magenta, G+B=Cyan, R+G+B=White. ` +
      `This is how computer screens and projectors create colors by combining red, green, and blue light.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RGBFactory;
