import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EpeirogenyFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("epeirogeny") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let crustDensity = 2.7; // g/cm³
  let mantleDensity = 3.3; // g/cm³
  let columnToModify = 5; // which column to add/remove

  // 10 columns representing crust sections
  const NUM_COLUMNS = 10;
  const COLUMN_WIDTH = 55;
  const MAX_BLOCKS = 6;
  let columnBlocks: number[] = [];
  let columnY: number[] = []; // current Y positions (animated)
  let targetY: number[] = []; // target Y positions

  // Geometry
  const BASE_Y = 280; // sea level reference
  const MANTLE_TOP = 400;
  const BLOCK_HEIGHT = 25;

  function getColumnX(i: number): number {
    return 100 + i * (COLUMN_WIDTH + 8);
  }

  function computeTargetY(blocks: number): number {
    // Isostasy: heavier columns sink more
    // Equilibrium: crustDensity * h_total = mantleDensity * h_submerged
    // More blocks → more weight → sinks deeper
    const totalHeight = blocks * BLOCK_HEIGHT;
    const submersion = (crustDensity / mantleDensity) * totalHeight;
    return BASE_Y - totalHeight + submersion;
  }

  function initColumns(): void {
    columnBlocks = [];
    columnY = [];
    targetY = [];
    for (let i = 0; i < NUM_COLUMNS; i++) {
      const blocks = 2 + Math.floor(Math.random() * 3);
      columnBlocks.push(blocks);
      const ty = computeTargetY(blocks);
      targetY.push(ty);
      columnY.push(ty);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    initColumns();
  }

  function update(dt: number, params: Record<string, number>): void {
    crustDensity = params.crustDensity ?? 2.7;
    mantleDensity = params.mantleDensity ?? 3.3;
    columnToModify = Math.round(params.columnToModify ?? 5);

    // Recompute targets
    for (let i = 0; i < NUM_COLUMNS; i++) {
      targetY[i] = computeTargetY(columnBlocks[i]);
    }

    // Animate columns toward targets
    for (let i = 0; i < NUM_COLUMNS; i++) {
      const diff = targetY[i] - columnY[i];
      columnY[i] += diff * 2 * dt;
    }

    time += dt;
  }

  function drawBackground(): void {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, BASE_Y);
    skyGrad.addColorStop(0, "#1a2a4a");
    skyGrad.addColorStop(1, "#2a3a5a");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, BASE_Y);

    // Mantle
    const mantleGrad = ctx.createLinearGradient(0, MANTLE_TOP, 0, H);
    mantleGrad.addColorStop(0, "#8b3a1a");
    mantleGrad.addColorStop(0.5, "#a04420");
    mantleGrad.addColorStop(1, "#6b2a10");
    ctx.fillStyle = mantleGrad;
    ctx.fillRect(0, MANTLE_TOP, W, H - MANTLE_TOP);

    // Transition zone
    const transGrad = ctx.createLinearGradient(0, BASE_Y, 0, MANTLE_TOP);
    transGrad.addColorStop(0, "#4a3a2a");
    transGrad.addColorStop(1, "#8b3a1a");
    ctx.fillStyle = transGrad;
    ctx.fillRect(0, BASE_Y, W, MANTLE_TOP - BASE_Y);
  }

  function drawSeaLevel(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, BASE_Y);
    ctx.lineTo(W, BASE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Sea Level", 10, BASE_Y - 6);
    ctx.restore();
  }

  function drawColumns(): void {
    const blockColors = [
      "#8B7355", "#A0926B", "#6B8E23", "#8B8378", "#CD853F", "#DEB887"
    ];

    for (let i = 0; i < NUM_COLUMNS; i++) {
      const x = getColumnX(i);
      const blocks = columnBlocks[i];
      const baseYPos = columnY[i];
      const isSelected = i === Math.round(columnToModify);

      for (let b = 0; b < blocks; b++) {
        const by = baseYPos + b * BLOCK_HEIGHT;
        const colorIdx = b % blockColors.length;

        // Block
        const grad = ctx.createLinearGradient(x, by, x + COLUMN_WIDTH, by + BLOCK_HEIGHT);
        grad.addColorStop(0, blockColors[colorIdx]);
        grad.addColorStop(1, adjustColor(blockColors[colorIdx], -30));
        ctx.fillStyle = grad;
        ctx.fillRect(x, by, COLUMN_WIDTH, BLOCK_HEIGHT);

        // Texture lines
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 0.5;
        for (let line = 0; line < 3; line++) {
          const ly = by + 5 + line * 7;
          ctx.beginPath();
          ctx.moveTo(x + 2, ly);
          ctx.lineTo(x + COLUMN_WIDTH - 2, ly + (Math.random() - 0.5) * 3);
          ctx.stroke();
        }

        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, by, COLUMN_WIDTH, BLOCK_HEIGHT);
      }

      // Selection highlight
      if (isSelected) {
        ctx.strokeStyle = "rgba(255, 200, 50, 0.7)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, baseYPos - 2, COLUMN_WIDTH + 4, blocks * BLOCK_HEIGHT + 4);

        // Up/down arrows
        ctx.fillStyle = "rgba(255, 200, 50, 0.8)";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("▲", x + COLUMN_WIDTH / 2, baseYPos - 10);
        ctx.fillText("▼", x + COLUMN_WIDTH / 2, baseYPos + blocks * BLOCK_HEIGHT + 18);
      }

      // Column number
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, x + COLUMN_WIDTH / 2, baseYPos + blocks * BLOCK_HEIGHT + 32);
    }
  }

  function adjustColor(hex: string, amount: number): string {
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
    return `rgb(${r},${g},${b})`;
  }

  function drawLabels(): void {
    ctx.save();
    // Crust label
    ctx.fillStyle = "rgba(200, 180, 140, 0.6)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Crust", 80, BASE_Y - 40);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`ρ = ${crustDensity.toFixed(1)} g/cm³`, 80, BASE_Y - 26);

    // Mantle label
    ctx.fillStyle = "rgba(200, 100, 50, 0.7)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Mantle", 80, MANTLE_TOP + 30);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`ρ = ${mantleDensity.toFixed(1)} g/cm³`, 80, MANTLE_TOP + 44);

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 300;
    const ph = 110;
    const px = W - pw - 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Epeirogeny & Isostasy", px + 12, py + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Crust 'floats' on denser mantle (Archimedes)", px + 12, py + 42);
    ctx.fillText("Add material → column sinks (deposition)", px + 12, py + 58);
    ctx.fillText("Remove material → column rises (erosion)", px + 12, py + 74);
    ctx.fillText(`Selected column: ${Math.round(columnToModify) + 1} (${columnBlocks[Math.round(columnToModify)]} blocks)`, px + 12, py + 94);

    ctx.restore();
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Epeirogeny — Isostatic Adjustment of Earth's Crust", W / 2, 28);
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawSeaLevel();
    drawColumns();
    drawLabels();
    drawInfoPanel();
    drawTitle();
  }

  function reset(): void {
    time = 0;
    initColumns();
  }

  function destroy(): void {
    columnBlocks = [];
    columnY = [];
    targetY = [];
  }

  function getStateDescription(): string {
    const selected = Math.round(columnToModify);
    return (
      `Epeirogeny simulation: ${NUM_COLUMNS} crustal columns floating on mantle. ` +
      `Crust density: ${crustDensity.toFixed(1)} g/cm³, Mantle density: ${mantleDensity.toFixed(1)} g/cm³. ` +
      `Column ${selected + 1} has ${columnBlocks[selected]} blocks. ` +
      `Isostasy: thicker/heavier crust sinks deeper into the mantle. ` +
      `Adding material (deposition) causes subsidence; removing material (erosion) causes uplift.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EpeirogenyFactory;
