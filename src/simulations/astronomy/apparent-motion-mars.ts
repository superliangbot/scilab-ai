import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ApparentMotionMarsFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("apparent-motion-mars") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0; // time in days

  // Starfield
  let stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];
  // Background stars for the sky strip (right side)
  let skyStars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Orbital constants
  const EARTH_PERIOD = 365.25; // days
  const MARS_PERIOD = 687; // days
  const EARTH_RADIUS_AU = 1.0;
  const MARS_RADIUS_AU = 1.524;
  const EARTH_ANGULAR_VELOCITY = (2 * Math.PI) / EARTH_PERIOD; // rad/day
  const MARS_ANGULAR_VELOCITY = (2 * Math.PI) / MARS_PERIOD; // rad/day

  // Parameters
  let speed = 1;
  let showSightLines = 1;
  let trailLength = 200;
  let showLabels = 1;

  // Trail history: stores {earthAngle, marsAngle, day} for positions
  let trailHistory: Array<{
    earthAngle: number;
    marsAngle: number;
    day: number;
    apparentAngle: number;
  }> = [];

  // Numbered marker positions (sampled at regular intervals)
  let markers: Array<{
    earthAngle: number;
    marsAngle: number;
    day: number;
    apparentAngle: number;
    index: number;
  }> = [];
  let nextMarkerDay = 0;
  const MARKER_INTERVAL = 60; // days between numbered markers

  // Layout constants
  let leftCenterX = 0;
  let leftCenterY = 0;
  let orbitScale = 0; // pixels per AU
  let rightX = 0; // left edge of sky strip
  let rightWidth = 0;
  let rightY = 0;
  let rightHeight = 0;

  function computeLayout(): void {
    // Left side: orbital diagram (55% of width)
    leftCenterX = width * 0.28;
    leftCenterY = height * 0.5;
    orbitScale = Math.min(width * 0.22, height * 0.38);

    // Right side: sky strip (40% of width)
    rightX = width * 0.58;
    rightWidth = width * 0.38;
    rightY = height * 0.08;
    rightHeight = height * 0.84;
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
    // Sky strip background stars
    skyStars = [];
    const skyCount = Math.floor((rightWidth * rightHeight) / 300);
    for (let i = 0; i < skyCount; i++) {
      skyStars.push({
        x: Math.random() * rightWidth,
        y: Math.random() * rightHeight,
        brightness: 0.15 + Math.random() * 0.5,
        size: 0.3 + Math.random() * 0.8,
      });
    }
  }

  function getEarthPos(angle: number): { x: number; y: number } {
    return {
      x: leftCenterX + EARTH_RADIUS_AU * orbitScale * Math.cos(angle),
      y: leftCenterY - EARTH_RADIUS_AU * orbitScale * Math.sin(angle),
    };
  }

  function getMarsPos(angle: number): { x: number; y: number } {
    return {
      x: leftCenterX + MARS_RADIUS_AU * orbitScale * Math.cos(angle),
      y: leftCenterY - MARS_RADIUS_AU * orbitScale * Math.sin(angle),
    };
  }

  /** Calculate apparent angle of Mars as seen from Earth (projected onto sky). */
  function getApparentAngle(earthAngle: number, marsAngle: number): number {
    const ex = EARTH_RADIUS_AU * Math.cos(earthAngle);
    const ey = EARTH_RADIUS_AU * Math.sin(earthAngle);
    const mx = MARS_RADIUS_AU * Math.cos(marsAngle);
    const my = MARS_RADIUS_AU * Math.sin(marsAngle);
    return Math.atan2(my - ey, mx - ex);
  }

  /** Map apparent angle to a vertical position on the sky strip. */
  function apparentAngleToSkyY(angle: number): number {
    // Normalize angle to a range that keeps the path visible
    // We map [-PI, PI] to the strip height
    let normalized = angle % (2 * Math.PI);
    if (normalized > Math.PI) normalized -= 2 * Math.PI;
    if (normalized < -Math.PI) normalized += 2 * Math.PI;
    // Map to strip: -PI at bottom, PI at top
    const fraction = (normalized + Math.PI) / (2 * Math.PI);
    return rightY + rightHeight * (1 - fraction);
  }

  /** Map time to a horizontal position on the sky strip (scrolling). */
  function dayToSkyX(day: number): number {
    // The strip shows the most recent 'trailLength * 2' days of motion
    const windowDays = trailLength * 2;
    const fraction = (day - (time - windowDays)) / windowDays;
    return rightX + fraction * rightWidth;
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

    // dt is in seconds; convert to simulation days
    // At speed 1, 1 second = ~30 days of simulation time
    const dtDays = dt * 30 * speed;
    time += dtDays;

    const earthAngle = EARTH_ANGULAR_VELOCITY * time;
    const marsAngle = MARS_ANGULAR_VELOCITY * time;
    const apparentAngle = getApparentAngle(earthAngle, marsAngle);

    // Record trail point every ~0.5 days
    const lastDay = trailHistory.length > 0 ? trailHistory[trailHistory.length - 1].day : -1;
    if (time - lastDay > 0.5) {
      trailHistory.push({ earthAngle, marsAngle, day: time, apparentAngle });
    }

    // Trim trail to keep reasonable length
    const maxTrailPoints = trailLength * 4;
    if (trailHistory.length > maxTrailPoints) {
      trailHistory = trailHistory.slice(trailHistory.length - maxTrailPoints);
    }

    // Add numbered markers at regular intervals
    if (time >= nextMarkerDay) {
      const idx = markers.length + 1;
      markers.push({
        earthAngle,
        marsAngle,
        day: time,
        apparentAngle,
        index: idx,
      });
      nextMarkerDay += MARKER_INTERVAL;

      // Keep at most ~30 markers
      if (markers.length > 30) {
        markers = markers.slice(markers.length - 30);
      }
    }
  }

  function renderBackground(): void {
    const bgGrad = ctx.createRadialGradient(
      leftCenterX, leftCenterY, 0,
      leftCenterX, leftCenterY, width
    );
    bgGrad.addColorStop(0, "#0c0820");
    bgGrad.addColorStop(0.3, "#060412");
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

  function renderSun(): void {
    const sunRadius = Math.max(8, orbitScale * 0.06);

    // Corona glow
    for (let i = 4; i >= 0; i--) {
      const r = sunRadius * (1.5 + i * 0.8);
      const grad = ctx.createRadialGradient(
        leftCenterX, leftCenterY, sunRadius * 0.3,
        leftCenterX, leftCenterY, r
      );
      grad.addColorStop(0, `rgba(255, 255, 200, ${0.06 - i * 0.01})`);
      grad.addColorStop(0.5, `rgba(255, 220, 100, ${0.04 - i * 0.007})`);
      grad.addColorStop(1, "rgba(255, 150, 50, 0)");
      ctx.beginPath();
      ctx.arc(leftCenterX, leftCenterY, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Sun body
    const sunGrad = ctx.createRadialGradient(
      leftCenterX - sunRadius * 0.2, leftCenterY - sunRadius * 0.2, 0,
      leftCenterX, leftCenterY, sunRadius
    );
    sunGrad.addColorStop(0, "#ffffee");
    sunGrad.addColorStop(0.3, "#ffee44");
    sunGrad.addColorStop(0.7, "#ffcc00");
    sunGrad.addColorStop(1, "#ff9900");
    ctx.beginPath();
    ctx.arc(leftCenterX, leftCenterY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    if (showLabels >= 0.5) {
      ctx.fillStyle = "rgba(255, 240, 150, 0.7)";
      ctx.font = `${Math.max(10, Math.min(width, height) * 0.018)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("Sun", leftCenterX, leftCenterY + sunRadius + 6);
    }
  }

  function renderOrbits(): void {
    // Earth orbit
    ctx.beginPath();
    ctx.arc(leftCenterX, leftCenterY, EARTH_RADIUS_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(68, 136, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mars orbit
    ctx.beginPath();
    ctx.arc(leftCenterX, leftCenterY, MARS_RADIUS_AU * orbitScale, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 68, 34, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function renderPlanets(): void {
    const earthAngle = EARTH_ANGULAR_VELOCITY * time;
    const marsAngle = MARS_ANGULAR_VELOCITY * time;
    const earthPos = getEarthPos(earthAngle);
    const marsPos = getMarsPos(marsAngle);
    const earthR = Math.max(4, orbitScale * 0.03);
    const marsR = Math.max(3.5, orbitScale * 0.025);

    // Earth glow
    const earthGlow = ctx.createRadialGradient(earthPos.x, earthPos.y, 0, earthPos.x, earthPos.y, earthR * 4);
    earthGlow.addColorStop(0, "rgba(68, 136, 255, 0.3)");
    earthGlow.addColorStop(1, "rgba(68, 136, 255, 0)");
    ctx.beginPath();
    ctx.arc(earthPos.x, earthPos.y, earthR * 4, 0, Math.PI * 2);
    ctx.fillStyle = earthGlow;
    ctx.fill();

    // Earth body
    const earthGrad = ctx.createRadialGradient(
      earthPos.x - earthR * 0.3, earthPos.y - earthR * 0.3, 0,
      earthPos.x, earthPos.y, earthR
    );
    earthGrad.addColorStop(0, "#aaccff");
    earthGrad.addColorStop(0.4, "#4488ff");
    earthGrad.addColorStop(1, "#2244aa");
    ctx.beginPath();
    ctx.arc(earthPos.x, earthPos.y, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Mars glow
    const marsGlow = ctx.createRadialGradient(marsPos.x, marsPos.y, 0, marsPos.x, marsPos.y, marsR * 4);
    marsGlow.addColorStop(0, "rgba(255, 68, 34, 0.3)");
    marsGlow.addColorStop(1, "rgba(255, 68, 34, 0)");
    ctx.beginPath();
    ctx.arc(marsPos.x, marsPos.y, marsR * 4, 0, Math.PI * 2);
    ctx.fillStyle = marsGlow;
    ctx.fill();

    // Mars body
    const marsGrad = ctx.createRadialGradient(
      marsPos.x - marsR * 0.3, marsPos.y - marsR * 0.3, 0,
      marsPos.x, marsPos.y, marsR
    );
    marsGrad.addColorStop(0, "#ffaa88");
    marsGrad.addColorStop(0.4, "#ff4422");
    marsGrad.addColorStop(1, "#aa2211");
    ctx.beginPath();
    ctx.arc(marsPos.x, marsPos.y, marsR, 0, Math.PI * 2);
    ctx.fillStyle = marsGrad;
    ctx.fill();

    if (showLabels >= 0.5) {
      const labelFont = `${Math.max(10, Math.min(width, height) * 0.018)}px system-ui, sans-serif`;
      ctx.font = labelFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      ctx.fillStyle = "rgba(100, 170, 255, 0.8)";
      ctx.fillText("Earth", earthPos.x, earthPos.y - earthR - 5);

      ctx.fillStyle = "rgba(255, 100, 80, 0.8)";
      ctx.fillText("Mars", marsPos.x, marsPos.y - marsR - 5);
    }
  }

  function renderOrbitalTrail(): void {
    if (trailHistory.length < 2) return;

    // Draw Earth trail (recent positions on orbit)
    ctx.beginPath();
    let started = false;
    for (let i = Math.max(0, trailHistory.length - trailLength); i < trailHistory.length; i++) {
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

    // Draw Mars trail
    ctx.beginPath();
    started = false;
    for (let i = Math.max(0, trailHistory.length - trailLength); i < trailHistory.length; i++) {
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

    const earthAngle = EARTH_ANGULAR_VELOCITY * time;
    const marsAngle = MARS_ANGULAR_VELOCITY * time;
    const earthPos = getEarthPos(earthAngle);
    const marsPos = getMarsPos(marsAngle);

    // Draw current sight line from Earth through Mars, extended to the "star field arc"
    const dx = marsPos.x - earthPos.x;
    const dy = marsPos.y - earthPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    const extensionLength = orbitScale * 2.5;

    // Dashed sight line
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(earthPos.x, earthPos.y);
    ctx.lineTo(earthPos.x + nx * extensionLength, earthPos.y + ny * extensionLength);
    ctx.strokeStyle = "rgba(255, 255, 100, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Draw sight lines for markers
    const visibleMarkers = markers.filter(m => m.day > time - trailLength * 2);
    for (const marker of visibleMarkers) {
      const ePos = getEarthPos(marker.earthAngle);
      const mPos = getMarsPos(marker.marsAngle);

      ctx.save();
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(ePos.x, ePos.y);
      ctx.lineTo(mPos.x, mPos.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  function renderMarkers(): void {
    const markerR = Math.max(2, orbitScale * 0.012);
    const fontSize = Math.max(8, Math.min(width, height) * 0.014);
    const visibleMarkers = markers.filter(m => m.day > time - trailLength * 2);

    for (const marker of visibleMarkers) {
      // Marker on Earth orbit
      const ePos = getEarthPos(marker.earthAngle);
      ctx.beginPath();
      ctx.arc(ePos.x, ePos.y, markerR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(68, 136, 255, 0.6)";
      ctx.fill();

      // Marker on Mars orbit
      const mPos = getMarsPos(marker.marsAngle);
      ctx.beginPath();
      ctx.arc(mPos.x, mPos.y, markerR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 68, 34, 0.6)";
      ctx.fill();

      // Marker number labels
      if (showLabels >= 0.5) {
        ctx.font = `${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(68, 136, 255, 0.7)";
        ctx.fillText(`${marker.index}`, ePos.x + markerR + 6, ePos.y - markerR - 3);
        ctx.fillStyle = "rgba(255, 68, 34, 0.7)";
        ctx.fillText(`${marker.index}`, mPos.x + markerR + 6, mPos.y - markerR - 3);
      }
    }
  }

  function renderSkyStrip(): void {
    // Background for the sky strip
    const stripGrad = ctx.createLinearGradient(rightX, rightY, rightX, rightY + rightHeight);
    stripGrad.addColorStop(0, "rgba(5, 5, 25, 0.9)");
    stripGrad.addColorStop(0.5, "rgba(8, 8, 35, 0.9)");
    stripGrad.addColorStop(1, "rgba(5, 5, 25, 0.9)");
    ctx.fillStyle = stripGrad;
    ctx.fillRect(rightX, rightY, rightWidth, rightHeight);

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rightX, rightY, rightWidth, rightHeight);

    // Sky strip stars
    ctx.save();
    ctx.beginPath();
    ctx.rect(rightX, rightY, rightWidth, rightHeight);
    ctx.clip();

    for (const star of skyStars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 0.015 + star.x * 0.1 + star.y * 0.08);
      const alpha = star.brightness * twinkle;
      ctx.beginPath();
      ctx.arc(rightX + star.x, rightY + star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }

    // Title for sky strip
    if (showLabels >= 0.5) {
      const titleFont = `bold ${Math.max(11, Math.min(width, height) * 0.02)}px system-ui, sans-serif`;
      ctx.font = titleFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText("Apparent Path on Sky", rightX + rightWidth / 2, rightY - 6);
    }

    // Draw the apparent path of Mars
    if (trailHistory.length > 2) {
      const startIdx = Math.max(0, trailHistory.length - trailLength);
      const windowDays = trailLength * 2;
      const windowStart = time - windowDays;

      // Detect retrograde segments by checking if apparent angle is decreasing
      // Draw trail with color coding: prograde = gold, retrograde = cyan
      for (let i = startIdx + 1; i < trailHistory.length; i++) {
        const prev = trailHistory[i - 1];
        const curr = trailHistory[i];

        // Skip points outside the visible time window
        if (curr.day < windowStart) continue;

        const prevX = dayToSkyX(prev.day);
        const currX = dayToSkyX(curr.day);
        const prevSkyY = apparentAngleToSkyY(prev.apparentAngle);
        const currSkyY = apparentAngleToSkyY(curr.apparentAngle);

        // Check if within strip bounds
        if (currX < rightX || currX > rightX + rightWidth) continue;

        // Determine if this segment is retrograde
        // Retrograde: apparent angular velocity reverses direction
        let angleDiff = curr.apparentAngle - prev.apparentAngle;
        // Normalize angle diff to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        // Earth moves faster, so normally Mars drifts eastward (positive angle change)
        // During retrograde, Mars appears to drift westward (negative angle change)
        const isRetrograde = angleDiff < 0;

        // Age-based alpha for fading
        const age = (time - curr.day) / windowDays;
        const alpha = Math.max(0.1, 1 - age * 0.8);

        ctx.beginPath();
        ctx.moveTo(prevX, prevSkyY);
        ctx.lineTo(currX, currSkyY);

        if (isRetrograde) {
          ctx.strokeStyle = `rgba(0, 220, 255, ${alpha * 0.9})`;
          ctx.lineWidth = 2.5;
        } else {
          ctx.strokeStyle = `rgba(255, 200, 80, ${alpha * 0.7})`;
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
      }

      // Draw current Mars position on sky strip
      if (trailHistory.length > 0) {
        const latest = trailHistory[trailHistory.length - 1];
        const skyX = dayToSkyX(latest.day);
        const skyY = apparentAngleToSkyY(latest.apparentAngle);

        if (skyX >= rightX && skyX <= rightX + rightWidth) {
          // Mars glow on sky
          const marsGlow = ctx.createRadialGradient(skyX, skyY, 0, skyX, skyY, 10);
          marsGlow.addColorStop(0, "rgba(255, 80, 50, 0.6)");
          marsGlow.addColorStop(1, "rgba(255, 80, 50, 0)");
          ctx.beginPath();
          ctx.arc(skyX, skyY, 10, 0, Math.PI * 2);
          ctx.fillStyle = marsGlow;
          ctx.fill();

          // Mars dot
          ctx.beginPath();
          ctx.arc(skyX, skyY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ff4422";
          ctx.fill();
        }
      }

      // Draw numbered markers on the sky strip
      const visibleMarkers = markers.filter(m => m.day > time - trailLength * 2);
      const markerFont = `${Math.max(7, Math.min(width, height) * 0.013)}px system-ui, sans-serif`;
      for (const marker of visibleMarkers) {
        const skyX = dayToSkyX(marker.day);
        const skyY = apparentAngleToSkyY(marker.apparentAngle);

        if (skyX < rightX || skyX > rightX + rightWidth) continue;

        // Small dot
        ctx.beginPath();
        ctx.arc(skyX, skyY, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 200, 100, 0.7)";
        ctx.fill();

        // Number
        if (showLabels >= 0.5) {
          ctx.font = markerFont;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fillText(`${marker.index}`, skyX + 5, skyY);
        }
      }
    }

    // Legend within the sky strip
    const legendFont = `${Math.max(9, Math.min(width, height) * 0.015)}px system-ui, sans-serif`;
    ctx.font = legendFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Prograde legend
    ctx.fillStyle = "rgba(255, 200, 80, 0.7)";
    ctx.fillRect(rightX + 8, rightY + rightHeight - 36, 12, 3);
    ctx.fillText("Prograde", rightX + 24, rightY + rightHeight - 40);

    // Retrograde legend
    ctx.fillStyle = "rgba(0, 220, 255, 0.9)";
    ctx.fillRect(rightX + 8, rightY + rightHeight - 18, 12, 3);
    ctx.fillText("Retrograde", rightX + 24, rightY + rightHeight - 22);

    ctx.restore();
  }

  function renderDivider(): void {
    // Subtle vertical divider between left and right
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

  function renderTitle(): void {
    if (showLabels < 0.5) return;

    const titleFont = `bold ${Math.max(11, Math.min(width, height) * 0.02)}px system-ui, sans-serif`;
    ctx.font = titleFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("Top-Down Orbital View", leftCenterX, leftCenterY - MARS_RADIUS_AU * orbitScale - 20);
  }

  function renderRetrogradeInfo(): void {
    // Detect if currently in retrograde
    if (trailHistory.length < 4) return;

    const recent1 = trailHistory[trailHistory.length - 1];
    const recent2 = trailHistory[trailHistory.length - 3];

    let angleDiff = recent1.apparentAngle - recent2.apparentAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const isRetrograde = angleDiff < 0;

    // Status indicator
    const statusFont = `bold ${Math.max(12, Math.min(width, height) * 0.022)}px system-ui, sans-serif`;
    ctx.font = statusFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (isRetrograde) {
      ctx.fillStyle = "rgba(0, 220, 255, 0.8)";
      ctx.fillText("RETROGRADE", leftCenterX, 14);
    } else {
      ctx.fillStyle = "rgba(255, 200, 80, 0.5)";
      ctx.fillText("PROGRADE", leftCenterX, 14);
    }
  }

  function renderHUD(): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    const days = time.toFixed(0);
    const years = (time / EARTH_PERIOD).toFixed(2);
    const earthDeg = (((EARTH_ANGULAR_VELOCITY * time) % (2 * Math.PI)) * 180 / Math.PI).toFixed(1);
    const marsDeg = (((MARS_ANGULAR_VELOCITY * time) % (2 * Math.PI)) * 180 / Math.PI).toFixed(1);

    ctx.fillText(`Day ${days} (${years} Earth years)`, 10, height - 26);
    ctx.fillText(`Earth: ${earthDeg}deg  Mars: ${marsDeg}deg`, 10, height - 10);
  }

  function renderStarFieldArc(): void {
    // Draw a distant arc representing the celestial sphere / star field
    // This is the "projection screen" that sight lines project onto
    const arcRadius = MARS_RADIUS_AU * orbitScale * 1.6;
    ctx.beginPath();
    ctx.arc(leftCenterX, leftCenterY, arcRadius, 0, Math.PI * 2);
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
      ctx.fillText("distant stars", leftCenterX, leftCenterY - arcRadius - 4);
    }
  }

  function render(): void {
    renderBackground();
    renderStars();
    renderStarFieldArc();
    renderOrbits();
    renderOrbitalTrail();
    renderSightLines();
    renderMarkers();
    renderSun();
    renderPlanets();
    renderTitle();
    renderRetrogradeInfo();
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
    stars = [];
    skyStars = [];
    trailHistory = [];
    markers = [];
  }

  function getStateDescription(): string {
    const earthAngle = EARTH_ANGULAR_VELOCITY * time;
    const marsAngle = MARS_ANGULAR_VELOCITY * time;
    const apparentAngle = getApparentAngle(earthAngle, marsAngle);
    const apparentDeg = ((apparentAngle * 180) / Math.PI).toFixed(1);
    const earthDeg = (((earthAngle % (2 * Math.PI)) * 180) / Math.PI).toFixed(1);
    const marsDeg = (((marsAngle % (2 * Math.PI)) * 180) / Math.PI).toFixed(1);

    // Determine retrograde status
    let retrogradeStatus = "prograde";
    if (trailHistory.length >= 4) {
      const recent1 = trailHistory[trailHistory.length - 1];
      const recent2 = trailHistory[trailHistory.length - 3];
      let diff = recent1.apparentAngle - recent2.apparentAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (diff < 0) retrogradeStatus = "RETROGRADE";
    }

    // Check angular separation between Earth and Mars (opposition check)
    let separation = marsAngle - earthAngle;
    while (separation > Math.PI) separation -= 2 * Math.PI;
    while (separation < -Math.PI) separation += 2 * Math.PI;
    const nearOpposition = Math.abs(Math.abs(separation) - Math.PI) < 0.3;

    return (
      `Apparent Motion of Mars | Day: ${time.toFixed(0)} (${(time / EARTH_PERIOD).toFixed(2)} Earth years) | ` +
      `Earth angle: ${earthDeg} deg | Mars angle: ${marsDeg} deg | ` +
      `Apparent direction of Mars: ${apparentDeg} deg | ` +
      `Motion: ${retrogradeStatus}${nearOpposition ? " (near opposition)" : ""} | ` +
      `Speed: ${speed}x | Sight lines: ${showSightLines >= 0.5 ? "on" : "off"} | ` +
      `Trail length: ${trailLength} | Labels: ${showLabels >= 0.5 ? "on" : "off"}`
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

export default ApparentMotionMarsFactory;
