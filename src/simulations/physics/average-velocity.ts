import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Factory ─────────────────────────────────────────────────────────
const AverageVelocityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("average-velocity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let totalDistance = 50;
  let totalTime = 10;
  let speedVariation = 50;
  let showTangent = 1;

  // Pre-generated motion curve control points (regenerated on reset)
  // We use a smooth spline through waypoints to create variable-speed motion
  let waypoints: { t: number; x: number }[] = [];
  const NUM_WAYPOINTS = 10;

  function generateWaypoints(): void {
    waypoints = [];
    // Always start at (0, 0) and end at (totalTime, totalDistance)
    waypoints.push({ t: 0, x: 0 });

    const variation = speedVariation / 100;

    // Generate intermediate waypoints with controlled randomness
    for (let i = 1; i < NUM_WAYPOINTS; i++) {
      const tFrac = i / NUM_WAYPOINTS;
      const tVal = tFrac * totalTime;
      // Expected position at this fraction (linear)
      const xLinear = tFrac * totalDistance;
      // Add variation: sinusoidal + random perturbation
      const sinComponent = Math.sin(tFrac * Math.PI * 2) * totalDistance * 0.15 * variation;
      const randomComponent = (Math.random() - 0.5) * totalDistance * 0.2 * variation;
      let xVal = xLinear + sinComponent + randomComponent;
      // Ensure monotonically increasing (object doesn't go backward)
      const prevX = waypoints[waypoints.length - 1].x;
      xVal = Math.max(prevX + totalDistance * 0.01, xVal);
      xVal = Math.min(totalDistance * 0.98, xVal);
      waypoints.push({ t: tVal, x: xVal });
    }

    waypoints.push({ t: totalTime, x: totalDistance });
  }

  // Cubic Hermite interpolation for smooth position
  function hermite(t0: number, x0: number, m0: number, t1: number, x1: number, m1: number, t: number): number {
    const dt = t1 - t0;
    if (dt === 0) return x0;
    const s = (t - t0) / dt;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    return h00 * x0 + h10 * dt * m0 + h01 * x1 + h11 * dt * m1;
  }

  // Get position at any time using monotone cubic interpolation
  function positionAtTime(t: number): number {
    if (t <= 0) return 0;
    if (t >= totalTime) return totalDistance;

    // Find surrounding waypoints
    let i = 0;
    while (i < waypoints.length - 1 && waypoints[i + 1].t < t) i++;
    if (i >= waypoints.length - 1) return totalDistance;

    const p0 = waypoints[i];
    const p1 = waypoints[i + 1];

    // Compute tangent slopes (finite differences with Catmull-Rom style)
    function slope(idx: number): number {
      if (idx <= 0) {
        return (waypoints[1].x - waypoints[0].x) / (waypoints[1].t - waypoints[0].t);
      }
      if (idx >= waypoints.length - 1) {
        const n = waypoints.length - 1;
        return (waypoints[n].x - waypoints[n - 1].x) / (waypoints[n].t - waypoints[n - 1].t);
      }
      return (waypoints[idx + 1].x - waypoints[idx - 1].x) / (waypoints[idx + 1].t - waypoints[idx - 1].t);
    }

    const m0 = slope(i);
    const m1 = slope(i + 1);

    return hermite(p0.t, p0.x, m0, p1.t, p1.x, m1, t);
  }

  // Instantaneous velocity (numerical derivative)
  function velocityAtTime(t: number): number {
    const epsilon = 0.01;
    const x1 = positionAtTime(t - epsilon);
    const x2 = positionAtTime(t + epsilon);
    return (x2 - x1) / (2 * epsilon);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    generateWaypoints();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newDist = params.totalDistance ?? 50;
    const newTime = params.totalTime ?? 10;
    const newVariation = params.speedVariation ?? 50;
    showTangent = params.showTangent ?? 1;

    // Regenerate waypoints if fundamental parameters changed
    if (newDist !== totalDistance || newTime !== totalTime || newVariation !== speedVariation) {
      totalDistance = newDist;
      totalTime = newTime;
      speedVariation = newVariation;
      generateWaypoints();
    }

    time += dt;
    // Loop the animation
    if (time > totalTime + 1) {
      time = 0;
    }
  }

  function render(): void {
    if (!ctx) return;

    // ── Background gradient ─────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // ── Title ───────────────────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Average vs Instantaneous Velocity", width / 2, 24);

    // ── Layout: top half = road, bottom half = graph ─
    const dividerY = height * 0.42;
    const roadTop = 40;
    const roadBottom = dividerY - 20;
    const graphTop = dividerY + 20;
    const graphBottom = height - 60;
    const graphLeft = 80;
    const graphRight = width - 40;
    const graphWidth = graphRight - graphLeft;
    const graphHeight = graphBottom - graphTop;

    // Current time clamped
    const tCurrent = Math.min(time, totalTime);
    const currentPos = positionAtTime(tCurrent);
    const currentVel = velocityAtTime(tCurrent);
    const avgVelocity = tCurrent > 0.01 ? currentPos / tCurrent : 0;

    // ═══════════════════════════════════════════════════
    // ── TOP HALF: Road/Track visualization ──────────
    // ═══════════════════════════════════════════════════

    const roadY = (roadTop + roadBottom) / 2;
    const roadH = 40;
    const trackLeft = 60;
    const trackRight = width - 60;
    const trackWidth = trackRight - trackLeft;

    // Road background
    const roadGrad = ctx.createLinearGradient(0, roadY - roadH / 2, 0, roadY + roadH / 2);
    roadGrad.addColorStop(0, "rgba(50, 55, 70, 0.8)");
    roadGrad.addColorStop(0.5, "rgba(60, 65, 80, 0.9)");
    roadGrad.addColorStop(1, "rgba(50, 55, 70, 0.8)");
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.roundRect(trackLeft - 10, roadY - roadH / 2, trackWidth + 20, roadH, 6);
    ctx.fill();

    // Road border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(trackLeft - 10, roadY - roadH / 2, trackWidth + 20, roadH, 6);
    ctx.stroke();

    // Road dashes (center line)
    ctx.strokeStyle = "rgba(255, 200, 50, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 10]);
    ctx.beginPath();
    ctx.moveTo(trackLeft, roadY);
    ctx.lineTo(trackRight, roadY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance markers along the road
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    const distMarkerCount = 5;
    for (let i = 0; i <= distMarkerCount; i++) {
      const frac = i / distMarkerCount;
      const mx = trackLeft + frac * trackWidth;
      const mDist = frac * totalDistance;
      ctx.fillText(`${mDist.toFixed(0)}m`, mx, roadY + roadH / 2 + 14);
      // Tick
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, roadY + roadH / 2 - 4);
      ctx.lineTo(mx, roadY + roadH / 2 + 2);
      ctx.stroke();
    }

    // Moving object (circle)
    const objFrac = currentPos / totalDistance;
    const objX = trackLeft + objFrac * trackWidth;
    const objY = roadY - 4;
    const objRadius = 14;

    // Object glow
    const objGlow = ctx.createRadialGradient(objX, objY, 0, objX, objY, objRadius * 3);
    objGlow.addColorStop(0, "rgba(80, 200, 255, 0.3)");
    objGlow.addColorStop(1, "rgba(80, 200, 255, 0)");
    ctx.beginPath();
    ctx.arc(objX, objY, objRadius * 3, 0, Math.PI * 2);
    ctx.fillStyle = objGlow;
    ctx.fill();

    // Object body
    const objBodyGrad = ctx.createRadialGradient(objX - 3, objY - 3, 0, objX, objY, objRadius);
    objBodyGrad.addColorStop(0, "#ffffff");
    objBodyGrad.addColorStop(0.3, "#50c8ff");
    objBodyGrad.addColorStop(1, "#2060a0");
    ctx.beginPath();
    ctx.arc(objX, objY, objRadius, 0, Math.PI * 2);
    ctx.fillStyle = objBodyGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Velocity arrow on the object
    if (currentVel > 0.1) {
      const arrowLen = Math.min(currentVel * 3, 60);
      ctx.strokeStyle = "#ffaa00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(objX + objRadius + 4, objY);
      ctx.lineTo(objX + objRadius + 4 + arrowLen, objY);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.moveTo(objX + objRadius + 4 + arrowLen, objY);
      ctx.lineTo(objX + objRadius + arrowLen - 2, objY - 5);
      ctx.lineTo(objX + objRadius + arrowLen - 2, objY + 5);
      ctx.closePath();
      ctx.fill();
    }

    // Trail behind the object
    ctx.strokeStyle = "rgba(80, 200, 255, 0.15)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(trackLeft, roadY - 4);
    const trailSteps = 40;
    for (let i = 1; i <= trailSteps; i++) {
      const tFrac = (i / trailSteps) * tCurrent;
      const pFrac = positionAtTime(tFrac) / totalDistance;
      const px = trackLeft + pFrac * trackWidth;
      ctx.lineTo(px, roadY - 4);
    }
    ctx.stroke();

    // ── Divider line ────────────────────────────────
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, dividerY);
    ctx.lineTo(width - 20, dividerY);
    ctx.stroke();

    // ═══════════════════════════════════════════════════
    // ── BOTTOM HALF: Position-Time Graph ────────────
    // ═══════════════════════════════════════════════════

    // Graph background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(graphLeft, graphTop, graphWidth, graphHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphLeft, graphTop, graphWidth, graphHeight);

    // Axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time (s)", graphLeft + graphWidth / 2, graphBottom + 30);
    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(graphLeft - 40, graphTop + graphHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Position (m)", 0, 0);
    ctx.restore();

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 0.5;
    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";

    // Time axis grid
    ctx.textAlign = "center";
    const tStep = totalTime <= 5 ? 1 : totalTime <= 12 ? 2 : 5;
    for (let t = 0; t <= totalTime; t += tStep) {
      const x = graphLeft + (t / totalTime) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, graphTop);
      ctx.lineTo(x, graphBottom);
      ctx.stroke();
      ctx.fillText(`${t}`, x, graphBottom + 14);
    }

    // Position axis grid
    ctx.textAlign = "right";
    const xStep = totalDistance <= 20 ? 5 : totalDistance <= 60 ? 10 : 20;
    for (let x = 0; x <= totalDistance; x += xStep) {
      const y = graphBottom - (x / totalDistance) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(graphLeft, y);
      ctx.lineTo(graphRight, y);
      ctx.stroke();
      ctx.fillText(`${x}`, graphLeft - 6, y + 3);
    }

    // ── Draw the position-time curve ────────────────
    ctx.beginPath();
    ctx.strokeStyle = "#50c8ff";
    ctx.lineWidth = 2.5;
    const curveSteps = 200;
    for (let i = 0; i <= curveSteps; i++) {
      const tVal = (i / curveSteps) * totalTime;
      const xVal = positionAtTime(tVal);
      const px = graphLeft + (tVal / totalTime) * graphWidth;
      const py = graphBottom - (xVal / totalDistance) * graphHeight;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // ── Average velocity dashed line (origin to current point) ──
    const startPx = graphLeft;
    const startPy = graphBottom;
    const endPx = graphLeft + (tCurrent / totalTime) * graphWidth;
    const endPy = graphBottom - (currentPos / totalDistance) * graphHeight;

    ctx.strokeStyle = "#ff6644";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(startPx, startPy);
    ctx.lineTo(endPx, endPy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label the average velocity line
    const avgLabelX = (startPx + endPx) / 2;
    const avgLabelY = (startPy + endPy) / 2 - 10;
    ctx.fillStyle = "#ff6644";
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`v_avg = ${avgVelocity.toFixed(2)} m/s`, avgLabelX, avgLabelY);

    // ── Tangent line at current time ────────────────
    if (showTangent >= 0.5 && tCurrent > 0.1 && tCurrent < totalTime - 0.1) {
      const slope = currentVel; // dx/dt in m/s
      // Draw tangent extending +/- some time range
      const tangentRange = totalTime * 0.12;
      const t1 = tCurrent - tangentRange;
      const t2 = tCurrent + tangentRange;
      const x1 = currentPos - slope * tangentRange;
      const x2 = currentPos + slope * tangentRange;

      const tx1 = graphLeft + (t1 / totalTime) * graphWidth;
      const ty1 = graphBottom - (x1 / totalDistance) * graphHeight;
      const tx2 = graphLeft + (t2 / totalTime) * graphWidth;
      const ty2 = graphBottom - (x2 / totalDistance) * graphHeight;

      ctx.strokeStyle = "#44ff88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo(tx2, ty2);
      ctx.stroke();

      // Label
      ctx.fillStyle = "#44ff88";
      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`v_inst = ${currentVel.toFixed(2)} m/s`, tx2 + 6, ty2 - 4);
    }

    // ── Current point marker on graph ───────────────
    const cpx = graphLeft + (tCurrent / totalTime) * graphWidth;
    const cpy = graphBottom - (currentPos / totalDistance) * graphHeight;

    // Glow
    const cpGlow = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, 12);
    cpGlow.addColorStop(0, "rgba(80, 200, 255, 0.5)");
    cpGlow.addColorStop(1, "rgba(80, 200, 255, 0)");
    ctx.beginPath();
    ctx.arc(cpx, cpy, 12, 0, Math.PI * 2);
    ctx.fillStyle = cpGlow;
    ctx.fill();

    // Point
    ctx.beginPath();
    ctx.arc(cpx, cpy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#50c8ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crosshair lines from point to axes
    ctx.strokeStyle = "rgba(80, 200, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    // Vertical to time axis
    ctx.beginPath();
    ctx.moveTo(cpx, cpy);
    ctx.lineTo(cpx, graphBottom);
    ctx.stroke();
    // Horizontal to position axis
    ctx.beginPath();
    ctx.moveTo(cpx, cpy);
    ctx.lineTo(graphLeft, cpy);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Legend ───────────────────────────────────────
    const legendX = graphLeft + 10;
    const legendY = graphTop + 16;
    ctx.font = "10px 'Inter', system-ui, sans-serif";

    // x-t curve
    ctx.strokeStyle = "#50c8ff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = "#50c8ff";
    ctx.textAlign = "left";
    ctx.fillText("x(t) curve", legendX + 24, legendY + 3);

    // Average velocity
    ctx.strokeStyle = "#ff6644";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 16);
    ctx.lineTo(legendX + 20, legendY + 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ff6644";
    ctx.fillText("Average velocity (\u0394x/\u0394t)", legendX + 24, legendY + 19);

    // Tangent
    if (showTangent >= 0.5) {
      ctx.strokeStyle = "#44ff88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX, legendY + 32);
      ctx.lineTo(legendX + 20, legendY + 32);
      ctx.stroke();
      ctx.fillStyle = "#44ff88";
      ctx.fillText("Instantaneous velocity (tangent slope)", legendX + 24, legendY + 35);
    }

    // ── Data display ────────────────────────────────
    const dataY = graphBottom + 40;
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.fillStyle = "#50c8ff";
    ctx.fillText(`Position: ${currentPos.toFixed(1)} m`, 12, dataY);

    ctx.fillStyle = "#ff6644";
    ctx.fillText(`Avg Velocity: ${avgVelocity.toFixed(2)} m/s`, 200, dataY);

    ctx.fillStyle = "#44ff88";
    ctx.fillText(`Inst. Velocity: ${currentVel.toFixed(2)} m/s`, 420, dataY);

    // ── Formula annotation ──────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      "v_avg = \u0394x / \u0394t   |   v_inst = dx/dt = lim(\u0394t\u21920) \u0394x/\u0394t",
      12,
      height - 30
    );

    // ── Time display ────────────────────────────────
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    generateWaypoints();
  }

  function destroy(): void {
    waypoints = [];
  }

  function getStateDescription(): string {
    const tCurrent = Math.min(time, totalTime);
    const currentPos = positionAtTime(tCurrent);
    const currentVel = velocityAtTime(tCurrent);
    const avgVelocity = tCurrent > 0.01 ? currentPos / tCurrent : 0;
    return (
      `Average Velocity simulation: total distance = ${totalDistance} m, total time = ${totalTime} s, ` +
      `speed variation = ${speedVariation}%. ` +
      `Current time: ${tCurrent.toFixed(2)} s, position: ${currentPos.toFixed(1)} m. ` +
      `Average velocity (Δx/Δt): ${avgVelocity.toFixed(2)} m/s. ` +
      `Instantaneous velocity (dx/dt): ${currentVel.toFixed(2)} m/s. ` +
      `The position-time curve shows non-uniform motion. ` +
      `Average velocity is the slope of the secant line from origin to current point. ` +
      `Instantaneous velocity is the slope of the tangent to the x-t curve.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default AverageVelocityFactory;
