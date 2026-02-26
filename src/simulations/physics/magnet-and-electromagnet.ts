import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagnetAndElectromagnetFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnet-and-electromagnet") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let current = 5;
  let coilTurns = 10;
  let distance = 200;
  let flipPolarity = 0;

  // Magnet dimensions
  const MAGNET_HALF_LEN = 50;
  const MAGNET_HALF_W = 18;
  const COIL_WIDTH = 40;
  const COIL_HEIGHT = 50;
  const CORE_WIDTH = 20;

  // Derived force
  let forceValue = 0;
  let forceDirection = 0; // +1 attract, -1 repel

  // Animation for force arrows
  let forceAnimPhase = 0;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  // Dipole field of a magnet centered at (ox, oy) pointing along +x direction
  // with given moment strength
  function dipoleFieldAt(
    px: number, py: number,
    ox: number, oy: number,
    moment: number, pointAngle: number
  ): { bx: number; by: number } {
    const dx = px - ox;
    const dy = py - oy;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    if (r < 5) return { bx: 0, by: 0 };

    const r5 = r2 * r2 * r;
    const mx = Math.cos(pointAngle) * moment;
    const my = Math.sin(pointAngle) * moment;
    const mDotR = mx * dx + my * dy;
    const scale = 400;
    const bx = scale * (3 * mDotR * dx / r5 - mx / (r2 * r));
    const by = scale * (3 * mDotR * dy / r5 - my / (r2 * r));
    return { bx, by };
  }

  function combinedField(px: number, py: number): { bx: number; by: number } {
    const cy = height / 2;
    const magnetX = width / 2 - distance / 2;
    const electroX = width / 2 + distance / 2;

    // Permanent magnet: N pole pointing right
    const f1 = dipoleFieldAt(px, py, magnetX, cy, 5, 0);

    // Electromagnet: strength proportional to current * turns
    const emStrength = current * coilTurns * 0.05;
    const emAngle = flipPolarity >= 0.5 ? Math.PI : 0;
    const f2 = dipoleFieldAt(px, py, electroX, cy, emStrength, emAngle);

    return { bx: f1.bx + f2.bx, by: f1.by + f2.by };
  }

  function update(dt: number, params: Record<string, number>): void {
    current = params.current ?? 5;
    coilTurns = Math.round(params.coilTurns ?? 10);
    distance = params.distance ?? 200;
    flipPolarity = params.flipPolarity ?? 0;
    time += dt;
    forceAnimPhase += dt * 2;

    // Calculate force between magnets
    // Approximate force: F ~ m1 * m2 / d^4  (dipole-dipole interaction)
    const emStrength = current * coilTurns * 0.05;
    const permanentStrength = 5;
    const effectiveDist = Math.max(distance, 80);
    const forceMag = permanentStrength * emStrength * 1e6 / (effectiveDist * effectiveDist * effectiveDist * effectiveDist);
    forceValue = Math.min(forceMag, 50);

    // If electromagnet N faces permanent magnet N -> repel (+1)
    // Permanent magnet has N on right side. Electromagnet N on left if not flipped.
    if (flipPolarity >= 0.5) {
      // Electromagnet flipped: its S pole faces permanent magnet N -> attract
      forceDirection = 1; // attract
    } else {
      // Electromagnet N faces permanent magnet N -> repel
      forceDirection = -1; // repel
    }
  }

  function traceFieldLine(startX: number, startY: number, forward: boolean): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    let x = startX;
    let y = startY;
    const stepSize = 3;
    const maxSteps = 600;

    for (let i = 0; i < maxSteps; i++) {
      points.push({ x, y });
      const field = combinedField(x, y);
      const mag = Math.sqrt(field.bx * field.bx + field.by * field.by);
      if (mag < 0.00001) break;

      const dir = forward ? 1 : -1;
      const nx = x + dir * (field.bx / mag) * stepSize;
      const ny = y + dir * (field.by / mag) * stepSize;

      if (nx < -30 || nx > width + 30 || ny < -30 || ny > height + 30) break;

      x = nx;
      y = ny;
    }
    return points;
  }

  function drawFieldLine(points: { x: number; y: number }[], color: string): void {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Arrow heads
    const arrowCount = 2;
    const step = Math.floor(points.length / (arrowCount + 1));
    for (let k = 1; k <= arrowCount; k++) {
      const idx = Math.min(k * step, points.length - 2);
      const ang = Math.atan2(
        points[idx + 1].y - points[idx].y,
        points[idx + 1].x - points[idx].x
      );
      const sz = 5;
      ctx.beginPath();
      ctx.moveTo(points[idx].x + Math.cos(ang) * sz, points[idx].y + Math.sin(ang) * sz);
      ctx.lineTo(points[idx].x + Math.cos(ang + 2.5) * sz, points[idx].y + Math.sin(ang + 2.5) * sz);
      ctx.lineTo(points[idx].x + Math.cos(ang - 2.5) * sz, points[idx].y + Math.sin(ang - 2.5) * sz);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function drawPermanentMagnet(cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    // South pole (left) - blue
    ctx.fillStyle = "#3498db";
    ctx.fillRect(-MAGNET_HALF_LEN, -MAGNET_HALF_W, MAGNET_HALF_LEN, MAGNET_HALF_W * 2);
    ctx.strokeStyle = "#2980b9";
    ctx.lineWidth = 2;
    ctx.strokeRect(-MAGNET_HALF_LEN, -MAGNET_HALF_W, MAGNET_HALF_LEN, MAGNET_HALF_W * 2);

    // North pole (right) - red
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(0, -MAGNET_HALF_W, MAGNET_HALF_LEN, MAGNET_HALF_W * 2);
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -MAGNET_HALF_W, MAGNET_HALF_LEN, MAGNET_HALF_W * 2);

    // Labels
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", -MAGNET_HALF_LEN / 2, 0);
    ctx.fillText("N", MAGNET_HALF_LEN / 2, 0);

    // Divider
    ctx.beginPath();
    ctx.moveTo(0, -MAGNET_HALF_W);
    ctx.lineTo(0, MAGNET_HALF_W);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // Label below
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Permanent Magnet", cx, cy + MAGNET_HALF_W + 18);
  }

  function drawElectromagnet(cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    // Iron core
    ctx.fillStyle = "#666";
    ctx.fillRect(-CORE_WIDTH / 2, -COIL_HEIGHT, CORE_WIDTH, COIL_HEIGHT * 2);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.strokeRect(-CORE_WIDTH / 2, -COIL_HEIGHT, CORE_WIDTH, COIL_HEIGHT * 2);

    // Coil windings
    const windingsToShow = Math.min(coilTurns, 20);
    const windingSpacing = (COIL_HEIGHT * 2 - 4) / windingsToShow;
    const coilColor = current > 0 ? `rgba(255, 165, 0, ${0.5 + 0.5 * Math.min(current / 10, 1)})` : "rgba(180, 120, 60, 0.6)";

    for (let i = 0; i < windingsToShow; i++) {
      const wy = -COIL_HEIGHT + 2 + i * windingSpacing + windingSpacing / 2;

      // Left side coil
      ctx.beginPath();
      ctx.ellipse(-CORE_WIDTH / 2 - 6, wy, 8, windingSpacing * 0.4, 0, -Math.PI / 2, Math.PI / 2);
      ctx.strokeStyle = coilColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Right side coil
      ctx.beginPath();
      ctx.ellipse(CORE_WIDTH / 2 + 6, wy, 8, windingSpacing * 0.4, 0, Math.PI / 2, -Math.PI / 2);
      ctx.strokeStyle = coilColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Pole labels at top and bottom (or left and right for horizontal)
    const nSide = flipPolarity >= 0.5 ? 1 : -1; // N is left if not flipped
    ctx.fillStyle = "#e74c3c";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", nSide * (COIL_WIDTH + 12), 0);

    ctx.fillStyle = "#3498db";
    ctx.fillText("S", -nSide * (COIL_WIDTH + 12), 0);

    // Current indicator glow
    if (Math.abs(current) > 0.1) {
      const glowIntensity = 0.3 + 0.2 * Math.sin(time * 3);
      ctx.strokeStyle = `rgba(255, 200, 50, ${0.4 + glowIntensity})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, COIL_HEIGHT + 10, 0, Math.PI * 1.5);
      ctx.stroke();
    }

    ctx.restore();

    // Labels below
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Electromagnet", cx, cy + COIL_HEIGHT + 18);
    ctx.fillText(`I = ${current.toFixed(1)} A, ${coilTurns} turns`, cx, cy + COIL_HEIGHT + 34);
  }

  function drawForceArrows(): void {
    if (forceValue < 0.01) return;

    const cy = height / 2;
    const magnetX = width / 2 - distance / 2;
    const electroX = width / 2 + distance / 2;

    const arrowLen = Math.min(forceValue * 3, distance * 0.3);
    const pulse = 0.7 + 0.3 * Math.sin(forceAnimPhase);
    const alpha = Math.min(0.9, forceValue / 10) * pulse;

    const isAttract = forceDirection > 0;
    const color = isAttract ? `rgba(50, 205, 50, ${alpha})` : `rgba(255, 80, 80, ${alpha})`;
    const label = isAttract ? "ATTRACT" : "REPEL";
    if (isAttract) {
      drawArrow(magnetX + MAGNET_HALF_LEN + 8, cy, magnetX + MAGNET_HALF_LEN + 8 + arrowLen, cy, color);
      drawArrow(electroX - COIL_WIDTH - 8, cy, electroX - COIL_WIDTH - 8 - arrowLen, cy, color);
    } else {
      drawArrow(magnetX - MAGNET_HALF_LEN - 8, cy, magnetX - MAGNET_HALF_LEN - 8 - arrowLen, cy, color);
      drawArrow(electroX + COIL_WIDTH + 8, cy, electroX + COIL_WIDTH + 8 + arrowLen, cy, color);
    }
    ctx.fillStyle = color.replace(/[\d.]+\)$/, `${alpha * 0.8})`);
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, width / 2, cy - 40);
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(ang - 0.4), y2 - headLen * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(ang + 0.4), y2 - headLen * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cy = height / 2;
    const magnetX = width / 2 - distance / 2;
    const electroX = width / 2 + distance / 2;

    // Draw field lines from both magnets
    const numLines = 8;
    const emAngle = flipPolarity >= 0.5 ? Math.PI : 0;
    for (let i = 0; i < numLines; i++) {
      const spreadY = ((i + 0.5) / numLines - 0.5) * MAGNET_HALF_W * 1.6;
      // Permanent magnet field lines
      drawFieldLine(traceFieldLine(magnetX + MAGNET_HALF_LEN + 3, cy + spreadY, true), "rgba(100, 180, 255, 0.5)");
      drawFieldLine(traceFieldLine(magnetX - MAGNET_HALF_LEN - 3, cy + spreadY, false), "rgba(100, 180, 255, 0.5)");
      // Electromagnet field lines
      drawFieldLine(traceFieldLine(electroX + Math.cos(emAngle) * (COIL_WIDTH + 3), cy + spreadY, true), "rgba(255, 180, 100, 0.4)");
      drawFieldLine(traceFieldLine(electroX - Math.cos(emAngle) * (COIL_WIDTH + 3), cy + spreadY, false), "rgba(255, 180, 100, 0.4)");
    }

    drawForceArrows();
    drawPermanentMagnet(magnetX, cy);
    drawElectromagnet(electroX, cy);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Force: ${forceValue.toFixed(2)} (arb. units)  |  Distance: ${distance.toFixed(0)} px`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    forceAnimPhase = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const emStrength = current * coilTurns * 0.05;
    const polarity = flipPolarity >= 0.5 ? "flipped (S faces permanent N)" : "normal (N faces permanent N)";
    const interaction = forceDirection > 0 ? "attracting" : "repelling";
    return (
      `Magnet & Electromagnet: permanent magnet (5 T) and electromagnet ` +
      `(I=${current} A, ${coilTurns} turns, effective moment=${emStrength.toFixed(1)}). ` +
      `Distance: ${distance} px, polarity: ${polarity}. ` +
      `The magnets are ${interaction} with force ~${forceValue.toFixed(2)} arb. units. ` +
      `Electromagnet strength depends on B = mu0 * n * I.`
    );
  }

  function resize(w: number, h: number): void {
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

export default MagnetAndElectromagnetFactory;
