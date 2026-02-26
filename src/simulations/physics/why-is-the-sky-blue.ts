import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Photon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wavelength: number; // nm
  scattered: boolean;
  alpha: number;
}

const WhyIsTheSkyBlueFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("why-is-the-sky-blue") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let sunAngle = 45; // degrees from horizon
  let scatterStrength = 1;
  let showMolecules = 1;

  let photons: Photon[] = [];
  let moleculePositions: { x: number; y: number }[] = [];

  function wavelengthToColor(wl: number): string {
    // Approximate visible spectrum to RGB
    let r = 0, g = 0, b = 0;
    if (wl >= 380 && wl < 440) {
      r = -(wl - 440) / (440 - 380);
      b = 1;
    } else if (wl >= 440 && wl < 490) {
      g = (wl - 440) / (490 - 440);
      b = 1;
    } else if (wl >= 490 && wl < 510) {
      g = 1;
      b = -(wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
      r = (wl - 510) / (580 - 510);
      g = 1;
    } else if (wl >= 580 && wl < 645) {
      r = 1;
      g = -(wl - 645) / (645 - 580);
    } else if (wl >= 645 && wl <= 780) {
      r = 1;
    }
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }

  function scatterProbability(wavelength: number): number {
    // Rayleigh scattering: probability ∝ 1/λ⁴
    const ref = 550; // reference wavelength
    return Math.pow(ref / wavelength, 4) * scatterStrength * 0.02;
  }

  function createMolecules(): void {
    moleculePositions = [];
    const atmosTop = height * 0.1;
    const atmosBottom = height * 0.7;
    for (let i = 0; i < 60; i++) {
      moleculePositions.push({
        x: Math.random() * width,
        y: atmosTop + Math.random() * (atmosBottom - atmosTop),
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    photons = [];
    createMolecules();
  }

  function emitPhotons(): void {
    const sunRad = (sunAngle * Math.PI) / 180;
    const sunX = width * 0.5 - Math.cos(sunRad) * width * 0.6;
    const sunY = height * 0.7 - Math.sin(sunRad) * height * 0.6;
    const dirX = Math.cos(sunRad);
    const dirY = -Math.sin(sunRad); // Note: up is negative y

    // Emit various wavelengths
    const wavelengths = [420, 470, 520, 580, 620, 680]; // blue to red
    for (const wl of wavelengths) {
      const spread = (Math.random() - 0.5) * 0.3;
      photons.push({
        x: sunX + (Math.random() - 0.5) * 40,
        y: sunY + (Math.random() - 0.5) * 40,
        vx: (dirX + spread) * 200,
        vy: (dirY + spread * 0.5) * 200,
        wavelength: wl,
        scattered: false,
        alpha: 1,
      });
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    sunAngle = params.sunAngle ?? 45;
    scatterStrength = params.scatterStrength ?? 1;
    showMolecules = Math.round(params.showMolecules ?? 1);

    // Emit new photons periodically
    if (Math.random() < dt * 5) emitPhotons();

    const atmosTop = height * 0.1;
    const atmosBottom = height * 0.7;

    for (const p of photons) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Check scattering against molecules
      if (!p.scattered && p.y > atmosTop && p.y < atmosBottom) {
        if (Math.random() < scatterProbability(p.wavelength) * dt * 60) {
          // Scatter in random direction
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          p.scattered = true;
        }
      }

      // Fade when out of bounds
      if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        p.alpha -= dt * 3;
      }
    }

    photons = photons.filter((p) => p.alpha > 0);
    if (photons.length > 400) photons.splice(0, photons.length - 400);

    time += dt;
  }

  function render(): void {
    // Sky gradient based on sun angle
    const isLow = sunAngle < 20;
    const skyTop = isLow ? "#1a0a2e" : "#1a5ab8";
    const skyMid = isLow ? "#cc4400" : "#4a90d9";
    const skyBottom = isLow ? "#ff6600" : "#87CEEB";

    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    sky.addColorStop(0, skyTop);
    sky.addColorStop(0.5, skyMid);
    sky.addColorStop(1, skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.7);

    // Ground
    ctx.fillStyle = "#2d5a2d";
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    // Sun
    const sunRad = (sunAngle * Math.PI) / 180;
    const sunX = width * 0.5 + Math.cos(sunRad) * width * 0.4;
    const sunY = height * 0.7 - Math.sin(sunRad) * height * 0.5;

    const sunGlow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 50);
    sunGlow.addColorStop(0, "rgba(255,255,200,1)");
    sunGlow.addColorStop(0.3, "rgba(255,220,100,0.5)");
    sunGlow.addColorStop(1, "rgba(255,200,50,0)");
    ctx.beginPath();
    ctx.arc(sunX, sunY, 50, 0, Math.PI * 2);
    ctx.fillStyle = sunGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#fffde0";
    ctx.fill();

    // Atmosphere molecules
    if (showMolecules) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      for (const mol of moleculePositions) {
        ctx.beginPath();
        ctx.arc(mol.x, mol.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Photons
    for (const p of photons) {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.scattered ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = wavelengthToColor(p.wavelength);
      ctx.fill();

      // Trail
      if (p.scattered) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.strokeStyle = wavelengthToColor(p.wavelength);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Observer
    const obsX = width * 0.5;
    const obsY = height * 0.68;
    ctx.beginPath();
    ctx.arc(obsX, obsY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#f1c40f";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Observer", obsX, obsY + 15);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Why Is the Sky Blue?", width / 2, 22);

    // Info panel
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height - 80, width - 20, 70, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Rayleigh Scattering: Intensity ∝ 1/λ⁴", 22, height - 62);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText("Blue light (λ≈450nm) scatters ~5.5× more than red (λ≈650nm).", 22, height - 44);
    ctx.fillText(`Sun angle: ${sunAngle}° — ${sunAngle < 20 ? "sunset/sunrise → red/orange sky (blue scattered away)" : "daytime → blue sky (blue scattered toward observer)"}`, 22, height - 28);

    // Wavelength legend
    const legendWLs = [420, 470, 520, 580, 650];
    const legendLabels = ["Violet", "Blue", "Green", "Yellow", "Red"];
    const ly = height - 14;
    ctx.font = "9px system-ui, sans-serif";
    for (let i = 0; i < legendWLs.length; i++) {
      const lx = width - 220 + i * 42;
      ctx.fillStyle = wavelengthToColor(legendWLs[i]);
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(legendLabels[i], lx + 6, ly + 3);
    }
  }

  function reset(): void {
    time = 0;
    photons = [];
  }

  function destroy(): void {
    photons = [];
    moleculePositions = [];
  }

  function getStateDescription(): string {
    const scattered = photons.filter((p) => p.scattered).length;
    return (
      `Why Is the Sky Blue: Sun angle=${sunAngle}°, scatter strength=${scatterStrength}. ` +
      `${photons.length} photons, ${scattered} scattered. Rayleigh scattering ∝ 1/λ⁴ ` +
      `means blue light scatters ~5.5× more than red. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    createMolecules();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default WhyIsTheSkyBlueFactory;
