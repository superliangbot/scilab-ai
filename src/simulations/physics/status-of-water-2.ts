import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Phase Diagram of Water
 * Demonstrates:
 * - Pressure vs Temperature phase diagram
 * - Solid, Liquid, Gas regions
 * - Phase boundary curves
 * - Triple point (0.01C, 0.006 atm) and Critical point (374C, 218 atm)
 * - Interactive dot showing current T, P and phase
 */

const StatusOfWater2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("status-of-water-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 25;
  let pressure = 1;
  let showLabels = 1;
  let showCriticalPoint = 1;

  // Phase diagram boundaries (simplified but realistic curves)
  // Triple point: 0.01C, 0.006 atm
  // Critical point: 374C, 218 atm
  const tripleT = 0.01;
  const tripleP = 0.006;
  const criticalT = 374;
  const criticalP = 218;

  // Diagram range
  const tMin = -50;
  const tMax = 400;
  const pMin = 0.001;
  const pMax = 300;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    temperature = params.temperature ?? 25;
    pressure = params.pressure ?? 1;
    showLabels = params.showLabels ?? 1;
    showCriticalPoint = params.showCriticalPoint ?? 1;
    time += step;
  }

  // Convert T,P to screen coordinates (log scale for pressure)
  function toScreen(t: number, p: number, plotX: number, plotY: number, plotW: number, plotH: number): { x: number; y: number } {
    const xFrac = (t - tMin) / (tMax - tMin);
    const logP = Math.log10(Math.max(p, 0.0001));
    const logPMin = Math.log10(pMin);
    const logPMax = Math.log10(pMax);
    const yFrac = (logP - logPMin) / (logPMax - logPMin);
    return {
      x: plotX + xFrac * plotW,
      y: plotY + plotH - yFrac * plotH,
    };
  }

  // Clausius-Clapeyron-like curves for phase boundaries
  function getSolidLiquidBoundary(t: number): number {
    // Nearly vertical line at 0C, slightly negative slope (ice is less dense)
    // P = tripleP * exp((t - tripleT) * 0.07) but going up steeply
    return tripleP + (t - tripleT) * (-30); // Simplified: high positive slope
  }

  function getLiquidGasBoundary(t: number): number {
    // Antoine-like equation from triple point to critical point
    if (t < tripleT || t > criticalT) return -1;
    const frac = (t - tripleT) / (criticalT - tripleT);
    // Use a power curve approximation
    return tripleP * Math.pow(criticalP / tripleP, Math.pow(frac, 0.85));
  }

  function getSolidGasBoundary(t: number): number {
    // Sublimation curve below triple point
    if (t > tripleT) return -1;
    const frac = (t - tMin) / (tripleT - tMin);
    return tripleP * Math.pow(frac, 3.5);
  }

  function determinePhase(t: number, p: number): string {
    // Simplified phase determination
    if (t > criticalT && p > criticalP) return "Supercritical Fluid";

    const lgBound = getLiquidGasBoundary(t);
    const sgBound = getSolidGasBoundary(t);

    if (t <= tripleT) {
      if (p > tripleP + (t - tripleT) * (-30)) return "Solid";
      if (p > sgBound && sgBound > 0) return "Solid";
      return "Gas";
    }

    if (t > criticalT) {
      if (p > criticalP) return "Supercritical Fluid";
      return "Gas";
    }

    // Between triple and critical temperature
    if (lgBound > 0 && p > lgBound) {
      // Above liquid-gas boundary: check if solid
      const solidLine = tripleP + (t - tripleT) * (-30);
      if (t < 10 && p > solidLine && solidLine > 0) return "Solid";
      return "Liquid";
    }
    return "Gas";
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0c1020");
    bgGrad.addColorStop(1, "#1a1a35");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.024)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Phase Diagram of Water", width / 2, 28);

    // Plot area
    const plotX = 80;
    const plotY = 55;
    const plotW = width - 160;
    const plotH = height - 130;

    drawPhaseRegions(plotX, plotY, plotW, plotH);
    drawBoundaryCurves(plotX, plotY, plotW, plotH);
    drawAxes(plotX, plotY, plotW, plotH);
    drawSpecialPoints(plotX, plotY, plotW, plotH);
    drawCurrentPoint(plotX, plotY, plotW, plotH);
    drawPhaseInfo();
  }

  function drawPhaseRegions(plotX: number, plotY: number, plotW: number, plotH: number): void {
    // Fill regions with colors
    const resolution = 3;
    for (let px = 0; px < plotW; px += resolution) {
      for (let py = 0; py < plotH; py += resolution) {
        const xFrac = px / plotW;
        const yFrac = 1 - py / plotH;
        const t = tMin + xFrac * (tMax - tMin);
        const logPMin = Math.log10(pMin);
        const logPMax = Math.log10(pMax);
        const logP = logPMin + yFrac * (logPMax - logPMin);
        const p = Math.pow(10, logP);

        const phase = determinePhase(t, p);
        let color = "rgba(0,0,0,0)";

        if (phase === "Solid") color = "rgba(147, 197, 253, 0.12)";
        else if (phase === "Liquid") color = "rgba(59, 130, 246, 0.12)";
        else if (phase === "Gas") color = "rgba(192, 132, 252, 0.08)";
        else if (phase === "Supercritical Fluid") color = "rgba(251, 191, 36, 0.08)";

        ctx.fillStyle = color;
        ctx.fillRect(plotX + px, plotY + py, resolution, resolution);
      }
    }

    // Region labels
    if (showLabels) {
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.textAlign = "center";

      // Solid
      const solidPos = toScreen(-25, 50, plotX, plotY, plotW, plotH);
      ctx.fillStyle = "rgba(147, 197, 253, 0.5)";
      ctx.fillText("SOLID", solidPos.x, solidPos.y);

      // Liquid
      const liquidPos = toScreen(150, 30, plotX, plotY, plotW, plotH);
      ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
      ctx.fillText("LIQUID", liquidPos.x, liquidPos.y);

      // Gas
      const gasPos = toScreen(200, 0.05, plotX, plotY, plotW, plotH);
      ctx.fillStyle = "rgba(192, 132, 252, 0.4)";
      ctx.fillText("GAS", gasPos.x, gasPos.y);

      // Supercritical
      if (showCriticalPoint) {
        const scPos = toScreen(385, 260, plotX, plotY, plotW, plotH);
        ctx.fillStyle = "rgba(251, 191, 36, 0.4)";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.fillText("SUPERCRITICAL", scPos.x, scPos.y);
        ctx.fillText("FLUID", scPos.x, scPos.y + 14);
      }
    }
  }

  function drawBoundaryCurves(plotX: number, plotY: number, plotW: number, plotH: number): void {
    // Solid-Gas boundary (sublimation curve)
    ctx.beginPath();
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2.5;
    let first = true;
    for (let t = tMin; t <= tripleT; t += 1) {
      const p = getSolidGasBoundary(t);
      if (p > 0 && p >= pMin) {
        const pos = toScreen(t, p, plotX, plotY, plotW, plotH);
        if (first) { ctx.moveTo(pos.x, pos.y); first = false; }
        else ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();

    // Liquid-Gas boundary (vaporization curve)
    ctx.beginPath();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    first = true;
    for (let t = tripleT; t <= criticalT; t += 1) {
      const p = getLiquidGasBoundary(t);
      if (p > 0) {
        const pos = toScreen(t, p, plotX, plotY, plotW, plotH);
        if (first) { ctx.moveTo(pos.x, pos.y); first = false; }
        else ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();

    // Solid-Liquid boundary (melting curve) - nearly vertical
    ctx.beginPath();
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2.5;
    const slStartP = tripleP;
    const slEndP = pMax;
    first = true;
    for (let p = slStartP; p <= slEndP; p *= 1.05) {
      // Inverted slope: t decreases slightly as P increases for water
      const t = tripleT - (p - tripleP) / 30;
      if (t >= tMin) {
        const pos = toScreen(t, p, plotX, plotY, plotW, plotH);
        if (first) { ctx.moveTo(pos.x, pos.y); first = false; }
        else ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();

    // Boundary labels
    if (showLabels) {
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "#a78bfa";
      const subPos = toScreen(-30, 0.003, plotX, plotY, plotW, plotH);
      ctx.fillText("Sublimation", subPos.x, subPos.y - 5);

      ctx.fillStyle = "#22d3ee";
      const vapPos = toScreen(200, getLiquidGasBoundary(200), plotX, plotY, plotW, plotH);
      ctx.fillText("Vaporization", vapPos.x + 5, vapPos.y - 5);

      ctx.fillStyle = "#60a5fa";
      const meltPos = toScreen(tripleT - 2, 10, plotX, plotY, plotW, plotH);
      ctx.save();
      ctx.translate(meltPos.x - 12, meltPos.y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("Melting", 0, 0);
      ctx.restore();
    }
  }

  function drawAxes(plotX: number, plotY: number, plotW: number, plotH: number): void {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Temperature ticks
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    const tempTicks = [-50, 0, 50, 100, 150, 200, 250, 300, 350, 400];
    tempTicks.forEach((t) => {
      const pos = toScreen(t, pMin, plotX, plotY, plotW, plotH);
      ctx.beginPath();
      ctx.moveTo(pos.x, plotY + plotH);
      ctx.lineTo(pos.x, plotY + plotH + 5);
      ctx.stroke();
      ctx.fillText(`${t}`, pos.x, plotY + plotH + 16);

      // Grid line
      ctx.strokeStyle = "rgba(100, 116, 139, 0.1)";
      ctx.beginPath();
      ctx.moveTo(pos.x, plotY);
      ctx.lineTo(pos.x, plotY + plotH);
      ctx.stroke();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    });

    // X-axis label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Temperature (\u00B0C)", plotX + plotW / 2, plotY + plotH + 35);

    // Pressure ticks (log scale)
    ctx.textAlign = "right";
    const pressureTicks = [0.001, 0.01, 0.1, 1, 10, 100, 300];
    pressureTicks.forEach((p) => {
      const pos = toScreen(tMin, p, plotX, plotY, plotW, plotH);
      ctx.beginPath();
      ctx.moveTo(plotX - 5, pos.y);
      ctx.lineTo(plotX, pos.y);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(p < 0.1 ? p.toFixed(3) : p < 1 ? p.toFixed(1) : `${p}`, plotX - 8, pos.y + 3);

      ctx.strokeStyle = "rgba(100, 116, 139, 0.1)";
      ctx.beginPath();
      ctx.moveTo(plotX, pos.y);
      ctx.lineTo(plotX + plotW, pos.y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    });

    // Y-axis label
    ctx.save();
    ctx.translate(20, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pressure (atm)", 0, 0);
    ctx.restore();
  }

  function drawSpecialPoints(plotX: number, plotY: number, plotW: number, plotH: number): void {
    // Triple point
    const tp = toScreen(tripleT, tripleP, plotX, plotY, plotW, plotH);
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pulsing glow
    const glowR = 10 + Math.sin(time * 3) * 3;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, glowR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(244, 63, 94, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (showLabels) {
      ctx.fillStyle = "#f43f5e";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Triple Point", tp.x + 10, tp.y - 5);
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText("(0.01\u00B0C, 0.006 atm)", tp.x + 10, tp.y + 8);
    }

    // Critical point
    if (showCriticalPoint) {
      const cp = toScreen(criticalT, criticalP, plotX, plotY, plotW, plotH);
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const cpGlow = 10 + Math.sin(time * 3 + 1) * 3;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cpGlow, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (showLabels) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 11px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("Critical Point", cp.x - 10, cp.y - 5);
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText("(374\u00B0C, 218 atm)", cp.x - 10, cp.y + 8);
      }
    }
  }

  function drawCurrentPoint(plotX: number, plotY: number, plotW: number, plotH: number): void {
    const clampedP = Math.max(pMin, Math.min(pMax, pressure));
    const pos = toScreen(temperature, clampedP, plotX, plotY, plotW, plotH);

    // Crosshair
    ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pos.x, plotY);
    ctx.lineTo(pos.x, plotY + plotH);
    ctx.moveTo(plotX, pos.y);
    ctx.lineTo(plotX + plotW, pos.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Point
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#22d3ee";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glow
    const glow = 14 + Math.sin(time * 4) * 3;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, glow, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawPhaseInfo(): void {
    const phase = determinePhase(temperature, pressure);
    const px = width - 200;
    const py = 50;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, 185, 80, 8);
    ctx.fill();

    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Current State", px + 12, py + 18);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`T = ${temperature.toFixed(1)} \u00B0C`, px + 12, py + 38);
    ctx.fillText(`P = ${pressure.toFixed(3)} atm`, px + 12, py + 54);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`Phase: ${phase}`, px + 12, py + 72);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const phase = determinePhase(temperature, pressure);
    return (
      `Water phase diagram: T=${temperature}\u00B0C, P=${pressure}atm => ${phase}. ` +
      `Triple point at 0.01\u00B0C, 0.006 atm (all three phases coexist). ` +
      `Critical point at 374\u00B0C, 218 atm (liquid-gas distinction vanishes). ` +
      `Phase boundaries show sublimation, melting, and vaporization curves.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StatusOfWater2Factory;
