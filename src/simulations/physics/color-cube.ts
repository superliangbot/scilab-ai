import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * RGB Color Cube
 * 3D visualization of the RGB colour space as a cube.
 * Each axis represents R, G, B intensity (0-255).
 * Uses simple isometric projection with auto-rotation.
 */

const ColorCubeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("color-cube") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let resolution = 4;   // steps per axis
  let autoRotate = 1;
  let rotationAngle = 30;
  let showGrayscale = 0;

  // Rotation
  let angleX = 0.4;
  let angleY = 0.6;

  function project(x: number, y: number, z: number, cx: number, cy: number, scale: number): { px: number; py: number; depth: number } {
    // Rotate around Y
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    let x1 = x * cosY - z * sinY;
    let z1 = x * sinY + z * cosY;
    // Rotate around X
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    let y1 = y * cosX - z1 * sinX;
    let z2 = y * sinX + z1 * cosX;

    return {
      px: cx + x1 * scale,
      py: cy - y1 * scale,
      depth: z2,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    resolution = Math.round(params.resolution ?? 4);
    autoRotate = params.autoRotate ?? 1;
    rotationAngle = params.rotationAngle ?? 30;
    showGrayscale = params.showGrayscale ?? 0;

    if (autoRotate >= 1) {
      angleY += dt * 0.5;
      angleX = 0.4 + Math.sin(time * 0.3) * 0.15;
    } else {
      angleY = rotationAngle * Math.PI / 180;
    }

    time += dt;
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * 0.28;

    const steps = Math.max(2, Math.min(10, resolution));

    // Collect colour points for depth sorting
    const points: { px: number; py: number; depth: number; r: number; g: number; b: number }[] = [];

    for (let ri = 0; ri <= steps; ri++) {
      for (let gi = 0; gi <= steps; gi++) {
        for (let bi = 0; bi <= steps; bi++) {
          const rf = ri / steps;
          const gf = gi / steps;
          const bf = bi / steps;

          // Map to cube coordinates centred at origin
          const x = rf - 0.5;
          const y = gf - 0.5;
          const z = bf - 0.5;

          const p = project(x, y, z, cx, cy, scale);

          let r = Math.round(rf * 255);
          let g = Math.round(gf * 255);
          let b = Math.round(bf * 255);

          if (showGrayscale >= 1) {
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            r = g = b = gray;
          }

          points.push({ px: p.px, py: p.py, depth: p.depth, r, g, b });
        }
      }
    }

    // Sort by depth (back to front)
    points.sort((a, b) => a.depth - b.depth);

    // Draw cube edges first
    const edges: [number, number, number, number, number, number][] = [
      [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5, -0.5, 0.5, -0.5],
      [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5, -0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5, 0.5, -0.5],
      [0.5, -0.5, -0.5, 0.5, 0.5, -0.5],
      [0.5, -0.5, -0.5, 0.5, -0.5, 0.5],
      [-0.5, 0.5, -0.5, 0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5, -0.5, 0.5, 0.5],
      [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5],
      [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5],
    ];

    ctx.strokeStyle = "rgba(150,180,220,0.2)";
    ctx.lineWidth = 1;
    for (const [x1, y1, z1, x2, y2, z2] of edges) {
      const p1 = project(x1, y1, z1, cx, cy, scale);
      const p2 = project(x2, y2, z2, cx, cy, scale);
      ctx.beginPath();
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }

    // Draw axis labels
    const axisLabels: [number, number, number, string, string][] = [
      [0.65, -0.5, -0.5, "Red", "#ff4444"],
      [-0.5, 0.65, -0.5, "Green", "#44ff44"],
      [-0.5, -0.5, 0.65, "Blue", "#4444ff"],
    ];
    for (const [x, y, z, label, color] of axisLabels) {
      const p = project(x, y, z, cx, cy, scale);
      ctx.font = `bold ${Math.max(10, width * 0.018)}px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(label, p.px, p.py);
    }

    // Draw colour points
    const dotR = Math.max(3, scale / (steps * 2.5));
    for (const pt of points) {
      ctx.beginPath();
      ctx.arc(pt.px, pt.py, dotR, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${pt.r},${pt.g},${pt.b})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,0.15)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.025)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("RGB Color Cube", width / 2, 24);
    ctx.font = `${Math.max(10, width * 0.016)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160,180,220,0.5)";
    ctx.fillText("Each axis represents Red, Green, or Blue intensity (0-255)", width / 2, 42);
    ctx.restore();

    // Stats
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Points: ${points.length} (${steps + 1}³)`, 8, height - 8);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    angleX = 0.4;
    angleY = 0.6;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    return (
      `RGB Color Cube: ${resolution + 1}³ = ${Math.pow(resolution + 1, 3)} colour points. ` +
      `Auto-rotate: ${autoRotate >= 1 ? "on" : "off"}. Grayscale: ${showGrayscale >= 1 ? "on" : "off"}. ` +
      `The RGB colour model is additive — mixing all three primaries at full intensity produces white.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ColorCubeFactory;
