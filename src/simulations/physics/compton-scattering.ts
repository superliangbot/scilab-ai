import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Compton Scattering
 * λ' - λ = (h/mₑc)(1 - cos θ) where h=Planck constant, mₑ=electron mass, c=speed of light
 * Shows X-ray photons scattering off electrons with energy/wavelength shift
 * Demonstrates quantum nature of electromagnetic radiation
 */

const ComptonScatteringFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("compton-scattering") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical constants
  const h = 6.626e-34; // Planck constant
  const c = 3e8; // Speed of light
  const m_e = 9.109e-31; // Electron rest mass
  const eV = 1.602e-19; // eV to Joules

  // System parameters
  let photonEnergy = 100; // keV
  let scatteringAngle = 60; // degrees
  let electronSpeed = 0.1; // fraction of c
  let showRecoilElectron = 1;

  // Simulation state
  let incidentPhoton: { x: number; y: number; energy: number; active: boolean } = { x: 0, y: 0, energy: 0, active: false };
  let scatteredPhoton: { x: number; y: number; energy: number; angle: number; active: boolean } = { x: 0, y: 0, energy: 0, angle: 0, active: false };
  let recoilElectron: { x: number; y: number; energy: number; angle: number; active: boolean } = { x: 0, y: 0, energy: 0, angle: 0, active: false };
  
  const TARGET_X = 400;
  const TARGET_Y = 250;

  let lastScatterTime = 0;
  const SCATTER_INTERVAL = 3; // seconds

  function calculateComptonShift(angle: number): { wavelengthShift: number; scatteredEnergy: number; electronEnergy: number } {
    const angleRad = (angle * Math.PI) / 180;
    
    // Compton wavelength of electron
    const lambda_c = h / (m_e * c); // 2.43 × 10⁻¹² m
    
    // Initial wavelength from energy E = hc/λ
    const initialEnergy = photonEnergy * 1000 * eV; // Convert keV to Joules
    const initialWavelength = (h * c) / initialEnergy;
    
    // Compton scattering formula
    const wavelengthShift = lambda_c * (1 - Math.cos(angleRad));
    const finalWavelength = initialWavelength + wavelengthShift;
    
    // Final photon energy
    const scatteredEnergy = (h * c) / finalWavelength;
    
    // Electron recoil energy (conservation of energy)
    const electronEnergy = initialEnergy - scatteredEnergy;
    
    return {
      wavelengthShift: wavelengthShift,
      scatteredEnergy: scatteredEnergy / (1000 * eV), // Convert to keV
      electronEnergy: electronEnergy / (1000 * eV) // Convert to keV
    };
  }

  function calculateElectronRecoilAngle(photonAngle: number): number {
    const angleRad = (photonAngle * Math.PI) / 180;
    
    // Electron recoil angle formula from conservation of momentum
    // cot(φ) = (1 + E₀/mₑc²) * tan(θ/2)
    const E0 = photonEnergy; // keV
    const m_e_c2 = 511; // keV (electron rest energy)
    
    const cotPhi = (1 + E0 / m_e_c2) * Math.tan(angleRad / 2);
    const phi = Math.atan(1 / cotPhi) * (180 / Math.PI);
    
    return phi;
  }

  function startScatteringEvent() {
    const scatterData = calculateComptonShift(scatteringAngle);
    const electronRecoilAngle = calculateElectronRecoilAngle(scatteringAngle);
    
    // Reset particles
    incidentPhoton = {
      x: 50,
      y: TARGET_Y,
      energy: photonEnergy,
      active: true
    };
    
    scatteredPhoton = {
      x: TARGET_X,
      y: TARGET_Y,
      energy: scatterData.scatteredEnergy,
      angle: scatteringAngle,
      active: false
    };
    
    recoilElectron = {
      x: TARGET_X,
      y: TARGET_Y,
      energy: scatterData.electronEnergy,
      angle: electronRecoilAngle,
      active: false
    };
  }

  function drawTarget() {
    // Target electron (stationary)
    ctx.beginPath();
    ctx.arc(TARGET_X, TARGET_Y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Electron symbol
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("e⁻", TARGET_X, TARGET_Y + 4);
    
    // Target label
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Target Electron", TARGET_X, TARGET_Y - 25);
  }

  function drawPhoton(photon: any, color: string, label: string) {
    if (!photon.active) return;
    
    // Photon as sine wave
    const waveLength = 20;
    const amplitude = 8;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    
    // Draw wavy line to represent photon
    if (photon === incidentPhoton) {
      // Incident photon moving right
      ctx.beginPath();
      for (let x = photon.x - 50; x <= photon.x + 50; x += 2) {
        const y = photon.y + amplitude * Math.sin((x - photon.x + time * 100) * Math.PI / waveLength);
        if (x === photon.x - 50) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Direction arrow
      ctx.beginPath();
      ctx.moveTo(photon.x + 50, photon.y);
      ctx.lineTo(photon.x + 40, photon.y - 5);
      ctx.lineTo(photon.x + 40, photon.y + 5);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // Scattered photon
      const angle = (photon.angle * Math.PI) / 180;
      ctx.beginPath();
      
      for (let i = 0; i <= 50; i += 2) {
        const x = photon.x + i * Math.cos(angle);
        const y = photon.y + i * Math.sin(angle) + amplitude * Math.sin((i + time * 100) * Math.PI / waveLength);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Direction arrow
      const arrowX = photon.x + 50 * Math.cos(angle);
      const arrowY = photon.y + 50 * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 10 * Math.cos(angle - 0.5), arrowY - 10 * Math.sin(angle - 0.5));
      ctx.lineTo(arrowX - 10 * Math.cos(angle + 0.5), arrowY - 10 * Math.sin(angle + 0.5));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    
    // Energy label
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (photon === incidentPhoton) {
      ctx.fillText(`${label}: ${photon.energy.toFixed(1)} keV`, photon.x, photon.y - 20);
    } else {
      const labelX = photon.x + 30 * Math.cos((photon.angle * Math.PI) / 180);
      const labelY = photon.y + 30 * Math.sin((photon.angle * Math.PI) / 180) - 10;
      ctx.fillText(`${label}: ${photon.energy.toFixed(1)} keV`, labelX, labelY);
    }
  }

  function drawRecoilElectron() {
    if (!recoilElectron.active || !showRecoilElectron) return;
    
    const angle = (recoilElectron.angle * Math.PI) / 180;
    const length = 60;
    
    // Electron path
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(recoilElectron.x, recoilElectron.y);
    ctx.lineTo(recoilElectron.x + length * Math.cos(angle), recoilElectron.y + length * Math.sin(angle));
    ctx.stroke();
    
    // Electron particle
    const electronX = recoilElectron.x + length * Math.cos(angle);
    const electronY = recoilElectron.y + length * Math.sin(angle);
    
    ctx.beginPath();
    ctx.arc(electronX, electronY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.fill();
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Energy label
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Recoil e⁻: ${recoilElectron.energy.toFixed(1)} keV`, electronX, electronY - 15);
  }

  function drawScatteringDiagram() {
    // Scattering angle arc
    const arcRadius = 80;
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    // Incident direction line
    ctx.beginPath();
    ctx.moveTo(TARGET_X - arcRadius, TARGET_Y);
    ctx.lineTo(TARGET_X + arcRadius, TARGET_Y);
    ctx.stroke();
    
    // Scattered direction line (if photon is scattered)
    if (scatteredPhoton.active) {
      const angle = (scatteredPhoton.angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(TARGET_X, TARGET_Y);
      ctx.lineTo(TARGET_X + arcRadius * Math.cos(angle), TARGET_Y + arcRadius * Math.sin(angle));
      ctx.stroke();
      
      // Angle arc
      ctx.beginPath();
      ctx.arc(TARGET_X, TARGET_Y, arcRadius * 0.6, 0, angle);
      ctx.stroke();
      
      // Angle label
      const labelAngle = angle / 2;
      const labelX = TARGET_X + arcRadius * 0.4 * Math.cos(labelAngle);
      const labelY = TARGET_Y + arcRadius * 0.4 * Math.sin(labelAngle);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`θ = ${scatteringAngle}°`, labelX, labelY);
    }
    
    ctx.setLineDash([]);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    lastScatterTime = 0;
    startScatteringEvent();
  }

  function update(dt: number, params: Record<string, number>): void {
    photonEnergy = params.photonEnergy ?? 100;
    scatteringAngle = params.scatteringAngle ?? 60;
    electronSpeed = params.electronSpeed ?? 0.1;
    showRecoilElectron = Math.round(params.showRecoilElectron ?? 1);

    time += dt;

    // Animate incident photon
    if (incidentPhoton.active) {
      incidentPhoton.x += 80 * dt;
      
      // Check for collision with target
      if (incidentPhoton.x >= TARGET_X - 20) {
        incidentPhoton.active = false;
        scatteredPhoton.active = true;
        recoilElectron.active = showRecoilElectron > 0;
        
        // Update energies
        const scatterData = calculateComptonShift(scatteringAngle);
        scatteredPhoton.energy = scatterData.scatteredEnergy;
        recoilElectron.energy = scatterData.electronEnergy;
        recoilElectron.angle = calculateElectronRecoilAngle(scatteringAngle);
      }
    }

    // Restart animation periodically
    if (time - lastScatterTime > SCATTER_INTERVAL) {
      lastScatterTime = time;
      startScatteringEvent();
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawScatteringDiagram();
    drawTarget();
    drawPhoton(incidentPhoton, "#f59e0b", "γ (incident)");
    drawPhoton(scatteredPhoton, "#ef4444", "γ' (scattered)");
    drawRecoilElectron();

    const scatterData = calculateComptonShift(scatteringAngle);
    const lambda_c = h / (m_e * c);

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 400, 220);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Compton Scattering", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("λ' - λ = (h/mₑc)(1 - cos θ)", 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Incident Photon Energy: ${photonEnergy} keV`, 20, 80);
    ctx.fillText(`Scattering Angle: θ = ${scatteringAngle}°`, 20, 100);
    ctx.fillText(`Scattered Photon Energy: ${scatterData.scatteredEnergy.toFixed(2)} keV`, 20, 120);
    ctx.fillText(`Electron Recoil Energy: ${scatterData.electronEnergy.toFixed(2)} keV`, 20, 140);
    
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText(`Wavelength Shift: Δλ = ${(scatterData.wavelengthShift * 1e12).toFixed(3)} pm`, 20, 165);
    ctx.fillText(`Compton Wavelength: λc = ${(lambda_c * 1e12).toFixed(2)} pm`, 20, 185);
    
    const electronRecoilAngle = calculateElectronRecoilAngle(scatteringAngle);
    ctx.fillStyle = "#10b981";
    ctx.fillText(`Electron Recoil Angle: φ = ${electronRecoilAngle.toFixed(1)}°`, 20, 205);

    // Theory panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 300, 10, 290, 160);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Compton Effect:", width - 290, 30);
    ctx.fillText("• Photon-electron collision", width - 290, 50);
    ctx.fillText("• Energy & momentum conserved", width - 290, 70);
    ctx.fillText("• Photon energy decreases", width - 290, 90);
    ctx.fillText("• Electron gains kinetic energy", width - 290, 110);
    ctx.fillText("• Proves particle nature of light", width - 290, 130);
    ctx.fillText("• Used in medical imaging", width - 290, 150);

    // Applications and significance
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Nobel Prize 1927 - Arthur Compton | Demonstrates photon momentum p = E/c", width / 2, height - 20);
    ctx.fillText("Applications: X-ray spectroscopy, gamma-ray astronomy, medical physics", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    lastScatterTime = 0;
    startScatteringEvent();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const scatterData = calculateComptonShift(scatteringAngle);
    const electronRecoilAngle = calculateElectronRecoilAngle(scatteringAngle);
    const lambda_c = h / (m_e * c);
    
    return (
      `Compton Scattering: ${photonEnergy}keV photon scattering off electron at θ=${scatteringAngle}°. ` +
      `Scattered photon energy ${scatterData.scatteredEnergy.toFixed(2)}keV, electron recoil ${scatterData.electronEnergy.toFixed(2)}keV at φ=${electronRecoilAngle.toFixed(1)}°. ` +
      `Wavelength shift Δλ=${(scatterData.wavelengthShift * 1e12).toFixed(3)}pm due to photon momentum transfer. ` +
      `Compton wavelength λc=${(lambda_c * 1e12).toFixed(2)}pm. Demonstrates quantum nature of electromagnetic radiation.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default ComptonScatteringFactory;