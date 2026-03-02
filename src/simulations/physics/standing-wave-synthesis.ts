import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Standing Wave Synthesis
 * Demonstrates:
 * - Standing wave formation from superposition of traveling waves
 * - Spring-based wave propagation on a 1D chain
 * - Nodes and antinodes from boundary reflections
 * - Frequency control of driven oscillation
 */

const StandingWaveSynthesisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("standing-wave-synthesis") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 1.0;
  let damping = 0.998;
  let amplitude = 40;
  let showTrace = 1;

  // Wave medium: chain of coupled points
  const N = 120;
  let y: number[] = [];
  let vy: number[] = [];
  let traceY: number[][] = []; // past positions for trace
  const maxTrace = 40;

  // Spring constant between neighbors
  const springK = 0.4;

  function initMedium(): void {
    y = new Array(N).fill(0);
    vy = new Array(N).fill(0);
    traceY = [];
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initMedium();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    frequency = params.frequency ?? 1.0;
    damping = params.damping ?? 0.998;
    amplitude = params.amplitude ?? 40;
    showTrace = params.showTrace ?? 1;

    // Sub-step physics for stability
    const subSteps = 8;
    const subDt = step / subSteps;

    for (let s = 0; s < subSteps; s++) {
      time += subDt;

      // Drive left endpoint
      y[0] = amplitude * Math.sin(2 * Math.PI * frequency * time);
      vy[0] = 0;

      // Fixed right endpoint (reflection boundary)
      y[N - 1] = 0;
      vy[N - 1] = 0;

      // Spring forces between neighbors
      for (let i = 1; i < N - 1; i++) {
        const forceLeft = springK * (y[i - 1] - y[i]);
        const forceRight = springK * (y[i + 1] - y[i]);
        vy[i] += (forceLeft + forceRight);
        vy[i] *= damping;
      }

      // Update positions
      for (let i = 1; i < N - 1; i++) {
        y[i] += vy[i];
      }
    }

    // Store trace
    if (showTrace > 0.5) {
      traceY.push([...y]);
      if (traceY.length > maxTrace) {
        traceY.shift();
      }
    } else {
      traceY = [];
    }
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Standing Wave Synthesis", width / 2, 30);

    const margin = width * 0.08;
    const waveWidth = width - 2 * margin;
    const baseY = height * 0.45;
    const dx = waveWidth / (N - 1);

    // Draw fixed endpoints
    drawBoundary(margin, baseY, "Driver");
    drawBoundary(margin + waveWidth, baseY, "Fixed");

    // Draw trace (past wave positions fading out)
    if (showTrace > 0.5 && traceY.length > 0) {
      for (let t = 0; t < traceY.length; t++) {
        const alpha = 0.03 + 0.12 * (t / traceY.length);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < N; i++) {
          const x = margin + i * dx;
          const py = baseY - traceY[t][i];
          if (i === 0) ctx.moveTo(x, py);
          else ctx.lineTo(x, py);
        }
        ctx.stroke();
      }
    }

    // Draw the current wave
    const waveGrad = ctx.createLinearGradient(margin, baseY - amplitude, margin + waveWidth, baseY + amplitude);
    waveGrad.addColorStop(0, "#818cf8");
    waveGrad.addColorStop(0.5, "#c084fc");
    waveGrad.addColorStop(1, "#818cf8");

    // Glow
    ctx.beginPath();
    ctx.strokeStyle = "rgba(129, 140, 248, 0.2)";
    ctx.lineWidth = 8;
    for (let i = 0; i < N; i++) {
      const x = margin + i * dx;
      const py = baseY - y[i];
      if (i === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();

    // Main wave line
    ctx.beginPath();
    ctx.strokeStyle = waveGrad;
    ctx.lineWidth = 3;
    for (let i = 0; i < N; i++) {
      const x = margin + i * dx;
      const py = baseY - y[i];
      if (i === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.stroke();

    // Draw particles on the wave
    for (let i = 0; i < N; i += 3) {
      const x = margin + i * dx;
      const py = baseY - y[i];
      const speed = Math.abs(vy[i] || 0);
      const r = 2 + Math.min(speed * 0.3, 3);
      ctx.beginPath();
      ctx.arc(x, py, r, 0, Math.PI * 2);
      ctx.fillStyle = speed > 2 ? "#f472b6" : "#818cf8";
      ctx.fill();
    }

    // Equilibrium line
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(margin, baseY);
    ctx.lineTo(margin + waveWidth, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Detect and mark nodes (points with small max displacement)
    drawNodeDetection(margin, waveWidth, baseY, dx);

    // Info panel
    drawInfoPanel();

    // Explanation at bottom
    drawExplanation();
  }

  function drawBoundary(x: number, y: number, label: string): void {
    // Vertical bar
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(x - 3, y - 30, 6, 60);

    // Hatching
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    for (let i = -25; i <= 25; i += 5) {
      ctx.beginPath();
      ctx.moveTo(x - 3, y + i);
      ctx.lineTo(x - 10, y + i + 5);
      ctx.stroke();
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y + 50);
  }

  function drawNodeDetection(margin: number, waveWidth: number, baseY: number, dx: number): void {
    if (traceY.length < 20) return;

    // Find nodes: points where max displacement over recent frames is small
    const recent = traceY.slice(-20);
    for (let i = 5; i < N - 5; i++) {
      let maxDisp = 0;
      for (const frame of recent) {
        maxDisp = Math.max(maxDisp, Math.abs(frame[i]));
      }
      if (maxDisp < amplitude * 0.08) {
        const x = margin + i * dx;
        ctx.beginPath();
        ctx.arc(x, baseY, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(244, 63, 94, 0.6)";
        ctx.fill();
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  function drawInfoPanel(): void {
    const panelX = width - 260;
    const panelY = 50;
    const panelW = 240;
    const panelH = 140;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Wave Parameters", panelX + 12, panelY + 22);

    const waveSpeed = Math.sqrt(springK) * (width * 0.84 / (N - 1));
    const wavelength = waveSpeed / Math.max(frequency, 0.01);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    const lines = [
      `Drive frequency: ${frequency.toFixed(2)} Hz`,
      `Damping: ${damping.toFixed(4)}`,
      `Amplitude: ${amplitude.toFixed(0)} px`,
      `Points in medium: ${N}`,
      `Spring constant: k = ${springK}`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, panelX + 12, panelY + 45 + i * 18);
    });
  }

  function drawExplanation(): void {
    const y0 = height - 60;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(15, y0, width - 30, 50, 6);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "A wave driven from the left reflects off the fixed right boundary. The superposition of incident and reflected",
      width / 2, y0 + 18
    );
    ctx.fillText(
      "waves creates a standing wave pattern with stationary nodes (red dots) and oscillating antinodes.",
      width / 2, y0 + 35
    );
  }

  function reset(): void {
    time = 0;
    initMedium();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Standing wave synthesis: frequency=${frequency.toFixed(2)}Hz, damping=${damping}, amplitude=${amplitude}px. ` +
      `${N} coupled points with spring constant k=${springK}. Left endpoint driven sinusoidally, right endpoint fixed. ` +
      `Standing waves form from superposition of incident and reflected traveling waves. ` +
      `Nodes appear where destructive interference creates zero displacement.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StandingWaveSynthesisFactory;
