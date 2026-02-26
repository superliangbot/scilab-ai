import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const crystalLatticeFactory: SimulationFactory = () => {
  const config = getSimConfig("crystal-lattice-structures")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let latticeType = 0;

  interface Atom { x: number; y: number; z: number; }

  const latticeNames = ["Simple Cubic (SC)", "Body-Centered Cubic (BCC)", "Face-Centered Cubic (FCC)", "Hexagonal Close-Packed (HCP)", "Diamond Cubic", "NaCl (Rock Salt)"];
  const latticeColors = ["#60a5fa", "#f59e0b", "#22c55e", "#ec4899", "#a78bfa", "#ef4444"];
  const latticeInfo = [
    { packing: "52.4%", coord: 6, atoms: 1, examples: "Po" },
    { packing: "68.0%", coord: 8, atoms: 2, examples: "Fe, W, Cr" },
    { packing: "74.0%", coord: 12, atoms: 4, examples: "Cu, Al, Au" },
    { packing: "74.0%", coord: 12, atoms: 6, examples: "Mg, Ti, Zn" },
    { packing: "34.0%", coord: 4, atoms: 8, examples: "C (diamond), Si" },
    { packing: "66.7%", coord: 6, atoms: 8, examples: "NaCl, KCl, MgO" },
  ];

  function generateLattice(type: number): Atom[] {
    const atoms: Atom[] = [];
    const n = 2; // unit cells per side
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        for (let k = -n; k <= n; k++) {
          switch (type) {
            case 0: // SC
              atoms.push({ x: i, y: j, z: k });
              break;
            case 1: // BCC
              atoms.push({ x: i, y: j, z: k });
              atoms.push({ x: i + 0.5, y: j + 0.5, z: k + 0.5 });
              break;
            case 2: // FCC
              atoms.push({ x: i, y: j, z: k });
              atoms.push({ x: i + 0.5, y: j + 0.5, z: k });
              atoms.push({ x: i + 0.5, y: j, z: k + 0.5 });
              atoms.push({ x: i, y: j + 0.5, z: k + 0.5 });
              break;
            case 3: // HCP (simplified)
              atoms.push({ x: i, y: j, z: k });
              atoms.push({ x: i + 0.5, y: j + 0.289, z: k + 0.5 });
              break;
            case 4: // Diamond
              atoms.push({ x: i, y: j, z: k });
              atoms.push({ x: i + 0.5, y: j + 0.5, z: k });
              atoms.push({ x: i + 0.5, y: j, z: k + 0.5 });
              atoms.push({ x: i, y: j + 0.5, z: k + 0.5 });
              atoms.push({ x: i + 0.25, y: j + 0.25, z: k + 0.25 });
              atoms.push({ x: i + 0.75, y: j + 0.75, z: k + 0.25 });
              atoms.push({ x: i + 0.75, y: j + 0.25, z: k + 0.75 });
              atoms.push({ x: i + 0.25, y: j + 0.75, z: k + 0.75 });
              break;
            case 5: // NaCl
              atoms.push({ x: i, y: j, z: k });
              atoms.push({ x: i + 0.5, y: j, z: k });
              atoms.push({ x: i, y: j + 0.5, z: k });
              atoms.push({ x: i, y: j, z: k + 0.5 });
              break;
          }
        }
      }
    }
    return atoms;
  }

  function project(atom: Atom, rotY: number, rotX: number): { sx: number; sy: number; depth: number } {
    // Rotate around Y
    let x = atom.x * Math.cos(rotY) - atom.z * Math.sin(rotY);
    let z = atom.x * Math.sin(rotY) + atom.z * Math.cos(rotY);
    let y = atom.y;
    // Rotate around X
    const y2 = y * Math.cos(rotX) - z * Math.sin(rotX);
    const z2 = y * Math.sin(rotX) + z * Math.cos(rotX);

    const scale = Math.min(W, H) * 0.08;
    const perspective = 8 / (8 + z2);
    return {
      sx: W / 2 + x * scale * perspective,
      sy: H * 0.4 + y2 * scale * perspective,
      depth: z2,
    };
  }

  function drawBonds(atoms: Atom[], rotY: number, rotX: number, bondDist: number) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const dx = atoms[i].x - atoms[j].x;
        const dy = atoms[i].y - atoms[j].y;
        const dz = atoms[i].z - atoms[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < bondDist) {
          const p1 = project(atoms[i], rotY, rotX);
          const p2 = project(atoms[j], rotY, rotX);
          ctx.beginPath();
          ctx.moveTo(p1.sx, p1.sy);
          ctx.lineTo(p2.sx, p2.sy);
          ctx.stroke();
        }
      }
    }
  }

  function drawAtoms(atoms: Atom[], rotY: number, rotX: number) {
    const projected = atoms.map((a, i) => ({ ...project(a, rotY, rotX), idx: i, atom: a }));
    projected.sort((a, b) => a.depth - b.depth); // back to front

    const color = latticeColors[latticeType] || "#60a5fa";
    for (const p of projected) {
      const r = Math.max(2, 6 * (8 / (8 + p.depth)));
      const alpha = Math.max(0.2, Math.min(1, 1 - p.depth * 0.1));

      // For NaCl, alternate colors
      let atomColor = color;
      if (latticeType === 5) {
        const isNa = (Math.round(p.atom.x * 2) + Math.round(p.atom.y * 2) + Math.round(p.atom.z * 2)) % 2 === 0;
        atomColor = isNa ? "#60a5fa" : "#22c55e";
      }

      const grad = ctx.createRadialGradient(p.sx - r * 0.3, p.sy - r * 0.3, 0, p.sx, p.sy, r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.5})`);
      grad.addColorStop(0.5, atomColor);
      grad.addColorStop(1, `rgba(0, 0, 0, ${alpha * 0.3})`);
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawUnitCell(rotY: number, rotX: number) {
    const corners = [
      { x: -0.5, y: -0.5, z: -0.5 }, { x: 0.5, y: -0.5, z: -0.5 },
      { x: 0.5, y: 0.5, z: -0.5 }, { x: -0.5, y: 0.5, z: -0.5 },
      { x: -0.5, y: -0.5, z: 0.5 }, { x: 0.5, y: -0.5, z: 0.5 },
      { x: 0.5, y: 0.5, z: 0.5 }, { x: -0.5, y: 0.5, z: 0.5 },
    ];
    const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    const proj = corners.map(c => project(c, rotY, rotX));

    ctx.strokeStyle = "rgba(250, 204, 21, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    for (const [a, b] of edges) {
      ctx.beginPath();
      ctx.moveTo(proj[a].sx, proj[a].sy);
      ctx.lineTo(proj[b].sx, proj[b].sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawInfoPanel() {
    const info = latticeInfo[latticeType] || latticeInfo[0];
    const px = W * 0.05, py = H * 0.68, pw = W * 0.9, ph = H * 0.28;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    ctx.font = "bold 16px Arial";
    ctx.fillStyle = latticeColors[latticeType] || "#60a5fa";
    ctx.textAlign = "left";
    ctx.fillText(latticeNames[latticeType] || "Unknown", px + 15, py + 25);

    ctx.font = "13px Arial";
    ctx.fillStyle = "#e2e8f0";
    const y0 = py + 48;
    ctx.fillText(`Packing Efficiency: ${info.packing}`, px + 15, y0);
    ctx.fillText(`Coordination Number: ${info.coord}`, px + 15, y0 + 20);
    ctx.fillText(`Atoms per Unit Cell: ${info.atoms}`, px + 15, y0 + 40);
    ctx.fillText(`Examples: ${info.examples}`, px + 15, y0 + 60);

    // Right side: structure description
    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Arial";
    const descriptions = [
      "Atoms at corners only. Least efficient packing.",
      "Atoms at corners + 1 at center. Common in metals.",
      "Atoms at corners + face centers. Most efficient cubic.",
      "Hexagonal layers with ABAB stacking pattern.",
      "FCC with tetrahedral interstitial sites filled.",
      "Two interpenetrating FCC lattices (Na⁺ and Cl⁻).",
    ];
    const desc = descriptions[latticeType] || "";
    ctx.fillText(desc, px + pw - 15, y0);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c;
      ctx = c.getContext("2d")!;
      W = c.width;
      H = c.height;
      time = 0;
    },
    update(dt, params) {
      latticeType = Math.floor(Math.min(5, Math.max(0, params.latticeType ?? latticeType)));
      time += dt;
    },
    render() {
      ctx.fillStyle = "#0a0a1f";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Crystal Lattice Structures", W / 2, 28);

      const rotY = time * 0.3;
      const rotX = 0.4 + Math.sin(time * 0.15) * 0.15;

      const atoms = generateLattice(latticeType);
      // Filter to visible range
      const visible = atoms.filter(a => Math.abs(a.x) <= 1.5 && Math.abs(a.y) <= 1.5 && Math.abs(a.z) <= 1.5);

      const bondDists = [1.05, 0.9, 0.75, 0.75, 0.5, 0.55];
      drawBonds(visible, rotY, rotX, bondDists[latticeType] || 1.05);
      drawUnitCell(rotY, rotX);
      drawAtoms(visible, rotY, rotX);
      drawInfoPanel();

      // Rotation hint
      ctx.font = "11px Arial";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.fillText("Auto-rotating • Change Lattice Type parameter to explore structures", W / 2, H * 0.65);
    },
    reset() {
      time = 0;
    },
    destroy() {},
    getStateDescription() {
      const info = latticeInfo[latticeType];
      return `Crystal lattice: ${latticeNames[latticeType]}. Packing efficiency: ${info.packing}, coordination number: ${info.coord}, atoms per unit cell: ${info.atoms}. Examples: ${info.examples}.`;
    },
    resize(w, h) {
      W = w;
      H = h;
    },
  };
  return engine;
};

export default crystalLatticeFactory;
