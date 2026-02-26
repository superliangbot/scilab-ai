import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Serial Parallel Circuit — demonstrates a circuit with resistors in both
 * series and parallel configurations. Shows current distribution and voltage drops.
 */

interface Charge {
  path: number; // 0 = main, 1 = branch A, 2 = branch B
  pos: number; // 0-1 along the path
}

const SerialParallelCircuitFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("serial-parallel-circuit") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 12;
  let rSeries = 10;
  let rParallelA = 20;
  let rParallelB = 30;

  let charges: Charge[] = [];

  function initCharges(): void {
    charges = [];
    for (let i = 0; i < 20; i++) {
      const path = i < 10 ? 0 : (i < 15 ? 1 : 2);
      charges.push({ path, pos: Math.random() });
    }
  }

  function totalResistance(): number {
    const rPar = (rParallelA * rParallelB) / (rParallelA + rParallelB);
    return rSeries + rPar;
  }

  function totalCurrent(): number {
    return voltage / totalResistance();
  }

  function currentA(): number {
    // Current through branch A: I_A = I_total × R_B / (R_A + R_B)
    return totalCurrent() * rParallelB / (rParallelA + rParallelB);
  }

  function currentB(): number {
    return totalCurrent() * rParallelA / (rParallelA + rParallelB);
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
    rSeries = params.rSeries ?? 10;
    rParallelA = params.rParallelA ?? 20;
    rParallelB = params.rParallelB ?? 30;

    const step = Math.min(dt, 0.033);
    time += step;

    const iTotal = totalCurrent();
    const iA = currentA();
    const iB = currentB();

    for (const ch of charges) {
      let speed: number;
      if (ch.path === 0) speed = iTotal * 0.03;
      else if (ch.path === 1) speed = iA * 0.03;
      else speed = iB * 0.03;

      ch.pos = (ch.pos + speed * step) % 1;
      if (ch.pos < 0) ch.pos += 1;
    }
  }

  function getMainPathPoint(t: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height / 2;
    const w = 280;
    const h = 180;

    // Rectangular path: bottom-left → bottom-right → top-right (split) → ... → top-left → bottom-left
    const peri = 2 * w + 2 * h;
    let d = t * peri;

    if (d < w) return { x: cx - w / 2 + d, y: cy + h / 2 }; // bottom
    d -= w;
    if (d < h) return { x: cx + w / 2, y: cy + h / 2 - d }; // right
    d -= h;
    if (d < w) return { x: cx + w / 2 - d, y: cy - h / 2 }; // top
    d -= w;
    return { x: cx - w / 2, y: cy - h / 2 + d }; // left
  }

  function getBranchPoint(t: number, branchIdx: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height / 2;
    const splitX = cx + 40;
    const joinX = cx + 140;
    const topY = cy - 40;
    const botY = cy + 40;
    const branchY = branchIdx === 0 ? topY - 20 : botY + 20;

    // Path: splitX → branchY → joinX → back
    const segLen = joinX - splitX;
    const totalLen = segLen * 2 + 80;
    let d = t * totalLen;

    if (d < 20) return { x: splitX, y: cy - 90 + (branchY - cy + 90) * (d / 20) };
    d -= 20;
    if (d < segLen) return { x: splitX + d, y: branchY };
    d -= segLen;
    if (d < 20) return { x: joinX, y: branchY + (cy - 90 - branchY) * (d / 20) };
    d -= 20;
    return { x: joinX - (d / segLen) * segLen, y: cy - 90 };
  }

  function drawResistor(x: number, y: number, label: string, value: string): void {
    // Zigzag
    ctx.strokeStyle = "#66bbff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 20, y);
    for (let i = 0; i < 5; i++) {
      const xp = x - 20 + (i + 0.5) * 8;
      const yp = i % 2 === 0 ? y - 6 : y + 6;
      ctx.lineTo(xp, yp);
    }
    ctx.lineTo(x + 20, y);
    ctx.stroke();

    // Box
    ctx.fillStyle = "rgba(40, 60, 100, 0.6)";
    ctx.beginPath();
    ctx.roundRect(x - 22, y - 10, 44, 20, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - 15);
    ctx.fillText(value, x, y + 25);
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0e1a");
    bg.addColorStop(1, "#0d1228");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Main circuit loop
    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(cx - 140, cy - 90, 280, 180);
    ctx.stroke();

    // Parallel branches
    const splitX = cx + 40;
    const joinX = cx + 120;
    const branchAY = cy - 90 - 30;
    const branchBY = cy - 90 + 30;

    // Clear the top section for parallel
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(splitX - 5, cy - 95, joinX - splitX + 10, 10);

    // Branch wires
    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 2;

    // Branch A
    ctx.beginPath();
    ctx.moveTo(splitX, cy - 90);
    ctx.lineTo(splitX, branchAY);
    ctx.lineTo(joinX, branchAY);
    ctx.lineTo(joinX, cy - 90);
    ctx.stroke();

    // Branch B
    ctx.beginPath();
    ctx.moveTo(splitX, cy - 90);
    ctx.lineTo(splitX, branchBY);
    ctx.lineTo(joinX, branchBY);
    ctx.lineTo(joinX, cy - 90);
    ctx.stroke();

    // Battery (left side)
    const bx = cx - 140;
    const by = cy;
    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx, by - 15);
    ctx.lineTo(bx, by + 15);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 1, by - 22);
    ctx.lineTo(bx - 1, by + 22);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, bx - 20, by + 4);

    // Series resistor (bottom)
    drawResistor(cx, cy + 90, "R_series", `${rSeries}Ω`);

    // Parallel resistors
    drawResistor((splitX + joinX) / 2, branchAY, "R_A", `${rParallelA}Ω`);
    drawResistor((splitX + joinX) / 2, branchBY, "R_B", `${rParallelB}Ω`);

    // Charges
    for (const ch of charges) {
      let pt: { x: number; y: number };
      if (ch.path === 0) {
        pt = getMainPathPoint(ch.pos);
      } else {
        pt = getBranchPoint(ch.pos, ch.path - 1);
      }

      ctx.fillStyle = "#ffcc33";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current labels
    const iTotal = totalCurrent();
    const iA = currentA();
    const iB = currentB();
    const rPar = (rParallelA * rParallelB) / (rParallelA + rParallelB);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 270, 120, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Series-Parallel Circuit", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`R_parallel = (R_A × R_B)/(R_A + R_B) = ${rPar.toFixed(1)}Ω`, 20, 46);
    ctx.fillText(`R_total = R_s + R_p = ${totalResistance().toFixed(1)}Ω`, 20, 62);
    ctx.fillText(`I_total = V/R = ${iTotal.toFixed(3)} A`, 20, 78);
    ctx.fillText(`I_A = ${iA.toFixed(3)} A, I_B = ${iB.toFixed(3)} A`, 20, 94);
    ctx.fillText(`V_series = ${(iTotal * rSeries).toFixed(2)}V`, 20, 110);
    ctx.fillText(`V_parallel = ${(iTotal * rPar).toFixed(2)}V`, 20, 126);
  }

  function reset(): void {
    time = 0;
    initCharges();
  }

  function destroy(): void {
    charges = [];
  }

  function getStateDescription(): string {
    const iTotal = totalCurrent();
    const rPar = (rParallelA * rParallelB) / (rParallelA + rParallelB);
    return (
      `Series-Parallel Circuit: V=${voltage}V, R_s=${rSeries}Ω, R_A=${rParallelA}Ω, R_B=${rParallelB}Ω. ` +
      `R_parallel=${rPar.toFixed(1)}Ω, R_total=${totalResistance().toFixed(1)}Ω. ` +
      `I_total=${iTotal.toFixed(3)}A. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SerialParallelCircuitFactory;
