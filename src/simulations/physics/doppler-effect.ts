import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DopplerEffectFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("doppler-effect") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let sourceSpeed = 40; // m/s
  let soundSpeed = 343; // m/s
  let frequency = 440; // Hz

  interface WaveFront {
    x: number;
    y: number;
    radius: number;
    emitTime: number;
  }

  let waveFronts: WaveFront[] = [];
  let sourceX = 0;
  let sourceDirection = 1;
  let lastEmitTime = 0;
  const emitInterval = 0.08; // seconds between wavefronts

  const observerX = 0.75; // fraction of width
  const roadY = 0.55; // fraction of height

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    sourceX = 0.1;
    sourceDirection = 1;
    waveFronts = [];
    lastEmitTime = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    sourceSpeed = params.sourceSpeed ?? 40;
    soundSpeed = params.soundSpeed ?? 343;
    frequency = params.frequency ?? 440;
    time += dt;

    // Move source across the screen
    const speedFraction = (sourceSpeed / soundSpeed) * 0.4; // scale for visual
    sourceX += sourceDirection * speedFraction * dt;
    if (sourceX > 0.95) {
      sourceX = 0.95;
      sourceDirection = -1;
    } else if (sourceX < 0.05) {
      sourceX = 0.05;
      sourceDirection = 1;
    }

    // Emit wavefronts periodically
    if (time - lastEmitTime > emitInterval) {
      waveFronts.push({
        x: sourceX * width,
        y: roadY * height,
        radius: 0,
        emitTime: time,
      });
      lastEmitTime = time;
    }

    // Expand wavefronts
    const pixelsPerMeter = width / 200; // scale factor
    for (const wf of waveFronts) {
      wf.radius = (time - wf.emitTime) * soundSpeed * pixelsPerMeter * 0.3;
    }

    // Remove old wavefronts
    waveFronts = waveFronts.filter((wf) => wf.radius < width * 1.5);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#1a1a3a");
    bgGrad.addColorStop(0.5, "#2a2a4a");
    bgGrad.addColorStop(1, "#1a2a1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Road
    const ry = roadY * height;
    ctx.fillStyle = "#444";
    ctx.fillRect(0, ry - 20, width, 40);
    // Road markings
    ctx.setLineDash([20, 15]);
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(width, ry);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw wavefronts
    for (const wf of waveFronts) {
      const alpha = Math.max(0, 1 - wf.radius / (width * 0.8));
      ctx.beginPath();
      ctx.arc(wf.x, wf.y, wf.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100,180,255,${alpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw ambulance/source
    const sx = sourceX * width;
    const sy = ry;

    // Vehicle body
    ctx.fillStyle = "#e63946";
    const vw = 60;
    const vh = 30;
    ctx.beginPath();
    ctx.roundRect(sx - vw / 2, sy - vh, vw, vh, 4);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cross symbol
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx - 2, sy - vh + 6, 4, 14);
    ctx.fillRect(sx - 7, sy - vh + 11, 14, 4);

    // Wheels
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(sx - 18, sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 18, sy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Siren light
    const sirenFlash = Math.sin(time * 15) > 0;
    ctx.fillStyle = sirenFlash ? "#ff0000" : "#0066ff";
    ctx.beginPath();
    ctx.arc(sx, sy - vh - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw observer
    const ox = observerX * width;
    const oy = ry;

    // Person icon
    ctx.fillStyle = "#4CAF50";
    // Head
    ctx.beginPath();
    ctx.arc(ox, oy - 35, 8, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ox, oy - 27);
    ctx.lineTo(ox, oy - 10);
    ctx.stroke();
    // Arms
    ctx.beginPath();
    ctx.moveTo(ox - 10, oy - 22);
    ctx.lineTo(ox + 10, oy - 22);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(ox, oy - 10);
    ctx.lineTo(ox - 8, oy);
    ctx.moveTo(ox, oy - 10);
    ctx.lineTo(ox + 8, oy);
    ctx.stroke();

    ctx.fillStyle = "#4CAF50";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Observer", ox, oy + 20);

    // Calculate observed frequencies
    const mach = sourceSpeed / soundSpeed;
    const approachFreq = frequency / (1 - mach);
    const recedeFreq = frequency / (1 + mach);

    // Frequency display panel
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, 15, width * 0.9, 90, 8);
    ctx.fill();

    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText("Doppler Effect", width / 2, 36);

    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#88bbff";
    ctx.textAlign = "left";
    ctx.fillText(`Source: f₀ = ${frequency} Hz`, width * 0.08, 58);
    ctx.fillStyle = "#ff8888";
    ctx.fillText(`Approaching: f = ${approachFreq.toFixed(1)} Hz`, width * 0.08, 78);
    ctx.fillStyle = "#88ff88";
    ctx.fillText(`Receding: f = ${recedeFreq.toFixed(1)} Hz`, width * 0.08, 98);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ccc";
    ctx.fillText(`v_source = ${sourceSpeed} m/s`, width * 0.92, 58);
    ctx.fillText(`v_sound = ${soundSpeed} m/s`, width * 0.92, 78);
    ctx.fillText(`Mach = ${mach.toFixed(3)}`, width * 0.92, 98);

    // Wavelength visualization at bottom
    const waveY = height - 50;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";

    // Approaching wavelength
    const lambdaA = soundSpeed / approachFreq;
    const lambdaR = soundSpeed / recedeFreq;
    const lambdaS = soundSpeed / frequency;
    const scale = 2;

    ctx.fillText("← Compressed (shorter λ)", width * 0.25, waveY - 15);
    ctx.strokeStyle = "#ff8888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < width * 0.45; x++) {
      const y = waveY + 10 * Math.sin((x / (lambdaA * scale)) * Math.PI * 2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillText("Stretched (longer λ) →", width * 0.75, waveY - 15);
    ctx.strokeStyle = "#88ff88";
    ctx.beginPath();
    for (let x = width * 0.55; x < width; x++) {
      const y = waveY + 10 * Math.sin((x / (lambdaR * scale)) * Math.PI * 2);
      if (x === width * 0.55) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Direction arrow
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    const dirLabel = sourceDirection > 0 ? "→ Moving Right" : "← Moving Left";
    ctx.fillText(dirLabel, sx, sy - vh - 15);
  }

  function reset(): void {
    time = 0;
    sourceX = 0.1;
    sourceDirection = 1;
    waveFronts = [];
    lastEmitTime = 0;
  }

  function destroy(): void {
    waveFronts = [];
  }

  function getStateDescription(): string {
    const mach = sourceSpeed / soundSpeed;
    const approachFreq = frequency / (1 - mach);
    const recedeFreq = frequency / (1 + mach);
    return (
      `Doppler Effect: source frequency=${frequency} Hz, source speed=${sourceSpeed} m/s, ` +
      `sound speed=${soundSpeed} m/s, Mach number=${mach.toFixed(3)}. ` +
      `Approaching frequency=${approachFreq.toFixed(1)} Hz, receding frequency=${recedeFreq.toFixed(1)} Hz. ` +
      `f_observed = f_source / (1 ∓ v_source/v_sound). ` +
      `Source moving ${sourceDirection > 0 ? "right" : "left"}.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DopplerEffectFactory;
