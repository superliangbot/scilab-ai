import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HumanGeneTransferFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("human-gene-transfer") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  const TOTAL_PAIRS = 23;
  let displayPairs = 23;
  let animSpeed = 1;
  let childCount = 0;

  interface ChromosomePair {
    fatherColor: string;
    motherColor: string;
    childFromFather: boolean; // true = got father's, false = got mother's
    animated: boolean;
    animProgress: number;
  }

  let pairs: ChromosomePair[] = [];
  let currentAnimating = 0;
  let allDone = false;

  const fatherColors = [
    "#4488cc", "#3377bb", "#5599dd", "#2266aa", "#6699cc",
    "#4477bb", "#5588cc", "#3388dd", "#4499ee", "#2277cc",
    "#5577bb", "#3366aa", "#4488dd", "#5599cc", "#2288bb",
    "#4477cc", "#3399dd", "#5588bb", "#4466aa", "#3377cc",
    "#5599bb", "#4488aa", "#3388cc",
  ];

  const motherColors = [
    "#cc4488", "#bb3377", "#dd5599", "#aa2266", "#cc6699",
    "#bb4477", "#cc5588", "#dd3388", "#ee4499", "#cc2277",
    "#bb5577", "#aa3366", "#dd4488", "#cc5599", "#bb2288",
    "#cc4477", "#dd3399", "#bb5588", "#aa4466", "#cc3377",
    "#bb5599", "#aa4488", "#cc3388",
  ];

  function generateChild() {
    pairs = [];
    for (let i = 0; i < TOTAL_PAIRS; i++) {
      pairs.push({
        fatherColor: fatherColors[i % fatherColors.length],
        motherColor: motherColors[i % motherColors.length],
        childFromFather: Math.random() < 0.5,
        animated: false,
        animProgress: 0,
      });
    }
    currentAnimating = 0;
    allDone = false;
    childCount++;
  }

  function drawChromosome(x: number, y: number, w: number, h: number, color: string, label?: string) {
    // Chromosome shape - rounded rectangle with slight pinch in middle
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, lightenColor(color, 30));
    grad.addColorStop(1, color);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h * 0.45, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x, y + h * 0.55, w, h * 0.45, 3);
    ctx.fill();

    // Centromere connection
    ctx.fillStyle = color;
    ctx.fillRect(x + w * 0.3, y + h * 0.4, w * 0.4, h * 0.2);

    if (label) {
      ctx.fillStyle = "#fff";
      ctx.font = "8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x + w / 2, y + h / 2 + 3);
    }
  }

  function lightenColor(hex: string, amount: number): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `rgb(${r},${g},${b})`;
  }

  function drawPerson(cx: number, cy: number, gender: "male" | "female" | "child", label: string) {
    // Head
    ctx.fillStyle = gender === "male" ? "#4488cc" : gender === "female" ? "#cc4488" : "#88cc44";
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 15);
    ctx.lineTo(cx, cy + 40);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy + 25);
    ctx.lineTo(cx + 15, cy + 25);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(cx, cy + 40);
    ctx.lineTo(cx - 10, cy + 55);
    ctx.moveTo(cx, cy + 40);
    ctx.lineTo(cx + 10, cy + 55);
    ctx.stroke();

    // Gender symbol
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(gender === "male" ? "♂" : gender === "female" ? "♀" : "♀♂", cx, cy + 5);

    // Label
    ctx.fillStyle = "#aaa";
    ctx.font = "11px sans-serif";
    ctx.fillText(label, cx, cy + 70);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      generateChild();
    },

    update(dt: number, params: Record<string, number>) {
      displayPairs = Math.round(params.displayPairs ?? 23);
      animSpeed = params.animSpeed ?? 1;

      if (!allDone && pairs.length > 0) {
        if (currentAnimating < pairs.length) {
          const pair = pairs[currentAnimating];
          pair.animated = true;
          pair.animProgress += dt * animSpeed * 2;
          if (pair.animProgress >= 1) {
            pair.animProgress = 1;
            currentAnimating++;
            if (currentAnimating >= pairs.length) {
              allDone = true;
            }
          }
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
      ctx.fillText("Human Chromosome Inheritance", width / 2, 28);

      // Parents
      const fatherX = width * 0.2;
      const motherX = width * 0.8;
      const parentY = 55;

      drawPerson(fatherX, parentY, "male", "Father");
      drawPerson(motherX, parentY, "female", "Mother");

      // Child
      const childX = width / 2;
      const childY = height * 0.55;
      drawPerson(childX, childY, "child", `Child #${childCount}`);

      // Chromosome display area
      const chromY = parentY + 85;
      const chromH = 22;
      const chromW = 10;
      const pairsToShow = Math.min(displayPairs, TOTAL_PAIRS);
      const spacing = Math.min(25, (width * 0.35) / pairsToShow);

      // Father's chromosomes
      const fStartX = fatherX - (pairsToShow * spacing) / 2;
      ctx.fillStyle = "#4488cc";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Father's chromosomes", fatherX, chromY - 8);

      for (let i = 0; i < pairsToShow; i++) {
        const x = fStartX + i * spacing;
        drawChromosome(x, chromY, chromW, chromH, pairs[i].fatherColor);
      }

      // Mother's chromosomes
      const mStartX = motherX - (pairsToShow * spacing) / 2;
      ctx.fillStyle = "#cc4488";
      ctx.font = "10px sans-serif";
      ctx.fillText("Mother's chromosomes", motherX, chromY - 8);

      for (let i = 0; i < pairsToShow; i++) {
        const x = mStartX + i * spacing;
        drawChromosome(x, chromY, chromW, chromH, pairs[i].motherColor);
      }

      // Child's chromosomes with animation
      const cStartX = childX - (pairsToShow * spacing) / 2;
      const childChromY = childY + 75;
      ctx.fillStyle = "#88cc44";
      ctx.font = "10px sans-serif";
      ctx.fillText("Child's chromosomes", childX, childChromY - 8);

      for (let i = 0; i < pairsToShow; i++) {
        const pair = pairs[i];
        if (pair.animated) {
          const targetX = cStartX + i * spacing;
          const targetY = childChromY;
          const color = pair.childFromFather ? pair.fatherColor : pair.motherColor;

          if (pair.animProgress < 1) {
            // Animate from parent to child
            const sourceX = pair.childFromFather
              ? fStartX + i * spacing
              : mStartX + i * spacing;
            const sourceY = chromY;

            const cx = sourceX + (targetX - sourceX) * pair.animProgress;
            const cy = sourceY + (targetY - sourceY) * pair.animProgress;
            const alpha = 0.3 + 0.7 * pair.animProgress;

            ctx.globalAlpha = alpha;
            drawChromosome(cx, cy, chromW, chromH, color);
            ctx.globalAlpha = 1;
          } else {
            drawChromosome(targetX, targetY, chromW, chromH, color);
          }

          // Highlight source
          if (pair.animProgress < 1) {
            const sourceX = pair.childFromFather
              ? fStartX + i * spacing
              : mStartX + i * spacing;
            ctx.strokeStyle = "#ffff00";
            ctx.lineWidth = 2;
            ctx.strokeRect(sourceX - 1, chromY - 1, chromW + 2, chromH + 2);
          }
        }
      }

      // Arrows from parents to child
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(fatherX, parentY + 75);
      ctx.lineTo(childX, childY - 25);
      ctx.moveTo(motherX, parentY + 75);
      ctx.lineTo(childX, childY - 25);
      ctx.stroke();
      ctx.setLineDash([]);

      // Statistics
      if (allDone) {
        const fromFather = pairs.filter((p) => p.childFromFather).length;
        const fromMother = TOTAL_PAIRS - fromFather;

        ctx.fillStyle = "rgba(10,15,30,0.85)";
        ctx.strokeStyle = "rgba(100,200,100,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(width / 2 - 120, height - 80, 240, 65, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`From Father: ${fromFather}  |  From Mother: ${fromMother}`, width / 2, height - 55);
        ctx.fillStyle = "#889";
        ctx.font = "11px monospace";
        ctx.fillText(`Possible combinations: 2²³ × 2²³`, width / 2, height - 38);
        ctx.fillText(`= 70,368,744,177,664`, width / 2, height - 23);
      }

      // Progress
      if (!allDone) {
        ctx.fillStyle = "#667";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Transferring pair ${currentAnimating + 1} of ${TOTAL_PAIRS}...`, width / 2, height - 15);
      }
    },

    reset() {
      time = 0;
      generateChild();
    },

    destroy() {
      pairs = [];
    },

    getStateDescription() {
      const fromFather = pairs.filter((p) => p.childFromFather).length;
      return `Human gene transfer: Child #${childCount} inherits ${fromFather} chromosomes from father and ${TOTAL_PAIRS - fromFather} from mother (of ${TOTAL_PAIRS} pairs). Animation progress: ${currentAnimating}/${TOTAL_PAIRS}. Total possible combinations: 2^23 × 2^23 ≈ 70.4 trillion.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HumanGeneTransferFactory;
