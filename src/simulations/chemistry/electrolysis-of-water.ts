import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Bubble { x: number; y: number; r: number; spd: number; phase: number; a: number; }
interface Elec { pos: number; spd: number; }

const ElectrolysisOfWaterFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("electrolysis-of-water") as SimulationConfig;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
  let W = 0, H = 0, time = 0;
  let voltage = 6, current = 2, elStrength = 1, timeScale = 1;
  let h2Vol = 0, o2Vol = 0, bubbleTimer = 0;
  let cathBubbles: Bubble[] = [], anBubbles: Bubble[] = [], electrons: Elec[] = [];
  const MAX_VOL = 50;

  // Layout (recalculated on resize)
  let cx = 0, tw = 0, th = 0, tTop = 0, tBot = 0;
  let lx = 0, rx = 0, connY = 0, elecY = 0, wsBase = 0;
  let psX = 0, psY = 0, psW = 0, psH = 0;

  function layout(): void {
    cx = W / 2; tw = Math.max(36, W * 0.07); th = H * 0.48;
    tTop = H * 0.12; tBot = tTop + th; connY = tBot + H * 0.06; elecY = connY - 8;
    lx = cx - tw * 1.8; rx = cx + tw * 1.8; wsBase = tTop + th * 0.08;
    psW = Math.max(60, W * 0.12); psH = Math.max(30, H * 0.06);
    psX = cx - psW / 2; psY = H * 0.88;
  }

  function initEntities(): void {
    cathBubbles = []; anBubbles = []; electrons = [];
    for (let i = 0; i < 10; i++) electrons.push({ pos: Math.random(), spd: 0.06 + Math.random() * 0.03 });
  }

  function spawn(isH2: boolean): void {
    const tx = isH2 ? lx : rx, sz = isH2 ? [1.5, 3.5] : [2, 4.5];
    const b: Bubble = { x: tx + (Math.random() - 0.5) * tw * 0.3, y: elecY - 4,
      r: sz[0] + Math.random() * (sz[1] - sz[0]), spd: 25 + Math.random() * 20,
      phase: Math.random() * Math.PI * 2, a: 0.5 + Math.random() * 0.3 };
    (isH2 ? cathBubbles : anBubbles).push(b);
  }

  const gasFrac = (v: number) => Math.min(v / MAX_VOL, 1);
  const waterY = (v: number) => wsBase + gasFrac(v) * th * 0.75;
  const fs = (min: number, max: number) => Math.max(min, Math.min(max, W / 60));

  function drawBg(): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#070b1a"); g.addColorStop(1, "#0d1525");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function drawTube(tx: number, vol: number, label: string, gc: string, left: boolean): void {
    const hw = tw / 2, l = tx - hw, r = tx + hw;
    // Tube outline with rounded sealed top
    ctx.strokeStyle = "rgba(140,180,220,0.45)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(l, tBot); ctx.lineTo(l, tTop + hw);
    ctx.arc(tx, tTop + hw, hw, Math.PI, 0, false); ctx.lineTo(r, tBot); ctx.stroke();
    // Glass fill
    ctx.fillStyle = "rgba(100,150,200,0.03)";
    ctx.beginPath(); ctx.moveTo(l, tBot); ctx.lineTo(l, tTop + hw);
    ctx.arc(tx, tTop + hw, hw, Math.PI, 0, false); ctx.lineTo(r, tBot); ctx.closePath(); ctx.fill();
    // Water fill
    const wy = waterY(vol);
    if (wy < tBot) {
      const wg = ctx.createLinearGradient(0, wy, 0, tBot);
      wg.addColorStop(0, "rgba(30,100,180,0.35)"); wg.addColorStop(1, "rgba(20,70,140,0.45)");
      ctx.fillStyle = wg; ctx.beginPath();
      ctx.moveTo(l + 2, tBot); ctx.lineTo(l + 2, Math.max(wy, tTop + hw));
      if (wy < tTop + hw) ctx.arc(tx, tTop + hw, hw - 2, Math.PI, 0, false);
      ctx.lineTo(r - 2, Math.max(wy, tTop + hw)); ctx.lineTo(r - 2, tBot); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(100,200,255,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(l + 3, wy); ctx.lineTo(r - 3, wy); ctx.stroke();
    }
    // Gas region
    if (gasFrac(vol) > 0.005) {
      const gg = ctx.createLinearGradient(0, tTop, 0, wy);
      gg.addColorStop(0, gc); gg.addColorStop(1, gc.replace(/[\d.]+\)$/, "0.03)"));
      ctx.fillStyle = gg; ctx.beginPath();
      ctx.moveTo(l + 2, wy); ctx.lineTo(l + 2, tTop + hw);
      ctx.arc(tx, tTop + hw, hw - 2, Math.PI, 0, false);
      ctx.lineTo(r - 2, wy); ctx.closePath(); ctx.fill();
    }
    // Graduation marks
    const mEnd = wsBase + th * 0.75, sz = Math.max(7, Math.min(9, W / 90));
    ctx.font = `${sz}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 0.8;
    ctx.textAlign = left ? "right" : "left"; ctx.textBaseline = "middle";
    for (let i = 0; i <= 10; i++) {
      const f = i / 10, my = wsBase + f * (mEnd - wsBase), ml = i % 5 === 0 ? 8 : 4;
      ctx.beginPath();
      if (left) { ctx.moveTo(l - 1, my); ctx.lineTo(l - 1 - ml, my); }
      else { ctx.moveTo(r + 1, my); ctx.lineTo(r + 1 + ml, my); }
      ctx.stroke();
      if (i % 5 === 0) ctx.fillText(`${Math.round(f * MAX_VOL)}`, left ? l - ml - 3 : r + ml + 3, my);
    }
    // Labels
    const vf = fs(10, 12);
    ctx.font = `bold ${vf}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(`${vol.toFixed(1)} mL`, tx, tTop - 4);
    ctx.font = `${vf}px system-ui,sans-serif`;
    ctx.fillStyle = label === "H\u2082" ? "rgba(100,220,255,0.8)" : "rgba(255,150,100,0.8)";
    ctx.fillText(label, tx, tTop - 18);
  }

  function drawVessel(): void {
    ctx.strokeStyle = "rgba(140,180,220,0.45)"; ctx.lineWidth = 2;
    // Tube extensions and horizontal connector
    [[lx, -1], [lx, 1], [rx, -1], [rx, 1]].forEach(([x, s]) => {
      ctx.beginPath(); ctx.moveTo(x + (s as number) * tw / 2, tBot);
      ctx.lineTo(x + (s as number) * tw / 2, connY); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(lx - tw / 2, connY); ctx.lineTo(rx + tw / 2, connY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx + tw / 2, tBot); ctx.lineTo(rx - tw / 2, tBot); ctx.stroke();
    // Water fill in connector
    const wg = ctx.createLinearGradient(0, tBot, 0, connY);
    wg.addColorStop(0, "rgba(30,100,180,0.4)"); wg.addColorStop(1, "rgba(25,80,150,0.5)");
    ctx.fillStyle = wg;
    ctx.fillRect(lx - tw / 2 + 2, tBot, tw - 4, connY - tBot - 2);
    ctx.fillRect(rx - tw / 2 + 2, tBot, tw - 4, connY - tBot - 2);
    ctx.fillRect(lx + tw / 2, tBot, rx - lx - tw, connY - tBot - 2);
    // Electrolyte label
    ctx.font = `${Math.max(8, Math.min(10, W / 70))}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("H\u2082O + H\u2082SO\u2084 (electrolyte)", cx, (tBot + connY) / 2);
  }

  function drawElectrodes(): void {
    const pw = 6, ph = tw * 0.7;
    // Draw each electrode plate
    [[lx, "#5a6a7a", "#8a9aaa", "#4a5a6a"], [rx, "#6a5a50", "#9a8a7a", "#5a4a40"]].forEach(([x, c1, c2, c3]) => {
      const g = ctx.createLinearGradient((x as number) - pw, 0, (x as number) + pw, 0);
      g.addColorStop(0, c1 as string); g.addColorStop(0.5, c2 as string); g.addColorStop(1, c3 as string);
      ctx.fillStyle = g; ctx.fillRect((x as number) - pw, elecY - ph, pw * 2, ph);
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 0.5;
      ctx.strokeRect((x as number) - pw, elecY - ph, pw * 2, ph);
    });
    // Labels
    const sz = fs(9, 11);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.font = `bold ${sz}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(100,200,255,0.8)"; ctx.fillText("Cathode (\u2212)", lx, connY + 6);
    ctx.font = `${sz - 1}px system-ui,sans-serif`; ctx.fillStyle = "rgba(100,200,255,0.55)";
    ctx.fillText("2H\u2082O + 2e\u207B \u2192 H\u2082\u2191 + 2OH\u207B", lx, connY + 20);
    ctx.font = `bold ${sz}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(255,150,100,0.8)"; ctx.fillText("Anode (+)", rx, connY + 6);
    ctx.font = `${sz - 1}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,150,100,0.55)";
    ctx.fillText("2H\u2082O \u2192 O\u2082\u2191 + 4H\u207A + 4e\u207B", rx, connY + 20);
  }

  function drawPowerSupply(): void {
    ctx.fillStyle = "rgba(40,50,65,0.9)"; ctx.beginPath();
    ctx.roundRect(psX, psY, psW, psH, 6); ctx.fill();
    ctx.strokeStyle = "rgba(180,180,180,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
    const sz = fs(9, 11);
    ctx.font = `bold ${sz}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("DC Power Supply", cx, psY + psH / 2 - 6);
    ctx.font = `${sz - 1}px system-ui,sans-serif`; ctx.fillStyle = "#34d399";
    ctx.fillText(`${voltage.toFixed(1)}V  ${current.toFixed(1)}A`, cx, psY + psH / 2 + 8);
    // Terminals
    const tr = 5;
    [{ x: psX + 12, c: "rgba(100,200,255,0.8)", s: "\u2212" },
     { x: psX + psW - 12, c: "rgba(255,150,100,0.8)", s: "+" }].forEach(t => {
      ctx.beginPath(); ctx.arc(t.x, psY, tr, 0, Math.PI * 2);
      ctx.fillStyle = t.c; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `bold ${tr * 2}px system-ui,sans-serif`;
      ctx.textBaseline = "middle"; ctx.fillText(t.s, t.x, psY - 1);
    });
  }

  function drawWires(): void {
    ctx.setLineDash([]);
    // Negative wire (to cathode)
    ctx.strokeStyle = "rgba(100,180,255,0.5)"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(psX + 12, psY); ctx.lineTo(psX + 12, psY - 15);
    ctx.lineTo(lx, psY - 15); ctx.lineTo(lx, connY); ctx.stroke();
    // Positive wire (to anode)
    ctx.strokeStyle = "rgba(255,150,100,0.5)"; ctx.beginPath();
    ctx.moveTo(psX + psW - 12, psY); ctx.lineTo(psX + psW - 12, psY - 15);
    ctx.lineTo(rx, psY - 15); ctx.lineTo(rx, connY); ctx.stroke();
    // Animated electrons
    const rate = (voltage / 6) * (current / 2) * elStrength;
    if (rate < 0.05) return;
    for (const e of electrons) {
      const t = e.pos; let ex: number, ey: number;
      // Path: anode -> PS+ -> PS- -> cathode
      const segs: [number, number, () => [number, number]][] = [
        [0, 0.2, () => [rx, connY + (t / 0.2) * (psY - 15 - connY)]],
        [0.2, 0.35, () => [rx + ((t - 0.2) / 0.15) * (psX + psW - 12 - rx), psY - 15]],
        [0.35, 0.45, () => [psX + psW - 12, psY - 15 + ((t - 0.35) / 0.1) * 15]],
        [0.45, 0.55, () => [(psX + psW - 12) - ((t - 0.45) / 0.1) * (psW - 24), psY]],
        [0.55, 0.65, () => [psX + 12, psY - ((t - 0.55) / 0.1) * 15]],
        [0.65, 0.8, () => [psX + 12 + ((t - 0.65) / 0.15) * (lx - psX - 12), psY - 15]],
        [0.8, 1.01, () => [lx, psY - 15 - ((t - 0.8) / 0.2) * (psY - 15 - connY)]],
      ];
      const seg = segs.find(s => t >= s[0] && t < s[1])!;
      [ex, ey] = seg[2]();
      ctx.beginPath(); ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,200,255,0.75)"; ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,200,255,0.12)"; ctx.fill();
    }
    ctx.font = `${Math.max(8, Math.min(10, W / 75))}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(80,200,255,0.5)"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("e\u207B flow \u2192", cx, psY - 18);
  }

  function drawBubbles(bubbles: Bubble[], c: string): void {
    for (const b of bubbles) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = c.replace("ALPHA", String(b.a * 0.6)); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${b.a * 0.35})`; ctx.fill();
    }
  }

  function drawOverlays(): void {
    // Title and equation
    const tf = Math.max(13, Math.min(17, W / 40));
    ctx.font = `bold ${tf}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("Electrolysis of Water", cx, H * 0.015);
    ctx.font = `${Math.max(10, Math.min(13, W / 50))}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(120,200,255,0.7)";
    ctx.fillText("2H\u2082O  \u2192  2H\u2082\u2191 + O\u2082\u2191", cx, H * 0.015 + 22);
    // Volume ratio panel
    const pw = Math.min(W * 0.32, 220), ph = 60, px = W - pw - 8, py = 8, sf = fs(9, 11);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = `bold ${sf + 1}px system-ui,sans-serif`; ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText("Volume Ratio", px + 10, py + 6);
    ctx.font = `${sf}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(100,220,255,0.7)"; ctx.fillText(`H\u2082: ${h2Vol.toFixed(1)} mL`, px + 10, py + 23);
    ctx.fillStyle = "rgba(255,150,100,0.7)"; ctx.fillText(`O\u2082: ${o2Vol.toFixed(1)} mL`, px + 10, py + 38);
    const ratio = o2Vol > 0.1 ? (h2Vol / o2Vol).toFixed(2) : "\u2014";
    ctx.font = `bold ${sf}px system-ui,sans-serif`; ctx.fillStyle = "rgba(52,211,153,0.8)";
    ctx.textAlign = "right"; ctx.fillText(`H\u2082:O\u2082 = ${ratio}:1`, px + pw - 10, py + 30);
    // Time
    ctx.font = `${Math.max(8, Math.min(10, W / 75))}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(`t = ${time.toFixed(1)}s`, 8, H - 6);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!;
    W = canvas.width; H = canvas.height; time = 0; h2Vol = 0; o2Vol = 0;
    layout(); initEntities();
  }

  function update(dt: number, params: Record<string, number>): void {
    voltage = params.voltage ?? 6; current = params.current ?? 2;
    elStrength = params.electrolyteStrength ?? 1; timeScale = params.timeScale ?? 1;
    const dtc = Math.min(dt, 0.05), dts = dtc * timeScale;
    time += dts;
    const minV = 1.23, effV = Math.max(0, voltage - minV);
    const rate = (effV / 10) * (current / 2) * elStrength, vRate = rate * 2.5;
    if (h2Vol < MAX_VOL) h2Vol = Math.min(h2Vol + vRate * dts, MAX_VOL);
    if (o2Vol < MAX_VOL * 0.5) o2Vol = Math.min(o2Vol + vRate * 0.5 * dts, MAX_VOL * 0.5);
    // Spawn bubbles
    bubbleTimer += dts;
    const interval = Math.max(0.02, 0.15 / Math.max(0.1, rate));
    while (bubbleTimer >= interval && rate > 0.01) {
      bubbleTimer -= interval; spawn(true); spawn(true); spawn(false);
    }
    // Update bubbles
    const updateBubs = (arr: Bubble[], tx: number, vol: number) => {
      const wy = waterY(vol);
      for (let i = arr.length - 1; i >= 0; i--) {
        const b = arr[i]; b.y -= b.spd * dts;
        b.x += Math.sin(time * 4 + b.phase) * 8 * dts;
        const hw = tw / 2 - b.r - 2;
        if (b.x < tx - hw) b.x = tx - hw;
        if (b.x > tx + hw) b.x = tx + hw;
        if (b.y <= wy || b.y < tTop) arr.splice(i, 1);
      }
      if (arr.length > 60) arr.splice(0, arr.length - 60);
    };
    updateBubs(cathBubbles, lx, h2Vol); updateBubs(anBubbles, rx, o2Vol);
    for (const e of electrons) e.pos = (e.pos + e.spd * dts * Math.max(0.2, rate)) % 1;
  }

  function render(): void {
    if (!ctx || W === 0 || H === 0) return;
    drawBg(); drawVessel();
    drawTube(lx, h2Vol, "H\u2082", "rgba(100,200,255,0.12)", true);
    drawTube(rx, o2Vol, "O\u2082", "rgba(255,160,100,0.12)", false);
    drawElectrodes();
    drawBubbles(cathBubbles, "rgba(120,210,255,ALPHA)");
    drawBubbles(anBubbles, "rgba(255,170,110,ALPHA)");
    drawWires(); drawPowerSupply(); drawOverlays();
  }

  function reset(): void {
    time = 0; h2Vol = 0; o2Vol = 0; bubbleTimer = 0; layout(); initEntities();
  }

  function destroy(): void { cathBubbles = []; anBubbles = []; electrons = []; }

  function getStateDescription(): string {
    const effV = Math.max(0, voltage - 1.23);
    const ratio = o2Vol > 0.1 ? (h2Vol / o2Vol).toFixed(2) : "N/A";
    return `Electrolysis of Water | Applied voltage: ${voltage.toFixed(1)} V (effective: ${effV.toFixed(1)} V above 1.23 V min) | ` +
      `Current: ${current.toFixed(1)} A | Electrolyte strength: ${elStrength.toFixed(1)} | ` +
      `H\u2082: ${h2Vol.toFixed(1)} mL (cathode) | O\u2082: ${o2Vol.toFixed(1)} mL (anode) | ` +
      `H\u2082:O\u2082 = ${ratio}:1 (expected 2:1) | 2H\u2082O \u2192 2H\u2082\u2191 + O\u2082\u2191 | ` +
      `Time: ${time.toFixed(1)}s | Speed: ${timeScale}x`;
  }

  function resize(w: number, h: number): void { W = w; H = h; layout(); initEntities(); }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ElectrolysisOfWaterFactory;
