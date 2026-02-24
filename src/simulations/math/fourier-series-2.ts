import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "fourier-series-2",
  title: "Fourier Series 2",
  category: "math",
  description:
    "Build waveforms by stacking harmonics — see how individual sine components sum to create complex shapes.",
  longDescription:
    "This visualization shows Fourier series construction by stacking individual harmonic components. Each colored bar represents a sine term at a specific frequency. As you add more harmonics (drag or adjust), the composite waveform (black curve) increasingly resembles the target shape. Choose between square, sawtooth, and triangle waves to see their different harmonic structures.",
  parameters: [
    { key: "waveType", label: "Wave (0=Square, 1=Sawtooth, 2=Triangle)", min: 0, max: 2, step: 1, defaultValue: 0 },
    { key: "numHarmonics", label: "Harmonics", min: 1, max: 15, step: 1, defaultValue: 5 },
    { key: "showTarget", label: "Show Target (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    { key: "animSpeed", label: "Animation Speed", min: 0, max: 2, step: 0.5, defaultValue: 1, unit: "×" },
  ],
  thumbnailColor: "#6d28d9",
};

const WAVE_NAMES = ["Square", "Sawtooth", "Triangle"];
const HARMONIC_COLORS = [
  "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444",
  "#ec4899", "#3b82f6", "#14b8a6", "#f97316", "#a855f7",
  "#6366f1", "#10b981", "#eab308", "#f43f5e", "#0ea5e9",
];

