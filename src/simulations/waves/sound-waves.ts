import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const SoundWaves: SimulationFactory = () => {
  const config = getSimConfig("sound-waves")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let frequency = 440; // Hz (A4 note)
  let amplitude = 30;
  let waveSpeed = 343; // m/s (speed of sound in air at 20°C)
  let time = 0;
  
  // Particle simulation
  interface AirParticle {
    x: number;
    y: number;
    restX: number;
    velocity: number;
  }
  
  const particles: AirParticle[] = [];
  const PARTICLE_SPACING = 8;
  const NUM_ROWS = 15;
  
  // Wave visualization
  const WAVE_Y = height * 0.75;
  const PRESSURE_Y = height * 0.25;

  // Colors
  const BG_COLOR = "#0a0a0f";
  const PARTICLE_COLOR = "#64748b";
  const COMPRESSED_COLOR = "#ef4444";
  const RAREFIED_COLOR = "#3b82f6";
  const WAVE_COLOR = "#10b981";
  const PRESSURE_COLOR = "#f59e0b";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function initParticles() {
    particles.length = 0;
    
    const startY = height * 0.4;
    const rowHeight = (height * 0.35) / NUM_ROWS;
    
    for (let row = 0; row < NUM_ROWS; row++) {
      const y = startY + row * rowHeight;
      const numParticlesInRow = Math.floor(width / PARTICLE_SPACING);
      
      for (let i = 0; i < numParticlesInRow; i++) {
        const restX = i * PARTICLE_SPACING + PARTICLE_SPACING / 2;
        
        particles.push({
          x: restX,
          y: y,
          restX: restX,
          velocity: 0
        });
      }
    }
  }

  function updateParticles(dt: number) {
    const k = (2 * Math.PI * frequency) / waveSpeed;
    const omega = 2 * Math.PI * frequency;
    
    // Sound source at left side
    const sourceX = 50;
    
    for (const particle of particles) {
      // Distance from source to particle's rest position
      const distance = Math.abs(particle.restX - sourceX);
      
      // Wave equation with some attenuation
      const attenuation = 1 / Math.sqrt(1 + distance / 100);
      const displacement = amplitude * attenuation * Math.sin(k * distance - omega * time);
      
      // Update particle position (only horizontal displacement for longitudinal wave)
      particle.x = particle.restX + displacement;
    }
  }

  function getLocalDensity(x: number): number {
    // Calculate local particle density around position x
    let density = 0;
    const checkRadius = 20;
    
    for (const particle of particles) {
      const distance = Math.abs(particle.x - x);
      if (distance < checkRadius) {
        density += 1 / (1 + distance / checkRadius);
      }
    }
    
    return density;
  }

  function drawParticles() {
    for (const particle of particles) {
      // Color based on local density (compression/rarefaction)
      const localDensity = getLocalDensity(particle.x);
      const normalDensity = 1.5; // baseline density
      
      let color = PARTICLE_COLOR;
      if (localDensity > normalDensity * 1.2) {
        // High density = compression = red
        const intensity = Math.min((localDensity - normalDensity) / normalDensity, 1);
        color = `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
      } else if (localDensity < normalDensity * 0.8) {
        // Low density = rarefaction = blue
        const intensity = Math.min((normalDensity - localDensity) / normalDensity, 1);
        color = `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`;
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWaveform() {
    // Draw displacement wave at bottom
    ctx.strokeStyle = WAVE_COLOR;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    const numPoints = 200;
    const k = (2 * Math.PI * frequency) / waveSpeed;
    const omega = 2 * Math.PI * frequency;
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * width;
      const displacement = amplitude * Math.sin(k * x - omega * time);
      const y = WAVE_Y - displacement;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Wave axis
    ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, WAVE_Y);
    ctx.lineTo(width, WAVE_Y);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = WAVE_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("Displacement Wave", 10, WAVE_Y - 10);
  }

  function drawPressureWave() {
    // Draw pressure wave at top
    ctx.strokeStyle = PRESSURE_COLOR;
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    const numPoints = 200;
    const k = (2 * Math.PI * frequency) / waveSpeed;
    const omega = 2 * Math.PI * frequency;
    
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * width;
      // Pressure is proportional to -∂u/∂x (negative gradient of displacement)
      const pressure = amplitude * k * Math.cos(k * x - omega * time);
      const y = PRESSURE_Y - pressure;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Pressure axis
    ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, PRESSURE_Y);
    ctx.lineTo(width, PRESSURE_Y);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = PRESSURE_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Pressure Wave", 10, PRESSURE_Y + 10);
  }

  function drawSoundSource() {
    const sourceX = 50;
    const sourceY = height * 0.5;
    
    // Animated speaker cone
    const k = (2 * Math.PI * frequency) / waveSpeed;
    const omega = 2 * Math.PI * frequency;
    const coneOffset = 3 * Math.sin(omega * time);
    
    // Speaker body
    ctx.fillStyle = "#374151";
    ctx.fillRect(sourceX - 15, sourceY - 20, 30, 40);
    
    // Speaker cone
    ctx.fillStyle = "#6b7280";
    ctx.beginPath();
    ctx.moveTo(sourceX + 15, sourceY - 15);
    ctx.lineTo(sourceX + 25 + coneOffset, sourceY - 10);
    ctx.lineTo(sourceX + 25 + coneOffset, sourceY + 10);
    ctx.lineTo(sourceX + 15, sourceY + 15);
    ctx.closePath();
    ctx.fill();
    
    // Sound waves emanating
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const radius = 20 * i + 10 * Math.sin(omega * time - i);
      ctx.beginPath();
      ctx.arc(sourceX + 15, sourceY, radius, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }
  }

  function drawFrequencyInfo() {
    const wavelength = waveSpeed / frequency;
    const period = 1 / frequency;
    
    // Note name from frequency
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteNumber = Math.round(12 * Math.log2(frequency / 440) + 69);
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[((noteNumber % 12) + 12) % 12] + octave;
    
    const panelX = width - 280;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 260, lineH * 8 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 260, lineH * 8 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("Sound Wave Properties", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Frequency: ${frequency.toFixed(0)} Hz (${noteName})`, x, y);
    y += lineH;
    
    ctx.fillText(`Period: ${(period * 1000).toFixed(1)} ms`, x, y);
    y += lineH;
    
    ctx.fillText(`Wavelength: ${(wavelength * 100).toFixed(1)} cm`, x, y);
    y += lineH;
    
    ctx.fillText(`Speed: ${waveSpeed} m/s`, x, y);
    y += lineH;
    
    ctx.fillText(`Amplitude: ${amplitude.toFixed(0)} units`, x, y);
    y += lineH;
    
    ctx.fillStyle = COMPRESSED_COLOR;
    ctx.fillText("● High pressure (compression)", x, y);
    y += lineH;
    
    ctx.fillStyle = RAREFIED_COLOR;
    ctx.fillText("● Low pressure (rarefaction)", x, y);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initParticles();
    },

    update(dt: number, params: Record<string, number>) {
      frequency = params.frequency ?? frequency;
      amplitude = params.amplitude ?? amplitude;
      waveSpeed = params.waveSpeed ?? waveSpeed;
      
      time += dt;
      updateParticles(dt);
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw sound source
      drawSoundSource();
      
      // Draw air particles showing compression/rarefaction
      drawParticles();
      
      // Draw displacement waveform
      drawWaveform();
      
      // Draw pressure waveform
      drawPressureWave();
      
      // Info panel
      drawFrequencyInfo();
    },

    reset() {
      time = 0;
      initParticles();
    },

    destroy() {
      particles.length = 0;
    },

    getStateDescription(): string {
      const wavelength = waveSpeed / frequency;
      const period = 1 / frequency;
      
      return (
        `Sound Waves: Longitudinal waves where air particles oscillate parallel to wave propagation. ` +
        `Frequency=${frequency}Hz, wavelength=${wavelength.toFixed(2)}m, period=${(period*1000).toFixed(1)}ms. ` +
        `Red particles show compression (high pressure), blue show rarefaction (low pressure). ` +
        `Sound travels at ${waveSpeed} m/s in air. Displacement and pressure waves are 90° out of phase.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      initParticles();
    },
  };

  return engine;
};

export default SoundWaves;