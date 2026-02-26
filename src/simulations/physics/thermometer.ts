import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ThermometerFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("thermometer") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800, height = 600, time = 0;
  let temperature = 20, showAllScales = 1, showMolecules = 1;
  let displayTemp = 20;

  interface Molecule { x: number; y: number; vx: number; vy: number; radius: number; }
  let molecules: Molecule[] = [];

  function toF(c: number): number { return c * 9 / 5 + 32; }
  function toK(c: number): number { return c + 273.15; }

  function initMolecules(): void {
    molecules = [];
    for (let i = 0; i < 30; i++) {
      molecules.push({ x: 0, y: 0, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, radius: 2 + Math.random() * 2 });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!;
    width = canvas.width; height = canvas.height; time = 0; displayTemp = temperature;
    initMolecules();
  }

  function update(dt: number, params: Record<string, number>): void {
    temperature = params.temperature ?? 20;
    showAllScales = params.showAllScales ?? 1;
    showMolecules = params.showMolecules ?? 1;
    time += dt;
    displayTemp += (temperature - displayTemp) * Math.min(1, dt * 4);

    if (showMolecules) {
      const speed = 0.5 + Math.max(0, (displayTemp + 40)) / 40;
      for (const mol of molecules) {
        mol.vx += (Math.random() - 0.5) * speed * dt * 10;
        mol.vy += (Math.random() - 0.5) * speed * dt * 10;
        const v = Math.sqrt(mol.vx * mol.vx + mol.vy * mol.vy);
        if (v > speed * 3) { mol.vx = (mol.vx / v) * speed * 3; mol.vy = (mol.vy / v) * speed * 3; }
        mol.x += mol.vx * dt * 30; mol.y += mol.vy * dt * 30;
      }
    }
  }

  function drawThermometer(): void {
    const tx = width * 0.22, tubeTop = height * 0.08, tubeBot = height * 0.72;
    const tubeW = 22, bulbR = 28, bulbCY = tubeBot + bulbR * 0.4, tubeH = tubeBot - tubeTop;

    const glassGrad = ctx.createLinearGradient(tx - tubeW, 0, tx + tubeW, 0);
    glassGrad.addColorStop(0, "rgba(148,163,184,0.15)"); glassGrad.addColorStop(0.3, "rgba(226,232,240,0.25)");
    glassGrad.addColorStop(0.7, "rgba(226,232,240,0.1)"); glassGrad.addColorStop(1, "rgba(148,163,184,0.15)");

    ctx.fillStyle = glassGrad; ctx.beginPath(); ctx.roundRect(tx - tubeW / 2, tubeTop, tubeW, tubeH, tubeW / 2); ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, bulbCY, bulbR, 0, Math.PI * 2); ctx.fillStyle = glassGrad; ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.4)"; ctx.stroke();

    const frac = Math.max(0, Math.min(1, (displayTemp - (-40)) / 160));
    const liquidTop = tubeBot - frac * tubeH * 0.92;

    const bulbGrad = ctx.createRadialGradient(tx - 3, bulbCY - 3, 0, tx, bulbCY, bulbR - 4);
    bulbGrad.addColorStop(0, "#f87171"); bulbGrad.addColorStop(1, "#dc2626");
    ctx.beginPath(); ctx.arc(tx, bulbCY, bulbR - 4, 0, Math.PI * 2); ctx.fillStyle = bulbGrad; ctx.fill();

    const tubeGrad = ctx.createLinearGradient(tx - 5, 0, tx + 5, 0);
    tubeGrad.addColorStop(0, "#ef4444"); tubeGrad.addColorStop(0.5, "#f87171"); tubeGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = tubeGrad; ctx.beginPath(); ctx.roundRect(tx - 5, liquidTop, 10, tubeBot - liquidTop + 8, 5); ctx.fill();

    if (showMolecules) {
      for (const mol of molecules) {
        const dist = Math.sqrt(mol.x * mol.x + mol.y * mol.y);
        if (dist > bulbR - 8) { mol.x *= 0.9 * (bulbR - 8) / dist; mol.y *= 0.9 * (bulbR - 8) / dist; mol.vx *= -0.8; mol.vy *= -0.8; }
        const speed = Math.sqrt(mol.vx * mol.vx + mol.vy * mol.vy);
        ctx.beginPath(); ctx.arc(tx + mol.x, bulbCY + mol.y, mol.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, 0.4 + speed * 0.15)})`; ctx.fill();
      }
    }

    const scaleX = tx + tubeW / 2 + 8;
    ctx.textAlign = "left"; ctx.font = "9px system-ui, sans-serif";
    const markTemps = [-40, -20, 0, 20, 37, 40, 60, 80, 100, 120];
    const labels: Record<number, string> = { 0: "Water freezes", 37: "Body temp", 100: "Water boils" };
    for (const t of markTemps) {
      const f = (t + 40) / 160, my = tubeBot - f * tubeH * 0.92;
      if (my < tubeTop || my > tubeBot) continue;
      ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx + tubeW / 2 - 2, my); ctx.lineTo(scaleX + 4, my); ctx.stroke();
      ctx.fillStyle = "#e2e8f0"; ctx.fillText(`${t} C`, scaleX + 6, my + 3);
      if (labels[t]) { ctx.fillStyle = "#fbbf24"; ctx.font = "bold 8px system-ui, sans-serif"; ctx.fillText(labels[t], scaleX + 40, my + 3); ctx.font = "9px system-ui, sans-serif"; }
    }

    const currentY = tubeBot - frac * tubeH * 0.92;
    ctx.fillStyle = "#22c55e"; ctx.beginPath();
    ctx.moveTo(tx - tubeW / 2 - 3, currentY); ctx.lineTo(tx - tubeW / 2 - 12, currentY - 5); ctx.lineTo(tx - tubeW / 2 - 12, currentY + 5);
    ctx.closePath(); ctx.fill();
  }

  function drawScalesPanel(): void {
    if (!showAllScales) return;
    const px = width * 0.48, py = height * 0.08, pw = width * 0.48, ph = height * 0.42;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.textAlign = "center"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Temperature Scales", px + pw / 2, py + 22);

    const scales = [
      { label: "Celsius", value: displayTemp, unit: "C", min: -40, max: 120, color: "#ef4444" },
      { label: "Fahrenheit", value: toF(displayTemp), unit: "F", min: -40, max: 248, color: "#f59e0b" },
      { label: "Kelvin", value: toK(displayTemp), unit: "K", min: 233.15, max: 393.15, color: "#3b82f6" },
    ];
    scales.forEach((s, idx) => {
      const bx = px + 20, by = py + 50 + idx * 40, bw = pw - 40;
      ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 4); ctx.fill();
      const f = Math.max(0, Math.min(1, (s.value - s.min) / (s.max - s.min)));
      const fg = ctx.createLinearGradient(bx, 0, bx + bw * f, 0);
      fg.addColorStop(0, s.color + "80"); fg.addColorStop(1, s.color);
      ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(bx, by, bw * f, 14, 4); ctx.fill();
      ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "left";
      ctx.fillText(`${s.label}: ${s.value.toFixed(1)} ${s.unit}`, bx, by - 4);
      ctx.fillStyle = "#94a3b8"; ctx.font = "8px system-ui, sans-serif";
      ctx.fillText(`${s.min}`, bx, by + 24); ctx.textAlign = "right"; ctx.fillText(`${s.max}`, bx + bw, by + 24);
    });

    let fy = py + ph - 90;
    ctx.textAlign = "left"; ctx.font = "bold 11px system-ui, sans-serif"; ctx.fillStyle = "#fbbf24";
    ctx.fillText("Conversion Formulas:", px + 20, fy); fy += 18;
    ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText("F = (9/5)C + 32", px + 20, fy); ctx.fillText("K = C + 273.15", px + pw / 2, fy); fy += 15;
    ctx.fillText("C = (5/9)(F - 32)", px + 20, fy); ctx.fillText("C = K - 273.15", px + pw / 2, fy); fy += 20;
    ctx.fillStyle = "#67e8f9"; ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Thermal expansion: dV = b * V * dT", px + 20, fy);
    ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("b = coefficient of thermal expansion", px + 20, fy + 14);
  }

  function drawKeyPoints(): void {
    const px = width * 0.48, py = height * 0.54, pw = width * 0.48, ph = height * 0.18;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.textAlign = "left"; ctx.font = "bold 11px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Key Temperature Points", px + 12, py + 18);
    const pts = [
      { name: "Absolute Zero", c: -273.15, color: "#60a5fa" }, { name: "Water Freezes", c: 0, color: "#38bdf8" },
      { name: "Room Temperature", c: 20, color: "#22c55e" }, { name: "Body Temperature", c: 37, color: "#fbbf24" },
      { name: "Water Boils", c: 100, color: "#ef4444" },
    ];
    ctx.font = "9px system-ui, sans-serif"; let y = py + 34;
    for (const p of pts) {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px + 18, y - 3, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#94a3b8"; ctx.textAlign = "left";
      ctx.fillText(`${p.name}: ${p.c} C / ${toF(p.c).toFixed(1)} F / ${toK(p.c).toFixed(2)} K`, px + 28, y); y += 14;
    }
  }

  function drawInfoPanel(): void {
    const px = 10, py = height * 0.78, pw = width - 20, ph = height * 0.2;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.textAlign = "left"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Thermometer Physics", px + 12, py + 18);
    ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8"; let y = py + 36;
    ctx.fillText(`Current: ${displayTemp.toFixed(1)} C = ${toF(displayTemp).toFixed(1)} F = ${toK(displayTemp).toFixed(2)} K`, px + 12, y); y += 15;
    ctx.fillText("Liquid thermometers rely on thermal expansion of fluids.  dV = b * V0 * dT", px + 12, y); y += 15;
    ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Mercury (b=1.82e-4 /K) or alcohol (b=1.12e-3 /K) expands in a capillary tube. Higher T = faster molecules = expansion.", px + 12, y);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#1e293b"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
    ctx.fillText("Thermometer - Thermal Expansion", width / 2, 28);
    drawThermometer(); drawScalesPanel(); drawKeyPoints(); drawInfoPanel();
  }

  function reset(): void { time = 0; displayTemp = temperature; initMolecules(); }
  function destroy(): void { molecules = []; }

  function getStateDescription(): string {
    return `Thermometer: ${displayTemp.toFixed(1)} C = ${toF(displayTemp).toFixed(1)} F = ${toK(displayTemp).toFixed(2)} K. ` +
      `Thermal expansion: dV=b*V*dT. Mercury b=1.82e-4/K, Alcohol b=1.12e-3/K. ` +
      `Key: Absolute zero (-273.15C), water freezes (0C), body temp (37C), water boils (100C).`;
  }

  function resize(w: number, h: number): void { width = w; height = h; }
  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ThermometerFactory;
