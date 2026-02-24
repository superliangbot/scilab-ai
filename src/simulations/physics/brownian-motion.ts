import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Molecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  hue: number;
}

interface TrailPoint {
  x: number;
  y: number;
}

const BrownianMotionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("brownian-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Brownian (large) particle
  let bx = 0;
  let by = 0;
  let bvx = 0;
  let bvy = 0;
  let bRadius = 10;
  const bMass = 50; // much heavier than fluid molecules

  // Fluid molecules
  let molecules: Molecule[] = [];
  let trail: TrailPoint[] = [];

  // Cached parameters
  let numMolecules = 80;
  let temperature = 300;
  let particleSize = 10;
  let trailLength = 200;

  // Boltzmann constant (scaled for simulation units)
  const kB = 1.38e-2; // scaled so speeds are visually reasonable
  const moleculeMass = 1; // arbitrary mass unit for fluid molecules
  const moleculeRadius = 2.5;

  // Mean squared displacement tracking
  let msd = 0;
  let startX = 0;
  let startY = 0;

  function molecularSpeed(): number {
    // v_rms = sqrt(3 * kB * T / m)
    return Math.sqrt((3 * kB * temperature) / moleculeMass);
  }

  function randomAngle(): number {
    return Math.random() * 2 * Math.PI;
  }

  function createMolecules(): void {
    molecules = [];
    const speed = molecularSpeed();
    for (let i = 0; i < numMolecules; i++) {
      const angle = randomAngle();
      // Random speed from Maxwell-Boltzmann-like distribution (Box-Muller approximation)
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussFactor = Math.sqrt(-2 * Math.log(u1 || Number.MIN_VALUE)) * Math.cos(2 * Math.PI * u2);
      const s = speed * (0.5 + 0.5 * Math.abs(gaussFactor));

      molecules.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: s * Math.cos(angle),
        vy: s * Math.sin(angle),
        radius: moleculeRadius,
        mass: moleculeMass,
        hue: 180 + Math.random() * 60, // cyan to blue range
      });
    }
  }

  function resolveCircleCollision(
    x1: number, y1: number, vx1: number, vy1: number, m1: number, r1: number,
    x2: number, y2: number, vx2: number, vy2: number, m2: number, r2: number
  ): { vx1: number; vy1: number; vx2: number; vy2: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { vx1, vy1, vx2, vy2 };

    // Normal vector
    const nx = dx / dist;
    const ny = dy / dist;

    // Relative velocity along collision normal
    const dvx = vx1 - vx2;
    const dvy = vy1 - vy2;
    const dvn = dvx * nx + dvy * ny;

    // Don't resolve if moving apart
    if (dvn <= 0) return { vx1, vy1, vx2, vy2 };

    // Elastic collision impulse
    const impulse = (2 * dvn) / (m1 + m2);

    return {
      vx1: vx1 - impulse * m2 * nx,
      vy1: vy1 - impulse * m2 * ny,
      vx2: vx2 + impulse * m1 * nx,
      vy2: vy2 + impulse * m1 * ny,
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;

    bx = width / 2;
    by = height / 2;
    bvx = 0;
    bvy = 0;
    startX = bx;
    startY = by;
    msd = 0;
    trail = [];

    createMolecules();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newNum = Math.round(params.numMolecules ?? 80);
    const newTemp = params.temperature ?? 300;
    const newSize = params.particleSize ?? 10;
    trailLength = Math.round(params.trailLength ?? 200);

    // Recreate molecules if count changed
    if (newNum !== numMolecules) {
      numMolecules = newNum;
      temperature = newTemp;
      createMolecules();
    }

    // Rescale molecule speeds if temperature changed
    if (newTemp !== temperature) {
      const oldSpeed = molecularSpeed();
      temperature = newTemp;
      const newSpeed = molecularSpeed();
      const ratio = oldSpeed > 0 ? newSpeed / oldSpeed : 1;
      for (const mol of molecules) {
        mol.vx *= ratio;
        mol.vy *= ratio;
      }
    }

    temperature = newTemp;
    particleSize = newSize;
    bRadius = particleSize;

    // Cap dt to avoid instability
    const step = Math.min(dt, 0.033);

    // Update molecule positions
    for (const mol of molecules) {
      mol.x += mol.vx * step;
      mol.y += mol.vy * step;

      // Wall collisions (elastic bounce)
      if (mol.x - mol.radius < 0) {
        mol.x = mol.radius;
        mol.vx = Math.abs(mol.vx);
      }
      if (mol.x + mol.radius > width) {
        mol.x = width - mol.radius;
        mol.vx = -Math.abs(mol.vx);
      }
      if (mol.y - mol.radius < 0) {
        mol.y = mol.radius;
        mol.vy = Math.abs(mol.vy);
      }
      if (mol.y + mol.radius > height) {
        mol.y = height - mol.radius;
        mol.vy = -Math.abs(mol.vy);
      }
    }

    // Update Brownian particle position
    bx += bvx * step;
    by += bvy * step;

    // Brownian particle wall collisions
    if (bx - bRadius < 0) { bx = bRadius; bvx = Math.abs(bvx); }
    if (bx + bRadius > width) { bx = width - bRadius; bvx = -Math.abs(bvx); }
    if (by - bRadius < 0) { by = bRadius; bvy = Math.abs(bvy); }
    if (by + bRadius > height) { by = height - bRadius; bvy = -Math.abs(bvy); }

    // Check collisions: molecules with Brownian particle
    for (const mol of molecules) {
      const dx = mol.x - bx;
      const dy = mol.y - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = mol.radius + bRadius;

      if (dist < minDist) {
        const result = resolveCircleCollision(
          bx, by, bvx, bvy, bMass, bRadius,
          mol.x, mol.y, mol.vx, mol.vy, mol.mass, mol.radius
        );
        bvx = result.vx1;
        bvy = result.vy1;
        mol.vx = result.vx2;
        mol.vy = result.vy2;

        // Separate overlapping particles
        if (dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          mol.x += nx * overlap * 0.5;
          mol.y += ny * overlap * 0.5;
          bx -= nx * overlap * 0.5;
          by -= ny * overlap * 0.5;
        }
      }
    }

    // Check collisions: molecule-molecule (sparse, only nearby)
    for (let i = 0; i < molecules.length; i++) {
      for (let j = i + 1; j < molecules.length; j++) {
        const a = molecules[i];
        const b = molecules[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        if (dist < minDist) {
          const result = resolveCircleCollision(
            a.x, a.y, a.vx, a.vy, a.mass, a.radius,
            b.x, b.y, b.vx, b.vy, b.mass, b.radius
          );
          a.vx = result.vx1;
          a.vy = result.vy1;
          b.vx = result.vx2;
          b.vy = result.vy2;

          // Separate
          if (dist > 0) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
          }
        }
      }
    }

    // Record trail
    trail.push({ x: bx, y: by });
    if (trail.length > trailLength && trailLength > 0) {
      trail.splice(0, trail.length - trailLength);
    }
    if (trailLength === 0) {
      trail.length = 0;
    }

    // Mean squared displacement
    const dispX = bx - startX;
    const dispY = by - startY;
    msd = dispX * dispX + dispY * dispY;

    time += step;
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle container border
    ctx.strokeStyle = "rgba(100, 140, 200, 0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, width - 8, height - 8);
  }

  function drawTrail(): void {
    if (trail.length < 2) return;

    for (let i = 1; i < trail.length; i++) {
      const alpha = (i / trail.length) * 0.8;
      const lineWidth = 0.5 + (i / trail.length) * 2;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.strokeStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawMolecules(): void {
    for (const mol of molecules) {
      // Small glow
      const glow = ctx.createRadialGradient(mol.x, mol.y, 0, mol.x, mol.y, mol.radius * 3);
      glow.addColorStop(0, `hsla(${mol.hue}, 80%, 60%, 0.2)`);
      glow.addColorStop(1, `hsla(${mol.hue}, 80%, 60%, 0)`);
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, mol.radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Molecule body
      const grad = ctx.createRadialGradient(
        mol.x - mol.radius * 0.3, mol.y - mol.radius * 0.3, 0,
        mol.x, mol.y, mol.radius
      );
      grad.addColorStop(0, `hsla(${mol.hue}, 80%, 80%, 0.9)`);
      grad.addColorStop(1, `hsla(${mol.hue}, 80%, 40%, 0.7)`);
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  function drawBrownianParticle(): void {
    // Outer glow
    const outerGlow = ctx.createRadialGradient(bx, by, bRadius * 0.5, bx, by, bRadius * 4);
    outerGlow.addColorStop(0, "rgba(255, 180, 50, 0.3)");
    outerGlow.addColorStop(1, "rgba(255, 180, 50, 0)");
    ctx.beginPath();
    ctx.arc(bx, by, bRadius * 4, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Inner glow ring
    const innerGlow = ctx.createRadialGradient(bx, by, bRadius * 0.8, bx, by, bRadius * 2);
    innerGlow.addColorStop(0, "rgba(255, 200, 80, 0.4)");
    innerGlow.addColorStop(1, "rgba(255, 200, 80, 0)");
    ctx.beginPath();
    ctx.arc(bx, by, bRadius * 2, 0, Math.PI * 2);
    ctx.fillStyle = innerGlow;
    ctx.fill();

    // Particle body with shading (pollen grain look)
    const bodyGrad = ctx.createRadialGradient(
      bx - bRadius * 0.3, by - bRadius * 0.3, 0,
      bx, by, bRadius
    );
    bodyGrad.addColorStop(0, "#fff8e0");
    bodyGrad.addColorStop(0.3, "#fbbf24");
    bodyGrad.addColorStop(0.7, "#d97706");
    bodyGrad.addColorStop(1, "#92400e");
    ctx.beginPath();
    ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Rim highlight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Subtle texture dots on pollen grain
    ctx.save();
    ctx.globalAlpha = 0.15;
    const seed = 12345;
    let rng = seed;
    function pseudoRandom(): number {
      rng = (rng * 16807 + 0) % 2147483647;
      return rng / 2147483647;
    }
    for (let i = 0; i < 8; i++) {
      const angle = pseudoRandom() * Math.PI * 2;
      const r = pseudoRandom() * bRadius * 0.7;
      const dotX = bx + r * Math.cos(angle);
      const dotY = by + r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(dotX, dotY, bRadius * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = "#92400e";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const panelW = 240;
    const panelH = 110;
    const panelX = 10;
    const panelY = 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Brownian Motion", panelX + 10, panelY + 20);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Time: ${time.toFixed(1)}s`, panelX + 10, panelY + 38);
    ctx.fillText(`Temperature: ${temperature.toFixed(0)} K`, panelX + 10, panelY + 54);

    const vRms = molecularSpeed();
    ctx.fillText(`v_rms: ${vRms.toFixed(1)} units/s`, panelX + 10, panelY + 70);

    ctx.fillText(`MSD: ${msd.toFixed(0)} px\u00B2`, panelX + 10, panelY + 86);

    const bSpeed = Math.sqrt(bvx * bvx + bvy * bvy);
    ctx.fillText(`Pollen speed: ${bSpeed.toFixed(1)} px/s`, panelX + 10, panelY + 102);

    ctx.restore();
  }

  function drawPhysicsInfo(): void {
    ctx.save();
    const panelW = 220;
    const panelH = 60;
    const panelX = width - panelW - 10;
    const panelY = height - panelH - 10;

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("v_rms = \u221A(3kT/m)", panelX + 10, panelY + 20);
    ctx.fillText("\u27E8x\u00B2\u27E9 = 2Dt (Einstein)", panelX + 10, panelY + 38);
    ctx.fillText(`Molecules: ${numMolecules}`, panelX + 10, panelY + 54);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawTrail();
    drawMolecules();
    drawBrownianParticle();
    drawInfoPanel();
    drawPhysicsInfo();
  }

  function reset(): void {
    time = 0;
    bx = width / 2;
    by = height / 2;
    bvx = 0;
    bvy = 0;
    startX = bx;
    startY = by;
    msd = 0;
    trail = [];
    createMolecules();
  }

  function destroy(): void {
    molecules = [];
    trail = [];
  }

  function getStateDescription(): string {
    const bSpeed = Math.sqrt(bvx * bvx + bvy * bvy);
    const vRms = molecularSpeed();
    return (
      `Brownian Motion: ${numMolecules} fluid molecules at T=${temperature}K. ` +
      `Pollen grain (radius=${particleSize}px) at (${bx.toFixed(0)}, ${by.toFixed(0)}), ` +
      `speed=${bSpeed.toFixed(1)} px/s. ` +
      `Molecular v_rms=${vRms.toFixed(1)} units/s. ` +
      `Mean squared displacement: ${msd.toFixed(0)} px\u00B2. ` +
      `Trail length: ${trail.length} points. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    const dx = (w - width) / 2;
    const dy = (h - height) / 2;
    bx += dx;
    by += dy;
    startX += dx;
    startY += dy;
    for (const p of trail) {
      p.x += dx;
      p.y += dy;
    }
    for (const mol of molecules) {
      mol.x += dx;
      mol.y += dy;
    }
    width = w;
    height = h;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default BrownianMotionFactory;
