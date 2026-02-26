import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface TrailPt { x: number; y: number; }

const RealOrbitOfEarthAndMoonFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("real-orbit-of-earth-and-moon") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800, H = 600, time = 0;
  let timeScale = 10, zoom = 1.0, showMoonOrbit = 1, showEarthOrbit = 1;

  // Orbital constants
  const earthPeriod = 365.25, moonPeriod = 27.32;
  const earthW = (2 * Math.PI) / earthPeriod, moonW = (2 * Math.PI) / moonPeriod;
  const earthR = 220, moonR = 18; // px (moon exaggerated but still convex)
  let earthAngle = 0, moonAngle = 0;
  let earthTrail: TrailPt[] = [], moonTrail: TrailPt[] = [];
  const maxTrail = 2000;

  const earthPos = () => ({ x: W / 2 + earthR * zoom * Math.cos(earthAngle), y: H / 2 + earthR * zoom * Math.sin(earthAngle) });
  const moonPos = () => { const e = earthPos(); return { x: e.x + moonR * zoom * Math.cos(moonAngle), y: e.y + moonR * zoom * Math.sin(moonAngle) }; };

  function init(c: HTMLCanvasElement): void {
    canvas = c; ctx = canvas.getContext("2d")!; W = canvas.width; H = canvas.height;
    time = 0; earthAngle = 0; moonAngle = 0; earthTrail = []; moonTrail = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 10; zoom = params.zoom ?? 1.0;
    showMoonOrbit = Math.round(params.showMoonOrbit ?? 1); showEarthOrbit = Math.round(params.showEarthOrbit ?? 1);
    const step = Math.min(dt, 0.033), days = step * timeScale;
    earthAngle += earthW * days; moonAngle += moonW * days;
    if (earthAngle > Math.PI * 200) { earthAngle -= Math.PI * 200; moonAngle -= Math.PI * 200; }
    const ep = earthPos(), mp = moonPos();
    if (showEarthOrbit) { earthTrail.push({ x: ep.x, y: ep.y }); if (earthTrail.length > maxTrail) earthTrail.shift(); }
    if (showMoonOrbit) { moonTrail.push({ x: mp.x, y: mp.y }); if (moonTrail.length > maxTrail) moonTrail.shift(); }
    time += days;
  }

  function drawStarfield(): void {
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, "#0a0a1e"); bg.addColorStop(1, "#050510"); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 120; i++) { ctx.beginPath(); ctx.arc(rng() * W, rng() * H, 0.3 + rng(), 0, Math.PI * 2); ctx.fill(); }
  }

  function drawSun(): void {
    const cx = W / 2, cy = H / 2;
    const og = ctx.createRadialGradient(cx, cy, 5, cx, cy, 60);
    og.addColorStop(0, "rgba(255,200,50,0.3)"); og.addColorStop(1, "rgba(255,100,0,0)");
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.fill();
    const sg = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 16);
    sg.addColorStop(0, "#fffbe8"); sg.addColorStop(0.4, "#fbbf24"); sg.addColorStop(1, "#d97706");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fbbf24"; ctx.font = "bold 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("Sun", cx, cy + 28);
  }

  function drawOrbitGuide(): void {
    if (!showEarthOrbit) return;
    ctx.strokeStyle = "rgba(100,140,200,0.15)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, earthR * zoom, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawTrails(): void {
    if (showEarthOrbit && earthTrail.length > 1) {
      ctx.lineWidth = 1.5;
      for (let i = 1; i < earthTrail.length; i++) {
        ctx.strokeStyle = `rgba(59,130,246,${(i / earthTrail.length) * 0.6})`;
        ctx.beginPath(); ctx.moveTo(earthTrail[i - 1].x, earthTrail[i - 1].y); ctx.lineTo(earthTrail[i].x, earthTrail[i].y); ctx.stroke();
      }
    }
    if (showMoonOrbit && moonTrail.length > 1) {
      ctx.lineWidth = 1;
      for (let i = 1; i < moonTrail.length; i++) {
        ctx.strokeStyle = `rgba(200,200,210,${(i / moonTrail.length) * 0.7})`;
        ctx.beginPath(); ctx.moveTo(moonTrail[i - 1].x, moonTrail[i - 1].y); ctx.lineTo(moonTrail[i].x, moonTrail[i].y); ctx.stroke();
      }
    }
  }

  function drawEarth(): void {
    const ep = earthPos();
    const eg = ctx.createRadialGradient(ep.x, ep.y, 4, ep.x, ep.y, 20);
    eg.addColorStop(0, "rgba(59,130,246,0.3)"); eg.addColorStop(1, "rgba(59,130,246,0)");
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ep.x, ep.y, 20, 0, Math.PI * 2); ctx.fill();
    const eb = ctx.createRadialGradient(ep.x - 2, ep.y - 2, 0, ep.x, ep.y, 8);
    eb.addColorStop(0, "#93c5fd"); eb.addColorStop(0.5, "#3b82f6"); eb.addColorStop(1, "#1e40af");
    ctx.fillStyle = eb; ctx.beginPath(); ctx.arc(ep.x, ep.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(34,197,94,0.4)"; ctx.beginPath(); ctx.arc(ep.x + 1, ep.y - 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#93c5fd"; ctx.font = "10px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("Earth", ep.x, ep.y + 18);
  }

  function drawMoon(): void {
    const mp = moonPos();
    const mg = ctx.createRadialGradient(mp.x - 1, mp.y - 1, 0, mp.x, mp.y, 4);
    mg.addColorStop(0, "#e5e7eb"); mg.addColorStop(0.6, "#9ca3af"); mg.addColorStop(1, "#6b7280");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mp.x, mp.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d1d5db"; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.fillText("Moon", mp.x, mp.y + 12);
    if (showMoonOrbit) {
      const ep = earthPos();
      ctx.strokeStyle = "rgba(200,200,210,0.12)"; ctx.lineWidth = 0.5; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, moonR * zoom, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    // Earth-Moon line
    const ep = earthPos();
    ctx.strokeStyle = "rgba(200,200,210,0.08)"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(ep.x, ep.y); ctx.lineTo(mp.x, mp.y); ctx.stroke();
  }

  function drawInfoPanel(): void {
    const px = 10, py = 10, pw = 250, ph = 170;
    ctx.fillStyle = "rgba(15,23,42,0.8)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 12px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Earth & Moon Orbits", px + 12, py + 22);
    ctx.font = "10px system-ui,sans-serif"; ctx.fillStyle = "#94a3b8"; let y = py + 42; const lh = 18;
    const days = time, years = days / 365.25, lm = days / moonPeriod;
    ctx.fillText(`Time: ${days.toFixed(1)} days (${years.toFixed(2)} yr)`, px + 12, y); y += lh;
    ctx.fillText(`Lunar months: ${lm.toFixed(1)}`, px + 12, y); y += lh;
    ctx.fillText(`Time scale: ${timeScale.toFixed(0)}x`, px + 12, y); y += lh;
    ctx.fillText(`Zoom: ${zoom.toFixed(1)}x`, px + 12, y); y += lh;
    ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui,sans-serif";
    ctx.fillText("Earth orbit: 1 AU (149.6M km)", px + 12, y); y += 14;
    ctx.fillText("Moon orbit: 384,400 km", px + 12, y);
  }

  function drawInsightPanel(): void {
    const pw = 260, ph = 90, px = W - pw - 10, py = H - ph - 10;
    ctx.fillStyle = "rgba(15,23,42,0.8)"; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 8); ctx.fill();
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = "#8b5cf6"; ctx.font = "bold 11px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Key Insight", px + 12, py + 18);
    ctx.fillStyle = "#c4b5fd"; ctx.font = "10px system-ui,sans-serif";
    ctx.fillText("The Moon's path around the Sun", px + 12, py + 36);
    ctx.fillText("is ALWAYS convex \u2014 it never loops", px + 12, py + 50);
    ctx.fillText("backward. The Sun's gravity dominates", px + 12, py + 64);
    ctx.fillText("over Earth's pull on the Moon.", px + 12, py + 78);
  }

  function drawScaleInfo(): void {
    ctx.fillStyle = "rgba(15,23,42,0.7)"; ctx.beginPath(); ctx.roundRect(W - 170, 15, 160, 48, 6); ctx.fill();
    ctx.fillStyle = "#94a3b8"; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Moon orbit exaggerated", W - 162, 31);
    ctx.fillText("for visibility (not to scale)", W - 162, 45);
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W - 162, 55); ctx.lineTo(W - 112, 55); ctx.stroke();
    ctx.fillText("~ 1 AU", W - 108, 58);
  }

  function render(): void {
    if (!ctx) return;
    drawStarfield(); drawOrbitGuide(); drawTrails(); drawSun(); drawEarth(); drawMoon();
    drawInfoPanel(); drawInsightPanel(); drawScaleInfo();
  }

  function reset(): void { time = 0; earthAngle = 0; moonAngle = 0; earthTrail = []; moonTrail = []; }
  function destroy(): void { earthTrail = []; moonTrail = []; }

  function getStateDescription(): string {
    const days = time, years = days / 365.25, lm = days / moonPeriod;
    return `Real Orbit of Earth and Moon: ${days.toFixed(1)} days (${years.toFixed(2)} yr), ${lm.toFixed(1)} lunar months. ` +
      `Time: ${timeScale}x, zoom: ${zoom}x. Earth angle: ${((earthAngle * 180 / Math.PI) % 360).toFixed(1)}\u00B0. ` +
      `Key insight: Moon's heliocentric path is always convex.`;
  }

  function resize(w: number, h: number): void {
    const dx = (w - W) / 2, dy = (h - H) / 2;
    for (const p of earthTrail) { p.x += dx; p.y += dy; }
    for (const p of moonTrail) { p.x += dx; p.y += dy; }
    W = w; H = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default RealOrbitOfEarthAndMoonFactory;
