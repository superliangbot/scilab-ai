import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

const FreeFall2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("free-fall-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let gravity = 9.81;
  let height1 = 50;
  let height2 = 80;
  let mass1 = 1;
  let mass2 = 5;

  // State
  let y1 = 0; // distance fallen by object 1
  let y2 = 0;
  let v1 = 0;
  let v2 = 0;
  let landed1 = false;
  let landed2 = false;
  let landTime1 = 0;
  let landTime2 = 0;

  const trail1: Array<{ t: number; y: number; v: number }> = [];
  const trail2: Array<{ t: number; y: number; v: number }> = [];

  function reset(): void {
    time = 0;
    y1 = 0;
    y2 = 0;
    v1 = 0;
    v2 = 0;
    landed1 = false;
    landed2 = false;
    landTime1 = 0;
    landTime2 = 0;
    trail1.length = 0;
    trail2.length = 0;
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
    const newH1 = params.height1 ?? 50;
    const newH2 = params.height2 ?? 80;
    const newM1 = params.mass1 ?? 1;
    const newM2 = params.mass2 ?? 5;

    if (newG !== gravity || newH1 !== height1 || newH2 !== height2 || newM1 !== mass1 || newM2 !== mass2) {
      gravity = newG;
      height1 = newH1;
      height2 = newH2;
      mass1 = newM1;
      mass2 = newM2;
      reset();
    }

    if (landed1 && landed2) return;

    time += dt;

    // Object 1
    if (!landed1) {
      v1 = gravity * time;
      y1 = 0.5 * gravity * time * time;
      if (y1 >= height1) {
        y1 = height1;
        v1 = Math.sqrt(2 * gravity * height1);
        landed1 = true;
        landTime1 = Math.sqrt((2 * height1) / gravity);
      }
      trail1.push({ t: time, y: y1, v: v1 });
    }

    // Object 2
    if (!landed2) {
      v2 = gravity * time;
      y2 = 0.5 * gravity * time * time;
      if (y2 >= height2) {
        y2 = height2;
        v2 = Math.sqrt(2 * gravity * height2);
        landed2 = true;
        landTime2 = Math.sqrt((2 * height2) / gravity);
      }
      trail2.push({ t: time, y: y2, v: v2 });
    }
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0e27");
    grad.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGround(): void {
    const groundY = H - 60;
    ctx.fillStyle = "#2d5016";
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = "#4a8c28";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
  }

  function drawObject(
    x: number,
    topY: number,
    distFallen: number,
    dropHeight: number,
    mass: number,
    color: string,
    label: string,
    landed: boolean
  ): void {
    const groundY = H - 60;
    const maxVisualH = groundY - topY;
    const frac = distFallen / dropHeight;
    const objY = topY + frac * maxVisualH;
    const radius = 12 + mass * 2;

    // Drop height line
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Height marker
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`h=${dropHeight}m`, x, topY - 8);

    // Object
    const objGrad = ctx.createRadialGradient(x - 3, objY - 3, 2, x, objY, radius);
    objGrad.addColorStop(0, color);
    objGrad.addColorStop(1, shadeColor(color, -40));
    ctx.beginPath();
    ctx.arc(x, Math.min(objY, groundY - radius), radius, 0, Math.PI * 2);
    ctx.fillStyle = objGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mass label on object
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mass}kg`, x, Math.min(objY, groundY - radius));

    // Label
    ctx.fillStyle = color;
    ctx.font = "bold 13px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, topY - 28);

    // Impact flash
    if (landed) {
      ctx.beginPath();
      ctx.arc(x, groundY, radius + 10, Math.PI, 2 * Math.PI);
      ctx.fillStyle = "rgba(255, 200, 50, 0.3)";
      ctx.fill();
    }
  }

  function shadeColor(color: string, percent: number): string {
    const num = parseInt(color.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
    return `rgb(${r},${g},${b})`;
  }

  function drawGraph(): void {
    const gx = W - 280;
    const gy = 20;
    const gw = 260;
    const gh = 160;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Position vs Time", gx + gw / 2, gy + 6);

    const plotX = gx + 40;
    const plotY = gy + 28;
    const plotW = gw - 55;
    const plotH = gh - 44;

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("t (s)", plotX + plotW / 2, plotY + plotH + 12);
    ctx.save();
    ctx.translate(plotX - 25, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("y (m)", 0, 0);
    ctx.restore();

    const maxT = Math.max(Math.sqrt((2 * Math.max(height1, height2)) / gravity) * 1.2, 1);
    const maxY = Math.max(height1, height2) * 1.1;

    function plotTrail(trail: Array<{ t: number; y: number }>, color: string): void {
      if (trail.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const px = plotX + (trail[i].t / maxT) * plotW;
        const py = plotY + (trail[i].y / maxY) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    plotTrail(trail1, "#4fc3f7");
    plotTrail(trail2, "#ff8a65");
  }

  function drawInfo(): void {
    const x = 20;
    let y = 20;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(x, y, 220, 170, 8);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Free Fall Comparison", x + 10, y + 10);

    ctx.font = "12px monospace";
    y += 32;
    ctx.fillStyle = "#4fc3f7";
    ctx.fillText(`Object A (${mass1}kg):`, x + 10, y);
    y += 18;
    ctx.fillStyle = "#ccc";
    ctx.fillText(` y = ${y1.toFixed(1)} m`, x + 10, y);
    y += 16;
    ctx.fillText(` v = ${v1.toFixed(1)} m/s`, x + 10, y);
    y += 16;
    ctx.fillText(` ${landed1 ? `Landed at t=${landTime1.toFixed(2)}s` : "Falling..."}`, x + 10, y);

    y += 22;
    ctx.fillStyle = "#ff8a65";
    ctx.fillText(`Object B (${mass2}kg):`, x + 10, y);
    y += 18;
    ctx.fillStyle = "#ccc";
    ctx.fillText(` y = ${y2.toFixed(1)} m`, x + 10, y);
    y += 16;
    ctx.fillText(` v = ${v2.toFixed(1)} m/s`, x + 10, y);
    y += 16;
    ctx.fillText(` ${landed2 ? `Landed at t=${landTime2.toFixed(2)}s` : "Falling..."}`, x + 10, y);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Free Fall — Mass Does Not Affect Fall Time", W / 2, H - 20);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("y = ½gt²  •  v = gt  •  t = √(2h/g)", W / 2, H - 4);
  }

  function render(): void {
    drawBackground();
    drawGround();

    const cx1 = W * 0.33;
    const cx2 = W * 0.55;
    const topY = 60;

    drawObject(cx1, topY, y1, height1, mass1, "#4fc3f7", "Object A", landed1);
    drawObject(cx2, topY, y2, height2, mass2, "#ff8a65", "Object B", landed2);

    drawGraph();
    drawInfo();
    drawTitle();

    // Time display
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`t = ${time.toFixed(2)} s  |  g = ${gravity.toFixed(1)} m/s²`, W / 2, 8);
  }

  function destroy(): void {
    trail1.length = 0;
    trail2.length = 0;
  }

  function getStateDescription(): string {
    return (
      `Free Fall Comparison: g=${gravity} m/s². ` +
      `Object A: mass=${mass1}kg, drop height=${height1}m, fallen=${y1.toFixed(1)}m, v=${v1.toFixed(1)} m/s${landed1 ? `, landed at t=${landTime1.toFixed(2)}s` : ", falling"}. ` +
      `Object B: mass=${mass2}kg, drop height=${height2}m, fallen=${y2.toFixed(1)}m, v=${v2.toFixed(1)} m/s${landed2 ? `, landed at t=${landTime2.toFixed(2)}s` : ", falling"}. ` +
      `Key insight: Both objects accelerate at the same rate regardless of mass (in vacuum). ` +
      `Time depends only on height: t=√(2h/g).`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FreeFall2Factory;
