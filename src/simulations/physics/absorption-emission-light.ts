import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// --- Types ---

interface EnergyLevel {
  n: number;
  energy: number; // eV (negative)
  radius: number; // orbit radius in px (scaled)
}

interface Atom {
  x: number;
  y: number;
  electronLevel: number; // current energy level index (0=ground, 1=E2, 2=E3)
  excitedTimer: number; // time remaining before spontaneous emission
  absorbing: boolean; // currently animating absorption
  absorbProgress: number; // 0..1 animation progress
  absorbFrom: number; // level transitioning from
  absorbTo: number; // level transitioning to
  emitting: boolean; // currently animating emission
  emitProgress: number; // 0..1 animation progress
  emitFrom: number; // level transitioning from
  emitTo: number; // level transitioning to
}

interface Photon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number; // eV
  color: string;
  wavelengthPx: number; // visual wavelength in pixels for drawing
  amplitude: number; // wave amplitude in px
  alive: boolean;
  phase: number; // phase offset for wave drawing
  transitionFrom: number; // lower level index
  transitionTo: number; // upper level index
}

// --- Constants ---

// Bohr model energy levels for hydrogen-like atom: E_n = -13.6/n^2 eV
const ENERGY_LEVELS: EnergyLevel[] = [
  { n: 1, energy: -13.6, radius: 22 },
  { n: 2, energy: -3.4, radius: 42 },
  { n: 3, energy: -1.511, radius: 68 },
];

// Transitions: [lowerIndex, upperIndex]
const TRANSITIONS: [number, number][] = [
  [0, 1], // E1 -> E2: 10.2 eV (Lyman-alpha, UV -> mapped to violet)
  [0, 2], // E1 -> E3: 12.089 eV (Lyman-beta, UV -> mapped to blue-violet)
  [1, 2], // E2 -> E3: 1.889 eV (Balmer-alpha, visible red)
];

function getTransitionEnergy(lower: number, upper: number): number {
  return ENERGY_LEVELS[upper].energy - ENERGY_LEVELS[lower].energy; // positive value (abs)
}

// Map transition index to photon color
const TRANSITION_COLORS: string[] = [
  "#9b59ff", // E1->E2: violet (10.2 eV)
  "#5b7fff", // E1->E3: blue-violet (12.089 eV)
  "#ff4444", // E2->E3: red (1.889 eV)
];

const TRANSITION_GLOW_COLORS: string[] = [
  "rgba(155, 89, 255, 0.5)",
  "rgba(91, 127, 255, 0.5)",
  "rgba(255, 68, 68, 0.5)",
];

// Visual wavelength for sinusoidal drawing (shorter = higher energy)
const TRANSITION_WAVELENGTHS: number[] = [12, 10, 24];

const NUCLEUS_RADIUS = 8;
const EMISSION_DELAY_MIN = 0.8; // seconds before spontaneous emission (at speed 1x)
const EMISSION_DELAY_MAX = 2.0;
const TRANSITION_ANIM_DURATION = 0.35; // seconds for electron jump animation
const PHOTON_SPEED = 140; // px/s base speed

const AbsorptionEmissionLightFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("absorption-emission-light") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let atoms: Atom[] = [];
  let photons: Photon[] = [];

  // Cached parameters
  let photonEnergyLevel = 1;
  let emissionRate = 2;
  let numAtoms = 3;
  let speed = 1;

  let photonSpawnTimer = 0;
  let absorptionCount = 0;
  let emissionCount = 0;

  function createAtoms(): void {
    atoms = [];
    // Area for atoms: left ~65% of canvas
    const areaW = width * 0.58;
    const areaH = height * 0.8;
    const offsetX = width * 0.05;
    const offsetY = height * 0.1;

    // Place atoms in a grid-like arrangement
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
    const transIdx = photonEnergyLevel - 1; // 0, 1, or 2
    const [lower, upper] = TRANSITIONS[transIdx];
    const energy = Math.abs(getTransitionEnergy(lower, upper));

    // Spawn from the left edge, random y within canvas
    const startX = -20;
    const startY = height * 0.15 + Math.random() * height * 0.7;

    // Aim toward a random atom (or center if no atoms)
    let targetX = width * 0.35;
    let targetY = height * 0.5;
    if (atoms.length > 0) {
      const targetAtom = atoms[Math.floor(Math.random() * atoms.length)];
      targetX = targetAtom.x;
      targetY = targetAtom.y;
    }

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / dist) * PHOTON_SPEED;
    const vy = (dy / dist) * PHOTON_SPEED;

    photons.push({
      x: startX,
      y: startY,
      vx,
      vy,
      energy,
      color: TRANSITION_COLORS[transIdx],
      wavelengthPx: TRANSITION_WAVELENGTHS[transIdx],
      amplitude: 6,
      alive: true,
      phase: Math.random() * Math.PI * 2,
      transitionFrom: lower,
      transitionTo: upper,
    });
  }

  function spawnEmittedPhoton(atom: Atom, fromLevel: number, toLevel: number): void {
    // Determine which transition this corresponds to
    const lower = Math.min(fromLevel, toLevel);
    const upper = Math.max(fromLevel, toLevel);
    let transIdx = TRANSITIONS.findIndex((t) => t[0] === lower && t[1] === upper);
    if (transIdx < 0) transIdx = 0;

    const energy = Math.abs(getTransitionEnergy(lower, upper));

    // Emit in random direction
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * PHOTON_SPEED;
    const vy = Math.sin(angle) * PHOTON_SPEED;

    photons.push({
      x: atom.x,
      y: atom.y,
      vx,
      vy,
      energy,
      color: TRANSITION_COLORS[transIdx],
      wavelengthPx: TRANSITION_WAVELENGTHS[transIdx],
      amplitude: 6,
      alive: true,
      phase: Math.random() * Math.PI * 2,
      transitionFrom: lower,
      transitionTo: upper,
    });

    emissionCount++;
  }

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

    // Recreate atoms if count changed
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

      // Remove photons that leave the canvas
      if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) {
        p.alive = false;
      }
    }

    // Check photon-atom absorption
    for (const p of photons) {
      if (!p.alive) continue;

      for (const atom of atoms) {
        if (atom.absorbing || atom.emitting) continue;

        const dx = p.x - atom.x;
        const dy = p.y - atom.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = ENERGY_LEVELS[atom.electronLevel].radius + 10;

        if (dist < hitRadius) {
          // Check if this photon can be absorbed by this atom
          // The atom must be at the lower level of the transition
          if (atom.electronLevel === p.transitionFrom) {
            // Absorb!
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
    }

    // Update atom absorption animations
    for (const atom of atoms) {
      if (atom.absorbing) {
        atom.absorbProgress += effectiveDt / TRANSITION_ANIM_DURATION;
        if (atom.absorbProgress >= 1) {
          atom.absorbProgress = 1;
          atom.absorbing = false;
          atom.electronLevel = atom.absorbTo;
          // Set timer for spontaneous emission
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
          // Emit photon
          spawnEmittedPhoton(atom, atom.emitFrom, atom.emitTo);
        }
      }

      // Spontaneous emission countdown
      if (atom.electronLevel > 0 && !atom.absorbing && !atom.emitting) {
        atom.excitedTimer -= effectiveDt;
        if (atom.excitedTimer <= 0) {
          // Drop to ground state (or lower level)
          atom.emitting = true;
          atom.emitProgress = 0;
          atom.emitFrom = atom.electronLevel;
          // Drop to ground state for simplicity (could do cascading)
          atom.emitTo = 0;
        }
      }
    }

    // Garbage collect dead photons
    for (let i = photons.length - 1; i >= 0; i--) {
      if (!photons[i].alive) {
        photons.splice(i, 1);
      }
    }
  }

  // --- Rendering ---

  function drawBackground(): void {
    const bgGrad = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, "#0d0d24");
    bgGrad.addColorStop(0.6, "#08081a");
    bgGrad.addColorStop(1, "#030310");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawAtom(atom: Atom): void {
    const { x, y } = atom;

    // Draw orbit rings (all three energy levels)
    for (let i = 0; i < ENERGY_LEVELS.length; i++) {
      const level = ENERGY_LEVELS[i];
      ctx.beginPath();
      ctx.arc(x, y, level.radius, 0, Math.PI * 2);
      ctx.strokeStyle =
        i <= atom.electronLevel
          ? "rgba(100, 160, 255, 0.3)"
          : "rgba(60, 80, 120, 0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label: n=1, n=2, n=3
      ctx.fillStyle = "rgba(150, 180, 220, 0.4)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`n=${level.n}`, x + level.radius + 3, y - 2);
    }

    // Draw nucleus glow
    const nucleusGlow = ctx.createRadialGradient(x, y, 0, x, y, NUCLEUS_RADIUS * 3);
    nucleusGlow.addColorStop(0, "rgba(255, 120, 60, 0.3)");
    nucleusGlow.addColorStop(1, "rgba(255, 120, 60, 0)");
    ctx.beginPath();
    ctx.arc(x, y, NUCLEUS_RADIUS * 3, 0, Math.PI * 2);
    ctx.fillStyle = nucleusGlow;
    ctx.fill();

    // Draw nucleus (cluster of protons and neutrons)
    const nucleonPositions = [
      { dx: 0, dy: 0, color: "#ff6b4a" }, // proton (red-ish)
      { dx: 4, dy: 3, color: "#6ba3ff" }, // neutron (blue-ish)
      { dx: -3, dy: 4, color: "#ff6b4a" },
      { dx: -4, dy: -2, color: "#6ba3ff" },
      { dx: 2, dy: -4, color: "#ff6b4a" },
      { dx: 4, dy: -1, color: "#6ba3ff" },
    ];

    for (const nucleon of nucleonPositions) {
      const grad = ctx.createRadialGradient(
        x + nucleon.dx - 1,
        y + nucleon.dy - 1,
        0,
        x + nucleon.dx,
        y + nucleon.dy,
        3.5
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
      // Animating from lower to higher orbit
      const fromR = ENERGY_LEVELS[atom.absorbFrom].radius;
      const toR = ENERGY_LEVELS[atom.absorbTo].radius;
      // Ease-out cubic
      const t = atom.absorbProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      electronRadius = fromR + (toR - fromR) * eased;
      electronAngle = time * 4 + t * Math.PI; // spin during transition
    } else if (atom.emitting) {
      // Animating from higher to lower orbit
      const fromR = ENERGY_LEVELS[atom.emitFrom].radius;
      const toR = ENERGY_LEVELS[atom.emitTo].radius;
      const t = atom.emitProgress;
      const eased = 1 - Math.pow(1 - t, 3);
      electronRadius = fromR + (toR - fromR) * eased;
      electronAngle = time * 4 + t * Math.PI;
    } else {
      electronRadius = ENERGY_LEVELS[atom.electronLevel].radius;
      electronAngle = time * 3; // steady orbit
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

    // Flash effect during absorption or emission
    if (atom.absorbing && atom.absorbProgress < 0.5) {
      const flashAlpha = (1 - atom.absorbProgress * 2) * 0.4;
      const transIdx = TRANSITIONS.findIndex(
        (t) => t[0] === atom.absorbFrom && t[1] === atom.absorbTo
      );
      const flashColor = transIdx >= 0 ? TRANSITION_COLORS[transIdx] : "#ffffff";
      const flashGlow = ctx.createRadialGradient(x, y, 0, x, y, ENERGY_LEVELS[atom.absorbTo].radius + 15);
      flashGlow.addColorStop(0, flashColor.replace(")", `, ${flashAlpha})`).replace("rgb", "rgba").replace("#", ""));
      // Use hex to rgba conversion
      const r = parseInt(flashColor.slice(1, 3), 16);
      const g = parseInt(flashColor.slice(3, 5), 16);
      const b = parseInt(flashColor.slice(5, 7), 16);
      flashGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flashAlpha})`);
      flashGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, ENERGY_LEVELS[atom.absorbTo].radius + 15, 0, Math.PI * 2);
      ctx.fillStyle = flashGlow;
      ctx.fill();
    }

    if (atom.emitting && atom.emitProgress < 0.5) {
      const flashAlpha = (1 - atom.emitProgress * 2) * 0.5;
      const lower = Math.min(atom.emitFrom, atom.emitTo);
      const upper = Math.max(atom.emitFrom, atom.emitTo);
      const transIdx = TRANSITIONS.findIndex((t) => t[0] === lower && t[1] === upper);
      const flashColor = transIdx >= 0 ? TRANSITION_COLORS[transIdx] : "#ffffff";
      const r = parseInt(flashColor.slice(1, 3), 16);
      const g = parseInt(flashColor.slice(3, 5), 16);
      const b = parseInt(flashColor.slice(5, 7), 16);
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

    const r = parseInt(p.color.slice(1, 3), 16);
    const g = parseInt(p.color.slice(3, 5), 16);
    const b = parseInt(p.color.slice(5, 7), 16);

    // Direction of travel
    const speed2 = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const dirX = p.vx / speed2;
    const dirY = p.vy / speed2;
    // Perpendicular direction for wave oscillation
    const perpX = -dirY;
    const perpY = dirX;

    // Draw glowing wave packet
    const waveLength = 40; // total length of wave packet in px
    const numSegments = 24;

    // Glow behind photon
    const photonGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
    photonGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
    photonGlow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`);
    photonGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = photonGlow;
    ctx.fill();

    // Draw sinusoidal wave
    ctx.beginPath();
    let first = true;
    for (let s = 0; s <= numSegments; s++) {
      const t = s / numSegments;
      const along = (t - 0.5) * waveLength;
      const envelope = 1 - Math.pow(2 * t - 1, 2); // Gaussian-like envelope
      const wave = Math.sin((along / p.wavelengthPx) * Math.PI * 2 + p.phase + time * 10) * p.amplitude * envelope;
      const px = p.x + dirX * along + perpX * wave;
      const py = p.y + dirY * along + perpY * wave;
      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
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
    ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
    ctx.fill();
  }

  function drawEnergyDiagram(): void {
    // Draw on the right side of canvas
    const diagX = width * 0.7;
    const diagW = width * 0.26;
    const diagY = height * 0.08;
    const diagH = height * 0.84;

    // Background panel
    ctx.fillStyle = "rgba(10, 10, 30, 0.6)";
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
    ctx.fillText("Energy Levels", diagX + diagW / 2, diagY + 8);

    // Draw energy levels as horizontal lines
    // Map energy to Y: E3 (highest, -1.51 eV) at top, E1 (lowest, -13.6 eV) at bottom
    const levelAreaTop = diagY + 28;
    const levelAreaBottom = diagY + diagH - 30;
    const levelAreaHeight = levelAreaBottom - levelAreaTop;

    // Normalize energies for display
    const minE = ENERGY_LEVELS[0].energy; // -13.6
    const maxE = ENERGY_LEVELS[2].energy; // -1.511
    const range = maxE - minE;

    function energyToY(e: number): number {
      return levelAreaBottom - ((e - minE) / range) * levelAreaHeight;
    }

    const lineStartX = diagX + 15;
    const lineEndX = diagX + diagW - 15;

    for (let i = 0; i < ENERGY_LEVELS.length; i++) {
      const level = ENERGY_LEVELS[i];
      const ly = energyToY(level.energy);

      // Level line
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
      ctx.fillText(`E${level.n}`, lineStartX - 5, ly + 4);

      // Energy value
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(140, 160, 200, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`${level.energy.toFixed(1)} eV`, lineEndX + 4, ly + 4);

      // Highlight the current occupied level for each atom
      const atomsAtLevel = atoms.filter(
        (a) => !a.absorbing && !a.emitting && a.electronLevel === i
      );
      if (atomsAtLevel.length > 0) {
        // Draw electron dots on the level line
        for (let j = 0; j < atomsAtLevel.length; j++) {
          const dotX = lineStartX + 25 + j * 14;
          ctx.beginPath();
          ctx.arc(dotX, ly - 6, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#64c8ff";
          ctx.fill();
          // Glow
          const dotGlow = ctx.createRadialGradient(dotX, ly - 6, 0, dotX, ly - 6, 8);
          dotGlow.addColorStop(0, "rgba(100, 200, 255, 0.4)");
          dotGlow.addColorStop(1, "rgba(100, 200, 255, 0)");
          ctx.beginPath();
          ctx.arc(dotX, ly - 6, 8, 0, Math.PI * 2);
          ctx.fillStyle = dotGlow;
          ctx.fill();
        }
      }
    }

    // Draw transition arrows for the current photon energy selection
    const transIdx = photonEnergyLevel - 1;
    const [lower, upper] = TRANSITIONS[transIdx];
    const lowerY = energyToY(ENERGY_LEVELS[lower].energy);
    const upperY = energyToY(ENERGY_LEVELS[upper].energy);
    const arrowX = lineStartX + (lineEndX - lineStartX) * 0.5;

    const transColor = TRANSITION_COLORS[transIdx];
    const tr = parseInt(transColor.slice(1, 3), 16);
    const tg = parseInt(transColor.slice(3, 5), 16);
    const tb = parseInt(transColor.slice(5, 7), 16);

    // Absorption arrow (up)
    const abArrowX = arrowX - 18;
    ctx.beginPath();
    ctx.moveTo(abArrowX, lowerY - 4);
    ctx.lineTo(abArrowX, upperY + 4);
    ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.8)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Arrow head up
    ctx.beginPath();
    ctx.moveTo(abArrowX, upperY + 4);
    ctx.lineTo(abArrowX - 4, upperY + 12);
    ctx.lineTo(abArrowX + 4, upperY + 12);
    ctx.closePath();
    ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.8)`;
    ctx.fill();

    // Label
    ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.9)`;
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("absorb", abArrowX, (lowerY + upperY) / 2 + 3);

    // Emission arrow (down)
    const emArrowX = arrowX + 18;
    ctx.beginPath();
    ctx.moveTo(emArrowX, upperY + 4);
    ctx.lineTo(emArrowX, lowerY - 4);
    ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.6)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow head down
    ctx.beginPath();
    ctx.moveTo(emArrowX, lowerY - 4);
    ctx.lineTo(emArrowX - 4, lowerY - 12);
    ctx.lineTo(emArrowX + 4, lowerY - 12);
    ctx.closePath();
    ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.6)`;
    ctx.fill();

    ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.7)`;
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("emit", emArrowX, (lowerY + upperY) / 2 + 3);

    // Photon energy label
    const dE = Math.abs(getTransitionEnergy(lower, upper));
    ctx.fillStyle = "rgba(200, 210, 240, 0.8)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `\u0394E = ${dE.toFixed(2)} eV`,
      diagX + diagW / 2,
      diagY + diagH - 8
    );

    // Wavy photon icon next to energy value
    const iconX = diagX + diagW / 2;
    const iconY = diagY + diagH - 22;
    ctx.beginPath();
    for (let s = 0; s <= 16; s++) {
      const t = s / 16;
      const px = iconX - 20 + t * 40;
      const py = iconY + Math.sin(t * Math.PI * 4 + time * 6) * 3;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.6)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawInfoOverlay(): void {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 240, 30, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `t = ${time.toFixed(1)}s | Absorbed: ${absorptionCount} | Emitted: ${emissionCount}`,
      20,
      30
    );
    ctx.restore();
  }

  function render(): void {
    drawBackground();

    // Draw all atoms
    for (const atom of atoms) {
      drawAtom(atom);
    }

    // Draw all photons
    for (const p of photons) {
      drawPhoton(p);
    }

    // Draw energy level diagram
    drawEnergyDiagram();

    // Draw info overlay
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
    const transIdx = photonEnergyLevel - 1;
    const [lower, upper] = TRANSITIONS[transIdx];
    const dE = Math.abs(getTransitionEnergy(lower, upper));
    const atomStates = atoms
      .map(
        (a, i) =>
          `Atom ${i + 1}: n=${ENERGY_LEVELS[a.electronLevel].n}${a.absorbing ? " (absorbing)" : ""}${a.emitting ? " (emitting)" : ""}${a.electronLevel > 0 && !a.absorbing && !a.emitting ? " (excited)" : ""}`
      )
      .join("; ");
    return (
      `Absorption & Emission of Light: ${numAtoms} atoms, ` +
      `transition n=${ENERGY_LEVELS[lower].n}\u2192n=${ENERGY_LEVELS[upper].n} (\u0394E=${dE.toFixed(2)} eV), ` +
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

export default AbsorptionEmissionLightFactory;
