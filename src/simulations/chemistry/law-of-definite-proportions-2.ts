import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const LawOfDefiniteProportions2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("law-of-definite-proportions-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let pourRate = 5;
  let numVessels = 4;

  // Reaction: Pb(NO3)2 + 2KI -> PbI2 + 2KNO3
  // Each vessel starts with a fixed amount of KI, user pours Pb(NO3)2
  interface Vessel {
    kiMoles: number; // initial moles of KI
    pbMolesAdded: number; // moles of Pb(NO3)2 poured in
    productMoles: number; // moles of PbI2 formed
    excessPb: number; // excess Pb(NO3)2 unreacted
    pouring: boolean;
    pourAnim: number;
  }

  let vessels: Vessel[] = [];
  let selectedVessel = 0;
  let autoPouring = false;

  function initVessels() {
    vessels = [];
    const count = Math.round(numVessels);
    for (let i = 0; i < count; i++) {
      vessels.push({
        kiMoles: 2.0, // 2 moles KI per vessel
        pbMolesAdded: 0,
        productMoles: 0,
        excessPb: 0,
        pouring: false,
        pourAnim: 0,
      });
    }
    selectedVessel = 0;
    time = 0;
  }

  function react(v: Vessel) {
    // Stoichiometry: 1 Pb(NO3)2 + 2 KI -> 1 PbI2 + 2 KNO3
    const kiAvailable = v.kiMoles;
    const pbAvailable = v.pbMolesAdded;
    // Limiting reagent calculation
    const pbNeeded = kiAvailable / 2; // 1 mol Pb needs 2 mol KI
    if (pbAvailable <= pbNeeded) {
      // Pb is limiting
      v.productMoles = pbAvailable;
      v.excessPb = 0;
    } else {
      // KI is limiting
      v.productMoles = pbNeeded;
      v.excessPb = pbAvailable - pbNeeded;
    }
  }

  function vesselBounds(index: number) {
    const count = vessels.length;
    const totalW = W - 80;
    const vw = Math.min(150, totalW / count - 10);
    const gap = (totalW - vw * count) / (count + 1);
    const left = 40 + gap + index * (vw + gap);
    const top = 200;
    const height = 250;
    return { left, top, width: vw, height, right: left + vw, bottom: top + height };
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    initVessels();
  }

  function update(dt: number, params: Record<string, number>) {
    const newRate = params.pourRate ?? 5;
    const newCount = Math.round(params.numVessels ?? 4);

    if (newCount !== vessels.length) {
      numVessels = newCount;
      initVessels();
    }
    pourRate = newRate;

    const dtClamped = Math.min(dt, 0.05);
    time += dtClamped;

    // Auto-pour into selected vessel
    if (autoPouring && selectedVessel < vessels.length) {
      const v = vessels[selectedVessel];
      const amount = pourRate * 0.1 * dtClamped;
      v.pbMolesAdded += amount;
      v.pouring = true;
      v.pourAnim = Math.min(v.pourAnim + dtClamped * 3, 1);
      react(v);

      // Auto-advance to next vessel when saturated
      if (v.pbMolesAdded >= v.kiMoles * 0.5 + 1.5) {
        v.pouring = false;
        selectedVessel++;
        if (selectedVessel >= vessels.length) {
          autoPouring = false;
        }
      }
    } else {
      for (const v of vessels) {
        v.pouring = false;
        v.pourAnim = Math.max(v.pourAnim - dtClamped * 2, 0);
      }
    }

    // Keep auto-pouring active
    if (!autoPouring && selectedVessel < vessels.length) {
      autoPouring = true;
    }
  }

  function drawVessel(v: Vessel, bounds: ReturnType<typeof vesselBounds>, index: number) {
    const { left, top, width: vw, height: vh, bottom } = bounds;

    // Beaker outline
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(left + vw, bottom);
    ctx.lineTo(left + vw, top);
    ctx.stroke();

    // KI solution (light blue, decreasing as reacted)
    const kiRemaining = Math.max(0, v.kiMoles - v.productMoles * 2);
    const kiFrac = kiRemaining / v.kiMoles;
    const solutionH = vh * 0.7;
    const kiH = solutionH * kiFrac * 0.5;
    if (kiH > 1) {
      const kiTop = bottom - kiH - v.productMoles * 40;
      ctx.fillStyle = `rgba(56, 189, 248, ${0.3 + kiFrac * 0.4})`;
      ctx.fillRect(left + 2, kiTop, vw - 4, kiH);
    }

    // PbI2 sediment (yellow) at the bottom
    const maxProduct = v.kiMoles / 2;
    const productFrac = Math.min(v.productMoles / maxProduct, 1);
    const sedimentH = productFrac * vh * 0.35;
    if (sedimentH > 1) {
      const sedGrad = ctx.createLinearGradient(0, bottom - sedimentH, 0, bottom);
      sedGrad.addColorStop(0, "#fbbf24");
      sedGrad.addColorStop(1, "#d97706");
      ctx.fillStyle = sedGrad;
      ctx.fillRect(left + 2, bottom - sedimentH, vw - 4, sedimentH - 2);
    }

    // Excess Pb(NO3)2 solution (clear/light gray) on top
    if (v.excessPb > 0) {
      const excessH = Math.min(v.excessPb * 20, vh * 0.2);
      ctx.fillStyle = "rgba(148, 163, 184, 0.2)";
      ctx.fillRect(left + 2, bottom - sedimentH - excessH, vw - 4, excessH);
    }

    // Pouring animation
    if (v.pourAnim > 0) {
      const pourX = left + vw / 2;
      const pourTop = top - 60;
      ctx.strokeStyle = `rgba(148, 163, 184, ${v.pourAnim * 0.8})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pourX, pourTop);
      ctx.lineTo(pourX, top + 5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Drops
      for (let d = 0; d < 3; d++) {
        const dy = pourTop + ((time * 80 + d * 30) % (top - pourTop + 60));
        if (dy < top) {
          ctx.beginPath();
          ctx.arc(pourX + (Math.sin(d * 2) * 3), dy, 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
          ctx.fill();
        }
      }
    }

    // Labels under vessel
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText(`Vessel ${index + 1}`, left + vw / 2, bottom + 18);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Pb: ${v.pbMolesAdded.toFixed(2)} mol`, left + vw / 2, bottom + 32);
    ctx.fillText(`PbI₂: ${v.productMoles.toFixed(2)} mol`, left + vw / 2, bottom + 44);

    // Highlight selected
    if (index === selectedVessel && autoPouring) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(left - 3, top - 3, vw + 6, vh + 6);
      ctx.setLineDash([]);
    }
  }

  function render() {
    if (!ctx) return;

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("Law of Definite Proportions", W / 2, 30);

    // Equation
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃", W / 2, 52);

    // Explanation
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Each vessel has 2.0 mol KI. Pb(NO₃)₂ is added. PbI₂ (yellow) forms until KI is consumed.", W / 2, 72);

    // Draw graph area (top right)
    const graphL = W - 260;
    const graphT = 85;
    const graphW = 240;
    const graphH = 100;

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(graphL, graphT, graphW, graphH);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphL, graphT, graphW, graphH);

    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("PbI₂ Product vs Pb(NO₃)₂ Added", graphL + graphW / 2, graphT + 12);

    // Graph axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphL + 30, graphT + 20);
    ctx.lineTo(graphL + 30, graphT + graphH - 15);
    ctx.lineTo(graphL + graphW - 10, graphT + graphH - 15);
    ctx.stroke();

    // Axis labels
    ctx.font = "8px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText("Pb(NO₃)₂ added (mol)", graphL + graphW / 2, graphT + graphH - 3);
    ctx.save();
    ctx.translate(graphL + 10, graphT + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("PbI₂ (mol)", 0, 0);
    ctx.restore();

    // Plot data for each vessel
    const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899"];
    const plotL = graphL + 30;
    const plotR = graphL + graphW - 10;
    const plotT = graphT + 20;
    const plotB = graphT + graphH - 15;
    const maxPb = 3;
    const maxProd = 1.5;

    for (let i = 0; i < vessels.length; i++) {
      const v = vessels[i];
      const color = colors[i % colors.length];

      // Draw theoretical line (rises linearly then plateaus)
      ctx.beginPath();
      ctx.strokeStyle = color + "60";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      for (let s = 0; s <= 30; s++) {
        const pb = (s / 30) * maxPb;
        const prod = Math.min(pb, v.kiMoles / 2);
        const px = plotL + (pb / maxPb) * (plotR - plotL);
        const py = plotB - (prod / maxProd) * (plotB - plotT);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Plot actual data point
      const px = plotL + (v.pbMolesAdded / maxPb) * (plotR - plotL);
      const py = plotB - (v.productMoles / maxProd) * (plotB - plotT);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Draw vessels
    for (let i = 0; i < vessels.length; i++) {
      const bounds = vesselBounds(i);
      drawVessel(vessels[i], bounds, i);
    }

    // Legend
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    const legX = 20;
    let legY = 95;
    const items = [
      { color: "rgba(56, 189, 248, 0.6)", label: "KI solution" },
      { color: "#fbbf24", label: "PbI₂ precipitate" },
      { color: "rgba(148, 163, 184, 0.3)", label: "Excess Pb(NO₃)₂" },
    ];
    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillRect(legX, legY - 8, 12, 12);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(item.label, legX + 18, legY + 2);
      legY += 18;
    }

    // Summary
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText(
      "The mass ratio of reactants is always constant — once the limiting reagent is consumed, no more product forms.",
      W / 2,
      H - 15
    );
  }

  function reset() {
    initVessels();
  }

  function destroy() {
    vessels = [];
  }

  function getStateDescription(): string {
    const descs = vessels.map((v, i) =>
      `Vessel ${i + 1}: ${v.pbMolesAdded.toFixed(2)} mol Pb(NO₃)₂ added, ${v.productMoles.toFixed(2)} mol PbI₂ formed, ${v.excessPb.toFixed(2)} mol excess`
    ).join(". ");
    return (
      `Law of Definite Proportions: Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃. ` +
      `Each vessel starts with 2.0 mol KI. Pour rate: ${pourRate}x. ${descs}. ` +
      `Key concept: the ratio of Pb to KI is always 1:2 regardless of amounts mixed.`
    );
  }

  function resize(w: number, h: number) {
    W = w;
    H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default LawOfDefiniteProportions2Factory;
