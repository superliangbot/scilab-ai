import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

// ---- Particle type ----------------------------------------------------------
interface FluidParticle {
  x: number;
  y: number;
  /** Normalized position along the pipe (0..1) */
  progress: number;
  /** Vertical offset within the pipe cross-section (-1..1) */
  lane: number;
}

// ---- Factory ----------------------------------------------------------------
const BernoullisPrincipleFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("bernoullis-principle") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let flowSpeed = 5;         // m/s inlet
  let constriction = 50;     // % narrowing
  let fluidDensity = 1000;   // kg/m^3
  let showPressure = 1;

  // Particles
  const NUM_PARTICLES = 120;
  let particles: FluidParticle[] = [];

  // ---- Pipe geometry --------------------------------------------------------
  // Pipe spans from x=pipeLeft to x=pipeRight.
  // The constriction is in the middle third.
  // Returns the pipe half-height at a given normalized x (0..1).

  function pipeHalfHeight(t: number): number {
    const fullHalf = height * 0.15;
    const narrowHalf = fullHalf * (1 - constriction / 100);
    // Smooth constriction: ramp in [0.3..0.4], hold [0.4..0.6], ramp out [0.6..0.7]
    if (t < 0.25) return fullHalf;
    if (t < 0.35) {
      const s = (t - 0.25) / 0.1;
      return fullHalf + (narrowHalf - fullHalf) * smoothstep(s);
    }
    if (t <= 0.65) return narrowHalf;
    if (t < 0.75) {
      const s = (t - 0.65) / 0.1;
      return narrowHalf + (fullHalf - narrowHalf) * smoothstep(s);
    }
    return fullHalf;
  }

  function smoothstep(t: number): number {
    const tc = Math.max(0, Math.min(1, t));
    return tc * tc * (3 - 2 * tc);
  }

  /** Cross-sectional area at normalized position t (arbitrary units proportional to half-height squared) */
  function areaAt(t: number): number {
    const h = pipeHalfHeight(t);
    // treat as circular pipe with radius = h
    return Math.PI * h * h;
  }

  /** Velocity at position t by continuity: A1*v1 = A(t)*v(t) */
  function velocityAt(t: number): number {
    const A1 = areaAt(0); // inlet area
    const At = areaAt(t);
    return flowSpeed * (A1 / At);
  }

  /** Pressure at position t by Bernoulli: P1 + 0.5*rho*v1^2 = P(t) + 0.5*rho*v(t)^2 */
  function pressureAt(t: number): number {
    const v1 = flowSpeed;
    const vt = velocityAt(t);
    // P1 = atmospheric = 101325 Pa
    const P1 = 101325;
    return P1 + 0.5 * fluidDensity * (v1 * v1 - vt * vt);
  }

  // Pipe pixel coordinates
  function pipeLeft(): number { return width * 0.06; }
  function pipeRight(): number { return width * 0.94; }
  function pipeCenterY(): number { return height * 0.40; }

  function normalizedToPixelX(t: number): number {
    return pipeLeft() + t * (pipeRight() - pipeLeft());
  }

  // ---- Particle management --------------------------------------------------
  function createParticle(): FluidParticle {
    return {
      x: 0,
      y: 0,
      progress: Math.random(),
      lane: (Math.random() - 0.5) * 2 * 0.85,
    };
  }

  function spawnParticles(): void {
    particles = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push(createParticle());
    }
  }

  // ---- Engine methods -------------------------------------------------------

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    spawnParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    flowSpeed = params.flowSpeed ?? flowSpeed;
    constriction = params.constriction ?? constriction;
    fluidDensity = params.fluidDensity ?? fluidDensity;
    showPressure = params.showPressure ?? showPressure;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // Move particles
    const pipeLength = pipeRight() - pipeLeft();

    for (const p of particles) {
      // Velocity at current position (m/s), normalize to pipe length
      const vLocal = velocityAt(p.progress);
      // Convert m/s to normalized-pipe-units/s: assume pipe represents 1 meter
      const progressSpeed = vLocal / pipeLength * 15; // scale for visual speed
      p.progress += progressSpeed * dtClamped;

      // Wrap around
      if (p.progress > 1) {
        p.progress -= 1;
        p.lane = (Math.random() - 0.5) * 2 * 0.85;
      }
      if (p.progress < 0) {
        p.progress += 1;
      }

      // Compute pixel position
      const halfH = pipeHalfHeight(p.progress);
      p.x = normalizedToPixelX(p.progress);
      p.y = pipeCenterY() + p.lane * halfH;
    }
  }

  function drawPipe(): void {
    const cy = pipeCenterY();
    const steps = 200;

    // Pipe fill (gradient)
    ctx.beginPath();
    // Top edge left to right
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = normalizedToPixelX(t);
      const hh = pipeHalfHeight(t);
      if (i === 0) ctx.moveTo(px, cy - hh);
      else ctx.lineTo(px, cy - hh);
    }
    // Bottom edge right to left
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const px = normalizedToPixelX(t);
      const hh = pipeHalfHeight(t);
      ctx.lineTo(px, cy + hh);
    }
    ctx.closePath();

    // Pipe interior gradient
    const pipeGrad = ctx.createLinearGradient(0, cy - height * 0.15, 0, cy + height * 0.15);
    pipeGrad.addColorStop(0, "rgba(30,58,100,0.85)");
    pipeGrad.addColorStop(0.3, "rgba(20,40,80,0.7)");
    pipeGrad.addColorStop(0.7, "rgba(20,40,80,0.7)");
    pipeGrad.addColorStop(1, "rgba(30,58,100,0.85)");
    ctx.fillStyle = pipeGrad;
    ctx.fill();

    // Pipe walls (top)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = normalizedToPixelX(t);
      const hh = pipeHalfHeight(t);
      if (i === 0) ctx.moveTo(px, cy - hh);
      else ctx.lineTo(px, cy - hh);
    }
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pipe walls (bottom)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = normalizedToPixelX(t);
      const hh = pipeHalfHeight(t);
      if (i === 0) ctx.moveTo(px, cy + hh);
      else ctx.lineTo(px, cy + hh);
    }
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Wall thickness highlight (top outer edge)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = normalizedToPixelX(t);
      const hh = pipeHalfHeight(t);
      if (i === 0) ctx.moveTo(px, cy - hh - 4);
      else ctx.lineTo(px, cy - hh - 4);
    }
    ctx.strokeStyle = "rgba(100,116,139,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Wall thickness highlight (bottom outer edge)
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = normalizedToPixelX(t);
      const hh = pipeHalfHeight(t);
      if (i === 0) ctx.moveTo(px, cy + hh + 4);
      else ctx.lineTo(px, cy + hh + 4);
    }
    ctx.strokeStyle = "rgba(100,116,139,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawManometers(): void {
    if (showPressure < 0.5) return;

    const cy = pipeCenterY();
    const positions = [0.12, 0.5, 0.88]; // wide, narrow, wide
    const labels = ["Wide section", "Narrow section", "Wide section"];

    const P_atm = 101325;
    const maxManoHeight = height * 0.18;

    for (let i = 0; i < positions.length; i++) {
      const t = positions[i];
      const px = normalizedToPixelX(t);
      const hh = pipeHalfHeight(t);
      const P = pressureAt(t);

      // Manometer tube from top of pipe upward
      const tubeBottom = cy - hh;
      const tubeTop = tubeBottom - maxManoHeight - 30;
      const tubeWidth = 14;

      // Tube outline
      ctx.strokeStyle = "rgba(148,163,184,0.6)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - tubeWidth / 2, tubeTop, tubeWidth, tubeBottom - tubeTop);

      // Fluid level: higher pressure = higher fluid column
      // Normalize pressure relative to atmospheric
      const pressureRatio = P / P_atm;
      const fluidHeight = Math.max(5, Math.min(maxManoHeight, pressureRatio * maxManoHeight * 0.5));
      const fluidTop = tubeBottom - fluidHeight;

      // Fluid in manometer
      const fluidGrad = ctx.createLinearGradient(0, fluidTop, 0, tubeBottom);
      fluidGrad.addColorStop(0, "rgba(56,189,248,0.6)");
      fluidGrad.addColorStop(1, "rgba(37,99,235,0.8)");
      ctx.fillStyle = fluidGrad;
      ctx.fillRect(px - tubeWidth / 2 + 1, fluidTop, tubeWidth - 2, tubeBottom - fluidTop);

      // Pressure value
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "center";
      ctx.fillText(`${(P / 1000).toFixed(1)} kPa`, px, tubeTop - 6);

      // Section label
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(labels[i], px, tubeTop - 20);

      // Velocity at this point
      const v = velocityAt(t);
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`v = ${v.toFixed(1)} m/s`, px, cy + hh + 18);
    }
  }

  function drawParticles(): void {
    const pRadius = 2.5;
    for (const p of particles) {
      // Color by velocity: faster = more orange/red
      const v = velocityAt(p.progress);
      const vMax = velocityAt(0.5); // max at narrowest
      const vMin = flowSpeed;
      const t = Math.min((v - vMin) / (vMax - vMin + 0.01), 1);

      const r = Math.round(56 + t * 199);
      const g = Math.round(189 - t * 120);
      const b = Math.round(248 - t * 200);

      ctx.beginPath();
      ctx.arc(p.x, p.y, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();

      // Motion streak
      const streakLen = 2 + t * 6;
      ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - streakLen, p.y);
      ctx.stroke();
    }
  }

  function drawFlowArrows(): void {
    const cy = pipeCenterY();
    const arrowPositions = [0.12, 0.35, 0.5, 0.65, 0.88];

    for (const t of arrowPositions) {
      const v = velocityAt(t);
      const px = normalizedToPixelX(t);
      const arrowLen = 8 + (v / flowSpeed) * 20;

      ctx.strokeStyle = "rgba(251,191,36,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - arrowLen / 2, cy);
      ctx.lineTo(px + arrowLen / 2, cy);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = "rgba(251,191,36,0.4)";
      ctx.beginPath();
      ctx.moveTo(px + arrowLen / 2 + 5, cy);
      ctx.lineTo(px + arrowLen / 2 - 2, cy - 4);
      ctx.lineTo(px + arrowLen / 2 - 2, cy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSpeedLegend(): void {
    const legendX = width - 50;
    const legendY = height * 0.65;
    const legendH = 80;
    const legendW = 12;

    const legendGrad = ctx.createLinearGradient(0, legendY + legendH, 0, legendY);
    legendGrad.addColorStop(0, "rgb(56,189,248)");
    legendGrad.addColorStop(0.5, "rgb(180,140,120)");
    legendGrad.addColorStop(1, "rgb(255,69,48)");
    ctx.fillStyle = legendGrad;
    ctx.fillRect(legendX, legendY, legendW, legendH);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendW, legendH);

    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText("Fast", legendX + legendW + 4, legendY + 8);
    ctx.fillText("Slow", legendX + legendW + 4, legendY + legendH - 2);
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 18px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Bernoulli's Principle: Venturi Tube", width / 2, 28);

    // Draw pipe
    drawPipe();

    // Draw flow arrows
    drawFlowArrows();

    // Draw particles
    drawParticles();

    // Draw manometers
    drawManometers();

    // Speed legend
    drawSpeedLegend();

    // ---- Physics info panel at bottom ---------------------------------------
    const panelY = height * 0.62;

    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.fillText("Bernoulli's Equation", 16, panelY);

    ctx.font = "13px 'Inter', system-ui, sans-serif";
    const lineH = 19;
    let row = 1;

    // Equation
    ctx.fillStyle = "#c084fc";
    ctx.fillText("P\u2081 + \u00BD\u03C1v\u2081\u00B2 = P\u2082 + \u00BD\u03C1v\u2082\u00B2   (horizontal pipe, h = const)", 16, panelY + lineH * row);
    row++;

    ctx.fillStyle = "#38bdf8";
    ctx.fillText("Continuity: A\u2081v\u2081 = A\u2082v\u2082", 16, panelY + lineH * row);
    row++;

    // Calculate values at wide and narrow sections
    const v1 = velocityAt(0.12);
    const v2 = velocityAt(0.5);
    const P1 = pressureAt(0.12);
    const P2 = pressureAt(0.5);
    const A1 = areaAt(0.12);
    const A2 = areaAt(0.5);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `Wide section:   v\u2081 = ${v1.toFixed(2)} m/s,  P\u2081 = ${(P1 / 1000).toFixed(2)} kPa`,
      16, panelY + lineH * row
    );
    row++;

    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `Narrow section: v\u2082 = ${v2.toFixed(2)} m/s,  P\u2082 = ${(P2 / 1000).toFixed(2)} kPa`,
      16, panelY + lineH * row
    );
    row++;

    // Area ratio
    ctx.fillStyle = "#34d399";
    ctx.fillText(
      `A\u2081/A\u2082 = ${(A1 / A2).toFixed(2)}   |   v\u2082/v\u2081 = ${(v2 / v1).toFixed(2)}   |   \u0394P = ${((P1 - P2) / 1000).toFixed(2)} kPa`,
      16, panelY + lineH * row
    );
    row++;

    ctx.fillStyle = "#f472b6";
    ctx.fillText(
      `\u03C1 = ${fluidDensity} kg/m\u00B3   |   Constriction = ${constriction}%`,
      16, panelY + lineH * row
    );
    row++;

    // Insight text
    ctx.font = "12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    const insight = constriction > 70
      ? "Extreme constriction: very high velocity, very low pressure in narrow section"
      : constriction > 40
        ? "As the pipe narrows, fluid speeds up and pressure drops (Bernoulli effect)"
        : "Mild constriction: small velocity increase, small pressure decrease";
    ctx.fillText(insight, 16, panelY + lineH * row);

    // Bernoulli constant verification
    row++;
    const bConst1 = P1 + 0.5 * fluidDensity * v1 * v1;
    const bConst2 = P2 + 0.5 * fluidDensity * v2 * v2;
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      `Bernoulli constant: P + \u00BD\u03C1v\u00B2 = ${(bConst1 / 1000).toFixed(2)} kPa (wide) = ${(bConst2 / 1000).toFixed(2)} kPa (narrow) \u2714`,
      16, panelY + lineH * row
    );

    // Labels on pipe: "Wide" and "Narrow"
    const cy = pipeCenterY();
    const wideHH = pipeHalfHeight(0.12);
    const narrowHH = pipeHalfHeight(0.5);
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "center";
    ctx.fillText("WIDE", normalizedToPixelX(0.12), cy + wideHH + 34);
    ctx.fillText("NARROW", normalizedToPixelX(0.5), cy + narrowHH + 34);
    ctx.fillText("WIDE", normalizedToPixelX(0.88), cy + wideHH + 34);

    // Inlet/outlet arrows
    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "left";
    ctx.fillText("\u2192 Inlet", pipeLeft() + 2, cy - wideHH - 10);
    ctx.textAlign = "right";
    ctx.fillText("Outlet \u2192", pipeRight() - 2, cy - wideHH - 10);

    // Time display at bottom-left
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    spawnParticles();
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const v1 = velocityAt(0.12);
    const v2 = velocityAt(0.5);
    const P1 = pressureAt(0.12);
    const P2 = pressureAt(0.5);
    return (
      `Bernoulli's Principle simulation: Venturi tube with ${constriction}% constriction. ` +
      `Inlet speed=${flowSpeed} m/s, fluid density=${fluidDensity} kg/m\u00B3. ` +
      `Wide section: v\u2081=${v1.toFixed(2)} m/s, P\u2081=${(P1 / 1000).toFixed(2)} kPa. ` +
      `Narrow section: v\u2082=${v2.toFixed(2)} m/s, P\u2082=${(P2 / 1000).toFixed(2)} kPa. ` +
      `Continuity: A\u2081v\u2081=A\u2082v\u2082. Bernoulli: P+\u00BD\u03C1v\u00B2=const. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default BernoullisPrincipleFactory;
