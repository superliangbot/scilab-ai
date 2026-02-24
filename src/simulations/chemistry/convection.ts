import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ─── Physics constants ──────────────────────────────────────────────
// Simplified 2D convection model.
// Buoyancy force: F_y = -g * beta * (T - T_ref)
// where beta = thermal expansion coefficient, T_ref = ambient temperature.
// Heat diffuses between neighbours and from the burner.

const GRAVITY = 200; // px/s^2 (simulation gravity, scaled for visual effect)
const BETA = 0.005; // thermal expansion coefficient (1/degreeC)
const T_AMBIENT = 20; // ambient temperature (C)
const T_MAX = 100; // maximum particle temperature (C)
const HEAT_DIFFUSION = 0.15; // rate of heat transfer between neighbours
const COOLING_RATE = 0.02; // rate particles lose heat to ambient
const NEIGHBOUR_RADIUS_FACTOR = 5; // how close particles must be for heat transfer

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  temp: number; // temperature in degrees C
}

// ─── Factory ────────────────────────────────────────────────────────
const ConvectionFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("convection") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let heatIntensity = 50;
  let numParticles = 80;
  let viscosity = 3;
  let burnerPosition = 50; // percentage

  // Simulation state
  let particles: Particle[] = [];

  // Container bounds (with margins for burner and walls)
  const MARGIN = 0.08; // fraction of canvas
  function containerLeft(): number { return width * MARGIN; }
  function containerRight(): number { return width * (1 - MARGIN); }
  function containerTop(): number { return height * 0.10; }
  function containerBottom(): number { return height * 0.82; }
  function containerWidth(): number { return containerRight() - containerLeft(); }
  function containerHeight(): number { return containerBottom() - containerTop(); }

  function burnerCenterX(): number {
    return containerLeft() + (burnerPosition / 100) * containerWidth();
  }

  function spawnParticles(): void {
    particles = [];
    const cLeft = containerLeft();
    const cTop = containerTop();
    const cW = containerWidth();
    const cH = containerHeight();

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: cLeft + Math.random() * cW,
        y: cTop + Math.random() * cH,
        vx: 0,
        vy: 0,
        temp: T_AMBIENT + Math.random() * 5,
      });
    }
  }

  /** Temperature to colour: blue (cool) -> yellow -> red (hot) */
  function tempToColor(temp: number): string {
    const t = Math.max(0, Math.min(1, (temp - T_AMBIENT) / (T_MAX - T_AMBIENT)));
    if (t < 0.25) {
      // Blue to cyan
      const s = t / 0.25;
      const r = Math.round(30 + 20 * s);
      const g = Math.round(80 + 120 * s);
      const b = Math.round(220 - 20 * s);
      return `rgb(${r},${g},${b})`;
    } else if (t < 0.5) {
      // Cyan to yellow
      const s = (t - 0.25) / 0.25;
      const r = Math.round(50 + 200 * s);
      const g = Math.round(200 + 55 * s);
      const b = Math.round(200 - 180 * s);
      return `rgb(${r},${g},${b})`;
    } else if (t < 0.75) {
      // Yellow to orange
      const s = (t - 0.5) / 0.25;
      const r = 250;
      const g = Math.round(255 - 100 * s);
      const b = Math.round(20 + 10 * s);
      return `rgb(${r},${g},${b})`;
    } else {
      // Orange to red
      const s = (t - 0.75) / 0.25;
      const r = 255;
      const g = Math.round(155 - 120 * s);
      const b = Math.round(30 - 20 * s);
      return `rgb(${r},${g},${b})`;
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    spawnParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newHeat = params.heatIntensity ?? 50;
    const newNum = Math.round(params.numParticles ?? 80);
    const newVisc = params.viscosity ?? 3;
    const newBurner = params.burnerPosition ?? 50;

    heatIntensity = newHeat;
    viscosity = newVisc;
    burnerPosition = newBurner;

    // Adjust particle count
    if (newNum !== numParticles) {
      if (newNum > numParticles) {
        const cLeft = containerLeft();
        const cTop = containerTop();
        const cW = containerWidth();
        const cH = containerHeight();
        for (let i = numParticles; i < newNum; i++) {
          particles.push({
            x: cLeft + Math.random() * cW,
            y: cTop + Math.random() * cH,
            vx: 0,
            vy: 0,
            temp: T_AMBIENT + Math.random() * 5,
          });
        }
      } else {
        particles.length = newNum;
      }
      numParticles = newNum;
    }

    const dtClamped = Math.min(dt, 0.05);
    const substeps = 2;
    const subDt = dtClamped / substeps;

    const cLeft = containerLeft();
    const cRight = containerRight();
    const cTop = containerTop();
    const cBottom = containerBottom();
    const bx = burnerCenterX();
    const burnerWidth = containerWidth() * 0.25;
    const heatFactor = heatIntensity / 100;
    const viscDamp = 1 - Math.min(0.95, viscosity * 0.03 * subDt * 60);
    const particleRadius = Math.max(3, Math.min(width, height) * 0.008);
    const neighbourDist = particleRadius * NEIGHBOUR_RADIUS_FACTOR;

    for (let step = 0; step < substeps; step++) {
      // 1. Heat particles near the burner
      for (const p of particles) {
        const distToBurner = Math.abs(p.x - bx);
        const distToBottom = cBottom - p.y;
        if (distToBurner < burnerWidth && distToBottom < particleRadius * 6) {
          // Heat transfer from burner: closer = more heat
          const proximity = (1 - distToBurner / burnerWidth) * (1 - distToBottom / (particleRadius * 6));
          const heatGain = proximity * heatFactor * 150 * subDt;
          p.temp = Math.min(T_MAX, p.temp + heatGain);
        }
      }

      // 2. Heat diffusion between neighbours
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x;
          const dy = particles[j].y - particles[i].y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < neighbourDist * neighbourDist && dist2 > 0) {
            const dist = Math.sqrt(dist2);
            const factor = HEAT_DIFFUSION * (1 - dist / neighbourDist) * subDt;
            const dTemp = (particles[j].temp - particles[i].temp) * factor;
            particles[i].temp += dTemp;
            particles[j].temp -= dTemp;
          }
        }
      }

      // 3. Cooling toward ambient
      for (const p of particles) {
        p.temp += (T_AMBIENT - p.temp) * COOLING_RATE * subDt;
      }

      // 4. Apply buoyancy force and update velocities
      // Buoyancy: F_y = -g * beta * (T - T_ambient)
      // Hotter particles get upward force (negative vy in canvas coords)
      for (const p of particles) {
        const deltaT = p.temp - T_AMBIENT;
        const buoyancyForce = -GRAVITY * BETA * deltaT * heatFactor;
        p.vy += buoyancyForce * subDt;

        // Small random lateral movement for turbulence
        p.vx += (Math.random() - 0.5) * 15 * subDt;

        // Viscous damping
        p.vx *= viscDamp;
        p.vy *= viscDamp;
      }

      // 5. Simple particle-particle repulsion (prevents clumping)
      const repelDist = particleRadius * 2.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x;
          const dy = particles[j].y - particles[i].y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < repelDist * repelDist && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const overlap = repelDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const force = overlap * 80 * subDt;
            particles[i].vx -= nx * force;
            particles[i].vy -= ny * force;
            particles[j].vx += nx * force;
            particles[j].vy += ny * force;
          }
        }
      }

      // 6. Move particles
      for (const p of particles) {
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;
      }

      // 7. Wall collisions (bounce)
      for (const p of particles) {
        if (p.x - particleRadius < cLeft) {
          p.x = cLeft + particleRadius;
          p.vx = Math.abs(p.vx) * 0.5;
        }
        if (p.x + particleRadius > cRight) {
          p.x = cRight - particleRadius;
          p.vx = -Math.abs(p.vx) * 0.5;
        }
        if (p.y - particleRadius < cTop) {
          p.y = cTop + particleRadius;
          p.vy = Math.abs(p.vy) * 0.5;
        }
        if (p.y + particleRadius > cBottom) {
          p.y = cBottom - particleRadius;
          p.vy = -Math.abs(p.vy) * 0.5;
        }
      }
    }

    time += dt;
  }

  function renderBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function renderContainer(): void {
    const cLeft = containerLeft();
    const cRight = containerRight();
    const cTop = containerTop();
    const cBottom = containerBottom();
    const cW = containerWidth();
    const cH = containerHeight();

    // Glass-like container
    // Back wall (slightly transparent)
    ctx.fillStyle = "rgba(30, 50, 80, 0.3)";
    ctx.fillRect(cLeft, cTop, cW, cH);

    // Glass wall outlines with subtle reflection
    ctx.strokeStyle = "rgba(150, 180, 220, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cLeft, cTop, cW, cH);

    // Glass reflection highlights on left wall
    ctx.save();
    const reflGrad = ctx.createLinearGradient(cLeft, cTop, cLeft + 8, cTop);
    reflGrad.addColorStop(0, "rgba(180, 210, 255, 0.15)");
    reflGrad.addColorStop(1, "rgba(180, 210, 255, 0)");
    ctx.fillStyle = reflGrad;
    ctx.fillRect(cLeft, cTop, 8, cH);
    ctx.restore();

    // Glass reflection on right wall
    ctx.save();
    const reflGrad2 = ctx.createLinearGradient(cRight - 8, cTop, cRight, cTop);
    reflGrad2.addColorStop(0, "rgba(180, 210, 255, 0)");
    reflGrad2.addColorStop(1, "rgba(180, 210, 255, 0.08)");
    ctx.fillStyle = reflGrad2;
    ctx.fillRect(cRight - 8, cTop, 8, cH);
    ctx.restore();
  }

  function renderBurner(): void {
    const cLeft = containerLeft();
    const cBottom = containerBottom();
    const cW = containerWidth();
    const bx = burnerCenterX();
    const burnerW = cW * 0.25;
    const burnerH = height * 0.06;
    const burnerY = cBottom;

    // Burner body
    const burnerGrad = ctx.createLinearGradient(bx - burnerW, burnerY, bx - burnerW, burnerY + burnerH);
    burnerGrad.addColorStop(0, "#555");
    burnerGrad.addColorStop(0.5, "#777");
    burnerGrad.addColorStop(1, "#444");
    ctx.fillStyle = burnerGrad;
    ctx.beginPath();
    ctx.roundRect(bx - burnerW, burnerY, burnerW * 2, burnerH, [0, 0, 6, 6]);
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Burner grate lines
    ctx.strokeStyle = "rgba(80, 80, 80, 0.8)";
    ctx.lineWidth = 1;
    const numGrates = 6;
    for (let i = 1; i < numGrates; i++) {
      const gx = bx - burnerW + (i / numGrates) * burnerW * 2;
      ctx.beginPath();
      ctx.moveTo(gx, burnerY + 2);
      ctx.lineTo(gx, burnerY + burnerH - 2);
      ctx.stroke();
    }

    // Heat glow above burner
    const heatFactor = heatIntensity / 100;
    if (heatFactor > 0) {
      const glowH = height * 0.15 * heatFactor;
      const glowGrad = ctx.createLinearGradient(bx, burnerY, bx, burnerY - glowH);
      glowGrad.addColorStop(0, `rgba(255, 120, 20, ${0.25 * heatFactor})`);
      glowGrad.addColorStop(0.3, `rgba(255, 80, 10, ${0.12 * heatFactor})`);
      glowGrad.addColorStop(1, "rgba(255, 50, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(bx - burnerW * 1.2, burnerY - glowH, burnerW * 2.4, glowH);

      // Flame flickers
      ctx.save();
      const flameCount = 5;
      for (let i = 0; i < flameCount; i++) {
        const fx = bx - burnerW * 0.8 + (i / (flameCount - 1)) * burnerW * 1.6;
        const flameH = (15 + Math.sin(time * 8 + i * 2.3) * 8) * heatFactor;
        const flameGrad = ctx.createRadialGradient(fx, burnerY, 0, fx, burnerY, flameH);
        flameGrad.addColorStop(0, `rgba(255, 200, 50, ${0.6 * heatFactor})`);
        flameGrad.addColorStop(0.4, `rgba(255, 100, 20, ${0.3 * heatFactor})`);
        flameGrad.addColorStop(1, "rgba(255, 50, 0, 0)");
        ctx.beginPath();
        ctx.arc(fx, burnerY, flameH, 0, Math.PI * 2);
        ctx.fillStyle = flameGrad;
        ctx.fill();
      }
      ctx.restore();
    }

    // "Burner" label
    ctx.save();
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
    ctx.fillText("Heat Source", bx, burnerY + burnerH + 4);
    ctx.restore();
  }

  function renderParticles(): void {
    const particleRadius = Math.max(3, Math.min(width, height) * 0.008);

    for (const p of particles) {
      const color = tempToColor(p.temp);

      // Particle glow
      const glowR = particleRadius * 2.5;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      glow.addColorStop(0, color.replace("rgb", "rgba").replace(")", ", 0.35)"));
      glow.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0)"));
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Particle body
      const bodyGrad = ctx.createRadialGradient(
        p.x - particleRadius * 0.2, p.y - particleRadius * 0.2, 0,
        p.x, p.y, particleRadius
      );
      bodyGrad.addColorStop(0, "#fff");
      bodyGrad.addColorStop(0.3, color);
      bodyGrad.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0.7)"));
      ctx.beginPath();
      ctx.arc(p.x, p.y, particleRadius, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
    }
  }

  function renderFlowArrows(): void {
    // Show flow direction arrows based on average velocity in grid regions
    const cLeft = containerLeft();
    const cTop = containerTop();
    const cW = containerWidth();
    const cH = containerHeight();
    const gridCols = 5;
    const gridRows = 4;
    const cellW = cW / gridCols;
    const cellH = cH / gridRows;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#aabbdd";
    ctx.lineWidth = 1.5;

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cx = cLeft + (col + 0.5) * cellW;
        const cy = cTop + (row + 0.5) * cellH;
        let avgVx = 0;
        let avgVy = 0;
        let count = 0;

        for (const p of particles) {
          if (
            p.x >= cLeft + col * cellW && p.x < cLeft + (col + 1) * cellW &&
            p.y >= cTop + row * cellH && p.y < cTop + (row + 1) * cellH
          ) {
            avgVx += p.vx;
            avgVy += p.vy;
            count++;
          }
        }

        if (count >= 2) {
          avgVx /= count;
          avgVy /= count;
          const speed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
          if (speed > 3) {
            const nx = avgVx / speed;
            const ny = avgVy / speed;
            const arrowLen = Math.min(20, speed * 0.5);

            // Arrow shaft
            ctx.beginPath();
            ctx.moveTo(cx - nx * arrowLen * 0.5, cy - ny * arrowLen * 0.5);
            ctx.lineTo(cx + nx * arrowLen * 0.5, cy + ny * arrowLen * 0.5);
            ctx.stroke();

            // Arrowhead
            const headLen = 5;
            const tipX = cx + nx * arrowLen * 0.5;
            const tipY = cy + ny * arrowLen * 0.5;
            const perpX = -ny;
            const perpY = nx;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX - nx * headLen + perpX * headLen * 0.4, tipY - ny * headLen + perpY * headLen * 0.4);
            ctx.lineTo(tipX - nx * headLen - perpX * headLen * 0.4, tipY - ny * headLen - perpY * headLen * 0.4);
            ctx.closePath();
            ctx.fillStyle = "#aabbdd";
            ctx.fill();
          }
        }
      }
    }

    ctx.restore();
  }

  function renderTemperatureBar(): void {
    // Colour legend
    const barX = width - width * MARGIN + 10;
    const barY = containerTop();
    const barW = 14;
    const barH = containerHeight();

    // Guard: don't render if no space
    if (barX + barW + 40 > width) return;

    const grad = ctx.createLinearGradient(barX, barY + barH, barX, barY);
    grad.addColorStop(0, tempToColor(T_AMBIENT));
    grad.addColorStop(0.33, tempToColor(T_AMBIENT + (T_MAX - T_AMBIENT) * 0.33));
    grad.addColorStop(0.66, tempToColor(T_AMBIENT + (T_MAX - T_AMBIENT) * 0.66));
    grad.addColorStop(1, tempToColor(T_MAX));
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "rgba(150, 180, 220, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Labels
    ctx.save();
    ctx.font = `${Math.max(8, Math.min(width, height) * 0.012)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(200, 210, 240, 0.6)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${T_MAX}C`, barX + barW + 4, barY);
    ctx.textBaseline = "bottom";
    ctx.fillText(`${T_AMBIENT}C`, barX + barW + 4, barY + barH);
    ctx.textBaseline = "middle";
    ctx.fillText("Temp", barX + barW + 4, barY + barH / 2);
    ctx.restore();
  }

  function renderHUD(): void {
    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, Math.min(width, height) * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(220, 230, 250, 0.7)";
    ctx.fillText("Convection Currents", width / 2, 8);

    // Subtitle / formula
    ctx.font = `${Math.max(10, Math.min(width, height) * 0.014)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(160, 180, 220, 0.5)";
    ctx.fillText("Buoyancy: F = -rho * g * beta * dT   |   Hot fluid rises, cool fluid sinks", width / 2, 30);
    ctx.restore();

    // Stats panel
    let avgTemp = 0;
    let maxTemp = -Infinity;
    let avgSpeed = 0;
    for (const p of particles) {
      avgTemp += p.temp;
      if (p.temp > maxTemp) maxTemp = p.temp;
      avgSpeed += Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    }
    avgTemp /= particles.length || 1;
    avgSpeed /= particles.length || 1;

    ctx.save();
    ctx.font = `${Math.max(10, Math.min(width, height) * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const statX = containerLeft() + 6;
    const statY = containerTop() + 6;

    // Semi-transparent backdrop
    ctx.fillStyle = "rgba(10, 15, 30, 0.6)";
    ctx.fillRect(statX - 4, statY - 2, 170, 68);

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Avg Temp: ${avgTemp.toFixed(1)} C`, statX, statY);
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Max Temp: ${maxTemp.toFixed(1)} C`, statX, statY + 15);
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`Avg Speed: ${avgSpeed.toFixed(1)} px/s`, statX, statY + 30);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Particles: ${particles.length}`, statX, statY + 45);
    ctx.restore();

    // Time display - bottom left
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);

    // Educational annotation bottom right
    ctx.save();
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.012)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(160, 180, 220, 0.4)";
    ctx.fillText("Convection drives weather, ocean currents, and plate tectonics", width - 12, height - 12);
    ctx.restore();
  }

  function render(): void {
    renderBackground();
    renderContainer();
    renderBurner();
    renderFlowArrows();
    renderParticles();
    renderTemperatureBar();
    renderHUD();
  }

  function reset(): void {
    time = 0;
    spawnParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    let avgTemp = 0;
    let maxTemp = -Infinity;
    for (const p of particles) {
      avgTemp += p.temp;
      if (p.temp > maxTemp) maxTemp = p.temp;
    }
    avgTemp /= particles.length || 1;

    return (
      `Convection simulation: ${particles.length} fluid particles in a heated container. ` +
      `Heat intensity: ${heatIntensity}%. Burner at ${burnerPosition}% horizontal. ` +
      `Viscosity: ${viscosity}. ` +
      `Average temperature: ${avgTemp.toFixed(1)}C. Max temperature: ${maxTemp.toFixed(1)}C. ` +
      `Physics: Buoyancy F = -rho*g*beta*(T-T_ambient) drives circulation. ` +
      `Hot fluid (red) rises, cools at top (blue), sinks on sides, creating convection cells. ` +
      `This is the same mechanism that drives atmospheric convection, ocean currents, and mantle convection.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    // Re-constrain particles to new bounds
    const cLeft = containerLeft();
    const cRight = containerRight();
    const cTop = containerTop();
    const cBottom = containerBottom();
    const particleRadius = Math.max(3, Math.min(width, height) * 0.008);
    for (const p of particles) {
      p.x = Math.max(cLeft + particleRadius, Math.min(cRight - particleRadius, p.x));
      p.y = Math.max(cTop + particleRadius, Math.min(cBottom - particleRadius, p.y));
    }
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ConvectionFactory;
