import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Atom colors (ball-and-stick model) ─────────────────────────────
const ATOM_COLORS: Record<string, string> = {
  C: "#4a4a4a",   // dark gray
  H: "#ffffff",   // white
  Cl: "#22c55e",  // green
  N: "#3b82f6",   // blue
  O: "#ef4444",   // red
};

const ATOM_RADII: Record<string, number> = {
  C: 12,
  H: 7,
  Cl: 14,
  N: 11,
  O: 10,
};

const BOND_COLOR = "#94a3b8";
const DOUBLE_BOND_GAP = 4;

// ─── Atom / Bond structures ─────────────────────────────────────────
interface Atom {
  element: string;
  x: number;
  y: number;
  label?: string;
}

interface Bond {
  from: number;
  to: number;
  order: 1 | 2; // single or double
}

// ─── Polymer type definitions ───────────────────────────────────────
interface PolymerDef {
  name: string;
  abbreviation: string;
  monomerFormula: string;
  polymerFormula: string;
  /** Build one monomer unit with atoms positioned relative to (cx, cy) */
  buildMonomer: (cx: number, cy: number, scale: number) => { atoms: Atom[]; bonds: Bond[] };
  /** Build one repeating unit in the polymer chain at position (cx, cy) */
  buildRepeatUnit: (cx: number, cy: number, scale: number, unitIndex: number, totalUnits: number) => { atoms: Atom[]; bonds: Bond[] };
  /** Substituent description for state text */
  substituent: string;
}

// ─── Helper: build monomer atoms ────────────────────────────────────
// Standard vinyl monomer: CH₂=CHX
// Left carbon: C with 2 H's, Right carbon: C with H + substituent X
// Double bond between the two carbons

function buildVinylMonomer(
  cx: number,
  cy: number,
  scale: number,
  substituent: { element: string; offsets: { dx: number; dy: number; element: string }[] }
): { atoms: Atom[]; bonds: Bond[] } {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const s = scale;

  // C1 (left carbon) at cx - 30*s, cy
  const c1x = cx - 30 * s;
  const c1y = cy;
  atoms.push({ element: "C", x: c1x, y: c1y }); // 0

  // C2 (right carbon) at cx + 30*s, cy
  const c2x = cx + 30 * s;
  const c2y = cy;
  atoms.push({ element: "C", x: c2x, y: c2y }); // 1

  // Double bond between C1 and C2
  bonds.push({ from: 0, to: 1, order: 2 });

  // H atoms on C1 (two H's: top-left and bottom-left)
  atoms.push({ element: "H", x: c1x - 25 * s, y: c1y - 22 * s }); // 2
  bonds.push({ from: 0, to: 2, order: 1 });
  atoms.push({ element: "H", x: c1x - 25 * s, y: c1y + 22 * s }); // 3
  bonds.push({ from: 0, to: 3, order: 1 });

  // H atom on C2 (top-right)
  atoms.push({ element: "H", x: c2x + 25 * s, y: c2y - 22 * s }); // 4
  bonds.push({ from: 1, to: 4, order: 1 });

  // Substituent on C2 (bottom-right)
  const subBaseIdx = atoms.length;
  atoms.push({ element: substituent.element, x: c2x + 25 * s, y: c2y + 22 * s }); // subBaseIdx
  bonds.push({ from: 1, to: subBaseIdx, order: 1 });

  // Extra atoms in substituent group
  for (const off of substituent.offsets) {
    const idx = atoms.length;
    atoms.push({ element: off.element, x: c2x + 25 * s + off.dx * s, y: c2y + 22 * s + off.dy * s });
    bonds.push({ from: subBaseIdx, to: idx, order: 1 });
  }

  return { atoms, bonds };
}

