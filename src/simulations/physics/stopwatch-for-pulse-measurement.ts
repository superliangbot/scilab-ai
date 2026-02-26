import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const StopwatchPulseMeasurementFactory: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("stopwatch-for-pulse-measurement") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 0;
  let height = 0;
  let time = 0;

  let beatsToCount = 10;
  let showBPM = 1;
  let showHistory = 1;
  let avgWindow = 5;

  // Simulated heart
  const baseBPM = 72;
  let currentBPM = baseBPM;
  let heartPhase = 0;
  let lastBeatTime = 0;
  let beatCount = 0;
  let measureStartTime = 0;
  let measuring = false;
  let measuredBPMs: number[] = [];
  let heartScale = 1;
  let beatTimes: number[] = [];
  let pulseWaveData: number[] = [];
  const maxPulseData = 300;

  function init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    heartPhase = 0;
    lastBeatTime = 0;
    beatCount = 0;
    measureStartTime = 0;
    measuring = false;
    measuredBPMs = [];
    heartScale = 1;
    beatTimes = [];
    pulseWaveData = [];
    currentBPM = baseBPM;
  }

  function update(dt: number, params: Record<string, number>): void {
    const step = Math.min(dt, 0.033);
    beatsToCount = params.beatsToCount ?? 10;
    showBPM = params.showBPM ?? 1;
    showHistory = params.showHistory ?? 1;
    avgWindow = params.avgWindow ?? 5;
    time += step;

    // Vary heart rate slightly for realism
    currentBPM = baseBPM + 5 * Math.sin(time * 0.3) + 3 * Math.sin(time * 0.7);
    const beatInterval = 60 / currentBPM;

    heartPhase += step / beatInterval;

    // Detect beats
    if (heartPhase >= 1) {
      heartPhase -= 1;
      heartScale = 1.3;
      beatTimes.push(time);

      if (measuring) {
        beatCount++;
        if (beatCount >= beatsToCount) {
          const elapsed = time - measureStartTime;
          const bpm = (beatsToCount / elapsed) * 60;
          measuredBPMs.push(Math.round(bpm));
          if (measuredBPMs.length > 20) measuredBPMs.shift();
          measuring = false;
          beatCount = 0;
        }
      }
    }

    // Heart animation decay
    heartScale += (1 - heartScale) * step * 8;

    // Pulse wave signal
    const beatFrac = heartPhase;
    let pulseVal = 0;
    if (beatFrac < 0.1) {
      // QRS complex
      pulseVal = Math.sin(beatFrac * Math.PI / 0.1) * 1.0;
    } else if (beatFrac < 0.2) {
      // T wave
      pulseVal = Math.sin((beatFrac - 0.1) * Math.PI / 0.1) * 0.3;
    } else {
      pulseVal = 0;
    }
    pulseWaveData.push(pulseVal);
    if (pulseWaveData.length > maxPulseData) pulseWaveData.shift();

    // Auto-start measurement cycles
    if (!measuring && time > 1) {
      const lastMeasureEnd = measuredBPMs.length > 0 ? beatTimes[beatTimes.length - 1] : 0;
      if (time - lastMeasureEnd > 2 || measuredBPMs.length === 0) {
        measuring = true;
        measureStartTime = time;
        beatCount = 0;
      }
    }

    // Keep beatTimes manageable
    if (beatTimes.length > 100) beatTimes.splice(0, 50);
  }

  function drawHeart(cx: number, cy: number, size: number, scale: number): void {
    const s = size * scale;
    ctx.save(); ctx.translate(cx, cy);
    const glow = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 1.5);
    glow.addColorStop(0, `rgba(255,50,50,${(scale - 1) * 2})`);
    glow.addColorStop(1, "rgba(255,50,50,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2); ctx.fill();
    const grad = ctx.createRadialGradient(-s * 0.1, -s * 0.15, 0, 0, 0, s);
    grad.addColorStop(0, "#ff4444"); grad.addColorStop(0.5, "#cc0022"); grad.addColorStop(1, "#880011");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(-s * 0.1, s * 0.1, -s * 0.7, -s * 0.1, -s * 0.5, -s * 0.4);
    ctx.bezierCurveTo(-s * 0.3, -s * 0.7, 0, -s * 0.6, 0, -s * 0.3);
    ctx.bezierCurveTo(0, -s * 0.6, s * 0.3, -s * 0.7, s * 0.5, -s * 0.4);
    ctx.bezierCurveTo(s * 0.7, -s * 0.1, s * 0.1, s * 0.1, 0, s * 0.3);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function render(): void {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#1a0a1a");
    bgGrad.addColorStop(0.5, "#1a1025");
    bgGrad.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const leftW = width * 0.5;

    // Heart animation (left side, upper)
    const heartCx = leftW * 0.5;
    const heartCy = height * 0.25;
    drawHeart(heartCx, heartCy, 50, heartScale);

    // Stopwatch display
    const swCx = leftW * 0.5;
    const swCy = height * 0.55;
    const swR = Math.min(leftW * 0.3, height * 0.2);

    // Stopwatch face
    const swGrad = ctx.createRadialGradient(swCx, swCy, 0, swCx, swCy, swR);
    swGrad.addColorStop(0, "#2a2a3a"); swGrad.addColorStop(0.85, "#1a1a2a"); swGrad.addColorStop(1, "#333355");
    ctx.fillStyle = swGrad; ctx.beginPath(); ctx.arc(swCx, swCy, swR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#555577"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(swCx, swCy, swR, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const inner = swR * (isMajor ? 0.82 : 0.88), outer = swR * 0.93;
      ctx.strokeStyle = isMajor ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = isMajor ? 2 : 1; ctx.beginPath();
      ctx.moveTo(swCx + inner * Math.cos(a), swCy + inner * Math.sin(a));
      ctx.lineTo(swCx + outer * Math.cos(a), swCy + outer * Math.sin(a)); ctx.stroke();
    }

    const elapsed = measuring ? time - measureStartTime : 0;
    const secAngle = (elapsed % 60) / 60 * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = "#ff4444"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(swCx, swCy);
    ctx.lineTo(swCx + swR * 0.75 * Math.cos(secAngle), swCy + swR * 0.75 * Math.sin(secAngle));
    ctx.stroke();
    ctx.fillStyle = "#ff4444"; ctx.beginPath(); ctx.arc(swCx, swCy, 4, 0, Math.PI * 2); ctx.fill();
    const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
    ctx.fillStyle = measuring ? "#00ff88" : "#888";
    ctx.font = `bold ${Math.floor(swR * 0.28)}px monospace`; ctx.textAlign = "center";
    ctx.fillText(`${mins.toString().padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`, swCx, swCy + swR * 0.4);
    ctx.fillStyle = "#ffcc00"; ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText(measuring ? `Beat ${beatCount}/${beatsToCount}` : "Waiting...", swCx, swCy + swR * 0.6);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath();
    ctx.roundRect(10, height * 0.78, leftW - 20, 40, 6); ctx.fill();
    ctx.fillStyle = measuring ? "#00ff88" : "#aaa"; ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(measuring ? "MEASURING..." : "IDLE", leftW / 2, height * 0.78 + 25);

    // Right side: BPM and history
    const rightX = leftW + 10;
    const rightW = width - leftW - 20;

    if (showBPM > 0.5) {
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath();
      ctx.roundRect(rightX, 10, rightW, 80, 8); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui, sans-serif";
      ctx.textAlign = "left"; ctx.fillText("Heart Rate", rightX + 12, 30);
      if (measuredBPMs.length > 0) {
        const latest = measuredBPMs[measuredBPMs.length - 1];
        ctx.fillStyle = "#ff4444"; ctx.font = `bold ${Math.min(36, rightW * 0.18)}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.fillText(`${latest}`, rightX + rightW / 2, 65);
        ctx.fillStyle = "#ff8888"; ctx.font = "12px system-ui, sans-serif";
        ctx.fillText("BPM", rightX + rightW / 2, 82);
        const wnd = Math.min(avgWindow, measuredBPMs.length);
        const recent = measuredBPMs.slice(-wnd);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        ctx.fillStyle = "#aaddff"; ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "left"; ctx.fillText(`Avg (${wnd}): ${avg.toFixed(0)} BPM`, rightX + 12, 82);
      } else {
        ctx.fillStyle = "#666"; ctx.font = "bold 20px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.fillText("---", rightX + rightW / 2, 65);
      }
    }

    const graphY = 100, graphH = height * 0.3;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath();
    ctx.roundRect(rightX, graphY, rightW, graphH, 6); ctx.fill();
    ctx.fillStyle = "#888"; ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.fillText("Pulse Waveform", rightX + 8, graphY + 14);
    ctx.strokeStyle = "rgba(100,100,100,0.2)"; ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = graphY + 20 + (i / 4) * (graphH - 30);
      ctx.beginPath(); ctx.moveTo(rightX + 5, y); ctx.lineTo(rightX + rightW - 5, y); ctx.stroke();
    }
    if (pulseWaveData.length > 1) {
      const drawW = rightW - 20, drawH = graphH - 35, drawY0 = graphY + 20 + (graphH - 35) * 0.6;
      ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < pulseWaveData.length; i++) {
        const px = rightX + 10 + (i / maxPulseData) * drawW;
        const py = drawY0 - pulseWaveData[i] * drawH * 0.5;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const li = pulseWaveData.length - 1;
      ctx.fillStyle = "#00ff88"; ctx.beginPath();
      ctx.arc(rightX + 10 + (li / maxPulseData) * drawW, drawY0 - pulseWaveData[li] * drawH * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // History graph
    if (showHistory > 0.5 && measuredBPMs.length > 0) {
      const histY = graphY + graphH + 15;
      const histH = height - histY - 15;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.roundRect(rightX, histY, rightW, histH, 6);
      ctx.fill();

      ctx.fillStyle = "#888";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("BPM History", rightX + 8, histY + 14);

      const barW = Math.min(20, (rightW - 30) / Math.max(measuredBPMs.length, 1));
      const chartH = histH - 30;
      const chartY = histY + 22;
      const maxBPM = Math.max(...measuredBPMs, 100);
      const minBPM = Math.min(...measuredBPMs, 50);
      const range = Math.max(maxBPM - minBPM + 10, 30);

      for (let i = 0; i < measuredBPMs.length; i++) {
        const bpm = measuredBPMs[i];
        const barH = ((bpm - minBPM + 5) / range) * chartH;
        const bx = rightX + 15 + i * (barW + 2);
        const by = chartY + chartH - barH;

        // Color by BPM range
        let barColor = "#4caf50";
        if (bpm > 100) barColor = "#ff5722";
        else if (bpm > 85) barColor = "#ff9800";
        else if (bpm < 60) barColor = "#2196f3";

        const bGrad = ctx.createLinearGradient(bx, by, bx, chartY + chartH);
        bGrad.addColorStop(0, barColor);
        bGrad.addColorStop(1, "rgba(0,0,0,0.3)");
        ctx.fillStyle = bGrad;
        ctx.fillRect(bx, by, barW, barH);

        // BPM value on top
        if (barW >= 14) {
          ctx.fillStyle = "#ddd";
          ctx.font = "8px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${bpm}`, bx + barW / 2, by - 3);
        }
      }

      // Average line
      const window = Math.min(avgWindow, measuredBPMs.length);
      const recentBPMs = measuredBPMs.slice(-window);
      const avg = recentBPMs.reduce((a, b) => a + b, 0) / recentBPMs.length;
      const avgY = chartY + chartH - ((avg - minBPM + 5) / range) * chartH;
      ctx.strokeStyle = "rgba(255,255,100,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(rightX + 10, avgY);
      ctx.lineTo(rightX + rightW - 10, avgY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#ffff88";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`avg: ${avg.toFixed(0)}`, rightX + rightW - 10, avgY - 4);
    }

    // Title
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.roundRect(10, height * 0.88, leftW - 20, 28, 4);
    ctx.fill();
    ctx.fillStyle = "#ff8888";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pulse Measurement Stopwatch", leftW / 2, height * 0.88 + 18);
  }

  function reset(): void {
    time = 0;
    heartPhase = 0;
    lastBeatTime = 0;
    beatCount = 0;
    measureStartTime = 0;
    measuring = false;
    measuredBPMs = [];
    heartScale = 1;
    beatTimes = [];
    pulseWaveData = [];
  }

  function destroy(): void {
    measuredBPMs = [];
    beatTimes = [];
    pulseWaveData = [];
  }

  function getStateDescription(): string {
    const latest = measuredBPMs.length > 0 ? measuredBPMs[measuredBPMs.length - 1] : 0;
    const window = Math.min(avgWindow, measuredBPMs.length);
    const recentBPMs = measuredBPMs.slice(-window);
    const avg = recentBPMs.length > 0 ? recentBPMs.reduce((a, b) => a + b, 0) / recentBPMs.length : 0;
    return (
      `Pulse measurement stopwatch: counting ${beatsToCount} beats per measurement. ` +
      `Latest BPM: ${latest || "N/A"}, Average (last ${window}): ${avg ? avg.toFixed(0) : "N/A"} BPM. ` +
      `${measuredBPMs.length} measurements taken. ` +
      `${measuring ? "Currently measuring..." : "Waiting for next measurement."} ` +
      `Normal resting heart rate: 60-100 BPM.`
    );
  }

  function resize(w: number, h: number): void {
    width = w;
    height = h;
  }

  return { config, init, update, render, reset, destroy, getStateDescription, resize };
};

export default StopwatchPulseMeasurementFactory;
