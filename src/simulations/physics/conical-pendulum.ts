import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ConicalPendulumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("conical-pendulum") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let stringLength = 1.5; // meters
  let coneAngle = 45; // degrees
  let gravity = 9.81; // m/s^2
  let showForces = 1;

  // Computed physics values
  let period = 0;
  let angularVelocity = 0;
  let radius = 0;
  let heightFromPivot = 0;
  let tension = 0;
  let centripetalForce = 0;

  // Current rotation angle
  let rotationAngle = 0;

  // Mass (fixed, for display)
  const mass = 1; // kg

  // 3D projection parameters
  const TILT_ANGLE = 0.45; // viewing tilt angle (radians) for pseudo-3D
  const SCALE_FACTOR = 120; // meters to pixels base

  // Trail for circular orbit visualization
  const orbitTrail: Array<{ x: number; y: number; alpha: number }> = [];
  const MAX_ORBIT_TRAIL = 80;

  function getScale(): number {
    return Math.min(width, height) / 5 * (SCALE_FACTOR / 120);
  }

  function computePhysics(): void {
    const thetaRad = (coneAngle * Math.PI) / 180;

    // Radius of circular orbit: r = L * sin(theta)
    radius = stringLength * Math.sin(thetaRad);

    // Height below pivot: h = L * cos(theta)
    heightFromPivot = stringLength * Math.cos(thetaRad);

    // Period: T = 2*pi*sqrt(L*cos(theta)/g)
    period = 2 * Math.PI * Math.sqrt((stringLength * Math.cos(thetaRad)) / gravity);

    // Angular velocity: omega = 2*pi/T
    angularVelocity = (2 * Math.PI) / period;

    // Tension: T*cos(theta) = mg => T = mg/cos(theta)
    tension = (mass * gravity) / Math.cos(thetaRad);

    // Centripetal force: T*sin(theta) = m*omega^2*r
    centripetalForce = tension * Math.sin(thetaRad);
  }

  // Project 3D point to 2D canvas with perspective
  function project3D(x3: number, y3: number, z3: number): { x: number; y: number } {
    const scale = getScale();
    // Simple oblique projection with tilt
    const cosT = Math.cos(TILT_ANGLE);
    const sinT = Math.sin(TILT_ANGLE);

    // Rotate around X axis for tilt
    const yRot = y3 * cosT - z3 * sinT;
    const zRot = y3 * sinT + z3 * cosT;

    // Perspective factor (mild)
    const perspectiveDist = 8;
    const pFactor = perspectiveDist / (perspectiveDist + zRot);

    const screenX = width / 2 + x3 * scale * pFactor;
    const screenY = height * 0.25 + yRot * scale * pFactor;

    return { x: screenX, y: screenY };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    rotationAngle = 0;
    orbitTrail.length = 0;
    computePhysics();
  }

  function update(dt: number, params: Record<string, number>): void {
    stringLength = params.stringLength ?? 1.5;
    coneAngle = params.angle ?? 45;
    gravity = params.gravity ?? 9.81;
    showForces = params.showForces ?? 1;

    computePhysics();

    // Update rotation
    rotationAngle += angularVelocity * dt;
    if (rotationAngle > Math.PI * 2) {
      rotationAngle -= Math.PI * 2;
    }

    // Update orbit trail
    const bobX = radius * Math.cos(rotationAngle);
    const bobZ = radius * Math.sin(rotationAngle);
    const bobY = heightFromPivot;
    const projected = project3D(bobX, bobY, bobZ);
    orbitTrail.push({ x: projected.x, y: projected.y, alpha: 1 });
    if (orbitTrail.length > MAX_ORBIT_TRAIL) {
      orbitTrail.shift();
    }

    time += dt;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#0d1028");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle floor grid
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const gridExtent = 3;
    const gridStep = 0.5;
    const floorY = heightFromPivot + 0.3;
    for (let gx = -gridExtent; gx <= gridExtent; gx += gridStep) {
      const p1 = project3D(gx, floorY, -gridExtent);
      const p2 = project3D(gx, floorY, gridExtent);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let gz = -gridExtent; gz <= gridExtent; gz += gridStep) {
      const p1 = project3D(-gridExtent, floorY, gz);
      const p2 = project3D(gridExtent, floorY, gz);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPivot(): void {
    const pivotPos = project3D(0, 0, 0);

    // Mounting bracket
    ctx.save();
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.roundRect(pivotPos.x - 20, pivotPos.y - 15, 40, 15, 4);
    ctx.fill();
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ceiling line
    ctx.strokeStyle = "rgba(100, 100, 120, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, pivotPos.y - 15);
    ctx.lineTo(width, pivotPos.y - 15);
    ctx.stroke();

    // Pivot point
    ctx.beginPath();
    ctx.arc(pivotPos.x, pivotPos.y, 5, 0, Math.PI * 2);
    const pivotGrad = ctx.createRadialGradient(pivotPos.x - 1, pivotPos.y - 1, 0, pivotPos.x, pivotPos.y, 5);
    pivotGrad.addColorStop(0, "#ccc");
    pivotGrad.addColorStop(1, "#666");
    ctx.fillStyle = pivotGrad;
    ctx.fill();
    ctx.restore();
  }

  function drawCircularOrbit(): void {
    ctx.save();

    // Draw the orbit circle as an ellipse in 3D
    const segments = 60;
    ctx.strokeStyle = "rgba(100, 200, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const ox = radius * Math.cos(angle);
      const oz = radius * Math.sin(angle);
      const oy = heightFromPivot;
      const p = project3D(ox, oy, oz);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Orbit trail (glowing)
    for (let i = 1; i < orbitTrail.length; i++) {
      const alpha = (i / orbitTrail.length) * 0.6;
      const lineWidth = 1 + (i / orbitTrail.length) * 2;
      ctx.beginPath();
      ctx.moveTo(orbitTrail[i - 1].x, orbitTrail[i - 1].y);
      ctx.lineTo(orbitTrail[i].x, orbitTrail[i].y);
      ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawString(): void {
    const pivotPos = project3D(0, 0, 0);
    const bobX = radius * Math.cos(rotationAngle);
    const bobZ = radius * Math.sin(rotationAngle);
    const bobPos = project3D(bobX, heightFromPivot, bobZ);

    ctx.save();
    ctx.strokeStyle = "rgba(200, 200, 220, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotPos.x, pivotPos.y);
    ctx.lineTo(bobPos.x, bobPos.y);
    ctx.stroke();

    // String highlight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pivotPos.x + 1, pivotPos.y);
    ctx.lineTo(bobPos.x + 1, bobPos.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBob(): void {
    const bobX3D = radius * Math.cos(rotationAngle);
    const bobZ3D = radius * Math.sin(rotationAngle);
    const bobPos = project3D(bobX3D, heightFromPivot, bobZ3D);
    const bobRadius = 14;

    // Outer glow
    const outerGlow = ctx.createRadialGradient(bobPos.x, bobPos.y, bobRadius * 0.5, bobPos.x, bobPos.y, bobRadius * 4);
    outerGlow.addColorStop(0, "rgba(59, 130, 246, 0.3)");
    outerGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
    ctx.beginPath();
    ctx.arc(bobPos.x, bobPos.y, bobRadius * 4, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Bob body
    const bodyGrad = ctx.createRadialGradient(
      bobPos.x - bobRadius * 0.3, bobPos.y - bobRadius * 0.3, 0,
      bobPos.x, bobPos.y, bobRadius
    );
    bodyGrad.addColorStop(0, "#ffffff");
    bodyGrad.addColorStop(0.25, "#3b82f6");
    bodyGrad.addColorStop(1, "#1e3a8a");
    ctx.beginPath();
    ctx.arc(bobPos.x, bobPos.y, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mass label
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${mass}kg`, bobPos.x, bobPos.y + 4);
  }

  function drawForceVectors(): void {
    if (showForces < 1) return;

    const bobX3D = radius * Math.cos(rotationAngle);
    const bobZ3D = radius * Math.sin(rotationAngle);
    const bobPos = project3D(bobX3D, heightFromPivot, bobZ3D);
    const pivotPos = project3D(0, 0, 0);

    const forceScale = 40; // pixels per N (scaled for visual)

    ctx.save();

    // Gravity (straight down in screen space)
    const weightLen = mass * gravity * forceScale / gravity; // normalized
    const weightY = bobPos.y + weightLen;
    ctx.strokeStyle = "rgba(255, 80, 80, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bobPos.x, bobPos.y);
    ctx.lineTo(bobPos.x, weightY);
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(bobPos.x, weightY);
    ctx.lineTo(bobPos.x - 6, weightY - 10);
    ctx.moveTo(bobPos.x, weightY);
    ctx.lineTo(bobPos.x + 6, weightY - 10);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 80, 80, 0.85)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("mg", bobPos.x + 10, weightY - 5);

    // Tension (along string toward pivot)
    const tensionNorm = tension * forceScale / gravity;
    const dx = pivotPos.x - bobPos.x;
    const dy = pivotPos.y - bobPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const tensionEndX = bobPos.x + nx * tensionNorm;
      const tensionEndY = bobPos.y + ny * tensionNorm;

      ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bobPos.x, bobPos.y);
      ctx.lineTo(tensionEndX, tensionEndY);
      ctx.stroke();
      // Arrowhead
      const tAngle = Math.atan2(ny, nx);
      ctx.beginPath();
      ctx.moveTo(tensionEndX, tensionEndY);
      ctx.lineTo(tensionEndX - 10 * Math.cos(tAngle - 0.4), tensionEndY - 10 * Math.sin(tAngle - 0.4));
      ctx.moveTo(tensionEndX, tensionEndY);
      ctx.lineTo(tensionEndX - 10 * Math.cos(tAngle + 0.4), tensionEndY - 10 * Math.sin(tAngle + 0.4));
      ctx.stroke();
      ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
      ctx.textAlign = "left";
      ctx.fillText("T", tensionEndX + 10, tensionEndY);
    }

    // Centripetal force (horizontal, toward center of orbit)
    const centerPos = project3D(0, heightFromPivot, 0);
    const cdx = centerPos.x - bobPos.x;
    const cdy = centerPos.y - bobPos.y;
    const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
    if (cDist > 0) {
      const cnx = cdx / cDist;
      const cny = cdy / cDist;
      const cpLen = centripetalForce * forceScale / gravity;
      const cpEndX = bobPos.x + cnx * cpLen;
      const cpEndY = bobPos.y + cny * cpLen;

      ctx.strokeStyle = "rgba(34, 197, 94, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bobPos.x, bobPos.y);
      ctx.lineTo(cpEndX, cpEndY);
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead
      const cpAngle = Math.atan2(cny, cnx);
      ctx.beginPath();
      ctx.moveTo(cpEndX, cpEndY);
      ctx.lineTo(cpEndX - 10 * Math.cos(cpAngle - 0.4), cpEndY - 10 * Math.sin(cpAngle - 0.4));
      ctx.moveTo(cpEndX, cpEndY);
      ctx.lineTo(cpEndX - 10 * Math.cos(cpAngle + 0.4), cpEndY - 10 * Math.sin(cpAngle + 0.4));
      ctx.stroke();
      ctx.fillStyle = "rgba(34, 197, 94, 0.85)";
      ctx.textAlign = "left";
      ctx.fillText("F_c", cpEndX + 10, cpEndY);
    }

    ctx.restore();
  }

  function drawAngleArc(): void {
    const pivotPos = project3D(0, 0, 0);
    const bobX3D = radius * Math.cos(rotationAngle);
    const bobZ3D = radius * Math.sin(rotationAngle);
    const bobPos = project3D(bobX3D, heightFromPivot, bobZ3D);

    // Draw angle arc at pivot
    const dx = bobPos.x - pivotPos.x;
    const dy = bobPos.y - pivotPos.y;
    const stringAngle = Math.atan2(dx, dy); // angle from vertical
    const verticalAngle = 0;

    const arcRadius = 30;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Draw arc from vertical to string direction
    const startAngle = -Math.PI / 2; // vertical (down in canvas coords, adjusted)
    const endAngle = startAngle + Math.abs(stringAngle);

    // Vertical reference line
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pivotPos.x, pivotPos.y);
    ctx.lineTo(pivotPos.x, pivotPos.y + 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arc
    ctx.beginPath();
    if (stringAngle >= 0) {
      ctx.arc(pivotPos.x, pivotPos.y, arcRadius, Math.PI / 2 - stringAngle, Math.PI / 2);
    } else {
      ctx.arc(pivotPos.x, pivotPos.y, arcRadius, Math.PI / 2, Math.PI / 2 - stringAngle);
    }
    ctx.stroke();

    // Angle label
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${coneAngle}\u00B0`, pivotPos.x + (stringAngle > 0 ? 20 : -20), pivotPos.y + arcRadius + 15);

    ctx.restore();
  }

  function drawHeightAndRadius(): void {
    const pivotPos = project3D(0, 0, 0);
    const centerBottom = project3D(0, heightFromPivot, 0);
    const bobX3D = radius * Math.cos(rotationAngle);
    const bobZ3D = radius * Math.sin(rotationAngle);
    const bobPos = project3D(bobX3D, heightFromPivot, bobZ3D);

    ctx.save();

    // Height line (vertical from pivot to orbit plane)
    ctx.strokeStyle = "rgba(168, 85, 247, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pivotPos.x, pivotPos.y);
    ctx.lineTo(centerBottom.x, centerBottom.y);
    ctx.stroke();

    // Height label
    ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    const midHY = (pivotPos.y + centerBottom.y) / 2;
    ctx.fillText(`h = ${heightFromPivot.toFixed(2)}m`, pivotPos.x - 10, midHY);

    // Radius line (horizontal from center to bob)
    ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(centerBottom.x, centerBottom.y);
    ctx.lineTo(bobPos.x, bobPos.y);
    ctx.stroke();

    // Radius label
    ctx.fillStyle = "rgba(100, 200, 255, 0.7)";
    ctx.textAlign = "center";
    const midRX = (centerBottom.x + bobPos.x) / 2;
    const midRY = (centerBottom.y + bobPos.y) / 2;
    ctx.fillText(`r = ${radius.toFixed(2)}m`, midRX, midRY - 10);

    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 260;
    const panelH = 155;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Conical Pendulum", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 38);
    ctx.fillText(`L = ${stringLength.toFixed(1)}m, \u03B8 = ${coneAngle}\u00B0`, panelX + 10, panelY + 54);
    ctx.fillText(`r = L\u00B7sin(\u03B8) = ${radius.toFixed(3)}m`, panelX + 10, panelY + 70);
    ctx.fillText(`h = L\u00B7cos(\u03B8) = ${heightFromPivot.toFixed(3)}m`, panelX + 10, panelY + 86);
    ctx.fillText(`Period = 2\u03C0\u221A(L\u00B7cos\u03B8/g) = ${period.toFixed(3)}s`, panelX + 10, panelY + 102);
    ctx.fillText(`\u03C9 = ${angularVelocity.toFixed(2)} rad/s`, panelX + 10, panelY + 118);

    ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
    ctx.fillText(`T = mg/cos\u03B8 = ${tension.toFixed(2)} N`, panelX + 10, panelY + 134);
    ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
    ctx.fillText(`F_c = ${centripetalForce.toFixed(2)} N`, panelX + 140, panelY + 134);

    ctx.restore();
  }

  function drawPhysicsEquations(): void {
    ctx.save();
    const panelW = 210;
    const panelH = 60;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("T\u00B7cos\u03B8 = mg (vertical)", panelX + 10, panelY + 20);
    ctx.fillText("T\u00B7sin\u03B8 = m\u03C9\u00B2r (centripetal)", panelX + 10, panelY + 38);
    ctx.fillText(`g = ${gravity.toFixed(2)} m/s\u00B2`, panelX + 10, panelY + 54);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawCircularOrbit();
    drawHeightAndRadius();
    drawPivot();
    drawString();
    drawAngleArc();
    drawBob();
    drawForceVectors();
    drawInfoPanel();
    drawPhysicsEquations();
  }

  function reset(): void {
    time = 0;
    rotationAngle = 0;
    orbitTrail.length = 0;
    computePhysics();
  }

  function destroy(): void {
    orbitTrail.length = 0;
  }

  function getStateDescription(): string {
    const speed = angularVelocity * radius;
    return (
      `Conical Pendulum: L=${stringLength}m, \u03B8=${coneAngle}\u00B0, g=${gravity}m/s\u00B2. ` +
      `Radius: ${radius.toFixed(3)}m, Height: ${heightFromPivot.toFixed(3)}m. ` +
      `Period: ${period.toFixed(3)}s, \u03C9=${angularVelocity.toFixed(2)}rad/s. ` +
      `Speed: ${speed.toFixed(2)}m/s. ` +
      `Tension: ${tension.toFixed(2)}N, Centripetal force: ${centripetalForce.toFixed(2)}N. ` +
      `T\u00B7cos(\u03B8)=mg, T\u00B7sin(\u03B8)=m\u03C9\u00B2r. ` +
      `Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    orbitTrail.length = 0;
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

export default ConicalPendulumFactory;
