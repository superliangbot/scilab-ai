import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const HuygensPrinciple: SimulationFactory = () => {
  const config = getSimConfig("huygens-principle")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let waveSpeed = 100; // pixels per second
  let wavelength = 40; // pixels
  let time = 0;
  let showWavelets = 1;
  let showEnvelope = 1;
  let demonstrationType = 0; // 0=plane wave, 1=circular wave, 2=refraction, 3=diffraction

  // Wave state
  let wavefronts: { x: number; y: number; radius: number; born: number }[] = [];
  let sourcePoints: { x: number; y: number; active: boolean }[] = [];

  // Geometry
  const sourceY = height * 0.3;
  const barrierX = width * 0.6;
  const slitWidth = 60;
  const slitCenterY = height * 0.5;

  // Colors
  const BG = "#0f172a";
  const WAVEFRONT_COLOR = "#10b981";
  const WAVELET_COLOR = "#3b82f6";
  const ENVELOPE_COLOR = "#f59e0b";
  const SOURCE_COLOR = "#ef4444";
  const BARRIER_COLOR = "#64748b";
  const GRID_COLOR = "rgba(148, 163, 184, 0.2)";
  const TEXT_COLOR = "#e2e8f0";
  const CONSTRUCTION_COLOR = "#a855f7";

  function computePhysics(dt: number, params: Record<string, number>) {
    waveSpeed = params.waveSpeed ?? waveSpeed;
    wavelength = params.wavelength ?? wavelength;
    showWavelets = params.showWavelets ?? showWavelets;
    showEnvelope = params.showEnvelope ?? showEnvelope;
    demonstrationType = Math.floor(params.demonstrationType ?? demonstrationType);

    time += dt;
    
    const frequency = waveSpeed / wavelength;
    const period = 1 / frequency;

    // Generate new wavefronts periodically
    if (Math.floor(time / period) > Math.floor((time - dt) / period)) {
      generateWavefront();
    }

    // Update existing wavefronts
    updateWavefronts(dt);

    // Update Huygens source points
    updateHuygensPoints();
  }

  function generateWavefront() {
    switch (demonstrationType) {
      case 0: // Plane wave
        for (let y = 50; y < height - 50; y += 15) {
          wavefronts.push({
            x: 50,
            y: y,
            radius: 0,
            born: time
          });
        }
        break;

      case 1: // Circular wave
        wavefronts.push({
          x: width * 0.2,
          y: height * 0.5,
          radius: 0,
          born: time
        });
        break;

      case 2: // Refraction demo
        for (let y = 50; y < height - 50; y += 15) {
          wavefronts.push({
            x: 50,
            y: y,
            radius: 0,
            born: time
          });
        }
        break;

      case 3: // Diffraction through slit
        for (let y = 50; y < height - 50; y += 15) {
          wavefronts.push({
            x: 50,
            y: y,
            radius: 0,
            born: time
          });
        }
        break;
    }
  }

  function updateWavefronts(dt: number) {
    const fadeTime = 3; // seconds

    for (let i = wavefronts.length - 1; i >= 0; i--) {
      const wf = wavefronts[i];
      const age = time - wf.born;

      if (age > fadeTime) {
        wavefronts.splice(i, 1);
        continue;
      }

      // Update radius for circular waves
      if (demonstrationType === 1) {
        wf.radius = age * waveSpeed;
      } else {
        // For plane waves, move position
        wf.x += waveSpeed * dt;
        if (wf.x > width + 50) {
          wavefronts.splice(i, 1);
          continue;
        }
      }
    }
  }

  function updateHuygensPoints() {
    sourcePoints = [];

    const frequency = waveSpeed / wavelength;
    const currentPhase = (time * frequency * 2 * Math.PI) % (2 * Math.PI);

    // Find active wavefront positions for Huygens construction
    for (const wf of wavefronts) {
      const age = time - wf.born;
      
      switch (demonstrationType) {
        case 0: // Plane wave
          if (wf.x > barrierX - 20 && wf.x < barrierX + 20) {
            // At barrier - check if in slit
            if (Math.abs(wf.y - slitCenterY) < slitWidth / 2) {
              sourcePoints.push({ x: barrierX, y: wf.y, active: true });
            }
          } else if (wf.x > 200 && wf.x < barrierX - 30) {
            // Regular propagation
            sourcePoints.push({ x: wf.x, y: wf.y, active: age % (1 / frequency) < 0.1 });
          }
          break;

        case 1: // Circular wave
          if (wf.radius > 50 && wf.radius < 300) {
            const numPoints = Math.floor(wf.radius / 8);
            for (let i = 0; i < numPoints; i++) {
              const angle = (i / numPoints) * 2 * Math.PI;
              const px = wf.x + wf.radius * Math.cos(angle);
              const py = wf.y + wf.radius * Math.sin(angle);
              if (px > 0 && px < width && py > 0 && py < height) {
                sourcePoints.push({ 
                  x: px, 
                  y: py, 
                  active: Math.sin(currentPhase - (wf.radius / wavelength) * 2 * Math.PI) > 0
                });
              }
            }
          }
          break;

        case 3: // Diffraction
          if (wf.x > barrierX - 10 && wf.x < barrierX + 10) {
            if (Math.abs(wf.y - slitCenterY) < slitWidth / 2) {
              sourcePoints.push({ x: barrierX + 5, y: wf.y, active: true });
            }
          }
          break;
      }
    }
  }

  function drawWavefronts() {
    for (const wf of wavefronts) {
      const age = time - wf.born;
      const alpha = Math.max(0, 1 - age / 3);

      ctx.globalAlpha = alpha;

      switch (demonstrationType) {
        case 0: // Plane wave
        case 2: // Refraction
        case 3: // Diffraction
          // Skip drawing if blocked by barrier
          if (demonstrationType === 3 && wf.x > barrierX) {
            if (Math.abs(wf.y - slitCenterY) > slitWidth / 2) {
              break;
            }
          }

          ctx.strokeStyle = WAVEFRONT_COLOR;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(wf.x, wf.y - 8);
          ctx.lineTo(wf.x, wf.y + 8);
          ctx.stroke();
          break;

        case 1: // Circular wave
          if (wf.radius > 0) {
            ctx.strokeStyle = WAVEFRONT_COLOR;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(wf.x, wf.y, wf.radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawHuygensWavelets() {
    if (!showWavelets) return;

    const currentTime = time;
    const frequency = waveSpeed / wavelength;
    const maxRadius = wavelength * 2;

    ctx.strokeStyle = WAVELET_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;

    for (const point of sourcePoints) {
      if (!point.active) continue;

      // Draw expanding circular wavelets from each point
      for (let n = 0; n < 3; n++) {
        const radius = (currentTime * waveSpeed) % maxRadius + n * (maxRadius / 3);
        if (radius > 0 && radius < maxRadius) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  function drawEnvelope() {
    if (!showEnvelope || sourcePoints.length === 0) return;

    // Calculate envelope by finding tangent to all wavelets
    ctx.strokeStyle = ENVELOPE_COLOR;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;

    const currentTime = time;
    const envelopePoints: { x: number; y: number }[] = [];

    switch (demonstrationType) {
      case 0: // Plane wave envelope
        for (let y = 50; y < height - 50; y += 5) {
          // Find the most advanced wavelet position
          let maxX = 0;
          for (const point of sourcePoints) {
            if (Math.abs(point.y - y) < 10) {
              const radius = (currentTime * waveSpeed) % (wavelength * 2);
              maxX = Math.max(maxX, point.x + radius);
            }
          }
          if (maxX > 0) {
            envelopePoints.push({ x: maxX, y });
          }
        }
        break;

      case 1: // Circular wave envelope
        // The envelope IS the circular wavefront
        break;

      case 3: // Diffraction envelope
        // Envelope after slit - more complex calculation
        const slitSources = sourcePoints.filter(p => 
          p.x > barrierX && Math.abs(p.y - slitCenterY) < slitWidth / 2
        );
        
        for (let angle = -Math.PI / 2; angle <= Math.PI / 2; angle += 0.1) {
          let envelopeX = barrierX;
          let envelopeY = slitCenterY;
          
          // Find envelope point in this direction
          const distance = currentTime * waveSpeed * 0.5;
          envelopeX += distance * Math.cos(angle);
          envelopeY += distance * Math.sin(angle);
          
          if (envelopeX < width && envelopeY > 0 && envelopeY < height) {
            envelopePoints.push({ x: envelopeX, y: envelopeY });
          }
        }
        break;
    }

    // Draw envelope curve
    if (envelopePoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(envelopePoints[0].x, envelopePoints[0].y);
      for (let i = 1; i < envelopePoints.length; i++) {
        ctx.lineTo(envelopePoints[i].x, envelopePoints[i].y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function drawHuygensPoints() {
    // Draw Huygens point sources
    ctx.fillStyle = SOURCE_COLOR;
    
    for (const point of sourcePoints) {
      ctx.globalAlpha = point.active ? 1.0 : 0.3;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.active ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBarrier() {
    if (demonstrationType !== 3) return;

    // Draw barrier with slit
    ctx.fillStyle = BARRIER_COLOR;
    
    // Top part of barrier
    ctx.fillRect(barrierX - 5, 0, 10, slitCenterY - slitWidth / 2);
    
    // Bottom part of barrier
    ctx.fillRect(barrierX - 5, slitCenterY + slitWidth / 2, 10, height - (slitCenterY + slitWidth / 2));

    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Barrier", barrierX, 30);
    ctx.fillText("Slit", barrierX, slitCenterY + slitWidth / 2 + 20);
  }

  function drawInfoPanel() {
    const panelX = 20;
    const panelY = height - 150;
    const panelW = width - 40;
    const panelH = 130;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 18;
    const lineHeight = 14;

    ctx.fillStyle = "#a855f7";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Huygens' Principle", textX, textY);
    textY += lineHeight + 5;

    const demonstrations = [
      "Plane Wave Propagation",
      "Circular Wave Propagation", 
      "Refraction at Interface",
      "Diffraction through Slit"
    ];

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText(`Demo: ${demonstrations[demonstrationType]}`, textX, textY);
    textY += lineHeight + 5;

    const descriptions = [
      "Every point on a wavefront acts as a new source of spherical wavelets. The envelope of all wavelets forms the new wavefront.",
      "Secondary wavelets from each point on a circular wavefront combine to form the propagating wave.",
      "Wavelets bend at the interface, creating refraction according to different wave speeds in each medium.",
      "Wavelets from slit opening spread out, creating diffraction pattern beyond the barrier."
    ];

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    const words = descriptions[demonstrationType].split(' ');
    let line = '';
    let maxLineLength = 90;
    
    for (const word of words) {
      if ((line + word).length > maxLineLength) {
        ctx.fillText(line.trim(), textX, textY);
        textY += 12;
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line.trim()) {
      ctx.fillText(line.trim(), textX, textY);
    }
    textY += lineHeight;

    // Parameters
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.fillText(`Wave speed: ${waveSpeed} px/s | Wavelength: ${wavelength} px | Frequency: ${(waveSpeed/wavelength).toFixed(1)} Hz`, textX, textY + 8);
  }

  function drawLegend() {
    const legendX = width - 200;
    const legendY = 20;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Legend:", legendX, legendY);

    const items = [
      { color: WAVEFRONT_COLOR, label: "Wavefronts" },
      { color: WAVELET_COLOR, label: "Huygens Wavelets" },
      { color: ENVELOPE_COLOR, label: "Envelope" },
      { color: SOURCE_COLOR, label: "Point Sources" },
    ];

    let y = legendY + 20;
    items.forEach(item => {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX, y);
      ctx.lineTo(legendX + 20, y);
      ctx.stroke();

      ctx.fillStyle = item.color;
      ctx.font = "10px monospace";
      ctx.fillText(item.label, legendX + 25, y + 4);
      y += 16;
    });
  }

  function drawConstruction() {
    // Show geometric construction for current demonstration
    if (demonstrationType === 0 && sourcePoints.length > 3) {
      // Show how plane wave envelope is constructed
      ctx.strokeStyle = CONSTRUCTION_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.globalAlpha = 0.5;

      const samplePoints = sourcePoints.filter((_, i) => i % 3 === 0);
      for (const point of samplePoints) {
        const radius = wavelength * 0.8;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  function drawEquation() {
    const eqX = 20;
    const eqY = 50;

    ctx.fillStyle = "#a855f7";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Huygens' Principle:", eqX, eqY);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText("Every point on a wavefront is the source of", eqX, eqY + 20);
    ctx.fillText("secondary spherical wavelets that spread out", eqX, eqY + 35);
    ctx.fillText("with the wave speed c. The new wavefront", eqX, eqY + 50);
    ctx.fillText("is the envelope of these wavelets.", eqX, eqY + 65);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      wavefronts = [];
      sourcePoints = [];
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawBarrier();
      drawConstruction();
      drawWavefronts();
      drawHuygensWavelets();
      drawEnvelope();
      drawHuygensPoints();
      drawEquation();
      drawLegend();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      wavefronts = [];
      sourcePoints = [];
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const demonstrations = [
        "plane wave propagation",
        "circular wave propagation", 
        "refraction at interface",
        "diffraction through slit"
      ];

      const frequency = waveSpeed / wavelength;
      
      return (
        `Huygens' principle demonstration: ${demonstrations[demonstrationType]}. ` +
        `Wave speed = ${waveSpeed} px/s, wavelength = ${wavelength} px, frequency = ${frequency.toFixed(1)} Hz. ` +
        `${showWavelets ? "Showing secondary wavelets from each point on the wavefront. " : ""}` +
        `${showEnvelope ? "Envelope of all wavelets forms the new wavefront position. " : ""}` +
        `Huygens' principle explains wave propagation, diffraction, refraction, and interference by treating ` +
        `every point on a wavefront as a source of secondary spherical wavelets.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default HuygensPrinciple;