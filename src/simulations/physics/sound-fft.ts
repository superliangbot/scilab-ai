import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SoundFFTFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sound-fft") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let fundamental = 440;   // Hz
  let numHarmonics = 4;
  let amplitude1 = 1.0;
  let amplitude2 = 0.5;

  // Precomputed harmonic amplitudes: interpolate between two user amplitudes
  function getHarmonicAmplitudes(): number[] {
    const amps: number[] = [];
    for (let h = 0; h < numHarmonics; h++) {
      // Blend between amplitude1 (for fundamental) and amplitude2 (for highest)
      const t = numHarmonics > 1 ? h / (numHarmonics - 1) : 0;
      const baseAmp = amplitude1 * (1 - t) + amplitude2 * t;
      // Natural decay: 1/(h+1)
      amps.push(baseAmp / (h + 1));
    }
    return amps;
  }

  function generateHarmonic(t: number, harmonicIdx: number, amp: number): number {
    const freq = fundamental * (harmonicIdx + 1);
    return amp * Math.sin(2 * Math.PI * freq * t);
  }

  function generateComposite(t: number, amps: number[]): number {
    let sum = 0;
    for (let h = 0; h < amps.length; h++) {
      sum += generateHarmonic(t, h, amps[h]);
    }
    return sum;
  }

  // DFT computation for frequency spectrum
  function computeFFT(amps: number[], numBins: number): { magnitudes: number[]; freqs: number[] } {
    const sampleRate = 8000;
    const N = 1024;
    const maxFreq = fundamental * (numHarmonics + 1) + 200;

    // Generate samples
    const samples: number[] = [];
    for (let n = 0; n < N; n++) {
      const t = time + n / sampleRate;
      samples.push(generateComposite(t, amps));
    }

    // Apply Hann window
    for (let n = 0; n < N; n++) {
      samples[n] *= 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    }

    const magnitudes: number[] = [];
    const freqs: number[] = [];

    for (let k = 0; k < numBins; k++) {
      const binFreq = (k / numBins) * maxFreq;
      freqs.push(binFreq);
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * binFreq * n) / sampleRate;
        real += samples[n] * Math.cos(angle);
        imag -= samples[n] * Math.sin(angle);
      }
      magnitudes.push(Math.sqrt(real * real + imag * imag) / N * 2);
    }

    return { magnitudes, freqs };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    fundamental = params.fundamental ?? 440;
    numHarmonics = Math.max(1, Math.round(params.numHarmonics ?? 4));
    amplitude1 = params.amplitude1 ?? 1.0;
    amplitude2 = params.amplitude2 ?? 0.5;
    time += dt;
  }

  function drawBackground(): void {
    ctx.fillStyle = "#080c18";
    ctx.fillRect(0, 0, width, height);
  }

  function drawCompositeWaveform(amps: number[]): void {
    const margin = 40;
    const top = 30;
    const bottom = height * 0.28;
    const h = bottom - top;
    const left = margin;
    const right = width - margin;
    const w = right - left;
    const midY = top + h / 2;

    // Panel
    ctx.fillStyle = "rgba(15, 25, 45, 0.7)";
    ctx.beginPath();
    ctx.roundRect(left - 8, top - 8, w + 16, h + 16, 6);
    ctx.fill();

    // Grid
    ctx.strokeStyle = "rgba(60, 90, 130, 0.15)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = top + (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, midY);
    ctx.lineTo(right, midY);
    ctx.stroke();

    // Draw composite wave
    const numCycles = 3;
    const period = 1 / fundamental;
    const totalTime = numCycles * period;
    const maxAmp = amps.reduce((s, a) => s + a, 0);

    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const t = time + (px / w) * totalTime;
      const val = generateComposite(t, amps);
      const y = midY - (val / (maxAmp || 1)) * (h * 0.4);
      if (px === 0) ctx.moveTo(left + px, y);
      else ctx.lineTo(left + px, y);
    }
    ctx.strokeStyle = "#ff9944";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Glow
    ctx.strokeStyle = "rgba(255, 153, 68, 0.2)";
    ctx.lineWidth = 8;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255, 200, 120, 0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Composite Waveform", left + 4, top - 12);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${numHarmonics} harmonic${numHarmonics > 1 ? "s" : ""} combined`, right - 4, top - 12);
  }

  function drawIndividualHarmonics(amps: number[]): void {
    const margin = 40;
    const top = height * 0.32;
    const bottom = height * 0.58;
    const h = bottom - top;
    const left = margin;
    const right = width - margin;
    const w = right - left;

    // Panel
    ctx.fillStyle = "rgba(15, 25, 45, 0.7)";
    ctx.beginPath();
    ctx.roundRect(left - 8, top - 8, w + 16, h + 16, 6);
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(120, 200, 255, 0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Individual Frequency Components", left + 4, top - 12);

    const maxAmp = Math.max(...amps, 0.01);
    const numCycles = 3;
    const period = 1 / fundamental;
    const totalTime = numCycles * period;

    // Color palette for harmonics
    const colors = [
      "#44aaff", "#44ff88", "#ffdd44", "#ff6688",
      "#aa66ff", "#ff8844", "#44ffdd", "#ff44aa",
      "#88ff44", "#4488ff",
    ];

    // Draw each harmonic stacked
    const rowHeight = h / Math.max(numHarmonics, 1);
    for (let hIdx = 0; hIdx < numHarmonics; hIdx++) {
      const rowMidY = top + (hIdx + 0.5) * rowHeight;
      const rowAmpPx = rowHeight * 0.35;

      // Separator line
      if (hIdx > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(left, top + hIdx * rowHeight);
        ctx.lineTo(right, top + hIdx * rowHeight);
        ctx.stroke();
      }

      // Draw harmonic wave
      const color = colors[hIdx % colors.length];
      ctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const t = time + (px / w) * totalTime;
        const val = generateHarmonic(t, hIdx, amps[hIdx]);
        const y = rowMidY - (val / maxAmp) * rowAmpPx;
        if (px === 0) ctx.moveTo(left + px, y);
        else ctx.lineTo(left + px, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      const freq = fundamental * (hIdx + 1);
      ctx.fillStyle = color;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        `f${hIdx + 1} = ${freq.toFixed(0)} Hz (A=${amps[hIdx].toFixed(2)})`,
        right - 4,
        rowMidY - rowAmpPx - 2
      );
    }
  }

  function drawFFTSpectrum(amps: number[]): void {
    const margin = 40;
    const top = height * 0.63;
    const bottom = height - 30;
    const h = bottom - top;
    const left = margin;
    const right = width - margin;
    const w = right - left;

    // Panel
    ctx.fillStyle = "rgba(15, 25, 45, 0.7)";
    ctx.beginPath();
    ctx.roundRect(left - 8, top - 8, w + 16, h + 16, 6);
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255, 140, 200, 0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("FFT Magnitude Spectrum", left + 4, top - 12);

    // Compute FFT
    const numBins = 80;
    const { magnitudes, freqs } = computeFFT(amps, numBins);
    const maxMag = Math.max(...magnitudes, 0.01);
    const maxFreq = freqs[freqs.length - 1] || 1;

    // Draw bars
    const barWidth = (w / numBins) * 0.75;

    for (let k = 0; k < numBins; k++) {
      const normalized = magnitudes[k] / maxMag;
      const barH = normalized * h * 0.85;
      const x = left + (k / numBins) * w;
      const y = bottom - barH;

      // Color: purple-pink gradient
      const hue = 280 + (k / numBins) * 60;
      const lightness = 35 + normalized * 35;
      ctx.fillStyle = `hsla(${hue}, 70%, ${lightness}%, ${0.4 + normalized * 0.6})`;
      ctx.fillRect(x, y, barWidth, barH);

      // Bright cap
      if (normalized > 0.15) {
        ctx.fillStyle = `hsla(${hue}, 90%, 80%, ${normalized * 0.5})`;
        ctx.fillRect(x, y, barWidth, 2);
      }
    }

    // Frequency axis with Hz labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";

    // Show labels at harmonic frequencies
    for (let h = 0; h < numHarmonics; h++) {
      const freq = fundamental * (h + 1);
      const x = left + (freq / maxFreq) * w;
      if (x > left && x < right) {
        // Tick mark
        ctx.strokeStyle = "rgba(255, 200, 100, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, bottom);
        ctx.lineTo(x, bottom + 4);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
        ctx.fillText(`${freq.toFixed(0)}`, x, bottom + 14);
        ctx.fillText("Hz", x, bottom + 23);
      }
    }

    // Also label 0 and max
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textAlign = "left";
    ctx.fillText("0", left, bottom + 14);
    ctx.textAlign = "right";
    ctx.fillText(`${maxFreq.toFixed(0)} Hz`, right, bottom + 14);
  }

  function drawInfoPanel(amps: number[]): void {
    ctx.save();
    const panelW = 190;
    const panelH = 90;
    const panelX = width - panelW - 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 120, 220, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("FFT Decomposition", panelX + 10, panelY + 8);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 200, 120, 0.8)";
    ctx.fillText(`Fundamental: ${fundamental.toFixed(0)} Hz`, panelX + 10, panelY + 28);

    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.fillText(`Harmonics: ${numHarmonics}`, panelX + 10, panelY + 44);

    ctx.fillStyle = "rgba(180, 180, 180, 0.6)";
    ctx.fillText(`A1: ${amplitude1.toFixed(2)}, A2: ${amplitude2.toFixed(2)}`, panelX + 10, panelY + 60);

    // Total RMS
    const rms = Math.sqrt(amps.reduce((s, a) => s + a * a / 2, 0));
    ctx.fillText(`RMS: ${rms.toFixed(3)}`, panelX + 10, panelY + 76);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    const amps = getHarmonicAmplitudes();
    drawCompositeWaveform(amps);
    drawIndividualHarmonics(amps);
    drawFFTSpectrum(amps);
    drawInfoPanel(amps);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // nothing to clean up
  }

  function getStateDescription(): string {
    const amps = getHarmonicAmplitudes();
    const freqList = amps
      .map((a, i) => `${(fundamental * (i + 1)).toFixed(0)} Hz (A=${a.toFixed(3)})`)
      .join(", ");
    return (
      `Sound FFT simulation. A composite waveform built from ${numHarmonics} harmonics ` +
      `with fundamental frequency ${fundamental.toFixed(0)} Hz. Components: ${freqList}. ` +
      `Top panel shows the composite waveform. Middle panel shows individual frequency ` +
      `components. Bottom panel shows the FFT magnitude spectrum with frequency bins ` +
      `labeled in Hz. Amplitude controls: A1=${amplitude1.toFixed(2)}, A2=${amplitude2.toFixed(2)}. ` +
      `The FFT decomposes any complex periodic wave into its sinusoidal components, ` +
      `revealing the frequency content of the signal.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SoundFFTFactory;
