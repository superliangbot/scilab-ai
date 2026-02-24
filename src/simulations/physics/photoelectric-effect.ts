import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

interface Photon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number; // in eV
  wavelength: number;
  active: boolean;
}

interface Electron {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kineticEnergy: number;
  active: boolean;
  age: number;
}

interface Material {
  name: string;
  workFunction: number; // eV
  color: string;
}

const PhotoelectricEffectFactory: SimulationFactory = () => {
  const config = getSimConfig("photoelectric-effect") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let frequency = 600; // THz (1 THz = 10^12 Hz)
  let intensity = 5;
  let materialIndex = 0;
  let showPhotons = 1;
  let voltage = 0; // stopping voltage

  // Simulation state
  let photons: Photon[] = [];
  let electrons: Electron[] = [];
  let emissionTimer = 0;
  let currentMeasurements: { voltage: number; current: number }[] = [];

  // Materials with different work functions
  const materials: Material[] = [
    { name: "Cesium", workFunction: 2.1, color: "#fbbf24" },
    { name: "Potassium", workFunction: 2.3, color: "#8b5cf6" },
    { name: "Sodium", workFunction: 2.4, color: "#ef4444" },
    { name: "Zinc", workFunction: 4.3, color: "#64748b" },
    { name: "Copper", workFunction: 4.7, color: "#f59e0b" },
    { name: "Silver", workFunction: 4.3, color: "#e2e8f0" },
  ];

  // Constants
  const h = 4.136e-15; // Planck's constant in eV⋅s
  const c = 3e8; // Speed of light m/s
  const PLATE_X = W * 0.4;
  const PLATE_Y = H * 0.3;
  const PLATE_HEIGHT = H * 0.4;

  function photonEnergyFromFrequency(freq: number): number {
    // E = hf, frequency in THz
    return h * freq * 1e12; // Convert THz to Hz
  }

  function wavelengthFromFrequency(freq: number): number {
    // λ = c/f, return in nm
    return (c / (freq * 1e12)) * 1e9;
  }

  function frequencyToColor(freq: number): string {
    const wl = wavelengthFromFrequency(freq);
    
    if (wl > 700) return "#ff0000"; // red
    if (wl > 650) return "#ff4500"; // orange-red
    if (wl > 600) return "#ff8c00"; // orange
    if (wl > 580) return "#ffd700"; // yellow
    if (wl > 550) return "#9acd32"; // yellow-green
    if (wl > 500) return "#00ff00"; // green
    if (wl > 450) return "#0000ff"; // blue
    if (wl > 400) return "#4b0082"; // indigo
    return "#8b00ff"; // violet/UV
  }

  function emitPhoton() {
    if (photons.length > 50) return;
    
    const energy = photonEnergyFromFrequency(frequency);
    const wavelength = wavelengthFromFrequency(frequency);
    
    const photon: Photon = {
      x: 50,
      y: PLATE_Y + PLATE_HEIGHT * (0.2 + Math.random() * 0.6),
      vx: 300, // pixels per second
      vy: (Math.random() - 0.5) * 50,
      energy: energy,
      wavelength: wavelength,
      active: true,
    };
    
    photons.push(photon);
  }

  function updatePhotons(dt: number) {
    for (let i = photons.length - 1; i >= 0; i--) {
      const photon = photons[i];
      
      photon.x += photon.vx * dt;
      photon.y += photon.vy * dt;
      
      // Check collision with photocathode
      if (photon.x >= PLATE_X && photon.x <= PLATE_X + 10 && 
          photon.y >= PLATE_Y && photon.y <= PLATE_Y + PLATE_HEIGHT) {
        
        // Photoelectric effect occurs
        attemptPhotoelectricEmission(photon);
        photons.splice(i, 1);
        continue;
      }
      
      // Remove photons that go off screen
      if (photon.x > W + 50) {
        photons.splice(i, 1);
      }
    }
  }

  function attemptPhotoelectricEmission(photon: Photon) {
    const material = materials[materialIndex];
    const workFunction = material.workFunction;
    
    // Check if photon has enough energy: E_photon > Φ (work function)
    if (photon.energy > workFunction) {
      // Emit electron with kinetic energy = E_photon - Φ
      const kineticEnergy = photon.energy - workFunction;
      
      const electron: Electron = {
        x: PLATE_X + 10,
        y: photon.y,
        vx: Math.sqrt(kineticEnergy * 2 * 1.6e-19 / 9.1e-31) * 1e-6, // Convert to pixel velocity
        vy: (Math.random() - 0.5) * 100,
        kineticEnergy: kineticEnergy,
        active: true,
        age: 0,
      };
      
      // Apply stopping voltage effect
      const stoppingForce = voltage * 1.6e-19; // Force from electric field
      if (voltage > 0) {
        // Retarding voltage - slows down electrons
        const decelerationFactor = Math.max(0, 1 - voltage / kineticEnergy);
        electron.vx *= decelerationFactor;
      }
      
      electrons.push(electron);
    }
    // If photon energy < work function, no electron is emitted (no effect)
  }

  function updateElectrons(dt: number) {
    for (let i = electrons.length - 1; i >= 0; i--) {
      const electron = electrons[i];
      
      electron.x += electron.vx * dt;
      electron.y += electron.vy * dt;
      electron.age += dt;
      
      // Apply stopping voltage deceleration
      if (voltage > 0) {
        const deceleration = voltage * 100; // Arbitrary scale
        electron.vx = Math.max(0, electron.vx - deceleration * dt);
      }
      
      // Remove old or off-screen electrons
      if (electron.age > 5 || electron.x > W + 50 || electron.y < -50 || electron.y > H + 50) {
        electrons.splice(i, 1);
      }
    }
  }

  function measureCurrent(): number {
    // Current is proportional to number of electrons reaching the collector
    // (electrons that haven't been stopped by the retarding voltage)
    const activeElectrons = electrons.filter(e => e.vx > 10 && e.x > PLATE_X + 100);
    return activeElectrons.length * 0.1; // Arbitrary current scale
  }

  function drawPhotocathode() {
    const material = materials[materialIndex];
    
    // Draw photocathode plate
    const gradient = ctx.createLinearGradient(PLATE_X, PLATE_Y, PLATE_X + 20, PLATE_Y);
    gradient.addColorStop(0, material.color);
    gradient.addColorStop(1, material.color + "80");
    
    ctx.fillStyle = gradient;
    ctx.fillRect(PLATE_X, PLATE_Y, 20, PLATE_HEIGHT);
    
    ctx.strokeStyle = material.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(PLATE_X, PLATE_Y, 20, PLATE_HEIGHT);
    
    // Material label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(material.name, PLATE_X + 10, PLATE_Y - 10);
    ctx.fillText(`Φ = ${material.workFunction} eV`, PLATE_X + 10, PLATE_Y - 25);
  }

  function drawCollector() {
    // Draw collector plate
    ctx.fillStyle = "#64748b";
    ctx.fillRect(W * 0.7, PLATE_Y, 15, PLATE_HEIGHT);
    
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.strokeRect(W * 0.7, PLATE_Y, 15, PLATE_HEIGHT);
    
    // Collector label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Collector", W * 0.7 + 7, PLATE_Y - 10);
  }

  function drawPhotons() {
    if (!showPhotons) return;
    
    const color = frequencyToColor(frequency);
    
    for (const photon of photons) {
      // Photon as a wave packet
      ctx.fillStyle = color + "cc";
      ctx.beginPath();
      ctx.arc(photon.x, photon.y, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow effect
      ctx.fillStyle = color + "40";
      ctx.beginPath();
      ctx.arc(photon.x, photon.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawElectrons() {
    ctx.fillStyle = "#22d3ee";
    
    for (const electron of electrons) {
      // Electron trail
      const alpha = Math.max(0.1, 1 - electron.age / 2);
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
      
      ctx.beginPath();
      ctx.arc(electron.x, electron.y, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Velocity indicator
      if (electron.vx > 50) {
        const trailLength = Math.min(electron.vx * 0.1, 20);
        ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(electron.x - trailLength, electron.y);
        ctx.lineTo(electron.x, electron.y);
        ctx.stroke();
      }
    }
  }

  function drawLightSource() {
    const color = frequencyToColor(frequency);
    
    // Light source
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(30, PLATE_Y + PLATE_HEIGHT / 2, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Light rays
    ctx.strokeStyle = color + "80";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const angle = (i - 2) * 0.2;
      const x1 = 42;
      const y1 = PLATE_Y + PLATE_HEIGHT / 2 + angle * 30;
      const x2 = PLATE_X - 20;
      const y2 = PLATE_Y + PLATE_HEIGHT / 2 + angle * 20;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    
    // Source label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Light", 30, PLATE_Y + PLATE_HEIGHT / 2 + 25);
    ctx.fillText("Source", 30, PLATE_Y + PLATE_HEIGHT / 2 + 37);
  }

  function drawVoltageSource() {
    if (Math.abs(voltage) < 0.1) return;
    
    const batteryX = W * 0.55;
    const batteryY = H * 0.8;
    
    // Battery symbol
    ctx.strokeStyle = voltage > 0 ? "#ef4444" : "#10b981";
    ctx.lineWidth = 3;
    
    // Positive terminal (longer line)
    ctx.beginPath();
    ctx.moveTo(batteryX - 15, batteryY);
    ctx.lineTo(batteryX + 15, batteryY);
    ctx.stroke();
    
    // Negative terminal (shorter line)
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(batteryX - 8, batteryY + 10);
    ctx.lineTo(batteryX + 8, batteryY + 10);
    ctx.stroke();
    
    // Voltage label
    ctx.fillStyle = voltage > 0 ? "#ef4444" : "#10b981";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${voltage.toFixed(1)}V`, batteryX, batteryY - 15);
    ctx.fillText(voltage > 0 ? "Stopping" : "Accelerating", batteryX, batteryY + 30);
  }

  function drawEnergyDiagram() {
    const diagramX = W * 0.05;
    const diagramY = H * 0.6;
    const diagramW = W * 0.35;
    const diagramH = H * 0.35;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(diagramX, diagramY, diagramW, diagramH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(diagramX, diagramY, diagramW, diagramH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Energy Diagram", diagramX + diagramW / 2, diagramY + 15);
    
    // Energy scale
    const maxEnergy = 6; // eV
    const energyScale = (diagramH - 60) / maxEnergy;
    const baselineY = diagramY + diagramH - 30;
    
    // Work function level
    const material = materials[materialIndex];
    const workFunctionY = baselineY - material.workFunction * energyScale;
    
    ctx.strokeStyle = material.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(diagramX + 20, workFunctionY);
    ctx.lineTo(diagramX + diagramW - 20, workFunctionY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = material.color;
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Φ = ${material.workFunction} eV`, diagramX + 25, workFunctionY - 5);
    
    // Photon energy
    const photonEnergy = photonEnergyFromFrequency(frequency);
    const photonY = baselineY - photonEnergy * energyScale;
    
    if (photonY > diagramY + 20) {
      const color = frequencyToColor(frequency);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(diagramX + diagramW * 0.3, baselineY);
      ctx.lineTo(diagramX + diagramW * 0.3, photonY);
      ctx.stroke();
      
      // Arrow
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(diagramX + diagramW * 0.3, photonY);
      ctx.lineTo(diagramX + diagramW * 0.3 - 4, photonY + 8);
      ctx.lineTo(diagramX + diagramW * 0.3 + 4, photonY + 8);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`hf = ${photonEnergy.toFixed(2)} eV`, diagramX + diagramW * 0.3 + 8, photonY + 4);
    }
    
    // Electron kinetic energy (if emission occurs)
    if (photonEnergy > material.workFunction) {
      const kineticEnergy = photonEnergy - material.workFunction;
      const electronY = workFunctionY - kineticEnergy * energyScale;
      
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(diagramX + diagramW * 0.7, workFunctionY);
      ctx.lineTo(diagramX + diagramW * 0.7, electronY);
      ctx.stroke();
      
      ctx.fillStyle = "#22d3ee";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`KE = ${kineticEnergy.toFixed(2)} eV`, diagramX + diagramW - 5, electronY + 4);
    }
    
    // Energy axis
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(diagramX + 15, diagramY + 25);
    ctx.lineTo(diagramX + 15, baselineY);
    ctx.stroke();
    
    // Energy scale labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "8px monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= maxEnergy; i += 2) {
      const y = baselineY - i * energyScale;
      ctx.fillText(`${i}`, diagramX + 12, y + 2);
    }
    
    ctx.fillText("eV", diagramX + 12, diagramY + 25);
  }

  function drawInfoPanel() {
    const panelX = W * 0.45;
    const panelY = H * 0.6;
    const panelW = W * 0.5;
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
    
    ctx.fillText("Einstein's Photoelectric Equation:", panelX + 10, infoY);
    infoY += 20;
    
    ctx.fillStyle = "#fbbf24";
    ctx.font = "14px monospace";
    ctx.fillText("KE_max = hf - Φ", panelX + 10, infoY);
    infoY += 25;
    
    // Current values
    const photonEnergy = photonEnergyFromFrequency(frequency);
    const material = materials[materialIndex];
    const wavelength = wavelengthFromFrequency(frequency);
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(`Frequency: ${frequency.toFixed(0)} THz`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Wavelength: ${wavelength.toFixed(0)} nm`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Photon Energy: ${photonEnergy.toFixed(2)} eV`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Work Function: ${material.workFunction} eV`, panelX + 10, infoY);
    infoY += 16;
    
    if (photonEnergy > material.workFunction) {
      const maxKE = photonEnergy - material.workFunction;
      ctx.fillStyle = "#10b981";
      ctx.fillText(`Max KE: ${maxKE.toFixed(2)} eV`, panelX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Emission: YES`, panelX + 10, infoY);
    } else {
      ctx.fillStyle = "#ef4444";
      ctx.fillText(`Max KE: 0 eV`, panelX + 10, infoY);
      infoY += 16;
      ctx.fillText(`Emission: NO`, panelX + 10, infoY);
    }
    infoY += 20;
    
    // Current measurement
    const current = measureCurrent();
    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Current: ${current.toFixed(2)} μA`, panelX + 10, infoY);
    infoY += 16;
    ctx.fillText(`Electrons in flight: ${electrons.length}`, panelX + 10, infoY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      frequency = params.frequency ?? frequency;
      intensity = params.intensity ?? intensity;
      materialIndex = Math.round(params.material ?? materialIndex);
      materialIndex = Math.max(0, Math.min(materialIndex, materials.length - 1));
      showPhotons = Math.round(params.showPhotons ?? showPhotons);
      voltage = params.voltage ?? voltage;
      
      time += dt;
      
      // Emit photons based on intensity
      emissionTimer += dt;
      const emissionInterval = 1 / Math.max(intensity, 0.1);
      
      if (emissionTimer >= emissionInterval) {
        emitPhoton();
        emissionTimer = 0;
      }
      
      updatePhotons(dt);
      updateElectrons(dt);
      
      // Record current measurement for analysis
      if (Math.floor(time * 10) % 5 === 0) { // Every 0.5 seconds
        const current = measureCurrent();
        currentMeasurements.push({ voltage, current });
        if (currentMeasurements.length > 100) {
          currentMeasurements.shift();
        }
      }
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
      ctx.fillText("Photoelectric Effect", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Einstein's Nobel Prize Discovery (1905)", W / 2, 50);

      // Draw components
      drawLightSource();
      drawPhotocathode();
      drawCollector();
      drawVoltageSource();
      
      // Draw particles
      drawPhotons();
      drawElectrons();
      
      // Draw diagrams and info
      drawEnergyDiagram();
      drawInfoPanel();

      // Show key insights
      const photonEnergy = photonEnergyFromFrequency(frequency);
      const material = materials[materialIndex];
      
      if (photonEnergy <= material.workFunction) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Photon energy too low - no emission!", W / 2, H - 30);
        ctx.fillText("Increase frequency, not intensity!", W / 2, H - 15);
      }
    },

    reset() {
      time = 0;
      photons = [];
      electrons = [];
      currentMeasurements = [];
      emissionTimer = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const photonEnergy = photonEnergyFromFrequency(frequency);
      const material = materials[materialIndex];
      const wavelength = wavelengthFromFrequency(frequency);
      const current = measureCurrent();
      
      return `Photoelectric effect with ${frequency}THz (${wavelength.toFixed(0)}nm) light on ${material.name}. ` +
             `Photon energy: ${photonEnergy.toFixed(2)}eV, work function: ${material.workFunction}eV. ` +
             `${photonEnergy > material.workFunction ? 
               `Electrons emitted with max KE=${(photonEnergy - material.workFunction).toFixed(2)}eV. ` :
               "No electron emission - photon energy below work function. "}` +
             `Current: ${current.toFixed(2)}μA. ${electrons.length} electrons in flight.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
    },
  };

  return engine;
};

export default PhotoelectricEffectFactory;