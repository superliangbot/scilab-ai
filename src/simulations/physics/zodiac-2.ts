import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface ZodiacStar {
  ra: number; // degrees
  dec: number; // degrees
  mag: number;
  constellation: number; // index
}

const Zodiac2Factory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("zodiac-2") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let timeScale = 1;
  let latitude = 35;
  let showGrid = 1;
  let showSunPath = 1;

  let viewAngle = 0;

  const constellationNames = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];

  const constellationColors = [
    "#ff6b6b", "#ffa07a", "#f1c40f", "#81ecec", "#74b9ff", "#a29bfe",
    "#fd79a8", "#e17055", "#00b894", "#636e72", "#6c5ce7", "#55efc4",
  ];

  // Generate representative zodiac belt stars
  let stars: ZodiacStar[] = [];
  let constellationLines: [number, number][] = [];

  function generateStars(): void {
    stars = [];
    constellationLines = [];
    let starIdx = 0;

    for (let c = 0; c < 12; c++) {
      const baseRA = c * 30 + 5;
      const baseDec = Math.sin((c * 30 * Math.PI) / 180) * 23.5; // ecliptic

      // 5-8 stars per constellation
      const nStars = 5 + Math.floor(Math.random() * 4);
      const firstIdx = starIdx;

      // Use deterministic "random" for consistency
      let rng = c * 1000 + 42;
      function prand(): number {
        rng = (rng * 16807) % 2147483647;
        return rng / 2147483647;
      }

      for (let i = 0; i < nStars; i++) {
        stars.push({
          ra: baseRA + (prand() - 0.5) * 25,
          dec: baseDec + (prand() - 0.5) * 15,
          mag: 2 + prand() * 3,
          constellation: c,
        });
        starIdx++;
      }

      // Connect stars in constellation
      for (let i = firstIdx + 1; i < starIdx; i++) {
        constellationLines.push([i - 1, i]);
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    viewAngle = 0;
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 1;
    latitude = params.latitude ?? 35;
    showGrid = Math.round(params.showGrid ?? 1);
    showSunPath = Math.round(params.showSunPath ?? 1);

    viewAngle += dt * timeScale * 15; // degrees per second

    time += dt;
  }

  function projectStar(ra: number, dec: number): { x: number; y: number; visible: boolean } {
    // Simple cylindrical projection with rotation
    const raShifted = ((ra - viewAngle) % 360 + 360) % 360;

    // Map RA 0-360 to x across screen width
    const x = (raShifted / 360) * width;
    // Map Dec -90 to 90 to y
    const y = height / 2 - (dec / 90) * (height * 0.4);

    return { x, y, visible: true };
  }

  function render(): void {
    // Night sky
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Coordinate grid
    if (showGrid) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.5;

      // RA lines every 30°
      for (let ra = 0; ra < 360; ra += 30) {
        const p = projectStar(ra, 0);
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, height);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${ra}°`, p.x, height - 5);
      }

      // Dec lines
      for (let dec = -60; dec <= 60; dec += 30) {
        const p = projectStar(0, dec);
        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(width, p.y);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${dec}°`, 3, p.y - 3);
      }
    }

    // Ecliptic line
    if (showSunPath) {
      ctx.beginPath();
      for (let ra = 0; ra <= 360; ra += 2) {
        const dec = 23.5 * Math.sin((ra * Math.PI) / 180);
        const p = projectStar(ra, dec);
        if (ra === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(255,200,50,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sun position (moves through year)
      const sunRA = (viewAngle * 0.5) % 360;
      const sunDec = 23.5 * Math.sin((sunRA * Math.PI) / 180);
      const sunP = projectStar(sunRA, sunDec);

      const sunGlow = ctx.createRadialGradient(sunP.x, sunP.y, 2, sunP.x, sunP.y, 15);
      sunGlow.addColorStop(0, "rgba(255,220,50,0.8)");
      sunGlow.addColorStop(1, "rgba(255,220,50,0)");
      ctx.beginPath();
      ctx.arc(sunP.x, sunP.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = sunGlow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sunP.x, sunP.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fffde0";
      ctx.fill();

      // Month markers (1-12)
      for (let m = 1; m <= 12; m++) {
        const mRA = ((m - 1) * 30 + 15);
        const mDec = 23.5 * Math.sin((mRA * Math.PI) / 180);
        const mp = projectStar(mRA, mDec);
        ctx.fillStyle = "rgba(255,200,50,0.5)";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${m}`, mp.x, mp.y - 10);
      }
    }

    // Constellation lines
    for (const [i, j] of constellationLines) {
      const p1 = projectStar(stars[i].ra, stars[i].dec);
      const p2 = projectStar(stars[j].ra, stars[j].dec);

      // Don't draw lines that wrap around
      if (Math.abs(p1.x - p2.x) < width * 0.3) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = constellationColors[stars[i].constellation] + "40";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Stars
    for (const star of stars) {
      const p = projectStar(star.ra, star.dec);
      const size = Math.max(1.5, (5 - star.mag) * 1.2);
      const color = constellationColors[star.constellation];

      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Constellation name labels
    for (let c = 0; c < 12; c++) {
      const centerRA = c * 30 + 15;
      const centerDec = Math.sin((c * 30 * Math.PI) / 180) * 23.5;
      const p = projectStar(centerRA, centerDec + 12);

      ctx.fillStyle = constellationColors[c] + "80";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(constellationNames[c], p.x, p.y);
    }

    // Celestial equator
    const eqP = projectStar(0, 0);
    ctx.strokeStyle = "rgba(100,200,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(0, eqP.y);
    ctx.lineTo(width, eqP.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(100,200,255,0.3)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Celestial Equator", width - 5, eqP.y - 3);

    // Horizon line based on latitude
    const horizonDec = -(90 - latitude);
    const hp = projectStar(0, horizonDec);
    ctx.fillStyle = "rgba(100,80,60,0.2)";
    ctx.fillRect(0, hp.y, width, height - hp.y);
    ctx.strokeStyle = "rgba(200,150,100,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hp.y);
    ctx.lineTo(width, hp.y);
    ctx.stroke();

    ctx.fillStyle = "rgba(200,150,100,0.4)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Horizon (lat ${latitude}°)`, width - 5, hp.y - 3);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Zodiac Star Map", width / 2, 18);

    // Info
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Ecliptic tilt: 23.5° | Latitude: ${latitude}° | ${stars.length} stars`, width / 2, 32);
  }

  function reset(): void {
    time = 0;
    viewAngle = 0;
  }

  function destroy(): void {
    stars = [];
    constellationLines = [];
  }

  function getStateDescription(): string {
    return (
      `Zodiac Star Map: ${stars.length} stars across 12 constellations. ` +
      `View angle: ${(viewAngle % 360).toFixed(1)}°, latitude: ${latitude}°. ` +
      `Ecliptic tilt: 23.5°. Time scale: ${timeScale}×.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default Zodiac2Factory;
