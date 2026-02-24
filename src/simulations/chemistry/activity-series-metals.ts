import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Metal data ─────────────────────────────────────────────────────
interface MetalInfo {
  name: string;
  symbol: string;
  ionCharge: number; // e.g. 2 for Zn²⁺, 1 for Ag⁺, 3 for Al³⁺
  ionLabel: string; // e.g. "Cu²⁺"
  plateColor: string; // solid metal color
  solutionColor: string; // ion solution color
  reactivity: number; // higher = more reactive
}

const METALS: MetalInfo[] = [
  // index 0: Zn
  {
    name: "Zinc",
    symbol: "Zn",
    ionCharge: 2,
    ionLabel: "Zn\u00B2\u207A",
    plateColor: "#7b8ea0",
    solutionColor: "rgba(180, 200, 220, 0.35)",
    reactivity: 5,
  },
  // index 1: Cu
  {
    name: "Copper",
    symbol: "Cu",
    ionCharge: 2,
    ionLabel: "Cu\u00B2\u207A",
    plateColor: "#c87533",
    solutionColor: "rgba(60, 130, 220, 0.45)",
    reactivity: 2,
  },
  // index 2: Fe
  {
    name: "Iron",
    symbol: "Fe",
    ionCharge: 2,
    ionLabel: "Fe\u00B2\u207A",
    plateColor: "#5a5a5a",
    solutionColor: "rgba(80, 180, 100, 0.4)",
    reactivity: 4,
  },
  // index 3: Ag
  {
    name: "Silver",
    symbol: "Ag",
    ionCharge: 1,
    ionLabel: "Ag\u207A",
    plateColor: "#d0d0d8",
    solutionColor: "rgba(200, 200, 210, 0.25)",
    reactivity: 1,
  },
  // index 4: Al
  {
    name: "Aluminum",
    symbol: "Al",
    ionCharge: 3,
    ionLabel: "Al\u00B3\u207A",
    plateColor: "#b8c0c8",
    solutionColor: "rgba(200, 210, 220, 0.3)",
    reactivity: 6,
  },
  // index 5: Pb
  {
    name: "Lead",
    symbol: "Pb",
    ionCharge: 2,
    ionLabel: "Pb\u00B2\u207A",
    plateColor: "#4a5568",
    solutionColor: "rgba(160, 170, 190, 0.3)",
    reactivity: 3,
  },
];

// Activity series ordered from most to least reactive
const ACTIVITY_SERIES_ORDER = [4, 0, 2, 5, 1, 3]; // Al, Zn, Fe, Pb, Cu, Ag

// ─── Animated particle types ────────────────────────────────────────
interface Ion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  metalIndex: number;
  alpha: number;
  radius: number;
}

interface DepositParticle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  metalIndex: number;
}

interface DissolveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  metalIndex: number;
}

