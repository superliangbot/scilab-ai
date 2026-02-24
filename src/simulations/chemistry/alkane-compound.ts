import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Chemistry data ─────────────────────────────────────────────────
const ALKANE_NAMES = [
  "Methane",
  "Ethane",
  "Propane",
  "Butane",
  "Pentane",
  "Hexane",
  "Heptane",
  "Octane",
  "Nonane",
  "Decane",
];

const BOILING_POINTS = [-161, -89, -42, -1, 36, 69, 98, 126, 151, 174]; // °C

const BOND_ANGLE_DEG = 109.5; // sp³ tetrahedral angle
const BOND_ANGLE_RAD = (BOND_ANGLE_DEG * Math.PI) / 180;

// Atomic masses
const C_MASS = 12.011;
const H_MASS = 1.008;

interface Atom {
  x: number;
  y: number;
  element: "C" | "H";
  label: string;
}

interface Bond {
  from: number;
  to: number;
}

function molecularFormula(n: number): string {
  const hCount = 2 * n + 2;
  const cSub = n > 1 ? subscript(n) : "";
  const hSub = subscript(hCount);
  return `C${cSub}H${hSub}`;
}

function subscript(num: number): string {
  const subDigits = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
  return num
    .toString()
    .split("")
    .map((d) => subDigits[parseInt(d)])
    .join("");
}

function molecularWeight(n: number): number {
  return C_MASS * n + H_MASS * (2 * n + 2);
}

function stateAtRoomTemp(n: number): string {
  const bp = BOILING_POINTS[n - 1];
  if (bp < 25) return "Gas";
  return "Liquid";
}

// ─── Build molecule geometry ────────────────────────────────────────
function buildAlkane(
  carbonCount: number,
  bondLengthPx: number
): { atoms: Atom[]; bonds: Bond[] } {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];

  // Carbon backbone: zig-zag pattern
  // Project tetrahedral angle into 2D as alternating up/down zig-zag
  const zigAngle = (Math.PI - BOND_ANGLE_RAD) / 2; // half the supplement
  const dx = bondLengthPx * Math.cos(zigAngle);
  const dy = bondLengthPx * Math.sin(zigAngle);

  // Place carbons
  const carbonIndices: number[] = [];
  for (let i = 0; i < carbonCount; i++) {
    const x = i * dx;
    const y = i % 2 === 0 ? 0 : dy;
    atoms.push({ x, y, element: "C", label: "C" });
    carbonIndices.push(atoms.length - 1);
  }

  // C-C bonds
  for (let i = 0; i < carbonCount - 1; i++) {
    bonds.push({ from: carbonIndices[i], to: carbonIndices[i + 1] });
  }

  // Hydrogen bond length (slightly shorter than C-C)
  const hBondLen = bondLengthPx * 0.7;

  // Add hydrogens for each carbon
  for (let i = 0; i < carbonCount; i++) {
    const ci = carbonIndices[i];
    const cx = atoms[ci].x;
    const cy = atoms[ci].y;

    // Determine how many H atoms: terminal carbons get 3, internal get 2
    // Special case: methane (1 carbon) gets 4 H
    let hCount: number;
    if (carbonCount === 1) {
      hCount = 4;
    } else if (i === 0 || i === carbonCount - 1) {
      hCount = 3;
    } else {
      hCount = 2;
    }

    // Determine the "occupied" directions (toward neighboring carbons)
    const occupiedAngles: number[] = [];
    if (i > 0) {
      const prev = atoms[carbonIndices[i - 1]];
      occupiedAngles.push(Math.atan2(prev.y - cy, prev.x - cx));
    }
    if (i < carbonCount - 1) {
      const next = atoms[carbonIndices[i + 1]];
      occupiedAngles.push(Math.atan2(next.y - cy, next.x - cx));
    }

    // Place hydrogens in available directions, evenly distributed
    // avoiding the occupied angles
    const hAngles = computeHydrogenAngles(occupiedAngles, hCount);

    for (const angle of hAngles) {
      const hx = cx + hBondLen * Math.cos(angle);
      const hy = cy + hBondLen * Math.sin(angle);
      atoms.push({ x: hx, y: hy, element: "H", label: "H" });
      bonds.push({ from: ci, to: atoms.length - 1 });
    }
  }

  // Center the molecule at origin
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const a of atoms) {
    if (a.x < minX) minX = a.x;
    if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.y > maxY) maxY = a.y;
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  for (const a of atoms) {
    a.x -= centerX;
    a.y -= centerY;
  }

  return { atoms, bonds };
}

