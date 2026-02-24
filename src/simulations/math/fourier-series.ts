import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "fourier-series",
  title: "Fourier Series",
  category: "math",
  description:
    "Visualize Fourier series with rotating epicycles — watch circles trace complex waveforms.",
  longDescription:
    "A Fourier series represents periodic functions as sums of sines and cosines. This simulation uses rotating epicycles (circles within circles) to build waveforms. Each circle represents a harmonic: its radius is the coefficient magnitude and it rotates at the harmonic frequency. The tip of the last circle traces the waveform. Adjust harmonic type (all/odd) and scaling (1/n or 1/n²) to generate square, sawtooth, or triangle waves.",
  parameters: [
    { key: "harmonicType", label: "Harmonics (0=All, 1=Odd only)", min: 0, max: 1, step: 1, defaultValue: 1 },
    { key: "scalingType", label: "Scaling (0=1/n, 1=1/n²)", min: 0, max: 1, step: 1, defaultValue: 0 },
    { key: "numTerms", label: "Number of Terms", min: 1, max: 20, step: 1, defaultValue: 5 },
    { key: "speed", label: "Speed", min: 0.5, max: 3, step: 0.5, defaultValue: 1, unit: "×" },
  ],
  thumbnailColor: "#a855f7",
};

const FourierSeriesFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let harmonicType = 1; // 0=all, 1=odd
  let scalingType = 0;  // 0=1/n, 1=1/n²
  let numTerms = 5;
  let speed = 1;

  let wavePoints: number[] = [];
  const maxWavePoints = 500;

  function getHarmonicN(index: number): number {
    if (harmonicType === 0) return index + 1;
    return 2 * index + 1; // odd only
  }

  function getAmplitude(n: number): number {
    if (scalingType === 0) return 1 / n;
    return 1 / (n * n);
  }

  function drawEpicycles(cx: number, cy: number, baseRadius: number): { x: number; y: number } {
    let x = cx;
    let y = cy;

    for (let i = 0; i < numTerms; i++) {
      const n = getHarmonicN(i);
      const amp = getAmplitude(n);
      const r = amp * baseRadius;
      const angle = n * time * speed;

      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${(i * 50) % 360}, 60%, 55%, 0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Radius line
      const nx = x + r * Math.cos(angle);
      const ny = y + r * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = `hsla(${(i * 50) % 360}, 60%, 55%, 0.7)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${(i * 50) % 360}, 60%, 55%, 0.6)`;
      ctx.fill();

      x = nx;
      y = ny;
    }

    // Final tip
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    return { x, y };
  }

  function drawWaveform(startX: number, tipY: number) {
    wavePoints.unshift(tipY);
    if (wavePoints.length > maxWavePoints) wavePoints.pop();

    const waveStartX = startX + 20;
    const waveWidth = W - waveStartX - 20;

    // Connecting line from tip to wave
    ctx.beginPath();
    ctx.moveTo(startX, tipY);
    ctx.lineTo(waveStartX, tipY);
    ctx.strokeStyle = "rgba(239,68,68,0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Wave
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    for (let i = 0; i < wavePoints.length && i < waveWidth; i++) {
      const px = waveStartX + i;
      if (i === 0) ctx.moveTo(px, wavePoints[i]);
      else ctx.lineTo(px, wavePoints[i]);
    }
    ctx.stroke();

    // Zero line
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const centerY = H * 0.45;
    ctx.moveTo(waveStartX, centerY);
    ctx.lineTo(W - 20, centerY);
    ctx.stroke();
  }

  function drawInfo() {
    const ix = 10;
    const iy = H * 0.78;
    const iw = W - 20;
    const ih = H * 0.2;

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(ix, iy, iw, ih);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Fourier Series — Epicycle Visualization", ix + 12, iy + 20);

    ctx.fillStyle = "#475569";
    ctx.font = "12px sans-serif";
    let ty = iy + 40;
    ctx.fillText(`Harmonics: ${harmonicType === 0 ? "All (n=1,2,3...)" : "Odd only (n=1,3,5...)"}`, ix + 12, ty); ty += 18;
    ctx.fillText(`Scaling: ${scalingType === 0 ? "1/n (square/sawtooth)" : "1/n² (triangle)"}`, ix + 12, ty); ty += 18;
    ctx.fillText(`Terms: ${numTerms}`, ix + 12, ty);

    // Active terms
    ctx.textAlign = "right";
    ctx.font = "11px monospace";
    ctx.fillStyle = "#64748b";
    let formula = "f(t) = ";
    const terms: string[] = [];
    for (let i = 0; i < Math.min(numTerms, 5); i++) {
      const n = getHarmonicN(i);
      const a = getAmplitude(n);
      terms.push(`${a === 1 ? "" : a.toFixed(2) + "·"}sin(${n}t)`);
    }
    formula += terms.join(" + ");
    if (numTerms > 5) formula += " + ...";
    ctx.fillText(formula, ix + iw - 12, iy + 40);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
    wavePoints = [];
  }

  function update(dt: number, params: Record<string, number>) {
    harmonicType = Math.floor(params.harmonicType ?? 1);
    scalingType = Math.floor(params.scalingType ?? 0);
    numTerms = Math.floor(params.numTerms ?? 5);
    speed = params.speed ?? 1;
    time += dt;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#faf5ff");
    bg.addColorStop(1, "#f3e8ff");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Fourier Series — Rotating Epicycles", W / 2, 24);

    const epicycleCx = W * 0.22;
    const epicycleCy = H * 0.45;
    const baseRadius = Math.min(W * 0.15, H * 0.25);

    const tip = drawEpicycles(epicycleCx, epicycleCy, baseRadius);
    drawWaveform(epicycleCx + baseRadius * 1.2, tip.y);
    drawInfo();
  }

  function reset() {
    time = 0;
    wavePoints = [];
  }

  function destroy() {}

  function getStateDescription(): string {
    const typeStr = harmonicType === 0 ? "all harmonics" : "odd harmonics only";
    const scaleStr = scalingType === 0 ? "1/n" : "1/n²";
    const waveType = harmonicType === 1 ? (scalingType === 0 ? "square wave" : "triangle wave") : (scalingType === 0 ? "sawtooth wave" : "smooth approximation");
    return `Fourier Series with ${numTerms} terms using ${typeStr} and ${scaleStr} scaling. This produces a ${waveType} approximation. Each rotating circle (epicycle) represents one harmonic — its radius equals the coefficient and rotation speed equals the harmonic frequency.`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FourierSeriesFactory;
