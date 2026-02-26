import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ThreePhaseEquilibriumFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("three-phase-equilibrium") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let temperature = 300;
  let pressure = 1000;
  let substance = 0; // 0 = water, 1 = CO2

  // Substance data: [tripleT, tripleP, criticalT, criticalP, name]
  const substances = [
    { name: "Water (H₂O)", tripleT: 273.16, tripleP: 611.73, critT: 647.1, critP: 22064000, meltSlope: -7e6 },
    { name: "CO₂", tripleT: 216.55, tripleP: 518000, critT: 304.13, critP: 7380000, meltSlope: 4e6 },
  ];

  interface Molecule {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseX: number;
    baseY: number;
  }

  let molecules: Molecule[] = [];

  function getPhase(T: number, P: number, sub: typeof substances[0]): string {
    if (T >= sub.critT && P >= sub.critP) return "supercritical";
    // Clausius-Clapeyron approximation for liquid-gas boundary
    const Lv = sub.name.includes("Water") ? 2260000 : 234000;
    const R = 8.314;
    const M = sub.name.includes("Water") ? 0.018 : 0.044;
    const pSat = sub.tripleP * Math.exp((Lv * M / R) * (1 / sub.tripleT - 1 / T));
    // Melting line: roughly linear from triple point
    const pMelt = sub.tripleP + sub.meltSlope * (T - sub.tripleT);
    if (T < sub.tripleT) {
      return P > pSat ? "solid" : "gas";
    }
    if (P > pMelt && P > pSat) return T < sub.critT ? "solid" : "liquid";
    if (P > pSat) return "liquid";
    return "gas";
  }

  function initMolecules(): void {
    molecules = [];
    const molArea = { x: width * 0.62, y: height * 0.35, w: width * 0.34, h: height * 0.35 };
    for (let i = 0; i < 40; i++) {
      const bx = molArea.x + Math.random() * molArea.w;
      const by = molArea.y + Math.random() * molArea.h;
      molecules.push({ x: bx, y: by, vx: 0, vy: 0, baseX: bx, baseY: by });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    initMolecules();
  }

  function update(dt: number, params: Record<string, number>): void {
    temperature = params.temperature ?? 300;
    pressure = params.pressure ?? 1000;
    substance = params.substance ?? 0;
    time += dt;

    const sub = substances[substance];
    const phase = getPhase(temperature, pressure, sub);

    const molArea = { x: width * 0.62, y: height * 0.35, w: width * 0.34, h: height * 0.35 };

    for (const mol of molecules) {
      if (phase === "solid") {
        // Vibrate around lattice position
        mol.x = mol.baseX + Math.sin(time * 8 + mol.baseX) * 2;
        mol.y = mol.baseY + Math.cos(time * 8 + mol.baseY) * 2;
      } else if (phase === "liquid") {
        mol.vx += (Math.random() - 0.5) * 60 * dt;
        mol.vy += (Math.random() - 0.5) * 60 * dt;
        mol.vx *= 0.95;
        mol.vy *= 0.95;
        mol.x += mol.vx * dt;
        mol.y += mol.vy * dt;
        // Contain in bottom portion
        if (mol.x < molArea.x) { mol.x = molArea.x; mol.vx *= -0.5; }
        if (mol.x > molArea.x + molArea.w) { mol.x = molArea.x + molArea.w; mol.vx *= -0.5; }
        if (mol.y < molArea.y + molArea.h * 0.4) { mol.y = molArea.y + molArea.h * 0.4; mol.vy *= -0.5; }
        if (mol.y > molArea.y + molArea.h) { mol.y = molArea.y + molArea.h; mol.vy *= -0.5; }
      } else {
        // Gas - fast random motion
        mol.vx += (Math.random() - 0.5) * 200 * dt;
        mol.vy += (Math.random() - 0.5) * 200 * dt;
        mol.vx *= 0.98;
        mol.vy *= 0.98;
        mol.x += mol.vx * dt;
        mol.y += mol.vy * dt;
        if (mol.x < molArea.x) { mol.x = molArea.x; mol.vx *= -1; }
        if (mol.x > molArea.x + molArea.w) { mol.x = molArea.x + molArea.w; mol.vx *= -1; }
        if (mol.y < molArea.y) { mol.y = molArea.y; mol.vy *= -1; }
        if (mol.y > molArea.y + molArea.h) { mol.y = molArea.y + molArea.h; mol.vy *= -1; }
      }
    }
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(0.5, "#1e1b4b");
    bgGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const sub = substances[substance];
    const phase = getPhase(temperature, pressure, sub);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Three Phase Equilibrium", width / 2, 24);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(sub.name, width / 2, 42);

    // === Phase Diagram (left side) ===
    const pdX = width * 0.04;
    const pdY = 55;
    const pdW = width * 0.52;
    const pdH = height - 100;

    // Diagram background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(pdX - 5, pdY - 5, pdW + 10, pdH + 10, 8);
    ctx.fill();

    // Axes
    const axL = pdX + 40;
    const axB = pdY + pdH - 30;
    const axR = pdX + pdW - 10;
    const axT = pdY + 10;
    const plotW = axR - axL;
    const plotH = axB - axT;

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axL, axT);
    ctx.lineTo(axL, axB);
    ctx.lineTo(axR, axB);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Temperature (K)", axL + plotW / 2, axB + 22);
    ctx.save();
    ctx.translate(axL - 28, axT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Pressure (Pa)", 0, 0);
    ctx.restore();

    // Map T,P to pixel coordinates (log scale for P)
    const Tmin = 150, Tmax = 750;
    const logPmin = Math.log10(100), logPmax = Math.log10(1e8);
    const tToX = (T: number) => axL + ((T - Tmin) / (Tmax - Tmin)) * plotW;
    const pToY = (P: number) => axB - ((Math.log10(Math.max(P, 1)) - logPmin) / (logPmax - logPmin)) * plotH;

    // Color regions
    // Solid region (blue)
    ctx.fillStyle = "rgba(59,130,246,0.15)";
    ctx.beginPath();
    ctx.moveTo(axL, axT);
    ctx.lineTo(tToX(sub.tripleT), pToY(sub.tripleP));
    ctx.lineTo(axL, pToY(sub.tripleP));
    ctx.lineTo(axL, axT);
    ctx.fill();
    // extend solid above melting line
    ctx.fillStyle = "rgba(59,130,246,0.15)";
    ctx.beginPath();
    ctx.moveTo(axL, axT);
    ctx.lineTo(tToX(sub.tripleT), pToY(sub.tripleP));
    for (let T = sub.tripleT; T <= sub.critT; T += 5) {
      const pM = sub.tripleP + sub.meltSlope * (T - sub.tripleT);
      if (pM > 0) ctx.lineTo(tToX(T), pToY(pM));
    }
    ctx.lineTo(axL, axT);
    ctx.fill();

    // Liquid region (green)
    ctx.fillStyle = "rgba(34,197,94,0.15)";
    ctx.beginPath();
    ctx.moveTo(tToX(sub.tripleT), pToY(sub.tripleP));
    for (let T = sub.tripleT; T <= sub.critT; T += 5) {
      const pM = sub.tripleP + sub.meltSlope * (T - sub.tripleT);
      if (pM > 0) ctx.lineTo(tToX(T), pToY(pM));
    }
    ctx.lineTo(tToX(sub.critT), pToY(sub.critP));
    // Back along vaporization curve
    const Lv = sub.name.includes("Water") ? 2260000 : 234000;
    const R = 8.314;
    const M = sub.name.includes("Water") ? 0.018 : 0.044;
    for (let T = sub.critT; T >= sub.tripleT; T -= 5) {
      const pSat = sub.tripleP * Math.exp((Lv * M / R) * (1 / sub.tripleT - 1 / T));
      ctx.lineTo(tToX(T), pToY(pSat));
    }
    ctx.closePath();
    ctx.fill();

    // Gas region (red/orange)
    ctx.fillStyle = "rgba(249,115,22,0.1)";
    ctx.beginPath();
    ctx.moveTo(axL, axB);
    ctx.lineTo(axL, pToY(sub.tripleP));
    ctx.lineTo(tToX(sub.tripleT), pToY(sub.tripleP));
    for (let T = sub.tripleT; T <= sub.critT; T += 5) {
      const pSat = sub.tripleP * Math.exp((Lv * M / R) * (1 / sub.tripleT - 1 / T));
      ctx.lineTo(tToX(T), pToY(pSat));
    }
    ctx.lineTo(tToX(sub.critT), pToY(sub.critP));
    ctx.lineTo(axR, axB);
    ctx.closePath();
    ctx.fill();

    // Draw phase boundary curves
    // Sublimation curve (solid-gas)
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let T = Tmin; T <= sub.tripleT; T += 2) {
      const pSub = sub.tripleP * Math.exp((Lv * M / R) * (1 / sub.tripleT - 1 / T));
      const px = tToX(T);
      const py = pToY(pSub);
      if (T === Tmin) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Vaporization curve (liquid-gas)
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let T = sub.tripleT; T <= sub.critT; T += 2) {
      const pSat = sub.tripleP * Math.exp((Lv * M / R) * (1 / sub.tripleT - 1 / T));
      const px = tToX(T);
      const py = pToY(pSat);
      if (T === sub.tripleT) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Melting curve (solid-liquid)
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let T = sub.tripleT; T <= Tmax; T += 2) {
      const pM = sub.tripleP + sub.meltSlope * (T - sub.tripleT);
      if (pM < 100 || pM > 1e8) continue;
      const px = tToX(T);
      const py = pToY(pM);
      if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Triple point marker
    const tpX = tToX(sub.tripleT), tpY = pToY(sub.tripleP);
    ctx.beginPath(); ctx.arc(tpX, tpY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#facc15"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#facc15"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Triple Point (${sub.tripleT} K, ${sub.tripleP.toFixed(0)} Pa)`, tpX + 10, tpY + 3);

    // Critical point marker
    const cpX = tToX(sub.critT), cpY = pToY(sub.critP);
    ctx.beginPath(); ctx.arc(cpX, cpY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#ef4444"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`Critical Point`, cpX - 10, cpY - 4);

    // Region labels
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(59,130,246,0.7)";
    ctx.fillText("SOLID", axL + plotW * 0.15, axT + plotH * 0.3);
    ctx.fillStyle = "rgba(34,197,94,0.7)";
    ctx.fillText("LIQUID", axL + plotW * 0.45, axT + plotH * 0.35);
    ctx.fillStyle = "rgba(249,115,22,0.6)";
    ctx.fillText("GAS", axL + plotW * 0.6, axT + plotH * 0.75);

    // Current state marker
    const curX = tToX(temperature), curY = pToY(pressure);
    ctx.beginPath(); ctx.arc(curX, curY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 2; ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.beginPath(); ctx.arc(curX, curY, 8 + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - pulse)})`; ctx.lineWidth = 1.5; ctx.stroke();

    // Axis tick labels
    ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "center";
    for (let T = 200; T <= 700; T += 100) ctx.fillText(`${T}`, tToX(T), axB + 12);
    ctx.textAlign = "right";
    for (let logP = 2; logP <= 8; logP++) {
      ctx.fillText(logP <= 3 ? `${Math.pow(10, logP)}` : `10^${logP}`, axL - 4, pToY(Math.pow(10, logP)) + 3);
    }

    // === Molecule visualization (right side) ===
    const molArea = { x: width * 0.62, y: height * 0.35, w: width * 0.34, h: height * 0.35 };
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(molArea.x, molArea.y, molArea.w, molArea.h);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Phase: ${phase.toUpperCase()}`, molArea.x + molArea.w / 2, molArea.y - 8);

    const molColor = phase === "solid" ? "#60a5fa" : phase === "liquid" ? "#34d399" : "#fb923c";
    for (const mol of molecules) {
      ctx.beginPath();
      ctx.arc(mol.x, mol.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = molColor;
      ctx.fill();
    }

    // === Info panel (right bottom) ===
    const infoX = width * 0.6;
    const infoY = height * 0.74;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(infoX, infoY, width * 0.38, height * 0.24, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Clausius-Clapeyron Equation", infoX + 10, infoY + 18);

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "12px monospace";
    ctx.fillText("dP/dT = L / (T × ΔV)", infoX + 10, infoY + 38);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`T = ${temperature} K`, infoX + 10, infoY + 58);
    ctx.fillText(`P = ${pressure} Pa`, infoX + 10, infoY + 74);
    ctx.fillText(`Phase: ${phase}`, infoX + 10, infoY + 90);
  }

  function reset(): void {
    time = 0;
    initMolecules();
  }

  function destroy(): void {
    molecules = [];
  }

  function getStateDescription(): string {
    const sub = substances[substance];
    const phase = getPhase(temperature, pressure, sub);
    return (
      `Three Phase Equilibrium (${sub.name}): T=${temperature} K, P=${pressure} Pa. ` +
      `Current phase: ${phase}. Triple point at ${sub.tripleT} K and ${sub.tripleP} Pa. ` +
      `Critical point at ${sub.critT} K and ${sub.critP} Pa. ` +
      `The Clausius-Clapeyron equation dP/dT = L/(T*ΔV) describes phase boundary slopes.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    initMolecules();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ThreePhaseEquilibriumFactory;
