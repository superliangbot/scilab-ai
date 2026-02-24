import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Types ──────────────────────────────────────────────────────────

interface EnergyLevel {
  n: number;
  energy: number; // eV (negative)
  radius: number; // orbit radius in px (scaled)
}

interface Atom {
  x: number;
  y: number;
  electronLevel: number; // current energy level index (0=n1, 1=n2, 2=n3, 3=n4)
  excitedTimer: number;
  absorbing: boolean;
  absorbProgress: number;
  absorbFrom: number;
  absorbTo: number;
  emitting: boolean;
  emitProgress: number;
  emitFrom: number;
  emitTo: number;
}

interface Photon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  color: string;
  wavelengthPx: number;
  amplitude: number;
  alive: boolean;
  phase: number;
  transitionFrom: number;
  transitionTo: number;
  isEmitted: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────

// Bohr model: E_n = -13.6/n^2 eV
const ENERGY_LEVELS: EnergyLevel[] = [
  { n: 1, energy: -13.6, radius: 20 },
  { n: 2, energy: -3.4, radius: 38 },
  { n: 3, energy: -1.511, radius: 62 },
  { n: 4, energy: -0.85, radius: 88 },
];

// Transitions indexed by photonEnergy parameter (1, 2, 3)
// 1 = n1->n2, 2 = n1->n3, 3 = n2->n3
const TRANSITIONS: [number, number][] = [
  [0, 1], // n1 -> n2: 10.2 eV (Lyman-alpha, UV)
  [0, 2], // n1 -> n3: 12.089 eV (Lyman-beta, UV)
  [1, 2], // n2 -> n3: 1.889 eV (Balmer-alpha, visible red 656nm)
];

function getTransitionEnergy(lower: number, upper: number): number {
  return Math.abs(ENERGY_LEVELS[upper].energy - ENERGY_LEVELS[lower].energy);
}

// Photon colors based on transition energy (mapped to visible representation)
const TRANSITION_COLORS: string[] = [
  "#9b59ff", // n1->n2: deep violet (UV mapped to visible violet)
  "#6b3aff", // n1->n3: blue-violet (UV mapped)
  "#ff4444", // n2->n3: red (H-alpha, 656nm, actually visible)
];

const TRANSITION_WAVELENGTHS: number[] = [12, 10, 22]; // visual wave packet wavelength
const TRANSITION_LABELS: string[] = [
  "Lyman-\u03B1 (UV)",
  "Lyman-\u03B2 (UV)",
  "Balmer-\u03B1 (Red)",
];

const NUCLEUS_RADIUS = 7;
const EMISSION_DELAY_MIN = 0.8;
const EMISSION_DELAY_MAX = 2.0;
const TRANSITION_ANIM_DURATION = 0.35;
const PHOTON_SPEED = 140;

// ─── Factory ────────────────────────────────────────────────────────

const AbsorptionAndEmissionOfLightFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("absorption-and-emission-of-light") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let atoms: Atom[] = [];
  let photons: Photon[] = [];

  let photonEnergyLevel = 1;
  let emissionRate = 2;
  let numAtoms = 3;
  let speed = 1;

  let photonSpawnTimer = 0;
  let absorptionCount = 0;
  let emissionCount = 0;

  function createAtoms(): void {
    atoms = [];
    const areaW = width * 0.55;
    const areaH = height * 0.78;
    const offsetX = width * 0.04;
    const offsetY = height * 0.12;

    const cols = Math.min(numAtoms, 3);
    const rows = Math.ceil(numAtoms / cols);
    const cellW = areaW / cols;
    const cellH = areaH / rows;

    for (let i = 0; i < numAtoms; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      atoms.push({
        x: offsetX + cellW * (col + 0.5),
        y: offsetY + cellH * (row + 0.5),
        electronLevel: 0,
        excitedTimer: 0,
        absorbing: false,
        absorbProgress: 0,
        absorbFrom: 0,
        absorbTo: 0,
        emitting: false,
        emitProgress: 0,
        emitFrom: 0,
        emitTo: 0,
      });
    }
  }

  function spawnPhoton(): void {
    const transIdx = Math.max(0, Math.min(2, photonEnergyLevel - 1));
    const [lower, upper] = TRANSITIONS[transIdx];
    const energy = getTransitionEnergy(lower, upper);

    const startX = -20;
    const startY = height * 0.15 + Math.random() * height * 0.7;

    let targetX = width * 0.3;
    let targetY = height * 0.5;
    if (atoms.length > 0) {
      const target = atoms[Math.floor(Math.random() * atoms.length)];
      targetX = target.x;
      targetY = target.y;
    }

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    photons.push({
      x: startX,
      y: startY,
      vx: (dx / dist) * PHOTON_SPEED,
      vy: (dy / dist) * PHOTON_SPEED,
      energy,
      color: TRANSITION_COLORS[transIdx],
      wavelengthPx: TRANSITION_WAVELENGTHS[transIdx],
      amplitude: 6,
      alive: true,
      phase: Math.random() * Math.PI * 2,
      transitionFrom: lower,
      transitionTo: upper,
      isEmitted: false,
    });
  }

  function spawnEmittedPhoton(atom: Atom, fromLevel: number, toLevel: number): void {
    const lower = Math.min(fromLevel, toLevel);
    const upper = Math.max(fromLevel, toLevel);
    let transIdx = TRANSITIONS.findIndex((t) => t[0] === lower && t[1] === upper);
    if (transIdx < 0) transIdx = 0;

    const energy = getTransitionEnergy(lower, upper);
    const angle = Math.random() * Math.PI * 2;

    photons.push({
      x: atom.x,
      y: atom.y,
      vx: Math.cos(angle) * PHOTON_SPEED,
      vy: Math.sin(angle) * PHOTON_SPEED,
      energy,
      color: TRANSITION_COLORS[transIdx],
      wavelengthPx: TRANSITION_WAVELENGTHS[transIdx],
      amplitude: 6,
      alive: true,
      phase: Math.random() * Math.PI * 2,
      transitionFrom: lower,
      transitionTo: upper,
      isEmitted: true,
    });
    emissionCount++;
  }

  // ── Engine interface ─────────────────────────────────────────────

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    photonSpawnTimer = 0;
    absorptionCount = 0;
    emissionCount = 0;
    photons = [];
    createAtoms();
  }

  function update(dt: number, params: Record<string, number>): void {
    photonEnergyLevel = Math.round(params.photonEnergy ?? 1);
    emissionRate = params.emissionRate ?? 2;
    const newNumAtoms = Math.round(params.numAtoms ?? 3);
    speed = params.speed ?? 1;

    if (newNumAtoms !== numAtoms) {
      numAtoms = newNumAtoms;
      createAtoms();
    }

    const effectiveDt = dt * speed;
    time += effectiveDt;

    // Spawn incoming photons
    photonSpawnTimer += effectiveDt;
    const spawnInterval = 1 / emissionRate;
    while (photonSpawnTimer >= spawnInterval) {
      photonSpawnTimer -= spawnInterval;
      spawnPhoton();
    }

    // Update photon positions
    for (const p of photons) {
      if (!p.alive) continue;
      p.x += p.vx * effectiveDt;
      p.y += p.vy * effectiveDt;

      if (p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60) {
        p.alive = false;
      }
    }

    // Check photon-atom absorption
    for (const p of photons) {
      if (!p.alive || p.isEmitted) continue;

      for (const atom of atoms) {
        if (atom.absorbing || atom.emitting) continue;

        const dx = p.x - atom.x;
        const dy = p.y - atom.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = ENERGY_LEVELS[atom.electronLevel].radius + 12;

        if (dist < hitRadius && atom.electronLevel === p.transitionFrom) {
          p.alive = false;
          atom.absorbing = true;
          atom.absorbProgress = 0;
          atom.absorbFrom = p.transitionFrom;
          atom.absorbTo = p.transitionTo;
          absorptionCount++;
          break;
        }
      }
    }

    // Update atom animations
    for (const atom of atoms) {
      if (atom.absorbing) {
        atom.absorbProgress += effectiveDt / TRANSITION_ANIM_DURATION;
        if (atom.absorbProgress >= 1) {
          atom.absorbProgress = 1;
          atom.absorbing = false;
          atom.electronLevel = atom.absorbTo;
          atom.excitedTimer =
            EMISSION_DELAY_MIN + Math.random() * (EMISSION_DELAY_MAX - EMISSION_DELAY_MIN);
        }
      }

      if (atom.emitting) {
        atom.emitProgress += effectiveDt / TRANSITION_ANIM_DURATION;
        if (atom.emitProgress >= 1) {
          atom.emitProgress = 1;
          atom.emitting = false;
          atom.electronLevel = atom.emitTo;
          spawnEmittedPhoton(atom, atom.emitFrom, atom.emitTo);
        }
      }

      // Spontaneous emission countdown
      if (atom.electronLevel > 0 && !atom.absorbing && !atom.emitting) {
        atom.excitedTimer -= effectiveDt;
        if (atom.excitedTimer <= 0) {
          atom.emitting = true;
          atom.emitProgress = 0;
          atom.emitFrom = atom.electronLevel;
          atom.emitTo = 0; // drop to ground state
        }
      }
    }

    // Garbage collect dead photons
    for (let i = photons.length - 1; i >= 0; i--) {
      if (!photons[i].alive) photons.splice(i, 1);
    }
  }

  // ── Rendering ────────────────────────────────────────────────────

  function drawBackground(): void {
    const bgGrad = ctx.createRadialGradient(
      width * 0.35, height * 0.5, 0,
      width * 0.35, height * 0.5, Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, "#0d0d24");
    bgGrad.addColorStop(0.6, "#08081a");
    bgGrad.addColorStop(1, "#030310");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function drawAtom(atom: Atom): void {
    const { x, y } = atom;

    // Draw orbit rings (all four energy levels)
    for (let i = 0; i < ENERGY_LEVELS.length; i++) {
      const level = ENERGY_LEVELS[i];
      ctx.beginPath();
      ctx.arc(x, y, level.radius, 0, Math.PI * 2);
      ctx.strokeStyle = i <= atom.electronLevel
        ? "rgba(100, 160, 255, 0.3)"
        : "rgba(60, 80, 120, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = "rgba(150, 180, 220, 0.35)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`n=${level.n}`, x + level.radius + 3, y - 2);
    }

    // Nucleus glow
    const nucleusGlow = ctx.createRadialGradient(x, y, 0, x, y, NUCLEUS_RADIUS * 3);
    nucleusGlow.addColorStop(0, "rgba(255, 120, 60, 0.3)");
    nucleusGlow.addColorStop(1, "rgba(255, 120, 60, 0)");
    ctx.beginPath();
    ctx.arc(x, y, NUCLEUS_RADIUS * 3, 0, Math.PI * 2);
    ctx.fillStyle = nucleusGlow;
    ctx.fill();

    // Draw nucleus (protons + neutrons cluster)
    const nucleonPositions = [
      { dx: 0, dy: 0, color: "#ff6b4a" },
      { dx: 4, dy: 3, color: "#6ba3ff" },
      { dx: -3, dy: 4, color: "#ff6b4a" },
      { dx: -4, dy: -2, color: "#6ba3ff" },
      { dx: 2, dy: -4, color: "#ff6b4a" },
      { dx: 4, dy: -1, color: "#6ba3ff" },
    ];

    for (const nucleon of nucleonPositions) {
      const grad = ctx.createRadialGradient(
        x + nucleon.dx - 1, y + nucleon.dy - 1, 0,
        x + nucleon.dx, y + nucleon.dy, 3.5
      );
      grad.addColorStop(0, "#fff");
      grad.addColorStop(0.4, nucleon.color);
      grad.addColorStop(1, nucleon.color.replace("ff", "88"));
      ctx.beginPath();
      ctx.arc(x + nucleon.dx, y + nucleon.dy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Draw electron
    let electronRadius: number;
    let electronAngle: number;

    if (atom.absorbing) {
      const fromR = ENERGY_LEVELS[atom.absorbFrom].radius;
      const toR = ENERGY_LEVELS[atom.absorbTo].radius;
      const t = atom.absorbProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      electronRadius = fromR + (toR - fromR) * eased;
      electronAngle = time * 4 + t * Math.PI;
    } else if (atom.emitting) {
      const fromR = ENERGY_LEVELS[atom.emitFrom].radius;
      const toR = ENERGY_LEVELS[atom.emitTo].radius;
      const t = atom.emitProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      electronRadius = fromR + (toR - fromR) * eased;
      electronAngle = time * 4 + t * Math.PI;
    } else {
      electronRadius = ENERGY_LEVELS[atom.electronLevel].radius;
      electronAngle = time * 3;
    }

    const ex = x + electronRadius * Math.cos(electronAngle);
    const ey = y + electronRadius * Math.sin(electronAngle);

    // Electron glow
    const eGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 12);
    eGlow.addColorStop(0, "rgba(100, 200, 255, 0.6)");
    eGlow.addColorStop(0.5, "rgba(100, 200, 255, 0.15)");
    eGlow.addColorStop(1, "rgba(100, 200, 255, 0)");
    ctx.beginPath();
    ctx.arc(ex, ey, 12, 0, Math.PI * 2);
    ctx.fillStyle = eGlow;
    ctx.fill();

    // Electron body
    const eGrad = ctx.createRadialGradient(ex - 1, ey - 1, 0, ex, ey, 4);
    eGrad.addColorStop(0, "#ffffff");
    eGrad.addColorStop(0.5, "#64c8ff");
    eGrad.addColorStop(1, "#3090d0");
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fillStyle = eGrad;
    ctx.fill();

    // Flash during absorption
    if (atom.absorbing && atom.absorbProgress < 0.5) {
      const flashAlpha = (1 - atom.absorbProgress * 2) * 0.4;
      const transIdx = TRANSITIONS.findIndex(
        (t) => t[0] === atom.absorbFrom && t[1] === atom.absorbTo
      );
      const flashColor = transIdx >= 0 ? TRANSITION_COLORS[transIdx] : "#ffffff";
      const { r, g, b } = hexToRgb(flashColor);
      const flashGlow = ctx.createRadialGradient(x, y, 0, x, y, ENERGY_LEVELS[atom.absorbTo].radius + 15);
      flashGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flashAlpha})`);
      flashGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, ENERGY_LEVELS[atom.absorbTo].radius + 15, 0, Math.PI * 2);
      ctx.fillStyle = flashGlow;
      ctx.fill();
    }

    // Flash during emission
    if (atom.emitting && atom.emitProgress < 0.5) {
      const flashAlpha = (1 - atom.emitProgress * 2) * 0.5;
      const lower = Math.min(atom.emitFrom, atom.emitTo);
      const upper = Math.max(atom.emitFrom, atom.emitTo);
      const transIdx = TRANSITIONS.findIndex((t) => t[0] === lower && t[1] === upper);
      const flashColor = transIdx >= 0 ? TRANSITION_COLORS[transIdx] : "#ffffff";
      const { r, g, b } = hexToRgb(flashColor);
      const flashGlow = ctx.createRadialGradient(x, y, 0, x, y, ENERGY_LEVELS[upper].radius + 20);
      flashGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flashAlpha})`);
      flashGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, ENERGY_LEVELS[upper].radius + 20, 0, Math.PI * 2);
      ctx.fillStyle = flashGlow;
      ctx.fill();
    }
  }

  function drawPhoton(p: Photon): void {
    if (!p.alive) return;

    const { r, g, b } = hexToRgb(p.color);

    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const dirX = p.vx / spd;
    const dirY = p.vy / spd;
    const perpX = -dirY;
    const perpY = dirX;

    const waveLength = 40;
    const numSegments = 24;

    // Glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
    glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
    glow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`);
    glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Sinusoidal wave packet
    ctx.beginPath();
    let first = true;
    for (let s = 0; s <= numSegments; s++) {
      const t = s / numSegments;
      const along = (t - 0.5) * waveLength;
      const envelope = 1 - Math.pow(2 * t - 1, 2);
      const wave = Math.sin((along / p.wavelengthPx) * Math.PI * 2 + p.phase + time * 10) * p.amplitude * envelope;
      const px = p.x + dirX * along + perpX * wave;
      const py = p.y + dirY * along + perpY * wave;
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bright center dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
  }

  function drawEnergyDiagram(): void {
    const diagX = width * 0.66;
    const diagW = width * 0.30;
    const diagY = height * 0.06;
    const diagH = height * 0.88;

    // Panel background
    ctx.fillStyle = "rgba(10, 10, 30, 0.65)";
    ctx.beginPath();
    ctx.roundRect(diagX - 10, diagY - 10, diagW + 20, diagH + 20, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 100, 160, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(diagX - 10, diagY - 10, diagW + 20, diagH + 20, 10);
    ctx.stroke();

    // Title
    ctx.fillStyle = "rgba(200, 210, 240, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy Levels (Bohr Model)", diagX + diagW / 2, diagY + 8);

    // Level area
    const levelAreaTop = diagY + 28;
    const levelAreaBottom = diagY + diagH - 70;
    const levelAreaHeight = levelAreaBottom - levelAreaTop;

    const minE = ENERGY_LEVELS[0].energy;
    const maxE = ENERGY_LEVELS[3].energy;
    const range = maxE - minE;

    function energyToY(e: number): number {
      return levelAreaBottom - ((e - minE) / range) * levelAreaHeight;
    }

    const lineStartX = diagX + 20;
    const lineEndX = diagX + diagW - 20;

    // Draw all four energy levels
    for (let i = 0; i < ENERGY_LEVELS.length; i++) {
      const level = ENERGY_LEVELS[i];
      const ly = energyToY(level.energy);

      ctx.beginPath();
      ctx.moveTo(lineStartX, ly);
      ctx.lineTo(lineEndX, ly);
      ctx.strokeStyle = "rgba(150, 180, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Level label
      ctx.fillStyle = "rgba(180, 200, 255, 0.9)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`n=${level.n}`, lineStartX - 5, ly + 4);

      // Energy value
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(140, 160, 200, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`${level.energy.toFixed(2)} eV`, lineEndX + 4, ly + 4);

      // Show electron dots for atoms at this level
      const atomsAtLevel = atoms.filter(
        (a) => !a.absorbing && !a.emitting && a.electronLevel === i
      );
      for (let j = 0; j < atomsAtLevel.length; j++) {
        const dotX = lineStartX + 20 + j * 14;
        ctx.beginPath();
        ctx.arc(dotX, ly - 6, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#64c8ff";
        ctx.fill();

        const dotGlow = ctx.createRadialGradient(dotX, ly - 6, 0, dotX, ly - 6, 8);
        dotGlow.addColorStop(0, "rgba(100, 200, 255, 0.4)");
        dotGlow.addColorStop(1, "rgba(100, 200, 255, 0)");
        ctx.beginPath();
        ctx.arc(dotX, ly - 6, 8, 0, Math.PI * 2);
        ctx.fillStyle = dotGlow;
        ctx.fill();
      }
    }

    // Draw transition arrows for current selection
    const transIdx = Math.max(0, Math.min(2, photonEnergyLevel - 1));
    const [lower, upper] = TRANSITIONS[transIdx];
    const lowerY = energyToY(ENERGY_LEVELS[lower].energy);
    const upperY = energyToY(ENERGY_LEVELS[upper].energy);
    const arrowCenterX = lineStartX + (lineEndX - lineStartX) * 0.5;

    const tc = hexToRgb(TRANSITION_COLORS[transIdx]);

    // Absorption arrow (up)
    const abX = arrowCenterX - 18;
    ctx.beginPath();
    ctx.moveTo(abX, lowerY - 4);
    ctx.lineTo(abX, upperY + 4);
    ctx.strokeStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(abX, upperY + 4);
    ctx.lineTo(abX - 4, upperY + 12);
    ctx.lineTo(abX + 4, upperY + 12);
    ctx.closePath();
    ctx.fillStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.8)`;
    ctx.fill();
    ctx.fillStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.9)`;
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("absorb", abX, (lowerY + upperY) / 2 + 3);

    // Emission arrow (down, dashed)
    const emX = arrowCenterX + 18;
    ctx.beginPath();
    ctx.moveTo(emX, upperY + 4);
    ctx.lineTo(emX, lowerY - 4);
    ctx.strokeStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(emX, lowerY - 4);
    ctx.lineTo(emX - 4, lowerY - 12);
    ctx.lineTo(emX + 4, lowerY - 12);
    ctx.closePath();
    ctx.fillStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.6)`;
    ctx.fill();
    ctx.fillStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.7)`;
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("emit", emX, (lowerY + upperY) / 2 + 3);

    // Transition info
    const dE = getTransitionEnergy(lower, upper);
    ctx.fillStyle = "rgba(200, 210, 240, 0.85)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `${TRANSITION_LABELS[transIdx]}`,
      diagX + diagW / 2,
      diagY + diagH - 50
    );
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(
      `\u0394E = ${dE.toFixed(2)} eV`,
      diagX + diagW / 2,
      diagY + diagH - 34
    );

    // Animated wavy photon icon
    ctx.beginPath();
    const iconY = diagY + diagH - 16;
    for (let s = 0; s <= 16; s++) {
      const t = s / 16;
      const px = diagX + diagW / 2 - 20 + t * 40;
      const py = iconY + Math.sin(t * Math.PI * 4 + time * 6) * 3;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(${tc.r}, ${tc.g}, ${tc.b}, 0.6)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Formula reference
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(160, 180, 220, 0.5)";
    ctx.fillText("E\u2099 = \u221213.6/n\u00B2 eV", diagX + diagW / 2, diagY + diagH - 2);
  }

  function drawInfoOverlay(): void {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 260, 30, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `t = ${time.toFixed(1)}s  |  Absorbed: ${absorptionCount}  |  Emitted: ${emissionCount}`,
      20, 30
    );
    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;

    drawBackground();

    for (const atom of atoms) {
      drawAtom(atom);
    }

    for (const p of photons) {
      drawPhoton(p);
    }

    drawEnergyDiagram();
    drawInfoOverlay();
  }

  function reset(): void {
    time = 0;
    photonSpawnTimer = 0;
    absorptionCount = 0;
    emissionCount = 0;
    photons = [];
    createAtoms();
  }

  function destroy(): void {
    atoms = [];
    photons = [];
  }

  function getStateDescription(): string {
    const transIdx = Math.max(0, Math.min(2, photonEnergyLevel - 1));
    const [lower, upper] = TRANSITIONS[transIdx];
    const dE = getTransitionEnergy(lower, upper);
    const atomStates = atoms
      .map(
        (a, i) =>
          `Atom ${i + 1}: n=${ENERGY_LEVELS[a.electronLevel].n}${a.absorbing ? " (absorbing)" : ""}${a.emitting ? " (emitting)" : ""}${a.electronLevel > 0 && !a.absorbing && !a.emitting ? " (excited)" : ""}`
      )
      .join("; ");
    return (
      `Absorption & Emission of Light (Bohr model): ${numAtoms} atoms with 4 energy levels (n=1..4), ` +
      `current transition n=${ENERGY_LEVELS[lower].n}\u2192n=${ENERGY_LEVELS[upper].n} ` +
      `(\u0394E=${dE.toFixed(2)} eV, ${TRANSITION_LABELS[transIdx]}), ` +
      `photon rate=${emissionRate}/s, speed=${speed}x. ` +
      `Absorptions: ${absorptionCount}, Emissions: ${emissionCount}. ` +
      `${atomStates}. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createAtoms();
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default AbsorptionAndEmissionOfLightFactory;
