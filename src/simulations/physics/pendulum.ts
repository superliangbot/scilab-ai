import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

const PendulumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pendulum") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Pendulum state
  let theta = 0; // current angle (radians)
  let omega = 0; // angular velocity (rad/s)
  let alpha = 0; // angular acceleration (rad/s^2)

  // Trail
  let trail: TrailPoint[] = [];

  // Params cache
  let length = 1.5; // meters
  let gravity = 9.8; // m/s^2
  let initialAngle = 30; // degrees
  let damping = 0;

  // Derived values
  let period = 0;
  let kineticEnergy = 0;
  let potentialEnergy = 0;
  let totalEnergy = 0;
  let maxAngle = 0;

  // Scale: how many pixels per meter
  function pixelsPerMeter(): number {
    return Math.min(width, height) * 0.28;
  }

  function pivotX(): number { return width / 2; }
  function pivotY(): number { return height * 0.15; }

  function bobPosition(): { x: number; y: number } {
    const ppm = pixelsPerMeter();
    const px = pivotX() + Math.sin(theta) * length * ppm;
    const py = pivotY() + Math.cos(theta) * length * ppm;
    return { x: px, y: py };
  }

  function computeEnergy(): void {
    // KE = 0.5 * m * v^2 = 0.5 * m * (L * omega)^2
    // PE = m * g * h = m * g * L * (1 - cos(theta))
    // Use m = 1 kg for simplicity
    const m = 1;
    const v = length * omega;
    kineticEnergy = 0.5 * m * v * v;
    potentialEnergy = m * gravity * length * (1 - Math.cos(theta));
    totalEnergy = kineticEnergy + potentialEnergy;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;

    theta = (initialAngle * Math.PI) / 180;
    omega = 0;
    maxAngle = Math.abs(theta);
    trail = [];
    computeEnergy();
    period = 2 * Math.PI * Math.sqrt(length / gravity);
  }

  function update(dt: number, params: Record<string, number>): void {
    const newLength = params.length ?? 1.5;
    const newGravity = params.gravity ?? 9.8;
    const newAngle = params.initialAngle ?? 30;
    const newDamping = params.damping ?? 0;

    // Detect parameter changes that require reset
    if (newLength !== length || newGravity !== gravity || newAngle !== initialAngle || newDamping !== damping) {
      const needsReset = newAngle !== initialAngle;
      length = newLength;
      gravity = newGravity;
      initialAngle = newAngle;
      damping = newDamping;
      period = 2 * Math.PI * Math.sqrt(length / gravity);

      if (needsReset) {
        theta = (initialAngle * Math.PI) / 180;
        omega = 0;
        maxAngle = Math.abs(theta);
        trail = [];
        time = 0;
      }
    }

    const step = Math.min(dt, 0.033);

    // Runge-Kutta 4th order for better accuracy
    const h = step;
    const f = (th: number, om: number): { dTheta: number; dOmega: number } => {
      const dTheta = om;
      const dOmega = -(gravity / length) * Math.sin(th) - damping * om;
      return { dTheta, dOmega };
    };

    const k1 = f(theta, omega);
    const k2 = f(theta + h / 2 * k1.dTheta, omega + h / 2 * k1.dOmega);
    const k3 = f(theta + h / 2 * k2.dTheta, omega + h / 2 * k2.dOmega);
    const k4 = f(theta + h * k3.dTheta, omega + h * k3.dOmega);

    theta += (h / 6) * (k1.dTheta + 2 * k2.dTheta + 2 * k3.dTheta + k4.dTheta);
    omega += (h / 6) * (k1.dOmega + 2 * k2.dOmega + 2 * k3.dOmega + k4.dOmega);
    alpha = -(gravity / length) * Math.sin(theta) - damping * omega;

    // Track max angle
    if (Math.abs(theta) > maxAngle) maxAngle = Math.abs(theta);

    // Update trail
    const bob = bobPosition();
    trail.push({ x: bob.x, y: bob.y, alpha: 1 });
    if (trail.length > 300) trail.splice(0, trail.length - 300);
    // Fade trail
    for (let i = 0; i < trail.length; i++) {
      trail[i].alpha = (i + 1) / trail.length;
    }

    computeEnergy();
    time += step;
  }

  function render(): void {
    // Dark background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1e");
    bgGrad.addColorStop(1, "#0f1528");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawArcTrail();
    drawEquilibriumLine();
    drawAmplitudeMarks();
    drawPendulum();
    drawEnergyBars();
    drawInfoPanel();
    drawPhysicsFormula();
  }

  function drawArcTrail(): void {
    if (trail.length < 2) return;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i].alpha * 0.6;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.strokeStyle = `rgba(100,200,255,${a})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawEquilibriumLine(): void {
    const px = pivotX();
    const py = pivotY();
    const ppm = pixelsPerMeter();

    // Dashed vertical line from pivot
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + length * ppm + 30);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("equilibrium", px, py + length * ppm + 45);
  }

  function drawAmplitudeMarks(): void {
    const px = pivotX();
    const py = pivotY();
    const ppm = pixelsPerMeter();

    // Draw amplitude arcs
    if (maxAngle > 0.01) {
      ctx.beginPath();
      const startA = Math.PI / 2 - maxAngle;
      const endA = Math.PI / 2 + maxAngle;
      ctx.arc(px, py, length * ppm * 0.3, startA, endA);
      ctx.strokeStyle = "rgba(255,200,50,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Amplitude labels
      const angleDeg = (maxAngle * 180 / Math.PI).toFixed(1);
      ctx.fillStyle = "rgba(255,200,50,0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`\u00B1${angleDeg}\u00B0`, px, py + length * ppm * 0.3 + 14);
    }
  }

  function drawPendulum(): void {
    const px = pivotX();
    const py = pivotY();
    const bob = bobPosition();
    const bobRadius = 16;

    // Pivot support
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.moveTo(px - 30, py - 5);
    ctx.lineTo(px + 30, py - 5);
    ctx.lineTo(px + 20, py + 5);
    ctx.lineTo(px - 20, py + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pivot point
    ctx.fillStyle = "#888";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // String/rod
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(bob.x, bob.y);
    ctx.strokeStyle = "rgba(200,200,200,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bob glow
    const glow = ctx.createRadialGradient(bob.x, bob.y, bobRadius * 0.5, bob.x, bob.y, bobRadius * 3);
    glow.addColorStop(0, "rgba(255,140,50,0.25)");
    glow.addColorStop(1, "rgba(255,140,50,0)");
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, bobRadius * 3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Bob body with gradient
    const bobGrad = ctx.createRadialGradient(
      bob.x - bobRadius * 0.3, bob.y - bobRadius * 0.3, 0,
      bob.x, bob.y, bobRadius
    );
    bobGrad.addColorStop(0, "#ffcc66");
    bobGrad.addColorStop(0.5, "#ff9933");
    bobGrad.addColorStop(1, "#cc6600");
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = bobGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Highlight
    ctx.beginPath();
    ctx.arc(bob.x - bobRadius * 0.25, bob.y - bobRadius * 0.25, bobRadius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
  }

  function drawEnergyBars(): void {
    const barX = width - 90;
    const barY = height * 0.22;
    const barW = 30;
    const maxBarH = height * 0.45;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(barX - 25, barY - 25, 105, maxBarH + 65, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy", barX + 27, barY - 10);

    const maxE = totalEnergy > 0.001 ? totalEnergy : 1;

    // KE bar (red)
    const keH = (kineticEnergy / maxE) * maxBarH;
    const keGrad = ctx.createLinearGradient(barX - 15, barY + maxBarH, barX - 15, barY + maxBarH - keH);
    keGrad.addColorStop(0, "#ff3333");
    keGrad.addColorStop(1, "#ff6666");
    ctx.fillStyle = keGrad;
    ctx.fillRect(barX - 15, barY + maxBarH - keH, barW - 5, keH);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(barX - 15, barY, barW - 5, maxBarH);

    // PE bar (blue)
    const peH = (potentialEnergy / maxE) * maxBarH;
    const peGrad = ctx.createLinearGradient(barX + 17, barY + maxBarH, barX + 17, barY + maxBarH - peH);
    peGrad.addColorStop(0, "#3366ff");
    peGrad.addColorStop(1, "#6699ff");
    ctx.fillStyle = peGrad;
    ctx.fillRect(barX + 17, barY + maxBarH - peH, barW - 5, peH);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.strokeRect(barX + 17, barY, barW - 5, maxBarH);

    // Total energy line (green)
    ctx.beginPath();
    ctx.moveTo(barX - 20, barY);
    ctx.lineTo(barX + barW + 20, barY);
    ctx.strokeStyle = "#22cc66";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff6666";
    ctx.fillText("KE", barX - 2, barY + maxBarH + 15);
    ctx.fillStyle = "#6699ff";
    ctx.fillText("PE", barX + 30, barY + maxBarH + 15);
    ctx.fillStyle = "#22cc66";
    ctx.fillText("Total", barX + 14, barY + maxBarH + 30);

    // Values
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#ff6666";
    ctx.fillText(`${kineticEnergy.toFixed(2)}J`, barX - 2, barY + maxBarH + 42);
    ctx.fillStyle = "#6699ff";
    ctx.fillText(`${potentialEnergy.toFixed(2)}J`, barX + 30, barY + maxBarH + 42);
  }

  function drawInfoPanel(): void {
    const panelW = 240;
    const panelH = 125;
    const px = 10;
    const py = 10;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Simple Pendulum", px + 10, py + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";

    const thetaDeg = (theta * 180 / Math.PI);
    ctx.fillText(`Period: ${period.toFixed(3)} s`, px + 10, py + 40);
    ctx.fillText(`Angle: ${thetaDeg.toFixed(1)}\u00B0`, px + 10, py + 56);
    ctx.fillText(`Angular vel: ${omega.toFixed(3)} rad/s`, px + 10, py + 72);
    ctx.fillStyle = "#ff6666";
    ctx.fillText(`KE: ${kineticEnergy.toFixed(3)} J`, px + 10, py + 88);
    ctx.fillStyle = "#6699ff";
    ctx.fillText(`PE: ${potentialEnergy.toFixed(3)} J`, px + 10, py + 104);
    ctx.fillStyle = "#22cc66";
    ctx.fillText(`Total: ${totalEnergy.toFixed(3)} J`, px + 130, py + 88);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`L=${length}m  g=${gravity}m/s\u00B2`, px + 10, py + 120);
  }

  function drawPhysicsFormula(): void {
    const fx = 10;
    const fy = height - 45;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(fx, fy, 280, 35, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("T = 2\u03C0\u221A(L/g)    \u03B1 = -(g/L)sin(\u03B8)", fx + 10, fy + 14);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("Small angle approx: sin(\u03B8) \u2248 \u03B8  \u2192  SHM", fx + 10, fy + 28);
  }

  function reset(): void {
    time = 0;
    theta = (initialAngle * Math.PI) / 180;
    omega = 0;
    maxAngle = Math.abs(theta);
    trail = [];
    computeEnergy();
  }

  function destroy(): void {
    trail = [];
  }

  function getStateDescription(): string {
    const thetaDeg = (theta * 180 / Math.PI).toFixed(1);
    return (
      `Simple Pendulum simulation. Length: ${length}m, gravity: ${gravity}m/s\u00B2. ` +
      `Initial angle: ${initialAngle}\u00B0, damping: ${damping}. ` +
      `Current angle: ${thetaDeg}\u00B0, angular velocity: ${omega.toFixed(3)} rad/s. ` +
      `Period: ${period.toFixed(3)}s. ` +
      `KE: ${kineticEnergy.toFixed(3)}J, PE: ${potentialEnergy.toFixed(3)}J, ` +
      `Total E: ${totalEnergy.toFixed(3)}J. ` +
      `Max amplitude: ${(maxAngle * 180 / Math.PI).toFixed(1)}\u00B0. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    trail = [];
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default PendulumFactory;
