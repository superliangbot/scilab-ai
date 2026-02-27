import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const GeometricSeriesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("geometric-series") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let ratio = 0.5;
  let numTerms = 8;
  let animSpeed = 1;
  let firstTerm = 1;

  let currentTermIndex = 0;
  let termProgress = 0;
  let displayedSum = 0;

  function initState() {
    time = 0;
    currentTermIndex = 0;
    termProgress = 0;
    displayedSum = 0;
  }

  function getTermValue(n: number): number {
    return firstTerm * Math.pow(ratio, n);
  }

  function getPartialSum(n: number): number {
    if (Math.abs(ratio - 1) < 0.001) return firstTerm * (n + 1);
    return firstTerm * (1 - Math.pow(ratio, n + 1)) / (1 - ratio);
  }

  function getConvergentSum(): number | null {
    if (Math.abs(ratio) >= 1) return null;
    return firstTerm / (1 - ratio);
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#1e1b4b");
    grad.addColorStop(1, "#312e81");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawBarVisualization() {
    const barAreaLeft = 40;
    const barAreaRight = width - 40;
    const barAreaTop = 80;
    const barAreaH = 80;

    const convergentSum = getConvergentSum();
    const totalWidth = barAreaRight - barAreaLeft;

    // Draw the convergent sum line
    if (convergentSum !== null) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(barAreaRight, barAreaTop - 5);
      ctx.lineTo(barAreaRight, barAreaTop + barAreaH + 5);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#f59e0b";
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`S∞ = ${convergentSum.toFixed(4)}`, barAreaRight, barAreaTop - 10);
    }

    // Draw accumulated bars
    let xPos = barAreaLeft;
    const maxDisplayTerms = Math.min(currentTermIndex + 1, numTerms);
    const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#84cc16",
                    "#a855f7", "#f97316", "#14b8a6", "#e879f9", "#fb923c", "#22d3ee", "#a3e635", "#fbbf24"];

    for (let i = 0; i < maxDisplayTerms; i++) {
      const termVal = getTermValue(i);
      const barW = (termVal / (convergentSum || firstTerm * 2)) * totalWidth;
      const isCurrent = i === currentTermIndex;
      const effectiveBarW = isCurrent ? barW * termProgress : barW;

      if (effectiveBarW > 0.5) {
        ctx.fillStyle = colors[i % colors.length] + (isCurrent ? "cc" : "ff");
        ctx.fillRect(xPos, barAreaTop, effectiveBarW, barAreaH);

        // Border
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = 1;
        ctx.strokeRect(xPos, barAreaTop, effectiveBarW, barAreaH);

        // Label if bar is wide enough
        if (effectiveBarW > 30) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "11px monospace";
          ctx.textAlign = "center";
          const label = ratio === 0.5 ? `1/${Math.pow(2, i)}` : termVal.toFixed(3);
          ctx.fillText(label, xPos + effectiveBarW / 2, barAreaTop + barAreaH / 2 + 4);
        }

        xPos += effectiveBarW;
      }
    }

    // Remaining space
    if (xPos < barAreaRight) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(xPos, barAreaTop, barAreaRight - xPos, barAreaH);
    }
  }

  function drawFormulas() {
    const y = 190;

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";

    // Series formula
    let seriesStr = "";
    for (let i = 0; i <= Math.min(currentTermIndex, 5); i++) {
      const term = getTermValue(i);
      if (i > 0) seriesStr += " + ";
      if (ratio === 0.5) {
        seriesStr += i === 0 ? "1" : `1/${Math.pow(2, i)}`;
      } else {
        seriesStr += term.toFixed(3);
      }
    }
    if (currentTermIndex > 5) seriesStr += " + ...";

    ctx.fillText(`S = ${seriesStr}`, width / 2, y);

    // Current sum
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`S₍${currentTermIndex + 1}₎ = ${displayedSum.toFixed(6)}`, width / 2, y + 30);

    const convergent = getConvergentSum();
    if (convergent !== null) {
      ctx.fillStyle = "#f59e0b";
      ctx.font = "14px monospace";
      ctx.fillText(`S∞ = a/(1−r) = ${firstTerm}/(1−${ratio}) = ${convergent.toFixed(6)}`, width / 2, y + 58);
    }
  }

  function drawGraph() {
    const gx = 60;
    const gy = 280;
    const gw = width - 120;
    const gh = height - gy - 80;

    // Graph background
    ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
    ctx.beginPath();
    ctx.roundRect(gx - 10, gy - 10, gw + 20, gh + 30, 8);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("n (term number)", gx + gw / 2, gy + gh + 25);
    ctx.save();
    ctx.translate(gx - 25, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Partial Sum Sₙ", 0, 0);
    ctx.restore();

    const convergent = getConvergentSum();
    const maxY = convergent !== null ? convergent * 1.1 : getPartialSum(numTerms) * 1.1;

    // Convergent sum line
    if (convergent !== null) {
      const cy = gy + gh - (convergent / maxY) * gh;
      ctx.strokeStyle = "#f59e0b44";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(gx, cy);
      ctx.lineTo(gx + gw, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#f59e0b";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`S∞ = ${convergent.toFixed(3)}`, gx + gw - 80, cy - 5);
    }

    // Plot partial sums
    const maxDisplayTerms = Math.min(currentTermIndex + 1, numTerms);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= maxDisplayTerms; i++) {
      let sum: number;
      if (i < maxDisplayTerms) {
        sum = getPartialSum(i);
      } else {
        sum = displayedSum;
      }
      const px = gx + (i / numTerms) * gw;
      const py = gy + gh - (sum / maxY) * gh;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Plot points
    for (let i = 0; i <= Math.min(currentTermIndex, numTerms - 1); i++) {
      const sum = getPartialSum(i);
      const px = gx + (i / numTerms) * gw;
      const py = gy + gh - (sum / maxY) * gh;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#60a5fa";
      ctx.fill();

      // X-axis labels
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, px, gy + gh + 12);
    }
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Geometric Series Convergence", width / 2, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(`a = ${firstTerm}  |  r = ${ratio}  |  Sₙ = a(1−rⁿ)/(1−r)`, width / 2, 50);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      const newRatio = params.ratio ?? 0.5;
      const newTerms = Math.round(params.numTerms ?? 8);
      animSpeed = params.animSpeed ?? 1;
      firstTerm = params.firstTerm ?? 1;

      if (Math.abs(newRatio - ratio) > 0.001 || newTerms !== numTerms) {
        ratio = newRatio;
        numTerms = newTerms;
        initState();
        return;
      }

      time += dt;

      // Animate terms appearing
      if (currentTermIndex < numTerms) {
        termProgress += dt * animSpeed * 1.5;
        if (termProgress >= 1) {
          termProgress = 0;
          displayedSum = getPartialSum(currentTermIndex);
          currentTermIndex++;
        } else {
          displayedSum = (currentTermIndex > 0 ? getPartialSum(currentTermIndex - 1) : 0) +
                         getTermValue(currentTermIndex) * termProgress;
        }
      }
    },

    render() {
      drawBackground();
      drawBarVisualization();
      drawFormulas();
      drawGraph();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {},

    getStateDescription(): string {
      const convergent = getConvergentSum();
      const convergesStr = convergent !== null
        ? `Converges to ${convergent.toFixed(6)}`
        : "Diverges (|r| ≥ 1)";
      return `Geometric Series: a=${firstTerm}, r=${ratio}. Showing ${currentTermIndex + 1}/${numTerms} terms. Current partial sum: ${displayedSum.toFixed(6)}. ${convergesStr}. Formula: Sₙ = a(1−rⁿ)/(1−r).`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default GeometricSeriesFactory;
