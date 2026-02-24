import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const FractalExplorerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("fractal-explorer") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;

  // View state
  let centerX = -0.5;
  let centerY = 0;
  let viewRange = 3.5; // total width in complex plane units

  // Cached parameters
  let maxIterations = 100;
  let colorScheme = 0;
  let juliaReal = 0;
  let juliaImag = 0;

  // Progressive rendering
  let renderPass = 0;
  let fullResImageData: ImageData | null = null;
  let needsRecompute = true;
  let lastParamKey = "";

  // Off-screen buffer for rendering at reduced resolution
  let offCanvas: HTMLCanvasElement | null = null;
  let offCtx: CanvasRenderingContext2D | null = null;

  // Pre-computed color palette for current scheme (cached for performance)
  let paletteCache: Uint8ClampedArray | null = null;
  let paletteCacheScheme = -1;
  let paletteCacheMaxIter = -1;

  // ---- Color scheme functions ----

  function buildPalette(scheme: number, maxIter: number): Uint8ClampedArray {
    // Build a lookup table: for each iteration 0..maxIter, store r,g,b
    // Index i => palette[i*3], palette[i*3+1], palette[i*3+2]
    const size = maxIter + 1;
    const pal = new Uint8ClampedArray(size * 3);

    for (let i = 0; i < size; i++) {
      const t = i / maxIter; // normalized 0..1
      let r = 0, g = 0, b = 0;

      switch (scheme) {
        case 0: // Classic blue-black-gold-white
          r = classicChannel(t, [0, 0.16, 0.42, 0.6425, 0.8575, 1.0], [0, 32, 237, 255, 0, 0]);
          g = classicChannel(t, [0, 0.16, 0.42, 0.6425, 0.8575, 1.0], [7, 107, 255, 170, 2, 7]);
          b = classicChannel(t, [0, 0.16, 0.42, 0.6425, 0.8575, 1.0], [100, 203, 255, 0, 0, 100]);
          break;

        case 1: { // Fire: black-red-orange-yellow-white
          if (t < 0.25) {
            const s = t / 0.25;
            r = s * 180;
            g = 0;
            b = 0;
          } else if (t < 0.5) {
            const s = (t - 0.25) / 0.25;
            r = 180 + s * 75;
            g = s * 120;
            b = 0;
          } else if (t < 0.75) {
            const s = (t - 0.5) / 0.25;
            r = 255;
            g = 120 + s * 135;
            b = s * 40;
          } else {
            const s = (t - 0.75) / 0.25;
            r = 255;
            g = 255;
            b = 40 + s * 215;
          }
          break;
        }

        case 2: { // Ocean: dark blue-cyan-white
          if (t < 0.33) {
            const s = t / 0.33;
            r = 0;
            g = s * 50;
            b = 40 + s * 140;
          } else if (t < 0.66) {
            const s = (t - 0.33) / 0.33;
            r = s * 60;
            g = 50 + s * 180;
            b = 180 + s * 55;
          } else {
            const s = (t - 0.66) / 0.34;
            r = 60 + s * 195;
            g = 230 + s * 25;
            b = 235 + s * 20;
          }
          break;
        }

        case 3: { // Psychedelic: cycling HSL rainbow
          const hue = (t * 5) % 1; // cycle 5 times through
          const [pr, pg, pb] = hslToRgb(hue, 0.9, 0.5);
          r = pr;
          g = pg;
          b = pb;
          break;
        }

        case 4: // Grayscale
          r = g = b = t * 255;
          break;

        default:
          r = g = b = t * 255;
      }

      pal[i * 3] = Math.round(r);
      pal[i * 3 + 1] = Math.round(g);
      pal[i * 3 + 2] = Math.round(b);
    }

    return pal;
  }

  /**
   * Interpolates a channel value from a set of control points.
   */
  function classicChannel(t: number, stops: number[], values: number[]): number {
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i] && t <= stops[i + 1]) {
        const localT = (t - stops[i]) / (stops[i + 1] - stops[i]);
        return values[i] + localT * (values[i + 1] - values[i]);
      }
    }
    return values[values.length - 1];
  }

  /**
   * Convert HSL (h in 0..1, s in 0..1, l in 0..1) to RGB [0..255, 0..255, 0..255]
   */
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, h + 1 / 3);
      g = hueToRgb(p, q, h);
      b = hueToRgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function hueToRgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  /**
   * Get color from smooth iteration count.
   * Returns [r, g, b] for the given smooth iteration value.
   */
  function getColor(smoothIter: number, maxIter: number, palette: Uint8ClampedArray): [number, number, number] {
    if (smoothIter >= maxIter) {
      return [0, 0, 0]; // inside the set: black
    }

    // Map smooth iteration to palette index with interpolation
    const scaled = (smoothIter / maxIter) * maxIter;
    const idx = Math.floor(scaled) % maxIter;
    const frac = scaled - Math.floor(scaled);
    const nextIdx = (idx + 1) % maxIter;

    const r = palette[idx * 3] + frac * (palette[nextIdx * 3] - palette[idx * 3]);
    const g = palette[idx * 3 + 1] + frac * (palette[nextIdx * 3 + 1] - palette[idx * 3 + 1]);
    const b = palette[idx * 3 + 2] + frac * (palette[nextIdx * 3 + 2] - palette[idx * 3 + 2]);

    return [r, g, b];
  }

  // ---- Fractal computation ----

  function computeFractal(
    imgData: ImageData,
    imgWidth: number,
    imgHeight: number,
    cx: number,
    cy: number,
    range: number,
    maxIter: number,
    isJulia: boolean,
    jReal: number,
    jImag: number,
    palette: Uint8ClampedArray
  ): void {
    const data = imgData.data;
    const aspectRatio = imgWidth / imgHeight;
    const rangeX = range;
    const rangeY = range / aspectRatio;
    const xMin = cx - rangeX / 2;
    const yMin = cy - rangeY / 2;
    const xStep = rangeX / imgWidth;
    const yStep = rangeY / imgHeight;

    const bailout = 256; // higher bailout for smoother coloring
    const logBailout = Math.log(bailout);
    const log2 = Math.log(2);

    for (let py = 0; py < imgHeight; py++) {
      const ci = yMin + py * yStep;
      for (let px = 0; px < imgWidth; px++) {
        const cr = xMin + px * xStep;

        let zr: number, zi: number, cReal: number, cImag: number;

        if (isJulia) {
          zr = cr;
          zi = ci;
          cReal = jReal;
          cImag = jImag;
        } else {
          zr = 0;
          zi = 0;
          cReal = cr;
          cImag = ci;
        }

        let iter = 0;
        let zr2 = zr * zr;
        let zi2 = zi * zi;

        while (zr2 + zi2 < bailout && iter < maxIter) {
          zi = 2 * zr * zi + cImag;
          zr = zr2 - zi2 + cReal;
          zr2 = zr * zr;
          zi2 = zi * zi;
          iter++;
        }

        const offset = (py * imgWidth + px) * 4;

        if (iter >= maxIter) {
          // Inside the set - black
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
          data[offset + 3] = 255;
        } else {
          // Smooth coloring
          const modulus = Math.sqrt(zr2 + zi2);
          const smoothVal = iter + 1 - Math.log(Math.log(modulus)) / log2;
          const [r, g, b] = getColor(Math.max(0, smoothVal), maxIter, palette);

          data[offset] = r;
          data[offset + 1] = g;
          data[offset + 2] = b;
          data[offset + 3] = 255;
        }
      }
    }
  }

  // ---- Engine methods ----

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;

    // Reset view to initial Mandelbrot view
    centerX = -0.5;
    centerY = 0;
    viewRange = 3.5;

    renderPass = 0;
    fullResImageData = null;
    needsRecompute = true;
    lastParamKey = "";

    // Create offscreen canvas for reduced-resolution pass
    offCanvas = document.createElement("canvas");
    offCtx = offCanvas.getContext("2d")!;
  }

  function update(_dt: number, params: Record<string, number>): void {
    const newMaxIter = Math.round(params.maxIterations ?? 100);
    const newColorScheme = Math.round(params.colorScheme ?? 0);
    const newJuliaReal = params.juliaReal ?? 0;
    const newJuliaImag = params.juliaImag ?? 0;

    // Build a param key to detect changes
    const paramKey = `${newMaxIter}|${newColorScheme}|${newJuliaReal.toFixed(4)}|${newJuliaImag.toFixed(4)}|${width}|${height}`;

    if (paramKey !== lastParamKey) {
      maxIterations = newMaxIter;
      colorScheme = newColorScheme;

      // If switching between Mandelbrot and Julia or vice versa, reset view
      const wasJulia = juliaReal !== 0 || juliaImag !== 0;
      const isNowJulia = newJuliaReal !== 0 || newJuliaImag !== 0;
      if (wasJulia !== isNowJulia) {
        if (isNowJulia) {
          centerX = 0;
          centerY = 0;
          viewRange = 4;
        } else {
          centerX = -0.5;
          centerY = 0;
          viewRange = 3.5;
        }
      }

      juliaReal = newJuliaReal;
      juliaImag = newJuliaImag;

      needsRecompute = true;
      renderPass = 0;
      lastParamKey = paramKey;
    }
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    // Rebuild palette if scheme or maxIter changed
    if (paletteCache === null || paletteCacheScheme !== colorScheme || paletteCacheMaxIter !== maxIterations) {
      paletteCache = buildPalette(colorScheme, maxIterations);
      paletteCacheScheme = colorScheme;
      paletteCacheMaxIter = maxIterations;
    }

    const isJulia = juliaReal !== 0 || juliaImag !== 0;

    if (needsRecompute) {
      needsRecompute = false;

      // Pass 1: Render at reduced resolution (1/4 size) for quick preview
      const scale = 0.25;
      const lowW = Math.max(1, Math.floor(width * scale));
      const lowH = Math.max(1, Math.floor(height * scale));

      if (offCanvas && offCtx) {
        offCanvas.width = lowW;
        offCanvas.height = lowH;
        const lowImgData = offCtx.createImageData(lowW, lowH);

        computeFractal(
          lowImgData, lowW, lowH,
          centerX, centerY, viewRange,
          maxIterations, isJulia, juliaReal, juliaImag,
          paletteCache
        );

        offCtx.putImageData(lowImgData, 0, 0);

        // Scale up to canvas with smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        ctx.drawImage(offCanvas, 0, 0, lowW, lowH, 0, 0, width, height);
      }

      // Schedule progressive refinement
      renderPass = 1;
    }

    if (renderPass === 1) {
      // Pass 2: half resolution
      const scale = 0.5;
      const midW = Math.max(1, Math.floor(width * scale));
      const midH = Math.max(1, Math.floor(height * scale));

      if (offCanvas && offCtx) {
        offCanvas.width = midW;
        offCanvas.height = midH;
        const midImgData = offCtx.createImageData(midW, midH);

        computeFractal(
          midImgData, midW, midH,
          centerX, centerY, viewRange,
          maxIterations, isJulia, juliaReal, juliaImag,
          paletteCache
        );

        offCtx.putImageData(midImgData, 0, 0);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(offCanvas, 0, 0, midW, midH, 0, 0, width, height);
      }

      renderPass = 2;
    } else if (renderPass === 2) {
      // Pass 3: full resolution
      fullResImageData = ctx.createImageData(width, height);

      computeFractal(
        fullResImageData, width, height,
        centerX, centerY, viewRange,
        maxIterations, isJulia, juliaReal, juliaImag,
        paletteCache
      );

      ctx.putImageData(fullResImageData, 0, 0);
      renderPass = 3; // done
    } else if (renderPass === 3 && fullResImageData) {
      // Already rendered at full resolution; just redraw cached data
      ctx.putImageData(fullResImageData, 0, 0);
    }

    // Draw info overlay
    drawOverlay(isJulia);
  }

  function drawOverlay(isJulia: boolean): void {
    const zoomLevel = 3.5 / viewRange;
    const mode = isJulia
      ? `Julia c = ${juliaReal.toFixed(3)} + ${juliaImag.toFixed(3)}i`
      : "Mandelbrot Set";

    // Semi-transparent background for text
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(8, height - 56, 320, 48, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "12px 'SF Mono', 'Fira Code', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.fillText(mode, 16, height - 38);
    ctx.fillText(
      `Center: (${centerX.toFixed(6)}, ${centerY.toFixed(6)})  Zoom: ${zoomLevel.toFixed(1)}x`,
      16, height - 20
    );
  }

  function reset(): void {
    const isJulia = juliaReal !== 0 || juliaImag !== 0;
    if (isJulia) {
      centerX = 0;
      centerY = 0;
      viewRange = 4;
    } else {
      centerX = -0.5;
      centerY = 0;
      viewRange = 3.5;
    }
    renderPass = 0;
    fullResImageData = null;
    needsRecompute = true;
    lastParamKey = "";
  }

  function destroy(): void {
    fullResImageData = null;
    paletteCache = null;
    offCanvas = null;
    offCtx = null;
  }

  function getStateDescription(): string {
    const isJulia = juliaReal !== 0 || juliaImag !== 0;
    const zoomLevel = 3.5 / viewRange;
    const mode = isJulia ? "Julia" : "Mandelbrot";
    const schemeNames = ["Classic", "Fire", "Ocean", "Psychedelic", "Grayscale"];

    let desc =
      `Fractal Explorer: ${mode} set. ` +
      `View center: (${centerX.toFixed(6)}, ${centerY.toFixed(6)}). ` +
      `Zoom level: ${zoomLevel.toFixed(2)}x. ` +
      `Max iterations: ${maxIterations}. ` +
      `Color scheme: ${schemeNames[colorScheme] ?? "Unknown"}.`;

    if (isJulia) {
      desc += ` Julia constant c = ${juliaReal.toFixed(4)} + ${juliaImag.toFixed(4)}i.`;
    }

    return desc;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    renderPass = 0;
    fullResImageData = null;
    needsRecompute = true;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default FractalExplorerFactory;
