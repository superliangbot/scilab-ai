import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const FaradaysLawFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("faradays-law") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let magnetSpeed = 3; // oscillation speed
  let coilTurns = 5; // number of turns
  let showFieldLines = 1;
  let magnetStrength = 5; // 1-10

  // State
  let magnetX = 0;
  let magnetPhase = 0;
  let inducedEMF = 0;
  let inducedCurrent = 0;

  // EMF history for graph
  let emfHistory: number[] = [];
  const MAX_EMF_HISTORY = 200;

  // Coil geometry
  const COIL_X = 400;
  const COIL_Y = 280;
  const COIL_WIDTH = 80;
  const COIL_HEIGHT = 120;

  // Magnet dimensions
  const MAGNET_W = 100;
  const MAGNET_H = 40;

  // Circuit particles
  interface CircuitParticle {
    progress: number; // 0 to 1 along circuit path
    speed: number;
  }
  let circuitParticles: CircuitParticle[] = [];

  function createCircuitParticles(): void {
    circuitParticles = [];
    for (let i = 0; i < 12; i++) {
      circuitParticles.push({
        progress: i / 12,
        speed: 0,
      });
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
    createCircuitParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    magnetSpeed = params.magnetSpeed ?? 3;
    coilTurns = Math.round(params.coilTurns ?? 5);
    showFieldLines = params.showFieldLines ?? 1;
    magnetStrength = params.magnetStrength ?? 5;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // Magnet oscillates back and forth
    magnetPhase += magnetSpeed * dtClamped;
    magnetX = COIL_X - 180 + Math.sin(magnetPhase) * 120;

    // Compute EMF = -N * dΦ/dt
    // Φ depends on distance from magnet to coil
    const distToCoil = COIL_X - magnetX;
    const prevDist = COIL_X - (COIL_X - 180 + Math.sin(magnetPhase - magnetSpeed * dtClamped) * 120);
    const dFlux = (1 / (distToCoil * distToCoil + 100) - 1 / (prevDist * prevDist + 100));
    inducedEMF = -coilTurns * magnetStrength * dFlux * 50000;
    inducedCurrent = inducedEMF * 0.1;

    // Record EMF history
    emfHistory.push(inducedEMF);
    if (emfHistory.length > MAX_EMF_HISTORY) emfHistory.shift();

    // Update circuit particles
    for (const p of circuitParticles) {
      p.speed = inducedCurrent * 0.01;
      p.progress += p.speed * dtClamped;
      if (p.progress > 1) p.progress -= 1;
      if (p.progress < 0) p.progress += 1;
    }
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawMagnet(): void {
    const mx = magnetX - MAGNET_W / 2;
    const my = COIL_Y - MAGNET_H / 2;

    // North pole (red)
    const nGrad = ctx.createLinearGradient(mx, my, mx + MAGNET_W / 2, my);
    nGrad.addColorStop(0, "#cc2020");
    nGrad.addColorStop(1, "#ee4040");
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.roundRect(mx, my, MAGNET_W / 2, MAGNET_H, [6, 0, 0, 6]);
    ctx.fill();

    // South pole (blue)
    const sGrad = ctx.createLinearGradient(mx + MAGNET_W / 2, my, mx + MAGNET_W, my);
    sGrad.addColorStop(0, "#2040ee");
    sGrad.addColorStop(1, "#1030cc");
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.roundRect(mx + MAGNET_W / 2, my, MAGNET_W / 2, MAGNET_H, [0, 6, 6, 0]);
    ctx.fill();

    // Labels
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", mx + MAGNET_W * 0.25, COIL_Y + 6);
    ctx.fillText("S", mx + MAGNET_W * 0.75, COIL_Y + 6);

    // Motion arrow
    const vel = Math.cos(magnetPhase) * magnetSpeed;
    if (Math.abs(vel) > 0.5) {
      const arrowX = magnetX + (vel > 0 ? MAGNET_W / 2 + 10 : -MAGNET_W / 2 - 10);
      ctx.strokeStyle = "rgba(255, 200, 50, 0.6)";
      ctx.lineWidth = 2;
      const dir = vel > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(arrowX, COIL_Y - 30);
      ctx.lineTo(arrowX + dir * 20, COIL_Y - 30);
      ctx.lineTo(arrowX + dir * 15, COIL_Y - 35);
      ctx.moveTo(arrowX + dir * 20, COIL_Y - 30);
      ctx.lineTo(arrowX + dir * 15, COIL_Y - 25);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 200, 50, 0.6)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("v", arrowX + dir * 10, COIL_Y - 40);
    }
  }

  function drawFieldLines(): void {
    if (showFieldLines < 0.5) return;

    ctx.save();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.15)";
    ctx.lineWidth = 1;

    const numLines = 8;
    for (let i = 0; i < numLines; i++) {
      const offsetY = ((i - numLines / 2 + 0.5) / numLines) * 200;
      ctx.beginPath();

      for (let t = 0; t <= 1; t += 0.02) {
        const angle = t * Math.PI * 2;
        const fieldR = 60 + Math.abs(offsetY) * 0.8;
        const fx = magnetX + Math.cos(angle) * fieldR;
        const fy = COIL_Y + offsetY + Math.sin(angle) * fieldR * 0.6;

        if (t === 0) ctx.moveTo(fx, fy);
        else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCoil(): void {
    const cx = COIL_X;
    const cy = COIL_Y;
    const halfW = COIL_WIDTH / 2;
    const halfH = COIL_HEIGHT / 2;

    // Draw coil turns
    for (let i = 0; i < coilTurns; i++) {
      const offset = (i - (coilTurns - 1) / 2) * 6;

      ctx.strokeStyle = "rgba(200, 150, 50, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx + offset, cy, halfW * 0.4, halfH, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // EMF-dependent glow
    const glowIntensity = Math.min(1, Math.abs(inducedEMF) / 5);
    if (glowIntensity > 0.05) {
      const glowColor = inducedEMF > 0 ? `rgba(50, 200, 255, ${glowIntensity * 0.3})` : `rgba(255, 100, 50, ${glowIntensity * 0.3})`;
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.ellipse(cx, cy, halfW * 0.6, halfH + 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCircuit(): void {
    const cx = COIL_X;
    const wireY = COIL_Y + COIL_HEIGHT / 2 + 40;

    // Wire from coil to galvanometer
    ctx.strokeStyle = "rgba(200, 150, 50, 0.5)";
    ctx.lineWidth = 2;

    // Bottom wire
    ctx.beginPath();
    ctx.moveTo(cx - 30, COIL_Y + COIL_HEIGHT / 2);
    ctx.lineTo(cx - 30, wireY);
    ctx.lineTo(cx + 120, wireY);
    ctx.stroke();

    // Top wire
    ctx.beginPath();
    ctx.moveTo(cx + 30, COIL_Y + COIL_HEIGHT / 2);
    ctx.lineTo(cx + 30, wireY + 20);
    ctx.lineTo(cx + 120, wireY + 20);
    ctx.stroke();

    // Circuit particles
    for (const p of circuitParticles) {
      const t = p.progress;
      let px: number, py: number;

      if (t < 0.25) {
        px = cx - 30;
        py = COIL_Y + COIL_HEIGHT / 2 + (wireY - COIL_Y - COIL_HEIGHT / 2) * (t / 0.25);
      } else if (t < 0.5) {
        px = cx - 30 + 150 * ((t - 0.25) / 0.25);
        py = wireY;
      } else if (t < 0.75) {
        px = cx + 120;
        py = wireY + 20 * ((t - 0.5) / 0.25);
      } else {
        px = cx + 120 - 90 * ((t - 0.75) / 0.25);
        py = wireY + 20;
      }

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = Math.abs(inducedCurrent) > 0.1 ? "rgba(255, 220, 50, 0.7)" : "rgba(150, 150, 150, 0.3)";
      ctx.fill();
    }

    // Galvanometer
    drawGalvanometer(cx + 120, wireY + 10);
  }

  function drawGalvanometer(gx: number, gy: number): void {
    // Body
    ctx.beginPath();
    ctx.arc(gx + 30, gy, 30, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(30, 40, 60, 0.7)";
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 170, 200, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Scale
    ctx.beginPath();
    ctx.arc(gx + 30, gy, 25, Math.PI + 0.3, Math.PI * 2 - 0.3);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Needle
    const needleAngle = Math.PI * 1.5 + (inducedCurrent * 0.5);
    ctx.save();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx + 30, gy);
    ctx.lineTo(gx + 30 + Math.cos(needleAngle) * 22, gy + Math.sin(needleAngle) * 22);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(gx + 30, gy, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.restore();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Galvanometer", gx + 30, gy + 42);
  }

  function drawEMFGraph(): void {
    const gx = 40;
    const gy = 430;
    const gw = 320;
    const gh = 140;

    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("Induced EMF over Time", gx + gw / 2, gy - 6);

    // Zero line
    const zeroY = gy + gh / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, zeroY);
    ctx.lineTo(gx + gw, zeroY);
    ctx.stroke();

    if (emfHistory.length > 1) {
      const maxEMF = Math.max(1, ...emfHistory.map(Math.abs)) * 1.2;
      ctx.beginPath();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      for (let i = 0; i < emfHistory.length; i++) {
        const x = gx + (i / MAX_EMF_HISTORY) * gw;
        const y = zeroY - (emfHistory[i] / maxEMF) * (gh / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Current EMF value
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`EMF = ${inducedEMF.toFixed(2)} V`, gx + gw - 8, gy + 16);
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 260;
    const ph = 120;
    const px = W - pw - 15;
    const py = 430;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Faraday's Law", px + 12, py + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("EMF = −N dΦ/dt", px + 12, py + 42);
    ctx.fillText(`Turns: N = ${coilTurns}`, px + 12, py + 60);
    ctx.fillText(`Magnet speed: ${magnetSpeed.toFixed(1)}`, px + 12, py + 76);
    ctx.fillText(`Current: ${inducedCurrent.toFixed(3)} A`, px + 12, py + 92);
    ctx.fillText("Lenz's Law: induced current opposes change", px + 12, py + 108);

    ctx.restore();
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Faraday's Law of Electromagnetic Induction", W / 2, 30);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Moving magnet induces EMF in a coil — the basis of electric generators", W / 2, 50);
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawTitle();
    drawFieldLines();
    drawCoil();
    drawMagnet();
    drawCircuit();
    drawEMFGraph();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    magnetPhase = 0;
    emfHistory = [];
    createCircuitParticles();
  }

  function destroy(): void {
    emfHistory = [];
    circuitParticles = [];
  }

  function getStateDescription(): string {
    return (
      `Faraday's Law: A bar magnet oscillates near a ${coilTurns}-turn coil at speed ${magnetSpeed.toFixed(1)}. ` +
      `Induced EMF = ${inducedEMF.toFixed(2)} V, current = ${inducedCurrent.toFixed(3)} A. ` +
      `EMF = -N × dΦ/dt. Faster magnet motion or more turns → larger EMF. ` +
      `Lenz's law: the induced current opposes the change in flux that created it.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FaradaysLawFactory;
