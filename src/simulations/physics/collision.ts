import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * 1-D Elastic Collision
 * Two balls with adjustable mass ratio collide head-on.
 * Conservation of momentum: m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'
 * Conservation of KE (elastic): ½m₁v₁² + ½m₂v₂² = ½m₁v₁'² + ½m₂v₂'²
 * v₁' = (m₁−m₂)v₁/(m₁+m₂) + 2m₂v₂/(m₁+m₂)
 */

const CollisionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("collision") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let massRatio = 3;
  let scenario = 0; // 0=light→heavy, 1=heavy→light, 2=head-on
  let showVelocity = 1;
  let speed = 1;

  // Ball state
  let x1 = 0, x2 = 0;
  let v1 = 0, v2 = 0;
  let m1 = 1, m2 = 3;
  let r1 = 15, r2 = 25;
  let ballY = 0;
  let collided = false;
  let trail1: number[] = [];
  let trail2: number[] = [];
  let totalP = 0;
  let totalKE = 0;

  function setupScenario() {
    m1 = 1;
    m2 = massRatio;
    r1 = Math.max(10, Math.min(width, height) * 0.025);
    r2 = r1 * Math.pow(m2 / m1, 1 / 3);
    ballY = height * 0.5;
    collided = false;
    trail1 = [];
    trail2 = [];

    const baseV = width * 0.15 * speed;

    if (scenario === 0) {
      // Light ball hits stationary heavy ball
      x1 = width * 0.2;
      x2 = width * 0.65;
      v1 = baseV;
      v2 = 0;
    } else if (scenario === 1) {
      // Heavy ball hits stationary light ball
      x1 = width * 0.2;
      x2 = width * 0.65;
      // swap: ball 1 is heavy
      m1 = massRatio;
      m2 = 1;
      r1 = Math.max(10, Math.min(width, height) * 0.025) * Math.pow(massRatio, 1 / 3);
      r2 = Math.max(10, Math.min(width, height) * 0.025);
      v1 = baseV;
      v2 = 0;
    } else {
      // Head-on at equal speeds
      x1 = width * 0.15;
      x2 = width * 0.85;
      v1 = baseV;
      v2 = -baseV;
    }

    totalP = m1 * v1 + m2 * v2;
    totalKE = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    setupScenario();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newRatio = params.massRatio ?? 3;
    const newScenario = Math.round(params.scenario ?? 0);
    speed = params.speed ?? 1;
    showVelocity = params.showVelocity ?? 1;

    if (newRatio !== massRatio || newScenario !== scenario) {
      massRatio = newRatio;
      scenario = newScenario;
      setupScenario();
      time = 0;
    }

    const step = Math.min(dt, 0.025);

    // Move balls
    x1 += v1 * step;
    x2 += v2 * step;

    // Record trails
    trail1.push(x1);
    trail2.push(x2);
    if (trail1.length > 300) trail1.shift();
    if (trail2.length > 300) trail2.shift();

    // Check collision
    const dist = Math.abs(x2 - x1);
    if (!collided && dist < r1 + r2) {
      // 1D elastic collision formulas
      const newV1 = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
      const newV2 = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);
      v1 = newV1;
      v2 = newV2;
      collided = true;
      // Separate
      if (x1 < x2) {
        x1 = x2 - r1 - r2 - 1;
      } else {
        x2 = x1 - r1 - r2 - 1;
      }
    }

    // Wall bounces
    if (x1 - r1 < 0) { x1 = r1; v1 = Math.abs(v1); }
    if (x1 + r1 > width) { x1 = width - r1; v1 = -Math.abs(v1); }
    if (x2 - r2 < 0) { x2 = r2; v2 = Math.abs(v2); }
    if (x2 + r2 > width) { x2 = width - r2; v2 = -Math.abs(v2); }

    time += step;
  }

  function drawBall(x: number, y: number, r: number, mass: number, vel: number, color1: string, color2: string, label: string) {
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(9, r * 0.55)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);

    // Velocity arrow
    if (showVelocity >= 1 && Math.abs(vel) > 5) {
      const arrowLen = vel * 0.3;
      ctx.strokeStyle = color1;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y - r - 8);
      ctx.lineTo(x + arrowLen, y - r - 8);
      ctx.stroke();
      const dir = vel > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x + arrowLen, y - r - 8);
      ctx.lineTo(x + arrowLen - dir * 7, y - r - 13);
      ctx.lineTo(x + arrowLen - dir * 7, y - r - 3);
      ctx.closePath();
      ctx.fillStyle = color1;
      ctx.fill();

      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.textAlign = "center";
      ctx.fillText(`${vel.toFixed(0)} px/s`, x + arrowLen / 2, y - r - 20);
    }
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Ground line
    const groundY = ballY + Math.max(r1, r2) + 20;
    ctx.strokeStyle = "rgba(150,180,220,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Trails
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < trail1.length; i++) {
      const alpha = i / trail1.length * 0.3;
      ctx.beginPath();
      ctx.arc(trail1[i], ballY, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
      ctx.fill();
    }
    for (let i = 0; i < trail2.length; i++) {
      const alpha = i / trail2.length * 0.3;
      ctx.beginPath();
      ctx.arc(trail2[i], ballY, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(248, 113, 113, ${alpha})`;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw balls
    drawBall(x1, ballY, r1, m1, v1, "#93c5fd", "#1e40af", `m=${m1}`);
    drawBall(x2, ballY, r2, m2, v2, "#fca5a5", "#991b1b", `m=${m2}`);

    // Momentum & KE
    const curP = m1 * v1 + m2 * v2;
    const curKE = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 80, 6);
    ctx.fill();
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.fillText("1-D Elastic Collision", 16, 24);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    const scenarioLabels = ["Light → Heavy (stationary)", "Heavy → Light (stationary)", "Head-on (equal speed)"];
    ctx.fillText(scenarioLabels[scenario] || scenarioLabels[0], 16, 40);
    ctx.fillText(`Momentum: ${curP.toFixed(0)} (initial: ${totalP.toFixed(0)})`, 16, 56);
    ctx.fillText(`KE: ${curKE.toFixed(0)} (initial: ${totalKE.toFixed(0)})`, 16, 72);
    ctx.restore();

    // Formula
    ctx.save();
    ctx.font = `${Math.max(10, width * 0.016)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160,180,220,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'  (momentum conserved)", width / 2, height - 8);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    setupScenario();
  }

  function destroy(): void { trail1 = []; trail2 = []; }

  function getStateDescription(): string {
    const scenarioLabels = ["light→heavy", "heavy→light", "head-on"];
    return (
      `1D Elastic Collision: scenario=${scenarioLabels[scenario]}, mass ratio=${massRatio}:1. ` +
      `Ball 1: m=${m1}, v=${v1.toFixed(0)} px/s. Ball 2: m=${m2}, v=${v2.toFixed(0)} px/s. ` +
      `Collided: ${collided}. Total momentum: ${(m1 * v1 + m2 * v2).toFixed(0)}. ` +
      `Conservation of momentum and kinetic energy demonstrated.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupScenario();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CollisionFactory;
