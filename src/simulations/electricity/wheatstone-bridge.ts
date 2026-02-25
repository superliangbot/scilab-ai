import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const WheatstoneBridge: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("wheatstone-bridge") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let R1 = 100; // Ohms - known resistor
  let R2 = 200; // Ohms - known resistor  
  let R3 = 150; // Ohms - known resistor
  let Rx = 300; // Ohms - unknown resistor (what we're measuring)
  let supplyVoltage = 12; // Volts

  // Circuit state
  let bridgeVoltage = 0; // Voltage across galvanometer
  let bridgeCurrent = 0; // Current through galvanometer
  let isBalanced = false;
  let I1 = 0, I2 = 0, I3 = 0, Ix = 0; // Branch currents
  let V_AC = 0, V_BD = 0; // Node voltages

  // Visual states
  let galvanometerDeflection = 0;
  let balanceIndicator = 0;

  // Bridge geometry
  const CENTER_X = width * 0.5;
  const CENTER_Y = height * 0.4;
  const BRIDGE_SIZE = 120;

  // Node positions (diamond shape)
  const NODE_A = { x: CENTER_X, y: CENTER_Y - BRIDGE_SIZE }; // Top
  const NODE_B = { x: CENTER_X + BRIDGE_SIZE, y: CENTER_Y }; // Right  
  const NODE_C = { x: CENTER_X, y: CENTER_Y + BRIDGE_SIZE }; // Bottom
  const NODE_D = { x: CENTER_X - BRIDGE_SIZE, y: CENTER_Y }; // Left

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    R1 = params.R1 ?? R1;
    R2 = params.R2 ?? R2;
    R3 = params.R3 ?? R3;
    Rx = params.Rx ?? Rx;
    supplyVoltage = params.supplyVoltage ?? supplyVoltage;

    time += dt;

    // Circuit analysis using nodal analysis
    // Node A is at supply voltage, Node C is at ground
    // Let V_B and V_D be the unknown node voltages
    
    // Using voltage divider for initial approximation
    V_AC = supplyVoltage;
    
    // Voltage at node B (right): voltage divider R1-R2
    const V_B = supplyVoltage * R2 / (R1 + R2);
    
    // Voltage at node D (left): voltage divider R3-Rx  
    const V_D = supplyVoltage * Rx / (R3 + Rx);
    
    // Bridge voltage (voltage across galvanometer)
    bridgeVoltage = V_B - V_D;
    
    // For bridge current calculation, assume galvanometer resistance is 50 ohms
    const galvResistance = 50;
    bridgeCurrent = bridgeVoltage / galvResistance;
    
    // Branch currents (approximate, ignoring galvanometer loading)
    I1 = supplyVoltage / (R1 + R2);
    I2 = I1; // Same current through series R1-R2
    I3 = supplyVoltage / (R3 + Rx);  
    Ix = I3; // Same current through series R3-Rx
    
    // Balance condition: R1/R3 = R2/Rx, or R1*Rx = R2*R3
    const balanceError = Math.abs(R1 * Rx - R2 * R3) / (R1 * Rx + R2 * R3);
    isBalanced = balanceError < 0.01; // Within 1%
    balanceIndicator = isBalanced ? 1.0 : 0.0;
    
    // Galvanometer deflection proportional to current
    const maxDeflection = 45; // degrees
    galvanometerDeflection = Math.max(-maxDeflection, 
      Math.min(maxDeflection, bridgeCurrent * 1000)); // Scale by 1000 for visibility
    
    // Smooth the visual indicators
    const smoothingFactor = 5.0;
    galvanometerDeflection += (galvanometerDeflection - galvanometerDeflection) * Math.min(1, smoothingFactor * dt);
  }

  function drawNode(pos: {x: number, y: number}, label: string) {
    // Node circle
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Node border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    
    // Node label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const offset = 20;
    let labelX = pos.x;
    let labelY = pos.y;
    
    if (label === "A") labelY -= offset;
    else if (label === "B") labelX += offset;
    else if (label === "C") labelY += offset;
    else if (label === "D") labelX -= offset;
    
    ctx.fillText(label, labelX, labelY);
  }

  function drawResistor(startPos: {x: number, y: number}, endPos: {x: number, y: number}, 
                       resistance: number, label: string, current: number) {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    ctx.save();
    ctx.translate(startPos.x, startPos.y);
    ctx.rotate(angle);
    
    // Connection wires
    const zigLength = 40;
    const wireLength = (length - zigLength) / 2;
    
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(wireLength, 0);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(wireLength + zigLength, 0);
    ctx.lineTo(length, 0);
    ctx.stroke();
    
    // Resistor zigzag
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wireLength, 0);
    
    const zigCount = 6;
    const zigHeight = 8;
    
    for (let i = 0; i < zigCount; i++) {
      const x1 = wireLength + (zigLength * (i + 0.25)) / zigCount;
      const x2 = wireLength + (zigLength * (i + 0.75)) / zigCount;
      const sign = i % 2 === 0 ? -1 : 1;
      ctx.lineTo(x1, zigHeight * sign);
      ctx.lineTo(x2, -zigHeight * sign);
    }
    ctx.lineTo(wireLength + zigLength, 0);
    ctx.stroke();
    
    // Current flow arrow
    if (Math.abs(current) > 0.001) {
      const arrowX = length * 0.3;
      const arrowY = -15;
      
      ctx.fillStyle = current > 0 ? "#22d3ee" : "#f472b6";
      ctx.beginPath();
      if (current > 0) {
        ctx.moveTo(arrowX + 8, arrowY);
        ctx.lineTo(arrowX - 4, arrowY - 4);
        ctx.lineTo(arrowX - 2, arrowY);
        ctx.lineTo(arrowX - 4, arrowY + 4);
      } else {
        ctx.moveTo(arrowX - 8, arrowY);
        ctx.lineTo(arrowX + 4, arrowY - 4);
        ctx.lineTo(arrowX + 2, arrowY);
        ctx.lineTo(arrowX + 4, arrowY + 4);
      }
      ctx.fill();
      
      // Current value
      ctx.fillStyle = "#22d3ee";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${(Math.abs(current) * 1000).toFixed(1)}mA`, arrowX, arrowY + 12);
    }
    
    // Resistance label
    ctx.fillStyle = label.includes("x") ? "#ec4899" : "#f59e0b";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, length/2, 20);
    ctx.fillText(`${resistance}Ω`, length/2, 32);
    
    ctx.restore();
  }

  function drawGalvanometer() {
    const midX = (NODE_B.x + NODE_D.x) / 2;
    const midY = (NODE_B.y + NODE_D.y) / 2;
    const radius = 25;
    
    // Galvanometer circle
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(midX, midY, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Background fill
    ctx.fillStyle = isBalanced ? "rgba(34, 197, 94, 0.1)" : "rgba(139, 92, 246, 0.1)";
    ctx.fill();
    
    // Center pivot
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(midX, midY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Needle
    const needleAngle = (galvanometerDeflection * Math.PI) / 180;
    const needleLength = radius * 0.8;
    const needleEndX = midX + needleLength * Math.cos(needleAngle);
    const needleEndY = midY + needleLength * Math.sin(needleAngle);
    
    ctx.strokeStyle = isBalanced ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(needleEndX, needleEndY);
    ctx.stroke();
    
    // Scale marks
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const markAngle = (i * 30 * Math.PI) / 180;
      const innerRadius = radius * 0.85;
      const outerRadius = radius * 0.95;
      
      const x1 = midX + innerRadius * Math.cos(markAngle);
      const y1 = midY + innerRadius * Math.sin(markAngle);
      const x2 = midX + outerRadius * Math.cos(markAngle);
      const y2 = midY + outerRadius * Math.sin(markAngle);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    
    // Connection wires to nodes B and D
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(NODE_B.x, NODE_B.y);
    ctx.lineTo(midX + radius * 0.7, midY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(NODE_D.x, NODE_D.y);
    ctx.lineTo(midX - radius * 0.7, midY);
    ctx.stroke();
    
    // Galvanometer labels
    ctx.fillStyle = "#8b5cf6";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("G", midX, midY + 40);
    
    if (Math.abs(bridgeVoltage) > 0.001) {
      ctx.fillStyle = isBalanced ? "#22c55e" : "#ef4444";
      ctx.fillText(`${bridgeVoltage.toFixed(3)}V`, midX, midY + 52);
      ctx.fillText(`${(bridgeCurrent * 1000).toFixed(2)}mA`, midX, midY + 64);
    }
    
    // Balance indicator
    if (isBalanced) {
      ctx.fillStyle = "#22c55e";
      ctx.font = "12px monospace";
      ctx.fillText("BALANCED", midX, midY - 35);
      
      // Green glow effect
      ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(midX, midY, radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSupply() {
    // Battery between nodes A and C
    const battX = NODE_A.x - 40;
    const topY = NODE_A.y;
    const bottomY = NODE_C.y;
    const centerY = (topY + bottomY) / 2;
    
    // Connection wires
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(NODE_A.x, NODE_A.y);
    ctx.lineTo(battX, NODE_A.y);
    ctx.lineTo(battX, centerY - 15);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(battX, centerY + 15);
    ctx.lineTo(battX, NODE_C.y);
    ctx.lineTo(NODE_C.x, NODE_C.y);
    ctx.stroke();
    
    // Battery symbol
    // Positive plate (top)
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(battX - 8, centerY - 15);
    ctx.lineTo(battX + 8, centerY - 15);
    ctx.stroke();
    
    // Negative plate (bottom)
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(battX - 6, centerY + 15);
    ctx.lineTo(battX + 6, centerY + 15);
    ctx.stroke();
    
    // Voltage label
    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${supplyVoltage}V`, battX - 25, centerY);
    
    // Polarity labels
    ctx.fillStyle = "#ef4444";
    ctx.font = "14px monospace";
    ctx.fillText("+", battX + 15, centerY - 10);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("−", battX + 15, centerY + 20);
  }

  function drawBridge() {
    // Draw all the resistors
    drawResistor(NODE_A, NODE_B, R1, "R₁", I1);
    drawResistor(NODE_B, NODE_C, R2, "R₂", I2);
    drawResistor(NODE_C, NODE_D, Rx, "Rₓ", Ix);
    drawResistor(NODE_D, NODE_A, R3, "R₃", I3);
    
    // Draw nodes
    drawNode(NODE_A, "A");
    drawNode(NODE_B, "B");
    drawNode(NODE_C, "C");
    drawNode(NODE_D, "D");
    
    // Draw galvanometer
    drawGalvanometer();
    
    // Draw power supply
    drawSupply();
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Wheatstone Bridge", 20, 25);
    
    // Circuit analysis
    ctx.font = "11px monospace";
    const balanceRatio1 = R1 / R3;
    const balanceRatio2 = R2 / Rx;
    const expectedRx = (R2 * R3) / R1;
    
    const infoLines = [
      "",
      `Bridge voltage: ${bridgeVoltage.toFixed(4)} V`,
      `Bridge current: ${(bridgeCurrent * 1000).toFixed(3)} mA`,
      "",
      "Balance condition: R₁/R₃ = R₂/Rₓ",
      `R₁/R₃ = ${balanceRatio1.toFixed(3)}`,
      `R₂/Rₓ = ${balanceRatio2.toFixed(3)}`,
      "",
      `Expected Rₓ for balance: ${expectedRx.toFixed(1)} Ω`,
      `Actual Rₓ: ${Rx.toFixed(1)} Ω`,
      `Error: ${(Math.abs(Rx - expectedRx) / expectedRx * 100).toFixed(1)}%`,
      "",
      isBalanced ? "✓ BRIDGE IS BALANCED" : "✗ Bridge not balanced"
    ];
    
    let y = 50;
    infoLines.forEach(line => {
      if (line.includes("BALANCED") && isBalanced) {
        ctx.fillStyle = "#22c55e";
      } else if (line.includes("not balanced")) {
        ctx.fillStyle = "#ef4444";
      } else if (line.includes("Bridge voltage") || line.includes("Bridge current")) {
        ctx.fillStyle = "#8b5cf6";
      } else if (line.includes("Balance condition") || line.includes("Expected")) {
        ctx.fillStyle = "#fbbf24";
      } else if (line.includes("Error")) {
        const error = parseFloat(line.match(/[\d.]+/)?.[0] || "0");
        ctx.fillStyle = error < 5 ? "#22c55e" : error < 15 ? "#fbbf24" : "#ef4444";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 13;
    });
    
    // Usage instructions
    const usageY = height - 100;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    const usage = [
      "Usage: Adjust Rₓ until galvanometer reads zero (bridge balanced)",
      "Then: Rₓ = (R₂ × R₃) / R₁",
      "Applications: Precision resistance measurement, strain gauges, sensors"
    ];
    
    usage.forEach((line, index) => {
      ctx.fillText(line, 20, usageY + index * 12);
    });
  }

  function drawFormula() {
    // Balance equation in a highlighted box
    const boxX = width - 250;
    const boxY = 50;
    const boxW = 230;
    const boxH = 80;
    
    ctx.fillStyle = isBalanced ? "rgba(34, 197, 94, 0.1)" : "rgba(59, 130, 246, 0.1)";
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = isBalanced ? "#22c55e" : "#3b82f6";
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Balance Condition:", boxX + boxW/2, boxY + 20);
    
    ctx.font = "14px monospace";
    ctx.fillText("R₁ × Rₓ = R₂ × R₃", boxX + boxW/2, boxY + 40);
    
    ctx.font = "12px monospace";
    ctx.fillText("Therefore:", boxX + boxW/2, boxY + 55);
    ctx.fillText("Rₓ = (R₂ × R₃) / R₁", boxX + boxW/2, boxY + 70);
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    
    drawBridge();
    drawInfo();
    drawFormula();
  }

  function reset() {
    time = 0;
    galvanometerDeflection = 0;
  }

  function getStateDescription(): string {
    const status = isBalanced ? "balanced" : "unbalanced";
    const expectedRx = (R2 * R3) / R1;
    return `Wheatstone bridge ${status}. Bridge voltage: ${bridgeVoltage.toFixed(3)}V. Unknown resistance Rₓ = ${Rx}Ω (expected ${expectedRx.toFixed(1)}Ω for balance).`;
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

export default WheatstoneBridge;