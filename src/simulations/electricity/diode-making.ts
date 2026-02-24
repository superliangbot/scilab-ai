import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Atom {
  x: number;
  y: number;
  type: "silicon" | "gallium" | "arsenic";
  electrons: number;
}

const DiodeMakingFactory = (): SimulationEngine => {
  const config = getSimConfig("diode-making") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};
  let lattice: (Atom | null)[][] = [];
  let animPhase = 0;

  const GRID_ROWS = 6;
  const GRID_COLS = 8;

  function buildLattice(): void {
    const dopingLevel = currentParams.dopingLevel ?? 2;
    const dopingCount = Math.round(dopingLevel);

    lattice = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const row: (Atom | null)[] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const isLeftHalf = c < GRID_COLS / 2;

        let type: "silicon" | "gallium" | "arsenic" = "silicon";
        let electrons = 4; // silicon has 4 valence electrons

        // Doping: add impurities based on doping level
        if (isLeftHalf) {
          // P-type: gallium (3 valence electrons) doping
          if (r % 2 === 0 && c % Math.max(1, Math.floor(4 / dopingCount)) === 0 && c < GRID_COLS / 2 - 1) {
            type = "gallium";
            electrons = 3;
          }
        } else {
          // N-type: arsenic (5 valence electrons) doping
          if (r % 2 === 1 && (c - GRID_COLS / 2) % Math.max(1, Math.floor(4 / dopingCount)) === 0 && c > GRID_COLS / 2) {
            type = "arsenic";
            electrons = 5;
          }
        }

        row.push({
          x: 0, y: 0, // Will be computed in render
          type,
          electrons,
        });
      }
      lattice.push(row);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    buildLattice();
  }

  function update(dt: number, params: Record<string, number>): void {
    const oldLevel = Math.round(currentParams.dopingLevel ?? 2);
    currentParams = params;
    const newLevel = Math.round(params.dopingLevel ?? 2);
    if (oldLevel !== newLevel) buildLattice();

    animPhase += dt * 2;
    time += dt;
  }

  function drawAtom(cx: number, cy: number, atom: Atom, cellSize: number): void {
    const r = cellSize * 0.22;

    // Atom nucleus
    let color: string;
    let label: string;
    switch (atom.type) {
      case "silicon":
        color = "#64748b";
        label = "Si";
        break;
      case "gallium":
        color = "#ec4899";
        label = "Ga";
        break;
      case "arsenic":
        color = "#3b82f6";
        label = "As";
        break;
    }

    // Glow for dopants
    if (atom.type !== "silicon") {
      ctx.fillStyle = atom.type === "gallium" ? "rgba(236, 72, 153, 0.2)" : "rgba(59, 130, 246, 0.2)";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nucleus
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(9, r * 0.8)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);

    // Valence electrons
    const electronR = r * 0.25;
    const orbitR = r * 1.6;
    for (let i = 0; i < atom.electrons; i++) {
      const angle = (i / atom.electrons) * Math.PI * 2 + animPhase * 0.3;
      const ex = cx + orbitR * Math.cos(angle);
      const ey = cy + orbitR * Math.sin(angle);

      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(ex, ey, electronR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Highlight missing electron (hole) for Ga or extra for As
    if (atom.type === "gallium") {
      // Show hole
      const holeAngle = animPhase * 0.3 + Math.PI;
      const hx = cx + orbitR * 1.3 * Math.cos(holeAngle);
      const hy = cy + orbitR * 1.3 * Math.sin(holeAngle);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(hx, hy, electronR * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (atom.type === "arsenic") {
      // Highlight the extra (5th) electron
      const extraAngle = (4 / 5) * Math.PI * 2 + animPhase * 0.3;
      const ex = cx + orbitR * Math.cos(extraAngle);
      const ey = cy + orbitR * Math.sin(extraAngle);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, electronR * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textBaseline = "alphabetic";
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const showBonds = currentParams.showBonds ?? 1;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Diode Making — P-N Junction Construction", width / 2, 28);

    // Grid layout
    const margin = 50;
    const gridW = width - margin * 2;
    const gridH = height * 0.55;
    const gridTop = 70;
    const cellW = gridW / GRID_COLS;
    const cellH = gridH / GRID_ROWS;
    const cellSize = Math.min(cellW, cellH);

    const startX = (width - cellSize * GRID_COLS) / 2;
    const startY = gridTop;

    // Background regions
    // P-type background
    ctx.fillStyle = "rgba(236, 72, 153, 0.08)";
    ctx.fillRect(startX, startY, cellSize * GRID_COLS / 2, cellSize * GRID_ROWS);
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, cellSize * GRID_COLS / 2, cellSize * GRID_ROWS);

    // N-type background
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(startX + cellSize * GRID_COLS / 2, startY, cellSize * GRID_COLS / 2, cellSize * GRID_ROWS);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX + cellSize * GRID_COLS / 2, startY, cellSize * GRID_COLS / 2, cellSize * GRID_ROWS);

    // Region labels
    ctx.font = `bold ${Math.max(14, width * 0.02)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ec4899";
    ctx.fillText("P-type (Gallium doped)", startX + cellSize * GRID_COLS / 4, startY - 10);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("N-type (Arsenic doped)", startX + cellSize * 3 * GRID_COLS / 4, startY - 10);

    // Junction line
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(startX + cellSize * GRID_COLS / 2, startY);
    ctx.lineTo(startX + cellSize * GRID_COLS / 2, startY + cellSize * GRID_ROWS);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fbbf24";
    ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
    ctx.fillText("P-N Junction", startX + cellSize * GRID_COLS / 2, startY + cellSize * GRID_ROWS + 15);

    // Draw bonds
    if (showBonds >= 0.5) {
      ctx.strokeStyle = "#33415588";
      ctx.lineWidth = 1;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const ax = startX + c * cellSize + cellSize / 2;
          const ay = startY + r * cellSize + cellSize / 2;
          // Horizontal bond
          if (c < GRID_COLS - 1) {
            ctx.beginPath();
            ctx.moveTo(ax + cellSize * 0.25, ay);
            ctx.lineTo(ax + cellSize * 0.75, ay);
            ctx.stroke();
          }
          // Vertical bond
          if (r < GRID_ROWS - 1) {
            ctx.beginPath();
            ctx.moveTo(ax, ay + cellSize * 0.25);
            ctx.lineTo(ax, ay + cellSize * 0.75);
            ctx.stroke();
          }
        }
      }
    }

    // Draw atoms
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const atom = lattice[r]?.[c];
        if (!atom) continue;
        const ax = startX + c * cellSize + cellSize / 2;
        const ay = startY + r * cellSize + cellSize / 2;
        atom.x = ax;
        atom.y = ay;
        drawAtom(ax, ay, atom, cellSize);
      }
    }

    // Info panel
    const panelY = startY + cellSize * GRID_ROWS + 30;
    const panelH = height - panelY - 15;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(margin, panelY, width - margin * 2, panelH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, panelY, width - margin * 2, panelH);

    const lineH = Math.min(20, panelH / 6);
    ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
    ctx.textAlign = "left";

    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("How a diode is made:", margin + 15, panelY + lineH);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText("1. Start with pure Silicon (Si) — 4 valence electrons", margin + 15, panelY + lineH * 2);
    ctx.fillStyle = "#ec4899";
    ctx.fillText("2. P-type: Dope with Gallium (Ga, 3 electrons) → creates holes (+)", margin + 15, panelY + lineH * 3);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("3. N-type: Dope with Arsenic (As, 5 electrons) → free electrons (−)", margin + 15, panelY + lineH * 4);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("4. Join P and N → P-N junction = Diode (conducts one way)", margin + 15, panelY + lineH * 5);

    // Legend
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(margin + 25, panelY + lineH * 6 - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Si (4e⁻)", margin + 35, panelY + lineH * 6);

    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.arc(margin + 110, panelY + lineH * 6 - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("Ga (3e⁻)", margin + 120, panelY + lineH * 6);

    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(margin + 200, panelY + lineH * 6 - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("As (5e⁻)", margin + 210, panelY + lineH * 6);

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(margin + 290, panelY + lineH * 6 - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Valence e⁻", margin + 300, panelY + lineH * 6);
  }

  function reset(): void {
    time = 0;
    animPhase = 0;
    currentParams = {};
    buildLattice();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const dopingLevel = Math.round(currentParams.dopingLevel ?? 2);
    const gaCount = lattice.flat().filter(a => a?.type === "gallium").length;
    const asCount = lattice.flat().filter(a => a?.type === "arsenic").length;

    return `Diode making simulation: A silicon crystal lattice doped to create a P-N junction. P-type side has ${gaCount} Gallium atoms (3 valence electrons, creating holes as majority carriers). N-type side has ${asCount} Arsenic atoms (5 valence electrons, providing free electrons as majority carriers). Doping level: ${dopingLevel}. Silicon has 4 valence electrons and forms covalent bonds. Trivalent dopants (Ga) create P-type semiconductors with holes, while pentavalent dopants (As) create N-type with extra electrons. The junction between them forms a diode.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DiodeMakingFactory;
