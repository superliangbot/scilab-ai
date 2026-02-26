import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TWO_PI = Math.PI * 2;

// ─── Element data ───────────────────────────────────────────────────
interface ElementInfo {
  symbol: string;
  name: string;
  electronConfig: number[]; // electrons per shell (2, 8, 8, ...)
  neutrons: number;
}

const ELEMENTS: ElementInfo[] = [
  { symbol: "H",  name: "Hydrogen",   electronConfig: [1],       neutrons: 0 },
  { symbol: "He", name: "Helium",     electronConfig: [2],       neutrons: 2 },
  { symbol: "Li", name: "Lithium",    electronConfig: [2, 1],    neutrons: 4 },
  { symbol: "Be", name: "Beryllium",  electronConfig: [2, 2],    neutrons: 5 },
  { symbol: "B",  name: "Boron",      electronConfig: [2, 3],    neutrons: 6 },
  { symbol: "C",  name: "Carbon",     electronConfig: [2, 4],    neutrons: 6 },
  { symbol: "N",  name: "Nitrogen",   electronConfig: [2, 5],    neutrons: 7 },
  { symbol: "O",  name: "Oxygen",     electronConfig: [2, 6],    neutrons: 8 },
  { symbol: "F",  name: "Fluorine",   electronConfig: [2, 7],    neutrons: 10 },
  { symbol: "Ne", name: "Neon",       electronConfig: [2, 8],    neutrons: 10 },
  { symbol: "Na", name: "Sodium",     electronConfig: [2, 8, 1], neutrons: 12 },
  { symbol: "Mg", name: "Magnesium",  electronConfig: [2, 8, 2], neutrons: 12 },
  { symbol: "Al", name: "Aluminum",   electronConfig: [2, 8, 3], neutrons: 14 },
  { symbol: "Si", name: "Silicon",    electronConfig: [2, 8, 4], neutrons: 14 },
  { symbol: "P",  name: "Phosphorus", electronConfig: [2, 8, 5], neutrons: 16 },
  { symbol: "S",  name: "Sulfur",     electronConfig: [2, 8, 6], neutrons: 16 },
  { symbol: "Cl", name: "Chlorine",   electronConfig: [2, 8, 7], neutrons: 18 },
  { symbol: "Ar", name: "Argon",      electronConfig: [2, 8, 8], neutrons: 22 },
  { symbol: "K",  name: "Potassium",  electronConfig: [2, 8, 8, 1], neutrons: 20 },
  { symbol: "Ca", name: "Calcium",    electronConfig: [2, 8, 8, 2], neutrons: 20 },
];

const StructureOfAnAtomFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("structure-of-an-atom") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let atomicNumber = 6;
  let showOrbits = 1;
  let showLabels = 1;
  let animSpeed = 1;

  // Electron angle offsets (randomized per electron for visual interest)
  let electronOffsets: number[][] = [];

  function getElement(): ElementInfo {
    const idx = Math.max(0, Math.min(ELEMENTS.length - 1, atomicNumber - 1));
    return ELEMENTS[idx];
  }

  function generateOffsets(): void {
    const elem = getElement();
    electronOffsets = [];
    for (let shell = 0; shell < elem.electronConfig.length; shell++) {
      const shellElectrons = elem.electronConfig[shell];
      const offsets: number[] = [];
      for (let e = 0; e < shellElectrons; e++) {
        offsets.push((e / shellElectrons) * TWO_PI + (Math.random() * 0.3 - 0.15));
      }
      electronOffsets.push(offsets);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateOffsets();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    const newZ = Math.round(params.atomicNumber ?? atomicNumber);
    showOrbits = params.showOrbits ?? showOrbits;
    showLabels = params.showLabels ?? showLabels;
    animSpeed = params.animSpeed ?? animSpeed;

    if (newZ !== atomicNumber) {
      atomicNumber = newZ;
      generateOffsets();
    }

    time += step * animSpeed;
  }

  function render(): void {
    if (!ctx) return;
    const elem = getElement();

    // Background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, "#0f1729");
    bgGrad.addColorStop(1, "#060b14");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Structure of an Atom (Bohr Model)", width / 2, 28);

    const cx = width * 0.5;
    const cy = height * 0.48;
    const maxRadius = Math.min(width, height) * 0.36;
    const numShells = elem.electronConfig.length;
    const shellSpacing = maxRadius / (numShells + 0.5);

    // Draw orbit rings
    if (showOrbits >= 0.5) {
      for (let s = 0; s < numShells; s++) {
        const r = shellSpacing * (s + 1);
        ctx.strokeStyle = `rgba(80, 120, 200, ${0.15 + s * 0.05})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);

        // Shell label
        if (showLabels >= 0.5) {
          const shellNames = ["K", "L", "M", "N"];
          ctx.fillStyle = "rgba(120, 160, 230, 0.5)";
          ctx.font = "10px 'Inter', system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${shellNames[s] || `n=${s + 1}`} (${elem.electronConfig[s]}e\u207B)`, cx + r + 2, cy - 8);
        }
      }
    }

    // Draw nucleus
    const nucleusRadius = Math.min(25, 10 + atomicNumber * 0.7);
    const nucleusGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, nucleusRadius * 2);
    nucleusGlow.addColorStop(0, "rgba(255, 100, 50, 0.3)");
    nucleusGlow.addColorStop(1, "rgba(255, 100, 50, 0)");
    ctx.fillStyle = nucleusGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, nucleusRadius * 2, 0, TWO_PI);
    ctx.fill();

    // Draw protons and neutrons in nucleus
    const totalNucleons = atomicNumber + elem.neutrons;
    const nucleonR = Math.min(5, nucleusRadius / Math.sqrt(totalNucleons) * 1.2);
    // Arrange nucleons in a compact cluster
    let nucleonIdx = 0;
    const rings = Math.ceil(Math.sqrt(totalNucleons));
    for (let ring = 0; ring <= rings; ring++) {
      const ringR = ring * nucleonR * 1.6;
      const count = ring === 0 ? 1 : Math.min(Math.floor(TWO_PI * ringR / (nucleonR * 2.2)), totalNucleons - nucleonIdx);
      for (let i = 0; i < count && nucleonIdx < totalNucleons; i++) {
        const angle = (i / count) * TWO_PI + ring * 0.5;
        const nx = cx + Math.cos(angle) * ringR;
        const ny = cy + Math.sin(angle) * ringR;
        const isProton = nucleonIdx < atomicNumber;
        // Draw nucleon
        ctx.beginPath();
        ctx.arc(nx, ny, nucleonR, 0, TWO_PI);
        if (isProton) {
          const pGrad = ctx.createRadialGradient(nx - 1, ny - 1, 0, nx, ny, nucleonR);
          pGrad.addColorStop(0, "#ff6b6b");
          pGrad.addColorStop(1, "#cc3333");
          ctx.fillStyle = pGrad;
        } else {
          const nGrad = ctx.createRadialGradient(nx - 1, ny - 1, 0, nx, ny, nucleonR);
          nGrad.addColorStop(0, "#b0b0b0");
          nGrad.addColorStop(1, "#777777");
          ctx.fillStyle = nGrad;
        }
        ctx.fill();
        nucleonIdx++;
      }
    }

    // Draw electrons
    for (let s = 0; s < numShells; s++) {
      const shellR = shellSpacing * (s + 1);
      const shellElectrons = elem.electronConfig[s];
      const shellSpeed = (1 / (s + 1)) * 1.5; // outer shells orbit slower

      for (let e = 0; e < shellElectrons; e++) {
        const baseAngle = electronOffsets[s]?.[e] ?? (e / shellElectrons) * TWO_PI;
        const angle = baseAngle + time * shellSpeed;
        const ex = cx + Math.cos(angle) * shellR;
        const ey = cy + Math.sin(angle) * shellR;

        // Electron trail
        ctx.strokeStyle = "rgba(80, 160, 255, 0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const trailLen = 0.3;
        for (let t = 0; t <= 10; t++) {
          const ta = angle - trailLen * (t / 10);
          const tx = cx + Math.cos(ta) * shellR;
          const ty = cy + Math.sin(ta) * shellR;
          if (t === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        }
        ctx.stroke();

        // Electron glow
        const eGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10);
        eGlow.addColorStop(0, "rgba(80, 160, 255, 0.5)");
        eGlow.addColorStop(1, "rgba(80, 160, 255, 0)");
        ctx.fillStyle = eGlow;
        ctx.beginPath();
        ctx.arc(ex, ey, 10, 0, TWO_PI);
        ctx.fill();

        // Electron body
        const elGrad = ctx.createRadialGradient(ex - 1, ey - 1, 0, ex, ey, 4);
        elGrad.addColorStop(0, "#8ecbff");
        elGrad.addColorStop(1, "#3b8bdb");
        ctx.fillStyle = elGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, 4, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Info panel
    if (showLabels >= 0.5) {
      const panelX = 14;
      let panelY = height * 0.74;

      // Element card
      ctx.fillStyle = "rgba(20, 30, 60, 0.7)";
      ctx.strokeStyle = "rgba(80, 120, 200, 0.3)";
      ctx.lineWidth = 1;
      const cardW = 180;
      const cardH = 110;
      ctx.fillRect(panelX, panelY - 16, cardW, cardH);
      ctx.strokeRect(panelX, panelY - 16, cardW, cardH);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 28px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(elem.symbol, panelX + 10, panelY + 16);

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "13px 'Inter', system-ui, sans-serif";
      ctx.fillText(elem.name, panelX + 10 + ctx.measureText(elem.symbol).width + 10, panelY + 12);

      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillText(`Atomic Number (Z): ${atomicNumber}`, panelX + 10, panelY + 36);
      ctx.fillText(`Mass Number (A): ${atomicNumber + elem.neutrons}`, panelX + 10, panelY + 52);
      ctx.fillText(`Protons: ${atomicNumber}  Neutrons: ${elem.neutrons}`, panelX + 10, panelY + 68);
      ctx.fillText(`Electrons: ${atomicNumber}`, panelX + 10, panelY + 84);

      // Electron configuration notation
      const configStr = elem.electronConfig.map((n, i) => {
        const shellNames = ["1", "2", "3", "4"];
        return `${shellNames[i]}s${Math.min(n, 2)}` +
          (n > 2 ? ` ${shellNames[i]}p${n - 2}` : "");
      }).join(" ");

      ctx.fillStyle = "#34d399";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Config: ${configStr}`, panelX, panelY + cardH + 8);

      // Legend
      const legendX = width - 120;
      const legendY = height * 0.78;
      ctx.font = "11px 'Inter', system-ui, sans-serif";

      // Proton
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.arc(legendX, legendY, 5, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Proton (+)", legendX + 10, legendY + 4);

      // Neutron
      ctx.fillStyle = "#999999";
      ctx.beginPath();
      ctx.arc(legendX, legendY + 20, 5, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Neutron (0)", legendX + 10, legendY + 24);

      // Electron
      ctx.fillStyle = "#5ba3e6";
      ctx.beginPath();
      ctx.arc(legendX, legendY + 40, 4, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("Electron (\u2212)", legendX + 10, legendY + 44);
    }

    // Time
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    generateOffsets();
  }

  function destroy(): void {
    electronOffsets = [];
  }

  function getStateDescription(): string {
    const elem = getElement();
    return (
      `Atomic Structure (Bohr Model): ${elem.name} (${elem.symbol}), Z=${atomicNumber}, ` +
      `A=${atomicNumber + elem.neutrons}. ${atomicNumber} protons, ${elem.neutrons} neutrons, ` +
      `${atomicNumber} electrons in ${elem.electronConfig.length} shell(s): ` +
      `[${elem.electronConfig.join(", ")}]. The Bohr model shows electrons orbiting the ` +
      `nucleus in quantized shells (K, L, M, N) with max capacities 2, 8, 18, 32. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StructureOfAnAtomFactory;
