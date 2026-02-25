import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Photoelectric Effect: Einstein's Nobel Prize-winning explanation
 * Key demonstrations:
 * - Frequency threshold behavior (no emission below threshold)
 * - Energy of emitted electrons: E = hf - φ
 * - Intensity affects only the number of electrons, not their energy
 * - Instantaneous emission (no delay)
 * - Work function determination
 */

interface PhotoelectronData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kineticEnergy: number;
  created: number;
}

interface PhotonData {
  x: number;
  y: number;
  wavelength: number; // nm
  energy: number; // eV
  created: number;
}

const PhotoelectricEffectFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("photoelectric-effect") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical constants
  const h = 4.136e-15; // Planck's constant (eV·s)
  const c = 2.998e8; // speed of light (m/s)
  const eV_to_J = 1.602e-19;

  // Simulation parameters
  let lightFrequency = 6e14; // Hz (blue light)
  let lightIntensity = 50; // arbitrary units (photons/s)
  let workFunction = 2.3; // eV (typical for sodium)
  let showDetails = 1;

  // Material properties (different metals)
  const materials = {
    sodium: { φ: 2.3, color: "#fbbf24", name: "Sodium" },
    aluminum: { φ: 4.1, color: "#94a3b8", name: "Aluminum" },
    copper: { φ: 4.7, color: "#f97316", name: "Copper" },
    platinum: { φ: 6.4, color: "#e5e7eb", name: "Platinum" }
  };
  let selectedMaterial = "sodium";

  // Animation arrays
  let photons: PhotonData[] = [];
  let photoelectrons: PhotoelectronData[] = [];
  let electronCount = 0;
  let photonCount = 0;

  // Statistics for analysis
  let emissionEvents: number[] = [];
  let electronEnergies: number[] = [];
  const MAX_PARTICLES = 50;
  const MAX_HISTORY = 100;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    photons = [];
    photoelectrons = [];
    electronCount = 0;
    photonCount = 0;
    emissionEvents = [];
    electronEnergies = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    lightFrequency = (params.lightFrequency ?? 6e14);
    lightIntensity = params.lightIntensity ?? 50;
    showDetails = params.showDetails ?? 1;
    
    // Handle material selection
    const matIndex = Math.round(params.material ?? 0);
    const matKeys = Object.keys(materials);
    selectedMaterial = matKeys[Math.max(0, Math.min(matIndex, matKeys.length - 1))];
    workFunction = materials[selectedMaterial as keyof typeof materials].φ;

    time += dt;

    // Calculate photon properties
    const photonEnergy = h * lightFrequency; // eV
    const wavelength = (c / lightFrequency) * 1e9; // nm
    const canEmit = photonEnergy > workFunction;

    // Generate new photons based on intensity
    const photonRate = lightIntensity * 0.1; // photons per second
    if (Math.random() < photonRate * dt && photons.length < MAX_PARTICLES) {
      photons.push({
        x: 50,
        y: height * 0.4 + (Math.random() - 0.5) * 100,
        wavelength,
        energy: photonEnergy,
        created: time
      });
      photonCount++;
    }

    // Update photons
    for (let i = photons.length - 1; i >= 0; i--) {
      const photon = photons[i];
      photon.x += 200 * dt; // photon speed (visual)

      // Check collision with metal surface
      if (photon.x >= width * 0.45) {
        if (canEmit && Math.random() < 0.7) {
          // Photoelectric emission occurs
          const maxKE = photonEnergy - workFunction; // Einstein's equation
          const actualKE = maxKE * (0.5 + 0.5 * Math.random()); // some spread

          if (actualKE > 0) {
            const speed = Math.sqrt(2 * actualKE * eV_to_J / 9.109e-31) * 1e-6; // scaled for visualization
            const angle = -Math.PI/2 + (Math.random() - 0.5) * Math.PI/3; // mostly upward

            photoelectrons.push({
              x: width * 0.45,
              y: photon.y,
              vx: speed * Math.cos(angle),
              vy: speed * Math.sin(angle),
              kineticEnergy: actualKE,
              created: time
            });

            electronCount++;
            electronEnergies.push(actualKE);
            emissionEvents.push(time);

            // Limit arrays
            if (electronEnergies.length > MAX_HISTORY) electronEnergies.shift();
            if (emissionEvents.length > MAX_HISTORY) emissionEvents.shift();
          }
        }
        photons.splice(i, 1); // Remove photon
      } else if (photon.x > width || time - photon.created > 5) {
        photons.splice(i, 1); // Clean up old photons
      }
    }

    // Update photoelectrons
    for (let i = photoelectrons.length - 1; i >= 0; i--) {
      const electron = photoelectrons[i];
      electron.x += electron.vx * dt;
      electron.y += electron.vy * dt;

      // Remove electrons that left the screen or are too old
      if (electron.x > width || electron.y < 0 || electron.y > height || 
          time - electron.created > 3) {
        photoelectrons.splice(i, 1);
      }
    }
  }

  function wavelengthToColor(wavelength: number): string {
    // Visible spectrum color mapping
    if (wavelength < 380 || wavelength > 700) return "#ffffff"; // UV/IR as white
    
    let r = 0, g = 0, b = 0;
    
    if (wavelength >= 380 && wavelength < 440) {
      r = -(wavelength - 440) / (440 - 380);
      b = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
      g = (wavelength - 440) / (490 - 440);
      b = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
      g = 1;
      b = -(wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
      r = (wavelength - 510) / (580 - 510);
      g = 1;
    } else if (wavelength >= 580 && wavelength < 645) {
      r = 1;
      g = -(wavelength - 645) / (645 - 580);
    } else if (wavelength >= 645 && wavelength <= 700) {
      r = 1;
    }

    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  function drawSetup(): void {
    // Light source
    const sourceX = 50;
    const sourceY = height * 0.4;
    
    const sourceGrad = ctx.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, 30);
    sourceGrad.addColorStop(0, "#fef08a");
    sourceGrad.addColorStop(1, "#eab308");
    
    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 25, 0, Math.PI * 2);
    ctx.fillStyle = sourceGrad;
    ctx.fill();
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Light beam
    const beamColor = wavelengthToColor((c / lightFrequency) * 1e9);
    const beamGrad = ctx.createLinearGradient(sourceX + 25, 0, width * 0.45, 0);
    beamGrad.addColorStop(0, beamColor + "60");
    beamGrad.addColorStop(1, beamColor + "20");
    
    ctx.beginPath();
    ctx.moveTo(sourceX + 25, sourceY - 30);
    ctx.lineTo(width * 0.45, sourceY - 30);
    ctx.lineTo(width * 0.45, sourceY + 30);
    ctx.lineTo(sourceX + 25, sourceY + 30);
    ctx.closePath();
    ctx.fillStyle = beamGrad;
    ctx.fill();

    // Metal surface
    const material = materials[selectedMaterial as keyof typeof materials];
    const metalGrad = ctx.createLinearGradient(width * 0.45, 0, width * 0.5, 0);
    metalGrad.addColorStop(0, material.color);
    metalGrad.addColorStop(1, material.color + "80");
    
    ctx.fillStyle = metalGrad;
    ctx.fillRect(width * 0.45, height * 0.25, width * 0.05, height * 0.5);
    
    // Metal surface highlight
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(width * 0.45, height * 0.25, 2, height * 0.5);

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Light Source", sourceX, sourceY + 45);
    ctx.fillText(material.name, width * 0.475, height * 0.8);
    
    // Work function label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`φ = ${workFunction} eV`, width * 0.475, height * 0.82);
  }

  function drawParticles(): void {
    // Draw photons
    photons.forEach(photon => {
      const color = wavelengthToColor(photon.wavelength);
      
      // Photon as wave packet
      ctx.beginPath();
      ctx.arc(photon.x, photon.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color + "80";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Wave representation
      if (showDetails) {
        ctx.strokeStyle = color + "40";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
          const waveX = photon.x - i * 3;
          const waveY = photon.y + Math.sin((photon.x - waveX) * 0.3) * 8;
          if (i === 0) ctx.moveTo(waveX, waveY);
          else ctx.lineTo(waveX, waveY);
        }
        ctx.stroke();
      }
    });

    // Draw photoelectrons
    photoelectrons.forEach(electron => {
      const age = time - electron.created;
      const alpha = Math.max(0, 1 - age / 3);
      
      // Electron trail
      const trailGrad = ctx.createRadialGradient(electron.x, electron.y, 0, electron.x, electron.y, 8);
      trailGrad.addColorStop(0, `rgba(59, 130, 246, ${alpha})`);
      trailGrad.addColorStop(1, `rgba(59, 130, 246, 0)`);
      
      ctx.beginPath();
      ctx.arc(electron.x, electron.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = trailGrad;
      ctx.fill();

      // Electron core
      ctx.beginPath();
      ctx.arc(electron.x, electron.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(37, 99, 235, ${alpha})`;
      ctx.fill();

      // Energy indicator (size based on kinetic energy)
      if (showDetails && alpha > 0.5) {
        const energySize = Math.sqrt(electron.kineticEnergy) * 3;
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.6})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(electron.x, electron.y, energySize, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  function drawEnergyDiagram(): void {
    const diagramX = width * 0.05;
    const diagramY = height * 0.05;
    const diagramW = width * 0.35;
    const diagramH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.roundRect(diagramX, diagramY, diagramW, diagramH, 6);
    ctx.fill();

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Energy Diagram", diagramX + diagramW/2, diagramY + 18);

    // Energy scale
    const plotX = diagramX + 40;
    const plotY = diagramY + 30;
    const plotW = diagramW - 60;
    const plotH = diagramH - 50;

    const photonEnergy = h * lightFrequency;
    const maxEnergy = Math.max(8, photonEnergy * 1.2, workFunction * 1.5);

    // Fermi level (top of metal)
    const fermiY = plotY + plotH - (workFunction / maxEnergy) * plotH;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(plotX, fermiY, plotW * 0.3, plotH - (fermiY - plotY));

    // Work function arrow
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plotX + plotW * 0.35, plotY + plotH);
    ctx.lineTo(plotX + plotW * 0.35, fermiY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(plotX + plotW * 0.35, fermiY);
    ctx.lineTo(plotX + plotW * 0.35 - 5, fermiY + 8);
    ctx.lineTo(plotX + plotW * 0.35 + 5, fermiY + 8);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // Work function label
    ctx.fillStyle = "#ef4444";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`φ = ${workFunction.toFixed(1)} eV`, plotX + plotW * 0.4, fermiY + 10);

    // Photon energy
    const photonY = plotY + plotH - (photonEnergy / maxEnergy) * plotH;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(plotX + plotW * 0.6, photonY);
    ctx.lineTo(plotX + plotW * 0.9, photonY);
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.fillText(`hf = ${photonEnergy.toFixed(2)} eV`, plotX + plotW * 0.6, photonY - 5);

    // Kinetic energy of emitted electrons
    if (photonEnergy > workFunction) {
      const maxKE = photonEnergy - workFunction;
      const keY = plotY + plotH - ((workFunction + maxKE) / maxEnergy) * plotH;
      
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plotX + plotW * 0.6, fermiY);
      ctx.lineTo(plotX + plotW * 0.6, keY);
      ctx.stroke();

      ctx.fillStyle = "#3b82f6";
      ctx.textAlign = "right";
      ctx.fillText(`KEmax = ${maxKE.toFixed(2)} eV`, plotX + plotW * 0.55, (fermiY + keY) / 2);
    }

    // Energy levels
    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let e = 0; e <= maxEnergy; e += 2) {
      const y = plotY + plotH - (e / maxEnergy) * plotH;
      ctx.fillText(`${e} eV`, plotX - 5, y + 3);
    }

    // Zero level line
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Vacuum Level", plotX + plotW/2, plotY + plotH + 15);
  }

  function drawStatistics(): void {
    const statsX = width * 0.6;
    const statsY = height * 0.05;

    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";

    const photonEnergy = h * lightFrequency;
    const wavelength = (c / lightFrequency) * 1e9;
    const canEmit = photonEnergy > workFunction;

    ctx.fillText("Light Properties:", statsX, statsY);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
    
    const lines = [
      `Frequency: ${(lightFrequency / 1e12).toFixed(1)} THz`,
      `Wavelength: λ = ${wavelength.toFixed(0)} nm`,
      `Photon Energy: hf = ${photonEnergy.toFixed(2)} eV`,
      ``,
      `Photoelectric Effect:`,
      canEmit ? `✓ Electrons emitted` : `✗ No emission (hf < φ)`,
      canEmit ? `Max KE: ${(photonEnergy - workFunction).toFixed(2)} eV` : `Threshold: λ = ${((h * c) / (workFunction * eV_to_J) * 1e9).toFixed(0)} nm`,
      ``,
      `Statistics:`,
      `Photons: ${photonCount}`,
      `Electrons: ${electronCount}`,
      `Efficiency: ${photonCount > 0 ? ((electronCount / photonCount) * 100).toFixed(1) : 0}%`,
    ];

    lines.forEach((line, i) => {
      if (line.startsWith('✓')) {
        ctx.fillStyle = "#10b981";
      } else if (line.startsWith('✗')) {
        ctx.fillStyle = "#ef4444";
      } else if (line === "" || line.endsWith(":")) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
        if (line.endsWith(":")) ctx.font = "bold 12px system-ui, sans-serif";
        else ctx.font = "12px system-ui, sans-serif";
      } else {
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.font = "12px system-ui, sans-serif";
      }
      
      ctx.fillText(line, statsX, statsY + 20 + i * 16);
    });
  }

  function drawEquations(): void {
    const eqX = width * 0.55;
    const eqY = height * 0.45;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.roundRect(eqX, eqY, width * 0.4, height * 0.2, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Einstein's Photoelectric Equation", eqX + width * 0.2, eqY + 20);

    ctx.font = `${Math.max(13, width * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    
    const equations = [
      "KEmax = hf - φ",
      "",
      "where:",
      "h = Planck's constant",
      "f = light frequency", 
      "φ = work function",
      "KEmax = maximum kinetic energy"
    ];

    ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
    equations.forEach((eq, i) => {
      if (eq === "KEmax = hf - φ") {
        ctx.font = `bold ${Math.max(16, width * 0.024)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(eq, eqX + width * 0.2, eqY + 55);
        ctx.font = `${Math.max(13, width * 0.02)}px system-ui, sans-serif`;
        ctx.textAlign = "left";
      } else if (eq === "") {
        // skip
      } else if (eq === "where:") {
        ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
        ctx.fillText(eq, eqX + 20, eqY + 80);
      } else {
        ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
        ctx.fillText(eq, eqX + 30, eqY + 80 + (i - 2) * 16);
      }
    });
  }

  function render(): void {
    // Dark background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Draw components
    drawSetup();
    drawParticles();
    drawEnergyDiagram();
    drawStatistics();
    drawEquations();

    // Title
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = `bold ${Math.max(16, width * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Photoelectric Effect", width/2, 25);

    // Subtitle
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.font = `${Math.max(12, width * 0.018)}px system-ui, sans-serif`;
    ctx.fillText("Einstein's Nobel Prize Discovery (1905)", width/2, 42);
  }

  function reset(): void {
    time = 0;
    photons = [];
    photoelectrons = [];
    electronCount = 0;
    photonCount = 0;
    emissionEvents = [];
    electronEnergies = [];
  }

  function destroy(): void {
    photons = [];
    photoelectrons = [];
    emissionEvents = [];
    electronEnergies = [];
  }

  function getStateDescription(): string {
    const photonEnergy = h * lightFrequency;
    const wavelength = (c / lightFrequency) * 1e9;
    const canEmit = photonEnergy > workFunction;
    const material = materials[selectedMaterial as keyof typeof materials];

    return (
      `Photoelectric Effect: ${material.name} surface (φ=${workFunction} eV). ` +
      `Light: f=${(lightFrequency/1e12).toFixed(1)} THz, λ=${wavelength.toFixed(0)} nm, ` +
      `hf=${photonEnergy.toFixed(2)} eV. ` +
      (canEmit ? 'Emission occurs, KEmax=' + (photonEnergy-workFunction).toFixed(2) + ' eV' : 'No emission (below threshold)') + '. ' +
      `Photons: ${photonCount}, Electrons: ${electronCount}. ` +
      `Demonstrates quantum nature of light and particle-wave duality.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PhotoelectricEffectFactory;