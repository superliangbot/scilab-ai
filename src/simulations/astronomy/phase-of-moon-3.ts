import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PhaseOfMoon3Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("phase-of-moon-3") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let stars: Array<{ x: number; y: number; b: number }> = [];

  // Parameters
  let moonPosition = 0; // degrees 0-360
  let latitude = 0; // observer latitude -90 to 90
  let speed = 1;
  let showRays = 1;

  // Layout
  let cx = 0, cy = 0;
  let earthR = 0, moonR = 0, orbitR = 0;

  function layout() {
    cx = width * 0.4;
    cy = height * 0.5;
    earthR = Math.min(width, height) * 0.08;
    moonR = earthR * 0.27;
    orbitR = Math.min(width, height) * 0.26;
  }

  function genStars() {
    stars = [];
    for (let i = 0; i < Math.floor(width * height / 900); i++) {
      stars.push({ x: Math.random() * width, y: Math.random() * height, b: 0.3 + Math.random() * 0.7 });
    }
  }

  function getMoonPos(angleDeg: number) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + orbitR * Math.cos(a), y: cy - orbitR * Math.sin(a) };
  }

  function getPhaseFromAngle(angleDeg: number) {
    // Sun is to the left (180 deg). Moon at 180 = new moon, at 0/360 = full moon
    let rel = angleDeg % 360;
    if (rel < 0) rel += 360;
    // illumination: full at 0/360, new at 180
    const illum = (1 + Math.cos((rel * Math.PI) / 180)) / 2;
    const isWaxing = rel > 180;
    return { illum, isWaxing, rel };
  }

  function getPhaseName(rel: number): string {
    if (rel < 22.5 || rel >= 337.5) return "Full Moon";
    if (rel < 67.5) return "Waning Gibbous";
    if (rel < 112.5) return "Third Quarter";
    if (rel < 157.5) return "Waning Crescent";
    if (rel < 202.5) return "New Moon";
    if (rel < 247.5) return "Waxing Crescent";
    if (rel < 292.5) return "First Quarter";
    return "Waxing Gibbous";
  }

  function drawPhaseDisc(px: number, py: number, r: number, illum: number, isWaxing: boolean, latFlip: boolean) {
    // Dark base
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2a";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.beginPath();
    const litSide = latFlip ? !isWaxing : isWaxing;
    if (litSide) {
      ctx.arc(px, py, r, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(px, py, Math.abs(r * (2 * illum - 1)), r, 0, Math.PI / 2, -Math.PI / 2, illum < 0.5);
    } else {
      ctx.arc(px, py, r, Math.PI / 2, -Math.PI / 2, false);
      ctx.ellipse(px, py, Math.abs(r * (2 * illum - 1)), r, 0, -Math.PI / 2, Math.PI / 2, illum < 0.5);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "#f5f0d0");
    g.addColorStop(0.8, "#e0d898");
    g.addColorStop(1, "#c0a860");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    moonPosition = 270;
    layout();
    genStars();
  }

  function update(dt: number, params: Record<string, number>) {
    speed = params.speed ?? 1;
    latitude = params.latitude ?? 0;
    showRays = params.showRays ?? 1;

    moonPosition += dt * 12 * speed; // degrees per second
    if (moonPosition >= 360) moonPosition -= 360;
    time += dt;
  }

  function render() {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(time * 2 + s.x * 0.04);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.b * tw})`;
      ctx.fill();
    }

    // Sun glow left
    const sunGrad = ctx.createRadialGradient(0, cy, 0, 0, cy, width * 0.35);
    sunGrad.addColorStop(0, "rgba(255,240,80,0.12)");
    sunGrad.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, width, height);

    // Sun rays
    if (showRays >= 0.5) {
      ctx.strokeStyle = "rgba(255,240,100,0.06)";
      ctx.lineWidth = 1;
      for (let i = -5; i <= 5; i++) {
        const y = cy + i * height * 0.06;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width * 0.8, y + i * 2);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(255,240,150,0.5)";
    ctx.font = `${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("☀ Sun", 8, cy - 10);

    // Orbit
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Earth with latitude indicator
    const eGrad = ctx.createRadialGradient(cx - earthR * 0.3, cy - earthR * 0.3, 0, cx, cy, earthR);
    eGrad.addColorStop(0, "#6699ff");
    eGrad.addColorStop(0.6, "#3366cc");
    eGrad.addColorStop(1, "#112244");
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.fillStyle = eGrad;
    ctx.fill();

    // Equator line
    ctx.beginPath();
    ctx.ellipse(cx, cy, earthR, earthR * 0.15, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Observer dot
    const obsAngle = ((90 - latitude) * Math.PI) / 180;
    const obsX = cx + earthR * 0.9 * Math.cos(Math.PI / 2 - obsAngle + Math.PI / 2);
    const obsY = cy - earthR * 0.9 * Math.sin(Math.PI / 2 - obsAngle + Math.PI / 2);
    ctx.beginPath();
    ctx.arc(obsX, obsY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6644";
    ctx.fill();

    ctx.fillStyle = "rgba(100,160,255,0.7)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Earth", cx, cy + earthR + 14);
    ctx.fillStyle = "rgba(255,100,60,0.7)";
    ctx.fillText(`Observer ${latitude.toFixed(0)}°`, cx, cy + earthR + 28);

    // Moon
    const mp = getMoonPos(moonPosition);
    const mGrad = ctx.createRadialGradient(mp.x - moonR * 0.3, mp.y - moonR * 0.3, 0, mp.x, mp.y, moonR);
    mGrad.addColorStop(0, "#e8e8e8");
    mGrad.addColorStop(1, "#888");
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, moonR, 0, Math.PI * 2);
    ctx.fillStyle = mGrad;
    ctx.fill();

    // Shadow on moon from sun
    ctx.save();
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, moonR, 0, Math.PI * 2);
    ctx.clip();
    const shGrad = ctx.createLinearGradient(mp.x - moonR, mp.y, mp.x + moonR, mp.y);
    shGrad.addColorStop(0, "rgba(0,0,0,0)");
    shGrad.addColorStop(0.45, "rgba(0,0,0,0)");
    shGrad.addColorStop(0.55, "rgba(0,0,0,0.5)");
    shGrad.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = shGrad;
    ctx.fillRect(mp.x - moonR - 1, mp.y - moonR - 1, moonR * 2 + 2, moonR * 2 + 2);
    ctx.restore();

    ctx.fillStyle = "rgba(200,200,200,0.6)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Moon", mp.x, mp.y + moonR + 10);

    // Phase panels (right side) — show view from different latitudes
    const { illum, isWaxing, rel } = getPhaseFromAngle(moonPosition);
    const phaseName = getPhaseName(rel);
    const panelX = width * 0.82;
    const discR = Math.min(width, height) * 0.065;

    // Panel background
    const panelW = discR * 3;
    const panelH = height * 0.75;
    ctx.fillStyle = "rgba(10,10,30,0.8)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX - panelW / 2, height * 0.08, panelW, panelH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(11, height * 0.019)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Phase as seen from", panelX, height * 0.14);

    // Three views: North, Equator, South
    const views = [
      { label: "North (45°N)", lat: 45, y: height * 0.28 },
      { label: "Equator (0°)", lat: 0, y: height * 0.48 },
      { label: "South (45°S)", lat: -45, y: height * 0.68 },
    ];

    for (const v of views) {
      const flip = v.lat < 0;
      drawPhaseDisc(panelX, v.y, discR, illum, isWaxing, flip);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
      ctx.fillText(v.label, panelX, v.y + discR + 14);
    }

    // Phase name
    ctx.fillStyle = "rgba(255,255,200,0.8)";
    ctx.font = `bold ${Math.max(12, height * 0.02)}px system-ui, sans-serif`;
    ctx.fillText(phaseName, panelX, height * 0.08 + panelH - 8);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Moon Phases by Latitude", width * 0.4, 25);
  }

  function reset() { time = 0; moonPosition = 270; }
  function destroy() { stars = []; }

  function getStateDescription(): string {
    const { illum, rel } = getPhaseFromAngle(moonPosition);
    return `Moon Phase 3 | Position: ${moonPosition.toFixed(0)}° | Phase: ${getPhaseName(rel)} | Illumination: ${(illum * 100).toFixed(0)}% | Latitude: ${latitude}° | Speed: ${speed}x`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout(); genStars();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PhaseOfMoon3Factory;