interface DepositBump {
  x: number;
  y: number;
  radius: number;
  metalIndex: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const ActivitySeriesMetalsFactory: SimulationFactory = () => {
  const config = getSimConfig("activity-series-metals") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // State
  let metalPlateIdx = 0;
  let solutionMetalIdx = 1;
  let speed = 1;
  let reactionOccurs = false;

  // Animated entities
  let ions: Ion[] = [];
  let depositParticles: DepositParticle[] = [];
  let dissolveParticles: DissolveParticle[] = [];
  let depositBumps: DepositBump[] = [];

  // Reaction progress
  let reactionProgress = 0; // 0 to 1
  let plateShrink = 0; // how much the plate has shrunk (0 to 1)
  let solutionColorBlend = 0; // blend from original to new solution color

  // Spawn timers
  let nextDepositTime = 0;
  let nextDissolveTime = 0;

  // ── Layout helpers ──────────────────────────────────────────────
  function beakerBounds() {
    const beakerW = Math.min(W * 0.48, 340);
    const beakerH = Math.min(H * 0.55, 350);
    const left = W * 0.08;
    const top = H * 0.18;
    return {
      left,
      top,
      right: left + beakerW,
      bottom: top + beakerH,
      width: beakerW,
      height: beakerH,
    };
  }

  function plateBounds() {
    const bk = beakerBounds();
    const plateW = 22 - plateShrink * 8;
    const plateH = bk.height * 0.75;
    const cx = bk.left + bk.width * 0.35;
    const top = bk.top - 30;
    return {
      left: cx - plateW / 2,
      right: cx + plateW / 2,
      top,
      bottom: top + plateH,
      width: plateW,
      height: plateH,
      cx,
    };
  }

  function solutionBounds() {
    const bk = beakerBounds();
    // Solution fills ~80% of beaker height
    const solutionTop = bk.top + bk.height * 0.15;
    return {
      left: bk.left + 4,
      right: bk.right - 4,
      top: solutionTop,
      bottom: bk.bottom - 4,
      width: bk.width - 8,
      height: bk.bottom - 4 - solutionTop,
    };
  }

  // ── Chemistry logic ─────────────────────────────────────────────
  function checkReaction(): boolean {
    const plateMetal = METALS[metalPlateIdx];
    const solutionMetal = METALS[solutionMetalIdx];
    return (
      metalPlateIdx !== solutionMetalIdx &&
      plateMetal.reactivity > solutionMetal.reactivity
    );
  }

  function getBalancedEquation(): string {
    if (!reactionOccurs || metalPlateIdx === solutionMetalIdx) {
      return "No reaction";
    }
    const plate = METALS[metalPlateIdx];
    const sol = METALS[solutionMetalIdx];

    // Balance charges: plate dissolves as plate^n+, sol deposits as metal
    // plate + sol^m+ -> plate^n+ + sol
    // Need to balance charges: n * coeff_plate = m * coeff_sol
    const n = plate.ionCharge;
    const m = sol.ionCharge;
    // LCM of n and m
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const lcm = (n * m) / gcd(n, m);
    const coeffPlate = lcm / n;
    const coeffSol = lcm / m;

    const plateCoeff = coeffPlate === 1 ? "" : `${coeffPlate}`;
    const solCoeff = coeffSol === 1 ? "" : `${coeffSol}`;

    // Superscript helper
    const chargeStr = (charge: number): string => {
      if (charge === 1) return "\u207A";
      if (charge === 2) return "\u00B2\u207A";
      if (charge === 3) return "\u00B3\u207A";
      return `${charge}+`;
    };

    return (
      `${plateCoeff}${plate.symbol} + ${solCoeff}${sol.symbol}${chargeStr(sol.ionCharge)}` +
      ` \u2192 ${plateCoeff}${plate.symbol}${chargeStr(plate.ionCharge)} + ${solCoeff}${sol.symbol}`
    );
  }

  // ── Ion management ──────────────────────────────────────────────
  function spawnIons() {
    ions = [];
    const sol = solutionBounds();
    const count = 25;
    for (let i = 0; i < count; i++) {
      ions.push({
        x: sol.left + 20 + Math.random() * (sol.width - 40),
        y: sol.top + 10 + Math.random() * (sol.height - 20),
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 20,
        metalIndex: solutionMetalIdx,
        alpha: 0.7 + Math.random() * 0.3,
        radius: 5 + Math.random() * 3,
      });
    }
  }

  function resetState() {
    time = 0;
    reactionProgress = 0;
    plateShrink = 0;
    solutionColorBlend = 0;
    depositParticles = [];
    dissolveParticles = [];
    depositBumps = [];
    nextDepositTime = 0;
    nextDissolveTime = 0;
    reactionOccurs = checkReaction();
    spawnIons();
  }

  // ── Rendering helpers ───────────────────────────────────────────
  function drawBeaker() {
    const bk = beakerBounds();

    // Beaker body (glass-like)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bk.left, bk.top);
    ctx.lineTo(bk.left - 6, bk.bottom);
    ctx.lineTo(bk.right + 6, bk.bottom);
    ctx.lineTo(bk.right, bk.top);
    ctx.closePath();
    ctx.fillStyle = "rgba(120, 160, 200, 0.06)";
    ctx.fill();

    // Glass edges
    ctx.strokeStyle = "rgba(140, 180, 220, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bk.left, bk.top);
    ctx.lineTo(bk.left - 6, bk.bottom);
    ctx.lineTo(bk.right + 6, bk.bottom);
    ctx.lineTo(bk.right, bk.top);
    ctx.stroke();

    // Pour spout on left
    ctx.beginPath();
    ctx.moveTo(bk.left, bk.top);
    ctx.lineTo(bk.left - 12, bk.top - 8);
    ctx.strokeStyle = "rgba(140, 180, 220, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Beaker measurement lines
    ctx.strokeStyle = "rgba(140, 180, 220, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = bk.top + (bk.height * i) / 5;
      ctx.beginPath();
      ctx.moveTo(bk.left + 4, y);
      ctx.lineTo(bk.left + 16, y);
      ctx.stroke();
    }

    // Glass highlight (left edge reflection)
    const hlGrad = ctx.createLinearGradient(bk.left, 0, bk.left + 12, 0);
    hlGrad.addColorStop(0, "rgba(200, 230, 255, 0.15)");
    hlGrad.addColorStop(1, "rgba(200, 230, 255, 0)");
    ctx.fillStyle = hlGrad;
    ctx.fillRect(bk.left + 1, bk.top + 10, 12, bk.height - 20);

    ctx.restore();
  }

