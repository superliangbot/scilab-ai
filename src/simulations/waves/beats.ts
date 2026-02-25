import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const Beats: SimulationFactory = () => {
  const config = getSimConfig("beats")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let freq1 = 440;  // Hz
  let freq2 = 444;  // Hz
  let amplitude = 100;
  let time = 0;

  // Wave history for plotting
<<<<<<< HEAD
  const historyLength = 800;
  let waveHistory: number[][] = [[], []];
  let beatHistory: number[] = [];
=======
  const historyLength = 1000;
  let waveHistory: number[][] = [[], []];
  let beatHistory: number[] = [];
  let timeHistory: number[] = [];
>>>>>>> origin/audit/physics

  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const WAVE1_COLOR = "#3b82f6";
  const WAVE2_COLOR = "#ef4444";
  const BEAT_COLOR = "#fbbf24";
<<<<<<< HEAD
  const TEXT_COLOR = "#e2e8f0";

  function updateWaves() {
=======
  const ENVELOPE_COLOR = "#10b981";
  const TEXT_COLOR = "#e2e8f0";

  function updateWaves(dt: number) {
>>>>>>> origin/audit/physics
    const wave1 = amplitude * Math.cos(2 * Math.PI * freq1 * time);
    const wave2 = amplitude * Math.cos(2 * Math.PI * freq2 * time);
    const beatWave = wave1 + wave2;
    
    // Store in history
    waveHistory[0].push(wave1);
    waveHistory[1].push(wave2);
    beatHistory.push(beatWave);
<<<<<<< HEAD
=======
    timeHistory.push(time);
>>>>>>> origin/audit/physics
    
    // Keep only recent history
    if (waveHistory[0].length > historyLength) {
      waveHistory[0].shift();
      waveHistory[1].shift();
      beatHistory.shift();
<<<<<<< HEAD
=======
      timeHistory.shift();
>>>>>>> origin/audit/physics
    }
  }

  function drawWaveforms() {
    const graphY = height / 2 - 150;
    const graphH = 300;
    const graphW = width - 100;
    const graphX = 50;
    
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    
    // Center line
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH/2);
    ctx.lineTo(graphX + graphW, graphY + graphH/2);
    ctx.stroke();
    
    // Draw individual waves
    if (waveHistory[0].length > 1) {
      // Wave 1
      ctx.strokeStyle = WAVE1_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < waveHistory[0].length; i++) {
        const x = graphX + (i / historyLength) * graphW;
        const y = graphY + graphH/2 - (waveHistory[0][i] / amplitude) * graphH/4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Wave 2
      ctx.strokeStyle = WAVE2_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < waveHistory[1].length; i++) {
        const x = graphX + (i / historyLength) * graphW;
        const y = graphY + graphH/2 - (waveHistory[1][i] / amplitude) * graphH/4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
<<<<<<< HEAD
=======
      // Beat envelope (amplitude modulation)
      const beatFreq = Math.abs(freq2 - freq1);
      ctx.strokeStyle = ENVELOPE_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = 0; i < timeHistory.length; i++) {
        const x = graphX + (i / historyLength) * graphW;
        const envelope = 2 * amplitude * Math.abs(Math.cos(Math.PI * beatFreq * timeHistory[i]));
        const yTop = graphY + graphH/2 - (envelope / amplitude) * graphH/4;
        const yBot = graphY + graphH/2 + (envelope / amplitude) * graphH/4;
        
        if (i === 0) {
          ctx.moveTo(x, yTop);
        } else {
          ctx.lineTo(x, yTop);
        }
      }
      ctx.stroke();
      
      ctx.beginPath();
      for (let i = 0; i < timeHistory.length; i++) {
        const x = graphX + (i / historyLength) * graphW;
        const envelope = 2 * amplitude * Math.abs(Math.cos(Math.PI * beatFreq * timeHistory[i]));
        const yBot = graphY + graphH/2 + (envelope / amplitude) * graphH/4;
        
        if (i === 0) {
          ctx.moveTo(x, yBot);
        } else {
          ctx.lineTo(x, yBot);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      
>>>>>>> origin/audit/physics
      // Beat waveform (sum)
      ctx.strokeStyle = BEAT_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < beatHistory.length; i++) {
        const x = graphX + (i / historyLength) * graphW;
        const y = graphY + graphH/2 - (beatHistory[i] / (2 * amplitude)) * graphH/4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

<<<<<<< HEAD
=======
  function drawTuningForks() {
    const fork1X = 100;
    const fork2X = 200;
    const forkY = height - 150;
    
    // Tuning fork 1
    ctx.strokeStyle = WAVE1_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const vibration1 = 5 * Math.sin(2 * Math.PI * freq1 * time);
    ctx.moveTo(fork1X - 20, forkY - 50);
    ctx.lineTo(fork1X - 20 + vibration1, forkY - 10);
    ctx.lineTo(fork1X + 20 + vibration1, forkY - 10);
    ctx.lineTo(fork1X + 20, forkY - 50);
    ctx.moveTo(fork1X, forkY - 10);
    ctx.lineTo(fork1X, forkY + 30);
    ctx.stroke();
    
    ctx.fillStyle = WAVE1_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${freq1} Hz`, fork1X, forkY + 50);
    
    // Tuning fork 2
    ctx.strokeStyle = WAVE2_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const vibration2 = 5 * Math.sin(2 * Math.PI * freq2 * time);
    ctx.moveTo(fork2X - 20, forkY - 50);
    ctx.lineTo(fork2X - 20 + vibration2, forkY - 10);
    ctx.lineTo(fork2X + 20 + vibration2, forkY - 10);
    ctx.lineTo(fork2X + 20, forkY - 50);
    ctx.moveTo(fork2X, forkY - 10);
    ctx.lineTo(fork2X, forkY + 30);
    ctx.stroke();
    
    ctx.fillStyle = WAVE2_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${freq2} Hz`, fork2X, forkY + 50);
  }

>>>>>>> origin/audit/physics
  function drawInfoPanel() {
    const panelX = width - 320;
    const panelY = 20;
    const beatFreq = Math.abs(freq2 - freq1);
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(panelX, panelY, 300, 140);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(panelX, panelY, 300, 140);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Beat Frequency", panelX + 10, panelY + 20);
    
    ctx.font = "12px monospace";
    ctx.fillStyle = WAVE1_COLOR;
    ctx.fillText(`Frequency 1: ${freq1} Hz`, panelX + 10, panelY + 45);
    ctx.fillStyle = WAVE2_COLOR;
    ctx.fillText(`Frequency 2: ${freq2} Hz`, panelX + 10, panelY + 65);
    ctx.fillStyle = BEAT_COLOR;
    ctx.fillText(`Beat Frequency: ${beatFreq.toFixed(1)} Hz`, panelX + 10, panelY + 85);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("f_beat = |f₁ - f₂|", panelX + 10, panelY + 105);
    ctx.fillText(`Period: ${(1/beatFreq).toFixed(2)} s`, panelX + 10, panelY + 125);
  }

<<<<<<< HEAD
=======
  function drawLegend() {
    const legendX = 350;
    const legendY = height - 80;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(legendX, legendY, 200, 60);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(legendX, legendY, 200, 60);
    
    ctx.font = "11px monospace";
    
    // Wave 1
    ctx.strokeStyle = WAVE1_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX + 10, legendY + 15);
    ctx.lineTo(legendX + 30, legendY + 15);
    ctx.stroke();
    ctx.fillStyle = WAVE1_COLOR;
    ctx.fillText("Wave 1", legendX + 35, legendY + 19);
    
    // Wave 2
    ctx.strokeStyle = WAVE2_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX + 110, legendY + 15);
    ctx.lineTo(legendX + 130, legendY + 15);
    ctx.stroke();
    ctx.fillStyle = WAVE2_COLOR;
    ctx.fillText("Wave 2", legendX + 135, legendY + 19);
    
    // Beat
    ctx.strokeStyle = BEAT_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX + 10, legendY + 35);
    ctx.lineTo(legendX + 30, legendY + 35);
    ctx.stroke();
    ctx.fillStyle = BEAT_COLOR;
    ctx.fillText("Beat (Sum)", legendX + 35, legendY + 39);
    
    // Envelope
    ctx.strokeStyle = ENVELOPE_COLOR;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(legendX + 110, legendY + 35);
    ctx.lineTo(legendX + 130, legendY + 35);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ENVELOPE_COLOR;
    ctx.fillText("Envelope", legendX + 135, legendY + 39);
  }

>>>>>>> origin/audit/physics
  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      freq1 = params.freq1 ?? freq1;
      freq2 = params.freq2 ?? freq2;
      amplitude = params.amplitude ?? amplitude;

      time += dt;
<<<<<<< HEAD
      updateWaves();
=======
      updateWaves(dt);
>>>>>>> origin/audit/physics
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawWaveforms();
<<<<<<< HEAD
      drawInfoPanel();
=======
      drawTuningForks();
      drawInfoPanel();
      drawLegend();
>>>>>>> origin/audit/physics
    },

    reset() {
      time = 0;
      waveHistory = [[], []];
      beatHistory = [];
<<<<<<< HEAD
=======
      timeHistory = [];
>>>>>>> origin/audit/physics
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      const beatFreq = Math.abs(freq2 - freq1);
      return `Beat frequency demonstration with two waves at ${freq1} Hz and ${freq2} Hz, producing beats at ${beatFreq.toFixed(1)} Hz.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default Beats;