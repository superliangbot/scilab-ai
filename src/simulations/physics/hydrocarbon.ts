import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HydrocarbonFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("hydrocarbon") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let carbonCount = 3; // number of carbon atoms in chain
  let showElectrons = 1;
  let bondType = 0; // 0 = single, 1 = double, 2 = triple (for first C-C bond)

  interface Atom {
    x: number;
    y: number;
    element: "C" | "H";
    radius: number;
    color: string;
    bonds: number; // max bonds
    usedBonds: number;
  }

  let atoms: Atom[] = [];
  let bonds: { a: number; b: number; order: number }[] = [];

  function buildMolecule() {
    atoms = [];
    bonds = [];

    const chainY = height / 2;
    const spacing = Math.min(80, (width - 120) / (carbonCount + 1));
    const startX = width / 2 - ((carbonCount - 1) * spacing) / 2;

    // Create carbon chain
    for (let i = 0; i < carbonCount; i++) {
      // Zigzag pattern
      const yOffset = i % 2 === 0 ? 0 : -25;
      atoms.push({
        x: startX + i * spacing,
        y: chainY + yOffset,
        element: "C",
        radius: 20,
        color: "#555555",
        bonds: 4,
        usedBonds: 0,
      });
    }

    // C-C bonds
    for (let i = 0; i < carbonCount - 1; i++) {
      const order = i === 0 ? Math.min(bondType + 1, 3) : 1;
      bonds.push({ a: i, b: i + 1, order });
      atoms[i].usedBonds += order;
      atoms[i + 1].usedBonds += order;
    }

    // Add hydrogen atoms to satisfy valence
    for (let i = 0; i < carbonCount; i++) {
      const c = atoms[i];
      const hNeeded = c.bonds - c.usedBonds;

      for (let h = 0; h < hNeeded; h++) {
        const angle = ((h - (hNeeded - 1) / 2) * 0.8) + (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
        const adjustedAngle = angle + (h % 2 === 0 ? 0.3 : -0.3);

        // Avoid placing H where other carbons are
        let hAngle = adjustedAngle;
        if (i === 0 && carbonCount > 1) {
          // First carbon - hydrogens go left and up/down
          hAngle = Math.PI + (h - (hNeeded - 1) / 2) * 0.7;
        } else if (i === carbonCount - 1 && carbonCount > 1) {
          // Last carbon - hydrogens go right and up/down
          hAngle = (h - (hNeeded - 1) / 2) * 0.7;
        } else {
          // Middle carbons - hydrogens go up and down
          hAngle = (h === 0 ? -Math.PI / 2 : Math.PI / 2) + (i % 2 === 0 ? 0 : Math.PI);
        }

        const hx = c.x + Math.cos(hAngle) * 45;
        const hy = c.y + Math.sin(hAngle) * 45;

        const hIdx = atoms.length;
        atoms.push({
          x: hx,
          y: hy,
          element: "H",
          radius: 14,
          color: "#4488cc",
          bonds: 1,
          usedBonds: 1,
        });
        bonds.push({ a: i, b: hIdx, order: 1 });
      }
    }
  }

  function drawBond(ax: number, ay: number, bx: number, by: number, order: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;

    ctx.lineWidth = 3;

    if (order === 1) {
      ctx.strokeStyle = "#888";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    } else if (order === 2) {
      const offset = 4;
      ctx.strokeStyle = "#888";
      ctx.beginPath();
      ctx.moveTo(ax + nx * offset, ay + ny * offset);
      ctx.lineTo(bx + nx * offset, by + ny * offset);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax - nx * offset, ay - ny * offset);
      ctx.lineTo(bx - nx * offset, by - ny * offset);
      ctx.stroke();
    } else if (order === 3) {
      ctx.strokeStyle = "#888";
      const offset = 5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax + nx * offset, ay + ny * offset);
      ctx.lineTo(bx + nx * offset, by + ny * offset);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax - nx * offset, ay - ny * offset);
      ctx.lineTo(bx - nx * offset, by - ny * offset);
      ctx.stroke();
    }

    // Electron dots on bond
    if (showElectrons >= 1) {
      const midX = (ax + bx) / 2;
      const midY = (ay + by) / 2;
      for (let o = 0; o < order; o++) {
        const offX = nx * (o - (order - 1) / 2) * 6;
        const offY = ny * (o - (order - 1) / 2) * 6;
        // Two electrons per bond
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(midX + offX - dx * 0.06, midY + offY - dy * 0.06, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(midX + offX + dx * 0.06, midY + offY + dy * 0.06, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawAtom(atom: Atom) {
    // Atom sphere
    const grad = ctx.createRadialGradient(
      atom.x - atom.radius * 0.3,
      atom.y - atom.radius * 0.3,
      atom.radius * 0.1,
      atom.x,
      atom.y,
      atom.radius
    );
    grad.addColorStop(0, lighten(atom.color, 60));
    grad.addColorStop(0.7, atom.color);
    grad.addColorStop(1, darken(atom.color, 40));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, atom.radius, 0, Math.PI * 2);
    ctx.fill();

    // Element label
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${atom.radius * 0.9}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(atom.element, atom.x, atom.y);
  }

  function lighten(hex: string, amt: number): string {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
    return `rgb(${r},${g},${b})`;
  }

  function darken(hex: string, amt: number): string {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
    return `rgb(${r},${g},${b})`;
  }

  function getMoleculeName(): string {
    const names: Record<number, string[]> = {
      1: ["Methane", "CH₄"],
      2: ["Ethane", "C₂H₆"],
      3: ["Propane", "C₃H₈"],
      4: ["Butane", "C₄H₁₀"],
      5: ["Pentane", "C₅H₁₂"],
      6: ["Hexane", "C₆H₁₄"],
      7: ["Heptane", "C₇H₁₆"],
      8: ["Octane", "C₈H₁₈"],
    };

    if (bondType === 0 && names[carbonCount]) {
      return `${names[carbonCount][0]} (${names[carbonCount][1]})`;
    }

    const hCount = atoms.filter((a) => a.element === "H").length;
    const bondName = bondType === 1 ? "ene" : bondType === 2 ? "yne" : "ane";
    return `C${carbonCount}H${hCount} (alk${bondName})`;
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      buildMolecule();
    },

    update(dt: number, params: Record<string, number>) {
      const newCarbon = Math.round(params.carbonCount ?? 3);
      const newElectrons = params.showElectrons ?? 1;
      const newBondType = Math.round(params.bondType ?? 0);

      if (newCarbon !== carbonCount || newBondType !== bondType) {
        carbonCount = Math.max(1, Math.min(8, newCarbon));
        bondType = newBondType;
        buildMolecule();
      }
      showElectrons = newElectrons;

      // Subtle breathing animation
      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Hydrocarbon Molecules", width / 2, 28);

      // Molecule name
      const name = getMoleculeName();
      ctx.fillStyle = "#88ccff";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(name, width / 2, 50);

      // Draw bonds first (behind atoms)
      for (const bond of bonds) {
        const a = atoms[bond.a];
        const b = atoms[bond.b];
        drawBond(a.x, a.y, b.x, b.y, bond.order);
      }

      // Draw atoms
      for (const atom of atoms) {
        // Subtle pulse
        const origR = atom.radius;
        atom.radius = origR + Math.sin(time * 2) * 0.5;
        drawAtom(atom);
        atom.radius = origR;
      }

      // Legend
      const legendY = height - 90;
      ctx.fillStyle = "rgba(10,15,30,0.85)";
      ctx.strokeStyle = "rgba(100,150,200,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(15, legendY, 200, 75, 8);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.font = "11px sans-serif";

      // Carbon legend
      ctx.fillStyle = "#777";
      ctx.beginPath();
      ctx.arc(35, legendY + 18, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ccc";
      ctx.fillText("Carbon (4 bonds)", 50, legendY + 22);

      // Hydrogen legend
      ctx.fillStyle = "#4488cc";
      ctx.beginPath();
      ctx.arc(35, legendY + 40, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ccc";
      ctx.fillText("Hydrogen (1 bond)", 50, legendY + 44);

      // Electron legend
      if (showElectrons >= 1) {
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(35, legendY + 60, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ccc";
        ctx.fillText("Bonding electrons", 50, legendY + 64);
      }

      // Info panel
      const cCount = atoms.filter((a) => a.element === "C").length;
      const hCount = atoms.filter((a) => a.element === "H").length;
      const bondTypeLabel = bondType === 0 ? "Single" : bondType === 1 ? "Double" : "Triple";

      ctx.fillStyle = "rgba(10,15,30,0.85)";
      ctx.strokeStyle = "rgba(100,150,200,0.3)";
      ctx.beginPath();
      ctx.roundRect(width - 190, legendY, 175, 75, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#aabbcc";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Carbons: ${cCount}`, width - 175, legendY + 20);
      ctx.fillText(`Hydrogens: ${hCount}`, width - 175, legendY + 38);
      ctx.fillText(`C-C Bond: ${bondTypeLabel}`, width - 175, legendY + 56);

      // Valence info
      ctx.fillStyle = "#556";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("C: 4 valence electrons (4 bonds) | H: 1 valence electron (1 bond)", width / 2, height - 10);
    },

    reset() {
      time = 0;
      buildMolecule();
    },

    destroy() {
      atoms = [];
      bonds = [];
    },

    getStateDescription() {
      const cCount = atoms.filter((a) => a.element === "C").length;
      const hCount = atoms.filter((a) => a.element === "H").length;
      const name = getMoleculeName();
      return `Hydrocarbon molecule: ${name}. ${cCount} carbon atoms, ${hCount} hydrogen atoms. Bond type: ${bondType === 0 ? "single (alkane)" : bondType === 1 ? "double (alkene)" : "triple (alkyne)"}. Carbon forms 4 covalent bonds, hydrogen forms 1.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      buildMolecule();
    },
  };

  return engine;
};

export default HydrocarbonFactory;
