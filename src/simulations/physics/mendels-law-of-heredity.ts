import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Mendel's Law of Heredity: Simulates monohybrid and dihybrid crosses,
 * showing dominant/recessive alleles, Punnett squares, and phenotype ratios.
 */
const MendelsLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("mendels-law-of-heredity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  let crossType = 0; // 0=monohybrid, 1=dihybrid
  let generation = 1; // 1=F1, 2=F2
  let traitType = 0; // 0=seed shape, 1=seed color
  let numTrials = 100;

  // Mendel's pea traits
  interface Trait {
    name: string;
    dominant: string;
    recessive: string;
    domColor: string;
    recColor: string;
    domSymbol: string;
    recSymbol: string;
  }

  const TRAITS: Trait[] = [
    { name: "Seed Shape", dominant: "Round", recessive: "Wrinkled", domColor: "#22c55e", recColor: "#86efac", domSymbol: "R", recSymbol: "r" },
    { name: "Seed Color", dominant: "Yellow", recessive: "Green", domColor: "#eab308", recColor: "#22c55e", domSymbol: "Y", recSymbol: "y" },
  ];

  interface Offspring {
    allele1: string;
    allele2: string;
    phenotype: string;
    color: string;
  }

  let offspringResults: Offspring[] = [];
  let phenotypeCounts: Record<string, number> = {};

  function generateMonohybridF1(): Offspring[] {
    const t = TRAITS[traitType];
    // P: homozygous dominant x homozygous recessive => F1 all heterozygous
    const results: Offspring[] = [];
    for (let i = 0; i < numTrials; i++) {
      results.push({
        allele1: t.domSymbol,
        allele2: t.recSymbol,
        phenotype: t.dominant,
        color: t.domColor,
      });
    }
    return results;
  }

  function generateMonohybridF2(): Offspring[] {
    const t = TRAITS[traitType];
    // F1 x F1: Rr x Rr => 1/4 RR, 2/4 Rr, 1/4 rr
    const results: Offspring[] = [];
    for (let i = 0; i < numTrials; i++) {
      const a1 = Math.random() < 0.5 ? t.domSymbol : t.recSymbol;
      const a2 = Math.random() < 0.5 ? t.domSymbol : t.recSymbol;
      const isDom = a1 === t.domSymbol || a2 === t.domSymbol;
      results.push({
        allele1: a1,
        allele2: a2,
        phenotype: isDom ? t.dominant : t.recessive,
        color: isDom ? t.domColor : t.recColor,
      });
    }
    return results;
  }

  function runCross() {
    if (crossType === 0) {
      offspringResults = generation === 1 ? generateMonohybridF1() : generateMonohybridF2();
    } else {
      // Dihybrid F2 cross
      offspringResults = generateDihybridF2();
    }
    // Count phenotypes
    phenotypeCounts = {};
    for (const o of offspringResults) {
      phenotypeCounts[o.phenotype] = (phenotypeCounts[o.phenotype] || 0) + 1;
    }
  }

  function generateDihybridF2(): Offspring[] {
    const t1 = TRAITS[0];
    const t2 = TRAITS[1];
    const results: Offspring[] = [];
    for (let i = 0; i < numTrials; i++) {
      const a1a = Math.random() < 0.5 ? t1.domSymbol : t1.recSymbol;
      const a1b = Math.random() < 0.5 ? t1.domSymbol : t1.recSymbol;
      const a2a = Math.random() < 0.5 ? t2.domSymbol : t2.recSymbol;
      const a2b = Math.random() < 0.5 ? t2.domSymbol : t2.recSymbol;

      const dom1 = a1a === t1.domSymbol || a1b === t1.domSymbol;
      const dom2 = a2a === t2.domSymbol || a2b === t2.domSymbol;

      const pheno = `${dom1 ? t1.dominant : t1.recessive} & ${dom2 ? t2.dominant : t2.recessive}`;
      const color = dom1 && dom2 ? "#22c55e" : dom1 ? "#86efac" : dom2 ? "#eab308" : "#94a3b8";

      results.push({
        allele1: `${a1a}${a2a}`,
        allele2: `${a1b}${a2b}`,
        phenotype: pheno,
        color,
      });
    }
    return results;
  }

  let lastCrossType = -1;
  let lastGeneration = -1;
  let lastTrials = -1;
  let lastTraitType = -1;

  function drawPunnettSquare(x: number, y: number, size: number) {
    const t = TRAITS[traitType];
    const cellSize = size / 2;

    // Header
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Punnett Square", x + size / 2, y - 20);

    // Parent alleles
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(t.domSymbol, x + cellSize * 0.5, y - 5);
    ctx.fillText(t.recSymbol, x + cellSize * 1.5, y - 5);

    ctx.textAlign = "right";
    ctx.fillText(t.domSymbol, x - 5, y + cellSize * 0.55);
    ctx.fillText(t.recSymbol, x - 5, y + cellSize * 1.55);

    // Grid
    const alleles = [
      [t.domSymbol + t.domSymbol, t.domSymbol + t.recSymbol],
      [t.domSymbol + t.recSymbol, t.recSymbol + t.recSymbol],
    ];

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const cx = x + c * cellSize;
        const cy = y + r * cellSize;
        const genotype = alleles[r][c];
        const isDom = genotype.includes(t.domSymbol);

        ctx.fillStyle = isDom ? t.domColor + "40" : t.recColor + "40";
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, cellSize, cellSize);

        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.fillStyle = isDom ? t.domColor : t.recColor;
        ctx.textAlign = "center";
        ctx.fillText(genotype, cx + cellSize / 2, cy + cellSize / 2 + 6);
      }
    }
  }

  function drawPeaSeed(x: number, y: number, radius: number, color: string, isRound: boolean) {
    ctx.beginPath();
    if (isRound) {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    } else {
      // Wrinkled seed
      const points = 12;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const r = radius * (0.75 + 0.25 * Math.sin(angle * 5));
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      runCross();
    },

    update(_dt: number, params: Record<string, number>) {
      crossType = Math.round(params.crossType ?? 0);
      generation = Math.round(params.generation ?? 1);
      traitType = Math.round(params.traitType ?? 0);
      numTrials = Math.round(params.numTrials ?? 100);

      if (crossType !== lastCrossType || generation !== lastGeneration ||
          numTrials !== lastTrials || traitType !== lastTraitType) {
        runCross();
        lastCrossType = crossType;
        lastGeneration = generation;
        lastTrials = numTrials;
        lastTraitType = traitType;
      }
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      const crossName = crossType === 0 ? "Monohybrid" : "Dihybrid";
      const genName = generation === 1 ? "F₁" : "F₂";
      ctx.fillText(`Mendel's Law of Heredity — ${crossName} Cross (${genName})`, W / 2, 28);

      const t = TRAITS[traitType];

      // Left panel: Punnett square (only for F2 monohybrid)
      if (crossType === 0 && generation === 2) {
        drawPunnettSquare(W * 0.05 + 30, 80, Math.min(W * 0.25, 160));
      }

      // Parent info
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#94a3b8";

      if (crossType === 0) {
        const parentY = 70;
        if (generation === 1) {
          ctx.fillText(`P: ${t.domSymbol}${t.domSymbol} (${t.dominant}) × ${t.recSymbol}${t.recSymbol} (${t.recessive})`, 16, parentY);
          ctx.fillText(`F₁: All ${t.domSymbol}${t.recSymbol} (${t.dominant})`, 16, parentY + 20);
        } else {
          ctx.fillText(`F₁ × F₁: ${t.domSymbol}${t.recSymbol} × ${t.domSymbol}${t.recSymbol}`, 16, parentY);
          ctx.fillText(`Expected ratio: 3 ${t.dominant} : 1 ${t.recessive}`, 16, parentY + 20);
        }
      }

      // Offspring visualization - seeds scattered
      const seedArea = {
        x: W * 0.35,
        y: 60,
        w: W * 0.6,
        h: H * 0.45,
      };

      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(seedArea.x, seedArea.y, seedArea.w, seedArea.h, 8);
      ctx.stroke();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(`${offspringResults.length} offspring`, seedArea.x + seedArea.w / 2, seedArea.y - 5);

      // Draw seeds
      const maxDraw = Math.min(offspringResults.length, 200);
      const seedR = Math.max(3, Math.min(8, seedArea.w / (Math.sqrt(maxDraw) * 3)));
      const cols = Math.floor(seedArea.w / (seedR * 2.8));

      for (let i = 0; i < maxDraw; i++) {
        const o = offspringResults[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const sx = seedArea.x + 10 + col * seedR * 2.8 + seedR;
        const sy = seedArea.y + 15 + row * seedR * 2.8 + seedR;

        if (sy + seedR > seedArea.y + seedArea.h) break;

        const isRound = crossType === 0
          ? o.phenotype === TRAITS[traitType].dominant
          : o.phenotype.includes("Round");

        drawPeaSeed(sx, sy, seedR, o.color, isRound);
      }

      // Results bar chart
      const chartY = H * 0.58;
      const chartH = H * 0.25;
      const chartX = W * 0.1;
      const chartW = W * 0.8;

      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Phenotype Distribution", W / 2, chartY - 5);

      const phenotypes = Object.keys(phenotypeCounts);
      const barWidth = chartW / (phenotypes.length * 2);
      const maxCount = Math.max(...Object.values(phenotypeCounts), 1);

      for (let i = 0; i < phenotypes.length; i++) {
        const count = phenotypeCounts[phenotypes[i]];
        const barH = (count / maxCount) * chartH * 0.8;
        const bx = chartX + (i * 2 + 0.5) * barWidth;
        const by = chartY + chartH - barH;

        // Determine bar color
        const pheno = phenotypes[i];
        let barColor = "#3b82f6";
        if (crossType === 0) {
          barColor = pheno === t.dominant ? t.domColor : t.recColor;
        } else {
          if (pheno.includes("Round") && pheno.includes("Yellow")) barColor = "#22c55e";
          else if (pheno.includes("Round") && pheno.includes("Green")) barColor = "#86efac";
          else if (pheno.includes("Wrinkled") && pheno.includes("Yellow")) barColor = "#eab308";
          else barColor = "#94a3b8";
        }

        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(bx, by, barWidth * 0.8, barH, [4, 4, 0, 0]);
        ctx.fill();

        // Count label
        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.fillText(`${count}`, bx + barWidth * 0.4, by - 5);

        // Percentage
        const pct = ((count / numTrials) * 100).toFixed(1);
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`${pct}%`, bx + barWidth * 0.4, by - 18);

        // Label
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.save();
        ctx.translate(bx + barWidth * 0.4, chartY + chartH + 5);
        ctx.fillText(phenotypes[i], 0, 0);
        ctx.restore();
      }

      // Expected ratios
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      if (crossType === 0) {
        if (generation === 1) {
          ctx.fillText("Expected: 100% dominant phenotype", W / 2, H - 18);
        } else {
          ctx.fillText("Expected Mendelian ratio: 3:1 (dominant:recessive)", W / 2, H - 18);
        }
      } else {
        ctx.fillText("Expected dihybrid F₂ ratio: 9:3:3:1", W / 2, H - 18);
      }
    },

    reset() {
      lastCrossType = -1;
      runCross();
    },

    destroy() {},

    getStateDescription(): string {
      const t = TRAITS[traitType];
      const crossName = crossType === 0 ? "Monohybrid" : "Dihybrid";
      const genName = generation === 1 ? "F1" : "F2";
      let desc = `Mendel's Law: ${crossName} cross, ${genName} generation. Trait: ${t.name}. `;
      desc += `${numTrials} trials. Phenotype counts: `;
      for (const [pheno, count] of Object.entries(phenotypeCounts)) {
        desc += `${pheno}: ${count} (${((count / numTrials) * 100).toFixed(1)}%), `;
      }
      if (crossType === 0 && generation === 2) {
        desc += `Expected 3:1 ratio.`;
      }
      return desc;
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MendelsLawFactory;
