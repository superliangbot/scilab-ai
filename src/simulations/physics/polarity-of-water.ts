import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PolarityOfWaterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("polarity-of-water") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let chargeType = 0; // 0=none, 1=positive, 2=negative
  let dropRate = 5;

  // Water molecules (polar - bent) and linear (nonpolar)
  interface WaterMol {
    x: number; y: number; vy: number; angle: number; va: number; bent: boolean;
  }
  let bentMols: WaterMol[] = [];
  let linearMols: WaterMol[] = [];

  // Layout
  let leftX = 0, rightX = 0, chamberW = 0, chamberTop = 0, chamberBottom = 0;
  let chargeY = 0;

  function layout() {
    chamberW = width * 0.35;
    leftX = width * 0.06;
    rightX = width * 0.56;
    chamberTop = height * 0.12;
    chamberBottom = height * 0.82;
    chargeY = height * 0.5;
  }

  let spawnTimer = 0;

  function spawnMol(bent: boolean) {
    const bx = bent ? leftX : rightX;
    const mol: WaterMol = {
      x: bx + chamberW * 0.3 + Math.random() * chamberW * 0.4,
      y: chamberTop + 20,
      vy: 20 + Math.random() * 10,
      angle: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 1,
      bent,
    };
    if (bent) bentMols.push(mol);
    else linearMols.push(mol);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    bentMols = [];
    linearMols = [];
    spawnTimer = 0;
    layout();
  }

  function update(dt: number, params: Record<string, number>) {
    chargeType = params.chargeType ?? 0;
    dropRate = params.dropRate ?? 5;

    // Spawn
    spawnTimer += dt;
    const rate = 0.3 / dropRate;
    while (spawnTimer > rate) {
      spawnTimer -= rate;
      spawnMol(true);
      spawnMol(false);
    }

    const gravity = 40;

    // Update bent (polar) molecules
    for (const m of bentMols) {
      m.vy += gravity * dt;

      // Charge attraction/repulsion for polar molecules
      if (chargeType > 0) {
        const chargeX = leftX + chamberW * 0.85;
        const dx = chargeX - m.x;
        const dy = chargeY - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 10;
        const force = 800 / (dist * dist) * (chargeType === 1 ? 1 : -1);
        // Polar molecules attracted to charged rod (either sign)
        m.x += (dx / dist) * Math.abs(force) * dt * 20;
        m.vy += (dy / dist) * Math.abs(force) * dt * 5;
        // Torque to align dipole
        const targetAngle = Math.atan2(dy, dx) + (chargeType === 1 ? Math.PI : 0);
        let angleDiff = targetAngle - m.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        m.va += angleDiff * 3 * dt;
      }

      m.va *= 0.97;
      m.y += m.vy * dt;
      m.angle += m.va * dt;

      // Bounce at bottom
      if (m.y > chamberBottom - 10) {
        m.y = chamberBottom - 10;
        m.vy = -Math.abs(m.vy) * 0.3;
      }
      // Keep in chamber horizontally
      if (m.x < leftX + 10) m.x = leftX + 10;
      if (m.x > leftX + chamberW - 10) m.x = leftX + chamberW - 10;
    }

    // Update linear (nonpolar) molecules — no charge response
    for (const m of linearMols) {
      m.vy += gravity * dt;
      m.va *= 0.98;
      m.y += m.vy * dt;
      m.angle += m.va * dt;

      if (m.y > chamberBottom - 10) {
        m.y = chamberBottom - 10;
        m.vy = -Math.abs(m.vy) * 0.3;
      }
      if (m.x < rightX + 10) m.x = rightX + 10;
      if (m.x > rightX + chamberW - 10) m.x = rightX + chamberW - 10;
    }

    // Limit
    if (bentMols.length > 60) bentMols.splice(0, bentMols.length - 60);
    if (linearMols.length > 60) linearMols.splice(0, linearMols.length - 60);

    time += dt;
  }

  function drawBentWater(m: WaterMol) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);

    // Oxygen (center) — 104.5° bond angle
    const bondAngle = (104.5 * Math.PI) / 180;
    const bondLen = 8;

    // Oxygen
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#e04040";
    ctx.fill();

    // Hydrogen 1
    const h1x = bondLen * Math.cos(bondAngle / 2);
    const h1y = -bondLen * Math.sin(bondAngle / 2);
    ctx.beginPath();
    ctx.arc(h1x, h1y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#4488ff";
    ctx.fill();

    // Hydrogen 2
    const h2x = bondLen * Math.cos(-bondAngle / 2);
    const h2y = -bondLen * Math.sin(-bondAngle / 2);
    ctx.beginPath();
    ctx.arc(h2x, h2y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#4488ff";
    ctx.fill();

    // Bonds
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(h1x, h1y);
    ctx.moveTo(0, 0);
    ctx.lineTo(h2x, h2y);
    ctx.stroke();

    // Dipole arrow
    ctx.strokeStyle = "rgba(255,200,50,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -bondLen - 5);
    ctx.stroke();

    ctx.restore();
  }

  function drawLinearWater(m: WaterMol) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);

    // Linear: H-O-H in a straight line (hypothetical nonpolar)
    const bondLen = 8;

    // Oxygen
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#50a050";
    ctx.fill();

    // H left
    ctx.beginPath();
    ctx.arc(-bondLen, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#70c070";
    ctx.fill();

    // H right
    ctx.beginPath();
    ctx.arc(bondLen, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#70c070";
    ctx.fill();

    // Bonds
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-bondLen + 3, 0);
    ctx.lineTo(bondLen - 3, 0);
    ctx.stroke();

    ctx.restore();
  }

  function render() {
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Bent H₂O (Polar)", leftX + chamberW / 2, chamberTop - 15);
    ctx.fillText("Linear H₂O (Nonpolar)", rightX + chamberW / 2, chamberTop - 15);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
    ctx.fillText("Bond angle: 104.5°", leftX + chamberW / 2, chamberTop - 2);
    ctx.fillText("Bond angle: 180°", rightX + chamberW / 2, chamberTop - 2);

    // Chambers
    for (const bx of [leftX, rightX]) {
      ctx.fillStyle = "rgba(20,25,50,0.6)";
      ctx.strokeStyle = "rgba(100,100,160,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, chamberTop, chamberW, chamberBottom - chamberTop, 8);
      ctx.fill();
      ctx.stroke();

      // Nozzle at top
      ctx.fillStyle = "rgba(80,80,100,0.6)";
      ctx.fillRect(bx + chamberW * 0.4, chamberTop - 5, chamberW * 0.2, 10);
    }

    // Charged rod (if active)
    if (chargeType > 0) {
      for (const bx of [leftX, rightX]) {
        const rodX = bx + chamberW * 0.85;
        ctx.fillStyle = chargeType === 1 ? "rgba(255,80,80,0.7)" : "rgba(80,80,255,0.7)";
        ctx.fillRect(rodX - 4, chargeY - 30, 8, 60);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = `bold ${Math.max(14, height * 0.025)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(chargeType === 1 ? "+" : "−", rodX, chargeY + 50);

        // Glow
        const glow = ctx.createRadialGradient(rodX, chargeY, 0, rodX, chargeY, 40);
        glow.addColorStop(0, chargeType === 1 ? "rgba(255,100,100,0.15)" : "rgba(100,100,255,0.15)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(rodX, chargeY, 40, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw molecules
    for (const m of bentMols) drawBentWater(m);
    for (const m of linearMols) drawLinearWater(m);

    // Info
    const infoY = height * 0.85;
    ctx.fillStyle = "rgba(10,10,30,0.8)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, infoY, width * 0.9, height * 0.12, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";

    if (chargeType > 0) {
      ctx.fillText("Bent (polar) water molecules deflect toward the charged rod — nonpolar ones fall straight", width / 2, infoY + 18);
      ctx.fillText("Water's 104.5° bond angle creates a net dipole moment, making it polar", width / 2, infoY + 36);
    } else {
      ctx.fillText("Both fall straight without charge. Apply a charge to see the difference!", width / 2, infoY + 18);
      ctx.fillText("Polar molecules have uneven charge distribution; nonpolar molecules are symmetric", width / 2, infoY + 36);
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Polarity of Water", width / 2, 25);
  }

  function reset() {
    time = 0;
    bentMols = [];
    linearMols = [];
    spawnTimer = 0;
  }

  function destroy() {
    bentMols = [];
    linearMols = [];
  }

  function getStateDescription(): string {
    const charge = chargeType === 0 ? "None" : chargeType === 1 ? "Positive" : "Negative";
    return `Polarity of Water | Charge: ${charge} | Bent (polar) molecules: ${bentMols.length} | Linear (nonpolar): ${linearMols.length} | ${chargeType > 0 ? "Polar molecules deflecting toward rod" : "No deflection"}`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout();
    bentMols = [];
    linearMols = [];
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PolarityOfWaterFactory;
