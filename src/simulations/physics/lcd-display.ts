import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LcdDisplayFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lcd-display") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let redVal = 255;
  let greenVal = 128;
  let blueVal = 64;
  let zoomLevel = 1;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>) {
    redVal = Math.round(params.red ?? 255);
    greenVal = Math.round(params.green ?? 128);
    blueVal = Math.round(params.blue ?? 64);
    zoomLevel = params.zoom ?? 1;
    time += Math.min(dt, 0.05);
  }

  function render() {
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("LCD Display — RGB Subpixels", W / 2, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("LCD screens create colors by mixing Red, Green, and Blue subpixels at varying intensities", W / 2, 46);

    // Color preview (large swatch)
    const swatchX = W / 2 - 80;
    const swatchY = 58;
    const swatchW = 160;
    const swatchH = 60;

    const mixedColor = `rgb(${redVal}, ${greenVal}, ${blueVal})`;
    ctx.fillStyle = mixedColor;
    ctx.fillRect(swatchX, swatchY, swatchW, swatchH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(swatchX, swatchY, swatchW, swatchH);

    // Color text
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = (redVal + greenVal + blueVal) > 384 ? "#000" : "#fff";
    ctx.textAlign = "center";
    ctx.fillText(`R:${redVal} G:${greenVal} B:${blueVal}`, swatchX + swatchW / 2, swatchY + swatchH / 2 + 4);

    // Hex value
    const hex = "#" + [redVal, greenVal, blueVal].map(v => v.toString(16).padStart(2, "0")).join("");
    ctx.font = "10px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(hex.toUpperCase(), swatchX + swatchW / 2, swatchY + swatchH + 14);

    // Monitor frame
    const monX = 30;
    const monY = 140;
    const monW = W - 60;
    const monH = H - 200;

    // Monitor bezel
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 12);
    ctx.fill();

    // Screen area
    const screenPad = 15;
    const scrX = monX + screenPad;
    const scrY = monY + screenPad;
    const scrW = monW - 2 * screenPad;
    const scrH = monH - 2 * screenPad;

    // Fill screen with the mixed color at macro level
    ctx.fillStyle = mixedColor;
    ctx.fillRect(scrX, scrY, scrW, scrH);

    // Draw pixel grid based on zoom level
    const pixelSize = 3 + zoomLevel * 8;
    const subPixelW = pixelSize / 3;

    // Calculate how many pixels fit
    const cols = Math.floor(scrW / pixelSize);
    const rows = Math.floor(scrH / pixelSize);

    // Only show pixel structure at higher zoom
    if (zoomLevel > 1) {
      const alpha = Math.min((zoomLevel - 1) / 3, 1);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = scrX + col * pixelSize;
          const py = scrY + row * pixelSize;

          // Sub-pixel R
          ctx.fillStyle = `rgba(${redVal}, 0, 0, ${0.3 + 0.7 * alpha})`;
          ctx.fillRect(px, py, subPixelW - 0.5, pixelSize - 1);

          // Sub-pixel G
          ctx.fillStyle = `rgba(0, ${greenVal}, 0, ${0.3 + 0.7 * alpha})`;
          ctx.fillRect(px + subPixelW, py, subPixelW - 0.5, pixelSize - 1);

          // Sub-pixel B
          ctx.fillStyle = `rgba(0, 0, ${blueVal}, ${0.3 + 0.7 * alpha})`;
          ctx.fillRect(px + 2 * subPixelW, py, subPixelW - 0.5, pixelSize - 1);

          // Pixel border
          if (zoomLevel > 3) {
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.4})`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px, py, pixelSize, pixelSize);
          }
        }
      }

      // Scan lines
      if (zoomLevel > 2) {
        for (let row = 0; row < rows; row++) {
          const py = scrY + row * pixelSize + pixelSize - 0.5;
          ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.2})`;
          ctx.fillRect(scrX, py, scrW, 1);
        }
      }
    }

    // Magnifying glass view (zoomed inset)
    const magR = 80;
    const magX = W - 130;
    const magY = monY + 40 + magR;

    ctx.save();
    ctx.beginPath();
    ctx.arc(magX, magY, magR, 0, Math.PI * 2);
    ctx.clip();

    // Draw zoomed subpixels inside magnifier
    ctx.fillStyle = "#000";
    ctx.fillRect(magX - magR, magY - magR, magR * 2, magR * 2);

    const magPixSize = 30;
    const magSubW = magPixSize / 3;
    const magCols = Math.ceil(magR * 2 / magPixSize) + 1;
    const magRows = Math.ceil(magR * 2 / magPixSize) + 1;

    for (let r = 0; r < magRows; r++) {
      for (let c = 0; c < magCols; c++) {
        const px = magX - magR + c * magPixSize;
        const py = magY - magR + r * magPixSize;

        ctx.fillStyle = `rgb(${redVal}, 0, 0)`;
        ctx.fillRect(px, py, magSubW - 1, magPixSize - 2);

        ctx.fillStyle = `rgb(0, ${greenVal}, 0)`;
        ctx.fillRect(px + magSubW, py, magSubW - 1, magPixSize - 2);

        ctx.fillStyle = `rgb(0, 0, ${blueVal})`;
        ctx.fillRect(px + 2 * magSubW, py, magSubW - 1, magPixSize - 2);
      }
    }

    ctx.restore();

    // Magnifier border
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(magX, magY, magR, 0, Math.PI * 2);
    ctx.stroke();

    // Handle
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(magX + magR * 0.7, magY + magR * 0.7);
    ctx.lineTo(magX + magR * 1.1, magY + magR * 1.1);
    ctx.stroke();

    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Magnified view", magX, magY + magR + 18);

    // RGB channel bars at bottom
    const barY2 = H - 50;
    const barH2 = 20;
    const barW2 = (W - 120) / 3;

    // R bar
    ctx.fillStyle = `rgb(${redVal}, 0, 0)`;
    ctx.fillRect(30, barY2, barW2 * (redVal / 255), barH2);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    ctx.strokeRect(30, barY2, barW2, barH2);
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "center";
    ctx.fillText(`Red: ${redVal}`, 30 + barW2 / 2, barY2 - 4);

    // G bar
    ctx.fillStyle = `rgb(0, ${greenVal}, 0)`;
    ctx.fillRect(40 + barW2, barY2, barW2 * (greenVal / 255), barH2);
    ctx.strokeStyle = "#22c55e";
    ctx.strokeRect(40 + barW2, barY2, barW2, barH2);
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`Green: ${greenVal}`, 40 + barW2 + barW2 / 2, barY2 - 4);

    // B bar
    ctx.fillStyle = `rgb(0, 0, ${blueVal})`;
    ctx.fillRect(50 + 2 * barW2, barY2, barW2 * (blueVal / 255), barH2);
    ctx.strokeStyle = "#3b82f6";
    ctx.strokeRect(50 + 2 * barW2, barY2, barW2, barH2);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`Blue: ${blueVal}`, 50 + 2 * barW2 + barW2 / 2, barY2 - 4);

    // Explanation
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Each pixel contains 3 subpixels (R, G, B). The eye blends them into a single perceived color.", W / 2, H - 5);
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    const hex = "#" + [redVal, greenVal, blueVal].map(v => v.toString(16).padStart(2, "0")).join("");
    return (
      `LCD Display: RGB values R=${redVal}, G=${greenVal}, B=${blueVal} (${hex}). ` +
      `Zoom: ${zoomLevel}x. Each LCD pixel has 3 subpixels (R, G, B) that combine via ` +
      `additive color mixing. The human eye has 3 types of cone cells (red, green, blue) ` +
      `that perceive the blended color.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LcdDisplayFactory;
