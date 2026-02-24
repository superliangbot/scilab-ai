import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "force-movement",
  title: "Force and Movement (F=ma)",
  category: "physics",
  description:
    "Newton's second law in action — see how force and mass affect acceleration and movement.",
  longDescription:
    "Newton's second law states F = ma: the net force on an object equals its mass times its acceleration. This simulation shows an object on a frictionless surface being pushed by a force. Adjust the force (N) and mass (kg) to see how acceleration changes. The object's position, velocity, and acceleration are tracked in real time, demonstrating that doubling force doubles acceleration, while doubling mass halves it.",
  parameters: [
    { key: "force", label: "Applied Force", min: 0, max: 50, step: 1, defaultValue: 10, unit: "N" },
    { key: "mass", label: "Mass", min: 0.5, max: 20, step: 0.5, defaultValue: 2, unit: "kg" },
    { key: "friction", label: "Friction Coefficient", min: 0, max: 0.5, step: 0.05, defaultValue: 0 },
    { key: "timeInterval", label: "Time Markers", min: 0.5, max: 2, step: 0.5, defaultValue: 1, unit: "s" },
  ],
  thumbnailColor: "#dc2626",
};

const ForceMovementFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let force = 10;
  let mass = 2;
  let friction = 0;
  let timeInterval = 1;

  let position = 0; // meters
  let velocity = 0;
  let acceleration = 0;
  let positionMarkers: { time: number; pos: number }[] = [];

  const PIXELS_PER_METER = 40;
  const GROUND_Y_FRAC = 0.55;

  function drawGround() {
    const gy = H * GROUND_Y_FRAC;
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();

    // Ruler markings
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    const startM = Math.floor(-position) - 2;
    for (let m = startM; m < startM + Math.ceil(W / PIXELS_PER_METER) + 4; m++) {
      const px = W * 0.1 + (m + position) * PIXELS_PER_METER - (position * PIXELS_PER_METER % PIXELS_PER_METER);
      const worldM = m;
      ctx.beginPath();
      ctx.moveTo(px, gy);
      ctx.lineTo(px, gy + 8);
      ctx.stroke();
      if (worldM % 2 === 0) {
        ctx.fillText(`${worldM}m`, px, gy + 20);
      }
    }
  }

  function drawObject(objX: number) {
    const gy = H * GROUND_Y_FRAC;
    const blockW = 50 + mass * 3;
    const blockH = 40 + mass * 2;
    const bx = objX - blockW / 2;
    const by = gy - blockH;

    // Block
    const grad = ctx.createLinearGradient(bx, by, bx, by + blockH);
    grad.addColorStop(0, "#3b82f6");
    grad.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, blockW, blockH);
    ctx.strokeStyle = "#1e3a5f";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, blockW, blockH);

    // Mass label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mass} kg`, objX, by + blockH / 2);

    // Force arrow
    if (force > 0) {
      const arrowLen = Math.min(force * 3, 150);
      const ay = by + blockH / 2;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bx - 10, ay);
      ctx.lineTo(bx - 10 - arrowLen, ay);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(bx - 5, ay);
      ctx.lineTo(bx - 16, ay - 8);
      ctx.lineTo(bx - 16, ay + 8);
      ctx.closePath();
      ctx.fillStyle = "#ef4444";
      ctx.fill();

      // Force label
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`F = ${force} N`, bx - 10 - arrowLen / 2, ay - 16);
    }

    // Friction arrow (if any)
    if (friction > 0 && velocity > 0.01) {
      const frictionForce = friction * mass * 9.81;
      const fArrowLen = Math.min(frictionForce * 3, 100);
      const ay = by + blockH / 2;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx + blockW + 10, ay);
      ctx.lineTo(bx + blockW + 10 + fArrowLen, ay);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx + blockW + 5, ay);
      ctx.lineTo(bx + blockW + 16, ay - 6);
      ctx.lineTo(bx + blockW + 16, ay + 6);
      ctx.closePath();
      ctx.fillStyle = "#f59e0b";
      ctx.fill();

      ctx.fillStyle = "#f59e0b";
      ctx.font = "12px sans-serif";
      ctx.fillText(`f = ${frictionForce.toFixed(1)} N`, bx + blockW + 10 + fArrowLen / 2, ay - 14);
    }

    // Velocity vector
    if (Math.abs(velocity) > 0.1) {
      const vArrowLen = Math.min(Math.abs(velocity) * 8, 100);
      const vy = by - 20;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(objX, vy);
      ctx.lineTo(objX - vArrowLen, vy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(objX - vArrowLen - 5, vy);
      ctx.lineTo(objX - vArrowLen + 6, vy - 5);
      ctx.lineTo(objX - vArrowLen + 6, vy + 5);
      ctx.closePath();
      ctx.fillStyle = "#22c55e";
      ctx.fill();

      ctx.fillStyle = "#22c55e";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`v = ${velocity.toFixed(1)} m/s`, objX - vArrowLen / 2, vy - 10);
    }
  }

  function drawTimeMarkers(objX: number) {
    const gy = H * GROUND_Y_FRAC;
    ctx.fillStyle = "rgba(239,68,68,0.3)";
    for (const marker of positionMarkers) {
      const mx = objX - (position - marker.pos) * PIXELS_PER_METER;
      if (mx > 0 && mx < W) {
        ctx.beginPath();
        ctx.arc(mx, gy + 30, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`t=${marker.time.toFixed(1)}s`, mx, gy + 46);
        ctx.fillStyle = "rgba(239,68,68,0.3)";
      }
    }
  }

  function drawInfoPanel() {
    const px = W - 210;
    const py = 50;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(px, py, 200, 140);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, 200, 140);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("F = ma", px + 12, py + 22);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#475569";
    let ty = py + 44;
    ctx.fillText(`Force: ${force} N`, px + 12, ty); ty += 18;
    ctx.fillText(`Mass: ${mass} kg`, px + 12, ty); ty += 18;
    ctx.fillText(`a = F/m = ${acceleration.toFixed(2)} m/s²`, px + 12, ty); ty += 18;
    ctx.fillText(`v = ${velocity.toFixed(2)} m/s`, px + 12, ty); ty += 18;
    ctx.fillText(`x = ${position.toFixed(2)} m`, px + 12, ty); ty += 18;
    ctx.fillText(`t = ${time.toFixed(1)} s`, px + 12, ty);
  }

  function drawGraph() {
    const gx = 20;
    const gy = H * 0.72;
    const gw = W - 40;
    const gh = H * 0.24;

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(gx, gy, gw, gh);

    // v-t graph
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("v (m/s)", gx + 4, gy + 14);

    // Draw v-t line (v = at for constant force)
    const maxT = Math.max(time, 5);
    const maxV = Math.max(velocity, 10);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.min(time, maxT);
      const v = acceleration * t;
      const px = gx + (t / maxT) * gw;
      const py = gy + gh - (v / maxV) * gh * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Time axis
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("t (s)", gx + gw - 4, gy + gh - 4);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    force = params.force ?? 10;
    mass = params.mass ?? 2;
    friction = params.friction ?? 0;
    timeInterval = params.timeInterval ?? 1;
    time += dt;

    const frictionForce = velocity > 0.01 ? friction * mass * 9.81 : 0;
    const netForce = Math.max(0, force - frictionForce);
    acceleration = netForce / mass;
    velocity += acceleration * dt;
    position += velocity * dt;

    // Add time markers
    if (positionMarkers.length === 0 || time - positionMarkers[positionMarkers.length - 1].time >= timeInterval) {
      positionMarkers.push({ time, pos: position });
      if (positionMarkers.length > 20) positionMarkers.shift();
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#dbeafe");
    bg.addColorStop(1, "#f0f9ff");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Newton's Second Law: F = ma", W / 2, 28);

    drawGround();

    const objX = W * 0.1 + 20;
    drawObject(objX);
    drawTimeMarkers(objX);
    drawInfoPanel();
    drawGraph();
  }

  function reset() {
    time = 0;
    position = 0;
    velocity = 0;
    acceleration = 0;
    positionMarkers = [];
  }

  function destroy() {}

  function getStateDescription(): string {
    return `Newton's Second Law simulation: Applied force = ${force} N, mass = ${mass} kg, friction coefficient = ${friction}. Acceleration a = F/m = ${acceleration.toFixed(2)} m/s². Current velocity = ${velocity.toFixed(2)} m/s, position = ${position.toFixed(2)} m, time = ${time.toFixed(1)} s. ${friction > 0 ? `Friction force = ${(friction * mass * 9.81).toFixed(1)} N opposing motion.` : "No friction applied."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ForceMovementFactory;
