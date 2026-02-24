import { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Electron {
  angle: number;
  shell: number;
  speed: number;
  transferring: boolean;
  transferT: number;
}

interface Atom {
  x: number;
  y: number;
  symbol: string;
  protons: number;
  electrons: Electron[];
  shellConfig: number[];
  color: string;
}

const IonicBond2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ionic-bond-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let compoundType = 0; // 0=NaCl, 1=LiCl, 2=NaF, 3=MgO
  let showSymbols = 1;
  let ionize = 0;

  const compounds = [
    {
      name: "NaCl",
      metal: { symbol: "Na", protons: 11, shells: [2, 8, 1], color: "#7e57c2" },
      nonmetal: { symbol: "Cl", protons: 17, shells: [2, 8, 7], color: "#66bb6a" },
      transferCount: 1,
    },
    {
      name: "LiCl",
      metal: { symbol: "Li", protons: 3, shells: [2, 1], color: "#ef5350" },
      nonmetal: { symbol: "Cl", protons: 17, shells: [2, 8, 7], color: "#66bb6a" },
      transferCount: 1,
    },
    {
      name: "NaF",
      metal: { symbol: "Na", protons: 11, shells: [2, 8, 1], color: "#7e57c2" },
      nonmetal: { symbol: "F", protons: 9, shells: [2, 7], color: "#ffeb3b" },
      transferCount: 1,
    },
    {
      name: "MgO",
      metal: { symbol: "Mg", protons: 12, shells: [2, 8, 2], color: "#ff9800" },
      nonmetal: { symbol: "O", protons: 8, shells: [2, 6], color: "#ef5350" },
      transferCount: 2,
    },
  ];

  let metalAtom: Atom;
  let nonmetalAtom: Atom;
  let ionized = false;
  let ionizeProgress = 0;
  let bondFormed = false;

  function createAtom(data: { symbol: string; protons: number; shells: number[]; color: string }, x: number): Atom {
    const electrons: Electron[] = [];
    for (let s = 0; s < data.shells.length; s++) {
      for (let e = 0; e < data.shells[s]; e++) {
        electrons.push({
          angle: (e / data.shells[s]) * Math.PI * 2 + Math.random() * 0.3,
          shell: s,
          speed: 1.5 + Math.random() * 0.5,
          transferring: false,
          transferT: 0,
        });
      }
    }
    return { x, y: height * 0.4, symbol: data.symbol, protons: data.protons, electrons, shellConfig: [...data.shells], color: data.color };
  }

  function initAtoms() {
    const comp = compounds[Math.round(compoundType)] || compounds[0];
    metalAtom = createAtom(comp.metal, width * 0.3);
    nonmetalAtom = createAtom(comp.nonmetal, width * 0.7);
    ionized = false;
    ionizeProgress = 0;
    bondFormed = false;
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initAtoms();
    },
    update(dt: number, params: Record<string, number>) {
      const oldComp = Math.round(compoundType);
      compoundType = params.compoundType ?? 0;
      showSymbols = params.showSymbols ?? 1;
      ionize = params.ionize ?? 0;

      if (Math.round(compoundType) !== oldComp) {
        initAtoms();
      }

      time += dt;

      // Handle ionization animation
      if (ionize > 0.5 && !ionized) {
        ionizeProgress = Math.min(1, ionizeProgress + dt * 0.8);
        if (ionizeProgress >= 1) {
          ionized = true;
          // Transfer electrons
          const comp = compounds[Math.round(compoundType)] || compounds[0];
          const toTransfer = comp.transferCount;
          let transferred = 0;
          for (let i = metalAtom.electrons.length - 1; i >= 0 && transferred < toTransfer; i--) {
            const e = metalAtom.electrons[i];
            if (e.shell === metalAtom.shellConfig.length - 1) {
              metalAtom.electrons.splice(i, 1);
              nonmetalAtom.electrons.push({
                angle: Math.random() * Math.PI * 2,
                shell: nonmetalAtom.shellConfig.length - 1,
                speed: 1.5 + Math.random() * 0.5,
                transferring: false,
                transferT: 0,
              });
              transferred++;
            }
          }
          bondFormed = true;
        }
      } else if (ionize <= 0.5 && ionized) {
        initAtoms();
      }

      // Move atoms closer when bonded
      if (bondFormed) {
        const targetSep = width * 0.12;
        const currentSep = nonmetalAtom.x - metalAtom.x;
        if (currentSep > targetSep) {
          metalAtom.x += 30 * dt;
          nonmetalAtom.x -= 30 * dt;
        }
      }

      // Orbit electrons
      for (const atom of [metalAtom, nonmetalAtom]) {
        for (const e of atom.electrons) {
          e.angle += e.speed * dt;
        }
      }
    },
    render() {
      ctx.clearRect(0, 0, width, height);

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#1a1a2e");
      bg.addColorStop(1, "#16213e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const comp = compounds[Math.round(compoundType)] || compounds[0];

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Ionic Bond Formation — ${comp.name}`, width / 2, 22);

      // Draw atom
      const drawAtom = (atom: Atom, chargeLabel: string) => {
        // Nucleus
        const grad = ctx.createRadialGradient(atom.x - 3, atom.y - 3, 0, atom.x, atom.y, 16);
        grad.addColorStop(0, atom.color);
        grad.addColorStop(1, "#333");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${atom.protons}+`, atom.x, atom.y);
        ctx.textBaseline = "alphabetic";

        // Electron shells
        const shellRadii = [28, 44, 60, 76];
        for (let s = 0; s < atom.shellConfig.length; s++) {
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(atom.x, atom.y, shellRadii[s], 0, Math.PI * 2);
          ctx.stroke();
        }

        // Electrons
        for (const e of atom.electrons) {
          const r = shellRadii[e.shell] || shellRadii[0];
          const ex = atom.x + r * Math.cos(e.angle);
          const ey = atom.y + r * Math.sin(e.angle);

          ctx.fillStyle = "#42a5f5";
          ctx.beginPath();
          ctx.arc(ex, ey, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(66, 165, 245, 0.3)";
          ctx.beginPath();
          ctx.arc(ex, ey, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        // Symbol and charge
        if (showSymbols > 0.5) {
          ctx.fillStyle = "#e0e0e0";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          const maxShell = shellRadii[atom.shellConfig.length - 1] || 60;
          ctx.fillText(atom.symbol, atom.x, atom.y - maxShell - 12);
          if (ionized) {
            ctx.fillStyle = "#ffeb3b";
            ctx.font = "12px sans-serif";
            ctx.fillText(chargeLabel, atom.x, atom.y - maxShell - 26);
          }
        }
      };

      // Compute charge labels
      const metalCharge = ionized ? `${comp.transferCount}+` : "";
      const nonmetalCharge = ionized ? `${comp.transferCount}−` : "";

      drawAtom(metalAtom, metalCharge);
      drawAtom(nonmetalAtom, nonmetalCharge);

      // Transfer animation
      if (ionizeProgress > 0 && ionizeProgress < 1) {
        const startX = metalAtom.x + 60;
        const endX = nonmetalAtom.x - 60;
        const transferX = startX + (endX - startX) * ionizeProgress;
        const transferY = metalAtom.y - 30 * Math.sin(ionizeProgress * Math.PI);

        for (let i = 0; i < comp.transferCount; i++) {
          ctx.fillStyle = "#ffeb3b";
          ctx.beginPath();
          ctx.arc(transferX + i * 8, transferY, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255, 235, 59, 0.4)";
          ctx.beginPath();
          ctx.arc(transferX + i * 8, transferY, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#ffeb3b";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`e⁻ transfer ×${comp.transferCount}`, transferX, transferY - 18);
      }

      // Bond indicator
      if (bondFormed) {
        ctx.strokeStyle = "rgba(255, 235, 59, 0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(metalAtom.x + 18, metalAtom.y);
        ctx.lineTo(nonmetalAtom.x - 18, nonmetalAtom.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#4caf50";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Ionic Bond Formed!", width / 2, height * 0.72);
      }

      // Info
      const infoY = height * 0.78;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(width * 0.05, infoY, width * 0.9, 65);

      ctx.fillStyle = "#e0e0e0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      if (!ionized) {
        ctx.fillText(`${comp.metal.symbol}: ${comp.metal.shells.join(",")} electrons | ${comp.nonmetal.symbol}: ${comp.nonmetal.shells.join(",")} electrons`, width / 2, infoY + 18);
        ctx.fillStyle = "#aaa";
        ctx.fillText(`Toggle "Ionize" to transfer ${comp.transferCount} electron(s) from ${comp.metal.symbol} to ${comp.nonmetal.symbol}`, width / 2, infoY + 38);
      } else {
        ctx.fillText(`${comp.metal.symbol}${metalCharge}: lost ${comp.transferCount} e⁻ → cation | ${comp.nonmetal.symbol}${nonmetalCharge}: gained ${comp.transferCount} e⁻ → anion`, width / 2, infoY + 18);
        ctx.fillStyle = "#aaa";
        ctx.fillText("The electrostatic attraction between cation and anion forms the ionic bond", width / 2, infoY + 38);
      }
      ctx.fillStyle = "#888";
      ctx.fillText("Metal atoms lose valence electrons; nonmetal atoms gain them to achieve stable octets", width / 2, infoY + 55);
    },
    reset() {
      time = 0;
      initAtoms();
    },
    destroy() {},
    getStateDescription(): string {
      const comp = compounds[Math.round(compoundType)] || compounds[0];
      if (!ionized) {
        return `Ionic bond formation for ${comp.name}: ${comp.metal.symbol} (${comp.metal.shells.join(",")}) and ${comp.nonmetal.symbol} (${comp.nonmetal.shells.join(",")}). Ready for electron transfer. ${comp.metal.symbol} will lose ${comp.transferCount} electron(s) to ${comp.nonmetal.symbol}.`;
      }
      return `Ionic bond formed in ${comp.name}: ${comp.metal.symbol}⁺ (cation) lost ${comp.transferCount} electron(s), ${comp.nonmetal.symbol}⁻ (anion) gained them. The oppositely charged ions attract each other through electrostatic force, forming the ionic bond.`;
    },
    resize(w: number, h: number) {
      width = w;
      height = h;
      initAtoms();
    },
  };

  return engine;
};

export default IonicBond2Factory;
