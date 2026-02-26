import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TWO_PI = Math.PI * 2;

// ─── 3D vector helpers ──────────────────────────────────────────────
interface Vec3 { x: number; y: number; z: number }

function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function project(v: Vec3, cx: number, cy: number, scale: number, perspective: number): { x: number; y: number; depth: number } {
  const d = perspective / (perspective + v.z);
  return { x: cx + v.x * scale * d, y: cy + v.y * scale * d, depth: v.z };
}

// ─── Ice Ih crystal structure ───────────────────────────────────────
// Hexagonal ice: each oxygen atom is tetrahedrally coordinated
// with 4 neighbors via hydrogen bonds. The structure has hexagonal
// symmetry with layers of puckered hexagonal rings.

interface Atom {
  pos: Vec3;
  type: "O" | "H";
}

interface Bond {
  from: number;
  to: number;
  isHBond: boolean; // hydrogen bond (dashed) vs covalent
}

function buildIceLattice(): { atoms: Atom[]; bonds: Bond[] } {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];

  // Simplified hexagonal ice Ih unit cell
  // Oxygen positions in hexagonal arrangement
  const a = 1.0;   // lattice parameter (arbitrary units)
  const c = 1.63;  // c/a ratio for ice Ih ≈ 1.63
  const hOffset = 0.37; // hydrogen bond offset

  // Generate a 3x3x2 lattice for a nice hexagonal view
  const oxygenPositions: Vec3[] = [];

  for (let layer = -1; layer <= 1; layer++) {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        // Two oxygens per unit cell in the hex structure
        const x1 = i * a * 1.5 + j * a * 0.75;
        const z1 = j * a * Math.sqrt(3) / 2;
        const y1 = layer * c;

        oxygenPositions.push({ x: x1, y: y1, z: z1 });

        // Second oxygen in unit cell (shifted)
        const x2 = x1 + a * 0.5;
        const z2 = z1 + a * Math.sqrt(3) / 6;
        const y2 = y1 + c * 0.375;

        oxygenPositions.push({ x: x2, y: y2, z: z2 });
      }
    }
  }

  // Add oxygen atoms
  for (const pos of oxygenPositions) {
    atoms.push({ pos, type: "O" });
  }

  // Find nearest oxygen neighbors and add hydrogen bonds
  const oCount = atoms.length;
  const maxBondDist = a * 1.2;

  for (let i = 0; i < oCount; i++) {
    for (let j = i + 1; j < oCount; j++) {
      const dx = atoms[i].pos.x - atoms[j].pos.x;
      const dy = atoms[i].pos.y - atoms[j].pos.y;
      const dz = atoms[i].pos.z - atoms[j].pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < maxBondDist && dist > 0.1) {
        // Add hydrogen atoms along the bond
        const mx = (atoms[i].pos.x + atoms[j].pos.x) / 2;
        const my = (atoms[i].pos.y + atoms[j].pos.y) / 2;
        const mz = (atoms[i].pos.z + atoms[j].pos.z) / 2;

        // Two hydrogens: one closer to atom i, one closer to atom j
        const h1Idx = atoms.length;
        atoms.push({
          pos: {
            x: atoms[i].pos.x + (mx - atoms[i].pos.x) * hOffset,
            y: atoms[i].pos.y + (my - atoms[i].pos.y) * hOffset,
            z: atoms[i].pos.z + (mz - atoms[i].pos.z) * hOffset,
          },
          type: "H",
        });

        const h2Idx = atoms.length;
        atoms.push({
          pos: {
            x: atoms[j].pos.x + (mx - atoms[j].pos.x) * hOffset,
            y: atoms[j].pos.y + (my - atoms[j].pos.y) * hOffset,
            z: atoms[j].pos.z + (mz - atoms[j].pos.z) * hOffset,
          },
          type: "H",
        });

        // O-H covalent bonds
        bonds.push({ from: i, to: h1Idx, isHBond: false });
        bonds.push({ from: j, to: h2Idx, isHBond: false });

        // H-bond between the hydrogen and the opposite oxygen
        bonds.push({ from: h1Idx, to: h2Idx, isHBond: true });
      }
    }
  }

  return { atoms, bonds };
}

