import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Covalent Bond -- Shows how atoms share electron pairs to form bonds.
 *
 * Displays two atoms with animated orbiting electrons. As atom separation
 * decreases, shared electron pairs become visible oscillating between the
 * nuclei. A Morse/Lennard-Jones-style energy curve shows the potential
 * energy minimum at the equilibrium bond length.
 *
 * Parameters: bondType (H-H, H-F, O-H, N-H), atomSeparation, showOrbitals.
 */

interface BondData {
  label: string;
  atoms: [string, string];
  colors: [string, string];
  radii: [number, number];           // display radii (px, scaled later)
  eNeg: [number, number];
  bondLength: number;                 // Angstroms
  bondEnergy: number;                 // kJ/mol
  sharedPairs: number;
}

const BONDS: BondData[] = [
  { label: "H \u2013 H",  atoms: ["H", "H"],  colors: ["#e2e8f0", "#e2e8f0"], radii: [18, 18], eNeg: [2.20, 2.20], bondLength: 0.74, bondEnergy: 436, sharedPairs: 1 },
  { label: "H \u2013 F",  atoms: ["H", "F"],  colors: ["#e2e8f0", "#4ade80"], radii: [18, 22], eNeg: [2.20, 3.98], bondLength: 0.92, bondEnergy: 568, sharedPairs: 1 },
  { label: "O \u2013 H",  atoms: ["O", "H"],  colors: ["#ef4444", "#e2e8f0"], radii: [24, 18], eNeg: [3.44, 2.20], bondLength: 0.96, bondEnergy: 459, sharedPairs: 1 },
  { label: "N \u2013 H",  atoms: ["N", "H"],  colors: ["#60a5fa", "#e2e8f0"], radii: [22, 18], eNeg: [3.04, 2.20], bondLength: 1.01, bondEnergy: 386, sharedPairs: 1 },
];

interface ElectronDot {
  angle: number;
  speed: number;
  atomIdx: number;        // 0 or 1
  shared: boolean;
  pairId: number;         // which shared pair (for figure-eight path)
}

const CounterclockwiseSign = -1;

const CovalentBondFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("covalent-bond") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let bondType = 0;
  let atomSeparation = 1.0;   // Angstroms
  let showOrbitals = 1;

  let electrons: ElectronDot[] = [];

  // Valence electron counts per bond type atom index
  const VALENCE: Record<string, number> = { H: 1, F: 7, O: 6, N: 5 };

  function bond(): BondData { return BONDS[Math.min(Math.max(Math.round(bondType), 0), BONDS.length - 1)]; }

  function initElectrons() {
    electrons = [];
    const b = bond();
    // Add valence electrons for each atom
    for (let ai = 0; ai < 2; ai++) {
      const nVal = VALENCE[b.atoms[ai]];
      for (let ei = 0; ei < nVal; ei++) {
        const angle = (ei / nVal) * Math.PI * 2 + Math.random() * 0.2;
        electrons.push({
          angle,
          speed: 2.0 + Math.random() * 0.6,
          atomIdx: ai,
          shared: false,
          pairId: -1,
        });
      }
    }
    // Mark shared electrons: one from each atom per shared pair
    let pairId = 0;
    for (let p = 0; p < b.sharedPairs; p++) {
      const e0 = electrons.find(e => e.atomIdx === 0 && !e.shared);
      const e1 = electrons.find(e => e.atomIdx === 1 && !e.shared);
      if (e0) { e0.shared = true; e0.pairId = pairId; }
      if (e1) { e1.shared = true; e1.pairId = pairId; }
      pairId++;
    }
  }

  // Morse potential for energy curve: V(r) = De*(1 - exp(-a*(r-re)))^2 - De
  function morseEnergy(r: number): number {
    const b2 = bond();
    const De = b2.bondEnergy;
    const re = b2.bondLength;
    const a = 2.0;  // width parameter
    const x = 1 - Math.exp(-a * (r - re));
    return De * x * x - De;
  }

  // ---- layout ---------------------------------------------------------
  function atomCenter(): { x: number; y: number } {
    return { x: W * 0.5, y: H * 0.35 };
  }

  function sepPx(): number {
    return atomSeparation * (W * 0.16);
  }

  // ---- engine ---------------------------------------------------------
  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    initElectrons();
  }

  function update(dt: number, params: Record<string, number>): void {
    const nb = Math.round(params.bondType ?? bondType);
    atomSeparation = params.atomSeparation ?? atomSeparation;
    showOrbitals = Math.round(params.showOrbitals ?? showOrbitals);

    if (nb !== bondType) {
      bondType = nb;
      initElectrons();
      time = 0;
    }

    const step = Math.min(dt, 0.04);
    time += step;

    for (const e of electrons) {
      e.angle += e.speed * step * (e.atomIdx === 1 ? CounterclockwiseSign : 1);
    }
  }

  function drawAtom(x: number, y: number, radius: number, color: string, symbol: string) {
    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.2);
    glow.addColorStop(0, color + "35");
    glow.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Nucleus
    const grad = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.2, 0, x, y, radius);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color + "80");
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Symbol
    ctx.font = `bold ${Math.max(12, radius * 0.8)}px system-ui, sans-serif`;
    ctx.fillStyle = "#0a0a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, x, y);
    ctx.textBaseline = "alphabetic";
  }

  function drawElectrons(ax0: number, ay: number, ax1: number) {
    const b2 = bond();
    const orbitR = Math.min(W, H) * 0.065;
    const midX = (ax0 + ax1) / 2;
    const halfSep = (ax1 - ax0) / 2;

    for (const e of electrons) {
      let ex: number, ey: number;

      if (e.shared && atomSeparation < 2.5) {
        // Figure-eight / lemniscate path between two nuclei
        const t = e.angle;
        // Parametric figure-eight centered at midpoint
        const spread = halfSep * 0.7;
        const perpAmp = orbitR * 0.55;
        const offset = e.pairId * 6 - (b2.sharedPairs - 1) * 3;
        ex = midX + spread * Math.cos(t);
        ey = ay + perpAmp * Math.sin(2 * t) + offset;
      } else {
        // Circular orbit around own atom
        const cx = e.atomIdx === 0 ? ax0 : ax1;
        ex = cx + orbitR * Math.cos(e.angle);
        ey = ay + orbitR * Math.sin(e.angle);
      }

      // Electron glow
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fillStyle = e.shared ? "rgba(251,191,36,0.3)" : "rgba(147,197,253,0.2)";
      ctx.fill();

      // Electron dot
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fillStyle = e.shared ? "#fbbf24" : "#93c5fd";
      ctx.fill();
    }
  }

  function drawOrbitals(ax0: number, ay: number, ax1: number) {
    if (!showOrbitals) return;
    const orbitR = Math.min(W, H) * 0.065;

    for (const cx of [ax0, ax1]) {
      ctx.beginPath();
      ctx.arc(cx, ay, orbitR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100,116,139,0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Overlap region shading when close
    if (atomSeparation < 2.0) {
      const overlap = Math.max(0, 1 - atomSeparation / 2.0);
      ctx.save();
      ctx.globalAlpha = overlap * 0.15;
      ctx.beginPath();
      ctx.arc(ax0, ay, orbitR, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ax1, ay, orbitR, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnergyCurve() {
    const b2 = bond();
    const gLeft = W * 0.08;
    const gW = W * 0.84;
    const gTop = H * 0.60;
    const gH = H * 0.33;

    // Background
    ctx.fillStyle = "rgba(10,15,30,0.5)";
    ctx.fillRect(gLeft, gTop, gW, gH);
    ctx.strokeStyle = "rgba(120,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(gLeft, gTop, gW, gH);

    // Title
    ctx.font = `${Math.max(10, W * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Potential Energy vs. Internuclear Distance", gLeft + gW / 2, gTop - 5);

    // Axes labels
    ctx.font = `${Math.max(9, W * 0.012)}px system-ui, sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Distance (\u00c5)", gLeft + gW / 2, gTop + gH + 14);
    ctx.save();
    ctx.translate(gLeft - 10, gTop + gH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Energy (kJ/mol)", 0, 0);
    ctx.restore();

    // Map r in [0.3 .. 3.5] to x, energy to y
    const rMin = 0.3;
    const rMax = 3.5;
    const eMin = -b2.bondEnergy * 1.1;
    const eMax = b2.bondEnergy * 0.5;

    const xFor = (r: number) => gLeft + ((r - rMin) / (rMax - rMin)) * gW;
    const yFor = (e: number) => gTop + gH - ((e - eMin) / (eMax - eMin)) * gH;

    // Zero energy line
    ctx.beginPath();
    ctx.moveTo(gLeft, yFor(0));
    ctx.lineTo(gLeft + gW, yFor(0));
    ctx.strokeStyle = "rgba(100,120,160,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `${Math.max(8, W * 0.011)}px system-ui, sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText("0", gLeft + 2, yFor(0) - 3);

    // Morse curve
    ctx.beginPath();
    let first = true;
    for (let px = 0; px <= gW; px += 2) {
      const r = rMin + (px / gW) * (rMax - rMin);
      let e = morseEnergy(r);
      // Add repulsive wall for very small r
      if (r < b2.bondLength * 0.5) {
        e += 2000 * Math.pow(b2.bondLength / r - 2, 2);
      }
      const x = gLeft + px;
      const y = Math.max(gTop, Math.min(gTop + gH, yFor(e)));
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Mark bond length and energy
    const eqX = xFor(b2.bondLength);
    const eqY = yFor(-b2.bondEnergy);
    ctx.beginPath();
    ctx.arc(eqX, eqY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    // Dashed lines to axes
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.moveTo(eqX, eqY);
    ctx.lineTo(eqX, gTop + gH);
    ctx.moveTo(eqX, eqY);
    ctx.lineTo(gLeft, eqY);
    ctx.strokeStyle = "rgba(251,191,36,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.font = `${Math.max(9, W * 0.012)}px system-ui, sans-serif`;
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.fillText(`${b2.bondLength} \u00c5`, eqX, gTop + gH + 3);
    ctx.textAlign = "right";
    ctx.fillText(`-${b2.bondEnergy}`, gLeft - 2, eqY + 4);

    // Current separation marker
    const curX = xFor(atomSeparation);
    const curE = morseEnergy(atomSeparation) + (atomSeparation < b2.bondLength * 0.5 ? 2000 * Math.pow(b2.bondLength / atomSeparation - 2, 2) : 0);
    const curY = Math.max(gTop, Math.min(gTop + gH, yFor(curE)));
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `${Math.max(9, W * 0.012)}px system-ui, sans-serif`;
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "left";
    ctx.fillText(`r = ${atomSeparation.toFixed(2)} \u00c5`, curX + 8, curY - 4);
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, W, H);

    const b2 = bond();
    const center = atomCenter();
    const half = sepPx() / 2;
    const ax0 = center.x - half;
    const ax1 = center.x + half;
    const scale = Math.min(W, H) / 600;
    const r0 = b2.radii[0] * scale;
    const r1 = b2.radii[1] * scale;

    // Title
    ctx.font = `bold ${Math.max(14, W * 0.022)}px system-ui, sans-serif`;
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(`Covalent Bond: ${b2.label}`, W / 2, 26);

    // Subtitle info
    const dEN = Math.abs(b2.eNeg[0] - b2.eNeg[1]);
    const polarity = dEN < 0.4 ? "Nonpolar" : dEN < 1.7 ? "Polar" : "Ionic";
    ctx.font = `${Math.max(10, W * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      `\u0394EN = ${dEN.toFixed(2)}  |  ${polarity} Covalent  |  Bond Energy: ${b2.bondEnergy} kJ/mol  |  Bond Length: ${b2.bondLength} \u00c5`,
      W / 2, 44,
    );

    // Orbitals
    drawOrbitals(ax0, center.y, ax1);

    // Bond line between atoms when close
    if (atomSeparation < 2.0) {
      const alpha = Math.max(0, 1 - atomSeparation / 2.0) * 0.6;
      ctx.beginPath();
      ctx.moveTo(ax0 + r0, center.y);
      ctx.lineTo(ax1 - r1, center.y);
      ctx.strokeStyle = `rgba(251,191,36,${alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Electrons
    drawElectrons(ax0, center.y, ax1);

    // Atoms (draw on top of electrons)
    drawAtom(ax0, center.y, r0, b2.colors[0], b2.atoms[0]);
    drawAtom(ax1, center.y, r1, b2.colors[1], b2.atoms[1]);

    // Electronegativity labels under atoms
    ctx.font = `${Math.max(9, W * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = b2.colors[0];
    ctx.fillText(`EN: ${b2.eNeg[0]}`, ax0, center.y + r0 + 16);
    ctx.fillStyle = b2.colors[1];
    ctx.fillText(`EN: ${b2.eNeg[1]}`, ax1, center.y + r1 + 16);

    // Partial charge arrows for polar bonds
    if (dEN > 0.4 && atomSeparation < 2.0) {
      const moreNeg = b2.eNeg[0] > b2.eNeg[1] ? 0 : 1;
      const fromX = moreNeg === 0 ? ax1 : ax0;
      const toX = moreNeg === 0 ? ax0 : ax1;
      const arrowY = center.y - Math.max(r0, r1) - 18;
      const alpha = Math.max(0, 1 - atomSeparation / 2.0) * 0.7;

      ctx.beginPath();
      ctx.moveTo(fromX, arrowY);
      ctx.lineTo(toX, arrowY);
      ctx.strokeStyle = `rgba(251,191,36,${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Arrowhead
      const dir = toX > fromX ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(toX, arrowY);
      ctx.lineTo(toX - dir * 7, arrowY - 4);
      ctx.lineTo(toX - dir * 7, arrowY + 4);
      ctx.closePath();
      ctx.fillStyle = `rgba(251,191,36,${alpha})`;
      ctx.fill();

      ctx.font = `${Math.max(10, W * 0.014)}px system-ui, sans-serif`;
      ctx.fillStyle = `rgba(251,191,36,${alpha})`;
      ctx.textAlign = "center";
      ctx.fillText("\u03b4\u207b", moreNeg === 0 ? ax0 : ax1, arrowY - 6);
      ctx.fillText("\u03b4\u207a", moreNeg === 0 ? ax1 : ax0, arrowY - 6);
    }

    // Energy curve
    drawEnergyCurve();

    // Legend
    ctx.font = `${Math.max(9, W * 0.012)}px system-ui, sans-serif`;
    const legY = H - 8;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath(); ctx.arc(W * 0.15, legY - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#94a3b8"; ctx.textAlign = "left";
    ctx.fillText("Shared e\u207b", W * 0.15 + 8, legY);

    ctx.fillStyle = "#93c5fd";
    ctx.beginPath(); ctx.arc(W * 0.35, legY - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Lone e\u207b", W * 0.35 + 8, legY);

    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.arc(W * 0.55, legY - 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Current separation", W * 0.55 + 10, legY);
  }

  function reset(): void {
    time = 0;
    initElectrons();
  }

  function destroy(): void {
    electrons = [];
  }

  function getStateDescription(): string {
    const b2 = bond();
    const dEN = Math.abs(b2.eNeg[0] - b2.eNeg[1]);
    const polarity = dEN < 0.4 ? "nonpolar" : dEN < 1.7 ? "polar" : "ionic character";
    const curE = morseEnergy(atomSeparation);
    return (
      `Covalent Bond: ${b2.label}. Separation: ${atomSeparation.toFixed(2)} \u00c5. ` +
      `Bond length: ${b2.bondLength} \u00c5, bond energy: ${b2.bondEnergy} kJ/mol. ` +
      `Electronegativity: ${b2.atoms[0]}=${b2.eNeg[0]}, ${b2.atoms[1]}=${b2.eNeg[1]}, \u0394EN=${dEN.toFixed(2)} (${polarity}). ` +
      `Current PE: ${curE.toFixed(0)} kJ/mol. ` +
      `Atoms share ${b2.sharedPairs} electron pair(s) in the covalent bond. ` +
      `The energy minimum occurs at the equilibrium bond length where attractive and repulsive forces balance.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CovalentBondFactory;
