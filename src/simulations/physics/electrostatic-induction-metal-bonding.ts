import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectrostaticInductionMetalBondingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electrostatic-induction-metal-bonding") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let chargeStrength = 5;
  let rodDistance = 50;
  let polarity = 1;

  // Metal lattice
  const GRID_COLS = 8;
  const GRID_ROWS = 6;
  const LATTICE_X = 200;
  const LATTICE_Y = 150;
  const CELL_SIZE = 50;

  interface Ion {
    x: number;
    y: number;
  }

  interface Electron {
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    vx: number;
    vy: number;
    angle: number;
    orbitRadius: number;
    orbitSpeed: number;
  }

  let ions: Ion[] = [];
  let electrons: Electron[] = [];

  function createLattice(): void {
    ions = [];
    electrons = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = LATTICE_X + c * CELL_SIZE + CELL_SIZE / 2;
        const y = LATTICE_Y + r * CELL_SIZE + CELL_SIZE / 2;
        ions.push({ x, y });

        // Free electron near each ion
        const angle = Math.random() * Math.PI * 2;
        const orbitR = 12 + Math.random() * 8;
        electrons.push({
          x: x + Math.cos(angle) * orbitR,
          y: y + Math.sin(angle) * orbitR,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
          angle,
          orbitRadius: orbitR,
          orbitSpeed: 1.5 + Math.random() * 2,
        });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    createLattice();
  }

  function update(dt: number, params: Record<string, number>): void {
    chargeStrength = params.chargeStrength ?? 5;
    rodDistance = params.rodDistance ?? 50;
    polarity = params.polarity ?? 1;

    const rodX = LATTICE_X - 40 - rodDistance * 1.5;
    const rodY = LATTICE_Y + (GRID_ROWS * CELL_SIZE) / 2;

    // Update electron positions
    const effectiveField = polarity * chargeStrength * (100 - rodDistance) / 100;

    for (const e of electrons) {
      // Orbit around base position
      e.angle += e.orbitSpeed * dt;

      // Shift electrons based on external field
      // Positive rod attracts electrons (leftward), negative repels (rightward)
      const shiftX = effectiveField * -8;
      const targetX = e.baseX + Math.cos(e.angle) * e.orbitRadius + shiftX;
      const targetY = e.baseY + Math.sin(e.angle) * e.orbitRadius;

      // Smoothly move
      e.x += (targetX - e.x) * 4 * dt;
      e.y += (targetY - e.y) * 4 * dt;

      // Clamp to metal block bounds with padding
      const minX = LATTICE_X - 10;
      const maxX = LATTICE_X + GRID_COLS * CELL_SIZE + 10;
      const minY = LATTICE_Y - 10;
      const maxY = LATTICE_Y + GRID_ROWS * CELL_SIZE + 10;
      e.x = Math.max(minX, Math.min(maxX, e.x));
      e.y = Math.max(minY, Math.min(maxY, e.y));
    }

    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMetalBlock(): void {
    const x = LATTICE_X - 15;
    const y = LATTICE_Y - 15;
    const w = GRID_COLS * CELL_SIZE + 30;
    const h = GRID_ROWS * CELL_SIZE + 30;

    ctx.fillStyle = "rgba(100, 110, 130, 0.25)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(160, 180, 200, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Metal Conductor (Lattice Structure)", x + w / 2, y + h + 22);
  }

  function drawIons(): void {
    for (const ion of ions) {
      // Ion core (fixed positive)
      ctx.beginPath();
      ctx.arc(ion.x, ion.y, 14, 0, Math.PI * 2);
      const ionGrad = ctx.createRadialGradient(ion.x - 3, ion.y - 3, 0, ion.x, ion.y, 14);
      ionGrad.addColorStop(0, "#ff8080");
      ionGrad.addColorStop(1, "#cc3030");
      ctx.fillStyle = ionGrad;
      ctx.fill();

      // Cross symbol for positive ion
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ion.x - 6, ion.y);
      ctx.lineTo(ion.x + 6, ion.y);
      ctx.moveTo(ion.x, ion.y - 6);
      ctx.lineTo(ion.x, ion.y + 6);
      ctx.stroke();
    }
  }

  function drawElectrons(): void {
    for (const e of electrons) {
      // Electron trail
      ctx.beginPath();
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80, 160, 255, 0.9)";
      ctx.fill();

      // Glow
      const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 10);
      glow.addColorStop(0, "rgba(80, 160, 255, 0.4)");
      glow.addColorStop(1, "rgba(80, 160, 255, 0)");
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Minus sign
      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", e.x, e.y);
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawChargedRod(): void {
    const rodX = LATTICE_X - 40 - rodDistance * 1.5;
    const rodY = LATTICE_Y + (GRID_ROWS * CELL_SIZE) / 2;
    const rodLen = 100;

    // Hand
    ctx.fillStyle = "#e8b88a";
    ctx.beginPath();
    ctx.ellipse(rodX - rodLen / 2 - 18, rodY, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rod
    const color = polarity > 0 ? "#e74c3c" : "#3498db";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(rodX - rodLen / 2, rodY - 10, rodLen, 20, 5);
    ctx.fill();

    // Symbols
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    const sym = polarity > 0 ? "+" : "−";
    for (let i = 0; i < 3; i++) {
      ctx.fillText(sym, rodX - rodLen / 2 + 20 + i * 30, rodY + 5);
    }
  }

  function drawElectronSeaLabel(): void {
    ctx.save();
    ctx.fillStyle = "rgba(80, 160, 255, 0.5)";
    ctx.font = "italic 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const cx = LATTICE_X + (GRID_COLS * CELL_SIZE) / 2;
    ctx.fillText("\"Sea of electrons\" — delocalized, free to move", cx, LATTICE_Y + GRID_ROWS * CELL_SIZE + 42);
    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 320;
    const ph = 120;
    const px = W - pw - 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Metallic Bonding & Induction", px + 12, py + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Red circles: Fixed positive ion cores", px + 12, py + 42);
    ctx.fillText("Blue dots: Free (delocalized) electrons", px + 12, py + 58);
    ctx.fillText("External charged rod displaces electron cloud", px + 12, py + 74);
    ctx.fillText(`Rod polarity: ${polarity > 0 ? "Positive (+)" : "Negative (−)"}`, px + 12, py + 90);
    ctx.fillText(`Charge: ${chargeStrength.toFixed(1)} | Distance: ${rodDistance.toFixed(0)}%`, px + 12, py + 106);

    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawMetalBlock();
    drawIons();
    drawElectrons();
    drawChargedRod();
    drawElectronSeaLabel();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    createLattice();
  }

  function destroy(): void {
    ions = [];
    electrons = [];
  }

  function getStateDescription(): string {
    const pol = polarity > 0 ? "positive" : "negative";
    const shift = polarity > 0 ? "toward the rod (left)" : "away from the rod (right)";
    return (
      `Metallic Bonding & Electrostatic Induction: A ${GRID_COLS}x${GRID_ROWS} lattice of metal ion cores ` +
      `with ${electrons.length} free electrons. A ${pol} rod at distance ${rodDistance.toFixed(0)}% ` +
      `causes the electron cloud to shift ${shift}. ` +
      `This demonstrates the metallic bonding model: fixed positive ions in a lattice with a 'sea' of delocalized electrons.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectrostaticInductionMetalBondingFactory;
