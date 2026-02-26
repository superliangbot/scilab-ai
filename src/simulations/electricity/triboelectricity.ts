import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Charge {
  x: number;
  y: number;
  vx: number;
  vy: number;
  positive: boolean;
  alpha: number;
}

const TriboelectricityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("triboelectricity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let charges: Charge[] = [];
  let frictionIntensity = 5;
  let materialPair = 0;
  let rubCount = 0;
  let balloonCharge = 0;
  let rodCharge = 0;

  // Rub animation
  let rubPhase = 0;

  const materials = [
    { name: "Balloon + Fur", objA: "Balloon", objB: "Fur", colorA: "#e74c3c", colorB: "#8B4513" },
    { name: "Glass + Silk", objA: "Glass Rod", objB: "Silk", colorA: "#87CEEB", colorB: "#DDA0DD" },
    { name: "Rubber + Wool", objA: "Rubber Rod", objB: "Wool", colorA: "#2c3e50", colorB: "#F5DEB3" },
  ];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    charges = [];
    rubCount = 0;
    balloonCharge = 0;
    rodCharge = 0;
  }

  function addCharges(): void {
    const cx = width / 2;
    const cy = height * 0.45;
    for (let i = 0; i < 3; i++) {
      // Negative charge moves to object A (e.g., balloon)
      charges.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 20,
        vx: -2 - Math.random() * 3,
        vy: (Math.random() - 0.5) * 2,
        positive: false,
        alpha: 1,
      });
      // Positive charge stays on object B (e.g., fur)
      charges.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 20,
        vx: 2 + Math.random() * 3,
        vy: (Math.random() - 0.5) * 2,
        positive: true,
        alpha: 1,
      });
    }
    balloonCharge -= 3;
    rodCharge += 3;
  }

  function update(dt: number, params: Record<string, number>): void {
    frictionIntensity = params.frictionIntensity ?? 5;
    materialPair = Math.min(2, Math.max(0, Math.round(params.materialPair ?? 0)));

    rubPhase += dt * frictionIntensity;

    // Auto-generate charges periodically
    const rubInterval = 1.5 / frictionIntensity;
    const prevRub = Math.floor((time) / rubInterval);
    const nextRub = Math.floor((time + dt) / rubInterval);
    if (nextRub > prevRub && charges.length < 200) {
      addCharges();
      rubCount++;
    }

    // Update charges
    for (const ch of charges) {
      ch.x += ch.vx * dt * 60;
      ch.y += ch.vy * dt * 60;
      ch.vy += (Math.random() - 0.5) * 0.3;
      ch.vx *= 0.98;
      ch.vy *= 0.98;
    }

    // Fade old charges
    for (const ch of charges) {
      if (Math.abs(ch.x - width / 2) > width * 0.3) {
        ch.alpha -= dt * 0.3;
      }
    }
    charges = charges.filter((ch) => ch.alpha > 0);

    time += dt;
  }

  function drawObject(x: number, y: number, w: number, h: number, color: string, label: string, charge: number): void {
    // Object body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - h / 2 - 10);

    // Charge indicator
    if (charge !== 0) {
      const chargeStr = charge > 0 ? `+${Math.abs(charge)}` : `−${Math.abs(charge)}`;
      ctx.fillStyle = charge > 0 ? "#ff6b6b" : "#74b9ff";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText(chargeStr, x, y + h / 2 + 20);
    }
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0f0c29");
    bg.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const mat = materials[materialPair];
    const cy = height * 0.45;

    // Rubbing motion
    const rubOffset = Math.sin(rubPhase * 4) * 15;

    // Draw objects
    const leftX = width * 0.3 + rubOffset * 0.5;
    const rightX = width * 0.7 - rubOffset * 0.5;
    drawObject(leftX, cy, 120, 80, mat.colorA, mat.objA, balloonCharge);
    drawObject(rightX, cy, 120, 80, mat.colorB, mat.objB, rodCharge);

    // Draw friction zone
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.abs(Math.sin(rubPhase * 4)) * 0.4;
    const sparkX = width / 2;
    for (let i = 0; i < 5; i++) {
      const sx = sparkX + Math.sin(time * 10 + i) * 20;
      const sy = cy + Math.cos(time * 8 + i * 2) * 15;
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.restore();

    // Draw charges
    for (const ch of charges) {
      ctx.save();
      ctx.globalAlpha = ch.alpha;
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = ch.positive ? "#ff6b6b" : "#74b9ff";
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ch.positive ? "+" : "−", ch.x, ch.y);
      ctx.restore();
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Triboelectricity (Static Electricity)", width / 2, 28);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(`Material: ${mat.name}`, width / 2, 48);

    // Info panel
    const panelY = height - 100;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(20, panelY, width - 40, 85, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Triboelectric Effect: Electrons transfer between materials when rubbed together.", 35, panelY + 20);
    ctx.fillText(`${mat.objA} gains electrons (becomes negative), ${mat.objB} loses electrons (becomes positive).`, 35, panelY + 40);
    ctx.fillText(`Rub cycles: ${rubCount} | Net charge transferred: ${Math.abs(balloonCharge)} electrons`, 35, panelY + 60);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Triboelectric series determines which material gains/loses electrons.", 35, panelY + 76);
  }

  function reset(): void {
    time = 0;
    charges = [];
    rubCount = 0;
    balloonCharge = 0;
    rodCharge = 0;
    rubPhase = 0;
  }

  function destroy(): void {
    charges = [];
  }

  function getStateDescription(): string {
    const mat = materials[materialPair];
    return (
      `Triboelectricity: Rubbing ${mat.objA} against ${mat.objB}. ` +
      `${rubCount} rub cycles completed. ${mat.objA} charge: ${balloonCharge}e, ` +
      `${mat.objB} charge: +${rodCharge}e. Friction intensity: ${frictionIntensity}. ` +
      `Active charges: ${charges.length}. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TriboelectricityFactory;
