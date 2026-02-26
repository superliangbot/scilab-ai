import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StoichiometryWaterSynthesisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stoichiometry-with-water-synthesis") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let h2Molecules = 2;
  let showBalanced = 1;
  let animSpeed = 1;
  let showCounts = 1;

  interface Molecule {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "H2" | "O2" | "H2O";
    angle: number;
  }

  let molecules: Molecule[] = [];
  let reactionPhase = 0; // 0-10 cycle

  function setupMolecules(): void {
    molecules = [];
    const h2Count = Math.floor(h2Molecules);
    const o2Count = Math.floor(h2Count / 2);
    const h2oCount = h2Count;
    const cy = height * 0.55;

    for (let i = 0; i < h2Count; i++) {
      molecules.push({
        x: 30 + Math.random() * (width * 0.35),
        y: cy - 60 + Math.random() * 120,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.5) * 25,
        type: "H2",
        angle: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < o2Count; i++) {
      molecules.push({
        x: 30 + Math.random() * (width * 0.35),
        y: cy - 40 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 18,
        type: "O2",
        angle: Math.random() * Math.PI * 2,
      });
    }

    for (let i = 0; i < h2oCount; i++) {
      molecules.push({
        x: width * 0.6 + Math.random() * (width * 0.3),
        y: cy - 50 + Math.random() * 100,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        type: "H2O",
        angle: Math.random() * Math.PI * 2,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    setupMolecules();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    const prevH2 = h2Molecules;
    h2Molecules = params.h2Molecules ?? 2;
    showBalanced = params.showBalanced ?? 1;
    animSpeed = params.animSpeed ?? 1;
    showCounts = params.showCounts ?? 1;

    if (Math.floor(prevH2) !== Math.floor(h2Molecules)) {
      setupMolecules();
    }

    time += step * animSpeed;
    const cycle = time % 10;
    reactionPhase = cycle;

    for (const mol of molecules) {
      mol.angle += step * 1.2;

      if (cycle < 3) {
        // Reactants move freely on the left
        if (mol.type !== "H2O") {
          mol.x += mol.vx * step;
          mol.y += mol.vy * step;
          if (mol.x < 15) { mol.x = 15; mol.vx *= -1; }
          if (mol.x > width * 0.42) { mol.x = width * 0.42; mol.vx *= -1; }
          if (mol.y < height * 0.2) { mol.y = height * 0.2; mol.vy *= -1; }
          if (mol.y > height * 0.85) { mol.y = height * 0.85; mol.vy *= -1; }
        }
      } else if (cycle < 5) {
        // Combine toward center
        if (mol.type !== "H2O") {
          const cx = width * 0.48;
          const cy = height * 0.55;
          const t = (cycle - 3) / 2;
          mol.x += (cx - mol.x) * t * step * 3;
          mol.y += (cy - mol.y) * t * step * 3;
        }
      } else if (cycle < 9) {
        // Products float on the right
        if (mol.type === "H2O") {
          mol.x += mol.vx * step * 0.4;
          mol.y += mol.vy * step * 0.4;
          if (mol.x < width * 0.52) { mol.x = width * 0.52; mol.vx *= -1; }
          if (mol.x > width - 15) { mol.x = width - 15; mol.vx *= -1; }
          if (mol.y < height * 0.2) { mol.y = height * 0.2; mol.vy *= -1; }
          if (mol.y > height * 0.85) { mol.y = height * 0.85; mol.vy *= -1; }
        }
      }
    }

    if (cycle > 9.5 && (cycle - step * animSpeed) % 10 < 9.5) {
      setupMolecules();
    }
  }

  function drawAtomPair(x: number, y: number, angle: number, alpha: number,
    c1: string, c2: string, r: number, sep: number, label: string, labelColor: string): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
    for (const dx of [-sep, sep]) {
      const g = ctx.createRadialGradient(dx, 0, 0, dx, 0, r);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(dx, 0, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(150,150,150,0.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-sep + r * 0.4, 0); ctx.lineTo(sep - r * 0.4, 0); ctx.stroke();
    ctx.fillStyle = labelColor; ctx.font = `bold ${Math.max(6, r - 1)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.fillText(label, -sep, 3); ctx.fillText(label, sep, 3);
    ctx.globalAlpha = 1; ctx.restore();
  }

  function drawH2(x: number, y: number, a: number, al: number): void {
    drawAtomPair(x, y, a, al, "#ffffff", "#b0b8c0", 7, 6, "H", "#555");
  }

  function drawO2(x: number, y: number, a: number, al: number): void {
    drawAtomPair(x, y, a, al, "#ff6666", "#aa2222", 9, 9, "O", "#fff");
  }

  function drawH2O(x: number, y: number, angle: number, alpha: number): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle * 0.2); ctx.globalAlpha = alpha;
    const oGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    oGrad.addColorStop(0, "#ff6666"); oGrad.addColorStop(1, "#bb2222");
    ctx.fillStyle = oGrad; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    const ba = (104.5 * Math.PI) / 180, bl = 14;
    const positions = [
      { x: -Math.sin(ba / 2) * bl, y: Math.cos(ba / 2) * bl },
      { x: Math.sin(ba / 2) * bl, y: Math.cos(ba / 2) * bl },
    ];
    for (const hp of positions) {
      const hg = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 6);
      hg.addColorStop(0, "#ffffff"); hg.addColorStop(1, "#aabbcc");
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hp.x, hp.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(200,200,200,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hp.x, hp.y); ctx.stroke();
    }
    ctx.fillStyle = "#fff"; ctx.font = "bold 8px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.fillText("O", 0, 4);
    ctx.globalAlpha = 1; ctx.restore();
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#1a1a30");
    bgGrad.addColorStop(0.5, "#0e2a40");
    bgGrad.addColorStop(1, "#1a2a3a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cycle = reactionPhase % 10;
    const h2Count = Math.floor(h2Molecules);
    const o2Count = Math.floor(h2Count / 2);
    const h2oCount = h2Count;

    // Zone labels
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (cycle < 5) {
      ctx.fillText("REACTANTS", width * 0.25, height * 0.5);
    }
    if (cycle >= 5) {
      ctx.fillText("PRODUCTS", width * 0.75, height * 0.5);
    }

    // Reaction arrow
    const arrowX = width * 0.48;
    const arrowY = height * 0.55;
    const arrowGlow = cycle >= 3 && cycle < 5.5 ? 0.8 : 0.3;
    ctx.fillStyle = `rgba(255,200,50,${arrowGlow})`;
    ctx.beginPath();
    ctx.moveTo(arrowX - 5, arrowY - 15);
    ctx.lineTo(arrowX + 20, arrowY);
    ctx.lineTo(arrowX - 5, arrowY + 15);
    ctx.closePath();
    ctx.fill();

    // Flash
    if (cycle >= 4.5 && cycle < 5.5) {
      const flash = 1 - Math.abs(cycle - 5) * 2;
      ctx.fillStyle = `rgba(255,220,150,${flash * 0.12})`;
      ctx.fillRect(0, 0, width, height);
    }

    const showReactants = cycle < 5;
    const combining = cycle >= 3 && cycle < 5;
    const showProducts = cycle >= 5 && cycle < 9.5;

    for (const mol of molecules) {
      if (mol.type === "H2" && showReactants) {
        const a = combining ? Math.max(0, 1 - (cycle - 3) / 2) : 1;
        drawH2(mol.x, mol.y, mol.angle, a);
      } else if (mol.type === "O2" && showReactants) {
        const a = combining ? Math.max(0, 1 - (cycle - 3) / 2) : 1;
        drawO2(mol.x, mol.y, mol.angle, a);
      } else if (mol.type === "H2O" && showProducts) {
        const a = Math.min(1, (cycle - 5) * 2);
        drawH2O(mol.x, mol.y, mol.angle, a);
      }
    }

    // Balanced equation
    if (showBalanced > 0.5) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(width * 0.1, 8, width * 0.8, 42, 8);
      ctx.fill();

      ctx.textAlign = "center";
      const eqY = 35;
      const eqX = width / 2;

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#ddeeff";
      ctx.fillText("2H", eqX - 100, eqY);
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText("2", eqX - 85, eqY + 4);

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("+", eqX - 60, eqY);

      ctx.fillStyle = "#ff6666";
      ctx.fillText("O", eqX - 35, eqY);
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText("2", eqX - 27, eqY + 4);

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#ffcc00";
      ctx.fillText("\u2192", eqX, eqY);

      ctx.fillStyle = "#66bbff";
      ctx.fillText("2H", eqX + 40, eqY);
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText("2", eqX + 55, eqY + 4);
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText("O", eqX + 65, eqY);
    }

    // Counts
    if (showCounts > 0.5) {
      const countY = height - 85;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(10, countY, width - 20, 75, 8);
      ctx.fill();

      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#ddeeff";
      ctx.fillText(`H\u2082 molecules: ${h2Count}`, 25, countY + 20);
      ctx.fillStyle = "#ff6666";
      ctx.fillText(`O\u2082 molecules: ${o2Count}`, 25, countY + 38);
      ctx.fillStyle = "#66bbff";
      ctx.fillText(`H\u2082O produced: ${h2oCount}`, 25, countY + 56);

      ctx.textAlign = "right";
      ctx.fillStyle = "#aaa";
      ctx.fillText(`Mole ratio:  2 : 1 : 2`, width - 25, countY + 20);
      ctx.fillStyle = "#888";
      ctx.fillText(`Bond angle in H\u2082O: 104.5\u00B0`, width - 25, countY + 38);

      // Limiting reagent concept
      const excessH2 = h2Count - o2Count * 2;
      if (excessH2 > 0 && h2Count % 2 !== 0) {
        ctx.fillStyle = "#ff8888";
        ctx.fillText(`O\u2082 is limiting reagent (${excessH2} excess H\u2082)`, width - 25, countY + 56);
      } else {
        ctx.fillStyle = "#88ff88";
        ctx.fillText(`Stoichiometric (no excess)`, width - 25, countY + 56);
      }
    }

    // Phase indicator
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(8, 55, 180, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#88ccff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Water Synthesis Reaction", 15, 71);
  }

  function reset(): void {
    time = 0;
    reactionPhase = 0;
    setupMolecules();
  }

  function destroy(): void {
    molecules = [];
  }

  function getStateDescription(): string {
    const h2Count = Math.floor(h2Molecules);
    const o2Count = Math.floor(h2Count / 2);
    return (
      `Stoichiometry: Water synthesis 2H\u2082 + O\u2082 \u2192 2H\u2082O. ` +
      `${h2Count} H\u2082 + ${o2Count} O\u2082 \u2192 ${h2Count} H\u2082O. ` +
      `Mole ratio 2:1:2. Water bond angle = 104.5\u00B0.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupMolecules();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StoichiometryWaterSynthesisFactory;
