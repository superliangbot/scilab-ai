import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SpringFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spring") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let springConstant = 10; // N/m
  let mass = 1; // kg
  let initialDisplacement = 0.3; // m
  let damping = 0; // damping coefficient

  // State
  let x = 0; // displacement from equilibrium (m)
  let v = 0; // velocity (m/s)
  let posHistory: number[] = [];
  let velHistory: number[] = [];
  let accelHistory: number[] = [];
  const maxHistory = 300;

  function omega(): number {
    return Math.sqrt(springConstant / mass);
  }

  function period(): number {
    return (2 * Math.PI) / omega();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    x = initialDisplacement;
    v = 0;
    posHistory = [];
    velHistory = [];
    accelHistory = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    springConstant = params.springConstant ?? 10;
    mass = params.mass ?? 1;
    initialDisplacement = params.initialDisplacement ?? 0.3;
    damping = params.damping ?? 0;

    // Verlet-style integration for spring: a = -(k/m)*x - (damping/m)*v
    const steps = 10;
    const subDt = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -(springConstant / mass) * x - (damping / mass) * v;
      v += a * subDt;
      x += v * subDt;
    }

    // Record history
    const a = -(springConstant / mass) * x - (damping / mass) * v;
    posHistory.push(x);
    velHistory.push(v);
    accelHistory.push(a);
    if (posHistory.length > maxHistory) {
      posHistory.shift();
      velHistory.shift();
      accelHistory.shift();
    }

    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#080818");
    grad.addColorStop(0.5, "#0c0c24");
    grad.addColorStop(1, "#10102e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawWall(): void {
    const wallX = width * 0.08;
    const wallTop = height * 0.15;
    const wallBottom = height * 0.45;

    // Hatching pattern for wall
    ctx.fillStyle = "#333";
    ctx.fillRect(wallX - 10, wallTop, 10, wallBottom - wallTop);

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    for (let y = wallTop; y < wallBottom; y += 8) {
      ctx.beginPath();
      ctx.moveTo(wallX - 10, y);
      ctx.lineTo(wallX, y + 8);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX, wallTop);
    ctx.lineTo(wallX, wallBottom);
    ctx.stroke();
  }

  function drawSpringCoils(startX: number, endX: number, cy: number, amplitude: number): void {
    const coils = 12;
    const dx = endX - startX;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, cy);

    const segments = coils * 10;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = startX + t * dx;
      const py = cy + Math.sin(t * coils * Math.PI * 2) * amplitude;
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Subtle metallic highlight
    ctx.strokeStyle = "rgba(200,220,255,0.15)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, cy);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = startX + t * dx;
      const py = cy + Math.sin(t * coils * Math.PI * 2) * amplitude - 1;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawMassBlock(): void {
    const wallX = width * 0.08;
    const cy = height * 0.3;
    const eqX = width * 0.45; // equilibrium position on screen
    const scale = width * 0.5; // pixels per meter
    const blockX = eqX + x * scale;
    const blockSize = 30 + mass * 8;
    const halfBlock = blockSize / 2;

    // Draw spring coils from wall to block
    drawSpringCoils(wallX, blockX - halfBlock, cy, 15);

    // Mass block
    const blockGrad = ctx.createLinearGradient(
      blockX - halfBlock, cy - halfBlock,
      blockX + halfBlock, cy + halfBlock
    );
    blockGrad.addColorStop(0, "#3b82f6");
    blockGrad.addColorStop(0.5, "#2563eb");
    blockGrad.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = blockGrad;
    ctx.beginPath();
    ctx.roundRect(blockX - halfBlock, cy - halfBlock, blockSize, blockSize, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mass label
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${mass.toFixed(1)} kg`, blockX, cy + 3);

    // Equilibrium line (dashed)
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eqX, cy - 50);
    ctx.lineTo(eqX, cy + 50);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("x=0", eqX, cy + 62);

    // Force vector (F = -kx)
    const force = -springConstant * x;
    const forcePixels = force * scale * 0.1;
    if (Math.abs(forcePixels) > 3) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(blockX, cy);
      ctx.lineTo(blockX + forcePixels, cy);
      ctx.stroke();

      // Arrowhead
      const dir = forcePixels > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(blockX + forcePixels, cy);
      ctx.lineTo(blockX + forcePixels - dir * 8, cy - 5);
      ctx.moveTo(blockX + forcePixels, cy);
      ctx.lineTo(blockX + forcePixels - dir * 8, cy + 5);
      ctx.stroke();

      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`F = ${force.toFixed(2)} N`, blockX + forcePixels / 2, cy - 12);
    }

    // Surface/floor line
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wallX - 10, cy + halfBlock + 2);
    ctx.lineTo(width * 0.9, cy + halfBlock + 2);
    ctx.stroke();
  }

  function drawEnergyBar(): void {
    const barX = width * 0.06;
    const barY = height * 0.50;
    const barW = width * 0.35;
    const barH = 20;

    const ke = 0.5 * mass * v * v;
    const pe = 0.5 * springConstant * x * x;
    const total = ke + pe;

    if (total < 1e-10) return;

    const keFrac = ke / total;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // KE bar
    ctx.fillStyle = "#ef4444";
    if (keFrac > 0.01) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * keFrac, barH, keFrac > 0.98 ? 4 : [4, 0, 0, 4]);
      ctx.fill();
    }

    // PE bar
    ctx.fillStyle = "#3b82f6";
    if (keFrac < 0.99) {
      ctx.beginPath();
      ctx.roundRect(barX + barW * keFrac, barY, barW * (1 - keFrac), barH,
        keFrac < 0.02 ? 4 : [0, 4, 4, 0]);
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`KE: ${ke.toFixed(3)} J`, barX, barY - 4);
    ctx.textAlign = "right";
    ctx.fillText(`PE: ${pe.toFixed(3)} J`, barX + barW, barY - 4);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`Total: ${total.toFixed(3)} J ${damping > 0 ? "(dissipating)" : ""}`, barX + barW / 2, barY + barH + 14);
  }

  function drawGraphs(): void {
    const graphX = width * 0.50;
    const graphW = width * 0.44;
    const graphTop = height * 0.52;
    const graphH = (height * 0.42) / 3;
    const gap = 6;

    const graphs = [
      { data: posHistory, label: "Displacement (m)", color: "#22c55e", scale: initialDisplacement * 1.2 },
      { data: velHistory, label: "Velocity (m/s)", color: "#f59e0b", scale: initialDisplacement * omega() * 1.2 },
      { data: accelHistory, label: "Acceleration (m/s\u00B2)", color: "#ef4444", scale: initialDisplacement * omega() * omega() * 1.2 },
    ];

    graphs.forEach((g, idx) => {
      const gy = graphTop + idx * (graphH + gap);

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.roundRect(graphX, gy, graphW, graphH, 4);
      ctx.fill();

      // Zero line
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(graphX, gy + graphH / 2);
      ctx.lineTo(graphX + graphW, gy + graphH / 2);
      ctx.stroke();

      // Data line
      if (g.data.length > 1 && g.scale > 0) {
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < g.data.length; i++) {
          const px = graphX + (i / maxHistory) * graphW;
          const val = g.data[i] / g.scale;
          const py = gy + graphH / 2 - val * (graphH * 0.4);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = g.color;
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(g.label, graphX + 4, gy + 12);
    });
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(270, width * 0.36);
    const panelH = 108;
    const panelX = 10;
    const panelY = height * 0.50;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Hooke's Law: F = -kx", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`k = ${springConstant.toFixed(1)} N/m`, panelX + 10, panelY + 36);
    ctx.fillText(`m = ${mass.toFixed(1)} kg`, panelX + 10, panelY + 52);
    ctx.fillText(`\u03C9 = \u221A(k/m) = ${omega().toFixed(2)} rad/s`, panelX + 10, panelY + 68);
    ctx.fillText(`T = 2\u03C0/\u03C9 = ${period().toFixed(3)} s`, panelX + 10, panelY + 84);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`x = ${x.toFixed(4)} m, v = ${v.toFixed(4)} m/s`, panelX + 10, panelY + 100);
  }

  function render(): void {
    drawBackground();
    drawWall();
    drawMassBlock();
    drawEnergyBar();
    drawGraphs();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    x = initialDisplacement;
    v = 0;
    posHistory = [];
    velHistory = [];
    accelHistory = [];
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const ke = 0.5 * mass * v * v;
    const pe = 0.5 * springConstant * x * x;
    return (
      `Spring Simulation (Hooke's Law): k=${springConstant} N/m, m=${mass} kg, damping=${damping}. ` +
      `\u03C9=\u221A(k/m)=${omega().toFixed(2)} rad/s, T=${period().toFixed(3)} s. ` +
      `Current: x=${x.toFixed(4)} m, v=${v.toFixed(4)} m/s. ` +
      `KE=${ke.toFixed(4)} J, PE=${pe.toFixed(4)} J, Total=${(ke + pe).toFixed(4)} J. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpringFactory;