function computeHydrogenAngles(
  occupiedAngles: number[],
  hCount: number
): number[] {
  if (occupiedAngles.length === 0) {
    // Methane: tetrahedral projected to 2D, place 4 H evenly
    const angles: number[] = [];
    for (let i = 0; i < hCount; i++) {
      angles.push((i * 2 * Math.PI) / hCount - Math.PI / 2);
    }
    return angles;
  }

  if (occupiedAngles.length === 1) {
    // Terminal carbon: 3 H atoms, fan out opposite to the bond direction
    const bondAngle = occupiedAngles[0];
    const oppositeAngle = bondAngle + Math.PI;
    const angles: number[] = [];
    // Spread 3 H atoms in a fan centered on the opposite direction
    const spreadAngle = (BOND_ANGLE_RAD * 0.55);
    if (hCount === 3) {
      angles.push(oppositeAngle);
      angles.push(oppositeAngle - spreadAngle);
      angles.push(oppositeAngle + spreadAngle);
    } else {
      // Fallback for any other count
      for (let i = 0; i < hCount; i++) {
        angles.push(
          oppositeAngle + (i - (hCount - 1) / 2) * spreadAngle
        );
      }
    }
    return angles;
  }

  if (occupiedAngles.length === 2) {
    // Internal carbon: 2 H atoms, placed perpendicular to the C-C-C plane
    const avgAngle =
      Math.atan2(
        Math.sin(occupiedAngles[0]) + Math.sin(occupiedAngles[1]),
        Math.cos(occupiedAngles[0]) + Math.cos(occupiedAngles[1])
      ) + Math.PI;

    // Place 2 H atoms roughly perpendicular to the backbone
    const perpSpread = BOND_ANGLE_RAD * 0.5;
    return [avgAngle - perpSpread, avgAngle + perpSpread];
  }

  return [];
}

// ─── Rendering helpers ──────────────────────────────────────────────
function drawAtom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  element: "C" | "H",
  showLabel: boolean
): void {
  if (element === "C") {
    // Carbon: dark gray with subtle gradient
    const grad = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius
    );
    grad.addColorStop(0, "#6b7280");
    grad.addColorStop(0.6, "#374151");
    grad.addColorStop(1, "#1f2937");
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (showLabel) {
      ctx.fillStyle = "#f9fafb";
      ctx.font = `bold ${Math.round(radius * 0.9)}px 'Inter', system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("C", x, y + 1);
    }
  } else {
    // Hydrogen: white/light with subtle gradient
    const grad = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.3,
      0,
      x,
      y,
      radius
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, "#e5e7eb");
    grad.addColorStop(1, "#d1d5db");
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (showLabel) {
      ctx.fillStyle = "#374151";
      ctx.font = `bold ${Math.round(radius * 0.85)}px 'Inter', system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("H", x, y + 1);
    }
  }
}

