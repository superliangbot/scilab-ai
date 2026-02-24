import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const BohrsAtomicModelFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("bohrs-atomic-model") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters (cached)
  let energyLevel = 1;
  let showTransition = 1;
  let electronSpeed = 5;
  let atomicNumber = 1;

  // Bohr model constants
  const a0 = 0.529; // Bohr radius in angstroms
  const E0 = 13.6; // Ground state energy in eV (magnitude)
  const MAX_ORBITS = 6;

  // Shell electron capacities: 2, 8, 18, 32, ...
  // For simplicity with small atoms: 2n^2 per shell
  function shellCapacity(n: number): number {
    return 2 * n * n;
  }

  // Electron distribution for given atomic number
  function getElectronShells(Z: number): number[] {
    const shells: number[] = [];
    let remaining = Z;
    for (let n = 1; n <= MAX_ORBITS && remaining > 0; n++) {
      const cap = shellCapacity(n);
      const inShell = Math.min(remaining, cap);
      shells.push(inShell);
      remaining -= inShell;
    }
    return shells;
  }

  // Orbital radius on screen (proportional to n^2)
  function orbitRadius(n: number): number {
    const minR = Math.min(width, height) * 0.08;
    const maxR = Math.min(width, height) * 0.38;
    // r_n proportional to n^2
    const fraction = (n * n) / (MAX_ORBITS * MAX_ORBITS);
    return minR + fraction * (maxR - minR);
  }

  // Energy of level n
  function energyOfLevel(n: number): number {
    return -E0 / (n * n);
  }

  // Photon energy for transition from n2 -> n1 (emission)
  function photonEnergy(n1: number, n2: number): number {
    return E0 * (1 / (n1 * n1) - 1 / (n2 * n2));
  }

  // Map photon energy (eV) to a visible-spectrum color
  // Visible range: ~1.65 eV (red 750nm) to ~3.26 eV (violet 380nm)
  function energyToColor(eV: number): string {
    // Wavelength in nm: lambda = 1240 / eV
    const lambda = 1240 / Math.max(eV, 0.1);

    let r = 0, g = 0, b = 0;

    if (lambda >= 380 && lambda < 440) {
      r = -(lambda - 440) / (440 - 380);
      g = 0;
      b = 1;
    } else if (lambda >= 440 && lambda < 490) {
      r = 0;
      g = (lambda - 440) / (490 - 440);
      b = 1;
    } else if (lambda >= 490 && lambda < 510) {
      r = 0;
      g = 1;
      b = -(lambda - 510) / (510 - 490);
    } else if (lambda >= 510 && lambda < 580) {
      r = (lambda - 510) / (580 - 510);
      g = 1;
      b = 0;
    } else if (lambda >= 580 && lambda < 645) {
      r = 1;
      g = -(lambda - 645) / (645 - 580);
      b = 0;
    } else if (lambda >= 645 && lambda <= 780) {
      r = 1;
      g = 0;
      b = 0;
    } else if (lambda < 380) {
      // UV — show as deep violet
      r = 0.6;
      g = 0;
      b = 1;
    } else {
      // IR — show as deep red
      r = 0.8;
      g = 0;
      b = 0;
    }

    // Intensity attenuation at edges of visible spectrum
    let factor = 1.0;
    if (lambda >= 380 && lambda < 420) {
      factor = 0.3 + 0.7 * (lambda - 380) / (420 - 380);
    } else if (lambda >= 645 && lambda <= 780) {
      factor = 0.3 + 0.7 * (780 - lambda) / (780 - 645);
    } else if (lambda < 380 || lambda > 780) {
      factor = 0.5;
    }

    r = Math.round(255 * r * factor);
    g = Math.round(255 * g * factor);
    b = Math.round(255 * b * factor);

    return `rgb(${r}, ${g}, ${b})`;
  }

  // Transition animation state
  interface PhotonAnim {
    fromLevel: number;
    toLevel: number;
    progress: number; // 0 to 1
    angle: number; // emission direction
    energy: number;
    color: string;
  }
  let photons: PhotonAnim[] = [];
  let lastEnergyLevel = 1;
  let transitionCooldown = 0;

  // Element names for display
  const elementNames: Record<number, string> = {
    1: "Hydrogen (H)", 2: "Helium (He)", 3: "Lithium (Li)", 4: "Beryllium (Be)",
    5: "Boron (B)", 6: "Carbon (C)", 7: "Nitrogen (N)", 8: "Oxygen (O)",
    9: "Fluorine (F)", 10: "Neon (Ne)",
  };

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    photons = [];
    lastEnergyLevel = 1;
    transitionCooldown = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const newLevel = Math.round(params.energyLevel ?? 1);
    showTransition = params.showTransition ?? 1;
    electronSpeed = params.electronSpeed ?? 5;
    atomicNumber = Math.round(params.atomicNumber ?? 1);

    time += dt;
    transitionCooldown -= dt;

    // Check for energy level transition
    if (newLevel !== lastEnergyLevel && showTransition >= 0.5 && transitionCooldown <= 0) {
      if (newLevel < lastEnergyLevel) {
        // Dropping to lower level — emit photon
        const eV = photonEnergy(newLevel, lastEnergyLevel);
        const angle = Math.random() * Math.PI * 2;
        photons.push({
          fromLevel: lastEnergyLevel,
          toLevel: newLevel,
          progress: 0,
          angle,
          energy: eV,
          color: energyToColor(eV),
        });
      }
      // Absorbing photon when going up (just flash)
      if (newLevel > lastEnergyLevel) {
        const eV = photonEnergy(lastEnergyLevel, newLevel);
        const angle = Math.random() * Math.PI * 2;
        photons.push({
          fromLevel: lastEnergyLevel,
          toLevel: newLevel,
          progress: 0,
          angle: angle + Math.PI, // incoming
          energy: eV,
          color: energyToColor(eV),
        });
      }
      transitionCooldown = 0.3;
    }
    lastEnergyLevel = newLevel;
    energyLevel = newLevel;

    // Update photon animations
    for (const p of photons) {
      p.progress += dt * 1.5;
    }
    photons = photons.filter((p) => p.progress < 2.0);
  }

  function drawNucleus(cx: number, cy: number): void {
    // Nucleus glow
    const glowR = 20 + 3 * Math.sin(time * 3);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR * 2);
    glow.addColorStop(0, "rgba(255, 120, 50, 0.6)");
    glow.addColorStop(0.4, "rgba(255, 80, 20, 0.3)");
    glow.addColorStop(1, "rgba(255, 50, 0, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, glowR * 2, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Nucleus core
    const coreR = 10 + atomicNumber * 1.2;
    const coreGrad = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, coreR);
    coreGrad.addColorStop(0, "#ffcc66");
    coreGrad.addColorStop(0.4, "#ff8833");
    coreGrad.addColorStop(0.8, "#cc4411");
    coreGrad.addColorStop(1, "#882200");
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Proton/neutron bumps
    const numProtons = atomicNumber;
    for (let i = 0; i < Math.min(numProtons, 10); i++) {
      const angle = (i / Math.min(numProtons, 10)) * Math.PI * 2 + time * 0.2;
      const r = coreR * 0.4;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#ff6644" : "#4488ff";
      ctx.fill();
    }

    // Label
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#ffcc66";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`Z=${atomicNumber}`, cx, cy + coreR + 16);
  }

  function drawOrbits(cx: number, cy: number): void {
    for (let n = 1; n <= MAX_ORBITS; n++) {
      const r = orbitRadius(n);

      // Orbit ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (n === energyLevel) {
        ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
        ctx.lineWidth = 2;
        // Glow for active level
        ctx.shadowColor = "rgba(100, 200, 255, 0.4)";
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = "rgba(100, 130, 180, 0.2)";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Energy level label on the right
      const labelX = cx + r + 8;
      const labelY = cy - 4;
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = n === energyLevel ? "#74c0fc" : "rgba(150, 170, 200, 0.5)";
      const En = energyOfLevel(n);
      ctx.fillText(`n=${n}  E=${En.toFixed(2)} eV`, labelX, labelY);

      // Bohr radius label (smaller)
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(150, 170, 200, 0.3)";
      const rBohr = n * n * a0;
      ctx.fillText(`r = ${rBohr.toFixed(2)} A`, labelX, labelY + 13);
    }
  }

  function drawElectrons(cx: number, cy: number): void {
    const shells = getElectronShells(atomicNumber);
    const speedFactor = electronSpeed / 5;

    for (let shellIdx = 0; shellIdx < shells.length; shellIdx++) {
      const n = shellIdx + 1;
      const r = orbitRadius(n);
      const numElectrons = shells[shellIdx];

      for (let e = 0; e < numElectrons; e++) {
        // Distribute electrons evenly around the orbit, with orbital motion
        const baseAngle = (e / numElectrons) * Math.PI * 2;
        // Angular velocity decreases with orbit number (Kepler-like)
        const angularVel = speedFactor * (2.5 / n);
        const angle = baseAngle + time * angularVel;

        const ex = cx + r * Math.cos(angle);
        const ey = cy + r * Math.sin(angle);

        // Electron glow
        const eGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 12);
        eGlow.addColorStop(0, "rgba(100, 180, 255, 0.6)");
        eGlow.addColorStop(0.5, "rgba(80, 150, 255, 0.2)");
        eGlow.addColorStop(1, "rgba(60, 120, 255, 0)");
        ctx.beginPath();
        ctx.arc(ex, ey, 12, 0, Math.PI * 2);
        ctx.fillStyle = eGlow;
        ctx.fill();

        // Electron core
        const eCore = ctx.createRadialGradient(ex - 1, ey - 1, 0, ex, ey, 5);
        eCore.addColorStop(0, "#ffffff");
        eCore.addColorStop(0.3, "#88ccff");
        eCore.addColorStop(1, "#3388dd");
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fillStyle = eCore;
        ctx.fill();
      }
    }
  }

  function drawPhotons(cx: number, cy: number): void {
    for (const photon of photons) {
      const fromR = orbitRadius(photon.fromLevel);
      const toR = orbitRadius(photon.toLevel);

      if (photon.progress < 1.0) {
        // Photon traveling between levels
        const t = photon.progress;
        const r = fromR + (toR - fromR) * t;
        const px = cx + r * Math.cos(photon.angle);
        const py = cy + r * Math.sin(photon.angle);

        // Wavy photon trail
        const waveAmplitude = 6;
        const waveFreq = 15;

        ctx.beginPath();
        ctx.strokeStyle = photon.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 1 - t * 0.5;

        const segments = 20;
        for (let i = 0; i <= segments; i++) {
          const st = Math.max(0, t - 0.15) + (i / segments) * 0.15;
          const sr = fromR + (toR - fromR) * st;
          // Perpendicular wave displacement
          const wave = waveAmplitude * Math.sin(waveFreq * st * Math.PI) * (1 - t);
          const baseX = cx + sr * Math.cos(photon.angle);
          const baseY = cy + sr * Math.sin(photon.angle);
          const perpX = -Math.sin(photon.angle) * wave;
          const perpY = Math.cos(photon.angle) * wave;
          if (i === 0) ctx.moveTo(baseX + perpX, baseY + perpY);
          else ctx.lineTo(baseX + perpX, baseY + perpY);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Photon dot
        const photonGlow = ctx.createRadialGradient(px, py, 0, px, py, 10);
        photonGlow.addColorStop(0, photon.color);
        photonGlow.addColorStop(0.5, photon.color.replace("rgb", "rgba").replace(")", ", 0.4)"));
        photonGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fillStyle = photonGlow;
        ctx.fill();
      } else {
        // Photon flying outward after reaching destination
        const outT = photon.progress - 1.0;
        const outR = toR + outT * Math.min(width, height) * 0.6;
        const px = cx + outR * Math.cos(photon.angle);
        const py = cy + outR * Math.sin(photon.angle);
        const alpha = Math.max(0, 1 - outT);

        ctx.globalAlpha = alpha;
        const photonGlow = ctx.createRadialGradient(px, py, 0, px, py, 8);
        photonGlow.addColorStop(0, photon.color);
        photonGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fillStyle = photonGlow;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawEnergyDiagram(): void {
    // Energy level diagram on the far right
    const diagramX = width - 130;
    const diagramW = 100;
    const diagramTop = height * 0.12;
    const diagramBottom = height * 0.65;
    const diagramH = diagramBottom - diagramTop;

    // Background
    ctx.fillStyle = "rgba(15, 20, 40, 0.6)";
    ctx.strokeStyle = "rgba(100, 130, 180, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(diagramX - 10, diagramTop - 20, diagramW + 20, diagramH + 40, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Energy Levels", diagramX + diagramW / 2, diagramTop - 6);

    // Draw energy levels
    // E_n = -13.6/n^2, so E_1 = -13.6 (bottom), E_inf = 0 (top)
    for (let n = 1; n <= MAX_ORBITS; n++) {
      const En = energyOfLevel(n);
      // Map energy to vertical position: E_1 = -13.6 at bottom, E_0 = 0 at top
      const yFraction = 1 - (En + E0) / E0; // 0 at n=1, approaches 1 at n=inf
      const y = diagramTop + yFraction * diagramH;

      ctx.beginPath();
      ctx.moveTo(diagramX, y);
      ctx.lineTo(diagramX + diagramW, y);
      ctx.strokeStyle = n === energyLevel ? "#74c0fc" : "rgba(100, 130, 180, 0.4)";
      ctx.lineWidth = n === energyLevel ? 2.5 : 1;
      ctx.stroke();

      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = n === energyLevel ? "#74c0fc" : "rgba(150, 170, 200, 0.5)";
      ctx.textAlign = "right";
      ctx.fillText(`n=${n}`, diagramX - 4, y + 3);
      ctx.textAlign = "left";
      ctx.fillText(`${En.toFixed(2)}eV`, diagramX + diagramW + 4, y + 3);
    }

    // Ionization level (E=0)
    const y0 = diagramTop;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(diagramX, y0);
    ctx.lineTo(diagramX + diagramW, y0);
    ctx.strokeStyle = "rgba(255, 100, 100, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 100, 100, 0.6)";
    ctx.textAlign = "left";
    ctx.fillText("0 eV (ionization)", diagramX + diagramW + 4, y0 + 3);
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Starfield background for atmosphere
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 50; i++) {
      // Deterministic pseudo-random positions
      const sx = ((i * 7919 + 1013) % width);
      const sy = ((i * 6271 + 2017) % height);
      const sr = 0.5 + ((i * 3571) % 100) / 100;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Bohr's Atomic Model", width / 2 - 50, 30);

    // Element name
    ctx.font = "14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(elementNames[atomicNumber] || `Element Z=${atomicNumber}`, width / 2 - 50, 50);

    // Center of atom (shifted left to make room for energy diagram)
    const cx = width * 0.38;
    const cy = height * 0.48;

    // Draw components
    drawOrbits(cx, cy);
    drawNucleus(cx, cy);
    drawElectrons(cx, cy);
    drawPhotons(cx, cy);
    drawEnergyDiagram();

    // ── Info panel at bottom ────────────────────
    const panelY = height * 0.78;
    const col1 = 20;
    const lineH = 20;

    ctx.font = "13px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // Current state
    const En = energyOfLevel(energyLevel);
    const rn = energyLevel * energyLevel * a0;
    ctx.fillStyle = "#74c0fc";
    ctx.fillText(
      `Current orbit: n = ${energyLevel}    E${subscript(energyLevel)} = ${En.toFixed(3)} eV    r${subscript(energyLevel)} = ${rn.toFixed(3)} A`,
      col1, panelY
    );

    // Shell configuration
    const shells = getElectronShells(atomicNumber);
    const shellStr = shells.map((count, i) => `n${i + 1}=${count}`).join(", ");
    ctx.fillStyle = "#69db7c";
    ctx.fillText(`Electrons: ${atomicNumber}    Shells: [${shellStr}]`, col1, panelY + lineH);

    // Formulas
    ctx.fillStyle = "#b197fc";
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillText(
      `Bohr radius: a${subscript("n")} = n\u00B2 \u00D7 a\u2080    (a\u2080 = ${a0} A)`,
      col1, panelY + lineH * 2
    );
    ctx.fillText(
      `Energy: E${subscript("n")} = -${E0}/n\u00B2 eV    Photon: \u0394E = ${E0}\u00D7(1/n\u2081\u00B2 - 1/n\u2082\u00B2) eV`,
      col1, panelY + lineH * 3
    );

    // Transition info
    if (photons.length > 0) {
      const latest = photons[photons.length - 1];
      const lambda = 1240 / latest.energy;
      ctx.fillStyle = "#ffa94d";
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillText(
        `Transition: n=${latest.fromLevel} \u2192 n=${latest.toLevel}    \u0394E = ${latest.energy.toFixed(3)} eV    \u03BB = ${lambda.toFixed(1)} nm`,
        col1, panelY + lineH * 4
      );
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillText(
        "Change energy level to see photon emission/absorption transitions.",
        col1, panelY + lineH * 4
      );
    }

    // Series info
    ctx.fillStyle = "#64748b";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillText(
      "Lyman (to n=1): UV  |  Balmer (to n=2): Visible  |  Paschen (to n=3): IR",
      col1, panelY + lineH * 5
    );

    // Time display at bottom-left
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function subscript(n: number | string): string {
    const sub: Record<string, string> = {
      "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083",
      "4": "\u2084", "5": "\u2085", "6": "\u2086", "7": "\u2087",
      "8": "\u2088", "9": "\u2089", "n": "\u2099",
    };
    return n.toString().split("").map((c) => sub[c] || c).join("");
  }

  function reset(): void {
    time = 0;
    photons = [];
    lastEnergyLevel = energyLevel;
    transitionCooldown = 0;
  }

  function destroy(): void {
    photons = [];
  }

  function getStateDescription(): string {
    const En = energyOfLevel(energyLevel);
    const rn = energyLevel * energyLevel * a0;
    const shells = getElectronShells(atomicNumber);
    const shellStr = shells.map((count, i) => `n${i + 1}=${count}`).join(", ");
    const transitionInfo = photons.length > 0
      ? ` Last photon: dE=${photons[photons.length - 1].energy.toFixed(3)}eV, lambda=${(1240 / photons[photons.length - 1].energy).toFixed(1)}nm.`
      : "";
    return (
      `Bohr Atomic Model: ${elementNames[atomicNumber] || "Z=" + atomicNumber}, ` +
      `electron orbit n=${energyLevel}, E=${En.toFixed(3)} eV, r=${rn.toFixed(3)} A. ` +
      `Shell config: [${shellStr}]. ` +
      `Formulas: E_n = -13.6/n^2 eV, r_n = n^2 * 0.529 A.` +
      transitionInfo +
      ` Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default BohrsAtomicModelFactory;
