import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PhotoelectricEffect2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("photoelectric-effect-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let wavelength = 400; // nm
  let intensity = 5;
  let voltage = 0; // stopping voltage
  let metalWorkFunction = 2.3; // eV (sodium default)

  // Constants
  const h = 6.626e-34; // Planck's constant
  const c = 3e8; // speed of light
  const eCharge = 1.602e-19;

  // Photons and electrons
  let photons: Array<{ x: number; y: number; vx: number; vy: number; alive: boolean }> = [];
  let electrons: Array<{ x: number; y: number; vx: number; vy: number; alive: boolean }> = [];
  let spawnTimer = 0;

  // Graph data
  let graphPoints: Array<{ v: number; i: number }> = [];

  // Layout
  let cathodeX = 0, anodeX = 0, plateY1 = 0, plateY2 = 0;

  function layout() {
    cathodeX = width * 0.35;
    anodeX = width * 0.6;
    plateY1 = height * 0.2;
    plateY2 = height * 0.65;
  }

  function wavelengthToColor(wl: number): string {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl >= 645 && wl <= 750) { r = 1; }
    return `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`;
  }

  function photonEnergy(): number {
    // E = hc/λ in eV
    return (h * c) / (wavelength * 1e-9) / eCharge;
  }

  function canEmit(): boolean {
    return photonEnergy() >= metalWorkFunction;
  }

  function electronKE(): number {
    return Math.max(0, photonEnergy() - metalWorkFunction);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    photons = [];
    electrons = [];
    graphPoints = [];
    spawnTimer = 0;
    layout();
  }

  function update(dt: number, params: Record<string, number>) {
    wavelength = params.wavelength ?? 400;
    intensity = params.intensity ?? 5;
    voltage = params.voltage ?? 0;
    metalWorkFunction = params.workFunction ?? 2.3;

    // Spawn photons
    spawnTimer += dt;
    const spawnRate = 0.05 / intensity;
    while (spawnTimer > spawnRate) {
      spawnTimer -= spawnRate;
      const py = plateY1 + Math.random() * (plateY2 - plateY1);
      photons.push({
        x: width * 0.05,
        y: py,
        vx: 200 + Math.random() * 50,
        vy: (Math.random() - 0.5) * 10,
        alive: true,
      });
    }

    // Update photons
    for (const p of photons) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Hit cathode
      if (p.x >= cathodeX) {
        p.alive = false;
        if (canEmit() && Math.random() < 0.6) {
          const ke = electronKE();
          const speed = 80 + ke * 40;
          electrons.push({
            x: cathodeX + 5,
            y: p.y,
            vx: speed,
            vy: (Math.random() - 0.5) * 30,
            alive: true,
          });
        }
      }
      if (p.x > width || p.y < 0 || p.y > height) p.alive = false;
    }

    // Update electrons
    const eField = voltage * 100 / Math.max(1, anodeX - cathodeX); // simplified
    for (const e of electrons) {
      if (!e.alive) continue;
      // Electric field decelerates/accelerates electrons
      e.vx -= eField * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // Reach anode
      if (e.x >= anodeX) {
        e.alive = false;
      }
      // Bounce back to cathode or go off screen
      if (e.x < cathodeX - 10 || e.y < plateY1 - 10 || e.y > plateY2 + 10) {
        e.alive = false;
      }
    }

    // Cleanup
    photons = photons.filter((p) => p.alive);
    electrons = electrons.filter((e) => e.alive);
    if (photons.length > 150) photons.splice(0, photons.length - 150);
    if (electrons.length > 80) electrons.splice(0, electrons.length - 80);

    // Record graph data periodically
    if (Math.floor(time * 4) !== Math.floor((time - dt) * 4)) {
      const current = electrons.filter((e) => e.vx > 0).length;
      graphPoints.push({ v: voltage, i: current });
      if (graphPoints.length > 200) graphPoints.shift();
    }

    time += dt;
  }

  function render() {
    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Tube housing
    ctx.fillStyle = "rgba(30,30,50,0.8)";
    ctx.strokeStyle = "rgba(100,100,150,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cathodeX - 30, plateY1 - 15, anodeX - cathodeX + 60, plateY2 - plateY1 + 30, 12);
    ctx.fill();
    ctx.stroke();

    // Cathode plate
    ctx.fillStyle = "#667";
    ctx.fillRect(cathodeX - 4, plateY1, 8, plateY2 - plateY1);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Cathode", cathodeX, plateY2 + 20);

    // Anode plate
    ctx.fillStyle = "#889";
    ctx.fillRect(anodeX - 4, plateY1, 8, plateY2 - plateY1);
    ctx.fillText("Anode", anodeX, plateY2 + 20);

    // Photons
    const photonColor = wavelengthToColor(wavelength);
    for (const p of photons) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = photonColor;
      ctx.fill();
      // Wavy tail
      ctx.beginPath();
      ctx.moveTo(p.x - 12, p.y);
      for (let i = 1; i <= 8; i++) {
        ctx.lineTo(p.x - 12 - i * 3, p.y + Math.sin(i * 1.5 + time * 15) * 2);
      }
      ctx.strokeStyle = photonColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Electrons
    for (const e of electrons) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#4488ff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(68,136,255,0.2)";
      ctx.fill();
    }

    // Info panel
    const infoX = width * 0.05;
    const infoY = height * 0.72;
    ctx.fillStyle = "rgba(10,10,30,0.85)";
    ctx.beginPath();
    ctx.roundRect(infoX, infoY, width * 0.35, height * 0.25, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    const energy = photonEnergy();
    const ke = electronKE();
    const emitting = canEmit();

    ctx.fillText(`Photon energy: ${energy.toFixed(2)} eV`, infoX + 10, infoY + 20);
    ctx.fillText(`Work function: ${metalWorkFunction.toFixed(2)} eV`, infoX + 10, infoY + 38);
    ctx.fillText(`Electron KE: ${ke.toFixed(2)} eV`, infoX + 10, infoY + 56);
    ctx.fillStyle = emitting ? "rgba(100,255,100,0.8)" : "rgba(255,100,100,0.8)";
    ctx.fillText(emitting ? "Electrons emitted" : "No emission (E < W)", infoX + 10, infoY + 74);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`Wavelength: ${wavelength.toFixed(0)} nm`, infoX + 10, infoY + 92);
    ctx.fillText(`Stopping voltage: ${voltage.toFixed(1)} V`, infoX + 10, infoY + 110);

    // Graph (V vs I)
    const gx = width * 0.58;
    const gy = height * 0.72;
    const gw = width * 0.38;
    const gh = height * 0.24;

    ctx.fillStyle = "rgba(10,10,30,0.85)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 6);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    const axisX = gx + 30;
    const axisY = gy + gh - 25;
    const plotW = gw - 45;
    const plotH = gh - 40;

    ctx.beginPath();
    ctx.moveTo(axisX, gy + 10);
    ctx.lineTo(axisX, axisY);
    ctx.lineTo(axisX + plotW, axisY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(9, height * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Voltage (V)", axisX + plotW / 2, gy + gh - 4);
    ctx.save();
    ctx.translate(gx + 10, gy + gh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Current", 0, 0);
    ctx.restore();

    // Plot points
    if (graphPoints.length > 1) {
      ctx.beginPath();
      const maxI = Math.max(1, ...graphPoints.map((p) => p.i));
      for (let i = 0; i < graphPoints.length; i++) {
        const px = axisX + ((graphPoints[i].v + 5) / 10) * plotW;
        const py = axisY - (graphPoints[i].i / maxI) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(68,136,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Photoelectric Effect", width / 2, 25);

    // Light source indicator
    ctx.fillStyle = photonColor;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(width * 0.05, (plateY1 + plateY2) / 2, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.max(9, height * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Light", width * 0.05, (plateY1 + plateY2) / 2 + 25);
  }

  function reset() {
    time = 0;
    photons = [];
    electrons = [];
    graphPoints = [];
    spawnTimer = 0;
  }

  function destroy() {
    photons = [];
    electrons = [];
    graphPoints = [];
  }

  function getStateDescription(): string {
    const energy = photonEnergy();
    const ke = electronKE();
    return `Photoelectric Effect | λ=${wavelength}nm | E=${energy.toFixed(2)}eV | W=${metalWorkFunction.toFixed(2)}eV | KE=${ke.toFixed(2)}eV | V=${voltage.toFixed(1)}V | Emission: ${canEmit() ? "Yes" : "No"}`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PhotoelectricEffect2Factory;
