import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Period of Pendulum: T = 2pi * sqrt(L/g)
 * Demonstrates that pendulum period depends on length and gravity,
 * NOT on mass or amplitude (for small angles).
 * Shows multiple pendulums side-by-side for comparison.
 */

interface Pendulum {
  length: number; // m
  mass: number; // kg
  angle: number; // rad (current)
  angularVel: number; // rad/s
  initialAngle: number; // rad
  color: string;
  label: string;
  period: number; // theoretical period
  measuredPeriod: number;
  lastCrossTime: number;
  crossCount: number;
}

const PeriodOfPendulumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("period-of-pendulum") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  const g = 9.81;
  let length1 = 1;
  let length2 = 2;
  let mass1 = 1;
  let mass2 = 3;

  let pendulums: Pendulum[] = [];
  let periodHistory: Array<{ length: number; period: number }> = [];

  function createPendulums(): void {
    const amplitude = 0.3; // ~17 degrees, small angle
    pendulums = [
      {
        length: length1, mass: mass1, angle: amplitude, angularVel: 0,
        initialAngle: amplitude, color: "#3b82f6", label: `L=${length1}m, m=${mass1}kg`,
        period: 2 * Math.PI * Math.sqrt(length1 / g), measuredPeriod: 0,
        lastCrossTime: -1, crossCount: 0,
      },
      {
        length: length2, mass: mass2, angle: amplitude, angularVel: 0,
        initialAngle: amplitude, color: "#ef4444", label: `L=${length2}m, m=${mass2}kg`,
        period: 2 * Math.PI * Math.sqrt(length2 / g), measuredPeriod: 0,
        lastCrossTime: -1, crossCount: 0,
      },
      {
        length: length1, mass: mass2, angle: amplitude, angularVel: 0,
        initialAngle: amplitude, color: "#10b981", label: `L=${length1}m, m=${mass2}kg`,
        period: 2 * Math.PI * Math.sqrt(length1 / g), measuredPeriod: 0,
        lastCrossTime: -1, crossCount: 0,
      },
      {
        length: length2, mass: mass1, angle: amplitude, angularVel: 0,
        initialAngle: amplitude, color: "#f59e0b", label: `L=${length2}m, m=${mass1}kg`,
        period: 2 * Math.PI * Math.sqrt(length2 / g), measuredPeriod: 0,
        lastCrossTime: -1, crossCount: 0,
      },
    ];

    // Build period vs length curve data
    periodHistory = [];
    for (let l = 0.5; l <= 3.0; l += 0.1) {
      periodHistory.push({ length: l, period: 2 * Math.PI * Math.sqrt(l / g) });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    createPendulums();
  }

  function update(dt: number, params: Record<string, number>): void {
    const newL1 = params.length1 ?? 1;
    const newL2 = params.length2 ?? 2;
    const newM1 = params.mass1 ?? 1;
    const newM2 = params.mass2 ?? 3;

    if (newL1 !== length1 || newL2 !== length2 || newM1 !== mass1 || newM2 !== mass2) {
      length1 = newL1;
      length2 = newL2;
      mass1 = newM1;
      mass2 = newM2;
      createPendulums();
      time = 0;
    }

    const step = Math.min(dt, 0.016);
    time += step;

    for (const p of pendulums) {
      // Exact pendulum equation: d2theta/dt2 = -(g/L)*sin(theta)
      const angularAccel = -(g / p.length) * Math.sin(p.angle);
      const prevAngle = p.angle;
      p.angularVel += angularAccel * step;
      p.angle += p.angularVel * step;

      // Detect zero-crossing (positive direction) to measure period
      if (prevAngle < 0 && p.angle >= 0 && p.angularVel > 0) {
        if (p.lastCrossTime > 0) {
          p.measuredPeriod = time - p.lastCrossTime;
          p.crossCount++;
        }
        p.lastCrossTime = time;
      }
    }
  }

  function drawPendulum(p: Pendulum, pivotX: number, pivotY: number, scale: number): void {
    const rodLen = p.length * scale;
    const bobX = pivotX + rodLen * Math.sin(p.angle);
    const bobY = pivotY + rodLen * Math.cos(p.angle);
    const bobRadius = Math.max(8, 5 + p.mass * 3);

    // Rod
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.strokeStyle = "rgba(148,163,184,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bob shadow
    ctx.beginPath();
    ctx.arc(bobX + 2, bobY + 2, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    // Bob
    const grad = ctx.createRadialGradient(bobX - 3, bobY - 3, 1, bobX, bobY, bobRadius);
    grad.addColorStop(0, p.color);
    grad.addColorStop(1, p.color.replace(")", ",0.6)").replace("rgb", "rgba"));
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pivot point
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#64748b";
    ctx.fill();
  }

  function drawPeriodGraph(): void {
    const gx = width * 0.58;
    const gy = height * 0.08;
    const gw = width * 0.38;
    const gh = height * 0.40;

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Period vs Length  (T = 2\u03c0\u221a(L/g))", gx + gw / 2, gy + 20);

    const plotX = gx + 50;
    const plotY = gy + 35;
    const plotW = gw - 70;
    const plotH = gh - 60;

    // Axes
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Length (m)", plotX + plotW / 2, plotY + plotH + 20);
    ctx.save();
    ctx.translate(plotX - 30, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Period (s)", 0, 0);
    ctx.restore();

    // Scale
    const maxL = 3.0;
    const maxT = 2 * Math.PI * Math.sqrt(maxL / g) * 1.15;

    // Grid lines and tick labels
    ctx.strokeStyle = "rgba(100,116,139,0.2)";
    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    for (let t = 0; t <= maxT; t += 0.5) {
      const y = plotY + plotH - (t / maxT) * plotH;
      ctx.beginPath(); ctx.moveTo(plotX, y); ctx.lineTo(plotX + plotW, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.fillText(t.toFixed(1), plotX - 5, y + 3);
    }
    for (let l = 0.5; l <= maxL; l += 0.5) {
      const x = plotX + (l / maxL) * plotW;
      ctx.beginPath(); ctx.moveTo(x, plotY); ctx.lineTo(x, plotY + plotH); ctx.stroke();
      ctx.textAlign = "center"; ctx.fillText(l.toFixed(1), x, plotY + plotH + 12);
    }

    // Theoretical curve
    ctx.beginPath();
    ctx.strokeStyle = "rgba(168,85,247,0.8)";
    ctx.lineWidth = 2;
    for (let i = 0; i < periodHistory.length; i++) {
      const px = plotX + (periodHistory[i].length / maxL) * plotW;
      const py = plotY + plotH - (periodHistory[i].period / maxT) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Plot actual pendulums on graph
    for (const p of pendulums) {
      const px = plotX + (p.length / maxL) * plotW;
      const py = plotY + plotH - (p.period / maxT) * plotH;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawInfoPanel(): void {
    const px = width * 0.58;
    const py = height * 0.52;
    const pw = width * 0.38;
    const ph = height * 0.44;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Pendulum Comparison", px + 15, py + 22);

    let yOff = py + 45;
    const lineH = 16;

    for (let i = 0; i < pendulums.length; i++) {
      const p = pendulums[i];
      // Color dot
      ctx.beginPath();
      ctx.arc(px + 20, yOff - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(p.label, px + 32, yOff);
      yOff += lineH;

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(`  Theory T = ${p.period.toFixed(3)} s  |  f = ${(1 / p.period).toFixed(3)} Hz`, px + 32, yOff);
      yOff += lineH;

      if (p.measuredPeriod > 0) {
        ctx.fillText(`  Measured T = ${p.measuredPeriod.toFixed(3)} s`, px + 32, yOff);
      } else {
        ctx.fillText(`  Measuring...`, px + 32, yOff);
      }
      yOff += lineH + 6;
    }

    // Key insight box
    yOff += 4;
    ctx.fillStyle = "rgba(16,185,129,0.15)";
    ctx.beginPath();
    ctx.roundRect(px + 10, yOff, pw - 20, 48, 6);
    ctx.fill();

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Key Insight:", px + 20, yOff + 16);
    ctx.fillStyle = "#a7f3d0";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Pendulums 1 & 3 have SAME period (same L),", px + 20, yOff + 30);
    ctx.fillText("despite different masses. T depends only on L and g!", px + 20, yOff + 43);
  }

  function render(): void {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.026)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Period of a Pendulum", width * 0.28, 28);

    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.font = `${Math.max(11, width * 0.016)}px system-ui, sans-serif`;
    ctx.fillText("T = 2\u03c0\u221a(L/g)  \u2014  Period depends on length, NOT mass", width * 0.28, 48);

    // Draw support beam
    const beamY = height * 0.12;
    const beamLeft = width * 0.03;
    const beamRight = width * 0.53;
    ctx.fillStyle = "#475569";
    ctx.fillRect(beamLeft, beamY - 4, beamRight - beamLeft, 8);
    ctx.fillStyle = "#334155";
    ctx.fillRect(beamLeft, beamY + 4, beamRight - beamLeft, 3);

    // Draw each pendulum
    const spacing = (beamRight - beamLeft) / (pendulums.length + 1);
    const scale = Math.min(height * 0.25, 120); // pixels per meter

    for (let i = 0; i < pendulums.length; i++) {
      const pivotX = beamLeft + spacing * (i + 1);
      drawPendulum(pendulums[i], pivotX, beamY, scale);

      // Label below
      ctx.fillStyle = pendulums[i].color;
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`#${i + 1}`, pivotX, height * 0.92);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`L=${pendulums[i].length}m`, pivotX, height * 0.95);
      ctx.fillText(`m=${pendulums[i].mass}kg`, pivotX, height * 0.98);
    }

    drawPeriodGraph();
    drawInfoPanel();

    // Time
    ctx.fillStyle = "rgba(148,163,184,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(2)} s`, 12, height - 10);
  }

  function reset(): void {
    time = 0;
    createPendulums();
  }

  function destroy(): void {
    pendulums = [];
    periodHistory = [];
  }

  function getStateDescription(): string {
    const p1 = pendulums[0];
    const p2 = pendulums[1];
    const p3 = pendulums[2];
    return (
      `Period of Pendulum: Comparing 4 pendulums. ` +
      `#1 (L=${p1?.length}m, m=${p1?.mass}kg): T=${p1?.period.toFixed(3)}s. ` +
      `#2 (L=${p2?.length}m, m=${p2?.mass}kg): T=${p2?.period.toFixed(3)}s. ` +
      `#3 (L=${p3?.length}m, m=${p3?.mass}kg): T=${p3?.period.toFixed(3)}s. ` +
      `Key: #1 and #3 have same length => same period, despite different masses. ` +
      `T = 2pi*sqrt(L/g). Period is independent of mass and amplitude (small angles).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PeriodOfPendulumFactory;
