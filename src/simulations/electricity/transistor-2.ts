import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const Transistor2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("transistor-2") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let gateVoltage = 3;
  let drainVoltage = 5;
  let threshold = 1.5;
  let kFactor = 2;

  const electrons: Array<{ progress: number; speed: number }> = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    electrons.length = 0;
  }

  function getDrainCurrent(): number {
    if (gateVoltage < threshold) return 0;
    const vov = gateVoltage - threshold;
    if (drainVoltage < vov) return kFactor * (vov * drainVoltage - 0.5 * drainVoltage * drainVoltage);
    return 0.5 * kFactor * vov * vov;
  }

  function getRegion(): string {
    if (gateVoltage < threshold) return "Cutoff";
    return drainVoltage < gateVoltage - threshold ? "Linear (Ohmic)" : "Saturation";
  }

  function update(dt: number, params: Record<string, number>): void {
    gateVoltage = params.gateVoltage ?? 3;
    drainVoltage = params.drainVoltage ?? 5;
    threshold = params.threshold ?? 1.5;
    kFactor = params.kFactor ?? 2;
    time += dt;
    const id = getDrainCurrent();
    if (Math.random() < (id > 0 ? 0.05 + id * 0.015 : 0)) {
      electrons.push({ progress: 0, speed: 0.3 + Math.random() * 0.4 });
    }
    for (let i = electrons.length - 1; i >= 0; i--) {
      electrons[i].progress += electrons[i].speed * dt;
      if (electrons[i].progress > 1) electrons.splice(i, 1);
    }
    if (electrons.length > 120) electrons.splice(0, electrons.length - 120);
  }

  function drawMOSFETSymbol(cx: number, cy: number, s: number): void {
    ctx.beginPath(); ctx.moveTo(cx - 50 * s, cy); ctx.lineTo(cx - 20 * s, cy);
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 20 * s, cy - 25 * s); ctx.lineTo(cx - 20 * s, cy + 25 * s);
    ctx.strokeStyle = "#ccc"; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 14 * s, cy - 25 * s); ctx.lineTo(cx - 14 * s, cy + 25 * s);
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.setLineDash([4 * s, 3 * s]); ctx.stroke(); ctx.setLineDash([]);
    // Drain
    ctx.beginPath(); ctx.moveTo(cx - 14 * s, cy - 15 * s); ctx.lineTo(cx + 10 * s, cy - 15 * s);
    ctx.lineTo(cx + 10 * s, cy - 40 * s); ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    // Source
    ctx.beginPath(); ctx.moveTo(cx - 14 * s, cy + 15 * s); ctx.lineTo(cx + 10 * s, cy + 15 * s);
    ctx.lineTo(cx + 10 * s, cy + 40 * s); ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    // Body connection + arrow
    ctx.beginPath(); ctx.moveTo(cx - 14 * s, cy); ctx.lineTo(cx + 10 * s, cy);
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 4 * s, cy); ctx.lineTo(cx - 1 * s, cy - 4 * s);
    ctx.lineTo(cx - 1 * s, cy + 4 * s); ctx.closePath(); ctx.fillStyle = "#aaa"; ctx.fill();
    // Labels
    ctx.fillStyle = "#ffcc44"; ctx.font = `bold ${12 * s}px system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.fillText("G", cx - 55 * s, cy + 4);
    ctx.fillText("D", cx + 10 * s, cy - 44 * s);
    ctx.fillText("S", cx + 10 * s, cy + 52 * s);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; ctx.font = `${10 * s}px system-ui, sans-serif`;
    ctx.fillText("N-MOSFET", cx - 5 * s, cy + 65 * s);
  }

  function drawCrossSection(sx: number, sy: number, sw: number, sh: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; ctx.strokeStyle = "rgba(80, 150, 255, 0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("MOSFET Cross-Section", sx + 12, sy + 20);
    const pX = sx + 20, pY = sy + 35, pW = sw - 40, pH = sh - 50;
    // Substrate
    ctx.fillStyle = "rgba(200, 100, 100, 0.25)"; ctx.fillRect(pX, pY + pH * 0.4, pW, pH * 0.6);
    ctx.fillStyle = "rgba(255, 150, 150, 0.6)"; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("P-type Substrate", pX + pW / 2, pY + pH * 0.85);
    // Source
    ctx.fillStyle = "rgba(80, 130, 255, 0.4)"; ctx.fillRect(pX + 5, pY + pH * 0.4, pW * 0.2, pH * 0.25);
    ctx.fillStyle = "#88bbff"; ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("N+ Source", pX + 5 + pW * 0.1, pY + pH * 0.55);
    // Drain
    ctx.fillStyle = "rgba(80, 130, 255, 0.4)"; ctx.fillRect(pX + pW * 0.75, pY + pH * 0.4, pW * 0.2, pH * 0.25);
    ctx.fillStyle = "#88bbff"; ctx.fillText("N+ Drain", pX + pW * 0.85, pY + pH * 0.55);
    // Oxide
    ctx.fillStyle = "rgba(255, 220, 100, 0.3)"; ctx.fillRect(pX + pW * 0.25, pY + pH * 0.32, pW * 0.5, pH * 0.08);
    ctx.fillStyle = "rgba(255, 220, 100, 0.7)"; ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("SiO\u2082 (Oxide)", pX + pW / 2, pY + pH * 0.38);
    // Metal gate
    ctx.fillStyle = "rgba(180, 180, 220, 0.5)"; ctx.fillRect(pX + pW * 0.28, pY + pH * 0.2, pW * 0.44, pH * 0.12);
    ctx.fillStyle = "#ccccee"; ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Metal Gate", pX + pW / 2, pY + pH * 0.29);
    // Channel
    if (gateVoltage >= threshold) {
      const a = Math.min(0.6, (gateVoltage - threshold) / 3);
      ctx.fillStyle = `rgba(100, 200, 255, ${a})`;
      ctx.fillRect(pX + pW * 0.25, pY + pH * 0.4, pW * 0.5, pH * 0.05);
      ctx.fillStyle = `rgba(100, 200, 255, ${a + 0.2})`; ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("Inversion Layer", pX + pW / 2, pY + pH * 0.48);
      for (const e of electrons) {
        const ex = pX + pW * 0.25 + e.progress * pW * 0.5;
        const ey = pY + pH * 0.42 + Math.sin(e.progress * 10 + time * 3) * 2;
        ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(150, 220, 255, 0.8)"; ctx.fill();
      }
    } else {
      ctx.fillStyle = "rgba(255, 100, 100, 0.4)"; ctx.font = "9px system-ui, sans-serif";
      ctx.fillText("No Channel (VGS < Vth)", pX + pW / 2, pY + pH * 0.48);
    }
    // Contacts
    ctx.fillStyle = "rgba(200, 200, 200, 0.6)";
    ctx.fillRect(pX + pW * 0.05, pY + pH * 0.32, pW * 0.1, pH * 0.08);
    ctx.fillRect(pX + pW * 0.85, pY + pH * 0.32, pW * 0.1, pH * 0.08);
  }

  function drawDrainChars(gx: number, gy: number, gw: number, gh: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.strokeStyle = "rgba(80, 150, 255, 0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("ID vs VDS Characteristics", gx + 12, gy + 20);
    const pX = gx + 45, pY = gy + 35, pW = gw - 65, pH = gh - 60;
    ctx.beginPath(); ctx.moveTo(pX, pY); ctx.lineTo(pX, pY + pH); ctx.lineTo(pX + pW, pY + pH);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; ctx.font = "10px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillText("VDS (V)", pX + pW / 2, pY + pH + 18);
    ctx.save(); ctx.translate(pX - 30, pY + pH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("ID (mA)", 0, 0); ctx.restore();
    const maxVds = 12;
    let maxId = 0;
    const vgsVals = [2, 3, 4, 5, 6];
    for (const v of vgsVals) { if (v > threshold) maxId = Math.max(maxId, 0.5 * kFactor * (v - threshold) ** 2); }
    maxId = Math.max(maxId * 1.2, 1);
    for (const vgs of vgsVals) {
      if (vgs <= threshold) continue;
      const vov = vgs - threshold;
      const act = Math.abs(vgs - gateVoltage) < 0.3;
      ctx.beginPath();
      for (let vds = 0; vds <= maxVds; vds += 0.1) {
        const id = vds < vov ? kFactor * (vov * vds - 0.5 * vds * vds) : 0.5 * kFactor * vov * vov * (1 + 0.01 * (vds - vov));
        const px = pX + (vds / maxVds) * pW, py = pY + pH - (id / maxId) * pH;
        if (vds === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = act ? "#66ddff" : "rgba(100, 180, 255, 0.3)"; ctx.lineWidth = act ? 2.5 : 1; ctx.stroke();
      const lId = 0.5 * kFactor * vov * vov;
      ctx.fillStyle = act ? "#66ddff" : "rgba(100, 180, 255, 0.3)"; ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left"; ctx.fillText(`VGS=${vgs}V`, pX + pW + 3, pY + pH - (lId / maxId) * pH + 3);
    }
    // Operating point
    const id = getDrainCurrent();
    if (id > 0) {
      const ox = pX + (drainVoltage / maxVds) * pW, oy = pY + pH - (id / maxId) * pH;
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4444"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
    }
    // Saturation boundary
    ctx.beginPath();
    for (let vds = 0; vds <= maxVds; vds += 0.2) {
      if (vds + threshold > 6) break;
      const px = pX + (vds / maxVds) * pW, py = pY + pH - (0.5 * kFactor * vds * vds / maxId) * pH;
      if (vds === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "rgba(255, 200, 50, 0.4)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  }

  function renderInfoPanel(): void {
    const px = width * 0.02, py = height * 0.55, pw = width * 0.44, ph = height * 0.43;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.strokeStyle = "rgba(80, 150, 255, 0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill(); ctx.stroke();
    const id = getDrainCurrent(), region = getRegion();
    ctx.fillStyle = "#88bbff"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "left";
    let y = py + 24; const lh = 19;
    ctx.fillText("N-Channel Enhancement MOSFET", px + 12, y); y += lh + 4;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Sat: ID = \u00BDk(VGS - Vth)\u00B2", px + 12, y); y += lh;
    ctx.fillText("Lin: ID = k[(VGS-Vth)VDS - \u00BDVDS\u00B2]", px + 12, y); y += lh + 6;
    ctx.fillStyle = "#ffcc44"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`VGS = ${gateVoltage.toFixed(1)} V`, px + 12, y); y += lh;
    ctx.fillText(`VDS = ${drainVoltage.toFixed(1)} V`, px + 12, y); y += lh;
    ctx.fillText(`Vth = ${threshold.toFixed(1)} V`, px + 12, y); y += lh;
    ctx.fillText(`k = ${kFactor.toFixed(1)} mA/V\u00B2`, px + 12, y); y += lh;
    ctx.fillText(`ID = ${id.toFixed(2)} mA`, px + 12, y); y += lh + 4;
    const rc = region === "Cutoff" ? "#ff4444" : region === "Saturation" ? "#44aaff" : "#44ff88";
    ctx.fillStyle = rc; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(`Region: ${region}`, px + 12, y); y += lh + 4;
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)"; ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("vs BJT: voltage-controlled, high input Z", px + 12, y);
  }

  function render(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#080a1e"); bgGrad.addColorStop(1, "#0c1028");
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, width, height);
    drawMOSFETSymbol(width * 0.12, height * 0.22, 1.1);
    drawCrossSection(width * 0.26, height * 0.02, width * 0.38, height * 0.5);
    drawDrainChars(width * 0.52, height * 0.55, width * 0.46, height * 0.43);
    renderInfoPanel();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 12, height - 12);
  }

  function reset(): void { time = 0; electrons.length = 0; }
  function destroy(): void { electrons.length = 0; }

  function getStateDescription(): string {
    const id = getDrainCurrent(), region = getRegion();
    return `MOSFET: VGS=${gateVoltage.toFixed(1)}V, VDS=${drainVoltage.toFixed(1)}V, Vth=${threshold.toFixed(1)}V, ` +
      `k=${kFactor.toFixed(1)}mA/V\u00B2, ID=${id.toFixed(2)}mA. Region: ${region}.`;
  }

  function resize(w: number, h: number): void { width = w; height = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Transistor2Factory;
