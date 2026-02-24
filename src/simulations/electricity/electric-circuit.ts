import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectricCircuitFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electric-circuit") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 9; // V
  let resistance1 = 100; // Ω
  let resistance2 = 200; // Ω
  let circuitType = 0; // 0=series, 1=parallel

  interface Electron {
    pos: number; // 0-1 along path
    speed: number;
  }

  let electrons: Electron[] = [];

  function initElectrons(): void {
    electrons = [];
    for (let i = 0; i < 20; i++) {
      electrons.push({ pos: i / 20, speed: 0 });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initElectrons();
  }

  function getCircuitValues(): { totalR: number; current: number; v1: number; v2: number; i1: number; i2: number; power: number } {
    let totalR: number, i1: number, i2: number, v1: number, v2: number;
    if (circuitType === 0) {
      // Series
      totalR = resistance1 + resistance2;
      const I = voltage / totalR;
      i1 = I;
      i2 = I;
      v1 = I * resistance1;
      v2 = I * resistance2;
    } else {
      // Parallel
      totalR = (resistance1 * resistance2) / (resistance1 + resistance2);
      i1 = voltage / resistance1;
      i2 = voltage / resistance2;
      v1 = voltage;
      v2 = voltage;
    }
    const current = voltage / totalR;
    const power = voltage * current;
    return { totalR, current, v1, v2, i1, i2, power };
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 9;
    resistance1 = params.resistance1 ?? 100;
    resistance2 = params.resistance2 ?? 200;
    circuitType = Math.round(params.circuitType ?? 0);
    time += dt;

    const { current, totalR } = getCircuitValues();
    const electronSpeed = Math.min(0.5, current / 1000) * 2;

    for (const e of electrons) {
      e.speed = electronSpeed;
      e.pos = (e.pos + e.speed * dt) % 1;
    }
  }

  // Circuit path - returns x,y for normalized position 0-1
  function getSeriesPath(t: number): { x: number; y: number } {
    const mx = width * 0.15;
    const my = height * 0.2;
    const mw = width * 0.7;
    const mh = height * 0.5;

    // Rectangular circuit path: top → right → bottom → left
    const totalPerimeter = 2 * mw + 2 * mh;
    const dist = t * totalPerimeter;

    if (dist < mw) {
      return { x: mx + dist, y: my };
    } else if (dist < mw + mh) {
      return { x: mx + mw, y: my + (dist - mw) };
    } else if (dist < 2 * mw + mh) {
      return { x: mx + mw - (dist - mw - mh), y: my + mh };
    } else {
      return { x: mx, y: my + mh - (dist - 2 * mw - mh) };
    }
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    const { totalR, current, v1, v2, i1, i2, power } = getCircuitValues();

    const mx = width * 0.15;
    const my = height * 0.2;
    const mw = width * 0.7;
    const mh = height * 0.5;

    if (circuitType === 0) {
      // Series circuit
      // Wire path
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + mw, my);
      ctx.lineTo(mx + mw, my + mh);
      ctx.lineTo(mx, my + mh);
      ctx.lineTo(mx, my);
      ctx.stroke();

      // Battery (left side, middle)
      const batX = mx;
      const batY = my + mh * 0.5;
      drawBattery(batX, batY, voltage);

      // Resistor 1 (top, middle)
      const r1X = mx + mw * 0.35;
      const r1Y = my;
      drawResistor(r1X, r1Y, resistance1, "R₁", true);

      // Resistor 2 (top, right-ish)
      const r2X = mx + mw * 0.7;
      const r2Y = my;
      drawResistor(r2X, r2Y, resistance2, "R₂", true);

      // Light bulb indicator on bottom
      const bulbX = mx + mw * 0.5;
      const bulbY = my + mh;
      const brightness = Math.min(1, current / 0.1);
      drawBulb(bulbX, bulbY, brightness);

    } else {
      // Parallel circuit
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 4;

      // Main horizontal wires
      ctx.beginPath();
      ctx.moveTo(mx, my + mh * 0.5);
      ctx.lineTo(mx + mw * 0.3, my + mh * 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(mx + mw * 0.7, my + mh * 0.5);
      ctx.lineTo(mx + mw, my + mh * 0.5);
      ctx.lineTo(mx + mw, my + mh);
      ctx.lineTo(mx, my + mh);
      ctx.lineTo(mx, my + mh * 0.5);
      ctx.stroke();

      // Branch split
      ctx.beginPath();
      ctx.moveTo(mx + mw * 0.3, my + mh * 0.5);
      ctx.lineTo(mx + mw * 0.3, my + mh * 0.25);
      ctx.lineTo(mx + mw * 0.7, my + mh * 0.25);
      ctx.lineTo(mx + mw * 0.7, my + mh * 0.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(mx + mw * 0.3, my + mh * 0.5);
      ctx.lineTo(mx + mw * 0.3, my + mh * 0.75);
      ctx.lineTo(mx + mw * 0.7, my + mh * 0.75);
      ctx.lineTo(mx + mw * 0.7, my + mh * 0.5);
      ctx.stroke();

      // Battery
      drawBattery(mx, my + mh * 0.5, voltage);

      // Resistor 1 (top branch)
      drawResistor(mx + mw * 0.5, my + mh * 0.25, resistance1, "R₁", true);

      // Resistor 2 (bottom branch)
      drawResistor(mx + mw * 0.5, my + mh * 0.75, resistance2, "R₂", true);

      // Bulb
      const brightness = Math.min(1, current / 0.1);
      drawBulb(mx + mw * 0.5, my + mh, brightness);
    }

    // Draw electrons
    ctx.fillStyle = "#44aaff";
    for (const e of electrons) {
      const p = getSeriesPath(e.pos);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current direction arrow
    ctx.fillStyle = "rgba(255,200,50,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("→ conventional current", mx + mw * 0.5, my - 10);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(8, height * 0.78, width - 16, height * 0.2, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      circuitType === 0 ? "Series Circuit" : "Parallel Circuit",
      16,
      height * 0.78 + 20
    );

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`V = ${voltage} V`, 16, height * 0.78 + 40);
    ctx.fillStyle = "#ccc";

    if (circuitType === 0) {
      ctx.fillText(`R_total = R₁ + R₂ = ${totalR.toFixed(1)} Ω`, 16, height * 0.78 + 56);
      ctx.fillText(`I = V/R = ${current.toFixed(4)} A = ${(current * 1000).toFixed(1)} mA`, 16, height * 0.78 + 72);
      ctx.fillText(`V₁ = ${v1.toFixed(2)} V, V₂ = ${v2.toFixed(2)} V`, width * 0.5, height * 0.78 + 56);
    } else {
      ctx.fillText(`1/R = 1/R₁ + 1/R₂ → R_total = ${totalR.toFixed(1)} Ω`, 16, height * 0.78 + 56);
      ctx.fillText(`I_total = ${(current * 1000).toFixed(1)} mA`, 16, height * 0.78 + 72);
      ctx.fillText(`I₁ = ${(i1 * 1000).toFixed(1)} mA, I₂ = ${(i2 * 1000).toFixed(1)} mA`, width * 0.5, height * 0.78 + 56);
    }
    ctx.fillText(`P = ${power.toFixed(3)} W`, width * 0.5, height * 0.78 + 72);
  }

  function drawBattery(x: number, y: number, v: number): void {
    // Battery symbol
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    // Long line (positive)
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 15);
    ctx.lineTo(x - 1, y + 15);
    ctx.stroke();
    // Short line (negative)
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 5, y - 8);
    ctx.lineTo(x + 5, y + 8);
    ctx.stroke();

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${v}V`, x + 2, y - 20);
    ctx.fillText("+", x - 8, y - 12);
    ctx.fillText("−", x + 12, y - 12);
  }

  function drawResistor(x: number, y: number, r: number, label: string, horizontal: boolean): void {
    const len = 40;
    ctx.strokeStyle = "#ff8844";
    ctx.lineWidth = 2;
    ctx.beginPath();

    if (horizontal) {
      const zigW = len / 6;
      const zigH = 8;
      ctx.moveTo(x - len / 2, y);
      for (let i = 0; i < 6; i++) {
        const sx = x - len / 2 + i * zigW;
        ctx.lineTo(sx + zigW * 0.25, y - zigH);
        ctx.lineTo(sx + zigW * 0.75, y + zigH);
        ctx.lineTo(sx + zigW, y);
      }
      ctx.stroke();
    } else {
      const zigW = 8;
      const zigH = len / 6;
      ctx.moveTo(x, y - len / 2);
      for (let i = 0; i < 6; i++) {
        const sy = y - len / 2 + i * zigH;
        ctx.lineTo(x - zigW, sy + zigH * 0.25);
        ctx.lineTo(x + zigW, sy + zigH * 0.75);
        ctx.lineTo(x, sy + zigH);
      }
      ctx.stroke();
    }

    ctx.fillStyle = "#ff8844";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${label} = ${r}Ω`, x, y + (horizontal ? 22 : 0) + (horizontal ? 0 : len / 2 + 15));
  }

  function drawBulb(x: number, y: number, brightness: number): void {
    // Bulb glow
    if (brightness > 0.01) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 20 + brightness * 20);
      glow.addColorStop(0, `rgba(255,255,100,${brightness * 0.5})`);
      glow.addColorStop(1, "rgba(255,255,100,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 20 + brightness * 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bulb body
    ctx.fillStyle = `rgba(255,255,${Math.round(100 + brightness * 155)},${0.3 + brightness * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Filament
    ctx.strokeStyle = `rgba(255,${Math.round(200 * brightness)},0,${brightness})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 4);
    ctx.lineTo(x - 2, y - 4);
    ctx.lineTo(x + 2, y + 4);
    ctx.lineTo(x + 4, y - 4);
    ctx.stroke();
  }

  function reset(): void {
    time = 0;
    initElectrons();
  }

  function destroy(): void {
    electrons = [];
  }

  function getStateDescription(): string {
    const { totalR, current, v1, v2, i1, i2, power } = getCircuitValues();
    return (
      `Electric Circuit: ${circuitType === 0 ? "series" : "parallel"} circuit, ` +
      `V=${voltage}V, R₁=${resistance1}Ω, R₂=${resistance2}Ω. ` +
      `Total resistance=${totalR.toFixed(1)}Ω, current=${(current * 1000).toFixed(1)}mA. ` +
      (circuitType === 0
        ? `Series: V₁=${v1.toFixed(2)}V, V₂=${v2.toFixed(2)}V, same current through both. `
        : `Parallel: I₁=${(i1 * 1000).toFixed(1)}mA, I₂=${(i2 * 1000).toFixed(1)}mA, same voltage across both. `) +
      `Power=${power.toFixed(3)}W. Ohm's Law: V=IR.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectricCircuitFactory;
