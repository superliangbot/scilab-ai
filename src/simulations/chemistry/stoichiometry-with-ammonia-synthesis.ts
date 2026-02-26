import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StoichiometryAmmoniaSynthesisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stoichiometry-with-ammonia-synthesis") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let n2Molecules = 1;
  let showBalanced = 1;
  let animSpeed = 1;
  let showCounts = 1;

  interface Molecule {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "N2" | "H2" | "NH3";
    angle: number;
    phase: number; // 0 = reactant free, 1 = combining, 2 = product
    targetX: number;
    targetY: number;
  }

  let molecules: Molecule[] = [];
  let reactionProgress = 0;

  function setupMolecules(): void {
    molecules = [];
    reactionProgress = 0;
    const n2Count = Math.floor(n2Molecules);
    const h2Count = n2Count * 3;
    const nh3Count = n2Count * 2;

    const reactantZone = width * 0.3;
    const productZone = width * 0.75;
    const cy = height * 0.55;

    // N2 molecules (reactants)
    for (let i = 0; i < n2Count; i++) {
      molecules.push({
        x: reactantZone * 0.3 + Math.random() * reactantZone * 0.4,
        y: cy - 60 + Math.random() * 120,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        type: "N2",
        angle: Math.random() * Math.PI * 2,
        phase: 0,
        targetX: productZone + Math.random() * 60 - 30,
        targetY: cy + (i - n2Count / 2) * 40,
      });
    }

    // H2 molecules (reactants)
    for (let i = 0; i < h2Count; i++) {
      molecules.push({
        x: reactantZone * 0.5 + Math.random() * reactantZone * 0.5,
        y: cy - 70 + Math.random() * 140,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        type: "H2",
        angle: Math.random() * Math.PI * 2,
        phase: 0,
        targetX: productZone + Math.random() * 80 - 40,
        targetY: cy + (i - h2Count / 2) * 25,
      });
    }

    // NH3 molecules (products, hidden initially)
    for (let i = 0; i < nh3Count; i++) {
      molecules.push({
        x: productZone + (i - nh3Count / 2) * 50,
        y: cy,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        type: "NH3",
        angle: Math.random() * Math.PI * 2,
        phase: 2,
        targetX: productZone + (i - nh3Count / 2) * 50,
        targetY: cy,
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
    const prevN2 = n2Molecules;
    n2Molecules = params.n2Molecules ?? 1;
    showBalanced = params.showBalanced ?? 1;
    animSpeed = params.animSpeed ?? 1;
    showCounts = params.showCounts ?? 1;

    if (Math.floor(prevN2) !== Math.floor(n2Molecules)) {
      setupMolecules();
    }

    time += step * animSpeed;

    // Cycle: 0-3s reactants move, 3-5s combining, 5-8s products, 8-10s reset
    const cycle = time % 10;
    reactionProgress = cycle;

    for (const mol of molecules) {
      mol.angle += step * 1.5;

      if (cycle < 3) {
        // Reactants move around freely
        if (mol.phase !== 2) {
          mol.x += mol.vx * step;
          mol.y += mol.vy * step;
          // Bounce in left zone
          const zone = width * 0.45;
          if (mol.x < 20) { mol.x = 20; mol.vx *= -1; }
          if (mol.x > zone) { mol.x = zone; mol.vx *= -1; }
          if (mol.y < height * 0.25) { mol.y = height * 0.25; mol.vy *= -1; }
          if (mol.y > height * 0.8) { mol.y = height * 0.8; mol.vy *= -1; }
        }
      } else if (cycle < 5) {
        // Move toward center for combining
        const combineX = width * 0.5;
        const combineY = height * 0.55;
        if (mol.type !== "NH3") {
          const t = (cycle - 3) / 2;
          mol.x += (combineX - mol.x) * t * step * 3;
          mol.y += (combineY - mol.y) * t * step * 3;
        }
      } else if (cycle < 8) {
        // Products appear and move
        if (mol.type === "NH3") {
          mol.x += mol.vx * step * 0.5;
          mol.y += mol.vy * step * 0.5;
          const prodLeft = width * 0.55;
          const prodRight = width - 20;
          if (mol.x < prodLeft) { mol.x = prodLeft; mol.vx *= -1; }
          if (mol.x > prodRight) { mol.x = prodRight; mol.vx *= -1; }
          if (mol.y < height * 0.3) { mol.y = height * 0.3; mol.vy *= -1; }
          if (mol.y > height * 0.8) { mol.y = height * 0.8; mol.vy *= -1; }
        }
      }
    }

    // Reset cycle
    if (cycle > 9.5 && (cycle - step * animSpeed) % 10 < 9.5) {
      setupMolecules();
    }
  }

  function drawAtomPair(x: number, y: number, angle: number, alpha: number,
    c1: string, c2: string, r: number, sep: number, label: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    for (const dx of [-sep, sep]) {
      const g = ctx.createRadialGradient(dx, 0, 0, dx, 0, r);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(dx, 0, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(200,200,200,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-sep + r * 0.4, 0); ctx.lineTo(sep - r * 0.4, 0); ctx.stroke();
    ctx.fillStyle = c2 === "#2244aa" ? "#fff" : "#333";
    ctx.font = `bold ${Math.max(6, r - 2)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, -sep, 3); ctx.fillText(label, sep, 3);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawN2(x: number, y: number, angle: number, alpha: number): void {
    drawAtomPair(x, y, angle, alpha, "#6699ff", "#2244aa", 10, 8, "N");
  }

  function drawH2(x: number, y: number, angle: number, alpha: number): void {
    drawAtomPair(x, y, angle, alpha, "#ffffff", "#aabbcc", 7, 5, "H");
  }

  function drawNH3(x: number, y: number, angle: number, alpha: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * 0.3);
    ctx.globalAlpha = alpha;
    const nGrad = ctx.createRadialGradient(0, -2, 0, 0, -2, 10);
    nGrad.addColorStop(0, "#66cc88"); nGrad.addColorStop(1, "#228844");
    ctx.fillStyle = nGrad;
    ctx.beginPath(); ctx.arc(0, -2, 10, 0, Math.PI * 2); ctx.fill();
    for (const hp of [{ x: -12, y: 10 }, { x: 12, y: 10 }, { x: 0, y: -14 }]) {
      const hg = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, 6);
      hg.addColorStop(0, "#ffffff"); hg.addColorStop(1, "#bbccbb");
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(hp.x, hp.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(200,200,200,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(hp.x, hp.y); ctx.stroke();
    }
    ctx.fillStyle = "#fff"; ctx.font = "bold 7px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.fillText("N", 0, 1);
    ctx.globalAlpha = 1; ctx.restore();
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#1a1a2e");
    bgGrad.addColorStop(0.5, "#16213e");
    bgGrad.addColorStop(1, "#0f3460");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cycle = reactionProgress % 10;
    const n2Count = Math.floor(n2Molecules);

    // Arrow in middle
    const arrowX = width * 0.48;
    const arrowY = height * 0.55;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY - 12);
    ctx.lineTo(arrowX + 20, arrowY);
    ctx.lineTo(arrowX, arrowY + 12);
    ctx.closePath();
    ctx.fill();

    // Draw molecules based on phase
    const showReactants = cycle < 5;
    const combiningPhase = cycle >= 3 && cycle < 5;
    const showProducts = cycle >= 5 && cycle < 9.5;
    const flashAlpha = cycle >= 4.5 && cycle < 5.5 ? 1 - Math.abs(cycle - 5) * 2 : 0;

    // Flash effect during reaction
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,200,${flashAlpha * 0.15})`;
      ctx.fillRect(0, 0, width, height);
    }

    for (const mol of molecules) {
      if (mol.type === "N2" && showReactants) {
        const alpha = combiningPhase ? Math.max(0, 1 - (cycle - 3) / 2) : 1;
        drawN2(mol.x, mol.y, mol.angle, alpha);
      } else if (mol.type === "H2" && showReactants) {
        const alpha = combiningPhase ? Math.max(0, 1 - (cycle - 3) / 2) : 1;
        drawH2(mol.x, mol.y, mol.angle, alpha);
      } else if (mol.type === "NH3" && showProducts) {
        const alpha = Math.min(1, (cycle - 5) * 2);
        drawNH3(mol.x, mol.y, mol.angle, alpha);
      }
    }

    // Equation panel at top
    if (showBalanced > 0.5) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(width * 0.1, 8, width * 0.8, 42, 8);
      ctx.fill();

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      const eqY = 35;
      const eqX = width / 2;

      ctx.fillStyle = "#6699ff";
      ctx.fillText("N", eqX - 120, eqY);
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText("2", eqX - 110, eqY + 4);

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("+", eqX - 85, eqY);

      ctx.fillStyle = "#ddeeff";
      ctx.fillText("3H", eqX - 55, eqY);
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText("2", eqX - 40, eqY + 4);

      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "#ffcc00";
      ctx.fillText("\u2192", eqX - 10, eqY);

      ctx.fillStyle = "#66cc88";
      ctx.fillText("2NH", eqX + 35, eqY);
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.fillText("3", eqX + 60, eqY + 4);
    }

    // Molecule counts
    if (showCounts > 0.5) {
      const countY = height - 80;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(10, countY, width - 20, 70, 8);
      ctx.fill();

      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#6699ff";
      ctx.fillText(`N\u2082 molecules: ${n2Count}`, 25, countY + 20);
      ctx.fillStyle = "#ddeeff";
      ctx.fillText(`H\u2082 molecules: ${n2Count * 3}`, 25, countY + 38);
      ctx.fillStyle = "#66cc88";
      ctx.fillText(`NH\u2083 produced: ${n2Count * 2}`, 25, countY + 56);

      ctx.textAlign = "right";
      ctx.fillStyle = "#aaa";
      ctx.fillText(`Mole ratio:  1 : 3 : 2`, width - 25, countY + 20);
      ctx.fillStyle = "#888";
      ctx.fillText(`Haber Process (Fe catalyst, 450\u00B0C, 200 atm)`, width - 25, countY + 38);
      ctx.fillText(`Phase: ${cycle < 3 ? "Reactants" : cycle < 5 ? "Combining..." : "Products"}`, width - 25, countY + 56);
    }

    // Title
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, 55, 200, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#ffcc80";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Ammonia Synthesis (Haber Process)", 15, 71);
  }

  function reset(): void {
    time = 0;
    reactionProgress = 0;
    setupMolecules();
  }

  function destroy(): void {
    molecules = [];
  }

  function getStateDescription(): string {
    const n2Count = Math.floor(n2Molecules);
    return (
      `Stoichiometry: Ammonia synthesis (Haber process). N\u2082 + 3H\u2082 \u2192 2NH\u2083. ` +
      `${n2Count} N\u2082 + ${n2Count * 3} H\u2082 \u2192 ${n2Count * 2} NH\u2083. ` +
      `Mole ratio 1:3:2. Industrial conditions: Fe catalyst, ~450\u00B0C, ~200 atm.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupMolecules();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StoichiometryAmmoniaSynthesisFactory;
