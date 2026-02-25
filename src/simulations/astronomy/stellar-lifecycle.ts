import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const StellarLifecycle: SimulationFactory = () => {
  const config = getSimConfig("stellar-lifecycle")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Star parameters
  let initialMass = 1; // Solar masses
  let timeScale = 100; // Speed up factor
  let showHRDiagram = true;
  let time = 0;

  // Stellar evolution stages
  type StellarStage = 
    | "protostar" 
    | "main_sequence" 
    | "red_giant" 
    | "horizontal_branch"
    | "asymptotic_giant"
    | "white_dwarf"
    | "neutron_star" 
    | "black_hole"
    | "supernova";

  interface Star {
    mass: number; // Solar masses
    radius: number; // Solar radii
    temperature: number; // Kelvin
    luminosity: number; // Solar luminosities
    age: number; // Million years
    stage: StellarStage;
    stageProgress: number; // 0-1 within current stage
    x: number;
    y: number;
  }

  let star: Star;
  let evolutionHistory: { stage: StellarStage; age: number; temp: number; lum: number }[] = [];

  // Stellar evolution data (approximate)
  const stageData = {
    protostar: {
      duration: 50, // million years
      tempRange: [3000, 4000],
      lumRange: [0.01, 0.1],
      radiusRange: [2, 5]
    },
    main_sequence: {
      duration: 10000, // varies greatly with mass
      tempRange: [3500, 40000],
      lumRange: [0.1, 100000],
      radiusRange: [0.1, 15]
    },
    red_giant: {
      duration: 1000,
      tempRange: [3000, 5000],
      lumRange: [10, 10000],
      radiusRange: [10, 200]
    },
    horizontal_branch: {
      duration: 100,
      tempRange: [4500, 8000],
      lumRange: [50, 200],
      radiusRange: [5, 15]
    },
    asymptotic_giant: {
      duration: 500,
      tempRange: [2500, 4000],
      lumRange: [1000, 50000],
      radiusRange: [100, 500]
    },
    white_dwarf: {
      duration: 1000000, // effectively eternal
      tempRange: [5000, 100000],
      lumRange: [0.0001, 0.1],
      radiusRange: [0.008, 0.02]
    },
    neutron_star: {
      duration: 1000000,
      tempRange: [600000, 1000000],
      lumRange: [0.001, 1],
      radiusRange: [0.00001, 0.00002]
    },
    black_hole: {
      duration: 1000000,
      tempRange: [0, 0],
      lumRange: [0, 0],
      radiusRange: [0.00001, 0.0001]
    },
    supernova: {
      duration: 0.01, // Very brief
      tempRange: [10000, 100000],
      lumRange: [1000000000, 10000000000],
      radiusRange: [10, 1000]
    }
  };

  // Colors
  const BG_COLOR = "#000814";
  const STAR_COLORS = {
    protostar: "#8b4513",
    main_sequence: "#ffff00",
    red_giant: "#ff4500",
    horizontal_branch: "#ffa500",
    asymptotic_giant: "#ff0000",
    white_dwarf: "#ffffff",
    neutron_star: "#add8e6",
    black_hole: "#000000",
    supernova: "#ff69b4"
  };
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";
  const GRID_COLOR = "#374151";

  function initializeStar() {
    const centerX = width * 0.3;
    const centerY = height * 0.5;
    
    star = {
      mass: initialMass,
      radius: 2,
      temperature: 3000,
      luminosity: 0.01,
      age: 0,
      stage: "protostar",
      stageProgress: 0,
      x: centerX,
      y: centerY
    };
    
    evolutionHistory = [];
    time = 0;
  }

  function getMainSequenceLifetime(mass: number): number {
    // Lifetime roughly proportional to M^-2.5
    return 10000 * Math.pow(mass, -2.5);
  }

  function getNextStage(currentStage: StellarStage, mass: number): StellarStage {
    switch (currentStage) {
      case "protostar": return "main_sequence";
      case "main_sequence": 
        if (mass > 8) return "supernova";
        return "red_giant";
      case "red_giant":
        if (mass < 0.5) return "white_dwarf";
        return "horizontal_branch";
      case "horizontal_branch": return "asymptotic_giant";
      case "asymptotic_giant": return "white_dwarf";
      case "supernova":
        if (mass > 25) return "black_hole";
        if (mass > 8) return "neutron_star";
        return "white_dwarf";
      default: return currentStage; // End states
    }
  }

  function updateStellarProperties() {
    const stage = stageData[star.stage];
    const progress = star.stageProgress;
    
    // Interpolate properties based on stage progress
    star.temperature = stage.tempRange[0] + 
      (stage.tempRange[1] - stage.tempRange[0]) * progress;
    
    star.luminosity = stage.lumRange[0] + 
      (stage.lumRange[1] - stage.lumRange[0]) * progress;
    
    star.radius = stage.radiusRange[0] + 
      (stage.radiusRange[1] - stage.radiusRange[0]) * progress;
    
    // Mass loss for evolved stars
    if (star.stage === "red_giant" || star.stage === "asymptotic_giant") {
      star.mass *= 0.9999; // Gradual mass loss
    }
    
    // Special cases
    if (star.stage === "main_sequence") {
      // Main sequence properties depend heavily on mass
      const massFactor = Math.pow(initialMass, 3.5);
      star.luminosity = massFactor;
      
      if (initialMass < 0.5) {
        star.temperature = 3000 + initialMass * 1000;
      } else if (initialMass < 1.5) {
        star.temperature = 4000 + initialMass * 2000;
      } else {
        star.temperature = 6000 + initialMass * 3000;
      }
    }
  }

  function updateStellarEvolution(dt: number) {
    const scaledDt = dt * timeScale;
    const currentStageData = stageData[star.stage];
    
    // Special handling for main sequence lifetime
    let stageDuration = currentStageData.duration;
    if (star.stage === "main_sequence") {
      stageDuration = getMainSequenceLifetime(initialMass);
    }
    
    // Update age and stage progress
    star.age += scaledDt;
    star.stageProgress += scaledDt / stageDuration;
    
    // Check for stage transition
    if (star.stageProgress >= 1.0) {
      // Record current state in history
      evolutionHistory.push({
        stage: star.stage,
        age: star.age,
        temp: star.temperature,
        lum: star.luminosity
      });
      
      // Move to next stage
      const nextStage = getNextStage(star.stage, star.mass);
      
      if (nextStage !== star.stage) {
        star.stage = nextStage;
        star.stageProgress = 0;
        
        // Special transitions
        if (star.stage === "supernova") {
          // Supernova explosion
          star.radius *= 100;
          star.luminosity *= 1000000;
        } else if (star.stage === "white_dwarf") {
          star.mass = Math.min(1.4, star.mass * 0.6); // Chandrasekhar limit
        } else if (star.stage === "neutron_star") {
          star.mass = Math.min(2.17, star.mass * 0.8); // Tolman-Oppenheimer-Volkoff limit
        }
      } else {
        star.stageProgress = 0.99; // Stay at end of final stage
      }
    }
    
    updateStellarProperties();
  }

  function temperatureToColor(temperature: number): string {
    // Convert temperature to RGB color (simplified blackbody radiation)
    if (temperature < 3500) return "#ff4500"; // Red
    if (temperature < 5000) return "#ffa500"; // Orange
    if (temperature < 6000) return "#ffff00"; // Yellow
    if (temperature < 7500) return "#ffffff"; // White
    if (temperature < 10000) return "#add8e6"; // Light blue
    return "#0000ff"; // Blue
  }

  function drawStar() {
    const visualRadius = Math.max(3, Math.min(50, star.radius * 2));
    const color = star.stage in STAR_COLORS ? 
      STAR_COLORS[star.stage as keyof typeof STAR_COLORS] : 
      temperatureToColor(star.temperature);
    
    // Stellar glow
    const gradient = ctx.createRadialGradient(
      star.x, star.y, 0,
      star.x, star.y, visualRadius * 2
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.7, `${color}33`);
    gradient.addColorStop(1, "transparent");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(star.x, star.y, visualRadius * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Star body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, visualRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Black hole special case
    if (star.stage === "black_hole") {
      // Event horizon
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(star.x, star.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Accretion disk
      ctx.strokeStyle = "#ffa500";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Supernova shock wave
    if (star.stage === "supernova") {
      const shockRadius = visualRadius * 3 * (1 + star.stageProgress * 5);
      ctx.strokeStyle = "#ff69b4";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7 - star.stageProgress * 0.7;
      ctx.beginPath();
      ctx.arc(star.x, star.y, shockRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawHRDiagram() {
    if (!showHRDiagram) return;
    
    const hrX = width * 0.6;
    const hrY = height * 0.15;
    const hrWidth = width * 0.35;
    const hrHeight = height * 0.7;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(hrX - 10, hrY - 10, hrWidth + 20, hrHeight + 20);
    
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(hrX - 10, hrY - 10, hrWidth + 20, hrHeight + 20);
    
    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Hertzsprung-Russell Diagram", hrX + hrWidth / 2, hrY - 15);
    
    // Axes labels
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Temperature (K)", hrX + hrWidth / 2, hrY + hrHeight + 35);
    
    ctx.save();
    ctx.translate(hrX - 35, hrY + hrHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Luminosity (Solar)", 0, 0);
    ctx.restore();
    
    // Grid lines and labels
    ctx.strokeStyle = "rgba(55, 65, 81, 0.5)";
    ctx.lineWidth = 1;
    
    // Temperature axis (logarithmic, reversed)
    const tempMin = Math.log10(3000);
    const tempMax = Math.log10(40000);
    const tempTicks = [3000, 5000, 10000, 20000, 40000];
    
    for (const temp of tempTicks) {
      const logTemp = Math.log10(temp);
      const x = hrX + hrWidth * (1 - (logTemp - tempMin) / (tempMax - tempMin));
      
      ctx.beginPath();
      ctx.moveTo(x, hrY);
      ctx.lineTo(x, hrY + hrHeight);
      ctx.stroke();
      
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(temp.toString(), x, hrY + hrHeight + 5);
    }
    
    // Luminosity axis (logarithmic)
    const lumMin = Math.log10(0.0001);
    const lumMax = Math.log10(100000);
    const lumTicks = [0.0001, 0.01, 1, 100, 10000];
    
    for (const lum of lumTicks) {
      const logLum = Math.log10(lum);
      const y = hrY + hrHeight * (1 - (logLum - lumMin) / (lumMax - lumMin));
      
      ctx.beginPath();
      ctx.moveTo(hrX, y);
      ctx.lineTo(hrX + hrWidth, y);
      ctx.stroke();
      
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(lum.toString(), hrX - 5, y);
    }
    
    // Main sequence line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i <= 50; i++) {
      const mass = 0.1 + (i / 50) * 20;
      const temp = mass < 0.5 ? 3000 + mass * 1000 : 
                   mass < 1.5 ? 4000 + mass * 2000 : 
                   6000 + mass * 3000;
      const lum = Math.pow(mass, 3.5);
      
      const logTemp = Math.log10(temp);
      const logLum = Math.log10(lum);
      
      const x = hrX + hrWidth * (1 - (logTemp - tempMin) / (tempMax - tempMin));
      const y = hrY + hrHeight * (1 - (logLum - lumMin) / (lumMax - lumMin));
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Evolution track
    if (evolutionHistory.length > 1) {
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < evolutionHistory.length; i++) {
        const point = evolutionHistory[i];
        const logTemp = Math.log10(point.temp);
        const logLum = Math.log10(Math.max(0.0001, point.lum));
        
        const x = hrX + hrWidth * (1 - (logTemp - tempMin) / (tempMax - tempMin));
        const y = hrY + hrHeight * (1 - (logLum - lumMin) / (lumMax - lumMin));
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    
    // Current star position
    const logTemp = Math.log10(star.temperature);
    const logLum = Math.log10(Math.max(0.0001, star.luminosity));
    
    const starX = hrX + hrWidth * (1 - (logTemp - tempMin) / (tempMax - tempMin));
    const starY = hrY + hrHeight * (1 - (logLum - lumMin) / (lumMax - lumMin));
    
    ctx.fillStyle = temperatureToColor(star.temperature);
    ctx.beginPath();
    ctx.arc(starX, starY, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = TEXT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(starX, starY, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawStarInfo() {
    const infoX = 20;
    const infoY = 20;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(infoX - 10, infoY - 10, 300, lineH * 10 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(infoX - 10, infoY - 10, 300, lineH * 10 + 20);
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = infoX;
    let y = infoY;
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Stellar Evolution", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "11px monospace";
    
    ctx.fillText(`Initial Mass: ${initialMass.toFixed(1)} M☉`, x, y);
    y += lineH;
    
    ctx.fillText(`Current Mass: ${star.mass.toFixed(2)} M☉`, x, y);
    y += lineH;
    
    ctx.fillText(`Age: ${(star.age / 1000).toFixed(1)} billion years`, x, y);
    y += lineH;
    
    ctx.fillText(`Stage: ${star.stage.replace('_', ' ')}`, x, y);
    y += lineH;
    
    ctx.fillText(`Progress: ${(star.stageProgress * 100).toFixed(0)}%`, x, y);
    y += lineH;
    
    ctx.fillText(`Temperature: ${star.temperature.toFixed(0)} K`, x, y);
    y += lineH;
    
    ctx.fillText(`Luminosity: ${star.luminosity.toExponential(2)} L☉`, x, y);
    y += lineH;
    
    ctx.fillText(`Radius: ${star.radius.toFixed(1)} R☉`, x, y);
    y += lineH;
    
    ctx.fillText(`Time Scale: ${timeScale}x accelerated`, x, y);
  }

  function drawStageDescription() {
    const descX = 20;
    const descY = height - 180;
    const lineH = 16;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(descX - 10, descY - 10, 350, lineH * 8 + 20);
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(descX - 10, descY - 10, 350, lineH * 8 + 20);
    
    const descriptions: Record<StellarStage, string[]> = {
      protostar: [
        "Protostar: Gravitational collapse of gas cloud",
        "• Temperature and pressure rising",
        "• Not yet hot enough for fusion",
        "• Powered by gravitational contraction"
      ],
      main_sequence: [
        "Main Sequence: Hydrogen fusion in core",
        "• Hydrostatic equilibrium achieved",
        "• Converts H → He via pp-chain or CNO cycle", 
        "• Longest lived stellar phase"
      ],
      red_giant: [
        "Red Giant: Core hydrogen exhausted",
        "• Helium core contracts and heats",
        "• Outer layers expand and cool",
        "• Surface becomes red and luminous"
      ],
      horizontal_branch: [
        "Horizontal Branch: Helium core fusion",
        "• Triple-alpha process: 3 He → C",
        "• Core temperature ~100 million K",
        "• Relatively stable helium burning"
      ],
      asymptotic_giant: [
        "Asymptotic Giant Branch: Shell burning",
        "• Helium and hydrogen shells alternate",
        "• Thermal pulses and mass loss",
        "• Creates planetary nebula"
      ],
      white_dwarf: [
        "White Dwarf: Electron degenerate core",
        "• No more fusion reactions",
        "• Supported by electron degeneracy pressure",
        "• Slowly cools over billions of years"
      ],
      neutron_star: [
        "Neutron Star: Collapsed stellar core",
        "• Density ~10¹⁵ g/cm³",
        "• Supported by neutron degeneracy",
        "• May become pulsar with magnetic field"
      ],
      black_hole: [
        "Black Hole: Gravitational collapse",
        "• Escape velocity > speed of light",
        "• Event horizon formed",
        "• May have accretion disk"
      ],
      supernova: [
        "Supernova: Explosive stellar death",
        "• Core collapse triggers explosion",
        "• Outshines entire galaxy briefly",
        "• Disperses heavy elements to space"
      ]
    };
    
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = descX;
    let y = descY;
    
    const stageDesc = descriptions[star.stage];
    for (let i = 0; i < Math.min(stageDesc.length, 8); i++) {
      if (i === 0) {
        ctx.fillStyle = TEXT_COLOR;
      } else {
        ctx.fillStyle = TEXT_DIM;
      }
      
      ctx.font = i === 0 ? "12px monospace" : "11px monospace";
      ctx.fillText(stageDesc[i], x, y);
      y += lineH;
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      
      initializeStar();
    },

    update(dt: number, params: Record<string, number>) {
      const newMass = params.initialMass ?? initialMass;
      if (Math.abs(newMass - initialMass) > 0.1) {
        initialMass = Math.max(0.1, Math.min(50, newMass));
        initializeStar();
      }
      
      timeScale = params.timeScale ?? timeScale;
      showHRDiagram = (params.showHRDiagram ?? 1) > 0.5;
      
      time += dt;
      updateStellarEvolution(dt);
    },

    render() {
      // Deep space background
      const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height));
      gradient.addColorStop(0, "#001122");
      gradient.addColorStop(1, "#000000");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Stars background
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 50; i++) {
        const x = (i * 137.5) % width;
        const y = (i * 149.3) % height;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1 + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw main star
      drawStar();
      
      // Draw H-R diagram
      drawHRDiagram();
      
      // Draw information panels
      drawStarInfo();
      drawStageDescription();
    },

    reset() {
      time = 0;
      initializeStar();
    },

    destroy() {
      evolutionHistory.length = 0;
    },

    getStateDescription(): string {
      const ageGyr = star.age / 1000;
      const stagePercent = star.stageProgress * 100;
      
      return (
        `Stellar Lifecycle: ${initialMass.toFixed(1)} solar mass star in ${star.stage.replace('_', ' ')} phase. ` +
        `Age: ${ageGyr.toFixed(2)} billion years, ${stagePercent.toFixed(0)}% through current stage. ` +
        `Current properties - Mass: ${star.mass.toFixed(2)} M☉, Temperature: ${star.temperature.toFixed(0)} K, ` +
        `Luminosity: ${star.luminosity.toExponential(1)} L☉, Radius: ${star.radius.toFixed(1)} R☉. ` +
        `Evolution path determined by initial mass: low mass → white dwarf, high mass → neutron star/black hole. ` +
        `${star.stage === 'main_sequence' ? 'Burning hydrogen to helium in core via nuclear fusion.' :
          star.stage === 'red_giant' ? 'Core hydrogen exhausted, outer layers expanding.' :
          star.stage === 'supernova' ? 'Explosive stellar death dispersing heavy elements.' :
          star.stage === 'white_dwarf' ? 'Cooling stellar remnant supported by electron degeneracy.' :
          star.stage === 'neutron_star' ? 'Ultra-dense remnant from core collapse.' :
          star.stage === 'black_hole' ? 'Gravitational collapse beyond event horizon.' :
          'Stellar evolution in progress.'} Time accelerated ${timeScale}x.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default StellarLifecycle;