import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const HarmonicsOvertones: SimulationFactory = () => {
  const config = getSimConfig("harmonics-overtones")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let fundamentalFreq = 110; // Hz (low A)
  let stringLength = 1.0; // meters
  let tension = 100; // N
  let linearDensity = 0.001; // kg/m
  let time = 0;
  let activeHarmonics: boolean[] = [true, false, false, false, false, false]; // up to 6 harmonics
  let harmonicAmplitudes: number[] = [1.0, 0.5, 0.3, 0.2, 0.1, 0.05];

  // Visualization
  const maxPoints = 300;
  let stringPoints: number[] = new Array(maxPoints).fill(0);
  const numHarmonics = 6;

  // Colors
  const BG = "#0f172a";
  const FUNDAMENTAL_COLOR = "#ef4444";
  const HARMONIC_COLORS = [
    "#ef4444", // 1st (fundamental)
    "#f97316", // 2nd
    "#f59e0b", // 3rd
    "#10b981", // 4th
    "#06b6d4", // 5th
    "#8b5cf6", // 6th
  ];
  const SUM_COLOR = "#e2e8f0";
  const STRING_COLOR = "#64748b";
  const GRID_COLOR = "rgba(148, 163, 184, 0.2)";
  const TEXT_COLOR = "#e2e8f0";
  const NODE_COLOR = "#dc2626";

  function computePhysics(dt: number, params: Record<string, number>) {
    fundamentalFreq = params.fundamentalFreq ?? fundamentalFreq;
    stringLength = params.stringLength ?? stringLength;
    
    // Update which harmonics are active based on parameters
    for (let i = 0; i < numHarmonics; i++) {
      const paramKey = `harmonic${i + 1}`;
      if (params[paramKey] !== undefined) {
        activeHarmonics[i] = params[paramKey] > 0.5;
      }
    }

    // Update harmonic amplitudes
    for (let i = 0; i < numHarmonics; i++) {
      const paramKey = `amplitude${i + 1}`;
      if (params[paramKey] !== undefined) {
        harmonicAmplitudes[i] = params[paramKey];
      }
    }

    time += dt;

    // Calculate string displacement at each point
    for (let i = 0; i < maxPoints; i++) {
      const x = (i / (maxPoints - 1)) * stringLength;
      let displacement = 0;

      // Sum all active harmonics
      for (let n = 0; n < numHarmonics; n++) {
        if (!activeHarmonics[n]) continue;

        const harmonicNum = n + 1;
        const frequency = fundamentalFreq * harmonicNum;
        const wavelength = stringLength * 2 / harmonicNum; // λ = 2L/n for standing wave
        const amplitude = harmonicAmplitudes[n] * 0.1; // Scale down for display
        const omega = 2 * Math.PI * frequency;
        const k = 2 * Math.PI / wavelength;

        // Standing wave: y(x,t) = A * sin(kx) * cos(ωt)
        displacement += amplitude * Math.sin(k * x) * Math.cos(omega * time);
      }

      stringPoints[i] = displacement;
    }
  }

  function drawString() {
    const stringY = height * 0.3;
    const stringStartX = 80;
    const stringEndX = width - 80;
    const stringDisplayLength = stringEndX - stringStartX;
    const scale = 100;

    // Draw string equilibrium position
    ctx.strokeStyle = STRING_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(stringStartX, stringY);
    ctx.lineTo(stringEndX, stringY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw string fixed ends
    ctx.fillStyle = "#374151";
    ctx.fillRect(stringStartX - 8, stringY - 15, 16, 30);
    ctx.fillRect(stringEndX - 8, stringY - 15, 16, 30);
    
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.strokeRect(stringStartX - 8, stringY - 15, 16, 30);
    ctx.strokeRect(stringEndX - 8, stringY - 15, 16, 30);

    // Draw actual string displacement
    ctx.strokeStyle = SUM_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < maxPoints; i++) {
      const x = stringStartX + (i / (maxPoints - 1)) * stringDisplayLength;
      const y = stringY + stringPoints[i] * scale;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mark nodes (points that don't move)
    ctx.fillStyle = NODE_COLOR;
    for (let n = 1; n < numHarmonics; n++) {
      if (!activeHarmonics[n]) continue;
      
      const harmonicNum = n + 1;
      for (let nodeIndex = 1; nodeIndex < harmonicNum; nodeIndex++) {
        const nodePosition = (nodeIndex / harmonicNum) * stringLength;
        const nodeX = stringStartX + (nodePosition / stringLength) * stringDisplayLength;
        
        ctx.beginPath();
        ctx.arc(nodeX, stringY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("String Displacement", (stringStartX + stringEndX) / 2, stringY - 40);
    
    ctx.font = "10px monospace";
    ctx.fillText(`L = ${stringLength.toFixed(1)}m`, stringStartX, stringY + 25);
    ctx.fillText("Fixed end", stringStartX, stringY + 40);
    ctx.fillText("Fixed end", stringEndX, stringY + 40);

    // Node legend
    if (activeHarmonics.some((active, i) => active && i > 0)) {
      ctx.fillStyle = NODE_COLOR;
      ctx.beginPath();
      ctx.arc(stringEndX - 40, stringY - 20, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillText("Nodes", stringEndX - 32, stringY - 16);
    }
  }

  function drawIndividualHarmonics() {
    const plotStartY = height * 0.45;
    const plotHeight = height * 0.08;
    const plotStartX = 80;
    const plotWidth = width - 160;
    const scale = 30;

    for (let n = 0; n < numHarmonics; n++) {
      const plotY = plotStartY + n * plotHeight;
      const harmonicNum = n + 1;
      const frequency = fundamentalFreq * harmonicNum;

      // Background
      if (activeHarmonics[n]) {
        ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
        ctx.fillRect(plotStartX, plotY - plotHeight/2, plotWidth, plotHeight);
      }

      // Draw harmonic wave
      if (activeHarmonics[n]) {
        ctx.strokeStyle = HARMONIC_COLORS[n];
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let i = 0; i < maxPoints; i++) {
          const x = (i / (maxPoints - 1)) * stringLength;
          const k = (harmonicNum * Math.PI) / stringLength;
          const omega = 2 * Math.PI * frequency;
          const amplitude = harmonicAmplitudes[n] * 0.1;
          const displacement = amplitude * Math.sin(k * x) * Math.cos(omega * time);

          const plotX = plotStartX + (i / (maxPoints - 1)) * plotWidth;
          const plotYPos = plotY + displacement * scale;

          if (i === 0) ctx.moveTo(plotX, plotYPos);
          else ctx.lineTo(plotX, plotYPos);
        }
        ctx.stroke();
      }

      // Draw center line
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(plotStartX, plotY);
      ctx.lineTo(plotStartX + plotWidth, plotY);
      ctx.stroke();

      // Label
      ctx.fillStyle = activeHarmonics[n] ? HARMONIC_COLORS[n] : "#64748b";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      const harmonicName = n === 0 ? "Fundamental" : `${harmonicNum}${getOrdinalSuffix(harmonicNum)} Harmonic`;
      ctx.fillText(
        `${harmonicName}: f = ${frequency.toFixed(1)} Hz`,
        plotStartX + 5,
        plotY - plotHeight/2 + 12
      );

      // Show amplitude
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(
        `A = ${harmonicAmplitudes[n].toFixed(2)}`,
        plotStartX + plotWidth - 5,
        plotY - plotHeight/2 + 12
      );
    }
  }

  function getOrdinalSuffix(num: number): string {
    const suffixes = ["", "st", "nd", "rd"];
    const mod10 = num % 10;
    const mod100 = num % 100;
    
    if (mod100 >= 11 && mod100 <= 13) return "th";
    return suffixes[mod10] || "th";
  }

  function drawFrequencySpectrum() {
    const plotX = width * 0.65;
    const plotY = height * 0.45;
    const plotW = width * 0.3;
    const plotH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.fillRect(plotX, plotY, plotW, plotH);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // Draw frequency spikes
    const maxFreq = fundamentalFreq * numHarmonics;
    
    for (let n = 0; n < numHarmonics; n++) {
      if (!activeHarmonics[n]) continue;
      
      const harmonicNum = n + 1;
      const frequency = fundamentalFreq * harmonicNum;
      const amplitude = harmonicAmplitudes[n];
      
      const x = plotX + (frequency / maxFreq) * plotW;
      const spikeHeight = amplitude * plotH * 0.8;
      
      ctx.strokeStyle = HARMONIC_COLORS[n];
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, plotY + plotH);
      ctx.lineTo(x, plotY + plotH - spikeHeight);
      ctx.stroke();

      // Frequency labels
      ctx.fillStyle = HARMONIC_COLORS[n];
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.save();
      ctx.translate(x, plotY + plotH + 8);
      ctx.rotate(Math.PI / 4);
      ctx.fillText(`${frequency.toFixed(0)}Hz`, 0, 0);
      ctx.restore();
    }

    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Frequency Spectrum", plotX + plotW/2, plotY - 8);
    
    ctx.font = "10px monospace";
    ctx.fillText("Frequency →", plotX + plotW/2, plotY + plotH + 25);
    
    ctx.save();
    ctx.translate(plotX - 10, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Amplitude", 0, 0);
    ctx.restore();
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = height - 100;
    const panelW = width - 20;
    const panelH = 90;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 18;
    const lineHeight = 14;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    ctx.fillText(`Fundamental frequency: f₀ = ${fundamentalFreq.toFixed(1)} Hz (String length: ${stringLength.toFixed(1)}m)`, textX, textY);
    textY += lineHeight;

    const activeCount = activeHarmonics.filter(Boolean).length;
    ctx.fillText(`Active harmonics: ${activeCount}/${numHarmonics} | Standing wave pattern: y(x,t) = Σ Aₙsin(nπx/L)cos(nωt)`, textX, textY);
    textY += lineHeight;

    // Show active frequencies
    const activeFreqs = activeHarmonics
      .map((active, i) => active ? `${(fundamentalFreq * (i + 1)).toFixed(0)}Hz` : null)
      .filter(Boolean)
      .join(", ");
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(`Frequencies: ${activeFreqs}`, textX, textY);
    textY += lineHeight;

    // Wave physics
    const waveSpeed = Math.sqrt(tension / linearDensity);
    ctx.fillText(`Wave speed: v = √(T/μ) = ${waveSpeed.toFixed(1)} m/s | Wavelengths: λₙ = 2L/n`, textX, textY);
    textY += lineHeight;

    ctx.fillText(`For nth harmonic: fₙ = nf₀, λₙ = λ₀/n, with ${activeHarmonics.slice(1).filter(Boolean).length} nodes total`, textX, textY);
  }

  function drawWaveEquation() {
    const eqX = width * 0.65;
    const eqY = height * 0.75;

    ctx.fillStyle = "#a855f7";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Standing Wave Equation:", eqX, eqY);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText("y(x,t) = A sin(nπx/L) cos(nω₀t)", eqX, eqY + 20);
    ctx.fillText("where n = 1,2,3,... (harmonic number)", eqX, eqY + 35);
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText("• Nodes at x = kL/n (k=0,1,2,...,n)", eqX, eqY + 50);
    ctx.fillText("• Antinodes at x = (2k+1)L/2n", eqX, eqY + 62);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      stringPoints.fill(0);
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawString();
      drawIndividualHarmonics();
      drawFrequencySpectrum();
      drawWaveEquation();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      stringPoints.fill(0);
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const activeCount = activeHarmonics.filter(Boolean).length;
      const activeFreqs = activeHarmonics
        .map((active, i) => active ? fundamentalFreq * (i + 1) : null)
        .filter(Boolean);
      
      const waveSpeed = Math.sqrt(tension / linearDensity);
      
      return (
        `String harmonics simulation: Fundamental frequency f₀ = ${fundamentalFreq.toFixed(1)} Hz on ${stringLength.toFixed(1)}m string. ` +
        `${activeCount} harmonics active at frequencies: ${activeFreqs.map(f => f!.toFixed(0)).join(", ")} Hz. ` +
        `Standing wave patterns formed by constructive interference. Each harmonic has wavelength λₙ = 2L/n and frequency fₙ = nf₀. ` +
        `Wave speed v = ${waveSpeed.toFixed(1)} m/s. Nodes occur at multiples of λ/2 from fixed ends.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HarmonicsOvertones;