import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectricCircuitsAcFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electric-circuits-ac") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let acVoltage = 120; // V peak
  let frequency = 60; // Hz
  let resistance = 100; // Ω
  let capacitance = 10; // μF

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    acVoltage = params.acVoltage ?? 120;
    frequency = params.frequency ?? 60;
    resistance = params.resistance ?? 100;
    capacitance = params.capacitance ?? 10;
    time += dt;
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a2a";
    ctx.fillRect(0, 0, width, height);

    const omega = 2 * Math.PI * frequency;
    const capF = capacitance * 1e-6; // μF to F
    const Xc = 1 / (omega * capF); // capacitive reactance
    const Z = Math.sqrt(resistance * resistance + Xc * Xc); // impedance
    const peakCurrent = acVoltage / Z;
    const phaseAngle = Math.atan(Xc / resistance); // current lags voltage in RC
    const powerFactor = Math.cos(phaseAngle);
    const rmsVoltage = acVoltage / Math.sqrt(2);
    const rmsCurrent = peakCurrent / Math.sqrt(2);

    // Circuit diagram (top portion)
    const circY = height * 0.12;
    const circH = height * 0.2;
    const circX = width * 0.1;
    const circW = width * 0.8;

    // Wire path
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(circX, circY + circH / 2);
    ctx.lineTo(circX + circW * 0.15, circY + circH / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(circX + circW * 0.35, circY + circH / 2);
    ctx.lineTo(circX + circW * 0.5, circY + circH / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(circX + circW * 0.7, circY + circH / 2);
    ctx.lineTo(circX + circW, circY + circH / 2);
    ctx.lineTo(circX + circW, circY + circH);
    ctx.lineTo(circX, circY + circH);
    ctx.lineTo(circX, circY + circH / 2);
    ctx.stroke();

    // AC source symbol
    const srcX = circX;
    const srcY = circY + circH * 0.75;
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(srcX, srcY, 12, 0, Math.PI * 2);
    ctx.stroke();
    // Sine wave inside
    ctx.beginPath();
    for (let i = -8; i <= 8; i++) {
      const sx = srcX + i;
      const sy = srcY + 4 * Math.sin((i / 8) * Math.PI);
      if (i === -8) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    ctx.fillStyle = "#FFD700";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`AC ${acVoltage}V`, srcX, srcY - 18);
    ctx.fillText(`${frequency}Hz`, srcX, srcY + 24);

    // Resistor
    const rX = circX + circW * 0.25;
    const rY = circY + circH / 2;
    ctx.strokeStyle = "#ff8844";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rX - 30, rY);
    for (let i = 0; i < 6; i++) {
      const px = rX - 30 + i * 10;
      ctx.lineTo(px + 2.5, rY - 6);
      ctx.lineTo(px + 7.5, rY + 6);
      ctx.lineTo(px + 10, rY);
    }
    ctx.stroke();
    ctx.fillStyle = "#ff8844";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`R=${resistance}Ω`, rX, rY - 15);

    // Capacitor
    const cX = circX + circW * 0.6;
    const cY = circY + circH / 2;
    ctx.strokeStyle = "#44aaff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cX - 4, cY - 12);
    ctx.lineTo(cX - 4, cY + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cX + 4, cY - 12);
    ctx.lineTo(cX + 4, cY + 12);
    ctx.stroke();

    ctx.fillStyle = "#44aaff";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`C=${capacitance}μF`, cX, cY - 18);

    // Animated electrons
    const instantV = acVoltage * Math.sin(omega * time);
    const instantI = peakCurrent * Math.sin(omega * time - phaseAngle);
    const electronOffset = Math.sin(omega * time) * 15;

    ctx.fillStyle = "rgba(100,180,255,0.6)";
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const ex = circX + circW * 0.15 + t * circW * 0.85 + electronOffset;
      if (ex > circX && ex < circX + circW) {
        ctx.beginPath();
        ctx.arc(ex, circY + circH / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Waveform display (bottom portion)
    const waveY = height * 0.42;
    const waveH = height * 0.35;
    const waveX = width * 0.08;
    const waveW = width * 0.84;

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = waveY + (i / 4) * waveH;
      ctx.beginPath();
      ctx.moveTo(waveX, gy);
      ctx.lineTo(waveX + waveW, gy);
      ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const gx = waveX + (i / 8) * waveW;
      ctx.beginPath();
      ctx.moveTo(gx, waveY);
      ctx.lineTo(gx, waveY + waveH);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.moveTo(waveX, waveY + waveH / 2);
    ctx.lineTo(waveX + waveW, waveY + waveH / 2);
    ctx.stroke();

    // Voltage waveform
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const periods = 3;
    const period = 1 / frequency;
    for (let i = 0; i <= waveW; i++) {
      const t = (i / waveW) * period * periods;
      const v = acVoltage * Math.sin(omega * t);
      const y = waveY + waveH / 2 - (v / acVoltage) * (waveH * 0.4);
      if (i === 0) ctx.moveTo(waveX + i, y);
      else ctx.lineTo(waveX + i, y);
    }
    ctx.stroke();

    // Current waveform
    ctx.strokeStyle = "#44ff88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= waveW; i++) {
      const t = (i / waveW) * period * periods;
      const curr = peakCurrent * Math.sin(omega * t - phaseAngle);
      const y = waveY + waveH / 2 - (curr / peakCurrent) * (waveH * 0.4);
      if (i === 0) ctx.moveTo(waveX + i, y);
      else ctx.lineTo(waveX + i, y);
    }
    ctx.stroke();

    // Time marker
    const markerT = (time % (period * periods));
    const markerX = waveX + (markerT / (period * periods)) * waveW;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(markerX, waveY);
    ctx.lineTo(markerX, waveY + waveH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("— Voltage (V)", waveX, waveY - 8);
    ctx.fillStyle = "#44ff88";
    ctx.fillText("— Current (I)", waveX + 120, waveY - 8);

    // Phase info
    const phaseDeg = (phaseAngle * 180) / Math.PI;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`Phase angle: ${phaseDeg.toFixed(1)}° (current lags)`, waveX + 260, waveY - 8);

    // Axes labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`+${acVoltage}V`, waveX - 4, waveY + waveH * 0.1 + 4);
    ctx.fillText("0", waveX - 4, waveY + waveH / 2 + 4);
    ctx.fillText(`-${acVoltage}V`, waveX - 4, waveY + waveH * 0.9 + 4);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(8, height * 0.82, width - 16, height * 0.16, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("AC Circuit Analysis (RC)", 16, height * 0.82 + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#ccc";
    const col2 = width * 0.5;
    ctx.fillText(`Xc = 1/(ωC) = ${Xc.toFixed(1)} Ω`, 16, height * 0.82 + 38);
    ctx.fillText(`Z = √(R²+Xc²) = ${Z.toFixed(1)} Ω`, 16, height * 0.82 + 54);
    ctx.fillText(`I_peak = V/Z = ${(peakCurrent * 1000).toFixed(1)} mA`, col2, height * 0.82 + 38);
    ctx.fillText(`RMS: ${rmsVoltage.toFixed(1)}V, ${(rmsCurrent * 1000).toFixed(1)}mA`, col2, height * 0.82 + 54);
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`Power factor: cos(φ) = ${powerFactor.toFixed(3)}`, 16, height * 0.82 + 70);
    ctx.fillStyle = "#ccc";
    ctx.fillText(`P_avg = V_rms × I_rms × cos(φ) = ${(rmsVoltage * rmsCurrent * powerFactor).toFixed(2)} W`, col2, height * 0.82 + 70);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const omega = 2 * Math.PI * frequency;
    const capF = capacitance * 1e-6;
    const Xc = 1 / (omega * capF);
    const Z = Math.sqrt(resistance * resistance + Xc * Xc);
    const peakCurrent = acVoltage / Z;
    const phaseAngle = Math.atan(Xc / resistance);
    const powerFactor = Math.cos(phaseAngle);
    return (
      `AC Circuit: V_peak=${acVoltage}V, f=${frequency}Hz, R=${resistance}Ω, C=${capacitance}μF. ` +
      `Capacitive reactance Xc=${Xc.toFixed(1)}Ω, impedance Z=${Z.toFixed(1)}Ω. ` +
      `Peak current=${(peakCurrent * 1000).toFixed(1)}mA, ` +
      `phase angle=${((phaseAngle * 180) / Math.PI).toFixed(1)}° (current leads voltage in RC). ` +
      `Power factor=${powerFactor.toFixed(3)}.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectricCircuitsAcFactory;
