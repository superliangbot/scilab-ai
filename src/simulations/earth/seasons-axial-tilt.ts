import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const seasonsAxialTiltFactory: SimulationFactory = () => {
  const config = getSimConfig("seasons-axial-tilt")!;
  let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, W = 800, H = 600, time = 0;

  let axialTilt = 23.5;
  let orbitalSpeed = 1;
  let showSunlight = 1;
  let showSeasons = 1;

  const seasonNames = ["Spring Equinox", "Summer Solstice", "Autumn Equinox", "Winter Solstice"];
  const seasonColors = ["#22c55e", "#facc15", "#f59e0b", "#60a5fa"];

  function orbitalAngle(): number {
    return time * orbitalSpeed * 0.3;
  }

  function currentSeason(): number {
    const angle = ((orbitalAngle() % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor((angle / (Math.PI * 2)) * 4);
  }

  function solarDeclination(): number {
    // δ = axialTilt × sin(orbitalAngle)
    return axialTilt * Math.sin(orbitalAngle());
  }

  function daylightHours(latitude: number): number {
    // H = 2/15 × arccos(-tan(lat) × tan(δ))
    const latRad = (latitude * Math.PI) / 180;
    const decRad = (solarDeclination() * Math.PI) / 180;
    const cosH = -Math.tan(latRad) * Math.tan(decRad);
    if (cosH <= -1) return 24; // polar day
    if (cosH >= 1) return 0; // polar night
    return (2 / 15) * (Math.acos(cosH) * 180 / Math.PI);
  }

  function drawSun(cx: number, cy: number, r: number) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "#fff7c2");
    grad.addColorStop(0.4, "#fbbf24");
    grad.addColorStop(0.8, "#f59e0b");
    grad.addColorStop(1, "#b45309");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 2.5);
    glow.addColorStop(0, "rgba(251, 191, 36, 0.3)");
    glow.addColorStop(1, "rgba(251, 191, 36, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.fillText("Sun", cx, cy + r + 16);
  }

  function drawEarth(cx: number, cy: number, r: number, sunCx: number) {
    const tiltRad = (axialTilt * Math.PI) / 180;

    // Earth sphere
    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
    grad.addColorStop(0, "#60a5fa");
    grad.addColorStop(0.5, "#2563eb");
    grad.addColorStop(1, "#1e3a8a");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Axis line
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-tiltRad);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.6);
    ctx.lineTo(0, r * 1.6);
    ctx.stroke();

    // N/S labels
    ctx.font = "bold 10px Arial";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.fillText("N", 0, -r * 1.7);
    ctx.fillText("S", 0, r * 1.8);

    // Equator
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Latitude lines
    for (const lat of [-66.5, -23.5, 0, 23.5, 66.5]) {
      const y = -r * Math.sin((lat * Math.PI) / 180);
      const rr = r * Math.cos((lat * Math.PI) / 180);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(0, y, rr, rr * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Sunlight coverage
    if (showSunlight) {
      const sunDir = Math.atan2(cy - cy, sunCx - cx); // simplification
      // Day/night terminator
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Shadow on far side from sun
      const nightSide = cx > sunCx ? -1 : 1;
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.ellipse(cx + nightSide * r * 0.5, cy, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawOrbit(cx: number, cy: number, rx: number, ry: number) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Season markers
    if (showSeasons) {
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const mx = cx + rx * Math.cos(angle);
        const my = cy + ry * Math.sin(angle);
        ctx.fillStyle = seasonColors[i];
        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(seasonNames[i], mx, my + (my > cy ? 16 : -10));
      }
    }
  }

  function drawDaylightChart() {
    const gx = W * 0.05, gy = H * 0.62, gw = W * 0.55, gh = H * 0.33;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeRect(gx, gy, gw, gh);

    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Daylight Hours vs Latitude", gx + gw / 2, gy + 16);

    // Plot daylight hours for different latitudes
    const latitudes = [-66.5, -45, -23.5, 0, 23.5, 45, 66.5];
    const latColors = ["#3b82f6", "#60a5fa", "#93c5fd", "#e2e8f0", "#fcd34d", "#f59e0b", "#ef4444"];
    const latLabels = ["66.5°S", "45°S", "23.5°S", "Equator", "23.5°N", "45°N", "66.5°N"];

    for (let l = 0; l < latitudes.length; l++) {
      const hours = daylightHours(latitudes[l]);
      const barH = (hours / 24) * (gh - 40);
      const barW = (gw - 40) / latitudes.length - 4;
      const bx = gx + 20 + l * ((gw - 40) / latitudes.length) + 2;
      const by = gy + gh - 15 - barH;

      ctx.fillStyle = latColors[l];
      ctx.fillRect(bx, by, barW, barH);

      ctx.font = "9px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(`${hours.toFixed(1)}h`, bx + barW / 2, by - 4);
      ctx.fillStyle = "#64748b";

      ctx.save();
      ctx.translate(bx + barW / 2, gy + gh - 4);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(latLabels[l], 0, 0);
      ctx.restore();
    }
  }

  function drawInfoPanel() {
    const px = W * 0.63, py = H * 0.62, pw = W * 0.35, ph = H * 0.33;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeRect(px, py, pw, ph);

    const season = currentSeason();
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = seasonColors[season];
    ctx.textAlign = "left";
    ctx.fillText(seasonNames[season], px + 10, py + 22);
    ctx.fillText("(Northern Hemisphere)", px + 10, py + 38);

    ctx.font = "12px Arial";
    ctx.fillStyle = "#e2e8f0";
    const y0 = py + 58;
    ctx.fillText(`Axial Tilt: ${axialTilt.toFixed(1)}°`, px + 10, y0);
    ctx.fillText(`Solar Declination: ${solarDeclination().toFixed(1)}°`, px + 10, y0 + 18);
    ctx.fillText(`Arctic Daylight: ${daylightHours(66.5).toFixed(1)}h`, px + 10, y0 + 36);
    ctx.fillText(`Equator Daylight: ${daylightHours(0).toFixed(1)}h`, px + 10, y0 + 54);
    ctx.fillText(`Antarctic Daylight: ${daylightHours(-66.5).toFixed(1)}h`, px + 10, y0 + 72);

    ctx.font = "10px monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText("δ = tilt × sin(orbital angle)", px + 10, py + ph - 10);
  }

  const engine: SimulationEngine = {
    config,
    init(c) {
      canvas = c; ctx = c.getContext("2d")!; W = c.width; H = c.height; time = 0;
    },
    update(dt, params) {
      axialTilt = params.axialTilt ?? axialTilt;
      orbitalSpeed = params.orbitalSpeed ?? orbitalSpeed;
      showSunlight = Math.round(params.showSunlight ?? showSunlight);
      showSeasons = Math.round(params.showSeasons ?? showSeasons);
      time += dt;
    },
    render() {
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText("Seasons & Axial Tilt", W / 2, 28);

      const sunCx = W / 2, sunCy = H * 0.3;
      const orbitRx = W * 0.28, orbitRy = H * 0.18;

      drawOrbit(sunCx, sunCy, orbitRx, orbitRy);
      drawSun(sunCx, sunCy, 22);

      // Earth position on orbit
      const angle = orbitalAngle();
      const earthCx = sunCx + orbitRx * Math.cos(angle);
      const earthCy = sunCy + orbitRy * Math.sin(angle);
      drawEarth(earthCx, earthCy, 18, sunCx);

      // Sunlight rays
      if (showSunlight) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.15)";
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(sunCx, sunCy + i * 8);
          ctx.lineTo(earthCx, earthCy + i * 4);
          ctx.stroke();
        }
      }

      drawDaylightChart();
      drawInfoPanel();
    },
    reset() { time = 0; },
    destroy() {},
    getStateDescription() {
      const season = currentSeason();
      const decl = solarDeclination();
      return `Seasons simulation: axial tilt ${axialTilt.toFixed(1)}°, currently ${seasonNames[season]} (NH). Solar declination: ${decl.toFixed(1)}°. Arctic daylight: ${daylightHours(66.5).toFixed(1)}h, equator: ${daylightHours(0).toFixed(1)}h.`;
    },
    resize(w, h) { W = w; H = h; },
  };
  return engine;
};

export default seasonsAxialTiltFactory;