const FourierSeries2Factory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let waveType = 0;
  let numHarmonics = 5;
  let showTarget = 1;
  let animSpeed = 1;

  function getCoefficient(n: number): number {
    switch (waveType) {
      case 0: // Square: 4/(nπ) for odd n
        return n % 2 === 0 ? 0 : 4 / (n * Math.PI);
      case 1: // Sawtooth: 2(-1)^(n+1)/(nπ)
        return (2 * Math.pow(-1, n + 1)) / (n * Math.PI);
      case 2: // Triangle: 8sin(nπ/2)/(n²π²) for odd n
        return n % 2 === 0 ? 0 : (8 * Math.sin((n * Math.PI) / 2)) / (n * n * Math.PI * Math.PI);
      default:
        return 0;
    }
  }

  function targetWave(x: number): number {
    const p = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    switch (waveType) {
      case 0: return p < Math.PI ? 1 : -1;
      case 1: return 1 - p / Math.PI;
      case 2: return p < Math.PI ? -1 + (2 * p) / Math.PI : 3 - (2 * p) / Math.PI;
      default: return 0;
    }
  }

  function drawStackedComponents() {
    const px = 30;
    const pw = W - 60;
    const totalH = H * 0.45;
    const startY = H * 0.08;

    // Count non-zero harmonics for layout
    const activeHarmonics: { n: number; coeff: number; idx: number }[] = [];
    for (let n = 1; n <= numHarmonics; n++) {
      const c = getCoefficient(n);
      if (Math.abs(c) > 0.001) {
        activeHarmonics.push({ n, coeff: c, idx: activeHarmonics.length });
      }
    }

    if (activeHarmonics.length === 0) return;
    const barH = Math.min(totalH / activeHarmonics.length, 40);

    const xPhase = time * animSpeed;
    const samples = 200;

    for (let hi = 0; hi < activeHarmonics.length; hi++) {
      const { n, coeff, idx } = activeHarmonics[hi];
      const by = startY + hi * (barH + 4);
      const color = HARMONIC_COLORS[idx % HARMONIC_COLORS.length];

      // Background bar
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(px, by, pw, barH);

      // Waveform within bar
      ctx.beginPath();
      ctx.moveTo(px, by + barH / 2);
      for (let i = 0; i <= samples; i++) {
        const x = (i / samples) * 3 * 2 * Math.PI + xPhase;
        const val = coeff * Math.sin(n * x);
        const pxX = px + (i / samples) * pw;
        const pxY = by + barH / 2 - val * (barH / 2) * 0.9;
        ctx.lineTo(pxX, pxY);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Fill under curve
      ctx.lineTo(px + pw, by + barH / 2);
      ctx.lineTo(px, by + barH / 2);
      ctx.closePath();
      ctx.fillStyle = color + "22";
      ctx.fill();

      // Label
      ctx.fillStyle = color;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`n=${n} (${coeff.toFixed(2)})`, px - 4, by + barH / 2);
    }
  }

  function drawCompositeWave() {
    const px = 30;
    const pw = W - 60;
    const cy = H * 0.68;
    const waveH = H * 0.2;

    // Background
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(px, cy - waveH / 2 - 10, pw, waveH + 20);

    // Zero line
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, cy);
    ctx.lineTo(px + pw, cy);
    ctx.stroke();

    const xPhase = time * animSpeed;
    const samples = 300;

    // Target wave (dashed)
    if (showTarget) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      for (let i = 0; i <= samples; i++) {
        const x = (i / samples) * 3 * 2 * Math.PI + xPhase;
        const val = targetWave(x);
        const pxX = px + (i / samples) * pw;
        const pxY = cy - val * (waveH / 2) * 0.8;
        if (i === 0) ctx.moveTo(pxX, pxY);
        else ctx.lineTo(pxX, pxY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Composite wave
    ctx.beginPath();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= samples; i++) {
      const x = (i / samples) * 3 * 2 * Math.PI + xPhase;
      let val = 0;
      for (let n = 1; n <= numHarmonics; n++) {
        val += getCoefficient(n) * Math.sin(n * x);
      }
      const pxX = px + (i / samples) * pw;
      const pxY = cy - val * (waveH / 2) * 0.8;
      if (i === 0) ctx.moveTo(pxX, pxY);
      else ctx.lineTo(pxX, pxY);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Composite Waveform", px + 4, cy - waveH / 2 - 14);

    if (showTarget) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("(dashed = target)", px + pw - 4, cy - waveH / 2 - 14);
    }
  }

  function drawInfo() {
    const iy = H * 0.88;
    ctx.fillStyle = "#475569";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";

    const activeCount = Array.from({ length: numHarmonics }, (_, i) => i + 1).filter(n => Math.abs(getCoefficient(n)) > 0.001).length;
    ctx.fillText(`${WAVE_NAMES[waveType]} Wave — ${activeCount} active harmonics of ${numHarmonics} requested`, W / 2, iy);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#64748b";
    const terms: string[] = [];
    for (let n = 1; n <= Math.min(numHarmonics, 7); n++) {
      const c = getCoefficient(n);
      if (Math.abs(c) > 0.001) {
        terms.push(`${c > 0 ? "+" : ""}${c.toFixed(2)}·sin(${n}x)`);
      }
    }
    ctx.fillText("f(x) = " + terms.join(" ") + (numHarmonics > 7 ? " + ..." : ""), W / 2, iy + 18);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    waveType = Math.floor(params.waveType ?? 0);
    numHarmonics = Math.floor(params.numHarmonics ?? 5);
    showTarget = params.showTarget ?? 1;
    animSpeed = params.animSpeed ?? 1;
    time += dt;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#eef2ff");
    bg.addColorStop(1, "#e0e7ff");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Fourier Series — Stacked Harmonics (${WAVE_NAMES[waveType]})`, W / 2, 28);

    drawStackedComponents();
    drawCompositeWave();
    drawInfo();
  }

  function reset() {
    time = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    const activeCount = Array.from({ length: numHarmonics }, (_, i) => i + 1).filter(n => Math.abs(getCoefficient(n)) > 0.001).length;
    return `Fourier Series 2 — ${WAVE_NAMES[waveType]} wave built from ${activeCount} harmonic components (up to n=${numHarmonics}). Each colored bar shows an individual sin(nx) component. The black composite wave at the bottom shows their sum. ${activeCount < 3 ? "Very few terms — rough approximation." : activeCount < 8 ? "Moderate terms — recognizable waveform shape." : "Many terms — close approximation to ideal waveform."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FourierSeries2Factory;
