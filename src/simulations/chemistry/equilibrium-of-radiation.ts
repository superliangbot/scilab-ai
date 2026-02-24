import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EquilibriumOfRadiationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("equilibrium-of-radiation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let solarIntensity = 100; // percent
  let greenhouseEffect = 50; // percent
  let showDetails = 1;

  // Animated arrow particles
  interface ArrowParticle {
    x: number;
    y: number;
    progress: number; // 0 to 1
    speed: number;
    path: { sx: number; sy: number; ex: number; ey: number };
    color: string;
  }
  let arrowParticles: ArrowParticle[] = [];

  // Layout regions
  const SPACE_Y = 60;
  const ATMO_TOP_Y = 140;
  const ATMO_BOT_Y = 340;
  const GROUND_Y = 420;
  const CLOUD_Y = 180;

  // Energy budget values (% of incoming solar)
  function getEnergyBudget() {
    const scale = solarIntensity / 100;
    const ghFactor = greenhouseEffect / 100;
    const incoming = 100 * scale;
    const reflectedByClouds = 22 * scale;
    const reflectedByGround = 9 * scale;
    const absorbedByAtmo = 20 * scale;
    const absorbedByGround = 49 * scale;
    const groundRadiation = absorbedByGround * 2.1; // Earth radiates more than absorbed due to greenhouse
    const atmoReradDown = groundRadiation * ghFactor * 0.95;
    const atmoReradUp = groundRadiation * (1 - ghFactor * 0.5);
    const convection = 7 * scale;
    const latentHeat = 23 * scale;

    return {
      incoming,
      reflectedByClouds,
      reflectedByGround,
      absorbedByAtmo,
      absorbedByGround,
      groundRadiation,
      atmoReradDown,
      atmoReradUp,
      convection,
      latentHeat,
    };
  }

  function spawnArrowParticles(): void {
    const budget = getEnergyBudget();
    const rate = 0.08;

    // Solar incoming
    if (Math.random() < rate * budget.incoming / 100) {
      arrowParticles.push({
        x: 0, y: 0, progress: 0, speed: 0.4 + Math.random() * 0.3,
        path: { sx: 120 + Math.random() * 100, sy: SPACE_Y, ex: 200 + Math.random() * 200, ey: GROUND_Y },
        color: "rgba(255, 220, 50, 0.8)",
      });
    }

    // Reflected by clouds
    if (Math.random() < rate * budget.reflectedByClouds / 100) {
      arrowParticles.push({
        x: 0, y: 0, progress: 0, speed: 0.5,
        path: { sx: 200 + Math.random() * 80, sy: CLOUD_Y, ex: 80 + Math.random() * 60, ey: SPACE_Y },
        color: "rgba(150, 200, 255, 0.7)",
      });
    }

    // Ground IR radiation up
    if (Math.random() < rate * budget.groundRadiation / 200) {
      arrowParticles.push({
        x: 0, y: 0, progress: 0, speed: 0.3,
        path: { sx: 300 + Math.random() * 200, sy: GROUND_Y, ex: 350 + Math.random() * 200, ey: ATMO_TOP_Y },
        color: "rgba(255, 80, 50, 0.6)",
      });
    }

    // Atmosphere re-radiation down
    if (Math.random() < rate * budget.atmoReradDown / 200) {
      arrowParticles.push({
        x: 0, y: 0, progress: 0, speed: 0.3,
        path: { sx: 400 + Math.random() * 150, sy: ATMO_BOT_Y, ex: 350 + Math.random() * 200, ey: GROUND_Y - 5 },
        color: "rgba(255, 120, 80, 0.5)",
      });
    }

    // Convection/Latent heat up
    if (Math.random() < rate * budget.convection / 100) {
      arrowParticles.push({
        x: 0, y: 0, progress: 0, speed: 0.25,
        path: { sx: 500 + Math.random() * 100, sy: GROUND_Y, ex: 520 + Math.random() * 80, ey: ATMO_BOT_Y },
        color: "rgba(100, 255, 150, 0.5)",
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    arrowParticles = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    solarIntensity = params.solarIntensity ?? 100;
    greenhouseEffect = params.greenhouseEffect ?? 50;
    showDetails = params.showDetails ?? 1;

    time += dt;
    spawnArrowParticles();

    // Update particles
    for (let i = arrowParticles.length - 1; i >= 0; i--) {
      const p = arrowParticles[i];
      p.progress += p.speed * dt;
      p.x = p.path.sx + (p.path.ex - p.path.sx) * p.progress;
      p.y = p.path.sy + (p.path.ey - p.path.sy) * p.progress;

      if (p.progress > 1) {
        arrowParticles.splice(i, 1);
      }
    }
  }

  function drawBackground(): void {
    // Space
    ctx.fillStyle = "#0a0a2a";
    ctx.fillRect(0, 0, W, ATMO_TOP_Y);

    // Atmosphere
    const atmoGrad = ctx.createLinearGradient(0, ATMO_TOP_Y, 0, ATMO_BOT_Y);
    atmoGrad.addColorStop(0, "#1a3a6a");
    atmoGrad.addColorStop(1, "#3a6a9a");
    ctx.fillStyle = atmoGrad;
    ctx.fillRect(0, ATMO_TOP_Y, W, ATMO_BOT_Y - ATMO_TOP_Y);

    // Lower atmosphere
    const lowerGrad = ctx.createLinearGradient(0, ATMO_BOT_Y, 0, GROUND_Y);
    lowerGrad.addColorStop(0, "#3a6a9a");
    lowerGrad.addColorStop(1, "#5a9aca");
    ctx.fillStyle = lowerGrad;
    ctx.fillRect(0, ATMO_BOT_Y, W, GROUND_Y - ATMO_BOT_Y);

    // Ground
    ctx.fillStyle = "#4a7a3a";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // Greenhouse haze
    const hazeAlpha = greenhouseEffect / 100 * 0.2;
    ctx.fillStyle = `rgba(200, 150, 80, ${hazeAlpha})`;
    ctx.fillRect(0, ATMO_TOP_Y, W, ATMO_BOT_Y - ATMO_TOP_Y);
  }

  function drawSun(): void {
    const sx = 60;
    const sy = 40;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
    glow.addColorStop(0, "rgba(255, 220, 50, 0.9)");
    glow.addColorStop(0.4, "rgba(255, 200, 30, 0.4)");
    glow.addColorStop(1, "rgba(255, 200, 30, 0)");
    ctx.beginPath();
    ctx.arc(sx, sy, 50, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fill();
  }

  function drawClouds(): void {
    ctx.fillStyle = "rgba(220, 230, 240, 0.6)";
    const drawCloud = (x: number, y: number, w: number) => {
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - w * 0.4, y + 5, w * 0.6, w * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.4, y + 3, w * 0.5, w * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(180, CLOUD_Y, 50);
    drawCloud(350, CLOUD_Y - 10, 40);
    drawCloud(550, CLOUD_Y + 5, 45);
  }

  function drawArrowParticles(): void {
    for (const p of arrowParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }

  function drawFlowArrows(): void {
    const budget = getEnergyBudget();
    ctx.save();

    const drawArrow = (
      sx: number, sy: number, ex: number, ey: number,
      color: string, label: string, value: number, lineWidth: number
    ) => {
      const alpha = Math.min(1, value / 50);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLen = 10;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle - 0.4), ey - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(ex - headLen * Math.cos(angle + 0.4), ey - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.globalAlpha = 1;

      if (showDetails > 0.5) {
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        ctx.fillStyle = color;
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${label}`, mx + 15, my - 5);
        ctx.fillText(`${value.toFixed(0)}%`, mx + 15, my + 8);
      }
    };

    // Incoming solar
    drawArrow(140, SPACE_Y, 250, GROUND_Y - 20, "#ffd700", "Solar In", budget.incoming, 4);

    // Reflected by clouds
    drawArrow(200, CLOUD_Y, 100, SPACE_Y + 10, "#88bbff", "Cloud Refl", budget.reflectedByClouds, 2.5);

    // Reflected by ground
    drawArrow(320, GROUND_Y, 280, SPACE_Y + 10, "#aaccff", "Ground Refl", budget.reflectedByGround, 2);

    // Absorbed by atmosphere
    drawArrow(190, ATMO_TOP_Y + 20, 190, ATMO_BOT_Y - 20, "#ffaa44", "Atmo Abs", budget.absorbedByAtmo, 2);

    // Ground IR up
    drawArrow(420, GROUND_Y, 420, ATMO_TOP_Y + 10, "#ff5533", "Ground IR", budget.groundRadiation, 3);

    // Atmosphere re-radiation down
    drawArrow(500, ATMO_BOT_Y, 500, GROUND_Y - 5, "#ff8855", "Re-rad Down", budget.atmoReradDown, 2.5);

    // Atmosphere radiation to space
    drawArrow(560, ATMO_TOP_Y, 620, SPACE_Y + 10, "#ff6644", "IR to Space", budget.atmoReradUp, 2.5);

    // Convection
    drawArrow(620, GROUND_Y, 640, ATMO_BOT_Y, "#44ff88", "Convection", budget.convection, 2);

    // Latent heat
    drawArrow(680, GROUND_Y, 700, ATMO_BOT_Y, "#44ddaa", "Latent Heat", budget.latentHeat, 2);

    ctx.restore();
  }

  function drawLayerLabels(): void {
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("SPACE", 10, SPACE_Y + 20);
    ctx.fillText("ATMOSPHERE", 10, (ATMO_TOP_Y + ATMO_BOT_Y) / 2);
    ctx.fillText("GROUND", 10, GROUND_Y + 20);
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 260;
    const ph = 100;
    const px = W - pw - 15;
    const py = H - ph - 15;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Earth's Radiation Budget", px + 12, py + 20);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Solar intensity: ${solarIntensity.toFixed(0)}%`, px + 12, py + 40);
    ctx.fillText(`Greenhouse effect: ${greenhouseEffect.toFixed(0)}%`, px + 12, py + 56);
    ctx.fillText("Energy in must equal energy out", px + 12, py + 72);
    ctx.fillText("for temperature equilibrium", px + 12, py + 86);

    ctx.restore();
  }

  function drawTitle(): void {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Equilibrium of Radiation — Earth's Energy Budget", W / 2, 25);
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawSun();
    drawClouds();
    drawArrowParticles();
    drawFlowArrows();
    drawLayerLabels();
    drawInfoPanel();
    drawTitle();
  }

  function reset(): void {
    time = 0;
    arrowParticles = [];
  }

  function destroy(): void {
    arrowParticles = [];
  }

  function getStateDescription(): string {
    const budget = getEnergyBudget();
    return (
      `Earth's Radiation Budget: Incoming solar=${budget.incoming.toFixed(0)}%, ` +
      `reflected by clouds=${budget.reflectedByClouds.toFixed(0)}%, ground=${budget.reflectedByGround.toFixed(0)}%. ` +
      `Absorbed by atmo=${budget.absorbedByAtmo.toFixed(0)}%, by ground=${budget.absorbedByGround.toFixed(0)}%. ` +
      `Ground IR=${budget.groundRadiation.toFixed(0)}%, greenhouse re-radiation=${budget.atmoReradDown.toFixed(0)}%. ` +
      `Convection=${budget.convection.toFixed(0)}%, latent heat=${budget.latentHeat.toFixed(0)}%.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EquilibriumOfRadiationFactory;
