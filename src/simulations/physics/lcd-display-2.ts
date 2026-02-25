import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LcdDisplay2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lcd-display-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let magnification = 5;
  let magDiameter = 120;
  let imageIndex = 0;

  // Sample "image" data - grids of colors representing different scenes
  interface ImageData2 {
    name: string;
    width: number;
    height: number;
    pixels: [number, number, number][][]; // RGB rows
  }

  function generateImage(type: number): ImageData2 {
    const w = 16;
    const h = 12;
    const pixels: [number, number, number][][] = [];

    for (let r = 0; r < h; r++) {
      const row: [number, number, number][] = [];
      for (let c = 0; c < w; c++) {
        switch (type) {
          case 0: // Sunset gradient
            row.push([
              Math.min(255, Math.round(200 + 55 * (r / h))),
              Math.round(80 + 120 * (1 - r / h)),
              Math.round(40 + 60 * Math.sin(c / w * Math.PI)),
            ]);
            break;
          case 1: // Blue sky with green ground
            if (r < h * 0.6) {
              row.push([
                Math.round(80 + 40 * (r / h)),
                Math.round(140 + 80 * (1 - r / h)),
                Math.round(200 + 55 * (1 - r / h)),
              ]);
            } else {
              row.push([
                Math.round(30 + 40 * Math.random()),
                Math.round(100 + 80 * Math.random()),
                Math.round(20 + 30 * Math.random()),
              ]);
            }
            break;
          case 2: // Rainbow bands
            {
              const hue = (c / w) * 360;
              const [rr, gg, bb] = hslToRgb(hue, 0.8, 0.5 + 0.2 * Math.sin(r / h * Math.PI));
              row.push([rr, gg, bb]);
            }
            break;
          default: // Checkerboard with color
            {
              const isLight = (r + c) % 2 === 0;
              row.push(isLight ? [220, 200, 180] : [60, 40, 100]);
            }
            break;
        }
      }
      pixels.push(row);
    }
    const names = ["Sunset", "Landscape", "Rainbow", "Pattern"];
    return { name: names[type] || "Image", width: w, height: h, pixels };
  }

  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  let currentImage: ImageData2;
  let magX = 0.5;
  let magY = 0.5;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    currentImage = generateImage(0);
  }

  function update(dt: number, params: Record<string, number>) {
    magnification = params.magnification ?? 5;
    magDiameter = params.magDiameter ?? 120;
    const newIdx = Math.round(params.imageIndex ?? 0);
    if (newIdx !== imageIndex) {
      imageIndex = newIdx;
      currentImage = generateImage(imageIndex);
    }
    time += Math.min(dt, 0.05);

    // Slowly move magnifier
    magX = 0.5 + 0.2 * Math.sin(time * 0.3);
    magY = 0.5 + 0.15 * Math.cos(time * 0.4);
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
    ctx.fillText("LCD Display 2 — Subpixel Magnification", W / 2, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Image: ${currentImage.name} | Magnification: ${magnification}x`, W / 2, 46);

    // Monitor frame
    const monX = 40;
    const monY = 60;
    const monW = W - 80;
    const monH = H - 160;

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(monX, monY, monW, monH, 10);
    ctx.fill();

    // Monitor stand
    ctx.fillStyle = "#334155";
    ctx.fillRect(W / 2 - 40, monY + monH, 80, 15);
    ctx.fillRect(W / 2 - 60, monY + monH + 15, 120, 8);

    // Screen
    const pad = 12;
    const scrX = monX + pad;
    const scrY = monY + pad;
    const scrW = monW - 2 * pad;
    const scrH = monH - 2 * pad;

    // Draw the image at screen level
    const img = currentImage;
    const cellW = scrW / img.width;
    const cellH = scrH / img.height;

    for (let r = 0; r < img.height; r++) {
      for (let c = 0; c < img.width; c++) {
        const [rv, gv, bv] = img.pixels[r][c];
        ctx.fillStyle = `rgb(${rv}, ${gv}, ${bv})`;
        ctx.fillRect(scrX + c * cellW, scrY + r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Magnifier circle position
    const magCenterX = scrX + magX * scrW;
    const magCenterY = scrY + magY * scrH;
    const magR = magDiameter / 2;

    // Determine which pixel is at center of magnifier
    const centerCol = Math.floor(magX * img.width);
    const centerRow = Math.floor(magY * img.height);

    // Draw magnified view
    ctx.save();
    ctx.beginPath();
    ctx.arc(magCenterX, magCenterY, magR, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "#000";
    ctx.fillRect(magCenterX - magR, magCenterY - magR, magR * 2, magR * 2);

    // Each magnified pixel takes more space
    const magPixW = cellW * magnification;
    const magPixH = cellH * magnification;
    const subPixW = magPixW / 3;

    // Center offset
    const offsetX = magCenterX - (centerCol + 0.5) * magPixW;
    const offsetY = magCenterY - (centerRow + 0.5) * magPixH;

    // Draw visible magnified pixels with subpixel detail
    const visibleCols = Math.ceil(magR * 2 / magPixW) + 2;
    const visibleRows = Math.ceil(magR * 2 / magPixH) + 2;
    const startCol = centerCol - Math.ceil(visibleCols / 2);
    const startRow = centerRow - Math.ceil(visibleRows / 2);

    for (let r = startRow; r < startRow + visibleRows; r++) {
      for (let c = startCol; c < startCol + visibleCols; c++) {
        if (r < 0 || r >= img.height || c < 0 || c >= img.width) continue;
        const [rv, gv, bv] = img.pixels[r][c];
        const px = offsetX + c * magPixW;
        const py = offsetY + r * magPixH;

        // Red subpixel
        ctx.fillStyle = `rgb(${rv}, 0, 0)`;
        ctx.fillRect(px + 1, py + 1, subPixW - 2, magPixH - 2);

        // Green subpixel
        ctx.fillStyle = `rgb(0, ${gv}, 0)`;
        ctx.fillRect(px + subPixW + 1, py + 1, subPixW - 2, magPixH - 2);

        // Blue subpixel
        ctx.fillStyle = `rgb(0, 0, ${bv})`;
        ctx.fillRect(px + 2 * subPixW + 1, py + 1, subPixW - 2, magPixH - 2);

        // Pixel grid
        ctx.strokeStyle = "rgba(50, 50, 50, 0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, magPixW, magPixH);
      }
    }
    ctx.restore();

    // Magnifier border with glow
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(magCenterX, magCenterY, magR, 0, Math.PI * 2);
    ctx.stroke();

    // Glow effect
    const glowGrad = ctx.createRadialGradient(
      magCenterX, magCenterY, magR - 2,
      magCenterX, magCenterY, magR + 8
    );
    glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(magCenterX, magCenterY, magR + 8, 0, Math.PI * 2);
    ctx.fill();

    // Crosshair in magnifier
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(magCenterX - magR, magCenterY);
    ctx.lineTo(magCenterX + magR, magCenterY);
    ctx.moveTo(magCenterX, magCenterY - magR);
    ctx.lineTo(magCenterX, magCenterY + magR);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pixel info at center of magnifier
    if (centerRow >= 0 && centerRow < img.height && centerCol >= 0 && centerCol < img.width) {
      const [rv, gv, bv] = img.pixels[centerRow][centerCol];
      ctx.font = "10px monospace";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(
        `Pixel [${centerCol},${centerRow}]: R=${rv} G=${gv} B=${bv}`,
        magCenterX, magCenterY + magR + 18
      );
    }

    // Image selector indicator
    const selY = H - 80;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Image Selection:", W / 2, selY);

    const imgNames = ["Sunset", "Landscape", "Rainbow", "Pattern"];
    for (let i = 0; i < 4; i++) {
      const bx = W / 2 - 120 + i * 65;
      const isActive = i === imageIndex;
      ctx.fillStyle = isActive ? "#3b82f6" : "#334155";
      ctx.beginPath();
      ctx.roundRect(bx, selY + 6, 55, 22, 4);
      ctx.fill();
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = isActive ? "#fff" : "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(imgNames[i], bx + 27, selY + 21);
    }

    // Explanation
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText(
      "When zoomed in, each pixel shows 3 vertical subpixels (R, G, B). From a distance, the eye blends them.",
      W / 2, H - 10
    );
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    return (
      `LCD Display 2: Viewing "${currentImage.name}" image at ${magnification}x magnification. ` +
      `Magnifier diameter: ${magDiameter}px. The magnified view shows individual RGB subpixels ` +
      `(3 vertical bars per pixel). Additive color mixing: the eye's 3 cone cell types blend ` +
      `nearby R, G, B subpixels into perceived full-color images.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LcdDisplay2Factory;
