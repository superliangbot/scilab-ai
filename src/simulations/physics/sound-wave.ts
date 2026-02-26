import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Sound Wave: Longitudinal wave visualisation
 * Shows compression and rarefaction of air molecules emitted by a speaker,
 * with a corresponding pressure graph below.
 * Key physics: v = f*lambda, pressure variation P(x,t) = P0*sin(kx - wt)
 */

const SoundWaveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sound-wave") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters (updated each frame)
  let frequency = 3;
  let amplitude = 0.5;
  let speed = 150;
  let showPressure = 1;

  // Particle grid
  const NUM_ROWS = 12;
  const NUM_COLS = 60;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    frequency = params.frequency ?? 3;
    amplitude = params.amplitude ?? 0.5;
    speed = params.speed ?? 150;
    showPressure = params.showPressure ?? 1;
    time += dt;
  }

  /** Compute particle displacement at position x for current time */
  function displacement(x: number): number {
    const wavelength = speed / frequency;
    const k = (2 * Math.PI) / wavelength; // wave number
    const omega = 2 * Math.PI * frequency;
    // Longitudinal displacement: s = A * cos(kx - wt)
    return amplitude * 30 * Math.cos(k * x - omega * time);
  }

  /** Pressure is proportional to -ds/dx (spatial derivative of displacement) */
  function pressure(x: number): number {
    const wavelength = speed / frequency;
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * frequency;
    // P ~ A * k * sin(kx - wt)  (derivative of cos is -sin, times -1 from the negative)
    return amplitude * k * 30 * Math.sin(k * x - omega * time);
  }

  function drawSpeaker(): void {
    const sx = width * 0.04;
    const sy = height * 0.25;
    const sw = 30;
    const sh = 80;

    // Speaker body
    ctx.fillStyle = "#475569";
    ctx.fillRect(sx, sy - sh / 2, sw * 0.4, sh);

    // Cone
    const coneDisp = amplitude * 6 * Math.sin(2 * Math.PI * frequency * time);
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.4, sy - sh / 2);
    ctx.lineTo(sx + sw + coneDisp, sy - sh * 0.7);
    ctx.lineTo(sx + sw + coneDisp, sy + sh * 0.7);
    ctx.lineTo(sx + sw * 0.4, sy + sh / 2);
    ctx.closePath();
    ctx.fillStyle = "#94a3b8";
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Emanating arcs
    const arcX = sx + sw + coneDisp + 5;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 3; i++) {
      const r = 8 * i + 4 * Math.sin(2 * Math.PI * frequency * time - i * 0.5);
      ctx.beginPath();
      ctx.arc(arcX, sy, r, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Speaker", sx + sw / 2, sy + sh / 2 + 18);
  }

  function drawParticles(): void {
    const regionTop = height * 0.08;
    const regionBottom = showPressure ? height * 0.45 : height * 0.7;
    const regionLeft = width * 0.12;
    const regionRight = width * 0.95;
    const regionW = regionRight - regionLeft;
    const regionH = regionBottom - regionTop;

    const rowSpacing = regionH / (NUM_ROWS + 1);
    const colSpacing = regionW / NUM_COLS;

    for (let row = 0; row < NUM_ROWS; row++) {
      const baseY = regionTop + (row + 1) * rowSpacing;
      for (let col = 0; col < NUM_COLS; col++) {
        const baseX = regionLeft + col * colSpacing;
        // Each particle displaces along x (longitudinal)
        const dx = displacement(col * colSpacing);
        const px = baseX + dx;
        const py = baseY + (Math.random() - 0.5) * 0.4; // tiny vertical jitter for realism

        // Colour: blue when compressed (neighbours close), red when rarefied (spread)
        const p = pressure(col * colSpacing);
        const maxP = amplitude * (2 * Math.PI * frequency / speed) * 30;
        const normP = Math.max(-1, Math.min(1, p / (maxP + 0.001)));

        let r: number, g: number, b: number;
        if (normP > 0) {
          // compression -> cyan-white
          r = Math.floor(100 + 155 * normP);
          g = Math.floor(180 + 75 * normP);
          b = 255;
        } else {
          // rarefaction -> dark blue
          const t = -normP;
          r = Math.floor(100 * (1 - t));
          g = Math.floor(180 * (1 - t * 0.7));
          b = Math.floor(255 * (1 - t * 0.4));
        }

        const radius = 2.5 + 1.2 * Math.max(0, normP); // bigger in compression
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      }
    }

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Air Molecules (Longitudinal Wave)", (regionLeft + regionRight) / 2, regionTop - 8);

    // Compression / rarefaction annotations
    const wavelength = speed / frequency;
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * frequency;
    const midRow = regionTop + regionH / 2;
    for (let i = 0; i < 3; i++) {
      // Find compression peaks: kx - wt = n*2*PI => x = (wt + n*2PI)/k
      const xPhys = (omega * time + i * 2 * Math.PI) / k;
      const screenX = regionLeft + xPhys;
      if (screenX > regionLeft + 30 && screenX < regionRight - 30) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.5)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("C", screenX, regionBottom + 12);
      }
      // Rarefaction at half-wavelength offset
      const xRare = (omega * time + (i + 0.5) * 2 * Math.PI) / k;
      const screenXR = regionLeft + xRare;
      if (screenXR > regionLeft + 30 && screenXR < regionRight - 30) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.5)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("R", screenXR, regionBottom + 12);
      }
    }
  }

  function drawPressureGraph(): void {
    if (!showPressure) return;

    const graphLeft = width * 0.12;
    const graphRight = width * 0.95;
    const graphTop = height * 0.55;
    const graphBottom = height * 0.9;
    const graphW = graphRight - graphLeft;
    const graphH = graphBottom - graphTop;
    const midY = graphTop + graphH / 2;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(graphLeft - 10, graphTop - 20, graphW + 20, graphH + 35, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pressure Variation vs Position", (graphLeft + graphRight) / 2, graphTop - 5);

    // Axes
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphLeft, midY);
    ctx.lineTo(graphRight, midY);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("+P", graphLeft - 5, graphTop + 15);
    ctx.fillText("0", graphLeft - 5, midY + 4);
    ctx.fillText("-P", graphLeft - 5, graphBottom - 5);
    ctx.textAlign = "center";
    ctx.fillText("Position (x)", (graphLeft + graphRight) / 2, graphBottom + 15);

    // Pressure curve
    const colSpacing = graphW / NUM_COLS;
    const maxP = amplitude * (2 * Math.PI * frequency / speed) * 30;

    ctx.beginPath();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 200; i++) {
      const frac = i / 200;
      const x = frac * graphW;
      const xPhys = frac * NUM_COLS * colSpacing;
      const p = pressure(xPhys);
      const normP = p / (maxP + 0.001);
      const screenY = midY - normP * graphH * 0.42;
      if (i === 0) ctx.moveTo(graphLeft + x, screenY);
      else ctx.lineTo(graphLeft + x, screenY);
    }
    ctx.stroke();

    // Fill under curve
    ctx.globalAlpha = 0.1;
    ctx.lineTo(graphRight, midY);
    ctx.lineTo(graphLeft, midY);
    ctx.closePath();
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawInfoPanel(): void {
    const px = width * 0.02;
    const py = height * 0.92;
    const wavelength = speed / frequency;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(px, py - 5, width * 0.96, 35, 6);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    const info = `f = ${frequency.toFixed(1)} Hz  |  v = ${speed.toFixed(0)} px/s  |  ` +
      `\u03BB = v/f = ${wavelength.toFixed(1)} px  |  A = ${amplitude.toFixed(2)}  |  t = ${time.toFixed(1)} s`;
    ctx.fillText(info, px + 10, py + 14);
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Sound Wave: Compression & Rarefaction", width / 2, 28);

    drawSpeaker();
    drawParticles();
    drawPressureGraph();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const wavelength = speed / frequency;
    return (
      `Sound wave simulation: f=${frequency.toFixed(1)} Hz, v=${speed.toFixed(0)} px/s, ` +
      `wavelength=${wavelength.toFixed(1)} px, amplitude=${amplitude.toFixed(2)}. ` +
      `Particles oscillate longitudinally creating compression (high density, high pressure) and ` +
      `rarefaction (low density, low pressure) regions. Pressure graph ${showPressure ? "visible" : "hidden"}, t=${time.toFixed(2)} s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SoundWaveFactory;
