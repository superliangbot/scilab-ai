import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "filedrop-cmy",
  title: "CMY Color Separation",
  category: "electricity",
  description:
    "Explore CMY subtractive color model — see how cyan, magenta, and yellow combine to make colors.",
  longDescription:
    "The CMY (Cyan, Magenta, Yellow) model is a subtractive color system used in printing. Unlike RGB which adds light, CMY pigments absorb (subtract) wavelengths. Cyan absorbs red, magenta absorbs green, and yellow absorbs blue. This simulation lets you adjust CMY values to mix colors and see the resulting color, demonstrating how printers create the full color spectrum from just three inks.",
  parameters: [
    { key: "cyan", label: "Cyan", min: 0, max: 100, step: 1, defaultValue: 0, unit: "%" },
    { key: "magenta", label: "Magenta", min: 0, max: 100, step: 1, defaultValue: 0, unit: "%" },
    { key: "yellow", label: "Yellow", min: 0, max: 100, step: 1, defaultValue: 0, unit: "%" },
    { key: "showChannels", label: "Show Channels (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
  ],
  thumbnailColor: "#06b6d4",
};

const FiledropCmyFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let cyan = 0;
  let magenta = 0;
  let yellow = 0;
  let showChannels = 1;

  function cmyToRgb(c: number, m: number, y: number): [number, number, number] {
    return [
      Math.round(255 * (1 - c / 100)),
      Math.round(255 * (1 - m / 100)),
      Math.round(255 * (1 - y / 100)),
    ];
  }

  function drawColorSwatch(x: number, y: number, w: number, h: number, r: number, g: number, b: number, label: string) {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    const radius = 12;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = r + g + b < 380 ? "#fff" : "#000";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  function drawVennDiagram() {
    const cx = W / 2;
    const cy = H * 0.42;
    const r = Math.min(W, H) * 0.16;
    const offset = r * 0.55;

    // Three overlapping circles
    const circles = [
      { x: cx, y: cy - offset * 0.6, color: "cyan", label: "C" },
      { x: cx - offset, y: cy + offset * 0.4, color: "magenta", label: "M" },
      { x: cx + offset, y: cy + offset * 0.4, color: "yellow", label: "Y" },
    ];

    ctx.globalCompositeOperation = "multiply";
    for (const c of circles) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fillStyle = c.color;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // Labels
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#333";
    ctx.fillText("C", cx, cy - offset * 0.6 - r - 8);
    ctx.fillText("M", cx - offset - r - 8, cy + offset * 0.4);
    ctx.fillText("Y", cx + offset + r + 8, cy + offset * 0.4);

    // Overlap labels
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("Blue", cx - offset * 0.5, cy - offset * 0.15);
    ctx.fillText("Green", cx + offset * 0.5, cy - offset * 0.15);
    ctx.fillText("Red", cx, cy + offset * 0.8);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("Black", cx, cy + offset * 0.15);
  }

  function drawBarGraph() {
    const bx = 40;
    const by = H * 0.78;
    const bw = W - 80;
    const bh = 30;
    const gap = 10;

    const bars = [
      { value: cyan, color: "#00bcd4", label: `Cyan: ${cyan}%` },
      { value: magenta, color: "#e91e63", label: `Magenta: ${magenta}%` },
      { value: yellow, color: "#ffeb3b", label: `Yellow: ${yellow}%` },
    ];

    for (let i = 0; i < bars.length; i++) {
      const y = by + i * (bh + gap);

      // Background
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(bx, y, bw, bh);

      // Filled
      ctx.fillStyle = bars[i].color;
      ctx.fillRect(bx, y, bw * (bars[i].value / 100), bh);

      // Border
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, y, bw, bh);

      // Label
      ctx.fillStyle = "#334155";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(bars[i].label, bx + 8, y + bh / 2);
    }
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
    showChannels = params.showChannels ?? 1;
    time += dt;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CMY Subtractive Color Model", W / 2, 30);

    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Adjust C, M, Y values to mix pigment colors", W / 2, 50);

    // Draw Venn diagram
    drawVennDiagram();

    // Mixed result color
    const [r, g, b] = cmyToRgb(cyan, magenta, yellow);
    const swatchSize = Math.min(W, H) * 0.14;

    // Result swatch
    const resultX = W / 2 - swatchSize * 1.5;
    const resultY = H * 0.62;
    drawColorSwatch(resultX, resultY, swatchSize * 3, swatchSize * 0.8, r, g, b, `RGB(${r}, ${g}, ${b})`);

    // Individual channel swatches
    if (showChannels) {
      const sw = (W - 80) / 3 - 10;
      const sy = resultY + swatchSize * 0.8 + 15;
      const [cr, cg, cb] = cmyToRgb(cyan, 0, 0);
      const [mr, mg, mb] = cmyToRgb(0, magenta, 0);
      const [yr, yg, yb] = cmyToRgb(0, 0, yellow);
      drawColorSwatch(30, sy, sw, 40, cr, cg, cb, "Cyan channel");
      drawColorSwatch(40 + sw, sy, sw, 40, mr, mg, mb, "Magenta channel");
      drawColorSwatch(50 + 2 * sw, sy, sw, 40, yr, yg, yb, "Yellow channel");
    }

    drawBarGraph();

    // Formula
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`R = 255×(1 - C/100) = ${r}   G = 255×(1 - M/100) = ${g}   B = 255×(1 - Y/100) = ${b}`, W / 2, H - 12);
  }

  function reset() {
    time = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    const [r, g, b] = cmyToRgb(cyan, magenta, yellow);
    return `CMY Color Separation: Cyan=${cyan}%, Magenta=${magenta}%, Yellow=${yellow}%. The mixed result is RGB(${r}, ${g}, ${b}). In subtractive color mixing, pigments absorb light: cyan absorbs red, magenta absorbs green, yellow absorbs blue. ${cyan + magenta + yellow > 200 ? "High ink coverage — approaching dark/black." : "Moderate ink levels."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FiledropCmyFactory;
