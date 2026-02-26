import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TriangleAndTetragonFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("triangle-and-tetragon") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let shapeType = 0;
  let sideLength = 100;
  let showAngles = 1;
  let showDiagonal = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    shapeType = Math.round(params.shapeType ?? 0);
    sideLength = params.sideLength ?? 100;
    showAngles = params.showAngles ?? 1;
    showDiagonal = params.showDiagonal ?? 0;
    time += dt;
  }

  interface ShapeInfo {
    name: string;
    points: { x: number; y: number }[];
    angles: number[];
    area: number;
    perimeter: number;
    isQuad: boolean;
  }

  function getShape(): ShapeInfo {
    const cx = width * 0.35, cy = height * 0.45, s = sideLength;
    switch (shapeType) {
      case 1: {
        const pts = [
          { x: cx - s / 2, y: cy + s * 0.4 },
          { x: cx - s / 2, y: cy - s * 0.4 },
          { x: cx + s / 2, y: cy + s * 0.4 },
        ];
        const h = s * 0.8;
        const hyp = Math.sqrt(s * s + h * h);
        const a1 = 90, a2 = Math.atan(s / h) * 180 / Math.PI, a3 = 180 - a1 - a2;
        return { name: "Right Triangle", points: pts, angles: [a1, a2, a3], area: 0.5 * s * h, perimeter: s + h + hyp, isQuad: false };
      }
      case 2: {
        const half = s / 2;
        const pts = [
          { x: cx - half, y: cy - half }, { x: cx + half, y: cy - half },
          { x: cx + half, y: cy + half }, { x: cx - half, y: cy + half },
        ];
        return { name: "Square", points: pts, angles: [90, 90, 90, 90], area: s * s, perimeter: 4 * s, isQuad: true };
      }
      case 3: {
        const skew = s * 0.3, h = s * 0.7;
        const pts = [
          { x: cx - s / 2 + skew, y: cy - h / 2 }, { x: cx + s / 2 + skew, y: cy - h / 2 },
          { x: cx + s / 2 - skew, y: cy + h / 2 }, { x: cx - s / 2 - skew, y: cy + h / 2 },
        ];
        const angA = Math.atan2(h, 2 * skew) * 180 / Math.PI;
        const sLen = Math.sqrt(h * h + (2 * skew) ** 2);
        return { name: "Parallelogram", points: pts, angles: [angA, 180 - angA, angA, 180 - angA], area: s * h, perimeter: 2 * s + 2 * sLen, isQuad: true };
      }
      default: {
        const h = (s * Math.sqrt(3)) / 2;
        const pts = [
          { x: cx, y: cy - h * 0.6 },
          { x: cx - s / 2, y: cy + h * 0.4 },
          { x: cx + s / 2, y: cy + h * 0.4 },
        ];
        return { name: "Equilateral Triangle", points: pts, angles: [60, 60, 60], area: (Math.sqrt(3) / 4) * s * s, perimeter: 3 * s, isQuad: false };
      }
    }
  }

  function drawAngleArc(
    vx: number, vy: number, p1x: number, p1y: number, p2x: number, p2y: number,
    angle: number, color: string, idx: number
  ): void {
    const r = 22;
    const a1 = Math.atan2(p1y - vy, p1x - vx);
    const a2 = Math.atan2(p2y - vy, p2x - vx);
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.arc(vx, vy, r, a1, a2, false);
    ctx.closePath();
    ctx.fillStyle = color.replace("1)", "0.2)");
    ctx.fill();
    ctx.beginPath();
    ctx.arc(vx, vy, r, a1, a2, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Right angle symbol
    if (Math.abs(angle - 90) < 0.5) {
      const d = 12;
      const dx1 = Math.cos(a1) * d, dy1 = Math.sin(a1) * d;
      const dx2 = Math.cos(a2) * d, dy2 = Math.sin(a2) * d;
      ctx.beginPath();
      ctx.moveTo(vx + dx1, vy + dy1);
      ctx.lineTo(vx + dx1 + dx2, vy + dy1 + dy2);
      ctx.lineTo(vx + dx2, vy + dy2);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Label
    const midA = (a1 + a2) / 2;
    const lR = r + 14;
    const pulse = 0.7 + 0.3 * Math.sin(time * 2 + idx);
    ctx.fillStyle = color.replace("1)", `${pulse})`);
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${angle.toFixed(1)}\u00B0`, vx + lR * Math.cos(midA), vy + lR * Math.sin(midA));
  }

  function drawShape(): void {
    const shape = getShape();
    const pts = shape.points;
    const n = pts.length;
    const colors = ["rgba(255, 100, 100, 1)", "rgba(100, 255, 100, 1)", "rgba(100, 100, 255, 1)", "rgba(255, 255, 100, 1)"];
    // Fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[n - 1].x, pts[n - 1].y);
    grad.addColorStop(0, "rgba(60, 120, 255, 0.15)");
    grad.addColorStop(1, "rgba(100, 60, 255, 0.15)");
    ctx.fillStyle = grad;
    ctx.fill();
    // Edges
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Vertices and labels
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 4, 0, Math.PI * 2);
      ctx.fillStyle = colors[i % 4]; ctx.fill();
      const prev = (i - 1 + n) % n, next = (i + 1) % n;
      const mx = (pts[prev].x + pts[next].x) / 2, my = (pts[prev].y + pts[next].y) / 2;
      const dx = pts[i].x - mx, dy = pts[i].y - my;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.fillStyle = colors[i % 4]; ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String.fromCharCode(65 + i), pts[i].x + (dx / dist) * 18, pts[i].y + (dy / dist) * 18);
    }
    // Side lengths
    ctx.font = "11px system-ui, sans-serif"; ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const dx = pts[next].x - pts[i].x, dy = pts[next].y - pts[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len * 14, ny = dx / len * 14;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`${len.toFixed(0)}`, (pts[i].x + pts[next].x) / 2 + nx, (pts[i].y + pts[next].y) / 2 + ny);
    }
    // Angles
    if (showAngles >= 1) {
      for (let i = 0; i < n; i++) {
        const prev = (i - 1 + n) % n, next = (i + 1) % n;
        drawAngleArc(pts[i].x, pts[i].y, pts[prev].x, pts[prev].y, pts[next].x, pts[next].y, shape.angles[i], colors[i % 4], i);
      }
    }
    // Diagonal
    if (shape.isQuad && showDiagonal >= 1) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[2].x, pts[2].y);
      ctx.strokeStyle = "rgba(255, 200, 50, 0.7)"; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255, 200, 50, 0.6)"; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("\u25B3 1", (pts[0].x + pts[1].x + pts[2].x) / 3, (pts[0].y + pts[1].y + pts[2].y) / 3);
      ctx.fillText("\u25B3 2", (pts[0].x + pts[2].x + pts[3].x) / 3, (pts[0].y + pts[2].y + pts[3].y) / 3);
    }
  }

  function drawAngleSumDemo(): void {
    const shape = getShape();
    const n = shape.points.length;
    const dx = width * 0.68, dy = height * 0.08, dr = 40;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.fillText("Angle Sum", dx, dy);
    const colors = ["rgba(255, 100, 100, 0.5)", "rgba(100, 255, 100, 0.5)", "rgba(100, 100, 255, 0.5)", "rgba(255, 255, 100, 0.5)"];
    const totalDeg = shape.isQuad ? 360 : 180;
    const center = { x: dx, y: dy + 55 };
    let startA = -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const sweep = (shape.angles[i] / totalDeg) * (shape.isQuad ? Math.PI * 2 : Math.PI);
      ctx.beginPath(); ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, dr, startA, startA + sweep);
      ctx.closePath(); ctx.fillStyle = colors[i % 4]; ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; ctx.lineWidth = 1; ctx.stroke();
      if (sweep > 0.3) {
        const mid = startA + sweep / 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${shape.angles[i].toFixed(0)}\u00B0`, center.x + dr * 0.55 * Math.cos(mid), center.y + dr * 0.55 * Math.sin(mid));
      }
      startA += sweep;
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`= ${shape.angles.reduce((a, b) => a + b, 0).toFixed(0)}\u00B0`, dx, center.y + dr + 18);
  }

  function renderInfoPanel(): void {
    const px = width * 0.62, py = height * 0.38, pw = width * 0.36, ph = height * 0.58;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.strokeStyle = "rgba(80, 150, 255, 0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill(); ctx.stroke();
    const shape = getShape();
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "left";
    let y = py + 24; const lh = 19;
    ctx.fillText(shape.name, px + 12, y); y += lh + 4;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.font = "12px system-ui, sans-serif";
    if (shape.isQuad) {
      ctx.fillText("Quadrilateral Properties:", px + 12, y); y += lh;
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)"; ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("Sum of angles = 360\u00B0", px + 12, y); y += lh;
      ctx.fillText("Divisible into 2 triangles", px + 12, y); y += lh;
    } else {
      ctx.fillText("Triangle Properties:", px + 12, y); y += lh;
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)"; ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("Sum of angles = 180\u00B0", px + 12, y); y += lh;
      ctx.fillText(shapeType === 0 ? "All sides & angles equal" : "One angle = 90\u00B0", px + 12, y); y += lh;
      if (shapeType === 1) { ctx.fillText("a\u00B2 + b\u00B2 = c\u00B2", px + 12, y); y += lh; }
    }
    y += 6;
    ctx.fillStyle = "#ffcc44"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Area = ${shape.area.toFixed(1)} px\u00B2`, px + 12, y); y += lh;
    ctx.fillText(`Perimeter = ${shape.perimeter.toFixed(1)} px`, px + 12, y); y += lh + 6;
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; ctx.fillText("Angles:", px + 12, y); y += lh;
    const ac = ["#ff6666", "#66ff66", "#6666ff", "#ffff66"];
    for (let i = 0; i < shape.angles.length; i++) {
      ctx.fillStyle = ac[i % 4];
      ctx.fillText(`  ${String.fromCharCode(65 + i)}: ${shape.angles[i].toFixed(1)}\u00B0`, px + 12, y); y += lh;
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText(`  Sum: ${shape.angles.reduce((a, b) => a + b, 0).toFixed(1)}\u00B0`, px + 12, y); y += lh + 6;
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)"; ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(shape.isQuad ? "Area (parallelogram) = bh" : "Area = \u00BDbh", px + 12, y);
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a20"); bgGrad.addColorStop(1, "#0e0e2a");
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, width, height);
    // Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)"; ctx.lineWidth = 0.5;
    for (let gx = 0; gx < width; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke(); }
    for (let gy = 0; gy < height; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke(); }
    drawShape();
    drawAngleSumDemo();
    renderInfoPanel();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const shape = getShape();
    const sum = shape.angles.reduce((a, b) => a + b, 0);
    return `${shape.name}: side=${sideLength}px, angles=[${shape.angles.map(a => a.toFixed(1)).join(", ")}] ` +
      `(sum=${sum.toFixed(1)}\u00B0), area=${shape.area.toFixed(1)}px\u00B2, perimeter=${shape.perimeter.toFixed(1)}px.`;
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TriangleAndTetragonFactory;
