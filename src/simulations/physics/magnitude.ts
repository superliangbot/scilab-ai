import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const MagnitudeFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("magnitude") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  // Parameters
  let magnitude = 5;
  let depthKm = 30;
  let showWaves = 1;
  let showComparison = 1;

  // Seismic wave state
  interface Wave {
    radius: number;
    type: "P" | "S";
    birthTime: number;
    amplitude: number;
  }
  let waves: Wave[] = [];
  const WAVE_INTERVAL = 0.6; // seconds between new wave fronts
  let lastWaveTime = 0;

  // Seismograph trace buffer
  const TRACE_LENGTH = 300;
  let traceData: number[] = [];

  // Earth cross-section geometry (computed on init/resize)
  let earthCenterX = 0;
  let earthCenterY = 0;
  let earthRadius = 0;
  let focusX = 0;
  let focusY = 0;
  let epicenterX = 0;
  let epicenterY = 0;
  let surfaceY = 0;

  function computeGeometry(): void {
    surfaceY = height * 0.5;
    earthCenterX = width * 0.35;
    earthCenterY = surfaceY;
    earthRadius = Math.min(width * 0.3, height * 0.38);

    // Focus (hypocenter) is below surface at specified depth
    const maxDepthPx = earthRadius * 0.85;
    const depthFraction = Math.min(depthKm / 300, 1);
    const depthPx = depthFraction * maxDepthPx;
    focusX = earthCenterX;
    focusY = surfaceY + depthPx;
    epicenterX = earthCenterX;
    epicenterY = surfaceY;
  }

  // P-wave speed ~6 km/s, S-wave speed ~3.5 km/s (visual scale)
  const P_WAVE_SPEED = 120; // px/s
  const S_WAVE_SPEED = 70;  // px/s

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    lastWaveTime = 0;
    waves = [];
    traceData = new Array(TRACE_LENGTH).fill(0);
    computeGeometry();
  }

  function update(dt: number, params: Record<string, number>): void {
    time += dt;
    magnitude = params.magnitude ?? 5;
    depthKm = params.depth ?? 30;
    showWaves = params.showWaves ?? 1;
    showComparison = params.showComparison ?? 1;

    computeGeometry();

    // Emit new wave fronts periodically
    if (time - lastWaveTime > WAVE_INTERVAL) {
      lastWaveTime = time;
      const amp = Math.pow(10, (magnitude - 1) / 3); // scaled amplitude
      waves.push({ radius: 0, type: "P", birthTime: time, amplitude: amp });
      waves.push({ radius: 0, type: "S", birthTime: time, amplitude: amp });
    }

    // Update wave radii
    for (const w of waves) {
      const age = time - w.birthTime;
      const speed = w.type === "P" ? P_WAVE_SPEED : S_WAVE_SPEED;
      w.radius = age * speed;
    }

    // Remove waves that have expanded beyond the visible area
    const maxRadius = Math.max(width, height) * 1.5;
    waves = waves.filter((w) => w.radius < maxRadius);

    // Generate seismograph trace
    const baseAmplitude = Math.pow(10, (magnitude - 1) / 2) * 0.3;
    const noiseScale = baseAmplitude * (0.5 + 0.5 * Math.sin(time * 8));
    const highFreq = Math.sin(time * 25) * baseAmplitude * 0.7;
    const medFreq = Math.sin(time * 12) * baseAmplitude * 0.4;
    const lowFreq = Math.sin(time * 3) * baseAmplitude * 0.15;
    const jitter = (Math.random() - 0.5) * noiseScale * 0.3;
    const sample = highFreq + medFreq + lowFreq + jitter;
    traceData.push(sample);
    if (traceData.length > TRACE_LENGTH) traceData.shift();
  }

  function drawEarthCrossSection(): void {
    // Background: sky above surface, earth below
    ctx.fillStyle = "#87ceeb";
    ctx.fillRect(0, 0, width, surfaceY);

    // Earth layers (simplified cross-section)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, surfaceY, width * 0.7, height - surfaceY);
    ctx.clip();

    // Crust
    const gradient = ctx.createLinearGradient(0, surfaceY, 0, height);
    gradient.addColorStop(0, "#8B7355");
    gradient.addColorStop(0.15, "#A0522D");
    gradient.addColorStop(0.4, "#CD853F");
    gradient.addColorStop(0.7, "#D2691E");
    gradient.addColorStop(1.0, "#FF4500");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, surfaceY, width * 0.7, height - surfaceY);

    // Surface grass layer
    ctx.fillStyle = "#4a7c3f";
    ctx.fillRect(0, surfaceY - 3, width * 0.7, 6);

    // Rock texture lines
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      const ly = surfaceY + (height - surfaceY) * (i / 6);
      ctx.beginPath();
      ctx.moveTo(0, ly);
      for (let x = 0; x < width * 0.7; x += 20) {
        ctx.lineTo(x, ly + Math.sin(x * 0.05 + i) * 3);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Layer labels
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `${Math.max(10, height * 0.02)}px sans-serif`;
    ctx.textAlign = "left";
    const labelX = 8;
    ctx.fillText("Crust", labelX, surfaceY + 25);
    ctx.fillText("Upper Mantle", labelX, surfaceY + (height - surfaceY) * 0.3);
    ctx.fillText("Lower Mantle", labelX, surfaceY + (height - surfaceY) * 0.6);
  }

  function drawFocusAndEpicenter(): void {
    // Focus (hypocenter) - star shape
    ctx.save();
    ctx.translate(focusX, focusY);
    const pulseScale = 1 + 0.2 * Math.sin(time * 4);
    ctx.scale(pulseScale, pulseScale);

    // Glowing effect
    const glowRadius = 12 + magnitude * 2;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    glow.addColorStop(0, "rgba(255, 50, 0, 0.8)");
    glow.addColorStop(0.5, "rgba(255, 100, 0, 0.3)");
    glow.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Star
    ctx.fillStyle = "#ff3300";
    ctx.beginPath();
    const starR = 6 + magnitude * 0.8;
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const method = i === 0 ? "moveTo" : "lineTo";
      ctx[method](Math.cos(angle) * starR, Math.sin(angle) * starR);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Label: Focus
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(11, height * 0.022)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Focus", focusX + 18, focusY + 4);
    ctx.font = `${Math.max(9, height * 0.017)}px sans-serif`;
    ctx.fillText(`Depth: ${depthKm.toFixed(0)} km`, focusX + 18, focusY + 20);

    // Epicenter on surface
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.arc(epicenterX, epicenterY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff6600";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(focusX, focusY);
    ctx.lineTo(epicenterX, epicenterY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label: Epicenter
    ctx.fillStyle = "#333";
    ctx.font = `bold ${Math.max(11, height * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Epicenter", epicenterX, epicenterY - 12);
  }

  function drawSeismicWaves(): void {
    if (!showWaves) return;

    for (const w of waves) {
      const maxVisibleRadius = earthRadius * 1.8;
      if (w.radius > maxVisibleRadius) continue;

      const alpha = Math.max(0, 1 - w.radius / maxVisibleRadius) * 0.6;
      if (w.type === "P") {
        ctx.strokeStyle = `rgba(0, 100, 255, ${alpha})`;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
      }

      ctx.beginPath();
      ctx.arc(focusX, focusY, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Wave legend
    const legendX = width * 0.01;
    const legendY = height * 0.92;
    const fontSize = Math.max(10, height * 0.02);
    ctx.font = `${fontSize}px sans-serif`;

    ctx.strokeStyle = "rgba(0, 100, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.textAlign = "left";
    ctx.fillText("P-waves (primary, faster)", legendX + 25, legendY + 4);

    ctx.strokeStyle = "rgba(255, 50, 50, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY + 18);
    ctx.lineTo(legendX + 20, legendY + 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText("S-waves (secondary, slower)", legendX + 25, legendY + 22);
  }

  function drawSeismograph(): void {
    const graphX = width * 0.58;
    const graphY = height * 0.05;
    const graphW = width * 0.38;
    const graphH = height * 0.3;

    // Background
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // Title
    ctx.fillStyle = "#333";
    ctx.font = `bold ${Math.max(11, height * 0.022)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Seismograph Trace", graphX + graphW / 2, graphY + 18);

    // Center line
    const centerY = graphY + graphH / 2;
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(graphX + 5, centerY);
    ctx.lineTo(graphX + graphW - 5, centerY);
    ctx.stroke();

    // Draw trace
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const maxAmp = graphH * 0.4;
    // Normalize amplitude for display
    const displayScale = Math.min(1, 30 / Math.pow(10, (magnitude - 1) / 2));
    for (let i = 0; i < traceData.length; i++) {
      const x = graphX + 5 + (i / TRACE_LENGTH) * (graphW - 10);
      const y = centerY - traceData[i] * displayScale * (maxAmp / 15);
      const clampedY = Math.max(graphY + 25, Math.min(graphY + graphH - 5, y));
      if (i === 0) ctx.moveTo(x, clampedY);
      else ctx.lineTo(x, clampedY);
    }
    ctx.stroke();

    // Magnitude label
    ctx.fillStyle = "#c00";
    ctx.font = `bold ${Math.max(13, height * 0.028)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`M ${magnitude.toFixed(1)}`, graphX + 8, graphY + graphH - 8);
  }

  function drawComparisonPanel(): void {
    if (!showComparison) return;

    const panelX = width * 0.58;
    const panelY = height * 0.4;
    const panelW = width * 0.38;
    const panelH = height * 0.55;

    // Background
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const fontSize = Math.max(10, Math.min(height * 0.019, 13));
    const titleSize = Math.max(11, Math.min(height * 0.023, 14));
    ctx.font = `bold ${titleSize}px sans-serif`;
    ctx.fillStyle = "#333";
    ctx.textAlign = "center";
    ctx.fillText("Richter Scale Comparison", panelX + panelW / 2, panelY + 20);

    // Energy comparison text
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "left";
    const mag = Math.round(magnitude);
    const energyRatio = Math.pow(31.6, 1).toFixed(1);
    ctx.fillStyle = "#555";
    const infoY = panelY + 40;
    ctx.fillText(`Each whole magnitude = 10x amplitude`, panelX + 10, infoY);
    ctx.fillText(`Each whole magnitude = ~${energyRatio}x energy`, panelX + 10, infoY + 16);

    if (mag > 1) {
      ctx.fillStyle = "#c00";
      ctx.font = `bold ${fontSize}px sans-serif`;
      const totalEnergy = Math.pow(31.6, mag - 1).toExponential(1);
      ctx.fillText(
        `M${mag} releases ~${totalEnergy}x more energy than M1`,
        panelX + 10,
        infoY + 36
      );
    }

    // Bar chart: amplitude comparison for magnitudes 1-10
    const chartX = panelX + 15;
    const chartY = infoY + 58;
    const chartW = panelW - 30;
    const chartH = panelH - (chartY - panelY) - 20;
    const barCount = 10;
    const barGap = 3;
    const barW = (chartW - barGap * (barCount - 1)) / barCount;

    // Use logarithmic display for bars
    const maxLog = Math.log10(Math.pow(10, 9)); // magnitude 10 amplitude relative to 1
    for (let m = 1; m <= barCount; m++) {
      const logAmp = m - 1; // log10 of relative amplitude
      const barH = (logAmp / maxLog) * (chartH - 20);
      const bx = chartX + (m - 1) * (barW + barGap);
      const by = chartY + chartH - barH;

      // Color by severity
      let color: string;
      if (m <= 2) color = "#4CAF50";
      else if (m <= 4) color = "#FFC107";
      else if (m <= 6) color = "#FF9800";
      else if (m <= 8) color = "#FF5722";
      else color = "#B71C1C";

      // Highlight current magnitude
      if (Math.abs(m - mag) < 0.5) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.shadowBlur = 0;
      }

      if (barH > 0) {
        ctx.fillRect(bx, by, barW, barH);
      }

      // Magnitude label
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#333";
      ctx.font = `${Math.max(8, fontSize - 2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${m}`, bx + barW / 2, chartY + chartH + 12);
    }

    // Axis label
    ctx.fillStyle = "#666";
    ctx.font = `${Math.max(9, fontSize - 1)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Magnitude (log scale amplitude)", panelX + panelW / 2, chartY + chartH + 26);

    // Damage descriptions
    const damageY = chartY - 16;
    ctx.font = `italic ${Math.max(9, fontSize - 1)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#666";

    const descriptions: Record<number, string> = {
      1: "Micro - not felt",
      2: "Minor - rarely felt",
      3: "Minor - often felt, no damage",
      4: "Light - noticeable shaking",
      5: "Moderate - some damage",
      6: "Strong - moderate damage",
      7: "Major - serious damage",
      8: "Great - severe damage",
      9: "Great - devastating",
      10: "Epic - near total destruction",
    };

    if (descriptions[mag]) {
      ctx.fillStyle = "#c00";
      ctx.font = `bold italic ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        `M${mag}: ${descriptions[mag]}`,
        panelX + panelW / 2,
        damageY
      );
    }

    // Building damage icons
    drawBuildingDamage(panelX + panelW * 0.1, chartY + chartH + 36, panelW * 0.8, panelH - (chartY + chartH + 36 - panelY) - 10, mag);
  }

  function drawBuildingDamage(x: number, y: number, w: number, h: number, mag: number): void {
    if (h < 20) return;

    const buildingW = Math.min(25, w / 5);
    const buildingH = Math.min(h - 5, 40);
    const gap = (w - buildingW * 4) / 3;

    for (let i = 0; i < 4; i++) {
      const bx = x + i * (buildingW + gap);
      const by = y + h - buildingH;

      // Building shake offset based on magnitude
      const shakeAmplitude = mag > 3 ? (mag - 3) * 1.5 : 0;
      const shakeX = shakeAmplitude * Math.sin(time * 8 + i * 1.5);
      const tilt = mag > 5 ? (mag - 5) * 0.02 * Math.sin(time * 3 + i) : 0;

      ctx.save();
      ctx.translate(bx + buildingW / 2 + shakeX, by + buildingH);
      ctx.rotate(tilt);

      // Building body
      const damage = Math.max(0, (mag - 4) / 6);
      const r = Math.floor(150 + damage * 100);
      const g = Math.floor(150 - damage * 100);
      const b = Math.floor(150 - damage * 100);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(-buildingW / 2, -buildingH, buildingW, buildingH);

      // Windows
      ctx.fillStyle = mag > 6 + i ? "#444" : "#88ccff";
      const winSize = 4;
      for (let wy = 0; wy < 3; wy++) {
        for (let wx = 0; wx < 2; wx++) {
          const winX = -buildingW / 2 + 3 + wx * (buildingW - 6 - winSize);
          const winY = -buildingH + 5 + wy * (buildingH / 3);
          ctx.fillRect(winX, winY, winSize, winSize);
        }
      }

      // Cracks for high magnitude
      if (mag > 5 + i) {
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-buildingW / 4, -buildingH * 0.7);
        ctx.lineTo(0, -buildingH * 0.4);
        ctx.lineTo(buildingW / 4, -buildingH * 0.2);
        ctx.stroke();
      }

      // Rubble for very high magnitude
      if (mag > 7 + i) {
        ctx.fillStyle = "#888";
        for (let ri = 0; ri < 5; ri++) {
          const rx = (Math.sin(ri * 3.7 + i) * buildingW) / 2;
          const ry = 2 + Math.abs(Math.sin(ri * 2.3)) * 8;
          ctx.fillRect(rx - 2, ry - 2, 4, 4);
        }
      }

      ctx.restore();
    }
  }

  function drawInfoOverlay(): void {
    const fontSize = Math.max(11, height * 0.022);

    // Title
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = `bold ${Math.max(14, height * 0.032)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText("Earthquake Magnitude", 10, 25);

    // Richter formula
    ctx.fillStyle = "#444";
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillText(`Richter Scale: M = log\u2081\u2080(A) + correction`, 10, 48);
    ctx.fillText(`Magnitude: ${magnitude.toFixed(1)}  |  Depth: ${depthKm.toFixed(0)} km`, 10, 68);

    // Energy calculation
    const relEnergy = Math.pow(31.6, magnitude - 1);
    const energyJoules = 6.3e4 * Math.pow(10, 1.5 * magnitude); // Gutenberg-Richter relation
    ctx.fillText(
      `Energy: ~${energyJoules.toExponential(1)} J (${relEnergy.toExponential(1)}x M1)`,
      10,
      88
    );
  }

  function render(): void {
    // Clear
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, width, height);

    drawEarthCrossSection();
    drawSeismicWaves();
    drawFocusAndEpicenter();
    drawSeismograph();
    drawComparisonPanel();
    drawInfoOverlay();
  }

  function reset(): void {
    time = 0;
    lastWaveTime = 0;
    waves = [];
    traceData = new Array(TRACE_LENGTH).fill(0);
  }

  function destroy(): void {
    waves = [];
    traceData = [];
  }

  function getStateDescription(): string {
    const mag = magnitude.toFixed(1);
    const desc =
      magnitude < 3 ? "micro earthquake, generally not felt" :
      magnitude < 5 ? "light earthquake, felt by many" :
      magnitude < 7 ? "strong earthquake, causing damage" :
      "major/great earthquake, severe destruction";
    const energyFactor = Math.pow(31.6, Math.round(magnitude) - 1).toExponential(1);
    return `Simulating a magnitude ${mag} earthquake at ${depthKm.toFixed(0)} km depth. ` +
      `This is a ${desc}. The Richter scale is logarithmic: each whole number increase ` +
      `means 10x larger amplitude and ~31.6x more energy. M${Math.round(magnitude)} releases ` +
      `${energyFactor}x more energy than M1. P-waves (compression) travel ~6 km/s, ` +
      `S-waves (shear) travel ~3.5 km/s. The focus is the underground origin; ` +
      `the epicenter is directly above on the surface.`;
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
    computeGeometry();
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default MagnitudeFactory;
