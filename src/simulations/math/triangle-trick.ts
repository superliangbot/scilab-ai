import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TriangleTrickFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("triangle-trick") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let arrangement = 0; // 0 = first, 1 = second
  let animProgress = 0;
  let showGrid = 1;
  let animSpeed = 1;

  // The trick: a 13x5 "triangle" made of 4 pieces
  // Pieces: red right-triangle (slope 2/5), blue right-triangle (slope 3/8),
  // green L-shape, yellow L-shape
  // The slopes are DIFFERENT (2/5 ≠ 3/8), so the "hypotenuse" isn't straight

  const GRID = 30; // pixels per grid unit

  interface Piece {
    points: [number, number][];
    color: string;
    label: string;
  }

  function getPieces(arr: number): Piece[] {
    if (arr === 0) {
      return [
        { points: [[0,0],[8,0],[8,3]], color: "rgba(52,152,219,0.85)", label: "Blue (8×3)" },
        { points: [[8,3],[13,3],[13,5]], color: "rgba(231,76,60,0.85)", label: "Red (5×2)" },
        { points: [[0,0],[0,2],[5,2],[5,3],[8,3]], color: "rgba(46,204,113,0.85)", label: "Green" },
        { points: [[5,2],[5,3],[13,3],[13,5],[8,5],[8,2]], color: "rgba(241,196,15,0.85)", label: "Yellow" },
      ];
    } else {
      return [
        { points: [[0,0],[8,0],[8,3]], color: "rgba(52,152,219,0.85)", label: "Blue (8×3)" },
        { points: [[8,3],[13,3],[13,5]], color: "rgba(231,76,60,0.85)", label: "Red (5×2)" },
        { points: [[0,0],[0,3],[5,3],[5,2],[8,2],[8,3]], color: "rgba(46,204,113,0.85)", label: "Green" },
        { points: [[5,3],[5,2],[8,2],[8,5],[13,5],[13,3]], color: "rgba(241,196,15,0.85)", label: "Yellow" },
      ];
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    animProgress = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    arrangement = Math.round(params.arrangement ?? 0);
    showGrid = Math.round(params.showGrid ?? 1);
    animSpeed = params.animSpeed ?? 1;

    animProgress = Math.min(1, animProgress + dt * animSpeed * 0.5);
    time += dt;
  }

  function drawPiece(piece: Piece, ox: number, oy: number): void {
    ctx.beginPath();
    const pts = piece.points;
    ctx.moveTo(ox + pts[0][0] * GRID, oy + (5 - pts[0][1]) * GRID);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(ox + pts[i][0] * GRID, oy + (5 - pts[i][1]) * GRID);
    }
    ctx.closePath();
    ctx.fillStyle = piece.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawGrid(ox: number, oy: number): void {
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= 13; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * GRID, oy);
      ctx.lineTo(ox + x * GRID, oy + 5 * GRID);
      ctx.stroke();
    }
    for (let y = 0; y <= 5; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * GRID);
      ctx.lineTo(ox + 13 * GRID, oy + y * GRID);
      ctx.stroke();
    }
  }

  function drawHypotenuse(ox: number, oy: number): void {
    // True diagonal from (0,0) to (13,5)
    ctx.beginPath();
    ctx.moveTo(ox, oy + 5 * GRID);
    ctx.lineTo(ox + 13 * GRID, oy);
    ctx.strokeStyle = "rgba(255,100,100,0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1a1a2e");
    bg.addColorStop(1, "#16213e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("The Missing Square Puzzle", width / 2, 30);

    const triW = 13 * GRID;
    const ox1 = (width / 2 - triW) / 2;
    const ox2 = width / 2 + (width / 2 - triW) / 2;
    const oy = 60;

    // Draw arrangement 1
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Arrangement A", ox1 + triW / 2, oy - 10);

    if (showGrid) drawGrid(ox1, oy);
    drawHypotenuse(ox1, oy);
    const pieces1 = getPieces(0);
    for (const p of pieces1) drawPiece(p, ox1, oy);

    // Draw arrangement 2
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Arrangement B", ox2 + triW / 2, oy - 10);

    if (showGrid) drawGrid(ox2, oy);
    drawHypotenuse(ox2, oy);
    const pieces2 = getPieces(1);
    for (const p of pieces2) drawPiece(p, ox2, oy);

    // Area calculation panel
    const panelY = oy + 5 * GRID + 30;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(20, panelY, width - 40, 120, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("The Secret: Different slopes!", 35, panelY + 22);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Blue triangle slope: 3/8 = 0.375", 35, panelY + 44);
    ctx.fillText("Red triangle slope: 2/5 = 0.400", 35, panelY + 62);
    ctx.fillText("These are NOT the same! The 'hypotenuse' is not truly straight.", 35, panelY + 80);

    const area1 = 0.5 * 8 * 3 + 0.5 * 5 * 2 + 5 + 8;
    ctx.fillText(`Total piece area: ${area1} square units (both arrangements)`, 35, panelY + 100);

    // Highlight the bend
    const bendPhase = Math.sin(time * 2) * 0.5 + 0.5;
    ctx.save();
    ctx.globalAlpha = 0.3 + bendPhase * 0.5;

    // Mark the bend point on arrangement A at (8,3)
    ctx.beginPath();
    ctx.arc(ox1 + 8 * GRID, oy + 2 * GRID, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6b6b";
    ctx.fill();

    // Mark the bend point on arrangement B at (8,3)
    ctx.beginPath();
    ctx.arc(ox2 + 8 * GRID, oy + 2 * GRID, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6b6b";
    ctx.fill();
    ctx.restore();

    // Labels
    ctx.fillStyle = "rgba(255,200,200,0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("bend", ox1 + 8 * GRID + 12, oy + 2 * GRID + 4);
    ctx.fillText("bend", ox2 + 8 * GRID + 12, oy + 2 * GRID + 4);

    // Dimensions
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("13", ox1 + triW / 2, oy + 5 * GRID + 16);
    ctx.fillText("5", ox1 - 14, oy + 2.5 * GRID);
    ctx.fillText("13", ox2 + triW / 2, oy + 5 * GRID + 16);
    ctx.fillText("5", ox2 - 14, oy + 2.5 * GRID);
  }

  function reset(): void {
    time = 0;
    animProgress = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `Triangle Trick: Showing arrangement ${arrangement === 0 ? "A" : "B"}. ` +
      `The puzzle demonstrates a visual paradox where rearranging 4 pieces in a 13×5 "triangle" ` +
      `appears to create/remove a square. The trick: the hypotenuse bends slightly because ` +
      `the two triangle pieces have different slopes (3/8 vs 2/5).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TriangleTrickFactory;
