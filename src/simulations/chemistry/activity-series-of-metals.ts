import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

// ─── Activity Series Data ───────────────────────────────────────────
const SERIES = ["K","Na","Ca","Mg","Al","Zn","Fe","Ni","Sn","Pb","H","Cu","Hg","Ag","Pt","Au"];

interface Metal { name: string; symbol: string; color: string; reactivityRank: number }
const DIPPABLE_METALS: Metal[] = [
  { name: "Magnesium", symbol: "Mg", color: "#b0b8c0", reactivityRank: 3 },
  { name: "Aluminum",  symbol: "Al", color: "#a8b4be", reactivityRank: 4 },
  { name: "Zinc",      symbol: "Zn", color: "#7b8ea0", reactivityRank: 5 },
  { name: "Iron",      symbol: "Fe", color: "#6b6b6b", reactivityRank: 6 },
  { name: "Nickel",    symbol: "Ni", color: "#8a9a6e", reactivityRank: 7 },
  { name: "Lead",      symbol: "Pb", color: "#4a5568", reactivityRank: 9 },
  { name: "Copper",    symbol: "Cu", color: "#c87533", reactivityRank: 11 },
];

interface Solution { name: string; formula: string; metalSymbol: string; color: string; fadedColor: string; reactivityRank: number }
const SOLUTIONS: Solution[] = [
  { name: "Copper Sulfate",  formula: "CuSO\u2084", metalSymbol: "Cu", color: "rgba(40,120,220,0.55)", fadedColor: "rgba(160,200,230,0.18)", reactivityRank: 11 },
  { name: "Silver Nitrate",  formula: "AgNO\u2083", metalSymbol: "Ag", color: "rgba(180,190,210,0.35)", fadedColor: "rgba(200,210,220,0.12)", reactivityRank: 13 },
  { name: "Lead Nitrate",    formula: "Pb(NO\u2083)\u2082", metalSymbol: "Pb", color: "rgba(170,180,200,0.30)", fadedColor: "rgba(190,200,210,0.12)", reactivityRank: 9 },
  { name: "Iron Sulfate",    formula: "FeSO\u2084", metalSymbol: "Fe", color: "rgba(70,160,100,0.40)", fadedColor: "rgba(150,190,160,0.15)", reactivityRank: 6 },
];

interface Bubble { x: number; y: number; r: number; speed: number; alpha: number }
interface Deposit { x: number; y: number; r: number; alpha: number }

