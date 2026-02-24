import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// Genotype mappings: index -> allele pair
const GENOTYPES: [string, string][] = [
  ["A", "A"], // 0 = AA
  ["A", "O"], // 1 = AO
  ["B", "B"], // 2 = BB
  ["B", "O"], // 3 = BO
  ["O", "O"], // 4 = OO
  ["A", "B"], // 5 = AB
];

const GENOTYPE_LABELS = ["AA", "AO", "BB", "BO", "OO", "AB"];

function getPhenotype(a1: string, a2: string): string {
  const alleles = [a1, a2].sort().join("");
  if (alleles === "AA" || alleles === "AO") return "Type A";
  if (alleles === "BB" || alleles === "BO") return "Type B";
  if (alleles === "AB") return "Type AB";
  if (alleles === "OO") return "Type O";
  return "Unknown";
}

function getGenotypeLabel(a1: string, a2: string): string {
  return [a1, a2].sort().join("");
}

function getPhenotypeColor(phenotype: string): string {
  switch (phenotype) {
    case "Type A": return "#e74c3c";  // red
    case "Type B": return "#3498db";  // blue
    case "Type AB": return "#9b59b6"; // purple
    case "Type O": return "#f1c40f";  // yellow
    default: return "#888";
  }
}

function getAlleleColor(allele: string): string {
  switch (allele) {
    case "A": return "#e74c3c";
    case "B": return "#3498db";
    case "O": return "#f1c40f";
    default: return "#888";
  }
}

const ABOBloodTypeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("abo-blood-type") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let parent1Index = 1;
  let parent2Index = 3;
  let animationSpeed = 1;

  // Animation phases:
  // 0: Show parents (0-1s)
  // 1: Allele separation (1-2.5s)
  // 2: Alleles drop into Punnett squares (2.5-4s)
  // 3: Reveal offspring results (4-5s)
  // 4: Show probabilities (5s+)
  function getPhase(): number {
    const t = time * animationSpeed;
    if (t < 1.0) return 0;
    if (t < 2.5) return 1;
    if (t < 4.0) return 2;
    if (t < 5.0) return 3;
    return 4;
  }

  function getPhaseProgress(): number {
    const t = time * animationSpeed;
    if (t < 1.0) return t / 1.0;
    if (t < 2.5) return (t - 1.0) / 1.5;
    if (t < 4.0) return (t - 2.5) / 1.5;
    if (t < 5.0) return (t - 4.0) / 1.0;
    return 1;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    parent1Index = Math.round(params.parent1 ?? 1);
    parent2Index = Math.round(params.parent2 ?? 3);
    animationSpeed = params.animationSpeed ?? 1;
    time += dt;
  }

  function easeOut(t: number): number {
    return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  }

  function easeInOut(t: number): number {
    const clamped = Math.min(1, Math.max(0, t));
    return clamped < 0.5
      ? 4 * clamped * clamped * clamped
      : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }

  function drawRoundedRect(
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawAlleleCircle(
    x: number, y: number, radius: number, allele: string, alpha: number = 1
  ): void {
    const color = getAlleleColor(allele);
    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
    glow.addColorStop(0, color + "44");
    glow.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Circle
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color + "cc");
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Letter
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(radius * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(allele, x, y + 1);

    ctx.restore();
  }

  function drawBloodTypeCircle(
    x: number, y: number, radius: number,
    a1: string, a2: string, alpha: number = 1
  ): void {
    const phenotype = getPhenotype(a1, a2);
    const color = getPhenotypeColor(phenotype);
    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.8);
    glow.addColorStop(0, color + "55");
    glow.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Main circle
    const grad = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.25, 0, x, y, radius);
    grad.addColorStop(0, "#ffffff88");
    grad.addColorStop(0.2, color);
    grad.addColorStop(1, color + "aa");
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Genotype label inside circle
    const genotypeLabel = getGenotypeLabel(a1, a2);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(radius * 0.65)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(genotypeLabel, x, y - radius * 0.15);

    // Phenotype below genotype
    ctx.font = `${Math.round(radius * 0.4)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(phenotype, x, y + radius * 0.35);

    ctx.restore();
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const phase = getPhase();
    const progress = getPhaseProgress();

    const p1 = GENOTYPES[parent1Index];
    const p2 = GENOTYPES[parent2Index];

    // Layout metrics
    const scale = Math.min(width / 700, height / 600);
    const centerX = width / 2;

    // Parent positions
    const parentY = height * 0.1;
    const parent1X = centerX - width * 0.2;
    const parent2X = centerX + width * 0.2;
    const parentCircleR = 28 * scale;

    // Punnett square position
    const punnettCenterX = centerX;
    const punnettCenterY = height * 0.52;
    const cellSize = Math.min(85 * scale, width * 0.14);
    const gridGap = 6 * scale;
    const totalGridW = cellSize * 2 + gridGap;
    const totalGridH = cellSize * 2 + gridGap;
    const gridLeft = punnettCenterX - totalGridW / 2;
    const gridTop = punnettCenterY - totalGridH / 2;

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.round(11 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("ABO Blood Type Inheritance", centerX, height * 0.035);

    // ====== PHASE 0+: Draw parents ======
    const parentAlpha = phase >= 0 ? easeOut(progress) : 1;

    // Parent 1 box
    const boxW = 130 * scale;
    const boxH = 60 * scale;

    ctx.save();
    ctx.globalAlpha = phase === 0 ? parentAlpha : 1;

    // Parent 1 panel
    drawRoundedRect(parent1X - boxW / 2, parentY - boxH / 2, boxW, boxH, 10 * scale);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.round(10 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Parent 1", parent1X, parentY - boxH / 2 + 14 * scale);

    // Parent 1 alleles side by side
    const alleleSmallR = 14 * scale;
    const alleleGap = 22 * scale;
    drawAlleleCircle(parent1X - alleleGap, parentY + 6 * scale, alleleSmallR, p1[0]);
    drawAlleleCircle(parent1X + alleleGap, parentY + 6 * scale, alleleSmallR, p1[1]);

    // Parent 2 panel
    drawRoundedRect(parent2X - boxW / 2, parentY - boxH / 2, boxW, boxH, 10 * scale);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.round(10 * scale)}px system-ui, sans-serif`;
    ctx.fillText("Parent 2", parent2X, parentY - boxH / 2 + 14 * scale);

    drawAlleleCircle(parent2X - alleleGap, parentY + 6 * scale, alleleSmallR, p2[0]);
    drawAlleleCircle(parent2X + alleleGap, parentY + 6 * scale, alleleSmallR, p2[1]);

    ctx.restore();

    // ====== PHASE 1+: Allele separation lines ======
    if (phase >= 1) {
      const sepProgress = phase === 1 ? easeInOut(progress) : 1;
      ctx.save();
      ctx.globalAlpha = sepProgress;

      // Labels for rows and columns of Punnett square
      // Parent 1's alleles label the rows (left side)
      // Parent 2's alleles label the columns (top)

      // Column headers (Parent 2 alleles) - positioned above Punnett grid
      const headerY = gridTop - 14 * scale;
      const headerR = 13 * scale;

      // Lines from parent 2 to column headers
      for (let c = 0; c < 2; c++) {
        const colX = gridLeft + c * (cellSize + gridGap) + cellSize / 2;
        const startX = parent2X + (c === 0 ? -alleleGap : alleleGap);
        const startY = parentY + boxH / 2;

        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(
          startX + (colX - startX) * sepProgress,
          startY + (headerY - headerR - startY) * sepProgress
        );
        ctx.lineTo(startX, startY);
        ctx.strokeStyle = getAlleleColor(p2[c]) + "66";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
        ctx.setLineDash([]);

        drawAlleleCircle(
          startX + (colX - startX) * sepProgress,
          startY + (headerY - startY) * sepProgress,
          headerR * sepProgress,
          p2[c],
          sepProgress
        );
      }

      // Row headers (Parent 1 alleles) - positioned to left of Punnett grid
      const headerX = gridLeft - 14 * scale;

      for (let r = 0; r < 2; r++) {
        const rowY = gridTop + r * (cellSize + gridGap) + cellSize / 2;
        const startX = parent1X + (r === 0 ? -alleleGap : alleleGap);
        const startY = parentY + boxH / 2;

        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(
          startX + (headerX - startX) * sepProgress,
          startY + (rowY - startY) * sepProgress
        );
        ctx.lineTo(startX, startY);
        ctx.strokeStyle = getAlleleColor(p1[r]) + "66";
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
        ctx.setLineDash([]);

        drawAlleleCircle(
          startX + (headerX - startX) * sepProgress,
          startY + (rowY - startY) * sepProgress,
          headerR * sepProgress,
          p1[r],
          sepProgress
        );
      }

      ctx.restore();
    }

    // ====== PHASE 2+: Punnett square grid ======
    if (phase >= 2) {
      const gridAlpha = phase === 2 ? easeOut(progress) : 1;
      ctx.save();
      ctx.globalAlpha = gridAlpha;

      // Draw the four cells
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const cellX = gridLeft + c * (cellSize + gridGap);
          const cellY = gridTop + r * (cellSize + gridGap);

          drawRoundedRect(cellX, cellY, cellSize, cellSize, 8 * scale);
          ctx.fillStyle = "rgba(255,255,255,0.04)";
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // The offspring genotype: row allele from parent1, col allele from parent2
          const a1 = p1[r];
          const a2 = p2[c];

          // Animate alleles dropping in
          if (phase === 2) {
            // Show small alleles moving into position
            const dropProgress = easeOut(Math.max(0, progress * 2 - (r * 0.3 + c * 0.3)));
            const miniR = 9 * scale;
            const cx = cellX + cellSize / 2;
            const cy = cellY + cellSize / 2;

            drawAlleleCircle(
              cx - 10 * scale, cy,
              miniR * dropProgress, a1, dropProgress
            );
            drawAlleleCircle(
              cx + 10 * scale, cy,
              miniR * dropProgress, a2, dropProgress
            );
          }
        }
      }

      // Redraw the settled column/row header alleles
      const headerY2 = gridTop - 14 * scale;
      const headerR2 = 13 * scale;
      for (let c = 0; c < 2; c++) {
        const colX = gridLeft + c * (cellSize + gridGap) + cellSize / 2;
        drawAlleleCircle(colX, headerY2, headerR2, p2[c]);
      }
      const headerX2 = gridLeft - 14 * scale;
      for (let r = 0; r < 2; r++) {
        const rowY = gridTop + r * (cellSize + gridGap) + cellSize / 2;
        drawAlleleCircle(headerX2, rowY, headerR2, p1[r]);
      }

      ctx.restore();
    }

    // ====== PHASE 3+: Reveal offspring blood type circles ======
    if (phase >= 3) {
      const revealProgress = phase === 3 ? easeOut(progress) : 1;

      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const cellX = gridLeft + c * (cellSize + gridGap);
          const cellY = gridTop + r * (cellSize + gridGap);
          const cx = cellX + cellSize / 2;
          const cy = cellY + cellSize / 2;

          const a1 = p1[r];
          const a2 = p2[c];

          const delay = (r * 2 + c) * 0.15;
          const thisProgress = easeOut(Math.max(0, (revealProgress - delay) / (1 - delay)));

          const circleR = (cellSize * 0.38) * thisProgress;
          drawBloodTypeCircle(cx, cy, circleR, a1, a2, thisProgress);
        }
      }
    }

    // ====== PHASE 4: Show probabilities ======
    if (phase >= 4) {
      const probAlpha = easeOut(getPhaseProgress());

      // Calculate probabilities
      const outcomes: Record<string, number> = {};
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const phenotype = getPhenotype(p1[r], p2[c]);
          outcomes[phenotype] = (outcomes[phenotype] || 0) + 1;
        }
      }

      const probY = punnettCenterY + totalGridH / 2 + 35 * scale;
      const probTypes = ["Type A", "Type B", "Type AB", "Type O"];
      const activeTypes = probTypes.filter((t) => outcomes[t]);
      const totalActive = activeTypes.length;
      const spacing = Math.min(130 * scale, (width * 0.8) / Math.max(totalActive, 1));
      const startX = centerX - ((totalActive - 1) * spacing) / 2;

      ctx.save();
      ctx.globalAlpha = probAlpha;

      // Probability section background
      const probBoxW = totalActive * spacing + 40 * scale;
      const probBoxH = 70 * scale;
      drawRoundedRect(
        centerX - probBoxW / 2, probY - 12 * scale,
        probBoxW, probBoxH, 10 * scale
      );
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Title
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = `${Math.round(10 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Offspring Probabilities", centerX, probY);

      activeTypes.forEach((type, i) => {
        const x = startX + i * spacing;
        const y = probY + 22 * scale;
        const pct = ((outcomes[type] / 4) * 100).toFixed(0);
        const color = getPhenotypeColor(type);

        // Small colored dot
        ctx.beginPath();
        ctx.arc(x, y, 6 * scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Percentage
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.round(16 * scale)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${pct}%`, x, y + 22 * scale);

        // Type label
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = `${Math.round(10 * scale)}px system-ui, sans-serif`;
        ctx.fillText(type, x, y + 36 * scale);
      });

      ctx.restore();
    }

    // Cross symbol between parents
    if (phase >= 0) {
      const crossAlpha = phase === 0 ? easeOut(progress) : 1;
      ctx.save();
      ctx.globalAlpha = crossAlpha * 0.6;
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(18 * scale)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("\u00D7", centerX, parentY + 4 * scale);
      ctx.restore();
    }

    // Time indicator
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.round(10 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 8, height - 6);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const p1 = GENOTYPES[parent1Index];
    const p2 = GENOTYPES[parent2Index];
    const p1Label = GENOTYPE_LABELS[parent1Index];
    const p2Label = GENOTYPE_LABELS[parent2Index];
    const p1Pheno = getPhenotype(p1[0], p1[1]);
    const p2Pheno = getPhenotype(p2[0], p2[1]);

    const outcomes: Record<string, number> = {};
    const offspringDetails: string[] = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const a1 = p1[r];
        const a2 = p2[c];
        const geno = getGenotypeLabel(a1, a2);
        const pheno = getPhenotype(a1, a2);
        offspringDetails.push(`${geno} (${pheno})`);
        outcomes[pheno] = (outcomes[pheno] || 0) + 1;
      }
    }

    const probStr = Object.entries(outcomes)
      .map(([type, count]) => `${type}: ${((count / 4) * 100).toFixed(0)}%`)
      .join(", ");

    return (
      `ABO Blood Type Cross: Parent 1 = ${p1Label} (${p1Pheno}), ` +
      `Parent 2 = ${p2Label} (${p2Pheno}). ` +
      `Offspring: ${offspringDetails.join(", ")}. ` +
      `Probabilities: ${probStr}. ` +
      `A and B are codominant; both dominant over O. ` +
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

export default ABOBloodTypeFactory;
