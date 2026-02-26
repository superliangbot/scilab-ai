import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SurfaceTensionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("surface-tension") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let surfaceTension = 0.072; // N/m (water at 20C)
  let objectMass = 0.5; // grams
  let temperature = 20; // °C

  // Molecule positions for visualization
  interface Molecule {
    x: number;
    y: number;
    isSurface: boolean;
  }
  let molecules: Molecule[] = [];

  // Object floating state
  let objectY = 0;
  let objectVy = 0;
  let surfaceDeflection = 0;

  let ripples: { x: number; amp: number; phase: number }[] = [];

  function generateMolecules(): void {
    molecules = [];
    const liquidTop = height * 0.48;
    const liquidBottom = height * 0.92;
    const spacing = 22;

    for (let y = liquidTop; y < liquidBottom; y += spacing) {
      for (let x = width * 0.05; x < width * 0.65; x += spacing) {
        const jitterX = (Math.random() - 0.5) * 6;
        const jitterY = (Math.random() - 0.5) * 6;
        const isSurface = y < liquidTop + spacing * 1.5;
        molecules.push({ x: x + jitterX, y: y + jitterY, isSurface });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    objectY = height * 0.44;
    objectVy = 0;
    surfaceDeflection = 0;
    ripples = [];
    generateMolecules();
  }

  function getEffectiveSurfaceTension(): number {
    // Surface tension decreases with temperature (approximately linear for water)
    // gamma(T) ≈ gamma(20) * (1 - 0.002 * (T - 20))
    return surfaceTension * (1 - 0.002 * (temperature - 20));
  }

  function update(dt: number, params: Record<string, number>): void {
    surfaceTension = params.surfaceTension ?? 0.072;
    objectMass = params.objectMass ?? 0.5;
    temperature = params.temperature ?? 20;

    const gamma = getEffectiveSurfaceTension();
    const massKg = objectMass / 1000; // convert g to kg
    const g = 9.81;
    const weight = massKg * g;

    // Contact length ~ object perimeter (needle approximation: 2 * length)
    const contactLength = 0.04; // ~4cm contact length
    const supportForce = 2 * gamma * contactLength; // factor of 2 for two sides

    // Surface deflection proportional to load
    const maxDeflection = 25;
    surfaceDeflection = Math.min((weight / (supportForce + 0.001)) * 8, maxDeflection);

    // Determine if object sinks
    const sinks = weight > supportForce * 1.5;

    const targetY = sinks
      ? height * 0.62
      : height * 0.47 + surfaceDeflection;

    // Spring-damped dynamics
    const springK = 4;
    const damping = 3;
    const force = -springK * (objectY - targetY) - damping * objectVy;
    objectVy += force * dt;
    objectY += objectVy * dt;

    if (Math.random() < 0.02) {
      ripples.push({ x: width * 0.05 + Math.random() * width * 0.6, amp: 1 + Math.random() * 2, phase: Math.random() * Math.PI * 2 });
    }
    ripples = ripples.filter((r) => { r.amp *= 0.98; return r.amp > 0.1; });
    time += dt;
  }

  function drawMolecule(mol: Molecule, gamma: number): void {
    const radius = 6;

    // Molecule body
    const grad = ctx.createRadialGradient(
      mol.x - 1, mol.y - 1, 0,
      mol.x, mol.y, radius
    );
    if (mol.isSurface) {
      grad.addColorStop(0, "rgba(100, 200, 255, 0.9)");
      grad.addColorStop(1, "rgba(40, 120, 200, 0.6)");
    } else {
      grad.addColorStop(0, "rgba(60, 140, 220, 0.7)");
      grad.addColorStop(1, "rgba(30, 80, 160, 0.4)");
    }

    ctx.beginPath();
    ctx.arc(mol.x, mol.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Force arrows for surface molecules
    if (mol.isSurface) {
      const arrowLen = 12 + gamma * 80;

      // Downward force (net inward)
      drawArrow(mol.x, mol.y + radius, mol.x, mol.y + radius + arrowLen, "#ff6666");

      // Sideways forces (along surface)
      drawArrow(mol.x - radius, mol.y, mol.x - radius - arrowLen * 0.6, mol.y, "#ffaa44");
      drawArrow(mol.x + radius, mol.y, mol.x + radius + arrowLen * 0.6, mol.y, "#ffaa44");
    } else {
      // Balanced forces for bulk molecules (small arrows in all directions)
      const aLen = 8;
      const dirs = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      for (const angle of dirs) {
        const ex = mol.x + (radius + aLen) * Math.cos(angle);
        const ey = mol.y + (radius + aLen) * Math.sin(angle);
        drawArrow(
          mol.x + radius * Math.cos(angle),
          mol.y + radius * Math.sin(angle),
          ex,
          ey,
          "rgba(100, 200, 100, 0.4)"
        );
      }
    }
  }

  function drawArrow(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(dy, dx);
    const headLen = 5;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0c18");
    bgGrad.addColorStop(1, "#101828");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const gamma = getEffectiveSurfaceTension();
    const liquidTop = height * 0.48;

    // Draw liquid body
    const liquidGrad = ctx.createLinearGradient(0, liquidTop, 0, height);
    liquidGrad.addColorStop(0, "rgba(20, 80, 160, 0.3)");
    liquidGrad.addColorStop(1, "rgba(10, 40, 100, 0.5)");
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(width * 0.03, liquidTop, width * 0.64, height - liquidTop);

    // Draw wavy surface
    ctx.beginPath();
    ctx.moveTo(width * 0.03, liquidTop);
    for (let x = width * 0.03; x <= width * 0.67; x += 2) {
      let waveY = liquidTop;
      for (const r of ripples) {
        const dist = Math.abs(x - r.x);
        waveY += r.amp * Math.sin(dist * 0.05 + r.phase + time * 3) * Math.exp(-dist * 0.005);
      }
      // Deflection near object
      const objX = width * 0.35;
      const distToObj = Math.abs(x - objX);
      if (distToObj < 50) {
        waveY += surfaceDeflection * Math.cos((distToObj / 50) * Math.PI * 0.5);
      }
      ctx.lineTo(x, waveY);
    }
    ctx.lineTo(width * 0.67, liquidTop);
    ctx.strokeStyle = "rgba(100, 200, 255, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw molecules (only a sample for performance)
    const displayMols = molecules.filter((_, i) => i % 3 === 0);
    for (const mol of displayMols) {
      drawMolecule(mol, gamma);
    }

    // Draw floating object (needle/insect representation)
    const objX = width * 0.35;
    const needleW = 60;
    const needleH = 6;

    // Object shadow on surface
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.ellipse(objX, objectY + needleH + 3, needleW / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // The needle
    const needleGrad = ctx.createLinearGradient(objX, objectY - needleH, objX, objectY + needleH);
    needleGrad.addColorStop(0, "#ccc");
    needleGrad.addColorStop(0.5, "#eee");
    needleGrad.addColorStop(1, "#999");
    ctx.fillStyle = needleGrad;
    ctx.beginPath();
    ctx.roundRect(objX - needleW / 2, objectY - needleH / 2, needleW, needleH, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Weight arrow (downward from object)
    drawArrow(objX, objectY + needleH, objX, objectY + needleH + 25, "#ff6666");
    ctx.fillStyle = "#ff6666";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("W = mg", objX, objectY + needleH + 38);

    // Surface tension arrows (upward at contact points)
    drawArrow(objX - needleW / 2, objectY, objX - needleW / 2, objectY - 20, "#66ffaa");
    drawArrow(objX + needleW / 2, objectY, objX + needleW / 2, objectY - 20, "#66ffaa");
    ctx.fillStyle = "#66ffaa";
    ctx.fillText("γL", objX - needleW / 2, objectY - 28);
    ctx.fillText("γL", objX + needleW / 2, objectY - 28);

    // Info panel on the right
    const panelX = width * 0.7;
    const panelY2 = height * 0.06;
    const panelW = width * 0.28;
    const panelH = height * 0.88;

    ctx.fillStyle = "rgba(8, 12, 24, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY2, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 200, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let ty = panelY2 + 14;
    const lx = panelX + 12;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#8ce4ff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText("Surface Tension", lx, ty);
    ty += 26;

    ctx.fillStyle = "#ffd966";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Formula:", lx, ty);
    ty += 18;

    ctx.fillStyle = "rgba(200, 220, 255, 0.85)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("γ = F / L", lx, ty);
    ty += 16;
    ctx.fillText("F_support = 2γL", lx, ty);
    ty += 24;

    ctx.fillStyle = "#66ffaa";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Current Values:", lx, ty);
    ty += 20;

    ctx.fillStyle = "rgba(200, 220, 255, 0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`γ₀ = ${surfaceTension.toFixed(3)} N/m`, lx, ty);
    ty += 16;
    ctx.fillText(`T = ${temperature}°C`, lx, ty);
    ty += 16;
    ctx.fillText(`γ(T) = ${gamma.toFixed(4)} N/m`, lx, ty);
    ty += 20;

    const massKg = objectMass / 1000;
    const weight = massKg * 9.81;
    const contactLength = 0.04;
    const supportForce = 2 * gamma * contactLength;

    ctx.fillText(`Object mass: ${objectMass.toFixed(1)} g`, lx, ty);
    ty += 16;
    ctx.fillText(`Weight: ${(weight * 1000).toFixed(2)} mN`, lx, ty);
    ty += 16;
    ctx.fillText(`Support: ${(supportForce * 1000).toFixed(2)} mN`, lx, ty);
    ty += 22;

    const floats = weight <= supportForce * 1.5;
    ctx.fillStyle = floats ? "#66ffaa" : "#ff6666";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(floats ? "Object FLOATS" : "Object SINKS", lx, ty);
    ty += 26;

    ctx.fillStyle = "#ff9966";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Molecular View:", lx, ty);
    ty += 18;

    ctx.fillStyle = "rgba(200, 220, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    const notes = [
      "Surface molecules have",
      "fewer neighbors → net",
      "inward force creates",
      "surface tension.",
      "Bulk molecules have",
      "balanced forces from",
      "all directions.",
    ];
    for (const line of notes) {
      ctx.fillText(line, lx, ty);
      ty += 15;
    }

    // Time display
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 10, height - 14);
  }

  function reset(): void {
    time = 0;
    objectY = height * 0.44;
    objectVy = 0;
    surfaceDeflection = 0;
    ripples = [];
    generateMolecules();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const gamma = getEffectiveSurfaceTension();
    const massKg = objectMass / 1000;
    const weight = massKg * 9.81;
    const contactLength = 0.04;
    const supportForce = 2 * gamma * contactLength;
    const floats = weight <= supportForce * 1.5;
    return (
      `Surface Tension: γ₀=${surfaceTension} N/m, T=${temperature}°C, ` +
      `γ(T)=${gamma.toFixed(4)} N/m. Object mass=${objectMass}g. ` +
      `Weight=${(weight * 1000).toFixed(2)}mN, Support=${(supportForce * 1000).toFixed(2)}mN. ` +
      `Object ${floats ? "floats" : "sinks"}. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    generateMolecules();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SurfaceTensionFactory;
