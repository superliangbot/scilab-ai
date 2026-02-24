import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Cochlear Simulation
 * Visualises the cochlea (inner ear) responding to different sound frequencies.
 * Low frequencies excite the apex (inner), high frequencies excite the base (outer).
 * Position along basilar membrane: x ≈ A − B·log₁₀(f)  (tonotopic map).
 */

const CochlearFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cochlear") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let frequency = 1000; // Hz
  let amplitude = 50;   // vibration amplitude %
  let showLabels = 1;

  // Cochlea drawn as a spiral
  const SPIRAL_TURNS = 2.5;
  const POINTS = 300;

  function freqToPosition(f: number): number {
    // Greenwood function approximation: position 0 (base, high freq) to 1 (apex, low freq)
    const fMin = 20;
    const fMax = 20000;
    const logMin = Math.log10(fMin);
    const logMax = Math.log10(fMax);
    const logF = Math.log10(Math.max(fMin, Math.min(fMax, f)));
    return 1 - (logF - logMin) / (logMax - logMin);
  }

  function spiralPoint(t: number, cx: number, cy: number, rMax: number): { x: number; y: number } {
    const angle = t * SPIRAL_TURNS * 2 * Math.PI;
    const r = rMax * (1 - t * 0.65);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    frequency = params.frequency ?? 1000;
    amplitude = params.amplitude ?? 50;
    showLabels = params.showLabels ?? 1;
    time += dt;
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a1a");
    bg.addColorStop(1, "#10102a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.48;
    const rMax = Math.min(width, height) * 0.32;

    const excitePos = freqToPosition(frequency);
    const ampFactor = amplitude / 100;

    // Draw spiral (basilar membrane)
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const t = i / POINTS;
      const pt = spiralPoint(t, cx, cy, rMax);

      // Add vibration at the excited region
      const dist = Math.abs(t - excitePos);
      const envelope = Math.exp(-dist * dist * 200) * ampFactor;
      const vibration = envelope * 6 * Math.sin(time * frequency * 0.02 + t * 40);
      const angle = t * SPIRAL_TURNS * 2 * Math.PI;
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);

      const px = pt.x + nx * vibration;
      const py = pt.y + ny * vibration;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "rgba(180, 200, 240, 0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw colour-coded regions along the spiral
    for (let i = 0; i < POINTS; i++) {
      const t = i / POINTS;
      const pt = spiralPoint(t, cx, cy, rMax);
      const dist = Math.abs(t - excitePos);
      const intensity = Math.exp(-dist * dist * 200) * ampFactor;

      if (intensity > 0.05) {
        const vibration = intensity * 6 * Math.sin(time * frequency * 0.02 + t * 40);
        const angle = t * SPIRAL_TURNS * 2 * Math.PI;
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        const px = pt.x + nx * vibration;
        const py = pt.y + ny * vibration;

        const r = 3 + intensity * 6;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
        glow.addColorStop(0, `rgba(255, 80, 80, ${intensity * 0.8})`);
        glow.addColorStop(1, "rgba(255, 80, 80, 0)");
        ctx.beginPath();
        ctx.arc(px, py, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 60, 60, ${0.4 + intensity * 0.6})`;
        ctx.fill();
      }
    }

    // Excitation point marker
    const ePt = spiralPoint(excitePos, cx, cy, rMax);
    ctx.beginPath();
    ctx.arc(ePt.x, ePt.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 50, 50, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels on spiral
    if (showLabels >= 1) {
      ctx.save();
      ctx.font = `${Math.max(10, width * 0.018)}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(200, 220, 255, 0.6)";
      ctx.textAlign = "center";

      const basePt = spiralPoint(0, cx, cy, rMax);
      ctx.fillText("Base (high freq)", basePt.x, basePt.y - 14);

      const apexPt = spiralPoint(1, cx, cy, rMax);
      ctx.fillText("Apex (low freq)", apexPt.x, apexPt.y + 18);

      // Frequency label at excitation point
      ctx.fillStyle = "#ff6666";
      ctx.font = `bold ${Math.max(11, width * 0.02)}px system-ui, sans-serif`;
      ctx.fillText(`${frequency} Hz`, ePt.x, ePt.y - 16);
      ctx.restore();
    }

    // Ear anatomy label
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Cochlea — Tonotopic Map", width / 2, 24);

    ctx.font = `${Math.max(10, width * 0.016)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160,180,220,0.5)";
    ctx.fillText("Different frequencies excite different regions of the basilar membrane", width / 2, 44);
    ctx.restore();

    // Info panel
    ctx.save();
    const pW = 200;
    const pX = 10;
    const pY = height - 80;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(pX, pY, pW, 68, 6);
    ctx.fill();

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "left";
    ctx.fillText(`Frequency: ${frequency} Hz`, pX + 8, pY + 18);
    ctx.fillText(`Amplitude: ${amplitude}%`, pX + 8, pY + 34);
    const region = frequency < 500 ? "Apex (inner)" : frequency < 4000 ? "Middle" : "Base (outer)";
    ctx.fillText(`Excited region: ${region}`, pX + 8, pY + 50);
    ctx.fillText(`Position: ${(excitePos * 100).toFixed(0)}% from base`, pX + 8, pY + 64);
    ctx.restore();
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const excitePos = freqToPosition(frequency);
    const region = frequency < 500 ? "apex (inner)" : frequency < 4000 ? "middle" : "base (outer)";
    return (
      `Cochlear simulation: frequency=${frequency} Hz, amplitude=${amplitude}%. ` +
      `The basilar membrane is excited at ${(excitePos * 100).toFixed(0)}% from the base (${region} region). ` +
      `Low frequencies excite the apex, high frequencies excite the base. ` +
      `This tonotopic organisation allows frequency discrimination in human hearing.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CochlearFactory;
