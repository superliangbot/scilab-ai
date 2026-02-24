import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Continent data ─────────────────────────────────────────────────
// Each continent is a simplified polygon defined by normalised coords (0-1).
// We store TWO sets of positions:
//   pangaea: position when all continents are joined (~250 Mya)
//   present: present-day approximate position
// The simulation interpolates between them based on the timeperiod parameter.

interface ContinentDef {
  name: string;
  color: string;
  pangaea: { cx: number; cy: number; rotation: number }; // centre + rotation in degrees
  present: { cx: number; cy: number; rotation: number };
  // Polygon outline relative to centre (normalised, will be scaled by size factor)
  outline: Array<{ x: number; y: number }>;
  sizeFactor: number; // scales the outline
}

const CONTINENTS: ContinentDef[] = [
  {
    name: "Africa",
    color: "#22c55e",
    pangaea: { cx: 0.52, cy: 0.48, rotation: -15 },
    present: { cx: 0.54, cy: 0.52, rotation: 0 },
    sizeFactor: 0.12,
    outline: [
      { x: -0.3, y: -1.0 }, { x: 0.4, y: -0.9 }, { x: 0.7, y: -0.5 },
      { x: 0.8, y: 0.0 }, { x: 0.5, y: 0.4 }, { x: 0.2, y: 0.9 },
      { x: -0.1, y: 1.0 }, { x: -0.3, y: 0.7 }, { x: -0.6, y: 0.1 },
      { x: -0.7, y: -0.3 }, { x: -0.5, y: -0.7 },
    ],
  },
  {
    name: "South America",
    color: "#eab308",
    pangaea: { cx: 0.42, cy: 0.52, rotation: 30 },
    present: { cx: 0.30, cy: 0.60, rotation: 0 },
    sizeFactor: 0.10,
    outline: [
      { x: -0.2, y: -1.0 }, { x: 0.5, y: -0.8 }, { x: 0.7, y: -0.3 },
      { x: 0.6, y: 0.2 }, { x: 0.3, y: 0.7 }, { x: 0.0, y: 1.0 },
      { x: -0.3, y: 0.8 }, { x: -0.5, y: 0.3 }, { x: -0.6, y: -0.2 },
      { x: -0.5, y: -0.6 },
    ],
  },
  {
    name: "North America",
    color: "#a855f7",
    pangaea: { cx: 0.40, cy: 0.35, rotation: 40 },
    present: { cx: 0.22, cy: 0.32, rotation: 0 },
    sizeFactor: 0.13,
    outline: [
      { x: -0.8, y: -0.5 }, { x: -0.3, y: -0.9 }, { x: 0.3, y: -0.8 },
      { x: 0.7, y: -0.4 }, { x: 0.8, y: 0.0 }, { x: 0.5, y: 0.3 },
      { x: 0.1, y: 0.7 }, { x: -0.2, y: 0.8 }, { x: -0.5, y: 0.5 },
      { x: -0.8, y: 0.1 },
    ],
  },
  {
    name: "Europe",
    color: "#f97316",
    pangaea: { cx: 0.50, cy: 0.33, rotation: -20 },
    present: { cx: 0.52, cy: 0.28, rotation: 0 },
    sizeFactor: 0.07,
    outline: [
      { x: -0.8, y: -0.3 }, { x: -0.2, y: -0.8 }, { x: 0.5, y: -0.7 },
      { x: 0.8, y: -0.2 }, { x: 0.6, y: 0.3 }, { x: 0.2, y: 0.7 },
      { x: -0.3, y: 0.6 }, { x: -0.7, y: 0.2 },
    ],
  },
  {
    name: "Asia",
    color: "#ef4444",
    pangaea: { cx: 0.56, cy: 0.32, rotation: -10 },
    present: { cx: 0.70, cy: 0.30, rotation: 0 },
    sizeFactor: 0.18,
    outline: [
      { x: -0.9, y: -0.4 }, { x: -0.3, y: -0.8 }, { x: 0.3, y: -0.7 },
      { x: 0.7, y: -0.3 }, { x: 0.9, y: 0.2 }, { x: 0.6, y: 0.6 },
      { x: 0.2, y: 0.8 }, { x: -0.3, y: 0.7 }, { x: -0.6, y: 0.4 },
      { x: -0.8, y: 0.0 },
    ],
  },
  {
    name: "Australia",
    color: "#92400e",
    pangaea: { cx: 0.58, cy: 0.60, rotation: -45 },
    present: { cx: 0.80, cy: 0.68, rotation: 0 },
    sizeFactor: 0.07,
    outline: [
      { x: -0.8, y: -0.4 }, { x: 0.0, y: -0.7 }, { x: 0.7, y: -0.3 },
      { x: 0.8, y: 0.2 }, { x: 0.3, y: 0.6 }, { x: -0.4, y: 0.5 },
      { x: -0.7, y: 0.1 },
    ],
  },
  {
    name: "Antarctica",
    color: "#e2e8f0",
    pangaea: { cx: 0.50, cy: 0.62, rotation: 10 },
    present: { cx: 0.50, cy: 0.88, rotation: 0 },
    sizeFactor: 0.10,
    outline: [
      { x: -0.9, y: -0.2 }, { x: -0.3, y: -0.5 }, { x: 0.4, y: -0.4 },
      { x: 0.9, y: -0.1 }, { x: 0.7, y: 0.3 }, { x: 0.0, y: 0.5 },
      { x: -0.6, y: 0.3 },
    ],
  },
  {
    name: "India",
    color: "#ec4899",
    pangaea: { cx: 0.54, cy: 0.56, rotation: -60 },
    present: { cx: 0.66, cy: 0.44, rotation: 0 },
    sizeFactor: 0.05,
    outline: [
      { x: -0.4, y: -0.8 }, { x: 0.4, y: -0.8 }, { x: 0.6, y: -0.2 },
      { x: 0.3, y: 0.5 }, { x: 0.0, y: 1.0 }, { x: -0.3, y: 0.5 },
      { x: -0.6, y: -0.2 },
    ],
  },
];

