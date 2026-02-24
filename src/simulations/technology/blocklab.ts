import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Code block definition ──────────────────────────────────────────
interface CodeBlock {
  label: string;
  color: string;
  value: string;
  indent: number;
}

// ─── Position-time graph point ──────────────────────────────────────
interface GraphPoint {
  t: number;
  x: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const BlockLabFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("blocklab") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (cached)
  let initialVelocity = 5;
  let acceleration = 2;
  let showGraph = 1;
  let showBlocks = 1;

  // State
  let position = 0; // metres along track
  let velocity = 0; // current velocity m/s
  let graphPoints: GraphPoint[] = [];
  const MAX_GRAPH_POINTS = 300;

  // Track geometry
  const TRACK_LEFT_FRAC = 0.35; // left side is blocks panel
  const TRACK_RIGHT_PAD = 30;
  const TRACK_Y_FRAC = 0.35; // vertical position of the track

  // Ball
  const BALL_RADIUS = 12;

  // Maximum simulation time before wrap
  const MAX_TIME = 15;

  // ── Helpers ───────────────────────────────────────────────────────
  function computePosition(t: number): number {
    // x(t) = x₀ + v₀t + ½at²
    return initialVelocity * t + 0.5 * acceleration * t * t;
  }

  function computeVelocity(t: number): number {
    // v(t) = v₀ + at
    return initialVelocity + acceleration * t;
  }

  function getCodeBlocks(): CodeBlock[] {
    return [
      { label: "SET initial_position", color: "#6366f1", value: "x₀ = 0 m", indent: 0 },
      { label: "SET initial_velocity", color: "#3b82f6", value: `v₀ = ${initialVelocity} m/s`, indent: 0 },
      { label: "SET acceleration", color: "#10b981", value: `a = ${acceleration.toFixed(1)} m/s²`, indent: 0 },
      { label: "SET time_step", color: "#8b5cf6", value: "dt = 0.016 s", indent: 0 },
      { label: "REPEAT forever", color: "#f59e0b", value: "", indent: 0 },
      { label: "velocity ← velocity + a × dt", color: "#06b6d4", value: `v = ${velocity.toFixed(1)} m/s`, indent: 1 },
      { label: "position ← position + v × dt", color: "#ec4899", value: `x = ${position.toFixed(1)} m`, indent: 1 },
      { label: "DRAW ball at position", color: "#ef4444", value: "", indent: 1 },
      { label: "WAIT dt", color: "#64748b", value: "", indent: 1 },
    ];
  }

  // Track length in metres (clamped)
  function getTrackLengthM(): number {
    // Compute max position within MAX_TIME
    const maxPos = Math.abs(computePosition(MAX_TIME));
    return Math.max(maxPos, 20);
  }

