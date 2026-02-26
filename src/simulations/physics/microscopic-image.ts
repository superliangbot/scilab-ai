import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Microscopic Image: Simulates what you see through a microscope at different
 * magnifications, showing cells, organelles, and resolution limits.
 * Demonstrates the relationship between magnification, field of view, and resolution.
 */
const MicroscopicImageFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("microscopic-image") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  let magnification = 100; // 40x to 1000x
  let sampleType = 0; // 0=plant cells, 1=blood cells, 2=bacteria
  let showScale = 1;
  let focusDepth = 0.5;

  // Cell structures to draw
  interface Cell {
    x: number;
    y: number;
    size: number; // µm
    type: string;
    color: string;
  }

  let cells: Cell[] = [];
  let lastSample = -1;

  function generatePlantCells(): Cell[] {
    const result: Cell[] = [];
    const gridSize = 8;
    const cellSize = 50; // µm
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        result.push({
          x: (i + 0.5) / gridSize,
          y: (j + 0.5) / gridSize,
          size: cellSize + (Math.random() - 0.5) * 10,
          type: "plant",
          color: `hsl(${120 + Math.random() * 20}, ${50 + Math.random() * 20}%, ${40 + Math.random() * 15}%)`,
        });
      }
    }
    return result;
  }

  function generateBloodCells(): Cell[] {
    const result: Cell[] = [];
    for (let i = 0; i < 60; i++) {
      const isWBC = Math.random() < 0.08;
      result.push({
        x: Math.random(),
        y: Math.random(),
        size: isWBC ? 15 : 7, // µm
        type: isWBC ? "wbc" : "rbc",
        color: isWBC ? "#9b59b6" : "#e74c3c",
      });
    }
    return result;
  }

  function generateBacteria(): Cell[] {
    const result: Cell[] = [];
    for (let i = 0; i < 40; i++) {
      const type = Math.random() < 0.5 ? "rod" : "coccus";
      result.push({
        x: Math.random(),
        y: Math.random(),
        size: type === "rod" ? 3 : 1, // µm
        type,
        color: type === "rod" ? "#3498db" : "#2ecc71",
      });
    }
    return result;
  }

  function generateSample() {
    if (sampleType === 0) cells = generatePlantCells();
    else if (sampleType === 1) cells = generateBloodCells();
    else cells = generateBacteria();
  }

  // Field of view in µm based on magnification
  function fieldOfView(): number {
    // Typical FOV: at 100x ~ 2000µm, at 400x ~ 500µm, at 1000x ~ 200µm
    return 200000 / magnification;
  }

  // Resolution limit in µm (optical microscope: ~0.2µm at best)
  function resolutionLimit(): number {
    return Math.max(0.2, 200 / magnification);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      generateSample();
    },

    update(_dt: number, params: Record<string, number>) {
      magnification = params.magnification ?? 100;
      sampleType = Math.round(params.sampleType ?? 0);
      showScale = params.showScale ?? 1;
      focusDepth = params.focusDepth ?? 0.5;

      if (sampleType !== lastSample) {
        generateSample();
        lastSample = sampleType;
      }
    },

    render() {
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      const sampleNames = ["Plant Cells (Elodea)", "Blood Cells (Smear)", "Bacteria (Gram Stain)"];
      ctx.fillText(`Microscopic View — ${sampleNames[sampleType]}`, W / 2, 28);

      // Circular microscope viewport
      const viewCx = W * 0.4;
      const viewCy = H * 0.48;
      const viewR = Math.min(W * 0.35, H * 0.38);
      const fov = fieldOfView();

      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(viewCx, viewCy, viewR, 0, Math.PI * 2);
      ctx.clip();

      // Bright field background
      const bgBrightness = Math.min(255, 200 + focusDepth * 55);
      ctx.fillStyle = `rgb(${bgBrightness}, ${bgBrightness}, ${bgBrightness - 10})`;
      ctx.fillRect(viewCx - viewR, viewCy - viewR, viewR * 2, viewR * 2);

      // Draw cells
      const blurAmount = Math.abs(focusDepth - 0.5) * 4;

      for (const cell of cells) {
        const cx = viewCx + (cell.x - 0.5) * viewR * 2;
        const cy = viewCy + (cell.y - 0.5) * viewR * 2;
        const pixelSize = (cell.size / fov) * viewR * 2;

        // Skip cells too small to see
        if (pixelSize < 1) continue;

        // Out-of-focus blur effect
        ctx.globalAlpha = Math.max(0.3, 1 - blurAmount * 0.3);

        if (cell.type === "plant") {
          drawPlantCell(cx, cy, pixelSize, cell.color, magnification > 200);
        } else if (cell.type === "rbc") {
          drawRBC(cx, cy, pixelSize, magnification > 200);
        } else if (cell.type === "wbc") {
          drawWBC(cx, cy, pixelSize, magnification > 200);
        } else if (cell.type === "rod") {
          drawRodBacterium(cx, cy, pixelSize, cell.color);
        } else {
          drawCoccus(cx, cy, pixelSize, cell.color);
        }

        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // Circular viewport border
      ctx.beginPath();
      ctx.arc(viewCx, viewCy, viewR, 0, Math.PI * 2);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Vignette effect
      const vignette = ctx.createRadialGradient(viewCx, viewCy, viewR * 0.7, viewCx, viewCy, viewR);
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, "rgba(0,0,0,0.3)");
      ctx.fillStyle = vignette;
      ctx.beginPath();
      ctx.arc(viewCx, viewCy, viewR, 0, Math.PI * 2);
      ctx.fill();

      // Scale bar
      if (showScale) {
        const scaleUm = fov / 5; // 1/5 of field of view
        const niceScale = Math.pow(10, Math.floor(Math.log10(scaleUm)));
        const scaleBarUm = niceScale * Math.round(scaleUm / niceScale);
        const scaleBarPx = (scaleBarUm / fov) * viewR * 2;

        const sbX = viewCx + viewR * 0.3;
        const sbY = viewCy + viewR - 20;

        ctx.fillStyle = "#000";
        ctx.fillRect(sbX, sbY, scaleBarPx, 4);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sbX, sbY, scaleBarPx, 4);

        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.fillText(`${scaleBarUm.toFixed(0)} µm`, sbX + scaleBarPx / 2, sbY - 5);
      }

      // Info panel (right side)
      const infoX = W * 0.78;
      let infoY = 60;
      const lineH = 22;

      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Microscope Settings", infoX, infoY);
      infoY += lineH + 5;

      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Magnification: ${magnification}×`, infoX, infoY);
      infoY += lineH;

      ctx.fillStyle = "#22c55e";
      ctx.fillText(`Field of View: ${fov.toFixed(0)} µm`, infoX, infoY);
      infoY += lineH;

      const res = resolutionLimit();
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Resolution: ~${res.toFixed(2)} µm`, infoX, infoY);
      infoY += lineH;

      ctx.fillStyle = "#c084fc";
      ctx.fillText(`Focus: ${(focusDepth * 100).toFixed(0)}%`, infoX, infoY);
      infoY += lineH + 10;

      // Size reference
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Typical Sizes:", infoX, infoY);
      infoY += lineH;

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      const sizes = [
        "Plant cell: ~50 µm",
        "Red blood cell: ~7 µm",
        "White blood cell: ~15 µm",
        "Bacterium: ~1-3 µm",
        "Virus: ~0.1 µm",
        "Atom: ~0.0001 µm",
      ];
      for (const s of sizes) {
        ctx.fillText(s, infoX, infoY);
        infoY += 16;
      }

      // Bottom info
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(
        "Resolution limit of optical microscope: ~0.2 µm (limited by wavelength of visible light ~550 nm)",
        W / 2, H - 10
      );
    },

    reset() {
      lastSample = -1;
      generateSample();
    },

    destroy() {},

    getStateDescription(): string {
      const sampleNames = ["Plant cells", "Blood cells", "Bacteria"];
      const fov = fieldOfView();
      const res = resolutionLimit();
      return (
        `Microscopic image: Viewing ${sampleNames[sampleType]} at ${magnification}× magnification. ` +
        `Field of view: ${fov.toFixed(0)} µm. Resolution limit: ~${res.toFixed(2)} µm. ` +
        `Focus depth: ${(focusDepth * 100).toFixed(0)}%. ` +
        `Optical microscopes are limited to ~0.2 µm resolution by the diffraction limit.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  function drawPlantCell(cx: number, cy: number, size: number, color: string, showDetail: boolean) {
    // Cell wall (rectangular)
    ctx.strokeStyle = "#2d5016";
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

    // Cell membrane
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.6;
    ctx.fillRect(cx - size / 2 + 2, cy - size / 2 + 2, size - 4, size - 4);
    ctx.globalAlpha /= 0.6;

    if (showDetail && size > 20) {
      // Nucleus
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100, 50, 120, 0.5)";
      ctx.fill();
      ctx.strokeStyle = "rgba(80, 40, 100, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Chloroplasts
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const r = size * 0.3;
        const cpx = cx + r * Math.cos(angle);
        const cpy = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.ellipse(cpx, cpy, size * 0.06, size * 0.04, angle, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 120, 0, 0.6)";
        ctx.fill();
      }

      // Central vacuole
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.05, cy + size * 0.05, size * 0.2, size * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180, 220, 255, 0.3)";
      ctx.fill();
    }
  }

  function drawRBC(cx: number, cy: number, size: number, showDetail: boolean) {
    // Biconcave disc shape (viewed from top = torus-like)
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(220, 60, 60, 0.6)";
    ctx.fill();

    if (showDetail && size > 10) {
      // Central pallor (biconcave)
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240, 160, 160, 0.5)";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(180, 40, 40, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawWBC(cx: number, cy: number, size: number, showDetail: boolean) {
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(155, 89, 182, 0.5)";
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 60, 150, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (showDetail && size > 15) {
      // Multi-lobed nucleus
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + 0.3;
        const lx = cx + size * 0.12 * Math.cos(angle);
        const ly = cy + size * 0.12 * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(lx, ly, size * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(80, 30, 100, 0.6)";
        ctx.fill();
      }
    }
  }

  function drawRodBacterium(cx: number, cy: number, size: number, color: string) {
    const angle = Math.random() * Math.PI;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-size * 1.5, -size * 0.4, size * 3, size * 0.8, size * 0.4);
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.7;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha /= 0.7;
    ctx.restore();
  }

  function drawCoccus(cx: number, cy: number, size: number, color: string) {
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha *= 0.7;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha /= 0.7;
  }

  return engine;
};

export default MicroscopicImageFactory;
