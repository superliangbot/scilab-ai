import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "fourier-analysis",
  title: "Fourier Analysis",
  category: "math",
  description:
    "Decompose waveforms into sine/cosine components — see how harmonics build complex shapes.",
  longDescription:
    "Fourier analysis decomposes any periodic function into a sum of sine and cosine waves: f(x) = a₀/2 + Σ[aₙcos(nx) + bₙsin(nx)]. This simulation lets you choose a target waveform (square, sawtooth, triangle) and see how adding successive harmonics approximates it. Adjust the number of terms to watch the Gibbs phenomenon and understand frequency-domain representation.",
  parameters: [
    { key: "waveform", label: "Waveform (0=Square, 1=Sawtooth, 2=Triangle)", min: 0, max: 2, step: 1, defaultValue: 0 },
    { key: "harmonics", label: "Number of Harmonics", min: 1, max: 30, step: 1, defaultValue: 5 },
    { key: "showComponents", label: "Show Components (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    { key: "speed", label: "Animation Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
  ],
  thumbnailColor: "#7c3aed",
};

const WAVEFORM_NAMES = ["Square Wave", "Sawtooth Wave", "Triangle Wave"];

const FourierAnalysisFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let waveformType = 0;
  let numHarmonics = 5;
  let showComponents = 1;
  let speed = 1;

  function targetFunction(x: number): number {
    const p = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    switch (waveformType) {
      case 0: // Square wave
        return p < Math.PI ? 1 : -1;
      case 1: // Sawtooth
        return 1 - p / Math.PI;
      case 2: // Triangle
        return p < Math.PI ? -1 + (2 * p) / Math.PI : 3 - (2 * p) / Math.PI;
      default:
        return 0;
    }
  }

  function fourierCoefficients(n: number): { a: number; b: number } {
    switch (waveformType) {
      case 0: // Square wave: b_n = 4/(nπ) for odd n
        if (n % 2 === 0) return { a: 0, b: 0 };
        return { a: 0, b: 4 / (n * Math.PI) };
      case 1: // Sawtooth: b_n = 2(-1)^(n+1) / (nπ)
        return { a: 0, b: (2 * Math.pow(-1, n + 1)) / (n * Math.PI) };
      case 2: // Triangle: b_n = 8sin(nπ/2)/(n²π²) for odd n
        if (n % 2 === 0) return { a: 0, b: 0 };
        return { a: 0, b: (8 * Math.sin((n * Math.PI) / 2)) / (n * n * Math.PI * Math.PI) };
      default:
        return { a: 0, b: 0 };
    }
  }

  function fourierSum(x: number, nTerms: number): number {
    let sum = 0;
    for (let n = 1; n <= nTerms; n++) {
      const { a, b } = fourierCoefficients(n);
      sum += a * Math.cos(n * x) + b * Math.sin(n * x);
    }
    return sum;
  }

  function drawWaveformPlot() {
    const px = 40;
    const py = H * 0.08;
    const pw = W - 80;
    const ph = H * 0.4;
    const centerY = py + ph / 2;

    // Background
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(px, py, pw, ph);

    // Grid
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = py + (ph / 4) * i;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + pw, y);
      ctx.stroke();
    }

    // Zero line
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, centerY);
    ctx.lineTo(px + pw, centerY);
    ctx.stroke();

    const scaleY = ph * 0.4;
    const periods = 2;
    const xRange = periods * 2 * Math.PI;

    // Target waveform
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= pw; i++) {
      const x = (i / pw) * xRange;
      const y = centerY - targetFunction(x) * scaleY;
      if (i === 0) ctx.moveTo(px + i, y);
      else ctx.lineTo(px + i, y);
    }
    ctx.stroke();

    // Individual components
    if (showComponents) {
      for (let n = 1; n <= numHarmonics; n++) {
        const { a, b } = fourierCoefficients(n);
        if (Math.abs(a) < 0.001 && Math.abs(b) < 0.001) continue;

        ctx.beginPath();
        const hue = (n * 40) % 360;
        ctx.strokeStyle = `hsla(${hue}, 60%, 55%, 0.35)`;
        ctx.lineWidth = 1;
        for (let i = 0; i <= pw; i++) {
          const x = (i / pw) * xRange;
          const val = a * Math.cos(n * x) + b * Math.sin(n * x);
          const y = centerY - val * scaleY;
          if (i === 0) ctx.moveTo(px + i, y);
          else ctx.lineTo(px + i, y);
        }
        ctx.stroke();
      }
    }

    // Fourier approximation
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= pw; i++) {
      const x = (i / pw) * xRange;
      const y = centerY - fourierSum(x, numHarmonics) * scaleY;
      if (i === 0) ctx.moveTo(px + i, y);
      else ctx.lineTo(px + i, y);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Amplitude", px + 4, py + 14);

    ctx.textAlign = "center";
    ctx.fillText("0", px + pw / 4, centerY + 14);
    ctx.fillText("π", px + pw / 4, py + ph + 14);
    ctx.fillText("2π", px + pw / 2, py + ph + 14);

    // Legend
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(px + pw - 120, py + 6, 10, 3);
    ctx.fillStyle = "#475569";
    ctx.fillText("Target", px + pw - 6, py + 12);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(px + pw - 120, py + 18, 10, 3);
    ctx.fillStyle = "#475569";
    ctx.fillText(`Fourier (${numHarmonics} terms)`, px + pw - 6, py + 24);
  }

  function drawSpectrumPlot() {
    const px = 40;
    const py = H * 0.56;
    const pw = W - 80;
    const ph = H * 0.3;

    // Background
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#475569";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Frequency Spectrum (Coefficients)", px + 8, py + 16);

    const barW = Math.min(20, (pw - 40) / (numHarmonics + 1));
    const barArea = pw - 40;
    const maxCoeff = 4 / Math.PI; // max for square wave

    for (let n = 1; n <= numHarmonics; n++) {
      const { a, b } = fourierCoefficients(n);
      const mag = Math.sqrt(a * a + b * b);
      const barH = (mag / maxCoeff) * (ph - 40);
      const bx = px + 20 + (n - 1) * (barArea / numHarmonics);
      const by = py + ph - 20 - barH;

      const hue = (n * 40) % 360;
      ctx.fillStyle = `hsl(${hue}, 60%, 55%)`;
      ctx.fillRect(bx, by, barW * 0.8, barH);

      ctx.fillStyle = "#64748b";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${n}`, bx + barW * 0.4, py + ph - 6);

      if (mag > 0.01) {
        ctx.fillText(mag.toFixed(2), bx + barW * 0.4, by - 4);
      }
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Harmonic number (n)", px + pw / 2, py + ph + 12);
  }

  function drawFormulaPanel() {
    const fx = 20;
    const fy = H * 0.9;
    ctx.fillStyle = "#334155";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";

    let formula = "";
    switch (waveformType) {
      case 0:
        formula = "f(x) = (4/π)[sin(x) + (1/3)sin(3x) + (1/5)sin(5x) + ...]";
        break;
      case 1:
        formula = "f(x) = (2/π)[sin(x) - (1/2)sin(2x) + (1/3)sin(3x) - ...]";
        break;
      case 2:
        formula = "f(x) = (8/π²)[sin(x) - (1/9)sin(3x) + (1/25)sin(5x) - ...]";
        break;
    }
    ctx.fillText(formula, W / 2, fy);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    waveformType = Math.floor(params.waveform ?? 0);
    numHarmonics = Math.floor(params.harmonics ?? 5);
    showComponents = params.showComponents ?? 1;
    speed = params.speed ?? 1;
    time += dt * speed;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#f5f3ff");
    bg.addColorStop(1, "#ede9fe");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Fourier Analysis — ${WAVEFORM_NAMES[waveformType]}`, W / 2, 28);

    drawWaveformPlot();
    drawSpectrumPlot();
    drawFormulaPanel();
  }

  function reset() {
    time = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    const name = WAVEFORM_NAMES[waveformType];
    return `Fourier Analysis of ${name}. Using ${numHarmonics} harmonics. The ${name.toLowerCase()} is being approximated by summing ${numHarmonics} sine/cosine terms. ${numHarmonics < 5 ? "Few harmonics — rough approximation with visible Gibbs phenomenon." : numHarmonics < 15 ? "Moderate number of harmonics — reasonable approximation." : "Many harmonics — close approximation to the target waveform."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FourierAnalysisFactory;