function drawBond(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number
): void {
  // Draw bond line between atoms, starting from the edge of each atom
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;

  const nx = dx / dist;
  const ny = dy / dist;

  const sx = x1 + nx * r1;
  const sy = y1 + ny * r1;
  const ex = x2 - nx * r2;
  const ey = y2 - ny * r2;

  // Bond line with gradient
  const grad = ctx.createLinearGradient(sx, sy, ex, ey);
  grad.addColorStop(0, "#9ca3af");
  grad.addColorStop(0.5, "#d1d5db");
  grad.addColorStop(1, "#9ca3af");

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Subtle highlight stroke
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─── Factory ────────────────────────────────────────────────────────
const AlkaneCompoundFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("alkane-compound") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached state
  let carbonCount = 3;
  let showLabels = 1;
  let bondLengthScale = 1;
  let autoRotate = 1;
  let cachedMolecule: { atoms: Atom[]; bonds: Bond[] } | null = null;
  let lastCarbonCount = -1;
  let lastBondScale = -1;

  // Base bond length in pixels (will be scaled)
  const BASE_BOND_LENGTH = 60;
  // Atom radii
  const C_RADIUS = 18;
  const H_RADIUS = 12;

  function getMolecule(): { atoms: Atom[]; bonds: Bond[] } {
    if (
      cachedMolecule &&
      lastCarbonCount === carbonCount &&
      lastBondScale === bondLengthScale
    ) {
      return cachedMolecule;
    }
    const bondLen = BASE_BOND_LENGTH * bondLengthScale;
    cachedMolecule = buildAlkane(carbonCount, bondLen);
    lastCarbonCount = carbonCount;
    lastBondScale = bondLengthScale;
    return cachedMolecule;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    carbonCount = Math.round(params.carbonCount ?? 3);
    showLabels = Math.round(params.showLabels ?? 1);
    bondLengthScale = params.bondLength ?? 1;
    autoRotate = Math.round(params.rotation ?? 1);
    time += dt;
  }

  function render(): void {
    if (!ctx) return;

    // ── Dark background ─────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const n = carbonCount;
    const name = ALKANE_NAMES[n - 1];
    const formula = molecularFormula(n);
    const mw = molecularWeight(n);
    const bp = BOILING_POINTS[n - 1];
    const state = stateAtRoomTemp(n);

    // ── Title ───────────────────────────────────────
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Alkane Compounds \u2014 C\u2099H\u2082\u2099\u208A\u2082", width / 2, 28);

    // Subtitle
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      "Saturated hydrocarbons \u2014 single bonds only \u2014 sp\u00B3 hybridized",
      width / 2,
      46
    );

    // ── Build / retrieve molecule ───────────────────
    const molecule = getMolecule();

    // ── Oscillation / rotation ──────────────────────
    const oscillation = autoRotate ? Math.sin(time * 0.8) * 0.06 : 0;
    const bobY = autoRotate ? Math.sin(time * 1.2) * 3 : 0;

    // Calculate scale factor to fit molecule on screen
    let molMinX = Infinity,
      molMaxX = -Infinity,
      molMinY = Infinity,
      molMaxY = -Infinity;
    for (const a of molecule.atoms) {
      const r = a.element === "C" ? C_RADIUS : H_RADIUS;
      if (a.x - r < molMinX) molMinX = a.x - r;
      if (a.x + r > molMaxX) molMaxX = a.x + r;
      if (a.y - r < molMinY) molMinY = a.y - r;
      if (a.y + r > molMaxY) molMaxY = a.y + r;
    }
    const molW = molMaxX - molMinX;
    const molH = molMaxY - molMinY;

    // Available drawing area
    const drawAreaTop = 60;
    const drawAreaBottom = height - 120;
    const drawAreaLeft = 30;
    const drawAreaRight = width - 30;
    const availW = drawAreaRight - drawAreaLeft;
    const availH = drawAreaBottom - drawAreaTop;

    const scaleFactor =
      molW > 0 && molH > 0
        ? Math.min(availW / (molW + 40), availH / (molH + 40), 1.8)
        : 1;

    const centerX = (drawAreaLeft + drawAreaRight) / 2;
    const centerY = (drawAreaTop + drawAreaBottom) / 2 + bobY;

    // Transform function: molecule coords -> screen coords with oscillation
    function toScreen(ax: number, ay: number): { sx: number; sy: number } {
      // Apply rotation
      const cos = Math.cos(oscillation);
      const sin = Math.sin(oscillation);
      const rx = ax * cos - ay * sin;
      const ry = ax * sin + ay * cos;
      return {
        sx: centerX + rx * scaleFactor,
        sy: centerY + ry * scaleFactor,
      };
    }

    // ── Draw bonds first (behind atoms) ─────────────
    for (const bond of molecule.bonds) {
      const a1 = molecule.atoms[bond.from];
      const a2 = molecule.atoms[bond.to];
      const p1 = toScreen(a1.x, a1.y);
      const p2 = toScreen(a2.x, a2.y);
      const r1 = (a1.element === "C" ? C_RADIUS : H_RADIUS) * scaleFactor;
      const r2 = (a2.element === "C" ? C_RADIUS : H_RADIUS) * scaleFactor;
      drawBond(ctx, p1.sx, p1.sy, p2.sx, p2.sy, r1, r2);
    }

    // ── Draw atoms ──────────────────────────────────
    // Draw H atoms first, then C atoms on top for better layering
    const hAtoms: number[] = [];
    const cAtoms: number[] = [];
    for (let i = 0; i < molecule.atoms.length; i++) {
      if (molecule.atoms[i].element === "H") hAtoms.push(i);
      else cAtoms.push(i);
    }

    for (const idx of hAtoms) {
      const atom = molecule.atoms[idx];
      const p = toScreen(atom.x, atom.y);
      const r = H_RADIUS * scaleFactor;
      drawAtom(ctx, p.sx, p.sy, r, "H", showLabels === 1);
    }

    for (const idx of cAtoms) {
      const atom = molecule.atoms[idx];
      const p = toScreen(atom.x, atom.y);
      const r = C_RADIUS * scaleFactor;
      drawAtom(ctx, p.sx, p.sy, r, "C", showLabels === 1);
    }

    // ── Molecule name and formula ───────────────────
    const nameY = drawAreaBottom + 20;
    ctx.font = "bold 20px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "center";
    ctx.fillText(name, width / 2, nameY);

    ctx.font = "16px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(formula, width / 2, nameY + 22);

    // ── Data panel ──────────────────────────────────
    const panelY = nameY + 44;
    const panelItems = [
      { label: "MW", value: `${mw.toFixed(2)} g/mol`, color: "#34d399" },
      { label: "BP", value: `${bp}\u00B0C`, color: "#fbbf24" },
      { label: "State (25\u00B0C)", value: state, color: "#f472b6" },
      {
        label: "Bond Angle",
        value: `${BOND_ANGLE_DEG}\u00B0 (sp\u00B3)`,
        color: "#c084fc",
      },
    ];

    const totalPanelW = Math.min(width - 40, 600);
    const itemW = totalPanelW / panelItems.length;
    const panelStartX = (width - totalPanelW) / 2;

    // Panel background
    ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
    ctx.beginPath();
    ctx.roundRect(panelStartX - 10, panelY - 14, totalPanelW + 20, 38, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    for (let i = 0; i < panelItems.length; i++) {
      const item = panelItems[i];
      const ix = panelStartX + i * itemW + itemW / 2;

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(item.label, ix, panelY - 1);

      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = item.color;
      ctx.fillText(item.value, ix, panelY + 16);
    }

    // ── Carbon count indicator ──────────────────────
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText(
      `C atoms: ${n}  |  H atoms: ${2 * n + 2}  |  Total bonds: ${3 * n + 1}`,
      14,
      height - 10
    );
  }

  function reset(): void {
    time = 0;
    cachedMolecule = null;
    lastCarbonCount = -1;
    lastBondScale = -1;
  }

  function destroy(): void {
    cachedMolecule = null;
  }

  function getStateDescription(): string {
    const n = carbonCount;
    const name = ALKANE_NAMES[n - 1];
    const formula = molecularFormula(n);
    const mw = molecularWeight(n);
    const bp = BOILING_POINTS[n - 1];
    const state = stateAtRoomTemp(n);
    return (
      `Alkane Compound simulation: Displaying ${name} (${formula}). ` +
      `Molecular weight: ${mw.toFixed(2)} g/mol. ` +
      `Boiling point: ${bp}\u00B0C. State at room temperature: ${state}. ` +
      `Carbon count: ${n}, Hydrogen count: ${2 * n + 2}. ` +
      `All C-C bonds are single bonds with tetrahedral (109.5\u00B0) bond angles (sp\u00B3 hybridization). ` +
      `General formula: C\u2099H\u2082\u2099\u208A\u2082.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default AlkaneCompoundFactory;
