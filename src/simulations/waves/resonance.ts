import type { SimulationEngine, SimulationFactory } from "../types";
import { getSimConfig } from "../registry";

const Resonance: SimulationFactory = () => {
  const config = getSimConfig("resonance")!;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;

  // Physics parameters
  let drivingFreq = 1.0;
  let naturalFreq = 1.0;
  let dampingCoeff = 0.1;
  let forceAmplitude = 1.0;
  let time = 0;

  // Simulation state
  let displacement = 0;
  let velocity = 0;
  let amplitudeHistory: number[] = [];
  let phaseShiftHistory: number[] = [];

  // Colors
  const BG = "#0f172a";
  const OSCILLATOR_COLOR = "#3b82f6";
  const FORCE_COLOR = "#ef4444";
  const RESPONSE_COLOR = "#10b981";
  const GRID_COLOR = "rgba(148, 163, 184, 0.2)";
  const TEXT_COLOR = "#e2e8f0";
  const RESONANCE_COLOR = "#f59e0b";

  function computePhysics(dt: number, params: Record<string, number>) {
    drivingFreq = params.drivingFreq ?? drivingFreq;
    naturalFreq = params.naturalFreq ?? naturalFreq;
    dampingCoeff = params.dampingCoeff ?? dampingCoeff;
    forceAmplitude = params.forceAmplitude ?? forceAmplitude;

    // Forced damped harmonic oscillator: m*a = -k*x - b*v + F*cos(ωt)
    // Normalized: a = -ω₀²*x - 2γ*v + F₀*cos(ωt)
    const omega0 = naturalFreq * 2 * Math.PI;
    const omegaD = drivingFreq * 2 * Math.PI;
    const gamma = dampingCoeff;

    const force = forceAmplitude * Math.cos(omegaD * time);
    const acceleration = -omega0 * omega0 * displacement - 2 * gamma * velocity + force;

    // Update using Verlet integration
    velocity += acceleration * dt;
    displacement += velocity * dt;

    time += dt;

    // Track amplitude and phase for resonance curve
    if (Math.floor(time * 10) > amplitudeHistory.length) {
      const currentAmplitude = Math.abs(displacement);
      amplitudeHistory.push(currentAmplitude);
      
      // Calculate phase shift (simplified)
      const expectedPhase = Math.cos(omegaD * time);
      const actualResponse = displacement / (forceAmplitude || 1);
      const phaseShift = Math.acos(Math.max(-1, Math.min(1, actualResponse / (currentAmplitude || 1))));
      phaseShiftHistory.push(phaseShift);
      
      // Keep history manageable
      if (amplitudeHistory.length > 200) {
        amplitudeHistory = amplitudeHistory.slice(-200);
        phaseShiftHistory = phaseShiftHistory.slice(-200);
      }
    }
  }

  function drawOscillator() {
    const centerX = width * 0.25;
    const centerY = height * 0.5;
    const scale = 100;
    
    // Draw equilibrium position
    ctx.strokeStyle = GRID_COLOR;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 100, centerY);
    ctx.lineTo(centerX + 100, centerY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw spring (simplified)
    const springCompression = displacement * scale;
    const springY = centerY;
    const springStartX = centerX - 80;
    const springEndX = centerX + springCompression;

    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const coils = 8;
    for (let i = 0; i <= coils; i++) {
      const x = springStartX + ((springEndX - springStartX) * i) / coils;
      const y = springY + (i % 2 === 0 ? 0 : 15) * (i === 0 || i === coils ? 0 : 1);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw mass
    const massX = springEndX;
    const massSize = 20;
    ctx.fillStyle = OSCILLATOR_COLOR;
    ctx.fillRect(massX - massSize/2, springY - massSize/2, massSize, massSize);
    
    // Draw mass outline
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2;
    ctx.strokeRect(massX - massSize/2, springY - massSize/2, massSize, massSize);

    // Draw driving force arrow
    const forceLength = forceAmplitude * Math.cos(drivingFreq * 2 * Math.PI * time) * 30;
    if (Math.abs(forceLength) > 2) {
      ctx.strokeStyle = FORCE_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(massX, springY - 40);
      ctx.lineTo(massX + forceLength, springY - 40);
      ctx.stroke();
      
      // Arrow head
      const arrowSize = 6;
      const direction = Math.sign(forceLength);
      ctx.fillStyle = FORCE_COLOR;
      ctx.beginPath();
      ctx.moveTo(massX + forceLength, springY - 40);
      ctx.lineTo(massX + forceLength - direction * arrowSize, springY - 40 - arrowSize/2);
      ctx.lineTo(massX + forceLength - direction * arrowSize, springY - 40 + arrowSize/2);
      ctx.closePath();
      ctx.fill();
    }

    // Labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("m", massX, springY + 35);
    ctx.fillText("k", springStartX + 30, springY - 30);
    
    ctx.fillStyle = FORCE_COLOR;
    ctx.fillText(`F(t) = ${forceAmplitude.toFixed(1)}cos(${drivingFreq.toFixed(1)}t)`, massX, springY - 60);
  }

  function drawResonanceCurve() {
    const plotX = width * 0.55;
    const plotY = height * 0.15;
    const plotW = width * 0.4;
    const plotH = height * 0.3;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.fillRect(plotX, plotY, plotW, plotH);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // Draw theoretical resonance curve
    ctx.strokeStyle = RESONANCE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const freqRange = 3.0;
    for (let i = 0; i <= 100; i++) {
      const freq = (i / 100) * freqRange;
      const omega = freq * 2 * Math.PI;
      const omega0 = naturalFreq * 2 * Math.PI;
      const gamma = dampingCoeff;
      
      // Amplitude response: A = F₀ / sqrt((ω₀² - ω²)² + (2γω)²)
      const denominator = Math.sqrt(Math.pow(omega0*omega0 - omega*omega, 2) + Math.pow(2*gamma*omega, 2));
      const amplitude = forceAmplitude / (denominator || 1);
      
      const x = plotX + (freq / freqRange) * plotW;
      const y = plotY + plotH - (Math.min(amplitude, 5) / 5) * plotH;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mark current frequency
    const currentX = plotX + (drivingFreq / freqRange) * plotW;
    ctx.strokeStyle = FORCE_COLOR;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(currentX, plotY);
    ctx.lineTo(currentX, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Mark natural frequency
    const naturalX = plotX + (naturalFreq / freqRange) * plotW;
    ctx.strokeStyle = OSCILLATOR_COLOR;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(naturalX, plotY);
    ctx.lineTo(naturalX, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Frequency (Hz)", plotX + plotW/2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(plotX - 15, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Amplitude", 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = RESONANCE_COLOR;
    ctx.font = "12px monospace";
    ctx.fillText("Resonance Curve", plotX + plotW/2, plotY - 8);
  }

  function drawPhaseResponse() {
    const plotX = width * 0.55;
    const plotY = height * 0.55;
    const plotW = width * 0.4;
    const plotH = height * 0.25;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.3)";
    ctx.fillRect(plotX, plotY, plotW, plotH);
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // Draw theoretical phase response
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const freqRange = 3.0;
    for (let i = 0; i <= 100; i++) {
      const freq = (i / 100) * freqRange;
      const omega = freq * 2 * Math.PI;
      const omega0 = naturalFreq * 2 * Math.PI;
      const gamma = dampingCoeff;
      
      // Phase shift: φ = arctan(2γω / (ω₀² - ω²))
      const phase = Math.atan2(2*gamma*omega, omega0*omega0 - omega*omega);
      
      const x = plotX + (freq / freqRange) * plotW;
      const y = plotY + plotH/2 - (phase / Math.PI) * plotH/2;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mark current frequency
    const currentX = plotX + (drivingFreq / freqRange) * plotW;
    ctx.strokeStyle = FORCE_COLOR;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(currentX, plotY);
    ctx.lineTo(currentX, plotY + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes labels
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Frequency (Hz)", plotX + plotW/2, plotY + plotH + 15);
    ctx.save();
    ctx.translate(plotX - 15, plotY + plotH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("Phase (rad)", 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = "#a855f7";
    ctx.font = "12px monospace";
    ctx.fillText("Phase Response", plotX + plotW/2, plotY - 8);

    // Draw π and -π markers
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText("π", plotX - 5, plotY + plotH/4);
    ctx.fillText("0", plotX - 5, plotY + plotH/2);
    ctx.fillText("-π", plotX - 5, plotY + 3*plotH/4);
  }

  function drawInfoPanel() {
    const panelX = 10;
    const panelY = height - 120;
    const panelW = width - 20;
    const panelH = 110;

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const textX = panelX + 15;
    let textY = panelY + 20;
    const lineHeight = 16;

    ctx.fillStyle = TEXT_COLOR;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    ctx.fillText(`Resonance: ω₀ = ${naturalFreq.toFixed(2)} Hz, ωₓ = ${drivingFreq.toFixed(2)} Hz`, textX, textY);
    textY += lineHeight;
    
    const currentAmplitude = Math.abs(displacement);
    ctx.fillText(`Amplitude: x = ${currentAmplitude.toFixed(3)}, Damping: γ = ${dampingCoeff.toFixed(2)}`, textX, textY);
    textY += lineHeight;

    const omega0 = naturalFreq * 2 * Math.PI;
    const omegaD = drivingFreq * 2 * Math.PI;
    const gamma = dampingCoeff;
    const phase = Math.atan2(2*gamma*omegaD, omega0*omega0 - omegaD*omegaD);
    
    ctx.fillText(`Phase shift: φ = ${(phase * 180 / Math.PI).toFixed(1)}°`, textX, textY);
    textY += lineHeight;

    // Resonance condition
    const resonanceRatio = drivingFreq / naturalFreq;
    if (Math.abs(resonanceRatio - 1) < 0.1) {
      ctx.fillStyle = RESONANCE_COLOR;
      ctx.fillText(`⚡ NEAR RESONANCE! Amplitude amplified by destructive interference`, textX, textY);
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Frequency ratio: ${resonanceRatio.toFixed(2)} (1.0 = perfect resonance)`, textX, textY);
    }
    textY += lineHeight;

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.fillText(`Equation: m·ẍ + 2γ·ẋ + ω₀²·x = F₀·cos(ωₓt)`, textX, textY);
  }

  const engine: SimulationEngine = {
    config,

    init(c: HTMLCanvasElement) {
      canvas = c;
      ctx = canvas.getContext("2d")!;
      width = canvas.width;
      height = canvas.height;
      time = 0;
      displacement = 0;
      velocity = 0;
      amplitudeHistory = [];
      phaseShiftHistory = [];
    },

    update(dt: number, params: Record<string, number>) {
      computePhysics(dt, params);
    },

    render() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      drawOscillator();
      drawResonanceCurve();
      drawPhaseResponse();
      drawInfoPanel();
    },

    reset() {
      time = 0;
      displacement = 0;
      velocity = 0;
      amplitudeHistory = [];
      phaseShiftHistory = [];
    },

    destroy() {
      // No cleanup needed
    },

    getStateDescription(): string {
      const omega0 = naturalFreq * 2 * Math.PI;
      const omegaD = drivingFreq * 2 * Math.PI;
      const resonanceRatio = drivingFreq / naturalFreq;
      const isNearResonance = Math.abs(resonanceRatio - 1) < 0.1;
      
      return (
        `Forced harmonic oscillator: Natural frequency ω₀ = ${naturalFreq.toFixed(2)} Hz, ` +
        `Driving frequency ωₓ = ${drivingFreq.toFixed(2)} Hz, Damping γ = ${dampingCoeff.toFixed(2)}. ` +
        `Current amplitude: ${Math.abs(displacement).toFixed(3)}. ` +
        `${isNearResonance ? "Near resonance - maximum energy transfer occurs when driving frequency equals natural frequency." : ""} ` +
        `Resonance demonstrates energy transfer efficiency in oscillatory systems.`
      );
    },

    resize(w: number, h: number) {
      width = w;
      height = h;
    },
  };

  return engine;
};

export default Resonance;