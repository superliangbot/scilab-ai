import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RectifierCircuitFactory = (): SimulationEngine => {
  const config = getSimConfig("rectifier-circuit") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};

  // Waveform history buffers
  let inputHistory: number[] = [];
  let outputHistory: number[] = [];
  const maxHistory = 300;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    inputHistory = [];
    outputHistory = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    time += dt;

    const freq = params.acFrequency ?? 3;
    const amp = params.acAmplitude ?? 5;
    const rectType = Math.round(params.rectifierType ?? 0);
    const smoothing = params.smoothing ?? 0;

    // AC input voltage
    const vIn = amp * Math.sin(2 * Math.PI * freq * time);

    // Rectified output
    let vOut: number;
    if (rectType === 0) {
      // Half-wave: only positive half passes
      vOut = vIn > 0 ? vIn : 0;
    } else {
      // Full-wave: negative half is flipped
      vOut = Math.abs(vIn);
    }

    // Apply smoothing capacitor effect (simple RC filter simulation)
    if (smoothing > 0 && outputHistory.length > 0) {
      const tau = smoothing * 0.002; // Time constant from capacitance
      const prevOut = outputHistory[outputHistory.length - 1];
      if (vOut >= prevOut) {
        // Capacitor charges to peak
        // noop: use vOut directly
      } else {
        // Capacitor discharges exponentially
        vOut = prevOut * Math.exp(-dt / Math.max(tau, 0.001));
        if (vOut < 0) vOut = 0;
      }
    }

    inputHistory.push(vIn);
    outputHistory.push(vOut);

    if (inputHistory.length > maxHistory) {
      inputHistory.shift();
      outputHistory.shift();
    }
  }

  function drawDiode(cx: number, cy: number, angle: number, size: number): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Triangle
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.7);
    ctx.lineTo(size, 0);
    ctx.lineTo(-size, size * 0.7);
    ctx.closePath();
    ctx.fillStyle = "rgba(245, 158, 11, 0.3)";
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bar (cathode)
    ctx.beginPath();
    ctx.moveTo(size, -size * 0.7);
    ctx.lineTo(size, size * 0.7);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Leads
    ctx.beginPath();
    ctx.moveTo(-size - size * 0.6, 0);
    ctx.lineTo(-size, 0);
    ctx.moveTo(size, 0);
    ctx.lineTo(size + size * 0.6, 0);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return;
    const ux = dx / len, uy = dy / len;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const h = 8;
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * ux + h * 0.4 * uy, y2 - h * uy - h * 0.4 * ux);
    ctx.lineTo(x2 - h * ux - h * 0.4 * uy, y2 - h * uy + h * 0.4 * ux);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }

  function drawWaveform(
    history: number[],
    ox: number, oy: number, w: number, h: number,
    amp: number, color: string, label: string
  ): void {
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(ox, oy, w, h);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, w, h);

    // Zero line
    const midY = oy + h / 2;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ox, midY);
    ctx.lineTo(ox + w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(11, width * 0.015)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, ox + w / 2, oy - 6);

    // Waveform
    if (history.length < 2) return;
    const scale = (h * 0.4) / Math.max(amp, 0.1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = ox + (i / maxHistory) * w;
      const y = midY - history[i] * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`+${amp.toFixed(1)}V`, ox + 3, oy + 14);
    ctx.fillText(`-${amp.toFixed(1)}V`, ox + 3, oy + h - 5);
    ctx.fillText("0V", ox + 3, midY - 3);
  }

  function drawCircuitDiagram(): void {
    const rectType = Math.round(currentParams.rectifierType ?? 0);
    const cx = width / 2;
    const cy = height * 0.28;
    const boxW = width * 0.35;
    const boxH = height * 0.2;

    // Circuit box
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.setLineDash([]);

    // AC source symbol (left side)
    const acX = cx - boxW / 2 - 40;
    const acY = cy;
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(acX, acY, 15, 0, Math.PI * 2);
    ctx.stroke();
    // Sine wave inside
    ctx.beginPath();
    for (let i = -10; i <= 10; i++) {
      const px = acX + i;
      const py = acY - 5 * Math.sin((i / 10) * Math.PI);
      if (i === -10) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#60a5fa";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("AC", acX, acY - 22);

    // Wires from AC to circuit
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(acX + 15, acY - 8);
    ctx.lineTo(cx - boxW / 2, cy - boxH * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(acX + 15, acY + 8);
    ctx.lineTo(cx - boxW / 2, cy + boxH * 0.3);
    ctx.stroke();

    // Load resistor (right side)
    const ldX = cx + boxW / 2 + 40;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + boxW / 2, cy - boxH * 0.3);
    ctx.lineTo(ldX, cy - boxH * 0.3);
    ctx.lineTo(ldX, cy - 12);
    ctx.stroke();
    // Resistor zigzag
    ctx.beginPath();
    ctx.moveTo(ldX, cy - 12);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(ldX + (i % 2 === 0 ? 8 : -8), cy - 12 + (i + 1) * 5);
      }
    ctx.lineTo(ldX, cy + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ldX, cy + 15);
    ctx.lineTo(ldX, cy + boxH * 0.3);
    ctx.lineTo(cx + boxW / 2, cy + boxH * 0.3);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Load", ldX + 18, cy + 4);

    // Diodes inside circuit
    if (rectType === 0) {
      // Half-wave: single diode
      drawDiode(cx, cy, 0, 14);
      ctx.fillStyle = "#f59e0b";
      ctx.font = `bold ${Math.max(11, width * 0.014)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Half-Wave Rectifier", cx, cy - boxH / 2 - 10);
    } else {
      // Full-wave: 4 diodes in bridge
      const ds = 10;
      const spread = boxH * 0.25;
      drawDiode(cx - ds * 2, cy - spread, Math.PI / 4, 10);
      drawDiode(cx + ds * 2, cy - spread, -Math.PI / 4, 10);
      drawDiode(cx - ds * 2, cy + spread, -Math.PI / 4, 10);
      drawDiode(cx + ds * 2, cy + spread, Math.PI / 4, 10);
      ctx.fillStyle = "#f59e0b";
      ctx.font = `bold ${Math.max(11, width * 0.014)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Full-Wave Bridge Rectifier", cx, cy - boxH / 2 - 10);
    }

    // Current direction arrows (animate)
    const acAmp = currentParams.acAmplitude ?? 5;
    const freq = currentParams.acFrequency ?? 3;
    const vIn = acAmp * Math.sin(2 * Math.PI * freq * time);
    const flowing = rectType === 0 ? vIn > 0 : true;

    if (flowing && Math.abs(vIn) > 0.2) {
      const arrowColor = "#22c55e";
      const phase = (time * 3) % 1;
      // Top wire arrow
      const topWireY = cy - boxH * 0.3;
      const ax = cx - boxW / 2 + phase * boxW;
      drawArrow(ax - 15, topWireY, ax + 15, topWireY, arrowColor);
    }

    // Smoothing capacitor indicator
    const smoothing = currentParams.smoothing ?? 0;
    if (smoothing > 0) {
      const capX = ldX + 30, capY = cy;
      ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(capX, capY - 12); ctx.lineTo(capX, capY - 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(capX - 8, capY - 3); ctx.lineTo(capX + 8, capY - 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(capX - 8, capY + 3); ctx.lineTo(capX + 8, capY + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(capX, capY + 3); ctx.lineTo(capX, capY + 12); ctx.stroke();
      ctx.fillStyle = "#a78bfa";
      ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`C=${smoothing.toFixed(0)} uF`, capX, capY + 24);
    }
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const amp = currentParams.acAmplitude ?? 5;
    const freq = currentParams.acFrequency ?? 3;
    const rectType = Math.round(currentParams.rectifierType ?? 0);
    const smoothing = currentParams.smoothing ?? 0;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Rectifier Circuit - AC to DC Conversion", width / 2, 26);

    // Draw circuit diagram in upper portion
    drawCircuitDiagram();

    // Waveforms in lower portion
    const wfW = width * 0.4;
    const wfH = height * 0.32;
    const wfY = height * 0.58;
    const gap = width * 0.05;

    // AC input waveform (left)
    drawWaveform(inputHistory, gap, wfY, wfW, wfH, amp, "#60a5fa", "AC Input");

    // DC output waveform (right)
    const outLabel = smoothing > 0
      ? `DC Output (smoothed ${smoothing.toFixed(0)} uF)`
      : `DC Output (${rectType === 0 ? "half" : "full"}-wave)`;
    drawWaveform(outputHistory, width - gap - wfW, wfY, wfW, wfH, amp, "#f59e0b", outLabel);

    // Info panel
    const infoY = height * 0.92;
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    const vIn = amp * Math.sin(2 * Math.PI * freq * time);
    let vOut = rectType === 0 ? (vIn > 0 ? vIn : 0) : Math.abs(vIn);
    if (outputHistory.length > 0) vOut = outputHistory[outputHistory.length - 1];
    ctx.fillText(`Freq: ${freq.toFixed(1)} Hz | Amp: ${amp.toFixed(1)} V | V_in: ${vIn.toFixed(2)} V | V_out: ${vOut.toFixed(2)} V`, width / 2, infoY);

    // Legend
    const legX = width * 0.38, legY = height * 0.95;
    ctx.font = `${Math.max(9, width * 0.011)}px sans-serif`; ctx.textAlign = "center";
    ctx.fillStyle = "#60a5fa"; ctx.fillText("Blue = AC Input", legX, legY);
    ctx.fillStyle = "#f59e0b"; ctx.fillText("Orange = DC Output", width - legX, legY);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
    inputHistory = [];
    outputHistory = [];
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const freq = currentParams.acFrequency ?? 3;
    const amp = currentParams.acAmplitude ?? 5;
    const rectType = Math.round(currentParams.rectifierType ?? 0);
    const smoothing = currentParams.smoothing ?? 0;
    const typeName = rectType === 0 ? "half-wave" : "full-wave bridge";

    return (
      `Rectifier circuit simulation showing a ${typeName} rectifier converting AC to DC. ` +
      `AC input: ${freq.toFixed(1)} Hz at ${amp.toFixed(1)} V amplitude. ` +
      `${rectType === 0
        ? "In half-wave rectification, a single diode blocks the negative half-cycle, passing only positive voltages. This wastes half the input energy and produces a pulsating DC output."
        : "In full-wave bridge rectification, four diodes arranged in a bridge configuration redirect both halves of the AC cycle to produce positive output. This is more efficient than half-wave."} ` +
      `${smoothing > 0
        ? `A smoothing capacitor (${smoothing.toFixed(0)} uF) is connected across the load. It charges during voltage peaks and discharges during dips, reducing ripple and producing a steadier DC voltage. Larger capacitance means smoother output.`
        : "No smoothing capacitor is applied, so the output has significant ripple (pulsating DC)."}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RectifierCircuitFactory;
