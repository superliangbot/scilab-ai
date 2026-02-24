import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface ThermalObject {
  x: number;
  y: number;
  width: number;
  height: number;
  temperature: number; // in Kelvin
  emissivity: number;
  absorptivity: number;
  mass: number;
  specificHeat: number;
  name: string;
  color: string;
}

interface RadiationRay {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  power: number;
  wavelength: number;
  age: number;
}

const HeatTransferRadiationFactory: SimulationFactory = () => {
  const config = getSimConfig("heat-transfer-radiation") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let object1Temp = 500; // K
  let object2Temp = 300; // K
  let emissivity1 = 0.8;
  let emissivity2 = 0.9;
  let showRays = 1;
  let showSpectrum = 1;
  let environmentTemp = 293; // K (room temperature)

  // Stefan-Boltzmann constant (W⋅m⁻²⋅K⁻⁴)
  const SIGMA = 5.67e-8;

  // Objects
  let object1: ThermalObject;
  let object2: ThermalObject;
  let radiationRays: RadiationRay[] = [];
  
  // History for graphing
  let temperatureHistory: { time: number; temp1: number; temp2: number }[] = [];
  let spectrumData: { wavelength: number; intensity: number }[] = [];

  function initializeObjects() {
    object1 = {
      x: W * 0.2,
      y: H * 0.4,
      width: 80,
      height: 120,
      temperature: object1Temp,
      emissivity: emissivity1,
      absorptivity: emissivity1, // Kirchhoff's law: α = ε
      mass: 2, // kg
      specificHeat: 500, // J/(kg⋅K)
      name: "Hot Object",
      color: "#ef4444",
    };
    
    object2 = {
      x: W * 0.7,
      y: H * 0.4,
      width: 80,
      height: 120,
      temperature: object2Temp,
      emissivity: emissivity2,
      absorptivity: emissivity2,
      mass: 2, // kg
      specificHeat: 500, // J/(kg⋅K)
      name: "Cool Object",
      color: "#3b82f6",
    };
    
    radiationRays = [];
    temperatureHistory = [];
  }

  function temperatureToColor(temp: number): string {
    // Convert temperature to visible color representation
    // This is a simplified approach for visualization
    
    if (temp < 300) return "#1e3a8a"; // Cold - dark blue
    if (temp < 400) return "#3b82f6"; // Cool - blue
    if (temp < 500) return "#10b981"; // Moderate - green
    if (temp < 600) return "#f59e0b"; // Warm - yellow/orange
    if (temp < 800) return "#ef4444"; // Hot - red
    if (temp < 1200) return "#dc2626"; // Very hot - dark red
    return "#fbbf24"; // Extremely hot - yellow-white
  }

  function blackBodyIntensity(wavelength: number, temperature: number): number {
    // Planck's law: B(λ,T) = (2hc²/λ⁵) × 1/(e^(hc/λkT) - 1)
    const h = 6.626e-34; // Planck constant
    const c = 3e8; // Speed of light
    const k = 1.381e-23; // Boltzmann constant
    
    const wl = wavelength * 1e-6; // Convert μm to m
    const numerator = 2 * h * c * c / Math.pow(wl, 5);
    const exponent = (h * c) / (wl * k * temperature);
    const denominator = Math.exp(exponent) - 1;
    
    return numerator / denominator;
  }

  function wienDisplacementLaw(temperature: number): number {
    // λ_max = b/T where b = 2.898×10⁻³ m⋅K
    const b = 2.898e-3;
    return (b / temperature) * 1e6; // Convert to μm
  }

  function stefanBoltzmannLaw(temperature: number, emissivity: number, area: number): number {
    // Power radiated: P = εσAT⁴
    return emissivity * SIGMA * area * Math.pow(temperature, 4);
  }

  function updateHeatTransfer(dt: number) {
    // Calculate surface areas (assuming cylindrical objects for simplicity)
    const area1 = object1.width * object1.height / 10000; // Convert px² to m²
    const area2 = object2.width * object2.height / 10000;
    
    // Power radiated by each object (Stefan-Boltzmann law)
    const power1Radiated = stefanBoltzmannLaw(object1.temperature, object1.emissivity, area1);
    const power2Radiated = stefanBoltzmannLaw(object2.temperature, object2.emissivity, area2);
    
    // Power radiated to environment
    const environmentArea = 1; // Assume large environment
    const power1ToEnvironment = stefanBoltzmannLaw(object1.temperature, object1.emissivity, area1) - 
                                stefanBoltzmannLaw(environmentTemp, 1.0, area1) * object1.absorptivity;
    const power2ToEnvironment = stefanBoltzmannLaw(object2.temperature, object2.emissivity, area2) - 
                                stefanBoltzmannLaw(environmentTemp, 1.0, area2) * object2.absorptivity;
    
    // View factors (simplified - assume objects can "see" each other)
    const distance = Math.abs(object2.x - object1.x);
    const viewFactor = Math.min(0.3, 1000 / (distance * distance)); // Simplified view factor
    
    // Net radiative heat transfer between objects
    const netPower12 = viewFactor * SIGMA * area1 * area2 / (area1 + area2) * 
                       (Math.pow(object1.temperature, 4) - Math.pow(object2.temperature, 4));
    
    // Temperature changes (Q = mcΔT, so ΔT = Q/(mc))
    const tempChange1 = -dt * (power1ToEnvironment + netPower12) / (object1.mass * object1.specificHeat);
    const tempChange2 = -dt * (power2ToEnvironment - netPower12) / (object2.mass * object2.specificHeat);
    
    object1.temperature += tempChange1;
    object2.temperature += tempChange2;
    
    // Prevent unphysical temperatures
    object1.temperature = Math.max(50, object1.temperature); // Absolute minimum
    object2.temperature = Math.max(50, object2.temperature);
    
    // Update colors based on temperature
    object1.color = temperatureToColor(object1.temperature);
    object2.color = temperatureToColor(object2.temperature);
    
    // Store history
    if (temperatureHistory.length > 300) temperatureHistory.shift();
    temperatureHistory.push({
      time: time,
      temp1: object1.temperature,
      temp2: object2.temperature
    });
    
    // Generate radiation rays for visualization
    if (showRays && radiationRays.length < 20) {
      if (Math.random() < 0.3) {
        createRadiationRay(object1, object2);
      }
      if (Math.random() < 0.2) {
        createRadiationRay(object2, object1);
      }
    }
    
    // Update existing rays
    for (let i = radiationRays.length - 1; i >= 0; i--) {
      const ray = radiationRays[i];
      ray.age += dt;
      if (ray.age > 2) {
        radiationRays.splice(i, 1);
      }
    }
    
    // Generate spectrum data for current object1 temperature
    if (Math.floor(time * 10) % 10 === 0) { // Update every 0.1 seconds
      updateSpectrum(object1.temperature);
    }
  }

  function createRadiationRay(source: ThermalObject, target: ThermalObject) {
    const wavelength = wienDisplacementLaw(source.temperature);
    const power = stefanBoltzmannLaw(source.temperature, source.emissivity, 0.01); // Small area sample
    
    radiationRays.push({
      x1: source.x + source.width / 2 + (Math.random() - 0.5) * source.width,
      y1: source.y + source.height / 2 + (Math.random() - 0.5) * source.height,
      x2: target.x + target.width / 2 + (Math.random() - 0.5) * target.width,
      y2: target.y + target.height / 2 + (Math.random() - 0.5) * target.height,
      power: power,
      wavelength: wavelength,
      age: 0,
    });
  }

  function updateSpectrum(temperature: number) {
    spectrumData = [];
    // Generate spectrum from 0.5 to 20 μm
    for (let wl = 0.5; wl <= 20; wl += 0.2) {
      const intensity = blackBodyIntensity(wl, temperature);
      spectrumData.push({ wavelength: wl, intensity: intensity });
    }
  }

  function wavelengthToRGB(wavelength: number): string {
    // Convert wavelength in μm to visible color
    const wl_nm = wavelength * 1000; // Convert to nm
    
    if (wl_nm < 380 || wl_nm > 750) return "#888888"; // IR/UV - gray
    
    let r = 0, g = 0, b = 0;
    
    if (wl_nm >= 380 && wl_nm < 440) {
      r = -(wl_nm - 440) / (440 - 380);
      b = 1;
    } else if (wl_nm >= 440 && wl_nm < 490) {
      g = (wl_nm - 440) / (490 - 440);
      b = 1;
    } else if (wl_nm >= 490 && wl_nm < 510) {
      g = 1;
      b = -(wl_nm - 510) / (510 - 490);
    } else if (wl_nm >= 510 && wl_nm < 580) {
      r = (wl_nm - 510) / (580 - 510);
      g = 1;
    } else if (wl_nm >= 580 && wl_nm < 645) {
      r = 1;
      g = -(wl_nm - 645) / (645 - 580);
    } else if (wl_nm >= 645 && wl_nm <= 750) {
      r = 1;
    }
    
    // Convert to hex
    const ri = Math.round(r * 255);
    const gi = Math.round(g * 255);
    const bi = Math.round(b * 255);
    
    return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`;
  }

  function drawThermalObject(obj: ThermalObject) {
    // Object body with temperature-based gradient
    const gradient = ctx.createRadialGradient(
      obj.x + obj.width * 0.3, obj.y + obj.height * 0.3, 0,
      obj.x + obj.width * 0.5, obj.y + obj.height * 0.5, Math.max(obj.width, obj.height)
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.3, obj.color);
    gradient.addColorStop(1, obj.color + "80");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    
    // Temperature indicator
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${obj.temperature.toFixed(0)}K`, obj.x + obj.width / 2, obj.y + obj.height / 2);
    
    // Object label
    ctx.fillStyle = obj.color;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(obj.name, obj.x + obj.width / 2, obj.y - 15);
    
    // Emissivity
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.fillText(`ε = ${obj.emissivity.toFixed(2)}`, obj.x + obj.width / 2, obj.y - 5);
    
    // Heat glow effect for hot objects
    if (obj.temperature > 400) {
      const glowIntensity = Math.min((obj.temperature - 400) / 400, 1);
      const glowSize = 20 + glowIntensity * 30;
      
      ctx.fillStyle = `rgba(255, 165, 0, ${glowIntensity * 0.3})`;
      ctx.beginPath();
      ctx.arc(obj.x + obj.width / 2, obj.y + obj.height / 2, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRadiationRays() {
    if (!showRays) return;
    
    for (const ray of radiationRays) {
      const alpha = Math.max(0.1, 1 - ray.age / 2);
      const color = wavelengthToRGB(ray.wavelength);
      
      ctx.strokeStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 2 + ray.power * 1e6; // Scale line width by power
      
      ctx.beginPath();
      ctx.moveTo(ray.x1, ray.y1);
      ctx.lineTo(ray.x2, ray.y2);
      ctx.stroke();
      
      // Arrow head
      const angle = Math.atan2(ray.y2 - ray.y1, ray.x2 - ray.x1);
      const arrowSize = 8;
      
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(ray.x2, ray.y2);
      ctx.lineTo(ray.x2 - arrowSize * Math.cos(angle - 0.3), ray.y2 - arrowSize * Math.sin(angle - 0.3));
      ctx.lineTo(ray.x2 - arrowSize * Math.cos(angle + 0.3), ray.y2 - arrowSize * Math.sin(angle + 0.3));
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTemperatureGraph() {
    const graphX = W * 0.05;
    const graphY = H * 0.65;
    const graphW = W * 0.4;
    const graphH = H * 0.3;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Temperature vs Time", graphX + graphW / 2, graphY + 15);
    
    if (temperatureHistory.length > 1) {
      const minTemp = Math.min(...temperatureHistory.map(h => Math.min(h.temp1, h.temp2)));
      const maxTemp = Math.max(...temperatureHistory.map(h => Math.max(h.temp1, h.temp2)));
      const tempRange = maxTemp - minTemp || 1;
      
      const minTime = Math.min(...temperatureHistory.map(h => h.time));
      const maxTime = Math.max(...temperatureHistory.map(h => h.time));
      const timeRange = maxTime - minTime || 1;
      
      // Object 1 temperature
      ctx.strokeStyle = object1.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < temperatureHistory.length; i++) {
        const point = temperatureHistory[i];
        const x = graphX + 20 + ((point.time - minTime) / timeRange) * (graphW - 40);
        const y = graphY + graphH - 20 - ((point.temp1 - minTemp) / tempRange) * (graphH - 40);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Object 2 temperature
      ctx.strokeStyle = object2.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < temperatureHistory.length; i++) {
        const point = temperatureHistory[i];
        const x = graphX + 20 + ((point.time - minTime) / timeRange) * (graphW - 40);
        const y = graphY + graphH - 20 - ((point.temp2 - minTemp) / tempRange) * (graphH - 40);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Legend
      ctx.fillStyle = object1.color;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Hot Object", graphX + 5, graphY + 30);
      
      ctx.fillStyle = object2.color;
      ctx.fillText("Cool Object", graphX + 5, graphY + 45);
    }
  }

  function drawBlackBodySpectrum() {
    if (!showSpectrum || spectrumData.length === 0) return;
    
    const spectrumX = W * 0.5;
    const spectrumY = H * 0.65;
    const spectrumW = W * 0.45;
    const spectrumH = H * 0.3;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(spectrumX, spectrumY, spectrumW, spectrumH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(spectrumX, spectrumY, spectrumW, spectrumH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Black Body Spectrum", spectrumX + spectrumW / 2, spectrumY + 15);
    ctx.fillText(`T = ${object1.temperature.toFixed(0)}K`, spectrumX + spectrumW / 2, spectrumY + 30);
    
    // Find peak wavelength and intensity
    const peakWavelength = wienDisplacementLaw(object1.temperature);
    const maxIntensity = Math.max(...spectrumData.map(d => d.intensity));
    
    // Draw spectrum curve
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < spectrumData.length; i++) {
      const point = spectrumData[i];
      const x = spectrumX + 20 + ((point.wavelength - 0.5) / 19.5) * (spectrumW - 40);
      const y = spectrumY + spectrumH - 20 - (point.intensity / maxIntensity) * (spectrumH - 50);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Mark peak wavelength
    const peakX = spectrumX + 20 + ((peakWavelength - 0.5) / 19.5) * (spectrumW - 40);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(peakX, spectrumY + 35);
    ctx.lineTo(peakX, spectrumY + spectrumH - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = "#ef4444";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`λ_max = ${peakWavelength.toFixed(1)}μm`, peakX, spectrumY + 50);
    
    // Axes labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Wavelength (μm)", spectrumX + spectrumW / 2, spectrumY + spectrumH - 5);
    
    ctx.save();
    ctx.translate(spectrumX + 10, spectrumY + spectrumH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Intensity", 0, 0);
    ctx.restore();
    
    // Wien's displacement law
    ctx.fillStyle = "#10b981";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Wien's Law: λ_max = 2898/T", spectrumX + 5, spectrumY + spectrumH - 25);
  }

  function drawInfoPanel() {
    const panelX = W * 0.02;
    const panelY = H * 0.02;
    const panelW = W * 0.3;
    const panelH = H * 0.35;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    
    ctx.fillText("Heat Transfer by Radiation", panelX + 10, infoY);
    infoY += 25;
    
    // Stefan-Boltzmann Law
    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px monospace";
    ctx.fillText("Stefan-Boltzmann Law:", panelX + 10, infoY);
    infoY += 18;
    ctx.fillText("P = εσAT⁴", panelX + 10, infoY);
    infoY += 18;
    ctx.fillText(`σ = ${SIGMA.toExponential(2)} W/(m²K⁴)`, panelX + 10, infoY);
    infoY += 25;
    
    // Current power calculations
    const area1 = object1.width * object1.height / 10000;
    const area2 = object2.width * object2.height / 10000;
    const power1 = stefanBoltzmannLaw(object1.temperature, object1.emissivity, area1);
    const power2 = stefanBoltzmannLaw(object2.temperature, object2.emissivity, area2);
    
    ctx.fillStyle = object1.color;
    ctx.font = "11px monospace";
    ctx.fillText(`Hot Object:`, panelX + 10, infoY);
    infoY += 15;
    ctx.fillText(`  T = ${object1.temperature.toFixed(1)} K`, panelX + 10, infoY);
    infoY += 15;
    ctx.fillText(`  P = ${power1.toExponential(2)} W`, panelX + 10, infoY);
    infoY += 15;
    
    const peak1 = wienDisplacementLaw(object1.temperature);
    ctx.fillText(`  λ_max = ${peak1.toFixed(1)} μm`, panelX + 10, infoY);
    infoY += 20;
    
    ctx.fillStyle = object2.color;
    ctx.fillText(`Cool Object:`, panelX + 10, infoY);
    infoY += 15;
    ctx.fillText(`  T = ${object2.temperature.toFixed(1)} K`, panelX + 10, infoY);
    infoY += 15;
    ctx.fillText(`  P = ${power2.toExponential(2)} W`, panelX + 10, infoY);
    infoY += 15;
    
    const peak2 = wienDisplacementLaw(object2.temperature);
    ctx.fillText(`  λ_max = ${peak2.toFixed(1)} μm`, panelX + 10, infoY);
    infoY += 20;
    
    // Net heat transfer
    const netPower = power1 - power2;
    ctx.fillStyle = netPower > 0 ? "#ef4444" : "#3b82f6";
    ctx.fillText(`Net Power: ${netPower.toExponential(2)} W`, panelX + 10, infoY);
    infoY += 15;
    
    if (Math.abs(object1.temperature - object2.temperature) < 10) {
      ctx.fillStyle = "#10b981";
      ctx.fillText("Approaching equilibrium!", panelX + 10, infoY);
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeObjects();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      object1Temp = params.object1Temp ?? object1Temp;
      object2Temp = params.object2Temp ?? object2Temp;
      emissivity1 = Math.max(0.01, Math.min(1.0, params.emissivity1 ?? emissivity1));
      emissivity2 = Math.max(0.01, Math.min(1.0, params.emissivity2 ?? emissivity2));
      showRays = Math.round(params.showRays ?? showRays);
      showSpectrum = Math.round(params.showSpectrum ?? showSpectrum);
      environmentTemp = params.environmentTemp ?? environmentTemp;
      
      // Update object properties
      if (Math.abs(object1.temperature - object1Temp) > 50) {
        // Reset if temperature changed significantly
        object1.temperature = object1Temp;
      }
      if (Math.abs(object2.temperature - object2Temp) > 50) {
        object2.temperature = object2Temp;
      }
      
      object1.emissivity = emissivity1;
      object1.absorptivity = emissivity1;
      object2.emissivity = emissivity2;
      object2.absorptivity = emissivity2;
      
      time += dt;
      updateHeatTransfer(dt);
    },

    render() {
      if (!ctx) return;

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Heat Transfer by Radiation", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Stefan-Boltzmann Law & Black Body Radiation", W / 2, 50);

      // Draw environment temperature indicator
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`Environment: ${environmentTemp.toFixed(0)}K`, W - 10, 25);

      // Draw objects and radiation
      drawThermalObject(object1);
      drawThermalObject(object2);
      drawRadiationRays();
      
      // Draw analysis panels
      drawInfoPanel();
      drawTemperatureGraph();
      if (showSpectrum) {
        drawBlackBodySpectrum();
      }

      // Show laws and equations
      ctx.fillStyle = "#8b5cf6";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Wien's Displacement Law: λ_max T = 2.898×10⁻³ m⋅K", W / 2, H - 35);
      ctx.fillText("Planck's Law: B(λ,T) = (2hc²/λ⁵) × 1/(e^(hc/λkT) - 1)", W / 2, H - 20);
      ctx.fillText("Kirchhoff's Law: α = ε (absorptivity = emissivity)", W / 2, H - 5);
    },

    reset() {
      time = 0;
      initializeObjects();
    },

    destroy() {},

    getStateDescription(): string {
      const area1 = object1.width * object1.height / 10000;
      const area2 = object2.width * object2.height / 10000;
      const power1 = stefanBoltzmannLaw(object1.temperature, object1.emissivity, area1);
      const power2 = stefanBoltzmannLaw(object2.temperature, object2.emissivity, area2);
      const peak1 = wienDisplacementLaw(object1.temperature);
      const peak2 = wienDisplacementLaw(object2.temperature);
      
      return `Heat transfer by radiation: Hot object at ${object1.temperature.toFixed(0)}K (ε=${emissivity1.toFixed(2)}, λ_max=${peak1.toFixed(1)}μm) ` +
             `radiating ${power1.toExponential(2)}W. Cool object at ${object2.temperature.toFixed(0)}K (ε=${emissivity2.toFixed(2)}, λ_max=${peak2.toFixed(1)}μm) ` +
             `radiating ${power2.toExponential(2)}W. Net power transfer: ${(power1-power2).toExponential(2)}W. ` +
             `Demonstrates Stefan-Boltzmann law (P∝T⁴), Wien's displacement law, and black body radiation spectra.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default HeatTransferRadiationFactory;