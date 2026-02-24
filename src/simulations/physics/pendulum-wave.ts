import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PendulumWaveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pendulum-wave") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Trail history: stores past bob positions for afterglow effect
  // Each entry is an array of {x, y, color} for each pendulum at that time step
  const trailHistory: Array<Array<{ x: number; y: number; color: string }>> = [];
  const MAX_TRAIL_LENGTH = 12;

  // Current parameters (cached)
  let numPendulums = 15;
  let gravity = 9.81;
  let amplitude = 30;
  let lengthDelta = 0.04;

  // Base length for the shortest pendulum (in meters)
  const BASE_LENGTH = 1.0;

  function hslColor(index: number, total: number, alpha: number = 1): string {
    const hue = (index / total) * 300; // rainbow gradient from red to violet
    return `hsla(${hue}, 85%, 55%, ${alpha})`;
  }

  function getPendulumLength(index: number): number {
    return BASE_LENGTH + index * lengthDelta;
  }

  function getPeriod(length: number): number {
    return 2 * Math.PI * Math.sqrt(length / gravity);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    trailHistory.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    numPendulums = Math.round(params.numPendulums ?? 15);
    gravity = params.gravity ?? 9.81;
    amplitude = params.amplitude ?? 30;
    lengthDelta = params.lengthDelta ?? 0.04;

    time += dt;

    // Record current bob positions for trail
    const currentPositions: Array<{ x: number; y: number; color: string }> = [];
    const barY = height * 0.08;
    const barStartX = width * 0.1;
    const barEndX = width * 0.9;
    const barWidth = barEndX - barStartX;
    const maxPendulumDrawLength = height * 0.72;

    for (let i = 0; i < numPendulums; i++) {
      const L = getPendulumLength(i);
      const T = getPeriod(L);
      const ampRad = (amplitude * Math.PI) / 180;
      const angle = ampRad * Math.sin((2 * Math.PI * time) / T);

      const anchorX = barStartX + (i / (numPendulums - 1 || 1)) * barWidth;
      // Scale the drawn string length: longer L = longer string on screen
      const maxL = getPendulumLength(numPendulums - 1);
      const minL = getPendulumLength(0);
      const minDrawLength = maxPendulumDrawLength * 0.5;
      const drawLength =
        minDrawLength +
        ((L - minL) / (maxL - minL || 1)) * (maxPendulumDrawLength - minDrawLength);

      const bobX = anchorX + drawLength * Math.sin(angle);
      const bobY = barY + drawLength * Math.cos(angle);

      currentPositions.push({ x: bobX, y: bobY, color: hslColor(i, numPendulums) });
    }

    trailHistory.push(currentPositions);
    if (trailHistory.length > MAX_TRAIL_LENGTH) {
      trailHistory.shift();
    }
  }

  function render(): void {
    // Dark background with subtle gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const barY = height * 0.08;
    const barStartX = width * 0.1;
    const barEndX = width * 0.9;
    const barWidth = barEndX - barStartX;
    const maxPendulumDrawLength = height * 0.72;

    // Draw mounting bar with metallic look
    const barGrad = ctx.createLinearGradient(barStartX, barY - 6, barStartX, barY + 6);
    barGrad.addColorStop(0, "#888");
    barGrad.addColorStop(0.5, "#ccc");
    barGrad.addColorStop(1, "#888");
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(barStartX - 10, barY - 6, barWidth + 20, 12, 6);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw mounting bracket ends
    for (const x of [barStartX - 10, barEndX + 10]) {
      ctx.fillStyle = "#666";
      ctx.fillRect(x - 4, barY - 20, 8, 20);
    }

    // Draw trails (afterglow)
    for (let t = 0; t < trailHistory.length - 1; t++) {
      const positions = trailHistory[t];
      const alpha = ((t + 1) / trailHistory.length) * 0.3;
      const radius = 4 + ((t + 1) / trailHistory.length) * 4;

      for (const pos of positions) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = pos.color.replace(/[\d.]+\)$/, `${alpha})`);
        ctx.fill();
      }
    }

    // Draw each pendulum
    for (let i = 0; i < numPendulums; i++) {
      const L = getPendulumLength(i);
      const T = getPeriod(L);
      const ampRad = (amplitude * Math.PI) / 180;
      const angle = ampRad * Math.sin((2 * Math.PI * time) / T);

      const anchorX = barStartX + (i / (numPendulums - 1 || 1)) * barWidth;
      const maxL = getPendulumLength(numPendulums - 1);
      const minL = getPendulumLength(0);
      const minDrawLength = maxPendulumDrawLength * 0.5;
      const drawLength =
        minDrawLength +
        ((L - minL) / (maxL - minL || 1)) * (maxPendulumDrawLength - minDrawLength);

      const bobX = anchorX + drawLength * Math.sin(angle);
      const bobY = barY + drawLength * Math.cos(angle);

      // Draw string
      ctx.beginPath();
      ctx.moveTo(anchorX, barY);
      ctx.lineTo(bobX, bobY);
      ctx.strokeStyle = `rgba(200, 200, 220, 0.4)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw pivot point
      ctx.beginPath();
      ctx.arc(anchorX, barY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#aaa";
      ctx.fill();

      // Draw bob glow
      const color = hslColor(i, numPendulums);
      const bobRadius = 10;
      const glow = ctx.createRadialGradient(bobX, bobY, 0, bobX, bobY, bobRadius * 3);
      glow.addColorStop(0, color.replace(/[\d.]+\)$/, "0.4)"));
      glow.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobRadius * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Draw bob
      const bobGrad = ctx.createRadialGradient(
        bobX - 2,
        bobY - 2,
        0,
        bobX,
        bobY,
        bobRadius
      );
      bobGrad.addColorStop(0, "#fff");
      bobGrad.addColorStop(0.3, color);
      bobGrad.addColorStop(1, color.replace("55%", "35%"));
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
      ctx.fillStyle = bobGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Title text
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    trailHistory.length = 0;
  }

  function destroy(): void {
    trailHistory.length = 0;
  }

  function getStateDescription(): string {
    const periods: string[] = [];
    for (let i = 0; i < Math.min(numPendulums, 5); i++) {
      const L = getPendulumLength(i);
      const T = getPeriod(L);
      periods.push(`P${i + 1}: L=${L.toFixed(3)}m, T=${T.toFixed(3)}s`);
    }
    return (
      `Pendulum Wave: ${numPendulums} pendulums, g=${gravity} m/s^2, ` +
      `amplitude=${amplitude} deg, lengthDelta=${lengthDelta}m. ` +
      `Time: ${time.toFixed(2)}s. ` +
      `First pendulums: ${periods.join("; ")}${numPendulums > 5 ? "..." : ""}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default PendulumWaveFactory;