// Build a repeat unit for the polymer backbone: -CH₂-CHX-
function buildVinylRepeatUnit(
  cx: number,
  cy: number,
  scale: number,
  unitIndex: number,
  totalUnits: number,
  substituent: { element: string; offsets: { dx: number; dy: number; element: string }[] }
): { atoms: Atom[]; bonds: Bond[] } {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const s = scale;

  // C1 (CH₂ carbon) at cx - 25*s, cy
  const c1x = cx - 25 * s;
  const c1y = cy;
  atoms.push({ element: "C", x: c1x, y: c1y }); // 0

  // C2 (CHX carbon) at cx + 25*s, cy
  const c2x = cx + 25 * s;
  const c2y = cy;
  atoms.push({ element: "C", x: c2x, y: c2y }); // 1

  // Single bond between C1 and C2 (was double, now opened)
  bonds.push({ from: 0, to: 1, order: 1 });

  // H atoms on C1 (above and below backbone)
  atoms.push({ element: "H", x: c1x, y: c1y - 28 * s }); // 2
  bonds.push({ from: 0, to: 2, order: 1 });
  atoms.push({ element: "H", x: c1x, y: c1y + 28 * s }); // 3
  bonds.push({ from: 0, to: 3, order: 1 });

  // H atom on C2 (above backbone)
  atoms.push({ element: "H", x: c2x, y: c2y - 28 * s }); // 4
  bonds.push({ from: 1, to: 4, order: 1 });

  // Substituent on C2 (below backbone)
  const subBaseIdx = atoms.length;
  atoms.push({ element: substituent.element, x: c2x, y: c2y + 28 * s }); // subBaseIdx
  bonds.push({ from: 1, to: subBaseIdx, order: 1 });

  // Extra atoms in substituent group (hanging below)
  for (const off of substituent.offsets) {
    const idx = atoms.length;
    atoms.push({ element: off.element, x: c2x + off.dx * s, y: c2y + 28 * s + off.dy * s });
    bonds.push({ from: subBaseIdx, to: idx, order: 1 });
  }

  return { atoms, bonds };
}

