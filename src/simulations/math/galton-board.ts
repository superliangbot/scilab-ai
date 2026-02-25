import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  row: number;
  settled: boolean;
  bin: number;
}

const GaltonBoardFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("galton-board") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let numRows = 10;
  let dropRate = 5;
  let ballSize = 4;
  let gravity = 500;

  const balls: Ball[] = [];
  let bins: number[] = [];
  let totalBalls = 0;
  let spawnTimer = 0;

  // Peg layout
  function pegX(row: number, col: number): number {
    const boardLeft = W * 0.2;
    const boardRight = W * 0.8;
    const boardW = boardRight - boardLeft;
    const spacing = boardW / (numRows + 1);
    const rowOffset = (numRows - row) * spacing * 0.5;
    return boardLeft + rowOffset + col * spacing;
  }

  function pegY(row: number): number {
    const topY = H * 0.08;
    const bottomY = H * 0.6;
    return topY + (row / numRows) * (bottomY - topY);
  }

  function pegRadius(): number {
    return Math.max(2, Math.min(W, H) * 0.005);
  }

  function initBins(): void {
    bins = new Array(numRows + 1).fill(0);
  }

  function reset(): void {
    time = 0;
    balls.length = 0;
    totalBalls = 0;
    spawnTimer = 0;
    initBins();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function spawnBall(): void {
    const startX = W * 0.5 + (Math.random() - 0.5) * 4;
    balls.push({
      x: startX,
      y: H * 0.04,
      vx: 0,
      vy: 0,
      row: -1,
      settled: false,
      bin: -1,
    });
  }

  function update(dt: number, params: Record<string, number>): void {
    const newRows = Math.round(params.numRows ?? 10);
    const newRate = params.dropRate ?? 5;
    const newBallSize = params.ballSize ?? 4;
    const newGrav = params.gravity ?? 500;

    if (newRows !== numRows) {
      numRows = newRows;
      reset();
    }
    dropRate = newRate;
    ballSize = newBallSize;
    gravity = newGrav;

    time += dt;

    // Spawn balls
    spawnTimer += dt;
    const spawnInterval = 1 / dropRate;
    while (spawnTimer >= spawnInterval && balls.length < 500) {
      spawnBall();
      spawnTimer -= spawnInterval;
      totalBalls++;
    }

    const pr = pegRadius();
    const br = ballSize;

    // Update balls
    for (const ball of balls) {
      if (ball.settled) continue;

      ball.vy += gravity * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Check collision with pegs
      for (let row = 0; row <= numRows; row++) {
        const py = pegY(row);
        for (let col = 0; col <= row; col++) {
          const px = pegX(row, col);
          const dx = ball.x - px;
          const dy = ball.y - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = pr + br;

          if (dist < minDist && dist > 0) {
            // Bounce off peg
            const nx = dx / dist;
            const ny = dy / dist;
            const relV = ball.vx * nx + ball.vy * ny;
            if (relV < 0) {
              ball.vx -= 1.8 * relV * nx;
              ball.vy -= 1.8 * relV * ny;
              // Add randomness (key to the distribution)
              ball.vx += (Math.random() - 0.5) * 60;
              // Push out of peg
              ball.x = px + nx * minDist;
              ball.y = py + ny * minDist;
            }
          }
        }
      }

      // Check if ball reached bin area
      const binY = H * 0.62;
      if (ball.y >= binY) {
        const boardLeft = W * 0.2;
        const boardRight = W * 0.8;
        const binWidth = (boardRight - boardLeft) / (numRows + 1);
        let binIdx = Math.floor((ball.x - boardLeft) / binWidth);
        binIdx = Math.max(0, Math.min(numRows, binIdx));
        ball.bin = binIdx;
        ball.settled = true;
        bins[binIdx]++;
      }

      // Remove if off screen
      if (ball.x < 0 || ball.x > W) {
        ball.settled = true;
        ball.bin = -1;
      }
    }

    // Remove old settled balls to prevent memory growth
    if (balls.length > 400) {
      const toRemove = balls.filter((b) => b.settled).slice(0, 100);
      for (const b of toRemove) {
        const idx = balls.indexOf(b);
        if (idx >= 0) balls.splice(idx, 1);
      }
    }
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(1, "#16213e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPegs(): void {
    const pr = pegRadius();
    for (let row = 0; row <= numRows; row++) {
      for (let col = 0; col <= row; col++) {
        const px = pegX(row, col);
        const py = pegY(row);
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fillStyle = "#78909c";
        ctx.fill();
        ctx.strokeStyle = "#b0bec5";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  function drawBalls(): void {
    for (const ball of balls) {
      if (ball.settled) continue;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ballSize, 0, Math.PI * 2);
      ctx.fillStyle = "#42a5f5";
      ctx.fill();
    }
  }

  function drawBins(): void {
    const boardLeft = W * 0.2;
    const boardRight = W * 0.8;
    const binWidth = (boardRight - boardLeft) / (numRows + 1);
    const binBaseY = H * 0.95;
    const binTopY = H * 0.62;
    const maxBin = Math.max(...bins, 1);

    // Bin walls
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= numRows + 1; i++) {
      const x = boardLeft + i * binWidth;
      ctx.beginPath();
      ctx.moveTo(x, binTopY);
      ctx.lineTo(x, binBaseY);
      ctx.stroke();
    }

    // Filled bars
    for (let i = 0; i <= numRows; i++) {
      const count = bins[i];
      if (count === 0) continue;
      const barHeight = (count / maxBin) * (binBaseY - binTopY - 10);
      const x = boardLeft + i * binWidth + 1;
      const y = binBaseY - barHeight;

      const hue = 200 + (i / numRows) * 40;
      ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.8)`;
      ctx.fillRect(x, y, binWidth - 2, barHeight);

      // Count label
      if (binWidth > 15) {
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.min(11, binWidth * 0.5)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`${count}`, x + (binWidth - 2) / 2, y - 2);
      }
    }

    // Base line
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boardLeft, binBaseY);
    ctx.lineTo(boardRight, binBaseY);
    ctx.stroke();
  }

  function drawNormalCurve(): void {
    const boardLeft = W * 0.2;
    const boardRight = W * 0.8;
    const binWidth = (boardRight - boardLeft) / (numRows + 1);
    const binBaseY = H * 0.95;
    const binTopY = H * 0.62;
    const maxBin = Math.max(...bins, 1);

    if (totalBalls < 10) return;

    // Expected normal distribution: mean = n/2, variance = n/4
    const n = numRows;
    const mean = n / 2;
    const stddev = Math.sqrt(n / 4);

    ctx.strokeStyle = "rgba(255, 152, 0, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();

    for (let i = 0; i <= numRows; i++) {
      const z = (i - mean) / stddev;
      const expected = totalBalls * (1 / (stddev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
      const barHeight = (expected / maxBin) * (binBaseY - binTopY - 10);
      const x = boardLeft + (i + 0.5) * binWidth;
      const y = binBaseY - barHeight;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawInfo(): void {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 200, 80, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Galton Board", 20, 18);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#ccc";
    ctx.fillText(`Rows: ${numRows}  |  Balls: ${totalBalls}`, 20, 38);
    ctx.fillText(`Mean: ${(numRows / 2).toFixed(1)}  σ: ${Math.sqrt(numRows / 4).toFixed(2)}`, 20, 54);
    ctx.fillStyle = "#ffa726";
    ctx.font = "10px sans-serif";
    ctx.fillText("--- Normal distribution fit", 20, 72);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Each ball has 50% chance to go left or right at each peg → Binomial → Normal distribution", W / 2, H - 4);
  }

  function render(): void {
    drawBackground();
    drawPegs();
    drawBalls();
    drawBins();
    drawNormalCurve();
    drawInfo();
    drawTitle();
  }

  function destroy(): void {
    balls.length = 0;
    bins = [];
  }

  function getStateDescription(): string {
    const maxBinIdx = bins.indexOf(Math.max(...bins));
    return (
      `Galton Board: ${numRows} rows of pegs, ${totalBalls} balls dropped. ` +
      `Drop rate: ${dropRate}/s. ` +
      `Bin counts: [${bins.join(", ")}]. ` +
      `Most filled bin: #${maxBinIdx} with ${bins[maxBinIdx] || 0} balls. ` +
      `Expected mean=${(numRows / 2).toFixed(1)}, std dev=${Math.sqrt(numRows / 4).toFixed(2)}. ` +
      `Demonstrates that binomial distribution approaches normal distribution (Central Limit Theorem).`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GaltonBoardFactory;
