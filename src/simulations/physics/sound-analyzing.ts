import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SoundAnalyzingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sound-analyzing") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 440;      // Hz
  let amplitude = 0.7;
  let waveType = 0;          // 0=sine, 1=square, 2=triangle, 3=sawtooth
  let harmonics = 1;

  // Waveform labels
  const WAVE_NAMES = ["Sine", "Square", "Triangle", "Sawtooth"];

  function generateSample(t: number, freq: number, type: number): number {
    const phase = (t * freq) % 1;
    switch (type) {
      case 0: // Sine
        return Math.sin(phase * Math.PI * 2);
      case 1: // Square
        return phase < 0.5 ? 1 : -1;
      case 2: // Triangle
        return 1 - 4 * Math.abs(phase - 0.5);
      case 3: // Sawtooth
        return 2 * phase - 1;
      default:
        return Math.sin(phase * Math.PI * 2);
    }
  }

  function generateComposite(t: number): number {
    let value = 0;
    for (let h = 1; h <= harmonics; h++) {
      const harmFreq = frequency * h;
      const harmAmp = amplitude / h; // Natural harmonic decay (1/n)
      value += harmAmp * generateSample(t, harmFreq, waveType);
    }
    return value;
  }

  // Simple DFT for the frequency spectrum (not FFT, but sufficient for display)
  function computeSpectrum(numBins: number): number[] {
    const spectrum: number[] = new Array(numBins).fill(0);
    const sampleRate = 8000; // virtual sample rate
    const N = 512; // number of samples

    // Generate samples
    const samples: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = time + i / sampleRate;
      samples.push(generateComposite(t));
    }

    // DFT for each frequency bin
    const maxFreq = Math.min(4000, frequency * harmonics * 1.5 + 200);
    for (let k = 0; k < numBins; k++) {
      const binFreq = (k / numBins) * maxFreq;
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * binFreq * n) / sampleRate;
        real += samples[n] * Math.cos(angle);
        imag -= samples[n] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(real * real + imag * imag) / N;
    }

    return spectrum;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    frequency = params.frequency ?? 440;
    amplitude = params.amplitude ?? 0.7;
    waveType = Math.round(params.waveType ?? 0);
    harmonics = Math.max(1, Math.round(params.harmonics ?? 1));
    time += dt;
  }

  function drawBackground(): void {
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);
  }

  function drawWaveform(): void {
    const margin = 40;
    const waveTop = 50;
    const waveBottom = height * 0.48;
    const waveHeight = waveBottom - waveTop;
    const waveLeft = margin;
    const waveRight = width - margin;
    const waveWidth = waveRight - waveLeft;
    const waveMidY = waveTop + waveHeight / 2;

    // Panel background
    ctx.fillStyle = "rgba(20, 30, 50, 0.6)";
    ctx.beginPath();
    ctx.roundRect(waveLeft - 10, waveTop - 10, waveWidth + 20, waveHeight + 20, 8);
    ctx.fill();

    // Grid lines
    ctx.strokeStyle = "rgba(80, 120, 160, 0.15)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = waveTop + (i / 4) * waveHeight;
      ctx.beginPath();
      ctx.moveTo(waveLeft, y);
      ctx.lineTo(waveRight, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = waveLeft + (i / 8) * waveWidth;
      ctx.beginPath();
      ctx.moveTo(x, waveTop);
      ctx.lineTo(x, waveBottom);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waveLeft, waveMidY);
    ctx.lineTo(waveRight, waveMidY);
    ctx.stroke();

    // Draw waveform
    const numCycles = 4;
    const period = 1 / frequency;
    const totalTime = numCycles * period;

    ctx.beginPath();
    let first = true;
    for (let px = 0; px <= waveWidth; px++) {
      const t = time + (px / waveWidth) * totalTime;
      const val = generateComposite(t);
      const y = waveMidY - val * (waveHeight * 0.4);
      if (first) {
        ctx.moveTo(waveLeft + px, y);
        first = false;
      } else {
        ctx.lineTo(waveLeft + px, y);
      }
    }

    // Gradient stroke color based on wave type
    const colors = ["#00ccff", "#ff6644", "#44ff88", "#ffaa22"];
    ctx.strokeStyle = colors[waveType] || "#00ccff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glow
    ctx.strokeStyle = (colors[waveType] || "#00ccff") + "40";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time Domain - Waveform", (waveLeft + waveRight) / 2, waveTop - 16);

    ctx.textAlign = "right";
    ctx.fillText("+A", waveLeft - 4, waveTop + 12);
    ctx.fillText("0", waveLeft - 4, waveMidY + 4);
    ctx.fillText("-A", waveLeft - 4, waveBottom - 4);

    // Period marker
    const periodPx = waveWidth / numCycles;
    const pStart = waveLeft;
    const pEnd = waveLeft + periodPx;
    const pY = waveBottom + 14;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pStart, pY - 3);
    ctx.lineTo(pStart, pY + 3);
    ctx.moveTo(pStart, pY);
    ctx.lineTo(pEnd, pY);
    ctx.moveTo(pEnd, pY - 3);
    ctx.lineTo(pEnd, pY + 3);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`T = ${(period * 1000).toFixed(2)} ms`, (pStart + pEnd) / 2, pY + 14);
  }

  function drawSpectrum(): void {
    const margin = 40;
    const specTop = height * 0.55;
    const specBottom = height - 40;
    const specHeight = specBottom - specTop;
    const specLeft = margin;
    const specRight = width - margin;
    const specWidth = specRight - specLeft;

    // Panel background
    ctx.fillStyle = "rgba(20, 30, 50, 0.6)";
    ctx.beginPath();
    ctx.roundRect(specLeft - 10, specTop - 10, specWidth + 20, specHeight + 20, 8);
    ctx.fill();

    // Compute spectrum
    const numBins = 64;
    const spectrum = computeSpectrum(numBins);
    const maxMag = Math.max(...spectrum, 0.01);
    const maxFreq = Math.min(4000, frequency * harmonics * 1.5 + 200);

    // Draw bars
    const barWidth = (specWidth / numBins) * 0.8;
    const barGap = (specWidth / numBins) * 0.2;

    for (let k = 0; k < numBins; k++) {
      const normalized = spectrum[k] / maxMag;
      const barH = normalized * specHeight * 0.85;
      const x = specLeft + (k / numBins) * specWidth;
      const y = specBottom - barH;

      // Color gradient: low freq = blue, high freq = red
      const hue = 200 - (k / numBins) * 200;
      const lightness = 40 + normalized * 30;
      ctx.fillStyle = `hsla(${hue}, 80%, ${lightness}%, ${0.5 + normalized * 0.5})`;
      ctx.fillRect(x, y, barWidth, barH);

      // Glow on top
      if (normalized > 0.3) {
        ctx.fillStyle = `hsla(${hue}, 90%, 70%, ${normalized * 0.3})`;
        ctx.fillRect(x - 1, y - 2, barWidth + 2, 4);
      }
    }

    // Frequency axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    const freqLabels = [0, 0.25, 0.5, 0.75, 1];
    for (const f of freqLabels) {
      const x = specLeft + f * specWidth;
      const freqVal = f * maxFreq;
      ctx.fillText(`${freqVal.toFixed(0)} Hz`, x, specBottom + 14);
    }

    // Mark harmonic frequencies
    ctx.strokeStyle = "rgba(255, 200, 100, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    for (let h = 1; h <= harmonics; h++) {
      const hFreq = frequency * h;
      const x = specLeft + (hFreq / maxFreq) * specWidth;
      if (x > specLeft && x < specRight) {
        ctx.beginPath();
        ctx.moveTo(x, specTop);
        ctx.lineTo(x, specBottom);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 200, 100, 0.6)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.fillText(`${hFreq.toFixed(0)}`, x, specTop - 2);
      }
    }
    ctx.setLineDash([]);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Frequency Domain - Spectrum", (specLeft + specRight) / 2, specTop - 16);
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 200;
    const panelH = 105;
    const panelX = width - panelW - 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Sound Analysis", panelX + 12, panelY + 10);

    const colors = ["#00ccff", "#ff6644", "#44ff88", "#ffaa22"];
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = colors[waveType] || "#00ccff";
    ctx.fillText(`Wave: ${WAVE_NAMES[waveType]}`, panelX + 12, panelY + 30);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Frequency: ${frequency.toFixed(0)} Hz`, panelX + 12, panelY + 48);
    ctx.fillText(`Amplitude: ${amplitude.toFixed(2)}`, panelX + 12, panelY + 64);
    ctx.fillText(`Harmonics: ${harmonics}`, panelX + 12, panelY + 80);

    // Musical note approximation
    const noteNum = 12 * Math.log2(frequency / 440);
    const noteNames = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
    const noteIdx = ((Math.round(noteNum) % 12) + 12) % 12;
    const octave = Math.floor((Math.round(noteNum) + 9) / 12) + 4;
    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Note: ~${noteNames[noteIdx]}${octave}`, panelX + 12, panelY + 94);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawWaveform();
    drawSpectrum();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // nothing to clean up
  }

  function getStateDescription(): string {
    const period = (1 / frequency * 1000).toFixed(2);
    return (
      `Sound Analyzing simulation. Displaying a ${WAVE_NAMES[waveType]} wave at ` +
      `${frequency.toFixed(0)} Hz (period ${period} ms), amplitude ${amplitude.toFixed(2)}, ` +
      `with ${harmonics} harmonic(s). Top panel shows the time-domain waveform. ` +
      `Bottom panel shows the frequency spectrum with peaks at harmonic frequencies ` +
      `(${Array.from({ length: harmonics }, (_, i) => `${(frequency * (i + 1)).toFixed(0)} Hz`).join(", ")}). ` +
      `Harmonic amplitudes decay as 1/n. Different wave types (sine, square, triangle, ` +
      `sawtooth) have characteristic harmonic content.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SoundAnalyzingFactory;
