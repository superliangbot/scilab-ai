import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const doubleSlitExperimentFactory: SimulationFactory = () => {
  const config = getSimConfig("double-slit-experiment")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let wavelength = 550; // nm

  // Derived constants
  const slitSeparation = 0.1; // mm
  const slitWidth = 0.02; // mm
  const screenDist = 1.0; // m

  // Photon hits for particle detection pattern
  interface Hit { x: number; y: number; age: number; }
  let hits: Hit[] = [];
  let photonX = 0;
  let photonY = 0;
  let photonActive = false;
  let photonPhase = 0;

  function wavelengthToColor(wl: number): string {
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
    else if (wl >= 440 && wl < 490) { g = (wl - 440) / 50; b = 1; }
    else if (wl >= 490 && wl < 510) { g = 1; b = -(wl - 510) / 20; }
    else if (wl >= 510 && wl < 580) { r = (wl - 510) / 70; g = 1; }
    else if (wl >= 580 && wl < 645) { r = 1; g = -(wl - 645) / 65; }
    else if (wl >= 645 && wl <= 700) { r = 1; }
    return `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
  }

  // Intensity pattern: I(θ) = I₀ cos²(πd sinθ/λ) × sinc²(πa sinθ/λ)
  function intensity(y: number): number {
    const sinTheta = y / Math.sqrt(y * y + screenDist * screenDist * 1e6);
    const lambdaMm = wavelength * 1e-6; // nm to mm

    // Double-slit interference: cos²(πd·sinθ/λ)
    const phiD = (Math.PI * slitSeparation * sinTheta) / lambdaMm;
    const interference = Math.cos(phiD) ** 2;

    // Single-slit diffraction envelope: sinc²(πa·sinθ/λ)
    const phiA = (Math.PI * slitWidth * sinTheta) / lambdaMm;
    const sinc = phiA === 0 ? 1 : Math.sin(phiA) / phiA;
    const diffraction = sinc ** 2;

    return interference * diffraction;
  }

  function spawnPhoton() {
    // Choose landing position weighted by intensity
    const maxY = 5; // mm on screen
    let y: number;
    do {
      y = (Math.random() - 0.5) * 2 * maxY;
    } while (Math.random() > intensity(y));

    photonX = 0;
    photonY = H / 2 + (y / maxY) * (H * 0.35);
    photonActive = true;
    photonPhase = 0;
  }

  function drawSource() {
    const sx = W * 0.05, sy = H * 0.35;
    ctx.fillStyle = wavelengthToColor(wavelength);
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 20);
    glow.addColorStop(0, wavelengthToColor(wavelength));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(sx, sy, 20, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.font = "11px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Photon Source", sx, sy + 28);
    ctx.fillText(`λ = ${wavelength} nm`, sx, sy + 42);
  }

  function drawBarrier() {
    const bx = W * 0.35;
    const slitHalfGap = H * 0.04;
    const slitCenter = H * 0.35;

    ctx.fillStyle = "#475569";
    // Top section
    ctx.fillRect(bx - 3, 0, 6, slitCenter - slitHalfGap * 2.5);
    // Middle section
    ctx.fillRect(bx - 3, slitCenter - slitHalfGap * 0.5, 6, slitHalfGap);
    // Bottom section
    ctx.fillRect(bx - 3, slitCenter + slitHalfGap * 2.5, 6, H - slitCenter - slitHalfGap * 2.5);

    // Slit labels
    ctx.font = "10px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText("Slit 1", bx + 10, slitCenter - slitHalfGap * 1.5);
    ctx.fillText("Slit 2", bx + 10, slitCenter + slitHalfGap * 2);

    // Wave fronts emanating from slits
    const color = wavelengthToColor(wavelength);
    for (let slit = -1; slit <= 1; slit += 2) {
      const sy = slitCenter + slit * slitHalfGap * 1.5;
      for (let r = 1; r < 6; r++) {
        const radius = r * 30 + (time * 50) % 30;
        const alpha = Math.max(0, 0.15 - r * 0.02);
        ctx.strokeStyle = color.replace("rgb", "rgba").replace(")", `, ${alpha})`);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, sy, radius, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }
    }
  }

  function drawScreen() {
    const sx = W * 0.7;
    const screenH = H * 0.7;
    const screenTop = H * 0.35 - screenH / 2;

    // Screen background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(sx, screenTop, 8, screenH);

    // Intensity pattern
    const color = wavelengthToColor(wavelength);
    for (let py = 0; py < screenH; py++) {
      const y = ((py / screenH) - 0.5) * 10; // mm
      const I = intensity(y);
      ctx.fillStyle = color.replace("rgb", "rgba").replace(")", `, ${I * 0.8})`);
      ctx.fillRect(sx, screenTop + py, 8, 1);
    }

    // Detection hits
    for (const hit of hits) {
      const alpha = Math.max(0, 1 - hit.age * 0.01);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx + 4, hit.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "11px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Detection Screen", sx + 4, screenTop - 8);
  }

  function drawIntensityGraph() {
    const gx = W * 0.75, gy = H * 0.05, gw = W * 0.22, gh = H * 0.6;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Intensity", gx + gw / 2, gy + 14);

    // Plot
    const color = wavelengthToColor(wavelength);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let py = 0; py < gh - 30; py++) {
      const y = ((py / (gh - 30)) - 0.5) * 10;
      const I = intensity(y);
      const px = gx + 10 + I * (gw - 20);
      if (py === 0) ctx.moveTo(px, gy + 20 + py);
      else ctx.lineTo(px, gy + 20 + py);
    }
    ctx.stroke();

    // Envelope (single slit diffraction)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let py = 0; py < gh - 30; py++) {
      const y = ((py / (gh - 30)) - 0.5) * 10;
      const sinTheta = y / Math.sqrt(y * y + screenDist * screenDist * 1e6);
      const lambdaMm = wavelength * 1e-6;
      const phiA = (Math.PI * slitWidth * sinTheta) / lambdaMm;
      const sinc = phiA === 0 ? 1 : Math.sin(phiA) / phiA;
      const env = sinc ** 2;
      const px = gx + 10 + env * (gw - 20);
      if (py === 0) ctx.moveTo(px, gy + 20 + py);
      else ctx.lineTo(px, gy + 20 + py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFormulas() {
    const y = H * 0.75;
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(W * 0.03, y, W * 0.94, H * 0.22);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(W * 0.03, y, W * 0.94, H * 0.22);

    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Double-Slit Interference + Diffraction", W / 2, y + 18);

    ctx.font = "12px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText("I(θ) = I₀ · cos²(πd·sinθ/λ) · sinc²(πa·sinθ/λ)", W * 0.06, y + 40);
    ctx.fillText(`d (slit separation) = ${slitSeparation} mm`, W * 0.06, y + 58);
    ctx.fillText(`a (slit width) = ${slitWidth} mm`, W * 0.06, y + 74);

    ctx.textAlign = "right";
    ctx.fillText(`λ = ${wavelength} nm`, W * 0.94, y + 40);
    ctx.fillText(`Fringe spacing: Δy = λL/d = ${((wavelength * 1e-6 * screenDist * 1e3) / slitSeparation).toFixed(2)} mm`, W * 0.94, y + 58);
    ctx.fillText(`Photon detections: ${hits.length}`, W * 0.94, y + 74);

    // Constructive/destructive conditions
    ctx.font = "11px Arial";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Constructive: d·sinθ = nλ  |  Destructive: d·sinθ = (n+½)λ", W / 2, y + H * 0.22 - 8);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height;
      time = 0; hits = []; photonActive = false;
    },
    update(dt, params) {
      wavelength = params.wavelength ?? wavelength;
      time += dt;

      // Spawn photons
      if (!photonActive && Math.random() < 0.3) {
        spawnPhoton();
      }
      if (photonActive) {
        photonPhase += dt * 3;
        if (photonPhase >= 1) {
          hits.push({ x: W * 0.7, y: photonY, age: 0 });
          if (hits.length > 2000) hits.shift();
          photonActive = false;
        }
      }

      for (const h of hits) h.age += dt;
    },
    render() {
      ctx.fillStyle = "#0a0a1f";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Double-Slit Experiment", W / 2, 28);

      drawSource();
      drawBarrier();
      drawScreen();
      drawIntensityGraph();

      // Flying photon
      if (photonActive) {
        const startX = W * 0.05;
        const endX = W * 0.7;
        const px = startX + (endX - startX) * photonPhase;
        ctx.fillStyle = wavelengthToColor(wavelength);
        ctx.beginPath();
        ctx.arc(px, photonY + (Math.random() - 0.5) * 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      drawFormulas();
    },
    reset() {
      time = 0; hits = []; photonActive = false;
    },
    destroy() {},
    getStateDescription() {
      const fringeSpacing = (wavelength * 1e-6 * screenDist * 1e3) / slitSeparation;
      return `Double-slit experiment: wavelength ${wavelength} nm (${wavelength < 490 ? "blue/violet" : wavelength < 580 ? "green" : "red/orange"}), slit separation ${slitSeparation} mm, slit width ${slitWidth} mm. Fringe spacing: ${fringeSpacing.toFixed(2)} mm. ${hits.length} photons detected showing interference pattern.`;
    },
    resize(w, h) { W = w; H = h; },
  };
  return engine;
};

export default doubleSlitExperimentFactory;
