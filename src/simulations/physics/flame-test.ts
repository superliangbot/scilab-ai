import type { SimulationConfig, SimulationEngine, SimulationFactory } from "../types";

const config: SimulationConfig = {
  slug: "flame-test",
  title: "Flame Test",
  category: "physics",
  description:
    "Heat metal salts in a flame to see characteristic colors — identify elements by their emission spectra.",
  longDescription:
    "The flame test identifies elements by heating their salts and observing the emitted light color. When atoms absorb thermal energy, electrons jump to higher energy levels. As they return to ground state, they emit photons at specific wavelengths. Each element has a unique emission spectrum: lithium → red, sodium → yellow, potassium → violet, copper → green-blue, strontium → crimson, barium → yellow-green, calcium → orange-red.",
  parameters: [
    { key: "element", label: "Element (1-7)", min: 1, max: 7, step: 1, defaultValue: 1 },
    { key: "flameIntensity", label: "Flame Intensity", min: 0.3, max: 1, step: 0.1, defaultValue: 0.8 },
    { key: "showSpectrum", label: "Show Spectrum (0/1)", min: 0, max: 1, step: 1, defaultValue: 1 },
  ],
  thumbnailColor: "#dc2626",
};

interface ElementData {
  name: string;
  formula: string;
  flameColor: string;
  wavelength: number;
  glowColor: string;
  spectralLines: number[];
}

const ELEMENTS: ElementData[] = [
  { name: "Lithium", formula: "LiCl", flameColor: "#ff1744", wavelength: 670, glowColor: "rgba(255,23,68,0.4)", spectralLines: [670] },
  { name: "Sodium", formula: "NaCl", flameColor: "#ffab00", wavelength: 589, glowColor: "rgba(255,171,0,0.4)", spectralLines: [589, 590] },
  { name: "Potassium", formula: "KCl", flameColor: "#d500f9", wavelength: 766, glowColor: "rgba(213,0,249,0.3)", spectralLines: [766, 770] },
  { name: "Copper", formula: "CuCl₂", flameColor: "#00e676", wavelength: 510, glowColor: "rgba(0,230,118,0.4)", spectralLines: [510, 515, 522] },
  { name: "Strontium", formula: "SrCl₂", flameColor: "#ff1744", wavelength: 650, glowColor: "rgba(255,23,68,0.4)", spectralLines: [640, 650, 660] },
  { name: "Barium", formula: "Ba(NO₃)₂", flameColor: "#76ff03", wavelength: 553, glowColor: "rgba(118,255,3,0.4)", spectralLines: [524, 553] },
  { name: "Calcium", formula: "CaCl₂", flameColor: "#ff6d00", wavelength: 622, glowColor: "rgba(255,109,0,0.4)", spectralLines: [610, 622] },
];

