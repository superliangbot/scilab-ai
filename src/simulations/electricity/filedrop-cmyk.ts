import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "filedrop-cmyk",
  title: "CMYK Color Separation",
  category: "electricity",
  description:
    "Explore the CMYK printing model — see how cyan, magenta, yellow, and key (black) create printed colors.",
  longDescription:
    "CMYK extends the CMY model by adding a Key (black) channel. Professional printers use CMYK because mixing C+M+Y theoretically produces black but in practice yields a muddy brown. Adding dedicated black ink produces richer shadows, crisper text, and saves colored ink. This simulation lets you adjust all four channels and observe color mixing with real-time RGB conversion.",
  parameters: [
    { key: "cyan", label: "Cyan", min: 0, max: 100, step: 1, defaultValue: 0, unit: "%" },
    { key: "magenta", label: "Magenta", min: 0, max: 100, step: 1, defaultValue: 0, unit: "%" },
    { key: "yellow", label: "Yellow", min: 0, max: 100, step: 1, defaultValue: 0, unit: "%" },
    { key: "black", label: "Key (Black)", min: 0, max: 100, step: 1, defaultValue: 0, unit: "%" },
  ],
  thumbnailColor: "#1e293b",
};

const FiledropCmykFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let cyan = 0;
  let magenta = 0;
  let yellow = 0;
  let black = 0;

  function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
    const cf = c / 100, mf = m / 100, yf = y / 100, kf = k / 100;
    return [
      Math.round(255 * (1 - cf) * (1 - kf)),
      Math.round(255 * (1 - mf) * (1 - kf)),
      Math.round(255 * (1 - yf) * (1 - kf)),
    ];
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawInkDrop(x: number, y: number, size: number, color: string, label: string, value: number) {
    // Drop shape
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * 0.8, y - size * 0.2, x + size * 0.6, y + size * 0.3);
    ctx.arc(x, y + size * 0.3, size * 0.6, 0, Math.PI, false);
    ctx.quadraticCurveTo(x - size * 0.8, y - size * 0.2, x, y - size);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Value
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${value}%`, x, y + size * 0.2);

    // Label
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "13px sans-serif";
    ctx.fillText(label, x, y + size + 20);
  }

  function drawColorPlate(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    roundRect(x, y, w, h, 16);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shine effect
    const shine = ctx.createLinearGradient(x, y, x, y + h * 0.3);
    shine.addColorStop(0, "rgba(255,255,255,0.15)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    roundRect(x, y, w, h * 0.4, 16);
    ctx.fillStyle = shine;
    ctx.fill();
  }

  function drawSeparationPreview() {
    const baseY = H * 0.56;
    const pw = (W - 100) / 4;
    const ph = 60;
    const gap = 10;
    const startX = 40;

    const plates: { c: number; m: number; y: number; k: number; label: string }[] = [
      { c: cyan, m: 0, y: 0, k: 0, label: "C plate" },
      { c: 0, m: magenta, y: 0, k: 0, label: "M plate" },
      { c: 0, m: 0, y: yellow, k: 0, label: "Y plate" },
      { c: 0, m: 0, y: 0, k: black, label: "K plate" },
    ];

    for (let i = 0; i < plates.length; i++) {
      const p = plates[i];
      const [r, g, b] = cmykToRgb(p.c, p.m, p.y, p.k);
      const x = startX + i * (pw + gap);
      drawColorPlate(x, baseY, pw, ph, r, g, b);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.label, x + pw / 2, baseY + ph + 16);
    }

    // Plus signs
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 20px sans-serif";
    for (let i = 0; i < 3; i++) {
      const x = startX + (i + 1) * (pw + gap) - gap / 2;
      ctx.fillText("+", x, baseY + ph / 2);
    }

    // Arrow to result
    const arrowY = baseY + ph + 35;
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2, arrowY);
    ctx.lineTo(W / 2, arrowY + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 6, arrowY + 14);
    ctx.lineTo(W / 2, arrowY + 22);
    ctx.lineTo(W / 2 + 6, arrowY + 14);
    ctx.fillStyle = "#64748b";
    ctx.fill();
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    cyan = params.cyan ?? 0;
    magenta = params.magenta ?? 0;
    yellow = params.yellow ?? 0;
    black = params.black ?? 0;
    time += dt;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CMYK Color Separation Model", W / 2, 30);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Adjust Cyan, Magenta, Yellow, and Key (Black) channels", W / 2, 50);

    // Ink drops
    const dropSize = 30;
    const dropY = H * 0.16;
    const spacing = W / 5;
    drawInkDrop(spacing, dropY, dropSize, "#00bcd4", "Cyan", cyan);
    drawInkDrop(spacing * 2, dropY, dropSize, "#e91e63", "Magenta", magenta);
    drawInkDrop(spacing * 3, dropY, dropSize, "#fdd835", "Yellow", yellow);
    drawInkDrop(spacing * 4, dropY, dropSize, "#212121", "Key (Black)", black);

    // Main result
    const [r, g, b] = cmykToRgb(cyan, magenta, yellow, black);
    const resultW = Math.min(W * 0.5, 250);
    const resultH = 70;
    const resultX = W / 2 - resultW / 2;
    const resultY = H * 0.36;
    drawColorPlate(resultX, resultY, resultW, resultH, r, g, b);

    ctx.fillStyle = r + g + b < 380 ? "#fff" : "#000";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Mixed Result", W / 2, resultY + 25);
    ctx.font = "13px monospace";
    ctx.fillText(`RGB(${r}, ${g}, ${b})`, W / 2, resultY + 48);

    // Separation preview
    drawSeparationPreview();

    // Formula at bottom
    const [rNoK, gNoK, bNoK] = cmykToRgb(cyan, magenta, yellow, 0);
    const fy = H - 40;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`Without K: RGB(${rNoK},${gNoK},${bNoK})  |  With K: RGB(${r},${g},${b})`, W / 2, fy);
    ctx.fillText("R = 255 × (1-C) × (1-K)    G = 255 × (1-M) × (1-K)    B = 255 × (1-Y) × (1-K)", W / 2, fy + 18);
  }

  function reset() {
    time = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    const [r, g, b] = cmykToRgb(cyan, magenta, yellow, black);
    return `CMYK Color Separation: C=${cyan}%, M=${magenta}%, Y=${yellow}%, K=${black}%. Result: RGB(${r},${g},${b}). The Key (black) channel at ${black}% ${black > 50 ? "significantly darkens the output" : "provides subtle depth"}. CMYK is used in printing because mixing CMY alone cannot produce true black.`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FiledropCmykFactory;
