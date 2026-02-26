import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const tidalForcesFactory: SimulationFactory = () => {
  const config = getSimConfig("tidal-forces")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let primaryMass = 1;
  let secondaryMass = 0.1;
  let separationDistance = 3;
  let objectRadius = 0.3;

  // Tidal force vectors on secondary body surface
  function tidalAccel(dx: number, dy: number, R: number, M: number): { ax: number; ay: number } {
    // Differential gravity: a_tidal ≈ 2GMr/R³ (radial), -GMr/R³ (transverse)
    // dx, dy relative to secondary center; R = separation
    const R3 = R * R * R;
    return { ax: (2 * M * dx) / R3, ay: (-M * dy) / R3 };
  }

  function rocheLimit(): number {
    // R_Roche ≈ 2.44 * R_primary * (ρ_primary / ρ_secondary)^(1/3)
    // Simplified: assuming same density → R_Roche ≈ 2.44 * R_primary * (M_primary/M_secondary)^(1/3)
    const rPrimary = Math.pow(primaryMass, 1 / 3) * 0.5;
    return 2.44 * rPrimary * Math.pow(primaryMass / secondaryMass, 1 / 3) * 0.3;
  }

  function drawPrimary(cx: number, cy: number, r: number) {
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, "#fbbf24");
    grad.addColorStop(0.6, "#f59e0b");
    grad.addColorStop(1, "#b45309");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.5);
    glow.addColorStop(0, "rgba(251, 191, 36, 0.2)");
    glow.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.font = "12px Arial";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.fillText(`M = ${primaryMass.toFixed(1)}`, cx, cy + r + 18);
  }

  function drawSecondary(cx: number, cy: number, r: number, primaryCx: number) {
    // Calculate tidal deformation
    const rl = rocheLimit();
    const withinRoche = separationDistance < rl;
    const deformFactor = Math.min(2, 1 + (primaryMass / (separationDistance * separationDistance * separationDistance)) * 3);

    // Draw deformed body (ellipse)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * deformFactor, r / Math.sqrt(deformFactor), 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r * deformFactor);
    grad.addColorStop(0, withinRoche ? "#ef4444" : "#60a5fa");
    grad.addColorStop(0.7, withinRoche ? "#b91c1c" : "#2563eb");
    grad.addColorStop(1, withinRoche ? "#7f1d1d" : "#1e3a8a");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Tidal force arrows
    const arrowScale = 35;
    const numArrows = 12;
    for (let i = 0; i < numArrows; i++) {
      const angle = (i / numArrows) * Math.PI * 2;
      const px = objectRadius * 0.8 * Math.cos(angle);
      const py = objectRadius * 0.8 * Math.sin(angle);
      const { ax, ay } = tidalAccel(px, py, separationDistance, primaryMass);
      const screenPx = cx + px * r * 2.5;
      const screenPy = cy + py * r * 2.5;
      const arrowDx = ax * arrowScale;
      const arrowDy = ay * arrowScale;

      ctx.strokeStyle = withinRoche ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screenPx, screenPy);
      ctx.lineTo(screenPx + arrowDx, screenPy + arrowDy);
      ctx.stroke();

      // Arrowhead
      const len = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);
      if (len > 3) {
        const nx = arrowDx / len;
        const ny = arrowDy / len;
        ctx.beginPath();
        ctx.moveTo(screenPx + arrowDx, screenPy + arrowDy);
        ctx.lineTo(screenPx + arrowDx - nx * 6 - ny * 3, screenPy + arrowDy - ny * 6 + nx * 3);
        ctx.lineTo(screenPx + arrowDx - nx * 6 + ny * 3, screenPy + arrowDy - ny * 6 - nx * 3);
        ctx.closePath();
        ctx.fillStyle = withinRoche ? "rgba(239, 68, 68, 0.7)" : "rgba(34, 197, 94, 0.7)";
        ctx.fill();
      }
    }

    ctx.font = "12px Arial";
    ctx.fillStyle = "#60a5fa";
    ctx.textAlign = "center";
    ctx.fillText(`m = ${secondaryMass.toFixed(2)}`, cx, cy + r * deformFactor + 22);
  }

  function drawRocheLimit(primaryCx: number, cy: number) {
    const rl = rocheLimit();
    const scale = Math.min(W, H) * 0.08;
    const rlPx = rl * scale;

    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(primaryCx, cy, rlPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "11px Arial";
    ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
    ctx.textAlign = "center";
    ctx.fillText("Roche Limit", primaryCx + rlPx + 5, cy - 10);
  }

  function drawGraph() {
    const gx = W * 0.05, gy = H * 0.65, gw = W * 0.9, gh = H * 0.3;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Tidal Force vs Distance (F_tidal ∝ M/r³)", gx + gw / 2, gy + 16);

    // Plot F_tidal = 2GM*objectRadius / r³
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const rMin = 1.0, rMax = 5.0;
    for (let i = 0; i <= 100; i++) {
      const r = rMin + (i / 100) * (rMax - rMin);
      const f = (2 * primaryMass * objectRadius) / (r * r * r);
      const px = gx + 40 + ((r - rMin) / (rMax - rMin)) * (gw - 60);
      const maxF = (2 * primaryMass * objectRadius) / (rMin * rMin * rMin);
      const py = gy + gh - 20 - (f / maxF) * (gh - 40);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Mark current position
    const curF = (2 * primaryMass * objectRadius) / (separationDistance ** 3);
    const maxF = (2 * primaryMass * objectRadius) / (rMin ** 3);
    const curX = gx + 40 + ((separationDistance - rMin) / (rMax - rMin)) * (gw - 60);
    const curY = gy + gh - 20 - (curF / maxF) * (gh - 40);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "10px Arial";
    ctx.fillStyle = "#facc15";
    ctx.fillText(`r = ${separationDistance.toFixed(1)}`, curX + 10, curY - 5);

    // Roche limit line
    const rl = rocheLimit();
    if (rl >= rMin && rl <= rMax) {
      const rlX = gx + 40 + ((rl - rMin) / (rMax - rMin)) * (gw - 60);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(rlX, gy + 25);
      ctx.lineTo(rlX, gy + gh - 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ef4444";
      ctx.font = "10px Arial";
      ctx.fillText("Roche", rlX, gy + gh - 5);
    }

    // Axes labels
    ctx.font = "10px Arial";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Distance (r)", gx + gw / 2, gy + gh - 3);
    ctx.save();
    ctx.translate(gx + 12, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("F_tidal", 0, 0);
    ctx.restore();
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c;
      ctx = c.getContext("2d")!;
      W = c.width;
      H = c.height;
      time = 0;
    },
    update(dt, params) {
      primaryMass = params.primaryMass ?? primaryMass;
      secondaryMass = params.secondaryMass ?? secondaryMass;
      separationDistance = params.separationDistance ?? separationDistance;
      objectRadius = params.objectRadius ?? objectRadius;
      time += dt;
    },
    render() {
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Tidal Forces", W / 2, 28);

      const scale = Math.min(W, H) * 0.08;
      const cy = H * 0.32;
      const primaryCx = W * 0.3;
      const secondaryCx = primaryCx + separationDistance * scale;
      const primaryR = Math.pow(primaryMass, 1 / 3) * 25;
      const secondaryR = Math.pow(secondaryMass, 1 / 3) * 25;

      drawRocheLimit(primaryCx, cy);
      drawPrimary(primaryCx, cy, primaryR);
      drawSecondary(secondaryCx, cy, secondaryR, primaryCx);

      // Connecting line
      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(primaryCx + primaryR, cy);
      ctx.lineTo(secondaryCx - secondaryR * 2, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Distance label
      ctx.font = "12px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText(`d = ${separationDistance.toFixed(1)}`, (primaryCx + secondaryCx) / 2, cy - 40);

      // Roche limit status
      const rl = rocheLimit();
      const withinRoche = separationDistance < rl;
      ctx.font = "bold 13px Arial";
      ctx.fillStyle = withinRoche ? "#ef4444" : "#22c55e";
      ctx.textAlign = "left";
      ctx.fillText(
        withinRoche ? "⚠ WITHIN ROCHE LIMIT — Tidal disruption!" : "✓ Outside Roche limit — Stable orbit",
        15,
        H * 0.58
      );
      ctx.font = "11px Arial";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`Roche limit: ${rl.toFixed(2)} units`, 15, H * 0.58 + 16);

      drawGraph();

      // Formula
      ctx.font = "11px monospace";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("F_tidal ∝ M·r / R³    |    R_Roche ≈ 2.44·R₁·(ρ₁/ρ₂)^(1/3)", W / 2, H - 5);
    },
    reset() {
      time = 0;
    },
    destroy() {},
    getStateDescription() {
      const rl = rocheLimit();
      const withinRoche = separationDistance < rl;
      const tidalF = (2 * primaryMass * objectRadius) / (separationDistance ** 3);
      return `Tidal forces: primary mass ${primaryMass.toFixed(1)} M, secondary mass ${secondaryMass.toFixed(2)} M, separation ${separationDistance.toFixed(1)} units. Roche limit at ${rl.toFixed(2)} units. ${withinRoche ? "Object is WITHIN Roche limit — tidal disruption occurring!" : "Object is stable outside Roche limit."} Tidal force magnitude: ${tidalF.toFixed(4)}.`;
    },
    resize(w, h) {
      W = w;
      H = h;
    },
  };
  return engine;
};

export default tidalForcesFactory;
