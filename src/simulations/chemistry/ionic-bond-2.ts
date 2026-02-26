import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Electron {
  angle: number;
  orbitRadius: number;
  speed: number;
  transferProgress: number; // 0=on atom1, 1=on atom2
}

const IonicBond2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ionic-bond-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let compoundIdx = 0; // 0=NaCl, 1=LiCl, 2=MgO, 3=CaCl2
  let showSymbols = 1;
  let animating = false;
  let animProgress = 0; // 0=separated, 1=bonded

  interface CompoundDef {
    name: string;
    formula: string;
    metal: { symbol: string; protons: number; color: string; valence: number };
    nonmetal: { symbol: string; protons: number; color: string; valence: number; needed: number };
    electronsTransferred: number;
  }

  const compounds: CompoundDef[] = [
    {
      name: "Sodium Chloride",
      formula: "NaCl",
      metal: { symbol: "Na", protons: 11, color: "#818cf8", valence: 1 },
      nonmetal: { symbol: "Cl", protons: 17, color: "#4ade80", valence: 7, needed: 1 },
      electronsTransferred: 1,
    },
    {
      name: "Lithium Chloride",
      formula: "LiCl",
      metal: { symbol: "Li", protons: 3, color: "#f472b6", valence: 1 },
      nonmetal: { symbol: "Cl", protons: 17, color: "#4ade80", valence: 7, needed: 1 },
      electronsTransferred: 1,
    },
    {
      name: "Magnesium Oxide",
      formula: "MgO",
      metal: { symbol: "Mg", protons: 12, color: "#fbbf24", valence: 2 },
      nonmetal: { symbol: "O", protons: 8, color: "#f87171", valence: 6, needed: 2 },
      electronsTransferred: 2,
    },
    {
      name: "Calcium Chloride",
      formula: "CaCl₂",
      metal: { symbol: "Ca", protons: 20, color: "#22d3ee", valence: 2 },
      nonmetal: { symbol: "Cl", protons: 17, color: "#4ade80", valence: 7, needed: 1 },
      electronsTransferred: 2,
    },
  ];

  let electrons: Electron[] = [];

  function initElectrons() {
    electrons = [];
    const comp = compounds[compoundIdx];
    for (let i = 0; i < comp.electronsTransferred; i++) {
      electrons.push({
        angle: (i / comp.electronsTransferred) * Math.PI * 2 + Math.PI,
        orbitRadius: 28 + i * 6,
        speed: 2 + Math.random(),
        transferProgress: 0,
      });
    }
  }

  return {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initElectrons();
    },
    update(dt: number, params: Record<string, number>) {
      const newIdx = Math.round(params.compoundIdx ?? 0);
      showSymbols = params.showSymbols ?? 1;

      if (newIdx !== compoundIdx) {
        compoundIdx = newIdx;
        animProgress = 0;
        animating = false;
        initElectrons();
      }

      const dtc = Math.min(dt, 0.05);
      time += dtc;

      // Auto-animate the transfer
      if (animProgress < 1) {
        animProgress += dtc * 0.3;
        if (animProgress > 1) animProgress = 1;
      }

      // Update electron transfer progress
      for (const e of electrons) {
        e.angle += e.speed * dtc;
        e.transferProgress = animProgress;
      }
    },
    render() {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      const comp = compounds[compoundIdx];

      // Title
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Ionic Bond Formation: ${comp.name} (${comp.formula})`, width / 2, 26);

      const cy = height * 0.45;
      const atomSep = width * 0.3;
      const metalX = width / 2 - atomSep / 2;
      const nonmetalX = width / 2 + atomSep / 2;

      // Draw atoms
      drawAtom(metalX, cy, comp.metal, true);
      drawAtom(nonmetalX, cy, comp.nonmetal, false);

      // Draw transferring electrons
      for (const e of electrons) {
        const fromX = metalX;
        const toX = nonmetalX;
        const progress = e.transferProgress;

        // Position interpolates from metal to nonmetal orbit
        const centerX = fromX + (toX - fromX) * progress;
        const orbitR = e.orbitRadius;
        const ex = centerX + orbitR * Math.cos(e.angle);
        const ey = cy + orbitR * Math.sin(e.angle);

        // Electron
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(ex, ey, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Trail
        if (progress > 0 && progress < 1) {
          ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, cy, orbitR, e.angle - 0.5, e.angle);
          ctx.stroke();
        }
      }

      // Arrow showing electron transfer
      if (animProgress > 0.1) {
        const arrowY = cy - 60;
        ctx.strokeStyle = `rgba(251, 191, 36, ${Math.min(animProgress, 0.7)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(metalX + 30, arrowY);
        ctx.lineTo(nonmetalX - 30, arrowY);
        ctx.stroke();
        // Arrowhead
        ctx.fillStyle = `rgba(251, 191, 36, ${Math.min(animProgress, 0.7)})`;
        ctx.beginPath();
        ctx.moveTo(nonmetalX - 30, arrowY);
        ctx.lineTo(nonmetalX - 38, arrowY - 5);
        ctx.lineTo(nonmetalX - 38, arrowY + 5);
        ctx.closePath();
        ctx.fill();
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${comp.electronsTransferred}e⁻ transfer`, width / 2, arrowY - 8);
      }

      // Charge labels after transfer
      if (animProgress > 0.8) {
        ctx.font = `bold ${Math.max(14, width * 0.02)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#60a5fa";
        ctx.fillText(`${comp.metal.symbol}${comp.electronsTransferred > 1 ? comp.electronsTransferred : ""}⁺`, metalX, cy + 55);
        ctx.fillStyle = "#f87171";
        const anionCharge = comp.nonmetal.needed > 1 ? comp.nonmetal.needed : "";
        ctx.fillText(`${comp.nonmetal.symbol}${anionCharge}⁻`, nonmetalX, cy + 55);
      }

      // Energy diagram at bottom
      drawEnergyDiagram();

      // Info text
      ctx.fillStyle = "#94a3b8";
      ctx.font = `${Math.max(10, width * 0.014)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Metal atoms lose electrons → cations | Nonmetals gain electrons → anions", width / 2, height - 12);
    },
    reset() {
      time = 0;
      animProgress = 0;
      animating = false;
      initElectrons();
    },
    destroy() {},
    getStateDescription(): string {
      const comp = compounds[compoundIdx];
      const phase = animProgress < 0.3 ? "separated atoms" :
        animProgress < 0.7 ? "electron transfer in progress" : "ionic bond formed";
      return `Ionic bond formation: ${comp.name} (${comp.formula}). Phase: ${phase}. ` +
        `${comp.metal.symbol} loses ${comp.electronsTransferred} electron(s) to become ${comp.metal.symbol}⁺. ` +
        `${comp.nonmetal.symbol} gains electron(s) to become ${comp.nonmetal.symbol}⁻. ` +
        `The resulting electrostatic attraction between cation and anion forms the ionic bond.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  function drawAtom(x: number, y: number, atom: { symbol: string; color: string; valence: number }, isMetal: boolean) {
    const r = 30;

    // Electron shells (faint)
    ctx.strokeStyle = `${atom.color}30`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r + 10, 0, Math.PI * 2);
    ctx.stroke();

    // Nucleus
    const grad = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, r);
    grad.addColorStop(0, atom.color);
    grad.addColorStop(1, atom.color + "80");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Symbol
    if (showSymbols) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${r * 0.7}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(atom.symbol, x, y);
      ctx.textBaseline = "alphabetic";
    }

    // Valence electrons (dots on outer shell)
    const shellR = r + 10;
    const numE = atom.valence;
    const startAngle = isMetal ? Math.PI : 0;
    for (let i = 0; i < numE; i++) {
      const angle = startAngle + (i / numE) * Math.PI * 2;
      if (isMetal && animProgress > 0.5) continue; // electrons transferred away
      if (!isMetal && animProgress > 0.8) {
        // Show gained electrons too
      }
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(x + shellR * Math.cos(angle), y + shellR * Math.sin(angle), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label below
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(isMetal ? "Metal" : "Nonmetal", x, y + r + 28);
  }

  function drawEnergyDiagram() {
    const gx = width * 0.15;
    const gy = height * 0.72;
    const gw = width * 0.7;
    const gh = height * 0.18;

    ctx.fillStyle = "#111827";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    // Energy level diagram
    const midY = gy + gh / 2;
    const topY = gy + 10;
    const botY = gy + gh - 10;

    // Before: separated atoms (higher energy)
    const beforeX = gx + gw * 0.2;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beforeX - 30, topY + 10);
    ctx.lineTo(beforeX + 30, topY + 10);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Separated atoms", beforeX, topY + 24);

    // After: ionic compound (lower energy)
    const afterX = gx + gw * 0.8;
    ctx.strokeStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(afterX - 30, botY - 10);
    ctx.lineTo(afterX + 30, botY - 10);
    ctx.stroke();
    ctx.fillStyle = "#10b981";
    ctx.fillText("Ionic compound", afterX, botY + 4);

    // Arrow
    const arrowProgress = Math.min(animProgress * 1.2, 1);
    const curX = beforeX + (afterX - beforeX) * arrowProgress;
    const curY = topY + 10 + (botY - 10 - topY - 10) * arrowProgress;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(beforeX, topY + 10);
    ctx.lineTo(curX, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ΔE label
    ctx.fillStyle = "#f87171";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("← ΔE (energy released)", gx + gw * 0.4, midY);
    ctx.fillText("Energy →", gx + 5, gy + 12);
  }
};

export default IonicBond2Factory;
