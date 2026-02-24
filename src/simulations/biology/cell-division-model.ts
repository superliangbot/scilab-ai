import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// Chromosome pair colors
const CHROMO_COLORS = [
  ["#ef4444", "#f87171"], // red
  ["#3b82f6", "#60a5fa"], // blue
  ["#10b981", "#34d399"], // green
  ["#f59e0b", "#fbbf24"], // amber
  ["#8b5cf6", "#a78bfa"], // purple
  ["#ec4899", "#f472b6"], // pink
];

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
  interphase: "Cell grows and DNA replicates (S phase). Chromosomes are decondensed chromatin.",
  prophase: "Chromosomes condense. Nuclear envelope breaks down. Spindle fibers begin to form.",
  metaphase: "Chromosomes align at the metaphase plate. Spindle fibers attach to centromeres.",
  anaphase: "Sister chromatids separate and are pulled to opposite poles by spindle fibers.",
  telophase: "Chromatids arrive at poles. Nuclear envelopes reform around each set.",
  cytokinesis: "Cleavage furrow deepens. Cell membrane pinches inward, forming two daughter cells.",
};

interface Chromosome {
  pairIndex: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  targetAngle: number;
  color: string;
  isSister: boolean;
}

const CellDivisionModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cell-division-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let speed = 1;
  let chromosomePairs = 4;
  let showLabels = 1;
  let showSpindle = 1;

  // State
  let chromosomes: Chromosome[] = [];
  let prevPairs = -1;

  // Phase timing
  const PHASE_DURATION = 5; // seconds per phase at speed=1
  const TOTAL_CYCLE = PHASE_DURATION * PHASES.length;

  function easeInOut(t: number): number {
    const c = Math.min(1, Math.max(0, t));
    return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

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
      for (let copy = 0; copy < 2; copy++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 0.25;
        const ch: Chromosome = {
          pairIndex: p,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          targetX: 0,
          targetY: 0,
          angle: Math.random() * Math.PI,
          targetAngle: 0,
          color: colors[copy],
          isSister: false,
        };
        chromosomes.push(ch);
      }
    }
    // Create sister chromatids (replication)
    const originals = [...chromosomes];
    for (const ch of originals) {
      chromosomes.push({
        ...ch,
        isSister: true,
        x: ch.x + 0.02,
        y: ch.y + 0.02,
      });
    }
  }

  function updateChromosomePositions(phase: MitosisPhase, progress: number): void {
    const numChromos = chromosomes.length;

    for (let i = 0; i < numChromos; i++) {
      const ch = chromosomes[i];
      const pairFrac = ch.pairIndex / chromosomePairs;

      switch (phase) {
        case "interphase": {
          const angle = pairFrac * Math.PI * 2 + (ch.isSister ? 0.3 : 0) + i * 0.1;
          const dist = 0.15 + Math.sin(time * 0.4 + i) * 0.05;
          ch.targetX = Math.cos(angle) * dist;
          ch.targetY = Math.sin(angle) * dist;
          ch.targetAngle = angle;
          break;
        }
        case "prophase": {
          const angle = pairFrac * Math.PI * 2;
          const dist = 0.18;
          const sisterOff = ch.isSister ? 0.015 : -0.015;
          ch.targetX = Math.cos(angle) * dist + sisterOff;
          ch.targetY = Math.sin(angle) * dist;
          ch.targetAngle = angle + Math.PI / 4;
          break;
        }
        case "metaphase": {
          const slot = i / numChromos;
          const yPos = (slot - 0.5) * 0.55;
          const sisterOff = ch.isSister ? 0.025 : -0.025;
          ch.targetX = sisterOff;
          ch.targetY = yPos;
          ch.targetAngle = Math.PI / 2;
          break;
        }
        case "anaphase": {
          const slot = (ch.pairIndex * 2 + (ch.isSister ? 1 : 0)) / numChromos;
          const yPos = (slot - 0.5) * 0.45;
          const side = ch.isSister ? 1 : -1;
          const separation = easeInOut(progress) * 0.6;
          ch.targetX = side * separation;
          ch.targetY = yPos;
          ch.targetAngle = Math.PI / 2;
          break;
        }
        case "telophase": {
          const chrIdx = ch.pairIndex * 2 + (ch.isSister ? 1 : 0);
          const poleAngle = (chrIdx / numChromos) * Math.PI * 2;
          const side = ch.isSister ? 1 : -1;
          const poleDist = 0.08 + progress * 0.04;
          ch.targetX = side * 0.55 + Math.cos(poleAngle) * poleDist;
          ch.targetY = Math.sin(poleAngle) * poleDist;
          ch.targetAngle = poleAngle;
          break;
        }
        case "cytokinesis": {
          const chrIdx = ch.pairIndex * 2 + (ch.isSister ? 1 : 0);
          const poleAngle = (chrIdx / numChromos) * Math.PI * 2;
          const side = ch.isSister ? 1 : -1;
          const poleDist = 0.1;
          const spreadFactor = 1 + progress * 0.35;
          ch.targetX = side * 0.55 * spreadFactor + Math.cos(poleAngle) * poleDist;
          ch.targetY = Math.sin(poleAngle) * poleDist;
          ch.targetAngle = poleAngle;
          break;
        }
      }

      const lerpSpeed = 0.07;
      ch.x = lerp(ch.x, ch.targetX, lerpSpeed);
      ch.y = lerp(ch.y, ch.targetY, lerpSpeed);
      ch.angle = lerp(ch.angle, ch.targetAngle, lerpSpeed);
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawCell(
    cellCx: number, cellCy: number,
    cellRx: number, cellRy: number,
    phase: MitosisPhase, progress: number
  ): void {
    const membraneColor = "rgba(100, 200, 150, 0.25)";
    const membraneStroke = "rgba(100, 200, 150, 0.6)";

    let pinchFactor = 0;
    if (phase === "cytokinesis") {
      pinchFactor = easeInOut(progress) * 0.95;
    } else if (phase === "telophase") {
      pinchFactor = easeInOut(progress) * 0.25;
    }

    ctx.save();

    if (phase === "cytokinesis" || phase === "telophase") {
      // Draw pinching cell as two overlapping ellipses
      const leftCx = cellCx - cellRx * pinchFactor * 0.4;
      const rightCx = cellCx + cellRx * pinchFactor * 0.4;
      const pinchRx = cellRx * (1 - pinchFactor * 0.3);
      const midPinch = cellRy * (1 - pinchFactor * 0.8);

      for (const cx of [leftCx, rightCx]) {
        ctx.beginPath();
        ctx.ellipse(cx, cellCy, pinchRx * 0.7, cellRy, 0, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(cx, cellCy, 0, cx, cellCy, pinchRx);
        grad.addColorStop(0, "rgba(80, 180, 130, 0.12)");
        grad.addColorStop(0.8, "rgba(60, 160, 110, 0.08)");
        grad.addColorStop(1, membraneColor);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = membraneStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Cleavage furrow
      if (pinchFactor > 0.1) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${pinchFactor * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cellCx, cellCy - midPinch);
        ctx.lineTo(cellCx, cellCy + midPinch);
        ctx.stroke();
      }
    } else {
      // Normal cell
      ctx.beginPath();
      ctx.ellipse(cellCx, cellCy, cellRx, cellRy, 0, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(cellCx, cellCy, 0, cellCx, cellCy, Math.max(cellRx, cellRy));
      grad.addColorStop(0, "rgba(80, 180, 130, 0.12)");
      grad.addColorStop(0.7, "rgba(60, 160, 110, 0.08)");
      grad.addColorStop(1, membraneColor);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = membraneStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Nuclear envelope (interphase, early prophase)
    if (phase === "interphase" || (phase === "prophase" && progress < 0.6)) {
      const nucleusAlpha = phase === "interphase" ? 0.4 : 0.4 * (1 - progress / 0.6);
      const nr = Math.min(cellRx, cellRy) * 0.5;

      ctx.beginPath();
      ctx.arc(cellCx, cellCy, nr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(60, 100, 160, ${nucleusAlpha * 0.5})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(100, 150, 220, ${nucleusAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Nucleolus
      ctx.beginPath();
      ctx.arc(cellCx + nr * 0.2, cellCy - nr * 0.15, nr * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(80, 130, 200, ${nucleusAlpha * 0.6})`;
      ctx.fill();
    }

    // Reformed nuclei in telophase
    if (phase === "telophase" && progress > 0.4) {
      const nucleusAlpha = easeInOut((progress - 0.4) / 0.6) * 0.35;
      const nr = Math.min(cellRx, cellRy) * 0.28;
      const offset = cellRx * 0.35;

      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(cellCx + side * offset, cellCy, nr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(60, 100, 160, ${nucleusAlpha * 0.4})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(100, 150, 220, ${nucleusAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawSpindleFibers(
    cellCx: number, cellCy: number,
    cellRx: number, cellRy: number,
    phase: MitosisPhase, progress: number
  ): void {
    if (showSpindle < 0.5) return;
    if (phase !== "prophase" && phase !== "metaphase" && phase !== "anaphase") return;

    let spindleAlpha = 0;
    if (phase === "prophase") {
      spindleAlpha = easeInOut(Math.max(0, (progress - 0.5) * 2)) * 0.25;
    } else if (phase === "metaphase") {
      spindleAlpha = 0.25;
    } else if (phase === "anaphase") {
      spindleAlpha = 0.25 * (1 - progress * 0.7);
    }

    if (spindleAlpha <= 0) return;

    const poleOffset = cellRx * 0.85;

    for (const side of [-1, 1]) {
      const px = cellCx + side * poleOffset;

      // Centriole dot at pole
      ctx.fillStyle = `rgba(200, 200, 255, ${spindleAlpha * 3})`;
      ctx.beginPath();
      ctx.arc(px, cellCy, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Aster (short radiating lines around centriole)
      const asterCount = 12;
      for (let a = 0; a < asterCount; a++) {
        const asterAngle = (a / asterCount) * Math.PI * 2;
        const asterLen = 12 + Math.sin(time * 3 + a) * 3;
        ctx.beginPath();
        ctx.moveTo(px, cellCy);
        ctx.lineTo(
          px + Math.cos(asterAngle) * asterLen,
          cellCy + Math.sin(asterAngle) * asterLen
        );
        ctx.strokeStyle = `rgba(180, 180, 255, ${spindleAlpha * 0.6})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Spindle fibers to chromosomes
      const fiberCount = chromosomePairs * 2;
      for (let f = 0; f < fiberCount; f++) {
        const frac = (f + 0.5) / fiberCount;
        const fy = cellCy + (frac - 0.5) * cellRy * 0.7;

        // In anaphase, fibers go to separated chromatids
        let targetX = cellCx;
        if (phase === "anaphase") {
          targetX = cellCx + side * easeInOut(progress) * cellRx * 0.3;
        }

        ctx.beginPath();
        ctx.moveTo(px, cellCy);
        // Curve through toward target
        const cpx = (px + targetX) / 2;
        const cpy = cellCy + (fy - cellCy) * 0.5;
        ctx.quadraticCurveTo(cpx, cpy, targetX, fy);
        ctx.strokeStyle = `rgba(180, 180, 255, ${spindleAlpha * 0.8})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    // Metaphase plate line
    if (phase === "metaphase") {
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(cellCx, cellCy - cellRy * 0.45);
      ctx.lineTo(cellCx, cellCy + cellRy * 0.45);
      ctx.strokeStyle = `rgba(255, 255, 100, ${spindleAlpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawChromosomes(
    cellCx: number, cellCy: number,
    cellRx: number, cellRy: number,
    phase: MitosisPhase, progress: number
  ): void {
    const chrSize = Math.min(cellRx, cellRy) * 0.065;

    for (const ch of chromosomes) {
      const x = cellCx + ch.x * cellRx;
      const y = cellCy + ch.y * cellRy;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ch.angle);

      // Condensation level
      let condensation = 1;
      if (phase === "interphase") condensation = 0.3;
      else if (phase === "prophase") condensation = 0.3 + easeInOut(progress) * 0.7;
      else if (phase === "telophase") condensation = 1 - easeInOut(progress) * 0.5;
      else if (phase === "cytokinesis") condensation = 0.5;

      const chWidth = chrSize * condensation;
      const chLength = chrSize * (3 - condensation * 1.5);

      if (condensation < 0.5) {
        // Chromatin threads
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = chWidth * 0.4;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        const segs = 6;
        for (let s = 0; s <= segs; s++) {
          const sx = (s / segs - 0.5) * chLength * 2;
          const sy = Math.sin(s * 1.5 + time * 1.8 + ch.pairIndex) * chWidth * 1.5;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.9;

        // Glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, chLength);
        glow.addColorStop(0, ch.color + "44");
        glow.addColorStop(1, ch.color + "00");
        ctx.fillStyle = glow;
        ctx.fillRect(-chLength, -chLength, chLength * 2, chLength * 2);

        // X-shaped chromosome at metaphase (paired sisters shown as X)
        const showX = (phase === "metaphase" || (phase === "prophase" && progress > 0.5)) && !ch.isSister;

        if (showX && chromosomes.some(o => o.pairIndex === ch.pairIndex && o.isSister)) {
          ctx.lineWidth = chWidth;
          ctx.lineCap = "round";
          ctx.strokeStyle = ch.color;

          ctx.beginPath();
          ctx.moveTo(-chLength * 0.6, -chLength * 0.7);
          ctx.lineTo(chLength * 0.6, chLength * 0.7);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(chLength * 0.6, -chLength * 0.7);
          ctx.lineTo(-chLength * 0.6, chLength * 0.7);
          ctx.stroke();

          // Centromere
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.beginPath();
          ctx.arc(0, 0, chWidth * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Single chromatid rod
          ctx.lineWidth = chWidth;
          ctx.lineCap = "round";
          ctx.strokeStyle = ch.color;
          ctx.beginPath();
          ctx.moveTo(0, -chLength * 0.6);
          ctx.lineTo(0, chLength * 0.6);
          ctx.stroke();

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
    const timelineW = width * 0.82;
    const timelineX = (width - timelineW) / 2;
    const fontSize = Math.max(9, Math.min(11, width / 60));

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(timelineX - 10, timelineY - 22, timelineW + 20, 40, 8);
    ctx.fill();

    const segW = timelineW / PHASES.length;
    for (let i = 0; i < PHASES.length; i++) {
      const sx = timelineX + i * segW;
      const isActive = i === phaseIndex;
      const isPast = i < phaseIndex;

      // Active segment fill
      if (isActive) {
        ctx.fillStyle = "rgba(100, 200, 150, 0.3)";
        ctx.fillRect(sx, timelineY - 14, segW * progress, 28);
      }

      // Border
      ctx.strokeStyle = isActive
        ? "rgba(100, 200, 150, 0.6)"
        : isPast
          ? "rgba(100, 200, 150, 0.3)"
          : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, timelineY - 14, segW, 28);

      // Label
      ctx.fillStyle = isActive
        ? "rgba(255, 255, 255, 0.9)"
        : isPast
          ? "rgba(255, 255, 255, 0.5)"
          : "rgba(255, 255, 255, 0.3)";
      ctx.font = `${isActive ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(PHASE_LABELS[PHASES[i]], sx + segW / 2, timelineY);
    }

    // Phase description above timeline
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(PHASE_DESCRIPTIONS[phase], width / 2, timelineY - 28);
  }

  function drawInfoPanel(): void {
    if (showLabels < 0.5) return;

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `bold ${Math.max(12, Math.min(15, width / 45))}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Cell Division Model \u2014 Mitosis", 12, 10);

    // Chromosome info
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${Math.max(10, Math.min(12, width / 55))}px system-ui, sans-serif`;
    ctx.fillText(`${chromosomePairs} chromosome pairs (2n = ${chromosomePairs * 2})`, 12, 30);

    // Time
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "right";
    ctx.fillText(`t = ${time.toFixed(1)}s`, width - 12, 12);

    // Chromosome legend (right side)
    const legendX = width - 16;
    const legendY = height * 0.12;
    const legendFontSize = Math.max(9, Math.min(10, width / 65));
    const lineH = 16;

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = `${legendFontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText("Chromosome Pairs:", legendX, legendY);

    for (let p = 0; p < chromosomePairs; p++) {
      const y = legendY + (p + 1) * lineH;
      const colors = CHROMO_COLORS[p % CHROMO_COLORS.length];

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
    const newPairs = Math.round(params.chromosomePairs ?? 4);
    showLabels = params.showLabels ?? 1;
    showSpindle = params.showSpindle ?? 1;

    if (newPairs !== chromosomePairs || prevPairs === -1) {
      chromosomePairs = newPairs;
      initChromosomes();
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
    const cellCy = height * 0.46;
    const baseR = Math.min(width, height) * 0.27;
    const cellRx = baseR * (
      phase === "anaphase" ? 1 + easeInOut(progress) * 0.3 :
      phase === "telophase" || phase === "cytokinesis" ? 1.3 : 1
    );
    const cellRy = baseR * (
      phase === "anaphase" ? 1 - easeInOut(progress) * 0.1 : 1
    );

    drawCell(cellCx, cellCy, cellRx, cellRy, phase, progress);
    drawSpindleFibers(cellCx, cellCy, cellRx, cellRy, phase, progress);
    drawChromosomes(cellCx, cellCy, cellRx, cellRy, phase, progress);
    drawPhaseTimeline(phase, phaseIndex, progress);
    drawInfoPanel();
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
      `Cell Division Model (Mitosis): Currently in ${PHASE_LABELS[phase]} ` +
      `(${(progress * 100).toFixed(0)}% through phase). ` +
      `${PHASE_DESCRIPTIONS[phase]} ` +
      `${chromosomePairs} chromosome pairs (2n = ${chromosomePairs * 2}). ` +
      `Animation speed: ${speed}x. Spindle fibers: ${showSpindle >= 0.5 ? "visible" : "hidden"}. ` +
      `Mitosis produces two genetically identical daughter cells. ` +
      `Phase sequence: Interphase -> Prophase -> Metaphase -> Anaphase -> Telophase -> Cytokinesis. ` +
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

export default CellDivisionModelFactory;
