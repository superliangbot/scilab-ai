import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Element data ────────────────────────────────────────────────────
interface ElementData {
  number: number;
  symbol: string;
  name: string;
  category: ElementCategory;
}

type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth"
  | "transition-metal"
  | "post-transition"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide";

const CATEGORY_COLORS: Record<ElementCategory, string> = {
  "alkali-metal": "#e74c3c",
  "alkaline-earth": "#e67e22",
  "transition-metal": "#3498db",
  "post-transition": "#1abc9c",
  "metalloid": "#9b59b6",
  "nonmetal": "#2ecc71",
  "halogen": "#f1c40f",
  "noble-gas": "#e84393",
  "lanthanide": "#00b894",
  "actinide": "#6c5ce7",
};

const CATEGORY_LABELS: Record<ElementCategory, string> = {
  "alkali-metal": "Alkali Metal",
  "alkaline-earth": "Alkaline Earth",
  "transition-metal": "Transition Metal",
  "post-transition": "Post-Transition",
  "metalloid": "Metalloid",
  "nonmetal": "Nonmetal",
  "halogen": "Halogen",
  "noble-gas": "Noble Gas",
  "lanthanide": "Lanthanide",
  "actinide": "Actinide",
};

// All 103 elements H through Lr
const ELEMENTS: ElementData[] = [
  { number: 1, symbol: "H", name: "Hydrogen", category: "nonmetal" },
  { number: 2, symbol: "He", name: "Helium", category: "noble-gas" },
  { number: 3, symbol: "Li", name: "Lithium", category: "alkali-metal" },
  { number: 4, symbol: "Be", name: "Beryllium", category: "alkaline-earth" },
  { number: 5, symbol: "B", name: "Boron", category: "metalloid" },
  { number: 6, symbol: "C", name: "Carbon", category: "nonmetal" },
  { number: 7, symbol: "N", name: "Nitrogen", category: "nonmetal" },
  { number: 8, symbol: "O", name: "Oxygen", category: "nonmetal" },
  { number: 9, symbol: "F", name: "Fluorine", category: "halogen" },
  { number: 10, symbol: "Ne", name: "Neon", category: "noble-gas" },
  { number: 11, symbol: "Na", name: "Sodium", category: "alkali-metal" },
  { number: 12, symbol: "Mg", name: "Magnesium", category: "alkaline-earth" },
  { number: 13, symbol: "Al", name: "Aluminium", category: "post-transition" },
  { number: 14, symbol: "Si", name: "Silicon", category: "metalloid" },
  { number: 15, symbol: "P", name: "Phosphorus", category: "nonmetal" },
  { number: 16, symbol: "S", name: "Sulfur", category: "nonmetal" },
  { number: 17, symbol: "Cl", name: "Chlorine", category: "halogen" },
  { number: 18, symbol: "Ar", name: "Argon", category: "noble-gas" },
  { number: 19, symbol: "K", name: "Potassium", category: "alkali-metal" },
  { number: 20, symbol: "Ca", name: "Calcium", category: "alkaline-earth" },
  { number: 21, symbol: "Sc", name: "Scandium", category: "transition-metal" },
  { number: 22, symbol: "Ti", name: "Titanium", category: "transition-metal" },
  { number: 23, symbol: "V", name: "Vanadium", category: "transition-metal" },
  { number: 24, symbol: "Cr", name: "Chromium", category: "transition-metal" },
  { number: 25, symbol: "Mn", name: "Manganese", category: "transition-metal" },
  { number: 26, symbol: "Fe", name: "Iron", category: "transition-metal" },
  { number: 27, symbol: "Co", name: "Cobalt", category: "transition-metal" },
  { number: 28, symbol: "Ni", name: "Nickel", category: "transition-metal" },
  { number: 29, symbol: "Cu", name: "Copper", category: "transition-metal" },
  { number: 30, symbol: "Zn", name: "Zinc", category: "transition-metal" },
  { number: 31, symbol: "Ga", name: "Gallium", category: "post-transition" },
  { number: 32, symbol: "Ge", name: "Germanium", category: "metalloid" },
  { number: 33, symbol: "As", name: "Arsenic", category: "metalloid" },
  { number: 34, symbol: "Se", name: "Selenium", category: "nonmetal" },
  { number: 35, symbol: "Br", name: "Bromine", category: "halogen" },
  { number: 36, symbol: "Kr", name: "Krypton", category: "noble-gas" },
  { number: 37, symbol: "Rb", name: "Rubidium", category: "alkali-metal" },
  { number: 38, symbol: "Sr", name: "Strontium", category: "alkaline-earth" },
  { number: 39, symbol: "Y", name: "Yttrium", category: "transition-metal" },
  { number: 40, symbol: "Zr", name: "Zirconium", category: "transition-metal" },
  { number: 41, symbol: "Nb", name: "Niobium", category: "transition-metal" },
  { number: 42, symbol: "Mo", name: "Molybdenum", category: "transition-metal" },
  { number: 43, symbol: "Tc", name: "Technetium", category: "transition-metal" },
  { number: 44, symbol: "Ru", name: "Ruthenium", category: "transition-metal" },
  { number: 45, symbol: "Rh", name: "Rhodium", category: "transition-metal" },
  { number: 46, symbol: "Pd", name: "Palladium", category: "transition-metal" },
  { number: 47, symbol: "Ag", name: "Silver", category: "transition-metal" },
  { number: 48, symbol: "Cd", name: "Cadmium", category: "transition-metal" },
  { number: 49, symbol: "In", name: "Indium", category: "post-transition" },
  { number: 50, symbol: "Sn", name: "Tin", category: "post-transition" },
  { number: 51, symbol: "Sb", name: "Antimony", category: "metalloid" },
  { number: 52, symbol: "Te", name: "Tellurium", category: "metalloid" },
  { number: 53, symbol: "I", name: "Iodine", category: "halogen" },
  { number: 54, symbol: "Xe", name: "Xenon", category: "noble-gas" },
  { number: 55, symbol: "Cs", name: "Caesium", category: "alkali-metal" },
  { number: 56, symbol: "Ba", name: "Barium", category: "alkaline-earth" },
  { number: 57, symbol: "La", name: "Lanthanum", category: "lanthanide" },
  { number: 58, symbol: "Ce", name: "Cerium", category: "lanthanide" },
  { number: 59, symbol: "Pr", name: "Praseodymium", category: "lanthanide" },
  { number: 60, symbol: "Nd", name: "Neodymium", category: "lanthanide" },
  { number: 61, symbol: "Pm", name: "Promethium", category: "lanthanide" },
  { number: 62, symbol: "Sm", name: "Samarium", category: "lanthanide" },
  { number: 63, symbol: "Eu", name: "Europium", category: "lanthanide" },
  { number: 64, symbol: "Gd", name: "Gadolinium", category: "lanthanide" },
  { number: 65, symbol: "Tb", name: "Terbium", category: "lanthanide" },
  { number: 66, symbol: "Dy", name: "Dysprosium", category: "lanthanide" },
  { number: 67, symbol: "Ho", name: "Holmium", category: "lanthanide" },
  { number: 68, symbol: "Er", name: "Erbium", category: "lanthanide" },
  { number: 69, symbol: "Tm", name: "Thulium", category: "lanthanide" },
  { number: 70, symbol: "Yb", name: "Ytterbium", category: "lanthanide" },
  { number: 71, symbol: "Lu", name: "Lutetium", category: "lanthanide" },
  { number: 72, symbol: "Hf", name: "Hafnium", category: "transition-metal" },
  { number: 73, symbol: "Ta", name: "Tantalum", category: "transition-metal" },
  { number: 74, symbol: "W", name: "Tungsten", category: "transition-metal" },
  { number: 75, symbol: "Re", name: "Rhenium", category: "transition-metal" },
  { number: 76, symbol: "Os", name: "Osmium", category: "transition-metal" },
  { number: 77, symbol: "Ir", name: "Iridium", category: "transition-metal" },
  { number: 78, symbol: "Pt", name: "Platinum", category: "transition-metal" },
  { number: 79, symbol: "Au", name: "Gold", category: "transition-metal" },
  { number: 80, symbol: "Hg", name: "Mercury", category: "transition-metal" },
  { number: 81, symbol: "Tl", name: "Thallium", category: "post-transition" },
  { number: 82, symbol: "Pb", name: "Lead", category: "post-transition" },
  { number: 83, symbol: "Bi", name: "Bismuth", category: "post-transition" },
  { number: 84, symbol: "Po", name: "Polonium", category: "post-transition" },
  { number: 85, symbol: "At", name: "Astatine", category: "halogen" },
  { number: 86, symbol: "Rn", name: "Radon", category: "noble-gas" },
  { number: 87, symbol: "Fr", name: "Francium", category: "alkali-metal" },
  { number: 88, symbol: "Ra", name: "Radium", category: "alkaline-earth" },
  { number: 89, symbol: "Ac", name: "Actinium", category: "actinide" },
  { number: 90, symbol: "Th", name: "Thorium", category: "actinide" },
  { number: 91, symbol: "Pa", name: "Protactinium", category: "actinide" },
  { number: 92, symbol: "U", name: "Uranium", category: "actinide" },
  { number: 93, symbol: "Np", name: "Neptunium", category: "actinide" },
  { number: 94, symbol: "Pu", name: "Plutonium", category: "actinide" },
  { number: 95, symbol: "Am", name: "Americium", category: "actinide" },
  { number: 96, symbol: "Cm", name: "Curium", category: "actinide" },
  { number: 97, symbol: "Bk", name: "Berkelium", category: "actinide" },
  { number: 98, symbol: "Cf", name: "Californium", category: "actinide" },
  { number: 99, symbol: "Es", name: "Einsteinium", category: "actinide" },
  { number: 100, symbol: "Fm", name: "Fermium", category: "actinide" },
  { number: 101, symbol: "Md", name: "Mendelevium", category: "actinide" },
  { number: 102, symbol: "No", name: "Nobelium", category: "actinide" },
  { number: 103, symbol: "Lr", name: "Lawrencium", category: "actinide" },
];

