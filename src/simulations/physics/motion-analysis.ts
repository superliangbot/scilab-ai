import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MotionAnalysisFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("motion-analysis") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Motion parameters
  let initialVelocity = 5;
  let acceleration = 2;
  let interval = 0.3;
  let showVectors = 1;

  // Recorded positions
  interface Snapshot {
    t: number;
    x: number;
    v: number;
  }
  let snapshots: Snapshot[] = [];
  let maxTime = 0;

  // Layout
  const MARGIN_LEFT = 80;
  const MARGIN_RIGHT = 40;
  const TRACK_Y_RATIO = 0.35;
  const GRAPH_TOP_RATIO = 0.55;
  const GRAPH_BOTTOM_RATIO = 0.92;

  function posAtTime(t: number): number {
    return initialVelocity * t + 0.5 * acceleration * t * t;
  }

  function velAtTime(t: number): number {
    return initialVelocity + acceleration * t;
  }

  function computeSnapshots(): void {
    snapshots = [];
    maxTime = Math.max(4, time);
    const maxX = posAtTime(maxTime);
    if (maxX <= 0) return;
    let t = 0;
    while (t <= time + 0.001) {
      snapshots.push({ t, x: posAtTime(t), v: velAtTime(t) });
      t += interval;
    }
  }

  function xToCanvas(x: number, maxX: number): number {
    const drawW = width - MARGIN_LEFT - MARGIN_RIGHT;
    return MARGIN_LEFT + (x / Math.max(maxX, 1)) * drawW;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    snapshots = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    initialVelocity = params.initialVelocity ?? 5;
    acceleration = params.acceleration ?? 2;
    interval = params.interval ?? 0.3;
    showVectors = params.showVectors ?? 1;

    time += dt;
    if (time > 10) time = 10;

    computeSnapshots();
  }

  function drawTrack(): void {
    const trackY = height * TRACK_Y_RATIO;
    const maxX = Math.max(posAtTime(Math.max(4, time)), 1);

    // Ground
    ctx.fillStyle = "#1e3a2a";
    ctx.fillRect(0, trackY + 20, width, height * 0.1);

    // Track line
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN_LEFT, trackY);
    ctx.lineTo(width - MARGIN_RIGHT, trackY);
    ctx.stroke();

    // Tick marks on track
    const numTicks = 10;
    const tickSpacing = maxX / numTicks;
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    for (let i = 0; i <= numTicks; i++) {
      const xVal = i * tickSpacing;
      const cx = xToCanvas(xVal, maxX);
      ctx.beginPath();
      ctx.moveTo(cx, trackY - 5);
      ctx.lineTo(cx, trackY + 5);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillText(xVal.toFixed(1) + "m", cx, trackY + 18);
      }
    }

    // Draw snapshots as circles (stroboscopic)
    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      const cx = xToCanvas(s.x, maxX);
      const alpha = 0.3 + 0.7 * (i / Math.max(snapshots.length - 1, 1));

      // Ball
      const grad = ctx.createRadialGradient(cx - 2, trackY - 12, 0, cx, trackY - 10, 12);
      grad.addColorStop(0, "#fff");
      grad.addColorStop(0.4, `rgba(59, 130, 246, ${alpha})`);
      grad.addColorStop(1, `rgba(30, 64, 175, ${alpha})`);
      ctx.beginPath();
      ctx.arc(cx, trackY - 10, 10, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Velocity vector
      if (showVectors >= 1) {
        const vScale = 3;
        const vLen = s.v * vScale;
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, trackY - 10);
        ctx.lineTo(cx + vLen, trackY - 10);
        ctx.stroke();

        // Arrow head
        if (Math.abs(vLen) > 5) {
          const dir = vLen > 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(cx + vLen, trackY - 10);
          ctx.lineTo(cx + vLen - dir * 6, trackY - 15);
          ctx.lineTo(cx + vLen - dir * 6, trackY - 5);
          ctx.closePath();
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.fill();
        }
      }

      // Time label
      ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`t=${s.t.toFixed(1)}s`, cx, trackY - 26);
    }

    // Displacement arrows between consecutive snapshots
    if (snapshots.length > 1) {
      ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      for (let i = 0; i < snapshots.length - 1; i++) {
        const cx1 = xToCanvas(snapshots[i].x, maxX);
        const cx2 = xToCanvas(snapshots[i + 1].x, maxX);
        ctx.beginPath();
        ctx.moveTo(cx1, trackY + 28);
        ctx.lineTo(cx2, trackY + 28);
        ctx.stroke();

        // Delta x label
        const dx = snapshots[i + 1].x - snapshots[i].x;
        ctx.fillStyle = "rgba(34, 197, 94, 0.7)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Δx=${dx.toFixed(2)}`, (cx1 + cx2) / 2, trackY + 40);
      }
      ctx.setLineDash([]);
    }
  }

  function drawGraphs(): void {
    const graphTop = height * GRAPH_TOP_RATIO;
    const graphBottom = height * GRAPH_BOTTOM_RATIO;
    const graphH = graphBottom - graphTop;
    const graphW = (width - MARGIN_LEFT - MARGIN_RIGHT - 30) / 2;
    const graph1X = MARGIN_LEFT;
    const graph2X = MARGIN_LEFT + graphW + 30;

    const tMax = Math.max(4, time);

    // Position-time graph
    drawSingleGraph(
      graph1X, graphTop, graphW, graphH,
      "Position vs Time (x-t)",
      "t (s)", "x (m)",
      tMax,
      (t: number) => posAtTime(t),
      "#3b82f6",
      snapshots.map(s => ({ t: s.t, val: s.x }))
    );

    // Velocity-time graph
    drawSingleGraph(
      graph2X, graphTop, graphW, graphH,
      "Velocity vs Time (v-t)",
      "t (s)", "v (m/s)",
      tMax,
      (t: number) => velAtTime(t),
      "#ef4444",
      snapshots.map(s => ({ t: s.t, val: s.v }))
    );
  }

  function drawSingleGraph(
    gx: number, gy: number, gw: number, gh: number,
    title: string, xLabel: string, yLabel: string,
    tMax: number,
    fn: (t: number) => number,
    color: string,
    points: { t: number; val: number }[]
  ): void {
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.beginPath();
    ctx.roundRect(gx - 5, gy - 5, gw + 10, gh + 10, 6);
    ctx.fill();

    // Title
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(title, gx + gw / 2, gy + 14);

    const plotLeft = gx + 35;
    const plotRight = gx + gw - 10;
    const plotTop = gy + 25;
    const plotBottom = gy + gh - 25;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Find value range
    let maxVal = 0;
    for (let t = 0; t <= tMax; t += 0.05) {
      maxVal = Math.max(maxVal, Math.abs(fn(t)));
    }
    maxVal = Math.max(maxVal, 1) * 1.2;

    // Grid
    ctx.strokeStyle = "rgba(100, 116, 139, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = plotTop + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();

      const val = maxVal * (1 - i / 2);
      ctx.fillStyle = "#64748b";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(val.toFixed(1), plotLeft - 4, y + 3);
    }

    // Axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xLabel, plotLeft + plotW / 2, plotBottom + 18);

    ctx.save();
    ctx.translate(gx + 8, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Curve
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let t = 0; t <= Math.min(time, tMax); t += 0.02) {
      const cx = plotLeft + (t / tMax) * plotW;
      const val = fn(t);
      const cy = plotBottom - (val / maxVal) * plotH;
      if (first) { ctx.moveTo(cx, cy); first = false; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Data points
    for (const p of points) {
      const cx = plotLeft + (p.t / tMax) * plotW;
      const cy = plotBottom - (p.val / maxVal) * plotH;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1222");
    bgGrad.addColorStop(1, "#132040");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Motion Analysis — Stroboscopic View", width / 2, 28);

    drawTrack();
    drawGraphs();

    // Info panel
    const panelW = 200;
    const panelX = width - panelW - 15;
    const panelY = 8;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, 90, 6);
    ctx.fill();

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    const currentX = posAtTime(time);
    const currentV = velAtTime(time);
    ctx.fillText(`Time: ${time.toFixed(2)} s`, panelX + 10, panelY + 18);
    ctx.fillText(`Position: ${currentX.toFixed(2)} m`, panelX + 10, panelY + 34);
    ctx.fillText(`Velocity: ${currentV.toFixed(2)} m/s`, panelX + 10, panelY + 50);
    ctx.fillText(`Acceleration: ${acceleration.toFixed(2)} m/s²`, panelX + 10, panelY + 66);
    ctx.fillText(`x = v₀t + ½at²`, panelX + 10, panelY + 82);
  }

  function reset(): void {
    time = 0;
    snapshots = [];
  }

  function destroy(): void {
    snapshots = [];
  }

  function getStateDescription(): string {
    const currentX = posAtTime(time);
    const currentV = velAtTime(time);
    return (
      `Motion Analysis: v₀=${initialVelocity} m/s, a=${acceleration} m/s². ` +
      `Time: ${time.toFixed(2)}s. Position: ${currentX.toFixed(2)} m. ` +
      `Velocity: ${currentV.toFixed(2)} m/s. ` +
      `Snapshot interval: ${interval}s, ${snapshots.length} snapshots recorded. ` +
      `Shows stroboscopic positions with velocity vectors and x-t, v-t graphs.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MotionAnalysisFactory;
