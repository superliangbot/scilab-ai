import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

// --- Helpers ---

/** Convert wavelength in nm to an approximate visible-spectrum RGB string. */
function wavelengthToRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;

  if (nm >= 300 && nm < 380) {
    // UV region -- render as dim violet-blue
    const t = (nm - 300) / (380 - 300);
    r = Math.round(60 + t * 40);
    g = 0;
    b = Math.round(120 + t * 60);
  } else if (nm >= 380 && nm < 440) {
    r = Math.round(((440 - nm) / (440 - 380)) * 255);
    g = 0;
    b = 255;
  } else if (nm >= 440 && nm < 490) {
    r = 0;
    g = Math.round(((nm - 440) / (490 - 440)) * 255);
    b = 255;
  } else if (nm >= 490 && nm < 510) {
    r = 0;
    g = 255;
    b = Math.round(((510 - nm) / (510 - 490)) * 255);
  } else if (nm >= 510 && nm < 580) {
    r = Math.round(((nm - 510) / (580 - 510)) * 255);
    g = 255;
    b = 0;
  } else if (nm >= 580 && nm < 645) {
    r = 255;
    g = Math.round(((645 - nm) / (645 - 580)) * 255);
    b = 0;
  } else if (nm >= 645 && nm <= 700) {
    r = 255;
    g = 0;
    b = 0;
  } else if (nm > 700 && nm <= 900) {
    // Near-IR region -- render as dim red
    const t = 1 - (nm - 700) / (900 - 700);
    r = Math.round(140 + t * 115);
    g = 0;
    b = 0;
  }

  // Intensity factor: edges of visible range are dimmer
  let factor = 1.0;
  if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * ((nm - 380) / (420 - 380));
  else if (nm >= 645 && nm <= 700) factor = 0.3 + 0.7 * ((700 - nm) / (700 - 645));
  else if (nm < 380 || nm > 700) factor = 0.5;

  r = Math.min(255, Math.round(r * factor));
  g = Math.min(255, Math.round(g * factor));
  b = Math.min(255, Math.round(b * factor));

  return [r, g, b];
}

function wavelengthToFrequency(nm: number): number {
  // c = f * lambda => f = c / lambda
  // c = 3e8 m/s, lambda in nm => lambda_m = nm * 1e-9
  // f in THz = f / 1e12
  return (3e8 / (nm * 1e-9)) / 1e12;
}

function wavelengthToEnergy(nm: number): number {
  // E = hf = hc / lambda
  // h = 6.626e-34 J*s, c = 3e8 m/s, 1 eV = 1.602e-19 J
  return (6.626e-34 * 3e8) / (nm * 1e-9 * 1.602e-19);
}

function getRegionName(nm: number): string {
  if (nm < 380) return "Ultraviolet (UV)";
  if (nm <= 450) return "Violet";
  if (nm <= 495) return "Blue";
  if (nm <= 570) return "Green";
  if (nm <= 590) return "Yellow";
  if (nm <= 620) return "Orange";
  if (nm <= 700) return "Red";
  return "Near Infrared (IR)";
}

// --- Factory ---

