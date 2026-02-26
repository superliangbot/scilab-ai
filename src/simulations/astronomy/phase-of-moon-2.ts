import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PhaseOfMoon2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("phase-of-moon-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let stars: Array<{ x: number; y: number; b: number }> = [];

  // Parameters
  let speed = 1;
  let showPhaseView = 1;
  let showOrbits = 1;

  // Moon state
  let moonAngle = 0; // radians around Earth
  const LUNAR_PERIOD = 29.5; // days
  let dayCount = 0;

  // Layout
  let cx = 0, cy = 0;
  let earthR = 0, moonR = 0, orbitR = 0, sunDir = 0;

  function layout() {
    cx = width * 0.45;
    cy = height * 0.5;
    earthR = Math.min(width, height) * 0.06;
    moonR = earthR * 0.27;
    orbitR = Math.min(width, height) * 0.28;
    sunDir = -Math.PI; // Sun is to the left
  }

  function genStars() {
    stars = [];
    for (let i = 0; i < Math.floor(width * height / 800); i++) {
      stars.push({ x: Math.random() * width, y: Math.random() * height, b: 0.3 + Math.random() * 0.7 });
    }
  }

  function getMoonPos() {
    return { x: cx + orbitR * Math.cos(moonAngle), y: cy - orbitR * Math.sin(moonAngle) };
  }

  // Compute illumination fraction and angle for phase rendering
  function getPhaseIllumination() {
    // Moon angle relative to sun direction
    // When moonAngle = PI (same side as sun), it's new moon (0% from earth)
    // When moonAngle = 0 (opposite side), it's full moon (100%)
    let rel = moonAngle % (Math.PI * 2);
    if (rel < 0) rel += Math.PI * 2;
    // Illumination as seen from Earth: full at 0/2PI, new at PI
    const illum = (1 + Math.cos(rel - Math.PI)) / 2;
    return { illum, rel };
  }

  function drawMoonPhase(mx: number, my: number, r: number, illum: number, rel: number) {
    // Draw dark moon circle
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fillStyle = "#222";
    ctx.fill();

    // Draw lit portion
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.clip();

    // Determine waxing vs waning
    const isWaxing = rel > Math.PI;
    const termX = r * Math.cos(Math.acos(2 * illum - 1));

    ctx.beginPath();
    // Lit side
    if (isWaxing) {
      // Right side lit
      ctx.arc(mx, my, r, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(mx, my, Math.abs(r * (2 * illum - 1)), r, 0, Math.PI / 2, -Math.PI / 2, illum < 0.5);
    } else {
      // Left side lit
      ctx.arc(mx, my, r, Math.PI / 2, -Math.PI / 2, false);
      ctx.ellipse(mx, my, Math.abs(r * (2 * illum - 1)), r, 0, -Math.PI / 2, Math.PI / 2, illum < 0.5);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    grad.addColorStop(0, "#f5f0d0");
    grad.addColorStop(0.8, "#e8dca0");
    grad.addColorStop(1, "#c8b870");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function getPhaseName(rel: number): string {
    const deg = (rel * 180) / Math.PI;
    if (deg < 22.5 || deg >= 337.5) return "Full Moon";
    if (deg < 67.5) return "Waning Gibbous";
    if (deg < 112.5) return "Third Quarter";
    if (deg < 157.5) return "Waning Crescent";
    if (deg < 202.5) return "New Moon";
    if (deg < 247.5) return "Waxing Crescent";
    if (deg < 292.5) return "First Quarter";
    return "Waxing Gibbous";
  }

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    moonAngle = 0;
    dayCount = 0;
    layout();
    genStars();
  }

  function update(dt: number, params: Record<string, number>) {
    speed = params.speed ?? 1;
    showPhaseView = params.showPhaseView ?? 1;
    showOrbits = params.showOrbits ?? 1;

    // One full orbit = LUNAR_PERIOD at speed 1
    const angularSpeed = (2 * Math.PI) / (LUNAR_PERIOD * 0.4); // adjusted for visual speed
    moonAngle += dt * angularSpeed * speed;
    dayCount = ((moonAngle / (2 * Math.PI)) * LUNAR_PERIOD) % LUNAR_PERIOD;
    time += dt;
  }

  function render() {
    // Background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(time * 2 + s.x * 0.03);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.b * tw})`;
      ctx.fill();
    }

    // Sun glow (far left)
    const sunX = width * 0.02;
    const sunY = height * 0.5;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, width * 0.3);
    sunGrad.addColorStop(0, "rgba(255,240,100,0.15)");
    sunGrad.addColorStop(0.5, "rgba(255,200,50,0.05)");
    sunGrad.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, width, height);

    // Sun rays label
    ctx.fillStyle = "rgba(255,240,150,0.5)";
    ctx.font = `${Math.max(11, height * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("☀ Sunlight →", width * 0.06, height * 0.12);

    // Orbit path
    if (showOrbits >= 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Earth
    const earthGrad = ctx.createRadialGradient(cx - earthR * 0.3, cy - earthR * 0.3, 0, cx, cy, earthR);
    earthGrad.addColorStop(0, "#6699ff");
    earthGrad.addColorStop(0.6, "#3366cc");
    earthGrad.addColorStop(1, "#112244");
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Continents hint
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 3; i++) {
      const ca = time * 0.15 + i * 2.1;
      ctx.beginPath();
      ctx.arc(cx + earthR * 0.3 * Math.cos(ca), cy + earthR * 0.25 * Math.sin(ca), earthR * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(50,160,80,0.2)";
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(100,160,255,0.7)";
    ctx.font = `${Math.max(10, height * 0.018)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Earth", cx, cy + earthR + 14);

    // Moon
    const mp = getMoonPos();
    const { illum, rel } = getPhaseIllumination();

    // Lit side of moon in orbital view (sunlight from left)
    const moonGrad = ctx.createRadialGradient(mp.x - moonR * 0.3, mp.y - moonR * 0.3, 0, mp.x, mp.y, moonR);
    moonGrad.addColorStop(0, "#e8e8e8");
    moonGrad.addColorStop(0.6, "#cccccc");
    moonGrad.addColorStop(1, "#888888");
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, moonR, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // Dark side overlay (away from sun = right side)
    ctx.save();
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, moonR, 0, Math.PI * 2);
    ctx.clip();
    // Sun is to the left, so shadow on right side of moon relative to sun direction
    const shadowAngle = Math.atan2(mp.y - sunY, mp.x - sunX);
    const shGrad = ctx.createLinearGradient(
      mp.x - moonR * Math.cos(shadowAngle),
      mp.y - moonR * Math.sin(shadowAngle),
      mp.x + moonR * Math.cos(shadowAngle),
      mp.y + moonR * Math.sin(shadowAngle)
    );
    shGrad.addColorStop(0, "rgba(0,0,0,0)");
    shGrad.addColorStop(0.4, "rgba(0,0,0,0)");
    shGrad.addColorStop(0.6, "rgba(0,0,0,0.5)");
    shGrad.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = shGrad;
    ctx.fillRect(mp.x - moonR - 2, mp.y - moonR - 2, moonR * 2 + 4, moonR * 2 + 4);
    ctx.restore();

    ctx.fillStyle = "rgba(200,200,200,0.6)";
    ctx.fillText("Moon", mp.x, mp.y + moonR + 10);

    // Phase view panel (right side)
    if (showPhaseView >= 0.5) {
      const pvX = width * 0.82;
      const pvY = height * 0.3;
      const pvR = Math.min(width, height) * 0.1;

      // Panel background
      ctx.fillStyle = "rgba(10,10,30,0.8)";
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      const pw = pvR * 2.8;
      const ph = pvR * 3.5;
      ctx.beginPath();
      ctx.roundRect(pvX - pw / 2, pvY - pvR * 0.7, pw, ph, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `bold ${Math.max(12, height * 0.022)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("View from Earth", pvX, pvY - pvR * 0.35);

      drawMoonPhase(pvX, pvY + pvR * 0.4, pvR, illum, rel);

      const phaseName = getPhaseName(rel);
      ctx.fillStyle = "rgba(255,255,200,0.8)";
      ctx.font = `bold ${Math.max(11, height * 0.02)}px system-ui, sans-serif`;
      ctx.fillText(phaseName, pvX, pvY + pvR * 1.8);

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
      ctx.fillText(`Day ${Math.floor(dayCount + 1)} of ${LUNAR_PERIOD}`, pvX, pvY + pvR * 2.2);
      ctx.fillText(`Illumination: ${(illum * 100).toFixed(0)}%`, pvX, pvY + pvR * 2.55);
    }

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Lunar Phase Cycle", width / 2, 25);
  }

  function reset() {
    time = 0;
    moonAngle = 0;
    dayCount = 0;
  }

  function destroy() { stars = []; }

  function getStateDescription(): string {
    const { illum, rel } = getPhaseIllumination();
    const phaseName = getPhaseName(rel);
    return `Moon Phase 2 | Day ${Math.floor(dayCount + 1)}/${LUNAR_PERIOD} | Phase: ${phaseName} | Illumination: ${(illum * 100).toFixed(0)}% | Speed: ${speed}x`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout(); genStars();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PhaseOfMoon2Factory;
