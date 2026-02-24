import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Photon {
  x: number; y: number; vx: number; vy: number;
  color: string; wl: number; alive: boolean; phase: number;
  incoming: boolean; fromLevel: number; toLevel: number;
}

const LEVELS = [
  { n: 1, energy: -13.6, radius: 28 },
  { n: 2, energy: -3.4,  radius: 52 },
  { n: 3, energy: -1.511, radius: 82 },
  { n: 4, energy: -0.85, radius: 118 },
];

function tColor(lo: number, hi: number): string {
  const dE = Math.abs(LEVELS[hi].energy - LEVELS[lo].energy);
  if (dE > 12) return "#8a2be2";
  if (dE > 10) return "#6a5acd";
  if (dE > 3)  return "#4169e1";
  if (dE > 1.8) return "#ff4500";
  return "#00ced1";
}

function tWl(lo: number, hi: number): number {
  return Math.max(8, Math.min(28, 30 - Math.abs(LEVELS[hi].energy - LEVELS[lo].energy) * 1.5));
}

function hex2rgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

const SPEED = 160;
const ANIM_DUR = 0.4;

const AbsorptionAndEmissionOfLightFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("absorption-and-emission-of-light") as SimulationConfig;

  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  let W = 0, H = 0, time = 0, atomX = 0, atomY = 0;
  let eLevel = 0, moving = false, mDir: "up" | "down" = "up";
  let mFrom = 0, mTo = 0, mProg = 0, excTimer = 0;
  let photons: Photon[] = [], spawnT = 0, absN = 0, emN = 0;
  let pLevel = 2, pEnergy = 10.2, pSpeed = 1;

  const layout = () => { atomX = W * 0.38; atomY = H * 0.5; };

  function spawn(incoming: boolean, lo: number, hi: number, ox?: number, oy?: number): void {
    const col = tColor(lo, hi), wl = tWl(lo, hi);
    let x: number, y: number, vx: number, vy: number;
    if (incoming) {
      x = -30; y = atomY + (Math.random() - 0.5) * 40;
      const dx = atomX - x, dy = atomY - y, d = Math.hypot(dx, dy);
      vx = (dx / d) * SPEED; vy = (dy / d) * SPEED;
    } else {
      x = ox!; y = oy!;
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a) * SPEED; vy = Math.sin(a) * SPEED;
      emN++;
    }
    photons.push({ x, y, vx, vy, color: col, wl, alive: true,
      phase: Math.random() * Math.PI * 2, incoming, fromLevel: lo, toLevel: hi });
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!;
    W = canvas.width; H = canvas.height;
    time = 0; spawnT = 0; absN = 0; emN = 0;
    eLevel = 0; moving = false; excTimer = 0; photons = [];
    layout();
  }

  function update(dt: number, params: Record<string, number>): void {
    pLevel = Math.max(1, Math.min(4, Math.round(params.energyLevel ?? 2)));
    const ui = Math.min(pLevel, 3);
    pEnergy = Math.abs(LEVELS[ui].energy - LEVELS[0].energy);
    pSpeed = params.animationSpeed ?? 1;
    const eDt = dt * pSpeed;
    time += eDt;

    spawnT += eDt;
    while (spawnT >= 1.2) { spawnT -= 1.2; spawn(true, 0, ui); }

    for (const p of photons) {
      if (!p.alive) continue;
      p.x += p.vx * eDt; p.y += p.vy * eDt;
      if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) p.alive = false;
    }

    for (const p of photons) {
      if (!p.alive || !p.incoming || moving) continue;
      if (Math.hypot(p.x - atomX, p.y - atomY) < LEVELS[eLevel].radius + 12 && eLevel === p.fromLevel) {
        p.alive = false; moving = true; mDir = "up";
        mFrom = eLevel; mTo = p.toLevel; mProg = 0; absN++;
      }
    }

    if (moving) {
      mProg += eDt / ANIM_DUR;
      if (mProg >= 1) {
        mProg = 1; moving = false; eLevel = mTo;
        if (mDir === "up") excTimer = 0.6 + Math.random() * 1.2;
        else spawn(false, mFrom, mTo, atomX, atomY);
      }
    }

    if (eLevel > 0 && !moving) {
      excTimer -= eDt;
      if (excTimer <= 0) { moving = true; mDir = "down"; mFrom = eLevel; mTo = 0; mProg = 0; }
    }

    photons = photons.filter((p) => p.alive);
  }

  function render(): void {
    // Background
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, "#0a0a22"); bg.addColorStop(1, "#020210");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Atom orbits
    for (let i = 0; i < LEVELS.length; i++) {
      const r = LEVELS[i].radius;
      ctx.beginPath(); ctx.arc(atomX, atomY, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100,170,255,${i <= eLevel ? 0.4 : 0.15})`;
      ctx.lineWidth = 1; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(160,185,230,0.4)"; ctx.font = "10px system-ui,sans-serif";
      ctx.textAlign = "left"; ctx.fillText(`n=${LEVELS[i].n}`, atomX + r + 4, atomY - 3);
    }

    // Nucleus glow + body
    const ng = ctx.createRadialGradient(atomX, atomY, 0, atomX, atomY, 30);
    ng.addColorStop(0, "rgba(255,130,70,0.35)"); ng.addColorStop(1, "rgba(255,130,70,0)");
    ctx.beginPath(); ctx.arc(atomX, atomY, 30, 0, Math.PI * 2); ctx.fillStyle = ng; ctx.fill();
    const nucs = [[0,0,1],[4,3,0],[-3,4,1],[-4,-2,0],[2,-4,1],[5,-1,0],[-1,-5,1]];
    for (const [dx, dy, t] of nucs) {
      const c = t ? "#6ba3ff" : "#ff6b4a";
      const g = ctx.createRadialGradient(atomX+dx-1, atomY+dy-1, 0, atomX+dx, atomY+dy, 4);
      g.addColorStop(0, "#fff"); g.addColorStop(0.4, c); g.addColorStop(1, c + "66");
      ctx.beginPath(); ctx.arc(atomX+dx, atomY+dy, 3.8, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    }

    // Electron
    let eR: number, eA: number;
    if (moving) {
      const ease = 1 - Math.pow(1 - mProg, 3);
      eR = LEVELS[mFrom].radius + (LEVELS[mTo].radius - LEVELS[mFrom].radius) * ease;
      eA = time * 4 + mProg * Math.PI;
    } else { eR = LEVELS[eLevel].radius; eA = time * 2.5; }
    const ex = atomX + eR * Math.cos(eA), ey = atomY + eR * Math.sin(eA);
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 14);
    eg.addColorStop(0, "rgba(100,210,255,0.7)"); eg.addColorStop(1, "rgba(100,210,255,0)");
    ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fillStyle = eg; ctx.fill();
    const eb = ctx.createRadialGradient(ex-1, ey-1, 0, ex, ey, 5);
    eb.addColorStop(0, "#fff"); eb.addColorStop(0.5, "#64d4ff"); eb.addColorStop(1, "#2090d0");
    ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fillStyle = eb; ctx.fill();

    // Flash on transition
    if (moving && mProg < 0.5) {
      const a = (1 - mProg * 2) * 0.4;
      const [cr, cg, cb] = hex2rgb(tColor(Math.min(mFrom, mTo), Math.max(mFrom, mTo)));
      const fr = LEVELS[Math.max(mFrom, mTo)].radius + 20;
      const fg = ctx.createRadialGradient(atomX, atomY, 0, atomX, atomY, fr);
      fg.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); fg.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.beginPath(); ctx.arc(atomX, atomY, fr, 0, Math.PI * 2); ctx.fillStyle = fg; ctx.fill();
    }

    // Photons
    for (const p of photons) {
      if (!p.alive) continue;
      const [r, g, b] = hex2rgb(p.color);
      const sp = Math.hypot(p.vx, p.vy), dxN = p.vx / sp, dyN = p.vy / sp;
      const px = -dyN, py = dxN;
      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
      pg.addColorStop(0, `rgba(${r},${g},${b},0.4)`); pg.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fillStyle = pg; ctx.fill();
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) {
        const t = s / 24, al = (t - 0.5) * 42;
        const env = 1 - Math.pow(2 * t - 1, 2);
        const w = Math.sin((al / p.wl) * Math.PI * 2 + p.phase + time * 10) * 7 * env;
        const qx = p.x + dxN * al + px * w, qy = p.y + dyN * al + py * w;
        s === 0 ? ctx.moveTo(qx, qy) : ctx.lineTo(qx, qy);
      }
      ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`; ctx.lineWidth = 2.5;
      ctx.shadowColor = `rgba(${r},${g},${b},0.8)`; ctx.shadowBlur = 10;
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fill();
    }

    // Energy level diagram
    const dX = W * 0.68, dW = W * 0.28, dY = H * 0.06, dH = H * 0.88;
    ctx.fillStyle = "rgba(8,8,28,0.65)";
    ctx.beginPath(); ctx.roundRect(dX - 12, dY - 12, dW + 24, dH + 24, 12); ctx.fill();
    ctx.strokeStyle = "rgba(70,90,150,0.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(dX - 12, dY - 12, dW + 24, dH + 24, 12); ctx.stroke();
    ctx.fillStyle = "rgba(200,215,245,0.92)"; ctx.font = "bold 13px system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.fillText("Energy Level Diagram", dX + dW / 2, dY + 10);

    const lT = dY + 32, lB = dY + dH - 40, lH = lB - lT;
    const minE = LEVELS[0].energy, rng = LEVELS[3].energy - minE;
    const eToY = (e: number) => lB - ((e - minE) / rng) * lH;
    const x1 = dX + 18, x2 = dX + dW - 18;

    for (let i = 0; i < LEVELS.length; i++) {
      const ly = eToY(LEVELS[i].energy), cur = !moving && eLevel === i;
      ctx.beginPath(); ctx.moveTo(x1, ly); ctx.lineTo(x2, ly);
      ctx.strokeStyle = cur ? "rgba(100,200,255,0.85)" : "rgba(140,170,240,0.6)";
      ctx.lineWidth = cur ? 2.5 : 1.8; ctx.stroke();
      ctx.fillStyle = cur ? "rgba(100,220,255,0.95)" : "rgba(170,195,240,0.85)";
      ctx.font = cur ? "bold 12px system-ui,sans-serif" : "11px system-ui,sans-serif";
      ctx.textAlign = "right"; ctx.fillText(`n=${LEVELS[i].n}`, x1 - 5, ly + 4);
      ctx.textAlign = "left"; ctx.fillStyle = "rgba(130,155,200,0.7)";
      ctx.font = "10px system-ui,sans-serif";
      ctx.fillText(`${LEVELS[i].energy.toFixed(2)} eV`, x2 + 5, ly + 4);
      if (cur) {
        const dx = (x1 + x2) / 2;
        ctx.beginPath(); ctx.arc(dx, ly - 8, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#64d4ff"; ctx.fill();
        const dg = ctx.createRadialGradient(dx, ly - 8, 0, dx, ly - 8, 10);
        dg.addColorStop(0, "rgba(100,212,255,0.5)"); dg.addColorStop(1, "rgba(100,212,255,0)");
        ctx.beginPath(); ctx.arc(dx, ly - 8, 10, 0, Math.PI * 2); ctx.fillStyle = dg; ctx.fill();
      }
    }

    // Transition arrows
    const ui = Math.min(pLevel, 3);
    const loY = eToY(LEVELS[0].energy), hiY = eToY(LEVELS[ui].energy);
    const [cr, cg, cb] = hex2rgb(tColor(0, ui));
    const aX = x1 + (x2 - x1) * 0.3;
    ctx.beginPath(); ctx.moveTo(aX, loY - 5); ctx.lineTo(aX, hiY + 5);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.8)`; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(aX, hiY + 5); ctx.lineTo(aX - 5, hiY + 14); ctx.lineTo(aX + 5, hiY + 14);
    ctx.closePath(); ctx.fillStyle = `rgba(${cr},${cg},${cb},0.8)`; ctx.fill();
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.9)`; ctx.font = "9px system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.fillText("absorb", aX, (loY + hiY) / 2 + 4);
    const eX2 = x1 + (x2 - x1) * 0.7;
    ctx.beginPath(); ctx.moveTo(eX2, hiY + 5); ctx.lineTo(eX2, loY - 5);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.6)`; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(eX2, loY - 5); ctx.lineTo(eX2 - 5, loY - 14); ctx.lineTo(eX2 + 5, loY - 14);
    ctx.closePath(); ctx.fillStyle = `rgba(${cr},${cg},${cb},0.6)`; ctx.fill();
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.7)`; ctx.font = "9px system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.fillText("emit", eX2, (loY + hiY) / 2 + 4);

    ctx.fillStyle = "rgba(210,220,245,0.85)"; ctx.font = "12px system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.fillText(`\u0394E = ${pEnergy.toFixed(2)} eV`, dX + dW / 2, dY + dH - 10);
    ctx.beginPath();
    for (let s = 0; s <= 18; s++) {
      const t = s / 18, px2 = dX + dW / 2 - 22 + t * 44;
      const py2 = dY + dH - 26 + Math.sin(t * Math.PI * 4 + time * 6) * 3;
      s === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
    }
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.55)`; ctx.lineWidth = 1.5; ctx.stroke();

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); ctx.roundRect(10, 10, 280, 32, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "12px system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t=${time.toFixed(1)}s | n=${LEVELS[eLevel].n} | Absorbed: ${absN} | Emitted: ${emN}`, 20, 31);
  }

  function reset(): void {
    time = 0; spawnT = 0; absN = 0; emN = 0;
    eLevel = 0; moving = false; excTimer = 0; photons = [];
  }

  function destroy(): void { photons = []; }

  function getStateDescription(): string {
    const ui = Math.min(pLevel, 3);
    const st = moving
      ? `transitioning ${mDir} from n=${LEVELS[mFrom].n} to n=${LEVELS[mTo].n}`
      : eLevel > 0 ? `excited at n=${LEVELS[eLevel].n}` : "ground state n=1";
    return `Absorption & Emission of Light: Bohr atom, transition n=1\u2192n=${LEVELS[ui].n} ` +
      `(\u0394E=${pEnergy.toFixed(2)} eV). Electron ${st}. ` +
      `Absorbed: ${absN}, Emitted: ${emN}. Speed: ${pSpeed}x. Time: ${time.toFixed(1)}s.`;
  }

  function resize(w: number, h: number): void { W = w; H = h; layout(); }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default AbsorptionAndEmissionOfLightFactory;
