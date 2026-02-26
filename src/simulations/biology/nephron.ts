import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const NephronFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("nephron") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let bloodPressure = 70;
  let waterReabsorption = 80;
  let sodiumReabsorption = 70;
  let flowSpeed = 1;

  // Particle system for filtrate flow
  interface Particle {
    x: number;
    y: number;
    t: number; // parameter along path [0, 1]
    type: "blood" | "filtrate" | "urine" | "water" | "sodium" | "glucose";
    alpha: number;
  }
  let particles: Particle[] = [];

  // Nephron path points (defining the structure)
  const pathPoints = {
    glomerulus: { x: 0.25, y: 0.2 },
    bowmanStart: { x: 0.2, y: 0.15 },
    bowmanEnd: { x: 0.3, y: 0.25 },
    pctStart: { x: 0.32, y: 0.28 },
    pctEnd: { x: 0.65, y: 0.3 },
    loopDesc: { x: 0.7, y: 0.75 },
    loopBend: { x: 0.55, y: 0.85 },
    loopAsc: { x: 0.45, y: 0.55 },
    dctStart: { x: 0.4, y: 0.45 },
    dctEnd: { x: 0.2, y: 0.42 },
    collectDuct: { x: 0.2, y: 0.9 },
  };

  function toCanvas(px: number, py: number): { x: number; y: number } {
    return { x: px * width, y: py * height };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    particles = [];
  }

  function spawnParticles(): void {
    if (particles.length > 200) return;

    // Blood entering glomerulus
    if (Math.random() < 0.3 * flowSpeed) {
      particles.push({
        x: 0, y: 0, t: 0,
        type: "blood",
        alpha: 1,
      });
    }

    // Filtrate in tubule
    if (Math.random() < 0.2 * flowSpeed * (bloodPressure / 100)) {
      particles.push({
        x: 0, y: 0, t: 0,
        type: "filtrate",
        alpha: 1,
      });
    }
  }

  function update(dt: number, params: Record<string, number>): void {
    bloodPressure = params.bloodPressure ?? 70;
    waterReabsorption = params.waterReabsorption ?? 80;
    sodiumReabsorption = params.sodiumReabsorption ?? 70;
    flowSpeed = params.flowSpeed ?? 1;

    time += dt * flowSpeed;
    spawnParticles();

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt * flowSpeed * 0.05;

      if (p.t > 1) {
        particles.splice(i, 1);
        continue;
      }

      // Position along nephron path
      const pos = getPathPosition(p.t, p.type);
      p.x = pos.x;
      p.y = pos.y;

      // Reabsorption - particles fade when reabsorbed
      if (p.type === "filtrate" && p.t > 0.3 && p.t < 0.7) {
        if (Math.random() < waterReabsorption * 0.0001) {
          p.type = "water";
          p.alpha *= 0.95;
        }
      }
    }

    // Remove faded particles
    particles = particles.filter(p => p.alpha > 0.1);
  }

  function getPathPosition(t: number, type: string): { x: number; y: number } {
    const pp = pathPoints;

    if (type === "blood") {
      // Blood flows through glomerulus
      const angle = t * Math.PI * 4;
      const r = 25 - t * 15;
      const center = toCanvas(pp.glomerulus.x, pp.glomerulus.y);
      return {
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      };
    }

    if (type === "water") {
      // Reabsorbed water moves toward peritubular capillaries
      const base = getPathPosition(t, "filtrate");
      return {
        x: base.x + 30 + Math.random() * 10,
        y: base.y + Math.random() * 10 - 5,
      };
    }

    // Filtrate/urine path through tubule
    if (t < 0.15) {
      // Bowman's capsule to PCT start
      const lt = t / 0.15;
      const s = toCanvas(pp.bowmanEnd.x, pp.bowmanEnd.y);
      const e = toCanvas(pp.pctStart.x, pp.pctStart.y);
      return { x: s.x + (e.x - s.x) * lt, y: s.y + (e.y - s.y) * lt };
    } else if (t < 0.3) {
      // PCT
      const lt = (t - 0.15) / 0.15;
      const s = toCanvas(pp.pctStart.x, pp.pctStart.y);
      const e = toCanvas(pp.pctEnd.x, pp.pctEnd.y);
      return { x: s.x + (e.x - s.x) * lt, y: s.y + (e.y - s.y) * lt };
    } else if (t < 0.5) {
      // Descending loop of Henle
      const lt = (t - 0.3) / 0.2;
      const s = toCanvas(pp.pctEnd.x, pp.pctEnd.y);
      const e = toCanvas(pp.loopDesc.x, pp.loopDesc.y);
      const mid = toCanvas((pp.pctEnd.x + pp.loopDesc.x) / 2, pp.loopDesc.y);
      const ix = (1 - lt) * (1 - lt) * s.x + 2 * (1 - lt) * lt * mid.x + lt * lt * e.x;
      const iy = (1 - lt) * (1 - lt) * s.y + 2 * (1 - lt) * lt * mid.y + lt * lt * e.y;
      return { x: ix, y: iy };
    } else if (t < 0.6) {
      // Loop bend
      const lt = (t - 0.5) / 0.1;
      const s = toCanvas(pp.loopDesc.x, pp.loopDesc.y);
      const e = toCanvas(pp.loopBend.x, pp.loopBend.y);
      return { x: s.x + (e.x - s.x) * lt, y: s.y + (e.y - s.y) * lt };
    } else if (t < 0.75) {
      // Ascending loop of Henle
      const lt = (t - 0.6) / 0.15;
      const s = toCanvas(pp.loopBend.x, pp.loopBend.y);
      const e = toCanvas(pp.loopAsc.x, pp.loopAsc.y);
      return { x: s.x + (e.x - s.x) * lt, y: s.y + (e.y - s.y) * lt };
    } else if (t < 0.85) {
      // DCT
      const lt = (t - 0.75) / 0.1;
      const s = toCanvas(pp.dctStart.x, pp.dctStart.y);
      const e = toCanvas(pp.dctEnd.x, pp.dctEnd.y);
      return { x: s.x + (e.x - s.x) * lt, y: s.y + (e.y - s.y) * lt };
    } else {
      // Collecting duct
      const lt = (t - 0.85) / 0.15;
      const s = toCanvas(pp.dctEnd.x, pp.dctEnd.y);
      const e = toCanvas(pp.collectDuct.x, pp.collectDuct.y);
      return { x: s.x + (e.x - s.x) * lt, y: s.y + (e.y - s.y) * lt };
    }
  }

  function drawNephronStructure(): void {
    const pp = pathPoints;

    // Glomerulus (capillary tuft)
    const glom = toCanvas(pp.glomerulus.x, pp.glomerulus.y);
    ctx.beginPath();
    ctx.arc(glom.x, glom.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
    ctx.fill();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Capillary loops inside glomerulus
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(glom.x + Math.cos(angle) * 12, glom.y + Math.sin(angle) * 12, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Bowman's capsule
    ctx.beginPath();
    ctx.arc(glom.x, glom.y, 45, 0, Math.PI * 2);
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 3;
    ctx.stroke();

    // PCT (Proximal Convoluted Tubule)
    const pctS = toCanvas(pp.pctStart.x, pp.pctStart.y);
    const pctE = toCanvas(pp.pctEnd.x, pp.pctEnd.y);
    ctx.beginPath();
    ctx.moveTo(pctS.x, pctS.y);
    // Wavy path
    const pctSteps = 20;
    for (let i = 1; i <= pctSteps; i++) {
      const lt = i / pctSteps;
      const x = pctS.x + (pctE.x - pctS.x) * lt;
      const y = pctS.y + (pctE.y - pctS.y) * lt + Math.sin(lt * Math.PI * 6) * 8;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Loop of Henle - descending
    const loopD = toCanvas(pp.loopDesc.x, pp.loopDesc.y);
    ctx.beginPath();
    ctx.moveTo(pctE.x, pctE.y);
    ctx.quadraticCurveTo(pctE.x + 20, loopD.y, loopD.x, loopD.y);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Loop of Henle - bend
    const loopB = toCanvas(pp.loopBend.x, pp.loopBend.y);
    ctx.beginPath();
    ctx.moveTo(loopD.x, loopD.y);
    ctx.quadraticCurveTo((loopD.x + loopB.x) / 2, loopD.y + 20, loopB.x, loopB.y);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Loop of Henle - ascending
    const loopA = toCanvas(pp.loopAsc.x, pp.loopAsc.y);
    ctx.beginPath();
    ctx.moveTo(loopB.x, loopB.y);
    ctx.quadraticCurveTo(loopB.x - 20, (loopB.y + loopA.y) / 2, loopA.x, loopA.y);
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 6;
    ctx.stroke();

    // DCT (Distal Convoluted Tubule)
    const dctS = toCanvas(pp.dctStart.x, pp.dctStart.y);
    const dctE = toCanvas(pp.dctEnd.x, pp.dctEnd.y);
    ctx.beginPath();
    ctx.moveTo(dctS.x, dctS.y);
    const dctSteps = 15;
    for (let i = 1; i <= dctSteps; i++) {
      const lt = i / dctSteps;
      const x = dctS.x + (dctE.x - dctS.x) * lt;
      const y = dctS.y + (dctE.y - dctS.y) * lt + Math.sin(lt * Math.PI * 5) * 6;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Collecting duct
    const cd = toCanvas(pp.collectDuct.x, pp.collectDuct.y);
    ctx.beginPath();
    ctx.moveTo(dctE.x, dctE.y);
    ctx.lineTo(cd.x, cd.y);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Labels
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";

    ctx.fillStyle = "#ef4444";
    ctx.fillText("Glomerulus", glom.x, glom.y - 50);

    ctx.fillStyle = "#60a5fa";
    ctx.fillText("Bowman's Capsule", glom.x, glom.y + 55);

    ctx.fillStyle = "#fbbf24";
    ctx.fillText("PCT", (pctS.x + pctE.x) / 2, pctS.y - 15);

    ctx.fillStyle = "#a78bfa";
    ctx.fillText("Loop of Henle", (loopD.x + loopB.x) / 2, loopB.y + 20);

    ctx.fillStyle = "#22c55e";
    ctx.fillText("DCT", (dctS.x + dctE.x) / 2, dctS.y - 12);

    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Collecting Duct", cd.x, cd.y + 15);

    // Afferent/efferent arterioles
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(glom.x - 60, glom.y - 30);
    ctx.lineTo(glom.x - 30, glom.y);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Afferent arteriole", glom.x - 62, glom.y - 32);

    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(glom.x + 30, glom.y);
    ctx.lineTo(glom.x + 60, glom.y - 30);
    ctx.stroke();
    ctx.fillStyle = "#dc2626";
    ctx.textAlign = "left";
    ctx.fillText("Efferent arteriole", glom.x + 62, glom.y - 32);
  }

  function drawParticles(): void {
    for (const p of particles) {
      let color = "#ef4444";
      let size = 3;

      switch (p.type) {
        case "blood": color = "#ef4444"; size = 3; break;
        case "filtrate": color = "#fbbf24"; size = 2.5; break;
        case "water": color = "#3b82f6"; size = 2; break;
        case "sodium": color = "#22c55e"; size = 2; break;
        case "urine": color = "#a78bfa"; size = 2.5; break;
        case "glucose": color = "#f97316"; size = 2; break;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawInfoPanel(): void {
    const panelX = width - 240;
    const panelY = height * 0.5;
    const panelW = 225;
    const panelH = 180;

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Nephron Function", panelX + 10, panelY + 20);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    let y = panelY + 38;
    const lineH = 16;

    ctx.fillText(`Blood Pressure: ${bloodPressure} mmHg`, panelX + 10, y); y += lineH;

    const gfr = (bloodPressure / 70) * 125;
    ctx.fillText(`GFR: ~${gfr.toFixed(0)} mL/min`, panelX + 10, y); y += lineH;

    ctx.fillText(`Water Reabsorption: ${waterReabsorption}%`, panelX + 10, y); y += lineH;
    ctx.fillText(`Na⁺ Reabsorption: ${sodiumReabsorption}%`, panelX + 10, y); y += lineH;

    const urineVol = 180 * (1 - waterReabsorption / 100);
    ctx.fillText(`Est. Urine Output: ~${urineVol.toFixed(0)} L/day`, panelX + 10, y); y += lineH;

    y += 5;
    ctx.fillStyle = "#64748b";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("PCT: 65% water, glucose, Na⁺", panelX + 10, y); y += 13;
    ctx.fillText("Loop: Concentrating mechanism", panelX + 10, y); y += 13;
    ctx.fillText("DCT: Fine-tuning, K⁺ secretion", panelX + 10, y); y += 13;
    ctx.fillText("CD: ADH-regulated water reabsorption", panelX + 10, y);
  }

  function render(): void {
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Nephron — Functional Unit of the Kidney", width / 2, 28);

    drawNephronStructure();
    drawParticles();
    drawInfoPanel();

    // Process legend
    const legX = 15;
    const legY = height - 60;
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";

    const legend = [
      { color: "#ef4444", label: "Blood" },
      { color: "#fbbf24", label: "Filtrate" },
      { color: "#3b82f6", label: "Reabsorbed Water" },
      { color: "#22c55e", label: "Na⁺ / Solutes" },
    ];

    for (let i = 0; i < legend.length; i++) {
      const x = legX + i * 140;
      ctx.fillStyle = legend[i].color;
      ctx.beginPath();
      ctx.arc(x + 5, legY + 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(legend[i].label, x + 14, legY + 7);
    }
  }

  function reset(): void {
    time = 0;
    particles = [];
  }

  function destroy(): void {
    particles = [];
  }

  function getStateDescription(): string {
    const gfr = (bloodPressure / 70) * 125;
    const urineVol = 180 * (1 - waterReabsorption / 100);
    return (
      `Nephron Simulation: Blood pressure=${bloodPressure} mmHg, GFR≈${gfr.toFixed(0)} mL/min. ` +
      `Water reabsorption=${waterReabsorption}%, Na⁺ reabsorption=${sodiumReabsorption}%. ` +
      `Estimated urine output≈${urineVol.toFixed(0)} L/day. ` +
      `Shows glomerular filtration, tubular reabsorption in PCT/Loop of Henle/DCT, ` +
      `and urine concentration in the collecting duct.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default NephronFactory;
