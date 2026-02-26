import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagneticInductionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetic-induction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let magnetSpeed = 3;
  let magnetStrength = 5;
  let coilTurns = 5;
  let coilArea = 0.01; // m^2

  // Physics state
  let magnetPhase = 0;
  let magnetX = 0;
  let prevMagnetX = 0;
  let inducedEMF = 0;
  let inducedCurrent = 0;

  // EMF history for rolling graph
  const MAX_HISTORY = 250;
  let emfHistory: number[] = [];

  // Current flow particles in coil circuit
  interface FlowParticle {
    progress: number;
  }
  let particles: FlowParticle[] = [];

  function createParticles(): void {
    particles = [];
    for (let i = 0; i < 14; i++) {
      particles.push({ progress: i / 14 });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    magnetPhase = 0;
    emfHistory = [];
    createParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    magnetSpeed = params.magnetSpeed ?? 3;
    magnetStrength = params.magnetStrength ?? 5;
    coilTurns = Math.round(params.coilTurns ?? 5);
    coilArea = params.coilArea ?? 0.01;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // Magnet oscillates sinusoidally
    prevMagnetX = magnetX;
    magnetPhase += magnetSpeed * dtClamped;
    const coilCenterX = W * 0.55;
    const amplitude = W * 0.2;
    magnetX = coilCenterX - amplitude + Math.sin(magnetPhase) * amplitude;

    // Calculate flux: phi = B_eff * A  where B_eff ~ magnetStrength / (dist^2 + eps)
    const dist = coilCenterX - magnetX;
    const prevDist = coilCenterX - prevMagnetX;
    const eps = 400;
    const flux = (magnetStrength * coilArea * 1e4) / (dist * dist + eps);
    const prevFlux = (magnetStrength * coilArea * 1e4) / (prevDist * prevDist + eps);

    // EMF = -N * dPhi/dt
    const dFlux = flux - prevFlux;
    inducedEMF = -coilTurns * dFlux / dtClamped * 0.001;
    inducedEMF = Math.max(-20, Math.min(20, inducedEMF)); // clamp
    inducedCurrent = inducedEMF * 0.08;

    emfHistory.push(inducedEMF);
    if (emfHistory.length > MAX_HISTORY) emfHistory.shift();

    // Update flow particles
    for (const p of particles) {
      p.progress += inducedCurrent * 0.008 * dtClamped;
      if (p.progress > 1) p.progress -= 1;
      if (p.progress < 0) p.progress += 1;
    }
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#070b18");
    grad.addColorStop(1, "#0f1629");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(15, W * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Faraday's Law \u2014 Electromagnetic Induction", W / 2, 28);

    ctx.font = `${Math.max(11, W * 0.014)}px system-ui, sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.fillText("EMF = \u2212N d\u03A6/dt   |   \u03A6 = BA cos(\u03B8)", W / 2, 48);
  }

  function drawMagnet(): void {
    const mw = 90;
    const mh = 36;
    const mx = magnetX - mw / 2;
    const my = H * 0.36 - mh / 2;

    // North (red, right side toward coil)
    const nGrad = ctx.createLinearGradient(mx + mw / 2, my, mx + mw, my);
    nGrad.addColorStop(0, "#dc2626");
    nGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.roundRect(mx + mw / 2, my, mw / 2, mh, [0, 6, 6, 0]);
    ctx.fill();

    // South (blue, left)
    const sGrad = ctx.createLinearGradient(mx, my, mx + mw / 2, my);
    sGrad.addColorStop(0, "#1e40af");
    sGrad.addColorStop(1, "#3b82f6");
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw / 2, mh, [6, 0, 0, 6]);
    ctx.fill();

    // Labels
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(14, W * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("S", mx + mw * 0.25, H * 0.36 + 5);
    ctx.fillText("N", mx + mw * 0.75, H * 0.36 + 5);

    // Velocity arrow above magnet
    const vel = Math.cos(magnetPhase) * magnetSpeed;
    if (Math.abs(vel) > 0.3) {
      const dir = vel > 0 ? 1 : -1;
      const ax = magnetX + dir * 55;
      const ay = my - 14;

      ctx.strokeStyle = "rgba(250, 204, 21, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(magnetX, ay);
      ctx.lineTo(ax, ay);
      ctx.stroke();

      ctx.fillStyle = "rgba(250, 204, 21, 0.6)";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - dir * 8, ay - 5);
      ctx.lineTo(ax - dir * 8, ay + 5);
      ctx.closePath();
      ctx.fill();

      ctx.font = `${Math.max(10, W * 0.013)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("v", magnetX + dir * 30, ay - 8);
    }
  }

  function drawFieldLines(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.12)";
    ctx.lineWidth = 1;

    const cy = H * 0.36;
    for (let i = 0; i < 7; i++) {
      const offsetY = ((i - 3) / 3) * 80;
      const r = 55 + Math.abs(offsetY) * 0.5;

      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const a = t * Math.PI * 2;
        const fx = magnetX + Math.cos(a) * r;
        const fy = cy + offsetY + Math.sin(a) * r * 0.5;
        if (t === 0) ctx.moveTo(fx, fy);
        else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCoil(): void {
    const cx = W * 0.55;
    const cy = H * 0.36;
    const coilRx = 22;
    const coilRy = 65;

    // Coil turns
    for (let i = 0; i < coilTurns; i++) {
      const offset = (i - (coilTurns - 1) / 2) * 7;
      ctx.strokeStyle = "rgba(217, 119, 6, 0.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx + offset, cy, coilRx, coilRy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // EMF glow on coil
    const glowI = Math.min(1, Math.abs(inducedEMF) / 6);
    if (glowI > 0.03) {
      const col = inducedEMF > 0
        ? `rgba(56, 189, 248, ${glowI * 0.35})`
        : `rgba(248, 113, 113, ${glowI * 0.35})`;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(cx, cy, coilRx + 10, coilRy + 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connection wires from coil to voltmeter circuit
    const wireStartY = cy + coilRy + 5;
    const meterX = cx + 130;
    const meterY = cy + coilRy + 50;

    ctx.strokeStyle = "rgba(217, 119, 6, 0.45)";
    ctx.lineWidth = 2;

    // Left wire
    ctx.beginPath();
    ctx.moveTo(cx - 15, wireStartY);
    ctx.lineTo(cx - 15, meterY);
    ctx.lineTo(meterX - 30, meterY);
    ctx.stroke();

    // Right wire
    ctx.beginPath();
    ctx.moveTo(cx + 15, wireStartY);
    ctx.lineTo(cx + 15, meterY + 22);
    ctx.lineTo(meterX - 30, meterY + 22);
    ctx.stroke();

    // Draw current flow particles along the circuit
    for (const p of particles) {
      const t = p.progress;
      let px: number, py: number;

      if (t < 0.25) {
        // Down from coil left side
        px = cx - 15;
        py = wireStartY + (meterY - wireStartY) * (t / 0.25);
      } else if (t < 0.5) {
        // Across to meter
        const frac = (t - 0.25) / 0.25;
        px = (cx - 15) + (meterX - 30 - cx + 15) * frac;
        py = meterY;
      } else if (t < 0.75) {
        // Back across bottom
        const frac = (t - 0.5) / 0.25;
        px = meterX - 30 - (meterX - 30 - cx - 15) * frac;
        py = meterY + 22;
      } else {
        // Up to coil right side
        const frac = (t - 0.75) / 0.25;
        px = cx + 15;
        py = meterY + 22 - (meterY + 22 - wireStartY) * frac;
      }

      const brightness = Math.abs(inducedCurrent) > 0.05 ? 0.7 : 0.15;
      ctx.fillStyle = `rgba(250, 204, 21, ${brightness})`;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current direction label near coil
    if (Math.abs(inducedCurrent) > 0.1) {
      const dir = inducedCurrent > 0 ? "\u21BB" : "\u21BA"; // clockwise / counter-clockwise
      ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
      ctx.font = `${Math.max(20, W * 0.03)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(dir, cx, cy);
    }

    // Voltmeter
    drawVoltmeter(meterX, meterY + 11);
  }

  function drawVoltmeter(vx: number, vy: number): void {
    // Circle body
    ctx.beginPath();
    ctx.arc(vx, vy, 28, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20, 30, 50, 0.8)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // V label
    ctx.fillStyle = "#94a3b8";
    ctx.font = `bold ${Math.max(14, W * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("V", vx, vy + 22);

    // Scale arc
    ctx.beginPath();
    ctx.arc(vx, vy, 22, Math.PI + 0.4, -0.4);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Zero mark
    ctx.beginPath();
    ctx.moveTo(vx, vy - 22);
    ctx.lineTo(vx, vy - 18);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();

    // Needle deflection
    const needleAngle = Math.PI * 1.5 + Math.max(-1, Math.min(1, inducedEMF * 0.15)) * (Math.PI / 3);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx + Math.cos(needleAngle) * 20, vy + Math.sin(needleAngle) * 20);
    ctx.stroke();

    // Center pivot
    ctx.beginPath();
    ctx.arc(vx, vy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
  }

  function drawEMFGraph(): void {
    const gx = 25;
    const gy = H * 0.68;
    const gw = Math.min(340, W * 0.42);
    const gh = H * 0.27;

    // Background
    ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    // Title
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `bold ${Math.max(11, W * 0.015)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Induced EMF vs Time", gx + gw / 2, gy + 16);

    // Axes
    const plotX = gx + 35;
    const plotY = gy + 28;
    const plotW = gw - 50;
    const plotH = gh - 45;
    const zeroY = plotY + plotH / 2;

    // Zero line
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, zeroY);
    ctx.lineTo(plotX + plotW, zeroY);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(9, W * 0.012)}px monospace`;
    ctx.textAlign = "right";
    ctx.fillText("+", plotX - 4, plotY + 10);
    ctx.fillText("0", plotX - 4, zeroY + 4);
    ctx.fillText("\u2212", plotX - 4, plotY + plotH - 2);

    // X-axis label
    ctx.textAlign = "center";
    ctx.fillText("time \u2192", plotX + plotW / 2, plotY + plotH + 14);

    // Plot EMF
    if (emfHistory.length > 1) {
      const maxVal = Math.max(1, ...emfHistory.map(Math.abs)) * 1.3;

      ctx.beginPath();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;

      for (let i = 0; i < emfHistory.length; i++) {
        const x = plotX + (i / MAX_HISTORY) * plotW;
        const y = zeroY - (emfHistory[i] / maxVal) * (plotH / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Current value
    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${Math.max(11, W * 0.014)}px monospace`;
    ctx.textAlign = "right";
    ctx.fillText(`EMF = ${inducedEMF.toFixed(2)} V`, plotX + plotW, plotY - 2);
  }

  function drawInfoPanel(): void {
    const pw = Math.min(260, W * 0.32);
    const ph = 140;
    const px = W - pw - 15;
    const py = H - ph - 15;

    ctx.fillStyle = "rgba(10, 15, 30, 0.85)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(12, W * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Faraday's Law", px + 12, py + 22);

    ctx.font = `${Math.max(11, W * 0.014)}px monospace`;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`EMF = -N d\u03A6/dt`, px + 12, py + 44);
    ctx.fillText(`N = ${coilTurns} turns`, px + 12, py + 62);
    ctx.fillText(`A = ${(coilArea * 1e4).toFixed(1)} cm\u00B2`, px + 12, py + 78);
    ctx.fillText(`B_mag = ${magnetStrength.toFixed(1)}`, px + 12, py + 94);
    ctx.fillText(`I = ${inducedCurrent.toFixed(3)} A`, px + 12, py + 110);

    ctx.fillStyle = "#64748b";
    ctx.font = `${Math.max(10, W * 0.013)}px system-ui, sans-serif`;
    ctx.fillText("Lenz: opposes change in flux", px + 12, py + 130);
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawTitle();
    drawFieldLines();
    drawCoil();
    drawMagnet();
    drawEMFGraph();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    magnetPhase = 0;
    magnetX = 0;
    prevMagnetX = 0;
    inducedEMF = 0;
    inducedCurrent = 0;
    emfHistory = [];
    createParticles();
  }

  function destroy(): void {
    emfHistory = [];
    particles = [];
  }

  function getStateDescription(): string {
    return (
      `Magnetic Induction: A bar magnet (strength ${magnetStrength.toFixed(1)}) oscillates at speed ${magnetSpeed.toFixed(1)} ` +
      `near a ${coilTurns}-turn coil (area ${(coilArea * 1e4).toFixed(1)} cm\u00B2). ` +
      `Induced EMF = ${inducedEMF.toFixed(2)} V, current = ${inducedCurrent.toFixed(3)} A. ` +
      `Faraday's law: EMF = -N d\u03A6/dt. As the magnet approaches, EMF is one polarity; ` +
      `as it recedes, EMF reverses. More turns, faster motion, or stronger magnet \u2192 larger EMF.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MagneticInductionFactory;
