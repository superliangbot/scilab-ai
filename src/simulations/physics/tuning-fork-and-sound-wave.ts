import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface AirParticle {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
}

const TuningForkAndSoundWaveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("tuning-fork-and-sound-wave") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let frequency = 440;
  let amplitude = 1;
  let damping = 0.98;
  let showWaveform = 1;

  let particles: AirParticle[] = [];
  let forkAmplitude = 0;

  function createParticles(): void {
    particles = [];
    const rows = 12;
    const cols = 30;
    const startX = width * 0.3;
    const endX = width * 0.95;
    const startY = height * 0.25;
    const endY = height * 0.65;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = startX + (c / (cols - 1)) * (endX - startX);
        const by = startY + (r / (rows - 1)) * (endY - startY);
        particles.push({ baseX: bx, baseY: by, x: bx, y: by });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    forkAmplitude = 0;
    createParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    frequency = params.frequency ?? 440;
    amplitude = params.amplitude ?? 1;
    damping = params.damping ?? 0.98;
    showWaveform = Math.round(params.showWaveform ?? 1);

    forkAmplitude = amplitude;

    // Update air particles - longitudinal wave
    const waveSpeed = 200; // px/s
    const waveLength = waveSpeed / (frequency / 100);
    const omega = 2 * Math.PI * (frequency / 100);
    const k = 2 * Math.PI / waveLength;

    for (const p of particles) {
      const dist = p.baseX - width * 0.3;
      const displacement = amplitude * 8 * Math.sin(omega * time - k * dist);
      const dampFactor = Math.pow(damping, dist / 50);
      p.x = p.baseX + displacement * dampFactor;
      p.y = p.baseY;
    }

    time += dt;
  }

  function drawFork(): void {
    const forkX = width * 0.12;
    const forkY = height * 0.2;
    const forkH = height * 0.5;
    const prongW = 8;
    const gap = 20;

    const vibration = forkAmplitude * 4 * Math.sin(2 * Math.PI * (frequency / 100) * time);

    // Handle
    ctx.fillStyle = "#888";
    ctx.fillRect(forkX - 5, forkY + forkH * 0.6, 10 + gap, forkH * 0.4);

    // Left prong
    ctx.fillStyle = "#aaa";
    const leftX = forkX - vibration;
    ctx.beginPath();
    ctx.roundRect(leftX, forkY, prongW, forkH * 0.65, [4, 4, 0, 0]);
    ctx.fill();

    // Right prong
    const rightX = forkX + gap + vibration;
    ctx.beginPath();
    ctx.roundRect(rightX, forkY, prongW, forkH * 0.65, [4, 4, 0, 0]);
    ctx.fill();

    // Vibration lines
    ctx.save();
    ctx.globalAlpha = Math.abs(vibration) / (forkAmplitude * 4 + 0.01) * 0.5;
    ctx.strokeStyle = "#ffdd57";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const d = (i + 1) * 6;
      ctx.beginPath();
      ctx.arc(forkX + gap / 2, forkY + forkH * 0.3, prongW + gap / 2 + d, -0.5, 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(): void {
    for (const p of particles) {
      const dist = p.baseX - width * 0.3;
      const dampFactor = Math.pow(damping, dist / 50);
      const displacement = Math.abs(p.x - p.baseX);
      const density = 1 - displacement / (amplitude * 10 + 1);
      const alpha = 0.3 + density * 0.5 * dampFactor;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 180, 255, ${Math.max(0.1, Math.min(1, alpha))})`;
      ctx.fill();
    }
  }

  function drawWaveform(): void {
    if (!showWaveform) return;

    const graphY = height * 0.72;
    const graphH = height * 0.2;
    const graphX = width * 0.3;
    const graphW = width * 0.65;

    // Axis
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH / 2);
    ctx.lineTo(graphX + graphW, graphY + graphH / 2);
    ctx.stroke();

    // Wave
    const omega = 2 * Math.PI * (frequency / 100);
    const waveSpeed = 200;
    const waveLength = waveSpeed / (frequency / 100);
    const k = 2 * Math.PI / waveLength;

    ctx.beginPath();
    for (let i = 0; i <= graphW; i++) {
      const dist = i;
      const dampFactor = Math.pow(damping, dist / 50);
      const val = amplitude * Math.sin(omega * time - k * dist) * dampFactor;
      const gy = graphY + graphH / 2 - val * graphH * 0.4;
      if (i === 0) ctx.moveTo(graphX + i, gy);
      else ctx.lineTo(graphX + i, gy);
    }
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Displacement", graphX, graphY - 4);
    ctx.fillText("Compression", graphX + graphW + 5, graphY + graphH / 2 - graphH * 0.35);
    ctx.fillText("Rarefaction", graphX + graphW + 5, graphY + graphH / 2 + graphH * 0.35);
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a2e");
    bg.addColorStop(1, "#151530");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Tuning Fork & Sound Wave", width / 2, 22);

    drawFork();
    drawParticles();
    drawWaveform();

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(10, height - 50, 250, 40, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Frequency: ${frequency} Hz | Longitudinal wave`, 20, height - 32);
    ctx.fillText("Compressions (dense) ↔ Rarefactions (sparse)", 20, height - 18);
  }

  function reset(): void {
    time = 0;
    forkAmplitude = 0;
    createParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    return (
      `Tuning Fork & Sound Wave: frequency=${frequency}Hz, amplitude=${amplitude}, ` +
      `damping=${damping}. Showing ${particles.length} air particles demonstrating ` +
      `longitudinal wave propagation. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TuningForkAndSoundWaveFactory;
