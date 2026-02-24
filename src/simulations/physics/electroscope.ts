import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectroscopeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electroscope") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let rodCharge = 5;
  let rodDistance = 50;
  let polarity = 1; // 1 = positive, -1 = negative

  // Leaf angle (radians) – animates toward target
  let leafAngle = 0;
  let targetLeafAngle = 0;
  let leafVelocity = 0;

  // Electron positions for animation
  interface Electron {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
  }
  let electrons: Electron[] = [];

  // Geometry constants
  const PLATE_Y = 160;
  const PLATE_W = 120;
  const STEM_TOP = PLATE_Y + 5;
  const STEM_BOTTOM = 360;
  const LEAF_PIVOT_Y = STEM_BOTTOM;
  const LEAF_LENGTH = 100;
  const JAR_TOP = 200;
  const JAR_BOTTOM = 480;
  const JAR_LEFT = 300;
  const JAR_RIGHT = 500;

  function createElectrons(): void {
    electrons = [];
    const cx = W / 2;
    for (let i = 0; i < 20; i++) {
      const t = i / 20;
      const y = STEM_TOP + t * (STEM_BOTTOM - STEM_TOP);
      electrons.push({
        x: cx + (Math.random() - 0.5) * 10,
        y,
        targetX: cx,
        targetY: y,
      });
    }
  }

  function computeLeafAngle(): number {
    const effectiveCharge = rodCharge * (100 - rodDistance) / 100;
    const maxAngle = Math.PI / 4;
    return maxAngle * (effectiveCharge / 10);
  }

  function updateElectronTargets(): void {
    const cx = W / 2;
    const effectiveField = polarity * rodCharge * (100 - rodDistance) / 100;

    for (let i = 0; i < electrons.length; i++) {
      const baseFrac = i / electrons.length;
      const baseY = STEM_TOP + baseFrac * (STEM_BOTTOM - STEM_TOP);

      // Electrons move opposite to field direction (toward positive, away from negative)
      const shift = -effectiveField * 15;
      const shiftedY = baseY + shift;
      const clampedY = Math.max(PLATE_Y - 20, Math.min(STEM_BOTTOM + 30, shiftedY));

      electrons[i].targetX = cx + (Math.random() - 0.5) * 6;
      electrons[i].targetY = clampedY;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    leafAngle = 0;
    leafVelocity = 0;
    createElectrons();
  }

  function update(dt: number, params: Record<string, number>): void {
    rodCharge = params.rodCharge ?? 5;
    rodDistance = params.rodDistance ?? 50;
    polarity = params.polarity ?? 1;

    targetLeafAngle = computeLeafAngle();
    updateElectronTargets();

    // Spring-damper for leaf angle
    const k = 12;
    const damp = 6;
    const accel = -k * (leafAngle - targetLeafAngle) - damp * leafVelocity;
    leafVelocity += accel * dt;
    leafAngle += leafVelocity * dt;

    // Move electrons toward targets
    for (const e of electrons) {
      e.x += (e.targetX - e.x) * 3 * dt;
      e.y += (e.targetY - e.y) * 3 * dt;
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

  function drawGlassJar(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(180, 220, 255, 0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(JAR_LEFT, JAR_TOP);
    ctx.lineTo(JAR_LEFT, JAR_BOTTOM);
    ctx.lineTo(JAR_RIGHT, JAR_BOTTOM);
    ctx.lineTo(JAR_RIGHT, JAR_TOP);
    ctx.stroke();

    // Glass fill
    ctx.fillStyle = "rgba(180, 220, 255, 0.04)";
    ctx.fillRect(JAR_LEFT, JAR_TOP, JAR_RIGHT - JAR_LEFT, JAR_BOTTOM - JAR_TOP);

    // Top cap
    ctx.fillStyle = "rgba(120, 120, 120, 0.6)";
    ctx.fillRect(JAR_LEFT - 10, JAR_TOP - 8, JAR_RIGHT - JAR_LEFT + 20, 12);
    ctx.restore();
  }

  function drawElectroscope(): void {
    const cx = W / 2;

    // Metal plate on top
    ctx.fillStyle = "#b0b0b0";
    ctx.beginPath();
    ctx.ellipse(cx, PLATE_Y, PLATE_W / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Highlight on plate
    const plateGrad = ctx.createLinearGradient(cx - PLATE_W / 2, PLATE_Y - 8, cx + PLATE_W / 2, PLATE_Y + 8);
    plateGrad.addColorStop(0, "rgba(255,255,255,0.3)");
    plateGrad.addColorStop(0.5, "rgba(255,255,255,0.1)");
    plateGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = plateGrad;
    ctx.beginPath();
    ctx.ellipse(cx, PLATE_Y, PLATE_W / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vertical stem
    ctx.fillStyle = "#999";
    ctx.fillRect(cx - 3, STEM_TOP, 6, STEM_BOTTOM - STEM_TOP);

    // Leaves
    ctx.save();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;

    // Left leaf
    ctx.beginPath();
    ctx.moveTo(cx, LEAF_PIVOT_Y);
    const lx1 = cx - Math.sin(leafAngle) * LEAF_LENGTH;
    const ly1 = LEAF_PIVOT_Y + Math.cos(leafAngle) * LEAF_LENGTH;
    ctx.lineTo(lx1, ly1);
    ctx.stroke();

    // Leaf foil shape (left)
    ctx.fillStyle = "rgba(212, 175, 55, 0.6)";
    ctx.beginPath();
    ctx.moveTo(cx, LEAF_PIVOT_Y);
    ctx.lineTo(lx1 - 8, ly1);
    ctx.lineTo(lx1 + 4, ly1 + 5);
    ctx.closePath();
    ctx.fill();

    // Right leaf
    ctx.beginPath();
    ctx.moveTo(cx, LEAF_PIVOT_Y);
    const lx2 = cx + Math.sin(leafAngle) * LEAF_LENGTH;
    const ly2 = LEAF_PIVOT_Y + Math.cos(leafAngle) * LEAF_LENGTH;
    ctx.lineTo(lx2, ly2);
    ctx.stroke();

    ctx.fillStyle = "rgba(212, 175, 55, 0.6)";
    ctx.beginPath();
    ctx.moveTo(cx, LEAF_PIVOT_Y);
    ctx.lineTo(lx2 + 8, ly2);
    ctx.lineTo(lx2 - 4, ly2 + 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawElectrons(): void {
    for (const e of electrons) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80, 160, 255, 0.8)";
      ctx.fill();

      // Glow
      const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 8);
      glow.addColorStop(0, "rgba(80, 160, 255, 0.3)");
      glow.addColorStop(1, "rgba(80, 160, 255, 0)");
      ctx.beginPath();
      ctx.arc(e.x, e.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }
  }

  function drawChargedRod(): void {
    const rodX = W / 2 + 120 + rodDistance * 2;
    const rodY = PLATE_Y;
    const rodLen = 140;

    // Hand
    ctx.fillStyle = "#e8b88a";
    ctx.beginPath();
    ctx.ellipse(rodX + rodLen / 2 + 25, rodY, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rod body
    const rodColor = polarity > 0 ? "#e74c3c" : "#3498db";
    ctx.fillStyle = rodColor;
    ctx.beginPath();
    ctx.roundRect(rodX - rodLen / 2, rodY - 10, rodLen, 20, 6);
    ctx.fill();

    // Charge symbols on rod
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    const symbol = polarity > 0 ? "+" : "−";
    for (let i = 0; i < 4; i++) {
      const sx = rodX - rodLen / 2 + 20 + i * 30;
      ctx.fillText(symbol, sx, rodY + 6);
    }

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(polarity > 0 ? "Positive Rod" : "Negative Rod", rodX, rodY - 20);
  }

  function drawChargeDistribution(): void {
    const cx = W / 2;
    const effectiveField = polarity * rodCharge * (100 - rodDistance) / 100;

    // Show + and - on the plate/stem based on induction
    if (Math.abs(effectiveField) > 0.5) {
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.textAlign = "center";

      // Plate side (near rod) gets opposite charge
      const plateSign = polarity > 0 ? "−" : "+";
      const plateColor = polarity > 0 ? "#3498db" : "#e74c3c";
      ctx.fillStyle = plateColor;
      for (let i = 0; i < 3; i++) {
        ctx.fillText(plateSign, cx + 30 + i * 15, PLATE_Y - 15);
      }

      // Leaves get same charge as rod
      const leafSign = polarity > 0 ? "+" : "−";
      const leafColor = polarity > 0 ? "#e74c3c" : "#3498db";
      ctx.fillStyle = leafColor;
      const lx1 = cx - Math.sin(leafAngle) * LEAF_LENGTH * 0.6;
      const ly1 = LEAF_PIVOT_Y + Math.cos(leafAngle) * LEAF_LENGTH * 0.6;
      ctx.fillText(leafSign, lx1, ly1);
      const lx2 = cx + Math.sin(leafAngle) * LEAF_LENGTH * 0.6;
      ctx.fillText(leafSign, lx2, ly1);
    }
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 280;
    const ph = 100;
    const px = 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Electroscope", px + 12, py + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Charge: ${rodCharge.toFixed(1)} | Distance: ${rodDistance.toFixed(0)}%`, px + 12, py + 42);
    ctx.fillText(`Leaf deflection: ${(leafAngle * 180 / Math.PI).toFixed(1)}°`, px + 12, py + 58);
    ctx.fillText(`Polarity: ${polarity > 0 ? "Positive" : "Negative"}`, px + 12, py + 74);
    ctx.fillText(`Like charges on leaves repel → deflection`, px + 12, py + 90);

    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawGlassJar();
    drawElectroscope();
    drawElectrons();
    drawChargedRod();
    drawChargeDistribution();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    leafAngle = 0;
    leafVelocity = 0;
    createElectrons();
  }

  function destroy(): void {
    electrons = [];
  }

  function getStateDescription(): string {
    const deflection = (leafAngle * 180 / Math.PI).toFixed(1);
    const pol = polarity > 0 ? "positive" : "negative";
    return (
      `Electroscope simulation: A ${pol} rod with charge=${rodCharge.toFixed(1)} is at ${rodDistance.toFixed(0)}% distance. ` +
      `The gold leaves are deflected by ${deflection}°. ` +
      `When a charged rod approaches, electrostatic induction causes charge separation in the conductor. ` +
      `The leaves acquire like charges and repel each other, spreading apart.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectroscopeFactory;
