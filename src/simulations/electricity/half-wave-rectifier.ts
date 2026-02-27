import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const HalfWaveRectifier: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("half-wave-rectifier") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let acFrequency = 60; // Hz
  let acAmplitude = 170; // Peak voltage (120V RMS × √2)
  let loadResistance = 1000; // Ohms
  let smoothingCapacitor = 0; // 0 = no cap, 1 = with cap

  // Circuit state
  let inputVoltage = 0;
  let outputVoltage = 0;
  let diodeCurrent = 0;
  let diodeState = false; // true = conducting, false = blocking
  let capacitorVoltage = 0;
  let capacitorCurrent = 0;
  let rippleFactor = 0;

  // Waveform history
  const inputHistory: number[] = [];
  const outputHistory: number[] = [];
  const currentHistory: number[] = [];
  const maxHistory = 300;

  // Visual elements
  let diodeGlow = 0;
  let electronFlow = 0;

  const TRANSFORMER_X = width * 0.15;
  const DIODE_X = width * 0.4;
  const LOAD_X = width * 0.65;
  const CIRCUIT_Y = height * 0.35;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
    capacitorVoltage = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    acFrequency = params.acFrequency ?? acFrequency;
    acAmplitude = params.acAmplitude ?? acAmplitude;
    loadResistance = params.loadResistance ?? loadResistance;
    smoothingCapacitor = Math.round(params.smoothingCapacitor ?? smoothingCapacitor);

    time += dt;

    const omega = 2 * Math.PI * acFrequency;
    
    // Input AC voltage
    inputVoltage = acAmplitude * Math.sin(omega * time);
    
    // Diode behavior (ideal diode model with 0.7V forward drop)
    const forwardDrop = 0.7;
    
    if (smoothingCapacitor === 0) {
      // Without smoothing capacitor
      if (inputVoltage > forwardDrop) {
        // Diode conducts
        diodeState = true;
        outputVoltage = inputVoltage - forwardDrop;
        diodeCurrent = outputVoltage / loadResistance;
        diodeGlow = 1.0;
      } else {
        // Diode blocks
        diodeState = false;
        outputVoltage = 0;
        diodeCurrent = 0;
        diodeGlow = 0;
      }
      capacitorVoltage = 0;
      capacitorCurrent = 0;
    } else {
      // With smoothing capacitor
      const capacitance = 100e-6; // 100µF
      
      if (inputVoltage - forwardDrop > capacitorVoltage) {
        // Diode conducts - charging capacitor
        diodeState = true;
        const targetVoltage = inputVoltage - forwardDrop;
        
        // Simple RC charging (simplified model)
        const tau = loadResistance * capacitance;
        const chargeRate = (targetVoltage - capacitorVoltage) / tau;
        capacitorVoltage += chargeRate * dt;
        
        outputVoltage = capacitorVoltage;
        diodeCurrent = chargeRate * capacitance;
        diodeGlow = 1.0;
        capacitorCurrent = diodeCurrent;
      } else {
        // Diode blocks - capacitor discharging through load
        diodeState = false;
        
        // Exponential discharge
        const tau = loadResistance * capacitance;
        capacitorVoltage *= Math.exp(-dt / tau);
        outputVoltage = capacitorVoltage;
        
        diodeCurrent = 0;
        capacitorCurrent = -outputVoltage / loadResistance;
        diodeGlow = 0;
      }
    }

    // Calculate ripple factor for capacitor case
    if (smoothingCapacitor === 1 && outputHistory.length > 50) {
      const recentOutputs = outputHistory.slice(-50);
      const avgOutput = recentOutputs.reduce((a, b) => a + b) / recentOutputs.length;
      const rmsRipple = Math.sqrt(
        recentOutputs.reduce((sum, v) => sum + Math.pow(v - avgOutput, 2), 0) / recentOutputs.length
      );
      rippleFactor = avgOutput > 0 ? rmsRipple / avgOutput : 0;
    }

    electronFlow = diodeState ? Math.abs(diodeCurrent) / 0.1 : 0;

    // Store waveform history
    inputHistory.push(inputVoltage);
    outputHistory.push(outputVoltage);
    currentHistory.push(diodeCurrent * 1000); // Convert to mA

    if (inputHistory.length > maxHistory) {
      inputHistory.shift();
      outputHistory.shift();
      currentHistory.shift();
    }
  }

  function drawTransformer() {
    const centerX = TRANSFORMER_X;
    const centerY = CIRCUIT_Y;
    const coreWidth = 8;
    const coreHeight = 60;
    const coilWidth = 20;

    // Iron core
    ctx.fillStyle = "#64748b";
    ctx.fillRect(centerX - coreWidth/2, centerY - coreHeight/2, coreWidth, coreHeight);

    // Primary coil (left)
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const y = centerY - 30 + i * 8;
      ctx.beginPath();
      ctx.arc(centerX - coilWidth, y, 4, Math.PI, 0);
      ctx.stroke();
    }

    // Secondary coil (right)
    ctx.strokeStyle = "#22d3ee";
    for (let i = 0; i < 6; i++) {
      const y = centerY - 20 + i * 7;
      ctx.beginPath();
      ctx.arc(centerX + coilWidth, y, 3, 0, Math.PI);
      ctx.stroke();
    }

    // AC input connections
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - coilWidth - 20, centerY - 25);
    ctx.lineTo(centerX - coilWidth - 4, centerY - 25);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX - coilWidth - 20, centerY + 25);
    ctx.lineTo(centerX - coilWidth - 4, centerY + 25);
    ctx.stroke();

    // AC source symbol
    const acX = centerX - coilWidth - 40;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(acX, centerY, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Sine wave inside
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = -8; x <= 8; x++) {
      const y = 6 * Math.sin(x * 0.8);
      if (x === -8) ctx.moveTo(acX + x, centerY + y);
      else ctx.lineTo(acX + x, centerY + y);
    }
    ctx.stroke();

    // Secondary output connections
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX + coilWidth + 4, centerY - 15);
    ctx.lineTo(centerX + 80, centerY - 15);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + coilWidth + 4, centerY + 15);
    ctx.lineTo(centerX + 80, centerY + 15);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("120V AC", acX, centerY + 30);
    ctx.fillText(`${acFrequency}Hz`, acX, centerY + 42);

    // Voltage indicator
    const voltagePhase = Math.sin(2 * Math.PI * acFrequency * time);
    if (Math.abs(voltagePhase) > 0.1) {
      const intensity = Math.abs(voltagePhase);
      ctx.strokeStyle = `rgba(34, 211, 238, ${intensity * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX + coilWidth + 30, centerY, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawDiode() {
    const centerX = DIODE_X;
    const centerY = CIRCUIT_Y;
    const triangleSize = 12;

    // Connecting wires
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 30, centerY);
    ctx.lineTo(centerX - triangleSize, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + triangleSize, centerY);
    ctx.lineTo(centerX + 30, centerY);
    ctx.stroke();

    // Diode symbol - triangle (anode to cathode)
    ctx.fillStyle = diodeState ? "#22c55e" : "#6b7280";
    ctx.strokeStyle = diodeState ? "#22c55e" : "#6b7280";
    ctx.lineWidth = 2;

    // Triangle (anode)
    ctx.beginPath();
    ctx.moveTo(centerX - triangleSize, centerY);
    ctx.lineTo(centerX, centerY - triangleSize);
    ctx.lineTo(centerX, centerY + triangleSize);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bar (cathode)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - triangleSize);
    ctx.lineTo(centerX, centerY + triangleSize);
    ctx.stroke();

    // Current flow indicator
    if (diodeState && diodeCurrent > 0.001) {
      // Electron flow (opposite to conventional current)
      for (let i = 0; i < 3; i++) {
        const x = centerX + 15 + i * 8;
        const phase = time * 10 + i * 2;
        const y = centerY + 3 * Math.sin(phase);
        
        ctx.fillStyle = "#22d3ee";
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Electron trails
        ctx.strokeStyle = "rgba(34, 211, 238, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Diode glow effect when conducting
    if (diodeGlow > 0.1) {
      ctx.strokeStyle = `rgba(34, 197, 94, ${diodeGlow * 0.8})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = diodeState ? "#22c55e" : "#6b7280";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("D1", centerX, centerY + 25);
    ctx.fillText(diodeState ? "ON" : "OFF", centerX, centerY + 37);
    
    if (diodeState) {
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`${(diodeCurrent * 1000).toFixed(1)}mA`, centerX, centerY + 49);
    }
  }

  function drawLoad() {
    const centerX = LOAD_X;
    const topY = CIRCUIT_Y - 15;
    const bottomY = CIRCUIT_Y + 15;
    const resistorW = 30;
    const resistorH = 8;

    // Top connection
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 40, topY);
    ctx.lineTo(centerX + 40, topY);
    ctx.stroke();

    // Bottom connection (return path)
    ctx.beginPath();
    ctx.moveTo(centerX - 40, bottomY);
    ctx.lineTo(centerX + 40, bottomY);
    ctx.stroke();

    // Side connections
    ctx.beginPath();
    ctx.moveTo(centerX + 40, topY);
    ctx.lineTo(centerX + 40, bottomY);
    ctx.stroke();

    // Load resistor
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - resistorW/2, topY);

    // Zigzag pattern
    const zigCount = 6;
    for (let i = 0; i < zigCount; i++) {
      const x1 = centerX - resistorW/2 + (resistorW * (i + 0.25)) / zigCount;
      const x2 = centerX - resistorW/2 + (resistorW * (i + 0.75)) / zigCount;
      const sign = i % 2 === 0 ? 1 : -1;
      ctx.lineTo(x1, topY + resistorH * sign);
      ctx.lineTo(x2, topY - resistorH * sign);
    }
    ctx.lineTo(centerX + resistorW/2, topY);
    ctx.stroke();

    // Optional smoothing capacitor
    if (smoothingCapacitor === 1) {
      const capX = centerX + 15;
      const plateGap = 6;
      const plateHeight = 20;

      // Capacitor plates
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(capX - plateGap/2, topY);
      ctx.lineTo(capX - plateGap/2, bottomY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(capX + plateGap/2, topY);
      ctx.lineTo(capX + plateGap/2, bottomY);
      ctx.stroke();

      // Charge indicators
      if (Math.abs(capacitorVoltage) > 1) {
        const chargeLevel = Math.min(Math.abs(capacitorVoltage) / acAmplitude, 1);
        ctx.fillStyle = `rgba(236, 72, 153, ${chargeLevel})`;
        ctx.fillRect(capX - plateGap/2 - 2, topY, 4, bottomY - topY);
        ctx.fillStyle = `rgba(59, 130, 246, ${chargeLevel})`;
        ctx.fillRect(capX + plateGap/2 - 2, topY, 4, bottomY - topY);
      }

      // Capacitor current arrow
      if (Math.abs(capacitorCurrent) > 0.001) {
        const arrowColor = capacitorCurrent > 0 ? "#22c55e" : "#ef4444";
        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const arrowY = (topY + bottomY) / 2;
        const arrowLength = 15;
        
        if (capacitorCurrent > 0) {
          // Charging
          ctx.moveTo(capX - arrowLength, arrowY);
          ctx.lineTo(capX + arrowLength, arrowY);
          ctx.moveTo(capX + arrowLength, arrowY);
          ctx.lineTo(capX + arrowLength - 5, arrowY - 3);
          ctx.moveTo(capX + arrowLength, arrowY);
          ctx.lineTo(capX + arrowLength - 5, arrowY + 3);
        } else {
          // Discharging
          ctx.moveTo(capX + arrowLength, arrowY);
          ctx.lineTo(capX - arrowLength, arrowY);
          ctx.moveTo(capX - arrowLength, arrowY);
          ctx.lineTo(capX - arrowLength + 5, arrowY - 3);
          ctx.moveTo(capX - arrowLength, arrowY);
          ctx.lineTo(capX - arrowLength + 5, arrowY + 3);
        }
        ctx.stroke();
      }

      // Capacitor label
      ctx.fillStyle = "#ec4899";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("100µF", capX, bottomY + 15);
      
      if (Math.abs(capacitorVoltage) > 1) {
        ctx.fillText(`${capacitorVoltage.toFixed(1)}V`, capX, bottomY + 27);
      }
    }

    // Load labels
    ctx.fillStyle = "#f59e0b";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`R_L = ${loadResistance}Ω`, centerX, topY - 10);
    
    if (outputVoltage > 0.1) {
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(`${outputVoltage.toFixed(1)}V`, centerX, bottomY + 15);
      ctx.fillText(`${(outputVoltage / loadResistance * 1000).toFixed(1)}mA`, centerX, bottomY + 27);
    }

    // Power dissipation visualization
    if (outputVoltage > 1) {
      const power = (outputVoltage * outputVoltage) / loadResistance;
      const heatLevel = Math.min(power / 10, 1);
      
      ctx.fillStyle = `rgba(239, 68, 68, ${heatLevel * 0.3})`;
      ctx.fillRect(centerX - resistorW/2 - 5, topY - 10, resistorW + 10, 20);
    }
  }

  function drawWaveforms() {
    const graphX = 50;
    const graphY = height - 200;
    const graphW = width - 300;
    const graphH = 60;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.9)";
    ctx.fillRect(graphX - 5, graphY - 25, graphW + 10, graphH * 2 + 40);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(graphX - 5, graphY - 25, graphW + 10, graphH * 2 + 40);

    // Input waveform
    if (inputHistory.length > 1) {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < inputHistory.length; i++) {
        const x = graphX + (i / inputHistory.length) * graphW;
        const y = graphY + graphH/2 - (inputHistory[i] / acAmplitude) * (graphH/2 * 0.8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Output waveform
    if (outputHistory.length > 1) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < outputHistory.length; i++) {
        const x = graphX + (i / outputHistory.length) * graphW;
        const y = graphY + graphH + 10 + graphH/2 - (outputHistory[i] / acAmplitude) * (graphH/2 * 0.8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Zero lines
    ctx.strokeStyle = "rgba(226, 232, 240, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH/2);
    ctx.lineTo(graphX + graphW, graphY + graphH/2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH + 10 + graphH/2);
    ctx.lineTo(graphX + graphW, graphY + graphH + 10 + graphH/2);
    ctx.stroke();

    // Labels
    ctx.fillStyle = "#22d3ee";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Input (AC)", graphX, graphY - 5);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("Output (Rectified)", graphX, graphY + graphH + 5);
    
    if (smoothingCapacitor === 1 && rippleFactor > 0) {
      ctx.fillStyle = "#ec4899";
      ctx.fillText(`Ripple: ${(rippleFactor * 100).toFixed(1)}%`, graphX + 150, graphY + graphH + 5);
    }
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Half-Wave Rectifier", 20, 25);

    // Circuit analysis
    ctx.font = "11px monospace";
    const avgVoltage = smoothingCapacitor === 0 
      ? acAmplitude / Math.PI  // Peak/π for half-wave without cap
      : capacitorVoltage; // Approximate DC for capacitor case
    
    const efficiency = smoothingCapacitor === 0 ? 40.6 : 80; // Approximate values
    const peakInverseVoltage = acAmplitude + 0.7;

    const infoLines = [
      "",
      `Average Output: ${avgVoltage.toFixed(1)} V`,
      `Peak Inverse Voltage: ${peakInverseVoltage.toFixed(1)} V`,
      `Efficiency: ~${efficiency.toFixed(1)}%`,
      `Configuration: ${smoothingCapacitor === 0 ? 'Without filter' : 'With C-filter'}`,
      "",
      "Key Points:",
      "• Diode conducts only during positive half-cycles",
      "• Output contains significant ripple without filtering",
      "• Smoothing capacitor reduces ripple but increases PIV",
      "• Simple but inefficient compared to full-wave rectifier"
    ];

    let y = 50;
    infoLines.forEach(line => {
      if (line.includes("Average") || line.includes("PIV") || line.includes("Efficiency")) {
        ctx.fillStyle = "#22d3ee";
      } else if (line.includes("•")) {
        ctx.fillStyle = "#94a3b8";
      } else if (line.includes("Key Points") || line.includes("Configuration")) {
        ctx.fillStyle = "#fbbf24";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 13;
    });
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawTransformer();
    drawDiode();
    drawLoad();
    drawWaveforms();
    drawInfo();
  }

  function reset() {
    time = 0;
    capacitorVoltage = 0;
    inputHistory.length = 0;
    outputHistory.length = 0;
    currentHistory.length = 0;
  }

  function getStateDescription(): string {
    const config = smoothingCapacitor === 0 ? "unfiltered" : "with capacitor filter";
    const efficiency = smoothingCapacitor === 0 ? 40.6 : 80;
    return `Half-wave rectifier ${config}. Diode ${diodeState ? 'conducting' : 'blocking'}. Output: ${outputVoltage.toFixed(1)}V. Efficiency: ~${efficiency}%.`;
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

export default HalfWaveRectifier;