const ElectromagneticWavesAroundOfVisibleRaysFactory: SimulationFactory = () => {
  const config = getSimConfig("electromagnetic-waves-around-of-visible-rays")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let wavelength = 550;
  let showDispersion = 1;
  let animationSpeed = 1.0;
  let showScale = 1;

  // Animation state
  let wavePhase = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    wavePhase = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    wavelength = params.wavelength ?? 550;
    showDispersion = Math.round(params.showDispersion ?? 1);
    animationSpeed = params.animationSpeed ?? 1.0;
    showScale = Math.round(params.showScale ?? 1);

    const effectiveDt = dt * animationSpeed;
    time += effectiveDt;
    wavePhase += effectiveDt * 4.0;
  }

  // --- Rendering ---

  function drawBackground(): void {
    const bgGrad = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, "#0e0e20");
    bgGrad.addColorStop(0.6, "#09091a");
    bgGrad.addColorStop(1, "#030310");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawSpectrumBar(): void {
    if (!showScale) return;

    const barX = width * 0.06;
    const barW = width * 0.88;
    const barY = height * 0.06;
    const barH = 28;

    // Label
    ctx.fillStyle = "rgba(200, 210, 240, 0.9)";
    ctx.font = `bold ${Math.max(11, width * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Electromagnetic Spectrum (300 nm - 900 nm)", width / 2, barY - 6);

    // Draw spectrum gradient bar
    for (let px = 0; px < barW; px++) {
      const nm = 300 + (px / barW) * 600;
      const [r, g, b] = wavelengthToRGB(nm);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(barX + px, barY, 1, barH);
    }

    // Border
    ctx.strokeStyle = "rgba(100, 120, 180, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Region labels below bar
    const regions = [
      { label: "UV", start: 300, end: 380, color: "rgba(140, 100, 220, 0.85)" },
      { label: "Violet", start: 380, end: 450, color: "rgba(160, 100, 255, 0.9)" },
      { label: "Blue", start: 450, end: 495, color: "rgba(80, 140, 255, 0.9)" },
      { label: "Green", start: 495, end: 570, color: "rgba(60, 220, 80, 0.9)" },
      { label: "Yellow", start: 570, end: 590, color: "rgba(255, 240, 60, 0.9)" },
      { label: "Orange", start: 590, end: 620, color: "rgba(255, 160, 40, 0.9)" },
      { label: "Red", start: 620, end: 700, color: "rgba(255, 60, 40, 0.9)" },
      { label: "IR", start: 700, end: 900, color: "rgba(180, 60, 40, 0.85)" },
    ];

    const fontSize = Math.max(9, width * 0.012);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";

    for (const region of regions) {
      const x1 = barX + ((region.start - 300) / 600) * barW;
      const x2 = barX + ((region.end - 300) / 600) * barW;
      const cx = (x1 + x2) / 2;

      // Tick marks at boundaries
      ctx.strokeStyle = "rgba(200, 220, 255, 0.25)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1, barY + barH);
      ctx.lineTo(x1, barY + barH + 6);
      ctx.stroke();

      // Region label
      ctx.fillStyle = region.color;
      ctx.fillText(region.label, cx, barY + barH + 16);
    }

    // Current wavelength indicator
    const curX = barX + ((wavelength - 300) / 600) * barW;
    const [cr, cg, cb] = wavelengthToRGB(wavelength);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curX, barY - 2);
    ctx.lineTo(curX, barY + barH + 2);
    ctx.stroke();

    // Triangle pointer
    ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
    ctx.beginPath();
    ctx.moveTo(curX, barY + barH + 3);
    ctx.lineTo(curX - 5, barY + barH + 10);
    ctx.lineTo(curX + 5, barY + barH + 10);
    ctx.closePath();
    ctx.fill();

    // Wavelength labels at key points
    const ticks = [300, 380, 450, 495, 570, 590, 620, 700, 900];
    ctx.font = `${Math.max(8, width * 0.01)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(180, 190, 220, 0.55)";
    ctx.textAlign = "center";
    for (const t of ticks) {
      const tx = barX + ((t - 300) / 600) * barW;
      ctx.fillText(`${t}`, tx, barY + barH + 27);
    }
  }

  function drawWaveAnimation(): void {
    const waveY = height * 0.40;
    const waveH = height * 0.20;
    const waveX = width * 0.08;
    const waveW = width * 0.84;
    const amplitude = waveH * 0.42;

    // The visual wavelength in pixels scales with the actual wavelength
    // Shorter wavelength => more oscillations visible
    const minPixelWL = 20;
    const maxPixelWL = 80;
    const pixelWavelength = minPixelWL + ((wavelength - 300) / 600) * (maxPixelWL - minPixelWL);

    const [r, g, b] = wavelengthToRGB(wavelength);

    // Glow background for wave area
    const glowGrad = ctx.createRadialGradient(
      waveX + waveW / 2, waveY, 0,
      waveX + waveW / 2, waveY, waveW * 0.4
    );
    glowGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.06)`);
    glowGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(waveX, waveY - waveH, waveW, waveH * 2);

    // Center line
    ctx.strokeStyle = "rgba(100, 120, 180, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(waveX, waveY);
    ctx.lineTo(waveX + waveW, waveY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw the sine wave
    ctx.beginPath();
    const numPoints = Math.round(waveW);
    for (let i = 0; i <= numPoints; i++) {
      const x = waveX + (i / numPoints) * waveW;
      const phase = (i / numPoints) * waveW / pixelWavelength * Math.PI * 2;
      const y = waveY - Math.sin(phase - wavePhase) * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.7)`;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw a second fainter wave offset for a "thickness" effect
    ctx.beginPath();
    for (let i = 0; i <= numPoints; i++) {
      const x = waveX + (i / numPoints) * waveW;
      const phase = (i / numPoints) * waveW / pixelWavelength * Math.PI * 2;
      const y = waveY - Math.sin(phase - wavePhase + 0.3) * amplitude * 0.6;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wave label
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
    ctx.font = `bold ${Math.max(13, width * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(getRegionName(wavelength), waveX, waveY - waveH - 8);

    // Arrow annotations for wavelength span
    const arrowY = waveY + amplitude + 14;
    const arrowStart = waveX + waveW * 0.3;
    const arrowEnd = arrowStart + pixelWavelength;

    ctx.strokeStyle = "rgba(200, 210, 240, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(arrowStart, arrowY);
    ctx.lineTo(arrowEnd, arrowY);
    ctx.stroke();
    // Left arrowhead
    ctx.beginPath();
    ctx.moveTo(arrowStart, arrowY);
    ctx.lineTo(arrowStart + 5, arrowY - 3);
    ctx.lineTo(arrowStart + 5, arrowY + 3);
    ctx.closePath();
    ctx.fillStyle = "rgba(200, 210, 240, 0.5)";
    ctx.fill();
    // Right arrowhead
    ctx.beginPath();
    ctx.moveTo(arrowEnd, arrowY);
    ctx.lineTo(arrowEnd - 5, arrowY - 3);
    ctx.lineTo(arrowEnd - 5, arrowY + 3);
    ctx.closePath();
    ctx.fill();
    // Lambda label
    ctx.fillStyle = "rgba(200, 210, 240, 0.7)";
    ctx.font = `${Math.max(10, width * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("\u03BB", (arrowStart + arrowEnd) / 2, arrowY + 14);
  }

  function drawDispersion(): void {
    if (!showDispersion) return;

    const prismX = width * 0.12;
    const prismY = height * 0.68;
    const prismW = width * 0.14;
    const prismH = height * 0.22;

    // Draw prism (triangle)
    ctx.beginPath();
    ctx.moveTo(prismX + prismW / 2, prismY);
    ctx.lineTo(prismX, prismY + prismH);
    ctx.lineTo(prismX + prismW, prismY + prismH);
    ctx.closePath();

    const prismGrad = ctx.createLinearGradient(prismX, prismY, prismX + prismW, prismY + prismH);
    prismGrad.addColorStop(0, "rgba(160, 200, 255, 0.18)");
    prismGrad.addColorStop(0.5, "rgba(200, 220, 255, 0.12)");
    prismGrad.addColorStop(1, "rgba(160, 200, 255, 0.08)");
    ctx.fillStyle = prismGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 210, 255, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Incoming white light beam
    const beamStartX = prismX - width * 0.08;
    const beamHitY = prismY + prismH * 0.5;
    const beamHitX = prismX + prismW * 0.22;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamHitY);
    ctx.lineTo(beamHitX, beamHitY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = `${Math.max(10, width * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("White Light", beamStartX + (beamHitX - beamStartX) * 0.4, beamHitY - 10);

    // Dispersed rays exiting the prism
    const exitX = prismX + prismW * 0.78;
    const exitY = prismY + prismH * 0.55;
    const rayLength = width * 0.22;

    const dispersionColors = [
      { nm: 400, angle: -0.32 },
      { nm: 430, angle: -0.24 },
      { nm: 470, angle: -0.16 },
      { nm: 520, angle: -0.08 },
      { nm: 560, angle: 0.0 },
      { nm: 590, angle: 0.08 },
      { nm: 620, angle: 0.16 },
      { nm: 660, angle: 0.24 },
      { nm: 690, angle: 0.32 },
    ];

    for (const dc of dispersionColors) {
      const [cr, cg, cb] = wavelengthToRGB(dc.nm);
      const endX = exitX + Math.cos(dc.angle) * rayLength;
      const endY = exitY + Math.sin(dc.angle) * rayLength;

      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, 0.85)`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `rgba(${cr}, ${cg}, ${cb}, 0.5)`;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(exitX, exitY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Label the dispersed spectrum
    const labelX = exitX + rayLength + 8;
    const topLabelY = exitY + Math.sin(-0.32) * rayLength;
    const botLabelY = exitY + Math.sin(0.32) * rayLength;

    ctx.font = `${Math.max(9, width * 0.012)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(140, 100, 255, 0.8)";
    ctx.fillText("Violet (short \u03BB)", labelX, topLabelY + 4);
    ctx.fillStyle = "rgba(255, 60, 40, 0.8)";
    ctx.fillText("Red (long \u03BB)", labelX, botLabelY + 4);

    // Energy arrow on the right
    const arrowX = labelX + width * 0.1;
    if (arrowX < width - 20) {
      ctx.strokeStyle = "rgba(200, 210, 240, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(arrowX, topLabelY - 6);
      ctx.lineTo(arrowX, botLabelY + 10);
      ctx.stroke();
      // Arrow pointing up
      ctx.beginPath();
      ctx.moveTo(arrowX, topLabelY - 6);
      ctx.lineTo(arrowX - 4, topLabelY + 2);
      ctx.lineTo(arrowX + 4, topLabelY + 2);
      ctx.closePath();
      ctx.fillStyle = "rgba(200, 210, 240, 0.4)";
      ctx.fill();

      ctx.fillStyle = "rgba(200, 210, 240, 0.45)";
      ctx.font = `${Math.max(9, width * 0.011)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(arrowX + 12, (topLabelY + botLabelY) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("More Energy \u2192", 0, 0);
      ctx.restore();
    }

    // Dispersion title
    ctx.fillStyle = "rgba(200, 210, 240, 0.8)";
    ctx.font = `bold ${Math.max(11, width * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Prism Dispersion", prismX - width * 0.04, prismY - 10);
  }

  function drawInfoPanel(): void {
    const panelW = width * 0.26;
    const panelH = 120;
    const panelX = width - panelW - width * 0.04;
    const panelY = height * 0.66;

    // Background panel
    ctx.fillStyle = "rgba(10, 10, 30, 0.65)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 100, 160, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.stroke();

    const [r, g, b] = wavelengthToRGB(wavelength);
    const freq = wavelengthToFrequency(wavelength);
    const energy = wavelengthToEnergy(wavelength);

    // Color swatch
    const swatchSize = 16;
    const swatchX = panelX + 12;
    const swatchY = panelY + 14;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(swatchX + swatchSize / 2, swatchY + swatchSize / 2, swatchSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Title
    ctx.fillStyle = "rgba(220, 225, 245, 0.95)";
    ctx.font = `bold ${Math.max(12, width * 0.015)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Selected Wavelength", swatchX + swatchSize + 8, swatchY + 13);

    // Data rows
    const dataX = panelX + 14;
    let dataY = panelY + 48;
    const lineH = 20;
    const fontSize = Math.max(11, width * 0.014);
    ctx.font = `${fontSize}px system-ui, sans-serif`;

    // Wavelength
    ctx.fillStyle = "rgba(180, 195, 230, 0.8)";
    ctx.fillText(`Wavelength:  ${wavelength.toFixed(0)} nm`, dataX, dataY);
    dataY += lineH;

    // Frequency
    ctx.fillText(`Frequency:   ${freq.toFixed(1)} THz`, dataX, dataY);
    dataY += lineH;

    // Energy
    ctx.fillText(`Energy:      ${energy.toFixed(3)} eV`, dataX, dataY);
    dataY += lineH;

    // Region
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
    ctx.fillText(`Region:      ${getRegionName(wavelength)}`, dataX, dataY);
  }

  function drawEnergyComparison(): void {
    // Small comparison at bottom-center showing UV > Visible > IR energy
    const cx = width * 0.5;
    const cy = height * 0.95;
    const fontSize = Math.max(10, width * 0.012);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(160, 170, 210, 0.6)";
    ctx.fillText(
      "UV (higher energy, shorter \u03BB)  \u2190\u2192  Visible  \u2190\u2192  IR (lower energy, longer \u03BB)",
      cx, cy
    );
  }

  function render(): void {
    drawBackground();
    drawSpectrumBar();
    drawWaveAnimation();
    drawDispersion();
    drawInfoPanel();
    drawEnergyComparison();
  }

  function reset(): void {
    time = 0;
    wavePhase = 0;
  }

  function destroy(): void {
    // No external resources to clean up
  }

  function getStateDescription(): string {
    const freq = wavelengthToFrequency(wavelength);
    const energy = wavelengthToEnergy(wavelength);
    const region = getRegionName(wavelength);
    return (
      `Electromagnetic Waves Around Visible Rays: viewing wavelength ${wavelength.toFixed(0)} nm ` +
      `(${region}), frequency ${freq.toFixed(1)} THz, energy ${energy.toFixed(3)} eV. ` +
      `Dispersion: ${showDispersion ? "on" : "off"}, scale: ${showScale ? "on" : "off"}, ` +
      `speed: ${animationSpeed.toFixed(1)}x. ` +
      `UV light (<380 nm) has more energy (shorter wavelength). ` +
      `IR light (>700 nm) has less energy (longer wavelength). ` +
      `Visible range spans 380-700 nm: violet, blue, green, yellow, orange, red.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectromagneticWavesAroundOfVisibleRaysFactory;
