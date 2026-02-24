import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Atom3D {
  x: number;
  y: number;
  z: number;
  element: string;
  color: string;
  radius: number;
}

interface Bond3D {
  a: number;
  b: number;
  order: number;
}

interface EsterMolecule {
  name: string;
  formula: string;
  fruit: string;
  fruitEmoji: string;
  atoms: Atom3D[];
  bonds: Bond3D[];
}

const ESTERS: EsterMolecule[] = [
  {
    name: "Ethyl Acetate",
    formula: "CH₃COOCH₂CH₃",
    fruit: "Nail polish / Pear",
    fruitEmoji: "🍐",
    atoms: [
      { x: -2.5, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -1.5, y: 0.8, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: -2.5, y: -0.8, z: 0.6, element: "H", color: "#ddd", radius: 7 },
      { x: -2.5, y: -0.4, z: -0.8, element: "H", color: "#ddd", radius: 7 },
      { x: -1.2, y: -0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -1.2, y: -1.5, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 0, y: 0, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 1.2, y: -0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 1.2, y: -1.3, z: 0.6, element: "H", color: "#ddd", radius: 7 },
      { x: 1.2, y: -1.0, z: -0.7, element: "H", color: "#ddd", radius: 7 },
      { x: 2.5, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 2.5, y: 0.8, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: 2.5, y: 0.5, z: -0.7, element: "H", color: "#ddd", radius: 7 },
      { x: 3.2, y: -0.5, z: 0, element: "H", color: "#ddd", radius: 7 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 }, { a: 4, b: 5, order: 2 }, { a: 4, b: 6, order: 1 },
      { a: 6, b: 7, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 7, b: 9, order: 1 },
      { a: 7, b: 10, order: 1 }, { a: 10, b: 11, order: 1 }, { a: 10, b: 12, order: 1 },
      { a: 10, b: 13, order: 1 },
    ],
  },
  {
    name: "Isoamyl Acetate",
    formula: "CH₃COOCH₂CH₂CH(CH₃)₂",
    fruit: "Banana",
    fruitEmoji: "🍌",
    atoms: [
      { x: -3, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -3.8, y: 0.5, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: -3, y: -0.7, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: -3, y: -0.3, z: -0.7, element: "H", color: "#ddd", radius: 7 },
      { x: -1.8, y: 0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -1.8, y: 1.5, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: -0.6, y: 0, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 0.6, y: 0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 0.6, y: 1.3, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: 0.6, y: 1.0, z: -0.6, element: "H", color: "#ddd", radius: 7 },
      { x: 1.8, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 1.8, y: -0.8, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: 1.8, y: -0.5, z: -0.6, element: "H", color: "#ddd", radius: 7 },
      { x: 3, y: 0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 3, y: 1.3, z: 0, element: "H", color: "#ddd", radius: 7 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 }, { a: 4, b: 5, order: 2 }, { a: 4, b: 6, order: 1 },
      { a: 6, b: 7, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 7, b: 9, order: 1 },
      { a: 7, b: 10, order: 1 }, { a: 10, b: 11, order: 1 }, { a: 10, b: 12, order: 1 },
      { a: 10, b: 13, order: 1 }, { a: 13, b: 14, order: 1 },
    ],
  },
  {
    name: "Ethyl Butyrate",
    formula: "CH₃CH₂CH₂COOCH₂CH₃",
    fruit: "Pineapple",
    fruitEmoji: "🍍",
    atoms: [
      { x: -3.5, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -3.5, y: 0.8, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: -3.5, y: -0.5, z: 0.6, element: "H", color: "#ddd", radius: 7 },
      { x: -4.2, y: -0.3, z: -0.3, element: "H", color: "#ddd", radius: 7 },
      { x: -2.2, y: -0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -2.2, y: -1.3, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: -2.2, y: -1.0, z: -0.6, element: "H", color: "#ddd", radius: 7 },
      { x: -1, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -1, y: 0.8, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: -1, y: 0.5, z: -0.6, element: "H", color: "#ddd", radius: 7 },
      { x: 0.2, y: -0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 0.2, y: -1.5, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 1.4, y: 0, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 2.6, y: -0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 2.6, y: -1.3, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: 2.6, y: -1.0, z: -0.6, element: "H", color: "#ddd", radius: 7 },
      { x: 3.8, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 3.8, y: 0.8, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: 4.5, y: -0.5, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: 3.8, y: 0.3, z: -0.7, element: "H", color: "#ddd", radius: 7 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 }, { a: 4, b: 5, order: 1 }, { a: 4, b: 6, order: 1 },
      { a: 4, b: 7, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 7, b: 9, order: 1 },
      { a: 7, b: 10, order: 1 }, { a: 10, b: 11, order: 2 }, { a: 10, b: 12, order: 1 },
      { a: 12, b: 13, order: 1 }, { a: 13, b: 14, order: 1 }, { a: 13, b: 15, order: 1 },
      { a: 13, b: 16, order: 1 }, { a: 16, b: 17, order: 1 }, { a: 16, b: 18, order: 1 },
      { a: 16, b: 19, order: 1 },
    ],
  },
  {
    name: "Octyl Acetate",
    formula: "CH₃COO(CH₂)₇CH₃",
    fruit: "Orange",
    fruitEmoji: "🍊",
    atoms: [
      { x: -2, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -2.7, y: 0.5, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: -2, y: -0.6, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: -2, y: -0.3, z: -0.6, element: "H", color: "#ddd", radius: 7 },
      { x: -0.8, y: 0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -0.8, y: 1.5, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 0.4, y: 0, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 1.6, y: 0.5, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 1.6, y: 1.2, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: 1.6, y: 1.0, z: -0.5, element: "H", color: "#ddd", radius: 7 },
      { x: 2.8, y: 0, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 2.8, y: -0.7, z: 0.5, element: "H", color: "#ddd", radius: 7 },
      { x: 2.8, y: -0.4, z: -0.6, element: "H", color: "#ddd", radius: 7 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
      { a: 0, b: 4, order: 1 }, { a: 4, b: 5, order: 2 }, { a: 4, b: 6, order: 1 },
      { a: 6, b: 7, order: 1 }, { a: 7, b: 8, order: 1 }, { a: 7, b: 9, order: 1 },
      { a: 7, b: 10, order: 1 }, { a: 10, b: 11, order: 1 }, { a: 10, b: 12, order: 1 },
    ],
  },
  {
    name: "Methyl Salicylate",
    formula: "C₆H₄(OH)COOCH₃",
    fruit: "Wintergreen",
    fruitEmoji: "🌿",
    atoms: [
      // Benzene ring (simplified)
      { x: 0, y: 1.4, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 1.2, y: 0.7, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 1.2, y: -0.7, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 0, y: -1.4, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -1.2, y: -0.7, z: 0, element: "C", color: "#555", radius: 12 },
      { x: -1.2, y: 0.7, z: 0, element: "C", color: "#555", radius: 12 },
      // OH group
      { x: -2.3, y: 1.2, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: -3, y: 1.6, z: 0, element: "H", color: "#ddd", radius: 7 },
      // Ester group
      { x: 2.3, y: 1.2, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 2.3, y: 2.2, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 3.5, y: 0.7, z: 0, element: "O", color: "#e33", radius: 11 },
      { x: 4.5, y: 1.2, z: 0, element: "C", color: "#555", radius: 12 },
      { x: 5.2, y: 0.7, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: 4.5, y: 2, z: 0, element: "H", color: "#ddd", radius: 7 },
      { x: 4.8, y: 1.5, z: 0.7, element: "H", color: "#ddd", radius: 7 },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 1, b: 2, order: 1 }, { a: 2, b: 3, order: 2 },
      { a: 3, b: 4, order: 1 }, { a: 4, b: 5, order: 2 }, { a: 5, b: 0, order: 1 },
      { a: 5, b: 6, order: 1 }, { a: 6, b: 7, order: 1 },
      { a: 1, b: 8, order: 1 }, { a: 8, b: 9, order: 2 }, { a: 8, b: 10, order: 1 },
      { a: 10, b: 11, order: 1 }, { a: 11, b: 12, order: 1 }, { a: 11, b: 13, order: 1 },
      { a: 11, b: 14, order: 1 },
    ],
  },
];

const EsterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ester") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let moleculeIndex = 0;
  let rotationSpeed = 1;
  let zoom = 1;

  let rotY = 0;
  let rotX = 0.3;

  function currentEster(): EsterMolecule {
    return ESTERS[Math.round(moleculeIndex) % ESTERS.length];
  }

  function project(atom: Atom3D): { sx: number; sy: number; depth: number } {
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);

    // Rotate around Y
    let x = atom.x * cosY + atom.z * sinY;
    const z1 = -atom.x * sinY + atom.z * cosY;
    let y = atom.y;

    // Rotate around X
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const scale = 55 * zoom;
    return {
      sx: W / 2 + x * scale,
      sy: H / 2 + y2 * scale,
      depth: z2,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    rotY = 0;
    rotX = 0.3;
  }

  function update(dt: number, params: Record<string, number>): void {
    moleculeIndex = Math.round(params.moleculeIndex ?? 0);
    rotationSpeed = params.rotationSpeed ?? 1;
    zoom = params.zoom ?? 1;

    rotY += rotationSpeed * dt * 0.5;
    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMolecule(): void {
    const ester = currentEster();

    // Project all atoms
    const projected = ester.atoms.map((a) => project(a));

    // Sort bonds by average depth for painter's algorithm
    const sortedBonds = [...ester.bonds].sort((a, b) => {
      const da = (projected[a.a].depth + projected[a.b].depth) / 2;
      const db = (projected[b.a].depth + projected[b.b].depth) / 2;
      return da - db;
    });

    // Draw bonds
    for (const bond of sortedBonds) {
      const pa = projected[bond.a];
      const pb = projected[bond.b];
      const avgDepth = (pa.depth + pb.depth) / 2;
      const alpha = Math.max(0.3, Math.min(1, 0.7 + avgDepth * 0.1));

      ctx.strokeStyle = `rgba(180, 180, 180, ${alpha})`;
      ctx.lineWidth = bond.order === 2 ? 4 : 3;

      if (bond.order === 2) {
        const dx = pb.sx - pa.sx;
        const dy = pb.sy - pa.sy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = (-dy / len) * 3;
        const ny = (dx / len) * 3;

        ctx.beginPath();
        ctx.moveTo(pa.sx + nx, pa.sy + ny);
        ctx.lineTo(pb.sx + nx, pb.sy + ny);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pa.sx - nx, pa.sy - ny);
        ctx.lineTo(pb.sx - nx, pb.sy - ny);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }
    }

    // Sort atoms by depth
    const indexedProjected = projected.map((p, i) => ({ ...p, idx: i }));
    indexedProjected.sort((a, b) => a.depth - b.depth);

    // Draw atoms
    for (const p of indexedProjected) {
      const atom = ester.atoms[p.idx];
      const depthAlpha = Math.max(0.4, Math.min(1, 0.7 + p.depth * 0.1));
      const r = atom.radius * (0.8 + p.depth * 0.08) * zoom;

      // Sphere gradient
      const grad = ctx.createRadialGradient(p.sx - r * 0.3, p.sy - r * 0.3, 0, p.sx, p.sy, r);
      const baseColor = atom.color;
      grad.addColorStop(0, `rgba(255, 255, 255, ${depthAlpha * 0.5})`);
      grad.addColorStop(0.5, baseColor);
      grad.addColorStop(1, `rgba(0, 0, 0, ${depthAlpha * 0.3})`);

      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.globalAlpha = depthAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Element label
      if (r > 8) {
        ctx.fillStyle = atom.element === "H" ? "#333" : "#fff";
        ctx.font = `bold ${Math.max(8, r * 0.8)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(atom.element, p.sx, p.sy);
      }
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawMoleculeInfo(): void {
    const ester = currentEster();
    ctx.save();

    const pw = 300;
    const ph = 100;
    const px = 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${ester.fruitEmoji} ${ester.name}`, px + 12, py + 24);

    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(ester.formula, px + 12, py + 46);

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Fragrance: ${ester.fruit}`, px + 12, py + 66);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Ester group: R-COO-R' (carbonyl + alkoxy)", px + 12, py + 86);

    ctx.restore();
  }

  function drawColorKey(): void {
    ctx.save();
    const kx = 15;
    const ky = H - 70;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(kx, ky, 200, 55, 6);
    ctx.fill();

    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";

    const items = [
      { color: "#555", label: "Carbon (C)" },
      { color: "#e33", label: "Oxygen (O)" },
      { color: "#ddd", label: "Hydrogen (H)" },
    ];

    items.forEach((item, i) => {
      ctx.beginPath();
      ctx.arc(kx + 15, ky + 15 + i * 15, 5, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(item.label, kx + 28, ky + 19 + i * 15);
    });

    ctx.restore();
  }

  function drawReactionEquation(): void {
    ctx.save();
    const px = W - 350;
    const py = H - 50;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(px, py, 335, 35, 6);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Esterification: R-COOH + R'-OH → R-COO-R' + H₂O", px + 167, py + 22);
    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawMolecule();
    drawMoleculeInfo();
    drawColorKey();
    drawReactionEquation();
  }

  function reset(): void {
    time = 0;
    rotY = 0;
    rotX = 0.3;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const ester = currentEster();
    return (
      `Ester Molecule: ${ester.name} (${ester.formula}). ` +
      `Fragrance: ${ester.fruit}. ${ester.atoms.length} atoms, ${ester.bonds.length} bonds. ` +
      `Esters are formed by esterification: carboxylic acid + alcohol → ester + water. ` +
      `The ester functional group (-COO-) gives many fruits their characteristic scents.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EsterFactory;
