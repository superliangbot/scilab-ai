import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface TrailPoint {
  eAngle: number;
  vAngle: number;
  elongation: number;
  phase: number;
}

const ApparentMotionOfVenusFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("apparent-motion-of-venus") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 0, H = 0, time = 0;
  let eAngle = 0, vAngle = 0;
  let trail: TrailPoint[] = [];

  // Orbital constants (days, AU)
  const V_OMEGA = (2 * Math.PI) / 225;
  const E_OMEGA = (2 * Math.PI) / 365.25;
  const V_AU = 0.723, E_AU = 1.0;

  let timeScale = 2, showSightLines = 1, showPhases = 1, trailLen = 50;

  const scale = () => Math.min(W, H) * 0.32;
  const sunXY = () => ({ x: W * 0.35, y: H * 0.5 });
  const bodyXY = (angle: number, au: number) => {
    const s = sunXY(), sc = scale();
    return { x: s.x + Math.cos(angle) * au * sc, y: s.y + Math.sin(angle) * au * sc };
  };

  function computeElongation(): number {
    const e = bodyXY(eAngle, E_AU), v = bodyXY(vAngle, V_AU), s = sunXY();
    const tvx = v.x - e.x, tvy = v.y - e.y;
    const tsx = s.x - e.x, tsy = s.y - e.y;
    const dot = tvx * tsx + tvy * tsy;
    const mV = Math.sqrt(tvx * tvx + tvy * tvy), mS = Math.sqrt(tsx * tsx + tsy * tsy);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / (mV * mS))));
    return (tsx * tvy - tsy * tvx) >= 0 ? ang : -ang;
  }

  function computePhase(): number {
    const e = bodyXY(eAngle, E_AU), v = bodyXY(vAngle, V_AU), s = sunXY();
    const dx1 = e.x - v.x, dy1 = e.y - v.y;
    const dx2 = s.x - v.x, dy2 = s.y - v.y;
    const dot = dx1 * dx2 + dy1 * dy2;
    const m1 = Math.sqrt(dx1 * dx1 + dy1 * dy1), m2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    return (1 + Math.max(-1, Math.min(1, dot / (m1 * m2)))) / 2;
  }

  function phaseLabel(p: number): string {
    if (p < 0.1) return "New";
    if (p < 0.35) return "Crescent";
    if (p < 0.65) return "Half";
    if (p < 0.9) return "Gibbous";
    return "Full";
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width; H = canvas.height;
    time = 0; eAngle = 0; vAngle = Math.PI * 0.5;
    trail = [];
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 2;
    showSightLines = params.showSightLines ?? 1;
    showPhases = params.showPhases ?? 1;
    trailLen = Math.round(params.trailLength ?? 50);
    const dayStep = dt * timeScale;
    eAngle = (eAngle + E_OMEGA * dayStep) % (2 * Math.PI);
    vAngle = (vAngle + V_OMEGA * dayStep) % (2 * Math.PI);
    time += dayStep;
    trail.push({ eAngle, vAngle, elongation: computeElongation(), phase: computePhase() });
    if (trail.length > trailLen) trail.splice(0, trail.length - trailLen);
  }

  function drawStarfield(): void {
    let rng = 12345;
    const rand = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; };
    for (let i = 0; i < 140; i++) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, 0.3 + rand() * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.5})`;
      ctx.fill();
    }
  }

  function drawOrbit(au: number): void {
    const s = sunXY();
    ctx.beginPath();
    ctx.arc(s.x, s.y, au * scale(), 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100,120,180,0.3)";
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawSun(): void {
    const { x, y } = sunXY();
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 30);
    glow.addColorStop(0, "rgba(255,240,100,0.9)");
    glow.addColorStop(0.4, "rgba(255,200,50,0.4)");
    glow.addColorStop(1, "rgba(255,150,0,0)");
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
    const sg = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, 12);
    sg.addColorStop(0, "#fffbe6"); sg.addColorStop(0.5, "#fbbf24"); sg.addColorStop(1, "#d97706");
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fillStyle = sg; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.fillText("Sun", x, y + 24);
  }

  function drawPlanet(pos: { x: number; y: number }, r: number, c1: string, c2: string, c3: string, label: string): void {
    const g = ctx.createRadialGradient(pos.x - 2, pos.y - 2, 0, pos.x, pos.y, r);
    g.addColorStop(0, c1); g.addColorStop(0.6, c2); g.addColorStop(1, c3);
    ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = "rgba(220,230,255,0.8)"; ctx.font = "11px system-ui,sans-serif";
    ctx.textAlign = "center"; ctx.fillText(label, pos.x, pos.y + r + 14);
  }

  function drawPhaseOverlay(pos: { x: number; y: number }, r: number, phase: number): void {
    if (showPhases < 0.5) return;
    const e = bodyXY(eAngle, E_AU);
    const ang = Math.atan2(e.y - pos.y, e.x - pos.x);
    ctx.save();
    ctx.beginPath(); ctx.arc(pos.x, pos.y, r + 0.5, 0, Math.PI * 2); ctx.clip();
    ctx.translate(pos.x, pos.y); ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    const tx = (2 * phase - 1) * r;
    ctx.ellipse(0, 0, Math.abs(tx), r, 0, Math.PI / 2, -Math.PI / 2, tx < 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(10,10,30,${0.8 - phase * 0.3})`;
    ctx.fill(); ctx.restore();
  }

  function drawSightLine(ex: number, ey: number, vx: number, vy: number): void {
    const dx = vx - ex, dy = vy - ey;
    const mag = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / mag, ny = dy / mag;
    const ext = Math.max(W, H);
    // Extended dashed line
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + nx * ext, ey + ny * ext);
    ctx.strokeStyle = "rgba(255,200,100,0.15)"; ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([]);
    // Solid segment Earth-Venus
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(vx, vy);
    ctx.strokeStyle = "rgba(255,200,100,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawTrailDots(): void {
    const sc = scale(), s = sunXY();
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i], a = ((i + 1) / trail.length);
      // Venus trail
      const vp = { x: s.x + Math.cos(t.vAngle) * V_AU * sc, y: s.y + Math.sin(t.vAngle) * V_AU * sc };
      ctx.beginPath(); ctx.arc(vp.x, vp.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(252,211,77,${a * 0.4})`; ctx.fill();
      // Earth trail
      const ep = { x: s.x + Math.cos(t.eAngle) * E_AU * sc, y: s.y + Math.sin(t.eAngle) * E_AU * sc };
      ctx.beginPath(); ctx.arc(ep.x, ep.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96,165,250,${a * 0.3})`; ctx.fill();
    }
  }

  function drawHistoricalSightLines(): void {
    if (showSightLines < 0.5 || trail.length < 2) return;
    const sc = scale(), s = sunXY();
    const step = Math.max(1, Math.floor(trail.length / 8));
    for (let i = 0; i < trail.length - 1; i += step) {
      const t = trail[i], a = ((i + 1) / trail.length) * 0.08;
      const ex = s.x + Math.cos(t.eAngle) * E_AU * sc, ey = s.y + Math.sin(t.eAngle) * E_AU * sc;
      const vx = s.x + Math.cos(t.vAngle) * V_AU * sc, vy = s.y + Math.sin(t.vAngle) * V_AU * sc;
      const dx = vx - ex, dy = vy - ey, m = Math.sqrt(dx * dx + dy * dy);
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex + (dx / m) * Math.max(W, H), ey + (dy / m) * Math.max(W, H));
      ctx.strokeStyle = `rgba(255,200,100,${a})`; ctx.lineWidth = 0.5; ctx.stroke();
    }
  }

  function drawApparentStrip(): void {
    const sx = W * 0.72, sy = H * 0.08, sw = W * 0.24, sh = H * 0.84;
    // Background
    ctx.fillStyle = "rgba(10,12,30,0.7)";
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 8); ctx.fill();
    ctx.strokeStyle = "rgba(100,120,180,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, 8); ctx.stroke();
    // Title
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.fillStyle = "#e2e8f0"; ctx.font = `bold ${Math.max(11, W * 0.015)}px system-ui,sans-serif`;
    ctx.textAlign = "center"; ctx.fillText("Apparent Position", cx, sy + 22);
    // Sun marker
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fillStyle = "#fbbf24"; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "10px system-ui,sans-serif";
    ctx.fillText("Sun", cx, cy + 18);
    // Labels
    const maxPx = sh * 0.38, maxRad = 46 * Math.PI / 180, elScale = maxPx / maxRad;
    ctx.fillStyle = "rgba(180,200,255,0.6)"; ctx.font = "10px system-ui,sans-serif";
    ctx.fillText("East (evening)", cx, sy + 45);
    ctx.fillText("West (morning)", cx, sy + sh - 30);
    // Greatest elongation markers
    const ge1 = cy - maxRad * elScale, ge2 = cy + maxRad * elScale;
    ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(100,180,100,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx + 15, ge1); ctx.lineTo(sx + sw - 15, ge1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 15, ge2); ctx.lineTo(sx + sw - 15, ge2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(100,200,100,0.6)"; ctx.font = "9px system-ui,sans-serif";
    ctx.fillText("Max Elong E", cx, ge1 - 4);
    ctx.fillText("Max Elong W", cx, ge2 - 4);
    // Trail dots colored by phase
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i], a = (i + 1) / trail.length;
      const py = cy - t.elongation * elScale;
      const b = Math.round(150 + t.phase * 105);
      ctx.beginPath(); ctx.arc(cx, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${b},${b - 20},${Math.round(b * 0.6)},${a * 0.8})`; ctx.fill();
    }
    // Current position
    if (trail.length > 0) {
      const cur = trail[trail.length - 1];
      const py = cy - cur.elongation * elScale;
      ctx.beginPath(); ctx.arc(cx, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fcd34d"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  function drawPhaseIndicator(): void {
    if (showPhases < 0.5) return;
    const phase = computePhase(), elong = computeElongation();
    const px = W * 0.84, py = H * 0.08 + H * 0.84 + 22, r = 14;
    // Lit disk
    ctx.save();
    ctx.beginPath(); ctx.arc(px - 40, py, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fcd34d"; ctx.fill();
    // Shadow
    ctx.beginPath(); ctx.arc(px - 40, py, r, -Math.PI / 2, Math.PI / 2, false);
    const tx = Math.abs(2 * phase - 1) * r;
    ctx.ellipse(px - 40, py, tx, r, 0, Math.PI / 2, -Math.PI / 2, phase < 0.5);
    ctx.closePath(); ctx.fillStyle = "rgba(10,10,30,0.85)"; ctx.fill();
    ctx.restore();
    // Labels
    ctx.fillStyle = "#e2e8f0"; ctx.font = "11px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`${phaseLabel(phase)} (${(phase * 100).toFixed(0)}%)`, px - 18, py + 4);
    const deg = (elong * 180) / Math.PI, side = deg >= 0 ? "E" : "W";
    ctx.fillStyle = "rgba(180,200,255,0.8)"; ctx.font = "10px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Elongation: ${Math.abs(deg).toFixed(1)}${side}`, px, py + 22);
  }

  function drawInfoPanel(): void {
    ctx.fillStyle = "rgba(15,20,40,0.75)";
    ctx.beginPath(); ctx.roundRect(10, 10, 195, 70, 6); ctx.fill();
    ctx.strokeStyle = "rgba(100,120,180,0.3)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(10, 10, 195, 70, 6); ctx.stroke();
    const yrs = time / 365.25, syn = time % 583.9;
    ctx.fillStyle = "#e2e8f0"; ctx.font = "11px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Day: ${time.toFixed(0)} (${yrs.toFixed(2)} yr)`, 20, 30);
    ctx.fillText(`Synodic cycle: ${syn.toFixed(0)} / 584 days`, 20, 48);
    ctx.fillText(`Speed: ${timeScale.toFixed(1)}x`, 20, 66);
  }

  function render(): void {
    const bg = ctx.createRadialGradient(W * 0.35, H * 0.5, 0, W * 0.35, H * 0.5, Math.max(W, H) * 0.8);
    bg.addColorStop(0, "#0d0d2b"); bg.addColorStop(0.5, "#080818"); bg.addColorStop(1, "#020208");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    drawStarfield();

    const s = sunXY(), e = bodyXY(eAngle, E_AU), v = bodyXY(vAngle, V_AU);
    drawOrbit(V_AU); drawOrbit(E_AU);

    // Orbit labels
    const sc = scale();
    ctx.fillStyle = "rgba(100,120,180,0.4)"; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Venus orbit", s.x + V_AU * sc + 5, s.y - 5);
    ctx.fillText("Earth orbit", s.x + E_AU * sc + 5, s.y - 5);

    drawTrailDots();
    drawHistoricalSightLines();
    if (showSightLines >= 0.5) drawSightLine(e.x, e.y, v.x, v.y);

    drawSun();
    drawPlanet(v, 6, "#fff5e0", "#fcd34d", "#b45309", "Venus");
    drawPhaseOverlay(v, 6, computePhase());
    drawPlanet(e, 8, "#60a5fa", "#3b82f6", "#1e40af", "Earth");

    drawApparentStrip();
    drawPhaseIndicator();
    drawInfoPanel();

    ctx.fillStyle = "#cbd5e1"; ctx.font = `bold ${Math.max(13, W * 0.02)}px system-ui,sans-serif`;
    ctx.textAlign = "center"; ctx.fillText("Apparent Motion of Venus", W * 0.35, H - 16);
  }

  function reset(): void { time = 0; eAngle = 0; vAngle = Math.PI * 0.5; trail = []; }
  function destroy(): void { trail = []; }

  function getStateDescription(): string {
    const elong = computeElongation(), phase = computePhase();
    const deg = (elong * 180) / Math.PI, side = deg >= 0 ? "eastern" : "western";
    let pLabel: string;
    if (phase < 0.1) pLabel = "new (near inferior conjunction)";
    else if (phase < 0.35) pLabel = "crescent";
    else if (phase < 0.65) pLabel = "half (near greatest elongation)";
    else if (phase < 0.9) pLabel = "gibbous";
    else pLabel = "full (near superior conjunction)";
    const syn = time % 583.9;
    return (
      `Apparent Motion of Venus: top-down solar system with Sun at center, ` +
      `Venus orbit (0.723 AU) and Earth orbit (1 AU). Day ${time.toFixed(0)}, ` +
      `synodic cycle day ${syn.toFixed(0)}/584. Elongation: ${Math.abs(deg).toFixed(1)} ${side}. ` +
      `Phase: ${pLabel} (${(phase * 100).toFixed(0)}% illuminated). ` +
      `Venus never exceeds ~46 from the Sun, visible as morning or evening star. ` +
      `Speed: ${timeScale.toFixed(1)}x.`
    );
  }

  function resize(w: number, h: number): void { W = w; H = h; }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ApparentMotionOfVenusFactory;