  function drawSolution() {
    const sol = solutionBounds();
    const bk = beakerBounds();

    // Interpolate solution color during reaction
    const originalMetal = METALS[solutionMetalIdx];
    const plateMetal = METALS[metalPlateIdx];

    let solColor: string;
    if (reactionOccurs && solutionColorBlend > 0) {
      // Blend from original solution color toward plate metal's solution color
      solColor = blendSolutionColor(
        originalMetal.solutionColor,
        plateMetal.solutionColor,
        solutionColorBlend * 0.6
      );
    } else {
      solColor = originalMetal.solutionColor;
    }

    // Draw solution with slight trapezoid matching beaker shape
    const topInset = ((sol.top - bk.top) / bk.height) * 6;
    const bottomInset = ((sol.bottom - bk.top) / bk.height) * 6;
    ctx.beginPath();
    ctx.moveTo(bk.left + 3 - topInset, sol.top);
    ctx.lineTo(bk.left + 3 - bottomInset, sol.bottom);
    ctx.lineTo(bk.right - 3 + bottomInset, sol.bottom);
    ctx.lineTo(bk.right - 3 + topInset, sol.top);
    ctx.closePath();
    ctx.fillStyle = solColor;
    ctx.fill();

    // Surface line
    ctx.beginPath();
    ctx.moveTo(bk.left + 3 - topInset, sol.top);
    ctx.lineTo(bk.right - 3 + topInset, sol.top);
    ctx.strokeStyle = "rgba(200, 220, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function blendSolutionColor(
    c1: string,
    c2: string,
    t: number
  ): string {
    // Parse rgba strings and blend
    const parse = (s: string) => {
      const m = s.match(
        /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
      );
      if (!m) return { r: 100, g: 150, b: 200, a: 0.3 };
      return {
        r: parseInt(m[1]),
        g: parseInt(m[2]),
        b: parseInt(m[3]),
        a: m[4] !== undefined ? parseFloat(m[4]) : 1,
      };
    };
    const a = parse(c1);
    const b = parse(c2);
    const lerp = (x: number, y: number, f: number) => x + (y - x) * f;
    return `rgba(${Math.round(lerp(a.r, b.r, t))}, ${Math.round(lerp(a.g, b.g, t))}, ${Math.round(lerp(a.b, b.b, t))}, ${lerp(a.a, b.a, t).toFixed(2)})`;
  }

  function drawIons() {
    const sol = solutionBounds();
    const plate = plateBounds();

    for (const ion of ions) {
      // Skip ions too close behind the plate (for visual clarity)
      const metal = METALS[ion.metalIndex];

      ctx.save();
      ctx.globalAlpha = ion.alpha;

      // Ion circle
      ctx.beginPath();
      ctx.arc(ion.x, ion.y, ion.radius, 0, Math.PI * 2);
      const ionGrad = ctx.createRadialGradient(
        ion.x - 1,
        ion.y - 1,
        0,
        ion.x,
        ion.y,
        ion.radius
      );
      // Use solution color tint for ions
      ionGrad.addColorStop(0, lightenColor(metal.plateColor, 0.5));
      ionGrad.addColorStop(1, metal.plateColor);
      ctx.fillStyle = ionGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Charge label
      ctx.font = "bold 7px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(metal.ionLabel, ion.x, ion.y);

      ctx.restore();
    }
  }

