import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const FreeFall2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("free-fall-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // State
  let gravity = 9.8;
  let showTrace = 1;
  let timeInterval = 0.1;
  let numBalls = 3;
  let ballPositions: number[] = [];
  let ballVelocities: number[] = [];
  let snapshots: { time: number; positions: number[] }[] = [];
  let started = false;
  let landed = false;

  // Ball properties (different masses, same acceleration)
  const ballColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
  const ballMasses = [1, 5, 10, 20, 50];
  const ballRadii = [8, 12, 16, 20, 24];

  let lastSnapshotTime = 0;
  let dataTable: { time: number; dist: number; vel: number }[] = [];

  function initState() {
    time = 0;
    started = false;
    landed = false;
    lastSnapshotTime = 0;
    ballPositions = [];
    ballVelocities = [];
    snapshots = [];
    dataTable = [];
    for (let i = 0; i < numBalls; i++) {
      ballPositions.push(0);
      ballVelocities.push(0);
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawRuler() {
    const rulerX = 50;
    const topY = 60;
    const bottomY = height - 60;
    const rulerHeight = bottomY - topY;

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rulerX, topY);
    ctx.lineTo(rulerX, bottomY);
    ctx.stroke();

    // Max distance shown
    const maxDist = 50; // meters
    const pixPerMeter = rulerHeight / maxDist;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";

    for (let d = 0; d <= maxDist; d += 5) {
      const y = topY + d * pixPerMeter;
      ctx.beginPath();
      ctx.moveTo(rulerX - 8, y);
      ctx.lineTo(rulerX, y);
      ctx.stroke();
      ctx.fillText(`${d}m`, rulerX - 12, y + 4);
    }

    return { topY, pixPerMeter };
  }

  function drawBalls(topY: number, pixPerMeter: number) {
    const spacing = (width - 120) / (numBalls + 1);

    for (let i = 0; i < numBalls; i++) {
      const bx = 120 + spacing * (i + 0.5);
      const by = topY + ballPositions[i] * pixPerMeter;
      const r = ballRadii[i] || 10;

      // Draw trace snapshots
      if (showTrace > 0.5) {
        for (const snap of snapshots) {
          const sy = topY + snap.positions[i] * pixPerMeter;
          if (sy < height - 60) {
            ctx.beginPath();
            ctx.arc(bx, sy, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = ballColors[i] + "40";
            ctx.fill();
          }
        }
      }

      // Draw ball
      if (by < height - 60) {
        const grad = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 0, bx, by, r);
        grad.addColorStop(0, ballColors[i]);
        grad.addColorStop(1, ballColors[i] + "88");
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Label
      ctx.fillStyle = ballColors[i];
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${ballMasses[i]} kg`, bx, topY - 10);
    }
  }

  function drawDataPanel() {
    const px = width - 220;
    const py = 20;
    const pw = 200;
    const maxRows = Math.min(dataTable.length, 12);
    const ph = 50 + maxRows * 18;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Time (s)  Dist (m)  Vel", px + 10, py + 22);

    ctx.font = "11px monospace";
    ctx.fillStyle = "#94a3b8";
    const startIdx = Math.max(0, dataTable.length - maxRows);
    for (let i = startIdx; i < dataTable.length; i++) {
      const row = dataTable[i];
      const y = py + 42 + (i - startIdx) * 18;
      ctx.fillText(
        `${row.time.toFixed(1)}      ${row.dist.toFixed(2)}    ${row.vel.toFixed(2)}`,
        px + 10,
        y
      );
    }
  }

  function drawTitle() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Free Fall — All Masses Fall at the Same Rate", width / 2, 30);

    ctx.fillStyle = "#64748b";
    ctx.font = "13px sans-serif";
    ctx.fillText(`d = ½gt²    v = gt    g = ${gravity.toFixed(1)} m/s²`, width / 2, height - 20);
  }

  return {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initState();
    },

    update(dt: number, params: Record<string, number>) {
      gravity = params.gravity ?? 9.8;
      showTrace = params.showTrace ?? 1;
      timeInterval = params.timeInterval ?? 0.1;
      const newBalls = Math.round(params.numBalls ?? 3);
      if (newBalls !== numBalls) {
        numBalls = newBalls;
        initState();
      }

      if (!started) {
        started = true;
      }

      if (landed) return;

      time += dt;

      let allLanded = true;
      for (let i = 0; i < numBalls; i++) {
        ballVelocities[i] = gravity * time;
        ballPositions[i] = 0.5 * gravity * time * time;
        if (ballPositions[i] < 50) allLanded = false;
      }

      // Record snapshot
      if (time - lastSnapshotTime >= timeInterval) {
        lastSnapshotTime = time;
        snapshots.push({ time, positions: [...ballPositions] });
        dataTable.push({
          time,
          dist: ballPositions[0],
          vel: ballVelocities[0],
        });
      }

      if (allLanded) landed = true;
    },

    render() {
      drawBackground();
      const { topY, pixPerMeter } = drawRuler();
      drawBalls(topY, pixPerMeter);
      drawDataPanel();
      drawTitle();
    },

    reset() {
      initState();
    },

    destroy() {
      snapshots = [];
      dataTable = [];
    },

    getStateDescription(): string {
      return `Free Fall 2: ${numBalls} balls of different masses (${ballMasses.slice(0, numBalls).join(", ")} kg) falling under gravity g=${gravity.toFixed(1)} m/s². Time: ${time.toFixed(2)}s. Distance fallen: ${ballPositions[0]?.toFixed(2) ?? 0}m. Velocity: ${ballVelocities[0]?.toFixed(2) ?? 0} m/s. Key insight: all objects fall at the same rate regardless of mass (in vacuum).`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default FreeFall2Factory;
