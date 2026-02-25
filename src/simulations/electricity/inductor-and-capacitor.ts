import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const InductorAndCapacitorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("inductor-and-capacitor") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let inductance = 0.1; // Henries
  let capacitance = 100; // microfarads
  let initialVoltage = 5; // Volts
  let resistance = 0; // Ohms (for damped oscillation)

  // Circuit state
  let charge = 0; // Coulombs (on capacitor)
  let current = 0; // Amps
  let vCapacitor = 0;
  let vInductor = 0;
  let eCapacitor = 0;
  let eInductor = 0;
  let resonantFreq = 0;
  let period = 0;

  // History for graphs
  const voltageHistory: Array<{ t: number; vC: number; vL: number }> = [];
  const currentHistory: Array<{ t: number; i: number }> = [];
  const energyHistory: Array<{ t: number; eC: number; eL: number }> = [];

  function computeResonance(): void {
    const C = capacitance * 1e-6; // Convert μF to F
    resonantFreq = 1 / (2 * Math.PI * Math.sqrt(inductance * C));
    period = 1 / resonantFreq;
  }

  function reset(): void {
    time = 0;
    const C = capacitance * 1e-6;
    charge = initialVoltage * C; // Q = CV
    current = 0;
    vCapacitor = initialVoltage;
    vInductor = -initialVoltage;
    voltageHistory.length = 0;
    currentHistory.length = 0;
    energyHistory.length = 0;
    computeResonance();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newL = params.inductance ?? 0.1;
    const newC = params.capacitance ?? 100;
    const newV = params.initialVoltage ?? 5;
    const newR = params.resistance ?? 0;

    if (newL !== inductance || newC !== capacitance || newV !== initialVoltage || newR !== resistance) {
      inductance = newL;
      capacitance = newC;
      initialVoltage = newV;
      resistance = newR;
      reset();
    }

    time += dt;

    const C = capacitance * 1e-6;
    const L = inductance;
    const R = resistance;

    // LC circuit differential equations:
    // L * dI/dt + R*I + Q/C = 0
    // dQ/dt = I
    // Using RK4 integration for accuracy
    const k1_q = current;
    const k1_i = (-charge / C - R * current) / L;

    const k2_q = current + 0.5 * dt * k1_i;
    const k2_i = (-(charge + 0.5 * dt * k1_q) / C - R * (current + 0.5 * dt * k1_i)) / L;

    const k3_q = current + 0.5 * dt * k2_i;
    const k3_i = (-(charge + 0.5 * dt * k2_q) / C - R * (current + 0.5 * dt * k2_i)) / L;

    const k4_q = current + dt * k3_i;
    const k4_i = (-(charge + dt * k3_q) / C - R * (current + dt * k3_i)) / L;

    charge += (dt / 6) * (k1_q + 2 * k2_q + 2 * k3_q + k4_q);
    current += (dt / 6) * (k1_i + 2 * k2_i + 2 * k3_i + k4_i);

    vCapacitor = charge / C;
    vInductor = -L * ((-charge / C - R * current) / L); // = charge/C + R*current
    eCapacitor = 0.5 * charge * charge / C;
    eInductor = 0.5 * L * current * current;

    // Record history
    if (voltageHistory.length === 0 || time - voltageHistory[voltageHistory.length - 1].t > period * 0.01) {
      voltageHistory.push({ t: time, vC: vCapacitor, vL: vInductor });
      currentHistory.push({ t: time, i: current });
      energyHistory.push({ t: time, eC: eCapacitor, eL: eInductor });
      if (voltageHistory.length > 300) {
        voltageHistory.shift();
        currentHistory.shift();
        energyHistory.shift();
      }
    }
  }

  function drawCircuit(): void {
    const cx = W * 0.25;
    const cy = H * 0.22;
    const circW = W * 0.35;
    const circH = H * 0.25;

    // Circuit wires
    ctx.strokeStyle = "#78909c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Top wire
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + circW, cy);
    // Right wire
    ctx.lineTo(cx + circW, cy + circH);
    // Bottom wire
    ctx.lineTo(cx, cy + circH);
    // Left wire
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // Capacitor (top center)
    const capX = cx + circW * 0.5;
    const capGap = 6;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#42a5f5";
    ctx.beginPath();
    ctx.moveTo(capX - capGap, cy - 15);
    ctx.lineTo(capX - capGap, cy + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(capX + capGap, cy - 15);
    ctx.lineTo(capX + capGap, cy + 15);
    ctx.stroke();

    // Charge indication on capacitor plates
    const chargeLevel = Math.min(Math.abs(vCapacitor) / initialVoltage, 1);
    const chargeColor = vCapacitor >= 0
      ? `rgba(66, 165, 245, ${chargeLevel * 0.5})`
      : `rgba(239, 83, 80, ${chargeLevel * 0.5})`;
    ctx.fillStyle = chargeColor;
    ctx.fillRect(capX - capGap - 10, cy - 12, 10, 24);

    ctx.fillStyle = "#42a5f5";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("C", capX, cy - 20);
    ctx.font = "9px monospace";
    ctx.fillText(`${vCapacitor.toFixed(2)}V`, capX, cy + 28);

    // Inductor (bottom center) - coil symbol
    const indX = cx + circW * 0.5;
    const indY = cy + circH;
    ctx.strokeStyle = "#ffa726";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const sx = indX - 24 + i * 12;
      ctx.arc(sx + 6, indY, 6, Math.PI, 0, false);
    }
    ctx.stroke();

    ctx.fillStyle = "#ffa726";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("L", indX, indY + 18);

    // Resistor (right side) if R > 0
    if (resistance > 0) {
      const resX = cx + circW;
      const resY = cy + circH * 0.5;
      ctx.strokeStyle = "#66bb6a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(resX, resY - 15);
      for (let i = 0; i < 6; i++) {
        ctx.lineTo(resX + (i % 2 === 0 ? 6 : -6), resY - 15 + (i + 1) * 5);
      }
      ctx.lineTo(resX, resY + 15);
      ctx.stroke();
      ctx.fillStyle = "#66bb6a";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("R", resX + 16, resY + 3);
    }

    // Current arrow
    const arrowAngle = current >= 0 ? 0 : Math.PI;
    const arrowX = cx + circW * 0.25;
    const arrowY = cy;
    const arrowLen = Math.min(Math.abs(current) * 30, 25);
    if (arrowLen > 2) {
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 2;
      ctx.fillStyle = "#ffeb3b";
      const ax = Math.cos(arrowAngle) * arrowLen;
      ctx.beginPath();
      ctx.moveTo(arrowX - ax * 0.5, arrowY - 8);
      ctx.lineTo(arrowX + ax * 0.5, arrowY - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(arrowX + ax * 0.5, arrowY - 8);
      ctx.lineTo(arrowX + ax * 0.5 - Math.cos(arrowAngle) * 5, arrowY - 12);
      ctx.lineTo(arrowX + ax * 0.5 - Math.cos(arrowAngle) * 5, arrowY - 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffeb3b";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`I=${(current * 1000).toFixed(1)}mA`, arrowX, arrowY - 18);
    }
  }

  function drawVoltageGraph(): void {
    const gx = W * 0.03;
    const gy = H * 0.52;
    const gw = W * 0.45;
    const gh = H * 0.22;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Voltage", gx + gw / 2, gy + 14);

    if (voltageHistory.length < 2) return;

    const px = gx + 35;
    const py = gy + 22;
    const pw = gw - 50;
    const ph = gh - 34;

    const maxV = initialVoltage * 1.2;
    const tMin = voltageHistory[0].t;
    const tMax = voltageHistory[voltageHistory.length - 1].t;
    const tRange = Math.max(tMax - tMin, 0.01);

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py + ph / 2);
    ctx.lineTo(px + pw, py + ph / 2);
    ctx.stroke();

    // Vc
    ctx.strokeStyle = "#42a5f5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < voltageHistory.length; i++) {
      const x = px + ((voltageHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph / 2 - (voltageHistory[i].vC / maxV) * (ph / 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend
    ctx.fillStyle = "#42a5f5";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Vc", px + 3, py + 10);
  }

  function drawCurrentGraph(): void {
    const gx = W * 0.5;
    const gy = H * 0.52;
    const gw = W * 0.47;
    const gh = H * 0.22;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Current", gx + gw / 2, gy + 14);

    if (currentHistory.length < 2) return;

    const px = gx + 35;
    const py = gy + 22;
    const pw = gw - 50;
    const ph = gh - 34;

    const maxI = Math.max(...currentHistory.map((d) => Math.abs(d.i)), 0.001) * 1.2;
    const tMin = currentHistory[0].t;
    const tMax = currentHistory[currentHistory.length - 1].t;
    const tRange = Math.max(tMax - tMin, 0.01);

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py + ph / 2);
    ctx.lineTo(px + pw, py + ph / 2);
    ctx.stroke();

    ctx.strokeStyle = "#ffeb3b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < currentHistory.length; i++) {
      const x = px + ((currentHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph / 2 - (currentHistory[i].i / maxI) * (ph / 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = "#ffeb3b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("I", px + 3, py + 10);
  }

  function drawEnergyGraph(): void {
    const gx = W * 0.03;
    const gy = H * 0.76;
    const gw = W * 0.94;
    const gh = H * 0.22;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy Exchange", gx + gw / 2, gy + 14);

    if (energyHistory.length < 2) return;

    const px = gx + 35;
    const py = gy + 22;
    const pw = gw - 50;
    const ph = gh - 36;

    const maxE = Math.max(
      ...energyHistory.map((d) => d.eC + d.eL),
      0.0001
    ) * 1.1;
    const tMin = energyHistory[0].t;
    const tMax = energyHistory[energyHistory.length - 1].t;
    const tRange = Math.max(tMax - tMin, 0.01);

    // Stacked area: capacitor energy + inductor energy
    // Capacitor energy (bottom)
    ctx.fillStyle = "rgba(66, 165, 245, 0.4)";
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    for (let i = 0; i < energyHistory.length; i++) {
      const x = px + ((energyHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph - (energyHistory[i].eC / maxE) * ph;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(px + pw, py + ph);
    ctx.closePath();
    ctx.fill();

    // Inductor energy (top, on top of capacitor)
    ctx.fillStyle = "rgba(255, 167, 38, 0.4)";
    ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const x = px + ((energyHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph - (energyHistory[i].eC / maxE) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = energyHistory.length - 1; i >= 0; i--) {
      const x = px + ((energyHistory[i].t - tMin) / tRange) * pw;
      const y = py + ph - ((energyHistory[i].eC + energyHistory[i].eL) / maxE) * ph;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Legend
    ctx.fillStyle = "#42a5f5";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("EC (capacitor)", px + 5, py + 10);
    ctx.fillStyle = "#ffa726";
    ctx.fillText("EL (inductor)", px + 100, py + 10);
    ctx.fillStyle = "#fff";
    ctx.fillText(`Total: ${((eCapacitor + eInductor) * 1000).toFixed(2)} mJ`, px + 200, py + 10);
  }

  function drawInfo(): void {
    const ix = W * 0.65;
    const iy = H * 0.03;
    const iw = W * 0.32;
    const ih = H * 0.45;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(ix, iy, iw, ih, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("LC Circuit", ix + 10, iy + 18);

    ctx.font = "11px monospace";
    let y = iy + 38;
    const items = [
      { label: "L", value: `${inductance} H`, color: "#ffa726" },
      { label: "C", value: `${capacitance} μF`, color: "#42a5f5" },
      { label: "R", value: `${resistance} Ω`, color: "#66bb6a" },
      { label: "V₀", value: `${initialVoltage} V`, color: "#fff" },
      { label: "f₀", value: `${resonantFreq.toFixed(1)} Hz`, color: "#ab47bc" },
      { label: "T", value: `${(period * 1000).toFixed(1)} ms`, color: "#ab47bc" },
      { label: "Vc", value: `${vCapacitor.toFixed(3)} V`, color: "#42a5f5" },
      { label: "I", value: `${(current * 1000).toFixed(2)} mA`, color: "#ffeb3b" },
      { label: "Ec", value: `${(eCapacitor * 1000).toFixed(3)} mJ`, color: "#42a5f5" },
      { label: "EL", value: `${(eInductor * 1000).toFixed(3)} mJ`, color: "#ffa726" },
    ];

    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillText(`${item.label}:`, ix + 10, y);
      ctx.fillStyle = "#fff";
      ctx.fillText(item.value, ix + 50, y);
      y += 17;
    }

    y += 10;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px sans-serif";
    ctx.fillText("f₀ = 1/(2π√LC)", ix + 10, y); y += 14;
    ctx.fillText("½CV² + ½LI² = const", ix + 10, y); y += 14;
    ctx.fillText("Energy oscillates between", ix + 10, y); y += 12;
    ctx.fillText("electric (C) ↔ magnetic (L)", ix + 10, y);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1a2940");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawCircuit();
    drawInfo();
    drawVoltageGraph();
    drawCurrentGraph();
    drawEnergyGraph();
  }

  function destroy(): void {
    voltageHistory.length = 0;
    currentHistory.length = 0;
    energyHistory.length = 0;
  }

  function getStateDescription(): string {
    return (
      `LC Circuit: L=${inductance}H, C=${capacitance}μF, R=${resistance}Ω, V₀=${initialVoltage}V. ` +
      `Resonant frequency: f₀=${resonantFreq.toFixed(1)}Hz, period=${(period * 1000).toFixed(1)}ms. ` +
      `Current state: Vc=${vCapacitor.toFixed(3)}V, I=${(current * 1000).toFixed(2)}mA. ` +
      `Energy: Ec=${(eCapacitor * 1000).toFixed(3)}mJ, EL=${(eInductor * 1000).toFixed(3)}mJ. ` +
      `Energy oscillates between capacitor (electric field) and inductor (magnetic field). ` +
      `${resistance > 0 ? "With resistance, oscillations are damped (RLC circuit)." : "No resistance — undamped oscillations."}`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default InductorAndCapacitorFactory;
