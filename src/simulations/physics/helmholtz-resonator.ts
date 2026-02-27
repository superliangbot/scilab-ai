import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Helmholtz Resonator
 * f = (v/2π) × √(A/(V×(L + ΔL))) where v=sound speed, A=neck area, V=cavity volume, L=neck length
 * Shows acoustic cavity resonance with air oscillating in neck
 * Demonstrates resonant frequency and quality factor
 */

const HelmholtzResonatorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("helmholtz-resonator") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Resonator parameters
  let cavityVolume = 0.001; // m³ (1 liter)
  let neckLength = 0.05; // m (5 cm)
  let neckDiameter = 0.02; // m (2 cm)
  let excitationFrequency = 300; // Hz
  let dampingFactor = 0.05;

  // Physical constants
  const soundSpeed = 343; // m/s at 20°C
  const airDensity = 1.225; // kg/m³

  // Animation variables
  let airDisplacement = 0; // Air displacement in neck
  let airVelocity = 0; // Air velocity in neck
  let cavityPressure = 0; // Pressure variation in cavity

  // Visualization particles for air movement
  const airParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    originalX: number;
    originalY: number;
  }> = [];

  // Resonator dimensions for display
  const CAVITY_X = 200;
  const CAVITY_Y = 150;
  const CAVITY_WIDTH = 200;
  const CAVITY_HEIGHT = 150;
  const NECK_WIDTH = 40;
  const NECK_HEIGHT = 100;

  // Response curve data
  const frequencyResponse: Array<{ freq: number; amplitude: number }> = [];

  function calculateResonantFrequency(): number {
    const neckArea = Math.PI * (neckDiameter / 2) ** 2;
    const endCorrection = 0.6 * neckDiameter; // Approximate end correction
    const effectiveLength = neckLength + endCorrection;
    
    return (soundSpeed / (2 * Math.PI)) * Math.sqrt(neckArea / (cavityVolume * effectiveLength));
  }

  function calculateQualityFactor(): number {
    // Simplified Q factor calculation
    return Math.sqrt(cavityVolume / (neckDiameter ** 3)) / dampingFactor;
  }

  function initializeAirParticles() {
    airParticles.length = 0;
    
    // Particles in neck
    for (let i = 0; i < 20; i++) {
      const x = CAVITY_X + CAVITY_WIDTH / 2 - NECK_WIDTH / 2 + Math.random() * NECK_WIDTH;
      const y = CAVITY_Y - NECK_HEIGHT + i * (NECK_HEIGHT / 20);
      
      airParticles.push({
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        originalX: x,
        originalY: y
      });
    }
    
    // Particles in cavity
    for (let i = 0; i < 50; i++) {
      const x = CAVITY_X + Math.random() * CAVITY_WIDTH;
      const y = CAVITY_Y + Math.random() * CAVITY_HEIGHT;
      
      airParticles.push({
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        originalX: x,
        originalY: y
      });
    }
  }

  function updateResonatorPhysics(dt: number) {
    const resonantFreq = calculateResonantFrequency();
    const omega_r = 2 * Math.PI * resonantFreq;
    const omega_drive = 2 * Math.PI * excitationFrequency;
    
    // Driven damped harmonic oscillator equation
    // External driving force from sound wave
    const drivingAmplitude = 0.5;
    const drivingForce = drivingAmplitude * Math.cos(omega_drive * time);
    
    // Equation of motion for air displacement in neck
    const acceleration = -(omega_r ** 2) * airDisplacement - 2 * dampingFactor * omega_r * airVelocity + drivingForce;
    
    airVelocity += acceleration * dt;
    airDisplacement += airVelocity * dt;
    
    // Cavity pressure (related to air displacement)
    cavityPressure = -airDisplacement * 100; // Scale for visualization
    
    // Update air particle positions
    airParticles.forEach((particle, i) => {
      if (i < 20) {
        // Neck particles - oscillate vertically
        particle.y = particle.originalY + airDisplacement * 50;
        particle.vy = airVelocity * 50;
      } else {
        // Cavity particles - pressure wave effects
        const pressureEffect = cavityPressure * 0.1;
        const centerX = CAVITY_X + CAVITY_WIDTH / 2;
        const centerY = CAVITY_Y + CAVITY_HEIGHT / 2;
        
        const dx = particle.originalX - centerX;
        const dy = particle.originalY - centerY;
        
        particle.x = particle.originalX + dx * pressureEffect * 0.01;
        particle.y = particle.originalY + dy * pressureEffect * 0.01;
      }
    });
  }

  function generateFrequencyResponse() {
    frequencyResponse.length = 0;
    
    const resonantFreq = calculateResonantFrequency();
    const Q = calculateQualityFactor();
    
    for (let f = 50; f <= 1000; f += 10) {
      const omega = 2 * Math.PI * f;
      const omega_r = 2 * Math.PI * resonantFreq;
      
      // Transfer function for driven damped oscillator
      const denominator = Math.sqrt(
        Math.pow(omega_r ** 2 - omega ** 2, 2) + Math.pow(2 * dampingFactor * omega_r * omega, 2)
      );
      
      const amplitude = 1 / denominator;
      frequencyResponse.push({ freq: f, amplitude: amplitude });
    }
  }

  function drawResonator() {
    // Cavity
    const cavityColor = `rgba(59, 130, 246, ${0.3 + Math.abs(cavityPressure) * 0.01})`;
    ctx.fillStyle = cavityColor;
    ctx.fillRect(CAVITY_X, CAVITY_Y, CAVITY_WIDTH, CAVITY_HEIGHT);
    
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 4;
    ctx.strokeRect(CAVITY_X, CAVITY_Y, CAVITY_WIDTH, CAVITY_HEIGHT);
    
    // Neck
    const neckX = CAVITY_X + CAVITY_WIDTH / 2 - NECK_WIDTH / 2;
    const neckY = CAVITY_Y - NECK_HEIGHT;
    
    ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
    ctx.fillRect(neckX, neckY, NECK_WIDTH, NECK_HEIGHT);
    
    ctx.strokeStyle = "#3b82f6";
    ctx.strokeRect(neckX, neckY, NECK_WIDTH, NECK_HEIGHT);
    
    // Air displacement visualization in neck
    const displacementIndicator = neckY + NECK_HEIGHT / 2 + airDisplacement * 30;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(neckX - 10, displacementIndicator);
    ctx.lineTo(neckX + NECK_WIDTH + 10, displacementIndicator);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Pressure indicator in cavity
    const pressureRadius = Math.abs(cavityPressure) * 2;
    if (pressureRadius > 1) {
      ctx.strokeStyle = cavityPressure > 0 ? "#ef4444" : "#10b981";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      
      ctx.beginPath();
      ctx.arc(CAVITY_X + CAVITY_WIDTH / 2, CAVITY_Y + CAVITY_HEIGHT / 2, pressureRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawAirParticles() {
    airParticles.forEach((particle, i) => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, i < 20 ? 3 : 2, 0, Math.PI * 2);
      
      if (i < 20) {
        // Neck particles - color based on velocity
        const speed = Math.abs(particle.vy);
        const intensity = Math.min(255, speed * 5);
        ctx.fillStyle = `rgb(${intensity}, ${255 - intensity}, 100)`;
      } else {
        // Cavity particles
        ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
      }
      
      ctx.fill();
    });
  }

  function drawSoundWave() {
    // External sound wave approaching resonator
    const waveX = 50;
    const waveLength = 60;
    const amplitude = 20;
    
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    for (let x = 0; x < 150; x += 2) {
      const y = CAVITY_Y + CAVITY_HEIGHT / 2 + 
                amplitude * Math.sin((x - time * 100) * Math.PI / waveLength);
      
      if (x === 0) {
        ctx.moveTo(waveX + x, y);
      } else {
        ctx.lineTo(waveX + x, y);
      }
    }
    ctx.stroke();
    
    // Wave frequency label
    ctx.fillStyle = "#f59e0b";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`f = ${excitationFrequency} Hz`, waveX + 75, CAVITY_Y + CAVITY_HEIGHT / 2 - 40);
  }

  function drawFrequencyResponse() {
    if (frequencyResponse.length === 0) return;
    
    const graphX = width - 300;
    const graphY = 50;
    const graphWidth = 250;
    const graphHeight = 150;
    
    // Graph background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(graphX, graphY, graphWidth, graphHeight);
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);
    
    // Plot response curve
    const maxAmplitude = Math.max(...frequencyResponse.map(p => p.amplitude));
    
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    frequencyResponse.forEach((point, i) => {
      const x = graphX + (point.freq - 50) / (1000 - 50) * graphWidth;
      const y = graphY + graphHeight - (point.amplitude / maxAmplitude) * graphHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Current frequency marker
    const currentX = graphX + (excitationFrequency - 50) / (1000 - 50) * graphWidth;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, graphY);
    ctx.lineTo(currentX, graphY + graphHeight);
    ctx.stroke();
    
    // Resonant frequency marker
    const resonantFreq = calculateResonantFrequency();
    const resonantX = graphX + (resonantFreq - 50) / (1000 - 50) * graphWidth;
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(resonantX, graphY);
    ctx.lineTo(resonantX, graphY + graphHeight);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Labels
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Frequency Response", graphX + 10, graphY - 5);
    
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("50 Hz", graphX, graphY + graphHeight + 15);
    ctx.fillText("1000 Hz", graphX + graphWidth - 30, graphY + graphHeight + 15);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    
    initializeAirParticles();
    generateFrequencyResponse();
  }

  function update(dt: number, params: Record<string, number>): void {
    cavityVolume = (params.cavityVolume ?? 1) * 0.001; // Convert L to m³
    neckLength = (params.neckLength ?? 5) * 0.01; // Convert cm to m
    neckDiameter = (params.neckDiameter ?? 2) * 0.01; // Convert cm to m
    excitationFrequency = params.excitationFrequency ?? 300;
    dampingFactor = params.dampingFactor ?? 0.05;

    time += dt;
    
    updateResonatorPhysics(dt);
    
    // Regenerate frequency response if parameters changed
    if (Math.floor(time * 2) % 10 === 0) {
      generateFrequencyResponse();
    }
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    drawSoundWave();
    drawResonator();
    drawAirParticles();
    drawFrequencyResponse();

    const resonantFreq = calculateResonantFrequency();
    const qualityFactor = calculateQualityFactor();

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 350, 220);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText("Helmholtz Resonator", 20, 30);
    
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#10b981";
    ctx.fillText("f = (v/2π)√(A/V(L+ΔL))", 20, 55);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Cavity Volume: V = ${(cavityVolume * 1000).toFixed(1)} L`, 20, 80);
    ctx.fillText(`Neck Length: L = ${(neckLength * 100).toFixed(1)} cm`, 20, 100);
    ctx.fillText(`Neck Diameter: d = ${(neckDiameter * 100).toFixed(1)} cm`, 20, 120);
    ctx.fillText(`Excitation Frequency: ${excitationFrequency} Hz`, 20, 140);
    
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText(`Resonant Frequency: ${resonantFreq.toFixed(1)} Hz`, 20, 165);
    ctx.fillText(`Quality Factor: Q = ${qualityFactor.toFixed(1)}`, 20, 185);
    
    // Air displacement
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Air Displacement: ${airDisplacement.toFixed(3)}`, 20, 205);

    // Theory panel
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(width - 300, height - 140, 290, 130);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Helmholtz Resonance:", width - 290, height - 115);
    ctx.fillText("• Air in neck acts as mass", width - 290, height - 95);
    ctx.fillText("• Cavity acts as spring", width - 290, height - 75);
    ctx.fillText("• Resonant frequency depends on", width - 290, height - 55);
    ctx.fillText("  geometry, not material", width - 290, height - 40);
    ctx.fillText("• Used in musical instruments", width - 290, height - 25);

    // Applications
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Applications: Musical instruments (bottles, ocarinas), acoustic filters, mufflers", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
    airDisplacement = 0;
    airVelocity = 0;
    cavityPressure = 0;
    initializeAirParticles();
    generateFrequencyResponse();
  }

  function destroy(): void {
    airParticles.length = 0;
    frequencyResponse.length = 0;
  }

  function getStateDescription(): string {
    const resonantFreq = calculateResonantFrequency();
    const qualityFactor = calculateQualityFactor();
    const neckArea = Math.PI * (neckDiameter / 2) ** 2;
    
    return (
      `Helmholtz Resonator: cavity volume V=${(cavityVolume * 1000).toFixed(1)}L, neck L=${(neckLength * 100).toFixed(1)}cm × d=${(neckDiameter * 100).toFixed(1)}cm. ` +
      `Resonant frequency fr=${resonantFreq.toFixed(1)}Hz, Q-factor=${qualityFactor.toFixed(1)}. ` +
      `Excitation at f=${excitationFrequency}Hz, air displacement=${airDisplacement.toFixed(3)}. ` +
      `Demonstrates acoustic cavity resonance where air mass in neck oscillates against cavity spring.`
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

export default HelmholtzResonatorFactory;