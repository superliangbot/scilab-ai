import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const InductorAndCapacitor3Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inductor-and-capacitor-3") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let frequency = 5; // kHz
  let inductance = 0.01; // H
  let capacitance = 10; // µF
  let resistance = 10; // Ω
  let amplitude = 5; // V

  // RLC state
  let current = 0;
  let capVoltage = 0;
  let indVoltage = 0;
  let resVoltage = 0;
  let supplyVoltage = 0;

  const supplyHist: number[] = [];
  const currentHist: number[] = [];
  const capVHist: number[] = [];
  const indVHist: number[] = [];
  const resVHist: number[] = [];
  const maxHist = 250;

  function drawGraph(gx: number, gy: number, gw: number, gh: number, datasets: { data: number[]; color: string; label: string }[], maxVal: number, title: string) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#444";
    ctx.strokeRect(gx, gy, gw, gh);

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
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < ds.data.length; i++) {
          const x = gx + (i / maxHist) * gw;
          const y = gy + gh / 2 - (ds.data[i] / maxVal) * (gh / 2 - 3);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });

    ctx.fillStyle = "#ccc";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, gx + 4, gy + 13);

    let ly = gy + gh - 5;
    datasets.forEach((ds) => {
      ctx.fillStyle = ds.color;
      ctx.font = "10px sans-serif";
      ctx.fillText("■ " + ds.label, gx + 4, ly);
      ly -= 13;
    });

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
      resistance = params.resistance ?? 10;
      amplitude = params.amplitude ?? 5;

      time += dt;

      const omega = 2 * Math.PI * frequency * 1000;
      const C = capacitance * 1e-6;
      const L = inductance;
      const R = resistance;

      const XL = omega * L;
      const XC = 1 / (omega * C);
      const Z = Math.sqrt(R * R + (XL - XC) * (XL - XC));
      const phi = Math.atan2(XL - XC, R);

      supplyVoltage = amplitude * Math.sin(omega * time);
      current = (amplitude / Z) * Math.sin(omega * time - phi);
      resVoltage = current * R;
      indVoltage = XL * (amplitude / Z) * Math.cos(omega * time - phi);
      capVoltage = -XC * (amplitude / Z) * Math.cos(omega * time - phi);

      supplyHist.push(supplyVoltage);
      currentHist.push(current);
      capVHist.push(capVoltage);
      indVHist.push(indVoltage);
      resVHist.push(resVoltage);
      if (supplyHist.length > maxHist) {
        supplyHist.shift();
        currentHist.shift();
        capVHist.shift();
        indVHist.shift();
        resVHist.shift();
      }
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#0f3460");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("RLC Series Circuit — Voltage & Current Analysis", width / 2, 22);

      // Circuit schematic
      const schY = 45;
      const schH = 60;
      const mx = width / 2;

      // R
      ctx.strokeStyle = "#ef5350";
      ctx.lineWidth = 2;
      const rw = 40;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(mx - 80 + i * (rw / 6), schY + (i % 2 === 0 ? 0 : 10));
        ctx.lineTo(mx - 80 + (i + 1) * (rw / 6), schY + ((i + 1) % 2 === 0 ? 0 : 10));
        ctx.stroke();
      }
      ctx.fillStyle = "#ef5350";
      ctx.font = "10px sans-serif";
      ctx.fillText("R", mx - 60, schY + 25);

      // L
      ctx.strokeStyle = "#4fc3f7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.arc(mx - 20 + i * 10 + 5, schY, 5, Math.PI, 0, false);
      }
      ctx.stroke();
      ctx.fillStyle = "#4fc3f7";
      ctx.fillText("L", mx, schY + 25);

      // C
      ctx.strokeStyle = "#ff9800";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx + 46, schY - 10);
      ctx.lineTo(mx + 46, schY + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx + 54, schY - 10);
      ctx.lineTo(mx + 54, schY + 10);
      ctx.stroke();
      ctx.fillStyle = "#ff9800";
      ctx.font = "10px sans-serif";
      ctx.fillText("C", mx + 50, schY + 25);

      // AC source
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx + 90, schY, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#4caf50";
      ctx.font = "11px sans-serif";
      ctx.fillText("~", mx + 90, schY + 4);

      // Impedance info
      const omega = 2 * Math.PI * frequency * 1000;
      const C = capacitance * 1e-6;
      const XL = omega * inductance;
      const XC = 1 / (omega * C);
      const Z = Math.sqrt(resistance * resistance + (XL - XC) * (XL - XC));
      const phi = Math.atan2(XL - XC, resistance);

      ctx.fillStyle = "#aaa";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Z = ${Z.toFixed(1)} Ω | φ = ${(phi * 180 / Math.PI).toFixed(1)}° | f₀ = ${(1 / (2 * Math.PI * Math.sqrt(inductance * C)) / 1000).toFixed(2)} kHz`, width / 2, schY + schH);

      // Graphs
      const gw = width * 0.44;
      const gh = height * 0.28;
      const gx1 = width * 0.03;
      const gx2 = width * 0.53;
      const gy1 = schY + schH + 15;
      const gy2 = gy1 + gh + 10;

      const maxV = amplitude * 1.5;
      const maxI = (amplitude / Z) * 1.5;

      drawGraph(gx1, gy1, gw, gh, [
        { data: supplyHist, color: "#4caf50", label: "V supply" },
        { data: currentHist, color: "#e040fb", label: "I total" },
      ], Math.max(maxV, maxI * Z), "Supply Voltage & Current");

      drawGraph(gx2, gy1, gw, gh, [
        { data: resVHist, color: "#ef5350", label: "V_R" },
        { data: indVHist, color: "#4fc3f7", label: "V_L" },
        { data: capVHist, color: "#ff9800", label: "V_C" },
      ], maxV * 2, "Component Voltages");

      // Phasor diagram
      const px = width / 2;
      const py = gy2 + gh * 0.5;
      const pRadius = Math.min(width, height) * 0.12;

      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, pRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Supply voltage phasor
      const angle = 2 * Math.PI * frequency * 1000 * time;
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + pRadius * Math.cos(angle), py - pRadius * Math.sin(angle));
      ctx.stroke();

      // Current phasor
      ctx.strokeStyle = "#e040fb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + pRadius * 0.7 * Math.cos(angle - phi), py - pRadius * 0.7 * Math.sin(angle - phi));
      ctx.stroke();

      ctx.fillStyle = "#ccc";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Phasor Diagram", px, py - pRadius - 8);

      // Legend for phasor
      ctx.fillStyle = "#4caf50";
      ctx.fillText("— V", px - 30, py + pRadius + 15);
      ctx.fillStyle = "#e040fb";
      ctx.fillText("— I", px + 30, py + pRadius + 15);
    },
    reset() {
      time = 0;
      current = 0;
      capVoltage = 0;
      indVoltage = 0;
      resVoltage = 0;
      supplyVoltage = 0;
      supplyHist.length = 0;
      currentHist.length = 0;
      capVHist.length = 0;
      indVHist.length = 0;
      resVHist.length = 0;
    },
    destroy() {},
    getStateDescription(): string {
      const omega = 2 * Math.PI * frequency * 1000;
      const C = capacitance * 1e-6;
      const XL = omega * inductance;
      const XC = 1 / (omega * C);
      const Z = Math.sqrt(resistance * resistance + (XL - XC) * (XL - XC));
      const phi = Math.atan2(XL - XC, resistance);
      const f0 = 1 / (2 * Math.PI * Math.sqrt(inductance * C));
      return `RLC Series Circuit: R=${resistance}Ω, L=${inductance}H, C=${capacitance}µF at f=${frequency}kHz. Impedance Z=${Z.toFixed(1)}Ω, phase angle φ=${(phi * 180 / Math.PI).toFixed(1)}°. Resonant frequency f₀=${(f0 / 1000).toFixed(2)}kHz. At resonance XL=XC and impedance is purely resistive.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default InductorAndCapacitor3Factory;
