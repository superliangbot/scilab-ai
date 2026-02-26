import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const SpringsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("springs") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let k1 = 50;
  let k2 = 80;
  let mass = 2;
  let configMode = 0; // 0=series, 1=parallel

  const g = 9.81;
  let bobY = 0;
  let bobVy = 0;
  let equilibriumY = 0;
  let naturalLength = 80;

  function calcEffectiveK(): number {
    if (configMode === 0) {
      // Series: 1/k_eff = 1/k1 + 1/k2
      return (k1 * k2) / (k1 + k2);
    } else {
      // Parallel: k_eff = k1 + k2
      return k1 + k2;
    }
  }

  function calcExtension(): number {
    const kEff = calcEffectiveK();
    return (mass * g) / kEff;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    naturalLength = height * 0.2;
    resetBob();
  }

  function resetBob(): void {
    const ext = calcExtension();
    const scale = 150; // visual scale for extension
    if (configMode === 0) {
      equilibriumY = 100 + naturalLength * 2 + ext * scale;
    } else {
      equilibriumY = 100 + naturalLength + ext * scale;
    }
    bobY = equilibriumY - 20; // slight offset for oscillation
    bobVy = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    const newK1 = params.springConstant1 ?? 50;
    const newK2 = params.springConstant2 ?? 80;
    const newMass = params.mass ?? 2;
    const newConfig = Math.round(params.configuration ?? 0);

    if (newK1 !== k1 || newK2 !== k2 || newMass !== mass || newConfig !== configMode) {
      k1 = newK1;
      k2 = newK2;
      mass = newMass;
      configMode = newConfig;
      resetBob();
    }

    time += step;

    // Simulate oscillation around equilibrium
    const kEff = calcEffectiveK();
    const displacement = bobY - equilibriumY;
    const springForce = -kEff * displacement * 0.01; // scaled
    const dampForce = -0.5 * bobVy;
    const acc = (springForce + dampForce);
    bobVy += acc * step;
    bobY += bobVy * step;
  }

  function drawZigzagSpring(x: number, y1: number, y2: number, coils: number, label: string, kVal: number): void {
    const len = y2 - y1;
    const segH = len / (coils * 2 + 2);
    const springW = 16;

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y1 + segH);
    for (let i = 0; i < coils * 2; i++) {
      const yy = y1 + segH + segH * (i + 1);
      const xOff = (i % 2 === 0 ? 1 : -1) * springW;
      ctx.lineTo(x + xOff, yy);
    }
    ctx.lineTo(x, y2 - segH);
    ctx.lineTo(x, y2);
    ctx.stroke();

    // Label
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${label}: k=${kVal} N/m`, x + 24, (y1 + y2) / 2 + 4);
    ctx.restore();
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const topY = 60;

    // Ceiling
    ctx.fillStyle = "rgba(100,120,140,0.8)";
    ctx.fillRect(cx - 120, topY - 10, 240, 12);
    // Hatch marks on ceiling
    ctx.strokeStyle = "rgba(80,100,120,0.6)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const hx = cx - 110 + i * 20;
      ctx.beginPath();
      ctx.moveTo(hx, topY - 10);
      ctx.lineTo(hx - 6, topY - 18);
      ctx.stroke();
    }

    const kEff = calcEffectiveK();
    const ext = calcExtension();
    const force = mass * g;
    const scale = 150;

    if (configMode === 0) {
      // SERIES configuration: springs end-to-end
      const ext1 = force / k1;
      const ext2 = force / k2;
      const springLen1 = naturalLength + ext1 * scale;
      const springLen2 = naturalLength + ext2 * scale;

      const midY = topY + springLen1;
      const endY = midY + springLen2;

      // Spring 1
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      drawZigzagSpring(cx, topY, midY, 6, "Spring 1", k1);

      // Connection point
      ctx.beginPath();
      ctx.arc(cx, midY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#64748b";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Spring 2
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      drawZigzagSpring(cx, midY, endY, 6, "Spring 2", k2);

      // Mass bob
      const bobDrawY = endY + (bobY - equilibriumY);
      const grad = ctx.createRadialGradient(cx - 5, bobDrawY - 5, 0, cx, bobDrawY, 25);
      grad.addColorStop(0, "#f8fafc");
      grad.addColorStop(0.5, "#94a3b8");
      grad.addColorStop(1, "#475569");
      ctx.beginPath();
      ctx.arc(cx, bobDrawY, 25, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Mass label
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${mass} kg`, cx, bobDrawY + 4);

      // Extension lines
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(59,130,246,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 50, topY);
      ctx.lineTo(cx + 50, midY);
      ctx.stroke();
      ctx.fillStyle = "rgba(59,130,246,0.8)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`x1=${ext1.toFixed(3)}m`, cx + 55, (topY + midY) / 2);

      ctx.strokeStyle = "rgba(239,68,68,0.4)";
      ctx.beginPath();
      ctx.moveTo(cx + 50, midY);
      ctx.lineTo(cx + 50, endY);
      ctx.stroke();
      ctx.fillStyle = "rgba(239,68,68,0.8)";
      ctx.fillText(`x2=${ext2.toFixed(3)}m`, cx + 55, (midY + endY) / 2);
      ctx.setLineDash([]);
      ctx.restore();

      // Mode label
      ctx.fillStyle = "#3b82f6";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SERIES Configuration", cx, topY - 20);

    } else {
      // PARALLEL configuration: springs side by side
      const extP = ext;
      const springLen = naturalLength + extP * scale;
      const endY = topY + springLen;
      const spacing = 60;

      // Spring 1 (left)
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      drawZigzagSpring(cx - spacing, topY, endY, 6, "S1", k1);

      // Spring 2 (right)
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      drawZigzagSpring(cx + spacing, topY, endY, 6, "S2", k2);

      // Bar connecting bottoms
      ctx.strokeStyle = "rgba(148,163,184,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - spacing, endY);
      ctx.lineTo(cx + spacing, endY);
      ctx.stroke();

      // Mass bob
      const bobDrawY = endY + 30 + (bobY - equilibriumY);
      const grad = ctx.createRadialGradient(cx - 5, bobDrawY - 5, 0, cx, bobDrawY, 25);
      grad.addColorStop(0, "#f8fafc");
      grad.addColorStop(0.5, "#94a3b8");
      grad.addColorStop(1, "#475569");
      ctx.beginPath();
      ctx.arc(cx, bobDrawY, 25, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Connecting line from bar to mass
      ctx.strokeStyle = "rgba(148,163,184,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, endY);
      ctx.lineTo(cx, bobDrawY - 25);
      ctx.stroke();

      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${mass} kg`, cx, bobDrawY + 4);

      // Mode label
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PARALLEL Configuration", cx, topY - 20);
    }

    // Info panel
    ctx.save();
    const panelW = 280;
    const panelH = 105;
    const panelX = 10;
    const panelY = height - panelH - 10;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Hooke's Law: F = kx", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const modeStr = configMode === 0 ? "Series: 1/k_eff = 1/k1 + 1/k2" : "Parallel: k_eff = k1 + k2";
    ctx.fillText(modeStr, panelX + 10, panelY + 36);
    ctx.fillText(`k1 = ${k1} N/m   k2 = ${k2} N/m`, panelX + 10, panelY + 54);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`k_eff = ${kEff.toFixed(1)} N/m`, panelX + 10, panelY + 72);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(`Extension: ${ext.toFixed(4)} m   Force: ${force.toFixed(1)} N`, panelX + 10, panelY + 90);
    ctx.restore();

    // Force arrow
    ctx.save();
    const arrowX = width - 60;
    const arrowTopY = height / 2 - 40;
    const arrowLen = Math.min(force * 3, 120);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowTopY);
    ctx.lineTo(arrowX, arrowTopY + arrowLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowTopY + arrowLen);
    ctx.lineTo(arrowX - 6, arrowTopY + arrowLen - 10);
    ctx.lineTo(arrowX + 6, arrowTopY + arrowLen - 10);
    ctx.closePath();
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.fillStyle = "rgba(245,158,11,0.9)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F = mg", arrowX, arrowTopY - 8);
    ctx.fillText(`${force.toFixed(1)} N`, arrowX, arrowTopY + arrowLen + 16);
    ctx.restore();
  }

  function reset(): void {
    time = 0;
    resetBob();
  }

  function destroy(): void {
    // cleanup
  }

  function getStateDescription(): string {
    const kEff = calcEffectiveK();
    const ext = calcExtension();
    const mode = configMode === 0 ? "series" : "parallel";
    return (
      `Springs (${mode}): k1=${k1} N/m, k2=${k2} N/m, mass=${mass} kg. ` +
      `k_eff=${kEff.toFixed(1)} N/m, extension=${ext.toFixed(4)} m, ` +
      `force=${(mass * g).toFixed(1)} N. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    naturalLength = height * 0.2;
    resetBob();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default SpringsFactory;
