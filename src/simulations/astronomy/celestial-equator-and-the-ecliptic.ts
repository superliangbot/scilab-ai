import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const CelestialEquatorEclipticFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("celestial-equator-and-the-ecliptic") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let viewAngle = 30;
  let speed = 1;
  let showGrid = 1;
  let showLabels = 1;

  // Starfield
  let stars: Array<{ x: number; y: number; brightness: number; size: number }> = [];

  // Constants
  const AXIAL_TILT_DEG = 23.5;
  const AXIAL_TILT = (AXIAL_TILT_DEG * Math.PI) / 180;

  // Sun orbital angle along ecliptic
  let sunAngle = 0;

  // Layout (recalculated on resize)
  let cx = 0;
  let cy = 0;
  let earthRadius = 0;
  let orbitRadius = 0;

  function computeLayout(): void {
    cx = width * 0.5;
    cy = height * 0.48;
    earthRadius = Math.min(width, height) * 0.1;
    orbitRadius = Math.min(width, height) * 0.35;
  }

  function generateStars(): void {
    stars = [];
    const count = Math.floor((width * height) / 700);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        brightness: 0.2 + Math.random() * 0.8,
        size: 0.3 + Math.random() * 1.1,
      });
    }
  }

  function drawBackground(): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a0a1a");
    bgGrad.addColorStop(1, "#10102a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(): void {
    for (const star of stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 2.5 + star.x * 0.04 + star.y * 0.06);
      const alpha = star.brightness * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  /**
   * Project a 3D point onto the 2D canvas.
   * The camera looks from a viewAngle above the ecliptic plane.
   * Coordinates: x = right, y = into screen, z = up.
   * We tilt the camera by viewAngle around the x-axis.
   */
  function project3D(x3: number, y3: number, z3: number): { x: number; y: number; depth: number } {
    const viewRad = (viewAngle * Math.PI) / 180;
    const cosV = Math.cos(viewRad);
    const sinV = Math.sin(viewRad);

    // Rotate around x-axis by viewAngle
    const yRot = y3 * cosV - z3 * sinV;
    const zRot = y3 * sinV + z3 * cosV;

    return {
      x: cx + x3,
      y: cy - zRot, // screen y is inverted
      depth: yRot,  // for depth sorting
    };
  }

  function drawEarth(): void {
    // Earth is at origin, with axial tilt applied to its rotation axis
    // Draw the sphere as a filled circle with gradient
    const earthScreen = project3D(0, 0, 0);

    // Earth body
    const earthGrad = ctx.createRadialGradient(
      earthScreen.x - earthRadius * 0.25,
      earthScreen.y - earthRadius * 0.2,
      0,
      earthScreen.x,
      earthScreen.y,
      earthRadius
    );
    earthGrad.addColorStop(0, "#6699ff");
    earthGrad.addColorStop(0.5, "#3366cc");
    earthGrad.addColorStop(0.85, "#224488");
    earthGrad.addColorStop(1, "#112244");

    ctx.beginPath();
    ctx.arc(earthScreen.x, earthScreen.y, earthRadius, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Atmosphere glow
    const atmoGrad = ctx.createRadialGradient(
      earthScreen.x, earthScreen.y, earthRadius * 0.85,
      earthScreen.x, earthScreen.y, earthRadius * 1.3
    );
    atmoGrad.addColorStop(0, "rgba(100, 150, 255, 0.15)");
    atmoGrad.addColorStop(1, "rgba(100, 150, 255, 0)");
    ctx.beginPath();
    ctx.arc(earthScreen.x, earthScreen.y, earthRadius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = atmoGrad;
    ctx.fill();

    // 3D grid lines on earth if showGrid
    if (showGrid >= 0.5) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(earthScreen.x, earthScreen.y, earthRadius, 0, Math.PI * 2);
      ctx.clip();

      // Latitude lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 0.7;
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = (lat * Math.PI) / 180;
        const r = earthRadius * Math.cos(latRad);
        // Project the latitude circle: it's at z = earthRadius * sin(lat), tilted by axial tilt
        const z0 = earthRadius * Math.sin(latRad);

        // Tilt by axial tilt around x-axis in local Earth frame
        const zTilted = z0 * Math.cos(AXIAL_TILT);
        const yTilted = -z0 * Math.sin(AXIAL_TILT);

        const center = project3D(0, yTilted, zTilted);
        const viewRad = (viewAngle * Math.PI) / 180;

        // The latitude ellipse projected
        const rScaleY = Math.abs(Math.sin(viewRad + AXIAL_TILT)) * r;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, r, Math.max(1, rScaleY), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Longitude lines
      for (let lon = 0; lon < 180; lon += 30) {
        const lonRad = (lon * Math.PI) / 180;
        ctx.beginPath();
        const segments = 36;
        for (let i = 0; i <= segments; i++) {
          const latAngle = (i / segments) * Math.PI * 2;
          // Point on sphere
          let px = earthRadius * Math.cos(latAngle) * Math.sin(lonRad);
          let py = earthRadius * Math.cos(latAngle) * Math.cos(lonRad);
          let pz = earthRadius * Math.sin(latAngle);

          // Apply axial tilt (rotate around x-axis)
          const pyTilted = py * Math.cos(AXIAL_TILT) - pz * Math.sin(AXIAL_TILT);
          const pzTilted = py * Math.sin(AXIAL_TILT) + pz * Math.cos(AXIAL_TILT);

          const pt = project3D(px, pyTilted, pzTilted);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    // Axis of rotation (tilted)
    const axisLength = earthRadius * 2.0;
    const topAxis = project3D(0, -axisLength * Math.sin(AXIAL_TILT), axisLength * Math.cos(AXIAL_TILT));
    const bottomAxis = project3D(0, axisLength * Math.sin(AXIAL_TILT), -axisLength * Math.cos(AXIAL_TILT));

    ctx.beginPath();
    ctx.moveTo(topAxis.x, topAxis.y);
    ctx.lineTo(bottomAxis.x, bottomAxis.y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small circle at north pole
    ctx.beginPath();
    ctx.arc(topAxis.x, topAxis.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fill();

    // Label N/S
    if (showLabels >= 0.5) {
      const fontSize = Math.max(10, Math.min(12, width / 60));
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillText("N", topAxis.x + 12, topAxis.y - 4);
      ctx.fillText("S", bottomAxis.x + 12, bottomAxis.y + 12);
    }
  }

  /**
   * Draw an orbital ring (ellipse) from 3D points.
   * planeNormal determines the ring's plane orientation.
   * tiltAngle is the tilt from the ecliptic plane.
   */
  function drawOrbitalPlane(
    radius: number,
    tiltFromEcliptic: number,
    color: string,
    label: string,
    lineWidth: number,
    dashed: boolean = false
  ): void {
    const segments = 120;
    const points: Array<{ x: number; y: number; depth: number }> = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // Point on circle in the plane
      const px = radius * Math.cos(angle);
      const py = radius * Math.sin(angle);
      const pz = 0;

      // Rotate by tiltFromEcliptic around x-axis to tilt the plane
      const pyTilted = py * Math.cos(tiltFromEcliptic);
      const pzTilted = py * Math.sin(tiltFromEcliptic);

      points.push(project3D(px, pyTilted, pzTilted));
    }

    // Draw back half (behind Earth) and front half separately for depth
    ctx.save();
    if (dashed) ctx.setLineDash([6, 4]);

    // Back half (depth > 0 means behind)
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < points.length; i++) {
      if (points[i].depth > 0) {
        if (!started) {
          ctx.moveTo(points[i].x, points[i].y);
          started = true;
        } else {
          ctx.lineTo(points[i].x, points[i].y);
        }
      } else if (started) {
        ctx.lineTo(points[i].x, points[i].y);
        started = false;
      }
    }
    ctx.strokeStyle = color.replace(/[\d.]+\)$/, "0.25)");
    ctx.lineWidth = lineWidth * 0.6;
    ctx.stroke();

    // Front half (depth <= 0 means in front)
    ctx.beginPath();
    started = false;
    for (let i = 0; i < points.length; i++) {
      if (points[i].depth <= 0) {
        if (!started) {
          ctx.moveTo(points[i].x, points[i].y);
          started = true;
        } else {
          ctx.lineTo(points[i].x, points[i].y);
        }
      } else if (started) {
        ctx.lineTo(points[i].x, points[i].y);
        started = false;
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    // Label at a fixed point on the ellipse
    if (showLabels >= 0.5 && label) {
      const labelAngle = Math.PI * 0.35;
      const lpx = radius * Math.cos(labelAngle);
      const lpy = radius * Math.sin(labelAngle);
      const lpyTilted = lpy * Math.cos(tiltFromEcliptic);
      const lpzTilted = lpy * Math.sin(tiltFromEcliptic);
      const labelPt = project3D(lpx, lpyTilted, lpzTilted);

      const fontSize = Math.max(10, Math.min(13, width / 55));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillStyle = color;
      ctx.fillText(label, labelPt.x + 8, labelPt.y - 6);
    }
  }

  function drawSun(): void {
    // Sun position along ecliptic (ecliptic is at z=0 plane)
    const sx = orbitRadius * Math.cos(sunAngle);
    const sy = orbitRadius * Math.sin(sunAngle);
    const sunPt = project3D(sx, sy, 0);

    const sunR = Math.min(width, height) * 0.028;

    // Sun glow
    const glowGrad = ctx.createRadialGradient(
      sunPt.x, sunPt.y, sunR * 0.3,
      sunPt.x, sunPt.y, sunR * 4
    );
    glowGrad.addColorStop(0, "rgba(255, 240, 150, 0.3)");
    glowGrad.addColorStop(0.4, "rgba(255, 200, 80, 0.1)");
    glowGrad.addColorStop(1, "rgba(255, 150, 50, 0)");
    ctx.beginPath();
    ctx.arc(sunPt.x, sunPt.y, sunR * 4, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // Sun body
    const sunGrad = ctx.createRadialGradient(
      sunPt.x - sunR * 0.2, sunPt.y - sunR * 0.2, 0,
      sunPt.x, sunPt.y, sunR
    );
    sunGrad.addColorStop(0, "#fffff0");
    sunGrad.addColorStop(0.3, "#ffee55");
    sunGrad.addColorStop(0.7, "#ffcc00");
    sunGrad.addColorStop(1, "#ff8800");
    ctx.beginPath();
    ctx.arc(sunPt.x, sunPt.y, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Label
    if (showLabels >= 0.5) {
      const fontSize = Math.max(10, Math.min(12, width / 60));
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 240, 150, 0.8)";
      ctx.fillText("Sun", sunPt.x, sunPt.y + sunR + 14);
    }
  }

  function drawEquinoxAndSolsticeMarkers(): void {
    if (showLabels < 0.5) return;

    const fontSize = Math.max(9, Math.min(11, width / 65));
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";

    // The intersection points of celestial equator and ecliptic
    // These occur where both planes cross: at angles 0 and PI along x-axis
    // (equinox points are along the line of intersection)

    // Vernal Equinox (angle = 0)
    const veX = orbitRadius * 1.05;
    const vePt = project3D(veX, 0, 0);
    ctx.fillStyle = "rgba(100, 255, 200, 0.8)";
    ctx.beginPath();
    ctx.arc(vePt.x, vePt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(100, 255, 200, 0.7)";
    ctx.fillText("Vernal Equinox", vePt.x, vePt.y - 10);

    // Autumnal Equinox (angle = PI)
    const aePt = project3D(-veX, 0, 0);
    ctx.fillStyle = "rgba(100, 255, 200, 0.8)";
    ctx.beginPath();
    ctx.arc(aePt.x, aePt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(100, 255, 200, 0.7)";
    ctx.fillText("Autumnal Equinox", aePt.x, aePt.y - 10);

    // Summer Solstice (angle = PI/2 on ecliptic, maximum separation above equator)
    const ssAngle = Math.PI / 2;
    const ssx = orbitRadius * 1.05 * Math.cos(ssAngle);
    const ssy = orbitRadius * 1.05 * Math.sin(ssAngle);
    const ssPt = project3D(ssx, ssy, 0);
    ctx.fillStyle = "rgba(255, 200, 80, 0.8)";
    ctx.beginPath();
    ctx.arc(ssPt.x, ssPt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 200, 80, 0.7)";
    ctx.fillText("Summer Solstice", ssPt.x, ssPt.y + 16);

    // Winter Solstice (angle = 3PI/2)
    const wsAngle = (3 * Math.PI) / 2;
    const wsx = orbitRadius * 1.05 * Math.cos(wsAngle);
    const wsy = orbitRadius * 1.05 * Math.sin(wsAngle);
    const wsPt = project3D(wsx, wsy, 0);
    ctx.fillStyle = "rgba(100, 180, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(wsPt.x, wsPt.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(100, 180, 255, 0.7)";
    ctx.fillText("Winter Solstice", wsPt.x, wsPt.y + 16);
  }

  function drawTiltAngleAnnotation(): void {
    if (showLabels < 0.5) return;

    // Draw an arc showing the 23.5 degree angle between the two planes
    // Draw near the vernal equinox intersection point
    const arcRadius = orbitRadius * 0.25;
    const arcCenterX = orbitRadius * 0.7;
    const arcCenter = project3D(arcCenterX, 0, 0);

    // Draw a small arc from ecliptic direction to equator direction
    const segments = 20;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * AXIAL_TILT;
      const ax = arcCenterX + arcRadius * 0.3 * Math.cos(0);
      const ay = arcRadius * 0.5 * Math.sin(0);
      const az = arcRadius * 0.15 * Math.sin(angle);
      const pt = project3D(ax + arcRadius * 0.08 * t, ay * t, az);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    const midPt = project3D(arcCenterX + arcRadius * 0.2, arcRadius * 0.15, arcRadius * 0.08);
    const fontSize = Math.max(9, Math.min(11, width / 65));
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "left";
    ctx.fillText("23.5\u00B0", midPt.x + 4, midPt.y);
  }

  function drawInfoPanel(): void {
    const panelW = Math.min(width * 0.32, 220);
    const panelH = 100;
    const panelX = 10;
    const panelY = height - panelH - 10;
    const fontSize = Math.max(9, Math.min(11, width / 65));

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `bold ${fontSize + 1}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Celestial Equator & Ecliptic", panelX + 10, panelY + 10);

    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";

    const sunDeg = ((sunAngle * 180) / Math.PI % 360).toFixed(1);
    ctx.fillText(`Sun position: ${sunDeg}\u00B0`, panelX + 10, panelY + 28);
    ctx.fillText(`Axial tilt: 23.5\u00B0`, panelX + 10, panelY + 44);
    ctx.fillText(`View angle: ${viewAngle.toFixed(0)}\u00B0`, panelX + 10, panelY + 60);

    // Color key
    ctx.fillStyle = "rgba(0, 255, 100, 0.7)";
    ctx.fillRect(panelX + 10, panelY + 78, 10, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Equator", panelX + 24, panelY + 74);

    ctx.fillStyle = "rgba(255, 180, 50, 0.7)";
    ctx.fillRect(panelX + panelW * 0.45, panelY + 78, 10, 3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillText("Ecliptic", panelX + panelW * 0.45 + 14, panelY + 74);
  }

  function drawTitle(): void {
    const fontSize = Math.max(12, Math.min(15, width / 45));
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Celestial Equator & the Ecliptic", width / 2, 12);
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    sunAngle = 0;
    computeLayout();
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    viewAngle = params.viewAngle ?? 30;
    speed = params.speed ?? 1;
    showGrid = params.showGrid ?? 1;
    showLabels = params.showLabels ?? 1;

    // Sun orbits along the ecliptic: full revolution ~ 10 seconds at speed 1
    sunAngle += dt * speed * 0.2 * Math.PI;
    time += dt;
  }

  function render(): void {
    if (!ctx || width === 0 || height === 0) return;

    drawBackground();
    drawStars();

    // Determine sun depth for layering
    const sunX3 = orbitRadius * Math.cos(sunAngle);
    const sunY3 = orbitRadius * Math.sin(sunAngle);
    const sunPt = project3D(sunX3, sunY3, 0);
    const sunBehind = sunPt.depth > 0;

    // Draw elements in depth order
    if (sunBehind) {
      drawSun();
    }

    // Draw ecliptic plane (orange/gold) -- z=0 plane
    drawOrbitalPlane(
      orbitRadius,
      0,
      "rgba(255, 180, 50, 0.7)",
      "Ecliptic",
      2
    );

    // Draw celestial equator (green) -- tilted by axial tilt from ecliptic
    // The celestial equator is the Earth's equator extended outward.
    // Since the Earth's axis is tilted by 23.5 degrees from the ecliptic normal,
    // the equatorial plane is tilted by 23.5 degrees from the ecliptic plane.
    drawOrbitalPlane(
      orbitRadius * 0.95,
      AXIAL_TILT,
      "rgba(0, 255, 100, 0.7)",
      "Celestial Equator",
      2
    );

    // Draw Earth on top of rings
    drawEarth();

    if (!sunBehind) {
      drawSun();
    }

    drawEquinoxAndSolsticeMarkers();
    drawTiltAngleAnnotation();
    drawInfoPanel();
    drawTitle();
  }

  function reset(): void {
    time = 0;
    sunAngle = 0;
  }

  function destroy(): void {
    stars = [];
  }

  function getStateDescription(): string {
    const sunDeg = ((sunAngle * 180) / Math.PI % 360).toFixed(1);

    // Determine current season based on sun angle
    let a = sunAngle % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    let season: string;
    if (a < Math.PI / 2) {
      season = "Spring (approaching Summer Solstice)";
    } else if (a < Math.PI) {
      season = "Summer (approaching Autumnal Equinox)";
    } else if (a < (3 * Math.PI) / 2) {
      season = "Autumn (approaching Winter Solstice)";
    } else {
      season = "Winter (approaching Vernal Equinox)";
    }

    return (
      `Celestial Equator & Ecliptic | Sun position: ${sunDeg} deg along ecliptic | ` +
      `Season: ${season} | ` +
      `The celestial equator (Earth's equatorial plane) and ecliptic (Sun's apparent path) ` +
      `are tilted at 23.5 deg due to Earth's axial tilt. ` +
      `They intersect at the equinoxes (vernal and autumnal). ` +
      `Maximum separation occurs at the solstices (summer and winter). ` +
      `View angle: ${viewAngle.toFixed(0)} deg | Speed: ${speed}x | ` +
      `Grid: ${showGrid >= 0.5 ? "on" : "off"} | Labels: ${showLabels >= 0.5 ? "on" : "off"}.`
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

export default CelestialEquatorEclipticFactory;
