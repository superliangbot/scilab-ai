import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const InductorCapacitor3Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inductor-and-capacitor-3") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 500; // Hz
  let inductance = 0.05; // H
  let capacitance = 20; // µF
  let voltageAmp = 12; // V peak

  // History buffers
  const historyLen = 400;
  let vSupply: number[] = [];
  let vInductor: number[] = [];
  let vCapacitor: number[] = [];
  let iCircuit: number[] = [];

  function calcImpedance() {
    const omega = 2 * Math.PI * frequency;
    const xL = omega * inductance;
    const xC = 1 / (omega * (capacitance * 1e-6));
    const R = 10; // small series resistance
    const Z = Math.sqrt(R * R + (xL - xC) * (xL - xC));
    const phi = Math.atan2(xL - xC, R);
    const resonantF = 1 / (2 * Math.PI * Math.sqrt(inductance * (capacitance * 1e-6)));
    return { xL, xC, Z, phi, R, omega, resonantF };
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      vSupply = [];
      vInductor = [];
      vCapacitor = [];
      iCircuit = [];
    },
    update(dt: number, params: Record<string, number>) {
      frequency = params.frequency ?? 500;
      inductance = params.inductance ?? 0.05;
      capacitance = params.capacitance ?? 20;
      voltageAmp = params.voltageAmp ?? 12;

      time += dt;
      const { xL, xC, Z, phi, omega } = calcImpedance();
      const I0 = voltageAmp / Z;

      const vs = voltageAmp * Math.sin(omega * time);
      const i = I0 * Math.sin(omega * time - phi);
      const vL = xL * I0 * Math.cos(omega * time - phi);
      const vC = -xC * I0 * Math.cos(omega * time - phi);

      vSupply.push(vs);
      vInductor.push(vL);
      vCapacitor.push(vC);
      iCircuit.push(i);

      if (vSupply.length > historyLen) {
        vSupply.shift();
        vInductor.shift();
        vCapacitor.shift();
        iCircuit.shift();
      }
    },
    render() {
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, width, height);

      const { xL, xC, Z, phi, resonantF } = calcImpedance();

      // Title
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.02)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Series RLC Circuit — Voltage & Current Analysis", width / 2, 24);

      // Info panel
      const fontSize = Math.max(10, width * 0.014);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "left";
      const ix = 15;
      let iy = 46;
      const info = [
        { text: `f = ${frequency} Hz`, color: "#94a3b8" },
        { text: `X_L = ${xL.toFixed(1)} Ω`, color: "#818cf8" },
        { text: `X_C = ${xC.toFixed(1)} Ω`, color: "#f59e0b" },
        { text: `Z = ${Z.toFixed(1)} Ω`, color: "#e2e8f0" },
        { text: `φ = ${(phi * 180 / Math.PI).toFixed(1)}°`, color: "#10b981" },
        { text: `f_res = ${resonantF.toFixed(1)} Hz`, color: "#f87171" },
      ];
      for (const { text, color } of info) {
        ctx.fillStyle = color;
        ctx.fillText(text, ix, iy);
        iy += fontSize + 4;
      }

      // Phasor diagram (right side)
      drawPhasorDiagram();

      // Waveform graphs (bottom half)
      const graphTop = height * 0.42;
      const graphH = height * 0.26;
      drawGraph(vSupply, vInductor, 15, graphTop, width - 30, graphH,
        "Voltage", ["V_supply", "V_L"], ["#e2e8f0", "#818cf8"]);
      drawGraph(vCapacitor, iCircuit, 15, graphTop + graphH + 30, width - 30, graphH,
        "V_C & Current", ["V_C", "I(t)"], ["#f59e0b", "#10b981"]);
    },
    reset() {
      time = 0;
      vSupply = [];
      vInductor = [];
      vCapacitor = [];
      iCircuit = [];
    },
    destroy() {},
    getStateDescription(): string {
      const { xL, xC, Z, phi, resonantF } = calcImpedance();
      const nearRes = Math.abs(frequency - resonantF) < resonantF * 0.1;
      return `Series RLC circuit: f=${frequency}Hz, L=${inductance}H, C=${capacitance}µF, V₀=${voltageAmp}V. ` +
        `X_L=${xL.toFixed(1)}Ω, X_C=${xC.toFixed(1)}Ω, Z=${Z.toFixed(1)}Ω, phase=${(phi * 180 / Math.PI).toFixed(1)}°. ` +
        `Resonant frequency=${resonantF.toFixed(1)}Hz. ` +
        (nearRes ? "Circuit is near resonance — impedance minimized, current maximized." :
          phi > 0 ? "Circuit is inductive (current lags voltage)." : "Circuit is capacitive (current leads voltage).");
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawPhasorDiagram() {
    const cx = width * 0.75;
    const cy = height * 0.22;
    const r = Math.min(width, height) * 0.12;

    // Circle
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    const { xL, xC, Z, phi } = calcImpedance();
    const I0 = voltageAmp / Z;

    // Phasor: V_supply (reference)
    const angle = 2 * Math.PI * frequency * time;
    drawArrow(cx, cy, cx + r * Math.cos(angle), cy - r * Math.sin(angle), "#e2e8f0", 2);
    // Phasor: Current (lags by phi)
    const iAngle = angle - phi;
    const ir = r * 0.7;
    drawArrow(cx, cy, cx + ir * Math.cos(iAngle), cy - ir * Math.sin(iAngle), "#10b981", 2);

    // Labels
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("V", cx + r + 12, cy - r * 0.3);
    ctx.fillStyle = "#10b981";
    ctx.fillText("I", cx + ir + 12, cy + ir * 0.3);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Phasor Diagram", cx, cy + r + 18);
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, lw: number) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function drawGraph(data1: number[], data2: number[], x: number, y: number, w: number, h: number,
    title: string, labels: string[], colors: string[]) {
    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Center line
    const cy = y + h / 2;
    ctx.strokeStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + w, cy);
    ctx.stroke();

    // Title
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, x + 5, y + 12);

    const allVals = [...data1, ...data2];
    const maxVal = Math.max(1, ...allVals.map(Math.abs)) * 1.2;

    const drawLine = (data: number[], color: string) => {
      if (data.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const px = x + (i / historyLen) * w;
        const py = cy - (data[i] / maxVal) * (h / 2) * 0.85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };

    drawLine(data1, colors[0]);
    drawLine(data2, colors[1]);

    // Legend
    ctx.font = "10px sans-serif";
    for (let i = 0; i < labels.length; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillText(`■ ${labels[i]}`, x + w - 120 + i * 60, y + 12);
    }
  }
};

export default InductorCapacitor3Factory;
