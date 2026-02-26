import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SpectrumOfHydrogenFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spectrum-of-hydrogen") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physics constants
  const R_H = 1.097e7; // Rydberg constant (m^-1)
  const hc = 1.2398e-6; // h*c in eV*m (for energy calculations)

  // Parameters
  let series = 1; // 0=Lyman, 1=Balmer, 2=Paschen
  let maxLevel = 7;
  let showEnergyLevels = 1;
  let showTransitions = 1;

  // Transition animation phase
  let transitionPhase = 0;

  const seriesNames = ["Lyman (n\u2081=1)", "Balmer (n\u2081=2)", "Paschen (n\u2081=3)"];
  const seriesColors = ["#a78bfa", "#3b82f6", "#ef4444"];

  /** Compute wavelength in nm for transition from n2 -> n1 */
  function wavelength(n1: number, n2: number): number {
    const invLambda = R_H * (1 / (n1 * n1) - 1 / (n2 * n2));
    return 1e9 / invLambda; // convert m to nm
  }

  /** Energy of level n in eV (E_n = -13.6/n^2) */
  function energyLevel(n: number): number {
    return -13.6 / (n * n);
  }

  /** Convert wavelength (nm) to an approximate visible color */
  function wavelengthToRGB(wl: number): string {
    let r = 0, g = 0, b = 0;
    if (wl < 380) { r = 0.6; b = 1; } // UV: purple
    else if (wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl <= 780) { r = 1; }
    else { r = 0.6; } // IR: deep red

    let factor = 1.0;
    if (wl >= 380 && wl < 420) factor = 0.3 + 0.7 * (wl - 380) / (420 - 380);
    else if (wl >= 645 && wl <= 780) factor = 0.3 + 0.7 * (780 - wl) / (780 - 645);
    else if (wl >= 380 && wl <= 780) factor = 1.0;
    else factor = 0.4;

    r = Math.round(255 * Math.pow(r * factor, 0.8));
    g = Math.round(255 * Math.pow(g * factor, 0.8));
    b = Math.round(255 * Math.pow(b * factor, 0.8));
    return `rgb(${r},${g},${b})`;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    transitionPhase = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    series = Math.round(params.series ?? 1);
    maxLevel = Math.round(params.maxLevel ?? 7);
    showEnergyLevels = Math.round(params.showEnergyLevels ?? 1);
    showTransitions = Math.round(params.showTransitions ?? 1);
    transitionPhase += dt * 2;
    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#050510");
    grad.addColorStop(0.5, "#0a0a1e");
    grad.addColorStop(1, "#0d0d24");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawEnergyLevelDiagram(): void {
    if (!showEnergyLevels) return;

    const diagramX = width * 0.08;
    const diagramW = width * 0.4;
    const diagramTop = height * 0.08;
    const diagramBottom = height * 0.55;
    const diagramH = diagramBottom - diagramTop;

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Hydrogen Energy Levels", diagramX + diagramW / 2, diagramTop - 8);

    // Energy scale: E_1 = -13.6 eV (bottom) to E_inf = 0 (top)
    const eMin = -13.6;
    const eMax = 0;

    function eToY(e: number): number {
      // Use sqrt mapping to spread out higher levels
      const frac = (e - eMin) / (eMax - eMin);
      return diagramBottom - frac * diagramH;
    }

    // Draw ionization limit (n=infinity, E=0)
    const yInf = eToY(0);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(diagramX, yInf);
    ctx.lineTo(diagramX + diagramW, yInf);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("n=\u221E (0 eV)", diagramX + diagramW + 5, yInf + 3);

    const n1 = series + 1; // lower level of the series

    // Draw energy levels
    for (let n = 1; n <= maxLevel; n++) {
      const e = energyLevel(n);
      const y = eToY(e);
      const isSeriesBase = n === n1;

      ctx.strokeStyle = isSeriesBase
        ? seriesColors[series]
        : "rgba(255,255,255,0.6)";
      ctx.lineWidth = isSeriesBase ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(diagramX, y);
      ctx.lineTo(diagramX + diagramW, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = isSeriesBase
        ? seriesColors[series]
        : "rgba(255,255,255,0.7)";
      ctx.font = isSeriesBase ? "bold 11px system-ui, sans-serif" : "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`n=${n}`, diagramX + diagramW + 5, y + 4);
      ctx.textAlign = "right";
      ctx.fillText(`${e.toFixed(2)} eV`, diagramX - 5, y + 4);
    }

    // Draw transition arrows
    if (showTransitions) {
      for (let n2 = n1 + 1; n2 <= maxLevel; n2++) {
        const y1 = eToY(energyLevel(n1));
        const y2 = eToY(energyLevel(n2));
        const wl = wavelength(n1, n2);
        const color = wavelengthToRGB(wl);

        // Stagger arrows horizontally
        const arrowX = diagramX + diagramW * 0.15 + (n2 - n1 - 1) * diagramW * 0.1;

        // Animated photon traveling down the arrow
        const phase = (transitionPhase + n2 * 0.5) % 2;
        const photonFrac = phase < 1 ? phase : 2 - phase;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(arrowX, y2);
        ctx.lineTo(arrowX, y1);
        ctx.stroke();

        // Arrowhead pointing down
        ctx.beginPath();
        ctx.moveTo(arrowX, y1);
        ctx.lineTo(arrowX - 4, y1 - 8);
        ctx.moveTo(arrowX, y1);
        ctx.lineTo(arrowX + 4, y1 - 8);
        ctx.stroke();

        // Photon dot
        const photonY = y2 + (y1 - y2) * photonFrac;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(arrowX, photonY, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Wavelength label
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = color;
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${wl.toFixed(0)}nm`, arrowX, y2 - 5);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawSpectrum(): void {
    const specX = width * 0.06;
    const specW = width * 0.88;
    const specTop = height * 0.64;
    const specH = height * 0.12;

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Emission Spectrum \u2014 ${seriesNames[series]}`, width / 2, specTop - 10);

    // Determine wavelength range for display
    const n1 = series + 1;
    const wlMin = wavelength(n1, maxLevel) * 0.85;
    const wlMax = wavelength(n1, n1 + 1) * 1.15;

    // Draw dark background for spectrum
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.roundRect(specX, specTop, specW, specH, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // If Balmer series, overlay a faint visible spectrum gradient
    if (series === 1) {
      const grad = ctx.createLinearGradient(specX, 0, specX + specW, 0);
      for (let i = 0; i <= 20; i++) {
        const frac = i / 20;
        const wl = wlMin + frac * (wlMax - wlMin);
        if (wl >= 380 && wl <= 780) {
          const c = wavelengthToRGB(wl);
          grad.addColorStop(frac, c.replace("rgb", "rgba").replace(")", ",0.06)"));
        } else {
          grad.addColorStop(frac, "rgba(0,0,0,0)");
        }
      }
      ctx.fillStyle = grad;
      ctx.fillRect(specX, specTop, specW, specH);
    }

    // Draw spectral lines
    for (let n2 = n1 + 1; n2 <= maxLevel; n2++) {
      const wl = wavelength(n1, n2);
      const frac = (wl - wlMin) / (wlMax - wlMin);
      if (frac < 0 || frac > 1) continue;

      const x = specX + frac * specW;
      const color = wavelengthToRGB(wl);

      // Glow effect
      const glowGrad = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
      glowGrad.addColorStop(0, "rgba(0,0,0,0)");
      glowGrad.addColorStop(0.5, color.replace("rgb", "rgba").replace(")", ",0.3)"));
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x - 8, specTop, 16, specH);

      // Sharp line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, specTop);
      ctx.lineTo(x, specTop + specH);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Wavelength label below
      ctx.fillStyle = color;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${wl.toFixed(1)} nm`, x, specTop + specH + 14);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(`${n2}\u2192${n1}`, x, specTop + specH + 26);
    }

    // Wavelength axis
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(specX, specTop + specH + 2);
    ctx.lineTo(specX + specW, specTop + specH + 2);
    ctx.stroke();

    // Tick marks on wavelength axis
    const tickStep = series === 0 ? 10 : series === 1 ? 50 : 200;
    const tickStart = Math.ceil(wlMin / tickStep) * tickStep;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let wl = tickStart; wl <= wlMax; wl += tickStep) {
      const frac = (wl - wlMin) / (wlMax - wlMin);
      const x = specX + frac * specW;
      ctx.beginPath();
      ctx.moveTo(x, specTop + specH + 2);
      ctx.lineTo(x, specTop + specH + 6);
      ctx.stroke();
      ctx.fillText(`${wl}`, x, specTop + specH + 40);
    }

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Wavelength (nm)", width / 2, specTop + specH + 52);
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(280, width * 0.35);
    const panelH = 105;
    const panelX = width - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Hydrogen Emission Spectrum", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Rydberg formula:", panelX + 10, panelY + 36);
    ctx.fillStyle = "rgba(200,220,255,0.8)";
    ctx.fillText("1/\u03BB = R\u2095(1/n\u2081\u00B2 \u2212 1/n\u2082\u00B2)", panelX + 10, panelY + 52);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(`R\u2095 = 1.097 \u00D7 10\u2077 m\u207B\u00B9`, panelX + 10, panelY + 68);

    ctx.fillStyle = seriesColors[series];
    ctx.fillText(`Series: ${seriesNames[series]}`, panelX + 10, panelY + 86);

    const n1 = series + 1;
    const numLines = maxLevel - n1;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`${numLines} transition${numLines !== 1 ? "s" : ""} shown`, panelX + 10, panelY + 100);
  }

  function render(): void {
    drawBackground();
    drawEnergyLevelDiagram();
    drawSpectrum();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    transitionPhase = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const n1 = series + 1;
    const lines: string[] = [];
    for (let n2 = n1 + 1; n2 <= maxLevel; n2++) {
      const wl = wavelength(n1, n2);
      const ePhoton = Math.abs(energyLevel(n2) - energyLevel(n1));
      lines.push(`n=${n2}\u2192${n1}: \u03BB=${wl.toFixed(1)}nm, E=${ePhoton.toFixed(2)}eV`);
    }
    return (
      `Hydrogen Emission Spectrum: ${seriesNames[series]}. ` +
      `Rydberg formula: 1/\u03BB = R_H(1/n1\u00B2 - 1/n2\u00B2), R_H=1.097e7 m\u207B\u00B9. ` +
      `Transitions: ${lines.join("; ")}. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpectrumOfHydrogenFactory;
