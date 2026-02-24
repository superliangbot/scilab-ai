import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const RockCycle: SimulationFactory = () => {
  const config = getSimConfig("rock-cycle")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let temperature = 800; // Celsius
  let pressure = 50; // kilobars
  let timeScale = 10; // speed multiplier
  let weatheringRate = 1;
  let time = 0;

  // Rock types and processes
  type RockType = "igneous" | "sedimentary" | "metamorphic" | "magma" | "sediment";
  
  interface RockParticle {
    x: number;
    y: number;
    type: RockType;
    age: number;
    size: number;
    transforming: boolean;
    targetType?: RockType;
    transformProgress: number;
  }

  const rockParticles: RockParticle[] = [];
  const MAX_PARTICLES = 150;

  // Environment zones
  const zones = {
    surface: { y: height * 0.2, height: height * 0.2 },
    shallow: { y: height * 0.4, height: height * 0.15 },
    deep: { y: height * 0.55, height: height * 0.15 },
    mantle: { y: height * 0.7, height: height * 0.3 }
  };

  // Colors for rock types
  const rockColors = {
    igneous: "#dc2626",      // red
    sedimentary: "#eab308",  // yellow
    metamorphic: "#7c2d12",  // brown
    magma: "#f97316",        // orange
    sediment: "#a3a3a3"      // gray
  };

  const BG_COLOR = "#0f172a";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";
  const ZONE_COLORS = {
    surface: "#87ceeb",
    shallow: "#8b5a3c",
    deep: "#654321",
    mantle: "#dc2626"
  };

  function createRockParticle(x: number, y: number, type: RockType): RockParticle {
    return {
      x,
      y,
      type,
      age: 0,
      size: 3 + Math.random() * 4,
      transforming: false,
      transformProgress: 0
    };
  }

  function initializeRocks() {
    rockParticles.length = 0;
    
    // Initialize with some rocks in each zone
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width;
      const y = zones.surface.y + Math.random() * zones.surface.height;
      rockParticles.push(createRockParticle(x, y, "sedimentary"));
    }
    
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = zones.shallow.y + Math.random() * zones.shallow.height;
      rockParticles.push(createRockParticle(x, y, "igneous"));
    }
    
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = zones.deep.y + Math.random() * zones.deep.height;
      rockParticles.push(createRockParticle(x, y, "metamorphic"));
    }
  }

  function getZone(y: number): string {
    if (y < zones.surface.y + zones.surface.height) return "surface";
    if (y < zones.shallow.y + zones.shallow.height) return "shallow";
    if (y < zones.deep.y + zones.deep.height) return "deep";
    return "mantle";
  }

  function getTemperatureAtDepth(y: number): number {
    const surfaceTemp = 15; // surface temperature
    const mantleTemp = 1200; // mantle temperature
    const depthRatio = y / height;
    return surfaceTemp + (mantleTemp - surfaceTemp) * depthRatio;
  }

  function getPressureAtDepth(y: number): number {
    const surfacePressure = 1; // surface pressure (1 bar)
    const mantlePressure = 100; // deep pressure (kilobars)
    const depthRatio = y / height;
    return surfacePressure + (mantlePressure - surfacePressure) * depthRatio;
  }

  function determineTransformation(rock: RockParticle): RockType | null {
    const zone = getZone(rock.y);
    const temp = getTemperatureAtDepth(rock.y);
    const press = getPressureAtDepth(rock.y);

    switch (rock.type) {
      case "sediment":
        if (press > 10 && temp > 200) {
          return "sedimentary"; // lithification
        }
        break;

      case "sedimentary":
        if (temp > 400 && press > 30) {
          return "metamorphic"; // metamorphosis
        }
        if (temp > 1000) {
          return "magma"; // melting
        }
        if (zone === "surface" && Math.random() < weatheringRate * 0.01) {
          return "sediment"; // weathering/erosion
        }
        break;

      case "igneous":
        if (temp > 600 && press > 40) {
          return "metamorphic"; // metamorphosis
        }
        if (temp > 1100) {
          return "magma"; // melting
        }
        if (zone === "surface" && Math.random() < weatheringRate * 0.01) {
          return "sediment"; // weathering/erosion
        }
        break;

      case "metamorphic":
        if (temp > 1200) {
          return "magma"; // melting
        }
        if (zone === "surface" && Math.random() < weatheringRate * 0.01) {
          return "sediment"; // weathering/erosion
        }
        break;

      case "magma":
        if (temp < 700) {
          return "igneous"; // crystallization
        }
        break;
    }

    return null;
  }

  function updateRockTransformations(dt: number) {
    for (const rock of rockParticles) {
      rock.age += dt;

      if (rock.transforming) {
        rock.transformProgress += dt * timeScale;
        
        if (rock.transformProgress >= 1.0) {
          // Complete transformation
          rock.type = rock.targetType!;
          rock.transforming = false;
          rock.transformProgress = 0;
          rock.targetType = undefined;
        }
      } else {
        // Check for new transformations
        const targetType = determineTransformation(rock);
        if (targetType && Math.random() < 0.02 * dt * timeScale) {
          rock.transforming = true;
          rock.targetType = targetType;
          rock.transformProgress = 0;
        }
      }

      // Slow particle movement based on geological processes
      if (rock.type === "magma") {
        // Magma rises due to buoyancy
        rock.y -= 5 * dt * timeScale;
        rock.x += (Math.random() - 0.5) * 2 * dt * timeScale;
      } else if (rock.type === "sediment") {
        // Sediment settles down
        rock.y += 3 * dt * timeScale;
      }

      // Keep particles in bounds
      rock.x = Math.max(0, Math.min(width, rock.x));
      rock.y = Math.max(0, Math.min(height, rock.y));
    }

    // Add new particles occasionally
    if (rockParticles.length < MAX_PARTICLES && Math.random() < 0.1 * dt) {
      const x = Math.random() * width;
      const y = zones.mantle.y + Math.random() * zones.mantle.height;
      rockParticles.push(createRockParticle(x, y, "magma"));
    }
  }

  function drawEnvironmentZones() {
    // Surface zone
    const surfaceGradient = ctx.createLinearGradient(0, zones.surface.y, 0, zones.surface.y + zones.surface.height);
    surfaceGradient.addColorStop(0, "#87ceeb");
    surfaceGradient.addColorStop(1, "#d4b896");
    ctx.fillStyle = surfaceGradient;
    ctx.fillRect(0, zones.surface.y, width, zones.surface.height);

    // Shallow crust zone
    const shallowGradient = ctx.createLinearGradient(0, zones.shallow.y, 0, zones.shallow.y + zones.shallow.height);
    shallowGradient.addColorStop(0, "#8b5a3c");
    shallowGradient.addColorStop(1, "#654321");
    ctx.fillStyle = shallowGradient;
    ctx.fillRect(0, zones.shallow.y, width, zones.shallow.height);

    // Deep crust zone
    const deepGradient = ctx.createLinearGradient(0, zones.deep.y, 0, zones.deep.y + zones.deep.height);
    deepGradient.addColorStop(0, "#654321");
    deepGradient.addColorStop(1, "#4a2c17");
    ctx.fillStyle = deepGradient;
    ctx.fillRect(0, zones.deep.y, width, zones.deep.height);

    // Mantle zone
    const mantleGradient = ctx.createLinearGradient(0, zones.mantle.y, 0, zones.mantle.y + zones.mantle.height);
    mantleGradient.addColorStop(0, "#dc2626");
    mantleGradient.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = mantleGradient;
    ctx.fillRect(0, zones.mantle.y, width, zones.mantle.height);

    // Zone labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.fillText("Surface (Weather & Erosion)", 10, zones.surface.y + zones.surface.height / 2);
    ctx.fillText("Shallow Crust", 10, zones.shallow.y + zones.shallow.height / 2);
    ctx.fillText("Deep Crust (High P&T)", 10, zones.deep.y + zones.deep.height / 2);
    ctx.fillText("Upper Mantle (Magma)", 10, zones.mantle.y + zones.mantle.height / 2);

    // Zone dividers
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(0, zones.surface.y + zones.surface.height);
    ctx.lineTo(width, zones.surface.y + zones.surface.height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, zones.shallow.y + zones.shallow.height);
    ctx.lineTo(width, zones.shallow.y + zones.shallow.height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, zones.deep.y + zones.deep.height);
    ctx.lineTo(width, zones.deep.y + zones.deep.height);
    ctx.stroke();
    
    ctx.setLineDash([]);
  }

  function drawRockParticles() {
    for (const rock of rockParticles) {
      if (rock.transforming) {
        // Show transformation with color mixing
        const currentColor = rockColors[rock.type];
        const targetColor = rockColors[rock.targetType!];
        
        // Simple color interpolation
        const t = rock.transformProgress;
        ctx.fillStyle = `rgb(${
          Math.round(parseInt(currentColor.slice(1, 3), 16) * (1-t) + parseInt(targetColor.slice(1, 3), 16) * t)
        }, ${
          Math.round(parseInt(currentColor.slice(3, 5), 16) * (1-t) + parseInt(targetColor.slice(3, 5), 16) * t)
        }, ${
          Math.round(parseInt(currentColor.slice(5, 7), 16) * (1-t) + parseInt(targetColor.slice(5, 7), 16) * t)
        })`;
        
        // Pulsing effect during transformation
        const pulseSize = rock.size + 2 * Math.sin(time * 10);
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Transformation indicator
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, rock.size + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Normal rock particle
        ctx.fillStyle = rockColors[rock.type];
        ctx.beginPath();
        ctx.arc(rock.x, rock.y, rock.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Age indicator (darker outline for older rocks)
        if (rock.age > 5) {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(rock.x, rock.y, rock.size, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  function drawProcessArrows() {
    ctx.strokeStyle = TEXT_COLOR;
    ctx.fillStyle = TEXT_COLOR;
    ctx.lineWidth = 2;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Weathering/Erosion (top to sediment)
    ctx.beginPath();
    ctx.moveTo(width * 0.2, zones.surface.y + 20);
    ctx.lineTo(width * 0.15, zones.surface.y + 50);
    ctx.stroke();
    ctx.fillText("Weathering", width * 0.17, zones.surface.y + 60);

    // Lithification (sediment to sedimentary)
    ctx.beginPath();
    ctx.moveTo(width * 0.3, zones.surface.y + zones.surface.height - 10);
    ctx.lineTo(width * 0.35, zones.shallow.y + 10);
    ctx.stroke();
    ctx.fillText("Lithification", width * 0.32, zones.shallow.y - 5);

    // Metamorphism
    ctx.beginPath();
    ctx.moveTo(width * 0.5, zones.shallow.y + zones.shallow.height - 10);
    ctx.lineTo(width * 0.55, zones.deep.y + 10);
    ctx.stroke();
    ctx.fillText("Metamorphism", width * 0.52, zones.deep.y - 5);

    // Melting
    ctx.beginPath();
    ctx.moveTo(width * 0.7, zones.deep.y + zones.deep.height - 10);
    ctx.lineTo(width * 0.75, zones.mantle.y + 10);
    ctx.stroke();
    ctx.fillText("Melting", width * 0.72, zones.mantle.y - 5);

    // Crystallization (magma to igneous)
    ctx.beginPath();
    ctx.moveTo(width * 0.8, zones.mantle.y + 20);
    ctx.lineTo(width * 0.85, zones.shallow.y + 30);
    ctx.stroke();
    ctx.fillText("Crystallization", width * 0.82, zones.shallow.y + 40);
  }

  function drawInfoPanel() {
    const counts = {
      sediment: rockParticles.filter(r => r.type === "sediment").length,
      sedimentary: rockParticles.filter(r => r.type === "sedimentary").length,
      igneous: rockParticles.filter(r => r.type === "igneous").length,
      metamorphic: rockParticles.filter(r => r.type === "metamorphic").length,
      magma: rockParticles.filter(r => r.type === "magma").length
    };
    
    const transforming = rockParticles.filter(r => r.transforming).length;
    
    const panelX = width - 320;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 300, lineH * 12 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 300, lineH * 12 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#f97316";
    ctx.fillText("Rock Cycle", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Time scale: ${timeScale}x accelerated`, x, y);
    y += lineH;
    
    ctx.fillText(`Weathering rate: ${weatheringRate.toFixed(1)}`, x, y);
    y += lineH;
    
    ctx.fillText(`Actively transforming: ${transforming}`, x, y);
    y += lineH;
    
    // Rock type counts with colors
    ctx.fillStyle = rockColors.sediment;
    ctx.fillText(`● Sediment: ${counts.sediment}`, x, y);
    y += lineH;
    
    ctx.fillStyle = rockColors.sedimentary;
    ctx.fillText(`● Sedimentary: ${counts.sedimentary}`, x, y);
    y += lineH;
    
    ctx.fillStyle = rockColors.igneous;
    ctx.fillText(`● Igneous: ${counts.igneous}`, x, y);
    y += lineH;
    
    ctx.fillStyle = rockColors.metamorphic;
    ctx.fillText(`● Metamorphic: ${counts.metamorphic}`, x, y);
    y += lineH;
    
    ctx.fillStyle = rockColors.magma;
    ctx.fillText(`● Magma: ${counts.magma}`, x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Processes:", x, y);
    y += lineH;
    
    ctx.fillText("• Heat & pressure → metamorphism", x, y);
    y += lineH;
    
    ctx.fillText("• Extreme heat → melting → magma", x, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initializeRocks();
    },

    update(dt: number, params: Record<string, number>) {
      temperature = params.temperature ?? temperature;
      pressure = params.pressure ?? pressure;
      timeScale = params.timeScale ?? timeScale;
      weatheringRate = params.weatheringRate ?? weatheringRate;
      
      time += dt;
      
      updateRockTransformations(dt);
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw environment zones
      drawEnvironmentZones();
      
      // Draw rock particles
      drawRockParticles();
      
      // Draw process arrows and labels
      drawProcessArrows();
      
      // Info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
      initializeRocks();
    },

    destroy() {
      rockParticles.length = 0;
    },

    getStateDescription(): string {
      const counts = {
        sediment: rockParticles.filter(r => r.type === "sediment").length,
        sedimentary: rockParticles.filter(r => r.type === "sedimentary").length,
        igneous: rockParticles.filter(r => r.type === "igneous").length,
        metamorphic: rockParticles.filter(r => r.type === "metamorphic").length,
        magma: rockParticles.filter(r => r.type === "magma").length
      };
      
      const transforming = rockParticles.filter(r => r.transforming).length;
      
      return (
        `Rock Cycle: Continuous transformation of rocks through geological processes. ` +
        `Current distribution - Sediment: ${counts.sediment}, Sedimentary: ${counts.sedimentary}, ` +
        `Igneous: ${counts.igneous}, Metamorphic: ${counts.metamorphic}, Magma: ${counts.magma}. ` +
        `${transforming} rocks actively transforming. Time scale: ${timeScale}x. ` +
        `Processes driven by temperature, pressure, and weathering. Deep rocks experience metamorphism, ` +
        `extreme heat causes melting, surface weathering creates sediments, burial causes lithification.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default RockCycle;