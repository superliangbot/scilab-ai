import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectrostaticInductionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electrostatic-induction") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let chargeStrength = 5;
  let rodDistance = 50;
  let separation = 0; // 0 = together, 100 = fully separated
  let polarity = 1;

  // Two conductors
  interface Charge {
    x: number;
    y: number;
    vx: number;
    vy: number;
    sign: number; // +1 or -1
  }

  let charges: Charge[] = [];
  const NUM_CHARGES = 40;

  // Conductor geometry
  const COND_Y = 280;
  const COND_H = 60;
  const COND_W = 140;

  function getConductorPositions() {
    const gap = separation * 1.5;
    const leftX = W / 2 - COND_W - gap / 2;
    const rightX = W / 2 + gap / 2;
    return {
      left: { x: leftX, y: COND_Y, w: COND_W, h: COND_H },
      right: { x: rightX, y: COND_Y, w: COND_W, h: COND_H },
    };
  }

  function createCharges(): void {
    charges = [];
    const conds = getConductorPositions();
    for (let i = 0; i < NUM_CHARGES; i++) {
      const inLeft = i < NUM_CHARGES / 2;
      const c = inLeft ? conds.left : conds.right;
      charges.push({
        x: c.x + Math.random() * c.w,
        y: c.y + Math.random() * c.h,
        vx: 0,
        vy: 0,
        sign: i % 2 === 0 ? -1 : 1, // alternating electrons and positive ions
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    createCharges();
  }

  function update(dt: number, params: Record<string, number>): void {
    chargeStrength = params.chargeStrength ?? 5;
    rodDistance = params.rodDistance ?? 50;
    separation = params.separation ?? 0;
    polarity = params.polarity ?? 1;

    const conds = getConductorPositions();
    const rodX = conds.right.x + conds.right.w + 40 + rodDistance * 2;
    const rodY = COND_Y + COND_H / 2;

    // Move electrons toward/away from rod based on induction
    for (const ch of charges) {
      if (ch.sign !== -1) continue; // Only electrons move

      const dx = rodX - ch.x;
      const dy = rodY - ch.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      // Force from rod (electrons attracted to positive rod, repelled by negative)
      const force = polarity * chargeStrength * 200 / (dist * dist + 1000);
      ch.vx += force * (dx / dist) * dt;
      ch.vy += force * (dy / dist) * dt * 0.3;

      // Damping
      ch.vx *= 0.95;
      ch.vy *= 0.95;

      ch.x += ch.vx * dt * 60;
      ch.y += ch.vy * dt * 60;

      // Clamp to conductor bounds
      const connected = separation < 10;
      if (connected) {
        const minX = conds.left.x + 3;
        const maxX = conds.right.x + conds.right.w - 3;
        ch.x = Math.max(minX, Math.min(maxX, ch.x));
        ch.y = Math.max(COND_Y + 3, Math.min(COND_Y + COND_H - 3, ch.y));
      } else {
        // Check which conductor it's closest to and clamp there
        const leftDist = Math.abs(ch.x - (conds.left.x + conds.left.w / 2));
        const rightDist = Math.abs(ch.x - (conds.right.x + conds.right.w / 2));
        const c = leftDist < rightDist ? conds.left : conds.right;
        ch.x = Math.max(c.x + 3, Math.min(c.x + c.w - 3, ch.x));
        ch.y = Math.max(c.y + 3, Math.min(c.y + c.h - 3, ch.y));
      }
    }

    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a0a1a");
    grad.addColorStop(1, "#10102a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawConductors(): void {
    const conds = getConductorPositions();

    for (const c of [conds.left, conds.right]) {
      const grad = ctx.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
      grad.addColorStop(0, "#a0a8b8");
      grad.addColorStop(0.5, "#7a8090");
      grad.addColorStop(1, "#5a6070");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, c.w, c.h, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(200, 220, 255, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Connection indicator
    if (separation < 10) {
      ctx.fillStyle = "#7a8090";
      ctx.fillRect(conds.left.x + conds.left.w, COND_Y + COND_H / 2 - 5, conds.right.x - (conds.left.x + conds.left.w), 10);
    }
  }

  function drawCharges(): void {
    for (const ch of charges) {
      const isElectron = ch.sign === -1;
      const color = isElectron ? "rgba(60, 140, 255, 0.85)" : "rgba(255, 80, 80, 0.85)";
      const symbol = isElectron ? "−" : "+";

      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Glow
      const glow = ctx.createRadialGradient(ch.x, ch.y, 0, ch.x, ch.y, 14);
      glow.addColorStop(0, isElectron ? "rgba(60,140,255,0.2)" : "rgba(255,80,80,0.2)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, ch.x, ch.y);
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawChargedRod(): void {
    const conds = getConductorPositions();
    const rodX = conds.right.x + conds.right.w + 40 + rodDistance * 2;
    const rodY = COND_Y + COND_H / 2;
    const rodLen = 120;

    // Hand
    ctx.fillStyle = "#e8b88a";
    ctx.beginPath();
    ctx.ellipse(rodX + rodLen / 2 + 20, rodY, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rod
    const rodColor = polarity > 0 ? "#e74c3c" : "#3498db";
    ctx.fillStyle = rodColor;
    ctx.beginPath();
    ctx.roundRect(rodX - rodLen / 2, rodY - 10, rodLen, 20, 6);
    ctx.fill();

    // Charge symbols
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    const sym = polarity > 0 ? "+" : "−";
    for (let i = 0; i < 4; i++) {
      ctx.fillText(sym, rodX - rodLen / 2 + 15 + i * 28, rodY + 5);
    }

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(polarity > 0 ? "Positive Rod" : "Negative Rod", rodX, rodY - 20);
  }

  function drawFieldLines(): void {
    const conds = getConductorPositions();
    const rodX = conds.right.x + conds.right.w + 40 + rodDistance * 2;
    const rodY = COND_Y + COND_H / 2;
    const conductorCenterX = (conds.left.x + conds.right.x + conds.right.w) / 2;

    ctx.save();
    ctx.strokeStyle = "rgba(255, 200, 50, 0.15)";
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const startY = rodY + i * 15;
      ctx.beginPath();
      ctx.moveTo(rodX - 60, startY);
      const cp1x = (rodX + conductorCenterX) / 2;
      ctx.quadraticCurveTo(cp1x, startY + i * 5, conductorCenterX + COND_W / 2, rodY + i * 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNetChargeLabels(): void {
    const conds = getConductorPositions();
    const effectiveField = polarity * chargeStrength * (100 - rodDistance) / 100;

    if (Math.abs(effectiveField) < 0.5) return;

    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";

    // Right conductor (near rod): attracted charges
    const nearSign = polarity > 0 ? "−" : "+";
    const nearColor = polarity > 0 ? "#60a0ff" : "#ff6060";
    ctx.fillStyle = nearColor;
    ctx.fillText(nearSign + nearSign + nearSign, conds.right.x + conds.right.w / 2, conds.right.y - 12);

    // Left conductor (far from rod): repelled charges
    const farSign = polarity > 0 ? "+" : "−";
    const farColor = polarity > 0 ? "#ff6060" : "#60a0ff";
    ctx.fillStyle = farColor;
    ctx.fillText(farSign + farSign + farSign, conds.left.x + conds.left.w / 2, conds.left.y - 12);
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 320;
    const ph = 110;
    const px = 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Electrostatic Induction", px + 12, py + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Charge: ${chargeStrength.toFixed(1)} | Distance: ${rodDistance.toFixed(0)}%`, px + 12, py + 42);
    ctx.fillText(`Separation: ${separation.toFixed(0)}% | Polarity: ${polarity > 0 ? "+" : "−"}`, px + 12, py + 58);
    ctx.fillText("Charges redistribute without physical contact.", px + 12, py + 78);
    ctx.fillText("Separate conductors while rod is near → each retains net charge.", px + 12, py + 94);

    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawFieldLines();
    drawConductors();
    drawCharges();
    drawChargedRod();
    drawNetChargeLabels();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    createCharges();
  }

  function destroy(): void {
    charges = [];
  }

  function getStateDescription(): string {
    const pol = polarity > 0 ? "positive" : "negative";
    const connected = separation < 10 ? "connected" : "separated";
    return (
      `Electrostatic Induction: A ${pol} rod (strength=${chargeStrength.toFixed(1)}) at distance ${rodDistance.toFixed(0)}%. ` +
      `Two conductors are ${connected}. ` +
      `The rod's electric field causes free electrons in the conductors to redistribute. ` +
      `Opposite charges accumulate on the near side, like charges on the far side. ` +
      `If separated while the rod is near, each conductor retains a net charge.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
    createCharges();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectrostaticInductionFactory;
