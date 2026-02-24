import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const WaveInterference: SimulationFactory = () => {
  const config = getSimConfig("wave-interference")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let wavelength = 30;
  let amplitude = 1;
  let separation = 150;
  let frequency = 2;
  let time = 0;

  // Rendering buffers
  /** Lower-resolution grid for wave computation */
  const SCALE = 4; // compute every 4th pixel
  let gridW = 0;
  let gridH = 0;
  let waveField: Float32Array = new Float32Array(0);
  let imageData: ImageData | null = null;
  let tmpCanvas: HTMLCanvasElement | null = null;
  let tmpCtx: CanvasRenderingContext2D | null = null;

  // Colors
  const BG_COLOR = "#0a0a0f";
  const SOURCE_COLOR = "#ffffff";
  const SOURCE_GLOW_COLOR = "rgba(255, 255, 255, 0.35)";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#94a3b8";

  function allocateBuffers() {
    gridW = Math.ceil(width / SCALE);
    gridH = Math.ceil(height / SCALE);
    waveField = new Float32Array(gridW * gridH);
    imageData = ctx.createImageData(gridW, gridH);
    
    // Cache temporary canvas to avoid creating it every frame
    tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = gridW;
    tmpCanvas.height = gridH;
    tmpCtx = tmpCanvas.getContext("2d")!;
  }

  /** Map a displacement value in [-2, 2] to an RGB color using a blue-black-red palette */
  function displacementToColor(val: number): [number, number, number] {
    // Clamp to [-2, 2]
    const clamped = Math.max(-2, Math.min(2, val));
    // Normalize to [-1, 1]
    const norm = clamped / 2;

    let r: number, g: number, b: number;

    if (norm < 0) {
      // Negative: black -> blue -> white
      const t = -norm; // 0..1
      if (t < 0.5) {
        // black to blue
        const u = t * 2; // 0..1
        r = 0;
        g = 0;
        b = Math.round(u * 200);
      } else {
        // blue to light blue/white
        const u = (t - 0.5) * 2; // 0..1
        r = Math.round(u * 140);
        g = Math.round(u * 180);
        b = Math.round(200 + u * 55);
      }
    } else if (norm > 0) {
      // Positive: black -> red -> white
      const t = norm; // 0..1
      if (t < 0.5) {
        // black to red
        const u = t * 2; // 0..1
        r = Math.round(u * 220);
        g = 0;
        b = 0;
      } else {
        // red to light red/white
        const u = (t - 0.5) * 2; // 0..1
        r = Math.round(220 + u * 35);
        g = Math.round(u * 180);
        b = Math.round(u * 140);
      }
    } else {
      r = 0;
      g = 0;
      b = 0;
    }

    return [r, g, b];
  }

  function computeWaveField() {
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * frequency;

    // Source positions (in pixel coordinates, centered)
    const cx = width / 2;
    const cy = height / 2;
    const halfSep = separation / 2;
    const s1x = cx - halfSep;
    const s1y = cy;
    const s2x = cx + halfSep;
    const s2y = cy;

    for (let gy = 0; gy < gridH; gy++) {
      const py = gy * SCALE + SCALE / 2; // pixel y at center of cell
      for (let gx = 0; gx < gridW; gx++) {
        const px = gx * SCALE + SCALE / 2; // pixel x at center of cell

        // Distances from each source
        const dx1 = px - s1x;
        const dy1 = py - s1y;
        const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

        const dx2 = px - s2x;
        const dy2 = py - s2y;
        const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        // Wave displacement: superposition of two circular waves
        // Include 1/sqrt(r) attenuation for circular waves (2D)
        const minR = 3; // avoid singularity near source
        const att1 = 1 / Math.sqrt(Math.max(r1, minR));
        const att2 = 1 / Math.sqrt(Math.max(r2, minR));

        const wave1 = amplitude * att1 * Math.sin(k * r1 - omega * time);
        const wave2 = amplitude * att2 * Math.sin(k * r2 - omega * time);

        waveField[gy * gridW + gx] = wave1 + wave2;
      }
    }
  }

  function renderWaveField() {
    if (!imageData) return;

    const data = imageData.data;

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const val = waveField[gy * gridW + gx];
        const [r, g, b] = displacementToColor(val);
        const idx = (gy * gridW + gx) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    // Draw the low-res imageData scaled up to the canvas
    // Use cached temporary canvas for nearest-neighbor-ish scaling
    // For performance, use ctx.putImageData on a small canvas then drawImage scaled
    if (!tmpCanvas || !tmpCtx) return;
    tmpCtx.putImageData(imageData, 0, 0);

    // Scale up with smooth interpolation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "low";
    ctx.drawImage(tmpCanvas, 0, 0, gridW, gridH, 0, 0, width, height);
  }

  function drawSources() {
    const cx = width / 2;
    const cy = height / 2;
    const halfSep = separation / 2;
    const s1x = cx - halfSep;
    const s2x = cx + halfSep;

    for (const sx of [s1x, s2x]) {
      // Outer glow
      const gradient = ctx.createRadialGradient(sx, cy, 0, sx, cy, 18);
      gradient.addColorStop(0, SOURCE_GLOW_COLOR);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, cy, 18, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright dot
      ctx.fillStyle = SOURCE_COLOR;
      ctx.beginPath();
      ctx.arc(sx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Ring pulsing with wave emission
      const phase = (time * frequency * 2 * Math.PI) % (2 * Math.PI);
      const ringRadius = 8 + 4 * Math.sin(phase);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, cy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Source labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("S\u2081", s1x, cy - 22);
    ctx.fillText("S\u2082", s2x, cy - 22);
  }

  function drawNodalLines() {
    // Draw subtle nodal lines by highlighting cells where the absolute value
    // of the displacement is very small (destructive interference).
    // We overlay semi-transparent markers for near-zero amplitude regions.
    const threshold = 0.08 * amplitude; // tweak for visibility

    ctx.fillStyle = "rgba(100, 220, 255, 0.06)";

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const val = Math.abs(waveField[gy * gridW + gx]);
        if (val < threshold) {
          ctx.fillRect(gx * SCALE, gy * SCALE, SCALE, SCALE);
        }
      }
    }
  }

  function drawInfoPanel() {
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * frequency;
    const pathDiffForMax = wavelength; // constructive when path diff = n * lambda

    const panelX = 10;
    const panelY = 10;
    const lineH = 18;

    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 260, lineH * 6 + 16, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 260, lineH * 6 + 16, 8);
    ctx.stroke();

    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;

    ctx.fillStyle = "#818cf8";
    ctx.fillText("Two-Source Wave Interference", x, y);
    y += lineH;

    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`\u03BB = ${wavelength}px   f = ${frequency.toFixed(1)}Hz`, x, y);
    y += lineH;

    ctx.fillText(`k = ${k.toFixed(3)} px\u207B\u00B9   \u03C9 = ${omega.toFixed(2)} rad/s`, x, y);
    y += lineH;

    ctx.fillText(`A = ${amplitude.toFixed(1)}   d = ${separation}px`, x, y);
    y += lineH;

    ctx.fillStyle = "#34d399";
    ctx.fillText(`Constructive: \u0394path = n\u00B7${wavelength}px`, x, y);
    y += lineH;

    ctx.fillStyle = "#f87171";
    ctx.fillText(`Destructive: \u0394path = (n+\u00BD)\u00B7${wavelength}px`, x, y);
  }

  function drawColorLegend() {
    const legendW = 140;
    const legendH = 14;
    const legendX = width - legendW - 20;
    const legendY = height - 44;

    // Background
    ctx.fillStyle = "rgba(10, 10, 15, 0.7)";
    ctx.beginPath();
    ctx.roundRect(legendX - 10, legendY - 20, legendW + 20, legendH + 36, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Displacement", legendX + legendW / 2, legendY - 4);

    // Gradient bar
    for (let i = 0; i < legendW; i++) {
      const norm = (i / legendW) * 4 - 2; // -2 to 2
      const [r, g, b] = displacementToColor(norm);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(legendX + i, legendY, 1, legendH);
    }

    // Labels
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("-", legendX, legendY + legendH + 3);
    ctx.textAlign = "center";
    ctx.fillText("0", legendX + legendW / 2, legendY + legendH + 3);
    ctx.textAlign = "right";
    ctx.fillText("+", legendX + legendW, legendY + legendH + 3);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      allocateBuffers();
    },

    update(dt: number, params: Record<string, number>) {
      wavelength = params.wavelength ?? wavelength;
      amplitude = params.amplitude ?? amplitude;
      separation = params.separation ?? separation;
      frequency = params.frequency ?? frequency;

      time += dt;

      // Compute the wave field at current time
      computeWaveField();
    },

    render() {
      // Clear to dark background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      // Render the wave field as colored pixels
      renderWaveField();

      // Draw subtle nodal line highlights
      drawNodalLines();

      // Draw source points on top
      drawSources();

      // Info overlay
      drawInfoPanel();

      // Color legend
      drawColorLegend();
    },

    reset() {
      time = 0;
      waveField.fill(0);
    },

    destroy() {
      // Release buffers
      waveField = new Float32Array(0);
      imageData = null;
    },

    getStateDescription(): string {
      const k = (2 * Math.PI) / wavelength;
      const omega = 2 * Math.PI * frequency;
      return (
        `Wave Interference: Two point sources separated by ${separation}px. ` +
        `Wavelength=${wavelength}px, Frequency=${frequency}Hz, Amplitude=${amplitude}. ` +
        `Wave number k=${k.toFixed(3)} px\u207B\u00B9, Angular frequency \u03C9=${omega.toFixed(2)} rad/s. ` +
        `Constructive interference occurs where path difference = n\u00B7\u03BB, ` +
        `destructive where path difference = (n+1/2)\u00B7\u03BB.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      allocateBuffers();
    },
  };

  return engine;
};

export default WaveInterference;
