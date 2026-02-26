import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface WindParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  charge: number; // +1 or -1
  life: number;
  maxLife: number;
}

const SolarWindFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("solar-wind") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let windSpeed = 400;    // km/s
  let windDensity = 5;
  let magneticStrength = 1.0;
  let showFieldLines = 1;

  // State
  let particles: WindParticle[] = [];
  const MAX_PARTICLES = 500;

  // Layout positions (computed from width/height)
  let sunX = 0;
  let sunY = 0;
  let sunR = 0;
  let earthX = 0;
  let earthY = 0;
  let earthR = 0;

  function computeLayout(): void {
    sunX = width * 0.1;
    sunY = height * 0.5;
    sunR = Math.min(width, height) * 0.08;
    earthX = width * 0.72;
    earthY = height * 0.5;
    earthR = Math.min(width, height) * 0.035;
  }

  function spawnParticle(): WindParticle {
    const angle = (Math.random() - 0.5) * 1.2; // spread ~60 degrees
    const speed = (windSpeed / 400) * 2.5; // normalized speed
    const startY = sunY + (Math.random() - 0.5) * sunR * 2.5;
    return {
      x: sunX + sunR + Math.random() * 10,
      y: startY,
      vx: speed * Math.cos(angle) * (150 + Math.random() * 50),
      vy: speed * Math.sin(angle) * (40 + Math.random() * 20),
      charge: Math.random() > 0.5 ? 1 : -1,
      life: 0,
      maxLife: 8 + Math.random() * 4,
    };
  }

  function getDipoleBField(px: number, py: number): { bx: number; by: number } {
    // Earth's magnetic dipole field (simplified 2D)
    const dx = px - earthX;
    const dy = py - earthY;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    if (r < earthR) return { bx: 0, by: -1 };

    const r5 = r2 * r2 * r;
    const m = magneticStrength * 5e6; // dipole moment (scaled)

    // Magnetic dipole: B_x = 3m*x*y/r^5, B_y = m*(3y^2 - r^2)/r^5
    // Oriented with north up (dipole along -y)
    const bx = 3 * m * dx * (-dy) / r5;
    const by = m * (3 * dy * dy - r2) / r5;

    return { bx, by };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    computeLayout();

    particles = [];
    for (let i = 0; i < MAX_PARTICLES * 0.3; i++) {
      const p = spawnParticle();
      p.x = sunX + sunR + Math.random() * (earthX - sunX - sunR);
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    windSpeed = params.windSpeed ?? 400;
    windDensity = params.windDensity ?? 5;
    magneticStrength = params.magneticStrength ?? 1.0;
    showFieldLines = params.showFieldLines ?? 1;

    time += dt;
    computeLayout();

    // Spawn new particles
    const spawnRate = windDensity * 8;
    for (let i = 0; i < spawnRate * dt; i++) {
      if (particles.length < MAX_PARTICLES) {
        particles.push(spawnParticle());
      }
    }

    // Update particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life += dt;

      if (p.life >= p.maxLife || p.x > width + 20 || p.x < -20 ||
          p.y < -40 || p.y > height + 40) {
        particles[i] = spawnParticle();
        continue;
      }

      // Magnetic deflection near Earth (Lorentz force: F = qv x B)
      const b = getDipoleBField(p.x, p.y);
      const lorentzScale = magneticStrength * 200;
      // F = q(v x B), in 2D: Fx = q*vy*Bz ~ q*vy*|B|, Fy = -q*vx*Bz
      // Simplify: deflection perpendicular to velocity
      const bMag = Math.sqrt(b.bx * b.bx + b.by * b.by);
      const fx = p.charge * p.vy * bMag * lorentzScale;
      const fy = -p.charge * p.vx * bMag * lorentzScale;

      // Also add a deflection based on field direction
      const deflectX = b.by * p.charge * lorentzScale * 0.5;
      const deflectY = -b.bx * p.charge * lorentzScale * 0.5;

      p.vx += (fx + deflectX) * dt;
      p.vy += (fy + deflectY) * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Check collision with Earth
      const dxE = p.x - earthX;
      const dyE = p.y - earthY;
      const distE = Math.sqrt(dxE * dxE + dyE * dyE);
      if (distE < earthR * 1.3) {
        // Aurora effect: respawn near poles
        particles[i] = spawnParticle();
      }
    }
  }

  function drawBackground(): void {
    ctx.fillStyle = "#020510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    const rng = (s: number) => {
      const v = Math.sin(s) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let i = 0; i < 100; i++) {
      const sx = rng(i * 7.1 + 0.3) * width;
      const sy = rng(i * 11.7 + 0.9) * height;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + rng(i * 3.3) * 0.4})`;
      ctx.beginPath();
      ctx.arc(sx, sy, rng(i * 2.1) * 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSun(): void {
    // Corona
    const corona = ctx.createRadialGradient(sunX, sunY, sunR, sunX, sunY, sunR * 3);
    corona.addColorStop(0, "rgba(255, 200, 50, 0.3)");
    corona.addColorStop(0.5, "rgba(255, 150, 20, 0.08)");
    corona.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3, 0, Math.PI * 2);
    ctx.fillStyle = corona;
    ctx.fill();

    // Sun body
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    sunGrad.addColorStop(0, "#ffffee");
    sunGrad.addColorStop(0.4, "#ffdd44");
    sunGrad.addColorStop(0.8, "#ff9900");
    sunGrad.addColorStop(1, "#cc5500");
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Sunspots (animated)
    ctx.fillStyle = "rgba(150, 80, 0, 0.4)";
    for (let i = 0; i < 3; i++) {
      const angle = time * 0.2 + i * 2.1;
      const r = sunR * 0.5;
      const sx = sunX + Math.cos(angle) * r;
      const sy = sunY + Math.sin(angle) * r * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, sunR * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sun", sunX, sunY + sunR + 16);
  }

  function drawEarth(): void {
    // Magnetosphere boundary (bow shock)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(earthX - earthR * 2, earthY, earthR * 6, earthR * 8, 0, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = "rgba(100, 200, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Earth body
    const earthGrad = ctx.createRadialGradient(
      earthX - earthR * 0.3, earthY - earthR * 0.3, 0,
      earthX, earthY, earthR
    );
    earthGrad.addColorStop(0, "#4488cc");
    earthGrad.addColorStop(0.5, "#2266aa");
    earthGrad.addColorStop(0.8, "#115588");
    earthGrad.addColorStop(1, "#0a3366");
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Land masses (simple)
    ctx.fillStyle = "rgba(60, 140, 60, 0.5)";
    ctx.beginPath();
    ctx.arc(earthX - earthR * 0.2, earthY - earthR * 0.1, earthR * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(earthX + earthR * 0.15, earthY + earthR * 0.3, earthR * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Aurora glow at poles
    const auroraIntensity = Math.min(1, windDensity / 8) * magneticStrength;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);

    // North pole aurora
    const northGlow = ctx.createRadialGradient(
      earthX, earthY - earthR * 1.3, 0,
      earthX, earthY - earthR * 1.3, earthR * 1.5
    );
    northGlow.addColorStop(0, `rgba(50, 255, 100, ${0.4 * auroraIntensity * pulse})`);
    northGlow.addColorStop(0.3, `rgba(80, 200, 255, ${0.2 * auroraIntensity * pulse})`);
    northGlow.addColorStop(1, "rgba(50, 200, 100, 0)");
    ctx.beginPath();
    ctx.arc(earthX, earthY - earthR * 1.3, earthR * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = northGlow;
    ctx.fill();

    // South pole aurora
    const southGlow = ctx.createRadialGradient(
      earthX, earthY + earthR * 1.3, 0,
      earthX, earthY + earthR * 1.3, earthR * 1.5
    );
    southGlow.addColorStop(0, `rgba(50, 255, 100, ${0.3 * auroraIntensity * pulse})`);
    southGlow.addColorStop(0.3, `rgba(150, 80, 255, ${0.15 * auroraIntensity * pulse})`);
    southGlow.addColorStop(1, "rgba(50, 200, 100, 0)");
    ctx.beginPath();
    ctx.arc(earthX, earthY + earthR * 1.3, earthR * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = southGlow;
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", earthX, earthY + earthR + 16);
  }

  function drawMagneticFieldLines(): void {
    if (showFieldLines < 0.5) return;
    ctx.save();

    const numLines = 12;
    for (let i = 0; i < numLines; i++) {
      const startAngle = (i / numLines) * Math.PI * 2;
      // Trace field line from near Earth's surface
      let fx = earthX + Math.cos(startAngle) * (earthR + 2);
      let fy = earthY + Math.sin(startAngle) * (earthR + 2);

      ctx.beginPath();
      ctx.moveTo(fx, fy);

      const steps = 120;
      const stepSize = 3;
      for (let s = 0; s < steps; s++) {
        const b = getDipoleBField(fx, fy);
        const bMag = Math.sqrt(b.bx * b.bx + b.by * b.by);
        if (bMag < 1e-10) break;

        // Follow field direction
        const dir = startAngle > Math.PI ? -1 : 1;
        fx += dir * (b.bx / bMag) * stepSize;
        fy += dir * (b.by / bMag) * stepSize;

        // Stop if too far or back inside Earth
        const dE = Math.sqrt((fx - earthX) ** 2 + (fy - earthY) ** 2);
        if (dE < earthR * 0.8) break;
        if (fx < earthX - width * 0.3 || fx > earthX + width * 0.3) break;
        if (fy < 0 || fy > height) break;

        ctx.lineTo(fx, fy);
      }

      ctx.strokeStyle = "rgba(80, 160, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawParticles(): void {
    for (const p of particles) {
      const alpha = Math.min(1, Math.min(p.life / 0.3, (p.maxLife - p.life) / 0.5));
      if (alpha <= 0) continue;

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const size = 1.2 + Math.min(speed * 0.003, 1.5);

      // Color: protons reddish, electrons bluish
      const r = p.charge > 0 ? 255 : 100;
      const g = p.charge > 0 ? 160 : 180;
      const b = p.charge > 0 ? 80 : 255;

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`;
      ctx.fill();

      // Motion trail
      if (speed > 20) {
        const angle = Math.atan2(p.vy, p.vx);
        const trailLen = Math.min(8, speed * 0.02);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(angle) * trailLen, p.y - Math.sin(angle) * trailLen);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
        ctx.lineWidth = size * 0.6;
        ctx.stroke();
      }
    }
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 220;
    const panelH = 118;
    const panelX = 12;
    const panelY = 12;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Solar Wind & Magnetosphere", panelX + 12, panelY + 10);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.fillText(`Wind speed: ${windSpeed.toFixed(0)} km/s`, panelX + 12, panelY + 32);

    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.fillText(`Particle density: ${windDensity.toFixed(0)} /cm\u00B3`, panelX + 12, panelY + 50);

    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.fillText(`Magnetic strength: ${magneticStrength.toFixed(1)}x`, panelX + 12, panelY + 68);

    ctx.fillStyle = "rgba(100, 255, 150, 0.7)";
    const auroraLevel = Math.min(1, windDensity / 8) * magneticStrength;
    const auroraLabel = auroraLevel > 0.7 ? "Strong" : auroraLevel > 0.3 ? "Moderate" : "Weak";
    ctx.fillText(`Aurora activity: ${auroraLabel}`, panelX + 12, panelY + 86);

    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    ctx.fillText(`Active particles: ${particles.length}`, panelX + 12, panelY + 102);
    ctx.restore();
  }

  function drawLegend(): void {
    ctx.save();
    const lx = width - 140;
    const ly = height - 50;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(lx - 8, ly - 8, 135, 44, 6);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lx + 6, ly + 6, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 160, 80, 0.8)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Protons (H+)", lx + 16, ly + 10);

    ctx.beginPath();
    ctx.arc(lx + 6, ly + 24, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText("Electrons (e-)", lx + 16, ly + 28);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawMagneticFieldLines();
    drawParticles();
    drawSun();
    drawEarth();
    drawInfoPanel();
    drawLegend();
  }

  function reset(): void {
    time = 0;
    particles = [];
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const auroraLevel = Math.min(1, windDensity / 8) * magneticStrength;
    const auroraLabel = auroraLevel > 0.7 ? "strong" : auroraLevel > 0.3 ? "moderate" : "weak";
    return (
      `Solar Wind simulation. The Sun emits charged particles (protons and electrons) at ` +
      `${windSpeed.toFixed(0)} km/s with density ${windDensity.toFixed(0)} particles/cm^3. ` +
      `Earth's magnetic field (strength ${magneticStrength.toFixed(1)}x) deflects the solar wind, ` +
      `creating a magnetosphere. Field lines ${showFieldLines > 0.5 ? "are shown" : "are hidden"}. ` +
      `Particles channeled toward the poles create ${auroraLabel} aurora. ` +
      `The bow shock forms where the solar wind meets the magnetosphere. ` +
      `Real solar wind: 300-800 km/s, mostly protons and electrons.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SolarWindFactory;
