import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Serial Parallel Circuit 3 — a complex mixed circuit with 4 resistors:
 * (R1 series with (R2 ∥ R3)) all in series with R4.
 * Shows power dissipation and energy relationships.
 */

interface Charge {
  branch: number;
  pos: number;
}

const SerialParallelCircuit3Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("serial-parallel-circuit-3") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 24;
  let r1 = 10;
  let r2 = 20;
  let r3 = 30;
  let r4 = 15;

  let charges: Charge[] = [];

  function initCharges(): void {
    charges = [];
    for (let i = 0; i < 28; i++) {
      const b = i < 14 ? 0 : i < 21 ? 1 : 2;
      charges.push({ branch: b, pos: Math.random() });
    }
  }

  function rPar(): number {
    return (r2 * r3) / (r2 + r3);
  }

  function rTot(): number {
    return r1 + rPar() + r4;
  }

  function iTot(): number {
    return voltage / rTot();
  }

  function iR2(): number {
    return iTot() * r3 / (r2 + r3);
  }

  function iR3(): number {
    return iTot() * r2 / (r2 + r3);
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
    voltage = params.voltage ?? 24;
    r1 = params.r1 ?? 10;
    r2 = params.r2 ?? 20;
    r3 = params.r3 ?? 30;

    const step = Math.min(dt, 0.033);
    time += step;

    for (const ch of charges) {
      let speed: number;
      if (ch.branch === 0) speed = iTot() * 0.02;
      else if (ch.branch === 1) speed = iR2() * 0.02;
      else speed = iR3() * 0.02;
      ch.pos = (ch.pos + speed * step) % 1;
    }
  }

  function drawResistor(x: number, y: number, label: string, horizontal: boolean): void {
    ctx.save();
    ctx.translate(x, y);
    if (!horizontal) ctx.rotate(Math.PI / 2);

    ctx.fillStyle = "rgba(40, 55, 90, 0.7)";
    ctx.beginPath();
    ctx.roundRect(-20, -9, 40, 18, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 170, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = "#66aaff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(-16 + (i + 0.5) * 6.4, i % 2 === 0 ? -5 : 5);
    }
    ctx.lineTo(16, 0);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (horizontal) {
      ctx.fillText(label, 0, -14);
    } else {
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, -26);
    }
    ctx.restore();
  }

  function getLoopPoint(t: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height / 2;
    const hw = 160;
    const hh = 110;
    const p = (hw + hh) * 2 * 2;
    let d = t * p;
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
    bg.addColorStop(0, "#090d18");
    bg.addColorStop(1, "#0c1125");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Main circuit loop
    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(cx - 160, cy - 110, 320, 220);
    ctx.stroke();

    // Parallel section on top
    const splitX = cx - 20;
    const joinX = cx + 100;
    const topY = cy - 110;
    const brAY = topY - 30;
    const brBY = topY + 30;

    ctx.fillStyle = "#090d18";
    ctx.fillRect(splitX - 3, topY - 3, joinX - splitX + 6, 6);

    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 2;
    // Branch A (top)
    ctx.beginPath();
    ctx.moveTo(splitX, topY);
    ctx.lineTo(splitX, brAY);
    ctx.lineTo(joinX, brAY);
    ctx.lineTo(joinX, topY);
    ctx.stroke();
    // Branch B (bottom)
    ctx.beginPath();
    ctx.moveTo(splitX, topY);
    ctx.lineTo(splitX, brBY);
    ctx.lineTo(joinX, brBY);
    ctx.lineTo(joinX, topY);
    ctx.stroke();

    // Junction dots
    ctx.fillStyle = "#88aadd";
    for (const jx of [splitX, joinX]) {
      ctx.beginPath();
      ctx.arc(jx, topY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Battery (left)
    const bx = cx - 160;
    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx, cy - 12);
    ctx.lineTo(bx, cy + 12);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 1, cy - 18);
    ctx.lineTo(bx - 1, cy + 18);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, bx - 22, cy + 4);

    // Resistors
    drawResistor(cx - 80, cy + 110, `R₁ ${r1}Ω`, true); // bottom (series)
    drawResistor((splitX + joinX) / 2, brAY, `R₂ ${r2}Ω`, true); // parallel A
    drawResistor((splitX + joinX) / 2, brBY, `R₃ ${r3}Ω`, true); // parallel B
    drawResistor(cx + 160, cy, `R₄ ${r4}Ω`, false); // right (series)

    // Charges
    for (const ch of charges) {
      let pt: { x: number; y: number };
      if (ch.branch === 0) {
        pt = getLoopPoint(ch.pos);
      } else {
        const bY = ch.branch === 1 ? brAY : brBY;
        const t = ch.pos;
        if (t < 0.5) {
          pt = { x: splitX + (joinX - splitX) * t * 2, y: bY };
        } else {
          pt = { x: joinX - (joinX - splitX) * (t - 0.5) * 2, y: bY };
        }
      }
      ctx.fillStyle = "#ffcc33";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power dissipation bars
    const pTot = voltage * iTot();
    const p1 = iTot() * iTot() * r1;
    const p2 = iR2() * iR2() * r2;
    const p3 = iR3() * iR3() * r3;
    const p4 = iTot() * iTot() * r4;

    const barX = 15;
    const barY = height - 80;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(barX - 5, barY - 20, 180, 85, 5);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Power Dissipation:", barX, barY - 6);

    const powers = [
      { label: "R₁", val: p1, color: "#ff6666" },
      { label: "R₂", val: p2, color: "#66ff66" },
      { label: "R₃", val: p3, color: "#6666ff" },
      { label: "R₄", val: p4, color: "#ffaa33" },
    ];

    for (let i = 0; i < powers.length; i++) {
      const py = barY + 8 + i * 15;
      const barW = Math.min((powers[i].val / pTot) * 100, 100);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(`${powers[i].label}:`, barX, py + 4);
      ctx.fillStyle = powers[i].color;
      ctx.fillRect(barX + 25, py - 4, barW, 10);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(`${powers[i].val.toFixed(2)}W`, barX + 130, py + 4);
    }

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 270, 105, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Series-Parallel Circuit 3", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`R₁=${r1}Ω + (R₂=${r2}Ω ∥ R₃=${r3}Ω) + R₄=${r4}Ω`, 20, 46);
    ctx.fillText(`R_total = ${rTot().toFixed(1)}Ω`, 20, 62);
    ctx.fillText(`I_total = ${iTot().toFixed(3)}A`, 20, 78);
    ctx.fillText(`P_total = ${pTot.toFixed(2)}W`, 20, 94);
    ctx.fillText(`I₂ = ${iR2().toFixed(3)}A, I₃ = ${iR3().toFixed(3)}A`, 20, 110);
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
      `Series-Parallel Circuit 3: V=${voltage}V, R₁=${r1}Ω, R₂=${r2}Ω, R₃=${r3}Ω, R₄=${r4}Ω. ` +
      `R_total=${rTot().toFixed(1)}Ω, I=${iTot().toFixed(3)}A. ` +
      `P_total=${(voltage * iTot()).toFixed(2)}W. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SerialParallelCircuit3Factory;
