import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const FreeFallingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("free-falling") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let gravity = 9.81;
  let initialHeight = 100;
  let airResistance = 0;

  let y = 0; // distance fallen
  let v = 0;
  let landed = false;

  // Stroboscopic snapshots
  const snapshots: Array<{ y: number; t: number; v: number }> = [];
  let lastSnapTime = 0;
  const SNAP_INTERVAL = 0.3;

  // Graph data
  const posData: Array<{ t: number; y: number }> = [];
  const velData: Array<{ t: number; v: number }> = [];
  const accData: Array<{ t: number; a: number }> = [];

  function reset(): void {
    time = 0;
    y = 0;
    v = 0;
    landed = false;
    snapshots.length = 0;
    posData.length = 0;
    velData.length = 0;
    accData.length = 0;
    lastSnapTime = 0;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    reset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newG = params.gravity ?? 9.81;
    const newH = params.initialHeight ?? 100;
    const newAir = params.airResistance ?? 0;

    if (newG !== gravity || newH !== initialHeight || newAir !== airResistance) {
      gravity = newG;
      initialHeight = newH;
      airResistance = newAir;
      reset();
    }

    if (landed) return;

    time += dt;

    // With optional air resistance (drag coefficient)
    const dragForce = airResistance * v * v;
    const a = gravity - dragForce;
    v += a * dt;
    y += v * dt;

    if (y >= initialHeight) {
      y = initialHeight;
      v = 0;
      landed = true;
    }

    // Record data
    posData.push({ t: time, y });
    velData.push({ t: time, v });
    accData.push({ t: time, a });

    // Stroboscopic snapshots
    if (time - lastSnapTime >= SNAP_INTERVAL) {
      snapshots.push({ y, t: time, v });
      lastSnapTime = time;
    }
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d1b2a");
    grad.addColorStop(1, "#1b2838");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawRuler(): void {
    const rulerX = 60;
    const topY = 50;
    const groundY = H - 70;
    const rulerH = groundY - topY;

    // Ruler line
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerX, topY);
    ctx.lineTo(rulerX, groundY);
    ctx.stroke();

    // Tick marks
    const numTicks = 10;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= numTicks; i++) {
      const frac = i / numTicks;
      const py = topY + frac * rulerH;
      const heightVal = initialHeight * frac;
      ctx.beginPath();
      ctx.moveTo(rulerX - 5, py);
      ctx.lineTo(rulerX + 5, py);
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillText(`${heightVal.toFixed(0)}m`, rulerX - 10, py);
      }
    }
  }

  function drawFallingObject(): void {
    const topY = 50;
    const groundY = H - 70;
    const objX = 160;
    const frac = y / initialHeight;
    const objY = topY + frac * (groundY - topY);
    const radius = 18;

    // Stroboscopic trail
    for (let i = 0; i < snapshots.length; i++) {
      const sf = snapshots[i].y / initialHeight;
      const sy = topY + sf * (groundY - topY);
      const alpha = 0.15 + 0.15 * (i / snapshots.length);
      ctx.beginPath();
      ctx.arc(objX, sy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(66, 165, 245, ${alpha})`;
      ctx.fill();
      // Time label
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${snapshots[i].t.toFixed(1)}s`, objX + radius + 4, sy + 3);
    }

    // Current object
    const grad = ctx.createRadialGradient(objX - 4, objY - 4, 3, objX, objY, radius);
    grad.addColorStop(0, "#64b5f6");
    grad.addColorStop(1, "#1565c0");
    ctx.beginPath();
    ctx.arc(objX, Math.min(objY, groundY), radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Velocity arrow
    if (!landed && v > 0) {
      const arrowLen = Math.min(v * 2, 80);
      const ax = objX;
      const ay = Math.min(objY, groundY);
      ctx.strokeStyle = "#ef5350";
      ctx.fillStyle = "#ef5350";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax + radius + 5, ay);
      ctx.lineTo(ax + radius + 5 + arrowLen, ay);
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(ax + radius + 5 + arrowLen, ay);
      ctx.lineTo(ax + radius + arrowLen - 2, ay - 5);
      ctx.lineTo(ax + radius + arrowLen - 2, ay + 5);
      ctx.closePath();
      ctx.fill();

      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`v=${v.toFixed(1)} m/s`, ax + radius + 8, ay - 10);
    }

    // Ground
    ctx.fillStyle = "#3e5c2a";
    ctx.fillRect(0, groundY, W * 0.35, H - groundY);
    ctx.strokeStyle = "#6a9c3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W * 0.35, groundY);
    ctx.stroke();

    if (landed) {
      ctx.fillStyle = "rgba(255,200,50,0.4)";
      ctx.beginPath();
      ctx.arc(objX, groundY, radius + 15, Math.PI, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = "#ffeb3b";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LANDED", objX, groundY + 25);
    }
  }

  function drawGraphs(): void {
    const gx = W * 0.38;
    const gw = W * 0.58;
    const graphH = (H - 80) / 3;

    const maxT = landed
      ? time * 1.1
      : Math.max(Math.sqrt((2 * initialHeight) / gravity) * 1.3, time * 1.1);

    function drawMiniGraph(
      title: string,
      data: Array<{ t: number; val: number }>,
      maxVal: number,
      color: string,
      unit: string,
      yOff: number
    ): void {
      const gy = yOff;
      const px = gx + 45;
      const py = gy + 22;
      const pw = gw - 65;
      const ph = graphH - 36;

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, graphH - 6, 6);
      ctx.fill();

      // Title
      ctx.fillStyle = color;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(title, gx + 10, gy + 4);

      // Axes
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + ph);
      ctx.lineTo(px + pw, py + ph);
      ctx.stroke();

      // Axis labels
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${maxVal.toFixed(0)} ${unit}`, px - 4, py + 2);
      ctx.fillText("0", px - 4, py + ph);
      ctx.textAlign = "center";
      ctx.fillText(`${maxT.toFixed(1)}s`, px + pw, py + ph + 11);

      // Data line
      if (data.length > 1) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const dx = px + (data[i].t / maxT) * pw;
          const dy = py + ph - (data[i].val / maxVal) * ph;
          if (i === 0) ctx.moveTo(dx, dy);
          else ctx.lineTo(dx, dy);
        }
        ctx.stroke();
      }
    }

    const maxY = initialHeight * 1.1;
    const maxV = airResistance > 0
      ? Math.sqrt(gravity / Math.max(airResistance, 0.001)) * 1.1
      : Math.sqrt(2 * gravity * initialHeight) * 1.1;
    const maxA = gravity * 1.3;

    drawMiniGraph(
      "Position (distance fallen)",
      posData.map((d) => ({ t: d.t, val: d.y })),
      maxY, "#42a5f5", "m", 20
    );
    drawMiniGraph(
      "Velocity",
      velData.map((d) => ({ t: d.t, val: d.v })),
      maxV, "#ef5350", "m/s", 20 + graphH
    );
    drawMiniGraph(
      "Acceleration",
      accData.map((d) => ({ t: d.t, val: Math.max(d.a, 0) })),
      maxA, "#66bb6a", "m/s²", 20 + graphH * 2
    );
  }

  function drawInfo(): void {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `Free Falling  |  t = ${time.toFixed(2)}s  |  g = ${gravity.toFixed(1)} m/s²`,
      W / 2, H - 6
    );
  }

  function render(): void {
    drawBackground();
    drawRuler();
    drawFallingObject();
    drawGraphs();
    drawInfo();
  }

  function destroy(): void {
    snapshots.length = 0;
    posData.length = 0;
    velData.length = 0;
    accData.length = 0;
  }

  function getStateDescription(): string {
    const a = gravity - airResistance * v * v;
    return (
      `Free Falling: g=${gravity} m/s², height=${initialHeight}m, air resistance coeff=${airResistance}. ` +
      `Time: ${time.toFixed(2)}s. Distance fallen: ${y.toFixed(1)}m. ` +
      `Velocity: ${v.toFixed(1)} m/s. Acceleration: ${a.toFixed(2)} m/s². ` +
      `${landed ? "Object has landed." : "Object is falling."} ` +
      `Theoretical fall time (no drag): ${Math.sqrt((2 * initialHeight) / gravity).toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FreeFallingFactory;
