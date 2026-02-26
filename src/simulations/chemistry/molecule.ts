import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

/**
 * Molecule Viewer: 3D-style ball-and-stick models of common molecules.
 * Shows molecular geometry, bond angles, and atomic composition.
 * Rotates automatically, click to switch molecules.
 */
const MoleculeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("molecule") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let moleculeIndex = 0;
  let rotationSpeed = 1;
  let showLabels = 1;
  let showBondAngles = 0;

  interface Atom {
    element: string;
    x: number;
    y: number;
    z: number;
    color: string;
    radius: number;
  }

  interface Bond {
    from: number;
    to: number;
    order: number; // 1=single, 2=double, 3=triple
  }

  interface Molecule {
    name: string;
    formula: string;
    geometry: string;
    atoms: Atom[];
    bonds: Bond[];
    description: string;
  }

  const MOLECULES: Molecule[] = [
    {
      name: "Water",
      formula: "H₂O",
      geometry: "Bent (104.5°)",
      atoms: [
        { element: "O", x: 0, y: 0, z: 0, color: "#ef4444", radius: 18 },
        { element: "H", x: -0.8, y: 0.6, z: 0, color: "#e2e8f0", radius: 12 },
        { element: "H", x: 0.8, y: 0.6, z: 0, color: "#e2e8f0", radius: 12 },
      ],
      bonds: [{ from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 }],
      description: "Polar molecule, bent shape due to 2 lone pairs on oxygen",
    },
    {
      name: "Carbon Dioxide",
      formula: "CO₂",
      geometry: "Linear (180°)",
      atoms: [
        { element: "C", x: 0, y: 0, z: 0, color: "#64748b", radius: 16 },
        { element: "O", x: -1.2, y: 0, z: 0, color: "#ef4444", radius: 18 },
        { element: "O", x: 1.2, y: 0, z: 0, color: "#ef4444", radius: 18 },
      ],
      bonds: [{ from: 0, to: 1, order: 2 }, { from: 0, to: 2, order: 2 }],
      description: "Linear nonpolar molecule with double bonds",
    },
    {
      name: "Methane",
      formula: "CH₄",
      geometry: "Tetrahedral (109.5°)",
      atoms: [
        { element: "C", x: 0, y: 0, z: 0, color: "#64748b", radius: 16 },
        { element: "H", x: 0.9, y: 0.9, z: 0.9, color: "#e2e8f0", radius: 12 },
        { element: "H", x: -0.9, y: -0.9, z: 0.9, color: "#e2e8f0", radius: 12 },
        { element: "H", x: -0.9, y: 0.9, z: -0.9, color: "#e2e8f0", radius: 12 },
        { element: "H", x: 0.9, y: -0.9, z: -0.9, color: "#e2e8f0", radius: 12 },
      ],
      bonds: [
        { from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 },
        { from: 0, to: 3, order: 1 }, { from: 0, to: 4, order: 1 },
      ],
      description: "Simplest alkane, perfect tetrahedral geometry",
    },
    {
      name: "Ammonia",
      formula: "NH₃",
      geometry: "Trigonal Pyramidal (107°)",
      atoms: [
        { element: "N", x: 0, y: -0.2, z: 0, color: "#3b82f6", radius: 17 },
        { element: "H", x: 0.9, y: 0.5, z: 0, color: "#e2e8f0", radius: 12 },
        { element: "H", x: -0.45, y: 0.5, z: 0.78, color: "#e2e8f0", radius: 12 },
        { element: "H", x: -0.45, y: 0.5, z: -0.78, color: "#e2e8f0", radius: 12 },
      ],
      bonds: [
        { from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 }, { from: 0, to: 3, order: 1 },
      ],
      description: "Trigonal pyramidal due to one lone pair on nitrogen",
    },
    {
      name: "Ethanol",
      formula: "C₂H₅OH",
      geometry: "Tetrahedral carbons",
      atoms: [
        { element: "C", x: -0.6, y: 0, z: 0, color: "#64748b", radius: 16 },
        { element: "C", x: 0.6, y: 0, z: 0, color: "#64748b", radius: 16 },
        { element: "O", x: 1.4, y: 0.8, z: 0, color: "#ef4444", radius: 18 },
        { element: "H", x: 2.1, y: 0.5, z: 0, color: "#e2e8f0", radius: 12 },
        { element: "H", x: -1.2, y: -0.7, z: 0.5, color: "#e2e8f0", radius: 12 },
        { element: "H", x: -1.2, y: -0.7, z: -0.5, color: "#e2e8f0", radius: 12 },
        { element: "H", x: -1.2, y: 0.8, z: 0, color: "#e2e8f0", radius: 12 },
        { element: "H", x: 0.6, y: -0.7, z: 0.5, color: "#e2e8f0", radius: 12 },
        { element: "H", x: 0.6, y: -0.7, z: -0.5, color: "#e2e8f0", radius: 12 },
      ],
      bonds: [
        { from: 0, to: 1, order: 1 }, { from: 1, to: 2, order: 1 }, { from: 2, to: 3, order: 1 },
        { from: 0, to: 4, order: 1 }, { from: 0, to: 5, order: 1 }, { from: 0, to: 6, order: 1 },
        { from: 1, to: 7, order: 1 }, { from: 1, to: 8, order: 1 },
      ],
      description: "Common alcohol with hydroxyl group (-OH)",
    },
    {
      name: "Benzene",
      formula: "C₆H₆",
      geometry: "Planar hexagonal (120°)",
      atoms: [
        ...Array.from({ length: 6 }, (_, i) => ({
          element: "C",
          x: Math.cos((i * Math.PI * 2) / 6) * 1.0,
          y: Math.sin((i * Math.PI * 2) / 6) * 1.0,
          z: 0,
          color: "#64748b",
          radius: 16,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          element: "H",
          x: Math.cos((i * Math.PI * 2) / 6) * 1.7,
          y: Math.sin((i * Math.PI * 2) / 6) * 1.7,
          z: 0,
          color: "#e2e8f0",
          radius: 12,
        })),
      ],
      bonds: [
        { from: 0, to: 1, order: 2 }, { from: 1, to: 2, order: 1 }, { from: 2, to: 3, order: 2 },
        { from: 3, to: 4, order: 1 }, { from: 4, to: 5, order: 2 }, { from: 5, to: 0, order: 1 },
        { from: 0, to: 6, order: 1 }, { from: 1, to: 7, order: 1 }, { from: 2, to: 8, order: 1 },
        { from: 3, to: 9, order: 1 }, { from: 4, to: 10, order: 1 }, { from: 5, to: 11, order: 1 },
      ],
      description: "Aromatic ring with delocalized π electrons, alternating bonds",
    },
  ];

  function rotateY(x: number, y: number, z: number, angle: number): [number, number, number] {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [x * cos + z * sin, y, -x * sin + z * cos];
  }

  function rotateX(x: number, y: number, z: number, angle: number): [number, number, number] {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [x, y * cos - z * sin, y * sin + z * cos];
  }

  function project(x: number, y: number, z: number): { px: number; py: number; depth: number; scale: number } {
    const perspective = 5;
    const s = perspective / (perspective + z + 2);
    const cx = W * 0.4;
    const cy = H * 0.42;
    const baseScale = Math.min(W, H) * 0.12;
    return {
      px: cx + x * baseScale * s,
      py: cy + y * baseScale * s,
      depth: z,
      scale: s,
    };
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
      moleculeIndex = Math.round(params.moleculeIndex ?? 0) % MOLECULES.length;
      if (moleculeIndex < 0) moleculeIndex = 0;
      rotationSpeed = params.rotationSpeed ?? 1;
      showLabels = params.showLabels ?? 1;
      showBondAngles = params.showBondAngles ?? 0;
      time += dt * rotationSpeed;
    },

    render() {
      if (!ctx) return;

      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      const mol = MOLECULES[moleculeIndex];

      // Title
      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(`Molecule — ${mol.name} (${mol.formula})`, W / 2, 28);

      // Rotation angles
      const angleY = time * 0.5;
      const angleX = Math.sin(time * 0.2) * 0.3;

      // Transform all atoms
      const projected = mol.atoms.map((a) => {
        let [x, y, z] = [a.x, a.y, a.z];
        [x, y, z] = rotateY(x, y, z, angleY);
        [x, y, z] = rotateX(x, y, z, angleX);
        return { ...a, ...project(x, y, z) };
      });

      // Sort by depth for painter's algorithm
      const sortedBonds = [...mol.bonds].sort((a, b) => {
        const za = (projected[a.from].depth + projected[a.to].depth) / 2;
        const zb = (projected[b.from].depth + projected[b.to].depth) / 2;
        return zb - za;
      });

      const sortedAtoms = projected
        .map((a, i) => ({ ...a, idx: i }))
        .sort((a, b) => b.depth - a.depth);

      // Draw bonds
      for (const bond of sortedBonds) {
        const a1 = projected[bond.from];
        const a2 = projected[bond.to];
        const avgDepth = (a1.depth + a2.depth) / 2;
        const brightness = Math.max(0.3, 1 - avgDepth * 0.15);

        if (bond.order === 1) {
          ctx.beginPath();
          ctx.moveTo(a1.px, a1.py);
          ctx.lineTo(a2.px, a2.py);
          ctx.strokeStyle = `rgba(148,163,184,${brightness})`;
          ctx.lineWidth = 3 * a1.scale;
          ctx.stroke();
        } else if (bond.order === 2) {
          const dx = a2.px - a1.px;
          const dy = a2.py - a1.py;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = (-dy / len) * 3;
          const ny = (dx / len) * 3;

          ctx.beginPath();
          ctx.moveTo(a1.px + nx, a1.py + ny);
          ctx.lineTo(a2.px + nx, a2.py + ny);
          ctx.strokeStyle = `rgba(148,163,184,${brightness})`;
          ctx.lineWidth = 2.5 * a1.scale;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(a1.px - nx, a1.py - ny);
          ctx.lineTo(a2.px - nx, a2.py - ny);
          ctx.stroke();
        } else if (bond.order === 3) {
          const dx = a2.px - a1.px;
          const dy = a2.py - a1.py;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = (-dy / len) * 4;
          const ny = (dx / len) * 4;

          for (const m of [-1, 0, 1]) {
            ctx.beginPath();
            ctx.moveTo(a1.px + nx * m, a1.py + ny * m);
            ctx.lineTo(a2.px + nx * m, a2.py + ny * m);
            ctx.strokeStyle = `rgba(148,163,184,${brightness})`;
            ctx.lineWidth = 2 * a1.scale;
            ctx.stroke();
          }
        }
      }

      // Draw atoms
      for (const a of sortedAtoms) {
        const r = a.radius * a.scale;
        const brightness = Math.max(0.4, 1 - a.depth * 0.15);

        // Atom sphere gradient
        const grad = ctx.createRadialGradient(a.px - r * 0.3, a.py - r * 0.3, 0, a.px, a.py, r);
        grad.addColorStop(0, "#fff");
        grad.addColorStop(0.4, a.color);
        grad.addColorStop(1, "#000");
        ctx.beginPath();
        ctx.arc(a.px, a.py, r, 0, Math.PI * 2);
        ctx.globalAlpha = brightness;
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Element label
        if (showLabels) {
          ctx.font = `bold ${Math.max(9, r * 0.8)}px system-ui, sans-serif`;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(a.element, a.px, a.py);
        }
      }
      ctx.textBaseline = "alphabetic";

      // Info panel (right side)
      const infoX = W * 0.72;
      let infoY = 60;

      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.beginPath();
      ctx.roundRect(infoX - 10, infoY - 15, W - infoX + 5, H * 0.55, 8);
      ctx.fill();

      ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(mol.name, infoX, infoY);
      infoY += 22;

      ctx.font = "13px system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Formula: ${mol.formula}`, infoX, infoY);
      infoY += 20;

      ctx.fillStyle = "#22c55e";
      ctx.fillText(`Geometry: ${mol.geometry}`, infoX, infoY);
      infoY += 20;

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Atoms: ${mol.atoms.length}`, infoX, infoY);
      infoY += 20;

      ctx.fillStyle = "#c084fc";
      ctx.fillText(`Bonds: ${mol.bonds.length}`, infoX, infoY);
      infoY += 25;

      // Description
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      const words = mol.description.split(" ");
      let line = "";
      for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > W - infoX - 10) {
          ctx.fillText(line.trim(), infoX, infoY);
          infoY += 15;
          line = word + " ";
        } else {
          line = test;
        }
      }
      if (line.trim()) ctx.fillText(line.trim(), infoX, infoY);
      infoY += 25;

      // Atom composition
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Composition:", infoX, infoY);
      infoY += 18;

      const counts: Record<string, { count: number; color: string }> = {};
      for (const a of mol.atoms) {
        if (!counts[a.element]) counts[a.element] = { count: 0, color: a.color };
        counts[a.element].count++;
      }
      for (const [el, data] of Object.entries(counts)) {
        ctx.beginPath();
        ctx.arc(infoX + 8, infoY - 4, 6, 0, Math.PI * 2);
        ctx.fillStyle = data.color;
        ctx.fill();
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(`${el}: ${data.count}`, infoX + 20, infoY);
        infoY += 18;
      }

      // Molecule selector indicator
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(`Molecule ${moleculeIndex + 1} of ${MOLECULES.length} — Adjust slider to change`, W / 2, H - 10);
    },

    reset() {
      time = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const mol = MOLECULES[moleculeIndex];
      const counts: Record<string, number> = {};
      for (const a of mol.atoms) counts[a.element] = (counts[a.element] || 0) + 1;
      const comp = Object.entries(counts).map(([el, n]) => `${el}:${n}`).join(", ");
      return (
        `Molecule viewer: ${mol.name} (${mol.formula}). ` +
        `Geometry: ${mol.geometry}. Atoms: ${mol.atoms.length}, Bonds: ${mol.bonds.length}. ` +
        `Composition: ${comp}. ${mol.description}.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default MoleculeFactory;
