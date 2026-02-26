import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const PhaseOfVenusFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("phase-of-venus") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let stars: Array<{ x: number; y: number; b: number }> = [];

  // Parameters
  let speed = 1;
  let showLabels = 1;
  let zoom = 1;

  // Orbital state
  let venusAngle = 0; // radians around Sun
  let earthAngle = 0;
  const VENUS_PERIOD = 0.615; // years (relative to Earth's 1 year)

  // Layout
  let sunX = 0, sunY = 0;
  let sunR = 0, venusOrbitR = 0, earthOrbitR = 0;

  function layout() {
    const half = Math.min(width, height) * 0.5;
    sunX = width * 0.4;
    sunY = height * 0.5;
    sunR = half * 0.06;
    venusOrbitR = half * 0.25 * zoom;
    earthOrbitR = half * 0.45 * zoom;
  }

  function genStars() {
    stars = [];
    for (let i = 0; i < Math.floor(width * height / 1000); i++) {
      stars.push({ x: Math.random() * width, y: Math.random() * height, b: 0.2 + Math.random() * 0.6 });
    }
  }

  function getVenusPhase() {
    // Phase depends on angle between Sun-Venus-Earth
    const vx = sunX + venusOrbitR * Math.cos(venusAngle);
    const vy = sunY - venusOrbitR * Math.sin(venusAngle);
    const ex = sunX + earthOrbitR * Math.cos(earthAngle);
    const ey = sunY - earthOrbitR * Math.sin(earthAngle);

    // Vector from Venus to Sun
    const vsX = sunX - vx, vsY = sunY - vy;
    // Vector from Venus to Earth
    const veX = ex - vx, veY = ey - vy;

    // Phase angle = angle between Sun-Venus-Earth
    const dot = vsX * veX + vsY * veY;
    const mag1 = Math.sqrt(vsX * vsX + vsY * vsY);
    const mag2 = Math.sqrt(veX * veX + veY * veY);
    const phaseAngle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));

    // illumination fraction
    const illum = (1 + Math.cos(phaseAngle)) / 2;

    // Angular size (apparent) — closer = bigger
    const dist = Math.sqrt((ex - vx) ** 2 + (ey - vy) ** 2);

    return { illum, phaseAngle, dist, vx, vy, ex, ey };
  }

  function drawVenusPhaseDisc(px: number, py: number, r: number, illum: number, sunAngle: number) {
    // Dark disc
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2a";
    ctx.fill();

    // Lit portion based on sun angle
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.beginPath();
    // Lit side faces the sun
    const right = sunAngle < Math.PI;
    if (right) {
      ctx.arc(px, py, r, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(px, py, Math.abs(r * (2 * illum - 1)), r, 0, Math.PI / 2, -Math.PI / 2, illum < 0.5);
    } else {
      ctx.arc(px, py, r, Math.PI / 2, -Math.PI / 2, false);
      ctx.ellipse(px, py, Math.abs(r * (2 * illum - 1)), r, 0, -Math.PI / 2, Math.PI / 2, illum < 0.5);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "#fffde0");
    g.addColorStop(0.7, "#f0d870");
    g.addColorStop(1, "#c8a030");
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
    venusAngle = Math.PI * 0.5;
    earthAngle = 0;
    layout();
    genStars();
  }

  function update(dt: number, params: Record<string, number>) {
    speed = params.speed ?? 1;
    showLabels = params.showLabels ?? 1;
    zoom = params.zoom ?? 1;
    layout();

    const baseSpeed = Math.PI * 0.3; // radians per second at speed 1
    earthAngle += dt * baseSpeed * speed;
    venusAngle += dt * baseSpeed * speed / VENUS_PERIOD;
    time += dt;
  }

  function render() {
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.b * (0.6 + 0.4 * Math.sin(time * 2 + s.x))})`;
      ctx.fill();
    }

    // Orbits
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sunX, sunY, venusOrbitR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sunX, sunY, earthOrbitR, 0, Math.PI * 2);
    ctx.stroke();

    // Sun
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
    sg.addColorStop(0, "rgba(255,240,100,0.3)");
    sg.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3, 0, Math.PI * 2);
    ctx.fill();

    const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, 0, sunX, sunY, sunR);
    sunGrad.addColorStop(0, "#fffff0");
    sunGrad.addColorStop(0.4, "#ffee55");
    sunGrad.addColorStop(1, "#ff8800");
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Venus
    const phase = getVenusPhase();
    const venusR = Math.min(width, height) * 0.015;
    const vGrad = ctx.createRadialGradient(phase.vx, phase.vy, 0, phase.vx, phase.vy, venusR);
    vGrad.addColorStop(0, "#ffe8a0");
    vGrad.addColorStop(1, "#c8a050");
    ctx.beginPath();
    ctx.arc(phase.vx, phase.vy, venusR, 0, Math.PI * 2);
    ctx.fillStyle = vGrad;
    ctx.fill();

    // Earth
    const earthR = Math.min(width, height) * 0.018;
    const eGrad = ctx.createRadialGradient(phase.ex - earthR * 0.3, phase.ey - earthR * 0.3, 0, phase.ex, phase.ey, earthR);
    eGrad.addColorStop(0, "#6699ff");
    eGrad.addColorStop(1, "#224488");
    ctx.beginPath();
    ctx.arc(phase.ex, phase.ey, earthR, 0, Math.PI * 2);
    ctx.fillStyle = eGrad;
    ctx.fill();

    // Labels
    if (showLabels >= 0.5) {
      ctx.font = `${Math.max(10, height * 0.018)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,240,100,0.7)";
      ctx.fillText("Sun", sunX, sunY + sunR + 14);
      ctx.fillStyle = "rgba(255,220,120,0.7)";
      ctx.fillText("Venus", phase.vx, phase.vy + venusR + 12);
      ctx.fillStyle = "rgba(100,160,255,0.7)";
      ctx.fillText("Earth", phase.ex, phase.ey + earthR + 12);
    }

    // Sight line from Earth to Venus
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(phase.ex, phase.ey);
    ctx.lineTo(phase.vx, phase.vy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Phase view panel (right)
    const pvX = width * 0.85;
    const pvY = height * 0.35;
    const maxDiscR = Math.min(width, height) * 0.1;

    // Apparent size scales inversely with distance
    const maxDist = earthOrbitR + venusOrbitR;
    const minDist = earthOrbitR - venusOrbitR;
    const sizeScale = 0.3 + 0.7 * (1 - (phase.dist - minDist) / (maxDist - minDist));
    const discR = maxDiscR * sizeScale;

    const pw = maxDiscR * 3;
    const ph = maxDiscR * 4;
    ctx.fillStyle = "rgba(10,10,30,0.8)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(pvX - pw / 2, pvY - maxDiscR * 0.5, pw, ph, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${Math.max(11, height * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Venus from Earth", pvX, pvY);

    // Determine sun direction relative to Earth-Venus line for phase rendering
    const sunAng = Math.atan2(sunY - phase.vy, sunX - phase.vx) - Math.atan2(phase.ey - phase.vy, phase.ex - phase.vx);
    drawVenusPhaseDisc(pvX, pvY + maxDiscR * 1.2, discR, phase.illum, sunAng);

    ctx.fillStyle = "rgba(255,255,200,0.7)";
    ctx.font = `${Math.max(10, height * 0.016)}px system-ui, sans-serif`;
    ctx.fillText(`Illumination: ${(phase.illum * 100).toFixed(0)}%`, pvX, pvY + maxDiscR * 2.6);
    ctx.fillText(`Apparent size: ${(sizeScale * 100).toFixed(0)}%`, pvX, pvY + maxDiscR * 3.0);

    let phaseName = "Gibbous";
    if (phase.illum < 0.1) phaseName = "New Venus";
    else if (phase.illum < 0.4) phaseName = "Crescent";
    else if (phase.illum < 0.6) phaseName = "Half";
    else if (phase.illum < 0.9) phaseName = "Gibbous";
    else phaseName = "Full Venus";

    ctx.fillStyle = "rgba(255,220,100,0.8)";
    ctx.font = `bold ${Math.max(11, height * 0.018)}px system-ui, sans-serif`;
    ctx.fillText(phaseName, pvX, pvY + maxDiscR * 3.4);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.max(13, height * 0.025)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Phases of Venus — Heliocentric Model", width * 0.4, 25);

    // Info note
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `${Math.max(10, height * 0.015)}px system-ui, sans-serif`;
    ctx.fillText("Venus shows full phase range — evidence for heliocentric model", width * 0.4, height - 12);
  }

  function reset() {
    time = 0;
    venusAngle = Math.PI * 0.5;
    earthAngle = 0;
  }

  function destroy() { stars = []; }

  function getStateDescription(): string {
    const phase = getVenusPhase();
    return `Phase of Venus | Illumination: ${(phase.illum * 100).toFixed(0)}% | Venus angle: ${((venusAngle * 180 / Math.PI) % 360).toFixed(0)}° | Earth angle: ${((earthAngle * 180 / Math.PI) % 360).toFixed(0)}° | Speed: ${speed}x`;
  }

  function resize(w: number, h: number) {
    width = w; height = h;
    layout(); genStars();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PhaseOfVenusFactory;
