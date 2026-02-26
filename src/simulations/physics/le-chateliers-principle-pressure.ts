import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LeChateliersPressureFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("le-chateliers-principle-pressure") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  let pressure = 1; // 0.5 to 2.0 atm (normalized)
  let temperature = 300;
  let speed = 1;

  // Reaction: 2 NO2 (brown) <-> N2O4 (colorless)
  // Higher pressure shifts equilibrium toward N2O4 (fewer moles)
  interface Molecule {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: "NO2" | "N2O4";
    radius: number;
  }

  let molecules: Molecule[] = [];
  let containerWidth = 0;
  let containerLeft = 0;
  let containerRight = 0;
  let containerTop = 0;
  let containerBottom = 0;
  let targetNO2 = 20;
  let targetN2O4 = 10;

  function initContainer() {
    containerTop = 120;
    containerBottom = H - 140;
    const fullWidth = W - 200;
    containerWidth = fullWidth / pressure;
    containerLeft = (W - containerWidth) / 2;
    containerRight = containerLeft + containerWidth;
  }

  function initMolecules() {
    molecules = [];
    initContainer();

    // Start with equilibrium mix
    for (let i = 0; i < 20; i++) {
      spawnMolecule("NO2");
    }
    for (let i = 0; i < 10; i++) {
      spawnMolecule("N2O4");
    }
  }

  function spawnMolecule(type: "NO2" | "N2O4") {
    const r = type === "NO2" ? 6 : 9;
    molecules.push({
      x: containerLeft + r + Math.random() * (containerWidth - 2 * r),
      y: containerTop + r + Math.random() * (containerBottom - containerTop - 2 * r),
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      type,
      radius: r,
    });
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    initMolecules();
  }

  function update(dt: number, params: Record<string, number>) {
    const newPressure = params.pressure ?? 1;
    const prevPressure = pressure;
    pressure = newPressure;
    temperature = params.temperature ?? 300;
    speed = params.speed ?? 1;

    const dtClamped = Math.min(dt, 0.05) * speed;
    time += dtClamped;

    initContainer();

    // Le Chatelier: when pressure increases, equilibrium shifts to fewer moles (N2O4)
    // 2 NO2 <-> N2O4
    // At higher pressure, more N2O4; at lower pressure, more NO2
    const Kp = 0.5 * Math.exp(-1000 / temperature); // simplified equilibrium constant
    const idealRatio = pressure * 1.5; // Higher pressure = more N2O4 relative to NO2

    const no2Count = molecules.filter(m => m.type === "NO2").length;
    const n2o4Count = molecules.filter(m => m.type === "N2O4").length;
    const currentRatio = n2o4Count > 0 ? no2Count / n2o4Count : 100;
    const targetRatio = 2 / (pressure * 0.8); // 2 NO2 per N2O4 at P=1, less at high P

    // Slowly shift equilibrium toward target
    if (Math.random() < 0.02 * dtClamped * 20) {
      if (currentRatio > targetRatio && no2Count >= 2) {
        // Combine 2 NO2 -> N2O4
        let removed = 0;
        for (let i = molecules.length - 1; i >= 0 && removed < 2; i--) {
          if (molecules[i].type === "NO2") {
            if (removed === 0) {
              // Convert first to N2O4
              molecules[i].type = "N2O4";
              molecules[i].radius = 9;
            } else {
              molecules.splice(i, 1);
            }
            removed++;
          }
        }
      } else if (currentRatio < targetRatio && n2o4Count > 3) {
        // Split N2O4 -> 2 NO2
        for (let i = molecules.length - 1; i >= 0; i--) {
          if (molecules[i].type === "N2O4") {
            molecules[i].type = "NO2";
            molecules[i].radius = 6;
            spawnMolecule("NO2");
            break;
          }
        }
      }
    }

    // Move molecules
    const tempFactor = Math.sqrt(temperature / 300);
    for (const m of molecules) {
      m.x += m.vx * tempFactor * dtClamped * 60;
      m.y += m.vy * tempFactor * dtClamped * 60;

      // Wall collisions with container
      if (m.x - m.radius < containerLeft) {
        m.x = containerLeft + m.radius;
        m.vx = Math.abs(m.vx);
      }
      if (m.x + m.radius > containerRight) {
        m.x = containerRight - m.radius;
        m.vx = -Math.abs(m.vx);
      }
      if (m.y - m.radius < containerTop) {
        m.y = containerTop + m.radius;
        m.vy = Math.abs(m.vy);
      }
      if (m.y + m.radius > containerBottom) {
        m.y = containerBottom - m.radius;
        m.vy = -Math.abs(m.vy);
      }

      // Random thermal motion
      m.vx += (Math.random() - 0.5) * 0.3 * tempFactor;
      m.vy += (Math.random() - 0.5) * 0.3 * tempFactor;

      // Speed limit
      const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      const maxSp = 4 * tempFactor;
      if (sp > maxSp) {
        m.vx = (m.vx / sp) * maxSp;
        m.vy = (m.vy / sp) * maxSp;
      }
    }
  }

  function render() {
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e1b2e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Le Chatelier's Principle — Pressure", W / 2, 28);

    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("2 NO₂ (brown) ⇌ N₂O₄ (colorless)", W / 2, 48);

    // Draw container with pistons
    const containerH = containerBottom - containerTop;

    // Container gas color based on NO2 concentration
    const no2Count = molecules.filter(m => m.type === "NO2").length;
    const totalMols = molecules.length;
    const no2Frac = no2Count / Math.max(totalMols, 1);
    const brownAlpha = no2Frac * 0.3;

    // Gas fill
    ctx.fillStyle = `rgba(180, 83, 9, ${brownAlpha})`;
    ctx.fillRect(containerLeft, containerTop, containerWidth, containerH);

    // Container walls (top and bottom)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(containerLeft, containerTop);
    ctx.lineTo(containerRight, containerTop);
    ctx.moveTo(containerLeft, containerBottom);
    ctx.lineTo(containerRight, containerBottom);
    ctx.stroke();

    // Left piston
    ctx.fillStyle = "#475569";
    ctx.fillRect(containerLeft - 20, containerTop, 20, containerH);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(containerLeft - 20, containerTop, 20, containerH);

    // Piston handle lines
    for (let i = 0; i < 5; i++) {
      const py = containerTop + 15 + i * (containerH - 30) / 4;
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(containerLeft - 18, py);
      ctx.lineTo(containerLeft - 2, py);
      ctx.stroke();
    }

    // Right piston
    ctx.fillStyle = "#475569";
    ctx.fillRect(containerRight, containerTop, 20, containerH);
    ctx.strokeRect(containerRight, containerTop, 20, containerH);

    for (let i = 0; i < 5; i++) {
      const py = containerTop + 15 + i * (containerH - 30) / 4;
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(containerRight + 2, py);
      ctx.lineTo(containerRight + 18, py);
      ctx.stroke();
    }

    // Pressure arrows
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    if (pressure > 1.2) {
      ctx.fillText("→ Compress ←", W / 2, containerTop - 10);
    } else if (pressure < 0.8) {
      ctx.fillText("← Expand →", W / 2, containerTop - 10);
    } else {
      ctx.fillStyle = "#64748b";
      ctx.fillText("— Equilibrium —", W / 2, containerTop - 10);
    }

    // Draw molecules
    for (const m of molecules) {
      if (m.type === "NO2") {
        // NO2 - brownish-red
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(m.x - 1, m.y - 1, 0, m.x, m.y, m.radius);
        g.addColorStop(0, "#f97316");
        g.addColorStop(1, "#92400e");
        ctx.fillStyle = g;
        ctx.fill();

        // N atom (small blue dot)
        ctx.beginPath();
        ctx.arc(m.x, m.y - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
      } else {
        // N2O4 - lighter, larger
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(m.x - 2, m.y - 2, 0, m.x, m.y, m.radius);
        g.addColorStop(0, "#fef3c7");
        g.addColorStop(1, "#d4d4d8");
        ctx.fillStyle = g;
        ctx.fill();

        // Two N atoms
        ctx.beginPath();
        ctx.arc(m.x - 2, m.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(m.x + 2, m.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
      }
    }

    // Count display
    const n2o4Count = molecules.filter(m => m.type === "N2O4").length;

    const panelX = 20;
    const panelY = H - 120;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 220, 105, 8);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Molecule Count", panelX + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#f97316";
    ctx.fillText(`NO₂ (brown): ${no2Count}`, panelX + 10, panelY + 38);
    ctx.fillStyle = "#d4d4d8";
    ctx.fillText(`N₂O₄ (colorless): ${n2o4Count}`, panelX + 10, panelY + 55);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Total molecules: ${totalMols}`, panelX + 10, panelY + 72);
    ctx.fillText(`Pressure: ${pressure.toFixed(2)} atm`, panelX + 10, panelY + 89);

    // Equilibrium shift indicator
    const shiftPanel = W - 280;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(shiftPanel, panelY, 260, 105, 8);
    ctx.fill();

    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.fillText("Le Chatelier's Principle", shiftPanel + 10, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    if (pressure > 1.2) {
      ctx.fillStyle = "#22d3ee";
      ctx.fillText("↑ Pressure → Equilibrium shifts right", shiftPanel + 10, panelY + 38);
      ctx.fillText("  Favors fewer moles: 2NO₂ → N₂O₄", shiftPanel + 10, panelY + 55);
      ctx.fillText("  Gas becomes less brown (less NO₂)", shiftPanel + 10, panelY + 72);
    } else if (pressure < 0.8) {
      ctx.fillStyle = "#f97316";
      ctx.fillText("↓ Pressure → Equilibrium shifts left", shiftPanel + 10, panelY + 38);
      ctx.fillText("  Favors more moles: N₂O₄ → 2NO₂", shiftPanel + 10, panelY + 55);
      ctx.fillText("  Gas becomes more brown (more NO₂)", shiftPanel + 10, panelY + 72);
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("At equilibrium — no net shift", shiftPanel + 10, panelY + 38);
      ctx.fillText("Forward and reverse rates are equal", shiftPanel + 10, panelY + 55);
    }

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("T = " + temperature + " K", shiftPanel + 10, panelY + 92);
  }

  function reset() {
    time = 0;
    initMolecules();
  }

  function destroy() {
    molecules = [];
  }

  function getStateDescription(): string {
    const no2 = molecules.filter(m => m.type === "NO2").length;
    const n2o4 = molecules.filter(m => m.type === "N2O4").length;
    return (
      `Le Chatelier's Principle (Pressure): 2NO₂ ⇌ N₂O₄. ` +
      `Pressure: ${pressure.toFixed(2)} atm, Temperature: ${temperature}K. ` +
      `NO₂: ${no2}, N₂O₄: ${n2o4}, Total: ${molecules.length}. ` +
      `${pressure > 1.2 ? "High pressure shifts equilibrium toward N₂O₄ (fewer moles)." : ""}` +
      `${pressure < 0.8 ? "Low pressure shifts equilibrium toward NO₂ (more moles)." : ""}` +
      `${pressure >= 0.8 && pressure <= 1.2 ? "Near equilibrium." : ""}`
    );
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
    initContainer();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LeChateliersPressureFactory;