// ─── Define the 6 polymer types ─────────────────────────────────────
const POLYMERS: PolymerDef[] = [
  // 0: Polyethylene (PE): CH₂=CH₂ → (-CH₂-CH₂-)ₙ
  {
    name: "Polyethylene",
    abbreviation: "PE",
    monomerFormula: "CH\u2082=CH\u2082",
    polymerFormula: "(-CH\u2082-CH\u2082-)\u2099",
    substituent: "H",
    buildMonomer(cx, cy, s) {
      // Ethylene: CH₂=CH₂  (both carbons have 2 H each)
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 30 * s;
      const c2x = cx + 30 * s;
      atoms.push({ element: "C", x: c1x, y: cy }); // 0
      atoms.push({ element: "C", x: c2x, y: cy }); // 1
      bonds.push({ from: 0, to: 1, order: 2 });

      // H's on C1
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy - 22 * s });
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy + 22 * s });
      bonds.push({ from: 0, to: 3, order: 1 });

      // H's on C2
      atoms.push({ element: "H", x: c2x + 25 * s, y: cy - 22 * s });
      bonds.push({ from: 1, to: 4, order: 1 });
      atoms.push({ element: "H", x: c2x + 25 * s, y: cy + 22 * s });
      bonds.push({ from: 1, to: 5, order: 1 });

      return { atoms, bonds };
    },
    buildRepeatUnit(cx, cy, s, _ui, _tu) {
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 25 * s;
      const c2x = cx + 25 * s;
      atoms.push({ element: "C", x: c1x, y: cy });
      atoms.push({ element: "C", x: c2x, y: cy });
      bonds.push({ from: 0, to: 1, order: 1 });

      // H's on C1
      atoms.push({ element: "H", x: c1x, y: cy - 28 * s });
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x, y: cy + 28 * s });
      bonds.push({ from: 0, to: 3, order: 1 });

      // H's on C2
      atoms.push({ element: "H", x: c2x, y: cy - 28 * s });
      bonds.push({ from: 1, to: 4, order: 1 });
      atoms.push({ element: "H", x: c2x, y: cy + 28 * s });
      bonds.push({ from: 1, to: 5, order: 1 });

      return { atoms, bonds };
    },
  },

  // 1: PVC: CH₂=CHCl → (-CH₂-CHCl-)ₙ
  {
    name: "Polyvinyl Chloride",
    abbreviation: "PVC",
    monomerFormula: "CH\u2082=CHCl",
    polymerFormula: "(-CH\u2082-CHCl-)\u2099",
    substituent: "Cl",
    buildMonomer(cx, cy, s) {
      return buildVinylMonomer(cx, cy, s, { element: "Cl", offsets: [] });
    },
    buildRepeatUnit(cx, cy, s, ui, tu) {
      return buildVinylRepeatUnit(cx, cy, s, ui, tu, { element: "Cl", offsets: [] });
    },
  },

  // 2: Polypropylene (PP): CH₂=CHCH₃ → (-CH₂-CHCH₃-)ₙ
  {
    name: "Polypropylene",
    abbreviation: "PP",
    monomerFormula: "CH\u2082=CHCH\u2083",
    polymerFormula: "(-CH\u2082-CHCH\u2083-)\u2099",
    substituent: "CH\u2083",
    buildMonomer(cx, cy, s) {
      return buildVinylMonomer(cx, cy, s, {
        element: "C",
        offsets: [
          { dx: -14, dy: 20, element: "H" },
          { dx: 0, dy: 28, element: "H" },
          { dx: 14, dy: 20, element: "H" },
        ],
      });
    },
    buildRepeatUnit(cx, cy, s, ui, tu) {
      return buildVinylRepeatUnit(cx, cy, s, ui, tu, {
        element: "C",
        offsets: [
          { dx: -16, dy: 20, element: "H" },
          { dx: 0, dy: 28, element: "H" },
          { dx: 16, dy: 20, element: "H" },
        ],
      });
    },
  },

  // 3: Polystyrene (PS): CH₂=CHC₆H₅ → (-CH₂-CHC₆H₅-)ₙ
  {
    name: "Polystyrene",
    abbreviation: "PS",
    monomerFormula: "CH\u2082=CHC\u2086H\u2085",
    polymerFormula: "(-CH\u2082-CHC\u2086H\u2085-)\u2099",
    substituent: "C\u2086H\u2085",
    buildMonomer(cx, cy, s) {
      // Phenyl ring represented as a hexagon of C atoms
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 30 * s;
      const c2x = cx + 30 * s;
      atoms.push({ element: "C", x: c1x, y: cy }); // 0
      atoms.push({ element: "C", x: c2x, y: cy }); // 1
      bonds.push({ from: 0, to: 1, order: 2 });

      // H's on C1
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy - 22 * s }); // 2
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy + 22 * s }); // 3
      bonds.push({ from: 0, to: 3, order: 1 });

      // H on C2
      atoms.push({ element: "H", x: c2x + 25 * s, y: cy - 22 * s }); // 4
      bonds.push({ from: 1, to: 4, order: 1 });

      // Phenyl ring below C2
      const ringCx = c2x + 25 * s;
      const ringCy = cy + 40 * s;
      const ringR = 18 * s;
      const ringStart = 5; // index of first ring atom
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        atoms.push({
          element: "C",
          x: ringCx + ringR * Math.cos(angle),
          y: ringCy + ringR * Math.sin(angle),
        });
      }
      // Bond C2 to top ring carbon
      bonds.push({ from: 1, to: ringStart, order: 1 });
      // Ring bonds (alternating single/double)
      for (let i = 0; i < 6; i++) {
        bonds.push({
          from: ringStart + i,
          to: ringStart + ((i + 1) % 6),
          order: (i % 2 === 0 ? 2 : 1) as 1 | 2,
        });
      }
      // H's on ring carbons (except the one bonded to C2 backbone)
      for (let i = 1; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        const hIdx = atoms.length;
        atoms.push({
          element: "H",
          x: ringCx + (ringR + 16 * s) * Math.cos(angle),
          y: ringCy + (ringR + 16 * s) * Math.sin(angle),
        });
        bonds.push({ from: ringStart + i, to: hIdx, order: 1 });
      }

      return { atoms, bonds };
    },
    buildRepeatUnit(cx, cy, s, _ui, _tu) {
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 25 * s;
      const c2x = cx + 25 * s;
      atoms.push({ element: "C", x: c1x, y: cy }); // 0
      atoms.push({ element: "C", x: c2x, y: cy }); // 1
      bonds.push({ from: 0, to: 1, order: 1 });

      // H's on C1
      atoms.push({ element: "H", x: c1x, y: cy - 28 * s }); // 2
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x, y: cy + 28 * s }); // 3
      bonds.push({ from: 0, to: 3, order: 1 });

      // H on C2
      atoms.push({ element: "H", x: c2x, y: cy - 28 * s }); // 4
      bonds.push({ from: 1, to: 4, order: 1 });

      // Phenyl ring below C2
      const ringCx = c2x;
      const ringCy = cy + 48 * s;
      const ringR = 16 * s;
      const ringStart = atoms.length;
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        atoms.push({
          element: "C",
          x: ringCx + ringR * Math.cos(angle),
          y: ringCy + ringR * Math.sin(angle),
        });
      }
      bonds.push({ from: 1, to: ringStart, order: 1 });
      for (let i = 0; i < 6; i++) {
        bonds.push({
          from: ringStart + i,
          to: ringStart + ((i + 1) % 6),
          order: (i % 2 === 0 ? 2 : 1) as 1 | 2,
        });
      }
      // H's on ring carbons (skip top one bonded to backbone)
      for (let i = 1; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        const hIdx = atoms.length;
        atoms.push({
          element: "H",
          x: ringCx + (ringR + 14 * s) * Math.cos(angle),
          y: ringCy + (ringR + 14 * s) * Math.sin(angle),
        });
        bonds.push({ from: ringStart + i, to: hIdx, order: 1 });
      }

      return { atoms, bonds };
    },
  },

  // 4: Polyacrylonitrile (PAN): CH₂=CHCN → (-CH₂-CHCN-)ₙ
  {
    name: "Polyacrylonitrile",
    abbreviation: "PAN",
    monomerFormula: "CH\u2082=CHCN",
    polymerFormula: "(-CH\u2082-CHCN-)\u2099",
    substituent: "CN",
    buildMonomer(cx, cy, s) {
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 30 * s;
      const c2x = cx + 30 * s;
      atoms.push({ element: "C", x: c1x, y: cy }); // 0
      atoms.push({ element: "C", x: c2x, y: cy }); // 1
      bonds.push({ from: 0, to: 1, order: 2 });

      // H's on C1
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy - 22 * s });
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy + 22 * s });
      bonds.push({ from: 0, to: 3, order: 1 });

      // H on C2
      atoms.push({ element: "H", x: c2x + 25 * s, y: cy - 22 * s });
      bonds.push({ from: 1, to: 4, order: 1 });

      // C of CN group
      atoms.push({ element: "C", x: c2x + 25 * s, y: cy + 22 * s }); // 5
      bonds.push({ from: 1, to: 5, order: 1 });

      // N of CN group (triple bond shown as double for visibility)
      atoms.push({ element: "N", x: c2x + 25 * s, y: cy + 50 * s }); // 6
      bonds.push({ from: 5, to: 6, order: 2 }); // triple shown as double

      return { atoms, bonds };
    },
    buildRepeatUnit(cx, cy, s, _ui, _tu) {
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 25 * s;
      const c2x = cx + 25 * s;
      atoms.push({ element: "C", x: c1x, y: cy });
      atoms.push({ element: "C", x: c2x, y: cy });
      bonds.push({ from: 0, to: 1, order: 1 });

      // H's on C1
      atoms.push({ element: "H", x: c1x, y: cy - 28 * s });
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x, y: cy + 28 * s });
      bonds.push({ from: 0, to: 3, order: 1 });

      // H on C2
      atoms.push({ element: "H", x: c2x, y: cy - 28 * s });
      bonds.push({ from: 1, to: 4, order: 1 });

      // C of CN group
      atoms.push({ element: "C", x: c2x, y: cy + 28 * s }); // 5
      bonds.push({ from: 1, to: 5, order: 1 });

      // N of CN group
      atoms.push({ element: "N", x: c2x, y: cy + 52 * s }); // 6
      bonds.push({ from: 5, to: 6, order: 2 });

      return { atoms, bonds };
    },
  },

  // 5: PVA (Polyvinyl Acetate): CH₂=CHOOCCH₃ → (-CH₂-CHOOCCH₃-)ₙ
  {
    name: "Polyvinyl Acetate",
    abbreviation: "PVA",
    monomerFormula: "CH\u2082=CHOOCCH\u2083",
    polymerFormula: "(-CH\u2082-CHOOCCH\u2083-)\u2099",
    substituent: "OOCCH\u2083",
    buildMonomer(cx, cy, s) {
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 30 * s;
      const c2x = cx + 30 * s;
      atoms.push({ element: "C", x: c1x, y: cy }); // 0
      atoms.push({ element: "C", x: c2x, y: cy }); // 1
      bonds.push({ from: 0, to: 1, order: 2 });

      // H's on C1
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy - 22 * s }); // 2
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x - 25 * s, y: cy + 22 * s }); // 3
      bonds.push({ from: 0, to: 3, order: 1 });

      // H on C2
      atoms.push({ element: "H", x: c2x + 25 * s, y: cy - 22 * s }); // 4
      bonds.push({ from: 1, to: 4, order: 1 });

      // O (ester oxygen) bonded to C2
      const o1x = c2x + 25 * s;
      const o1y = cy + 25 * s;
      atoms.push({ element: "O", x: o1x, y: o1y }); // 5
      bonds.push({ from: 1, to: 5, order: 1 });

      // C (carbonyl carbon)
      const ccx = o1x + 22 * s;
      const ccy = o1y + 18 * s;
      atoms.push({ element: "C", x: ccx, y: ccy }); // 6
      bonds.push({ from: 5, to: 6, order: 1 });

      // =O (carbonyl oxygen)
      atoms.push({ element: "O", x: ccx + 22 * s, y: ccy - 12 * s }); // 7
      bonds.push({ from: 6, to: 7, order: 2 });

      // CH₃ (methyl group)
      atoms.push({ element: "C", x: ccx + 4 * s, y: ccy + 24 * s }); // 8
      bonds.push({ from: 6, to: 8, order: 1 });

      // H's on methyl
      atoms.push({ element: "H", x: ccx + 4 * s - 16 * s, y: ccy + 24 * s + 14 * s }); // 9
      bonds.push({ from: 8, to: 9, order: 1 });
      atoms.push({ element: "H", x: ccx + 4 * s, y: ccy + 24 * s + 20 * s }); // 10
      bonds.push({ from: 8, to: 10, order: 1 });
      atoms.push({ element: "H", x: ccx + 4 * s + 16 * s, y: ccy + 24 * s + 14 * s }); // 11
      bonds.push({ from: 8, to: 11, order: 1 });

      return { atoms, bonds };
    },
    buildRepeatUnit(cx, cy, s, _ui, _tu) {
      const atoms: Atom[] = [];
      const bonds: Bond[] = [];

      const c1x = cx - 25 * s;
      const c2x = cx + 25 * s;
      atoms.push({ element: "C", x: c1x, y: cy }); // 0
      atoms.push({ element: "C", x: c2x, y: cy }); // 1
      bonds.push({ from: 0, to: 1, order: 1 });

      // H's on C1
      atoms.push({ element: "H", x: c1x, y: cy - 28 * s }); // 2
      bonds.push({ from: 0, to: 2, order: 1 });
      atoms.push({ element: "H", x: c1x, y: cy + 28 * s }); // 3
      bonds.push({ from: 0, to: 3, order: 1 });

      // H on C2
      atoms.push({ element: "H", x: c2x, y: cy - 28 * s }); // 4
      bonds.push({ from: 1, to: 4, order: 1 });

      // O (ester oxygen)
      const o1x = c2x;
      const o1y = cy + 28 * s;
      atoms.push({ element: "O", x: o1x, y: o1y }); // 5
      bonds.push({ from: 1, to: 5, order: 1 });

      // C (carbonyl carbon)
      const ccx = o1x + 20 * s;
      const ccy = o1y + 16 * s;
      atoms.push({ element: "C", x: ccx, y: ccy }); // 6
      bonds.push({ from: 5, to: 6, order: 1 });

      // =O (carbonyl oxygen)
      atoms.push({ element: "O", x: ccx + 20 * s, y: ccy - 10 * s }); // 7
      bonds.push({ from: 6, to: 7, order: 2 });

      // CH₃ (methyl group)
      atoms.push({ element: "C", x: ccx + 4 * s, y: ccy + 22 * s }); // 8
      bonds.push({ from: 6, to: 8, order: 1 });

      // H's on methyl
      atoms.push({ element: "H", x: ccx + 4 * s - 14 * s, y: ccy + 22 * s + 12 * s }); // 9
      bonds.push({ from: 8, to: 9, order: 1 });
      atoms.push({ element: "H", x: ccx + 4 * s, y: ccy + 22 * s + 18 * s }); // 10
      bonds.push({ from: 8, to: 10, order: 1 });
      atoms.push({ element: "H", x: ccx + 4 * s + 14 * s, y: ccy + 22 * s + 12 * s }); // 11
      bonds.push({ from: 8, to: 11, order: 1 });

      return { atoms, bonds };
    },
  },
];

