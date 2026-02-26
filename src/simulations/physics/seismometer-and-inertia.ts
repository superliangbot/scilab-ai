import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Seismometer And Inertia — shows how a seismometer works using the principle of inertia.
 * The heavy mass stays still while the ground (and frame) shakes, and the relative
 * displacement is recorded on a rotating drum.
 */

const SeismometerAndInertiaFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("seismometer-and-inertia") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let quakeFrequency = 3;
  let quakeAmplitude = 30;
  let damping = 0.5;
  let massSizeParam = 5;

  // Seismometer state
  let groundOffset = 0;
  let massOffset = 0;
  let massVelocity = 0;

  // Seismograph trace
  let trace: number[] = [];
  const MAX_TRACE = 400;

  let quakeActive = false;
  let quakeTimer = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    groundOffset = 0;
    massOffset = 0;
    massVelocity = 0;
    trace = [];
    quakeActive = true;
    quakeTimer = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    quakeFrequency = params.quakeFrequency ?? 3;
    quakeAmplitude = params.quakeAmplitude ?? 30;
    damping = params.damping ?? 0.5;
    massSizeParam = params.massSize ?? 5;

    const step = Math.min(dt, 0.033);
    time += step;
    quakeTimer += step;

    // Earthquake: sinusoidal ground motion with some noise
    if (quakeActive) {
      const envelope = Math.exp(-quakeTimer * 0.15) * Math.min(quakeTimer * 2, 1);
      groundOffset =
        quakeAmplitude *
        envelope *
        (Math.sin(quakeFrequency * quakeTimer * Math.PI * 2) +
          0.3 * Math.sin(quakeFrequency * 2.3 * quakeTimer * Math.PI * 2));
    }

    // Mass dynamics (spring-damper system relative to ground)
    // The mass is suspended by a spring from the frame
    // Spring force tries to bring mass toward frame position
    const springK = 0.5; // soft spring so mass stays relatively still
    const dampCoeff = damping * 2;
    const relDisp = groundOffset - massOffset;
    const springForce = springK * relDisp;
    const dampForce = -dampCoeff * massVelocity;

    const massInertia = massSizeParam; // heavier mass = more inertia
    const accel = (springForce + dampForce) / massInertia;
    massVelocity += accel * step;
    massOffset += massVelocity * step;

    // Record relative displacement (what the pen draws)
    const relativeMotion = groundOffset - massOffset;
    trace.push(relativeMotion);
    if (trace.length > MAX_TRACE) trace.shift();
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0e1520";
    ctx.fillRect(0, 0, width, height);

    const baseY = height * 0.55;
    const frameX = width * 0.3;

    // Ground
    ctx.fillStyle = "#2a1f10";
    ctx.fillRect(0, baseY + 60, width, height - baseY - 60);

    // Ground shake indicator
    ctx.save();
    ctx.translate(groundOffset, 0);

    // Seismometer frame (shakes with ground)
    const frameW = 120;
    const frameH = 160;
    const frameLeft = frameX - frameW / 2;
    const frameTop = baseY - frameH + 40;

    // Frame
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 3;
    ctx.strokeRect(frameLeft, frameTop, frameW, frameH);

    // Base (on ground)
    ctx.fillStyle = "#555";
    ctx.fillRect(frameLeft - 10, baseY + 30, frameW + 20, 30);

    // Support legs
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(frameLeft, baseY + 40);
    ctx.lineTo(frameLeft, frameTop + frameH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(frameLeft + frameW, baseY + 40);
    ctx.lineTo(frameLeft + frameW, frameTop + frameH);
    ctx.stroke();

    // Spring (from frame top to mass)
    const springTop = frameTop + 10;
    const springBot = frameTop + 50;
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const coils = 8;
    for (let i = 0; i <= coils * 4; i++) {
      const t = i / (coils * 4);
      const sy = springTop + t * (springBot - springTop);
      const sx = frameX + Math.sin(t * coils * Math.PI * 2) * 15;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    ctx.restore();

    // Mass (stays relatively still due to inertia)
    ctx.save();
    ctx.translate(massOffset, 0);

    const massY = baseY - 80;
    const massR = 15 + massSizeParam * 2;

    // Mass
    const mGrad = ctx.createRadialGradient(frameX - massR * 0.2, massY - massR * 0.2, 0, frameX, massY, massR);
    mGrad.addColorStop(0, "#888");
    mGrad.addColorStop(1, "#333");
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(frameX, massY, massR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pen (extends from mass downward)
    ctx.strokeStyle = "#ff4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(frameX, massY + massR);
    ctx.lineTo(frameX, baseY + 15);
    ctx.stroke();

    // Pen tip
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(frameX, baseY + 15, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Rotating drum / paper (shakes with ground)
    ctx.save();
    ctx.translate(groundOffset, 0);

    const drumX = frameX;
    const drumY = baseY + 15;
    const drumW = 90;

    // Paper
    ctx.fillStyle = "rgba(250, 245, 230, 0.9)";
    ctx.fillRect(drumX - drumW / 2, drumY - 20, drumW, 40);
    ctx.strokeStyle = "rgba(200, 190, 170, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(drumX - drumW / 2, drumY - 20, drumW, 40);

    ctx.restore();

    // Seismograph trace (on the right side)
    const traceX = width * 0.55;
    const traceY = height * 0.3;
    const traceW = width * 0.4;
    const traceH = height * 0.5;

    // Paper background
    ctx.fillStyle = "rgba(250, 245, 230, 0.95)";
    ctx.beginPath();
    ctx.roundRect(traceX, traceY, traceW, traceH, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 170, 150, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = "rgba(200, 190, 170, 0.3)";
    for (let i = 1; i < 5; i++) {
      const y = traceY + (traceH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(traceX, y);
      ctx.lineTo(traceX + traceW, y);
      ctx.stroke();
    }

    // Center line
    const centerY = traceY + traceH / 2;
    ctx.strokeStyle = "rgba(150, 140, 120, 0.4)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(traceX, centerY);
    ctx.lineTo(traceX + traceW, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Trace
    if (trace.length > 1) {
      ctx.strokeStyle = "#cc2222";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step = traceW / MAX_TRACE;
      for (let i = 0; i < trace.length; i++) {
        const x = traceX + i * step;
        const y = centerY - trace[i] * (traceH * 0.4) / (quakeAmplitude || 1);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Seismograph label
    ctx.fillStyle = "rgba(100, 80, 60, 0.7)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Seismograph Recording", traceX + traceW / 2, traceY - 8);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 260, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Seismometer & Inertia", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("Heavy mass resists motion (Newton's 1st Law)", 20, 46);
    ctx.fillText("Frame shakes with ground; mass stays still", 20, 62);
    ctx.fillText("Pen on mass records relative displacement", 20, 78);
    ctx.fillText(`Ground displacement: ${groundOffset.toFixed(1)} px`, 20, 94);
  }

  function reset(): void {
    time = 0;
    groundOffset = 0;
    massOffset = 0;
    massVelocity = 0;
    trace = [];
    quakeActive = true;
    quakeTimer = 0;
  }

  function destroy(): void {
    trace = [];
  }

  function getStateDescription(): string {
    return (
      `Seismometer & Inertia: Frequency=${quakeFrequency.toFixed(1)} Hz, Amplitude=${quakeAmplitude.toFixed(0)} px. ` +
      `Ground offset: ${groundOffset.toFixed(1)} px, Mass offset: ${massOffset.toFixed(1)} px. ` +
      `Relative displacement: ${(groundOffset - massOffset).toFixed(1)} px. ` +
      `The heavy mass stays still while the ground shakes. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SeismometerAndInertiaFactory;
