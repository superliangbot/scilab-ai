import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const WaterCycle: SimulationFactory = () => {
  const config = getSimConfig("water-cycle")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let evaporationRate = 5; // particles per second
  let windSpeed = 30; // pixels per second
  let temperature = 25; // Celsius
  let precipitation = false;
  let time = 0;

  // Water particles
  interface WaterParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    state: "liquid" | "vapor" | "cloud" | "rain";
    age: number;
    size: number;
  }

  const waterParticles: WaterParticle[] = [];
  const MAX_PARTICLES = 300;

  // Environment data
  const OCEAN_Y = height * 0.7;
  const CLOUD_Y = height * 0.25;
  const MOUNTAIN_X = width * 0.6;
  const MOUNTAIN_HEIGHT = height * 0.3;

  // Colors
  const BG_COLOR = "#87ceeb"; // sky blue
  const OCEAN_COLOR = "#1e40af";
  const CLOUD_COLOR = "#f3f4f6";
  const RAIN_COLOR = "#3b82f6";
  const VAPOR_COLOR = "rgba(255, 255, 255, 0.3)";
  const MOUNTAIN_COLOR = "#78716c";
  const SUN_COLOR = "#fbbf24";
  const TEXT_COLOR = "#1f2937";
  const TEXT_DIM = "#6b7280";

  function createWaterParticle(x: number, y: number, state: "liquid" | "vapor" | "cloud" | "rain"): WaterParticle {
    return {
      x,
      y,
      vx: state === "vapor" ? (Math.random() - 0.5) * windSpeed : 0,
      vy: state === "vapor" ? -20 - Math.random() * 30 : state === "rain" ? 50 + Math.random() * 50 : 0,
      state,
      age: 0,
      size: state === "vapor" ? 1 : state === "cloud" ? 3 : state === "rain" ? 2 : 1
    };
  }

  function updateWaterParticles(dt: number) {
    // Add new evaporated particles
    if (Math.random() < evaporationRate * dt) {
      if (waterParticles.length < MAX_PARTICLES) {
        const x = 50 + Math.random() * (MOUNTAIN_X - 100);
        waterParticles.push(createWaterParticle(x, OCEAN_Y, "vapor"));
      }
    }

    // Update existing particles
    for (let i = waterParticles.length - 1; i >= 0; i--) {
      const particle = waterParticles[i];
      particle.age += dt;

      switch (particle.state) {
        case "vapor":
          // Rising water vapor
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;

          // Condensation at cloud level
          if (particle.y <= CLOUD_Y && Math.random() < 0.8) {
            particle.state = "cloud";
            particle.vy = 0;
            particle.vx = windSpeed * 0.5;
            particle.size = 3 + Math.random() * 2;
          }

          // Remove if too old or off screen
          if (particle.age > 10 || particle.y < -10 || particle.x < -10 || particle.x > width + 10) {
            waterParticles.splice(i, 1);
          }
          break;

        case "cloud":
          // Cloud movement and growth
          particle.x += particle.vx * dt;
          particle.y += Math.sin(time * 2 + particle.x * 0.01) * 5 * dt; // gentle vertical drift

          // Precipitation trigger (more likely over mountains due to orographic lifting)
          const overMountain = particle.x > MOUNTAIN_X - 50;
          const precipitationChance = overMountain ? 0.02 : 0.005;
          
          if (Math.random() < precipitationChance * dt || 
              (precipitation && Math.random() < 0.1 * dt)) {
            particle.state = "rain";
            particle.vy = 80 + Math.random() * 40;
            particle.vx *= 0.3; // slower horizontal movement when falling
            particle.size = 2;
          }

          // Remove if drifted too far
          if (particle.x > width + 50 || particle.age > 20) {
            waterParticles.splice(i, 1);
          }
          break;

        case "rain":
          // Falling precipitation
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;

          // Hit ground or ocean
          if (particle.y >= OCEAN_Y) {
            // Cycle back to ocean/ground water
            waterParticles.splice(i, 1);
          }

          // Remove if off screen
          if (particle.x < -10 || particle.x > width + 10 || particle.y > height + 10) {
            waterParticles.splice(i, 1);
          }
          break;
      }
    }
  }

  function drawSun() {
    const sunX = width * 0.15;
    const sunY = height * 0.15;
    const sunRadius = 30;

    // Sun glow
    const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 1.5);
    gradient.addColorStop(0, "rgba(251, 191, 36, 0.8)");
    gradient.addColorStop(1, "rgba(251, 191, 36, 0.1)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Sun body
    ctx.fillStyle = SUN_COLOR;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays
    ctx.strokeStyle = SUN_COLOR;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const startRadius = sunRadius + 10;
      const endRadius = sunRadius + 20;

      ctx.beginPath();
      ctx.moveTo(
        sunX + Math.cos(angle) * startRadius,
        sunY + Math.sin(angle) * startRadius
      );
      ctx.lineTo(
        sunX + Math.cos(angle) * endRadius,
        sunY + Math.sin(angle) * endRadius
      );
      ctx.stroke();
    }

    // Evaporation rays to ocean
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    for (let i = 0; i < 5; i++) {
      const startX = sunX + 20;
      const startY = sunY + 20;
      const endX = 100 + i * 50;
      const endY = OCEAN_Y - 10;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawOcean() {
    // Ocean body
    ctx.fillStyle = OCEAN_COLOR;
    ctx.fillRect(0, OCEAN_Y, MOUNTAIN_X, height - OCEAN_Y);

    // Ocean waves
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let x = 0; x <= MOUNTAIN_X; x += 10) {
      const waveHeight = 5 * Math.sin(time * 3 + x * 0.1);
      const y = OCEAN_Y + waveHeight;
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Beach/shore
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(MOUNTAIN_X - 20, OCEAN_Y, 20, height - OCEAN_Y);
  }

  function drawMountains() {
    // Mountain silhouette
    ctx.fillStyle = MOUNTAIN_COLOR;
    ctx.beginPath();
    ctx.moveTo(MOUNTAIN_X, OCEAN_Y);
    ctx.lineTo(MOUNTAIN_X + 60, OCEAN_Y - MOUNTAIN_HEIGHT * 0.4);
    ctx.lineTo(MOUNTAIN_X + 120, OCEAN_Y - MOUNTAIN_HEIGHT);
    ctx.lineTo(MOUNTAIN_X + 180, OCEAN_Y - MOUNTAIN_HEIGHT * 0.7);
    ctx.lineTo(MOUNTAIN_X + 240, OCEAN_Y - MOUNTAIN_HEIGHT * 0.3);
    ctx.lineTo(width, OCEAN_Y);
    ctx.lineTo(width, height);
    ctx.lineTo(MOUNTAIN_X, height);
    ctx.closePath();
    ctx.fill();

    // Snow cap
    ctx.fillStyle = "#f8fafc";
    const peakX = MOUNTAIN_X + 120;
    const peakY = OCEAN_Y - MOUNTAIN_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(peakX - 30, peakY + 30);
    ctx.lineTo(peakX, peakY);
    ctx.lineTo(peakX + 30, peakY + 30);
    ctx.closePath();
    ctx.fill();
  }

  function drawClouds() {
    // Background cloud formation
    ctx.fillStyle = "rgba(243, 244, 246, 0.6)";
    
    // Draw cloud clusters
    const cloudCenters = [
      { x: width * 0.3, y: CLOUD_Y },
      { x: width * 0.5, y: CLOUD_Y - 20 },
      { x: width * 0.8, y: CLOUD_Y + 10 }
    ];

    for (const center of cloudCenters) {
      for (let i = 0; i < 5; i++) {
        const cloudX = center.x + (Math.random() - 0.5) * 100;
        const cloudY = center.y + (Math.random() - 0.5) * 30;
        const cloudSize = 15 + Math.random() * 20;
        
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, cloudSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawWaterParticles() {
    for (const particle of waterParticles) {
      switch (particle.state) {
        case "vapor":
          ctx.fillStyle = VAPOR_COLOR;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case "cloud":
          ctx.fillStyle = CLOUD_COLOR;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case "rain":
          ctx.strokeStyle = RAIN_COLOR;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(particle.x, particle.y + 8);
          ctx.stroke();
          break;
      }
    }
  }

  function drawProcessLabels() {
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Evaporation
    ctx.fillStyle = "#dc2626";
    ctx.fillText("EVAPORATION", width * 0.25, OCEAN_Y - 40);

    // Condensation
    ctx.fillStyle = "#2563eb";
    ctx.fillText("CONDENSATION", width * 0.45, CLOUD_Y - 30);

    // Precipitation
    ctx.fillStyle = "#1e40af";
    ctx.fillText("PRECIPITATION", width * 0.75, height * 0.5);

    // Collection
    ctx.fillStyle = "#059669";
    ctx.fillText("COLLECTION", MOUNTAIN_X + 100, OCEAN_Y + 30);

    // Process arrows
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);

    // Evaporation arrow
    ctx.beginPath();
    ctx.moveTo(width * 0.2, OCEAN_Y - 20);
    ctx.lineTo(width * 0.35, CLOUD_Y + 20);
    ctx.stroke();

    // Condensation arrow
    ctx.beginPath();
    ctx.moveTo(width * 0.4, CLOUD_Y - 10);
    ctx.lineTo(width * 0.6, CLOUD_Y);
    ctx.stroke();

    // Precipitation arrow
    ctx.beginPath();
    ctx.moveTo(width * 0.7, CLOUD_Y + 20);
    ctx.lineTo(width * 0.75, OCEAN_Y - 50);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  function drawInfoPanel() {
    const vaporCount = waterParticles.filter(p => p.state === "vapor").length;
    const cloudCount = waterParticles.filter(p => p.state === "cloud").length;
    const rainCount = waterParticles.filter(p => p.state === "rain").length;
    
    const panelX = 15;
    const panelY = height - 180;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 280, lineH * 8 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(107, 114, 128, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 280, lineH * 8 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#1f2937";
    ctx.fillText("Water Cycle", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Temperature: ${temperature.toFixed(0)}°C`, x, y);
    y += lineH;
    
    ctx.fillText(`Evaporation rate: ${evaporationRate.toFixed(1)}/s`, x, y);
    y += lineH;
    
    ctx.fillText(`Wind speed: ${windSpeed.toFixed(0)} px/s`, x, y);
    y += lineH;
    
    ctx.fillStyle = "#dc2626";
    ctx.fillText(`Water vapor: ${vaporCount}`, x, y);
    y += lineH;
    
    ctx.fillStyle = "#2563eb";
    ctx.fillText(`Cloud droplets: ${cloudCount}`, x, y);
    y += lineH;
    
    ctx.fillStyle = "#1e40af";
    ctx.fillText(`Rain drops: ${rainCount}`, x, y);
    y += lineH;
    
    ctx.fillStyle = precipitation ? "#ef4444" : TEXT_DIM;
    ctx.fillText(precipitation ? "⛈ Precipitation active" : "☀ Clear weather", x, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      evaporationRate = params.evaporationRate ?? evaporationRate;
      windSpeed = params.windSpeed ?? windSpeed;
      temperature = params.temperature ?? temperature;
      precipitation = (params.precipitation ?? 0) > 0.5;
      
      time += dt;
      
      // Temperature affects evaporation rate
      const tempFactor = Math.max(0.1, temperature / 30);
      const adjustedEvapRate = evaporationRate * tempFactor;
      
      updateWaterParticles(dt);
    },

    render() {
      // Sky background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#87ceeb");
      gradient.addColorStop(0.7, "#b6d7ff");
      gradient.addColorStop(1, "#e0f2ff");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Draw sun
      drawSun();
      
      // Draw background clouds
      drawClouds();
      
      // Draw terrain
      drawOcean();
      drawMountains();
      
      // Draw water particles
      drawWaterParticles();
      
      // Draw process labels and arrows
      drawProcessLabels();
      
      // Info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
      waterParticles.length = 0;
    },

    destroy() {
      waterParticles.length = 0;
    },

    getStateDescription(): string {
      const vaporCount = waterParticles.filter(p => p.state === "vapor").length;
      const cloudCount = waterParticles.filter(p => p.state === "cloud").length;
      const rainCount = waterParticles.filter(p => p.state === "rain").length;
      
      return (
        `Water Cycle: Continuous movement of water through evaporation, condensation, precipitation, and collection. ` +
        `Temperature: ${temperature}°C, evaporation rate: ${evaporationRate}/s, wind speed: ${windSpeed} px/s. ` +
        `Active particles - Vapor: ${vaporCount}, Clouds: ${cloudCount}, Rain: ${rainCount}. ` +
        `${precipitation ? 'Precipitation is active due to orographic lifting over mountains.' : 'Clear weather conditions.'} ` +
        `Solar energy drives evaporation from ocean surface, water vapor rises and condenses into clouds at cooler altitudes.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default WaterCycle;