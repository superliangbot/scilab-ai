import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HalfLifePeriodFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("half-life-period") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let halfLife = 5; // seconds per half-life period
  let totalAtoms = 64;
  let elapsedPeriods = 0;
  let decayTimer = 0;
  let isDecaying = false;

  interface Atom {
    row: number;
    col: number;
    alive: boolean;
    decayPhase: number; // 0 = alive, 1 = decaying animation, 2 = decayed
    animProgress: number;
  }

  let atoms: Atom[] = [];
  const history: { period: number; remaining: number }[] = [];

  function initAtoms() {
    const gridSize = Math.ceil(Math.sqrt(totalAtoms));
    atoms = [];
    for (let i = 0; i < totalAtoms; i++) {
      atoms.push({
        row: Math.floor(i / gridSize),
        col: i % gridSize,
        alive: true,
        decayPhase: 0,
        animProgress: 0,
      });
    }
    history.length = 0;
    history.push({ period: 0, remaining: totalAtoms });
    elapsedPeriods = 0;
    decayTimer = 0;
    isDecaying = false;
  }

  function performDecay() {
    const aliveAtoms = atoms.filter((a) => a.alive);
    if (aliveAtoms.length === 0) {
      isDecaying = false;
      return;
    }

    // Each atom has 50% chance of decaying
    for (const atom of aliveAtoms) {
      if (Math.random() < 0.5) {
        atom.alive = false;
        atom.decayPhase = 1;
        atom.animProgress = 0;
      }
    }

    elapsedPeriods++;
    const remaining = atoms.filter((a) => a.alive).length;
    history.push({ period: elapsedPeriods, remaining });

    if (remaining === 0) {
      isDecaying = false;
    }
  }

  function drawGrid() {
    const gridSize = Math.ceil(Math.sqrt(totalAtoms));
    const gridArea = Math.min(width * 0.45, height - 140);
    const cellSize = gridArea / gridSize;
    const startX = 20;
    const startY = 60;

    for (const atom of atoms) {
      const x = startX + atom.col * cellSize + cellSize / 2;
      const y = startY + atom.row * cellSize + cellSize / 2;
      const r = cellSize * 0.38;

      if (atom.alive) {
        // Active atom - glowing green
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "#44ff88");
        grad.addColorStop(0.7, "#22aa55");
        grad.addColorStop(1, "#116633");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Radiation symbol hint
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.font = `${r * 0.9}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("☢", x, y);
      } else if (atom.decayPhase === 1) {
        // Decaying animation
        atom.animProgress = Math.min(atom.animProgress + 0.05, 1);
        const fadeR = r * (1 + atom.animProgress * 0.5);
        const alpha = 1 - atom.animProgress;
        ctx.fillStyle = `rgba(255,100,50,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, fadeR, 0, Math.PI * 2);
        ctx.fill();

        if (atom.animProgress >= 1) {
          atom.decayPhase = 2;
        }
      } else {
        // Fully decayed - dim gray
        ctx.fillStyle = "rgba(60,60,60,0.5)";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGraph() {
    const graphX = width * 0.52;
    const graphY = 60;
    const graphW = width * 0.43;
    const graphH = height - 140;

    // Background
    ctx.fillStyle = "rgba(15,20,35,0.8)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(graphX, graphY, graphW, graphH, 6);
    ctx.fill();
    ctx.stroke();

    // Axes
    const axisMargin = 45;
    const plotX = graphX + axisMargin;
    const plotY = graphY + 20;
    const plotW = graphW - axisMargin - 15;
    const plotH = graphH - 50;

    ctx.strokeStyle = "#556";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#99aacc";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = (totalAtoms * i) / 4;
      const y = plotY + plotH - (i / 4) * plotH;
      ctx.fillText(val.toFixed(0), plotX - 5, y + 3);
      ctx.strokeStyle = "rgba(80,100,120,0.2)";
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();
    }

    // X-axis labels
    ctx.textAlign = "center";
    const maxPeriods = Math.max(6, elapsedPeriods + 1);
    for (let i = 0; i <= maxPeriods; i++) {
      const x = plotX + (i / maxPeriods) * plotW;
      ctx.fillText(i.toString(), x, plotY + plotH + 15);
    }

    ctx.fillStyle = "#778";
    ctx.font = "10px sans-serif";
    ctx.fillText("Half-life periods", plotX + plotW / 2, plotY + plotH + 30);

    // Theoretical curve
    ctx.strokeStyle = "rgba(255,100,100,0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let t = 0; t <= maxPeriods; t += 0.1) {
      const n = totalAtoms * Math.pow(0.5, t);
      const x = plotX + (t / maxPeriods) * plotW;
      const y = plotY + plotH - (n / totalAtoms) * plotH;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Data points
    ctx.fillStyle = "#44aaff";
    ctx.strokeStyle = "#44aaff";
    ctx.lineWidth = 2;
    if (history.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const x = plotX + (history[i].period / maxPeriods) * plotW;
        const y = plotY + plotH - (history[i].remaining / totalAtoms) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    for (const h of history) {
      const x = plotX + (h.period / maxPeriods) * plotW;
      const y = plotY + plotH - (h.remaining / totalAtoms) * plotH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Legend
    ctx.fillStyle = "#aaa";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,100,100,0.6)";
    ctx.fillText("— Theoretical N₀·(½)ᵗ", plotX + 5, plotY + 15);
    ctx.fillStyle = "#44aaff";
    ctx.fillText("● Actual remaining", plotX + 5, plotY + 30);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initAtoms();
    },

    update(dt: number, params: Record<string, number>) {
      const newHalfLife = params.halfLife ?? 5;
      const newTotal = Math.round(params.totalAtoms ?? 64);

      if (newTotal !== totalAtoms) {
        totalAtoms = newTotal;
        initAtoms();
      }
      halfLife = newHalfLife;

      if (isDecaying) {
        decayTimer += dt;
        if (decayTimer >= halfLife) {
          decayTimer -= halfLife;
          performDecay();
        }
      } else {
        // Auto-start if we haven't started yet
        const aliveCount = atoms.filter((a) => a.alive).length;
        if (aliveCount === totalAtoms && elapsedPeriods === 0) {
          isDecaying = true;
          decayTimer = 0;
        }
      }

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Radioactive Half-Life", width / 2, 28);

      // Status
      const remaining = atoms.filter((a) => a.alive).length;
      ctx.fillStyle = "#88bbdd";
      ctx.font = "12px monospace";
      ctx.fillText(`Remaining: ${remaining}/${totalAtoms}  |  Periods: ${elapsedPeriods}  |  Half-life: ${halfLife}s`, width / 2, 48);

      drawGrid();
      drawGraph();

      // Progress bar for next decay
      if (isDecaying && remaining > 0) {
        const barW = 120;
        const barH = 6;
        const barX = width / 2 - barW / 2;
        const barY = height - 25;
        const progress = decayTimer / halfLife;

        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 3);
        ctx.fill();

        ctx.fillStyle = "#44ff88";
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW * progress, barH, 3);
        ctx.fill();

        ctx.fillStyle = "#777";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Next decay", width / 2, barY - 4);
      }
    },

    reset() {
      time = 0;
      initAtoms();
    },

    destroy() {
      atoms = [];
      history.length = 0;
    },

    getStateDescription() {
      const remaining = atoms.filter((a) => a.alive).length;
      const theoretical = totalAtoms * Math.pow(0.5, elapsedPeriods);
      return `Half-life simulation: ${remaining}/${totalAtoms} atoms remaining after ${elapsedPeriods} periods. Theoretical: ${theoretical.toFixed(1)}. Half-life=${halfLife}s. N(t)=N₀·(1/2)^(t/t½).`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HalfLifePeriodFactory;
