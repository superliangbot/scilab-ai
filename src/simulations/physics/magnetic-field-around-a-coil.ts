import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagneticFieldCoilFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetic-field-around-a-coil") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  const MU_0 = 4 * Math.PI * 1e-7;

  // Parameters
  let current = 5;
  let numTurns = 10;
  let coilLength = 0.2; // meters
  let showVectors = 1;

  // Field data
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

  // Compute B field from a single circular loop at position z0
  function singleLoopB(R: number, I: number, rP: number, zP: number, z0: number): { Br: number; Bz: number } {
    const zRel = zP - z0;
    const N = 80;
    let Br = 0;
    let Bz = 0;

    for (let i = 0; i < N; i++) {
      const phi = (2 * Math.PI * i) / N;
      const dphi = (2 * Math.PI) / N;

      const dlx = -R * Math.sin(phi) * dphi;
      const dly = R * Math.cos(phi) * dphi;

      const rx = rP - R * Math.cos(phi);
      const ry = 0 - R * Math.sin(phi);
      const rz = zRel;
      const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rMag < 1e-10) continue;
      const r3 = rMag * rMag * rMag;

      const crossX = dly * rz;
      const crossZ = dlx * ry - dly * rx;

      Br += (MU_0 * I / (4 * Math.PI)) * crossX / r3;
      Bz += (MU_0 * I / (4 * Math.PI)) * crossZ / r3;
    }
    return { Br, Bz };
  }

  // Superpose fields from all turns of the solenoid
  function solenoidB(R: number, I: number, L: number, nTurns: number, rP: number, zP: number): { Br: number; Bz: number } {
    let Br = 0;
    let Bz = 0;
    for (let t = 0; t < nTurns; t++) {
      const z0 = -L / 2 + (L * (t + 0.5)) / nTurns;
      const b = singleLoopB(R, I, rP, zP, z0);
      Br += b.Br;
      Bz += b.Bz;
    }
    return { Br, Bz };
  }

  // Solenoid radius (proportional to length)
  function coilRadius(): number {
    return coilLength * 0.25;
  }

  function traceFieldLine(R: number, I: number, L: number, nTurns: number, startR: number, startZ: number, steps: number, ds: number): FieldPoint[] {
    const points: FieldPoint[] = [];
    let r = startR;
    let z = startZ;
    const maxExtent = L * 4;

    for (let i = 0; i < steps; i++) {
      points.push({ x: r, y: z });
      const b = solenoidB(R, I, L, nTurns, Math.abs(r) + 1e-7, z);
      const bMag = Math.sqrt(b.Br * b.Br + b.Bz * b.Bz);
      if (bMag < 1e-16) break;

      const dr = (b.Br / bMag) * ds;
      const dz = (b.Bz / bMag) * ds;
      r += dr;
      z += dz;

      if (Math.abs(r) > maxExtent || Math.abs(z) > maxExtent) break;
    }
    return points;
  }

  function computeFieldLines(I: number, R: number, L: number, nTurns: number): void {
    fieldLinePaths = [];
    const ds = L * 0.012;
    const steps = 800;

    // Internal field lines (starting inside the solenoid)
    const numInternal = 6;
    for (let i = 0; i < numInternal; i++) {
      const frac = (i + 1) / (numInternal + 1);
      const startR = R * frac * 0.85;

      const forward = traceFieldLine(R, I, L, nTurns, startR, 0.001, steps, ds);
      const backward = traceFieldLine(R, I, L, nTurns, startR, -0.001, steps, -ds);
      const combined = backward.reverse().concat(forward);
      if (combined.length > 10) fieldLinePaths.push(combined);
    }

    // External field lines
    const numExternal = 5;
    for (let i = 0; i < numExternal; i++) {
      const frac = (i + 1) / (numExternal + 1);
      const startR = R * (1.3 + frac * 3.0);

      const forward = traceFieldLine(R, I, L, nTurns, startR, 0.001, steps, ds);
      const backward = traceFieldLine(R, I, L, nTurns, startR, -0.001, steps, -ds);
      const combined = backward.reverse().concat(forward);
      if (combined.length > 10) fieldLinePaths.push(combined);
    }
  }

  function toScreen(r: number, z: number): { sx: number; sy: number } {
    const R = coilRadius();
    const L = coilLength;
    const maxDim = Math.max(R * 8, L * 3);
    const scale = Math.min(width, height) * 0.8 / maxDim;
    return {
      sx: width / 2 + z * scale,
      sy: height / 2 - r * scale
    };
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    current = params.current ?? 5;
    numTurns = Math.round(params.numTurns ?? 10);
    coilLength = (params.coilLength ?? 20) / 100; // cm to m
    showVectors = params.showVectors ?? 1;

    const hash = `${current.toFixed(2)}_${numTurns}_${coilLength.toFixed(4)}`;
    if (hash !== lastParamHash) {
      lastParamHash = hash;
      computeFieldLines(current, coilRadius(), coilLength, numTurns);
    }
  }

  function render(): void {
    const R = coilRadius();
    const L = coilLength;
    const n = numTurns / L; // turns per meter

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const maxDim = Math.max(R * 8, L * 3);
    const scale = Math.min(width, height) * 0.8 / maxDim;

    // Draw field strength color map
    if (showVectors >= 0.5) {
      const bInside = MU_0 * n * current;
      const gridSize = 8;
      for (let px = 0; px < width; px += gridSize) {
        for (let py = 0; py < height; py += gridSize) {
          const z = (px - width / 2) / scale;
          const r = (height / 2 - py) / scale;
          const b = solenoidB(R, current, L, numTurns, Math.abs(r) + 1e-8, z);
          const bMag = Math.sqrt(b.Br * b.Br + b.Bz * b.Bz);
          const intensity = Math.min(1, bMag / (bInside * 0.4));
          if (intensity > 0.01) {
            const alpha = intensity * 0.2;
            const red = Math.floor(255 * intensity);
            const blue = Math.floor(180 * (1 - intensity));
            ctx.fillStyle = `rgba(${red},30,${blue},${alpha})`;
            ctx.fillRect(px, py, gridSize, gridSize);
          }
        }
      }
    }

    // Draw field lines (upper and mirrored lower)
    for (const path of fieldLinePaths) {
      if (path.length < 2) continue;

      for (let half = 0; half < 2; half++) {
        const sign = half === 0 ? 1 : -1;
        ctx.beginPath();
        const s0 = toScreen(sign * path[0].x, path[0].y);
        ctx.moveTo(s0.sx, s0.sy);
        for (let i = 1; i < path.length; i++) {
          const s = toScreen(sign * path[i].x, path[i].y);
          ctx.lineTo(s.sx, s.sy);
        }
        ctx.strokeStyle = "rgba(100,200,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrow at ~1/3 along path
        const ai = Math.floor(path.length * 0.3);
        if (ai < path.length - 1) {
          const p1 = toScreen(sign * path[ai].x, path[ai].y);
          const p2 = toScreen(sign * path[ai + 1].x, path[ai + 1].y);
          const angle = Math.atan2(p2.sy - p1.sy, p2.sx - p1.sx);
          drawArrow(p1.sx, p1.sy, angle, 7, "rgba(100,200,255,0.9)");
        }
      }
    }

    // Draw solenoid cross-section (wire dots)
    for (let t = 0; t < numTurns; t++) {
      const z0 = -L / 2 + (L * (t + 0.5)) / numTurns;

      // Top wire (current out of page)
      const topPos = toScreen(R, z0);
      const wireR = Math.max(4, Math.min(8, 3 * scale * R * 0.05));

      ctx.beginPath();
      ctx.arc(topPos.sx, topPos.sy, wireR, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Dot symbol
      ctx.beginPath();
      ctx.arc(topPos.sx, topPos.sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();

      // Bottom wire (current into page)
      const botPos = toScreen(-R, z0);
      ctx.beginPath();
      ctx.arc(botPos.sx, botPos.sy, wireR, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Cross symbol
      const cs = wireR * 0.5;
      ctx.beginPath();
      ctx.moveTo(botPos.sx - cs, botPos.sy - cs);
      ctx.lineTo(botPos.sx + cs, botPos.sy + cs);
      ctx.moveTo(botPos.sx + cs, botPos.sy - cs);
      ctx.lineTo(botPos.sx - cs, botPos.sy + cs);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw solenoid outline
    const tlCorner = toScreen(R, -L / 2);
    const brCorner = toScreen(-R, L / 2);
    ctx.strokeStyle = "rgba(245,158,11,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tlCorner.sx, tlCorner.sy, brCorner.sx - tlCorner.sx, brCorner.sy - tlCorner.sy);

    // Draw field vectors inside if enabled
    if (showVectors >= 0.5) {
      const numVecZ = 5;
      const numVecR = 3;
      for (let iz = 0; iz < numVecZ; iz++) {
        for (let ir = 0; ir < numVecR; ir++) {
          const z = -L / 2 + L * (iz + 0.5) / numVecZ;
          const rVal = R * (ir + 0.5) / (numVecR + 1);
          for (let sign = -1; sign <= 1; sign += 2) {
            const b = solenoidB(R, current, L, numTurns, Math.abs(sign * rVal) + 1e-8, z);
            const bMag = Math.sqrt(b.Br * b.Br + b.Bz * b.Bz);
            if (bMag < 1e-14) continue;
            const pos = toScreen(sign * rVal, z);
            const angle = Math.atan2(-b.Br * sign, b.Bz);
            const arrowLen = Math.min(20, bMag * scale * 1e4);
            if (arrowLen > 2) {
              ctx.beginPath();
              ctx.moveTo(pos.sx, pos.sy);
              ctx.lineTo(pos.sx + Math.cos(angle) * arrowLen, pos.sy + Math.sin(angle) * arrowLen);
              ctx.strokeStyle = "rgba(52,211,153,0.6)";
              ctx.lineWidth = 1.5;
              ctx.stroke();
              drawArrow(
                pos.sx + Math.cos(angle) * arrowLen,
                pos.sy + Math.sin(angle) * arrowLen,
                angle, 5, "rgba(52,211,153,0.8)"
              );
            }
          }
        }
      }
    }

    // N and S pole labels
    const nPolePos = toScreen(0, L / 2 + L * 0.15);
    const sPolePos = toScreen(0, -L / 2 - L * 0.15);
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ef4444";
    ctx.fillText("N", nPolePos.sx, nPolePos.sy + 6);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("S", sPolePos.sx, sPolePos.sy + 6);

    // Title
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Magnetic Field Around a Coil (Solenoid)", width / 2, 28);

    // Info
    const bInside = MU_0 * n * current;
    const bStr = bInside >= 1e-3 ? (bInside * 1e3).toFixed(2) + " mT" : (bInside * 1e6).toFixed(2) + " uT";
    ctx.font = "13px monospace";
    ctx.fillStyle = "#67e8f9";
    ctx.textAlign = "left";
    ctx.fillText(`B(inside) \u2248 ${bStr}`, 14, height - 52);
    ctx.fillText(`I = ${current.toFixed(1)} A, N = ${numTurns}, L = ${(L * 100).toFixed(1)} cm`, 14, height - 34);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("B = \u03BC\u2080nI  (n = N/L, inside solenoid)", 14, height - 16);

    // Pulse animation on wires
    const pulse = (Math.sin(time * 5) + 1) / 2;
    for (let t = 0; t < numTurns; t++) {
      const z0 = -L / 2 + (L * (t + 0.5)) / numTurns;
      const wireR = Math.max(4, Math.min(8, 3 * scale * R * 0.05));
      const topPos = toScreen(R, z0);
      ctx.beginPath();
      ctx.arc(topPos.sx, topPos.sy, wireR + 3 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(245,158,11,${0.2 * (1 - pulse)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
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
    const R = coilRadius();
    const L = coilLength;
    const n = numTurns / L;
    const bInside = MU_0 * n * current;
    const bStr = bInside >= 1e-3 ? (bInside * 1e3).toFixed(3) + " mT" : (bInside * 1e6).toFixed(3) + " uT";
    return `Solenoid (coil) with ${numTurns} turns, length ${(L * 100).toFixed(1)} cm, carrying ${current.toFixed(1)} A. ` +
      `Interior field B = mu0*n*I = ${bStr} (nearly uniform). ` +
      `Field lines are parallel inside the solenoid and curve around outside like a bar magnet, ` +
      `with N pole at right and S pole at left.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MagneticFieldCoilFactory;