const FlameTestFactory: SimulationFactory = (): SimulationEngine => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let time = 0;

  let elementIdx = 0;
  let flameIntensity = 0.8;
  let showSpectrum = 1;

  interface FlameParticle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
  }

  let flameParticles: FlameParticle[] = [];

  function spawnFlameParticle(baseX: number, baseY: number) {
    flameParticles.push({
      x: baseX + (Math.random() - 0.5) * 20,
      y: baseY,
      vx: (Math.random() - 0.5) * 15,
      vy: -(40 + Math.random() * 60) * flameIntensity,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1,
      size: 3 + Math.random() * 5,
    });
  }

  function drawBunsenBurner(bx: number, by: number) {
    // Base
    ctx.fillStyle = "#4a5568";
    ctx.fillRect(bx - 40, by, 80, 15);

    // Body tube
    ctx.fillStyle = "#718096";
    const tubeW = 24;
    ctx.fillRect(bx - tubeW / 2, by - 100, tubeW, 100);

    // Air hole
    ctx.fillStyle = "#2d3748";
    ctx.beginPath();
    ctx.ellipse(bx, by - 60, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top rim
    ctx.fillStyle = "#a0aec0";
    ctx.fillRect(bx - tubeW / 2 - 3, by - 103, tubeW + 6, 6);

    // Gas tube
    ctx.strokeStyle = "#718096";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 50, by + 15);
    ctx.stroke();
  }

  function drawFlame(bx: number, by: number, elem: ElementData) {
    const flameBaseY = by - 105;

    // Inner blue cone
    ctx.beginPath();
    ctx.moveTo(bx - 8, flameBaseY);
    ctx.quadraticCurveTo(bx, flameBaseY - 30 * flameIntensity, bx, flameBaseY - 40 * flameIntensity);
    ctx.quadraticCurveTo(bx, flameBaseY - 30 * flameIntensity, bx + 8, flameBaseY);
    ctx.closePath();
    ctx.fillStyle = "rgba(59,130,246,0.5)";
    ctx.fill();

    // Outer flame with element color
    const flameH = 80 * flameIntensity;
    const waver = Math.sin(time * 8) * 3;
    ctx.beginPath();
    ctx.moveTo(bx - 14, flameBaseY);
    ctx.quadraticCurveTo(bx - 20 + waver, flameBaseY - flameH * 0.6, bx + waver, flameBaseY - flameH);
    ctx.quadraticCurveTo(bx + 20 - waver, flameBaseY - flameH * 0.6, bx + 14, flameBaseY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(bx, flameBaseY, bx, flameBaseY - flameH);
    grad.addColorStop(0, "rgba(59,130,246,0.6)");
    grad.addColorStop(0.3, elem.flameColor + "cc");
    grad.addColorStop(0.7, elem.flameColor + "88");
    grad.addColorStop(1, elem.flameColor + "22");
    ctx.fillStyle = grad;
    ctx.fill();

    // Glow
    ctx.beginPath();
    ctx.arc(bx, flameBaseY - flameH * 0.4, flameH * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = elem.glowColor;
    ctx.fill();

    // Particles
    for (const p of flameParticles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = elem.flameColor + Math.floor(alpha * 99).toString(16).padStart(2, "0");
      ctx.fill();
    }
  }

  function drawSpectrum(elem: ElementData) {
    const sx = 40;
    const sy = H * 0.08;
    const sw = W - 80;
    const sh = 40;

    // Continuous spectrum background
    const specGrad = ctx.createLinearGradient(sx, sy, sx + sw, sy);
    const colors = ["#7b00ff", "#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff8c00", "#ff0000"];
    for (let i = 0; i < colors.length; i++) {
      specGrad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = specGrad;
    ctx.fillRect(sx, sy, sw, sh);

    // Wavelength labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    const wls = [380, 450, 500, 550, 600, 650, 700, 750];
    for (const wl of wls) {
      const px = sx + ((wl - 380) / 400) * sw;
      ctx.fillText(`${wl}`, px, sy + sh + 12);
    }
    ctx.fillText("Wavelength (nm)", sx + sw / 2, sy + sh + 26);

    // Spectral lines
    for (const line of elem.spectralLines) {
      const px = sx + ((line - 380) / 400) * sw;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, sy - 5);
      ctx.lineTo(px, sy + sh + 5);
      ctx.stroke();

      // Arrow
      ctx.beginPath();
      ctx.moveTo(px - 4, sy - 8);
      ctx.lineTo(px, sy - 2);
      ctx.lineTo(px + 4, sy - 8);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
  }

  function drawElementInfo(elem: ElementData) {
    const ix = W - 200;
    const iy = H * 0.4;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillRect(ix, iy, 185, 110);
    ctx.strokeStyle = elem.flameColor + "66";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ix, iy, 185, 110);

    ctx.fillStyle = elem.flameColor;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(elem.name, ix + 12, iy + 24);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText(`Formula: ${elem.formula}`, ix + 12, iy + 46);
    ctx.fillText(`λ ≈ ${elem.wavelength} nm`, ix + 12, iy + 66);
    ctx.fillText(`Flame: `, ix + 12, iy + 86);

    // Color swatch
    ctx.fillStyle = elem.flameColor;
    ctx.fillRect(ix + 65, iy + 76, 40, 14);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(ix + 65, iy + 76, 40, 14);
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = c.getContext("2d")!;
    W = c.width;
    H = c.height;
  }

  function update(dt: number, params: Record<string, number>) {
    elementIdx = Math.floor((params.element ?? 1) - 1);
    elementIdx = Math.max(0, Math.min(ELEMENTS.length - 1, elementIdx));
    flameIntensity = params.flameIntensity ?? 0.8;
    showSpectrum = params.showSpectrum ?? 1;
    time += dt;

    const bx = W * 0.35;
    const by = H * 0.85;
    // Spawn particles
    for (let i = 0; i < 3; i++) {
      spawnFlameParticle(bx, by - 105);
    }

    // Update particles
    for (let i = flameParticles.length - 1; i >= 0; i--) {
      const p = flameParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        flameParticles.splice(i, 1);
      }
    }
    if (flameParticles.length > 100) flameParticles.splice(0, flameParticles.length - 100);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Flame Test — Element Identification", W / 2, H * 0.06);

    if (showSpectrum) {
      drawSpectrum(ELEMENTS[elementIdx]);
    }

    const bx = W * 0.35;
    const by = H * 0.85;

    drawBunsenBurner(bx, by);
    drawFlame(bx, by, ELEMENTS[elementIdx]);
    drawElementInfo(ELEMENTS[elementIdx]);

    // Element selector legend
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    const lx = 15;
    const ly = H * 0.42;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Elements:", lx, ly - 10);
    for (let i = 0; i < ELEMENTS.length; i++) {
      const isSel = i === elementIdx;
      ctx.fillStyle = ELEMENTS[i].flameColor;
      ctx.fillRect(lx, ly + i * 20, 12, 12);
      ctx.fillStyle = isSel ? "#fff" : "#94a3b8";
      ctx.font = isSel ? "bold 11px sans-serif" : "11px sans-serif";
      ctx.fillText(`${i + 1}. ${ELEMENTS[i].name} (${ELEMENTS[i].formula})`, lx + 18, ly + i * 20 + 10);
    }

    // Explanation
    ctx.fillStyle = "#475569";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Electrons absorb heat → jump to higher orbitals → fall back → emit photons at characteristic λ", W / 2, H - 12);
  }

  function reset() {
    time = 0;
    flameParticles = [];
  }

  function destroy() {}

  function getStateDescription(): string {
    const elem = ELEMENTS[elementIdx];
    return `Flame Test: Heating ${elem.name} (${elem.formula}). The flame burns ${elem.flameColor} with peak emission at ${elem.wavelength} nm. This color is produced when excited electrons return to lower energy levels, emitting photons at this specific wavelength. Spectral lines at: ${elem.spectralLines.join(", ")} nm.`;
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default FlameTestFactory;