// Tectonic plate boundaries (simplified, normalised 0-1 coordinates)
// These represent major plate edges at present day
const PLATE_BOUNDARIES: Array<Array<{ x: number; y: number }>> = [
  // Mid-Atlantic Ridge
  [
    { x: 0.38, y: 0.10 }, { x: 0.40, y: 0.25 }, { x: 0.42, y: 0.40 },
    { x: 0.40, y: 0.55 }, { x: 0.38, y: 0.70 }, { x: 0.40, y: 0.85 },
  ],
  // Pacific Ring of Fire (west side)
  [
    { x: 0.85, y: 0.15 }, { x: 0.82, y: 0.30 }, { x: 0.78, y: 0.45 },
    { x: 0.80, y: 0.60 }, { x: 0.85, y: 0.75 },
  ],
  // Pacific Ring of Fire (east side)
  [
    { x: 0.15, y: 0.20 }, { x: 0.14, y: 0.35 }, { x: 0.16, y: 0.50 },
    { x: 0.20, y: 0.65 },
  ],
  // Himalayan boundary (India-Asia collision)
  [
    { x: 0.60, y: 0.38 }, { x: 0.65, y: 0.36 }, { x: 0.72, y: 0.35 },
    { x: 0.78, y: 0.37 },
  ],
  // East African Rift
  [
    { x: 0.57, y: 0.42 }, { x: 0.58, y: 0.50 }, { x: 0.57, y: 0.58 },
    { x: 0.55, y: 0.65 },
  ],
];

