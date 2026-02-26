import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PascalsTriangleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pascals-triangle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let numRows = 10;
  let colorMode = 1;
  let highlightRow = 5;
  let animationSpeed = 1;

  // Precomputed triangle values
  let triangle: number[][] = [];
  let animatedRows = 0;

  function computeTriangle(rows: number): void {
    triangle = [];
    for (let n = 0; n < rows; n++) {
      const row: number[] = [];
      for (let k = 0; k <= n; k++) {
        if (k === 0 || k === n) {
          row.push(1);
        } else {
          row.push(triangle[n - 1][k - 1] + triangle[n - 1][k]);
        }
      }
      triangle.push(row);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    animatedRows = 0;
    computeTriangle(20);
  }

  function update(dt: number, params: Record<string, number>): void {
    const newRows = Math.round(params.numRows ?? 10);
    colorMode = Math.round(params.colorMode ?? 1);
    highlightRow = Math.round(params.highlightRow ?? 5);
    animationSpeed = params.animationSpeed ?? 1;

    if (newRows !== numRows) {
      numRows = newRows;
      animatedRows = 0;
    }
    numRows = newRows;

    time += dt;

    // Animate row-by-row construction
    if (animatedRows < numRows) {
      animatedRows += dt * animationSpeed * 3;
      if (animatedRows > numRows) animatedRows = numRows;
    }
  }

  function render(): void {
    // Dark background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0d0d2b");
    bg.addColorStop(1, "#1a1040");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    drawTriangle();
    drawInfoPanel();
    drawTitle();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 10);
  }

  function drawTriangle(): void {
    const visibleRows = Math.floor(animatedRows);
    const topY = 70;
    const availH = height - topY - 120;
    const cellH = Math.min(40, availH / numRows);
    const cellW = Math.min(55, (width - 40) / numRows);
    const hexR = Math.min(cellW, cellH) * 0.45;

    for (let n = 0; n < visibleRows && n < triangle.length; n++) {
      const row = triangle[n];
      const rowWidth = row.length * cellW;
      const startX = (width - rowWidth) / 2 + cellW / 2;
      const cy = topY + n * cellH + cellH / 2;

      // Row-by-row fade-in for the currently appearing row
      let rowAlpha = 1;
      if (n === visibleRows - 1) {
        rowAlpha = animatedRows - visibleRows + 1;
      }

      for (let k = 0; k < row.length; k++) {
        const cx = startX + k * cellW;
        const val = row[k];

        // Determine cell color
        let fillColor = getCellColor(val, n, k, rowAlpha);
        const isHighlighted = n === highlightRow;

        // Draw hexagonal cell
        drawHexCell(cx, cy, hexR, fillColor, isHighlighted, rowAlpha);

        // Draw number
        const fontSize = hexR < 14 ? 8 : hexR < 20 ? 10 : 12;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * rowAlpha})`;
        ctx.font = `${fontSize}px 'SF Mono', 'Fira Code', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Truncate large numbers
        const label = val > 9999 ? val.toExponential(0) : String(val);
        ctx.fillText(label, cx, cy);
      }
    }
  }

  function getCellColor(val: number, row: number, col: number, alpha: number): string {
    if (colorMode === 0) {
      // No special coloring - subtle gradient by row
      const hue = 220 + row * 5;
      return `hsla(${hue}, 50%, 25%, ${0.6 * alpha})`;
    } else if (colorMode === 1) {
      // Mod 2 - Sierpinski triangle pattern
      const mod = val % 2;
      if (mod === 0) {
        return `rgba(15, 15, 40, ${0.4 * alpha})`;
      }
      return `hsla(280, 80%, 55%, ${0.7 * alpha})`;
    } else if (colorMode === 2) {
      // Mod 3
      const mod = val % 3;
      const colors = [
        `rgba(15, 15, 40, ${0.4 * alpha})`,
        `hsla(160, 80%, 45%, ${0.7 * alpha})`,
        `hsla(30, 90%, 50%, ${0.7 * alpha})`,
      ];
      return colors[mod];
    } else {
      // Mod 5
      const mod = val % 5;
      const hues = [0, 60, 120, 200, 300];
      if (mod === 0) return `rgba(15, 15, 40, ${0.4 * alpha})`;
      return `hsla(${hues[mod]}, 75%, 50%, ${0.65 * alpha})`;
    }
  }

  function drawHexCell(cx: number, cy: number, r: number, fill: string, highlight: boolean, alpha: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const hx = cx + r * Math.cos(angle);
      const hy = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    ctx.fillStyle = fill;
    ctx.fill();

    if (highlight) {
      ctx.strokeStyle = `rgba(255, 220, 50, ${0.9 * alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Glow effect
      ctx.shadowColor = "rgba(255, 220, 50, 0.5)";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = `rgba(100, 120, 180, ${0.35 * alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(400, width - 20);
    const panelH = 85;
    const panelX = (width - panelW) / 2;
    const panelY = height - panelH - 15;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 100, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(180, 140, 255, 0.9)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Row ${highlightRow} (n=${highlightRow})`, panelX + 10, panelY + 16);

    // Row values
    const rowVals = highlightRow < triangle.length ? triangle[highlightRow] : [];
    const rowStr = rowVals.length <= 12
      ? rowVals.join(", ")
      : rowVals.slice(0, 6).join(", ") + " ... " + rowVals.slice(-3).join(", ");

    ctx.font = "11px 'SF Mono', 'Fira Code', monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(`Values: ${rowStr}`, panelX + 10, panelY + 34);

    // Row sum (always 2^n)
    const rowSum = rowVals.reduce((a, b) => a + b, 0);
    ctx.fillText(`Row sum: ${rowSum} = 2^${highlightRow}`, panelX + 10, panelY + 50);

    // Number of odd entries
    const oddCount = rowVals.filter((v) => v % 2 !== 0).length;
    ctx.fillText(`Odd entries: ${oddCount}`, panelX + 10, panelY + 66);

    // Color mode label
    const modeLabels = ["None", "mod 2 (Sierpinski)", "mod 3", "mod 5"];
    ctx.fillStyle = "rgba(150, 200, 255, 0.7)";
    ctx.textAlign = "right";
    ctx.fillText(`Color: ${modeLabels[colorMode] ?? "None"}`, panelX + panelW - 10, panelY + 66);

    // Binomial coefficient label
    ctx.fillStyle = "rgba(255, 220, 100, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`C(${highlightRow}, k) = ${highlightRow}! / (k!(${highlightRow}-k)!)`, panelX + panelW - 10, panelY + 16);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pascal's Triangle", width / 2, 24);

    ctx.fillStyle = "rgba(180, 150, 255, 0.65)";
    ctx.font = "italic 12px system-ui, sans-serif";
    ctx.fillText("C(n,k) = C(n-1,k-1) + C(n-1,k)  |  Each entry = sum of two above", width / 2, 42);

    // Legend for color modes if active
    if (colorMode > 0) {
      const modVal = colorMode === 1 ? 2 : colorMode === 2 ? 3 : 5;
      ctx.fillStyle = "rgba(200, 180, 255, 0.55)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Coloring by divisibility (mod ${modVal}) reveals fractal patterns`, width / 2, 56);
    }
  }

  function reset(): void {
    time = 0;
    animatedRows = 0;
  }

  function destroy(): void {
    triangle = [];
  }

  function getStateDescription(): string {
    const rowVals = highlightRow < triangle.length ? triangle[highlightRow] : [];
    const rowSum = rowVals.reduce((a, b) => a + b, 0);
    const oddCount = rowVals.filter((v) => v % 2 !== 0).length;
    const modeLabels = ["none", "mod 2 (Sierpinski)", "mod 3", "mod 5"];
    return (
      `Pascal's Triangle with ${numRows} rows displayed. ` +
      `Row ${highlightRow} highlighted: [${rowVals.join(", ")}]. ` +
      `Row sum: ${rowSum} (= 2^${highlightRow}). ` +
      `Odd entries in row: ${oddCount}. ` +
      `Color mode: ${modeLabels[colorMode] ?? "none"}. ` +
      `Each number C(n,k) is the binomial coefficient, equal to the sum of the two numbers above it. ` +
      `Patterns: row sums are powers of 2, diagonals contain natural numbers and triangular numbers, ` +
      `and coloring by mod 2 reveals the Sierpinski triangle fractal. ` +
      `Animation progress: ${Math.floor(animatedRows)}/${numRows} rows. Time: ${time.toFixed(2)}s.`
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

export default PascalsTriangleFactory;
