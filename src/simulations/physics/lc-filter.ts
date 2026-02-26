import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LcFilterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lc-filter") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let inductance = 100; // uH
  let capacitance = 100; // uF
  let freqLow = 100; // Hz
  let freqHigh = 5000; // Hz
  let filterType = 0; // 0 = low-pass, 1 = high-pass

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>) {
    inductance = params.inductance ?? 100;
    capacitance = params.capacitance ?? 100;
    freqLow = params.freqLow ?? 100;
    freqHigh = params.freqHigh ?? 5000;
    filterType = Math.round(params.filterType ?? 0);
    time += Math.min(dt, 0.05);
  }

  // Calculate impedance and gain for LC filter
  function calcGain(freq: number): number {
    const L = inductance * 1e-6; // Henrys
    const C = capacitance * 1e-6; // Farads
    const omega = 2 * Math.PI * freq;
    const xL = omega * L; // inductive reactance
    const xC = 1 / (omega * C); // capacitive reactance

    if (filterType === 0) {
      // Low-pass: L in series, C to ground. Gain = Xc / sqrt(Xl^2 + Xc^2)
      return xC / Math.sqrt(xL * xL + xC * xC);
    } else {
      // High-pass: C in series, L to ground. Gain = Xl / sqrt(Xl^2 + Xc^2)
      return xL / Math.sqrt(xL * xL + xC * xC);
    }
  }

  function resonantFreq(): number {
    const L = inductance * 1e-6;
    const C = capacitance * 1e-6;
    return 1 / (2 * Math.PI * Math.sqrt(L * C));
  }

  function drawWaveform(
    x: number, y: number, w: number, h: number,
    freq: number, amplitude: number, color: string, label: string
  ) {
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Center line
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();

    // Waveform
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const cycles = Math.max(2, Math.min(8, freq / 500));
    for (let i = 0; i <= w; i++) {
      const t = (i / w) * cycles * 2 * Math.PI + time * freq * 0.01;
      const val = Math.sin(t) * amplitude;
      const py = y + h / 2 - val * (h * 0.4);
      if (i === 0) ctx.moveTo(x + i, py);
      else ctx.lineTo(x + i, py);
    }
    ctx.stroke();

    // Label
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(label, x + 4, y + 13);

    // Amplitude text
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText(`A=${amplitude.toFixed(2)}`, x + w - 4, y + 13);
  }

  function drawCircuitDiagram(x: number, y: number, w: number, h: number) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(filterType === 0 ? "Low-Pass LC Filter" : "High-Pass LC Filter", x + w / 2, y + 18);

    const cx = x + w / 2;
    const cy = y + h / 2 + 5;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;

    if (filterType === 0) {
      // Low-pass: L in series, C shunt to ground
      // Input line
      ctx.beginPath();
      ctx.moveTo(x + 20, cy);
      ctx.lineTo(cx - 40, cy);
      ctx.stroke();

      // Inductor (zigzag)
      drawInductor(cx - 40, cy, 80);

      // Output line
      ctx.beginPath();
      ctx.moveTo(cx + 40, cy);
      ctx.lineTo(x + w - 20, cy);
      ctx.stroke();

      // Capacitor shunt
      const capX = cx + 40;
      drawCapacitor(capX, cy, cy + 40);

      // Ground
      ctx.beginPath();
      ctx.moveTo(capX, cy + 40);
      ctx.lineTo(capX, cy + 50);
      ctx.stroke();
      drawGround(capX, cy + 50);

      // Labels
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "center";
      ctx.fillText(`L=${inductance}μH`, cx, cy - 15);
      ctx.fillStyle = "#3b82f6";
      ctx.fillText(`C=${capacitance}μF`, capX + 25, cy + 25);
    } else {
      // High-pass: C in series, L shunt to ground
      ctx.beginPath();
      ctx.moveTo(x + 20, cy);
      ctx.lineTo(cx - 30, cy);
      ctx.stroke();

      drawCapacitor(cx - 15, cy - 5, cy + 5);
      // Actually draw it horizontally
      ctx.beginPath();
      ctx.moveTo(cx + 15, cy);
      ctx.lineTo(x + w - 20, cy);
      ctx.stroke();

      // Inductor shunt
      const indX = cx + 15;
      ctx.beginPath();
      ctx.moveTo(indX, cy);
      ctx.lineTo(indX, cy + 10);
      ctx.stroke();
      drawInductorVertical(indX, cy + 10, 30);
      ctx.beginPath();
      ctx.moveTo(indX, cy + 40);
      ctx.lineTo(indX, cy + 50);
      ctx.stroke();
      drawGround(indX, cy + 50);

      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "center";
      ctx.fillText(`C=${capacitance}μF`, cx, cy - 15);
      ctx.fillStyle = "#10b981";
      ctx.fillText(`L=${inductance}μH`, cx + 40, cy + 30);
    }

    // Input/Output labels
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.fillText("IN", x + 5, cy - 5);
    ctx.textAlign = "right";
    ctx.fillText("OUT", x + w - 5, cy - 5);
  }

  function drawInductor(x: number, y: number, width: number) {
    ctx.beginPath();
    const bumps = 4;
    const bumpW = width / bumps;
    for (let i = 0; i < bumps; i++) {
      const bx = x + i * bumpW;
      ctx.arc(bx + bumpW / 2, y, bumpW / 2, Math.PI, 0, false);
    }
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawInductorVertical(x: number, y: number, height: number) {
    ctx.beginPath();
    const bumps = 3;
    const bumpH = height / bumps;
    for (let i = 0; i < bumps; i++) {
      const by = y + i * bumpH;
      ctx.arc(x, by + bumpH / 2, bumpH / 2, -Math.PI / 2, Math.PI / 2, false);
    }
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawCapacitor(x: number, y1: number, y2: number) {
    const gap = 6;
    const plateW = 20;
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    // Top plate
    ctx.beginPath();
    ctx.moveTo(x - plateW / 2, (y1 + y2) / 2 - gap / 2);
    ctx.lineTo(x + plateW / 2, (y1 + y2) / 2 - gap / 2);
    ctx.stroke();
    // Bottom plate
    ctx.beginPath();
    ctx.moveTo(x - plateW / 2, (y1 + y2) / 2 + gap / 2);
    ctx.lineTo(x + plateW / 2, (y1 + y2) / 2 + gap / 2);
    ctx.stroke();
  }

  function drawGround(x: number, y: number) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const w = 14 - i * 4;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y + i * 4);
      ctx.lineTo(x + w / 2, y + i * 4);
      ctx.stroke();
    }
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("LC Filter", W / 2, 28);

    const f0 = resonantFreq();
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Resonant frequency: f₀ = 1/(2π√LC) = ${f0.toFixed(1)} Hz`, W / 2, 48);

    // Circuit diagram
    drawCircuitDiagram(20, 60, W / 2 - 30, 130);

    // Frequency response curve
    const graphL = W / 2 + 10;
    const graphT = 60;
    const graphW2 = W / 2 - 30;
    const graphH2 = 130;

    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(graphL, graphT, graphW2, graphH2);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphL, graphT, graphW2, graphH2);

    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Frequency Response", graphL + graphW2 / 2, graphT + 14);

    // Draw response curve
    ctx.beginPath();
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    for (let i = 0; i <= graphW2 - 20; i++) {
      const fLog = 1 + (i / (graphW2 - 20)) * 4; // 10 Hz to 100kHz (log scale)
      const freq = Math.pow(10, fLog);
      const gain = calcGain(freq);
      const px = graphL + 10 + i;
      const py = graphT + graphH2 - 15 - gain * (graphH2 - 30);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Resonant freq marker
    const f0Log = Math.log10(f0);
    if (f0Log >= 1 && f0Log <= 5) {
      const f0x = graphL + 10 + ((f0Log - 1) / 4) * (graphW2 - 20);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(f0x, graphT + 15);
      ctx.lineTo(f0x, graphT + graphH2 - 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`f₀`, f0x, graphT + graphH2 - 3);
    }

    // Axis labels
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("10", graphL + 10, graphT + graphH2 - 3);
    ctx.fillText("1k", graphL + 10 + (graphW2 - 20) * 0.5, graphT + graphH2 - 3);
    ctx.fillText("100k Hz", graphL + graphW2 - 10, graphT + graphH2 - 3);

    // Waveform displays
    const gainLow = calcGain(freqLow);
    const gainHigh = calcGain(freqHigh);

    const waveY = 210;
    const waveH = 80;
    const waveW = (W - 60) / 4;

    // Input signals
    drawWaveform(15, waveY, waveW, waveH, freqLow, 1, "#fbbf24", `Input ${freqLow}Hz`);
    drawWaveform(15, waveY + waveH + 10, waveW, waveH, freqHigh, 1, "#f97316", `Input ${freqHigh}Hz`);

    // Arrow
    const arrowX = 15 + waveW + 10;
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("→", arrowX + 10, waveY + waveH + 5);

    // Output signals
    const outX = arrowX + 30;
    drawWaveform(outX, waveY, waveW, waveH, freqLow, gainLow, "#22d3ee", `Output ${freqLow}Hz (G=${gainLow.toFixed(2)})`);
    drawWaveform(outX, waveY + waveH + 10, waveW, waveH, freqHigh, gainHigh, "#06b6d4", `Output ${freqHigh}Hz (G=${gainHigh.toFixed(2)})`);

    // Combined input/output
    const combX = outX + waveW + 20;
    const combW = W - combX - 15;
    const combH = waveH * 2 + 10;

    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(combX, waveY, combW, combH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(combX, waveY, combW, combH);

    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Combined Output", combX + combW / 2, waveY + 14);

    ctx.beginPath();
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    for (let i = 0; i <= combW - 10; i++) {
      const t = (i / (combW - 10)) * 8 * Math.PI + time * 2;
      const valLow = Math.sin(t * freqLow / 500) * gainLow;
      const valHigh = Math.sin(t * freqHigh / 500) * gainHigh;
      const val = (valLow + valHigh) / 2;
      const py = waveY + combH / 2 - val * (combH * 0.35);
      if (i === 0) ctx.moveTo(combX + 5 + i, py);
      else ctx.lineTo(combX + 5 + i, py);
    }
    ctx.stroke();

    // Summary panel
    const panelY = waveY + combH + 20;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(15, panelY, W - 30, 80);

    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Filter Analysis", 25, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Type: ${filterType === 0 ? "Low-Pass" : "High-Pass"} | L = ${inductance} μH | C = ${capacitance} μF`, 25, panelY + 38);
    ctx.fillText(`Resonant freq: ${f0.toFixed(1)} Hz | Low freq gain: ${gainLow.toFixed(3)} | High freq gain: ${gainHigh.toFixed(3)}`, 25, panelY + 55);
    ctx.fillText(
      filterType === 0
        ? `Low-pass passes ${freqLow}Hz (${(gainLow * 100).toFixed(0)}%) and attenuates ${freqHigh}Hz (${(gainHigh * 100).toFixed(0)}%)`
        : `High-pass attenuates ${freqLow}Hz (${(gainLow * 100).toFixed(0)}%) and passes ${freqHigh}Hz (${(gainHigh * 100).toFixed(0)}%)`,
      25, panelY + 72
    );
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    const f0 = resonantFreq();
    const gLow = calcGain(freqLow);
    const gHigh = calcGain(freqHigh);
    return (
      `LC Filter: ${filterType === 0 ? "Low-Pass" : "High-Pass"} configuration. ` +
      `L=${inductance}μH, C=${capacitance}μF. Resonant freq: ${f0.toFixed(1)}Hz. ` +
      `${freqLow}Hz gain: ${gLow.toFixed(3)}, ${freqHigh}Hz gain: ${gHigh.toFixed(3)}. ` +
      `The filter passes frequencies ${filterType === 0 ? "below" : "above"} the resonant frequency.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LcFilterFactory;
