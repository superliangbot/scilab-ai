import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const GeometricSeriesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("geometric-series") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let firstTerm = 1; // a
  let commonRatio = 0.5; // r
  let numTerms = 10; // n
  let animSpeed = 1;

  let partialSums: number[] = [];
  let terms: number[] = [];
  let theoreticalSum = 0;
  let currentAnimTerm = 0;

  function computeSeries(): void {
    terms = [];
    partialSums = [];
    let sum = 0;
    for (let i = 0; i < numTerms; i++) {
      const term = firstTerm * Math.pow(commonRatio, i);
      terms.push(term);
      sum += term;
      partialSums.push(sum);
    }
    if (Math.abs(commonRatio) < 1) {
      theoreticalSum = firstTerm / (1 - commonRatio);
    } else {
      theoreticalSum = Infinity;
    }
  }

  function reset(): void {
    time = 0;
    currentAnimTerm = 0;
    computeSeries();
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newA = params.firstTerm ?? 1;
    const newR = params.commonRatio ?? 0.5;
    const newN = Math.round(params.numTerms ?? 10);
    const newAS = params.animSpeed ?? 1;

    if (newA !== firstTerm || newR !== commonRatio || newN !== numTerms) {
      firstTerm = newA;
      commonRatio = newR;
      numTerms = newN;
      reset();
    }
    animSpeed = newAS;

    time += dt * animSpeed;
    currentAnimTerm = Math.min(numTerms, Math.floor(time * 2));
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(1, "#0f3460");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawVisualBlocks(): void {
    const bx = W * 0.05;
    const by = H * 0.08;
    const bw = W * 0.42;
    const bh = H * 0.4;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Visual Representation", bx + bw / 2, by + 16);

    if (terms.length === 0) return;

    const maxTerm = Math.max(Math.abs(terms[0]), 0.01);
    const barAreaX = bx + 15;
    const barAreaY = by + 30;
    const barAreaW = bw - 30;
    const barAreaH = bh - 45;

    const barWidth = Math.min(30, barAreaW / numTerms - 2);

    for (let i = 0; i < Math.min(currentAnimTerm, terms.length); i++) {
      const barH = (Math.abs(terms[i]) / maxTerm) * barAreaH * 0.8;
      const x = barAreaX + i * (barWidth + 2);
      const y = barAreaY + barAreaH - barH;

      const hue = 200 + (i / numTerms) * 120;
      const alpha = 0.6 + 0.4 * (1 - i / numTerms);
      ctx.fillStyle = `hsla(${hue}, 70%, 55%, ${alpha})`;

      if (terms[i] >= 0) {
        ctx.fillRect(x, y, barWidth, barH);
      } else {
        ctx.fillRect(x, barAreaY + barAreaH, barWidth, barH);
      }

      // Term value
      if (barWidth > 12) {
        ctx.fillStyle = "#fff";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(terms[i].toFixed(3), x + barWidth / 2, y - 4);
      }
    }

    // Convergence visualization: nested squares for |r| < 1
    if (Math.abs(commonRatio) < 1 && commonRatio > 0) {
      const sqX = bx + bw * 0.6;
      const sqY = barAreaY + 20;
      const sqSize = Math.min(bw * 0.35, barAreaH - 30);

      let size = sqSize;
      for (let i = 0; i < Math.min(currentAnimTerm, 8); i++) {
        const hue = 200 + i * 20;
        ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sqX, sqY, size, size);
        size *= commonRatio;
      }
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Nested squares (r=" + commonRatio.toFixed(2) + ")", sqX + sqSize / 2, sqY + sqSize + 12);
    }
  }

  function drawPartialSumGraph(): void {
    const gx = W * 0.52;
    const gy = H * 0.08;
    const gw = W * 0.44;
    const gh = H * 0.4;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Partial Sums Sₙ", gx + gw / 2, gy + 16);

    const px = gx + 45;
    const py = gy + 32;
    const pw = gw - 60;
    const ph = gh - 52;

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    if (partialSums.length === 0) return;

    const allVals = [...partialSums];
    if (isFinite(theoreticalSum)) allVals.push(theoreticalSum);
    const maxVal = Math.max(...allVals.map(Math.abs), 0.01) * 1.15;
    const minVal = Math.min(0, ...allVals) * 1.15;
    const range = maxVal - minVal;

    // Convergence line
    if (isFinite(theoreticalSum)) {
      const sumY = py + ph - ((theoreticalSum - minVal) / range) * ph;
      ctx.strokeStyle = "rgba(255, 152, 0, 0.5)";
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(px, sumY);
      ctx.lineTo(px + pw, sumY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffa726";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`S∞ = ${theoreticalSum.toFixed(4)}`, px + pw, sumY - 5);
    }

    // Partial sum points
    const displayN = Math.min(currentAnimTerm, partialSums.length);
    for (let i = 0; i < displayN; i++) {
      const x = px + ((i + 0.5) / numTerms) * pw;
      const y = py + ph - ((partialSums[i] - minVal) / range) * ph;

      // Line connection
      if (i > 0) {
        const prevX = px + ((i - 0.5) / numTerms) * pw;
        const prevY = py + ph - ((partialSums[i - 1] - minVal) / range) * ph;
        ctx.strokeStyle = "#42a5f5";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#42a5f5";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("n (term index)", px + pw / 2, py + ph + 14);
    ctx.textAlign = "right";
    ctx.fillText(maxVal.toFixed(2), px - 5, py + 4);
    ctx.fillText(minVal.toFixed(2), px - 5, py + ph);
  }

  function drawFormulas(): void {
    const fx = W * 0.05;
    const fy = H * 0.52;
    const fw = W * 0.9;
    const fh = H * 0.2;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Geometric Series Formulas", fx + 15, fy + 18);

    ctx.font = "12px monospace";
    let y = fy + 40;

    ctx.fillStyle = "#42a5f5";
    ctx.fillText(`General term:  aₙ = a·rⁿ = ${firstTerm} × ${commonRatio}ⁿ`, fx + 15, y);
    y += 20;

    ctx.fillStyle = "#66bb6a";
    ctx.fillText(`Partial sum:   Sₙ = a(1-rⁿ)/(1-r)`, fx + 15, y);
    if (currentAnimTerm > 0 && currentAnimTerm <= partialSums.length) {
      ctx.fillStyle = "#fff";
      ctx.fillText(`= ${partialSums[Math.min(currentAnimTerm - 1, partialSums.length - 1)].toFixed(6)}`, fx + 340, y);
    }
    y += 20;

    if (Math.abs(commonRatio) < 1) {
      ctx.fillStyle = "#ffa726";
      ctx.fillText(`Infinite sum:  S∞ = a/(1-r) = ${firstTerm}/(1-${commonRatio}) = ${theoreticalSum.toFixed(6)}`, fx + 15, y);
      ctx.fillStyle = "#4caf50";
      ctx.fillText(" ← CONVERGES (|r| < 1)", fx + 520, y);
    } else {
      ctx.fillStyle = "#ef5350";
      ctx.fillText(`|r| = ${Math.abs(commonRatio).toFixed(2)} ≥ 1 → Series DIVERGES`, fx + 15, y);
    }
  }

  function drawTermTable(): void {
    const tx = W * 0.05;
    const ty = H * 0.75;
    const tw = W * 0.9;
    const th = H * 0.22;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Terms & Partial Sums", tx + 15, ty + 16);

    const cols = Math.min(numTerms, Math.floor(tw / 80));
    const colW = (tw - 30) / cols;

    // Header
    ctx.font = "10px monospace";
    ctx.fillStyle = "#78909c";
    for (let i = 0; i < cols; i++) {
      const x = tx + 15 + i * colW;
      ctx.textAlign = "center";
      ctx.fillText(`n=${i}`, x + colW / 2, ty + 34);
    }

    // Terms
    for (let i = 0; i < Math.min(cols, currentAnimTerm); i++) {
      const x = tx + 15 + i * colW;
      ctx.fillStyle = "#42a5f5";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`aₙ=${terms[i].toFixed(4)}`, x + colW / 2, ty + 50);
      ctx.fillStyle = "#66bb6a";
      ctx.fillText(`Sₙ=${partialSums[i].toFixed(4)}`, x + colW / 2, ty + 65);
    }

    // Error from convergence value
    if (Math.abs(commonRatio) < 1 && currentAnimTerm > 0) {
      const lastIdx = Math.min(currentAnimTerm - 1, partialSums.length - 1);
      const error = Math.abs(theoreticalSum - partialSums[lastIdx]);
      ctx.fillStyle = "#ef5350";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Error from S∞: |S∞ - S${lastIdx + 1}| = ${error.toExponential(3)}`, tx + 15, ty + th - 10);
    }
  }

  function render(): void {
    drawBackground();
    drawVisualBlocks();
    drawPartialSumGraph();
    drawFormulas();
    drawTermTable();
  }

  function destroy(): void {
    terms = [];
    partialSums = [];
  }

  function getStateDescription(): string {
    const displayN = Math.min(currentAnimTerm, partialSums.length);
    const lastSum = displayN > 0 ? partialSums[displayN - 1] : 0;
    return (
      `Geometric Series: a=${firstTerm}, r=${commonRatio}, n=${numTerms}. ` +
      `Currently showing ${displayN} terms. ` +
      `Latest partial sum S${displayN}=${lastSum.toFixed(6)}. ` +
      `${Math.abs(commonRatio) < 1
        ? `Series converges to S∞ = a/(1-r) = ${theoreticalSum.toFixed(6)}`
        : `Series diverges (|r|=${Math.abs(commonRatio)} ≥ 1)`
      }. ` +
      `General term: aₙ = ${firstTerm}·${commonRatio}ⁿ. Partial sum: Sₙ = a(1-rⁿ)/(1-r).`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default GeometricSeriesFactory;
