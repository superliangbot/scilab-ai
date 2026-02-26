import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RainbowColorsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rainbow-colors") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let selectedWavelength = 550;
  let showWavelengths = 1;
  let bandWidth = 100;

  const spectrum = [
    { name: "Violet", wlMin: 380, wlMax: 450, freq: "670-790 THz" },
    { name: "Blue", wlMin: 450, wlMax: 490, freq: "610-670 THz" },
    { name: "Cyan", wlMin: 490, wlMax: 510, freq: "590-610 THz" },
    { name: "Green", wlMin: 510, wlMax: 570, freq: "530-590 THz" },
    { name: "Yellow", wlMin: 570, wlMax: 590, freq: "510-530 THz" },
    { name: "Orange", wlMin: 590, wlMax: 620, freq: "480-510 THz" },
    { name: "Red", wlMin: 620, wlMax: 780, freq: "380-480 THz" },
  ];

  function wavelengthToRGB(wl: number): { r: number; g: number; b: number } {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl >= 645 && wl <= 780) { r = 1; }

    // Intensity correction at edges
    let factor = 0;
    if (wl >= 380 && wl < 420) factor = 0.3 + 0.7 * (wl - 380) / 40;
    else if (wl >= 420 && wl <= 700) factor = 1;
    else if (wl > 700 && wl <= 780) factor = 0.3 + 0.7 * (780 - wl) / 80;

    return { r: r * factor, g: g * factor, b: b * factor };
  }

  function wlToColor(wl: number): string {
    const { r, g, b } = wavelengthToRGB(wl);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    selectedWavelength = params.selectedWavelength ?? 550;
    showWavelengths = params.showWavelengths ?? 1;
    bandWidth = params.bandWidth ?? 100;
    time += dt;
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw continuous spectrum bar
    const specX = width * 0.08;
    const specW = width * 0.84;
    const specY = height * 0.12;
    const specH = height * 0.12;

    for (let x = 0; x < specW; x++) {
      const wl = 380 + (x / specW) * 400;
      ctx.fillStyle = wlToColor(wl);
      ctx.fillRect(specX + x, specY, 2, specH);
    }

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(specX, specY, specW, specH);

    // Wavelength markers
    if (showWavelengths) {
      for (let wl = 400; wl <= 750; wl += 50) {
        const x = specX + ((wl - 380) / 400) * specW;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, specY + specH);
        ctx.lineTo(x, specY + specH + 8);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${wl}`, x, specY + specH + 18);
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Wavelength (nm)", specX + specW / 2, specY + specH + 30);
    }

    // Selected wavelength indicator
    const selX = specX + ((selectedWavelength - 380) / 400) * specW;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(selX, specY - 5);
    ctx.lineTo(selX, specY + specH + 5);
    ctx.stroke();
    // Triangle indicator
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(selX, specY - 5);
    ctx.lineTo(selX - 5, specY - 12);
    ctx.lineTo(selX + 5, specY - 12);
    ctx.closePath();
    ctx.fill();

    // Rainbow arc display
    const arcCx = width * 0.5;
    const arcCy = height * 0.95;
    const arcR = height * 0.4;

    for (let wl = 380; wl <= 780; wl += 1) {
      const angle = -Math.PI * (0.2 + ((wl - 380) / 400) * 0.6);
      const r = arcR + ((wl - 380) / 400) * bandWidth * 0.5;
      ctx.beginPath();
      ctx.arc(arcCx, arcCy, r, angle - 0.01, angle + 0.01);
      ctx.strokeStyle = wlToColor(wl);
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Color band labels on the arc
    for (const band of spectrum) {
      const midWl = (band.wlMin + band.wlMax) / 2;
      const angle = -Math.PI * (0.2 + ((midWl - 380) / 400) * 0.6);
      const r = arcR + ((midWl - 380) / 400) * bandWidth * 0.5 - 20;
      const lx = arcCx + Math.cos(angle) * r;
      const ly = arcCy + Math.sin(angle) * r;
      ctx.fillStyle = wlToColor(midWl);
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(band.name, lx, ly);
    }

    // Selected color large swatch
    const swatchX = width * 0.05;
    const swatchY = height * 0.5;
    const swatchSize = 60;

    ctx.fillStyle = wlToColor(selectedWavelength);
    ctx.beginPath();
    ctx.roundRect(swatchX, swatchY, swatchSize, swatchSize, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Selected color info
    const { r, g, b } = wavelengthToRGB(selectedWavelength);
    const freq = (3e8 / (selectedWavelength * 1e-9) / 1e12).toFixed(1);
    const energy = ((6.626e-34 * 3e8) / (selectedWavelength * 1e-9) / 1.602e-19).toFixed(3);

    let iy = swatchY + 5;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    const infoX = swatchX + swatchSize + 12;

    ctx.fillStyle = wlToColor(selectedWavelength);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(`${selectedWavelength} nm`, infoX, iy);
    iy += 20;

    ctx.font = "11px 'SF Mono', monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Frequency: ${freq} THz`, infoX, iy);
    iy += 16;
    ctx.fillText(`Energy: ${energy} eV`, infoX, iy);
    iy += 16;
    ctx.fillText(`RGB: (${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`, infoX, iy);

    // Find which band
    const band = spectrum.find(s => selectedWavelength >= s.wlMin && selectedWavelength < s.wlMax);
    if (band) {
      iy += 16;
      ctx.fillStyle = wlToColor(selectedWavelength);
      ctx.fillText(`Band: ${band.name}`, infoX, iy);
    }

    // Electromagnetic spectrum context (right side)
    const emX = width * 0.6;
    const emY = height * 0.48;
    const emW = width * 0.37;
    const emH = height * 0.35;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(emX, emY, emW, emH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Visible Spectrum", emX + emW / 2, emY + 18);

    const emBands = [
      { name: "Violet", range: "380-450 nm", color: "#8800cc" },
      { name: "Blue", range: "450-490 nm", color: "#0044ff" },
      { name: "Cyan", range: "490-510 nm", color: "#00cccc" },
      { name: "Green", range: "510-570 nm", color: "#00cc00" },
      { name: "Yellow", range: "570-590 nm", color: "#ffdd00" },
      { name: "Orange", range: "590-620 nm", color: "#ff7700" },
      { name: "Red", range: "620-780 nm", color: "#ff0000" },
    ];

    let by = emY + 38;
    for (const eb of emBands) {
      ctx.fillStyle = eb.color;
      ctx.fillRect(emX + 10, by - 6, 10, 10);
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(eb.name, emX + 26, by + 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.textAlign = "right";
      ctx.fillText(eb.range, emX + emW - 10, by + 2);
      by += 16;
    }

    // Wave representation of selected color
    const waveY = height * 0.88;
    const waveW = width * 0.5;
    const waveX = width * 0.25;
    ctx.beginPath();
    for (let x = 0; x < waveW; x++) {
      const wlScale = selectedWavelength / 50;
      const py = waveY + Math.sin(((x / wlScale) + time * 5) * Math.PI * 2) * 15;
      if (x === 0) ctx.moveTo(waveX + x, py);
      else ctx.lineTo(waveX + x, py);
    }
    ctx.strokeStyle = wlToColor(selectedWavelength);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`λ = ${selectedWavelength} nm`, waveX + waveW / 2, waveY + 25);

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Rainbow Colors — Visible Light Spectrum", width / 2, height * 0.08);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; }
  function destroy(): void {}

  function getStateDescription(): string {
    const freq = (3e8 / (selectedWavelength * 1e-9) / 1e12).toFixed(1);
    const energy = ((6.626e-34 * 3e8) / (selectedWavelength * 1e-9) / 1.602e-19).toFixed(3);
    const band = spectrum.find(s => selectedWavelength >= s.wlMin && selectedWavelength < s.wlMax);
    return (
      `Rainbow colors: selected wavelength ${selectedWavelength} nm (${band?.name ?? "—"}). ` +
      `Frequency: ${freq} THz, energy: ${energy} eV. ` +
      `Visible light spans 380-780 nm (violet to red). ` +
      `ROYGBIV: Red, Orange, Yellow, Green, Blue, Indigo, Violet. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RainbowColorsFactory;
