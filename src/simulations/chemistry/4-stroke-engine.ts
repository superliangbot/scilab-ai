import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Stroke phases ──────────────────────────────────────────────────
const STROKE_NAMES = ["Intake", "Compression", "Power", "Exhaust"] as const;
type StrokeName = (typeof STROKE_NAMES)[number];

// ─── Gas particle ───────────────────────────────────────────────────
interface GasParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ─── Otto cycle constants ───────────────────────────────────────────
const GAMMA = 1.4;

// ─── Factory ────────────────────────────────────────────────────────
const FourStrokeEngineFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("4-stroke-engine") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Engine state
  let crankAngle = 0;
  let rpm = 600;
  let compressionRatio = 8;
  let numParticles = 40;
  let particles: GasParticle[] = [];

  // Cached stroke info
  let currentStroke: StrokeName = "Intake";
  let strokeIndex = 0;
  let pistonFraction = 0;
  let currentPressure = 1;
  let currentVolume = 1;

  // Spark flash timer
  let sparkTimer = 0;

  // PV diagram trace
  let pvTrace: { v: number; p: number }[] = [];

  // Derived PV state points (recalculated when compressionRatio changes)
  let P1 = 1;
  let V1 = 1;
  let V2 = 1 / compressionRatio;
  let P2 = P1 * Math.pow(V1 / V2, GAMMA);
  let P3 = P2 * 3.5;
  let V3 = V2;
  let P4 = P3 * Math.pow(V3 / V1, GAMMA);
  let V4 = V1;

  function recalcPVStates(): void {
    V2 = V1 / compressionRatio;
    P2 = P1 * Math.pow(V1 / V2, GAMMA);
    P3 = P2 * 3.5;
    V3 = V2;
    P4 = P3 * Math.pow(V3 / V1, GAMMA);
    V4 = V1;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  function pistonDisplacement(strokeAngle: number): number {
    const lambda = 0.3;
    const cosA = Math.cos(strokeAngle);
    const raw = 1 - cosA + (lambda / 2) * (1 - Math.cos(2 * strokeAngle));
    return raw / (2 + lambda);
  }

  function spawnParticles(): void {
    particles = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: 0.1 + Math.random() * 0.8,
        y: Math.random(),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }
  }

  function particleColor(stroke: StrokeName, frac: number): string {
    switch (stroke) {
      case "Intake":
        return "rgba(100, 180, 255, 0.85)";
      case "Compression": {
        const t = frac;
        const r = Math.round(100 + 155 * t);
        const g = Math.round(180 - 40 * t);
        const b = Math.round(255 - 200 * t);
        return `rgba(${r}, ${g}, ${b}, 0.85)`;
      }
      case "Power": {
        const t = frac;
        return `rgba(255, ${Math.round(80 + 80 * t)}, ${Math.round(20 + 40 * t)}, 0.9)`;
      }
      case "Exhaust": {
        const v = Math.round(120 + 40 * frac);
        return `rgba(${v}, ${v}, ${v + 10}, 0.7)`;
      }
    }
  }

  function computePV(stroke: StrokeName, pFrac: number): { p: number; v: number } {
    switch (stroke) {
      case "Intake": {
        const v = V2 + pFrac * (V1 - V2);
        return { p: P1, v };
      }
      case "Compression": {
        const v = V1 - pFrac * (V1 - V2);
        const p = P1 * Math.pow(V1 / Math.max(v, 0.001), GAMMA);
        return { p, v };
      }
      case "Power": {
        const v = V3 + pFrac * (V4 - V3);
        const p = P3 * Math.pow(V3 / Math.max(v, 0.001), GAMMA);
        return { p, v };
      }
      case "Exhaust": {
        const v = V1 - pFrac * (V1 - V2);
        return { p: P1, v };
      }
    }
  }

  function updateParticles(dt: number): void {
    const spd = 1 + (rpm / 600) * 2;
    for (const p of particles) {
      p.x += p.vx * dt * spd;
      p.y += p.vy * dt * spd;

      if (p.x < 0.05) { p.x = 0.05; p.vx = Math.abs(p.vx) * (0.8 + Math.random() * 0.4); }
      if (p.x > 0.95) { p.x = 0.95; p.vx = -Math.abs(p.vx) * (0.8 + Math.random() * 0.4); }
      if (p.y < 0.02) { p.y = 0.02; p.vy = Math.abs(p.vy) * (0.8 + Math.random() * 0.4); }
      if (p.y > 0.98) { p.y = 0.98; p.vy = -Math.abs(p.vy) * (0.8 + Math.random() * 0.4); }

      p.vx += (Math.random() - 0.5) * 0.5;
      p.vy += (Math.random() - 0.5) * 0.5;
      p.vx *= 0.99;
      p.vy *= 0.99;
    }
  }

  // ── Engine interface ─────────────────────────────────────────────

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    crankAngle = 0;
    sparkTimer = 0;
    pvTrace = [];
    recalcPVStates();
    spawnParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    rpm = params.rpm ?? 600;
    const newCR = params.compressionRatio ?? 8;
    const newNumParticles = Math.round(params.numParticles ?? 40);

    if (newCR !== compressionRatio) {
      compressionRatio = Math.max(2, Math.min(20, newCR));
      recalcPVStates();
      pvTrace = [];
    }

    if (newNumParticles !== numParticles) {
      numParticles = newNumParticles;
      spawnParticles();
    }

    // Advance crank angle (full cycle = 4*pi for 4 strokes, 2 revolutions)
    const radiansPerSecond = (rpm / 60) * 2 * Math.PI;
    crankAngle += radiansPerSecond * dt;

    const fullCycle = 4 * Math.PI;
    if (crankAngle >= fullCycle) {
      crankAngle -= fullCycle;
      pvTrace = [];
    }

    // Determine current stroke
    strokeIndex = Math.floor(crankAngle / Math.PI) % 4;
    currentStroke = STROKE_NAMES[strokeIndex];

    const strokeAngle = crankAngle % Math.PI;
    const rawDisplacement = pistonDisplacement(strokeAngle);
    pistonFraction = rawDisplacement;

    // Compute PV state
    const pv = computePV(currentStroke, rawDisplacement);
    currentPressure = pv.p;
    currentVolume = pv.v;

    pvTrace.push({ v: pv.v, p: pv.p });
    if (pvTrace.length > 2000) {
      pvTrace = pvTrace.slice(-1500);
    }

    // Spark timing
    if (currentStroke === "Power" && rawDisplacement < 0.05) {
      sparkTimer = 0.15;
    }
    if (sparkTimer > 0) sparkTimer -= dt;

    updateParticles(dt);
    time += dt;
  }

  function render(): void {
    if (!ctx) return;

    // ── Dark background ───────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.5, "#0d1525");
    bgGrad.addColorStop(1, "#0a0e1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // ── Layout ────────────────────────────────────────
    const engineAreaWidth = width * 0.56;
    const pvAreaLeft = engineAreaWidth + 20;
    const pvAreaWidth = width - pvAreaLeft - 15;

    // ── Draw Engine ───────────────────────────────────
    renderEngine(10, 50, engineAreaWidth - 20, height - 80);

    // ── Draw PV Diagram ───────────────────────────────
    renderPVDiagram(pvAreaLeft, 50, pvAreaWidth, height * 0.52 - 50);

    // ── Draw Info Panel ───────────────────────────────
    renderInfoPanel(pvAreaLeft, height * 0.52 + 10, pvAreaWidth, height * 0.48 - 30);

    // ── Title ─────────────────────────────────────────
    ctx.font = "bold 16px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Four-Stroke Engine (Otto Cycle)", width / 2, 28);

    ctx.font = "11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 10);
  }

  function renderEngine(ex: number, ey: number, ew: number, eh: number): void {
    const cylLeft = ex + ew * 0.2;
    const cylRight = ex + ew * 0.8;
    const cylTop = ey + eh * 0.05;
    const cylBottom = ey + eh * 0.7;
    const cylWidth = cylRight - cylLeft;
    const cylHeight = cylBottom - cylTop;

    const headHeight = cylHeight * 0.12;
    const headBottom = cylTop + headHeight;

    // Piston position
    const pistonTravel = cylBottom - headBottom;
    let pistonY: number;
    if (strokeIndex === 0 || strokeIndex === 2) {
      pistonY = headBottom + pistonFraction * pistonTravel;
    } else {
      pistonY = cylBottom - pistonFraction * pistonTravel;
    }
    const pistonHeight = cylHeight * 0.06;

    // ── Cylinder block ────────────────────────────────
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(cylLeft, cylTop, cylWidth, cylHeight);

    // Gas space
    const gasTop = headBottom;
    const gasBottom = pistonY;
    const gasHeight = Math.max(gasBottom - gasTop, 2);

    // Gas glow
    let gasColor: string;
    switch (currentStroke) {
      case "Intake":
        gasColor = "rgba(60, 130, 200, 0.15)";
        break;
      case "Compression":
        gasColor = `rgba(200, 180, 60, ${0.1 + pistonFraction * 0.2})`;
        break;
      case "Power":
        gasColor = sparkTimer > 0
          ? `rgba(255, 140, 30, ${0.3 + sparkTimer * 2})`
          : `rgba(255, 100, 30, ${0.15 + (1 - pistonFraction) * 0.15})`;
        break;
      case "Exhaust":
        gasColor = "rgba(120, 120, 130, 0.1)";
        break;
    }
    ctx.fillStyle = gasColor;
    ctx.fillRect(cylLeft, gasTop, cylWidth, gasHeight);

    // ── Particles ────────────────────────────────────
    const pColor = particleColor(currentStroke, pistonFraction);
    const particleRadius = Math.max(2, Math.min(cylWidth, gasHeight) * 0.02);
    for (const p of particles) {
      const px = cylLeft + p.x * cylWidth;
      const py = gasTop + p.y * gasHeight;
      if (py < gasTop || py > gasBottom) continue;

      ctx.beginPath();
      ctx.arc(px, py, particleRadius, 0, Math.PI * 2);
      ctx.fillStyle = pColor;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(px, py, particleRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = pColor.replace(/[\d.]+\)$/, "0.15)");
      ctx.fill();
    }

    // ── Cylinder head ─────────────────────────────────
    const headGrad = ctx.createLinearGradient(0, cylTop, 0, headBottom);
    headGrad.addColorStop(0, "#4a4a6a");
    headGrad.addColorStop(1, "#3a3a5a");
    ctx.fillStyle = headGrad;
    ctx.fillRect(cylLeft - 8, cylTop, cylWidth + 16, headHeight);
    ctx.strokeStyle = "#6a6a8a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cylLeft - 8, cylTop, cylWidth + 16, headHeight);

    // ── Cylinder walls ────────────────────────────────
    ctx.strokeStyle = "#5a5a7a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cylLeft, headBottom);
    ctx.lineTo(cylLeft, cylBottom + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cylRight, headBottom);
    ctx.lineTo(cylRight, cylBottom + 10);
    ctx.stroke();

    // ── Intake valve (left) ──────────────────────────
    const intakeValveX = cylLeft + cylWidth * 0.28;
    const intakeOpen = currentStroke === "Intake";
    const intakeOffset = intakeOpen ? headHeight * 0.5 : 0;
    const valveHeadWidth = cylWidth * 0.15;

    ctx.strokeStyle = "#8888aa";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(intakeValveX, cylTop - 10);
    ctx.lineTo(intakeValveX, headBottom + intakeOffset);
    ctx.stroke();

    ctx.fillStyle = intakeOpen ? "#5588cc" : "#8888aa";
    ctx.beginPath();
    ctx.moveTo(intakeValveX - valveHeadWidth / 2, headBottom + intakeOffset);
    ctx.lineTo(intakeValveX + valveHeadWidth / 2, headBottom + intakeOffset);
    ctx.lineTo(intakeValveX + valveHeadWidth / 4, headBottom + intakeOffset + 5);
    ctx.lineTo(intakeValveX - valveHeadWidth / 4, headBottom + intakeOffset + 5);
    ctx.closePath();
    ctx.fill();

    ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = intakeOpen ? "#88bbff" : "#666688";
    ctx.textAlign = "center";
    ctx.fillText("IN", intakeValveX, cylTop - 14);

    // Intake flow arrows
    if (intakeOpen && pistonFraction > 0.05) {
      ctx.strokeStyle = "rgba(100, 180, 255, 0.6)";
      ctx.lineWidth = 1.5;
      const arrowPhase = (time * 8) % 1;
      for (let i = 0; i < 3; i++) {
        const ay = cylTop - 25 + (arrowPhase + i * 0.33) * 30;
        if (ay > cylTop - 5 && ay < headBottom) {
          ctx.beginPath();
          ctx.moveTo(intakeValveX - 4, ay);
          ctx.lineTo(intakeValveX, ay + 5);
          ctx.lineTo(intakeValveX + 4, ay);
          ctx.stroke();
        }
      }
    }

    // ── Exhaust valve (right) ────────────────────────
    const exhaustValveX = cylLeft + cylWidth * 0.72;
    const exhaustOpen = currentStroke === "Exhaust";
    const exhaustOffset = exhaustOpen ? headHeight * 0.5 : 0;

    ctx.strokeStyle = "#8888aa";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(exhaustValveX, cylTop - 10);
    ctx.lineTo(exhaustValveX, headBottom + exhaustOffset);
    ctx.stroke();

    ctx.fillStyle = exhaustOpen ? "#cc7744" : "#8888aa";
    ctx.beginPath();
    ctx.moveTo(exhaustValveX - valveHeadWidth / 2, headBottom + exhaustOffset);
    ctx.lineTo(exhaustValveX + valveHeadWidth / 2, headBottom + exhaustOffset);
    ctx.lineTo(exhaustValveX + valveHeadWidth / 4, headBottom + exhaustOffset + 5);
    ctx.lineTo(exhaustValveX - valveHeadWidth / 4, headBottom + exhaustOffset + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = exhaustOpen ? "#ffaa66" : "#666688";
    ctx.textAlign = "center";
    ctx.fillText("EX", exhaustValveX, cylTop - 14);

    // Exhaust flow arrows
    if (exhaustOpen && pistonFraction > 0.05) {
      ctx.strokeStyle = "rgba(180, 160, 140, 0.5)";
      ctx.lineWidth = 1.5;
      const arrowPhase = (time * 8) % 1;
      for (let i = 0; i < 3; i++) {
        const ay = headBottom - (arrowPhase + i * 0.33) * 30;
        if (ay > cylTop - 30 && ay < headBottom) {
          ctx.beginPath();
          ctx.moveTo(exhaustValveX - 4, ay);
          ctx.lineTo(exhaustValveX, ay - 5);
          ctx.lineTo(exhaustValveX + 4, ay);
          ctx.stroke();
        }
      }
    }

    // ── Spark plug (center) ───────────────────────────
    const sparkX = cylLeft + cylWidth * 0.5;
    const sparkY = headBottom;

    ctx.fillStyle = "#aaaacc";
    ctx.fillRect(sparkX - 3, cylTop - 5, 6, headHeight + 5);
    ctx.fillStyle = "#ddddee";
    ctx.fillRect(sparkX - 5, cylTop - 8, 10, 6);

    // Spark plug tip
    ctx.strokeStyle = "#ccccee";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sparkX - 3, sparkY + 2);
    ctx.lineTo(sparkX, sparkY + 7);
    ctx.lineTo(sparkX + 3, sparkY + 2);
    ctx.stroke();

    // Spark flash
    if (sparkTimer > 0) {
      const flashAlpha = sparkTimer / 0.15;
      const flashRadius = 8 + (1 - flashAlpha) * 15;

      const flashGrad = ctx.createRadialGradient(sparkX, sparkY + 5, 0, sparkX, sparkY + 5, flashRadius);
      flashGrad.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha * 0.9})`);
      flashGrad.addColorStop(0.3, `rgba(255, 200, 50, ${flashAlpha * 0.6})`);
      flashGrad.addColorStop(0.7, `rgba(255, 100, 20, ${flashAlpha * 0.3})`);
      flashGrad.addColorStop(1, "rgba(255, 50, 0, 0)");
      ctx.beginPath();
      ctx.arc(sparkX, sparkY + 5, flashRadius, 0, Math.PI * 2);
      ctx.fillStyle = flashGrad;
      ctx.fill();

      // Lightning bolt
      ctx.strokeStyle = `rgba(255, 255, 100, ${flashAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sparkX, sparkY);
      ctx.lineTo(sparkX - 4, sparkY + 8);
      ctx.lineTo(sparkX + 2, sparkY + 8);
      ctx.lineTo(sparkX - 2, sparkY + 16);
      ctx.stroke();

      ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = `rgba(255, 255, 100, ${flashAlpha})`;
      ctx.textAlign = "center";
      ctx.fillText("SPARK!", sparkX, cylTop - 22);
    }

    // ── Piston ────────────────────────────────────────
    const pistonGrad = ctx.createLinearGradient(0, pistonY, 0, pistonY + pistonHeight);
    pistonGrad.addColorStop(0, "#7a7a9a");
    pistonGrad.addColorStop(0.5, "#9a9aba");
    pistonGrad.addColorStop(1, "#6a6a8a");
    ctx.fillStyle = pistonGrad;
    ctx.fillRect(cylLeft + 2, pistonY, cylWidth - 4, pistonHeight);
    ctx.strokeStyle = "#aaaacc";
    ctx.lineWidth = 1;
    ctx.strokeRect(cylLeft + 2, pistonY, cylWidth - 4, pistonHeight);

    // Piston ring grooves
    ctx.strokeStyle = "#5a5a7a";
    ctx.lineWidth = 0.8;
    for (let ry = 0; ry < 3; ry++) {
      const ringY = pistonY + 2 + ry * (pistonHeight / 4);
      ctx.beginPath();
      ctx.moveTo(cylLeft + 4, ringY);
      ctx.lineTo(cylRight - 4, ringY);
      ctx.stroke();
    }

    // ── Connecting rod ────────────────────────────────
    const pistonPinX = cylLeft + cylWidth / 2;
    const pistonPinY = pistonY + pistonHeight;

    const crankCenterX = pistonPinX;
    const crankCenterY = cylBottom + eh * 0.15;
    const crankRadius = eh * 0.08;

    const displayCrankAngle = crankAngle / 2;

    const crankPinX = crankCenterX + crankRadius * Math.sin(displayCrankAngle);
    const crankPinY = crankCenterY - crankRadius * Math.cos(displayCrankAngle);

    // Rod
    ctx.strokeStyle = "#8888aa";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pistonPinX, pistonPinY);
    ctx.lineTo(crankPinX, crankPinY);
    ctx.stroke();

    // Piston pin
    ctx.beginPath();
    ctx.arc(pistonPinX, pistonPinY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#bbbbdd";
    ctx.fill();

    // ── Crankshaft ────────────────────────────────────
    ctx.beginPath();
    ctx.arc(crankCenterX, crankCenterY, crankRadius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#5a5a7a";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crank arm
    ctx.strokeStyle = "#7a7a9a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(crankCenterX, crankCenterY);
    ctx.lineTo(crankPinX, crankPinY);
    ctx.stroke();

    // Center bearing
    ctx.beginPath();
    ctx.arc(crankCenterX, crankCenterY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#9a9aba";
    ctx.fill();
    ctx.strokeStyle = "#6a6a8a";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Crank pin
    ctx.beginPath();
    ctx.arc(crankPinX, crankPinY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#bbbbdd";
    ctx.fill();

    // Counterweight
    const cwX = crankCenterX - crankRadius * 0.8 * Math.sin(displayCrankAngle);
    const cwY = crankCenterY + crankRadius * 0.8 * Math.cos(displayCrankAngle);
    ctx.beginPath();
    ctx.arc(cwX, cwY, crankRadius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#4a4a6a";
    ctx.fill();

    // ── Stroke indicator bar ──────────────────────────
    const strokeColors = ["#66aaff", "#ffcc44", "#ff6644", "#aaaaaa"];
    const strokeBgColors = ["#1a2a4a", "#3a3a2a", "#3a1a1a", "#2a2a2a"];

    const barY = ey + eh * 0.92;
    const barHeight = 24;
    const barTotalWidth = cylWidth + 16;
    const barLeft = cylLeft - 8;
    const sectionWidth = barTotalWidth / 4;

    for (let i = 0; i < 4; i++) {
      const isActive = i === strokeIndex;
      ctx.fillStyle = isActive ? strokeColors[i] : strokeBgColors[i];
      ctx.fillRect(barLeft + i * sectionWidth, barY, sectionWidth - 2, barHeight);

      if (isActive) {
        ctx.strokeStyle = strokeColors[i];
        ctx.lineWidth = 2;
        ctx.strokeRect(barLeft + i * sectionWidth, barY, sectionWidth - 2, barHeight);
      }

      ctx.font = `${isActive ? "bold " : ""}9px 'Inter', system-ui, sans-serif`;
      ctx.fillStyle = isActive ? "#ffffff" : "#666688";
      ctx.textAlign = "center";
      ctx.fillText(
        STROKE_NAMES[i],
        barLeft + i * sectionWidth + sectionWidth / 2 - 1,
        barY + barHeight / 2 + 3
      );
    }

    // Current stroke label
    ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = strokeColors[strokeIndex];
    ctx.textAlign = "center";
    ctx.fillText(currentStroke.toUpperCase() + " STROKE", cylLeft + cylWidth / 2, ey + eh * 0.88);
  }

  function renderPVDiagram(px: number, py: number, pw: number, ph: number): void {
    ctx.fillStyle = "#111827";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "center";
    ctx.fillText("P-V Diagram (Otto Cycle)", px + pw / 2, py + 16);

    const plotLeft = px + 40;
    const plotRight = px + pw - 15;
    const plotTop = py + 30;
    const plotBottom = py + ph - 25;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    // Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotTop);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    ctx.font = "9px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Volume", plotLeft + plotW / 2, plotBottom + 16);
    ctx.save();
    ctx.translate(px + 12, plotTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Pressure", 0, 0);
    ctx.restore();

    const maxP = P3 * 1.15;
    const maxV = V1 * 1.15;

    function pvToPixel(v: number, p: number): { x: number; y: number } {
      return {
        x: plotLeft + (v / maxV) * plotW,
        y: plotBottom - (p / maxP) * plotH,
      };
    }

    // Ideal cycle outline (dashed)
    ctx.strokeStyle = "rgba(100, 150, 200, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Intake
    ctx.beginPath();
    let pt = pvToPixel(V2, P1);
    ctx.moveTo(pt.x, pt.y);
    pt = pvToPixel(V1, P1);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    // Adiabatic compression
    const steps = 50;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const v = V1 - (i / steps) * (V1 - V2);
      const p = P1 * Math.pow(V1 / v, GAMMA);
      pt = pvToPixel(v, p);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Constant volume combustion
    ctx.beginPath();
    pt = pvToPixel(V2, P2);
    ctx.moveTo(pt.x, pt.y);
    pt = pvToPixel(V3, P3);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    // Adiabatic expansion
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const v = V3 + (i / steps) * (V4 - V3);
      const p = P3 * Math.pow(V3 / v, GAMMA);
      pt = pvToPixel(v, p);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Exhaust blowdown
    ctx.beginPath();
    pt = pvToPixel(V4, P4);
    ctx.moveTo(pt.x, pt.y);
    pt = pvToPixel(V1, P1);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Live PV trace
    if (pvTrace.length > 1) {
      const traceColors = ["#66aaff", "#ffcc44", "#ff6644", "#aaaaaa"];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < pvTrace.length; i++) {
        pt = pvToPixel(pvTrace[i].v, pvTrace[i].p);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = traceColors[strokeIndex];
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Moving dot
      const curPt = pvToPixel(currentVolume, currentPressure);
      ctx.beginPath();
      ctx.arc(curPt.x, curPt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(curPt.x, curPt.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = traceColors[strokeIndex];
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // State labels
    ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
    const stateLabels = [
      { v: V1, p: P1, label: "1", color: "#66aaff" },
      { v: V2, p: P2, label: "2", color: "#ffcc44" },
      { v: V3, p: P3, label: "3", color: "#ff6644" },
      { v: V4, p: P4, label: "4", color: "#ff8866" },
    ];
    for (const sl of stateLabels) {
      pt = pvToPixel(sl.v, sl.p);
      ctx.fillStyle = sl.color;
      ctx.textAlign = "center";
      ctx.fillText(sl.label, pt.x + 10, pt.y - 6);
    }
  }

  function renderInfoPanel(ipx: number, ipy: number, ipw: number, iph: number): void {
    ctx.fillStyle = "#111827";
    ctx.fillRect(ipx, ipy, ipw, iph);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(ipx, ipy, ipw, iph);

    const lx = ipx + 12;
    let ly = ipy + 20;
    const lineH = 16;

    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Engine Data", lx, ly);
    ly += lineH + 4;

    ctx.font = "11px 'Inter', system-ui, sans-serif";

    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`RPM: ${rpm}`, lx, ly);
    ly += lineH;

    ctx.fillStyle = "#34d399";
    ctx.fillText(`Compression Ratio: ${compressionRatio}:1`, lx, ly);
    ly += lineH;

    const strokeColors = ["#66aaff", "#ffcc44", "#ff6644", "#aaaaaa"];
    ctx.fillStyle = strokeColors[strokeIndex];
    ctx.fillText(`Stroke: ${currentStroke}`, lx, ly);
    ly += lineH;

    ctx.fillStyle = "#f472b6";
    ctx.fillText(`Pressure: ${currentPressure.toFixed(1)} (norm.)`, lx, ly);
    ly += lineH;

    ctx.fillStyle = "#c084fc";
    ctx.fillText(`Volume: ${currentVolume.toFixed(3)} (norm.)`, lx, ly);
    ly += lineH;

    const crankDeg = ((crankAngle * 180) / Math.PI) % 720;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Crank Angle: ${crankDeg.toFixed(0)}\u00B0 / 720\u00B0`, lx, ly);
    ly += lineH;

    const efficiency = (1 - 1 / Math.pow(compressionRatio, GAMMA - 1)) * 100;
    ctx.fillStyle = "#34d399";
    ctx.fillText(`Ideal Efficiency: \u03B7 = 1 \u2212 1/r^(\u03B3\u22121) = ${efficiency.toFixed(1)}%`, lx, ly);
    ly += lineH + 4;

    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    let description: string;
    switch (currentStroke) {
      case "Intake":
        description = "Intake valve open. Piston moves down, drawing in fuel-air mixture.";
        break;
      case "Compression":
        description = "Both valves closed. Piston compresses the mixture adiabatically (PV^\u03B3 = const).";
        break;
      case "Power":
        description = "Spark ignites mixture. Hot gases expand adiabatically, pushing piston down.";
        break;
      case "Exhaust":
        description = "Exhaust valve open. Piston pushes burned gases out of cylinder.";
        break;
    }
    const maxLineWidth = ipw - 24;
    const words = description.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line + (line ? " " : "") + word;
      if (ctx.measureText(testLine).width > maxLineWidth && line) {
        ctx.fillText(line, lx, ly);
        ly += lineH - 3;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, lx, ly);
  }

  function reset(): void {
    time = 0;
    crankAngle = 0;
    sparkTimer = 0;
    pvTrace = [];
    currentStroke = "Intake";
    strokeIndex = 0;
    pistonFraction = 0;
    currentPressure = P1;
    currentVolume = V1;
    spawnParticles();
  }

  function destroy(): void {
    particles = [];
    pvTrace = [];
  }

  function getStateDescription(): string {
    const crankDeg = ((crankAngle * 180) / Math.PI) % 720;
    const efficiency = (1 - 1 / Math.pow(compressionRatio, GAMMA - 1)) * 100;
    return (
      `Four-Stroke Engine (Otto Cycle): RPM=${rpm}, ` +
      `compression ratio=${compressionRatio}:1, ` +
      `current stroke=${currentStroke}, ` +
      `crank angle=${crankDeg.toFixed(0)} deg / 720 deg, ` +
      `piston fraction=${pistonFraction.toFixed(2)}, ` +
      `P=${currentPressure.toFixed(1)} (norm.), V=${currentVolume.toFixed(3)} (norm.), ` +
      `gamma=${GAMMA}, ideal Otto efficiency=${efficiency.toFixed(1)}%. ` +
      `${numParticles} gas particles displayed. ` +
      `Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void {
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

export default FourStrokeEngineFactory;
