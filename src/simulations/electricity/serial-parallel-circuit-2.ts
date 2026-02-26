import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Serial Parallel Circuit 2 — a more complex series-parallel circuit with
 * 3 resistors: R1 in series, R2 and R3 in parallel, plus ammeter and voltmeter readouts.
 */

interface Charge {
  branch: number; // 0=main loop, 1=branch1, 2=branch2
  pos: number;
}

const SerialParallelCircuit2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("serial-parallel-circuit-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 12;
  let r1 = 10;
  let r2 = 20;
  let r3 = 30;

  let charges: Charge[] = [];

  function initCharges(): void {
    charges = [];
    for (let i = 0; i < 24; i++) {
      const branch = i < 12 ? 0 : i < 18 ? 1 : 2;
      charges.push({ branch, pos: Math.random() });
    }
  }

  function rParallel(): number {
    return (r2 * r3) / (r2 + r3);
  }

  function rTotal(): number {
    return r1 + rParallel();
  }

  function iTotal(): number {
    return voltage / rTotal();
  }

  function i2(): number {
    return iTotal() * r3 / (r2 + r3);
  }

  function i3(): number {
    return iTotal() * r2 / (r2 + r3);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initCharges();
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 12;
    r1 = params.r1 ?? 10;
    r2 = params.r2 ?? 20;
    r3 = params.r3 ?? 30;

    const step = Math.min(dt, 0.033);
    time += step;

    for (const ch of charges) {
      let speed: number;
      if (ch.branch === 0) speed = iTotal() * 0.025;
      else if (ch.branch === 1) speed = i2() * 0.025;
      else speed = i3() * 0.025;

      ch.pos = (ch.pos + speed * step) % 1;
    }
  }

  function drawResistorBox(x: number, y: number, label: string, ohms: string, horizontal: boolean): void {
    ctx.save();
    ctx.translate(x, y);
    if (!horizontal) ctx.rotate(Math.PI / 2);

    ctx.fillStyle = "rgba(40, 60, 100, 0.7)";
    ctx.beginPath();
    ctx.roundRect(-22, -10, 44, 20, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Zigzag inside
    ctx.strokeStyle = "#66bbff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(-18 + (i + 0.5) * 6, i % 2 === 0 ? -5 : 5);
    }
    ctx.lineTo(18, 0);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";

    if (horizontal) {
      ctx.fillText(label, 0, -16);
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillText(ohms, 0, 26);
    } else {
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, -30);
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillText(ohms, 0, 30);
    }

    ctx.restore();
  }

  function drawMeter(x: number, y: number, label: string, value: string, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y + 4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillText(value, x, y + 24);
  }

  function getCircuitPoint(t: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height / 2;
    const hw = 150;
    const hh = 100;
    const peri = 2 * hw * 2 + 2 * hh * 2;
    let d = t * peri;

    if (d < hw * 2) return { x: cx - hw + d, y: cy + hh };
    d -= hw * 2;
    if (d < hh * 2) return { x: cx + hw, y: cy + hh - d };
    d -= hh * 2;
    if (d < hw * 2) return { x: cx + hw - d, y: cy - hh };
    d -= hw * 2;
    return { x: cx - hw, y: cy - hh + d };
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0e1a");
    bg.addColorStop(1, "#0d1228");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Main loop wires
    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(cx - 150, cy - 100, 300, 200);
    ctx.stroke();

    // Parallel section (top portion between splitX and joinX)
    const splitX = cx + 20;
    const joinX = cx + 130;
    const topY = cy - 100;
    const br1Y = topY - 35;
    const br2Y = topY + 35;

    // Clear top wire for parallel split
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(splitX - 3, topY - 3, joinX - splitX + 6, 6);

    // Branch wires
    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, topY);
    ctx.lineTo(splitX, br1Y);
    ctx.lineTo(joinX, br1Y);
    ctx.lineTo(joinX, topY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(splitX, topY);
    ctx.lineTo(splitX, br2Y);
    ctx.lineTo(joinX, br2Y);
    ctx.lineTo(joinX, topY);
    ctx.stroke();

    // Junction dots
    ctx.fillStyle = "#88aadd";
    ctx.beginPath();
    ctx.arc(splitX, topY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(joinX, topY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Battery (left)
    const bx = cx - 150;
    const by = cy;
    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx, by - 12);
    ctx.lineTo(bx, by + 12);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 1, by - 18);
    ctx.lineTo(bx - 1, by + 18);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, bx - 22, by + 4);

    // Resistors
    drawResistorBox(cx - 60, cy + 100, "R₁", `${r1}Ω`, true);
    drawResistorBox((splitX + joinX) / 2, br1Y, "R₂", `${r2}Ω`, true);
    drawResistorBox((splitX + joinX) / 2, br2Y, "R₃", `${r3}Ω`, true);

    // Meters
    drawMeter(cx + 150, cy, "A", `${iTotal().toFixed(2)}A`, "#ffcc33");
    drawMeter(cx - 60, cy + 60, "V₁", `${(iTotal() * r1).toFixed(1)}V`, "#ff8866");
    drawMeter((splitX + joinX) / 2, topY + 65, "V_p", `${(iTotal() * rParallel()).toFixed(1)}V`, "#66ccff");

    // Charges
    for (const ch of charges) {
      let pt: { x: number; y: number };
      if (ch.branch === 0) {
        pt = getCircuitPoint(ch.pos);
      } else {
        // Simple interpolation along branch
        const bY = ch.branch === 1 ? br1Y : br2Y;
        const t = ch.pos;
        if (t < 0.5) {
          pt = { x: splitX + (joinX - splitX) * (t * 2), y: bY };
        } else {
          pt = { x: joinX - (joinX - splitX) * ((t - 0.5) * 2), y: bY };
        }
      }
      ctx.fillStyle = "#ffcc33";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 260, 120, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Series-Parallel Circuit 2", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`R₁=${r1}Ω (series), R₂=${r2}Ω ∥ R₃=${r3}Ω`, 20, 46);
    ctx.fillText(`R_∥ = ${rParallel().toFixed(1)}Ω, R_total = ${rTotal().toFixed(1)}Ω`, 20, 62);
    ctx.fillText(`I_total = ${iTotal().toFixed(3)}A`, 20, 78);
    ctx.fillText(`I₂ = ${i2().toFixed(3)}A, I₃ = ${i3().toFixed(3)}A`, 20, 94);
    ctx.fillText(`V₁ = ${(iTotal() * r1).toFixed(2)}V, V_∥ = ${(iTotal() * rParallel()).toFixed(2)}V`, 20, 110);
    ctx.fillText(`Kirchhoff: V₁ + V_∥ = ${voltage}V ✓`, 20, 126);
  }

  function reset(): void {
    time = 0;
    initCharges();
  }

  function destroy(): void {
    charges = [];
  }

  function getStateDescription(): string {
    return (
      `Series-Parallel Circuit 2: V=${voltage}V, R₁=${r1}Ω, R₂=${r2}Ω, R₃=${r3}Ω. ` +
      `R_total=${rTotal().toFixed(1)}Ω, I_total=${iTotal().toFixed(3)}A. ` +
      `I₂=${i2().toFixed(3)}A, I₃=${i3().toFixed(3)}A. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SerialParallelCircuit2Factory;
