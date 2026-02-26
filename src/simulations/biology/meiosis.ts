import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Meiosis: Cell division producing gametes with half the chromosome number.
 * Shows the stages: Prophase I, Metaphase I, Anaphase I, Telophase I,
 * Prophase II, Metaphase II, Anaphase II, Telophase II.
 */
const MeiosisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("meiosis") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let speed = 1;
  let chromosomeCount = 4; // 2n = 4
  let showLabels = 1;
  let currentStage = 0;

  const STAGES = [
    { name: "Interphase", desc: "DNA replicates. Each chromosome becomes 2 sister chromatids.", duration: 3 },
    { name: "Prophase I", desc: "Homologous chromosomes pair up (synapsis). Crossing over occurs.", duration: 3 },
    { name: "Metaphase I", desc: "Homologous pairs line up at the cell equator.", duration: 2.5 },
    { name: "Anaphase I", desc: "Homologous chromosomes separate to opposite poles.", duration: 3 },
    { name: "Telophase I", desc: "Two haploid cells form. Each has one set of chromosomes.", duration: 2.5 },
    { name: "Prophase II", desc: "Chromosomes condense again in each haploid cell.", duration: 2 },
    { name: "Metaphase II", desc: "Chromosomes line up at the equator of each cell.", duration: 2 },
    { name: "Anaphase II", desc: "Sister chromatids separate to opposite poles.", duration: 3 },
    { name: "Telophase II", desc: "Four haploid gametes produced, each with n chromosomes.", duration: 3 },
  ];

  const TOTAL_DURATION = STAGES.reduce((s, st) => s + st.duration, 0);

  const CHROM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];

  interface ChromosomePair {
    color1: string; // maternal
    color2: string; // paternal
  }

  function getChromPairs(): ChromosomePair[] {
    const n = Math.floor(chromosomeCount / 2);
    const pairs: ChromosomePair[] = [];
    for (let i = 0; i < n; i++) {
      pairs.push({
        color1: CHROM_COLORS[i % CHROM_COLORS.length],
        color2: CHROM_COLORS[(i + 3) % CHROM_COLORS.length],
      });
    }
    return pairs;
  }

  function getStageAtTime(): { stageIdx: number; stageProgress: number } {
    const t = time % TOTAL_DURATION;
    let elapsed = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (t < elapsed + STAGES[i].duration) {
        return { stageIdx: i, stageProgress: (t - elapsed) / STAGES[i].duration };
      }
      elapsed += STAGES[i].duration;
    }
    return { stageIdx: STAGES.length - 1, stageProgress: 1 };
  }

  function drawChromosome(x: number, y: number, color: string, size: number, duplicated: boolean) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, size * 0.3);
    ctx.lineCap = "round";

    if (duplicated) {
      // X-shaped sister chromatids
      ctx.beginPath();
      ctx.moveTo(x - size * 0.4, y - size * 0.5);
      ctx.quadraticCurveTo(x, y, x + size * 0.4, y + size * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + size * 0.4, y - size * 0.5);
      ctx.quadraticCurveTo(x, y, x - size * 0.4, y + size * 0.5);
      ctx.stroke();
      // Centromere
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    } else {
      // Single chromatid - I shape
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.5);
      ctx.quadraticCurveTo(x + size * 0.15, y, x, y + size * 0.5);
      ctx.stroke();
    }
  }

  function drawCell(cx: number, cy: number, rx: number, ry: number, dividing: boolean, progress: number) {
    ctx.beginPath();
    if (dividing) {
      // Pinching cell
      const pinch = progress * rx * 0.6;
      ctx.moveTo(cx - rx, cy);
      ctx.quadraticCurveTo(cx - rx, cy - ry, cx, cy - ry);
      ctx.quadraticCurveTo(cx + rx, cy - ry, cx + rx, cy);
      ctx.quadraticCurveTo(cx + pinch * 0.3, cy + ry * 0.1, cx, cy);
      ctx.quadraticCurveTo(cx - pinch * 0.3, cy + ry * 0.1, cx - rx, cy);
      // Bottom half
      ctx.moveTo(cx - rx, cy);
      ctx.quadraticCurveTo(cx - rx, cy + ry, cx, cy + ry);
      ctx.quadraticCurveTo(cx + rx, cy + ry, cx + rx, cy);
    } else {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.fillStyle = "rgba(200, 230, 255, 0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawSpindleFibers(cx: number, cy: number, toX: number, toY: number) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = "rgba(150, 150, 150, 0.3)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      speed = params.speed ?? 1;
      chromosomeCount = Math.round(params.chromosomeCount ?? 4);
      if (chromosomeCount % 2 !== 0) chromosomeCount += 1;
      if (chromosomeCount < 2) chromosomeCount = 2;
      if (chromosomeCount > 8) chromosomeCount = 8;
      showLabels = params.showLabels ?? 1;

      time += dt * speed * 0.3;
      const { stageIdx } = getStageAtTime();
      currentStage = stageIdx;
    },

    render() {
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Meiosis — Cell Division for Gamete Production", W / 2, 28);

      const { stageIdx, stageProgress } = getStageAtTime();
      const stage = STAGES[stageIdx];
      const pairs = getChromPairs();
      const n = pairs.length; // haploid number

      const cellCx = W / 2;
      const cellCy = H * 0.45;
      const cellRx = W * 0.18;
      const cellRy = H * 0.22;
      const chromSize = 18;

      if (stageIdx <= 3) {
        // MEIOSIS I — single cell dividing
        const isDividing = stageIdx === 3 || stageIdx === 4;
        const divProgress = stageIdx === 3 ? stageProgress : stageIdx === 4 ? 1 : 0;

        drawCell(cellCx, cellCy, cellRx, cellRy, isDividing && stageIdx === 3, stageProgress);

        if (stageIdx === 0) {
          // Interphase: chromosomes scattered, becoming duplicated
          for (let i = 0; i < n; i++) {
            const angle = (i / n) * Math.PI * 2;
            const r = cellRx * 0.4;
            const x = cellCx + r * Math.cos(angle);
            const y = cellCy + r * Math.sin(angle);
            const dup = stageProgress > 0.5;
            drawChromosome(x - 8, y, pairs[i].color1, chromSize, dup);
            drawChromosome(x + 8, y, pairs[i].color2, chromSize, dup);
          }
        } else if (stageIdx === 1) {
          // Prophase I: homologs pair up, crossing over
          for (let i = 0; i < n; i++) {
            const angle = (i / n) * Math.PI * 2;
            const r = cellRx * 0.3 * (1 - stageProgress * 0.3);
            const x = cellCx + r * Math.cos(angle);
            const y = cellCy + r * Math.sin(angle);
            drawChromosome(x - 4, y, pairs[i].color1, chromSize, true);
            drawChromosome(x + 4, y, pairs[i].color2, chromSize, true);
          }
          // Crossing over visual
          if (stageProgress > 0.6) {
            ctx.font = "11px system-ui, sans-serif";
            ctx.fillStyle = "#fbbf24";
            ctx.textAlign = "center";
            ctx.fillText("Crossing over", cellCx, cellCy + cellRy * 0.7);
          }
        } else if (stageIdx === 2) {
          // Metaphase I: aligned at equator
          for (let i = 0; i < n; i++) {
            const y = cellCy + (i - (n - 1) / 2) * 30;
            drawChromosome(cellCx - 12, y, pairs[i].color1, chromSize, true);
            drawChromosome(cellCx + 12, y, pairs[i].color2, chromSize, true);
            // Spindle fibers
            drawSpindleFibers(cellCx - cellRx * 0.8, cellCy, cellCx - 12, y);
            drawSpindleFibers(cellCx + cellRx * 0.8, cellCy, cellCx + 12, y);
          }
          // Metaphase plate
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cellCx, cellCy - cellRy * 0.8);
          ctx.lineTo(cellCx, cellCy + cellRy * 0.8);
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (stageIdx === 3) {
          // Anaphase I: homologs separating
          const sep = stageProgress * cellRx * 0.5;
          for (let i = 0; i < n; i++) {
            const y = cellCy + (i - (n - 1) / 2) * 30;
            drawChromosome(cellCx - sep - 12, y, pairs[i].color1, chromSize, true);
            drawChromosome(cellCx + sep + 12, y, pairs[i].color2, chromSize, true);
            drawSpindleFibers(cellCx - cellRx * 0.8, cellCy, cellCx - sep - 12, y);
            drawSpindleFibers(cellCx + cellRx * 0.8, cellCy, cellCx + sep + 12, y);
          }
        }
      } else if (stageIdx === 4) {
        // Telophase I: two cells
        const gap = cellRx * 0.7;
        drawCell(cellCx - gap, cellCy, cellRx * 0.6, cellRy * 0.9, false, 0);
        drawCell(cellCx + gap, cellCy, cellRx * 0.6, cellRy * 0.9, false, 0);

        for (let i = 0; i < n; i++) {
          const y = cellCy + (i - (n - 1) / 2) * 25;
          drawChromosome(cellCx - gap, y, pairs[i].color1, chromSize * 0.8, true);
          drawChromosome(cellCx + gap, y, pairs[i].color2, chromSize * 0.8, true);
        }
      } else {
        // MEIOSIS II — two cells each dividing
        const gap = cellRx * 0.7;
        const cellR2x = cellRx * 0.55;
        const cellR2y = cellRy * 0.85;

        const isDividing2 = stageIdx === 7;

        // Left cell
        drawCell(cellCx - gap, cellCy, cellR2x, cellR2y, isDividing2, stageProgress);
        // Right cell
        drawCell(cellCx + gap, cellCy, cellR2x, cellR2y, isDividing2, stageProgress);

        if (stageIdx === 5) {
          // Prophase II
          for (let i = 0; i < n; i++) {
            const y = cellCy + (i - (n - 1) / 2) * 22;
            drawChromosome(cellCx - gap, y, pairs[i].color1, chromSize * 0.7, true);
            drawChromosome(cellCx + gap, y, pairs[i].color2, chromSize * 0.7, true);
          }
        } else if (stageIdx === 6) {
          // Metaphase II
          for (let i = 0; i < n; i++) {
            const y = cellCy + (i - (n - 1) / 2) * 22;
            drawChromosome(cellCx - gap, y, pairs[i].color1, chromSize * 0.7, true);
            drawChromosome(cellCx + gap, y, pairs[i].color2, chromSize * 0.7, true);
          }
          // Metaphase plates
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cellCx - gap, cellCy - cellR2y * 0.7);
          ctx.lineTo(cellCx - gap, cellCy + cellR2y * 0.7);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cellCx + gap, cellCy - cellR2y * 0.7);
          ctx.lineTo(cellCx + gap, cellCy + cellR2y * 0.7);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (stageIdx === 7) {
          // Anaphase II: sister chromatids separate
          const sep2 = stageProgress * cellR2x * 0.4;
          for (let i = 0; i < n; i++) {
            const y = cellCy + (i - (n - 1) / 2) * 22;
            drawChromosome(cellCx - gap - sep2, y, pairs[i].color1, chromSize * 0.6, false);
            drawChromosome(cellCx - gap + sep2, y, pairs[i].color1, chromSize * 0.6, false);
            drawChromosome(cellCx + gap - sep2, y, pairs[i].color2, chromSize * 0.6, false);
            drawChromosome(cellCx + gap + sep2, y, pairs[i].color2, chromSize * 0.6, false);
          }
        } else if (stageIdx === 8) {
          // Telophase II: 4 cells
          const positions = [
            { x: cellCx - gap - cellR2x * 0.5, y: cellCy },
            { x: cellCx - gap + cellR2x * 0.5, y: cellCy },
            { x: cellCx + gap - cellR2x * 0.5, y: cellCy },
            { x: cellCx + gap + cellR2x * 0.5, y: cellCy },
          ];
          const smallR = cellR2x * 0.4;
          for (let c = 0; c < 4; c++) {
            drawCell(positions[c].x, positions[c].y, smallR, cellR2y * 0.5, false, 0);
            for (let i = 0; i < n; i++) {
              const y = positions[c].y + (i - (n - 1) / 2) * 15;
              const color = c < 2 ? pairs[i].color1 : pairs[i].color2;
              drawChromosome(positions[c].x, y, color, chromSize * 0.5, false);
            }
          }
          // Label gametes
          ctx.font = "11px system-ui, sans-serif";
          ctx.fillStyle = "#fbbf24";
          ctx.textAlign = "center";
          for (let c = 0; c < 4; c++) {
            ctx.fillText(`n=${n}`, positions[c].x, positions[c].y + cellR2y * 0.5 + 15);
          }
        }
      }

      // Stage indicator bar at bottom
      const barY = H - 100;
      const barW = W - 60;
      const barH = 8;
      const barX = 30;

      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 4);
      ctx.fill();

      // Progress
      let elapsed = 0;
      for (let i = 0; i <= stageIdx; i++) {
        elapsed += i < stageIdx ? STAGES[i].duration : STAGES[i].duration * stageProgress;
      }
      const progressFrac = elapsed / TOTAL_DURATION;
      const progGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      progGrad.addColorStop(0, "#3b82f6");
      progGrad.addColorStop(1, "#8b5cf6");
      ctx.fillStyle = progGrad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * progressFrac, barH, 4);
      ctx.fill();

      // Stage labels
      if (showLabels) {
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        let accumX = barX;
        for (let i = 0; i < STAGES.length; i++) {
          const w = (STAGES[i].duration / TOTAL_DURATION) * barW;
          const midX = accumX + w / 2;
          ctx.fillStyle = i === stageIdx ? "#e2e8f0" : "#64748b";
          ctx.fillText(STAGES[i].name, midX, barY - 6);
          accumX += w;
        }
      }

      // Current stage info
      ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "center";
      ctx.fillText(stage.name, W / 2, H - 55);

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(stage.desc, W / 2, H - 38);

      // Chromosome count info
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "left";
      ctx.fillText(`2n = ${chromosomeCount} (diploid)  |  n = ${chromosomeCount / 2} (haploid)`, 16, H - 14);
    },

    reset() {
      time = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const { stageIdx } = getStageAtTime();
      const stage = STAGES[stageIdx];
      return (
        `Meiosis simulation: Stage ${stageIdx + 1}/${STAGES.length} — ${stage.name}. ` +
        `${stage.desc} ` +
        `Diploid number 2n=${chromosomeCount}, haploid n=${chromosomeCount / 2}. ` +
        `Meiosis produces 4 genetically unique haploid gametes from one diploid cell.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MeiosisFactory;
