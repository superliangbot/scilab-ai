import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagneticFieldCircularWireFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetic-field-around-a-circular-wire") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Physics constants
  const MU_0 = 4 * Math.PI * 1e-7; // permeability of free space

  // Parameters (updated each frame)
  let current = 5;       // Amperes
  let loopRadius = 0.1;  // meters
  let numFieldLines = 12;
  let showStrength = 1;

  // Precomputed field line paths
  interface FieldPoint { x: number; y: number; }
  let fieldLinePaths: FieldPoint[][] = [];
  let lastParamHash = "";

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    lastParamHash = "";
  }

  // On-axis magnetic field magnitude: B = mu0 * I * R^2 / (2 * (R^2 + x^2)^(3/2))
  function bOnAxis(I: number, R: number, x: number): number {
    return (MU_0 * I * R * R) / (2 * Math.pow(R * R + x * x, 1.5));
  }

  // Compute B field at an arbitrary point (r, z) in cylindrical coords using numerical Biot-Savart
  // For a circular loop of radius R in the z=0 plane centered at origin
  function computeB(R: number, I: number, rP: number, zP: number): { Br: number; Bz: number } {
    const N = 120; // integration steps around the loop
    let Br = 0;
    let Bz = 0;

    for (let i = 0; i < N; i++) {
      const phi = (2 * Math.PI * i) / N;
      const dphi = (2 * Math.PI) / N;

      // dl element in Cartesian: (-R sin(phi) dphi, R cos(phi) dphi, 0)
      const dlx = -R * Math.sin(phi) * dphi;
      const dly = R * Math.cos(phi) * dphi;

      // Vector from dl to field point P = (rP, 0, zP) in Cartesian
      // Source point is (R cos(phi), R sin(phi), 0)
      const rx = rP - R * Math.cos(phi);
      const ry = 0 - R * Math.sin(phi);
      const rz = zP;
      const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rMag < 1e-10) continue;
      const r3 = rMag * rMag * rMag;

      // dl x r (cross product)
      // dl = (dlx, dly, 0), r = (rx, ry, rz)
      const crossX = dly * rz;
      const crossY = -dlx * rz;
      const crossZ = dlx * ry - dly * rx;

      // The Cartesian components from this element
      const dBx = (MU_0 * I / (4 * Math.PI)) * crossX / r3;
      const dBy = (MU_0 * I / (4 * Math.PI)) * crossY / r3;
      const dBz_elem = (MU_0 * I / (4 * Math.PI)) * crossZ / r3;

      // Project onto cylindrical: Br = Bx cos(0) + By sin(0) = Bx (field point at phi=0)
      Br += dBx;
      Bz += dBz_elem;
      // dBy contributes to B_phi which is zero by symmetry for a circular loop
    }

    return { Br, Bz };
  }

  // Trace a field line from a starting point
  function traceFieldLine(R: number, I: number, startR: number, startZ: number, steps: number, ds: number): FieldPoint[] {
    const points: FieldPoint[] = [];
    let r = startR;
    let z = startZ;
    const maxR = R * 6;
    const maxZ = R * 5;

    for (let i = 0; i < steps; i++) {
      points.push({ x: r, y: z });
      const b = computeB(R, I, Math.abs(r) + 1e-6, z);
      const bMag = Math.sqrt(b.Br * b.Br + b.Bz * b.Bz);
      if (bMag < 1e-15) break;

      const dr = (b.Br / bMag) * ds;
      const dz = (b.Bz / bMag) * ds;
      r += dr;
      z += dz;

      if (Math.abs(r) > maxR || Math.abs(z) > maxZ) break;
    }
    return points;
  }

  function computeFieldLines(I: number, R: number, nLines: number): void {
    fieldLinePaths = [];
    const ds = R * 0.04;
    const steps = 600;

    // Start field lines from points along the axis and near the wire
    for (let i = 0; i < nLines; i++) {
      // Start from different radial distances near the loop center
      const frac = (i + 1) / (nLines + 1);
      const startR = R * frac * 0.9;

      // Trace forward
      const forward = traceFieldLine(R, I, startR, 0.001, steps, ds);
      // Trace backward
      const backward = traceFieldLine(R, I, startR, -0.001, steps, -ds);

      // Combine: reverse backward + forward
      const combined = backward.reverse().concat(forward);
      if (combined.length > 10) {
        fieldLinePaths.push(combined);
      }
    }

    // Also add some external field lines starting from outside the loop
    for (let i = 0; i < Math.min(nLines, 6); i++) {
      const frac = (i + 1) / (Math.min(nLines, 6) + 1);
      const startR = R * (1.3 + frac * 2.5);

      const forward = traceFieldLine(R, I, startR, 0.001, steps, ds);
      const backward = traceFieldLine(R, I, startR, -0.001, steps, -ds);
      const combined = backward.reverse().concat(forward);
      if (combined.length > 10) {
        fieldLinePaths.push(combined);
      }
    }
  }

  // Map from physics coords to screen
  function toScreen(r: number, z: number, R: number): { sx: number; sy: number } {
    const scale = Math.min(width, height) / (R * 14);
    const cx = width / 2;
    const cy = height / 2;
    return {
      sx: cx + z * scale,  // z axis is horizontal on screen
      sy: cy - r * scale   // r axis is vertical on screen
    };
  }

  function getFieldStrengthColor(bMag: number, maxB: number): string {
    const t = Math.min(1, bMag / (maxB * 0.5));
    // Red (strong) to blue (weak)
    const r = Math.floor(255 * t);
    const g = Math.floor(60 * (1 - t));
    const b = Math.floor(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    current = params.current ?? 5;
    loopRadius = (params.loopRadius ?? 10) / 100; // cm to m
    numFieldLines = params.numFieldLines ?? 12;
    showStrength = params.showStrength ?? 1;

    const hash = `${current.toFixed(2)}_${loopRadius.toFixed(4)}_${numFieldLines}`;
    if (hash !== lastParamHash) {
      lastParamHash = hash;
      computeFieldLines(current, loopRadius, numFieldLines);
    }
  }

  function render(): void {
    const R = loopRadius;
    const scale = Math.min(width, height) / (R * 14);
    const cx = width / 2;
    const cy = height / 2;

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Compute max B for color scaling
    const maxB = bOnAxis(current, R, 0);

    // Draw field strength background if enabled
    if (showStrength >= 0.5) {
      const gridSize = 6;
      for (let px = 0; px < width; px += gridSize) {
        for (let py = 0; py < height; py += gridSize) {
          const z = (px - cx) / scale;
          const r = (cy - py) / scale;
          const rAbs = Math.abs(r);
          const b = computeB(R, current, rAbs + 1e-8, z);
          const bMag = Math.sqrt(b.Br * b.Br + b.Bz * b.Bz);
          const intensity = Math.min(1, bMag / (maxB * 0.3));
          if (intensity > 0.01) {
            const alpha = intensity * 0.25;
            const red = Math.floor(255 * intensity);
            const blue = Math.floor(200 * (1 - intensity));
            ctx.fillStyle = `rgba(${red},40,${blue},${alpha})`;
            ctx.fillRect(px, py, gridSize, gridSize);
          }
        }
      }
    }

    // Draw field lines
    for (const path of fieldLinePaths) {
      if (path.length < 2) continue;

      // Draw upper half (r > 0)
      ctx.beginPath();
      const s0 = toScreen(path[0].x, path[0].y, R);
      ctx.moveTo(s0.sx, s0.sy);
      for (let i = 1; i < path.length; i++) {
        const s = toScreen(path[i].x, path[i].y, R);
        ctx.lineTo(s.sx, s.sy);
      }
      ctx.strokeStyle = "rgba(100,180,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw lower half (mirror r -> -r)
      ctx.beginPath();
      const m0 = toScreen(-path[0].x, path[0].y, R);
      ctx.moveTo(m0.sx, m0.sy);
      for (let i = 1; i < path.length; i++) {
        const m = toScreen(-path[i].x, path[i].y, R);
        ctx.lineTo(m.sx, m.sy);
      }
      ctx.strokeStyle = "rgba(100,180,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw arrows on field lines (every ~1/3 along the path)
      for (let half = 0; half < 2; half++) {
        const sign = half === 0 ? 1 : -1;
        const arrowIdx = Math.floor(path.length * 0.35);
        if (arrowIdx < path.length - 1) {
          const p1 = toScreen(sign * path[arrowIdx].x, path[arrowIdx].y, R);
          const p2 = toScreen(sign * path[arrowIdx + 1].x, path[arrowIdx + 1].y, R);
          const angle = Math.atan2(p2.sy - p1.sy, p2.sx - p1.sx);
          drawArrow(p1.sx, p1.sy, angle, 8, "rgba(100,180,255,0.9)");
        }
      }
    }

    // Draw wire cross-section (two circles representing the loop cut in cross-section)
    const wireScreenR = Math.max(8, R * scale * 0.08);
    const wireTopPos = toScreen(R, 0, R);
    const wireBotPos = toScreen(-R, 0, R);

    // Top wire (current coming out of page - dot)
    ctx.beginPath();
    ctx.arc(wireTopPos.sx, wireTopPos.sy, wireScreenR, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dot symbol (current out of page)
    ctx.beginPath();
    ctx.arc(wireTopPos.sx, wireTopPos.sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();

    // Bottom wire (current going into page - cross)
    ctx.beginPath();
    ctx.arc(wireBotPos.sx, wireBotPos.sy, wireScreenR, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cross symbol (current into page)
    const crossSize = wireScreenR * 0.6;
    ctx.beginPath();
    ctx.moveTo(wireBotPos.sx - crossSize, wireBotPos.sy - crossSize);
    ctx.lineTo(wireBotPos.sx + crossSize, wireBotPos.sy + crossSize);
    ctx.moveTo(wireBotPos.sx + crossSize, wireBotPos.sy - crossSize);
    ctx.lineTo(wireBotPos.sx - crossSize, wireBotPos.sy + crossSize);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw axis labels
    ctx.font = "13px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("z-axis (along loop axis)", cx, height - 12);
    ctx.save();
    ctx.translate(16, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("r-axis (radial)", 0, 0);
    ctx.restore();

    // Labels on wires
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.fillText("I (out)", wireTopPos.sx + wireScreenR + 6, wireTopPos.sy + 4);
    ctx.fillText("I (in)", wireBotPos.sx + wireScreenR + 6, wireBotPos.sy + 4);

    // Title and info
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Magnetic Field Around a Circular Wire Loop", width / 2, 28);

    // B at center info
    const bCenter = bOnAxis(current, R, 0);
    ctx.font = "13px monospace";
    ctx.fillStyle = "#67e8f9";
    ctx.textAlign = "left";
    const bStr = bCenter >= 1e-3 ? (bCenter * 1e3).toFixed(2) + " mT" : (bCenter * 1e6).toFixed(2) + " uT";
    ctx.fillText(`B(center) = ${bStr}`, 14, height - 50);
    ctx.fillText(`I = ${current.toFixed(1)} A, R = ${(R * 100).toFixed(1)} cm`, 14, height - 32);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("B = \u03BC\u2080IR\u00B2 / (2(R\u00B2+x\u00B2)^(3/2))", 14, height - 14);

    // Animate current flow indicators
    const pulsePhase = (Math.sin(time * 4) + 1) / 2;
    const pulseR = wireScreenR + 4 + pulsePhase * 4;
    ctx.beginPath();
    ctx.arc(wireTopPos.sx, wireTopPos.sy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251,191,36,${0.4 * (1 - pulsePhase)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(wireBotPos.sx, wireBotPos.sy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251,191,36,${0.4 * (1 - pulsePhase)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawArrow(x: number, y: number, angle: number, size: number, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.5, -size * 0.5);
    ctx.lineTo(-size * 0.5, size * 0.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    lastParamHash = "";
    fieldLinePaths = [];
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const bCenter = bOnAxis(current, loopRadius, 0);
    const bStr = bCenter >= 1e-3 ? (bCenter * 1e3).toFixed(3) + " mT" : (bCenter * 1e6).toFixed(3) + " uT";
    return `Circular wire loop (cross-section view) carrying ${current.toFixed(1)} A with radius ${(loopRadius * 100).toFixed(1)} cm. ` +
      `Magnetic field at center: ${bStr}. Field lines form closed loops through the center of the coil ` +
      `and curve around outside, strongest at the center. Using Biot-Savart law: B = mu0*I*R^2/(2*(R^2+x^2)^(3/2)).`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MagneticFieldCircularWireFactory;
