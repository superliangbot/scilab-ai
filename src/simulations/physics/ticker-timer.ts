import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TickerTimerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ticker-timer") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let initialVelocity = 1;
  let acceleration = 0.5;
  let tickFrequency = 50;
  let showMeasurements = 1;

  interface Dot {
    position: number; // distance from start in meters
    time: number;
  }

  let dots: Dot[] = [];
  let tapeOffset = 0;
  let lastTickTime = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    dots = [];
    tapeOffset = 0;
    lastTickTime = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    initialVelocity = params.initialVelocity ?? 1;
    acceleration = params.acceleration ?? 0.5;
    tickFrequency = params.tickFrequency ?? 50;
    showMeasurements = params.showMeasurements ?? 1;
    time += dt;

    const tickInterval = 1 / tickFrequency;

    // Generate dots at tick intervals
    while (lastTickTime + tickInterval <= time) {
      lastTickTime += tickInterval;
      const t = lastTickTime;
      const pos = initialVelocity * t + 0.5 * acceleration * t * t;
      dots.push({ position: pos, time: t });
    }

    // Limit dots for performance
    if (dots.length > 200) {
      dots = dots.slice(dots.length - 200);
    }

    // Tape scrolls left as object moves
    if (dots.length > 0) {
      const currentPos = initialVelocity * time + 0.5 * acceleration * time * time;
      tapeOffset = currentPos;
    }
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#1a1a2e");
    bgGrad.addColorStop(0.5, "#16213e");
    bgGrad.addColorStop(1, "#0f3460");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ticker Timer", width / 2, 24);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Measuring velocity and acceleration from dot spacing", width / 2, 42);

    // === Ticker timer device ===
    const timerX = width * 0.08;
    const timerY = 65;
    const timerW = 60;
    const timerH = 50;

    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.roundRect(timerX, timerY, timerW, timerH, 6);
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TICKER", timerX + timerW / 2, timerY + 20);
    ctx.fillText(`${tickFrequency} Hz`, timerX + timerW / 2, timerY + 34);

    // Vibrating arm
    const armWobble = Math.sin(time * tickFrequency * Math.PI * 2) * 3;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(timerX + timerW / 2, timerY + timerH);
    ctx.lineTo(timerX + timerW / 2 + armWobble, timerY + timerH + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(timerX + timerW / 2 + armWobble, timerY + timerH + 15, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();

    // === Tape ===
    const tapeY = timerY + timerH + 20;
    const tapeH = 30;
    const tapeStartX = timerX + timerW * 0.3;
    const tapeEndX = width - 20;
    const tapeW = tapeEndX - tapeStartX;
    const pixelsPerMeter = tapeW / 3; // scale: 3 meters fit on screen

    // Tape background
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(tapeStartX, tapeY, tapeW, tapeH);
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1;
    ctx.strokeRect(tapeStartX, tapeY, tapeW, tapeH);

    // Draw dots on tape
    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeStartX, tapeY - 2, tapeW, tapeH + 4);
    ctx.clip();

    const viewStart = Math.max(0, tapeOffset - 1);
    for (const dot of dots) {
      const relPos = dot.position - viewStart;
      const px = tapeStartX + relPos * pixelsPerMeter;
      if (px < tapeStartX - 5 || px > tapeEndX + 5) continue;

      ctx.beginPath();
      ctx.arc(px, tapeY + tapeH / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
    }
    ctx.restore();

    // Pull direction arrow
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Pull direction →", tapeEndX, tapeY - 5);

    // === Bar chart of distances between successive dots ===
    const chartY = tapeY + tapeH + 40;
    const chartH = height * 0.28;
    const chartX = width * 0.08;
    const chartW = width * 0.84;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(chartX - 10, chartY - 20, chartW + 20, chartH + 40, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Distance Between Successive Dots (spacing chart)", chartX + chartW / 2, chartY - 4);

    // Calculate spacings
    const spacings: number[] = [];
    const recentDots = dots.slice(-40);
    for (let i = 1; i < recentDots.length; i++) {
      spacings.push(recentDots[i].position - recentDots[i - 1].position);
    }

    if (spacings.length > 0) {
      const maxSpacing = Math.max(...spacings, 0.01);
      const barCount = Math.min(spacings.length, 30);
      const offset = spacings.length - barCount;
      const barWidth = Math.min(chartW / barCount - 2, 20);

      for (let i = 0; i < barCount; i++) {
        const s = spacings[offset + i];
        const barH = (s / maxSpacing) * (chartH - 10);
        const bx = chartX + (i / barCount) * chartW + 1;
        const by = chartY + chartH - barH;

        // Color gradient from blue (slow) to red (fast)
        const ratio = s / maxSpacing;
        const r = Math.round(59 + ratio * 196);
        const g = Math.round(130 - ratio * 80);
        const b = Math.round(246 - ratio * 196);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(bx, by, barWidth, barH);
      }

      // Axis
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX, chartY);
      ctx.lineTo(chartX, chartY + chartH);
      ctx.lineTo(chartX + chartW, chartY + chartH);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Dot interval number", chartX + chartW / 2, chartY + chartH + 14);
    }

    // === Measurements panel ===
    if (showMeasurements) {
      const panelX = width * 0.04;
      const panelY = chartY + chartH + 50;
      const panelW = width * 0.44;
      const panelH = height - panelY - 10;

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 8);
      ctx.fill();

      let ty = panelY + 20;
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Measurements", panelX + 12, ty); ty += 22;

      // Current velocity: v = v0 + at
      const currentV = initialVelocity + acceleration * time;
      const currentPos = initialVelocity * time + 0.5 * acceleration * time * time;

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Time: ${time.toFixed(2)} s`, panelX + 12, ty); ty += 16;
      ctx.fillText(`Position: ${currentPos.toFixed(3)} m`, panelX + 12, ty); ty += 16;
      ctx.fillStyle = "#60a5fa";
      ctx.fillText(`Velocity: ${currentV.toFixed(3)} m/s`, panelX + 12, ty); ty += 16;
      ctx.fillStyle = "#f87171";
      ctx.fillText(`Acceleration: ${acceleration.toFixed(2)} m/s²`, panelX + 12, ty); ty += 16;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Tick interval: ${(1000 / tickFrequency).toFixed(1)} ms`, panelX + 12, ty); ty += 16;
      ctx.fillText(`Total dots: ${dots.length}`, panelX + 12, ty);

      // Last spacing-based velocity
      if (spacings.length > 0) {
        ty += 20;
        const lastSpacing = spacings[spacings.length - 1];
        const tickDt = 1 / tickFrequency;
        const measuredV = lastSpacing / tickDt;
        ctx.fillStyle = "#4ade80";
        ctx.fillText(`v(measured) = Δd/Δt = ${measuredV.toFixed(3)} m/s`, panelX + 12, ty);
      }
    }

    // === Formulas panel ===
    const fmX = width * 0.52;
    const fmY = chartY + chartH + 50;
    const fmW = width * 0.44;
    const fmH = height - fmY - 10;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(fmX, fmY, fmW, fmH, 8);
    ctx.fill();

    let fy = fmY + 20;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Formulas", fmX + 12, fy); fy += 22;

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "12px monospace";
    ctx.fillText("v = v₀ + a × t", fmX + 12, fy); fy += 18;
    ctx.fillText("s = v₀t + ½at²", fmX + 12, fy); fy += 18;
    ctx.fillText("v = Δd / Δt", fmX + 12, fy); fy += 18;
    ctx.fillText("a = Δv / Δt", fmX + 12, fy); fy += 24;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Wider spacing = faster motion", fmX + 12, fy); fy += 16;
    ctx.fillText("Increasing spacing = acceleration", fmX + 12, fy); fy += 16;
    ctx.fillText("Equal spacing = constant velocity", fmX + 12, fy);

    // Motion type indicator
    fy += 24;
    ctx.fillStyle = acceleration > 0.01 ? "#f59e0b" : "#4ade80";
    ctx.font = "bold 11px system-ui, sans-serif";
    const motionType = acceleration > 0.01 ? "ACCELERATED MOTION" : "UNIFORM MOTION";
    ctx.fillText(motionType, fmX + 12, fy);
  }

  function reset(): void {
    time = 0;
    dots = [];
    tapeOffset = 0;
    lastTickTime = 0;
  }

  function destroy(): void {
    dots = [];
  }

  function getStateDescription(): string {
    const currentV = initialVelocity + acceleration * time;
    const currentPos = initialVelocity * time + 0.5 * acceleration * time * time;
    return (
      `Ticker Timer: initial velocity=${initialVelocity} m/s, acceleration=${acceleration} m/s², ` +
      `tick frequency=${tickFrequency} Hz (interval=${(1000 / tickFrequency).toFixed(1)} ms). ` +
      `Time=${time.toFixed(2)} s, position=${currentPos.toFixed(3)} m, velocity=${currentV.toFixed(3)} m/s. ` +
      `${dots.length} dots recorded. Spacing between dots reveals velocity (v=Δd/Δt), ` +
      `changes in spacing reveal acceleration (a=Δv/Δt).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TickerTimerFactory;
