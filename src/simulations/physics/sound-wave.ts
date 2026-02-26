import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SoundWaveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sound-wave") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 440; // Hz
  let amplitude = 0.8;
  let waveType = 0; // 0=sine, 1=square, 2=triangle, 3=sawtooth
  let speed = 343; // m/s speed of sound

  // Particles for longitudinal wave visualization
  const NUM_PARTICLES_X = 40;
  const NUM_PARTICLES_Y = 12;
  let particles: { baseX: number; baseY: number; x: number; y: number }[] = [];

  const WAVE_NAMES = ["Sine", "Square", "Triangle", "Sawtooth"];

  function generateSample(phase: number, type: number): number {
    const p = ((phase % 1) + 1) % 1;
    switch (type) {
      case 0: return Math.sin(p * Math.PI * 2);
      case 1: return p < 0.5 ? 1 : -1;
      case 2: return 1 - 4 * Math.abs(p - 0.5);
      case 3: return 2 * p - 1;
      default: return Math.sin(p * Math.PI * 2);
    }
  }

  function initParticles(): void {
    particles = [];
    const marginX = 60;
    const regionTop = height * 0.55;
    const regionBottom = height - 40;
    const regionHeight = regionBottom - regionTop;
    const regionWidth = width - 2 * marginX;

    for (let iy = 0; iy < NUM_PARTICLES_Y; iy++) {
      for (let ix = 0; ix < NUM_PARTICLES_X; ix++) {
        const bx = marginX + (ix / (NUM_PARTICLES_X - 1)) * regionWidth;
        const by = regionTop + (iy / (NUM_PARTICLES_Y - 1)) * regionHeight;
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
    initParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    frequency = params.frequency ?? 440;
    amplitude = params.amplitude ?? 0.8;
    waveType = Math.round(params.waveType ?? 0);
    speed = params.speed ?? 343;
    time += dt;

    // Update particle positions for longitudinal wave
    const wavelength = speed / frequency;
    const regionWidth = width - 120;
    const maxDisplacement = (regionWidth / NUM_PARTICLES_X) * 0.45 * amplitude;

    for (const p of particles) {
      // Phase based on horizontal position (traveling wave)
      const normalizedX = (p.baseX - 60) / regionWidth;
      const spatialPhase = normalizedX * (regionWidth / (wavelength * 2));
      const phase = spatialPhase - time * frequency;
      const displacement = generateSample(phase, waveType) * maxDisplacement;
      p.x = p.baseX + displacement;
      p.y = p.baseY;
    }
  }

  function drawBackground(): void {
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);
  }

  function drawTransverseWave(): void {
    const margin = 50;
    const waveTop = 50;
    const waveBottom = height * 0.45;
    const waveHeight = waveBottom - waveTop;
    const waveLeft = margin;
    const waveRight = width - margin;
    const waveWidth = waveRight - waveLeft;
    const waveMidY = waveTop + waveHeight / 2;

    // Panel background
    ctx.fillStyle = "rgba(20, 30, 50, 0.5)";
    ctx.beginPath();
    ctx.roundRect(waveLeft - 10, waveTop - 20, waveWidth + 20, waveHeight + 30, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Transverse Representation", (waveLeft + waveRight) / 2, waveTop - 6);

    // Grid
    ctx.strokeStyle = "rgba(80, 120, 160, 0.12)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = waveTop + (i / 4) * waveHeight;
      ctx.beginPath();
      ctx.moveTo(waveLeft, y);
      ctx.lineTo(waveRight, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = waveLeft + (i / 8) * waveWidth;
      ctx.beginPath();
      ctx.moveTo(x, waveTop);
      ctx.lineTo(x, waveBottom);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waveLeft, waveMidY);
    ctx.lineTo(waveRight, waveMidY);
    ctx.stroke();

    // Draw waveform - traveling wave
    const wavelength = speed / frequency;
    const numCycles = 4;
    const displayLength = numCycles * wavelength;

    const colors = ["#00ccff", "#ff6644", "#44ff88", "#ffaa22"];
    const color = colors[waveType] || "#00ccff";

    // Filled area under curve
    ctx.beginPath();
    ctx.moveTo(waveLeft, waveMidY);
    for (let px = 0; px <= waveWidth; px++) {
      const x = px / waveWidth;
      const spatialPhase = x * numCycles;
      const phase = spatialPhase - time * frequency;
      const val = generateSample(phase, waveType);
      const y = waveMidY - val * amplitude * (waveHeight * 0.38);
      ctx.lineTo(waveLeft + px, y);
    }
    ctx.lineTo(waveRight, waveMidY);
    ctx.closePath();
    ctx.fillStyle = color + "10";
    ctx.fill();

    // Wave line
    ctx.beginPath();
    let first = true;
    for (let px = 0; px <= waveWidth; px++) {
      const x = px / waveWidth;
      const spatialPhase = x * numCycles;
      const phase = spatialPhase - time * frequency;
      const val = generateSample(phase, waveType);
      const y = waveMidY - val * amplitude * (waveHeight * 0.38);
      if (first) { ctx.moveTo(waveLeft + px, y); first = false; }
      else ctx.lineTo(waveLeft + px, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Glow
    ctx.strokeStyle = color + "30";
    ctx.lineWidth = 8;
    ctx.stroke();

    // Wavelength marker
    const lambdaPx = waveWidth / numCycles;
    const mY = waveBottom + 6;
    ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waveLeft, mY - 3);
    ctx.lineTo(waveLeft, mY + 3);
    ctx.moveTo(waveLeft, mY);
    ctx.lineTo(waveLeft + lambdaPx, mY);
    ctx.moveTo(waveLeft + lambdaPx, mY - 3);
    ctx.lineTo(waveLeft + lambdaPx, mY + 3);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 200, 100, 0.6)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`λ = ${(wavelength * 100).toFixed(1)} cm`, waveLeft + lambdaPx / 2, mY + 14);

    // Axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("+A", waveLeft - 6, waveTop + 12);
    ctx.fillText("0", waveLeft - 6, waveMidY + 4);
    ctx.fillText("-A", waveLeft - 6, waveBottom - 4);

    // Direction arrow
    const arrowX = waveRight - 40;
    const arrowY = waveTop + 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("→ propagation", arrowX - 30, arrowY);
  }

  function drawLongitudinalWave(): void {
    const margin = 50;
    const regionTop = height * 0.52;
    const regionBottom = height - 30;

    // Panel background
    ctx.fillStyle = "rgba(20, 30, 50, 0.5)";
    ctx.beginPath();
    ctx.roundRect(margin - 10, regionTop - 20, width - 2 * margin + 20, regionBottom - regionTop + 30, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Longitudinal Representation (Air Molecules)", width / 2, regionTop - 6);

    // Draw particles
    for (const p of particles) {
      // Color based on local density (displacement gradient)
      const regionWidth = width - 120;
      const normalizedX = (p.baseX - 60) / regionWidth;
      const wavelength = speed / frequency;
      const spatialPhase = normalizedX * (regionWidth / (wavelength * 2));
      const phase = spatialPhase - time * frequency;

      // Density indicator: derivative of displacement
      const dPhase = 0.01;
      const disp1 = generateSample(phase, waveType);
      const disp2 = generateSample(phase + dPhase, waveType);
      const gradient = (disp2 - disp1) / dPhase;

      // Negative gradient = compression, positive = rarefaction
      const compressionFactor = Math.max(-1, Math.min(1, -gradient * 0.5));

      let r: number, g: number, b: number, a: number;
      if (compressionFactor > 0) {
        // Compression: brighter, warmer
        r = 100 + compressionFactor * 155;
        g = 180 + compressionFactor * 75;
        b = 255;
        a = 0.4 + compressionFactor * 0.5;
      } else {
        // Rarefaction: dimmer
        const rare = -compressionFactor;
        r = 60;
        g = 100 + rare * 40;
        b = 180;
        a = 0.15 + (1 - rare) * 0.25;
      }

      const radius = 2 + compressionFactor * 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
      ctx.fill();
    }

    // Labels for compression and rarefaction regions
    const wavelength = speed / frequency;
    const regionWidth = width - 120;
    const lambdaPx = (wavelength * 2) / regionWidth * regionWidth;

    if (lambdaPx > 80) {
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      const labelY = regionBottom + 14;

      // Find a compression region
      for (let i = 0; i < 2; i++) {
        const cx = 60 + (i + 0.25) * lambdaPx + (time * frequency * lambdaPx) % lambdaPx;
        if (cx > 80 && cx < width - 80) {
          ctx.fillStyle = "rgba(255, 200, 100, 0.5)";
          ctx.fillText("compression", cx, labelY);
          break;
        }
      }
      for (let i = 0; i < 2; i++) {
        const rx = 60 + (i + 0.75) * lambdaPx + (time * frequency * lambdaPx) % lambdaPx;
        if (rx > 80 && rx < width - 80) {
          ctx.fillStyle = "rgba(100, 160, 255, 0.5)";
          ctx.fillText("rarefaction", rx, labelY);
          break;
        }
      }
    }
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 190;
    const panelH = 110;
    const panelX = width - panelW - 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Sound Wave", panelX + 10, panelY + 8);

    const colors = ["#00ccff", "#ff6644", "#44ff88", "#ffaa22"];
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = colors[waveType] || "#00ccff";
    ctx.fillText(`Wave: ${WAVE_NAMES[waveType]}`, panelX + 10, panelY + 28);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Frequency: ${frequency.toFixed(0)} Hz`, panelX + 10, panelY + 46);

    const wavelength = speed / frequency;
    ctx.fillText(`Wavelength: ${(wavelength * 100).toFixed(1)} cm`, panelX + 10, panelY + 62);
    ctx.fillText(`Speed: ${speed.toFixed(0)} m/s`, panelX + 10, panelY + 78);

    const period = 1 / frequency;
    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Period: ${(period * 1000).toFixed(2)} ms`, panelX + 10, panelY + 94);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawTransverseWave();
    drawLongitudinalWave();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    initParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const wavelength = speed / frequency;
    const period = 1 / frequency;
    return (
      `Sound Wave simulation. Displaying a ${WAVE_NAMES[waveType]} wave at ` +
      `${frequency.toFixed(0)} Hz with amplitude ${amplitude.toFixed(2)}. ` +
      `Speed of sound: ${speed.toFixed(0)} m/s. ` +
      `Wavelength λ = v/f = ${(wavelength * 100).toFixed(1)} cm. ` +
      `Period T = 1/f = ${(period * 1000).toFixed(2)} ms. ` +
      `Top panel shows the transverse wave representation. ` +
      `Bottom panel shows the longitudinal representation with air molecule ` +
      `compressions and rarefactions. Sound is a longitudinal mechanical wave ` +
      `that propagates through compression and rarefaction of the medium.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SoundWaveFactory;