// ─── Factory ────────────────────────────────────────────────────────
const AdditionPolymerizationFactory: SimulationFactory = () => {
  const config = getSimConfig("addition-polymerization") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Current parameters
  let polymerType = 0;
  let chainLength = 3;
  let showLabels = 1;

  // Animation state
  let animProgress = 0; // 0..1 per monomer unit joining
  let animatedUnits = 0; // how many units have fully joined

  // ── Drawing helpers ─────────────────────────────────────────────
  function drawBond(a1: Atom, a2: Atom, order: 1 | 2, alpha: number = 1): void {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = BOND_COLOR;
    ctx.lineWidth = 2.5;

    if (order === 1) {
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
    } else {
      // Double bond: two parallel lines
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      const nx = -dy / len * DOUBLE_BOND_GAP;
      const ny = dx / len * DOUBLE_BOND_GAP;

      ctx.beginPath();
      ctx.moveTo(a1.x + nx, a1.y + ny);
      ctx.lineTo(a2.x + nx, a2.y + ny);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(a1.x - nx, a1.y - ny);
      ctx.lineTo(a2.x - nx, a2.y - ny);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawAtom(atom: Atom, alpha: number = 1): void {
    const r = ATOM_RADII[atom.element] || 10;
    const color = ATOM_COLORS[atom.element] || "#888";

    ctx.globalAlpha = alpha;

    // Glow effect
    const grad = ctx.createRadialGradient(
      atom.x - r * 0.25, atom.y - r * 0.25, r * 0.1,
      atom.x, atom.y, r
    );

    // Brighter center for 3D-like ball appearance
    if (atom.element === "C") {
      grad.addColorStop(0, "#7a7a7a");
      grad.addColorStop(1, "#3a3a3a");
    } else if (atom.element === "H") {
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#c0c0c0");
    } else if (atom.element === "Cl") {
      grad.addColorStop(0, "#4ade80");
      grad.addColorStop(1, "#16a34a");
    } else if (atom.element === "N") {
      grad.addColorStop(0, "#60a5fa");
      grad.addColorStop(1, "#2563eb");
    } else if (atom.element === "O") {
      grad.addColorStop(0, "#f87171");
      grad.addColorStop(1, "#dc2626");
    } else {
      grad.addColorStop(0, color);
      grad.addColorStop(1, color);
    }

    ctx.beginPath();
    ctx.arc(atom.x, atom.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Outline
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  function drawAtomLabel(atom: Atom, alpha: number = 1): void {
    if (!showLabels) return;
    const r = ATOM_RADII[atom.element] || 10;
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.max(9, r - 1)}px 'Inter', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Use contrasting text color
    ctx.fillStyle = atom.element === "H" || atom.element === "Cl" ? "#000" : "#fff";
    ctx.fillText(atom.element, atom.x, atom.y + 0.5);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;
  }

  function drawMolecule(atoms: Atom[], bonds: Bond[], alpha: number = 1): void {
    // Draw bonds first (behind atoms)
    for (const bond of bonds) {
      drawBond(atoms[bond.from], atoms[bond.to], bond.order, alpha);
    }
    // Draw atoms on top
    for (const atom of atoms) {
      drawAtom(atom, alpha);
    }
    // Draw labels on top of everything
    for (const atom of atoms) {
      drawAtomLabel(atom, alpha);
    }
  }

  // ── Build the connecting bonds between repeat units ─────────────
  function drawInterUnitBond(
    x1: number, y1: number,
    x2: number, y2: number,
    alpha: number = 1
  ): void {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#f59e0b"; // highlight inter-unit bonds in amber
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Bracket drawing for repeat unit notation ────────────────────
  function drawBracket(x: number, yTop: number, yBottom: number, side: "left" | "right"): void {
    const bracketW = 8;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (side === "left") {
      ctx.moveTo(x + bracketW, yTop);
      ctx.lineTo(x, yTop);
      ctx.lineTo(x, yBottom);
      ctx.lineTo(x + bracketW, yBottom);
    } else {
      ctx.moveTo(x - bracketW, yTop);
      ctx.lineTo(x, yTop);
      ctx.lineTo(x, yBottom);
      ctx.lineTo(x - bracketW, yBottom);
    }
    ctx.stroke();
  }

  // ── Engine ─────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      animProgress = 0;
      animatedUnits = 0;
    },

    update(dt: number, params: Record<string, number>) {
      time += dt;

      const newType = Math.round(Math.min(5, Math.max(0, params.polymerType ?? polymerType)));
      const newLength = Math.round(Math.min(8, Math.max(1, params.chainLength ?? chainLength)));
      const newLabels = Math.round(params.showLabels ?? showLabels);

      // Reset animation if polymer type changed
      if (newType !== polymerType) {
        polymerType = newType;
        animatedUnits = 0;
        animProgress = 0;
      }

      // Handle chain length change
      if (newLength !== chainLength) {
        if (newLength < chainLength) {
          animatedUnits = Math.min(animatedUnits, newLength);
          animProgress = 0;
        }
        chainLength = newLength;
      }

      showLabels = newLabels;

      // Advance polymerization animation
      // Each unit takes ~1.5 seconds to join
      const joinSpeed = 0.7; // units per second
      if (animatedUnits < chainLength) {
        animProgress += dt * joinSpeed;
        if (animProgress >= 1) {
          animProgress = 0;
          animatedUnits++;
        }
      }
    },

    render() {
      if (!ctx) return;

      const polymer = POLYMERS[polymerType];

      // ── Background ──────────────────────────────
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Addition Polymerization", W / 2, 28);

      // Polymer name + formula
      ctx.font = "14px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        `${polymer.name} (${polymer.abbreviation})`,
        W / 2,
        48
      );

      // ── Section 1: Monomer structure (top area) ─
      const monomerSectionY = 60;
      const monomerCenterY = monomerSectionY + 75;

      // Section label
      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "left";
      ctx.fillText("Monomer:", 20, monomerSectionY + 14);

      // Formula
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(polymer.monomerFormula, 100, monomerSectionY + 14);

      // Separator line
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(20, monomerSectionY + 135);
      ctx.lineTo(W - 20, monomerSectionY + 135);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw monomer
      const monomerScale = Math.min(1.0, W / 700);
      const monomerData = polymer.buildMonomer(W / 2, monomerCenterY, monomerScale);
      drawMolecule(monomerData.atoms, monomerData.bonds);

      // ── Section 2: Polymer chain (bottom area) ──
      const polymerSectionY = monomerSectionY + 145;
      const polymerCenterY = polymerSectionY + Math.min(130, (H - polymerSectionY - 80) / 2 + 20);

      // Section label
      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "left";
      ctx.fillText("Polymer Chain:", 20, polymerSectionY + 14);

      // Formula
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(polymer.polymerFormula, 140, polymerSectionY + 14);

      // Calculate layout for repeat units
      // Determine scale based on chain length and available width
      const availWidth = W - 80; // margin on each side
      const unitSpacing = Math.min(110, availWidth / chainLength);
      const polymerScale = Math.min(0.85, unitSpacing / 130);
      const totalChainWidth = unitSpacing * chainLength;
      const chainStartX = (W - totalChainWidth) / 2 + unitSpacing / 2;

      // Draw completed units
      const completedUnits = Math.min(animatedUnits, chainLength);
      const currentAnimUnit = animatedUnits < chainLength ? animatedUnits : -1;

      for (let i = 0; i < chainLength; i++) {
        const ucx = chainStartX + i * unitSpacing;
        const ucy = polymerCenterY;
        const isCompleted = i < completedUnits;
        const isAnimating = i === currentAnimUnit;
        let alpha = 1;

        if (isAnimating) {
          alpha = 0.3 + 0.7 * animProgress;
        } else if (!isCompleted) {
          alpha = 0.12; // ghost preview
        }

        const unitData = polymer.buildRepeatUnit(ucx, ucy, polymerScale, i, chainLength);
        drawMolecule(unitData.atoms, unitData.bonds, alpha);

        // Draw inter-unit backbone bonds (between adjacent repeat units)
        if (i > 0 && (isCompleted || isAnimating)) {
          const prevUcx = chainStartX + (i - 1) * unitSpacing;
          const prevC2x = prevUcx + 25 * polymerScale;
          const currC1x = ucx - 25 * polymerScale;

          const bondAlpha = isAnimating ? animProgress : 1;

          // Animate the bond "forming": draw it growing from the previous unit
          if (isAnimating) {
            const bx1 = prevC2x;
            const bx2 = bx1 + (currC1x - bx1) * animProgress;
            drawInterUnitBond(bx1, ucy, bx2, ucy, bondAlpha);
          } else {
            drawInterUnitBond(prevC2x, ucy, currC1x, ucy, bondAlpha);
          }
        }
      }

      // Draw repeat unit brackets around the first completed unit if we have at least one
      if (completedUnits >= 1) {
        const bracketUnit = 0;
        const bx = chainStartX + bracketUnit * unitSpacing;

        // Determine vertical extent of the unit
        const sampleUnit = polymer.buildRepeatUnit(bx, polymerCenterY, polymerScale, 0, chainLength);
        let minY = Infinity;
        let maxY = -Infinity;
        for (const a of sampleUnit.atoms) {
          const r = ATOM_RADII[a.element] || 10;
          minY = Math.min(minY, a.y - r - 6);
          maxY = Math.max(maxY, a.y + r + 6);
        }

        const leftBx = bx - 25 * polymerScale - 18;
        const rightBx = bx + 25 * polymerScale + 18;
        drawBracket(leftBx, minY, maxY, "left");
        drawBracket(rightBx, minY, maxY, "right");

        // Subscript 'n'
        ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "left";
        ctx.fillText("n", rightBx + 4, maxY + 4);
      }

      // ── Continuation dashes at chain ends ───────
      if (completedUnits >= 1) {
        const firstUcx = chainStartX;
        const lastUcx = chainStartX + (Math.min(completedUnits, chainLength) - 1) * unitSpacing;
        const endC2x = lastUcx + 25 * polymerScale;
        const startC1x = firstUcx - 25 * polymerScale;

        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);

        // Left continuation
        ctx.beginPath();
        ctx.moveTo(startC1x, polymerCenterY);
        ctx.lineTo(startC1x - 25, polymerCenterY);
        ctx.stroke();

        // Right continuation (only if chain is fully built)
        if (completedUnits >= chainLength) {
          ctx.beginPath();
          ctx.moveTo(endC2x, polymerCenterY);
          ctx.lineTo(endC2x + 25, polymerCenterY);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }

      // ── Animation indicator: arrow showing reaction ──
      if (currentAnimUnit >= 0) {
        const arrowX = W / 2;
        const arrowY = monomerSectionY + 130;

        // Pulsing arrow
        const pulse = 0.6 + 0.4 * Math.sin(time * 4);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 20px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("\u2193", arrowX, arrowY);

        ctx.font = "11px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#f59e0b";
        ctx.fillText("polymerizing...", arrowX, arrowY + 14);
        ctx.globalAlpha = 1;
      }

      // ── Atom color legend ───────────────────────
      const legendY = H - 44;
      const legendElements = ["C", "H", "Cl", "N", "O"];
      const legendNames = ["Carbon", "Hydrogen", "Chlorine", "Nitrogen", "Oxygen"];
      const legendSpacing = Math.min(100, (W - 40) / legendElements.length);
      const legendStartX = (W - legendSpacing * legendElements.length) / 2 + legendSpacing / 2;

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      for (let i = 0; i < legendElements.length; i++) {
        const lx = legendStartX + i * legendSpacing;
        const elem = legendElements[i];
        const r = 6;

        // Draw small circle
        const color = ATOM_COLORS[elem];
        ctx.beginPath();
        ctx.arc(lx - 24, legendY, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "left";
        ctx.fillText(legendNames[i], lx - 16, legendY + 4);
      }

      // ── Info text ───────────────────────────────
      const infoY = H - 16;
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.fillText(
        "Addition polymerization: double bond opens to form single bonds with adjacent monomers. No byproducts.",
        W / 2,
        infoY
      );

      // ── Progress indicator ──────────────────────
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "right";
      ctx.fillText(
        `Units joined: ${Math.min(completedUnits, chainLength)} / ${chainLength}`,
        W - 20,
        polymerSectionY + 14
      );
    },

    reset() {
      time = 0;
      animProgress = 0;
      animatedUnits = 0;
      polymerType = config.parameters.find((p) => p.key === "polymerType")!.defaultValue;
      chainLength = config.parameters.find((p) => p.key === "chainLength")!.defaultValue;
      showLabels = config.parameters.find((p) => p.key === "showLabels")!.defaultValue;
    },

    destroy() {
      // No resources to clean up
    },

    getStateDescription(): string {
      const polymer = POLYMERS[polymerType];
      const completed = Math.min(animatedUnits, chainLength);
      return (
        `Addition Polymerization simulation: showing ${polymer.name} (${polymer.abbreviation}). ` +
        `Monomer: ${polymer.monomerFormula}. ` +
        `Polymer repeat unit: ${polymer.polymerFormula}. ` +
        `Chain length: ${chainLength} units, ${completed} joined so far. ` +
        `Substituent: ${polymer.substituent}. ` +
        `Addition polymerization works by opening the C=C double bond in each monomer ` +
        `to form single bonds with adjacent monomers, creating a long polymer chain ` +
        `with no byproducts (unlike condensation polymerization).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default AdditionPolymerizationFactory;
