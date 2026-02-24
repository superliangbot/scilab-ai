import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectricCurrentFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electric-current") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let numBatteries = 2;
  let materialType = 0; // 0=conductor, 1=insulator
  let showLabels = 1;

  interface Atom {
    x: number;
    y: number;
    protons: number;
  }

  interface Electron {
    x: number;
    y: number;
    vx: number;
    vy: number;
    bound: boolean; // true if bound to atom (insulator)
    atomIdx: number; // which atom it orbits (-1 if free)
    orbitAngle: number;
  }

  let atoms: Atom[] = [];
  let electrons: Electron[] = [];

  const ATOM_SPACING = 50;
  const ROWS = 3;
  const COLS = 6;

  function initMaterial(): void {
    atoms = [];
    electrons = [];

    const startX = width * 0.2;
    const startY = height * 0.3;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = startX + c * ATOM_SPACING;
        const y = startY + r * ATOM_SPACING;
        atoms.push({ x, y, protons: materialType === 0 ? 1 : 2 });
      }
    }

    if (materialType === 0) {
      // Conductor: free electrons
      for (let i = 0; i < 25; i++) {
        electrons.push({
          x: startX + Math.random() * (COLS - 1) * ATOM_SPACING,
          y: startY + Math.random() * (ROWS - 1) * ATOM_SPACING,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          bound: false,
          atomIdx: -1,
          orbitAngle: 0,
        });
      }
    } else {
      // Insulator: bound electrons orbiting atoms
      for (let i = 0; i < atoms.length; i++) {
        for (let j = 0; j < 2; j++) {
          electrons.push({
            x: atoms[i].x,
            y: atoms[i].y,
            vx: 0,
            vy: 0,
            bound: true,
            atomIdx: i,
            orbitAngle: Math.random() * Math.PI * 2,
          });
        }
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initMaterial();
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevMat = materialType;
    numBatteries = Math.round(params.numBatteries ?? 2);
    materialType = Math.round(params.materialType ?? 0);
    showLabels = params.showLabels ?? 1;
    time += dt;

    if (prevMat !== materialType) initMaterial();

    const voltageForce = numBatteries * 15; // pixels/s² drift force

    for (const e of electrons) {
      if (e.bound) {
        // Insulator: orbit around atom
        e.orbitAngle += dt * 3;
        const atom = atoms[e.atomIdx];
        if (atom) {
          const orbitR = 15;
          e.x = atom.x + orbitR * Math.cos(e.orbitAngle);
          e.y = atom.y + orbitR * Math.sin(e.orbitAngle);

          // Slight vibration from voltage but no drift
          e.x += Math.sin(time * 5) * voltageForce * 0.02;
        }
      } else {
        // Conductor: free electron drift
        // Electric field pushes electrons to the right (conventional current left)
        e.vx += voltageForce * dt;

        // Thermal random motion
        e.vx += (Math.random() - 0.5) * 100 * dt;
        e.vy += (Math.random() - 0.5) * 100 * dt;

        // Scattering (collisions with lattice)
        for (const atom of atoms) {
          const dx = e.x - atom.x;
          const dy = e.y - atom.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 12) {
            // Bounce
            e.vx = -e.vx * 0.5 + (Math.random() - 0.5) * 30;
            e.vy = -e.vy * 0.5 + (Math.random() - 0.5) * 30;
          }
        }

        // Speed limit
        const speed = Math.sqrt(e.vx ** 2 + e.vy ** 2);
        const maxSpeed = 80 + voltageForce;
        if (speed > maxSpeed) {
          e.vx *= maxSpeed / speed;
          e.vy *= maxSpeed / speed;
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // Wrap around (current flows in loop)
        const startX = width * 0.2 - 30;
        const endX = width * 0.2 + (COLS - 1) * ATOM_SPACING + 30;
        const startY = height * 0.3 - 30;
        const endY = height * 0.3 + (ROWS - 1) * ATOM_SPACING + 30;

        if (e.x > endX) e.x = startX;
        if (e.x < startX) e.x = endX;
        if (e.y > endY) { e.y = endY; e.vy = -Math.abs(e.vy); }
        if (e.y < startY) { e.y = startY; e.vy = Math.abs(e.vy); }
      }
    }
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0f0f2a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      materialType === 0 ? "Conductor — Free Electrons" : "Insulator — Bound Electrons",
      width / 2,
      24
    );

    // Battery section (left side)
    const batX = width * 0.06;
    for (let i = 0; i < 3; i++) {
      const batY = height * 0.3 + i * 50;
      const active = i < numBatteries;

      ctx.fillStyle = active ? "rgba(255,215,0,0.2)" : "rgba(100,100,100,0.1)";
      ctx.beginPath();
      ctx.roundRect(batX - 15, batY - 18, 30, 36, 4);
      ctx.fill();

      ctx.strokeStyle = active ? "#FFD700" : "#555";
      ctx.lineWidth = 2;
      // Positive terminal
      ctx.beginPath();
      ctx.moveTo(batX - 8, batY - 12);
      ctx.lineTo(batX - 8, batY + 12);
      ctx.stroke();
      // Negative terminal
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(batX + 5, batY - 6);
      ctx.lineTo(batX + 5, batY + 6);
      ctx.stroke();

      if (active) {
        ctx.fillStyle = "#FFD700";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${1.5}V`, batX, batY - 22);
      }
    }

    // Connection wires
    ctx.strokeStyle = "rgba(255,215,0,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(batX + 15, height * 0.3);
    ctx.lineTo(width * 0.18, height * 0.3);
    ctx.stroke();

    // Material region
    const matX = width * 0.18;
    const matY = height * 0.25;
    const matW = COLS * ATOM_SPACING + 20;
    const matH = ROWS * ATOM_SPACING + 20;

    ctx.fillStyle = materialType === 0 ? "rgba(180,140,80,0.15)" : "rgba(100,100,150,0.15)";
    ctx.beginPath();
    ctx.roundRect(matX, matY, matW, matH, 8);
    ctx.fill();
    ctx.strokeStyle = materialType === 0 ? "rgba(180,140,80,0.4)" : "rgba(100,100,150,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw atoms
    for (const atom of atoms) {
      const grad = ctx.createRadialGradient(atom.x, atom.y, 0, atom.x, atom.y, 10);
      grad.addColorStop(0, "#ff8888");
      grad.addColorStop(1, "#cc4444");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", atom.x, atom.y);
    }
    ctx.textBaseline = "alphabetic";

    // Draw electrons
    for (const e of electrons) {
      ctx.fillStyle = e.bound ? "#6688ff" : "#44ccff";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Electron trail for free electrons
      if (!e.bound) {
        ctx.fillStyle = "rgba(68,204,255,0.15)";
        ctx.beginPath();
        ctx.arc(e.x - e.vx * 0.03, e.y - e.vy * 0.03, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#fff";
      ctx.font = "bold 7px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", e.x, e.y);
    }
    ctx.textBaseline = "alphabetic";

    // Electric field arrows (if batteries active)
    if (numBatteries > 0 && materialType === 0) {
      ctx.fillStyle = "rgba(255,200,50,0.3)";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("→ E (electric field)", width * 0.45, height * 0.23);

      for (let i = 0; i < 3; i++) {
        const ax = width * 0.3 + i * ATOM_SPACING * 1.5;
        const ay = height * 0.23 - 5;
        ctx.strokeStyle = "rgba(255,200,50,0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + 20, ay);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax + 20, ay);
        ctx.lineTo(ax + 15, ay - 3);
        ctx.moveTo(ax + 20, ay);
        ctx.lineTo(ax + 15, ay + 3);
        ctx.stroke();
      }
    }

    // Explanation panel
    const panelY = height * 0.65;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(10, panelY, width - 20, height - panelY - 10, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Electric Current in Materials", 20, panelY + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#ccc";

    if (materialType === 0) {
      ctx.fillText("Conductor: Metal atoms form a lattice with delocalized (free) electrons.", 20, panelY + 42);
      ctx.fillText("Voltage from batteries creates an electric field → electrons drift.", 20, panelY + 58);
      ctx.fillText(`Batteries: ${numBatteries} × 1.5V = ${(numBatteries * 1.5).toFixed(1)}V`, 20, panelY + 78);
      ctx.fillStyle = "#44ccff";
      ctx.fillText("● Free electrons move opposite to conventional current direction.", 20, panelY + 98);
    } else {
      ctx.fillText("Insulator: Electrons are tightly bound to individual atoms.", 20, panelY + 42);
      ctx.fillText("No free electrons → electric field cannot cause sustained current flow.", 20, panelY + 58);
      ctx.fillText("Electrons may vibrate slightly but do not drift through the material.", 20, panelY + 78);
      ctx.fillStyle = "#6688ff";
      ctx.fillText("● Bound electrons orbit their parent atoms.", 20, panelY + 98);
    }

    if (showLabels) {
      // Legend
      ctx.fillStyle = "#ff8888";
      ctx.beginPath();
      ctx.arc(width - 120, panelY + 42, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("Atom (+)", width - 110, panelY + 45);

      ctx.fillStyle = "#44ccff";
      ctx.beginPath();
      ctx.arc(width - 120, panelY + 62, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText("Electron (−)", width - 110, panelY + 65);
    }
  }

  function reset(): void {
    time = 0;
    initMaterial();
  }

  function destroy(): void {
    atoms = [];
    electrons = [];
  }

  function getStateDescription(): string {
    const freeCount = electrons.filter((e) => !e.bound).length;
    const boundCount = electrons.filter((e) => e.bound).length;
    return (
      `Electric Current: material=${materialType === 0 ? "conductor" : "insulator"}, ` +
      `batteries=${numBatteries} (${(numBatteries * 1.5).toFixed(1)}V total). ` +
      `Free electrons: ${freeCount}, bound electrons: ${boundCount}, atoms: ${atoms.length}. ` +
      (materialType === 0
        ? "In conductors, free electrons drift under electric field, creating current (I = nAv_d). "
        : "In insulators, electrons are bound to atoms and cannot flow freely. ") +
      `Conventional current flows + to −, but electrons flow − to +.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initMaterial();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectricCurrentFactory;
