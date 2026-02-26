import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Spectrogram Display
 *
 * Generates a signal with adjustable base frequency and sweep, then displays:
 *   - Top: current waveform (time-domain)
 *   - Bottom: scrolling spectrogram (frequency vs time, intensity as colour)
 *
 * The spectrogram is built by computing a simple DFT magnitude for each time
 * column and mapping intensity to a dark-blue -> cyan -> yellow -> white palette.
 */

const SpectrogramFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spectrogram") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let baseFrequency = 600;
  let sweepRange = 400;
  let sweepSpeed = 0.5;
  let noiseLevel = 0.1;

  // Spectrogram image buffer (pixel columns scroll left)
  const SPEC_COLS = 400; // number of time columns
  const SPEC_ROWS = 128; // frequency bins
  let spectrogramData: number[][] = []; // [col][row] intensity 0-1
  let spectrogramPointer = 0;
  let lastColumnTime = 0;
  const COLUMN_INTERVAL = 0.03; // seconds between spectrogram columns

  // Frequency range for spectrogram
  const FREQ_MIN = 50;
  const FREQ_MAX = 2500;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    lastColumnTime = 0;
    spectrogramPointer = 0;

    // Initialize spectrogram buffer
    spectrogramData = [];
    for (let col = 0; col < SPEC_COLS; col++) {
      spectrogramData.push(new Array(SPEC_ROWS).fill(0));
    }
  }

  /** Compute the instantaneous frequency at time t (sweeps up/down) */
  function instantFreq(t: number): number {
    return baseFrequency + sweepRange * Math.sin(2 * Math.PI * sweepSpeed * t);
  }

  /** Generate a signal sample at time t */
  function signalSample(t: number): number {
    const freq = instantFreq(t);
    // Chirp signal: integrate instantaneous frequency for phase
    // phase = 2*PI * integral of freq dt
    // For sin sweep: phase = 2*PI * (baseFreq*t - sweepRange/(2*PI*sweepSpeed) * cos(2*PI*sweepSpeed*t))
    const phase =
      2 * Math.PI * baseFrequency * t -
      (sweepRange / sweepSpeed) * Math.cos(2 * Math.PI * sweepSpeed * t);
    const signal = Math.sin(phase);
    // Add a harmonic
    const harmonic = 0.3 * Math.sin(2 * phase);
    // Add noise
    const noise = noiseLevel * (Math.random() * 2 - 1);
    return signal + harmonic + noise;
  }

  /** Compute spectral magnitudes for a short window around time t */
  function computeSpectrum(t: number): number[] {
    const mags = new Array(SPEC_ROWS).fill(0);
    const windowSize = 128;
    const dt = 1 / 4000; // sample rate for analysis

    for (let bin = 0; bin < SPEC_ROWS; bin++) {
      const freq = FREQ_MIN + (bin / (SPEC_ROWS - 1)) * (FREQ_MAX - FREQ_MIN);
      let realSum = 0;
      let imagSum = 0;
      for (let n = 0; n < windowSize; n++) {
        const sampleT = t - (windowSize / 2 - n) * dt;
        const s = signalSample(sampleT);
        // Hann window
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (windowSize - 1)));
        const angle = -2 * Math.PI * freq * n * dt;
        realSum += s * w * Math.cos(angle);
        imagSum += s * w * Math.sin(angle);
      }
      mags[bin] = Math.sqrt(realSum * realSum + imagSum * imagSum) / windowSize;
    }

    // Normalise to 0-1
    let maxMag = 0;
    for (let i = 0; i < SPEC_ROWS; i++) {
      if (mags[i] > maxMag) maxMag = mags[i];
    }
    if (maxMag > 0) {
      for (let i = 0; i < SPEC_ROWS; i++) {
        mags[i] = mags[i] / maxMag;
      }
    }
    return mags;
  }

  function update(dt: number, params: Record<string, number>): void {
    baseFrequency = params.baseFrequency ?? 600;
    sweepRange = params.sweepRange ?? 400;
    sweepSpeed = params.sweepSpeed ?? 0.5;
    noiseLevel = params.noiseLevel ?? 0.1;

    time += dt;

    // Add spectrogram columns at fixed intervals
    while (time - lastColumnTime >= COLUMN_INTERVAL) {
      lastColumnTime += COLUMN_INTERVAL;
      const spectrum = computeSpectrum(lastColumnTime);
      spectrogramData[spectrogramPointer % SPEC_COLS] = spectrum;
      spectrogramPointer++;
    }
  }

  /** Map intensity 0-1 to colour (dark blue -> cyan -> yellow -> white) */
  function intensityColor(v: number): string {
    v = Math.max(0, Math.min(1, v));
    let r: number, g: number, b: number;
    if (v < 0.25) {
      const t = v / 0.25;
      r = 0;
      g = 0;
      b = Math.floor(40 + 120 * t);
    } else if (v < 0.5) {
      const t = (v - 0.25) / 0.25;
      r = 0;
      g = Math.floor(200 * t);
      b = Math.floor(160 + 60 * t);
    } else if (v < 0.75) {
      const t = (v - 0.5) / 0.25;
      r = Math.floor(255 * t);
      g = Math.floor(200 + 55 * t);
      b = Math.floor(220 - 180 * t);
    } else {
      const t = (v - 0.75) / 0.25;
      r = 255;
      g = 255;
      b = Math.floor(40 + 215 * t);
    }
    return `rgb(${r},${g},${b})`;
  }

  function drawWaveform(): void {
    const gx = width * 0.08;
    const gy = height * 0.06;
    const gw = width * 0.84;
    const gh = height * 0.28;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Waveform (Time Domain)", gx + gw / 2, gy + 18);

    const plotL = gx + 10;
    const plotR = gx + gw - 10;
    const plotT = gy + 28;
    const plotB = gy + gh - 8;
    const midY = (plotT + plotB) / 2;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    // Zero line
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotL, midY);
    ctx.lineTo(plotR, midY);
    ctx.stroke();

    // Draw waveform (last ~0.05 seconds)
    const windowDuration = 0.05;
    const numSamples = 300;
    ctx.beginPath();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    for (let i = 0; i < numSamples; i++) {
      const frac = i / (numSamples - 1);
      const sampleT = time - windowDuration + frac * windowDuration;
      const val = signalSample(sampleT);
      const sx = plotL + frac * plotW;
      const sy = midY - val * plotH * 0.4;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Frequency label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`f = ${instantFreq(time).toFixed(0)} Hz`, plotR - 5, plotT + 10);
  }

  function drawSpectrogram(): void {
    const gx = width * 0.08;
    const gy = height * 0.4;
    const gw = width * 0.84;
    const gh = height * 0.5;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Spectrogram (Frequency vs Time)", gx + gw / 2, gy + 18);

    const plotL = gx + 50;
    const plotR = gx + gw - 10;
    const plotT = gy + 28;
    const plotB = gy + gh - 25;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    // Y-axis labels (frequency)
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const freq = FREQ_MIN + (i / 5) * (FREQ_MAX - FREQ_MIN);
      const y = plotB - (i / 5) * plotH;
      ctx.fillText(`${freq.toFixed(0)} Hz`, plotL - 5, y + 3);

      ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(plotL, y);
      ctx.lineTo(plotR, y);
      ctx.stroke();
    }

    // X-axis label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time \u2192", plotL + plotW / 2, plotB + 18);

    // Draw spectrogram columns
    const numVisibleCols = Math.min(spectrogramPointer, SPEC_COLS);
    const colWidth = plotW / SPEC_COLS;
    const rowHeight = plotH / SPEC_ROWS;

    for (let c = 0; c < numVisibleCols; c++) {
      // Map buffer index to screen (newest on right)
      const bufIdx = (spectrogramPointer - numVisibleCols + c + SPEC_COLS * 10) % SPEC_COLS;
      const screenX = plotL + (c / SPEC_COLS) * plotW;

      for (let r = 0; r < SPEC_ROWS; r++) {
        const intensity = spectrogramData[bufIdx][r];
        if (intensity < 0.02) continue; // skip dark pixels for performance
        const screenY = plotB - ((r + 1) / SPEC_ROWS) * plotH;
        ctx.fillStyle = intensityColor(intensity);
        ctx.fillRect(screenX, screenY, colWidth + 1, rowHeight + 1);
      }
    }

    // Color bar legend
    const barX = plotR + 5;
    const barW = 12;
    for (let i = 0; i < plotH; i++) {
      const v = i / plotH;
      ctx.fillStyle = intensityColor(v);
      ctx.fillRect(barX, plotB - i, barW, 1);
    }
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, plotT, barW, plotH);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("High", barX + barW + 3, plotT + 8);
    ctx.fillText("Low", barX + barW + 3, plotB);
  }

  function drawInfoPanel(): void {
    const px = width * 0.02;
    const py = height * 0.93;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(px, py - 5, width * 0.96, 30, 6);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `Base: ${baseFrequency.toFixed(0)} Hz | Sweep: \u00B1${sweepRange.toFixed(0)} Hz | ` +
      `Speed: ${sweepSpeed.toFixed(2)} Hz | Noise: ${noiseLevel.toFixed(2)} | t = ${time.toFixed(1)} s`,
      px + 10, py + 12
    );
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawWaveform();
    drawSpectrogram();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    lastColumnTime = 0;
    spectrogramPointer = 0;
    spectrogramData = [];
    for (let col = 0; col < SPEC_COLS; col++) {
      spectrogramData.push(new Array(SPEC_ROWS).fill(0));
    }
  }

  function destroy(): void {
    spectrogramData = [];
  }

  function getStateDescription(): string {
    return (
      `Spectrogram: base frequency=${baseFrequency.toFixed(0)} Hz, sweep range=\u00B1${sweepRange.toFixed(0)} Hz, ` +
      `sweep speed=${sweepSpeed.toFixed(2)}, noise=${noiseLevel.toFixed(2)}. ` +
      `Current instantaneous frequency=${instantFreq(time).toFixed(0)} Hz. ` +
      `The spectrogram scrolls left showing frequency content over time, ` +
      `with intensity mapped from dark blue (low) through cyan and yellow to white (high). t=${time.toFixed(1)} s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpectrogramFactory;
