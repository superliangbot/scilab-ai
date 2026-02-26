import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Loudspeaker Cross-Section: How a dynamic speaker converts electrical
 * signals into sound.
 *
 * Physics: Alternating current in the voice coil creates a changing
 * magnetic field that interacts with the permanent magnet, pushing
 * the cone back and forth. F = BIL (force on current-carrying conductor).
 * The cone vibrates air molecules, producing sound waves.
 */

const SpeakerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("speaker") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 5;
  let amplitude = 0.7;
  let showMagnetic = 1;
  let showCurrent = 1;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    frequency = params.frequency ?? 5;
    amplitude = params.amplitude ?? 0.7;
    showMagnetic = params.showMagnetic ?? 1;
    showCurrent = params.showCurrent ?? 1;
    time += dt;
  }

  /** Current cone displacement from rest (normalised -1 to 1) */
  function coneOffset(): number {
    return amplitude * Math.sin(2 * Math.PI * frequency * time);
  }

  function drawMagnet(cx: number, cy: number, scale: number): void {
    const mw = 50 * scale;
    const mh = 120 * scale;

    // North pole (top)
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.roundRect(cx - mw / 2, cy - mh / 2, mw, mh / 2, [6, 6, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${14 * scale}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - mh / 4 + 5 * scale);

    // South pole (bottom)
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.roundRect(cx - mw / 2, cy, mw, mh / 2, [0, 0, 6, 6]);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText("S", cx, cy + mh / 4 + 5 * scale);

    // Label
    ctx.fillStyle = "#94a3b8";
    ctx.font = `11px system-ui, sans-serif`;
    ctx.fillText("Permanent Magnet", cx, cy + mh / 2 + 16);
  }

  function drawMagneticField(cx: number, cy: number, scale: number): void {
    if (!showMagnetic) return;
    const mh = 120 * scale;

    ctx.strokeStyle = "rgba(251, 146, 60, 0.35)";
    ctx.lineWidth = 1;

    // Field lines from N to S (external path: curve outward)
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const spread = i * 28 * scale;
      ctx.beginPath();
      // From N pole top, curve outward, back to S pole
      ctx.moveTo(cx + spread * 0.3, cy - mh / 2);
      ctx.bezierCurveTo(
        cx + spread * 2, cy - mh * 0.7,
        cx + spread * 2, cy + mh * 0.7,
        cx + spread * 0.3, cy + mh / 2
      );
      ctx.stroke();

      // Arrows on field lines
      const arrowY = cy;
      const arrowX = cx + spread * 2 * (i > 0 ? 0.95 : 0.95);
      const dirX = cx + spread * 0.3 - arrowX;
      const dirY = mh / 2;
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len > 0) {
        const nx = dirX / len;
        const ny = dirY / len;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 4 * nx + 4 * ny, arrowY - 4 * ny - 4 * nx);
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 4 * nx - 4 * ny, arrowY - 4 * ny + 4 * nx);
        ctx.stroke();
      }
    }

    // Internal field lines (straight, N to S inside magnet)
    ctx.strokeStyle = "rgba(251, 146, 60, 0.2)";
    ctx.setLineDash([4, 4]);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 10 * scale, cy - mh / 2 + 5);
      ctx.lineTo(cx + i * 10 * scale, cy + mh / 2 - 5);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawVoiceCoil(cx: number, cy: number, scale: number): void {
    const disp = coneOffset() * 20 * scale;
    const coilW = 14 * scale;
    const coilH = 50 * scale;
    const coilX = cx + 60 * scale + disp;
    const coilY = cy;

    // Coil body
    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(coilX - coilW / 2, coilY - coilH / 2, coilW, coilH, 3);
    ctx.fill();
    ctx.stroke();

    // Coil windings
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 1;
    const numWindings = 8;
    for (let i = 0; i < numWindings; i++) {
      const y = coilY - coilH / 2 + (i + 0.5) * (coilH / numWindings);
      ctx.beginPath();
      ctx.moveTo(coilX - coilW / 2 + 2, y);
      ctx.lineTo(coilX + coilW / 2 - 2, y);
      ctx.stroke();
    }

    // Current direction indicator
    if (showCurrent) {
      const currentVal = Math.sin(2 * Math.PI * frequency * time);
      const arrowColor = currentVal > 0 ? "#22c55e" : "#ef4444";
      ctx.fillStyle = arrowColor;
      ctx.font = `bold ${12 * scale}px system-ui, sans-serif`;
      ctx.textAlign = "center";

      // Dots and crosses to show current direction
      for (let i = 0; i < 4; i++) {
        const y = coilY - coilH / 2 + (i + 0.5) * (coilH / 4);
        if (currentVal > 0) {
          // current going "into" page on left, "out" on right
          ctx.fillText("\u00D7", coilX - coilW / 2 - 8, y + 4); // cross
          ctx.beginPath();
          ctx.arc(coilX + coilW / 2 + 8, y, 3, 0, Math.PI * 2);
          ctx.fill(); // dot
        } else {
          ctx.beginPath();
          ctx.arc(coilX - coilW / 2 - 8, y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillText("\u00D7", coilX + coilW / 2 + 8, y + 4);
        }
      }

      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`I = ${(currentVal * amplitude).toFixed(2)} A`, coilX, coilY + coilH / 2 + 14);
    }

    // Label
    ctx.fillStyle = "#fbbf24";
    ctx.font = `11px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Voice Coil", coilX, coilY - coilH / 2 - 8);
  }

  function drawCone(cx: number, cy: number, scale: number): void {
    const disp = coneOffset() * 20 * scale;
    const coilX = cx + 60 * scale + disp;
    const coneLen = 140 * scale;
    const coneOpenH = 160 * scale;
    const coilH = 50 * scale;

    // Cone (trapezoid from coil to open end)
    const coneEndX = coilX + coneLen;
    ctx.beginPath();
    ctx.moveTo(coilX, cy - coilH / 2);
    ctx.lineTo(coneEndX, cy - coneOpenH / 2);
    ctx.lineTo(coneEndX, cy + coneOpenH / 2);
    ctx.lineTo(coilX, cy + coilH / 2);
    ctx.closePath();

    const grad = ctx.createLinearGradient(coilX, 0, coneEndX, 0);
    grad.addColorStop(0, "rgba(100, 116, 139, 0.8)");
    grad.addColorStop(1, "rgba(71, 85, 105, 0.5)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Surround (flexible edge)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(coneEndX, cy - coneOpenH / 2);
    ctx.quadraticCurveTo(coneEndX + 10, cy - coneOpenH / 2 - 10, coneEndX + 5, cy - coneOpenH / 2 + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(coneEndX, cy + coneOpenH / 2);
    ctx.quadraticCurveTo(coneEndX + 10, cy + coneOpenH / 2 + 10, coneEndX + 5, cy + coneOpenH / 2 - 5);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Cone (Diaphragm)", (coilX + coneEndX) / 2, cy + 5);
  }

  function drawSoundWaves(cx: number, cy: number, scale: number): void {
    const disp = coneOffset() * 20 * scale;
    const startX = cx + 60 * scale + disp + 140 * scale + 10;
    const coneOpenH = 160 * scale;

    ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
    ctx.lineWidth = 2;

    for (let i = 1; i <= 6; i++) {
      const phase = 2 * Math.PI * frequency * time - i * 0.8;
      const r = 15 * i;
      const alpha = Math.max(0.05, 0.35 - i * 0.05);
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.beginPath();
      ctx.arc(startX, cy, r, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
    }

    ctx.fillStyle = "#38bdf8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Sound Waves", startX + 10, cy - coneOpenH / 2 - 10);
  }

  function drawCurrentGraph(): void {
    const gx = width * 0.05;
    const gy = height * 0.75;
    const gw = width * 0.4;
    const gh = height * 0.2;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Driving AC Signal", gx + gw / 2, gy + 16);

    // Axes
    const plotL = gx + 35;
    const plotR = gx + gw - 10;
    const plotT = gy + 25;
    const plotB = gy + gh - 10;
    const midY = (plotT + plotB) / 2;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotL, midY);
    ctx.lineTo(plotR, midY);
    ctx.stroke();

    // Signal curve (last few periods)
    const periods = 4;
    const T = 1 / frequency;
    const totalTime = periods * T;

    ctx.beginPath();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 200; i++) {
      const frac = i / 200;
      const t0 = time - totalTime + frac * totalTime;
      const val = amplitude * Math.sin(2 * Math.PI * frequency * t0);
      const sx = plotL + frac * plotW;
      const sy = midY - val * plotH * 0.45;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Current time marker
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(plotR, midY - coneOffset() * plotH * 0.45, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("+A", plotL - 4, plotT + 8);
    ctx.fillText("-A", plotL - 4, plotB);
  }

  function drawInfoPanel(): void {
    const px = width * 0.55;
    const py = height * 0.80;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(px, py, width * 0.42, height * 0.16, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("How It Works", px + 12, py + 16);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("AC \u2192 Voice Coil \u2192 F=BIL \u2192 Cone vibrates \u2192 Sound", px + 12, py + 34);
    ctx.fillText(`f = ${frequency.toFixed(1)} Hz | A = ${amplitude.toFixed(2)}`, px + 12, py + 50);
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Loudspeaker Cross-Section", width / 2, 28);

    const centerX = width * 0.15;
    const centerY = height * 0.4;
    const scale = Math.min(width / 700, height / 500);

    drawMagnet(centerX, centerY, scale);
    drawMagneticField(centerX, centerY, scale);
    drawVoiceCoil(centerX, centerY, scale);
    drawCone(centerX, centerY, scale);
    drawSoundWaves(centerX, centerY, scale);
    drawCurrentGraph();
    drawInfoPanel();

    // Time
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(2)} s`, 15, height - 10);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const disp = coneOffset();
    return (
      `Loudspeaker simulation: frequency=${frequency.toFixed(1)} Hz, amplitude=${amplitude.toFixed(2)}. ` +
      `Cone displacement=${(disp * 20).toFixed(1)} px from rest. ` +
      `Magnetic field lines ${showMagnetic ? "visible" : "hidden"}, ` +
      `current direction ${showCurrent ? "visible" : "hidden"}. ` +
      `The voice coil in the permanent magnetic field experiences F=BIL, driving the cone at t=${time.toFixed(2)} s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpeakerFactory;
