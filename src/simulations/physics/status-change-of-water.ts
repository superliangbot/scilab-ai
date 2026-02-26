import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Phase Transitions of Water (Heating Curve)
 * Demonstrates:
 * - Heating ice -> water -> steam
 * - Heating curve with plateaus at 0C and 100C
 * - Molecular behaviour in each phase
 * - Latent heat of fusion and vaporization
 */

interface Molecule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
}

const StatusChangeOfWaterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("status-change-of-water") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let heatRate = 3;
  let initialTemp = -10;
  let showGraph = 1;
  let showMolecules = 1;

  // Simulation state
  let currentTemp = -10;
  let energy = 0;
  let phase: "ice" | "melting" | "liquid" | "boiling" | "steam" = "ice";
  let meltProgress = 0; // 0 to 1 during melting
  let boilProgress = 0; // 0 to 1 during boiling
  let molecules: Molecule[] = [];
  let tempHistory: Array<{ time: number; temp: number }> = [];

  // Physical constants (simplified for visualization)
  const specificHeatIce = 2.09;    // J/(g*C)
  const specificHeatWater = 4.18;  // J/(g*C)
  const specificHeatSteam = 2.01;  // J/(g*C)
  const latentHeatFusion = 334;    // J/g
  const latentHeatVaporization = 2260; // J/g
  const mass = 10; // g of water
  const MAX_HISTORY = 400;

  function initMolecules(): void {
    molecules = [];
    const count = 30;
    const beakerCx = width * 0.28;
    const beakerCy = height * 0.5;
    const spread = 60;

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 6);
      const col = i % 6;
      const bx = beakerCx - spread + col * 22;
      const by = beakerCy - 30 + row * 22;
      molecules.push({
        x: bx, y: by,
        vx: 0, vy: 0,
        baseX: bx, baseY: by,
      });
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    currentTemp = initialTemp;
    energy = 0;
    phase = "ice";
    meltProgress = 0;
    boilProgress = 0;
    tempHistory = [];
    initMolecules();
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    heatRate = params.heatRate ?? 3;
    initialTemp = params.initialTemp ?? -10;
    showGraph = params.showGraph ?? 1;
    showMolecules = params.showMolecules ?? 1;
    time += step;

    // Add energy
    const dE = heatRate * step * 20; // scale for visual speed
    energy += dE;

    // Determine temperature based on phase
    if (phase === "ice") {
      currentTemp += dE / (mass * specificHeatIce);
      if (currentTemp >= 0) {
        currentTemp = 0;
        phase = "melting";
        meltProgress = 0;
      }
    } else if (phase === "melting") {
      meltProgress += dE / (mass * latentHeatFusion);
      currentTemp = 0;
      if (meltProgress >= 1) {
        meltProgress = 1;
        phase = "liquid";
      }
    } else if (phase === "liquid") {
      currentTemp += dE / (mass * specificHeatWater);
      if (currentTemp >= 100) {
        currentTemp = 100;
        phase = "boiling";
        boilProgress = 0;
      }
    } else if (phase === "boiling") {
      boilProgress += dE / (mass * latentHeatVaporization);
      currentTemp = 100;
      if (boilProgress >= 1) {
        boilProgress = 1;
        phase = "steam";
      }
    } else if (phase === "steam") {
      currentTemp += dE / (mass * specificHeatSteam);
      if (currentTemp > 150) currentTemp = 150;
    }

    // Record temp history
    tempHistory.push({ time, temp: currentTemp });
    if (tempHistory.length > MAX_HISTORY) tempHistory.shift();

    // Update molecules
    updateMolecules(step);
  }

  function updateMolecules(dt: number): void {
    const beakerCx = width * 0.28;
    const beakerCy = height * 0.5;
    const beakerW = 140;
    const beakerH = 130;

    molecules.forEach((m) => {
      if (phase === "ice") {
        // Vibrate around lattice positions
        const vibAmp = 1.5;
        m.x = m.baseX + Math.sin(time * 8 + m.baseX) * vibAmp;
        m.y = m.baseY + Math.cos(time * 8 + m.baseY) * vibAmp;
      } else if (phase === "melting") {
        // Gradually loosen from lattice
        const loosen = meltProgress * 3;
        m.x = m.baseX + Math.sin(time * 6 + m.baseX) * (1.5 + loosen * 5);
        m.y = m.baseY + Math.cos(time * 5 + m.baseY) * (1.5 + loosen * 5);
      } else if (phase === "liquid") {
        // Move freely but stay together
        m.vx += (Math.random() - 0.5) * 80 * dt;
        m.vy += (Math.random() - 0.5) * 80 * dt;
        m.vx *= 0.97;
        m.vy *= 0.97;
        m.x += m.vx * dt;
        m.y += m.vy * dt;

        // Contain within beaker
        const left = beakerCx - beakerW / 2 + 15;
        const right = beakerCx + beakerW / 2 - 15;
        const top = beakerCy - beakerH / 2 + 15;
        const bottom = beakerCy + beakerH / 2 - 5;
        if (m.x < left) { m.x = left; m.vx *= -0.5; }
        if (m.x > right) { m.x = right; m.vx *= -0.5; }
        if (m.y < top) { m.y = top; m.vy *= -0.5; }
        if (m.y > bottom) { m.y = bottom; m.vy *= -0.5; }
      } else if (phase === "boiling") {
        // Liquid + some escaping
        m.vx += (Math.random() - 0.5) * 120 * dt;
        m.vy += (Math.random() - 0.5) * 120 * dt;
        if (Math.random() < boilProgress * 0.05) m.vy -= 150 * dt;
        m.vx *= 0.96;
        m.vy *= 0.96;
        m.x += m.vx * dt;
        m.y += m.vy * dt;

        const left = beakerCx - beakerW / 2 + 10;
        const right = beakerCx + beakerW / 2 - 10;
        const bottom = beakerCy + beakerH / 2 - 5;
        if (m.x < left) { m.x = left; m.vx *= -0.5; }
        if (m.x > right) { m.x = right; m.vx *= -0.5; }
        if (m.y > bottom) { m.y = bottom; m.vy *= -0.5; }
        if (m.y < beakerCy - beakerH) m.y = beakerCy - beakerH;
      } else {
        // Steam: fast and spread out
        m.vx += (Math.random() - 0.5) * 200 * dt;
        m.vy += (Math.random() - 0.5) * 200 * dt - 30 * dt;
        m.vx *= 0.95;
        m.vy *= 0.95;
        m.x += m.vx * dt;
        m.y += m.vy * dt;

        // Wrap around loosely
        const margin = 80;
        if (m.x < beakerCx - beakerW - margin) m.x = beakerCx + beakerW / 2;
        if (m.x > beakerCx + beakerW + margin) m.x = beakerCx - beakerW / 2;
        if (m.y < beakerCy - beakerH - margin) m.y = beakerCy + beakerH / 2;
        if (m.y > beakerCy + beakerH / 2 + margin) m.y = beakerCy - beakerH / 2;
      }
    });
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.024)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Phase Transitions of Water", width / 2, 28);

    drawBeaker();
    if (showMolecules) drawMolecules();
    drawBurner();
    drawPhaseLabel();
    if (showGraph) drawHeatingCurve();
    drawTemperatureDisplay();
  }

  function drawBeaker(): void {
    const bx = width * 0.28;
    const by = height * 0.5;
    const bw = 140;
    const bh = 130;

    // Beaker outline
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by - bh / 2 - 10);
    ctx.lineTo(bx - bw / 2, by + bh / 2);
    ctx.lineTo(bx + bw / 2, by + bh / 2);
    ctx.lineTo(bx + bw / 2, by - bh / 2 - 10);
    ctx.stroke();

    // Water fill
    let fillColor: string;
    let fillH = bh;
    if (phase === "ice") {
      fillColor = "rgba(147, 197, 253, 0.5)";
    } else if (phase === "melting") {
      fillColor = `rgba(96, 165, 250, ${0.3 + meltProgress * 0.2})`;
    } else if (phase === "liquid") {
      fillColor = "rgba(59, 130, 246, 0.4)";
    } else if (phase === "boiling") {
      fillH = bh * (1 - boilProgress * 0.5);
      fillColor = "rgba(59, 130, 246, 0.35)";
    } else {
      fillH = bh * 0.1;
      fillColor = "rgba(59, 130, 246, 0.1)";
    }

    ctx.fillStyle = fillColor;
    ctx.fillRect(bx - bw / 2 + 2, by + bh / 2 - fillH, bw - 4, fillH - 2);

    // Bubbles when boiling
    if (phase === "boiling") {
      for (let i = 0; i < 8; i++) {
        const bubbleX = bx - bw / 3 + Math.random() * bw * 0.66;
        const bubbleY = by + bh / 2 - Math.random() * fillH;
        const r = 2 + Math.random() * 4 * boilProgress;
        ctx.beginPath();
        ctx.arc(bubbleX, bubbleY, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Steam wisps above beaker when boiling/steam
    if (phase === "boiling" || phase === "steam") {
      ctx.strokeStyle = "rgba(200, 200, 220, 0.15)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const sx = bx - 30 + i * 15;
        const sy = by - bh / 2 - 15;
        ctx.beginPath();
        for (let j = 0; j < 20; j++) {
          const t = j / 20;
          const wx = sx + Math.sin((time * 3 + i) + t * 4) * 8;
          const wy = sy - t * 40;
          if (j === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      }
    }

    // Ice cracks when in ice phase
    if (phase === "ice") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      const iceTop = by + bh / 2 - fillH;
      ctx.beginPath();
      ctx.moveTo(bx - 20, iceTop + 10);
      ctx.lineTo(bx + 10, iceTop + 30);
      ctx.lineTo(bx + 30, iceTop + 25);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 15, iceTop + 15);
      ctx.lineTo(bx - 5, iceTop + 40);
      ctx.stroke();
    }
  }

  function drawMolecules(): void {
    molecules.forEach((m) => {
      // Oxygen (red)
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Hydrogen atoms
      const angle1 = Math.PI * 0.8;
      const angle2 = -Math.PI * 0.8;
      const dist = 6;
      const hx1 = m.x + Math.cos(angle1 + time * 0.5) * dist;
      const hy1 = m.y + Math.sin(angle1 + time * 0.5) * dist;
      const hx2 = m.x + Math.cos(angle2 + time * 0.5) * dist;
      const hy2 = m.y + Math.sin(angle2 + time * 0.5) * dist;

      ctx.beginPath();
      ctx.arc(hx1, hy1, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#93c5fd";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx2, hy2, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#93c5fd";
      ctx.fill();

      // Bonds
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(hx1, hy1);
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(hx2, hy2);
      ctx.stroke();
    });
  }

  function drawBurner(): void {
    const bx = width * 0.28;
    const by = height * 0.5 + 80;

    // Burner base
    const burnerGrad = ctx.createLinearGradient(bx - 40, by, bx + 40, by + 20);
    burnerGrad.addColorStop(0, "#6b7280");
    burnerGrad.addColorStop(1, "#374151");
    ctx.fillStyle = burnerGrad;
    ctx.fillRect(bx - 40, by, 80, 20);

    // Flame
    const flameH = 15 + heatRate * 3;
    const flameGrad = ctx.createLinearGradient(bx, by, bx, by - flameH);
    flameGrad.addColorStop(0, "#f59e0b");
    flameGrad.addColorStop(0.5, "#ef4444");
    flameGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = flameGrad;

    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      const fx = bx + i * 12;
      const wobble = Math.sin(time * 10 + i * 2) * 3;
      ctx.moveTo(fx - 5, by);
      ctx.quadraticCurveTo(fx + wobble, by - flameH * 0.6, fx, by - flameH);
      ctx.quadraticCurveTo(fx - wobble, by - flameH * 0.6, fx + 5, by);
      ctx.fill();
    }
  }

  function drawPhaseLabel(): void {
    const bx = width * 0.28;
    const by = height * 0.16;
    let label = "";
    let color = "";

    if (phase === "ice") { label = "SOLID (Ice)"; color = "#93c5fd"; }
    else if (phase === "melting") { label = "MELTING (Solid + Liquid)"; color = "#60a5fa"; }
    else if (phase === "liquid") { label = "LIQUID (Water)"; color = "#3b82f6"; }
    else if (phase === "boiling") { label = "BOILING (Liquid + Gas)"; color = "#a78bfa"; }
    else { label = "GAS (Steam)"; color = "#c084fc"; }

    ctx.fillStyle = color;
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, bx, by);
  }

  function drawTemperatureDisplay(): void {
    const tx = width * 0.28;
    const ty = height * 0.22;

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${currentTemp.toFixed(1)} \u00B0C`, tx, ty);
  }

  function drawHeatingCurve(): void {
    const gx = width * 0.54;
    const gy = height * 0.12;
    const gw = width * 0.42;
    const gh = height * 0.78;

    // Panel background
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Heating Curve", gx + gw / 2, gy + 20);

    // Plot area
    const px = gx + 50;
    const py = gy + 35;
    const pw = gw - 70;
    const ph = gh - 70;

    // Axes
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py + ph);
    ctx.lineTo(px + pw, py + ph);
    ctx.stroke();

    // Y-axis labels (Temperature)
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    const tempRange = [-20, 0, 20, 40, 60, 80, 100, 120, 150];
    tempRange.forEach((t) => {
      const yy = py + ph - ((t + 20) / 170) * ph;
      ctx.fillText(`${t}\u00B0C`, px - 5, yy + 3);
      ctx.strokeStyle = "rgba(100,116,139,0.15)";
      ctx.beginPath();
      ctx.moveTo(px, yy);
      ctx.lineTo(px + pw, yy);
      ctx.stroke();
    });

    // Phase transition lines
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 1;
    const y0 = py + ph - (20 / 170) * ph;
    ctx.beginPath();
    ctx.moveTo(px, y0);
    ctx.lineTo(px + pw, y0);
    ctx.stroke();
    ctx.fillStyle = "rgba(251, 191, 36, 0.6)";
    ctx.textAlign = "left";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("0\u00B0C (melting)", px + pw + 2, y0 + 3);

    const y100 = py + ph - (120 / 170) * ph;
    ctx.beginPath();
    ctx.moveTo(px, y100);
    ctx.lineTo(px + pw, y100);
    ctx.stroke();
    ctx.fillText("100\u00B0C (boiling)", px + pw + 2, y100 + 3);
    ctx.setLineDash([]);

    // X-axis label
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Time (Heat Added) \u2192", px + pw / 2, py + ph + 25);

    ctx.save();
    ctx.translate(px - 35, py + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Temperature (\u00B0C)", 0, 0);
    ctx.restore();

    // Plot the data
    if (tempHistory.length < 2) return;
    const t0 = tempHistory[0].time;
    const tEnd = tempHistory[tempHistory.length - 1].time;
    const timeSpan = Math.max(1, tEnd - t0);

    ctx.beginPath();
    const lineGrad = ctx.createLinearGradient(px, py + ph, px, py);
    lineGrad.addColorStop(0, "#60a5fa");
    lineGrad.addColorStop(0.5, "#a78bfa");
    lineGrad.addColorStop(1, "#f43f5e");
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;

    for (let i = 0; i < tempHistory.length; i++) {
      const entry = tempHistory[i];
      const sx = px + ((entry.time - t0) / timeSpan) * pw;
      const sy = py + ph - ((entry.temp + 20) / 170) * ph;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Current point
    const lastEntry = tempHistory[tempHistory.length - 1];
    const cx = px + ((lastEntry.time - t0) / timeSpan) * pw;
    const cy = py + ph - ((lastEntry.temp + 20) / 170) * ph;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Phase labels on curve
    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    const labelY = py + ph + 40;
    ctx.fillText("Ice | Melting | Water | Boiling | Steam", px + pw / 2, labelY);
  }

  function reset(): void {
    time = 0;
    currentTemp = initialTemp;
    energy = 0;
    phase = "ice";
    meltProgress = 0;
    boilProgress = 0;
    tempHistory = [];
    initMolecules();
  }

  function destroy(): void {
    molecules = [];
    tempHistory = [];
  }

  function getStateDescription(): string {
    return (
      `Water phase transition: currently at ${currentTemp.toFixed(1)}\u00B0C in ${phase} phase. ` +
      `Heat rate: ${heatRate} cal/s. Heating curve shows temperature vs time with plateaus at 0\u00B0C ` +
      `(latent heat of fusion = ${latentHeatFusion} J/g) and 100\u00B0C (latent heat of vaporization = ${latentHeatVaporization} J/g). ` +
      `Molecular behaviour changes: ice (tight lattice), liquid (loose), steam (fast/spread).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StatusChangeOfWaterFactory;
