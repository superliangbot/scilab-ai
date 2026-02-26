import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NewtonsCradleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("newtons-cradle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let numBalls = 5;
  let pullBalls = 1; // number of balls to pull
  let pullAngle = 30; // degrees
  let damping = 0.998;

  // Ball physics
  const BALL_RADIUS = 20;
  const STRING_LENGTH = 250;
  const GRAVITY = 9.81;

  interface Ball {
    angle: number; // current angle from vertical (radians)
    angularVel: number;
    x: number;
    y: number;
  }
  let balls: Ball[] = [];
  let started = false;
  let startDelay = 1;

  // Frame anchor
  const FRAME_TOP = 60;

  function initBalls(): void {
    balls = [];
    const spacing = BALL_RADIUS * 2.02;

    for (let i = 0; i < numBalls; i++) {
      balls.push({
        angle: 0,
        angularVel: 0,
        x: 0,
        y: 0,
      });
    }

    started = false;
    startDelay = 1;
    time = 0;
  }

  function getAnchorX(i: number): number {
    const totalWidth = (numBalls - 1) * BALL_RADIUS * 2.02;
    return width / 2 - totalWidth / 2 + i * BALL_RADIUS * 2.02;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    initBalls();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newNumBalls = Math.round(params.numBalls ?? 5);
    const newPullBalls = Math.round(params.pullBalls ?? 1);
    const newPullAngle = params.pullAngle ?? 30;

    if (newNumBalls !== numBalls) {
      numBalls = newNumBalls;
      pullBalls = Math.min(newPullBalls, Math.floor(numBalls / 2));
      pullAngle = newPullAngle;
      initBalls();
      return;
    }

    pullBalls = Math.min(newPullBalls, Math.floor(numBalls / 2));
    pullAngle = newPullAngle;
    damping = params.damping ?? 0.998;

    time += dt;

    // Start after delay
    if (!started) {
      startDelay -= dt;
      // Hold pulled balls at angle
      const pullRad = (pullAngle * Math.PI) / 180;
      for (let i = 0; i < pullBalls; i++) {
        balls[numBalls - 1 - i].angle = pullRad;
      }
      if (startDelay <= 0) {
        started = true;
        // Release pulled balls
        for (let i = 0; i < pullBalls; i++) {
          balls[numBalls - 1 - i].angularVel = 0;
        }
      }
    }

    if (!started) return;

    // Physics simulation using simple pendulum + collisions
    const substeps = 8;
    const subDt = Math.min(dt, 0.02) / substeps;

    for (let step = 0; step < substeps; step++) {
      // Update each ball as a pendulum
      for (const ball of balls) {
        const angularAccel = -(GRAVITY / (STRING_LENGTH * 0.01)) * Math.sin(ball.angle);
        ball.angularVel += angularAccel * subDt;
        ball.angularVel *= damping;
        ball.angle += ball.angularVel * subDt;
      }

      // Compute positions
      for (let i = 0; i < balls.length; i++) {
        const anchorX = getAnchorX(i);
        balls[i].x = anchorX + STRING_LENGTH * Math.sin(balls[i].angle);
        balls[i].y = FRAME_TOP + STRING_LENGTH * Math.cos(balls[i].angle);
      }

      // Collision detection — elastic collisions between adjacent balls
      for (let i = 0; i < balls.length - 1; i++) {
        const dx = balls[i + 1].x - balls[i].x;
        const minDist = BALL_RADIUS * 2.02;

        if (dx < minDist) {
          // Elastic collision — swap velocities (equal mass)
          const v1 = balls[i].angularVel;
          const v2 = balls[i + 1].angularVel;
          balls[i].angularVel = v2;
          balls[i + 1].angularVel = v1;

          // Separate balls
          const overlap = minDist - dx;
          const halfOverlap = overlap * 0.01;
          balls[i].angle -= halfOverlap;
          balls[i + 1].angle += halfOverlap;
        }
      }
    }
  }

  function drawFrame(): void {
    // Support frame
    const frameLeft = width / 2 - (numBalls * BALL_RADIUS * 2.02) / 2 - 40;
    const frameRight = width / 2 + (numBalls * BALL_RADIUS * 2.02) / 2 + 40;
    const frameBottom = FRAME_TOP + STRING_LENGTH + BALL_RADIUS + 60;

    // Top bar
    const barGrad = ctx.createLinearGradient(0, FRAME_TOP - 15, 0, FRAME_TOP + 5);
    barGrad.addColorStop(0, "#94a3b8");
    barGrad.addColorStop(0.5, "#cbd5e1");
    barGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(frameLeft, FRAME_TOP - 12, frameRight - frameLeft, 16, 4);
    ctx.fill();

    // Side supports
    const legGrad = ctx.createLinearGradient(0, 0, 8, 0);
    legGrad.addColorStop(0, "#64748b");
    legGrad.addColorStop(0.5, "#94a3b8");
    legGrad.addColorStop(1, "#64748b");

    ctx.fillStyle = legGrad;
    // Left legs
    ctx.beginPath();
    ctx.moveTo(frameLeft, FRAME_TOP - 12);
    ctx.lineTo(frameLeft - 20, frameBottom);
    ctx.lineTo(frameLeft - 12, frameBottom);
    ctx.lineTo(frameLeft + 8, FRAME_TOP - 12);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(frameLeft + 20, FRAME_TOP + 4);
    ctx.lineTo(frameLeft, frameBottom);
    ctx.lineTo(frameLeft + 8, frameBottom);
    ctx.lineTo(frameLeft + 28, FRAME_TOP + 4);
    ctx.fill();

    // Right legs
    ctx.beginPath();
    ctx.moveTo(frameRight, FRAME_TOP - 12);
    ctx.lineTo(frameRight + 20, frameBottom);
    ctx.lineTo(frameRight + 12, frameBottom);
    ctx.lineTo(frameRight - 8, FRAME_TOP - 12);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(frameRight - 20, FRAME_TOP + 4);
    ctx.lineTo(frameRight, frameBottom);
    ctx.lineTo(frameRight - 8, frameBottom);
    ctx.lineTo(frameRight - 28, FRAME_TOP + 4);
    ctx.fill();

    // Base
    ctx.fillStyle = "#475569";
    ctx.fillRect(frameLeft - 25, frameBottom, frameRight - frameLeft + 50, 5);
  }

  function drawBalls(): void {
    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      const anchorX = getAnchorX(i);

      // String
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(anchorX, FRAME_TOP);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();

      // Second string for visual depth
      ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
      ctx.beginPath();
      ctx.moveTo(anchorX + 3, FRAME_TOP);
      ctx.lineTo(ball.x + 2, ball.y);
      ctx.stroke();

      // Ball shadow
      ctx.beginPath();
      ctx.ellipse(ball.x + 5, ball.y + BALL_RADIUS + 10, BALL_RADIUS * 0.8, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fill();

      // Ball
      const ballGrad = ctx.createRadialGradient(
        ball.x - BALL_RADIUS * 0.3, ball.y - BALL_RADIUS * 0.3, 0,
        ball.x, ball.y, BALL_RADIUS
      );
      ballGrad.addColorStop(0, "#f1f5f9");
      ballGrad.addColorStop(0.3, "#cbd5e1");
      ballGrad.addColorStop(0.7, "#94a3b8");
      ballGrad.addColorStop(1, "#475569");
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Highlight
      ctx.beginPath();
      ctx.arc(ball.x - BALL_RADIUS * 0.25, ball.y - BALL_RADIUS * 0.25, BALL_RADIUS * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();

      // Ball outline
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawMotionTrails(): void {
    // Show motion arcs for active balls
    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      if (Math.abs(ball.angularVel) > 0.1) {
        const anchorX = getAnchorX(i);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
        ctx.lineWidth = BALL_RADIUS * 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        const arcAngle = ball.angle;
        const startAngle = Math.PI / 2 - Math.abs(arcAngle);
        const endAngle = Math.PI / 2 + Math.abs(arcAngle);
        if (arcAngle !== 0) {
          ctx.arc(anchorX, FRAME_TOP, STRING_LENGTH, startAngle, endAngle);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
      }
    }
  }

  function drawInfoPanel(): void {
    const panelX = 15;
    const panelY = height - 120;
    const panelW = width - 30;
    const panelH = 105;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Newton's Cradle", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 38;
    const lineH = 16;

    // Calculate energies
    const totalKE = balls.reduce((sum, b) => {
      const v = b.angularVel * STRING_LENGTH * 0.01;
      return sum + 0.5 * v * v;
    }, 0);
    const totalPE = balls.reduce((sum, b) => {
      const h = STRING_LENGTH * 0.01 * (1 - Math.cos(b.angle));
      return sum + GRAVITY * h;
    }, 0);

    ctx.fillText(`Balls: ${numBalls}  |  Pulled: ${pullBalls}  |  Angle: ${pullAngle}°`, panelX + 10, y); y += lineH;
    ctx.fillText(`KE: ${totalKE.toFixed(3)} J (relative)  |  PE: ${totalPE.toFixed(3)} J (relative)`, panelX + 10, y); y += lineH;

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Conservation of momentum: m₁v₁ = m₂v₂  |  Conservation of kinetic energy: ½m₁v₁² = ½m₂v₂²", panelX + 10, y); y += 14;
    ctx.fillText("When n balls strike, n balls swing out on the opposite side — demonstrating both conservation laws.", panelX + 10, y);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Newton's Cradle — Conservation of Momentum & Energy", width / 2, 35);

    drawFrame();
    drawMotionTrails();
    drawBalls();
    drawInfoPanel();
  }

  function reset(): void {
    initBalls();
  }

  function destroy(): void {
    balls = [];
  }

  function getStateDescription(): string {
    const maxAngle = Math.max(...balls.map(b => Math.abs(b.angle) * 180 / Math.PI));
    const totalKE = balls.reduce((sum, b) => {
      const v = b.angularVel * STRING_LENGTH * 0.01;
      return sum + 0.5 * v * v;
    }, 0);
    return (
      `Newton's Cradle: ${numBalls} balls, ${pullBalls} pulled to ${pullAngle}°. ` +
      `Max current swing: ${maxAngle.toFixed(1)}°. KE: ${totalKE.toFixed(3)} J (relative). ` +
      `Demonstrates conservation of momentum (p = mv) and kinetic energy (KE = ½mv²) ` +
      `in elastic collisions between equal-mass spheres.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NewtonsCradleFactory;