const StructureOfIce3dFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("structure-of-ice-3d") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let rotationSpeed = 0.5;
  let zoom = 1;
  let showBonds = 1;
  let showLabels = 1;

  let lattice: { atoms: Atom[]; bonds: Bond[] } = { atoms: [], bonds: [] };
  let rotAngleY = 0;
  const tiltAngle = -0.4; // slight downward tilt for 3D feel

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    rotAngleY = 0;
    lattice = buildIceLattice();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    rotationSpeed = params.rotationSpeed ?? rotationSpeed;
    zoom = params.zoom ?? zoom;
    showBonds = params.showBonds ?? showBonds;
    showLabels = params.showLabels ?? showLabels;

    time += step;
    rotAngleY += rotationSpeed * step;
  }

  function render(): void {
    if (!ctx) return;

    // Background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, "#0c1929");
    bgGrad.addColorStop(1, "#050d18");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Crystal Structure of Ice (Ih)", width / 2, 28);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillText("Hexagonal ice with hydrogen bonding network", width / 2, 48);

    const cx = width * 0.48;
    const cy = height * 0.48;
    const scale = Math.min(width, height) * 0.15 * zoom;
    const perspective = 8;

    // Transform all atoms
    const projected: { x: number; y: number; depth: number; type: "O" | "H"; idx: number }[] = [];
    for (let i = 0; i < lattice.atoms.length; i++) {
      const atom = lattice.atoms[i];
      let p = atom.pos;
      p = rotateY(p, rotAngleY);
      p = rotateX(p, tiltAngle);
      const proj = project(p, cx, cy, scale, perspective);
      projected.push({ ...proj, type: atom.type, idx: i });
    }

    // Sort by depth (back to front)
    const sortedAtoms = [...projected].sort((a, b) => b.depth - a.depth);

    // Draw bonds first (behind atoms)
    if (showBonds >= 0.5) {
      for (const bond of lattice.bonds) {
        const a = projected[bond.from];
        const b = projected[bond.to];
        if (!a || !b) continue;

        const avgDepth = (a.depth + b.depth) / 2;
        const depthAlpha = Math.max(0.1, Math.min(0.8, 0.5 - avgDepth * 0.08));

        if (bond.isHBond) {
          // Hydrogen bond - dashed line
          ctx.strokeStyle = `rgba(100, 180, 255, ${depthAlpha * 0.6})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
        } else {
          // Covalent bond - solid line
          ctx.strokeStyle = `rgba(180, 200, 230, ${depthAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Draw atoms (sorted by depth)
    for (const atom of sortedAtoms) {
      const depthFactor = Math.max(0.3, Math.min(1, 0.7 - atom.depth * 0.05));
      const sizeFactor = Math.max(0.5, 1 - atom.depth * 0.02);

      if (atom.type === "O") {
        // Oxygen atom - red sphere
        const r = 8 * sizeFactor * zoom;
        const oGrad = ctx.createRadialGradient(atom.x - r * 0.3, atom.y - r * 0.3, 0, atom.x, atom.y, r);
        oGrad.addColorStop(0, `rgba(255, 120, 120, ${depthFactor})`);
        oGrad.addColorStop(0.7, `rgba(220, 50, 50, ${depthFactor})`);
        oGrad.addColorStop(1, `rgba(150, 30, 30, ${depthFactor * 0.8})`);
        ctx.fillStyle = oGrad;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, r, 0, TWO_PI);
        ctx.fill();

        // Specular highlight
        ctx.fillStyle = `rgba(255, 200, 200, ${depthFactor * 0.4})`;
        ctx.beginPath();
        ctx.arc(atom.x - r * 0.25, atom.y - r * 0.25, r * 0.3, 0, TWO_PI);
        ctx.fill();
      } else {
        // Hydrogen atom - white/light gray sphere (smaller)
        const r = 5 * sizeFactor * zoom;
        const hGrad = ctx.createRadialGradient(atom.x - r * 0.3, atom.y - r * 0.3, 0, atom.x, atom.y, r);
        hGrad.addColorStop(0, `rgba(240, 240, 255, ${depthFactor})`);
        hGrad.addColorStop(0.7, `rgba(200, 200, 220, ${depthFactor})`);
        hGrad.addColorStop(1, `rgba(150, 150, 170, ${depthFactor * 0.8})`);
        ctx.fillStyle = hGrad;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, r, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Info panel
    if (showLabels >= 0.5) {
      const panelX = 14;
      let panelY = height * 0.68;

      ctx.fillStyle = "rgba(10, 20, 40, 0.7)";
      ctx.fillRect(panelX - 4, panelY - 14, 230, 140);
      ctx.strokeStyle = "rgba(80, 140, 220, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX - 4, panelY - 14, 230, 140);

      ctx.textAlign = "left";
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillText("Hexagonal Ice (Ice Ih)", panelX, panelY);

      panelY += 18;
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Crystal system: Hexagonal", panelX, panelY);
      panelY += 16;
      ctx.fillText("Space group: P6\u2083/mmc", panelX, panelY);
      panelY += 16;
      ctx.fillText("O\u2013H bond: 0.96 \u00C5 (covalent)", panelX, panelY);
      panelY += 16;
      ctx.fillText("O\u00B7\u00B7\u00B7H bond: 1.74 \u00C5 (hydrogen)", panelX, panelY);
      panelY += 16;
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("Tetrahedral coordination (sp\u00B3)", panelX, panelY);
      panelY += 16;
      ctx.fillStyle = "#34d399";
      ctx.fillText("Density: 0.917 g/cm\u00B3 (< liquid water)", panelX, panelY);

      // Legend
      const legX = width - 110;
      const legY = height * 0.74;

      ctx.fillStyle = "#dd4444";
      ctx.beginPath();
      ctx.arc(legX, legY, 6, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Oxygen", legX + 12, legY + 4);

      ctx.fillStyle = "#ccccee";
      ctx.beginPath();
      ctx.arc(legX, legY + 22, 4, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Hydrogen", legX + 12, legY + 26);

      if (showBonds >= 0.5) {
        ctx.strokeStyle = "rgba(180, 200, 230, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(legX - 8, legY + 44);
        ctx.lineTo(legX + 8, legY + 44);
        ctx.stroke();
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText("Covalent", legX + 12, legY + 48);

        ctx.strokeStyle = "rgba(100, 180, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(legX - 8, legY + 66);
        ctx.lineTo(legX + 8, legY + 66);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText("H-bond", legX + 12, legY + 70);
      }
    }

    // Key insight text
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Open hexagonal structure explains why ice floats on water", width / 2, height - 30);

    // Time
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    rotAngleY = 0;
  }

  function destroy(): void {
    lattice = { atoms: [], bonds: [] };
  }

  function getStateDescription(): string {
    return (
      `Ice Crystal Structure (Ih): Hexagonal ice shown in pseudo-3D. ` +
      `${lattice.atoms.filter(a => a.type === "O").length} oxygen atoms and ` +
      `${lattice.atoms.filter(a => a.type === "H").length} hydrogen atoms. ` +
      `Ice Ih has hexagonal symmetry with each oxygen tetrahedrally coordinated ` +
      `to 4 neighbors via hydrogen bonds. The open hexagonal structure creates ` +
      `empty space, making ice (0.917 g/cm\u00B3) less dense than liquid water (1.0 g/cm\u00B3). ` +
      `Rotation speed: ${rotationSpeed.toFixed(1)}, Zoom: ${zoom.toFixed(1)}. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StructureOfIce3dFactory;
