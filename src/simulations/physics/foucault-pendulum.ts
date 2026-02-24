import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "foucault-pendulum",
  title: "Foucault Pendulum",
  category: "physics",
  description:
    "Watch Earth's rotation revealed by a Foucault pendulum — precession depends on latitude.",
  longDescription:
    "The Foucault Pendulum, demonstrated by Léon Foucault in 1851, provides visual proof of Earth's rotation. A freely swinging pendulum appears to change its oscillation plane over time due to the Coriolis effect. The precession rate depends on latitude: at the North Pole it completes 360° per day, at the equator there is zero precession, following ω = 360°·sin(latitude)/day.",
  parameters: [
    { key: "latitude", label: "Latitude", min: -90, max: 90, step: 5, defaultValue: 45, unit: "°" },
    { key: "amplitude", label: "Amplitude", min: 5, max: 40, step: 1, defaultValue: 20, unit: "°" },
    { key: "timeScale", label: "Time Scale", min: 1, max: 200, step: 10, defaultValue: 50, unit: "×" },
    { key: "showTrace", label: "Show Trace (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
  ],
  thumbnailColor: "#1d4ed8",
};

const FoucaultPendulumFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let latitude = 45;
  let amplitude = 20;
  let timeScale = 50;
  let showTrace = 1;

  let pendulumAngle = 0; // oscillation angle
  let precessionAngle = 0;
  let tracePoints: { x: number; y: number }[] = [];
  const maxTrace = 3000;

  function degToRad(d: number): number {
    return (d * Math.PI) / 180;
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
    tracePoints = [];
  }

  function update(dt: number, params: Record<string, number>) {
    latitude = params.latitude ?? 45;
    amplitude = params.amplitude ?? 20;
    timeScale = params.timeScale ?? 50;
    showTrace = params.showTrace ?? 1;

    const scaledDt = dt * timeScale;
    time += scaledDt;

    // Pendulum oscillation (simplified harmonic)
    const period = 2; // seconds for one swing
    const omega = (2 * Math.PI) / period;
    pendulumAngle = degToRad(amplitude) * Math.sin(omega * time);

    // Precession: 360 * sin(latitude) degrees per day = ω_p degrees per second
    const precessionRate = (360 * Math.sin(degToRad(latitude))) / (24 * 3600); // deg/s
    precessionAngle += precessionRate * scaledDt;

    // Record trace
    const cx = W / 2;
    const cy = H * 0.42;
    const pendLen = Math.min(W, H) * 0.28;
    const swingX = pendLen * Math.sin(pendulumAngle) * Math.cos(degToRad(precessionAngle));
    const swingY = pendLen * Math.sin(pendulumAngle) * Math.sin(degToRad(precessionAngle));
    const bobX = cx + swingX;
    const bobY = cy + Math.abs(swingY) + pendLen * Math.cos(pendulumAngle) * 0.1;

    tracePoints.push({ x: cx + swingX, y: cy + swingY });
    if (tracePoints.length > maxTrace) tracePoints.shift();
  }

  function drawFloor() {
    const cx = W / 2;
    const cy = H * 0.58;
    const rx = Math.min(W, H) * 0.35;
    const ry = rx * 0.3;

    // Floor ellipse
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Compass markings
    const dirs = ["N", "E", "S", "W"];
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      ctx.fillText(dirs[i], cx + rx * 0.9 * Math.cos(a), cy + ry * 0.9 * Math.sin(a));
    }

    // Degree marks
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    for (let d = 0; d < 360; d += 15) {
      const a = degToRad(d);
      const r1 = 0.78;
      const r2 = d % 45 === 0 ? 0.85 : 0.82;
      ctx.beginPath();
      ctx.moveTo(cx + rx * r1 * Math.cos(a), cy + ry * r1 * Math.sin(a));
      ctx.lineTo(cx + rx * r2 * Math.cos(a), cy + ry * r2 * Math.sin(a));
      ctx.stroke();
    }
  }

  function drawPendulum() {
    const cx = W / 2;
    const pivotY = H * 0.1;
    const pendLen = Math.min(W, H) * 0.28;

    // Swing in the precessing plane
    const swingDisp = pendLen * Math.sin(pendulumAngle);
    const precRad = degToRad(precessionAngle);
    const bobX = cx + swingDisp * Math.cos(precRad);
    const bobVisualY = H * 0.42 + pendLen * (1 - Math.cos(pendulumAngle)) * 0.3;

    // Pivot mount
    ctx.fillStyle = "#475569";
    ctx.fillRect(cx - 30, pivotY - 10, 60, 12);
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(cx, pivotY, 5, 0, Math.PI * 2);
    ctx.fill();

    // String
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, pivotY);
    ctx.lineTo(bobX, bobVisualY);
    ctx.stroke();

    // Bob
    const bobR = 12;
    ctx.beginPath();
    ctx.arc(bobX, bobVisualY, bobR, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(bobX - 3, bobVisualY - 3, 0, bobX, bobVisualY, bobR);
    grad.addColorStop(0, "#fbbf24");
    grad.addColorStop(1, "#b45309");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Shadow on floor
    const shadowY = H * 0.58;
    ctx.beginPath();
    ctx.ellipse(bobX, shadowY, 8, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
  }

  function drawTrace() {
    if (!showTrace || tracePoints.length < 2) return;

    const cx = W / 2;
    const cy = H * 0.58;
    const scaleX = Math.min(W, H) * 0.35 / (Math.min(W, H) * 0.3);
    const scaleY = scaleX * 0.3;

    ctx.beginPath();
    for (let i = 0; i < tracePoints.length; i++) {
      const p = tracePoints[i];
      const dx = (p.x - W / 2) * scaleX;
      const dy = (p.y - H * 0.42) * scaleY;
      const alpha = i / tracePoints.length;

      if (i === 0) {
        ctx.moveTo(cx + dx, cy + dy);
      } else {
        ctx.lineTo(cx + dx, cy + dy);
      }
    }
    ctx.strokeStyle = "rgba(251,191,36,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawInfo() {
    const px = 10;
    const py = H * 0.72;
    const pw = W - 20;
    const ph = H * 0.26;

    ctx.fillStyle = "rgba(15,23,42,0.9)";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(px, py, pw, ph);

    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Foucault Pendulum", px + 12, py + 20);

    const precRate = (360 * Math.sin(degToRad(latitude))) / 24;
    const hoursForFull = latitude === 0 ? Infinity : 24 / Math.abs(Math.sin(degToRad(latitude)));

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    let ty = py + 40;
    ctx.fillText(`Latitude: ${latitude}°`, px + 12, ty); ty += 18;
    ctx.fillText(`Precession: ${precRate.toFixed(1)}°/hour`, px + 12, ty); ty += 18;
    ctx.fillText(`Full rotation: ${hoursForFull === Infinity ? "∞ (equator)" : hoursForFull.toFixed(1) + " hours"}`, px + 12, ty); ty += 18;
    ctx.fillText(`Accumulated: ${(precessionAngle % 360).toFixed(1)}°`, px + 12, ty);

    // Formula
    ctx.fillStyle = "#64748b";
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    ctx.fillText("ω = 360° × sin(φ) / day", px + pw - 12, py + 40);
    ctx.fillText(`ω = 360° × sin(${latitude}°) / 24h`, px + pw - 12, py + 58);
    ctx.fillText(`ω = ${precRate.toFixed(2)}°/hour`, px + pw - 12, py + 76);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c1222");
    bg.addColorStop(1, "#1e293b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Foucault Pendulum — Proof of Earth's Rotation", W / 2, 24);

    drawFloor();
    drawTrace();
    drawPendulum();
    drawInfo();
  }

  function reset() {
    time = 0;
    pendulumAngle = 0;
    precessionAngle = 0;
    tracePoints = [];
  }

  function destroy() {}

  function getStateDescription(): string {
    const precRate = (360 * Math.sin(degToRad(latitude))) / 24;
    return `Foucault Pendulum at latitude ${latitude}°. Precession rate: ${precRate.toFixed(1)}°/hour. Accumulated precession: ${(precessionAngle % 360).toFixed(1)}°. Time scale: ${timeScale}×. The pendulum's plane of oscillation rotates relative to Earth's surface due to the Coriolis effect, with precession rate proportional to sin(latitude). ${Math.abs(latitude) > 60 ? "Near-polar latitude — fast precession." : Math.abs(latitude) < 15 ? "Near-equatorial — very slow precession." : "Mid-latitude — moderate precession."}`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FoucaultPendulumFactory;
