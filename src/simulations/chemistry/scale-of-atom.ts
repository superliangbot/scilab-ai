import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Scale of Atom — demonstrates the vast difference in scale between
 * the nucleus and the electron cloud / atom as a whole.
 * Allows zooming from macroscopic (golf ball) to subatomic scale.
 */

interface ScaleLevel {
  name: string;
  size: number; // meters
  description: string;
  color: string;
}

const ScaleOfAtomFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("scale-of-atom") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let zoomLevel = 0; // 0 to 10 (macro to nuclear)
  let animSpeed = 1;
  let showLabels = 1;
  let electronCloud = 1;

  const scales: ScaleLevel[] = [
    { name: "Golf ball", size: 0.043, description: "~4.3 cm diameter", color: "#f0f0f0" },
    { name: "Grain of sand", size: 5e-4, description: "~0.5 mm", color: "#e8c870" },
    { name: "Human cell", size: 1e-5, description: "~10 μm", color: "#ff9999" },
    { name: "Bacterium", size: 1e-6, description: "~1 μm", color: "#66cc66" },
    { name: "Virus", size: 1e-7, description: "~100 nm", color: "#cc66cc" },
    { name: "Protein molecule", size: 1e-8, description: "~10 nm", color: "#6699ff" },
    { name: "Water molecule", size: 2.75e-10, description: "~0.275 nm", color: "#33ccff" },
    { name: "Atom (H)", size: 1.2e-10, description: "~120 pm", color: "#88aaff" },
    { name: "Atom (Au)", size: 2.88e-10, description: "~288 pm", color: "#ffd700" },
    { name: "Nucleus (H)", size: 1.75e-15, description: "~1.75 fm", color: "#ff4444" },
    { name: "Nucleus (Au)", size: 1.4e-14, description: "~14 fm", color: "#ffaa00" },
  ];

  let electronAngles: number[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    electronAngles = Array.from({ length: 8 }, () => Math.random() * Math.PI * 2);
  }

  function update(dt: number, params: Record<string, number>): void {
    zoomLevel = params.zoomLevel ?? 0;
    animSpeed = params.animSpeed ?? 1;
    showLabels = params.showLabels ?? 1;
    electronCloud = params.electronCloud ?? 1;

    const step = Math.min(dt, 0.033);
    time += step * animSpeed;

    for (let i = 0; i < electronAngles.length; i++) {
      electronAngles[i] += (1.5 + i * 0.3) * step * animSpeed;
    }
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Determine current scale index and interpolation
    const scaleIdx = Math.min(Math.floor(zoomLevel), scales.length - 2);
    const frac = zoomLevel - scaleIdx;
    const currentScale = scales[scaleIdx];
    const nextScale = scales[Math.min(scaleIdx + 1, scales.length - 1)];

    // Draw zoom circle
    const mainRadius = Math.min(width, height) * 0.3;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, mainRadius * 0.8, cx, cy, mainRadius * 1.3);
    glow.addColorStop(0, "rgba(60, 100, 200, 0.1)");
    glow.addColorStop(1, "rgba(60, 100, 200, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, mainRadius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Main view circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, mainRadius, 0, Math.PI * 2);
    ctx.clip();

    // Fill with dark
    ctx.fillStyle = "#080818";
    ctx.fillRect(cx - mainRadius, cy - mainRadius, mainRadius * 2, mainRadius * 2);

    // Draw the object at current scale
    if (zoomLevel < 7) {
      // Macro to molecular: show a sphere
      const objRadius = mainRadius * (0.4 + 0.2 * Math.sin(time * 0.5));
      const col = currentScale.color;
      const grad = ctx.createRadialGradient(cx - objRadius * 0.3, cy - objRadius * 0.3, 0, cx, cy, objRadius);
      grad.addColorStop(0, col);
      grad.addColorStop(1, `rgba(0,0,0,0.8)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, objRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (zoomLevel < 9) {
      // Atomic scale: show electron cloud + nucleus
      const atomR = mainRadius * 0.8;

      // Electron cloud
      if (electronCloud >= 0.5) {
        for (let r = atomR; r > 5; r -= 3) {
          const alpha = 0.02 + 0.03 * Math.sin(r * 0.1 + time * 2);
          ctx.fillStyle = `rgba(100, 150, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Orbital electrons
        for (let i = 0; i < electronAngles.length; i++) {
          const orbR = atomR * (0.3 + (i % 4) * 0.15);
          const ex = cx + orbR * Math.cos(electronAngles[i]);
          const ey = cy + orbR * Math.sin(electronAngles[i]);
          const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
          eGrad.addColorStop(0, "rgba(100, 200, 255, 0.9)");
          eGrad.addColorStop(1, "rgba(100, 200, 255, 0)");
          ctx.fillStyle = eGrad;
          ctx.beginPath();
          ctx.arc(ex, ey, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Tiny nucleus in center
      const nucR = Math.max(2, atomR * 0.01 * (1 + (zoomLevel - 7)));
      const nGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, nucR);
      nGrad.addColorStop(0, "#ff6644");
      nGrad.addColorStop(1, "#cc2200");
      ctx.fillStyle = nGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, nucR, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Nuclear scale: show protons and neutrons
      const nucR = mainRadius * 0.5;
      const numNucleons = Math.round(5 + zoomLevel * 2);

      for (let i = 0; i < numNucleons; i++) {
        const angle = (i / numNucleons) * Math.PI * 2 + Math.sin(time + i) * 0.2;
        const r = nucR * (0.1 + 0.6 * Math.sqrt(i / numNucleons));
        const nx = cx + r * Math.cos(angle);
        const ny = cy + r * Math.sin(angle);
        const isProton = i % 2 === 0;
        const nRad = mainRadius * 0.08;

        const nGrad = ctx.createRadialGradient(nx - nRad * 0.3, ny - nRad * 0.3, 0, nx, ny, nRad);
        nGrad.addColorStop(0, isProton ? "#ff6666" : "#6688ff");
        nGrad.addColorStop(1, isProton ? "#aa2222" : "#2244aa");
        ctx.fillStyle = nGrad;
        ctx.beginPath();
        ctx.arc(nx, ny, nRad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Border ring
    ctx.strokeStyle = "rgba(100, 150, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, mainRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Scale labels
    if (showLabels >= 0.5) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(currentScale.name, cx, cy + mainRadius + 25);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText(currentScale.description, cx, cy + mainRadius + 42);
      ctx.fillText(`Size: ${currentScale.size.toExponential(2)} m`, cx, cy + mainRadius + 58);
    }

    // Scale bar on left
    const barX = 30;
    const barTop = 50;
    const barH = height - 100;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(barX - 2, barTop, 4, barH);

    // Scale markers
    for (let i = 0; i < scales.length; i++) {
      const y = barTop + (i / (scales.length - 1)) * barH;
      const isCurrent = Math.abs(zoomLevel - i) < 0.6;
      ctx.fillStyle = isCurrent ? scales[i].color : "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(barX, y, isCurrent ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      if (showLabels >= 0.5) {
        ctx.fillStyle = isCurrent ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.35)";
        ctx.font = isCurrent ? "bold 10px system-ui, sans-serif" : "9px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(scales[i].name, barX + 12, y + 4);
      }
    }

    // Current position indicator
    const posY = barTop + (zoomLevel / (scales.length - 1)) * barH;
    ctx.fillStyle = "#ffcc33";
    ctx.beginPath();
    ctx.moveTo(barX + 8, posY);
    ctx.lineTo(barX + 14, posY - 4);
    ctx.lineTo(barX + 14, posY + 4);
    ctx.closePath();
    ctx.fill();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(width - 260, 10, 250, 75, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Scale of an Atom", width - 250, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("Atom is ~100,000× larger than nucleus", width - 250, 46);
    ctx.fillText("If nucleus = marble, atom = stadium", width - 250, 62);
    ctx.fillText(`Ratio: ~10⁻¹⁵ m / ~10⁻¹⁰ m = 10⁻⁵`, width - 250, 78);
  }

  function reset(): void {
    time = 0;
    electronAngles = Array.from({ length: 8 }, () => Math.random() * Math.PI * 2);
  }

  function destroy(): void {
    electronAngles = [];
  }

  function getStateDescription(): string {
    const idx = Math.min(Math.floor(zoomLevel), scales.length - 1);
    return (
      `Scale of Atom: Viewing "${scales[idx].name}" at scale ${scales[idx].size.toExponential(2)} m. ` +
      `Zoom level: ${zoomLevel.toFixed(1)}/10. The atom is ~100,000 times larger than its nucleus. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ScaleOfAtomFactory;
