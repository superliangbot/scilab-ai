import type {
  SimulationEngine,
  SimulationFactory,
  SimulationConfig,
} from "../types";
import { getSimConfig } from "../registry";

// ─── Refrigerant particle ───────────────────────────────────────────
interface RefrigerantParticle {
  /** Progress around the loop: 0..1 */
  t: number;
  /** Unique speed offset so particles don't clump */
  speedOffset: number;
}

// ─── Geometry helpers ───────────────────────────────────────────────
interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Temperature-to-color helper ────────────────────────────────────
function tempToColor(tempC: number, minC: number, maxC: number): string {
  const t = Math.max(0, Math.min(1, (tempC - minC) / (maxC - minC)));
  // blue (0) -> cyan (0.25) -> green (0.5) -> yellow (0.75) -> red (1)
  if (t < 0.25) {
    const s = t / 0.25;
    const r = Math.round(30 * s);
    const g = Math.round(100 + 155 * s);
    const b = 255;
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    const r = Math.round(30 + 100 * s);
    const g = 255;
    const b = Math.round(255 - 180 * s);
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    const r = Math.round(130 + 125 * s);
    const g = Math.round(255 - 55 * s);
    const b = Math.round(75 - 75 * s);
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.75) / 0.25;
    const r = 255;
    const g = Math.round(200 - 200 * s);
    const b = 0;
    return `rgb(${r},${g},${b})`;
  }
}

function roundSig(value: number, digits: number): string {
  if (value === 0) return "0";
  return value.toPrecision(digits);
}

