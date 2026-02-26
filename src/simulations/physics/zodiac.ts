import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const ZodiacFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("zodiac") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let timeScale = 1;
  let showLabels = 1;
  let showEcliptic = 1;

  let earthAngle = 0; // Earth's orbital position

  const zodiacSigns = [
    { name: "Aries", symbol: "♈", angle: 0, month: "Mar-Apr" },
    { name: "Taurus", symbol: "♉", angle: 30, month: "Apr-May" },
    { name: "Gemini", symbol: "♊", angle: 60, month: "May-Jun" },
    { name: "Cancer", symbol: "♋", angle: 90, month: "Jun-Jul" },
    { name: "Leo", symbol: "♌", angle: 120, month: "Jul-Aug" },
    { name: "Virgo", symbol: "♍", angle: 150, month: "Aug-Sep" },
    { name: "Libra", symbol: "♎", angle: 180, month: "Sep-Oct" },
    { name: "Scorpio", symbol: "♏", angle: 210, month: "Oct-Nov" },
    { name: "Sagittarius", symbol: "♐", angle: 240, month: "Nov-Dec" },
    { name: "Capricorn", symbol: "♑", angle: 270, month: "Dec-Jan" },
    { name: "Aquarius", symbol: "♒", angle: 300, month: "Jan-Feb" },
    { name: "Pisces", symbol: "♓", angle: 330, month: "Feb-Mar" },
  ];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    earthAngle = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 1;
    showLabels = Math.round(params.showLabels ?? 1);
    showEcliptic = Math.round(params.showEcliptic ?? 1);

    // Earth orbits once per year; 1 unit of time = 1 month
    earthAngle += (2 * Math.PI / 12) * dt * timeScale;

    time += dt;
  }

  function render(): void {
    // Deep space background
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Background stars
    const seed = 55;
    let rng = seed;
    function prng(): number {
      rng = (rng * 16807) % 2147483647;
      return rng / 2147483647;
    }
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      ctx.arc(prng() * width, prng() * height, prng() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = width / 2;
    const cy = height / 2;
    const orbitR = Math.min(width, height) * 0.28;
    const zodiacR = Math.min(width, height) * 0.42;

    // Ecliptic circle
    if (showEcliptic) {
      ctx.beginPath();
      ctx.arc(cx, cy, zodiacR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,200,50,0.15)";
      ctx.lineWidth = zodiacR - orbitR;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, zodiacR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,200,50,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Zodiac signs around the circle
    for (const sign of zodiacSigns) {
      const rad = ((sign.angle - 90) * Math.PI) / 180;
      const sx = cx + Math.cos(rad) * zodiacR;
      const sy = cy + Math.sin(rad) * zodiacR;

      // Constellation region divider
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad - Math.PI / 12) * (orbitR + 15), cy + Math.sin(rad - Math.PI / 12) * (orbitR + 15));
      ctx.lineTo(cx + Math.cos(rad - Math.PI / 12) * (zodiacR + 15), cy + Math.sin(rad - Math.PI / 12) * (zodiacR + 15));
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Symbol
      ctx.fillStyle = "rgba(255,220,100,0.8)";
      ctx.font = "18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sign.symbol, sx, sy);

      // Name label
      if (showLabels) {
        const labelR = zodiacR + 22;
        const lx = cx + Math.cos(rad) * labelR;
        const ly = cy + Math.sin(rad) * labelR;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "9px system-ui, sans-serif";
        ctx.fillText(sign.name, lx, ly);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "8px system-ui, sans-serif";
        ctx.fillText(sign.month, lx, ly + 11);
      }
    }

    // Earth orbit circle
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100,150,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sun at center
    const sunGlow = ctx.createRadialGradient(cx, cy, 3, cx, cy, 25);
    sunGlow.addColorStop(0, "#fff8dc");
    sunGlow.addColorStop(0.3, "#ffd700");
    sunGlow.addColorStop(1, "rgba(255,200,0,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.fillStyle = sunGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8dc";
    ctx.fill();

    // Earth
    const earthX = cx + Math.cos(earthAngle) * orbitR;
    const earthY = cy + Math.sin(earthAngle) * orbitR;

    ctx.beginPath();
    ctx.arc(earthX, earthY, 8, 0, Math.PI * 2);
    const eGrad = ctx.createRadialGradient(earthX - 2, earthY - 2, 0, earthX, earthY, 8);
    eGrad.addColorStop(0, "#6ab7ff");
    eGrad.addColorStop(1, "#1a5ab8");
    ctx.fillStyle = eGrad;
    ctx.fill();

    // "Sun appears in" direction (opposite Earth)
    const sunApparentAngle = earthAngle + Math.PI;
    const sunAppearsDeg = ((sunApparentAngle * 180 / Math.PI) % 360 + 360) % 360;

    // Find current zodiac
    let currentZodiac = zodiacSigns[0];
    for (const sign of zodiacSigns) {
      const signStart = sign.angle;
      const signEnd = sign.angle + 30;
      const adjusted = ((sunAppearsDeg + 90) % 360 + 360) % 360;
      if (adjusted >= signStart && adjusted < signEnd) {
        currentZodiac = sign;
        break;
      }
    }

    // Line from Earth through Sun to zodiac
    ctx.beginPath();
    ctx.moveTo(earthX, earthY);
    const farX = cx + Math.cos(sunApparentAngle) * zodiacR;
    const farY = cy + Math.sin(sunApparentAngle) * zodiacR;
    ctx.lineTo(farX, farY);
    ctx.strokeStyle = "rgba(255,200,50,0.3)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current sign indicator
    ctx.fillStyle = "rgba(255,200,50,0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Sun in: ${currentZodiac.symbol} ${currentZodiac.name}`, 15, height - 15);

    // Month indicator
    const monthNum = ((earthAngle / (Math.PI * 2)) * 12 % 12 + 12) % 12;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Month: ~${months[Math.floor(monthNum)]}`, 15, height - 32);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Zodiac — The Ecliptic Constellations", width / 2, 22);

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("The Sun appears to move through 12 zodiac constellations as Earth orbits", width / 2, 38);
  }

  function reset(): void {
    time = 0;
    earthAngle = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const sunAppearsDeg = (((earthAngle + Math.PI) * 180 / Math.PI) % 360 + 360) % 360;
    return (
      `Zodiac: Earth orbital angle ${(earthAngle * 180 / Math.PI % 360).toFixed(1)}°. ` +
      `Sun appears at ecliptic longitude ${sunAppearsDeg.toFixed(1)}°. ` +
      `12 zodiac constellations along the ecliptic. Time scale: ${timeScale}×.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default ZodiacFactory;
