import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const AmFmFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("am-fm") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let messageFreq = 1;
  let carrierFreq = 15;
  let amIndex = 0.7;
  let fmIndex = 5;

  // Colors
  const BG_TOP = "#0a0a1a";
  const BG_BOTTOM = "#0c0c24";
  const MESSAGE_COLOR = "#eab308";
  const MESSAGE_GLOW = "rgba(234, 179, 8, 0.3)";
  const AM_COLOR = "#06b6d4";
  const AM_GLOW = "rgba(6, 182, 212, 0.3)";
  const FM_COLOR = "#22c55e";
  const FM_GLOW = "rgba(34, 197, 94, 0.3)";
  const AXIS_COLOR = "rgba(255, 255, 255, 0.12)";
  const LABEL_DIM = "rgba(255, 255, 255, 0.4)";
  const GRID_COLOR = "rgba(255, 255, 255, 0.04)";

  // Layout
  const PADDING_LEFT = 70;
  const PADDING_RIGHT = 20;
  const PADDING_TOP = 22;
  const PADDING_BOTTOM = 22;
  const SECTION_GAP = 14;

  /** Visible time window in seconds */
  const TIME_WINDOW = 3.0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    messageFreq = params.messageFreq ?? 1;
    carrierFreq = params.carrierFreq ?? 15;
    amIndex = params.amIndex ?? 0.7;
    fmIndex = params.fmIndex ?? 5;
    time += dt;
  }

  /** Get vertical bounds for each of the three sections */
  function getSectionBounds(): Array<{
    top: number;
    bottom: number;
    centerY: number;
    height: number;
  }> {
    const usableHeight = height - PADDING_TOP - PADDING_BOTTOM - SECTION_GAP * 2;
    const sectionH = usableHeight / 3;
    const sections = [];
    for (let i = 0; i < 3; i++) {
      const top = PADDING_TOP + i * (sectionH + SECTION_GAP);
      const bottom = top + sectionH;
      sections.push({
        top,
        bottom,
        centerY: (top + bottom) / 2,
        height: sectionH,
      });
    }
    return sections;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, BG_TOP);
    bgGrad.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(
    sections: Array<{
      top: number;
      bottom: number;
      centerY: number;
      height: number;
    }>
  ): void {
    const plotLeft = PADDING_LEFT;
    const plotRight = width - PADDING_RIGHT;

    for (const sec of sections) {
      // Center axis
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, sec.centerY);
      ctx.lineTo(plotRight, sec.centerY);
      ctx.stroke();

      // Top/bottom boundary
      ctx.strokeStyle = GRID_COLOR;
      ctx.beginPath();
      ctx.moveTo(plotLeft, sec.top);
      ctx.lineTo(plotRight, sec.top);
      ctx.moveTo(plotLeft, sec.bottom);
      ctx.lineTo(plotRight, sec.bottom);
      ctx.stroke();

      // Amplitude guides
      ctx.setLineDash([4, 6]);
      const halfAmp = sec.height / 2;
      for (const frac of [0.5, 1.0]) {
        ctx.beginPath();
        ctx.moveTo(plotLeft, sec.centerY - halfAmp * frac * 0.85);
        ctx.lineTo(plotRight, sec.centerY - halfAmp * frac * 0.85);
        ctx.moveTo(plotLeft, sec.centerY + halfAmp * frac * 0.85);
        ctx.lineTo(plotRight, sec.centerY + halfAmp * frac * 0.85);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }

  /** Draw a scrolling waveform */
  function drawWaveform(
    section: {
      top: number;
      bottom: number;
      centerY: number;
      height: number;
    },
    color: string,
    glowColor: string,
    signalFn: (t: number) => number,
    maxAmplitude: number
  ): void {
    const plotLeft = PADDING_LEFT;
    const plotRight = width - PADDING_RIGHT;
    const plotWidth = plotRight - plotLeft;
    const halfHeight = section.height * 0.42;

    const startTime = time - TIME_WINDOW;
    const numSamples = Math.min(plotWidth * 2, 2000);
    const dt = TIME_WINDOW / numSamples;

    ctx.beginPath();
    let firstPoint = true;
    for (let i = 0; i <= numSamples; i++) {
      const t = startTime + i * dt;
      const value = signalFn(t);
      const normalizedValue = value / maxAmplitude;
      const x = plotLeft + (i / numSamples) * plotWidth;
      const y = section.centerY - normalizedValue * halfHeight;

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Glow
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Main line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  /** Draw AM envelope dashed lines */
  function drawAmEnvelope(
    section: {
      top: number;
      bottom: number;
      centerY: number;
      height: number;
    }
  ): void {
    const plotLeft = PADDING_LEFT;
    const plotRight = width - PADDING_RIGHT;
    const plotWidth = plotRight - plotLeft;
    const halfHeight = section.height * 0.42;
    const maxAmplitude = 1 + amIndex;

    const startTime = time - TIME_WINDOW;
    const numSamples = Math.min(plotWidth, 1000);
    const dt = TIME_WINDOW / numSamples;

    // Upper envelope
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= numSamples; i++) {
      const t = startTime + i * dt;
      const envelope = 1 + amIndex * Math.sin(2 * Math.PI * messageFreq * t);
      const normalizedValue = envelope / maxAmplitude;
      const x = plotLeft + (i / numSamples) * plotWidth;
      const y = section.centerY - normalizedValue * halfHeight;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = "rgba(234, 179, 8, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();

    // Lower envelope
    ctx.beginPath();
    first = true;
    for (let i = 0; i <= numSamples; i++) {
      const t = startTime + i * dt;
      const envelope = 1 + amIndex * Math.sin(2 * Math.PI * messageFreq * t);
      const normalizedValue = -envelope / maxAmplitude;
      const x = plotLeft + (i / numSamples) * plotWidth;
      const y = section.centerY - normalizedValue * halfHeight;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawLabels(
    sections: Array<{
      top: number;
      bottom: number;
      centerY: number;
      height: number;
    }>
  ): void {
    const titles = ["Message Signal", "AM", "FM"];
    const colors = [MESSAGE_COLOR, AM_COLOR, FM_COLOR];

    for (let i = 0; i < 3; i++) {
      const sec = sections[i];

      // Rotated title on left side
      ctx.save();
      ctx.translate(18, sec.centerY);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = colors[i];
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(titles[i], 0, 0);
      ctx.restore();

      // Amplitude labels
      ctx.fillStyle = LABEL_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("+1", PADDING_LEFT - 8, sec.top + sec.height * 0.08);
      ctx.fillText("0", PADDING_LEFT - 8, sec.centerY);
      ctx.fillText("-1", PADDING_LEFT - 8, sec.bottom - sec.height * 0.08);
    }
  }

  function drawFormulas(
    sections: Array<{
      top: number;
      bottom: number;
      centerY: number;
      height: number;
    }>
  ): void {
    const plotLeft = PADDING_LEFT;

    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Message
    ctx.fillStyle = "rgba(234, 179, 8, 0.6)";
    ctx.fillText(
      `m(t) = sin(2\u03C0\u00B7${messageFreq.toFixed(1)}\u00B7t)`,
      plotLeft + 8,
      sections[0].top + 4
    );

    // AM
    ctx.fillStyle = "rgba(6, 182, 212, 0.6)";
    ctx.fillText(
      `AM(t) = [1 + ${amIndex.toFixed(1)}\u00B7m(t)] \u00D7 sin(2\u03C0\u00B7${carrierFreq}\u00B7t)`,
      plotLeft + 8,
      sections[1].top + 4
    );

    // FM
    ctx.fillStyle = "rgba(34, 197, 94, 0.6)";
    ctx.fillText(
      `FM(t) = sin(2\u03C0\u00B7${carrierFreq}\u00B7t + ${fmIndex.toFixed(1)}\u00B7sin(2\u03C0\u00B7${messageFreq.toFixed(1)}\u00B7t))`,
      plotLeft + 8,
      sections[2].top + 4
    );
  }

  function drawTimeAxis(
    sections: Array<{
      top: number;
      bottom: number;
      centerY: number;
      height: number;
    }>
  ): void {
    const plotLeft = PADDING_LEFT;
    const plotRight = width - PADDING_RIGHT;
    const plotWidth = plotRight - plotLeft;
    const bottomSection = sections[2];
    const axisY = bottomSection.bottom + 6;

    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, axisY);
    ctx.lineTo(plotRight, axisY);
    ctx.stroke();

    const startTime = time - TIME_WINDOW;
    const tickInterval = 0.5;
    const firstTick = Math.ceil(startTime / tickInterval) * tickInterval;

    ctx.fillStyle = LABEL_DIM;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let t = firstTick; t <= time; t += tickInterval) {
      const xFrac = (t - startTime) / TIME_WINDOW;
      const x = plotLeft + xFrac * plotWidth;

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
    const panelW = 240;
    const panelH = 120;
    const panelX = width - PADDING_RIGHT - panelW;
    const panelY = PADDING_TOP;
    const lineH = 16;

    ctx.fillStyle = "rgba(10, 10, 20, 0.8)";
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

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillText("AM & FM Radio Modulation", x, y);
    y += lineH;

    ctx.fillStyle = LABEL_DIM;
    ctx.fillText(`f_msg = ${messageFreq.toFixed(1)} Hz`, x, y);
    ctx.fillText(`f_car = ${carrierFreq} Hz`, x + 125, y);
    y += lineH;

    ctx.fillText(`AM mod idx = ${amIndex.toFixed(1)}`, x, y);
    ctx.fillText(`FM \u03B2 = ${fmIndex.toFixed(1)}`, x + 125, y);
    y += lineH;

    // Bandwidth info
    const amBW = (2 * messageFreq).toFixed(1);
    const fmBW = (2 * (fmIndex + 1) * messageFreq).toFixed(1);
    ctx.fillStyle = AM_COLOR;
    ctx.fillText(`AM BW \u2248 ${amBW} Hz`, x, y);
    ctx.fillStyle = FM_COLOR;
    ctx.fillText(`FM BW \u2248 ${fmBW} Hz`, x + 125, y);
    y += lineH;

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillText(`Carson: BW = 2(\u03B2+1)\u00B7f_m`, x, y);
  }

  function render(): void {
    drawBackground();
    const sections = getSectionBounds();
    drawGrid(sections);

    // Message signal
    const messageSignal = (t: number): number => {
      return Math.sin(2 * Math.PI * messageFreq * t);
    };
    drawWaveform(sections[0], MESSAGE_COLOR, MESSAGE_GLOW, messageSignal, 1);

    // AM signal
    const amMaxAmplitude = 1 + amIndex;
    const amSignal = (t: number): number => {
      const message = Math.sin(2 * Math.PI * messageFreq * t);
      return (1 + amIndex * message) * Math.sin(2 * Math.PI * carrierFreq * t);
    };
    drawWaveform(sections[1], AM_COLOR, AM_GLOW, amSignal, amMaxAmplitude);
    drawAmEnvelope(sections[1]);

    // FM signal
    const fmSignal = (t: number): number => {
      return Math.sin(
        2 * Math.PI * carrierFreq * t +
          fmIndex * Math.sin(2 * Math.PI * messageFreq * t)
      );
    };
    drawWaveform(sections[2], FM_COLOR, FM_GLOW, fmSignal, 1);

    drawLabels(sections);
    drawFormulas(sections);
    drawTimeAxis(sections);
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No extra resources to release
  }

  function getStateDescription(): string {
    const amBW = 2 * messageFreq;
    const fmBW = 2 * (fmIndex + 1) * messageFreq;

    return (
      `AM & FM Radio Modulation: Message frequency = ${messageFreq.toFixed(1)} Hz, ` +
      `Carrier frequency = ${carrierFreq} Hz. ` +
      `AM modulation index m = ${amIndex.toFixed(1)} ` +
      `(${amIndex > 1 ? "over-modulated" : amIndex === 1 ? "100% modulation" : `${(amIndex * 100).toFixed(0)}% modulation`}). ` +
      `FM modulation index \u03B2 = ${fmIndex.toFixed(1)} ` +
      `(frequency deviation = ${(fmIndex * messageFreq).toFixed(1)} Hz). ` +
      `AM bandwidth \u2248 ${amBW.toFixed(1)} Hz (2*f_m). ` +
      `FM bandwidth (Carson's rule) \u2248 ${fmBW.toFixed(1)} Hz [2(\u03B2+1)*f_m]. ` +
      `Time: ${time.toFixed(2)}s. ` +
      `AM varies carrier amplitude with message; FM varies carrier frequency with message.`
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

export default AmFmFactory;
