import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Stellar Classification
 * Demonstrates:
 * - Hertzsprung-Russell diagram (luminosity vs temperature)
 * - Spectral types O, B, A, F, G, K, M
 * - Planck blackbody radiation curves
 * - Wien's displacement law: λ_max = b/T
 * - Star color as a function of surface temperature
 */

interface SpectralType {
  label: string;
  tempRange: [number, number];
  color: string;
  luminosityRange: [number, number]; // in solar luminosities (log10)
  example: string;
}

const spectralTypes: SpectralType[] = [
  { label: "O", tempRange: [30000, 50000], color: "#9bb0ff", luminosityRange: [4, 6], example: "10 Lacertae" },
  { label: "B", tempRange: [10000, 30000], color: "#aabfff", luminosityRange: [2, 5], example: "Rigel" },
  { label: "A", tempRange: [7500, 10000], color: "#cad7ff", luminosityRange: [0.5, 2.5], example: "Sirius" },
  { label: "F", tempRange: [6000, 7500], color: "#f8f7ff", luminosityRange: [0, 1.5], example: "Procyon" },
  { label: "G", tempRange: [5200, 6000], color: "#fff4ea", luminosityRange: [-0.5, 1], example: "Sun" },
  { label: "K", tempRange: [3700, 5200], color: "#ffd2a1", luminosityRange: [-1, 0.5], example: "Arcturus" },
  { label: "M", tempRange: [2400, 3700], color: "#ffcc6f", luminosityRange: [-2, 0], example: "Betelgeuse" },
];

const StellarClassificationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stellar-classification") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let selectedType = 4; // G by default (Sun)
  let showHR = 1;
  let showSpectrum = 1;
  let lumScale = 1;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    time += Math.min(dt, 0.033);
    selectedType = Math.round(params.selectedType ?? 4);
    selectedType = Math.max(0, Math.min(6, selectedType));
    showHR = params.showHRDiagram ?? 1;
    showSpectrum = params.showSpectrum ?? 1;
    lumScale = params.luminosityScale ?? 1;
  }

  function tempToColor(temp: number): string {
    // Approximate blackbody color from temperature
    const t = temp / 100;
    let r: number, g: number, b: number;

    if (t <= 66) {
      r = 255;
      g = Math.max(0, Math.min(255, 99.47 * Math.log(t) - 161.12));
    } else {
      r = Math.max(0, Math.min(255, 329.7 * Math.pow(t - 60, -0.1332)));
      g = Math.max(0, Math.min(255, 288.12 * Math.pow(t - 60, -0.0755)));
    }
    if (t >= 66) {
      b = 255;
    } else if (t <= 19) {
      b = 0;
    } else {
      b = Math.max(0, Math.min(255, 138.52 * Math.log(t - 10) - 305.04));
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }

  function planck(wavelength: number, temp: number): number {
    // Planck's law: spectral radiance (normalized for display)
    const h = 6.626e-34;
    const c = 3e8;
    const k = 1.381e-23;
    const lam = wavelength * 1e-9; // nm to m
    const exp = (h * c) / (lam * k * temp);
    if (exp > 500) return 0;
    return (1 / Math.pow(lam, 5)) / (Math.exp(exp) - 1);
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Stars background
    drawStarfield();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Stellar Classification", width / 2, 28);

    const st = spectralTypes[selectedType];
    const midTemp = (st.tempRange[0] + st.tempRange[1]) / 2;

    // Star visualization (left side)
    drawStar(midTemp, st);

    // HR Diagram or Spectrum based on layout
    if (showHR > 0.5 && showSpectrum > 0.5) {
      drawHRDiagram(width * 0.5, 50, width * 0.48, height * 0.45);
      drawSpectrum(width * 0.5, height * 0.52, width * 0.48, height * 0.4, midTemp);
    } else if (showHR > 0.5) {
      drawHRDiagram(width * 0.5, 50, width * 0.48, height * 0.85);
    } else if (showSpectrum > 0.5) {
      drawSpectrum(width * 0.5, 50, width * 0.48, height * 0.85, midTemp);
    }

    // Spectral type info
    drawTypeInfo(st, midTemp);
  }

  function drawStarfield(): void {
    // Deterministic stars
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 7919 + 1013) % width);
      const sy = ((i * 6271 + 2137) % height);
      const brightness = 0.2 + 0.6 * ((i * 3571) % 100) / 100;
      const twinkle = 0.8 + 0.2 * Math.sin(time * 2 + i);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + brightness, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${brightness * twinkle * 0.5})`;
      ctx.fill();
    }
  }

  function drawStar(temp: number, st: SpectralType): void {
    const cx = width * 0.25;
    const cy = height * 0.38;
    const baseR = Math.min(width, height) * 0.12;
    const pulse = 1 + 0.03 * Math.sin(time * 1.5);
    const r = baseR * pulse;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.5);
    glow.addColorStop(0, tempToColor(temp));
    glow.addColorStop(0.4, `${tempToColor(temp)}66`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);

    // Star body
    const bodyGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    bodyGrad.addColorStop(0, "#ffffff");
    bodyGrad.addColorStop(0.3, tempToColor(temp));
    bodyGrad.addColorStop(1, tempToColor(temp * 0.7));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Class ${st.label} Star`, cx, cy + r + 25);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`T ≈ ${Math.round(temp).toLocaleString()} K`, cx, cy + r + 42);
    ctx.fillText(`Example: ${st.example}`, cx, cy + r + 58);
  }

  function drawHRDiagram(x: number, y: number, w: number, h: number): void {
    // Panel background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(99,102,241,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Hertzsprung-Russell Diagram", x + w / 2, y + 18);

    const plotX = x + 50;
    const plotY = y + 35;
    const plotW = w - 70;
    const plotH = h - 60;

    // Axes
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Y-axis label (Luminosity)
    ctx.save();
    ctx.translate(plotX - 35, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Luminosity (L☉)", 0, 0);
    ctx.restore();

    // X-axis label (Temperature - reversed)
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature (K) →  hot                    cool  →", x + w / 2, plotY + plotH + 18);

    // Temperature range: 50000K (left) to 2000K (right)
    const tempMin = 2000;
    const tempMax = 50000;
    // Luminosity range: 10^-2 to 10^6
    const lumMin = -2;
    const lumMax = 6;

    function tempToX(t: number): number {
      // Logarithmic, reversed (hot on left)
      const logT = Math.log10(t);
      const logMin = Math.log10(tempMin);
      const logMax = Math.log10(tempMax);
      return plotX + plotW * (1 - (logT - logMin) / (logMax - logMin));
    }

    function lumToY(logL: number): number {
      return plotY + plotH * (1 - (logL - lumMin) / (lumMax - lumMin));
    }

    // Draw main sequence band
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(tempToX(40000), lumToY(5));
    ctx.lineTo(tempToX(30000), lumToY(4));
    ctx.lineTo(tempToX(10000), lumToY(2));
    ctx.lineTo(tempToX(6000), lumToY(0));
    ctx.lineTo(tempToX(3500), lumToY(-1.5));
    ctx.lineTo(tempToX(3500), lumToY(-0.5));
    ctx.lineTo(tempToX(6000), lumToY(1));
    ctx.lineTo(tempToX(10000), lumToY(3));
    ctx.lineTo(tempToX(30000), lumToY(5));
    ctx.lineTo(tempToX(40000), lumToY(6));
    ctx.closePath();
    ctx.fillStyle = "#6366f1";
    ctx.fill();
    ctx.globalAlpha = 1;

    // Label regions
    ctx.fillStyle = "rgba(148,163,184,0.4)";
    ctx.font = "italic 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Main Sequence", tempToX(8000), lumToY(1.5));
    ctx.fillText("Giants", tempToX(4500), lumToY(3));
    ctx.fillText("Supergiants", tempToX(7000), lumToY(5));
    ctx.fillText("White Dwarfs", tempToX(15000), lumToY(-1));

    // Plot spectral type markers
    for (let i = 0; i < spectralTypes.length; i++) {
      const st2 = spectralTypes[i];
      const t = (st2.tempRange[0] + st2.tempRange[1]) / 2;
      const logL = (st2.luminosityRange[0] + st2.luminosityRange[1]) / 2 * lumScale;
      const sx = tempToX(t);
      const sy = lumToY(logL);
      const isSelected = i === selectedType;

      ctx.beginPath();
      ctx.arc(sx, sy, isSelected ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? st2.color : `${st2.color}88`;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = isSelected ? "#fff" : "#94a3b8";
      ctx.font = `${isSelected ? "bold " : ""}9px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(st2.label, sx, sy - (isSelected ? 12 : 8));
    }
  }

  function drawSpectrum(x: number, y: number, w: number, h: number, temp: number): void {
    // Panel background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(99,102,241,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Blackbody Spectrum (Planck's Law)", x + w / 2, y + 18);

    const plotX = x + 50;
    const plotY = y + 30;
    const plotW = w - 70;
    const plotH = h - 55;

    // Wavelength range: 100nm to 2000nm
    const lamMin = 100;
    const lamMax = 2000;

    // Compute peak intensity for normalization
    // Wien's law: lambda_max = 2898000 / T (in nm)
    const wienPeak = 2898000 / temp;
    const peakIntensity = planck(Math.max(lamMin, Math.min(lamMax, wienPeak)), temp);

    // Draw visible light band
    const visMin = 380;
    const visMax = 700;
    for (let px = 0; px < plotW; px++) {
      const lam = lamMin + (px / plotW) * (lamMax - lamMin);
      if (lam >= visMin && lam <= visMax) {
        const hue = 270 - ((lam - visMin) / (visMax - visMin)) * 270;
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.08)`;
        ctx.fillRect(plotX + px, plotY, 1, plotH);
      }
    }

    // Visible bounds labels
    ctx.fillStyle = "rgba(148,163,184,0.3)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    const visMinX = plotX + ((visMin - lamMin) / (lamMax - lamMin)) * plotW;
    const visMaxX = plotX + ((visMax - lamMin) / (lamMax - lamMin)) * plotW;
    ctx.fillText("UV", visMinX - 15, plotY + plotH - 5);
    ctx.fillText("Visible", (visMinX + visMaxX) / 2, plotY + plotH - 5);
    ctx.fillText("IR", visMaxX + 15, plotY + plotH - 5);

    // Draw Planck curve
    ctx.beginPath();
    ctx.strokeStyle = tempToColor(temp);
    ctx.lineWidth = 2;
    for (let px = 0; px <= plotW; px++) {
      const lam = lamMin + (px / plotW) * (lamMax - lamMin);
      const intensity = planck(lam, temp) / peakIntensity;
      const py = plotY + plotH * (1 - Math.min(1, intensity));
      if (px === 0) ctx.moveTo(plotX + px, py);
      else ctx.lineTo(plotX + px, py);
    }
    ctx.stroke();

    // Wien's peak marker
    if (wienPeak >= lamMin && wienPeak <= lamMax) {
      const peakX = plotX + ((wienPeak - lamMin) / (lamMax - lamMin)) * plotW;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(peakX, plotY);
      ctx.lineTo(peakX, plotY + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`λ_max = ${Math.round(wienPeak)} nm`, peakX, plotY - 5);
    }

    // Axes
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // X-axis ticks
    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let lam = 200; lam <= 2000; lam += 200) {
      const tx = plotX + ((lam - lamMin) / (lamMax - lamMin)) * plotW;
      ctx.fillText(`${lam}`, tx, plotY + plotH + 12);
    }
    ctx.fillText("Wavelength (nm)", plotX + plotW / 2, plotY + plotH + 24);

    // Y-axis label
    ctx.save();
    ctx.translate(plotX - 30, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Intensity", 0, 0);
    ctx.restore();
  }

  function drawTypeInfo(st: SpectralType, temp: number): void {
    const infoX = 12;
    const infoY = height * 0.7;
    const infoW = width * 0.46;
    const infoH = height * 0.26;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(infoX, infoY, infoW, infoH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(99,102,241,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = st.color;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Spectral Class ${st.label}`, infoX + 12, infoY + 20);

    const wienPeak = 2898000 / temp;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    const lines = [
      `Temperature range: ${st.tempRange[0].toLocaleString()} – ${st.tempRange[1].toLocaleString()} K`,
      `Wien peak: λ_max = ${Math.round(wienPeak)} nm`,
      `Example: ${st.example}`,
      `Sequence: O  B  A  F  G  K  M  (Oh Be A Fine Girl/Guy, Kiss Me)`,
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, infoX + 12, infoY + 42 + i * 18);
    });

    // Wien's law formula
    ctx.fillStyle = "#fbbf24";
    ctx.font = "italic 11px system-ui, sans-serif";
    ctx.fillText("Wien's Law: λ_max = b/T  (b = 2.898 × 10⁶ nm·K)", infoX + 12, infoY + infoH - 10);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const st = spectralTypes[selectedType];
    const midTemp = (st.tempRange[0] + st.tempRange[1]) / 2;
    const wienPeak = 2898000 / midTemp;
    return (
      `Stellar Classification: viewing spectral class ${st.label} (${st.tempRange[0]}–${st.tempRange[1]} K). ` +
      `Example star: ${st.example}. Wien peak wavelength: ${Math.round(wienPeak)} nm. ` +
      `Stars are classified O, B, A, F, G, K, M from hottest to coolest. ` +
      `The H-R diagram plots luminosity vs temperature, showing main sequence, giants, supergiants, and white dwarfs.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StellarClassificationFactory;
