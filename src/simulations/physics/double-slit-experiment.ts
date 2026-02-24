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
  active: boolean;
  wavelength: number;
  phase: number;
}

interface DetectorHit {
  y: number;
  intensity: number;
}

const DoubleslitExperimentFactory: SimulationFactory = () => {
  const config = getSimConfig("double-slit-experiment") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let wavelength = 550; // nm (green light)
  let slitSeparation = 50; // pixels
  let slitWidth = 8; // pixels
  let intensity = 5; // photon emission rate
  let showWaves = 1;
  let detectorDistance = 400; // pixels from slits

  // Simulation state
  let photons: Photon[] = [];
  let detectorHits: DetectorHit[] = [];
  let intensityPattern: number[] = [];
  let waveField: number[][] = [];
  let emissionTimer = 0;

  // Positions
  const SLIT_X = W * 0.25;
  const DETECTOR_X = W * 0.75;
  const SLIT1_Y = H * 0.4;
  const SLIT2_Y = H * 0.6;

  function initializeArrays() {
    // Initialize intensity pattern array for detector
    intensityPattern = new Array(H).fill(0);
    
    // Initialize wave field for wave visualization
    const fieldW = Math.ceil(W / 4);
    const fieldH = Math.ceil(H / 4);
    waveField = Array(fieldW).fill(null).map(() => Array(fieldH).fill(0));
  }

  function wavelengthToColor(wl: number): string {
    // Convert wavelength (nm) to RGB color
    if (wl < 380) return "#8b00ff"; // UV -> violet
    if (wl < 440) return "#4b0082"; // violet
    if (wl < 490) return "#0000ff"; // blue
    if (wl < 510) return "#00ff00"; // green
    if (wl < 580) return "#ffff00"; // yellow
    if (wl < 645) return "#ff7f00"; // orange
    if (wl < 750) return "#ff0000"; // red
    return "#ff0000"; // IR -> red
  }

  function emitPhoton() {
    if (photons.length > 100) return; // Limit total photons
    
    const photon: Photon = {
      x: 50,
      y: H * 0.5 + (Math.random() - 0.5) * H * 0.4,
      vx: 200, // pixels per second
      vy: 0,
      active: true,
      wavelength: wavelength,
      phase: Math.random() * 2 * Math.PI,
    };
    
    photons.push(photon);
  }

  function updatePhotons(dt: number) {
    for (let i = photons.length - 1; i >= 0; i--) {
      const photon = photons[i];
      if (!photon.active) continue;
      
      // Move photon
      photon.x += photon.vx * dt;
      photon.y += photon.vy * dt;
      photon.phase += (2 * Math.PI * 3e8) / (photon.wavelength * 1e-9) * dt;
      
      // Check if photon hits the slit barrier
      if (photon.x >= SLIT_X - 5 && photon.x <= SLIT_X + 5) {
        const isInSlit1 = Math.abs(photon.y - SLIT1_Y) <= slitWidth;
        const isInSlit2 = Math.abs(photon.y - SLIT2_Y) <= slitWidth;
        
        if (!isInSlit1 && !isInSlit2) {
          // Photon blocked by barrier
          photons.splice(i, 1);
          continue;
        }
        
        // Photon passes through slit - apply diffraction
        if (isInSlit1) {
          // Diffraction spread for slit 1
          const diffraction = (Math.random() - 0.5) * 0.3;
          photon.vy += diffraction * 100;
        }
        if (isInSlit2) {
          // Diffraction spread for slit 2
          const diffraction = (Math.random() - 0.5) * 0.3;
          photon.vy += diffraction * 100;
        }
      }
      
      // Check if photon hits detector
      if (photon.x >= DETECTOR_X) {
        if (photon.y >= 0 && photon.y <= H) {
          recordDetectorHit(photon.y, photon.wavelength);
        }
        photons.splice(i, 1);
        continue;
      }
      
      // Remove photons that go off screen
      if (photon.x > W + 50 || photon.y < -50 || photon.y > H + 50) {
        photons.splice(i, 1);
      }
    }
  }

  function recordDetectorHit(y: number, wavelength: number) {
    const binIndex = Math.floor(y);
    if (binIndex >= 0 && binIndex < intensityPattern.length) {
      intensityPattern[binIndex] += 1;
    }
    
    detectorHits.push({ y, intensity: 1 });
    if (detectorHits.length > 200) {
      detectorHits.shift();
    }
  }

  function calculateTheoreticalPattern() {
    // Young's double-slit interference pattern
    // I(θ) = I₀ cos²(πd sin(θ)/λ)
    const theoreticalPattern: number[] = [];
    const lambda = wavelength * 1e-9; // Convert to meters
    const d = slitSeparation * 1e-6; // Convert pixels to meters (assuming pixel scale)
    const L = detectorDistance * 1e-6; // Distance to detector
    
    for (let i = 0; i < H; i++) {
      const y = (i - H/2) * 1e-6; // Position on detector
      const theta = Math.atan(y / L);
      const pathDiff = d * Math.sin(theta);
      const phase = (2 * Math.PI * pathDiff) / lambda;
      const intensity = Math.cos(phase / 2) ** 2;
      theoreticalPattern.push(intensity);
    }
    
    return theoreticalPattern;
  }

  function drawSlitBarrier() {
    // Draw barrier
    ctx.fillStyle = "#374151";
    ctx.fillRect(SLIT_X - 8, 0, 16, H);
    
    // Draw slits (clear areas)
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(SLIT_X - 8, SLIT1_Y - slitWidth, 16, slitWidth * 2);
    ctx.fillRect(SLIT_X - 8, SLIT2_Y - slitWidth, 16, slitWidth * 2);
    
    // Slit labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("S₁", SLIT_X, SLIT1_Y - slitWidth - 5);
    ctx.fillText("S₂", SLIT_X, SLIT2_Y - slitWidth - 5);
    
    // Barrier label
    ctx.save();
    ctx.translate(SLIT_X - 20, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Double Slit", 0, 0);
    ctx.restore();
  }

  function drawPhotons() {
    const color = wavelengthToColor(wavelength);
    
    for (const photon of photons) {
      if (!photon.active) continue;
      
      // Draw photon as a glowing dot
      const alpha = 0.6 + 0.4 * Math.sin(photon.phase);
      
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(photon.x, photon.y, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Add glow effect
      ctx.fillStyle = color + "40";
      ctx.beginPath();
      ctx.arc(photon.x, photon.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWaves() {
    if (!showWaves) return;
    
    const color = wavelengthToColor(wavelength);
    
    // Draw wave fronts from each slit
    ctx.strokeStyle = color + "30";
    ctx.lineWidth = 1;
    
    const waveSpeed = 200; // pixels per second
    const frequency = 3e8 / (wavelength * 1e-9); // Hz
    const waveLength = waveSpeed / frequency * 1e6; // wavelength in pixels
    
    for (let n = 0; n < 10; n++) {
      const radius = (time * waveSpeed + n * waveLength) % (waveLength * 10);
      
      // Waves from slit 1
      ctx.beginPath();
      ctx.arc(SLIT_X, SLIT1_Y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Waves from slit 2
      ctx.beginPath();
      ctx.arc(SLIT_X, SLIT2_Y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawDetector() {
    // Detector screen
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(DETECTOR_X - 5, 0, 10, H);
    
    // Detector label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.save();
    ctx.translate(DETECTOR_X + 15, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Detector Screen", 0, 0);
    ctx.restore();
    
    // Recent hits
    ctx.fillStyle = "#fbbf24";
    for (const hit of detectorHits.slice(-50)) {
      ctx.beginPath();
      ctx.arc(DETECTOR_X, hit.y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawInterferencePattern() {
    const patternX = DETECTOR_X + 30;
    const patternW = W - patternX - 20;
    const patternH = H;
    
    // Background
    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(patternX, 0, patternW, patternH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(patternX, 0, patternW, patternH);
    
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Interference Pattern", patternX + patternW / 2, 15);
    
    // Measured intensity pattern
    if (intensityPattern.some(val => val > 0)) {
      const maxIntensity = Math.max(...intensityPattern, 1);
      
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < intensityPattern.length; i++) {
        const x = patternX + 10 + (intensityPattern[i] / maxIntensity) * (patternW - 40);
        const y = i;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.fillStyle = "#ef4444";
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Measured", patternX + 5, 35);
    }
    
    // Theoretical pattern
    const theoretical = calculateTheoreticalPattern();
    const maxTheoretical = Math.max(...theoretical, 1);
    
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    
    for (let i = 0; i < theoretical.length; i++) {
      const x = patternX + 10 + (theoretical[i] / maxTheoretical) * (patternW - 40);
      const y = i;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = "#10b981";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Theory", patternX + 5, 50);
    
    // Intensity scale
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(patternX + 10, 0);
    ctx.lineTo(patternX + 10, H);
    ctx.stroke();
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = 10;
    const panelW = 180;
    const panelH = 140;
    
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    let infoY = panelY + 20;
    
    ctx.fillText("Double-Slit Experiment", panelX + 8, infoY);
    infoY += 18;
    
    const color = wavelengthToColor(wavelength);
    ctx.fillStyle = color;
    ctx.fillText(`λ = ${wavelength} nm`, panelX + 8, infoY);
    infoY += 16;
    
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Slit separation: ${slitSeparation}px`, panelX + 8, infoY);
    infoY += 16;
    ctx.fillText(`Slit width: ${slitWidth}px`, panelX + 8, infoY);
    infoY += 16;
    ctx.fillText(`Photons: ${photons.length}`, panelX + 8, infoY);
    infoY += 16;
    ctx.fillText(`Detector hits: ${detectorHits.length}`, panelX + 8, infoY);
    infoY += 16;
    
    // Key equation
    ctx.fillStyle = "#fbbf24";
    ctx.font = "10px monospace";
    ctx.fillText("Δy = λL/d", panelX + 8, infoY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      initializeArrays();
      time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      wavelength = params.wavelength ?? wavelength;
      slitSeparation = params.slitSeparation ?? slitSeparation;
      slitWidth = params.slitWidth ?? slitWidth;
      intensity = params.intensity ?? intensity;
      showWaves = Math.round(params.showWaves ?? showWaves);
      
      time += dt;
      
      // Emit photons based on intensity
      emissionTimer += dt;
      const emissionInterval = 1 / Math.max(intensity, 0.1);
      
      if (emissionTimer >= emissionInterval) {
        emitPhoton();
        emissionTimer = 0;
      }
      
      updatePhotons(dt);
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
      ctx.fillText("Double-Slit Experiment", W / 2, 30);
      
      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Wave-Particle Duality and Quantum Interference", W / 2, 50);

      // Draw wave visualization if enabled
      if (showWaves) {
        drawWaves();
      }

      // Draw experiment components
      drawSlitBarrier();
      drawPhotons();
      drawDetector();
      drawInterferencePattern();
      drawInfoPanel();

      // Draw light source
      const color = wavelengthToColor(wavelength);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(30, H / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = color + "60";
      ctx.beginPath();
      ctx.arc(30, H / 2, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Source", 30, H / 2 + 25);

      // Show measurement count
      const totalHits = intensityPattern.reduce((sum, val) => sum + val, 0);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Total detections: ${totalHits}`, 10, H - 20);
      
      if (totalHits > 50) {
        ctx.fillText("Interference pattern emerging!", 10, H - 8);
      }
    },

    reset() {
      time = 0;
      photons = [];
      detectorHits = [];
      intensityPattern = new Array(H).fill(0);
      emissionTimer = 0;
    },

    destroy() {},

    getStateDescription(): string {
      const totalHits = intensityPattern.reduce((sum, val) => sum + val, 0);
      const color = wavelength < 500 ? "blue" : wavelength < 600 ? "green" : "red";
      
      return `Double-slit experiment with ${wavelength}nm ${color} light. ` +
             `Slit separation: ${slitSeparation}px, width: ${slitWidth}px. ` +
             `${photons.length} photons in flight, ${totalHits} total detections. ` +
             `${totalHits > 50 ? "Interference pattern visible - " : ""}` +
             `Demonstrates wave-particle duality: individual photons create interference fringes.`;
    },

    resize(width: number, height: number) {
      W = width;
      H = height;
      initializeArrays();
    },
  };

  return engine;
};

export default DoubleslitExperimentFactory;