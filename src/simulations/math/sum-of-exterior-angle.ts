import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SumOfExteriorAngleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("sum-of-exterior-angle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // State
  let sides = 5;
  let animSpeed = 1;
  let showLabels = 1;
  let walkerProgress = 0; // 0 to sides (fractional), tracks walking animation
  let accumulatedAngle = 0;

  // Polygon vertices (computed)
  let vertices: { x: number; y: number }[] = [];
  let polygonCenterX = 0;
  let polygonCenterY = 0;
  let polygonRadius = 0;

  function computeVertices(): void {
    vertices = [];
    polygonCenterX = width * 0.45;
    polygonCenterY = height * 0.5;
    polygonRadius = Math.min(width, height) * 0.28;

    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
      vertices.push({
        x: polygonCenterX + polygonRadius * Math.cos(angle),
        y: polygonCenterY + polygonRadius * Math.sin(angle),
      });
    }
  }

  function hslColor(index: number, total: number, alpha: number = 1): string {
    const hue = (index / total) * 360;
    return `hsla(${hue}, 80%, 60%, ${alpha})`;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    walkerProgress = 0;
    accumulatedAngle = 0;
    computeVertices();
  }

  function update(dt: number, params: Record<string, number>): void {
    sides = Math.round(params.sides ?? 5);
    animSpeed = params.animationSpeed ?? 1;
    showLabels = params.showLabels ?? 1;

    computeVertices();

    // Advance walking animation
    walkerProgress += dt * animSpeed * 0.4;
    if (walkerProgress > sides) {
      walkerProgress = walkerProgress % sides;
    }

    // Compute accumulated exterior angle based on progress
    const completedVertices = Math.floor(walkerProgress);
    const exteriorAngle = 360 / sides;
    const frac = walkerProgress - completedVertices;
    accumulatedAngle = completedVertices * exteriorAngle + frac * exteriorAngle;

    time += dt;
  }

  function drawArc(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    color: string
  ): void {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw filled wedge
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color.replace(/[\d.]+\)$/, "0.15)");
    ctx.fill();
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0e1a");
    bgGrad.addColorStop(1, "#121830");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    if (vertices.length < 3) return;

    const exteriorAngle = 360 / sides;
    const interiorAngle = 180 - exteriorAngle;

    // Draw polygon edges
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(200, 220, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(100, 140, 200, 0.08)";
    ctx.fill();

    // Draw exterior angle arcs at each vertex
    const arcRadius = Math.min(35, polygonRadius * 0.25);
    for (let i = 0; i < sides; i++) {
      const curr = vertices[i];
      const prev = vertices[(i - 1 + sides) % sides];
      const next = vertices[(i + 1) % sides];

      // Direction from curr to prev (incoming edge)
      const inAngle = Math.atan2(prev.y - curr.y, prev.x - curr.x);
      // Direction from curr to next (outgoing edge)
      const outAngle = Math.atan2(next.y - curr.y, next.x - curr.x);

      // Exterior angle: extend the incoming edge past vertex, arc to outgoing edge
      const extendAngle = inAngle + Math.PI; // extended incoming direction

      // Draw the extended line (dashed)
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(curr.x, curr.y);
      ctx.lineTo(
        curr.x + arcRadius * 1.8 * Math.cos(extendAngle),
        curr.y + arcRadius * 1.8 * Math.sin(extendAngle)
      );
      ctx.strokeStyle = "rgba(255, 200, 100, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw exterior angle arc
      const color = hslColor(i, sides);
      let startA = Math.min(extendAngle, outAngle);
      let endA = Math.max(extendAngle, outAngle);
      if (endA - startA > Math.PI) {
        const tmp = startA;
        startA = endA;
        endA = tmp + 2 * Math.PI;
      }
      drawArc(curr.x, curr.y, arcRadius, startA, endA, color);

      // Label each exterior angle
      if (showLabels) {
        const midA = (startA + endA) / 2;
        const labelR = arcRadius + 16;
        ctx.fillStyle = color;
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `${exteriorAngle.toFixed(1)}°`,
          curr.x + labelR * Math.cos(midA),
          curr.y + labelR * Math.sin(midA)
        );
      }

      // Vertex dot
      ctx.beginPath();
      ctx.arc(curr.x, curr.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }

    // Draw walking animation (a dot traveling along edges with turning)
    const completedVerts = Math.floor(walkerProgress);
    const frac = walkerProgress - completedVerts;
    const fromIdx = completedVerts % sides;
    const toIdx = (completedVerts + 1) % sides;
    const walkerX = vertices[fromIdx].x + frac * (vertices[toIdx].x - vertices[fromIdx].x);
    const walkerY = vertices[fromIdx].y + frac * (vertices[toIdx].y - vertices[fromIdx].y);

    // Walker glow
    const glow = ctx.createRadialGradient(walkerX, walkerY, 0, walkerX, walkerY, 20);
    glow.addColorStop(0, "rgba(255, 220, 100, 0.6)");
    glow.addColorStop(1, "rgba(255, 220, 100, 0)");
    ctx.beginPath();
    ctx.arc(walkerX, walkerY, 20, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Walker dot
    ctx.beginPath();
    ctx.arc(walkerX, walkerY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffdc64";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Direction arrow on walker
    const dx = vertices[toIdx].x - vertices[fromIdx].x;
    const dy = vertices[toIdx].y - vertices[fromIdx].y;
    const dirAngle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(
      walkerX + 10 * Math.cos(dirAngle),
      walkerY + 10 * Math.sin(dirAngle)
    );
    ctx.lineTo(
      walkerX + 5 * Math.cos(dirAngle + 2.5),
      walkerY + 5 * Math.sin(dirAngle + 2.5)
    );
    ctx.lineTo(
      walkerX + 5 * Math.cos(dirAngle - 2.5),
      walkerY + 5 * Math.sin(dirAngle - 2.5)
    );
    ctx.closePath();
    ctx.fillStyle = "#ffdc64";
    ctx.fill();

    // Info panel on the right
    const panelX = width * 0.7;
    const panelY = height * 0.08;
    const panelW = width * 0.27;
    const panelH = height * 0.84;

    // Panel background
    ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let ty = panelY + 16;
    const lx = panelX + 14;

    ctx.fillStyle = "#8cb4ff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("Sum of Exterior Angles", lx, ty);
    ty += 26;

    ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Polygon: ${sides}-gon (regular)`, lx, ty);
    ty += 22;

    ctx.fillStyle = "#ffd966";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("Formulas:", lx, ty);
    ty += 20;

    ctx.fillStyle = "rgba(200, 220, 255, 0.85)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Exterior angle = 360° / n", lx, ty);
    ty += 18;
    ctx.fillText(`= 360° / ${sides} = ${exteriorAngle.toFixed(1)}°`, lx, ty);
    ty += 22;

    ctx.fillText("Interior angle = 180° - ext", lx, ty);
    ty += 18;
    ctx.fillText(`= 180° - ${exteriorAngle.toFixed(1)}° = ${interiorAngle.toFixed(1)}°`, lx, ty);
    ty += 26;

    ctx.fillStyle = "#66ffaa";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("Walking Sum:", lx, ty);
    ty += 20;

    // Animated accumulation
    const displayAngle = Math.min(accumulatedAngle, 360);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText(`${displayAngle.toFixed(1)}° / 360°`, lx, ty);
    ty += 28;

    // Progress bar
    const barW = panelW - 28;
    const barH = 10;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.roundRect(lx, ty, barW, barH, 5);
    ctx.fill();

    const progress = Math.min(displayAngle / 360, 1);
    const barGrad = ctx.createLinearGradient(lx, ty, lx + barW * progress, ty);
    barGrad.addColorStop(0, "#66ffaa");
    barGrad.addColorStop(1, "#4488ff");
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(lx, ty, barW * progress, barH, 5);
    ctx.fill();
    ty += 24;

    ctx.fillStyle = "rgba(200, 220, 255, 0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Vertices passed: ${Math.min(Math.floor(walkerProgress), sides)}/${sides}`, lx, ty);
    ty += 26;

    // Key insight
    ctx.fillStyle = "#ff9966";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText("Key Insight:", lx, ty);
    ty += 20;

    ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    const lines = [
      "The sum of exterior angles",
      "of ANY convex polygon is",
      "always exactly 360°.",
      "",
      "Walking around the polygon,",
      "you turn through each exterior",
      "angle and end up facing the",
      "same direction — a full turn.",
    ];
    for (const line of lines) {
      ctx.fillText(line, lx, ty);
      ty += 16;
    }

    // Time display
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 14);
  }

  function reset(): void {
    time = 0;
    walkerProgress = 0;
    accumulatedAngle = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const exteriorAngle = 360 / sides;
    const interiorAngle = 180 - exteriorAngle;
    return (
      `Sum of Exterior Angles: ${sides}-sided regular polygon. ` +
      `Each exterior angle = ${exteriorAngle.toFixed(1)}°. ` +
      `Each interior angle = ${interiorAngle.toFixed(1)}°. ` +
      `Sum of exterior angles = 360°. ` +
      `Walker has passed ${Math.floor(walkerProgress)} of ${sides} vertices. ` +
      `Accumulated turn: ${Math.min(accumulatedAngle, 360).toFixed(1)}°.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeVertices();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SumOfExteriorAngleFactory;
