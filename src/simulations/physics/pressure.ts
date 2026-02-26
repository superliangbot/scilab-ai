import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PressureFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pressure") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let force = 10; // Newtons
  let area = 0.01; // m²
  let showMode = 0; // 0=sponge, 1=spring

  // Animation state
  let deformation = 0;
  let targetDeformation = 0;

  // Springs for spring mode
  let springs: Array<{ x: number; compression: number }> = [];

  function calcPressure(): number {
    return force / area;
  }

  function calcDeformation(): number {
    // Deformation proportional to pressure (visual scaling)
    const pressure = calcPressure();
    return Math.min(60, pressure * 0.02);
  }

  function initSprings() {
    springs = [];
    const numSprings = Math.floor(area * 500) + 3;
    const surfaceX = width * 0.25;
    const surfaceW = width * 0.5;
    for (let i = 0; i < numSprings; i++) {
      springs.push({
        x: surfaceX + (i + 0.5) * (surfaceW / numSprings),
        compression: 0,
      });
    }
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    deformation = 0;
    initSprings();
  }

  function update(dt: number, params: Record<string, number>) {
    force = params.force ?? 10;
    area = Math.max(0.0001, params.area ?? 0.01);
    showMode = params.showMode ?? 0;

    targetDeformation = calcDeformation();
    // Smooth animation
    deformation += (targetDeformation - deformation) * 3 * dt;

    // Update springs
    const numSprings = Math.floor(area * 500) + 3;
    if (springs.length !== numSprings) initSprings();
    for (const s of springs) {
      s.compression += (deformation - s.compression) * 4 * dt;
    }

    time += dt;
  }

  function drawBlock(bx: number, by: number, bw: number, bh: number) {
    // Block with force arrow
    const blockGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    blockGrad.addColorStop(0, "#7088a8");
    blockGrad.addColorStop(1, "#506878");
    ctx.fillStyle = blockGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(100,130,160,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mass label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${(force / 9.81).toFixed(1)} kg`, bx + bw / 2, by + bh / 2 + 5);

    // Force arrow (downward)
    const arrowX = bx + bw / 2;
    const arrowTop = by - 50;
    ctx.strokeStyle = "rgba(255,80,80,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowTop);
    ctx.lineTo(arrowX, by - 5);
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(arrowX - 6, by - 15);
    ctx.lineTo(arrowX, by - 5);
    ctx.lineTo(arrowX + 6, by - 15);
    ctx.fillStyle = "rgba(255,80,80,0.8)";
    ctx.fill();

    ctx.fillStyle = "rgba(255,100,100,0.8)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.fillText(`F = ${force.toFixed(1)} N`, arrowX, arrowTop - 8);
  }

  function drawSponge(surfaceY: number) {
    const surfaceX = width * 0.2;
    const surfaceW = width * 0.6;
    const surfaceH = height * 0.15;

    // Sponge body
    const spongeGrad = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + surfaceH);
    spongeGrad.addColorStop(0, "#e0c060");
    spongeGrad.addColorStop(1, "#c0a040");
    ctx.fillStyle = spongeGrad;
    ctx.beginPath();
    ctx.roundRect(surfaceX, surfaceY, surfaceW, surfaceH, 6);
    ctx.fill();

    // Indentation where block presses
    const blockW = width * (0.1 + area * 8);
    const indentX = width * 0.5 - blockW / 2;
    const indentDepth = deformation;

    if (indentDepth > 0.5) {
      ctx.fillStyle = "#b89030";
      ctx.beginPath();
      ctx.moveTo(indentX, surfaceY);
      ctx.quadraticCurveTo(indentX + blockW * 0.1, surfaceY + indentDepth, indentX + blockW * 0.5, surfaceY + indentDepth);
      ctx.quadraticCurveTo(indentX + blockW * 0.9, surfaceY + indentDepth, indentX + blockW, surfaceY);
      ctx.lineTo(indentX + blockW, surfaceY + surfaceH);
      ctx.lineTo(indentX, surfaceY + surfaceH);
      ctx.closePath();
      ctx.fill();

      // Indentation depth marker
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(indentX + blockW + 20, surfaceY);
      ctx.lineTo(indentX + blockW + 20, surfaceY + indentDepth);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`${indentDepth.toFixed(1)} mm`, indentX + blockW + 25, surfaceY + indentDepth / 2 + 4);
    }

    // Sponge pores
    for (let i = 0; i < 15; i++) {
      const px = surfaceX + 20 + Math.random() * (surfaceW - 40);
      const py = surfaceY + 10 + Math.random() * (surfaceH - 20);
      ctx.beginPath();
      ctx.arc(px, py, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(160,120,40,0.3)";
      ctx.fill();
    }
  }

  function drawSprings(surfaceY: number) {
    const baseY = surfaceY + height * 0.12;

    // Platform
    ctx.fillStyle = "rgba(100,100,120,0.6)";
    ctx.fillRect(width * 0.18, surfaceY - 3, width * 0.64, 6);

    // Base
    ctx.fillStyle = "rgba(80,80,100,0.4)";
    ctx.fillRect(width * 0.18, baseY, width * 0.64, 6);

    // Springs
    for (const s of springs) {
      const springHeight = baseY - surfaceY - s.compression;
      const coils = 8;
      const coilH = springHeight / coils;

      ctx.strokeStyle = "rgba(150,180,220,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, surfaceY + 3);
      for (let c = 0; c < coils; c++) {
        const y1 = surfaceY + 3 + c * coilH;
        const y2 = y1 + coilH;
        ctx.bezierCurveTo(s.x + 8, y1 + coilH * 0.25, s.x - 8, y1 + coilH * 0.75, s.x, y2);
      }
      ctx.stroke();
    }

    // Compression depth
    if (deformation > 0.5) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Compression: ${deformation.toFixed(1)} mm`, width / 2, baseY + 22);
    }
  }

  function render() {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#e8e0d0");
    bg.addColorStop(1, "#d0c8b8");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const surfaceY = height * 0.55;
    const blockW = width * (0.1 + area * 8);
    const blockH = height * 0.08;
    const blockX = width * 0.5 - blockW / 2;
    const blockY = surfaceY - blockH - deformation;

    // Surface
    if (showMode < 0.5) {
      drawSponge(surfaceY);
    } else {
      drawSprings(surfaceY);
    }

    // Block
    drawBlock(blockX, blockY, blockW, blockH);

    // Area indicator
    ctx.strokeStyle = "rgba(50,150,255,0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(blockX, blockY + blockH + 2);
    ctx.lineTo(blockX, blockY + blockH + 15);
    ctx.moveTo(blockX + blockW, blockY + blockH + 2);
    ctx.lineTo(blockX + blockW, blockY + blockH + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(blockX, blockY + blockH + 10);
    ctx.lineTo(blockX + blockW, blockY + blockH + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(50,150,255,0.7)";
    ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`A = ${(area * 10000).toFixed(0)} cm²`, width / 2, blockY + blockH + 25);

    // Info panel
    const pressure = calcPressure();
    const panelY = height * 0.82;
    ctx.fillStyle = "rgba(30,30,50,0.85)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, panelY, width * 0.9, height * 0.15, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `bold ${Math.max(14, height * 0.026)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Pressure = Force ÷ Area = ${force.toFixed(1)} ÷ ${area.toFixed(4)} = ${pressure.toFixed(0)} Pa`, width / 2, panelY + 25);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
    ctx.fillText(`P = F/A | Same force over smaller area → higher pressure → more deformation`, width / 2, panelY + 48);

    // Title
    ctx.fillStyle = "rgba(50,50,70,0.7)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Pressure = Force / Area", width / 2, 25);
  }

  function reset() {
    time = 0;
    deformation = 0;
    initSprings();
  }

  function destroy() { springs = []; }

  function getStateDescription(): string {
    const pressure = calcPressure();
    return `Pressure | F=${force.toFixed(1)}N | A=${(area * 10000).toFixed(0)}cm² | P=${pressure.toFixed(0)}Pa | Deformation: ${deformation.toFixed(1)}mm | Mode: ${showMode < 0.5 ? "Sponge" : "Spring"}`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    initSprings();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PressureFactory;
