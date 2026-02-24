import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const CRTTVFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("crt-tv") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let scanSpeed = 3;
  let brightness = 0.7;
  let showScanLine = 1;
  let interlaced = 1;

  // Raster state
  const TOTAL_LINES = 480;
  const LINES_PER_FIELD = 240;
  let currentLine = 0;
  let currentX = 0; // 0..1 fraction across the line
  let currentField = 0; // 0 = odd lines, 1 = even lines
  let frameCount = 0;

  // Rendered scanline buffer (which lines have been drawn this frame)
  let renderedLines: Set<number> = new Set();

  // Pre-generated "image" data: simple color bars pattern
  let imagePattern: Array<{ r: number; g: number; b: number }> = [];

  // TV geometry
  const TV_LEFT = 0.04;
  const TV_RIGHT = 0.64;
  const TV_TOP = 0.06;
  const TV_BOT = 0.78;
  const MAGNIFY_X = 0.68;
  const MAGNIFY_Y = 0.06;
  const MAGNIFY_W = 0.30;
  const MAGNIFY_H = 0.40;

  function generateTestPattern(): void {
    // SMPTE-like color bars
    imagePattern = [];
    const barColors = [
      { r: 255, g: 255, b: 255 }, // White
      { r: 255, g: 255, b: 0 },   // Yellow
      { r: 0,   g: 255, b: 255 }, // Cyan
      { r: 0,   g: 255, b: 0 },   // Green
      { r: 255, g: 0,   b: 255 }, // Magenta
      { r: 255, g: 0,   b: 0 },   // Red
      { r: 0,   g: 0,   b: 255 }, // Blue
    ];
    for (let line = 0; line < TOTAL_LINES; line++) {
      for (let x = 0; x < 7; x++) {
        imagePattern.push(barColors[x]);
      }
    }
  }

  function getPixelColor(line: number, xFrac: number): { r: number; g: number; b: number } {
    const barIndex = Math.min(6, Math.floor(xFrac * 7));
    const idx = line * 7 + barIndex;
    if (idx >= 0 && idx < imagePattern.length) {
      return imagePattern[idx];
    }
    return { r: 0, g: 0, b: 0 };
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTVCasing(): void {
    const lx = W * TV_LEFT - 12;
    const ty = H * TV_TOP - 12;
    const rx = W * TV_RIGHT + 12;
    const by = H * TV_BOT + 12;

    // Outer casing
    ctx.fillStyle = "rgba(50, 45, 40, 0.9)";
    ctx.beginPath();
    ctx.roundRect(lx - 8, ty - 8, rx - lx + 16, by - ty + 16, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 75, 70, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Screen bezel
    ctx.fillStyle = "rgba(20, 20, 25, 0.95)";
    ctx.beginPath();
    ctx.roundRect(lx, ty, rx - lx, by - ty, 6);
    ctx.fill();
  }

  function drawScreen(): void {
    const lx = W * TV_LEFT;
    const ty = H * TV_TOP;
    const sx = W * TV_RIGHT - lx;
    const sy = H * TV_BOT - ty;
    const lineH = sy / TOTAL_LINES;

    // Screen base (dark phosphor)
    ctx.fillStyle = "rgba(5, 10, 5, 1)";
    ctx.fillRect(lx, ty, sx, sy);

    // Draw completed scanlines for this frame
    for (const line of renderedLines) {
      const ly = ty + line * lineH;
      const actualLine = line;

      // Draw the line with color from test pattern
      for (let px = 0; px < Math.ceil(sx); px += 2) {
        const xFrac = px / sx;
        const col = getPixelColor(actualLine, xFrac);
        const b = brightness;
        ctx.fillStyle = `rgba(${Math.floor(col.r * b)}, ${Math.floor(col.g * b)}, ${Math.floor(col.b * b)}, 0.85)`;
        ctx.fillRect(lx + px, ly, 2, Math.max(1, lineH - 0.3));
      }
    }

    // Draw active scanline with bright glow
    if (showScanLine) {
      const activeLine = interlaced
        ? currentField * 2 + Math.floor(currentLine) * 2 + currentField
        : Math.floor(currentLine);
      if (activeLine >= 0 && activeLine < TOTAL_LINES) {
        const ly = ty + activeLine * lineH;
        const beamX = lx + currentX * sx;

        // Bright scan beam
        const beamGlow = ctx.createRadialGradient(beamX, ly + lineH / 2, 0, beamX, ly + lineH / 2, 20);
        beamGlow.addColorStop(0, "rgba(255, 255, 255, 0.9)");
        beamGlow.addColorStop(0.3, "rgba(200, 255, 200, 0.3)");
        beamGlow.addColorStop(1, "rgba(100, 200, 100, 0)");
        ctx.fillStyle = beamGlow;
        ctx.beginPath();
        ctx.arc(beamX, ly + lineH / 2, 20, 0, Math.PI * 2);
        ctx.fill();

        // Scanline highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.fillRect(lx, ly, beamX - lx, lineH);
      }
    }

    // Scanline visibility effect (subtle dark gaps between lines)
    if (lineH > 1.5) {
      for (let line = 0; line < TOTAL_LINES; line += 2) {
        const ly = ty + line * lineH + lineH - 0.5;
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        ctx.fillRect(lx, ly, sx, 0.5);
      }
    }

    // Screen curvature overlay (subtle)
    const curveGrad = ctx.createRadialGradient(
      lx + sx / 2, ty + sy / 2, Math.min(sx, sy) * 0.3,
      lx + sx / 2, ty + sy / 2, Math.max(sx, sy) * 0.7
    );
    curveGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    curveGrad.addColorStop(1, "rgba(0, 0, 0, 0.25)");
    ctx.fillStyle = curveGrad;
    ctx.fillRect(lx, ty, sx, sy);
  }

  function drawMagnifiedView(): void {
    const mx = W * MAGNIFY_X;
    const my = H * MAGNIFY_Y;
    const mw = W * MAGNIFY_W;
    const mh = H * MAGNIFY_H;

    // Background
    ctx.fillStyle = "rgba(15, 20, 30, 0.9)";
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 140, 180, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MAGNIFIED: RGB PHOSPHOR DOTS", mx + mw / 2, my + 14);

    // Draw magnified phosphor dot triads
    const dotSize = 6;
    const triadW = dotSize * 3.5;
    const triadH = dotSize * 3;
    const startX = mx + 12;
    const startY = my + 28;
    const cols = Math.floor((mw - 24) / triadW);
    const rows = Math.floor((mh - 50) / triadH);

    for (let row = 0; row < rows; row++) {
      // Get color from test pattern for this row's position
      const lineFrac = row / rows;
      const lineIdx = Math.floor(lineFrac * TOTAL_LINES);

      for (let col = 0; col < cols; col++) {
        const xFrac = col / cols;
        const color = getPixelColor(lineIdx, xFrac);
        const b = brightness;

        const tx = startX + col * triadW;
        const ty2 = startY + row * triadH;

        // Red sub-pixel
        ctx.fillStyle = `rgba(${Math.floor(color.r * b)}, 0, 0, 0.9)`;
        ctx.beginPath();
        ctx.arc(tx, ty2 + dotSize / 2, dotSize / 2 - 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Green sub-pixel
        ctx.fillStyle = `rgba(0, ${Math.floor(color.g * b)}, 0, 0.9)`;
        ctx.beginPath();
        ctx.arc(tx + dotSize * 1.1, ty2 + dotSize / 2, dotSize / 2 - 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Blue sub-pixel
        ctx.fillStyle = `rgba(0, 0, ${Math.floor(color.b * b)}, 0.9)`;
        ctx.beginPath();
        ctx.arc(tx + dotSize * 2.2, ty2 + dotSize / 2, dotSize / 2 - 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Shadow mask grid
        ctx.strokeStyle = "rgba(30, 30, 30, 0.5)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tx - dotSize / 2 - 1, ty2 - 1, triadW, triadH);
      }
    }

    // RGB legend
    const legendY = my + mh - 14;
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("R", mx + 12, legendY);
    ctx.fillStyle = "#22c55e";
    ctx.fillText("G", mx + 28, legendY);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("B", mx + 44, legendY);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("= one pixel triad", mx + 56, legendY);
  }

  function drawDiagram(): void {
    // Draw simplified CRT TV cross-section diagram at bottom-right
    const dx = W * MAGNIFY_X;
    const dy = H * 0.50;
    const dw = W * MAGNIFY_W;
    const dh = H * 0.28;

    ctx.fillStyle = "rgba(15, 20, 30, 0.9)";
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 140, 180, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CRT TV CROSS-SECTION", dx + dw / 2, dy + 14);

    const cx = dx + 20;
    const cy2 = dy + dh / 2 + 5;
    const tubeW = dw - 40;

    // Electron gun (3 guns for RGB)
    const gunColors = ["#ef4444", "#22c55e", "#3b82f6"];
    const gunLabels = ["R", "G", "B"];
    for (let i = 0; i < 3; i++) {
      const gy = cy2 - 12 + i * 12;
      ctx.fillStyle = gunColors[i];
      ctx.fillRect(cx, gy - 3, 12, 6);
      ctx.font = "bold 7px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(gunLabels[i], cx + 6, gy - 5);
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Guns", cx + 6, cy2 + 22);

    // Deflection yoke
    const yokeX = cx + tubeW * 0.3;
    ctx.strokeStyle = "rgba(255, 200, 50, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(yokeX, cy2, 20, -0.5, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(yokeX, cy2, 20, Math.PI - 0.5, Math.PI + 0.5);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 200, 50, 0.6)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillText("Yoke", yokeX, cy2 + 28);

    // Shadow mask
    const maskX = cx + tubeW * 0.7;
    ctx.strokeStyle = "rgba(150, 150, 150, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(maskX, cy2 - 25);
    ctx.lineTo(maskX, cy2 + 25);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(150, 150, 150, 0.6)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillText("Mask", maskX, cy2 + 35);

    // Screen
    const scrX = cx + tubeW * 0.9;
    ctx.fillStyle = "rgba(80, 180, 80, 0.4)";
    ctx.fillRect(scrX, cy2 - 25, 5, 50);
    ctx.fillStyle = "rgba(100, 255, 100, 0.6)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillText("Screen", scrX + 2, cy2 + 35);

    // Beam paths
    ctx.strokeStyle = "rgba(100, 200, 255, 0.3)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const gy = cy2 - 12 + i * 12;
      ctx.beginPath();
      ctx.moveTo(cx + 12, gy);
      ctx.lineTo(yokeX - 10, cy2 + (i - 1) * 4);
      ctx.lineTo(scrX, cy2 + (i - 1) * 6);
      ctx.stroke();
    }
  }

  function drawInfoPanel(): void {
    const panelH = 52;
    const panelY = H - panelH - 6;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(8, panelY, W - 16, panelH, 6);
    ctx.fill();

    const fs = Math.max(10, Math.min(12, W / 60));
    ctx.font = `${fs}px 'SF Mono', 'Fira Code', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const y1 = panelY + 14;
    const y2 = panelY + 30;
    const y3 = panelY + 44;

    const displayLine = interlaced
      ? currentField * 2 + Math.floor(currentLine) * 2 + currentField
      : Math.floor(currentLine);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Line: ${displayLine}/${TOTAL_LINES}`, 16, y1);
    ctx.fillText(`Field: ${currentField + 1}/2 (${currentField === 0 ? "odd" : "even"})`, 16 + W * 0.2, y1);
    ctx.fillText(`Frame: ${frameCount}`, 16 + W * 0.45, y1);

    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.fillText(`Scan: ${(currentX * 100).toFixed(0)}% across`, 16, y2);
    ctx.fillText(`Mode: ${interlaced ? "Interlaced (2:1)" : "Progressive"}`, 16 + W * 0.2, y2);
    ctx.fillText(`Brightness: ${(brightness * 100).toFixed(0)}%`, 16 + W * 0.45, y2);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    const scanInfo = interlaced
      ? "Interlaced: 262.5 lines/field, 2 fields/frame = 525 lines (NTSC standard)"
      : "Progressive: all 480 lines drawn sequentially per frame";
    ctx.fillText(scanInfo, 16, y3);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    currentLine = 0;
    currentX = 0;
    currentField = 0;
    frameCount = 0;
    renderedLines = new Set();
    generateTestPattern();
  }

  function update(dt: number, params: Record<string, number>): void {
    scanSpeed = params.scanSpeed ?? 3;
    brightness = params.brightness ?? 0.7;
    showScanLine = Math.round(params.showScanLine ?? 1);
    interlaced = Math.round(params.interlaced ?? 1);

    time += dt;

    // Advance scan position
    // Speed: lines per second. At scanSpeed=5, scan ~120 lines/sec
    const linesPerSecond = scanSpeed * 25;
    const lineDt = linesPerSecond * dt;

    currentX += lineDt * 3; // X sweeps 3x faster than line advance

    while (currentX >= 1) {
      currentX -= 1;

      // Mark the current line as rendered
      const actualLine = interlaced
        ? Math.floor(currentLine) * 2 + currentField
        : Math.floor(currentLine);
      if (actualLine >= 0 && actualLine < TOTAL_LINES) {
        renderedLines.add(actualLine);
      }

      currentLine += 1;

      const maxLines = interlaced ? LINES_PER_FIELD : TOTAL_LINES;
      if (currentLine >= maxLines) {
        currentLine = 0;

        if (interlaced) {
          currentField = 1 - currentField;
          if (currentField === 0) {
            frameCount++;
            // Keep rendered lines for visual persistence
            // but clear after 2 full frames to show refresh
            if (frameCount % 3 === 0) {
              renderedLines = new Set();
            }
          }
        } else {
          frameCount++;
          if (frameCount % 3 === 0) {
            renderedLines = new Set();
          }
        }
      }
    }
  }

  function render(): void {
    if (!ctx || W === 0 || H === 0) return;

    drawBackground();
    drawTVCasing();
    drawScreen();
    drawMagnifiedView();
    drawDiagram();
    drawInfoPanel();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("CRT Television - Raster Scan", 12, H * TV_TOP - 28);
  }

  function reset(): void {
    time = 0;
    currentLine = 0;
    currentX = 0;
    currentField = 0;
    frameCount = 0;
    renderedLines = new Set();
  }

  function destroy(): void {
    imagePattern = [];
    renderedLines = new Set();
  }

  function getStateDescription(): string {
    const displayLine = interlaced
      ? currentField * 2 + Math.floor(currentLine) * 2 + currentField
      : Math.floor(currentLine);
    return (
      `CRT Television Simulation: Displaying SMPTE color bars test pattern. ` +
      `Scan mode: ${interlaced ? "Interlaced (2:1)" : "Progressive"}. ` +
      `Currently scanning line ${displayLine} of ${TOTAL_LINES}, ` +
      `field ${currentField + 1}/2 (${currentField === 0 ? "odd" : "even"} field). ` +
      `Frame count: ${frameCount}. Brightness: ${(brightness * 100).toFixed(0)}%. ` +
      `A CRT TV creates images by scanning 3 electron beams (RGB) across a phosphor screen. ` +
      `The beam sweeps left-to-right (horizontal scan) and top-to-bottom (vertical scan). ` +
      `In interlaced mode, odd lines are drawn first (field 1), then even lines (field 2), ` +
      `giving 30 full frames per second from 60 half-frame fields (NTSC). ` +
      `Each pixel is made of red, green, and blue phosphor dots activated by separate electron beams ` +
      `through a shadow mask that ensures each beam hits only its corresponding color phosphor.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default CRTTVFactory;
