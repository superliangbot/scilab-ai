import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectronConfigurationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electron-configuration") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let atomicNumber = 6;
  let showOrbitalDiagram = 1;
  let animationSpeed = 1;
  let showLabels = 1;

  // Element data: [symbol, name] for Z = 1..36
  const elements: [string, string][] = [
    ["H", "Hydrogen"], ["He", "Helium"], ["Li", "Lithium"], ["Be", "Beryllium"],
    ["B", "Boron"], ["C", "Carbon"], ["N", "Nitrogen"], ["O", "Oxygen"],
    ["F", "Fluorine"], ["Ne", "Neon"], ["Na", "Sodium"], ["Mg", "Magnesium"],
    ["Al", "Aluminum"], ["Si", "Silicon"], ["P", "Phosphorus"], ["S", "Sulfur"],
    ["Cl", "Chlorine"], ["Ar", "Argon"], ["K", "Potassium"], ["Ca", "Calcium"],
    ["Sc", "Scandium"], ["Ti", "Titanium"], ["V", "Vanadium"], ["Cr", "Chromium"],
    ["Mn", "Manganese"], ["Fe", "Iron"], ["Co", "Cobalt"], ["Ni", "Nickel"],
    ["Cu", "Copper"], ["Zn", "Zinc"], ["Ga", "Gallium"], ["Ge", "Germanium"],
    ["As", "Arsenic"], ["Se", "Selenium"], ["Br", "Bromine"], ["Kr", "Krypton"],
  ];

  // Subshell order following Aufbau principle up to 4p (covers Z=1..36)
  // Each entry: [principal quantum number n, subshell letter, max electrons]
  const subshellOrder: [number, string, number][] = [
    [1, "s", 2], [2, "s", 2], [2, "p", 6], [3, "s", 2], [3, "p", 6],
    [4, "s", 2], [3, "d", 10], [4, "p", 6],
  ];

  // Subshell colors: s=red, p=blue, d=green, f=purple
  const subshellColors: Record<string, string> = {
    s: "#ff6b6b",
    p: "#4dabf7",
    d: "#51cf66",
    f: "#cc5de8",
  };

  const subshellGlowColors: Record<string, string> = {
    s: "rgba(255,107,107,0.4)",
    p: "rgba(77,171,247,0.4)",
    d: "rgba(81,207,102,0.4)",
    f: "rgba(204,93,232,0.4)",
  };

  // Chromium (Z=24) and Copper (Z=29) are special cases
  function getElectronConfig(Z: number): { subshell: string; n: number; l: string; count: number }[] {
    const result: { subshell: string; n: number; l: string; count: number }[] = [];
    let remaining = Z;

    // Handle Cr and Cu exceptions
    const isCr = Z === 24;
    const isCu = Z === 29;

    for (const [n, l, max] of subshellOrder) {
      if (remaining <= 0) break;
      let fill = Math.min(remaining, max);

      // Chromium: [Ar] 3d5 4s1 instead of [Ar] 3d4 4s2
      if (isCr && n === 4 && l === "s") fill = 1;
      if (isCr && n === 3 && l === "d") fill = 5;

      // Copper: [Ar] 3d10 4s1 instead of [Ar] 3d9 4s2
      if (isCu && n === 4 && l === "s") fill = 1;
      if (isCu && n === 3 && l === "d") fill = 10;

      if (fill > 0) {
        result.push({ subshell: `${n}${l}`, n, l, count: fill });
      }
      remaining -= fill;
    }
    return result;
  }

  // Get total electrons per principal shell for Bohr model drawing
  function getShellElectrons(Z: number): Map<number, { total: number; subshells: { l: string; count: number }[] }> {
    const shells = new Map<number, { total: number; subshells: { l: string; count: number }[] }>();
    const cfg = getElectronConfig(Z);
    for (const entry of cfg) {
      if (!shells.has(entry.n)) {
        shells.set(entry.n, { total: 0, subshells: [] });
      }
      const shell = shells.get(entry.n)!;
      shell.total += entry.count;
      shell.subshells.push({ l: entry.l, count: entry.count });
    }
    return shells;
  }

  // Format electron configuration string with superscripts
  function getConfigNotation(Z: number): string {
    const cfg = getElectronConfig(Z);
    return cfg.map((e) => `${e.subshell}${toSuperscript(e.count)}`).join(" ");
  }

  function toSuperscript(n: number): string {
    const sup: Record<string, string> = {
      "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3",
      "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077",
      "8": "\u2078", "9": "\u2079",
    };
    return n.toString().split("").map((c) => sup[c] || c).join("");
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    atomicNumber = Math.max(1, Math.min(36, Math.round(params.atomicNumber ?? 6)));
    showOrbitalDiagram = params.showOrbitalDiagram ?? 1;
    animationSpeed = params.animationSpeed ?? 1;
    showLabels = params.showLabels ?? 1;
    time += dt * animationSpeed;
  }

  // ---- Drawing helpers ----

  function drawBackground(): void {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0a0a1e");
    bg.addColorStop(0.5, "#0d1025");
    bg.addColorStop(1, "#0a0a1e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle stars
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 7919 + 1013) % width);
      const sy = ((i * 6271 + 2017) % height);
      const sr = 0.4 + ((i * 3571) % 100) / 150;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawNucleus(cx: number, cy: number): void {
    const Z = atomicNumber;
    const baseR = Math.min(width, height) * 0.025 + Math.sqrt(Z) * 1.2;

    // Outer glow
    const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 3);
    outerGlow.addColorStop(0, "rgba(255,180,50,0.25)");
    outerGlow.addColorStop(0.5, "rgba(255,120,30,0.08)");
    outerGlow.addColorStop(1, "rgba(255,80,20,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 3, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Nucleus body
    const nucleusGrad = ctx.createRadialGradient(cx - baseR * 0.3, cy - baseR * 0.3, 0, cx, cy, baseR);
    nucleusGrad.addColorStop(0, "#fff5e0");
    nucleusGrad.addColorStop(0.3, "#ffb347");
    nucleusGrad.addColorStop(0.7, "#e67e22");
    nucleusGrad.addColorStop(1, "#a0522d");
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fillStyle = nucleusGrad;
    ctx.fill();

    // Proton count label
    if (showLabels >= 0.5) {
      ctx.font = `bold ${Math.max(9, baseR * 0.9)}px 'Inter', system-ui, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Z}+`, cx, cy);
    }
  }

  function drawOrbitalsAndElectrons(cx: number, cy: number): void {
    const shells = getShellElectrons(atomicNumber);
    const maxShell = Math.max(...Array.from(shells.keys()));
    const minR = Math.min(width, height) * 0.07;
    const maxR = Math.min(width, height) * 0.33;

    const shellEntries = Array.from(shells.entries());
    for (let si = 0; si < shellEntries.length; si++) {
      const [n, data] = shellEntries[si];
      const fraction = n / (maxShell + 1);
      const r = minR + fraction * (maxR - minR);

      // Draw orbit ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100,140,200,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Shell label
      if (showLabels >= 0.5) {
        const shellNames = ["", "K", "L", "M", "N"];
        const label = shellNames[n] || `n=${n}`;
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "rgba(150,180,220,0.5)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx + r + 12, cy);
      }

      // Draw electrons on this shell, color-coded by subshell
      let electronIndex = 0;
      for (const sub of data.subshells) {
        const color = subshellColors[sub.l] || "#fff";
        const glowColor = subshellGlowColors[sub.l] || "rgba(255,255,255,0.3)";

        for (let i = 0; i < sub.count; i++) {
          const angleOffset = (electronIndex / data.total) * Math.PI * 2;
          const speed = (2.5 / n) * animationSpeed;
          const angle = angleOffset + time * speed;

          const ex = cx + r * Math.cos(angle);
          const ey = cy + r * Math.sin(angle);

          // Electron glow
          const eGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10);
          eGlow.addColorStop(0, glowColor);
          eGlow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(ex, ey, 10, 0, Math.PI * 2);
          ctx.fillStyle = eGlow;
          ctx.fill();

          // Electron core
          const eCore = ctx.createRadialGradient(ex - 1, ey - 1, 0, ex, ey, 4);
          eCore.addColorStop(0, "#ffffff");
          eCore.addColorStop(0.4, color);
          eCore.addColorStop(1, color);
          ctx.beginPath();
          ctx.arc(ex, ey, 4, 0, Math.PI * 2);
          ctx.fillStyle = eCore;
          ctx.fill();

          electronIndex++;
        }
      }
    }
  }

  function drawElementInfo(): void {
    const [symbol, name] = elements[atomicNumber - 1] || ["?", "Unknown"];
    const notation = getConfigNotation(atomicNumber);

    const infoX = 15;
    const infoY = 22;

    // Title
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Electron Configuration", infoX, infoY);

    // Element box
    const boxX = infoX;
    const boxY = infoY + 10;
    const boxW = 60;
    const boxH = 60;

    ctx.fillStyle = "rgba(20,25,50,0.7)";
    ctx.strokeStyle = "rgba(100,140,200,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    // Atomic number
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText(`${atomicNumber}`, boxX + boxW / 2, boxY + 14);

    // Symbol
    ctx.font = "bold 22px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(symbol, boxX + boxW / 2, boxY + 38);

    // Name
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(name, boxX + boxW / 2, boxY + 52);

    // Electron configuration notation
    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText(notation, boxX + boxW + 12, boxY + 25);

    // Total electrons
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Total electrons: ${atomicNumber}`, boxX + boxW + 12, boxY + 45);
  }

  function drawEnergyLevelDiagram(): void {
    const diagramX = width - 130;
    const diagramTop = 40;
    const diagramBottom = height * 0.55;
    const diagramW = 100;
    const diagramH = diagramBottom - diagramTop;

    // Background panel
    ctx.fillStyle = "rgba(12,15,35,0.7)";
    ctx.strokeStyle = "rgba(80,110,160,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(diagramX - 14, diagramTop - 24, diagramW + 28, diagramH + 40, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Energy Levels", diagramX + diagramW / 2, diagramTop - 8);

    const cfg = getElectronConfig(atomicNumber);

    // Energy positions: lower subshells at bottom, higher at top
    const totalSubshells = subshellOrder.length;
    const lineSpacing = diagramH / (totalSubshells + 1);

    for (let i = 0; i < subshellOrder.length; i++) {
      const [n, l, max] = subshellOrder[i];
      const y = diagramBottom - (i + 1) * lineSpacing;
      const label = `${n}${l}`;
      const color = subshellColors[l] || "#888";

      // Check if this subshell is occupied
      const entry = cfg.find((e) => e.subshell === label);
      const occupied = entry ? entry.count : 0;

      // Line
      ctx.beginPath();
      ctx.moveTo(diagramX, y);
      ctx.lineTo(diagramX + diagramW, y);
      ctx.strokeStyle = occupied > 0 ? color : "rgba(80,100,140,0.3)";
      ctx.lineWidth = occupied > 0 ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = occupied > 0 ? color : "rgba(120,140,170,0.4)";
      ctx.textAlign = "right";
      ctx.fillText(label, diagramX - 4, y + 3);

      // Electron count
      if (occupied > 0) {
        ctx.textAlign = "left";
        ctx.fillStyle = color;
        ctx.fillText(`${occupied}/${max}`, diagramX + diagramW + 4, y + 3);
      }
    }
  }

  function drawOrbitalFillingDiagram(): void {
    if (showOrbitalDiagram < 0.5) return;

    const cfg = getElectronConfig(atomicNumber);
    const startX = 15;
    const startY = height - 120;
    const boxSize = 14;
    const boxGap = 3;
    const rowHeight = 22;

    // Panel background
    const panelW = width - 30;
    const panelH = 110;
    ctx.fillStyle = "rgba(12,15,35,0.7)";
    ctx.strokeStyle = "rgba(80,110,160,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(startX - 8, startY - 20, panelW, panelH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Orbital Filling Diagram (Aufbau)", startX, startY - 6);

    let curX = startX;
    let curY = startY;
    const maxRowWidth = panelW - 20;

    for (const entry of cfg) {
      const color = subshellColors[entry.l] || "#888";
      const maxOrbitals = entry.l === "s" ? 1 : entry.l === "p" ? 3 : entry.l === "d" ? 5 : 7;
      const groupWidth = maxOrbitals * (boxSize + boxGap) + 40;

      // Wrap to next row if needed
      if (curX + groupWidth > startX + maxRowWidth) {
        curX = startX;
        curY += rowHeight + 10;
      }

      // Subshell label
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.fillText(`${entry.n}${entry.l}`, curX, curY + boxSize - 2);
      curX += 20;

      // Draw orbital boxes following Hund's rule
      // First pass: spin up, Second pass: spin down
      const electronCount = entry.count;
      const spinUp = Math.min(electronCount, maxOrbitals);
      const spinDown = Math.max(0, electronCount - maxOrbitals);

      for (let o = 0; o < maxOrbitals; o++) {
        const bx = curX + o * (boxSize + boxGap);
        const by = curY;

        // Box outline
        ctx.strokeStyle = "rgba(100,130,180,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, boxSize, boxSize);

        // Up arrow (first electron per orbital)
        if (o < spinUp) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          const mx = bx + boxSize * 0.35;
          const arrTop = by + 2;
          const arrBot = by + boxSize - 2;
          ctx.beginPath();
          ctx.moveTo(mx, arrBot);
          ctx.lineTo(mx, arrTop);
          ctx.moveTo(mx - 3, arrTop + 3);
          ctx.lineTo(mx, arrTop);
          ctx.lineTo(mx + 3, arrTop + 3);
          ctx.stroke();
        }

        // Down arrow (second electron per orbital)
        if (o < spinDown) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          const mx = bx + boxSize * 0.65;
          const arrTop = by + 2;
          const arrBot = by + boxSize - 2;
          ctx.beginPath();
          ctx.moveTo(mx, arrTop);
          ctx.lineTo(mx, arrBot);
          ctx.moveTo(mx - 3, arrBot - 3);
          ctx.lineTo(mx, arrBot);
          ctx.lineTo(mx + 3, arrBot - 3);
          ctx.stroke();
        }
      }

      curX += maxOrbitals * (boxSize + boxGap) + 14;
    }
  }

  function drawSubshellLegend(): void {
    if (showLabels < 0.5) return;

    const legendX = width - 130;
    const legendY = height * 0.58 + 20;
    const lineH = 16;

    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Subshell Colors", legendX, legendY);

    const labels = [
      { l: "s", label: "s orbital (max 2)", color: subshellColors.s },
      { l: "p", label: "p orbital (max 6)", color: subshellColors.p },
      { l: "d", label: "d orbital (max 10)", color: subshellColors.d },
      { l: "f", label: "f orbital (max 14)", color: subshellColors.f },
    ];

    for (let i = 0; i < labels.length; i++) {
      const y = legendY + (i + 1) * lineH;
      // Dot
      ctx.beginPath();
      ctx.arc(legendX + 6, y - 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = labels[i].color;
      ctx.fill();
      // Label
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(180,200,230,0.7)";
      ctx.textAlign = "left";
      ctx.fillText(labels[i].label, legendX + 16, y);
    }
  }

  function drawRulesNote(): void {
    if (showLabels < 0.5) return;

    const noteX = width - 130;
    const noteY = height * 0.58 + 100;
    const lineH = 13;

    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(150,170,200,0.5)";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Rules Applied:", noteX, noteY);
    ctx.fillText("1. Aufbau principle", noteX + 4, noteY + lineH);
    ctx.fillText("2. Pauli exclusion", noteX + 4, noteY + lineH * 2);
    ctx.fillText("3. Hund's rule", noteX + 4, noteY + lineH * 3);
  }

  function render(): void {
    drawBackground();

    // Atom center position (shifted left to leave room for diagrams)
    const cx = width * 0.35;
    const cy = height * 0.40;

    drawOrbitalsAndElectrons(cx, cy);
    drawNucleus(cx, cy);
    drawElementInfo();
    drawEnergyLevelDiagram();
    drawSubshellLegend();
    drawRulesNote();
    drawOrbitalFillingDiagram();

    // Time display
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 8);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    // No dynamic resources to clean up
  }

  function getStateDescription(): string {
    const [symbol, name] = elements[atomicNumber - 1] || ["?", "Unknown"];
    const notation = getConfigNotation(atomicNumber);
    const shells = getShellElectrons(atomicNumber);
    const shellStr = Array.from(shells.entries())
      .map(([n, d]) => `n${n}=${d.total}`)
      .join(", ");
    return (
      `Electron Configuration: ${name} (${symbol}), Z=${atomicNumber}. ` +
      `Config: ${notation}. Shells: [${shellStr}]. ` +
      `Following Aufbau principle, Pauli exclusion, and Hund's rule. ` +
      `Orbital diagram ${showOrbitalDiagram >= 0.5 ? "shown" : "hidden"}. ` +
      `Animation speed: ${animationSpeed.toFixed(1)}x. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectronConfigurationFactory;
