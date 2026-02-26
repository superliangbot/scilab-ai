import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const DopplerEffect: SimulationFactory = () => {
  const config = getSimConfig("doppler-effect-waves")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let sourceVelocity = 100; // px/s
  let waveSpeed = 300; // px/s
  let frequency = 2; // Hz
  let time = 0;
  
  // Source position and movement
  let sourceX = 100;
  let sourceY = height / 2;
  let direction = 1; // 1 for right, -1 for left
  
  // Wave rings data
  interface WaveRing {
    x: number;
    y: number;
    radius: number;
    birthTime: number;
  }
  const waveRings: WaveRing[] = [];
  const RING_LIFETIME = 3; // seconds
  let lastRingTime = 0;

  // Colors
  const BG_COLOR = "#0a0a0f";
  const SOURCE_COLOR = "#fbbf24";
  const WAVE_COLOR = "#60a5fa";
  const OBSERVER_COLOR = "#10b981";
  const TRAIL_COLOR = "rgba(251, 191, 36, 0.3)";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function updateSource(dt: number) {
    // Move source horizontally
    sourceX += sourceVelocity * direction * dt;
    
    // Bounce off walls
    if (sourceX < 80 || sourceX > width - 80) {
      direction *= -1;
      sourceX = Math.max(80, Math.min(width - 80, sourceX));
    }
  }

  function emitWave() {
    const ringInterval = 1 / frequency;
    if (time - lastRingTime >= ringInterval) {
      waveRings.push({
        x: sourceX,
        y: sourceY,
        radius: 0,
        birthTime: time
      });
      lastRingTime = time;
    }
  }

  function updateWaveRings(dt: number) {
    // Update existing rings
    for (const ring of waveRings) {
      const age = time - ring.birthTime;
      ring.radius = waveSpeed * age;
    }
    
    // Remove old rings
    for (let i = waveRings.length - 1; i >= 0; i--) {
      const ring = waveRings[i];
      const age = time - ring.birthTime;
      if (age > RING_LIFETIME || ring.radius > Math.max(width, height)) {
        waveRings.splice(i, 1);
      }
    }
  }

  function drawSource() {
    // Source trail
    const trailLength = 40;
    const trailStep = 8;
    
    ctx.strokeStyle = TRAIL_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sourceX - direction * trailLength, sourceY);
    ctx.lineTo(sourceX, sourceY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Source body
    const gradient = ctx.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, 15);
    gradient.addColorStop(0, SOURCE_COLOR);
    gradient.addColorStop(1, "rgba(251, 191, 36, 0.3)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Direction indicator
    ctx.fillStyle = "#000000";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(direction > 0 ? "→" : "←", sourceX, sourceY);
    
    // Velocity vector
    ctx.strokeStyle = "#ff6b6b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY - 25);
    ctx.lineTo(sourceX + direction * (sourceVelocity / 5), sourceY - 25);
    ctx.stroke();
    
    // Velocity label
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`v = ${Math.abs(sourceVelocity).toFixed(0)} px/s`, sourceX, sourceY - 30);
  }

  function drawWaveRings() {
    ctx.strokeStyle = WAVE_COLOR;
    ctx.lineWidth = 1.5;
    
    for (const ring of waveRings) {
      const age = time - ring.birthTime;
      const alpha = Math.max(0, 1 - age / RING_LIFETIME);
      
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  }

  function drawObservers() {
    const leftObserverX = 50;
    const rightObserverX = width - 50;
    const observerY = sourceY;
    
    // Left observer (behind source when moving right)
    ctx.fillStyle = OBSERVER_COLOR;
    ctx.beginPath();
    ctx.arc(leftObserverX, observerY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Observer", leftObserverX, observerY + 12);
    
    // Right observer (ahead of source when moving right)
    ctx.fillStyle = OBSERVER_COLOR;
    ctx.beginPath();
    ctx.arc(rightObserverX, observerY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Observer", rightObserverX, observerY + 12);
  }

  function calculateDopplerFrequencies(): { left: number; right: number } {
    // Doppler effect formula: f' = f * (v ± v_o) / (v ± v_s)
    // For stationary observers: f' = f * v / (v ± v_s)
    // + for source moving away, - for source moving toward
    
    const f0 = frequency;
    const v = waveSpeed;
    const vs = Math.abs(sourceVelocity);
    
    // Bounds checking: source velocity cannot exceed wave velocity
    const maxVs = v * 0.99; // 99% of wave speed to avoid division by zero
    const vsLimited = Math.min(vs, maxVs);
    
    let leftFreq: number, rightFreq: number;
    
    if (direction > 0) {
      // Source moving right
      leftFreq = f0 * v / (v + vsLimited); // source moving away from left observer
      rightFreq = f0 * v / Math.max(v - vsLimited, 0.01 * v); // source moving toward right observer
    } else {
      // Source moving left
      leftFreq = f0 * v / Math.max(v - vsLimited, 0.01 * v); // source moving toward left observer
      rightFreq = f0 * v / (v + vsLimited); // source moving away from right observer
    }
    
    return { left: leftFreq, right: rightFreq };
  }

  function drawInfoPanel() {
    const { left, right } = calculateDopplerFrequencies();
    
    const panelX = 15;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 320, lineH * 9 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 320, lineH * 9 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("Doppler Effect", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Source frequency: f₀ = ${frequency.toFixed(1)} Hz`, x, y);
    y += lineH;
    
    ctx.fillText(`Wave speed: v = ${waveSpeed} px/s`, x, y);
    y += lineH;
    
    ctx.fillText(`Source speed: vₛ = ${Math.abs(sourceVelocity)} px/s`, x, y);
    y += lineH;
    
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("Formula: f' = f₀ × v / (v ± vₛ)", x, y);
    y += lineH;
    
    ctx.fillStyle = OBSERVER_COLOR;
    ctx.fillText(`Left observer: ${left.toFixed(2)} Hz`, x, y);
    y += lineH;
    
    ctx.fillText(`Right observer: ${right.toFixed(2)} Hz`, x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    if (direction > 0) {
      ctx.fillText("← Lower frequency (receding)", x, y);
      y += lineH;
      ctx.fillText("→ Higher frequency (approaching)", x, y);
    } else {
      ctx.fillText("← Higher frequency (approaching)", x, y);
      y += lineH;
      ctx.fillText("→ Lower frequency (receding)", x, y);
    }
  }

  function drawWaveSpacing() {
    // Show compressed and stretched wave spacing
    const wavelength = waveSpeed / frequency;
    
    // Find recent rings to highlight spacing
    const recentRings = waveRings.filter(ring => 
      time - ring.birthTime < 1 && ring.radius < width/2
    );
    
    if (recentRings.length >= 2) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      // Draw lines showing wavelength in front of and behind source
      const frontX = sourceX + direction * 80;
      const backX = sourceX - direction * 80;
      
      ctx.beginPath();
      ctx.moveTo(frontX, sourceY - 60);
      ctx.lineTo(frontX, sourceY - 40);
      ctx.moveTo(backX, sourceY - 60);
      ctx.lineTo(backX, sourceY - 40);
      ctx.stroke();
      
      // Labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("λ compressed", frontX, sourceY - 65);
      ctx.fillText("λ stretched", backX, sourceY - 65);
      
      ctx.setLineDash([]);
    }
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
      sourceVelocity = params.sourceVelocity ?? sourceVelocity;
      waveSpeed = params.waveSpeed ?? waveSpeed;
      frequency = params.frequency ?? frequency;
      
      time += dt;
      
      updateSource(dt);
      emitWave();
      updateWaveRings(dt);
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw wave rings
      drawWaveRings();
      
      // Draw observers
      drawObservers();
      
      // Draw source
      drawSource();
      
      // Draw wavelength indicators
      drawWaveSpacing();
      
      // Info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
      sourceX = 100;
      direction = 1;
      waveRings.length = 0;
      lastRingTime = 0;
    },

    destroy() {
      waveRings.length = 0;
    },

    getStateDescription(): string {
      const { left, right } = calculateDopplerFrequencies();
      
      return (
        `Doppler Effect: When a source moves relative to observers, the observed frequency changes. ` +
        `Source emitting ${frequency}Hz waves at ${Math.abs(sourceVelocity)} px/s, wave speed ${waveSpeed} px/s. ` +
        `Left observer hears ${left.toFixed(2)}Hz, right observer hears ${right.toFixed(2)}Hz. ` +
        `Source moving ${direction > 0 ? 'right' : 'left'} creates frequency shift due to wave compression/stretching.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      sourceY = height / 2;
    },
  };

  return engine;
};

export default DopplerEffect;