import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const BeatFrequency: SimulationFactory = () => {
  const config = getSimConfig("beat-frequency")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let freq1 = 440; // Hz (A4 note)
  let freq2 = 442; // Hz (slightly detuned)
  let amplitude1 = 1.0;
  let amplitude2 = 1.0;
  let time = 0;

  // Visualization data
  let waveHistory: { time: number; wave1: number; wave2: number; sum: number }[] = [];
  const historyDuration = 3; // seconds of history to keep
  const maxHistoryPoints = 1000;

  // Colors
  const BG = "#0f172a";
  const WAVE1_COLOR = "#ef4444";
  const WAVE2_COLOR = "#3b82f6";
  const SUM_COLOR = "#10b981";
  const BEAT_COLOR = "#f59e0b";
  const GRID_COLOR = "rgba(148, 163, 184, 0.2)";
  const TEXT_COLOR = "#e2e8f0";
  const ENVELOPE_COLOR = "#a855f7";

  function computePhysics(dt: number, params: Record<string, number>) {
    freq1 = params.freq1 ?? freq1;
    freq2 = params.freq2 ?? freq2;
    amplitude1 = params.amplitude1 ?? amplitude1;
    amplitude2 = params.amplitude2 ?? amplitude2;

    time += dt;

    // Calculate current wave values
    const omega1 = 2 * Math.PI * freq1;
    const omega2 = 2 * Math.PI * freq2;
    
    const wave1 = amplitude1 * Math.sin(omega1 * time);
    const wave2 = amplitude2 * Math.sin(omega2 * time);
    const sum = wave1 + wave2;

    // Add to history
    waveHistory.push({ time, wave1, wave2, sum });

    // Trim history
    const cutoffTime = time - historyDuration;
    waveHistory = waveHistory.filter(point => point.time >= cutoffTime);
    if (waveHistory.length > maxHistoryPoints) {
      waveHistory = waveHistory.slice(-maxHistoryPoints);
    }
  }

  function drawWaves() {
    const plotHeight = height * 0.15;
    const plotWidth = width - 100;
    const plotX = 50;
    
    // Draw three plots: wave1, wave2, and sum
    const plots = [
      { y: height * 0.12, color: WAVE1_COLOR, data: 'wave1' as const, label: 'Wave 1' },
      { y: height * 0.32, color: WAVE2_COLOR, data: 'wave2' as const, label: 'Wave 2' },
      { y: height * 0.52, color: SUM_COLOR, data: 'sum' as const, label: 'Sum (Beats)' },
    ];

    plots.forEach((plot, index) => {
      const plotY = plot.y;
      const centerY = plotY + plotHeight / 2;

      // Background
      ctx.fillStyle = "rgba(30, 41, 59, 0.2)";
      ctx.fillRect(plotX, plotY, plotWidth, plotHeight);
      
      // Grid
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      
      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(plotX, centerY);
      ctx.lineTo(plotX + plotWidth, centerY);
      ctx.stroke();

      // Vertical grid lines (time markers)
      for (let i = 0; i <= 10; i++) {
        const x = plotX + (i / 10) * plotWidth;
        ctx.beginPath();
        ctx.moveTo(x, plotY);
        ctx.lineTo(x, plotY + plotHeight);
        ctx.stroke();
      }

      // Draw wave
      if (waveHistory.length > 1) {
        const timeRange = Math.max(1, waveHistory[waveHistory.length - 1].time - waveHistory[0].time);
        const scale = (plotHeight / 2) * 0.8;
        
        ctx.strokeStyle = plot.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        waveHistory.forEach((point, i) => {
          const relativeTime = point.time - waveHistory[0].time;
          const x = plotX + plotWidth - (timeRange - relativeTime) / timeRange * plotWidth;
          const y = centerY - point[plot.data] * scale;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw envelope for sum plot (beat pattern)
        if (plot.data === 'sum') {
          const beatFreq = Math.abs(freq1 - freq2);
          const avgAmplitude = (amplitude1 + amplitude2) / 2;
          
          ctx.strokeStyle = ENVELOPE_COLOR;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();

          // Upper envelope
          for (let i = 0; i < plotWidth; i++) {
            const x = plotX + i;
            const relativeTime = timeRange * (1 - i / plotWidth);
            const envelopeTime = waveHistory[waveHistory.length - 1].time - relativeTime;
            const envelope = avgAmplitude * 2 * Math.abs(Math.cos(Math.PI * beatFreq * envelopeTime));
            const y = centerY - envelope * scale;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          
          // Lower envelope
          for (let i = plotWidth - 1; i >= 0; i--) {
            const x = plotX + i;
            const relativeTime = timeRange * (1 - i / plotWidth);
            const envelopeTime = waveHistory[waveHistory.length - 1].time - relativeTime;
            const envelope = avgAmplitude * 2 * Math.abs(Math.cos(Math.PI * beatFreq * envelopeTime));
            const y = centerY + envelope * scale;
            
            ctx.lineTo(x, y);
          }
          
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Label
      ctx.fillStyle = plot.color;
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(plot.label, plotX + 5, plotY + 15);
      
      // Frequency label
      if (plot.data === 'wave1') {
        ctx.fillText(`f₁ = ${freq1.toFixed(1)} Hz`, plotX + plotWidth - 120, plotY + 15);
      } else if (plot.data === 'wave2') {
        ctx.fillText(`f₂ = ${freq2.toFixed(1)} Hz`, plotX + plotWidth - 120, plotY + 15);
      } else {
        const beatFreq = Math.abs(freq1 - freq2);
        ctx.fillText(`Beat freq = ${beatFreq.toFixed(2)} Hz`, plotX + plotWidth - 150, plotY + 15);
      }
    });
  }

  function drawPhasorDiagram() {
    const centerX = width * 0.75;
    const centerY = height * 0.78;
    const radius = 50;

    // Background circle
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw reference axes
    ctx.strokeStyle = GRID_COLOR;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();
    ctx.setLineDash([]);

    // Calculate phasor angles
    const omega1 = 2 * Math.PI * freq1;
    const omega2 = 2 * Math.PI * freq2;
    const angle1 = omega1 * time;
    const angle2 = omega2 * time;

    // Draw phasor 1
    const phasor1X = centerX + amplitude1 * radius * 0.8 * Math.cos(angle1);
    const phasor1Y = centerY - amplitude1 * radius * 0.8 * Math.sin(angle1);
    
    ctx.strokeStyle = WAVE1_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(phasor1X, phasor1Y);
    ctx.stroke();
    
    ctx.fillStyle = WAVE1_COLOR;
    ctx.beginPath();
    ctx.arc(phasor1X, phasor1Y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw phasor 2
    const phasor2X = centerX + amplitude2 * radius * 0.8 * Math.cos(angle2);
    const phasor2Y = centerY - amplitude2 * radius * 0.8 * Math.sin(angle2);
    
    ctx.strokeStyle = WAVE2_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(phasor2X, phasor2Y);
    ctx.stroke();
    
    ctx.fillStyle = WAVE2_COLOR;
    ctx.beginPath();
    ctx.arc(phasor2X, phasor2Y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw resultant phasor (vector sum)
    const resultX = phasor1X + phasor2X - centerX;
    const resultY = phasor1Y + phasor2Y - centerY;
    
    ctx.strokeStyle = SUM_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(resultX, resultY);
    ctx.stroke();
    
    ctx.fillStyle = SUM_COLOR;
    ctx.beginPath();
    ctx.arc(resultX, resultY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw dashed lines showing vector addition
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(phasor1X, phasor1Y);
    ctx.lineTo(resultX, resultY);
    ctx.moveTo(phasor2X, phasor2Y);
    ctx.lineTo(resultX, resultY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Phasor Diagram", centerX, centerY + radius + 20);
    
    ctx.font = "10px monospace";
    ctx.fillStyle = WAVE1_COLOR;
    ctx.fillText("A₁", phasor1X + 10, phasor1Y - 5);
    ctx.fillStyle = WAVE2_COLOR;
    ctx.fillText("A₂", phasor2X + 10, phasor2Y - 5);
    ctx.fillStyle = SUM_COLOR;
    ctx.fillText("A₁+A₂", resultX + 10, resultY - 5);
  }

  function drawFrequencySpectrum() {
    const plotX = width * 0.05;
    const plotY = height * 0.72;
    const plotW = width * 0.4;
    const plotH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.fillRect(plotX, plotY, plotW, plotH);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // Frequency range
    const avgFreq = (freq1 + freq2) / 2;
    const freqRange = Math.max(20, Math.abs(freq1 - freq2) * 3);
    const minFreq = avgFreq - freqRange;
    const maxFreq = avgFreq + freqRange;

    // Draw frequency axes
    ctx.strokeStyle = GRID_COLOR;
    for (let i = 0; i <= 5; i++) {
      const freq = minFreq + (maxFreq - minFreq) * i / 5;
      const x = plotX + plotW * i / 5;
      
      ctx.beginPath();
      ctx.moveTo(x, plotY);
      ctx.lineTo(x, plotY + plotH);
      ctx.stroke();
      
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${freq.toFixed(0)}`, x, plotY + plotH + 12);
    }

    // Draw frequency spikes
    const spike1X = plotX + plotW * (freq1 - minFreq) / (maxFreq - minFreq);
    const spike2X = plotX + plotW * (freq2 - minFreq) / (maxFreq - minFreq);

    if (spike1X >= plotX && spike1X <= plotX + plotW) {
      ctx.strokeStyle = WAVE1_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(spike1X, plotY + plotH);
      ctx.lineTo(spike1X, plotY + plotH * 0.2);
      ctx.stroke();
    }

    if (spike2X >= plotX && spike2X <= plotX + plotW) {
      ctx.strokeStyle = WAVE2_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(spike2X, plotY + plotH);
      ctx.lineTo(spike2X, plotY + plotH * 0.2);
      ctx.stroke();
    }

    // Beat frequency indicators (at f₁±f₂)
    const beatFreq = Math.abs(freq1 - freq2);
    if (beatFreq > 0.1) {
      const beatX1 = plotX + plotW * (avgFreq - beatFreq/2 - minFreq) / (maxFreq - minFreq);
      const beatX2 = plotX + plotW * (avgFreq + beatFreq/2 - minFreq) / (maxFreq - minFreq);
      
      ctx.strokeStyle = BEAT_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      
      if (beatX1 >= plotX && beatX1 <= plotX + plotW) {
        ctx.beginPath();
        ctx.moveTo(beatX1, plotY + plotH);
        ctx.lineTo(beatX1, plotY + plotH * 0.6);
        ctx.stroke();
      }
      
      if (beatX2 >= plotX && beatX2 <= plotX + plotW) {
        ctx.beginPath();
        ctx.moveTo(beatX2, plotY + plotH);
        ctx.lineTo(beatX2, plotY + plotH * 0.6);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }

    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Frequency Spectrum", plotX + plotW/2, plotY - 8);
    
    ctx.font = "10px monospace";
    ctx.fillText("Frequency (Hz)", plotX + plotW/2, plotY + plotH + 25);
    
    ctx.save();
    ctx.translate(plotX - 15, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Amplitude", 0, 0);
    ctx.restore();
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = height - 75;
    const panelW = width - 20;
    const panelH = 65;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 18;
    const lineHeight = 15;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    const beatFreq = Math.abs(freq1 - freq2);
    const beatPeriod = beatFreq > 0 ? 1 / beatFreq : Infinity;

    ctx.fillText(`Beat frequency: |f₁ - f₂| = |${freq1.toFixed(1)} - ${freq2.toFixed(1)}| = ${beatFreq.toFixed(2)} Hz`, textX, textY);
    textY += lineHeight;
    
    ctx.fillText(`Beat period: T_beat = ${beatPeriod === Infinity ? '∞' : beatPeriod.toFixed(2)} s`, textX, textY);
    textY += lineHeight;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(`Sum: y(t) = A₁sin(2πf₁t) + A₂sin(2πf₂t) = 2A·cos(2π·Δf·t/2)·cos(2π·f_avg·t)`, textX, textY);
    textY += lineHeight;
    
    ctx.fillText(`where Δf = ${beatFreq.toFixed(2)} Hz, f_avg = ${((freq1 + freq2)/2).toFixed(1)} Hz`, textX + 20, textY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      waveHistory = [];
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawWaves();
      drawPhasorDiagram();
      drawFrequencySpectrum();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      waveHistory = [];
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const beatFreq = Math.abs(freq1 - freq2);
      const beatPeriod = beatFreq > 0 ? 1 / beatFreq : Infinity;
      
      return (
        `Beat frequency simulation: Two waves at f₁ = ${freq1.toFixed(1)} Hz and f₂ = ${freq2.toFixed(1)} Hz. ` +
        `Beat frequency = |f₁ - f₂| = ${beatFreq.toFixed(2)} Hz with period ${beatPeriod === Infinity ? '∞' : beatPeriod.toFixed(2)} s. ` +
        `Beats occur due to constructive and destructive interference between waves of slightly different frequencies. ` +
        `The envelope oscillates at the beat frequency while the carrier frequency is the average of f₁ and f₂.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default BeatFrequency;