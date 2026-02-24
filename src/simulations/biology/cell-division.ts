import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// Chromosome colors for different pairs
const CHROMO_COLORS = [
  ["#ef4444", "#f87171"], // red pair
  ["#3b82f6", "#60a5fa"], // blue pair
  ["#10b981", "#34d399"], // green pair
  ["#f59e0b", "#fbbf24"], // amber pair
  ["#8b5cf6", "#a78bfa"], // purple pair
  ["#ec4899", "#f472b6"], // pink pair
  ["#06b6d4", "#22d3ee"], // cyan pair
  ["#f97316", "#fb923c"], // orange pair
];

interface Chromosome {
  pairIndex: number;
  x: number;
  y: number;
  angle: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  color: string;
  isSister: boolean; // true if this is the sister chromatid
}

// Phases of mitosis
type MitosisPhase = "interphase" | "prophase" | "metaphase" | "anaphase" | "telophase" | "cytokinesis";

const PHASES: MitosisPhase[] = ["interphase", "prophase", "metaphase", "anaphase", "telophase", "cytokinesis"];
const PHASE_LABELS: Record<MitosisPhase, string> = {
  interphase: "Interphase",
  prophase: "Prophase",
  metaphase: "Metaphase",
  anaphase: "Anaphase",
  telophase: "Telophase",
  cytokinesis: "Cytokinesis",
};
const PHASE_DESCRIPTIONS: Record<MitosisPhase, string> = {
  interphase: "Cell grows, DNA replicates",
  prophase: "Chromosomes condense, spindle forms",
  metaphase: "Chromosomes align at cell equator",
  anaphase: "Sister chromatids separate to poles",
  telophase: "Nuclear envelopes reform",
  cytokinesis: "Cell membrane pinches, two cells form",
};

const CellDivisionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cell-division") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let speed = 1;
  let chromosomePairs = 4;
  let showLabels = 1;
  let cellSizeScale = 1;

  // State
  let chromosomes: Chromosome[] = [];
  let prevPairs = -1;

  // Phase timing (in seconds at speed=1)
  const PHASE_DURATION = 4; // each phase lasts this long
  const TOTAL_CYCLE = PHASE_DURATION * PHASES.length;

  function getPhaseInfo(): { phase: MitosisPhase; phaseIndex: number; progress: number } {
    const cycleTime = (time * speed) % TOTAL_CYCLE;
    const phaseIndex = Math.min(PHASES.length - 1, Math.floor(cycleTime / PHASE_DURATION));
    const progress = (cycleTime - phaseIndex * PHASE_DURATION) / PHASE_DURATION;
    return { phase: PHASES[phaseIndex], phaseIndex, progress };
  }

  function initChromosomes(): void {
    chromosomes = [];
    for (let p = 0; p < chromosomePairs; p++) {
      const colors = CHROMO_COLORS[p % CHROMO_COLORS.length];
      // Each pair has two copies (diploid), and each copy will have a sister chromatid after replication
      for (let copy = 0; copy < 2; copy++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 0.3;
        chromosomes.push({
          pairIndex: p,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          angle: Math.random() * Math.PI,
          targetX: 0,
          targetY: 0,
          targetAngle: 0,
          color: colors[copy],
          isSister: false,
        });
      }
    }
  }

  function easeInOut(t: number): number {
    const c = Math.min(1, Math.max(0, t));
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawCell(
    cx: number, cy: number, rx: number, ry: number,
    phase: MitosisPhase, progress: number, isRight: boolean
  ): void {
    // Cell membrane
    const membraneColor = "rgba(100, 200, 150, 0.25)";
    const membraneStroke = "rgba(100, 200, 150, 0.6)";

    ctx.save();

    // Cytokinesis: pinch the cell
    let pinchFactor = 0;
    if (phase === "cytokinesis") {
      pinchFactor = easeInOut(progress) * 0.95;
    } else if (phase === "telophase") {
      pinchFactor = easeInOut(progress) * 0.3;
    }

    // Cell body
    if (phase === "cytokinesis" || phase === "telophase") {
      // Draw pinched cell using two overlapping ellipses
      const leftCx = cx - rx * pinchFactor * 0.4;
      const rightCx = cx + rx * pinchFactor * 0.4;
      const pinchRx = rx * (1 - pinchFactor * 0.3);
      const midPinch = ry * (1 - pinchFactor * 0.8);

      // Left half
      ctx.beginPath();
      ctx.ellipse(leftCx, cy, pinchRx * 0.7, ry, 0, 0, Math.PI * 2);
      const leftGrad = ctx.createRadialGradient(leftCx, cy, 0, leftCx, cy, pinchRx);
      leftGrad.addColorStop(0, "rgba(80, 180, 130, 0.12)");
      leftGrad.addColorStop(0.8, "rgba(60, 160, 110, 0.08)");
      leftGrad.addColorStop(1, membraneColor);
      ctx.fillStyle = leftGrad;
      ctx.fill();
      ctx.strokeStyle = membraneStroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Right half
      ctx.beginPath();
      ctx.ellipse(rightCx, cy, pinchRx * 0.7, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = leftGrad;
      ctx.fill();
      ctx.strokeStyle = membraneStroke;
      ctx.stroke();

      // Cleavage furrow
      if (pinchFactor > 0.1) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${pinchFactor * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - midPinch);
        ctx.lineTo(cx, cy + midPinch);
        ctx.stroke();
      }
    } else {
      // Normal elliptical cell
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      const cellGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      cellGrad.addColorStop(0, "rgba(80, 180, 130, 0.12)");
      cellGrad.addColorStop(0.7, "rgba(60, 160, 110, 0.08)");
      cellGrad.addColorStop(1, membraneColor);
      ctx.fillStyle = cellGrad;
      ctx.fill();
      ctx.strokeStyle = membraneStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Nucleus (visible in interphase, dissolves in prophase)
    if (phase === "interphase" || (phase === "prophase" && progress < 0.7)) {
      const nucleusAlpha = phase === "interphase" ? 0.4 : 0.4 * (1 - progress / 0.7);
      const nr = Math.min(rx, ry) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, nr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(60, 100, 160, ${nucleusAlpha * 0.5})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(100, 150, 220, ${nucleusAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Nucleolus
      ctx.beginPath();
      ctx.arc(cx + nr * 0.2, cy - nr * 0.15, nr * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80, 130, 200, ${nucleusAlpha * 0.6})`;
      ctx.fill();
    }

    // Reformed nuclei in telophase
    if (phase === "telophase" && progress > 0.4) {
      const nucleusAlpha = easeInOut((progress - 0.4) / 0.6) * 0.35;
      const nr = Math.min(rx, ry) * 0.3;
      const offset = rx * 0.35;

      // Left nucleus
      ctx.beginPath();
      ctx.arc(cx - offset, cy, nr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 150, 220, ${nucleusAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Right nucleus
      ctx.beginPath();
      ctx.arc(cx + offset, cy, nr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Spindle fibers (metaphase and anaphase)
    if (phase === "metaphase" || phase === "anaphase") {
      const spindleAlpha = phase === "metaphase" ? easeInOut(progress) * 0.2 : 0.2 * (1 - progress);
      const poleOffset = rx * 0.8;

      // Centrioles at poles
      for (const side of [-1, 1]) {
        const px = cx + side * poleOffset;
        ctx.fillStyle = `rgba(200, 200, 255, ${spindleAlpha * 2})`;
        ctx.beginPath();
        ctx.arc(px, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spindle fibers radiating to center
        const fiberCount = chromosomePairs * 2;
        for (let f = 0; f < fiberCount; f++) {
          const fAngle = ((f / fiberCount) - 0.5) * Math.PI * 0.6;
          ctx.strokeStyle = `rgba(180, 180, 255, ${spindleAlpha})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(px, cy);
          const fx = cx + Math.cos(fAngle) * 5;
          const fy = cy + Math.sin(fAngle) * ry * 0.5 * (f / fiberCount - 0.5) * 2;
          ctx.lineTo(fx, fy);
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  function updateChromosomePositions(phase: MitosisPhase, progress: number): void {
    const numChromos = chromosomes.length;

    for (let i = 0; i < numChromos; i++) {
      const ch = chromosomes[i];
      const pairFrac = ch.pairIndex / chromosomePairs;

      switch (phase) {
        case "interphase": {
          // Chromosomes are decondensed (diffuse), spread in nucleus
          const angle = pairFrac * Math.PI * 2 + (ch.isSister ? 0.3 : 0) + (ch.color.includes("7") ? 0.15 : 0);
          const dist = 0.15 + Math.sin(time * 0.5 + i) * 0.05;
          ch.targetX = Math.cos(angle) * dist;
          ch.targetY = Math.sin(angle) * dist;
          ch.targetAngle = angle;
          break;
        }
        case "prophase": {
          // Chromosomes condense, pair up
          const angle = pairFrac * Math.PI * 2;
          const dist = 0.2;
          const sisterOffset = ch.isSister ? 0.02 : -0.02;
          ch.targetX = Math.cos(angle) * dist + sisterOffset;
          ch.targetY = Math.sin(angle) * dist;
          ch.targetAngle = angle + Math.PI / 4;
          break;
        }
        case "metaphase": {
          // Line up at metaphase plate (center, vertical line)
          const slot = i / numChromos;
          const yPos = (slot - 0.5) * 0.6;
          const sisterOffset = ch.isSister ? 0.03 : -0.03;
          ch.targetX = sisterOffset;
          ch.targetY = yPos;
          ch.targetAngle = Math.PI / 2;
          break;
        }
        case "anaphase": {
          // Sister chromatids separate to opposite poles
          const slot = (ch.pairIndex * 2 + (ch.isSister ? 1 : 0)) / numChromos;
          const yPos = (slot - 0.5) * 0.5;
          const side = ch.isSister ? 1 : -1;
          const separation = easeInOut(progress) * 0.6;
          ch.targetX = side * separation;
          ch.targetY = yPos;
          ch.targetAngle = Math.PI / 2;
          break;
        }
        case "telophase": {
          // Gather at poles, begin to decondense
          const chrIdx = ch.pairIndex * 2 + (ch.isSister ? 1 : 0);
          const poleAngle = (chrIdx / numChromos) * Math.PI * 2;
          const side = ch.isSister ? 1 : -1;
          const poleDist = 0.1 + progress * 0.05;
          ch.targetX = side * 0.55 + Math.cos(poleAngle) * poleDist;
          ch.targetY = Math.sin(poleAngle) * poleDist;
          ch.targetAngle = poleAngle;
          break;
        }
        case "cytokinesis": {
          // Stay at poles as cell divides
          const chrIdx = ch.pairIndex * 2 + (ch.isSister ? 1 : 0);
          const poleAngle = (chrIdx / numChromos) * Math.PI * 2;
          const side = ch.isSister ? 1 : -1;
          const poleDist = 0.12;
          const spreadFactor = 1 + progress * 0.3;
          ch.targetX = side * 0.55 * spreadFactor + Math.cos(poleAngle) * poleDist;
          ch.targetY = Math.sin(poleAngle) * poleDist;
          ch.targetAngle = poleAngle;
          break;
        }
      }

      // Smooth lerp to target positions
      const lerpSpeed = 0.08;
      ch.x = lerp(ch.x, ch.targetX, lerpSpeed);
      ch.y = lerp(ch.y, ch.targetY, lerpSpeed);
      ch.angle = lerp(ch.angle, ch.targetAngle, lerpSpeed);
    }
  }

  function drawChromosomes(
    cx: number, cy: number, cellRx: number, cellRy: number,
    phase: MitosisPhase, progress: number
  ): void {
    const chrSize = Math.min(cellRx, cellRy) * 0.07;

    for (const ch of chromosomes) {
      const x = cx + ch.x * cellRx;
      const y = cy + ch.y * cellRy;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ch.angle);

      // Chromosome condensation level
      let condensation = 1; // 1 = fully condensed
      if (phase === "interphase") {
        condensation = 0.3; // decondensed
      } else if (phase === "prophase") {
        condensation = 0.3 + easeInOut(progress) * 0.7;
      } else if (phase === "telophase") {
        condensation = 1 - easeInOut(progress) * 0.5;
      } else if (phase === "cytokinesis") {
        condensation = 0.5;
      }

      const chWidth = chrSize * condensation;
      const chLength = chrSize * (3 - condensation * 1.5);

      if (condensation < 0.5) {
        // Decondensed chromatin - draw as wiggly lines
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = chWidth * 0.4;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        const segments = 6;
        for (let s = 0; s <= segments; s++) {
          const sx = (s / segments - 0.5) * chLength * 2;
          const sy = Math.sin(s * 1.5 + time * 2 + ch.pairIndex) * chWidth * 1.5;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      } else {
        // Condensed chromosome - draw as X shape or rod
        ctx.globalAlpha = 0.9;

        // Glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, chLength);
        glow.addColorStop(0, ch.color + "44");
        glow.addColorStop(1, ch.color + "00");
        ctx.fillStyle = glow;
        ctx.fillRect(-chLength, -chLength, chLength * 2, chLength * 2);

        // Sister chromatid pair (X shape in metaphase)
        const showX = (phase === "metaphase" || (phase === "prophase" && progress > 0.5)) && !ch.isSister;

        if (showX && chromosomes.some(other => other.pairIndex === ch.pairIndex && other.isSister)) {
          // Draw X-shaped chromosome
          ctx.lineWidth = chWidth;
          ctx.lineCap = "round";
          ctx.strokeStyle = ch.color;

          // Two arms of X
          ctx.beginPath();
          ctx.moveTo(-chLength * 0.6, -chLength * 0.7);
          ctx.lineTo(chLength * 0.6, chLength * 0.7);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(chLength * 0.6, -chLength * 0.7);
          ctx.lineTo(-chLength * 0.6, chLength * 0.7);
          ctx.stroke();

          // Centromere at center
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.beginPath();
          ctx.arc(0, 0, chWidth * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Single rod chromosome
          ctx.lineWidth = chWidth;
          ctx.lineCap = "round";
          ctx.strokeStyle = ch.color;
          ctx.beginPath();
          ctx.moveTo(0, -chLength * 0.6);
          ctx.lineTo(0, chLength * 0.6);
          ctx.stroke();

          // Slight color gradient
          ctx.lineWidth = chWidth * 0.6;
          ctx.strokeStyle = ch.color + "88";
          ctx.beginPath();
          ctx.moveTo(0, -chLength * 0.4);
          ctx.lineTo(0, chLength * 0.4);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  function drawPhaseTimeline(phase: MitosisPhase, phaseIndex: number, progress: number): void {
    if (showLabels < 0.5) return;

    const timelineY = height * 0.92;
    const timelineW = width * 0.8;
    const timelineX = (width - timelineW) / 2;
    const fontSize = Math.max(9, Math.min(11, width / 60));

    // Timeline background
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(timelineX - 10, timelineY - 20, timelineW + 20, 36, 8);
    ctx.fill();

    // Phase segments
    const segW = timelineW / PHASES.length;
    for (let i = 0; i < PHASES.length; i++) {
      const sx = timelineX + i * segW;
      const isActive = i === phaseIndex;
      const isPast = i < phaseIndex;

      // Segment background
      if (isActive) {
        ctx.fillStyle = "rgba(100, 200, 150, 0.3)";
        ctx.fillRect(sx, timelineY - 12, segW * progress, 24);
      }

      // Segment border
      ctx.strokeStyle = isActive ? "rgba(100, 200, 150, 0.6)" : isPast ? "rgba(100, 200, 150, 0.3)" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, timelineY - 12, segW, 24);

      // Phase label
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.9)" : isPast ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.3)";
      ctx.font = `${isActive ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(PHASE_LABELS[PHASES[i]], sx + segW / 2, timelineY);
    }

    // Current phase description
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `${fontSize + 1}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(PHASE_DESCRIPTIONS[phase], width / 2, timelineY - 26);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `bold ${Math.max(12, Math.min(15, width / 45))}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Cell Division - Mitosis", 12, 10);

    // Chromosome count
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${Math.max(10, Math.min(12, width / 55))}px system-ui, sans-serif`;
    ctx.fillText(`${chromosomePairs} chromosome pairs (2n = ${chromosomePairs * 2})`, 12, 30);

    // Time
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "right";
    ctx.fillText(`t = ${time.toFixed(1)}s`, width - 12, 12);
  }

  function drawChromosomeLegend(): void {
    if (showLabels < 0.5) return;

    const legendX = width - 16;
    const legendY = height * 0.15;
    const fontSize = Math.max(9, Math.min(10, width / 65));
    const lineH = 16;

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText("Chromosome Pairs:", legendX, legendY);

    for (let p = 0; p < chromosomePairs; p++) {
      const y = legendY + (p + 1) * lineH;
      const colors = CHROMO_COLORS[p % CHROMO_COLORS.length];

      // Color dot
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.arc(legendX - 40, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colors[1];
      ctx.beginPath();
      ctx.arc(legendX - 28, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillText(`Pair ${p + 1}`, legendX, y);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    prevPairs = -1;
    initChromosomes();
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    speed = params.speed ?? 1;
    chromosomePairs = Math.round(params.chromosomes ?? 4);
    showLabels = params.showLabels ?? 1;
    cellSizeScale = params.cellSize ?? 1;

    // Reinitialize chromosomes if pair count changed
    if (chromosomePairs !== prevPairs) {
      initChromosomes();

      // Create sister chromatids (duplicated chromosomes)
      const originals = [...chromosomes];
      for (const ch of originals) {
        chromosomes.push({
          ...ch,
          isSister: true,
          x: ch.x + 0.02,
          y: ch.y + 0.02,
        });
      }

      prevPairs = chromosomePairs;
    }

    const { phase, progress } = getPhaseInfo();
    updateChromosomePositions(phase, progress);
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();

    const { phase, phaseIndex, progress } = getPhaseInfo();

    // Cell dimensions
    const cellCx = width / 2;
    const cellCy = height * 0.48;
    const baseR = Math.min(width, height) * 0.28 * cellSizeScale;
    const cellRx = baseR * (phase === "anaphase" ? 1 + easeInOut(progress) * 0.3 : phase === "telophase" || phase === "cytokinesis" ? 1.3 : 1);
    const cellRy = baseR * (phase === "anaphase" ? 1 - easeInOut(progress) * 0.1 : 1);

    drawCell(cellCx, cellCy, cellRx, cellRy, phase, progress, false);
    drawChromosomes(cellCx, cellCy, cellRx, cellRy, phase, progress);

    drawPhaseTimeline(phase, phaseIndex, progress);
    drawTitle();
    drawChromosomeLegend();
  }

  function reset(): void {
    time = 0;
    prevPairs = -1;
    initChromosomes();
  }

  function destroy(): void {
    chromosomes = [];
  }

  function getStateDescription(): string {
    const { phase, progress } = getPhaseInfo();
    return (
      `Cell Division (Mitosis): Currently in ${PHASE_LABELS[phase]} (${(progress * 100).toFixed(0)}% through phase). ` +
      `${PHASE_DESCRIPTIONS[phase]}. ` +
      `${chromosomePairs} chromosome pairs (2n = ${chromosomePairs * 2}). ` +
      `Animation speed: ${speed}x. ` +
      `Mitosis produces two genetically identical daughter cells. ` +
      `Phase sequence: Interphase (DNA replication) -> Prophase (chromosome condensation) -> ` +
      `Metaphase (alignment at equator) -> Anaphase (chromatid separation) -> ` +
      `Telophase (nuclear reformation) -> Cytokinesis (cell division). ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default CellDivisionFactory;
