import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Star { x: number; y: number; b: number; s: number; }
interface Exhaust { x: number; y: number; vx: number; vy: number; life: number; max: number; }

const RocketAndPrincipleOfInertia: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rocket-and-principle-of-inertia") as SimulationConfig;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  let width = 800, height = 600, time = 0;
  let thrust = 500, mass = 1000, burnTime = 5, friction = 0;
  let velocity = 0, distance = 0, accel = 0, engineOn = false, cameraX = 0;
  const vHist: { t: number; v: number }[] = [], MAX_P = 300;
  let stars: Star[] = [], exhaust: Exhaust[] = [];
  const BG = "#0a0e1a", TXT = "#e2e8f0", DIM = "#64748b", GRD = "rgba(51,65,85,0.3)";
  const VCOL = "#3b82f6", TCOL = "#22c55e", FCOL = "#ef4444", FLCOL = "#f59e0b";

  function initStars() { stars = []; for (let i = 0; i < 120; i++) stars.push({ x: Math.random() * 2000 - 500, y: Math.random() * height, b: 0.3 + Math.random() * 0.7, s: 0.5 + Math.random() * 1.5 }); }

  function physics(dt: number, p: Record<string, number>) {
    thrust = p.thrust ?? 500; mass = p.mass ?? 1000; burnTime = p.burnTime ?? 5; friction = p.friction ?? 0;
    engineOn = time < burnTime && thrust > 0;
    let F = engineOn ? thrust : 0;
    if (friction > 0 && Math.abs(velocity) > 0.01) F -= friction * velocity * mass * 0.5;
    accel = F / mass; velocity += accel * dt;
    if (Math.abs(velocity) < 0.001 && !engineOn) velocity = 0;
    distance += velocity * dt; cameraX = distance * 2 - width * 0.3;
  }

  function drawStars() {
    for (const s of stars) {
      const sx = ((s.x - cameraX * 0.05) % (width + 200)) - 100;
      ctx.fillStyle = `rgba(255,255,255,${s.b * (0.7 + 0.3 * Math.sin(time * 3 + s.x))})`;
      ctx.beginPath(); ctx.arc(sx, s.y, s.s, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawGround() {
    if (friction <= 0) return;
    const gy = height * 0.58, a = Math.min(friction, 1) * 0.4;
    const g = ctx.createLinearGradient(0, gy, 0, height);
    g.addColorStop(0, `rgba(34,60,34,${a})`); g.addColorStop(1, `rgba(20,40,20,${a * 0.6})`);
    ctx.fillStyle = g; ctx.fillRect(0, gy, width, height - gy);
    ctx.strokeStyle = `rgba(100,160,100,${a})`; ctx.lineWidth = 1;
    ctx.fillStyle = `rgba(150,200,150,${a})`; ctx.font = "9px monospace"; ctx.textAlign = "center";
    for (let m = 0; m < 50; m++) {
      const sx = m * 200 - cameraX + width * 0.3;
      if (sx < -50 || sx > width + 50) continue;
      ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx, gy + 8); ctx.stroke();
      ctx.fillText(`${m * 100}m`, sx, gy + 18);
    }
  }

  function drawRocket() {
    const rx = width * 0.3, ry = height * (friction > 0 ? 0.52 : 0.45);
    // Exhaust particles
    for (const p of exhaust) {
      const sx = p.x - (distance * 2 - rx) + rx, a = (p.life / p.max) * 0.8, sz = 3 + (1 - p.life / p.max) * 6;
      ctx.fillStyle = `rgba(255,150,30,${a})`; ctx.beginPath(); ctx.arc(sx, p.y + ry - height * (friction > 0 ? 0.52 : 0.45), sz, 0, Math.PI * 2); ctx.fill();
    }
    // Flame
    if (engineOn) {
      const fl = 20 + thrust / 30 + Math.sin(time * 30) * 8, fw = 8 + Math.sin(time * 25) * 2;
      const fg = ctx.createLinearGradient(rx - 25, ry, rx - 25 - fl, ry);
      fg.addColorStop(0, "rgba(255,255,200,0.9)"); fg.addColorStop(0.3, "rgba(255,180,50,0.7)"); fg.addColorStop(1, "rgba(200,30,10,0)");
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(rx - 25, ry - fw); ctx.lineTo(rx - 25 - fl, ry); ctx.lineTo(rx - 25, ry + fw); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.moveTo(rx - 25, ry - fw * 0.3); ctx.lineTo(rx - 25 - fl * 0.4, ry); ctx.lineTo(rx - 25, ry + fw * 0.3); ctx.closePath(); ctx.fill();
    }
    // Body
    ctx.fillStyle = "#94a3b8"; ctx.beginPath();
    ctx.moveTo(rx + 30, ry); ctx.lineTo(rx + 15, ry - 10); ctx.lineTo(rx - 20, ry - 10);
    ctx.lineTo(rx - 25, ry - 6); ctx.lineTo(rx - 25, ry + 6); ctx.lineTo(rx - 20, ry + 10);
    ctx.lineTo(rx + 15, ry + 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1.5; ctx.stroke();
    // Nose cone
    const ng = ctx.createLinearGradient(rx + 15, ry - 10, rx + 30, ry);
    ng.addColorStop(0, "#94a3b8"); ng.addColorStop(1, "#ef4444");
    ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(rx + 30, ry); ctx.lineTo(rx + 15, ry - 10); ctx.lineTo(rx + 15, ry + 10); ctx.closePath(); ctx.fill();
    // Window
    ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.arc(rx + 5, ry, 4, 0, Math.PI * 2); ctx.fill();
    // Fins
    ctx.fillStyle = "#64748b";
    ctx.beginPath(); ctx.moveTo(rx - 20, ry - 10); ctx.lineTo(rx - 28, ry - 18); ctx.lineTo(rx - 25, ry - 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rx - 20, ry + 10); ctx.lineTo(rx - 28, ry + 18); ctx.lineTo(rx - 25, ry + 6); ctx.closePath(); ctx.fill();
    // Velocity vector
    if (Math.abs(velocity) > 0.5) {
      const al = Math.min(80, Math.abs(velocity) * 0.3), ad = velocity > 0 ? 1 : -1, ay = ry - 25;
      ctx.strokeStyle = VCOL; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(rx, ay); ctx.lineTo(rx + al * ad, ay); ctx.stroke();
      ctx.fillStyle = VCOL; ctx.beginPath(); ctx.moveTo(rx + al * ad, ay); ctx.lineTo(rx + (al - 8) * ad, ay - 4); ctx.lineTo(rx + (al - 8) * ad, ay + 4); ctx.closePath(); ctx.fill();
      ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText(`v=${velocity.toFixed(1)} m/s`, rx + al * ad * 0.5, ay - 10);
    }
    // Force arrows
    const fy = ry + 35;
    if (engineOn) {
      const fl = Math.min(50, thrust / 20);
      ctx.strokeStyle = TCOL; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx, fy); ctx.lineTo(rx + fl, fy); ctx.stroke();
      ctx.fillStyle = TCOL; ctx.beginPath(); ctx.moveTo(rx + fl, fy); ctx.lineTo(rx + fl - 6, fy - 3); ctx.lineTo(rx + fl - 6, fy + 3); ctx.closePath(); ctx.fill();
      ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText(`F=${thrust}N`, rx + fl / 2, fy + 14);
    }
    if (friction > 0 && Math.abs(velocity) > 0.5) {
      ctx.fillStyle = FCOL; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillText("friction", rx - 20, fy - 8);
    }
  }

  function drawGraph(ox: number, oy: number, w: number, h: number) {
    ctx.fillStyle = "rgba(15,23,42,0.75)"; ctx.beginPath(); ctx.roundRect(ox, oy, w, h, 8); ctx.fill();
    const p = 24, pL = ox + p + 4, pR = ox + w - p, pT = oy + p, pB = oy + h - p, pW = pR - pL, pH = pB - pT, zY = pT + pH / 2;
    ctx.strokeStyle = GRD; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) { const gy = pT + (i / 4) * pH; ctx.beginPath(); ctx.moveTo(pL, gy); ctx.lineTo(pR, gy); ctx.stroke(); }
    ctx.strokeStyle = "rgba(100,116,139,0.5)"; ctx.beginPath(); ctx.moveTo(pL, zY); ctx.lineTo(pR, zY); ctx.stroke();
    let maxV = 1; for (const pt of vHist) if (Math.abs(pt.v) > maxV) maxV = Math.abs(pt.v);
    maxV *= 1.1;
    // Burn marker
    if (vHist.length > 0) {
      const t0 = vHist[0].t, t1 = vHist[vHist.length - 1].t, tr = t1 - t0 || 1;
      if (burnTime >= t0 && burnTime <= t1) {
        const bx = pL + ((burnTime - t0) / tr) * pW;
        ctx.strokeStyle = "rgba(245,158,11,0.4)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(bx, pT); ctx.lineTo(bx, pB); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = FLCOL; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.fillText("burn end", bx, pT - 3);
      }
    }
    if (vHist.length > 1) {
      ctx.strokeStyle = VCOL; ctx.lineWidth = 2; ctx.beginPath();
      const t0 = vHist[0].t, tr = (vHist[vHist.length - 1].t - t0) || 1;
      for (let i = 0; i < vHist.length; i++) { const x = pL + ((vHist[i].t - t0) / tr) * pW, y = zY - (vHist[i].v / maxV) * (pH / 2) * 0.9; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = VCOL; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.fillText("VELOCITY vs TIME", ox + w / 2, oy + 12);
    ctx.fillStyle = DIM; ctx.font = "8px monospace"; ctx.fillText("time (s)", ox + w / 2, pB + 14);
  }

  function drawInfo() {
    const ph = 36, px = 5, py = height - ph - 5, pw = width - 10;
    ctx.fillStyle = "rgba(15,23,42,0.85)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.font = "10px monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    const cy = py + ph / 2, cw = pw / 6;
    ctx.fillStyle = TXT; ctx.fillText(`t=${time.toFixed(1)}s`, px + cw * 0.5, cy);
    ctx.fillStyle = VCOL; ctx.fillText(`v=${velocity.toFixed(1)}m/s`, px + cw * 1.5, cy);
    ctx.fillStyle = TCOL; ctx.fillText(`a=${accel.toFixed(2)}m/s\u00B2`, px + cw * 2.5, cy);
    ctx.fillStyle = FLCOL; ctx.fillText(`d=${distance.toFixed(1)}m`, px + cw * 3.5, cy);
    ctx.fillStyle = engineOn ? TCOL : FCOL; ctx.fillText(engineOn ? "ENGINE ON" : "ENGINE OFF", px + cw * 4.5, cy);
    ctx.fillStyle = DIM; ctx.fillText(friction === 0 ? "SPACE" : `fric=${friction.toFixed(2)}`, px + cw * 5.5, cy);
  }

  const engine: SimulationEngine = {
    config,
    init(c: HTMLCanvasElement) {
      canvas = c; ctx = canvas.getContext("2d")!; width = canvas.width; height = canvas.height;
      time = 0; velocity = 0; distance = 0; accel = 0; cameraX = 0;
      vHist.length = 0; exhaust = []; initStars();
    },
    update(dt: number, params: Record<string, number>) {
      const d = Math.min(dt, 0.05); physics(d, params); time += d;
      if (engineOn) {
        const rx = width * 0.3, ry = height * (friction > 0 ? 0.52 : 0.45);
        for (let i = 0; i < 3; i++) exhaust.push({ x: rx - 25 + distance * 2, y: (Math.random() - 0.5) * 8, vx: -(80 + Math.random() * 120), vy: (Math.random() - 0.5) * 40, life: 0.4 + Math.random() * 0.4, max: 0.4 + Math.random() * 0.4 });
      }
      for (let i = exhaust.length - 1; i >= 0; i--) { exhaust[i].x += exhaust[i].vx * d; exhaust[i].y += exhaust[i].vy * d; exhaust[i].life -= d; if (exhaust[i].life <= 0) exhaust.splice(i, 1); }
      vHist.push({ t: time, v: velocity }); if (vHist.length > MAX_P) vHist.shift();
    },
    render() {
      ctx.fillStyle = BG; ctx.fillRect(0, 0, width, height);
      if (friction > 0) { const sg = ctx.createLinearGradient(0, 0, 0, height * 0.6); sg.addColorStop(0, `rgba(30,60,120,${Math.min(friction, 1) * 0.08})`); sg.addColorStop(1, "rgba(30,60,120,0)"); ctx.fillStyle = sg; ctx.fillRect(0, 0, width, height * 0.6); }
      drawStars(); drawGround(); drawRocket();
      drawGraph(width - width * 0.38 - 8, 8, width * 0.38, height * 0.3);
      ctx.fillStyle = TXT; ctx.font = "bold 12px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("ROCKET & PRINCIPLE OF INERTIA", 10, 8);
      ctx.fillStyle = DIM; ctx.font = "9px monospace"; ctx.fillText("Newton's 1st Law: object in motion stays in motion unless acted on by a force", 10, 23);
      drawInfo();
    },
    reset() { time = 0; velocity = 0; distance = 0; accel = 0; cameraX = 0; vHist.length = 0; exhaust = []; },
    destroy() { vHist.length = 0; exhaust = []; stars = []; },
    getStateDescription() {
      const env = friction === 0 ? "space (zero friction)" : `atmosphere (friction=${friction.toFixed(2)})`;
      return `Rocket inertia demo in ${env}. Thrust=${thrust}N, mass=${mass}kg, burn=${burnTime}s. t=${time.toFixed(1)}s, v=${velocity.toFixed(1)}m/s, d=${distance.toFixed(1)}m, a=${accel.toFixed(2)}m/s\u00B2. Engine ${engineOn ? "ON" : "OFF"}. ${friction === 0 ? "In space, constant velocity after cutoff (Newton's 1st law)." : "With friction, rocket decelerates after cutoff."}`;
    },
    resize(w: number, h: number) { width = w; height = h; initStars(); },
  };
  return engine;
};

export default RocketAndPrincipleOfInertia;
