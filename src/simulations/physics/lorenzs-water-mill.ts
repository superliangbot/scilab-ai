import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Lorenz Water Mill (Malkus Waterwheel)
 *
 * A physical analog of the Lorenz attractor:
 * - Water pours onto the top bucket of a wheel with leaky buckets
 * - At low flow: wheel stationary (water leaks as fast as it fills)
 * - At medium flow: steady rotation in one direction
 * - At high flow: chaotic reversals of rotation direction
 *
 * Governed by equations analogous to the Lorenz system:
 *   d(theta)/dt = omega
 *   d(omega)/dt = -(friction)*omega + (gravity torque from water distribution)
 *   d(water_i)/dt = inflow_i - leak_rate * water_i
 */

interface Bucket {
  angle: number;      // position on wheel (rad)
  water: number;      // water level (0 to maxWater)
}

interface PhasePoint {
  omega: number;
  torque: number;
}

const LorenzWaterMillFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("lorenzs-water-mill") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Wheel state
  let theta = 0;       // wheel angle (rad)
  let omega = 0;       // angular velocity (rad/s)
  let buckets: Bucket[] = [];

  // Parameters
  let flowRate = 3.0;       // water inflow rate
  let leakRate = 1.0;       // water leak rate from buckets
  let friction = 0.5;       // rotational friction
  let numBuckets = 8;       // number of buckets
  const maxWater = 5.0;     // max water per bucket
  const gravity = 9.81;
  const wheelRadius = 1.0;  // normalized

  // Phase space history
  let phaseHistory: PhasePoint[] = [];
  const MAX_PHASE = 600;

  // Omega history for time series
  let omegaHistory: { t: number; omega: number }[] = [];
  const MAX_OMEGA_HIST = 300;

  // Drawing dimensions
  let wheelCx = 0;
  let wheelCy = 0;
  let wheelR = 0;

  function initBuckets(): void {
    buckets = [];
    for (let i = 0; i < numBuckets; i++) {
      buckets.push({
        angle: (2 * Math.PI * i) / numBuckets,
        water: 0,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;

    wheelCx = width * 0.33;
    wheelCy = height * 0.45;
    wheelR = Math.min(width * 0.22, height * 0.32);

    resetState();
  }

  function resetState(): void {
    time = 0;
    theta = 0;
    omega = 0.01; // tiny nudge to break symmetry
    initBuckets();
    phaseHistory = [];
    omegaHistory = [];
  }

  function computeTorque(): number {
    // Torque from gravity acting on water mass at each bucket position
    // tau = sum_i ( m_i * g * R * sin(bucket_world_angle) )
    // where bucket_world_angle is measured from top (0 = top, pi = bottom)
    let torque = 0;
    for (const bucket of buckets) {
      const worldAngle = bucket.angle + theta;
      // sin(worldAngle) gives horizontal displacement, but for torque
      // we need the tangential component:
      // Gravity pulls down, tangential force = m*g*sin(worldAngle from top)
      // Torque contribution = -m * g * R * sin(worldAngle)
      // (negative because gravity on right side pulls clockwise for our convention)
      torque -= bucket.water * gravity * wheelRadius * Math.sin(worldAngle);
    }
    return torque;
  }

  function update(dt: number, params: Record<string, number>): void {
    flowRate = params.flowRate ?? 3.0;
    leakRate = params.leakRate ?? 1.0;
    friction = params.friction ?? 0.5;
    const newNumBuckets = Math.round(params.numBuckets ?? 8);

    if (newNumBuckets !== numBuckets) {
      numBuckets = Math.max(4, Math.min(20, newNumBuckets));
      initBuckets();
    }

    // Sub-stepping for stability
    const subSteps = 30;
    const subDt = Math.min(dt, 0.016) / subSteps;

    for (let s = 0; s < subSteps; s++) {
      // --- Water dynamics ---
      for (const bucket of buckets) {
        const worldAngle = bucket.angle + theta;

        // Inflow: water pours from the top. Distribution is a narrow Gaussian
        // centered at the top of the wheel (worldAngle ~ 0 mod 2pi)
        // Normalize angle to [0, 2pi)
        let normAngle = ((worldAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        // Distance from top (angle = 0)
        const distFromTop = Math.min(normAngle, 2 * Math.PI - normAngle);
        // Gaussian inflow centered at top
        const inflowWidth = 0.5; // radians
        const inflow = flowRate * Math.exp(-(distFromTop * distFromTop) / (2 * inflowWidth * inflowWidth));

        // Update water: inflow - leak
        bucket.water += (inflow - leakRate * bucket.water) * subDt;
        bucket.water = Math.max(0, Math.min(maxWater, bucket.water));
      }

      // --- Rotational dynamics ---
      const torque = computeTorque();
      // Moment of inertia (proportional to total water mass on wheel + wheel itself)
      let totalMass = 1.0; // wheel mass
      for (const bucket of buckets) {
        totalMass += bucket.water;
      }
      const I = totalMass * wheelRadius * wheelRadius;

      // Angular acceleration: alpha = (torque - friction * omega) / I
      const alpha = (torque - friction * omega) / I;

      // Symplectic Euler
      omega += alpha * subDt;
      theta += omega * subDt;
    }

    // Keep theta in reasonable range
    theta = theta % (2 * Math.PI * 100);

    time += dt;

    // Record phase space
    const torque = computeTorque();
    phaseHistory.push({ omega, torque });
    if (phaseHistory.length > MAX_PHASE) phaseHistory.shift();

    omegaHistory.push({ t: time, omega });
    if (omegaHistory.length > MAX_OMEGA_HIST) omegaHistory.shift();
  }

  function drawWaterStream(): void {
    // Water pouring from top
    const streamX = wheelCx;
    const streamTopY = wheelCy - wheelR - 60;
    const streamBottomY = wheelCy - wheelR + 5;

    // Stream width depends on flow rate
    const streamWidth = 3 + flowRate * 1.5;

    const grad = ctx.createLinearGradient(streamX, streamTopY, streamX, streamBottomY);
    grad.addColorStop(0, "rgba(56,189,248,0.8)");
    grad.addColorStop(1, "rgba(56,189,248,0.3)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(streamX - streamWidth / 2, streamTopY);
    ctx.lineTo(streamX + streamWidth / 2, streamTopY);
    ctx.lineTo(streamX + streamWidth / 2 + 2, streamBottomY);
    ctx.lineTo(streamX - streamWidth / 2 - 2, streamBottomY);
    ctx.closePath();
    ctx.fill();

    // Faucet
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.roundRect(streamX - 15, streamTopY - 12, 30, 14, 4);
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.roundRect(streamX - 8, streamTopY - 25, 16, 16, 3);
    ctx.fill();

    // Dripping particles
    for (let i = 0; i < Math.min(flowRate * 2, 10); i++) {
      const t = ((time * 3 + i * 0.7) % 1);
      const dropY = streamTopY + t * (streamBottomY - streamTopY);
      const dropX = streamX + Math.sin(i * 2.3) * streamWidth * 0.3;
      ctx.fillStyle = `rgba(56,189,248,${(1 - t) * 0.5})`;
      ctx.beginPath();
      ctx.arc(dropX, dropY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWheel(): void {
    // Wheel rim
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(wheelCx, wheelCy, wheelR, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = "rgba(100,116,139,0.4)";
    ctx.lineWidth = 2;
    for (const bucket of buckets) {
      const worldAngle = bucket.angle + theta;
      const sx = wheelCx + Math.sin(worldAngle) * 10;
      const sy = wheelCy - Math.cos(worldAngle) * 10;
      const ex = wheelCx + Math.sin(worldAngle) * (wheelR - 5);
      const ey = wheelCy - Math.cos(worldAngle) * (wheelR - 5);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // Hub
    const hubGrad = ctx.createRadialGradient(wheelCx, wheelCy, 0, wheelCx, wheelCy, 15);
    hubGrad.addColorStop(0, "#94a3b8");
    hubGrad.addColorStop(1, "#475569");
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(wheelCx, wheelCy, 12, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator on hub
    const arrowAngle = theta;
    const arrowLen = 8;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wheelCx, wheelCy);
    ctx.lineTo(
      wheelCx + Math.sin(arrowAngle) * arrowLen,
      wheelCy - Math.cos(arrowAngle) * arrowLen
    );
    ctx.stroke();

    // Buckets
    const bucketSize = Math.max(14, wheelR * 0.18);
    for (const bucket of buckets) {
      const worldAngle = bucket.angle + theta;
      const bx = wheelCx + Math.sin(worldAngle) * wheelR;
      const by = wheelCy - Math.cos(worldAngle) * wheelR;

      // Bucket container (trapezoid shape)
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(worldAngle);

      // Bucket outline
      const bw = bucketSize;
      const bh = bucketSize * 1.2;
      ctx.fillStyle = "#334155";
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.5, -bh * 0.4);
      ctx.lineTo(bw * 0.5, -bh * 0.4);
      ctx.lineTo(bw * 0.4, bh * 0.5);
      ctx.lineTo(-bw * 0.4, bh * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Water fill level
      const fillFraction = bucket.water / maxWater;
      if (fillFraction > 0.01) {
        const waterHeight = fillFraction * bh * 0.8;
        const waterBottom = bh * 0.5;
        const waterTop = waterBottom - waterHeight;
        // Interpolate width at water top
        const topWidth = bw * 0.4 + (bw * 0.1) * (1 - fillFraction);
        const botWidth = bw * 0.4;

        const waterGrad = ctx.createLinearGradient(0, waterTop, 0, waterBottom);
        waterGrad.addColorStop(0, "rgba(56,189,248,0.7)");
        waterGrad.addColorStop(1, "rgba(14,116,144,0.9)");
        ctx.fillStyle = waterGrad;
        ctx.beginPath();
        ctx.moveTo(-topWidth, waterTop);
        ctx.lineTo(topWidth, waterTop);
        ctx.lineTo(botWidth, waterBottom);
        ctx.lineTo(-botWidth, waterBottom);
        ctx.closePath();
        ctx.fill();
      }

      // Leak drops
      if (bucket.water > 0.1) {
        const leakAlpha = Math.min(1, bucket.water / maxWater);
        ctx.fillStyle = `rgba(56,189,248,${(leakAlpha * 0.4).toFixed(2)})`;
        for (let d = 0; d < 2; d++) {
          const dropOff = bh * 0.5 + 3 + ((time * 5 + d * 1.7 + bucket.angle * 3) % 1) * 10;
          ctx.beginPath();
          ctx.arc((d - 0.5) * bw * 0.2, dropOff, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  function drawRotationInfo(): void {
    const panelX = 15;
    const panelY = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 195, 100, 8);
    ctx.fill();

    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";

    // Direction
    const direction = Math.abs(omega) < 0.05 ? "Stationary" : omega > 0 ? "Clockwise" : "Counter-CW";
    const dirColor = Math.abs(omega) < 0.05 ? "#94a3b8" : omega > 0 ? "#f97316" : "#a78bfa";
    ctx.fillStyle = dirColor;
    ctx.fillText(`Rotation: ${direction}`, panelX + 12, panelY + 22);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`\u03C9 = ${omega.toFixed(3)} rad/s`, panelX + 12, panelY + 44);
    ctx.fillText(`Flow rate = ${flowRate.toFixed(1)}`, panelX + 12, panelY + 62);
    ctx.fillText(`Leak rate = ${leakRate.toFixed(1)}`, panelX + 12, panelY + 78);

    // Regime indicator
    const ratio = flowRate / Math.max(0.01, leakRate * friction);
    let regime = "Sub-critical (stationary)";
    let regimeColor = "#94a3b8";
    if (ratio > 3.0) {
      regime = "Chaotic (reversals)";
      regimeColor = "#ef4444";
    } else if (ratio > 1.0) {
      regime = "Steady rotation";
      regimeColor = "#22c55e";
    }
    ctx.fillStyle = regimeColor;
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(regime, panelX + 12, panelY + 95);
  }

  function drawPhaseSpace(): void {
    const graphX = width * 0.62;
    const graphY = height * 0.08;
    const graphW = width * 0.34;
    const graphH = height * 0.38;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(graphX, graphY, graphW, graphH, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Phase Space", graphX + graphW / 2, graphY + 20);

    if (phaseHistory.length < 2) return;

    const plotX = graphX + 40;
    const plotY = graphY + 30;
    const plotW = graphW - 55;
    const plotH = graphH - 50;

    // Find ranges
    let maxOmega = 0.1;
    let maxTorque = 0.1;
    for (const p of phaseHistory) {
      maxOmega = Math.max(maxOmega, Math.abs(p.omega));
      maxTorque = Math.max(maxTorque, Math.abs(p.torque));
    }
    maxOmega *= 1.1;
    maxTorque *= 1.1;

    // Grid and axes
    ctx.strokeStyle = "rgba(100,116,139,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Horizontal center line
    ctx.moveTo(plotX, plotY + plotH / 2);
    ctx.lineTo(plotX + plotW, plotY + plotH / 2);
    // Vertical center line
    ctx.moveTo(plotX + plotW / 2, plotY);
    ctx.lineTo(plotX + plotW / 2, plotY + plotH);
    ctx.stroke();

    // Plot phase trajectory
    for (let i = 1; i < phaseHistory.length; i++) {
      const alpha = 0.15 + 0.85 * (i / phaseHistory.length);
      const p1 = phaseHistory[i - 1];
      const p2 = phaseHistory[i];

      const sx1 = plotX + plotW / 2 + (p1.omega / maxOmega) * (plotW / 2);
      const sy1 = plotY + plotH / 2 - (p1.torque / maxTorque) * (plotH / 2);
      const sx2 = plotX + plotW / 2 + (p2.omega / maxOmega) * (plotW / 2);
      const sy2 = plotY + plotH / 2 - (p2.torque / maxTorque) * (plotH / 2);

      // Color by omega sign
      const hue = p2.omega > 0 ? 30 : 270;
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }

    // Current point
    const cur = phaseHistory[phaseHistory.length - 1];
    const csx = plotX + plotW / 2 + (cur.omega / maxOmega) * (plotW / 2);
    const csy = plotY + plotH / 2 - (cur.torque / maxTorque) * (plotH / 2);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(csx, csy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("\u03C9 (rad/s)", plotX + plotW / 2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(plotX - 20, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Torque", 0, 0);
    ctx.restore();
  }

  function drawTimeSeries(): void {
    const graphX = width * 0.62;
    const graphY = height * 0.52;
    const graphW = width * 0.34;
    const graphH = height * 0.38;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(graphX, graphY, graphW, graphH, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Angular Velocity vs Time", graphX + graphW / 2, graphY + 20);

    if (omegaHistory.length < 2) return;

    const plotX = graphX + 40;
    const plotY = graphY + 30;
    const plotW = graphW - 55;
    const plotH = graphH - 50;

    let maxOmega = 0.1;
    for (const p of omegaHistory) {
      maxOmega = Math.max(maxOmega, Math.abs(p.omega));
    }
    maxOmega *= 1.1;

    const tStart = omegaHistory[0].t;
    const tEnd = omegaHistory[omegaHistory.length - 1].t;
    const tRange = Math.max(1, tEnd - tStart);

    // Zero line
    ctx.strokeStyle = "rgba(100,116,139,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH / 2);
    ctx.lineTo(plotX + plotW, plotY + plotH / 2);
    ctx.stroke();

    // Plot
    ctx.beginPath();
    for (let i = 0; i < omegaHistory.length; i++) {
      const p = omegaHistory[i];
      const sx = plotX + ((p.t - tStart) / tRange) * plotW;
      const sy = plotY + plotH / 2 - (p.omega / maxOmega) * (plotH / 2);

      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill positive/negative differently
    // Positive region fill
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH / 2);
    for (let i = 0; i < omegaHistory.length; i++) {
      const p = omegaHistory[i];
      const sx = plotX + ((p.t - tStart) / tRange) * plotW;
      const sy = plotY + plotH / 2 - (Math.max(0, p.omega) / maxOmega) * (plotH / 2);
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(plotX + plotW, plotY + plotH / 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(249,115,22,0.1)";
    ctx.fill();

    // Negative region fill
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH / 2);
    for (let i = 0; i < omegaHistory.length; i++) {
      const p = omegaHistory[i];
      const sx = plotX + ((p.t - tStart) / tRange) * plotW;
      const sy = plotY + plotH / 2 - (Math.min(0, p.omega) / maxOmega) * (plotH / 2);
      ctx.lineTo(sx, sy);
    }
    ctx.lineTo(plotX + plotW, plotY + plotH / 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(168,85,247,0.1)";
    ctx.fill();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time (s)", plotX + plotW / 2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(plotX - 20, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("\u03C9 (rad/s)", 0, 0);
    ctx.restore();
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawWaterStream();
    drawWheel();
    drawRotationInfo();
    drawPhaseSpace();
    drawTimeSeries();

    // Support stand
    ctx.fillStyle = "#374151";
    ctx.fillRect(wheelCx - 6, wheelCy, 12, height - wheelCy - 20);
    ctx.fillStyle = "#475569";
    ctx.fillRect(wheelCx - 30, height - 25, 60, 8);

    // Title
    ctx.fillStyle = "rgba(226,232,240,0.9)";
    ctx.font = `bold ${Math.max(16, width * 0.024)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Lorenz Water Mill", width / 2, height - 45);

    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.font = `${Math.max(11, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillText("Malkus Waterwheel \u2014 A Physical Lorenz Attractor", width / 2, height - 25);

    // Time
    ctx.fillStyle = "rgba(148,163,184,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`t = ${time.toFixed(1)} s`, width - 15, 20);
  }

  function reset(): void {
    resetState();
  }

  function destroy(): void {
    buckets = [];
    phaseHistory = [];
    omegaHistory = [];
  }

  function getStateDescription(): string {
    let totalWater = 0;
    for (const b of buckets) totalWater += b.water;

    const ratio = flowRate / Math.max(0.01, leakRate * friction);
    let regime = "sub-critical (stationary)";
    if (ratio > 3.0) regime = "chaotic (direction reversals)";
    else if (ratio > 1.0) regime = "steady rotation";

    return (
      `Lorenz Water Mill: ${numBuckets} buckets, flow=${flowRate.toFixed(1)}, leak=${leakRate.toFixed(1)}, friction=${friction.toFixed(2)}. ` +
      `Omega=${omega.toFixed(3)} rad/s, theta=${(theta % (2 * Math.PI)).toFixed(2)} rad. ` +
      `Total water on wheel: ${totalWater.toFixed(1)}. ` +
      `Regime: ${regime} (flow/(leak*friction) = ${ratio.toFixed(2)}). ` +
      `This is a physical analog of the Lorenz attractor. At high flow rates, the wheel reverses direction chaotically, ` +
      `demonstrating sensitivity to initial conditions (the butterfly effect).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    wheelCx = width * 0.33;
    wheelCy = height * 0.45;
    wheelR = Math.min(width * 0.22, height * 0.32);
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LorenzWaterMillFactory;
