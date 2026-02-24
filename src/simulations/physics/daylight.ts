import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DEG = Math.PI / 180;
const AXIAL_TILT = 23.44;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Declination angle of the Sun for a given day of year. */
function solarDeclination(dayOfYear: number): number {
  return AXIAL_TILT * Math.sin((360 / 365) * (dayOfYear - 81) * DEG);
}

/** Calculate daylight hours for a given latitude and day of year. */
function daylightHours(latDeg: number, dayOfYear: number): number {
  const decl = solarDeclination(dayOfYear);
  const latRad = latDeg * DEG;
  const declRad = decl * DEG;

  // cos(hour_angle) = -tan(lat) * tan(decl)
  const cosHA = -Math.tan(latRad) * Math.tan(declRad);

  // Polar day / polar night
  if (cosHA < -1) return 24;
  if (cosHA > 1) return 0;

  const hourAngle = Math.acos(cosHA);
  return (2 * hourAngle) / (15 * DEG); // convert to hours
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function dayToMonthLabel(day: number): string {
  for (let i = MONTH_STARTS.length - 1; i >= 0; i--) {
    if (day >= MONTH_STARTS[i]) return MONTH_NAMES[i];
  }
  return "Jan";
}

const DaylightFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("daylight") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let latitude = 45;
  let dayOfYear = 172;
  let animationSpeed = 1;

  let currentDaylight = 12;
  let currentDeclination = 0;
  let animating = false;
  let animDay = 172;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    animDay = dayOfYear;
    computeValues();
  }

  function computeValues(): void {
    currentDeclination = solarDeclination(dayOfYear);
    currentDaylight = daylightHours(latitude, dayOfYear);
  }

  function update(dt: number, params: Record<string, number>): void {
    latitude = params.latitude ?? 45;
    dayOfYear = Math.round(params.dayOfYear ?? 172);
    animationSpeed = params.animationSpeed ?? 1;
    time += dt;

    // Animate day progression
    animDay += dt * animationSpeed * 30; // ~30 days per second at speed 1
    if (animDay > 365) animDay -= 365;
    if (animDay < 1) animDay += 365;
    dayOfYear = Math.round(animDay);

    computeValues();
  }

  function drawBackground(): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#050518");
    grad.addColorStop(0.5, "#0a0a28");
    grad.addColorStop(1, "#080820");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  /** Draw Earth with tilt and terminator in the left portion of the canvas. */
  function drawEarth(): void {
    const earthCx = width * 0.22;
    const earthCy = height * 0.42;
    const earthR = Math.min(width, height) * 0.16;

    ctx.save();

    // Sun indicator on the left side
    const sunX = earthCx - earthR * 2.8;
    const sunY = earthCy;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 40);
    sunGlow.addColorStop(0, "rgba(255, 230, 100, 0.9)");
    sunGlow.addColorStop(0.3, "rgba(255, 200, 50, 0.4)");
    sunGlow.addColorStop(1, "rgba(255, 180, 30, 0)");
    ctx.beginPath();
    ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
    ctx.fillStyle = sunGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX, sunY, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe860";
    ctx.fill();

    // Sun rays toward Earth
    ctx.strokeStyle = "rgba(255, 230, 100, 0.15)";
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const ry = earthCy + i * earthR * 0.28;
      ctx.beginPath();
      ctx.moveTo(sunX + 15, ry);
      ctx.lineTo(earthCx - earthR - 5, ry);
      ctx.stroke();
    }

    // Tilt angle display
    const tiltRad = AXIAL_TILT * DEG;

    // Earth body
    ctx.save();
    ctx.translate(earthCx, earthCy);
    ctx.rotate(-tiltRad); // tilt the Earth

    // Earth sphere
    const earthGrad = ctx.createRadialGradient(-earthR * 0.2, -earthR * 0.2, earthR * 0.1, 0, 0, earthR);
    earthGrad.addColorStop(0, "#3388cc");
    earthGrad.addColorStop(0.6, "#2266aa");
    earthGrad.addColorStop(1, "#114477");
    ctx.beginPath();
    ctx.arc(0, 0, earthR, 0, Math.PI * 2);
    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Terminator line: the day/night boundary shifts with declination
    // Declination shifts the terminator relative to the equator
    const declRad = currentDeclination * DEG;
    // The terminator is tilted by the declination angle relative to the pole axis
    ctx.save();
    ctx.rotate(declRad);

    // Night side (right half when sun is on left)
    ctx.beginPath();
    ctx.arc(0, 0, earthR, -Math.PI / 2, Math.PI / 2);
    ctx.fillStyle = "rgba(0, 0, 20, 0.6)";
    ctx.fill();

    ctx.restore(); // undo declination rotation

    // Latitude line
    const latY = -earthR * Math.sin(latitude * DEG);
    ctx.strokeStyle = "rgba(255, 80, 80, 0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    const latWidth = earthR * Math.cos(latitude * DEG);
    ctx.beginPath();
    ctx.moveTo(-latWidth, latY);
    ctx.lineTo(latWidth, latY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Equator line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-earthR, 0);
    ctx.lineTo(earthR, 0);
    ctx.stroke();

    // Axis line (pole to pole)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -earthR - 15);
    ctx.lineTo(0, earthR + 15);
    ctx.stroke();

    // Axis arrow at north pole
    ctx.beginPath();
    ctx.moveTo(0, -earthR - 15);
    ctx.lineTo(-4, -earthR - 7);
    ctx.moveTo(0, -earthR - 15);
    ctx.lineTo(4, -earthR - 7);
    ctx.stroke();

    ctx.restore(); // undo tilt

    // Tilt angle arc
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(earthCx, earthCy, earthR + 20, -Math.PI / 2, -Math.PI / 2 + tiltRad);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("23.44\u00B0", earthCx + 5, earthCy - earthR - 22);

    // Labels
    ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`Lat: ${latitude.toFixed(0)}\u00B0`, earthCx, earthCy + earthR + 30);

    ctx.restore();
  }

  /** Draw the daylight hours graph on the right side. */
  function drawGraph(): void {
    const gx = width * 0.48;
    const gy = height * 0.08;
    const gw = width * 0.48;
    const gh = height * 0.52;

    ctx.save();

    // Graph background
    ctx.fillStyle = "rgba(10, 10, 35, 0.6)";
    ctx.beginPath();
    ctx.roundRect(gx - 10, gy - 10, gw + 20, gh + 30, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = "rgba(220, 230, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Daylight Hours vs. Day of Year", gx + gw / 2, gy + 6);

    const plotX = gx + 35;
    const plotY = gy + 20;
    const plotW = gw - 50;
    const plotH = gh - 40;

    // Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.stroke();

    // Y-axis labels (0-24 hours)
    ctx.fillStyle = "rgba(200, 210, 230, 0.6)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let h = 0; h <= 24; h += 6) {
      const yy = plotY + plotH - (h / 24) * plotH;
      ctx.fillText(`${h}h`, plotX - 4, yy + 3);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.moveTo(plotX, yy);
      ctx.lineTo(plotX + plotW, yy);
      ctx.stroke();
    }

    // 12h reference line
    const y12 = plotY + plotH - (12 / 24) * plotH;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255, 255, 100, 0.2)";
    ctx.beginPath();
    ctx.moveTo(plotX, y12);
    ctx.lineTo(plotX + plotW, y12);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis month labels
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(200, 210, 230, 0.5)";
    for (let m = 0; m < 12; m++) {
      const mx = plotX + ((MONTH_STARTS[m] - 1) / 364) * plotW;
      ctx.fillText(MONTH_NAMES[m], mx + 10, plotY + plotH + 14);
    }

    // Draw the daylight curve
    ctx.beginPath();
    let first = true;
    for (let d = 1; d <= 365; d++) {
      const dl = daylightHours(latitude, d);
      const px = plotX + ((d - 1) / 364) * plotW;
      const py = plotY + plotH - (dl / 24) * plotH;
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "rgba(80, 180, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(plotX + plotW, plotY + plotH);
    ctx.lineTo(plotX, plotY + plotH);
    ctx.closePath();
    ctx.fillStyle = "rgba(80, 180, 255, 0.08)";
    ctx.fill();

    // Mark solstices and equinoxes
    const events = [
      { day: 80, label: "Vernal Eq.", color: "rgba(100, 255, 100, 0.7)" },
      { day: 172, label: "Summer Sol.", color: "rgba(255, 200, 50, 0.7)" },
      { day: 266, label: "Autumnal Eq.", color: "rgba(255, 160, 60, 0.7)" },
      { day: 355, label: "Winter Sol.", color: "rgba(100, 180, 255, 0.7)" },
    ];

    for (const ev of events) {
      const ex = plotX + ((ev.day - 1) / 364) * plotW;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = ev.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ex, plotY);
      ctx.lineTo(ex, plotY + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(ex, plotY - 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = ev.color;
      ctx.font = "8px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(ev.label, 2, 0);
      ctx.restore();
    }

    // Current day marker
    const curX = plotX + ((dayOfYear - 1) / 364) * plotW;
    const curY = plotY + plotH - (currentDaylight / 24) * plotH;

    ctx.strokeStyle = "rgba(255, 80, 80, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(curX, plotY);
    ctx.lineTo(curX, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dot on the curve
    ctx.beginPath();
    ctx.arc(curX, curY, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ff5050";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glow
    const dotGlow = ctx.createRadialGradient(curX, curY, 0, curX, curY, 12);
    dotGlow.addColorStop(0, "rgba(255, 80, 80, 0.4)");
    dotGlow.addColorStop(1, "rgba(255, 80, 80, 0)");
    ctx.beginPath();
    ctx.arc(curX, curY, 12, 0, Math.PI * 2);
    ctx.fillStyle = dotGlow;
    ctx.fill();

    ctx.restore();
  }

  /** Draw a sun arc showing the path across the sky for the current day/latitude. */
  function drawSunArc(): void {
    const arcCx = width * 0.72;
    const arcCy = height * 0.82;
    const arcR = Math.min(width * 0.2, height * 0.14);

    ctx.save();

    // Horizon line
    ctx.strokeStyle = "rgba(100, 180, 100, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arcCx - arcR - 20, arcCy);
    ctx.lineTo(arcCx + arcR + 20, arcCy);
    ctx.stroke();

    ctx.fillStyle = "rgba(100, 180, 100, 0.5)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Horizon", arcCx, arcCy + 14);
    ctx.textAlign = "left";
    ctx.fillText("E", arcCx - arcR - 18, arcCy - 6);
    ctx.textAlign = "right";
    ctx.fillText("W", arcCx + arcR + 18, arcCy - 6);

    // Sun arc
    const fractionDay = clamp(currentDaylight / 24, 0, 1);
    const arcAngle = Math.PI * fractionDay; // total arc angle
    const startAngle = Math.PI / 2 + arcAngle / 2;
    const endAngle = Math.PI / 2 - arcAngle / 2;

    if (fractionDay > 0.01) {
      ctx.beginPath();
      ctx.arc(arcCx, arcCy, arcR, Math.PI + endAngle, Math.PI + startAngle);
      ctx.strokeStyle = "rgba(255, 220, 80, 0.6)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Animated sun position along the arc
      const sunPhase = (time * 0.3) % 1;
      const sunAngle = Math.PI + startAngle + sunPhase * (endAngle - startAngle);
      const sx = arcCx + arcR * Math.cos(sunAngle);
      const sy = arcCy + arcR * Math.sin(sunAngle);

      if (sy <= arcCy) {
        const sGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
        sGlow.addColorStop(0, "rgba(255, 230, 80, 0.8)");
        sGlow.addColorStop(1, "rgba(255, 200, 50, 0)");
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.fillStyle = sGlow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffe040";
        ctx.fill();
      }
    }

    // Label
    ctx.fillStyle = "rgba(200, 210, 240, 0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sun path across sky", arcCx, arcCy - arcR - 10);

    ctx.restore();
  }

  function drawInfoPanel(): void {
    ctx.save();
    const pw = 260;
    const ph = 120;
    const px = width * 0.05;
    const py = height * 0.72;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Daylight Duration", px + 10, py + 18);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    const monthLabel = dayToMonthLabel(dayOfYear);
    ctx.fillText(`Day ${dayOfYear} (${monthLabel}) | Lat: ${latitude.toFixed(1)}\u00B0`, px + 10, py + 38);

    // Big daylight hours
    ctx.fillStyle = "rgba(80, 200, 255, 0.95)";
    ctx.font = "bold 22px system-ui, sans-serif";
    const hrs = Math.floor(currentDaylight);
    const mins = Math.round((currentDaylight - hrs) * 60);
    ctx.fillText(`${hrs}h ${mins}m`, px + 10, py + 66);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("of daylight", px + 110, py + 66);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Declination: ${currentDeclination.toFixed(1)}\u00B0`, px + 10, py + 86);
    ctx.fillText("cos(H) = -tan(\u03C6) \u00D7 tan(\u03B4)", px + 10, py + 104);

    ctx.restore();
  }

  function render(): void {
    drawBackground();
    drawEarth();
    drawGraph();
    drawSunArc();
    drawInfoPanel();
  }

  function reset(): void {
    time = 0;
    animDay = dayOfYear;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    const hrs = Math.floor(currentDaylight);
    const mins = Math.round((currentDaylight - hrs) * 60);
    return (
      `Daylight simulation: Latitude ${latitude.toFixed(1)}\u00B0, ` +
      `Day ${dayOfYear} (${dayToMonthLabel(dayOfYear)}). ` +
      `Solar declination: ${currentDeclination.toFixed(1)}\u00B0. ` +
      `Daylight hours: ${hrs}h ${mins}m. ` +
      `Formula: cos(hour_angle) = -tan(lat) \u00D7 tan(declination), ` +
      `declination = 23.44\u00B0 \u00D7 sin(360/365 \u00D7 (day - 81)). ` +
      `Earth's axial tilt is 23.44\u00B0. Time: ${time.toFixed(1)}s.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DaylightFactory;
