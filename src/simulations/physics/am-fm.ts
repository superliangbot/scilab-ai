import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const AmFmFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("am-fm") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Current parameters (cached from update)
  let modulationType = 0; // 0 = AM, 1 = FM
  let carrierFreq = 20;
  let messageFreq = 2;
  let modulationIndex = 0.8;

  // Visual constants
  const BG_COLOR_TOP = "#0d0d1a";
  const BG_COLOR_BOTTOM = "#0a0f1e";
  const MESSAGE_COLOR = "#4ade80";
  const MESSAGE_GLOW = "rgba(74, 222, 128, 0.3)";
  const CARRIER_COLOR = "#60a5fa";
  const CARRIER_GLOW = "rgba(96, 165, 250, 0.3)";
  const MODULATED_COLOR = "#f97316";
  const MODULATED_GLOW = "rgba(249, 115, 22, 0.35)";
  const GRID_COLOR = "rgba(255, 255, 255, 0.05)";
  const AXIS_COLOR = "rgba(255, 255, 255, 0.15)";
  const LABEL_COLOR = "rgba(255, 255, 255, 0.75)";
  const LABEL_DIM = "rgba(255, 255, 255, 0.4)";

  // Layout
  const PAD_LEFT = 72;
  const PAD_RIGHT = 18;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 22;
  const SECTION_GAP = 14;

  /** How many seconds of waveform are visible at once */
  const TIME_WINDOW = 3.0;

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------

  interface SectionBounds {
    top: number;
    bottom: number;
    centerY: number;
    height: number;
  }

  function getSections(): SectionBounds[] {
    const usable = height - PAD_TOP - PAD_BOTTOM - SECTION_GAP * 2;
    const sH = usable / 3;
    const out: SectionBounds[] = [];
    for (let i = 0; i < 3; i++) {
      const top = PAD_TOP + i * (sH + SECTION_GAP);
      out.push({ top, bottom: top + sH, centerY: top + sH / 2, height: sH });
    }
    return out;
  }

  // ---------------------------------------------------------------
  // Drawing routines
  // ---------------------------------------------------------------

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, BG_COLOR_TOP);
    grad.addColorStop(1, BG_COLOR_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(sections: SectionBounds[]): void {
    const plotL = PAD_LEFT;
    const plotR = width - PAD_RIGHT;
    const plotW = plotR - plotL;

    for (const sec of sections) {
      // Center axis
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotL, sec.centerY);
      ctx.lineTo(plotR, sec.centerY);
      ctx.stroke();

      // Section boundaries (subtle)
      ctx.strokeStyle = GRID_COLOR;
      ctx.beginPath();
      ctx.moveTo(plotL, sec.top);
      ctx.lineTo(plotR, sec.top);
      ctx.moveTo(plotL, sec.bottom);
      ctx.lineTo(plotR, sec.bottom);
      ctx.stroke();

      // Vertical grid lines (time ticks)
      const numVLines = 12;
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 1;
      for (let i = 1; i < numVLines; i++) {
        const x = plotL + (i / numVLines) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, sec.top);
        ctx.lineTo(x, sec.bottom);
        ctx.stroke();
      }

      // Amplitude guide lines at +/-0.5 and +/-1.0
      ctx.strokeStyle = GRID_COLOR;
      ctx.setLineDash([4, 6]);
      const halfAmp = sec.height / 2;
      for (const frac of [0.5, 1.0]) {
        ctx.beginPath();
        ctx.moveTo(plotL, sec.centerY - halfAmp * frac * 0.85);
        ctx.lineTo(plotR, sec.centerY - halfAmp * frac * 0.85);
        ctx.moveTo(plotL, sec.centerY + halfAmp * frac * 0.85);
        ctx.lineTo(plotR, sec.centerY + halfAmp * frac * 0.85);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  /**
   * Draw a scrolling waveform.  Right edge = current time.
   */
  function drawWaveform(
    sec: SectionBounds,
    color: string,
    glow: string,
    signalFn: (t: number) => number,
    maxAmp: number,
  ): void {
    const plotL = PAD_LEFT;
    const plotR = width - PAD_RIGHT;
    const plotW = plotR - plotL;
    const halfH = sec.height * 0.42;

    const startTime = time - TIME_WINDOW;
    const samples = Math.min(Math.floor(plotW * 2), 2000);
    const step = TIME_WINDOW / samples;

    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = startTime + i * step;
      const val = signalFn(t) / maxAmp;
      const x = plotL + (i / samples) * plotW;
      const y = sec.centerY - val * halfH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Glow pass
    ctx.strokeStyle = glow;
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Main stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  /**
   * Draw dashed AM envelope on the modulated section.
   */
  function drawAmEnvelope(sec: SectionBounds): void {
    const plotL = PAD_LEFT;
    const plotR = width - PAD_RIGHT;
    const plotW = plotR - plotL;
    const halfH = sec.height * 0.42;
    const maxAmp = 1 + modulationIndex;

    const startTime = time - TIME_WINDOW;
    const samples = Math.min(Math.floor(plotW), 1000);
    const step = TIME_WINDOW / samples;

    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(74, 222, 128, 0.35)";

    // Upper envelope
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = startTime + i * step;
      const env = (1 + modulationIndex * Math.sin(2 * Math.PI * messageFreq * t)) / maxAmp;
      const x = plotL + (i / samples) * plotW;
      const y = sec.centerY - env * halfH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Lower envelope
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const t = startTime + i * step;
      const env = -(1 + modulationIndex * Math.sin(2 * Math.PI * messageFreq * t)) / maxAmp;
      const x = plotL + (i / samples) * plotW;
      const y = sec.centerY - env * halfH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLabels(sections: SectionBounds[]): void {
    const isAM = modulationType < 0.5;
    const titles = ["Message Signal", "Carrier Wave", isAM ? "AM Output" : "FM Output"];
    const colors = [MESSAGE_COLOR, CARRIER_COLOR, MODULATED_COLOR];

    for (let i = 0; i < 3; i++) {
      const sec = sections[i];

      // Rotated label on the left margin
      ctx.save();
      ctx.translate(16, sec.centerY);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = colors[i];
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(titles[i], 0, 0);
      ctx.restore();

      // Amplitude labels
      ctx.fillStyle = LABEL_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("+1", PAD_LEFT - 8, sec.top + sec.height * 0.08);
      ctx.fillText(" 0", PAD_LEFT - 8, sec.centerY);
      ctx.fillText("-1", PAD_LEFT - 8, sec.bottom - sec.height * 0.08);
    }
  }

  function drawFormulas(sections: SectionBounds[]): void {
    const plotL = PAD_LEFT;
    const isAM = modulationType < 0.5;

    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Message
    ctx.fillStyle = "rgba(74, 222, 128, 0.6)";
    ctx.fillText(
      `m(t) = sin(2\u03C0\u00B7${messageFreq.toFixed(1)}\u00B7t)`,
      plotL + 8,
      sections[0].top + 4,
    );

    // Carrier
    ctx.fillStyle = "rgba(96, 165, 250, 0.6)";
    ctx.fillText(
      `c(t) = sin(2\u03C0\u00B7${carrierFreq.toFixed(0)}\u00B7t)`,
      plotL + 8,
      sections[1].top + 4,
    );

    // Modulated output
    if (isAM) {
      ctx.fillStyle = "rgba(249, 115, 22, 0.6)";
      ctx.fillText(
        `AM(t) = [1 + ${modulationIndex.toFixed(2)}\u00B7m(t)] \u00D7 c(t)`,
        plotL + 8,
        sections[2].top + 4,
      );
    } else {
      ctx.fillStyle = "rgba(249, 115, 22, 0.6)";
      ctx.fillText(
        `FM(t) = sin(2\u03C0\u00B7${carrierFreq.toFixed(0)}\u00B7t + ${modulationIndex.toFixed(2)}\u00B7sin(2\u03C0\u00B7${messageFreq.toFixed(1)}\u00B7t))`,
        plotL + 8,
        sections[2].top + 4,
      );
    }
  }

  function drawTimeAxis(sections: SectionBounds[]): void {
    const plotL = PAD_LEFT;
    const plotR = width - PAD_RIGHT;
    const plotW = plotR - plotL;
    const axisY = sections[2].bottom + 6;

    // Axis line
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotL, axisY);
    ctx.lineTo(plotR, axisY);
    ctx.stroke();

    // Time ticks
    const startTime = time - TIME_WINDOW;
    const tickInterval = 0.5;
    const firstTick = Math.ceil(startTime / tickInterval) * tickInterval;

    ctx.fillStyle = LABEL_DIM;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let t = firstTick; t <= time; t += tickInterval) {
      const frac = (t - startTime) / TIME_WINDOW;
      const x = plotL + frac * plotW;

      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, axisY + 4);
      ctx.strokeStyle = AXIS_COLOR;
      ctx.stroke();

      if (t >= 0) {
        ctx.fillText(`${t.toFixed(1)}s`, x, axisY + 6);
      }
    }
  }

  function drawInfoPanel(): void {
    const isAM = modulationType < 0.5;
    const panelW = 230;
    const panelH = 90;
    const panelX = width - PAD_RIGHT - panelW;
    const panelY = PAD_TOP;
    const lineH = 16;

    // Panel background
    ctx.fillStyle = "rgba(10, 10, 26, 0.82)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();

    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 10;
    let y = panelY + 8;

    // Title with mode badge
    ctx.fillStyle = MODULATED_COLOR;
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(isAM ? "Amplitude Modulation" : "Frequency Modulation", x, y);
    y += lineH + 2;

    ctx.font = "11px monospace";
    ctx.fillStyle = LABEL_DIM;
    ctx.fillText(`f_msg = ${messageFreq.toFixed(1)} Hz`, x, y);
    ctx.fillText(`f_car = ${carrierFreq.toFixed(0)} Hz`, x + 125, y);
    y += lineH;

    ctx.fillText(isAM ? `m = ${modulationIndex.toFixed(2)}` : `\u03B2 = ${modulationIndex.toFixed(2)}`, x, y);
    ctx.fillText(`t = ${time.toFixed(1)}s`, x + 125, y);
    y += lineH;

    // Bandwidth estimate
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    if (isAM) {
      const bw = 2 * messageFreq;
      ctx.fillText(`BW \u2248 ${bw.toFixed(1)} Hz`, x, y);
    } else {
      // Carson's rule: BW = 2(beta * f_m + f_m)
      const bw = 2 * (modulationIndex * messageFreq + messageFreq);
      ctx.fillText(`BW (Carson) \u2248 ${bw.toFixed(1)} Hz`, x, y);
    }
  }

  // ---------------------------------------------------------------
  // Signal functions
  // ---------------------------------------------------------------

  function messageSignal(t: number): number {
    return Math.sin(2 * Math.PI * messageFreq * t);
  }

  function carrierSignal(t: number): number {
    return Math.sin(2 * Math.PI * carrierFreq * t);
  }

  function modulatedSignal(t: number): number {
    if (modulationType < 0.5) {
      // AM: y = (1 + m * sin(2pi * f_m * t)) * sin(2pi * f_c * t)
      return (1 + modulationIndex * Math.sin(2 * Math.PI * messageFreq * t)) *
        Math.sin(2 * Math.PI * carrierFreq * t);
    } else {
      // FM: y = sin(2pi * f_c * t + beta * sin(2pi * f_m * t))
      return Math.sin(
        2 * Math.PI * carrierFreq * t +
        modulationIndex * Math.sin(2 * Math.PI * messageFreq * t),
      );
    }
  }

  // ---------------------------------------------------------------
  // Engine interface
  // ---------------------------------------------------------------

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    modulationType = params.modulationType ?? 0;
    carrierFreq = params.carrierFreq ?? 20;
    messageFreq = params.messageFreq ?? 2;
    modulationIndex = params.modulationIndex ?? 0.8;
    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    drawBackground();

    const sections = getSections();
    drawGrid(sections);

    // 1) Message signal (green)
    drawWaveform(sections[0], MESSAGE_COLOR, MESSAGE_GLOW, messageSignal, 1);

    // 2) Carrier wave (blue)
    drawWaveform(sections[1], CARRIER_COLOR, CARRIER_GLOW, carrierSignal, 1);

    // 3) Modulated output (orange)
    const isAM = modulationType < 0.5;
    const maxAmp = isAM ? 1 + modulationIndex : 1;
    drawWaveform(sections[2], MODULATED_COLOR, MODULATED_GLOW, modulatedSignal, maxAmp);

    // Draw AM envelope when in AM mode
    if (isAM) {
      drawAmEnvelope(sections[2]);
    }

    // Overlay: labels, formulas, axes, info panel
    drawLabels(sections);
    drawFormulas(sections);
    drawTimeAxis(sections);
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No external resources to release
  }

  function getStateDescription(): string {
    const isAM = modulationType < 0.5;
    const mode = isAM ? "AM (Amplitude Modulation)" : "FM (Frequency Modulation)";
    const indexLabel = isAM ? "modulation index m" : "modulation index \u03B2";

    let detail: string;
    if (isAM) {
      const pct = (modulationIndex * 100).toFixed(0);
      const note =
        modulationIndex > 1
          ? "over-modulated (envelope crosses zero, causing distortion)"
          : modulationIndex === 1
            ? "100% modulation (maximum without distortion)"
            : `${pct}% modulation`;
      detail =
        `${mode}: ${indexLabel} = ${modulationIndex.toFixed(2)} (${note}). ` +
        `Bandwidth \u2248 ${(2 * messageFreq).toFixed(1)} Hz.`;
    } else {
      const deviation = modulationIndex * messageFreq;
      const bw = 2 * (deviation + messageFreq);
      detail =
        `${mode}: ${indexLabel} = ${modulationIndex.toFixed(2)}, ` +
        `frequency deviation = ${deviation.toFixed(1)} Hz. ` +
        `Bandwidth (Carson's rule) \u2248 ${bw.toFixed(1)} Hz.`;
    }

    return (
      `AM/FM Modulation Simulation: Mode = ${mode}. ` +
      `Message frequency = ${messageFreq.toFixed(1)} Hz, ` +
      `Carrier frequency = ${carrierFreq.toFixed(0)} Hz. ` +
      detail +
      ` Time: ${time.toFixed(2)}s. ` +
      `Three waveforms displayed: message signal (green), carrier wave (blue), ` +
      `modulated output (orange). ` +
      `AM encodes information by varying carrier amplitude; FM varies carrier frequency. ` +
      `FM offers better noise immunity but uses more bandwidth.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default AmFmFactory;
