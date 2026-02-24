import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Countercurrent Exchange -- Heat/substance transfer between two parallel
 * fluids flowing in opposite directions.
 *
 * Key physics: countercurrent flow maintains a temperature gradient along the
 * full length of the exchanger, achieving greater total heat transfer than
 * concurrent (same-direction) flow, which equilibrates at a common temperature.
 *
 * The simulation shows both modes side-by-side with animated fluid particles,
 * heat-transfer arrows, and a temperature-profile graph at the bottom.
 */

interface FluidParticle {
  x: number;
  y: number;
  temp: number;
  speed: number;
}

const SEGMENTS = 40; // discretised tube segments for heat calc

const CountercurrentExchangeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("countercurrent-exchange") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters (defaults)
  let flowRate = 5;
  let hotTemp = 80;
  let coldTemp = 10;
  let exchangeRate = 0.5;

  // Temperature profiles along tube length (0 = left, SEGMENTS-1 = right)
  let counterHot: number[] = [];
  let counterCold: number[] = [];
  let concurrentHot: number[] = [];
  let concurrentCold: number[] = [];

  // Animated particles
  let counterHotP: FluidParticle[] = [];
  let counterColdP: FluidParticle[] = [];
  let concurrentHotP: FluidParticle[] = [];
  let concurrentColdP: FluidParticle[] = [];

  const PARTICLE_COUNT = 28;

  // ---- layout helpers ------------------------------------------------
  function tubeArea() {
    const m = width * 0.06;
    return {
      left: m,
      right: width - m,
      w: width - 2 * m,
      counterTopY: height * 0.08,
      counterBotY: height * 0.08 + height * 0.14,
      concurrentTopY: height * 0.30,
      concurrentBotY: height * 0.30 + height * 0.14,
      tubeH: height * 0.05,
      gap: height * 0.04,
    };
  }

  // ---- temperature solve (steady-state 1-D) --------------------------
  function solveProfiles() {
    const k = exchangeRate * 0.12;

    // Countercurrent: hot flows L->R, cold flows R->L
    counterHot = new Array(SEGMENTS);
    counterCold = new Array(SEGMENTS);
    counterHot[0] = hotTemp;
    counterCold[SEGMENTS - 1] = coldTemp;
    // Iterative Gauss-Seidel-style relaxation
    for (let i = 0; i < SEGMENTS; i++) {
      counterHot[i] = hotTemp;
      counterCold[i] = coldTemp;
    }
    for (let iter = 0; iter < 200; iter++) {
      for (let i = 1; i < SEGMENTS; i++) {
        const dT = counterHot[i - 1] - counterCold[i];
        counterHot[i] = counterHot[i - 1] - k * dT;
      }
      for (let i = SEGMENTS - 2; i >= 0; i--) {
        const dT = counterHot[i] - counterCold[i + 1];
        counterCold[i] = counterCold[i + 1] + k * dT;
      }
      counterHot[0] = hotTemp;
      counterCold[SEGMENTS - 1] = coldTemp;
    }

    // Concurrent: both flow L->R
    concurrentHot = new Array(SEGMENTS);
    concurrentCold = new Array(SEGMENTS);
    concurrentHot[0] = hotTemp;
    concurrentCold[0] = coldTemp;
    for (let i = 1; i < SEGMENTS; i++) {
      const dT = concurrentHot[i - 1] - concurrentCold[i - 1];
      concurrentHot[i] = concurrentHot[i - 1] - k * dT;
      concurrentCold[i] = concurrentCold[i - 1] + k * dT;
    }
  }

  // ---- particle helpers -----------------------------------------------
  function spawnParticles() {
    const a = tubeArea();
    const makeRow = (yCenter: number, goRight: boolean, temps: number[]): FluidParticle[] => {
      const arr: FluidParticle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const frac = i / PARTICLE_COUNT;
        const seg = Math.min(SEGMENTS - 1, Math.floor(frac * SEGMENTS));
        arr.push({
          x: a.left + frac * a.w,
          y: yCenter + (Math.random() - 0.5) * a.tubeH * 0.6,
          temp: temps[seg],
          speed: goRight ? 1 : -1,
        });
      }
      return arr;
    };

    solveProfiles();

    const tubeMidTop = (baseY: number) => baseY + a.tubeH / 2;
    const tubeMidBot = (baseY: number) => baseY + a.gap + a.tubeH + a.tubeH / 2;

    counterHotP = makeRow(tubeMidTop(a.counterTopY), true, counterHot);
    counterColdP = makeRow(tubeMidBot(a.counterTopY), false, counterCold);
    concurrentHotP = makeRow(tubeMidTop(a.concurrentTopY), true, concurrentHot);
    concurrentColdP = makeRow(tubeMidBot(a.concurrentTopY), true, concurrentCold);
  }

  function moveParticles(ps: FluidParticle[], temps: number[], goRight: boolean, dt: number) {
    const a = tubeArea();
    const baseSpeed = flowRate * 25;
    for (const p of ps) {
      p.x += (goRight ? 1 : -1) * baseSpeed * dt;
      // Wrap around
      if (p.x > a.right) p.x = a.left + (p.x - a.right);
      if (p.x < a.left) p.x = a.right - (a.left - p.x);
      // Update temperature from profile
      const frac = (p.x - a.left) / a.w;
      const seg = Math.min(SEGMENTS - 1, Math.max(0, Math.floor(frac * SEGMENTS)));
      p.temp = temps[seg];
    }
  }

  // ---- color helpers --------------------------------------------------
  function tempColor(t: number): string {
    const frac = Math.max(0, Math.min(1, (t - coldTemp) / (hotTemp - coldTemp + 0.001)));
    const r = Math.round(60 + 195 * frac);
    const g = Math.round(80 + 60 * (1 - Math.abs(frac - 0.5) * 2));
    const b = Math.round(220 - 180 * frac);
    return `rgb(${r},${g},${b})`;
  }

  // ---- engine interface -----------------------------------------------
  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    solveProfiles();
    spawnParticles();
  }

  function update(dt: number, params: Record<string, number>): void {
    const nf = params.flowRate ?? flowRate;
    const nh = params.hotTemp ?? hotTemp;
    const nc = params.coldTemp ?? coldTemp;
    const ne = params.exchangeRate ?? exchangeRate;

    if (nf !== flowRate || nh !== hotTemp || nc !== coldTemp || ne !== exchangeRate) {
      flowRate = nf;
      hotTemp = nh;
      coldTemp = nc;
      exchangeRate = ne;
      solveProfiles();
      spawnParticles();
    }

    const step = Math.min(dt, 0.03);
    time += step;

    moveParticles(counterHotP, counterHot, true, step);
    moveParticles(counterColdP, counterCold, false, step);
    moveParticles(concurrentHotP, concurrentHot, true, step);
    moveParticles(concurrentColdP, concurrentCold, true, step);
  }

  function drawTube(
    label: string,
    baseY: number,
    hotParticles: FluidParticle[],
    coldParticles: FluidParticle[],
    hotTemps: number[],
    coldTemps: number[],
    hotDir: string,
    coldDir: string,
  ) {
    const a = tubeArea();
    const topY = baseY;
    const botY = baseY + a.gap + a.tubeH;

    // Section label
    ctx.font = `bold ${Math.max(11, width * 0.018)}px system-ui, sans-serif`;
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "left";
    ctx.fillText(label, a.left, topY - 4);

    // Draw tubes
    for (const ty of [topY, botY]) {
      ctx.fillStyle = "rgba(30,45,70,0.4)";
      ctx.fillRect(a.left, ty, a.w, a.tubeH);
      ctx.strokeStyle = "rgba(120,150,200,0.45)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(a.left, ty, a.w, a.tubeH);
    }

    // Direction arrows
    ctx.font = `${Math.max(10, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillStyle = "#ef4444aa";
    ctx.textAlign = "right";
    ctx.fillText(`Hot ${hotDir}`, a.right + 1, topY + a.tubeH / 2 + 4);
    ctx.fillStyle = "#3b82f6aa";
    ctx.fillText(`Cold ${coldDir}`, a.right + 1, botY + a.tubeH / 2 + 4);

    // Draw heat transfer arrows between tubes
    const arrowCount = 8;
    for (let i = 0; i < arrowCount; i++) {
      const frac = (i + 0.5) / arrowCount;
      const seg = Math.min(SEGMENTS - 1, Math.floor(frac * SEGMENTS));
      const dT = hotTemps[seg] - coldTemps[seg];
      if (dT <= 0) continue;
      const alpha = Math.min(0.7, dT / (hotTemp - coldTemp + 0.001));
      const ax = a.left + frac * a.w;
      const ay1 = topY + a.tubeH + 2;
      const ay2 = botY - 2;

      ctx.beginPath();
      ctx.moveTo(ax, ay1);
      ctx.lineTo(ax, ay2);
      ctx.strokeStyle = `rgba(255,180,50,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(ax - 3, ay2 - 5);
      ctx.lineTo(ax, ay2);
      ctx.lineTo(ax + 3, ay2 - 5);
      ctx.strokeStyle = `rgba(255,180,50,${alpha})`;
      ctx.stroke();
    }

    // Draw particles
    for (const p of hotParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = tempColor(p.temp);
      ctx.fill();
    }
    for (const p of coldParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = tempColor(p.temp);
      ctx.fill();
    }
  }

  function drawGraph() {
    const a = tubeArea();
    const gTop = height * 0.54;
    const gH = height * 0.38;
    const gLeft = a.left;
    const gW = a.w;

    // Background
    ctx.fillStyle = "rgba(10,15,30,0.5)";
    ctx.fillRect(gLeft, gTop, gW, gH);
    ctx.strokeStyle = "rgba(120,150,200,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(gLeft, gTop, gW, gH);

    // Axis labels
    ctx.font = `${Math.max(10, width * 0.014)}px system-ui, sans-serif`;
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Temperature Profile Along Tube Length", gLeft + gW / 2, gTop - 5);
    ctx.textAlign = "left";
    ctx.fillText(`${hotTemp}\u00b0C`, gLeft - 2, gTop + 12);
    ctx.fillText(`${coldTemp}\u00b0C`, gLeft - 2, gTop + gH - 2);

    const tRange = hotTemp - coldTemp || 1;
    const yFor = (t: number) => gTop + gH - ((t - coldTemp) / tRange) * gH;

    // Helper to draw a profile line
    const drawLine = (temps: number[], color: string, dashed: boolean) => {
      ctx.beginPath();
      if (dashed) ctx.setLineDash([5, 4]);
      for (let i = 0; i < SEGMENTS; i++) {
        const x = gLeft + (i / (SEGMENTS - 1)) * gW;
        const y = yFor(temps[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Countercurrent lines (solid)
    drawLine(counterHot, "#ef4444", false);
    drawLine(counterCold, "#3b82f6", false);

    // Concurrent lines (dashed)
    drawLine(concurrentHot, "#f97316", true);
    drawLine(concurrentCold, "#38bdf8", true);

    // Legend
    const legY = gTop + gH + 14;
    ctx.font = `${Math.max(9, width * 0.013)}px system-ui, sans-serif`;
    const items = [
      { label: "Counter Hot", color: "#ef4444", dash: false },
      { label: "Counter Cold", color: "#3b82f6", dash: false },
      { label: "Concurrent Hot", color: "#f97316", dash: true },
      { label: "Concurrent Cold", color: "#38bdf8", dash: true },
    ];
    let lx = gLeft;
    for (const it of items) {
      ctx.beginPath();
      if (it.dash) ctx.setLineDash([4, 3]);
      ctx.moveTo(lx, legY);
      ctx.lineTo(lx + 18, legY);
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "left";
      ctx.fillText(it.label, lx + 22, legY + 4);
      lx += ctx.measureText(it.label).width + 36;
    }

    // Efficiency annotation
    const counterOutHot = counterHot[SEGMENTS - 1];
    const counterOutCold = counterCold[0];
    const concOutHot = concurrentHot[SEGMENTS - 1];
    const concOutCold = concurrentCold[SEGMENTS - 1];
    const counterQ = hotTemp - counterOutHot;
    const concQ = hotTemp - concOutHot;

    ctx.font = `${Math.max(10, width * 0.014)}px system-ui, sans-serif`;
    ctx.fillStyle = "#a7f3d0";
    ctx.textAlign = "right";
    ctx.fillText(
      `Counter Q = ${counterQ.toFixed(1)}\u00b0  |  Concurrent Q = ${concQ.toFixed(1)}\u00b0`,
      gLeft + gW,
      legY + 4,
    );
  }

  function render(): void {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    const a = tubeArea();

    // Countercurrent section
    drawTube(
      "Countercurrent Flow (opposite directions)",
      a.counterTopY,
      counterHotP,
      counterColdP,
      counterHot,
      counterCold,
      "\u2192",
      "\u2190",
    );

    // Concurrent section
    drawTube(
      "Concurrent Flow (same direction)",
      a.concurrentTopY,
      concurrentHotP,
      concurrentColdP,
      concurrentHot,
      concurrentCold,
      "\u2192",
      "\u2192",
    );

    // Temperature profile graph
    drawGraph();

    // Title
    ctx.save();
    ctx.font = `bold ${Math.max(13, width * 0.022)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(220,230,250,0.55)";
    ctx.textAlign = "center";
    ctx.fillText("Countercurrent Exchange", width / 2, height - 6);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    solveProfiles();
    spawnParticles();
  }

  function destroy(): void {
    counterHotP = [];
    counterColdP = [];
    concurrentHotP = [];
    concurrentColdP = [];
  }

  function getStateDescription(): string {
    const cOutH = counterHot[SEGMENTS - 1]?.toFixed(1) ?? "?";
    const cOutC = counterCold[0]?.toFixed(1) ?? "?";
    const pOutH = concurrentHot[SEGMENTS - 1]?.toFixed(1) ?? "?";
    const pOutC = concurrentCold[SEGMENTS - 1]?.toFixed(1) ?? "?";
    return (
      `Countercurrent Exchange: hot inlet ${hotTemp}\u00b0C, cold inlet ${coldTemp}\u00b0C. ` +
      `Flow rate ${flowRate}, exchange rate ${exchangeRate}. ` +
      `Counter: hot outlet ${cOutH}\u00b0C, cold outlet ${cOutC}\u00b0C. ` +
      `Concurrent: hot outlet ${pOutH}\u00b0C, cold outlet ${pOutC}\u00b0C. ` +
      `Countercurrent maintains gradient along full length, transferring more heat.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    spawnParticles();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default CountercurrentExchangeFactory;
