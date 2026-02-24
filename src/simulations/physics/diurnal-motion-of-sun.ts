import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DiurnalMotionOfSunFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("diurnal-motion-of-sun") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let latitude = 40;
  let timeSpeed = 1;
  let showDecember = 1;
  let showEquinox = 1;
  let showJune = 1;

  // Star positions (fixed random field)
  const stars: { az: number; alt: number; brightness: number }[] = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      az: Math.random() * 360,
      alt: Math.random() * 90,
      brightness: 0.3 + Math.random() * 0.7,
    });
  }

  function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  // Convert altitude/azimuth to screen coordinates (hemisphere projection)
  function skyToScreen(azDeg: number, altDeg: number): { x: number; y: number } | null {
    if (altDeg < 0) return null;
    const cx = width / 2;
    const cy = height * 0.85;
    const maxR = Math.min(width, height) * 0.4;
    const r = maxR * (1 - altDeg / 90);
    const azRad = toRad(azDeg - 90); // North = top
    return {
      x: cx + r * Math.cos(azRad),
      y: cy - r * Math.sin(azRad),
    };
  }

  // Calculate sun position for given hour angle and declination
  function sunPosition(hourAngleDeg: number, declinationDeg: number): { alt: number; az: number } {
    const lat = toRad(latitude);
    const dec = toRad(declinationDeg);
    const ha = toRad(hourAngleDeg);

    const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) + 1e-10);
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(ha) > 0) az = 2 * Math.PI - az;

    return { alt: (alt * 180) / Math.PI, az: (az * 180) / Math.PI };
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    latitude = params.latitude ?? 40;
    timeSpeed = params.timeSpeed ?? 1;
    showDecember = params.showDecember ?? 1;
    showEquinox = params.showEquinox ?? 1;
    showJune = params.showJune ?? 1;
    time += dt * timeSpeed;
  }

  function drawSunPath(declination: number, color: string, label: string, drawSun: boolean): void {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    let started = false;

    for (let ha = -180; ha <= 180; ha += 1) {
      const pos = sunPosition(ha, declination);
      const pt = skyToScreen(pos.az, pos.alt);
      if (pt) {
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Label the path
    const labelPos = sunPosition(-90, declination);
    const labelPt = skyToScreen(labelPos.az, labelPos.alt);
    if (labelPt) {
      ctx.fillStyle = color;
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, labelPt.x + 8, labelPt.y - 5);
    }

    // Draw current sun position
    if (drawSun) {
      const hourAngle = ((time * 15) % 360) - 180; // 15 deg/hour, wrapping
      const sunPos = sunPosition(hourAngle, declination);
      const sunPt = skyToScreen(sunPos.az, sunPos.alt);
      if (sunPt) {
        // Sun glow
        const glow = ctx.createRadialGradient(sunPt.x, sunPt.y, 0, sunPt.x, sunPt.y, 30);
        glow.addColorStop(0, "rgba(255,220,50,0.6)");
        glow.addColorStop(1, "rgba(255,220,50,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sunPt.x, sunPt.y, 30, 0, Math.PI * 2);
        ctx.fill();

        // Sun disk
        ctx.beginPath();
        ctx.arc(sunPt.x, sunPt.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#FFD700";
        ctx.fill();
        ctx.strokeStyle = "#FFA500";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function render(): void {
    // Sky gradient based on sun altitude
    const currentHourAngle = ((time * 15) % 360) - 180;
    const equinoxSun = sunPosition(currentHourAngle, 0);
    const dayFactor = Math.max(0, Math.min(1, equinoxSun.alt / 30));

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (dayFactor > 0.3) {
      bgGrad.addColorStop(0, `rgba(30,100,200,${dayFactor})`);
      bgGrad.addColorStop(1, `rgba(135,206,235,${dayFactor * 0.5})`);
    } else {
      bgGrad.addColorStop(0, "#0a0a2a");
      bgGrad.addColorStop(1, "#1a1a3a");
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw stars (visible at night)
    const starAlpha = Math.max(0, 1 - dayFactor * 2);
    if (starAlpha > 0) {
      for (const star of stars) {
        const pt = skyToScreen(star.az, star.alt);
        if (pt) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${star.brightness * starAlpha})`;
          ctx.fill();
        }
      }
    }

    // Draw horizon circle
    const cx = width / 2;
    const cy = height * 0.85;
    const maxR = Math.min(width, height) * 0.4;

    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw ground below horizon
    ctx.fillStyle = "rgba(34,70,34,0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI);
    ctx.fill();

    // Cardinal directions
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("N", cx, cy - maxR - 8);
    ctx.fillText("S", cx, cy + maxR + 18);
    ctx.fillText("E", cx + maxR + 14, cy + 4);
    ctx.fillText("W", cx - maxR - 14, cy + 4);

    // Altitude circles
    for (const alt of [30, 60]) {
      const r = maxR * (1 - alt / 90);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.fillText(`${alt}°`, cx + r + 5, cy);
    }

    // Zenith
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("Zenith", cx + 10, cy - 5);

    // Draw sun paths
    if (showDecember) drawSunPath(-23.44, "#4488ff", "Dec 21 (δ=-23.4°)", false);
    if (showEquinox) drawSunPath(0, "#44ff88", "Mar/Sep 21 (δ=0°)", true);
    if (showJune) drawSunPath(23.44, "#ff8844", "Jun 21 (δ=+23.4°)", false);

    // Info text
    const hours = ((time % 24) + 24) % 24;
    const h = Math.floor(hours);
    const m = Math.floor((hours % 1) * 60);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Latitude: ${latitude.toFixed(1)}°N`, 12, 24);
    ctx.fillText(`Local Time: ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`, 12, 44);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Diurnal Motion of the Sun", width - 12, height - 12);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const hours = ((time % 24) + 24) % 24;
    const currentHourAngle = ((time * 15) % 360) - 180;
    const equinoxPos = sunPosition(currentHourAngle, 0);
    return (
      `Diurnal Motion of Sun: latitude=${latitude.toFixed(1)}°N, ` +
      `local time=${hours.toFixed(1)}h, ` +
      `equinox sun altitude=${equinoxPos.alt.toFixed(1)}°, azimuth=${equinoxPos.az.toFixed(1)}°. ` +
      `Paths shown: Dec=${showDecember ? "yes" : "no"}, Equinox=${showEquinox ? "yes" : "no"}, Jun=${showJune ? "yes" : "no"}. ` +
      `The sun's path across the sky depends on latitude and season due to Earth's 23.44° axial tilt.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DiurnalMotionOfSunFactory;
