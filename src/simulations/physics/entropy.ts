import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EntropyFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("entropy") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let moleculeCount = 100;
  let initialAngle = 60; // degrees

  // Pendulum state
  let pendAngle = 0; // radians
  let pendOmega = 0; // angular velocity
  const pendLength = 180;
  const pivotX = 400;
  const pivotY = 80;
  const bobRadius = 20;
  const g = 9.81;

  // Molecules
  interface Molecule {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
  }
  let molecules: Molecule[] = [];

  // Container
  const BOX_LEFT = 200;
  const BOX_RIGHT = 600;
  const BOX_TOP = 100;
  const BOX_BOTTOM = 520;

  // Energy tracking
  let pendEnergy = 0;
  let molEnergy = 0;
  let initialPendEnergy = 0;

  function createMolecules(): void {
    molecules = [];
    for (let i = 0; i < moleculeCount; i++) {
      molecules.push({
        x: BOX_LEFT + 20 + Math.random() * (BOX_RIGHT - BOX_LEFT - 40),
        y: BOX_TOP + 100 + Math.random() * (BOX_BOTTOM - BOX_TOP - 120),
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        radius: 3,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    pendAngle = (initialAngle * Math.PI) / 180;
    pendOmega = 0;
    initialPendEnergy = g * pendLength * (1 - Math.cos(pendAngle));
    createMolecules();
  }

  function getBobPos(): { x: number; y: number } {
    return {
      x: pivotX + pendLength * Math.sin(pendAngle),
      y: pivotY + pendLength * Math.cos(pendAngle),
    };
  }

  function update(dt: number, params: Record<string, number>): void {
    const newMolCount = Math.round(params.moleculeCount ?? 100);
    if (newMolCount !== moleculeCount) {
      moleculeCount = newMolCount;
      createMolecules();
    }
    initialAngle = params.initialAngle ?? 60;

    const dtClamped = Math.min(dt, 0.03);
    time += dtClamped;

    // Pendulum physics with damping from molecule collisions
    const dampingFromMols = 0.0005 * moleculeCount;
    const alpha = -(g / pendLength) * Math.sin(pendAngle) - dampingFromMols * pendOmega;
    pendOmega += alpha * dtClamped;
    pendAngle += pendOmega * dtClamped;

    const bob = getBobPos();

    // Update molecules
    for (const mol of molecules) {
      mol.x += mol.vx * dtClamped;
      mol.y += mol.vy * dtClamped;

      // Wall collisions
      if (mol.x - mol.radius < BOX_LEFT) {
        mol.x = BOX_LEFT + mol.radius;
        mol.vx = Math.abs(mol.vx);
      }
      if (mol.x + mol.radius > BOX_RIGHT) {
        mol.x = BOX_RIGHT - mol.radius;
        mol.vx = -Math.abs(mol.vx);
      }
      if (mol.y - mol.radius < BOX_TOP) {
        mol.y = BOX_TOP + mol.radius;
        mol.vy = Math.abs(mol.vy);
      }
      if (mol.y + mol.radius > BOX_BOTTOM) {
        mol.y = BOX_BOTTOM - mol.radius;
        mol.vy = -Math.abs(mol.vy);
      }

      // Collision with pendulum bob
      const dx = mol.x - bob.x;
      const dy = mol.y - bob.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = mol.radius + bobRadius;
      if (dist < minDist && dist > 0) {
        // Transfer energy from bob to molecule
        const nx = dx / dist;
        const ny = dy / dist;
        const bobVx = pendOmega * pendLength * Math.cos(pendAngle);
        const bobVy = -pendOmega * pendLength * Math.sin(pendAngle);
        const relVx = mol.vx - bobVx * 0.1;
        const relVy = mol.vy - bobVy * 0.1;
        const relDot = relVx * nx + relVy * ny;

        if (relDot < 0) {
          mol.vx -= relDot * nx * 0.8;
          mol.vy -= relDot * ny * 0.8;
          pendOmega *= 0.998; // Slight energy loss from bob
        }

        // Separate
        mol.x = bob.x + nx * minDist;
        mol.y = bob.y + ny * minDist;
      }
    }

    // Compute energies
    const bobSpeed = pendOmega * pendLength;
    const bobHeight = pendLength * (1 - Math.cos(pendAngle));
    pendEnergy = 0.5 * bobSpeed * bobSpeed + g * bobHeight;

    molEnergy = 0;
    for (const mol of molecules) {
      molEnergy += 0.5 * (mol.vx * mol.vx + mol.vy * mol.vy);
    }
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawContainer(): void {
    ctx.strokeStyle = "rgba(100, 140, 200, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(BOX_LEFT, BOX_TOP, BOX_RIGHT - BOX_LEFT, BOX_BOTTOM - BOX_TOP);
    ctx.fillStyle = "rgba(20, 30, 60, 0.3)";
    ctx.fillRect(BOX_LEFT, BOX_TOP, BOX_RIGHT - BOX_LEFT, BOX_BOTTOM - BOX_TOP);
  }

  function drawPendulum(): void {
    const bob = getBobPos();

    // String/rod
    ctx.strokeStyle = "rgba(200, 200, 200, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bob.x, bob.y);
    ctx.stroke();

    // Pivot
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#888";
    ctx.fill();

    // Bob
    const bobGrad = ctx.createRadialGradient(bob.x - 5, bob.y - 5, 0, bob.x, bob.y, bobRadius);
    bobGrad.addColorStop(0, "#ff6060");
    bobGrad.addColorStop(1, "#cc2020");
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = bobGrad;
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(bob.x, bob.y, bobRadius, bob.x, bob.y, bobRadius * 2);
    glow.addColorStop(0, "rgba(255, 80, 80, 0.2)");
    glow.addColorStop(1, "rgba(255, 80, 80, 0)");
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, bobRadius * 2, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Max angle arcs
    ctx.save();
    ctx.strokeStyle = "rgba(255, 165, 0, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const maxAngle = (initialAngle * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, pendLength + bobRadius, Math.PI / 2 - maxAngle, Math.PI / 2 + maxAngle);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawMolecules(): void {
    const avgSpeed = molecules.reduce((s, m) => s + Math.sqrt(m.vx * m.vx + m.vy * m.vy), 0) / Math.max(1, molecules.length);
    const maxSpeed = avgSpeed * 3;

    for (const mol of molecules) {
      const speed = Math.sqrt(mol.vx * mol.vx + mol.vy * mol.vy);
      const t = Math.min(speed / maxSpeed, 1);

      // Color: blue (slow) → cyan → yellow (fast)
      const r = Math.round(30 + 225 * t);
      const g = Math.round(130 + 125 * (1 - Math.abs(t - 0.5) * 2));
      const b = Math.round(255 * (1 - t));

      ctx.beginPath();
      ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }
  }

  function drawEnergyBar(): void {
    const bx = 640;
    const by = 120;
    const bw = 130;
    const bh = 280;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh + 40, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy", bx + bw / 2, by + 16);

    const totalE = Math.max(1, initialPendEnergy * 1000);
    const pendFrac = Math.min(1, (pendEnergy / totalE));
    const barX = bx + 20;
    const barW = bw - 40;
    const barY = by + 30;
    const barH = bh - 40;

    // Pendulum energy (red, bottom up)
    const pendH = pendFrac * barH;
    ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
    ctx.fillRect(barX, barY + barH - pendH, barW, pendH);

    // Thermal energy fills the rest
    ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
    ctx.fillRect(barX, barY, barW, barH - pendH);

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#ef4444";
    ctx.textAlign = "center";
    ctx.fillText("Pendulum KE+PE", bx + bw / 2, barY + barH + 14);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("Thermal (molecular)", bx + bw / 2, barY + barH + 28);
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 250;
    const ph = 100;
    const px = 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Entropy & Energy Dissipation", px + 12, py + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Molecules: ${moleculeCount}`, px + 12, py + 42);
    ctx.fillText(`Pendulum angle: ${(pendAngle * 180 / Math.PI).toFixed(1)}°`, px + 12, py + 58);
    ctx.fillText(`Time: ${time.toFixed(1)}s`, px + 12, py + 74);
    ctx.fillText("Ordered energy → Disordered (thermal)", px + 12, py + 90);

    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawContainer();
    drawMolecules();
    drawPendulum();
    drawEnergyBar();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    pendAngle = (initialAngle * Math.PI) / 180;
    pendOmega = 0;
    initialPendEnergy = g * pendLength * (1 - Math.cos(pendAngle));
    createMolecules();
  }

  function destroy(): void {
    molecules = [];
  }

  function getStateDescription(): string {
    const ampDeg = (Math.abs(pendAngle) * 180 / Math.PI).toFixed(1);
    return (
      `Entropy simulation: A pendulum swings among ${moleculeCount} gas molecules. ` +
      `Current amplitude: ${ampDeg}°. Time: ${time.toFixed(1)}s. ` +
      `The pendulum loses energy to molecules through collisions (2nd law of thermodynamics). ` +
      `Ordered mechanical energy degrades into disordered thermal motion. This process is irreversible.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EntropyFactory;
