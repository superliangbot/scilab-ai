import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "free-fall",
  title: "Free Fall",
  category: "physics",
  description:
    "Drop an object and study free fall — see distance, velocity, and acceleration under gravity.",
  longDescription:
    "In free fall, the only force acting on an object is gravity, causing constant acceleration g ≈ 9.8 m/s². The equations of motion are: v = gt, d = ½gt², where v is velocity and d is distance fallen. This simulation drops a ball and shows its position at equal time intervals — notice the increasing spacing, which demonstrates acceleration. Track position on a d-t graph (parabolic) and velocity on a v-t graph (linear).",
  parameters: [
    { key: "gravity", label: "Gravity", min: 1, max: 20, step: 0.1, defaultValue: 9.8, unit: "m/s²" },
    { key: "initialHeight", label: "Initial Height", min: 10, max: 100, step: 5, defaultValue: 50, unit: "m" },
    { key: "showTrail", label: "Show Trail (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
    { key: "timeInterval", label: "Snapshot Interval", min: 0.2, max: 1, step: 0.1, defaultValue: 0.5, unit: "s" },
  ],
  thumbnailColor: "#0369a1",
};

const FreeFallFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let gravity = 9.8;
  let initialHeight = 50;
  let showTrail = 1;
  let timeInterval = 0.5;

  let distance = 0;
  let velocity = 0;
  let hasLanded = false;
  let snapshots: { time: number; dist: number; vel: number }[] = [];
  let lastSnapshot = 0;

  const SCALE = 4; // pixels per meter

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    grad.addColorStop(0, "#7dd3fc");
    grad.addColorStop(1, "#bae6fd");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W * 0.4, H);
  }

  function drawRuler() {
    const rx = W * 0.33;
    const topY = 60;
    const bottomY = H - 30;
    const rulerH = bottomY - topY;
    const mPerPixel = initialHeight / rulerH;

    // Ruler bar
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(rx, topY, 30, rulerH);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, topY, 30, rulerH);

    // Markings
    ctx.fillStyle = "#475569";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    const step = initialHeight > 50 ? 10 : 5;
    for (let m = 0; m <= initialHeight; m += step) {
      const y = topY + (m / initialHeight) * rulerH;
      ctx.beginPath();
      ctx.moveTo(rx, y);
      ctx.lineTo(rx + 8, y);
      ctx.strokeStyle = "#64748b";
      ctx.stroke();
      ctx.fillText(`${m}m`, rx - 4, y + 3);
    }

    return { topY, bottomY, rulerH, mPerPixel };
  }

  function drawBall(ruler: { topY: number; rulerH: number }) {
    const bx = W * 0.2;
    const by = ruler.topY + (distance / initialHeight) * ruler.rulerH;
    const ballR = 15;

    // Trail snapshots
    if (showTrail) {
      for (let i = 0; i < snapshots.length; i++) {
        const s = snapshots[i];
        const sy = ruler.topY + (s.dist / initialHeight) * ruler.rulerH;
        const alpha = 0.15 + (i / snapshots.length) * 0.3;
        ctx.beginPath();
        ctx.arc(bx, sy, ballR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${alpha})`;
        ctx.fill();

        // Time label
        ctx.fillStyle = `rgba(100,116,139,${alpha + 0.2})`;
        ctx.font = "9px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`t=${s.time.toFixed(1)}s`, bx + ballR + 4, sy + 3);
      }
    }

    // Current ball
    if (!hasLanded) {
      ctx.beginPath();
      ctx.arc(bx, by, ballR, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(bx - 4, by - 4, 0, bx, by, ballR);
      grad.addColorStop(0, "#fca5a5");
      grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "#b91c1c";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Ground
    const groundY = ruler.topY + ruler.rulerH;
    ctx.fillStyle = "#92400e";
    ctx.fillRect(0, groundY, W * 0.4, H - groundY);
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W * 0.4, groundY);
    ctx.stroke();

    // Ground hatching
    ctx.strokeStyle = "rgba(120,53,15,0.3)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W * 0.4; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 10, groundY + 15);
      ctx.stroke();
    }
  }

  function drawDistanceTimeGraph(ruler: { topY: number; rulerH: number }) {
    const gx = W * 0.44;
    const gy = 60;
    const gw = W * 0.24;
    const gh = (H - 80) * 0.45;

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Distance vs Time", gx + gw / 2, gy + 16);

    // Axes
    const axisX = gx + 30;
    const axisY = gy + gh - 20;
    const plotW = gw - 40;
    const plotH = gh - 40;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisX, gy + 20);
    ctx.lineTo(axisX, axisY);
    ctx.lineTo(gx + gw - 8, axisY);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("t (s)", gx + gw / 2, axisY + 14);
    ctx.save();
    ctx.translate(axisX - 14, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("d (m)", 0, 0);
    ctx.restore();

    // d = ½gt² curve
    const maxT = Math.sqrt(2 * initialHeight / gravity) * 1.1;
    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 100; i++) {
      const t = (i / 100) * maxT;
      const d = 0.5 * gravity * t * t;
      const px = axisX + (t / maxT) * plotW;
      const py = axisY - (d / initialHeight) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Current point
    const cpx = axisX + (time / maxT) * plotW;
    const cpy = axisY - (distance / initialHeight) * plotH;
    if (time > 0 && !hasLanded) {
      ctx.beginPath();
      ctx.arc(cpx, cpy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
    }

    // Snapshot dots
    for (const s of snapshots) {
      const spx = axisX + (s.time / maxT) * plotW;
      const spy = axisY - (s.dist / initialHeight) * plotH;
      ctx.beginPath();
      ctx.arc(spx, spy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239,68,68,0.5)";
      ctx.fill();
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("d = ½gt²", axisX + 4, gy + 32);
  }

  function drawVelocityTimeGraph() {
    const gx = W * 0.72;
    const gy = 60;
    const gw = W * 0.24;
    const gh = (H - 80) * 0.45;

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Velocity vs Time", gx + gw / 2, gy + 16);

    const axisX = gx + 30;
    const axisY = gy + gh - 20;
    const plotW = gw - 40;
    const plotH = gh - 40;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisX, gy + 20);
    ctx.lineTo(axisX, axisY);
    ctx.lineTo(gx + gw - 8, axisY);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("t (s)", gx + gw / 2, axisY + 14);

    const maxT = Math.sqrt(2 * initialHeight / gravity) * 1.1;
    const maxV = gravity * maxT;

    // v = gt line
    ctx.beginPath();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.moveTo(axisX, axisY);
    ctx.lineTo(axisX + plotW, axisY - plotH);
    ctx.stroke();

    // Current point
    if (time > 0 && !hasLanded) {
      const cpx = axisX + (time / maxT) * plotW;
      const cpy = axisY - (velocity / maxV) * plotH;
      ctx.beginPath();
      ctx.arc(cpx, cpy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
    }

    // Snapshot dots
    for (const s of snapshots) {
      const spx = axisX + (s.time / maxT) * plotW;
      const spy = axisY - (s.vel / maxV) * plotH;
      ctx.beginPath();
      ctx.arc(spx, spy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239,68,68,0.5)";
      ctx.fill();
    }

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("v = gt", axisX + 4, gy + 32);
  }

  function drawInfoPanel() {
    const px = W * 0.44;
    const py = H * 0.56;
    const pw = W * 0.52;
    const ph = H * 0.38;

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Free Fall Data", px + 12, py + 22);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#475569";
    let ty = py + 44;
    ctx.fillText(`g = ${gravity} m/s²`, px + 12, ty); ty += 18;
    ctx.fillText(`Height = ${initialHeight} m`, px + 12, ty); ty += 18;
    ctx.fillText(`Time = ${time.toFixed(2)} s`, px + 12, ty); ty += 18;
    ctx.fillText(`Distance = ${distance.toFixed(2)} m`, px + 12, ty); ty += 18;
    ctx.fillText(`Velocity = ${velocity.toFixed(2)} m/s`, px + 12, ty); ty += 18;

    if (hasLanded) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("LANDED!", px + 12, ty); ty += 18;
      const fallTime = Math.sqrt(2 * initialHeight / gravity);
      const impactV = gravity * fallTime;
      ctx.fillStyle = "#475569";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Fall time = ${fallTime.toFixed(2)} s`, px + 12, ty); ty += 18;
      ctx.fillText(`Impact velocity = ${impactV.toFixed(2)} m/s`, px + 12, ty);
    }

    // Formulas
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    ctx.fillText("v = g × t", px + pw - 12, py + 44);
    ctx.fillText("d = ½ × g × t²", px + pw - 12, py + 62);
    ctx.fillText(`v² = 2 × g × d`, px + pw - 12, py + 80);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    gravity = params.gravity ?? 9.8;
    initialHeight = params.initialHeight ?? 50;
    showTrail = params.showTrail ?? 1;
    timeInterval = params.timeInterval ?? 0.5;

    if (!hasLanded) {
      time += dt;
      velocity = gravity * time;
      distance = 0.5 * gravity * time * time;

      if (distance >= initialHeight) {
        distance = initialHeight;
        velocity = Math.sqrt(2 * gravity * initialHeight);
        hasLanded = true;
      }

      // Record snapshots
      if (time - lastSnapshot >= timeInterval) {
        snapshots.push({ time, dist: distance, vel: velocity });
        lastSnapshot = time;
        if (snapshots.length > 30) snapshots.shift();
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#f0f9ff";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Free Fall Motion", W / 2, 28);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Constant acceleration under gravity", W / 2, 46);

    drawSky();
    const ruler = drawRuler();
    drawBall(ruler);
    drawDistanceTimeGraph(ruler);
    drawVelocityTimeGraph();
    drawInfoPanel();
  }

  function reset() {
    time = 0;
    distance = 0;
    velocity = 0;
    hasLanded = false;
    snapshots = [];
    lastSnapshot = 0;
  }

  function destroy() {}

  function getStateDescription(): string {
    const fallTime = Math.sqrt(2 * initialHeight / gravity);
    return `Free Fall: g=${gravity} m/s², height=${initialHeight} m. ${hasLanded ? `Object has landed after ${fallTime.toFixed(2)} s with impact velocity ${(gravity * fallTime).toFixed(2)} m/s.` : `Falling for ${time.toFixed(2)} s. Distance fallen: ${distance.toFixed(2)} m. Current velocity: ${velocity.toFixed(2)} m/s.`} The d-t graph is parabolic (d=½gt²) and the v-t graph is linear (v=gt), confirming constant acceleration.`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FreeFallFactory;
