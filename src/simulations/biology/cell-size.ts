import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CellSizeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("cell-size") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let divisions = 0; // 0=1 cell, 1=8 cells, 2=64 cells, 3=512 cells
  let showRatio = 1;
  let animationPhase = 0;
  let cellOpacity = 0.7;

  // Computed values
  let currentDivisions = 0; // smoothly animated toward target

  // 3D projection helpers
  const CAMERA_DIST = 5;
  const FOV = 0.8;

  interface Vec3 {
    x: number;
    y: number;
    z: number;
  }

  interface Projected {
    x: number;
    y: number;
    scale: number;
    depth: number;
  }

  function rotateY(p: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: p.x * cos + p.z * sin,
      y: p.y,
      z: -p.x * sin + p.z * cos,
    };
  }

  function rotateX(p: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: p.x,
      y: p.y * cos - p.z * sin,
      z: p.y * sin + p.z * cos,
    };
  }

  function project(p: Vec3): Projected {
    const z = p.z + CAMERA_DIST;
    const scale = FOV / (z > 0.1 ? z : 0.1);
    const viewSize = Math.min(width, height) * 0.35;
    return {
      x: width * 0.35 + p.x * scale * viewSize,
      y: height * 0.45 + p.y * scale * viewSize,
      scale: scale,
      depth: z,
    };
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawCube(
    center: Vec3, size: number, color: string, alpha: number,
    rotY: number, rotX: number
  ): void {
    const half = size / 2;

    // 8 vertices of cube
    const vertices: Vec3[] = [
      { x: center.x - half, y: center.y - half, z: center.z - half },
      { x: center.x + half, y: center.y - half, z: center.z - half },
      { x: center.x + half, y: center.y + half, z: center.z - half },
      { x: center.x - half, y: center.y + half, z: center.z - half },
      { x: center.x - half, y: center.y - half, z: center.z + half },
      { x: center.x + half, y: center.y - half, z: center.z + half },
      { x: center.x + half, y: center.y + half, z: center.z + half },
      { x: center.x - half, y: center.y + half, z: center.z + half },
    ];

    // Apply rotation
    const rotated = vertices.map(v => {
      let p = { x: v.x - center.x, y: v.y - center.y, z: v.z - center.z };
      p = rotateY(p, rotY);
      p = rotateX(p, rotX);
      return { x: p.x + center.x, y: p.y + center.y, z: p.z + center.z };
    });

    const projected = rotated.map(v => project(v));

    // 6 faces with indices
    const faces = [
      { indices: [0, 1, 2, 3], normal: { x: 0, y: 0, z: -1 } }, // front
      { indices: [5, 4, 7, 6], normal: { x: 0, y: 0, z: 1 } },  // back
      { indices: [4, 0, 3, 7], normal: { x: -1, y: 0, z: 0 } }, // left
      { indices: [1, 5, 6, 2], normal: { x: 1, y: 0, z: 0 } },  // right
      { indices: [4, 5, 1, 0], normal: { x: 0, y: -1, z: 0 } }, // top
      { indices: [3, 2, 6, 7], normal: { x: 0, y: 1, z: 0 } },  // bottom
    ];

    // Sort faces by average depth (painter's algorithm)
    const sortedFaces = faces.map(face => {
      const avgDepth = face.indices.reduce((s, i) => s + projected[i].depth, 0) / 4;
      return { ...face, avgDepth };
    }).sort((a, b) => b.avgDepth - a.avgDepth);

    for (const face of sortedFaces) {
      const pts = face.indices.map(i => projected[i]);

      // Rotate normal for lighting
      let n = face.normal;
      n = rotateY(n, rotY);
      n = rotateX(n, rotX);

      // Simple lighting: light from upper-left-front
      const lightDir = { x: -0.5, y: -0.7, z: -0.5 };
      const lightMag = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2);
      const dot = (n.x * lightDir.x + n.y * lightDir.y + n.z * lightDir.z) / lightMag;
      const brightness = Math.max(0.2, Math.min(1, 0.4 + dot * 0.6));

      // Draw face
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();

      // Parse color and apply brightness
      ctx.fillStyle = adjustColorBrightness(color, brightness, alpha);
      ctx.fill();

      // Edge
      ctx.strokeStyle = adjustColorBrightness(color, Math.min(1, brightness + 0.2), alpha * 0.8);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function adjustColorBrightness(hex: string, brightness: number, alpha: number): string {
    // Parse hex color
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${Math.floor(r * brightness)}, ${Math.floor(g * brightness)}, ${Math.floor(b * brightness)}, ${alpha})`;
  }

  function drawDividedCells(n: number, rotY: number, rotX: number): void {
    // n = number of divisions along each axis
    // Total cells = n^3
    const totalSize = 1.6; // total cube size in 3D units
    const cellSize = totalSize / n;
    const gap = cellSize * 0.08; // gap between cells
    const actualCellSize = cellSize - gap;

    // Cell colors: alternate for visual distinction
    const colors = ["#22c55e", "#16a34a", "#15803d", "#14532d", "#10b981", "#059669"];

    // Collect all cells with their depth for sorting
    const cells: Array<{ center: Vec3; size: number; color: string; depth: number }> = [];

    for (let ix = 0; ix < n; ix++) {
      for (let iy = 0; iy < n; iy++) {
        for (let iz = 0; iz < n; iz++) {
          const cx = (ix + 0.5) * cellSize - totalSize / 2;
          const cy = (iy + 0.5) * cellSize - totalSize / 2;
          const cz = (iz + 0.5) * cellSize - totalSize / 2;

          // Rotate center to get depth for sorting
          let p = { x: cx, y: cy, z: cz };
          p = rotateY(p, rotY);
          p = rotateX(p, rotX);

          const colorIdx = (ix + iy + iz) % colors.length;

          cells.push({
            center: { x: cx, y: cy, z: cz },
            size: actualCellSize,
            color: colors[colorIdx],
            depth: p.z + CAMERA_DIST,
          });
        }
      }
    }

    // Sort by depth (back to front)
    cells.sort((a, b) => b.depth - a.depth);

    for (const cell of cells) {
      drawCube(cell.center, cell.size, cell.color, cellOpacity, rotY, rotX);
    }
  }

  function drawSingleCell(rotY: number, rotX: number): void {
    drawCube({ x: 0, y: 0, z: 0 }, 1.6, "#22c55e", cellOpacity, rotY, rotX);

    // Draw a "nucleus" hint (small dot at center after projection)
    const center = project(rotateX(rotateY({ x: 0, y: 0, z: 0 }, rotY), rotX));
    ctx.fillStyle = `rgba(100, 200, 150, ${cellOpacity * 0.5})`;
    ctx.beginPath();
    ctx.arc(center.x, center.y, 8 * center.scale * Math.min(width, height) * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawInfoPanel(): void {
    const n = Math.pow(2, divisions); // divisions per axis
    const totalCells = Math.pow(n, 3);
    const L = 1; // original side length (arbitrary units)
    const cellSide = L / n;

    // SA and V calculations
    const origSA = 6 * L * L;
    const origV = L * L * L;
    const origRatio = origSA / origV;

    const cellSA = 6 * cellSide * cellSide;
    const cellV = cellSide * cellSide * cellSide;
    const cellRatio = cellSA / cellV;

    const totalSA = totalCells * cellSA;
    const totalV = totalCells * cellV; // = origV always

    const panelX = width * 0.62;
    const panelY = height * 0.12;
    const panelW = width * 0.35;
    const panelH = height * 0.76;

    // Panel background
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const fontSize = Math.max(10, Math.min(13, width / 55));
    const smallFont = Math.max(9, Math.min(11, width / 65));
    let y = panelY + 20;
    const lineH = fontSize + 8;
    const x = panelX + 14;
    const xr = panelX + panelW - 14;

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = `bold ${fontSize + 2}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Surface Area to Volume", x, y);
    y += lineH + 4;

    // Divisions info
    ctx.fillStyle = "rgba(100, 200, 150, 0.8)";
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillText(`Divisions: ${divisions}`, x, y);
    ctx.textAlign = "right";
    ctx.fillText(`${n}\u00B3 = ${totalCells} cells`, xr, y);
    y += lineH + 6;

    // Divider
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(xr, y);
    ctx.stroke();
    y += 10;

    // Original cube stats
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = `bold ${smallFont}px system-ui, sans-serif`;
    ctx.fillText("ORIGINAL CUBE (L = 1)", x, y);
    y += lineH;

    ctx.font = `${smallFont}px 'SF Mono', monospace`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`SA = 6L\u00B2 = ${origSA.toFixed(1)}`, x, y);
    ctx.textAlign = "right";
    ctx.fillText(`V = L\u00B3 = ${origV.toFixed(1)}`, xr, y);
    y += lineH;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.fillText(`SA:V = 6/L = ${origRatio.toFixed(1)}`, x, y);
    y += lineH + 6;

    // Divider
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(xr, y);
    ctx.stroke();
    y += 10;

    // Individual cell stats
    if (divisions > 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = `bold ${smallFont}px system-ui, sans-serif`;
      ctx.fillText(`EACH SMALL CELL (L/${n})`, x, y);
      y += lineH;

      ctx.font = `${smallFont}px 'SF Mono', monospace`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText(`SA = 6(L/${n})\u00B2 = ${cellSA.toFixed(4)}`, x, y);
      y += lineH;
      ctx.fillText(`V = (L/${n})\u00B3 = ${cellV.toFixed(6)}`, x, y);
      y += lineH;
      ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
      ctx.fillText(`SA:V = 6n/L = ${cellRatio.toFixed(1)}`, x, y);
      y += lineH + 6;

      // Divider
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(xr, y);
      ctx.stroke();
      y += 10;

      // Totals
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = `bold ${smallFont}px system-ui, sans-serif`;
      ctx.fillText("ALL CELLS COMBINED", x, y);
      y += lineH;

      ctx.font = `${smallFont}px 'SF Mono', monospace`;
      ctx.fillStyle = "rgba(100, 200, 150, 0.8)";
      ctx.fillText(`Total SA = ${totalSA.toFixed(1)}`, x, y);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText(`(\u00D7${n} increase)`, xr, y);
      y += lineH;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(100, 150, 255, 0.8)";
      ctx.fillText(`Total V = ${totalV.toFixed(1)}`, x, y);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText("(unchanged)", xr, y);
      y += lineH + 6;
    }

    // Bar chart comparison
    y += 4;
    drawBarChart(panelX + 14, y, panelW - 28, Math.min(80, panelH - (y - panelY) - 20), divisions);

    // Key insight
    const insightY = panelY + panelH - 30;
    ctx.fillStyle = "rgba(255, 200, 100, 0.6)";
    ctx.font = `italic ${smallFont}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Smaller cells = more surface per volume", panelX + panelW / 2, insightY);
    ctx.fillText("= more efficient nutrient exchange", panelX + panelW / 2, insightY + lineH);
  }

  function drawBarChart(bx: number, by: number, bw: number, bh: number, div: number): void {
    const fontSize = Math.max(8, Math.min(10, width / 70));

    // Compare SA:V ratios for different division levels
    const levels = [0, 1, 2, 3];
    const maxRatio = 6 * Math.pow(2, 3); // max at 3 divisions

    const barW = bw / (levels.length * 2 + 1);
    const spacing = barW;

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("SA:V Ratio by Division Level", bx + bw / 2, by);

    for (let i = 0; i < levels.length; i++) {
      const n = Math.pow(2, levels[i]);
      const ratio = 6 * n;
      const barH = (ratio / maxRatio) * (bh - 20);
      const x = bx + spacing + i * (barW + spacing);
      const y = by + bh - barH;

      const isActive = levels[i] === div;

      // Bar
      ctx.fillStyle = isActive ? "rgba(100, 200, 150, 0.7)" : "rgba(100, 200, 150, 0.25)";
      ctx.fillRect(x, y, barW, barH);

      if (isActive) {
        ctx.strokeStyle = "rgba(100, 200, 150, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, barW, barH);
      }

      // Label
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.4)";
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`${Math.pow(n, 3)}`, x + barW / 2, by + bh + 2);

      // Ratio value on top
      ctx.textBaseline = "bottom";
      ctx.fillText(`${ratio}`, x + barW / 2, y - 2);
    }

    // Axis label
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = `${fontSize - 1}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("# cells", bx + bw / 2, by + bh + fontSize + 4);
  }

  function drawNutrientArrows(): void {
    // Show nutrient exchange arrows on surfaces of the 3D visualization
    const arrowAlpha = 0.3 + 0.2 * Math.sin(time * 2);
    const n = Math.pow(2, divisions);

    // Draw small arrows around the cube representation
    const rotYAngle = time * 0.3 + animationPhase * Math.PI * 2;
    const rotXAngle = 0.4;

    const arrowSize = 0.15 / n;
    const arrowCount = Math.min(8, n * 2);

    ctx.strokeStyle = `rgba(255, 200, 100, ${arrowAlpha})`;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < arrowCount; i++) {
      const angle = (i / arrowCount) * Math.PI * 2;
      const dist = 0.9;

      let p: Vec3 = {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist * 0.3,
        z: Math.sin(angle * 0.7) * dist * 0.5,
      };

      p = rotateY(p, rotYAngle);
      p = rotateX(p, rotXAngle);

      const pp = project(p);
      const arrowLen = 12 * pp.scale * Math.min(width, height) * 0.35;

      // Arrow pointing inward (nutrients entering)
      const dx = width * 0.35 - pp.x;
      const dy = height * 0.45 - pp.y;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < 1) continue;

      const nx = dx / mag;
      const ny = dy / mag;

      ctx.beginPath();
      ctx.moveTo(pp.x, pp.y);
      ctx.lineTo(pp.x + nx * arrowLen, pp.y + ny * arrowLen);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = `rgba(255, 200, 100, ${arrowAlpha})`;
      ctx.beginPath();
      ctx.moveTo(pp.x + nx * arrowLen, pp.y + ny * arrowLen);
      ctx.lineTo(
        pp.x + nx * arrowLen * 0.7 - ny * 3,
        pp.y + ny * arrowLen * 0.7 + nx * 3
      );
      ctx.lineTo(
        pp.x + nx * arrowLen * 0.7 + ny * 3,
        pp.y + ny * arrowLen * 0.7 - nx * 3
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `bold ${Math.max(12, Math.min(15, width / 45))}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Why Are Cells Small?", 12, 10);

    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = `${Math.max(10, Math.min(12, width / 55))}px system-ui, sans-serif`;
    ctx.fillText("Surface Area to Volume Ratio", 12, 30);

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "right";
    ctx.fillText(`t = ${time.toFixed(1)}s`, width - 12, 12);
  }

  function drawFormula(): void {
    const y = height * 0.9;
    const fontSize = Math.max(10, Math.min(12, width / 55));

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(10, y - 8, width * 0.5, 36, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `${fontSize}px 'SF Mono', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Cube side L: SA = 6L\u00B2, V = L\u00B3, SA:V = 6/L", 18, y + 10);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentDivisions = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    divisions = Math.round(params.divisions ?? 0);
    showRatio = params.showRatio ?? 1;
    animationPhase = params.animationPhase ?? 0;
    cellOpacity = params.cellOpacity ?? 0.7;

    // Smooth animation toward target divisions
    if (currentDivisions < divisions) {
      currentDivisions += dt * 2;
      if (currentDivisions > divisions) currentDivisions = divisions;
    } else if (currentDivisions > divisions) {
      currentDivisions -= dt * 2;
      if (currentDivisions < divisions) currentDivisions = divisions;
    }
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();

    const rotYAngle = time * 0.3 + animationPhase * Math.PI * 2;
    const rotXAngle = 0.4;

    // Draw the 3D cells
    const n = Math.pow(2, divisions);
    if (n <= 1) {
      drawSingleCell(rotYAngle, rotXAngle);
    } else {
      // Limit rendering for large cell counts
      const renderN = Math.min(n, 8); // cap at 8x8x8 = 512
      drawDividedCells(renderN, rotYAngle, rotXAngle);
    }

    drawNutrientArrows();

    // Info panel
    if (showRatio > 0.5) {
      drawInfoPanel();
    }

    drawTitle();
    drawFormula();
  }

  function reset(): void {
    time = 0;
    currentDivisions = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const n = Math.pow(2, divisions);
    const totalCells = Math.pow(n, 3);
    const cellSide = 1 / n;
    const cellSA = 6 * cellSide * cellSide;
    const cellRatio = 6 * n;
    const totalSA = totalCells * cellSA;

    return (
      `Cell Size simulation: ${divisions} divisions, ${totalCells} total cells (${n}\u00B3). ` +
      `Original cube: SA = 6, V = 1, SA:V = 6. ` +
      `After division: each cell side = 1/${n}, cell SA:V = ${cellRatio.toFixed(1)}. ` +
      `Total surface area = ${totalSA.toFixed(1)} (${n}\u00D7 increase), ` +
      `total volume = 1 (unchanged). ` +
      `Key concept: As cells get smaller, the SA:V ratio increases linearly (SA:V = 6n/L), ` +
      `which means more membrane surface per unit volume for nutrient exchange and waste removal. ` +
      `This is why cells must divide to maintain efficient transport. ` +
      `Cell opacity: ${(cellOpacity * 100).toFixed(0)}%. Time: ${time.toFixed(1)}s.`
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

export default CellSizeFactory;