// ─── Factory ────────────────────────────────────────────────────────
const ContinentalDriftFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("continental-drift") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let timeperiod = 100; // 0 = Pangaea (250 Mya), 100 = present
  let showLabels = 1;
  let showPlateEdges = 1;
  let animationSpeed = 5;

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  function lerpAngle(a: number, b: number, t: number): number {
    // Shortest path angle interpolation
    let diff = b - a;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return a + diff * t;
  }

  function getContinentPosition(continent: ContinentDef, t: number): {
    cx: number; cy: number; rotation: number;
  } {
    // t is 0-1 where 0 = pangaea, 1 = present
    // Use an ease-in-out curve for more natural movement
    const eased = t * t * (3 - 2 * t); // smoothstep
    return {
      cx: lerp(continent.pangaea.cx, continent.present.cx, eased),
      cy: lerp(continent.pangaea.cy, continent.present.cy, eased),
      rotation: lerpAngle(continent.pangaea.rotation, continent.present.rotation, eased),
    };
  }

  function drawContinent(continent: ContinentDef, t: number): void {
    const pos = getContinentPosition(continent, t);

    // Convert normalised coords to canvas
    const cx = pos.cx * width;
    const cy = pos.cy * height;
    const rotRad = (pos.rotation * Math.PI) / 180;
    const scale = continent.sizeFactor * Math.min(width, height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotRad);

    // Draw filled polygon
    ctx.beginPath();
    for (let i = 0; i < continent.outline.length; i++) {
      const px = continent.outline[i].x * scale;
      const py = continent.outline[i].y * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Fill with gradient for depth effect
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * 1.2);
    grad.addColorStop(0, continent.color);
    // Slightly darker at edges
    const darkerColor = continent.color + "cc";
    grad.addColorStop(1, darkerColor);
    ctx.fillStyle = grad;
    ctx.fill();

    // Outline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Subtle terrain texture lines
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.5;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-scale, i * scale * 0.2);
      ctx.lineTo(scale, i * scale * 0.2 + scale * 0.1);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();

    // Label
    if (showLabels >= 0.5) {
      ctx.save();
      ctx.font = `bold ${Math.max(9, Math.min(width, height) * 0.016)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText(continent.name, cx, cy);
      ctx.restore();
    }
  }

  function drawPlateBoundaries(t: number): void {
    if (showPlateEdges < 0.5) return;
    // Only show plate boundaries when closer to present day
    const alpha = Math.max(0, (t - 0.3) / 0.7) * 0.7;
    if (alpha <= 0) return;

    ctx.save();
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    for (const boundary of PLATE_BOUNDARIES) {
      ctx.beginPath();
      for (let i = 0; i < boundary.length; i++) {
        const px = boundary[i].x * width;
        const py = boundary[i].y * height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  function renderOcean(): void {
    // Deep blue ocean with gradient
    const bgGrad = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, "#1a4a7a");
    bgGrad.addColorStop(0.5, "#0f3460");
    bgGrad.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle ocean wave pattern
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.strokeStyle = "#6688bb";
    ctx.lineWidth = 0.8;
    const waveSpacing = 30;
    for (let y = 0; y < height; y += waveSpacing) {
      ctx.beginPath();
      for (let x = 0; x < width; x += 5) {
        const wy = y + Math.sin((x + time * 20) * 0.02) * 4;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderTimeLabel(t: number): void {
    // Convert t (0-1) to millions of years ago
    const mya = Math.round((1 - t) * 250);
    let label: string;
    if (mya <= 0) {
      label = "Present Day";
    } else {
      label = `${mya} Million Years Ago`;
    }

    // Time era name
    let era = "";
    if (mya >= 200) era = "Late Triassic / Pangaea";
    else if (mya >= 150) era = "Jurassic Period";
    else if (mya >= 100) era = "Early Cretaceous";
    else if (mya >= 65) era = "Late Cretaceous";
    else if (mya >= 23) era = "Paleogene Period";
    else if (mya >= 2) era = "Neogene Period";
    else era = "Quaternary Period";

    // Title bar
    ctx.save();
    ctx.font = `bold ${Math.max(14, Math.min(width, height) * 0.026)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 4;
    ctx.fillText(label, width / 2, 12);

    ctx.font = `${Math.max(10, Math.min(width, height) * 0.016)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(200, 210, 240, 0.6)";
    ctx.fillText(era, width / 2, 36);
    ctx.restore();

    // Timeline progress bar
    const barWidth = width * 0.6;
    const barX = (width - barWidth) / 2;
    const barY = height - 38;
    const barH = 6;

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(barX, barY, barWidth, barH);

    const fillW = barWidth * t;
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
    barGrad.addColorStop(0, "#f97316");
    barGrad.addColorStop(0.5, "#eab308");
    barGrad.addColorStop(1, "#22c55e");
    ctx.fillStyle = barGrad;
    ctx.fillRect(barX, barY, fillW, barH);

    // Bar border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barH);

    // Labels on bar
    ctx.font = `${Math.max(8, Math.min(width, height) * 0.012)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("250 Mya", barX, barY + barH + 4);
    ctx.textAlign = "right";
    ctx.fillText("Present", barX + barWidth, barY + barH + 4);

    // Indicator dot
    ctx.beginPath();
    ctx.arc(barX + fillW, barY + barH / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function renderHUD(t: number): void {
    // Educational annotations
    ctx.save();
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(180, 200, 240, 0.45)";

    if (t < 0.15) {
      ctx.fillText("All continents joined as supercontinent Pangaea", 12, height - 55);
      ctx.fillText("Surrounded by the Panthalassa Ocean", 12, height - 40);
    } else if (t < 0.5) {
      ctx.fillText("Pangaea begins to rift apart: Laurasia (north) & Gondwana (south)", 12, height - 55);
    } else if (t < 0.8) {
      ctx.fillText("Atlantic Ocean widens; India drifts north toward Asia", 12, height - 55);
    } else {
      ctx.fillText("Plates move 2-10 cm/year driven by mantle convection currents", 12, height - 55);
    }
    ctx.restore();

    // Time display - bottom left
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);

    // Legend
    if (showPlateEdges >= 0.5 && t > 0.3) {
      ctx.save();
      ctx.font = `${Math.max(9, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(width - 130, height - 14);
      ctx.lineTo(width - 90, height - 14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(239, 130, 130, 0.6)";
      ctx.fillText("Plate boundaries", width - 12, height - 8);
      ctx.restore();
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    timeperiod = params.timeperiod ?? 100;
    showLabels = params.showLabels ?? 1;
    showPlateEdges = params.showPlateEdges ?? 1;
    animationSpeed = params.animationSpeed ?? 5;
    time += dt;
  }

  function render(): void {
    const t = timeperiod / 100; // 0 = pangaea, 1 = present

    renderOcean();

    // Draw plate boundaries (behind continents)
    drawPlateBoundaries(t);

    // Draw continents
    for (const continent of CONTINENTS) {
      drawContinent(continent, t);
    }

    renderTimeLabel(t);
    renderHUD(t);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const t = timeperiod / 100;
    const mya = Math.round((1 - t) * 250);
    let era = "";
    if (mya >= 200) era = "Late Triassic (Pangaea intact)";
    else if (mya >= 150) era = "Jurassic (Pangaea rifting)";
    else if (mya >= 100) era = "Early Cretaceous";
    else if (mya >= 65) era = "Late Cretaceous";
    else if (mya >= 23) era = "Paleogene";
    else if (mya >= 2) era = "Neogene";
    else era = "Present day";

    return (
      `Continental Drift: Showing Earth ${mya > 0 ? mya + " million years ago" : "present day"}. ` +
      `Era: ${era}. Time slider at ${timeperiod}%. ` +
      `Labels: ${showLabels >= 0.5 ? "on" : "off"}. ` +
      `Plate edges: ${showPlateEdges >= 0.5 ? "on" : "off"}. ` +
      `Continental drift is driven by mantle convection; plates move 2-10 cm/year. ` +
      `At t=0 all continents form the supercontinent Pangaea. ` +
      `Key events: Atlantic opens (~180 Mya), India collides with Asia (~50 Mya).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ContinentalDriftFactory;
