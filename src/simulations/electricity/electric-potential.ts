import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectricPotentialFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electric-potential") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let charge1 = 3;
  let charge2 = -2;
  let showFieldLines = 1;
  let gridResolution = 25;

  // Charge positions
  let q1x = 0;
  let q1y = 0;
  let q2x = 0;
  let q2y = 0;

  // Offscreen buffer for the potential heat map
  let fieldImageData: ImageData | null = null;
  let lastFieldHash = "";

  // Coulomb constant scaled for pixel-space visualization
  const K = 800;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    fieldImageData = null;
    lastFieldHash = "";
    positionCharges();
  }

  function positionCharges(): void {
    q1x = width * 0.33;
    q1y = height * 0.5;
    q2x = width * 0.67;
    q2y = height * 0.5;
  }

  function update(dt: number, params: Record<string, number>): void {
    charge1 = params.charge1 ?? 3;
    charge2 = params.charge2 ?? -2;
    showFieldLines = params.showFieldLines ?? 1;
    gridResolution = Math.round(params.gridResolution ?? 25);
    time += dt;
  }

  /** Compute electric potential V at a point (px, py). V = kQ/r summed over charges. */
  function potentialAt(px: number, py: number): number {
    let V = 0;
    const charges = [
      { x: q1x, y: q1y, q: charge1 },
      { x: q2x, y: q2y, q: charge2 },
    ];
    for (const c of charges) {
      if (c.q === 0) continue;
      const dx = px - c.x;
      const dy = py - c.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 3) continue;
      V += (K * c.q) / r;
    }
    return V;
  }

  /** Compute electric field (negative gradient of potential) at a point. */
  function fieldAt(px: number, py: number): { ex: number; ey: number } {
    let ex = 0;
    let ey = 0;
    const charges = [
      { x: q1x, y: q1y, q: charge1 },
      { x: q2x, y: q2y, q: charge2 },
    ];
    for (const c of charges) {
      if (c.q === 0) continue;
      const dx = px - c.x;
      const dy = py - c.y;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      if (r < 5) continue;
      const E = (K * c.q) / r2;
      ex += E * (dx / r);
      ey += E * (dy / r);
    }
    return { ex, ey };
  }

  /**
   * Map a potential value to an RGB color.
   * Positive potential -> red/orange, negative -> blue/cyan, zero -> dark green/grey.
   */
  function potentialToColor(V: number): [number, number, number] {
    const maxV = 120;
    const t = Math.max(-1, Math.min(1, V / maxV));

    let r: number, g: number, b: number;
    if (t > 0) {
      // Positive: dark -> orange -> red -> white-hot
      const s = t;
      r = Math.floor(40 + 215 * Math.min(1, s * 2));
      g = Math.floor(25 + 100 * Math.max(0, Math.min(1, s * 1.2 - 0.1)) - 60 * Math.max(0, s - 0.7));
      b = Math.floor(30 + 30 * Math.max(0, s - 0.6));
    } else {
      // Negative: dark -> teal -> blue -> bright blue
      const s = -t;
      r = Math.floor(15 + 30 * Math.max(0, s - 0.5));
      g = Math.floor(25 + 80 * Math.min(1, s * 1.5) - 40 * Math.max(0, s - 0.5));
      b = Math.floor(50 + 205 * Math.min(1, s * 1.5));
    }

    // Darken near zero for contrast
    const absT = Math.abs(t);
    if (absT < 0.08) {
      const fade = absT / 0.08;
      r = Math.floor(r * fade + 18 * (1 - fade));
      g = Math.floor(g * fade + 22 * (1 - fade));
      b = Math.floor(b * fade + 28 * (1 - fade));
    }

    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
  }

  /** Build the pixel-level heat map of electric potential. Uses gridResolution as cell size. */
  function buildFieldImage(): void {
    const hash = `${width}:${height}:${charge1}:${charge2}:${gridResolution}`;
    if (hash === lastFieldHash && fieldImageData) return;
    lastFieldHash = hash;

    fieldImageData = ctx.createImageData(width, height);
    const data = fieldImageData.data;
    const step = Math.max(1, Math.round(gridResolution / 5));

    // Compute potential at a sub-sampled grid then fill pixels
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const V = potentialAt(x, y);
        const [r, g, b] = potentialToColor(V);

        // Fill the step x step block
        for (let dy = 0; dy < step && y + dy < height; dy++) {
          for (let dx = 0; dx < step && x + dx < width; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
      }
    }
  }

  /** Draw equipotential contour lines using marching squares. */
  function drawEquipotentialLines(): void {
    const levels = [-80, -50, -30, -15, -5, 5, 15, 30, 50, 80];
    const cellSize = 6;
    const cols = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);

    // Pre-compute potential on the grid
    const grid: number[][] = [];
    for (let iy = 0; iy <= rows; iy++) {
      grid[iy] = [];
      for (let ix = 0; ix <= cols; ix++) {
        grid[iy][ix] = potentialAt(ix * cellSize, iy * cellSize);
      }
    }

    for (const level of levels) {
      const isPositive = level > 0;
      const alpha = 0.35 + 0.25 * (Math.abs(level) / 80);
      ctx.strokeStyle = isPositive
        ? `rgba(255,200,120,${alpha})`
        : `rgba(120,200,255,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const v00 = grid[iy][ix] - level;
          const v10 = grid[iy][ix + 1] - level;
          const v01 = grid[iy + 1][ix] - level;
          const v11 = grid[iy + 1][ix + 1] - level;

          const idx =
            (v00 > 0 ? 8 : 0) |
            (v10 > 0 ? 4 : 0) |
            (v11 > 0 ? 2 : 0) |
            (v01 > 0 ? 1 : 0);

          if (idx === 0 || idx === 15) continue;

          const x0 = ix * cellSize;
          const y0 = iy * cellSize;

          // Interpolation helpers
          const lerpX = (va: number, vb: number) => x0 + cellSize * (va / (va - vb));
          const lerpY = (va: number, vb: number) => y0 + cellSize * (va / (va - vb));

          // Top edge midpoint
          const topX = lerpX(v00, v10);
          const topY = y0;
          // Bottom edge midpoint
          const botX = lerpX(v01, v11);
          const botY = y0 + cellSize;
          // Left edge midpoint
          const leftX = x0;
          const leftY = lerpY(v00, v01);
          // Right edge midpoint
          const rightX = x0 + cellSize;
          const rightY = lerpY(v10, v11);

          // Draw line segments based on marching squares case
          const segments: [number, number, number, number][] = [];
          switch (idx) {
            case 1: case 14: segments.push([leftX, leftY, botX, botY]); break;
            case 2: case 13: segments.push([botX, botY, rightX, rightY]); break;
            case 3: case 12: segments.push([leftX, leftY, rightX, rightY]); break;
            case 4: case 11: segments.push([topX, topY, rightX, rightY]); break;
            case 5: segments.push([leftX, leftY, topX, topY]); segments.push([botX, botY, rightX, rightY]); break;
            case 6: case 9: segments.push([topX, topY, botX, botY]); break;
            case 7: case 8: segments.push([leftX, leftY, topX, topY]); break;
            case 10: segments.push([topX, topY, rightX, rightY]); segments.push([leftX, leftY, botX, botY]); break;
          }

          for (const [sx, sy, ex, ey] of segments) {
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
          }
        }
      }
      ctx.stroke();
    }
  }

  /** Draw electric field arrows on a sparse grid. */
  function drawFieldArrows(): void {
    const spacing = 45;
    const margin = 25;

    for (let gx = margin; gx < width - margin; gx += spacing) {
      for (let gy = margin; gy < height - margin; gy += spacing) {
        // Skip near charges
        const d1 = Math.hypot(gx - q1x, gy - q1y);
        const d2 = Math.hypot(gx - q2x, gy - q2y);
        if (d1 < 28 || d2 < 28) continue;

        const { ex, ey } = fieldAt(gx, gy);
        const mag = Math.sqrt(ex * ex + ey * ey);
        if (mag < 0.01) continue;

        const nx = ex / mag;
        const ny = ey / mag;
        const arrowLen = Math.min(16, 3 + mag * 0.15);
        const alpha = Math.min(0.6, 0.1 + mag * 0.01);

        const endX = gx + nx * arrowLen;
        const endY = gy + ny * arrowLen;

        ctx.strokeStyle = `rgba(220,230,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Arrowhead
        const headLen = 4;
        const angle = Math.atan2(ny, nx);
        ctx.fillStyle = `rgba(220,230,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headLen * Math.cos(angle - 0.45), endY - headLen * Math.sin(angle - 0.45));
        ctx.lineTo(endX - headLen * Math.cos(angle + 0.45), endY - headLen * Math.sin(angle + 0.45));
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** Draw a charge marker with glow. */
  function drawCharge(cx: number, cy: number, q: number): void {
    if (q === 0) return;
    const isPositive = q > 0;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
    glow.addColorStop(0, isPositive ? "rgba(255,100,60,0.35)" : "rgba(60,100,255,0.35)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();

    // Charge body
    const grad = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 16);
    grad.addColorStop(0, isPositive ? "#ff9977" : "#7799ff");
    grad.addColorStop(1, isPositive ? "#cc3322" : "#2233cc");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Symbol
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isPositive ? "+" : "\u2212", cx, cy);
    ctx.textBaseline = "alphabetic";

    // Label beneath
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "11px system-ui, sans-serif";
    const sign = q > 0 ? "+" : "";
    ctx.fillText(`Q = ${sign}${q}`, cx, cy + 28);
  }

  /** Draw the voltage color-scale legend on the right side. */
  function drawLegend(): void {
    const legendX = width - 42;
    const legendTop = 50;
    const legendHeight = height - 100;
    const barW = 16;

    // Background panel
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(legendX - 10, legendTop - 28, barW + 28, legendHeight + 60, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#ccc";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("V", legendX + barW / 2, legendTop - 14);

    // Color bar
    for (let i = 0; i < legendHeight; i++) {
      const t = 1 - i / legendHeight; // top = positive, bottom = negative
      const V = t * 240 - 120; // map to [-120, 120]
      const [r, g, b] = potentialToColor(V);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(legendX, legendTop + i, barW, 1);
    }

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendTop, barW, legendHeight);

    // Tick labels
    ctx.fillStyle = "#aaa";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    const labels = ["+V", "0", "\u2212V"];
    const positions = [legendTop + 6, legendTop + legendHeight / 2 + 3, legendTop + legendHeight - 2];
    for (let i = 0; i < labels.length; i++) {
      ctx.fillText(labels[i], legendX + barW + 4, positions[i]);
    }
  }

  /** Draw an info panel in the top-left. */
  function drawInfoPanel(): void {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 82, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Electric Potential (Voltage)", 16, 26);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#ccc";
    ctx.fillText("V = kQ / r  (superposition)", 16, 44);
    ctx.fillText("Equipotential lines \u22A5 field lines", 16, 60);

    // Show midpoint potential
    const midV = potentialAt((q1x + q2x) / 2, (q1y + q2y) / 2);
    ctx.fillStyle = "#999";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Midpoint potential: ${midV.toFixed(1)} (arb. units)`, 16, 78);
  }

  function render(): void {
    // Build and draw the heat map
    buildFieldImage();
    if (fieldImageData) {
      ctx.putImageData(fieldImageData, 0, 0);
    }

    // Equipotential contour lines
    drawEquipotentialLines();

    // Optional electric field arrows
    if (showFieldLines) {
      drawFieldArrows();
    }

    // Charges
    drawCharge(q1x, q1y, charge1);
    drawCharge(q2x, q2y, charge2);

    // Legend and info
    drawLegend();
    drawInfoPanel();

    // Footer formula
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Equipotential lines are always perpendicular to electric field lines.",
      width / 2,
      height - 10
    );
  }

  function reset(): void {
    time = 0;
    fieldImageData = null;
    lastFieldHash = "";
    positionCharges();
  }

  function destroy(): void {
    fieldImageData = null;
  }

  function getStateDescription(): string {
    const sep = Math.hypot(q2x - q1x, q2y - q1y);
    const midV = potentialAt((q1x + q2x) / 2, (q1y + q2y) / 2);
    const midField = fieldAt((q1x + q2x) / 2, (q1y + q2y) / 2);
    const midE = Math.sqrt(midField.ex ** 2 + midField.ey ** 2);
    return (
      `Electric Potential simulation: charge1=${charge1 > 0 ? "+" : ""}${charge1}, ` +
      `charge2=${charge2 > 0 ? "+" : ""}${charge2}. ` +
      `Grid resolution=${gridResolution}, field arrows ${showFieldLines ? "ON" : "OFF"}. ` +
      `Charge separation=${sep.toFixed(0)}px. ` +
      `Midpoint potential V=${midV.toFixed(1)}, midpoint field |E|=${midE.toFixed(2)}. ` +
      `Potential V=kQ/r is a scalar field; equipotential lines (contours of equal V) are ` +
      `always perpendicular to electric field lines. The heat map shows red for positive V ` +
      `and blue for negative V.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    fieldImageData = null;
    lastFieldHash = "";
    positionCharges();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectricPotentialFactory;
