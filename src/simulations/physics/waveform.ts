import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const WaveformFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("waveform") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let frequency = 440;
  let waveType = 0; // 0=sine, 1=square, 2=sawtooth, 3=triangle
  let harmonics = 5;
  let showSpectrum = 1;

  function waveValue(t: number, type: number, nHarmonics: number): number {
    switch (type) {
      case 0: // Sine
        return Math.sin(2 * Math.PI * t);
      case 1: { // Square (Fourier series)
        let val = 0;
        for (let n = 1; n <= nHarmonics; n++) {
          const k = 2 * n - 1; // odd harmonics only
          val += Math.sin(2 * Math.PI * k * t) / k;
        }
        return val * (4 / Math.PI);
      }
      case 2: { // Sawtooth
        let val = 0;
        for (let n = 1; n <= nHarmonics; n++) {
          val += Math.sin(2 * Math.PI * n * t) / n * (n % 2 === 0 ? -1 : 1);
        }
        return val * (2 / Math.PI);
      }
      case 3: { // Triangle
        let val = 0;
        for (let n = 0; n < nHarmonics; n++) {
          const k = 2 * n + 1;
          val += Math.pow(-1, n) * Math.sin(2 * Math.PI * k * t) / (k * k);
        }
        return val * (8 / (Math.PI * Math.PI));
      }
      default:
        return Math.sin(2 * Math.PI * t);
    }
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
    waveType = Math.round(params.waveType ?? 0);
    harmonics = Math.round(params.harmonics ?? 5);
    showSpectrum = Math.round(params.showSpectrum ?? 1);

    time += dt;
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a2e");
    bg.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const typeNames = ["Sine", "Square", "Sawtooth", "Triangle"];

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Waveform: ${typeNames[waveType]} Wave`, width / 2, 24);

    // Waveform display
    const waveY = height * 0.15;
    const waveH = showSpectrum ? height * 0.35 : height * 0.6;
    const waveX = width * 0.08;
    const waveW = width * 0.84;

    // Waveform background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(waveX - 10, waveY - 10, waveW + 20, waveH + 20, 8);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waveX, waveY + waveH / 2);
    ctx.lineTo(waveX + waveW, waveY + waveH / 2);
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let v = -1; v <= 1; v += 0.5) {
      const gy = waveY + waveH / 2 - v * waveH * 0.45;
      ctx.beginPath();
      ctx.moveTo(waveX, gy);
      ctx.lineTo(waveX + waveW, gy);
      ctx.stroke();
    }

    // Draw waveform
    const periods = 3;
    ctx.beginPath();
    for (let i = 0; i <= waveW; i++) {
      const t = (i / waveW) * periods + time * (frequency / 200);
      const val = waveValue(t, waveType, harmonics);
      const py = waveY + waveH / 2 - val * waveH * 0.42;
      if (i === 0) ctx.moveTo(waveX + i, py);
      else ctx.lineTo(waveX + i, py);
    }

    const colors = ["#3498db", "#e74c3c", "#2ecc71", "#f1c40f"];
    ctx.strokeStyle = colors[waveType];
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Moving cursor line
    const cursorX = waveX + ((time * frequency / 200) % 1) * (waveW / periods);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, waveY);
    ctx.lineTo(cursorX, waveY + waveH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y-axis labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("+1", waveX - 4, waveY + waveH * 0.08);
    ctx.fillText("0", waveX - 4, waveY + waveH / 2 + 3);
    ctx.fillText("-1", waveX - 4, waveY + waveH * 0.92);

    // Frequency spectrum
    if (showSpectrum) {
      const specY = waveY + waveH + 40;
      const specH = height - specY - 40;
      const specW = waveW;

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.roundRect(waveX - 10, specY - 15, specW + 20, specH + 25, 8);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Frequency Spectrum", waveX + specW / 2, specY - 3);

      // Draw harmonic bars
      const maxHarmonics = Math.min(harmonics * 2, 15);
      const barW = Math.min(specW / (maxHarmonics + 1) * 0.6, 30);

      for (let n = 1; n <= maxHarmonics; n++) {
        let amp = 0;
        if (waveType === 0) {
          amp = n === 1 ? 1 : 0;
        } else if (waveType === 1) {
          amp = n % 2 === 1 ? 1 / n : 0;
        } else if (waveType === 2) {
          amp = 1 / n;
        } else {
          amp = n % 2 === 1 ? 1 / (n * n) : 0;
        }

        if (n > harmonics) amp *= 0.2; // dim unincluded harmonics

        const barH = amp * specH * 0.85;
        const bx = waveX + (n / (maxHarmonics + 1)) * specW - barW / 2;
        const by = specY + specH - barH;

        ctx.fillStyle = n <= harmonics ? colors[waveType] : "rgba(255,255,255,0.15)";
        ctx.fillRect(bx, by, barW, barH);

        // Frequency label
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${n}f`, bx + barW / 2, specY + specH + 12);
      }

      // Axis
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(waveX, specY + specH);
      ctx.lineTo(waveX + specW, specY + specH);
      ctx.stroke();
    }

    // Info
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`f = ${frequency} Hz | Harmonics: ${harmonics} | Timbre varies by harmonic content`, width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const typeNames = ["Sine", "Square", "Sawtooth", "Triangle"];
    return (
      `Waveform: ${typeNames[waveType]} wave at ${frequency}Hz with ${harmonics} harmonics. ` +
      `Different waveforms have unique harmonic spectra (timbre). Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default WaveformFactory;
