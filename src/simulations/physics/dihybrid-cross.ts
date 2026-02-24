import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Offspring {
  genotype: string;
  phenotype: string;
  color: string;
  shape: string;
}

const DihybridCrossFactory = (): SimulationEngine => {
  const config = getSimConfig("dihybrid-cross") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};
  let offspring: Offspring[][] = [];

  // Alleles: R=round(dom), r=wrinkled(rec), Y=yellow(dom), y=green(rec)
  function getGametes(allele1: number, allele2: number): string[] {
    // allele1: 0=RR, 1=Rr, 2=rr
    // allele2: 0=YY, 1=Yy, 2=yy
    const shape = allele1 === 0 ? ["R", "R"] : allele1 === 1 ? ["R", "r"] : ["r", "r"];
    const color = allele2 === 0 ? ["Y", "Y"] : allele2 === 1 ? ["Y", "y"] : ["y", "y"];

    const gametes: string[] = [];
    for (const s of shape) {
      for (const c of color) {
        gametes.push(s + c);
      }
    }
    // Return unique gametes
    return [...new Set(gametes)];
  }

  function cross(g1: string, g2: string): Offspring {
    // g1 and g2 are gametes like "RY", "ry", etc.
    const s1 = g1[0], c1 = g1[1];
    const s2 = g2[0], c2 = g2[1];

    // Sort alleles (uppercase first)
    const shapeGeno = [s1, s2].sort().join("");
    const colorGeno = [c1, c2].sort().join("");
    const genotype = shapeGeno + colorGeno;

    const isRound = s1 === "R" || s2 === "R";
    const isYellow = c1 === "Y" || c2 === "Y";

    return {
      genotype,
      phenotype: `${isRound ? "Round" : "Wrinkled"} ${isYellow ? "Yellow" : "Green"}`,
      color: isYellow ? "#eab308" : "#22c55e",
      shape: isRound ? "round" : "wrinkled",
    };
  }

  function computeCross(): void {
    const allele1 = Math.round(currentParams.shapeAllele ?? 1);
    const allele2 = Math.round(currentParams.colorAllele ?? 1);

    const gametes1 = getGametes(allele1, allele2);
    const gametes2 = getGametes(allele1, allele2);

    offspring = [];
    for (const g1 of gametes1) {
      const row: Offspring[] = [];
      for (const g2 of gametes2) {
        row.push(cross(g1, g2));
      }
      offspring.push(row);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    computeCross();
  }

  function update(dt: number, params: Record<string, number>): void {
    const oldShape = Math.round(currentParams.shapeAllele ?? 1);
    const oldColor = Math.round(currentParams.colorAllele ?? 1);
    currentParams = params;
    const newShape = Math.round(params.shapeAllele ?? 1);
    const newColor = Math.round(params.colorAllele ?? 1);

    if (oldShape !== newShape || oldColor !== newColor) {
      computeCross();
    }
    time += dt;
  }

  function drawSeed(cx: number, cy: number, r: number, color: string, shape: string): void {
    ctx.fillStyle = color;
    if (shape === "round") {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#00000044";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Wrinkled - irregular shape
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const wobble = r * (0.7 + 0.3 * Math.sin(a * 5));
        const x = cx + wobble * Math.cos(a);
        const y = cy + wobble * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#00000044";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const allele1 = Math.round(currentParams.shapeAllele ?? 1);
    const allele2 = Math.round(currentParams.colorAllele ?? 1);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Dihybrid Cross — Mendel's Pea Plants", width / 2, 28);

    const shapeLabels = ["RR", "Rr", "rr"];
    const colorLabels = ["YY", "Yy", "yy"];
    const gametes = getGametes(allele1, allele2);
    const gridSize = gametes.length;

    // Parent genotype
    const parentGeno = `${shapeLabels[allele1]}${colorLabels[allele2]}`;
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`Parent genotype: ${parentGeno} × ${parentGeno}`, width / 2, 50);
    ctx.fillText(`Gametes: ${gametes.join(", ")}`, width / 2, 68);

    // Punnett square
    const margin = 30;
    const headerSize = 50;
    const availW = width - margin * 2 - headerSize;
    const availH = height - 120 - headerSize;
    const cellSize = Math.min(availW / gridSize, availH / gridSize, 120);
    const gridW = cellSize * gridSize;
    const gridH = cellSize * gridSize;
    const startX = (width - gridW - headerSize) / 2 + headerSize;
    const startY = 85 + headerSize;

    // Header labels (gametes)
    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${Math.max(12, Math.min(cellSize * 0.3, 18))}px monospace`;
    ctx.textAlign = "center";

    // Column headers
    for (let j = 0; j < gridSize; j++) {
      ctx.fillText(gametes[j], startX + j * cellSize + cellSize / 2, startY - 15);
    }

    // Row headers
    ctx.textAlign = "right";
    for (let i = 0; i < gridSize; i++) {
      ctx.fillText(gametes[i], startX - 10, startY + i * cellSize + cellSize / 2 + 5);
    }

    // Label axes
    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("♀ Gametes →", startX + gridW / 2, startY - 35);
    ctx.save();
    ctx.translate(startX - 40, startY + gridH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("♂ Gametes →", 0, 0);
    ctx.restore();

    // Grid cells
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = startX + j * cellSize;
        const y = startY + i * cellSize;
        const off = offspring[i]?.[j];
        if (!off) continue;

        // Cell background
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Seed drawing
        const seedR = Math.min(cellSize * 0.18, 15);
        drawSeed(x + cellSize / 2, y + cellSize * 0.4, seedR, off.color, off.shape);

        // Genotype label
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `${Math.max(9, Math.min(cellSize * 0.18, 12))}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(off.genotype, x + cellSize / 2, y + cellSize * 0.75);
      }
    }

    // Phenotype ratio summary
    const phenoCounts: Record<string, number> = {};
    for (const row of offspring) {
      for (const off of row) {
        phenoCounts[off.phenotype] = (phenoCounts[off.phenotype] || 0) + 1;
      }
    }

    const total = gridSize * gridSize;
    const summaryY = startY + gridH + 20;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Phenotype Ratios:", margin + 10, summaryY);

    let idx = 0;
    const sortedPhenos = Object.entries(phenoCounts).sort((a, b) => b[1] - a[1]);
    for (const [pheno, count] of sortedPhenos) {
      const isYellow = pheno.includes("Yellow");
      const isRound = pheno.includes("Round");
      const y = summaryY + 20 + idx * 22;

      // Draw mini seed
      drawSeed(margin + 25, y - 4, 6, isYellow ? "#eab308" : "#22c55e", isRound ? "round" : "wrinkled");

      ctx.fillStyle = "#e2e8f0";
      ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`${pheno}: ${count}/${total}`, margin + 40, y);
      idx++;
    }

    // Expected ratio for RrYy x RrYy
    if (allele1 === 1 && allele2 === 1) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("Expected ratio: 9:3:3:1", margin + 10, summaryY + 20 + idx * 22 + 5);
    }
  }

  function reset(): void {
    time = 0;
    currentParams = {};
    offspring = [];
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const allele1 = Math.round(currentParams.shapeAllele ?? 1);
    const allele2 = Math.round(currentParams.colorAllele ?? 1);
    const shapeLabels = ["RR", "Rr", "rr"];
    const colorLabels = ["YY", "Yy", "yy"];
    const parentGeno = `${shapeLabels[allele1]}${colorLabels[allele2]}`;

    const phenoCounts: Record<string, number> = {};
    for (const row of offspring) {
      for (const off of row) {
        phenoCounts[off.phenotype] = (phenoCounts[off.phenotype] || 0) + 1;
      }
    }
    const total = offspring.length * (offspring[0]?.length || 0);
    const ratios = Object.entries(phenoCounts).map(([p, c]) => `${p}: ${c}/${total}`).join(", ");

    return `Dihybrid cross: ${parentGeno} × ${parentGeno}. Offspring phenotype ratios: ${ratios}. Mendel's Law of Independent Assortment states that genes for different traits segregate independently during gamete formation. For a heterozygous cross (RrYy × RrYy), the expected ratio is 9 round yellow : 3 round green : 3 wrinkled yellow : 1 wrinkled green. R=round (dominant), r=wrinkled, Y=yellow (dominant), y=green.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DihybridCrossFactory;
