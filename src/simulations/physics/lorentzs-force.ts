import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Lorentz Force: Charged Particle in Crossed E and B Fields (2D)
 *
 * Demonstrates:
 * - Lorentz force F = q(E + v x B)
 * - Cyclotron motion in a magnetic field
 * - E x B drift when both fields present
 * - Trajectory curvature depends on q, m, v, B
 */

interface TrailPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const LorentzForceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lorentzs-force") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Particle state (SI-ish units, scaled for display)
  let px = 0; // position x (m)
  let py = 0; // position y (m)
  let vx = 0; // velocity x (m/s)
  let vy = 0; // velocity y (m/s)

  // Parameters
  let charge = 1.0;    // C (unit charge)
  let Efield = 0.0;    // V/m  (y-direction)
  let Bfield = 1.0;    // T    (z-direction, into screen)
  let mass = 1.0;      // kg
  let v0 = 2.0;        // initial speed (x-direction) m/s

  // Trail
  let trail: TrailPoint[] = [];
  const MAX_TRAIL = 2000;

  // View transform
  let scale = 1; // pixels per meter
  let originX = 0;
  let originY = 0;

  function worldToScreen(wx: number, wy: number): [number, number] {
    return [originX + wx * scale, originY - wy * scale];
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    resetState();
  }

  function resetState(): void {
    time = 0;
    scale = Math.min(width, height) * 0.08;
    originX = width * 0.25;
    originY = height * 0.55;

    px = 0;
    py = 0;
    vx = v0;
    vy = 0;
    trail = [{ x: px, y: py, vx, vy }];
  }

  function update(dt: number, params: Record<string, number>): void {
    charge = params.charge ?? 1.0;
    Efield = params.electricField ?? 0.0;
    Bfield = params.magneticField ?? 1.0;
    mass = params.mass ?? 1.0;
    v0 = params.initialVelocity ?? 2.0;

    if (mass < 0.01) mass = 0.01;

    // Sub-stepping for accuracy (Boris / leapfrog style)
    const subSteps = 20;
    const subDt = Math.min(dt, 0.016) / subSteps;

    for (let s = 0; s < subSteps; s++) {
      // Lorentz force: F = q(E + v x B)
      // E = (0, Efield, 0),  B = (0, 0, Bfield)
      // v x B = (vy*Bfield, -vx*Bfield, 0)  for B in z-dir
      const Fx = charge * (vx * 0 + vy * Bfield);  // q*(vy*B)
      const Fy = charge * (Efield - vx * Bfield);   // q*(E - vx*B)

      const ax = Fx / mass;
      const ay = Fy / mass;

      // Velocity Verlet integration
      const halfVx = vx + ax * subDt * 0.5;
      const halfVy = vy + ay * subDt * 0.5;

      px += halfVx * subDt;
      py += halfVy * subDt;

      // Recompute acceleration at new position (force depends on velocity, so use half-step)
      const Fx2 = charge * (halfVy * Bfield);
      const Fy2 = charge * (Efield - halfVx * Bfield);
      const ax2 = Fx2 / mass;
      const ay2 = Fy2 / mass;

      vx = halfVx + ax2 * subDt * 0.5;
      vy = halfVy + ay2 * subDt * 0.5;
    }

    time += dt;

    // Record trail
    trail.push({ x: px, y: py, vx, vy });
    if (trail.length > MAX_TRAIL) trail.shift();

    // Auto-scroll: keep particle visible
    const [sx, sy] = worldToScreen(px, py);
    const margin = 100;
    if (sx > width - margin) originX -= (sx - (width - margin));
    if (sx < margin) originX += (margin - sx);
    if (sy > height - margin) originY -= (sy - (height - margin));
    if (sy < margin) originY += (margin - sy);
  }

  function drawGrid(): void {
    ctx.strokeStyle = "rgba(100,116,139,0.15)";
    ctx.lineWidth = 1;

    const gridSpacing = 1; // 1 meter
    const startWx = Math.floor(-originX / scale) - 1;
    const endWx = Math.ceil((width - originX) / scale) + 1;
    const startWy = Math.floor(-(height - originY) / scale) - 1;
    const endWy = Math.ceil(originY / scale) + 1;

    ctx.beginPath();
    for (let wx = startWx; wx <= endWx; wx++) {
      const [sx] = worldToScreen(wx, 0);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let wy = startWy; wy <= endWy; wy++) {
      const [, sy] = worldToScreen(0, wy);
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();
  }

  function drawAxes(): void {
    // x-axis
    ctx.strokeStyle = "rgba(239,68,68,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const [axStart] = worldToScreen(-100, 0);
    const [axEnd] = worldToScreen(100, 0);
    ctx.moveTo(axStart, originY);
    ctx.lineTo(axEnd, originY);
    ctx.stroke();

    // y-axis
    ctx.strokeStyle = "rgba(34,197,94,0.6)";
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, height);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(239,68,68,0.8)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("x", width - 20, originY - 8);

    ctx.fillStyle = "rgba(34,197,94,0.8)";
    ctx.textAlign = "center";
    ctx.fillText("y", originX + 14, 18);
  }

  function drawFieldIndicators(): void {
    const panelX = 15;
    const panelY = height - 150;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 200, 135, 8);
    ctx.fill();

    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";

    // E field
    ctx.fillStyle = "#facc15";
    ctx.fillText(`E field: ${Efield.toFixed(2)} V/m (y-dir)`, panelX + 12, panelY + 22);
    if (Math.abs(Efield) > 0.001) {
      const arrowDir = Efield > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(panelX + 170, panelY + 17);
      ctx.lineTo(panelX + 170, panelY + 17 - arrowDir * 12);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(panelX + 170, panelY + 17 - arrowDir * 12);
      ctx.lineTo(panelX + 166, panelY + 17 - arrowDir * 6);
      ctx.lineTo(panelX + 174, panelY + 17 - arrowDir * 6);
      ctx.closePath();
      ctx.fillStyle = "#facc15";
      ctx.fill();
    }

    // B field
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`B field: ${Bfield.toFixed(2)} T (into page)`, panelX + 12, panelY + 45);
    // Draw "into page" symbol (X in circle)
    ctx.beginPath();
    ctx.arc(panelX + 180, panelY + 41, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(panelX + 175, panelY + 36);
    ctx.lineTo(panelX + 185, panelY + 46);
    ctx.moveTo(panelX + 185, panelY + 36);
    ctx.lineTo(panelX + 175, panelY + 46);
    ctx.stroke();

    // Particle info
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`q = ${charge.toFixed(2)} C`, panelX + 12, panelY + 68);
    ctx.fillText(`m = ${mass.toFixed(2)} kg`, panelX + 12, panelY + 85);
    ctx.fillText(`|v| = ${Math.sqrt(vx * vx + vy * vy).toFixed(2)} m/s`, panelX + 12, panelY + 102);

    // Cyclotron radius
    const speed = Math.sqrt(vx * vx + vy * vy);
    const absB = Math.abs(Bfield);
    const rc = absB > 0.001 ? (mass * speed) / (Math.abs(charge) * absB) : Infinity;
    ctx.fillText(`r_c = ${rc < 1000 ? rc.toFixed(2) : "\u221E"} m`, panelX + 12, panelY + 119);
  }

  function drawTrail(): void {
    if (trail.length < 2) return;

    for (let i = 1; i < trail.length; i++) {
      const alpha = 0.15 + 0.85 * (i / trail.length);
      const [sx1, sy1] = worldToScreen(trail[i - 1].x, trail[i - 1].y);
      const [sx2, sy2] = worldToScreen(trail[i].x, trail[i].y);

      // Color based on speed
      const speed = Math.sqrt(trail[i].vx ** 2 + trail[i].vy ** 2);
      const maxSpeed = v0 * 2;
      const t = Math.min(1, speed / Math.max(0.01, maxSpeed));
      const r = Math.round(59 + t * 180);
      const g = Math.round(130 - t * 80);
      const b = Math.round(246 - t * 150);

      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }
  }

  function drawParticle(): void {
    const [sx, sy] = worldToScreen(px, py);
    const radius = 10;

    // Glow
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 3);
    glow.addColorStop(0, charge > 0 ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.4)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 3, 0, Math.PI * 2);
    ctx.fill();

    // Particle body
    const grad = ctx.createRadialGradient(sx - 3, sy - 3, 0, sx, sy, radius);
    grad.addColorStop(0, charge > 0 ? "#f87171" : "#60a5fa");
    grad.addColorStop(1, charge > 0 ? "#dc2626" : "#2563eb");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Charge sign
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(charge >= 0 ? "+" : "\u2212", sx, sy + 1);
    ctx.textBaseline = "alphabetic";
  }

  function drawForceVectors(): void {
    const [sx, sy] = worldToScreen(px, py);

    // Compute forces
    const FxE = 0;
    const FyE = charge * Efield;
    const FxB = charge * vy * Bfield;
    const FyB = charge * (-vx * Bfield);
    const Fx = FxE + FxB;
    const Fy = FyE + FyB;

    const forceScale = scale * 0.8;

    // Electric force (yellow)
    if (Math.abs(FyE) > 0.001) {
      drawArrow(sx, sy, sx, sy - FyE * forceScale, "#facc15", 3);
      ctx.fillStyle = "#facc15";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("F_E", sx + 8, sy - FyE * forceScale * 0.5);
    }

    // Magnetic force (cyan)
    if (Math.abs(FxB) > 0.001 || Math.abs(FyB) > 0.001) {
      drawArrow(sx, sy, sx + FxB * forceScale, sy - FyB * forceScale, "#22d3ee", 3);
      ctx.fillStyle = "#22d3ee";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("F_B", sx + FxB * forceScale * 0.5 + 8, sy - FyB * forceScale * 0.5);
    }

    // Total force (white)
    if (Math.abs(Fx) > 0.001 || Math.abs(Fy) > 0.001) {
      drawArrow(sx, sy, sx + Fx * forceScale, sy - Fy * forceScale, "#ffffff", 2);
      ctx.fillStyle = "#ffffff";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("F_net", sx + Fx * forceScale * 0.5 + 8, sy - Fy * forceScale * 0.5 - 8);
    }

    // Velocity vector (green)
    const vScale = forceScale * 0.5;
    if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
      drawArrow(sx, sy, sx + vx * vScale, sy - vy * vScale, "#4ade80", 2);
      ctx.fillStyle = "#4ade80";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("v", sx + vx * vScale * 0.5 + 8, sy - vy * vScale * 0.5 + 14);
    }
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string, lw: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 3) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const headLen = Math.min(10, len * 0.3);
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.35), y2 - headLen * Math.sin(angle - 0.35));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.35), y2 - headLen * Math.sin(angle + 0.35));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawFormula(): void {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(width - 280, 10, 270, 60, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F = q(E + v \u00D7 B)", width - 145, 35);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Lorentz Force Law", width - 145, 55);
  }

  function drawLegend(): void {
    const lx = width - 180;
    const ly = height - 115;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, 170, 100, 8);
    ctx.fill();

    const items = [
      { color: "#4ade80", label: "Velocity (v)" },
      { color: "#facc15", label: "Electric force (F_E)" },
      { color: "#22d3ee", label: "Magnetic force (F_B)" },
      { color: "#ffffff", label: "Net force (F_net)" },
    ];

    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    items.forEach((item, i) => {
      const iy = ly + 18 + i * 22;
      ctx.fillStyle = item.color;
      ctx.fillRect(lx + 10, iy - 5, 16, 3);
      ctx.fillText(item.label, lx + 32, iy);
    });
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawGrid();
    drawAxes();
    drawTrail();
    drawForceVectors();
    drawParticle();
    drawFieldIndicators();
    drawFormula();
    drawLegend();

    // Title
    ctx.fillStyle = "rgba(226,232,240,0.9)";
    ctx.font = `bold ${Math.max(18, width * 0.026)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Lorentz Force", width / 2, 30);

    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.font = `${Math.max(12, width * 0.016)}px system-ui, sans-serif`;
    ctx.fillText("Charged Particle in Crossed E and B Fields", width / 2, 50);

    // Time
    ctx.fillStyle = "rgba(148,163,184,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(2)} s`, 15, 20);
  }

  function reset(): void {
    resetState();
  }

  function destroy(): void {
    trail = [];
  }

  function getStateDescription(): string {
    const speed = Math.sqrt(vx * vx + vy * vy);
    const absB = Math.abs(Bfield);
    const rc = absB > 0.001 ? (mass * speed) / (Math.abs(charge) * absB) : Infinity;
    const cyclFreq = absB > 0.001 ? (Math.abs(charge) * absB) / mass : 0;
    return (
      `Lorentz Force: q=${charge}C, m=${mass}kg, E=${Efield}V/m (y), B=${Bfield}T (z). ` +
      `Position: (${px.toFixed(2)}, ${py.toFixed(2)})m. Velocity: (${vx.toFixed(2)}, ${vy.toFixed(2)})m/s, |v|=${speed.toFixed(2)}m/s. ` +
      `Cyclotron radius: ${rc < 1000 ? rc.toFixed(2) : "inf"}m. Cyclotron freq: ${cyclFreq.toFixed(2)}rad/s. ` +
      `The particle curves due to F=q(v x B). With E present, the particle drifts in the E x B direction.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LorentzForceFactory;
