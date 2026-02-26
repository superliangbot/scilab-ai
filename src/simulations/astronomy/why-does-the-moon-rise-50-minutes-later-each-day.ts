import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MoonRise50MinFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("why-does-the-moon-rise-50-minutes-later-each-day") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let timeScale = 1;
  let showOrbits = 1;
  let dayNumber = 0;

  let earthRotation = 0; // radians
  let moonOrbitAngle = 0; // radians

  const EARTH_ROTATION_PERIOD = 1; // 1 unit = 1 day
  const MOON_ORBIT_PERIOD = 29.53; // days (synodic)

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    earthRotation = 0;
    moonOrbitAngle = 0;
    dayNumber = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    timeScale = params.timeScale ?? 1;
    showOrbits = Math.round(params.showOrbits ?? 1);

    const dayDt = dt * timeScale;

    earthRotation += (2 * Math.PI / EARTH_ROTATION_PERIOD) * dayDt;
    moonOrbitAngle += (2 * Math.PI / MOON_ORBIT_PERIOD) * dayDt;

    dayNumber = time * timeScale;
    time += dt;
  }

  function render(): void {
    // Background - space
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, width, height);

    // Stars
    const seed = 99;
    let rng = seed;
    function prng(): number {
      rng = (rng * 16807) % 2147483647;
      return rng / 2147483647;
    }
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let i = 0; i < 80; i++) {
      ctx.beginPath();
      ctx.arc(prng() * width, prng() * height, prng() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sun (far right)
    const sunX = width * 0.88;
    const sunY = height * 0.3;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 40);
    sunGrad.addColorStop(0, "#fff8dc");
    sunGrad.addColorStop(0.3, "#ffd700");
    sunGrad.addColorStop(1, "rgba(255,200,0,0)");
    ctx.beginPath();
    ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();

    ctx.fillStyle = "#fff8dc";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays
    ctx.strokeStyle = "rgba(255,220,100,0.15)";
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(a) * 20, sunY + Math.sin(a) * 20);
      ctx.lineTo(sunX + Math.cos(a) * 600, sunY + Math.sin(a) * 600);
      ctx.stroke();
    }

    // Earth
    const earthX = width * 0.35;
    const earthY = height * 0.45;
    const earthR = 40;

    // Moon orbit
    const moonOrbitR = 120;
    if (showOrbits) {
      ctx.beginPath();
      ctx.arc(earthX, earthY, moonOrbitR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Moon position
    const moonX = earthX + Math.cos(moonOrbitAngle) * moonOrbitR;
    const moonY = earthY + Math.sin(moonOrbitAngle) * moonOrbitR;
    const moonR = 12;

    // Earth body
    const earthGrad = ctx.createRadialGradient(earthX - 5, earthY - 5, 0, earthX, earthY, earthR);
    earthGrad.addColorStop(0, "#4a90d9");
    earthGrad.addColorStop(0.5, "#2d6a8e");
    earthGrad.addColorStop(1, "#1a3a4a");
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Earth rotation indicator (meridian line)
    const merX = earthX + Math.cos(earthRotation) * earthR;
    const merY = earthY + Math.sin(earthRotation) * earthR;
    ctx.beginPath();
    ctx.moveTo(earthX, earthY);
    ctx.lineTo(merX, merY);
    ctx.strokeStyle = "#2ecc71";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Observer dot on Earth
    ctx.beginPath();
    ctx.arc(merX, merY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#2ecc71";
    ctx.fill();

    // Moon body
    const moonGrad = ctx.createRadialGradient(moonX - 2, moonY - 2, 0, moonX, moonY, moonR);
    moonGrad.addColorStop(0, "#e0e0e0");
    moonGrad.addColorStop(1, "#888");
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", earthX, earthY + earthR + 14);
    ctx.fillText("Moon", moonX, moonY + moonR + 14);
    ctx.fillText("Sun ☀", sunX, sunY + 25);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Why Does the Moon Rise ~50 Minutes Later Each Day?", width / 2, 24);

    // Explanation diagram
    const panelX = 15;
    const panelY = height * 0.72;
    const panelW = width - 30;
    const panelH = height * 0.25;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("The Explanation:", panelX + 12, panelY + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("• Earth rotates 360° in ~24 hours (1 day)", panelX + 12, panelY + 36);
    ctx.fillText("• Moon orbits Earth 360° in ~29.53 days ≈ 12.2°/day", panelX + 12, panelY + 52);
    ctx.fillText("• Each day, Earth must rotate an extra ~12.2° to 'catch up' to the Moon", panelX + 12, panelY + 68);
    ctx.fillText("• 12.2° × (24h/360°) ≈ 50 minutes extra rotation needed", panelX + 12, panelY + 84);

    // Current state
    const moonDegPerDay = 360 / MOON_ORBIT_PERIOD;
    const extraDeg = moonDegPerDay * dayNumber;
    ctx.fillStyle = "#f1c40f";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(`Day ${dayNumber.toFixed(1)} | Moon advanced ${(extraDeg % 360).toFixed(1)}° in orbit`, panelX + 12, panelY + panelH - 10);

    // Green observer label
    ctx.fillStyle = "#2ecc71";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("● Observer", earthX + earthR + 8, earthY - 5);
  }

  function reset(): void {
    time = 0;
    earthRotation = 0;
    moonOrbitAngle = 0;
    dayNumber = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const moonDeg = (moonOrbitAngle * 180 / Math.PI) % 360;
    return (
      `Moon Rise 50min Later: Day ${dayNumber.toFixed(1)}. Moon orbit angle: ${moonDeg.toFixed(1)}°. ` +
      `The Moon moves ~12.2°/day in its orbit, requiring Earth to rotate an extra ` +
      `~50 minutes each day for the observer to see the Moon rise again.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MoonRise50MinFactory;
