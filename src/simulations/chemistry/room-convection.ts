import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Particle { x: number; y: number; vx: number; vy: number; temp: number; }

const GRAV = 180, BETA = 0.004, HDIFF = 0.12, COOL = 0.03, NRAD = 30;

const RoomConvection: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("room-convection") as SimulationConfig;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  let width = 800, height = 600, time = 0;
  let hTemp = 60, rTemp = 20, hPos = 0, pCount = 150;
  let particles: Particle[] = [];
  const W = 0.08;
  function rL() { return width * W; } function rR() { return width * (1 - W); }
  function rT() { return height * 0.12; } function rB() { return height * 0.82; }
  function rW() { return rR() - rL(); } function rH() { return rB() - rT(); }
  function hX() { return rL() + rW() * (hPos <= 0 ? 0.2 : hPos >= 2 ? 0.8 : 0.5); }

  const BG = "#0f172a", TXT = "#e2e8f0", DIM = "#64748b";

  function tempCol(t: number): string {
    const n = Math.max(0, Math.min(1, (t - rTemp) / (Math.max(hTemp, rTemp + 1) - rTemp)));
    if (n < 0.33) { const s = n / 0.33; return `rgb(${Math.round(40 + 60 * s)},${Math.round(100 + 100 * s)},${Math.round(220 - 40 * s)})`; }
    if (n < 0.66) { const s = (n - 0.33) / 0.33; return `rgb(${Math.round(100 + 150 * s)},${Math.round(200 + 55 * s)},${Math.round(180 - 160 * s)})`; }
    const s = (n - 0.66) / 0.34; return `rgb(255,${Math.round(255 - 180 * s)},${Math.round(20 - 10 * s)})`;
  }

  function spawn() {
    particles = [];
    const l = rL(), t = rT(), w = rW(), h = rH();
    for (let i = 0; i < pCount; i++) particles.push({ x: l + Math.random() * w, y: t + Math.random() * h, vx: 0, vy: 0, temp: rTemp + Math.random() * 2 });
  }

  function drawRoom() {
    ctx.fillStyle = "#1e293b"; ctx.fillRect(rL() - 4, rB(), rW() + 8, height - rB());
    ctx.fillStyle = "rgba(20,30,50,0.4)"; ctx.fillRect(rL(), rT(), rW(), rH());
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 4; ctx.strokeRect(rL(), rT(), rW(), rH());
    // Window
    const wy = rT() + rH() * 0.15, wh = rH() * 0.35;
    ctx.fillStyle = "rgba(56,189,248,0.15)"; ctx.fillRect(rR() - 6, wy, 6, wh);
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 2; ctx.strokeRect(rR() - 6, wy, 6, wh);
    ctx.beginPath(); ctx.moveTo(rR() - 6, wy + wh / 2); ctx.lineTo(rR(), wy + wh / 2); ctx.stroke();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rL(), rT()); ctx.lineTo(rR(), rT()); ctx.stroke();
  }

  function drawHeater() {
    const cx = hX(), bot = rB(), hw = rW() * 0.15, hh = rH() * 0.08, hy = bot - hh;
    const g = ctx.createLinearGradient(cx - hw, hy, cx - hw, hy + hh);
    g.addColorStop(0, "#dc2626"); g.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - hw, hy, hw * 2, hh, 4); ctx.fill();
    ctx.strokeStyle = "#450a0a"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = "rgba(200,50,50,0.6)"; ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) { const gx = cx - hw + (i / 5) * hw * 2; ctx.beginPath(); ctx.moveTo(gx, hy + 3); ctx.lineTo(gx, hy + hh - 3); ctx.stroke(); }
    const hf = (hTemp - rTemp) / (100 - rTemp);
    if (hf > 0) {
      const gh = rH() * 0.2 * hf, gl = ctx.createLinearGradient(cx, hy, cx, hy - gh);
      gl.addColorStop(0, `rgba(255,80,20,${0.2 * hf})`); gl.addColorStop(1, "rgba(255,30,0,0)");
      ctx.fillStyle = gl; ctx.fillRect(cx - hw * 1.5, hy - gh, hw * 3, gh);
      ctx.strokeStyle = `rgba(255,100,30,${0.25 * hf})`; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const lx = cx - hw * 0.6 + i * hw * 0.6; ctx.beginPath();
        for (let j = 0; j < 20; j++) { const py = hy - (j / 20) * gh * 0.8, px = lx + Math.sin(py * 0.08 + time * 3 + i) * 4; j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
      }
    }
    ctx.fillStyle = DIM; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText(`Heater (${hTemp}\u00B0C)`, cx, bot + 14);
  }

  function drawParticles() {
    const pr = Math.max(2.5, Math.min(width, height) * 0.006);
    for (const p of particles) {
      const c = tempCol(p.temp);
      const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr * 2.2);
      gl.addColorStop(0, c.replace("rgb", "rgba").replace(")", ",0.3)")); gl.addColorStop(1, c.replace("rgb", "rgba").replace(")", ",0)"));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, pr * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawTempGrad() {
    const l = rL(), t = rT(), w = rW(), h = rH(), cols = 10, rows = 7, cw = w / cols, ch = h / rows;
    ctx.save(); ctx.globalAlpha = 0.12;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let tt = 0, cnt = 0; const cx = l + (c + 0.5) * cw, cy = t + (r + 0.5) * ch;
      for (const p of particles) { if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < (cw * 1.5) ** 2) { tt += p.temp; cnt++; } }
      if (cnt > 0) { ctx.fillStyle = tempCol(tt / cnt); ctx.fillRect(l + c * cw, t + r * ch, cw, ch); }
    }
    ctx.restore();
  }

  function drawArrows() {
    const l = rL(), t = rT(), w = rW(), h = rH(), cols = 6, rows = 4, cw = w / cols, ch = h / rows;
    ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let ax = 0, ay = 0, n = 0; const cx = l + (c + 0.5) * cw, cy = t + (r + 0.5) * ch;
      for (const p of particles) if (p.x >= l + c * cw && p.x < l + (c + 1) * cw && p.y >= t + r * ch && p.y < t + (r + 1) * ch) { ax += p.vx; ay += p.vy; n++; }
      if (n >= 2) { ax /= n; ay /= n; const sp = Math.sqrt(ax * ax + ay * ay);
        if (sp > 3) { const nx = ax / sp, ny = ay / sp, len = Math.min(18, sp * 0.4);
          ctx.beginPath(); ctx.moveTo(cx - nx * len * 0.5, cy - ny * len * 0.5); ctx.lineTo(cx + nx * len * 0.5, cy + ny * len * 0.5); ctx.stroke();
          const tx = cx + nx * len * 0.5, ty = cy + ny * len * 0.5; ctx.fillStyle = "#94a3b8";
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - nx * 4 + ny * 1.6, ty - ny * 4 - nx * 1.6); ctx.lineTo(tx - nx * 4 - ny * 1.6, ty - ny * 4 + nx * 1.6); ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawColorBar() {
    const bx = width - width * W + 12, by = rT(), bw = 12, bh = rH();
    if (bx + bw + 35 > width) return;
    const g = ctx.createLinearGradient(bx, by + bh, bx, by);
    g.addColorStop(0, tempCol(rTemp)); g.addColorStop(0.5, tempCol(rTemp + (hTemp - rTemp) * 0.5)); g.addColorStop(1, tempCol(hTemp));
    ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(150,180,220,0.3)"; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
    ctx.font = "8px monospace"; ctx.fillStyle = DIM; ctx.textAlign = "left";
    ctx.textBaseline = "top"; ctx.fillText(`${hTemp}\u00B0C`, bx + bw + 3, by);
    ctx.textBaseline = "bottom"; ctx.fillText(`${rTemp}\u00B0C`, bx + bw + 3, by + bh);
  }

  function drawHUD() {
    ctx.fillStyle = TXT; ctx.font = "bold 12px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("ROOM CONVECTION CURRENTS", 10, 8);
    ctx.fillStyle = DIM; ctx.font = "9px monospace"; ctx.fillText("Hot air rises, cools at ceiling, sinks on far side", 10, 23);
    let at = 0, mt = -Infinity, as = 0;
    for (const p of particles) { at += p.temp; if (p.temp > mt) mt = p.temp; as += Math.sqrt(p.vx * p.vx + p.vy * p.vy); }
    const n = particles.length || 1; at /= n; as /= n;
    const ph = 36, px = 5, py = height - ph - 5, pw = width - 10;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.font = "10px monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    const cy = py + ph / 2, cw = pw / 5;
    ctx.fillStyle = "#fbbf24"; ctx.fillText(`Avg:${at.toFixed(1)}\u00B0C`, px + cw * 0.5, cy);
    ctx.fillStyle = "#ef4444"; ctx.fillText(`Max:${mt.toFixed(1)}\u00B0C`, px + cw * 1.5, cy);
    ctx.fillStyle = "#60a5fa"; ctx.fillText(`Spd:${as.toFixed(1)}`, px + cw * 2.5, cy);
    ctx.fillStyle = "#94a3b8"; ctx.fillText(`N:${particles.length}`, px + cw * 3.5, cy);
    ctx.fillStyle = DIM; ctx.fillText(`t=${time.toFixed(1)}s`, px + cw * 4.5, cy);
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) { canvas = c; ctx = canvas.getContext("2d")!; width = canvas.width; height = canvas.height; time = 0; spawn(); },
    update(dt: number, params: Record<string, number>) {
      hTemp = params.heaterTemp ?? 60; rTemp = params.roomTemp ?? 20; hPos = Math.round(params.heaterPosition ?? 0);
      const nc = Math.round(params.particleCount ?? 150);
      if (nc !== pCount) {
        if (nc > pCount) for (let i = pCount; i < nc; i++) particles.push({ x: rL() + Math.random() * rW(), y: rT() + Math.random() * rH(), vx: 0, vy: 0, temp: rTemp + Math.random() * 2 });
        else particles.length = nc;
        pCount = nc;
      }
      const dtc = Math.min(dt, 0.05), sub = 2, sd = dtc / sub;
      const l = rL(), r = rR(), t = rT(), b = rB(), cx = hX(), hw = rW() * 0.18;
      const pr = Math.max(2.5, Math.min(width, height) * 0.006), hf = (hTemp - rTemp) / 80;
      const visc = 1 - 0.02 * sd * 60;
      for (let s = 0; s < sub; s++) {
        for (const p of particles) { const dx = Math.abs(p.x - cx), db = b - p.y; if (dx < hw && db < pr * 8) { const prox = (1 - dx / hw) * (1 - db / (pr * 8)); p.temp = Math.min(hTemp, p.temp + prox * hf * 120 * sd); } }
        for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x, dy = particles[j].y - particles[i].y, d2 = dx * dx + dy * dy;
          if (d2 < NRAD * NRAD && d2 > 0) { const f = HDIFF * (1 - Math.sqrt(d2) / NRAD) * sd, dT = (particles[j].temp - particles[i].temp) * f; particles[i].temp += dT; particles[j].temp -= dT; }
        }
        for (const p of particles) { p.temp += (rTemp - p.temp) * COOL * sd; p.vy += -GRAV * BETA * (p.temp - rTemp) * hf * sd; p.vx += (Math.random() - 0.5) * 12 * sd; p.vx *= visc; p.vy *= visc; }
        const rd = pr * 2.5;
        for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[j].x - particles[i].x, dy = particles[j].y - particles[i].y, d2 = dx * dx + dy * dy;
          if (d2 < rd * rd && d2 > 0.01) { const d = Math.sqrt(d2), ov = rd - d, nx = dx / d, ny = dy / d, f = ov * 60 * sd; particles[i].vx -= nx * f; particles[i].vy -= ny * f; particles[j].vx += nx * f; particles[j].vy += ny * f; }
        }
        for (const p of particles) { p.x += p.vx * sd; p.y += p.vy * sd; }
        for (const p of particles) {
          if (p.x - pr < l) { p.x = l + pr; p.vx = Math.abs(p.vx) * 0.5; }
          if (p.x + pr > r) { p.x = r - pr; p.vx = -Math.abs(p.vx) * 0.5; }
          if (p.y - pr < t) { p.y = t + pr; p.vy = Math.abs(p.vy) * 0.5; }
          if (p.y + pr > b) { p.y = b - pr; p.vy = -Math.abs(p.vy) * 0.5; }
        }
      }
      time += dt;
    },
    render() {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#0a0a1a"); bg.addColorStop(1, "#10102a");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
      drawRoom(); drawTempGrad(); drawHeater(); drawArrows(); drawParticles(); drawColorBar(); drawHUD();
    },
    reset() { time = 0; spawn(); },
    destroy() { particles = []; },
    getStateDescription() {
      let at = 0, mt = -Infinity;
      for (const p of particles) { at += p.temp; if (p.temp > mt) mt = p.temp; }
      at /= particles.length || 1;
      const pl = hPos <= 0 ? "left" : hPos >= 2 ? "right" : "center";
      return `Room convection: ${particles.length} particles, heater at ${pl} (${hTemp}\u00B0C), ambient ${rTemp}\u00B0C. Avg temp: ${at.toFixed(1)}\u00B0C, max: ${mt.toFixed(1)}\u00B0C. Hot air (red) rises by buoyancy, spreads across ceiling, cools (blue), sinks on opposite side forming a convection cell.`;
    },
    resize(w: number, h: number) {
      width = w; height = h;
      const l = rL(), r = rR(), t = rT(), b = rB(), pr = Math.max(2.5, Math.min(width, height) * 0.006);
      for (const p of particles) { p.x = Math.max(l + pr, Math.min(r - pr, p.x)); p.y = Math.max(t + pr, Math.min(b - pr, p.y)); }
    },
  };
  return engine;
};

export default RoomConvection;
