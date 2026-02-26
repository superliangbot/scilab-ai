import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Electromagnetic Spectrum
 *
 * Displays the full EM spectrum from radio waves to gamma rays.
 * Users can select a band and zoom in to see detail.
 * For the visible band, actual rainbow colours are rendered (380-780 nm).
 *
 * Band boundaries (approximate, in metres):
 *   Radio:      > 1 m       (< 300 MHz)
 *   Microwave:  1 mm - 1 m  (300 MHz - 300 GHz)
 *   Infrared:   780 nm - 1 mm
 *   Visible:    380 nm - 780 nm
 *   UV:         10 nm - 380 nm
 *   X-ray:      0.01 nm - 10 nm
 *   Gamma:      < 0.01 nm
 */

interface BandInfo {
  name: string;
  shortName: string;
  color: string;
  lambdaMin: number;  // metres (log scale)
  lambdaMax: number;
  description: string;
}

const BANDS: BandInfo[] = [
  { name: "Radio Waves",  shortName: "Radio",   color: "#ef4444", lambdaMin: 1e0,   lambdaMax: 1e5,   description: "AM/FM radio, TV broadcast. Wavelengths > 1 m." },
  { name: "Microwaves",   shortName: "Micro",   color: "#f97316", lambdaMin: 1e-3,  lambdaMax: 1e0,   description: "Radar, WiFi, microwave ovens. 1 mm - 1 m." },
  { name: "Infrared",     shortName: "IR",      color: "#eab308", lambdaMin: 7.8e-7, lambdaMax: 1e-3, description: "Thermal radiation, remote controls. 780 nm - 1 mm." },
  { name: "Visible Light", shortName: "Visible", color: "#22c55e", lambdaMin: 3.8e-7, lambdaMax: 7.8e-7, description: "The only EM waves human eyes detect. 380 - 780 nm." },
  { name: "Ultraviolet",  shortName: "UV",      color: "#8b5cf6", lambdaMin: 1e-8,  lambdaMax: 3.8e-7, description: "Sunburn, sterilisation, black lights. 10 - 380 nm." },
  { name: "X-rays",       shortName: "X-ray",   color: "#3b82f6", lambdaMin: 1e-11, lambdaMax: 1e-8,  description: "Medical imaging, crystallography. 0.01 - 10 nm." },
  { name: "Gamma Rays",   shortName: "Gamma",   color: "#ec4899", lambdaMin: 1e-16, lambdaMax: 1e-11, description: "Nuclear decay, cancer treatment. < 0.01 nm." },
];

// Speed of light
const C = 3e8; // m/s

const SpectrumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spectrum") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let selectedBand = 3; // visible
  let zoom = 1;
  let showWavelength = 1;
  let showFrequency = 1;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    selectedBand = Math.round(params.selectedBand ?? 3);
    zoom = params.zoom ?? 1;
    showWavelength = params.showWavelength ?? 1;
    showFrequency = params.showFrequency ?? 1;
    time += dt;
  }

  /** Convert wavelength in nm to approximate visible RGB */
  function wavelengthToRGB(nm: number): [number, number, number] {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) {
      r = -(nm - 440) / (440 - 380);
      b = 1;
    } else if (nm >= 440 && nm < 490) {
      g = (nm - 440) / (490 - 440);
      b = 1;
    } else if (nm >= 490 && nm < 510) {
      g = 1;
      b = -(nm - 510) / (510 - 490);
    } else if (nm >= 510 && nm < 580) {
      r = (nm - 510) / (580 - 510);
      g = 1;
    } else if (nm >= 580 && nm < 645) {
      r = 1;
      g = -(nm - 645) / (645 - 580);
    } else if (nm >= 645 && nm <= 780) {
      r = 1;
    }

    // Intensity factor (dim at edges)
    let factor = 1;
    if (nm >= 380 && nm < 420) factor = 0.3 + 0.7 * (nm - 380) / (420 - 380);
    else if (nm > 700 && nm <= 780) factor = 0.3 + 0.7 * (780 - nm) / (780 - 700);

    return [
      Math.floor(255 * Math.pow(r * factor, 0.8)),
      Math.floor(255 * Math.pow(g * factor, 0.8)),
      Math.floor(255 * Math.pow(b * factor, 0.8)),
    ];
  }

  function formatSI(value: number, unit: string): string {
    const pfx: [number, string][] = [[1e-15,"f"],[1e-12,"p"],[1e-9,"n"],[1e-6,"\u00B5"],[1e-3,"m"],[1e0,""],[1e3,"k"],[1e6,"M"],[1e9,"G"],[1e12,"T"],[1e15,"P"],[1e18,"E"]];
    for (let i = pfx.length - 1; i >= 0; i--) {
      if (Math.abs(value) >= pfx[i][0] * 0.999) return (value / pfx[i][0]).toFixed(1) + " " + pfx[i][1] + unit;
    }
    return value.toExponential(1) + " " + unit;
  }

  function drawFullSpectrum(): void {
    const barL = width * 0.08;
    const barR = width * 0.92;
    const barT = height * 0.1;
    const barH = 50;
    const barW = barR - barL;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(15, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Electromagnetic Spectrum", width / 2, barT - 15);

    // Draw each band as a coloured segment
    const totalBands = BANDS.length;
    const bandWidth = barW / totalBands;

    for (let i = 0; i < totalBands; i++) {
      const band = BANDS[i];
      const bx = barL + i * bandWidth;

      // Band fill
      if (band.shortName === "Visible") {
        // Draw rainbow for visible band
        for (let px = 0; px < bandWidth; px++) {
          const frac = px / bandWidth;
          const nm = 380 + frac * 400; // 380 to 780
          const [r, g, b] = wavelengthToRGB(nm);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(bx + px, barT, 1.5, barH);
        }
      } else {
        ctx.fillStyle = band.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(bx, barT, bandWidth, barH);
        ctx.globalAlpha = 1;
      }

      // Selected highlight with animated pulse
      if (i === selectedBand) {
        ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3; ctx.strokeRect(bx, barT, bandWidth, barH);
        ctx.fillStyle = `rgba(251, 191, 36, ${0.3 + 0.15 * Math.sin(time * 4)})`;
        ctx.fillRect(bx, barT, bandWidth, barH);
      }
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)"; ctx.lineWidth = 1; ctx.strokeRect(bx, barT, bandWidth, barH);

      // Band label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `bold ${Math.max(10, Math.min(12, bandWidth * 0.18))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(band.shortName, bx + bandWidth / 2, barT + barH / 2 + 4);
    }

    // Wavelength scale below
    if (showWavelength) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("\u03BB:", barL - 15, barT + barH + 16);
      for (let i = 0; i < totalBands; i++) {
        const band = BANDS[i];
        const bx = barL + i * bandWidth + bandWidth / 2;
        ctx.fillText(formatSI(band.lambdaMax, "m"), bx, barT + barH + 16);
      }
    }

    // Frequency scale below wavelength
    if (showFrequency) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("f:", barL - 15, barT + barH + 30);
      for (let i = 0; i < totalBands; i++) {
        const band = BANDS[i];
        const bx = barL + i * bandWidth + bandWidth / 2;
        const freq = C / band.lambdaMax;
        ctx.fillText(formatSI(freq, "Hz"), bx, barT + barH + 30);
      }
    }

    // Energy arrow
    const arrowY = barT + barH + 44;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(barL, arrowY); ctx.lineTo(barR, arrowY); ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("\u2190 Low Energy / Long \u03BB", barL, arrowY + 14);
    ctx.textAlign = "right";
    ctx.fillText("High Energy / Short \u03BB \u2192", barR, arrowY + 14);
  }

  function drawZoomedBand(): void {
    const band = BANDS[selectedBand];
    if (!band) return;

    const zx = width * 0.05;
    const zy = height * 0.42;
    const zw = width * 0.9;
    const zh = height * 0.52;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.roundRect(zx, zy, zw, zh, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${band.name} (Zoom: ${zoom.toFixed(0)}x)`, zx + zw / 2, zy + 22);

    // Description
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(band.description, zx + zw / 2, zy + 40);

    // Zoomed spectrum bar
    const barL = zx + 40;
    const barR = zx + zw - 40;
    const barT = zy + 55;
    const barH = 60;
    const barW = barR - barL;

    // Determine wavelength range for zoom
    const logMin = Math.log10(band.lambdaMin);
    const logMax = Math.log10(band.lambdaMax);
    const logCenter = (logMin + logMax) / 2;
    const logHalfRange = (logMax - logMin) / (2 * zoom);
    const zoomLogMin = logCenter - logHalfRange;
    const zoomLogMax = logCenter + logHalfRange;

    if (band.shortName === "Visible") {
      // Render rainbow
      for (let px = 0; px < barW; px++) {
        const frac = px / barW;
        const logLambda = zoomLogMin + frac * (zoomLogMax - zoomLogMin);
        const lambda = Math.pow(10, logLambda);
        const nm = lambda * 1e9;
        if (nm >= 380 && nm <= 780) {
          const [r, g, b] = wavelengthToRGB(nm);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = "#1e293b";
        }
        ctx.fillRect(barL + px, barT, 1.5, barH);
      }

      // Color labels for visible
      const colorNames = [
        { nm: 400, name: "Violet" },
        { nm: 450, name: "Blue" },
        { nm: 500, name: "Cyan" },
        { nm: 530, name: "Green" },
        { nm: 570, name: "Yellow" },
        { nm: 600, name: "Orange" },
        { nm: 650, name: "Red" },
      ];
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const c of colorNames) {
        const logL = Math.log10(c.nm * 1e-9);
        if (logL >= zoomLogMin && logL <= zoomLogMax) {
          const frac = (logL - zoomLogMin) / (zoomLogMax - zoomLogMin);
          const sx = barL + frac * barW;
          ctx.fillStyle = "#e2e8f0";
          ctx.fillText(c.name, sx, barT + barH + 14);
          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(sx, barT + barH);
          ctx.lineTo(sx, barT + barH + 5);
          ctx.stroke();
        }
      }
    } else {
      // Non-visible band: gradient fill
      const grad = ctx.createLinearGradient(barL, 0, barR, 0);
      grad.addColorStop(0, `${band.color}33`);
      grad.addColorStop(0.5, `${band.color}cc`);
      grad.addColorStop(1, `${band.color}33`);
      ctx.fillStyle = grad;
      ctx.fillRect(barL, barT, barW, barH);

      // Animated wave pattern
      ctx.strokeStyle = `${band.color}88`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let px = 0; px < barW; px++) {
        const frac = px / barW;
        const logLambda = zoomLogMin + frac * (zoomLogMax - zoomLogMin);
        const visualFreq = Math.log10(C / Math.pow(10, logLambda)) * 2;
        const sy = barT + barH / 2 + barH * 0.3 * Math.sin(visualFreq * px * 0.05 - time * 3);
        if (px === 0) ctx.moveTo(barL + px, sy); else ctx.lineTo(barL + px, sy);
      }
      ctx.stroke();
    }

    // Band border
    ctx.strokeStyle = band.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(barL, barT, barW, barH);

    // Wavelength and frequency ticks
    const numTicks = 6;
    for (let i = 0; i <= numTicks; i++) {
      const frac = i / numTicks;
      const logL = zoomLogMin + frac * (zoomLogMax - zoomLogMin);
      const lambda = Math.pow(10, logL);
      const sx = barL + frac * barW;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      if (showWavelength) ctx.fillText(formatSI(lambda, "m"), sx, barT + barH + 28);
      if (showFrequency) ctx.fillText(formatSI(C / lambda, "Hz"), sx, barT + barH + 44);
    }
    if (showWavelength) { ctx.textAlign = "right"; ctx.fillText("\u03BB", barL - 8, barT + barH + 28); }
    if (showFrequency) { ctx.textAlign = "right"; ctx.fillText("f", barL - 8, barT + barH + 44); }

    // Photon energy (E = hf)
    const h = 6.626e-34;
    const midLambda = Math.pow(10, (zoomLogMin + zoomLogMax) / 2);
    const midFreq = C / midLambda;
    const midEnergy = h * midFreq;

    const infoY = barT + barH + 65;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`\u03BB=${formatSI(midLambda, "m")} | f=${formatSI(midFreq, "Hz")} | E=hf=${(midEnergy / 1.602e-19).toExponential(2)} eV`, zx + zw / 2, infoY);
    ctx.fillStyle = "#94a3b8"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("c = f\u03BB = 3\u00D710\u2078 m/s  |  E = hf  |  h = 6.626\u00D710\u207B\u00B3\u2074 J\u00B7s", zx + zw / 2, infoY + 20);

    // Neighbouring bands
    ctx.fillStyle = "#64748b"; ctx.font = "11px system-ui, sans-serif";
    if (selectedBand > 0) { ctx.textAlign = "left"; ctx.fillText(`\u2190 ${BANDS[selectedBand - 1].shortName}`, barL, barT - 8); }
    if (selectedBand < BANDS.length - 1) { ctx.textAlign = "right"; ctx.fillText(`${BANDS[selectedBand + 1].shortName} \u2192`, barR, barT - 8); }
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawFullSpectrum();
    drawZoomedBand();

    // Time
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)} s`, 10, height - 8);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const band = BANDS[selectedBand] || BANDS[3];
    const midLambda = Math.sqrt(band.lambdaMin * band.lambdaMax);
    const midFreq = C / midLambda;
    return (
      `EM Spectrum viewer: selected band = ${band.name}, zoom = ${zoom.toFixed(0)}x. ` +
      `${band.description} Wavelength range: ${formatSI(band.lambdaMin, "m")} - ${formatSI(band.lambdaMax, "m")}. ` +
      `Center frequency: ${formatSI(midFreq, "Hz")}. ` +
      `Wavelength labels ${showWavelength ? "on" : "off"}, frequency labels ${showFrequency ? "on" : "off"}.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpectrumFactory;
