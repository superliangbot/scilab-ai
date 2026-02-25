import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const HuygensPrinciple: SimulationFactory = () => {
  const config = getSimConfig("huygens-principle")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let wavelength = 40;
  let waveSpeed = 100;
  let time = 0;
  let showWavelets = true;
  let showEnvelope = true;

  // Wave sources for demonstration
  let primarySources: { x: number; y: number; startTime: number }[] = [];
  let secondarySources: { x: number; y: number; startTime: number }[] = [];
  
  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const PRIMARY_COLOR = "#3b82f6";
  const SECONDARY_COLOR = "#10b981";
  const WAVELET_COLOR = "#8b5cf6";
  const ENVELOPE_COLOR = "#fbbf24";
  const TEXT_COLOR = "#e2e8f0";

  function initializeSources() {
    primarySources = [];
    secondarySources = [];
    
    // Create a line of primary sources (plane wave)
    const sourceY = height / 3;
    for (let i = 0; i < 10; i++) {
      primarySources.push({
        x: 100 + i * 60,
        y: sourceY,
        startTime: 0
      });
    }
  }

  function updateSecondaryWavelets() {
    // For Huygens' principle, every point on the wavefront becomes a source of secondary wavelets
    const currentWavefront = findCurrentWavefront();
    
    // Create secondary sources along the wavefront
    secondarySources = [];
    for (let i = 0; i < currentWavefront.length; i += 20) {
      const point = currentWavefront[i];
      if (point) {
        secondarySources.push({
          x: point.x,
          y: point.y,
          startTime: time - 0.5 // Start slightly before current time
        });
      }
    }
  }

  function findCurrentWavefront(): { x: number; y: number }[] {
    const wavefront: { x: number; y: number }[] = [];
    const waveRadius = waveSpeed * time;
    
    // For plane wave, find points that are at the current wave position
    if (waveRadius > 0) {
      const waveY = primarySources[0].y + waveRadius;
      if (waveY < height - 50) {
        for (let x = 50; x < width - 50; x += 20) {
          wavefront.push({ x, y: waveY });
        }
      }
    }
    
    return wavefront;
  }

  function drawPrimarySources() {
    primarySources.forEach(source => {
      // Source dot
      ctx.fillStyle = PRIMARY_COLOR;
      ctx.beginPath();
      ctx.arc(source.x, source.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Primary wave circles
      const radius = waveSpeed * (time - source.startTime);
      if (radius > 0 && radius < 400) {
        ctx.strokeStyle = PRIMARY_COLOR;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        
        // Draw multiple wavefronts
        for (let n = 0; n < 3; n++) {
          const r = radius - n * wavelength;
          if (r > 0) {
            ctx.beginPath();
            ctx.arc(source.x, source.y, r, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  function drawSecondaryWavelets() {
    if (!showWavelets) return;
    
    secondarySources.forEach(source => {
      const radius = waveSpeed * (time - source.startTime);
      if (radius > 0 && radius < 150) {
        // Secondary source dot
        ctx.fillStyle = SECONDARY_COLOR;
        ctx.beginPath();
        ctx.arc(source.x, source.y, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Secondary wavelet circles
        ctx.strokeStyle = WAVELET_COLOR;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([3, 3]);
        
        ctx.beginPath();
        ctx.arc(source.x, source.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });
  }

  function drawWaveEnvelope() {
    if (!showEnvelope || secondarySources.length === 0) return;
    
    // Find the envelope of all secondary wavelets
    const envelope: { x: number; y: number }[] = [];
    
    // Sample points across the width
    for (let x = 50; x < width - 50; x += 5) {
      let maxY = 0;
      
      // Check each secondary source
      secondarySources.forEach(source => {
        const radius = waveSpeed * (time - source.startTime);
        if (radius > 0) {
          // Find intersection of circle with vertical line at x
          const dx = x - source.x;
          if (Math.abs(dx) <= radius) {
            const dy = Math.sqrt(radius * radius - dx * dx);
            const y = source.y + dy;
            if (y > maxY && y < height - 50) {
              maxY = y;
            }
          }
        }
      });
      
      if (maxY > 0) {
        envelope.push({ x, y: maxY });
      }
    }
    
    // Draw the envelope
    if (envelope.length > 1) {
      ctx.strokeStyle = ENVELOPE_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      envelope.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }

  function drawObstacle() {
    // Draw a simple obstacle to show diffraction
    const obstacleX = width / 2 - 50;
    const obstacleY = height / 2;
    const obstacleWidth = 100;
    const obstacleHeight = 20;
    
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(obstacleX, obstacleY, obstacleWidth, obstacleHeight);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(obstacleX, obstacleY, obstacleWidth, obstacleHeight);
    
    // Label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Obstacle", obstacleX + obstacleWidth/2, obstacleY - 5);
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = 10;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(panelX, panelY, 300, 160);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(panelX, panelY, 300, 160);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Huygens' Principle", panelX + 10, panelY + 20);
    
    ctx.font = "11px monospace";
    ctx.fillText("Every point on a wavefront acts as a", panelX + 10, panelY + 45);
    ctx.fillText("source of secondary wavelets.", panelX + 10, panelY + 60);
    
    ctx.fillText("The new wavefront is the envelope", panelX + 10, panelY + 80);
    ctx.fillText("of all secondary wavelets.", panelX + 10, panelY + 95);
    
    ctx.fillText(`λ = ${wavelength}px, v = ${waveSpeed}px/s`, panelX + 10, panelY + 115);
    ctx.fillText(`f = ${(waveSpeed / wavelength).toFixed(1)} Hz`, panelX + 10, panelY + 130);
    
    ctx.fillText("Explains: reflection, refraction,", panelX + 10, panelY + 145);
  }

  function drawLegend() {
    const legendX = width - 200;
    const legendY = height - 140;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.8)";
    ctx.fillRect(legendX, legendY, 180, 120);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(legendX, legendY, 180, 120);
    
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    
    // Primary waves
    ctx.strokeStyle = PRIMARY_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(legendX + 15, legendY + 20, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PRIMARY_COLOR;
    ctx.fillText("Primary Sources", legendX + 30, legendY + 25);
    
    // Secondary wavelets
    ctx.strokeStyle = WAVELET_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(legendX + 15, legendY + 45, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = WAVELET_COLOR;
    ctx.fillText("Secondary Wavelets", legendX + 30, legendY + 50);
    
    // Envelope
    ctx.strokeStyle = ENVELOPE_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(legendX + 10, legendY + 70);
    ctx.lineTo(legendX + 20, legendY + 70);
    ctx.stroke();
    ctx.fillStyle = ENVELOPE_COLOR;
    ctx.fillText("New Wavefront", legendX + 30, legendY + 75);
    
    // Toggle buttons
    ctx.fillStyle = showWavelets ? SECONDARY_COLOR : "#64748b";
    ctx.fillText("W: Toggle Wavelets", legendX + 10, legendY + 95);
    ctx.fillStyle = showEnvelope ? ENVELOPE_COLOR : "#64748b";
    ctx.fillText("E: Toggle Envelope", legendX + 10, legendY + 110);
  }

  function drawDiffractionDemo() {
    // Show how wavelets bend around corners
    if (time > 3) {
      const cornerX = width / 2 + 50;
      const cornerY = height / 2;
      
      // Draw wavelets emanating from the corner
      ctx.strokeStyle = SECONDARY_COLOR;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      
      const diffractedRadius = waveSpeed * (time - 3);
      if (diffractedRadius > 0 && diffractedRadius < 200) {
        ctx.beginPath();
        ctx.arc(cornerX, cornerY, diffractedRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
    }
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      initializeSources();
    },

    update(dt: number, params: Record<string, number>) {
      wavelength = params.wavelength ?? wavelength;
      waveSpeed = params.waveSpeed ?? waveSpeed;
      showWavelets = (params.showWavelets ?? 1) > 0.5;
      showEnvelope = (params.showEnvelope ?? 1) > 0.5;

      time += dt;
      
      // Update secondary wavelets periodically
      if (Math.floor(time * 10) % 3 === 0) {
        updateSecondaryWavelets();
      }
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawPrimarySources();
      drawObstacle();
      drawSecondaryWavelets();
      drawWaveEnvelope();
      drawDiffractionDemo();
      drawInfoPanel();
      drawLegend();
    },

    reset() {
      time = 0;
      initializeSources();
      secondarySources = [];
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      return `Huygens' Principle demonstration: Each point on a wavefront acts as a source of secondary wavelets. The envelope of these wavelets forms the new wavefront, explaining wave propagation, reflection, refraction, and diffraction.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
      initializeSources();
    },
  };

  return engine;
};

export default HuygensPrinciple;