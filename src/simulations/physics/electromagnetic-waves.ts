import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectromagneticWavesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electromagnetic-waves") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let waveType = 3; // 0=Radio..6=Gamma
  let showDetails = 1;
  let animationSpeed = 1;

  const WAVE_NAMES = ["Radio", "Microwave", "Infrared", "Visible", "Ultraviolet", "X-ray", "Gamma"];
  const WAVE_COLORS = ["#e74c3c", "#e67e22", "#e84118", "#2ecc71", "#9b59b6", "#3498db", "#8e44ad"];

  // Frequency ranges (Hz) as strings for display
  const WAVE_FREQ = [
    "3 kHz - 300 GHz", "300 MHz - 300 GHz", "300 GHz - 430 THz",
    "430 THz - 790 THz", "790 THz - 30 PHz", "30 PHz - 30 EHz", "> 30 EHz",
  ];
  const WAVE_LAMBDA = [
    "1 mm - 100 km", "1 mm - 1 m", "700 nm - 1 mm",
    "380 nm - 700 nm", "10 nm - 380 nm", "0.01 nm - 10 nm", "< 0.01 nm",
  ];
  const WAVE_APPS = [
    "Broadcasting, WiFi, Communication",
    "Ovens, Radar, Satellite links",
    "Night vision, Remote controls, Heating",
    "Human vision, Photosynthesis, Fiber optics",
    "Sterilization, Black lights, Vitamin D",
    "Medical imaging, Airport security, Crystallography",
    "Cancer treatment, Sterilization, Nuclear physics",
  ];
  const WAVE_SOURCES = [
    "Antennas, Stars, Lightning",
    "Magnetrons, Cosmic background",
    "Warm objects, Sun, Fire",
    "Sun, Light bulbs, Lasers",
    "Sun, Hot stars, Welding arcs",
    "X-ray tubes, Pulsars, Synchrotrons",
    "Radioactive decay, Supernovae, Pulsars",
  ];

  // Relative wavelengths for animation (pixels, roughly proportional on log scale)
  const REL_WAVELENGTHS = [120, 80, 50, 30, 18, 10, 5];

  function wavelengthToVisibleColor(fraction: number): string {
    // fraction 0..1 maps across visible spectrum (red to violet)
    const nm = 700 - fraction * 320; // 700nm (red) to 380nm (violet)
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm >= 645 && nm <= 780) { r = 1; }
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }

  function drawSpectrumBar(): void {
    const barY = height * 0.08;
    const barH = height * 0.1;
    const barX = width * 0.05;
    const barW = width * 0.9;
    const regionW = barW / 7;

    // Draw each region
    for (let i = 0; i < 7; i++) {
      const x = barX + i * regionW;
      const isSelected = i === waveType;

      if (i === 3) {
        // Visible light: draw actual rainbow gradient
        const grad = ctx.createLinearGradient(x, 0, x + regionW, 0);
        for (let s = 0; s <= 10; s++) {
          grad.addColorStop(s / 10, wavelengthToVisibleColor(s / 10));
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = WAVE_COLORS[i];
      }

      ctx.globalAlpha = isSelected ? 1.0 : 0.5;
      ctx.fillRect(x, barY, regionW - 2, barH);
      ctx.globalAlpha = 1;

      // Selection indicator
      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, barY - 1, regionW, barH + 2);

        // Arrow below
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(x + regionW / 2 - 6, barY + barH + 4);
        ctx.lineTo(x + regionW / 2 + 6, barY + barH + 4);
        ctx.lineTo(x + regionW / 2, barY + barH + 12);
        ctx.closePath();
        ctx.fill();
      }

      // Label above
      ctx.fillStyle = isSelected ? "#fff" : "rgba(255,255,255,0.6)";
      ctx.font = `${isSelected ? "bold " : ""}${Math.max(9, Math.min(12, width / 70))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(WAVE_NAMES[i], x + regionW / 2, barY - 4);
    }

    // Wavelength scale (logarithmic)
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(8, Math.min(10, width / 80))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const scaleY = barY + barH + 16;
    const labels = ["100 km", "1 m", "1 mm", "700 nm", "380 nm", "10 nm", "0.01 nm", "0.0001 nm"];
    for (let i = 0; i <= 7; i++) {
      const x = barX + i * regionW;
      ctx.fillText(labels[i], x, scaleY);
    }
    // Arrow and label for wavelength axis
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.max(8, Math.min(10, width / 80))}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Wavelength -->  shorter", barX, scaleY + 14);
    ctx.textAlign = "right";
    ctx.fillText("Frequency -->  higher", barX + barW, scaleY + 14);
  }

  function drawAnimatedWave(): void {
    const waveY = height * 0.48;
    const waveH = height * 0.15;
    const waveX = width * 0.08;
    const waveW = width * 0.84;
    const lambda = REL_WAVELENGTHS[waveType];
    const color = WAVE_COLORS[waveType];
    const t = time * animationSpeed;

    // Background panel
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(waveX - 10, waveY - waveH - 20, waveW + 20, waveH * 2 + 40, 8);
    ctx.fill();

    // Center axis
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(waveX, waveY);
    ctx.lineTo(waveX + waveW, waveY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw wave (sinusoidal)
    if (waveType === 3) {
      // Visible: draw rainbow-colored wave
      const segments = Math.ceil(waveW);
      for (let px = 0; px < segments; px++) {
        const x = waveX + px;
        const phase = (px / lambda) * Math.PI * 2 - t * 3;
        const y1 = waveY + Math.sin(phase) * waveH * 0.8;
        const phase2 = ((px + 1) / lambda) * Math.PI * 2 - t * 3;
        const y2 = waveY + Math.sin(phase2) * waveH * 0.8;
        const frac = px / waveW;
        ctx.strokeStyle = wavelengthToVisibleColor(frac);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x + 1, y2);
        ctx.stroke();
      }
    } else {
      // Draw wave with glow: two passes (glow then crisp)
      for (const pass of [{ alpha: 0.15, lw: 8 }, { alpha: 1, lw: 2.5 }]) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = pass.alpha;
        ctx.lineWidth = pass.lw;
        ctx.beginPath();
        for (let px = 0; px <= waveW; px++) {
          const x = waveX + px;
          const phase = (px / lambda) * Math.PI * 2 - t * 3;
          const y = waveY + Math.sin(phase) * waveH * 0.8;
          if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Wavelength marker bracket
    const bY = waveY - waveH - 8, sP = waveW * 0.3;
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waveX + sP, bY); ctx.lineTo(waveX + sP, bY + 8);
    ctx.moveTo(waveX + sP, bY + 4); ctx.lineTo(waveX + sP + lambda, bY + 4);
    ctx.moveTo(waveX + sP + lambda, bY); ctx.lineTo(waveX + sP + lambda, bY + 8);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("\u03BB", waveX + sP + lambda / 2, bY);
    // E field label
    ctx.fillStyle = color; ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("E", waveX - 8, waveY - waveH * 0.5);
  }

  function drawDetailsPanel(): void {
    if (!showDetails) return;

    const panelX = width * 0.08;
    const panelY = height * 0.68;
    const panelW = width * 0.84;
    const panelH = height * 0.28;
    const color = WAVE_COLORS[waveType];

    // Panel background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const pad = 14;
    const lineH = Math.max(16, panelH / 7.5);
    let ty = panelY + pad + lineH * 0.5;
    const leftCol = panelX + pad;
    const rightCol = panelX + panelW * 0.52;
    const fontSize = Math.max(10, Math.min(13, width / 60));

    // Title
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize + 2}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${WAVE_NAMES[waveType]} Waves`, leftCol, ty);
    ty += lineH * 1.1;

    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#ccc";

    // Left column: properties
    ctx.fillText(`Wavelength: ${WAVE_LAMBDA[waveType]}`, leftCol, ty);
    ty += lineH;
    ctx.fillText(`Frequency: ${WAVE_FREQ[waveType]}`, leftCol, ty);
    ty += lineH;

    // Energy indicator
    const energyLevel = waveType; // 0 (low) to 6 (high)
    ctx.fillText("Energy: ", leftCol, ty);
    const energyTextW = ctx.measureText("Energy: ").width;
    for (let i = 0; i <= 6; i++) {
      ctx.fillStyle = i <= energyLevel ? color : "rgba(255,255,255,0.15)";
      ctx.fillRect(leftCol + energyTextW + i * 14, ty - 5, 10, 10);
    }
    ty += lineH;

    // Formulas
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `italic ${fontSize - 1}px system-ui, sans-serif`;
    ctx.fillText("c = \u03BBf    E = hf", leftCol, ty);

    // Right column: applications
    let ry = panelY + pad + lineH * 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillText("Applications:", rightCol, ry);
    ry += lineH;

    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#bbb";
    const apps = WAVE_APPS[waveType].split(", ");
    for (const app of apps) {
      ctx.fillText(`\u2022 ${app}`, rightCol + 4, ry);
      ry += lineH;
    }

    // Sources
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillText("Sources:", rightCol, ry);
    ry += lineH;
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#bbb";
    const srcs = WAVE_SOURCES[waveType].split(", ");
    for (const src of srcs) {
      ctx.fillText(`\u2022 ${src}`, rightCol + 4, ry);
      ry += lineH;
    }
  }

  function drawEnergyArrow(): void {
    const ay = height * 0.06, bx = width * 0.05, bw = width * 0.9;
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, "rgba(255,100,100,0.3)");
    grad.addColorStop(1, "rgba(150,50,255,0.8)");
    ctx.strokeStyle = grad; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, ay); ctx.lineTo(bx + bw, ay); ctx.stroke();
    ctx.fillStyle = "rgba(150,50,255,0.8)";
    ctx.beginPath();
    ctx.moveTo(bx + bw, ay); ctx.lineTo(bx + bw - 8, ay - 4); ctx.lineTo(bx + bw - 8, ay + 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${Math.max(8, Math.min(10, width / 85))}px system-ui, sans-serif`;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("Increasing Energy & Frequency -->", bx + bw - 12, ay);
  }

  function drawTitle(): void {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(13, Math.min(18, width / 40))}px system-ui, sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Electromagnetic Spectrum", width * 0.05, height * 0.01);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(9, Math.min(11, width / 65))}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("c = 3.0 \u00D7 10\u2078 m/s", width * 0.95, height * 0.015);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    waveType = Math.round(params.waveType ?? 3);
    if (waveType < 0) waveType = 0;
    if (waveType > 6) waveType = 6;
    showDetails = params.showDetails ?? 1;
    animationSpeed = params.animationSpeed ?? 1;
    time += dt * animationSpeed;
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y < height; y += 40) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    drawTitle();
    drawEnergyArrow();
    drawSpectrumBar();
    drawAnimatedWave();
    drawDetailsPanel();
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const name = WAVE_NAMES[waveType];
    return (
      `Electromagnetic Spectrum: Currently viewing ${name} waves. ` +
      `Wavelength range: ${WAVE_LAMBDA[waveType]}. ` +
      `Frequency range: ${WAVE_FREQ[waveType]}. ` +
      `Energy level: ${waveType + 1}/7 (${waveType < 2 ? "low" : waveType < 5 ? "medium" : "high"}). ` +
      `Applications: ${WAVE_APPS[waveType]}. ` +
      `Key relationships: c = lambda * f (speed of light = wavelength * frequency), ` +
      `E = hf (photon energy = Planck constant * frequency). ` +
      `Higher frequency means shorter wavelength and higher energy.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectromagneticWavesFactory;
