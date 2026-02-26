import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PolarMoleculeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("polar-molecule-and-nonpolar-molecule") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let fieldStrength = 0; // 0=off, >0 = on
  let temperature = 300;

  // Molecules
  interface Molecule {
    x: number; y: number; angle: number; vx: number; vy: number; va: number;
  }
  let polarMols: Molecule[] = [];
  let nonpolarMols: Molecule[] = [];

  const MOL_COUNT = 20;
  const MOL_SIZE = 12;

  function initMolecules() {
    polarMols = [];
    nonpolarMols = [];
    const chamberW = width * 0.38;
    const chamberH = height * 0.55;
    const leftX = width * 0.06;
    const rightX = width * 0.54;
    const topY = height * 0.22;

    for (let i = 0; i < MOL_COUNT; i++) {
      polarMols.push({
        x: leftX + 20 + Math.random() * (chamberW - 40),
        y: topY + 20 + Math.random() * (chamberH - 40),
        angle: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        va: (Math.random() - 0.5) * 2,
      });
      nonpolarMols.push({
        x: rightX + 20 + Math.random() * (chamberW - 40),
        y: topY + 20 + Math.random() * (chamberH - 40),
        angle: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        va: (Math.random() - 0.5) * 2,
      });
    }
  }

  function updateMolecule(m: Molecule, dt: number, polar: boolean, boxX: number, boxY: number, boxW: number, boxH: number) {
    const tempScale = temperature / 300;

    // Electric field torque on polar molecules
    if (polar && fieldStrength > 0) {
      // Target angle = 0 (align with horizontal field)
      const targetAngle = 0;
      let diff = targetAngle - m.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.va += diff * fieldStrength * 3 * dt;
      // Field also attracts toward the negative plate (right side)
      m.vx += fieldStrength * 8 * Math.cos(m.angle) * dt;
    }

    // Thermal jitter
    m.vx += (Math.random() - 0.5) * tempScale * 5 * dt;
    m.vy += (Math.random() - 0.5) * tempScale * 5 * dt;
    m.va += (Math.random() - 0.5) * tempScale * 1 * dt;

    // Damping
    m.vx *= 0.99;
    m.vy *= 0.99;
    m.va *= 0.97;

    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.angle += m.va * dt;

    // Bounce off walls
    const margin = MOL_SIZE;
    if (m.x < boxX + margin) { m.x = boxX + margin; m.vx = Math.abs(m.vx) * 0.8; }
    if (m.x > boxX + boxW - margin) { m.x = boxX + boxW - margin; m.vx = -Math.abs(m.vx) * 0.8; }
    if (m.y < boxY + margin) { m.y = boxY + margin; m.vy = Math.abs(m.vy) * 0.8; }
    if (m.y > boxY + boxH - margin) { m.y = boxY + boxH - margin; m.vy = -Math.abs(m.vy) * 0.8; }
  }

  function drawPolarMolecule(m: Molecule) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);

    // Negative end (delta-)
    ctx.beginPath();
    ctx.arc(-MOL_SIZE * 0.6, 0, MOL_SIZE * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e04040";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("δ-", -MOL_SIZE * 0.6, 0);

    // Positive end (delta+)
    ctx.beginPath();
    ctx.arc(MOL_SIZE * 0.6, 0, MOL_SIZE * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#4060e0";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("δ+", MOL_SIZE * 0.6, 0);

    // Bond
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-MOL_SIZE * 0.3, 0);
    ctx.lineTo(MOL_SIZE * 0.3, 0);
    ctx.stroke();

    ctx.restore();
  }

  function drawNonpolarMolecule(m: Molecule) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);

    // Symmetric molecule
    ctx.beginPath();
    ctx.arc(-MOL_SIZE * 0.4, 0, MOL_SIZE * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "#50a050";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(MOL_SIZE * 0.4, 0, MOL_SIZE * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "#50a050";
    ctx.fill();

    // Bond
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-MOL_SIZE * 0.15, 0);
    ctx.lineTo(MOL_SIZE * 0.15, 0);
    ctx.stroke();

    ctx.restore();
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initMolecules();
  }

  function update(dt: number, params: Record<string, number>) {
    fieldStrength = params.fieldStrength ?? 0;
    temperature = params.temperature ?? 300;

    const chamberW = width * 0.38;
    const chamberH = height * 0.55;
    const leftX = width * 0.06;
    const rightX = width * 0.54;
    const topY = height * 0.22;

    for (const m of polarMols) {
      updateMolecule(m, dt, true, leftX, topY, chamberW, chamberH);
    }
    for (const m of nonpolarMols) {
      updateMolecule(m, dt, false, rightX, topY, chamberW, chamberH);
    }

    time += dt;
  }

  function render() {
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    const chamberW = width * 0.38;
    const chamberH = height * 0.55;
    const leftX = width * 0.06;
    const rightX = width * 0.54;
    const topY = height * 0.22;

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Polar Molecules", leftX + chamberW / 2, topY - 10);
    ctx.fillText("Nonpolar Molecules", rightX + chamberW / 2, topY - 10);

    // Chambers
    for (const bx of [leftX, rightX]) {
      ctx.fillStyle = "rgba(20,20,40,0.8)";
      ctx.strokeStyle = "rgba(100,100,150,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, topY, chamberW, chamberH, 8);
      ctx.fill();
      ctx.stroke();

      // Electrode plates
      if (fieldStrength > 0) {
        // Negative plate (left)
        ctx.fillStyle = "rgba(200,60,60,0.6)";
        ctx.fillRect(bx + 3, topY + 10, 6, chamberH - 20);
        ctx.fillStyle = "rgba(255,100,100,0.8)";
        ctx.font = `bold ${Math.max(12, height * 0.02)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("−", bx + 6, topY + chamberH + 16);

        // Positive plate (right)
        ctx.fillStyle = "rgba(60,60,200,0.6)";
        ctx.fillRect(bx + chamberW - 9, topY + 10, 6, chamberH - 20);
        ctx.fillStyle = "rgba(100,100,255,0.8)";
        ctx.fillText("+", bx + chamberW - 6, topY + chamberH + 16);

        // Field lines
        ctx.strokeStyle = `rgba(200,200,100,${fieldStrength * 0.08})`;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 6; i++) {
          const fy = topY + 20 + (i / 5) * (chamberH - 40);
          ctx.beginPath();
          ctx.moveTo(bx + 12, fy);
          ctx.lineTo(bx + chamberW - 12, fy);
          ctx.stroke();
          // Arrow
          ctx.beginPath();
          ctx.moveTo(bx + chamberW / 2 + 5, fy - 3);
          ctx.lineTo(bx + chamberW / 2 + 12, fy);
          ctx.lineTo(bx + chamberW / 2 + 5, fy + 3);
          ctx.stroke();
        }
      }
    }

    // Draw molecules
    for (const m of polarMols) drawPolarMolecule(m);
    for (const m of nonpolarMols) drawNonpolarMolecule(m);

    // Info panel
    const infoY = topY + chamberH + 30;
    ctx.fillStyle = "rgba(10,10,30,0.8)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, infoY, width * 0.9, height * 0.18, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";

    if (fieldStrength > 0) {
      ctx.fillText("Electric field ON: Polar molecules align with the field; nonpolar molecules are unaffected", width / 2, infoY + 18);
      ctx.fillText("Polar: asymmetric charge distribution (δ+ and δ-) creates a net dipole moment", width / 2, infoY + 36);
      ctx.fillText("Nonpolar: symmetric charge distribution — no net dipole, no field response", width / 2, infoY + 54);
    } else {
      ctx.fillText("No electric field: Both polar and nonpolar molecules move randomly (Brownian motion)", width / 2, infoY + 18);
      ctx.fillText("Turn on the field to see how polar molecules respond differently from nonpolar ones", width / 2, infoY + 36);
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Polar vs Nonpolar Molecules in Electric Field", width / 2, 25);

    // Legend
    ctx.font = `${Math.max(9, height * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#e04040";
    ctx.fillText("● δ- (negative)", width * 0.06, height - 10);
    ctx.fillStyle = "#4060e0";
    ctx.fillText("● δ+ (positive)", width * 0.22, height - 10);
    ctx.fillStyle = "#50a050";
    ctx.fillText("● Nonpolar (symmetric)", width * 0.4, height - 10);
  }

  function reset() {
    time = 0;
    initMolecules();
  }

  function destroy() {
    polarMols = [];
    nonpolarMols = [];
  }

  function getStateDescription(): string {
    return `Polar vs Nonpolar | Field: ${fieldStrength > 0 ? "ON" : "OFF"} (${fieldStrength.toFixed(1)}) | Temp: ${temperature}K | Polar molecules ${fieldStrength > 0 ? "aligning with field" : "random motion"} | Nonpolar: always random`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    initMolecules();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PolarMoleculeFactory;
