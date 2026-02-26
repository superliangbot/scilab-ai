import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ThreeBodyProblemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("three-body-problem") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800, height = 600, time = 0;
  let preset = 0, mass1 = 1, mass2 = 1, mass3 = 1, timeStep = 0.5;

  interface Body { x: number; y: number; vx: number; vy: number; mass: number; trail: Array<{ x: number; y: number }>; color: string; label: string; }
  let bodies: Body[] = [];
  let kineticEnergy = 0, potentialEnergy = 0, totalEnergy = 0, initialEnergy = 0;
  let energyHistory: number[] = [];
  const G = 1, TRAIL_LENGTH = 500, SOFTENING = 0.5;

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
  }

  function initPreset(): void {
    bodies = []; energyHistory = [];
    const colors = ["#f87171", "#60a5fa", "#34d399"], labels = ["M1", "M2", "M3"];
    if (preset === 0) {
      const v = 0.347111, x = 0.97000436, y = 0.24308753;
      bodies = [
        { x: -x * 100, y: -y * 100, vx: v * 50, vy: v * 50 * 0.93240737, mass: mass1, trail: [], color: colors[0], label: labels[0] },
        { x: x * 100, y: y * 100, vx: v * 50, vy: v * 50 * 0.93240737, mass: mass2, trail: [], color: colors[1], label: labels[1] },
        { x: 0, y: 0, vx: -2 * v * 50, vy: -2 * v * 50 * 0.93240737, mass: mass3, trail: [], color: colors[2], label: labels[2] },
      ];
    } else if (preset === 1) {
      const r = 80, v = Math.sqrt(G * (mass1 + mass2 + mass3) / (r * 3)) * 0.8;
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3 - Math.PI / 2, va = a + Math.PI / 2;
        bodies.push({ x: r * Math.cos(a), y: r * Math.sin(a), vx: v * Math.cos(va), vy: v * Math.sin(va),
          mass: [mass1, mass2, mass3][i], trail: [], color: colors[i], label: labels[i] });
      }
    } else {
      for (let i = 0; i < 3; i++) {
        bodies.push({ x: (Math.random() - 0.5) * 150, y: (Math.random() - 0.5) * 150,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
          mass: [mass1, mass2, mass3][i], trail: [], color: colors[i], label: labels[i] });
      }
    }
    computeEnergy(); initialEnergy = totalEnergy;
  }

  function computeEnergy(): void {
    kineticEnergy = 0; potentialEnergy = 0;
    for (const b of bodies) kineticEnergy += 0.5 * b.mass * (b.vx * b.vx + b.vy * b.vy);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const dx = bodies[j].x - bodies[i].x, dy = bodies[j].y - bodies[i].y;
      potentialEnergy -= G * bodies[i].mass * bodies[j].mass / Math.sqrt(dx * dx + dy * dy + SOFTENING * SOFTENING);
    }
    totalEnergy = kineticEnergy + potentialEnergy;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!; width = canvas.width; height = canvas.height; time = 0; initPreset();
  }

  function update(dt: number, params: Record<string, number>): void {
    const np = Math.round(params.preset ?? 0), nm1 = params.mass1 ?? 1, nm2 = params.mass2 ?? 1, nm3 = params.mass3 ?? 1;
    timeStep = params.timeStep ?? 0.5;
    if (np !== preset || Math.abs(nm1 - mass1) > 0.01 || Math.abs(nm2 - mass2) > 0.01 || Math.abs(nm3 - mass3) > 0.01) {
      preset = np; mass1 = nm1; mass2 = nm2; mass3 = nm3; initPreset();
    }

    const subSteps = 4, subDt = (dt * timeStep * 0.5) / subSteps;
    for (let s = 0; s < subSteps; s++) {
      const ax = [0, 0, 0], ay = [0, 0, 0];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        const dx = bodies[j].x - bodies[i].x, dy = bodies[j].y - bodies[i].y;
        const dSq = dx * dx + dy * dy + SOFTENING * SOFTENING, f = G * bodies[j].mass / (dSq * Math.sqrt(dSq));
        ax[i] += f * dx; ay[i] += f * dy;
      }
      for (let i = 0; i < 3; i++) { bodies[i].x += bodies[i].vx * subDt + 0.5 * ax[i] * subDt * subDt; bodies[i].y += bodies[i].vy * subDt + 0.5 * ay[i] * subDt * subDt; }

      const ax2 = [0, 0, 0], ay2 = [0, 0, 0];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        const dx = bodies[j].x - bodies[i].x, dy = bodies[j].y - bodies[i].y;
        const dSq = dx * dx + dy * dy + SOFTENING * SOFTENING, f = G * bodies[j].mass / (dSq * Math.sqrt(dSq));
        ax2[i] += f * dx; ay2[i] += f * dy;
      }
      for (let i = 0; i < 3; i++) { bodies[i].vx += 0.5 * (ax[i] + ax2[i]) * subDt; bodies[i].vy += 0.5 * (ay[i] + ay2[i]) * subDt; }
    }

    for (const b of bodies) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > TRAIL_LENGTH) b.trail.shift(); }
    time += dt; computeEnergy(); energyHistory.push(totalEnergy); if (energyHistory.length > 200) energyHistory.shift();
  }

  function w2s(wx: number, wy: number): { x: number; y: number } {
    let cmx = 0, cmy = 0, tm = 0;
    for (const b of bodies) { cmx += b.x * b.mass; cmy += b.y * b.mass; tm += b.mass; }
    return { x: width * 0.38 + (wx - cmx / tm) * 1.5, y: height * 0.4 + (wy - cmy / tm) * 1.5 };
  }

  function drawTrails(): void {
    for (const b of bodies) {
      if (b.trail.length < 2) continue;
      const { r, g, b: bv } = hexToRgb(b.color);
      for (let i = 1; i < b.trail.length; i++) {
        const alpha = (i / b.trail.length) * 0.6;
        const p1 = w2s(b.trail[i - 1].x, b.trail[i - 1].y), p2 = w2s(b.trail[i].x, b.trail[i].y);
        ctx.strokeStyle = `rgba(${r},${g},${bv},${alpha})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    }
  }

  function drawBodies(): void {
    for (const b of bodies) {
      const sp = w2s(b.x, b.y), radius = 5 + b.mass * 3;
      const { r, g, b: bv } = hexToRgb(b.color);

      const glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, radius * 3);
      glow.addColorStop(0, `rgba(${r},${g},${bv},0.3)`); glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sp.x, sp.y, radius * 3, 0, Math.PI * 2); ctx.fill();

      const bg = ctx.createRadialGradient(sp.x - 2, sp.y - 2, 0, sp.x, sp.y, radius);
      bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.3, b.color); bg.addColorStop(1, `rgba(${r},${g},${bv},0.8)`);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();

      const vScale = 3, vx = sp.x + b.vx * vScale, vy = sp.y + b.vy * vScale;
      ctx.strokeStyle = `rgba(${r},${g},${bv},0.6)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(vx, vy); ctx.stroke();
      const va = Math.atan2(b.vy, b.vx);
      ctx.fillStyle = `rgba(${r},${g},${bv},0.6)`; ctx.beginPath(); ctx.moveTo(vx, vy);
      ctx.lineTo(vx - 5 * Math.cos(va - 0.4), vy - 5 * Math.sin(va - 0.4));
      ctx.lineTo(vx - 5 * Math.cos(va + 0.4), vy - 5 * Math.sin(va + 0.4)); ctx.closePath(); ctx.fill();

      ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${b.label} (m=${b.mass.toFixed(1)})`, sp.x, sp.y - radius - 6);
    }
  }

  function drawEnergyGraph(): void {
    const gx = width * 0.62, gy = height * 0.05, gw = width * 0.35, gh = height * 0.25;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 6); ctx.fill();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Energy Conservation", gx + gw / 2, gy + 14);
    if (energyHistory.length < 2) return;
    const pX = gx + 10, pY = gy + 22, pW = gw - 20, pH = gh - 34;
    let minE = Infinity, maxE = -Infinity;
    for (const e of energyHistory) { if (e < minE) minE = e; if (e > maxE) maxE = e; }
    const range = Math.max(0.1, maxE - minE);
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < energyHistory.length; i++) {
      const px = pX + (i / energyHistory.length) * pW, py = pY + pH - ((energyHistory[i] - minE) / range) * pH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    const initY = pY + pH - ((initialEnergy - minE) / range) * pH;
    ctx.strokeStyle = "rgba(100,116,139,0.5)"; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(pX, initY); ctx.lineTo(pX + pW, initY); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawInfoPanel(): void {
    const px = 10, py = height * 0.7, pw = width - 20, ph = height * 0.28;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.textAlign = "left"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Three-Body Gravitational Problem", px + 12, py + 18);
    ctx.fillStyle = "#fbbf24"; ctx.fillText("F = G * m1 * m2 / r^2", px + 12, py + 38);

    const col2 = px + pw * 0.5, presetNames = ["Figure-8", "Equilateral Triangle", "Random"];
    let y = py + 56;
    ctx.font = "10px system-ui, sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Preset: ${presetNames[preset]}`, px + 12, y); ctx.fillText(`Time: ${time.toFixed(1)} s`, col2, y); y += 15;
    ctx.fillText(`Kinetic Energy: ${kineticEnergy.toFixed(2)}`, px + 12, y); ctx.fillText(`Potential Energy: ${potentialEnergy.toFixed(2)}`, col2, y); y += 15;
    const drift = initialEnergy !== 0 ? Math.abs((totalEnergy - initialEnergy) / initialEnergy * 100) : 0;
    ctx.fillText(`Total Energy: ${totalEnergy.toFixed(2)}`, px + 12, y);
    ctx.fillStyle = drift > 5 ? "#ef4444" : "#22c55e"; ctx.fillText(`Energy drift: ${drift.toFixed(2)}%`, col2, y); y += 15;
    ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("No general analytical solution exists (Poincare). Chaotic: tiny changes yield vastly different outcomes.", px + 12, y); y += 13;
    ctx.fillText("Special solutions: Figure-8 (Chenciner & Montgomery, 2000), Lagrange points. Verlet integration used.", px + 12, y);
  }

  function render(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a0e1a"); grad.addColorStop(1, "#1a1e2e"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let i = 0; i < 50; i++) { ctx.beginPath(); ctx.arc((i * 137.5) % width, (i * 73.1 + 50) % (height * 0.68), 0.5 + (i % 3) * 0.3, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center";
    ctx.fillText("Three-Body Gravitational Problem", width / 2, 28);
    drawTrails(); drawBodies(); drawEnergyGraph(); drawInfoPanel();
  }

  function reset(): void { time = 0; initPreset(); }
  function destroy(): void { bodies = []; energyHistory = []; }

  function getStateDescription(): string {
    const presetNames = ["Figure-8", "Equilateral Triangle", "Random"];
    const drift = initialEnergy !== 0 ? Math.abs((totalEnergy - initialEnergy) / initialEnergy * 100) : 0;
    return `Three-Body Problem: preset=${presetNames[preset]}, masses=[${mass1},${mass2},${mass3}]. ` +
      `KE=${kineticEnergy.toFixed(2)}, PE=${potentialEnergy.toFixed(2)}, Total=${totalEnergy.toFixed(2)}. ` +
      `Drift: ${drift.toFixed(2)}%. Chaotic system, no general solution. Velocity Verlet integration. F=Gm1m2/r^2.`;
  }

  function resize(w: number, h: number): void { width = w; height = h; }
  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ThreeBodyProblemFactory;
