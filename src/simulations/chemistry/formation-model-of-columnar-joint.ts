import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "formation-model-of-columnar-joint",
  title: "Columnar Joint Formation",
  category: "chemistry",
  description:
    "Watch columnar joints form as lava cools — Voronoi-based geological fracture simulation.",
  longDescription:
    "Columnar joints (like Giant's Causeway or Devil's Postpile) form when basalt lava cools and contracts. Cooling begins at multiple nucleation points simultaneously. As the material shrinks, stress concentrations create fractures between cooling zones, producing the characteristic polygonal (often hexagonal) columns. This simulation uses Voronoi tessellation to model this process, showing how column shape depends on nucleation point distribution.",
  parameters: [
    { key: "numCores", label: "Cooling Cores", min: 10, max: 80, step: 5, defaultValue: 40 },
    { key: "coolingSpeed", label: "Cooling Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
    { key: "showNuclei", label: "Show Nuclei (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    { key: "colorMode", label: "Color Mode (0=Temp, 1=Cell)", min: 0, max: 1, step: 1, defaultValue: 0 },
  ],
  thumbnailColor: "#78350f",
};

interface CoolingCore {
  x: number;
  y: number;
  color: string;
  progress: number;
}

const ColumnarJointFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let numCores = 40;
  let coolingSpeed = 1;
  let showNuclei = 1;
  let colorMode = 0;

  let cores: CoolingCore[] = [];
  let cellColors: string[] = [];
  let coolingProgress = 0;
  let isInitialized = false;

  function generateCores(count: number) {
    cores = [];
    cellColors = [];
    const margin = 20;
    const areaW = W - 2 * margin;
    const areaH = H * 0.7;
    const offsetY = H * 0.08;

    for (let i = 0; i < count; i++) {
      cores.push({
        x: margin + Math.random() * areaW,
        y: offsetY + Math.random() * areaH,
        color: `hsl(${25 + Math.random() * 20}, ${60 + Math.random() * 20}%, ${30 + Math.random() * 20}%)`,
        progress: 0,
      });
      cellColors.push(`hsl(${Math.random() * 360}, 50%, 45%)`);
    }
    coolingProgress = 0;
    isInitialized = true;
  }

  function findNearestCore(px: number, py: number): number {
    let minDist = Infinity;
    let nearest = 0;
    for (let i = 0; i < cores.length; i++) {
      const dx = px - cores[i].x;
      const dy = py - cores[i].y;
      const d = dx * dx + dy * dy;
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return nearest;
  }

  function drawVoronoiCells() {
    const areaTop = H * 0.08;
    const areaBot = H * 0.78;
    const step = 3;
    const imgData = ctx.createImageData(W, Math.ceil(areaBot - areaTop));

    for (let py = 0; py < imgData.height; py += step) {
      for (let px = 0; px < W; px += step) {
        const nearest = findNearestCore(px, py + areaTop);
        const core = cores[nearest];
        const dist = Math.sqrt((px - core.x) ** 2 + (py + areaTop - core.y) ** 2);

        let r: number, g: number, b: number;

        if (colorMode === 0) {
          // Temperature mode
          const temp = 1 - coolingProgress;
          const cooledAmount = Math.min(1, core.progress);
          const t = temp * (1 - cooledAmount * 0.8);
          r = Math.floor(60 + t * 180);
          g = Math.floor(30 + t * 60 - cooledAmount * 20);
          b = Math.floor(20 + cooledAmount * 30);
        } else {
          // Cell color mode
          const hue = (nearest * 137.5) % 360;
          const [cr, cg, cb] = hslToRgb(hue / 360, 0.5, 0.45);
          r = cr; g = cg; b = cb;
        }

        // Darken near boundaries
        let minDist2 = Infinity;
        const coreD = dist;
        for (let j = 0; j < cores.length; j++) {
          if (j === nearest) continue;
          const dx = px - cores[j].x;
          const dy = (py + areaTop) - cores[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist2) minDist2 = d;
        }
        const boundary = Math.abs(coreD - minDist2);
        if (boundary < 4 * coolingProgress) {
          const crack = Math.max(0, 1 - boundary / (4 * coolingProgress));
          r = Math.floor(r * (1 - crack * 0.8));
          g = Math.floor(g * (1 - crack * 0.8));
          b = Math.floor(b * (1 - crack * 0.8));
        }

        // Fill step × step block
        for (let dy = 0; dy < step && py + dy < imgData.height; dy++) {
          for (let dx = 0; dx < step && px + dx < W; dx++) {
            const idx = ((py + dy) * W + px + dx) * 4;
            imgData.data[idx] = r;
            imgData.data[idx + 1] = g;
            imgData.data[idx + 2] = b;
            imgData.data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, Math.floor(areaTop));
  }

  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function drawNuclei() {
    if (!showNuclei) return;
    for (const core of cores) {
      ctx.beginPath();
      ctx.arc(core.x, core.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = coolingProgress > 0.3 ? "#000" : "#fff";
      ctx.fill();
    }
  }

  function drawInfoPanel() {
    const px = 10;
    const py = H * 0.82;
    const pw = W - 20;
    const ph = H * 0.16;

    ctx.fillStyle = "rgba(30,20,10,0.9)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Columnar Joint Formation Model", px + 12, py + 20);

    ctx.fillStyle = "#d4a574";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Cooling cores: ${cores.length}`, px + 12, py + 40);
    ctx.fillText(`Cooling progress: ${(coolingProgress * 100).toFixed(0)}%`, px + 12, py + 56);

    // Temperature bar
    const barX = pw / 2 + px;
    const barW = pw / 2 - 30;
    ctx.fillText("Temperature:", barX, py + 20);
    const tempGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    tempGrad.addColorStop(0, "#1e293b");
    tempGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = tempGrad;
    ctx.fillRect(barX, py + 26, barW, 12);
    // Marker
    const markerX = barX + (1 - coolingProgress) * barW;
    ctx.fillStyle = "#fff";
    ctx.fillRect(markerX - 1, py + 24, 3, 16);

    ctx.fillStyle = "#94774a";
    ctx.font = "11px sans-serif";
    ctx.fillText("Fractures form at boundaries between Voronoi cells as material contracts", px + 12, py + ph - 8);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
    generateCores(numCores);
  }

  function update(dt: number, params: Record<string, number>) {
    const newCores = Math.floor(params.numCores ?? 40);
    coolingSpeed = params.coolingSpeed ?? 1;
    showNuclei = params.showNuclei ?? 1;
    colorMode = Math.floor(params.colorMode ?? 0);

    if (newCores !== numCores) {
      numCores = newCores;
      generateCores(numCores);
    }

    time += dt;
    coolingProgress = Math.min(1, coolingProgress + dt * 0.08 * coolingSpeed);

    for (const core of cores) {
      core.progress = Math.min(1, core.progress + dt * 0.1 * coolingSpeed);
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#1a0f05";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Formation of Columnar Joints", W / 2, H * 0.05);

    drawVoronoiCells();
    drawNuclei();
    drawInfoPanel();
  }

  function reset() {
    time = 0;
    coolingProgress = 0;
    generateCores(numCores);
  }

  function destroy() {}

  function getStateDescription(): string {
    return `Columnar Joint Formation: ${cores.length} cooling nucleation points. Cooling progress: ${(coolingProgress * 100).toFixed(0)}%. As basalt lava cools from ${cores.length} points, Voronoi-like fracture patterns emerge creating polygonal columns. ${coolingProgress > 0.8 ? "Fractures are well-developed — column shapes clearly visible." : coolingProgress > 0.4 ? "Cooling in progress — fracture boundaries forming." : "Early stage — lava still hot, minimal fracturing."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
    if (isInitialized) generateCores(numCores);
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ColumnarJointFactory;
