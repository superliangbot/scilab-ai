import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "fnd",
  title: "7-Segment Display (FND)",
  category: "physics",
  description:
    "Interactive 7-segment LED display — toggle segments to form digits and learn display electronics.",
  longDescription:
    "A seven-segment display (FND — Flexible Numeric Display) uses 7 LED segments plus a decimal point to show digits 0-9 and some letters. Each segment is labeled a-g. By lighting specific combinations, any numeral can be displayed. This simulation lets you toggle individual segments or input numbers to see the corresponding segment pattern, essential knowledge for digital electronics.",
  parameters: [
    { key: "digit", label: "Digit (0-9)", min: 0, max: 9, step: 1, defaultValue: 0 },
    { key: "brightness", label: "Brightness", min: 0.3, max: 1, step: 0.1, defaultValue: 0.8 },
    { key: "displayType", label: "Type (0=Common Cathode, 1=Common Anode)", min: 0, max: 1, step: 1, defaultValue: 0 },
    { key: "showLabels", label: "Show Segment Labels (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
  ],
  thumbnailColor: "#991b1b",
};

// Segment patterns for digits 0-9 (a,b,c,d,e,f,g)
const DIGIT_PATTERNS: boolean[][] = [
  [true, true, true, true, true, true, false],    // 0
  [false, true, true, false, false, false, false], // 1
  [true, true, false, true, true, false, true],    // 2
  [true, true, true, true, false, false, true],    // 3
  [false, true, true, false, false, true, true],   // 4
  [true, false, true, true, false, true, true],    // 5
  [true, false, true, true, true, true, true],     // 6
  [true, true, true, false, false, false, false],  // 7
  [true, true, true, true, true, true, true],      // 8
  [true, true, true, true, false, true, true],     // 9
];

const SEGMENT_NAMES = ["a", "b", "c", "d", "e", "f", "g"];

const FndFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let digit = 0;
  let brightness = 0.8;
  let displayType = 0;
  let showLabels = 1;
  let segments: boolean[] = [true, true, true, true, true, true, false];

  function getSegmentPath(seg: number, cx: number, cy: number, sw: number, sh: number): { points: number[][]; labelPos: number[] } {
    const thick = sw * 0.12;
    const gap = 2;
    const halfH = sh / 2;

    // Each segment is a hexagonal shape
    const segDefs: { points: number[][]; labelPos: number[] }[] = [
      // a - top horizontal
      { points: [[cx - sw / 2 + gap + thick, cy - halfH], [cx + sw / 2 - gap - thick, cy - halfH], [cx + sw / 2 - gap, cy - halfH + thick], [cx - sw / 2 + gap, cy - halfH + thick]], labelPos: [cx, cy - halfH - 10] },
      // b - top right vertical
      { points: [[cx + sw / 2 - thick, cy - halfH + gap], [cx + sw / 2, cy - halfH + gap + thick], [cx + sw / 2, cy - gap - thick], [cx + sw / 2 - thick, cy - gap]], labelPos: [cx + sw / 2 + 14, cy - halfH / 2] },
      // c - bottom right vertical
      { points: [[cx + sw / 2 - thick, cy + gap], [cx + sw / 2, cy + gap + thick], [cx + sw / 2, cy + halfH - gap - thick], [cx + sw / 2 - thick, cy + halfH - gap]], labelPos: [cx + sw / 2 + 14, cy + halfH / 2] },
      // d - bottom horizontal
      { points: [[cx - sw / 2 + gap + thick, cy + halfH], [cx + sw / 2 - gap - thick, cy + halfH], [cx + sw / 2 - gap, cy + halfH - thick], [cx - sw / 2 + gap, cy + halfH - thick]], labelPos: [cx, cy + halfH + 16] },
      // e - bottom left vertical
      { points: [[cx - sw / 2, cy + gap + thick], [cx - sw / 2 + thick, cy + gap], [cx - sw / 2 + thick, cy + halfH - gap], [cx - sw / 2, cy + halfH - gap - thick]], labelPos: [cx - sw / 2 - 14, cy + halfH / 2] },
      // f - top left vertical
      { points: [[cx - sw / 2, cy - halfH + gap + thick], [cx - sw / 2 + thick, cy - halfH + gap], [cx - sw / 2 + thick, cy - gap], [cx - sw / 2, cy - gap - thick]], labelPos: [cx - sw / 2 - 14, cy - halfH / 2] },
      // g - middle horizontal
      { points: [[cx - sw / 2 + gap + thick, cy - thick / 2], [cx + sw / 2 - gap - thick, cy - thick / 2], [cx + sw / 2 - gap, cy + thick / 2], [cx - sw / 2 + gap, cy + thick / 2]], labelPos: [cx - sw / 2 - 14, cy] },
    ];

    return segDefs[seg];
  }

  function drawSegment(seg: number, isOn: boolean, cx: number, cy: number, sw: number, sh: number) {
    const { points, labelPos } = getSegmentPath(seg, cx, cy, sw, sh);

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();

    if (isOn) {
      ctx.fillStyle = `rgba(255,30,30,${brightness})`;
      ctx.fill();
      // Glow
      ctx.shadowColor = `rgba(255,30,30,${brightness * 0.6})`;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "rgba(60,20,20,0.3)";
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    if (showLabels) {
      ctx.fillStyle = isOn ? "#fca5a5" : "#64748b";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(SEGMENT_NAMES[seg], labelPos[0], labelPos[1]);
    }
  }

  function drawDecimalPoint(cx: number, cy: number, sh: number, isOn: boolean) {
    const dx = cx + 50;
    const dy = cy + sh / 2;
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, Math.PI * 2);
    if (isOn) {
      ctx.fillStyle = `rgba(255,30,30,${brightness})`;
      ctx.shadowColor = `rgba(255,30,30,${brightness * 0.6})`;
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = "rgba(60,20,20,0.3)";
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    if (showLabels) {
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("dp", dx, dy + 18);
    }
  }

  function drawPinDiagram(x: number, y: number) {
    const pw = 180;
    const ph = 80;

    ctx.fillStyle = "rgba(15,23,42,0.8)";
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, pw, ph);

    // IC body
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(x + 20, y + 20, pw - 40, ph - 40);
    ctx.strokeStyle = "#64748b";
    ctx.strokeRect(x + 20, y + 20, pw - 40, ph - 40);

    // Pins
    const topPins = ["1(e)", "2(d)", "3(CC)", "4(c)", "5(dp)"];
    const botPins = ["10(a)", "9(b)", "8(CC)", "7(f)", "6(g)"];
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";

    for (let i = 0; i < 5; i++) {
      const px = x + 30 + i * ((pw - 60) / 4);
      // Top pins
      ctx.fillRect(px - 1, y + 10, 2, 10);
      ctx.fillText(topPins[i], px, y + 8);
      // Bottom pins
      ctx.fillRect(px - 1, y + ph - 20, 2, 10);
      ctx.fillText(botPins[i], px, y + ph - 4);
    }

    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(displayType === 0 ? "Common Cathode" : "Common Anode", x + pw / 2, y + ph / 2 + 3);
  }

  function drawTruthTable(x: number, y: number) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Digit  a b c d e f g", x + 90, y);

    ctx.font = "10px monospace";
    for (let d = 0; d <= 9; d++) {
      const py = y + 14 + d * 14;
      const isActive = d === digit;
      ctx.fillStyle = isActive ? "#fbbf24" : "#64748b";
      const pattern = DIGIT_PATTERNS[d].map(v => v ? "1" : "0").join(" ");
      ctx.fillText(`  ${d}    ${pattern}`, x + 90, py);
    }
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    digit = Math.floor(params.digit ?? 0);
    digit = Math.max(0, Math.min(9, digit));
    brightness = params.brightness ?? 0.8;
    displayType = Math.floor(params.displayType ?? 0);
    showLabels = params.showLabels ?? 1;
    time += dt;

    segments = DIGIT_PATTERNS[digit].slice();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("7-Segment Display (FND)", W / 2, 28);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Toggle digit to see segment patterns", W / 2, 46);

    // Main display
    const dcx = W * 0.35;
    const dcy = H * 0.42;
    const dsw = Math.min(W * 0.25, 120);
    const dsh = dsw * 1.6;

    // Display housing
    ctx.fillStyle = "#1a0505";
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    const hPad = 25;
    ctx.fillRect(dcx - dsw / 2 - hPad, dcy - dsh / 2 - hPad, dsw + 2 * hPad + 30, dsh + 2 * hPad);
    ctx.strokeRect(dcx - dsw / 2 - hPad, dcy - dsh / 2 - hPad, dsw + 2 * hPad + 30, dsh + 2 * hPad);

    for (let i = 0; i < 7; i++) {
      drawSegment(i, segments[i], dcx, dcy, dsw, dsh);
    }
    drawDecimalPoint(dcx, dcy, dsh, false);

    // Current digit display
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${digit}`, dcx, dcy + dsh / 2 + 50);

    // Pin diagram
    drawPinDiagram(W * 0.65, H * 0.2);

    // Truth table
    drawTruthTable(W * 0.6, H * 0.55);

    // Info
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Used in: digital clocks, calculators, elevators, vending machines", W / 2, H - 12);
  }

  function reset() {
    time = 0;
    segments = DIGIT_PATTERNS[0].slice();
  }

  function destroy() {}

  function getStateDescription(): string {
    const activeSegs = segments.map((s, i) => s ? SEGMENT_NAMES[i] : null).filter(Boolean);
    return `7-Segment Display showing digit ${digit}. Active segments: ${activeSegs.join(", ")}. Display type: ${displayType === 0 ? "Common Cathode" : "Common Anode"}. Brightness: ${(brightness * 100).toFixed(0)}%. A 7-segment display uses LEDs labeled a-g to show digits 0-9 by lighting specific segment combinations.`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FndFactory;
