import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PvnrtFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("pvnrt") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let pressure = 101.325; // kPa
  let volume = 22.4; // L
  let moles = 1;
  let temperature = 273.15; // K
  const R = 8.314; // J/(mol·K)

  interface Molecule {
    x: number; y: number;
    vx: number; vy: number;
  }
  let molecules: Molecule[] = [];

  function initMolecules(): void {
    molecules = [];
    const count = Math.min(Math.round(moles * 30), 120);
    for (let i = 0; i < count; i++) {
      const speed = Math.sqrt(temperature / 273) * 2;
      const angle = Math.random() * Math.PI * 2;
      molecules.push({
        x: 0.1 + Math.random() * 0.8,
        y: 0.1 + Math.random() * 0.8,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed * (0.5 + Math.random()),
      });
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
    pressure = params.pressure ?? 101.325;
    volume = params.volume ?? 22.4;
    moles = params.moles ?? 1;
    temperature = params.temperature ?? 273.15;
    time += dt;

    // Adjust molecule count
    const targetCount = Math.min(Math.round(moles * 30), 120);
    while (molecules.length < targetCount) {
      const speed = Math.sqrt(temperature / 273) * 2;
      const angle = Math.random() * Math.PI * 2;
      molecules.push({
        x: 0.2 + Math.random() * 0.6,
        y: 0.2 + Math.random() * 0.6,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed * (0.5 + Math.random()),
      });
    }
    while (molecules.length > targetCount) molecules.pop();

    // Update molecule speeds based on temperature
    const speedScale = Math.sqrt(temperature / 273) * 2;

    // Volume affects container size (normalized 0-1)
    const containerFrac = Math.min(1, volume / 50);

    for (const m of molecules) {
      m.x += m.vx * dt * 0.5;
      m.y += m.vy * dt * 0.5;

      const margin = (1 - containerFrac) / 2;
      const lo = margin;
      const hi = 1 - margin;

      if (m.x < lo) { m.x = lo; m.vx = Math.abs(m.vx); }
      if (m.x > hi) { m.x = hi; m.vx = -Math.abs(m.vx); }
      if (m.y < lo) { m.y = lo; m.vy = Math.abs(m.vy); }
      if (m.y > hi) { m.y = hi; m.vy = -Math.abs(m.vy); }

      // Adjust speed to match temperature
      const currentSpeed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (currentSpeed > 0.01) {
        const factor = speedScale / currentSpeed;
        const blend = 0.02;
        m.vx *= 1 + (factor - 1) * blend;
        m.vy *= 1 + (factor - 1) * blend;
      }
    }
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Compute state from ideal gas law
    const calcTemp = (pressure * 1000 * (volume / 1000)) / (moles * R);
    const calcPressure = (moles * R * temperature) / (volume / 1000) / 1000;

    // Container visualization
    const containerFrac = Math.min(1, volume / 50);
    const margin = (1 - containerFrac) / 2;

    const boxX = width * 0.05 + width * 0.4 * margin;
    const boxY = height * 0.12 + height * 0.55 * margin;
    const boxW = width * 0.4 * containerFrac;
    const boxH = height * 0.55 * containerFrac;

    // Container background
    ctx.fillStyle = "rgba(20, 40, 80, 0.4)";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();

    // Container walls with glow based on pressure
    const pressGlow = Math.min(1, pressure / 500);
    ctx.strokeStyle = `rgba(${100 + 155 * pressGlow}, ${200 - 100 * pressGlow}, 255, 0.7)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.stroke();

    // Piston on top (movable)
    const pistonH = 12;
    ctx.fillStyle = "rgba(150, 150, 170, 0.8)";
    ctx.fillRect(boxX - 5, boxY - pistonH / 2, boxW + 10, pistonH);
    ctx.strokeStyle = "rgba(200, 200, 220, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX - 5, boxY - pistonH / 2, boxW + 10, pistonH);
    // Piston handle
    ctx.fillStyle = "#888";
    ctx.fillRect(boxX + boxW / 2 - 3, boxY - pistonH - 20, 6, 20);

    // Draw molecules
    const tempColor = temperature > 400 ? "#ff6644" : temperature > 300 ? "#ffcc44" : "#44aaff";
    for (const m of molecules) {
      const mx = boxX + m.x * boxW;
      const my = boxY + m.y * boxH;

      if (mx >= boxX && mx <= boxX + boxW && my >= boxY && my <= boxY + boxH) {
        // Glow
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 8);
        glow.addColorStop(0, tempColor.replace(")", ",0.3)").replace("rgb", "rgba").replace("#", ""));
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.fillStyle = `${tempColor}33`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fillStyle = tempColor;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Pressure arrows on walls
    if (pressure > 50) {
      const numArrows = Math.min(6, Math.ceil(pressure / 100));
      ctx.strokeStyle = `rgba(255, 100, 100, ${Math.min(0.7, pressure / 500)})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < numArrows; i++) {
        const frac = (i + 1) / (numArrows + 1);
        // Left wall
        const ly = boxY + boxH * frac;
        ctx.beginPath();
        ctx.moveTo(boxX + 10, ly);
        ctx.lineTo(boxX + 2, ly);
        ctx.stroke();
        // Right wall
        ctx.beginPath();
        ctx.moveTo(boxX + boxW - 10, ly);
        ctx.lineTo(boxX + boxW - 2, ly);
        ctx.stroke();
      }
    }

    // Info panel
    const panelX = width * 0.52;
    const panelY = height * 0.08;
    const panelW = width * 0.45;
    const panelH = height * 0.62;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 150, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let py = panelY + 25;
    ctx.fillStyle = "rgba(255, 200, 100, 0.95)";
    ctx.font = "bold 18px 'SF Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("PV = nRT", panelX + panelW / 2, py);
    py += 30;

    const vars = [
      { label: "Pressure (P)", value: `${pressure.toFixed(1)} kPa`, color: "#ff8866" },
      { label: "Volume (V)", value: `${volume.toFixed(1)} L`, color: "#66bbff" },
      { label: "Moles (n)", value: `${moles.toFixed(2)} mol`, color: "#88ff88" },
      { label: "Temperature (T)", value: `${temperature.toFixed(1)} K`, color: "#ffcc44" },
      { label: "Gas Constant (R)", value: `8.314 J/(mol·K)`, color: "#cccccc" },
    ];

    for (const v of vars) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(v.label, panelX + 12, py);
      ctx.fillStyle = v.color;
      ctx.font = "bold 13px 'SF Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(v.value, panelX + panelW - 12, py);
      py += 24;
    }

    py += 10;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(panelX + 10, py);
    ctx.lineTo(panelX + panelW - 10, py);
    ctx.stroke();
    py += 15;

    // Verification
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Verification:", panelX + 12, py);
    py += 22;

    const pv = pressure * volume;
    const nrt = moles * R * temperature;
    ctx.fillStyle = "rgba(180, 220, 255, 0.8)";
    ctx.font = "12px 'SF Mono', monospace";
    ctx.fillText(`PV = ${pv.toFixed(1)} kPa·L`, panelX + 12, py);
    py += 18;
    ctx.fillText(`nRT = ${(nrt / 1000).toFixed(1)} kPa·L`, panelX + 12, py);
    py += 22;

    const ratio = pv / (nrt / 1000);
    const match = Math.abs(ratio - 1) < 0.1;
    ctx.fillStyle = match ? "rgba(100, 255, 100, 0.9)" : "rgba(255, 100, 100, 0.9)";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(match ? "Values consistent with ideal gas law" : `Ratio PV/nRT = ${ratio.toFixed(3)}`, panelX + 12, py);

    // Molecule count
    py += 30;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Simulated molecules: ${molecules.length}`, panelX + 12, py);

    // Bottom formula bar
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.roundRect(width * 0.05, height * 0.82, width * 0.9, height * 0.12, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 200, 100, 0.8)";
    ctx.font = "13px 'SF Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `P×V = n×R×T  →  ${pressure.toFixed(1)}×${volume.toFixed(1)} = ${moles.toFixed(2)}×8.314×${temperature.toFixed(1)}`,
      width / 2, height * 0.89
    );

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ideal Gas Law: PV = nRT", width / 2, height - 15);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void {
    time = 0;
    initMolecules();
  }

  function destroy(): void { molecules.length = 0; }

  function getStateDescription(): string {
    return (
      `Ideal Gas Law PV=nRT: P = ${pressure.toFixed(1)} kPa, V = ${volume.toFixed(1)} L, ` +
      `n = ${moles.toFixed(2)} mol, T = ${temperature.toFixed(1)} K, R = 8.314 J/(mol·K). ` +
      `PV = ${(pressure * volume).toFixed(1)} kPa·L, nRT = ${(moles * R * temperature / 1000).toFixed(1)} kPa·L. ` +
      `${molecules.length} molecules simulated. Time: ${time.toFixed(2)}s.`
    );
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PvnrtFactory;
