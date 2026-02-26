import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Same Circuit — demonstrates that series and parallel circuits
 * can be drawn in different-looking ways but remain electrically identical.
 * Shows two visually distinct circuit diagrams that have the same topology.
 */

interface Charge {
  pos: number; // 0-1 along path
  speed: number;
}

const SameCircuitFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("same-circuit") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let voltage = 9;
  let resistance1 = 10;
  let resistance2 = 20;
  let circuitLayout = 0; // 0 = standard, 1 = rearranged

  let chargesLeft: Charge[] = [];
  let chargesRight: Charge[] = [];

  function initCharges(): void {
    chargesLeft = [];
    chargesRight = [];
    for (let i = 0; i < 12; i++) {
      chargesLeft.push({ pos: i / 12, speed: 0 });
      chargesRight.push({ pos: i / 12, speed: 0 });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initCharges();
  }

  function totalCurrent(): number {
    // Series: I = V / (R1 + R2)
    return voltage / (resistance1 + resistance2);
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 9;
    resistance1 = params.resistance1 ?? 10;
    resistance2 = params.resistance2 ?? 20;
    circuitLayout = params.circuitLayout ?? 0;

    const step = Math.min(dt, 0.033);
    time += step;

    const current = totalCurrent();
    const speed = current * 0.04;

    for (const ch of chargesLeft) {
      ch.speed = speed;
      ch.pos = (ch.pos + speed * step) % 1;
    }
    for (const ch of chargesRight) {
      ch.speed = speed;
      ch.pos = (ch.pos + speed * step) % 1;
    }
  }

  function getPathPoint(t: number, cx: number, cy: number, w: number, h: number): { x: number; y: number } {
    // Rectangular loop path
    const perimeter = 2 * w + 2 * h;
    let d = t * perimeter;
    if (d < w) return { x: cx - w / 2 + d, y: cy - h / 2 };
    d -= w;
    if (d < h) return { x: cx + w / 2, y: cy - h / 2 + d };
    d -= h;
    if (d < w) return { x: cx + w / 2 - d, y: cy + h / 2 };
    d -= w;
    return { x: cx - w / 2, y: cy + h / 2 - d };
  }

  function drawCircuit(cx: number, cy: number, label: string, rearranged: boolean, charges: Charge[]): void {
    const cw = 180;
    const ch = 130;

    // Wire loop
    ctx.strokeStyle = "rgba(150, 180, 220, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(cx - cw / 2, cy - ch / 2, cw, ch);
    ctx.stroke();

    // Battery (left side)
    const bx = cx - cw / 2;
    const by = cy;
    ctx.strokeStyle = "#ff6666";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx, by - 12);
    ctx.lineTo(bx, by + 12);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 1, by - 20);
    ctx.lineTo(bx - 1, by + 20);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage}V`, bx - 18, by + 4);

    if (!rearranged) {
      // Standard layout: R1 on top, R2 on right
      const r1x = cx;
      const r1y = cy - ch / 2;
      drawResistor(r1x, r1y, true, `R₁=${resistance1}Ω`);

      const r2x = cx + cw / 2;
      const r2y = cy;
      drawResistor(r2x, r2y, false, `R₂=${resistance2}Ω`);
    } else {
      // Rearranged: R1 on bottom, R2 on left-top area
      const r1x = cx;
      const r1y = cy + ch / 2;
      drawResistor(r1x, r1y, true, `R₁=${resistance1}Ω`);

      const r2x = cx + cw / 2;
      const r2y = cy;
      drawResistor(r2x, r2y, false, `R₂=${resistance2}Ω`);
    }

    // Charges
    for (const c of charges) {
      const pt = getPathPoint(c.pos, cx, cy, cw, ch);
      ctx.fillStyle = "#ffcc33";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy + ch / 2 + 30);
  }

  function drawResistor(x: number, y: number, horizontal: boolean, label: string): void {
    ctx.save();
    ctx.translate(x, y);
    if (!horizontal) ctx.rotate(Math.PI / 2);

    // Zigzag resistor symbol
    ctx.strokeStyle = "#66bbff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    const steps = 6;
    const w = 50 / steps;
    for (let i = 0; i < steps; i++) {
      const xp = -25 + i * w + w / 2;
      const yp = i % 2 === 0 ? -6 : 6;
      ctx.lineTo(xp, yp);
    }
    ctx.lineTo(25, 0);
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (horizontal) {
      ctx.fillText(label, 0, -14);
    } else {
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, -14);
    }
    ctx.restore();
  }

  function render(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0e1a");
    bg.addColorStop(1, "#0d1228");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const midX = width / 2;
    const midY = height / 2;
    const gap = 140;

    if (circuitLayout < 0.5) {
      // Show both layouts side by side
      drawCircuit(midX - gap, midY, "Layout A", false, chargesLeft);
      drawCircuit(midX + gap, midY, "Layout B (same circuit!)", true, chargesRight);

      // Equals sign between them
      ctx.fillStyle = "rgba(255, 255, 100, 0.8)";
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("=", midX, midY);
    } else {
      // Show single layout
      drawCircuit(midX, midY, "Series Circuit", false, chargesLeft);
    }

    // Info panel
    const current = totalCurrent();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 240, 90, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Same Circuit — Different Diagrams", 20, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`V = ${voltage}V, R₁ = ${resistance1}Ω, R₂ = ${resistance2}Ω`, 20, 46);
    ctx.fillText(`I = V/(R₁+R₂) = ${current.toFixed(3)} A`, 20, 62);
    ctx.fillText(`V₁ = ${(current * resistance1).toFixed(2)}V, V₂ = ${(current * resistance2).toFixed(2)}V`, 20, 78);
    ctx.fillText(`Topology determines behavior, not layout`, 20, 94);
  }

  function reset(): void {
    time = 0;
    initCharges();
  }

  function destroy(): void {
    chargesLeft = [];
    chargesRight = [];
  }

  function getStateDescription(): string {
    const current = totalCurrent();
    return (
      `Same Circuit: V=${voltage}V, R₁=${resistance1}Ω, R₂=${resistance2}Ω (series). ` +
      `I=${current.toFixed(3)}A. Shows that circuit topology, not diagram layout, determines behavior. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SameCircuitFactory;
