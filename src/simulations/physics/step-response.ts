import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StepResponseFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("step-response") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let damping = 0.5;
  let naturalFreq = 3;
  let stepAmplitude = 1;
  let showEnvelope = 1;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function stepResponse(t: number, zeta: number, wn: number, A: number): number {
    if (t < 0) return 0;
    if (zeta < 1) {
      // Underdamped
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      const envelope = Math.exp(-zeta * wn * t);
      const phi = Math.acos(zeta);
      return A * (1 - (envelope / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t + phi));
    } else if (Math.abs(zeta - 1) < 0.01) {
      // Critically damped
      const e = Math.exp(-wn * t);
      return A * (1 - (1 + wn * t) * e);
    } else {
      // Overdamped
      const s1 = -wn * (zeta + Math.sqrt(zeta * zeta - 1));
      const s2 = -wn * (zeta - Math.sqrt(zeta * zeta - 1));
      return A * (1 - (s1 * Math.exp(s2 * t) - s2 * Math.exp(s1 * t)) / (s1 - s2));
    }
  }

  function envelope(t: number, zeta: number, wn: number, A: number): { upper: number; lower: number } {
    if (t < 0 || zeta >= 1) return { upper: A, lower: A };
    const env = (A / Math.sqrt(1 - zeta * zeta)) * Math.exp(-zeta * wn * t);
    return { upper: A + env, lower: A - env };
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    damping = params.damping ?? 0.5;
    naturalFreq = params.naturalFreq ?? 3;
    stepAmplitude = params.stepAmplitude ?? 1;
    showEnvelope = params.showEnvelope ?? 1;
    time += step;
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f1923");
    bgGrad.addColorStop(1, "#1a2332");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Graph area
    const margin = { left: 60, right: 30, top: 70, bottom: 55 };
    const gw = width - margin.left - margin.right;
    const gh = height - margin.top - margin.bottom;

    // Grid background
    ctx.fillStyle = "rgba(20,30,45,0.8)";
    ctx.beginPath();
    ctx.roundRect(margin.left - 5, margin.top - 5, gw + 10, gh + 10, 4);
    ctx.fill();

    // Time range based on damping & frequency
    const tMax = Math.max(3, 10 / (damping * naturalFreq + 0.5));
    const yMin = -0.3 * stepAmplitude;
    const yMax = stepAmplitude * 2.2;

    function toScreenX(t: number): number {
      return margin.left + (t / tMax) * gw;
    }
    function toScreenY(y: number): number {
      return margin.top + gh - ((y - yMin) / (yMax - yMin)) * gh;
    }

    // Grid lines
    ctx.strokeStyle = "rgba(100,150,200,0.1)";
    ctx.lineWidth = 0.5;
    const numXGrid = 10;
    for (let i = 0; i <= numXGrid; i++) {
      const x = margin.left + (i / numXGrid) * gw;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + gh);
      ctx.stroke();
    }
    const numYGrid = 8;
    for (let i = 0; i <= numYGrid; i++) {
      const y = margin.top + (i / numYGrid) * gh;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + gw, y);
      ctx.stroke();
    }

    // Steady state line
    ctx.strokeStyle = "rgba(255,255,100,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    const ssY = toScreenY(stepAmplitude);
    ctx.beginPath();
    ctx.moveTo(margin.left, ssY);
    ctx.lineTo(margin.left + gw, ssY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,100,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`y = ${stepAmplitude.toFixed(1)}`, margin.left - 5, ssY + 4);

    // Zero line
    const zeroY = toScreenY(0);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(margin.left + gw, zeroY);
    ctx.stroke();

    // Draw envelope for underdamped
    if (showEnvelope > 0.5 && damping < 1) {
      ctx.fillStyle = "rgba(100,180,255,0.08)";
      ctx.beginPath();
      const steps = 200;
      // Upper envelope
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * tMax;
        const env = envelope(t, damping, naturalFreq * 2 * Math.PI, stepAmplitude);
        const sx = toScreenX(t);
        const sy = toScreenY(env.upper);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      // Lower envelope (reverse)
      for (let i = steps; i >= 0; i--) {
        const t = (i / steps) * tMax;
        const env = envelope(t, damping, naturalFreq * 2 * Math.PI, stepAmplitude);
        const sx = toScreenX(t);
        const sy = toScreenY(env.lower);
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();

      // Envelope lines
      ctx.strokeStyle = "rgba(100,180,255,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * tMax;
        const env = envelope(t, damping, naturalFreq * 2 * Math.PI, stepAmplitude);
        const sx = toScreenX(t);
        if (i === 0) ctx.moveTo(sx, toScreenY(env.upper));
        else ctx.lineTo(sx, toScreenY(env.upper));
      }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * tMax;
        const env = envelope(t, damping, naturalFreq * 2 * Math.PI, stepAmplitude);
        const sx = toScreenX(t);
        if (i === 0) ctx.moveTo(sx, toScreenY(env.lower));
        else ctx.lineTo(sx, toScreenY(env.lower));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw step response curve
    const wn = naturalFreq * 2 * Math.PI;
    ctx.strokeStyle = "#4fc3f7";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const plotSteps = 500;
    // Show animated drawing up to current time
    const displayTime = Math.min(time * 1.5, tMax);
    for (let i = 0; i <= plotSteps; i++) {
      const t = (i / plotSteps) * displayTime;
      const y = stepResponse(t, damping, wn, stepAmplitude);
      const sx = toScreenX(t);
      const sy = toScreenY(y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Current point
    if (displayTime > 0) {
      const curY = stepResponse(displayTime, damping, wn, stepAmplitude);
      const curSx = toScreenX(displayTime);
      const curSy = toScreenY(curY);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(curSx, curSy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Annotations for underdamped
    if (damping < 1) {
      // Find overshoot peak
      const wd = wn * Math.sqrt(1 - damping * damping);
      const tPeak = Math.PI / wd;
      const yPeak = stepResponse(tPeak, damping, wn, stepAmplitude);
      const overshoot = ((yPeak - stepAmplitude) / stepAmplitude) * 100;

      if (tPeak < tMax && displayTime > tPeak) {
        const peakSx = toScreenX(tPeak);
        const peakSy = toScreenY(yPeak);

        ctx.fillStyle = "#ff6b6b";
        ctx.beginPath();
        ctx.arc(peakSx, peakSy, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,100,100,0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(peakSx, peakSy);
        ctx.lineTo(peakSx, ssY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#ff8888";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`OS: ${overshoot.toFixed(1)}%`, peakSx, peakSy - 10);
      }

      // Rise time (10% to 90%)
      const y10 = stepAmplitude * 0.1;
      const y90 = stepAmplitude * 0.9;
      let tRise10 = 0;
      let tRise90 = 0;
      for (let t = 0; t < tMax; t += 0.001) {
        const y = stepResponse(t, damping, wn, stepAmplitude);
        if (y >= y10 && tRise10 === 0) tRise10 = t;
        if (y >= y90 && tRise90 === 0) { tRise90 = t; break; }
      }
      const riseTime = tRise90 - tRise10;

      // Settling time (within 2%)
      let tSettle = tMax;
      for (let t = tMax; t > 0; t -= 0.01) {
        const y = stepResponse(t, damping, wn, stepAmplitude);
        if (Math.abs(y - stepAmplitude) > 0.02 * stepAmplitude) { tSettle = t + 0.01; break; }
      }

      // Display metrics at bottom right of graph
      const metricsX = margin.left + gw - 5;
      const metricsY = margin.top + gh - 55;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(metricsX - 145, metricsY - 5, 150, 55, 4);
      ctx.fill();

      ctx.fillStyle = "#aaddff";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`Rise time: ${riseTime.toFixed(3)}s`, metricsX, metricsY + 10);
      ctx.fillText(`Overshoot: ${overshoot.toFixed(1)}%`, metricsX, metricsY + 24);
      ctx.fillText(`Settling time: ${tSettle.toFixed(3)}s`, metricsX, metricsY + 38);
    }

    // Axes labels
    ctx.fillStyle = "#8899aa";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time (s)", margin.left + gw / 2, height - 10);

    ctx.save();
    ctx.translate(15, margin.top + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Response y(t)", 0, 0);
    ctx.restore();

    // X-axis tick labels
    ctx.fillStyle = "#667";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i <= 5; i++) {
      const t = (i / 5) * tMax;
      ctx.fillText(t.toFixed(1), toScreenX(t), margin.top + gh + 15);
    }

    // Y-axis tick labels
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = yMin + (i / 4) * (yMax - yMin);
      ctx.fillText(y.toFixed(1), margin.left - 8, toScreenY(y) + 4);
    }

    // Title and info panel
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(10, 8, width * 0.7, 52, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Step Response of 2nd-Order System", 20, 28);

    const dampLabel = damping < 0.99 ? "Underdamped" : damping > 1.01 ? "Overdamped" : "Critically Damped";
    const dampColor = damping < 0.99 ? "#4fc3f7" : damping > 1.01 ? "#ff8a65" : "#66bb6a";
    ctx.fillStyle = dampColor;
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`\u03B6 = ${damping.toFixed(2)} (${dampLabel})  |  \u03C9n = ${naturalFreq.toFixed(1)} Hz  |  A = ${stepAmplitude.toFixed(1)}`, 20, 48);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const dampLabel = damping < 0.99 ? "underdamped" : damping > 1.01 ? "overdamped" : "critically damped";
    return (
      `Step response of a 2nd-order system: damping ratio \u03B6=${damping.toFixed(2)} (${dampLabel}), ` +
      `natural frequency \u03C9n=${naturalFreq.toFixed(1)} Hz, step amplitude=${stepAmplitude.toFixed(1)}. ` +
      `y(t) = A(1 - e^{-\u03B6\u03C9n t}/sqrt(1-\u03B6^2) * sin(\u03C9d t + \u03C6)) for underdamped case.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StepResponseFactory;
