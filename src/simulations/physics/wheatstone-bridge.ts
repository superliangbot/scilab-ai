import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const WheatstoneBridgeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("wheatstone-bridge") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let r1 = 10;
  let r2 = 20;
  let r3 = 10;
  let r4 = 20;
  let voltage = 5;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    r1 = params.r1 ?? 10;
    r2 = params.r2 ?? 20;
    r3 = params.r3 ?? 10;
    r4 = params.r4 ?? 20;
    voltage = params.voltage ?? 5;
    time += dt;
  }

  function drawResistor(x1: number, y1: number, x2: number, y2: number, label: string, value: number): void {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    // Wire segments
    ctx.strokeStyle = "rgba(200,200,200,0.7)";
    ctx.lineWidth = 2;

    const rLen = len * 0.4;
    const wireLen = (len - rLen) / 2;
    const sx = x1 + (dx / len) * wireLen;
    const sy = y1 + (dy / len) * wireLen;
    const ex = x2 - (dx / len) * wireLen;
    const ey = y2 - (dy / len) * wireLen;

    // Wire to resistor
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Zigzag resistor
    const segments = 6;
    const amplitude = 8;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const px = sx + (ex - sx) * t;
      const py = sy + (ey - sy) * t;
      const offset = (i % 2 === 1 ? 1 : -1) * amplitude;
      if (i < segments) {
        ctx.lineTo(px + nx * offset, py + ny * offset);
      } else {
        ctx.lineTo(ex, ey);
      }
    }
    ctx.strokeStyle = "#f39c12";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${label} = ${value}Ω`, mx + nx * 22, my + ny * 22);
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0f0f2e");
    bg.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Bridge layout: diamond shape
    const cx = width / 2;
    const cy = height * 0.45;
    const hSpan = Math.min(width * 0.3, 160);
    const vSpan = Math.min(height * 0.25, 100);

    // Node positions
    const top = { x: cx, y: cy - vSpan };
    const bottom = { x: cx, y: cy + vSpan };
    const left = { x: cx - hSpan, y: cy };
    const right = { x: cx + hSpan, y: cy };

    // Draw resistors
    drawResistor(top.x, top.y, left.x, left.y, "R1", r1);
    drawResistor(top.x, top.y, right.x, right.y, "R2", r2);
    drawResistor(left.x, left.y, bottom.x, bottom.y, "R3", r3);
    drawResistor(right.x, right.y, bottom.x, bottom.y, "R4", r4);

    // Galvanometer bridge (horizontal)
    ctx.strokeStyle = "rgba(200,200,200,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    // Galvanometer circle
    const gx = cx;
    const gy = cy;
    ctx.beginPath();
    ctx.arc(gx, gy, 18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,20,40,0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("G", gx, gy + 4);

    // Calculate bridge voltage
    // Vb = V * (R3/(R1+R3) - R4/(R2+R4))
    const vBridge = voltage * (r3 / (r1 + r3) - r4 / (r2 + r4));
    const isBalanced = Math.abs(vBridge) < 0.01;

    // Galvanometer needle
    const needleAngle = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, vBridge * 0.3));
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.sin(needleAngle) * 14, gy - Math.cos(needleAngle) * 14);
    ctx.strokeStyle = isBalanced ? "#2ecc71" : "#e74c3c";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Node dots
    for (const node of [top, bottom, left, right]) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    // Battery (top to bottom)
    ctx.strokeStyle = "rgba(200,200,200,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(top.x, top.y - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y + 30);
    ctx.stroke();

    // Battery symbol
    const batX = cx + 40;
    const batTopY = top.y - 30;
    const batBotY = bottom.y + 30;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - 30);
    ctx.lineTo(batX, batTopY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bottom.x, bottom.y + 30);
    ctx.lineTo(batX, batBotY);
    ctx.stroke();

    // Battery lines
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(batX, batTopY);
    ctx.lineTo(batX, batTopY + 15);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(batX - 8, batTopY + 18);
    ctx.lineTo(batX + 8, batTopY + 18);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${voltage}V`, batX + 8, (batTopY + batBotY) / 2);

    // Status panel
    const panelY = height * 0.78;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(15, panelY, width - 30, 80, 8);
    ctx.fill();

    ctx.fillStyle = isBalanced ? "#2ecc71" : "#e74c3c";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isBalanced ? "BRIDGE BALANCED" : "BRIDGE UNBALANCED", width / 2, panelY + 20);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`V_bridge = ${vBridge.toFixed(3)} V`, width / 2, panelY + 40);
    ctx.fillText(`Balance condition: R1×R4 = R2×R3 → ${r1}×${r4} ${isBalanced ? "=" : "≠"} ${r2}×${r3}`, width / 2, panelY + 58);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`(${r1 * r4} ${isBalanced ? "=" : "≠"} ${r2 * r3})`, width / 2, panelY + 73);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Wheatstone Bridge", width / 2, 24);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const vBridge = voltage * (r3 / (r1 + r3) - r4 / (r2 + r4));
    const isBalanced = Math.abs(vBridge) < 0.01;
    return (
      `Wheatstone Bridge: R1=${r1}Ω, R2=${r2}Ω, R3=${r3}Ω, R4=${r4}Ω, V=${voltage}V. ` +
      `Bridge voltage: ${vBridge.toFixed(3)}V. ${isBalanced ? "BALANCED" : "UNBALANCED"}. ` +
      `Balance: R1×R4 (${r1 * r4}) = R2×R3 (${r2 * r3}).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default WheatstoneBridgeFactory;
