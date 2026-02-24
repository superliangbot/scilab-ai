import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

interface TrailPoint {
  earthAngle: number;
  marsAngle: number;
  apparentAngle: number;
  day: number;
}

interface Marker {
  earthAngle: number;
  marsAngle: number;
  apparentAngle: number;
  day: number;
  index: number;
}

interface Star {
  x: number;
  y: number;
  brightness: number;
  size: number;
}

const ApparentMotionOfMarsFactory: SimulationFactory = () => {
  const config = getSimConfig("apparent-motion-of-mars")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0; // simulation time in days

  // Orbital constants
  const BASE_EARTH_PERIOD = 365.25; // days
  const BASE_MARS_PERIOD = 687; // days
  const EARTH_ORBIT_AU = 1.0;
  const MARS_ORBIT_AU = 1.524;

  // Derived values (recalculated when earthSpeed changes)
  let earthAngularVel = (2 * Math.PI) / BASE_EARTH_PERIOD;
  let marsAngularVel = (2 * Math.PI) / BASE_MARS_PERIOD;

  // Parameters
  let timeScale = 1;
  let showSightLines = 1;
  let trailLength = 50;
  let earthSpeed = 1;

  // State
  let trail: TrailPoint[] = [];
  let markers: Marker[] = [];
  let nextMarkerDay = 0;
  const MARKER_INTERVAL = 40; // days between markers

  // Starfield
  let stars: Star[] = [];

  // Layout
  let cx = 0;
  let cy = 0;
  let orbitScale = 0;
  let celestialRadius = 0;

  // ---- Pseudo-random starfield ----
  function generateStars(): void {
    stars = [];
    let seed = 31415;
    function rng(): number {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    }
    const count = Math.min(200, Math.floor((width * height) / 1200));
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rng() * width,
        y: rng() * height,
        brightness: 0.15 + rng() * 0.65,
        size: 0.3 + rng() * 1.4,
      });
    }
  }

  function computeLayout(): void {
    cx = width * 0.5;
    cy = height * 0.5;
    orbitScale = Math.min(width, height) * 0.22;
    celestialRadius = MARS_ORBIT_AU * orbitScale * 1.75;
  }

  // ---- Orbital helpers ----
  function earthPos(angle: number): { x: number; y: number } {
    return {
      x: cx + EARTH_ORBIT_AU * orbitScale * Math.cos(angle),
      y: cy - EARTH_ORBIT_AU * orbitScale * Math.sin(angle),
    };
  }

  function marsPos(angle: number): { x: number; y: number } {
    return {
      x: cx + MARS_ORBIT_AU * orbitScale * Math.cos(angle),
      y: cy - MARS_ORBIT_AU * orbitScale * Math.sin(angle),
    };
  }

  /** Apparent angle of Mars as seen from Earth, projected onto celestial sphere. */
  function apparentAngle(eAngle: number, mAngle: number): number {
    const ex = EARTH_ORBIT_AU * Math.cos(eAngle);
    const ey = EARTH_ORBIT_AU * Math.sin(eAngle);
    const mx = MARS_ORBIT_AU * Math.cos(mAngle);
    const my = MARS_ORBIT_AU * Math.sin(mAngle);
    return Math.atan2(my - ey, mx - ex);
  }

  /** Project apparent angle onto the celestial sphere circle. */
  function celestialPoint(angle: number): { x: number; y: number } {
    return {
      x: cx + celestialRadius * Math.cos(angle),
      y: cy - celestialRadius * Math.sin(angle),
    };
  }

  function isRetrograde(): boolean {
    if (trail.length < 6) return false;
    const a = trail[trail.length - 1].apparentAngle;
    const b = trail[trail.length - 5].apparentAngle;
    let diff = a - b;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    // Normally Mars drifts in the positive angular direction (prograde).
    // When Earth overtakes Mars, angular change becomes negative (retrograde).
    return diff < 0;
  }

  // ---- Lifecycle ----
  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    trail = [];
    markers = [];
    nextMarkerDay = MARKER_INTERVAL;
    computeLayout();
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 1;
    showSightLines = params.showSightLines ?? 1;
    trailLength = Math.round(params.trailLength ?? 50);
    earthSpeed = params.earthSpeed ?? 1;

    // Recalculate angular velocities based on earthSpeed multiplier.
    // earthSpeed scales Earth's angular velocity; Mars stays constant.
    earthAngularVel = ((2 * Math.PI) / BASE_EARTH_PERIOD) * earthSpeed;
    marsAngularVel = (2 * Math.PI) / BASE_MARS_PERIOD;

    // dt in seconds => simulated days.  At timeScale=1, 1 sec ~ 20 days.
    const dtDays = dt * 20 * timeScale;
    time += dtDays;

    const eAngle = earthAngularVel * time;
    const mAngle = marsAngularVel * time;
    const aAngle = apparentAngle(eAngle, mAngle);

    // Sample trail every ~0.4 simulated days
    const lastDay = trail.length > 0 ? trail[trail.length - 1].day : -1;
    if (time - lastDay >= 0.4) {
      trail.push({ earthAngle: eAngle, marsAngle: mAngle, apparentAngle: aAngle, day: time });
    }

    // Trim trail
    const maxPoints = trailLength * 6;
    if (trail.length > maxPoints) {
      trail = trail.slice(trail.length - maxPoints);
    }

    // Numbered markers at regular intervals
    if (time >= nextMarkerDay) {
      markers.push({
        earthAngle: eAngle,
        marsAngle: mAngle,
        apparentAngle: aAngle,
        day: time,
        index: markers.length + 1,
      });
      nextMarkerDay += MARKER_INTERVAL;
      if (markers.length > 40) {
        markers = markers.slice(markers.length - 40);
      }
    }
  }

  // ---- Rendering ----
  function drawBackground(): void {
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.75);
    bg.addColorStop(0, "#0d0b24");
    bg.addColorStop(0.4, "#080618");
    bg.addColorStop(1, "#02010a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(): void {
    for (const s of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(time * 0.018 + s.x * 0.04 + s.y * 0.06);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.brightness * twinkle})`;
      ctx.fill();
    }
  }

  function drawCelestialSphere(): void {
    // Faint dashed circle representing the distant star field
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.arc(cx, cy, celestialRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Small tick marks at 30-degree intervals with degree labels
    const fontSize = Math.max(8, Math.min(width, height) * 0.013);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const inner = celestialRadius - 4;
      const outer = celestialRadius + 4;
      const ix = cx + inner * Math.cos(rad);
      const iy = cy - inner * Math.sin(rad);
      const ox = cx + outer * Math.cos(rad);
      const oy = cy - outer * Math.sin(rad);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ox, oy);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Label
      const lx = cx + (celestialRadius + 14) * Math.cos(rad);
      const ly = cy - (celestialRadius + 14) * Math.sin(rad);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillText(`${deg}`, lx, ly);
    }
  }

  function drawOrbits(): void {
    // Earth orbit
    ctx.beginPath();
    ctx.arc(cx, cy, EARTH_ORBIT_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(70,140,255,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mars orbit
    ctx.beginPath();
    ctx.arc(cx, cy, MARS_ORBIT_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,80,40,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawSun(): void {
    const r = Math.max(7, orbitScale * 0.055);

    // Glow layers
    for (let i = 3; i >= 0; i--) {
      const gr = r * (2 + i * 1.2);
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, gr);
      grad.addColorStop(0, `rgba(255,255,200,${0.05 - i * 0.01})`);
      grad.addColorStop(1, "rgba(255,180,60,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, gr, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Sun body
    const sg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
    sg.addColorStop(0, "#ffffee");
    sg.addColorStop(0.3, "#ffee44");
    sg.addColorStop(0.7, "#ffcc00");
    sg.addColorStop(1, "#ee9900");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255,240,150,0.6)";
    ctx.font = `${Math.max(10, Math.min(width, height) * 0.017)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Sun", cx, cy + r + 14);
  }

  function drawPlanet(
    pos: { x: number; y: number },
    r: number,
    color: string,
    glowColor: string,
    label: string
  ): void {
    // Glow
    const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 4);
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r * 4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Body gradient
    const cr = parseInt(color.slice(1, 3), 16);
    const cg = parseInt(color.slice(3, 5), 16);
    const cb = parseInt(color.slice(5, 7), 16);
    const bodyGrad = ctx.createRadialGradient(
      pos.x - r * 0.3, pos.y - r * 0.3, 0,
      pos.x, pos.y, r
    );
    bodyGrad.addColorStop(0, "#ffffff");
    bodyGrad.addColorStop(0.3, color);
    bodyGrad.addColorStop(1, `rgb(${Math.max(0, cr - 60)},${Math.max(0, cg - 60)},${Math.max(0, cb - 60)})`);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Rim
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Label
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.85)`;
    ctx.font = `${Math.max(10, Math.min(width, height) * 0.017)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, pos.x, pos.y - r - 6);
  }

  function drawPlanets(): void {
    const eAngle = earthAngularVel * time;
    const mAngle = marsAngularVel * time;
    const ePos = earthPos(eAngle);
    const mPos = marsPos(mAngle);
    const eR = Math.max(5, orbitScale * 0.035);
    const mR = Math.max(4, orbitScale * 0.028);

    drawPlanet(ePos, eR, "#4488ff", "rgba(68,136,255,0.3)", "Earth");
    drawPlanet(mPos, mR, "#ff4422", "rgba(255,68,34,0.3)", "Mars");
  }

  function drawOrbitalTrails(): void {
    if (trail.length < 2) return;

    const startIdx = Math.max(0, trail.length - trailLength * 3);

    // Earth orbit trail
    ctx.beginPath();
    let started = false;
    for (let i = startIdx; i < trail.length; i++) {
      const pos = earthPos(trail[i].earthAngle);
      if (!started) { ctx.moveTo(pos.x, pos.y); started = true; }
      else ctx.lineTo(pos.x, pos.y);
    }
    ctx.strokeStyle = "rgba(68,136,255,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mars orbit trail
    ctx.beginPath();
    started = false;
    for (let i = startIdx; i < trail.length; i++) {
      const pos = marsPos(trail[i].marsAngle);
      if (!started) { ctx.moveTo(pos.x, pos.y); started = true; }
      else ctx.lineTo(pos.x, pos.y);
    }
    ctx.strokeStyle = "rgba(255,68,34,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawSightLines(): void {
    if (showSightLines < 0.5) return;

    const eAngle = earthAngularVel * time;
    const mAngle = marsAngularVel * time;
    const ePos = earthPos(eAngle);
    const mPos = marsPos(mAngle);
    const aAngle = apparentAngle(eAngle, mAngle);
    const cPt = celestialPoint(aAngle);

    // Current sight line: Earth -> Mars -> celestial sphere
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ePos.x, ePos.y);
    ctx.lineTo(cPt.x, cPt.y);
    ctx.strokeStyle = "rgba(255,255,100,0.4)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Projected dot on celestial sphere
    ctx.beginPath();
    ctx.arc(cPt.x, cPt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,200,60,0.8)";
    ctx.fill();

    // Draw past sight lines from markers
    const visibleMarkers = markers.filter(m => m.day > time - trailLength * 3);
    for (const mk of visibleMarkers) {
      const mePos = earthPos(mk.earthAngle);
      const mmPos = marsPos(mk.marsAngle);

      ctx.save();
      ctx.setLineDash([1, 6]);
      ctx.beginPath();
      ctx.moveTo(mePos.x, mePos.y);
      ctx.lineTo(mmPos.x, mmPos.y);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawApparentPath(): void {
    // Draw Mars's apparent position trail on the celestial sphere
    if (trail.length < 2) return;

    const startIdx = Math.max(0, trail.length - trailLength * 3);
    const totalVisible = trail.length - startIdx;

    for (let i = startIdx + 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      const p1 = celestialPoint(prev.apparentAngle);
      const p2 = celestialPoint(curr.apparentAngle);

      // Detect retrograde for this segment
      let angleDiff = curr.apparentAngle - prev.apparentAngle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      const segRetro = angleDiff < 0;

      // Fade older segments
      const age = (i - startIdx) / totalVisible;
      const alpha = 0.15 + age * 0.75;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);

      if (segRetro) {
        ctx.strokeStyle = `rgba(0,220,255,${alpha * 0.9})`;
        ctx.lineWidth = 2.8;
      } else {
        ctx.strokeStyle = `rgba(255,200,80,${alpha * 0.65})`;
        ctx.lineWidth = 1.8;
      }
      ctx.stroke();
    }

    // Current apparent position dot
    if (trail.length > 0) {
      const latest = trail[trail.length - 1];
      const pt = celestialPoint(latest.apparentAngle);

      const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 12);
      glow.addColorStop(0, "rgba(255,80,50,0.55)");
      glow.addColorStop(1, "rgba(255,80,50,0)");
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff5533";
      ctx.fill();
    }
  }

  function drawMarkers(): void {
    const markerR = Math.max(2, orbitScale * 0.012);
    const fontSize = Math.max(8, Math.min(width, height) * 0.013);
    const visibleMarkers = markers.filter(m => m.day > time - trailLength * 3);

    for (const mk of visibleMarkers) {
      // Marker on Earth orbit
      const ePos = earthPos(mk.earthAngle);
      ctx.beginPath();
      ctx.arc(ePos.x, ePos.y, markerR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(68,136,255,0.55)";
      ctx.fill();

      // Marker on Mars orbit
      const mPos = marsPos(mk.marsAngle);
      ctx.beginPath();
      ctx.arc(mPos.x, mPos.y, markerR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,68,34,0.55)";
      ctx.fill();

      // Marker on celestial sphere
      const cPt = celestialPoint(mk.apparentAngle);
      ctx.beginPath();
      ctx.arc(cPt.x, cPt.y, markerR + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,200,100,0.7)";
      ctx.fill();

      // Connect Earth marker to celestial sphere marker
      if (showSightLines >= 0.5) {
        ctx.save();
        ctx.setLineDash([1, 5]);
        ctx.beginPath();
        ctx.moveTo(ePos.x, ePos.y);
        ctx.lineTo(cPt.x, cPt.y);
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 0.4;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Index numbers
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText(`${mk.index}`, cPt.x, cPt.y - markerR - 6);
    }
  }

  function drawRetrogradeStatus(): void {
    const retro = isRetrograde();
    const fontSize = Math.max(12, Math.min(width, height) * 0.022);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (retro) {
      ctx.fillStyle = "rgba(0,220,255,0.85)";
      ctx.fillText("RETROGRADE", cx, 12);
    } else {
      ctx.fillStyle = "rgba(255,200,80,0.5)";
      ctx.fillText("PROGRADE", cx, 12);
    }
  }

  function drawHUD(): void {
    const days = time.toFixed(0);
    const years = (time / BASE_EARTH_PERIOD).toFixed(2);
    const eAngle = earthAngularVel * time;
    const mAngle = marsAngularVel * time;
    const eDeg = (((eAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI).toFixed(1);
    const mDeg = (((mAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI).toFixed(1);

    // Overlay background
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(8, height - 52, 260, 44, 6);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`Day ${days}  (${years} Earth years)`, 16, height - 28);
    ctx.fillText(`Earth: ${eDeg}\u00B0   Mars: ${mDeg}\u00B0   Speed: ${earthSpeed.toFixed(1)}x`, 16, height - 12);
  }

  function drawLegend(): void {
    const lx = width - 140;
    const ly = height - 46;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.roundRect(lx - 8, ly - 6, 140, 42, 6);
    ctx.fill();

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Prograde
    ctx.fillStyle = "rgba(255,200,80,0.8)";
    ctx.fillRect(lx, ly + 4, 16, 3);
    ctx.fillText("Prograde", lx + 22, ly + 6);

    // Retrograde
    ctx.fillStyle = "rgba(0,220,255,0.9)";
    ctx.fillRect(lx, ly + 22, 16, 3);
    ctx.fillText("Retrograde", lx + 22, ly + 24);
  }

  function render(): void {
    drawBackground();
    drawStars();
    drawCelestialSphere();
    drawOrbits();
    drawOrbitalTrails();
    drawApparentPath();
    drawSightLines();
    drawMarkers();
    drawSun();
    drawPlanets();
    drawRetrogradeStatus();
    drawHUD();
    drawLegend();
  }

  function reset(): void {
    time = 0;
    trail = [];
    markers = [];
    nextMarkerDay = MARKER_INTERVAL;
  }

  function destroy(): void {
    stars = [];
    trail = [];
    markers = [];
  }

  function getStateDescription(): string {
    const eAngle = earthAngularVel * time;
    const mAngle = marsAngularVel * time;
    const aAngle = apparentAngle(eAngle, mAngle);
    const aDeg = ((aAngle * 180) / Math.PI).toFixed(1);
    const eDeg = ((((eAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) * 180 / Math.PI).toFixed(1);
    const mDeg = ((((mAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) * 180 / Math.PI).toFixed(1);

    const retro = isRetrograde();

    // Angular separation between Earth and Mars (opposition when ~180 deg)
    let sep = mAngle - eAngle;
    while (sep > Math.PI) sep -= 2 * Math.PI;
    while (sep < -Math.PI) sep += 2 * Math.PI;
    const nearOpposition = Math.abs(Math.abs(sep) - Math.PI) < 0.3;

    return (
      `Apparent Motion of Mars | Day: ${time.toFixed(0)} (${(time / BASE_EARTH_PERIOD).toFixed(2)} yr) | ` +
      `Earth: ${eDeg} deg, Mars: ${mDeg} deg | ` +
      `Apparent angle: ${aDeg} deg | ` +
      `${retro ? "RETROGRADE" : "Prograde"}${nearOpposition ? " (near opposition)" : ""} | ` +
      `Time scale: ${timeScale}x, Earth speed: ${earthSpeed}x | ` +
      `Sight lines: ${showSightLines >= 0.5 ? "on" : "off"}, Trail: ${trailLength}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
    generateStars();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ApparentMotionOfMarsFactory;
