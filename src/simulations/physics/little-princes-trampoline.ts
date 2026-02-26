import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LittlePrincesTrampolineFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("little-princes-trampoline") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let asteroidRadius = 50; // 10 to 100 (arbitrary units)
  let springConstant = 5;
  let characterMass = 1;

  // Physics state
  let posY = 0; // character vertical position relative to trampoline surface
  let velY = 0;
  let trampolineDeflection = 0;
  const CHAR_HEIGHT = 40;

  // Gravity depends on asteroid radius (g proportional to r for uniform density)
  function gravity(): number {
    // g = (4/3)πGρr, simplified: g proportional to radius
    return 0.5 + (asteroidRadius / 100) * 15;
  }

  // Bounce history
  const bounceHistory: number[] = [];
  const MAX_BOUNCES = 100;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    posY = 80;
    velY = 0;
    trampolineDeflection = 0;
    bounceHistory.length = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    asteroidRadius = params.asteroidRadius ?? 50;
    springConstant = params.springConstant ?? 5;
    characterMass = params.characterMass ?? 1;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    const g = gravity();

    // Character is above trampoline: free fall
    if (posY > 0) {
      velY -= g * dtClamped * 60;
      posY += velY * dtClamped * 60;
      trampolineDeflection *= 0.9; // Spring back

      if (posY <= 0) {
        posY = 0;
        // Record bounce height
        bounceHistory.push(Math.abs(velY) * Math.abs(velY) / (2 * g));
        if (bounceHistory.length > MAX_BOUNCES) bounceHistory.shift();
      }
    }

    // On or below trampoline: spring force
    if (posY <= 0) {
      trampolineDeflection = -posY;
      const springForce = springConstant * (-posY) / characterMass;
      const dampingForce = -velY * 0.1;
      velY += (springForce + dampingForce - g) * dtClamped * 60;
      posY += velY * dtClamped * 60;

      // Newton's 3rd law: trampoline pushes character up, character pushes trampoline down
      if (posY > 0 && velY > 0) {
        // Launched off trampoline
        trampolineDeflection = 0;
      }
    }
  }

  function render() {
    if (!ctx) return;

    // Space background with stars
    ctx.fillStyle = "#0a0a2e";
    ctx.fillRect(0, 0, W, H);

    // Stars
    const starSeed = 42;
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137 + starSeed) % W);
      const sy = ((i * 97 + starSeed * 3) % (H * 0.6));
      const brightness = 0.3 + ((i * 73) % 100) / 100 * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("The Little Prince's Trampoline", W / 2, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Newton's 3rd Law: Action & Reaction | Gravity depends on asteroid size", W / 2, 46);

    // Asteroid
    const asteroidCx = W / 2;
    const asteroidVisualR = 40 + asteroidRadius * 1.2;
    const asteroidCy = H - 50 - asteroidVisualR * 0.3;
    const surfaceY = asteroidCy - asteroidVisualR * 0.85;

    // Draw asteroid (arc at bottom)
    ctx.beginPath();
    ctx.arc(asteroidCx, asteroidCy + asteroidVisualR * 0.3, asteroidVisualR, Math.PI, 2 * Math.PI);
    const astGrad = ctx.createRadialGradient(
      asteroidCx - 20, asteroidCy - 30, 0,
      asteroidCx, asteroidCy, asteroidVisualR
    );
    astGrad.addColorStop(0, "#b68e5c");
    astGrad.addColorStop(0.5, "#8b6f47");
    astGrad.addColorStop(1, "#5c4a2e");
    ctx.fillStyle = astGrad;
    ctx.fill();

    // Craters
    const craters = [[0.2, 0.1, 8], [0.6, 0.15, 12], [0.8, 0.05, 6], [0.4, 0.2, 10]];
    for (const [frac, yf, r] of craters) {
      const cx = asteroidCx - asteroidVisualR + frac * 2 * asteroidVisualR;
      const cy = surfaceY + yf * asteroidVisualR * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fill();
    }

    // Trampoline
    const trampolineY = surfaceY - 20;
    const trampolineW = 80;
    const trampolineL = asteroidCx - trampolineW / 2;
    const trampolineR = asteroidCx + trampolineW / 2;
    const deflect = Math.min(trampolineDeflection * 2, 30);

    // Trampoline legs
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trampolineL, trampolineY);
    ctx.lineTo(trampolineL - 5, surfaceY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(trampolineR, trampolineY);
    ctx.lineTo(trampolineR + 5, surfaceY);
    ctx.stroke();

    // Trampoline surface (curved when deflected)
    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.moveTo(trampolineL, trampolineY);
    ctx.quadraticCurveTo(
      asteroidCx, trampolineY + deflect,
      trampolineR, trampolineY
    );
    ctx.stroke();

    // Springs
    const numSprings = 5;
    for (let i = 0; i < numSprings; i++) {
      const sx = trampolineL + (i + 0.5) * (trampolineW / numSprings);
      const sTop = trampolineY + deflect * (1 - Math.abs(i - 2) / 3);
      const sBot = surfaceY;
      drawSpring(sx, sTop, sBot);
    }

    // Character (The Little Prince)
    const charBaseY = trampolineY - Math.max(posY * 2, -deflect) - 5;
    drawCharacter(asteroidCx, charBaseY);

    // Force arrows (Newton's 3rd Law)
    if (posY <= 5) {
      const forceScale = Math.max(deflect * 2, gravity() * 5);

      // Force on character (up) - reaction
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(asteroidCx + 35, charBaseY);
      ctx.lineTo(asteroidCx + 35, charBaseY - forceScale);
      ctx.stroke();
      drawArrowHead(asteroidCx + 35, charBaseY - forceScale, -Math.PI / 2, "#10b981");
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillStyle = "#10b981";
      ctx.textAlign = "left";
      ctx.fillText("F↑ (reaction)", asteroidCx + 42, charBaseY - forceScale / 2);

      // Force on trampoline (down) - action
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(asteroidCx - 35, trampolineY);
      ctx.lineTo(asteroidCx - 35, trampolineY + forceScale);
      ctx.stroke();
      drawArrowHead(asteroidCx - 35, trampolineY + forceScale, Math.PI / 2, "#ef4444");
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "right";
      ctx.fillText("F↓ (action)", asteroidCx - 42, trampolineY + forceScale / 2);
    }

    // Gravity arrow
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    const gArrowLen = gravity() * 3;
    ctx.beginPath();
    ctx.moveTo(asteroidCx, charBaseY + 5);
    ctx.lineTo(asteroidCx, charBaseY + 5 + gArrowLen);
    ctx.stroke();
    drawArrowHead(asteroidCx, charBaseY + 5 + gArrowLen, Math.PI / 2, "#fbbf24");
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.fillText(`g = ${gravity().toFixed(1)} m/s²`, asteroidCx + 8, charBaseY + 5 + gArrowLen / 2);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(15, 60, 200, 100, 8);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Physics", 25, 78);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Asteroid radius: ${asteroidRadius}`, 25, 95);
    ctx.fillText(`Gravity: ${gravity().toFixed(2)} m/s²`, 25, 110);
    ctx.fillText(`Height: ${Math.max(0, posY).toFixed(1)}`, 25, 125);
    ctx.fillText(`Velocity: ${velY.toFixed(2)} m/s`, 25, 140);

    // Newton's 3rd Law explanation
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(W - 280, 60, 265, 60, 8);
    ctx.fill();

    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Newton's 3rd Law", W - 270, 78);
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Every action has an equal & opposite reaction.", W - 270, 95);
    ctx.fillText("Character pushes trampoline down → trampoline pushes back up.", W - 270, 110);
  }

  function drawSpring(x: number, top: number, bottom: number) {
    const h = bottom - top;
    const coils = 5;
    const coilH = h / coils;
    const amp = 5;

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    for (let i = 0; i < coils; i++) {
      const y1 = top + i * coilH;
      ctx.lineTo(x + amp, y1 + coilH * 0.25);
      ctx.lineTo(x - amp, y1 + coilH * 0.75);
    }
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  function drawCharacter(cx: number, baseY: number) {
    // Simple stick figure with scarf (The Little Prince style)
    const headR = 10;
    const headY = baseY - CHAR_HEIGHT + headR;

    // Body
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, headY + headR);
    ctx.lineTo(cx, baseY - 10);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(cx, baseY - 10);
    ctx.lineTo(cx - 8, baseY);
    ctx.moveTo(cx, baseY - 10);
    ctx.lineTo(cx + 8, baseY);
    ctx.stroke();

    // Arms
    const armAngle = Math.sin(time * 5) * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx, headY + headR + 10);
    ctx.lineTo(cx - 12 * Math.cos(armAngle), headY + headR + 10 - 12 * Math.sin(armAngle));
    ctx.moveTo(cx, headY + headR + 10);
    ctx.lineTo(cx + 12 * Math.cos(armAngle), headY + headR + 10 - 12 * Math.sin(armAngle));
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = "#fef3c7";
    ctx.fill();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hair (spiky blonde)
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.8 + i * Math.PI * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * headR * 0.8, headY + Math.sin(a) * headR * 0.8);
      ctx.lineTo(cx + Math.cos(a) * (headR + 6), headY + Math.sin(a) * (headR + 6));
      ctx.stroke();
    }

    // Scarf
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, headY + headR);
    ctx.quadraticCurveTo(cx - 15, headY + headR + 15, cx - 5, headY + headR + 20);
    ctx.stroke();
  }

  function drawArrowHead(x: number, y: number, angle: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function reset() {
    time = 0;
    posY = 80;
    velY = 0;
    trampolineDeflection = 0;
    bounceHistory.length = 0;
  }

  function destroy() { bounceHistory.length = 0; }

  function getStateDescription(): string {
    return (
      `Little Prince's Trampoline: Asteroid radius=${asteroidRadius}, ` +
      `gravity=${gravity().toFixed(2)} m/s², spring constant=${springConstant}. ` +
      `Height: ${Math.max(0, posY).toFixed(1)}, Velocity: ${velY.toFixed(2)} m/s. ` +
      `Demonstrates Newton's 3rd Law: the character pushes down on the trampoline (action), ` +
      `and the trampoline pushes the character up (reaction) with equal force. ` +
      `Smaller asteroids have weaker gravity, causing higher bounces.`
    );
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LittlePrincesTrampolineFactory;
