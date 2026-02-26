import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Standing Waves on a Vibrating String
 * Demonstrates:
 * - Standing wave harmonics on a string fixed at both ends
 * - Nodes and antinodes
 * - Frequency formula f_n = n/(2L) * sqrt(T/mu)
 * - Animated oscillation of harmonic modes
 */

const StandingWavesOnAStringFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("standing-waves-on-a-string") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let harmonicNumber = 1;
  let tension = 10;
  let stringLength = 300;
  let amplitude = 30;

  // Physics constants
  const linearDensity = 0.01; // kg/m (mu)

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    harmonicNumber = Math.round(params.harmonicNumber ?? 1);
    tension = params.tension ?? 10;
    stringLength = params.stringLength ?? 300;
    amplitude = params.amplitude ?? 30;
    time += step;
  }

  function getFrequency(n: number): number {
    const L = stringLength / 100; // convert px to "meters" for display
    const v = Math.sqrt(tension / linearDensity);
    return (n / (2 * L)) * v;
  }

  function getWaveSpeed(): number {
    return Math.sqrt(tension / linearDensity);
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Standing Waves on a String", width / 2, 30);

    const n = harmonicNumber;
    const L = stringLength;
    const cx = width / 2;
    const baseY = height * 0.38;
    const startX = cx - L / 2;
    const endX = cx + L / 2;

    // Draw fixed supports
    drawSupport(startX, baseY);
    drawSupport(endX, baseY);

    // Draw the vibrating string
    const waveSpeed = getWaveSpeed();
    const freq = getFrequency(n);
    const omega = 2 * Math.PI * freq;
    const segments = 300;

    // Envelope (faint)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const x = startX + frac * L;
      const env = amplitude * Math.sin(n * Math.PI * frac);
      if (i === 0) ctx.moveTo(x, baseY - env);
      else ctx.lineTo(x, baseY - env);
    }
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const x = startX + frac * L;
      const env = -amplitude * Math.sin(n * Math.PI * frac);
      if (i === 0) ctx.moveTo(x, baseY - env);
      else ctx.lineTo(x, baseY - env);
    }
    ctx.stroke();

    // The wave itself: y(x,t) = A * sin(n*pi*x/L) * cos(omega*t)
    const waveGrad = ctx.createLinearGradient(startX, baseY - amplitude, endX, baseY + amplitude);
    waveGrad.addColorStop(0, "#818cf8");
    waveGrad.addColorStop(0.5, "#c084fc");
    waveGrad.addColorStop(1, "#818cf8");

    ctx.beginPath();
    ctx.strokeStyle = waveGrad;
    ctx.lineWidth = 3;
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const x = startX + frac * L;
      const y = amplitude * Math.sin(n * Math.PI * frac) * Math.cos(omega * time);
      if (i === 0) ctx.moveTo(x, baseY - y);
      else ctx.lineTo(x, baseY - y);
    }
    ctx.stroke();

    // Glow effect
    ctx.beginPath();
    ctx.strokeStyle = "rgba(129, 140, 248, 0.25)";
    ctx.lineWidth = 8;
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const x = startX + frac * L;
      const y = amplitude * Math.sin(n * Math.PI * frac) * Math.cos(omega * time);
      if (i === 0) ctx.moveTo(x, baseY - y);
      else ctx.lineTo(x, baseY - y);
    }
    ctx.stroke();

    // Draw nodes (fixed points where displacement = 0)
    for (let k = 0; k <= n; k++) {
      const xNode = startX + (k / n) * L;
      ctx.beginPath();
      ctx.arc(xNode, baseY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#f43f5e";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#f43f5e";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", xNode, baseY + 20);
    }

    // Draw antinodes (max displacement points, halfway between nodes)
    for (let k = 0; k < n; k++) {
      const xAnti = startX + ((k + 0.5) / n) * L;
      const currentDisp = amplitude * Math.cos(omega * time);
      const yAnti = baseY - Math.sin((k + 0.5) * Math.PI) * currentDisp;

      ctx.beginPath();
      ctx.arc(xAnti, yAnti, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22d3ee";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#22d3ee";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("A", xAnti, baseY + 32);
    }

    // Labels for string length
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(startX, baseY + 45);
    ctx.lineTo(endX, baseY + 45);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`L = ${(stringLength / 100).toFixed(1)} m`, cx, baseY + 60);

    // Information panel
    drawInfoPanel(startX, baseY);

    // Harmonic mode visualization (small multiples at bottom)
    drawHarmonicChart(cx, baseY);

    // Legend
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f43f5e";
    ctx.fillText("N = Node (zero displacement)", 15, height - 35);
    ctx.fillStyle = "#22d3ee";
    ctx.fillText("A = Antinode (max displacement)", 15, height - 18);
  }

  function drawSupport(x: number, y: number): void {
    // Triangle support
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 10, y + 20);
    ctx.lineTo(x + 10, y + 20);
    ctx.closePath();
    const grad = ctx.createLinearGradient(x - 10, y, x + 10, y + 20);
    grad.addColorStop(0, "#6b7280");
    grad.addColorStop(1, "#374151");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hatching on base
    ctx.strokeStyle = "rgba(107, 114, 128, 0.5)";
    ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i += 4) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 20);
      ctx.lineTo(x + i - 4, y + 26);
      ctx.stroke();
    }
  }

  function drawInfoPanel(startX: number, baseY: number): void {
    const panelX = width - 280;
    const panelY = 50;
    const panelW = 260;
    const panelH = 180;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const n = harmonicNumber;
    const L = stringLength / 100;
    const v = getWaveSpeed();
    const freq = n * v / (2 * L);
    const wavelength = 2 * L / n;

    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Standing Wave Parameters", panelX + 12, panelY + 22);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    const lines = [
      `Harmonic number: n = ${n}`,
      `Tension: T = ${tension.toFixed(1)} N`,
      `Linear density: \u03BC = ${linearDensity} kg/m`,
      `Wave speed: v = \u221A(T/\u03BC) = ${v.toFixed(1)} m/s`,
      `Frequency: f${n} = ${freq.toFixed(2)} Hz`,
      `Wavelength: \u03BB${n} = 2L/${n} = ${wavelength.toFixed(3)} m`,
      `Nodes: ${n + 1}  |  Antinodes: ${n}`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, panelX + 12, panelY + 45 + i * 19);
    });

    // Formula
    ctx.fillStyle = "#fbbf24";
    ctx.font = "italic 12px system-ui, sans-serif";
    ctx.fillText("f_n = n/(2L) \u00B7 \u221A(T/\u03BC)", panelX + 12, panelY + panelH - 8);
  }

  function drawHarmonicChart(cx: number, baseY: number): void {
    const chartY = height * 0.7;
    const chartH = height * 0.22;
    const chartW = width * 0.8;
    const chartX = (width - chartW) / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(chartX, chartY, chartW, chartH, 8);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("First 8 Harmonics", cx, chartY + 16);

    const miniW = (chartW - 40) / 8;
    const miniH = chartH - 40;
    const miniY = chartY + 25;

    for (let h = 1; h <= 8; h++) {
      const mx = chartX + 20 + (h - 1) * miniW;
      const myCtr = miniY + miniH / 2;
      const isActive = h === harmonicNumber;

      // Highlight active harmonic
      if (isActive) {
        ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
        ctx.beginPath();
        ctx.roundRect(mx, miniY, miniW - 4, miniH, 4);
        ctx.fill();
        ctx.strokeStyle = "#818cf8";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw small waveform
      ctx.beginPath();
      ctx.strokeStyle = isActive ? "#c084fc" : "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = isActive ? 2 : 1;
      const segs = 60;
      const amp = (miniH / 2 - 8) * 0.8;
      for (let i = 0; i <= segs; i++) {
        const frac = i / segs;
        const x = mx + 2 + frac * (miniW - 8);
        const y = myCtr - amp * Math.sin(h * Math.PI * frac) * Math.cos(2 * Math.PI * getFrequency(h) * time);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Label
      ctx.fillStyle = isActive ? "#c084fc" : "#64748b";
      ctx.font = `${isActive ? "bold " : ""}10px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`n=${h}`, mx + miniW / 2 - 2, miniY + miniH + 10);
    }
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const n = harmonicNumber;
    const L = stringLength / 100;
    const v = getWaveSpeed();
    const freq = n * v / (2 * L);
    return (
      `Standing wave: harmonic n=${n}, tension=${tension}N, string length=${L}m, amplitude=${amplitude}px. ` +
      `Wave speed v=${v.toFixed(1)}m/s, frequency f${n}=${freq.toFixed(2)}Hz, ${n + 1} nodes, ${n} antinodes. ` +
      `Formula: f_n = n/(2L)*sqrt(T/mu). The string vibrates in its ${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} harmonic mode.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StandingWavesOnAStringFactory;
