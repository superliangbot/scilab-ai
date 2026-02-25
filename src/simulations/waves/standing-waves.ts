import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const StandingWaves: SimulationFactory = () => {
  const config = getSimConfig("standing-waves")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let wavelength = 80;
  let amplitude = 40;
  let frequency = 1.5;
  let damping = 0.02;
  let time = 0;

  // Rendering constants
  const AXIS_Y = height * 0.5;
  const MARGIN = 60;
  const STRING_LENGTH = width - 2 * MARGIN;
  const NODE_RADIUS = 4;

  // Colors
  const BG_COLOR = "#0a0a0f";
  const STRING_COLOR = "#60a5fa";
  const NODE_COLOR = "#ef4444";
  const ANTINODE_COLOR = "#10b981";
  const AXIS_COLOR = "#374151";
  const TEXT_COLOR = "#e2e8f0";
  const TEXT_DIM = "#9ca3af";

  function getStandingWaveDisplacement(x: number, t: number): number {
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * frequency;
    
    // Standing wave equation: y = 2A * sin(kx) * cos(ωt) * exp(-damping*t)
    return 2 * amplitude * Math.sin(k * x) * Math.cos(omega * t) * Math.exp(-damping * t);
  }

  function getNodePositions(): number[] {
    const k = (2 * Math.PI) / wavelength;
    const nodes: number[] = [];
    
    for (let n = 0; n <= Math.floor(STRING_LENGTH * k / Math.PI); n++) {
      const nodeX = (n * Math.PI) / k;
      if (nodeX <= STRING_LENGTH) {
        nodes.push(nodeX);
      }
    }
    
    return nodes;
  }

  function getAntinodePositions(): number[] {
    const k = (2 * Math.PI) / wavelength;
    const antinodes: number[] = [];
    
    for (let n = 0; n <= Math.floor((STRING_LENGTH * k + Math.PI) / Math.PI); n++) {
      const antinodeX = ((n + 0.5) * Math.PI) / k;
      if (antinodeX <= STRING_LENGTH && antinodeX >= 0) {
        antinodes.push(antinodeX);
      }
    }
    
    return antinodes;
  }

  function drawAxes() {
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    
    // Horizontal axis
    ctx.beginPath();
    ctx.moveTo(MARGIN, AXIS_Y);
    ctx.lineTo(width - MARGIN, AXIS_Y);
    ctx.stroke();
    
    // Vertical reference lines
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(MARGIN, MARGIN);
    ctx.lineTo(MARGIN, height - MARGIN);
    ctx.moveTo(width - MARGIN, MARGIN);
    ctx.lineTo(width - MARGIN, height - MARGIN);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawStandingWave() {
    ctx.strokeStyle = STRING_COLOR;
    ctx.lineWidth = 2.5;
    
    ctx.beginPath();
    const numPoints = 200;
    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * STRING_LENGTH;
      const y = getStandingWaveDisplacement(x, time);
      const canvasX = MARGIN + x;
      const canvasY = AXIS_Y - y;
      
      if (i === 0) {
        ctx.moveTo(canvasX, canvasY);
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }
    ctx.stroke();
  }

  function drawNodesAndAntinodes() {
    const nodes = getNodePositions();
    const antinodes = getAntinodePositions();
    
    // Draw nodes (points that don't move)
    ctx.fillStyle = NODE_COLOR;
    for (const nodeX of nodes) {
      ctx.beginPath();
      ctx.arc(MARGIN + nodeX, AXIS_Y, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw antinodes (points of maximum amplitude)
    ctx.fillStyle = ANTINODE_COLOR;
    for (const antinodeX of antinodes) {
      const currentAmplitude = Math.abs(getStandingWaveDisplacement(antinodeX, time));
      const radius = NODE_RADIUS * (0.5 + 0.5 * (currentAmplitude / (2 * amplitude)));
      
      ctx.beginPath();
      ctx.arc(MARGIN + antinodeX, AXIS_Y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnvelope() {
    ctx.strokeStyle = "rgba(96, 165, 250, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    // Upper envelope
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const x = (i / 100) * STRING_LENGTH;
      const k = (2 * Math.PI) / wavelength;
      const envelope = 2 * amplitude * Math.abs(Math.sin(k * x)) * Math.exp(-damping * time);
      
      const canvasX = MARGIN + x;
      const canvasY = AXIS_Y - envelope;
      
      if (i === 0) {
        ctx.moveTo(canvasX, canvasY);
      } else {
        ctx.lineTo(canvasX, canvasY);
      }
    }
    
    // Lower envelope
    for (let i = 100; i >= 0; i--) {
      const x = (i / 100) * STRING_LENGTH;
      const k = (2 * Math.PI) / wavelength;
      const envelope = 2 * amplitude * Math.abs(Math.sin(k * x)) * Math.exp(-damping * time);
      
      const canvasX = MARGIN + x;
      const canvasY = AXIS_Y + envelope;
      
      ctx.lineTo(canvasX, canvasY);
    }
    
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawInfoPanel() {
    const panelX = 15;
    const panelY = 15;
    const lineH = 18;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 280, lineH * 7 + 16, 8);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, 280, lineH * 7 + 16, 8);
    ctx.stroke();
    
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = panelX + 12;
    let y = panelY + 10;
    
    ctx.fillStyle = "#818cf8";
    ctx.fillText("Standing Wave Pattern", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(`λ = ${wavelength.toFixed(0)}px   f = ${frequency.toFixed(1)}Hz`, x, y);
    y += lineH;
    
    const k = (2 * Math.PI) / wavelength;
    const omega = 2 * Math.PI * frequency;
    ctx.fillText(`k = ${k.toFixed(3)} px⁻¹   ω = ${omega.toFixed(2)} rad/s`, x, y);
    y += lineH;
    
    ctx.fillText(`A = ${amplitude.toFixed(0)}   damping = ${damping.toFixed(3)}`, x, y);
    y += lineH;
    
    ctx.fillStyle = NODE_COLOR;
    ctx.fillText("● Nodes (zero displacement)", x, y);
    y += lineH;
    
    ctx.fillStyle = ANTINODE_COLOR;
    ctx.fillText("● Antinodes (max displacement)", x, y);
    y += lineH;
    
    ctx.fillStyle = TEXT_DIM;
    ctx.fillText("y = 2A·sin(kx)·cos(ωt)·e^(-δt)", x, y);
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
      wavelength = params.wavelength ?? wavelength;
      amplitude = params.amplitude ?? amplitude;
      frequency = params.frequency ?? frequency;
      damping = params.damping ?? damping;
      
      time += dt;
    },

    render() {
      // Clear background
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);
      
      // Draw coordinate system
      drawAxes();
      
      // Draw envelope of standing wave
      drawEnvelope();
      
      // Draw the standing wave
      drawStandingWave();
      
      // Draw nodes and antinodes
      drawNodesAndAntinodes();
      
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
      const k = (2 * Math.PI) / wavelength;
      const omega = 2 * Math.PI * frequency;
      const nodeCount = getNodePositions().length;
      const antinodeCount = getAntinodePositions().length;
      
      return (
        `Standing Wave: A stationary wave pattern formed by interference of two waves traveling in opposite directions. ` +
        `Wavelength=${wavelength}px, Frequency=${frequency}Hz, Amplitude=${amplitude}. ` +
        `Currently has ${nodeCount} nodes (zero displacement points) and ${antinodeCount} antinodes (maximum displacement points). ` +
        `Wave equation: y = 2A·sin(kx)·cos(ωt)·e^(-δt) where k=${k.toFixed(3)} px⁻¹, ω=${omega.toFixed(2)} rad/s.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default StandingWaves;