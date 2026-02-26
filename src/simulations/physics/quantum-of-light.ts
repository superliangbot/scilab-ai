import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const QuantumOfLightFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("quantum-of-light") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let wavelength = 500; // nm
  let intensity = 5;
  let workFunction = 2.0; // eV
  let showPhotons = 1;

  interface Photon {
    x: number; y: number;
    vx: number; vy: number;
    active: boolean;
    wavelength: number;
  }

  interface Electron {
    x: number; y: number;
    vx: number; vy: number;
    life: number;
  }

  let photons: Photon[] = [];
  let electrons: Electron[] = [];
  let emitTimer = 0;

  const h = 6.626e-34; // Planck's constant
  const c = 3e8; // Speed of light
  const eV = 1.602e-19; // electron volt in J

  function wavelengthToColor(wl: number): string {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl >= 645 && wl <= 780) { r = 1; }
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  function photonEnergy(wl: number): number {
    return (h * c) / (wl * 1e-9) / eV; // energy in eV
  }

  function init(cv: HTMLCanvasElement): void {
    canvas = cv;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    photons = [];
    electrons = [];
    emitTimer = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    wavelength = params.wavelength ?? 500;
    intensity = params.intensity ?? 5;
    workFunction = params.workFunction ?? 2.0;
    showPhotons = params.showPhotons ?? 1;
    time += dt;

    // Emit photons
    emitTimer += dt;
    const emitInterval = 0.15 / intensity;
    while (emitTimer >= emitInterval) {
      emitTimer -= emitInterval;
      const plateX = width * 0.55;
      photons.push({
        x: width * 0.1,
        y: height * 0.3 + Math.random() * height * 0.35,
        vx: 200 + Math.random() * 50,
        vy: (Math.random() - 0.5) * 20,
        active: true,
        wavelength,
      });
    }

    // Update photons
    const plateX = width * 0.55;
    for (const p of photons) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Hit the metal plate
      if (p.x >= plateX) {
        p.active = false;
        const energy = photonEnergy(p.wavelength);
        if (energy > workFunction) {
          const ke = energy - workFunction;
          const speed = Math.sqrt(ke) * 80;
          electrons.push({
            x: plateX + 5,
            y: p.y,
            vx: speed * (0.5 + Math.random() * 0.5),
            vy: (Math.random() - 0.5) * speed * 0.5,
            life: 3,
          });
        }
      }
    }

    // Update electrons
    for (const e of electrons) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
    }

    // Clean up
    photons = photons.filter(p => p.active && p.x < width);
    electrons = electrons.filter(e => e.life > 0 && e.x < width && e.y > 0 && e.y < height);
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const plateX = width * 0.55;
    const plateY1 = height * 0.2;
    const plateY2 = height * 0.75;

    // Light source
    ctx.fillStyle = "rgba(80, 80, 100, 0.6)";
    ctx.beginPath();
    ctx.roundRect(width * 0.03, height * 0.28, width * 0.08, height * 0.38, 5);
    ctx.fill();
    ctx.strokeStyle = wavelengthToColor(wavelength);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = wavelengthToColor(wavelength);
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Light", width * 0.07, height * 0.28 - 5);
    ctx.fillText("Source", width * 0.07, height * 0.28 + 8);

    // Draw photons
    if (showPhotons) {
      const color = wavelengthToColor(wavelength);
      for (const p of photons) {
        // Wavy photon line
        ctx.beginPath();
        const waveLen = 8;
        const amp = 3;
        for (let dx = -10; dx <= 0; dx += 1) {
          const px = p.x + dx;
          const py = p.y + Math.sin(((px + time * 200) / waveLen) * Math.PI * 2) * amp;
          if (dx === -10) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Photon dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    // Metal plate
    const plateGrad = ctx.createLinearGradient(plateX, 0, plateX + 20, 0);
    plateGrad.addColorStop(0, "#778899");
    plateGrad.addColorStop(0.5, "#aabbcc");
    plateGrad.addColorStop(1, "#667788");
    ctx.fillStyle = plateGrad;
    ctx.fillRect(plateX, plateY1, 20, plateY2 - plateY1);
    ctx.strokeStyle = "rgba(200, 210, 220, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(plateX, plateY1, 20, plateY2 - plateY1);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Metal", plateX + 10, plateY1 - 8);
    ctx.fillText("Plate", plateX + 10, plateY1 + 5);

    // Draw ejected electrons
    for (const e of electrons) {
      const alpha = Math.min(1, e.life);
      ctx.beginPath();
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(200, 240, 255, ${alpha * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // e⁻ label
      ctx.fillStyle = `rgba(200, 240, 255, ${alpha * 0.7})`;
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("e⁻", e.x, e.y - 7);
    }

    // Collector electrode
    ctx.fillStyle = "rgba(100, 80, 60, 0.6)";
    ctx.fillRect(width * 0.82, plateY1, 12, plateY2 - plateY1);
    ctx.strokeStyle = "rgba(160, 140, 120, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(width * 0.82, plateY1, 12, plateY2 - plateY1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Collector", width * 0.826, plateY1 - 5);

    // Energy calculations
    const energy = photonEnergy(wavelength);
    const ke = Math.max(0, energy - workFunction);
    const threshold = (h * c) / (workFunction * eV) * 1e9;
    const ejected = energy > workFunction;

    // Info panel
    const panelX = width * 0.03;
    const panelY = height * 0.72;
    const panelW = width * 0.94;
    const panelH = height * 0.25;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("Photoelectric Effect — E = hf = hc/λ", panelX + 12, panelY + 20);

    const col1 = panelX + 12;
    const col2 = panelX + panelW * 0.38;
    const col3 = panelX + panelW * 0.68;
    let iy = panelY + 42;

    ctx.font = "12px 'SF Mono', monospace";

    ctx.fillStyle = wavelengthToColor(wavelength);
    ctx.fillText(`λ = ${wavelength} nm`, col1, iy);
    ctx.fillStyle = "rgba(255, 200, 100, 0.9)";
    ctx.fillText(`E = ${energy.toFixed(3)} eV`, col2, iy);
    ctx.fillStyle = "rgba(180, 220, 255, 0.9)";
    ctx.fillText(`φ = ${workFunction.toFixed(2)} eV`, col3, iy);
    iy += 20;

    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.fillText(`f = ${(c / (wavelength * 1e-9) / 1e12).toFixed(1)} THz`, col1, iy);
    ctx.fillStyle = ejected ? "rgba(100, 255, 100, 0.9)" : "rgba(255, 100, 100, 0.9)";
    ctx.fillText(`KE = ${ke.toFixed(3)} eV`, col2, iy);
    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.fillText(`λ₀ = ${threshold.toFixed(0)} nm`, col3, iy);
    iy += 22;

    ctx.fillStyle = ejected ? "rgba(100, 255, 100, 0.9)" : "rgba(255, 100, 100, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(
      ejected
        ? `Electrons ejected! KE_max = hf - φ = ${ke.toFixed(3)} eV`
        : `No emission: photon energy (${energy.toFixed(3)} eV) < work function (${workFunction.toFixed(2)} eV)`,
      col1, iy
    );

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    photons = [];
    electrons = [];
    emitTimer = 0;
  }

  function destroy(): void {
    photons = [];
    electrons = [];
  }

  function getStateDescription(): string {
    const energy = photonEnergy(wavelength);
    const ke = Math.max(0, energy - workFunction);
    const ejected = energy > workFunction;
    return (
      `Photoelectric effect: λ = ${wavelength} nm, photon energy = ${energy.toFixed(3)} eV, ` +
      `work function φ = ${workFunction} eV. ${ejected ? `Electrons ejected with KE = ${ke.toFixed(3)} eV.` : "No electron emission (E < φ)."} ` +
      `Intensity = ${intensity}, ${photons.length} photons, ${electrons.length} electrons. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default QuantumOfLightFactory;