  // ── Engine ────────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      position = 0;
      velocity = initialVelocity;
      graphPoints = [];
    },

    update(dt: number, params: Record<string, number>) {
      const newV0 = params.initialVelocity ?? initialVelocity;
      const newA = params.acceleration ?? acceleration;
      const newShowGraph = params.showGraph ?? showGraph;
      const newShowBlocks = params.showBlocks ?? showBlocks;

      // Reset on parameter change
      if (newV0 !== initialVelocity || newA !== acceleration) {
        initialVelocity = newV0;
        acceleration = newA;
        time = 0;
        position = 0;
        velocity = initialVelocity;
        graphPoints = [];
      }

      showGraph = newShowGraph;
      showBlocks = newShowBlocks;

      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      // Wrap time
      if (time > MAX_TIME) {
        time = 0;
        position = 0;
        velocity = initialVelocity;
        graphPoints = [];
      }

      position = computePosition(time);
      velocity = computeVelocity(time);

      // Record graph point
      graphPoints.push({ t: time, x: position });
      if (graphPoints.length > MAX_GRAPH_POINTS) graphPoints.shift();
    },

    render() {
      if (!ctx) return;

      // ── Background ──────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0a0a1a");
      bgGrad.addColorStop(1, "#10102a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Title ───────────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("BlockLab: Visual Programming for Linear Motion", W / 2, 24);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("x(t) = x\u2080 + v\u2080t + \u00BDat\u00B2  |  Uniform Acceleration  |  Kinematics", W / 2, 42);

      // ── Layout ──────────────────────────────────────
      const blocksWidth = showBlocks ? W * TRACK_LEFT_FRAC : 0;
      const simLeft = blocksWidth;
      const simWidth = W - simLeft;
      const trackY = H * TRACK_Y_FRAC;
      const graphTop = showGraph ? H * 0.50 : H;
      const graphBottom = H - 30;

      // ── Code blocks panel ─────────────────────────────
      if (showBlocks) {
        // Panel background
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(0, 55, blocksWidth - 10, H - 65);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 55, blocksWidth - 10, H - 65);

        // Panel title
        ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "left";
        ctx.fillText("Algorithm Blocks", 12, 75);

        const blocks = getCodeBlocks();
        const blockH = 32;
        const blockGap = 6;
        const startY = 90;
        const baseX = 12;

        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          const bx = baseX + b.indent * 20;
          const by = startY + i * (blockH + blockGap);
          const bw = blocksWidth - 30 - b.indent * 20;

          // Highlight current executing block
          const isExecuting = (i >= 5 && i <= 8); // the loop body
          const alpha = isExecuting ? 0.95 : 0.7;

          // Block shadow
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.roundRect(bx + 2, by + 2, bw, blockH, 6);
          ctx.fill();

          // Block body
          ctx.fillStyle = b.color;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, blockH, 6);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Notch at bottom (Scratch-like connector)
          if (i < blocks.length - 1) {
            ctx.fillStyle = b.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.roundRect(bx + 15, by + blockH - 1, 24, 5, 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          // Block text
          ctx.font = "bold 10px 'Courier New', monospace";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.fillText(b.label, bx + 8, by + 14);

          // Value text
          if (b.value) {
            ctx.font = "9px 'Courier New', monospace";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText(b.value, bx + 8, by + 26);
          }

          // Execution indicator
          if (isExecuting) {
            const pulse = 0.5 + 0.5 * Math.sin(time * 6);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.4 * pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, blockH, 6);
            ctx.stroke();

            // Arrow indicator
            ctx.fillStyle = `rgba(255, 255, 0, ${0.6 + 0.4 * pulse})`;
            ctx.beginPath();
            ctx.moveTo(bx - 8, by + blockH / 2);
            ctx.lineTo(bx - 2, by + blockH / 2 - 5);
            ctx.lineTo(bx - 2, by + blockH / 2 + 5);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // ── Track area ────────────────────────────────────
      const trackLeft = simLeft + 20;
      const trackRight = W - TRACK_RIGHT_PAD;
      const trackWidth = trackRight - trackLeft;

      // Track background
      ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
      ctx.fillRect(trackLeft, trackY - 40, trackWidth, 80);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(trackLeft, trackY - 40, trackWidth, 80);

      // Track rail
      ctx.fillStyle = "#475569";
      ctx.fillRect(trackLeft, trackY - 2, trackWidth, 4);

      // Track tick marks
      const trackLenM = getTrackLengthM();
      const numTicks = Math.min(20, Math.max(5, Math.ceil(trackLenM / 5)));
      const tickSpacingM = trackLenM / numTicks;

      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";

      for (let i = 0; i <= numTicks; i++) {
        const posM = i * tickSpacingM;
        const px = trackLeft + (posM / trackLenM) * trackWidth;
        ctx.beginPath();
        ctx.moveTo(px, trackY + 2);
        ctx.lineTo(px, trackY + 10);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.stroke();
        if (i % 2 === 0) {
          ctx.fillText(`${posM.toFixed(0)}m`, px, trackY + 22);
        }
      }

      // Ball position on track
      const clampedPos = Math.max(0, Math.min(position, trackLenM));
      const ballX = trackLeft + (clampedPos / trackLenM) * trackWidth;
      const ballY = trackY;

      // Ball glow
      const ballGlow = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, BALL_RADIUS * 2.5);
      ballGlow.addColorStop(0, "rgba(59, 130, 246, 0.4)");
      ballGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx.beginPath();
      ctx.arc(ballX, ballY, BALL_RADIUS * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = ballGlow;
      ctx.fill();

      // Ball body
      const ballGrad = ctx.createRadialGradient(
        ballX - 3, ballY - 3, 0,
        ballX, ballY, BALL_RADIUS
      );
      ballGrad.addColorStop(0, "#93c5fd");
      ballGrad.addColorStop(0.5, "#3b82f6");
      ballGrad.addColorStop(1, "#1d4ed8");
      ctx.beginPath();
      ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Velocity arrow on ball
      const arrowScale = Math.min(Math.abs(velocity) * 3, 60);
      const arrowDir = velocity >= 0 ? 1 : -1;
      if (Math.abs(velocity) > 0.1) {
        ctx.beginPath();
        ctx.moveTo(ballX, ballY - BALL_RADIUS - 6);
        ctx.lineTo(ballX + arrowDir * arrowScale, ballY - BALL_RADIUS - 6);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(ballX + arrowDir * arrowScale, ballY - BALL_RADIUS - 6);
        ctx.lineTo(ballX + arrowDir * (arrowScale - 6), ballY - BALL_RADIUS - 11);
        ctx.lineTo(ballX + arrowDir * (arrowScale - 6), ballY - BALL_RADIUS - 1);
        ctx.closePath();
        ctx.fillStyle = "#22c55e";
        ctx.fill();

        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#22c55e";
        ctx.textAlign = "center";
        ctx.fillText(`v = ${velocity.toFixed(1)} m/s`, ballX + arrowDir * arrowScale / 2, ballY - BALL_RADIUS - 14);
      }

      // ── Info panel ────────────────────────────────────
      const panelX = simLeft + 10;
      const panelY = 55;
      const panelW = simWidth - 20;
      const panelH = 55;

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 8);
      ctx.fill();

      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      const col1X = panelX + 12;
      const col2X = panelX + panelW * 0.35;
      const col3X = panelX + panelW * 0.65;

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`t = ${time.toFixed(2)} s`, col1X, panelY + 20);
      ctx.fillStyle = "#34d399";
      ctx.fillText(`v = ${velocity.toFixed(2)} m/s`, col2X, panelY + 20);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`x = ${position.toFixed(2)} m`, col3X, panelY + 20);

      ctx.fillStyle = "#c084fc";
      ctx.fillText(`v\u2080 = ${initialVelocity} m/s`, col1X, panelY + 40);
      ctx.fillStyle = "#f472b6";
      ctx.fillText(`a = ${acceleration.toFixed(1)} m/s\u00B2`, col2X, panelY + 40);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`x = v\u2080t + \u00BDat\u00B2`, col3X, panelY + 40);

      // ── Position-time graph ───────────────────────────
      if (showGraph && graphPoints.length > 1) {
        const gLeft = simLeft + 30;
        const gRight = W - 30;
        const gTop = graphTop + 10;
        const gBottom = graphBottom;
        const gWidth = gRight - gLeft;
        const gHeight = gBottom - gTop;

        // Graph background
        ctx.fillStyle = "rgba(15, 20, 40, 0.85)";
        ctx.fillRect(gLeft, gTop, gWidth, gHeight);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.strokeRect(gLeft, gTop, gWidth, gHeight);

        // Graph title
        ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.textAlign = "center";
        ctx.fillText("Position-Time Graph (x vs t)", (gLeft + gRight) / 2, gTop - 6);

        // Axes labels
        ctx.font = "10px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText("Time (s)", (gLeft + gRight) / 2, gBottom + 16);

        ctx.save();
        ctx.translate(gLeft - 14, (gTop + gBottom) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillText("Position (m)", 0, 0);
        ctx.restore();

        // Determine axis ranges
        const tMax = Math.max(time, 1);
        let xMin = 0;
        let xMax = 1;
        for (const pt of graphPoints) {
          if (pt.x < xMin) xMin = pt.x;
          if (pt.x > xMax) xMax = pt.x;
        }
        // Add padding
        const xRange = xMax - xMin || 1;
        xMin -= xRange * 0.05;
        xMax += xRange * 0.1;

        // Draw theoretical curve (dashed)
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        const curveSteps = 100;
        for (let i = 0; i <= curveSteps; i++) {
          const t2 = (i / curveSteps) * tMax;
          const x2 = computePosition(t2);
          const px = gLeft + (t2 / tMax) * gWidth;
          const py = gBottom - ((x2 - xMin) / (xMax - xMin)) * gHeight;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Plot recorded points
        ctx.beginPath();
        for (let i = 0; i < graphPoints.length; i++) {
          const pt = graphPoints[i];
          const px = gLeft + (pt.t / tMax) * gWidth;
          const py = gBottom - ((pt.x - xMin) / (xMax - xMin)) * gHeight;
          if (px < gLeft || px > gRight || py < gTop || py > gBottom) continue;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Current point highlight
        const lastPt = graphPoints[graphPoints.length - 1];
        const cpx = gLeft + (lastPt.t / tMax) * gWidth;
        const cpy = gBottom - ((lastPt.x - xMin) / (xMax - xMin)) * gHeight;
        if (cpx >= gLeft && cpx <= gRight && cpy >= gTop && cpy <= gBottom) {
          const glow = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, 10);
          glow.addColorStop(0, "rgba(56, 189, 248, 0.5)");
          glow.addColorStop(1, "rgba(56, 189, 248, 0)");
          ctx.beginPath();
          ctx.arc(cpx, cpy, 10, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(cpx, cpy, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#38bdf8";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Axis ticks
        ctx.font = "9px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";

        const tStep = tMax > 10 ? 2 : tMax > 5 ? 1 : 0.5;
        for (let t2 = 0; t2 <= tMax; t2 += tStep) {
          const px = gLeft + (t2 / tMax) * gWidth;
          ctx.beginPath();
          ctx.moveTo(px, gBottom);
          ctx.lineTo(px, gBottom + 4);
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillText(t2.toFixed(1), px, gBottom + 14);
        }

        ctx.textAlign = "right";
        const xStep = xRange > 100 ? 20 : xRange > 50 ? 10 : xRange > 10 ? 5 : 1;
        for (let x2 = Math.ceil(xMin / xStep) * xStep; x2 <= xMax; x2 += xStep) {
          const py = gBottom - ((x2 - xMin) / (xMax - xMin)) * gHeight;
          if (py < gTop || py > gBottom) continue;
          ctx.beginPath();
          ctx.moveTo(gLeft, py);
          ctx.lineTo(gLeft - 4, py);
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillText(x2.toFixed(0), gLeft - 6, py + 3);
        }
      }

      // ── Time indicator ────────────────────────────────
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      time = 0;
      position = 0;
      velocity = initialVelocity;
      graphPoints = [];
    },

    destroy() {
      graphPoints = [];
    },

    getStateDescription(): string {
      return (
        `BlockLab Linear Motion: v\u2080=${initialVelocity} m/s, a=${acceleration.toFixed(1)} m/s\u00B2. ` +
        `Time: ${time.toFixed(2)}s. Position: x=${position.toFixed(2)} m. Velocity: v=${velocity.toFixed(2)} m/s. ` +
        `Equation: x(t) = ${initialVelocity}t + \u00BD(${acceleration.toFixed(1)})t\u00B2. ` +
        `Visual code blocks drive the motion algorithm. ` +
        `Graph shows ${showGraph ? "position vs time (parabolic for constant acceleration)" : "hidden"}.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default BlockLabFactory;
