import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectricPotential2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electric-potential-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0, H = 0, time = 0;

  let voltage = 50, plateSep = 5, showField = 1, chargePos = 50;
  let eField = 0, vAtCharge = 0, workDone = 0;

  // Layout (recalculated on resize)
  let pL = 0, pR = 0, pT = 0, pB = 0, pW = 8;
  let gX = 0, gY = 0, gW = 0, gH = 0;

  function layout(): void {
    const mw = W * 0.62;
    pL = mw * 0.12;
    pR = pL + mw * 0.15 + plateSep * mw * 0.06;
    pT = H * 0.12; pB = H * 0.78;
    gX = W * 0.68; gY = H * 0.12; gW = W * 0.28; gH = H * 0.66;
  }

  function physics(): void {
    eField = voltage / (plateSep / 100);
    const f = chargePos / 100;
    vAtCharge = voltage * (1 - f);
    workDone = 1.6e-19 * (voltage - vAtCharge);
  }

  function drawBackground(): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#08081a"); g.addColorStop(1, "#0e1028");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawPotentialGradient(): void {
    const left = pL + pW, right = pR - pW, gap = right - left;
    if (gap <= 0) return;
    const n = Math.max(1, Math.floor(gap / 2));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const r = Math.floor(180 * (1 - t) + 30 * t);
      const g = Math.floor(40 + 20 * Math.sin(t * Math.PI));
      const b = Math.floor(30 * (1 - t) + 180 * t);
      ctx.fillStyle = `rgba(${r},${g},${b},0.12)`;
      ctx.fillRect(left + t * gap, pT, gap / n + 1, pB - pT);
    }
  }

  function drawPlate(x: number, positive: boolean): void {
    const col = positive ? [239, 68, 68] : [59, 130, 246];
    const grad = ctx.createLinearGradient(x - 4, 0, x + pW + 4, 0);
    grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.3)`);
    grad.addColorStop(0.5, `rgba(${col[0]},${col[1]},${col[2]},0.9)`);
    grad.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0.3)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, pT, pW, pB - pT);
    // Glow
    const glow = ctx.createRadialGradient(x + pW / 2, (pT + pB) / 2, 0, x + pW / 2, (pT + pB) / 2, 60);
    glow.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.15)`);
    glow.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(x - 60, pT - 20, 120 + pW, pB - pT + 40);
    // Charge symbols
    const pH = pB - pT, num = Math.floor(pH / 28);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = positive ? "rgba(255,150,150,0.9)" : "rgba(150,170,255,0.9)";
    for (let i = 0; i < num; i++) ctx.fillText(positive ? "+" : "\u2212", x + pW / 2, pT + (i + 0.5) * pH / num);
  }

  function drawPlates(): void {
    drawPlate(pL, true);
    drawPlate(pR - pW, false);
    // Voltage labels above plates
    ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,200,100,0.7)"; ctx.fillText(`${voltage}V`, pL + pW / 2, pT - 18);
    ctx.fillStyle = "rgba(100,180,255,0.7)"; ctx.fillText("0V", pR - pW / 2, pT - 18);
    // Labels below plates
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("+V", pL + pW / 2, pB + 6); ctx.fillText("0V", pR - pW / 2, pB + 6);
  }

  function drawEquipotentials(): void {
    const left = pL + pW, gap = pR - pW - left;
    if (gap <= 0) return;
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const t = i / 8, x = left + t * gap, v = voltage * (1 - t);
      const r = Math.floor(200 * (1 - t)), g = Math.floor(180 * Math.sin(t * Math.PI) + 40), b = Math.floor(200 * t);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.5)`;
      ctx.beginPath(); ctx.moveTo(x, pT + 4); ctx.lineTo(x, pB - 4); ctx.stroke();
      ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
      ctx.font = "9px 'SF Mono','Fira Code',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(`${v.toFixed(0)}V`, x, pT - 2);
    }
    ctx.setLineDash([]);
  }

  function drawFieldVectors(): void {
    if (!showField) return;
    const left = pL + pW + 10, right = pR - pW - 10, gap = right - left;
    if (gap <= 0) return;
    const rows = Math.max(3, Math.floor((pB - pT) / 50));
    const cols = Math.max(2, Math.floor(gap / 60));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = left + (c + 0.5) * gap / cols, y = pT + (r + 0.5) * (pB - pT) / rows;
        const len = Math.min(22, gap / cols * 0.6);
        ctx.strokeStyle = "rgba(100,220,255,0.35)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y); ctx.stroke();
        ctx.fillStyle = "rgba(100,220,255,0.45)"; ctx.beginPath();
        ctx.moveTo(x + len / 2 + 4, y); ctx.lineTo(x + len / 2 - 3, y - 4); ctx.lineTo(x + len / 2 - 3, y + 4);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(100,220,255,0.6)"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("E \u2192", (pL + pR) / 2, pT - 30);
  }

  function drawTestCharge(): void {
    const left = pL + pW, gap = pR - pW - left, f = chargePos / 100;
    const cx = left + f * gap, cy = (pT + pB) / 2;
    const glow = 0.5 + 0.3 * Math.sin(time * 3);
    // Glow ring
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    gr.addColorStop(0, `rgba(255,220,60,${glow * 0.5})`);
    gr.addColorStop(0.6, `rgba(255,180,30,${glow * 0.2})`); gr.addColorStop(1, "rgba(255,180,30,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill();
    // Body
    const bg = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, 10);
    bg.addColorStop(0, "#ffe066"); bg.addColorStop(1, "#cc9900");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#333"; ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("q+", cx, cy);
    // Info labels
    ctx.fillStyle = "rgba(255,220,100,0.85)"; ctx.font = "11px 'SF Mono','Fira Code',monospace";
    ctx.textBaseline = "top"; ctx.fillText(`V = ${vAtCharge.toFixed(1)}V`, cx, cy + 16);
    const wEv = workDone * 1e19;
    ctx.fillStyle = "rgba(180,255,180,0.7)"; ctx.font = "10px 'SF Mono','Fira Code',monospace";
    ctx.fillText(`W = q\u0394V = ${wEv.toFixed(2)} eV`, cx, cy + 30);
    // Distance indicator
    ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(255,220,100,0.25)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, cy + 44); ctx.lineTo(cx, cy + 44); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,220,100,0.6)"; ctx.font = "9px 'SF Mono','Fira Code',monospace";
    ctx.fillText(`d = ${(f * plateSep).toFixed(1)} cm`, (left + cx) / 2, cy + 50);
  }

  function drawSeparationBracket(): void {
    const left = pL + pW, right = pR - pW, by = pB + 22;
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, by - 4); ctx.lineTo(left, by + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(right, by - 4); ctx.lineTo(right, by + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left, by); ctx.lineTo(right, by); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "10px 'SF Mono','Fira Code',monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(`d = ${plateSep} cm`, (left + right) / 2, by + 6);
  }

  function drawVGraph(): void {
    // Background panel
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath();
    ctx.roundRect(gX - 6, gY - 24, gW + 12, gH + 50, 8); ctx.fill();
    // Title
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText("V vs Distance", gX + gW / 2, gY - 6);
    // Axes
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gX, gY); ctx.lineTo(gX, gY + gH); ctx.lineTo(gX + gW, gY + gH); ctx.stroke();
    // Y-axis label
    ctx.save(); ctx.translate(gX - 14, gY + gH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Potential (V)", 0, 0); ctx.restore();
    // X-axis label
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("Distance from + plate (cm)", gX + gW / 2, gY + gH + 8);
    // Grid and tick marks
    ctx.font = "9px 'SF Mono','Fira Code',monospace"; ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i <= 5; i++) {
      const yp = gY + gH - (i / 5) * gH;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(`${(voltage * i / 5).toFixed(0)}`, gX - 4, yp);
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gX, yp); ctx.lineTo(gX + gW, yp); ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(`${(plateSep * i / 5).toFixed(1)}`, gX + (i / 5) * gW, gY + gH + 2);
    }
    // Linear V line (V decreases from voltage to 0)
    ctx.strokeStyle = "rgba(100,255,200,0.15)"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(gX, gY); ctx.lineTo(gX + gW, gY + gH); ctx.stroke();
    ctx.strokeStyle = "rgba(100,255,200,0.8)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(gX, gY); ctx.lineTo(gX + gW, gY + gH); ctx.stroke();
    // Charge marker
    const f = chargePos / 100, mx = gX + f * gW, my = gY + f * gH;
    ctx.fillStyle = "rgba(255,220,60,0.9)"; ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,220,60,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(mx, my, 10, 0, Math.PI * 2); ctx.stroke();
    // Dashed crosshair lines
    ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(255,220,60,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(gX, my); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, gY + gH); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFormulaPanel(): void {
    const px = gX - 6, py = gY + gH + 50, pw = gW + 12, ph = H - py - 8;
    if (ph < 30) return;
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 6); ctx.fill();
    ctx.font = "bold 13px 'SF Mono','Fira Code',monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(100,255,200,0.9)"; ctx.fillText("E = V / d", px + pw / 2, py + 8);
    ctx.font = "11px system-ui, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("V = E \u00D7 d", px + pw / 2, py + 28);
    ctx.font = "10px 'SF Mono','Fira Code',monospace"; ctx.fillStyle = "rgba(200,200,255,0.7)";
    ctx.fillText(`E = ${voltage}V / ${plateSep.toFixed(1)}cm`, px + pw / 2, py + 48);
    ctx.fillText(`E = ${eField.toFixed(0)} V/m`, px + pw / 2, py + 64);
  }

  function drawInfoPanel(): void {
    const ph = 50, py = H - ph - 6, pw = W * 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(6, py, pw, ph, 6); ctx.fill();
    const fs = Math.max(9, Math.min(11, W / 65));
    ctx.font = `${fs}px 'SF Mono','Fira Code',monospace`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`Voltage: ${voltage}V`, 14, py + 16);
    ctx.fillText(`Plate gap: ${plateSep} cm`, 14 + pw * 0.3, py + 16);
    ctx.fillText(`E-field: ${eField.toFixed(0)} V/m`, 14 + pw * 0.65, py + 16);
    ctx.fillStyle = "rgba(255,220,100,0.7)";
    ctx.fillText(`Test charge at ${chargePos.toFixed(0)}%`, 14, py + 34);
    ctx.fillStyle = "rgba(180,255,180,0.7)";
    ctx.fillText(`V(charge) = ${vAtCharge.toFixed(1)}V`, 14 + pw * 0.35, py + 34);
    ctx.fillText("W = q\u0394V", 14 + pw * 0.7, py + 34);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!;
    W = canvas.width; H = canvas.height; time = 0;
    layout(); physics();
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 50;
    plateSep = params.plateSeparation ?? 5;
    showField = Math.round(params.showFieldLines ?? 1);
    chargePos = params.testChargePos ?? 50;
    time += dt; layout(); physics();
  }

  function render(): void {
    if (!ctx || W === 0 || H === 0) return;
    drawBackground();
    drawPotentialGradient();
    drawEquipotentials();
    drawFieldVectors();
    drawPlates();
    drawTestCharge();
    drawSeparationBracket();
    drawVGraph();
    drawFormulaPanel();
    drawInfoPanel();
    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Electric Potential in a Uniform Field", 12, 10);
  }

  function reset(): void {
    time = 0; voltage = 50; plateSep = 5; showField = 1; chargePos = 50;
    layout(); physics();
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const f = chargePos / 100, dist = (f * plateSep).toFixed(1);
    return (
      `Electric Potential in Uniform Field (Parallel Plate Capacitor): ` +
      `Voltage = ${voltage}V, Plate separation = ${plateSep} cm. ` +
      `Electric field E = V/d = ${voltage}V / ${plateSep}cm = ${eField.toFixed(0)} V/m (uniform). ` +
      `Test charge at ${chargePos.toFixed(0)}% (${dist} cm from + plate): V = ${vAtCharge.toFixed(1)}V. ` +
      `Work W = q\u0394V. Equipotential lines are parallel to plates. ` +
      `Potential decreases linearly: +plate (${voltage}V) to -plate (0V).`
    );
  }

  function resize(w: number, h: number): void { W = w; H = h; layout(); }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectricPotential2Factory;
