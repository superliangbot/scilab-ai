import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DuctileMalleableFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("ductile-and-malleable-properties-of-pure-metal") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let hammerForce = 5;
  let materialType = 0; // 0 = pure metal, 1 = ionic crystal
  let showElectrons = 1;

  // Lattice state
  interface Atom {
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    vx: number;
    vy: number;
  }

  interface Electron {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }

  let atoms: Atom[] = [];
  let electrons: Electron[] = [];
  let deformation = 0;
  let shattered = false;
  let hammerY = 0;
  let hammerPhase = 0; // 0=idle, 1=striking, 2=bouncing back
  let hammerProgress = 0;

  const ROWS = 6;
  const COLS = 8;
  const SPACING = 30;

  function initLattice(): void {
    atoms = [];
    electrons = [];
    shattered = false;
    deformation = 0;

    const startX = width * 0.3;
    const startY = height * 0.35;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const offsetX = r % 2 === 0 ? 0 : SPACING * 0.5;
        const x = startX + c * SPACING + offsetX;
        const y = startY + r * SPACING;
        atoms.push({ x, y, baseX: x, baseY: y, vx: 0, vy: 0 });
      }
    }

    // Free electrons for metal
    if (materialType === 0) {
      for (let i = 0; i < 30; i++) {
        electrons.push({
          x: startX + Math.random() * COLS * SPACING,
          y: startY + Math.random() * ROWS * SPACING,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
        });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    hammerPhase = 0;
    hammerProgress = 0;
    hammerY = height * 0.05;
    initLattice();
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevType = materialType;
    hammerForce = params.hammerForce ?? 5;
    materialType = Math.round(params.materialType ?? 0);
    showElectrons = params.showElectrons ?? 1;
    time += dt;

    if (prevType !== materialType) {
      initLattice();
    }

    // Hammer animation
    const latticeTop = atoms.length > 0 ? Math.min(...atoms.map((a) => a.y)) - 15 : height * 0.3;

    if (hammerPhase === 0) {
      // Idle -> auto-strike periodically
      hammerY = height * 0.05;
      if (time % 4 < dt && !shattered) {
        hammerPhase = 1;
        hammerProgress = 0;
      }
    } else if (hammerPhase === 1) {
      // Striking down
      hammerProgress += dt * 3;
      hammerY = height * 0.05 + (latticeTop - height * 0.05) * Math.min(1, hammerProgress);
      if (hammerProgress >= 1) {
        hammerPhase = 2;
        hammerProgress = 0;
        // Apply force
        applyHammerForce();
      }
    } else if (hammerPhase === 2) {
      // Bouncing back
      hammerProgress += dt * 2;
      hammerY = latticeTop - (latticeTop - height * 0.05) * Math.min(1, hammerProgress);
      if (hammerProgress >= 1) {
        hammerPhase = 0;
      }
    }

    // Update atoms
    for (const atom of atoms) {
      if (shattered) {
        atom.x += atom.vx * dt;
        atom.y += atom.vy * dt;
        atom.vy += 200 * dt; // gravity
      } else {
        // Spring back to deformed position
        const targetX = atom.baseX;
        const targetY = atom.baseY + deformation * SPACING * 0.3;
        atom.x += (targetX - atom.x + atom.vx) * dt * 5;
        atom.y += (targetY - atom.y + atom.vy) * dt * 5;
        atom.vx *= 0.95;
        atom.vy *= 0.95;
      }
    }

    // Update electrons
    if (showElectrons && materialType === 0) {
      const minAX = Math.min(...atoms.map((a) => a.x)) - 10;
      const maxAX = Math.max(...atoms.map((a) => a.x)) + 10;
      const minAY = Math.min(...atoms.map((a) => a.y)) - 10;
      const maxAY = Math.max(...atoms.map((a) => a.y)) + 10;

      for (const e of electrons) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        // Bounce within lattice bounds
        if (e.x < minAX || e.x > maxAX) e.vx *= -1;
        if (e.y < minAY || e.y > maxAY) e.vy *= -1;
        e.x = Math.max(minAX, Math.min(maxAX, e.x));
        e.y = Math.max(minAY, Math.min(maxAY, e.y));
        // Random jitter
        e.vx += (Math.random() - 0.5) * 20;
        e.vy += (Math.random() - 0.5) * 20;
        // Speed limit
        const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
        if (speed > 80) {
          e.vx = (e.vx / speed) * 80;
          e.vy = (e.vy / speed) * 80;
        }
      }
    }
  }

  function applyHammerForce(): void {
    if (materialType === 0) {
      // Metal: deforms without breaking
      deformation += hammerForce * 0.2;
      // Shift lower rows more
      for (let i = 0; i < atoms.length; i++) {
        const row = Math.floor(i / COLS);
        atoms[i].vy += hammerForce * 3;
        // Spread horizontally
        atoms[i].baseX += (atoms[i].baseX - width * 0.45) * hammerForce * 0.01;
      }
    } else {
      // Ionic crystal: shatters
      shattered = true;
      for (const atom of atoms) {
        atom.vx = (Math.random() - 0.5) * hammerForce * 40;
        atom.vy = -Math.random() * hammerForce * 30;
      }
    }
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1a1a2e");
    bg.addColorStop(1, "#16213e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Title and material type label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      materialType === 0 ? "Pure Metal (Ductile & Malleable)" : "Ionic Crystal (Brittle)",
      width / 2,
      24
    );

    // Draw bonds between atoms
    if (!shattered) {
      ctx.strokeStyle = materialType === 0 ? "rgba(180,180,220,0.3)" : "rgba(255,200,100,0.3)";
      ctx.lineWidth = 1;
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const dx = atoms[i].x - atoms[j].x;
          const dy = atoms[i].y - atoms[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SPACING * 1.2) {
            ctx.beginPath();
            ctx.moveTo(atoms[i].x, atoms[i].y);
            ctx.lineTo(atoms[j].x, atoms[j].y);
            ctx.stroke();
          }
        }
      }
    }

    // Draw free electrons (metal only)
    if (showElectrons && materialType === 0) {
      for (const e of electrons) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100,150,255,0.7)";
        ctx.fill();
      }
    }

    // Draw atoms
    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      const row = Math.floor(i / COLS);
      const col = i % COLS;

      if (materialType === 0) {
        // Metal cations - all same
        const grad = ctx.createRadialGradient(atom.x - 2, atom.y - 2, 0, atom.x, atom.y, 10);
        grad.addColorStop(0, "#ffccaa");
        grad.addColorStop(1, "#cc7733");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // + sign
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+", atom.x, atom.y);
      } else {
        // Ionic crystal - alternating + and -
        const isPositive = (row + col) % 2 === 0;
        const color = isPositive ? "#ff6666" : "#6666ff";
        const grad = ctx.createRadialGradient(atom.x - 2, atom.y - 2, 0, atom.x, atom.y, 10);
        grad.addColorStop(0, isPositive ? "#ffaaaa" : "#aaaaff");
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(isPositive ? "+" : "−", atom.x, atom.y);
      }
    }
    ctx.textBaseline = "alphabetic";

    // Draw hammer
    const hammerX = width * 0.45;
    ctx.fillStyle = "#888";
    ctx.fillRect(hammerX - 3, hammerY - 60, 6, 60);
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.roundRect(hammerX - 25, hammerY - 65, 50, 20, 3);
    ctx.fill();
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Explanation panel
    const panelY = height * 0.7;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, panelY, width * 0.9, height - panelY - 10, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";

    if (materialType === 0) {
      ctx.fillText("Metal: Cations in a 'sea' of delocalized electrons", width * 0.08, panelY + 20);
      ctx.fillStyle = "#ccc";
      ctx.fillText("• Free electrons maintain bonds when layers slip", width * 0.08, panelY + 40);
      ctx.fillText("• Atoms slide over each other without breaking", width * 0.08, panelY + 56);
      ctx.fillText("• This gives metals ductility (stretch) and malleability (flatten)", width * 0.08, panelY + 72);
      ctx.fillStyle = "rgba(100,150,255,0.8)";
      ctx.fillText("● = free electron", width * 0.08, panelY + 92);
      ctx.fillStyle = "#cc7733";
      ctx.fillText("● = metal cation (+)", width * 0.3, panelY + 92);
    } else {
      ctx.fillText("Ionic Crystal: Fixed cations (+) and anions (−)", width * 0.08, panelY + 20);
      ctx.fillStyle = "#ccc";
      ctx.fillText("• When struck, like charges align and repel", width * 0.08, panelY + 40);
      ctx.fillText("• The crystal shatters along cleavage planes", width * 0.08, panelY + 56);
      ctx.fillText("• Ionic compounds are brittle, not malleable", width * 0.08, panelY + 72);
      if (shattered) {
        ctx.fillStyle = "#ff6666";
        ctx.fillText("SHATTERED! Reset to try again.", width * 0.08, panelY + 92);
      }
    }
  }

  function reset(): void {
    time = 0;
    hammerPhase = 0;
    hammerProgress = 0;
    initLattice();
  }

  function destroy(): void {
    atoms = [];
    electrons = [];
  }

  function getStateDescription(): string {
    return (
      `Ductile & Malleable Properties: material=${materialType === 0 ? "pure metal" : "ionic crystal"}, ` +
      `hammer force=${hammerForce}, deformation=${deformation.toFixed(1)}, ` +
      `shattered=${shattered}. ` +
      (materialType === 0
        ? "Metals are ductile/malleable because free electrons maintain metallic bonds when atomic layers slide. "
        : "Ionic crystals are brittle because displaced ions bring like charges together causing repulsion. ") +
      `${atoms.length} atoms, ${electrons.length} free electrons shown.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initLattice();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DuctileMalleableFactory;
