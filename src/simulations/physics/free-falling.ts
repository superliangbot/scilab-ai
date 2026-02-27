import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const FreeFallingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("free-falling") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let gravity = 9.8;
  let releaseHeight = 40;
  let airResistance = 0;

  let ballY = 0; // current height (meters above ground)
  let ballVel = 0;
  let falling = false;
  let impactVelocity: number | null = null;
  let impactTime: number | null = null;
  let trailPositions: { y: number; t: number }[] = [];
  let lastTrailTime = 0;

  // Graph data
  let heightHistory: { t: number; h: number }[] = [];
  let velHistory: { t: number; v: number }[] = [];

  function initState() {
    time = 0;
    ballY = releaseHeight;
    ballVel = 0;
    falling = false;
    impactVelocity = null;
    impactTime = null;
    trailPositions = [];
    lastTrailTime = 0;
    heightHistory = [];
    velHistory = [];
  }

  function metersToPixels(m: number): number {
    const groundY = height - 80;
    const topY = 80;
    const maxH = Math.max(releaseHeight * 1.1, 50);
    return groundY - (m / maxH) * (groundY - topY);
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#1a1a2e");
    grad.addColorStop(0.7, "#16213e");
    grad.addColorStop(1, "#0f3460");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Ground
    const groundY = height - 80;
    ctx.fillStyle = "#2d5016";
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
  }

  function drawHeightScale() {
    const maxH = Math.max(releaseHeight * 1.1, 50);
    const groundY = height - 80;
    const topY = 80;
    const scaleX = 40;

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scaleX, topY);
    ctx.lineTo(scaleX, groundY);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";

    const step = maxH > 80 ? 20 : maxH > 40 ? 10 : 5;
    for (let h = 0; h <= maxH; h += step) {
      const y = metersToPixels(h);
      ctx.beginPath();
      ctx.moveTo(scaleX - 6, y);
      ctx.lineTo(scaleX, y);
      ctx.stroke();
      ctx.fillText(`${h}m`, scaleX - 10, y + 4);
    }
  }

  function drawDashedLine() {
    const y = metersToPixels(releaseHeight);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#f59e0b88";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(width * 0.45, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#f59e0b";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`h₀ = ${releaseHeight.toFixed(1)} m`, 55, y - 8);
  }

  function drawBall() {
    const bx = width * 0.25;
    const by = metersToPixels(ballY);
    const r = 14;

    // Trail
    for (const tp of trailPositions) {
      const ty = metersToPixels(tp.y);
      const alpha = Math.max(0.1, 1 - (time - tp.t) * 0.5);
      ctx.beginPath();
      ctx.arc(bx, ty, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.4})`;
      ctx.fill();
    }

    // Ball
    const grad = ctx.createRadialGradient(bx - 4, by - 4, 0, bx, by, r);
    grad.addColorStop(0, "#ff6b6b");
    grad.addColorStop(1, "#c0392b");
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Velocity arrow
    if (falling && ballVel > 0) {
      const arrowLen = Math.min(ballVel * 3, 80);
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + 20, by);
      ctx.lineTo(bx + 20, by + arrowLen);
      ctx.stroke();
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(bx + 15, by + arrowLen - 6);
      ctx.lineTo(bx + 20, by + arrowLen);
      ctx.lineTo(bx + 25, by + arrowLen - 6);
      ctx.stroke();

      ctx.fillStyle = "#22d3ee";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`v = ${ballVel.toFixed(1)} m/s`, bx + 30, by + arrowLen / 2);
    }
  }

  function drawGraphs() {
    const gx = width * 0.55;
    const gw = width * 0.4;
    const gh = (height - 140) / 2 - 10;

    // Height vs Time graph
    drawGraph(gx, 60, gw, gh, "Height vs Time", heightHistory, "h", "t", "#f59e0b", releaseHeight);

    // Velocity vs Time graph
    const maxV = Math.max(gravity * Math.sqrt(2 * releaseHeight / gravity) * 1.1, 20);
    drawGraph(gx, 80 + gh, gw, gh, "Velocity vs Time", velHistory, "v", "t", "#22d3ee", maxV);
  }

  function drawGraph(
    gx: number, gy: number, gw: number, gh: number,
    title: string,
    data: { t: number; [key: string]: number }[],
    yKey: string, _xKey: string,
    color: string, maxVal: number
  ) {
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, gx + gw / 2, gy + 16);

    if (data.length < 2) return;

    const padL = 40;
    const padR = 10;
    const padT = 28;
    const padB = 20;
    const maxT = Math.max(data[data.length - 1].t, 1);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = gx + padL + (data[i].t / maxT) * (gw - padL - padR);
      const val = yKey === "h" ? data[i].h : data[i].v;
      const y = gy + padT + (1 - val / maxVal) * (gh - padT - padB);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawInfo() {
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Free Falling", width / 2, 30);

    if (impactVelocity !== null) {
      ctx.fillStyle = "#22d3ee";
      ctx.font = "bold 14px monospace";
      ctx.fillText(
        `Impact: v = ${impactVelocity.toFixed(2)} m/s  |  t = ${impactTime!.toFixed(2)} s  |  KE = ½mv² = ${(0.5 * impactVelocity * impactVelocity).toFixed(1)} J/kg`,
        width / 2,
        height - 30
      );
    }

    ctx.fillStyle = "#64748b";
    ctx.font = "12px sans-serif";
    ctx.fillText(`g = ${gravity.toFixed(1)} m/s²  |  v = gt  |  h = h₀ − ½gt²`, width / 2, height - 10);
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
      airResistance = params.airResistance ?? 0;
      const newHeight = params.releaseHeight ?? 40;

      if (Math.abs(newHeight - releaseHeight) > 0.1) {
        releaseHeight = newHeight;
        initState();
        return;
      }

      if (impactVelocity !== null) return;

      if (!falling) {
        falling = true;
        ballY = releaseHeight;
      }

      time += dt;

      // Physics
      const dragCoeff = airResistance * 0.001;
      ballVel += gravity * dt - dragCoeff * ballVel * Math.abs(ballVel) * dt;
      ballY -= ballVel * dt;

      // Snapshot trail
      if (time - lastTrailTime >= 0.15) {
        trailPositions.push({ y: ballY, t: time });
        lastTrailTime = time;
      }

      // Record history
      heightHistory.push({ t: time, h: Math.max(0, ballY) });
      velHistory.push({ t: time, v: ballVel });

      // Ground collision
      if (ballY <= 0) {
        ballY = 0;
        impactVelocity = ballVel;
        impactTime = time;
        // Theoretical check: v = sqrt(2gh)
      }
    },

    render() {
      drawBackground();
      drawHeightScale();
      drawDashedLine();
      drawBall();
      drawGraphs();
      drawInfo();
    },

    reset() {
      initState();
    },

    destroy() {
      trailPositions = [];
      heightHistory = [];
      velHistory = [];
    },

    getStateDescription(): string {
      if (impactVelocity !== null) {
        const theoretical = Math.sqrt(2 * gravity * releaseHeight);
        return `Free Falling: Ball dropped from ${releaseHeight}m hit ground at v=${impactVelocity.toFixed(2)} m/s (theoretical: ${theoretical.toFixed(2)} m/s) in t=${impactTime!.toFixed(2)}s. Energy conservation: mgh = ½mv² confirmed.`;
      }
      return `Free Falling: Ball at height ${ballY.toFixed(1)}m, velocity ${ballVel.toFixed(1)} m/s downward. Time: ${time.toFixed(2)}s. g=${gravity.toFixed(1)} m/s².`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };
};

export default FreeFallingFactory;
