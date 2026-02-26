import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const geneticsPunnettSquareFactory: SimulationFactory = () => {
  const config = getSimConfig("genetics-punnett-square")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let traitType = 0;
  let dominancePattern = 0;
  let parentA_allele1 = 0;
  let parentA_allele2 = 1;

  // parentB always Bb for simplicity; allele2 from parentA also used for parentB
  const traitNames = ["Flower Color", "Seed Shape", "Plant Height", "Fur Color"];
  const dominanceNames = ["Complete Dominance", "Incomplete Dominance", "Codominance"];

  interface Allele { symbol: string; color: string; }
  const dominant: Allele = { symbol: "A", color: "#ef4444" };
  const recessive: Allele = { symbol: "a", color: "#3b82f6" };

  function parentAGenotype(): [number, number] {
    return [parentA_allele1, parentA_allele2];
  }

  function parentBGenotype(): [number, number] {
    // Always heterozygous for interesting results
    return [0, 1];
  }

  function alleleSymbol(val: number): string {
    return val === 0 ? dominant.symbol : recessive.symbol;
  }

  function alleleColor(val: number): string {
    return val === 0 ? dominant.color : recessive.color;
  }

  function phenotypeColor(a1: number, a2: number): string {
    const dom = a1 === 0 || a2 === 0;
    const homo_dom = a1 === 0 && a2 === 0;
    const homo_rec = a1 === 1 && a2 === 1;

    switch (dominancePattern) {
      case 0: // Complete dominance
        return dom ? "#ef4444" : "#3b82f6";
      case 1: // Incomplete dominance
        if (homo_dom) return "#ef4444";
        if (homo_rec) return "#3b82f6";
        return "#c084fc"; // blend
      case 2: // Codominance
        if (homo_dom) return "#ef4444";
        if (homo_rec) return "#3b82f6";
        return "#f59e0b"; // both expressed
      default:
        return "#94a3b8";
    }
  }

  function phenotypeLabel(a1: number, a2: number): string {
    const homo_dom = a1 === 0 && a2 === 0;
    const homo_rec = a1 === 1 && a2 === 1;
    const hetero = !homo_dom && !homo_rec;

    const traitDom = ["Red", "Round", "Tall", "Black"][traitType];
    const traitRec = ["White", "Wrinkled", "Short", "White"][traitType];
    const traitBlend = ["Pink", "Semi-round", "Medium", "Gray"][traitType];
    const traitCo = ["Red+White", "Round+Wrinkled", "Tall+Short", "Black+White"][traitType];

    switch (dominancePattern) {
      case 0: return (homo_dom || hetero) ? traitDom : traitRec;
      case 1: return homo_dom ? traitDom : homo_rec ? traitRec : traitBlend;
      case 2: return homo_dom ? traitDom : homo_rec ? traitRec : traitCo;
      default: return "?";
    }
  }

  function getPunnettResults(): { genotype: [number, number]; count: number }[] {
    const pA = parentAGenotype();
    const pB = parentBGenotype();
    const results: [number, number][] = [];
    for (const a of pA) {
      for (const b of pB) {
        results.push([Math.min(a, b), Math.max(a, b)]);
      }
    }
    return results.map(r => ({ genotype: r, count: 1 }));
  }

  function drawParentInfo(label: string, genotype: [number, number], x: number, y: number) {
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y);

    const g1 = alleleSymbol(genotype[0]);
    const g2 = alleleSymbol(genotype[1]);

    ctx.font = "bold 20px monospace";
    ctx.fillStyle = alleleColor(genotype[0]);
    ctx.fillText(g1, x - 12, y + 25);
    ctx.fillStyle = alleleColor(genotype[1]);
    ctx.fillText(g2, x + 12, y + 25);

    // Phenotype circle
    const pColor = phenotypeColor(genotype[0], genotype[1]);
    ctx.beginPath();
    ctx.arc(x, y + 45, 12, 0, Math.PI * 2);
    ctx.fillStyle = pColor;
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "10px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(phenotypeLabel(genotype[0], genotype[1]), x, y + 66);
  }

  function drawPunnettSquare() {
    const pA = parentAGenotype();
    const pB = parentBGenotype();
    const sqSize = Math.min(W * 0.12, H * 0.12);
    const startX = W * 0.3;
    const startY = H * 0.28;

    // Header
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Punnett Square", startX + sqSize, startY - 25);

    // Parent B alleles (top)
    for (let j = 0; j < 2; j++) {
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = alleleColor(pB[j]);
      ctx.textAlign = "center";
      ctx.fillText(alleleSymbol(pB[j]), startX + sqSize * (j + 0.5) + sqSize * 0.5, startY - 5);
    }

    // Parent A alleles (left)
    for (let i = 0; i < 2; i++) {
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = alleleColor(pA[i]);
      ctx.textAlign = "center";
      ctx.fillText(alleleSymbol(pA[i]), startX - 5, startY + sqSize * (i + 0.5) + 6);
    }

    // Grid
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const cx = startX + sqSize * j + sqSize * 0.5;
        const cy = startY + sqSize * i;
        const a1 = Math.min(pA[i], pB[j]);
        const a2 = Math.max(pA[i], pB[j]);

        // Cell background
        ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.fillRect(cx - sqSize * 0.5, cy, sqSize, sqSize);
        ctx.strokeRect(cx - sqSize * 0.5, cy, sqSize, sqSize);

        // Genotype
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = alleleColor(a1);
        ctx.textAlign = "center";
        ctx.fillText(alleleSymbol(a1), cx - 8, cy + sqSize * 0.4);
        ctx.fillStyle = alleleColor(a2);
        ctx.fillText(alleleSymbol(a2), cx + 8, cy + sqSize * 0.4);

        // Phenotype dot
        ctx.beginPath();
        ctx.arc(cx, cy + sqSize * 0.7, 8, 0, Math.PI * 2);
        ctx.fillStyle = phenotypeColor(a1, a2);
        ctx.fill();
      }
    }
  }

  function drawRatios() {
    const results = getPunnettResults();
    const px = W * 0.6, py = H * 0.28, pw = W * 0.36, ph = H * 0.35;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Offspring Ratios", px + 10, py + 22);

    // Count genotypes
    const counts: Record<string, number> = {};
    const phenoCounts: Record<string, number> = {};
    for (const r of results) {
      const key = `${alleleSymbol(r.genotype[0])}${alleleSymbol(r.genotype[1])}`;
      counts[key] = (counts[key] || 0) + 1;
      const pLabel = phenotypeLabel(r.genotype[0], r.genotype[1]);
      phenoCounts[pLabel] = (phenoCounts[pLabel] || 0) + 1;
    }

    ctx.font = "13px Arial";
    let y = py + 45;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Genotype Ratio:", px + 10, y);
    y += 20;
    for (const [geno, count] of Object.entries(counts)) {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 14px monospace";
      ctx.fillText(geno, px + 15, y);
      ctx.font = "13px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`— ${count}/4 (${(count / 4 * 100).toFixed(0)}%)`, px + 50, y);
      y += 20;
    }

    y += 10;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Arial";
    ctx.fillText("Phenotype Ratio:", px + 10, y);
    y += 20;
    for (const [pheno, count] of Object.entries(phenoCounts)) {
      const pColor = phenotypeColor(
        ...results.find(r => phenotypeLabel(r.genotype[0], r.genotype[1]) === pheno)!.genotype
      );
      ctx.beginPath();
      ctx.arc(px + 20, y - 4, 6, 0, Math.PI * 2);
      ctx.fillStyle = pColor;
      ctx.fill();
      ctx.font = "13px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`${pheno}: ${count}/4`, px + 32, y);
      y += 20;
    }
  }

  function drawLegend() {
    const px = W * 0.05, py = H * 0.7, pw = W * 0.9, ph = H * 0.26;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText(`Trait: ${traitNames[traitType]}  |  ${dominanceNames[dominancePattern]}`, px + 10, py + 20);

    ctx.font = "12px Arial";
    ctx.fillStyle = "#94a3b8";
    const y0 = py + 42;

    const explanations = [
      ["Complete Dominance: One allele completely masks the other.", "Heterozygote (Aa) shows dominant phenotype. Ratio: 3:1 (if both parents Aa)."],
      ["Incomplete Dominance: Heterozygote shows intermediate (blended) phenotype.", "Neither allele is fully dominant. Ratio: 1:2:1 (if both parents Aa)."],
      ["Codominance: Both alleles fully expressed in heterozygote.", "Both phenotypes visible simultaneously. Ratio: 1:2:1 (if both parents Aa)."],
    ];

    const exp = explanations[dominancePattern] || explanations[0];
    ctx.fillText(exp[0], px + 10, y0);
    ctx.fillText(exp[1], px + 10, y0 + 18);

    // Mendel's laws
    ctx.font = "11px Arial";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Mendel's 1st Law (Segregation): Each parent contributes one allele per trait to offspring.", px + 10, y0 + 44);
    ctx.fillText("Mendel's 2nd Law (Independent Assortment): Alleles of different genes assort independently.", px + 10, y0 + 60);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height; time = 0;
    },
    update(dt, params) {
      traitType = Math.floor(Math.min(3, Math.max(0, params.traitType ?? traitType)));
      dominancePattern = Math.floor(Math.min(2, Math.max(0, params.dominancePattern ?? dominancePattern)));
      parentA_allele1 = Math.round(params.parentA_allele1 ?? parentA_allele1);
      parentA_allele2 = Math.round(params.parentA_allele2 ?? parentA_allele2);
      time += dt;
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Genetics & Punnett Square", W / 2, 28);

      // Parents
      drawParentInfo("Parent A (♀)", parentAGenotype(), W * 0.12, H * 0.08);
      drawParentInfo("Parent B (♂)", parentBGenotype(), W * 0.88, H * 0.08);

      // Cross arrow
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#f59e0b";
      ctx.textAlign = "center";
      ctx.fillText("×", W * 0.5, H * 0.12);

      drawPunnettSquare();
      drawRatios();
      drawLegend();
    },
    reset() { time = 0; },
    destroy() {},
    getStateDescription() {
      const pA = parentAGenotype();
      const pB = parentBGenotype();
      const results = getPunnettResults();
      const phenoCounts: Record<string, number> = {};
      for (const r of results) {
        const pLabel = phenotypeLabel(r.genotype[0], r.genotype[1]);
        phenoCounts[pLabel] = (phenoCounts[pLabel] || 0) + 1;
      }
      const ratioStr = Object.entries(phenoCounts).map(([k, v]) => `${k}: ${v}/4`).join(", ");
      return `Punnett square: ${traitNames[traitType]}, ${dominanceNames[dominancePattern]}. Parent A: ${alleleSymbol(pA[0])}${alleleSymbol(pA[1])}, Parent B: ${alleleSymbol(pB[0])}${alleleSymbol(pB[1])}. Phenotype ratio: ${ratioStr}.`;
    },
    resize(w, h) { W = w; H = h; },
  };
  return engine;
};

export default geneticsPunnettSquareFactory;
