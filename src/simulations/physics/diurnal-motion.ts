import type { SimulationEngine, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

interface Star {
  ra: number;   // right ascension in radians (0 to 2π)
  dec: number;  // declination in radians (-π/2 to π/2)
  mag: number;  // magnitude (brightness)
  color: string;
}

const DiurnalMotionFactory = (): SimulationEngine => {
  const config = getSimConfig("diurnal-motion") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;
  let currentParams: Record<string, number> = {};
  let stars: Star[] = [];

  // Zodiac constellations along ecliptic
  const zodiac = [
    { name: "Aries", ra: 0.5 },
    { name: "Taurus", ra: 1.0 },
    { name: "Gemini", ra: 1.6 },
    { name: "Cancer", ra: 2.1 },
    { name: "Leo", ra: 2.6 },
    { name: "Virgo", ra: 3.3 },
    { name: "Libra", ra: 3.8 },
    { name: "Scorpius", ra: 4.3 },
    { name: "Sagittarius", ra: 4.8 },
    { name: "Capricorn", ra: 5.3 },
    { name: "Aquarius", ra: 5.8 },
    { name: "Pisces", ra: 0.0 },
  ];

  function generateStars(): void {
    stars = [];
    const colors = ["#ffffff", "#ffddaa", "#aaccff", "#ffaa88", "#ddddff"];

    // Generate random stars
    for (let i = 0; i < 200; i++) {
      stars.push({
        ra: Math.random() * Math.PI * 2,
        dec: (Math.random() - 0.5) * Math.PI * 0.9,
        mag: 1 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Add brighter stars near zodiac constellations
    for (const z of zodiac) {
      for (let i = 0; i < 5; i++) {
        const eclipticObliquity = 23.5 * Math.PI / 180;
        const dec = Math.sin(z.ra) * eclipticObliquity + (Math.random() - 0.5) * 0.3;
        stars.push({
          ra: z.ra + (Math.random() - 0.5) * 0.3,
          dec: dec,
          mag: 0.5 + Math.random() * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    generateStars();
  }

  function update(dt: number, params: Record<string, number>): void {
    currentParams = params;
    const speed = params.speed ?? 1;
    time += dt * speed;
  }

  // Project celestial coordinates to screen (stereographic-like)
  function projectStar(ra: number, dec: number, lst: number, lat: number): { x: number; y: number; visible: boolean } {
    // Hour angle
    const ha = lst - ra;

    // Convert to alt-az
    const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) + 1e-10);
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(ha) > 0) az = 2 * Math.PI - az;

    // Project: flat sky view (alt-azimuth projection)
    const r = (Math.PI / 2 - alt) / (Math.PI / 2);
    const x = width / 2 + r * (width * 0.45) * Math.sin(az);
    const y = height / 2 - r * (height * 0.45) * Math.cos(az);

    return { x, y, visible: alt > -0.05 };
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);

    // Dark sky gradient
    const skyGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
    skyGrad.addColorStop(0, "#0a0a2e");
    skyGrad.addColorStop(1, "#000008");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    const latitude = (currentParams.latitude ?? 40) * Math.PI / 180;
    const showGrid = currentParams.showGrid ?? 1;
    const showZodiac = currentParams.showZodiac ?? 1;

    // Local sidereal time (advances with time)
    const lst = (time * 0.2) % (Math.PI * 2);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `bold ${Math.max(14, width * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Diurnal Motion — Celestial Sphere", width / 2, 25);

    // Horizon circle
    ctx.strokeStyle = "#22c55e44";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    // Cardinal directions
    ctx.fillStyle = "#22c55e";
    ctx.font = `bold ${Math.max(12, width * 0.016)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("N", width / 2, height / 2 - Math.min(width, height) * 0.45 - 8);
    ctx.fillText("S", width / 2, height / 2 + Math.min(width, height) * 0.45 + 18);
    ctx.fillText("E", width / 2 - Math.min(width, height) * 0.45 - 12, height / 2 + 5);
    ctx.fillText("W", width / 2 + Math.min(width, height) * 0.45 + 12, height / 2 + 5);

    // Equatorial grid
    if (showGrid >= 0.5) {
      ctx.strokeStyle = "#33415544";
      ctx.lineWidth = 0.5;

      // Declination circles
      for (let dec = -60; dec <= 60; dec += 30) {
        const decRad = dec * Math.PI / 180;
        ctx.beginPath();
        let started = false;
        for (let raStep = 0; raStep <= 360; raStep += 2) {
          const ra = raStep * Math.PI / 180;
          const proj = projectStar(ra, decRad, lst, latitude);
          if (proj.visible) {
            if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
            else ctx.lineTo(proj.x, proj.y);
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // Right ascension lines
      for (let raH = 0; raH < 24; raH += 3) {
        const ra = (raH / 24) * Math.PI * 2;
        ctx.beginPath();
        let started = false;
        for (let dec = -90; dec <= 90; dec += 2) {
          const decRad = dec * Math.PI / 180;
          const proj = projectStar(ra, decRad, lst, latitude);
          if (proj.visible) {
            if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
            else ctx.lineTo(proj.x, proj.y);
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }
    }

    // Ecliptic
    const obliquity = 23.5 * Math.PI / 180;
    ctx.strokeStyle = "#f59e0b44";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let eclStarted = false;
    for (let lon = 0; lon <= 360; lon += 2) {
      const lonRad = lon * Math.PI / 180;
      const dec = Math.asin(Math.sin(obliquity) * Math.sin(lonRad));
      const ra = Math.atan2(Math.sin(lonRad) * Math.cos(obliquity), Math.cos(lonRad));
      const proj = projectStar((ra + Math.PI * 2) % (Math.PI * 2), dec, lst, latitude);
      if (proj.visible) {
        if (!eclStarted) { ctx.moveTo(proj.x, proj.y); eclStarted = true; }
        else ctx.lineTo(proj.x, proj.y);
      } else {
        eclStarted = false;
      }
    }
    ctx.stroke();

    // Stars
    for (const star of stars) {
      const proj = projectStar(star.ra, star.dec, lst, latitude);
      if (!proj.visible) continue;

      const size = Math.max(0.5, 3 - star.mag * 0.5);
      const alpha = Math.max(0.2, 1 - star.mag * 0.15);

      ctx.fillStyle = star.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Zodiac constellation labels
    if (showZodiac >= 0.5) {
      ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
      ctx.textAlign = "center";

      for (const z of zodiac) {
        const dec = Math.sin(z.ra) * obliquity;
        const proj = projectStar(z.ra, dec, lst, latitude);
        if (proj.visible) {
          ctx.fillStyle = "#f59e0b88";
          ctx.fillText(z.name, proj.x, proj.y - 8);
        }
      }
    }

    // Celestial pole marker
    const poleProj = projectStar(0, latitude > 0 ? Math.PI / 2 : -Math.PI / 2, lst, latitude);
    if (poleProj.visible) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(poleProj.x - 8, poleProj.y);
      ctx.lineTo(poleProj.x + 8, poleProj.y);
      ctx.moveTo(poleProj.x, poleProj.y - 8);
      ctx.lineTo(poleProj.x, poleProj.y + 8);
      ctx.stroke();

      ctx.fillStyle = "#ef4444";
      ctx.font = `${Math.max(9, width * 0.012)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(latitude > 0 ? "NCP" : "SCP", poleProj.x + 10, poleProj.y + 3);
    }

    // Info panel
    const panelX = 10;
    const panelY = height - 80;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(panelX, panelY, 260, 65);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, 260, 65);

    const latDeg = (currentParams.latitude ?? 40).toFixed(1);
    const lstHours = ((lst / (Math.PI * 2)) * 24 + 24) % 24;
    const lstH = Math.floor(lstHours);
    const lstM = Math.floor((lstHours - lstH) * 60);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = `${Math.max(11, width * 0.014)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`Latitude: ${latDeg}°`, panelX + 10, panelY + 18);
    ctx.fillText(`LST: ${lstH.toString().padStart(2, "0")}h ${lstM.toString().padStart(2, "0")}m`, panelX + 10, panelY + 38);
    ctx.fillText(`Visible stars: ${stars.filter(s => projectStar(s.ra, s.dec, lst, latitude).visible).length}`, panelX + 10, panelY + 58);
  }

  function reset(): void {
    time = 0;
    currentParams = {};
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const latitude = currentParams.latitude ?? 40;
    const speed = currentParams.speed ?? 1;
    const lst = (time * 0.2) % (Math.PI * 2);
    const lstHours = ((lst / (Math.PI * 2)) * 24 + 24) % 24;

    return `Diurnal motion simulation viewed from latitude ${latitude.toFixed(1)}°. Local sidereal time: ${lstHours.toFixed(1)}h. Speed: ${speed.toFixed(1)}×. Diurnal motion is the apparent daily movement of celestial objects across the sky caused by Earth's rotation. Stars appear to rotate around the celestial pole (Polaris in the Northern Hemisphere). The ecliptic (Sun's apparent annual path) is tilted 23.5° to the celestial equator. Stars near the pole are circumpolar (never set), while equatorial stars rise and set.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DiurnalMotionFactory;
