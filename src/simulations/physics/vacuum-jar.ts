import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface AirMolecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const VacuumJarFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("vacuum-jar") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let pressure = 100; // percentage of atmospheric
  let pumpSpeed = 1;
  let showForces = 1;

  let molecules: AirMolecule[] = [];
  let balloonRadius = 30;
  let targetBalloonR = 30;

  // Jar geometry
  let jarX = 0;
  let jarY = 0;
  let jarW = 0;
  let jarH = 0;

  function createMolecules(count: number): void {
    molecules = [];
    for (let i = 0; i < count; i++) {
      molecules.push({
        x: jarX + 20 + Math.random() * (jarW - 40),
        y: jarY + 20 + Math.random() * (jarH - 40),
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        radius: 2,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    pressure = 100;

    jarW = width * 0.4;
    jarH = height * 0.55;
    jarX = (width - jarW) / 2;
    jarY = height * 0.15;

    balloonRadius = 30;
    targetBalloonR = 30;
    createMolecules(80);
  }

  function update(dt: number, params: Record<string, number>): void {
    pumpSpeed = params.pumpSpeed ?? 1;
    showForces = Math.round(params.showForces ?? 1);

    // Decrease pressure over time (pumping)
    pressure = Math.max(1, pressure - pumpSpeed * dt * 5);

    // Target molecule count
    const targetCount = Math.round((pressure / 100) * 80);
    while (molecules.length > targetCount && molecules.length > 2) {
      molecules.pop();
    }

    // Balloon expands as pressure decreases (P₁V₁ = P₂V₂)
    // V ∝ r³, so r ∝ (1/P)^(1/3)
    targetBalloonR = 30 * Math.pow(100 / Math.max(1, pressure), 1 / 3);
    targetBalloonR = Math.min(targetBalloonR, jarW * 0.4);
    balloonRadius += (targetBalloonR - balloonRadius) * dt * 3;

    // Update molecules
    for (const mol of molecules) {
      mol.x += mol.vx * dt;
      mol.y += mol.vy * dt;

      // Bounce off jar walls
      if (mol.x < jarX + 5) { mol.x = jarX + 5; mol.vx = Math.abs(mol.vx); }
      if (mol.x > jarX + jarW - 5) { mol.x = jarX + jarW - 5; mol.vx = -Math.abs(mol.vx); }
      if (mol.y < jarY + 5) { mol.y = jarY + 5; mol.vy = Math.abs(mol.vy); }
      if (mol.y > jarY + jarH - 5) { mol.y = jarY + jarH - 5; mol.vy = -Math.abs(mol.vy); }

      // Bounce off balloon
      const bx = jarX + jarW / 2;
      const by = jarY + jarH * 0.55;
      const dx = mol.x - bx;
      const dy = mol.y - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < balloonRadius + mol.radius) {
        const nx = dx / dist;
        const ny = dy / dist;
        mol.x = bx + nx * (balloonRadius + mol.radius + 1);
        mol.y = by + ny * (balloonRadius + mol.radius + 1);
        const dot = mol.vx * nx + mol.vy * ny;
        mol.vx -= 2 * dot * nx;
        mol.vy -= 2 * dot * ny;
      }
    }

    time += dt;
  }

  function render(): void {
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#1a1a2e");
    bg.addColorStop(1, "#16213e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Vacuum Jar", width / 2, 25);

    // Jar (bell jar shape)
    ctx.save();
    ctx.strokeStyle = "rgba(180,220,255,0.4)";
    ctx.lineWidth = 3;

    // Dome top
    ctx.beginPath();
    ctx.moveTo(jarX, jarY + jarH);
    ctx.lineTo(jarX, jarY + 20);
    ctx.quadraticCurveTo(jarX, jarY, jarX + jarW / 2, jarY);
    ctx.quadraticCurveTo(jarX + jarW, jarY, jarX + jarW, jarY + 20);
    ctx.lineTo(jarX + jarW, jarY + jarH);
    ctx.stroke();

    // Base plate
    ctx.fillStyle = "rgba(100,100,120,0.6)";
    ctx.fillRect(jarX - 15, jarY + jarH, jarW + 30, 15);

    // Glass fill
    ctx.fillStyle = "rgba(180,220,255,0.05)";
    ctx.beginPath();
    ctx.moveTo(jarX, jarY + jarH);
    ctx.lineTo(jarX, jarY + 20);
    ctx.quadraticCurveTo(jarX, jarY, jarX + jarW / 2, jarY);
    ctx.quadraticCurveTo(jarX + jarW, jarY, jarX + jarW, jarY + 20);
    ctx.lineTo(jarX + jarW, jarY + jarH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Pump tube
    ctx.strokeStyle = "rgba(150,150,170,0.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(jarX + jarW / 2, jarY);
    ctx.lineTo(jarX + jarW / 2, jarY - 30);
    ctx.lineTo(jarX + jarW + 40, jarY - 30);
    ctx.stroke();

    // Pump label
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Vacuum pump →", jarX + jarW + 5, jarY - 35);

    // Balloon inside jar
    const bx = jarX + jarW / 2;
    const by = jarY + jarH * 0.55;
    const bGrad = ctx.createRadialGradient(bx - balloonRadius * 0.2, by - balloonRadius * 0.2, 0, bx, by, balloonRadius);
    bGrad.addColorStop(0, "rgba(231,76,60,0.9)");
    bGrad.addColorStop(1, "rgba(192,57,43,0.7)");
    ctx.beginPath();
    ctx.ellipse(bx, by, balloonRadius, balloonRadius * 1.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = bGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Balloon knot
    ctx.beginPath();
    ctx.moveTo(bx, by + balloonRadius * 1.1);
    ctx.lineTo(bx - 3, by + balloonRadius * 1.1 + 10);
    ctx.lineTo(bx + 3, by + balloonRadius * 1.1 + 10);
    ctx.closePath();
    ctx.fillStyle = "rgba(192,57,43,0.8)";
    ctx.fill();

    // Highlight on balloon
    ctx.beginPath();
    ctx.ellipse(bx - balloonRadius * 0.3, by - balloonRadius * 0.3, balloonRadius * 0.2, balloonRadius * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fill();

    // Air molecules
    for (const mol of molecules) {
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100,200,255,0.6)";
      ctx.fill();
    }

    // Force arrows on balloon
    if (showForces) {
      const arrowLen = (pressure / 100) * 25;
      ctx.strokeStyle = "rgba(255,200,50,0.6)";
      ctx.lineWidth = 2;
      const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4];
      for (const a of angles) {
        const sx = bx + Math.cos(a) * (balloonRadius + 5);
        const sy = by + Math.sin(a) * (balloonRadius * 1.1 + 5);
        const ex = bx + Math.cos(a) * (balloonRadius + 5 + arrowLen);
        const ey = by + Math.sin(a) * (balloonRadius * 1.1 + 5 + arrowLen);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    }

    // Pressure gauge
    const gaugeX = width * 0.82;
    const gaugeY = height * 0.3;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(gaugeX - 40, gaugeY - 10, 80, 100, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pressure", gaugeX, gaugeY + 6);

    // Bar gauge
    const barH = 50;
    const barW = 20;
    const barX = gaugeX - barW / 2;
    const barY = gaugeY + 15;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(barX, barY, barW, barH);
    const fillH = (pressure / 100) * barH;
    ctx.fillStyle = pressure > 50 ? "#27ae60" : pressure > 20 ? "#f39c12" : "#e74c3c";
    ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(`${pressure.toFixed(0)}%`, gaugeX, barY + barH + 16);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(10, height - 65, width - 20, 55, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Pressure: ${pressure.toFixed(1)}% atm | Balloon radius: ${balloonRadius.toFixed(1)} px`, 22, height - 44);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Boyle's Law: P₁V₁ = P₂V₂ → As pressure ↓, balloon volume ↑", 22, height - 26);
  }

  function reset(): void {
    time = 0;
    pressure = 100;
    balloonRadius = 30;
    targetBalloonR = 30;
    createMolecules(80);
  }

  function destroy(): void {
    molecules = [];
  }

  function getStateDescription(): string {
    return (
      `Vacuum Jar: pressure=${pressure.toFixed(1)}% atm, balloon radius=${balloonRadius.toFixed(1)}px. ` +
      `${molecules.length} air molecules. Pump speed: ${pumpSpeed}×. ` +
      `As air is removed, the balloon expands per Boyle's Law (P₁V₁ = P₂V₂). Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    jarW = width * 0.4;
    jarH = height * 0.55;
    jarX = (width - jarW) / 2;
    jarY = height * 0.15;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default VacuumJarFactory;
