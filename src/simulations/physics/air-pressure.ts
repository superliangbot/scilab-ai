import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  opacity: number;
}

const AirPressureFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("air-pressure") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached parameters
  let coriolisEffect = 70;
  let pressureDiff = 20;
  let hemisphere = 0; // 0 = North, 1 = South
  let windSpeedScale = 1;

  // Pressure system centers
  let highCenter = { x: 0, y: 0 };
  let lowCenter = { x: 0, y: 0 };

  // Wind particles
  let particles: Particle[] = [];
  const MAX_PARTICLES = 300;

  // Base pressure values
  const BASE_PRESSURE = 1013; // hPa

  function positionSystems(): void {
    const cx = width / 2;
    const cy = height / 2;
    const spread = Math.min(width, height) * 0.28;
    highCenter = { x: cx - spread, y: cy };
    lowCenter = { x: cx + spread, y: cy };
  }

  function getPressureAt(x: number, y: number): number {
    const dxH = x - highCenter.x;
    const dyH = y - highCenter.y;
    const distH = Math.sqrt(dxH * dxH + dyH * dyH);

    const dxL = x - lowCenter.x;
    const dyL = y - lowCenter.y;
    const distL = Math.sqrt(dxL * dxL + dyL * dyL);

    const scale = Math.min(width, height) * 0.35;
    const halfDiff = pressureDiff / 2;

    // Gaussian-like pressure fields around each center
    const highContrib = halfDiff * Math.exp(-(distH * distH) / (scale * scale));
    const lowContrib = -halfDiff * Math.exp(-(distL * distL) / (scale * scale));

    return BASE_PRESSURE + highContrib + lowContrib;
  }

  function getWindAt(x: number, y: number): { vx: number; vy: number } {
    // Compute pressure gradient (numerical)
    const eps = 2;
    const pRight = getPressureAt(x + eps, y);
    const pLeft = getPressureAt(x - eps, y);
    const pUp = getPressureAt(x, y - eps);
    const pDown = getPressureAt(x, y + eps);

    // Pressure gradient force: from high to low (-grad P)
    let pgfX = -(pRight - pLeft) / (2 * eps);
    let pgfY = -(pDown - pUp) / (2 * eps);

    // Normalize and scale
    const pgfMag = Math.sqrt(pgfX * pgfX + pgfY * pgfY);
    if (pgfMag > 0.0001) {
      pgfX /= pgfMag;
      pgfY /= pgfMag;
    }

    // Coriolis deflection: perpendicular to velocity
    // In NH, deflect right (clockwise from PGF); in SH, deflect left
    const coriolisStrength = coriolisEffect / 100;
    const coriolisSign = hemisphere === 0 ? 1 : -1;

    // Blend between pure PGF wind (no Coriolis) and geostrophic wind (full Coriolis)
    // Geostrophic: wind perpendicular to PGF (parallel to isobars)
    // Surface: friction causes cross-isobar flow toward low pressure
    const geoX = -pgfY * coriolisSign; // perpendicular to PGF
    const geoY = pgfX * coriolisSign;

    // Surface friction blend: mix PGF direction with geostrophic
    // At full Coriolis, mostly geostrophic with some cross-isobar component
    const frictionCrossIsobar = 0.3; // 30% cross-isobar flow at surface
    const vx = pgfX * (1 - coriolisStrength) + (geoX * (1 - frictionCrossIsobar) + pgfX * frictionCrossIsobar) * coriolisStrength;
    const vy = pgfY * (1 - coriolisStrength) + (geoY * (1 - frictionCrossIsobar) + pgfY * frictionCrossIsobar) * coriolisStrength;

    const speed = pgfMag * windSpeedScale * 150;

    return { vx: vx * speed, vy: vy * speed };
  }

  function spawnParticle(): Particle {
    // Spawn particles with bias toward the high-pressure region and transition zone
    let x: number;
    let y: number;

    const r = Math.random();
    if (r < 0.4) {
      // Near high pressure center
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * Math.min(width, height) * 0.25;
      x = highCenter.x + Math.cos(angle) * dist;
      y = highCenter.y + Math.sin(angle) * dist;
    } else if (r < 0.7) {
      // In the transition zone between systems
      x = width * (0.2 + Math.random() * 0.6);
      y = height * (0.15 + Math.random() * 0.7);
    } else {
      // Random across the map
      x = width * (0.05 + Math.random() * 0.9);
      y = height * (0.05 + Math.random() * 0.9);
    }

    return {
      x,
      y,
      vx: 0,
      vy: 0,
      age: 0,
      maxAge: 3 + Math.random() * 5,
      opacity: 0,
    };
  }

  function initParticles(): void {
    particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = spawnParticle();
      p.age = Math.random() * p.maxAge; // Stagger initial ages
      particles.push(p);
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    positionSystems();
    initParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    coriolisEffect = params.coriolisEffect ?? 70;
    pressureDiff = params.pressureDiff ?? 20;
    hemisphere = params.hemisphere ?? 0;
    windSpeedScale = params.windSpeed ?? 1;

    time += dt;

    // Update particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += dt;

      // Fade in and out
      const fadeIn = Math.min(p.age / 0.5, 1);
      const fadeOut = Math.max(0, 1 - (p.age - (p.maxAge - 1)) / 1);
      p.opacity = Math.min(fadeIn, fadeOut);

      if (p.age >= p.maxAge || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        particles[i] = spawnParticle();
        continue;
      }

      // Get wind at this position
      const wind = getWindAt(p.x, p.y);

      // Smoothly adjust velocity
      const inertia = 0.92;
      p.vx = p.vx * inertia + wind.vx * (1 - inertia);
      p.vy = p.vy * inertia + wind.vy * (1 - inertia);

      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawBackground(): void {
    // Dark map-like background
    const bgGrad = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, "#0d1b2a");
    bgGrad.addColorStop(0.6, "#0b1622");
    bgGrad.addColorStop(1, "#06101a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle grid for map-like appearance
    ctx.save();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.06)";
    ctx.lineWidth = 0.5;
    const gridSpacing = 40;
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPressureGradient(): void {
    // Color-coded pressure field
    ctx.save();
    const resolution = 8;
    for (let x = 0; x < width; x += resolution) {
      for (let y = 0; y < height; y += resolution) {
        const pressure = getPressureAt(x + resolution / 2, y + resolution / 2);
        const halfDiff = pressureDiff / 2;
        const normalized = (pressure - BASE_PRESSURE) / (halfDiff + 0.01);

        let r: number, g: number, b: number, a: number;
        if (normalized > 0) {
          // High pressure: warm red/orange
          r = 180 + normalized * 60;
          g = 80 + normalized * 30;
          b = 40;
          a = Math.abs(normalized) * 0.12;
        } else {
          // Low pressure: cool blue/cyan
          r = 30;
          g = 80 + Math.abs(normalized) * 50;
          b = 160 + Math.abs(normalized) * 80;
          a = Math.abs(normalized) * 0.12;
        }

        ctx.fillStyle = `rgba(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)}, ${Math.min(0.2, a)})`;
        ctx.fillRect(x, y, resolution, resolution);
      }
    }
    ctx.restore();
  }

  function drawIsobars(): void {
    ctx.save();

    const halfDiff = pressureDiff / 2;
    const minP = BASE_PRESSURE - halfDiff;
    const maxP = BASE_PRESSURE + halfDiff;

    // Determine isobar spacing
    let isobarStep: number;
    if (pressureDiff <= 10) isobarStep = 2;
    else if (pressureDiff <= 20) isobarStep = 4;
    else isobarStep = 5;

    // Draw isobars using marching squares approximation (contour tracing via circle sampling)
    const resolution = 3;
    for (let pTarget = minP; pTarget <= maxP; pTarget += isobarStep) {
      const normalizedP = (pTarget - BASE_PRESSURE) / (halfDiff + 0.01);

      // Color: warm near high, cool near low
      if (normalizedP > 0) {
        ctx.strokeStyle = `rgba(255, 180, 100, ${0.15 + Math.abs(normalizedP) * 0.2})`;
      } else {
        ctx.strokeStyle = `rgba(100, 180, 255, ${0.15 + Math.abs(normalizedP) * 0.2})`;
      }
      ctx.lineWidth = Math.abs(pTarget - BASE_PRESSURE) < isobarStep ? 1.5 : 1;

      // Trace contour by sampling along grid
      const contourPoints: Array<{ x: number; y: number }> = [];
      for (let x = 0; x < width; x += resolution) {
        for (let y = 0; y < height; y += resolution) {
          const p00 = getPressureAt(x, y);
          const p10 = getPressureAt(x + resolution, y);
          const p01 = getPressureAt(x, y + resolution);

          // Check if isobar crosses horizontally
          if ((p00 - pTarget) * (p10 - pTarget) < 0) {
            const t = (pTarget - p00) / (p10 - p00);
            contourPoints.push({ x: x + t * resolution, y });
          }
          // Check if isobar crosses vertically
          if ((p00 - pTarget) * (p01 - pTarget) < 0) {
            const t = (pTarget - p00) / (p01 - p00);
            contourPoints.push({ x, y: y + t * resolution });
          }
        }
      }

      // Sort contour points into a path by nearest-neighbor
      if (contourPoints.length < 2) continue;

      // Group into connected segments
      const used = new Array(contourPoints.length).fill(false);
      const segments: Array<Array<{ x: number; y: number }>> = [];

      for (let start = 0; start < contourPoints.length; start++) {
        if (used[start]) continue;
        const segment: Array<{ x: number; y: number }> = [contourPoints[start]];
        used[start] = true;

        let current = start;
        const maxSegDist = resolution * 3;
        for (let iter = 0; iter < contourPoints.length; iter++) {
          let bestIdx = -1;
          let bestDist = maxSegDist;
          for (let j = 0; j < contourPoints.length; j++) {
            if (used[j]) continue;
            const dx = contourPoints[j].x - contourPoints[current].x;
            const dy = contourPoints[j].y - contourPoints[current].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < bestDist) {
              bestDist = d;
              bestIdx = j;
            }
          }
          if (bestIdx === -1) break;
          used[bestIdx] = true;
          segment.push(contourPoints[bestIdx]);
          current = bestIdx;
        }
        if (segment.length >= 5) {
          segments.push(segment);
        }
      }

      // Draw each segment
      for (const seg of segments) {
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x, seg[i].y);
        }
        ctx.stroke();
      }

      // Label this isobar at the first segment
      if (segments.length > 0 && segments[0].length > 10) {
        const labelPt = segments[0][Math.floor(segments[0].length / 3)];
        ctx.save();
        ctx.fillStyle = normalizedP > 0
          ? "rgba(255, 200, 140, 0.6)"
          : "rgba(140, 200, 255, 0.6)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${pTarget.toFixed(0)}`, labelPt.x, labelPt.y - 4);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawPressureSystems(): void {
    ctx.save();

    // High pressure system
    // Glow
    const highGlow = ctx.createRadialGradient(
      highCenter.x, highCenter.y, 0,
      highCenter.x, highCenter.y, 80
    );
    highGlow.addColorStop(0, "rgba(255, 160, 60, 0.15)");
    highGlow.addColorStop(1, "rgba(255, 160, 60, 0)");
    ctx.beginPath();
    ctx.arc(highCenter.x, highCenter.y, 80, 0, Math.PI * 2);
    ctx.fillStyle = highGlow;
    ctx.fill();

    // "H" label
    ctx.fillStyle = "rgba(255, 180, 100, 0.95)";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", highCenter.x, highCenter.y);

    // Pressure value
    ctx.fillStyle = "rgba(255, 200, 140, 0.75)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(`${(BASE_PRESSURE + pressureDiff / 2).toFixed(0)} hPa`, highCenter.x, highCenter.y + 28);

    // Descending air arrows around H
    const arrowCount = 6;
    for (let i = 0; i < arrowCount; i++) {
      const angle = (i / arrowCount) * Math.PI * 2 + time * 0.3;
      const r = 50 + Math.sin(time * 2 + i) * 5;
      const ax = highCenter.x + Math.cos(angle) * r;
      const ay = highCenter.y + Math.sin(angle) * r;

      // Small downward arrow (descending air)
      ctx.beginPath();
      ctx.moveTo(ax, ay - 8);
      ctx.lineTo(ax, ay + 4);
      ctx.strokeStyle = "rgba(255, 180, 100, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Dot at bottom indicating convergence to surface
      ctx.beginPath();
      ctx.arc(ax, ay + 5, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 180, 100, 0.5)";
      ctx.fill();
    }

    // Low pressure system
    // Glow
    const lowGlow = ctx.createRadialGradient(
      lowCenter.x, lowCenter.y, 0,
      lowCenter.x, lowCenter.y, 80
    );
    lowGlow.addColorStop(0, "rgba(60, 160, 255, 0.15)");
    lowGlow.addColorStop(1, "rgba(60, 160, 255, 0)");
    ctx.beginPath();
    ctx.arc(lowCenter.x, lowCenter.y, 80, 0, Math.PI * 2);
    ctx.fillStyle = lowGlow;
    ctx.fill();

    // "L" label
    ctx.fillStyle = "rgba(100, 180, 255, 0.95)";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("L", lowCenter.x, lowCenter.y);

    // Pressure value
    ctx.fillStyle = "rgba(140, 200, 255, 0.75)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(`${(BASE_PRESSURE - pressureDiff / 2).toFixed(0)} hPa`, lowCenter.x, lowCenter.y + 28);

    // Ascending air arrows around L
    for (let i = 0; i < arrowCount; i++) {
      const angle = (i / arrowCount) * Math.PI * 2 - time * 0.3;
      const r = 50 + Math.sin(time * 2 + i) * 5;
      const ax = lowCenter.x + Math.cos(angle) * r;
      const ay = lowCenter.y + Math.sin(angle) * r;

      // Small upward arrow (ascending air)
      ctx.beginPath();
      ctx.moveTo(ax, ay + 8);
      ctx.lineTo(ax, ay - 4);
      ctx.strokeStyle = "rgba(100, 180, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(ax, ay - 6);
      ctx.lineTo(ax - 3, ay - 1);
      ctx.moveTo(ax, ay - 6);
      ctx.lineTo(ax + 3, ay - 1);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawWindArrowField(): void {
    ctx.save();

    const spacing = 50;
    const margin = 30;

    for (let x = margin; x < width - margin; x += spacing) {
      for (let y = margin; y < height - margin; y += spacing) {
        // Skip if too close to H/L labels
        const dH = Math.sqrt((x - highCenter.x) ** 2 + (y - highCenter.y) ** 2);
        const dL = Math.sqrt((x - lowCenter.x) ** 2 + (y - lowCenter.y) ** 2);
        if (dH < 45 || dL < 45) continue;

        const wind = getWindAt(x, y);
        const speed = Math.sqrt(wind.vx * wind.vx + wind.vy * wind.vy);
        if (speed < 0.5) continue;

        const angle = Math.atan2(wind.vy, wind.vx);
        const arrowLen = Math.min(18, 5 + speed * 0.12);
        const alpha = Math.min(0.6, 0.15 + speed * 0.004);

        const endX = x + Math.cos(angle) * arrowLen;
        const endY = y + Math.sin(angle) * arrowLen;

        // Arrow shaft
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(200, 220, 240, ${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Arrowhead
        const headLen = 4;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - 0.5),
          endY - headLen * Math.sin(angle - 0.5)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle + 0.5),
          endY - headLen * Math.sin(angle + 0.5)
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawSpiralIndicators(): void {
    ctx.save();

    const coriolisSign = hemisphere === 0 ? 1 : -1;
    const coriolisStrength = coriolisEffect / 100;

    // Draw spiral arrows around H (clockwise in NH / counterclockwise in SH, outward)
    const numSpiralArrows = 8;
    const spiralRadius = Math.min(width, height) * 0.12;

    for (let i = 0; i < numSpiralArrows; i++) {
      const baseAngle = (i / numSpiralArrows) * Math.PI * 2 + time * 0.4 * coriolisSign;

      // Outward spiral from H
      const r1 = spiralRadius * 0.5;
      const r2 = spiralRadius * 0.85;
      const spiralTwist = coriolisStrength * 0.6 * coriolisSign;

      const startAngle = baseAngle;
      const endAngle = baseAngle + spiralTwist;

      const sx = highCenter.x + Math.cos(startAngle) * r1;
      const sy = highCenter.y + Math.sin(startAngle) * r1;
      const ex = highCenter.x + Math.cos(endAngle) * r2;
      const ey = highCenter.y + Math.sin(endAngle) * r2;

      // Curved arrow using quadratic bezier
      const midAngle = (startAngle + endAngle) / 2;
      const midR = (r1 + r2) / 2 + 10;
      const mx = highCenter.x + Math.cos(midAngle) * midR;
      const my = highCenter.y + Math.sin(midAngle) * midR;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.strokeStyle = "rgba(255, 180, 100, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrowhead at end
      const tipAngle = Math.atan2(ey - my, ex - mx);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - 5 * Math.cos(tipAngle - 0.5),
        ey - 5 * Math.sin(tipAngle - 0.5)
      );
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - 5 * Math.cos(tipAngle + 0.5),
        ey - 5 * Math.sin(tipAngle + 0.5)
      );
      ctx.stroke();
    }

    // Draw spiral arrows around L (counterclockwise in NH / clockwise in SH, inward)
    for (let i = 0; i < numSpiralArrows; i++) {
      const baseAngle = (i / numSpiralArrows) * Math.PI * 2 - time * 0.4 * coriolisSign;

      const r1 = spiralRadius * 0.85;
      const r2 = spiralRadius * 0.5;
      const spiralTwist = -coriolisStrength * 0.6 * coriolisSign;

      const startAngle = baseAngle;
      const endAngle = baseAngle + spiralTwist;

      const sx = lowCenter.x + Math.cos(startAngle) * r1;
      const sy = lowCenter.y + Math.sin(startAngle) * r1;
      const ex = lowCenter.x + Math.cos(endAngle) * r2;
      const ey = lowCenter.y + Math.sin(endAngle) * r2;

      const midAngle = (startAngle + endAngle) / 2;
      const midR = (r1 + r2) / 2 + 10;
      const mx = lowCenter.x + Math.cos(midAngle) * midR;
      const my = lowCenter.y + Math.sin(midAngle) * midR;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.strokeStyle = "rgba(100, 180, 255, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrowhead at end (pointing inward)
      const tipAngle = Math.atan2(ey - my, ex - mx);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - 5 * Math.cos(tipAngle - 0.5),
        ey - 5 * Math.sin(tipAngle - 0.5)
      );
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - 5 * Math.cos(tipAngle + 0.5),
        ey - 5 * Math.sin(tipAngle + 0.5)
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawParticles(): void {
    ctx.save();

    for (const p of particles) {
      if (p.opacity <= 0.01) continue;

      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const size = 1.2 + Math.min(speed * 0.01, 2);

      // Color based on proximity to H or L
      const dH = Math.sqrt((p.x - highCenter.x) ** 2 + (p.y - highCenter.y) ** 2);
      const dL = Math.sqrt((p.x - lowCenter.x) ** 2 + (p.y - lowCenter.y) ** 2);
      const blend = dH / (dH + dL + 0.01); // 0 = near H, 1 = near L

      const r = Math.round(200 + (1 - blend) * 55 - blend * 100);
      const g = Math.round(200 + blend * 20 - (1 - blend) * 20);
      const b = Math.round(200 + blend * 55 - (1 - blend) * 60);

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))}, ${p.opacity * 0.7})`;
      ctx.fill();

      // Small motion trail
      if (speed > 5) {
        const angle = Math.atan2(p.vy, p.vx);
        const trailLen = Math.min(12, speed * 0.08);
        const tx = p.x - Math.cos(angle) * trailLen;
        const ty = p.y - Math.sin(angle) * trailLen;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = `rgba(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))}, ${p.opacity * 0.3})`;
        ctx.lineWidth = size * 0.8;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();

    const panelW = 220;
    const panelH = 110;
    const panelX = 12;
    const panelY = 12;

    // Panel background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(100, 160, 220, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Air Pressure & Wind", panelX + 12, panelY + 10);

    // Info lines
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

    const hemLabel = hemisphere === 0 ? "Northern" : "Southern";
    ctx.fillText(`Hemisphere: ${hemLabel}`, panelX + 12, panelY + 30);

    ctx.fillStyle = "rgba(255, 180, 100, 0.8)";
    ctx.fillText(`High: ${(BASE_PRESSURE + pressureDiff / 2).toFixed(0)} hPa`, panelX + 12, panelY + 48);

    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.fillText(`Low: ${(BASE_PRESSURE - pressureDiff / 2).toFixed(0)} hPa`, panelX + 12, panelY + 64);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Coriolis: ${coriolisEffect}%`, panelX + 12, panelY + 80);
    ctx.fillText(`Wind scale: ${windSpeedScale.toFixed(1)}x`, panelX + 12, panelY + 96);

    ctx.restore();
  }

  function drawCompassRose(): void {
    ctx.save();

    const cx = width - 50;
    const cy = height - 50;
    const r = 22;

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cardinal directions
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", cx, cy - r);
    ctx.fillText("S", cx, cy + r);
    ctx.fillText("E", cx + r, cy);
    ctx.fillText("W", cx - r, cy);

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 8);
    ctx.lineTo(cx, cy + r - 8);
    ctx.moveTo(cx - r + 8, cy);
    ctx.lineTo(cx + r - 8, cy);
    ctx.strokeStyle = "rgba(200, 220, 240, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // North arrow
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx - 3, cy + 2);
    ctx.lineTo(cx + 3, cy + 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
    ctx.fill();

    ctx.restore();
  }

  function drawHemisphereLabel(): void {
    ctx.save();

    const hemLabel = hemisphere === 0 ? "Northern Hemisphere" : "Southern Hemisphere";
    const rotLabel = hemisphere === 0
      ? "H: CW outward | L: CCW inward"
      : "H: CCW outward | L: CW inward";

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(hemLabel, width / 2, height - 28);
    ctx.fillText(rotLabel, width / 2, height - 12);

    ctx.restore();
  }

  function drawPressureGradientArrow(): void {
    ctx.save();

    // Draw a labeled PGF arrow between H and L
    const midX = (highCenter.x + lowCenter.x) / 2;
    const midY = (highCenter.y + lowCenter.y) / 2 - 55;

    const dx = lowCenter.x - highCenter.x;
    const dy = lowCenter.y - highCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    const arrowHalfLen = 45;

    const ax = midX - nx * arrowHalfLen;
    const ay = midY - ny * arrowHalfLen;
    const bx = midX + nx * arrowHalfLen;
    const by = midY + ny * arrowHalfLen;

    // Gradient arrow from H to L
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.strokeStyle = "rgba(220, 220, 100, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const headAngle = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 7 * Math.cos(headAngle - 0.4), by - 7 * Math.sin(headAngle - 0.4));
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 7 * Math.cos(headAngle + 0.4), by - 7 * Math.sin(headAngle + 0.4));
    ctx.strokeStyle = "rgba(220, 220, 100, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = "rgba(220, 220, 100, 0.6)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("PGF", midX, midY - 6);

    ctx.restore();
  }

  function render(): void {
    positionSystems();

    drawBackground();
    drawPressureGradient();
    drawIsobars();
    drawWindArrowField();
    drawSpiralIndicators();
    drawParticles();
    drawPressureSystems();
    drawPressureGradientArrow();
    drawInfoPanel();
    drawCompassRose();
    drawHemisphereLabel();
  }

  function reset(): void {
    time = 0;
    positionSystems();
    initParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const hemLabel = hemisphere === 0 ? "Northern" : "Southern";
    const highP = (BASE_PRESSURE + pressureDiff / 2).toFixed(0);
    const lowP = (BASE_PRESSURE - pressureDiff / 2).toFixed(0);
    const rotH = hemisphere === 0 ? "clockwise outward" : "counterclockwise outward";
    const rotL = hemisphere === 0 ? "counterclockwise inward" : "clockwise inward";

    return (
      `Air Pressure & Wind simulation (${hemLabel} Hemisphere). ` +
      `High pressure system at ${highP} hPa with ${rotH} wind spiral. ` +
      `Low pressure system at ${lowP} hPa with ${rotL} wind spiral. ` +
      `Pressure difference: ${pressureDiff} hPa. ` +
      `Coriolis effect: ${coriolisEffect}%. Wind speed scale: ${windSpeedScale}x. ` +
      `Wind flows from high to low pressure, deflected by Coriolis force. ` +
      `PGF (pressure gradient force) drives air from H to L; ` +
      `Coriolis force deflects wind to the ${hemisphere === 0 ? "right" : "left"} of motion. ` +
      `At the surface, friction causes cross-isobar flow toward low pressure.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    positionSystems();
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

export default AirPressureFactory;
