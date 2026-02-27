import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Bead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  settled: boolean;
  bin: number;
}

const GaltonBoardFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("galton-board") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let numRows = 10;
  let beadRate = 5;
  let restitution = 0.5;
  let showCurve = 1;

  let beads: Bead[] = [];
  let bins: number[] = [];
  let pegs: { x: number; y: number }[] = [];
  let pegSpacing = 0;
  let boardTop = 0;
  let boardBot = 0;
  let binWidth = 0;
  let totalDropped = 0;
  let lastDropTime = 0;

  function initState() {
    time = 0;
    beads = [];
    totalDropped = 0;
    lastDropTime = 0;
    computeLayout();
  }

  function computeLayout() {
    const numBins = numRows + 1;
    bins = new Array(numBins).fill(0);
    pegs = [];

    boardTop = 80;
    boardBot = height * 0.6;
    pegSpacing = Math.min((width - 60) / (numRows + 2), (boardBot - boardTop) / (numRows + 1));
    binWidth = pegSpacing;

    const centerX = width / 2;

    for (let row = 0; row < numRows; row++) {
      const y = boardTop + (row + 1) * pegSpacing;
      const pegsInRow = row + 1;
      const rowWidth = pegsInRow * pegSpacing;
      const startX = centerX - rowWidth / 2;
      for (let col = 0; col <= row; col++) {
        pegs.push({
          x: startX + col * pegSpacing + pegSpacing / 2,
          y,
        });
      }
    }
  }

  function spawnBead() {
    beads.push({
      x: width / 2 + (Math.random() - 0.5) * 4,
      y: boardTop - 10,
      vx: 0,
      vy: 0,
      settled: false,
      bin: -1,
    });
    totalDropped++;
  }

  function updateBeads(dt: number) {
    const gravity = 500;
    const pegRadius = pegSpacing * 0.12;
    const beadRadius = pegSpacing * 0.08;
    const collisionDist = pegRadius + beadRadius;

    for (const bead of beads) {
      if (bead.settled) continue;

      bead.vy += gravity * dt;
      bead.x += bead.vx * dt;
      bead.y += bead.vy * dt;

      // Peg collisions
      for (const peg of pegs) {
        const dx = bead.x - peg.x;
        const dy = bead.y - peg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < collisionDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const relVel = bead.vx * nx + bead.vy * ny;
          if (relVel < 0) {
            bead.vx -= (1 + restitution) * relVel * nx;
            bead.vy -= (1 + restitution) * relVel * ny;
            // Add slight random push
            bead.vx += (Math.random() - 0.5) * 30;
          }
          bead.x = peg.x + nx * (collisionDist + 1);
          bead.y = peg.y + ny * (collisionDist + 1);
        }
      }

      // Wall collisions
      const wallLeft = width / 2 - (numRows + 1) * pegSpacing / 2;
      const wallRight = width / 2 + (numRows + 1) * pegSpacing / 2;
      if (bead.x < wallLeft + beadRadius) {
        bead.x = wallLeft + beadRadius;
        bead.vx = Math.abs(bead.vx) * restitution;
      }
      if (bead.x > wallRight - beadRadius) {
        bead.x = wallRight - beadRadius;
        bead.vx = -Math.abs(bead.vx) * restitution;
      }

      // Settling in bins
      if (bead.y > boardBot) {
        const numBins = numRows + 1;
        const binsWidth = numBins * binWidth;
        const binsLeft = width / 2 - binsWidth / 2;
        const binIdx = Math.floor((bead.x - binsLeft) / binWidth);
        const clamped = Math.max(0, Math.min(numBins - 1, binIdx));

        bead.bin = clamped;
        bead.settled = true;
        bins[clamped]++;

        const binCenterX = binsLeft + clamped * binWidth + binWidth / 2;
        bead.x = binCenterX;
        bead.y = height - 20 - bins[clamped] * (beadRadius * 2 + 1);
      }
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#1e1b4b");
    grad.addColorStop(1, "#312e81");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawPegs() {
    const pegRadius = pegSpacing * 0.12;
    for (const peg of pegs) {
      const grad = ctx.createRadialGradient(peg.x - 1, peg.y - 1, 0, peg.x, peg.y, pegRadius);
      grad.addColorStop(0, "#fbbf24");
      grad.addColorStop(1, "#b45309");
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  function drawBeads() {
    const beadRadius = pegSpacing * 0.08;
    for (const bead of beads) {
      ctx.beginPath();
      ctx.arc(bead.x, bead.y, beadRadius, 0, Math.PI * 2);
      ctx.fillStyle = bead.settled ? "#60a5fa" : "#f87171";
      ctx.fill();
    }
  }

  function drawBins() {
    const numBins = numRows + 1;
    const binsWidth = numBins * binWidth;
    const binsLeft = width / 2 - binsWidth / 2;

    // Bin separators
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    for (let i = 0; i <= numBins; i++) {
      const x = binsLeft + i * binWidth;
      ctx.beginPath();
      ctx.moveTo(x, boardBot);
      ctx.lineTo(x, height - 10);
      ctx.stroke();
    }

    // Bottom line
    ctx.beginPath();
    ctx.moveTo(binsLeft, height - 10);
    ctx.lineTo(binsLeft + binsWidth, height - 10);
    ctx.stroke();

    // Bin counts
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < numBins; i++) {
      const x = binsLeft + i * binWidth + binWidth / 2;
      if (bins[i] > 0) {
        ctx.fillText(`${bins[i]}`, x, height - 2);
      }
    }
  }

  function drawBinomialCurve() {
    if (showCurve < 0.5 || totalDropped < 5) return;

    const numBins = numRows + 1;
    const binsWidth = numBins * binWidth;
    const binsLeft = width / 2 - binsWidth / 2;
    const maxBin = Math.max(...bins, 1);

    // Theoretical binomial distribution
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < numBins; i++) {
      // Binomial coefficient C(n, k) * p^k * (1-p)^(n-k)
      const n = numRows;
      const k = i;
      const p = 0.5;
      let coeff = 1;
      for (let j = 0; j < k; j++) {
        coeff *= (n - j) / (j + 1);
      }
      const prob = coeff * Math.pow(p, k) * Math.pow(1 - p, n - k);
      const expectedCount = prob * totalDropped;
      const barHeight = (expectedCount / maxBin) * (height - boardBot - 40);

      const x = binsLeft + i * binWidth + binWidth / 2;
      const y = height - 15 - barHeight;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawInfo() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Galton Board", width / 2, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText("Binary random events → Normal distribution", width / 2, 50);

    // Stats
    ctx.fillStyle = "rgba(30, 27, 75, 0.85)";
    ctx.beginPath();
    ctx.roundRect(10, 60, 160, 50, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Dropped: ${totalDropped}`, 20, 80);
    ctx.fillText(`Rows: ${numRows}  Bins: ${numRows + 1}`, 20, 98);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      const newRows = Math.round(params.numRows ?? 10);
      beadRate = params.beadRate ?? 5;
      restitution = params.restitution ?? 0.5;
      showCurve = params.showCurve ?? 1;

      if (newRows !== numRows) {
        numRows = newRows;
        initState();
        return;
      }

      time += dt;

      // Drop beads
      if (time - lastDropTime > 1 / beadRate) {
        spawnBead();
        lastDropTime = time;
      }

      // Physics updates (sub-steps)
      const subSteps = 3;
      const subDt = dt / subSteps;
      for (let s = 0; s < subSteps; s++) {
        updateBeads(subDt);
      }

      // Remove beads that overflow bins
      if (beads.length > 1000) {
        beads = beads.filter(b => !b.settled || b.y > height * 0.3);
        if (beads.length > 1000) {
          beads = beads.slice(-800);
        }
      }
    },

    render() {
      drawBackground();
      drawPegs();
      drawBins();
      drawBeads();
      drawBinomialCurve();
      drawInfo();
    },

    reset() {
      initState();
    },

    destroy() {
      beads = [];
    },

    getStateDescription(): string {
      const maxBinIdx = bins.indexOf(Math.max(...bins));
      return `Galton Board: ${totalDropped} beads dropped through ${numRows} rows of pegs. Distribution: [${bins.join(", ")}]. Peak at bin ${maxBinIdx}. This demonstrates the central limit theorem — many independent binary events produce a normal (bell curve) distribution.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      computeLayout();
    },
  };
};

export default GaltonBoardFactory;
