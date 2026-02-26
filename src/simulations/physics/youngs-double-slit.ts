import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const YoungsDoubleSlitFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("youngs-double-slit") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let wavelength = 500; // nm
  let slitSeparation = 0.5; // mm
  let slitWidth = 0.1; // mm
  let screenDistance = 1; // m

  function wavelengthToColor(wl: number, alpha: number = 1): string {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl >= 645 && wl <= 780) { r = 1; }
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
    slitSeparation = params.slitSeparation ?? 0.5;
    slitWidth = params.slitWidth ?? 0.1;
    screenDistance = params.screenDistance ?? 1;
    time += dt;
  }

  function doubleSlitIntensity(y: number): number {
    // y is position on screen in mm
    // Double slit: I = I₀ cos²(πdy/λL) × [sin(πay/λL)/(πay/λL)]²
    const wlMM = wavelength * 1e-6; // nm to mm
    const dPhase = Math.PI * slitSeparation * y / (wlMM * screenDistance * 1000);
    const aPhase = Math.PI * slitWidth * y / (wlMM * screenDistance * 1000);

    const interference = Math.cos(dPhase) ** 2;
    const diffraction = aPhase !== 0 ? (Math.sin(aPhase) / aPhase) ** 2 : 1;

    return interference * diffraction;
  }

  function render(): void {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const barrierX = width * 0.35;
    const screenX = width * 0.75;
    const cy = height * 0.5;

    // Light source
    const srcX = width * 0.08;
    const srcGlow = ctx.createRadialGradient(srcX, cy, 2, srcX, cy, 30);
    srcGlow.addColorStop(0, wavelengthToColor(wavelength, 0.8));
    srcGlow.addColorStop(1, wavelengthToColor(wavelength, 0));
    ctx.beginPath();
    ctx.arc(srcX, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = srcGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(srcX, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = wavelengthToColor(wavelength, 1);
    ctx.fill();

    // Incoming wavefronts
    const waveCount = 8;
    for (let i = 0; i < waveCount; i++) {
      const phase = ((time * 3 + i / waveCount) % 1) * (barrierX - srcX);
      const wx = srcX + phase;
      if (wx < barrierX) {
        ctx.beginPath();
        ctx.arc(srcX, cy, phase, -0.3, 0.3);
        ctx.strokeStyle = wavelengthToColor(wavelength, 0.2);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Barrier with double slit
    const slitGap = 30; // pixel gap between slits
    const slitH = 8;

    ctx.fillStyle = "#333";
    // Top section
    ctx.fillRect(barrierX - 3, 0, 6, cy - slitGap / 2 - slitH / 2);
    // Middle section (between slits)
    ctx.fillRect(barrierX - 3, cy - slitGap / 2 + slitH / 2, 6, slitGap - slitH);
    // Bottom section
    ctx.fillRect(barrierX - 3, cy + slitGap / 2 + slitH / 2, 6, height);

    // Slit glow
    ctx.fillStyle = wavelengthToColor(wavelength, 0.5);
    ctx.fillRect(barrierX - 1, cy - slitGap / 2 - slitH / 2, 2, slitH);
    ctx.fillRect(barrierX - 1, cy + slitGap / 2 - slitH / 2, 2, slitH);

    // Wavefronts from slits
    const slit1Y = cy - slitGap / 2;
    const slit2Y = cy + slitGap / 2;

    for (let i = 0; i < 10; i++) {
      const r = ((time * 2 + i * 0.1) % 1) * (screenX - barrierX);
      if (r > 0) {
        ctx.beginPath();
        ctx.arc(barrierX, slit1Y, r, -Math.PI / 2, Math.PI / 2);
        ctx.strokeStyle = wavelengthToColor(wavelength, 0.1 * (1 - r / (screenX - barrierX)));
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(barrierX, slit2Y, r, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
    }

    // Screen
    ctx.fillStyle = "#222";
    ctx.fillRect(screenX, 0, 4, height);

    // Interference pattern on screen
    const patternX = screenX + 10;
    const patternW = width - patternX - 10;
    const screenH = height * 0.8;
    const screenTop = (height - screenH) / 2;

    for (let py = 0; py < screenH; py++) {
      const yMM = ((py - screenH / 2) / screenH) * 10; // -5 to 5 mm
      const intensity = doubleSlitIntensity(yMM);
      const barW = intensity * patternW * 0.8;

      // Color bar
      ctx.fillStyle = wavelengthToColor(wavelength, intensity);
      ctx.fillRect(patternX, screenTop + py, barW, 1.5);

      // On-screen bright dot
      ctx.fillStyle = wavelengthToColor(wavelength, intensity * 0.8);
      ctx.fillRect(screenX - 2, screenTop + py, 4, 1.5);
    }

    // Intensity graph overlay
    ctx.beginPath();
    for (let py = 0; py < screenH; py++) {
      const yMM = ((py - screenH / 2) / screenH) * 10;
      const intensity = doubleSlitIntensity(yMM);
      const gx = patternX + intensity * patternW * 0.8;
      if (py === 0) ctx.moveTo(gx, screenTop + py);
      else ctx.lineTo(gx, screenTop + py);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Source", srcX, cy + 40);
    ctx.fillText("Double Slit", barrierX, height - 10);
    ctx.fillText("Screen", screenX, height - 10);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Young's Double Slit Experiment", width / 2, 22);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, 35, 200, 65, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`λ = ${wavelength} nm`, 20, 50);
    ctx.fillText(`d = ${slitSeparation} mm (slit separation)`, 20, 64);
    ctx.fillText(`a = ${slitWidth} mm (slit width)`, 20, 78);
    ctx.fillText(`Fringe spacing: Δy = λL/d`, 20, 92);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const fringeSpacing = (wavelength * 1e-6 * screenDistance * 1000) / slitSeparation;
    return (
      `Young's Double Slit: λ=${wavelength}nm, d=${slitSeparation}mm, a=${slitWidth}mm, ` +
      `L=${screenDistance}m. Fringe spacing ≈ ${fringeSpacing.toFixed(3)}mm. ` +
      `Shows interference pattern from two coherent sources.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default YoungsDoubleSlitFactory;
