import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ApparentMotionVenusFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("apparent-motion-venus") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0; // simulation time in days

  // Starfield
  let stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Parameters
  let speed = 1;
  let showPhase = 1;
  let trailLength = 200;
  let showElongation = 1;

  // Orbital constants (in days)
  const VENUS_PERIOD = 224.7;
  const EARTH_PERIOD = 365.25;
  const VENUS_RADIUS_AU = 0.723;
  const EARTH_RADIUS_AU = 1.0;

  // Angular velocities (radians per day)
  const VENUS_OMEGA = (2 * Math.PI) / VENUS_PERIOD;
  const EARTH_OMEGA = (2 * Math.PI) / EARTH_PERIOD;

  // Orbital angles (radians, 0 = right, counterclockwise)
  let venusAngle = 0;
  let earthAngle = 0;

  // Venus trail (positions in orbital diagram)
  let venusTrail: Array<{ x: number; y: number }> = [];

  // Layout constants
  let topCenterX = 0;
  let topCenterY = 0;
  let orbitScale = 0; // pixels per AU
  let bottomCenterX = 0;
  let bottomCenterY = 0;
  let dividerY = 0;

  function computeLayout(): void {
    dividerY = height * 0.55;
    topCenterX = width * 0.5;
    topCenterY = dividerY * 0.48;
    orbitScale = Math.min(width * 0.32, dividerY * 0.38);

    bottomCenterX = width * 0.5;
    bottomCenterY = dividerY + (height - dividerY) * 0.5;
  }

  function generateStars(): void {
    stars = [];
    const count = Math.floor((width * height) / 700);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        brightness: 0.2 + Math.random() * 0.8,
        size: 0.4 + Math.random() * 1.2,
      });
    }
  }

  /** Get position in AU for a body */
  function getVenusPos(): { x: number; y: number } {
    return {
      x: VENUS_RADIUS_AU * Math.cos(venusAngle),
      y: VENUS_RADIUS_AU * Math.sin(venusAngle),
    };
  }

  function getEarthPos(): { x: number; y: number } {
    return {
      x: EARTH_RADIUS_AU * Math.cos(earthAngle),
      y: EARTH_RADIUS_AU * Math.sin(earthAngle),
    };
  }

  /** Convert AU position to screen coordinates in the top half */
  function auToScreen(ax: number, ay: number): { x: number; y: number } {
    return {
      x: topCenterX + ax * orbitScale,
      y: topCenterY - ay * orbitScale, // flip y for screen
    };
  }

  /** Calculate the elongation angle (Sun-Earth-Venus angle) in radians */
  function getElongation(): number {
    const ep = getEarthPos();
    const vp = getVenusPos();

    // Vector from Earth to Sun (Sun is at origin)
    const esx = -ep.x;
    const esy = -ep.y;
    // Vector from Earth to Venus
    const evx = vp.x - ep.x;
    const evy = vp.y - ep.y;

    const dot = esx * evx + esy * evy;
    const magES = Math.sqrt(esx * esx + esy * esy);
    const magEV = Math.sqrt(evx * evx + evy * evy);

    if (magES === 0 || magEV === 0) return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (magES * magEV)));
    return Math.acos(cosAngle);
  }

  /** Determine if Venus is east or west of the Sun (as seen from Earth).
   *  Cross product of (Earth->Sun) x (Earth->Venus):
   *  Positive = Venus is west (morning star), Negative = Venus is east (evening star) */
  function isEasternElongation(): boolean {
    const ep = getEarthPos();
    const vp = getVenusPos();

    const esx = -ep.x;
    const esy = -ep.y;
    const evx = vp.x - ep.x;
    const evy = vp.y - ep.y;

    const cross = esx * evy - esy * evx;
    return cross < 0;
  }

  /** Calculate the phase angle (Sun-Venus-Earth angle) in radians */
  function getPhaseAngle(): number {
    const ep = getEarthPos();
    const vp = getVenusPos();

    // Vector from Venus to Sun (Sun at origin)
    const vsx = -vp.x;
    const vsy = -vp.y;
    // Vector from Venus to Earth
    const vex = ep.x - vp.x;
    const vey = ep.y - vp.y;

    const dot = vsx * vex + vsy * vey;
    const magVS = Math.sqrt(vsx * vsx + vsy * vsy);
    const magVE = Math.sqrt(vex * vex + vey * vey);

    if (magVS === 0 || magVE === 0) return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (magVS * magVE)));
    return Math.acos(cosAngle);
  }

  /** Illuminated fraction of Venus (0 to 1) */
  function getIlluminatedFraction(): number {
    const phaseAngle = getPhaseAngle();
    return (1 + Math.cos(phaseAngle)) / 2;
  }

  /** Distance from Earth to Venus in AU */
  function getEarthVenusDistance(): number {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const dx = vp.x - ep.x;
    const dy = vp.y - ep.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Get phase name based on illuminated fraction and elongation */
  function getPhaseName(): string {
    const frac = getIlluminatedFraction();
    const elongDeg = (getElongation() * 180) / Math.PI;

    if (frac > 0.95) return "Full Venus";
    if (frac > 0.75) return "Gibbous";
    if (frac > 0.4) return "Half-illuminated";
    if (frac > 0.15) return "Crescent";
    if (elongDeg < 5) return "New Venus";
    return "Thin Crescent";
  }

  /** Get the conjunction/elongation state label */
  function getPositionLabel(): string {
    const elongDeg = (getElongation() * 180) / Math.PI;
    const eastern = isEasternElongation();
    const ep = getEarthPos();
    const vp = getVenusPos();

    // Check if near conjunction by checking if Venus, Sun, Earth are roughly aligned
    // Superior conjunction: Venus behind the Sun
    // Inferior conjunction: Venus between Earth and Sun
    const evDist = getEarthVenusDistance();
    const maxDist = EARTH_RADIUS_AU + VENUS_RADIUS_AU;
    const minDist = EARTH_RADIUS_AU - VENUS_RADIUS_AU;

    if (elongDeg < 5) {
      if (evDist > 1.2) return "Superior Conjunction";
      return "Inferior Conjunction";
    }
    if (elongDeg > 44 && elongDeg < 48) {
      return eastern ? "Greatest Eastern Elongation" : "Greatest Western Elongation";
    }
    if (elongDeg > 40) {
      return eastern ? "Near Greatest Eastern Elong." : "Near Greatest Western Elong.";
    }
    return eastern ? "Evening Star" : "Morning Star";
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    venusAngle = 0;
    earthAngle = 0;
    venusTrail = [];
    computeLayout();
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    speed = params.speed ?? 1;
    showPhase = params.showPhase ?? 1;
    trailLength = params.trailLength ?? 200;
    showElongation = params.showElongation ?? 1;

    // dt is in seconds; scale so 1 second = ~30 days at speed 1
    const dtDays = dt * 30 * speed;
    time += dtDays;

    venusAngle += VENUS_OMEGA * dtDays;
    earthAngle += EARTH_OMEGA * dtDays;

    // Record trail
    const vScreen = auToScreen(
      VENUS_RADIUS_AU * Math.cos(venusAngle),
      VENUS_RADIUS_AU * Math.sin(venusAngle)
    );
    venusTrail.push({ x: vScreen.x, y: vScreen.y });
    if (venusTrail.length > trailLength) {
      venusTrail = venusTrail.slice(venusTrail.length - trailLength);
    }
  }

  // ---------- RENDERING ----------

  function renderBackground(): void {
    const bgGrad = ctx.createRadialGradient(
      topCenterX, topCenterY, 0,
      topCenterX, topCenterY, Math.max(width, height)
    );
    bgGrad.addColorStop(0, "#0a0a1e");
    bgGrad.addColorStop(0.4, "#060412");
    bgGrad.addColorStop(1, "#010108");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function renderStars(): void {
    for (const star of stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 0.02 + star.x * 0.05 + star.y * 0.07);
      const alpha = star.brightness * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  function renderDivider(): void {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, dividerY);
    ctx.lineTo(width, dividerY);
    ctx.stroke();

    // Section labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = `${Math.max(10, Math.min(width, height) * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Orbital Diagram (Top-Down View)", 10, 8);
    ctx.fillText("Venus Phase & Apparent Size", 10, dividerY + 6);
  }

  function renderOrbits(): void {
    // Earth's orbit
    ctx.beginPath();
    ctx.arc(topCenterX, topCenterY, EARTH_RADIUS_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(68, 136, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Venus's orbit
    ctx.beginPath();
    ctx.arc(topCenterX, topCenterY, VENUS_RADIUS_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(218, 165, 32, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Orbit labels
    ctx.fillStyle = "rgba(68, 136, 255, 0.3)";
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.014)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("1 AU", topCenterX + EARTH_RADIUS_AU * orbitScale + 4, topCenterY);

    ctx.fillStyle = "rgba(218, 165, 32, 0.3)";
    ctx.fillText("0.72 AU", topCenterX + VENUS_RADIUS_AU * orbitScale + 4, topCenterY - 12);
  }

  function renderSun(): void {
    const sunR = Math.max(8, orbitScale * 0.06);

    // Glow
    for (let i = 3; i >= 0; i--) {
      const r = sunR * (2 + i * 0.8);
      const grad = ctx.createRadialGradient(topCenterX, topCenterY, sunR * 0.3, topCenterX, topCenterY, r);
      grad.addColorStop(0, `rgba(255, 255, 200, ${0.06 - i * 0.012})`);
      grad.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.beginPath();
      ctx.arc(topCenterX, topCenterY, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Sun body
    const sunGrad = ctx.createRadialGradient(
      topCenterX - sunR * 0.2, topCenterY - sunR * 0.2, 0,
      topCenterX, topCenterY, sunR
    );
    sunGrad.addColorStop(0, "#fffff0");
    sunGrad.addColorStop(0.3, "#ffee55");
    sunGrad.addColorStop(0.7, "#ffcc00");
    sunGrad.addColorStop(1, "#ff9900");
    ctx.beginPath();
    ctx.arc(topCenterX, topCenterY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Label
    ctx.fillStyle = "rgba(255, 240, 150, 0.7)";
    ctx.font = `${Math.max(10, Math.min(width, height) * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Sun", topCenterX, topCenterY + sunR + 4);
  }

  function renderVenusTrail(): void {
    if (venusTrail.length < 2) return;
    for (let i = 1; i < venusTrail.length; i++) {
      const alpha = (i / venusTrail.length) * 0.5;
      ctx.beginPath();
      ctx.moveTo(venusTrail[i - 1].x, venusTrail[i - 1].y);
      ctx.lineTo(venusTrail[i].x, venusTrail[i].y);
      ctx.strokeStyle = `rgba(218, 165, 32, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function renderBodies(): void {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const earthScreen = auToScreen(ep.x, ep.y);
    const venusScreen = auToScreen(vp.x, vp.y);
    const earthR = Math.max(5, orbitScale * 0.035);
    const venusR = Math.max(4, orbitScale * 0.03);

    // Earth
    const earthGrad = ctx.createRadialGradient(
      earthScreen.x - earthR * 0.3, earthScreen.y - earthR * 0.3, 0,
      earthScreen.x, earthScreen.y, earthR
    );
    earthGrad.addColorStop(0, "#88bbff");
    earthGrad.addColorStop(0.5, "#4488ff");
    earthGrad.addColorStop(1, "#2244aa");
    ctx.beginPath();
    ctx.arc(earthScreen.x, earthScreen.y, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Earth glow
    const earthGlow = ctx.createRadialGradient(
      earthScreen.x, earthScreen.y, earthR,
      earthScreen.x, earthScreen.y, earthR * 2.5
    );
    earthGlow.addColorStop(0, "rgba(68, 136, 255, 0.2)");
    earthGlow.addColorStop(1, "rgba(68, 136, 255, 0)");
    ctx.beginPath();
    ctx.arc(earthScreen.x, earthScreen.y, earthR * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = earthGlow;
    ctx.fill();

    ctx.fillStyle = "rgba(100, 170, 255, 0.8)";
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.015)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Earth", earthScreen.x, earthScreen.y + earthR + 4);

    // Venus
    const venusGrad = ctx.createRadialGradient(
      venusScreen.x - venusR * 0.3, venusScreen.y - venusR * 0.3, 0,
      venusScreen.x, venusScreen.y, venusR
    );
    venusGrad.addColorStop(0, "#ffe8a0");
    venusGrad.addColorStop(0.5, "#daa520");
    venusGrad.addColorStop(1, "#996600");
    ctx.beginPath();
    ctx.arc(venusScreen.x, venusScreen.y, venusR, 0, Math.PI * 2);
    ctx.fillStyle = venusGrad;
    ctx.fill();

    // Venus glow
    const venusGlow = ctx.createRadialGradient(
      venusScreen.x, venusScreen.y, venusR,
      venusScreen.x, venusScreen.y, venusR * 2.5
    );
    venusGlow.addColorStop(0, "rgba(218, 165, 32, 0.2)");
    venusGlow.addColorStop(1, "rgba(218, 165, 32, 0)");
    ctx.beginPath();
    ctx.arc(venusScreen.x, venusScreen.y, venusR * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = venusGlow;
    ctx.fill();

    ctx.fillStyle = "rgba(218, 180, 80, 0.8)";
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.015)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Venus", venusScreen.x, venusScreen.y + venusR + 4);
  }

  function renderLineOfSight(): void {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const earthScreen = auToScreen(ep.x, ep.y);
    const venusScreen = auToScreen(vp.x, vp.y);

    // Line from Earth to Venus
    ctx.beginPath();
    ctx.moveTo(earthScreen.x, earthScreen.y);
    ctx.lineTo(venusScreen.x, venusScreen.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderElongationArc(): void {
    if (showElongation < 0.5) return;

    const ep = getEarthPos();
    const vp = getVenusPos();
    const earthScreen = auToScreen(ep.x, ep.y);

    // Angle from Earth to Sun
    const angleToSun = Math.atan2(-((-ep.y) * -1), -ep.x * -1);
    // Note: Sun is at origin. Vector Earth->Sun is (-ep.x, -ep.y).
    // On screen: Earth->Sun direction
    const sunDir = Math.atan2(-((-ep.y)), -ep.x); // screen y is flipped

    // Vector Earth->Venus in screen coordinates
    const evx = vp.x - ep.x;
    const evy = -(vp.y - ep.y); // flip for screen
    const venusDir = Math.atan2(evy, evx);

    // Direction from Earth to Sun in screen coordinates
    const esx = -ep.x;
    const esy = -(-ep.y); // flip for screen
    const sunDirScreen = Math.atan2(esy, esx);

    const elongRad = getElongation();
    const elongDeg = (elongRad * 180) / Math.PI;

    // Draw the arc
    const arcR = Math.max(20, orbitScale * 0.15);

    ctx.beginPath();
    // Draw arc from sun direction to venus direction
    const startAngle = sunDirScreen;
    const eastern = isEasternElongation();
    // Determine which way to sweep
    let endAngle = venusDir;

    ctx.arc(earthScreen.x, earthScreen.y, arcR, startAngle, endAngle, eastern);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label the angle
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = arcR + 14;
    const lx = earthScreen.x + labelR * Math.cos(midAngle);
    const ly = earthScreen.y + labelR * Math.sin(midAngle);

    ctx.fillStyle = "rgba(255, 220, 100, 0.8)";
    ctx.font = `bold ${Math.max(10, Math.min(width, height) * 0.016)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${elongDeg.toFixed(1)}°`, lx, ly);
  }

  function renderGreatestElongationMarkers(): void {
    if (showElongation < 0.5) return;

    const ep = getEarthPos();
    const earthScreen = auToScreen(ep.x, ep.y);

    // Greatest elongation is ~46-47 degrees from Sun-Earth line
    // Direction from Earth to Sun
    const toSunAngle = Math.atan2(-ep.y, -ep.x);

    const maxElongRad = (47 * Math.PI) / 180;
    const markerDist = VENUS_RADIUS_AU * orbitScale * 0.9;

    // Eastern elongation marker (evening star side)
    const eastAngle = toSunAngle - maxElongRad;
    const eastX = earthScreen.x + markerDist * Math.cos(eastAngle);
    const eastY = earthScreen.y - markerDist * Math.sin(eastAngle);

    // Western elongation marker (morning star side)
    const westAngle = toSunAngle + maxElongRad;
    const westX = earthScreen.x + markerDist * Math.cos(westAngle);
    const westY = earthScreen.y - markerDist * Math.sin(westAngle);

    // Draw small markers
    const markerFont = `${Math.max(8, Math.min(width, height) * 0.012)}px system-ui, sans-serif`;
    ctx.font = markerFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Dashed lines to greatest elongation positions
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.15)";
    ctx.lineWidth = 0.8;

    ctx.beginPath();
    ctx.moveTo(earthScreen.x, earthScreen.y);
    ctx.lineTo(eastX, eastY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(earthScreen.x, earthScreen.y);
    ctx.lineTo(westX, westY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255, 180, 100, 0.45)";
    ctx.fillText("GEE", eastX, eastY - 8);
    ctx.fillText("GWE", westX, westY - 8);
  }

  function renderMorningEveningStar(): void {
    const eastern = isEasternElongation();
    const elongDeg = (getElongation() * 180) / Math.PI;
    const label = eastern ? "Evening Star" : "Morning Star";

    // Position label in top-right of orbital diagram
    ctx.fillStyle = eastern
      ? "rgba(255, 180, 80, 0.7)"
      : "rgba(180, 200, 255, 0.7)";
    ctx.font = `bold ${Math.max(12, Math.min(width, height) * 0.02)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(label, width - 14, 8);
  }

  // ---------- BOTTOM HALF: PHASE DISPLAY ----------

  function renderVenusPhase(): void {
    if (showPhase < 0.5) return;

    const frac = getIlluminatedFraction();
    const distance = getEarthVenusDistance();
    const phaseAngle = getPhaseAngle();
    const elongDeg = (getElongation() * 180) / Math.PI;
    const eastern = isEasternElongation();

    // Apparent size: inversely proportional to distance squared, normalized
    // At closest (~0.277 AU), apparent diameter is large; at farthest (~1.723 AU), small
    const maxApparentR = Math.min(width, height) * 0.09;
    const minApparentR = Math.min(width, height) * 0.015;
    const minDist = EARTH_RADIUS_AU - VENUS_RADIUS_AU; // ~0.277 AU
    const maxDist = EARTH_RADIUS_AU + VENUS_RADIUS_AU; // ~1.723 AU
    const distNorm = (distance - minDist) / (maxDist - minDist);
    const apparentR = maxApparentR - distNorm * (maxApparentR - minApparentR);

    const cx = bottomCenterX;
    const cy = bottomCenterY - 5;

    // Dark circle background (unlit Venus)
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "rgba(218, 165, 32, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw the illuminated portion using the phase angle
    // The phase angle tells us how much is illuminated
    // We need to determine which side is lit based on Venus's position relative to Earth
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, 0, Math.PI * 2);
    ctx.clip();

    // The terminator is drawn as an ellipse
    // When phase angle = 0, fully illuminated (full); when PI, not illuminated (new)
    // The lit side depends on whether Venus is east or west of the Sun-Earth line

    // Draw the lit half first
    const litSideSign = eastern ? 1 : -1;

    // Lit half: a semicircle on one side
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, -Math.PI / 2, Math.PI / 2, litSideSign < 0);
    ctx.closePath();
    ctx.fillStyle = "#ffe8a0";
    ctx.fill();

    // Now adjust with the terminator ellipse
    // The terminator's x-scale depends on illuminated fraction
    // illuminated fraction = (1 + cos(phaseAngle)) / 2
    // cos(phaseAngle) = 2*frac - 1
    const terminatorScale = Math.cos(phaseAngle); // ranges from -1 (new) to 1 (full)

    // The terminator is an ellipse with semi-major = apparentR (vertical) and
    // semi-minor = |terminatorScale| * apparentR (horizontal)
    // If terminatorScale > 0, the extra illuminated area overlaps the dark side
    // If terminatorScale < 0, the shadow encroaches on the lit side

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(terminatorScale) * apparentR, apparentR, 0, -Math.PI / 2, Math.PI / 2, litSideSign < 0);
    ctx.closePath();

    if (terminatorScale > 0) {
      // More than half illuminated: fill the terminator ellipse with light
      ctx.fillStyle = "#ffe8a0";
    } else {
      // Less than half illuminated: fill the terminator ellipse with dark
      ctx.fillStyle = "#1a1a2e";
    }
    ctx.fill();

    ctx.restore();

    // Subtle gradient overlay for realism
    const shadeGrad = ctx.createRadialGradient(
      cx - apparentR * 0.3, cy - apparentR * 0.3, 0,
      cx, cy, apparentR
    );
    shadeGrad.addColorStop(0, "rgba(255, 255, 255, 0.05)");
    shadeGrad.addColorStop(1, "rgba(0, 0, 0, 0.1)");
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, 0, Math.PI * 2);
    ctx.fillStyle = shadeGrad;
    ctx.fill();

    // Phase info text
    const infoFont = `${Math.max(11, Math.min(width, height) * 0.018)}px system-ui, sans-serif`;
    ctx.font = infoFont;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";

    const phaseName = getPhaseName();
    const posLabel = getPositionLabel();

    ctx.textBaseline = "top";
    const textY = cy + apparentR + 12;
    ctx.fillText(`Phase: ${phaseName} (${(frac * 100).toFixed(1)}% illuminated)`, cx, textY);

    ctx.fillStyle = "rgba(218, 180, 80, 0.7)";
    ctx.fillText(`Elongation: ${elongDeg.toFixed(1)}°  |  Distance: ${distance.toFixed(3)} AU`, cx, textY + 18);

    ctx.fillStyle = eastern
      ? "rgba(255, 180, 80, 0.8)"
      : "rgba(180, 200, 255, 0.8)";
    ctx.font = `bold ${Math.max(12, Math.min(width, height) * 0.02)}px system-ui, sans-serif`;
    ctx.fillText(posLabel, cx, textY + 38);

    // Apparent size indicator
    const sizeFont = `${Math.max(9, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
    ctx.font = sizeFont;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `Apparent angular diameter: ${(apparentR / maxApparentR * 60).toFixed(1)}" (relative)`,
      cx, cy - apparentR - 8
    );
  }

  function render(): void {
    renderBackground();
    renderStars();
    renderDivider();

    // --- TOP HALF: Orbital diagram ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, dividerY);
    ctx.clip();

    renderOrbits();
    renderSun();
    renderVenusTrail();
    renderGreatestElongationMarkers();
    renderLineOfSight();
    renderElongationArc();
    renderBodies();
    renderMorningEveningStar();

    ctx.restore();

    // --- BOTTOM HALF: Phase display ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, dividerY, width, height - dividerY);
    ctx.clip();

    renderVenusPhase();

    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const days = time.toFixed(0);
    const synodic = ((time % 583.9) / 583.9 * 100).toFixed(0);
    ctx.fillText(`Day ${days}  |  Synodic cycle: ${synodic}%`, 10, height - 10);
  }

  function reset(): void {
    time = 0;
    venusAngle = 0;
    earthAngle = 0;
    venusTrail = [];
  }

  function destroy(): void {
    stars = [];
    venusTrail = [];
  }

  function getStateDescription(): string {
    const elongDeg = (getElongation() * 180) / Math.PI;
    const frac = getIlluminatedFraction();
    const dist = getEarthVenusDistance();
    const eastern = isEasternElongation();
    const phaseName = getPhaseName();
    const posLabel = getPositionLabel();

    return (
      `Apparent Motion of Venus | Day: ${time.toFixed(0)} | ` +
      `Elongation: ${elongDeg.toFixed(1)} deg (${eastern ? "Eastern/Evening" : "Western/Morning"}) | ` +
      `Phase: ${phaseName} (${(frac * 100).toFixed(1)}% illuminated) | ` +
      `Position: ${posLabel} | ` +
      `Earth-Venus distance: ${dist.toFixed(3)} AU | ` +
      `Venus orbital angle: ${((venusAngle * 180 / Math.PI) % 360).toFixed(1)} deg | ` +
      `Earth orbital angle: ${((earthAngle * 180 / Math.PI) % 360).toFixed(1)} deg | ` +
      `Speed: ${speed}x | Trail: ${trailLength}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
    generateStars();
    // Rebuild trail with new coordinates
    venusTrail = [];
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy,
    getStateDescription,
    resize,
  };
};

export default ApparentMotionVenusFactory;
