import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TidesFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("tides") as SimulationConfig;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let timeSpeed = 5;
  let solarInfluence = 0.46;
  let lunarInfluence = 1;
  let showGraph = 1;

  // Periods in hours
  const LUNAR_PERIOD = 24.84; // hours for one tidal cycle (semidiurnal)
  const SOLAR_PERIOD = 24.0;
  const LUNAR_MONTH = 29.53 * 24; // hours in a synodic month
  const TWO_PI = Math.PI * 2;

  let simulatedHours = 0;
  let tideHistory: number[] = [];

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    simulatedHours = 0;
    tideHistory = [];
  }

  function getTideHeight(hours: number): number {
    // Lunar semidiurnal tide (M2)
    const lunarTide = lunarInfluence * Math.cos(TWO_PI * hours / (LUNAR_PERIOD / 2));
    // Solar semidiurnal tide (S2)
    const solarTide = solarInfluence * Math.cos(TWO_PI * hours / (SOLAR_PERIOD / 2));
    return lunarTide + solarTide;
  }

  function getMoonPhaseAngle(hours: number): number {
    return TWO_PI * (hours % LUNAR_MONTH) / LUNAR_MONTH;
  }

  function update(dt: number, params: Record<string, number>): void {
    timeSpeed = params.timeSpeed ?? 5;
    solarInfluence = params.solarInfluence ?? 0.46;
    lunarInfluence = params.lunarInfluence ?? 1;
    showGraph = params.showGraph ?? 1;
    time += dt;

    // Advance simulated time (1 real second = timeSpeed simulated hours)
    simulatedHours += dt * timeSpeed;

    // Record tide history for graph (one point per 0.5 simulated hours)
    const currentTide = getTideHeight(simulatedHours);
    if (tideHistory.length === 0 || simulatedHours > tideHistory.length * 0.5) {
      tideHistory.push(currentTide);
    }

    // Keep a limited history
    const maxPoints = 400;
    if (tideHistory.length > maxPoints) {
      tideHistory = tideHistory.slice(tideHistory.length - maxPoints);
    }
  }

  function render(): void {
    // Dark background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#020617");
    bgGrad.addColorStop(0.3, "#0f172a");
    bgGrad.addColorStop(1, "#0c1426");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Ocean Tides", width / 2, 24);
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Gravitational effects of Moon and Sun", width / 2, 42);

    const currentTide = getTideHeight(simulatedHours);
    const moonPhase = getMoonPhaseAngle(simulatedHours);

    // === Earth cross-section (upper left) ===
    const earthCX = width * 0.25;
    const earthCY = height * 0.32;
    const earthR = Math.min(width, height) * 0.14;

    // Ocean layer with tidal bulge
    const bulgeStrength = 0.15 * (lunarInfluence + solarInfluence * 0.5);
    ctx.save();
    ctx.translate(earthCX, earthCY);
    ctx.rotate(moonPhase);

    // Tidal bulge (elliptical ocean)
    ctx.beginPath();
    ctx.ellipse(0, 0, earthR * (1 + bulgeStrength), earthR * (1 - bulgeStrength * 0.5), 0, 0, TWO_PI);
    ctx.fillStyle = "rgba(59,130,246,0.3)";
    ctx.fill();
    ctx.strokeStyle = "rgba(96,165,250,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Earth body
    ctx.beginPath();
    ctx.arc(0, 0, earthR * 0.88, 0, TWO_PI);
    const earthGrad = ctx.createRadialGradient(-earthR * 0.15, -earthR * 0.15, 0, 0, 0, earthR * 0.88);
    earthGrad.addColorStop(0, "#22c55e");
    earthGrad.addColorStop(1, "#14532d");
    ctx.fillStyle = earthGrad;
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Earth", earthCX, earthCY + earthR + 18);

    // === Moon ===
    const moonOrbitR = earthR * 2.2;
    const moonCX = earthCX + Math.cos(moonPhase) * moonOrbitR;
    const moonCY = earthCY + Math.sin(moonPhase) * moonOrbitR;
    const moonR = earthR * 0.2;

    // Moon orbit
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(earthCX, earthCY, moonOrbitR, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Moon
    const moonGrad = ctx.createRadialGradient(moonCX - moonR * 0.3, moonCY - moonR * 0.3, 0, moonCX, moonCY, moonR);
    moonGrad.addColorStop(0, "#f1f5f9");
    moonGrad.addColorStop(1, "#64748b");
    ctx.beginPath();
    ctx.arc(moonCX, moonCY, moonR, 0, TWO_PI);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Moon", moonCX, moonCY + moonR + 12);

    // === Sun indicator ===
    const sunX = width * 0.52, sunY = height * 0.15;
    ctx.beginPath(); ctx.arc(sunX, sunY, 18, 0, TWO_PI);
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 18);
    sunGrad.addColorStop(0, "#fef08a"); sunGrad.addColorStop(1, "#f59e0b");
    ctx.fillStyle = sunGrad; ctx.fill();
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TWO_PI + time * 0.3;
      ctx.beginPath(); ctx.moveTo(sunX + Math.cos(a) * 22, sunY + Math.sin(a) * 22);
      ctx.lineTo(sunX + Math.cos(a) * 28, sunY + Math.sin(a) * 28); ctx.stroke();
    }
    ctx.fillStyle = "#fbbf24"; ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Sun →", sunX, sunY + 34);

    // === Moon phase and tide type ===
    const phaseFrac = (moonPhase / TWO_PI);
    let phaseLabel = "";
    let tideType = "";
    if (phaseFrac < 0.06 || phaseFrac > 0.94) { phaseLabel = "New Moon"; tideType = "Spring Tide"; }
    else if (phaseFrac < 0.19) { phaseLabel = "Waxing Crescent"; tideType = "Weakening"; }
    else if (phaseFrac < 0.31) { phaseLabel = "First Quarter"; tideType = "Neap Tide"; }
    else if (phaseFrac < 0.44) { phaseLabel = "Waxing Gibbous"; tideType = "Strengthening"; }
    else if (phaseFrac < 0.56) { phaseLabel = "Full Moon"; tideType = "Spring Tide"; }
    else if (phaseFrac < 0.69) { phaseLabel = "Waning Gibbous"; tideType = "Weakening"; }
    else if (phaseFrac < 0.81) { phaseLabel = "Third Quarter"; tideType = "Neap Tide"; }
    else { phaseLabel = "Waning Crescent"; tideType = "Strengthening"; }

    // Phase + info panel (upper right)
    const infoX = width * 0.58;
    const infoY = 55;
    const infoW = width * 0.38;
    const infoH = height * 0.38;

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(infoX, infoY, infoW, infoH, 8);
    ctx.fill();

    let ty = infoY + 18;
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Tide Information", infoX + 12, ty); ty += 22;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Simulated time: ${simulatedHours.toFixed(1)} hrs`, infoX + 12, ty); ty += 16;
    ctx.fillText(`(${(simulatedHours / 24).toFixed(1)} days)`, infoX + 12, ty); ty += 18;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`Moon Phase: ${phaseLabel}`, infoX + 12, ty); ty += 16;

    const isSpring = tideType === "Spring Tide";
    const isNeap = tideType === "Neap Tide";
    ctx.fillStyle = isSpring ? "#f87171" : isNeap ? "#60a5fa" : "#94a3b8";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(`Tide Type: ${tideType}`, infoX + 12, ty); ty += 20;

    ctx.fillStyle = "#60a5fa";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`Current Tide: ${currentTide > 0 ? "+" : ""}${currentTide.toFixed(2)} m`, infoX + 12, ty); ty += 20;

    ctx.fillStyle = "#a5b4fc";
    ctx.font = "11px monospace";
    ctx.fillText("h(t) = A_moon cos(ωt)", infoX + 12, ty); ty += 15;
    ctx.fillText("     + A_sun cos(ω't)", infoX + 12, ty); ty += 18;

    ctx.fillStyle = "#64748b";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(`Lunar period: ${LUNAR_PERIOD} hrs`, infoX + 12, ty); ty += 14;
    ctx.fillText(`Solar period: ${SOLAR_PERIOD} hrs`, infoX + 12, ty);

    // === Tide level indicator ===
    const barX = width * 0.52;
    const barY = height * 0.52;
    const barW = 30;
    const barH = height * 0.2;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(barX - 5, barY - 5, barW + 10, barH + 25);

    // Scale
    const maxTide = lunarInfluence + solarInfluence;
    const normTide = currentTide / maxTide;
    const waterH = barH * (0.5 + normTide * 0.45);

    ctx.fillStyle = "rgba(30,64,175,0.4)";
    ctx.fillRect(barX, barY, barW, barH);

    const waterGrad = ctx.createLinearGradient(barX, barY + barH - waterH, barX, barY + barH);
    waterGrad.addColorStop(0, "rgba(59,130,246,0.6)");
    waterGrad.addColorStop(1, "rgba(29,78,216,0.8)");
    ctx.fillStyle = waterGrad;
    ctx.fillRect(barX, barY + barH - waterH, barW, waterH);

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Mid-line (mean sea level)
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(barX - 5, barY + barH / 2);
    ctx.lineTo(barX + barW + 5, barY + barH / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MSL", barX + barW / 2, barY + barH / 2 - 4);
    ctx.fillText("Tide Level", barX + barW / 2, barY + barH + 15);

    // === Tide graph (bottom) ===
    if (showGraph && tideHistory.length > 2) {
      const gx = width * 0.06;
      const gy = height * 0.68;
      const gw = width * 0.88;
      const gh = height * 0.28;

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.roundRect(gx - 5, gy - 15, gw + 10, gh + 25, 8);
      ctx.fill();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Tide Height vs Time", gx + gw / 2, gy - 2);

      const maxVal = lunarInfluence + solarInfluence + 0.1;
      const midY = gy + gh / 2;

      // Axes
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx, gy + gh);
      ctx.lineTo(gx + gw, gy + gh);
      ctx.stroke();

      // Mean sea level line
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(148,163,184,0.3)";
      ctx.beginPath();
      ctx.moveTo(gx, midY);
      ctx.lineTo(gx + gw, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Lunar contribution
      ctx.strokeStyle = "rgba(148,163,184,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < tideHistory.length; i++) {
        const px = gx + (i / tideHistory.length) * gw;
        const h = simulatedHours - (tideHistory.length - i) * 0.5;
        const lunarOnly = lunarInfluence * Math.cos(TWO_PI * h / (LUNAR_PERIOD / 2));
        const py = midY - (lunarOnly / maxVal) * (gh / 2 - 5);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Combined tide curve
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < tideHistory.length; i++) {
        const px = gx + (i / tideHistory.length) * gw;
        const py = midY - (tideHistory[i] / maxVal) * (gh / 2 - 5);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Labels
      ctx.fillStyle = "#64748b"; ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right"; ctx.fillText("High", gx - 4, gy + 10);
      ctx.fillText("Low", gx - 4, gy + gh - 4);
      ctx.textAlign = "center"; ctx.fillText("Time (hours)", gx + gw / 2, gy + gh + 14);
      const totalHours = tideHistory.length * 0.5;
      const startHour = simulatedHours - totalHours;
      for (let h = Math.ceil(startHour / (LUNAR_MONTH / 4)) * (LUNAR_MONTH / 4); h < simulatedHours; h += LUNAR_MONTH / 4) {
        const phase = (h % LUNAR_MONTH) / LUNAR_MONTH;
        const px = gx + ((h - startHour) / totalHours) * gw;
        if (px > gx && px < gx + gw) {
          if (phase < 0.05 || (phase > 0.45 && phase < 0.55)) {
            ctx.fillStyle = "rgba(248,113,113,0.5)";
            ctx.fillText("S", px, gy + gh + 6);
          } else if ((phase > 0.2 && phase < 0.3) || (phase > 0.7 && phase < 0.8)) {
            ctx.fillStyle = "rgba(96,165,250,0.5)";
            ctx.fillText("N", px, gy + gh + 6);
          }
        }
      }

      // Legend
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#f87171";
      ctx.fillText("S = Spring tide", gx + gw - 140, gy + gh + 14);
      ctx.fillStyle = "#60a5fa";
      ctx.fillText("N = Neap tide", gx + gw - 60, gy + gh + 14);
    }
  }

  function reset(): void {
    time = 0;
    simulatedHours = 0;
    tideHistory = [];
  }

  function destroy(): void {
    tideHistory = [];
  }

  function getStateDescription(): string {
    const currentTide = getTideHeight(simulatedHours);
    const moonPhase = getMoonPhaseAngle(simulatedHours);
    const phaseFrac = moonPhase / TWO_PI;
    let phaseLabel = "";
    if (phaseFrac < 0.06 || phaseFrac > 0.94) phaseLabel = "New Moon (Spring Tide)";
    else if (phaseFrac < 0.31) phaseLabel = "First Quarter (Neap Tide)";
    else if (phaseFrac < 0.56) phaseLabel = "Full Moon (Spring Tide)";
    else if (phaseFrac < 0.81) phaseLabel = "Third Quarter (Neap Tide)";
    else phaseLabel = "Waning Crescent";

    return (
      `Tides: simulated time=${simulatedHours.toFixed(1)} hours (${(simulatedHours / 24).toFixed(1)} days). ` +
      `Current tide height=${currentTide.toFixed(2)} m. Moon phase: ${phaseLabel}. ` +
      `Lunar influence=${lunarInfluence}, solar influence=${solarInfluence}. ` +
      `Spring tides (Sun+Moon aligned) produce larger tidal range. ` +
      `Neap tides (Sun/Moon at 90°) produce smaller range. Semidiurnal period ≈ 12h 25min.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default TidesFactory;
