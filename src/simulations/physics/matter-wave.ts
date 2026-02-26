import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MatterWaveFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("matter-wave") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Physical constants (scaled for visualization)
  // h = 6.626e-34 J*s, but we use scaled units for display
  const H_SCALED = 50; // Planck's constant in display units
  const ELECTRON_MASS = 1; // electron mass unit

  // Parameters
  let particleMass = 1; // in electron mass units
  let velocity = 5;     // arbitrary units
  let showProbDensity = 1;
  let wavePacketWidth = 30;

  // Derived quantities
  let wavelength = 0;
  let waveNumber = 0;
  let angularFreq = 0;

  // Particle position for animation
  let particleX = 0;
  const PARTICLE_SPEED_SCALE = 40; // px/s per unit velocity

  // Wave function sampling
  const WAVE_SAMPLES = 500;

  function computeDerivedQuantities(): void {
    // de Broglie: lambda = h / (m * v)
    const mv = particleMass * Math.max(velocity, 0.1);
    wavelength = H_SCALED / mv;
    waveNumber = (2 * Math.PI) / wavelength;
    angularFreq = waveNumber * velocity * 3; // omega = k * v (scaled)
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particleX = width * 0.15;
    computeDerivedQuantities();
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    particleMass = params.particleMass ?? 1;
    velocity = params.velocity ?? 5;
    showProbDensity = params.showProbDensity ?? 1;
    wavePacketWidth = params.wavePacketWidth ?? 30;

    computeDerivedQuantities();

    // Move particle across screen
    particleX += velocity * PARTICLE_SPEED_SCALE * dt;

    // Wrap around
    if (particleX > width + 100) {
      particleX = -100;
    }
  }

  // Gaussian envelope for wave packet
  function gaussianEnvelope(x: number, center: number, sigma: number): number {
    const dx = x - center;
    return Math.exp(-(dx * dx) / (2 * sigma * sigma));
  }

  // Wave function psi(x, t) = envelope * exp(i(kx - wt))
  // Real part: envelope * cos(kx - wt)
  // |psi|^2: envelope^2
  function psiReal(x: number): number {
    const envelope = gaussianEnvelope(x, particleX, wavePacketWidth);
    return envelope * Math.cos(waveNumber * x - angularFreq * time);
  }

  function psiImaginary(x: number): number {
    const envelope = gaussianEnvelope(x, particleX, wavePacketWidth);
    return envelope * Math.sin(waveNumber * x - angularFreq * time);
  }

  function probDensity(x: number): number {
    const env = gaussianEnvelope(x, particleX, wavePacketWidth);
    return env * env;
  }

  function drawBackground(): void {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a0a2e");
    grad.addColorStop(1, "#1a1a3e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawWaveFunction(): void {
    const waveY = height * 0.4; // center line for wave
    const amplitude = height * 0.15;
    const xStart = 0;
    const xEnd = width;
    const dx = (xEnd - xStart) / WAVE_SAMPLES;

    // Draw probability density (filled) if enabled
    if (showProbDensity) {
      ctx.beginPath();
      ctx.moveTo(xStart, waveY);
      for (let i = 0; i <= WAVE_SAMPLES; i++) {
        const x = xStart + i * dx;
        const pd = probDensity(x);
        const y = waveY - pd * amplitude * 1.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(xEnd, waveY);
      ctx.closePath();

      const fillGrad = ctx.createLinearGradient(0, waveY - amplitude * 1.5, 0, waveY);
      fillGrad.addColorStop(0, "rgba(255, 100, 100, 0.5)");
      fillGrad.addColorStop(1, "rgba(255, 100, 100, 0.05)");
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // |psi|^2 outline
      ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= WAVE_SAMPLES; i++) {
        const x = xStart + i * dx;
        const pd = probDensity(x);
        const y = waveY - pd * amplitude * 1.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw real part of psi (blue)
    ctx.strokeStyle = "#4488ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= WAVE_SAMPLES; i++) {
      const x = xStart + i * dx;
      const re = psiReal(x);
      const y = waveY - re * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw imaginary part of psi (green, lighter)
    ctx.strokeStyle = "rgba(100, 255, 150, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= WAVE_SAMPLES; i++) {
      const x = xStart + i * dx;
      const im = psiImaginary(x);
      const y = waveY - im * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Center line
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, waveY);
    ctx.lineTo(width, waveY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    const labelX = width * 0.02;
    const fontSize = Math.max(10, height * 0.02);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "left";

    ctx.fillStyle = "#4488ff";
    ctx.fillText("Re[\u03C8(x,t)]", labelX, waveY - amplitude - 10);

    ctx.fillStyle = "rgba(100, 255, 150, 0.7)";
    ctx.fillText("Im[\u03C8(x,t)]", labelX, waveY - amplitude + 6);

    if (showProbDensity) {
      ctx.fillStyle = "rgba(255, 100, 100, 0.9)";
      ctx.fillText("|\u03C8|\u00B2 probability density", labelX, waveY - amplitude - 26);
    }
  }

  function drawParticle(): void {
    // Particle as a glowing dot at the wave packet center
    const waveY = height * 0.4;

    // Glow
    const glowRadius = 15 + 3 * Math.sin(time * 3);
    const glow = ctx.createRadialGradient(
      particleX, waveY, 0,
      particleX, waveY, glowRadius
    );
    glow.addColorStop(0, "rgba(255, 255, 200, 0.9)");
    glow.addColorStop(0.4, "rgba(255, 200, 100, 0.4)");
    glow.addColorStop(1, "rgba(255, 200, 100, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(particleX, waveY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Core
    const radius = particleMass > 100 ? 6 : 4;
    ctx.fillStyle = particleMass > 100 ? "#ff6644" : "#ffee44";
    ctx.beginPath();
    ctx.arc(particleX, waveY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Velocity arrow
    const arrowLen = Math.min(60, velocity * 6);
    if (arrowLen > 5) {
      const arrowY = waveY + 30;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(particleX - arrowLen / 2, arrowY);
      ctx.lineTo(particleX + arrowLen / 2, arrowY);
      // Arrowhead
      ctx.lineTo(particleX + arrowLen / 2 - 6, arrowY - 4);
      ctx.moveTo(particleX + arrowLen / 2, arrowY);
      ctx.lineTo(particleX + arrowLen / 2 - 6, arrowY + 4);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${Math.max(9, height * 0.017)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("v", particleX, arrowY + 16);
    }
  }

  function drawWavelengthIndicator(): void {
    if (wavelength < 2 || wavelength > width) return;

    const waveY = height * 0.4;
    const indicatorY = waveY + height * 0.12;

    // Draw wavelength bracket near particle
    const startX = particleX - wavelength / 2;
    const endX = particleX + wavelength / 2;

    ctx.strokeStyle = "rgba(255, 200, 0, 0.7)";
    ctx.lineWidth = 1.5;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(startX, indicatorY);
    ctx.lineTo(endX, indicatorY);
    ctx.stroke();

    // Vertical ticks
    const tickH = 6;
    ctx.beginPath();
    ctx.moveTo(startX, indicatorY - tickH);
    ctx.lineTo(startX, indicatorY + tickH);
    ctx.moveTo(endX, indicatorY - tickH);
    ctx.lineTo(endX, indicatorY + tickH);
    ctx.stroke();

    // Lambda label
    ctx.fillStyle = "rgba(255, 200, 0, 0.9)";
    ctx.font = `bold ${Math.max(11, height * 0.024)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("\u03BB", (startX + endX) / 2, indicatorY - 10);
  }

  function drawInfoPanel(): void {
    const panelX = width * 0.02;
    const panelY = height * 0.65;
    const panelW = width * 0.48;
    const panelH = height * 0.32;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(panelX, panelY, panelW, panelH);

    const fontSize = Math.max(11, Math.min(height * 0.024, 14));
    const lineH = fontSize + 6;
    let y = panelY + lineH + 4;

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${fontSize + 2}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("de Broglie Matter Wave", panelX + 10, y);
    y += lineH + 4;

    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = "#ddd";

    // Formula
    ctx.fillText("\u03BB = h / (mv) = h / p", panelX + 10, y);
    y += lineH;

    // Current values
    const particleName = particleMass < 10 ? "electron" :
      particleMass < 500 ? "light particle" :
      particleMass < 2000 ? "proton-like" : "heavy particle";

    ctx.fillStyle = "#aaf";
    ctx.fillText(`Particle: ${particleName} (m = ${particleMass.toFixed(0)} m\u2091)`, panelX + 10, y);
    y += lineH;

    ctx.fillStyle = "#afa";
    ctx.fillText(`Velocity: ${velocity.toFixed(1)} (arb. units)`, panelX + 10, y);
    y += lineH;

    ctx.fillStyle = "#ffa";
    ctx.fillText(`Momentum p = mv = ${(particleMass * velocity).toFixed(1)}`, panelX + 10, y);
    y += lineH;

    ctx.fillStyle = "#fda";
    ctx.fillText(`Wavelength \u03BB = ${wavelength.toFixed(2)} (display units)`, panelX + 10, y);
    y += lineH;

    // Key insight
    ctx.fillStyle = "#ff9";
    ctx.font = `italic ${fontSize}px sans-serif`;
    if (velocity > 7) {
      ctx.fillText("Fast particle \u2192 short wavelength (more particle-like)", panelX + 10, y);
    } else if (velocity < 3) {
      ctx.fillText("Slow particle \u2192 long wavelength (more wave-like)", panelX + 10, y);
    } else {
      ctx.fillText("Moderate speed \u2192 wave-particle duality visible", panelX + 10, y);
    }
  }

  function drawComparisonPanel(): void {
    const panelX = width * 0.52;
    const panelY = height * 0.65;
    const panelW = width * 0.46;
    const panelH = height * 0.32;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(panelX, panelY, panelW, panelH);

    const fontSize = Math.max(10, Math.min(height * 0.022, 13));
    const lineH = fontSize + 5;
    let y = panelY + lineH + 4;

    ctx.fillStyle = "#fff";
    ctx.font = `bold ${fontSize + 1}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Wavelength Comparison", panelX + 10, y);
    y += lineH + 6;

    // Compare different scenarios
    const scenarios = [
      { name: "Electron, v=10", mass: 1, vel: 10 },
      { name: "Electron, v=2", mass: 1, vel: 2 },
      { name: "Proton, v=10", mass: 1836, vel: 10 },
      { name: "Proton, v=2", mass: 1836, vel: 2 },
    ];

    const maxBarWidth = panelW - 120;

    ctx.font = `${fontSize}px sans-serif`;

    for (const s of scenarios) {
      const lambda = H_SCALED / (s.mass * s.vel);
      const barWidth = Math.min(maxBarWidth, lambda * 2);
      const isCurrentish =
        Math.abs(s.mass - particleMass) < 5 && Math.abs(s.vel - velocity) < 2;

      // Bar
      ctx.fillStyle = isCurrentish ? "rgba(255, 200, 0, 0.7)" : "rgba(100, 150, 255, 0.5)";
      ctx.fillRect(panelX + 110, y - fontSize + 2, barWidth, fontSize);

      // Label
      ctx.fillStyle = isCurrentish ? "#ff0" : "#ccc";
      ctx.textAlign = "left";
      ctx.fillText(s.name, panelX + 10, y);

      // Lambda value
      ctx.fillStyle = "#aaa";
      ctx.textAlign = "right";
      ctx.fillText(`\u03BB=${lambda.toFixed(1)}`, panelX + panelW - 10, y);

      y += lineH + 2;
    }

    // Physics note
    y += 4;
    ctx.fillStyle = "#888";
    ctx.font = `italic ${Math.max(9, fontSize - 1)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Heavier / faster \u2192 shorter \u03BB \u2192 more classical", panelX + 10, y);
    y += lineH;
    ctx.fillText("Lighter / slower \u2192 longer \u03BB \u2192 more quantum", panelX + 10, y);
  }

  function drawTitle(): void {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `bold ${Math.max(14, height * 0.035)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Matter Wave (de Broglie)", 12, 30);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(10, height * 0.02)}px sans-serif`;
    ctx.fillText("Wave-particle duality: every particle has an associated wavelength", 12, 50);
  }

  function render(): void {
    drawBackground();
    drawWaveFunction();
    drawParticle();
    drawWavelengthIndicator();
    drawInfoPanel();
    drawComparisonPanel();
    drawTitle();
  }

  function reset(): void {
    time = 0;
    particleX = width * 0.15;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const particleName = particleMass < 10 ? "electron" :
      particleMass < 500 ? "light particle" :
      particleMass < 2000 ? "proton-mass particle" : "heavy particle";
    const momentum = (particleMass * velocity).toFixed(1);
    return `Visualizing de Broglie matter wave for a ${particleName} ` +
      `(mass = ${particleMass.toFixed(0)} electron masses) moving at velocity ${velocity.toFixed(1)}. ` +
      `The de Broglie wavelength lambda = h/(mv) = h/${momentum} = ${wavelength.toFixed(2)} display units. ` +
      `The wave packet shows the quantum mechanical wave function psi(x,t): ` +
      `blue is the real part, green is imaginary, red fill is |psi|^2 probability density. ` +
      `Key insight: heavier or faster particles have shorter wavelengths (more classical), ` +
      `while lighter or slower particles have longer wavelengths (more quantum/wave-like). ` +
      `This wave-particle duality is fundamental to quantum mechanics.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MatterWaveFactory;
