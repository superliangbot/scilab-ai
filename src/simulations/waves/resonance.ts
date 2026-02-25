import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const Resonance: SimulationFactory = () => {
  const config = getSimConfig("resonance")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics state
  let drivingFreq = 1.0;
  let damping = 0.1;
  let naturalFreq = 1.0;
  let amplitude = 50;
  let time = 0;

  // Oscillator positions
  const numOscillators = 5;
  let positions: number[] = new Array(numOscillators).fill(0);
  let velocities: number[] = new Array(numOscillators).fill(0);

  // Colors and styles
  const BG_COLOR = "#0a0a0f";
  const OSCILLATOR_COLOR = "#3b82f6";
  const DRIVER_COLOR = "#ef4444";
  const TEXT_COLOR = "#e2e8f0";

  function updateOscillators(dt: number) {
    const omega0 = 2 * Math.PI * naturalFreq;
    const omegaD = 2 * Math.PI * drivingFreq;
    const drivingForce = amplitude * Math.cos(omegaD * time);

    for (let i = 0; i < numOscillators; i++) {
      // Each oscillator has slightly different natural frequency
      const freq = naturalFreq + (i - 2) * 0.1;
      const omega = 2 * Math.PI * freq;
      
      // Driven damped harmonic oscillator equation
      // ma = -kx - bv + F_driving
      const acceleration = -omega * omega * positions[i] - 2 * damping * omega * velocities[i] + drivingForce * 0.001;
      
      velocities[i] += acceleration * dt;
      positions[i] += velocities[i] * dt;
    }
  }

  function drawOscillators() {
    const centerY = height / 2;
    const spacing = width / (numOscillators + 1);

    // Draw driving force indicator
    const driverX = 50;
    const driverY = centerY + amplitude * Math.cos(2 * Math.PI * drivingFreq * time) * 0.5;
    
    ctx.fillStyle = DRIVER_COLOR;
    ctx.beginPath();
    ctx.arc(driverX, driverY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Driver", driverX, driverY - 20);

    // Draw oscillators
    for (let i = 0; i < numOscillators; i++) {
      const x = spacing * (i + 1);
      const y = centerY + positions[i];
      const freq = naturalFreq + (i - 2) * 0.1;
      
      // Oscillator mass
      ctx.fillStyle = OSCILLATOR_COLOR;
      if (Math.abs(freq - drivingFreq) < 0.05) {
        ctx.fillStyle = "#fbbf24"; // Highlight resonant oscillator
      }
      
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Spring
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, centerY - 100);
      
      // Draw spring coils
      const coils = 8;
      for (let j = 0; j <= coils; j++) {
        const springY = centerY - 100 + (y - (centerY - 100)) * j / coils;
        const offset = (j % 2 === 0) ? -8 : 8;
        ctx.lineTo(x + offset, springY);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // Frequency label
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`f=${freq.toFixed(1)}`, x, y + 30);
    }
  }

  function drawAmplitudeGraph() {
    const graphX = width - 250;
    const graphY = 50;
    const graphW = 200;
    const graphH = 150;
    
    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(graphX, graphY, graphW, graphH);
    
    // Title
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Resonance Curve", graphX + graphW/2, graphY - 10);
    
    // Plot amplitude vs frequency
    ctx.strokeStyle = OSCILLATOR_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i <= 100; i++) {
      const f = 0.5 + (i / 100) * 2; // 0.5 to 2.5 Hz
      const omega = 2 * Math.PI * f;
      const omega0 = 2 * Math.PI * naturalFreq;
      const gamma = 2 * damping * omega0;
      
      // Amplitude response for driven damped oscillator
      const responseAmplitude = amplitude / Math.sqrt(Math.pow(omega0*omega0 - omega*omega, 2) + Math.pow(gamma*omega, 2));
      
      const x = graphX + (f - 0.5) / 2 * graphW;
      const y = graphY + graphH - (responseAmplitude / (amplitude * 2)) * graphH;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Mark driving frequency
    ctx.strokeStyle = DRIVER_COLOR;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const driverX = graphX + (drivingFreq - 0.5) / 2 * graphW;
    ctx.moveTo(driverX, graphY);
    ctx.lineTo(driverX, graphY + graphH);
    ctx.stroke();
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = 10;
    
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(panelX, panelY, 300, 120);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(panelX, panelY, 300, 120);
    
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Resonance Demonstration", panelX + 10, panelY + 20);
    
    ctx.font = "12px monospace";
    ctx.fillText(`Driving Frequency: ${drivingFreq.toFixed(2)} Hz`, panelX + 10, panelY + 45);
    ctx.fillText(`Natural Frequency: ${naturalFreq.toFixed(2)} Hz`, panelX + 10, panelX + 65);
    ctx.fillText(`Damping: ${damping.toFixed(2)}`, panelX + 10, panelY + 85);
    ctx.fillText("Yellow oscillator shows resonance", panelX + 10, panelY + 105);
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
      drivingFreq = params.drivingFreq ?? drivingFreq;
      damping = params.damping ?? damping;
      naturalFreq = params.naturalFreq ?? naturalFreq;
      amplitude = params.amplitude ?? amplitude;

      time += dt;
      updateOscillators(dt);
    },

    render() {
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      drawOscillators();
      drawAmplitudeGraph();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      positions.fill(0);
      velocities.fill(0);
    },

    destroy() {
      // Nothing to clean up
    },

    getStateDescription(): string {
      return `Resonance simulation showing ${numOscillators} oscillators with different natural frequencies driven at ${drivingFreq.toFixed(2)} Hz. Maximum amplitude occurs when driving frequency matches natural frequency.`;
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default Resonance;