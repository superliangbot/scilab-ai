import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Seismic Wave — demonstrates P-waves (primary/compression) and S-waves (secondary/shear)
 * propagating through the Earth from an earthquake epicenter.
 */

interface WaveFront {
  radius: number;
  type: "P" | "S";
  alpha: number;
}

interface GridPoint {
  baseX: number;
  baseY: number;
  dx: number;
  dy: number;
}

const SeismicWaveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("seismic-wave") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let pWaveSpeed = 6; // km/s scaled
  let sWaveSpeed = 3.5;
  let amplitude = 5;
  let frequency = 2;

  let waveFronts: WaveFront[] = [];
  let epicenterX = 0;
  let epicenterY = 0;
  let grid: GridPoint[] = [];
  let quakeTime = 0;
  let quakeActive = false;

  const GRID_SPACING = 20;

  function createGrid(): void {
    grid = [];
    for (let x = 0; x < width; x += GRID_SPACING) {
      for (let y = 0; y < height; y += GRID_SPACING) {
        grid.push({ baseX: x, baseY: y, dx: 0, dy: 0 });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    epicenterX = width * 0.3;
    epicenterY = height * 0.5;
    time = 0;
    quakeTime = 0;
    quakeActive = true;
    waveFronts = [];
    createGrid();
  }

  function update(dt: number, params: Record<string, number>): void {
    pWaveSpeed = params.pWaveSpeed ?? 6;
    sWaveSpeed = params.sWaveSpeed ?? 3.5;
    amplitude = params.amplitude ?? 5;
    frequency = params.frequency ?? 2;

    const step = Math.min(dt, 0.033);
    time += step;
    quakeTime += step;

    // Generate new wave fronts periodically
    if (quakeActive && quakeTime < 10) {
      const interval = 1 / frequency;
      const expectedFronts = Math.floor(quakeTime / interval);
      while (waveFronts.length < expectedFronts * 2 && waveFronts.length < 40) {
        waveFronts.push({ radius: 0, type: "P", alpha: 1 });
        waveFronts.push({ radius: 0, type: "S", alpha: 1 });
      }
    }

    // Update wave fronts
    for (let i = waveFronts.length - 1; i >= 0; i--) {
      const wf = waveFronts[i];
      const speed = wf.type === "P" ? pWaveSpeed * 30 : sWaveSpeed * 30;
      wf.radius += speed * step;
      wf.alpha = Math.max(0, 1 - wf.radius / (Math.max(width, height) * 0.8));

      if (wf.alpha <= 0) {
        waveFronts.splice(i, 1);
      }
    }

    // Update grid deformation
    const pSpeed = pWaveSpeed * 30;
    const sSpeed = sWaveSpeed * 30;

    for (const pt of grid) {
      const dx = pt.baseX - epicenterX;
      const dy = pt.baseY - epicenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const nx = dx / dist;
      const ny = dy / dist;

      // P-wave displacement (along radial direction)
      const pWaveDist = pSpeed * quakeTime;
      const pPhase = (dist - pWaveDist) * frequency * 0.1;
      const pEnvelope = Math.exp(-Math.abs(dist - pWaveDist) * 0.01) * amplitude;
      const pDisp = pEnvelope * Math.sin(pPhase);

      // S-wave displacement (perpendicular to radial direction)
      const sWaveDist = sSpeed * quakeTime;
      const sPhase = (dist - sWaveDist) * frequency * 0.1;
      const sEnvelope = Math.exp(-Math.abs(dist - sWaveDist) * 0.01) * amplitude;
      const sDisp = sEnvelope * Math.sin(sPhase);

      // P-wave moves along radial (compression/rarefaction)
      // S-wave moves perpendicular (shear)
      pt.dx = nx * pDisp + (-ny) * sDisp;
      pt.dy = ny * pDisp + nx * sDisp;
    }
  }

  function render(): void {
    // Earth cross-section background
    const bg = ctx.createRadialGradient(width / 2, height, 0, width / 2, height, height * 1.5);
    bg.addColorStop(0, "#3a2510");
    bg.addColorStop(0.5, "#2a1a0a");
    bg.addColorStop(1, "#1a1005");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Earth layer lines
    ctx.strokeStyle = "rgba(100, 80, 50, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = height * (i / 5);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Grid (deformed)
    ctx.strokeStyle = "rgba(120, 100, 60, 0.15)";
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    const cols = Math.ceil(width / GRID_SPACING);
    const rows = Math.ceil(height / GRID_SPACING);
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        const idx = c * rows + r;
        if (idx >= grid.length) continue;
        const pt = grid[idx];
        const px = pt.baseX + pt.dx;
        const py = pt.baseY + pt.dy;
        if (c === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Vertical grid lines
    for (let c = 0; c < cols; c++) {
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        const idx = c * rows + r;
        if (idx >= grid.length) continue;
        const pt = grid[idx];
        const px = pt.baseX + pt.dx;
        const py = pt.baseY + pt.dy;
        if (r === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Wave fronts
    for (const wf of waveFronts) {
      if (wf.type === "P") {
        ctx.strokeStyle = `rgba(255, 100, 50, ${wf.alpha * 0.5})`;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = `rgba(50, 150, 255, ${wf.alpha * 0.5})`;
        ctx.lineWidth = 2;
      }
      ctx.beginPath();
      ctx.arc(epicenterX, epicenterY, wf.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Epicenter
    const eGlow = ctx.createRadialGradient(epicenterX, epicenterY, 0, epicenterX, epicenterY, 25);
    eGlow.addColorStop(0, "rgba(255, 50, 30, 0.8)");
    eGlow.addColorStop(0.5, "rgba(255, 100, 30, 0.3)");
    eGlow.addColorStop(1, "rgba(255, 50, 30, 0)");
    ctx.fillStyle = eGlow;
    ctx.beginPath();
    ctx.arc(epicenterX, epicenterY, 25, 0, Math.PI * 2);
    ctx.fill();

    // Star marker
    ctx.fillStyle = "#ff4422";
    ctx.font = "18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("★", epicenterX, epicenterY + 6);

    // Legend
    const legX = width - 160;
    const legY = height - 60;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(legX - 10, legY - 15, 160, 55, 5);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 100, 50, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legX, legY);
    ctx.lineTo(legX + 25, legY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 100, 50, 0.9)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`P-wave (${pWaveSpeed.toFixed(1)} km/s)`, legX + 30, legY + 4);

    ctx.strokeStyle = "rgba(50, 150, 255, 0.8)";
    ctx.beginPath();
    ctx.moveTo(legX, legY + 22);
    ctx.lineTo(legX + 25, legY + 22);
    ctx.stroke();
    ctx.fillStyle = "rgba(50, 150, 255, 0.9)";
    ctx.fillText(`S-wave (${sWaveSpeed.toFixed(1)} km/s)`, legX + 30, legY + 26);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 260, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Seismic Waves", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("P-wave: compression (faster, longitudinal)", 20, 46);
    ctx.fillText("S-wave: shear (slower, transverse)", 20, 62);
    ctx.fillText(`P arrives first: Δt helps locate epicenter`, 20, 78);
    ctx.fillText(`Time since quake: ${quakeTime.toFixed(1)}s`, 20, 94);
  }

  function reset(): void {
    time = 0;
    quakeTime = 0;
    quakeActive = true;
    waveFronts = [];
    for (const pt of grid) {
      pt.dx = 0;
      pt.dy = 0;
    }
  }

  function destroy(): void {
    grid = [];
    waveFronts = [];
  }

  function getStateDescription(): string {
    return (
      `Seismic Wave: P-wave speed=${pWaveSpeed.toFixed(1)} km/s, S-wave speed=${sWaveSpeed.toFixed(1)} km/s. ` +
      `Amplitude=${amplitude.toFixed(1)}, Frequency=${frequency.toFixed(1)} Hz. ` +
      `${waveFronts.length} active wave fronts. Time since quake: ${quakeTime.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    epicenterX = w * 0.3;
    epicenterY = h * 0.5;
    createGrid();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SeismicWaveFactory;
