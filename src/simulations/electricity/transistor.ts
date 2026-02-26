import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TransistorFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("transistor") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let baseCurrent = 50; // uA
  let beta = 100;
  let vcc = 5;
  let loadResistance = 1000;

  const carriers: Array<{ path: string; progress: number; speed: number }> = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    carriers.length = 0;
  }

  function getIC(): number {
    const icMax = ((vcc - 0.2) / loadResistance) * 1e6;
    return Math.min(beta * baseCurrent, icMax);
  }

  function getVCE(): number {
    return Math.max(0.2, vcc - (getIC() / 1e6) * loadResistance);
  }

  function getMode(): string {
    if (baseCurrent === 0) return "Cutoff";
    if (getVCE() <= 0.3) return "Saturation";
    return "Active";
  }

  function update(dt: number, params: Record<string, number>): void {
    baseCurrent = params.baseCurrent ?? 50;
    beta = params.beta ?? 100;
    vcc = params.vcc ?? 5;
    loadResistance = params.loadResistance ?? 1000;
    time += dt;
    const ic = getIC();
    const rate = baseCurrent > 0 ? 0.02 + (ic / 5000) * 0.3 : 0;
    if (Math.random() < rate) carriers.push({ path: "base", progress: 0, speed: 0.4 + Math.random() * 0.3 });
    if (Math.random() < rate * beta * 0.01) carriers.push({ path: "collector", progress: 0, speed: 0.5 + Math.random() * 0.4 });
    for (let i = carriers.length - 1; i >= 0; i--) {
      carriers[i].progress += carriers[i].speed * dt;
      if (carriers[i].progress > 1) carriers.splice(i, 1);
    }
    if (carriers.length > 150) carriers.splice(0, carriers.length - 150);
  }

  function drawTransistorSymbol(cx: number, cy: number, s: number): void {
    // Base line
    ctx.beginPath(); ctx.moveTo(cx - 40 * s, cy); ctx.lineTo(cx - 10 * s, cy);
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    // Vertical bar
    ctx.beginPath(); ctx.moveTo(cx - 10 * s, cy - 25 * s); ctx.lineTo(cx - 10 * s, cy + 25 * s);
    ctx.strokeStyle = "#ccc"; ctx.lineWidth = 3; ctx.stroke();
    // Collector
    ctx.beginPath(); ctx.moveTo(cx - 10 * s, cy - 12 * s); ctx.lineTo(cx + 25 * s, cy - 35 * s);
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    // Emitter
    ctx.beginPath(); ctx.moveTo(cx - 10 * s, cy + 12 * s); ctx.lineTo(cx + 25 * s, cy + 35 * s);
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    // Emitter arrow
    const ax = cx + 18 * s, ay = cy + 28 * s;
    ctx.beginPath(); ctx.moveTo(ax + 7 * s, ay + 7 * s); ctx.lineTo(ax - 1 * s, ay + 5 * s);
    ctx.lineTo(ax + 3 * s, ay - 1 * s); ctx.closePath(); ctx.fillStyle = "#aaa"; ctx.fill();
    // Circle
    ctx.beginPath(); ctx.arc(cx + 5 * s, cy, 35 * s, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
    // Labels
    ctx.fillStyle = "#ffcc44"; ctx.font = `bold ${12 * s}px system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.fillText("B", cx - 45 * s, cy + 4);
    ctx.fillText("C", cx + 30 * s, cy - 38 * s);
    ctx.fillText("E", cx + 30 * s, cy + 45 * s);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; ctx.font = `${10 * s}px system-ui, sans-serif`;
    ctx.fillText("NPN", cx + 5 * s, cy + 55 * s);
  }

  function drawNPNStructure(sx: number, sy: number, sw: number, sh: number): void {
    const rH = sh / 3;
    const bH = rH * 0.6;
    // N-collector
    ctx.fillStyle = "rgba(80, 130, 255, 0.4)"; ctx.fillRect(sx, sy, sw, rH);
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("N (Collector)", sx + sw / 2, sy + rH / 2 + 4);
    // P-base
    ctx.fillStyle = "rgba(255, 100, 100, 0.4)"; ctx.fillRect(sx, sy + rH, sw, bH);
    ctx.fillStyle = "#ff8888"; ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("P (Base)", sx + sw / 2, sy + rH + bH / 2 + 4);
    // N-emitter
    ctx.fillStyle = "rgba(80, 130, 255, 0.4)"; ctx.fillRect(sx, sy + rH + bH, sw, sh - rH - bH);
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("N (Emitter)", sx + sw / 2, sy + rH + bH + (sh - rH - bH) / 2 + 4);
    // Borders
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.beginPath(); ctx.moveTo(sx, sy + rH); ctx.lineTo(sx + sw, sy + rH);
    ctx.moveTo(sx, sy + rH + bH); ctx.lineTo(sx + sw, sy + rH + bH); ctx.stroke();
    // Carriers
    for (const c of carriers) {
      if (c.path === "collector") {
        const cx2 = sx + sw * 0.3 + Math.sin(c.progress * 5) * 10;
        ctx.beginPath(); ctx.arc(cx2, sy + c.progress * sh, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100, 200, 255, 0.8)"; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(sx + sw + 13, sy + rH + bH * (1 - c.progress), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 150, 100, 0.8)"; ctx.fill();
      }
    }
  }

  function drawIVCurve(gx: number, gy: number, gw: number, gh: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.strokeStyle = "rgba(80, 150, 255, 0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("IC vs VCE Characteristic", gx + 12, gy + 20);
    const pX = gx + 40, pY = gy + 35, pW = gw - 60, pH = gh - 60;
    ctx.beginPath(); ctx.moveTo(pX, pY); ctx.lineTo(pX, pY + pH); ctx.lineTo(pX + pW, pY + pH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("VCE (V)", pX + pW / 2, pY + pH + 18);
    ctx.save(); ctx.translate(pX - 25, pY + pH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("IC (mA)", 0, 0); ctx.restore();
    const maxVce = vcc, maxIc = (vcc / loadResistance) * 1000;
    const ibVals = [25, 50, 100, 150, 200];
    for (const ib of ibVals) {
      const icSat = (beta * ib) / 1000;
      const active = Math.abs(ib - baseCurrent) < 15;
      ctx.beginPath();
      for (let v = 0; v <= maxVce; v += 0.1) {
        let ic = v < 0.3 ? icSat * (v / 0.3) : icSat * (1 + 0.02 * (v - 0.3));
        ic = Math.min(ic, maxIc);
        const px = pX + (v / maxVce) * pW, py = pY + pH - (ic / maxIc) * pH;
        if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = active ? "#66ddff" : "rgba(100, 200, 255, 0.3)"; ctx.lineWidth = active ? 2 : 1; ctx.stroke();
      if (icSat < maxIc) {
        ctx.fillStyle = `rgba(100, 200, 255, ${active ? 1 : 0.3})`; ctx.font = "9px system-ui, sans-serif"; ctx.textAlign = "left";
        ctx.fillText(`IB=${ib}\u03BCA`, pX + pW + 3, pY + pH - (icSat / maxIc) * pH + 3);
      }
    }
    // Operating point
    const vce = getVCE(), ic = getIC() / 1000;
    const opX = pX + (vce / maxVce) * pW, opY = pY + pH - (ic / maxIc) * pH;
    ctx.beginPath(); ctx.arc(opX, opY, 5, 0, Math.PI * 2); ctx.fillStyle = "#ff4444"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
    // Load line
    ctx.beginPath(); ctx.moveTo(pX + (vcc / maxVce) * pW, pY + pH); ctx.lineTo(pX, pY);
    ctx.strokeStyle = "rgba(255, 200, 50, 0.4)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  }

  function renderInfoPanel(): void {
    const px = width * 0.65, py = 15, pw = width * 0.33, ph = height * 0.45;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.strokeStyle = "rgba(80, 150, 255, 0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill(); ctx.stroke();
    const ic = getIC(), ie = ic + baseCurrent, vce = getVCE(), mode = getMode();
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "left";
    let y = py + 24; const lh = 20;
    ctx.fillText("BJT NPN Transistor", px + 12, y); y += lh + 4;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("IC = \u03B2 \u00B7 IB", px + 12, y); y += lh;
    ctx.fillText("IE = IC + IB", px + 12, y); y += lh;
    ctx.fillText("VBE \u2248 0.7V (Si)", px + 12, y); y += lh + 6;
    ctx.fillStyle = "#ffcc44"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`\u03B2 = ${beta}`, px + 12, y); y += lh;
    ctx.fillText(`IB = ${baseCurrent} \u03BCA`, px + 12, y); y += lh;
    ctx.fillText(`IC = ${(ic / 1000).toFixed(2)} mA`, px + 12, y); y += lh;
    ctx.fillText(`IE = ${(ie / 1000).toFixed(2)} mA`, px + 12, y); y += lh;
    ctx.fillText(`VCE = ${vce.toFixed(2)} V`, px + 12, y); y += lh;
    ctx.fillText(`VCC = ${vcc} V, RL = ${loadResistance} \u03A9`, px + 12, y); y += lh + 4;
    const mc = mode === "Cutoff" ? "#ff4444" : mode === "Saturation" ? "#44ff44" : "#44aaff";
    ctx.fillStyle = mc; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`Mode: ${mode}`, px + 12, y);
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1e"); bgGrad.addColorStop(1, "#0e1225");
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, width, height);
    drawTransistorSymbol(width * 0.15, height * 0.28, 1.2);
    drawNPNStructure(width * 0.32, height * 0.08, width * 0.15, height * 0.4);
    // Current labels
    const ic = getIC();
    if (baseCurrent > 0) {
      const a = Math.min(1, ic / 3000);
      ctx.fillStyle = `rgba(100, 200, 255, ${a})`; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`IC = ${(ic / 1000).toFixed(1)} mA`, width * 0.39, height * 0.04);
    }
    drawIVCurve(width * 0.02, height * 0.52, width * 0.55, height * 0.45);
    renderInfoPanel();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; carriers.length = 0; }
  function destroy(): void { carriers.length = 0; }

  function getStateDescription(): string {
    const ic = getIC(), ie = ic + baseCurrent, vce = getVCE(), mode = getMode();
    return `BJT NPN: \u03B2=${beta}, IB=${baseCurrent}\u03BCA, IC=${(ic / 1000).toFixed(2)}mA, ` +
      `IE=${(ie / 1000).toFixed(2)}mA, VCE=${vce.toFixed(2)}V. Mode: ${mode}.`;
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TransistorFactory;
