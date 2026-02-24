import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const InductorAndCapacitor2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inductor-and-capacitor-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 5; // kHz
  let inductance = 0.01; // H
  let capacitance = 10; // µF
  let amplitude = 5; // V
  let waveform = 0; // 0 = sine, 1 = square

  // State
  let supplyVoltage = 0;
  let inductorCurrent = 0;
  let capacitorCurrent = 0;

  const supplyHistory: number[] = [];
  const inductorHistory: number[] = [];
  const capacitorHistory: number[] = [];
  const maxHistory = 300;

  function getSupplyVoltage(t: number): number {
    const omega = 2 * Math.PI * frequency * 1000;
    if (waveform < 0.5) {
      return amplitude * Math.sin(omega * t);
    } else {
      return amplitude * Math.sign(Math.sin(omega * t));
    }
  }

  function drawGraph(gx: number, gy: number, gw: number, gh: number, datasets: { data: number[]; color: string; label: string }[], maxVal: number) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    // Zero line
    ctx.strokeStyle = "#555";
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh / 2);
    ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    datasets.forEach((ds) => {
      if (ds.data.length > 1) {
        ctx.strokeStyle = ds.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < ds.data.length; i++) {
          const x = gx + (i / maxHistory) * gw;
          const y = gy + gh / 2 - (ds.data[i] / maxVal) * (gh / 2 - 5);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });

    // Legend
    let lx = gx + 5;
    datasets.forEach((ds) => {
      ctx.fillStyle = ds.color;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("■ " + ds.label, lx, gy + 14);
      lx += ctx.measureText("■ " + ds.label).width + 12;
    });

    ctx.restore();
  }

  function drawInductorSymbol(cx: number, cy: number) {
    ctx.save();
    ctx.strokeStyle = "#4fc3f7";
    ctx.lineWidth = 2;
    const coils = 5;
    const w = 50;
    const coilW = w / coils;
    ctx.beginPath();
    for (let i = 0; i < coils; i++) {
      ctx.arc(cx - w / 2 + i * coilW + coilW / 2, cy, coilW / 2, Math.PI, 0, false);
    }
    ctx.stroke();

    // Magnetic field arrows
    const strength = Math.min(Math.abs(inductorCurrent) / 3, 1);
    if (strength > 0.05) {
      for (let i = 0; i < 4; i++) {
        const ax = cx - 25 + i * 17;
        const ay = cy - 18;
        ctx.fillStyle = `rgba(76, 175, 80, ${strength})`;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 6);
        ctx.lineTo(ax - 4, ay);
        ctx.lineTo(ax + 4, ay);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawCapacitorSymbol(cx: number, cy: number) {
    ctx.save();
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 15);
    ctx.lineTo(cx - 6, cy + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 15);
    ctx.lineTo(cx + 6, cy + 15);
    ctx.stroke();

    // Charge dots
    const charge = Math.abs(capacitorCurrent) / 3;
    const n = Math.floor(Math.min(charge, 1) * 4);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = "#ef5350";
      ctx.beginPath();
      ctx.arc(cx - 14, cy - 10 + i * 7, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#42a5f5";
      ctx.beginPath();
      ctx.arc(cx + 14, cy - 10 + i * 7, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      engine.reset();
    },
    update(dt: number, params: Record<string, number>) {
      frequency = params.frequency ?? 5;
      inductance = params.inductance ?? 0.01;
      capacitance = params.capacitance ?? 10;
      amplitude = params.amplitude ?? 5;
      waveform = params.waveform ?? 0;

      time += dt;

      const omega = 2 * Math.PI * frequency * 1000;
      const C = capacitance * 1e-6;
      const XL = omega * inductance;
      const XC = 1 / (omega * C);

      supplyVoltage = getSupplyVoltage(time);

      // Inductor: current lags voltage by 90°
      inductorCurrent = (amplitude / XL) * Math.sin(omega * time - Math.PI / 2);
      if (waveform >= 0.5) {
        inductorCurrent = (amplitude / XL) * Math.cos(omega * time);
      }

      // Capacitor: current leads voltage by 90°
      capacitorCurrent = (amplitude / XC) * Math.sin(omega * time + Math.PI / 2);
      if (waveform >= 0.5) {
        capacitorCurrent = -(amplitude / XC) * Math.cos(omega * time);
      }

      supplyHistory.push(supplyVoltage);
      inductorHistory.push(inductorCurrent);
      capacitorHistory.push(capacitorCurrent);
      if (supplyHistory.length > maxHistory) supplyHistory.shift();
      if (inductorHistory.length > maxHistory) inductorHistory.shift();
      if (capacitorHistory.length > maxHistory) capacitorHistory.shift();
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Inductor & Capacitor in AC Circuit", width / 2, 22);

      // Circuit diagram area
      const circTop = 40;
      const circH = height * 0.25;
      const mid = width / 2;

      // AC source
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mid, circTop + circH / 2, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#4caf50";
      ctx.textAlign = "center";
      ctx.fillText("~", mid, circTop + circH / 2 + 4);
      ctx.fillText("AC", mid, circTop + circH / 2 + 28);

      // Inductor branch (left)
      drawInductorSymbol(mid - 100, circTop + circH / 2);
      ctx.fillStyle = "#4fc3f7";
      ctx.font = "11px sans-serif";
      ctx.fillText("Inductor", mid - 100, circTop + circH / 2 + 30);

      // Capacitor branch (right)
      drawCapacitorSymbol(mid + 100, circTop + circH / 2);
      ctx.fillStyle = "#ff9800";
      ctx.font = "11px sans-serif";
      ctx.fillText("Capacitor", mid + 100, circTop + circH / 2 + 30);

      // Wires
      ctx.strokeStyle = "#777";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mid - 15, circTop + circH / 2);
      ctx.lineTo(mid - 75, circTop + circH / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mid + 15, circTop + circH / 2);
      ctx.lineTo(mid + 94, circTop + circH / 2);
      ctx.stroke();

      // Graphs
      const graphW = width * 0.42;
      const graphH = height * 0.25;
      const graphY1 = circTop + circH + 20;
      const graphY2 = graphY1 + graphH + 15;

      const omega = 2 * Math.PI * frequency * 1000;
      const C = capacitance * 1e-6;
      const XL = omega * inductance;
      const XC = 1 / (omega * C);
      const maxI = Math.max(amplitude / XL, amplitude / XC, amplitude) * 1.2;

      drawGraph(width * 0.04, graphY1, graphW, graphH, [
        { data: supplyHistory, color: "#4caf50", label: "V supply" },
        { data: inductorHistory, color: "#e040fb", label: "I inductor" },
      ], maxI);

      drawGraph(width * 0.54, graphY1, graphW, graphH, [
        { data: supplyHistory, color: "#4caf50", label: "V supply" },
        { data: capacitorHistory, color: "#ff9800", label: "I capacitor" },
      ], maxI);

      // Info
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.05, graphY2, width * 0.9, 45);
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`f = ${(frequency * 1000).toFixed(0)} Hz | XL = ${XL.toFixed(1)} Ω | XC = ${XC.toFixed(1)} Ω | Waveform: ${waveform < 0.5 ? "Sine" : "Square"}`, width / 2, graphY2 + 18);
      ctx.fillText(`Inductor current lags voltage by 90° | Capacitor current leads voltage by 90°`, width / 2, graphY2 + 35);
    },
    reset() {
      time = 0;
      inductorCurrent = 0;
      capacitorCurrent = 0;
      supplyVoltage = 0;
      supplyHistory.length = 0;
      inductorHistory.length = 0;
      capacitorHistory.length = 0;
    },
    destroy() {},
    getStateDescription(): string {
      const omega = 2 * Math.PI * frequency * 1000;
      const C = capacitance * 1e-6;
      const XL = omega * inductance;
      const XC = 1 / (omega * C);
      return `AC circuit at ${(frequency * 1000).toFixed(0)}Hz. Inductive reactance XL=${XL.toFixed(1)}Ω, Capacitive reactance XC=${XC.toFixed(1)}Ω. Inductor current lags voltage by 90°, capacitor current leads by 90°. Waveform: ${waveform < 0.5 ? "Sine" : "Square"}.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default InductorAndCapacitor2Factory;
