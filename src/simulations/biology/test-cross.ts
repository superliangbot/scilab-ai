import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TestCrossFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("test-cross") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let parentGenotype = 1; // 0=AA, 1=Aa
  let numOffspring = 20;
  let animationSpeed = 1;

  // State
  interface Offspring {
    genotype: string;
    phenotype: "dominant" | "recessive";
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    born: number;
    allele1: string;
    allele2: string;
  }
  let offspring: Offspring[] = [];
  let punnettAnimPhase = 0; // 0-4 animation steps
  let punnettTimer = 0;

  function generateOffspring(): void {
    offspring = [];
    const parent1Alleles = parentGenotype === 0 ? ["A", "A"] : ["A", "a"];
    const parent2Alleles = ["a", "a"]; // always homozygous recessive

    const boxSize = Math.min(28, (width * 0.35) / Math.ceil(Math.sqrt(numOffspring)));
    const cols = Math.max(1, Math.floor((width * 0.35) / boxSize));

    for (let i = 0; i < numOffspring; i++) {
      const a1 = parent1Alleles[Math.floor(Math.random() * 2)];
      const a2 = parent2Alleles[Math.floor(Math.random() * 2)];
      const genotype = [a1, a2].sort().reverse().join("");
      const phenotype: "dominant" | "recessive" = (a1 === "A" || a2 === "A") ? "dominant" : "recessive";

      const col = i % cols;
      const row = Math.floor(i / cols);
      const baseX = width * 0.58;
      const baseY = height * 0.42;

      offspring.push({
        genotype,
        phenotype,
        x: width / 2,
        y: height * 0.25,
        targetX: baseX + col * (boxSize + 3),
        targetY: baseY + row * (boxSize + 3),
        born: i * 0.08,
        allele1: a1,
        allele2: a2,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    punnettAnimPhase = 0;
    punnettTimer = 0;
    generateOffspring();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newGenotype = Math.round(params.parentGenotype ?? 1);
    const newNum = Math.round(params.numOffspring ?? 20);
    animationSpeed = params.animationSpeed ?? 1;

    if (newGenotype !== parentGenotype || newNum !== numOffspring) {
      parentGenotype = newGenotype;
      numOffspring = newNum;
      time = 0;
      punnettAnimPhase = 0;
      punnettTimer = 0;
      generateOffspring();
    }

    time += dt * animationSpeed;
    punnettTimer += dt * animationSpeed;

    // Advance Punnett square animation
    if (punnettTimer > 0.8) {
      punnettTimer = 0;
      if (punnettAnimPhase < 4) punnettAnimPhase++;
    }

    // Animate offspring moving to target positions
    for (const o of offspring) {
      if (time > o.born) {
        const t = Math.min(1, (time - o.born) * 2);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        o.x = width / 2 + (o.targetX - width / 2) * ease;
        o.y = height * 0.25 + (o.targetY - height * 0.25) * ease;
      }
    }
  }

  function drawPunnettSquare(): void {
    const sqX = width * 0.04;
    const sqY = height * 0.08;
    const cellSize = Math.min(width * 0.11, height * 0.13);
    const gridX = sqX + cellSize;
    const gridY = sqY + cellSize;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Punnett Square", sqX + cellSize * 1.5, sqY - 10);

    const p1Label = parentGenotype === 0 ? "AA" : "Aa";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Parent 1: ${p1Label}`, gridX + cellSize, sqY - 28);
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("Parent 2: aa", gridX + cellSize, sqY - 14);

    // Parent alleles as headers
    const p1Alleles = parentGenotype === 0 ? ["A", "A"] : ["A", "a"];
    const p2Alleles = ["a", "a"];

    ctx.font = "bold 14px system-ui, sans-serif";

    // Column headers (parent 1)
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.fillText(p1Alleles[c], gridX + c * cellSize + cellSize / 2, gridY - 8);
    }

    // Row headers (parent 2)
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = "#a78bfa";
      ctx.textAlign = "center";
      ctx.fillText(p2Alleles[r], gridX - cellSize / 2, gridY + r * cellSize + cellSize / 2 + 5);
    }

    // Grid cells
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const cellIdx = r * 2 + c;
        const cx = gridX + c * cellSize;
        const cy = gridY + r * cellSize;

        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, cy, cellSize, cellSize);

        if (punnettAnimPhase > cellIdx) {
          const allele1 = p1Alleles[c];
          const allele2 = p2Alleles[r];
          const geno = [allele1, allele2].sort().reverse().join("");
          const isDominant = allele1 === "A" || allele2 === "A";

          ctx.fillStyle = isDominant ? "rgba(59, 130, 246, 0.25)" : "rgba(239, 68, 68, 0.25)";
          ctx.fillRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);

          ctx.fillStyle = isDominant ? "#60a5fa" : "#f87171";
          ctx.font = "bold 16px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(geno, cx + cellSize / 2, cy + cellSize / 2 + 6);
        }
      }
    }
  }

  function drawParentDisplay(): void {
    const py = height * 0.06;
    const p1x = width * 0.35;
    const p2x = width * 0.65;

    // Parent 1
    const p1Label = parentGenotype === 0 ? "AA" : "Aa";
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p1Label, p1x, py + 30);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Tested Parent (dominant phenotype)", p1x, py + 48);

    // Cross symbol
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText("\u00D7", width / 2, py + 30);

    // Parent 2
    ctx.fillStyle = "#a78bfa";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText("aa", p2x, py + 30);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Homozygous Recessive", p2x, py + 48);
  }

  function drawOffspringGrid(): void {
    const boxSize = Math.min(24, (width * 0.35) / Math.ceil(Math.sqrt(numOffspring)));

    for (const o of offspring) {
      if (time < o.born) continue;
      const alpha = Math.min(1, (time - o.born) * 3);
      const color = o.phenotype === "dominant" ? `rgba(59, 130, 246, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(o.x - boxSize / 2, o.y - boxSize / 2, boxSize - 2, boxSize - 2, 3);
      ctx.fill();

      if (boxSize > 16) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.font = `bold ${Math.max(8, boxSize * 0.4)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(o.genotype, o.x, o.y + 3);
      }
    }
  }

  function drawPieChart(): void {
    const cx = width * 0.42;
    const cy = height * 0.72;
    const r = Math.min(width, height) * 0.09;

    const dominant = offspring.filter(o => o.phenotype === "dominant").length;
    const recessive = offspring.length - dominant;
    const total = offspring.length || 1;

    // Dominant slice
    const domAngle = (dominant / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + domAngle);
    ctx.closePath();
    ctx.fillStyle = "#3b82f6";
    ctx.fill();

    // Recessive slice
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2 + domAngle, -Math.PI / 2 + Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Offspring Phenotype Ratio", cx, cy - r - 12);

    ctx.fillStyle = "#60a5fa";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Dominant: ${dominant} (${((dominant / total) * 100).toFixed(0)}%)`, cx, cy + r + 18);
    ctx.fillStyle = "#f87171";
    ctx.fillText(`Recessive: ${recessive} (${((recessive / total) * 100).toFixed(0)}%)`, cx, cy + r + 34);
  }

  function drawInfoPanel(): void {
    const px = 10;
    const py = height * 0.85;
    const pw = width - 20;
    const ph = height * 0.13;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Test Cross Analysis", px + 12, py + 16);

    const p1Label = parentGenotype === 0 ? "AA" : "Aa";
    const dominant = offspring.filter(o => o.phenotype === "dominant").length;
    const recessive = offspring.length - dominant;
    const total = offspring.length || 1;

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    const col2 = px + pw * 0.5;
    let y = py + 32;

    ctx.fillText(`Cross: ${p1Label} x aa`, px + 12, y);
    if (parentGenotype === 0) {
      ctx.fillText("Expected: 100% Aa (all dominant phenotype)", col2, y);
    } else {
      ctx.fillText("Expected: 50% Aa (dominant), 50% aa (recessive)", col2, y);
    }
    y += 15;

    ctx.fillText(`Observed: ${dominant} dominant, ${recessive} recessive (n=${total})`, px + 12, y);
    const conclusion = recessive > 0
      ? "Conclusion: Parent is HETEROZYGOUS (Aa)"
      : "Conclusion: Parent is likely HOMOZYGOUS (AA)";
    ctx.fillStyle = recessive > 0 ? "#fbbf24" : "#22c55e";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText(conclusion, col2, y);
  }

  function render(): void {
    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    drawParentDisplay();
    drawPunnettSquare();
    drawOffspringGrid();
    drawPieChart();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    punnettAnimPhase = 0;
    punnettTimer = 0;
    generateOffspring();
  }

  function destroy(): void {
    offspring = [];
  }

  function getStateDescription(): string {
    const p1Label = parentGenotype === 0 ? "AA" : "Aa";
    const dominant = offspring.filter(o => o.phenotype === "dominant").length;
    const recessive = offspring.length - dominant;
    return (
      `Test Cross: ${p1Label} x aa. Offspring: ${dominant} dominant, ${recessive} recessive out of ${offspring.length}. ` +
      (parentGenotype === 0
        ? "Parent is homozygous dominant (AA): all offspring are Aa with dominant phenotype."
        : "Parent is heterozygous (Aa): expected 50% Aa (dominant) and 50% aa (recessive). ") +
      `A test cross reveals the genotype of an organism showing the dominant phenotype ` +
      `by crossing it with a homozygous recessive individual.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TestCrossFactory;
