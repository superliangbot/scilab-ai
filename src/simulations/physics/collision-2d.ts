import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  glowColor: string;
  label: string;
  trail: Array<{ x: number; y: number }>;
}

const Collision2DFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("collision-2d") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let mass1 = 1;
  let mass2 = 2;
  let elasticity = 1;
  let velocity1 = 150;

  // Balls
  let ball1: Ball;
  let ball2: Ball;

  // Collision tracking
  let hasCollided = false;
  let collisionPoint: { x: number; y: number } | null = null;
  let collisionTime = 0;
  let collisionFlashAlpha = 0;

  // Initial momentum and KE
  let initialMomentumX = 0;
  let initialMomentumY = 0;
  let initialKE = 0;

  // Trail settings
  const TRAIL_LENGTH = 150;

  function radiusFromMass(m: number): number {
    return 15 + m * 8;
  }

  function createBalls(): void {
    const cx = width / 2;
    const cy = height / 2;

    // Ball 1 starts on the left, moving right with slight upward angle
    const angle1 = -0.15; // slight upward angle (radians)
    ball1 = {
      x: cx - 180,
      y: cy + 20,
      vx: velocity1 * Math.cos(angle1),
      vy: velocity1 * Math.sin(angle1),
      mass: mass1,
      radius: radiusFromMass(mass1),
      color: "#3b82f6",
      glowColor: "rgba(59, 130, 246, 0.3)",
      label: "Ball 1",
      trail: [],
    };

    // Ball 2 starts on the right, stationary
    ball2 = {
      x: cx + 100,
      y: cy - 10,
      vx: 0,
      vy: 0,
      mass: mass2,
      radius: radiusFromMass(mass2),
      color: "#ef4444",
      glowColor: "rgba(239, 68, 68, 0.3)",
      label: "Ball 2",
      trail: [],
    };

    // Store initial momentum
    initialMomentumX = ball1.mass * ball1.vx + ball2.mass * ball2.vx;
    initialMomentumY = ball1.mass * ball1.vy + ball2.mass * ball2.vy;
    initialKE = 0.5 * ball1.mass * (ball1.vx ** 2 + ball1.vy ** 2) +
                0.5 * ball2.mass * (ball2.vx ** 2 + ball2.vy ** 2);

    hasCollided = false;
    collisionPoint = null;
    collisionFlashAlpha = 0;
  }

  function resolveCollision(): void {
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    // Normal and tangent vectors
    const nx = dx / dist;
    const ny = dy / dist;
    const tx = -ny;
    const ty = nx;

    // Project velocities onto normal and tangent
    const v1n = ball1.vx * nx + ball1.vy * ny;
    const v1t = ball1.vx * tx + ball1.vy * ty;
    const v2n = ball2.vx * nx + ball2.vy * ny;
    const v2t = ball2.vx * tx + ball2.vy * ty;

    // Don't resolve if moving apart
    if (v1n - v2n <= 0) return;

    // 1D collision along normal with coefficient of restitution
    // Conservation of momentum: m1*v1n + m2*v2n = m1*v1n' + m2*v2n'
    // Coefficient of restitution: e = -(v1n' - v2n') / (v1n - v2n)
    const m1 = ball1.mass;
    const m2 = ball2.mass;
    const e = elasticity;

    const v1nAfter = (m1 * v1n + m2 * v2n + m2 * e * (v2n - v1n)) / (m1 + m2);
    const v2nAfter = (m1 * v1n + m2 * v2n + m1 * e * (v1n - v2n)) / (m1 + m2);

    // Tangential components unchanged (no friction)
    const v1tAfter = v1t;
    const v2tAfter = v2t;

    // Convert back to x,y
    ball1.vx = v1nAfter * nx + v1tAfter * tx;
    ball1.vy = v1nAfter * ny + v1tAfter * ty;
    ball2.vx = v2nAfter * nx + v2tAfter * tx;
    ball2.vy = v2nAfter * ny + v2tAfter * ty;

    // Separate overlapping balls
    const overlap = (ball1.radius + ball2.radius) - dist;
    if (overlap > 0) {
      ball1.x -= nx * overlap * 0.5;
      ball1.y -= ny * overlap * 0.5;
      ball2.x += nx * overlap * 0.5;
      ball2.y += ny * overlap * 0.5;
    }

    hasCollided = true;
    collisionPoint = {
      x: (ball1.x + ball2.x) / 2,
      y: (ball1.y + ball2.y) / 2,
    };
    collisionTime = time;
    collisionFlashAlpha = 1;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    createBalls();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newM1 = params.mass1 ?? 1;
    const newM2 = params.mass2 ?? 2;
    const newE = params.elasticity ?? 1;
    const newV1 = params.velocity1 ?? 150;

    // Reset if parameters changed
    if (newM1 !== mass1 || newM2 !== mass2 || newE !== elasticity || newV1 !== velocity1) {
      mass1 = newM1;
      mass2 = newM2;
      elasticity = newE;
      velocity1 = newV1;
      time = 0;
      createBalls();
      return;
    }

    const step = Math.min(dt, 0.033);

    // Update positions
    ball1.x += ball1.vx * step;
    ball1.y += ball1.vy * step;
    ball2.x += ball2.vx * step;
    ball2.y += ball2.vy * step;

    // Wall bounces (elastic)
    for (const ball of [ball1, ball2]) {
      if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
      if (ball.x + ball.radius > width) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }
      if (ball.y + ball.radius > height) { ball.y = height - ball.radius; ball.vy = -Math.abs(ball.vy); }
    }

    // Check collision
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < ball1.radius + ball2.radius) {
      resolveCollision();
    }

    // Update trails
    for (const ball of [ball1, ball2]) {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > TRAIL_LENGTH) {
        ball.trail.splice(0, ball.trail.length - TRAIL_LENGTH);
      }
    }

    // Fade collision flash
    if (collisionFlashAlpha > 0) {
      collisionFlashAlpha -= dt * 2;
      if (collisionFlashAlpha < 0) collisionFlashAlpha = 0;
    }

    time += step;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function drawTrail(ball: Ball): void {
    if (ball.trail.length < 2) return;

    const r = parseInt(ball.color.slice(1, 3), 16);
    const g = parseInt(ball.color.slice(3, 5), 16);
    const b = parseInt(ball.color.slice(5, 7), 16);

    for (let i = 1; i < ball.trail.length; i++) {
      const alpha = (i / ball.trail.length) * 0.5;
      const lineWidth = 0.5 + (i / ball.trail.length) * 2.5;
      ctx.beginPath();
      ctx.moveTo(ball.trail[i - 1].x, ball.trail[i - 1].y);
      ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawBall(ball: Ball): void {
    const { x, y, radius, color, glowColor } = ball;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Outer glow
    const outerGlow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 3);
    outerGlow.addColorStop(0, glowColor);
    outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.beginPath();
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Ball body with 3D shading
    const bodyGrad = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    bodyGrad.addColorStop(0, "#ffffff");
    bodyGrad.addColorStop(0.25, color);
    bodyGrad.addColorStop(1, `rgb(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 60)})`);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mass label
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = `bold ${Math.max(10, radius * 0.6)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${ball.mass}kg`, x, y + 4);

    // Label below
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(ball.label, x, y + radius + 16);
  }

  function drawVelocityVector(ball: Ball): void {
    const speed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
    if (speed < 1) return;

    const scale = 0.4;
    const endX = ball.x + ball.vx * scale;
    const endY = ball.y + ball.vy * scale;

    const r = parseInt(ball.color.slice(1, 3), 16);
    const g = parseInt(ball.color.slice(3, 5), 16);
    const b = parseInt(ball.color.slice(5, 7), 16);

    ctx.save();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(ball.vy, ball.vx);
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
    ctx.stroke();

    // Speed label
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${speed.toFixed(0)} px/s`, endX + 15, endY - 10);

    ctx.restore();
  }

  function drawMomentumArrows(): void {
    const barY = height - 70;
    const barX = width / 2;

    ctx.save();

    // Current momentum
    const px = ball1.mass * ball1.vx + ball2.mass * ball2.vx;
    const py = ball1.mass * ball1.vy + ball2.mass * ball2.vy;

    // Draw momentum vector for each ball
    const scale = 0.15;

    // Ball 1 momentum
    const p1x = ball1.mass * ball1.vx * scale;
    const p1y = ball1.mass * ball1.vy * scale;
    if (Math.abs(p1x) > 1 || Math.abs(p1y) > 1) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(barX - 80, barY);
      ctx.lineTo(barX - 80 + p1x, barY + p1y);
      ctx.stroke();
      ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("p\u2081", barX - 80, barY - 10);
    }

    // Ball 2 momentum
    const p2x = ball2.mass * ball2.vx * scale;
    const p2y = ball2.mass * ball2.vy * scale;
    if (Math.abs(p2x) > 1 || Math.abs(p2y) > 1) {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(barX + 80, barY);
      ctx.lineTo(barX + 80 + p2x, barY + p2y);
      ctx.stroke();
      ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("p\u2082", barX + 80, barY - 10);
    }

    // Total momentum
    const totalPx = px * scale;
    const totalPy = py * scale;
    ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY + 25);
    ctx.lineTo(barX + totalPx, barY + 25 + totalPy);
    ctx.stroke();
    ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("p_total", barX, barY + 15);

    ctx.restore();
  }

  function drawCollisionFlash(): void {
    if (collisionFlashAlpha <= 0 || !collisionPoint) return;

    ctx.save();
    const glow = ctx.createRadialGradient(
      collisionPoint.x, collisionPoint.y, 0,
      collisionPoint.x, collisionPoint.y, 80 * collisionFlashAlpha
    );
    glow.addColorStop(0, `rgba(255, 255, 255, ${collisionFlashAlpha * 0.6})`);
    glow.addColorStop(0.3, `rgba(255, 200, 50, ${collisionFlashAlpha * 0.3})`);
    glow.addColorStop(1, `rgba(255, 200, 50, 0)`);
    ctx.beginPath();
    ctx.arc(collisionPoint.x, collisionPoint.y, 80, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 280;
    const panelH = 155;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("2D Collision", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Time: ${time.toFixed(2)}s`, panelX + 10, panelY + 38);
    ctx.fillText(`Elasticity (e): ${elasticity.toFixed(2)}${elasticity === 1 ? " (elastic)" : elasticity === 0 ? " (perfectly inelastic)" : ""}`, panelX + 10, panelY + 54);

    // Conservation check
    const currentPx = ball1.mass * ball1.vx + ball2.mass * ball2.vx;
    const currentPy = ball1.mass * ball1.vy + ball2.mass * ball2.vy;
    const currentKE = 0.5 * ball1.mass * (ball1.vx ** 2 + ball1.vy ** 2) +
                      0.5 * ball2.mass * (ball2.vx ** 2 + ball2.vy ** 2);

    const pMag = Math.sqrt(currentPx ** 2 + currentPy ** 2);
    const pInitMag = Math.sqrt(initialMomentumX ** 2 + initialMomentumY ** 2);

    ctx.fillStyle = "rgba(34, 197, 94, 0.8)";
    ctx.fillText(`Momentum: ${pMag.toFixed(1)} (initial: ${pInitMag.toFixed(1)})`, panelX + 10, panelY + 74);

    ctx.fillStyle = "rgba(251, 191, 36, 0.8)";
    ctx.fillText(`KE: ${currentKE.toFixed(1)} (initial: ${initialKE.toFixed(1)})`, panelX + 10, panelY + 90);

    if (hasCollided) {
      const keLoss = ((1 - currentKE / (initialKE || 1)) * 100);
      ctx.fillStyle = "rgba(168, 85, 247, 0.8)";
      ctx.fillText(`KE loss: ${keLoss.toFixed(1)}%`, panelX + 10, panelY + 106);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText(`m\u2081v\u2081 + m\u2082v\u2082 = m\u2081v\u2081' + m\u2082v\u2082'`, panelX + 10, panelY + 124);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillText("Awaiting collision...", panelX + 10, panelY + 106);
      ctx.fillText(`m\u2081v\u2081 + m\u2082v\u2082 = m\u2081v\u2081' + m\u2082v\u2082'`, panelX + 10, panelY + 124);
    }
    
    // Note about wall momentum
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Note: Wall bounces involve external forces", panelX + 10, panelY + 138);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawTrail(ball1);
    drawTrail(ball2);
    drawCollisionFlash();
    drawBall(ball1);
    drawBall(ball2);
    drawVelocityVector(ball1);
    drawVelocityVector(ball2);
    drawMomentumArrows();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    createBalls();
  }

  function destroy(): void {
    ball1.trail = [];
    ball2.trail = [];
  }

  function getStateDescription(): string {
    const speed1 = Math.sqrt(ball1.vx ** 2 + ball1.vy ** 2);
    const speed2 = Math.sqrt(ball2.vx ** 2 + ball2.vy ** 2);
    const currentKE = 0.5 * ball1.mass * (ball1.vx ** 2 + ball1.vy ** 2) +
                      0.5 * ball2.mass * (ball2.vx ** 2 + ball2.vy ** 2);
    const px = ball1.mass * ball1.vx + ball2.mass * ball2.vx;
    const py = ball1.mass * ball1.vy + ball2.mass * ball2.vy;
    return (
      `2D Collision: e=${elasticity}. ` +
      `Ball 1: m=${mass1}kg, pos=(${ball1.x.toFixed(0)},${ball1.y.toFixed(0)}), speed=${speed1.toFixed(1)}. ` +
      `Ball 2: m=${mass2}kg, pos=(${ball2.x.toFixed(0)},${ball2.y.toFixed(0)}), speed=${speed2.toFixed(1)}. ` +
      `Total momentum: (${px.toFixed(1)}, ${py.toFixed(1)}). KE: ${currentKE.toFixed(1)}. ` +
      `Collided: ${hasCollided}. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    const dx = (w - width) / 2;
    const dy = (h - height) / 2;
    for (const ball of [ball1, ball2]) {
      if (ball) {
        ball.x += dx;
        ball.y += dy;
        for (const p of ball.trail) {
          p.x += dx;
          p.y += dy;
        }
      }
    }
    if (collisionPoint) {
      collisionPoint.x += dx;
      collisionPoint.y += dy;
    }
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default Collision2DFactory;
