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

// ─── Trail point ────────────────────────────────────────────────────
interface TrailPoint {
  x: number;
  y: number;
}

// ─── Factory ────────────────────────────────────────────────────────
const BlockLabParabolicFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("blocklab-parabolic") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (cached)
  let velocity = 20;
  let angle = 45;
  let gravity = 9.81;
  let showBlocks = 1;

  // Computed values
  let angleRad = (45 * Math.PI) / 180;
  let vx0 = 0;
  let vy0 = 0;
  let totalFlightTime = 0;
  let maxRange = 0;
  let maxHeight = 0;

  // Trail
  let trail: TrailPoint[] = [];

  // Landed flag
  let landed = false;

  // Layout
  const BLOCKS_WIDTH_FRAC = 0.30;

  // ── Helpers ───────────────────────────────────────────────────────
  function recompute(): void {
    angleRad = (angle * Math.PI) / 180;
    vx0 = velocity * Math.cos(angleRad);
    vy0 = velocity * Math.sin(angleRad);
    totalFlightTime = (2 * vy0) / gravity;
    maxRange = vx0 * totalFlightTime;
    maxHeight = (vy0 * vy0) / (2 * gravity);

    if (totalFlightTime < 0.001) totalFlightTime = 0.001;
    if (maxRange < 0.01) maxRange = 1;
    if (maxHeight < 0.01) maxHeight = 1;
  }

  function getPos(t: number): { x: number; y: number } {
    const x = vx0 * t;
    const y = vy0 * t - 0.5 * gravity * t * t;
    return { x, y: Math.max(y, 0) };
  }

  function getVel(t: number): { vx: number; vy: number } {
    return { vx: vx0, vy: vy0 - gravity * t };
  }

  function getCodeBlocks(): CodeBlock[] {
    const pos = getPos(time);
    const vel = getVel(time);
    return [
      { label: "SET launch_velocity", color: "#3b82f6", value: `v\u2080 = ${velocity} m/s`, indent: 0 },
      { label: "SET launch_angle", color: "#6366f1", value: `\u03B8 = ${angle}\u00B0`, indent: 0 },
      { label: "SET gravity", color: "#10b981", value: `g = ${gravity.toFixed(2)} m/s\u00B2`, indent: 0 },
      { label: "COMPUTE vx, vy", color: "#8b5cf6", value: `vx=${vx0.toFixed(1)}, vy=${vy0.toFixed(1)}`, indent: 0 },
      { label: "SET x=0, y=0", color: "#f97316", value: "", indent: 0 },
      { label: "REPEAT while y \u2265 0", color: "#f59e0b", value: "", indent: 0 },
      { label: "  vy \u2190 vy - g \u00D7 dt", color: "#06b6d4", value: `vy = ${vel.vy.toFixed(1)} m/s`, indent: 1 },
      { label: "  x \u2190 x + vx \u00D7 dt", color: "#ec4899", value: `x = ${pos.x.toFixed(1)} m`, indent: 1 },
      { label: "  y \u2190 y + vy \u00D7 dt", color: "#e879f9", value: `y = ${pos.y.toFixed(1)} m`, indent: 1 },
      { label: "  DRAW projectile", color: "#ef4444", value: "", indent: 1 },
      { label: "  DRAW trail", color: "#64748b", value: "", indent: 1 },
    ];
  }

  // Sim-to-canvas coordinate transform
  function simToCanvas(sx: number, sy: number, simArea: { left: number; right: number; top: number; bottom: number }): { cx: number; cy: number } {
    const drawW = simArea.right - simArea.left;
    const drawH = simArea.bottom - simArea.top;
    const scaleX = drawW / (maxRange * 1.15);
    const scaleY = drawH / (maxHeight * 1.4);
    const scale = Math.min(scaleX, scaleY);

    return {
      cx: simArea.left + sx * scale,
      cy: simArea.bottom - sy * scale,
    };
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
      trail = [];
      landed = false;
      recompute();
    },

    update(dt: number, params: Record<string, number>) {
      const newV = params.velocity ?? velocity;
      const newA = params.angle ?? angle;
      const newG = params.gravity ?? gravity;
      const newShowBlocks = params.showBlocks ?? showBlocks;

      if (newV !== velocity || newA !== angle || newG !== gravity) {
        velocity = newV;
        angle = newA;
        gravity = newG;
        time = 0;
        trail = [];
        landed = false;
      }

      showBlocks = newShowBlocks;
      recompute();

      if (!landed) {
        const dtClamped = Math.min(dt, 0.05);
        time += dtClamped;

        if (time >= totalFlightTime) {
          time = totalFlightTime;
          landed = true;
        }

        const pos = getPos(time);
        trail.push({ x: pos.x, y: pos.y });
      }
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
      ctx.fillText("BlockLab: Parabolic / Projectile Motion", W / 2, 24);

      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(
        "x = v\u2080cos(\u03B8)t  |  y = v\u2080sin(\u03B8)t - \u00BDgt\u00B2  |  Range = v\u2080\u00B2sin(2\u03B8)/g",
        W / 2,
        42
      );

      recompute();

      // ── Layout ──────────────────────────────────────
      const blocksWidth = showBlocks ? W * BLOCKS_WIDTH_FRAC : 0;
      const simLeft = blocksWidth;

      // Simulation area
      const simArea = {
        left: simLeft + 50,
        right: W - 30,
        top: 80,
        bottom: H - 100,
      };

      // ── Code blocks panel ─────────────────────────────
      if (showBlocks) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.fillRect(0, 50, blocksWidth - 8, H - 58);
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 50, blocksWidth - 8, H - 58);

        ctx.font = "bold 13px 'Inter', system-ui, sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "left";
        ctx.fillText("Projectile Algorithm", 10, 70);

        const blocks = getCodeBlocks();
        const blockH = 28;
        const blockGap = 4;
        const startY = 82;
        const baseX = 10;

        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          const bx = baseX + b.indent * 16;
          const by = startY + i * (blockH + blockGap);
          const bw = blocksWidth - 24 - b.indent * 16;

          const isLoop = (i >= 6 && i <= 10);
          const alpha = isLoop ? 0.95 : 0.7;

          // Shadow
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.roundRect(bx + 2, by + 2, bw, blockH, 5);
          ctx.fill();

          // Block body
          ctx.fillStyle = b.color;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, blockH, 5);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Connector notch
          if (i < blocks.length - 1) {
            ctx.fillStyle = b.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.roundRect(bx + 12, by + blockH - 1, 20, 4, 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          // Text
          ctx.font = "bold 9px 'Courier New', monospace";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "left";
          ctx.fillText(b.label, bx + 6, by + 12);

          if (b.value) {
            ctx.font = "8px 'Courier New', monospace";
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.fillText(b.value, bx + 6, by + 23);
          }

          // Execution pulse
          if (isLoop && !landed) {
            const pulse = 0.5 + 0.5 * Math.sin(time * 8);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + 0.5 * pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, blockH, 5);
            ctx.stroke();
          }
        }
      }

      // ── Ground ──────────────────────────────────────
      const groundCanvas = simArea.bottom;
      const groundGrad = ctx.createLinearGradient(0, groundCanvas, 0, groundCanvas + 30);
      groundGrad.addColorStop(0, "#2d5016");
      groundGrad.addColorStop(1, "#0f1f05");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(simArea.left - 20, groundCanvas, simArea.right - simArea.left + 40, 30);

      ctx.beginPath();
      ctx.moveTo(simArea.left - 20, groundCanvas);
      ctx.lineTo(simArea.right + 20, groundCanvas);
      ctx.strokeStyle = "rgba(100, 200, 80, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // ── Ghost trajectory (full parabola, dashed) ────
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 80; i++) {
        const t2 = (i / 80) * totalFlightTime;
        const p = getPos(t2);
        const { cx, cy } = simToCanvas(p.x, p.y, simArea);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // ── Trail ─────────────────────────────────────────
      if (trail.length > 1) {
        // Trail dots
        for (let i = 0; i < trail.length; i += 3) {
          const alpha = 0.15 + 0.6 * (i / trail.length);
          const r = 2 + (i / trail.length) * 2;
          const { cx, cy } = simToCanvas(trail[i].x, trail[i].y, simArea);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
          ctx.fill();
        }

        // Trail line
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
          const { cx, cy } = simToCanvas(trail[i].x, trail[i].y, simArea);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        }
        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ── Max height marker ─────────────────────────────
      const tAtPeak = vy0 / gravity;
      const xAtPeak = vx0 * tAtPeak;
      const { cx: peakCx, cy: peakCy } = simToCanvas(xAtPeak, maxHeight, simArea);
      const { cy: peakGroundCy } = simToCanvas(xAtPeak, 0, simArea);

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(peakCx, peakCy);
      ctx.lineTo(peakCx, peakGroundCy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`H = ${maxHeight.toFixed(1)} m`, peakCx, peakCy - 10);

      // ── Range marker ──────────────────────────────────
      const { cx: rCx0, cy: rCy0 } = simToCanvas(0, 0, simArea);
      const { cx: rCx1, cy: rCy1 } = simToCanvas(maxRange, 0, simArea);

      ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rCx0, rCy0 + 16);
      ctx.lineTo(rCx1, rCy1 + 16);
      ctx.stroke();

      // Range arrowhead
      ctx.beginPath();
      ctx.moveTo(rCx1, rCy1 + 16);
      ctx.lineTo(rCx1 - 7, rCy1 + 11);
      ctx.lineTo(rCx1 - 7, rCy1 + 21);
      ctx.closePath();
      ctx.fillStyle = "rgba(34, 197, 94, 0.7)";
      ctx.fill();

      ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`R = ${maxRange.toFixed(1)} m`, (rCx0 + rCx1) / 2, rCy0 + 30);

      // ── Launcher ──────────────────────────────────────
      const { cx: launchCx, cy: launchCy } = simToCanvas(0, 0, simArea);
      const launcherLen = 28;

      ctx.save();
      ctx.translate(launchCx, launchCy);
      ctx.rotate(-angleRad);
      ctx.fillStyle = "#555";
      ctx.fillRect(0, -3, launcherLen, 6);
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, -3, launcherLen, 6);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(launchCx, launchCy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#444";
      ctx.fill();
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Angle arc
      ctx.beginPath();
      ctx.arc(launchCx, launchCy, 22, -angleRad, 0);
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${angle}\u00B0`, launchCx + 24, launchCy - 5);

      // ── Projectile ────────────────────────────────────
      const pos = getPos(time);
      const { cx: ballCx, cy: ballCy } = simToCanvas(pos.x, pos.y, simArea);

      // Glow
      const glow = ctx.createRadialGradient(ballCx, ballCy, 0, ballCx, ballCy, 22);
      glow.addColorStop(0, "rgba(239, 68, 68, 0.5)");
      glow.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.beginPath();
      ctx.arc(ballCx, ballCy, 22, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Ball body
      const ballGrad = ctx.createRadialGradient(ballCx - 2, ballCy - 2, 0, ballCx, ballCy, 8);
      ballGrad.addColorStop(0, "#fff");
      ballGrad.addColorStop(0.3, "#ef4444");
      ballGrad.addColorStop(1, "#991b1b");
      ctx.beginPath();
      ctx.arc(ballCx, ballCy, 8, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── Velocity vector ───────────────────────────────
      if (!landed) {
        const vel = getVel(time);
        const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
        const scaleFactor = 35 / (velocity || 1);
        const dvx = vel.vx * scaleFactor;
        const dvy = -vel.vy * scaleFactor; // flip y for canvas

        // Total velocity
        ctx.beginPath();
        ctx.moveTo(ballCx, ballCy);
        ctx.lineTo(ballCx + dvx, ballCy + dvy);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Arrowhead
        const aAngle = Math.atan2(dvy, dvx);
        ctx.beginPath();
        ctx.moveTo(ballCx + dvx, ballCy + dvy);
        ctx.lineTo(
          ballCx + dvx - 8 * Math.cos(aAngle - 0.4),
          ballCy + dvy - 8 * Math.sin(aAngle - 0.4)
        );
        ctx.moveTo(ballCx + dvx, ballCy + dvy);
        ctx.lineTo(
          ballCx + dvx - 8 * Math.cos(aAngle + 0.4),
          ballCy + dvy - 8 * Math.sin(aAngle + 0.4)
        );
        ctx.stroke();

        // Component vectors (dashed)
        ctx.setLineDash([3, 3]);
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(ballCx, ballCy);
        ctx.lineTo(ballCx + dvx, ballCy);
        ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Vertical
        ctx.beginPath();
        ctx.moveTo(ballCx + dvx, ballCy);
        ctx.lineTo(ballCx + dvx, ballCy + dvy);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);

        // Speed label
        ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
        ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`v = ${speed.toFixed(1)} m/s`, ballCx + dvx + 6, ballCy + dvy - 4);
      }

      // ── Info panel ────────────────────────────────────
      const ipW = Math.min(simArea.right - simArea.left, 360);
      const ipX = simArea.left;
      const ipY = H - 85;
      const ipH = 78;

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.roundRect(ipX, ipY, ipW, ipH, 8);
      ctx.fill();

      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      const vel = getVel(time);
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
      const c1 = ipX + 10;
      const c2 = ipX + ipW * 0.35;
      const c3 = ipX + ipW * 0.68;

      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`t = ${time.toFixed(2)} s`, c1, ipY + 16);
      ctx.fillStyle = "#34d399";
      ctx.fillText(`x = ${pos.x.toFixed(1)} m`, c2, ipY + 16);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`y = ${pos.y.toFixed(1)} m`, c3, ipY + 16);

      ctx.fillStyle = "#c084fc";
      ctx.fillText(`v = ${speed.toFixed(1)} m/s`, c1, ipY + 34);
      ctx.fillStyle = "#f472b6";
      ctx.fillText(`H_max = ${maxHeight.toFixed(1)} m`, c2, ipY + 34);
      ctx.fillStyle = "#a3e635";
      ctx.fillText(`R = ${maxRange.toFixed(1)} m`, c3, ipY + 34);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillText(`T_flight = ${totalFlightTime.toFixed(2)} s`, c1, ipY + 52);
      ctx.fillText(`vx = ${vel.vx.toFixed(1)}, vy = ${vel.vy.toFixed(1)} m/s`, c2, ipY + 52);

      ctx.fillStyle = "#64748b";
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillText(`H = v\u2080\u00B2sin\u00B2\u03B8/(2g)  |  R = v\u2080\u00B2sin(2\u03B8)/g`, c1, ipY + 68);

      // ── Landed text ───────────────────────────────────
      if (landed) {
        ctx.fillStyle = "rgba(34, 197, 94, 0.9)";
        ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("LANDED", (simArea.left + simArea.right) / 2, simArea.bottom - 16);
      }

      // ── Time ──────────────────────────────────────────
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 6);
    },

    reset() {
      time = 0;
      trail = [];
      landed = false;
    },

    destroy() {
      trail = [];
    },

    getStateDescription(): string {
      const pos = getPos(time);
      const vel = getVel(time);
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
      return (
        `BlockLab Parabolic Motion: v\u2080=${velocity} m/s, \u03B8=${angle}\u00B0, g=${gravity.toFixed(2)} m/s\u00B2. ` +
        `Time: ${time.toFixed(2)}s. Position: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) m. ` +
        `Speed: ${speed.toFixed(1)} m/s (vx=${vel.vx.toFixed(1)}, vy=${vel.vy.toFixed(1)}). ` +
        `Max height: ${maxHeight.toFixed(1)} m = v\u2080\u00B2sin\u00B2\u03B8/(2g). ` +
        `Range: ${maxRange.toFixed(1)} m = v\u2080\u00B2sin(2\u03B8)/g. ` +
        `Flight time: ${totalFlightTime.toFixed(2)}s. ${landed ? "Landed." : "In flight."} ` +
        `Visual code blocks show the projectile algorithm step by step.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default BlockLabParabolicFactory;
