import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NormalDistributionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("normal-distribution") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let mean = 50;
  let stdDev = 10;
  let sampleSize = 200;
  let showProbability = 1;

  // Galton board simulation
  interface Ball {
    x: number;
    y: number;
    vy: number;
    vx: number;
    settled: boolean;
    bin: number;
  }
  let balls: Ball[] = [];
  let bins: number[] = [];
  const NUM_BINS = 30;
  const PEG_ROWS = 12;

  // Layout
  const BOARD_TOP = 80;
  const BOARD_BOTTOM_RATIO = 0.55;
  const GRAPH_TOP_RATIO = 0.6;
  const GRAPH_BOTTOM_RATIO = 0.92;

  function normalPDF(x: number, mu: number, sigma: number): number {
    const s = Math.max(sigma, 0.01);
    const z = (x - mu) / s;
    return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
  }

  function initBins(): void {
    bins = new Array(NUM_BINS).fill(0);
  }

  function spawnBall(): void {
    if (balls.length >= sampleSize) return;
    balls.push({
      x: width / 2 + (Math.random() - 0.5) * 10,
      y: BOARD_TOP - 10,
      vy: 0,
      vx: 0,
      settled: false,
      bin: -1,
    });
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    balls = [];
    initBins();
  }

  function update(dt: number, params: Record<string, number>): void {
    mean = params.mean ?? 50;
    stdDev = params.stdDev ?? 10;
    sampleSize = Math.round(params.sampleSize ?? 200);
    showProbability = params.showProbability ?? 1;

    time += dt;

    // Spawn balls periodically
    if (balls.filter(b => !b.settled).length < 10 && balls.length < sampleSize) {
      if (Math.random() < 5 * dt) spawnBall();
    }

    const boardBottom = height * BOARD_BOTTOM_RATIO;
    const gravity = 400;
    const binWidth = (width - 100) / NUM_BINS;

    for (const ball of balls) {
      if (ball.settled) continue;

      ball.vy += gravity * dt;
      ball.y += ball.vy * dt;
      ball.x += ball.vx * dt;

      // Peg collisions
      const pegSpacingY = (boardBottom - BOARD_TOP - 40) / PEG_ROWS;
      const pegRadius = 4;
      const ballRadius = 3;

      for (let row = 0; row < PEG_ROWS; row++) {
        const pegY = BOARD_TOP + 30 + row * pegSpacingY;
        const numPegs = row + 3;
        const pegSpacingX = (width - 200) / (numPegs + 1);
        const startX = 100 + pegSpacingX;

        for (let col = 0; col < numPegs; col++) {
          const pegX = startX + col * pegSpacingX;
          const dx = ball.x - pegX;
          const dy = ball.y - pegY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < pegRadius + ballRadius) {
            // Bounce off peg
            const nx = dx / dist;
            const ny = dy / dist;
            ball.x = pegX + nx * (pegRadius + ballRadius + 1);
            ball.y = pegY + ny * (pegRadius + ballRadius + 1);

            const dotProduct = ball.vx * nx + ball.vy * ny;
            ball.vx -= 1.5 * dotProduct * nx;
            ball.vy -= 1.5 * dotProduct * ny;

            // Random deflection
            ball.vx += (Math.random() - 0.5) * 80;
            ball.vy *= 0.5;
          }
        }
      }

      // Wall boundaries
      if (ball.x < 55) { ball.x = 55; ball.vx = Math.abs(ball.vx) * 0.5; }
      if (ball.x > width - 55) { ball.x = width - 55; ball.vx = -Math.abs(ball.vx) * 0.5; }

      // Settle into bins
      if (ball.y >= boardBottom - 5) {
        ball.settled = true;
        ball.y = boardBottom - 5;
        const binIndex = Math.floor((ball.x - 50) / binWidth);
        ball.bin = Math.max(0, Math.min(NUM_BINS - 1, binIndex));
        bins[ball.bin]++;
      }
    }
  }

  function drawPegs(): void {
    const boardBottom = height * BOARD_BOTTOM_RATIO;
    const pegSpacingY = (boardBottom - BOARD_TOP - 40) / PEG_ROWS;

    for (let row = 0; row < PEG_ROWS; row++) {
      const pegY = BOARD_TOP + 30 + row * pegSpacingY;
      const numPegs = row + 3;
      const pegSpacingX = (width - 200) / (numPegs + 1);
      const startX = 100 + pegSpacingX;

      for (let col = 0; col < numPegs; col++) {
        const pegX = startX + col * pegSpacingX;
        ctx.beginPath();
        ctx.arc(pegX, pegY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#64748b";
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  function drawBalls(): void {
    for (const ball of balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = ball.settled ? "#3b82f6" : "#fbbf24";
      ctx.fill();
    }
  }

  function drawHistogram(): void {
    const graphTop = height * GRAPH_TOP_RATIO;
    const graphBottom = height * GRAPH_BOTTOM_RATIO;
    const graphH = graphBottom - graphTop;
    const binWidth = (width - 100) / NUM_BINS;
    const maxCount = Math.max(1, ...bins);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(45, graphTop - 5, width - 90, graphH + 10);

    // Bins
    for (let i = 0; i < NUM_BINS; i++) {
      const binX = 50 + i * binWidth;
      const binH = (bins[i] / maxCount) * graphH * 0.85;

      if (bins[i] > 0) {
        const grad = ctx.createLinearGradient(0, graphBottom - binH, 0, graphBottom);
        grad.addColorStop(0, "#3b82f6");
        grad.addColorStop(1, "#1d4ed8");
        ctx.fillStyle = grad;
        ctx.fillRect(binX + 1, graphBottom - binH, binWidth - 2, binH);

        ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(binX + 1, graphBottom - binH, binWidth - 2, binH);
      }
    }

    // Normal curve overlay
    if (showProbability >= 1 && balls.filter(b => b.settled).length > 10) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Compute histogram mean and std
      let sumX = 0;
      let sumX2 = 0;
      let n = 0;
      for (let i = 0; i < NUM_BINS; i++) {
        sumX += bins[i] * (i + 0.5);
        sumX2 += bins[i] * (i + 0.5) * (i + 0.5);
        n += bins[i];
      }
      const histMean = n > 0 ? sumX / n : NUM_BINS / 2;
      const histVar = n > 0 ? sumX2 / n - histMean * histMean : 1;
      const histStd = Math.sqrt(Math.max(histVar, 0.1));

      let first = true;
      for (let i = 0; i < NUM_BINS; i++) {
        const x = i + 0.5;
        const pdf = normalPDF(x, histMean, histStd);
        const y = pdf * n * graphH * 0.85 / maxCount;
        const px = 50 + (i + 0.5) * binWidth;
        const py = graphBottom - y;
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Legend
      ctx.fillStyle = "#ef4444";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Normal fit", width - 60, graphTop + 15);
    }

    // X-axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < NUM_BINS; i += 5) {
      ctx.fillText(i.toString(), 50 + (i + 0.5) * binWidth, graphBottom + 12);
    }
  }

  function drawStatistics(): void {
    const settled = balls.filter(b => b.settled);
    if (settled.length === 0) return;

    // Calculate stats from bin data
    let sumX = 0;
    let sumX2 = 0;
    let n = 0;
    for (let i = 0; i < NUM_BINS; i++) {
      sumX += bins[i] * (i + 0.5);
      sumX2 += bins[i] * (i + 0.5) * (i + 0.5);
      n += bins[i];
    }
    const histMean = n > 0 ? sumX / n : 0;
    const histVar = n > 0 ? sumX2 / n - histMean * histMean : 0;
    const histStd = Math.sqrt(Math.max(histVar, 0));

    const panelX = width - 220;
    const panelY = 50;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 205, 140, 6);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Statistics", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 36;
    const lineH = 16;

    ctx.fillText(`Samples: ${n} / ${sampleSize}`, panelX + 10, y); y += lineH;
    ctx.fillText(`Mean (μ): ${histMean.toFixed(2)}`, panelX + 10, y); y += lineH;
    ctx.fillText(`Std Dev (σ): ${histStd.toFixed(2)}`, panelX + 10, y); y += lineH;
    ctx.fillText(`Variance (σ²): ${histVar.toFixed(2)}`, panelX + 10, y); y += lineH;

    // 68-95-99.7 rule
    y += 5;
    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("68-95-99.7 Rule:", panelX + 10, y); y += 13;
    ctx.fillText("68% within ±1σ, 95% within ±2σ", panelX + 10, y);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Normal Distribution — Galton Board", width / 2, 28);

    // Funnel at top
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 40, BOARD_TOP - 15);
    ctx.lineTo(width / 2 - 8, BOARD_TOP + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2 + 40, BOARD_TOP - 15);
    ctx.lineTo(width / 2 + 8, BOARD_TOP + 10);
    ctx.stroke();

    // Board boundaries
    ctx.strokeStyle = "rgba(71, 85, 105, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, BOARD_TOP);
    ctx.lineTo(50, height * BOARD_BOTTOM_RATIO);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width - 50, BOARD_TOP);
    ctx.lineTo(width - 50, height * BOARD_BOTTOM_RATIO);
    ctx.stroke();

    drawPegs();
    drawBalls();
    drawHistogram();
    drawStatistics();

    // Formula
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("f(x) = (1/σ√2π) · e^(-(x-μ)²/2σ²)", width / 2, height * 0.96);
  }

  function reset(): void {
    time = 0;
    balls = [];
    initBins();
  }

  function destroy(): void {
    balls = [];
    bins = [];
  }

  function getStateDescription(): string {
    const n = balls.filter(b => b.settled).length;
    let sumX = 0, sumX2 = 0, total = 0;
    for (let i = 0; i < NUM_BINS; i++) {
      sumX += bins[i] * (i + 0.5);
      sumX2 += bins[i] * (i + 0.5) * (i + 0.5);
      total += bins[i];
    }
    const histMean = total > 0 ? sumX / total : 0;
    const histVar = total > 0 ? sumX2 / total - histMean * histMean : 0;
    return (
      `Normal Distribution (Galton Board): ${n}/${sampleSize} balls settled. ` +
      `Observed mean=${histMean.toFixed(2)}, variance=${histVar.toFixed(2)}, std=${Math.sqrt(Math.max(histVar, 0)).toFixed(2)}. ` +
      `Demonstrates the Central Limit Theorem: many independent random deflections ` +
      `produce a normal (Gaussian) distribution. f(x) = (1/σ√2π)·e^(-(x-μ)²/2σ²).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NormalDistributionFactory;
