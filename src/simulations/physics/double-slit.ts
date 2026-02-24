import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DoubleSlitFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("double-slit") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let wavelength = 500; // nm
  let slitSeparation = 50; // μm
  let slitWidth = 10; // μm
  let screenDistance = 2; // m

  function wavelengthToColor(nm: number, alpha: number = 1): string {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm >= 440 && nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm >= 490 && nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm >= 510 && nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm >= 580 && nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm >= 645 && nm <= 780) { r = 1; }
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    wavelength = params.wavelength ?? 500;
    slitSeparation = params.slitSeparation ?? 50;
    slitWidth = params.slitWidth ?? 10;
    screenDistance = params.screenDistance ?? 2;
    time += dt;
  }

  // Calculate double-slit intensity pattern
  function intensity(theta: number): number {
    const lambdaM = wavelength * 1e-9; // nm to m
    const dM = slitSeparation * 1e-6; // μm to m
    const aM = slitWidth * 1e-6; // μm to m

    // Single slit diffraction envelope
    const beta = (Math.PI * aM * Math.sin(theta)) / lambdaM;
    const singleSlit = beta === 0 ? 1 : Math.pow(Math.sin(beta) / beta, 2);

    // Double slit interference
    const delta = (Math.PI * dM * Math.sin(theta)) / lambdaM;
    const doubleSlit = Math.pow(Math.cos(delta), 2);

    return singleSlit * doubleSlit;
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const sourceX = width * 0.05;
    const barrierX = width * 0.3;
    const screenX = width * 0.85;
    const centerY = height / 2;

    // Draw light source
    const lightColor = wavelengthToColor(wavelength);
    const glow = ctx.createRadialGradient(sourceX, centerY, 0, sourceX, centerY, 25);
    glow.addColorStop(0, wavelengthToColor(wavelength, 0.8));
    glow.addColorStop(1, wavelengthToColor(wavelength, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sourceX, centerY, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.arc(sourceX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw incoming waves
    ctx.strokeStyle = wavelengthToColor(wavelength, 0.2);
    ctx.lineWidth = 1;
    const waveSpacing = 12;
    const numWaves = Math.floor((barrierX - sourceX) / waveSpacing);
    for (let i = 0; i < numWaves; i++) {
      const phase = (time * 80 + i * waveSpacing) % (barrierX - sourceX);
      const wx = sourceX + phase;
      if (wx < barrierX) {
        ctx.beginPath();
        ctx.moveTo(wx, centerY - height * 0.4);
        ctx.lineTo(wx, centerY + height * 0.4);
        ctx.stroke();
      }
    }

    // Draw barrier with slits
    const slitPixelSep = height * 0.12;
    const slitPixelWidth = Math.max(4, height * 0.02);

    ctx.fillStyle = "#555";
    ctx.fillRect(barrierX - 4, 0, 8, centerY - slitPixelSep / 2 - slitPixelWidth / 2);
    ctx.fillRect(barrierX - 4, centerY - slitPixelSep / 2 + slitPixelWidth / 2, 8,
      slitPixelSep - slitPixelWidth);
    ctx.fillRect(barrierX - 4, centerY + slitPixelSep / 2 + slitPixelWidth / 2, 8,
      height - (centerY + slitPixelSep / 2 + slitPixelWidth / 2));

    // Slit openings glow
    for (const dy of [-slitPixelSep / 2, slitPixelSep / 2]) {
      ctx.fillStyle = wavelengthToColor(wavelength, 0.5);
      ctx.fillRect(barrierX - 4, centerY + dy - slitPixelWidth / 2, 8, slitPixelWidth);
    }

    // Draw diffraction waves from slits
    ctx.globalAlpha = 0.15;
    for (const dy of [-slitPixelSep / 2, slitPixelSep / 2]) {
      const sy = centerY + dy;
      ctx.strokeStyle = lightColor;
      ctx.lineWidth = 1;
      for (let r = 0; r < 15; r++) {
        const radius = ((time * 80 + r * waveSpacing) % (width * 0.8));
        if (radius > 5) {
          ctx.beginPath();
          ctx.arc(barrierX, sy, radius, -Math.PI / 2.5, Math.PI / 2.5);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Draw interference pattern on screen
    const screenW = 12;
    const patternHeight = height * 0.9;
    const steps = Math.round(patternHeight);

    for (let py = 0; py < steps; py++) {
      const y = (height - patternHeight) / 2 + py;
      const yFromCenter = y - centerY;
      const theta = Math.atan2(yFromCenter * 0.0001, screenDistance);
      const I = intensity(theta);
      ctx.fillStyle = wavelengthToColor(wavelength, I);
      ctx.fillRect(screenX - screenW / 2, y, screenW, 1);
    }

    // Draw intensity graph next to screen
    const graphX = screenX + 20;
    const graphW = width - graphX - 10;

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, (height - patternHeight) / 2);
    ctx.lineTo(graphX, (height + patternHeight) / 2);
    ctx.stroke();

    ctx.strokeStyle = lightColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let py = 0; py < steps; py++) {
      const y = (height - patternHeight) / 2 + py;
      const yFromCenter = y - centerY;
      const theta = Math.atan2(yFromCenter * 0.0001, screenDistance);
      const I = intensity(theta);
      const gx = graphX + I * graphW;
      if (!started) { ctx.moveTo(gx, y); started = true; }
      else ctx.lineTo(gx, y);
    }
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Source", sourceX, centerY + 40);
    ctx.fillText("Barrier", barrierX, 18);
    ctx.fillText("Screen", screenX, 18);
    ctx.fillText("I(θ)", graphX + graphW / 2, 18);

    // Slit labels
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`d = ${slitSeparation} μm`, barrierX, height - 35);
    ctx.fillText(`a = ${slitWidth} μm`, barrierX, height - 20);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 220, 80, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Double-Slit Experiment", 16, 28);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#ccc";
    const fringeSpacing = (wavelength * 1e-9 * screenDistance) / (slitSeparation * 1e-6) * 1000;
    ctx.fillText(`λ = ${wavelength} nm`, 16, 46);
    ctx.fillText(`L = ${screenDistance} m`, 16, 60);
    ctx.fillText(`Fringe spacing: ${fringeSpacing.toFixed(2)} mm`, 16, 74);

    // Formula
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("I = cos²(πd sinθ/λ) × sinc²(πa sinθ/λ)", width / 2, height - 8);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const fringeSpacing = (wavelength * 1e-9 * screenDistance) / (slitSeparation * 1e-6) * 1000;
    return (
      `Double-Slit Experiment: wavelength=${wavelength} nm, ` +
      `slit separation d=${slitSeparation} μm, slit width a=${slitWidth} μm, ` +
      `screen distance L=${screenDistance} m. ` +
      `Fringe spacing Δy = λL/d = ${fringeSpacing.toFixed(2)} mm. ` +
      `Pattern shows interference fringes modulated by single-slit diffraction envelope. ` +
      `Demonstrates wave nature of light.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DoubleSlitFactory;
