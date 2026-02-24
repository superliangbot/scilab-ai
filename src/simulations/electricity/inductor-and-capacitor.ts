import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const InductorAndCapacitorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inductor-and-capacitor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Circuit parameters
  let inductance = 0.1; // H
  let capacitance = 100; // µF
  let voltage = 5; // V

  // State
  let switchOn = false;
  let inductorCurrent = 0;
  let capacitorVoltage = 0;
  let capacitorCharge = 0;
  const inductorHistory: number[] = [];
  const capacitorHistory: number[] = [];
  const maxHistory = 200;

  function drawWire(x1: number, y1: number, x2: number, y2: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawInductor(cx: number, cy: number, w: number) {
    ctx.save();
    ctx.strokeStyle = "#4fc3f7";
    ctx.lineWidth = 2.5;
    const coils = 6;
    const coilW = w / coils;
    ctx.beginPath();
    for (let i = 0; i < coils; i++) {
      const x0 = cx - w / 2 + i * coilW;
      ctx.arc(x0 + coilW / 2, cy, coilW / 2, Math.PI, 0, false);
    }
    ctx.stroke();

    // Magnetic field arrows proportional to current
    const fieldStrength = Math.min(Math.abs(inductorCurrent) / 2, 1);
    if (fieldStrength > 0.05) {
      ctx.fillStyle = `rgba(76, 175, 80, ${fieldStrength})`;
      for (let i = 0; i < 3; i++) {
        const ax = cx - 20 + i * 20;
        const ay = cy - 20;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 5, ay + 8);
        ctx.lineTo(ax + 5, ay + 8);
        ctx.fill();
      }
    }

    ctx.fillStyle = "#4fc3f7";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("L", cx, cy + 30);
    ctx.restore();
  }

  function drawCapacitor(cx: number, cy: number, h: number) {
    ctx.save();
    const gap = 8;
    const plateH = h;
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(cx - gap, cy - plateH / 2);
    ctx.lineTo(cx - gap, cy + plateH / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + gap, cy - plateH / 2);
    ctx.lineTo(cx + gap, cy + plateH / 2);
    ctx.stroke();

    // Charge visualization
    const chargeLevel = Math.abs(capacitorCharge) / (capacitance * 1e-6 * voltage);
    const numCharges = Math.floor(chargeLevel * 5);
    for (let i = 0; i < numCharges; i++) {
      const yOff = cy - plateH / 3 + (i * plateH * 0.6) / Math.max(numCharges, 1);
      ctx.fillStyle = "#ef5350";
      ctx.beginPath();
      ctx.arc(cx - gap - 8, yOff, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#42a5f5";
      ctx.beginPath();
      ctx.arc(cx + gap + 8, yOff, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ff9800";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("C", cx, cy + plateH / 2 + 20);
    ctx.restore();
  }

  function drawBattery(cx: number, cy: number) {
    ctx.save();
    ctx.strokeStyle = "#f44336";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 12);
    ctx.lineTo(cx - 3, cy + 12);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - 7);
    ctx.lineTo(cx + 3, cy + 7);
    ctx.stroke();

    ctx.fillStyle = "#f44336";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", cx - 10, cy - 8);
    ctx.fillText("−", cx + 10, cy - 8);
    ctx.restore();
  }

  function drawSwitch(cx: number, cy: number, closed: boolean) {
    ctx.save();
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.arc(cx - 15, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 15, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = closed ? "#4caf50" : "#f44336";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    if (closed) {
      ctx.lineTo(cx + 15, cy);
    } else {
      ctx.lineTo(cx + 10, cy - 15);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGraph(gx: number, gy: number, gw: number, gh: number, data: number[], color: string, label: string, maxVal: number) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    // Zero line
    ctx.strokeStyle = "#666";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh / 2);
    ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (data.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = gx + (i / maxHistory) * gw;
        const y = gy + gh / 2 - (data[i] / maxVal) * (gh / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, gx + 5, gy + 15);
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
      inductance = params.inductance ?? 0.1;
      capacitance = params.capacitance ?? 100;
      voltage = params.voltage ?? 5;
      switchOn = (params.switchOn ?? 1) > 0.5;

      if (!switchOn) {
        // Discharge: LC oscillation
        const C = capacitance * 1e-6;
        const omega = 1 / Math.sqrt(inductance * C);
        inductorCurrent *= Math.cos(omega * dt);
        capacitorVoltage = -inductance * omega * inductorCurrent * Math.sin(omega * dt) + capacitorVoltage * Math.cos(omega * dt);
        capacitorCharge = C * capacitorVoltage;
      } else {
        // Charging: inductor current rises, capacitor charges
        const C = capacitance * 1e-6;
        const omega = 1 / Math.sqrt(inductance * C);
        const dI = ((voltage - capacitorVoltage) / inductance) * dt;
        inductorCurrent += dI;
        capacitorCharge += inductorCurrent * dt;
        capacitorVoltage = capacitorCharge / C;
      }

      inductorHistory.push(inductorCurrent);
      capacitorHistory.push(capacitorVoltage);
      if (inductorHistory.length > maxHistory) inductorHistory.shift();
      if (capacitorHistory.length > maxHistory) capacitorHistory.shift();

      time += dt;
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Inductor and Capacitor Circuit", width / 2, 25);

      const circuitY = height * 0.3;
      const circuitW = width * 0.6;
      const left = width * 0.2;
      const right = left + circuitW;
      const top = circuitY - 40;
      const bottom = circuitY + 40;

      // Draw circuit
      drawWire(left, top, left + circuitW * 0.2, top);
      drawSwitch(left + circuitW * 0.3, top, switchOn);
      drawWire(left + circuitW * 0.4, top, right, top);
      drawWire(right, top, right, circuitY - 10);
      drawCapacitor(right, circuitY, 30);
      drawWire(right, circuitY + 25, right, bottom);
      drawWire(right, bottom, left + circuitW * 0.6, bottom);
      drawInductor(left + circuitW * 0.35, bottom, circuitW * 0.3);
      drawWire(left + circuitW * 0.1, bottom, left, bottom);
      drawWire(left, bottom, left, circuitY + 5);
      drawBattery(left, circuitY);
      drawWire(left, circuitY - 12, left, top);

      // Current arrow
      if (Math.abs(inductorCurrent) > 0.01) {
        const arrowDir = inductorCurrent > 0 ? 1 : -1;
        ctx.fillStyle = "#ffeb3b";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(arrowDir > 0 ? "→ I" : "← I", width / 2, top - 8);
      }

      // Graphs
      const graphW = width * 0.38;
      const graphH = height * 0.25;
      const graphY = height * 0.55;

      drawGraph(width * 0.05, graphY, graphW, graphH, inductorHistory, "#4fc3f7", "Inductor Current (A)", 3);
      drawGraph(width * 0.55, graphY, graphW, graphH, capacitorHistory, "#ff9800", "Capacitor Voltage (V)", voltage * 1.5);

      // Info panel
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      const infoY = graphY + graphH + 15;
      ctx.fillRect(width * 0.1, infoY, width * 0.8, 50);
      ctx.fillStyle = "#e0e0e0";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      const freq = 1 / (2 * Math.PI * Math.sqrt(inductance * capacitance * 1e-6));
      ctx.fillText(`L = ${inductance.toFixed(2)} H | C = ${capacitance.toFixed(0)} µF | V = ${voltage.toFixed(1)} V`, width / 2, infoY + 18);
      ctx.fillText(`Resonant freq = ${freq.toFixed(1)} Hz | I = ${inductorCurrent.toFixed(3)} A | Vc = ${capacitorVoltage.toFixed(2)} V`, width / 2, infoY + 38);
    },
    reset() {
      time = 0;
      inductorCurrent = 0;
      capacitorVoltage = 0;
      capacitorCharge = 0;
      inductorHistory.length = 0;
      capacitorHistory.length = 0;
      switchOn = true;
    },
    destroy() {},
    getStateDescription(): string {
      const C = capacitance * 1e-6;
      const freq = 1 / (2 * Math.PI * Math.sqrt(inductance * C));
      return `LC Circuit: L=${inductance}H, C=${capacitance}µF. Switch ${switchOn ? "ON" : "OFF"}. Current=${inductorCurrent.toFixed(3)}A, Cap voltage=${capacitorVoltage.toFixed(2)}V. Resonant frequency=${freq.toFixed(1)}Hz. The inductor resists sudden current changes while the capacitor stores charge.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default InductorAndCapacitorFactory;
