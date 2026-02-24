import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ApparentMotionOfVenusFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("apparent-motion-of-venus") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0; // simulation time in days

  // Parameters
  let speed = 1;
  let showPhase = 1;
  let trailLength = 200;
  let showElongation = 1;

  // Orbital constants
  const VENUS_PERIOD = 224.7; // days
  const EARTH_PERIOD = 365.25; // days
  const SYNODIC_PERIOD = 583.9; // days
  const VENUS_AU = 0.723;
  const EARTH_AU = 1.0;
  const VENUS_OMEGA = (2 * Math.PI) / VENUS_PERIOD; // rad/day
  const EARTH_OMEGA = (2 * Math.PI) / EARTH_PERIOD; // rad/day
  const MAX_ELONGATION_DEG = 47;

  // Planet angles (radians, counterclockwise from right)
  let venusAngle = 0;
  let earthAngle = 0;

  // Trail history
  let venusTrail: Array<{ x: number; y: number }> = [];

  // Elongation history for bottom strip
  let elongationHistory: Array<{ day: number; elongDeg: number; eastern: boolean }> = [];

  // Starfield
  let stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Layout
  let leftPanelW = 0;
  let leftCx = 0;
  let leftCy = 0;
  let orbitScale = 0;
  let rightPanelX = 0;
  let rightPanelW = 0;
  let rightPanelCx = 0;
  let rightPanelCy = 0;
  let stripY = 0;
  let stripH = 0;

  function computeLayout(): void {
    // Left panel: top-down solar system (60% width, top 75%)
    leftPanelW = width * 0.58;
    leftCx = leftPanelW * 0.5;
    leftCy = height * 0.38;
    orbitScale = Math.min(leftPanelW * 0.35, height * 0.28);

    // Right panel: Venus phase detail (40% width, top 75%)
    rightPanelX = leftPanelW;
    rightPanelW = width - leftPanelW;
    rightPanelCx = rightPanelX + rightPanelW * 0.5;
    rightPanelCy = height * 0.35;

    // Bottom strip: elongation over time
    stripY = height * 0.74;
    stripH = height * 0.24;
  }

  function generateStars(): void {
    stars = [];
    const count = Math.floor((width * height) / 800);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        brightness: 0.15 + Math.random() * 0.7,
        size: 0.3 + Math.random() * 1.0,
      });
    }
  }

  // -- Position helpers --

  function getVenusPos(): { x: number; y: number } {
    return { x: VENUS_AU * Math.cos(venusAngle), y: VENUS_AU * Math.sin(venusAngle) };
  }

  function getEarthPos(): { x: number; y: number } {
    return { x: EARTH_AU * Math.cos(earthAngle), y: EARTH_AU * Math.sin(earthAngle) };
  }

  function auToScreen(ax: number, ay: number): { x: number; y: number } {
    return { x: leftCx + ax * orbitScale, y: leftCy - ay * orbitScale };
  }

  // -- Physics calculations --

  function getElongation(): number {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const esx = -ep.x;
    const esy = -ep.y;
    const evx = vp.x - ep.x;
    const evy = vp.y - ep.y;
    const dot = esx * evx + esy * evy;
    const magES = Math.sqrt(esx * esx + esy * esy);
    const magEV = Math.sqrt(evx * evx + evy * evy);
    if (magES === 0 || magEV === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / (magES * magEV))));
  }

  function isEasternElongation(): boolean {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const esx = -ep.x;
    const esy = -ep.y;
    const evx = vp.x - ep.x;
    const evy = vp.y - ep.y;
    return esx * evy - esy * evx < 0;
  }

  function getPhaseAngle(): number {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const vsx = -vp.x;
    const vsy = -vp.y;
    const vex = ep.x - vp.x;
    const vey = ep.y - vp.y;
    const dot = vsx * vex + vsy * vey;
    const m1 = Math.sqrt(vsx * vsx + vsy * vsy);
    const m2 = Math.sqrt(vex * vex + vey * vey);
    if (m1 === 0 || m2 === 0) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2))));
  }

  function getIlluminatedFraction(): number {
    return (1 + Math.cos(getPhaseAngle())) / 2;
  }

  function getEarthVenusDistance(): number {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const dx = vp.x - ep.x;
    const dy = vp.y - ep.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getPhaseName(): string {
    const frac = getIlluminatedFraction();
    const elongDeg = (getElongation() * 180) / Math.PI;
    if (frac > 0.95) return "Full";
    if (frac > 0.75) return "Gibbous";
    if (frac > 0.4) return "Half";
    if (frac > 0.15) return "Crescent";
    if (elongDeg < 5) return "New";
    return "Thin Crescent";
  }

  function getPositionLabel(): string {
    const elongDeg = (getElongation() * 180) / Math.PI;
    const eastern = isEasternElongation();
    const dist = getEarthVenusDistance();
    if (elongDeg < 5) {
      return dist > 1.2 ? "Superior Conjunction" : "Inferior Conjunction";
    }
    if (elongDeg > 44 && elongDeg < 48) {
      return eastern ? "Greatest Eastern Elongation" : "Greatest Western Elongation";
    }
    if (elongDeg > 40) {
      return eastern ? "Near Greatest E. Elong." : "Near Greatest W. Elong.";
    }
    return eastern ? "Evening Star" : "Morning Star";
  }

  // -- Init / Update --

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    venusAngle = 0;
    earthAngle = 0;
    venusTrail = [];
    elongationHistory = [];
    computeLayout();
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    speed = params.speed ?? 1;
    showPhase = params.showPhase ?? 1;
    trailLength = Math.round(params.trailLength ?? 200);
    showElongation = params.showElongation ?? 1;

    const dtDays = dt * 30 * speed;
    time += dtDays;

    venusAngle += VENUS_OMEGA * dtDays;
    earthAngle += EARTH_OMEGA * dtDays;

    // Record Venus trail in screen coordinates
    const vScreen = auToScreen(
      VENUS_AU * Math.cos(venusAngle),
      VENUS_AU * Math.sin(venusAngle)
    );
    venusTrail.push({ x: vScreen.x, y: vScreen.y });
    if (venusTrail.length > trailLength) {
      venusTrail = venusTrail.slice(venusTrail.length - trailLength);
    }

    // Record elongation history
    const elongDeg = (getElongation() * 180) / Math.PI;
    const eastern = isEasternElongation();
    const lastDay = elongationHistory.length > 0 ? elongationHistory[elongationHistory.length - 1].day : -1;
    if (time - lastDay > 0.5) {
      elongationHistory.push({ day: time, elongDeg, eastern });
    }
    const maxHistPoints = 1200;
    if (elongationHistory.length > maxHistPoints) {
      elongationHistory = elongationHistory.slice(elongationHistory.length - maxHistPoints);
    }
  }

  // -- Rendering --

  function renderBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(0.6, "#0d0d24");
    bgGrad.addColorStop(1, "#10102a");
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

  function renderDividers(): void {
    // Vertical divider between left and right panels
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPanelW, 0);
    ctx.lineTo(leftPanelW, stripY);
    ctx.stroke();

    // Horizontal divider above bottom strip
    ctx.beginPath();
    ctx.moveTo(0, stripY);
    ctx.lineTo(width, stripY);
    ctx.stroke();

    // Section labels
    const fontSize = Math.max(10, Math.min(width, height) * 0.016);
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Top-Down View", 10, 8);

    if (showPhase >= 0.5) {
      ctx.fillText("Phase Detail", rightPanelX + 10, 8);
    }

    if (showElongation >= 0.5) {
      ctx.fillText("Elongation Over Time", 10, stripY + 6);
    }
  }

  function renderOrbits(): void {
    // Earth orbit
    ctx.beginPath();
    ctx.arc(leftCx, leftCy, EARTH_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(68, 136, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Venus orbit
    ctx.beginPath();
    ctx.arc(leftCx, leftCy, VENUS_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(218, 165, 32, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Orbit labels
    const fs = Math.max(9, Math.min(width, height) * 0.013);
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(68, 136, 255, 0.3)";
    ctx.fillText("1 AU", leftCx + EARTH_AU * orbitScale + 4, leftCy);
    ctx.fillStyle = "rgba(218, 165, 32, 0.3)";
    ctx.fillText("0.72 AU", leftCx + VENUS_AU * orbitScale + 4, leftCy - 14);
  }

  function renderSun(): void {
    const sunR = Math.max(7, orbitScale * 0.055);

    // Glow layers
    for (let i = 3; i >= 0; i--) {
      const r = sunR * (2 + i * 0.8);
      const grad = ctx.createRadialGradient(leftCx, leftCy, sunR * 0.3, leftCx, leftCy, r);
      grad.addColorStop(0, `rgba(255, 255, 200, ${0.06 - i * 0.012})`);
      grad.addColorStop(1, "rgba(255, 200, 50, 0)");
      ctx.beginPath();
      ctx.arc(leftCx, leftCy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Sun body
    const sunGrad = ctx.createRadialGradient(
      leftCx - sunR * 0.2, leftCy - sunR * 0.2, 0,
      leftCx, leftCy, sunR
    );
    sunGrad.addColorStop(0, "#fffff0");
    sunGrad.addColorStop(0.3, "#ffee55");
    sunGrad.addColorStop(0.7, "#ffcc00");
    sunGrad.addColorStop(1, "#ff9900");
    ctx.beginPath();
    ctx.arc(leftCx, leftCy, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    ctx.fillStyle = "rgba(255, 240, 150, 0.7)";
    const fs = Math.max(10, Math.min(width, height) * 0.015);
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Sun", leftCx, leftCy + sunR + 4);
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
    const venusR = Math.max(4, orbitScale * 0.028);

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
    const eGlow = ctx.createRadialGradient(
      earthScreen.x, earthScreen.y, earthR,
      earthScreen.x, earthScreen.y, earthR * 2.5
    );
    eGlow.addColorStop(0, "rgba(68, 136, 255, 0.2)");
    eGlow.addColorStop(1, "rgba(68, 136, 255, 0)");
    ctx.beginPath();
    ctx.arc(earthScreen.x, earthScreen.y, earthR * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = eGlow;
    ctx.fill();

    const fs = Math.max(9, Math.min(width, height) * 0.014);
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(100, 170, 255, 0.8)";
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
    const vGlow = ctx.createRadialGradient(
      venusScreen.x, venusScreen.y, venusR,
      venusScreen.x, venusScreen.y, venusR * 2.5
    );
    vGlow.addColorStop(0, "rgba(218, 165, 32, 0.2)");
    vGlow.addColorStop(1, "rgba(218, 165, 32, 0)");
    ctx.beginPath();
    ctx.arc(venusScreen.x, venusScreen.y, venusR * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = vGlow;
    ctx.fill();

    ctx.fillStyle = "rgba(218, 180, 80, 0.8)";
    ctx.fillText("Venus", venusScreen.x, venusScreen.y + venusR + 4);
  }

  function renderSightLine(): void {
    const ep = getEarthPos();
    const vp = getVenusPos();
    const earthScreen = auToScreen(ep.x, ep.y);
    const venusScreen = auToScreen(vp.x, vp.y);

    ctx.beginPath();
    ctx.moveTo(earthScreen.x, earthScreen.y);
    ctx.lineTo(venusScreen.x, venusScreen.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Also draw Earth to Sun line
    const sunScreen = auToScreen(0, 0);
    ctx.beginPath();
    ctx.moveTo(earthScreen.x, earthScreen.y);
    ctx.lineTo(sunScreen.x, sunScreen.y);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.12)";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderElongationArc(): void {
    if (showElongation < 0.5) return;

    const ep = getEarthPos();
    const vp = getVenusPos();
    const earthScreen = auToScreen(ep.x, ep.y);

    // Direction from Earth to Sun on screen
    const esx = -ep.x;
    const esy = -(-ep.y); // screen y flip
    const sunDirScreen = Math.atan2(esy, esx);

    // Direction from Earth to Venus on screen
    const evx = vp.x - ep.x;
    const evy = -(vp.y - ep.y);
    const venusDirScreen = Math.atan2(evy, evx);

    const arcR = Math.max(18, orbitScale * 0.13);
    const eastern = isEasternElongation();

    ctx.beginPath();
    ctx.arc(earthScreen.x, earthScreen.y, arcR, sunDirScreen, venusDirScreen, eastern);
    ctx.strokeStyle = "rgba(255, 200, 100, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    const elongDeg = (getElongation() * 180) / Math.PI;
    const midAngle = (sunDirScreen + venusDirScreen) / 2;
    const labelR = arcR + 14;
    const lx = earthScreen.x + labelR * Math.cos(midAngle);
    const ly = earthScreen.y + labelR * Math.sin(midAngle);
    const fs = Math.max(10, Math.min(width, height) * 0.015);
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 220, 100, 0.8)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${elongDeg.toFixed(1)}\u00B0`, lx, ly);
  }

  function renderMorningEveningLabel(): void {
    const eastern = isEasternElongation();
    const label = eastern ? "Evening Star" : "Morning Star";
    const fs = Math.max(12, Math.min(width, height) * 0.02);
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = eastern ? "rgba(255, 180, 80, 0.7)" : "rgba(180, 200, 255, 0.7)";
    ctx.fillText(label, leftCx, leftCy - EARTH_AU * orbitScale - 24);
  }

  // -- Phase detail panel (right side) --

  function renderPhaseDetail(): void {
    if (showPhase < 0.5) return;

    const frac = getIlluminatedFraction();
    const dist = getEarthVenusDistance();
    const phaseAngle = getPhaseAngle();
    const eastern = isEasternElongation();
    const elongDeg = (getElongation() * 180) / Math.PI;

    // Apparent size: inversely proportional to distance
    const maxApparentR = Math.min(rightPanelW * 0.28, (stripY - 60) * 0.28);
    const minApparentR = maxApparentR * 0.15;
    const minDist = EARTH_AU - VENUS_AU; // ~0.277
    const maxDist = EARTH_AU + VENUS_AU; // ~1.723
    const distNorm = Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
    const apparentR = maxApparentR - distNorm * (maxApparentR - minApparentR);

    const cx = rightPanelCx;
    const cy = rightPanelCy;

    // Dark circle (unlit Venus)
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, 0, Math.PI * 2);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "rgba(218, 165, 32, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw illuminated portion
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, 0, Math.PI * 2);
    ctx.clip();

    const litSideSign = eastern ? 1 : -1;

    // Lit half: semicircle on one side
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, -Math.PI / 2, Math.PI / 2, litSideSign < 0);
    ctx.closePath();
    ctx.fillStyle = "#ffe8a0";
    ctx.fill();

    // Terminator ellipse
    const terminatorScale = Math.cos(phaseAngle);
    ctx.beginPath();
    ctx.ellipse(
      cx, cy,
      Math.abs(terminatorScale) * apparentR, apparentR,
      0, -Math.PI / 2, Math.PI / 2,
      litSideSign < 0
    );
    ctx.closePath();
    ctx.fillStyle = terminatorScale > 0 ? "#ffe8a0" : "#1a1a2e";
    ctx.fill();

    ctx.restore();

    // Subtle gradient overlay
    const shade = ctx.createRadialGradient(
      cx - apparentR * 0.3, cy - apparentR * 0.3, 0,
      cx, cy, apparentR
    );
    shade.addColorStop(0, "rgba(255, 255, 255, 0.05)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.1)");
    ctx.beginPath();
    ctx.arc(cx, cy, apparentR, 0, Math.PI * 2);
    ctx.fillStyle = shade;
    ctx.fill();

    // Phase info text
    const fs = Math.max(11, Math.min(width, height) * 0.017);
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const phaseName = getPhaseName();
    const posLabel = getPositionLabel();
    const textY = cy + apparentR + 12;

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(`Phase: ${phaseName}`, cx, textY);
    ctx.fillText(`${(frac * 100).toFixed(1)}% illuminated`, cx, textY + fs + 4);

    ctx.fillStyle = "rgba(218, 180, 80, 0.7)";
    ctx.fillText(`Elong: ${elongDeg.toFixed(1)}\u00B0  |  Dist: ${dist.toFixed(3)} AU`, cx, textY + (fs + 4) * 2);

    ctx.fillStyle = eastern ? "rgba(255, 180, 80, 0.8)" : "rgba(180, 200, 255, 0.8)";
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.fillText(posLabel, cx, textY + (fs + 4) * 3);

    // Apparent size label
    ctx.font = `${Math.max(9, Math.min(width, height) * 0.012)}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      `Apparent size: ${(apparentR / maxApparentR * 60).toFixed(1)}" (relative)`,
      cx, cy - apparentR - 8
    );
  }

  // -- Bottom strip: elongation over time --

  function renderElongationStrip(): void {
    if (showElongation < 0.5) return;
    if (elongationHistory.length < 2) return;

    const margin = 40;
    const graphLeft = margin;
    const graphRight = width - 20;
    const graphW = graphRight - graphLeft;
    const graphTop = stripY + 24;
    const graphBottom = stripY + stripH - 16;
    const graphH = graphBottom - graphTop;

    // Background
    ctx.fillStyle = "rgba(5, 5, 20, 0.5)";
    ctx.fillRect(graphLeft - 4, graphTop - 4, graphW + 8, graphH + 8);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphLeft - 4, graphTop - 4, graphW + 8, graphH + 8);

    // Determine time window (show last ~2 synodic periods or trail window)
    const windowDays = Math.max(SYNODIC_PERIOD * 1.5, trailLength * 4);
    const startDay = Math.max(0, time - windowDays);

    // Y-axis: elongation 0 to 50 degrees
    const maxElongAxis = 50;

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 0.5;
    for (let deg = 10; deg <= maxElongAxis; deg += 10) {
      const y = graphBottom - (deg / maxElongAxis) * graphH;
      ctx.beginPath();
      ctx.moveTo(graphLeft, y);
      ctx.lineTo(graphRight, y);
      ctx.stroke();
    }

    // Max elongation reference line
    const maxElongY = graphBottom - (MAX_ELONGATION_DEG / maxElongAxis) * graphH;
    ctx.strokeStyle = "rgba(255, 200, 100, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(graphLeft, maxElongY);
    ctx.lineTo(graphRight, maxElongY);
    ctx.stroke();
    ctx.setLineDash([]);

    const fs = Math.max(8, Math.min(width, height) * 0.012);
    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 200, 100, 0.5)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("47\u00B0 max", graphLeft - 4, maxElongY);

    // Y-axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let deg = 0; deg <= maxElongAxis; deg += 10) {
      const y = graphBottom - (deg / maxElongAxis) * graphH;
      ctx.fillText(`${deg}\u00B0`, graphLeft - 4, y);
    }

    // Draw elongation curve
    const visiblePts = elongationHistory.filter(p => p.day >= startDay);
    if (visiblePts.length < 2) return;

    ctx.beginPath();
    let started = false;
    for (const pt of visiblePts) {
      const x = graphLeft + ((pt.day - startDay) / windowDays) * graphW;
      const y = graphBottom - (Math.min(pt.elongDeg, maxElongAxis) / maxElongAxis) * graphH;
      if (x < graphLeft || x > graphRight) continue;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = "rgba(218, 165, 32, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Color-code the area under the curve with eastern (orange tint) vs western (blue tint)
    // Draw dots at key transitions for clarity
    if (visiblePts.length > 1) {
      for (let i = 1; i < visiblePts.length; i++) {
        if (visiblePts[i].eastern !== visiblePts[i - 1].eastern) {
          const x = graphLeft + ((visiblePts[i].day - startDay) / windowDays) * graphW;
          const y = graphBottom - (Math.min(visiblePts[i].elongDeg, maxElongAxis) / maxElongAxis) * graphH;
          if (x >= graphLeft && x <= graphRight) {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
          }
        }
      }
    }

    // Current position marker
    if (visiblePts.length > 0) {
      const last = visiblePts[visiblePts.length - 1];
      const x = graphLeft + ((last.day - startDay) / windowDays) * graphW;
      const y = graphBottom - (Math.min(last.elongDeg, maxElongAxis) / maxElongAxis) * graphH;
      if (x >= graphLeft && x <= graphRight) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#daa520";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // -- Info panel --

  function renderInfoPanel(): void {
    const panelX = 10;
    const panelY = leftCy + EARTH_AU * orbitScale + 16;
    const lineH = 15;
    const fs = Math.max(10, Math.min(width, height) * 0.014);

    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Venus Orbital Data", panelX, panelY);

    ctx.font = `${fs}px system-ui, sans-serif`;
    ctx.fillStyle = "#94a3b8";

    const elongDeg = (getElongation() * 180) / Math.PI;
    const frac = getIlluminatedFraction();
    const dist = getEarthVenusDistance();
    const eastern = isEasternElongation();

    let row = 1;
    ctx.fillText(`Venus period: ${VENUS_PERIOD} days  |  Earth period: ${EARTH_PERIOD} days`, panelX, panelY + lineH * row);
    row++;
    ctx.fillText(`Synodic period: ${SYNODIC_PERIOD} days  |  Day: ${time.toFixed(0)}`, panelX, panelY + lineH * row);
    row++;
    ctx.fillStyle = "rgba(218, 180, 80, 0.8)";
    ctx.fillText(`Elongation: ${elongDeg.toFixed(1)}\u00B0 (${eastern ? "E / evening" : "W / morning"})`, panelX, panelY + lineH * row);
    row++;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Illuminated: ${(frac * 100).toFixed(1)}%  |  Distance: ${dist.toFixed(3)} AU`, panelX, panelY + lineH * row);
  }

  function renderHUD(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const days = time.toFixed(0);
    const synPct = ((time % SYNODIC_PERIOD) / SYNODIC_PERIOD * 100).toFixed(0);
    ctx.fillText(`Day ${days}  |  Synodic cycle: ${synPct}%`, width - 10, height - 6);
  }

  function render(): void {
    renderBackground();
    renderStars();

    // Left panel: orbital diagram
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, leftPanelW, stripY);
    ctx.clip();

    renderOrbits();
    renderSun();
    renderVenusTrail();
    renderSightLine();
    renderElongationArc();
    renderBodies();
    renderMorningEveningLabel();
    renderInfoPanel();

    ctx.restore();

    // Right panel: phase detail
    ctx.save();
    ctx.beginPath();
    ctx.rect(rightPanelX, 0, rightPanelW, stripY);
    ctx.clip();

    renderPhaseDetail();

    ctx.restore();

    // Bottom strip: elongation graph
    renderElongationStrip();

    // Dividers and labels
    renderDividers();

    // HUD
    renderHUD();
  }

  function reset(): void {
    time = 0;
    venusAngle = 0;
    earthAngle = 0;
    venusTrail = [];
    elongationHistory = [];
  }

  function destroy(): void {
    stars = [];
    venusTrail = [];
    elongationHistory = [];
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
      `Venus period: ${VENUS_PERIOD}d, Earth period: ${EARTH_PERIOD}d, Synodic: ${SYNODIC_PERIOD}d | ` +
      `Max elongation: ~${MAX_ELONGATION_DEG} deg | ` +
      `Speed: ${speed}x | Trail: ${trailLength}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
    generateStars();
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

export default ApparentMotionOfVenusFactory;