  function lightenColor(hex: string, amount: number): string {
    // Parse hex color and lighten
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, Math.round(r + (255 - r) * amount));
    const lg = Math.min(255, Math.round(g + (255 - g) * amount));
    const lb = Math.min(255, Math.round(b + (255 - b) * amount));
    return `rgb(${lr},${lg},${lb})`;
  }

  function drawPlate() {
    const pl = plateBounds();
    const metal = METALS[metalPlateIdx];
    const sol = solutionBounds();

    // Plate strip
    const plateGrad = ctx.createLinearGradient(pl.left, 0, pl.right, 0);
    plateGrad.addColorStop(0, darkenColor(metal.plateColor, 0.2));
    plateGrad.addColorStop(0.3, lightenColor(metal.plateColor, 0.15));
    plateGrad.addColorStop(0.6, metal.plateColor);
    plateGrad.addColorStop(1, darkenColor(metal.plateColor, 0.3));
    ctx.fillStyle = plateGrad;

    // Draw plate with slight width variation from shrinking
    const shrinkOffset = plateShrink * 3;
    ctx.fillRect(
      pl.left + shrinkOffset,
      pl.top,
      pl.width - shrinkOffset * 2,
      pl.height
    );

    // Metallic highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(pl.left + shrinkOffset + 2, pl.top + 5, 3, pl.height - 10);

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      pl.left + shrinkOffset,
      pl.top,
      pl.width - shrinkOffset * 2,
      pl.height
    );

    // Deposit bumps on the plate (below solution line)
    for (const bump of depositBumps) {
      const bumpMetal = METALS[bump.metalIndex];
      ctx.beginPath();
      ctx.arc(bump.x, bump.y, bump.radius, 0, Math.PI * 2);
      ctx.fillStyle = bumpMetal.plateColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Label above plate
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(`${metal.symbol} plate`, pl.cx, pl.top - 10);
  }

  function darkenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.round(r * (1 - amount));
    const dg = Math.round(g * (1 - amount));
    const db = Math.round(b * (1 - amount));
    return `rgb(${dr},${dg},${db})`;
  }

  function drawDepositParticles() {
    for (const dp of depositParticles) {
      const metal = METALS[dp.metalIndex];
      const x = dp.x + (dp.targetX - dp.x) * dp.progress;
      const y = dp.y + (dp.targetY - dp.y) * dp.progress;
      const alpha = 1 - dp.progress * 0.3;
      const r = 3 * (1 - dp.progress * 0.5);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = metal.plateColor;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = lightenColor(metal.plateColor, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawDissolveParticles() {
    for (const dp of dissolveParticles) {
      const metal = METALS[dp.metalIndex];
      ctx.save();
      ctx.globalAlpha = dp.alpha;
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = lightenColor(metal.plateColor, 0.3);
      ctx.fill();

      // Trailing glow
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 4, 0, Math.PI * 2);
      ctx.strokeStyle = lightenColor(metal.plateColor, 0.5);
      ctx.globalAlpha = dp.alpha * 0.4;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawActivitySeries() {
    const panelW = Math.min(W * 0.22, 170);
    const panelX = W - panelW - 15;
    const panelTop = H * 0.1;
    const itemH = 32;
    const panelH = ACTIVITY_SERIES_ORDER.length * itemH + 50;

    // Panel background
    ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    roundRect(panelX, panelTop, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Activity Series", panelX + panelW / 2, panelTop + 22);

    // Arrow label
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Most \u2192 Least reactive", panelX + panelW / 2, panelTop + 38);

    // List metals
    const listTop = panelTop + 50;
    for (let i = 0; i < ACTIVITY_SERIES_ORDER.length; i++) {
      const mIdx = ACTIVITY_SERIES_ORDER[i];
      const metal = METALS[mIdx];
      const y = listTop + i * itemH;
      const isPlate = mIdx === metalPlateIdx;
      const isSolution = mIdx === solutionMetalIdx;

      // Highlight selected metals
      if (isPlate || isSolution) {
        ctx.fillStyle = isPlate
          ? "rgba(59, 130, 246, 0.2)"
          : "rgba(234, 179, 8, 0.2)";
        roundRect(panelX + 6, y - 2, panelW - 12, itemH - 4, 4);
        ctx.fill();

        // Border
        ctx.strokeStyle = isPlate
          ? "rgba(59, 130, 246, 0.5)"
          : "rgba(234, 179, 8, 0.5)";
        ctx.lineWidth = 1;
        roundRect(panelX + 6, y - 2, panelW - 12, itemH - 4, 4);
        ctx.stroke();
      }

      // Metal color swatch
      ctx.beginPath();
      ctx.arc(panelX + 22, y + itemH / 2 - 3, 6, 0, Math.PI * 2);
      ctx.fillStyle = metal.plateColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Metal name
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = isPlate || isSolution ? "#f1f5f9" : "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText(
        `${metal.symbol} (${metal.name})`,
        panelX + 34,
        y + itemH / 2 - 0
      );

      // Role label
      if (isPlate) {
        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#60a5fa";
        ctx.textAlign = "right";
        ctx.fillText("PLATE", panelX + panelW - 12, y + itemH / 2 - 0);
      } else if (isSolution) {
        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "right";
        ctx.fillText("ION", panelX + panelW - 12, y + itemH / 2 - 0);
      }
    }

    // Arrow along left side
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    const arrowX = panelX + 8;
    const arrowTop = listTop + 6;
    const arrowBottom = listTop + ACTIVITY_SERIES_ORDER.length * itemH - 12;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowTop);
    ctx.lineTo(arrowX, arrowBottom);
    ctx.stroke();
    // Arrow head pointing down
    ctx.beginPath();
    ctx.moveTo(arrowX - 3, arrowBottom - 6);
    ctx.lineTo(arrowX, arrowBottom);
    ctx.lineTo(arrowX + 3, arrowBottom - 6);
    ctx.stroke();
  }

  function roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawEquation() {
    const y = H - 30;
    const equation = getBalancedEquation();

    // Background bar
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(0, H - 55, W, 55);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 55);
    ctx.lineTo(W, H - 55);
    ctx.stroke();

    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Balanced Equation:", W * 0.35, H - 40);

    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    if (reactionOccurs) {
      ctx.fillStyle = "#34d399";
    } else {
      ctx.fillStyle = "#f87171";
    }
    ctx.fillText(equation, W * 0.35, y);

    // Reaction status
    if (reactionOccurs) {
      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#34d399";
      ctx.textAlign = "left";
      ctx.fillText(
        "\u2714 Reaction occurs (more reactive metal displaces less reactive)",
        W * 0.62,
        H - 40
      );
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        `${METALS[metalPlateIdx].symbol} is more reactive than ${METALS[solutionMetalIdx].symbol}`,
        W * 0.62,
        y
      );
    } else if (metalPlateIdx === solutionMetalIdx) {
      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.fillText(
        "Same metal selected for plate and solution",
        W * 0.62,
        H - 32
      );
    } else {
      ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#f87171";
      ctx.textAlign = "left";
      ctx.fillText(
        "\u2718 No reaction",
        W * 0.62,
        H - 40
      );
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        `${METALS[metalPlateIdx].symbol} is less reactive than ${METALS[solutionMetalIdx].symbol}`,
        W * 0.62,
        y
      );
    }
  }

  function drawTitle() {
    ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(
      "Activity Series of Metals \u2014 Single Displacement",
      W * 0.35,
      28
    );

    // Subtitle: solution label
    const solMetal = METALS[solutionMetalIdx];
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `Solution: ${solMetal.ionLabel} (${solMetal.name} ions)`,
      W * 0.35,
      46
    );
  }

  function drawBubbles() {
    if (!reactionOccurs) return;
    const bk = beakerBounds();
    const pl = plateBounds();
    const sol = solutionBounds();

    // Small bubbles rising near the plate during reaction
    const bubbleCount = Math.floor(reactionProgress * 8);
    for (let i = 0; i < bubbleCount; i++) {
      const phase = (time * speed * 2 + i * 1.3) % 3;
      const x = pl.cx + (Math.sin(i * 2.7 + time * 1.5) * 15);
      const y = sol.bottom - phase * (sol.height * 0.4);
      const r = 1.5 + Math.sin(i * 1.1) * 0.8;

      if (y > sol.top && y < sol.bottom) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(200, 230, 255, 0.25)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }

  // ── Engine ─────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      resetState();
    },

    update(dt: number, params: Record<string, number>) {
      const newPlate = Math.round(params.metalPlate ?? metalPlateIdx);
      const newSolution = Math.round(params.solutionMetal ?? solutionMetalIdx);
      const newSpeed = params.speed ?? speed;

      // Detect parameter changes
      if (newPlate !== metalPlateIdx || newSolution !== solutionMetalIdx) {
        metalPlateIdx = newPlate;
        solutionMetalIdx = newSolution;
        resetState();
        speed = newSpeed;
        return;
      }
      speed = newSpeed;

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped * speed;

      const sol = solutionBounds();
      const pl = plateBounds();

      // Update ions (Brownian-like motion)
      for (const ion of ions) {
        // Random walk with drift
        ion.vx += (Math.random() - 0.5) * 40 * dtClamped;
        ion.vy += (Math.random() - 0.5) * 30 * dtClamped;
        // Damping
        ion.vx *= 0.98;
        ion.vy *= 0.98;

        ion.x += ion.vx * dtClamped * speed;
        ion.y += ion.vy * dtClamped * speed;

        // Bounce off solution bounds
        if (ion.x < sol.left + ion.radius) {
          ion.x = sol.left + ion.radius;
          ion.vx = Math.abs(ion.vx);
        }
        if (ion.x > sol.right - ion.radius) {
          ion.x = sol.right - ion.radius;
          ion.vx = -Math.abs(ion.vx);
        }
        if (ion.y < sol.top + ion.radius) {
          ion.y = sol.top + ion.radius;
          ion.vy = Math.abs(ion.vy);
        }
        if (ion.y > sol.bottom - ion.radius) {
          ion.y = sol.bottom - ion.radius;
          ion.vy = -Math.abs(ion.vy);
        }

        // Avoid overlapping with plate
        if (
          ion.x > pl.left - 8 &&
          ion.x < pl.right + 8 &&
          ion.y > pl.top &&
          ion.y < pl.bottom
        ) {
          // Push away from plate
          if (ion.x < pl.cx) {
            ion.x = pl.left - 8 - ion.radius;
            ion.vx = -Math.abs(ion.vx);
          } else {
            ion.x = pl.right + 8 + ion.radius;
            ion.vx = Math.abs(ion.vx);
          }
        }
      }

      // Reaction animation
      if (reactionOccurs) {
        reactionProgress = Math.min(reactionProgress + dtClamped * speed * 0.15, 1);
        plateShrink = reactionProgress * 0.8;
        solutionColorBlend = reactionProgress;

        // Spawn deposit particles (solution ions -> plate)
        if (time > nextDepositTime && reactionProgress < 0.95) {
          nextDepositTime = time + 0.3 / speed;
          const startX =
            pl.cx + (Math.random() - 0.5) * 60 + (Math.random() < 0.5 ? -40 : 40);
          const startY = sol.top + Math.random() * sol.height * 0.8;
          const targetX = pl.left + Math.random() * pl.width;
          const targetY =
            Math.max(sol.top + 10, pl.top + pl.height * 0.3) +
            Math.random() * (pl.height * 0.5);
          depositParticles.push({
            x: startX,
            y: startY,
            targetX,
            targetY,
            progress: 0,
            metalIndex: solutionMetalIdx,
          });
        }

        // Spawn dissolve particles (plate -> solution)
        if (time > nextDissolveTime && reactionProgress < 0.95) {
          nextDissolveTime = time + 0.25 / speed;
          const startX = pl.left + Math.random() * pl.width;
          const startY =
            Math.max(sol.top, pl.top + pl.height * 0.2) +
            Math.random() * (pl.height * 0.5);
          dissolveParticles.push({
            x: startX,
            y: startY,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 40,
            alpha: 1,
            metalIndex: metalPlateIdx,
          });
        }

        // Update deposit particles
        for (let i = depositParticles.length - 1; i >= 0; i--) {
          const dp = depositParticles[i];
          dp.progress += dtClamped * speed * 1.2;
          if (dp.progress >= 1) {
            // Create bump on plate
            depositBumps.push({
              x: dp.targetX,
              y: dp.targetY,
              radius: 2 + Math.random() * 2.5,
              metalIndex: dp.metalIndex,
            });
            depositParticles.splice(i, 1);

            // Remove an ion of the solution metal type
            const ionIdx = ions.findIndex(
              (ion) => ion.metalIndex === solutionMetalIdx
            );
            if (ionIdx >= 0) {
              ions.splice(ionIdx, 1);
            }

            // Add a new ion of the plate metal type
            if (Math.random() < 0.7) {
              ions.push({
                x: pl.cx + (Math.random() - 0.5) * 30,
                y: sol.top + Math.random() * sol.height * 0.5 + sol.height * 0.2,
                vx: (Math.random() - 0.5) * 40,
                vy: (Math.random() - 0.5) * 30,
                metalIndex: metalPlateIdx,
                alpha: 0.7 + Math.random() * 0.3,
                radius: 5 + Math.random() * 3,
              });
            }
          }
        }

        // Update dissolve particles
        for (let i = dissolveParticles.length - 1; i >= 0; i--) {
          const dp = dissolveParticles[i];
          dp.x += dp.vx * dtClamped * speed;
          dp.y += dp.vy * dtClamped * speed;
          dp.alpha -= dtClamped * speed * 0.8;
          if (dp.alpha <= 0) {
            dissolveParticles.splice(i, 1);
          }
        }

        // Cap deposit bumps to avoid visual clutter
        if (depositBumps.length > 35) {
          depositBumps = depositBumps.slice(-35);
        }
      }
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────
      drawTitle();

      // ── Beaker + Solution ───────────────────────
      drawSolution();
      drawBubbles();
      drawBeaker();

      // ── Metal Plate ─────────────────────────────
      drawPlate();

      // ── Ions in solution ────────────────────────
      drawIons();

      // ── Animated particles ──────────────────────
      drawDepositParticles();
      drawDissolveParticles();

      // ── Activity Series Panel ───────────────────
      drawActivitySeries();

      // ── Balanced Equation ───────────────────────
      drawEquation();
    },

    reset() {
      metalPlateIdx =
        config.parameters.find((p) => p.key === "metalPlate")!.defaultValue;
      solutionMetalIdx =
        config.parameters.find((p) => p.key === "solutionMetal")!.defaultValue;
      speed =
        config.parameters.find((p) => p.key === "speed")!.defaultValue;
      resetState();
    },

    destroy() {
      ions = [];
      depositParticles = [];
      dissolveParticles = [];
      depositBumps = [];
    },

    getStateDescription(): string {
      const plate = METALS[metalPlateIdx];
      const sol = METALS[solutionMetalIdx];
      const equation = getBalancedEquation();
      if (reactionOccurs) {
        return (
          `Activity Series simulation: ${plate.symbol} plate dipped in ${sol.ionLabel} solution. ` +
          `Reaction occurs because ${plate.symbol} (reactivity ${plate.reactivity}) is more reactive ` +
          `than ${sol.symbol} (reactivity ${sol.reactivity}). ` +
          `${plate.symbol} dissolves and ${sol.symbol} deposits on the plate. ` +
          `Equation: ${equation}. Reaction progress: ${Math.round(reactionProgress * 100)}%.`
        );
      }
      return (
        `Activity Series simulation: ${plate.symbol} plate dipped in ${sol.ionLabel} solution. ` +
        `No reaction occurs because ${plate.symbol} (reactivity ${plate.reactivity}) is less reactive ` +
        `than ${sol.symbol} (reactivity ${sol.reactivity}). ` +
        `Activity series (most to least): Al > Zn > Fe > Pb > Cu > Ag.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default ActivitySeriesMetalsFactory;
