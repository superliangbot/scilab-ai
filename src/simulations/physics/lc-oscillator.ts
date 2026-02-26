import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LcOscillatorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lc-oscillator") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let inductance = 10; // mH
  let capacitance = 100; // uF
  let initialCharge = 1; // normalized 0-1
  let speed = 1;

  // State
  let charge = 1; // normalized capacitor charge (-1 to 1)
  let current = 0; // normalized current through inductor

  // History for graph
  const chargeHistory: number[] = [];
  const currentHistory: number[] = [];
  const MAX_HISTORY = 300;

  function resonantFreq(): number {
    const L = inductance * 1e-3;
    const C = capacitance * 1e-6;
    return 1 / (2 * Math.PI * Math.sqrt(L * C));
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    charge = initialCharge;
    current = 0;
    chargeHistory.length = 0;
    currentHistory.length = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    inductance = params.inductance ?? 10;
    capacitance = params.capacitance ?? 100;
    initialCharge = params.initialCharge ?? 1;
    speed = params.speed ?? 1;

    const dtClamped = Math.min(dt, 0.05) * speed;
    time += dtClamped;

    // LC oscillation: q(t) = Q0 * cos(omega*t), i(t) = -Q0*omega*sin(omega*t)
    const omega = 2 * Math.PI * resonantFreq();
    charge = initialCharge * Math.cos(omega * time);
    current = -initialCharge * omega * Math.sin(omega * time);

    // Record history
    chargeHistory.push(charge);
    currentHistory.push(current);
    if (chargeHistory.length > MAX_HISTORY) {
      chargeHistory.shift();
      currentHistory.shift();
    }
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0a1a");
    bg.addColorStop(1, "#1a1040");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("LC Oscillator", W / 2, 28);

    const f0 = resonantFreq();
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`f = 1/(2π√LC) = ${f0.toFixed(1)} Hz  |  T = ${(1 / f0 * 1000).toFixed(1)} ms`, W / 2, 48);

    // Draw circuit diagram
    const circX = W / 2 - 140;
    const circY = 70;
    const circW = 280;
    const circH = 180;

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(circX, circY, circW, circH);

    // Circuit loop
    const loopL = circX + 30;
    const loopR = circX + circW - 30;
    const loopT = circY + 30;
    const loopB = circY + circH - 30;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;

    // Top wire
    ctx.beginPath();
    ctx.moveTo(loopL, loopT);
    ctx.lineTo(loopL + 50, loopT);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(loopR - 50, loopT);
    ctx.lineTo(loopR, loopT);
    ctx.stroke();

    // Right wire (down)
    ctx.beginPath();
    ctx.moveTo(loopR, loopT);
    ctx.lineTo(loopR, loopB);
    ctx.stroke();

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(loopL, loopB);
    ctx.lineTo(loopL + 50, loopB);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(loopR - 50, loopB);
    ctx.lineTo(loopR, loopB);
    ctx.stroke();

    // Left wire (up)
    ctx.beginPath();
    ctx.moveTo(loopL, loopT);
    ctx.lineTo(loopL, loopB);
    ctx.stroke();

    // Capacitor (top, between loopL+50 and loopR-50)
    const capCx = (loopL + 50 + loopR - 50) / 2;
    const plateGap = 8;
    const plateH = 30;

    // Charge visualization on plates
    const absCharge = Math.abs(charge);
    const chargeColor = charge >= 0
      ? `rgba(239, 68, 68, ${absCharge * 0.8})`
      : `rgba(59, 130, 246, ${absCharge * 0.8})`;
    const chargeColorOpp = charge >= 0
      ? `rgba(59, 130, 246, ${absCharge * 0.8})`
      : `rgba(239, 68, 68, ${absCharge * 0.8})`;

    // Left plate
    ctx.fillStyle = chargeColor;
    ctx.fillRect(capCx - plateGap / 2 - 4, loopT - plateH / 2, 4, plateH);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(capCx - plateGap / 2, loopT - plateH / 2);
    ctx.lineTo(capCx - plateGap / 2, loopT + plateH / 2);
    ctx.stroke();

    // Right plate
    ctx.fillStyle = chargeColorOpp;
    ctx.fillRect(capCx + plateGap / 2, loopT - plateH / 2, 4, plateH);
    ctx.beginPath();
    ctx.moveTo(capCx + plateGap / 2, loopT - plateH / 2);
    ctx.lineTo(capCx + plateGap / 2, loopT + plateH / 2);
    ctx.stroke();

    // Charge symbols
    if (absCharge > 0.1) {
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = charge >= 0 ? "#ef4444" : "#3b82f6";
      ctx.fillText(charge >= 0 ? "+" : "−", capCx - plateGap / 2 - 12, loopT + 5);
      ctx.fillStyle = charge >= 0 ? "#3b82f6" : "#ef4444";
      ctx.fillText(charge >= 0 ? "−" : "+", capCx + plateGap / 2 + 12, loopT + 5);
    }

    // Label C
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "center";
    ctx.fillText(`C = ${capacitance} μF`, capCx, loopT - plateH / 2 - 8);

    // Inductor (bottom, coil representation)
    const indCx = (loopL + 50 + loopR - 50) / 2;
    const coilY = loopB;
    const bumps = 5;
    const coilW = (loopR - 50) - (loopL + 50);
    const bumpW = coilW / bumps;

    ctx.beginPath();
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    for (let i = 0; i < bumps; i++) {
      const bx = loopL + 50 + i * bumpW;
      ctx.arc(bx + bumpW / 2, coilY, bumpW / 2.5, Math.PI, 0, false);
    }
    ctx.stroke();

    // Magnetic field indication (proportional to current)
    const absCurrent = Math.abs(current);
    if (absCurrent > 0.05) {
      ctx.fillStyle = `rgba(16, 185, 129, ${absCurrent * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(indCx, coilY + 15, coilW / 2 * absCurrent, 10 * absCurrent, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label L
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "center";
    ctx.fillText(`L = ${inductance} mH`, indCx, coilY + 35);

    // Current direction arrow
    if (Math.abs(current) > 0.05) {
      const arrowDir = current > 0 ? 1 : -1;
      const arrowY = (loopT + loopB) / 2;

      // Left side current arrow
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      if (arrowDir > 0) {
        // Clockwise: down on right, up on left
        ctx.moveTo(loopL - 5, arrowY);
        ctx.lineTo(loopL - 12, arrowY + 8);
        ctx.lineTo(loopL + 2, arrowY + 8);
      } else {
        ctx.moveTo(loopL - 5, arrowY);
        ctx.lineTo(loopL - 12, arrowY - 8);
        ctx.lineTo(loopL + 2, arrowY - 8);
      }
      ctx.closePath();
      ctx.fill();

      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(`I = ${Math.abs(current).toFixed(2)}`, loopL - 15, arrowDir > 0 ? arrowY + 22 : arrowY - 14);
    }

    // Energy bars
    const barX = W - 120;
    const barY = 80;
    const barW = 25;
    const barH = 160;

    const eCapacitor = charge * charge;
    const eInductor = current * current;
    const eTotal = eCapacitor + eInductor;

    // Capacitor energy bar
    ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(barX, barY + barH * (1 - eCapacitor), barW, barH * eCapacitor);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "center";
    ctx.fillText("E_C", barX + barW / 2, barY + barH + 14);

    // Inductor energy bar
    ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
    ctx.fillRect(barX + 40, barY, barW, barH);
    ctx.fillStyle = "#10b981";
    ctx.fillRect(barX + 40, barY + barH * (1 - eInductor), barW, barH * eInductor);
    ctx.strokeRect(barX + 40, barY, barW, barH);
    ctx.fillStyle = "#10b981";
    ctx.fillText("E_L", barX + 40 + barW / 2, barY + barH + 14);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Energy", barX + 32, barY - 8);

    // Oscillation graph
    const graphL2 = 30;
    const graphT2 = H - 180;
    const graphW2 = W - 60;
    const graphH2 = 160;

    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.fillRect(graphL2, graphT2, graphW2, graphH2);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphL2, graphT2, graphW2, graphH2);

    // Center line
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.beginPath();
    ctx.moveTo(graphL2, graphT2 + graphH2 / 2);
    ctx.lineTo(graphL2 + graphW2, graphT2 + graphH2 / 2);
    ctx.stroke();

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText("Charge (q) & Current (i) vs Time", graphL2 + 5, graphT2 + 14);

    // Plot charge history
    if (chargeHistory.length > 1) {
      // Charge
      ctx.beginPath();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      for (let i = 0; i < chargeHistory.length; i++) {
        const px = graphL2 + (i / MAX_HISTORY) * graphW2;
        const py = graphT2 + graphH2 / 2 - chargeHistory[i] * (graphH2 * 0.4);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Current
      ctx.beginPath();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      for (let i = 0; i < currentHistory.length; i++) {
        const px = graphL2 + (i / MAX_HISTORY) * graphW2;
        const py = graphT2 + graphH2 / 2 - currentHistory[i] * (graphH2 * 0.4);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Legend for graph
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "right";
    ctx.fillText("— Charge (q)", graphL2 + graphW2 - 10, graphT2 + 14);
    ctx.fillStyle = "#10b981";
    ctx.fillText("— Current (i)", graphL2 + graphW2 - 10, graphT2 + 28);
  }

  function reset() {
    time = 0;
    charge = initialCharge;
    current = 0;
    chargeHistory.length = 0;
    currentHistory.length = 0;
  }

  function destroy() {
    chargeHistory.length = 0;
    currentHistory.length = 0;
  }

  function getStateDescription(): string {
    const f0 = resonantFreq();
    const eC = 0.5 * charge * charge;
    const eL = 0.5 * current * current;
    return (
      `LC Oscillator: L=${inductance}mH, C=${capacitance}μF. ` +
      `Resonant freq: ${f0.toFixed(1)}Hz, Period: ${(1000 / f0).toFixed(1)}ms. ` +
      `Charge: ${charge.toFixed(3)}, Current: ${current.toFixed(3)}. ` +
      `Capacitor energy: ${(eC * 100).toFixed(1)}%, Inductor energy: ${(eL * 100).toFixed(1)}%. ` +
      `Energy oscillates between electric (capacitor) and magnetic (inductor) fields.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LcOscillatorFactory;
