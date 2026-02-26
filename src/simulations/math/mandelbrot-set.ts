import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MandelbrotSetFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("mandelbrot-set") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let maxIterations = 100;
  let colorScheme = 0;
  let zoomLevel = 1;
  let centerXOffset = 0;

  // Rendering state
  let offCanvas: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;
  let renderPass = 0;
  const MAX_RENDER_PASSES = 4; // 1/8, 1/4, 1/2, full resolution
  let needsRecompute = true;
  let lastParamKey = "";
  let fullResImageData: ImageData | null = null;

  // View parameters (complex plane coordinates)
  const BASE_CENTER_X = -0.5;
  const BASE_CENTER_Y = 0;
  const BASE_RANGE = 3.5;

  // Pre-built color palette
  let paletteR: Uint8Array | null = null;
  let paletteG: Uint8Array | null = null;
  let paletteB: Uint8Array | null = null;
  let paletteCacheKey = "";

  function buildPalette(scheme: number, maxIter: number): void {
    const key = `${scheme}-${maxIter}`;
    if (key === paletteCacheKey) return;
    paletteCacheKey = key;

    paletteR = new Uint8Array(maxIter + 1);
    paletteG = new Uint8Array(maxIter + 1);
    paletteB = new Uint8Array(maxIter + 1);

    for (let i = 0; i <= maxIter; i++) {
      if (i === maxIter) {
        // Inside the set: black
        paletteR[i] = 0;
        paletteG[i] = 0;
        paletteB[i] = 0;
        continue;
      }

      const t = i / maxIter;
      let r: number, g: number, b: number;

      switch (scheme) {
        case 0: // Classic blue-gold
          if (t < 0.5) {
            const s = t * 2;
            r = Math.floor(s * 200);
            g = Math.floor(s * 170 + 30);
            b = Math.floor(255 - s * 100);
          } else {
            const s = (t - 0.5) * 2;
            r = Math.floor(200 + s * 55);
            g = Math.floor(200 - s * 150);
            b = Math.floor(155 - s * 155);
          }
          break;

        case 1: // Fire
          r = Math.min(255, Math.floor(t * 3 * 255));
          g = Math.min(255, Math.floor(Math.max(0, t * 3 - 1) * 255));
          b = Math.min(255, Math.floor(Math.max(0, t * 3 - 2) * 255));
          break;

        case 2: // Ocean
          r = Math.floor(t * 50);
          g = Math.floor(t * 150 + 50);
          b = Math.floor(150 + t * 105);
          break;

        case 3: // Rainbow (HSL-based)
          {
            const hue = t * 360;
            const c = 1;
            const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
            let r1 = 0, g1 = 0, b1 = 0;
            if (hue < 60) { r1 = c; g1 = x; }
            else if (hue < 120) { r1 = x; g1 = c; }
            else if (hue < 180) { g1 = c; b1 = x; }
            else if (hue < 240) { g1 = x; b1 = c; }
            else if (hue < 300) { r1 = x; b1 = c; }
            else { r1 = c; b1 = x; }
            r = Math.floor(r1 * 255);
            g = Math.floor(g1 * 255);
            b = Math.floor(b1 * 255);
          }
          break;

        case 4: // Grayscale
        default:
          {
            const v = Math.floor(t * 255);
            r = v;
            g = v;
            b = v;
          }
          break;
      }

      paletteR[i] = Math.max(0, Math.min(255, r));
      paletteG[i] = Math.max(0, Math.min(255, g));
      paletteB[i] = Math.max(0, Math.min(255, b));
    }
  }

  function computeMandelbrot(targetWidth: number, targetHeight: number, maxIter: number): ImageData {
    const zoom = Math.pow(2, zoomLevel - 1);
    const range = BASE_RANGE / zoom;
    const cx = BASE_CENTER_X + centerXOffset;
    const cy = BASE_CENTER_Y;

    const xMin = cx - range / 2;
    const yMin = cy - (range / 2) * (targetHeight / targetWidth);
    const xMax = cx + range / 2;
    const yMax = cy + (range / 2) * (targetHeight / targetWidth);

    const dx = (xMax - xMin) / targetWidth;
    const dy = (yMax - yMin) / targetHeight;

    const imgData = new ImageData(targetWidth, targetHeight);
    const data = imgData.data;

    const bailout = 4; // |z|^2 > 4 means |z| > 2
    const logBailout = Math.log(bailout);
    const log2 = Math.log(2);

    for (let py = 0; py < targetHeight; py++) {
      const ci = yMin + py * dy;
      for (let px = 0; px < targetWidth; px++) {
        const cr = xMin + px * dx;

        let zr = 0;
        let zi = 0;
        let zr2 = 0;
        let zi2 = 0;
        let iter = 0;

        while (iter < maxIter && zr2 + zi2 <= bailout) {
          zi = 2 * zr * zi + ci;
          zr = zr2 - zi2 + cr;
          zr2 = zr * zr;
          zi2 = zi * zi;
          iter++;
        }

        let colorIdx: number;
        if (iter === maxIter) {
          colorIdx = maxIter;
        } else {
          // Smooth coloring using log-based escape time
          const logZn = Math.log(zr2 + zi2) / 2;
          const nu = Math.log(logZn / logBailout) / log2;
          const smoothIter = iter + 1 - nu;
          colorIdx = Math.max(0, Math.min(maxIter - 1, Math.floor(smoothIter % maxIter)));
        }

        const offset = (py * targetWidth + px) * 4;
        data[offset] = paletteR![colorIdx];
        data[offset + 1] = paletteG![colorIdx];
        data[offset + 2] = paletteB![colorIdx];
        data[offset + 3] = 255;
      }
    }

    return imgData;
  }

  function getResolutionForPass(pass: number): { w: number; h: number } {
    const divisors = [8, 4, 2, 1];
    const d = divisors[Math.min(pass, divisors.length - 1)];
    return {
      w: Math.max(1, Math.floor(width / d)),
      h: Math.max(1, Math.floor(height / d)),
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    renderPass = 0;
    needsRecompute = true;
    fullResImageData = null;

    offCanvas = document.createElement("canvas");
    offCtx = offCanvas.getContext("2d")!;
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;

    const newMaxIter = Math.floor(params.maxIterations ?? 100);
    const newScheme = Math.floor(params.colorScheme ?? 0);
    const newZoom = params.zoomLevel ?? 1;
    const newCenterX = params.centerXOffset ?? 0;

    const paramKey = `${newMaxIter}-${newScheme}-${newZoom.toFixed(4)}-${newCenterX.toFixed(4)}`;

    if (paramKey !== lastParamKey) {
      maxIterations = Math.max(10, Math.min(1000, newMaxIter));
      colorScheme = Math.max(0, Math.min(4, newScheme));
      zoomLevel = newZoom;
      centerXOffset = newCenterX;

      lastParamKey = paramKey;
      needsRecompute = true;
      renderPass = 0;
      fullResImageData = null;

      buildPalette(colorScheme, maxIterations);
    }

    // Progressive rendering: compute one pass per update
    if (needsRecompute && renderPass < MAX_RENDER_PASSES) {
      const { w, h } = getResolutionForPass(renderPass);
      if (w > 0 && h > 0) {
        const imgData = computeMandelbrot(w, h, maxIterations);
        offCanvas!.width = w;
        offCanvas!.height = h;
        offCtx!.putImageData(imgData, 0, 0);

        if (renderPass === MAX_RENDER_PASSES - 1) {
          fullResImageData = imgData;
          needsRecompute = false;
        }
      }
      renderPass++;
    }
  }

  function render(): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Draw the current render pass (scaled up if not full res)
    if (offCanvas && offCanvas.width > 0 && offCanvas.height > 0) {
      ctx.imageSmoothingEnabled = renderPass < MAX_RENDER_PASSES;
      ctx.drawImage(offCanvas, 0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
    }

    // Overlay: coordinate info and zoom level
    drawOverlay();
  }

  function drawOverlay(): void {
    const fontSize = Math.max(11, Math.min(height * 0.022, 14));
    const padding = 8;

    // Zoom and coordinate display
    const zoom = Math.pow(2, zoomLevel - 1);
    const range = BASE_RANGE / zoom;
    const cx = BASE_CENTER_X + centerXOffset;
    const cy = BASE_CENTER_Y;

    const lines = [
      `z\u2099\u208A\u2081 = z\u2099\u00B2 + c`,
      `Center: (${cx.toFixed(4)}, ${cy.toFixed(4)})`,
      `Range: ${range.toFixed(4)}`,
      `Zoom: ${zoom.toFixed(1)}x`,
      `Max iterations: ${maxIterations}`,
    ];

    // Background box
    const lineHeight = fontSize + 4;
    const boxW = Math.max(180, width * 0.25);
    const boxH = lines.length * lineHeight + padding * 2;
    const boxX = width - boxW - 10;
    const boxY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = "#fff";
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "left";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], boxX + padding, boxY + padding + (i + 1) * lineHeight - 4);
    }

    // Color scheme name
    const schemeNames = ["Blue-Gold", "Fire", "Ocean", "Rainbow", "Grayscale"];
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    const labelW = 120;
    ctx.fillRect(10, height - 30, labelW, 22);
    ctx.fillStyle = "#fff";
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`Scheme: ${schemeNames[colorScheme] || "Custom"}`, 16, height - 13);

    // Rendering progress indicator
    if (renderPass < MAX_RENDER_PASSES) {
      const progress = renderPass / MAX_RENDER_PASSES;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(10, 10, 130, 20);
      ctx.fillStyle = "#0f0";
      ctx.fillRect(12, 12, 126 * progress, 16);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(10, fontSize - 1)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Rendering...", 75, 25);
    }

    // Title
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(10, height - 58, 180, 24);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(12, fontSize + 1)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Mandelbrot Set", 16, height - 40);
  }

  function reset(): void {
    time = 0;
    renderPass = 0;
    needsRecompute = true;
    fullResImageData = null;
    lastParamKey = "";
  }

  function destroy(): void {
    offCanvas = null;
    offCtx = null;
    fullResImageData = null;
    paletteR = null;
    paletteG = null;
    paletteB = null;
  }

  function getStateDescription(): string {
    const zoom = Math.pow(2, zoomLevel - 1);
    const range = BASE_RANGE / zoom;
    const cx = (BASE_CENTER_X + centerXOffset).toFixed(4);
    const schemeNames = ["classic blue-gold", "fire", "ocean", "rainbow", "grayscale"];
    return `Displaying the Mandelbrot set fractal, defined by iterating z = z^2 + c ` +
      `starting from z=0 for each point c in the complex plane. Points where |z| stays ` +
      `bounded (never exceeds 2) are in the set (colored black). Escape-time coloring ` +
      `uses ${maxIterations} max iterations with ${schemeNames[colorScheme] || "custom"} color scheme. ` +
      `Currently centered at (${cx}, 0) with range ${range.toFixed(4)} ` +
      `(zoom ${zoom.toFixed(1)}x). The set boundary has infinite detail -- a true fractal ` +
      `with self-similar structures at all scales. The cardioid-shaped main body and ` +
      `circular bulbs are connected by infinitely thin filaments.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    renderPass = 0;
    needsRecompute = true;
    fullResImageData = null;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MandelbrotSetFactory;