// ─── Factory ────────────────────────────────────────────────────────
const ActivitySeriesOfMetalsFactory: SimulationFactory = () => {
  const config = getSimConfig("activity-series-of-metals")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600;

  let metalIdx = 2;       // default Zinc
  let solIdx = 0;          // default CuSO4
  let rxnSpeed = 1;
  let time = 0;
  let progress = 0;        // reaction progress 0-1
  let reacts = false;

  let bubbles: Bubble[] = [];
  let deposits: Deposit[] = [];

  // ── helpers ───────────────────────────────────────────────────────
  const bk = () => {
    const w = Math.min(W * 0.42, 320);
    const h = Math.min(H * 0.52, 340);
    const l = W * 0.08, t = H * 0.16;
    return { l, t, r: l + w, b: t + h, w, h, cx: l + w / 2 };
  };

  const solBounds = () => {
    const b = bk();
    const top = b.t + b.h * 0.18;
    return { l: b.l + 4, r: b.r - 4, t: top, b: b.b - 4, w: b.w - 8, h: b.b - 4 - top };
  };

  const plateRect = () => {
    const b = bk();
    const pw = 20 - progress * 6;
    const ph = b.h * 0.72;
    const cx = b.l + b.w * 0.38;
    return { l: cx - pw / 2, r: cx + pw / 2, t: b.t - 24, b: b.t - 24 + ph, w: pw, h: ph, cx };
  };

  function checkReaction() {
    reacts = DIPPABLE_METALS[metalIdx].reactivityRank < SOLUTIONS[solIdx].reactivityRank;
  }

  function spawnBubbles() {
    bubbles = [];
    for (let i = 0; i < 18; i++) {
      bubbles.push({ x: 0, y: 0, r: 1 + Math.random() * 2.5, speed: 20 + Math.random() * 40, alpha: 0.15 + Math.random() * 0.25 });
    }
  }

  function resetState() {
    time = 0; progress = 0; deposits = [];
    checkReaction();
    spawnBubbles();
  }

  // ── drawing ───────────────────────────────────────────────────────
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1120"); g.addColorStop(1, "#151d2e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawBeaker() {
    const b = bk();
    ctx.strokeStyle = "rgba(140,180,220,0.45)"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.l, b.t); ctx.lineTo(b.l - 5, b.b); ctx.lineTo(b.r + 5, b.b); ctx.lineTo(b.r, b.t);
    ctx.stroke();
    // spout
    ctx.beginPath(); ctx.moveTo(b.l, b.t); ctx.lineTo(b.l - 10, b.t - 7); ctx.stroke();
    // grad lines
    ctx.strokeStyle = "rgba(140,180,220,0.15)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = b.t + (b.h * i) / 5;
      ctx.beginPath(); ctx.moveTo(b.l + 4, y); ctx.lineTo(b.l + 16, y); ctx.stroke();
    }
    // glass highlight
    const hl = ctx.createLinearGradient(b.l, 0, b.l + 10, 0);
    hl.addColorStop(0, "rgba(200,230,255,0.12)"); hl.addColorStop(1, "rgba(200,230,255,0)");
    ctx.fillStyle = hl; ctx.fillRect(b.l + 1, b.t + 8, 10, b.h - 16);
  }

  function drawSolution() {
    const s = solBounds(), b = bk(), sol = SOLUTIONS[solIdx];
    const blend = reacts ? progress : 0;
    const parseC = (c: string) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      return m ? [+m[1], +m[2], +m[3], +m[4]] : [100, 150, 200, 0.3];
    };
    const a = parseC(sol.color), f = parseC(sol.fadedColor);
    const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
    const col = `rgba(${Math.round(lerp(a[0], f[0], blend))},${Math.round(lerp(a[1], f[1], blend))},${Math.round(lerp(a[2], f[2], blend))},${lerp(a[3], f[3], blend).toFixed(3)})`;

    const ti = ((s.t - b.t) / b.h) * 5, bi = ((s.b - b.t) / b.h) * 5;
    ctx.beginPath();
    ctx.moveTo(b.l + 3 - ti, s.t); ctx.lineTo(b.l + 3 - bi, s.b);
    ctx.lineTo(b.r - 3 + bi, s.b); ctx.lineTo(b.r - 3 + ti, s.t); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
    // surface line
    ctx.beginPath(); ctx.moveTo(b.l + 3 - ti, s.t); ctx.lineTo(b.r - 3 + ti, s.t);
    ctx.strokeStyle = "rgba(200,220,255,0.25)"; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawPlate() {
    const p = plateRect(), metal = DIPPABLE_METALS[metalIdx];
    const g = ctx.createLinearGradient(p.l, 0, p.r, 0);
    g.addColorStop(0, darken(metal.color, 0.2)); g.addColorStop(0.35, lighten(metal.color, 0.15));
    g.addColorStop(0.65, metal.color); g.addColorStop(1, darken(metal.color, 0.3));
    ctx.fillStyle = g; ctx.fillRect(p.l, p.t, p.w, p.h);
    ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(p.l + 2, p.t + 4, 3, p.h - 8);
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.strokeRect(p.l, p.t, p.w, p.h);
    // deposits on plate
    for (const d of deposits) {
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${SOLUTIONS[solIdx].metalSymbol === "Cu" ? "180,100,40" : SOLUTIONS[solIdx].metalSymbol === "Ag" ? "200,200,210" : SOLUTIONS[solIdx].metalSymbol === "Pb" ? "70,80,95" : "90,90,90"},${d.alpha.toFixed(2)})`;
      ctx.fill();
    }
    // label
    ctx.font = "bold 12px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center"; ctx.fillText(`${metal.symbol} strip`, p.cx, p.t - 10);
  }

  function drawBubbles() {
    if (!reacts || progress < 0.02) return;
    const s = solBounds(), p = plateRect();
    for (const bub of bubbles) {
      if (bub.y < s.t || bub.y > s.b) continue;
      ctx.beginPath(); ctx.arc(bub.x, bub.y, bub.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200,230,255,${bub.alpha.toFixed(2)})`; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }

  function drawActivityPanel() {
    const pw = Math.min(W * 0.2, 160), px = W - pw - 12, py = H * 0.06;
    const ih = 22, ph = SERIES.length * ih + 38;
    ctx.fillStyle = "rgba(20,30,50,0.88)"; ctx.strokeStyle = "#374151"; ctx.lineWidth = 1;
    rr(px, py, pw, ph, 6); ctx.fill(); ctx.stroke();

    ctx.font = "bold 12px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center"; ctx.fillText("Activity Series", px + pw / 2, py + 18);

    ctx.font = "11px 'Inter',system-ui,sans-serif"; ctx.textAlign = "left";
    const lt = py + 34;
    for (let i = 0; i < SERIES.length; i++) {
      const y = lt + i * ih;
      const sym = SERIES[i];
      const isPlate = sym === DIPPABLE_METALS[metalIdx].symbol;
      const isSol = sym === SOLUTIONS[solIdx].metalSymbol;
      if (isPlate) { ctx.fillStyle = "rgba(59,130,246,0.18)"; rr(px + 4, y - 2, pw - 8, ih - 2, 3); ctx.fill(); }
      if (isSol) { ctx.fillStyle = "rgba(234,179,8,0.18)"; rr(px + 4, y - 2, pw - 8, ih - 2, 3); ctx.fill(); }
      ctx.fillStyle = isPlate ? "#93c5fd" : isSol ? "#fde68a" : "#94a3b8";
      ctx.fillText(`${sym}${i < SERIES.length - 1 ? " >" : ""}`, px + 14, y + 12);
      if (isPlate) { ctx.fillStyle = "#60a5fa"; ctx.textAlign = "right"; ctx.fillText("PLATE", px + pw - 10, y + 12); ctx.textAlign = "left"; }
      if (isSol) { ctx.fillStyle = "#fbbf24"; ctx.textAlign = "right"; ctx.fillText("SOL", px + pw - 10, y + 12); ctx.textAlign = "left"; }
    }
    // arrow
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px + 7, lt + 4); ctx.lineTo(px + 7, lt + SERIES.length * ih - 10); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 4, lt + SERIES.length * ih - 16);
    ctx.lineTo(px + 7, lt + SERIES.length * ih - 10);
    ctx.lineTo(px + 10, lt + SERIES.length * ih - 16); ctx.stroke();
  }

  function drawInfoBar() {
    ctx.fillStyle = "rgba(20,30,50,0.85)"; ctx.fillRect(0, H - 52, W, 52);
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, H - 52); ctx.lineTo(W, H - 52); ctx.stroke();

    const metal = DIPPABLE_METALS[metalIdx], sol = SOLUTIONS[solIdx];
    ctx.font = "bold 14px 'Inter',system-ui,sans-serif"; ctx.textAlign = "center";
    if (reacts) {
      ctx.fillStyle = "#34d399";
      ctx.fillText(`${metal.symbol} + ${sol.formula} --> Reaction occurs (${metal.symbol} displaces ${sol.metalSymbol})`, W * 0.38, H - 28);
    } else {
      ctx.fillStyle = "#f87171";
      ctx.fillText(`${metal.symbol} + ${sol.formula} --> No reaction`, W * 0.38, H - 28);
    }
    ctx.font = "11px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText(reacts ? "More reactive metal displaces less reactive ion" : `${metal.symbol} is not reactive enough to displace ${sol.metalSymbol}`, W * 0.38, H - 10);
  }

  function drawTitle() {
    ctx.font = "bold 16px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center"; ctx.fillText("Activity Series of Metals", W * 0.32, 26);
    const sol = SOLUTIONS[solIdx];
    ctx.font = "12px 'Inter',system-ui,sans-serif"; ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Solution: ${sol.name} (${sol.formula})`, W * 0.32, 44);
  }

  // ── utilities ─────────────────────────────────────────────────────
  function lighten(hex: string, amt: number) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, Math.round(r + (255 - r) * amt))},${Math.min(255, Math.round(g + (255 - g) * amt))},${Math.min(255, Math.round(b + (255 - b) * amt))})`;
  }
  function darken(hex: string, amt: number) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
  }
  function rr(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // ── engine ────────────────────────────────────────────────────────
  function init(c: HTMLCanvasElement) {
    canvas = c; ctx = canvas.getContext("2d")!;
    W = canvas.width; H = canvas.height;
    resetState();
  }

  function update(dt: number, params: Record<string, number>) {
    const newM = Math.round(params.metalIndex ?? metalIdx);
    const newS = Math.round(params.solutionIndex ?? solIdx);
    const newSpd = params.reactionSpeed ?? rxnSpeed;
    if (newM !== metalIdx || newS !== solIdx) { metalIdx = newM; solIdx = newS; rxnSpeed = newSpd; resetState(); return; }
    rxnSpeed = newSpd;

    const cdt = Math.min(dt, 0.05);
    time += cdt * rxnSpeed;

    if (reacts) {
      progress = Math.min(progress + cdt * rxnSpeed * 0.12, 1);
      // spawn deposits
      if (Math.random() < cdt * rxnSpeed * 3 && progress < 0.95) {
        const p = plateRect(), s = solBounds();
        deposits.push({
          x: p.l + Math.random() * p.w,
          y: Math.max(s.t + 5, p.t + p.h * 0.3) + Math.random() * p.h * 0.5,
          r: 1.5 + Math.random() * 2.5, alpha: 0.6 + Math.random() * 0.4,
        });
        if (deposits.length > 50) deposits = deposits.slice(-50);
      }
    }

    // animate bubbles
    const p = plateRect(), s = solBounds();
    for (const bub of bubbles) {
      if (!reacts || progress < 0.02) { bub.y = s.b + 10; continue; }
      bub.y -= bub.speed * cdt * rxnSpeed;
      if (bub.y < s.t) {
        bub.y = s.b - 2;
        bub.x = p.cx + (Math.random() - 0.5) * 30;
        bub.r = 1 + Math.random() * 2.5;
      }
      bub.x += Math.sin(time * 3 + bub.r * 10) * 0.3;
    }
  }

  function render() {
    if (!ctx) return;
    drawBackground();
    drawTitle();
    drawSolution();
    drawBubbles();
    drawBeaker();
    drawPlate();
    drawActivityPanel();
    drawInfoBar();
  }

  function reset() {
    metalIdx = config.parameters.find(p => p.key === "metalIndex")?.defaultValue ?? 2;
    solIdx = config.parameters.find(p => p.key === "solutionIndex")?.defaultValue ?? 0;
    rxnSpeed = config.parameters.find(p => p.key === "reactionSpeed")?.defaultValue ?? 1;
    resetState();
  }

  function destroy() { bubbles = []; deposits = []; }

  function getStateDescription(): string {
    const m = DIPPABLE_METALS[metalIdx], s = SOLUTIONS[solIdx];
    if (reacts) {
      return `${m.symbol} strip placed in ${s.formula} solution. Reaction occurs: ${m.symbol} (rank ${m.reactivityRank}) is more reactive than ${s.metalSymbol} (rank ${s.reactivityRank}). ${s.metalSymbol} deposits on the ${m.symbol} strip and solution decolorizes. Progress: ${Math.round(progress * 100)}%. Activity series: ${SERIES.join(" > ")}.`;
    }
    return `${m.symbol} strip placed in ${s.formula} solution. No reaction: ${m.symbol} (rank ${m.reactivityRank}) is not more reactive than ${s.metalSymbol} (rank ${s.reactivityRank}). Activity series: ${SERIES.join(" > ")}.`;
  }

  function resize(w: number, h: number) { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ActivitySeriesOfMetalsFactory;
