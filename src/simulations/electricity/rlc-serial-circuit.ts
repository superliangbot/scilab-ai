import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RLCSerialCircuit: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rlc-serial-circuit") as SimulationConfig;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  let width = 800, height = 600, time = 0;
  let R = 10, L = 0.1, C = 50e-6, freq = 20;
  let omega = 0, xL = 0, xC = 0, Z = 0, phase = 0, f0 = 0;
  const Vpeak = 10;
  let Ipeak = 0, vNow = 0, iNow = 0;
  const vHist: number[] = [], iHist: number[] = [], MAX_H = 200;
  let zCurve: { f: number; z: number }[] = [];

  const BG = "#0f172a", TXT = "#e2e8f0", DIM = "#64748b", GRD = "rgba(51,65,85,0.3)";
  const VCOL = "#f59e0b", ICOL = "#3b82f6", RCOL = "#ef4444", LCOL = "#a78bfa", CCOL = "#22d3ee", RSCOL = "#10b981";

  function calc(p: Record<string, number>) {
    R = p.resistance ?? 10; L = p.inductance ?? 0.1;
    C = (p.capacitance ?? 50) * 1e-6; freq = p.frequency ?? 20;
    omega = 2 * Math.PI * freq; xL = omega * L; xC = 1 / (omega * C);
    Z = Math.sqrt(R * R + (xL - xC) ** 2); phase = Math.atan2(xL - xC, R);
    f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    Ipeak = Vpeak / Z; vNow = Vpeak * Math.sin(omega * time);
    iNow = Ipeak * Math.sin(omega * time - phase);
  }

  function buildZCurve() {
    zCurve = [];
    for (let f = 1; f <= 100; f += 0.5) {
      const w = 2 * Math.PI * f, xl = w * L, xc = 1 / (w * C);
      zCurve.push({ f, z: Math.sqrt(R * R + (xl - xc) ** 2) });
    }
  }

  function drawCircuit(ox: number, oy: number, w: number, h: number) {
    const cx = ox + w / 2, cy = oy + h / 2, hw = w * 0.38, hh = h * 0.33;
    ctx.strokeStyle = DIM; ctx.lineWidth = 2;
    ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    // AC source (left)
    ctx.strokeStyle = VCOL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx - hw, cy, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = -7; i <= 7; i++) { const sy = cy - Math.sin(i * 0.5) * 4; i === -7 ? ctx.moveTo(cx - hw + i, sy) : ctx.lineTo(cx - hw + i, sy); }
    ctx.stroke();
    ctx.fillStyle = VCOL; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText("AC", cx - hw, cy + 22);
    // Resistor (top) - zigzag
    ctx.strokeStyle = RCOL; ctx.lineWidth = 2; ctx.beginPath();
    const rw = 36; ctx.moveTo(cx - rw / 2, cy - hh);
    for (let i = 0; i < 6; i++) ctx.lineTo(cx - rw / 2 + ((i + 0.5) / 6) * rw, cy - hh + (i % 2 === 0 ? -7 : 7));
    ctx.lineTo(cx + rw / 2, cy - hh); ctx.stroke();
    ctx.fillStyle = RCOL; ctx.font = "bold 9px monospace"; ctx.fillText(`R=${R}\u03A9`, cx, cy - hh - 12);
    // Inductor (right) - arcs
    ctx.strokeStyle = LCOL; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx + hw, cy + (i - 1.5) * 10, 5, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
    ctx.fillStyle = LCOL; ctx.font = "bold 9px monospace"; ctx.textAlign = "left"; ctx.fillText(`L=${L.toFixed(2)}H`, cx + hw + 10, cy);
    // Capacitor (bottom) - two parallel lines
    ctx.strokeStyle = CCOL; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx - 4, cy + hh - 8); ctx.lineTo(cx - 4, cy + hh + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 4, cy + hh - 8); ctx.lineTo(cx + 4, cy + hh + 8); ctx.stroke();
    ctx.fillStyle = CCOL; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
    ctx.fillText(`C=${(C * 1e6).toFixed(0)}\u00B5F`, cx, cy + hh + 22);
    // Current dots
    const perimeter = 2 * (2 * hw + 2 * hh), dotCount = 8;
    ctx.fillStyle = `rgba(59,130,246,${0.4 + 0.5 * Math.abs(Math.sin(omega * time - phase))})`;
    for (let i = 0; i < dotCount; i++) {
      const t = ((i / dotCount + time * freq * 0.25) % 1 + 1) % 1, d = t * perimeter;
      let dx: number, dy: number;
      if (d < 2 * hw) { dx = cx - hw + d; dy = cy - hh; }
      else if (d < 2 * hw + 2 * hh) { dx = cx + hw; dy = cy - hh + (d - 2 * hw); }
      else if (d < 4 * hw + 2 * hh) { dx = cx + hw - (d - 2 * hw - 2 * hh); dy = cy + hh; }
      else { dx = cx - hw; dy = cy + hh - (d - 4 * hw - 2 * hh); }
      ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWaves(ox: number, oy: number, w: number, h: number) {
    ctx.fillStyle = "rgba(15,23,42,0.6)"; ctx.beginPath(); ctx.roundRect(ox, oy, w, h, 8); ctx.fill();
    const p = 24, pL = ox + p + 8, pR = ox + w - p, pT = oy + p, pB = oy + h - p, pW = pR - pL, pH = pB - pT, mid = pT + pH / 2;
    ctx.strokeStyle = GRD; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { const gy = pT + (i / 4) * pH; ctx.beginPath(); ctx.moveTo(pL, gy); ctx.lineTo(pR, gy); ctx.stroke(); }
    ctx.strokeStyle = "rgba(100,116,139,0.5)"; ctx.beginPath(); ctx.moveTo(pL, mid); ctx.lineTo(pR, mid); ctx.stroke();
    // Voltage
    if (vHist.length > 1) {
      ctx.strokeStyle = VCOL; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < vHist.length; i++) { const x = pR - ((vHist.length - 1 - i) / MAX_H) * pW, y = mid - (vHist[i] / Vpeak) * (pH / 2) * 0.9; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // Current
    if (iHist.length > 1) {
      ctx.strokeStyle = ICOL; ctx.lineWidth = 2; ctx.beginPath();
      const iM = Math.max(Ipeak, 0.001);
      for (let i = 0; i < iHist.length; i++) { const x = pR - ((iHist.length - 1 - i) / MAX_H) * pW, y = mid - (iHist[i] / iM) * (pH / 2) * 0.9; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.font = "9px monospace"; ctx.textAlign = "left";
    ctx.fillStyle = VCOL; ctx.fillText("Voltage", ox + 8, oy + 13);
    ctx.fillStyle = ICOL; ctx.fillText("Current", ox + 65, oy + 13);
  }

  function drawZGraph(ox: number, oy: number, w: number, h: number) {
    ctx.fillStyle = "rgba(15,23,42,0.6)"; ctx.beginPath(); ctx.roundRect(ox, oy, w, h, 8); ctx.fill();
    const p = 26, pL = ox + p + 6, pR = ox + w - p, pT = oy + p, pB = oy + h - p, pW = pR - pL, pH = pB - pT;
    let maxZ = 10; for (const pt of zCurve) if (pt.z > maxZ) maxZ = pt.z;
    ctx.strokeStyle = GRD; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { const gy = pT + (i / 4) * pH; ctx.beginPath(); ctx.moveTo(pL, gy); ctx.lineTo(pR, gy); ctx.stroke(); }
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < zCurve.length; i++) { const x = pL + ((zCurve[i].f - 1) / 99) * pW, y = pB - (zCurve[i].z / maxZ) * pH; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    const rx = pL + ((f0 - 1) / 99) * pW;
    if (rx >= pL && rx <= pR) { ctx.strokeStyle = RSCOL; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(rx, pT); ctx.lineTo(rx, pB); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = RSCOL; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.fillText(`f\u2080=${f0.toFixed(1)}Hz`, rx, pT - 3); }
    const fx = pL + ((freq - 1) / 99) * pW;
    if (fx >= pL && fx <= pR) { ctx.fillStyle = VCOL; ctx.beginPath(); ctx.arc(fx, pB - (Z / maxZ) * pH, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = DIM; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("IMPEDANCE vs FREQUENCY", ox + w / 2, oy + 13);
  }

  function drawPhasor(ox: number, oy: number, w: number, h: number) {
    ctx.fillStyle = "rgba(15,23,42,0.6)"; ctx.beginPath(); ctx.roundRect(ox, oy, w, h, 8); ctx.fill();
    const cx = ox + w / 2, cy = oy + h / 2 + 6, maxL = Math.min(w, h) * 0.32;
    const vR = Ipeak * R, vLv = Ipeak * xL, vCv = Ipeak * xC;
    const sc = maxL / Math.max(Vpeak, vR, vLv, vCv, 0.1);
    ctx.strokeStyle = RCOL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + vR * sc, cy); ctx.stroke();
    ctx.fillStyle = RCOL; ctx.font = "8px monospace"; ctx.textAlign = "left"; ctx.fillText(`VR`, cx + vR * sc + 3, cy + 3);
    ctx.strokeStyle = LCOL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + vR * sc, cy); ctx.lineTo(cx + vR * sc, cy - vLv * sc); ctx.stroke();
    if (vLv * sc > 8) { ctx.fillStyle = LCOL; ctx.fillText("VL", cx + vR * sc + 3, cy - vLv * sc / 2); }
    ctx.strokeStyle = CCOL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + vR * sc, cy); ctx.lineTo(cx + vR * sc, cy + vCv * sc); ctx.stroke();
    if (vCv * sc > 8) { ctx.fillStyle = CCOL; ctx.fillText("VC", cx + vR * sc + 3, cy + vCv * sc / 2); }
    ctx.strokeStyle = VCOL; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + vR * sc, cy - (vLv - vCv) * sc); ctx.stroke(); ctx.setLineDash([]);
    if (Math.abs(phase) > 0.05) { ctx.strokeStyle = RSCOL; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, -phase, phase > 0); ctx.stroke(); ctx.fillStyle = RSCOL; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.fillText(`\u03C6=${(phase * 180 / Math.PI).toFixed(1)}\u00B0`, cx + 30, cy - 10); }
    ctx.fillStyle = DIM; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("PHASOR DIAGRAM", ox + w / 2, oy + 13);
  }

  function drawInfo() {
    const ph = 42, py = height - ph - 5, px = 5, pw = width - 10;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.font = "10px monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    const cy1 = py + 14, cy2 = py + 30, cw = pw / 5;
    ctx.fillStyle = LCOL; ctx.fillText(`X\u2097=${xL.toFixed(1)}\u03A9`, px + cw * 0.5, cy1);
    ctx.fillStyle = CCOL; ctx.fillText(`X\u1D04=${xC.toFixed(1)}\u03A9`, px + cw * 1.5, cy1);
    ctx.fillStyle = "#f97316"; ctx.fillText(`Z=${Z.toFixed(1)}\u03A9`, px + cw * 2.5, cy1);
    ctx.fillStyle = RSCOL; ctx.fillText(`f\u2080=${f0.toFixed(1)}Hz`, px + cw * 3.5, cy1);
    ctx.fillStyle = ICOL; ctx.fillText(`I\u2080=${Ipeak.toFixed(3)}A`, px + cw * 4.5, cy1);
    ctx.fillStyle = DIM; ctx.font = "9px monospace";
    ctx.fillText("Z=\u221A(R\u00B2+(X\u2097-X\u1D04)\u00B2)", px + cw * 1.5, cy2);
    ctx.fillText(`\u03C6=${(phase * 180 / Math.PI).toFixed(1)}\u00B0`, px + cw * 3, cy2);
    ctx.fillText("f\u2080=1/(2\u03C0\u221A(LC))", px + cw * 4.2, cy2);
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) { canvas = c; ctx = canvas.getContext("2d")!; width = canvas.width; height = canvas.height; time = 0; vHist.length = 0; iHist.length = 0; buildZCurve(); },
    update(dt: number, params: Record<string, number>) {
      const oL = L, oC = C, oR = R; calc(params);
      if (oL !== L || oC !== C || oR !== R) buildZCurve();
      time += dt; vHist.push(vNow); iHist.push(iNow);
      if (vHist.length > MAX_H) vHist.shift(); if (iHist.length > MAX_H) iHist.shift();
    },
    render() {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = TXT; ctx.font = "bold 12px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText("RLC SERIES CIRCUIT - AC Resonance", 10, 6);
      const tY = 24, tH = height * 0.46, bY = tY + tH + 4, bH = height * 0.36, lW = width * 0.5, rW = width * 0.5;
      drawCircuit(4, tY, lW - 8, tH); drawWaves(lW + 4, tY, rW - 8, tH);
      drawZGraph(4, bY, lW - 8, bH); drawPhasor(lW + 4, bY, rW - 8, bH);
      drawInfo();
    },
    reset() { time = 0; vHist.length = 0; iHist.length = 0; },
    destroy() { vHist.length = 0; iHist.length = 0; zCurve = []; },
    getStateDescription() {
      return `RLC Series Circuit: R=${R}\u03A9, L=${L}H, C=${(C * 1e6).toFixed(0)}\u00B5F. f=${freq}Hz, f\u2080=${f0.toFixed(1)}Hz. X\u2097=${xL.toFixed(1)}\u03A9, X\u1D04=${xC.toFixed(1)}\u03A9. Z=${Z.toFixed(1)}\u03A9, \u03C6=${(phase * 180 / Math.PI).toFixed(1)}\u00B0. I\u2080=${Ipeak.toFixed(3)}A. At resonance X\u2097=X\u1D04 so Z=R, current is maximum.`;
    },
    resize(w: number, h: number) { width = w; height = h; },
  };
  return engine;
};

export default RLCSerialCircuit;
