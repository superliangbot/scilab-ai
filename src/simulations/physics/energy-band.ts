import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EnergyBandFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("energy-band") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let atomCount = 4;
  let bandGap = 3; // eV
  let materialType = 0; // 0=conductor, 1=semiconductor, 2=insulator

  // Derived from materialType
  function getEffectiveGap(): number {
    if (materialType < 0.5) return 0; // conductor: overlap
    if (materialType < 1.5) return bandGap * 0.3; // semiconductor: small gap
    return bandGap; // insulator: large gap
  }

  // Energy level visualization
  const DIAGRAM_LEFT = 80;
  const DIAGRAM_RIGHT = 720;
  const DIAGRAM_TOP = 120;
  const DIAGRAM_BOTTOM = 500;

  interface EnergyLevel {
    y: number;
    width: number;
    color: string;
    label: string;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    atomCount = Math.round(params.atomCount ?? 4);
    bandGap = params.bandGap ?? 3;
    materialType = Math.round(params.materialType ?? 0);
    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    const matLabel = materialType < 0.5 ? "Conductor (Metal)" : materialType < 1.5 ? "Semiconductor" : "Insulator";
    ctx.fillText(`Energy Band Theory — ${matLabel}`, W / 2, 35);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("As atoms come together, discrete energy levels broaden into continuous bands", W / 2, 55);
  }

  function drawSingleAtomLevels(): void {
    const x = DIAGRAM_LEFT;
    const w = 60;
    const cy = (DIAGRAM_TOP + DIAGRAM_BOTTOM) / 2;

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("1 Atom", x + w / 2, DIAGRAM_TOP - 10);

    // Discrete energy levels
    const levels = [-80, -40, 0, 40, 80];
    const colors = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6"];
    const labels = ["1s", "2s", "2p", "3s", "3p"];

    for (let i = 0; i < levels.length; i++) {
      const y = cy + levels[i];
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();

      ctx.fillStyle = colors[i];
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(labels[i], x - 5, y + 3);
    }

    // Electron dots on lower levels
    for (let i = 0; i < 3; i++) {
      const y = cy + levels[i];
      ctx.beginPath();
      ctx.arc(x + 20, y - 4, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 40, y - 4, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
  }

  function drawMultiAtomBands(): void {
    const sectionWidth = (DIAGRAM_RIGHT - DIAGRAM_LEFT - 100) / Math.max(1, atomCount);
    const startX = DIAGRAM_LEFT + 80;
    const cy = (DIAGRAM_TOP + DIAGRAM_BOTTOM) / 2;
    const gap = getEffectiveGap();

    for (let n = 1; n <= atomCount; n++) {
      const x = startX + (n - 1) * sectionWidth;
      const w = sectionWidth - 10;

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n === 1 ? "2 Atoms" : `${n + 1} Atoms`, x + w / 2, DIAGRAM_TOP - 10);

      // Band broadening: more atoms → wider bands
      const broadening = n / atomCount;

      // Draw energy bands
      const bandHeight = 20 + broadening * 35;
      const gapSize = gap * (12 - broadening * 4);

      // Valence band (lower)
      const valenceTop = cy + gapSize / 2;
      const valenceBottom = valenceTop + bandHeight;

      const valGrad = ctx.createLinearGradient(x, valenceTop, x, valenceBottom);
      valGrad.addColorStop(0, "rgba(239, 68, 68, 0.6)");
      valGrad.addColorStop(1, "rgba(239, 68, 68, 0.2)");
      ctx.fillStyle = valGrad;
      ctx.fillRect(x, valenceTop, w, bandHeight);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, valenceTop, w, bandHeight);

      // Sub-levels within band
      const numSublevels = Math.min(n + 1, 8);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
      ctx.lineWidth = 0.5;
      for (let s = 0; s < numSublevels; s++) {
        const sy = valenceTop + (s / numSublevels) * bandHeight;
        ctx.beginPath();
        ctx.moveTo(x + 2, sy);
        ctx.lineTo(x + w - 2, sy);
        ctx.stroke();
      }

      // Conduction band (upper)
      const condBottom = cy - gapSize / 2;
      const condTop = condBottom - bandHeight;

      const condGrad = ctx.createLinearGradient(x, condTop, x, condBottom);
      condGrad.addColorStop(0, "rgba(59, 130, 246, 0.2)");
      condGrad.addColorStop(1, "rgba(59, 130, 246, 0.6)");
      ctx.fillStyle = condGrad;
      ctx.fillRect(x, condTop, w, bandHeight);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, condTop, w, bandHeight);

      ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
      ctx.lineWidth = 0.5;
      for (let s = 0; s < numSublevels; s++) {
        const sy = condTop + (s / numSublevels) * bandHeight;
        ctx.beginPath();
        ctx.moveTo(x + 2, sy);
        ctx.lineTo(x + w - 2, sy);
        ctx.stroke();
      }

      // Band overlap for conductors
      if (materialType < 0.5 && n > 1) {
        const overlapGrad = ctx.createLinearGradient(x, condBottom - 10, x, valenceTop + 10);
        overlapGrad.addColorStop(0, "rgba(59, 130, 246, 0.3)");
        overlapGrad.addColorStop(0.5, "rgba(139, 92, 246, 0.3)");
        overlapGrad.addColorStop(1, "rgba(239, 68, 68, 0.3)");
        ctx.fillStyle = overlapGrad;
        ctx.fillRect(x, condBottom - 10, w, valenceTop - condBottom + 20);
      }

      // Band gap label for last column
      if (n === atomCount && gapSize > 10) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x + w + 5, condBottom);
        ctx.lineTo(x + w + 25, condBottom);
        ctx.moveTo(x + w + 5, valenceTop);
        ctx.lineTo(x + w + 25, valenceTop);
        ctx.stroke();

        // Arrow between them
        ctx.strokeStyle = "rgba(255, 200, 50, 0.7)";
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x + w + 15, condBottom + 3);
        ctx.lineTo(x + w + 15, valenceTop - 3);
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Eg = ${getEffectiveGap().toFixed(1)} eV`, x + w + 22, (condBottom + valenceTop) / 2 + 3);
        ctx.restore();
      }
    }
  }

  function drawLegend(): void {
    const lx = 15;
    const ly = H - 90;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, 220, 75, 6);
    ctx.fill();

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(lx + 10, ly + 12, 14, 10);
    ctx.fillText("Conduction Band (empty/partial)", lx + 30, ly + 22);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(lx + 10, ly + 32, 14, 10);
    ctx.fillText("Valence Band (filled with electrons)", lx + 30, ly + 42);

    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(lx + 10, ly + 52, 14, 10);
    ctx.fillText("Band Gap (forbidden energy region)", lx + 30, ly + 62);
  }

  function drawEnergyAxis(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, DIAGRAM_TOP);
    ctx.lineTo(40, DIAGRAM_BOTTOM);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(40, DIAGRAM_TOP);
    ctx.lineTo(36, DIAGRAM_TOP + 8);
    ctx.lineTo(44, DIAGRAM_TOP + 8);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fill();

    ctx.save();
    ctx.translate(22, (DIAGRAM_TOP + DIAGRAM_BOTTOM) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy (E)", 0, 0);
    ctx.restore();

    ctx.restore();
  }

  function drawMaterialComparison(): void {
    const py = H - 80;
    const labels = ["Conductor", "Semiconductor", "Insulator"];
    const gaps = ["No gap (overlap)", "Small gap (~1 eV)", "Large gap (>5 eV)"];
    const colors = ["#22c55e", "#fbbf24", "#ef4444"];

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";

    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 150 + i * 150;
      const active = Math.round(materialType) === i;
      ctx.fillStyle = active ? colors[i] : "rgba(148, 163, 184, 0.3)";
      ctx.font = active ? "bold 12px system-ui, sans-serif" : "11px system-ui, sans-serif";
      ctx.fillText(labels[i], x, py);
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(gaps[i], x, py + 14);
    }
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawTitle();
    drawEnergyAxis();
    drawSingleAtomLevels();
    drawMultiAtomBands();
    drawLegend();
    drawMaterialComparison();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const matLabel = materialType < 0.5 ? "conductor" : materialType < 1.5 ? "semiconductor" : "insulator";
    const gap = getEffectiveGap();
    return (
      `Energy Band Theory: Viewing ${atomCount + 1} atoms forming a ${matLabel}. ` +
      `Band gap = ${gap.toFixed(1)} eV. ` +
      `When isolated atoms come together, their discrete energy levels split and broaden into bands. ` +
      `Conductors have overlapping valence/conduction bands. Semiconductors have a small gap (~1 eV). ` +
      `Insulators have a large gap (>5 eV), making it hard for electrons to reach the conduction band.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EnergyBandFactory;
