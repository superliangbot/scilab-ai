import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const Polarization: SimulationFactory = () => {
  const config = getSimConfig("polarization")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let amplitude = 80;
  let frequency = 1.5;
  let polarizerAngle = 45; // degrees
  let analyzerAngle = 0; // degrees
  let time = 0;

  // Wave propagation
  const WAVE_START_X = 80;
  const WAVE_END_X = width - 80;
  const WAVE_Y = height / 2;
  const POLARIZER_X = width * 0.35;
  const ANALYZER_X = width * 0.65;

  // Colors
  const BG_COLOR = "#0a0a0f";
  const UNPOLARIZED_COLOR = "#60a5fa";
  const POLARIZED_COLOR = "#10b981";
  const TRANSMITTED_COLOR = "#f59e0b";
  const BLOCKED_COLOR = "#ef4444";
  const FILTER_COLOR = "#6b7280";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function drawUnpolarizedWave(startX: number, endX: number) {
    // Draw multiple oscillating planes to represent unpolarized light
    const omega = 2 * Math.PI * frequency;
    const k = 0.05; // wave number for visualization
    const numPlanes = 8;
    
    ctx.lineWidth = 2;
    
    for (let plane = 0; plane < numPlanes; plane++) {
      const angle = (plane / numPlanes) * Math.PI;
      const phaseShift = (plane / numPlanes) * Math.PI * 2;
      
      ctx.strokeStyle = `rgba(96, 165, 250, ${0.3 + 0.4 * Math.cos(angle)})`;
      ctx.beginPath();
      
      const numPoints = Math.floor((endX - startX) / 4);
      for (let i = 0; i <= numPoints; i++) {
        const x = startX + (i / numPoints) * (endX - startX);
        const waveValue = amplitude * 0.3 * Math.sin(k * x - omega * time + phaseShift);
        
        // Project onto the plane defined by angle
        const y = WAVE_Y + waveValue * Math.cos(angle);
        const z = waveValue * Math.sin(angle);
        
        // Simple 3D to 2D projection (z affects y slightly)
        const projectedY = y + z * 0.3;
        
        if (i === 0) {
          ctx.moveTo(x, projectedY);
        } else {
          ctx.lineTo(x, projectedY);
        }
      }
      ctx.stroke();
    }
  }

  function drawPolarizedWave(startX: number, endX: number, angle: number, color: string, alpha: number = 1) {
    const omega = 2 * Math.PI * frequency;
    const k = 0.05;
    const angleRad = (angle * Math.PI) / 180;
    
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const numPoints = Math.floor((endX - startX) / 2);
    for (let i = 0; i <= numPoints; i++) {
      const x = startX + (i / numPoints) * (endX - startX);
      const waveValue = amplitude * Math.sin(k * x - omega * time);
      
      // Oscillation in the polarization direction
      const deltaY = waveValue * Math.cos(angleRad);
      const deltaZ = waveValue * Math.sin(angleRad);
      
      // 3D to 2D projection
      const y = WAVE_Y + deltaY + deltaZ * 0.2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawPolarizer(x: number, angle: number, label: string) {
    const height = 150;
    const width = 8;
    
    // Filter body
    ctx.fillStyle = FILTER_COLOR;
    ctx.fillRect(x - width/2, WAVE_Y - height/2, width, height);
    
    // Polarization direction indicator
    const indicatorLength = 60;
    const angleRad = (angle * Math.PI) / 180;
    
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(
      x - (indicatorLength/2) * Math.cos(angleRad),
      WAVE_Y - (indicatorLength/2) * Math.sin(angleRad)
    );
    ctx.lineTo(
      x + (indicatorLength/2) * Math.cos(angleRad),
      WAVE_Y + (indicatorLength/2) * Math.sin(angleRad)
    );
    ctx.stroke();
    
    // Angle arc
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, WAVE_Y, 25, 0, angleRad);
    ctx.stroke();
    
    // Angle label
    ctx.fillStyle = "#fbbf24";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${angle.toFixed(0)}°`, x + 35, WAVE_Y - 15);
    
    // Filter label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x, WAVE_Y + height/2 + 10);
  }

  function drawLightSource() {
    const sourceX = 40;
    const sourceY = WAVE_Y;
    
    // Light bulb
    const gradient = ctx.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, 20);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.1)");
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Light rays (unpolarized indication)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const startRadius = 18;
      const endRadius = 28;
      
      ctx.beginPath();
      ctx.moveTo(
        sourceX + Math.cos(angle) * startRadius,
        sourceY + Math.sin(angle) * startRadius
      );
      ctx.lineTo(
        sourceX + Math.cos(angle) * endRadius,
        sourceY + Math.sin(angle) * endRadius
      );
      ctx.stroke();
    }
    
    // Label
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Unpolarized", sourceX, sourceY - 25);
    ctx.fillText("Light", sourceX, sourceY - 12);
  }

  function drawIntensityMeter() {
    const meterX = width - 40;
    const meterY = WAVE_Y;
    
    // Calculate transmitted intensity using Malus's law
    const angleDiff = Math.abs(polarizerAngle - analyzerAngle);
    const normalizedAngleDiff = (angleDiff % 180) > 90 ? 180 - (angleDiff % 180) : (angleDiff % 180);
    const cosFactor = Math.cos((normalizedAngleDiff * Math.PI) / 180);
    const transmittedIntensity = cosFactor * cosFactor;
    
    // Meter display
    const meterWidth = 20;
    const meterHeight = 80;
    
    // Background
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(meterX - meterWidth/2, meterY - meterHeight/2, meterWidth, meterHeight);
    
    // Intensity bar
    const barHeight = transmittedIntensity * (meterHeight - 4);
    const intensity = transmittedIntensity;
    const color = `rgb(${Math.round(255 * intensity)}, ${Math.round(200 * intensity)}, 0)`;
    
    ctx.fillStyle = color;
    ctx.fillRect(
      meterX - meterWidth/2 + 2,
      meterY + meterHeight/2 - 2 - barHeight,
      meterWidth - 4,
      barHeight
    );
    
    // Scale marks
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = meterY - meterHeight/2 + (i / 4) * meterHeight;
      ctx.beginPath();
      ctx.moveTo(meterX + meterWidth/2, y);
      ctx.lineTo(meterX + meterWidth/2 + 3, y);
      ctx.stroke();
    }
    
    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("1.0", meterX + meterWidth/2 + 5, meterY - meterHeight/2);
    ctx.fillText("0.5", meterX + meterWidth/2 + 5, meterY);
    ctx.fillText("0.0", meterX + meterWidth/2 + 5, meterY + meterHeight/2);
    
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Intensity", meterX, meterY + meterHeight/2 + 5);
    ctx.fillText(`${(transmittedIntensity * 100).toFixed(0)}%`, meterX, meterY + meterHeight/2 + 18);
  }

  function drawInfoPanel() {
    const angleDiff = Math.abs(polarizerAngle - analyzerAngle);
    const normalizedAngleDiff = (angleDiff % 180) > 90 ? 180 - (angleDiff % 180) : (angleDiff % 180);
    const cosFactor = Math.cos((normalizedAngleDiff * Math.PI) / 180);
    const transmittedIntensity = cosFactor * cosFactor;
    
    const panelX = 15;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 300, lineH * 9 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 300, lineH * 9 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("Light Polarization", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`Polarizer angle: ${polarizerAngle.toFixed(0)}°`, x, y);
    y += lineH;
    
    ctx.fillText(`Analyzer angle: ${analyzerAngle.toFixed(0)}°`, x, y);
    y += lineH;
    
    ctx.fillText(`Angle difference: ${normalizedAngleDiff.toFixed(0)}°`, x, y);
    y += lineH;
    
    ctx.fillStyle = "#10b981";
    ctx.fillText("Malus's Law: I = I₀ cos²(θ)", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`cos²(${normalizedAngleDiff.toFixed(0)}°) = ${transmittedIntensity.toFixed(3)}`, x, y);
    y += lineH;
    
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`Transmitted: ${(transmittedIntensity * 100).toFixed(1)}%`, x, y);
    y += lineH;
    
    if (normalizedAngleDiff === 0) {
      ctx.fillStyle = "#10b981";
      ctx.fillText("✓ Parallel - Maximum transmission", x, y);
    } else if (Math.abs(normalizedAngleDiff - 90) < 1) {
      ctx.fillStyle = "#ef4444";
      ctx.fillText("⊗ Perpendicular - No transmission", x, y);
    } else {
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText("⋄ Partial transmission", x, y);
    }
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("Transverse electromagnetic wave", x, y);
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
      amplitude = params.amplitude ?? amplitude;
      frequency = params.frequency ?? frequency;
      polarizerAngle = params.polarizerAngle ?? polarizerAngle;
      analyzerAngle = params.analyzerAngle ?? analyzerAngle;
      
      time += dt;
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw light source
      drawLightSource();
      
      // Draw unpolarized light (source to polarizer)
      drawUnpolarizedWave(WAVE_START_X, POLARIZER_X - 20);
      
      // Draw polarizer
      drawPolarizer(POLARIZER_X, polarizerAngle, "Polarizer");
      
      // Draw polarized light (polarizer to analyzer)
      drawPolarizedWave(
        POLARIZER_X + 20, 
        ANALYZER_X - 20, 
        polarizerAngle, 
        POLARIZED_COLOR
      );
      
      // Draw analyzer
      drawPolarizer(ANALYZER_X, analyzerAngle, "Analyzer");
      
      // Draw transmitted light (after analyzer)
      const angleDiff = Math.abs(polarizerAngle - analyzerAngle);
      const normalizedAngleDiff = (angleDiff % 180) > 90 ? 180 - (angleDiff % 180) : (angleDiff % 180);
      const transmissionFactor = Math.cos((normalizedAngleDiff * Math.PI) / 180) ** 2;
      
      if (transmissionFactor > 0.01) {
        drawPolarizedWave(
          ANALYZER_X + 20,
          WAVE_END_X,
          analyzerAngle,
          TRANSMITTED_COLOR,
          transmissionFactor
        );
      }
      
      // Draw intensity meter
      drawIntensityMeter();
      
      // Info panel
      drawInfoPanel();
    },

    reset() {
      time = 0;
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const angleDiff = Math.abs(polarizerAngle - analyzerAngle);
      const normalizedAngleDiff = (angleDiff % 180) > 90 ? 180 - (angleDiff % 180) : (angleDiff % 180);
      const transmittedIntensity = Math.cos((normalizedAngleDiff * Math.PI) / 180) ** 2;
      
      return (
        `Light Polarization: Unpolarized light passes through polarizer (${polarizerAngle}°) then analyzer (${analyzerAngle}°). ` +
        `Angle difference: ${normalizedAngleDiff.toFixed(0)}°. By Malus's Law (I = I₀cos²θ), ` +
        `${(transmittedIntensity * 100).toFixed(1)}% of light is transmitted. ` +
        `${normalizedAngleDiff === 0 ? 'Parallel filters give maximum transmission.' : 
          Math.abs(normalizedAngleDiff - 90) < 1 ? 'Perpendicular filters block all light.' : 
          'Partial transmission due to angle mismatch.'}`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default Polarization;