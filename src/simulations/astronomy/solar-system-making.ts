import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  absorbed: boolean;
}

interface Planetesimal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
}

const SolarSystemMakingFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("solar-system-making") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let diskMass = 1.0;
  let rotationSpeed = 1.0;
  let accretionRate = 1.0;
  let numParticlesParam = 300;

  // State
  let particles: DustParticle[] = [];
  let planetesimals: Planetesimal[] = [];
  let protoStarMass = 0.1;
  let protoStarRadius = 12;
  let centerX = 0;
  let centerY = 0;

  const G_CONST = 800; // gravitational constant (scaled for simulation)
  const MERGE_THRESHOLD = 1.5;
  const MAX_TRAIL = 60;

  function randomColor(): string {
    const hue = 20 + Math.random() * 40; // warm browns/oranges for dust
    const sat = 40 + Math.random() * 30;
    const light = 40 + Math.random() * 30;
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  function planetColor(mass: number): string {
    if (mass < 5) return "#a08060";       // rocky brown
    if (mass < 20) return "#cc6644";      // Mars-like red
    if (mass < 60) return "#4488cc";      // Neptune-like blue
    return "#ddaa66";                      // Gas giant gold
  }

  function initDisk(): void {
    centerX = width / 2;
    centerY = height / 2;
    particles = [];
    planetesimals = [];
    protoStarMass = 0.1 * diskMass;
    protoStarRadius = 12;

    const maxOrbitR = Math.min(width, height) * 0.4;
    const count = Math.round(numParticlesParam);

    for (let i = 0; i < count; i++) {
      // Distribute in a disk with concentration toward center
      const r = 30 + Math.random() * (maxOrbitR - 30);
      const angle = Math.random() * Math.PI * 2;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      // Orbital velocity: v = sqrt(G*M/r), tangential
      const orbitalV = Math.sqrt(G_CONST * protoStarMass / r) * rotationSpeed;
      // Tangential direction (counterclockwise)
      const vx = -Math.sin(angle) * orbitalV + (Math.random() - 0.5) * 5;
      const vy = Math.cos(angle) * orbitalV + (Math.random() - 0.5) * 5;

      const mass = 0.2 + Math.random() * 0.8;

      particles.push({
        x, y, vx, vy,
        mass,
        radius: 1 + mass * 0.5,
        color: randomColor(),
        absorbed: false,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initDisk();
  }

  function update(dt: number, params: Record<string, number>): void {
    diskMass = params.diskMass ?? 1.0;
    rotationSpeed = params.rotationSpeed ?? 1.0;
    accretionRate = params.accretionRate ?? 1.0;
    numParticlesParam = params.numParticles ?? 300;

    time += dt;
    const step = Math.min(dt, 0.033) * accretionRate;
    centerX = width / 2;
    centerY = height / 2;

    // Update dust particles
    for (const p of particles) {
      if (p.absorbed) continue;

      // Gravity toward proto-star
      const dx = centerX - p.x;
      const dy = centerY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < protoStarRadius) {
        p.absorbed = true;
        protoStarMass += p.mass * 0.01;
        protoStarRadius = 12 + Math.log(protoStarMass + 1) * 4;
        continue;
      }
      const force = G_CONST * protoStarMass * diskMass / (dist * dist + 100);
      const ax = (dx / dist) * force;
      const ay = (dy / dist) * force;

      // Gravity from planetesimals
      let pax = 0, pay = 0;
      for (const pl of planetesimals) {
        const pdx = pl.x - p.x;
        const pdy = pl.y - p.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < pl.radius * MERGE_THRESHOLD) {
          // Absorbed by planetesimal
          p.absorbed = true;
          pl.mass += p.mass;
          pl.radius = 3 + Math.sqrt(pl.mass) * 1.2;
          pl.vx = (pl.vx * (pl.mass - p.mass) + p.vx * p.mass) / pl.mass;
          pl.vy = (pl.vy * (pl.mass - p.mass) + p.vy * p.mass) / pl.mass;
          pl.color = planetColor(pl.mass);
          break;
        }
        if (pdist > 10) {
          const pf = G_CONST * pl.mass / (pdist * pdist + 50);
          pax += (pdx / pdist) * pf;
          pay += (pdy / pdist) * pf;
        }
      }
      if (p.absorbed) continue;

      p.vx += (ax + pax) * step;
      p.vy += (ay + pay) * step;
      p.x += p.vx * step;
      p.y += p.vy * step;

      // Damping to simulate gas drag (helps accretion)
      p.vx *= 0.9995;
      p.vy *= 0.9995;
    }

    // Spontaneous planetesimal formation: nearby particles clump
    if (Math.random() < 0.02 * accretionRate && planetesimals.length < 12) {
      // Find a cluster of nearby particles
      const active = particles.filter((p) => !p.absorbed);
      if (active.length > 10) {
        const seed = active[Math.floor(Math.random() * active.length)];
        const nearby = active.filter((p) => {
          const d = Math.sqrt((p.x - seed.x) ** 2 + (p.y - seed.y) ** 2);
          return d < 20 && p !== seed;
        });
        if (nearby.length >= 3) {
          let totalMass = seed.mass;
          let totalVx = seed.vx * seed.mass;
          let totalVy = seed.vy * seed.mass;
          seed.absorbed = true;
          for (const n of nearby.slice(0, 5)) {
            n.absorbed = true;
            totalMass += n.mass;
            totalVx += n.vx * n.mass;
            totalVy += n.vy * n.mass;
          }
          planetesimals.push({
            x: seed.x,
            y: seed.y,
            vx: totalVx / totalMass,
            vy: totalVy / totalMass,
            mass: totalMass,
            radius: 3 + Math.sqrt(totalMass) * 1.2,
            color: planetColor(totalMass),
            trail: [],
          });
        }
      }
    }

    // Update planetesimals
    for (let i = 0; i < planetesimals.length; i++) {
      const pl = planetesimals[i];

      // Gravity toward proto-star
      const dx = centerX - pl.x;
      const dy = centerY - pl.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < protoStarRadius + pl.radius) {
        protoStarMass += pl.mass * 0.05;
        protoStarRadius = 12 + Math.log(protoStarMass + 1) * 4;
        planetesimals.splice(i, 1);
        i--;
        continue;
      }
      const force = G_CONST * protoStarMass * diskMass / (dist * dist + 100);
      pl.vx += (dx / dist) * force * step;
      pl.vy += (dy / dist) * force * step;

      // Planetesimal-planetesimal gravity and merging
      for (let j = i + 1; j < planetesimals.length; j++) {
        const other = planetesimals[j];
        const pdx = other.x - pl.x;
        const pdy = other.y - pl.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < (pl.radius + other.radius) * MERGE_THRESHOLD) {
          // Merge
          const totalMass = pl.mass + other.mass;
          pl.vx = (pl.vx * pl.mass + other.vx * other.mass) / totalMass;
          pl.vy = (pl.vy * pl.mass + other.vy * other.mass) / totalMass;
          pl.mass = totalMass;
          pl.radius = 3 + Math.sqrt(pl.mass) * 1.2;
          pl.color = planetColor(pl.mass);
          planetesimals.splice(j, 1);
          j--;
        } else if (pdist > 5) {
          const pf = G_CONST * other.mass / (pdist * pdist + 50);
          pl.vx += (pdx / pdist) * pf * step;
          pl.vy += (pdy / pdist) * pf * step;
        }
      }

      pl.x += pl.vx * step;
      pl.y += pl.vy * step;

      // Trail
      pl.trail.push({ x: pl.x, y: pl.y });
      if (pl.trail.length > MAX_TRAIL) pl.trail.shift();
    }

    // Clean up absorbed particles
    particles = particles.filter((p) => !p.absorbed);
  }

  function drawBackground(): void {
    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, width, height);

    // Distant stars
    const rng = (seed: number) => {
      const s = Math.sin(seed) * 43758.5453;
      return s - Math.floor(s);
    };
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = 0; i < 120; i++) {
      const sx = rng(i * 7.3) * width;
      const sy = rng(i * 13.1) * height;
      const sr = rng(i * 3.7) * 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawProtoStar(): void {
    // Glow
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, protoStarRadius * 4);
    glow.addColorStop(0, "rgba(255, 220, 100, 0.3)");
    glow.addColorStop(0.4, "rgba(255, 160, 50, 0.1)");
    glow.addColorStop(1, "rgba(255, 100, 20, 0)");
    ctx.beginPath();
    ctx.arc(centerX, centerY, protoStarRadius * 4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Star body
    const starGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, protoStarRadius);
    starGrad.addColorStop(0, "#ffffcc");
    starGrad.addColorStop(0.5, "#ffcc44");
    starGrad.addColorStop(1, "#cc6600");
    ctx.beginPath();
    ctx.arc(centerX, centerY, protoStarRadius, 0, Math.PI * 2);
    ctx.fillStyle = starGrad;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Proto-star", centerX, centerY + protoStarRadius + 14);
  }

  function drawDust(): void {
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawPlanetesimals(): void {
    for (const pl of planetesimals) {
      // Trail
      if (pl.trail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(pl.trail[0].x, pl.trail[0].y);
        for (let i = 1; i < pl.trail.length; i++) {
          ctx.lineTo(pl.trail[i].x, pl.trail[i].y);
        }
        ctx.strokeStyle = `rgba(255, 255, 255, 0.1)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Body
      const grad = ctx.createRadialGradient(
        pl.x - pl.radius * 0.3, pl.y - pl.radius * 0.3, 0,
        pl.x, pl.y, pl.radius
      );
      grad.addColorStop(0, pl.color);
      grad.addColorStop(1, "#222");
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Label for large bodies
      if (pl.mass > 10) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`m=${pl.mass.toFixed(1)}`, pl.x, pl.y - pl.radius - 5);
      }
    }
  }

  function drawDiskGlow(): void {
    // Faint disk outline
    const maxR = Math.min(width, height) * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let r = 30; r < maxR; r += 20) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsl(30, 50%, ${30 + (r / maxR) * 20}%)`;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 210;
    const panelH = 120;
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
    ctx.fillText("Solar System Formation", panelX + 12, panelY + 10);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 220, 100, 0.8)";
    ctx.fillText(`Proto-star mass: ${protoStarMass.toFixed(2)} M`, panelX + 12, panelY + 32);

    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.fillText(`Dust particles: ${particles.length}`, panelX + 12, panelY + 50);
    ctx.fillText(`Planetesimals: ${planetesimals.length}`, panelX + 12, panelY + 66);

    ctx.fillStyle = "rgba(180, 200, 220, 0.6)";
    ctx.fillText(`Disk mass: ${diskMass.toFixed(1)} M_sun`, panelX + 12, panelY + 86);
    ctx.fillText(`Time: ${time.toFixed(1)} s (sim)`, panelX + 12, panelY + 102);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawDiskGlow();
    drawDust();
    drawPlanetesimals();
    drawProtoStar();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    initDisk();
  }

  function destroy(): void {
    particles = [];
    planetesimals = [];
  }

  function getStateDescription(): string {
    const largestPl = planetesimals.reduce((max, p) => (p.mass > max.mass ? p : max), { mass: 0 } as Planetesimal);
    return (
      `Solar System Formation simulation. A protoplanetary disk with ${particles.length} dust ` +
      `particles and ${planetesimals.length} planetesimals orbiting a proto-star of mass ` +
      `${protoStarMass.toFixed(2)}. Disk mass: ${diskMass.toFixed(1)} solar masses, ` +
      `rotation speed: ${rotationSpeed.toFixed(1)}x, accretion rate: ${accretionRate.toFixed(1)}x. ` +
      (largestPl.mass > 0
        ? `Largest body has mass ${largestPl.mass.toFixed(1)}. `
        : "") +
      `Particles orbit under gravity, collide, and merge into larger bodies over time. ` +
      `The proto-star grows as it accretes material from the disk.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SolarSystemMakingFactory;
