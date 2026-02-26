import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Michelson Interferometer: Demonstrates the splitting of light into two beams
 * that travel different paths and recombine to produce interference fringes.
 * Used in the famous Michelson-Morley experiment.
 */
const MichelsonInterferometerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("michelson-interferometer") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let wavelength = 550; // nm
  let mirrorOffset = 0; // nm displacement of mirror 2
  let beamSplitterReflect = 0.5;
  let showFringes = 1;

  function wavelengthToColor(wl: number): string {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl >= 645 && wl <= 780) { r = 1; }
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }

  function phaseFromPath(pathDiff: number): number {
    // phase = 2*pi*pathDiff/wavelength
    return (2 * Math.PI * pathDiff) / wavelength;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      wavelength = params.wavelength ?? 550;
      mirrorOffset = params.mirrorOffset ?? 0;
      beamSplitterReflect = params.beamSplitterReflect ?? 0.5;
      showFringes = params.showFringes ?? 1;
      time += dt;
    },

    render() {
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Michelson Interferometer", W / 2, 28);

      const lightColor = wavelengthToColor(wavelength);

      // Layout positions
      const sourceX = W * 0.08;
      const sourceY = H * 0.5;
      const splitterX = W * 0.35;
      const splitterY = H * 0.5;
      const mirror1X = splitterX;
      const mirror1Y = H * 0.12;
      const mirror2X = W * 0.65;
      const mirror2Y = splitterY;
      const detectorX = splitterX;
      const detectorY = H * 0.82;

      // Draw beam splitter (45-degree plate)
      ctx.save();
      ctx.translate(splitterX, splitterY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "rgba(100, 180, 255, 0.3)";
      ctx.fillRect(-25, -3, 50, 6);
      ctx.strokeStyle = "rgba(100, 180, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(-25, -3, 50, 6);
      ctx.restore();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Beam Splitter", splitterX, splitterY + 35);

      // Draw mirrors
      // Mirror 1 (top)
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(mirror1X - 25, mirror1Y - 3, 50, 6);
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 2;
      ctx.strokeRect(mirror1X - 25, mirror1Y - 3, 50, 6);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Mirror 1", mirror1X, mirror1Y - 12);

      // Mirror 2 (right) - slightly offset
      const m2OffsetPx = mirrorOffset * 0.05; // visual offset
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(mirror2X + m2OffsetPx - 3, mirror2Y - 25, 6, 50);
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 2;
      ctx.strokeRect(mirror2X + m2OffsetPx - 3, mirror2Y - 25, 6, 50);
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Mirror 2", mirror2X + m2OffsetPx, mirror2Y - 32);
      if (mirrorOffset !== 0) {
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`Δd = ${mirrorOffset.toFixed(0)} nm`, mirror2X + m2OffsetPx, mirror2Y + 40);
      }

      // Light source
      const sourceGlow = ctx.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, 20);
      sourceGlow.addColorStop(0, lightColor);
      sourceGlow.addColorStop(1, "transparent");
      ctx.fillStyle = sourceGlow;
      ctx.beginPath();
      ctx.arc(sourceX, sourceY, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sourceX, sourceY, 8, 0, Math.PI * 2);
      ctx.fillStyle = lightColor;
      ctx.fill();
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = lightColor;
      ctx.textAlign = "center";
      ctx.fillText("Light Source", sourceX, sourceY + 30);
      ctx.fillText(`λ = ${wavelength} nm`, sourceX, sourceY + 44);

      // Animated light wave phase
      const wavePhase = time * 4;

      // Beam: Source → Splitter
      drawBeam(sourceX + 10, sourceY, splitterX - 10, splitterY, lightColor, wavePhase, 1);

      // Beam: Splitter → Mirror 1 (reflected up)
      drawBeam(splitterX, splitterY - 10, mirror1X, mirror1Y + 5, lightColor, wavePhase, beamSplitterReflect);

      // Beam: Mirror 1 → Splitter (back down)
      drawBeam(mirror1X, mirror1Y + 5, splitterX, splitterY - 10, lightColor, wavePhase + 0.5, beamSplitterReflect);

      // Beam: Splitter → Mirror 2 (transmitted right)
      drawBeam(splitterX + 10, splitterY, mirror2X + m2OffsetPx - 5, mirror2Y, lightColor, wavePhase, 1 - beamSplitterReflect);

      // Beam: Mirror 2 → Splitter (back left)
      drawBeam(mirror2X + m2OffsetPx - 5, mirror2Y, splitterX + 10, splitterY, lightColor, wavePhase + 0.5, 1 - beamSplitterReflect);

      // Combined beam to detector
      const pathDiff = 2 * mirrorOffset; // round trip
      const phase = phaseFromPath(pathDiff);
      const intensity = Math.cos(phase / 2) ** 2;

      drawBeam(splitterX, splitterY + 10, detectorX, detectorY - 10, lightColor, wavePhase, intensity);

      // Detector
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(detectorX - 30, detectorY - 5, 60, 30, 5);
      ctx.fill();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Detector", detectorX, detectorY + 38);

      // Intensity indicator on detector
      ctx.fillStyle = lightColor;
      ctx.globalAlpha = intensity;
      ctx.beginPath();
      ctx.roundRect(detectorX - 25, detectorY, 50, 20, 3);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Fringe pattern (right side)
      if (showFringes) {
        const fringeX = W * 0.75;
        const fringeY = H * 0.1;
        const fringeW = W * 0.2;
        const fringeH = H * 0.45;

        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.beginPath();
        ctx.roundRect(fringeX - 5, fringeY - 5, fringeW + 10, fringeH + 30, 8);
        ctx.fill();

        ctx.font = "bold 12px system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.fillText("Interference Pattern", fringeX + fringeW / 2, fringeY + 10);

        // Draw circular fringe pattern
        const fCx = fringeX + fringeW / 2;
        const fCy = fringeY + fringeH / 2 + 10;
        const maxR = Math.min(fringeW, fringeH) * 0.4;

        for (let r = maxR; r > 0; r -= 2) {
          const ringPhase = phase + (r / maxR) * Math.PI * 6;
          const ringIntensity = Math.cos(ringPhase / 2) ** 2;
          ctx.beginPath();
          ctx.arc(fCx, fCy, r, 0, Math.PI * 2);
          ctx.fillStyle = lightColor;
          ctx.globalAlpha = ringIntensity * 0.8;
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.font = "10px system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText("Circular fringes", fCx, fringeY + fringeH + 20);
      }

      // Info panel
      const panelY = H - 60;
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Path difference: ${(2 * mirrorOffset).toFixed(0)} nm`, 16, panelY);
      ctx.fillStyle = "#22c55e";
      ctx.fillText(`Phase difference: ${((phase * 180) / Math.PI).toFixed(1)}°`, 16, panelY + 20);

      ctx.textAlign = "right";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Intensity: ${(intensity * 100).toFixed(1)}%`, W - 16, panelY);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        intensity > 0.8 ? "Constructive interference" : intensity < 0.2 ? "Destructive interference" : "Partial interference",
        W - 16, panelY + 20
      );

      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("Move Mirror 2 to change path difference and observe fringe shifts", W / 2, H - 10);
    },

    reset() {
      time = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const pathDiff = 2 * mirrorOffset;
      const phase = phaseFromPath(pathDiff);
      const intensity = Math.cos(phase / 2) ** 2;
      return (
        `Michelson Interferometer: λ=${wavelength}nm, mirror offset=${mirrorOffset}nm, ` +
        `path difference=${pathDiff}nm, phase=${((phase * 180) / Math.PI).toFixed(1)}°, ` +
        `intensity=${(intensity * 100).toFixed(1)}%. ` +
        `${intensity > 0.8 ? "Constructive" : intensity < 0.2 ? "Destructive" : "Partial"} interference.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  function drawBeam(x1: number, y1: number, x2: number, y2: number, color: string, phase: number, alpha: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    ctx.save();
    ctx.globalAlpha = Math.max(0.1, alpha);

    // Main beam line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Animated wave dots along beam
    const numDots = Math.floor(len / 12);
    const nx = dx / len;
    const ny = dy / len;

    for (let i = 0; i < numDots; i++) {
      const t = (i / numDots + phase * 0.1) % 1;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const waveOffset = Math.sin(t * Math.PI * 8 + phase) * 3;

      ctx.beginPath();
      ctx.arc(px - ny * waveOffset, py + nx * waveOffset, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
  }

  return engine;
};

export default MichelsonInterferometerFactory;
