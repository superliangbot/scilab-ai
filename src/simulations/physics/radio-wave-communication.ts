import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RadioWaveCommunicationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("radio-wave-communication") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let frequency = 100; // MHz
  let amplitude = 50;
  let modulationType = 0; // 0 = AM, 1 = FM
  let signalFreq = 2; // kHz message signal frequency

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    frequency = params.frequency ?? 100;
    amplitude = params.amplitude ?? 50;
    modulationType = params.modulationType ?? 0;
    signalFreq = params.signalFreq ?? 2;
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a2a");
    bgGrad.addColorStop(1, "#0a1a2a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const isAM = modulationType < 0.5;
    const waveY = height * 0.18;
    const msgY = height * 0.38;
    const modY = height * 0.62;
    const waveH = height * 0.12;
    const graphW = width * 0.75;
    const graphX = width * 0.12;

    // Draw signal flow diagram at top
    drawSignalFlow(isAM);

    // Message signal (audio)
    drawWaveform(graphX, msgY, graphW, waveH, "Message Signal (Audio)", "#44ff88", (x) => {
      return Math.sin(2 * Math.PI * signalFreq * x * 0.002 + time * 2);
    });

    // Carrier wave
    drawWaveform(graphX, waveY, graphW, waveH * 0.7, "Carrier Wave", "#6688ff", (x) => {
      return Math.sin(2 * Math.PI * frequency * x * 0.0002 + time * 10);
    });

    // Modulated wave
    const modLabel = isAM ? "AM Modulated Signal" : "FM Modulated Signal";
    const modColor = isAM ? "#ff8844" : "#ff44aa";

    drawWaveform(graphX, modY, graphW, waveH, modLabel, modColor, (x) => {
      const msg = Math.sin(2 * Math.PI * signalFreq * x * 0.002 + time * 2);
      if (isAM) {
        // AM: amplitude varies with message
        const envAmp = 1 + 0.5 * msg;
        return envAmp * Math.sin(2 * Math.PI * frequency * x * 0.0002 + time * 10);
      } else {
        // FM: frequency varies with message
        const freqDev = frequency * 0.3 * msg;
        return Math.sin(2 * Math.PI * (frequency + freqDev) * x * 0.0002 + time * 10);
      }
    });

    // Transmitter and receiver icons
    drawTower(width * 0.04, height * 0.55, "TX");
    drawTower(width * 0.9, height * 0.55, "RX");

    // Radio waves between towers
    for (let i = 0; i < 5; i++) {
      const phase = (time * 2 + i * 0.5) % 3;
      const alpha = Math.max(0, 1 - phase / 3) * 0.3;
      const r = phase * width * 0.15;
      ctx.beginPath();
      ctx.arc(width * 0.04 + 20, height * 0.55, r, -0.4, 0.4);
      ctx.strokeStyle = `rgba(100, 150, 255, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Info panel
    const panelX = width * 0.03;
    const panelY = height * 0.78;
    const panelW = width * 0.94;
    const panelH = height * 0.19;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();

    const wavelengthM = (3e8 / (frequency * 1e6)).toFixed(2);
    ctx.font = "12px 'SF Mono', monospace";
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Modulation: ${isAM ? "AM (Amplitude)" : "FM (Frequency)"}`, panelX + 12, panelY + 20);
    ctx.fillStyle = "rgba(100, 150, 255, 0.9)";
    ctx.fillText(`Carrier: ${frequency} MHz (λ = ${wavelengthM} m)`, panelX + 12, panelY + 40);
    ctx.fillStyle = "rgba(100, 255, 150, 0.9)";
    ctx.fillText(`Signal: ${signalFreq.toFixed(1)} kHz`, panelX + 12, panelY + 60);

    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.textAlign = "right";
    ctx.fillText(`c = fλ → λ = c/f = 3×10⁸ / ${(frequency * 1e6).toExponential(1)} = ${wavelengthM} m`, panelX + panelW - 12, panelY + 20);

    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(
      isAM ? "AM: Carrier amplitude varies with signal. Simple but susceptible to noise." : "FM: Carrier frequency varies with signal. Better noise immunity.",
      panelX + panelW - 12, panelY + 42
    );

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function drawWaveform(
    ox: number, oy: number, w: number, h: number,
    label: string, color: string,
    fn: (x: number) => number
  ): void {
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.roundRect(ox - 5, oy - h - 5, w + 10, h * 2 + 10, 4);
    ctx.fill();

    // Center line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + w, oy);
    ctx.stroke();

    // Wave
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const val = fn(x);
      const py = oy - val * h * (amplitude / 100);
      if (x === 0) ctx.moveTo(ox + x, py);
      else ctx.lineTo(ox + x, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, ox, oy - h - 10);
  }

  function drawSignalFlow(isAM: boolean): void {
    // Simple block diagram at top
    const y = height * 0.04;
    const blocks = [
      { x: width * 0.05, label: "Mic", color: "#44ff88" },
      { x: width * 0.25, label: isAM ? "AM Mod" : "FM Mod", color: "#ff8844" },
      { x: width * 0.5, label: "Transmit", color: "#6688ff" },
      { x: width * 0.75, label: "Receive", color: "#ff44aa" },
    ];

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.roundRect(b.x, y, 60, 20, 4);
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label, b.x + 30, y + 14);

      if (i < blocks.length - 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x + 60, y + 10);
        ctx.lineTo(blocks[i + 1].x, y + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(blocks[i + 1].x, y + 10);
        ctx.lineTo(blocks[i + 1].x - 5, y + 7);
        ctx.moveTo(blocks[i + 1].x, y + 10);
        ctx.lineTo(blocks[i + 1].x - 5, y + 13);
        ctx.stroke();
      }
    }
  }

  function drawTower(x: number, y: number, label: string): void {
    // Simple antenna tower
    ctx.strokeStyle = "rgba(200, 200, 200, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 10, y - 30);
    ctx.stroke();
    // Antenna arms
    ctx.beginPath();
    ctx.moveTo(x, y - 25);
    ctx.lineTo(x + 10, y - 30);
    ctx.lineTo(x + 20, y - 25);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x + 10, y + 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const isAM = modulationType < 0.5;
    const wavelengthM = 3e8 / (frequency * 1e6);
    return (
      `Radio wave communication: ${isAM ? "AM" : "FM"} modulation. ` +
      `Carrier frequency: ${frequency} MHz (wavelength: ${wavelengthM.toFixed(2)} m). ` +
      `Signal frequency: ${signalFreq} kHz, amplitude: ${amplitude}%. ` +
      `${isAM ? "AM varies the carrier amplitude with the message signal." : "FM varies the carrier frequency with the message signal."} ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RadioWaveCommunicationFactory;
