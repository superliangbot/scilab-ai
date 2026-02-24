import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "force-on-inclined-plane",
  title: "Force on Inclined Plane",
  category: "physics",
  description:
    "Decompose gravitational force on an inclined plane into parallel and normal components.",
  longDescription:
    "When an object sits on an inclined plane, gravity (mg) decomposes into two components: a force parallel to the slope (mg·sinθ) that tends to slide the object downhill, and a normal force perpendicular to the surface (mg·cosθ). This simulation visualizes these force vectors as the incline angle changes, showing how steeper angles increase the sliding force while reducing the normal force.",
  parameters: [
    { key: "angle", label: "Incline Angle", min: 0, max: 85, step: 1, defaultValue: 30, unit: "°" },
    { key: "mass", label: "Mass", min: 0.5, max: 10, step: 0.5, defaultValue: 2, unit: "kg" },
    { key: "gravity", label: "Gravity", min: 5, max: 15, step: 0.5, defaultValue: 9.81, unit: "m/s²" },
    { key: "showComponents", label: "Show Components (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
  ],
  thumbnailColor: "#7c3aed",
};

const ForceOnInclinedPlaneFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let angle = 30;
  let mass = 2;
  let gravity = 9.81;
  let showComponents = 1;

  function degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, lineW: number, label: string, labelSide: number = 0) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;

    const headLen = 12;
    const headAngle = 0.4;
    const ang = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(ang - headAngle), y2 - headLen * Math.sin(ang - headAngle));
    ctx.lineTo(x2 - headLen * Math.cos(ang + headAngle), y2 - headLen * Math.sin(ang + headAngle));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    if (label) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const perpX = -dy / len * (20 * labelSide || 20);
      const perpY = dx / len * (20 * labelSide || 20);
      ctx.fillStyle = color;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, mx + perpX, my + perpY);
    }
  }

  function drawAngleArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, color: string, label: string) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const midAngle = (startAngle + endAngle) / 2;
    ctx.fillStyle = color;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx + (r + 14) * Math.cos(midAngle), cy + (r + 14) * Math.sin(midAngle));
  }

  function drawInclinedPlane() {
    const rad = degToRad(angle);
    const planeLen = Math.min(W, H) * 0.55;
    const baseX = W * 0.15;
    const baseY = H * 0.65;

    // Plane triangle
    const topX = baseX + planeLen * Math.cos(rad);
    const topY = baseY - planeLen * Math.sin(rad);

    // Ground
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, baseY, W, H - baseY);

    // Triangle fill
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(topX, topY);
    ctx.lineTo(topX, baseY);
    ctx.closePath();
    ctx.fillStyle = "#cbd5e1";
    ctx.fill();
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Angle arc
    drawAngleArc(baseX, baseY, 40, -rad, 0, "#8b5cf6", `θ = ${angle}°`);

    // Hash marks on slope
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    for (let i = 0.1; i < 0.9; i += 0.08) {
      const sx = baseX + planeLen * i * Math.cos(rad);
      const sy = baseY - planeLen * i * Math.sin(rad);
      const nx = -Math.sin(rad) * 8;
      const ny = -Math.cos(rad) * 8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + nx, sy + ny);
      ctx.stroke();
    }

    return { baseX, baseY, topX, topY, planeLen };
  }

  function drawBlock(bx: number, by: number, angleRad: number) {
    const blockSize = 35 + mass * 3;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-angleRad);

    // Block
    const grad = ctx.createLinearGradient(-blockSize / 2, -blockSize, blockSize / 2, 0);
    grad.addColorStop(0, "#3b82f6");
    grad.addColorStop(1, "#2563eb");
    ctx.fillStyle = grad;
    ctx.fillRect(-blockSize / 2, -blockSize, blockSize, blockSize);
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.strokeRect(-blockSize / 2, -blockSize, blockSize, blockSize);

    // Mass label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mass}kg`, 0, -blockSize / 2);

    ctx.restore();

    return { blockSize };
  }

  function drawForceVectors(bx: number, by: number, angleRad: number, blockSize: number) {
    const mg = mass * gravity;
    const scale = 3;

    // Weight (mg) - always straight down
    const mgLen = mg * scale;
    drawArrow(bx, by - blockSize / 2, bx, by - blockSize / 2 + mgLen, "#1e293b", 3, `mg = ${mg.toFixed(1)} N`, -1);

    if (showComponents) {
      // Parallel component (down the slope)
      const Fp = mg * Math.sin(angleRad);
      const fpLen = Fp * scale;
      const fpX = bx + fpLen * Math.cos(angleRad);
      const fpY = by - blockSize / 2 + fpLen * Math.sin(angleRad);
      // Adjust direction: parallel goes down slope from block center
      drawArrow(bx, by - blockSize / 2, bx - fpLen * Math.cos(angleRad), by - blockSize / 2 + fpLen * Math.sin(angleRad), "#ef4444", 3, `F∥ = ${Fp.toFixed(1)} N`, 1);

      // Normal component (into the surface)
      const Fn = mg * Math.cos(angleRad);
      const fnLen = Fn * scale;
      drawArrow(bx, by - blockSize / 2, bx + fnLen * Math.sin(angleRad), by - blockSize / 2 + fnLen * Math.cos(angleRad), "#22c55e", 3, `F⊥ = ${Fn.toFixed(1)} N`, -1);

      // Normal force (reaction, pointing away from surface)
      drawArrow(bx, by - blockSize / 2, bx - fnLen * Math.sin(angleRad), by - blockSize / 2 - fnLen * Math.cos(angleRad), "#06b6d4", 2.5, `N = ${Fn.toFixed(1)} N`, 1);

      // Dashed guides
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, by - blockSize / 2 + mgLen);
      ctx.lineTo(bx - fpLen * Math.cos(angleRad), by - blockSize / 2 + fpLen * Math.sin(angleRad));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, by - blockSize / 2 + mgLen);
      ctx.lineTo(bx + fnLen * Math.sin(angleRad), by - blockSize / 2 + fnLen * Math.cos(angleRad));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawGraph() {
    const gx = W * 0.62;
    const gy = H * 0.08;
    const gw = W * 0.34;
    const gh = H * 0.5;

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(gx, gy, gw, gh);

    // Axes
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + 30, gy + gh - 25);
    ctx.lineTo(gx + gw - 10, gy + gh - 25);
    ctx.moveTo(gx + 30, gy + gh - 25);
    ctx.lineTo(gx + 30, gy + 10);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("θ (degrees)", gx + gw / 2, gy + gh - 6);
    ctx.save();
    ctx.translate(gx + 12, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Force (N)", 0, 0);
    ctx.restore();

    const mg = mass * gravity;
    const plotW = gw - 50;
    const plotH = gh - 50;
    const plotX = gx + 35;
    const plotY = gy + 15;

    // Draw F_parallel and F_normal curves
    const curves = [
      { fn: (a: number) => mg * Math.sin(degToRad(a)), color: "#ef4444", label: "mg·sin(θ)" },
      { fn: (a: number) => mg * Math.cos(degToRad(a)), color: "#22c55e", label: "mg·cos(θ)" },
    ];

    for (const curve of curves) {
      ctx.beginPath();
      ctx.strokeStyle = curve.color;
      ctx.lineWidth = 2;
      for (let a = 0; a <= 90; a++) {
        const px = plotX + (a / 90) * plotW;
        const py = plotY + plotH - (curve.fn(a) / mg) * plotH;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Current angle marker
    const markerX = plotX + (angle / 90) * plotW;
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(markerX, plotY);
    ctx.lineTo(markerX, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    for (let i = 0; i < curves.length; i++) {
      ctx.fillStyle = curves[i].color;
      ctx.fillRect(plotX + plotW - 90, plotY + 5 + i * 16, 12, 3);
      ctx.fillText(curves[i].label, plotX + plotW - 74, plotY + 10 + i * 16);
    }

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    for (let a = 0; a <= 90; a += 15) {
      const px = plotX + (a / 90) * plotW;
      ctx.fillText(`${a}°`, px, plotY + plotH + 12);
    }
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    angle = params.angle ?? 30;
    mass = params.mass ?? 2;
    gravity = params.gravity ?? 9.81;
    showComponents = params.showComponents ?? 1;
    time += dt;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#f8fafc");
    bg.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Forces on an Inclined Plane", W / 2, 24);

    const { baseX, baseY, planeLen } = drawInclinedPlane();

    // Position block on slope
    const rad = degToRad(angle);
    const blockFrac = 0.45;
    const bx = baseX + planeLen * blockFrac * Math.cos(rad);
    const by = baseY - planeLen * blockFrac * Math.sin(rad);

    const { blockSize } = drawBlock(bx, by, rad);
    drawForceVectors(bx, by, rad, blockSize);
    drawGraph();

    // Formulas
    ctx.fillStyle = "#475569";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F∥ = mg·sin(θ)    F⊥ = mg·cos(θ)    N = mg·cos(θ)", W / 2, H - 14);
  }

  function reset() {
    time = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    const mg = mass * gravity;
    const Fp = mg * Math.sin(degToRad(angle));
    const Fn = mg * Math.cos(degToRad(angle));
    return `Inclined plane at θ=${angle}°. Object mass=${mass} kg, weight mg=${mg.toFixed(1)} N. Parallel force (down slope) F∥=mg·sin(${angle}°)=${Fp.toFixed(1)} N. Normal force F⊥=mg·cos(${angle}°)=${Fn.toFixed(1)} N. ${angle > 60 ? "Steep incline — sliding force dominates." : angle < 15 ? "Shallow incline — normal force dominates." : "Moderate incline."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ForceOnInclinedPlaneFactory;
