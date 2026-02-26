import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Specific Heat Comparison
 *
 * Demonstrates Q = mc*deltaT by heating two different materials with the
 * same power and observing that they rise in temperature at different rates
 * depending on their specific heat capacity.
 *
 * Specific heats (J/(kg*K)):
 *   Water:    4186
 *   Iron:      449
 *   Copper:    385
 *   Aluminum:  897
 */

interface MaterialData {
  name: string;
  specificHeat: number;  // J/(kg*K)
  color: string;
  lightColor: string;
}

const MATERIALS: MaterialData[] = [
  { name: "Water",    specificHeat: 4186, color: "#3b82f6", lightColor: "#93c5fd" },
  { name: "Iron",     specificHeat: 449,  color: "#6b7280", lightColor: "#d1d5db" },
  { name: "Copper",   specificHeat: 385,  color: "#d97706", lightColor: "#fde68a" },
  { name: "Aluminum", specificHeat: 897,  color: "#a3a3a3", lightColor: "#e5e5e5" },
];

const SpecificHeatFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("specific-heat") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let material1Idx = 0;
  let material2Idx = 2;
  let heatPower = 500; // Watts
  let mass = 0.5;      // kg

  // State: accumulated energy and resulting temperatures
  let energy = 0;            // total energy delivered (J)
  const T_INITIAL = 293.15;  // 20 C in Kelvin
  let temp1 = T_INITIAL;
  let temp2 = T_INITIAL;

  // Temperature history for chart
  let history1: Array<{ t: number; T: number }> = [];
  let history2: Array<{ t: number; T: number }> = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    resetState();
  }

  function resetState(): void {
    time = 0;
    energy = 0;
    temp1 = T_INITIAL;
    temp2 = T_INITIAL;
    history1 = [{ t: 0, T: T_INITIAL }];
    history2 = [{ t: 0, T: T_INITIAL }];
  }

  function update(dt: number, params: Record<string, number>): void {
    material1Idx = Math.round(params.material1 ?? 0);
    material2Idx = Math.round(params.material2 ?? 2);
    heatPower = params.heatPower ?? 500;
    mass = params.mass ?? 0.5;

    time += dt;
    const dQ = heatPower * dt; // energy added this frame
    energy += dQ;

    const mat1 = MATERIALS[material1Idx] || MATERIALS[0];
    const mat2 = MATERIALS[material2Idx] || MATERIALS[2];

    // deltaT = Q / (m * c)
    temp1 = T_INITIAL + energy / (mass * mat1.specificHeat);
    temp2 = T_INITIAL + energy / (mass * mat2.specificHeat);

    // Clamp to something reasonable (< 1000 K)
    temp1 = Math.min(temp1, 1000);
    temp2 = Math.min(temp2, 1000);

    history1.push({ t: time, T: temp1 });
    history2.push({ t: time, T: temp2 });

    // Keep history manageable
    if (history1.length > 600) {
      history1 = history1.filter((_, i) => i % 2 === 0);
      history2 = history2.filter((_, i) => i % 2 === 0);
    }
  }

  function toCelsius(K: number): number {
    return K - 273.15;
  }

  /** Map temperature to a heat color */
  function heatColor(T: number): string {
    const frac = Math.min(1, Math.max(0, (T - T_INITIAL) / 400));
    const r = Math.floor(255 * Math.min(1, frac * 2));
    const g = Math.floor(100 * (1 - frac));
    const b = Math.floor(50 * (1 - frac));
    return `rgb(${r},${g},${b})`;
  }

  function drawBurner(x: number, y: number, bw: number): void {
    ctx.fillStyle = "#475569";
    ctx.fillRect(x - bw / 2, y, bw, 12);
    for (let i = 0; i < 5; i++) {
      const fx = x - bw / 3 + (i * bw * 0.6) / 4;
      const fh = (18 + 6 * Math.sin(time * 8)) * (0.7 + 0.3 * Math.sin(time * 12 + i * 1.5));
      const grad = ctx.createLinearGradient(fx, y, fx, y - fh);
      grad.addColorStop(0, "#f59e0b");
      grad.addColorStop(0.5, "#ef4444");
      grad.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(fx, y - fh / 2, 6, fh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBeaker(x: number, y: number, bw: number, bh: number, mat: MaterialData, temp: number): void {
    // Beaker outline
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - bw / 2, y - bh);
    ctx.lineTo(x - bw / 2, y);
    ctx.lineTo(x + bw / 2, y);
    ctx.lineTo(x + bw / 2, y - bh);
    ctx.stroke();

    // Material fill (colour changes with temperature)
    const frac = Math.min(1, (temp - T_INITIAL) / 300);
    const fillH = bh * 0.85;
    const grad = ctx.createLinearGradient(x, y - fillH, x, y);
    grad.addColorStop(0, mat.lightColor);
    grad.addColorStop(1, mat.color);
    ctx.globalAlpha = 0.7 + 0.3 * frac;
    ctx.fillStyle = grad;
    ctx.fillRect(x - bw / 2 + 2, y - fillH, bw - 4, fillH - 2);
    ctx.globalAlpha = 1;

    // Heat glow overlay
    if (frac > 0.05) {
      ctx.fillStyle = `rgba(239, 68, 68, ${frac * 0.25})`;
      ctx.fillRect(x - bw / 2 + 2, y - fillH, bw - 4, fillH - 2);
    }

    // Material label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mat.name, x, y - bh - 8);

    // Specific heat label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`c = ${mat.specificHeat} J/(kg\u00B7K)`, x, y - bh - 22);
  }

  function drawThermometer(x: number, y: number, temp: number, mat: MaterialData): void {
    const thH = 100;
    const thW = 10;
    const frac = Math.min(1, (temp - T_INITIAL) / 400);

    // Thermometer tube
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(x - thW / 2, y - thH, thW, thH, 4);
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mercury / fill
    const fillH = frac * (thH - 10);
    const grad = ctx.createLinearGradient(x, y, x, y - fillH);
    grad.addColorStop(0, "#ef4444");
    grad.addColorStop(1, "#fbbf24");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x - thW / 2 + 2, y - fillH - 2, thW - 4, fillH, 2);
    ctx.fill();

    // Bulb
    ctx.beginPath();
    ctx.arc(x, y + 6, 8, 0, Math.PI * 2);
    ctx.fillStyle = frac > 0.05 ? "#ef4444" : "#94a3b8";
    ctx.fill();

    // Temperature text
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${toCelsius(temp).toFixed(1)}\u00B0C`, x, y - thH - 10);
  }

  function drawTemperatureChart(): void {
    const gx = width * 0.55;
    const gy = height * 0.08;
    const gw = width * 0.42;
    const gh = height * 0.55;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature vs Time", gx + gw / 2, gy + 20);

    const plotL = gx + 50;
    const plotR = gx + gw - 15;
    const plotT = gy + 35;
    const plotB = gy + gh - 30;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    // Axes and grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(plotL, plotT); ctx.lineTo(plotL, plotB); ctx.lineTo(plotR, plotB); ctx.stroke();
    const maxTemp = Math.max(temp1, temp2, T_INITIAL + 50);
    const minTemp = T_INITIAL - 10;
    const maxTime = Math.max(time, 5);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    for (let i = 0; i <= 4; i++) {
      const y = plotB - (i / 4) * plotH;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
      if (i > 0) { ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotR, y); ctx.stroke(); }
      ctx.textAlign = "right";
      ctx.fillText(`${toCelsius(minTemp + (i / 4) * (maxTemp - minTemp)).toFixed(0)}\u00B0C`, plotL - 5, y + 3);
      ctx.textAlign = "center";
      ctx.fillText(`${((i / 4) * maxTime).toFixed(0)}s`, plotL + (i / 4) * plotW, plotB + 14);
    }

    // Plot lines
    function plotLine(history: Array<{ t: number; T: number }>, color: string): void {
      if (history.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < history.length; i++) {
        const sx = plotL + (history[i].t / maxTime) * plotW;
        const sy = plotB - ((history[i].T - minTemp) / (maxTemp - minTemp)) * plotH;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    const mat1 = MATERIALS[material1Idx] || MATERIALS[0];
    const mat2 = MATERIALS[material2Idx] || MATERIALS[2];

    plotLine(history1, mat1.color);
    plotLine(history2, mat2.color);

    // Legend
    const legX = plotL + 10;
    const legY = plotT + 10;
    ctx.fillStyle = mat1.color;
    ctx.fillRect(legX, legY, 14, 10);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(mat1.name, legX + 18, legY + 9);

    ctx.fillStyle = mat2.color;
    ctx.fillRect(legX, legY + 18, 14, 10);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(mat2.name, legX + 18, legY + 27);
  }

  function drawEquation(): void {
    const ex = width * 0.55;
    const ey = height * 0.68;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.roundRect(ex, ey, width * 0.42, height * 0.28, 8);
    ctx.fill();

    const mat1 = MATERIALS[material1Idx] || MATERIALS[0];
    const mat2 = MATERIALS[material2Idx] || MATERIALS[2];

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Q = mc\u0394T  \u2192  \u0394T = Q/(mc)", ex + 12, ey + 20);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Q = ${heatPower.toFixed(0)} W \u00D7 ${time.toFixed(1)} s = ${energy.toFixed(0)} J, m = ${mass.toFixed(2)} kg`, ex + 12, ey + 44);
    ctx.fillStyle = mat1.color;
    ctx.fillText(`${mat1.name}: \u0394T = ${(toCelsius(temp1) - 20).toFixed(1)}\u00B0C  (c=${mat1.specificHeat})`, ex + 12, ey + 68);
    ctx.fillStyle = mat2.color;
    ctx.fillText(`${mat2.name}: \u0394T = ${(toCelsius(temp2) - 20).toFixed(1)}\u00B0C  (c=${mat2.specificHeat})`, ex + 12, ey + 88);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "italic 11px system-ui, sans-serif";
    const slower = mat1.specificHeat > mat2.specificHeat ? mat1.name : mat2.name;
    const ratio = Math.max(mat1.specificHeat, mat2.specificHeat) / Math.min(mat1.specificHeat, mat2.specificHeat);
    ctx.fillText(`${slower} heats ${ratio.toFixed(1)}x slower (higher c = more energy needed)`, ex + 12, ey + 112);
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Specific Heat Comparison", width / 2, 28);

    const mat1 = MATERIALS[material1Idx] || MATERIALS[0];
    const mat2 = MATERIALS[material2Idx] || MATERIALS[2];

    // Two beakers side by side in left half
    const beakerW = 70;
    const beakerH = 100;
    const x1 = width * 0.15;
    const x2 = width * 0.38;
    const baseY = height * 0.58;

    drawBurner(x1, baseY + 5, beakerW + 20);
    drawBurner(x2, baseY + 5, beakerW + 20);
    drawBeaker(x1, baseY, beakerW, beakerH, mat1, temp1);
    drawBeaker(x2, baseY, beakerW, beakerH, mat2, temp2);
    drawThermometer(x1 + beakerW / 2 + 20, baseY - 5, temp1, mat1);
    drawThermometer(x2 + beakerW / 2 + 20, baseY - 5, temp2, mat2);

    // Heat power label
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`P = ${heatPower.toFixed(0)} W (same for both)`, (x1 + x2) / 2, baseY + 35);

    drawTemperatureChart();
    drawEquation();

    // Time
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)} s`, 15, height - 10);
  }

  function reset(): void {
    resetState();
  }

  function destroy(): void {
    history1 = [];
    history2 = [];
  }

  function getStateDescription(): string {
    const mat1 = MATERIALS[material1Idx] || MATERIALS[0];
    const mat2 = MATERIALS[material2Idx] || MATERIALS[2];
    return (
      `Specific heat comparison: ${mat1.name} (c=${mat1.specificHeat}) vs ${mat2.name} (c=${mat2.specificHeat}) J/(kg*K). ` +
      `Mass=${mass.toFixed(2)} kg, Power=${heatPower.toFixed(0)} W, Energy delivered=${energy.toFixed(0)} J. ` +
      `${mat1.name}: ${toCelsius(temp1).toFixed(1)} C, ${mat2.name}: ${toCelsius(temp2).toFixed(1)} C. ` +
      `Higher specific heat means slower temperature rise. t=${time.toFixed(1)} s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpecificHeatFactory;
