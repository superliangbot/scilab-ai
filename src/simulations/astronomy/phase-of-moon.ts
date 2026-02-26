import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

/**
 * Phase of Moon: Lunar phases from New Moon to Full and back.
 * Moon takes ~29.5 days for a full synodic cycle.
 * Phase depends on Sun-Earth-Moon angle.
 */

const PHASE_NAMES = [
  "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
  "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
];

const PhaseOfMoonFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("phase-of-moon") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let dayOfCycle = 0;
  let orbitalSpeed = 1;
  let showLabels = 1;
  let showOrbitalView = 1;

  const SYNODIC_PERIOD = 29.53; // days

  function getPhaseName(day: number): string {
    const fraction = (day % SYNODIC_PERIOD) / SYNODIC_PERIOD;
    const index = Math.floor(fraction * 8) % 8;
    return PHASE_NAMES[index];
  }

  function getIlluminationPercent(day: number): number {
    const fraction = (day % SYNODIC_PERIOD) / SYNODIC_PERIOD;
    // Illumination follows a cosine curve: 0% at new moon, 100% at full
    return ((1 - Math.cos(fraction * 2 * Math.PI)) / 2) * 100;
  }

  function getSunAngle(day: number): number {
    // Angle of moon relative to sun as seen from earth (0 = new moon, 180 = full)
    const fraction = (day % SYNODIC_PERIOD) / SYNODIC_PERIOD;
    return fraction * 360;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    orbitalSpeed = params.orbitalSpeed ?? 1;
    showLabels = Math.round(params.showLabels ?? 1);
    showOrbitalView = Math.round(params.showOrbitalView ?? 1);

    const newDay = params.dayOfCycle ?? 0;
    dayOfCycle = newDay;
    time += Math.min(dt, 0.016) * orbitalSpeed;
    // Advance day based on time
    dayOfCycle = (newDay + time * 2) % SYNODIC_PERIOD;
  }

  function drawMoonPhase(cx: number, cy: number, radius: number, day: number): void {
    const fraction = (day % SYNODIC_PERIOD) / SYNODIC_PERIOD;
    const phaseAngle = fraction * 2 * Math.PI;

    // Draw the dark moon base
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();

    // Add subtle crater textures
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const craters = [
      [-0.3,-0.2,0.12],[0.2,-0.4,0.08],[0.1,0.3,0.15],[-0.2,0.5,0.06],
      [0.35,0.1,0.1],[-0.4,-0.5,0.07],[-0.1,0.0,0.18],[0.4,-0.2,0.05],
    ];
    for (const [cx2, cy2, cr] of craters) {
      ctx.beginPath();
      ctx.arc(cx + cx2 * radius, cy + cy2 * radius, cr * radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(100,100,120,0.15)";
      ctx.fill();
    }

    const cosPhase = Math.cos(phaseAngle);

    ctx.beginPath();
    if (fraction <= 0.5) { // Waxing: right side lit
      ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(cx, cy, Math.abs(cosPhase) * radius, radius, 0, Math.PI / 2, -Math.PI / 2, cosPhase > 0);
    } else { // Waning: left side lit
      ctx.arc(cx, cy, radius, Math.PI / 2, -Math.PI / 2, false);
      ctx.ellipse(cx, cy, Math.abs(cosPhase) * radius, radius, 0, -Math.PI / 2, Math.PI / 2, cosPhase < 0);
    }
    ctx.closePath();
    const lightGrad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
    lightGrad.addColorStop(0, "#f5f0e0");
    lightGrad.addColorStop(0.6, "#e8e0c8");
    lightGrad.addColorStop(1, "#c8c0a0");
    ctx.fillStyle = lightGrad;
    ctx.fill();

    for (const [cx2, cy2, cr] of craters) {
      ctx.beginPath();
      ctx.arc(cx + cx2 * radius, cy + cy2 * radius, cr * radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180,170,140,0.2)";
      ctx.fill();
    }

    ctx.restore();

    // Moon outline
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200,200,220,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawOrbitalView(): void {
    if (!showOrbitalView) return;

    const viewCx = width * 0.25;
    const viewCy = height * 0.40;
    const orbitRadius = Math.min(width * 0.18, height * 0.28);

    // Background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.arc(viewCx, viewCy, orbitRadius + 30, 0, Math.PI * 2);
    ctx.fill();

    // Sun indicator on left
    const sunX = viewCx - orbitRadius - 35;
    const sunGlow = ctx.createRadialGradient(sunX, viewCy, 0, sunX, viewCy, 30);
    sunGlow.addColorStop(0, "rgba(255,200,50,0.8)");
    sunGlow.addColorStop(0.5, "rgba(255,180,30,0.3)");
    sunGlow.addColorStop(1, "rgba(255,150,0,0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, viewCy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX, viewCy, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fill();

    if (showLabels) {
      ctx.fillStyle = "#ffd700";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Sun", sunX, viewCy + 25);
    }

    // Orbit path
    ctx.beginPath();
    ctx.arc(viewCx, viewCy, orbitRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100,116,139,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth
    const earthGrad = ctx.createRadialGradient(viewCx - 2, viewCy - 2, 0, viewCx, viewCy, 14);
    earthGrad.addColorStop(0, "#60a5fa");
    earthGrad.addColorStop(0.5, "#2563eb");
    earthGrad.addColorStop(1, "#1e3a5f");
    ctx.beginPath();
    ctx.arc(viewCx, viewCy, 14, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(96,165,250,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (showLabels) {
      ctx.fillStyle = "#60a5fa";
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Earth", viewCx, viewCy + 28);
    }

    // Moon position: new moon = between sun and earth (left), full = opposite (right)
    const fraction = (dayOfCycle % SYNODIC_PERIOD) / SYNODIC_PERIOD;
    const orbitAngle = fraction * 2 * Math.PI + Math.PI;

    const moonX = viewCx + orbitRadius * Math.cos(orbitAngle);
    const moonY = viewCy + orbitRadius * Math.sin(orbitAngle);

    // Moon (small circle with half illumination from sun side)
    ctx.beginPath();
    ctx.arc(moonX, moonY, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#888";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX, moonY, 8, Math.PI / 2, -Math.PI / 2, false);
    ctx.fillStyle = "#eee";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX, moonY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(200,200,200,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (showLabels) {
      ctx.fillStyle = "#d1d5db";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Moon", moonX, moonY - 14);
      // Phase labels around orbit
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      const labelR = orbitRadius + 18;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 2 * Math.PI + Math.PI;
        ctx.fillText(PHASE_NAMES[i], viewCx + labelR * Math.cos(a), viewCy + labelR * Math.sin(a));
      }
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Orbital View (top-down)", viewCx, viewCy - orbitRadius - 38);
  }

  function drawLargeMoon(): void {
    const moonCx = width * 0.70;
    const moonCy = height * 0.45;
    const moonR = Math.min(width * 0.17, height * 0.28);

    // Label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Current Phase", moonCx, moonCy - moonR - 15);

    drawMoonPhase(moonCx, moonCy, moonR, dayOfCycle);

    // Phase name
    const phaseName = getPhaseName(dayOfCycle);
    ctx.fillStyle = "#fbbf24";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(phaseName, moonCx, moonCy + moonR + 25);
  }

  function drawPhaseStrip(): void {
    // Show all 8 phases in a strip at the bottom
    const stripY = height * 0.82;
    const stripH = height * 0.15;
    const miniR = Math.min(stripH * 0.35, 22);
    const stripLeft = width * 0.05;
    const stripRight = width * 0.95;
    const spacing = (stripRight - stripLeft) / 8;

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.roundRect(stripLeft - 10, stripY - 5, stripRight - stripLeft + 20, stripH + 10, 8);
    ctx.fill();

    const currentIndex = Math.floor(((dayOfCycle % SYNODIC_PERIOD) / SYNODIC_PERIOD) * 8) % 8;

    for (let i = 0; i < 8; i++) {
      const cx = stripLeft + spacing * (i + 0.5);
      const cy = stripY + stripH * 0.35;
      const day = (i / 8) * SYNODIC_PERIOD;

      // Highlight current phase
      if (i === currentIndex) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, miniR + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      drawMoonPhase(cx, cy, miniR, day);

      if (showLabels) {
        ctx.fillStyle = i === currentIndex ? "#fbbf24" : "rgba(148,163,184,0.7)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(PHASE_NAMES[i], cx, cy + miniR + 14);
      }
    }
  }

  function drawInfoPanel(): void {
    const px = width * 0.58;
    const py = height * 0.02;
    const pw = width * 0.40;
    const ph = 105;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Lunar Phase Info", px + 12, py + 20);

    const phaseName = getPhaseName(dayOfCycle);
    const illumination = getIlluminationPercent(dayOfCycle);
    const sunAngle = getSunAngle(dayOfCycle);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px system-ui, sans-serif";
    const info = [
      `Phase: ${phaseName}`,
      `Illumination: ${illumination.toFixed(1)}%`,
      `Day of cycle: ${dayOfCycle.toFixed(1)} / ${SYNODIC_PERIOD}`,
      `Sun-Earth-Moon angle: ${sunAngle.toFixed(1)}\u00b0`,
    ];
    info.forEach((line, i) => {
      ctx.fillText(line, px + 12, py + 40 + i * 17);
    });
  }

  function render(): void {
    // Starry background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Stars (deterministic scatter using sin hash)
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 80; i++) {
      const h = (n: number) => { const v = Math.sin(n) * 43758.5453; return v - Math.floor(v); };
      ctx.beginPath();
      ctx.arc(h(i * 7.3) * width, h(i * 13.7) * height, h(i * 3.1) * 1.2 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(16, width * 0.026)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Phases of the Moon", width / 2, 28);

    ctx.fillStyle = "rgba(148,163,184,0.6)";
    ctx.font = `${Math.max(10, width * 0.015)}px system-ui, sans-serif`;
    ctx.fillText(`Synodic period: ${SYNODIC_PERIOD} days`, width / 2, 45);

    drawOrbitalView();
    drawLargeMoon();
    drawPhaseStrip();
    drawInfoPanel();

    // Time
    ctx.fillStyle = "rgba(148,163,184,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${time.toFixed(2)} s`, 8, height - 6);
  }

  function reset(): void {
    time = 0;
    dayOfCycle = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const phaseName = getPhaseName(dayOfCycle);
    const illumination = getIlluminationPercent(dayOfCycle);
    const sunAngle = getSunAngle(dayOfCycle);
    return (
      `Phase of Moon: Day ${dayOfCycle.toFixed(1)} of ${SYNODIC_PERIOD}-day synodic cycle. ` +
      `Current phase: ${phaseName}. Illumination: ${illumination.toFixed(1)}%. ` +
      `Sun-Earth-Moon angle: ${sunAngle.toFixed(1)}\u00b0. ` +
      `Demonstrates how lunar phases arise from the changing geometry of Sun, Earth, and Moon. ` +
      `New Moon (0\u00b0), First Quarter (90\u00b0), Full Moon (180\u00b0), Last Quarter (270\u00b0).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default PhaseOfMoonFactory;
