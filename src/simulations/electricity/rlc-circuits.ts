import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const RLCCircuits: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("rlc-circuits") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let resistance = 100; // Ohms
  let inductance = 0.1; // Henries
  let capacitance = 100; // microFarads
  let frequency = 60; // Hz

  // Circuit state
  let current = 0;
  let voltage_R = 0;
  let voltage_L = 0;
  let voltage_C = 0;
  let phase_current = 0;
  let impedance = 0;
  let resonantFreq = 0;
  let powerFactor = 0;
  let apparentPower = 0;
  let realPower = 0;
  let reactivePower = 0;

  // Graph history
  const voltageHistory: number[] = [];
  const currentHistory: number[] = [];
  const maxHistory = 200;

  // Component visual states
  let inductorField = 0;
  let capacitorCharge = 0;

  const CIRCUIT_Y = height * 0.35;
  const SUPPLY_X = width * 0.1;
  const R_X = width * 0.3;
  const L_X = width * 0.5;
  const C_X = width * 0.7;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    resistance = params.resistance ?? resistance;
    inductance = params.inductance ?? inductance;
    capacitance = params.capacitance ?? capacitance;
    frequency = params.frequency ?? frequency;

    time += dt;

    const omega = 2 * Math.PI * frequency;
    const C_farads = capacitance * 1e-6; // Convert microFarads to Farads
    
    // Calculate reactances
    const X_L = omega * inductance; // Inductive reactance
    const X_C = 1 / (omega * C_farads); // Capacitive reactance
    const X_net = X_L - X_C; // Net reactance
    
    // Calculate impedance and phase
    impedance = Math.sqrt(resistance * resistance + X_net * X_net);
    const phase = Math.atan2(X_net, resistance);
    
    // Supply voltage (RMS = 120V)
    const V_supply_rms = 120;
    const V_supply_peak = V_supply_rms * Math.sqrt(2);
    const v_supply = V_supply_peak * Math.cos(omega * time);
    
    // Current (RMS and instantaneous)
    const I_rms = V_supply_rms / impedance;
    current = I_rms * Math.sqrt(2) * Math.cos(omega * time - phase);
    phase_current = -phase * 180 / Math.PI; // Convert to degrees
    
    // Component voltages (instantaneous)
    voltage_R = current * resistance;
    voltage_L = I_rms * Math.sqrt(2) * X_L * Math.cos(omega * time - phase + Math.PI/2);
    voltage_C = I_rms * Math.sqrt(2) * X_C * Math.cos(omega * time - phase - Math.PI/2);
    
    // Power calculations
    powerFactor = Math.cos(phase);
    apparentPower = V_supply_rms * I_rms;
    realPower = apparentPower * powerFactor;
    reactivePower = apparentPower * Math.sin(phase);
    
    // Resonant frequency
    resonantFreq = 1 / (2 * Math.PI * Math.sqrt(inductance * C_farads));
    
    // Component visual effects
    inductorField = Math.abs(current) / (I_rms * Math.sqrt(2));
    capacitorCharge = voltage_C / (V_supply_rms * Math.sqrt(2));
    
    // Store history
    voltageHistory.push(v_supply);
    currentHistory.push(current * 10); // Scale for visibility
    
    if (voltageHistory.length > maxHistory) {
      voltageHistory.shift();
      currentHistory.shift();
    }
  }

  function drawCircuit() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Circuit wires
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;

    // Top wire
    ctx.beginPath();
    ctx.moveTo(SUPPLY_X, CIRCUIT_Y - 40);
    ctx.lineTo(width * 0.85, CIRCUIT_Y - 40);
    ctx.lineTo(width * 0.85, CIRCUIT_Y + 40);
    ctx.stroke();

    // Bottom wire  
    ctx.beginPath();
    ctx.moveTo(SUPPLY_X, CIRCUIT_Y + 40);
    ctx.lineTo(C_X, CIRCUIT_Y + 40);
    ctx.stroke();

    // Connecting wires between components
    ctx.beginPath();
    ctx.moveTo(R_X + 30, CIRCUIT_Y - 40);
    ctx.lineTo(L_X - 30, CIRCUIT_Y - 40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(L_X + 30, CIRCUIT_Y - 40);
    ctx.lineTo(C_X - 20, CIRCUIT_Y - 40);
    ctx.stroke();

    drawACSource();
    drawResistor();
    drawInductor();
    drawCapacitor();
    drawCurrentFlow();
  }

  function drawACSource() {
    const centerY = CIRCUIT_Y;
    const radius = 25;

    // Circle
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(SUPPLY_X, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // AC sine wave symbol
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const waveAmplitude = 8;
    const waveLength = 20;
    for (let x = -waveLength/2; x <= waveLength/2; x++) {
      const y = waveAmplitude * Math.sin((x / waveLength) * 4 * Math.PI);
      if (x === -waveLength/2) {
        ctx.moveTo(SUPPLY_X + x, centerY + y);
      } else {
        ctx.lineTo(SUPPLY_X + x, centerY + y);
      }
    }
    ctx.stroke();

    // Terminals
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(SUPPLY_X, centerY - radius);
    ctx.lineTo(SUPPLY_X, centerY - 40);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(SUPPLY_X, centerY + radius);
    ctx.lineTo(SUPPLY_X, centerY + 40);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("AC", SUPPLY_X, centerY + 50);
    ctx.fillText(`${frequency} Hz`, SUPPLY_X, centerY + 65);
  }

  function drawResistor() {
    const centerX = R_X;
    const centerY = CIRCUIT_Y - 40;
    const zigWidth = 30;
    const zigHeight = 12;
    const zigCount = 6;

    // Connecting wires
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - zigWidth/2 - 10, centerY);
    ctx.lineTo(centerX - zigWidth/2, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + zigWidth/2, centerY);
    ctx.lineTo(centerX + zigWidth/2 + 10, centerY);
    ctx.stroke();

    // Zigzag resistor
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - zigWidth/2, centerY);

    for (let i = 0; i < zigCount; i++) {
      const x1 = centerX - zigWidth/2 + (zigWidth * (i + 0.25)) / zigCount;
      const x2 = centerX - zigWidth/2 + (zigWidth * (i + 0.75)) / zigCount;
      const sign = i % 2 === 0 ? -1 : 1;
      ctx.lineTo(x1, centerY + zigHeight * sign);
      ctx.lineTo(x2, centerY - zigHeight * sign);
    }
    ctx.lineTo(centerX + zigWidth/2, centerY);
    ctx.stroke();

    // Voltage indicator
    if (Math.abs(voltage_R) > 1) {
      const intensity = Math.min(Math.abs(voltage_R) / 100, 1);
      ctx.strokeStyle = `rgba(245, 158, 11, ${intensity})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "#f59e0b";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("R", centerX, centerY + 30);
    ctx.fillText(`${resistance}Ω`, centerX, centerY + 42);
    ctx.fillText(`${voltage_R.toFixed(1)}V`, centerX, centerY + 54);
  }

  function drawInductor() {
    const centerX = L_X;
    const centerY = CIRCUIT_Y - 40;
    const coilRadius = 8;
    const numTurns = 4;

    // Connecting wires
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - numTurns * coilRadius - 10, centerY);
    ctx.lineTo(centerX - numTurns * coilRadius, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + numTurns * coilRadius, centerY);
    ctx.lineTo(centerX + numTurns * coilRadius + 10, centerY);
    ctx.stroke();

    // Coil turns
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    
    for (let i = 0; i < numTurns; i++) {
      const x = centerX - numTurns * coilRadius + i * 2 * coilRadius + coilRadius;
      ctx.beginPath();
      ctx.arc(x, centerY - coilRadius, coilRadius, 0, Math.PI);
      ctx.stroke();
    }

    // Magnetic field lines (when current flows)
    if (Math.abs(inductorField) > 0.1) {
      const fieldIntensity = Math.min(inductorField, 1);
      ctx.strokeStyle = `rgba(139, 92, 246, ${fieldIntensity * 0.6})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      for (let i = 0; i < 5; i++) {
        const fieldY = centerY - 25 + i * 10;
        ctx.beginPath();
        ctx.moveTo(centerX - 40, fieldY);
        ctx.lineTo(centerX + 40, fieldY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Label
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("L", centerX, centerY + 30);
    ctx.fillText(`${(inductance * 1000).toFixed(0)}mH`, centerX, centerY + 42);
    ctx.fillText(`${voltage_L.toFixed(1)}V`, centerX, centerY + 54);
  }

  function drawCapacitor() {
    const centerX = C_X;
    const centerY = CIRCUIT_Y - 40;
    const plateWidth = 3;
    const plateHeight = 25;
    const plateGap = 8;

    // Connecting wires
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - plateGap/2 - plateWidth - 10, centerY);
    ctx.lineTo(centerX - plateGap/2 - plateWidth, centerY);
    ctx.stroke();

    // Connection to bottom
    ctx.beginPath();
    ctx.moveTo(centerX + plateGap/2 + plateWidth, centerY);
    ctx.lineTo(centerX + plateGap/2 + plateWidth + 10, centerY);
    ctx.lineTo(centerX + plateGap/2 + plateWidth + 10, centerY + 80);
    ctx.lineTo(centerX, centerY + 80);
    ctx.stroke();

    // Capacitor plates
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = plateWidth;
    
    // Left plate
    ctx.beginPath();
    ctx.moveTo(centerX - plateGap/2, centerY - plateHeight/2);
    ctx.lineTo(centerX - plateGap/2, centerY + plateHeight/2);
    ctx.stroke();

    // Right plate
    ctx.beginPath();
    ctx.moveTo(centerX + plateGap/2, centerY - plateHeight/2);
    ctx.lineTo(centerX + plateGap/2, centerY + plateHeight/2);
    ctx.stroke();

    // Electric field lines (when charged)
    if (Math.abs(capacitorCharge) > 0.1) {
      const fieldIntensity = Math.min(Math.abs(capacitorCharge), 1);
      ctx.strokeStyle = `rgba(236, 72, 153, ${fieldIntensity * 0.6})`;
      ctx.lineWidth = 1;
      
      for (let i = 0; i < 6; i++) {
        const fieldY = centerY - plateHeight/2 + i * plateHeight/5;
        ctx.beginPath();
        ctx.moveTo(centerX - plateGap/2, fieldY);
        ctx.lineTo(centerX + plateGap/2, fieldY);
        ctx.stroke();
        
        // Arrow heads
        ctx.beginPath();
        ctx.moveTo(centerX + plateGap/2, fieldY);
        ctx.lineTo(centerX + plateGap/2 - 2, fieldY - 1);
        ctx.moveTo(centerX + plateGap/2, fieldY);
        ctx.lineTo(centerX + plateGap/2 - 2, fieldY + 1);
        ctx.stroke();
      }
    }

    // Charge indicators
    if (Math.abs(capacitorCharge) > 0.2) {
      ctx.fillStyle = capacitorCharge > 0 ? "#ef4444" : "#3b82f6";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(capacitorCharge > 0 ? "+" : "-", centerX - plateGap/2 - 8, centerY);
      ctx.fillStyle = capacitorCharge > 0 ? "#3b82f6" : "#ef4444";
      ctx.fillText(capacitorCharge > 0 ? "-" : "+", centerX + plateGap/2 + 8, centerY);
    }

    // Label
    ctx.fillStyle = "#ec4899";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("C", centerX, centerY + 30);
    ctx.fillText(`${capacitance}μF`, centerX, centerY + 42);
    ctx.fillText(`${voltage_C.toFixed(1)}V`, centerX, centerY + 54);
  }

  function drawCurrentFlow() {
    if (Math.abs(current) < 0.1) return;

    const arrowColor = current > 0 ? "#22d3ee" : "#f472b6";
    const arrowSize = 6;
    const spacing = 40;

    ctx.fillStyle = arrowColor;

    // Arrows on top wire
    const topY = CIRCUIT_Y - 40;
    const numArrows = Math.floor((width * 0.75) / spacing);
    
    for (let i = 0; i < numArrows; i++) {
      const x = SUPPLY_X + 30 + i * spacing;
      if (x > width * 0.8) break;
      
      drawArrow(x, topY - 15, 0, arrowSize);
    }

    // Arrow on right side
    drawArrow(width * 0.85 + 15, CIRCUIT_Y, Math.PI/2, arrowSize);

    // Arrow on bottom wire
    drawArrow(C_X - 30, CIRCUIT_Y + 40 + 15, Math.PI, arrowSize);

    // Current magnitude
    ctx.fillStyle = arrowColor;
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`I = ${Math.abs(current).toFixed(2)} A`, width * 0.85 + 25, CIRCUIT_Y + 5);
  }

  function drawArrow(x: number, y: number, angle: number, size: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size/2, -size/2);
    ctx.lineTo(-size/4, 0);
    ctx.lineTo(-size/2, size/2);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  function drawPhasorDiagram() {
    const centerX = width * 0.85;
    const centerY = height * 0.75;
    const scale = 0.5;
    
    // Background circle
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Axes
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 60, centerY);
    ctx.lineTo(centerX + 60, centerY);
    ctx.moveTo(centerX, centerY - 60);
    ctx.lineTo(centerX, centerY + 60);
    ctx.stroke();

    // Voltage phasors
    const V_R = Math.abs(voltage_R) * scale * 0.5;
    const V_L = Math.abs(voltage_L) * scale * 0.5;
    const V_C = Math.abs(voltage_C) * scale * 0.5;

    // V_R (in phase with current)
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + V_R, centerY);
    ctx.stroke();

    // V_L (leads current by 90°)
    ctx.strokeStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - V_L);
    ctx.stroke();

    // V_C (lags current by 90°)
    ctx.strokeStyle = "#ec4899";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY + V_C);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Phasor Diagram", centerX, centerY - 70);
    
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("V_R", centerX + V_R + 10, centerY + 3);
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText("V_L", centerX + 5, centerY - V_L - 5);
    ctx.fillStyle = "#ec4899";
    ctx.fillText("V_C", centerX + 5, centerY + V_C + 10);
  }

  function drawWaveforms() {
    const graphX = 50;
    const graphY = height - 150;
    const graphW = width - 300;
    const graphH = 80;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(graphX - 5, graphY - 5, graphW + 10, graphH + 30);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX - 5, graphY - 5, graphW + 10, graphH + 30);

    // Zero line
    ctx.strokeStyle = "rgba(226, 232, 240, 0.2)";
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH/2);
    ctx.lineTo(graphX + graphW, graphY + graphH/2);
    ctx.stroke();

    // Voltage waveform
    if (voltageHistory.length > 1) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < voltageHistory.length; i++) {
        const x = graphX + (i / voltageHistory.length) * graphW;
        const y = graphY + graphH/2 - voltageHistory[i] * 0.2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Current waveform
    if (currentHistory.length > 1) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < currentHistory.length; i++) {
        const x = graphX + (i / currentHistory.length) * graphW;
        const y = graphY + graphH/2 - currentHistory[i] * 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = "#22d3ee";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Voltage (blue)", graphX, graphY - 10);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("Current (orange)", graphX + 120, graphY - 10);
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("RLC AC Circuit Analysis", 20, 25);

    // Circuit parameters
    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px monospace";
    const infoY = 50;
    const lineHeight = 15;

    const infoLines = [
      `Impedance: ${impedance.toFixed(1)} Ω`,
      `Phase: ${phase_current.toFixed(1)}°`,
      `Power Factor: ${powerFactor.toFixed(3)}`,
      `Resonant Freq: ${resonantFreq.toFixed(1)} Hz`,
      "",
      `Real Power: ${realPower.toFixed(1)} W`,
      `Reactive Power: ${Math.abs(reactivePower).toFixed(1)} VAR`,
      `Apparent Power: ${apparentPower.toFixed(1)} VA`
    ];

    infoLines.forEach((line, index) => {
      if (line.includes("Resonant")) {
        ctx.fillStyle = Math.abs(frequency - resonantFreq) < 5 ? "#22c55e" : "#fbbf24";
      } else if (line.includes("Power")) {
        ctx.fillStyle = "#34d399";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, infoY + index * lineHeight);
    });
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawCircuit();
    drawPhasorDiagram();
    drawWaveforms();
    drawInfo();
  }

  function reset() {
    time = 0;
    voltageHistory.length = 0;
    currentHistory.length = 0;
  }

  function getStateDescription(): string {
    const resonance = Math.abs(frequency - resonantFreq) < 5 ? " (at resonance)" : "";
    return `RLC circuit: Z=${impedance.toFixed(1)}Ω, φ=${phase_current.toFixed(1)}°, PF=${powerFactor.toFixed(2)}${resonance}. Real power: ${realPower.toFixed(1)}W.`;
  }

  return {
    config,
    init,
    update,
    render,
    reset,
    destroy: () => {},
    getStateDescription,
    resize: (w: number, h: number) => { width = w; height = h; }
  };
};

export default RLCCircuits;