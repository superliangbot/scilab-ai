import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Simplified continent outlines as [lon, lat] polygon arrays (rectangular projection) */
const CONTINENTS: [number, number][][] = [
  // North America
  [[-130,50],[-125,60],[-110,68],[-85,70],[-75,62],[-55,48],[-65,44],[-80,25],[-105,20],[-118,33],[-125,48],[-130,50]],
  // South America
  [[-82,10],[-65,12],[-35,-5],[-35,-20],[-55,-30],[-70,-55],[-75,-45],[-70,-18],[-80,0],[-82,10]],
  // Europe
  [[-10,36],[0,44],[5,44],[10,48],[20,55],[30,60],[32,70],[42,68],[30,55],[30,42],[25,36],[10,36],[-10,36]],
  // Africa
  [[-18,15],[-15,28],[10,37],[30,32],[42,12],[50,2],[40,-15],[30,-34],[18,-35],[12,-25],[8,-5],[-5,5],[-18,15]],
  // Asia
  [[30,42],[42,42],[50,28],[60,25],[65,30],[75,30],[80,10],[95,10],[105,22],[120,23],[130,42],[142,46],[150,60],[170,65],[180,65],[180,42],[140,35],[120,0],[105,0],[95,10],[80,10],[65,30],[50,28],[42,42],[30,42]],
  // Australia
  [[115,-14],[130,-12],[150,-22],[148,-38],[133,-32],[115,-22],[115,-14]],
];

const DaylightMapFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("daylight-map") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Cached params
  let dayOfYear = 172;
  let hourOfDay = 12;
  let animationSpeed = 1;

  // Map drawing region
  let mapLeft = 0, mapTop = 0, mapW = 0, mapH = 0;

  function lonToX(lon: number): number {
    return mapLeft + ((lon + 180) / 360) * mapW;
  }
  function latToY(lat: number): number {
    return mapTop + ((90 - lat) / 180) * mapH;
  }

  /** Solar declination in radians for a given day of year */
  function solarDeclination(day: number): number {
    return 23.44 * DEG2RAD * Math.sin((360 / 365) * (day - 81) * DEG2RAD);
  }

  /** Cosine of the solar zenith angle at a point (lat, lon) given subsolar point */
  function cosZenith(latRad: number, decRad: number, hourAngleRad: number): number {
    return (
      Math.sin(latRad) * Math.sin(decRad) +
      Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad)
    );
  }

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>): void {
    animationSpeed = params.animationSpeed ?? 1;
    dayOfYear = params.dayOfYear ?? 172;
    hourOfDay = params.hourOfDay ?? 12;

    // Advance time: each second of real time = animationSpeed hours of simulated time
    time += dt * animationSpeed;
  }

  function render(): void {
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, width, height);

    // Compute the effective hour and day including animation time offset
    let effectiveHour = hourOfDay + time;
    let effectiveDay = dayOfYear;
    while (effectiveHour >= 24) { effectiveHour -= 24; effectiveDay += 1; }
    while (effectiveHour < 0) { effectiveHour += 24; effectiveDay -= 1; }
    while (effectiveDay > 365) effectiveDay -= 365;
    while (effectiveDay < 1) effectiveDay += 365;

    // Layout: map occupies most of the canvas, leaving room for info
    const padding = 12;
    const infoH = 54;
    mapLeft = padding + 30;
    mapTop = padding + 10;
    mapW = width - padding * 2 - 30;
    mapH = height - padding * 2 - infoH - 10;

    // Solar calculations
    const decRad = solarDeclination(effectiveDay);
    const decDeg = decRad * RAD2DEG;
    const subsolarLat = decDeg;
    const subsolarLon = -(effectiveHour - 12) * 15; // 15 degrees per hour, noon = 0 lon

    // Draw day/night shading using pixel-based sampling
    const stepLon = 3;
    const stepLat = 3;
    for (let lon = -180; lon < 180; lon += stepLon) {
      for (let lat = -90; lat < 90; lat += stepLat) {
        const latRad = lat * DEG2RAD;
        const hourAngle = (lon - subsolarLon) * DEG2RAD;
        const cz = cosZenith(latRad, decRad, hourAngle);

        const x = lonToX(lon);
        const y = latToY(lat);
        const cellW = (stepLon / 360) * mapW + 1;
        const cellH = (stepLat / 180) * mapH + 1;

        if (cz > 0.1) {
          // Daytime - warm light blue
          const brightness = Math.min(cz * 0.8, 0.7);
          ctx.fillStyle = `rgba(135, 200, 250, ${0.15 + brightness * 0.35})`;
        } else if (cz > -0.1) {
          // Twilight zone
          const t = (cz + 0.1) / 0.2;
          const r = Math.round(20 + t * 80);
          const g = Math.round(20 + t * 60);
          const b = Math.round(60 + t * 80);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
        } else {
          // Night - dark
          ctx.fillStyle = "rgba(5, 5, 30, 0.6)";
        }
        ctx.fillRect(x, y, cellW, cellH);
      }
    }

    // Draw ocean base (subtle underneath continents)
    ctx.strokeStyle = "rgba(60, 120, 180, 0.15)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mapLeft, mapTop, mapW, mapH);

    // Draw latitude/longitude grid
    ctx.strokeStyle = "rgba(100, 140, 180, 0.2)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 4]);

    // Longitude lines every 30 degrees
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = lonToX(lon);
      ctx.beginPath();
      ctx.moveTo(x, mapTop);
      ctx.lineTo(x, mapTop + mapH);
      ctx.stroke();
    }
    // Latitude lines every 30 degrees
    for (let lat = -90; lat <= 90; lat += 30) {
      const y = latToY(lat);
      ctx.beginPath();
      ctx.moveTo(mapLeft, y);
      ctx.lineTo(mapLeft + mapW, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Special latitude lines: equator, tropics, arctic circles
    const specialLats = [
      { lat: 0, label: "Equator", color: "rgba(200, 200, 100, 0.3)" },
      { lat: 23.44, label: "Tropic of Cancer", color: "rgba(200, 100, 100, 0.2)" },
      { lat: -23.44, label: "Tropic of Capricorn", color: "rgba(200, 100, 100, 0.2)" },
      { lat: 66.56, label: "Arctic Circle", color: "rgba(100, 150, 255, 0.2)" },
      { lat: -66.56, label: "Antarctic Circle", color: "rgba(100, 150, 255, 0.2)" },
    ];
    for (const sl of specialLats) {
      const y = latToY(sl.lat);
      ctx.strokeStyle = sl.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(mapLeft, y);
      ctx.lineTo(mapLeft + mapW, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw simplified continent outlines
    ctx.strokeStyle = "rgba(120, 200, 120, 0.6)";
    ctx.fillStyle = "rgba(60, 130, 60, 0.15)";
    ctx.lineWidth = 1.5;
    for (const continent of CONTINENTS) {
      ctx.beginPath();
      for (let i = 0; i < continent.length; i++) {
        const x = lonToX(continent[i][0]);
        const y = latToY(continent[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw the solar terminator line
    ctx.strokeStyle = "rgba(255, 200, 50, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (let lon = -180; lon <= 180; lon += 1) {
      // Find the latitude where cosZenith = 0
      // cos(zen)=0 => sin(lat)sin(dec) + cos(lat)cos(dec)cos(ha) = 0
      // tan(lat) = -cos(ha)*cos(dec)/sin(dec) ... but simpler: iterate
      const hourAngle = (lon - subsolarLon) * DEG2RAD;
      const cosHA = Math.cos(hourAngle);
      // cos(zen)=0 => tan(lat) = -cos(dec)*cos(ha)/sin(dec) ... rearranged:
      // lat = atan(-cos(ha) / tan(dec)) -- but only valid when dec != 0
      let terminatorLat: number;
      if (Math.abs(decRad) < 0.001) {
        // Near equinox, terminator is at hour angle = +/-90
        terminatorLat = 0;
        // Actually: cos(zen)=cos(lat)*cos(ha), zero when ha=90, so terminator is straight
        if (Math.abs(cosHA) < 0.001) terminatorLat = 90; // vertical line
      }
      // General formula: lat where zenith=90
      // sin(lat)*sin(dec) = -cos(lat)*cos(dec)*cos(ha)
      // tan(lat) = -cos(dec)*cos(ha)/sin(dec) = -cos(ha)/tan(dec)
      const tanDec = Math.tan(decRad);
      if (Math.abs(tanDec) > 0.0001) {
        terminatorLat = Math.atan(-cosHA / tanDec) * RAD2DEG;
      } else {
        terminatorLat = cosHA >= 0 ? -90 : 90;
      }

      const x = lonToX(lon);
      const y = latToY(terminatorLat);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw subsolar point (sun icon)
    const sunX = lonToX(((subsolarLon % 360) + 540) % 360 - 180);
    const sunY = latToY(subsolarLat);
    const sunR = 8;

    // Sun glow
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 4);
    glow.addColorStop(0, "rgba(255, 220, 50, 0.7)");
    glow.addColorStop(0.5, "rgba(255, 180, 30, 0.2)");
    glow.addColorStop(1, "rgba(255, 150, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 4, 0, Math.PI * 2);
    ctx.fill();

    // Sun body
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Sun rays
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(a) * (sunR + 3), sunY + Math.sin(a) * (sunR + 3));
      ctx.lineTo(sunX + Math.cos(a) * (sunR + 8), sunY + Math.sin(a) * (sunR + 8));
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = "rgba(150, 180, 210, 0.5)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let lon = -180; lon <= 180; lon += 60) {
      ctx.fillText(`${lon}\u00B0`, lonToX(lon), mapTop + mapH + 3);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.fillText(`${lat}\u00B0`, mapLeft - 4, latToY(lat));
    }

    // Map border
    ctx.strokeStyle = "rgba(100, 140, 180, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(mapLeft, mapTop, mapW, mapH);

    // Calculate daylight statistics
    let daylitCells = 0, totalCells = 0;
    for (let lon = -180; lon < 180; lon += 6) {
      for (let lat = -90; lat < 90; lat += 6) {
        const latRad = lat * DEG2RAD;
        const ha = (lon - subsolarLon) * DEG2RAD;
        const cz = cosZenith(latRad, decRad, ha);
        totalCells++;
        if (cz > 0) daylitCells++;
      }
    }
    const daylitPct = ((daylitCells / totalCells) * 100).toFixed(1);

    // Info panel at the bottom
    const panelY = height - infoH - 6;
    const panelX = padding;
    const panelW = width - padding * 2;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, infoH, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, infoH, 8);
    ctx.stroke();

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const approxMonth = months[Math.min(11, Math.floor((effectiveDay - 1) / 30.44))];
    const approxDayOfMonth = Math.round(((effectiveDay - 1) % 30.44) + 1);
    const hrs = Math.floor(effectiveHour);
    const mins = Math.round((effectiveHour - hrs) * 60);
    const timeStr = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")} UTC`;

    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const cy = panelY + infoH / 2;
    const colW = panelW / 5;

    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Day ${Math.round(effectiveDay)} (~${approxMonth} ${approxDayOfMonth})`, panelX + 12, cy - 10);

    ctx.fillStyle = "#22d3ee";
    ctx.fillText(`Time: ${timeStr}`, panelX + 12, cy + 10);

    ctx.fillStyle = "#34d399";
    ctx.textAlign = "center";
    ctx.fillText(`Declination: ${decDeg.toFixed(1)}\u00B0`, panelX + colW * 2, cy - 10);

    ctx.fillStyle = "#a78bfa";
    ctx.fillText(`Subsolar: ${subsolarLat.toFixed(1)}\u00B0N, ${subsolarLon.toFixed(1)}\u00B0`, panelX + colW * 2, cy + 10);

    ctx.fillStyle = "#f59e0b";
    ctx.textAlign = "right";
    ctx.fillText(`Daylit: ${daylitPct}%`, panelX + panelW - 12, cy - 10);

    ctx.fillStyle = "#64748b";
    ctx.fillText(`\u03B4 = 23.44\u00B0 \u00D7 sin(360/365 \u00D7 (d\u221281))`, panelX + panelW - 12, cy + 10);

    // Title
    ctx.fillStyle = "rgba(200, 210, 230, 0.5)";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("DAYLIGHT MAP - Solar Terminator", padding + 2, 3);
  }

  function reset(): void {
    time = 0;
  }

  function destroy(): void {}

  function getStateDescription(): string {
    let effectiveHour = hourOfDay + time;
    let effectiveDay = dayOfYear;
    while (effectiveHour >= 24) { effectiveHour -= 24; effectiveDay += 1; }
    while (effectiveDay > 365) effectiveDay -= 365;
    const decDeg = solarDeclination(effectiveDay) * RAD2DEG;
    const subsolarLon = -(effectiveHour - 12) * 15;
    return (
      `Daylight Map: Day ${Math.round(effectiveDay)}, ${effectiveHour.toFixed(1)}h UTC. ` +
      `Solar declination=${decDeg.toFixed(1)}\u00B0, subsolar point=(${decDeg.toFixed(1)}\u00B0N, ${subsolarLon.toFixed(1)}\u00B0E). ` +
      `Animation speed=${animationSpeed}x. ` +
      `Formula: \u03B4 = 23.44\u00B0 \u00D7 sin(360/365 \u00D7 (day \u2212 81)).`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default DaylightMapFactory;
