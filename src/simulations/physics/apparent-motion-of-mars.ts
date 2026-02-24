import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ApparentMotionOfMarsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("apparent-motion-of-mars") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0; // simulation time in days

  // Starfield backgrounds
  let leftStars: Array<{ x: number; y: number; brightness: number; size: number }> = [];
  let rightStars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Orbital constants
  const EARTH_PERIOD = 365.25; // days
  const MARS_PERIOD = 687; // days
  const EARTH_AU = 1.0;
  const MARS_AU = 1.524;
  const EARTH_OMEGA = (2 * Math.PI) / EARTH_PERIOD; // rad/day
  const MARS_OMEGA = (2 * Math.PI) / MARS_PERIOD; // rad/day

  // Parameters
  let speed = 1;
  let showSightLines = 1;
  let trailLength = 200;
  let showLabels = 1;

  // Trail history
  let trailHistory: Array<{
    earthAngle: number;
    marsAngle: number;
    day: number;
    apparentAngle: number;
  }> = [];

  // Numbered markers
  let markers: Array<{
    earthAngle: number;
    marsAngle: number;
    day: number;
    apparentAngle: number;
    index: number;
  }> = [];
  let nextMarkerDay = 0;
  const MARKER_INTERVAL = 60; // days between markers

  // Layout
  let leftCX = 0;
  let leftCY = 0;
  let orbitScale = 0; // pixels per AU
  let rightPanelX = 0;
  let rightPanelW = 0;
  let rightPanelY = 0;
  let rightPanelH = 0;

  function computeLayout(): void {
    // Left: orbital diagram (55% of width)
    leftCX = width * 0.27;
    leftCY = height * 0.5;
    orbitScale = Math.min(width * 0.21, height * 0.36);

    // Right: celestial sphere strip (40% of width)
    rightPanelX = width * 0.58;
    rightPanelW = width * 0.38;
    rightPanelY = height * 0.08;
    rightPanelH = height * 0.84;
  }

  function generateStars(): void {
    leftStars = [];
    const leftCount = Math.floor((width * height) / 800);
    for (let i = 0; i < leftCount; i++) {
      leftStars.push({
        x: Math.random() * width * 0.56,
        y: Math.random() * height,
        brightness: 0.15 + Math.random() * 0.7,
        size: 0.3 + Math.random() * 1.1,
      });
    }

    rightStars = [];
    const rightCount = Math.floor((rightPanelW * rightPanelH) / 350);
    for (let i = 0; i < rightCount; i++) {
      rightStars.push({
        x: Math.random() * rightPanelW,
        y: Math.random() * rightPanelH,
        brightness: 0.1 + Math.random() * 0.45,
        size: 0.3 + Math.random() * 0.7,
      });
    }
  }

  function getEarthPos(angle: number): { x: number; y: number } {
    return {
      x: leftCX + EARTH_AU * orbitScale * Math.cos(angle),
      y: leftCY - EARTH_AU * orbitScale * Math.sin(angle),
    };
  }

  function getMarsPos(angle: number): { x: number; y: number } {
    return {
      x: leftCX + MARS_AU * orbitScale * Math.cos(angle),
      y: leftCY - MARS_AU * orbitScale * Math.sin(angle),
    };
  }

  /** Direction from Earth to Mars projected onto the celestial sphere */
  function getApparentAngle(earthAngle: number, marsAngle: number): number {
    const ex = EARTH_AU * Math.cos(earthAngle);
    const ey = EARTH_AU * Math.sin(earthAngle);
    const mx = MARS_AU * Math.cos(marsAngle);
    const my = MARS_AU * Math.sin(marsAngle);
    return Math.atan2(my - ey, mx - ex);
  }

  /** Map apparent angle to vertical position on right strip */
  function apparentAngleToStripY(angle: number): number {
    let normalized = angle % (2 * Math.PI);
    if (normalized > Math.PI) normalized -= 2 * Math.PI;
    if (normalized < -Math.PI) normalized += 2 * Math.PI;
    const fraction = (normalized + Math.PI) / (2 * Math.PI);
    return rightPanelY + rightPanelH * (1 - fraction);
  }

  /** Map day to horizontal position on right strip (scrolling) */
  function dayToStripX(day: number): number {
    const windowDays = trailLength * 2;
    const fraction = (day - (time - windowDays)) / windowDays;
    return rightPanelX + fraction * rightPanelW;
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    trailHistory = [];
    markers = [];
    nextMarkerDay = MARKER_INTERVAL;
    computeLayout();
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    speed = params.speed ?? 1;
    showSightLines = params.showSightLines ?? 1;
    trailLength = params.trailLength ?? 200;
    showLabels = params.showLabels ?? 1;

    // 1 second real time = ~30 days at speed 1
    const dtDays = dt * 30 * speed;
    time += dtDays;

    const earthAngle = EARTH_OMEGA * time;
    const marsAngle = MARS_OMEGA * time;
    const apparentAngle = getApparentAngle(earthAngle, marsAngle);

    // Record trail every ~0.5 sim days
    const lastDay =
      trailHistory.length > 0
        ? trailHistory[trailHistory.length - 1].day
        : -1;
    if (time - lastDay > 0.5) {
      trailHistory.push({ earthAngle, marsAngle, day: time, apparentAngle });
    }

    // Trim trail
    const maxTrailPts = trailLength * 4;
    if (trailHistory.length > maxTrailPts) {
      trailHistory = trailHistory.slice(trailHistory.length - maxTrailPts);
    }

    // Markers at regular intervals
    if (time >= nextMarkerDay) {
      const idx = markers.length + 1;
      markers.push({ earthAngle, marsAngle, day: time, apparentAngle, index: idx });
      nextMarkerDay += MARKER_INTERVAL;
      if (markers.length > 30) {
        markers = markers.slice(markers.length - 30);
      }
    }
  }

  // ── Render helpers ────────────────────────────────────────────

  function renderBackground(): void {
    const bgGrad = ctx.createRadialGradient(
      leftCX, leftCY, 0,
      leftCX, leftCY, width
    );
    bgGrad.addColorStop(0, "#0c0820");
    bgGrad.addColorStop(0.3, "#060412");
    bgGrad.addColorStop(1, "#010108");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function renderLeftStars(): void {
    for (const s of leftStars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 0.02 + s.x * 0.05 + s.y * 0.07);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness * twinkle})`;
      ctx.fill();
    }
  }

  function renderSun(): void {
    const sunR = Math.max(7, orbitScale * 0.055);

    // Corona
    for (let i = 4; i >= 0; i--) {
      const r = sunR * (1.5 + i * 0.8);
      const grad = ctx.createRadialGradient(leftCX, leftCY, sunR * 0.3, leftCX, leftCY, r);
      grad.addColorStop(0, `rgba(255, 255, 200, ${0.06 - i * 0.01})`);
      grad.addColorStop(0.5, `rgba(255, 220, 100, ${0.04 - i * 0.007})`);
      grad.addColorStop(1, "rgba(255, 150, 50, 0)");
      ctx.beginPath();
      ctx.arc(leftCX, leftCY, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Body
    const sunGrad = ctx.createRadialGradient(
      leftCX - sunR * 0.2, leftCY - sunR * 0.2, 0,
      leftCX, leftCY, sunR
    );
    sunGrad.addColorStop(0, "#ffffee");
    sunGrad.addColorStop(0.3, "#ffee44");
    sunGrad.addColorStop(0.7, "#ffcc00");
    sunGrad.addColorStop(1, "#ff9900");
    ctx.beginPath();
    ctx.arc(leftCX, leftCY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    if (showLabels >= 0.5) {
      ctx.fillStyle = "rgba(255, 240, 150, 0.7)";
      ctx.font = `${Math.max(10, Math.min(width, height) * 0.018)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Sun", leftCX, leftCY + sunR + 6);
    }
  }

  function renderOrbits(): void {
    // Earth orbit
    ctx.beginPath();
    ctx.arc(leftCX, leftCY, EARTH_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(68, 136, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mars orbit
    ctx.beginPath();
    ctx.arc(leftCX, leftCY, MARS_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 68, 34, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function renderPlanets(): void {
    const eAngle = EARTH_OMEGA * time;
    const mAngle = MARS_OMEGA * time;
    const ep = getEarthPos(eAngle);
    const mp = getMarsPos(mAngle);
    const eR = Math.max(4, orbitScale * 0.03);
    const mR = Math.max(3.5, orbitScale * 0.025);

    // Earth glow
    const eGlow = ctx.createRadialGradient(ep.x, ep.y, 0, ep.x, ep.y, eR * 4);
    eGlow.addColorStop(0, "rgba(68, 136, 255, 0.3)");
    eGlow.addColorStop(1, "rgba(68, 136, 255, 0)");
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, eR * 4, 0, Math.PI * 2);
    ctx.fillStyle = eGlow;
    ctx.fill();

    // Earth body
    const eGrad = ctx.createRadialGradient(
      ep.x - eR * 0.3, ep.y - eR * 0.3, 0,
      ep.x, ep.y, eR
    );
    eGrad.addColorStop(0, "#aaccff");
    eGrad.addColorStop(0.4, "#4488ff");
    eGrad.addColorStop(1, "#2244aa");
    ctx.beginPath();
    ctx.arc(ep.x, ep.y, eR, 0, Math.PI * 2);
    ctx.fillStyle = eGrad;
    ctx.fill();

    // Mars glow
    const mGlow = ctx.createRadialGradient(mp.x, mp.y, 0, mp.x, mp.y, mR * 4);
    mGlow.addColorStop(0, "rgba(255, 68, 34, 0.3)");
    mGlow.addColorStop(1, "rgba(255, 68, 34, 0)");
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, mR * 4, 0, Math.PI * 2);
    ctx.fillStyle = mGlow;
    ctx.fill();

    // Mars body
    const mGrad = ctx.createRadialGradient(
      mp.x - mR * 0.3, mp.y - mR * 0.3, 0,
      mp.x, mp.y, mR
    );
    mGrad.addColorStop(0, "#ffaa88");
    mGrad.addColorStop(0.4, "#ff4422");
    mGrad.addColorStop(1, "#aa2211");
    ctx.beginPath();
    ctx.arc(mp.x, mp.y, mR, 0, Math.PI * 2);
    ctx.fillStyle = mGrad;
    ctx.fill();

    if (showLabels >= 0.5) {
      const font = `${Math.max(10, Math.min(width, height) * 0.018)}px system-ui, sans-serif`;
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      ctx.fillStyle = "rgba(100, 170, 255, 0.8)";
      ctx.fillText("Earth", ep.x, ep.y - eR - 5);

      ctx.fillStyle = "rgba(255, 100, 80, 0.8)";
      ctx.fillText("Mars", mp.x, mp.y - mR - 5);
    }
  }

  function renderOrbitalTrails(): void {
    if (trailHistory.length < 2) return;
    const startIdx = Math.max(0, trailHistory.length - trailLength);

    // Earth trail
    ctx.beginPath();
    let started = false;
    for (let i = startIdx; i < trailHistory.length; i++) {
      const pos = getEarthPos(trailHistory[i].earthAngle);
      if (!started) {
        ctx.moveTo(pos.x, pos.y);
        started = true;
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.strokeStyle = "rgba(68, 136, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mars trail
    ctx.beginPath();
    started = false;
    for (let i = startIdx; i < trailHistory.length; i++) {
      const pos = getMarsPos(trailHistory[i].marsAngle);
      if (!started) {
        ctx.moveTo(pos.x, pos.y);
        started = true;
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.strokeStyle = "rgba(255, 68, 34, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function renderSightLines(): void {
    if (showSightLines < 0.5) return;

    const eAngle = EARTH_OMEGA * time;
    const mAngle = MARS_OMEGA * time;
    const ep = getEarthPos(eAngle);
    const mp = getMarsPos(mAngle);

    // Current sight line extending beyond Mars
    const dx = mp.x - ep.x;
    const dy = mp.y - ep.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    const ext = orbitScale * 2.5;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ep.x, ep.y);
    ctx.lineTo(ep.x + nx * ext, ep.y + ny * ext);
    ctx.strokeStyle = "rgba(255, 255, 100, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Past marker sight lines
    const visibleMarkers = markers.filter((m) => m.day > time - trailLength * 2);
    for (const marker of visibleMarkers) {
      const eP = getEarthPos(marker.earthAngle);
      const mP = getMarsPos(marker.marsAngle);

      ctx.save();
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(eP.x, eP.y);
      ctx.lineTo(mP.x, mP.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderMarkers(): void {
    const markerR = Math.max(2, orbitScale * 0.012);
    const fontSize = Math.max(8, Math.min(width, height) * 0.014);
    const visibleMarkers = markers.filter((m) => m.day > time - trailLength * 2);

    for (const marker of visibleMarkers) {
      const eP = getEarthPos(marker.earthAngle);
      ctx.beginPath();
      ctx.arc(eP.x, eP.y, markerR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(68, 136, 255, 0.6)";
      ctx.fill();

      const mP = getMarsPos(marker.marsAngle);
      ctx.beginPath();
      ctx.arc(mP.x, mP.y, markerR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 68, 34, 0.6)";
      ctx.fill();

      if (showLabels >= 0.5) {
        ctx.font = `${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(68, 136, 255, 0.7)";
        ctx.fillText(`${marker.index}`, eP.x + markerR + 6, eP.y - markerR - 3);
        ctx.fillStyle = "rgba(255, 68, 34, 0.7)";
        ctx.fillText(`${marker.index}`, mP.x + markerR + 6, mP.y - markerR - 3);
      }
    }
  }

  function renderCelestialArc(): void {
    const arcR = MARS_AU * orbitScale * 1.6;
    ctx.beginPath();
    ctx.arc(leftCX, leftCY, arcR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (showLabels >= 0.5) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.font = `${Math.max(8, Math.min(width, height) * 0.012)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("distant stars", leftCX, leftCY - arcR - 4);
    }
  }

  function renderDivider(): void {
    const divX = width * 0.56;
    const grad = ctx.createLinearGradient(divX, height * 0.1, divX, height * 0.9);
    grad.addColorStop(0, "rgba(255, 255, 255, 0)");
    grad.addColorStop(0.2, "rgba(255, 255, 255, 0.08)");
    grad.addColorStop(0.5, "rgba(255, 255, 255, 0.12)");
    grad.addColorStop(0.8, "rgba(255, 255, 255, 0.08)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.beginPath();
    ctx.moveTo(divX, height * 0.1);
    ctx.lineTo(divX, height * 0.9);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function renderSkyStrip(): void {
    // Background
    const stripGrad = ctx.createLinearGradient(
      rightPanelX, rightPanelY,
      rightPanelX, rightPanelY + rightPanelH
    );
    stripGrad.addColorStop(0, "rgba(5, 5, 25, 0.9)");
    stripGrad.addColorStop(0.5, "rgba(8, 8, 35, 0.9)");
    stripGrad.addColorStop(1, "rgba(5, 5, 25, 0.9)");
    ctx.fillStyle = stripGrad;
    ctx.fillRect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);

    // Clip to strip
    ctx.save();
    ctx.beginPath();
    ctx.rect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);
    ctx.clip();

    // Background stars
    for (const s of rightStars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 0.015 + s.x * 0.1 + s.y * 0.08);
      ctx.beginPath();
      ctx.arc(rightPanelX + s.x, rightPanelY + s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness * twinkle})`;
      ctx.fill();
    }

    // Title
    if (showLabels >= 0.5) {
      const titleFont = `bold ${Math.max(11, Math.min(width, height) * 0.02)}px system-ui, sans-serif`;
      ctx.font = titleFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText(
        "Apparent Path on Sky",
        rightPanelX + rightPanelW / 2,
        rightPanelY - 6
      );
    }

    // Draw apparent path with retrograde color coding
    if (trailHistory.length > 2) {
      const startIdx = Math.max(0, trailHistory.length - trailLength);
      const windowDays = trailLength * 2;
      const windowStart = time - windowDays;

      for (let i = startIdx + 1; i < trailHistory.length; i++) {
        const prev = trailHistory[i - 1];
        const curr = trailHistory[i];
        if (curr.day < windowStart) continue;

        const prevX = dayToStripX(prev.day);
        const currX = dayToStripX(curr.day);
        const prevY = apparentAngleToStripY(prev.apparentAngle);
        const currY = apparentAngleToStripY(curr.apparentAngle);

        if (currX < rightPanelX || currX > rightPanelX + rightPanelW) continue;

        // Detect retrograde
        let angleDiff = curr.apparentAngle - prev.apparentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        const isRetrograde = angleDiff < 0;

        const age = (time - curr.day) / windowDays;
        const alpha = Math.max(0.1, 1 - age * 0.8);

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(currX, currY);

        if (isRetrograde) {
          ctx.strokeStyle = `rgba(0, 220, 255, ${alpha * 0.9})`;
          ctx.lineWidth = 2.5;
        } else {
          ctx.strokeStyle = `rgba(255, 200, 80, ${alpha * 0.7})`;
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
      }

      // Current Mars position on strip
      if (trailHistory.length > 0) {
        const latest = trailHistory[trailHistory.length - 1];
        const sx = dayToStripX(latest.day);
        const sy = apparentAngleToStripY(latest.apparentAngle);

        if (sx >= rightPanelX && sx <= rightPanelX + rightPanelW) {
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 10);
          glow.addColorStop(0, "rgba(255, 80, 50, 0.6)");
          glow.addColorStop(1, "rgba(255, 80, 50, 0)");
          ctx.beginPath();
          ctx.arc(sx, sy, 10, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ff4422";
          ctx.fill();
        }
      }

      // Markers on strip
      const visibleMarkers = markers.filter((m) => m.day > time - trailLength * 2);
      const mFont = `${Math.max(7, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
      for (const marker of visibleMarkers) {
        const sx = dayToStripX(marker.day);
        const sy = apparentAngleToStripY(marker.apparentAngle);
        if (sx < rightPanelX || sx > rightPanelX + rightPanelW) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
        ctx.fill();

        if (showLabels >= 0.5) {
          ctx.font = mFont;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fillText(`${marker.index}`, sx + 5, sy);
        }
      }
    }

    // Legend
    const legendFont = `${Math.max(9, Math.min(width, height) * 0.015)}px system-ui, sans-serif`;
    ctx.font = legendFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = "rgba(255, 200, 80, 0.7)";
    ctx.fillRect(rightPanelX + 8, rightPanelY + rightPanelH - 36, 12, 3);
    ctx.fillText("Prograde", rightPanelX + 24, rightPanelY + rightPanelH - 40);

    ctx.fillStyle = "rgba(0, 220, 255, 0.9)";
    ctx.fillRect(rightPanelX + 8, rightPanelY + rightPanelH - 18, 12, 3);
    ctx.fillText("Retrograde", rightPanelX + 24, rightPanelY + rightPanelH - 22);

    ctx.restore();
  }

  function renderRetrogradeStatus(): void {
    if (trailHistory.length < 4) return;

    const r1 = trailHistory[trailHistory.length - 1];
    const r2 = trailHistory[trailHistory.length - 3];
    let diff = r1.apparentAngle - r2.apparentAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const isRetrograde = diff < 0;

    const font = `bold ${Math.max(12, Math.min(width, height) * 0.022)}px system-ui, sans-serif`;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (isRetrograde) {
      ctx.fillStyle = "rgba(0, 220, 255, 0.8)";
      ctx.fillText("RETROGRADE", leftCX, 14);
    } else {
      ctx.fillStyle = "rgba(255, 200, 80, 0.5)";
      ctx.fillText("PROGRADE", leftCX, 14);
    }
  }

  function renderLeftTitle(): void {
    if (showLabels < 0.5) return;
    const font = `bold ${Math.max(11, Math.min(width, height) * 0.02)}px system-ui, sans-serif`;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("Top-Down Orbital View", leftCX, leftCY - MARS_AU * orbitScale - 20);
  }

  function renderHUD(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    const days = time.toFixed(0);
    const years = (time / EARTH_PERIOD).toFixed(2);
    const earthDeg = (((EARTH_OMEGA * time) % (2 * Math.PI)) * 180 / Math.PI).toFixed(1);
    const marsDeg = (((MARS_OMEGA * time) % (2 * Math.PI)) * 180 / Math.PI).toFixed(1);

    ctx.fillText(`Day ${days} (${years} Earth years)`, 10, height - 26);
    ctx.fillText(
      `Earth: ${earthDeg}\u00B0  Mars: ${marsDeg}\u00B0  |  Earth period: ${EARTH_PERIOD} d  Mars period: ${MARS_PERIOD} d`,
      10,
      height - 10
    );
  }

  function render(): void {
    renderBackground();
    renderLeftStars();
    renderCelestialArc();
    renderOrbits();
    renderOrbitalTrails();
    renderSightLines();
    renderMarkers();
    renderSun();
    renderPlanets();
    renderLeftTitle();
    renderRetrogradeStatus();
    renderDivider();
    renderSkyStrip();
    renderHUD();
  }

  function reset(): void {
    time = 0;
    trailHistory = [];
    markers = [];
    nextMarkerDay = MARKER_INTERVAL;
  }

  function destroy(): void {
    leftStars = [];
    rightStars = [];
    trailHistory = [];
    markers = [];
  }

  function getStateDescription(): string {
    const earthAngle = EARTH_OMEGA * time;
    const marsAngle = MARS_OMEGA * time;
    const apparentAngle = getApparentAngle(earthAngle, marsAngle);
    const apparentDeg = ((apparentAngle * 180) / Math.PI).toFixed(1);
    const earthDeg = (((earthAngle % (2 * Math.PI)) * 180) / Math.PI).toFixed(1);
    const marsDeg = (((marsAngle % (2 * Math.PI)) * 180) / Math.PI).toFixed(1);

    let retrogradeStatus = "prograde";
    if (trailHistory.length >= 4) {
      const r1 = trailHistory[trailHistory.length - 1];
      const r2 = trailHistory[trailHistory.length - 3];
      let diff = r1.apparentAngle - r2.apparentAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (diff < 0) retrogradeStatus = "RETROGRADE";
    }

    let separation = marsAngle - earthAngle;
    while (separation > Math.PI) separation -= 2 * Math.PI;
    while (separation < -Math.PI) separation += 2 * Math.PI;
    const nearOpposition = Math.abs(Math.abs(separation) - Math.PI) < 0.3;

    return (
      `Apparent Motion of Mars | Day: ${time.toFixed(0)} (${(time / EARTH_PERIOD).toFixed(2)} Earth years) | ` +
      `Earth at 1 AU (period ${EARTH_PERIOD} d), Mars at ${MARS_AU} AU (period ${MARS_PERIOD} d) | ` +
      `Earth angle: ${earthDeg} deg | Mars angle: ${marsDeg} deg | ` +
      `Apparent direction: ${apparentDeg} deg | ` +
      `Motion: ${retrogradeStatus}${nearOpposition ? " (near opposition)" : ""} | ` +
      `Retrograde occurs when Earth overtakes Mars near opposition. ` +
      `Speed: ${speed}x | Sight lines: ${showSightLines >= 0.5 ? "on" : "off"} | ` +
      `Trail: ${trailLength} | Labels: ${showLabels >= 0.5 ? "on" : "off"}`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeLayout();
    generateStars();
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

export default ApparentMotionOfMarsFactory;
