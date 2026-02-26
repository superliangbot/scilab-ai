import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Stellar Classification and Hertzsprung-Russell Diagram
 * Demonstrates:
 * - H-R diagram (temperature vs luminosity)
 * - Spectral classes: O, B, A, F, G, K, M
 * - Main sequence, red giants, white dwarfs
 * - Star color, temperature, and spectrum visualization
 */

interface SpectralClass {
  type: string;
  tempMin: number;
  tempMax: number;
  color: string;
  colorRGB: string;
  luminosityMin: number;
  luminosityMax: number;
  massRange: string;
  examples: string;
  description: string;
}

const spectralClasses: SpectralClass[] = [
  {
    type: "O", tempMin: 30000, tempMax: 60000, color: "#9bb0ff", colorRGB: "155,176,255",
    luminosityMin: 30000, luminosityMax: 1000000, massRange: "16-150 M\u2609",
    examples: "10 Lacertae, Zeta Ophiuchi", description: "Blue supergiants, very rare and luminous"
  },
  {
    type: "B", tempMin: 10000, tempMax: 30000, color: "#aabfff", colorRGB: "170,191,255",
    luminosityMin: 25, luminosityMax: 30000, massRange: "2.1-16 M\u2609",
    examples: "Rigel, Spica", description: "Blue-white stars, often in young associations"
  },
  {
    type: "A", tempMin: 7500, tempMax: 10000, color: "#cad7ff", colorRGB: "202,215,255",
    luminosityMin: 5, luminosityMax: 25, massRange: "1.4-2.1 M\u2609",
    examples: "Sirius, Vega", description: "White stars with strong hydrogen lines"
  },
  {
    type: "F", tempMin: 6000, tempMax: 7500, color: "#f8f7ff", colorRGB: "248,247,255",
    luminosityMin: 1.5, luminosityMax: 5, massRange: "1.04-1.4 M\u2609",
    examples: "Canopus, Procyon", description: "Yellow-white, calcium lines appear"
  },
  {
    type: "G", tempMin: 5200, tempMax: 6000, color: "#fff4ea", colorRGB: "255,244,234",
    luminosityMin: 0.6, luminosityMax: 1.5, massRange: "0.8-1.04 M\u2609",
    examples: "Sun, Alpha Centauri A", description: "Yellow stars, strong calcium & iron lines"
  },
  {
    type: "K", tempMin: 3700, tempMax: 5200, color: "#ffd2a1", colorRGB: "255,210,161",
    luminosityMin: 0.08, luminosityMax: 0.6, massRange: "0.45-0.8 M\u2609",
    examples: "Arcturus, Aldebaran", description: "Orange stars, molecular bands visible"
  },
  {
    type: "M", tempMin: 2400, tempMax: 3700, color: "#ffcc6f", colorRGB: "255,204,111",
    luminosityMin: 0.0001, luminosityMax: 0.08, massRange: "0.08-0.45 M\u2609",
    examples: "Betelgeuse, Proxima Centauri", description: "Red stars, most common in galaxy"
  },
];

const StellarClassificationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stellar-classification") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let selectedType = 4; // G-type (Sun) by default
  let showHRDiagram = 1;
  let showSpectrum = 1;
  let luminosityScale = 1;

  // Star scatter data for H-R diagram (precomputed)
  let hrStars: Array<{ temp: number; lum: number; classIdx: number }> = [];

  function generateHRStars(): void {
    hrStars = [];
    // Main sequence
    for (let i = 0; i < 200; i++) {
      const classIdx = Math.floor(Math.random() * 7);
      const sc = spectralClasses[classIdx];
      const temp = sc.tempMin + Math.random() * (sc.tempMax - sc.tempMin);
      const logLMin = Math.log10(sc.luminosityMin);
      const logLMax = Math.log10(sc.luminosityMax);
      const lum = Math.pow(10, logLMin + Math.random() * (logLMax - logLMin));
      hrStars.push({ temp, lum: lum * (0.7 + Math.random() * 0.6), classIdx });
    }
    // Red giants
    for (let i = 0; i < 30; i++) {
      const temp = 3000 + Math.random() * 2500;
      const lum = 100 + Math.random() * 5000;
      hrStars.push({ temp, lum, classIdx: temp < 3700 ? 6 : 5 });
    }
    // White dwarfs
    for (let i = 0; i < 20; i++) {
      const temp = 7000 + Math.random() * 30000;
      const lum = 0.0001 + Math.random() * 0.01;
      const classIdx = temp > 30000 ? 0 : temp > 10000 ? 1 : 2;
      hrStars.push({ temp, lum, classIdx });
    }
    // Supergiants
    for (let i = 0; i < 10; i++) {
      const temp = 3500 + Math.random() * 25000;
      const lum = 10000 + Math.random() * 500000;
      const classIdx = temp > 30000 ? 0 : temp > 10000 ? 1 : temp > 7500 ? 2 : temp > 6000 ? 3 : temp > 5200 ? 4 : temp > 3700 ? 5 : 6;
      hrStars.push({ temp, lum, classIdx });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateHRStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    selectedType = Math.round(params.selectedType ?? 4);
    showHRDiagram = params.showHRDiagram ?? 1;
    showSpectrum = params.showSpectrum ?? 1;
    luminosityScale = params.luminosityScale ?? 1;
    time += step;
  }

  function tempToX(temp: number, plotX: number, plotW: number): number {
    // H-R diagram has temperature decreasing left to right (hot on left)
    const logT = Math.log10(Math.max(temp, 2000));
    const logTMin = Math.log10(2000);
    const logTMax = Math.log10(60000);
    return plotX + plotW - ((logT - logTMin) / (logTMax - logTMin)) * plotW;
  }

  function lumToY(lum: number, plotY: number, plotH: number): number {
    const logL = Math.log10(Math.max(lum, 0.00001));
    const logLMin = -5;
    const logLMax = 6;
    return plotY + plotH - ((logL - logLMin) / (logLMax - logLMin)) * plotH;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#05060f");
    bgGrad.addColorStop(1, "#0c1020");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(15, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Stellar Classification", width / 2, 25);

    const sc = spectralClasses[selectedType];

    if (showHRDiagram) {
      drawHRDiagram();
    }

    drawStarInfo(sc);

    if (showSpectrum) {
      drawSpectrum(sc);
    }

    drawStarVisual(sc);
  }

  function drawHRDiagram(): void {
    const plotX = 60;
    const plotY = 50;
    const plotW = width * 0.52;
    const plotH = height - 120;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(plotX - 50, plotY - 10, plotW + 65, plotH + 45, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Hertzsprung-Russell Diagram", plotX + plotW / 2, plotY + 5);

    // Spectral class color bands at top
    const bandH = 8;
    spectralClasses.forEach((sc, i) => {
      const x1 = tempToX(sc.tempMax, plotX, plotW);
      const x2 = tempToX(sc.tempMin, plotX, plotW);
      ctx.fillStyle = i === selectedType ? sc.color : `rgba(${sc.colorRGB}, 0.3)`;
      ctx.fillRect(x1, plotY + 12, x2 - x1, bandH);

      ctx.fillStyle = i === selectedType ? "#fff" : "#64748b";
      ctx.font = `${i === selectedType ? "bold " : ""}10px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(sc.type, (x1 + x2) / 2, plotY + 10);
    });

    // Plot stars
    hrStars.forEach((star) => {
      const sx = tempToX(star.temp, plotX, plotW);
      const sy = lumToY(star.lum * luminosityScale, plotY + 25, plotH - 30);
      const sc = spectralClasses[star.classIdx];
      const isSelected = star.classIdx === selectedType;

      const radius = isSelected ? 2.5 : 1.5;
      const alpha = isSelected ? 0.9 : 0.3;

      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${sc.colorRGB}, ${alpha})`;
      ctx.fill();
    });

    // Region labels
    ctx.fillStyle = "rgba(226, 232, 240, 0.2)";
    ctx.font = "italic 11px system-ui, sans-serif";
    ctx.textAlign = "center";

    // Main sequence diagonal label
    ctx.save();
    ctx.translate(plotX + plotW * 0.5, plotY + plotH * 0.5);
    ctx.rotate(-0.55);
    ctx.fillText("Main Sequence", 0, 0);
    ctx.restore();

    // Red Giants
    const rgPos = { x: tempToX(4000, plotX, plotW), y: lumToY(500, plotY + 25, plotH - 30) };
    ctx.fillText("Red Giants", rgPos.x, rgPos.y - 15);

    // White Dwarfs
    const wdPos = { x: tempToX(15000, plotX, plotW), y: lumToY(0.001, plotY + 25, plotH - 30) };
    ctx.fillText("White Dwarfs", wdPos.x, wdPos.y - 10);

    // Supergiants
    const sgPos = { x: tempToX(8000, plotX, plotW), y: lumToY(100000, plotY + 25, plotH - 30) };
    ctx.fillText("Supergiants", sgPos.x, sgPos.y - 10);

    // Axes
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + 25);
    ctx.lineTo(plotX, plotY + plotH - 5);
    ctx.lineTo(plotX + plotW, plotY + plotH - 5);
    ctx.stroke();

    // Temperature axis (reversed)
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    const tempTicks = [3000, 5000, 7000, 10000, 20000, 40000];
    tempTicks.forEach((t) => {
      const x = tempToX(t, plotX, plotW);
      ctx.beginPath();
      ctx.moveTo(x, plotY + plotH - 5);
      ctx.lineTo(x, plotY + plotH);
      ctx.stroke();
      ctx.fillText(`${t >= 1000 ? Math.round(t / 1000) + "k" : t}`, x, plotY + plotH + 10);
    });
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Temperature (K) \u2190 Hot", plotX + plotW / 2, plotY + plotH + 24);

    // Luminosity axis
    ctx.textAlign = "right";
    ctx.font = "9px system-ui, sans-serif";
    const lumTicks = [0.0001, 0.01, 1, 100, 10000, 1000000];
    lumTicks.forEach((l) => {
      const y = lumToY(l, plotY + 25, plotH - 30);
      ctx.beginPath();
      ctx.moveTo(plotX - 3, y);
      ctx.lineTo(plotX, y);
      ctx.stroke();
      const label = l >= 1 ? (l >= 1000000 ? "10\u2076" : l >= 10000 ? "10\u2074" : l >= 100 ? "10\u00B2" : "1") : (l >= 0.01 ? "10\u207B\u00B2" : "10\u207B\u2074");
      ctx.fillText(label, plotX - 6, y + 3);
    });

    ctx.save();
    ctx.translate(15, plotY + (plotH - 30) / 2 + 25);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Luminosity (L\u2609)", 0, 0);
    ctx.restore();
  }

  function drawStarInfo(sc: SpectralClass): void {
    const panelX = width * 0.58;
    const panelY = 50;
    const panelW = width * 0.38;
    const panelH = showSpectrum ? height * 0.42 : height * 0.6;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = `rgba(${sc.colorRGB}, 0.3)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Star class header
    ctx.fillStyle = sc.color;
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Class ${sc.type}`, panelX + 15, panelY + 28);

    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(sc.description, panelX + 15, panelY + 46);

    // Properties
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    const props = [
      `Temperature: ${sc.tempMin.toLocaleString()} - ${sc.tempMax.toLocaleString()} K`,
      `Mass Range: ${sc.massRange}`,
      `Luminosity: ${sc.luminosityMin} - ${sc.luminosityMax.toLocaleString()} L\u2609`,
      `Examples: ${sc.examples}`,
    ];
    props.forEach((p, i) => {
      ctx.fillText(p, panelX + 15, panelY + 70 + i * 20);
    });

    // Spectral class sequence
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Spectral Sequence:", panelX + 15, panelY + 155);

    ctx.font = "bold 16px system-ui, sans-serif";
    spectralClasses.forEach((s, i) => {
      const bx = panelX + 15 + i * 30;
      const by = panelY + 175;

      if (i === selectedType) {
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.roundRect(bx - 2, by - 14, 26, 22, 4);
        ctx.fill();
        ctx.fillStyle = "#000";
      } else {
        ctx.fillStyle = `rgba(${s.colorRGB}, 0.6)`;
      }
      ctx.fillText(s.type, bx, by);
    });

    // Mnemonic
    ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
    ctx.font = "italic 10px system-ui, sans-serif";
    ctx.fillText("Oh Be A Fine Guy/Girl, Kiss Me", panelX + 15, panelY + 198);
  }

  function drawStarVisual(sc: SpectralClass): void {
    const panelX = width * 0.58;
    const panelW = width * 0.38;
    const starX = panelX + panelW - 60;
    const starY = 120;
    const baseRadius = 25;

    // Determine star size based on luminosity (very rough)
    const avgLum = (sc.luminosityMin + sc.luminosityMax) / 2;
    const sizeScale = Math.min(2, Math.max(0.5, Math.log10(avgLum + 1) / 3));
    const radius = baseRadius * sizeScale;

    // Outer glow
    const glowGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, radius * 3);
    glowGrad.addColorStop(0, `rgba(${sc.colorRGB}, 0.3)`);
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(starX - radius * 3, starY - radius * 3, radius * 6, radius * 6);

    // Star body
    const starGrad = ctx.createRadialGradient(starX - radius * 0.2, starY - radius * 0.2, 0, starX, starY, radius);
    starGrad.addColorStop(0, "#ffffff");
    starGrad.addColorStop(0.3, sc.color);
    starGrad.addColorStop(1, `rgba(${sc.colorRGB}, 0.5)`);
    ctx.beginPath();
    ctx.arc(starX, starY, radius, 0, Math.PI * 2);
    ctx.fillStyle = starGrad;
    ctx.fill();

    // Pulsing corona
    const pulse = 1 + Math.sin(time * 2) * 0.1;
    ctx.beginPath();
    ctx.arc(starX, starY, radius * pulse * 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${sc.colorRGB}, 0.2)`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawSpectrum(sc: SpectralClass): void {
    const panelX = width * 0.58;
    const panelY = height * 0.53;
    const panelW = width * 0.38;
    const panelH = height * 0.42;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Approximate Emission Spectrum", panelX + 15, panelY + 20);

    // Draw spectrum bar
    const specX = panelX + 15;
    const specY = panelY + 35;
    const specW = panelW - 30;
    const specH = 40;

    // Continuous spectrum background
    const specGrad = ctx.createLinearGradient(specX, 0, specX + specW, 0);
    specGrad.addColorStop(0, "#4a0080");   // UV/violet ~380nm
    specGrad.addColorStop(0.1, "#0000ff"); // blue ~450nm
    specGrad.addColorStop(0.25, "#00ffff"); // cyan ~500nm
    specGrad.addColorStop(0.4, "#00ff00"); // green ~550nm
    specGrad.addColorStop(0.55, "#ffff00"); // yellow ~580nm
    specGrad.addColorStop(0.7, "#ff8800"); // orange ~600nm
    specGrad.addColorStop(0.85, "#ff0000"); // red ~650nm
    specGrad.addColorStop(1, "#800000");   // deep red ~750nm
    ctx.fillStyle = specGrad;
    ctx.fillRect(specX, specY, specW, specH);

    // Absorption lines (Fraunhofer-like) based on spectral type
    const absorptionLines = getAbsorptionLines(selectedType);
    absorptionLines.forEach((line) => {
      const lx = specX + (line.wavelength - 380) / (750 - 380) * specW;
      ctx.fillStyle = `rgba(0, 0, 0, ${line.strength})`;
      ctx.fillRect(lx - 1, specY, 2, specH);

      if (line.label) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(line.label, lx, specY + specH + 10);
      }
    });

    // Wavelength scale
    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    const wlTicks = [400, 450, 500, 550, 600, 650, 700];
    wlTicks.forEach((wl) => {
      const x = specX + (wl - 380) / (750 - 380) * specW;
      ctx.fillText(`${wl}`, x, specY + specH + 22);
    });
    ctx.fillText("Wavelength (nm)", specX + specW / 2, specY + specH + 35);

    // Blackbody curve
    const curveY = specY + specH + 45;
    const curveH = panelH - specH - 80;
    if (curveH > 30) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Blackbody Radiation Curve", specX, curveY);

      const avgTemp = (sc.tempMin + sc.tempMax) / 2;
      // Wien's law: peak wavelength = 2.898e6 / T(K) nm
      const peakWL = 2898000 / avgTemp;

      ctx.beginPath();
      ctx.strokeStyle = sc.color;
      ctx.lineWidth = 2;
      let maxIntensity = 0;
      const points: Array<{ x: number; intensity: number }> = [];

      for (let wl = 100; wl <= 2000; wl += 5) {
        // Planck function (simplified shape)
        const x5 = Math.pow(wl, 5);
        const expTerm = Math.exp(14388000 / (wl * avgTemp)) - 1;
        const intensity = 1 / (x5 * expTerm);
        if (intensity > maxIntensity) maxIntensity = intensity;
        points.push({ x: wl, intensity });
      }

      const graphStartY = curveY + 15;
      const graphH = curveH - 20;
      points.forEach((p, i) => {
        const sx = specX + ((p.x - 100) / 1900) * specW;
        const sy = graphStartY + graphH - (p.intensity / maxIntensity) * graphH;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      // Mark peak
      const peakX = specX + ((peakWL - 100) / 1900) * specW;
      if (peakX > specX && peakX < specX + specW) {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(peakX, graphStartY);
        ctx.lineTo(peakX, graphStartY + graphH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#fbbf24";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Peak: ${Math.round(peakWL)}nm`, peakX, graphStartY + graphH + 12);
      }

      // Visible range indicator
      const visStart = specX + ((380 - 100) / 1900) * specW;
      const visEnd = specX + ((750 - 100) / 1900) * specW;
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(visStart, graphStartY, visEnd - visStart, graphH);
      ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillText("visible", (visStart + visEnd) / 2, graphStartY + graphH + 12);
    }
  }

  function getAbsorptionLines(typeIdx: number): Array<{ wavelength: number; strength: number; label?: string }> {
    // Simplified absorption line patterns per spectral type
    const common = [
      { wavelength: 486, strength: 0.6, label: "H\u03B2" },
      { wavelength: 656, strength: 0.5, label: "H\u03B1" },
    ];

    switch (typeIdx) {
      case 0: // O - weak H, He II lines
        return [
          ...common.map((l) => ({ ...l, strength: l.strength * 0.3 })),
          { wavelength: 468, strength: 0.7, label: "He II" },
          { wavelength: 541, strength: 0.5, label: "He II" },
        ];
      case 1: // B - He I, moderate H
        return [
          ...common.map((l) => ({ ...l, strength: l.strength * 0.5 })),
          { wavelength: 447, strength: 0.6, label: "He I" },
          { wavelength: 588, strength: 0.5, label: "He I" },
        ];
      case 2: // A - strongest H lines
        return [
          { wavelength: 410, strength: 0.8, label: "H\u03B4" },
          { wavelength: 434, strength: 0.8, label: "H\u03B3" },
          { wavelength: 486, strength: 0.9, label: "H\u03B2" },
          { wavelength: 656, strength: 0.85, label: "H\u03B1" },
        ];
      case 3: // F - H + Ca II
        return [
          ...common,
          { wavelength: 393, strength: 0.5, label: "Ca II" },
          { wavelength: 397, strength: 0.5 },
          { wavelength: 527, strength: 0.3, label: "Fe" },
        ];
      case 4: // G - Ca II, Fe, weak H (Sun-like)
        return [
          ...common.map((l) => ({ ...l, strength: l.strength * 0.4 })),
          { wavelength: 393, strength: 0.8, label: "Ca II K" },
          { wavelength: 397, strength: 0.7, label: "Ca II H" },
          { wavelength: 527, strength: 0.5, label: "Fe" },
          { wavelength: 518, strength: 0.4, label: "Mg" },
          { wavelength: 589, strength: 0.6, label: "Na D" },
        ];
      case 5: // K - strong metals, molecular bands
        return [
          { wavelength: 393, strength: 0.8, label: "Ca II" },
          { wavelength: 422, strength: 0.6, label: "Ca I" },
          { wavelength: 527, strength: 0.6, label: "Fe" },
          { wavelength: 589, strength: 0.7, label: "Na D" },
          { wavelength: 617, strength: 0.4, label: "TiO" },
        ];
      case 6: // M - strong TiO molecular bands
        return [
          { wavelength: 393, strength: 0.5, label: "Ca II" },
          { wavelength: 589, strength: 0.5, label: "Na" },
          { wavelength: 617, strength: 0.7, label: "TiO" },
          { wavelength: 636, strength: 0.6, label: "TiO" },
          { wavelength: 660, strength: 0.65, label: "TiO" },
          { wavelength: 705, strength: 0.6, label: "TiO" },
        ];
      default:
        return common;
    }
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {
    hrStars = [];
  }

  function getStateDescription(): string {
    const sc = spectralClasses[selectedType];
    return (
      `Stellar classification: viewing class ${sc.type} stars. ` +
      `Temperature range: ${sc.tempMin}-${sc.tempMax}K. Mass: ${sc.massRange}. ` +
      `Luminosity: ${sc.luminosityMin}-${sc.luminosityMax}L\u2609. ` +
      `Examples: ${sc.examples}. ${sc.description}. ` +
      `H-R diagram shows temperature vs luminosity with main sequence, giants, and white dwarfs.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StellarClassificationFactory;