// ─── Factory ────────────────────────────────────────────────────────
const AirConditionerFactory: SimulationFactory = () => {
  const config = getSimConfig("air-conditioner") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters (updated each frame)
  let mode = 0; // 0 = AC, 1 = Heat Pump
  let compressorPower = 1;
  let outdoorTemp = 35;
  let indoorTemp = 25;

  // Particles
  const NUM_PARTICLES = 28;
  let particles: RefrigerantParticle[] = [];

  // ── Cycle thermodynamics ────────────────────────────────────────
  // Returns temperatures at each stage in Celsius:
  // [afterEvaporator, afterCompressor, afterCondenser, afterExpansion]
  function cycleTemps(): {
    evapTemp: number;
    compOutTemp: number;
    condOutTemp: number;
    expOutTemp: number;
    cop: number;
    qCold: number;
    qHot: number;
    wInput: number;
  } {
    // In AC mode: evaporator is indoors (absorbs heat), condenser is outdoors (releases heat)
    // In Heat Pump mode: evaporator is outdoors (absorbs heat), condenser is indoors (releases heat)
    const coldSide = mode === 0 ? indoorTemp : outdoorTemp;
    const hotSide = mode === 0 ? outdoorTemp : indoorTemp;

    // Evaporator temp must be below cold-side ambient to absorb heat
    const evapTemp = coldSide - 10 - 3 * compressorPower;
    // Compressor raises temperature significantly based on power
    const compOutTemp = hotSide + 15 * compressorPower + 10;
    // Condenser cools the gas to just above hot-side ambient
    const condOutTemp = hotSide + 3;
    // Expansion valve drops temperature via adiabatic expansion
    const expOutTemp = evapTemp + 2;

    // COP calculation
    // For AC: COP = Tc / (Th - Tc) idealized (Carnot)
    const TcK = (coldSide + 273.15);
    const ThK = (hotSide + 273.15);
    const tempDiffK = ThK - TcK;
    const carnotCOP = tempDiffK > 0 ? TcK / tempDiffK : 20;
    // Realistic COP is ~40-60% of Carnot
    const realCOP = Math.min(carnotCOP * 0.45 * compressorPower, 12);

    // Energy flows (kW, arbitrary but realistic scale)
    const wInput = 1.0 * compressorPower; // work input
    const qCold = wInput * Math.max(realCOP, 0.5); // heat absorbed from cold side
    const qHot = qCold + wInput; // heat rejected to hot side (energy conservation)

    return {
      evapTemp,
      compOutTemp,
      condOutTemp,
      expOutTemp,
      cop: Math.max(realCOP, 0.5),
      qCold,
      qHot,
      wInput,
    };
  }

  // ── Cycle path geometry ─────────────────────────────────────────
  // The cycle is a rectangular loop with rounded corners.
  // Segments: evaporator (left) -> compressor pipe (bottom) -> condenser (right) -> expansion pipe (top)
  // In AC mode the flow is: Evaporator(indoor,left) -> Compressor(bottom-right) -> Condenser(outdoor,right) -> ExpValve(top-left) -> back
  // In Heat Pump mode: reversed labels, but same physical loop direction.

  function layoutRects(): {
    evaporator: Rect;
    condenser: Rect;
    compressor: Rect;
    expValve: Rect;
    indoorZone: Rect;
    outdoorZone: Rect;
  } {
    const margin = 40;
    const topY = 80;
    const bottomY = H - 80;
    const midY = (topY + bottomY) / 2;
    const leftX = margin + 30;
    const rightX = W - margin - 30;
    const midX = W / 2;

    const compW = 80;
    const compH = 50;
    const valveW = 70;
    const valveH = 40;
    const coilW = 90;
    const coilH = Math.min(260, bottomY - topY - 60);

    return {
      evaporator: { x: leftX, y: midY - coilH / 2, w: coilW, h: coilH },
      condenser: { x: rightX - coilW, y: midY - coilH / 2, w: coilW, h: coilH },
      compressor: { x: midX + 40, y: bottomY - compH - 10, w: compW, h: compH },
      expValve: { x: midX - 40 - valveW, y: topY + 10, w: valveW, h: valveH },
      indoorZone: { x: 0, y: 0, w: W / 2, h: H },
      outdoorZone: { x: W / 2, y: 0, w: W / 2, h: H },
    };
  }

  // The cycle path is defined as a series of points forming a loop.
  // We parameterize t in [0,1] around the loop.
  function getCyclePathPoints(): Point[] {
    const layout = layoutRects();
    const evap = layout.evaporator;
    const cond = layout.condenser;
    const comp = layout.compressor;
    const valve = layout.expValve;

    // Path: Evaporator top -> top pipe -> Expansion Valve -> top pipe -> Condenser top
    //       -> Condenser bottom -> bottom pipe -> Compressor -> bottom pipe -> Evaporator bottom
    // We trace counter-clockwise from evaporator bottom up through evaporator, across top,
    // down through condenser, across bottom.

    const points: Point[] = [];
    const steps = 10; // subdivisions per segment for smooth curves

    // Segment 1: Evaporator — going up from bottom to top (absorbing heat)
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      // Zigzag coil pattern inside evaporator
      const yy = evap.y + evap.h - frac * evap.h;
      const zigzag = Math.sin(frac * Math.PI * 5) * (evap.w * 0.3);
      points.push({ x: evap.x + evap.w / 2 + zigzag, y: yy });
    }

    // Segment 2: Top pipe — evaporator top to expansion valve
    const evapTopX = evap.x + evap.w / 2;
    const evapTopY = evap.y;
    const valveCX = valve.x + valve.w / 2;
    const valveCY = valve.y + valve.h / 2;
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      points.push({
        x: evapTopX + (valveCX - evapTopX) * frac,
        y: evapTopY + (valveCY - evapTopY) * frac * frac, // slight curve
      });
    }

    // Segment 3: Top pipe — expansion valve to condenser top
    const condTopX = cond.x + cond.w / 2;
    const condTopY = cond.y;
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      points.push({
        x: valveCX + (condTopX - valveCX) * frac,
        y: valveCY + (condTopY - valveCY) * frac,
      });
    }

    // Segment 4: Condenser — going down from top to bottom (releasing heat)
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const yy = cond.y + frac * cond.h;
      const zigzag = Math.sin(frac * Math.PI * 5) * (cond.w * 0.3);
      points.push({ x: cond.x + cond.w / 2 + zigzag, y: yy });
    }

    // Segment 5: Bottom pipe — condenser bottom to compressor
    const condBotX = cond.x + cond.w / 2;
    const condBotY = cond.y + cond.h;
    const compCX = comp.x + comp.w / 2;
    const compCY = comp.y + comp.h / 2;
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      points.push({
        x: condBotX + (compCX - condBotX) * frac,
        y: condBotY + (compCY - condBotY) * frac,
      });
    }

    // Segment 6: Bottom pipe — compressor to evaporator bottom
    const evapBotX = evap.x + evap.w / 2;
    const evapBotY = evap.y + evap.h;
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      points.push({
        x: compCX + (evapBotX - compCX) * frac,
        y: compCY + (evapBotY - compCY) * frac,
      });
    }

    return points;
  }

  // Get position along path for a given t in [0,1]
  function getPositionOnPath(pathPoints: Point[], t: number): Point {
    const tt = ((t % 1) + 1) % 1; // wrap to [0,1)
    const index = tt * (pathPoints.length - 1);
    const i = Math.floor(index);
    const frac = index - i;
    const a = pathPoints[i];
    const b = pathPoints[Math.min(i + 1, pathPoints.length - 1)];
    return {
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
    };
  }

  // Get temperature at a given t along the cycle path.
  // Temperature profile along the 6 visual segments:
  //   0: Evaporator  — cold liquid absorbs heat, evaporates (expOutTemp -> evapTemp)
  //   1: Suction line — gas compressed, temperature rises (evapTemp -> compOutTemp)
  //   2: Discharge line — hot gas heading to condenser (compOutTemp, slight drop)
  //   3: Condenser   — gas condenses, releases heat (compOutTemp -> condOutTemp)
  //   4: Liquid line  — subcooled liquid heading to expansion valve (condOutTemp, slight drop)
  //   5: Expansion   — adiabatic expansion, big temperature drop (condOutTemp -> expOutTemp)
  function getTempAtProgress(t: number): number {
    const temps = cycleTemps();
    const tt = ((t % 1) + 1) % 1;
    const seg = tt * 6;

    if (seg < 1) {
      // Evaporator: cold liquid evaporating, absorbs heat
      const frac = seg;
      return temps.expOutTemp + frac * (temps.evapTemp - temps.expOutTemp + 5);
    } else if (seg < 2) {
      // Suction line + compression: gas temperature rises to compressor output
      const frac = seg - 1;
      return temps.evapTemp + 3 + frac * (temps.compOutTemp - temps.evapTemp - 3);
    } else if (seg < 3) {
      // Discharge line: hot gas going to condenser
      const frac = seg - 2;
      return temps.compOutTemp - frac * 2;
    } else if (seg < 4) {
      // Condenser: releasing heat, gas condenses to liquid
      const frac = seg - 3;
      return temps.compOutTemp - 2 + (temps.condOutTemp - temps.compOutTemp + 2) * frac;
    } else if (seg < 5) {
      // Liquid line: subcooled liquid heading to expansion valve
      const frac = seg - 4;
      return temps.condOutTemp - frac * 2;
    } else {
      // Expansion valve: adiabatic expansion, big temperature drop
      const frac = seg - 5;
      return (temps.condOutTemp - 2) + (temps.expOutTemp - temps.condOutTemp + 2) * frac;
    }
  }

  function spawnParticles() {
    particles = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        t: i / NUM_PARTICLES,
        speedOffset: 0.85 + Math.random() * 0.3,
      });
    }
  }

  // ── Drawing helpers ─────────────────────────────────────────────
  function drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawComponent(rect: Rect, label: string, sublabel: string, color: string, tempC: number) {
    // Background
    drawRoundedRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 - 4);

    // Sublabel
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(sublabel, rect.x + rect.w / 2, rect.y + rect.h / 2 + 10);

    // Temperature badge
    ctx.font = "bold 10px 'Inter', system-ui, sans-serif";
    const tempStr = `${Math.round(tempC)}°C`;
    const tempColor = tempToColor(tempC, -20, 80);
    ctx.fillStyle = tempColor;
    ctx.fillText(tempStr, rect.x + rect.w / 2, rect.y + rect.h + 14);
  }

  function drawCoil(rect: Rect, isHot: boolean, label: string, tempIn: number, tempOut: number, pulsePhase: number) {
    // Draw the coil/heat exchanger box
    drawRoundedRect(rect.x, rect.y, rect.w, rect.h, 10);
    const bgColor = isHot ? "rgba(239, 68, 68, 0.12)" : "rgba(59, 130, 246, 0.12)";
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = isHot ? "#ef4444" : "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Coil zigzag lines inside
    const coilPadX = 15;
    const coilPadY = 25;
    const numPasses = 6;
    ctx.beginPath();
    ctx.strokeStyle = isHot ? "rgba(239, 68, 68, 0.4)" : "rgba(59, 130, 246, 0.4)";
    ctx.lineWidth = 2;
    for (let i = 0; i < numPasses; i++) {
      const yy = rect.y + coilPadY + (i / (numPasses - 1)) * (rect.h - 2 * coilPadY);
      const xStart = i % 2 === 0 ? rect.x + coilPadX : rect.x + rect.w - coilPadX;
      const xEnd = i % 2 === 0 ? rect.x + rect.w - coilPadX : rect.x + coilPadX;
      if (i === 0) ctx.moveTo(xStart, yy);
      else ctx.lineTo(xStart, yy);
      ctx.lineTo(xEnd, yy);
    }
    ctx.stroke();

    // Heat transfer arrows (inward = absorbing, outward = releasing)
    const arrowCount = 4;
    for (let i = 0; i < arrowCount; i++) {
      const frac = (i + 0.5) / arrowCount;
      const yy = rect.y + rect.h * frac;
      const pulse = Math.sin(pulsePhase + i * 1.2) * 0.3 + 0.7;

      ctx.globalAlpha = pulse * 0.8;
      ctx.strokeStyle = isHot ? "#fbbf24" : "#38bdf8";
      ctx.lineWidth = 2;

      const arrowLen = 18;
      const arrowHead = 5;

      if (isHot) {
        // Outward arrows (releasing heat) — arrows pointing away from coil on both sides
        // Left side arrow pointing left
        const ax1 = rect.x - 5;
        ctx.beginPath();
        ctx.moveTo(ax1, yy);
        ctx.lineTo(ax1 - arrowLen, yy);
        ctx.moveTo(ax1 - arrowLen, yy);
        ctx.lineTo(ax1 - arrowLen + arrowHead, yy - arrowHead);
        ctx.moveTo(ax1 - arrowLen, yy);
        ctx.lineTo(ax1 - arrowLen + arrowHead, yy + arrowHead);
        ctx.stroke();

        // Right side arrow pointing right
        const ax2 = rect.x + rect.w + 5;
        ctx.beginPath();
        ctx.moveTo(ax2, yy);
        ctx.lineTo(ax2 + arrowLen, yy);
        ctx.moveTo(ax2 + arrowLen, yy);
        ctx.lineTo(ax2 + arrowLen - arrowHead, yy - arrowHead);
        ctx.moveTo(ax2 + arrowLen, yy);
        ctx.lineTo(ax2 + arrowLen - arrowHead, yy + arrowHead);
        ctx.stroke();
      } else {
        // Inward arrows (absorbing heat) — arrows pointing toward coil
        // Left side arrow pointing right
        const ax1 = rect.x - arrowLen - 5;
        ctx.beginPath();
        ctx.moveTo(ax1, yy);
        ctx.lineTo(ax1 + arrowLen, yy);
        ctx.moveTo(ax1 + arrowLen, yy);
        ctx.lineTo(ax1 + arrowLen - arrowHead, yy - arrowHead);
        ctx.moveTo(ax1 + arrowLen, yy);
        ctx.lineTo(ax1 + arrowLen - arrowHead, yy + arrowHead);
        ctx.stroke();

        // Right side arrow pointing left
        const ax2 = rect.x + rect.w + arrowLen + 5;
        ctx.beginPath();
        ctx.moveTo(ax2, yy);
        ctx.lineTo(ax2 - arrowLen, yy);
        ctx.moveTo(ax2 - arrowLen, yy);
        ctx.lineTo(ax2 - arrowLen + arrowHead, yy - arrowHead);
        ctx.moveTo(ax2 - arrowLen, yy);
        ctx.lineTo(ax2 - arrowLen + arrowHead, yy + arrowHead);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Label above
    ctx.font = "bold 12px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = isHot ? "#fca5a5" : "#93c5fd";
    ctx.textAlign = "center";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y - 8);

    // Temperature range
    ctx.font = "10px 'Inter', system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `${Math.round(tempIn)}°C -> ${Math.round(tempOut)}°C`,
      rect.x + rect.w / 2,
      rect.y + rect.h + 16
    );
  }

  function drawPipe(from: Point, to: Point, color: string) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();

    // Inner highlight
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ── Engine ──────────────────────────────────────────────────────
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      W = canvas.width;
      H = canvas.height;
      time = 0;
      spawnParticles();
    },

    update(dt: number, params: Record<string, number>) {
      const dtClamped = Math.min(dt, 0.05);
      time += dtClamped;

      mode = Math.round(params.mode ?? 0);
      compressorPower = params.compressorPower ?? 1;
      outdoorTemp = params.outdoorTemp ?? 35;
      indoorTemp = params.indoorTemp ?? 25;

      // Move particles around the loop
      const speed = 0.06 * compressorPower; // cycles per second
      for (const p of particles) {
        p.t += speed * dtClamped * p.speedOffset;
        if (p.t > 1) p.t -= 1;
      }
    },

    render() {
      if (!ctx) return;

      const layout = layoutRects();
      const temps = cycleTemps();
      const pathPoints = getCyclePathPoints();

      // ── Background ──────────────────────────────
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, W, H);

      // ── Indoor / Outdoor zones ──────────────────
      // Dividing line
      const divX = W / 2;

      // Indoor zone tint
      ctx.fillStyle = mode === 0
        ? "rgba(59, 130, 246, 0.04)"  // AC: cooling, blue tint
        : "rgba(239, 68, 68, 0.04)";  // HP: warming, red tint
      ctx.fillRect(0, 0, divX, H);

      // Outdoor zone tint
      ctx.fillStyle = mode === 0
        ? "rgba(239, 68, 68, 0.04)"
        : "rgba(59, 130, 246, 0.04)";
      ctx.fillRect(divX, 0, W - divX, H);

      // Dividing line
      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.moveTo(divX, 50);
      ctx.lineTo(divX, H - 30);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      // Zone labels
      ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#60a5fa";
      ctx.fillText("INDOOR", divX / 2, 28);
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${indoorTemp}°C ambient`, divX / 2, 44);

      ctx.font = "bold 14px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#f97316";
      ctx.fillText("OUTDOOR", divX + (W - divX) / 2, 28);
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${outdoorTemp}°C ambient`, divX + (W - divX) / 2, 44);

      // ── Title ───────────────────────────────────
      ctx.font = "bold 17px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(
        mode === 0
          ? "Air Conditioner \u2014 Vapor-Compression Refrigeration"
          : "Heat Pump \u2014 Vapor-Compression Cycle (Reversed)",
        W / 2,
        68
      );

      // ── Draw pipe paths ─────────────────────────
      // Draw the full pipe loop as connected segments with temperature-based coloring
      for (let i = 0; i < pathPoints.length - 1; i++) {
        const t1 = i / (pathPoints.length - 1);
        const temp1 = getTempAtProgress(t1);
        const color = tempToColor(temp1, -20, 80);
        drawPipe(pathPoints[i], pathPoints[i + 1], color);
      }
      // Close the loop
      if (pathPoints.length > 1) {
        const tLast = 1;
        const tempLast = getTempAtProgress(tLast);
        const color = tempToColor(tempLast, -20, 80);
        drawPipe(pathPoints[pathPoints.length - 1], pathPoints[0], color);
      }

      // ── Draw flow direction arrows on pipes ─────
      const arrowPositions = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];
      for (const at of arrowPositions) {
        const pos = getPositionOnPath(pathPoints, at);
        const posAhead = getPositionOnPath(pathPoints, at + 0.01);
        const dx = posAhead.x - pos.x;
        const dy = posAhead.y - pos.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.1) continue;
        const nx = dx / len;
        const ny = dy / len;
        const arrowSize = 5;
        const temp = getTempAtProgress(at);
        const col = tempToColor(temp, -20, 80);

        ctx.beginPath();
        ctx.moveTo(pos.x + nx * arrowSize, pos.y + ny * arrowSize);
        ctx.lineTo(pos.x - nx * arrowSize - ny * arrowSize, pos.y - ny * arrowSize + nx * arrowSize);
        ctx.lineTo(pos.x - nx * arrowSize + ny * arrowSize, pos.y - ny * arrowSize - nx * arrowSize);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      }

      // ── Draw components ─────────────────────────
      const evap = layout.evaporator;
      const cond = layout.condenser;
      const comp = layout.compressor;
      const valve = layout.expValve;

      // Determine which coil is hot/cold based on mode
      if (mode === 0) {
        // AC mode: evaporator (indoor) absorbs heat (cold), condenser (outdoor) releases heat (hot)
        drawCoil(evap, false, "EVAPORATOR", temps.expOutTemp, temps.evapTemp, time * 3);
        drawCoil(cond, true, "CONDENSER", temps.compOutTemp, temps.condOutTemp, time * 3);
      } else {
        // Heat pump mode: evaporator (indoor side shows as condenser), condenser (outdoor shows as evaporator)
        // In heat pump, indoor unit releases heat, outdoor unit absorbs heat
        drawCoil(evap, true, "CONDENSER", temps.compOutTemp, temps.condOutTemp, time * 3);
        drawCoil(cond, false, "EVAPORATOR", temps.expOutTemp, temps.evapTemp, time * 3);
      }

      // Compressor
      drawComponent(
        comp,
        "COMPRESSOR",
        `${compressorPower}\u00D7 power`,
        "rgba(168, 85, 247, 0.25)",
        temps.compOutTemp
      );

      // Expansion valve
      drawComponent(
        valve,
        "EXP. VALVE",
        "Pressure drop",
        "rgba(34, 197, 94, 0.2)",
        temps.expOutTemp
      );

      // ── Draw refrigerant particles ──────────────
      for (const p of particles) {
        const pos = getPositionOnPath(pathPoints, p.t);
        const temp = getTempAtProgress(p.t);
        const color = tempToColor(temp, -20, 80);

        // Particle glow
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Particle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Bright center
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fill();
      }

      // ── Functional labels on pipe segments ──────
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#64748b";

      // Top pipe label
      const topPipeMidX = (evap.x + evap.w / 2 + cond.x + cond.w / 2) / 2;
      const topPipeY = Math.min(evap.y, cond.y) - 2;
      if (mode === 0) {
        ctx.fillText("High-pressure liquid", topPipeMidX, topPipeY);
      } else {
        ctx.fillText("High-pressure liquid", topPipeMidX, topPipeY);
      }

      // Bottom pipe label
      const botPipeMidX = (evap.x + evap.w / 2 + cond.x + cond.w / 2) / 2;
      const botPipeY = Math.max(evap.y + evap.h, cond.y + cond.h) + 30;
      if (mode === 0) {
        ctx.fillText("Low-pressure gas \u2192 High-pressure gas", botPipeMidX, botPipeY);
      } else {
        ctx.fillText("Low-pressure gas \u2192 High-pressure gas", botPipeMidX, botPipeY);
      }

      // ── Data panel ──────────────────────────────
      const panelY = H - 55;
      const panelX = 15;

      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.fillRect(panelX - 5, panelY - 14, W - 20, 50);

      ctx.font = "12px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";

      // COP
      ctx.fillStyle = "#34d399";
      ctx.fillText(
        `COP = ${roundSig(temps.cop, 3)}`,
        panelX,
        panelY
      );

      // Energy flows
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(
        `Q\u2091old = ${roundSig(temps.qCold, 3)} kW`,
        panelX + 120,
        panelY
      );

      ctx.fillStyle = "#fbbf24";
      ctx.fillText(
        `Q\u2095ot = ${roundSig(temps.qHot, 3)} kW`,
        panelX + 280,
        panelY
      );

      ctx.fillStyle = "#c084fc";
      ctx.fillText(
        `W\u1d62\u2099 = ${roundSig(temps.wInput, 3)} kW`,
        panelX + 430,
        panelY
      );

      // Second row: explanation
      ctx.font = "11px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#64748b";
      const explanation = mode === 0
        ? "AC Mode: Absorbs heat indoors, releases it outdoors. Q_hot = Q_cold + W_input"
        : "Heat Pump Mode: Absorbs heat outdoors, releases it indoors. Q_hot = Q_cold + W_input";
      ctx.fillText(explanation, panelX, panelY + 18);

      // Mode indicator
      ctx.font = "bold 11px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = mode === 0 ? "#60a5fa" : "#f97316";
      ctx.fillText(
        mode === 0 ? "Mode: Air Conditioner (Cooling)" : "Mode: Heat Pump (Heating)",
        W - panelX,
        panelY
      );

      // Energy conservation note
      ctx.font = "10px 'Inter', system-ui, sans-serif";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "right";
      ctx.fillText(
        `COP = ${mode === 0 ? "Q_cold" : "Q_hot"} / W_input  |  1st Law: Q_hot = Q_cold + W`,
        W - panelX,
        panelY + 18
      );
    },

    reset() {
      time = 0;
      mode = 0;
      compressorPower = config.parameters.find((p) => p.key === "compressorPower")!.defaultValue;
      outdoorTemp = config.parameters.find((p) => p.key === "outdoorTemp")!.defaultValue;
      indoorTemp = config.parameters.find((p) => p.key === "indoorTemp")!.defaultValue;
      spawnParticles();
    },

    destroy() {
      particles = [];
    },

    getStateDescription(): string {
      const temps = cycleTemps();
      const modeStr = mode === 0 ? "Air Conditioner (cooling)" : "Heat Pump (heating)";
      return (
        `Air Conditioner / Heat Pump simulation in ${modeStr} mode. ` +
        `Indoor temp: ${indoorTemp}°C, Outdoor temp: ${outdoorTemp}°C. ` +
        `Compressor power: ${compressorPower}×. ` +
        `Evaporator temp: ${Math.round(temps.evapTemp)}°C, ` +
        `Compressor outlet: ${Math.round(temps.compOutTemp)}°C, ` +
        `Condenser outlet: ${Math.round(temps.condOutTemp)}°C, ` +
        `After expansion valve: ${Math.round(temps.expOutTemp)}°C. ` +
        `COP = ${roundSig(temps.cop, 3)}. ` +
        `Q_cold = ${roundSig(temps.qCold, 3)} kW, ` +
        `Q_hot = ${roundSig(temps.qHot, 3)} kW, ` +
        `W_input = ${roundSig(temps.wInput, 3)} kW. ` +
        `Vapor-compression refrigeration cycle: ` +
        `evaporator absorbs latent heat, compressor raises pressure and temperature (PV=nRT), ` +
        `condenser releases latent heat, expansion valve causes adiabatic cooling.`
      );
    },

    resize(w: number, h: number) {
      W = w;
      H = h;
    },
  };

  return engine;
};

export default AirConditionerFactory;
