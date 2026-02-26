import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NaClIonicBondFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("nacl-ionic-bond") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let separation = 80;
  let showElectrons = 1;
  let showEnergyDiagram = 1;
  let animationSpeed = 1;

  // Animation state
  let electronTransferProgress = 0; // 0 = no transfer, 1 = complete
  let bondFormed = false;

  // Atom positions
  let naX = 0;
  let naY = 0;
  let clX = 0;
  let clY = 0;

  // Electron shells for Na: 2, 8, 1
  // Electron shells for Cl: 2, 8, 7
  const NA_SHELLS = [2, 8, 1];
  const CL_SHELLS = [2, 8, 7];
  const NA_RADIUS = 35;
  const CL_RADIUS = 40;
  const NA_ION_RADIUS = 25;
  const CL_ION_RADIUS = 48;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    electronTransferProgress = 0;
    bondFormed = false;
  }

  function update(dt: number, params: Record<string, number>): void {
    separation = params.separation ?? 80;
    showElectrons = params.showElectrons ?? 1;
    showEnergyDiagram = params.showEnergyDiagram ?? 1;
    animationSpeed = params.animationSpeed ?? 1;

    time += dt * animationSpeed;

    // Animate electron transfer
    if (separation < 60 && !bondFormed) {
      electronTransferProgress = Math.min(1, electronTransferProgress + dt * animationSpeed * 0.8);
      if (electronTransferProgress >= 1) bondFormed = true;
    } else if (separation >= 60) {
      electronTransferProgress = Math.max(0, electronTransferProgress - dt * animationSpeed * 1.5);
      if (electronTransferProgress <= 0) bondFormed = false;
    }

    // Atom positions
    const centerY = height * 0.4;
    naX = width / 2 - separation;
    naY = centerY;
    clX = width / 2 + separation;
    clY = centerY;
  }

  function drawAtom(
    x: number, y: number,
    symbol: string, name: string,
    baseRadius: number, ionRadius: number,
    shells: number[],
    color: string, ionColor: string,
    isPositive: boolean
  ): void {
    const currentRadius = baseRadius + (ionRadius - baseRadius) * electronTransferProgress;

    // Nucleus glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, currentRadius * 1.5);
    glow.addColorStop(0, bondFormed ? `${ionColor}40` : `${color}30`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, currentRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Nucleus
    const nucGrad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, currentRadius * 0.4);
    nucGrad.addColorStop(0, "#fff");
    nucGrad.addColorStop(0.5, bondFormed ? ionColor : color);
    nucGrad.addColorStop(1, bondFormed ? ionColor + "80" : color + "80");
    ctx.beginPath();
    ctx.arc(x, y, currentRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = nucGrad;
    ctx.fill();

    // Symbol
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (bondFormed) {
      ctx.fillText(isPositive ? "Na⁺" : "Cl⁻", x, y);
    } else {
      ctx.fillText(symbol, x, y);
    }

    // Electron shells
    if (showElectrons >= 1) {
      const shellRadii = [currentRadius * 0.55, currentRadius * 0.78, currentRadius];

      for (let s = 0; s < shells.length; s++) {
        const sr = shellRadii[s];

        // Shell orbit ring
        ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, sr, 0, Math.PI * 2);
        ctx.stroke();

        // Electrons in this shell
        let eCount = shells[s];

        // Handle electron transfer for outermost shell
        if (s === shells.length - 1) {
          if (isPositive) {
            // Na loses its outer electron
            eCount = Math.max(0, Math.round(shells[s] * (1 - electronTransferProgress)));
          } else {
            // Cl gains an electron
            eCount = shells[s] + Math.round(electronTransferProgress);
          }
        }

        for (let e = 0; e < eCount; e++) {
          const angle = (e / eCount) * Math.PI * 2 + time * (0.3 + s * 0.2);
          const ex = x + sr * Math.cos(angle);
          const ey = y + sr * Math.sin(angle);

          ctx.beginPath();
          ctx.arc(ex, ey, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#60a5fa";
          ctx.fill();
          ctx.strokeStyle = "#93c5fd";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Name label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(name, x, y + currentRadius + 10);

    // Charge indicator
    if (bondFormed) {
      ctx.fillStyle = isPositive ? "#ef4444" : "#3b82f6";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText(isPositive ? "+" : "−", x, y - currentRadius - 15);
    }
  }

  function drawElectronTransferArrow(): void {
    if (electronTransferProgress <= 0 || electronTransferProgress >= 1) return;

    const startX = naX + NA_RADIUS;
    const endX = clX - CL_RADIUS;
    const arrowX = startX + (endX - startX) * electronTransferProgress;
    const arrowY = naY - 10;

    // Curved arrow path
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(startX, naY);
    ctx.quadraticCurveTo((startX + endX) / 2, naY - 60, endX, clY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Traveling electron
    const t = electronTransferProgress;
    const eX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ((startX + endX) / 2) + t * t * endX;
    const eY = (1 - t) * (1 - t) * naY + 2 * (1 - t) * t * (naY - 60) + t * t * clY;

    const eGlow = ctx.createRadialGradient(eX, eY, 0, eX, eY, 12);
    eGlow.addColorStop(0, "rgba(251, 191, 36, 0.6)");
    eGlow.addColorStop(1, "transparent");
    ctx.fillStyle = eGlow;
    ctx.beginPath();
    ctx.arc(eX, eY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eX, eY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    // Label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("e⁻ transfer", (startX + endX) / 2, naY - 70);
  }

  function drawIonicBond(): void {
    if (!bondFormed) return;

    // Coulombic attraction line
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(naX + NA_ION_RADIUS, naY);
    ctx.lineTo(clX - CL_ION_RADIUS, clY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bond label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ionic Bond", (naX + clX) / 2, naY + 10);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Electrostatic attraction", (naX + clX) / 2, naY + 25);
  }

  function drawEnergyDiagram(): void {
    if (showEnergyDiagram < 1) return;

    const diagX = 40;
    const diagY = height * 0.65;
    const diagW = width - 80;
    const diagH = height * 0.28;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(diagX, diagY, diagW, diagH, 8);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Energy Diagram", diagX + diagW / 2, diagY + 18);

    // Energy curve (Coulomb potential)
    const plotLeft = diagX + 50;
    const plotRight = diagX + diagW - 20;
    const plotTop = diagY + 30;
    const plotBottom = diagY + diagH - 20;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Separation Distance", plotLeft + plotW / 2, plotBottom + 15);
    ctx.save();
    ctx.translate(diagX + 20, plotTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Energy", 0, 0);
    ctx.restore();

    // Zero line
    const zeroY = plotTop + plotH * 0.35;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, zeroY);
    ctx.lineTo(plotRight, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText("0", plotLeft - 5, zeroY + 3);

    // Potential energy curve
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= 100; i++) {
      const r = 0.2 + (i / 100) * 3;
      // Lennard-Jones-like potential
      const E = -1 / r + 0.5 / (r * r * r * r * r * r);
      const px = plotLeft + (i / 100) * plotW;
      const py = zeroY - E * plotH * 0.5;
      const clampedPy = Math.max(plotTop, Math.min(plotBottom, py));
      if (first) { ctx.moveTo(px, clampedPy); first = false; }
      else ctx.lineTo(px, clampedPy);
    }
    ctx.stroke();

    // Current position marker
    const rNorm = separation / 100;
    const markerX = plotLeft + Math.min(1, rNorm / 3) * plotW;
    const markerE = -1 / Math.max(rNorm, 0.2) + 0.5 / Math.pow(Math.max(rNorm, 0.2), 6);
    const markerY = Math.max(plotTop, Math.min(plotBottom, zeroY - markerE * plotH * 0.5));

    ctx.beginPath();
    ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#ef4444";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Potential Energy", plotRight - 90, plotTop + 12);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("NaCl Ionic Bond Formation", width / 2, 28);

    // Draw atoms
    drawAtom(naX, naY, "Na", "Sodium (Na)", NA_RADIUS, NA_ION_RADIUS, NA_SHELLS, "#ef4444", "#f87171", true);
    drawAtom(clX, clY, "Cl", "Chlorine (Cl)", CL_RADIUS, CL_ION_RADIUS, CL_SHELLS, "#22c55e", "#4ade80", false);

    drawElectronTransferArrow();
    drawIonicBond();
    drawEnergyDiagram();

    // Electron configuration info
    const infoY = height * 0.4 + 80;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (!bondFormed) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("Na: 2, 8, 1 (wants to lose 1 e⁻)", naX, infoY);
      ctx.fillStyle = "#22c55e";
      ctx.fillText("Cl: 2, 8, 7 (wants to gain 1 e⁻)", clX, infoY);
    } else {
      ctx.fillStyle = "#f87171";
      ctx.fillText("Na⁺: 2, 8 (stable octet)", naX, infoY);
      ctx.fillStyle = "#4ade80";
      ctx.fillText("Cl⁻: 2, 8, 8 (stable octet)", clX, infoY);
    }

    // Status
    ctx.fillStyle = bondFormed ? "#22c55e" : "#fbbf24";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      bondFormed ? "Ionic Bond Formed — NaCl" : "Bring atoms closer to form bond",
      width / 2,
      height * 0.4 + 100
    );
  }

  function reset(): void {
    time = 0;
    electronTransferProgress = 0;
    bondFormed = false;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `NaCl Ionic Bond: Separation=${separation}px, bond ${bondFormed ? "formed" : "not formed"}. ` +
      `Electron transfer progress: ${(electronTransferProgress * 100).toFixed(0)}%. ` +
      `Na (2,8,1) loses 1 electron to become Na⁺ (2,8). ` +
      `Cl (2,8,7) gains 1 electron to become Cl⁻ (2,8,8). ` +
      `The electrostatic attraction between Na⁺ and Cl⁻ forms the ionic bond.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NaClIonicBondFactory;
