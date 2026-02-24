import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const EquatorialCoordinateSystemFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("equatorial-coordinate-system") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let W = 800;
  let H = 600;
  let time = 0;

  // Parameters
  let month = 3; // 1-12
  let rightAscension = 6; // hours (0-24)
  let declination = 0; // degrees (-90 to 90)
  let showLabels = 1;

  // Sphere parameters
  let cx = 0;
  let cy = 0;
  let radius = 0;
  const OBLIQUITY = 23.44; // degrees

  // Constellations (simplified: RA in hours, Dec in degrees, magnitude)
  interface Star {
    ra: number; // hours
    dec: number; // degrees
    mag: number; // brightness 1-6
    name?: string;
  }

  const ZODIAC_CONSTELLATIONS = [
    { name: "Aries", ra: 2, dec: 20, symbol: "♈" },
    { name: "Taurus", ra: 4.5, dec: 18, symbol: "♉" },
    { name: "Gemini", ra: 7, dec: 22, symbol: "♊" },
    { name: "Cancer", ra: 8.5, dec: 20, symbol: "♋" },
    { name: "Leo", ra: 10.5, dec: 15, symbol: "♌" },
    { name: "Virgo", ra: 13, dec: -5, symbol: "♍" },
    { name: "Libra", ra: 15, dec: -15, symbol: "♎" },
    { name: "Scorpius", ra: 16.5, dec: -25, symbol: "♏" },
    { name: "Sagittarius", ra: 19, dec: -28, symbol: "♐" },
    { name: "Capricornus", ra: 21, dec: -20, symbol: "♑" },
    { name: "Aquarius", ra: 22.5, dec: -10, symbol: "♒" },
    { name: "Pisces", ra: 0.5, dec: 10, symbol: "♓" },
  ];

  // Generate random background stars
  let backgroundStars: Star[] = [];

  function generateStars(): void {
    backgroundStars = [];
    for (let i = 0; i < 200; i++) {
      backgroundStars.push({
        ra: Math.random() * 24,
        dec: (Math.random() - 0.5) * 180,
        mag: 1 + Math.random() * 5,
      });
    }
  }

  function raDecToXYZ(ra: number, dec: number, r: number): { x: number; y: number; z: number } {
    const raRad = (ra / 24) * 2 * Math.PI;
    const decRad = (dec * Math.PI) / 180;
    return {
      x: r * Math.cos(decRad) * Math.cos(raRad),
      y: r * Math.cos(decRad) * Math.sin(raRad),
      z: r * Math.sin(decRad),
    };
  }

  function projectTo2D(x3: number, y3: number, z3: number): { sx: number; sy: number; visible: boolean } {
    // Rotate by RA (around z-axis)
    const raAngle = -(rightAscension / 24) * 2 * Math.PI;
    const x1 = x3 * Math.cos(raAngle) - y3 * Math.sin(raAngle);
    const y1 = x3 * Math.sin(raAngle) + y3 * Math.cos(raAngle);
    const z1 = z3;

    // Rotate by declination (around x-axis)
    const decAngle = (declination * Math.PI) / 180;
    const x2 = x1;
    const y2 = y1 * Math.cos(decAngle) - z1 * Math.sin(decAngle);
    const z2 = y1 * Math.sin(decAngle) + z1 * Math.cos(decAngle);

    // Simple orthographic projection
    return {
      sx: cx + x2,
      sy: cy - z2,
      visible: y2 > -radius * 0.1, // Front-facing
    };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    W = canvas.width;
    H = canvas.height;
    cx = W / 2;
    cy = H / 2;
    radius = Math.min(W, H) * 0.35;
    time = 0;
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    month = params.month ?? 3;
    rightAscension = params.rightAscension ?? 6;
    declination = params.declination ?? 0;
    showLabels = params.showLabels ?? 1;
    time += dt;
  }

  function drawBackground(): void {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H));
    grad.addColorStop(0, "#0a0a2a");
    grad.addColorStop(1, "#000008");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawSphereOutline(): void {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100, 140, 200, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawGridLines(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(100, 140, 200, 0.12)";
    ctx.lineWidth = 0.5;

    // Hour circles (RA lines)
    for (let ra = 0; ra < 24; ra += 2) {
      ctx.beginPath();
      let started = false;
      for (let dec = -90; dec <= 90; dec += 2) {
        const p = raDecToXYZ(ra, dec, radius);
        const s = projectTo2D(p.x, p.y, p.z);
        if (s.visible) {
          if (!started) { ctx.moveTo(s.sx, s.sy); started = true; }
          else ctx.lineTo(s.sx, s.sy);
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Declination circles
    for (let dec = -60; dec <= 60; dec += 30) {
      ctx.beginPath();
      let started = false;
      for (let ra = 0; ra <= 24; ra += 0.2) {
        const p = raDecToXYZ(ra, dec, radius);
        const s = projectTo2D(p.x, p.y, p.z);
        if (s.visible) {
          if (!started) { ctx.moveTo(s.sx, s.sy); started = true; }
          else ctx.lineTo(s.sx, s.sy);
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCelestialEquator(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let ra = 0; ra <= 24.2; ra += 0.1) {
      const p = raDecToXYZ(ra, 0, radius);
      const s = projectTo2D(p.x, p.y, p.z);
      if (s.visible) {
        if (!started) { ctx.moveTo(s.sx, s.sy); started = true; }
        else ctx.lineTo(s.sx, s.sy);
      } else {
        started = false;
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawEcliptic(): void {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 200, 50, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let started = false;
    for (let lon = 0; lon <= 360; lon += 1) {
      const ra = lon / 15; // approximate
      const dec = OBLIQUITY * Math.sin((lon * Math.PI) / 180);
      const p = raDecToXYZ(ra, dec, radius);
      const s = projectTo2D(p.x, p.y, p.z);
      if (s.visible) {
        if (!started) { ctx.moveTo(s.sx, s.sy); started = true; }
        else ctx.lineTo(s.sx, s.sy);
      } else {
        started = false;
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawSun(): void {
    // Sun position based on month
    const sunLon = ((month - 3) / 12) * 360; // March = 0°
    const sunRA = sunLon / 15;
    const sunDec = OBLIQUITY * Math.sin((sunLon * Math.PI) / 180);
    const p = raDecToXYZ(sunRA, sunDec, radius);
    const s = projectTo2D(p.x, p.y, p.z);

    if (s.visible) {
      // Sun glow
      const glow = ctx.createRadialGradient(s.sx, s.sy, 0, s.sx, s.sy, 25);
      glow.addColorStop(0, "rgba(255, 220, 50, 0.6)");
      glow.addColorStop(1, "rgba(255, 220, 50, 0)");
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, 25, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Sun disc
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd700";
      ctx.fill();

      if (showLabels > 0.5) {
        ctx.fillStyle = "#ffd700";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Sun", s.sx, s.sy - 14);
      }
    }
  }

  function drawStars(): void {
    for (const star of backgroundStars) {
      const p = raDecToXYZ(star.ra, star.dec, radius);
      const s = projectTo2D(p.x, p.y, p.z);
      if (!s.visible) continue;

      const size = Math.max(0.5, 3 - star.mag * 0.4);
      const alpha = Math.max(0.2, 1 - star.mag * 0.15);

      ctx.beginPath();
      ctx.arc(s.sx, s.sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  function drawZodiacConstellations(): void {
    for (const zod of ZODIAC_CONSTELLATIONS) {
      const p = raDecToXYZ(zod.ra, zod.dec, radius);
      const s = projectTo2D(p.x, p.y, p.z);
      if (!s.visible) continue;

      // Constellation marker
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200, 150, 255, 0.7)";
      ctx.fill();

      if (showLabels > 0.5) {
        ctx.fillStyle = "rgba(200, 150, 255, 0.7)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${zod.symbol} ${zod.name}`, s.sx, s.sy - 10);
      }
    }
  }

  function drawCoordinateLabels(): void {
    // RA labels on equator
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let ra = 0; ra < 24; ra += 3) {
      const p = raDecToXYZ(ra, 0, radius + 15);
      const s = projectTo2D(p.x, p.y, p.z);
      if (s.visible) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.6)";
        ctx.fillText(`${ra}h`, s.sx, s.sy);
      }
    }
  }

  function drawLegend(): void {
    ctx.save();
    const lw = 200;
    const lh = 80;
    const lx = 15;
    const ly = H - lh - 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, lw, lh, 6);
    ctx.fill();

    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";

    ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx + 10, ly + 16);
    ctx.lineTo(lx + 30, ly + 16);
    ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("Celestial Equator", lx + 35, ly + 20);

    ctx.strokeStyle = "rgba(255, 200, 50, 0.5)";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(lx + 10, ly + 36);
    ctx.lineTo(lx + 30, ly + 36);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Ecliptic", lx + 35, ly + 40);

    ctx.beginPath();
    ctx.arc(lx + 20, ly + 56, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd700";
    ctx.fill();
    ctx.fillText("Sun position", lx + 35, ly + 60);

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 280;
    const ph = 90;
    const px = 15;
    const py = 15;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Equatorial Coordinate System", px + 12, py + 22);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`Month: ${months[Math.round(month) - 1] || "Mar"} | RA: ${rightAscension.toFixed(1)}h`, px + 12, py + 42);
    ctx.fillText(`Dec: ${declination.toFixed(0)}° | Obliquity: ${OBLIQUITY}°`, px + 12, py + 58);
    ctx.fillText("RA (longitude) + Dec (latitude) = celestial position", px + 12, py + 78);

    ctx.restore();
  }

  function render(): void {
    if (!ctx) return;
    drawBackground();
    drawSphereOutline();
    drawGridLines();
    drawCelestialEquator();
    drawEcliptic();
    drawStars();
    drawZodiacConstellations();
    drawSun();
    drawCoordinateLabels();
    drawLegend();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    generateStars();
  }

  function destroy(): void {
    backgroundStars = [];
  }

  function getStateDescription(): string {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const sunLon = ((month - 3) / 12) * 360;
    const sunDec = OBLIQUITY * Math.sin((sunLon * Math.PI) / 180);
    return (
      `Equatorial Coordinate System: Viewing celestial sphere at RA=${rightAscension.toFixed(1)}h, Dec=${declination.toFixed(0)}°. ` +
      `Month: ${months[Math.round(month) - 1] || "March"}. Sun declination: ${sunDec.toFixed(1)}°. ` +
      `The equatorial system uses Right Ascension (0-24h) and Declination (-90° to +90°) to locate objects on the celestial sphere. ` +
      `The ecliptic is tilted ${OBLIQUITY}° to the celestial equator.`
    );
  }

  function resize(w: number, h: number): void {
    W = w;
    H = h;
    cx = W / 2;
    cy = H / 2;
    radius = Math.min(W, H) * 0.35;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default EquatorialCoordinateSystemFactory;
