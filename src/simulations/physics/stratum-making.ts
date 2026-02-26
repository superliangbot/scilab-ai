import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Sediment layer types ───────────────────────────────────────────
interface SedimentLayer {
  type: string;
  color1: string;
  color2: string;
  patternType: "dots" | "lines" | "dashes" | "solid" | "crosses";
  geoAge: string;
  thickness: number;       // target normalized thickness (0-1 of total)
  currentHeight: number;   // current deposited height in pixels
  targetHeight: number;    // target height in pixels
}

const LAYER_TYPES = [
  { type: "Sandstone", color1: "#d4a843", color2: "#c49a32", patternType: "dots" as const, geoAge: "Triassic" },
  { type: "Limestone", color1: "#b8c4a8", color2: "#a0b090", patternType: "dashes" as const, geoAge: "Jurassic" },
  { type: "Shale", color1: "#6b7b8d", color2: "#5a6a7c", patternType: "lines" as const, geoAge: "Cretaceous" },
  { type: "Mudstone", color1: "#8b6e5a", color2: "#7a5d49", patternType: "solid" as const, geoAge: "Permian" },
  { type: "Conglomerate", color1: "#a08878", color2: "#907868", patternType: "crosses" as const, geoAge: "Devonian" },
  { type: "Chalk", color1: "#e8e0d0", color2: "#d8d0c0", patternType: "dots" as const, geoAge: "Carboniferous" },
  { type: "Siltstone", color1: "#9a8a6a", color2: "#8a7a5a", patternType: "dashes" as const, geoAge: "Ordovician" },
  { type: "Gneiss", color1: "#7a6a7a", color2: "#6a5a6a", patternType: "lines" as const, geoAge: "Precambrian" },
  { type: "Basalt", color1: "#3a3a3a", color2: "#2a2a2a", patternType: "solid" as const, geoAge: "Silurian" },
  { type: "Marble", color1: "#d0ccc8", color2: "#c0bcb8", patternType: "crosses" as const, geoAge: "Cambrian" },
  { type: "Quartzite", color1: "#c8b8a0", color2: "#b8a890", patternType: "dots" as const, geoAge: "Eocene" },
  { type: "Dolomite", color1: "#a0a898", color2: "#909888", patternType: "dashes" as const, geoAge: "Miocene" },
];

const StratumMakingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stratum-making") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let layers: SedimentLayer[] = [];
  let layerCount = 6;
  let depositionRate = 2;
  let erosionRate = 0.3;
  let showLabels = 1;

  // Falling particles for deposition effect
  let particles: { x: number; y: number; vy: number; color: string; layerIdx: number }[] = [];

  const CROSS_SECTION_TOP = 80;
  const CROSS_SECTION_MARGIN = 60;

  function buildLayers(): void {
    layers = [];
    for (let i = 0; i < layerCount; i++) {
      const lt = LAYER_TYPES[i % LAYER_TYPES.length];
      layers.push({
        type: lt.type,
        color1: lt.color1,
        color2: lt.color2,
        patternType: lt.patternType,
        geoAge: lt.geoAge,
        thickness: 1 / layerCount,
        currentHeight: 0,
        targetHeight: 0,
      });
    }
    recalcTargets();
  }

  function recalcTargets(): void {
    const availableH = height - CROSS_SECTION_TOP - 40;
    for (let i = 0; i < layers.length; i++) {
      layers[i].targetHeight = availableH * layers[i].thickness;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    buildLayers();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    const newLayerCount = Math.round(params.layerCount ?? layerCount);
    depositionRate = params.depositionRate ?? depositionRate;
    erosionRate = params.erosionRate ?? erosionRate;
    showLabels = params.showLabels ?? showLabels;

    if (newLayerCount !== layerCount) {
      layerCount = newLayerCount;
      buildLayers();
    }

    time += step;

    // Deposit layers from bottom up
    const depositSpeed = depositionRate * 40 * step;
    for (let i = 0; i < layers.length; i++) {
      // A layer can only grow once all layers below it are fully deposited
      const belowComplete = i === 0 || layers[i - 1].currentHeight >= layers[i - 1].targetHeight * 0.95;
      if (belowComplete && layers[i].currentHeight < layers[i].targetHeight) {
        layers[i].currentHeight = Math.min(layers[i].currentHeight + depositSpeed, layers[i].targetHeight);
        // Spawn particles for this active layer
        if (Math.random() < depositionRate * 0.3) {
          const x = CROSS_SECTION_MARGIN + Math.random() * (width - 2 * CROSS_SECTION_MARGIN);
          particles.push({
            x,
            y: CROSS_SECTION_TOP - 20,
            vy: 60 + Math.random() * 40,
            color: layers[i].color1,
            layerIdx: i,
          });
        }
        break; // Only deposit one layer at a time
      }
    }

    // Apply erosion effect: slightly reduce the top-most deposited layer
    if (erosionRate > 0) {
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].currentHeight > 0) {
          const erosionAmt = erosionRate * 2 * step;
          layers[i].currentHeight = Math.max(0, layers[i].currentHeight - erosionAmt);
          break;
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].y += particles[i].vy * step;
      // Compute where the target layer top is
      let topY = height - 40;
      for (let j = 0; j <= particles[i].layerIdx; j++) {
        topY -= layers[j].currentHeight;
      }
      if (particles[i].y >= topY) {
        particles.splice(i, 1);
      }
    }
    // Limit particles
    if (particles.length > 50) particles.splice(0, particles.length - 50);
  }

  function drawPattern(x: number, y: number, w: number, h: number, patternType: string, color2: string): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = color2;
    ctx.fillStyle = color2;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;

    const spacing = 12;
    switch (patternType) {
      case "dots":
        for (let px = x; px < x + w; px += spacing) {
          for (let py = y; py < y + h; py += spacing) {
            ctx.beginPath();
            ctx.arc(px + Math.random() * 3, py + Math.random() * 3, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      case "lines":
        for (let py = y; py < y + h; py += spacing * 0.7) {
          ctx.beginPath();
          ctx.moveTo(x, py);
          ctx.lineTo(x + w, py);
          ctx.stroke();
        }
        break;
      case "dashes":
        for (let py = y; py < y + h; py += spacing) {
          for (let px = x; px < x + w; px += spacing * 1.5) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + spacing * 0.8, py);
            ctx.stroke();
          }
        }
        break;
      case "crosses":
        for (let px = x; px < x + w; px += spacing * 1.5) {
          for (let py = y; py < y + h; py += spacing * 1.5) {
            const cx = px + spacing * 0.75;
            const cy = py + spacing * 0.75;
            ctx.beginPath();
            ctx.moveTo(cx - 3, cy);
            ctx.lineTo(cx + 3, cy);
            ctx.moveTo(cx, cy - 3);
            ctx.lineTo(cx, cy + 3);
            ctx.stroke();
          }
        }
        break;
      case "solid":
      default:
        break;
    }
    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;

    // Background gradient (earth tones)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#1a1a2e");
    bgGrad.addColorStop(0.3, "#16213e");
    bgGrad.addColorStop(1, "#0f3460");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Geological Stratum Formation", width / 2, 28);

    // Description
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Sedimentary layers building up over geological time", width / 2, 50);

    const sectionLeft = CROSS_SECTION_MARGIN;
    const sectionRight = width - CROSS_SECTION_MARGIN;
    const sectionW = sectionRight - sectionLeft;
    const sectionBottom = height - 40;

    // Draw cross-section border lines on left and right
    ctx.strokeStyle = "rgba(150, 120, 80, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sectionLeft, CROSS_SECTION_TOP);
    ctx.lineTo(sectionLeft, sectionBottom);
    ctx.moveTo(sectionRight, CROSS_SECTION_TOP);
    ctx.lineTo(sectionRight, sectionBottom);
    ctx.stroke();

    // Draw layers from bottom up
    let currentY = sectionBottom;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.currentHeight <= 0) continue;

      const layerTop = currentY - layer.currentHeight;

      // Layer gradient fill
      const grad = ctx.createLinearGradient(0, layerTop, 0, currentY);
      grad.addColorStop(0, layer.color1);
      grad.addColorStop(0.5, layer.color2);
      grad.addColorStop(1, layer.color1);
      ctx.fillStyle = grad;
      ctx.fillRect(sectionLeft, layerTop, sectionW, layer.currentHeight);

      // Draw pattern
      drawPattern(sectionLeft, layerTop, sectionW, layer.currentHeight, layer.patternType, layer.color2);

      // Layer boundary line
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sectionLeft, layerTop);
      // Slight waviness
      for (let x = sectionLeft; x <= sectionRight; x += 4) {
        const wave = Math.sin(x * 0.05 + i * 2) * 2;
        ctx.lineTo(x, layerTop + wave);
      }
      ctx.stroke();

      // Labels
      if (showLabels >= 0.5 && layer.currentHeight > 14) {
        const labelY = layerTop + layer.currentHeight / 2;
        // Label on right side
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(layer.type, sectionRight + 8, labelY - 2);
        ctx.fillStyle = "rgba(200, 180, 140, 0.7)";
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillText(layer.geoAge, sectionRight + 8, labelY + 12);
        // Connector line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sectionRight, labelY);
        ctx.lineTo(sectionRight + 6, labelY);
        ctx.stroke();
      }

      currentY = layerTop;
    }

    // Draw falling particles
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Draw ground/bedrock at bottom
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(sectionLeft, sectionBottom, sectionW, 4);

    // Surface label
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Bedrock", width / 2, sectionBottom + 16);

    // Info panel
    ctx.fillStyle = "#38bdf8";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";

    const totalDeposited = layers.reduce((s, l) => s + l.currentHeight, 0);
    const totalTarget = layers.reduce((s, l) => s + l.targetHeight, 0);
    const pct = totalTarget > 0 ? (totalDeposited / totalTarget * 100).toFixed(1) : "0";

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Deposition: ${pct}%`, 12, height - 16);
    ctx.fillStyle = "#f87171";
    ctx.fillText(`Erosion rate: ${erosionRate.toFixed(1)}`, 180, height - 16);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`Layers: ${layerCount}`, 340, height - 16);

    // Time
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`t = ${time.toFixed(1)}s`, width - 12, height - 16);
  }

  function reset(): void {
    time = 0;
    particles = [];
    buildLayers();
  }

  function destroy(): void {
    particles = [];
    layers = [];
  }

  function getStateDescription(): string {
    const deposited = layers.filter(l => l.currentHeight > 0).length;
    return (
      `Geological Stratum Formation: ${deposited}/${layerCount} layers deposited. ` +
      `Deposition rate: ${depositionRate.toFixed(1)}, Erosion rate: ${erosionRate.toFixed(1)}. ` +
      `Sedimentary layers form by deposition of material over geological time. ` +
      `Different materials (sandstone, limestone, shale, etc.) create distinct strata. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    recalcTargets();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StratumMakingFactory;
