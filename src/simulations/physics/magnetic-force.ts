import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagneticForceFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnetic-force") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Physics state
  let wireDisplacement = 0; // how far the wire has moved due to force
  let wireVelocity = 0;

  // Parameters (defaults)
  let current = 5;       // Amperes
  let wireLength = 0.5;  // meters
  let fieldStrength = 1; // Tesla
  let angle = 90;        // degrees between wire and field

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    wireDisplacement = 0;
    wireVelocity = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    current = params.current ?? 5;
    wireLength = params.wireLength ?? 0.5;
    fieldStrength = params.fieldStrength ?? 1;
    angle = params.angle ?? 90;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // F = BIL sin(theta)
    const thetaRad = (angle * Math.PI) / 180;
    const force = fieldStrength * current * wireLength * Math.sin(thetaRad);

    // Animate wire displacement (spring-like: force pushes, spring returns)
    const springK = 8;
    const damping = 3;
    const accel = force * 15 - springK * wireDisplacement - damping * wireVelocity;
    wireVelocity += accel * dtClamped;
    wireDisplacement += wireVelocity * dtClamped;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a0e1a");
    grad.addColorStop(1, "#101828");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(15, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Magnetic Force on a Current-Carrying Wire", width / 2, 30);

    ctx.font = `${Math.max(11, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.fillText("F = BIL sin(\u03B8)  \u2014  Lorentz force law", width / 2, 50);
  }

  function drawMagnetPoles(): void {
    const cx = width * 0.5;
    const cy = height * 0.42;
    const gap = Math.min(width, height) * 0.32;
    const poleW = Math.min(width, height) * 0.08;
    const poleH = Math.min(width, height) * 0.45;

    // North pole (left)
    const nGrad = ctx.createLinearGradient(cx - gap - poleW, cy - poleH / 2, cx - gap, cy - poleH / 2);
    nGrad.addColorStop(0, "#b91c1c");
    nGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.roundRect(cx - gap - poleW, cy - poleH / 2, poleW, poleH, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(18, width * 0.028)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("N", cx - gap - poleW / 2, cy + 7);

    // South pole (right)
    const sGrad = ctx.createLinearGradient(cx + gap, cy - poleH / 2, cx + gap + poleW, cy - poleH / 2);
    sGrad.addColorStop(0, "#3b82f6");
    sGrad.addColorStop(1, "#1e40af");
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.roundRect(cx + gap, cy - poleH / 2, poleW, poleH, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(18, width * 0.028)}px system-ui, sans-serif`;
    ctx.fillText("S", cx + gap + poleW / 2, cy + 7);

    // Horseshoe top bar connecting N and S
    ctx.fillStyle = "#6b7280";
    ctx.beginPath();
    ctx.roundRect(cx - gap - poleW, cy - poleH / 2 - 18, gap * 2 + poleW * 2, 18, [6, 6, 0, 0]);
    ctx.fill();
  }

  function drawFieldLines(): void {
    const cx = width * 0.5;
    const cy = height * 0.42;
    const gap = Math.min(width, height) * 0.32;

    ctx.save();
    ctx.strokeStyle = "rgba(34, 197, 94, 0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);

    const numLines = 9;
    for (let i = 0; i < numLines; i++) {
      const yOff = ((i - (numLines - 1) / 2) / numLines) * gap * 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - gap + 5, cy + yOff);
      ctx.lineTo(cx + gap - 5, cy + yOff);
      ctx.stroke();

      // Arrow in the middle pointing right (N to S)
      const arrowX = cx;
      const arrowY = cy + yOff;
      ctx.fillStyle = "rgba(34, 197, 94, 0.35)";
      ctx.beginPath();
      ctx.moveTo(arrowX + 6, arrowY);
      ctx.lineTo(arrowX - 3, arrowY - 4);
      ctx.lineTo(arrowX - 3, arrowY + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.setLineDash([]);

    // B label
    ctx.fillStyle = "rgba(34, 197, 94, 0.6)";
    ctx.font = `bold ${Math.max(14, width * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("B", cx, cy - gap * 0.7);
    ctx.font = `${Math.max(10, width * 0.013)}px system-ui, sans-serif`;
    ctx.fillText(`(${fieldStrength.toFixed(1)} T)`, cx, cy - gap * 0.7 + 16);

    ctx.restore();
  }

  function drawWire(): void {
    const cx = width * 0.5;
    const cy = height * 0.42;
    const gap = Math.min(width, height) * 0.32;
    const wireLenPx = gap * 1.2;

    // Wire position displaced by force (upward or downward)
    const displPx = wireDisplacement * 8;
    const wireY = cy + displPx;

    // Draw wire as a thick line along the angle direction
    const thetaRad = (angle * Math.PI) / 180;
    // Wire lies in the plane; it's tilted by the angle relative to the field (horizontal)
    const halfLen = wireLenPx / 2;
    const dx = halfLen * Math.cos(thetaRad);
    const dy = halfLen * Math.sin(thetaRad);

    // Wire shadow/glow
    ctx.save();
    ctx.strokeStyle = "rgba(251, 191, 36, 0.2)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(cx - dx, wireY - dy);
    ctx.lineTo(cx + dx, wireY + dy);
    ctx.stroke();

    // Wire itself
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - dx, wireY - dy);
    ctx.lineTo(cx + dx, wireY + dy);
    ctx.stroke();

    // Current direction arrow along the wire
    ctx.strokeStyle = "#38bdf8";
    ctx.fillStyle = "#38bdf8";
    ctx.lineWidth = 3;

    // Arrow from one end to the other
    const arrowDx = dx * 0.5;
    const arrowDy = dy * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - arrowDx, wireY - arrowDy);
    ctx.lineTo(cx + arrowDx, wireY + arrowDy);
    ctx.stroke();

    // Arrowhead
    const tipX = cx + arrowDx;
    const tipY = wireY + arrowDy;
    const perpX = -Math.sin(thetaRad) * 6;
    const perpY = Math.cos(thetaRad) * 6;
    const backX = -Math.cos(thetaRad) * 10;
    const backY = -Math.sin(thetaRad) * 10;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + backX + perpX, tipY + backY + perpY);
    ctx.lineTo(tipX + backX - perpX, tipY + backY - perpY);
    ctx.closePath();
    ctx.fill();

    // "I" label
    ctx.font = `bold ${Math.max(13, width * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("I", cx + arrowDx + 15, wireY + arrowDy - 5);

    ctx.restore();

    // Draw force vector (perpendicular to both current and B field)
    // For wire in the B field plane, force is out of plane; for visualization, show it as vertical
    const thetaRadCalc = (angle * Math.PI) / 180;
    const forceMag = fieldStrength * current * wireLength * Math.sin(thetaRadCalc);
    const forceScale = 3;
    const forceLen = forceMag * forceScale;

    if (Math.abs(forceLen) > 1) {
      // Force direction: upward (using right-hand rule for typical config)
      const forceDir = forceLen > 0 ? -1 : 1; // negative y = up
      const fStartY = wireY;
      const fEndY = wireY + forceDir * Math.abs(forceLen);

      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.fillStyle = "#ef4444";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(cx, fStartY);
      ctx.lineTo(cx, fEndY);
      ctx.stroke();

      // Arrowhead
      const aDir = forceDir;
      ctx.beginPath();
      ctx.moveTo(cx, fEndY);
      ctx.lineTo(cx - 6, fEndY - aDir * 10);
      ctx.lineTo(cx + 6, fEndY - aDir * 10);
      ctx.closePath();
      ctx.fill();

      // Force label
      ctx.font = `bold ${Math.max(12, width * 0.016)}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(`F = ${Math.abs(forceMag).toFixed(2)} N`, cx + 12, fEndY + aDir * 5);

      ctx.restore();
    }
  }

  function drawFormulaPanel(): void {
    const thetaRad = (angle * Math.PI) / 180;
    const force = fieldStrength * current * wireLength * Math.sin(thetaRad);

    const pw = Math.min(280, width * 0.35);
    const ph = 155;
    const px = 15;
    const py = height - ph - 15;

    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(13, width * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("F = BIL sin(\u03B8)", px + 12, py + 24);

    ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`B = ${fieldStrength.toFixed(2)} T`, px + 12, py + 48);
    ctx.fillText(`I = ${current.toFixed(1)} A`, px + 12, py + 66);
    ctx.fillText(`L = ${wireLength.toFixed(2)} m`, px + 12, py + 84);
    ctx.fillText(`\u03B8 = ${angle.toFixed(0)}\u00B0`, px + 12, py + 102);
    ctx.fillText(`sin(\u03B8) = ${Math.sin(thetaRad).toFixed(4)}`, px + 12, py + 120);

    ctx.fillStyle = "#38bdf8";
    ctx.font = `bold ${Math.max(12, width * 0.016)}px monospace`;
    ctx.fillText(`F = ${Math.abs(force).toFixed(3)} N`, px + 12, py + 144);
  }

  function drawLegend(): void {
    const lw = 160;
    const lh = 100;
    const lx = width - lw - 15;
    const ly = height - lh - 15;

    ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lh, 8);
    ctx.fill();
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly, lw, lh);

    const fs = Math.max(11, width * 0.014);
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textAlign = "left";

    ctx.fillStyle = "#f59e0b";
    ctx.fillText("\u2014 Wire", lx + 10, ly + 22);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("\u2014 Current (I)", lx + 10, ly + 42);
    ctx.fillStyle = "#22c55e";
    ctx.fillText("\u2014 B Field", lx + 10, ly + 62);
    ctx.fillStyle = "#ef4444";
    ctx.fillText("\u2014 Force (F)", lx + 10, ly + 82);
  }

  function drawAngleIndicator(): void {
    const cx = width * 0.5;
    const cy = height * 0.42 + wireDisplacement * 8;
    const thetaRad = (angle * Math.PI) / 180;

    if (angle > 0 && angle < 180) {
      ctx.save();
      ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
      ctx.lineWidth = 1.5;
      const arcR = 35;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, 0, -thetaRad, true);
      ctx.stroke();

      // Theta label
      ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
      ctx.font = `${Math.max(11, width * 0.014)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      const labelAngle = -thetaRad / 2;
      ctx.fillText(
        `\u03B8=${angle}\u00B0`,
        cx + (arcR + 16) * Math.cos(labelAngle),
        cy + (arcR + 16) * Math.sin(labelAngle)
      );
      ctx.restore();
    }
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawTitle();
    drawMagnetPoles();
    drawFieldLines();
    drawWire();
    drawAngleIndicator();
    drawFormulaPanel();
    drawLegend();
  }

  function reset(): void {
    time = 0;
    wireDisplacement = 0;
    wireVelocity = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const thetaRad = (angle * Math.PI) / 180;
    const force = fieldStrength * current * wireLength * Math.sin(thetaRad);
    return (
      `Magnetic Force simulation: A current-carrying wire (I=${current.toFixed(1)} A, L=${wireLength.toFixed(2)} m) ` +
      `sits in a magnetic field B=${fieldStrength.toFixed(2)} T at angle \u03B8=${angle}\u00B0. ` +
      `Using F = BIL sin(\u03B8), the force is ${Math.abs(force).toFixed(3)} N. ` +
      `The force is perpendicular to both the current and the field (right-hand rule). ` +
      `At \u03B8=90\u00B0 the force is maximum; at \u03B8=0\u00B0 or 180\u00B0 it is zero.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MagneticForceFactory;
