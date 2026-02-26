import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ReproductionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("reproduction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let speed = 1;
  let phase = 0; // 0-4: interphase, prophase, metaphase, anaphase, telophase
  let showLabels = 1;
  let cellSize = 100;

  let phaseProgress = 0;
  const NUM_PAIRS = 4;
  interface Chromosome {
    x: number; y: number; targetX: number; targetY: number;
    color: string; pair: number; copy: number;
  }
  let chromosomes: Chromosome[] = [];

  let spindleLeft = 0;
  let spindleRight = 0;
  let pinchAmount = 0;
  let nuclearMembraneOpacity = 1;

  const CHROMOSOME_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];
  const PHASE_NAMES = ["Interphase", "Prophase", "Metaphase", "Anaphase", "Telophase"];

  function initChromosomes(): void {
    chromosomes = [];
    const cx = width / 2;
    const cy = height / 2;

    for (let p = 0; p < NUM_PAIRS; p++) {
      const angle = (p / NUM_PAIRS) * Math.PI * 2 + Math.PI / 4;
      const dist = cellSize * 0.2;
      for (let c = 0; c < 2; c++) {
        const offset = (c - 0.5) * 8;
        chromosomes.push({
          x: cx + Math.cos(angle) * dist + offset,
          y: cy + Math.sin(angle) * dist + offset,
          targetX: cx + Math.cos(angle) * dist + offset,
          targetY: cy + Math.sin(angle) * dist + offset,
          color: CHROMOSOME_COLORS[p],
          pair: p,
          copy: c,
        });
      }
    }
  }

  function updateChromosomeTargets(): void {
    const cx = width / 2;
    const cy = height / 2;

    for (const ch of chromosomes) {
      if (phase === 0) {
        // Interphase: spread randomly in nucleus
        const angle = (ch.pair / NUM_PAIRS) * Math.PI * 2 + ch.copy * 0.3;
        const dist = cellSize * 0.2;
        ch.targetX = cx + Math.cos(angle) * dist + (ch.copy - 0.5) * 10;
        ch.targetY = cy + Math.sin(angle) * dist;
      } else if (phase === 1) {
        // Prophase: chromosomes condense, pair up
        const angle = (ch.pair / NUM_PAIRS) * Math.PI * 2;
        const dist = cellSize * 0.15;
        ch.targetX = cx + Math.cos(angle) * dist + (ch.copy - 0.5) * 6;
        ch.targetY = cy + Math.sin(angle) * dist;
      } else if (phase === 2) {
        // Metaphase: align at center (metaphase plate)
        const idx = ch.pair;
        const spacing = cellSize * 0.08;
        ch.targetX = cx + (ch.copy - 0.5) * 6;
        ch.targetY = cy - (NUM_PAIRS / 2 - idx) * spacing * 2;
      } else if (phase === 3) {
        // Anaphase: copies separate to opposite poles
        const idx = ch.pair;
        const spacing = cellSize * 0.08;
        const poleOffset = cellSize * 0.35 * phaseProgress;
        const direction = ch.copy === 0 ? -1 : 1;
        ch.targetX = cx + direction * poleOffset;
        ch.targetY = cy - (NUM_PAIRS / 2 - idx) * spacing * 2;
      } else if (phase === 4) {
        // Telophase: cluster at poles, cell dividing
        const idx = ch.pair;
        const spacing = cellSize * 0.06;
        const poleOffset = cellSize * 0.4;
        const direction = ch.copy === 0 ? -1 : 1;
        const angle = (idx / NUM_PAIRS) * Math.PI * 2;
        const clusterDist = cellSize * 0.1;
        ch.targetX = cx + direction * poleOffset + Math.cos(angle) * clusterDist;
        ch.targetY = cy + Math.sin(angle) * clusterDist - (NUM_PAIRS / 2 - idx) * spacing;
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    phaseProgress = 0;
    pinchAmount = 0;
    nuclearMembraneOpacity = 1;
    initChromosomes();
    updateChromosomeTargets();
  }

  function update(dt: number, params: Record<string, number>): void {
    speed = params.speed ?? 1;
    phase = Math.round(params.phase ?? 0);
    showLabels = params.showLabels ?? 1;
    cellSize = params.cellSize ?? 100;

    time += dt * speed;

    // Advance phase progress
    phaseProgress = Math.min(1, phaseProgress + dt * speed * 0.3);

    // Update nuclear membrane and pinch based on phase
    if (phase === 1) {
      nuclearMembraneOpacity = Math.max(0, 1 - phaseProgress);
    } else if (phase === 0) {
      nuclearMembraneOpacity = 1;
    } else {
      nuclearMembraneOpacity = 0;
    }

    if (phase === 4) {
      pinchAmount = phaseProgress;
    } else {
      pinchAmount = 0;
    }

    updateChromosomeTargets();

    // Lerp chromosomes toward targets
    const lerpSpeed = 3 * speed;
    for (const ch of chromosomes) {
      ch.x += (ch.targetX - ch.x) * Math.min(1, dt * lerpSpeed);
      ch.y += (ch.targetY - ch.y) * Math.min(1, dt * lerpSpeed);
    }

    // Spindle fibers appear in metaphase/anaphase
    if (phase >= 2 && phase <= 3) {
      spindleLeft = width / 2 - cellSize * 0.45;
      spindleRight = width / 2 + cellSize * 0.45;
    }
  }

  function drawCell(): void {
    const cx = width / 2;
    const cy = height / 2;

    // Cell membrane
    ctx.save();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.fillStyle = "rgba(200, 220, 240, 0.12)";

    if (pinchAmount > 0.05) {
      // Pinching cell (telophase/cytokinesis)
      const pinch = pinchAmount * cellSize * 0.45;
      ctx.beginPath();
      // Left half
      ctx.ellipse(cx - pinchAmount * cellSize * 0.2, cy, cellSize * (1 - pinchAmount * 0.3), cellSize * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Right half
      ctx.beginPath();
      ctx.ellipse(cx + pinchAmount * cellSize * 0.2, cy, cellSize * (1 - pinchAmount * 0.3), cellSize * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cleavage furrow
      ctx.beginPath();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(cx, cy - cellSize * 0.7 + pinch);
      ctx.lineTo(cx, cy + cellSize * 0.7 - pinch);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Normal cell
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellSize, cellSize * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Nuclear membrane (visible in interphase, fading in prophase)
    if (nuclearMembraneOpacity > 0.01) {
      ctx.save();
      ctx.strokeStyle = `rgba(139, 92, 246, ${nuclearMembraneOpacity * 0.8})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellSize * 0.4, cellSize * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawSpindleFibers(): void {
    if (phase < 2 || phase > 3) return;

    const cx = width / 2;
    const cy = height / 2;
    const alpha = phase === 2 ? phaseProgress * 0.4 : 0.4;

    ctx.save();
    ctx.strokeStyle = `rgba(156, 163, 175, ${alpha})`;
    ctx.lineWidth = 1;

    // Draw fibers from poles to each chromosome
    for (const ch of chromosomes) {
      ctx.beginPath();
      ctx.moveTo(spindleLeft, cy);
      ctx.quadraticCurveTo(cx, ch.y, ch.x, ch.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(spindleRight, cy);
      ctx.quadraticCurveTo(cx, ch.y, ch.x, ch.y);
      ctx.stroke();
    }

    // Centrosomes at poles
    for (const px of [spindleLeft, spindleRight]) {
      ctx.fillStyle = `rgba(251, 191, 36, ${alpha + 0.2})`;
      ctx.beginPath();
      ctx.arc(px, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawChromosomes(): void {
    for (const ch of chromosomes) {
      const condensed = phase >= 1;
      const len = condensed ? 12 : 20;
      const w = condensed ? 5 : 2;

      ctx.save();
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";

      // Draw X-shape for condensed chromosomes
      if (condensed && phase < 3) {
        ctx.beginPath();
        ctx.moveTo(ch.x - len / 2, ch.y - len / 2);
        ctx.lineTo(ch.x + len / 2, ch.y + len / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ch.x + len / 2, ch.y - len / 2);
        ctx.lineTo(ch.x - len / 2, ch.y + len / 2);
        ctx.stroke();
        // Centromere dot
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ch.x, ch.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (phase >= 3) {
        // Separated chromatids (V-shape)
        ctx.beginPath();
        ctx.moveTo(ch.x, ch.y - len / 3);
        ctx.lineTo(ch.x, ch.y + len / 3);
        ctx.stroke();
      } else {
        // Decondensed chromatin (wavy lines)
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ch.x - len / 2, ch.y);
        for (let i = 0; i <= 6; i++) {
          const px = ch.x - len / 2 + (i / 6) * len;
          const py = ch.y + Math.sin(i * 1.5 + time * 2) * 4;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPhaseInfo(): void {
    if (showLabels < 1) return;
    const cx = width / 2;
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(PHASE_NAMES[phase], cx, 35);
    const descriptions = [
      "Cell grows, DNA replicates. Chromatin is decondensed.",
      "Chromosomes condense. Nuclear membrane breaks down.",
      "Chromosomes align at the metaphase plate. Spindle fibers attach.",
      "Sister chromatids separate and move to opposite poles.",
      "Nuclear membranes reform. Cell pinches apart (cytokinesis).",
    ];
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(descriptions[phase], cx, 55);
    const barW = width * 0.7, barH = 8;
    const barX = (width - barW) / 2, barY = height - 50;
    ctx.fillStyle = "rgba(51, 65, 85, 0.6)";
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();
    const segW = barW / 5;
    const colors = ["#8b5cf6", "#ec4899", "#f59e0b", "#ef4444", "#22c55e"];
    for (let i = 0; i < 5; i++) {
      if (i < phase || (i === phase && phaseProgress > 0)) {
        const fillW = i < phase ? segW : segW * phaseProgress;
        ctx.fillStyle = colors[i];
        ctx.beginPath(); ctx.roundRect(barX + i * segW, barY, fillW, barH, 0); ctx.fill();
      }
    }
    ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center";
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i === phase ? "#e2e8f0" : "#64748b";
      ctx.fillText(PHASE_NAMES[i].substring(0, 3).toUpperCase(), barX + i * segW + segW / 2, barY + 20);
    }
    ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left";
    const legY = height - 85;
    for (let i = 0; i < NUM_PAIRS; i++) {
      const lx = 20 + i * 100;
      ctx.fillStyle = CHROMOSOME_COLORS[i];
      ctx.fillRect(lx, legY - 4, 12, 8);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Pair ${i + 1}`, lx + 16, legY + 4);
    }
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawCell();
    drawSpindleFibers();
    drawChromosomes();
    drawPhaseInfo();
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#64748b"; ctx.textAlign = "center";
    ctx.fillText("Cell Reproduction - Mitosis", width / 2, height - 12);
  }

  function reset(): void {
    time = 0;
    phaseProgress = 0;
    pinchAmount = 0;
    nuclearMembraneOpacity = 1;
    initChromosomes();
    updateChromosomeTargets();
  }

  function destroy(): void {
    chromosomes = [];
  }

  function getStateDescription(): string {
    return (
      `Cell Reproduction (Mitosis): Currently in ${PHASE_NAMES[phase]} phase (progress: ${(phaseProgress * 100).toFixed(0)}%). ` +
      `Speed: ${speed}x, cell size: ${cellSize}px. ` +
      `Showing ${NUM_PAIRS} chromosome pairs. ` +
      `Interphase: DNA replicates. Prophase: chromosomes condense, nuclear membrane dissolves. ` +
      `Metaphase: chromosomes align at center. Anaphase: chromatids separate. ` +
      `Telophase: cell divides (cytokinesis), two daughter cells form.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ReproductionFactory;
