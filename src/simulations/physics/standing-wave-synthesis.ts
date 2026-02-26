import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StandingWaveSynthesisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("standing-wave-synthesis") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let wavelength = 100;
  let amplitude = 30;
  let speed = 2;
  let harmonicNumber = 1;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    wavelength = params.wavelength ?? 100;
    amplitude = params.amplitude ?? 30;
    speed = params.speed ?? 2;
    harmonicNumber = Math.round(params.harmonicNumber ?? 1);
    time += step;
  }

  function waveY(x: number, direction: number): number {
    // Traveling wave: y = A * sin(kx - wt) for +x direction
    // k = 2pi / lambda, w = 2pi * speed / lambda
    const k = (2 * Math.PI) / wavelength;
    const omega = k * speed * 60; // scale for visible animation
    return amplitude * Math.sin(k * x - direction * omega * time);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(1, "#121830");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Standing Wave Synthesis", width / 2, 22);

    const margin = 40;
    const usableW = width - 2 * margin;

    // Effective wavelength for harmonic: cavity fits n half-wavelengths
    const effectiveWavelength = (2 * usableW) / harmonicNumber;
    const k = (2 * Math.PI) / effectiveWavelength;
    const omega = k * speed * 60;

    // --- Top panel: Two traveling waves ---
    const topBaseY = height * 0.22;
    const midBaseY = height * 0.48;
    const botBaseY = height * 0.74;

    // Right-traveling wave (blue, dashed)
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(59,130,246,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= usableW; px++) {
      const x = margin + px;
      const y = topBaseY + amplitude * Math.sin(k * px - omega * time);
      if (px === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Left-traveling wave (red, dashed)
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(239,68,68,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= usableW; px++) {
      const x = margin + px;
      const y = topBaseY + amplitude * Math.sin(k * px + omega * time);
      if (px === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Equilibrium line
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, topBaseY);
    ctx.lineTo(width - margin, topBaseY);
    ctx.stroke();

    // Labels for top panel
    ctx.fillStyle = "rgba(59,130,246,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Right-traveling wave \u2192", margin, topBaseY - amplitude - 12);
    ctx.fillStyle = "rgba(239,68,68,0.8)";
    ctx.fillText("\u2190 Left-traveling wave", margin, topBaseY + amplitude + 20);

    // --- Middle panel: Superposition (standing wave) ---
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, midBaseY);
    ctx.lineTo(width - margin, midBaseY);
    ctx.stroke();

    // Standing wave envelope (max amplitude)
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let px = 0; px <= usableW; px++) {
      const x = margin + px;
      const env = 2 * amplitude * Math.abs(Math.sin(k * px));
      if (px === 0) ctx.moveTo(x, midBaseY - env);
      else ctx.lineTo(x, midBaseY - env);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let px = 0; px <= usableW; px++) {
      const x = margin + px;
      const env = 2 * amplitude * Math.abs(Math.sin(k * px));
      if (px === 0) ctx.moveTo(x, midBaseY + env);
      else ctx.lineTo(x, midBaseY + env);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Standing wave: y = 2A sin(kx) cos(wt)
    const standingGrad = ctx.createLinearGradient(margin, midBaseY - amplitude * 2, margin, midBaseY + amplitude * 2);
    standingGrad.addColorStop(0, "#a855f7");
    standingGrad.addColorStop(0.5, "#22c55e");
    standingGrad.addColorStop(1, "#a855f7");

    ctx.strokeStyle = standingGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let px = 0; px <= usableW; px++) {
      const x = margin + px;
      const y = midBaseY + 2 * amplitude * Math.sin(k * px) * Math.cos(omega * time);
      if (px === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Find and mark nodes and antinodes
    const nodes: number[] = [];
    const antinodes: number[] = [];
    for (let n = 0; n <= harmonicNumber; n++) {
      const nodeX = margin + (n * usableW) / harmonicNumber;
      if (nodeX >= margin && nodeX <= width - margin) {
        nodes.push(nodeX);
      }
    }
    for (let n = 0; n < harmonicNumber; n++) {
      const antiX = margin + ((n + 0.5) * usableW) / harmonicNumber;
      if (antiX >= margin && antiX <= width - margin) {
        antinodes.push(antiX);
      }
    }

    // Draw nodes
    for (const nx of nodes) {
      ctx.beginPath();
      ctx.arc(nx, midBaseY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239,68,68,0.8)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw antinodes
    for (const ax of antinodes) {
      ctx.beginPath();
      ctx.arc(ax, midBaseY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34,197,94,0.8)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Standing Wave (Superposition)", margin, midBaseY - amplitude * 2 - 10);

    // Legend for nodes/antinodes
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(239,68,68,0.8)";
    ctx.beginPath();
    ctx.arc(width - 150, midBaseY - amplitude * 2 - 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(" Node", width - 144, midBaseY - amplitude * 2 - 12);

    ctx.fillStyle = "rgba(34,197,94,0.8)";
    ctx.beginPath();
    ctx.arc(width - 150, midBaseY - amplitude * 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(" Antinode", width - 144, midBaseY - amplitude * 2 + 2);

    // --- Bottom panel: explanation ---
    ctx.save();
    const panelX = margin;
    const panelY = botBaseY - 10;
    const panelW = usableW;
    const panelH = height - panelY - 10;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Standing Wave Parameters", panelX + 12, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    const freq = speed * 60 / effectiveWavelength;
    ctx.fillText(`Harmonic n = ${harmonicNumber}`, panelX + 12, panelY + 40);
    ctx.fillText(`\u03BB_eff = ${effectiveWavelength.toFixed(1)} px  |  f = ${freq.toFixed(2)} Hz`, panelX + 12, panelY + 56);
    ctx.fillText(`Nodes: ${nodes.length}  |  Antinodes: ${antinodes.length}`, panelX + 12, panelY + 72);

    ctx.fillStyle = "rgba(200,200,255,0.5)";
    ctx.fillText("y(x,t) = 2A sin(kx) cos(\u03C9t)", panelX + 12, panelY + 92);
    ctx.fillText("Standing wave = two counter-propagating waves", panelX + 12, panelY + 108);

    // Boundary markers (fixed ends)
    ctx.fillStyle = "rgba(255,200,50,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Fixed", margin, midBaseY + amplitude * 2 + 18);
    ctx.fillText("Fixed", width - margin, midBaseY + amplitude * 2 + 18);
    ctx.restore();

    // Fixed end walls
    ctx.fillStyle = "rgba(120,140,170,0.7)";
    ctx.fillRect(margin - 4, midBaseY - amplitude * 2 - 5, 4, amplitude * 4 + 10);
    ctx.fillRect(width - margin, midBaseY - amplitude * 2 - 5, 4, amplitude * 4 + 10);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // cleanup
  }

  function getStateDescription(): string {
    const usableW = width - 80;
    const effectiveWavelength = (2 * usableW) / harmonicNumber;
    const freq = speed * 60 / effectiveWavelength;
    return (
      `Standing Wave Synthesis: harmonic n=${harmonicNumber}, \u03BB=${wavelength.toFixed(0)}px, ` +
      `amplitude=${amplitude}, speed=${speed}. Effective \u03BB=${effectiveWavelength.toFixed(1)}px, ` +
      `frequency=${freq.toFixed(2)}Hz. ${harmonicNumber + 1} nodes, ${harmonicNumber} antinodes. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StandingWaveSynthesisFactory;
