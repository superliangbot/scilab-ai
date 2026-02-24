import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HeatCapacityFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("heat-capacity") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let heatRate = 50; // watts applied
  let smallCapacity = 100; // J/K
  let largeCapacity = 500; // J/K

  let tempSmall = 20; // °C
  let tempLarge = 20; // °C
  let isHeating = false;
  let heatingTime = 0;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
  }

  const PARTICLE_COUNT = 40;
  let particlesSmall: Particle[] = [];
  let particlesLarge: Particle[] = [];

  function createParticles(count: number, bounds: { x: number; y: number; w: number; h: number }): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: bounds.x + Math.random() * bounds.w,
        y: bounds.y + Math.random() * bounds.h,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }
    return particles;
  }

  function updateParticles(particles: Particle[], temp: number, bounds: { x: number; y: number; w: number; h: number }) {
    const speedFactor = Math.sqrt((temp + 273.15) / 293.15);
    for (const p of particles) {
      p.x += p.vx * speedFactor;
      p.y += p.vy * speedFactor;

      if (p.x < bounds.x) { p.x = bounds.x; p.vx = Math.abs(p.vx); }
      if (p.x > bounds.x + bounds.w) { p.x = bounds.x + bounds.w; p.vx = -Math.abs(p.vx); }
      if (p.y < bounds.y) { p.y = bounds.y; p.vy = Math.abs(p.vy); }
      if (p.y > bounds.y + bounds.h) { p.y = bounds.y + bounds.h; p.vy = -Math.abs(p.vy); }
    }
  }

  function tempToColor(temp: number): string {
    const t = Math.min(1, Math.max(0, (temp - 20) / 280)); // 20-300°C range
    const r = Math.round(50 + 205 * t);
    const g = Math.round(100 + 100 * (1 - t));
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }

  function drawContainer(label: string, temp: number, particles: Particle[], cx: number, topY: number, containerW: number, containerH: number) {
    // Container
    ctx.strokeStyle = "#667";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(20,30,50,0.8)";
    ctx.beginPath();
    ctx.roundRect(cx - containerW / 2, topY, containerW, containerH, 6);
    ctx.fill();
    ctx.stroke();

    // Liquid fill (colored by temp)
    const fillColor = tempToColor(temp);
    const fillH = containerH * 0.75;
    const fillY = topY + containerH - fillH;
    const grad = ctx.createLinearGradient(cx, fillY, cx, topY + containerH);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, tempToColor(temp + 20));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(cx - containerW / 2 + 3, fillY, containerW - 6, fillH - 3, [0, 0, 4, 4]);
    ctx.fill();

    // Particles
    for (const p of particles) {
      const pColor = tempToColor(temp + 10);
      ctx.fillStyle = pColor;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Burner
    if (isHeating) {
      const burnerY = topY + containerH + 5;
      const flameHeight = 15 + Math.sin(time * 10) * 5;
      for (let i = 0; i < 5; i++) {
        const fx = cx - 20 + i * 10;
        const fh = flameHeight * (0.7 + 0.3 * Math.sin(time * 8 + i));
        const flameGrad = ctx.createLinearGradient(fx, burnerY + 10, fx, burnerY + 10 - fh);
        flameGrad.addColorStop(0, "#ff4400");
        flameGrad.addColorStop(0.5, "#ffaa00");
        flameGrad.addColorStop(1, "rgba(255,200,0,0)");
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.ellipse(fx, burnerY + 10, 5, fh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Burner base
      ctx.fillStyle = "#555";
      ctx.fillRect(cx - 30, burnerY + 10, 60, 6);
    }

    // Temperature readout
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${temp.toFixed(1)}°C`, cx, topY - 25);

    // Label
    ctx.fillStyle = "#aabbcc";
    ctx.font = "12px sans-serif";
    ctx.fillText(label, cx, topY - 8);
  }

  function drawGraph() {
    const graphX = width * 0.05;
    const graphY = height - 120;
    const graphW = width * 0.9;
    const graphH = 90;

    ctx.fillStyle = "rgba(15,20,35,0.8)";
    ctx.strokeStyle = "rgba(100,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(graphX, graphY, graphW, graphH, 6);
    ctx.fill();
    ctx.stroke();

    // Axes
    const plotX = graphX + 40;
    const plotY = graphY + 10;
    const plotW = graphW - 55;
    const plotH = graphH - 30;

    ctx.strokeStyle = "#445";
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#778";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time (s)", plotX + plotW / 2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(graphX + 12, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Temp (°C)", 0, 0);
    ctx.restore();

    // Temperature curves
    const maxTime = Math.max(30, heatingTime + 5);
    const maxTemp = 300;

    // Small capacity curve
    ctx.strokeStyle = "#ff6644";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0; t <= heatingTime; t += 0.5) {
      const temp = 20 + (heatRate * t) / smallCapacity;
      const x = plotX + (t / maxTime) * plotW;
      const y = plotY + plotH - ((Math.min(temp, maxTemp) - 20) / (maxTemp - 20)) * plotH;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Large capacity curve
    ctx.strokeStyle = "#4488ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let t = 0; t <= heatingTime; t += 0.5) {
      const temp = 20 + (heatRate * t) / largeCapacity;
      const x = plotX + (t / maxTime) * plotW;
      const y = plotY + plotH - ((Math.min(temp, maxTemp) - 20) / (maxTemp - 20)) * plotH;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Legend
    ctx.fillStyle = "#ff6644";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`● Small C (${smallCapacity} J/K)`, plotX + 5, plotY + 12);
    ctx.fillStyle = "#4488ff";
    ctx.fillText(`● Large C (${largeCapacity} J/K)`, plotX + 5, plotY + 24);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      isHeating = true;

      const containerW = width * 0.3;
      const containerH = height * 0.35;
      const topY = 80;

      particlesSmall = createParticles(PARTICLE_COUNT, {
        x: width * 0.25 - containerW / 2 + 5,
        y: topY + containerH * 0.25,
        w: containerW - 10,
        h: containerH * 0.7,
      });
      particlesLarge = createParticles(PARTICLE_COUNT, {
        x: width * 0.75 - containerW / 2 + 5,
        y: topY + containerH * 0.25,
        w: containerW - 10,
        h: containerH * 0.7,
      });
    },

    update(dt: number, params: Record<string, number>) {
      heatRate = params.heatRate ?? 50;
      smallCapacity = params.smallCapacity ?? 100;
      largeCapacity = params.largeCapacity ?? 500;

      if (isHeating) {
        heatingTime += dt;
        // Q = P * t, deltaT = Q / C
        tempSmall = 20 + (heatRate * heatingTime) / smallCapacity;
        tempLarge = 20 + (heatRate * heatingTime) / largeCapacity;

        // Cap at 300°C
        if (tempSmall > 300) tempSmall = 300;
        if (tempLarge > 300) tempLarge = 300;
      }

      const containerW = width * 0.3;
      const containerH = height * 0.35;
      const topY = 80;

      updateParticles(particlesSmall, tempSmall, {
        x: width * 0.25 - containerW / 2 + 5,
        y: topY + containerH * 0.25,
        w: containerW - 10,
        h: containerH * 0.7,
      });
      updateParticles(particlesLarge, tempLarge, {
        x: width * 0.75 - containerW / 2 + 5,
        y: topY + containerH * 0.25,
        w: containerW - 10,
        h: containerH * 0.7,
      });

      time += dt;
    },

    render() {
      ctx.fillStyle = "#0c1222";
      ctx.fillRect(0, 0, width, height);

      // Title
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Heat Capacity Comparison", width / 2, 28);

      ctx.fillStyle = "#889";
      ctx.font = "12px monospace";
      ctx.fillText(`Q = C × ΔT  |  Heat rate: ${heatRate} W  |  Time: ${heatingTime.toFixed(1)}s`, width / 2, 48);

      const containerW = width * 0.3;
      const containerH = height * 0.35;
      const topY = 80;

      drawContainer(`Small C (${smallCapacity} J/K)`, tempSmall, particlesSmall, width * 0.25, topY, containerW, containerH);
      drawContainer(`Large C (${largeCapacity} J/K)`, tempLarge, particlesLarge, width * 0.75, topY, containerW, containerH);

      // VS label
      ctx.fillStyle = "#555";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("vs", width / 2, topY + containerH / 2);

      drawGraph();

      // Formula
      ctx.fillStyle = "#556";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("ΔT = Q / C → Lower heat capacity = faster temperature rise", width / 2, height - 8);
    },

    reset() {
      time = 0;
      heatingTime = 0;
      tempSmall = 20;
      tempLarge = 20;
      isHeating = true;
    },

    destroy() {
      particlesSmall = [];
      particlesLarge = [];
    },

    getStateDescription() {
      return `Heat capacity comparison: Small C (${smallCapacity} J/K) at ${tempSmall.toFixed(1)}°C, Large C (${largeCapacity} J/K) at ${tempLarge.toFixed(1)}°C. Heat rate=${heatRate}W, time=${heatingTime.toFixed(1)}s. Q=C×ΔT shows lower capacity heats faster.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HeatCapacityFactory;
