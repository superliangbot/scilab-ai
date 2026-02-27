import type { SimulationEngine, SimulationFactory, SimulationConfig } from "../types";
import { getSimConfig } from "../registry";

const TransistorSwitch: SimulationFactory = (): SimulationEngine => {
  const config = getSimConfig("transistor-switch") as SimulationConfig;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = 800;
  let height = 600;
  let time = 0;

  // Parameters
  let baseVoltage = 0; // Input control voltage
  let vcc = 5; // Supply voltage
  let baseResistor = 10000; // Base resistor in ohms
  let loadResistor = 1000; // Load resistor in ohms

  // Transistor characteristics (NPN)
  const V_BE_threshold = 0.7; // Base-emitter forward voltage
  const beta = 100; // Current gain

  // Circuit state
  let baseState = false; // ON/OFF
  let collectorVoltage = 0;
  let emitterVoltage = 0;
  let baseCurrent = 0;
  let collectorCurrent = 0;
  let ledBrightness = 0;
  let saturationMode = false;

  // Visual effects
  let electronFlow = 0;
  let switchGlow = 0;

  const TRANSISTOR_X = width * 0.4;
  const TRANSISTOR_Y = height * 0.4;
  const LED_X = width * 0.6;
  const LED_Y = height * 0.25;

  function init(c: HTMLCanvasElement) {
    canvas = c;
    ctx = canvas.getContext("2d")!;
    width = canvas.width;
    height = canvas.height;
    time = 0;
  }

  function update(dt: number, params: Record<string, number>) {
    baseVoltage = params.baseVoltage ?? baseVoltage;
    vcc = params.vcc ?? vcc;
    baseResistor = params.baseResistor ?? baseResistor;
    loadResistor = params.loadResistor ?? loadResistor;

    time += dt;

    // Calculate base current
    if (baseVoltage > V_BE_threshold) {
      baseCurrent = (baseVoltage - V_BE_threshold) / baseResistor;
      baseState = true;
    } else {
      baseCurrent = 0;
      baseState = false;
    }

    // Calculate collector current and voltages
    if (baseState) {
      // Transistor is ON
      const maxCollectorCurrent = vcc / loadResistor;
      const saturatedCollectorCurrent = baseCurrent * beta;
      
      if (saturatedCollectorCurrent >= maxCollectorCurrent) {
        // Saturation mode
        collectorCurrent = maxCollectorCurrent;
        collectorVoltage = 0.2; // V_CE_sat
        saturationMode = true;
      } else {
        // Active mode
        collectorCurrent = saturatedCollectorCurrent;
        collectorVoltage = vcc - (collectorCurrent * loadResistor);
        saturationMode = false;
      }
    } else {
      // Transistor is OFF
      collectorCurrent = 0;
      collectorVoltage = vcc;
      saturationMode = false;
    }

    emitterVoltage = 0; // Grounded

    // LED brightness based on current
    ledBrightness = Math.min(1, collectorCurrent * 5);

    // Visual effects
    electronFlow = collectorCurrent * 10;
    switchGlow = baseState ? Math.min(1, baseCurrent * 10000) : 0;
  }

  function drawPowerSupply() {
    const supplyX = TRANSISTOR_X - 100;
    const supplyY = TRANSISTOR_Y - 80;

    // VCC connection
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(supplyX, supplyY);
    ctx.lineTo(supplyX + 200, supplyY);
    ctx.stroke();

    // Supply label
    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`+${vcc}V`, supplyX + 50, supplyY - 10);

    // Ground connections
    ctx.beginPath();
    ctx.moveTo(TRANSISTOR_X, TRANSISTOR_Y + 60);
    ctx.lineTo(TRANSISTOR_X, TRANSISTOR_Y + 80);
    ctx.stroke();

    // Ground symbol
    ctx.beginPath();
    ctx.moveTo(TRANSISTOR_X - 15, TRANSISTOR_Y + 80);
    ctx.lineTo(TRANSISTOR_X + 15, TRANSISTOR_Y + 80);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(TRANSISTOR_X - 10, TRANSISTOR_Y + 85);
    ctx.lineTo(TRANSISTOR_X + 10, TRANSISTOR_Y + 85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(TRANSISTOR_X - 5, TRANSISTOR_Y + 90);
    ctx.lineTo(TRANSISTOR_X + 5, TRANSISTOR_Y + 90);
    ctx.stroke();

    ctx.fillText("GND", TRANSISTOR_X, TRANSISTOR_Y + 105);
  }

  function drawInputSignal() {
    const inputX = TRANSISTOR_X - 150;
    const inputY = TRANSISTOR_Y;

    // Input source
    ctx.strokeStyle = baseState ? "#22c55e" : "#6b7280";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(inputX, inputY, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Voltage level indicator
    ctx.fillStyle = baseState ? "#22c55e" : "#6b7280";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${baseVoltage.toFixed(1)}V`, inputX, inputY + 3);

    // Base resistor
    const resistorX = inputX + 40;
    drawResistor(inputX + 15, inputY, resistorX, inputY, baseResistor, "Rb");

    // Connection to transistor base
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(resistorX, inputY);
    ctx.lineTo(TRANSISTOR_X - 20, inputY);
    ctx.stroke();

    // Current flow animation
    if (baseCurrent > 0) {
      const electronX = inputX + 60 + 20 * Math.sin(time * 5);
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(electronX, inputY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTransistor() {
    const centerX = TRANSISTOR_X;
    const centerY = TRANSISTOR_Y;

    // Transistor body (circle)
    ctx.strokeStyle = baseState ? "#22c55e" : "#6b7280";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
    ctx.stroke();

    // Fill with glow effect when active
    if (switchGlow > 0) {
      ctx.fillStyle = `rgba(34, 197, 94, ${switchGlow * 0.2})`;
      ctx.fill();
    }

    // Base terminal (left)
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 25, centerY);
    ctx.lineTo(centerX - 15, centerY);
    ctx.stroke();

    // Collector terminal (top)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 25);
    ctx.lineTo(centerX, centerY - 15);
    ctx.stroke();

    // Emitter terminal (bottom)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 15);
    ctx.lineTo(centerX, centerY + 25);
    ctx.stroke();

    // Internal structure
    // Base line (vertical)
    ctx.strokeStyle = baseState ? "#22c55e" : "#6b7280";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY - 10);
    ctx.lineTo(centerX - 15, centerY + 10);
    ctx.stroke();

    // Collector line
    ctx.strokeStyle = baseState ? "#3b82f6" : "#6b7280";
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY - 8);
    ctx.lineTo(centerX - 5, centerY - 15);
    ctx.stroke();

    // Emitter line with arrow
    ctx.strokeStyle = baseState ? "#ef4444" : "#6b7280";
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY + 8);
    ctx.lineTo(centerX - 5, centerY + 15);
    ctx.stroke();

    // Emitter arrow
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY + 15);
    ctx.lineTo(centerX - 8, centerY + 12);
    ctx.moveTo(centerX - 5, centerY + 15);
    ctx.lineTo(centerX - 2, centerY + 12);
    ctx.stroke();

    // Terminal labels
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("C", centerX, centerY - 35);
    ctx.textAlign = "right";
    ctx.fillText("B", centerX - 35, centerY + 3);
    ctx.textAlign = "center";
    ctx.fillText("E", centerX, centerY + 45);

    // Transistor type label
    ctx.fillText("NPN", centerX + 35, centerY);

    // Current and voltage displays
    ctx.font = "10px monospace";
    ctx.fillStyle = "#22d3ee";
    ctx.textAlign = "left";
    ctx.fillText(`IB = ${(baseCurrent * 1000000).toFixed(1)}µA`, centerX + 40, centerY - 20);
    ctx.fillText(`IC = ${(collectorCurrent * 1000).toFixed(1)}mA`, centerX + 40, centerY - 5);
    ctx.fillText(`VCE = ${collectorVoltage.toFixed(2)}V`, centerX + 40, centerY + 10);
    
    if (saturationMode) {
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("SATURATED", centerX + 40, centerY + 25);
    } else if (baseState) {
      ctx.fillStyle = "#22c55e";
      ctx.fillText("ACTIVE", centerX + 40, centerY + 25);
    } else {
      ctx.fillStyle = "#6b7280";
      ctx.fillText("CUTOFF", centerX + 40, centerY + 25);
    }
  }

  function drawLoad() {
    // Load resistor (LED + current limiting resistor)
    const loadX = LED_X;
    const loadY = LED_Y;

    // Connection from VCC to load
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(TRANSISTOR_X - 100, TRANSISTOR_Y - 80);
    ctx.lineTo(loadX, TRANSISTOR_Y - 80);
    ctx.lineTo(loadX, loadY - 30);
    ctx.stroke();

    // Load resistor
    drawResistor(loadX - 15, loadY - 30, loadX + 15, loadY - 30, loadResistor, "RL");

    // LED
    const ledRadius = 15;
    
    // LED body
    ctx.fillStyle = ledBrightness > 0.1 ? 
      `rgba(255, 255, 0, ${ledBrightness})` : 
      "rgba(100, 116, 139, 0.3)";
    ctx.beginPath();
    ctx.arc(loadX, loadY, ledRadius, 0, Math.PI * 2);
    ctx.fill();

    // LED border
    ctx.strokeStyle = ledBrightness > 0.1 ? "#fbbf24" : "#64748b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // LED symbol (diode + rays when lit)
    if (ledBrightness > 0.1) {
      // Light rays
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const startR = ledRadius + 2;
        const endR = ledRadius + 8 + ledBrightness * 5;
        
        ctx.strokeStyle = `rgba(255, 255, 0, ${ledBrightness * 0.8})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(
          loadX + Math.cos(angle) * startR,
          loadY + Math.sin(angle) * startR
        );
        ctx.lineTo(
          loadX + Math.cos(angle) * endR,
          loadY + Math.sin(angle) * endR
        );
        ctx.stroke();
      }
    }

    // Connection to transistor collector
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(loadX, loadY + ledRadius);
    ctx.lineTo(loadX, TRANSISTOR_Y - 25);
    ctx.lineTo(TRANSISTOR_X, TRANSISTOR_Y - 25);
    ctx.stroke();

    // Current flow animation
    if (electronFlow > 0.1) {
      const animY = loadY + ledRadius + (TRANSISTOR_Y - 25 - loadY - ledRadius) * 
        (0.5 + 0.5 * Math.sin(time * electronFlow));
      
      ctx.fillStyle = "#22d3ee";
      ctx.beginPath();
      ctx.arc(loadX, animY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawResistor(x1: number, y1: number, x2: number, y2: number, 
                       resistance: number, label: string) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const length = 30;
    const height = 8;

    // Connection wires
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(centerX - length/2, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX + length/2, centerY);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Resistor zigzag
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - length/2, centerY);

    const zigCount = 6;
    for (let i = 0; i < zigCount; i++) {
      const x = centerX - length/2 + (length * (i + 0.25)) / zigCount;
      const y = centerY + height * (i % 2 === 0 ? -1 : 1);
      ctx.lineTo(x, y);
      
      const x2 = centerX - length/2 + (length * (i + 0.75)) / zigCount;
      const y2 = centerY + height * (i % 2 === 0 ? 1 : -1);
      ctx.lineTo(x2, y2);
    }
    ctx.lineTo(centerX + length/2, centerY);
    ctx.stroke();

    // Label
    ctx.fillStyle = "#f59e0b";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, centerX, centerY - 15);
    
    if (resistance >= 1000) {
      ctx.fillText(`${(resistance/1000).toFixed(0)}kΩ`, centerX, centerY - 5);
    } else {
      ctx.fillText(`${resistance}Ω`, centerX, centerY - 5);
    }
  }

  function drawInfo() {
    // Title
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.fillText("Transistor Switch", 20, 30);

    // Operating principles
    ctx.font = "11px monospace";
    const infoLines = [
      "",
      `Input: ${baseVoltage.toFixed(1)}V ${baseState ? '(HIGH)' : '(LOW)'}`,
      `Threshold: ${V_BE_threshold}V`,
      `Beta (hFE): ${beta}`,
      "",
      "Operating Mode:",
      baseState ? 
        (saturationMode ? "SATURATED (switch ON)" : "ACTIVE (amplifier)") :
        "CUTOFF (switch OFF)",
      "",
      "Applications:",
      "• Digital logic gates",
      "• LED drivers", 
      "• Motor control",
      "• Power switching"
    ];

    let y = 50;
    infoLines.forEach(line => {
      if (line.includes("Input") || line.includes("Operating Mode")) {
        ctx.fillStyle = "#fbbf24";
      } else if (line.includes("SATURATED") || line.includes("ON")) {
        ctx.fillStyle = "#22c55e";
      } else if (line.includes("CUTOFF") || line.includes("OFF")) {
        ctx.fillStyle = "#ef4444";
      } else if (line.includes("•")) {
        ctx.fillStyle = "#94a3b8";
      } else {
        ctx.fillStyle = "#e2e8f0";
      }
      ctx.fillText(line, 20, y);
      y += 13;
    });
  }

  function drawCharacteristics() {
    const chartX = width - 200;
    const chartY = height - 150;
    const chartW = 180;
    const chartH = 100;

    // Background
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(chartX - 10, chartY - 10, chartW + 20, chartH + 20);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.strokeRect(chartX - 10, chartY - 10, chartW + 20, chartH + 20);

    // Title
    ctx.fillStyle = "#22d3ee";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Transfer Characteristic", chartX + chartW/2, chartY - 15);

    // Axes
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartH);
    ctx.lineTo(chartX + chartW, chartY + chartH);
    ctx.moveTo(chartX, chartY);
    ctx.lineTo(chartX, chartY + chartH);
    ctx.stroke();

    // Transfer curve (simplified)
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let vbe = 0; vbe <= 1; vbe += 0.01) {
      const x = chartX + (vbe / 1) * chartW;
      let vce;
      
      if (vbe < V_BE_threshold) {
        vce = vcc; // Cutoff
      } else {
        const ib = (vbe - V_BE_threshold) / (baseResistor * 0.001);
        const ic_active = ib * beta * 0.001;
        const ic_max = vcc / (loadResistor * 0.001);
        
        if (ic_active >= ic_max) {
          vce = 0.2; // Saturation
        } else {
          vce = vcc - ic_active * loadResistor * 0.001;
        }
      }
      
      const y = chartY + chartH - (vce / vcc) * chartH;
      
      if (vbe === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Current operating point
    const currentX = chartX + (baseVoltage / 1) * chartW;
    const currentY = chartY + chartH - (collectorVoltage / vcc) * chartH;
    
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(currentX, currentY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("VBE (V)", chartX + chartW/2, chartY + chartH + 15);
    
    ctx.save();
    ctx.translate(chartX - 15, chartY + chartH/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillText("VCE (V)", 0, 0);
    ctx.restore();
  }

  function render() {
    // Clear canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    drawPowerSupply();
    drawInputSignal();
    drawTransistor();
    drawLoad();
    drawInfo();
    drawCharacteristics();
  }

  function reset() {
    time = 0;
  }

  function getStateDescription(): string {
    const state = baseState ? (saturationMode ? "saturated" : "active") : "cutoff";
    return `NPN transistor switch in ${state} mode. Input: ${baseVoltage}V, VCE: ${collectorVoltage.toFixed(2)}V, IC: ${(collectorCurrent*1000).toFixed(1)}mA. LED brightness: ${(ledBrightness*100).toFixed(0)}%.`;
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

export default TransistorSwitch;