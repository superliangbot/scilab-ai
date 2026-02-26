import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Electron {
  t: number; // position along path [0, 1]
  branch: number; // 0=main-top, 1/2/3=branch, 4=main-bottom
  speed: number;
}

const ParallelCircuitFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("parallel-circuit") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let voltage = 12;
  let resistance1 = 100;
  let resistance2 = 50;
  let resistance3 = 200;

  // Derived values
  let totalResistance = 0;
  let totalCurrent = 0;
  let current1 = 0;
  let current2 = 0;
  let current3 = 0;

  // Electrons
  let electrons: Electron[] = [];

  // Layout constants (fractions of canvas)
  const BATT_X = 0.1;
  const LEFT_X = 0.25;
  const RIGHT_X = 0.75;
  const TOP_Y = 0.15;
  const BOTTOM_Y = 0.85;
  const BRANCH_Y1 = 0.3;
  const BRANCH_Y2 = 0.5;
  const BRANCH_Y3 = 0.7;

  const BRANCH_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

  function computeCircuit(): void {
    const r1 = Math.max(resistance1, 0.1);
    const r2 = Math.max(resistance2, 0.1);
    const r3 = Math.max(resistance3, 0.1);
    totalResistance = 1 / (1 / r1 + 1 / r2 + 1 / r3);
    totalCurrent = voltage / totalResistance;
    current1 = voltage / r1;
    current2 = voltage / r2;
    current3 = voltage / r3;
  }

  function initElectrons(): void {
    electrons = [];
    // Main top wire electrons
    for (let i = 0; i < 6; i++) {
      electrons.push({ t: i / 6, branch: 0, speed: 0 });
    }
    // Branch electrons (proportional to current)
    const maxCurrent = Math.max(current1, current2, current3, 0.01);
    const counts = [
      Math.max(3, Math.round(8 * (current1 / maxCurrent))),
      Math.max(3, Math.round(8 * (current2 / maxCurrent))),
      Math.max(3, Math.round(8 * (current3 / maxCurrent))),
    ];
    for (let b = 0; b < 3; b++) {
      for (let i = 0; i < counts[b]; i++) {
        electrons.push({ t: i / counts[b], branch: b + 1, speed: 0 });
      }
    }
    // Main bottom wire electrons
    for (let i = 0; i < 6; i++) {
      electrons.push({ t: i / 6, branch: 4, speed: 0 });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeCircuit();
    initElectrons();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newV = params.voltage ?? 12;
    const newR1 = params.resistance1 ?? 100;
    const newR2 = params.resistance2 ?? 50;
    const newR3 = params.resistance3 ?? 200;

    const changed = newV !== voltage || newR1 !== resistance1 || newR2 !== resistance2 || newR3 !== resistance3;
    voltage = newV;
    resistance1 = newR1;
    resistance2 = newR2;
    resistance3 = newR3;

    computeCircuit();
    if (changed) initElectrons();

    const step = Math.min(dt, 0.033);
    const baseSpeed = totalCurrent * 0.008;

    for (const e of electrons) {
      if (e.branch === 0 || e.branch === 4) {
        e.speed = baseSpeed;
      } else if (e.branch === 1) {
        e.speed = (current1 / Math.max(totalCurrent, 0.001)) * baseSpeed;
      } else if (e.branch === 2) {
        e.speed = (current2 / Math.max(totalCurrent, 0.001)) * baseSpeed;
      } else {
        e.speed = (current3 / Math.max(totalCurrent, 0.001)) * baseSpeed;
      }
      e.t += e.speed * step;
      if (e.t > 1) e.t -= 1;
    }

    time += step;
  }

  function getElectronPos(e: Electron): { x: number; y: number } {
    const lx = width * LEFT_X;
    const rx = width * RIGHT_X;
    const ty = height * TOP_Y;
    const by = height * BOTTOM_Y;
    const bx = width * BATT_X;
    const branchYs = [height * BRANCH_Y1, height * BRANCH_Y2, height * BRANCH_Y3];

    if (e.branch === 0) {
      // Main top: battery top -> left junction -> right junction -> across top
      // Path: bx,ty -> lx,ty -> rx,ty
      const totalLen = (rx - bx);
      const pos = e.t * totalLen;
      return { x: bx + pos, y: ty };
    } else if (e.branch === 4) {
      // Main bottom: rx,by -> lx,by -> bx,by
      const totalLen = (rx - bx);
      const pos = e.t * totalLen;
      return { x: rx - pos, y: by };
    } else {
      // Branch: right junction -> resistor -> left junction (right to left)
      const bIdx = e.branch - 1;
      const brY = branchYs[bIdx];
      // Path segments: rx,ty -> rx,brY -> lx,brY -> lx,by
      const seg1 = brY - ty; // down from top to branch
      const seg2 = rx - lx; // across branch (right to left)
      const seg3 = by - brY; // down from branch to bottom
      const total = seg1 + seg2 + seg3;
      let d = e.t * total;

      if (d < seg1) {
        return { x: rx, y: ty + d };
      }
      d -= seg1;
      if (d < seg2) {
        return { x: rx - d, y: brY };
      }
      d -= seg2;
      return { x: lx, y: brY + d };
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawWire(x1: number, y1: number, x2: number, y2: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawResistor(cx: number, cy: number, color: string, label: string, ohms: number, current: number): void {
    const rw = 50;
    const rh = 18;

    // Background box
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(cx - rw / 2, cy - rh / 2, rw, rh);

    // Zigzag
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - rw / 2, cy);
    const zigzags = 5;
    for (let i = 0; i < zigzags; i++) {
      const zx = cx - rw / 2 + ((i + 0.5) / zigzags) * rw;
      const zy = cy + (i % 2 === 0 ? -rh / 2 + 2 : rh / 2 - 2);
      ctx.lineTo(zx, zy);
    }
    ctx.lineTo(cx + rw / 2, cy);
    ctx.stroke();

    // Labels
    ctx.fillStyle = color;
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${label} = ${ohms}\u03A9`, cx, cy - rh / 2 - 8);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`I = ${(current * 1000).toFixed(1)} mA`, cx, cy + rh / 2 + 14);
  }

  function drawBattery(): void {
    const bx = width * BATT_X;
    const ty = height * TOP_Y;
    const by = height * BOTTOM_Y;
    const midY = (ty + by) / 2;

    // Battery body
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx - 18, midY - 40, 36, 80, 4);
    ctx.fill();
    ctx.stroke();

    // Positive terminal
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(bx - 12, midY - 40, 24, 4);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", bx, midY - 48);

    // Negative terminal
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(bx - 8, midY + 36, 16, 4);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("\u2212", bx, midY + 54);

    // Voltage label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`${voltage.toFixed(1)} V`, bx - 40, midY + 5);

    // Battery symbol bars inside
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 10, midY - 12);
    ctx.lineTo(bx + 10, midY - 12);
    ctx.stroke();

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 5, midY - 2);
    ctx.lineTo(bx + 5, midY - 2);
    ctx.stroke();

    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 10, midY + 8);
    ctx.lineTo(bx + 10, midY + 8);
    ctx.stroke();

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - 5, midY + 18);
    ctx.lineTo(bx + 5, midY + 18);
    ctx.stroke();
  }

  function drawCircuitWires(): void {
    const bx = width * BATT_X;
    const lx = width * LEFT_X;
    const rx = width * RIGHT_X;
    const ty = height * TOP_Y;
    const by = height * BOTTOM_Y;
    const branchYs = [height * BRANCH_Y1, height * BRANCH_Y2, height * BRANCH_Y3];

    const wireColor = "#94a3b8";

    // Top main wire (battery to right junction)
    drawWire(bx, ty, lx, ty, wireColor);
    drawWire(lx, ty, rx, ty, wireColor);

    // Bottom main wire (right junction back to battery)
    drawWire(rx, by, lx, by, wireColor);
    drawWire(lx, by, bx, by, wireColor);

    // Battery vertical connections
    drawWire(bx, ty, bx, (ty + by) / 2 - 40, wireColor);
    drawWire(bx, (ty + by) / 2 + 40, bx, by, wireColor);

    // Branch wires (three parallel paths)
    for (let i = 0; i < 3; i++) {
      const color = BRANCH_COLORS[i];
      // Right side: down from top junction to branch
      drawWire(rx, ty, rx, branchYs[i], color);
      // Horizontal branch
      drawWire(rx, branchYs[i], lx, branchYs[i], color);
      // Left side: down from branch to bottom junction
      drawWire(lx, branchYs[i], lx, by, color);
      // Vertical connections to junctions
      if (i === 0) {
        drawWire(lx, ty, lx, branchYs[0], color);
      }
    }

    // Junction dots
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(lx, ty, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rx, ty, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, by, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rx, by, 5, 0, Math.PI * 2);
    ctx.fill();

    // Current flow arrows on main wires
    const arrowY1 = ty - 12;
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("\u2192 I total", (bx + rx) / 2, arrowY1);

    const arrowY2 = by + 16;
    ctx.fillText("\u2190 I total", (bx + rx) / 2, arrowY2);
  }

  function drawResistors(): void {
    const midX = (width * LEFT_X + width * RIGHT_X) / 2;
    const branchYs = [height * BRANCH_Y1, height * BRANCH_Y2, height * BRANCH_Y3];

    drawResistor(midX, branchYs[0], BRANCH_COLORS[0], "R1", resistance1, current1);
    drawResistor(midX, branchYs[1], BRANCH_COLORS[1], "R2", resistance2, current2);
    drawResistor(midX, branchYs[2], BRANCH_COLORS[2], "R3", resistance3, current3);
  }

  function drawCurrentArrows(): void {
    const rx = width * RIGHT_X;
    const branchYs = [height * BRANCH_Y1, height * BRANCH_Y2, height * BRANCH_Y3];
    const currents = [current1, current2, current3];
    const maxI = Math.max(current1, current2, current3, 0.001);

    for (let i = 0; i < 3; i++) {
      const arrowLen = 15 + 25 * (currents[i] / maxI);
      const ax = rx + 15;
      const ay = branchYs[i];

      ctx.fillStyle = BRANCH_COLORS[i];
      ctx.beginPath();
      ctx.moveTo(ax, ay - arrowLen / 2);
      ctx.lineTo(ax + 10, ay);
      ctx.lineTo(ax, ay + arrowLen / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawElectrons(): void {
    for (const e of electrons) {
      const pos = getElectronPos(e);

      const color = e.branch >= 1 && e.branch <= 3
        ? BRANCH_COLORS[e.branch - 1]
        : "#60a5fa";

      // Glow
      const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 7);
      glow.addColorStop(0, color.replace(")", ", 0.4)").replace("rgb", "rgba"));
      glow.addColorStop(0, `${color}66`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function drawInfoPanel(): void {
    const panelW = 240;
    const panelH = 140;
    const panelX = width - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Parallel Circuit", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    let y = panelY + 38;
    const lh = 16;

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Voltage: ${voltage.toFixed(1)} V`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`R_total: ${totalResistance.toFixed(1)} \u03A9`, panelX + 10, y); y += lh;
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`I_total: ${(totalCurrent * 1000).toFixed(1)} mA`, panelX + 10, y); y += lh;
    ctx.fillStyle = BRANCH_COLORS[0];
    ctx.fillText(`I\u2081 = ${(current1 * 1000).toFixed(1)} mA`, panelX + 10, y); y += lh;
    ctx.fillStyle = BRANCH_COLORS[1];
    ctx.fillText(`I\u2082 = ${(current2 * 1000).toFixed(1)} mA`, panelX + 10, y); y += lh;
    ctx.fillStyle = BRANCH_COLORS[2];
    ctx.fillText(`I\u2083 = ${(current3 * 1000).toFixed(1)} mA`, panelX + 10, y);
  }

  function drawFormulas(): void {
    const panelW = 220;
    const panelH = 55;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("1/R = 1/R\u2081 + 1/R\u2082 + 1/R\u2083", panelX + 10, panelY + 20);
    ctx.fillText("I = I\u2081 + I\u2082 + I\u2083 = V/R", panelX + 10, panelY + 40);
  }

  function render(): void {
    drawBackground();
    drawCircuitWires();
    drawBattery();
    drawResistors();
    drawCurrentArrows();
    drawElectrons();
    drawInfoPanel();
    drawFormulas();
  }

  function reset(): void {
    time = 0;
    computeCircuit();
    initElectrons();
  }

  function destroy(): void {
    electrons = [];
  }

  function getStateDescription(): string {
    return (
      `Parallel Circuit: V=${voltage.toFixed(1)} V, R1=${resistance1}\u03A9, R2=${resistance2}\u03A9, R3=${resistance3}\u03A9. ` +
      `Total R=${totalResistance.toFixed(1)}\u03A9. ` +
      `I_total=${(totalCurrent * 1000).toFixed(1)} mA, ` +
      `I1=${(current1 * 1000).toFixed(1)} mA, I2=${(current2 * 1000).toFixed(1)} mA, I3=${(current3 * 1000).toFixed(1)} mA. ` +
      `Same voltage across all branches. Currents inversely proportional to resistance.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ParallelCircuitFactory;
