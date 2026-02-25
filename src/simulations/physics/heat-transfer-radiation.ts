import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Heat Transfer by Radiation: Stefan-Boltzmann Law
 * Demonstrates:
 * - Thermal radiation: P = εσAT⁴
 * - Blackbody spectrum and Wien's displacement law
 * - Emissivity effects on radiation
 * - Heat exchange between objects at different temperatures
 * - Visual representation of infrared radiation
 */

interface ThermalObject {
  x: number;
  y: number;
  width: number;
  height: number;
  temperature: number; // Kelvin
  emissivity: number;
  mass: number; // kg
  specificHeat: number; // J/(kg·K)
  color: string;
  name: string;
}

interface RadiationPhoton {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wavelength: number; // micrometers
  energy: number; // relative
  sourceTemp: number;
  life: number;
}

const HeatTransferRadiationFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("heat-transfer-radiation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical constants
  const sigma = 5.67e-8; // Stefan-Boltzmann constant W/(m²·K⁴)
  const wien = 2.898e-3; // Wien's displacement constant (m·K)
  const h = 6.626e-34; // Planck's constant
  const c = 3e8; // speed of light
  const k = 1.381e-23; // Boltzmann constant

  // Simulation parameters
  let environmentTemp = 293; // K (20°C)
  let showSpectrum = 1;
  let showPhotons = 1;
  let timeScale = 10; // simulation speed multiplier

  // Objects in the scene
  let objects: ThermalObject[] = [];
  let radiationPhotons: RadiationPhoton[] = [];
  
  // Temperature history for graphing
  let tempHistory: Array<{time: number, temps: number[]}> = [];
  const MAX_HISTORY = 100;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    
    setupObjects();
    radiationPhotons = [];
    tempHistory = [];
  }

  function setupObjects(): void {
    objects = [
      {
        x: width * 0.2,
        y: height * 0.4,
        width: 60,
        height: 80,
        temperature: 373, // 100°C (hot water)
        emissivity: 0.95,
        mass: 1.0,
        specificHeat: 4186, // water
        color: "#ef4444",
        name: "Hot Object"
      },
      {
        x: width * 0.6,
        y: height * 0.45,
        width: 80,
        height: 60,
        temperature: 273, // 0°C (ice)
        emissivity: 0.97,
        mass: 0.5,
        specificHeat: 2090, // ice
        color: "#3b82f6",
        name: "Cold Object"
      }
    ];
  }

  function update(dt: number, params: Record<string, number>): void {
    environmentTemp = (params.environmentTemp ?? 20) + 273.15; // Convert °C to K
    showSpectrum = params.showSpectrum ?? 1;
    showPhotons = params.showPhotons ?? 1;
    timeScale = params.timeScale ?? 10;

    // Update object temperatures if parameters changed
    if (params.hotTemp !== undefined) {
      objects[0].temperature = (params.hotTemp ?? 100) + 273.15;
    }
    if (params.coldTemp !== undefined) {
      objects[1].temperature = (params.coldTemp ?? 0) + 273.15;
    }
    if (params.emissivity !== undefined) {
      objects.forEach(obj => obj.emissivity = params.emissivity ?? 0.95);
    }

    const step = dt * timeScale;
    time += step;

    // Calculate heat transfer and temperature evolution
    updateTemperatures(step);
    generateRadiationPhotons(step);
    updatePhotons(step);

    // Record temperature history
    if (Math.floor(time * 4) > tempHistory.length) {
      tempHistory.push({
        time: time,
        temps: objects.map(obj => obj.temperature - 273.15) // Convert to °C
      });
      
      if (tempHistory.length > MAX_HISTORY) {
        tempHistory.shift();
      }
    }
  }

  function updateTemperatures(dt: number): void {
    const area = 0.01; // m² (assumed surface area)

    objects.forEach((obj, i) => {
      // Radiation to environment (Stefan-Boltzmann law)
      const powerToEnv = obj.emissivity * sigma * area * 
                        (Math.pow(obj.temperature, 4) - Math.pow(environmentTemp, 4));

      // Heat exchange with other objects
      let powerFromOthers = 0;
      objects.forEach((other, j) => {
        if (i !== j) {
          // View factor approximation (simplified)
          const distance = Math.sqrt(Math.pow(obj.x - other.x, 2) + Math.pow(obj.y - other.y, 2));
          const viewFactor = Math.max(0.001, 1 / (distance * distance)) * 10000;
          
          const powerExchange = obj.emissivity * other.emissivity * sigma * area * viewFactor *
                               (Math.pow(other.temperature, 4) - Math.pow(obj.temperature, 4));
          powerFromOthers += powerExchange;
        }
      });

      // Total power change
      const totalPower = -powerToEnv + powerFromOthers;

      // Temperature change: Q = mcΔT
      const deltaT = (totalPower * dt) / (obj.mass * obj.specificHeat);
      obj.temperature += deltaT;

      // Prevent temperatures below absolute zero
      obj.temperature = Math.max(1, obj.temperature);
    });
  }

  function generateRadiationPhotons(dt: number): void {
    if (!showPhotons) return;

    objects.forEach(obj => {
      // Generate photons based on temperature (higher T = more photons)
      const photonRate = Math.pow(obj.temperature / 300, 4) * 5; // photons per second
      
      if (Math.random() < photonRate * dt && radiationPhotons.length < 100) {
        // Wien's displacement law for peak wavelength
        const peakWavelength = wien / obj.temperature * 1e6; // micrometers

        // Sample from blackbody spectrum (approximation)
        const wavelength = peakWavelength * (0.5 + Math.random() * 2);
        
        // Photon position and direction
        const angle = Math.random() * 2 * Math.PI;
        const speed = 100; // visual speed
        
        radiationPhotons.push({
          x: obj.x + obj.width/2,
          y: obj.y + obj.height/2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          wavelength,
          energy: planckFunction(wavelength * 1e-6, obj.temperature),
          sourceTemp: obj.temperature,
          life: 0
        });
      }
    });
  }

  function updatePhotons(dt: number): void {
    for (let i = radiationPhotons.length - 1; i >= 0; i--) {
      const photon = radiationPhotons[i];
      
      photon.x += photon.vx * dt;
      photon.y += photon.vy * dt;
      photon.life += dt;

      // Remove photons that are off-screen or too old
      if (photon.x < 0 || photon.x > width || 
          photon.y < 0 || photon.y > height || 
          photon.life > 3) {
        radiationPhotons.splice(i, 1);
      }
    }
  }

  function planckFunction(wavelength: number, temperature: number): number {
    // Simplified Planck's law for relative intensity
    const exp_term = Math.exp((h * c) / (wavelength * k * temperature));
    return 1 / (Math.pow(wavelength, 5) * (exp_term - 1));
  }

  function wavelengthToColor(wavelength: number): string {
    // Map infrared wavelengths to visible colors for visualization
    // Most thermal radiation is infrared (> 0.7 μm)
    
    if (wavelength < 0.38) {
      return "#8b5cf6"; // UV as purple
    } else if (wavelength < 0.45) {
      return "#3b82f6"; // Blue
    } else if (wavelength < 0.55) {
      return "#10b981"; // Green  
    } else if (wavelength < 0.65) {
      return "#f59e0b"; // Yellow
    } else if (wavelength < 0.75) {
      return "#ef4444"; // Red
    } else {
      // Infrared - show as heat colors
      const intensity = Math.max(0, 1 - (wavelength - 0.75) / 20);
      const r = Math.round(255 * intensity);
      const g = Math.round(100 * intensity);
      return `rgb(${r}, ${g}, 0)`;
    }
  }

  function drawObjects(): void {
    objects.forEach((obj, index) => {
      // Object body
      const tempRatio = (obj.temperature - 273) / 200; // 0-200°C range
      const heatColor = `hsl(${60 - tempRatio * 60}, 85%, 55%)`; // Blue to red
      
      const objGrad = ctx.createRadialGradient(
        obj.x + obj.width/2, obj.y + obj.height/2, 0,
        obj.x + obj.width/2, obj.y + obj.height/2, Math.max(obj.width, obj.height)/2
      );
      objGrad.addColorStop(0, heatColor);
      objGrad.addColorStop(1, obj.color);

      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.width, obj.height, 8);
      ctx.fillStyle = objGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Temperature display
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        `${(obj.temperature - 273.15).toFixed(1)}°C`,
        obj.x + obj.width/2,
        obj.y + obj.height/2
      );

      // Object name
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(obj.name, obj.x + obj.width/2, obj.y - 8);

      // Radiation glow effect based on temperature
      if (obj.temperature > environmentTemp + 10) {
        const glowRadius = (obj.temperature - environmentTemp) * 0.5;
        const glowGrad = ctx.createRadialGradient(
          obj.x + obj.width/2, obj.y + obj.height/2, 0,
          obj.x + obj.width/2, obj.y + obj.height/2, glowRadius
        );
        glowGrad.addColorStop(0, `rgba(255, 100, 0, 0.3)`);
        glowGrad.addColorStop(1, `rgba(255, 100, 0, 0)`);

        ctx.beginPath();
        ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }
    });
  }

  function drawRadiationPhotons(): void {
    if (!showPhotons) return;

    radiationPhotons.forEach(photon => {
      const color = wavelengthToColor(photon.wavelength);
      const alpha = Math.max(0, 1 - photon.life / 3);

      ctx.beginPath();
      ctx.arc(photon.x, photon.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();

      // Add glow for high-energy photons
      if (photon.energy > 0.5) {
        ctx.beginPath();
        ctx.arc(photon.x, photon.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.round(alpha * 100).toString(16).padStart(2, '0');
        ctx.fill();
      }
    });
  }

  function drawBlackbodySpectrum(): void {
    if (!showSpectrum) return;

    const spectrumX = width * 0.05;
    const spectrumY = height * 0.05;
    const spectrumW = width * 0.35;
    const spectrumH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(spectrumX, spectrumY, spectrumW, spectrumH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Blackbody Spectrum", spectrumX + spectrumW/2, spectrumY + 18);

    // Plot area
    const plotX = spectrumX + 30;
    const plotY = spectrumY + 25;
    const plotW = spectrumW - 50;
    const plotH = spectrumH - 40;

    // Wavelength range (0.1 to 20 micrometers)
    const minWave = 0.1;
    const maxWave = 20;

    // Plot spectrum for each object
    objects.forEach((obj, index) => {
      const color = index === 0 ? "#ef4444" : "#3b82f6";
      
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      let maxIntensity = 0;
      
      // Find max intensity for normalization
      for (let i = 0; i <= 100; i++) {
        const wave = minWave + (i/100) * (maxWave - minWave);
        const intensity = planckFunction(wave * 1e-6, obj.temperature);
        maxIntensity = Math.max(maxIntensity, intensity);
      }

      for (let i = 0; i <= 100; i++) {
        const wave = minWave + (i/100) * (maxWave - minWave);
        const intensity = planckFunction(wave * 1e-6, obj.temperature);
        
        const screenX = plotX + (i/100) * plotW;
        const screenY = plotY + plotH - (intensity / maxIntensity) * plotH;
        
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      // Wien's displacement peak
      const peakWave = wien / obj.temperature * 1e6;
      if (peakWave >= minWave && peakWave <= maxWave) {
        const peakX = plotX + ((peakWave - minWave) / (maxWave - minWave)) * plotW;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(peakX, plotY);
        ctx.lineTo(peakX, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Peak wavelength label
        ctx.fillStyle = color;
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${peakWave.toFixed(1)}μm`, peakX, plotY - 3);
      }
    });

    // Axes labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Wavelength (μm)", plotX + plotW/2, plotY + plotH + 15);
    
    ctx.save();
    ctx.translate(plotX - 20, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Intensity", 0, 0);
    ctx.restore();

    // Wavelength scale
    ctx.textAlign = "center";
    [0.1, 1, 5, 10, 20].forEach(wave => {
      const x = plotX + ((wave - minWave) / (maxWave - minWave)) * plotW;
      ctx.fillText(wave.toString(), x, plotY + plotH + 12);
    });
  }

  function drawTemperatureGraph(): void {
    const graphX = width * 0.05;
    const graphY = height * 0.65;
    const graphW = width * 0.35;
    const graphH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(graphX, graphY, graphW, graphH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature vs Time", graphX + graphW/2, graphY + 18);

    if (tempHistory.length < 2) return;

    // Plot area
    const plotX = graphX + 30;
    const plotY = graphY + 25;
    const plotW = graphW - 50;
    const plotH = graphH - 40;

    // Find temperature range
    let minTemp = Infinity, maxTemp = -Infinity;
    tempHistory.forEach(entry => {
      entry.temps.forEach(temp => {
        minTemp = Math.min(minTemp, temp);
        maxTemp = Math.max(maxTemp, temp);
      });
    });
    const tempRange = Math.max(10, maxTemp - minTemp);
    const timeRange = tempHistory[tempHistory.length - 1].time - tempHistory[0].time;

    // Plot temperature curves
    objects.forEach((obj, objIndex) => {
      const color = objIndex === 0 ? "#ef4444" : "#3b82f6";
      
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      for (let i = 0; i < tempHistory.length; i++) {
        const entry = tempHistory[i];
        const temp = entry.temps[objIndex];
        
        const screenX = plotX + ((entry.time - tempHistory[0].time) / timeRange) * plotW;
        const screenY = plotY + plotH - ((temp - minTemp) / tempRange) * plotH;
        
        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
    });

    // Grid and labels
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = plotY + (i/4) * plotH;
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
    }
    ctx.stroke();

    // Temperature scale
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const temp = maxTemp - (i/4) * tempRange;
      const y = plotY + (i/4) * plotH + 3;
      ctx.fillText(`${temp.toFixed(0)}°C`, plotX - 5, y);
    }
  }

  function drawEquations(): void {
    const eqX = width * 0.55;
    const eqY = height * 0.65;

    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.fillText("Stefan-Boltzmann Law:", eqX, eqY);
    ctx.font = `bold ${Math.max(16, width * 0.02)}px system-ui, sans-serif`;
    ctx.fillText("P = εσAT⁴", eqX, eqY + 25);

    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    
    const lines = [
      "",
      "Wien's Displacement Law:",
      "λmax = b/T",
      "",
      "where:",
      "P = radiated power (W)",
      "ε = emissivity (0-1)",
      "σ = Stefan-Boltzmann constant",
      "A = surface area (m²)",
      "T = absolute temperature (K)",
      "λmax = peak wavelength",
      "b = Wien constant"
    ];

    lines.forEach((line, i) => {
      if (line.includes("Law:")) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
        ctx.font = "bold 12px system-ui, sans-serif";
      } else if (line === "λmax = b/T") {
        ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
        ctx.font = "bold 14px system-ui, sans-serif";
      } else {
        ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
        ctx.font = "11px system-ui, sans-serif";
      }
      
      if (line !== "") {
        ctx.fillText(line, eqX, eqY + 50 + i * 14);
      }
    });
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Draw components
    drawObjects();
    drawRadiationPhotons();
    drawBlackbodySpectrum();
    drawTemperatureGraph();
    drawEquations();

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Heat Transfer by Thermal Radiation", width/2, 25);

    // Environment temperature
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Environment: ${(environmentTemp - 273.15).toFixed(1)}°C`, width - 20, height - 10);

    // Time display
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)} s`, 20, height - 10);
  }

  function reset(): void {
    time = 0;
    setupObjects();
    radiationPhotons = [];
    tempHistory = [];
  }

  function destroy(): void {
    radiationPhotons = [];
    tempHistory = [];
  }

  function getStateDescription(): string {
    const obj1Temp = objects[0].temperature - 273.15;
    const obj2Temp = objects[1].temperature - 273.15;
    const envTemp = environmentTemp - 273.15;

    // Calculate power radiated by hot object
    const area = 0.01; // m²
    const powerHot = objects[0].emissivity * sigma * area * Math.pow(objects[0].temperature, 4);
    const powerCold = objects[1].emissivity * sigma * area * Math.pow(objects[1].temperature, 4);

    return (
      `Heat Transfer by Radiation: Stefan-Boltzmann Law P = εσAT⁴. ` +
      `Hot object: T=${obj1Temp.toFixed(1)}°C, P=${(powerHot/1e3).toFixed(1)}kW/m². ` +
      `Cold object: T=${obj2Temp.toFixed(1)}°C, P=${(powerCold/1e3).toFixed(1)}kW/m². ` +
      `Environment: T=${envTemp.toFixed(1)}°C. ` +
      `Peak wavelengths: λ₁=${(wien/objects[0].temperature*1e6).toFixed(1)}μm, ` +
      `λ₂=${(wien/objects[1].temperature*1e6).toFixed(1)}μm. ` +
      `Demonstrates thermal equilibrium and blackbody radiation principles.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    setupObjects();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default HeatTransferRadiationFactory;