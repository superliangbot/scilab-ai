import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const ElectricTransformerFactory: SimulationFactory = () => {
  const config = getSimConfig("electric-transformer")!;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600;

  let N1 = 20, N2 = 10, Vin = 120, freq = 60;
  let time = 0, omega = 0, turnRatio = 1, Vout = 0, Iin = 0, Iout = 0;
  let vIn = 0, vOut = 0, isStepUp = false;

  const waveIn: number[] = [], waveOut: number[] = [];
  const WMAX = 250;
  let wTimer = 0;

  const fluxDots: number[] = [];
  const priDots: number[] = [];
  const secDots: number[] = [];
  const NFLUX = 16, NCUR = 8;

  const BG = "#0a0e1a", TXT = "#e2e8f0", DIM = "#64748b";
  const PRI = "#f59e0b", SEC = "#22d3ee", FLUX = "#a78bfa";
  const GRID = "rgba(51,65,85,0.3)", AXIS = "#334155";

  function initDots() {
    fluxDots.length = priDots.length = secDots.length = 0;
    for (let i = 0; i < NFLUX; i++) fluxDots.push(i / NFLUX);
    for (let i = 0; i < NCUR; i++) { priDots.push(i / NCUR); secDots.push(i / NCUR); }
  }

  function physics(p: Record<string, number>) {
    N1 = Math.round(p.primaryTurns ?? N1);
    N2 = Math.round(p.secondaryTurns ?? N2);
    Vin = p.inputVoltage ?? Vin;
    freq = p.frequency ?? freq;
    omega = 2 * Math.PI * freq;
    turnRatio = N2 / N1;
    isStepUp = N2 > N1;
    Vout = Vin * turnRatio;
    const Rload = 100;
    Iout = Vout / Rload;
    Iin = (Vout * Iout) / (Vin || 1);
    vIn = Vin * Math.SQRT2 * Math.sin(omega * time);
    vOut = Vout * Math.SQRT2 * Math.sin(omega * time);
  }

  function drawCore(cx: number, cy: number, cw: number, ch: number, t: number) {
    const x = cx - cw / 2, y = cy - ch / 2;
    const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
    g.addColorStop(0, "#2d3748"); g.addColorStop(0.5, "#5a6577"); g.addColorStop(1, "#2d3748");
    ctx.fillStyle = g; ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = BG; ctx.fillRect(x + t, y + t, cw - 2 * t, ch - 2 * t);
    ctx.strokeStyle = "#718096"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, cw, ch); ctx.strokeRect(x + t, y + t, cw - 2 * t, ch - 2 * t);
    // Lamination lines
    ctx.strokeStyle = "rgba(113,128,150,0.25)"; ctx.lineWidth = 0.5;
    for (let i = 1; i <= 4; i++) {
      const ly = y + (i / 5) * t;
      ctx.beginPath(); ctx.moveTo(x + 3, ly); ctx.lineTo(x + cw - 3, ly); ctx.stroke();
      const ly2 = y + ch - t + (i / 5) * t;
      ctx.beginPath(); ctx.moveTo(x + 3, ly2); ctx.lineTo(x + cw - 3, ly2); ctx.stroke();
    }
    ctx.fillStyle = DIM; ctx.font = "9px monospace"; ctx.textAlign = "center";
    ctx.fillText("IRON CORE", cx, cy);
  }

  function drawCoil(x: number, yT: number, yB: number, n: number, col: string, side: "L" | "R") {
    const vis = Math.min(n, 22), sp = (yB - yT) / (vis + 1), dir = side === "L" ? -1 : 1;
    const glow = Math.abs(Math.sin(omega * time)) * 0.5 + 0.2;
    ctx.strokeStyle = col; ctx.lineWidth = 2.2;
    ctx.shadowColor = col; ctx.shadowBlur = 8 * glow;
    for (let i = 1; i <= vis; i++) {
      const cy = yT + i * sp;
      ctx.beginPath(); ctx.ellipse(x + dir * 9, cy, 9, sp * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = col; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
    ctx.fillText(side === "L" ? `N\u2081=${n}` : `N\u2082=${n}`, x + dir * 9, yB + 10);
  }

  function drawFlux(cx: number, cy: number, cw: number, ch: number, t: number) {
    const hw = cw / 2, hh = ch / 2, mt = t / 2;
    const pts: { x: number; y: number }[] = [];
    const S = 60;
    for (let i = 0; i <= S / 4; i++) { const f = i / (S / 4); pts.push({ x: cx - hw + mt + f * (cw - 2 * mt), y: cy - hh + mt }); }
    for (let i = 1; i <= S / 4; i++) { const f = i / (S / 4); pts.push({ x: cx + hw - mt, y: cy - hh + mt + f * (ch - 2 * mt) }); }
    for (let i = 1; i <= S / 4; i++) { const f = i / (S / 4); pts.push({ x: cx + hw - mt - f * (cw - 2 * mt), y: cy + hh - mt }); }
    for (let i = 1; i <= S / 4; i++) { const f = i / (S / 4); pts.push({ x: cx - hw + mt, y: cy + hh - mt - f * (ch - 2 * mt) }); }
    const mag = Math.abs(Math.sin(omega * time));
    const a = 0.3 + mag * 0.7;
    for (const dt of fluxDots) {
      const idx = dt * pts.length, i0 = Math.floor(idx) % pts.length, i1 = (i0 + 1) % pts.length;
      const f = idx - Math.floor(idx);
      const px = pts[i0].x + (pts[i1].x - pts[i0].x) * f;
      const py = pts[i0].y + (pts[i1].y - pts[i0].y) * f;
      ctx.fillStyle = `rgba(167,139,250,${a * 0.3})`; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(167,139,250,${a})`; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = `rgba(167,139,250,${a})`; ctx.font = "bold 12px serif"; ctx.textAlign = "center";
    ctx.fillText("\u03A6", cx, cy - hh - 4);
  }

  function drawACSource(cx: number, cy: number, r: number) {
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = -r * 0.7; i <= r * 0.7; i++) {
      const sx = cx + i, sy = cy - Math.sin((i / (r * 0.7)) * Math.PI) * r * 0.35;
      i === -r * 0.7 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.fillStyle = "#ef4444"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText("AC", cx, cy + r + 12);
  }

  function drawLoad(cx: number, cy: number, lh: number) {
    ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2; ctx.shadowColor = "#10b981"; ctx.shadowBlur = 4;
    const segs = 5, sh = lh / segs, zw = 6;
    ctx.beginPath(); ctx.moveTo(cx, cy - lh / 2);
    for (let i = 0; i < segs; i++) {
      const ys = cy - lh / 2 + i * sh, d = i % 2 === 0 ? 1 : -1;
      ctx.lineTo(cx + d * zw, ys + sh / 2); ctx.lineTo(cx, ys + sh);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#10b981"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText("Load", cx, cy + lh / 2 + 10);
  }

  function wire(pts: { x: number; y: number }[], col: string) {
    if (pts.length < 2) return;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  function animDots(dots: number[], pts: { x: number; y: number }[], r: number, g: number, b: number, mag: number) {
    if (mag < 0.01 || pts.length < 2) return;
    const a = Math.min(mag, 1) * 0.8 + 0.2;
    for (const d of dots) {
      const n = pts.length - 1, idx = d * n, i0 = Math.floor(idx), i1 = Math.min(i0 + 1, n), f = idx - i0;
      const px = pts[i0].x + (pts[i1].x - pts[i0].x) * f, py = pts[i0].y + (pts[i1].y - pts[i0].y) * f;
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.3})`; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawArrow(x: number, y: number, ang: number, sz: number, col: string, a: number) {
    ctx.fillStyle = col; ctx.globalAlpha = a;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.5, -sz * 0.5); ctx.lineTo(-sz * 0.5, sz * 0.5); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function drawWaveforms(ox: number, oy: number, w: number, h: number) {
    ctx.fillStyle = "rgba(15,23,42,0.6)"; ctx.beginPath(); ctx.roundRect(ox, oy, w, h, 8); ctx.fill();
    ctx.strokeStyle = "rgba(100,116,139,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(ox, oy, w, h, 8); ctx.stroke();
    const pad = 26, pl = ox + pad + 8, pr = ox + w - pad, pt = oy + pad, pb = oy + h - pad;
    const pw = pr - pl, ph = pb - pt, pcy = pt + ph / 2;
    ctx.strokeStyle = GRID; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { const y = pt + (i / 4) * ph; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(pr, y); ctx.stroke(); }
    for (let i = 0; i <= 6; i++) { const x = pl + (i / 6) * pw; ctx.beginPath(); ctx.moveTo(x, pt); ctx.lineTo(x, pb); ctx.stroke(); }
    ctx.strokeStyle = AXIS; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pl, pt); ctx.lineTo(pl, pb); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pl, pcy); ctx.lineTo(pr, pcy); ctx.stroke();
    const pkIn = Vin * Math.SQRT2, pkOut = Vout * Math.SQRT2, mx = Math.max(pkIn, pkOut, 1);
    const drawWave = (data: number[], col: string) => {
      if (data.length < 2) return;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 4; ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = pr - ((data.length - 1 - i) / WMAX) * pw;
        const y = pcy - (data[i] / mx) * (ph / 2) * 0.85;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    };
    drawWave(waveIn, PRI); drawWave(waveOut, SEC);
    ctx.font = "10px monospace"; ctx.textAlign = "left";
    ctx.fillStyle = PRI; ctx.fillText("\u2014 V\u2081 (in)", ox + 10, oy + 10);
    ctx.fillStyle = SEC; ctx.fillText("\u2014 V\u2082 (out)", ox + 10, oy + 22);
    ctx.fillStyle = TXT; ctx.font = "bold 10px monospace"; ctx.textAlign = "right";
    ctx.fillText("VOLTAGE WAVEFORMS", ox + w - 8, oy + 10);
  }

  function drawInfo() {
    const ph = 56, py = H - ph - 6, px = 6, pw = W - 12;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.strokeStyle = "rgba(100,116,139,0.4)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.stroke();
    const r1 = py + 16, r2 = py + 36;
    ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
    ctx.fillStyle = FLUX; ctx.fillText("V\u2081/V\u2082 = N\u2081/N\u2082", px + pw * 0.15, r1);
    ctx.fillStyle = isStepUp ? SEC : PRI; ctx.font = "bold 12px monospace";
    ctx.fillText(isStepUp ? "STEP-UP" : "STEP-DOWN", px + pw * 0.36, r1);
    ctx.fillStyle = TXT; ctx.font = "11px monospace";
    ctx.fillText(`Ratio ${N1}:${N2}`, px + pw * 0.55, r1);
    ctx.fillStyle = DIM; ctx.fillText(`f=${freq}Hz`, px + pw * 0.72, r1);
    const Pin = Vin * Iin;
    ctx.fillStyle = DIM; ctx.font = "10px monospace";
    ctx.fillText(`P\u2081=${Pin.toFixed(1)}W  |  P\u2082=${(Vout * Iout).toFixed(1)}W  (Ideal: P\u2081=P\u2082)`, px + pw * 0.88, r1);
    ctx.font = "11px monospace";
    ctx.fillStyle = PRI; ctx.fillText(`V\u2081=${Vin.toFixed(1)}V  I\u2081=${Iin.toFixed(3)}A`, px + pw * 0.2, r2);
    ctx.fillStyle = SEC; ctx.fillText(`V\u2082=${Vout.toFixed(1)}V  I\u2082=${Iout.toFixed(3)}A`, px + pw * 0.55, r2);
    ctx.fillStyle = DIM; ctx.fillText(`${Vin.toFixed(1)}/${Vout.toFixed(1)} = ${N1}/${N2}`, px + pw * 0.85, r2);
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c; ctx = canvas.getContext("2d")!; W = canvas.width; H = canvas.height;
      time = 0; waveIn.length = waveOut.length = 0; wTimer = 0; initDots();
    },
    update(dt: number, params: Record<string, number>) {
      physics(params); time += dt;
      wTimer += dt;
      if (wTimer >= 0.012) {
        wTimer -= 0.012; waveIn.push(vIn); waveOut.push(vOut);
        if (waveIn.length > WMAX) { waveIn.shift(); waveOut.shift(); }
      }
      const fd = Math.cos(omega * time), fs = fd >= 0 ? 1 : -1, fsp = (Math.abs(fd) * 0.4 + 0.05);
      for (let i = 0; i < fluxDots.length; i++) { fluxDots[i] += fs * fsp * dt; while (fluxDots[i] > 1) fluxDots[i] -= 1; while (fluxDots[i] < 0) fluxDots[i] += 1; }
      const cp = Math.sin(omega * time), cd = cp >= 0 ? 1 : -1, cs = Math.abs(cp) * 0.5;
      for (let i = 0; i < priDots.length; i++) { priDots[i] += cd * cs * dt; while (priDots[i] > 1) priDots[i] -= 1; while (priDots[i] < 0) priDots[i] += 1; }
      for (let i = 0; i < secDots.length; i++) { secDots[i] -= cd * cs * dt; while (secDots[i] > 1) secDots[i] -= 1; while (secDots[i] < 0) secDots[i] += 1; }
    },
    render() {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      // Title
      ctx.fillStyle = DIM; ctx.font = "11px monospace"; ctx.textAlign = "left";
      ctx.fillText("ELECTRIC TRANSFORMER - Electromagnetic Induction", 12, 14);
      ctx.font = "10px monospace";
      ctx.fillText(`N\u2081=${N1}  N\u2082=${N2}  V\u2081=${Vin}V  f=${freq}Hz  ${isStepUp ? "Step-Up" : "Step-Down"}`, 12, 28);

      const tcx = W * 0.3, tcy = H * 0.4;
      const cw = Math.min(W * 0.28, 200), ch = Math.min(H * 0.36, 200), ct = Math.min(cw * 0.14, 26);
      drawCore(tcx, tcy, cw, ch, ct);
      drawFlux(tcx, tcy, cw, ch, ct);
      const lx = tcx - cw / 2, rx = tcx + cw / 2;
      const cTop = tcy - ch / 2 + ct + 4, cBot = tcy + ch / 2 - ct - 4;
      drawCoil(lx, cTop, cBot, N1, PRI, "L");
      drawCoil(rx, cTop, cBot, N2, SEC, "R");

      // AC source & load
      const acX = lx - cw * 0.32, acY = tcy;
      drawACSource(acX, acY, 14);
      const ldX = rx + cw * 0.32, ldY = tcy;
      drawLoad(ldX, ldY, 36);

      // Wires
      const tBar = tcy - ch / 2 + ct / 2, bBar = tcy + ch / 2 - ct / 2;
      const pT = [{ x: acX, y: acY - 14 }, { x: acX, y: tBar }, { x: lx - 9, y: tBar }, { x: lx - 9, y: cTop }];
      const pB = [{ x: acX, y: acY + 14 }, { x: acX, y: bBar }, { x: lx - 9, y: bBar }, { x: lx - 9, y: cBot }];
      wire(pT, PRI); wire(pB, PRI);
      const sT = [{ x: rx + 9, y: cTop }, { x: rx + 9, y: tBar }, { x: ldX, y: tBar }, { x: ldX, y: ldY - 18 }];
      const sB = [{ x: rx + 9, y: cBot }, { x: rx + 9, y: bBar }, { x: ldX, y: bBar }, { x: ldX, y: ldY + 18 }];
      wire(sT, SEC); wire(sB, SEC);

      // Animated current dots
      const pAll = [...pT, ...pB.slice().reverse()];
      const sAll = [...sT, ...sB.slice().reverse()];
      const cp = Math.abs(Math.sin(omega * time));
      animDots(priDots, pAll, 245, 158, 11, cp);
      animDots(secDots, sAll, 34, 211, 238, cp * Math.min(turnRatio, 2));

      // Direction arrows
      const aa = cp * 0.8, aDir = Math.sin(omega * time) >= 0 ? -Math.PI / 2 : Math.PI / 2;
      if (aa > 0.05) {
        drawArrow(acX, acY - 24, aDir, 6, PRI, aa);
        drawArrow(acX, acY + 24, -aDir, 6, PRI, aa);
        drawArrow(ldX, ldY - 28, -aDir, 6, SEC, aa);
        drawArrow(ldX, ldY + 28, aDir, 6, SEC, aa);
      }

      // Instantaneous voltages
      ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = PRI; ctx.shadowColor = PRI; ctx.shadowBlur = 5;
      ctx.fillText(`${vIn.toFixed(1)}V`, lx - 9, cTop - 10); ctx.shadowBlur = 0;
      ctx.fillStyle = SEC; ctx.shadowColor = SEC; ctx.shadowBlur = 5;
      ctx.fillText(`${vOut.toFixed(1)}V`, rx + 9, cTop - 10); ctx.shadowBlur = 0;

      ctx.fillStyle = PRI; ctx.font = "bold 9px monospace"; ctx.fillText("PRIMARY", lx - 9, cBot + 22);
      ctx.fillStyle = SEC; ctx.fillText("SECONDARY", rx + 9, cBot + 22);

      // Waveforms & equation
      const wx = W * 0.58, wy = 38, ww = W * 0.40, wh = H * 0.44;
      drawWaveforms(wx, wy, ww, wh);

      const ey = wy + wh + 10, ew = ww, eh = 60;
      ctx.fillStyle = "rgba(15,23,42,0.6)"; ctx.beginPath(); ctx.roundRect(wx, ey, ew, eh, 8); ctx.fill();
      ctx.strokeStyle = "rgba(100,116,139,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(wx, ey, ew, eh, 8); ctx.stroke();
      ctx.font = "bold 15px monospace"; ctx.textAlign = "center";
      ctx.fillStyle = FLUX; ctx.shadowColor = FLUX; ctx.shadowBlur = 8;
      ctx.fillText("V\u2081 / V\u2082 = N\u2081 / N\u2082", wx + ew / 2, ey + 20); ctx.shadowBlur = 0;
      ctx.font = "12px monospace"; ctx.fillStyle = TXT;
      ctx.fillText(`${Vin.toFixed(1)} / ${Vout.toFixed(1)} = ${N1} / ${N2}`, wx + ew / 2, ey + 42);
      ctx.fillStyle = isStepUp ? SEC : PRI; ctx.font = "bold 10px monospace"; ctx.textAlign = "right";
      ctx.fillText(isStepUp ? "STEP-UP" : "STEP-DOWN", wx + ew - 10, ey + 12);

      drawInfo();
    },
    reset() { time = 0; waveIn.length = waveOut.length = 0; wTimer = 0; vIn = vOut = 0; initDots(); },
    destroy() {},
    getStateDescription(): string {
      const t = isStepUp ? "step-up" : "step-down";
      return `Electric Transformer (${t}): N\u2081=${N1}, N\u2082=${N2}, V\u2081=${Vin.toFixed(1)}V, V\u2082=${Vout.toFixed(1)}V, ` +
        `ratio=${turnRatio.toFixed(2)}, f=${freq}Hz, I\u2081=${Iin.toFixed(3)}A, I\u2082=${Iout.toFixed(3)}A. Ideal: P\u2081=P\u2082. V\u2081/V\u2082=N\u2081/N\u2082.`;
    },
    resize(w: number, h: number) { W = w; H = h; },
  };
  return engine;
};

export default ElectricTransformerFactory;
