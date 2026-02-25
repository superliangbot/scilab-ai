import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const Harmonics: SimulationFactory = () => {
  const config = getSimConfig("harmonics")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let fundamental = 220; // Hz (A3)
  let numHarmonics = 5;
  let harmonicAmplitudes = [1.0, 0.5, 0.33, 0.25, 0.2]; // 1/n falloff
  let time = 0;

  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const FUNDAMENTAL_COLOR = "#3b82f6";
  const HARMONIC_COLORS = ["#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
  const COMPOSITE_COLOR = "#fbbf24";
  const TEXT_COLOR = "#e2e8f0";

  function drawString() {
    const stringY = height / 2;
    const stringLength = width - 100;
    const stringX = 50;
    
    // String base
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(stringX, stringY);
    ctx.lineTo(stringX + stringLength, stringY);
    ctx.stroke();
    
    // Fixed ends
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(stringX - 5, stringY - 10, 10, 20);
    ctx.fillRect(stringX + stringLength - 5, stringY - 10, 10, 20);
    
    // Draw standing wave patterns
    const maxHarmonics = Math.min(numHarmonics, harmonicAmplitudes.length);
    
    for (let h = 1; h <= maxHarmonics; h++) {
      const freq = fundamental * h;
      const amplitude = harmonicAmplitudes[h - 1] * 30;
      const color = h === 1 ? FUNDAMENTAL_COLOR : HARMONIC_COLORS[(h - 2) % HARMONIC_COLORS.length];
      
      ctx.strokeStyle = color;
      ctx.lineWidth = h === 1 ? 3 : 2;
      ctx.globalAlpha = h === 1 ? 1 : 0.7;
      ctx.beginPath();
      
      for (let i = 0; i <= 200; i++) {
        const x = stringX + (i / 200) * stringLength;
        const position = (x - stringX) / stringLength; // 0 to 1
        
        // Standing wave: y = A * sin(nπx/L) * cos(ωt)
        const spatialPart = Math.sin(h * Math.PI * position);
        const temporalPart = Math.cos(2 * Math.PI * freq * time);
        const y = stringY + amplitude * spatialPart * temporalPart;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawHarmonicSpectrum() {
    const spectrumX = width - 200;
    const spectrumY = 50;
    const spectrumW = 150;
    const spectrumH = 200;
    
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(spectrumX, spectrumY, spectrumW, spectrumH);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(spectrumX, spectrumY, spectrumW, spectrumH);
    
    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Harmonic Spectrum", spectrumX + spectrumW/2, spectrumY - 10);
    
    // Draw frequency bars
    const maxHarmonics = Math.min(numHarmonics, harmonicAmplitudes.length);
    const barWidth = spectrumW / (maxHarmonics + 1);
    
    for (let h = 1; h <= maxHarmonics; h++) {
      const freq = fundamental * h;
      const amplitude = harmonicAmplitudes[h - 1];
      const barHeight = amplitude * spectrumH * 0.8;
      const barX = spectrumX + h * barWidth - barWidth/2;
      const barY = spectrumY + spectrumH - barHeight;
      
      const color = h === 1 ? FUNDAMENTAL_COLOR : HARMONIC_COLORS[(h - 2) % HARMONIC_COLORS.length];
      ctx.fillStyle = color;
      ctx.fillRect(barX, barY, barWidth * 0.8, barHeight);
      
      // Frequency labels
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${freq}Hz`, barX + barWidth * 0.4, spectrumY + spectrumH + 12);
    }
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = 50;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(panelX, panelY, 280, 180);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(panelX, panelY, 280, 180);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Harmonics & Overtones", panelX + 10, panelY + 20);
    
    ctx.font = "11px monospace";
    ctx.fillText(`Fundamental: ${fundamental} Hz`, panelX + 10, panelY + 45);
    
    const maxHarmonics = Math.min(numHarmonics, harmonicAmplitudes.length);
    for (let h = 1; h <= Math.min(maxHarmonics, 6); h++) {
      const freq = fundamental * h;
      const color = h === 1 ? FUNDAMENTAL_COLOR : HARMONIC_COLORS[(h - 2) % HARMONIC_COLORS.length];
      
      ctx.fillStyle = color;
      ctx.fillText(`f${h}: ${freq} Hz`, panelX + 10, panelY + 60 + h * 15);
    }
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText("Standing waves on string", panelX + 10, panelY + 160);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
    },

    update(dt: number, params: Record<string, number>) {
      fundamental = params.fundamental ?? fundamental;
      numHarmonics = Math.round(params.numHarmonics ?? numHarmonics);
      
      // Adjust amplitude array
      if (params.amplitude1 !== undefined) harmonicAmplitudes[0] = params.amplitude1;
      if (params.amplitude2 !== undefined) harmonicAmplitudes[1] = params.amplitude2;
      if (params.amplitude3 !== undefined) harmonicAmplitudes[2] = params.amplitude3;

      time += dt;
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawString();
      drawHarmonicSpectrum();
      drawInfoPanel();
    },

    reset() {
      time = 0;
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      return `Harmonics simulation showing standing waves on a string. Fundamental frequency: ${fundamental} Hz, displaying ${numHarmonics} harmonics with integer multiples of the fundamental frequency.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default Harmonics;