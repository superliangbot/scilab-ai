import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Mendeleev's Periodic Table: Interactive periodic table showing element properties,
 * groups, periods, and trends (electronegativity, atomic radius, ionization energy).
 */
const MendeleevFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("mendeleev") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;

  let colorMode = 0; // 0=category, 1=electronegativity, 2=atomic mass
  let highlightGroup = 0; // 0=none, 1-18
  let showLabels = 1;
  let selectedElement = -1;

  // Compact element data: [symbol, name, atomicNumber, atomicMass, category, group, period, electronegativity]
  // Categories: 0=alkali, 1=alkaline earth, 2=transition, 3=post-transition, 4=metalloid, 5=nonmetal, 6=halogen, 7=noble gas, 8=lanthanide, 9=actinide
  interface Element {
    sym: string;
    name: string;
    z: number;
    mass: number;
    cat: number;
    group: number;
    period: number;
    en: number; // electronegativity (Pauling)
    col: number; // column in table (0-indexed)
    row: number; // row (0-indexed)
  }

  const CATEGORY_COLORS = [
    "#ef4444", // alkali metals
    "#f59e0b", // alkaline earth
    "#3b82f6", // transition metals
    "#22c55e", // post-transition
    "#8b5cf6", // metalloid
    "#06b6d4", // nonmetal
    "#ec4899", // halogen
    "#a855f7", // noble gas
    "#14b8a6", // lanthanide
    "#f97316", // actinide
  ];

  const CATEGORY_NAMES = [
    "Alkali Metal", "Alkaline Earth", "Transition Metal", "Post-Transition",
    "Metalloid", "Nonmetal", "Halogen", "Noble Gas", "Lanthanide", "Actinide",
  ];

  // Main table elements (first 56 + 72-86 + select others, simplified)
  const elements: Element[] = [
    { sym: "H", name: "Hydrogen", z: 1, mass: 1.008, cat: 5, en: 2.2, group: 1, period: 1, col: 0, row: 0 },
    { sym: "He", name: "Helium", z: 2, mass: 4.003, cat: 7, en: 0, group: 18, period: 1, col: 17, row: 0 },
    { sym: "Li", name: "Lithium", z: 3, mass: 6.941, cat: 0, en: 0.98, group: 1, period: 2, col: 0, row: 1 },
    { sym: "Be", name: "Beryllium", z: 4, mass: 9.012, cat: 1, en: 1.57, group: 2, period: 2, col: 1, row: 1 },
    { sym: "B", name: "Boron", z: 5, mass: 10.81, cat: 4, en: 2.04, group: 13, period: 2, col: 12, row: 1 },
    { sym: "C", name: "Carbon", z: 6, mass: 12.01, cat: 5, en: 2.55, group: 14, period: 2, col: 13, row: 1 },
    { sym: "N", name: "Nitrogen", z: 7, mass: 14.01, cat: 5, en: 3.04, group: 15, period: 2, col: 14, row: 1 },
    { sym: "O", name: "Oxygen", z: 8, mass: 16.0, cat: 5, en: 3.44, group: 16, period: 2, col: 15, row: 1 },
    { sym: "F", name: "Fluorine", z: 9, mass: 19.0, cat: 6, en: 3.98, group: 17, period: 2, col: 16, row: 1 },
    { sym: "Ne", name: "Neon", z: 10, mass: 20.18, cat: 7, en: 0, group: 18, period: 2, col: 17, row: 1 },
    { sym: "Na", name: "Sodium", z: 11, mass: 22.99, cat: 0, en: 0.93, group: 1, period: 3, col: 0, row: 2 },
    { sym: "Mg", name: "Magnesium", z: 12, mass: 24.31, cat: 1, en: 1.31, group: 2, period: 3, col: 1, row: 2 },
    { sym: "Al", name: "Aluminum", z: 13, mass: 26.98, cat: 3, en: 1.61, group: 13, period: 3, col: 12, row: 2 },
    { sym: "Si", name: "Silicon", z: 14, mass: 28.09, cat: 4, en: 1.9, group: 14, period: 3, col: 13, row: 2 },
    { sym: "P", name: "Phosphorus", z: 15, mass: 30.97, cat: 5, en: 2.19, group: 15, period: 3, col: 14, row: 2 },
    { sym: "S", name: "Sulfur", z: 16, mass: 32.07, cat: 5, en: 2.58, group: 16, period: 3, col: 15, row: 2 },
    { sym: "Cl", name: "Chlorine", z: 17, mass: 35.45, cat: 6, en: 3.16, group: 17, period: 3, col: 16, row: 2 },
    { sym: "Ar", name: "Argon", z: 18, mass: 39.95, cat: 7, en: 0, group: 18, period: 3, col: 17, row: 2 },
    { sym: "K", name: "Potassium", z: 19, mass: 39.1, cat: 0, en: 0.82, group: 1, period: 4, col: 0, row: 3 },
    { sym: "Ca", name: "Calcium", z: 20, mass: 40.08, cat: 1, en: 1.0, group: 2, period: 4, col: 1, row: 3 },
    { sym: "Sc", name: "Scandium", z: 21, mass: 44.96, cat: 2, en: 1.36, group: 3, period: 4, col: 2, row: 3 },
    { sym: "Ti", name: "Titanium", z: 22, mass: 47.87, cat: 2, en: 1.54, group: 4, period: 4, col: 3, row: 3 },
    { sym: "V", name: "Vanadium", z: 23, mass: 50.94, cat: 2, en: 1.63, group: 5, period: 4, col: 4, row: 3 },
    { sym: "Cr", name: "Chromium", z: 24, mass: 52.0, cat: 2, en: 1.66, group: 6, period: 4, col: 5, row: 3 },
    { sym: "Mn", name: "Manganese", z: 25, mass: 54.94, cat: 2, en: 1.55, group: 7, period: 4, col: 6, row: 3 },
    { sym: "Fe", name: "Iron", z: 26, mass: 55.85, cat: 2, en: 1.83, group: 8, period: 4, col: 7, row: 3 },
    { sym: "Co", name: "Cobalt", z: 27, mass: 58.93, cat: 2, en: 1.88, group: 9, period: 4, col: 8, row: 3 },
    { sym: "Ni", name: "Nickel", z: 28, mass: 58.69, cat: 2, en: 1.91, group: 10, period: 4, col: 9, row: 3 },
    { sym: "Cu", name: "Copper", z: 29, mass: 63.55, cat: 2, en: 1.9, group: 11, period: 4, col: 10, row: 3 },
    { sym: "Zn", name: "Zinc", z: 30, mass: 65.38, cat: 2, en: 1.65, group: 12, period: 4, col: 11, row: 3 },
    { sym: "Ga", name: "Gallium", z: 31, mass: 69.72, cat: 3, en: 1.81, group: 13, period: 4, col: 12, row: 3 },
    { sym: "Ge", name: "Germanium", z: 32, mass: 72.63, cat: 4, en: 2.01, group: 14, period: 4, col: 13, row: 3 },
    { sym: "As", name: "Arsenic", z: 33, mass: 74.92, cat: 4, en: 2.18, group: 15, period: 4, col: 14, row: 3 },
    { sym: "Se", name: "Selenium", z: 34, mass: 78.97, cat: 5, en: 2.55, group: 16, period: 4, col: 15, row: 3 },
    { sym: "Br", name: "Bromine", z: 35, mass: 79.9, cat: 6, en: 2.96, group: 17, period: 4, col: 16, row: 3 },
    { sym: "Kr", name: "Krypton", z: 36, mass: 83.8, cat: 7, en: 3.0, group: 18, period: 4, col: 17, row: 3 },
  ];

  function getColor(el: Element): string {
    if (colorMode === 0) {
      return CATEGORY_COLORS[el.cat];
    } else if (colorMode === 1) {
      // Electronegativity gradient
      if (el.en === 0) return "#334155";
      const t = el.en / 4.0;
      const r = Math.round(50 + 205 * t);
      const g = Math.round(200 - 150 * t);
      const b = Math.round(200 - 200 * t);
      return `rgb(${r},${g},${b})`;
    } else {
      // Atomic mass gradient
      const t = Math.min(el.mass / 200, 1);
      const r = Math.round(50 + 200 * t);
      const g = Math.round(180 - 100 * t);
      const b = Math.round(220 - 180 * t);
      return `rgb(${r},${g},${b})`;
    }
  }

  let mouseX = -1;
  let mouseY = -1;
  let cellW = 0;
  let cellH = 0;
  let tableX = 0;
  let tableY = 0;

  function handleMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (W / rect.width);
    mouseY = (e.clientY - rect.top) * (H / rect.height);

    // Find hovered element
    selectedElement = -1;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const ex = tableX + el.col * cellW;
      const ey = tableY + el.row * cellH;
      if (mouseX >= ex && mouseX <= ex + cellW && mouseY >= ey && mouseY <= ey + cellH) {
        selectedElement = i;
        break;
      }
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      canvas.addEventListener("mousemove", handleMouseMove);
    },

    update(_dt: number, params: Record<string, number>) {
      colorMode = Math.round(params.colorMode ?? 0);
      highlightGroup = Math.round(params.highlightGroup ?? 0);
      showLabels = params.showLabels ?? 1;
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Mendeleev's Periodic Table of Elements", W / 2, 24);

      // Table dimensions
      const margin = 16;
      const cols = 18;
      const rows = 4; // showing first 4 periods for clarity
      cellW = (W - margin * 2) / cols;
      cellH = Math.min((H - 140) / (rows + 2), 60);
      tableX = margin;
      tableY = 50;

      // Draw grid cells
      for (const el of elements) {
        const x = tableX + el.col * cellW;
        const y = tableY + el.row * cellH;

        const isHighlighted = highlightGroup > 0 && el.group === highlightGroup;
        const isSelected = elements.indexOf(el) === selectedElement;
        const color = getColor(el);

        // Cell background
        let alpha = 0.7;
        if (highlightGroup > 0 && !isHighlighted) alpha = 0.15;
        if (isSelected) alpha = 1;

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, cellW - 2, cellH - 2, 3);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (isSelected) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x + 1, y + 1, cellW - 2, cellH - 2, 3);
          ctx.stroke();
        }

        if (showLabels) {
          // Atomic number
          ctx.font = `${Math.max(8, cellW * 0.18)}px system-ui, sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.textAlign = "left";
          ctx.fillText(`${el.z}`, x + 3, y + Math.max(10, cellH * 0.25));

          // Symbol
          ctx.font = `bold ${Math.max(10, cellW * 0.35)}px system-ui, sans-serif`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.fillText(el.sym, x + cellW / 2, y + cellH * 0.6);

          // Mass
          if (cellW > 30) {
            ctx.font = `${Math.max(7, cellW * 0.15)}px system-ui, sans-serif`;
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillText(el.mass.toFixed(1), x + cellW / 2, y + cellH * 0.85);
          }
        }
      }

      // Period labels
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "right";
      for (let r = 0; r < rows; r++) {
        ctx.fillText(`${r + 1}`, tableX - 4, tableY + r * cellH + cellH * 0.6);
      }

      // Group labels
      ctx.textAlign = "center";
      for (let c = 0; c < cols; c++) {
        ctx.fillText(`${c + 1}`, tableX + c * cellW + cellW / 2, tableY - 6);
      }

      // Selected element info panel
      const panelY = tableY + (rows + 0.5) * cellH + 10;

      if (selectedElement >= 0) {
        const el = elements[selectedElement];
        ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
        ctx.beginPath();
        ctx.roundRect(margin, panelY, W - margin * 2, 80, 8);
        ctx.fill();
        ctx.strokeStyle = getColor(el);
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = getColor(el);
        ctx.textAlign = "left";
        ctx.fillText(`${el.z} ${el.sym} — ${el.name}`, margin + 12, panelY + 25);

        ctx.font = "13px system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`Atomic Mass: ${el.mass} u`, margin + 12, panelY + 45);
        ctx.fillText(`Category: ${CATEGORY_NAMES[el.cat]}`, margin + 12, panelY + 63);

        ctx.textAlign = "right";
        ctx.fillText(`Group: ${el.group}  |  Period: ${el.period}`, W - margin - 12, panelY + 45);
        ctx.fillText(`Electronegativity: ${el.en > 0 ? el.en.toFixed(2) : "N/A"}`, W - margin - 12, panelY + 63);
      } else {
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.fillText("Hover over an element to see details", W / 2, panelY + 15);
      }

      // Category legend
      const legendY = H - 45;
      const legendItemW = (W - margin * 2) / 5;
      ctx.font = "10px system-ui, sans-serif";
      for (let i = 0; i < 10; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const lx = margin + col * legendItemW;
        const ly = legendY + row * 16;

        ctx.fillStyle = CATEGORY_COLORS[i];
        ctx.fillRect(lx, ly - 7, 10, 10);
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "left";
        ctx.fillText(CATEGORY_NAMES[i], lx + 14, ly + 2);
      }

      // Color mode label
      const modeNames = ["Category", "Electronegativity", "Atomic Mass"];
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "right";
      ctx.fillText(`Color: ${modeNames[colorMode]}`, W - margin, 42);
    },

    reset() {
      selectedElement = -1;
    },

    destroy() {
      if (canvas) {
        canvas.removeEventListener("mousemove", handleMouseMove);
      }
    },

    getStateDescription(): string {
      const modeNames = ["category", "electronegativity", "atomic mass"];
      let desc = `Mendeleev's Periodic Table: Showing ${elements.length} elements colored by ${modeNames[colorMode]}.`;
      if (highlightGroup > 0) desc += ` Group ${highlightGroup} highlighted.`;
      if (selectedElement >= 0) {
        const el = elements[selectedElement];
        desc += ` Selected: ${el.name} (${el.sym}), Z=${el.z}, mass=${el.mass}u, ${CATEGORY_NAMES[el.cat]}, EN=${el.en}.`;
      }
      return desc;
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MendeleevFactory;
