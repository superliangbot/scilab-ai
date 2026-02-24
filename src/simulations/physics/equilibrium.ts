import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EquilibriumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("equilibrium") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (radiative equilibrium / global warming analogy)
  let solarInput = 5; // 0-10
  let greenhouseLevel = 3; // 0-10
  let albedo = 3; // reflectivity 0-10

  // State
  let temperature = 15; // °C
  let targetTemperature = 15;
  let energyStored = 0;
  let energyIn = 0;
  let energyOut = 0;

  // Particles for energy visualization
  interface EnergyParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "solar" | "infrared" | "reflected";
    life: number;
  }
  let particles: EnergyParticle[] = [];

  // Geometry
  const SUN_X = 100;
  const SUN_Y = 80;
  const GROUND_Y = 440;
  const ATMO_TOP = 200;
  const SPACE_TOP = 100;

  function computeEquilibrium(): void {
    // Simplified energy balance
    const solarFlux = solarInput * 34; // W/m² scaled
    const reflected = solarFlux * (albedo / 10);
    energyIn = solarFlux - reflected;

    // Greenhouse traps fraction of outgoing IR
    const greenhouse = greenhouseLevel / 10;
    // Stefan-Boltzmann: emitted ∝ T^4, but simplified
    const emissionEfficiency = 1 - greenhouse * 0.7;
    // Equilibrium: T where energyIn = emissionEfficiency * sigma * T^4
    // Simplified: target temp rises with more input, more greenhouse
    targetTemperature = -18 + energyIn * 0.15 + greenhouseLevel * 3.5;
    energyOut = energyIn * emissionEfficiency;
  }

  function spawnParticle(): void {
    if (particles.length > 120) return;

    if (Math.random() < 0.3 * solarInput / 5) {
      // Solar radiation coming in
      particles.push({
        x: SUN_X + Math.random() * 100,
        y: SPACE_TOP + Math.random() * 20,
        vx: 1 + Math.random() * 2,
        vy: 2 + Math.random(),
        type: "solar",
        life: 1,
      });
    }

    if (Math.random() < 0.2 * (temperature + 20) / 40) {
      // IR radiation from ground
      particles.push({
        x: 200 + Math.random() * 400,
        y: GROUND_Y - 5,
        vx: (Math.random() - 0.5) * 1,
        vy: -(1 + Math.random() * 2),
        type: "infrared",
        life: 1,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    time = 0;
    temperature = 15;
    particles = [];
    computeEquilibrium();
  }

  function update(dt: number, params: Record<string, number>): void {
    solarInput = params.solarInput ?? 5;
    greenhouseLevel = params.greenhouseLevel ?? 3;
    albedo = params.albedo ?? 3;

    computeEquilibrium();

    // Temperature evolves toward target
    temperature += (targetTemperature - temperature) * 0.5 * dt;
    energyStored = temperature * 10; // simplified

    // Spawn and update particles
    spawnParticle();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt * 0.3;

      // Solar hitting ground → absorbed or reflected
      if (p.type === "solar" && p.y > GROUND_Y) {
        if (Math.random() < albedo / 10) {
          p.type = "reflected";
          p.vy = -(1 + Math.random() * 2);
          p.vx = (Math.random() - 0.5) * 2;
        } else {
          p.life = 0; // Absorbed
        }
      }

      // IR hitting atmosphere → trapped or escapes
      if (p.type === "infrared" && p.y < ATMO_TOP) {
        if (Math.random() < greenhouseLevel / 10 * 0.7) {
          p.vy = Math.abs(p.vy) * 0.8; // Reflected back down
          p.y = ATMO_TOP + 5;
        }
      }

      if (p.life <= 0 || p.y < 0 || p.y > H || p.x < 0 || p.x > W) {
        particles.splice(i, 1);
      }
    }

    time += dt;
  }

  function drawBackground(): void {
    // Space
    ctx.fillStyle = "#0a0a2a";
    ctx.fillRect(0, 0, W, SPACE_TOP);

    // Atmosphere
    const atmoGrad = ctx.createLinearGradient(0, SPACE_TOP, 0, GROUND_Y);
    atmoGrad.addColorStop(0, "#1a2a5a");
    atmoGrad.addColorStop(0.5, "#2a4a7a");
    atmoGrad.addColorStop(1, "#4a7aaa");
    ctx.fillStyle = atmoGrad;
    ctx.fillRect(0, SPACE_TOP, W, GROUND_Y - SPACE_TOP);

    // Greenhouse haze
    const hazeAlpha = greenhouseLevel / 10 * 0.3;
    ctx.fillStyle = `rgba(200, 100, 50, ${hazeAlpha})`;
    ctx.fillRect(0, ATMO_TOP, W, GROUND_Y - ATMO_TOP);

    // Ground
    const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    groundGrad.addColorStop(0, "#4a7a3a");
    groundGrad.addColorStop(1, "#2a4a1a");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  }

  function drawSun(): void {
    const glow = ctx.createRadialGradient(SUN_X, SUN_Y, 0, SUN_X, SUN_Y, 60);
    glow.addColorStop(0, "rgba(255, 220, 50, 0.8)");
    glow.addColorStop(0.3, "rgba(255, 200, 30, 0.4)");
    glow.addColorStop(1, "rgba(255, 200, 30, 0)");
    ctx.beginPath();
    ctx.arc(SUN_X, SUN_Y, 60, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(SUN_X, SUN_Y, 25, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fill();
  }

  function drawParticles(): void {
    for (const p of particles) {
      const alpha = Math.min(1, p.life);
      let color: string;
      switch (p.type) {
        case "solar":
          color = `rgba(255, 220, 50, ${alpha})`;
          break;
        case "infrared":
          color = `rgba(255, 80, 50, ${alpha})`;
          break;
        case "reflected":
          color = `rgba(100, 180, 255, ${alpha})`;
          break;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function drawThermometer(): void {
    const tx = W - 80;
    const ty = 120;
    const th = 300;
    const tw = 30;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(tx - 5, ty - 5, tw + 10, th + 40, 6);
    ctx.fill();

    // Thermometer tube
    ctx.fillStyle = "rgba(200, 200, 200, 0.2)";
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx, ty, tw, th);

    // Mercury level
    const tempRange = 60; // -20 to 40°C
    const tempNorm = Math.max(0, Math.min(1, (temperature + 20) / tempRange));
    const mercuryH = tempNorm * th;
    const mercuryColor = temperature > 30 ? "#ef4444" : temperature > 15 ? "#f59e0b" : "#3b82f6";
    ctx.fillStyle = mercuryColor;
    ctx.fillRect(tx + 3, ty + th - mercuryH, tw - 6, mercuryH);

    // Bulb
    ctx.beginPath();
    ctx.arc(tx + tw / 2, ty + th + 12, 15, 0, Math.PI * 2);
    ctx.fillStyle = mercuryColor;
    ctx.fill();

    // Temperature reading
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${temperature.toFixed(1)}°C`, tx + tw / 2, ty - 15);

    // Scale marks
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "left";
    for (let t = -20; t <= 40; t += 10) {
      const y = ty + th - ((t + 20) / tempRange) * th;
      ctx.fillText(`${t}°`, tx + tw + 4, y + 3);
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx + 5, y);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.stroke();
    }
  }

  function drawEnergyBalance(): void {
    const bx = 15;
    const by = 15;
    const bw = 260;
    const bh = 130;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Radiative Equilibrium", bx + 12, by + 22);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Solar input: ${(solarInput * 34).toFixed(0)} W/m²`, bx + 12, by + 44);

    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`Reflected: ${(solarInput * 34 * albedo / 10).toFixed(0)} W/m²`, bx + 12, by + 62);

    ctx.fillStyle = "#22c55e";
    ctx.fillText(`Absorbed: ${energyIn.toFixed(0)} W/m²`, bx + 12, by + 80);

    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Emitted IR: ${energyOut.toFixed(0)} W/m²`, bx + 12, by + 98);

    ctx.fillStyle = "#c084fc";
    ctx.fillText(`Greenhouse trapping: ${(greenhouseLevel * 10).toFixed(0)}%`, bx + 12, by + 116);
  }

  function drawLayerLabels(): void {
    ctx.save();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("Space", W - 100, SPACE_TOP - 8);
    ctx.fillText("Atmosphere", W - 100, (SPACE_TOP + GROUND_Y) / 2);
    ctx.fillText("Ground", W - 100, GROUND_Y + 20);
    ctx.restore();
  }

  function drawParticleLegend(): void {
    const lx = 15;
    const ly = H - 60;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, 260, 45, 6);
    ctx.fill();

    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.beginPath();
    ctx.arc(lx + 15, ly + 14, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 220, 50, 0.8)";
    ctx.fill();
    ctx.fillText("Solar radiation", lx + 25, ly + 17);

    ctx.beginPath();
    ctx.arc(lx + 110, ly + 14, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 80, 50, 0.8)";
    ctx.fill();
    ctx.fillText("Infrared (IR)", lx + 120, ly + 17);

    ctx.beginPath();
    ctx.arc(lx + 15, ly + 33, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.fill();
    ctx.fillText("Reflected", lx + 25, ly + 36);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`T_eq = ${targetTemperature.toFixed(1)}°C`, lx + 150, ly + 36);
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawSun();
    drawParticles();
    drawThermometer();
    drawEnergyBalance();
    drawLayerLabels();
    drawParticleLegend();
  }

  function reset(): void {
    time = 0;
    temperature = 15;
    particles = [];
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    return (
      `Radiative Equilibrium (Global Warming): Solar input=${(solarInput * 34).toFixed(0)} W/m², ` +
      `albedo=${(albedo * 10).toFixed(0)}%, greenhouse=${(greenhouseLevel * 10).toFixed(0)}%. ` +
      `Current temperature: ${temperature.toFixed(1)}°C, equilibrium: ${targetTemperature.toFixed(1)}°C. ` +
      `Energy in: ${energyIn.toFixed(0)} W/m², energy out: ${energyOut.toFixed(0)} W/m². ` +
      `When greenhouse gases increase, less IR escapes, temperature rises until a new equilibrium.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EquilibriumFactory;
