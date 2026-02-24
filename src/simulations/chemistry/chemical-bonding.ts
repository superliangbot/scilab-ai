import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Atom data ──────────────────────────────────────────────────────
interface AtomInfo {
  symbol: string;
  name: string;
  atomicNumber: number;
  electronConfig: number[]; // electrons per shell [2, 8, 1] etc.
  valenceElectrons: number;
  electronegativity: number;
  color: string;
  radius: number; // relative display radius
}

const ATOMS: Record<string, AtomInfo> = {
  H: {
    symbol: "H",
    name: "Hydrogen",
    atomicNumber: 1,
    electronConfig: [1],
    valenceElectrons: 1,
    electronegativity: 2.2,
    color: "#e2e8f0",
    radius: 18,
  },
  O: {
    symbol: "O",
    name: "Oxygen",
    atomicNumber: 8,
    electronConfig: [2, 6],
    valenceElectrons: 6,
    electronegativity: 3.44,
    color: "#ef4444",
    radius: 24,
  },
  Na: {
    symbol: "Na",
    name: "Sodium",
    atomicNumber: 11,
    electronConfig: [2, 8, 1],
    valenceElectrons: 1,
    electronegativity: 0.93,
    color: "#a78bfa",
    radius: 30,
  },
  Cl: {
    symbol: "Cl",
    name: "Chlorine",
    atomicNumber: 17,
    electronConfig: [2, 8, 7],
    valenceElectrons: 7,
    electronegativity: 3.16,
    color: "#34d399",
    radius: 26,
  },
};

// ─── Bond configurations ────────────────────────────────────────────
interface BondConfig {
  name: string;
  type: "ionic" | "covalent";
  atoms: string[]; // atom symbols
  description: string;
  sharedElectrons: number; // number of shared pairs for covalent, transferred for ionic
  formula: string;
}

const BOND_CONFIGS: BondConfig[] = [
  {
    name: "Sodium Chloride (NaCl)",
    type: "ionic",
    atoms: ["Na", "Cl"],
    description: "Ionic bond: Na donates 1 electron to Cl.\nElectronegativity difference: 3.16 - 0.93 = 2.23 (>1.7 = ionic)",
    sharedElectrons: 1,
    formula: "Na\u207A Cl\u207B",
  },
  {
    name: "Hydrogen Gas (H\u2082)",
    type: "covalent",
    atoms: ["H", "H"],
    description: "Single covalent bond: 1 shared electron pair.\nEqual electronegativity = pure covalent (nonpolar)",
    sharedElectrons: 1,
    formula: "H\u2013H",
  },
  {
    name: "Oxygen Gas (O\u2082)",
    type: "covalent",
    atoms: ["O", "O"],
    description: "Double covalent bond: 2 shared electron pairs.\nEqual electronegativity = pure covalent (nonpolar)",
    sharedElectrons: 2,
    formula: "O=O",
  },
  {
    name: "Water (H\u2082O)",
    type: "covalent",
    atoms: ["O", "H", "H"],
    description: "Polar covalent bonds: O shares 1 pair with each H.\n\u0394EN = 1.24 (polar covalent). Bond angle: 104.5\u00B0",
    sharedElectrons: 1,
    formula: "H\u2013O\u2013H",
  },
];

// ─── Electron for animation ─────────────────────────────────────────
interface Electron {
  angle: number; // current orbital angle
  shell: number; // which shell (0, 1, 2, ...)
  atomIndex: number; // which atom this belongs to (-1 for shared/transferred)
  speed: number; // angular speed
  isShared: boolean; // part of shared pair
  isTransferred: boolean; // transferred in ionic bond
  originalAtom: number; // original owner
}

// ─── Factory ────────────────────────────────────────────────────────
const ChemicalBondingFactory: SimulationFactory = () => {
  const config = getSimConfig("chemical-bonding") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let bondType = 0;
  let showElectrons = 1;
  let animationSpeed = 1;
  let separation = 1;

  // Atom positions (computed each frame)
  let atomPositions: Array<{ x: number; y: number }> = [];

  // Electron state
  let electrons: Electron[] = [];
  let bondProgress = 0; // 0..1 animation of bond forming

  // ── Helpers ───────────────────────────────────────────────────────
  function getBondConfig(): BondConfig {
    return BOND_CONFIGS[Math.min(Math.max(Math.round(bondType), 0), BOND_CONFIGS.length - 1)];
  }

  function computeAtomPositions() {
    const bc = getBondConfig();
    const cx = W * 0.42;
    const cy = H * 0.40;
    const baseSep = 80 * separation;

    atomPositions = [];

    if (bc.atoms.length === 2) {
      atomPositions.push({ x: cx - baseSep, y: cy });
      atomPositions.push({ x: cx + baseSep, y: cy });
    } else if (bc.atoms.length === 3 && bc.atoms[0] === "O") {
      // Water: O in center, two H at 104.5 degrees
      const bondAngle = 104.5 * (Math.PI / 180);
      atomPositions.push({ x: cx, y: cy }); // O center
      atomPositions.push({
        x: cx - baseSep * Math.sin(bondAngle / 2),
        y: cy + baseSep * Math.cos(bondAngle / 2),
      }); // H left
      atomPositions.push({
        x: cx + baseSep * Math.sin(bondAngle / 2),
        y: cy + baseSep * Math.cos(bondAngle / 2),
      }); // H right
    }
  }

  function initElectrons() {
    electrons = [];
    const bc = getBondConfig();

    for (let ai = 0; ai < bc.atoms.length; ai++) {
      const atomInfo = ATOMS[bc.atoms[ai]];

      for (let si = 0; si < atomInfo.electronConfig.length; si++) {
        const numInShell = atomInfo.electronConfig[si];
        for (let ei = 0; ei < numInShell; ei++) {
          const angle = (ei / numInShell) * Math.PI * 2 + Math.random() * 0.3;
          const baseSpeed = (1.5 + Math.random() * 0.5) * (si === atomInfo.electronConfig.length - 1 ? 0.8 : 1.2);

          electrons.push({
            angle,
            shell: si,
            atomIndex: ai,
            speed: baseSpeed,
            isShared: false,
            isTransferred: false,
            originalAtom: ai,
          });
        }
      }
    }
  }

  function shellRadius(shell: number): number {
    return 18 + shell * 16;
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      computeAtomPositions();
      initElectrons();
      bondProgress = 0;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const newBondType = Math.round(params.bondType ?? bondType);
      showElectrons = Math.round(params.showElectrons ?? showElectrons);
      animationSpeed = params.animationSpeed ?? animationSpeed;
      separation = params.separation ?? separation;

      if (newBondType !== bondType) {
        bondType = newBondType;
        computeAtomPositions();
        initElectrons();
        bondProgress = 0;
      }

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped * animationSpeed;

      computeAtomPositions();

      // Animate bond formation
      bondProgress = Math.min(bondProgress + dtClamped * animationSpeed * 0.3, 1);

      const bc = getBondConfig();

      // Update electron positions
      for (const e of electrons) {
        e.angle += e.speed * dtClamped * animationSpeed;
      }

      // Apply bonding behavior based on bond progress
      if (bondProgress > 0.3) {
        const bp = (bondProgress - 0.3) / 0.7; // normalized 0..1 after initial phase

        if (bc.type === "ionic" && bc.atoms.length === 2) {
          // Ionic: transfer valence electron from atom 0 (Na) to atom 1 (Cl)
          const naAtom = ATOMS[bc.atoms[0]];
          const naOuterShell = naAtom.electronConfig.length - 1;

          for (const e of electrons) {
            if (e.originalAtom === 0 && e.shell === naOuterShell && !e.isTransferred) {
              // This is the Na valence electron - animate transfer
              e.isTransferred = true;
              e.atomIndex = 1; // now orbits Cl
              // Place it in Cl's outer shell
              const clAtom = ATOMS[bc.atoms[1]];
              e.shell = clAtom.electronConfig.length - 1;
              e.speed = 1.0;
            }
          }
        } else if (bc.type === "covalent") {
          // Covalent: mark shared electrons
          // For simplicity, identify valence electrons to share
          let sharedCount = 0;

          if (bc.atoms.length === 2) {
            // Two-atom covalent bond
            for (const e of electrons) {
              if (sharedCount >= bc.sharedElectrons * 2) break;

              const atomInfo = ATOMS[bc.atoms[e.originalAtom]];
              const outerShell = atomInfo.electronConfig.length - 1;

              if (e.shell === outerShell && !e.isShared) {
                // Check if we need more shared electrons from this atom
                const existingSharedFromAtom = electrons.filter(
                  (el) => el.isShared && el.originalAtom === e.originalAtom
                ).length;

                if (existingSharedFromAtom < bc.sharedElectrons) {
                  e.isShared = true;
                  sharedCount++;
                }
              }
            }
          } else if (bc.atoms.length === 3) {
            // Water: O shares 1 electron with each H
            // Mark electrons from O to share with H atoms
            let sharedWithH1 = 0;
            let sharedWithH2 = 0;

            for (const e of electrons) {
              const atomInfo = ATOMS[bc.atoms[e.originalAtom]];
              const outerShell = atomInfo.electronConfig.length - 1;

              if (e.shell === outerShell && !e.isShared) {
                if (e.originalAtom === 0 && sharedWithH1 < 1) {
                  // O electron shared with first H
                  e.isShared = true;
                  sharedWithH1++;
                } else if (e.originalAtom === 0 && sharedWithH1 >= 1 && sharedWithH2 < 1) {
                  e.isShared = true;
                  sharedWithH2++;
                } else if (e.originalAtom === 1 && sharedWithH1 > 0) {
                  const hShared = electrons.filter(
                    (el) => el.isShared && el.originalAtom === 1
                  ).length;
                  if (hShared < 1) {
                    e.isShared = true;
                  }
                } else if (e.originalAtom === 2 && sharedWithH2 > 0) {
                  const hShared = electrons.filter(
                    (el) => el.isShared && el.originalAtom === 2
                  ).length;
                  if (hShared < 1) {
                    e.isShared = true;
                  }
                }
              }
            }
          }
        }
      }
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      const bc = getBondConfig();

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(`Chemical Bonding: ${bc.name}`, W / 2, 28);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        bc.type === "ionic"
          ? "Ionic Bond: Electron transfer between atoms  |  Octet Rule"
          : "Covalent Bond: Electron sharing between atoms  |  Octet Rule",
        W / 2,
        46
      );

      // ── Draw bond line(s) between atoms ─────────────
      if (bondProgress > 0.3) {
        const bp = Math.min((bondProgress - 0.3) / 0.7, 1);

        if (bc.type === "ionic") {
          // Draw ionic bond line (dashed for electrostatic attraction)
          ctx.beginPath();
          ctx.setLineDash([6, 4]);
          ctx.moveTo(atomPositions[0].x, atomPositions[0].y);
          ctx.lineTo(atomPositions[1].x, atomPositions[1].y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${bp * 0.4})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (bc.atoms.length === 2) {
          // Draw covalent bond line(s)
          const midX = (atomPositions[0].x + atomPositions[1].x) / 2;
          const midY = (atomPositions[0].y + atomPositions[1].y) / 2;
          const dx = atomPositions[1].x - atomPositions[0].x;
          const dy = atomPositions[1].y - atomPositions[0].y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len;
          const ny = dx / len;

          for (let bi = 0; bi < bc.sharedElectrons; bi++) {
            const offset = (bi - (bc.sharedElectrons - 1) / 2) * 6;
            ctx.beginPath();
            ctx.moveTo(
              atomPositions[0].x + nx * offset,
              atomPositions[0].y + ny * offset
            );
            ctx.lineTo(
              atomPositions[1].x + nx * offset,
              atomPositions[1].y + ny * offset
            );
            ctx.strokeStyle = `rgba(255, 255, 100, ${bp * 0.6})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        } else if (bc.atoms.length === 3) {
          // Water: bonds from O to each H
          for (let hi = 1; hi <= 2; hi++) {
            ctx.beginPath();
            ctx.moveTo(atomPositions[0].x, atomPositions[0].y);
            ctx.lineTo(atomPositions[hi].x, atomPositions[hi].y);
            ctx.strokeStyle = `rgba(255, 255, 100, ${bp * 0.6})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }

      // ── Draw atoms ──────────────────────────────────
      for (let ai = 0; ai < bc.atoms.length; ai++) {
        const atomInfo = ATOMS[bc.atoms[ai]];
        const pos = atomPositions[ai];

        // Nucleus glow
        const nucGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, atomInfo.radius * 2);
        nucGlow.addColorStop(0, atomInfo.color + "40");
        nucGlow.addColorStop(1, atomInfo.color + "00");
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, atomInfo.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = nucGlow;
        ctx.fill();

        // Nucleus
        const nucGrad = ctx.createRadialGradient(
          pos.x - 3, pos.y - 3, 0,
          pos.x, pos.y, atomInfo.radius
        );
        nucGrad.addColorStop(0, "#ffffff");
        nucGrad.addColorStop(0.3, atomInfo.color);
        nucGrad.addColorStop(1, atomInfo.color + "80");
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, atomInfo.radius, 0, Math.PI * 2);
        ctx.fillStyle = nucGrad;
        ctx.fill();
        ctx.strokeStyle = atomInfo.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Atom symbol
        ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#0a0a1a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(atomInfo.symbol, pos.x, pos.y);
        ctx.textBaseline = "alphabetic";

        // Ionic charge labels
        if (bc.type === "ionic" && bondProgress > 0.5) {
          const chargeBp = Math.min((bondProgress - 0.5) / 0.5, 1);
          ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
          if (ai === 0) {
            ctx.fillStyle = `rgba(167, 139, 250, ${chargeBp})`;
            ctx.fillText("+", pos.x + atomInfo.radius + 5, pos.y - atomInfo.radius);
          } else {
            ctx.fillStyle = `rgba(52, 211, 153, ${chargeBp})`;
            ctx.fillText("\u2013", pos.x + atomInfo.radius + 5, pos.y - atomInfo.radius);
          }
        }

        // Electron shell circles (orbits)
        if (showElectrons) {
          for (let si = 0; si < atomInfo.electronConfig.length; si++) {
            const r = shellRadius(si);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
            ctx.lineWidth = 0.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Atom info label
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText(
          `${atomInfo.name} (Z=${atomInfo.atomicNumber})`,
          pos.x,
          pos.y + atomInfo.radius + shellRadius(atomInfo.electronConfig.length - 1) + 18
        );
        ctx.fillText(
          `EN: ${atomInfo.electronegativity}`,
          pos.x,
          pos.y + atomInfo.radius + shellRadius(atomInfo.electronConfig.length - 1) + 32
        );
      }

      // ── Draw electrons ──────────────────────────────
      if (showElectrons) {
        for (const e of electrons) {
          const atomInfo = ATOMS[bc.atoms[e.originalAtom]];
          let centerX: number, centerY: number;
          let orbitR: number;

          if (e.isTransferred && bc.type === "ionic") {
            // Electron now orbits the target atom
            const targetAtom = ATOMS[bc.atoms[e.atomIndex]];
            centerX = atomPositions[e.atomIndex].x;
            centerY = atomPositions[e.atomIndex].y;
            orbitR = shellRadius(e.shell);
          } else if (e.isShared && bc.type === "covalent") {
            // Shared electrons orbit between two atoms
            if (bc.atoms.length === 2) {
              // Shared pair orbits midpoint with elongated path
              const midX = (atomPositions[0].x + atomPositions[1].x) / 2;
              const midY = (atomPositions[0].y + atomPositions[1].y) / 2;
              const dx = atomPositions[1].x - atomPositions[0].x;
              const dy = atomPositions[1].y - atomPositions[0].y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              // Elliptical orbit around midpoint
              const a = dist * 0.35; // semi-major axis along bond
              const b = 12; // semi-minor axis perpendicular
              const bondAngle = Math.atan2(dy, dx);

              const lx = a * Math.cos(e.angle);
              const ly = b * Math.sin(e.angle);

              // Rotate by bond angle
              centerX = midX + lx * Math.cos(bondAngle) - ly * Math.sin(bondAngle);
              centerY = midY + lx * Math.sin(bondAngle) + ly * Math.cos(bondAngle);
              orbitR = 0; // already computed position
            } else {
              // Water: shared electrons orbit between O and respective H
              // Determine which H this electron is shared with
              let targetH = 1; // default to first H
              if (e.originalAtom === 2) {
                targetH = 2;
              } else if (e.originalAtom === 0) {
                // O electrons: first shared with H1, second with H2
                const oSharedBefore = electrons.filter(
                  (el) => el.isShared && el.originalAtom === 0 && electrons.indexOf(el) < electrons.indexOf(e)
                ).length;
                targetH = oSharedBefore === 0 ? 1 : 2;
              }

              const midX = (atomPositions[0].x + atomPositions[targetH].x) / 2;
              const midY = (atomPositions[0].y + atomPositions[targetH].y) / 2;
              const dx = atomPositions[targetH].x - atomPositions[0].x;
              const dy = atomPositions[targetH].y - atomPositions[0].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const bondAngle = Math.atan2(dy, dx);

              const a = dist * 0.3;
              const b = 10;
              const lx = a * Math.cos(e.angle);
              const ly = b * Math.sin(e.angle);

              centerX = midX + lx * Math.cos(bondAngle) - ly * Math.sin(bondAngle);
              centerY = midY + lx * Math.sin(bondAngle) + ly * Math.cos(bondAngle);
              orbitR = 0;
            }
          } else {
            // Regular electron orbiting its atom
            centerX = atomPositions[e.atomIndex].x;
            centerY = atomPositions[e.atomIndex].y;
            orbitR = shellRadius(e.shell);
          }

          let ex: number, ey: number;
          if (orbitR > 0) {
            ex = centerX + orbitR * Math.cos(e.angle);
            ey = centerY + orbitR * Math.sin(e.angle);
          } else {
            ex = centerX;
            ey = centerY;
          }

          // Draw electron
          const eRadius = 3;

          // Electron glow
          ctx.beginPath();
          ctx.arc(ex, ey, eRadius + 3, 0, Math.PI * 2);
          let glowColor: string;
          if (e.isShared) {
            glowColor = "rgba(255, 255, 100, 0.3)";
          } else if (e.isTransferred) {
            glowColor = "rgba(100, 200, 255, 0.3)";
          } else {
            glowColor = "rgba(100, 150, 255, 0.15)";
          }
          ctx.fillStyle = glowColor;
          ctx.fill();

          // Electron body
          ctx.beginPath();
          ctx.arc(ex, ey, eRadius, 0, Math.PI * 2);
          if (e.isShared) {
            ctx.fillStyle = "#fbbf24"; // gold for shared
          } else if (e.isTransferred) {
            ctx.fillStyle = "#60a5fa"; // blue for transferred
          } else {
            ctx.fillStyle = "#93c5fd"; // default blue
          }
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // ── Info panel (right side) ─────────────────────
      const panelLeft = W * 0.68;
      const panelTop = 70;
      const panelWidth = W - panelLeft - 15;
      const panelHeight = H - 160;

      ctx.fillStyle = "rgba(15, 20, 40, 0.8)";
      ctx.fillRect(panelLeft, panelTop, panelWidth, panelHeight);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(panelLeft, panelTop, panelWidth, panelHeight);

      let infoY = panelTop + 25;
      const infoX = panelLeft + 15;
      const lineH = 18;

      ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText("Bond Information", infoX, infoY);
      infoY += lineH + 5;

      // Bond type
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = bc.type === "ionic" ? "#a78bfa" : "#fbbf24";
      ctx.fillText(`Type: ${bc.type.charAt(0).toUpperCase() + bc.type.slice(1)}`, infoX, infoY);
      infoY += lineH;

      // Formula
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`Formula: ${bc.formula}`, infoX, infoY);
      infoY += lineH;

      // Description (multi-line)
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      const descLines = bc.description.split("\n");
      for (const line of descLines) {
        // Wrap long lines
        const words = line.split(" ");
        let currentLine = "";
        for (const word of words) {
          const testLine = currentLine ? currentLine + " " + word : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > panelWidth - 30 && currentLine) {
            ctx.fillText(currentLine, infoX, infoY);
            infoY += lineH - 3;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          ctx.fillText(currentLine, infoX, infoY);
          infoY += lineH - 3;
        }
      }
      infoY += 10;

      // Atom details
      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("Atom Details:", infoX, infoY);
      infoY += lineH;

      const uniqueAtoms = Array.from(new Set(bc.atoms));
      for (const sym of uniqueAtoms) {
        const atomInfo = ATOMS[sym];
        ctx.font = "11px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = atomInfo.color;
        ctx.fillText(
          `${atomInfo.symbol} - ${atomInfo.name}`,
          infoX,
          infoY
        );
        infoY += lineH - 4;

        ctx.fillStyle = "#64748b";
        ctx.fillText(
          `  Z=${atomInfo.atomicNumber}, Valence e\u207B: ${atomInfo.valenceElectrons}, EN: ${atomInfo.electronegativity}`,
          infoX,
          infoY
        );
        infoY += lineH - 2;

        // Electron configuration
        const configStr = atomInfo.electronConfig.join(", ");
        ctx.fillText(`  Shells: [${configStr}]`, infoX, infoY);
        infoY += lineH;
      }

      infoY += 5;

      // Octet rule info
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#34d399";
      ctx.fillText("Octet Rule:", infoX, infoY);
      infoY += lineH - 2;

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";

      if (bc.type === "ionic") {
        ctx.fillText("Na: 2,8,1 \u2192 loses 1e\u207B \u2192 2,8 (stable octet)", infoX, infoY);
        infoY += lineH - 4;
        ctx.fillText("Cl: 2,8,7 \u2192 gains 1e\u207B \u2192 2,8,8 (stable octet)", infoX, infoY);
      } else if (bondType === 1) {
        ctx.fillText("Each H has 1e\u207B, needs 2 for full shell", infoX, infoY);
        infoY += lineH - 4;
        ctx.fillText("Sharing: each H gets 2e\u207B (stable)", infoX, infoY);
      } else if (bondType === 2) {
        ctx.fillText("Each O has 6 valence e\u207B, needs 8", infoX, infoY);
        infoY += lineH - 4;
        ctx.fillText("Double bond: share 4e\u207B total \u2192 8 each", infoX, infoY);
      } else if (bondType === 3) {
        ctx.fillText("O: 6 valence e\u207B + 2 shared = 8 (octet)", infoX, infoY);
        infoY += lineH - 4;
        ctx.fillText("Each H: 1e\u207B + 1 shared = 2 (full shell)", infoX, infoY);
      }

      // ── Lewis dot structure (simplified) ────────────
      infoY += 20;
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("Lewis Structure:", infoX, infoY);
      infoY += lineH;

      const lewisX = infoX + panelWidth / 2 - 15;
      const lewisY = infoY + 15;
      const dotR = 2.5;
      const lewisSpacing = 30;

      if (bondType === 0) {
        // NaCl ionic
        // Na+
        ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#a78bfa";
        ctx.textAlign = "center";
        ctx.fillText("Na\u207A", lewisX - lewisSpacing, lewisY);
        // Cl- with 8 dots
        ctx.fillStyle = "#34d399";
        ctx.fillText("Cl\u207B", lewisX + lewisSpacing, lewisY);

        // Draw 8 dots around Cl
        for (let di = 0; di < 8; di++) {
          const da = (di / 8) * Math.PI * 2;
          const ddx = Math.cos(da) * 16;
          const ddy = Math.sin(da) * 16;
          ctx.beginPath();
          ctx.arc(lewisX + lewisSpacing + ddx, lewisY + ddy, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#93c5fd";
          ctx.fill();
        }
      } else if (bondType === 1) {
        // H:H
        ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#e2e8f0";
        ctx.textAlign = "center";
        ctx.fillText("H", lewisX - 18, lewisY);
        ctx.fillText("H", lewisX + 18, lewisY);
        // Shared pair (two dots between)
        ctx.beginPath();
        ctx.arc(lewisX - 3, lewisY - 2, dotR, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(lewisX + 3, lewisY - 2, dotR, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
      } else if (bondType === 2) {
        // O::O (double bond)
        ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "center";
        ctx.fillText("O", lewisX - 22, lewisY);
        ctx.fillText("O", lewisX + 22, lewisY);
        // Two shared pairs
        for (let pair = 0; pair < 2; pair++) {
          const yOff = (pair - 0.5) * 8;
          ctx.beginPath();
          ctx.arc(lewisX - 3, lewisY + yOff - 2, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(lewisX + 3, lewisY + yOff - 2, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.fill();
        }
        // Lone pairs on each O
        for (let side = -1; side <= 1; side += 2) {
          const ox = lewisX + side * 22;
          // Top and bottom lone pairs
          for (let lp = 0; lp < 2; lp++) {
            const ly = lewisY + (lp === 0 ? -12 : 10);
            ctx.beginPath();
            ctx.arc(ox + side * 10, ly, dotR, 0, Math.PI * 2);
            ctx.fillStyle = "#93c5fd";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ox + side * 10 + 5, ly, dotR, 0, Math.PI * 2);
            ctx.fillStyle = "#93c5fd";
            ctx.fill();
          }
        }
      } else if (bondType === 3) {
        // H-O-H
        ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ef4444";
        ctx.fillText("O", lewisX, lewisY - 5);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText("H", lewisX - 28, lewisY + 15);
        ctx.fillText("H", lewisX + 28, lewisY + 15);
        // Shared pairs
        for (let side = -1; side <= 1; side += 2) {
          ctx.beginPath();
          ctx.arc(lewisX + side * 12, lewisY + 5, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(lewisX + side * 16, lewisY + 8, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.fill();
        }
        // Lone pairs on O (top)
        for (let lp = 0; lp < 2; lp++) {
          const lx = lewisX + (lp === 0 ? -6 : 6);
          ctx.beginPath();
          ctx.arc(lx, lewisY - 20, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#93c5fd";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(lx, lewisY - 26, dotR, 0, Math.PI * 2);
          ctx.fillStyle = "#93c5fd";
          ctx.fill();
        }
      }

      ctx.textAlign = "left";

      // ── Legend ───────────────────────────────────────
      const legY = H - 65;
      ctx.font = "11px 'Inter', system-ui, sans-serif";

      // Shared electron
      ctx.beginPath();
      ctx.arc(20, legY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Shared e\u207B", 30, legY + 4);

      // Regular electron
      ctx.beginPath();
      ctx.arc(120, legY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#93c5fd";
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Valence e\u207B", 130, legY + 4);

      // Transferred
      ctx.beginPath();
      ctx.arc(230, legY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#60a5fa";
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("Transferred e\u207B", 240, legY + 4);

      // Electronegativity difference
      if (bc.atoms.length >= 2) {
        const en1 = ATOMS[bc.atoms[0]].electronegativity;
        const en2 = ATOMS[bc.atoms[1]].electronegativity;
        const deltaEN = Math.abs(en1 - en2);

        ctx.font = "11px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText(
          `\u0394EN = |${en1.toFixed(2)} - ${en2.toFixed(2)}| = ${deltaEN.toFixed(2)}  ` +
            (deltaEN > 1.7
              ? "(\u2265 1.7: Ionic)"
              : deltaEN > 0.4
                ? "(0.4-1.7: Polar Covalent)"
                : "(\u2264 0.4: Nonpolar Covalent)"),
          20,
          legY + 22
        );
      }

      // Time
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      bondType = config.parameters.find((p) => p.key === "bondType")!.defaultValue;
      showElectrons = config.parameters.find((p) => p.key === "showElectrons")!.defaultValue;
      animationSpeed = config.parameters.find((p) => p.key === "animationSpeed")!.defaultValue;
      separation = config.parameters.find((p) => p.key === "separation")!.defaultValue;
      computeAtomPositions();
      initElectrons();
      bondProgress = 0;
      time = 0;
    },

    destroy() {
      electrons = [];
      atomPositions = [];
    },

    getStateDescription(): string {
      const bc = getBondConfig();
      const uniqueAtoms = Array.from(new Set(bc.atoms));
      const atomDetails = uniqueAtoms
        .map((sym) => {
          const a = ATOMS[sym];
          return `${a.name}(Z=${a.atomicNumber}, EN=${a.electronegativity}, valence=${a.valenceElectrons}e\u207B)`;
        })
        .join(", ");

      const en1 = ATOMS[bc.atoms[0]].electronegativity;
      const en2 = ATOMS[bc.atoms[bc.atoms.length > 1 ? 1 : 0]].electronegativity;
      const deltaEN = Math.abs(en1 - en2);

      return (
        `Chemical Bonding simulation: ${bc.name}. ` +
        `Bond type: ${bc.type} (formula: ${bc.formula}). ` +
        `Atoms: ${atomDetails}. ` +
        `Electronegativity difference: ${deltaEN.toFixed(2)} ` +
        `(${deltaEN > 1.7 ? "ionic" : deltaEN > 0.4 ? "polar covalent" : "nonpolar covalent"}). ` +
        `${bc.description.replace("\n", " ")} ` +
        `Octet rule: atoms tend to gain, lose, or share electrons to achieve 8 valence electrons (noble gas configuration).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
      computeAtomPositions();
    },
  };

  return engine;
};

export default ChemicalBondingFactory;
