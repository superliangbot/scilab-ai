import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface WaterMolecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: "vapor" | "condensed";
  radius: number;
}

const DewFactory = (): SimulationEngine => {
  const config = getSimConfig("dew") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;

  let time = 0;
  let molecules: WaterMolecule[] = [];
  let condensedDroplets: { x: number; y: number; size: number }[] = [];
  const NUM_MOLECULES = 80;

  function createMolecules(): void {
    molecules = [];
    condensedDroplets = [];
    for (let i = 0; i < NUM_MOLECULES; i++) {
      molecules.push({
        x: Math.random() * width * 0.8 + width * 0.1,
        y: Math.random() * height * 0.5 + 30,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        state: "vapor",
        radius: 4,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    createMolecules();
  }

  function update(dt: number, params: Record<string, number>): void {
    const surfaceTemp = params.surfaceTemp ?? 5;
    const airTemp = params.airTemp ?? 25;
    const humidity = params.humidity ?? 80;

    // Dew point calculation (simplified Magnus formula)
    const a = 17.27;
    const b = 237.7;
    const gamma = (a * airTemp) / (b + airTemp) + Math.log(humidity / 100);
    const dewPoint = (b * gamma) / (a - gamma);

    // Condensation probability based on surface temp vs dew point
    const condensationRate = surfaceTemp < dewPoint
      ? Math.min(1, (dewPoint - surfaceTemp) / 20) * 0.02
      : 0;

    // Glass/cup boundaries
    const cupLeft = width * 0.3;
    const cupRight = width * 0.7;
    const cupTop = height * 0.35;
    const cupBottom = height * 0.85;

    // Speed factor based on air temperature
    const speedFactor = Math.sqrt(airTemp / 25);

    for (const mol of molecules) {
      if (mol.state === "vapor") {
        mol.x += mol.vx * dt * speedFactor;
        mol.y += mol.vy * dt * speedFactor;

        // Gravity effect
        mol.vy += 20 * dt;

        // Bounce off boundaries
        if (mol.x < 10) { mol.x = 10; mol.vx = Math.abs(mol.vx); }
        if (mol.x > width - 10) { mol.x = width - 10; mol.vx = -Math.abs(mol.vx); }
        if (mol.y < 10) { mol.y = 10; mol.vy = Math.abs(mol.vy); }
        if (mol.y > height - 20) { mol.y = height - 20; mol.vy = -Math.abs(mol.vy) * 0.8; }

        // Check proximity to cup surface for condensation
        const nearCup = (
          (Math.abs(mol.x - cupLeft) < 15 && mol.y > cupTop && mol.y < cupBottom) ||
          (Math.abs(mol.x - cupRight) < 15 && mol.y > cupTop && mol.y < cupBottom) ||
          (mol.y > cupBottom - 15 && mol.x > cupLeft && mol.x < cupRight)
        );

        if (nearCup && Math.random() < condensationRate) {
          mol.state = "condensed";
          mol.vx = 0;
          mol.vy = 0;

          // Snap to cup surface
          if (Math.abs(mol.x - cupLeft) < 20) mol.x = cupLeft - 3;
          else if (Math.abs(mol.x - cupRight) < 20) mol.x = cupRight + 3;

          condensedDroplets.push({
            x: mol.x,
            y: mol.y,
            size: 2 + Math.random() * 3,
          });
        }

        // Random thermal motion
        mol.vx += (Math.random() - 0.5) * 50 * dt;
        mol.vy += (Math.random() - 0.5) * 50 * dt;

        // Clamp speed
        const maxSpeed = 120 * speedFactor;
        const speed = Math.sqrt(mol.vx * mol.vx + mol.vy * mol.vy);
        if (speed > maxSpeed) {
          mol.vx = (mol.vx / speed) * maxSpeed;
          mol.vy = (mol.vy / speed) * maxSpeed;
        }
      }
    }

    // Grow existing droplets slowly
    for (const drop of condensedDroplets) {
      if (drop.size < 8 && Math.random() < condensationRate * 0.1) {
        drop.size += 0.02;
      }
      // Gravity on large droplets
      if (drop.size > 5) {
        drop.y += 0.1;
      }
    }

    time += dt;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);

    // Background (sky gradient)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#1a365d");
    gradient.addColorStop(1, "#0f172a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const cupLeft = width * 0.3;
    const cupRight = width * 0.7;
    const cupTop = height * 0.35;
    const cupBottom = height * 0.85;
    const cupW = cupRight - cupLeft;

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Dew Formation (Condensation)", width / 2, 28);

    // Draw glass/cup
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cupLeft, cupTop);
    ctx.lineTo(cupLeft, cupBottom);
    ctx.lineTo(cupRight, cupBottom);
    ctx.lineTo(cupRight, cupTop);
    ctx.stroke();

    // Glass interior (slightly tinted)
    ctx.fillStyle = "rgba(148, 163, 184, 0.08)";
    ctx.fillRect(cupLeft, cupTop, cupW, cupBottom - cupTop);

    // Cold liquid inside cup
    const liquidLevel = cupTop + (cupBottom - cupTop) * 0.3;
    const liquidGrad = ctx.createLinearGradient(0, liquidLevel, 0, cupBottom);
    liquidGrad.addColorStop(0, "rgba(56, 189, 248, 0.3)");
    liquidGrad.addColorStop(1, "rgba(56, 189, 248, 0.5)");
    ctx.fillStyle = liquidGrad;
    ctx.fillRect(cupLeft + 2, liquidLevel, cupW - 4, cupBottom - liquidLevel - 2);

    // Condensed droplets on cup surface
    for (const drop of condensedDroplets) {
      const alpha = Math.min(0.9, drop.size / 6);
      ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw water vapor molecules
    for (const mol of molecules) {
      if (mol.state === "vapor") {
        // Oxygen atom (larger, red)
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
        ctx.fill();

        // Hydrogen atoms (smaller, white)
        const bondAngle = time * 0.5 + mol.x * 0.01;
        const bondLen = mol.radius * 1.5;

        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(
          mol.x + bondLen * Math.cos(bondAngle + 0.9),
          mol.y + bondLen * Math.sin(bondAngle + 0.9),
          mol.radius * 0.6,
          0, Math.PI * 2
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          mol.x + bondLen * Math.cos(bondAngle - 0.9),
          mol.y + bondLen * Math.sin(bondAngle - 0.9),
          mol.radius * 0.6,
          0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Temperature indicators
    const surfaceTemp = 5; // Will be read from params in real use
    const params = config.parameters;

    // Info panel
    const panelX = 15;
    const panelY = height - 130;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 220, 115);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 220, 115);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(11, width * 0.015)}px monospace`;
    ctx.textAlign = "left";

    const vaporCount = molecules.filter(m => m.state === "vapor").length;
    const condensedCount = molecules.length - vaporCount;

    ctx.fillText(`Vapor molecules: ${vaporCount}`, panelX + 10, panelY + 20);
    ctx.fillText(`Condensed: ${condensedCount}`, panelX + 10, panelY + 40);
    ctx.fillText(`Droplets: ${condensedDroplets.length}`, panelX + 10, panelY + 60);
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 80);

    // Dew point info
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`Surface < Dew Point → Condensation`, panelX + 10, panelY + 100);

    // Label the cup
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${Math.max(11, width * 0.014)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Cold Surface", (cupLeft + cupRight) / 2, cupTop - 10);

    // Draw temperature comparison
    const tempX = width - 80;
    ctx.fillStyle = "#38bdf8";
    ctx.font = `${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("❄️ Cold", tempX, cupTop + 40);

    // Molecule legend
    const legY = 50;
    const legX = 15;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(legX, legY, 140, 55);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(legX, legY, 140, 55);

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(legX + 15, legY + 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(10, width * 0.013)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("= H₂O (vapor)", legX + 25, legY + 22);

    ctx.fillStyle = "rgba(147, 197, 253, 0.7)";
    ctx.beginPath();
    ctx.arc(legX + 15, legY + 40, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("= H₂O (condensed)", legX + 25, legY + 44);
  }

  function reset(): void {
    time = 0;
    createMolecules();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const vaporCount = molecules.filter(m => m.state === "vapor").length;
    const condensedCount = molecules.length - vaporCount;
    return `Dew formation simulation: ${vaporCount} vapor molecules and ${condensedCount} condensed molecules, with ${condensedDroplets.length} visible droplets. Dew forms when a surface temperature drops below the dew point — the temperature at which air becomes saturated with water vapor. The dew point depends on air temperature and humidity (calculated via the Magnus formula). When warm, moist air contacts a cold surface, water vapor molecules slow down and condense into liquid droplets.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createMolecules();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DewFactory;
