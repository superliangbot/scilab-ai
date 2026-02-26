import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SpringPendulumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("spring-pendulum") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physics constants
  const g = 9.81;

  // Parameters
  let springConstant = 10; // N/m
  let mass = 0.5; // kg
  let restLength = 1.0; // m
  let initialAngle = 30; // degrees

  // State variables (polar-ish coordinates for the spring-pendulum)
  // r = current spring length, theta = angle from vertical
  let r = 0;
  let theta = 0;
  let dr = 0; // radial velocity
  let dtheta = 0; // angular velocity

  // Trail history
  let trail: { x: number; y: number }[] = [];
  const maxTrail = 600;

  // Scale for drawing (pixels per meter)
  function getScale(): number {
    return Math.min(width, height) * 0.2;
  }

  function getPivot(): { x: number; y: number } {
    return { x: width * 0.45, y: height * 0.1 };
  }

  function initState(): void {
    const angleRad = (initialAngle * Math.PI) / 180;
    theta = angleRad;
    r = restLength + (mass * g * Math.cos(angleRad)) / springConstant; // equilibrium extension
    dr = 0;
    dtheta = 0;
    trail = [];
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initState();
  }

  function update(dt: number, params: Record<string, number>): void {
    const prevK = springConstant;
    const prevM = mass;
    const prevL = restLength;
    const prevA = initialAngle;

    springConstant = params.springConstant ?? 10;
    mass = params.mass ?? 0.5;
    restLength = params.restLength ?? 1.0;
    initialAngle = params.initialAngle ?? 30;

    // Reset if parameters changed significantly
    if (
      Math.abs(prevK - springConstant) > 0.01 ||
      Math.abs(prevM - mass) > 0.01 ||
      Math.abs(prevL - restLength) > 0.01 ||
      Math.abs(prevA - initialAngle) > 0.1
    ) {
      initState();
    }

    // Equations of motion for spring-pendulum in polar coordinates:
    // m * r'' = m * r * theta'^2 + m * g * cos(theta) - k * (r - L0)
    // m * r * theta'' = -m * g * sin(theta) - 2 * m * r' * theta'
    //
    // Simplifying:
    // r'' = r * theta'^2 + g * cos(theta) - (k/m) * (r - L0)
    // theta'' = (-g * sin(theta) - 2 * r' * theta') / r

    const steps = 20;
    const subDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      const ar = r * dtheta * dtheta + g * Math.cos(theta) - (springConstant / mass) * (r - restLength);
      const atheta = r > 0.001 ? (-g * Math.sin(theta) - 2 * dr * dtheta) / r : 0;

      dr += ar * subDt;
      dtheta += atheta * subDt;

      r += dr * subDt;
      theta += dtheta * subDt;

      // Prevent spring from collapsing to zero
      if (r < 0.05) {
        r = 0.05;
        dr = Math.abs(dr) * 0.5;
      }
    }

    // Record trail
    const scale = getScale();
    const pivot = getPivot();
    const mx = pivot.x + r * Math.sin(theta) * scale;
    const my = pivot.y + r * Math.cos(theta) * scale;
    trail.push({ x: mx, y: my });
    if (trail.length > maxTrail) trail.shift();

    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#06061a");
    grad.addColorStop(0.5, "#0a0a28");
    grad.addColorStop(1, "#0e0e30");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawPivot(): void {
    const pivot = getPivot();

    // Ceiling bar
    ctx.fillStyle = "#444";
    ctx.fillRect(pivot.x - 40, pivot.y - 8, 80, 8);

    // Hatching
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let i = -40; i < 40; i += 6) {
      ctx.beginPath();
      ctx.moveTo(pivot.x + i, pivot.y - 8);
      ctx.lineTo(pivot.x + i + 6, pivot.y);
      ctx.stroke();
    }

    // Pivot point
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#888";
    ctx.fill();
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawSpringCoils(x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const coils = 14;
    const coilAmp = 8;

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    // Tension-based coloring
    const extension = r - restLength;
    const tensionRatio = Math.min(1, Math.max(0, extension / restLength));
    const rr = Math.round(148 + tensionRatio * 107);
    const gg = Math.round(163 - tensionRatio * 100);
    const bb = Math.round(184 - tensionRatio * 130);

    ctx.strokeStyle = `rgb(${rr},${gg},${bb})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);

    const segments = coils * 8;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = t * dist;
      const py = Math.sin(t * coils * Math.PI * 2) * coilAmp;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTrail(): void {
    if (trail.length < 2) return;

    for (let i = 1; i < trail.length; i++) {
      const alpha = (i / trail.length) * 0.6;
      const hue = (i * 0.5) % 360;
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
  }

  function drawMass(): void {
    const scale = getScale();
    const pivot = getPivot();
    const mx = pivot.x + r * Math.sin(theta) * scale;
    const my = pivot.y + r * Math.cos(theta) * scale;

    // Spring coils from pivot to mass
    drawSpringCoils(pivot.x, pivot.y, mx, my);

    // Mass ball glow
    const glowGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 30);
    glowGrad.addColorStop(0, "rgba(59, 130, 246, 0.3)");
    glowGrad.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.beginPath();
    ctx.arc(mx, my, 30, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Mass ball
    const ballR = 10 + mass * 6;
    const ballGrad = ctx.createRadialGradient(mx - ballR * 0.3, my - ballR * 0.3, 0, mx, my, ballR);
    ballGrad.addColorStop(0, "#60a5fa");
    ballGrad.addColorStop(0.7, "#2563eb");
    ballGrad.addColorStop(1, "#1e40af");
    ctx.beginPath();
    ctx.arc(mx, my, ballR, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Gravity arrow
    ctx.strokeStyle = "rgba(239,68,68,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, my + ballR + 2);
    ctx.lineTo(mx, my + ballR + 25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, my + ballR + 25);
    ctx.lineTo(mx - 4, my + ballR + 19);
    ctx.moveTo(mx, my + ballR + 25);
    ctx.lineTo(mx + 4, my + ballR + 19);
    ctx.stroke();
    ctx.fillStyle = "rgba(239,68,68,0.7)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("mg", mx + 12, my + ballR + 22);

    // Vertical reference line
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(pivot.x, pivot.y + (restLength + 1) * scale);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angle arc
    if (Math.abs(theta) > 0.02) {
      const arcR = 40;
      ctx.strokeStyle = "rgba(255,200,50,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const startAngle = Math.PI / 2;
      const endAngle = Math.PI / 2 - theta;
      ctx.arc(pivot.x, pivot.y, arcR, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
      ctx.stroke();
      ctx.fillStyle = "rgba(255,200,50,0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      const labelAngle = (startAngle + endAngle) / 2;
      ctx.fillText(
        `${((theta * 180) / Math.PI).toFixed(1)}\u00B0`,
        pivot.x + arcR * Math.cos(labelAngle) + 5,
        pivot.y + arcR * Math.sin(labelAngle)
      );
    }
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(280, width * 0.38);
    const panelH = 145;
    const panelX = width - panelW - 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Spring Pendulum (2D)", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`k = ${springConstant.toFixed(1)} N/m`, panelX + 10, panelY + 36);
    ctx.fillText(`m = ${mass.toFixed(2)} kg, L\u2080 = ${restLength.toFixed(2)} m`, panelX + 10, panelY + 52);

    // Current state
    const extension = r - restLength;
    const thetaDeg = (theta * 180) / Math.PI;
    ctx.fillStyle = "rgba(200,220,255,0.8)";
    ctx.fillText(`\u03B8 = ${thetaDeg.toFixed(1)}\u00B0`, panelX + 10, panelY + 70);
    ctx.fillText(`r = ${r.toFixed(3)} m (\u0394 = ${extension.toFixed(3)} m)`, panelX + 10, panelY + 86);

    // Energies
    const ke = 0.5 * mass * (dr * dr + r * r * dtheta * dtheta);
    const pe_spring = 0.5 * springConstant * extension * extension;
    const pe_gravity = -mass * g * r * Math.cos(theta);
    const total = ke + pe_spring + pe_gravity;

    ctx.fillStyle = "#ef4444";
    ctx.fillText(`KE = ${ke.toFixed(4)} J`, panelX + 10, panelY + 104);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`PE(spring) = ${pe_spring.toFixed(4)} J`, panelX + 10, panelY + 120);
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`PE(grav) = ${pe_gravity.toFixed(4)} J`, panelX + 10, panelY + 136);
  }

  function drawModeFrequencies(): void {
    const panelW = Math.min(220, width * 0.3);
    const panelH = 55;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    ctx.fill();

    // Natural frequencies
    const omegaSpring = Math.sqrt(springConstant / mass);
    const omegaPend = Math.sqrt(g / restLength);

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Natural Frequencies", panelX + 8, panelY + 16);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`\u03C9_spring = \u221A(k/m) = ${omegaSpring.toFixed(2)} rad/s`, panelX + 8, panelY + 32);
    ctx.fillStyle = "#a78bfa";
    ctx.fillText(`\u03C9_pend = \u221A(g/L) = ${omegaPend.toFixed(2)} rad/s`, panelX + 8, panelY + 48);
  }

  function render(): void {
    drawBackground();
    drawTrail();
    drawPivot();
    drawMass();
    drawInfoPanel();
    drawModeFrequencies();
  }

  function reset(): void {
    time = 0;
    initState();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const extension = r - restLength;
    const thetaDeg = (theta * 180) / Math.PI;
    const ke = 0.5 * mass * (dr * dr + r * r * dtheta * dtheta);
    const pe_spring = 0.5 * springConstant * extension * extension;
    const omegaSpring = Math.sqrt(springConstant / mass);
    const omegaPend = Math.sqrt(g / restLength);
    return (
      `Spring Pendulum: k=${springConstant} N/m, m=${mass} kg, L0=${restLength} m. ` +
      `\u03B8=${thetaDeg.toFixed(1)}\u00B0, r=${r.toFixed(3)} m, extension=${extension.toFixed(3)} m. ` +
      `KE=${ke.toFixed(4)} J, PE_spring=${pe_spring.toFixed(4)} J. ` +
      `\u03C9_spring=${omegaSpring.toFixed(2)}, \u03C9_pend=${omegaPend.toFixed(2)} rad/s. ` +
      `Energy transfers between spring and pendulum modes. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    trail = [];
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpringPendulumFactory;
