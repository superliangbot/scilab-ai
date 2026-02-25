import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LogicFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("logic") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let gateType = 0; // 0=AND, 1=OR, 2=NOT, 3=NAND, 4=NOR, 5=XOR
  let inputA = 1;
  let inputB = 1;
  let showTruthTable = 1;

  const GATE_NAMES = ["AND", "OR", "NOT", "NAND", "NOR", "XOR"];

  function evaluate(gate: number, a: number, b: number): number {
    const ba = a >= 0.5;
    const bb = b >= 0.5;
    switch (gate) {
      case 0: return (ba && bb) ? 1 : 0; // AND
      case 1: return (ba || bb) ? 1 : 0; // OR
      case 2: return ba ? 0 : 1;          // NOT (only uses A)
      case 3: return (ba && bb) ? 0 : 1;  // NAND
      case 4: return (ba || bb) ? 0 : 1;  // NOR
      case 5: return (ba !== bb) ? 1 : 0;  // XOR
      default: return 0;
    }
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
  }

  function update(dt: number, params: Record<string, number>) {
    gateType = Math.round(params.gateType ?? 0);
    inputA = Math.round(params.inputA ?? 1);
    inputB = Math.round(params.inputB ?? 1);
    showTruthTable = params.showTruthTable ?? 1;
    time += Math.min(dt, 0.05);
  }

  function drawGateSymbol(cx: number, cy: number, type: number, scale: number = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const gateW = 80;
    const gateH = 60;

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";

    switch (type) {
      case 0: // AND
        ctx.beginPath();
        ctx.moveTo(-gateW / 2, -gateH / 2);
        ctx.lineTo(0, -gateH / 2);
        ctx.arc(0, 0, gateH / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-gateW / 2, gateH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 1: // OR
        ctx.beginPath();
        ctx.moveTo(-gateW / 2, -gateH / 2);
        ctx.quadraticCurveTo(-gateW / 4, 0, -gateW / 2, gateH / 2);
        ctx.quadraticCurveTo(gateW / 4, gateH / 2, gateW / 2, 0);
        ctx.quadraticCurveTo(gateW / 4, -gateH / 2, -gateW / 2, -gateH / 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 2: // NOT (triangle + circle)
        ctx.beginPath();
        ctx.moveTo(-gateW / 2, -gateH / 2);
        ctx.lineTo(gateW / 3, 0);
        ctx.lineTo(-gateW / 2, gateH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gateW / 3 + 8, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
        ctx.fill();
        ctx.stroke();
        break;

      case 3: // NAND (AND + circle)
        ctx.beginPath();
        ctx.moveTo(-gateW / 2, -gateH / 2);
        ctx.lineTo(0, -gateH / 2);
        ctx.arc(0, 0, gateH / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-gateW / 2, gateH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gateH / 2 + 8, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
        ctx.fill();
        ctx.stroke();
        break;

      case 4: // NOR (OR + circle)
        ctx.beginPath();
        ctx.moveTo(-gateW / 2, -gateH / 2);
        ctx.quadraticCurveTo(-gateW / 4, 0, -gateW / 2, gateH / 2);
        ctx.quadraticCurveTo(gateW / 4, gateH / 2, gateW / 2, 0);
        ctx.quadraticCurveTo(gateW / 4, -gateH / 2, -gateW / 2, -gateH / 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(gateW / 2 + 8, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
        ctx.fill();
        ctx.stroke();
        break;

      case 5: // XOR (OR + extra curve)
        ctx.beginPath();
        ctx.moveTo(-gateW / 2 - 8, -gateH / 2);
        ctx.quadraticCurveTo(-gateW / 4 - 8, 0, -gateW / 2 - 8, gateH / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-gateW / 2, -gateH / 2);
        ctx.quadraticCurveTo(-gateW / 4, 0, -gateW / 2, gateH / 2);
        ctx.quadraticCurveTo(gateW / 4, gateH / 2, gateW / 2, 0);
        ctx.quadraticCurveTo(gateW / 4, -gateH / 2, -gateW / 2, -gateH / 2);
        ctx.fill();
        ctx.stroke();
        break;
    }

    ctx.restore();
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e1b3a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Logic Gates", W / 2, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Current Gate: ${GATE_NAMES[gateType]}`, W / 2, 48);

    const output = evaluate(gateType, inputA, inputB);
    const isNot = gateType === 2;

    // Gate diagram
    const gateCx = W / 2;
    const gateCy = H * 0.35;

    // Gate symbol
    drawGateSymbol(gateCx, gateCy, gateType, 1.5);

    // Input wires
    const wireL = gateCx - 180;
    const wireR = gateCx + 180;

    // Input A wire
    const inputAY = isNot ? gateCy : gateCy - 20;
    ctx.strokeStyle = inputA ? "#10b981" : "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wireL, inputAY);
    ctx.lineTo(gateCx - 60, inputAY);
    ctx.stroke();

    // Input B wire (not for NOT gate)
    if (!isNot) {
      const inputBY = gateCy + 20;
      ctx.strokeStyle = inputB ? "#10b981" : "#475569";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(wireL, inputBY);
      ctx.lineTo(gateCx - 60, inputBY);
      ctx.stroke();
    }

    // Output wire
    ctx.strokeStyle = output ? "#fbbf24" : "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gateCx + 60 + (gateType === 2 || gateType === 3 || gateType === 4 ? 12 : 0), gateCy);
    ctx.lineTo(wireR, gateCy);
    ctx.stroke();

    // Input labels
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";

    // Input A
    ctx.fillStyle = inputA ? "#10b981" : "#ef4444";
    ctx.beginPath();
    ctx.arc(wireL - 20, inputAY, 18, 0, Math.PI * 2);
    ctx.fillStyle = inputA ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
    ctx.fill();
    ctx.strokeStyle = inputA ? "#10b981" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = inputA ? "#10b981" : "#ef4444";
    ctx.fillText(`A=${inputA}`, wireL - 20, inputAY + 5);

    // Input B
    if (!isNot) {
      const inputBY = gateCy + 20;
      ctx.beginPath();
      ctx.arc(wireL - 20, inputBY, 18, 0, Math.PI * 2);
      ctx.fillStyle = inputB ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)";
      ctx.fill();
      ctx.strokeStyle = inputB ? "#10b981" : "#ef4444";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = inputB ? "#10b981" : "#ef4444";
      ctx.fillText(`B=${inputB}`, wireL - 20, inputBY + 5);
    }

    // Output label
    ctx.beginPath();
    ctx.arc(wireR + 25, gateCy, 22, 0, Math.PI * 2);
    ctx.fillStyle = output ? "rgba(251, 191, 36, 0.2)" : "rgba(71, 85, 105, 0.2)";
    ctx.fill();
    ctx.strokeStyle = output ? "#fbbf24" : "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Output glow
    if (output) {
      const glow = ctx.createRadialGradient(wireR + 25, gateCy, 0, wireR + 25, gateCy, 35);
      glow.addColorStop(0, "rgba(251, 191, 36, 0.3)");
      glow.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(wireR + 25, gateCy, 35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "bold 18px monospace";
    ctx.fillStyle = output ? "#fbbf24" : "#475569";
    ctx.textAlign = "center";
    ctx.fillText(`${output}`, wireR + 25, gateCy + 6);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("OUT", wireR + 25, gateCy + 22);

    // Signal flow animation (electrons/pulses)
    if (inputA) {
      const pulseX = wireL + ((time * 100) % (gateCx - 60 - wireL));
      ctx.beginPath();
      ctx.arc(pulseX, inputAY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
      ctx.fill();
    }

    if (!isNot && inputB) {
      const inputBY = gateCy + 20;
      const pulseX = wireL + ((time * 100 + 30) % (gateCx - 60 - wireL));
      ctx.beginPath();
      ctx.arc(pulseX, inputBY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
      ctx.fill();
    }

    if (output) {
      const outStart = gateCx + 60;
      const pulseX = outStart + ((time * 100) % (wireR - outStart));
      ctx.beginPath();
      ctx.arc(pulseX, gateCy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
      ctx.fill();
    }

    // Boolean expression
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "#a78bfa";
    ctx.textAlign = "center";
    let expr = "";
    switch (gateType) {
      case 0: expr = `${inputA} AND ${inputB} = ${output}`; break;
      case 1: expr = `${inputA} OR ${inputB} = ${output}`; break;
      case 2: expr = `NOT ${inputA} = ${output}`; break;
      case 3: expr = `NOT(${inputA} AND ${inputB}) = ${output}`; break;
      case 4: expr = `NOT(${inputA} OR ${inputB}) = ${output}`; break;
      case 5: expr = `${inputA} XOR ${inputB} = ${output}`; break;
    }
    ctx.fillText(expr, W / 2, gateCy + 90);

    // Truth table
    if (showTruthTable >= 0.5) {
      const tableX = W / 2 - 120;
      const tableY = gateCy + 110;
      const colW = isNot ? 120 : 80;
      const rowH = 24;
      const cols = isNot ? 2 : 3;

      // Header
      ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
      ctx.fillRect(tableX, tableY, colW * cols, rowH);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.strokeRect(tableX, tableY, colW * cols, rowH);

      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      if (isNot) {
        ctx.fillText("A", tableX + colW / 2, tableY + 16);
        ctx.fillText("OUT", tableX + colW * 1.5, tableY + 16);
      } else {
        ctx.fillText("A", tableX + colW / 2, tableY + 16);
        ctx.fillText("B", tableX + colW * 1.5, tableY + 16);
        ctx.fillText("OUT", tableX + colW * 2.5, tableY + 16);
      }

      // Rows
      const rows = isNot ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
      ctx.font = "11px monospace";

      for (let i = 0; i < rows.length; i++) {
        const ry = tableY + (i + 1) * rowH;
        const row = rows[i];
        const a = row[0];
        const b = isNot ? 0 : row[1];
        const out = evaluate(gateType, a, b);

        const isCurrentRow = isNot
          ? a === inputA
          : (a === inputA && b === inputB);

        ctx.fillStyle = isCurrentRow ? "rgba(59, 130, 246, 0.15)" : "rgba(15, 23, 42, 0.5)";
        ctx.fillRect(tableX, ry, colW * cols, rowH);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tableX, ry, colW * cols, rowH);

        ctx.fillStyle = isCurrentRow ? "#e2e8f0" : "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText(`${a}`, tableX + colW / 2, ry + 16);
        if (!isNot) {
          ctx.fillText(`${b}`, tableX + colW * 1.5, ry + 16);
        }
        ctx.fillStyle = out ? "#fbbf24" : "#64748b";
        ctx.fillText(`${out}`, tableX + colW * (isNot ? 1.5 : 2.5), ry + 16);
      }
    }

    // Gate type selector visual
    const selY = H - 60;
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Gate Types:", W / 2, selY);

    for (let i = 0; i < GATE_NAMES.length; i++) {
      const bx = W / 2 - 150 + i * 52;
      const isActive = i === gateType;
      ctx.fillStyle = isActive ? "#3b82f6" : "#1e293b";
      ctx.beginPath();
      ctx.roundRect(bx, selY + 6, 46, 22, 4);
      ctx.fill();
      ctx.strokeStyle = isActive ? "#60a5fa" : "#334155";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillStyle = isActive ? "#fff" : "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(GATE_NAMES[i], bx + 23, selY + 21);
    }

    // Bottom explanation
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "center";
    ctx.fillText("Logic gates are the building blocks of digital circuits and computers", W / 2, H - 8);
  }

  function reset() { time = 0; }
  function destroy() {}

  function getStateDescription(): string {
    const output = evaluate(gateType, inputA, inputB);
    return (
      `Logic Gate: ${GATE_NAMES[gateType]}. ` +
      `Input A = ${inputA}${gateType !== 2 ? `, Input B = ${inputB}` : ""}. ` +
      `Output = ${output}. ` +
      `${gateType === 0 ? "AND: output 1 only when both inputs are 1." : ""}` +
      `${gateType === 1 ? "OR: output 1 when either input is 1." : ""}` +
      `${gateType === 2 ? "NOT: inverts the input." : ""}` +
      `${gateType === 3 ? "NAND: NOT-AND, output 0 only when both inputs are 1." : ""}` +
      `${gateType === 4 ? "NOR: NOT-OR, output 1 only when both inputs are 0." : ""}` +
      `${gateType === 5 ? "XOR: output 1 when inputs differ." : ""}` +
      ` Logic gates are fundamental building blocks of digital circuits.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LogicFactory;
