import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface ChargeDot {
  t: number; // position along wire path [0,1]
}

const DCandACFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("dc-and-ac") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let dcVoltage = 12;
  let acAmplitude = 12;
  let acFrequency = 10;
  let showWaveform = 1;

  // Charge dots for each circuit
  const DC_NUM_DOTS = 14;
  const AC_NUM_DOTS = 14;
  const dcDots: ChargeDot[] = [];
  const acDots: ChargeDot[] = [];

  // Waveform histories
  const WAVEFORM_MAX = 200;
  const dcWaveform: number[] = [];
  const acWaveform: number[] = [];
  let waveformTimer = 0;
  const SAMPLE_INTERVAL = 0.02;

  // Colors
  const BG = "#0a0e1a";
  const DC_COLOR = "#3b82f6";
  const DC_COLOR_DIM = "rgba(59, 130, 246, 0.3)";
  const AC_COLOR = "#f59e0b";
  const AC_COLOR_DIM = "rgba(245, 158, 11, 0.3)";
  const WIRE_COLOR = "#475569";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#64748b";
  const GRID_COLOR = "rgba(51, 65, 85, 0.3)";
  const RESISTANCE = 10; // ohms for both circuits

  function initDots() {
    dcDots.length = 0;
    acDots.length = 0;
    for (let i = 0; i < DC_NUM_DOTS; i++) dcDots.push({ t: i / DC_NUM_DOTS });
    for (let i = 0; i < AC_NUM_DOTS; i++) acDots.push({ t: i / AC_NUM_DOTS });
  }

  /** Draw a simple battery symbol at (cx,cy) */
  function drawBattery(cx: number, cy: number, voltage: number) {
    const w = 30, h = 50;
    // Long plate (+)
    ctx.strokeStyle = DC_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - h / 2);
    ctx.lineTo(cx + 12, cy - h / 2);
    ctx.stroke();
    // Short plate (-)
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - h / 2 + 10);
    ctx.lineTo(cx + 7, cy - h / 2 + 10);
    ctx.stroke();
    // Second long plate
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - h / 2 + 20);
    ctx.lineTo(cx + 12, cy - h / 2 + 20);
    ctx.stroke();
    // Second short plate
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - h / 2 + 30);
    ctx.lineTo(cx + 7, cy - h / 2 + 30);
    ctx.stroke();
    // + and - labels
    ctx.fillStyle = DC_COLOR;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", cx + 20, cy - h / 2 + 2);
    ctx.fillText("\u2212", cx + 20, cy - h / 2 + 28);
    // Voltage label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.fillText(`${voltage.toFixed(1)}V`, cx, cy + h / 2 + 14);
  }

  /** Draw an AC source symbol */
  function drawACSource(cx: number, cy: number, amplitude: number) {
    const r = 22;
    ctx.strokeStyle = AC_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Sine wave inside
    ctx.beginPath();
    for (let i = -r + 4; i <= r - 4; i++) {
      const x = cx + i;
      const y = cy - Math.sin((i / (r - 4)) * Math.PI * 2) * 8;
      if (i === -r + 4) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${amplitude.toFixed(1)}V`, cx, cy + r + 14);
    ctx.fillStyle = AC_COLOR;
    ctx.font = "10px monospace";
    ctx.fillText(`${acFrequency}Hz`, cx, cy + r + 26);
  }

  /** Draw a light bulb with variable brightness */
  function drawBulb(cx: number, cy: number, brightness: number, color: string) {
    const r = 16;
    const b = Math.max(0, Math.min(1, brightness));

    if (b > 0.02) {
      const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r + 15 + b * 20);
      grd.addColorStop(0, `rgba(255, 250, 200, ${b * 0.6})`);
      grd.addColorStop(0.6, `rgba(255, 220, 100, ${b * 0.2})`);
      grd.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 15 + b * 20, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = `rgba(255, 250, 200, ${0.3 + b * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 240, 150, ${b * 0.4})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Filament
    ctx.strokeStyle = `rgba(255, 200, 50, ${0.3 + b * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 5);
    ctx.lineTo(cx - 7, cy - 5);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx, cy - 5);
    ctx.lineTo(cx + 7, cy + 3);
    ctx.lineTo(cx + 5, cy - 5);
    ctx.stroke();

    // Screw base
    ctx.strokeStyle = "#78716c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + r);
    ctx.lineTo(cx - 8, cy + r + 8);
    ctx.lineTo(cx + 8, cy + r + 8);
    ctx.lineTo(cx + 8, cy + r);
    ctx.stroke();
  }

  /** Draw a rectangular circuit loop with the given component positions */
  function drawCircuitWires(left: number, top: number, w: number, h: number) {
    ctx.strokeStyle = WIRE_COLOR;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, 10);
    ctx.stroke();
  }

  /** Draw animated charge dots along a rectangular path */
  function drawCharges(dots: ChargeDot[], left: number, top: number, w: number, h: number, color: string, alpha: number) {
    const perimeter = 2 * (w + h);
    for (const dot of dots) {
      // Map t [0,1] to position on rectangular path
      const dist = dot.t * perimeter;
      let x: number, y: number;
      if (dist < w) {
        // Top edge, left to right
        x = left + dist; y = top;
      } else if (dist < w + h) {
        // Right edge, top to bottom
        x = left + w; y = top + (dist - w);
      } else if (dist < 2 * w + h) {
        // Bottom edge, right to left
        x = left + w - (dist - w - h); y = top + h;
      } else {
        // Left edge, bottom to top
        x = left; y = top + h - (dist - 2 * w - h);
      }

      ctx.fillStyle = color.replace(")", `, ${alpha * 0.3})`).replace("rgb", "rgba");
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color.replace(")", `, ${alpha})`).replace("rgb", "rgba");
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Draw an oscilloscope-style waveform */
  function drawWaveformPlot(ox: number, oy: number, w: number, h: number, data: number[], maxV: number, color: string, label: string) {
    // Panel background
    ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox, oy, w, h, 6);
    ctx.stroke();

    const pad = 24;
    const pL = ox + pad + 8, pR = ox + w - pad / 2;
    const pT = oy + pad, pB = oy + h - pad / 2;
    const pW = pR - pL, pH = pB - pT;
    const pCY = pT + pH / 2;

    // Grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const gy = pT + (i / 4) * pH;
      ctx.beginPath(); ctx.moveTo(pL, gy); ctx.lineTo(pR, gy); ctx.stroke();
    }

    // Center axis
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pL, pCY); ctx.lineTo(pR, pCY); ctx.stroke();

    // Data
    if (data.length > 1 && maxV > 0.01) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = pR - ((data.length - 1 - i) / WAVEFORM_MAX) * pW;
        const y = pCY - (data[i] / maxV) * (pH / 2) * 0.85;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Labels
    ctx.fillStyle = color;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label, ox + 6, oy + 4);

    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    if (maxV > 0.01) {
      ctx.fillText(`+${maxV.toFixed(1)}V`, pL - 3, pT + 4);
      ctx.fillText(`-${maxV.toFixed(1)}V`, pL - 3, pB - 4);
    }
    ctx.fillText("0", pL - 3, pCY);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initDots();
    dcWaveform.length = 0;
    acWaveform.length = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    dcVoltage = params.dcVoltage ?? 12;
    acAmplitude = params.acAmplitude ?? 12;
    acFrequency = params.acFrequency ?? 10;
    showWaveform = params.showWaveform ?? 1;

    time += dt;

    // DC dots: steady flow proportional to voltage
    const dcCurrent = dcVoltage / RESISTANCE;
    const dcSpeed = dcCurrent * 0.03;
    for (const dot of dcDots) {
      dot.t = (dot.t + dcSpeed * dt) % 1;
      if (dot.t < 0) dot.t += 1;
    }

    // AC dots: oscillate back and forth
    const omega = 2 * Math.PI * acFrequency;
    const acVoltageNow = acAmplitude * Math.sin(omega * time);
    const acCurrentNow = acVoltageNow / RESISTANCE;
    const acSpeed = acCurrentNow * 0.03;
    for (const dot of acDots) {
      dot.t = (dot.t + acSpeed * dt) % 1;
      if (dot.t < 0) dot.t += 1;
    }

    // Sample waveforms
    waveformTimer += dt;
    if (waveformTimer >= SAMPLE_INTERVAL) {
      waveformTimer -= SAMPLE_INTERVAL;
      dcWaveform.push(dcVoltage);
      acWaveform.push(acVoltageNow);
      if (dcWaveform.length > WAVEFORM_MAX) dcWaveform.shift();
      if (acWaveform.length > WAVEFORM_MAX) acWaveform.shift();
    }
  }

  function render(): void {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);

    const halfW = width / 2;
    const circuitH = showWaveform ? height * 0.52 : height * 0.82;
    const waveformTop = circuitH + 10;

    // --- DC Circuit (left half) ---
    const dcL = 30, dcT = 50, dcW = halfW - 60, dcH = circuitH - 80;
    const dcCX = dcL + dcW / 2, dcCY = dcT + dcH / 2;

    // Title
    ctx.fillStyle = DC_COLOR;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("DC - Direct Current", dcL + dcW / 2, 8);

    // Circuit wires
    drawCircuitWires(dcL, dcT, dcW, dcH);

    // Battery on the left side
    drawBattery(dcL, dcCY, dcVoltage);

    // Bulb on the right side
    const dcBulbBrightness = dcVoltage / 24;
    drawBulb(dcL + dcW, dcCY, dcBulbBrightness, DC_COLOR);

    // Animated charges
    const dcAlpha = Math.min(dcVoltage / 24, 1) * 0.8 + 0.2;
    drawCharges(dcDots, dcL, dcT, dcW, dcH, "rgb(59, 130, 246)", dcAlpha);

    // Current direction arrows (clockwise)
    ctx.fillStyle = DC_COLOR;
    const arrowS = 6;
    // Top arrow pointing right
    const atx = dcL + dcW / 2, aty = dcT;
    ctx.beginPath();
    ctx.moveTo(atx + arrowS, aty);
    ctx.lineTo(atx - arrowS, aty - arrowS * 0.6);
    ctx.lineTo(atx - arrowS, aty + arrowS * 0.6);
    ctx.closePath();
    ctx.fill();

    // DC info
    const dcI = (dcVoltage / RESISTANCE).toFixed(2);
    const dcP = ((dcVoltage * dcVoltage) / RESISTANCE).toFixed(1);
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`I = V/R = ${dcVoltage.toFixed(1)}/${RESISTANCE} = ${dcI} A`, dcL + dcW / 2, dcT + dcH + 16);
    ctx.fillText(`P = V\u00B2/R = ${dcP} W`, dcL + dcW / 2, dcT + dcH + 30);

    // Resistor label
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.fillText(`R = ${RESISTANCE}\u03A9`, dcL + dcW + 30, dcCY + 36);

    // --- AC Circuit (right half) ---
    const acL = halfW + 30, acT = 50, acW = halfW - 60, acH = circuitH - 80;
    const acCX = acL + acW / 2, acCY = acT + acH / 2;

    // Title
    ctx.fillStyle = AC_COLOR;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("AC - Alternating Current", acL + acW / 2, 8);

    // Circuit wires
    drawCircuitWires(acL, acT, acW, acH);

    // AC source on the left side
    drawACSource(acL, acCY, acAmplitude);

    // Bulb on the right side
    const omega = 2 * Math.PI * acFrequency;
    const acVNow = acAmplitude * Math.sin(omega * time);
    const acBulbBrightness = Math.abs(acVNow) / 24;
    drawBulb(acL + acW, acCY, acBulbBrightness, AC_COLOR);

    // Animated charges
    const acAlpha = Math.min(Math.abs(acVNow) / 24, 1) * 0.8 + 0.2;
    drawCharges(acDots, acL, acT, acW, acH, "rgb(245, 158, 11)", acAlpha);

    // Current direction arrow (changes with AC)
    const acDir = acVNow >= 0 ? 1 : -1;
    ctx.fillStyle = AC_COLOR;
    const atx2 = acL + acW / 2, aty2 = acT;
    ctx.beginPath();
    ctx.moveTo(atx2 + acDir * arrowS, aty2);
    ctx.lineTo(atx2 - acDir * arrowS, aty2 - arrowS * 0.6);
    ctx.lineTo(atx2 - acDir * arrowS, aty2 + arrowS * 0.6);
    ctx.closePath();
    ctx.fill();

    // AC info
    const vRms = (acAmplitude / Math.SQRT2).toFixed(2);
    const iRms = (acAmplitude / (Math.SQRT2 * RESISTANCE)).toFixed(2);
    const pAvg = ((acAmplitude * acAmplitude) / (2 * RESISTANCE)).toFixed(1);
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`V_rms = V_peak/\u221A2 = ${vRms} V`, acL + acW / 2, acT + acH + 16);
    ctx.fillText(`I_rms = ${iRms} A   P_avg = ${pAvg} W`, acL + acW / 2, acT + acH + 30);

    ctx.fillStyle = TEXT_DIM;
    ctx.font = "9px monospace";
    ctx.fillText(`R = ${RESISTANCE}\u03A9`, acL + acW + 30, acCY + 36);

    // Divider line between DC and AC
    ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(halfW, 0);
    ctx.lineTo(halfW, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Waveform displays ---
    if (showWaveform >= 1) {
      const wfH = height - waveformTop - 10;
      const wfW = halfW - 20;

      // DC waveform
      drawWaveformPlot(10, waveformTop, wfW, wfH, dcWaveform, 24, DC_COLOR, "DC Voltage V(t)");

      // AC waveform
      drawWaveformPlot(halfW + 10, waveformTop, wfW, wfH, acWaveform, 24, AC_COLOR, "AC Voltage V(t)");

      // RMS line on AC waveform
      const acPad = 24;
      const acPL = halfW + 10 + acPad + 8;
      const acPR = halfW + 10 + wfW - acPad / 2;
      const acPT = waveformTop + acPad;
      const acPH = wfH - acPad - acPad / 2;
      const acPCY = acPT + acPH / 2;
      const rmsY = acPCY - (parseFloat(vRms) / 24) * (acPH / 2) * 0.85;
      const rmsYNeg = acPCY + (parseFloat(vRms) / 24) * (acPH / 2) * 0.85;

      ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(acPL, rmsY);
      ctx.lineTo(acPR, rmsY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(acPL, rmsYNeg);
      ctx.lineTo(acPR, rmsYNeg);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = AC_COLOR_DIM;
      ctx.font = "8px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("RMS", acPR - 22, rmsY - 1);
    }

    // Time display
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(2)}s`, 8, height - 2);
  }

  function reset(): void {
    time = 0;
    waveformTimer = 0;
    dcWaveform.length = 0;
    acWaveform.length = 0;
    initDots();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const omega = 2 * Math.PI * acFrequency;
    const acVNow = acAmplitude * Math.sin(omega * time);
    const vRms = acAmplitude / Math.SQRT2;
    const dcI = dcVoltage / RESISTANCE;
    const acIRms = vRms / RESISTANCE;
    return (
      `DC & AC Comparison: DC voltage=${dcVoltage}V (constant), ` +
      `DC current=${dcI.toFixed(2)}A. ` +
      `AC amplitude=${acAmplitude}V at ${acFrequency}Hz, ` +
      `AC instantaneous voltage=${acVNow.toFixed(2)}V, ` +
      `V_rms=${vRms.toFixed(2)}V, I_rms=${acIRms.toFixed(2)}A. ` +
      `R=${RESISTANCE}\u03A9. V(t) = V_peak \u00D7 sin(2\u03C0ft). ` +
      `V_rms = V_peak / \u221A2.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DCandACFactory;