// ─── Periodic table layout (row, col) for mini reference ─────────────
// Standard 18-column layout; row/col are 0-indexed
const PT_LAYOUT: Record<number, [number, number]> = {
  1: [0, 0], 2: [0, 17],
  3: [1, 0], 4: [1, 1], 5: [1, 12], 6: [1, 13], 7: [1, 14], 8: [1, 15], 9: [1, 16], 10: [1, 17],
  11: [2, 0], 12: [2, 1], 13: [2, 12], 14: [2, 13], 15: [2, 14], 16: [2, 15], 17: [2, 16], 18: [2, 17],
  19: [3, 0], 20: [3, 1],
  21: [3, 2], 22: [3, 3], 23: [3, 4], 24: [3, 5], 25: [3, 6], 26: [3, 7], 27: [3, 8], 28: [3, 9],
  29: [3, 10], 30: [3, 11], 31: [3, 12], 32: [3, 13], 33: [3, 14], 34: [3, 15], 35: [3, 16], 36: [3, 17],
  37: [4, 0], 38: [4, 1],
  39: [4, 2], 40: [4, 3], 41: [4, 4], 42: [4, 5], 43: [4, 6], 44: [4, 7], 45: [4, 8], 46: [4, 9],
  47: [4, 10], 48: [4, 11], 49: [4, 12], 50: [4, 13], 51: [4, 14], 52: [4, 15], 53: [4, 16], 54: [4, 17],
  55: [5, 0], 56: [5, 1],
  72: [5, 3], 73: [5, 4], 74: [5, 5], 75: [5, 6], 76: [5, 7], 77: [5, 8], 78: [5, 9],
  79: [5, 10], 80: [5, 11], 81: [5, 12], 82: [5, 13], 83: [5, 14], 84: [5, 15], 85: [5, 16], 86: [5, 17],
  87: [6, 0], 88: [6, 1],
  // Lanthanides row
  57: [8, 2], 58: [8, 3], 59: [8, 4], 60: [8, 5], 61: [8, 6], 62: [8, 7], 63: [8, 8],
  64: [8, 9], 65: [8, 10], 66: [8, 11], 67: [8, 12], 68: [8, 13], 69: [8, 14], 70: [8, 15], 71: [8, 16],
  // Actinides row
  89: [9, 2], 90: [9, 3], 91: [9, 4], 92: [9, 5], 93: [9, 6], 94: [9, 7], 95: [9, 8],
  96: [9, 9], 97: [9, 10], 98: [9, 11], 99: [9, 12], 100: [9, 13], 101: [9, 14], 102: [9, 15], 103: [9, 16],
};

// ─── Bubble type ─────────────────────────────────────────────────────
interface GameBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  element: ElementData;
  isTarget: boolean;
  alpha: number;
  wobblePhase: number;
  matched: boolean;
  missed: boolean;
}

// ─── Burst particle ──────────────────────────────────────────────────
interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
}

// ─── Factory ─────────────────────────────────────────────────────────
const ElementGameFactory: SimulationFactory = () => {
  const config = getSimConfig("element-game") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Game state
  let bubbles: GameBubble[] = [];
  let bursts: BurstParticle[] = [];
  let targetElement: ElementData = ELEMENTS[0];
  let score = 0;
  let misses = 0;
  let targetTimer = 0;
  let spawnTimer = 0;
  let lastHighlightedNumber = -1;

  // Parameters (cached)
  let difficulty = 1;
  let elementRange = 1;
  let speed = 1;
  let showNames = 1;

  // Match zone (horizontal band where auto-matching occurs)
  const MATCH_ZONE_FRAC_TOP = 0.18;
  const MATCH_ZONE_FRAC_BOTTOM = 0.28;

  // Periodic table area
  const PT_RIGHT_MARGIN = 10;
  const PT_CELL_SIZE = 10;

  // ── Helpers ────────────────────────────────────────────────────────
  function getElementPool(): ElementData[] {
    if (elementRange <= 1) return ELEMENTS.slice(0, 20);
    if (elementRange <= 2) return ELEMENTS.slice(0, 50);
    return ELEMENTS.slice(0, 103);
  }

  function pickRandomElement(): ElementData {
    const pool = getElementPool();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickNewTarget(): void {
    const pool = getElementPool();
    let next: ElementData;
    do {
      next = pool[Math.floor(Math.random() * pool.length)];
    } while (next.number === targetElement.number && pool.length > 1);
    targetElement = next;
    targetTimer = 0;
  }

  function getSpawnInterval(): number {
    // More bubbles at higher difficulty
    const base = difficulty <= 1 ? 1.8 : difficulty <= 2 ? 1.2 : 0.7;
    return base / speed;
  }

  function getTargetDuration(): number {
    // How long before target changes
    const base = difficulty <= 1 ? 8 : difficulty <= 2 ? 6 : 4;
    return base / speed;
  }

  function getBubbleSpeed(): number {
    const base = difficulty <= 1 ? 40 : difficulty <= 2 ? 55 : 75;
    return base * speed;
  }

  function getPlayAreaWidth(): number {
    // Reserve right side for periodic table
    return Math.max(W * 0.7, W - 220);
  }

  function spawnBubble(): void {
    const playW = getPlayAreaWidth();
    const radius = 22 + Math.random() * 8;
    const x = radius + Math.random() * (playW - 2 * radius);
    const y = H + radius;
    const vy = -getBubbleSpeed();
    const vx = (Math.random() - 0.5) * 20;

    // Decide element: ~30% chance it's the target at easy, less at hard
    const targetChance = difficulty <= 1 ? 0.35 : difficulty <= 2 ? 0.25 : 0.18;
    const element = Math.random() < targetChance ? targetElement : pickRandomElement();

    bubbles.push({
      x,
      y,
      vx,
      vy,
      radius,
      element,
      isTarget: element.number === targetElement.number,
      alpha: 1,
      wobblePhase: Math.random() * Math.PI * 2,
      matched: false,
      missed: false,
    });
  }

  function createBurst(x: number, y: number, color: string): void {
    const count = 16 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = 60 + Math.random() * 120;
      bursts.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        radius: 2 + Math.random() * 3,
        color,
        alpha: 1,
        life: 0.6 + Math.random() * 0.4,
      });
    }
  }

  function matchZoneTop(): number {
    return H * MATCH_ZONE_FRAC_TOP;
  }

  function matchZoneBottom(): number {
    return H * MATCH_ZONE_FRAC_BOTTOM;
  }

  function initGame(): void {
    bubbles = [];
    bursts = [];
    score = 0;
    misses = 0;
    time = 0;
    targetTimer = 0;
    spawnTimer = 0;
    lastHighlightedNumber = -1;
    targetElement = pickRandomElement();
  }

  // ── Engine ─────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initGame();
    },

    update(dt: number, params: Record<string, number>) {
      difficulty = Math.round(params.difficulty ?? 1);
      elementRange = Math.round(params.elementRange ?? 1);
      speed = params.speed ?? 1;
      showNames = Math.round(params.showNames ?? 1);

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      // Target cycling timer
      targetTimer += dtClamped;
      if (targetTimer >= getTargetDuration()) {
        pickNewTarget();
        // Update isTarget flags on existing bubbles
        for (const b of bubbles) {
          b.isTarget = b.element.number === targetElement.number;
        }
      }

      // Spawn timer
      spawnTimer += dtClamped;
      if (spawnTimer >= getSpawnInterval()) {
        spawnBubble();
        spawnTimer = 0;
      }

      const mzTop = matchZoneTop();
      const mzBottom = matchZoneBottom();

      // Update bubbles
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];

        if (b.matched || b.missed) {
          // Fade out
          b.alpha -= dtClamped * 3;
          if (b.alpha <= 0) {
            bubbles.splice(i, 1);
          }
          continue;
        }

        // Float upward
        b.y += b.vy * dtClamped;
        b.x += b.vx * dtClamped;
        b.wobblePhase += dtClamped * 3;

        // Horizontal wobble
        b.x += Math.sin(b.wobblePhase) * 0.3;

        // Grow slightly as they rise
        b.radius += dtClamped * 1.5;

        // Keep within horizontal play area
        const playW = getPlayAreaWidth();
        if (b.x - b.radius < 0) {
          b.x = b.radius;
          b.vx = Math.abs(b.vx);
        }
        if (b.x + b.radius > playW) {
          b.x = playW - b.radius;
          b.vx = -Math.abs(b.vx);
        }

        // Check if bubble is in the match zone
        const centerY = b.y;
        if (centerY >= mzTop && centerY <= mzBottom) {
          // Check if isTarget needs refreshing (in case target changed)
          b.isTarget = b.element.number === targetElement.number;

          if (b.isTarget) {
            // Auto-match: pop the bubble
            b.matched = true;
            score++;
            lastHighlightedNumber = b.element.number;
            const color = CATEGORY_COLORS[b.element.category];
            createBurst(b.x, b.y, color);
          }
        }

        // Bubble escaped off the top
        if (b.y + b.radius < -10) {
          if (b.isTarget) {
            misses++;
            b.missed = true;
          }
          bubbles.splice(i, 1);
        }
      }

      // Update burst particles
      for (let i = bursts.length - 1; i >= 0; i--) {
        const p = bursts[i];
        p.x += p.vx * dtClamped;
        p.y += p.vy * dtClamped;
        p.vy += 120 * dtClamped; // gravity on particles
        p.life -= dtClamped;
        p.alpha = Math.max(0, p.life / 0.8);
        p.radius *= (1 - dtClamped * 1.5);

        if (p.life <= 0) {
          bursts.splice(i, 1);
        }
      }
    },

    render() {
      if (!ctx) return;

      const playW = getPlayAreaWidth();
      const mzTop = matchZoneTop();
      const mzBottom = matchZoneBottom();

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1e");
      bgGrad.addColorStop(0.5, "#0d1028");
      bgGrad.addColorStop(1, "#0a0a1e");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Match zone band ─────────────────────────────
      const mzGrad = ctx.createLinearGradient(0, mzTop, 0, mzBottom);
      mzGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
      mzGrad.addColorStop(0.3, "rgba(56, 189, 248, 0.08)");
      mzGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.12)");
      mzGrad.addColorStop(0.7, "rgba(56, 189, 248, 0.08)");
      mzGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = mzGrad;
      ctx.fillRect(0, mzTop, playW, mzBottom - mzTop);

      // Match zone borders
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
      ctx.lineWidth = 1;
      ctx.moveTo(0, mzTop);
      ctx.lineTo(playW, mzTop);
      ctx.moveTo(0, mzBottom);
      ctx.lineTo(playW, mzBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Match zone label
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(56, 189, 248, 0.5)";
      ctx.textAlign = "left";
      ctx.fillText("MATCH ZONE", 8, mzTop + 14);

      // ── Target display ──────────────────────────────
      const targetColor = CATEGORY_COLORS[targetElement.category];
      const targetY = 36;

      ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Find:", playW / 2 - 80, targetY);

      // Target element box
      const boxX = playW / 2 - 40;
      const boxW = 160;
      const boxH = 36;
      const boxY = targetY - 24;

      ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
      ctx.strokeStyle = targetColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      // Pulsing glow on target box
      const pulse = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.shadowColor = targetColor;
      ctx.shadowBlur = 8 + 6 * pulse;
      ctx.strokeStyle = targetColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = targetColor;
      ctx.textAlign = "center";
      ctx.fillText(
        `${targetElement.name} (${targetElement.symbol})`,
        boxX + boxW / 2,
        boxY + boxH / 2 + 6
      );

      // ── Score display ───────────────────────────────
      ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#34d399";
      ctx.fillText(`Matched: ${score}`, 12, H - 18);
      ctx.fillStyle = "#f87171";
      ctx.fillText(`Missed: ${misses}`, 130, H - 18);

      const total = score + misses;
      const accuracy = total > 0 ? ((score / total) * 100).toFixed(0) : "---";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`Accuracy: ${accuracy}%`, 240, H - 18);

      // Difficulty label
      const diffLabel = difficulty <= 1 ? "Easy" : difficulty <= 2 ? "Medium" : "Hard";
      const rangeLabel = elementRange <= 1 ? "1-20" : elementRange <= 2 ? "1-50" : "1-103";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "right";
      ctx.fillText(`Difficulty: ${diffLabel} | Elements: ${rangeLabel} | Speed: ${speed}\u00d7`, playW - 8, H - 18);

      // ── Bubbles ─────────────────────────────────────
      for (const b of bubbles) {
        if (b.alpha <= 0) continue;

        ctx.globalAlpha = b.alpha;
        const color = CATEGORY_COLORS[b.element.category];

        // Bubble body - gradient sphere effect
        const grad = ctx.createRadialGradient(
          b.x - b.radius * 0.25,
          b.y - b.radius * 0.3,
          b.radius * 0.1,
          b.x,
          b.y,
          b.radius
        );
        grad.addColorStop(0, "rgba(255, 255, 255, 0.3)");
        grad.addColorStop(0.3, color + "cc");
        grad.addColorStop(0.7, color + "88");
        grad.addColorStop(1, color + "22");

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Bubble outline
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Highlight ring if in match zone and is target
        const mTop = matchZoneTop();
        const mBot = matchZoneBottom();
        if (b.isTarget && b.y >= mTop && b.y <= mBot && !b.matched) {
          const flashAlpha = 0.5 + 0.5 * Math.sin(time * 10);
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Atomic number (top-left of bubble)
        ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.textAlign = "left";
        ctx.fillText(String(b.element.number), b.x - b.radius + 5, b.y - b.radius + 12);

        // Element symbol (centered, large)
        ctx.font = `bold ${Math.round(b.radius * 0.7)}px 'Inter', system-ui, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.element.symbol, b.x, b.y - 2);
        ctx.textBaseline = "alphabetic";

        // Element name (below symbol, smaller)
        if (showNames >= 1 && b.radius > 20) {
          ctx.font = "9px 'Inter', system-ui, sans-serif";
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.textAlign = "center";
          ctx.fillText(b.element.name, b.x, b.y + b.radius * 0.5);
        }

        ctx.globalAlpha = 1;
      }

      // ── Burst particles ─────────────────────────────
      for (const p of bursts) {
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Mini Periodic Table (right side) ────────────
      const ptAreaX = playW + 10;
      const ptAreaY = 10;
      const availPtW = W - ptAreaX - PT_RIGHT_MARGIN;
      const cellSize = Math.min(PT_CELL_SIZE, Math.floor(availPtW / 18));
      const ptW = cellSize * 18;
      const ptH = cellSize * 10;

      // Background for periodic table area
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(ptAreaX - 4, ptAreaY - 4, ptW + 12, ptH + 36, 6);
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(ptAreaX - 4, ptAreaY - 4, ptW + 12, ptH + 36, 6);
      ctx.stroke();

      // Title
      ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText("Periodic Table", ptAreaX, ptAreaY + 8);

      const ptStartY = ptAreaY + 14;

      // Draw element cells
      const pool = getElementPool();
      const poolNumbers = new Set(pool.map((e) => e.number));

      for (const el of ELEMENTS) {
        const layout = PT_LAYOUT[el.number];
        if (!layout) continue;

        const [row, col] = layout;
        const cx = ptAreaX + 2 + col * cellSize;
        const cy = ptStartY + row * cellSize;

        const inPool = poolNumbers.has(el.number);
        const isTarget = el.number === targetElement.number;
        const isLastMatched = el.number === lastHighlightedNumber;

        if (!inPool) {
          // Dimmed out
          ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
          ctx.fillRect(cx, cy, cellSize - 1, cellSize - 1);
          continue;
        }

        const elColor = CATEGORY_COLORS[el.category];

        if (isTarget) {
          // Highlight target on periodic table
          const flashAlpha = 0.6 + 0.4 * Math.sin(time * 6);
          ctx.fillStyle = elColor;
          ctx.globalAlpha = flashAlpha;
          ctx.fillRect(cx, cy, cellSize - 1, cellSize - 1);
          ctx.globalAlpha = 1;
        } else if (isLastMatched) {
          // Recently matched: bright
          ctx.fillStyle = elColor + "bb";
          ctx.fillRect(cx, cy, cellSize - 1, cellSize - 1);
        } else {
          ctx.fillStyle = elColor + "55";
          ctx.fillRect(cx, cy, cellSize - 1, cellSize - 1);
        }

        // Symbol text (only if cell is large enough)
        if (cellSize >= 10) {
          ctx.font = `bold ${Math.max(6, cellSize - 4)}px 'Inter', system-ui, sans-serif`;
          ctx.fillStyle = isTarget ? "#ffffff" : "rgba(255, 255, 255, 0.7)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(el.symbol, cx + (cellSize - 1) / 2, cy + (cellSize - 1) / 2);
          ctx.textBaseline = "alphabetic";
        }
      }

      // ── Category legend (below periodic table) ──────
      const legendY = ptStartY + ptH + 10;
      const legendX = ptAreaX;
      ctx.font = "7px 'Inter', system-ui, sans-serif";
      let legendRow = 0;
      let legendCol = 0;
      const legendColW = Math.floor(ptW / 2);

      for (const cat of Object.keys(CATEGORY_COLORS) as ElementCategory[]) {
        const lx = legendX + legendCol * legendColW;
        const ly = legendY + legendRow * 10;

        ctx.fillStyle = CATEGORY_COLORS[cat];
        ctx.fillRect(lx, ly, 6, 6);

        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "left";
        ctx.fillText(CATEGORY_LABELS[cat], lx + 8, ly + 6);

        legendCol++;
        if (legendCol >= 2) {
          legendCol = 0;
          legendRow++;
        }
      }

      // ── Separator line between play area and PT ─────
      ctx.beginPath();
      ctx.moveTo(playW + 2, 0);
      ctx.lineTo(playW + 2, H);
      ctx.strokeStyle = "rgba(51, 65, 85, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText(
        "Element Symbol Game \u2014 Bubbles auto-match in the match zone",
        playW / 2,
        H - 36
      );
    },

    reset() {
      initGame();
    },

    destroy() {
      bubbles = [];
      bursts = [];
    },

    getStateDescription(): string {
      const diffLabel = difficulty <= 1 ? "Easy" : difficulty <= 2 ? "Medium" : "Hard";
      const rangeLabel = elementRange <= 1 ? "1-20" : elementRange <= 2 ? "1-50" : "1-103";
      const total = score + misses;
      const accuracy = total > 0 ? ((score / total) * 100).toFixed(0) : "N/A";
      return (
        `Element Symbol Game: Difficulty=${diffLabel}, Element range=${rangeLabel}, Speed=${speed}x. ` +
        `Current target: ${targetElement.name} (${targetElement.symbol}, #${targetElement.number}, ${CATEGORY_LABELS[targetElement.category]}). ` +
        `Score: ${score} matched, ${misses} missed, ${accuracy}% accuracy. ` +
        `${bubbles.filter((b) => !b.matched && !b.missed).length} bubbles currently floating. ` +
        `Bubbles float up; when the target element enters the match zone it auto-pops. ` +
        `Elements are colored by category (alkali metals, noble gases, transition metals, etc.).`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default ElementGameFactory;
