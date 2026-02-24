import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ElectricPotential3Factory: SimulationFactory = () => {
  const config = getSimConfig("electric-potential-3") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600, time = 0;

  let charge1 = 3, charge2 = -2, showSurface = 1, testChargeMass = 0.5;
  const K = 120;
  const c1 = { x: 0, y: 0 }, c2 = { x: 0, y: 0 };
  const GCOLS = 40, GROWS = 30, MAX_V = 15;
  const grid: number[][] = [];
  const tc = { x: 0, y: 0, vx: 0, vy: 0, ke: 0, pe: 0 };
  let totalE = 0;

  function V(wx: number, wy: number): number {
    const r1 = Math.sqrt((wx - c1.x) ** 2 + (wy - c1.y) ** 2) + 8;
    const r2 = Math.sqrt((wx - c2.x) ** 2 + (wy - c2.y) ** 2) + 8;
    return K * charge1 / r1 + K * charge2 / r2;
  }

  function eField(wx: number, wy: number) {
    let ex = 0, ey = 0;
    for (const { p, q } of [{ p: c1, q: charge1 }, { p: c2, q: charge2 }]) {
      const dx = wx - p.x, dy = wy - p.y;
      const r2 = dx * dx + dy * dy + 64;
      const r = Math.sqrt(r2);
      ex += K * q * dx / (r2 * r);
      ey += K * q * dy / (r2 * r);
    }
    return { ex, ey };
  }

  function placeCharges() {
    c1.x = W * 0.35; c1.y = H * 0.42;
    c2.x = W * 0.65; c2.y = H * 0.42;
  }

  function buildGrid() {
    const gw = W * 0.7, gh = H * 0.6, sx = W * 0.15, sy = H * 0.12;
    grid.length = 0;
    for (let r = 0; r < GROWS; r++) {
      const row: number[] = [];
      for (let c = 0; c < GCOLS; c++)
        row.push(V(sx + (c / (GCOLS - 1)) * gw, sy + (r / (GROWS - 1)) * gh));
      grid.push(row);
    }
  }

  function resetTC() {
    tc.x = W * 0.5; tc.y = H * 0.15;
    tc.vx = tc.vy = tc.ke = 0;
    tc.pe = V(tc.x, tc.y);
    totalE = tc.pe;
  }

  function updateTC(dt: number) {
    const { ex, ey } = eField(tc.x, tc.y);
    tc.vx += (-ex / testChargeMass) * dt;
    tc.vy += (-ey / testChargeMass) * dt;
    tc.vx *= 0.998; tc.vy *= 0.998;
    const spd = Math.sqrt(tc.vx ** 2 + tc.vy ** 2);
    if (spd > 300) { tc.vx *= 300 / spd; tc.vy *= 300 / spd; }
    tc.x += tc.vx * dt; tc.y += tc.vy * dt;
    if (tc.x < 20) { tc.x = 20; tc.vx = Math.abs(tc.vx) * 0.5; }
    if (tc.x > W - 20) { tc.x = W - 20; tc.vx = -Math.abs(tc.vx) * 0.5; }
    if (tc.y < 20) { tc.y = 20; tc.vy = Math.abs(tc.vy) * 0.5; }
    if (tc.y > H - 20) { tc.y = H - 20; tc.vy = -Math.abs(tc.vy) * 0.5; }
    tc.pe = V(tc.x, tc.y);
    tc.ke = 0.5 * testChargeMass * (tc.vx ** 2 + tc.vy ** 2);
    totalE = tc.ke + tc.pe;
  }

  function vColor(v: number): string {
    const t = Math.max(-1, Math.min(1, v / MAX_V));
    if (t > 0) return `rgb(${60 + 195 * t | 0},${60 - 20 * t | 0},${120 - 80 * t | 0})`;
    const n = -t;
    return `rgb(${60 - 40 * n | 0},${60 + 140 * n | 0},${120 + 135 * n | 0})`;
  }

  function isoY(sy: number, hv: number): number {
    const cl = Math.max(-MAX_V, Math.min(MAX_V, hv));
    return sy - cl * 0.4 * (H / 80) * Math.cos(Math.PI / 6);
  }

  function drawSurface() {
    const gw = W * 0.7, gh = H * 0.6, sx = W * 0.15, sy = H * 0.12;
    const tw = gw / (GCOLS - 1), th = gh / (GROWS - 1);
    for (let r = 0; r < GROWS - 1; r++) {
      for (let c = 0; c < GCOLS - 1; c++) {
        const x = sx + c * tw, y = sy + r * th;
        const v00 = grid[r][c], v10 = grid[r][c + 1];
        const v01 = grid[r + 1][c], v11 = grid[r + 1][c + 1];
        ctx.fillStyle = vColor((v00 + v10 + v01 + v11) / 4);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(x, isoY(y, v00));
        ctx.lineTo(x + tw, isoY(y, v10));
        ctx.lineTo(x + tw, isoY(y + th, v11));
        ctx.lineTo(x, isoY(y + th, v01));
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.5; ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawContours() {
    const gw = W * 0.7, gh = H * 0.6, sx = W * 0.15, sy = H * 0.12;
    const tw = gw / (GCOLS - 1), th = gh / (GROWS - 1);
    for (const lv of [-10, -6, -3, -1, 0, 1, 3, 6, 10]) {
      const col = lv > 0 ? "rgba(255,100,100,0.4)" : lv < 0 ? "rgba(100,200,255,0.4)" : "rgba(200,200,200,0.5)";
      ctx.fillStyle = col;
      for (let r = 0; r < GROWS - 1; r++) {
        for (let c = 0; c < GCOLS - 1; c++) {
          const x = sx + c * tw, y = sy + r * th;
          if ((grid[r][c] - lv) * (grid[r][c + 1] - lv) < 0) {
            const t = (lv - grid[r][c]) / (grid[r][c + 1] - grid[r][c]);
            ctx.fillRect(x + t * tw - 1, y - 1, 2, 2);
          }
          if ((grid[r][c] - lv) * (grid[r + 1][c] - lv) < 0) {
            const t = (lv - grid[r][c]) / (grid[r + 1][c] - grid[r][c]);
            ctx.fillRect(x - 1, y + t * th - 1, 2, 2);
          }
        }
      }
    }
  }

  function drawCharge(pos: { x: number; y: number }, q: number, label: string) {
    if (q === 0) return;
    const pos_ = q > 0, rad = 14 + Math.abs(q) * 2;
    const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, rad * 3);
    glow.addColorStop(0, pos_ ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, rad * 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = pos_ ? "#ef4444" : "#3b82f6"; ctx.fill();
    ctx.strokeStyle = pos_ ? "#fca5a5" : "#93c5fd"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = `bold ${rad}px 'Inter',system-ui,sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(pos_ ? "+" : "\u2013", pos.x, pos.y);
    ctx.font = "bold 12px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${label} = ${q > 0 ? "+" : ""}${q}`, pos.x, pos.y + rad + 16);
  }

  function drawTestCharge() {
    const { x, y } = tc;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 20);
    glow.addColorStop(0, "rgba(52,211,153,0.5)"); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#34d399"; ctx.fill();
    ctx.strokeStyle = "#a7f3d0"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#022c22"; ctx.font = "bold 10px 'Inter',system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+", x, y);
    const avx = tc.vx * 0.15, avy = tc.vy * 0.15;
    if (Math.sqrt(avx ** 2 + avy ** 2) > 3) {
      ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + avx, y + avy); ctx.stroke();
      const a = Math.atan2(avy, avx);
      ctx.fillStyle = "#fbbf24"; ctx.beginPath();
      ctx.moveTo(x + avx, y + avy);
      ctx.lineTo(x + avx - 6 * Math.cos(a - 0.4), y + avy - 6 * Math.sin(a - 0.4));
      ctx.lineTo(x + avx - 6 * Math.cos(a + 0.4), y + avy - 6 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
    }
    ctx.font = "10px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#a7f3d0";
    ctx.textBaseline = "alphabetic"; ctx.fillText("test charge (+1)", x, y - 14);
  }

  function drawEnergyBars() {
    const bx = W - 130, by = 50, bw = 30, bMaxH = 120, pw = 120, ph = 185;
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fillRect(bx - 10, by - 30, pw, ph);
    ctx.strokeStyle = "rgba(100,116,139,0.3)"; ctx.lineWidth = 1;
    ctx.strokeRect(bx - 10, by - 30, pw, ph);
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 11px 'Inter',system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.fillText("Energy", bx + pw / 2 - 10, by - 14);

    const maxE = Math.max(Math.abs(totalE) * 1.5, 30);
    const baseY = by + bMaxH;
    const bars: [number, string, string, number][] = [
      [0, "#f59e0b", "KE", tc.ke],
      [35, tc.pe >= 0 ? "#3b82f6" : "#06b6d4", "PE", Math.abs(tc.pe)],
      [70, "#34d399", "Total", Math.abs(totalE)],
    ];
    for (const [ox, col, lbl, val] of bars) {
      const h = Math.min(val / maxE * bMaxH, bMaxH);
      ctx.fillStyle = col; ctx.fillRect(bx + ox, baseY - h, bw, h);
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.strokeRect(bx + ox, baseY - h, bw, h);
      ctx.font = "9px 'Inter',system-ui,sans-serif"; ctx.fillStyle = col;
      ctx.fillText(lbl, bx + ox + bw / 2, baseY + 12);
      ctx.fillStyle = "#94a3b8"; ctx.fillText(val.toFixed(1), bx + ox + bw / 2, baseY + 24);
    }
    ctx.font = "9px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#64748b";
    ctx.fillText("KE + PE = const", bx + pw / 2 - 10, baseY + 40);
  }

  function drawInfo() {
    const py = H - 65;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.fillRect(12, py, W - 24, 55);
    ctx.strokeStyle = "rgba(100,116,139,0.3)"; ctx.lineWidth = 1;
    ctx.strokeRect(12, py, W - 24, 55);
    ctx.font = "12px 'Inter',system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillStyle = "#818cf8";
    ctx.fillText(`Q\u2081 = ${charge1 > 0 ? "+" : ""}${charge1}  |  Q\u2082 = ${charge2 > 0 ? "+" : ""}${charge2}  |  mass = ${testChargeMass.toFixed(1)}`, 24, py + 18);
    ctx.fillStyle = "#22d3ee";
    const v = V(tc.x, tc.y);
    ctx.fillText(`V = ${v.toFixed(2)}  |  KE = ${tc.ke.toFixed(2)}  |  PE = ${tc.pe.toFixed(2)}  |  Total E = ${totalE.toFixed(2)}`, 24, py + 38);
    ctx.fillStyle = "#ef4444"; ctx.fillText("\u25A0", W - 200, py + 18);
    ctx.fillStyle = "#94a3b8"; ctx.fillText("High V (hill)", W - 188, py + 18);
    ctx.fillStyle = "#3b82f6"; ctx.fillText("\u25A0", W - 200, py + 38);
    ctx.fillStyle = "#94a3b8"; ctx.fillText("Low V (well)", W - 188, py + 38);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c; ctx = canvas.getContext("2d")!;
      W = canvas.width; H = canvas.height;
      placeCharges(); buildGrid(); resetTC(); time = 0;
    },

    update(dt: number, params: Record<string, number>) {
      const pc1 = charge1, pc2 = charge2;
      charge1 = params.charge1 ?? charge1;
      charge2 = params.charge2 ?? charge2;
      showSurface = Math.round(params.showSurface ?? showSurface);
      testChargeMass = params.testChargeMass ?? testChargeMass;
      if (charge1 !== pc1 || charge2 !== pc2) { placeCharges(); buildGrid(); }
      const dtc = Math.min(dt, 0.033); time += dtc;
      const sub = dtc / 4;
      for (let i = 0; i < 4; i++) updateTC(sub);
    },

    render() {
      if (!ctx) return;
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0a1a"); bg.addColorStop(1, "#0d1025");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.font = "bold 17px 'Inter',system-ui,sans-serif";
      ctx.fillStyle = "#e2e8f0"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText("Electric Potential Energy & Work", W / 2, 28);
      ctx.font = "12px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#64748b";
      ctx.fillText("Potential surface: hills (+Q) and wells (-Q) | Test charge rolls toward lower potential", W / 2, 46);
      if (showSurface) drawSurface();
      drawContours();
      drawCharge(c1, charge1, "Q\u2081");
      drawCharge(c2, charge2, "Q\u2082");
      drawTestCharge();
      drawEnergyBars();
      drawInfo();
      ctx.font = "11px 'Inter',system-ui,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.textAlign = "left";
      ctx.fillText(`t = ${time.toFixed(1)}s`, 12, H - 4);
    },

    reset() {
      charge1 = config.parameters.find(p => p.key === "charge1")!.defaultValue;
      charge2 = config.parameters.find(p => p.key === "charge2")!.defaultValue;
      showSurface = config.parameters.find(p => p.key === "showSurface")!.defaultValue;
      testChargeMass = config.parameters.find(p => p.key === "testChargeMass")!.defaultValue;
      placeCharges(); buildGrid(); resetTC(); time = 0;
    },

    destroy() { grid.length = 0; },

    getStateDescription(): string {
      const v = V(tc.x, tc.y);
      return (
        `Electric Potential Energy simulation: Q\u2081=${charge1 > 0 ? "+" : ""}${charge1}, ` +
        `Q\u2082=${charge2 > 0 ? "+" : ""}${charge2}. ` +
        `Positive charges create potential "hills", negative charges create "wells". ` +
        `Test charge (mass=${testChargeMass.toFixed(1)}) rolls toward lower potential. ` +
        `V=${v.toFixed(2)}, KE=${tc.ke.toFixed(2)}, PE=${tc.pe.toFixed(2)}, ` +
        `Total E=${totalE.toFixed(2)} (KE + PE = constant). ` +
        `Work by electric field = \u0394KE = -\u0394PE (work-energy theorem).`
      );
    },

    resize(w: number, h: number) {
      W = w; H = h; placeCharges(); buildGrid();
    },
  };

  return engine;
};

export default ElectricPotential3Factory;
