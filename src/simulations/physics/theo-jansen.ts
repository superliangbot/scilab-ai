import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TheoJansenFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("theo-jansen") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let crankSpeed = 2;
  let numLegs = 2;
  let scale = 1;
  let showTrace = 1;

  // Jansen's "holy numbers" - the link lengths
  const a = 38.0;   // crank radius
  const b = 41.5;   // link lengths
  const c = 39.3;
  const d = 40.1;
  const e = 55.8;
  const f = 39.4;
  const g = 36.7;
  const h = 65.7;
  const i_ = 49.0;
  const j = 50.0;
  const k = 61.9;
  const l = 7.8;
  const m = 15.0;   // fixed pivot offset

  // Foot path traces per leg
  let traces: Array<Array<{ x: number; y: number }>> = [];

  function solveTriangle(
    ax: number, ay: number,
    bx: number, by: number,
    lenA: number, lenB: number,
    side: number
  ): { x: number; y: number } | null {
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > lenA + lenB || dist < Math.abs(lenA - lenB)) return null;
    const aAngle = Math.atan2(dy, dx);
    const cosA = (lenA * lenA + dist * dist - lenB * lenB) / (2 * lenA * dist);
    const clampedCos = Math.max(-1, Math.min(1, cosA));
    const angle = Math.acos(clampedCos);
    return {
      x: ax + lenA * Math.cos(aAngle + side * angle),
      y: ay + lenA * Math.sin(aAngle + side * angle),
    };
  }

  function computeLeg(crankAngle: number, originX: number, originY: number, sc: number): {
    joints: Array<{ x: number; y: number }>;
    foot: { x: number; y: number };
  } | null {
    // Fixed pivot O at origin, crank pivot M offset
    const ox = originX;
    const oy = originY;
    const mx = originX + m * sc;
    const my = originY;

    // Crank point A
    const ax = ox + a * sc * Math.cos(crankAngle);
    const ay = oy + a * sc * Math.sin(crankAngle);

    // B is connected to A with length b, and to M with length c
    const B = solveTriangle(ax, ay, mx, my, b * sc, c * sc, 1);
    if (!B) return null;

    // C is connected to A with length d, and to O with length e
    const C = solveTriangle(ax, ay, ox, oy, d * sc, e * sc, -1);
    if (!C) return null;

    // D is connected to B with length j, and to C with length k
    const D = solveTriangle(B.x, B.y, C.x, C.y, j * sc, k * sc, -1);
    if (!D) return null;

    // E is connected to C with length h, and also related to B via i
    const E = solveTriangle(C.x, C.y, B.x, B.y, h * sc, i_ * sc, -1);
    if (!E) return null;

    // Foot F is connected to D with length g, and to E with length f
    const F = solveTriangle(D.x, D.y, E.x, E.y, g * sc, f * sc, -1);
    if (!F) return null;

    return {
      joints: [
        { x: ox, y: oy },   // O - fixed pivot
        { x: mx, y: my },   // M - second fixed pivot
        { x: ax, y: ay },   // A - crank
        { x: B.x, y: B.y }, // B
        { x: C.x, y: C.y }, // C
        { x: D.x, y: D.y }, // D
        { x: E.x, y: E.y }, // E
        { x: F.x, y: F.y }, // F - foot
      ],
      foot: F,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    traces = [];
    for (let leg = 0; leg < 6; leg++) {
      traces.push([]);
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    crankSpeed = params.crankSpeed ?? 2;
    numLegs = Math.round(params.numLegs ?? 2);
    scale = params.scale ?? 1;
    showTrace = params.showTrace ?? 1;

    time += dt;

    // Record foot traces
    const originX = width * 0.5;
    const originY = height * 0.35;
    const sc = scale * 1.8;

    for (let leg = 0; leg < numLegs; leg++) {
      const phaseOffset = (leg * Math.PI * 2) / numLegs;
      const angle = time * crankSpeed + phaseOffset;
      const result = computeLeg(angle, originX, originY, sc);
      if (result && showTrace) {
        if (!traces[leg]) traces[leg] = [];
        traces[leg].push({ x: result.foot.x, y: result.foot.y });
        if (traces[leg].length > 300) traces[leg].shift();
      }
    }
  }

  function drawLink(x1: number, y1: number, x2: number, y2: number, color: string, lineW: number): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawJoint(x: number, y: number, r: number, color: string): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawInfoPanel(): void {
    const px = 10;
    const py = height * 0.68;
    const pw = width * 0.42;
    const ph = height * 0.3;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Theo Jansen Linkage", px + 10, py + 18);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Jansen's Holy Numbers (link lengths):", px + 10, py + 36);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    let y = py + 50;
    const lineH = 13;

    ctx.fillText(`a = ${a}  (crank)`, px + 10, y);
    ctx.fillText(`b = ${b}   c = ${c}`, px + 140, y); y += lineH;
    ctx.fillText(`d = ${d}   e = ${e}`, px + 10, y);
    ctx.fillText(`f = ${f}   g = ${g}`, px + 140, y); y += lineH;
    ctx.fillText(`h = ${h}   i = ${i_}`, px + 10, y);
    ctx.fillText(`j = ${j}   k = ${k}`, px + 140, y); y += lineH;
    ctx.fillText(`l = ${l}    m = ${m} (offset)`, px + 10, y); y += lineH + 4;

    ctx.fillStyle = "#67e8f9";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Crank Speed: ${crankSpeed.toFixed(1)} rad/s`, px + 10, y);
    ctx.fillText(`Legs: ${numLegs}  Scale: ${scale.toFixed(1)}x`, px + 180, y); y += lineH + 2;

    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Converts rotary motion into a walking gait.", px + 10, y);
    ctx.fillText("Each leg traces an oval foot path.", px + 10, y + lineH);
  }

  function drawLegendAndGround(): void {
    // Ground line
    const groundY = height * 0.62;
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("ground level", width - 10, groundY - 5);
  }

  function render(): void {
    // Dark gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Theo Jansen Walking Mechanism", width / 2, 28);

    drawLegendAndGround();

    const originX = width * 0.5;
    const originY = height * 0.35;
    const sc = scale * 1.8;

    const legColors = ["#f87171", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#fb923c"];

    // Draw traces
    if (showTrace) {
      for (let leg = 0; leg < numLegs; leg++) {
        const trace = traces[leg];
        if (!trace || trace.length < 2) continue;
        ctx.strokeStyle = legColors[leg % legColors.length];
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(trace[0].x, trace[0].y);
        for (let t = 1; t < trace.length; t++) {
          ctx.lineTo(trace[t].x, trace[t].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Draw each leg
    for (let leg = 0; leg < numLegs; leg++) {
      const phaseOffset = (leg * Math.PI * 2) / numLegs;
      const angle = time * crankSpeed + phaseOffset;
      const result = computeLeg(angle, originX, originY, sc);
      if (!result) continue;

      const pts = result.joints;
      const color = legColors[leg % legColors.length];

      // Links: O-A, A-B, M-B, A-C, O-C, B-D, C-D, B-E, C-E, D-F, E-F
      const links: [number, number][] = [
        [0, 2], // O-A (crank)
        [2, 3], // A-B
        [1, 3], // M-B
        [2, 4], // A-C
        [0, 4], // O-C
        [3, 5], // B-D
        [4, 5], // C-D
        [3, 6], // B-E
        [4, 6], // C-E
        [5, 7], // D-F
        [6, 7], // E-F
      ];

      for (const [a, b] of links) {
        const lw = (a === 0 && b === 2) ? 3.5 : 2.5;
        drawLink(pts[a].x, pts[a].y, pts[b].x, pts[b].y, color, lw);
      }

      // Joints
      for (let j = 0; j < pts.length; j++) {
        const r = (j === 0 || j === 1) ? 5 : (j === 7 ? 6 : 3.5);
        const jColor = (j === 0 || j === 1) ? "#e2e8f0" : (j === 7 ? color : "#94a3b8");
        drawJoint(pts[j].x, pts[j].y, r, jColor);
      }

      // Foot highlight
      const foot = result.foot;
      const glow = ctx.createRadialGradient(foot.x, foot.y, 0, foot.x, foot.y, 12);
      glow.addColorStop(0, color.replace(")", ", 0.3)").replace("rgb", "rgba"));
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(foot.x, foot.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fixed pivot labels
    drawJoint(originX, originY, 6, "#ffffff");
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("O (fixed)", originX, originY - 12);
    ctx.fillText("M (fixed)", originX + m * sc, originY - 12);

    // Crank circle
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(originX, originY, a * sc, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    traces = [];
    for (let leg = 0; leg < 6; leg++) {
      traces.push([]);
    }
  }

  function destroy(): void {
    traces = [];
  }

  function getStateDescription(): string {
    return (
      `Theo Jansen Mechanism: ${numLegs} leg(s) at crank speed ${crankSpeed.toFixed(1)} rad/s, scale ${scale.toFixed(1)}x. ` +
      `The Jansen linkage converts rotary (crank) motion into a walking gait using a specific set of ` +
      `link lengths known as the "holy numbers." Each leg traces an oval foot path that lifts up and ` +
      `moves forward, mimicking biological walking. The mechanism has 11 links and produces a closed ` +
      `trajectory with good ground clearance during the forward swing.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TheoJansenFactory;
