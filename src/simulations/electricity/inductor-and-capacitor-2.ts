import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const InductorCapacitor2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inductor-and-capacitor-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 100; // Hz
  let inductance = 0.1; // H
  let capacitance = 10; // µF
  let resistance = 50; // Ω

  // Waveform history
  const historyLen = 300;
  let voltageHistory: number[] = [];
  let inductorCurrentHistory: number[] = [];
  let capacitorCurrentHistory: number[] = [];
  let totalCurrentHistory: number[] = [];

  function calcReactance() {
    const omega = 2 * Math.PI * frequency;
    const xL = omega * inductance;
    const xC = 1 / (omega * (capacitance * 1e-6));
    return { xL, xC, omega };
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      voltageHistory = [];
      inductorCurrentHistory = [];
      capacitorCurrentHistory = [];
      totalCurrentHistory = [];
    },
    update(dt: number, params: Record<string, number>) {
      frequency = params.frequency ?? 100;
      inductance = params.inductance ?? 0.1;
      capacitance = params.capacitance ?? 10;
      resistance = params.resistance ?? 50;

      time += dt;
      const { xL, xC, omega } = calcReactance();
      const V0 = 10; // peak voltage
      const V = V0 * Math.sin(omega * time);
      // Inductor current lags voltage by 90°
      const iL = (V0 / Math.sqrt(resistance * resistance + xL * xL)) *
        Math.sin(omega * time - Math.atan2(xL, resistance));
      // Capacitor current leads voltage by 90°
      const iC = (V0 / Math.sqrt(resistance * resistance + xC * xC)) *
        Math.sin(omega * time + Math.atan2(xC, resistance));

      voltageHistory.push(V);
      inductorCurrentHistory.push(iL);
      capacitorCurrentHistory.push(iC);
      totalCurrentHistory.push(iL + iC);

      if (voltageHistory.length > historyLen) {
        voltageHistory.shift();
        inductorCurrentHistory.shift();
        capacitorCurrentHistory.shift();
        totalCurrentHistory.shift();
      }
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      const { xL, xC } = calcReactance();
      const panelH = height * 0.12;

      // Title and info panel
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Inductor & Capacitor in AC Circuit", width / 2, 25);

      // Reactance info
      ctx.font = `${Math.max(11, width * 0.016)}px monospace`;
      ctx.textAlign = "left";
      const infoY = 50;
      ctx.fillStyle = "#60a5fa";
      ctx.fillText(`X_L = 2πfL = ${xL.toFixed(1)} Ω`, 15, infoY);
      ctx.fillStyle = "#f59e0b";
      ctx.fillText(`X_C = 1/(2πfC) = ${xC.toFixed(1)} Ω`, 15, infoY + 18);
      ctx.fillStyle = "#10b981";
      ctx.fillText(`f = ${frequency} Hz  L = ${inductance} H  C = ${capacitance} µF`, 15, infoY + 36);

      // Draw circuit schematic at top
      const schY = panelH + 30;
      const schH = height * 0.18;
      drawCircuitSchematic(schY, schH);

      // Draw waveforms
      const graphTop = schY + schH + 20;
      const graphH = height - graphTop - 20;
      drawWaveforms(graphTop, graphH);
    },
    reset() {
      time = 0;
      voltageHistory = [];
      inductorCurrentHistory = [];
      capacitorCurrentHistory = [];
      totalCurrentHistory = [];
    },
    destroy() {},
    getStateDescription(): string {
      const { xL, xC } = calcReactance();
      const resonantF = 1 / (2 * Math.PI * Math.sqrt(inductance * (capacitance * 1e-6)));
      return `AC circuit with f=${frequency}Hz, L=${inductance}H, C=${capacitance}µF, R=${resistance}Ω. ` +
        `Inductive reactance X_L=${xL.toFixed(1)}Ω, Capacitive reactance X_C=${xC.toFixed(1)}Ω. ` +
        `Resonant frequency=${resonantF.toFixed(1)}Hz. ` +
        (Math.abs(xL - xC) < 5 ? "Near resonance — reactances nearly cancel." :
          xL > xC ? "Inductive: X_L > X_C, net impedance is inductive." :
          "Capacitive: X_C > X_L, net impedance is capacitive.");
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawCircuitSchematic(y: number, h: number) {
    const cx = width / 2;
    const boxW = width * 0.7;
    const left = cx - boxW / 2;
    const right = cx + boxW / 2;

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(left - 5, y - 5, boxW + 10, h + 10);

    // AC source on left
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    const srcX = left + 30;
    const srcY = y + h / 2;
    ctx.beginPath();
    ctx.arc(srcX, srcY, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("~", srcX, srcY + 4);

    // Inductor branch (top)
    const branchTop = y + h * 0.25;
    const branchBot = y + h * 0.75;
    const midX = cx;

    // Wire from source to split
    ctx.beginPath();
    ctx.moveTo(srcX + 15, srcY);
    ctx.lineTo(left + 60, srcY);
    ctx.lineTo(left + 60, branchTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(left + 60, srcY);
    ctx.lineTo(left + 60, branchBot);
    ctx.stroke();

    // Inductor coil (top branch)
    ctx.strokeStyle = "#60a5fa";
    ctx.beginPath();
    ctx.moveTo(left + 60, branchTop);
    ctx.lineTo(midX - 40, branchTop);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(midX - 30 + i * 20, branchTop, 8, Math.PI, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(midX + 40, branchTop);
    ctx.lineTo(right - 30, branchTop);
    ctx.stroke();

    ctx.fillStyle = "#60a5fa";
    ctx.font = "11px sans-serif";
    ctx.fillText("L (Inductor)", midX, branchTop - 14);

    // Capacitor (bottom branch)
    ctx.strokeStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(left + 60, branchBot);
    ctx.lineTo(midX - 8, branchBot);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX - 5, branchBot - 12);
    ctx.lineTo(midX - 5, branchBot + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX + 5, branchBot - 12);
    ctx.lineTo(midX + 5, branchBot + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX + 8, branchBot);
    ctx.lineTo(right - 30, branchBot);
    ctx.stroke();

    ctx.fillStyle = "#f59e0b";
    ctx.fillText("C (Capacitor)", midX, branchBot + 24);

    // Join branches on right
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(right - 30, branchTop);
    ctx.lineTo(right - 30, branchBot);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right - 30, srcY);
    ctx.lineTo(srcX - 15, srcY);
    ctx.stroke();

    // Animated current arrows
    const phase = time * 2 * Math.PI * frequency;
    const { xL, xC } = calcReactance();
    const iLnorm = Math.sin(phase) / Math.max(xL, 1);
    const iCnorm = Math.sin(phase) / Math.max(xC, 1);

    drawCurrentArrow(midX - 50, branchTop, iLnorm > 0 ? 1 : -1, Math.abs(iLnorm), "#60a5fa");
    drawCurrentArrow(midX - 50, branchBot, iCnorm > 0 ? -1 : 1, Math.abs(iCnorm), "#f59e0b");
  }

  function drawCurrentArrow(x: number, y: number, dir: number, mag: number, color: string) {
    const len = 12 * Math.min(mag * 10, 1);
    if (len < 2) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + dir * len, y);
    ctx.lineTo(x - dir * 4, y - 4);
    ctx.lineTo(x - dir * 4, y + 4);
    ctx.closePath();
    ctx.fill();
  }

  function drawWaveforms(top: number, h: number) {
    const margin = 40;
    const gw = width - margin * 2;
    const gh = h;
    const cy = top + gh / 2;

    // Grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, top);
    ctx.lineTo(margin, top + gh);
    ctx.moveTo(margin, cy);
    ctx.lineTo(margin + gw, cy);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Time →", margin + gw, top + gh - 2);

    // Find max for scaling
    const allVals = [...voltageHistory, ...inductorCurrentHistory, ...capacitorCurrentHistory];
    const maxVal = Math.max(1, ...allVals.map(Math.abs)) * 1.2;

    const drawLine = (data: number[], color: string, label: string, labelY: number) => {
      if (data.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = margin + (i / historyLen) * gw;
        const y = cy - (data[i] / maxVal) * (gh / 2) * 0.9;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, margin + gw + 5, labelY);
    };

    drawLine(voltageHistory, "#e2e8f0", "V(t)", cy - 30);
    drawLine(inductorCurrentHistory, "#60a5fa", "I_L(t)", cy - 14);
    drawLine(capacitorCurrentHistory, "#f59e0b", "I_C(t)", cy + 2);
    drawLine(totalCurrentHistory, "#10b981", "I_total", cy + 18);

    // Legend
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Voltage & Current Waveforms", width / 2, top + gh + 14);
  }
};

export default InductorCapacitor2Factory;
